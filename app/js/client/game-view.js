/**
 * 棋局视图：顶部信息、玩家席、棋盘、回合计时盘、棋谱。
 * 只负责展示与交互事件，规则裁决由 App（本机）或服务端（在线）负责。
 */

import {
  FINISH_PROGRESS,
  GATE_PROGRESS,
  QUICK_PHRASES,
  VIRTUE_BY_SEAT,
  progressToRing,
} from '../shared/constants.js';
import { quoteByText } from '../shared/quotes.js';
import { Board } from './board.js';
import { icon, kiteIcon } from './icons.js';
import { dicePips, escapeHtml, sleep } from './ui.js';

function seatOf(pieceId) {
  return Number(String(pieceId).split('-')[0]);
}

function tileName(seat, progress) {
  if (progress < 0) return '学宫';
  if (progress >= FINISH_PROGRESS) return '大成殿';
  if (progress > GATE_PROGRESS) return `归途第 ${progress - GATE_PROGRESS} 格`;
  if (progress === GATE_PROGRESS) return '归门';
  return `外圈第 ${progressToRing(seat, progress) + 1} 格`;
}

export class GameView {
  constructor(root, {
    mode = 'local',
    viewerSeat = null,
    room = null,
    state,
    audio = null,
    handlers = {},
  }) {
    this.root = root;
    this.mode = mode;
    this.viewerSeat = viewerSeat;
    this.room = room;
    this.state = state;
    this.audio = audio;
    this.handlers = handlers;
    this.board = null;
    this.busy = false;
    this.canAct = false;
    this.connection = mode === 'online' ? 'connecting' : 'local';
    this.speech = null;
    this.lastStepSound = 0;
    this._mount();
  }

  _mount() {
    const online = this.mode === 'online';
    this.root.innerHTML = `<div class="game-screen">
      <header class="game-topbar">
        <a class="brand" href="/" data-act="home" aria-label="返回首页">
          <span class="brand-seal">儒</span>
          <span class="brand-text"><strong>儒风万里</strong><small>以棋会友 · 以礼相行</small></span>
        </a>
        <div class="game-topbar-center" id="topbar-center">
          ${online
            ? `<span class="room-chip">雅集 <strong>${escapeHtml(this.room?.code || '')}</strong><button type="button" data-act="copy" aria-label="复制房间链接">${icon('copy')}</button></span>
               <span class="connection-state" id="connection-state"><span class="connection-dot"></span><span class="connection-text">连接中</span></span>`
            : `<span class="room-chip">${this.mode === 'ai' ? '人机问道' : '同屏对弈'}</span>
               <span class="connection-state"><span class="connection-dot"></span><span class="connection-text">本机棋局</span></span>`}
        </div>
        <div class="game-topbar-actions">
          <button type="button" class="btn-icon" data-act="rules" aria-label="查看玩法">${icon('rules')}</button>
          <button type="button" class="btn-icon" data-act="sound" aria-label="音效开关" aria-pressed="true">${icon('sound')}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="exit">${icon('exit')}<span>离席</span></button>
        </div>
      </header>
      <div class="game-frame">
        <aside class="players-panel" id="players-panel" aria-label="四席玩家"></aside>
        <main class="board-column">
          <div class="board-toolbar">
            <div class="board-toolbar-title"><strong>大成玉盘</strong><span>行一周 · 归大成</span></div>
            <div class="board-tools">
              <button type="button" class="btn-icon" data-act="zoom" aria-label="放大棋盘">${icon('zoom')}</button>
              <button type="button" class="btn-icon" data-act="log" aria-label="查看完整棋谱">${icon('scroll')}</button>
            </div>
          </div>
          <div class="board-frame"><div class="board" id="game-board"></div></div>
          <ul class="board-legend" aria-label="棋盘图例">
            <li><span class="legend-dot"></span>同色 · 拾级 +4</li>
            <li><span class="legend-dot flight"></span>御风 · 前进 +12</li>
            <li><span class="legend-dot gate"></span>归门 · 转入归途</li>
            <li><span class="legend-dot safe"></span>启程台 · 不受折返</li>
            <li><span class="legend-dot lane"></span>归途 · 需精确点数</li>
          </ul>
          <div class="event-ribbon" id="event-ribbon" aria-live="polite"></div>
        </main>
        <aside class="turn-panel" id="turn-panel" aria-label="回合操作"></aside>
      </div>
      <footer class="game-log">
        <div class="game-log-inner">
          <span class="log-label">棋谱</span>
          <div class="log-scroll" id="log-scroll"></div>
          <div class="log-actions"><button type="button" class="btn btn-quiet btn-sm" data-act="log">全部</button></div>
        </div>
      </footer>
      <button type="button" class="floating-help" data-act="rules" aria-label="查看玩法">${icon('help')}</button>
    </div>`;

    this.panelEl = this.root.querySelector('#players-panel');
    this.turnEl = this.root.querySelector('#turn-panel');
    this.logEl = this.root.querySelector('#log-scroll');
    this.ribbonEl = this.root.querySelector('#event-ribbon');
    this.board = new Board(this.root.querySelector('#game-board'), {
      onTokenSelect: (pieceId) => this._selectPiece(pieceId),
    });

    this.root.addEventListener('click', (event) => this._onClick(event));
    this.renderAll();
  }

