/**
 * 在线接口与 SSE 订阅。
 * Cookie 由服务端以 HttpOnly + SameSite=Strict 下发，前端不接触令牌。
 */

export class ApiError extends Error {
  constructor(message, { code = 'ERROR', status = 0, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body, timeout = 12000, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new ApiError('网络响应超时，请检查连接后再试。', { code: 'TIMEOUT' });
    }
    throw new ApiError('未能连接棋席，请确认服务已启动或稍后再试。', { code: 'OFFLINE' });
  }
  clearTimeout(timer);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiError('在线服务暂未启用。请先体验同屏对弈或人机问道；在线雅集需要启动 Node 服务。', {
      code: 'ONLINE_UNAVAILABLE',
      status: response.status,
    });
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || payload?.ok === false) {
    const err = payload?.error || {};
    throw new ApiError(err.message || '服务暂时开了小差，请稍后再试。', {
      code: err.code || 'HTTP_ERROR',
      status: response.status,
      payload,
    });
  }
  return payload;
}

export const api = {
  config: () => request('/api/config'),
  createRoom: (name) => request('/api/rooms', { method: 'POST', body: { name } }),
  joinRoom: (code, name) =>
    request(`/api/rooms/${encodeURIComponent(code)}/join`, { method: 'POST', body: { name } }),
  state: (code) => request(`/api/rooms/${encodeURIComponent(code)}/state`),
  ready: (code, ready) =>
    request(`/api/rooms/${encodeURIComponent(code)}/ready`, { method: 'POST', body: { ready } }),
  seat: (code, seat) =>
    request(`/api/rooms/${encodeURIComponent(code)}/seat`, { method: 'POST', body: { seat } }),
  bot: (code, seat, action = 'add') =>
    request(`/api/rooms/${encodeURIComponent(code)}/bot`, { method: 'POST', body: { seat, action } }),
  start: (code) => request(`/api/rooms/${encodeURIComponent(code)}/start`, { method: 'POST', body: {} }),
  roll: (code) => request(`/api/rooms/${encodeURIComponent(code)}/roll`, { method: 'POST', body: {} }),
  move: (code, pieceId) =>
    request(`/api/rooms/${encodeURIComponent(code)}/move`, { method: 'POST', body: { pieceId } }),
  say: (code, phraseId) =>
    request(`/api/rooms/${encodeURIComponent(code)}/say`, { method: 'POST', body: { phraseId } }),
  rematch: (code) => request(`/api/rooms/${encodeURIComponent(code)}/rematch`, { method: 'POST', body: {} }),
  leave: (code) => request(`/api/rooms/${encodeURIComponent(code)}/leave`, { method: 'POST', body: {} }),
};

export class RoomChannel {
  constructor(code, handlers = {}) {
    this.code = code;
    this.handlers = handlers;
    this.source = null;
    this.closedByUs = false;
    this.retry = 0;
    this.retryTimer = null;
    this.status = 'idle';
  }

  open() {
    this.closedByUs = false;
    this._connect();
  }

  _connect() {
    clearTimeout(this.retryTimer);
    this._setStatus('connecting');
    const source = new EventSource(`/api/rooms/${encodeURIComponent(this.code)}/events`, {
      withCredentials: true,
    });
    this.source = source;
    source.addEventListener('open', () => {
      this.retry = 0;
      this._setStatus('connected');
    });
    source.addEventListener('snapshot', (event) => {
      try {
        this.handlers.onSnapshot?.(JSON.parse(event.data));
      } catch {
        /* 忽略异常帧 */
      }
    });
    source.addEventListener('phrase', (event) => {
      try {
        this.handlers.onPhrase?.(JSON.parse(event.data));
      } catch {
        /* noop */
      }
    });
    source.addEventListener('closed', (event) => {
      let data = {};
      try {
        data = JSON.parse(event.data);
      } catch {
        /* noop */
      }
      this._setStatus('closed');
      this.handlers.onClosed?.(data);
      this.close();
    });
    source.addEventListener('error', () => {
      if (this.closedByUs) return;
      this._setStatus('reconnecting');
      if (source.readyState === EventSource.CLOSED) {
        this.retry += 1;
        if (this.retry > 5) {
          this._setStatus('closed');
          this.handlers.onClosed?.({ reason: '与雅集的连接中断，可能已经散场。' });
          this.close();
          return;
        }
        const delay = Math.min(8000, 700 * 2 ** Math.min(this.retry, 4));
        this.retryTimer = setTimeout(() => this._connect(), delay);
      }
      this.handlers.onError?.();
    });
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.handlers.onStatus?.(status);
  }

  close() {
    this.closedByUs = true;
    clearTimeout(this.retryTimer);
    this.source?.close();
    this.source = null;
    this._setStatus('closed');
  }
}
