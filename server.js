/**
 * server.js — Local-dev Express server (used by `npm run dev`)
 *
 * On Vercel this file is NOT executed. Vercel runs `next build` and then
 * serves everything via Next.js API routes (app/api/**).
 *
 * Locally, this file starts Next.js in embedded mode and adds:
 *   - GET  /api/events       SSE real-time stream (same path as Next.js route)
 *   - POST /api/devices      Client→server messages (name change)
 *   - POST /api/upload       Multipart file upload via Multer
 *   - GET  /api/info         LAN IP + QR code
 *   - GET  /api/items        List items
 *   - POST /api/items        Create text/link item
 *   - DELETE /api/items      Clear all
 *   - DELETE /api/items/:id  Remove one item
 *   - GET  /api/files/:f/view     Stream file inline
 *   - GET  /api/files/:f/download Force-download
 */

import express from 'express';
import http from 'http';
import next from 'next';
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

// ─── Next.js ────────────────────────────────────────────────────────────────
const nextApp = next({ dev, hostname: '0.0.0.0', port: PORT });
const handle = nextApp.getRequestHandler();

console.log('⚡ Initializing slipshare…');
await nextApp.prepare();

const app = express();
const server = http.createServer(app);

// ─── Uploads directory ───────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── CORS & private-network access ──────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Private-Network', 'true');
  res.header('X-Accel-Buffering', 'no');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Multer ──────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, suffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024, files: 100, fieldSize: 10 * 1024 * 1024 },
});

// ─── IP helpers ───────────────────────────────────────────────────────────────
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  const priority = [/wlan/i, /wl/i, /wifi/i, /en/i, /eth/i];
  const ignore = [/docker/i, /vbox/i, /vmnet/i, /br-/i, /cni/i, /tun/i, /tap/i, /lo/i];

  for (const [name, ifaces] of Object.entries(interfaces)) {
    if (ignore.some((p) => p.test(name))) continue;
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push({ name, address: iface.address });
    }
  }
  ips.sort((a, b) => {
    const ai = priority.findIndex((p) => p.test(a.name));
    const bi = priority.findIndex((p) => p.test(b.name));
    if (ai !== -1 && bi === -1) return -1;
    if (ai === -1 && bi !== -1) return 1;
    if (ai !== -1 && bi !== -1) return ai - bi;
    return 0;
  });
  return ips.length ? ips : [{ name: 'local', address: '127.0.0.1' }];
}

function parseUserAgent(ua = '') {
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua);
  let name = isMobile ? 'Mobile Phone' : 'Laptop';
  if (/iphone/i.test(ua)) name = 'iPhone';
  else if (/ipad/i.test(ua)) name = 'iPad';
  else if (/android/i.test(ua)) name = 'Android Phone';
  else if (/macintosh/i.test(ua)) name = 'MacBook';
  else if (/windows/i.test(ua)) name = 'Windows PC';
  else if (/linux/i.test(ua)) name = 'Linux Laptop';
  return { name, type: isMobile ? 'mobile' : 'desktop' };
}

// ─── In-memory state ─────────────────────────────────────────────────────────
let sharedItems = [];
/** @type {Map<string, { id:string; name:string; type:string; joinedAt:string; send:(d:object)=>void }>} */
const connectedClients = new Map();

function broadcast(data, excludeId = null) {
  for (const [id, client] of connectedClients) {
    if (id !== excludeId) try { client.send(data); } catch { connectedClients.delete(id); }
  }
}

function broadcastDeviceList() {
  const allDevices = Array.from(connectedClients.values()).map((c) => ({
    id: c.id, name: c.name, type: c.type, joinedAt: c.joinedAt,
  }));
  for (const client of connectedClients.values()) {
    try {
      client.send({
        type: 'devices_updated',
        devices: allDevices.map((d) => ({ ...d, isSelf: d.id === client.id })),
        count: allDevices.length,
      });
    } catch { connectedClients.delete(client.id); }
  }
}

// ─── SSE endpoint ─────────────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  const clientId = 'peer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const { name: clientName, type: clientType } = parseUserAgent(req.headers['user-agent']);

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  connectedClients.set(clientId, {
    id: clientId, name: clientName, type: clientType,
    joinedAt: new Date().toISOString(), send,
  });

  // Welcome: full item history
  send({ type: 'welcome', clientId, clientName, clientType, items: sharedItems });
  broadcastDeviceList();

  // Keepalive comment every 25 s (prevents proxy/CDN timeouts)
  const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    connectedClients.delete(clientId);
    broadcastDeviceList();
  });
});

