# slipshare • Direct Local File & Text Transfer

**slipshare** is an instant peer-to-peer style local file, text, and link sharing application built with **Next.js** and styled after **Blip** (`blip.net`).

---

## ✨ Features

- **Blip Aesthetic & Palette**:
  - Wordmark: `slipshare` with the animated Brand Sky Blue dot (`#13B5EA`)
  - Accent Colors: Iris Violet (`#7C3AED`), Deep Ink (`#0B0B0F`), Clean Light & Obsidian Dark Mode
- **Zero Cloud Intermediaries**:
  - Direct local transfer at maximum Wi-Fi / gigabit LAN speed
  - Unlimited file sizes (gigabytes of 4K video, raw assets, zips, folders)
  - No compression or quality degradation
- **Live Device Radar**:
  - Real-time connected device detection (iPhone, Android, MacBook, Windows PC, Linux Laptop)
  - Live pulse animation showing active peers
- **Mobile Pairing via QR Code**:
  - Scan the pairing QR code from any phone on the Wi-Fi network to connect instantly
  - Direct URL access with one-click copy
- **Instant Composer**:
  - 📁 **Files & Media**: Drag-and-drop or file browser with progress tracking
  - 📸 **Camera**: One-tap camera capture and upload from mobile devices
  - 📝 **Quick Note**: Instant note / clipboard snippet broadcast (`Ctrl+Enter` shortcut)
  - 🔗 **Share Link**: Fast URL sharing with one-click open
- **Real-time Synchronization**:
  - Full WebSocket integration for immediate updates across all connected devices
  - Gentle Web Audio API sound feedback (synthesized chime & tap tones)
- **Universal Local Proxy & LAN Access**:
  - Runs on `0.0.0.0:3000` with wildcard proxy (`/*`) and permissive CORS headers
  - Accessible from any smartphone, tablet, or PC on the same Wi-Fi network

---

## 🚀 Running Locally

```bash
# Start slipshare (Next.js + WebSocket server on 0.0.0.0:3000)
npm run dev

# Or with Node directly:
node server.js
```

Then visit:
- On your laptop/desktop: `http://localhost:3000`
- On any mobile device or peer on Wi-Fi: `http://<your-local-ip>:3000` (or scan the QR Code in the header!)
