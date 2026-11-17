/**
 * 程序化音效：古琴式拨弦、木鱼、骰子、风声、磬声。
 * 不加载任何外部音频，避免版权与隐私问题；首次点击后才会启动 AudioContext。
 */

const PENTATONIC = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25];

function midiToFreq(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

export class AudioKit {
  constructor({ enabled = true } = {}) {
    this.enabled = Boolean(enabled);
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.buffers = new Map();
    this.ambienceTimer = null;
    this.scene = 'home';
    this.started = false;
  }

  async ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.5 : 0;
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.24;
    this.master.connect(this.compressor).connect(this.ctx.destination);
    this.started = true;
    if (this.enabled) this.scheduleAmbience(1800);
    return this.ctx;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.ctx.currentTime, 0.08);
    }
    if (this.enabled) {
      this.ensure().then(() => this.scheduleAmbience(2500));
    } else {
      clearTimeout(this.ambienceTimer);
      this.ambienceTimer = null;
    }
  }

  setScene(scene) {
    this.scene = scene;
  }

  _noise(seconds = 1) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _pluckBuffer(note) {
    const key = `pluck-${note}`;
    if (this.buffers.has(key)) return this.buffers.get(key);
    const ctx = this.ctx;
    const freq = midiToFreq(note);
    const duration = 2.2;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const delay = Math.max(2, Math.floor(ctx.sampleRate / freq));
    const ring = new Float32Array(delay);
    for (let i = 0; i < delay; i += 1) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const current = ring[idx];
      const next = (current + last) * 0.5 * 0.996;
      data[i] = current * 0.7;
      ring[idx] = next;
      last = current;
      idx = (idx + 1) % delay;
    }
    this.buffers.set(key, buffer);
    return buffer;
  }

  _playBuffer(buffer, { gain = 0.18, when = 0, rate = 1, filterFreq = null } = {}) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime + when);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + 2.0);
    let node = source;
    if (filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      node.connect(filter);
      node = filter;
    }
    node.connect(g).connect(this.master);
    source.start(ctx.currentTime + when);
    source.stop(ctx.currentTime + when + 2.2);
  }

  _tone(freq, { when = 0, duration = 0.3, gain = 0.1, type = 'sine', slide = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + when + duration);
    g.gain.setValueAtTime(0, ctx.currentTime + when);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);
    osc.connect(g).connect(this.master);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.05);
  }

  playDice() {
    if (!this.ctx || !this.enabled) return;
    const buffer = this._noise(0.5);
    const ctx = this.ctx;
    for (let i = 0; i < 5; i += 1) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200 + Math.random() * 1800;
      filter.Q.value = 0.9;
      const g = ctx.createGain();
      const at = ctx.currentTime + i * 0.07;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.08, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
      src.connect(filter).connect(g).connect(this.master);
      src.start(at);
      src.stop(at + 0.16);
    }
    this._tone(95, { when: 0.36, duration: 0.18, gain: 0.09, type: 'triangle', slide: -30 });
  }

  playStep() {
    if (!this.ctx || !this.enabled) return;
    this._tone(620 + Math.random() * 80, { duration: 0.055, gain: 0.035, type: 'triangle' });
  }

  playFly() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise(1.1);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(380, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2100, ctx.currentTime + 0.55);
    filter.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 1.0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.0);
    src.connect(filter).connect(g).connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 1.05);
    this._tone(740, { when: 0.08, duration: 0.7, gain: 0.025, type: 'sine', slide: 220 });
  }

  playCapture() {
    if (!this.ctx || !this.enabled) return;
    this._tone(146.83, { duration: 1.1, gain: 0.09, type: 'sine' });
    this._tone(220, { duration: 0.9, gain: 0.05, type: 'sine' });
    this._tone(293.66, { when: 0.05, duration: 0.7, gain: 0.03, type: 'triangle' });
  }

  playFinish() {
    if (!this.ctx || !this.enabled) return;
    const notes = [69, 74, 76, 81];
    notes.forEach((note, i) => {
      this._playBuffer(this._pluckBuffer(note), {
        when: i * 0.09,
        gain: 0.09,
        filterFreq: 2400,
      });
    });
  }

  playWin() {
    if (!this.ctx || !this.enabled) return;
    const notes = [62, 65, 67, 69, 74, 79];
    notes.forEach((note, i) => {
      this._playBuffer(this._pluckBuffer(note), {
        when: i * 0.16,
        gain: 0.1,
        filterFreq: 3000,
      });
    });
    this._tone(392, { when: 0.96, duration: 1.6, gain: 0.04, type: 'sine' });
  }

  playClick() {
    if (!this.ctx || !this.enabled) return;
    this._tone(880, { duration: 0.035, gain: 0.02, type: 'sine' });
  }

  playOpen() {
    if (!this.ctx || !this.enabled) return;
    this._playBuffer(this._pluckBuffer(69), { gain: 0.05, filterFreq: 1800 });
  }

  scheduleAmbience(delay = 6000) {
    clearTimeout(this.ambienceTimer);
    if (!this.enabled) return;
    this.ambienceTimer = setTimeout(() => {
      if (!this.enabled || !this.ctx) return;
      if (this.ctx.state === 'suspended') return;
      const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
      const midi = Math.round(69 + 12 * Math.log2(note / 440));
      this._playBuffer(this._pluckBuffer(midi), {
        gain: this.scene === 'game' ? 0.028 : 0.022,
        filterFreq: 1500,
        rate: 0.98 + Math.random() * 0.04,
      });
      this.scheduleAmbience(6000 + Math.random() * 9000);
    }, delay);
  }

  stop() {
    clearTimeout(this.ambienceTimer);
    this.ambienceTimer = null;
    if (this.ctx) this.ctx.suspend().catch(() => {});
  }
}
