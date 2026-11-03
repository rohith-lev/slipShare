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

// Use noServer mode so Next.js HMR and our custom /ws WebSocket don't collide
const wss = new WebSocketServer({ noServer: true });

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
  limits: { fileSize: 1024 * 1024 * 1024 * 10 }, // 10GB limit
});

// Helper to determine Local IPs prioritizing real Wi-Fi & Ethernet adapters
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  const priorityPatterns = [/wlan/i, /wl/i, /wifi/i, /en/i, /eth/i];
  const ignorePatterns = [/docker/i, /vbox/i, /vmnet/i, /br-/i, /cni/i, /tun/i, /tap/i, /lo/i];

  for (const [name, ifaces] of Object.entries(interfaces)) {
    if (ignorePatterns.some((p) => p.test(name))) continue;
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }

  // Sort: Wi-Fi / Ethernet first
  ips.sort((a, b) => {
    const aPri = priorityPatterns.findIndex((p) => p.test(a.name));
    const bPri = priorityPatterns.findIndex((p) => p.test(b.name));
    if (aPri !== -1 && bPri === -1) return -1;
    if (aPri === -1 && bPri !== -1) return 1;
    if (aPri !== -1 && bPri !== -1) return aPri - bPri;
    return 0;
  });

  return ips.length > 0 ? ips : [{ name: 'local', address: '127.0.0.1' }];
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
  const allIps = getLocalIps();
  const primaryIp = allIps[0].address;

  // If accessed via a remote host/proxy/tunnel, use that URL for pairing
  const reqHost = req.headers['x-forwarded-host'] || req.headers.host;
  let connectUrl;
  if (reqHost && !reqHost.includes('localhost') && !reqHost.includes('127.0.0.1')) {
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    connectUrl = `${proto}://${reqHost}`;
  } else {
    connectUrl = `http://${primaryIp}:${PORT}`;
  }

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
      localIp: primaryIp,
      allIps,
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

app.post('/api/upload', (req, res) => {
  upload.array('files', 100)(req, res, (err) => {
    if (err) {
      console.error('[Upload Error]:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File is too large for upload (max 10GB)' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Too many files selected (max 100 per batch)' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(500).json({ error: err.message || 'File upload failed on server' });
    }

    try {
      const senderName = req.body.senderName || 'Device';
      const senderType = req.body.senderType || 'mobile';

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files were uploaded. Please select a file.' });
      }

      const newItems = req.files.map((file) => {
        const mime = (file.mimetype || '').toLowerCase();
        const ext = path.extname(file.originalname || '').toLowerCase();

        const isImage = mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|heic|heif|avif)$/i.test(ext);
        const isVideo = mime.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|wmv|flv|m4v)$/i.test(ext);
        const isAudio = mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(ext);

        let cleanOriginalName = file.originalname || 'file';
        try {
          cleanOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        } catch {
          cleanOriginalName = file.originalname || 'file';
        }

        const item = {
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          type: 'file',
          fileType: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document',
          originalName: cleanOriginalName,
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
          filename: file.filename,
          downloadUrl: `/api/files/${file.filename}/download?name=${encodeURIComponent(cleanOriginalName)}`,
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

      console.log(`[Upload Success] ${newItems.length} file(s) uploaded by ${senderName} (${senderType})`);
      res.status(201).json({ items: newItems });
    } catch (handlerErr) {
      console.error('[Upload Handler Crash]:', handlerErr);
      res.status(500).json({ error: 'Server error processing uploaded files: ' + handlerErr.message });
    }
  });
});

// View media with proper Range support for audio/video streaming & accurate MIME types
app.get('/api/files/:filename/view', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  res.sendFile(safeFilename, {
    root: uploadsDir,
    dotfiles: 'deny',
    headers: {
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// Download files with RFC UTF-8 filename encoding and progress reporting
app.get('/api/files/:filename/download', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  const originalName = req.query.name || safeFilename;
  res.download(safeFilename, originalName, { root: uploadsDir });
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

// Explicit HTTP Upgrade handling for /ws
server.on('upgrade', (req, socket, head) => {
  try {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname === '/ws' || url.pathname === '/ws/') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  } catch (err) {
    console.error('WS upgrade error:', err);
    socket.destroy();
  }
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  const clientId = 'peer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(userAgent);

  let clientName = isMobile ? 'Mobile Phone' : 'Laptop';
  if (/iphone/i.test(userAgent)) clientName = 'iPhone';
  else if (/ipad/i.test(userAgent)) clientName = 'iPad';
  else if (/android/i.test(userAgent)) clientName = 'Android Phone';
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
    ws.isAlive = true;
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'set_name') {
        const info = connectedClients.get(ws);
        if (info && data.name && data.name.trim()) {
          info.name = data.name.trim();
          broadcastDeviceList();
        }
      } else if (data.type === 'ping' || data.type === 'client_pong') {
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

// 20-second heartbeat to detect dropped sockets and keep Wi-Fi links alive
const heartbeatInterval = setInterval(() => {
  for (const [ws, info] of connectedClients) {
    if (ws.isAlive === false) {
      console.log(`[WS] Pruned idle peer: ${info.name} (${info.id})`);
      connectedClients.delete(ws);
      ws.terminate();
      broadcastDeviceList();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'server_ping' }));
      }
    } catch {
      connectedClients.delete(ws);
      broadcastDeviceList();
    }
  }
}, 20000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.listen(PORT, '0.0.0.0', () => {
  const allIps = getLocalIps();
  console.log(`\n======================================================`);
  console.log(`🚀 slipshare is running!`);
  console.log(`   Local URL:    http://localhost:${PORT}`);
  allIps.forEach(ip => {
    console.log(`   Network (${ip.name}): http://${ip.address}:${PORT}`);
  });
  console.log(`======================================================\n`);
});
