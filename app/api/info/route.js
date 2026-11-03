/**
 * GET /api/info  — Return LAN IP, port, connect URL, and QR code data URL.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import qrcode from 'qrcode';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  const priority = [/wlan/i, /wl/i, /wifi/i, /en/i, /eth/i];
  const ignore = [/docker/i, /vbox/i, /vmnet/i, /br-/i, /cni/i, /tun/i, /tap/i, /lo/i];

  for (const [name, ifaces] of Object.entries(interfaces)) {
    if (ignore.some((p) => p.test(name))) continue;
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
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

export async function GET(request) {
  const hdrs = await headers();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const allIps = getLocalIps();
  const primaryIp = allIps[0].address;

  // Detect tunnel / proxy URL (ngrok, Vercel, Cloudflare Tunnel, etc.)
  const forwardedHost = hdrs.get('x-forwarded-host') || hdrs.get('host') || '';
  let connectUrl;
  if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
    const proto = hdrs.get('x-forwarded-proto') || 'https';
    connectUrl = `${proto}://${forwardedHost}`;
  } else {
    connectUrl = `http://${primaryIp}:${PORT}`;
  }

  try {
    const qrDataUrl = await qrcode.toDataURL(connectUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#0B0B0F', light: '#FFFFFF' },
    });

    return NextResponse.json({ localIp: primaryIp, allIps, port: PORT, connectUrl, qrDataUrl });
  } catch (err) {
    console.error('QR generation failed:', err);
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}

