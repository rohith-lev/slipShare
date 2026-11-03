import express from 'express';
import http from 'http';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import cors from 'cors';
import qrcode from 'qrcode';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app
const nextApp = next({ dev, hostname: '0.0.0.0', port: PORT });
const handle = nextApp.getRequestHandler();

console.log('⚡ Initializing slipshare Next.js app...');
await nextApp.prepare();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Permissive CORS & Local Network Access headers for all routes (/*)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage config for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 * 10 }, // 10GB limit (practically unlimited for local transfers)
});

// Helper to determine Local IP
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// In-memory shared items and peer connections
let sharedItems = [];
const connectedClients = new Map();

function broadcast(data, excludeWs = null) {
  const message = JSON.stringify(data);
  for (const [wsClient] of connectedClients) {
    if (wsClient !== excludeWs && wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(message);
    }
  }
}

function broadcastDeviceList() {
  const devices = Array.from(connectedClients.values()).map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    isSelf: false,
    joinedAt: c.joinedAt,
  }));

  for (const [wsClient, clientInfo] of connectedClients) {
    if (wsClient.readyState === WebSocket.OPEN) {
      const personalizedDevices = devices.map((d) => ({
        ...d,
        isSelf: d.id === clientInfo.id,
      }));
      wsClient.send(
        JSON.stringify({
          type: 'devices_updated',
          devices: personalizedDevices,
          count: devices.length,
        })
      );
    }
  }
}

// REST Endpoints
app.get('/api/info', async (req, res) => {
  const localIp = getLocalIp();
  const connectUrl = `http://${localIp}:${PORT}`;

  try {
    const qrDataUrl = await qrcode.toDataURL(connectUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0B0B0F',
        light: '#FFFFFF',
      },
    });

    res.json({
      localIp,
      port: PORT,
      connectUrl,
      qrDataUrl,
    });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.get('/api/items', (req, res) => {
  res.json({ items: sharedItems });
});

app.post('/api/items', (req, res) => {
  const { type, content, title, senderName, senderType } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const newItem = {
    id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    type: type || 'text',
    content,
    title: title || (type === 'link' ? content : content.substring(0, 40)),
    senderName: senderName || 'Anonymous',
    senderType: senderType || 'desktop',
    timestamp: new Date().toISOString(),
  };

  sharedItems.unshift(newItem);
  if (sharedItems.length > 250) sharedItems.pop();

  broadcast({ type: 'item_received', item: newItem });
  res.status(201).json({ item: newItem });
});

app.post('/api/upload', upload.array('files', 20), (req, res) => {
  const senderName = req.body.senderName || 'Device';
  const senderType = req.body.senderType || 'mobile';

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded' });
  }

  const newItems = req.files.map((file) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    const isAudio = file.mimetype.startsWith('audio/');

    const item = {
      id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      type: 'file',
      fileType: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document',
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filename: file.filename,
      downloadUrl: `/api/files/${file.filename}/download?name=${encodeURIComponent(file.originalname)}`,
      viewUrl: `/api/files/${file.filename}/view`,
      senderName,
      senderType,
      timestamp: new Date().toISOString(),
    };

    sharedItems.unshift(item);
    return item;
  });

  if (sharedItems.length > 250) sharedItems = sharedItems.slice(0, 250);

  newItems.forEach((item) => {
    broadcast({ type: 'item_received', item });
  });

  res.status(201).json({ items: newItems });
});

app.get('/api/files/:filename/view', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  fs.createReadStream(filePath).pipe(res);
});

app.get('/api/files/:filename/download', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  const originalName = req.query.name || safeFilename;
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

app.delete('/api/items/:id', (req, res) => {
  const id = req.params.id;
  const index = sharedItems.findIndex((i) => i.id === id);
  if (index !== -1) {
    const item = sharedItems[index];
    if (item.type === 'file' && item.filename) {
      const filePath = path.join(uploadsDir, item.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }
    sharedItems.splice(index, 1);
    broadcast({ type: 'item_deleted', itemId: id });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Item not found' });
});

app.delete('/api/items', (req, res) => {
  sharedItems.forEach((item) => {
    if (item.type === 'file' && item.filename) {
      const filePath = path.join(uploadsDir, item.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }
  });
  sharedItems = [];
  broadcast({ type: 'history_cleared' });
  res.json({ success: true });
});

// All other routes (/*) are handled directly by Next.js
app.use((req, res) => {
  return handle(req, res);
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientId = 'peer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(userAgent);

  let clientName = isMobile ? 'Mobile' : 'Laptop';
  if (/iphone/i.test(userAgent)) clientName = 'iPhone';
  else if (/ipad/i.test(userAgent)) clientName = 'iPad';
  else if (/android/i.test(userAgent)) clientName = 'Android';
  else if (/macintosh/i.test(userAgent)) clientName = 'MacBook';
  else if (/windows/i.test(userAgent)) clientName = 'Windows PC';
  else if (/linux/i.test(userAgent)) clientName = 'Linux Laptop';

  connectedClients.set(ws, {
    id: clientId,
    type: isMobile ? 'mobile' : 'desktop',
    name: clientName,
    joinedAt: new Date().toISOString(),
  });

  // Welcome message with initial state
  ws.send(
    JSON.stringify({
      type: 'welcome',
      clientId,
      clientName,
      clientType: isMobile ? 'mobile' : 'desktop',
      items: sharedItems,
    })
  );

  broadcastDeviceList();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'set_name') {
        const info = connectedClients.get(ws);
        if (info) {
          info.name = data.name || info.name;
          broadcastDeviceList();
        }
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      console.error('WS parse error:', e);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    broadcastDeviceList();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🚀 slipshare is running!`);
  console.log(`   Local URL:    http://localhost:${PORT}`);
  console.log(`   Network URL:  http://${localIp}:${PORT}`);
  console.log(`   Access from any device on Wi-Fi via: http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});
