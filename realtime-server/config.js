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

  // WebSocket ping interval (ms) — keeps connections alive. A dead connection
  // shows as offline after heartbeatMisses intervals of silence (90 s by default).
  pingInterval: parseInt(process.env.PING_INTERVAL_MS) || 30000,

  // A screen is dropped only after this many ping intervals with nothing heard
  // from it: one late answer from a busy screen on mobile data is normal.
  heartbeatMisses: parseInt(process.env.HEARTBEAT_MISSES) || 3,

  // How often every connected screen is told again where to report its plays,
  // in case it lost the setting.
  setupRefreshMs: parseInt(process.env.SETUP_REFRESH_MS) || 15 * 60 * 1000,

  // Waits before retrying a failed play-reporting setup on the same connection.
  setupRetryDelaysMs: (process.env.SETUP_RETRY_DELAYS_MS || '30000,120000,300000').split(',').map(Number).filter(n => n > 0),

  // Command timeout (ms) — how long to wait for controller response
  commandTimeout: parseInt(process.env.COMMAND_TIMEOUT_MS) || 30000,

  // Live view: how often a watched screen is asked what it is playing. An ad's
  // start is known to within this interval. Only screens open in the live view
  // are asked; watching lapses watchTtlMs after the view stops asking.
  nowPlayingEveryMs: parseInt(process.env.NOW_PLAYING_EVERY_MS) || 1000,
  nowPlayingTimeoutMs: 4000,
  watchTtlMs: parseInt(process.env.WATCH_TTL_MS) || 30000,
}
