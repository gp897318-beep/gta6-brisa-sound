// BRISA SOUND — audio.js: all game sound, synthesized with WebAudio.
// Engine hum, police siren, gunshots, radio music, UI blips. Everything is
// synthesized — no audio files, no network.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioOn = true;
    this.station = 0;
    this.stations = ['NEON 98.7 FM', 'BRISA WAVE 104.3', 'PALM TALK 1210 AM'];
    this.musicTimer = null;
    this.step = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    // Engine: low sawtooth whose pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Siren: two-tone triangle, quiet until wanted.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.startRadio();
  }

  setEngine(speedNorm, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedNorm * 0.06 : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + speedNorm * 130, t, 0.08);
  }

  setSiren(wanted) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = wanted > 0;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0.0, t, 0.3);
    if (on) {
      const phase = (t % 1.2) < 0.6 ? 720 : 960;
      this.sirenOsc.frequency.setTargetAtTime(phase, t, 0.05);
    }
  }

  blip(freq = 880, dur = 0.08, vol = 0.12) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  gunshot() {
    if (!this.ctx) return;
    const len = 0.12;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.35;
    src.connect(g); g.connect(this.master);
    src.start();
  }

  crash(intensity = 1) {
    if (!this.ctx) return;
    const len = 0.25;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * intensity;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain(); g.gain.value = 0.5;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  // Tiny synthwave loop: bass + arpeggio, station changes the root note.
  startRadio() {
    if (this.musicTimer) return;
    const roots = [55, 49, 65.41];
    const scale = [0, 3, 5, 7, 10, 12];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || !this.radioOn) return;
      const root = roots[this.station % roots.length];
      const note = scale[this.step % scale.length];
      const freq = root * Math.pow(2, note / 12) * 2;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = this.step % 4 === 0 ? 'triangle' : 'sawtooth';
      o.frequency.value = this.step % 4 === 0 ? root : freq;
      g.gain.setValueAtTime(0.05, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + 0.24);
      this.step++;
    }, 170);
  }

  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    this.blip(660, 0.1, 0.1);
    return this.stations[this.station];
  }

  currentStation() { return this.stations[this.station % this.stations.length]; }
}
