/**
 * GET  /api/items       — list all shared items
 * POST /api/items       — create text / link item
 * DELETE /api/items     — clear all items (also deletes uploaded files)
 */

import { NextResponse } from 'next/server';
import { state, broadcast } from '@/lib/state';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  (process.env.VERCEL ? '/tmp/slipshare-uploads' : 'uploads');

export async function GET() {
  return NextResponse.json({ items: state.items });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, content, title, senderName, senderType } = body;
  if (!content) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
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

  state.items.unshift(newItem);
  if (state.items.length > 250) state.items.pop();

  broadcast({ type: 'item_received', item: newItem });
  return NextResponse.json({ item: newItem }, { status: 201 });
}

export async function DELETE() {
  // Remove files from disk
  for (const item of state.items) {
    if (item.type === 'file' && item.filename) {
      const fp = join(UPLOADS_DIR, item.filename);
      if (existsSync(fp)) try { unlinkSync(fp); } catch { /* ignore */ }
    }
  }
  state.items = [];
  broadcast({ type: 'history_cleared' });
  return NextResponse.json({ success: true });
}

