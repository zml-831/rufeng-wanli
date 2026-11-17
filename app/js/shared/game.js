/**
 * 「儒风万里」规则引擎
 *
 * 这是一个不依赖 DOM / 网络 / 时钟的纯规则模块：
 * - Node 服务端用它做权威裁决；
 * - 浏览器本机模式、AI 模式直接调用同一套规则。
 *
 * 核心坐标：
 *   外圈 52 格，每席从启程台出发，行 50 格到归门，再入 5 格归途，
 *   最后一步踏入大成殿（总进度 56）。归门与启程台为安全格。
 */

import {
  FINISH_PROGRESS,
  GATE_PROGRESS,
  LAUNCH_DICE,
  MAX_CONSECUTIVE_SIXES,
  MIN_PLAYERS,
  MAX_PLAYERS,
  TRACK_LEN,
  VIRTUE_BY_SEAT,
  VIRTUES,
  describeTile,
  gateIndex,
  progressToRing,
  startIndex,
  isPlayableSeat,
} from './constants.js';
import { eventQuote } from './quotes.js';

export const DICE_CN = ['零', '一', '二', '三', '四', '五', '六'];

export class RuleError extends Error {
  constructor(message, code = 'RULE') {
    super(message);
    this.name = 'RuleError';
    this.code = code;
  }
}

export function pieceId(seat, index) {
  return `${seat}-${index}`;
}

export function makePiece(seat, index) {
  return { id: pieceId(seat, index), index, progress: -1 };
}

export function finishedCount(player) {
  return player.pieces.filter((p) => p.progress >= FINISH_PROGRESS).length;
}

export function playerBySeat(game, seat) {
  return game.players[seat] || null;
}

export function activeSeats(game) {
  return game.activeSeats.slice();
}

function assert(condition, message, code = 'RULE') {
  if (!condition) throw new RuleError(message, code);
}

function normalizeRng(rng) {
  const value = Number(rng());
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.999999, Math.max(0, value));
}

function rollValue(rng) {
  return 1 + Math.floor(normalizeRng(rng) * 6);
}

function bump(game) {
  game.seq += 1;
  return game.seq;
}

function pushLog(game, text, { tone = 'system', seat = null } = {}) {
  game.logSeq += 1;
  const entry = {
    id: game.logSeq,
    seq: game.seq,
    seat,
    tone,
    text,
  };
  game.log.push(entry);
  if (game.log.length > 80) game.log.splice(0, game.log.length - 80);
  return entry;
}

function nextSeat(game, fromSeat) {
  const seats = game.activeSeats;
  const idx = seats.indexOf(fromSeat);
  if (idx === -1) return seats[0];
  return seats[(idx + 1) % seats.length];
}

function advanceTurn(game, reason = '') {
  game.dice = null;
  game.legalMoves = [];
  game.consecutiveSixes = 0;
  game.sixStreakEnded = false;
  game.currentSeat = nextSeat(game, game.currentSeat);
  game.turnNumber += 1;
  if (reason) pushLog(game, reason);
}

function moveEffectLabel(effect, captures) {
  const parts = [];
  if (effect?.type === 'fly') parts.push('御风 +12');
  else if (effect?.type === 'jump') parts.push('同色拾级 +4');
  if (captures.length) parts.push(`折返 ${captures.length} 枚`);
  return parts.join(' · ');
}

/**
 * 计算当前席位的全部合法着法。
 * 不修改 game。
 */
