import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  MIN_PLAYERS,
  QUICK_PHRASES,
  VIRTUE_BY_SEAT,
  MAX_PLAYERS,
} from '../app/js/shared/constants.js';
import {
  applyMove,
  createGame,
  gameSnapshot,
  passTurn,
  rollDice,
} from '../app/js/shared/game.js';
import { chooseAiMove, botName } from '../app/js/shared/ai.js';
import { HttpError, hashToken } from './http.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

const BLOCKED_WORDS = [
  '傻逼',
  '操你',
  '妈的',
  '色情',
  '赌博',
  '博彩',
  '代练',
  'fuck',
  'shit',
  'bitch',
  'porn',
  'casino',
];

export function normalizeCode(raw) {
  const code = String(raw || '').toUpperCase();
  if (!ROOM_CODE_RE.test(code)) {
    throw new HttpError(400, '房间号应为 4 位字母或数字。', 'BAD_ROOM_CODE');
  }
  return code;
}

export function normalizeName(raw) {
  let name = String(raw ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  name = name.slice(0, 12);
  const codePoints = [...name];
  if (codePoints.length < 2 || codePoints.length > 12) {
    throw new HttpError(400, '称呼请填 2–12 个字。', 'BAD_NAME');
  }
  if (/[<>/\\]|https?:|www\./i.test(name)) {
    throw new HttpError(400, '称呼中不能包含链接或特殊符号。', 'BAD_NAME');
  }
  if (!/^[\p{L}\p{N}·_\- ]+$/u.test(name)) {
    throw new HttpError(400, '称呼仅支持文字、数字、空格与 · _ -。', 'BAD_NAME');
  }
  if (/(.)\1{5,}/u.test(name)) {
    throw new HttpError(400, '称呼中重复字符过多。', 'BAD_NAME');
  }
  const lower = name.toLowerCase();
  if (BLOCKED_WORDS.some((word) => lower.includes(word))) {
    throw new HttpError(400, '这个称呼不太合适，请换一个。', 'BAD_NAME');
  }
  return name;
}

function randomCode() {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function newToken() {
  return randomBytes(24).toString('base64url');
}

function tokenMatches(storedHash, token) {
  if (!storedHash || !token) return false;
  const incoming = Buffer.from(hashToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (incoming.length !== stored.length) return false;
  return timingSafeEqual(incoming, stored);
}

function sseSend(res, event, payload) {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

export class RoomHub {
  constructor({
    rng = () => randomInt(0, 1_000_000) / 1_000_000,
    botDelay = () => 700 + Math.round(Math.random() * 500),
    autoPassDelay = 1300,
    autopilotDelay = 45_000,
    roomTtl = 3 * 60 * 60 * 1000,
    maxRooms = 500,
  } = {}) {
    this.rng = rng;
    this.botDelay = botDelay;
    this.autoPassDelay = autoPassDelay;
    this.autopilotDelay = autopilotDelay;
    this.roomTtl = roomTtl;
    this.maxRooms = maxRooms;
    this.rooms = new Map();
    this.cleanup = setInterval(() => this.sweep(), 10 * 60 * 1000);
    this.cleanup.unref?.();
  }

  close() {
    clearInterval(this.cleanup);
    for (const room of this.rooms.values()) this.clearTimer(room);
  }

  codeExists(code) {
    return this.rooms.has(code);
  }

  createRoom({ name }) {
    if (this.rooms.size >= this.maxRooms) {
      throw new HttpError(503, '雅集席位已满，请稍后再试。', 'ROOMS_FULL');
    }
    let code = randomCode();
    for (let i = 0; i < 50 && this.rooms.has(code); i += 1) code = randomCode();
    if (this.rooms.has(code)) {
      throw new HttpError(503, '暂时无法开出新房，请重试。', 'CODE_EXHAUSTED');
    }
    const token = newToken();
    const room = {
      code,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'lobby',
      hostSeat: 0,
      seats: [null, null, null, null],
      game: null,
      version: 0,
      timer: null,
      autopilotTimers: new Map(),
      connections: new Set(),
    };
    room.seats[0] = this.makeSeat(0, name, token, false);
    room.seats[0].ready = false;
    room.seats[0].connected = true;
    this.rooms.set(code, room);
    return { room, seat: room.seats[0], token };
  }

  makeSeat(seat, name, token, isBot) {
    return {
      seat,
      name,
      isBot,
      ready: isBot,
      tokenHash: token ? hashToken(token) : null,
      connected: Boolean(isBot),
      connections: 0,
      autopilot: false,
      left: false,
      lastPhraseAt: 0,
      disconnectedAt: null,
    };
  }

  requireRoom(code) {
    const normalized = normalizeCode(code);
    const room = this.rooms.get(normalized);
    if (!room) throw new HttpError(404, '未找到这间雅集，可能已散场。', 'ROOM_NOT_FOUND');
    return room;
  }

  seatForToken(room, token) {
    if (!token) return null;
    for (const seat of room.seats) {
      if (seat && !seat.isBot && tokenMatches(seat.tokenHash, token)) return seat;
    }
    return null;
  }

  joinRoom(code, { name, token }) {
    const room = this.requireRoom(code);
    const existing = this.seatForToken(room, token);
    if (existing) {
      existing.connected = true;
      existing.left = false;
      existing.autopilot = false;
      this.clearAutopilotTimer(room, existing.seat);
      return { room, seat: existing, token, rejoin: true };
    }
    if (room.status !== 'lobby') {
      throw new HttpError(409, '这间雅集已经开棋，暂时不能入席。', 'ROOM_STARTED');
    }
    if (room.seats.some((s) => s && s.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, '这个称呼已被使用，请换一个。', 'NAME_TAKEN');
    }
    const slot = room.seats.findIndex((s) => s === null);
    if (slot === -1) throw new HttpError(409, '雅集已满，请另开一席。', 'ROOM_FULL');
    const freshToken = newToken();
    const seat = this.makeSeat(slot, name, freshToken, false);
    seat.connected = true;
    room.seats[slot] = seat;
    room.lastActivity = Date.now();
    return { room, seat, token: freshToken, rejoin: false };
  }

  setSeat(room, seat, targetSeat) {
    if (room.status !== 'lobby') throw new HttpError(409, '开棋后不能换席。', 'ROOM_STARTED');
    if (!Number.isInteger(targetSeat) || targetSeat < 0 || targetSeat >= MAX_PLAYERS) {
      throw new HttpError(400, '席位无效。', 'BAD_SEAT');
    }
    if (targetSeat === seat.seat) return seat;
    if (room.seats[targetSeat]) throw new HttpError(409, '这个席位已经有人。', 'SEAT_TAKEN');
    const wasHost = room.hostSeat === seat.seat;
    room.seats[seat.seat] = null;
    seat.seat = targetSeat;
    seat.ready = false;
    room.seats[targetSeat] = seat;
    if (wasHost) room.hostSeat = targetSeat;
    room.lastActivity = Date.now();
    return seat;
  }

  addBot(room, seat, targetSeat) {
    if (room.hostSeat !== seat.seat) throw new HttpError(403, '只有席主可以添置机巧。', 'NOT_HOST');
    if (room.status !== 'lobby') throw new HttpError(409, '开棋后不能再添置机巧。', 'ROOM_STARTED');
    if (!Number.isInteger(targetSeat) || targetSeat < 0 || targetSeat >= MAX_PLAYERS) {
      throw new HttpError(400, '席位无效。', 'BAD_SEAT');
    }
    if (room.seats[targetSeat]) throw new HttpError(409, '这个席位已经有人。', 'SEAT_TAKEN');
    const bot = this.makeSeat(targetSeat, botName(targetSeat, room.code.charCodeAt(0)), null, true);
    bot.ready = true;
    room.seats[targetSeat] = bot;
    room.lastActivity = Date.now();
    return bot;
  }

  removeBot(room, seat, targetSeat) {
    if (room.hostSeat !== seat.seat) throw new HttpError(403, '只有席主可以移除机巧。', 'NOT_HOST');
    if (room.status !== 'lobby') throw new HttpError(409, '开棋后不能移除机巧。', 'ROOM_STARTED');
    const target = room.seats[targetSeat];
    if (!target || !target.isBot) throw new HttpError(409, '这个席位不是机巧。', 'NOT_BOT');
    room.seats[targetSeat] = null;
    room.lastActivity = Date.now();
  }

  setReady(room, seat, ready) {
    if (room.status !== 'lobby') throw new HttpError(409, '棋局已经开始。', 'ROOM_STARTED');
    if (seat.isBot) return seat;
    seat.ready = Boolean(ready);
    room.lastActivity = Date.now();
    return seat;
  }

  canStart(room) {
    if (room.status !== 'lobby') return false;
    const filled = room.seats.filter(Boolean);
    if (filled.length < MIN_PLAYERS) return false;
    if (!filled.some((s) => !s.isBot)) return false;
    return filled.every((s) => s.isBot || s.ready);
  }

  startGame(room, seat) {
    if (room.hostSeat !== seat.seat) throw new HttpError(403, '只有席主可以开棋。', 'NOT_HOST');
    if (room.status !== 'lobby') throw new HttpError(409, '棋局已经开始。', 'ROOM_STARTED');
    if (!this.canStart(room)) {
      throw new HttpError(409, '请等各位入席并备好，再行开棋。', 'NOT_READY');
    }
    const configs = room.seats
      .filter(Boolean)
      .map((s) => ({ seat: s.seat, name: s.name, isBot: s.isBot }));
    room.game = createGame(configs, { rng: this.rng });
    room.status = 'playing';
    for (const s of room.seats) if (s) s.ready = false;
    room.lastActivity = Date.now();
    return room;
  }

  requireTurn(room, seat) {
    if (room.status !== 'playing' || !room.game) {
      throw new HttpError(409, '棋局尚未开始。', 'NOT_PLAYING');
    }
    if (room.game.phase === 'ended') throw new HttpError(409, '棋局已经结束。', 'GAME_OVER');
    if (room.game.currentSeat !== seat.seat) {
      throw new HttpError(409, '还未轮到你行棋。', 'NOT_YOUR_TURN');
    }
  }

  roll(room, seat) {
    this.requireTurn(room, seat);
    rollDice(room.game, this.rng);
    return room;
  }

  move(room, seat, pieceId) {
    this.requireTurn(room, seat);
    if (!pieceId || typeof pieceId !== 'string') {
      throw new HttpError(400, '请选择一枚纸鸢。', 'BAD_PIECE');
    }
    applyMove(room.game, pieceId, this.rng);
    return room;
  }

  say(room, seat, phraseId) {
    const phrase = QUICK_PHRASES.find((p) => p.id === phraseId);
    if (!phrase) throw new HttpError(400, '短句无效。', 'BAD_PHRASE');
    const now = Date.now();
    if (now - (seat.lastPhraseAt || 0) < 4000) {
      throw new HttpError(429, '稍候再发下一句。', 'PHRASE_LIMIT');
    }
    seat.lastPhraseAt = now;
    this.broadcastEvent(room, 'phrase', {
      type: 'phrase',
      seat: seat.seat,
      name: seat.name,
      text: phrase.text,
      id: phrase.id,
      at: now,
    });
    return phrase;
  }

  rematch(room, seat) {
    if (room.hostSeat !== seat.seat) throw new HttpError(403, '只有席主可以筹备下一局。', 'NOT_HOST');
    if (room.status !== 'ended') throw new HttpError(409, '对局尚未结束。', 'NOT_ENDED');
    room.status = 'lobby';
    room.game = null;
    const currentHost = room.seats[room.hostSeat];
    if (!currentHost || currentHost.isBot || currentHost.left) {
      room.hostSeat = room.seats.find((s) => s && !s.isBot && !s.left)?.seat ?? null;
    }
    for (const s of room.seats) {
      if (!s) continue;
      if (s.left) {
        room.seats[s.seat] = null;
        continue;
      }
      s.ready = s.isBot;
      s.autopilot = false;
    }
    room.lastActivity = Date.now();
    this.clearTimer(room);
    return room;
  }

  leave(room, seat) {
    this.clearAutopilotTimer(room, seat.seat);
    if (room.status === 'lobby') {
      room.seats[seat.seat] = null;
      seat.left = true;
      if (room.hostSeat === seat.seat) this.promoteHost(room);
      if (!room.seats.some((s) => s && !s.isBot)) {
        this.destroyRoom(room, '席主离开，雅集散场。');
        return { closed: true };
      }
    } else {
      seat.left = true;
      seat.connected = false;
      seat.autopilot = true;
      this.promoteHost(room);
      if (!room.seats.some((s) => s && !s.isBot && !s.left)) {
        this.destroyRoom(room, '众人离席，雅集散场。');
        return { closed: true };
      }
    }
    room.lastActivity = Date.now();
    return { closed: false };
  }

  attach(room, seat, res) {
    const connection = { res, seat: seat.seat };
    room.connections.add(connection);
    seat.connections += 1;
    seat.connected = true;
    seat.left = false;
    seat.autopilot = false;
    seat.disconnectedAt = null;
    this.clearAutopilotTimer(room, seat.seat);
    this.publish(room);
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      room.connections.delete(connection);
      seat.connections = Math.max(0, seat.connections - 1);
      if (seat.connections === 0) {
        seat.connected = false;
        seat.disconnectedAt = Date.now();
        this.scheduleAutopilot(room, seat);
        this.publish(room);
      }
    };
  }

  promoteHost(room) {
    const current = room.seats[room.hostSeat];
    if (current && current.connected && !current.left) return false;
    const candidates = room.seats.filter(
      (s) => s && !s.isBot && !s.left && s.seat !== room.hostSeat,
    );
    const next = candidates.find((s) => s.connected) || candidates[0];
    if (!next) return false;
    room.hostSeat = next.seat;
    return true;
  }

  scheduleAutopilot(room, seat) {
    if (seat.isBot || seat.left) return;
    const isHost = room.hostSeat === seat.seat;
    this.clearAutopilotTimer(room, seat.seat);

    // 大厅/结算阶段没有回合可托管，但席主掉线会让其他人无法开棋或再开一局。
    if (room.status === 'lobby' || room.status === 'ended') {
      if (!isHost) return;
      const timer = setTimeout(() => {
        room.autopilotTimers.delete(seat.seat);
        if (!this.rooms.has(room.code)) return;
        if (seat.connections > 0) return;
        if (this.promoteHost(room)) this.publish(room);
      }, Math.min(this.autopilotDelay, 15_000));
      timer.unref?.();
      room.autopilotTimers.set(seat.seat, timer);
      return;
    }

    if (room.status !== 'playing') return;
    const timer = setTimeout(() => {
      room.autopilotTimers.delete(seat.seat);
      if (!this.rooms.has(room.code) || room.status !== 'playing') return;
      if (seat.connections > 0) return;
      if (room.hostSeat === seat.seat) this.promoteHost(room);
      seat.autopilot = true;
      seat.connected = false;
      this.publish(room);
      this.schedule(room);
    }, this.autopilotDelay);
    timer.unref?.();
    room.autopilotTimers.set(seat.seat, timer);
  }

  clearAutopilotTimer(room, seat) {
    const timer = room.autopilotTimers.get(seat);
    if (timer) clearTimeout(timer);
    room.autopilotTimers.delete(seat);
  }

  clearTimer(room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
  }

  afterAction(room, { skipSchedule = false } = {}) {
    if (room.game && room.game.phase === 'ended') {
      room.status = 'ended';
      this.clearTimer(room);
    }
    this.publish(room);
    if (!skipSchedule) this.schedule(room);
  }

  schedule(room) {
    this.clearTimer(room);
    if (room.status !== 'playing' || !room.game || room.game.phase !== 'playing') return;
    const game = room.game;
    const seatInfo = room.seats[game.currentSeat];
    if (!seatInfo) return;
    const auto = seatInfo.isBot || seatInfo.autopilot || seatInfo.left;

    if (game.dice === null) {
      if (!auto) return;
      const timer = setTimeout(() => {
        room.timer = null;
        if (!this.rooms.has(room.code) || room.status !== 'playing') return;
        if (room.game.phase !== 'playing') return;
        if (room.game.currentSeat !== seatInfo.seat) return;
        try {
          rollDice(room.game, this.rng);
          this.afterAction(room);
        } catch (error) {
          console.error('[rooms] auto roll failed:', error.message);
          this.schedule(room);
        }
      }, Math.max(10, this.botDelay()));
      timer.unref?.();
      room.timer = timer;
      return;
    }

    if (game.legalMoves.length === 0) {
      const timer = setTimeout(() => {
        room.timer = null;
        if (!this.rooms.has(room.code) || room.status !== 'playing') return;
        try {
          passTurn(room.game);
          this.afterAction(room);
        } catch (error) {
          console.error('[rooms] auto pass failed:', error.message);
          this.schedule(room);
        }
      }, Math.max(10, this.autoPassDelay));
      timer.unref?.();
      room.timer = timer;
      return;
    }

    if (auto) {
      const timer = setTimeout(() => {
        room.timer = null;
        if (!this.rooms.has(room.code) || room.status !== 'playing') return;
        if (room.game.phase !== 'playing') return;
        if (room.game.currentSeat !== seatInfo.seat) return;
        try {
          const move = chooseAiMove(room.game, room.game.legalMoves);
          if (move) applyMove(room.game, move.pieceId, this.rng);
          this.afterAction(room);
        } catch (error) {
          console.error('[rooms] auto move failed:', error.message);
          this.schedule(room);
        }
      }, Math.max(10, this.botDelay()));
      timer.unref?.();
      room.timer = timer;
    }
  }

  publicRoom(room, viewerSeat = null) {
    const filled = room.seats.filter(Boolean);
    return {
      code: room.code,
      status: room.status,
      hostSeat: room.hostSeat,
      version: room.version,
      youSeat: viewerSeat,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      canStart: this.canStart(room),
      seats: room.seats.map((s) =>
        s
          ? {
              seat: s.seat,
              name: s.name,
              isBot: s.isBot,
              ready: s.ready,
              connected: s.connected,
              autopilot: s.autopilot,
              left: s.left,
              host: room.hostSeat === s.seat,
              virtue: VIRTUE_BY_SEAT[s.seat]
                ? {
                    char: VIRTUE_BY_SEAT[s.seat].char,
                    name: VIRTUE_BY_SEAT[s.seat].name,
                    hex: VIRTUE_BY_SEAT[s.seat].hex,
                  }
                : null,
            }
          : null,
      ),
      filledCount: filled.length,
    };
  }

  snapshot(room, viewerSeat) {
    return {
      type: 'snapshot',
      version: room.version,
      room: this.publicRoom(room, viewerSeat),
      game: room.game ? gameSnapshot(room.game) : null,
    };
  }

  publish(room) {
    if (!this.rooms.has(room.code)) return;
    room.version += 1;
    room.lastActivity = Date.now();
    for (const connection of [...room.connections]) {
      const payload = this.snapshot(room, connection.seat);
      if (!sseSend(connection.res, 'snapshot', payload)) {
        room.connections.delete(connection);
        const seat = room.seats.find((s) => s && s.seat === connection.seat);
        if (seat) {
          seat.connections = Math.max(0, seat.connections - 1);
          seat.connected = false;
          this.scheduleAutopilot(room, seat);
        }
      }
    }
  }

  broadcastEvent(room, event, payload) {
    for (const connection of [...room.connections]) {
      if (!sseSend(connection.res, event, payload)) room.connections.delete(connection);
    }
  }

  destroyRoom(room, reason = '雅集散场。') {
    this.clearTimer(room);
    for (const seat of room.seats) if (seat) this.clearAutopilotTimer(room, seat.seat);
    this.broadcastEvent(room, 'closed', { type: 'closed', reason });
    for (const connection of room.connections) {
      try {
        connection.res.end();
      } catch {
        /* noop */
      }
    }
    room.connections.clear();
    this.rooms.delete(room.code);
  }

  sweep() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (now - room.lastActivity > this.roomTtl) {
        this.destroyRoom(room, '雅集久未有人，已自行散场。');
      }
    }
  }
}

export { ROOM_CODE_RE, sseSend };
