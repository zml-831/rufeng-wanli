/**
 * 「儒风万里」共享常量
 * 浏览器与 Node 服务端共用，保持规则与视觉语义一致。
 */

export const TRACK_LEN = 52;
export const HOME_LEN = 5;
export const GATE_PROGRESS = 50;
export const FINISH_PROGRESS = 56;
export const START_OFFSET = 2;
export const FLIGHT_PROGRESS = [17, 34];
export const MAX_CONSECUTIVE_SIXES = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/** 可让纸鸢从学宫启程的点数。六点仍保留“再掷一次”的额外回合。 */
export const LAUNCH_DICE = [2, 4, 6];

export function canLaunchOn(dice) {
  return LAUNCH_DICE.includes(dice);
}

/** 四德席位。angle 为学宫方位角（0° 朝上，顺时针）；gateAngle 为归门方位角。 */
export const VIRTUES = [
  {
    seat: 0,
    key: 'ren',
    char: '仁',
    name: '仁德斋',
    virtue: '仁',
    colorName: '赤',
    motto: '仁者爱人',
    hex: '#a63b31',
    deep: '#6d241f',
    soft: '#d9a69d',
    tint: '#f0ddd7',
    ink: '#fff8ee',
    angle: 45,
    gateAngle: 0,
    intro: '仁者爱人，推己及人。',
  },
  {
    seat: 1,
    key: 'yi',
    char: '义',
    name: '义德斋',
    virtue: '义',
    colorName: '金',
    motto: '义者宜也',
    hex: '#b0843c',
    deep: '#755722',
    soft: '#e2c993',
    tint: '#f3e8cf',
    ink: '#fffaf0',
    angle: 135,
    gateAngle: 90,
    intro: '义者宜也，行事合宜。',
  },
  {
    seat: 2,
    key: 'li',
    char: '礼',
    name: '礼德斋',
    virtue: '礼',
    colorName: '青',
    motto: '礼者敬人',
    hex: '#3f6d5f',
    deep: '#24463c',
    soft: '#9ec1b4',
    tint: '#dfece6',
    ink: '#f7fffa',
    angle: 225,
    gateAngle: 180,
    intro: '礼者敬人，和而不同。',
  },
  {
    seat: 3,
    key: 'zhi',
    char: '智',
    name: '智德斋',
    virtue: '智',
    colorName: '黛',
    motto: '智者不惑',
    hex: '#46516f',
    deep: '#2a3049',
    soft: '#aab3c9',
    tint: '#e2e5ee',
    ink: '#f8faff',
    angle: 315,
    gateAngle: 270,
    intro: '智者不惑，明辨笃行。',
  },
];

export const VIRTUE_BY_SEAT = Object.fromEntries(VIRTUES.map((v) => [v.seat, v]));

/** 在线雅集只开放固定短句，避免自由聊天带来的审核与隐私风险。 */
export const QUICK_PHRASES = [
  { id: 'teach', text: '请多指教' },
  { id: 'good', text: '好棋' },
  { id: 'yield', text: '承让' },
  { id: 'wait', text: '稍候片刻' },
];

export const SEAT_ORDER = [0, 1, 2, 3];

export const TILE_TYPES = {
  NORMAL: 'normal',
  START: 'start',
  GATE: 'gate',
  FLIGHT: 'flight',
};

export function mod(n, m) {
  return ((n % m) + m) % m;
}

/** 某席位的归门所在环位（0, 13, 26, 39）。 */
export function gateIndex(seat) {
  return mod(seat * 13, TRACK_LEN);
}

/** 某席位的启程台所在环位（2, 15, 28, 41）。 */
export function startIndex(seat) {
  return mod(gateIndex(seat) + START_OFFSET, TRACK_LEN);
}

/** 行进进度 → 外圈环位；仅对 0..50 有效。 */
export function progressToRing(seat, progress) {
  return mod(startIndex(seat) + progress, TRACK_LEN);
}

/** 外圈环位 → 该席位视角的进度（0..51）；归门为 50。 */
export function ringToProgress(seat, ringIndex) {
  return mod(ringIndex - startIndex(seat), TRACK_LEN);
}

/** 底色循环所对应的席位（普通格）。 */
export function baseTileColor(ringIndex) {
  return mod(ringIndex - START_OFFSET, 4);
}

/**
 * 描述一个外圈格。
 * 特殊格（启程台 / 归门 / 御风台）覆盖底色；归门与启程台为安全格。
 */
export function describeTile(ringIndex) {
  for (const v of VIRTUES) {
    if (gateIndex(v.seat) === ringIndex) {
      return { type: TILE_TYPES.GATE, owner: v.seat, color: v.seat, safe: true };
    }
  }
  for (const v of VIRTUES) {
    if (startIndex(v.seat) === ringIndex) {
      return { type: TILE_TYPES.START, owner: v.seat, color: v.seat, safe: true };
    }
  }
  for (const v of VIRTUES) {
    for (const p of FLIGHT_PROGRESS) {
      if (progressToRing(v.seat, p) === ringIndex) {
        return { type: TILE_TYPES.FLIGHT, owner: v.seat, color: v.seat, safe: false };
      }
    }
  }
  return { type: TILE_TYPES.NORMAL, owner: null, color: baseTileColor(ringIndex), safe: false };
}

/** 某格是否属于该席位的御风台。 */
export function isOwnFlight(seat, ringIndex) {
  const tile = describeTile(ringIndex);
  return tile.type === TILE_TYPES.FLIGHT && tile.owner === seat;
}

/** 该席位的外圈进度中，自己的御风台进度。 */
export function flightProgresses(seat) {
  return FLIGHT_PROGRESS.slice();
}

export function isPlayableSeat(seat) {
  return Number.isInteger(seat) && seat >= 0 && seat < MAX_PLAYERS;
}

export function seatByKey(key) {
  return VIRTUES.find((v) => v.key === key) || null;
}
