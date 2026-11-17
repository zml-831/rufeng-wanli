/**
 * 大成玉盘 SVG 棋盘。
 *
 * 全部纹样由本文件生成：外圈 52 格、四座学宫、四条归途、中央大成殿。
 * Board 负责静态绘制、棋子定位、合法落点提示与行棋动画。
 */

import {
  FINISH_PROGRESS,
  GATE_PROGRESS,
  TRACK_LEN,
  VIRTUES,
  VIRTUE_BY_SEAT,
  describeTile,
  progressToRing,
} from '../shared/constants.js';

const CENTER = 500;
const TRACK_RADIUS = 400;
const HANGAR_RADIUS = 252;
const HOME_RADII = [332, 288, 244, 200, 156];
const FINISH_RADIUS = 103;
const HANGAR_PADS = [
  [-34, -6],
  [34, -6],
  [-34, 34],
  [34, 34],
];
const TRACK_GLYPHS = ['仁', '义', '礼', '智', '信', '和', '学', '思'];

function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.sin(rad),
    y: CENTER - radius * Math.cos(rad),
  };
}

function trackAngle(ringIndex) {
  return (ringIndex * 360) / TRACK_LEN;
}

function hangarCenter(seat) {
  return polar(VIRTUE_BY_SEAT[seat].angle, HANGAR_RADIUS);
}

function hangarPoint(seat, pieceIndex) {
  const c = hangarCenter(seat);
  const [dx, dy] = HANGAR_PADS[pieceIndex % 4];
  return { x: c.x + dx, y: c.y + dy };
}

function trackPoint(seat, progress) {
  return polar(trackAngle(progressToRing(seat, progress)), TRACK_RADIUS);
}

function homePoint(seat, progress) {
  const idx = Math.max(0, Math.min(HOME_RADII.length - 1, progress - GATE_PROGRESS - 1));
  return polar(VIRTUE_BY_SEAT[seat].gateAngle, HOME_RADII[idx]);
}

function finishPoint(seat, pieceIndex) {
  const angle = VIRTUE_BY_SEAT[seat].gateAngle;
  const base = polar(angle, FINISH_RADIUS);
  const rad = (angle * Math.PI) / 180;
  const tangent = { x: Math.cos(rad), y: Math.sin(rad) };
  const offset = (pieceIndex - 1.5) * 13;
  return { x: base.x + tangent.x * offset, y: base.y + tangent.y * offset };
}

function stackOffsets(n) {
  if (n <= 1) return [[0, 0]];
  if (n === 2) return [[-8, 0], [8, 0]];
  if (n === 3) return [[-8, -7], [8, -7], [0, 8]];
  const offsets = [];
  const cols = n > 6 ? 3 : 2;
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    offsets.push([(col - (cols - 1) / 2) * 11, (row - (rows - 1) / 2) * 11]);
  }
  return offsets;
}

function seatColor(seat, key = 'hex') {
  return VIRTUE_BY_SEAT[seat]?.[key] || '#b88a44';
}

function tileGlyph(index) {
  const tile = describeTile(index);
  if (tile.type === 'start') return '启';
  if (tile.type === 'gate') return '归';
  if (tile.type === 'flight') return '御';
  return TRACK_GLYPHS[index % TRACK_GLYPHS.length];
}

function tileSubGlyph(tile) {
  if (tile.type === 'start') return '启程';
  if (tile.type === 'gate') return '归门';
  if (tile.type === 'flight') return '御风';
  return '';
}

function tileClass(tile) {
  if (tile.type === 'start') return 'is-start';
  if (tile.type === 'gate') return 'is-gate';
  if (tile.type === 'flight') return 'is-flight';
  return `tile--c${tile.color}`;
}

function tileFillStyle(tile) {
  if (tile.type === 'start' || tile.type === 'flight') {
    return `fill="${seatColor(tile.owner)}"`;
  }
  if (tile.type === 'gate') {
    return `fill="#f4ead7"`;
  }
  return '';
}

