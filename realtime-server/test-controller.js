// Fake Xixun Y12-EU controller for local testing
// Connects to the Realtime Server via WebSocket and responds to commands

const WebSocket = require('ws')

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8081'
const CARD_ID = process.env.CARD_ID || 'y1c-825-61009'

let ws

function connect() {
  console.log(`\n🔌 Connecting to ${SERVER_URL} as ${CARD_ID}...`)
  ws = new WebSocket(SERVER_URL)

  ws.on('open', () => {
    console.log('✅ Connected! Sending registration...')
    // Step 1: Register with the server (this is what real controllers do)
    ws.send(JSON.stringify({ cardId: CARD_ID }))
    console.log(`📡 Registered as ${CARD_ID}\n`)
    console.log('Waiting for commands... (try pushing an ad from the admin panel)\n')

    // Simulate sending GPS every 30s
    setInterval(() => {
      // Random position around Tbilisi
      const lat = 41.7151 + (Math.random() - 0.5) * 0.02
      const lng = 44.8271 + (Math.random() - 0.5) * 0.02
      const speed = Math.floor(Math.random() * 60)
      ws.send(JSON.stringify({
        _type: 'GPS',
        lat,
        lng,
        speed,
        timestamp: new Date().toISOString(),
      }))
      console.log(`📍 Sent GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} @ ${speed}km/h`)
    }, 30000)

    // Simulate sending play logs every 60s
    setInterval(() => {
      const logs = {
        _type: 'UploadPlayLogs',
        _id: `log-${Date.now()}`,
        logs: [
          {
            beginAt: Date.now() - 10000,
            duration: 10,
            lat: 41.7151 + (Math.random() - 0.5) * 0.01,
            lng: 44.8271 + (Math.random() - 0.5) * 0.01,
            name: 'test campaign 1',
            pid: 'test-program-id',
            type: 'program',
          },
        ],
      }
      ws.send(JSON.stringify(logs))
      console.log(`📊 Sent play log: "${logs.logs[0].name}" (${logs.logs[0].duration}s)`)
    }, 60000)
  })

  ws.on('message', (raw) => {
    const data = JSON.parse(raw.toString())
    console.log('📩 Received command:', JSON.stringify(data, null, 2).slice(0, 500))

    // Simulate controller responses based on command type
    if (data.type === 'callCardService') {
      // Brightness, screen, volume, etc.
      const response = { _id: data._id, result: true }
      ws.send(JSON.stringify(response))
      console.log(`✅ Responded to ${data.fn}: success\n`)
    } else if (data.type === 'getCardInformation') {
      const response = {
        _id: data._id,
        _type: 'success',
        card: {
          alias: 'gzad-taxi-1',
          screenStatus: 'on',
          currentProgramName: 'test campaign 1',
          playerVersion: '10.9.9-22_5',
          netType: '4G',
          width: 960,
          height: 320,
          brightness: 200,
          autoBrightness: false,
          volume: 10,
          lat: 41.7151,
          lng: 44.8271,
        },
        deviceId: CARD_ID,
      }
      ws.send(JSON.stringify(response))
      console.log('✅ Responded to getCardInformation: sent device info\n')
    } else if (data.type === 'commandXixunPlayer') {
      // PlayXixunTask, setUploadLogUrl, setSubGPS, etc.
      const command = typeof data.command === 'string' ? JSON.parse(data.command) : data.command
      const response = { _id: data._id, _type: 'success', timestamp: Date.now() }
      ws.send(JSON.stringify(response))

      if (command._type === 'PlayXixunTask') {
        const taskName = command.task?.name || 'unknown'
        const source = command.task?.items?.[0]?._program?.layers?.[0]?.sources?.[0]
        console.log(`🎬 PROGRAM PUSHED: "${taskName}"`)
        if (source) {
          console.log(`   Type: ${source._type}, URL: ${source.url?.slice(0, 80)}...`)
          console.log(`   Size: ${source.width}x${source.height}, Duration: ${source.timeSpan}s`)
        }
        console.log('')
      } else if (command.type === 'setUploadLogUrl') {
        console.log(`📊 Play log callback configured: ${command.uploadurl?.slice(0, 80)}...`)
        console.log(`   Interval: ${command.interval} minutes\n`)
      } else if (command.type === 'setSubGPS') {
        console.log(`📍 GPS subscription ${command.openSub ? 'enabled' : 'disabled'}: ${command.endpoint?.slice(0, 80)}...`)
        console.log(`   Interval: ${command.interval}s, Mode: ${command.mode}\n`)
      } else {
        console.log(`✅ Responded to commandXixunPlayer (${command.type || command._type}): success\n`)
      }
    } else {
      // Unknown command — just acknowledge
      const response = { _id: data._id, _type: 'success', timestamp: Date.now() }
      ws.send(JSON.stringify(response))
      console.log('✅ Responded with generic success\n')
    }
  })

  ws.on('close', () => {
    console.log('❌ Disconnected. Reconnecting in 3s...')
    setTimeout(connect, 3000)
  })

  ws.on('error', (err) => {
    console.error('Error:', err.message)
  })
}

connect()
