/**
 * DELETE /api/items/[id]  — remove a single item and its file (if any)
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

export async function DELETE(request, { params }) {
  const { id } = await params;
  const index = state.items.findIndex((i) => i.id === id);
  if (index === -1) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const item = state.items[index];
  if (item.type === 'file' && item.filename) {
    const fp = join(UPLOADS_DIR, item.filename);
    if (existsSync(fp)) try { unlinkSync(fp); } catch { /* ignore */ }
  }

  state.items.splice(index, 1);
  broadcast({ type: 'item_deleted', itemId: id });
  return NextResponse.json({ success: true });
}

