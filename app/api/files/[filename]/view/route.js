/**
 * GET /api/files/[filename]/view
 * Stream the file inline (for image preview, audio/video playback).
 * Supports Range requests so audio/video seeking works.
 */

import { existsSync, statSync, createReadStream } from 'fs';
import { join, extname } from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  (process.env.VERCEL ? '/tmp/slipshare-uploads' : 'uploads');

/** Best-effort MIME type from extension */
const MIME_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
  heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
  pdf: 'application/pdf', txt: 'text/plain', json: 'application/json',
  zip: 'application/zip',
};

function getMime(filename) {
  const ext = extname(filename).replace('.', '').toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

export async function GET(request, { params }) {
  const { filename } = await params;
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = join(UPLOADS_DIR, safe);

  if (!existsSync(filePath)) {
    return new Response('File not found', { status: 404 });
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const mimeType = getMime(safe);
  const rangeHeader = request.headers.get('range');

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream);

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

