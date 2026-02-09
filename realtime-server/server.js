require('dotenv').config()
const express = require('express')
const http = require('http')
const { WebSocketServer } = require('ws')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const config = require('./config')

const app = express()
app.use(express.json({ limit: '100mb' }))

// ─── State ───────────────────────────────────────────────────────────────────
// Connected controllers: { cardId: { ws, connectedAt, lastSeen, info } }
const devices = {}
// Pending commands: { commandId: { resolve, reject, timer } }
const pendingCommands = {}

// ─── Auth middleware ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers['authorization']
  if (auth !== `Bearer ${config.apiSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ─── HTTP API ────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    devices: Object.keys(devices).length,
    uptime: process.uptime(),
  })
})

// List all connected devices
app.get('/devices', requireAuth, (req, res) => {
  const list = Object.entries(devices).map(([cardId, d]) => ({
    cardId,
    online: d.ws.readyState === 1,
    connectedAt: d.connectedAt,
    lastSeen: d.lastSeen,
    info: d.info || {},
  }))
  res.json(list)
})

// Get single device status
app.get('/devices/:cardId', requireAuth, (req, res) => {
  const d = devices[req.params.cardId]
  if (!d) return res.status(404).json({ error: 'Device not connected' })
  res.json({
    cardId: req.params.cardId,
    online: d.ws.readyState === 1,
    connectedAt: d.connectedAt,
    lastSeen: d.lastSeen,
    info: d.info || {},
  })
})

// Send command to device
app.post('/command/:cardId', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/brightness', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/screen', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/info', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/push-program', requireAuth, async (req, res) => {
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

      processedItems.push({
        url: item.url,
        type: item.type || 'video/mp4',
        duration: item.duration || 10,
        size: fileSize,
        md5: fileMd5,
      })
    }

    const program = buildProgram({
      name,
      mediaItems: processedItems,
      totalSize,
      schedule: schedule || {},
      width: width || 960,
      height: height || 320,
    })
    const result = await sendCommand(req.params.cardId, program)
    res.json({ success: true, result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Clear all programs from device (SDK: clearPlayerTask)
app.post('/devices/:cardId/clear-program', requireAuth, async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, { type: 'clearPlayerTask' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get current program JSON (SDK: getProgramTask, conn 10.0.9+)
app.post('/devices/:cardId/get-program', requireAuth, async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, { type: 'getProgramTask' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get currently playing program name (SDK: getPlayingProgram, conn 10.0.9+)
app.post('/devices/:cardId/get-playing', requireAuth, async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, { type: 'getPlayingProgram' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Take screenshot (SDK: callCardService + screenshot)
app.post('/devices/:cardId/screenshot', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/volume', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/scheduled-brightness', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/reboot', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/get-brightness', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/is-screen-on', requireAuth, async (req, res) => {
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

// Get GPS location one-shot (SDK: getGpsLocation)
app.post('/devices/:cardId/get-gps', requireAuth, async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      type: 'getGpsLocation',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get disk space (SDK: getDiskSpace)
app.post('/devices/:cardId/get-disk-space', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/get-upload-log-url', requireAuth, async (req, res) => {
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
app.post('/devices/:cardId/get-sub-gps', requireAuth, async (req, res) => {
  try {
    const result = await sendCommand(req.params.cardId, {
      _type: 'getSubGPS',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Configure play log + GPS callback URLs
app.post('/devices/:cardId/setup-callbacks', requireAuth, async (req, res) => {
  const results = {}

  try {
    // 1. Set play log upload URL (SDK: direct top-level command, NOT wrapped in commandXixunPlayer)
    const playlogResult = await sendCommand(req.params.cardId, {
      type: 'setUploadLogUrl',
      uploadurl: `${config.gzadAppUrl}/api/callback/playlog?key=${config.callbackSecret}&device=${req.params.cardId}`,
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
      endpoint: `${config.gzadAppUrl}/api/callback/gps?key=${config.callbackSecret}&device=${req.params.cardId}`,
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
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  let cardId = null

  ws.on('message', (raw) => {
    let data
    try {
      data = JSON.parse(raw.toString())
    } catch (e) {
      console.error('Invalid JSON from controller:', raw.toString().slice(0, 200))
      return
    }

    // Controller initial registration — sends { cardId: "xxx" }
    if (data.cardId) {
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
      // Don't delete — keep info, mark as disconnected
      if (devices[cardId]) {
        devices[cardId].lastSeen = new Date().toISOString()
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
    if (d.ws.readyState === 1) {
      try { d.ws.ping() } catch (e) {}
    }
  }
}, config.pingInterval)

// ─── Core functions ──────────────────────────────────────────────────────────

function sendCommand(cardId, data) {
  return new Promise((resolve, reject) => {
    const d = devices[cardId]
    if (!d || d.ws.readyState !== 1) {
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

function buildProgram({ name, mediaItems, totalSize = 0, schedule = {}, width = 960, height = 320 }) {
  // Build an XixunPlayer PlayXixunTask program (official SDK format)
  // Supports multiple media items (playlist) and time/date scheduling

  // Build sources array from media items with cumulative playTime offsets
  let currentPlayTime = 0
  const sources = mediaItems.map((item) => {
    const isVideo = (item.type || '').startsWith('video')
    const sourceType = isVideo ? 'Video' : 'Image'
    const mime = isVideo ? 'video/mp4' : (item.type || 'image/png')
    const fileExt = isVideo ? '.mp4' : (item.type && item.type.includes('png') ? '.png' : '.jpg')
    const fileName = name + '_' + currentPlayTime + fileExt

    const source = {
      _type: sourceType,
      md5: item.md5 || '',
      name: fileName,
      mime: mime,
      size: item.size || 0,
      fileExt: fileExt,
      id: uuidv4().replace(/-/g, ''),
      url: item.url,
      playTime: currentPlayTime,
      timeSpan: isVideo ? 0 : (item.duration || 10), // 0 = play full video
      left: 0,
      top: 0,
      width: width,
      height: height,
      entryEffect: 'None',
      exitEffect: 'None',
      entryEffectTimeSpan: 0,
      exitEffectTimeSpan: 0,
    }

    // Advance playTime for next source
    currentPlayTime += isVideo ? 0 : (item.duration || 10)

    return source
  })

  // Build schedule from config
  const scheduleConfig = {
    filterType: schedule.days && schedule.days.length < 7 ? 'Week' : 'None',
    timeType: schedule.startTime ? 'Range' : 'Range',
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
        items: [
          {
            _id: uuidv4().replace(/-/g, ''),
            _program: {
              id: uuidv4().replace(/-/g, ''),
              totalSize: totalSize,
              name: name,
              width: width,
              height: height,
              layers: [
                {
                  repeat: false,
                  sources: sources,
                },
              ],
            },
            repeatTimes: 1,
            schedules: [scheduleConfig],
          },
        ],
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

// ─── Start ───────────────────────────────────────────────────────────────────

server.listen(config.port, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║         Gzad Realtime Server v1.0.0               ║
║                                                    ║
║  HTTP API:    http://0.0.0.0:${config.port}              ║
║  WebSocket:   ws://0.0.0.0:${config.port}                ║
║  Forwarding:  ${config.gzadAppUrl}     ║
╚════════════════════════════════════════════════════╝
  `)
})
