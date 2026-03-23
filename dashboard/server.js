const express    = require('express');
const { createServer } = require('http');
const { WebSocket, WebSocketServer } = require('ws');
const path       = require('path');

const PORT       = parseInt(process.env.PORT         || '5800');
const ROBOT_HOST = process.env.ROBOT_HOST            || '10.85.77.2';
const NT_PORT    = parseInt(process.env.ROBOT_NT_PORT || '5810');

const app        = express();
const httpServer = createServer(app);

// Serve built frontend
app.use(express.static(path.join(__dirname, 'public')));

// ── NT4 WebSocket proxy ──────────────────────────────────────────────────────
// Browser connects to ws://localhost:5800/nt
// Server proxies transparently to ws://ROBOT_HOST:5810/nt/webdashboard
const wss = new WebSocketServer({ server: httpServer, path: '/nt' });

wss.on('connection', (clientWs, req) => {
  const robotUrl = `ws://${ROBOT_HOST}:${NT_PORT}/nt/webdashboard`;
  console.log(`[proxy] ${req.socket.remoteAddress} connected → ${robotUrl}`);

  const robotWs = new WebSocket(robotUrl);

  robotWs.on('open', () => console.log('[proxy] Robot connected'));

  // robot → browser
  robotWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN)
      clientWs.send(data, { binary: isBinary });
  });

  robotWs.on('close', code => {
    console.log(`[proxy] Robot closed (${code})`);
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1001);
  });

  robotWs.on('error', err => console.error(`[proxy] Robot: ${err.message}`));

  // browser → robot
  clientWs.on('message', (data, isBinary) => {
    if (robotWs.readyState === WebSocket.OPEN)
      robotWs.send(data, { binary: isBinary });
  });

  clientWs.on('close', () => {
    console.log('[proxy] Browser disconnected');
    robotWs.terminate();
  });

  clientWs.on('error', err => console.error(`[proxy] Browser: ${err.message}`));
});

httpServer.listen(PORT, () => {
  console.log('\n  ╔═══════════════════════════════════╗');
  console.log(`  ║  FRC 8577 Dashboard               ║`);
  console.log('  ╠═══════════════════════════════════╣');
  console.log(`  ║  Open:   http://localhost:${PORT}     ║`);
  console.log(`  ║  Robot:  ${ROBOT_HOST}:${NT_PORT}      ║`);
  console.log('  ╚═══════════════════════════════════╝\n');
});
