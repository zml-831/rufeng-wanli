/**
 * 机巧（AI）行棋。
 * 原则：能归殿先归殿，能折返先折返；其次御风、归途、启程；最后稳步向前。
 * 不做搜索，低延迟，行为可解释，适合家庭棋局。
 */

import { FINISH_PROGRESS, VIRTUE_BY_SEAT } from './constants.js';
import { finishedCount, playerBySeat } from './game.js';

const BOT_NAMES = [
  '机巧·子渊',
  '机巧·子舆',
  '机巧·子贡',
  '机巧·子夏',
  '机巧·子路',
  '机巧·子游',
  '机巧·有若',
  '机巧·冉求',
];

export function botName(seat, salt = 0) {
  return BOT_NAMES[(seat + salt) % BOT_NAMES.length];
}

function scoreMove(game, move) {
  let score = 0;
  const player = playerBySeat(game, move.seat);

  if (move.target === FINISH_PROGRESS) score += 12000;
  if (move.from === -1) score += 420;
  if (move.target > 50 && move.from <= 50) score += 780;
  if (move.effect?.type === 'fly') score += 560;
  if (move.effect?.type === 'jump') score += 300;

  for (const capture of move.captures) {
    score += 1400;
    score += Math.max(0, capture.progress) * 2;
  }

  // 越接近大成殿，越值得推进；避免把已深入归途的纸鸢闲置。
  score += move.target * 3;
  if (move.from > 40) score += 120;
  if (move.from === -1) {
    // 还剩多枚在学宫时，启程更有价值。
    const hangar = player.pieces.filter((p) => p.progress === -1).length;
    score += hangar * 35;
  }

  // 轻微偏好靠前的纸鸢，减少分散。
  score += Math.max(0, move.from) * 0.6;

  // 不轻易落在对手启程台前方一格之外的位置，属于很弱的保守偏好。
  score += move.pieceIndex === 0 ? 0.1 : 0;

  return score;
}

/**
 * 从合法着法中选一个。没有合法着法时返回 null。
 */
export function chooseAiMove(game, legalMoves = game.legalMoves) {
  if (!legalMoves || legalMoves.length === 0) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const move of legalMoves) {
    const s = scoreMove(game, move);
    if (s > bestScore) {
      bestScore = s;
      best = move;
    }
  }
  return best;
}

export function aiProfile(seat) {
  const virtue = VIRTUE_BY_SEAT[seat];
  return {
    name: botName(seat),
    title: virtue ? `${virtue.name} · 机巧` : '机巧',
    description: '由本地算法代行，不联网、不读取任何个人信息。',
  };
}

export function describeAi(game, seat) {
  const player = playerBySeat(game, seat);
  if (!player) return '';
  return `${player.name} 正在推演棋路…`;
}

export function makeBotConfigs(seats, salt = 0) {
  return seats.map((seat) => ({
    seat,
    name: botName(seat, salt),
    isBot: true,
  }));
}

export function totalFinished(game) {
  return game.activeSeats.reduce((sum, seat) => sum + finishedCount(game.players[seat]), 0);
}
