// core/sounds.ts - Rich, warm Web Audio API studio-synthesized SFX & lofi groove (zero external files)

let audioContext: AudioContext | null = null;
let backgroundMusicInterval: number | null = null;
let isMusicEnabled = false;

const getAudioContext = (): AudioContext | null => {
  try {
    if (!audioContext) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContext = new Ctx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
};

// Warm tone with soft attack (prevents harsh clicks) and optional pitch glide
const playWarmTone = (
  startFreq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.2,
  delay: number = 0,
  endFreq?: number
) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, t0);

  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, t0);
  if (endFreq && endFreq !== startFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
  }

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + Math.min(0.015, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
};

// Filtered noise burst for tactile paper snap / card slide / riffle shuffle
const playFilteredNoise = (
  duration: number,
  volume: number = 0.12,
  filterType: BiquadFilterType = 'bandpass',
  startFreq: number = 1800,
  endFreq: number = 800,
  delay: number = 0
) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const t0 = ctx.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(startFreq, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(100, endFreq), t0 + duration);
  filter.Q.setValueAtTime(1.2, t0);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(t0);
  noise.stop(t0 + duration + 0.01);
};

// --- EXPORTED SOUND EFFECTS ---

export const playCardSound = () => {
  // Tactile card snap on table: crisp paper flick + soft felt thump
  playFilteredNoise(0.055, 0.16, 'bandpass', 2200, 900, 0);
  playWarmTone(165, 0.075, 'sine', 0.18, 0, 68);
};

export const playDrawSound = () => {
  // Soft paper slide off the deck + gentle pop
  playFilteredNoise(0.09, 0.1, 'highpass', 2600, 1400, 0);
  playWarmTone(380, 0.08, 'sine', 0.09, 0.02, 520);
};

export const playShuffleSound = () => {
  // Properly staggered riffle-shuffle cascade
  for (let i = 0; i < 9; i++) {
    const d = i * 0.042;
    playFilteredNoise(0.038, 0.09, 'bandpass', 1600 + i * 90, 900, d);
    playWarmTone(140 + i * 12, 0.03, 'sine', 0.05, d, 80);
  }
};

export const playAttackSound = () => {
  // Punchy sub-bass impact + crisp hype chord (exciting, never grating)
  playWarmTone(145, 0.24, 'sine', 0.3, 0, 42);
  playFilteredNoise(0.11, 0.14, 'bandpass', 1200, 320, 0);
  playWarmTone(330, 0.16, 'triangle', 0.14, 0.03, 294);
  playWarmTone(440, 0.18, 'triangle', 0.12, 0.06, 392);
};

export const playWinSound = () => {
  // Lush warm major-9th victory fanfare
  const notes = [523.25, 659.25, 783.99, 987.77, 1046.5]; // C5 E5 G5 B5 C6
  notes.forEach((freq, i) => {
    const d = i * 0.1;
    playWarmTone(freq, 0.42, 'triangle', 0.18, d);
    playWarmTone(freq * 0.5, 0.45, 'sine', 0.1, d);
  });
  // Soft sparkle chord on final note
  playWarmTone(1318.5, 0.5, 'sine', 0.08, 0.46);
  playWarmTone(1567.98, 0.5, 'sine', 0.06, 0.5);
};

export const playLoseSound = () => {
  // Warm, respectful "Good Game!" resolve chime (encouraging, never a sad buzzer)
  playWarmTone(440, 0.28, 'sine', 0.13, 0);        // A4
  playWarmTone(392, 0.28, 'sine', 0.13, 0.14);     // G4
  playWarmTone(523.25, 0.45, 'triangle', 0.14, 0.28); // C5 (warm uplifting lift!)
  playWarmTone(659.25, 0.45, 'sine', 0.08, 0.3);   // E5 (gentle major warmth)
};

export const playEncourageSound = () => {
  // Gentle uplifting 2-note chime for defenses, comebacks & encouragement
  playWarmTone(523.25, 0.14, 'sine', 0.11, 0);
  playWarmTone(659.25, 0.2, 'triangle', 0.12, 0.09);
};

export const playClickSound = () => {
  // Soft tactile wooden UI tap
  playWarmTone(720, 0.038, 'sine', 0.08, 0, 520);
};

export const playSkipSound = () => {
  playWarmTone(620, 0.11, 'sine', 0.12, 0, 380);
  playFilteredNoise(0.07, 0.07, 'bandpass', 1800, 900, 0);
};

export const playReverseSound = () => {
  playWarmTone(360, 0.12, 'sine', 0.12, 0, 680);
  playFilteredNoise(0.07, 0.07, 'bandpass', 900, 1900, 0);
};

export const playPowerUpSound = () => {
  // Shimmering power-up chime
  const notes = [440, 554.37, 659.25, 880];
  notes.forEach((f, i) => playWarmTone(f, 0.22, 'triangle', 0.13, i * 0.065));
};

export const playComboSound = () => {
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((f, i) => playWarmTone(f, 0.14, 'triangle', 0.13, i * 0.055));
};

export const playChallengeCompleteSound = () => {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => playWarmTone(f, 0.25, 'triangle', 0.16, i * 0.09));
  playWarmTone(1318.5, 0.35, 'sine', 0.09, 0.38);
};

export const playCoinsSound = () => {
  // Crisp pleasant coin chime (triangle instead of harsh square)
  playWarmTone(1174.66, 0.1, 'triangle', 0.12, 0);
  playWarmTone(1567.98, 0.18, 'sine', 0.13, 0.07);
};

// --- SMOOTH LOFI BACKGROUND GROOVE ---

const chordProgressions = [
  { root: 130.81, notes: [261.63, 329.63, 392.0, 493.88] },  // Cmaj7
  { root: 110.0,  notes: [220.0, 261.63, 329.63, 392.0] },   // Am7
  { root: 146.83, notes: [293.66, 349.23, 440.0, 523.25] },  // Dm7
  { root: 196.0,  notes: [246.94, 293.66, 392.0, 440.0] },   // G6
];

let currentChordIndex = 0;

const playBackgroundChord = () => {
  if (!isMusicEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const { root, notes } = chordProgressions[currentChordIndex];
  const t0 = ctx.currentTime;

  // Warm soft bass root
  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(root, t0);
  bassGain.gain.setValueAtTime(0.0001, t0);
  bassGain.gain.linearRampToValueAtTime(0.035, t0 + 0.3);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
  bass.connect(bassGain);
  bassGain.connect(ctx.destination);
  bass.start(t0);
  bass.stop(t0 + 3.5);

  // Soft Rhodes-like pad chord
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t0);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0 + i * 0.06);
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.06);
    gain.gain.linearRampToValueAtTime(0.018, t0 + i * 0.06 + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0 + i * 0.06);
    osc.stop(t0 + 3.5);
  });

  currentChordIndex = (currentChordIndex + 1) % chordProgressions.length;
};

export const startBackgroundMusic = () => {
  if (backgroundMusicInterval) return;
  isMusicEnabled = true;
  playBackgroundChord();
  backgroundMusicInterval = window.setInterval(playBackgroundChord, 3600);
};

export const stopBackgroundMusic = () => {
  isMusicEnabled = false;
  if (backgroundMusicInterval) {
    clearInterval(backgroundMusicInterval);
    backgroundMusicInterval = null;
  }
};

export const toggleBackgroundMusic = (): boolean => {
  if (isMusicEnabled) {
    stopBackgroundMusic();
  } else {
    startBackgroundMusic();
  }
  return isMusicEnabled;
};

export const isMusicPlaying = (): boolean => isMusicEnabled;

export const initAudio = () => {
  getAudioContext();
};