  _onClick(event) {
    const pieceBtn = event.target.closest('[data-piece][data-move]');
    if (pieceBtn) {
      this._selectPiece(pieceBtn.dataset.piece);
      return;
    }
    const actionEl = event.target.closest('[data-act]');
    if (!actionEl) return;
    const action = actionEl.dataset.act;
    if (action === 'rules') this.handlers.onRules?.();
    if (action === 'sound') this.handlers.onSound?.();
    if (action === 'exit') this.handlers.onExit?.();
    if (action === 'copy') this.handlers.onCopyCode?.();
    if (action === 'zoom') this.handlers.onZoom?.();
    if (action === 'log') this.handlers.onLog?.();
    if (action === 'roll') this.handlers.onRoll?.();
    if (action === 'home') {
      event.preventDefault();
      this.handlers.onHome?.();
    }
    if (action === 'say') this.handlers.onSay?.(actionEl.dataset.phrase);
  }

  _selectPiece(pieceId) {
    if (!this.canAct || this.busy) return;
    const legal = this.state.legalMoves?.some((m) => m.pieceId === pieceId);
    if (!legal) return;
    this._setBusy(true);
    this.handlers.onMove?.(pieceId);
  }

  _setBusy(value) {
    this.busy = Boolean(value);
    this.board?.setCanAct(!this.busy && this.canAct);
    if (this.turnEl) this.renderTurn();
  }

  update(state, { canAct = false, room = null, connection = null, busy = false } = {}) {
    this.state = state;
    if (room) this.room = room;
    if (connection) this.connection = connection;
    this.canAct = Boolean(canAct) && !busy && !this.busy;
    this.board?.update(state, { viewerSeat: this.viewerSeat, canAct: this.canAct });
    this.renderAll();
  }

  updatePanels(state, { canAct = false, room = null } = {}) {
    this.state = state;
    if (room) this.room = room;
    this.canAct = Boolean(canAct) && !this.busy;
    this.renderAll();
  }

  renderAll() {
    this.renderPlayers();
    this.renderTurn();
    this.renderRibbon();
    this.renderLog();
    this._renderTopbar();
  }

  _renderTopbar() {
    if (this.mode !== 'online') return;
    const stateEl = this.root.querySelector('#connection-state');
    if (!stateEl) return;
    const reconnecting = ['reconnecting', 'connecting'].includes(this.connection);
    stateEl.classList.toggle('is-reconnecting', reconnecting);
    const text = stateEl.querySelector('.connection-text');
    if (text) {
      text.textContent =
        this.connection === 'connected'
          ? '已连接'
          : this.connection === 'reconnecting'
            ? '重连中'
            : this.connection === 'closed'
              ? '已断开'
              : '连接中';
    }
  }

