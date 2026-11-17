/** 只存偏好设置和房间号，不采集任何个人信息。 */

const KEYS = {
  name: 'rufeng.name',
  sound: 'rufeng.sound',
  seenIntro: 'rufeng.seenIntro',
  session: 'rufeng.session',
  lastMode: 'rufeng.lastMode',
};

function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式或存储已满时静默失败 */
  }
}

export const storage = {
  get name() {
    return typeof read(KEYS.name, '') === 'string' ? read(KEYS.name, '') : '';
  },
  set name(value) {
    write(KEYS.name, String(value || '').slice(0, 12));
  },
  get sound() {
    const value = read(KEYS.sound, true);
    return value !== false;
  },
  set sound(value) {
    write(KEYS.sound, Boolean(value));
  },
  get seenIntro() {
    return Boolean(read(KEYS.seenIntro, false));
  },
  set seenIntro(value) {
    write(KEYS.seenIntro, Boolean(value));
  },
  get session() {
    const value = read(KEYS.session, null);
    if (!value || typeof value !== 'object') return null;
    return {
      code: typeof value.code === 'string' ? value.code.slice(0, 8) : '',
      seat: Number.isInteger(value.seat) ? value.seat : null,
    };
  },
  set session(value) {
    if (!value) {
      try {
        localStorage.removeItem(KEYS.session);
      } catch {
        /* noop */
      }
      return;
    }
    write(KEYS.session, value);
  },
  get lastMode() {
    return read(KEYS.lastMode, 'local');
  },
  set lastMode(value) {
    write(KEYS.lastMode, value);
  },
};