function buildDefs() {
  return `<defs>
    <linearGradient id="paperGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f9f2e5"/>
      <stop offset=".55" stop-color="#f1e6d4"/>
      <stop offset="1" stop-color="#e7d8c0"/>
    </linearGradient>
    <radialGradient id="discGrad" cx="46%" cy="40%" r="62%">
      <stop offset="0" stop-color="#fbf6ec"/>
      <stop offset=".62" stop-color="#f0e5d3"/>
      <stop offset="1" stop-color="#e5d4ba"/>
    </radialGradient>
    <radialGradient id="hangarGrad" cx="34%" cy="18%" r="88%">
      <stop offset="0" stop-color="#fdf8ef"/>
      <stop offset="1" stop-color="#eadcc6"/>
    </radialGradient>
    <radialGradient id="hallGrad" cx="45%" cy="38%" r="66%">
      <stop offset="0" stop-color="#f2e6d1"/>
      <stop offset=".7" stop-color="#e6d4b8"/>
      <stop offset="1" stop-color="#d9c3a2"/>
    </radialGradient>
    ${VIRTUES.map(
      (v) => `<linearGradient id="tokenGrad${v.seat}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${v.soft}"/>
        <stop offset=".38" stop-color="${v.hex}"/>
        <stop offset="1" stop-color="${v.deep}"/>
      </linearGradient>`,
    ).join('')}
    <filter id="boardSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#4a2f14" flood-opacity=".12"/>
    </filter>
    <filter id="tokenShadow" x="-80%" y="-80%" width="260%" height="260%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.8" flood-color="#3c2612" flood-opacity=".3"/>
    </filter>
  </defs>`;
}

function buildBorder() {
  const tickMarks = Array.from({ length: 52 }, (_, i) => {
    const a = trackAngle(i);
    const p1 = polar(a, 442);
    const p2 = polar(a, 447);
    return `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="#8b6734" stroke-opacity=".32" stroke-width="1"/>`;
  }).join('');

  const clouds = [45, 135, 225, 315]
    .map((angle) => {
      const p = polar(angle, 454);
      return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle})" opacity=".42">
        <path d="M-17 2c0-7 5-12 12-12 2 0 4 1 6 2 2-5 7-8 12-8 7 0 12 4 13 11 5 0 9 4 9 9s-4 9-9 9H-5c-7 0-12-5-12-11Z" fill="none" stroke="#8b6734" stroke-width=".9"/>
        <path d="M-5 14c-1 4 1 7 4 9M8 14c0 4 2 7 5 9" fill="none" stroke="#8b6734" stroke-width=".8" stroke-linecap="round"/>
      </g>`;
    })
    .join('');

  const corners = [
    [42, 42, 1, 1],
    [958, 42, -1, 1],
    [42, 958, 1, -1],
    [958, 958, -1, -1],
  ]
    .map(
      ([x, y, sx, sy]) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" opacity=".46">
        <path d="M0 34V0h34M7 27V7h20M13 27v-8h8M27 13h-8" fill="none" stroke="#8b6734" stroke-width="1"/>
        <path d="M40 0h10M0 40v10" stroke="#8b6734" stroke-width="1" stroke-opacity=".6"/>
      </g>`,
    )
    .join('');

  return `<g>
    <circle cx="500" cy="500" r="472" fill="url(#discGrad)" stroke="#8b6734" stroke-opacity=".34" stroke-width="1.4"/>
    <circle cx="500" cy="500" r="466" fill="none" stroke="#8b6734" stroke-opacity=".2" stroke-width=".8"/>
    <circle cx="500" cy="500" r="452" fill="none" stroke="#8b6734" stroke-opacity=".26" stroke-width="1"/>
    ${tickMarks}
    ${clouds}
    ${corners}
  </g>`;
}

