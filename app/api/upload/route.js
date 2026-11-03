/**
 * POST /api/upload  — receive one or more files via multipart/form-data.
 *
 * File size limits:
 *   Vercel Hobby  — 4.5 MB total body (hard platform limit)
 *   Vercel Pro    — up to 100 MB (set VERCEL_BODY_SIZE_LIMIT in project settings)
 *   Self-hosted   — unlimited (governed by your server memory)
 *
 * Files are written to UPLOADS_DIR (/tmp/slipshare-uploads on Vercel,
 * ./uploads when running locally via next dev, or set UPLOADS_DIR env var).
 */

import { NextResponse } from 'next/server';
import { state, broadcast } from '@/lib/state';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  (process.env.VERCEL ? '/tmp/slipshare-uploads' : 'uploads');

/** Inline MIME detection by extension — no extra package needed */
function detectType(ext, mime = '') {
  const m = mime.toLowerCase();
  const e = ext.toLowerCase();
  if (m.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|heic|heif|avif)$/.test(e))
    return 'image';
  if (m.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|wmv|flv|m4v)$/.test(e))
    return 'video';
  if (m.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/.test(e))
    return 'audio';
  return 'document';
}

export async function POST(request) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Expected multipart/form-data' },
      { status: 400 }
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse upload: ${err.message}` },
      { status: 400 }
    );
  }

  const rawFiles = formData.getAll('files');
  const files = rawFiles.filter((f) => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return NextResponse.json(
      { error: 'No files were uploaded. Please select a file.' },
      { status: 400 }
    );
  }

  const senderName = formData.get('senderName') || 'Device';
  const senderType = formData.get('senderType') || 'mobile';

  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const newItems = [];
  for (const file of files) {
    try {
      const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.name) || '';
      const filename = suffix + ext;
      const filePath = join(UPLOADS_DIR, filename);

      const buffer = Buffer.from(await file.arrayBuffer());
      writeFileSync(filePath, buffer);

      const fileType = detectType(ext, file.type);
      const item = {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        type: 'file',
        fileType,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        filename,
        downloadUrl: `/api/files/${filename}/download?name=${encodeURIComponent(file.name)}`,
        viewUrl: `/api/files/${filename}/view`,
        senderName,
        senderType,
        timestamp: new Date().toISOString(),
      };

      state.items.unshift(item);
      newItems.push(item);
    } catch (err) {
      console.error('[Upload file error]:', err);
    }
  }

  if (state.items.length > 250) state.items = state.items.slice(0, 250);

  newItems.forEach((item) => broadcast({ type: 'item_received', item }));

  console.log(`[Upload] ${newItems.length} file(s) from ${senderName} (${senderType})`);
  return NextResponse.json({ items: newItems }, { status: 201 });
}

