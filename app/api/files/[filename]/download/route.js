/**
 * GET /api/files/[filename]/download
 * Force-download the file with the original filename preserved.
 */

import { existsSync, statSync, createReadStream } from 'fs';
import { join, extname } from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  (process.env.VERCEL ? '/tmp/slipshare-uploads' : 'uploads');

const MIME_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  pdf: 'application/pdf', txt: 'text/plain', zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
  const searchParams = new URL(request.url).searchParams;
  const originalName = searchParams.get('name') || safe;
  const mimeType = getMime(safe);

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream);

  // RFC 5987 UTF-8 encoded filename for non-ASCII names
  const encodedName = encodeURIComponent(originalName).replace(/'/g, '%27');

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

