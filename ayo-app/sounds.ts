// ayo-app/sounds.ts - Warm wooden ọpọ́n seed-clack percussion & celebration audio (Web Audio API)

let ctx: AudioContext | null = null;
let muted = false;

const getCtx = (): AudioContext | null => {
  if (muted) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
};

export const setAyoMuted = (v: boolean) => { muted = v; };
export const isAyoMuted = () => muted;

const playWoodTone = (freq: number, dur: number, vol = 0.22, delay = 0, endFreq?: number) => {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq * 1.4, t);
  filter.Q.setValueAtTime(2.2, t);

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + dur);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
};

// Warm wooden seed dropping into carved mahogany pit
export const playSeedClack = (stepIndex = 0) => {
  const c = getCtx();
  if (!c) return;
  const pitch = 780 + ((stepIndex * 53) % 240);
  playWoodTone(pitch, 0.055, 0.22, 0, pitch * 0.68);
  playWoodTone(pitch * 0.35, 0.045, 0.14, 0, 120);
};

// Rising marimba / talking-drum capture cascade
export const playCaptureSound = (count = 2) => {
  const scale = [392, 440, 523.25, 587.33, 659.25, 783.99];
  const hits = Math.min(6, Math.max(2, count));
  for (let i = 0; i < hits; i++) {
    playWoodTone(scale[i % scale.length], 0.18, 0.2, i * 0.065);
  }
};

export const playAyoClick = () => {
  playWoodTone(620, 0.04, 0.12, 0, 460);
};

// Joyful victory celebration
export const playAyoWinSound = () => {
  const notes = [392, 493.88, 587.33, 783.99, 987.77];
  notes.forEach((f, i) => playWoodTone(f, 0.32, 0.2, i * 0.095));
};

// Warm, respectful "Good Game!" resolve (never a harsh buzzer)
export const playAyoGoodGameSound = () => {
  playWoodTone(440, 0.24, 0.16, 0);
  playWoodTone(392, 0.24, 0.16, 0.13);
  playWoodTone(523.25, 0.4, 0.18, 0.26);
};
