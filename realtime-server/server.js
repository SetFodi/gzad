require('dotenv').config()
const express = require('express')
const http = require('http')
const { WebSocketServer } = require('ws')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const config = require('./config')

// Ad slot lengths an advertiser can buy, in seconds.
const ALLOWED_SLOT_DURATIONS = [10, 20, 30]
const DEFAULT_SLOT_DURATION = 10

const app = express()
app.set('trust proxy', true)

// ─── State ───────────────────────────────────────────────────────────────────
// Connected controllers: { cardId: { ws, connectedAt, lastSeen, info } }
const devices = {}
// Pending commands: { commandId: { resolve, reject, timer } }
const pendingCommands = {}
// Per-device callback keys, cached after the first lookup against the app.
const deviceKeyCache = new Map()

// ─── Auth middleware ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || ''
  const expected = `Bearer ${config.apiSecret}`
  // Constant-time compare so the secret can't be recovered by timing the response.
  const a = Buffer.from(auth)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ─── Rate limiting ───────────────────────────────────────────────────────────
// Fixed-window counter per IP. This server has one instance, so an in-process
// map is sufficient; it exists to blunt floods, not to meter fair usage.
const rateBuckets = new Map()

function rateLimit({ windowMs = 60_000, max = 300 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const now = Date.now()
    let bucket = rateBuckets.get(ip)
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs }
      rateBuckets.set(ip, bucket)
    }
    bucket.count++
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Too many requests' })
    }
    next()
  }
}

// Drop expired buckets so the map can't grow without bound.
setInterval(() => {
  const now = Date.now()
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip)
  }
}, 5 * 60 * 1000).unref()

// ─── HTTP API ────────────────────────────────────────────────────────────────

// Health check — no auth, no body parsing.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    devices: Object.keys(devices).length,
    uptime: process.uptime(),
  })
})

// Everything past this point is machine-to-machine. Authenticate and rate limit
// BEFORE parsing a body, so an unauthenticated caller can never make this
// process allocate memory for their payload.
app.use(rateLimit({ windowMs: 60_000, max: 300 }))
app.use(requireAuth)
app.use(express.json({ limit: '2mb' }))

// List all connected devices
app.get('/devices', (req, res) => {
  const list = Object.entries(devices).map(([cardId, d]) => ({
    cardId,
    online: d.ws ? d.ws.readyState === 1 : false,
    connectedAt: d.connectedAt,
    lastSeen: d.lastSeen,
    info: d.info || {},
  }))
  res.json(list)
})

// Get single device status
app.get('/devices/:cardId', (req, res) => {
  const d = devices[req.params.cardId]
  if (!d) return res.status(404).json({ error: 'Device not connected' })
  res.json({
    cardId: req.params.cardId,
    online: d.ws ? d.ws.readyState === 1 : false,
    connectedAt: d.connectedAt,
    lastSeen: d.lastSeen,
    info: d.info || {},
  })
})