function buildTrack() {
  const tiles = [];
  for (let i = 0; i < TRACK_LEN; i += 1) {
    const tile = describeTile(i);
    const angle = trackAngle(i);
    const p = polar(angle, TRACK_RADIUS);
    const glyph = tileGlyph(i);
    const sub = tileSubGlyph(tile);
    const fill = tileFillStyle(tile);
    const glyphColor =
      tile.type === 'start' || tile.type === 'flight'
        ? '#fff9ed'
        : tile.type === 'gate'
          ? 'var(--cinnabar)'
          : 'rgba(67,52,35,.6)';
    const aria =
      tile.type === 'start'
        ? `${VIRTUE_BY_SEAT[tile.owner].name}启程台`
        : tile.type === 'gate'
          ? `${VIRTUE_BY_SEAT[tile.owner].name}归门`
          : tile.type === 'flight'
            ? `${VIRTUE_BY_SEAT[tile.owner].name}御风台`
            : `外圈第 ${i + 1} 格`;

    tiles.push(`<g class="b-track-tile ${tileClass(tile)}" data-ring="${i}" data-type="${tile.type}" data-owner="${tile.owner ?? ''}" aria-label="${aria}">
      <g transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})">
        <rect x="-21" y="-27" width="42" height="54" rx="8" class="tile-shadow" transform="translate(0 2)"/>
        <rect x="-21" y="-27" width="42" height="54" rx="8" class="tile-face" ${fill}/>
        <rect x="-16.5" y="-22.5" width="33" height="45" rx="4.5" class="tile-inner"/>
        <circle cx="0" cy="-20" r="2.1" class="tile-notch" ${tile.type === 'start' || tile.type === 'flight' ? `fill="${tile.type === 'start' ? 'rgba(255,249,237,.7)' : 'rgba(255,249,237,.55)'}"` : ''}/>
        ${tile.type === 'flight' ? `<path d="M-9 -4c3-4 7-5 11-3 2 1 3 3 3 5 0 4-4 6-8 4" fill="none" stroke="rgba(255,249,237,.6)" stroke-width="1" stroke-linecap="round"/>` : ''}
      </g>
      <text x="${p.x.toFixed(2)}" y="${(p.y + 4.5).toFixed(2)}" class="tile-glyph" style="fill:${glyphColor}">${glyph}</text>
      ${sub ? `<text x="${p.x.toFixed(2)}" y="${(p.y + 16).toFixed(2)}" class="tile-subglyph">${sub}</text>` : ''}
    </g>`);
  }

  const directions = [22.5, 112.5, 202.5, 292.5]
    .map((angle) => {
      const p = polar(angle, 370);
      return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)})" class="b-direction">
        <path d="M-5 -4 2 0l-7 4z"/>
      </g>`;
    })
    .join('');

  return `<g>
    <circle cx="500" cy="500" r="400" fill="none" stroke="#8b6734" stroke-opacity=".16" stroke-width="1" class="b-track-guide"/>
    ${tiles.join('')}
    ${directions}
  </g>`;
}

function buildHomeLanes() {
  const lanes = [];
  for (const v of VIRTUES) {
    const angle = v.gateAngle;
    const start = polar(angle, 372);
    const end = polar(angle, 126);
    const cells = HOME_RADII.map((radius, idx) => {
      const p = polar(angle, radius);
      const dim = idx === 0 ? 1 : 0.9 - idx * 0.04;
      return `<g class="lane-cell-group" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle})">
        <rect x="-22" y="-21" width="44" height="42" rx="7" class="lane-cell" style="fill:${v.hex};fill-opacity:${0.26 * dim}"/>
        <rect x="-17.5" y="-16.5" width="35" height="33" rx="4" class="lane-cell-inner"/>
        <path d="M0 -8v12M-4 1l4 5 4-5" class="lane-arrow"/>
      </g>`;
    }).join('');

    const labelPos = polar(angle, 355);
    lanes.push(`<g class="b-home-lane" style="--lane-color:${v.hex}">
      <line x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" stroke="${v.hex}" stroke-opacity=".1" stroke-width="50" stroke-linecap="round"/>
      <line x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" class="lane-rail"/>
      ${cells}
      <text x="${labelPos.x.toFixed(1)}" y="${(labelPos.y + 4).toFixed(1)}" class="lane-label" transform="rotate(${angle} ${labelPos.x.toFixed(1)} ${labelPos.y.toFixed(1)})">归途</text>
    </g>`);
  }
  return `<g>${lanes.join('')}</g>`;
}

function buildHangars() {
  return `<g>${VIRTUES.map((v) => {
    const c = hangarCenter(v.seat);
    return `<g class="b-hangar" data-seat="${v.seat}" transform="translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})" style="--seat-color:${v.hex}">
      <rect x="-75" y="-68" width="150" height="136" rx="12" class="hangar-shadow" transform="translate(0 3)"/>
      <rect x="-75" y="-68" width="150" height="136" rx="12" class="hangar-plate"/>
      <rect x="-75" y="-68" width="150" height="136" rx="12" class="hangar-tint" style="fill:${v.hex}"/>
      <rect x="-69" y="-62" width="138" height="124" rx="8" class="hangar-border"/>
      <rect x="-75" y="-68" width="150" height="23" rx="11" fill="${v.hex}" fill-opacity=".9"/>
      <rect x="-69" y="-63" width="138" height="13" rx="6" fill="none" stroke="#fff8ea" stroke-opacity=".3" stroke-width=".7"/>
      <text y="-51" class="hangar-name" style="fill:#fff9ed">${v.name}</text>
      <text y="-34" class="hangar-sub">${v.motto}</text>
      ${HANGAR_PADS.map(
        ([dx, dy], i) => `<g transform="translate(${dx} ${dy})">
          <rect x="-16" y="-13" width="32" height="26" rx="6" class="hangar-pad idle" data-pad="${v.seat}-${i}" style="fill:${v.hex};fill-opacity:.08" stroke="${v.hex}" stroke-opacity=".35"/>
          <path d="M0 -7 7 0 0 7-7 0Z" fill="none" stroke="${v.hex}" stroke-opacity=".2" stroke-width=".8"/>
        </g>`,
      ).join('')}
      <text y="59" class="hangar-count">四鸢归殿</text>
      <circle cx="0" cy="0" r="78" class="hangar-glow"/>
    </g>`;
  }).join('')}</g>`;
}

function buildHall() {
  const roofTicks = Array.from({ length: 32 }, (_, i) => {
    const a = (i * 360) / 32;
    const p1 = polar(a, 122);
    const p2 = polar(a, 144);
    const wide = i % 4 === 0;
    return `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="#d8b36e" stroke-opacity="${wide ? 0.44 : 0.22}" stroke-width="${wide ? 1.4 : 0.8}"/>`;
  }).join('');

  const brackets = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]
    .map((angle) => {
      const p = polar(angle, 132);
      return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle})" opacity=".72">
        <path d="M-9 -7h18v5H-9zM-14 2h28M-11 8h22" fill="none" stroke="#e3c98e" stroke-width="1.3" stroke-linecap="round"/>
      </g>`;
    })
    .join('');

  const finishSlots = VIRTUES.map((v) => {
    const angle = v.gateAngle;
    const p = polar(angle, FINISH_RADIUS);
    return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle})">
      <path d="M-16 -11 0 -18l16 7v22l-16 7-16-7Z" fill="${v.hex}" fill-opacity=".2" stroke="${v.hex}" stroke-opacity=".5" stroke-width=".9"/>
      <path d="M-9 0h18M0 -8v16" stroke="${v.hex}" stroke-opacity=".42" stroke-width=".8"/>
    </g>`;
  }).join('');

  const doors = [0, 90, 180, 270]
    .map((angle) => {
      const p = polar(angle, 133);
      return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle})">
        <rect x="-27" y="-17" width="54" height="34" fill="#f1e5d1" stroke="#8b6734" stroke-opacity=".3" stroke-width=".8"/>
        <path d="M-18 10V-8M18 10V-8M-18 -8h36" fill="none" stroke="#b88a44" stroke-opacity=".42" stroke-width=".8"/>
      </g>`;
    })
    .join('');

  return `<g class="b-hall">
    <circle cx="500" cy="500" r="152" fill="#d6c09f" fill-opacity=".35"/>
    <circle cx="500" cy="500" r="150" fill="url(#hallGrad)" stroke="#8b6734" stroke-opacity=".32" stroke-width="1.2"/>
    <circle cx="500" cy="500" r="145" fill="none" stroke="#8b6734" stroke-opacity=".16" stroke-width=".8"/>
    <circle cx="500" cy="500" r="146" fill="#4b2f24" fill-opacity=".96" stroke="#b88a44" stroke-opacity=".45" stroke-width="1.2"/>
    <circle cx="500" cy="500" r="116" fill="#f4ead8" stroke="#8b6734" stroke-opacity=".42" stroke-width="1.2"/>
    <circle cx="500" cy="500" r="120" fill="none" stroke="#d8b36e" stroke-opacity=".4" stroke-width="1" stroke-dasharray="2 5"/>
    ${roofTicks}
    ${brackets}
    ${doors}
    <path d="M500 382v-14M500 618v14M382 500h-14M618 500h14" stroke="#b88a44" stroke-opacity=".35" stroke-width="1"/>
    <path d="M402 500h-16M598 500h16M500 402v-16M500 598v16" stroke="#b88a44" stroke-opacity=".2" stroke-width=".8"/>
    ${finishSlots}
    <rect x="464" y="356" width="72" height="22" rx="2" fill="#201a15" stroke="#b88a44" stroke-opacity=".6" stroke-width=".8"/>
    <text x="500" y="371" class="hall-plaque-text" style="fill:#ead6ad">大成殿</text>
    <rect x="468" y="468" width="64" height="64" rx="3" fill="none" stroke="#8b6734" stroke-opacity=".28" stroke-width=".8"/>
    <rect x="477" y="477" width="46" height="46" rx="2" fill="#a3382e" stroke="rgba(255,246,228,.48)" stroke-width="1"/>
    <text x="500" y="501" class="hall-seal-text" style="font-size:23px">信</text>
    <path d="M420 454c-13-8-15-22-4-31M580 546c13 8 15 22 4 31" fill="none" stroke="#d8b36e" stroke-opacity=".2" stroke-width="1" stroke-linecap="round"/>
    <path d="M432 554c-8 13-22 15-31 4M568 446c8-13 22-15 31-4" fill="none" stroke="#d8b36e" stroke-opacity=".18" stroke-width="1" stroke-linecap="round"/>
  </g>`;
}

