/**
 * POST /api/devices  — Client-to-server messages over HTTP
 * (replaces WebSocket send() for device name changes)
 *
 * Body: { type: 'set_name', clientId: string, name: string }
 */

import { NextResponse } from 'next/server';
import { state, broadcastDeviceList } from '@/lib/state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, clientId, name } = body;

  if (type === 'set_name' && clientId && name?.trim()) {
    const client = state.clients.get(clientId);
    if (client) {
      client.name = name.trim();
      broadcastDeviceList();
    }
  }

  return NextResponse.json({ ok: true });
}

// Allow preflight for mobile cross-origin requests
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

