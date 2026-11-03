/**
 * GET /api/events  — Server-Sent Events stream.
 *
 * Each browser that opens this endpoint gets a persistent SSE connection.
 * The server pushes: welcome, devices_updated, item_received, item_deleted,
 * history_cleared, and a keepalive comment every 25 s.
 *
 * On Vercel Hobby the function timeout is 10 s by default.
 * Set maxDuration = 300 (requires Pro) for long-lived connections.
 * For Hobby, clients auto-reconnect via EventSource's built-in retry.
 */

import { state, broadcastDeviceList, parseUserAgent } from '@/lib/state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Uncomment on Vercel Pro / Enterprise to allow long-lived SSE:
// export const maxDuration = 300;

export async function GET(request) {
  const ua = request.headers.get('user-agent') || '';
  const { name: clientName, type: clientType } = parseUserAgent(ua);
  const clientId =
    'peer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  const encoder = new TextEncoder();

  /** Helper: encode one SSE event frame */
  const frame = (data) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  /** Keepalive comment frame (doesn't trigger onmessage) */
  const keepalive = () => encoder.encode(': keepalive\n\n');

  let controller;
  let keepaliveTimer;

  const stream = new ReadableStream({
    start(c) {
      controller = c;

      /** Send a JSON event to this specific client */
      const send = (data) => {
        try {
          c.enqueue(frame(data));
        } catch {
          // stream closed — clean up in cancel()
        }
      };

      // Register this client in shared state
      state.clients.set(clientId, {
        id: clientId,
        name: clientName,
        type: clientType,
        joinedAt: new Date().toISOString(),
        send,
      });

      // Welcome: send full item history so the page loads instantly
      send({
        type: 'welcome',
        clientId,
        clientName,
        clientType,
        items: state.items,
      });

      // Notify everyone (including this new client) of the updated device list
      broadcastDeviceList();

      // Send a keepalive comment every 25 s to prevent proxy/CDN timeouts
      keepaliveTimer = setInterval(() => {
        try {
          c.enqueue(keepalive());
        } catch {
          clearInterval(keepaliveTimer);
        }
      }, 25_000);
    },

    cancel() {
      clearInterval(keepaliveTimer);
      state.clients.delete(clientId);
      broadcastDeviceList();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',   // disable Nginx response buffering
      'Access-Control-Allow-Origin': '*',
    },
  });
}

