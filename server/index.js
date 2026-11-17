import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  QUICK_PHRASES,
  VIRTUES,
} from '../app/js/shared/constants.js';
import { RuleError } from '../app/js/shared/game.js';
import {
  HttpError,
  RateLimiter,
  applySecurityHeaders,
  clearSessionCookie,
  clientIp,
  parseCookies,
  readJson,
  sameOrigin,
  sendError,
  sendJson,
  serveStatic,
  sessionCookie,
} from './http.js';
import { RoomHub, normalizeCode, normalizeName } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '../app');
const VERSION = '1.0.0';

function setCookie(res, cookie) {
  const prior = res.getHeader('Set-Cookie');
  if (!prior) res.setHeader('Set-Cookie', cookie);
  else if (Array.isArray(prior)) res.setHeader('Set-Cookie', [...prior, cookie]);
  else res.setHeader('Set-Cookie', [prior, cookie]);
}

function requireSeat(hub, room, req) {
  const token = parseCookies(req).rufeng_session;
  const seat = hub.seatForToken(room, token);
  if (!seat) {
    throw new HttpError(401, '尚未入席，请先加入这间雅集。', 'NEED_SEAT');
  }
  return { seat, token };
}

function actionResponse(hub, room, seat) {
  const snapshot = hub.snapshot(room, seat.seat);
  return { ok: true, ...snapshot };
}

function isActionRoute(method, tail) {
  if (method !== 'POST') return false;
  if (tail.length === 1) return ['roll', 'move', 'start', 'rematch', 'leave', 'ready', 'seat', 'bot', 'say'].includes(tail[0]);
  return false;
}