// Send command to device
app.post('/command/:cardId', async (req, res) => {
  const { cardId } = req.params
  const data = req.body

  try {
    const result = await sendCommand(cardId, data)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Convenience endpoints ───────────────────────────────────────────────────

// Set brightness (SDK: callCardService + setBrightness)
app.post('/devices/:cardId/brightness', async (req, res) => {
  const { brightness } = req.body // 1-255
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'setBrightness',
      arg1: Math.max(1, Math.min(255, parseInt(brightness))),
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Screen on/off (SDK: callCardService + setScreenOpen)
app.post('/devices/:cardId/screen', async (req, res) => {
  const { on } = req.body // true or false
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'setScreenOpen',
      arg1: !!on,
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get device info (SDK: getCardInformation)
app.post('/devices/:cardId/info', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'getCardInformation',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Push a program (ad) to device — supports single or multiple media files + scheduling
app.post('/devices/:cardId/push-program', async (req, res) => {
  const { name, duration, mediaUrl, mediaType, width, height, mediaItems, schedule } = req.body

  // Support both old single-file format and new multi-file format
  let items = mediaItems
  if (!items && mediaUrl) {
    items = [{ url: mediaUrl, type: mediaType || 'video/mp4', duration: duration || 10 }]
  }

  if (!name || !items || items.length === 0) {
    return res.status(400).json({ error: 'name and at least one media item are required' })
  }

  try {
    // Fetch each file to get size and MD5 (SDK requires accurate values)
    const processedItems = []
    let totalSize = 0

    for (const item of items) {
      console.log(`[${new Date().toISOString()}] Fetching media: ${item.url}`)
      const fileResponse = await fetch(item.url)
      if (!fileResponse.ok) {
        return res.status(400).json({ error: `Failed to fetch media: ${item.url} (${fileResponse.status})` })
      }
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer())
      const fileSize = fileBuffer.length
      const fileMd5 = crypto.createHash('md5').update(fileBuffer).digest('hex')
      totalSize += fileSize
      console.log(`[${new Date().toISOString()}] Media: ${fileSize} bytes, MD5: ${fileMd5}`)

      // Slot length is what the advertiser bought and is billed for — the file's
      // own length is irrelevant, but the purchased duration must be honored.
      const duration = ALLOWED_SLOT_DURATIONS.includes(Number(item.duration))
        ? Number(item.duration)
        : DEFAULT_SLOT_DURATION

      processedItems.push({
        url: item.url,
        type: item.type || 'video/mp4',
        duration,
        size: fileSize,
        md5: fileMd5,
        campaignName: item.campaignName || null,
      })
    }

    // No clearPlayerTask here — insert:false replaces in-place without a visible gap
    console.log(`[${new Date().toISOString()}] Building program "${name}" with ${processedItems.length} media items, totalSize=${totalSize}`)

    const program = buildProgram({
      name,
      mediaItems: processedItems,
      totalSize,
      schedule: schedule || {},
      width: width || 240,
      height: height || 80,
    })
    const result = await sendCommand(req.params.cardId, program)
    res.json({ success: true, result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Clear all programs from device (SDK: clearPlayerTask)
app.post('/devices/:cardId/clear-program', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, { type: 'clearPlayerTask' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get current program JSON (SDK: getProgramTask, conn 10.0.9+)
app.post('/devices/:cardId/get-program', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, { type: 'getProgramTask' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get currently playing program name (SDK: getPlayingProgram, conn 10.0.9+)
app.post('/devices/:cardId/get-playing', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, { type: 'getPlayingProgram' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Take screenshot (SDK: callCardService + screenshot)
app.post('/devices/:cardId/screenshot', async (req, res) => {
  const { quality, scale } = req.body
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'screenshot',
      arg1: quality || 80,
      arg2: scale || 50,
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Set volume (SDK: callCardService + setVolume, 0-15)
app.post('/devices/:cardId/volume', async (req, res) => {
  const { volume } = req.body
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'setVolume',
      arg1: Math.max(0, Math.min(15, parseInt(volume))),
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Scheduled brightness (SDK: timedBrightness)
// Accepts: { items: [{ time: "HH:MM", brightness: 100 }] }
app.post('/devices/:cardId/scheduled-brightness', async (req, res) => {
  const { items } = req.body
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'items array required' })
  }
  // Build SDK-compatible task from simple items
  const task = {
    isOpen: true,
    items: items.map(item => ({
      range: { startTime: item.time, endTime: item.time },
      bright: item.brightness,
    })),
  }
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'timedBrightness',
      task: task,
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Reboot device (SDK: callCardService + reboot)
app.post('/devices/:cardId/reboot', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'reboot',
      arg1: 1, // delay in seconds
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get current brightness (SDK: callCardService + getBrightness)
app.post('/devices/:cardId/get-brightness', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'getBrightness',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get screen status (SDK: callCardService + isScreenOpen)
app.post('/devices/:cardId/is-screen-on', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'isScreenOpen',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get GPS location via getCardInformation (Y12-EU doesn't support dedicated GPS commands)
app.post('/devices/:cardId/get-gps', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'getCardInformation',
    })
    const lat = result?.card?.lat || 0
    const lng = result?.card?.lng || 0
    res.json({
      lat,
      lng,
      speed: result?.card?.speed || 0,
      temperature: result?.card?.temperature,
      screenStatus: result?.card?.screenStatus,
      currentProgram: result?.card?.currentProgramName,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get disk space (SDK: getDiskSpace)
app.post('/devices/:cardId/get-disk-space', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'getDiskSpace',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get play log upload config (SDK: getUploadLogUrl)
app.post('/devices/:cardId/get-upload-log-url', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'getUploadLogUrl',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get GPS subscription config (SDK: getSubGPS)
app.post('/devices/:cardId/get-sub-gps', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'getSubGPS',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get SIM/network info (SDK: callCardService + getSimInfo)
app.post('/devices/:cardId/get-sim-info', async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'getSimInfo',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Clean device storage (clear programs + optional cleanStorage)
app.post('/devices/:cardId/clean-storage', async (req, res) => {
  const results = {}
  try {
    // Step 1: Clear all player tasks
    results.clearProgram = await sendCommand(req.params.cardId, { type: 'clearPlayerTask' })
  } catch (err) {
    results.clearProgram = { error: err.message }
  }

  try {
    // Step 2: Call cleanStorage service if available
    results.cleanStorage = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'cleanStorage',
    })
  } catch (err) {
    results.cleanStorage = { error: err.message }
  }

  try {
    // Step 3: Get remaining disk space
    results.diskSpace = await sendCommand(req.params.cardId, { type: 'getDiskSpace' })
  } catch (err) {
    results.diskSpace = { error: err.message }
  }

  res.json({ success: true, ...results })
})

// Enable/disable play logging (SDK: callCardService + setLogSwitch)
app.post('/devices/:cardId/set-log-switch', async (req, res) => {
  const { enabled } = req.body // true or false, defaults to true
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'callCardService',
      fn: 'setLogSwitch',
      arg1: enabled !== false ? 1 : 0,
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Configure play log + GPS callback URLs
app.post('/devices/:cardId/setup-callbacks', async (req, res) => {
  const results = {}
  const key = await fetchDeviceCallbackKey(req.params.cardId)

  try {
    // 1. Set play log upload URL (SDK: direct top-level command, NOT wrapped in commandXixunPlayer)
    const playlogResult = await sendCommand(req.params.cardId, {
      type: 'setUploadLogUrl',
      uploadurl: callbackUrl('playlog', req.params.cardId, key),
      interval: '5',
    })
    results.playlog = playlogResult
  } catch (err) {
    results.playlog = { error: err.message }
  }

  try {
    // 2. Set GPS subscription (SDK: direct top-level command, NOT wrapped in commandXixunPlayer)
    const gpsResult = await sendCommand(req.params.cardId, {
      type: 'setSubGPS',
      openSub: true,
      endpoint: callbackUrl('gps', req.params.cardId, key),
      topic: 'gzad/gps/location',
      interval: 30,
      mode: 'http',
    })
    results.gps = gpsResult
  } catch (err) {
    results.gps = { error: err.message }
  }

  res.json({ success: true, ...results })
})

// ─── WebSocket Server ────────────────────────────────────────────────────────

const server = http.createServer(app)
const wss = new WebSocketServer({
  server,
  verifyClient: (info, cb) => {
    // If WS_SECRET is configured, require token in query string
    if (config.wsSecret) {
      const url = new URL(info.req.url, `http://${info.req.headers.host}`)
      const token = url.searchParams.get('token')
      if (token !== config.wsSecret) {
        console.log(`[${new Date().toISOString()}] WebSocket connection rejected: invalid token from ${info.req.socket.remoteAddress}`)
        return cb(false, 401, 'Unauthorized')
      }
    }
    cb(true)
  },
})

// Parse allowed devices into a Set for fast lookup
const allowedDeviceSet = new Set(
  config.allowedDevices ? config.allowedDevices.split(',').map(s => s.trim()).filter(Boolean) : []
)

wss.on('connection', (ws) => {
  let cardId = null

  ws.on('message', (raw) => {
    let data
    const rawStr = raw.toString()
    try {
      data = JSON.parse(rawStr)
    } catch (e) {
      // Some controllers send cardId as plain text (not JSON) on initial connection
      const plainId = rawStr.trim()
      if (/^[a-zA-Z0-9\-_]+$/.test(plainId) && plainId.length > 3 && plainId.length < 50) {
        data = { cardId: plainId }
      } else {
        // Binary/TLS data — silently ignore to avoid log spam
        return
      }
    }

    // Controller initial registration — sends { cardId: "xxx" }
    if (data.cardId) {
      // Check device allowlist (if configured)
      if (allowedDeviceSet.size > 0 && !allowedDeviceSet.has(data.cardId)) {
        console.log(`[${new Date().toISOString()}] Device rejected (not in allowlist): ${data.cardId} from ${ws._socket?.remoteAddress || 'unknown'}`)
        ws.close(4003, 'Device not allowed')
        return
      }

      cardId = data.cardId

      // Close old connection if exists
      if (devices[cardId] && devices[cardId].ws !== ws) {
        try { devices[cardId].ws.close() } catch (e) {}
      }

      devices[cardId] = {
        ws,
        connectedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        info: {},
      }
      console.log(`[${new Date().toISOString()}] Device connected: ${cardId}`)

      // Auto-configure callbacks on every connection
      autoSetupDevice(cardId)
      return
    }

    // Update last seen
    if (cardId && devices[cardId]) {
      devices[cardId].lastSeen = new Date().toISOString()
    }

    // Controller restart notification
    if (data._type === 'restart') {
      console.log(`[${new Date().toISOString()}] Device restarted: ${cardId}`)
      return
    }

    // Play log data from controller
    if (data._type === 'UploadPlayLogs' || data.type === 'UploadPlayLogs') {
      console.log(`[${new Date().toISOString()}] Play logs from ${cardId}: ${(data.logs || data.data || []).length} entries`)
      forwardPlayLogs(cardId, data)
      // Acknowledge to controller
      ws.send(JSON.stringify({ _type: 'success', _id: data._id }))
      return
    }

    // GPS data from controller
    if (data._type === 'GPS' || data.type === 'GPS' || data.lat !== undefined) {
      forwardGPS(cardId, data)
      return
    }

    // Command response — resolve pending promise
    if (data._id && pendingCommands[data._id]) {
      const cmd = pendingCommands[data._id]
      clearTimeout(cmd.timer)
      delete pendingCommands[data._id]

      if (data._type === 'error') {
        cmd.reject(new Error(data.message || 'Command failed'))
      } else {
        cmd.resolve(data)
      }
      return
    }

    // Unknown message
    console.log(`[${new Date().toISOString()}] Unknown from ${cardId}:`, JSON.stringify(data).slice(0, 300))
  })

  ws.on('close', () => {
    if (cardId) {
      console.log(`[${new Date().toISOString()}] Device disconnected: ${cardId}`)
      if (devices[cardId]) {
        devices[cardId].lastSeen = new Date().toISOString()
        // Clean up: null out the WebSocket reference to free memory
        devices[cardId].ws = null
        // Remove stale pending commands for this device
        for (const [cmdId, cmd] of Object.entries(pendingCommands)) {
          if (cmdId.startsWith(cardId + '_') || cmd?.cardId === cardId) {
            delete pendingCommands[cmdId]
          }
        }
        // Schedule full removal after 1 hour (device info kept temporarily for /devices API)
        setTimeout(() => {
          if (devices[cardId] && devices[cardId].ws === null) {
            delete devices[cardId]
            console.log(`[${new Date().toISOString()}] Cleaned up stale device: ${cardId}`)
          }
        }, 60 * 60 * 1000)
      }
    }
  })

  ws.on('error', (err) => {
    console.error(`WebSocket error for ${cardId}:`, err.message)
  })
})

// Ping all connected devices to keep connections alive
setInterval(() => {
  for (const [cardId, d] of Object.entries(devices)) {
    if (d.ws && d.ws.readyState === 1) {
      try { d.ws.ping() } catch (e) {}
    }
  }
}, config.pingInterval)

// ─── Core functions ──────────────────────────────────────────────────────────

function sendCommand(cardId, data) {
  return new Promise((resolve, reject) => {
    const d = devices[cardId]
    if (!d || !d.ws || d.ws.readyState !== 1) {
      return reject(new Error(`Device ${cardId} is not connected`))
    }

    const commandId = data._id || uuidv4()
    data._id = commandId

    const timer = setTimeout(() => {
      delete pendingCommands[commandId]
      reject(new Error('Command timeout'))
    }, config.commandTimeout)

    pendingCommands[commandId] = { resolve, reject, timer }

    d.ws.send(JSON.stringify(data), (err) => {
      if (err) {
        clearTimeout(timer)
        delete pendingCommands[commandId]
        reject(err)
      } else {
        console.log(`[${new Date().toISOString()}] Sent to ${cardId}:`, JSON.stringify(data).slice(0, 200))
      }
    })
  })
}

function buildProgram({ name, mediaItems, totalSize = 0, schedule = {}, width = 240, height = 80 }) {
  // Build an XixunPlayer PlayXixunTask program
  // Each media file becomes a separate item in the task (VeeHub approach)
  // This ensures reliable rotation with any number of ads

  // Build schedule from config
  const scheduleConfig = {
    filterType: schedule.days && schedule.days.length < 7 ? 'Week' : 'None',
    timeType: 'Range',
    startTime: schedule.startTime || '00:00',
    endTime: schedule.endTime || '23:59',
    dateType: schedule.startDate ? 'Range' : 'All',
  }
  if (scheduleConfig.filterType === 'Week') {
    scheduleConfig.weekFilter = schedule.days
  }
  if (scheduleConfig.dateType === 'Range') {
    scheduleConfig.startDate = schedule.startDate
    scheduleConfig.endDate = schedule.endDate
  }

  // Each media file = one item in the playlist
  const items = mediaItems.map((item, index) => {
    const isVideo = (item.type || '').startsWith('video')
    const sourceType = isVideo ? 'Video' : 'Image'
    const mime = isVideo ? 'video/mp4' : (item.type || 'image/png')
    const fileExt = isVideo ? '.mp4' : (item.type && item.type.includes('png') ? '.png' : '.jpg')
    // Use per-item campaign name if provided (for playlog matching), else fall back to playlist name
    const itemName = item.campaignName || name
    const timeSpan = Number(item.duration) > 0 ? Number(item.duration) : 10

    return {
      _id: uuidv4().replace(/-/g, ''),
      _program: {
        id: uuidv4().replace(/-/g, ''),
        totalSize: item.size || 0,
        name: itemName,
        width: width,
        height: height,
        layers: [
          {
            repeat: false,
            sources: [
              {
                _type: sourceType,
                md5: item.md5 || '',
                name: itemName + fileExt,
                mime: mime,
                size: item.size || 0,
                fileExt: fileExt,
                id: uuidv4().replace(/-/g, ''),
                url: item.url,
                playTime: 0,
                timeSpan: timeSpan,
                left: 0,
                top: 0,
                width: width,
                height: height,
                entryEffect: 'None',
                exitEffect: 'None',
                entryEffectTimeSpan: 0,
                exitEffectTimeSpan: 0,
              },
            ],
          },
        ],
      },
      repeatTimes: 1,
      schedules: [scheduleConfig],
    }
  })

  return {
    type: 'commandXixunPlayer',
    command: {
      _type: 'PlayXixunTask',
      id: uuidv4(),
      preDownloadURL: '',
      notificationURL: '',
      task: {
        _id: uuidv4(),
        name: name,
        insert: false,
        items: items,
      },
    },
  }
}

async function forwardPlayLogs(cardId, data) {
  const logs = data.logs || data.data || []
  if (logs.length === 0) return

  try {
    const response = await fetch(`${config.gzadAppUrl}/api/callback/playlog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.callbackSecret}`,
        'Card-Id': cardId,
      },
      body: JSON.stringify(logs),
    })
    const result = await response.json()
    console.log(`[${new Date().toISOString()}] Forwarded ${logs.length} play logs for ${cardId}:`, result)
  } catch (err) {
    console.error(`Failed to forward play logs for ${cardId}:`, err.message)
  }
}

async function forwardGPS(cardId, data) {
  try {
    const gpsData = {
      lat: data.lat || data.latitude,
      lng: data.lng || data.longitude,
      speed: data.speed || 0,
      timestamp: data.timestamp || new Date().toISOString(),
    }

    const response = await fetch(`${config.gzadAppUrl}/api/callback/gps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.callbackSecret}`,
        'Card-Id': cardId,
      },
      body: JSON.stringify(gpsData),
    })
    const result = await response.json()
    // Don't log every GPS update — too noisy
  } catch (err) {
    console.error(`Failed to forward GPS for ${cardId}:`, err.message)
  }
}

// ─── Device callback credentials ─────────────────────────────────────────────
// A controller authenticates its own callbacks with its own key, so a taxi that
// is physically tampered with exposes only that device rather than the whole
// fleet's play-log and GPS ingestion. Falls back to the shared secret when the
// app can't issue a key (e.g. before the migration has been applied).
async function fetchDeviceCallbackKey(cardId) {
  const cached = deviceKeyCache.get(cardId)
  if (cached) return cached

  try {
    const res = await fetch(`${config.gzadAppUrl}/api/devices/callback-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.callbackSecret}` },
      body: JSON.stringify({ cardId }),
    })
    if (!res.ok) throw new Error(`callback-config returned ${res.status}`)
    const { key } = await res.json()
    if (key) {
      deviceKeyCache.set(cardId, key)
      return key
    }
    throw new Error('no key in response')
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Device key lookup failed for ${cardId} (${err.message}) — using shared secret`)
    return config.callbackSecret
  }
}

function callbackUrl(kind, cardId, key) {
  return `${config.gzadAppUrl}/api/callback/${kind}`
    + `?key=${encodeURIComponent(key)}&device=${encodeURIComponent(cardId)}`
}

async function autoSetupDevice(cardId) {
  // Small delay to let the WebSocket fully establish
  await new Promise(r => setTimeout(r, 1000))

  const key = await fetchDeviceCallbackKey(cardId)
  const playlogUrl = callbackUrl('playlog', cardId, key)

  // Run all setup commands in parallel — each has its own try/catch so one failure won't block others
  await Promise.allSettled([
    // 1a. Tell XixunPlayer to upload play logs (player-level command)
    sendCommand(cardId, {
      type: 'commandXixunPlayer',
      command: {
        _type: 'UploadPlayLogs',
        id: uuidv4(),
        interval: 5, // minutes
        url: playlogUrl,
      },
    }).then(() => {
      console.log(`[${new Date().toISOString()}] Auto UploadPlayLogs (player) set for ${cardId}`)
    }).catch((err) => {
      console.log(`[${new Date().toISOString()}] Auto UploadPlayLogs (player) failed for ${cardId}: ${err.message}`)
    }),

    // 1b. System-level play log URL (firmware fallback — handles setUploadLogUrl HTTP POST format)
    sendCommand(cardId, {
      type: 'setUploadLogUrl',
      uploadurl: playlogUrl,
      interval: '5',
    }).then(() => {
      console.log(`[${new Date().toISOString()}] Auto setUploadLogUrl (system) set for ${cardId}`)
    }).catch((err) => {
      console.log(`[${new Date().toISOString()}] Auto setUploadLogUrl (system) failed for ${cardId}: ${err.message}`)
    }),

    // GPS is captured per-ad via the play log callback (lat/lng embedded in each log entry)
  ])
}

// ─── Billing trigger ─────────────────────────────────────────────────────────
// Vercel's free plan caps scheduled functions at one run per day, but this
// process is always up on the VPS. /api/billing/calculate only ever charges
// whole elapsed hours and dedupes on a unique index, so calling it on a short
// interval is both safe and self-healing after an outage.
function startBillingTrigger() {
  if (!config.billingTriggerEnabled) return

  const tick = async () => {
    try {
      const res = await fetch(`${config.gzadAppUrl}/api/billing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.callbackSecret}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error(`[${new Date().toISOString()}] Billing run failed (${res.status}):`, body.error || body)
        return
      }
      if (body.periodsBilled) {
        console.log(`[${new Date().toISOString()}] Billing: ${body.periodsBilled} period(s), ${body.totalCharged} GEL, ${body.pausedClients} client(s) paused`)
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Billing trigger error:`, err.message)
    }
  }

  setTimeout(tick, 30_000)
  setInterval(tick, config.billingIntervalMs)
  console.log(`Billing trigger enabled — every ${Math.round(config.billingIntervalMs / 60000)} min`)
}

// ─── Start ───────────────────────────────────────────────────────────────────

// Refuse to run with placeholder secrets outside development — these guard the
// command channel to every screen in the fleet.
const insecureSecrets = []
if (config.apiSecret === 'change-me-in-production') insecureSecrets.push('API_SECRET')
if (config.callbackSecret === 'change-me-in-production') insecureSecrets.push('CALLBACK_SECRET')
if (!config.wsSecret) insecureSecrets.push('WS_SECRET (unset — any client may connect as a device)')

if (insecureSecrets.length > 0) {
  const message = `Insecure configuration: ${insecureSecrets.join(', ')}`
  if (process.env.NODE_ENV === 'production') {
    console.error(`FATAL: ${message}. Set them in .env before starting.`)
    process.exit(1)
  }
  console.warn(`WARNING: ${message}. This is fatal when NODE_ENV=production.`)
}

server.listen(config.port, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║         Gzad Realtime Server v1.1.0               ║
║                                                    ║
║  HTTP API:    http://0.0.0.0:${config.port}              ║
║  WebSocket:   ws://0.0.0.0:${config.port}                ║
║  Forwarding:  ${config.gzadAppUrl}     ║
╚════════════════════════════════════════════════════╝
  `)
  startBillingTrigger()
})

// A rejected promise anywhere in the request path must not take down the process
// that holds every device's command channel.
process.on('unhandledRejection', (reason) => {
  console.error(`[${new Date().toISOString()}] Unhandled rejection:`, reason)
})
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught exception:`, err)
})

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n[${new Date().toISOString()}] ${signal} received, shutting down gracefully...`)
  // Close all WebSocket connections
  for (const [cardId, d] of Object.entries(devices)) {
    if (d.ws) {
      try { d.ws.close(1001, 'Server shutting down') } catch (e) {}
    }
  }
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
  // Force exit after 5 seconds
  setTimeout(() => process.exit(1), 5000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
