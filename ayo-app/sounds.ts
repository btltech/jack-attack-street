// ayo-app/sounds.ts - Organic carved-wood Ọpọ́n seed acoustics, relay scoop rattle, & Yorùbá talking-drum / balafon audio (Web Audio API)

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

const getAudio = (): { c: AudioContext; out: AudioNode } | null => {
  if (muted) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;

      masterGain = ctx.createGain();
      masterGain.gain.value = 0.92;
      masterGain.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return { c: ctx, out: masterGain! };
  } catch {
    return null;
  }
};

const getNoiseBuffer = (c: AudioContext): AudioBuffer => {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.25);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuf = buf;
  return buf;
};

export const setAyoMuted = (v: boolean) => { muted = v; };
export const isAyoMuted = () => muted;

// Short filtered noise burst for hard seed shell & wood strike transients
const playWoodClickTransient = (
  c: AudioContext,
  out: AudioNode,
  freq: number,
  dur: number,
  vol: number,
  delay = 0,
  q = 2.8
) => {
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer(c);

  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq, t);
  bp.Q.setValueAtTime(q, t);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.0025);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(bp);
  bp.connect(gain);
  gain.connect(out);
  src.start(t);
  src.stop(t + dur + 0.015);
};

// Warm hollow hardwood resonance (carved Ọpọ́n pit body or balafon bar)
const playWoodBody = (
  c: AudioContext,
  out: AudioNode,
  freq: number,
  dur: number,
  vol: number,
  delay = 0,
  endFreq?: number,
  wave: OscillatorType = 'sine'
) => {
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + dur);
  }

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
};

// Organic Ayò seed (ọmọ ayò) dropping into a carved hardwood pit
// Pitch subtly reflects pit fullness: empty pit = deeper hollow wood, fuller pit = crisp seed-on-seed clack
export const playSeedClack = (stepIndex = 0, pitCountAfter = 1) => {
  const a = getAudio();
  if (!a) return;
  const { c, out } = a;

  const jitter = ((stepIndex * 37) % 7 - 3) * 14;
  const fullnessLift = Math.min(pitCountAfter, 8) * 18;

  // 1. Hollow carved-wood pit thud (310-460 Hz)
  const bodyFreq = 310 + fullnessLift + jitter * 0.5;
  playWoodBody(c, out, bodyFreq, 0.068, 0.24, 0, bodyFreq * 0.72, 'sine');

  // 2. Hard seed shell transient click (2100-3100 Hz)
  const clickFreq = 2200 + fullnessLift * 5 + jitter * 4;
  playWoodClickTransient(c, out, clickFreq, 0.018, 0.34, 0, 3.2);

  // 3. Secondary subtle seed-on-seed micro-bounce if pit already had seeds
  if (pitCountAfter >= 2) {
    playWoodClickTransient(c, out, clickFreq * 1.18, 0.014, 0.2, 0.024, 3.6);
    playWoodBody(c, out, bodyFreq * 1.35, 0.04, 0.11, 0.024, bodyFreq * 1.05, 'triangle');
  }
};

// Tactile multi-seed rattle when scooping seeds from a pit (initial pickup or relay scoop!)
export const playSeedScoop = (seedCount = 4) => {
  const a = getAudio();
  if (!a) return;
  const { c, out } = a;

  const grains = Math.min(6, Math.max(3, seedCount));
  for (let i = 0; i < grains; i++) {
    const delay = i * 0.028;
    const f = 1750 + i * 240;
    playWoodClickTransient(c, out, f, 0.016, 0.22 - i * 0.015, delay, 2.4);
    playWoodBody(c, out, 360 + i * 42, 0.042, 0.1, delay, 260, 'sine');
  }
  // Soft palm-wood brush underneath
  playWoodClickTransient(c, out, 900, 0.085, 0.12, 0.01, 1.1);
};

// Yorùbá Talking-Drum (Gángan / Dùndún) pitch-glide accent + 4-seed wooden capture cascade
export const playCaptureSound = (count = 4) => {
  const a = getAudio();
  if (!a) return;
  const { c, out } = a;

  // 1. Talking drum "gán-gan" double pitch bend (138Hz -> 218Hz -> 176Hz)
  const t = c.currentTime;
  const drum = c.createOscillator();
  const drumGain = c.createGain();
  drum.type = 'triangle';
  drum.frequency.setValueAtTime(138, t);
  drum.frequency.exponentialRampToValueAtTime(218, t + 0.075);
  drum.frequency.exponentialRampToValueAtTime(172, t + 0.24);
  drumGain.gain.setValueAtTime(0.0001, t);
  drumGain.gain.linearRampToValueAtTime(0.32, t + 0.008);
  drumGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  drum.connect(drumGain);
  drumGain.connect(out);
  drum.start(t);
  drum.stop(t + 0.3);

  // Drum skin slap transient
  playWoodClickTransient(c, out, 1450, 0.022, 0.26, 0, 2.0);

  // 2. Warm pentatonic balafon / wooden marimba chime for captured seeds
  const scale = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
  const hits = Math.min(6, Math.max(3, count));
  for (let i = 0; i < hits; i++) {
    const d = 0.05 + i * 0.062;
    const freq = scale[i % scale.length];
    playWoodBody(c, out, freq, 0.24, 0.18, d, undefined, 'sine');
    playWoodBody(c, out, freq * 2, 0.12, 0.06, d, undefined, 'triangle');
    playWoodClickTransient(c, out, freq * 3.2, 0.014, 0.14, d, 3.0);
  }
};

// Subtle wooden UI tap
export const playAyoClick = () => {
  const a = getAudio();
  if (!a) return;
  const { c, out } = a;
  playWoodBody(c, out, 540, 0.04, 0.13, 0, 380, 'sine');
  playWoodClickTransient(c, out, 2400, 0.012, 0.16, 0, 3.0);
};

// Joyful West African balafon & talking-drum victory flourish
export const playAyoWinSound = () => {
  const a = getAudio();
  if (!a) return;
  const { c, out } = a;

  const notes = [392.0, 493.88, 587.33, 783.99, 987.77];
  notes.forEach((f, i) => {
    const d = i * 0.105;
    playWoodBody(c, out, f, 0.42, 0.2, d, undefined, 'sine');
    playWoodBody(c, out, f * 2, 0.18, 0.065, d, undefined, 'triangle');
    playWoodClickTransient(c, out, f * 2.5, 0.016, 0.12, d, 2.8);
  });
  // Celebratory talking-drum bass lift
  playWoodBody(c, out, 146.83, 0.34, 0.26, 0.32, 220, 'triangle');
};

// Warm, respectful "Good Game!" balafon cadence (never a harsh buzzer)
export const playAyoGoodGameSound = () => {
  const a = getAudio();
  if (!a) return;
  const { c, out } = a;

  const cadence = [
    { f: 440.0, d: 0.0, len: 0.28 },
    { f: 392.0, d: 0.16, len: 0.28 },
    { f: 523.25, d: 0.34, len: 0.48 },
  ];
  cadence.forEach(({ f, d, len }) => {
    playWoodBody(c, out, f, len, 0.17, d, undefined, 'sine');
    playWoodBody(c, out, f * 2, len * 0.45, 0.05, d, undefined, 'triangle');
    playWoodClickTransient(c, out, 1900, 0.014, 0.09, d, 2.4);
  });
};
