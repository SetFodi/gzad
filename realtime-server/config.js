module.exports = {
  // Port for the HTTP API + WebSocket server
  port: parseInt(process.env.PORT) || 8081,

  // Secret for authenticating API requests from your Next.js admin panel
  apiSecret: process.env.API_SECRET || 'change-me-in-production',

  // Your Gzad Vercel app URL — play logs and GPS data get forwarded here
  gzadAppUrl: process.env.GZAD_APP_URL || 'https://gzad.vercel.app',

  // Secret for authenticating callbacks to your Gzad app
  callbackSecret: process.env.CALLBACK_SECRET || 'change-me-in-production',

  // WebSocket ping interval (ms) — keeps connections alive
  pingInterval: 30000,

  // Command timeout (ms) — how long to wait for controller response
  commandTimeout: 30000,
}