  renderPlayers() {
    if (!this.panelEl) return;
    const players = new Map((this.state.players || []).map((p) => [p.seat, p]));
    const current = this.state.currentSeat;
    const cards = [];
    for (let seat = 0; seat < 4; seat += 1) {
      const virtue = VIRTUE_BY_SEAT[seat];
      const player = players.get(seat);
      if (!player) {
        cards.push(`<div class="player-card" style="--seat-color:${virtue.hex};opacity:.36" aria-hidden="true">
          <div class="player-card-head">
            <span class="player-seal" style="background:${virtue.hex}">${virtue.char}</span>
            <div class="player-name"><strong>虚位</strong><small>${virtue.name}</small></div>
          </div>
        </div>`);
        continue;
      }
      const isCurrent = seat === current && this.state.phase === 'playing';
      const isYou = this.viewerSeat === seat && this.mode !== 'local';
      const roomSeat = this.mode === 'online' ? this.room?.seats?.[seat] : null;
      const offline = this.mode === 'online' && roomSeat?.connected === false;
      const autopilot = this.mode === 'online' && Boolean(roomSeat?.autopilot);
      const finished = player.finished ?? player.pieces.filter((p) => p.progress >= FINISH_PROGRESS).length;
      const pips = player.pieces
        .map((piece) => {
          const cls =
            piece.progress >= FINISH_PROGRESS
              ? 'is-finished'
              : piece.progress > GATE_PROGRESS
                ? 'is-home'
                : piece.progress >= 0
                  ? 'is-launched'
                  : '';
          return `<span class="piece-pip ${cls}" title="${escapeHtml(tileName(seat, piece.progress))}">${kiteIcon('')}</span>`;
        })
        .join('');
      const badges = [];
      if (player.isBot) badges.push('<span class="mini-tag bot">机巧</span>');
      if (isYou) badges.push('<span class="mini-tag you">你</span>');
      if (roomSeat?.host) badges.push('<span class="mini-tag host">席主</span>');
      if (offline || autopilot) badges.push(`<span class="mini-tag offline">${autopilot ? '托管' : '暂离'}</span>`);
      const hint = isCurrent
        ? player.isBot
          ? '机巧推演中…'
          : offline || autopilot
            ? '托管代行中…'
            : this.canAct
              ? this.state.dice === null
                ? '请掷骰'
                : '请选纸鸢'
              : '行棋中…'
        : finished >= 4
          ? '已归殿'
          : autopilot
            ? '托管候场'
            : '候场';
      const speech =
        this.speech && this.speech.seat === seat && this.speech.expires > Date.now()
          ? `<span class="speech-bubble">${escapeHtml(this.speech.text)}</span>`
          : '';
      cards.push(`<article class="player-card ${isCurrent ? 'is-current' : ''} ${isYou ? 'is-you' : ''} ${offline ? 'is-offline' : ''}"
        style="--seat-color:${virtue.hex}" aria-label="${escapeHtml(player.name)}，${virtue.name}">
        ${speech}
        <div class="player-card-head">
          <span class="player-seal" style="background:${virtue.hex}">${virtue.char}</span>
          <div class="player-name">
            <strong>${escapeHtml(player.name)}</strong>
            <small>${virtue.name} · ${virtue.motto}</small>
          </div>
          <div class="player-badges">${badges.join('')}</div>
        </div>
        <div class="player-progress">
          <div class="progress-line"><span>四鸢归殿</span><strong>${finished} / 4</strong></div>
          <div class="piece-pips">${pips}</div>
        </div>
        <div class="player-turn-hint"><span class="kicker-dot" style="background:currentColor"></span>${hint}</div>
      </article>`);
    }
    this.panelEl.innerHTML = cards.join('') + `<div class="players-panel-note"><strong>启程台</strong>与<strong>归门</strong>不受折返；归途需精确点数。行棋不必争先，落子但求合礼。</div>`;
  }

