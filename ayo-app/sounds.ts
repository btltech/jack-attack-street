// ayo-app/sounds.ts - Synthesised Ayò Ọlọ́pọ́n sound: a wooden board you can play like an instrument.
//
// Every pit has its own pitch (a pentatonic scale laid along the board in sowing order), so sowing
// plays a little run of notes that travels around the board, panned to where the pit is. Seeds make a
// hollow wood "thock" plus a tuned marimba-style ring, scooping is a palm sweep and seed rattle,
// captures are a talking-drum hit with a pouring cascade, and a short room reverb ties it together.
// Everything is generated with the Web Audio API: no audio files to download.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbIn: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const MUTE_KEY = 'ayo-muted';
const readMuted = (): boolean => {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
};
let muted = readMuted();

// A small wooden room: decaying noise, a little under a second long.
const makeImpulse = (c: BaseAudioContext): AudioBuffer => {
  const len = Math.floor(c.sampleRate * 0.7);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
  }
  return buf;
};

const getAudio = (): { c: AudioContext } | null => {
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

      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      // Brick-wall limiter so a burst of overlapping sounds (a long relay) can never clip.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -4;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      comp.connect(limiter);
      limiter.connect(ctx.destination);

      const verb = ctx.createConvolver();
      verb.buffer = makeImpulse(ctx);
      reverbIn = ctx.createGain();
      reverbIn.gain.value = 1;
      const verbOut = ctx.createGain();
      verbOut.gain.value = 0.55;
      reverbIn.connect(verb);
      verb.connect(verbOut);
      verbOut.connect(comp);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return { c: ctx };
  } catch {
    return null;
  }
};

const getNoiseBuffer = (c: BaseAudioContext): AudioBuffer => {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
};

export const setAyoMuted = (v: boolean) => {
  muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
};
export const isAyoMuted = () => muted;

// ---------------------------------------------------------------------------
// Voice bus: one per sound event, so each can have its own stereo position and reverb amount.
// ---------------------------------------------------------------------------
const voice = (c: AudioContext, pan = 0, wet = 0.2, gain = 1): GainNode => {
  const input = c.createGain();
  input.gain.value = gain;
  let node: AudioNode = input;
  if (typeof c.createStereoPanner === 'function' && pan !== 0) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    input.connect(p);
    node = p;
  }
  node.connect(master!);
  if (wet > 0 && reverbIn) {
    const send = c.createGain();
    send.gain.value = wet;
    node.connect(send);
    send.connect(reverbIn);
  }
  return input;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Short burst of filtered noise: seed shells, wood strikes, rattles and sweeps. */
const noise = (
  c: AudioContext, out: AudioNode,
  o: { freq: number; dur: number; vol: number; delay?: number; q?: number; endFreq?: number; type?: BiquadFilterType; attack?: number },
) => {
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq, t);
  if (o.endFreq) f.frequency.exponentialRampToValueAtTime(o.endFreq, t + o.dur);
  f.Q.value = o.q ?? 2.5;
  const g = c.createGain();
  const attack = o.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t, Math.random() * 0.2);
  src.stop(t + o.dur + 0.02);
};

/** A single decaying tone, optionally gliding: drum bodies, bowl hollows. */
const tone = (
  c: AudioContext, out: AudioNode,
  o: { freq: number; dur: number; vol: number; delay?: number; endFreq?: number; wave?: OscillatorType; attack?: number },
) => {
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.wave ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.endFreq), t + o.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.vol, t + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + o.dur + 0.03);
};

// Marimba-like bar: a fundamental plus the inharmonic overtones that make wood sound like wood.
const BAR_PARTIALS: Array<[number, number, number]> = [
  // [frequency ratio, relative level, relative decay]
  [1, 1, 1],
  [3.98, 0.32, 0.42],
  [9.7, 0.09, 0.16],
];
const bar = (c: AudioContext, out: AudioNode, freq: number, vol: number, dur: number, delay = 0) => {
  for (const [ratio, level, decay] of BAR_PARTIALS) {
    if (freq * ratio > 9000) continue;
    tone(c, out, { freq: freq * ratio, dur: Math.max(0.05, dur * decay), vol: vol * level, delay, attack: 0.003 });
  }
};