export function computeLegalMoves(game) {
  assert(game.phase === 'playing', '棋局尚未开始。', 'NOT_PLAYING');
  const seat = game.currentSeat;
  const player = playerBySeat(game, seat);
  const dice = game.dice;
  if (!dice) return [];
  const moves = [];

  for (const piece of player.pieces) {
    if (piece.progress >= FINISH_PROGRESS) continue;

    if (piece.progress === -1) {
      if (!LAUNCH_DICE.includes(dice)) continue;
      const target = 0;
      moves.push({
        pieceId: piece.id,
        pieceIndex: piece.index,
        seat,
        from: -1,
        target,
        baseTarget: target,
        dice,
        steps: [target],
        kind: 'launch',
        effect: null,
        captures: [],
        label: '启程',
        summary: '自学宫启程，落于启程台',
        canFinish: false,
        targetTile: { type: 'start', index: startIndex(seat), safe: true },
      });
      continue;
    }

    const baseTarget = piece.progress + dice;
    if (baseTarget > FINISH_PROGRESS) continue;

    const steps = [];
    for (let p = piece.progress + 1; p <= baseTarget; p += 1) steps.push(p);

    let target = baseTarget;
    let effect = null;

    // 只有真正落在外圈普通格上，才结算同色拾级 / 御风。
    if (baseTarget <= GATE_PROGRESS - 1) {
      const ring = progressToRing(seat, baseTarget);
      const tile = describeTile(ring);
      if (tile.type === 'flight' && tile.owner === seat) {
        if (baseTarget + 12 <= FINISH_PROGRESS) {
          effect = { type: 'fly', amount: 12, from: baseTarget, to: baseTarget + 12 };
          target = baseTarget + 12;
        }
      } else if (tile.type === 'normal' && tile.color === seat) {
        if (baseTarget + 4 <= FINISH_PROGRESS) {
          effect = { type: 'jump', amount: 4, from: baseTarget, to: baseTarget + 4 };
          target = baseTarget + 4;
        }
      }
    }

    const targetTile =
      target <= GATE_PROGRESS
        ? describeTile(progressToRing(seat, target))
        : { type: 'home', index: target - GATE_PROGRESS, safe: true };

    let captures = [];
    if (target <= GATE_PROGRESS && !targetTile.safe) {
      const targetRing = progressToRing(seat, target);
      for (const otherSeat of game.activeSeats) {
        if (otherSeat === seat) continue;
        const other = playerBySeat(game, otherSeat);
        for (const otherPiece of other.pieces) {
          if (otherPiece.progress < 0 || otherPiece.progress > GATE_PROGRESS) continue;
          if (progressToRing(otherSeat, otherPiece.progress) === targetRing) {
            captures.push({
              pieceId: otherPiece.id,
              seat: otherSeat,
              progress: otherPiece.progress,
            });
          }
        }
      }
    }

    const effectLabel = moveEffectLabel(effect, captures);
    let label = '前行';
    if (target === FINISH_PROGRESS) label = '归殿';
    else if (target > GATE_PROGRESS) label = '归途';
    if (effectLabel) label = effectLabel;

    moves.push({
      pieceId: piece.id,
      pieceIndex: piece.index,
      seat,
      from: piece.progress,
      target,
      baseTarget,
      dice,
      steps,
      kind:
        target === FINISH_PROGRESS
          ? 'finish'
          : target > GATE_PROGRESS
            ? 'home'
            : effect
              ? effect.type
              : 'move',
      effect,
      captures,
      label,
      summary:
        target === FINISH_PROGRESS
          ? '踏入大成殿'
          : target > GATE_PROGRESS
            ? `归途第 ${target - GATE_PROGRESS} 格`
            : effectLabel || `前行 ${dice} 格`,
      canFinish: target === FINISH_PROGRESS,
      targetTile,
    });
  }

  return moves.sort((a, b) => a.pieceIndex - b.pieceIndex);
}

export function validateConfigs(configs) {
  assert(Array.isArray(configs), '席位配置无效。', 'CONFIG');
  assert(
    configs.length >= MIN_PLAYERS && configs.length <= MAX_PLAYERS,
    `需要 ${MIN_PLAYERS}–${MAX_PLAYERS} 位玩家。`,
    'CONFIG',
  );
  const seen = new Set();
  for (const config of configs) {
    assert(isPlayableSeat(config.seat), '席位无效。', 'CONFIG');
    assert(!seen.has(config.seat), '席位重复。', 'CONFIG');
    seen.add(config.seat);
    assert(
      typeof config.name === 'string' && config.name.trim().length > 0,
      '玩家称呼不能为空。',
      'CONFIG',
    );
  }
  return configs.slice().sort((a, b) => a.seat - b.seat);
}

/**
 * 建立一局新棋。
 * @param {Array<{seat:number,name:string,isBot?:boolean}>} configs
 */