function buildTokens() {
  return `<g class="token-layer">${VIRTUES.map((v) =>
    Array.from({ length: 4 }, (_, i) => {
      const id = `${v.seat}-${i}`;
      return `<g class="token" data-piece="${id}" data-seat="${v.seat}" data-index="${i}" style="transform:translate(0px,0px)">
        <g class="token-inner" filter="url(#tokenShadow)">
          <ellipse cx="0" cy="19" rx="12" ry="3.8" class="token-shadow"/>
          <path d="M0 -22C8 -13 13 -5 14 1 10 10 5 17 0 22-5 17-10 10-14 1-13 -5-8 -13 0 -22Z" class="token-body" fill="url(#tokenGrad${v.seat})"/>
          <path d="M0 -17C5 -10 9 -4 9.5 1 7 8 3 14 0 17-3 14-7 8-9.5 1-9 -4-5 -10 0 -17Z" class="token-frame"/>
          <path d="M0 21c-2 7 4 9 6 12 1 3-3 5-6 2" class="token-tail" stroke="${v.deep}"/>
          <text x="0" y="1.5" class="token-char">${v.char}</text>
          <circle cx="0" cy="-22" r="1.8" fill="${v.soft}" stroke="rgba(255,250,240,.5)" stroke-width=".6"/>
        </g>
        <circle class="token-halo" r="23" stroke="${v.deep}"/>
      </g>`;
    }),
  ).join('')}</g>`;
}