// Pentatonic ladder laid along the board in sowing order (pits 0..11), G major pentatonic from G3.
const PENTA = [0, 2, 4, 7, 9];
const noteFor = (degree: number, base = 196): number => {
  const d = Math.max(0, degree);
  return base * Math.pow(2, (12 * Math.floor(d / 5) + PENTA[d % 5]) / 12);
};
/** Left-to-right position of a pit on screen, as a stereo pan from -0.7 to 0.7. */
const panFor = (pit: number): number => {
  const col = pit <= 5 ? pit : 11 - pit; // your row runs left to right, theirs right to left
  return (col / 5) * 1.4 - 0.7;
};

// ---------------------------------------------------------------------------
// Game sounds
// ---------------------------------------------------------------------------

/**
 * One seed dropping into a pit. Pitch follows the pit's place on the board; a fuller pit adds a seed-on-seed
 * rattle; the last seed of a move rings longer. `pit` is optional so old call sites still work.
 */
export const playSeedClack = (stepIndex = 0, pitCountAfter = 1, pit?: number, isLast = false) => {
  const a = getAudio();
  if (!a) return;
  const { c } = a;
  const out = voice(c, pit === undefined ? 0 : panFor(pit), isLast ? 0.34 : 0.18, 4.5);
  const v = rand(0.9, 1.1);

  // Hollow carved-bowl thock, a little deeper for an empty pit and brighter as it fills.
  const body = 175 + Math.min(pitCountAfter, 8) * 14 + (((stepIndex * 37) % 7) - 3) * 6;
  tone(c, out, { freq: body, endFreq: body * 0.66, dur: 0.075, vol: 0.26 * v });
  // Seed shell against wood.
  noise(c, out, { freq: rand(2100, 3000), dur: 0.016, vol: 0.3 * v, q: 3.2 });
  // The tuned ring, so a sow plays a run of notes.
  if (pit !== undefined) bar(c, out, noteFor(pit), 0.11 * v, isLast ? 0.55 : 0.3);
  // Seeds already in the pit scatter.
  if (pitCountAfter >= 2) {
    const grains = Math.min(3, pitCountAfter - 1);
    for (let i = 0; i < grains; i++) {
      noise(c, out, { freq: rand(3200, 5200), dur: 0.012, vol: 0.11, delay: 0.012 + i * rand(0.014, 0.024), q: 3.6 });
    }
  }
};

/** Lifting a handful of seeds: a palm sweep over a loose rattle. `relay` is higher and quicker (the chain goes on). */
export const playSeedScoop = (seedCount = 4, relay = false) => {
  const a = getAudio();
  if (!a) return;
  const { c } = a;
  const out = voice(c, 0, relay ? 0.26 : 0.16, relay ? 2.2 : 3.2);

  noise(c, out, {
    freq: relay ? 900 : 500, endFreq: relay ? 2700 : 1500, dur: relay ? 0.13 : 0.19,
    vol: 0.13, q: 1.2, attack: 0.04,
  });
  tone(c, out, { freq: relay ? 300 : 240, endFreq: 150, dur: 0.06, vol: 0.14 });

  const grains = Math.min(9, Math.max(3, seedCount));
  for (let i = 0; i < grains; i++) {
    noise(c, out, {
      freq: rand(1500, 3200), dur: 0.015, vol: Math.max(0.05, 0.17 - i * 0.012),
      delay: 0.02 + i * 0.022 + rand(0, 0.012), q: 2.4,
    });
  }
  if (relay) {
    // A bright two-note "and on we go".
    bar(c, out, 659.25, 0.09, 0.22, 0.05);
    bar(c, out, 880, 0.08, 0.26, 0.12);
  }
};

/**
 * A capture: talking-drum hit, seeds pouring away, and a marimba phrase. `good` is the sound of taking seeds;
 * when it is the opponent taking yours it is darker, lower and shorter.
 */