export function createGame(configs, { rng = Math.random, now = Date.now } = {}) {
  const seats = validateConfigs(configs);
  const players = {};
  for (const config of seats) {
    const seat = config.seat;
    players[seat] = {
      seat,
      name: config.name.trim().slice(0, 12),
      isBot: Boolean(config.isBot),
      pieces: [0, 1, 2, 3].map((i) => makePiece(seat, i)),
      stats: {
        captures: 0,
        flights: 0,
        jumps: 0,
        sixes: 0,
        rolls: 0,
        finished: 0,
      },
      connected: true,
    };
  }
  const active = seats.map((s) => s.seat);
  const game = {
    phase: 'playing',
    activeSeats: active,
    players,
    currentSeat: active[0],
    dice: null,
    consecutiveSixes: 0,
    sixStreakEnded: false,
    legalMoves: [],
    winnerSeat: null,
    turnNumber: 1,
    seq: 1,
    logSeq: 0,
    log: [],
    lastMove: null,
    openingQuote: eventQuote('launch', rng),
    startedAt: now,
    endedAt: null,
  };

  const first = VIRTUE_BY_SEAT[game.currentSeat];
  pushLog(game, '四席既定，' + first.name + '先行。以礼相让，以棋会友。', {
    tone: 'system',
  });
  return game;
}

/**
 * 掷骰。服务端 / 本机模式都应通过此函数生成结果。
 */
export function rollDice(game, rng = Math.random) {
  assert(game.phase === 'playing', '棋局已经结束。', 'ENDED');
  assert(game.dice === null, '本回合已经掷过骰。', 'ALREADY_ROLLED');
  assert(game.legalMoves.length === 0, '请先完成当前着法。', 'PENDING_MOVE');

  const seat = game.currentSeat;
  const player = playerBySeat(game, seat);
  const dice = rollValue(rng);

  player.stats.rolls += 1;
  if (dice === 6) {
    player.stats.sixes += 1;
    game.consecutiveSixes += 1;
  } else {
    game.consecutiveSixes = 0;
  }

  game.dice = dice;
  game.legalMoves = computeLegalMoves(game);

  pushLog(game, `${player.name} 掷出「${DICE_CN[dice]}」点。`, {
    tone: dice === 6 ? 'six' : 'roll',
    seat,
  });

  if (dice === 6 && game.consecutiveSixes >= MAX_CONSECUTIVE_SIXES) {
    game.sixStreakEnded = true;
    pushLog(game, '连掷三六，此轮行毕即礼让下席。', { tone: 'system', seat });
  } else if (dice === 6) {
    pushLog(game, '六点可启程，亦可再掷一次。', { tone: 'bonus', seat });
  } else if (LAUNCH_DICE.includes(dice) && game.legalMoves.some((m) => m.from === -1)) {
    pushLog(game, '此点数可令一枚纸鸢启程。', { tone: 'bonus', seat });
  }

  if (game.legalMoves.length === 0) {
    pushLog(game, '此路不通，静候下一回合。', { tone: 'system', seat });
  }

  bump(game);
  return { dice, legalMoves: game.legalMoves };
}

function normalizeCaptures(game, move) {
  return move.captures.map((capture) => {
    const player = playerBySeat(game, capture.seat);
    return {
      ...capture,
      name: player ? player.name : '对手',
    };
  });
}

/**
 * 执行一个合法着法。
 * @param {object} game
 * @param {string} selectedPieceId
 */
export function applyMove(game, selectedPieceId, rng = Math.random) {
  assert(game.phase === 'playing', '棋局已经结束。', 'ENDED');
  assert(game.dice !== null, '请先掷骰。', 'NO_DICE');
  const move = game.legalMoves.find((m) => m.pieceId === selectedPieceId);
  assert(move, '这枚纸鸢当前无法这样行棋。', 'ILLEGAL_MOVE');

  const seat = game.currentSeat;
  const player = playerBySeat(game, seat);
  const piece = player.pieces.find((p) => p.id === selectedPieceId);
  assert(piece, '找不到这枚纸鸢。', 'NO_PIECE');

  const captures = normalizeCaptures(game, move);
  game.legalMoves = [];

  piece.progress = move.target;

  if (move.effect?.type === 'fly') {
    player.stats.flights += 1;
    pushLog(game, `${player.name} 御风而行，借云直上十二步。`, {
      tone: 'bonus',
      seat,
    });
  } else if (move.effect?.type === 'jump') {
    player.stats.jumps += 1;
    pushLog(game, `${player.name} 落于同色格，拾级四步。`, {
      tone: 'bonus',
      seat,
    });
  }

  for (const capture of captures) {
    const victim = playerBySeat(game, capture.seat);
    const victimPiece = victim?.pieces.find((p) => p.id === capture.pieceId);
    if (victimPiece) victimPiece.progress = -1;
    player.stats.captures += 1;
    pushLog(
      game,
      `${player.name} 与 ${capture.name} 同落一席，${capture.name} 的纸鸢折返学宫，重整衣冠。`,
      { tone: 'capture', seat },
    );
  }

  const finished = finishedCount(player);
  player.stats.finished = finished;
  let quote = null;

  if (move.target === FINISH_PROGRESS) {
    pushLog(game, `${player.name} 一枚纸鸢踏入大成殿（${finished}/4）。`, {
      tone: 'finish',
      seat,
    });
    quote = eventQuote('finish', rng);
  }

  let winner = false;
  if (finished >= 4) {
    winner = true;
    game.phase = 'ended';
    game.winnerSeat = seat;
    game.dice = null;
    game.legalMoves = [];
    game.endedAt = Date.now();
    pushLog(game, `${player.name} 四鸢归殿，大成礼成！`, {
      tone: 'win',
      seat,
    });
    quote = eventQuote('win', rng);
  }

  let label = move.label;
  if (!label) label = '行棋';

  if (!winner) {
    if (game.sixStreakEnded) {
      pushLog(game, '连掷三六，礼让一轮。', { tone: 'system', seat });
      advanceTurn(game);
    } else if (game.dice === 6) {
      pushLog(game, `${player.name} 再掷一次。`, { tone: 'bonus', seat });
      game.dice = null;
      game.legalMoves = [];
    } else {
      advanceTurn(game);
    }
  }

  game.lastMove = {
    seq: bump(game),
    type: 'move',
    seat,
    pieceId: move.pieceId,
    from: move.from,
    target: move.target,
    dice: move.dice,
    steps: move.steps,
    effect: move.effect,
    captures,
    kind: move.kind,
    label,
    quote,
    winner,
  };

  return game.lastMove;
}