function buildSvg() {
  return `<svg class="board-svg" viewBox="0 0 1000 1000" role="group" aria-label="大成玉盘棋盘">
    ${buildDefs()}
    <rect x="10" y="10" width="980" height="980" rx="26" class="b-panel"/>
    <rect x="18" y="18" width="964" height="964" rx="22" class="b-panel-inner"/>
    <rect x="26" y="26" width="948" height="948" rx="18" class="b-panel-fine"/>
    ${buildBorder()}
    ${buildTrack()}
    ${buildHomeLanes()}
    ${buildHangars()}
    ${buildHall()}
    <g class="highlight-layer"></g>
    ${buildTokens()}
  </svg>`;
}

export class Board {
  constructor(container, { preview = false, onTokenSelect = null } = {}) {
    this.container = container;
    this.preview = preview;
    this.onTokenSelect = onTokenSelect;
    this.svg = null;
    this.tokenEls = new Map();
    this.highlightLayer = null;
    this.positions = new Map();
    this.state = null;
    this.viewerSeat = null;
    this.hasRendered = false;
    this.animating = false;
    this._build();
  }

  _build() {
    this.container.innerHTML = buildSvg();
    this.svg = this.container.querySelector('svg');
    this.highlightLayer = this.svg.querySelector('.highlight-layer');
    for (const el of this.svg.querySelectorAll('.token')) {
      this.tokenEls.set(el.dataset.piece, el);
      el.setAttribute('role', this.preview ? 'presentation' : 'img');
      el.setAttribute('aria-label', '纸鸢');
    }
    if (!this.preview) {
      this.svg.addEventListener('click', (event) => {
        const token = event.target.closest('.token');
        if (!token || !token.classList.contains('is-legal')) return;
        this.onTokenSelect?.(token.dataset.piece);
      });
      this.svg.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const token = event.target.closest('.token');
        if (!token || !token.classList.contains('is-legal')) return;
        event.preventDefault();
        this.onTokenSelect?.(token.dataset.piece);
      });
    }
  }

  setCanAct(canAct) {
    this.canAct = Boolean(canAct);
    if (!this.state) return;
    this._syncInteractivity();
  }

  _syncInteractivity() {
    for (const [id, el] of this.tokenEls) {
      const legal = el.classList.contains('is-legal');
      const selectable = legal && this.canAct;
      el.style.pointerEvents = selectable ? 'all' : 'none';
      if (!this.preview) {
        el.setAttribute('role', selectable ? 'button' : 'img');
        el.setAttribute('tabindex', selectable ? '0' : '-1');
        if (selectable) el.setAttribute('aria-label', `${this._tokenLabel(id)}，可点击行棋`);
        else el.setAttribute('aria-label', this._tokenLabel(id));
      }
    }
  }

  _tokenLabel(pieceId) {
    const [seatStr, index] = pieceId.split('-');
    const seat = Number(seatStr);
    const player = this.state?.players?.find((p) => p.seat === seat);
    const piece = player?.pieces?.find((p) => p.index === Number(index));
    const virtue = VIRTUE_BY_SEAT[seat];
    if (!piece) return `${virtue?.name || '学宫'}纸鸢`;
    const where =
      piece.progress < 0
        ? '学宫'
        : piece.progress >= FINISH_PROGRESS
          ? '大成殿'
          : piece.progress > GATE_PROGRESS
            ? `归途第 ${piece.progress - GATE_PROGRESS} 格`
            : piece.progress === GATE_PROGRESS
              ? '归门'
              : `外圈第 ${progressToRing(seat, piece.progress) + 1} 格`;
    return `${virtue?.name || '学宫'} ${Number(index) + 1} 号纸鸢，位于${where}`;
  }

  _positionsForState(state) {
    const positions = new Map();
    const groups = new Map();
    for (const player of state.players || []) {
      const seat = player.seat;
      for (const piece of player.pieces) {
        let key;
        let base;
        let scale = 1;
        if (piece.progress < 0) {
          base = hangarPoint(seat, piece.index);
          positions.set(piece.id, { ...base, scale: 0.94, group: null });
          continue;
        }
        if (piece.progress >= FINISH_PROGRESS) {
          base = finishPoint(seat, piece.index);
          positions.set(piece.id, { ...base, scale: 0.62, group: null });
          continue;
        }
        if (piece.progress > GATE_PROGRESS) {
          key = `h${seat}-${piece.progress}`;
          base = homePoint(seat, piece.progress);
          scale = 1.02;
        } else {
          key = `t${progressToRing(seat, piece.progress)}`;
          base = trackPoint(seat, piece.progress);
          scale = 1.1;
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ id: piece.id, base, scale });
      }
    }
    for (const members of groups.values()) {
      const offsets = stackOffsets(members.length);
      const crowdScale = members.length > 1 ? Math.max(0.76, 1 - (members.length - 1) * 0.08) : 1;
      members.forEach((member, i) => {
        const [dx, dy] = offsets[i];
        positions.set(member.id, {
          x: member.base.x + dx,
          y: member.base.y + dy,
          scale: member.scale * crowdScale,
          group: members.length,
        });
      });
    }
    return positions;
  }

  update(state, { viewerSeat = null, canAct = false } = {}) {
    this.state = state;
    this.viewerSeat = viewerSeat;
    this.canAct = canAct;
    const players = new Map((state.players || []).map((p) => [p.seat, p]));
    const legalIds = new Set((state.legalMoves || []).map((m) => m.pieceId));

    for (const el of this.svg.querySelectorAll('.b-hangar')) {
      el.classList.toggle('is-current', Number(el.dataset.seat) === state.currentSeat);
    }

    for (const [id, el] of this.tokenEls) {
      const [seatStr] = id.split('-');
      const seat = Number(seatStr);
      const player = players.get(seat);
      if (!player) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.classList.toggle('is-legal', legalIds.has(id) && canAct);
      el.classList.toggle('is-mine', seat === viewerSeat);
      el.classList.toggle('is-finished', this._pieceProgress(id) >= FINISH_PROGRESS);
      el.classList.remove('is-moving', 'is-returning');
    }

    const positions = this._positionsForState(state);
    this.positions = positions;
    for (const [id, pos] of positions) {
      const el = this.tokenEls.get(id);
      if (!el) continue;
      this._setTransform(el, pos.x, pos.y, pos.scale, this.hasRendered ? 0.32 : 0, !this.hasRendered);
    }
    this.hasRendered = true;
    this._renderHighlights(state);
    this._syncInteractivity();
    for (const [id, el] of this.tokenEls) el.setAttribute('aria-label', this._tokenLabel(id));
  }

  _pieceProgress(id) {
    const [seatStr, indexStr] = id.split('-');
    const player = this.state?.players?.find((p) => p.seat === Number(seatStr));
    return player?.pieces?.find((p) => p.index === Number(indexStr))?.progress ?? -1;
  }

  _setTransform(el, x, y, scale = 1, duration = 0.2, immediate = false) {
    if (immediate || duration <= 0) {
      el.style.transition = 'none';
      el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      // 强制回流，避免下一帧仍然无过渡
      void el.getBoundingClientRect();
      el.style.transition = 'transform .22s var(--ease)';
      return;
    }
    el.style.transition = `transform ${duration}s var(--ease)`;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  _renderHighlights(state) {
    if (this.preview) {
      this.highlightLayer.innerHTML = '';
      return;
    }
    const seen = new Set();
    const marks = [];
    for (const move of state.legalMoves || []) {
      const key = `${move.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let point;
      let radius = 25;
      if (move.target >= FINISH_PROGRESS) {
        point = finishPoint(move.seat, 1.5);
        radius = 17;
      } else if (move.target > GATE_PROGRESS) {
        point = homePoint(move.seat, move.target);
        radius = 21;
      } else {
        point = trackPoint(move.seat, move.target);
      }
      marks.push(`<g class="b-target is-visible" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})">
        <circle r="${radius + 3}" class="target-fill"/>
        <circle r="${radius}" class="target-ring"/>
        <circle r="3" class="target-pip"/>
      </g>`);
    }
    this.highlightLayer.innerHTML = marks.join('');
  }

  _centerForProgress(seat, progress) {
    if (progress < 0) return hangarPoint(seat, 0);
    if (progress >= FINISH_PROGRESS) return finishPoint(seat, 1.5);
    if (progress > GATE_PROGRESS) return homePoint(seat, progress);
    return trackPoint(seat, progress);
  }

  _animateArc(el, from, to, { duration = 620, height = 58, scale = 1 } = {}) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const cx = (from.x + to.x) / 2 + nx * height;
    const cy = (from.y + to.y) / 2 + ny * height;
    const start = performance.now();
    el.style.transition = 'none';
    return new Promise((resolve) => {
      const frame = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        const x = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * cx + e ** 2 * to.x;
        const y = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * cy + e ** 2 * to.y;
        const s = scale + Math.sin(e * Math.PI) * 0.16;
        el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  async animateMove(move, stateBefore, stateAfter, { onStep = null } = {}) {
    const el = this.tokenEls.get(move.pieceId);
    if (!el) return;
    this.animating = true;
    el.classList.add('is-moving');
    el.style.transition = 'none';
    this.svg.appendChild(el);

    const from = this._centerForProgress(move.seat, move.from);
    const finalPoint = this._centerForProgress(move.seat, move.target);
    let current = from;

    if (move.from < 0) {
      const start = hangarPoint(move.seat, move.pieceIndex || 0);
      el.style.transform = `translate(${start.x}px, ${start.y}px) scale(1.04)`;
      await this._animateArc(el, start, trackPoint(move.seat, 0), { duration: 620, height: 70 });
      current = trackPoint(move.seat, 0);
      onStep?.({ progress: 0, type: 'launch' });
      await sleep(80);
    } else {
      const beforePos = this.positions.get(move.pieceId) || from;
      el.style.transform = `translate(${beforePos.x}px, ${beforePos.y}px) scale(${beforePos.scale || 1})`;
      await sleep(20);
      for (const step of move.steps) {
        const point = this._centerForProgress(move.seat, step);
        this._setTransform(el, point.x, point.y, 1, 0.15);
        current = point;
        onStep?.({ progress: step, type: step > GATE_PROGRESS ? 'home' : 'track' });
        await sleep(165);
      }
    }

    if (move.effect) {
      const effectFrom = this._centerForProgress(move.seat, move.effect.from);
      const effectTo = this._centerForProgress(move.seat, move.effect.to);
      el.classList.add('is-flying');
      await this._animateArc(el, effectFrom, effectTo, {
        duration: 720,
        height: move.effect.type === 'fly' ? 110 : 48,
        scale: 1.18,
      });
      el.classList.remove('is-flying');
      current = effectTo;
    }

    this._setTransform(el, finalPoint.x, finalPoint.y, 1, 0.16);
    await sleep(140);

    if (move.captures?.length) {
      for (const capture of move.captures) {
        const captured = this.tokenEls.get(capture.pieceId);
        if (captured) captured.classList.add('is-returning');
      }
      await sleep(430);
      for (const capture of move.captures) {
        const captured = this.tokenEls.get(capture.pieceId);
        if (captured) {
          captured.classList.remove('is-returning');
          captured.classList.add('is-returned');
          setTimeout(() => captured.classList.remove('is-returned'), 900);
        }
      }
    }

    if (move.target >= FINISH_PROGRESS) {
      el.classList.add('is-finished');
      await sleep(180);
    }

    el.classList.remove('is-moving');
    el.style.transition = 'transform .24s var(--ease)';
    this.animating = false;
    this.update(stateAfter, { viewerSeat: this.viewerSeat, canAct: this.canAct });
    return current;
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function demoBoardState() {
  const players = VIRTUES.map((v) => ({
    seat: v.seat,
    name: v.name,
    isBot: v.seat > 1,
    pieces: Array.from({ length: 4 }, (_, i) => ({ id: `${v.seat}-${i}`, index: i, progress: -1 })),
  }));
  const set = (seat, index, progress) => {
    players.find((p) => p.seat === seat).pieces[index].progress = progress;
  };
  set(0, 0, 0);
  set(0, 1, 22);
  set(0, 2, 47);
  set(0, 3, 56);
  set(1, 0, 6);
  set(1, 1, 30);
  set(1, 2, 18);
  set(1, 3, 56);
  set(2, 0, 11);
  set(2, 1, 41);
  set(2, 2, 26);
  set(2, 3, 56);
  set(3, 0, 18);
  set(3, 1, 34);
  set(3, 2, 9);
  set(3, 3, 56);
  return {
    phase: 'playing',
    activeSeats: [0, 1, 2, 3],
    currentSeat: 1,
    dice: 4,
    consecutiveSixes: 0,
    legalMoves: [],
    winnerSeat: null,
    turnNumber: 12,
    seq: 1,
    players,
    log: [],
  };
}
