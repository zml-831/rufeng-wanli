/**
 * 儒风万里 · 主程序
 * 负责首页、同屏/人机棋局、在线雅集与信息页的编排。
 */

import { MIN_PLAYERS, VIRTUES, VIRTUE_BY_SEAT } from '../shared/constants.js';
import {
  applyMove,
  createGame,
  gameSnapshot,
  passTurn,
  rollDice,
} from '../shared/game.js';
import { chooseAiMove, botName } from '../shared/ai.js';
import { quoteByText, QUOTES } from '../shared/quotes.js';
import { api, ApiError, RoomChannel } from './api.js';
import { Board, demoBoardState } from './board.js';
import { GameView } from './game-view.js';
import { AudioKit } from './audio.js';
import { storage } from './storage.js';
import { icon } from './icons.js';
import { heroScene, cultureArt, smallCloud } from './art.js';
import {
  closeModal,
  confirmDialog,
  copyText,
  escapeHtml,
  openModal,
  sleep,
  toast,
} from './ui.js';

const RANDOM_NAMES = [
  '温故',
  '知新',
  '见贤',
  '思齐',
  '乐山',
  '乐水',
  '观澜',
  '听松',
  '守中',
  '清和',
  '子衿',
  '竹隐',
  '杏坛客',
  '泮池生',
  '大成门下',
];

const CULTURE = [
  {
    key: 'lingxing',
    title: '棂星门',
    sub: 'LINGXING GATE',
    text: '传统孔庙多以棂星门作为进入庙庭的前导。棂星，古称天田星，寄托对孔子的尊崇。棋盘以“启程台”呼应这一道门。',
  },
  {
    key: 'dacheng',
    title: '大成殿',
    sub: 'HALL OF GREAT PERFECTION',
    text: '孔庙主殿。殿名取《孟子》“孔子之谓集大成”之意。棋盘中央以大成殿为归处，四德纸鸢在此会合。',
  },
  {
    key: 'dougong',
    title: '斗拱',
    sub: 'BRACKET SET',
    text: '中国传统木构建筑中承托屋檐的层叠构件，兼具结构与装饰之美。页面边角取其层叠意象，化作细线纹样。',
  },
  {
    key: 'huiwen',
    title: '回纹与云纹',
    sub: 'MEANDER & CLOUD',
    text: '回纹连续回环，寓意绵延长久；云纹流动舒展，寄意高远。二者被用作棋盘边饰与御风台的视觉线索。',
  },
  {
    key: 'kite',
    title: '纸鸢',
    sub: 'PAPER KITE',
    text: '风筝古称纸鸢，相传起源于春秋时期，是流传久远的游艺。游戏以纸鸢代棋，取“御风而行”的轻盈。',
  },
  {
    key: 'virtues',
    title: '仁义礼智',
    sub: 'FOUR VIRTUES',
    text: '仁、义、礼、智是儒家重要的德目；四德之外，以“信”贯之。棋盘中央的“信”印，是四席共同的归处。',
  },
];

const ABOUT_SECTIONS = [
  ['项目定位', '「儒风万里」是一件面向公众的孔子文化主题数字桌游。它把飞行棋的轻快规则与孔庙建筑纹样、《论语》箴言放在同一张棋盘上，希望玩家在十五分钟的棋局里，对“仁义礼智信”有一次轻松而具体的相遇。'],
  ['设计原则', '所有建筑与纹样均为原创矢量绘制，取意而不摹写具体文物；不绘制孔子圣像，以建筑、礼器、纸鸢与文字意象致意。游戏不含抽卡、充值、广告、赌博或任何形式的付费随机内容。'],
  ['适龄提示', '建议 8 岁以上玩家游玩；6 岁以下儿童请在成人陪同下使用。在线模式仅使用昵称与房间号，不设自由聊天。'],
  ['技术说明', '前端为零依赖原生 ES Modules + SVG；服务端为 Node.js 原生 HTTP + Server-Sent Events。无第三方统计、无外部字体与图片请求，可私有化部署。'],
];

const PRIVACY_TEXT = [
  ['我们收集什么', '在线模式仅在你主动创建或加入房间时处理一个昵称、一个房间号，以及维持对局所需的最小状态。昵称会显示给同房间玩家；房间号用于邀请。'],
  ['我们不收集什么', '不要求注册、手机号、邮箱、身份证或支付信息；不接入第三方统计、广告或社交 SDK；不读取通讯录、位置、相机或麦克风。'],
  ['存储在哪里', '昵称与音效偏好保存在你的浏览器 localStorage 中，可随时清除；在线房间状态只保存在服务器内存中，服务重启即清空，最长 3 小时自动散场。登录凭据使用 HttpOnly、SameSite=Strict Cookie，脚本无法读取。'],
  ['你的选择', '你可以使用“同屏对弈”或“人机问道”完全离线游玩；也可以随时离开雅集，服务器会移除你的席位（对局中离开则由机巧托管至本局结束）。如需清除本地数据，清除本站站点数据即可。'],
];

const RULES_ROWS = [
  ['四鸢归殿', '每位玩家执四枚纸鸢。率先让四枚纸鸢全部踏入大成殿者获胜。'],
  ['二四六启程', '掷出 2、4、6 点，可让一枚纸鸢从学宫启程至启程台；掷出 6 点后可再掷一次。连续掷出三次 6，本轮行毕即礼让下席。'],
  ['顺时针行棋', '按骰子点数沿外圈顺时针行进。行至自己的归门后转入归途，归途共五格，最后一步踏入大成殿。'],
  ['同色拾级', '落在与自己同色的普通格上，可再前进 4 格。奖励只结算一次，不连锁触发。'],
  ['御风而行', '落在自己的御风台上，可前进 12 格。御风台以云纹标示，每席两处。'],
  ['折返学宫', '落在对手纸鸢所在格时，对手纸鸢折返学宫，重整衣冠。己方纸鸢可以同格叠放。'],
  ['启程台与归门', '四座启程台（亦称礼门）与四座归门为安全格，不发生折返。归途内也不会被折返。'],
  ['精确归殿', '踏入大成殿所需点数必须精确；点数过大时，该枚纸鸢本轮不可行。若全部纸鸢都无路可走，则轮空。'],
];

