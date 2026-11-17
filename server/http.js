import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzip = promisify(zlib.gzip);

export class HttpError extends Error {
  constructor(status, message, code = 'HTTP') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
  ].join('; '),
};

export function applySecurityHeaders(res) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
}

export function sendJson(res, status, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

export function sendError(res, status, message, code = 'ERROR') {
  sendJson(res, status, { ok: false, error: { code, message } });
}

export function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, '请求内容过大。', 'BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        const parsed = JSON.parse(text);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(new HttpError(400, '请求格式有误。', 'BAD_JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const result = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

export function sessionCookie(token, req) {
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = req.socket.encrypted || forwarded === 'https';
  const parts = [
    `rufeng_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=14400',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = req.socket.encrypted || forwarded === 'https';
  const parts = ['rufeng_session=', 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // 非浏览器客户端（测试、curl）没有 Origin，依靠 SameSite Cookie。
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket.remoteAddress || 'unknown';
}

export class RateLimiter {
  constructor({ windowMs = 60_000, max = 120, maxCreates = 10 } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.maxCreates = maxCreates;
    this.buckets = new Map();
    this.cleanup = setInterval(() => this.sweep(), windowMs * 2);
    this.cleanup.unref?.();
  }

  check(ip, { create = false } = {}) {
    const now = Date.now();
    let bucket = this.buckets.get(ip);
    if (!bucket || now > bucket.reset) {
      bucket = { count: 0, creates: 0, reset: now + this.windowMs };
      this.buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (create) bucket.creates += 1;
    if (bucket.count > this.max) {
      throw new HttpError(429, '请求过于频繁，请稍后再试。', 'RATE_LIMIT');
    }
    if (create && bucket.creates > this.maxCreates) {
      throw new HttpError(429, '今日雅集开设过多，请稍后再试。', 'CREATE_LIMIT');
    }
  }

  sweep() {
    const now = Date.now();
    for (const [ip, bucket] of this.buckets) {
      if (now > bucket.reset) this.buckets.delete(ip);
    }
  }

  close() {
    clearInterval(this.cleanup);
  }
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

const CACHE_LONG = 'public, max-age=31536000, immutable';
const CACHE_SHORT = 'no-cache';

export async function serveStatic(req, res, { root, pathname }) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, '路径格式有误。', 'BAD_PATH');
  }
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel.includes('\0')) throw new HttpError(400, '路径格式有误。', 'BAD_PATH');
  const target = path.resolve(root, '.' + rel);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new HttpError(403, '禁止访问。', 'FORBIDDEN');
  }

  let info;
  try {
    info = await stat(target);
  } catch {
    throw new HttpError(404, '页面不存在。', 'NOT_FOUND');
  }
  if (!info.isFile()) throw new HttpError(404, '页面不存在。', 'NOT_FOUND');

  const ext = path.extname(target).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': ext === '.html' ? CACHE_SHORT : CACHE_SHORT });
    res.end();
    return;
  }

  const cacheControl =
    ext === '.woff2' || ext === '.woff' || ext === '.ttf' || ext === '.png' || ext === '.svg'
      ? CACHE_LONG
      : CACHE_SHORT;

  const data = await readFile(target);
  const headers = {
    'Content-Type': mime,
    'Content-Length': data.length,
    'Cache-Control': cacheControl,
    ETag: etag,
    'Last-Modified': info.mtime.toUTCString(),
  };

  const accept = String(req.headers['accept-encoding'] || '');
  const compressible = /^(text\/|application\/(json|manifest\+json|javascript))/.test(mime);
  if (compressible && data.length > 1024 && /\bgzip\b/.test(accept)) {
    const zipped = await gzip(data);
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = zipped.length;
    headers.Vary = 'Accept-Encoding';
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : zipped);
    return;
  }

  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : data);
}
