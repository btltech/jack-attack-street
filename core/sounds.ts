// core/sounds.ts - Web Audio API synthesized sounds (no external files needed)

let audioContext: AudioContext | null = null;
let backgroundMusicInterval: number | null = null;
let isMusicEnabled = false;
let currentMusicGain: GainNode | null = null;

const getAudioContext = (): AudioContext => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
};

// Utility to create a simple beep/tone
const playTone = (
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.3,
    delay: number = 0
) => {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + delay);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);

    oscillator.start(ctx.currentTime + delay);
    oscillator.stop(ctx.currentTime + delay + duration);
};

// Utility to create noise (for shuffle sound)
const playNoise = (duration: number, volume: number = 0.1) => {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    noise.start();
    noise.stop(ctx.currentTime + duration);
};

// Play a chord (multiple notes)
const playChord = (frequencies: number[], duration: number, volume: number = 0.05) => {
    frequencies.forEach(freq => {
        playTone(freq, duration, 'sine', volume);
    });
};

// --- EXPORTED SOUND FUNCTIONS ---

export const playCardSound = () => {
    // Quick snap sound - like a card hitting the table
    playTone(800, 0.08, 'square', 0.15);
    playNoise(0.05, 0.08);
};

export const playDrawSound = () => {
    // Soft sliding sound
    playTone(300, 0.12, 'sine', 0.1);
    playNoise(0.08, 0.05);
};

export const playShuffleSound = () => {
    // Rapid sequence of card sounds
    for (let i = 0; i < 8; i++) {
        playNoise(0.04, 0.06);
        playTone(600 + Math.random() * 400, 0.03, 'square', 0.08, i * 0.05);
    }
};

export const playAttackSound = () => {
    // Aggressive alarm/buzz - danger!
    playTone(200, 0.15, 'sawtooth', 0.25);
    playTone(150, 0.15, 'sawtooth', 0.2, 0.05);
    playTone(250, 0.2, 'square', 0.15, 0.1);
};

export const playWinSound = () => {
    // Triumphant ascending fanfare
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        playTone(freq, 0.3, 'sine', 0.2, i * 0.12);
        playTone(freq * 1.5, 0.25, 'triangle', 0.1, i * 0.12 + 0.05);
    });
};

export const playLoseSound = () => {
    // Sad descending tones
    const notes = [400, 350, 300, 250];
    notes.forEach((freq, i) => {
        playTone(freq, 0.35, 'sine', 0.15, i * 0.2);
    });
};

export const playClickSound = () => {
    // Subtle UI click
    playTone(1000, 0.04, 'sine', 0.1);
};

export const playSkipSound = () => {
    // Woosh sound for skip
    playTone(800, 0.1, 'sine', 0.15);
    playTone(400, 0.1, 'sine', 0.1, 0.05);
};

export const playReverseSound = () => {
    // Reverse whoosh
    playTone(300, 0.1, 'sine', 0.15);
    playTone(600, 0.1, 'sine', 0.1, 0.05);
};

// --- NEW SOUND EFFECTS ---

export const playPowerUpSound = () => {
    // Magical power-up sound for Queen/King/7
    playTone(440, 0.15, 'sine', 0.15);
    playTone(554, 0.15, 'sine', 0.12, 0.08);
    playTone(659, 0.2, 'triangle', 0.15, 0.15);
    playTone(880, 0.25, 'sine', 0.1, 0.22);
};

export const playComboSound = () => {
    // Quick ascending combo - for streaks and bonuses
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
        playTone(freq, 0.1, 'triangle', 0.15, i * 0.06);
    });
};

export const playChallengeCompleteSound = () => {
    // Achievement unlocked type sound
    playTone(523, 0.15, 'sine', 0.2);
    playTone(659, 0.15, 'sine', 0.18, 0.1);
    playTone(784, 0.15, 'sine', 0.16, 0.2);
    playTone(1047, 0.3, 'triangle', 0.2, 0.3);
    // Add shimmer
    for (let i = 0; i < 5; i++) {
        playTone(1500 + i * 200, 0.08, 'sine', 0.05, 0.4 + i * 0.05);
    }
};

export const playCoinsSound = () => {
    // Coin collect sound
    playTone(1200, 0.08, 'square', 0.1);
    playTone(1400, 0.08, 'square', 0.08, 0.05);
    playTone(1600, 0.1, 'sine', 0.1, 0.1);
};

// --- BACKGROUND MUSIC ---

// Lofi-style chord progressions (frequencies for simple chords)
const chordProgressions = [
    [261.63, 329.63, 392.00], // C major
    [293.66, 369.99, 440.00], // D minor
    [329.63, 415.30, 493.88], // E minor
    [349.23, 440.00, 523.25], // F major
    [392.00, 493.88, 587.33], // G major
    [440.00, 523.25, 659.25], // A minor
];

let currentChordIndex = 0;

const playBackgroundChord = () => {
    if (!isMusicEnabled) return;

    const chord = chordProgressions[currentChordIndex];
    const ctx = getAudioContext();

    // Play soft pad chord
    chord.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

        // Soft attack and release
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.5);
        gainNode.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 2);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 3);
    });

    // Simple arpeggio overlay
    chord.forEach((freq, i) => {
        playTone(freq * 2, 0.3, 'triangle', 0.02, 0.5 + i * 0.3);
    });

    currentChordIndex = (currentChordIndex + 1) % chordProgressions.length;
};

export const startBackgroundMusic = () => {
    if (backgroundMusicInterval) return; // Already playing

    isMusicEnabled = true;
    playBackgroundChord(); // Play immediately
    backgroundMusicInterval = window.setInterval(playBackgroundChord, 4000);
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

// Initialize audio on first user interaction (required by browsers)
export const initAudio = () => {
    getAudioContext();
};