export const playCaptureSound = (count = 4, good = true) => {
  const a = getAudio();
  if (!a) return;
  const { c } = a;
  const out = voice(c, 0, 0.3, 1.25);
  const big = count >= 6;

  // Talking drum ("gángan"): pitch bends up when you win seeds, down when you lose them.
  const [f0, f1, f2] = good ? [128, 205, 165] : [190, 120, 96];
  const t = c.currentTime;
  const drum = c.createOscillator();
  const drumGain = c.createGain();
  drum.type = 'triangle';
  drum.frequency.setValueAtTime(f0, t);
  drum.frequency.exponentialRampToValueAtTime(f1, t + 0.07);
  drum.frequency.exponentialRampToValueAtTime(f2, t + 0.26);
  drumGain.gain.setValueAtTime(0.0001, t);
  drumGain.gain.linearRampToValueAtTime(good ? 0.4 : 0.34, t + 0.007);
  drumGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  drum.connect(drumGain);
  drumGain.connect(out);
  drum.start(t);
  drum.stop(t + 0.36);
  tone(c, out, { freq: f2 * 0.5, dur: 0.22, vol: 0.3, delay: 0.01 }); // chest of the drum
  noise(c, out, { freq: 1500, dur: 0.024, vol: 0.28, q: 1.8 });       // skin slap

  // The captured seeds pour away: a quick descending shower of grains.
  const grains = Math.min(18, 5 + Math.round(count * 1.6));
  const span = Math.min(0.5, 0.16 + count * 0.04);
  for (let i = 0; i < grains; i++) {
    const p = i / grains;
    noise(c, out, {
      freq: 3400 - p * 1900 + rand(-200, 200), dur: 0.014, vol: 0.13 * (1 - p * 0.5),
      delay: 0.07 + p * span + rand(0, 0.012), q: 2.8,
    });
  }

  if (good) {
    const notes = Math.min(5, 2 + Math.floor(count / 2));
    for (let i = 0; i < notes; i++) bar(c, out, noteFor(5 + i * 2 - (i > 2 ? 1 : 0), 261.63), 0.15, 0.5, 0.1 + i * 0.075);
    if (big) {
      // A second drum answer for a big capture.
      tone(c, out, { freq: 110, endFreq: 150, dur: 0.24, vol: 0.34, delay: 0.2, wave: 'triangle' });
      noise(c, out, { freq: 1300, dur: 0.02, vol: 0.24, delay: 0.2, q: 1.8 });
    }
  } else {
    // Two soft falling notes: a wince, not a buzzer.
    bar(c, out, 329.63, 0.1, 0.4, 0.14);
    bar(c, out, 261.63, 0.09, 0.5, 0.26);
  }
};

/** Soft two-note wood chime: it is your turn. */
export const playYourTurn = () => {
  const a = getAudio();
  if (!a) return;
  const { c } = a;
  const out = voice(c, 0, 0.25, 2.2);
  bar(c, out, 587.33, 0.07, 0.3);
  bar(c, out, 783.99, 0.07, 0.4, 0.09);
};

/** Subtle wooden UI tap. */
export const playAyoClick = () => {
  const a = getAudio();
  if (!a) return;
  const { c } = a;
  const out = voice(c, 0, 0.08, 3.5);
  tone(c, out, { freq: 540, endFreq: 380, dur: 0.04, vol: 0.13 });
  noise(c, out, { freq: 2400, dur: 0.012, vol: 0.16, q: 3.0 });
};

/** Victory: a rising marimba run, drum accents, then a held chord. */
export const playAyoWinSound = () => {
  const a = getAudio();
  if (!a) return;
  const { c } = a;
  const out = voice(c, 0, 0.38);

  tone(c, out, { freq: 120, endFreq: 190, dur: 0.22, vol: 0.34, wave: 'triangle' });
  noise(c, out, { freq: 1400, dur: 0.022, vol: 0.24, q: 1.8 });
  const run = [5, 7, 8, 10, 12, 13, 15];
  run.forEach((deg, i) => bar(c, out, noteFor(deg, 196), 0.16, 0.5, 0.18 + i * 0.085));
  tone(c, out, { freq: 130, endFreq: 175, dur: 0.26, vol: 0.32, delay: 0.5, wave: 'triangle' });
  noise(c, out, { freq: 1500, dur: 0.02, vol: 0.22, delay: 0.5, q: 1.8 });
  // Held chord: G, B, D, G.
  [392, 493.88, 587.33, 783.99].forEach((f) => bar(c, out, f, 0.13, 1.1, 0.8));
};

/** Warm, respectful "good game" cadence. Never a harsh buzzer. */
export const playAyoGoodGameSound = () => {
  const a = getAudio();
  if (!a) return;
  const { c } = a;
  const out = voice(c, 0, 0.35);
  bar(c, out, 440, 0.13, 0.5, 0);
  bar(c, out, 392, 0.13, 0.5, 0.17);
  bar(c, out, 523.25, 0.14, 0.9, 0.36);
  tone(c, out, { freq: 120, endFreq: 100, dur: 0.3, vol: 0.2, delay: 0.36, wave: 'triangle' });
};
