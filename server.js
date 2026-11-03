// Standalone HTTP server wrapper for container/non-serverless deployments.
// index.js exports `app.callback()` (a Node request handler) for Vercel;
// here we wrap it in a real http.Server that listens on a port.
const http = require('http');
const handler = require('./index.js');

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

http.createServer(handler).listen(port, host, () => {
  console.log(`[@waline/auth] OAuth service listening on http://${host}:${port}`);
});