export function createApp(options = {}) {
  const hub = new RoomHub(options);
  const limiter = new RateLimiter(options.rateLimit);

  const server = http.createServer(async (req, res) => {
    applySecurityHeaders(res);
    const started = Date.now();
    let url;
    try {
      url = new URL(req.url || '/', 'http://localhost');
    } catch {
      sendError(res, 400, '请求地址有误。', 'BAD_URL');
      return;
    }

    const pathname = url.pathname;
    const isApi = pathname.startsWith('/api/');
    if (isApi) {
      limiter.check(clientIp(req), { create: pathname === '/api/rooms' && req.method === 'POST' });
      if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
        sendError(res, 403, '请求来源不受信任。', 'BAD_ORIGIN');
        return;
      }
    }

    try {
      if (pathname === '/healthz' || pathname === '/api/health') {
        sendJson(res, 200, {
          ok: true,
          service: 'rufeng-wanli',
          version: VERSION,
          rooms: hub.rooms.size,
          uptime: Math.round(process.uptime()),
        });
        return;
      }

      if (pathname === '/api/config' && req.method === 'GET') {
        sendJson(res, 200, {
          ok: true,
          online: true,
          version: VERSION,
          minPlayers: MIN_PLAYERS,
          maxPlayers: MAX_PLAYERS,
          phrases: QUICK_PHRASES,
          virtues: VIRTUES.map((v) => ({
            seat: v.seat,
            name: v.name,
            char: v.char,
            hex: v.hex,
            motto: v.motto,
          })),
        });
        return;
      }

      if (pathname === '/api/rooms' && req.method === 'POST') {
        const body = await readJson(req);
        const name = normalizeName(body.name);
        const { room, seat, token } = hub.createRoom({ name });
        setCookie(res, sessionCookie(token, req));
        hub.publish(room);
        sendJson(res, 200, actionResponse(hub, room, seat));
        return;
      }

      const apiMatch = pathname.match(/^\/api\/rooms\/([^/]+)(?:\/([^/]+))?$/);
      if (apiMatch) {
        const code = normalizeCode(apiMatch[1]);
        const tail = apiMatch[2] ? [apiMatch[2]] : [];
        const room = hub.requireRoom(code);

        if (req.method === 'GET' && tail.length === 0) {
          const { seat } = requireSeat(hub, room, req);
          sendJson(res, 200, actionResponse(hub, room, seat));
          return;
        }

        if (req.method === 'GET' && tail[0] === 'state') {
          const { seat } = requireSeat(hub, room, req);
          sendJson(res, 200, actionResponse(hub, room, seat));
          return;
        }

        if (req.method === 'GET' && tail[0] === 'events') {
          const { seat } = requireSeat(hub, room, req);
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          });
          res.write('retry: 2500\n\n');
          const detach = hub.attach(room, seat, res);
          const heartbeat = setInterval(() => {
            if (res.writableEnded || res.destroyed) return;
            try {
              res.write(`: keep-alive ${Date.now()}\n\n`);
            } catch {
              /* noop */
            }
          }, 15_000);
          heartbeat.unref?.();
          const cleanup = () => {
            clearInterval(heartbeat);
            detach();
          };
          req.on('close', cleanup);
          res.on('error', cleanup);
          return;
        }

        if (req.method === 'POST' && tail[0] === 'join') {
          const body = await readJson(req);
          const token = parseCookies(req).rufeng_session;
          const existing = hub.seatForToken(room, token);
          const name = existing ? existing.name : normalizeName(body.name);
          const result = hub.joinRoom(code, { name, token });
          setCookie(res, sessionCookie(result.token, req));
          hub.publish(result.room);
          sendJson(res, 200, {
            ok: true,
            rejoin: Boolean(result.rejoin),
            ...hub.snapshot(result.room, result.seat.seat),
          });
          return;
        }

        if (isActionRoute(req.method, tail)) {
          const { seat } = requireSeat(hub, room, req);
          const body = req.method === 'POST' ? await readJson(req) : {};
          const action = tail[0];

          if (action === 'ready') {
            hub.setReady(room, seat, body.ready);
            hub.publish(room);
            sendJson(res, 200, actionResponse(hub, room, seat));
            return;
          }

          if (action === 'seat') {
            hub.setSeat(room, seat, Number(body.seat));
            hub.publish(room);
            sendJson(res, 200, actionResponse(hub, room, seat));
            return;
          }

          if (action === 'bot') {
            const targetSeat = Number(body.seat);
            if (body.action === 'remove') hub.removeBot(room, seat, targetSeat);
            else hub.addBot(room, seat, targetSeat);
            hub.publish(room);
            sendJson(res, 200, actionResponse(hub, room, seat));
            return;
          }

          if (action === 'start') {
            hub.startGame(room, seat);
            hub.afterAction(room);
            sendJson(res, 200, actionResponse(hub, room, seat));
            return;
          }

          if (action === 'roll') {
            hub.roll(room, seat);
            hub.afterAction(room);
            sendJson(res, 200, actionResponse(hub, room, seat));
            return;
          }

          if (action === 'move') {
            hub.move(room, seat, body.pieceId);
            hub.afterAction(room);
            sendJson(res, 200, actionResponse(hub, room, seat));
            return;
          }

          if (action === 'say') {
            hub.say(room, seat, body.phraseId);
            sendJson(res, 200, { ok: true });
            return;
          }

          if (action === 'rematch') {
            hub.rematch(room, seat);
            hub.publish(room);
            sendJson(res, 200, actionResponse(hub, room, seat));
            return;
          }

          if (action === 'leave') {
            const result = hub.leave(room, seat);
            setCookie(res, clearSessionCookie(req));
            if (result.closed) {
              sendJson(res, 200, { ok: true, closed: true });
            } else {
              hub.afterAction(room);
              sendJson(res, 200, { ok: true, closed: false });
            }
            return;
          }

          throw new HttpError(404, '未知的棋局操作。', 'UNKNOWN_ACTION');
        }

        throw new HttpError(404, '接口不存在。', 'NOT_FOUND');
      }

      if (isApi) throw new HttpError(404, '接口不存在。', 'NOT_FOUND');
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        throw new HttpError(405, '请求方法不被允许。', 'METHOD_NOT_ALLOWED');
      }
      if (pathname === '/sw.js') res.setHeader('Service-Worker-Allowed', '/');
      await serveStatic(req, res, { root: APP_ROOT, pathname });
    } catch (error) {
      if (res.headersSent) {
        try {
          res.end();
        } catch {
          /* noop */
        }
        return;
      }
      if (error instanceof HttpError) {
        sendError(res, error.status, error.message, error.code);
        return;
      }
      if (error instanceof RuleError) {
        sendError(res, 409, error.message, error.code);
        return;
      }
      console.error('[server]', req.method, pathname, error);
      sendError(res, 500, '服务暂时开了小差，请稍后再试。', 'INTERNAL');
    } finally {
      const elapsed = Date.now() - started;
      if (process.env.NODE_ENV !== 'test' && !isApi && elapsed > 1500) {
        console.warn('[slow]', req.method, pathname, `${elapsed}ms`);
      }
    }
  });

  server.on('clientError', (error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  return { server, hub, limiter };
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const { server, hub, limiter } = createApp({
    botDelay: () => 700 + Math.round(Math.random() * 600),
    autopilotDelay: Number(process.env.AUTOPILOT_DELAY_MS) || 45_000,
  });
  server.listen(port, host, () => {
    const shown = host === '0.0.0.0' ? '127.0.0.1' : host;
    console.log(`儒风万里 · 雅集已开：http://${shown}:${port}`);
    console.log(`健康检查：http://${shown}:${port}/healthz`);
  });
  const shutdown = (signal) => {
    console.log(`\n收到 ${signal}，正在散场…`);
    limiter.close();
    hub.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
