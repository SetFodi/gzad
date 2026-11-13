module.exports = {
  // Port for the HTTP API + WebSocket server
  port: parseInt(process.env.PORT) || 8081,

  // Secret for authenticating API requests from your Next.js admin panel
  apiSecret: process.env.API_SECRET || 'change-me-in-production',

  // Your Gzad Vercel app URL — play logs and GPS data get forwarded here
  gzadAppUrl: process.env.GZAD_APP_URL || 'https://gzad.vercel.app',

  // Secret for authenticating callbacks to your Gzad app
  callbackSecret: process.env.CALLBACK_SECRET || 'change-me-in-production',

  // Secret for authenticating WebSocket connections from controllers
  // Set the device's realtime server URL to: ws://HOST:PORT?token=THIS_SECRET
  wsSecret: process.env.WS_SECRET || '',

  // Screens are admitted when they are on the app's admin Devices page. IDs
  // listed here (comma-separated) are admitted as well, even when the app
  // can't be reached. Example: 'y1c-825-61009,y1c-825-61010'
  allowedDevices: process.env.ALLOWED_DEVICES || '',

  // Host and port controllers should dial, shown on the admin Add screen form.
  // Defaults to the address the app uses to reach this server.
  deviceAddressHost: process.env.DEVICE_ADDRESS_HOST || '',

  // Run the hourly billing calculation from this process. Vercel's free plan
  // only allows one cron per day; this box is always up, so it drives billing
  // instead. The endpoint is idempotent, so a repeated call is harmless.
  billingTriggerEnabled: process.env.ENABLE_BILLING_TRIGGER === 'true',
  billingIntervalMs: parseInt(process.env.BILLING_INTERVAL_MS) || 15 * 60 * 1000,

  // WebSocket ping interval (ms) — keeps connections alive. A screen that misses
  // a ping is dropped by the next one, so a dead connection shows as offline
  // within two intervals.
  pingInterval: parseInt(process.env.PING_INTERVAL_MS) || 30000,

  // Command timeout (ms) — how long to wait for controller response
  commandTimeout: 30000,

  // Live view: how often a watched screen is asked what it is playing. An ad's
  // start is known to within this interval. Only screens open in the live view
  // are asked; watching lapses watchTtlMs after the view stops asking.
  nowPlayingEveryMs: parseInt(process.env.NOW_PLAYING_EVERY_MS) || 1000,
  nowPlayingTimeoutMs: 4000,
  watchTtlMs: parseInt(process.env.WATCH_TTL_MS) || 30000,
}
