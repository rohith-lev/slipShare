/**
 * Global in-memory state singleton.
 *
 * Works reliably on single-instance deployments:
 *   - Local dev (node server.js or next dev)
 *   - Vercel Hobby (single warm function instance per region)
 *   - Railway / Render / Fly.io
 *
 * For multi-replica production, swap `clients` and `items` for
 * an Upstash Redis / Vercel KV store and use pub/sub for SSE fan-out.
 */

/** @typedef {{ id: string; name: string; type: 'mobile'|'desktop'; joinedAt: string; send: (data: object) => void }} SseClient */

// Persist across hot-reloads in Next.js dev mode
if (!globalThis._slipshare) {
  globalThis._slipshare = {
    /** @type {any[]} */
    items: [],
    /** @type {Map<string, SseClient>} */
    clients: new Map(),
  };
}

export const state = /** @type {{ items: any[]; clients: Map<string, SseClient> }} */ (
  globalThis._slipshare
);

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Send an SSE event to one client; silently removes broken connections.
 * @param {SseClient} client
 * @param {object} data
 */
function sendTo(client, data) {
  try {
    client.send(data);
  } catch {
    state.clients.delete(client.id);
  }
}

/**
 * Broadcast an event to all clients, optionally excluding one.
 * @param {object} data
 * @param {string|null} [excludeId]
 */
export function broadcast(data, excludeId = null) {
  for (const client of state.clients.values()) {
    if (client.id !== excludeId) sendTo(client, data);
  }
}

/**
 * Send each client a personalized `devices_updated` event where their own
 * entry has `isSelf: true`.
 */
export function broadcastDeviceList() {
  const allDevices = Array.from(state.clients.values()).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    joinedAt: c.joinedAt,
  }));

  for (const client of state.clients.values()) {
    sendTo(client, {
      type: 'devices_updated',
      devices: allDevices.map((d) => ({ ...d, isSelf: d.id === client.id })),
      count: allDevices.length,
    });
  }
}

/**
 * Detect device type + assign a human-readable name from a User-Agent string.
 * @param {string} ua
 * @returns {{ name: string; type: 'mobile'|'desktop' }}
 */
export function parseUserAgent(ua = '') {
  const isMobile =
    /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua);

  let name = isMobile ? 'Mobile Phone' : 'Laptop';
  if (/iphone/i.test(ua)) name = 'iPhone';
  else if (/ipad/i.test(ua)) name = 'iPad';
  else if (/android/i.test(ua)) name = 'Android Phone';
  else if (/macintosh/i.test(ua)) name = 'MacBook';
  else if (/windows/i.test(ua)) name = 'Windows PC';
  else if (/linux/i.test(ua)) name = 'Linux Laptop';

  return { name, type: isMobile ? 'mobile' : 'desktop' };
}