function normalizeClientName(raw) {
  let name = String(raw ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
  const len = [...name].length;
  if (len < 2) throw new Error('称呼请填 2–12 个字。');
  if (len > 12) throw new Error('称呼最多 12 个字。');
  if (/[<>/\\]|https?:|www\./i.test(name)) throw new Error('称呼中不能包含链接或特殊符号。');
  if (!/^[\p{L}\p{N}·_\- ]+$/u.test(name)) throw new Error('称呼仅支持文字、数字、空格与 · _ -。');
  return name;
}

function randomName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

function activeSeatsFor(count, mode) {
  if (mode === 'ai') {
    if (count === 1) return [0, 2];
    if (count === 2) return [0, 1, 2];
    return [0, 1, 2, 3];
  }
  if (count === 2) return [0, 2];
  if (count === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

function seatStyle(seat) {
  return `--seat-color:${VIRTUE_BY_SEAT[seat].hex}`;
}

export class App {
  constructor(root) {
    this.root = root;
    this.audio = new AudioKit({ enabled: storage.sound });
    this.screen = 'home';
    this.profile = storage.name || '';
    this.heroBoard = null;
    this.view = null;
    this.local = null;
    this.online = null;
    this.channel = null;
    this.lastOnlineVersion = 0;
    this.lastMoveSeq = 0;
    this.snapshotChain = Promise.resolve();
    this.localTimer = null;
    this.localGeneration = 0;
    this.actionBusy = false;
    this.autoMoveTimer = null;
    this._unlockAudio = this._unlockAudio.bind(this);
    document.addEventListener('pointerdown', this._unlockAudio, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.online?.room?.code) this.resyncOnline();
    });
  }

  async resyncOnline() {
    if (!this.online?.room?.code) return;
    try {
      const response = await api.state(this.online.room.code);
      this._onSnapshot(response);
    } catch {
      /* 下一次 SSE 重连会补齐；这里静默失败 */
    }
  }

  _unlockAudio() {
    this.audio.ensure();
  }

  start() {
    const room = new URLSearchParams(location.search).get('room');
    this.renderHome();
    this.audio.setScene('home');
    if (room) this.tryResume(room.trim().toUpperCase());
  }

  // ------------------------------------------------------------------------
  // 通用
  // ------------------------------------------------------------------------

  _setRoot(html) {
    this.root.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  _soundButton(className = 'btn-icon') {
    const enabled = this.audio.enabled;
    return `<button type="button" class="${className}" data-act="sound" aria-label="${enabled ? '关闭音效' : '开启音效'}" aria-pressed="${enabled}">${icon(enabled ? 'sound' : 'mute')}</button>`;
  }

  _setSoundUI() {
    for (const button of document.querySelectorAll('[data-act="sound"]')) {
      button.innerHTML = icon(this.audio.enabled ? 'sound' : 'mute');
      button.setAttribute('aria-pressed', String(this.audio.enabled));
      button.setAttribute('aria-label', this.audio.enabled ? '关闭音效' : '开启音效');
    }
    this.view?.setSoundState?.(this.audio.enabled);
  }

  toggleSound() {
    const enabled = !this.audio.enabled;
    storage.sound = enabled;
    this.audio.setEnabled(enabled);
    if (enabled) this.audio.ensure();
    this._setSoundUI();
    toast(enabled ? '已开启雅乐与音效' : '已静音', { tone: 'info', duration: 1800, iconName: enabled ? 'sound' : 'mute' });
  }

  _formatError(error) {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error) return error.message;
    return '发生了一点小意外，请稍后再试。';
  }

  _confirm(message, options = {}) {
    return confirmDialog({ message, ...options });
  }

  _shareOrCopy(text, title = '儒风万里') {
    if (navigator.share) {
      navigator
        .share({ title, text })
        .catch(() => copyText(text).then((ok) => ok && toast('已复制到剪贴板', { tone: 'success' })));
    } else {
      copyText(text).then((ok) => toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择链接', { tone: ok ? 'success' : 'error' }));
    }
  }

  // ------------------------------------------------------------------------
  // 首页
  // ------------------------------------------------------------------------

  renderHome() {
    this._teardownGame();
    this._closeChannel();
    this.online = null;
    this.screen = 'home';
    this.resultGameSeq = null;
    this.snapshotChain = Promise.resolve();
    this.audio.setScene('home');
    history.replaceState({}, '', location.pathname);
    storage.session = null;
    const quote = QUOTES[0] || { text: '学而时习之，不亦说乎？', source: '《论语·学而》' };
    this._setRoot(`<div class="home">
      <div class="home-atmosphere">
        ${heroScene()}
        <div class="home-vignette"></div>
        <div class="home-moon-glow"></div>
        <div class="home-grain"></div>
        <div class="home-dust"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="home-cloud c1">${smallCloud()}</div>
        <div class="home-cloud c2">${smallCloud()}</div>
        <div class="hero-vertical-note">礼乐射御书数 · 六艺之教</div>
      </div>
      <header class="home-nav on-dark">
        <a class="brand" href="/" aria-label="儒风万里首页">
          <span class="brand-seal">儒</span>
          <span class="brand-text"><strong>儒风万里</strong><small>孔子文化 · 主题飞行棋</small></span>
        </a>
        <nav class="home-nav-links" aria-label="主导航">
          <button type="button" data-open="rules">玩法</button>
          <button type="button" data-open="culture">文化</button>
          <button type="button" data-open="about">关于</button>
        </nav>
        <div class="home-nav-actions">
          ${this._soundButton()}
          <button type="button" class="btn btn-ghost btn-sm" data-open="online">${icon('wifi')}<span>在线雅集</span></button>
        </div>
      </header>

      <main>
        <section class="hero">
          <div class="hero-copy">
            <p class="hero-eyebrow">孔子文化 · 多人飞行棋</p>
            <div class="hero-title-row">
              <h1 class="hero-title">儒风万里</h1>
              <div class="hero-seal" aria-hidden="true"><span>以</span><span>棋</span><span>会</span><span>友</span></div>
            </div>
            <p class="hero-subtitle">仁 · 义 · 礼 · 智，四德为翼</p>
            <p class="hero-lede">掷骰启程，御风而行。在孔庙纹样与《论语》箴言之间，与亲友共赴一局从容的儒林棋会。无需注册，打开即玩。</p>
            <div class="hero-actions">
              <button type="button" class="btn btn-primary btn-lg" data-open="local">${icon('users')}<span>同屏对弈</span></button>
              <button type="button" class="btn btn-gold btn-lg" data-open="online">${icon('wifi')}<span>在线雅集</span></button>
              <button type="button" class="btn btn-ghost btn-lg" data-open="ai">${icon('bot')}<span>人机问道</span></button>
            </div>
            <ul class="hero-meta">
              <li>2–4 人同乐</li>
              <li>无需注册</li>
              <li>原创国风绘制</li>
              <li>约 10–20 分钟</li>
            </ul>
          </div>

          <div class="hero-board-wrap">
            <div class="hero-board-frame">
              <div class="hero-board" id="hero-board"></div>
              <div class="hero-board-plaque"></div>
              <div class="hero-board-caption">
                <span class="quote-mark">「</span>
                <p>${escapeHtml(quote.text)}</p>
                <small>${escapeHtml(quote.source)}</small>
                <span class="seal">信</span>
              </div>
            </div>
          </div>
        </section>

        <div class="hero-foot">
          <div class="hero-foot-inner">
            <div class="hero-foot-item">${icon('users')}<div><strong>四席同屏</strong><span>一台设备，轮流落子</span></div></div>
            <div class="hero-foot-item">${icon('wifi')}<div><strong>在线雅集</strong><span>分享房间号，异地同局</span></div></div>
            <div class="hero-foot-item">${icon('bot')}<div><strong>机巧问道</strong><span>一人开局，机巧作陪</span></div></div>
            <div class="hero-foot-item">${icon('shield')}<div><strong>轻量安心</strong><span>无广告 · 无充值 · 无统计</span></div></div>
          </div>
        </div>

        <div class="home-content" id="home-content">
          <section class="home-section">
            <div class="section-head">
              <div>
                <p class="eyebrow left-only">一局棋里的孔庙</p>
                <h2>取意于建筑，落子于四德</h2>
              </div>
              <p>不是对任何一座孔庙的测绘复原，而是把棂星门、大成殿、斗拱、回纹与云纹，化作棋盘上的秩序与节奏。</p>
            </div>
            <div class="culture-grid">
              ${CULTURE.slice(0, 4)
                .map(
                  (item, index) => `<article class="culture-card">
                    <span class="culture-index">0${index + 1}</span>
                    <div class="culture-art">${cultureArt(item.key)}</div>
                    <h3>${item.title}</h3>
                    <p class="culture-sub">${item.sub}</p>
                    <p>${item.text}</p>
                  </article>`,
                )
                .join('')}
            </div>
          </section>

          <section class="home-section">
            <div class="section-head">
              <div>
                <p class="eyebrow left-only">行棋四步</p>
                <h2>从启程，到归殿</h2>
              </div>
              <p>规则轻，礼数足。第一次上手的玩家，也能在两三次掷骰后找到自己的节奏。</p>
            </div>
            <div class="steps-grid">
              <article class="step-item"><span class="step-no">壹 <small>启程</small></span><h3>二四六启程</h3><p>掷出 2、4、6 点，让一枚纸鸢从学宫落至启程台；六点之后，还可再掷一次。</p></article>
              <article class="step-item"><span class="step-no">贰 <small>行棋</small></span><h3>同色拾级</h3><p>落在自己的颜色上，拾级四步；落在自己的御风台，借云直上十二步。</p></article>
              <article class="step-item"><span class="step-no">叁 <small>归途</small></span><h3>过门而入</h3><p>行过归门，转入归途。五格归途之后，需以精确点数踏入大成殿。</p></article>
              <article class="step-item"><span class="step-no">肆 <small>礼成</small></span><h3>四鸢归殿</h3><p>率先让四枚纸鸢全部归殿者获胜。途中与他席相遇，请对手折返学宫。</p></article>
            </div>
          </section>

          <section class="home-section">
            <div class="section-head">
              <div>
                <p class="eyebrow left-only">以棋会友</p>
                <h2>今夕何夕，共此一局</h2>
              </div>
              <p>“有朋自远方来，不亦乐乎？”把房间号发给朋友，或把设备放在茶几中央，都算一场雅集。</p>
            </div>
            <div class="hero-actions" style="margin-top:26px">
              <button type="button" class="btn btn-primary" data-open="local">${icon('users')}现在开局</button>
              <button type="button" class="btn btn-ghost" data-open="rules">${icon('rules')}先读规则</button>
              <button type="button" class="btn btn-ghost" data-open="culture">${icon('scroll')}文化图鉴</button>
            </div>
          </section>
        </div>

        <footer class="home-footer">
          <div class="home-footer-inner">
            <div>
              <a class="brand" href="/" aria-label="儒风万里首页">
                <span class="brand-seal">儒</span>
                <span class="brand-text"><strong>儒风万里</strong><small>孔子文化 · 主题飞行棋</small></span>
              </a>
              <p>以孔庙建筑与《论语》公版文本为文化线索，全部视觉为原创绘制。愿这一局棋，让古老的话头在今天的桌面上重新响起。</p>
              <div class="tag-row" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">
                <span class="tag gold">8+ 适龄</span><span class="tag">无广告</span><span class="tag">无充值</span><span class="tag">无第三方统计</span>
              </div>
            </div>
            <div class="footer-col"><h4>棋局</h4><ul>
              <li><button type="button" data-open="local">同屏对弈</button></li>
              <li><button type="button" data-open="online">在线雅集</button></li>
              <li><button type="button" data-open="ai">人机问道</button></li>
              <li><button type="button" data-open="rules">玩法说明</button></li>
            </ul></div>
            <div class="footer-col"><h4>文化</h4><ul>
              <li><button type="button" data-open="culture">文化图鉴</button></li>
              <li><button type="button" data-open="about">项目说明</button></li>
              <li><button type="button" data-open="privacy">隐私与数据</button></li>
              <li><button type="button" data-open="about">版权与素材</button></li>
            </ul></div>
          </div>
          <div class="footer-legal">
            <span>© 2026 儒风万里项目组 · 文化主题原创作品 · 非宗教活动、非商业赌博</span>
            <span class="legal-links"><button type="button" data-open="privacy">隐私说明</button><button type="button" data-open="about">适龄提示</button><span>建议 8 岁以上游玩</span></span>
          </div>
        </footer>
      </main>
    </div>`);

    const heroBoardEl = this.root.querySelector('#hero-board');
    if (heroBoardEl) {
      this.heroBoard = new Board(heroBoardEl, { preview: true });
      this.heroBoard.update(demoBoardState());
    }
    this._setSoundUI();
    this.root.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => {
        const target = el.dataset.open;
        if (target === 'online') this.openOnlineModal();
        else if (target === 'local' || target === 'ai') this.openLocalSetup(target);
        else this.openInfoModal(target);
      });
    });
    this.root.querySelectorAll('[data-act="sound"]').forEach((el) => el.addEventListener('click', () => this.toggleSound()));
    this.root.querySelectorAll('a[href="/"]').forEach((el) =>
      el.addEventListener('click', (event) => {
        event.preventDefault();
        this.renderHome();
      }),
    );
  }

  // ------------------------------------------------------------------------
  // 同屏 / 人机
  // ------------------------------------------------------------------------

  openLocalSetup(mode = 'local') {
    this.audio.playClick();
    const isAi = mode === 'ai';
    let count = 1;
    const seatsFor = (n) => (isAi ? activeSeatsFor(n, 'ai') : activeSeatsFor(n + 1, 'local'));
    const defaultName = (seat) => {
      if (seat === 0) return this.profile || (isAi ? '问道者' : '玩家甲');
      return ['玩家甲', '玩家乙', '玩家丙', '玩家丁'][seat] || `玩家${seat + 1}`;
    };
    const rows = VIRTUES.map((v) => {
      const active = seatsFor(count).includes(v.seat);
      const isBot = isAi && v.seat !== 0;
      const value = isBot ? botName(v.seat, 1) : defaultName(v.seat);
      return `<div class="setup-seat ${active ? '' : 'is-off'}" data-seat="${v.seat}" style="${seatStyle(v.seat)}">
        <span class="player-seal" style="background:${v.hex}">${v.char}</span>
        <span class="setup-seat-label"><strong>${v.name}</strong><small>${v.motto}</small></span>
        <input class="input" type="text" maxlength="12" value="${escapeHtml(value)}" data-name="${v.seat}" aria-label="${v.name}玩家称呼" ${isBot || !active ? 'disabled' : ''}>
        <span class="tag ${isBot ? 'green' : ''}" data-role="${v.seat}">${isBot ? '机巧' : active ? '玩家' : '空位'}</span>
      </div>`;
    }).join('');

    const modal = openModal({
      title: isAi ? '人机问道' : '同屏对弈',
      subtitle: isAi ? '你执仁德斋，机巧坐镇其余学宫。' : '一台设备，轮流掷骰。适合家人朋友围坐。',
      className: 'wide',
      content: `<div class="setup-intro">${isAi ? '选择机巧的数量。机巧由本地算法代行，不联网、不读取任何个人信息。' : '选择入席人数并留下称呼。两人局自动分坐对席，行棋更均衡。'}</div>
        <div class="choice-row" id="setup-count" role="group" aria-label="选择人数">
          ${[1, 2, 3]
            .map(
              (n) =>
                `<label class="choice"><input type="radio" name="setup-count" value="${n}" ${n === count ? 'checked' : ''}><span>${isAi ? `${n} 位机巧` : `${n + 1} 人`}</span></label>`,
            )
            .join('')}
        </div>
        <div class="setup-seat-list">${rows}</div>
        <div class="form-error" id="setup-error" role="alert"></div>`,
      actions: [
        { label: '取消', className: 'btn-ghost' },
        {
          label: isAi ? '请机巧入席' : '开棋',
          className: 'btn-primary',
          onClick: () => {
            const errorEl = modal.dialog.querySelector('#setup-error');
            try {
              const active = seatsFor(count);
              const configs = active.map((seat) => {
                if (isAi && seat !== 0) return { seat, name: botName(seat, 1), isBot: true };
                const input = modal.dialog.querySelector(`[data-name="${seat}"]`);
                const name = normalizeClientName(input?.value || '');
                return { seat, name, isBot: false };
              });
              if (configs.length < MIN_PLAYERS) throw new Error('至少需要两位玩家。');
              const human = configs.find((c) => !c.isBot);
              if (human) {
                this.profile = human.name;
                storage.name = human.name;
              }
              closeModal();
              this.startLocal(configs, configs.filter((c) => c.isBot).map((c) => c.seat), mode);
            } catch (error) {
              if (errorEl) errorEl.textContent = error.message;
            }
          },
        },
      ],
      onMount: ({ dialog, close }) => {
        const update = (next) => {
          count = Number(next);
          dialog.querySelectorAll('.setup-seat').forEach((row) => {
            const seat = Number(row.dataset.seat);
            const active = seatsFor(count).includes(seat);
            const isBot = isAi && seat !== 0;
            row.classList.toggle('is-off', !active);
            const input = row.querySelector('input');
            if (input) {
              input.disabled = isBot || !active;
              if (!active) {
                input.value = '';
                input.placeholder = '空位';
              } else if (isAi) {
                input.value = isBot ? botName(seat, 1) : defaultName(seat);
                input.placeholder = '你的称呼';
              } else {
                const index = seatsFor(count).indexOf(seat);
                const suggested = ['玩家甲', '玩家乙', '玩家丙', '玩家丁'][index] || defaultName(seat);
                if (!input.value.trim() || /^玩家[甲乙丙丁]$/.test(input.value)) input.value = suggested;
                input.placeholder = '你的称呼';
              }
            }
            const tag = row.querySelector('[data-role]');
            if (tag) {
              tag.textContent = isBot ? '机巧' : active ? '玩家' : '空位';
              tag.classList.toggle('green', isBot);
            }
          });
          const startBtn = dialog.querySelector('.modal-actions .btn-primary');
          if (startBtn) startBtn.textContent = isAi ? `开棋 · 对 ${count} 位机巧` : `开棋 · ${count + 1} 人`;
        };
        dialog.querySelectorAll('input[name="setup-count"]').forEach((input) => {
          input.addEventListener('change', () => update(input.value));
        });
        update(count);
        close;
      },
    });
    modal.dialog.addEventListener('click', () => {});
  }

  startLocal(configs, aiSeats, mode) {
    this._closeChannel();
    this._teardownGame();
    this.online = null;
    this.localGeneration += 1;
    this.localTimer = null;
    const game = createGame(configs, { rng: Math.random });
    const snapshot = gameSnapshot(game);
    this.local = {
      game,
      snapshot,
      aiSeats: new Set(aiSeats),
      mode,
      generation: this.localGeneration,
      busy: false,
      result: false,
    };
    this.lastLocalConfigs = { configs, aiSeats, mode };
    this.screen = 'game';
    this.audio.setScene('game');
    history.replaceState({}, '', location.pathname);
    this.view = new GameView(this.root, {
      mode,
      viewerSeat: mode === 'ai' ? 0 : null,
      room: null,
      state: snapshot,
      audio: this.audio,
      handlers: {
        onRoll: () => this.localRoll(),
        onMove: (pieceId) => this.localMove(pieceId),
        onExit: () => this.confirmExitLocal(),
        onHome: () => this.confirmExitLocal(),
        onRules: () => this.openInfoModal('rules'),
        onSound: () => this.toggleSound(),
        onLog: () => this.openLogModal(),
        onZoom: () => this.openBoardZoom(),
      },
    });
    this.view.setSoundState(this.audio.enabled);
    this.view.update(snapshot, { canAct: false });
    this.localTimer = setTimeout(() => this.beginLocalTurn(), 260);
  }

  _teardownGame() {
    this.localGeneration += 1;
    clearTimeout(this.localTimer);
    clearTimeout(this.autoMoveTimer);
    this.autoMoveTimer = null;
    this.localTimer = null;
    this.local = null;
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    document.querySelector('.connection-banner')?.remove();
    this.heroBoard?.destroy();
    this.heroBoard = null;
  }

  _localStill(gen) {
    return this.local && this.local.generation === gen && this.screen === 'game';
  }

  _localSnapshot() {
    return this.local ? gameSnapshot(this.local.game) : null;
  }

  beginLocalTurn(delay = 0) {
    if (!this.local) return;
    clearTimeout(this.localTimer);
    const gen = this.local.generation;
    const run = () => {
      if (!this._localStill(gen)) return;
      const local = this.local;
      const game = local.game;
      if (game.phase === 'ended') {
        this.finishLocal();
        return;
      }
      if (local.busy) return;
      const player = game.players[game.currentSeat];
      const ai = local.aiSeats.has(game.currentSeat);
      const snapshot = this._localSnapshot();
      this.view.update(snapshot, { canAct: !ai });
      this.localTimer = null;
      if (ai) {
        this.localTimer = setTimeout(() => {
          if (!this._localStill(gen) || this.local?.busy) return;
          this.localRoll();
        }, 850);
      }
    };
    if (delay > 0) this.localTimer = setTimeout(run, delay);
    else run();
  }

  async localRoll() {
    if (!this.local || this.local.busy || this.local.game.phase !== 'playing') return;
    const gen = this.local.generation;
    const game = this.local.game;
    this.local.busy = true;
    clearTimeout(this.localTimer);
    this.view.updatePanels(this._localSnapshot(), { canAct: false });
    try {
      const result = rollDice(game);
      await this.view.playDice(result.dice);
      if (!this._localStill(gen)) return;
      const after = this._localSnapshot();
      this.view.update(after, { canAct: false });
      if (result.legalMoves.length === 0) {
        await sleep(950);
        if (!this._localStill(gen)) return;
        passTurn(game);
        this.local.busy = false;
        this.view.update(this._localSnapshot(), { canAct: false });
        this.beginLocalTurn(360);
        return;
      }
      if (result.legalMoves.length === 1) {
        this.local.busy = false;
        await sleep(520);
        if (!this._localStill(gen)) return;
        await this.localMove(result.legalMoves[0].pieceId);
        return;
      }
      this.local.busy = false;
      const ai = this.local.aiSeats.has(game.currentSeat);
      this.view.update(after, { canAct: !ai });
      if (ai) {
        await sleep(700);
        if (!this._localStill(gen)) return;
        const move = chooseAiMove(game, game.legalMoves);
        if (move) await this.localMove(move.pieceId);
      }
    } catch (error) {
      this.local.busy = false;
      toast(this._formatError(error), { tone: 'error' });
      if (this.local) {
        this.view?.update(this._localSnapshot(), { canAct: false });
        this.beginLocalTurn(420);
      }
    }
  }

  async localMove(pieceId) {
    if (!this.local || this.local.busy || this.local.game.phase !== 'playing') return;
    const game = this.local.game;
    const legal = game.legalMoves.find((m) => m.pieceId === pieceId);
    if (!legal) return;
    const gen = this.local.generation;
    const before = gameSnapshot(game);
    this.local.busy = true;
    clearTimeout(this.localTimer);
    try {
      const move = applyMove(game, pieceId);
      const after = gameSnapshot(game);
      this.view.updatePanels(after, { canAct: false });
      await this.view.playMove(move, before, after);
      if (!this._localStill(gen)) return;
      this.view.update(after, { canAct: false });
      this.local.busy = false;
      if (game.phase === 'ended') {
        this.finishLocal();
        return;
      }
      this.beginLocalTurn(420);
    } catch (error) {
      this.local.busy = false;
      toast(this._formatError(error), { tone: 'error' });
      if (this.local?.game.phase === 'ended') this.finishLocal();
      else {
        this.view?.update(this._localSnapshot(), { canAct: false });
        this.beginLocalTurn(420);
      }
    }
  }

  finishLocal() {
    if (!this.local || this.local.result) return;
    this.local.result = true;
    this.localGeneration += 1;
    clearTimeout(this.localTimer);
    const snapshot = this._localSnapshot();
    this.audio.playWin();
    this.view?.destroy();
    this.view = null;
    this.screen = 'result';
    setTimeout(() => this.renderResult({ mode: this.local.mode, game: snapshot, alreadyPlayedWin: true }), 520);
  }

  async confirmExitLocal() {
    const yes = await this._confirm('离开当前棋局？本机棋局不会保存进度。', {
      title: '要离席吗？',
      confirmText: '离席',
      cancelText: '继续下棋',
    });
    if (yes) this.renderHome();
  }

  // ------------------------------------------------------------------------
  // 在线入口
  // ------------------------------------------------------------------------

  openOnlineModal(prefillCode = '') {
    this.audio.playClick();
    let tab = prefillCode ? 'join' : 'create';
    const nameValue = this.profile || randomName();
    const modal = openModal({
      title: '在线雅集',
      subtitle: '开一席，或凭雅集号入席。无需注册，只需一个称呼。',
      className: 'narrow',
      content: `<div class="rules-tabs" role="tablist" aria-label="在线模式">
          <button type="button" role="tab" data-tab="create" class="${tab === 'create' ? 'is-active' : ''}">开一席</button>
          <button type="button" role="tab" data-tab="join" class="${tab === 'join' ? 'is-active' : ''}">入一席</button>
        </div>
        <div class="form-error" id="online-error" role="alert"></div>
        <div data-panel="create">
          <div class="field">
            <label for="online-create-name">你的称呼 <span class="muted">2–12 字</span></label>
            <input class="input" id="online-create-name" maxlength="12" value="${escapeHtml(nameValue)}" placeholder="如：温故" autocomplete="nickname">
            <p class="field-hint">称呼会显示给同席玩家。请使用文明、友善的称谓。</p>
          </div>
          <button type="button" class="btn btn-primary btn-block btn-lg" id="online-create-btn" style="margin-top:16px">${icon('plus')}创建雅集</button>
        </div>
        <div data-panel="join" hidden>
          <div class="field">
            <label for="online-join-code">雅集号 <span class="muted">4 位</span></label>
            <input class="input code-input" id="online-join-code" maxlength="4" value="${escapeHtml(prefillCode)}" placeholder="ABCD" inputmode="text" autocapitalize="characters" spellcheck="false">
          </div>
          <div class="field" style="margin-top:14px">
            <label for="online-join-name">你的称呼 <span class="muted">2–12 字</span></label>
            <input class="input" id="online-join-name" maxlength="12" value="${escapeHtml(nameValue)}" placeholder="如：知新" autocomplete="nickname">
          </div>
          <button type="button" class="btn btn-gold btn-block btn-lg" id="online-join-btn" style="margin-top:16px">${icon('door')}凭号入席</button>
        </div>
        <p class="field-hint" style="margin-top:16px">在线房间保存在服务器内存中，最长 3 小时自动散场。若无法连接，可先体验“同屏对弈”或“人机问道”。</p>`,
      actions: [{ label: '取消', className: 'btn-ghost' }],
      onMount: ({ dialog, close }) => {
        const errorEl = dialog.querySelector('#online-error');
        const setTab = (next) => {
          tab = next;
          dialog.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === next));
          dialog.querySelectorAll('[data-panel]').forEach((p) => {
            p.hidden = p.dataset.panel !== next;
          });
          errorEl.textContent = '';
        };
        dialog.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
        const syncName = (event) => {
          const value = event.target.value;
          dialog.querySelectorAll('input[autocomplete="nickname"]').forEach((input) => {
            if (input !== event.target) input.value = value;
          });
        };
        dialog.querySelectorAll('input[autocomplete="nickname"]').forEach((input) => input.addEventListener('input', syncName));
        const joinCode = dialog.querySelector('#online-join-code');
        joinCode?.addEventListener('input', () => {
          joinCode.value = joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        });

        const run = async (kind) => {
          const selectedName = dialog.querySelector(tab === 'create' ? '#online-create-name' : '#online-join-name');
          const createBtn = dialog.querySelector('#online-create-btn');
          const joinBtn = dialog.querySelector('#online-join-btn');
          const button = kind === 'create' ? createBtn : joinBtn;
          errorEl.textContent = '';
          button.disabled = true;
          try {
            const name = normalizeClientName(selectedName?.value || '');
            this.profile = name;
            storage.name = name;
            let response;
            if (kind === 'create') response = await api.createRoom(name);
            else {
              const code = joinCode?.value || '';
              if (!/^[A-HJ-NP-Z2-9]{4}$/.test(code)) throw new Error('请输入 4 位雅集号。');
              response = await api.joinRoom(code, name);
            }
            close();
            this.enterRoom(response);
          } catch (error) {
            errorEl.textContent = this._formatError(error);
            button.disabled = false;
            this.audio.playClick();
          }
        };
        dialog.querySelector('#online-create-btn')?.addEventListener('click', () => run('create'));
        dialog.querySelector('#online-join-btn')?.addEventListener('click', () => run('join'));
        dialog.querySelectorAll('input').forEach((input) => {
          input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              run(tab);
            }
          });
        });
        close;
      },
    });
    const focusInput = modal.dialog.querySelector(tab === 'create' ? '#online-create-name' : '#online-join-code');
    setTimeout(() => focusInput?.focus?.(), 60);
  }

  async tryResume(code) {
    if (!code || !/^[A-HJ-NP-Z2-9]{4}$/.test(code)) return;
    try {
      const response = await api.state(code);
      this.enterRoom(response);
    } catch {
      this.openOnlineModal(code);
    }
  }

  enterRoom(payload) {
    this._teardownGame();
    this._closeChannel();
    this.heroBoard?.destroy();
    this.heroBoard = null;
    this.snapshotChain = Promise.resolve();
    this.resultGameSeq = null;
    const room = payload.room;
    if (!room) return;
    this.online = {
      room,
      game: payload.game || null,
      youSeat: room.youSeat ?? payload.youSeat ?? null,
      isHost: room.hostSeat === (room.youSeat ?? payload.youSeat),
      lastVersion: payload.version ?? room.version ?? 0,
    };
    this.lastOnlineVersion = this.online.lastVersion;
    this.lastMoveSeq = this.online.game?.lastMove?.seq || 0;
    this.screen = room.status === 'lobby' ? 'lobby' : room.status === 'ended' ? 'result' : 'game';
    storage.session = { code: room.code, seat: this.online.youSeat };
    history.replaceState({}, '', `${location.pathname}?room=${room.code}`);
    this.audio.setScene('game');
    this._openChannel(room.code);
    this._routeOnline({ initial: true });
  }

  _openChannel(code) {
    this._closeChannel();
    this.intentionalClose = false;
    this.channel = new RoomChannel(code, {
      onSnapshot: (data) => this._onSnapshot(data),
      onPhrase: (data) => this.view?.flashPhrase?.(data),
      onClosed: (data) => {
        this.channel = null;
        if (this.intentionalClose) return;
        toast(data?.reason || '雅集已散场。', { tone: 'info', duration: 3600 });
        this.renderHome();
      },
      onStatus: (status) => {
        if (this.online) this.online.connection = status;
        if (this.view) this.view.setConnection(status);
        if (this.online?.game && this.screen === 'game') this._refreshOnlineTurn();
      },
      onError: () => {
        if (this.screen === 'game') {
          toast('连接有些波动，正在尝试重连…', { tone: 'info', duration: 2400, iconName: 'wifi' });
        }
      },
    });
    this.channel.open();
  }

  _closeChannel() {
    this.intentionalClose = true;
    this.channel?.close();
    this.channel = null;
  }

  _onSnapshot(data) {
    if (!data || !this.online) return;
    const version = Number(data.version ?? data.room?.version ?? 0);
    if (version && version < this.lastOnlineVersion) return;
    if (version && version === this.lastOnlineVersion) return;
    this.lastOnlineVersion = version;
    this.online.room = data.room;
    this.online.youSeat = data.room.youSeat ?? this.online.youSeat;
    this.online.isHost = data.room.hostSeat === this.online.youSeat;
    if (this.online.connection === 'connecting') this.online.connection = 'connected';
    if (data.room.status === 'lobby') {
      this.online.game = null;
      this._routeOnline({});
      return;
    }
    if (!data.game) return;
    const next = data.game;
    if (this.screen !== 'game' || !this.view) {
      this.online.game = next;
      this.lastMoveSeq = next.lastMove?.seq || 0;
      this._routeOnline({ initial: true });
      return;
    }
    this.snapshotChain = this.snapshotChain
      .then(() => this._animateSnapshot(next))
      .catch((error) => {
        console.error('[snapshot]', error);
        if (this.online) this.view?.update(this.online.game, { canAct: this._onlineCanAct(this.online.game), room: this.online.room });
      });
  }

  async _animateSnapshot(next) {
    if (!this.online || !this.view) return;
    const prev = this.online.game;
    const newSeq = next.lastMove?.seq || 0;
    const isNewMove = next.lastMove?.type === 'move' && newSeq > this.lastMoveSeq;
    const diceChanged = next.dice !== null && prev?.dice !== next.dice;
    try {
      if (isNewMove) {
        this.view.updatePanels(next, { canAct: false, room: this.online.room });
        await this.view.playMove(next.lastMove, prev, next);
      } else if (diceChanged) {
        this.view.updatePanels(next, { canAct: false, room: this.online.room });
        await this.view.playDice(next.dice);
      }
    } catch (error) {
      console.error('[animate]', error);
    }
    this.online.game = next;
    this.lastMoveSeq = Math.max(this.lastMoveSeq, newSeq);
    const canAct = this._onlineCanAct(next);
    this.view.update(next, { canAct, room: this.online.room, connection: this.online.connection || 'connected' });
    if (next.phase === 'ended') {
      this.showOnlineResult();
      return;
    }
    this._maybeAutoOnlineMove(next);
  }

  _routeOnline({ initial = false } = {}) {
    const online = this.online;
    if (!online) return;
    if (online.room.status === 'lobby') {
      this.renderLobby();
      return;
    }
    if (online.room.status === 'ended' || online.game?.phase === 'ended') {
      if (initial) this.showOnlineResult();
      else this.showOnlineResult();
      return;
    }
    if (online.room.status === 'playing' && online.game) {
      if (!this.view || this.screen !== 'game') {
        this.renderOnlineGame(online.game);
      } else {
        this.view.update(online.game, {
          canAct: this._onlineCanAct(online.game),
          room: online.room,
          connection: online.connection || 'connected',
        });
      }
    }
  }

  renderOnlineGame(game) {
    this._teardownGame();
    this.screen = 'game';
    this.resultGameSeq = null;
    this.audio.setScene('game');
    this.view = new GameView(this.root, {
      mode: 'online',
      viewerSeat: this.online.youSeat,
      room: this.online.room,
      state: game,
      audio: this.audio,
      handlers: {
        onRoll: () => this.onlineRoll(),
        onMove: (pieceId) => this.onlineMove(pieceId),
        onExit: () => this.confirmExitOnline(),
        onHome: () => this.confirmExitOnline(),
        onRules: () => this.openInfoModal('rules'),
        onSound: () => this.toggleSound(),
        onLog: () => this.openLogModal(),
        onZoom: () => this.openBoardZoom(),
        onCopyCode: () => this.copyInvite(),
        onSay: (phraseId) => this.onlineSay(phraseId),
      },
    });
    this.view.setSoundState(this.audio.enabled);
    this.view.setConnection(this.online.connection || 'connected');
    this.lastMoveSeq = game.lastMove?.seq || 0;
    this.view.update(game, { canAct: this._onlineCanAct(game), room: this.online.room, connection: this.online.connection || 'connected' });
  }

  _refreshOnlineTurn() {
    if (!this.online?.game || !this.view || this.screen !== 'game') return;
    this.view.update(this.online.game, {
      canAct: this._onlineCanAct(this.online.game),
      room: this.online.room,
      connection: this.online.connection || 'connected',
    });
  }

  _onlineCanAct(game) {
    if (!this.online || !game || this.online.room.status !== 'playing') return false;
    if (game.phase === 'ended') return false;
    if (game.currentSeat !== this.online.youSeat) return false;
    if (this.view?.busy || this.actionBusy) return false;
    if (this.online.connection === 'closed' || this.online.connection === 'reconnecting') return false;
    if (game.dice === null) return true;
    return (game.legalMoves?.length || 0) > 0;
  }

  _maybeAutoOnlineMove(game) {
    clearTimeout(this.autoMoveTimer);
    this.autoMoveTimer = null;
    if (!this.online || this.screen !== 'game') return;
    if (!this._onlineCanAct(game)) return;
    if (game.dice === null || game.legalMoves?.length !== 1) return;
    const pieceId = game.legalMoves[0].pieceId;
    const seq = game.lastMove?.seq || 0;
    this.autoMoveTimer = setTimeout(() => {
      if (!this.online || this.screen !== 'game' || !this.view) return;
      const current = this.online.game;
      if (current?.lastMove?.seq !== seq) return;
      if (current?.dice === null) return;
      if (current?.legalMoves?.length !== 1) return;
      this.onlineMove(pieceId);
    }, 1050);
  }

  async onlineRoll() {
    if (!this.online || this.actionBusy || !this._onlineCanAct(this.online.game)) return;
    if (this.online.game.dice !== null) return;
    this.actionBusy = true;
    clearTimeout(this.autoMoveTimer);
    this.view.updatePanels(this.online.game, { canAct: false, room: this.online.room });
    try {
      const response = await api.roll(this.online.room.code);
      this._applyApiPayload(response);
    } catch (error) {
      toast(this._formatError(error), { tone: 'error' });
      this.view.updatePanels(this.online.game, { canAct: this._onlineCanAct(this.online.game), room: this.online.room });
    } finally {
      this.actionBusy = false;
      this._refreshOnlineTurn();
    }
  }

  async onlineMove(pieceId) {
    if (!this.online || this.actionBusy) return;
    this.actionBusy = true;
    clearTimeout(this.autoMoveTimer);
    this.view.updatePanels(this.online.game, { canAct: false, room: this.online.room });
    try {
      const response = await api.move(this.online.room.code, pieceId);
      this._applyApiPayload(response);
    } catch (error) {
      toast(this._formatError(error), { tone: 'error' });
      this.view.updatePanels(this.online.game, { canAct: this._onlineCanAct(this.online.game), room: this.online.room });
    } finally {
      this.actionBusy = false;
      this._refreshOnlineTurn();
    }
  }

  _applyApiPayload(response) {
    if (!response || !this.online) return;
    const version = Number(response.version ?? response.room?.version ?? 0);
    if (version && version <= this.lastOnlineVersion) return;
    this.online.room = response.room || this.online.room;
    this.online.youSeat = response.room?.youSeat ?? this.online.youSeat;
    this.online.isHost = this.online.room.hostSeat === this.online.youSeat;
    if (response.room?.status === 'lobby') {
      this.lastOnlineVersion = version;
      this._routeOnline({});
      return;
    }
    if (response.game) {
      this._onSnapshot({ ...response, type: 'snapshot' });
    }
  }

  async onlineSay(phraseId) {
    if (!this.online) return;
    try {
      await api.say(this.online.room.code, phraseId);
    } catch (error) {
      toast(this._formatError(error), { tone: 'error' });
    }
  }

  async copyInvite() {
    if (!this.online) return;
    const url = `${location.origin}${location.pathname}?room=${this.online.room.code}`;
    const ok = await copyText(url);
    toast(ok ? '邀请链接已复制，发给朋友即可入席。' : '复制失败，请手动复制地址栏链接。', {
      tone: ok ? 'success' : 'error',
      duration: 3000,
    });
  }

  async confirmExitOnline() {
    if (!this.online) {
      this.renderHome();
      return;
    }
    const yes = await this._confirm(
      this.online.room.status === 'playing'
        ? '离开雅集后，你的席位会由机巧托管至本局结束。确定离席吗？'
        : '确定离开这间雅集吗？',
      { title: '要离席吗？', confirmText: '离席', cancelText: '留下' },
    );
    if (!yes) return;
    const code = this.online.room.code;
    this.intentionalClose = true;
    try {
      await api.leave(code);
    } catch {
      /* 即使网络失败，也回到本机首页 */
    }
    this._closeChannel();
    this.online = null;
    storage.session = null;
    this.renderHome();
  }

  // ------------------------------------------------------------------------
  // 雅集大厅
  // ------------------------------------------------------------------------

  renderLobby() {
    if (!this.online) return;
    this._teardownGame();
    this.screen = 'lobby';
    this.resultGameSeq = null;
    this.audio.setScene('game');
    const room = this.online.room;
    const you = this.online.youSeat;
    const isHost = room.hostSeat === you;
    const me = room.seats?.[you];
    const filled = room.filledCount ?? room.seats.filter(Boolean).length;
    const seatCards = VIRTUES.map((v) => {
      const seat = room.seats?.[v.seat] || null;
      if (!seat) {
        return `<article class="seat-card is-empty" style="${seatStyle(v.seat)}">
          <span class="seat-seal" style="background:transparent;color:${v.hex}">${v.char}</span>
          <div class="seat-empty-copy"><strong>虚位以待</strong><span>${v.name} · ${v.motto}</span>
            <div class="seat-empty-actions">
              <button type="button" data-seat="${v.seat}">移至此处</button>
              ${isHost ? `<button type="button" data-bot-add="${v.seat}">添置机巧</button>` : ''}
            </div>
          </div>
        </article>`;
      }
      const ready = seat.isBot || seat.ready;
      const badges = [
        seat.host ? '<span class="mini-tag host">席主</span>' : '',
        seat.isBot ? '<span class="mini-tag bot">机巧</span>' : '',
        seat.seat === you ? '<span class="mini-tag you">你</span>' : '',
        seat.connected === false && !seat.isBot ? '<span class="mini-tag offline">暂离</span>' : '',
      ].join('');
      return `<article class="seat-card ${seat.seat === you ? 'is-you' : ''}" style="${seatStyle(v.seat)}">
        <span class="seat-seal" style="background:${v.hex}">${v.char}</span>
        <div class="seat-name-row"><strong>${escapeHtml(seat.name)}</strong><span class="seat-virtue">${v.name}</span>${badges}</div>
        <div class="seat-state">
          <span class="seat-ready ${ready ? 'is-ready' : ''} ${seat.host ? 'is-host' : ''}"><span class="dot"></span>${seat.isBot ? '机巧已备' : ready ? '已备好' : '候场'}</span>
          <div class="seat-actions">
            ${isHost && seat.isBot ? `<button type="button" data-bot-remove="${seat.seat}">移除</button>` : ''}
            ${seat.seat !== you && !seat.isBot ? '' : ''}
          </div>
        </div>
      </article>`;
    }).join('');

    const canStart = Boolean(room.canStart);
    const startDisabled = !isHost || !canStart;
    this._setRoot(`<div class="lobby-screen">
      <header class="lobby-topbar">
        <a class="brand" href="/" data-act="home" aria-label="返回首页">
          <span class="brand-seal">儒</span>
          <span class="brand-text"><strong>儒风万里</strong><small>孔子文化 · 主题飞行棋</small></span>
        </a>
        <div class="home-nav-actions">
          ${this._soundButton()}
          <button type="button" class="btn-icon" data-act="rules" aria-label="玩法">${icon('rules')}</button>
        </div>
      </header>
      <main class="lobby-shell">
        <header class="lobby-head">
          <div class="lobby-title">
            <span class="seal">集</span>
            <div><h1>雅集候场</h1><p>以文会友，以友辅仁 · 等各位备好，即行开棋</p></div>
          </div>
          <div class="room-code-box">
            <div><small>雅集号</small><strong>${escapeHtml(room.code)}</strong></div>
            <button type="button" class="btn-icon" data-act="copy" aria-label="复制邀请链接">${icon('link')}</button>
          </div>
        </header>
        <div class="lobby-body">
          <div>
            <div class="seat-grid">${seatCards}</div>
            <p class="field-hint" style="margin-top:12px">${isHost ? '你是席主。可添置机巧补位，等各位备好后开棋。' : '等待席主开棋。入席后可点击空位换席。'}</p>
          </div>
          <aside class="lobby-aside">
            <section class="lobby-note">
              <h3>${icon('scroll')}如何开局</h3>
              <p>四席之中，至少两席入座即可开棋；人少时可添置机巧，凑成一局。</p>
              <ul>
                <li>点击空位可换席，两人局建议分坐对席。</li>
                <li>每位玩家都需点“备好”，席主才能开棋。</li>
                <li>开棋后不可换席；离开席位将由机巧托管。</li>
              </ul>
            </section>
            <section class="lobby-quote">
              <span class="quote-mark">「</span>
              <p>君子以文会友，以友辅仁。</p>
              <small>《论语·颜渊》</small>
            </section>
          </aside>
        </div>
        <footer class="lobby-foot">
          <div class="lobby-foot-hint">${filled} / 4 席已入座 · ${canStart ? '众人已备，可以开棋。' : isHost ? '请等待各位备好。' : '等待席主开棋。'}</div>
          <div class="lobby-foot-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-act="copy">${icon('link')}复制邀请</button>
            ${me ? `<button type="button" class="btn ${me.ready ? 'btn-ghost' : 'btn-gold'} btn-sm" data-act="ready">${icon(me.ready ? 'check' : 'plus')}${me.ready ? '已备好' : '备好'}</button>` : ''}
            <button type="button" class="btn btn-quiet btn-sm" data-act="leave">离席</button>
            ${isHost ? `<button type="button" class="btn btn-primary" data-act="start" ${startDisabled ? 'disabled' : ''}>${icon('play')}开棋</button>` : '<span class="lobby-foot-hint">等待席主开棋</span>'}
          </div>
        </footer>
      </main>
    </div>`);

    this._setSoundUI();
    this.root.querySelectorAll('[data-act="sound"]').forEach((el) => el.addEventListener('click', () => this.toggleSound()));
    this.root.querySelectorAll('[data-act="rules"]').forEach((el) => el.addEventListener('click', () => this.openInfoModal('rules')));
    this.root.querySelectorAll('[data-act="home"]').forEach((el) =>
      el.addEventListener('click', (event) => {
        event.preventDefault();
        this.confirmExitOnline();
      }),
    );
    this.root.querySelectorAll('[data-act="copy"]').forEach((el) => el.addEventListener('click', () => this.copyInvite()));
    this.root.querySelector('[data-act="leave"]')?.addEventListener('click', () => this.confirmExitOnline());
    this.root.querySelector('[data-act="ready"]')?.addEventListener('click', () => this.toggleReady());
    this.root.querySelector('[data-act="start"]')?.addEventListener('click', () => this.startOnlineGame());
    this.root.querySelectorAll('[data-seat]').forEach((el) =>
      el.addEventListener('click', () => this.changeSeat(Number(el.dataset.seat))),
    );
    this.root.querySelectorAll('[data-bot-add]').forEach((el) =>
      el.addEventListener('click', () => this.addBot(Number(el.dataset.botAdd))),
    );
    this.root.querySelectorAll('[data-bot-remove]').forEach((el) =>
      el.addEventListener('click', () => this.removeBot(Number(el.dataset.botRemove))),
    );
  }

  async _lobbyAction(fn) {
    if (!this.online) return;
    try {
      const response = await fn(this.online.room.code);
      this._applyApiPayload(response);
    } catch (error) {
      toast(this._formatError(error), { tone: 'error' });
    }
  }

  toggleReady() {
    if (!this.online) return;
    const me = this.online.room.seats?.[this.online.youSeat];
    if (!me) return;
    this._lobbyAction((code) => api.ready(code, !me.ready));
  }

  changeSeat(seat) {
    this._lobbyAction((code) => api.seat(code, seat));
  }

  addBot(seat) {
    this._lobbyAction((code) => api.bot(code, seat, 'add'));
  }

  removeBot(seat) {
    this._lobbyAction((code) => api.bot(code, seat, 'remove'));
  }

  async startOnlineGame() {
    if (!this.online || this.actionBusy) return;
    this.actionBusy = true;
    try {
      const response = await api.start(this.online.room.code);
      this._applyApiPayload(response);
    } catch (error) {
      toast(this._formatError(error), { tone: 'error' });
    } finally {
      this.actionBusy = false;
      this._refreshOnlineTurn();
    }
  }

  // ------------------------------------------------------------------------
  // 结果
  // ------------------------------------------------------------------------

  renderResult({ mode, game, room = null, isHost = false, alreadyPlayedWin = false } = {}) {
    if (!game) return;
    const winnerSeat = game.winnerSeat ?? game.players?.find((p) => p.finished >= 4)?.seat ?? null;
    const winner = game.players?.find((p) => p.seat === winnerSeat) || game.players?.[0];
    if (!winner) return;
    const virtue = VIRTUE_BY_SEAT[winner.seat];
    const quote =
      (game.lastMove?.quote && (quoteByText(game.lastMove.quote.text) || game.lastMove.quote)) ||
      { text: '德不孤，必有邻。', source: '《论语·里仁》' };
    const stats = winner.stats || {};
    const isOnline = mode === 'online';
    this.screen = 'result';
    this.view?.destroy();
    this.view = null;
    clearTimeout(this.localTimer);
    this._setRoot(`<div class="result-screen">
      <main class="result-shell">
        <header class="result-head">
          <span class="seal">成</span>
          <p class="eyebrow">四鸢归殿 · 礼成</p>
          <h1>${escapeHtml(winner.name)} 胜</h1>
          <p>${virtue.name} · ${virtue.motto}。四枚纸鸢已入大成殿，本局礼成。</p>
        </header>
        <div class="result-quote">
          <p>「${escapeHtml(quote.text)}」</p>
          <small>${escapeHtml(quote.source)}</small>
        </div>
        <div class="result-stats">
          <div class="result-stat"><strong>${game.turnNumber || 0}</strong><span>回合</span></div>
          <div class="result-stat"><strong>${stats.captures || 0}</strong><span>折返</span></div>
          <div class="result-stat"><strong>${stats.flights || 0}</strong><span>御风</span></div>
          <div class="result-stat"><strong>4</strong><span>归殿</span></div>
        </div>
        <div class="result-actions">
          ${isOnline
            ? isHost
              ? `<button type="button" class="btn btn-primary" data-act="again">${icon('refresh')}再开一局</button>`
              : `<span class="tag gold">等待席主筹备下一局</span>`
            : `<button type="button" class="btn btn-primary" data-act="again">${icon('refresh')}再来一局</button>`}
          <button type="button" class="btn btn-ghost" data-act="log">${icon('scroll')}查看棋谱</button>
          <button type="button" class="btn btn-ghost" data-act="share">${icon('share')}分享战绩</button>
          <button type="button" class="btn btn-quiet" data-act="home">回到首页</button>
        </div>
        <p class="result-foot">${isOnline ? '本局数据仅在房间内存中保留，散场即清空。' : '愿这一局棋，成为一次轻松的文化相遇。'} · 适龄提示 8+</p>
      </main>
    </div>`);
    this.root.querySelectorAll('[data-act="sound"]').forEach((el) => el.addEventListener('click', () => this.toggleSound()));
    this.root.querySelector('[data-act="again"]')?.addEventListener('click', () => {
      if (isOnline) this.onlineRematch();
      else this.againLocal();
    });
    this.root.querySelector('[data-act="log"]')?.addEventListener('click', () => this.openLogModal());
    this.root.querySelector('[data-act="share"]')?.addEventListener('click', () => {
      const text = `我在「儒风万里」以${winner.name}（${virtue.name}）四鸢归殿。${quote.text}`;
      if (isOnline) {
        this._shareOrCopy(`${text} 来 ${location.origin}${location.pathname} 开一局。`);
      } else {
        this._shareOrCopy(text);
      }
    });
    this.root.querySelector('[data-act="home"]')?.addEventListener('click', () => {
      if (isOnline) this.confirmExitOnline();
      else this.renderHome();
    });
    this._setSoundUI();
    if (this.audio.enabled && !alreadyPlayedWin) this.audio.playWin();
  }

  againLocal() {
    if (this.lastLocalConfigs) {
      this.startLocal(
        this.lastLocalConfigs.configs,
        this.lastLocalConfigs.aiSeats,
        this.lastLocalConfigs.mode,
      );
    } else {
      this.openLocalSetup('local');
    }
  }

  async onlineRematch() {
    if (!this.online || this.actionBusy) return;
    this.actionBusy = true;
    try {
      const response = await api.rematch(this.online.room.code);
      this._applyApiPayload(response);
    } catch (error) {
      toast(this._formatError(error), { tone: 'error' });
    } finally {
      this.actionBusy = false;
    }
  }

  showOnlineResult() {
    if (!this.online?.game) return;
    if (
      this.screen === 'result' &&
      this.resultGameSeq === this.online.game.seq &&
      this.resultIsHost === this.online.isHost
    ) {
      return;
    }
    this.resultGameSeq = this.online.game.seq;
    this.resultIsHost = this.online.isHost;
    this.renderResult({
      mode: 'online',
      game: this.online.game,
      room: this.online.room,
      isHost: this.online.isHost,
    });
  }

  // ------------------------------------------------------------------------
  // 弹窗信息
  // ------------------------------------------------------------------------

  openInfoModal(tab = 'rules') {
    this.audio.playClick();
    const tabs = [
      ['rules', '玩法'],
      ['culture', '文化'],
      ['about', '关于'],
      ['privacy', '隐私'],
    ];
    const content = (active) => {
      if (active === 'rules') {
        return `<p class="rule-intro">“飞行棋”的轻快骨架，加上孔庙纹样与《论语》箴言。四席各执四鸢，先让四鸢全部归殿者胜。</p>
          <div class="rule-list">${RULES_ROWS.map(
            ([title, text], i) => `<div class="rule-row"><span class="rule-no">${i + 1}</span><div><strong>${title}</strong><p>${text}</p></div></div>`,
          ).join('')}</div>
          <div class="rule-note"><strong>一局大约十至二十分钟。</strong><span>首局建议先玩“同屏对弈”，把规则过一遍，再开在线雅集。</span><span>若暂无路可走，点击掷骰后系统会自动礼让一轮。</span></div>`;
      }
      if (active === 'culture') {
        return `<div class="culture-list">${CULTURE.map(
          (item) => `<article class="culture-item">
            <div class="culture-item-art">${cultureArt(item.key)}</div>
            <div><h3>${item.title}</h3><p class="culture-sub">${item.sub}</p><p>${item.text}</p></div>
          </article>`,
        ).join('')}</div>
          <div class="rule-note" style="margin-top:16px"><strong>说明</strong><span>以上建筑与纹样均为艺术化再创作，取意于传统孔庙与器物，不对应任何具体文物的测绘复原。</span><span>《论语》原文属公有领域，引用以通行本为准。</span></div>`;
      }
      if (active === 'privacy') {
        return `<div class="about-block">${PRIVACY_TEXT.map(
          ([title, text]) => `<h3>${title}</h3><p>${text}</p>`,
        ).join('')}
          <div class="about-meta"><span>本地存储键：rufeng.name / rufeng.sound / rufeng.session</span><span>在线 Cookie：rufeng_session（HttpOnly，SameSite=Strict，4 小时）</span><span>最后更新：2026 年 11 月</span></div>
        </div>`;
      }
      return `<div class="about-block">${ABOUT_SECTIONS.map(
        ([title, text]) => `<h3>${title}</h3><p>${text}</p>`,
      ).join('')}
        <h3>版权与素材</h3>
        <p>程序代码、界面、棋盘、纸鸢与全部 SVG 纹样为项目原创；《论语》文本为公有领域；正文字体为 LXGW 文楷（SIL Open Font License 1.1），标题字体为马善政毛笔楷书（SIL Open Font License 1.1）。字体许可证随项目分发。</p>
        <p>若用于课程提交或公开展示，请保留项目组署名与“非宗教活动、非商业赌博”的说明。</p>
        <div class="tag-row"><span class="tag gold">原创视觉</span><span class="tag">OFL 字体</span><span class="tag">公版文本</span><span class="tag green">8+ 适龄</span></div>
        <div class="about-meta"><span>儒风万里 · 孔子文化主题飞行棋 v1.0.0</span><span>零依赖前端 · Node.js 原生服务 · 可私有化部署</span></div>
      </div>`;
    };
    const modal = openModal({
      title: '棋局小笺',
      subtitle: '玩法、文化、关于与隐私，都写在这里。',
      className: 'wide',
      content: `<div class="rules-tabs" role="tablist" aria-label="信息分类">${tabs
        .map(([key, label]) => `<button type="button" role="tab" data-info-tab="${key}" class="${key === tab ? 'is-active' : ''}">${label}</button>`)
        .join('')}</div><div id="info-content">${content(tab)}</div>`,
      actions: [{ label: '知道了', className: 'btn-primary' }],
      onMount: ({ dialog }) => {
        dialog.querySelectorAll('[data-info-tab]').forEach((button) => {
          button.addEventListener('click', () => {
            dialog.querySelectorAll('[data-info-tab]').forEach((b) => b.classList.toggle('is-active', b === button));
            dialog.querySelector('#info-content').innerHTML = content(button.dataset.infoTab);
          });
        });
      },
    });
    return modal;
  }

  openLogModal() {
    const game = this.local ? this._localSnapshot() : this.online?.game;
    if (!game) return;
    const rows = (game.log || [])
      .slice(-40)
      .map((entry) => {
        const virtue = entry.seat !== null ? VIRTUE_BY_SEAT[entry.seat] : null;
        return `<div class="log-entry" style="max-width:none;white-space:normal;padding:7px 0;border-left:0;border-bottom:1px dashed var(--line)"><span class="log-dot" style="--log-color:${virtue?.hex || 'var(--gold)'}"></span><span>${escapeHtml(entry.text)}</span></div>`;
      })
      .join('');
    openModal({
      title: '本局棋谱',
      subtitle: '一段可回看的行棋记录。',
      className: 'narrow',
      content: `<div>${rows || '<p class="modal-copy">棋谱尚未落笔。</p>'}</div>`,
      actions: [{ label: '合上棋谱', className: 'btn-primary' }],
    });
  }

  openBoardZoom() {
    const board = this.view?.getBoardElement?.();
    if (!board) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'board-zoom-dialog';
    dialog.setAttribute('aria-label', '大成玉盘放大图');
    dialog.innerHTML = `<div class="board-zoom-shell">
      <header class="board-zoom-head"><div><strong>大成玉盘</strong><span> · 放大查看</span></div><button type="button" class="modal-close" aria-label="关闭">${icon('close')}</button></header>
      <div class="board-zoom-body"></div>
    </div>`;
    const clone = board.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('.token').forEach((token) => {
      token.removeAttribute('tabindex');
      token.setAttribute('role', 'img');
    });
    dialog.querySelector('.board-zoom-body').appendChild(clone);
    document.body.appendChild(dialog);
    document.body.classList.add('has-modal');
    const close = () => {
      dialog.close();
      dialog.remove();
      document.body.classList.remove('has-modal');
    };
    dialog.querySelector('.modal-close').addEventListener('click', close);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    dialog.showModal();
  }

  // ------------------------------------------------------------------------
  // 清理
  // ------------------------------------------------------------------------

  _teardownGameViewOnly() {
    this.view?.destroy();
    this.view = null;
  }
}
