// dice-app/sounds.ts - Street Dice sound, synthesised with Web Audio (no audio files to download).
// A roll is a rattle of dice in a cup that ends in two clacks on a table; banking is a coin chime that
// climbs with the size of the pot; a bust is a low thud with a falling buzz.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const MUTE_KEY = 'dice-muted';
const readMuted = (): boolean => {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
};
let muted = readMuted();

export const setDiceMuted = (v: boolean) => {
  muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
};
export const isDiceMuted = () => muted;

const getCtx = (): AudioContext | null => {
  if (muted) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 20;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.16;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -4;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      comp.connect(limiter);
      limiter.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
};

const getNoise = (c: BaseAudioContext): AudioBuffer => {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.4);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const noise = (c: AudioContext, o: { freq: number; dur: number; vol: number; delay?: number; q?: number; pan?: number }) => {
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = o.freq;
  f.Q.value = o.q ?? 3;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f);
  f.connect(g);
  let out: AudioNode = g;
  if (o.pan && typeof c.createStereoPanner === 'function') {
    const p = c.createStereoPanner();
    p.pan.value = o.pan;
    g.connect(p);
    out = p;
  }
  out.connect(master!);
  src.start(t, Math.random() * 0.2);
  src.stop(t + o.dur + 0.02);
};

const tone = (c: AudioContext, o: { freq: number; dur: number; vol: number; delay?: number; endFreq?: number; wave?: OscillatorType }) => {
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.wave ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, t + o.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g);
  g.connect(master!);
  osc.start(t);
  osc.stop(t + o.dur + 0.03);
};

/** Dice shaken in a cup, then two clacks as they land (~0.6s). */
export const playRoll = () => {
  const c = getCtx();
  if (!c) return;
  for (let i = 0; i < 9; i++) {
    noise(c, { freq: rand(2200, 5200), dur: rand(0.025, 0.05), vol: rand(0.28, 0.5), delay: i * 0.045 + rand(0, 0.02), q: 4, pan: rand(-0.4, 0.4) });
  }
  // landing: a wooden clack for each die, slightly apart
  for (let k = 0; k < 2; k++) {
    const at = 0.46 + k * rand(0.06, 0.1);
    noise(c, { freq: rand(900, 1500), dur: 0.07, vol: 0.9, delay: at, q: 1.6, pan: k ? 0.3 : -0.3 });
    tone(c, { freq: rand(150, 210), endFreq: 90, dur: 0.1, vol: 0.5, delay: at, wave: 'triangle' });
  }
};

/** Coins in the bank. Bigger pots ring higher and add a third note. */
export const playBank = (pot: number) => {
  const c = getCtx();
  if (!c) return;
  const base = 520 * Math.pow(2, Math.min(pot, 60) / 60 * 0.6); // up to about a third higher
  const notes = pot >= 20 ? [1, 1.25, 1.5, 2] : pot >= 8 ? [1, 1.25, 1.5] : [1, 1.5];
  notes.forEach((m, i) => {
    tone(c, { freq: base * m, dur: 0.45, vol: 0.32, delay: i * 0.075, wave: 'triangle' });
    tone(c, { freq: base * m * 2.01, dur: 0.25, vol: 0.1, delay: i * 0.075, wave: 'sine' });
  });
  noise(c, { freq: 6500, dur: 0.12, vol: 0.18, delay: 0.02, q: 6 });
};

/** A bust: a thud, a falling buzz, a little rubble. */
export const playBust = () => {
  const c = getCtx();
  if (!c) return;
  tone(c, { freq: 140, endFreq: 42, dur: 0.35, vol: 0.9, wave: 'sine' });
  tone(c, { freq: 260, endFreq: 70, dur: 0.5, vol: 0.28, delay: 0.03, wave: 'sawtooth' });
  noise(c, { freq: 700, dur: 0.22, vol: 0.5, delay: 0.02, q: 0.8 });
};

/** Doubles: a quick bright sparkle on top of the roll. */
export const playDoubles = () => {
  const c = getCtx();
  if (!c) return;
  [880, 1175, 1568, 2093].forEach((f, i) => tone(c, { freq: f, dur: 0.18, vol: 0.16, delay: 0.62 + i * 0.05, wave: 'sine' }));
};

export const playClick = () => {
  const c = getCtx();
  if (!c) return;
  noise(c, { freq: 1800, dur: 0.04, vol: 0.5, q: 2 });
  tone(c, { freq: 420, endFreq: 300, dur: 0.06, vol: 0.2, wave: 'triangle' });
};

/** End of game: a rising run, bigger for a better score (0..1). */
export const playFinish = (quality: number) => {
  const c = getCtx();
  if (!c) return;
  const run = quality > 0.55 ? [0, 4, 7, 12, 16] : quality > 0.3 ? [0, 4, 7, 12] : [0, 3, 7];
  run.forEach((semi, i) => tone(c, { freq: 392 * Math.pow(2, semi / 12), dur: 0.5, vol: 0.28, delay: i * 0.11, wave: 'triangle' }));
};

/** Small haptic tap on phones that support it. */
export const buzz = (ms: number | number[]) => {
  try { if (!muted && navigator.vibrate) navigator.vibrate(ms); } catch { /* unsupported */ }
};