/**
 * 当前玩家没有合法着法时轮空。
 */
export function passTurn(game) {
  assert(game.phase === 'playing', '棋局已经结束。', 'ENDED');
  assert(game.dice !== null, '尚未掷骰。', 'NO_DICE');
  assert(game.legalMoves.length === 0, '仍有可走之子。', 'HAS_MOVES');

  const seat = game.currentSeat;
  const player = playerBySeat(game, seat);
  const dice = game.dice;
  pushLog(game, `${player.name} 无子可动，礼让一轮。`, { tone: 'system', seat });
  game.lastMove = {
    seq: game.seq + 1,
    type: 'pass',
    seat,
    dice,
    label: '轮空',
    quote: null,
  };
  advanceTurn(game);
  bump(game);
  return game.lastMove;
}

/**
 * 便于测试和 UI 阅读的棋盘快照；不包含任何服务端秘密。
 */
export function gameSnapshot(game) {
  return {
    phase: game.phase,
    activeSeats: game.activeSeats.slice(),
    currentSeat: game.currentSeat,
    dice: game.dice,
    consecutiveSixes: game.consecutiveSixes,
    legalMoves: game.legalMoves,
    winnerSeat: game.winnerSeat,
    turnNumber: game.turnNumber,
    seq: game.seq,
    log: game.log.slice(-40),
    lastMove: game.lastMove,
    openingQuote: game.openingQuote,
    players: game.activeSeats.map((seat) => {
      const p = game.players[seat];
      return {
        seat: p.seat,
        name: p.name,
        isBot: p.isBot,
        connected: p.connected !== false,
        pieces: p.pieces.map((piece) => ({ ...piece })),
        stats: { ...p.stats },
        finished: finishedCount(p),
      };
    }),
    virtueMeta: VIRTUES.map((v) => ({
      seat: v.seat,
      name: v.name,
      char: v.char,
      hex: v.hex,
    })),
  };
}

export function seatName(game, seat) {
  return playerBySeat(game, seat)?.name || VIRTUE_BY_SEAT[seat]?.name || '空席';
}

export function progressLabel(seat, progress) {
  if (progress < 0) return '学宫';
  if (progress === FINISH_PROGRESS) return '大成殿';
  if (progress > GATE_PROGRESS) return `归途 ${progress - GATE_PROGRESS}`;
  if (progress === GATE_PROGRESS) return '归门';
  return `外圈 ${progress} 步`;
}

export function ringIndexOf(seat, progress) {
  return progressToRing(seat, progress);
}

export function gateOf(seat) {
  return gateIndex(seat);
}

export function startOf(seat) {
  return startIndex(seat);
}

export const RULES = {
  track: TRACK_LEN,
  home: 5,
  finishAt: FINISH_PROGRESS,
  gateAt: GATE_PROGRESS,
  maxSixes: MAX_CONSECUTIVE_SIXES,
  launchDice: LAUNCH_DICE,
};