  renderTurn() {
    if (!this.turnEl) return;
    const state = this.state;
    const player = state.players?.find((p) => p.seat === state.currentSeat);
    if (!player) {
      this.turnEl.innerHTML = '';
      return;
    }
    const virtue = VIRTUE_BY_SEAT[player.seat];
    const roomSeat = this.mode === 'online' ? this.room?.seats?.[player.seat] : null;
    const autopilot = this.mode === 'online' && Boolean(roomSeat?.autopilot);
    const isMyTurn =
      this.mode === 'online'
        ? this.viewerSeat === state.currentSeat
        : this.mode === 'local' || !player.isBot;
    const canAct = this.canAct && isMyTurn && !this.busy;
    const diceDone = state.dice !== null;
    const hasMoves = (state.legalMoves?.length || 0) > 0;
    const quote = this._currentQuote();

    let statusText;
    if (state.phase === 'ended') statusText = '棋局已终，礼成。';
    else if (player.isBot || autopilot) statusText = '机巧正在推演棋路…';
    else if (this.mode === 'online' && roomSeat?.connected === false) statusText = '该席暂离，稍后将由机巧代行。';
    else if (this.mode === 'online' && !isMyTurn) statusText = `${escapeHtml(player.name)} 正在行棋，请稍候。`;
    else if (!isMyTurn) statusText = '请静候当前玩家行棋。';
    else if (!diceDone) statusText = '请掷骰。2、4、6 点可启程；六点可再掷一次。';
    else if (hasMoves) statusText = '请选择一枚纸鸢落子；金色圆环为可落之处。';
    else statusText = '此路不通，即将礼让一轮。';

    const rollDisabled = !canAct || diceDone;
    const rollLabel = diceDone
      ? hasMoves && canAct
        ? '请先选子'
        : '本轮已掷'
      : player.isBot
        ? '机巧推演中'
        : this.mode === 'online' && !isMyTurn
          ? '静候他席'
          : '掷骰行棋';

    const movesHtml =
      canAct && diceDone && hasMoves
        ? `<div class="move-list">${state.legalMoves
            .map((move) => {
              const target = tileName(move.seat, move.target);
              const label = move.label === '前行' ? `前行 ${move.dice} 格` : move.label;
              return `<button type="button" class="move-btn" data-piece="${move.pieceId}" data-move="1" aria-label="移动 ${move.pieceIndex + 1} 号纸鸢到${target}">
                <span class="move-piece">${move.pieceIndex + 1}</span>
                <span class="move-copy"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(target)}</small></span>
                <span class="move-arrow">→</span>
              </button>`;
            })
            .join('')}</div>`
        : '';

    const diceHtml = diceDone ? dicePips(state.dice) : dicePips(0);
    const six = state.dice === 6;
    const quoteHtml = quote
      ? `<div class="turn-quote"><strong>${escapeHtml(quote.text)}</strong><small>${escapeHtml(quote.source)}</small></div>`
      : '';

    const sayHtml =
      this.mode === 'online'
        ? `<div class="quick-say"><div class="quick-say-label"><span>雅集短句</span><span>仅限预设</span></div><div class="quick-say-row">${QUICK_PHRASES.map(
            (p) => `<button type="button" data-act="say" data-phrase="${p.id}">${p.text}</button>`,
          ).join('')}</div></div>`
        : '';

