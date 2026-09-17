// Procedural WebAudio: tanpura drone, temple bells, chimes and combat SFX.
// No audio files are shipped; everything is synthesised.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.droneNodes = [];
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  resume() { this.ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  /** Tanpura-like drone: fundamental + fifth with slow beating and filtered noise bed. */
  startDrone(root = 130.81, mood = 'day') {
    this.ensure(); if (!this.ctx) return;
    this.stopDrone();
    const ctx = this.ctx;
    const bus = ctx.createGain(); bus.gain.value = 0;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = mood === 'night' ? 600 : 1100; filt.Q.value = 0.7;
    bus.connect(filt).connect(this.master);
    const ratios = [1, 1.5, 2, 0.5, 1.005, 1.498];
    for (const r of ratios) {
      const o = ctx.createOscillator(); o.type = r > 1.9 ? 'triangle' : 'sawtooth';
      o.frequency.value = root * r;
      const g = ctx.createGain(); g.gain.value = r === 0.5 ? 0.06 : 0.035;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lg = ctx.createGain(); lg.gain.value = 0.015;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(bus);
      o.start(); lfo.start();
      this.droneNodes.push(o, lfo);
    }
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 4);
    this.droneBus = bus;
  }

  stopDrone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.droneBus) { this.droneBus.gain.cancelScheduledValues(t); this.droneBus.gain.linearRampToValueAtTime(0, t + 1.5); }
    const old = this.droneNodes; this.droneNodes = [];
    setTimeout(() => old.forEach((n) => { try { n.stop(); } catch (_) {} }), 1700);
  }

  _tone(freq, dur, type = 'sine', gain = 0.3, attack = 0.005, decayCurve = 3) {
    this.ensure(); if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setTargetAtTime(0, t + attack, dur / decayCurve);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.1);
  }

  _noise(dur, gain = 0.3, freq = 1200, type = 'bandpass') {
    this.ensure(); if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  chime(step = 0) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
    const f = scale[step % scale.length];
    this._tone(f, 1.2, 'sine', 0.25);
    this._tone(f * 2.01, 0.8, 'sine', 0.08);
    this._tone(f * 3, 0.4, 'triangle', 0.04);
  }

  bell() {
    this._tone(880, 3, 'sine', 0.3, 0.002, 2.5);
    this._tone(880 * 2.76, 2, 'sine', 0.12, 0.002, 2.5);
    this._tone(880 * 5.4, 1, 'sine', 0.05, 0.002, 2.5);
    this._tone(880 * 0.5, 3, 'sine', 0.1, 0.002, 2.5);
  }

  whoosh() { this._noise(0.35, 0.35, 900, 'bandpass'); }
  hit() { this._noise(0.25, 0.5, 300, 'lowpass'); this._tone(110, 0.3, 'square', 0.15); }
  hurt() { this._noise(0.3, 0.4, 500, 'lowpass'); this._tone(160, 0.35, 'sawtooth', 0.12); }
  roar() { this._tone(70, 1.2, 'sawtooth', 0.25, 0.05, 2); this._noise(1.0, 0.3, 200, 'lowpass'); }

  victory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => setTimeout(() => { this._tone(n, 1.6, 'triangle', 0.22); this._tone(n / 2, 1.6, 'sine', 0.1); }, i * 160));
    setTimeout(() => this.bell(), 900);
  }

  divine() {
    for (let i = 0; i < 6; i++) setTimeout(() => this.chime(i), i * 120);
    setTimeout(() => this.bell(), 800);
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.35; }
}
