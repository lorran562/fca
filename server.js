// server.js — Servidor customizado: Next.js + Socket.io
// Deploy: Railway, Render, Fly.io (Vercel não suporta WebSockets)

const { createServer } = require('http');
const { parse }        = require('url');
const next             = require('next');
const { Server }       = require('socket.io');
const { setupSocketHandlers } = require('./gameEngine');

const dev      = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port     = parseInt(process.env.PORT || '3000', 10);

const app    = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      await handle(req, res, parse(req.url, true));
    } catch (err) {
      console.error('Request error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(httpServer, {
    path: '/api/socketio',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout:  20000,
    pingInterval: 25000,
  });

  setupSocketHandlers(io);
  global.io = io;

  httpServer.listen(port, hostname, () => {
    console.log(`\n⚡ Flash Click Arena`);
    console.log(`   URL:  http://localhost:${port}`);
    console.log(`   Modo: ${dev ? 'desenvolvimento' : 'produção'}\n`);
  });
});