    this.turnEl.innerHTML = `<div class="turn-head">
      <div class="turn-kicker"><span>第 ${state.turnNumber} 回合</span><span class="turn-round">${state.consecutiveSixes ? `连掷 ${state.consecutiveSixes} / 3` : '以礼相行'}</span></div>
      <div class="turn-person">
        <span class="player-seal" style="background:${virtue.hex}">${virtue.char}</span>
        <div class="turn-person-copy"><strong>${escapeHtml(player.name)}</strong><span>${virtue.name} · ${virtue.motto}</span></div>
      </div>
      <div class="turn-status-text ${canAct ? 'is-your-turn' : ''}">${statusText}</div>
    </div>
    <div class="dice-stage">
      <div class="dice-wrap">
        <div class="dice-shadow"></div>
        <div class="die ${six ? 'is-six' : ''} ${diceDone ? '' : 'is-idle'}" id="die" aria-label="骰子${state.dice ? `，${state.dice}点` : '，尚未掷出'}">${diceHtml}</div>
      </div>
      <div class="dice-side">
        <button type="button" class="btn btn-primary roll-btn" data-act="roll" ${rollDisabled ? 'disabled' : ''}>${icon('dice')}${rollLabel}</button>
        <div class="dice-meta"><span>${state.consecutiveSixes ? `连掷 <strong>${state.consecutiveSixes}</strong> / 3` : '2 · 4 · 6 启程'}</span><span class="dot"></span><span>${hasMoves && diceDone && canAct ? '点选纸鸢' : '点数即步数'}</span></div>
      </div>
    </div>
    <div class="move-section">
      <div class="move-section-head"><span>落子</span><strong>${movesHtml ? `${state.legalMoves.length} 种着法` : diceDone ? '静候' : '待掷骰'}</strong></div>
      ${movesHtml || `<div class="move-empty"><strong>${diceDone && !hasMoves ? '此路不通' : '静候骰声'}</strong>${diceDone && !hasMoves ? '无子可动，礼让一轮。' : '掷骰之后，可行动作会在此列出。'}</div>`}
    </div>
    <div class="turn-foot">${quoteHtml}${sayHtml}</div>`;
  }

  _currentQuote() {
    if (this.state.lastMove?.quote) {
      const found = quoteByText(this.state.lastMove.quote.text);
      if (found) return found;
      return this.state.lastMove.quote;
    }
    return this.state.openingQuote || null;
  }

  renderRibbon() {
    if (!this.ribbonEl) return;
    const log = this.state.log || [];
    const last = log[log.length - 1];
    const quote = this._currentQuote();
    this.ribbonEl.innerHTML = `<span class="event-seal">记</span>
      <div class="event-copy">
        <strong>${escapeHtml(last?.text || '四席既定，仁德斋先行。')}</strong>
        <small>${this.state.phase === 'ended' ? '礼成 · 大成殿' : `第 ${this.state.turnNumber} 回合 · ${this.state.players.find((p) => p.seat === this.state.currentSeat)?.name || ''}`}</small>
      </div>
      ${quote ? `<div class="event-quote"><em>「${escapeHtml(quote.text)}」</em><br>${escapeHtml(quote.source)}</div>` : ''}`;
  }

  renderLog() {
    if (!this.logEl) return;
    const log = (this.state.log || []).slice(-5);
    this.logEl.innerHTML = log
      .map((entry) => {
        const virtue = entry.seat !== null ? VIRTUE_BY_SEAT[entry.seat] : null;
        return `<div class="log-entry tone-${entry.tone || 'system'}"><span class="log-dot" style="--log-color:${virtue?.hex || 'var(--gold)'}"></span><span>${escapeHtml(entry.text)}</span></div>`;
      })
      .join('');
    requestAnimationFrame(() => {
      if (this.logEl) this.logEl.scrollLeft = this.logEl.scrollWidth;
    });
  }

  async playDice(value) {
    this.busy = true;
    this.canAct = false;
    this.board?.setCanAct(false);
    this.audio?.playDice?.();
    const die = this.root.querySelector('#die');
    if (!die) return;
    die.classList.remove('is-six', 'is-idle');
    die.classList.add('is-rolling');
    const interval = setInterval(() => {
      die.innerHTML = dicePips(1 + Math.floor(Math.random() * 6));
    }, 65);
    await sleep(480);
    clearInterval(interval);
    die.classList.remove('is-rolling');
    die.innerHTML = dicePips(value);
    die.setAttribute('aria-label', `骰子，${value}点`);
    die.classList.add('is-result');
    if (value === 6) die.classList.add('is-six');
    setTimeout(() => die.classList.remove('is-result'), 520);
    await sleep(160);
    this.busy = false;
  }

  async playMove(move, stateBefore, stateAfter) {
    this.busy = true;
    this.canAct = false;
    this.board?.setCanAct(false);
    this.audio?.playStep?.();
    if (move.effect?.type === 'fly') this.audio?.playFly?.();
    if (move.captures?.length) setTimeout(() => this.audio?.playCapture?.(), 420);
    if (move.target >= FINISH_PROGRESS) setTimeout(() => this.audio?.playFinish?.(), 500);
    const throttledStep = () => {
      const now = performance.now();
      if (now - this.lastStepSound > 95) {
        this.lastStepSound = now;
        this.audio?.playStep?.();
      }
    };
    try {
      await this.board.animateMove(move, stateBefore, stateAfter, { onStep: throttledStep });
    } finally {
      this.busy = false;
    }
  }

  flashPhrase(data) {
    if (!data || data.seat === undefined) return;
    this.speech = { seat: data.seat, text: data.text, expires: Date.now() + 4200 };
    this.renderPlayers();
    const seat = data.seat;
    setTimeout(() => {
      if (this.speech && this.speech.seat === seat) {
        this.speech = null;
        this.renderPlayers();
      }
    }, 4300);
  }

  setConnection(status) {
    this.connection = status;
    this._renderTopbar();
    let banner = document.querySelector('.connection-banner');
    if (['reconnecting', 'connecting'].includes(status) && this.mode === 'online') {
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'connection-banner';
        banner.innerHTML = '<span class="spinner"></span><span>正在重连雅集，请稍候…</span>';
        document.body.appendChild(banner);
      }
    } else {
      banner?.remove();
    }
  }

  setSoundState(enabled) {
    const button = this.root.querySelector('[data-act="sound"]');
    if (!button) return;
    button.innerHTML = icon(enabled ? 'sound' : 'mute');
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? '关闭音效' : '开启音效');
  }

  getBoardElement() {
    return this.root.querySelector('#game-board');
  }

  destroy() {
    this.board?.destroy();
    document.querySelector('.connection-banner')?.remove();
    this.root.innerHTML = '';
  }
}