// ─── Device name update ───────────────────────────────────────────────────────
app.post('/api/devices', (req, res) => {
  const { type, clientId, name } = req.body;
  if (type === 'set_name' && clientId && name?.trim()) {
    const client = connectedClients.get(clientId);
    if (client) {
      client.name = name.trim();
      broadcastDeviceList();
    }
  }
  res.json({ ok: true });
});

// ─── REST: items ─────────────────────────────────────────────────────────────
app.get('/api/info', async (req, res) => {
  const allIps = getLocalIps();
  const primaryIp = allIps[0].address;
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
      width: 320, margin: 2, color: { dark: '#0B0B0F', light: '#FFFFFF' },
    });
    res.json({ localIp: primaryIp, allIps, port: PORT, connectUrl, qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.get('/api/items', (_req, res) => res.json({ items: sharedItems }));

app.post('/api/items', (req, res) => {
  const { type, content, title, senderName, senderType } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });
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

app.delete('/api/items', (_req, res) => {
  sharedItems.forEach((item) => {
    if (item.type === 'file' && item.filename) {
      const fp = path.join(uploadsDir, item.filename);
      if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch { /* ignore */ }
    }
  });
  sharedItems = [];
  broadcast({ type: 'history_cleared' });
  res.json({ success: true });
});

app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const index = sharedItems.findIndex((i) => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  const item = sharedItems[index];
  if (item.type === 'file' && item.filename) {
    const fp = path.join(uploadsDir, item.filename);
    if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch { /* ignore */ }
  }
  sharedItems.splice(index, 1);
  broadcast({ type: 'item_deleted', itemId: id });
  res.json({ success: true });
});

// ─── File upload ──────────────────────────────────────────────────────────────
app.post('/api/upload', (req, res) => {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Expected multipart/form-data' });
  }

  upload.array('files', 100)(req, res, (err) => {
    if (err) {
      console.error('[Upload Error]:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE')
          return res.status(413).json({ error: 'File too large (max 10 GB)' });
        if (err.code === 'LIMIT_UNEXPECTED_FILE')
          return res.status(400).json({ error: 'Too many files (max 100 per batch)' });
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(500).json({ error: err.message || 'File upload failed' });
    }

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No files were uploaded.' });

    const { senderName = 'Device', senderType = 'mobile' } = req.body;

    const newItems = req.files.map((file) => {
      const mime = (file.mimetype || '').toLowerCase();
      const ext = path.extname(file.originalname || '').toLowerCase();
      let cleanName = file.originalname || 'file';
      try { cleanName = Buffer.from(file.originalname, 'latin1').toString('utf8'); } catch { /* ignore */ }

      const isImage = mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|heic|heif|avif)$/i.test(ext);
      const isVideo = mime.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|wmv|flv|m4v)$/i.test(ext);
      const isAudio = mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(ext);

      const item = {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        type: 'file',
        fileType: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document',
        originalName: cleanName,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        filename: file.filename,
        downloadUrl: `/api/files/${file.filename}/download?name=${encodeURIComponent(cleanName)}`,
        viewUrl: `/api/files/${file.filename}/view`,
        senderName, senderType,
        timestamp: new Date().toISOString(),
      };
      sharedItems.unshift(item);
      return item;
    });

    if (sharedItems.length > 250) sharedItems = sharedItems.slice(0, 250);
    newItems.forEach((item) => broadcast({ type: 'item_received', item }));
    console.log(`[Upload] ${newItems.length} file(s) from ${senderName} (${senderType})`);
    res.status(201).json({ items: newItems });
  });
});

// ─── File view / download ─────────────────────────────────────────────────────
app.get('/api/files/:filename/view', (req, res) => {
  const safe = path.basename(req.params.filename);
  const fp = path.join(uploadsDir, safe);
  if (!fs.existsSync(fp)) return res.status(404).send('File not found');
  res.sendFile(safe, { root: uploadsDir, dotfiles: 'deny',
    headers: { 'Cache-Control': 'public, max-age=86400' } });
});

app.get('/api/files/:filename/download', (req, res) => {
  const safe = path.basename(req.params.filename);
  const fp = path.join(uploadsDir, safe);
  if (!fs.existsSync(fp)) return res.status(404).send('File not found');
  const originalName = req.query.name || safe;
  res.download(safe, originalName, { root: uploadsDir });
});

// ─── Fallthrough → Next.js ───────────────────────────────────────────────────
app.use((req, res) => handle(req, res));

// ─── Start ───────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const allIps = getLocalIps();
  console.log(`\n${'═'.repeat(54)}`);
  console.log(`🚀  slipshare is running`);
  console.log(`    Local:    http://localhost:${PORT}`);
  allIps.forEach((ip) => console.log(`    Network (${ip.name}):  http://${ip.address}:${PORT}`));
  console.log(`${'═'.repeat(54)}\n`);
});
