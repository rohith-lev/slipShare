// Audio player for official Blip sounds (Chime, Out, Fail, Resolve)
// with Web Audio API synthesizer as graceful zero-latency fallback

const audioCache = {};

function playAudioFile(path, isMuted) {
  if (isMuted || typeof window === 'undefined') return;
  try {
    if (!audioCache[path]) {
      audioCache[path] = new Audio(path);
    }
    const audio = audioCache[path];
    audio.currentTime = 0;
    audio.volume = 0.75;
    audio.play().catch(() => {
      // Audio playback blocked by browser gesture policy, fallback to synth
      playSynthChime();
    });
  } catch {
    playSynthChime();
  }
}

/**
 * Play official Blip Chime (when file / note is received)
 */
export function playBlipSound(isMuted = false) {
  playAudioFile('/sounds/Chime.wav', isMuted);
}

/**
 * Play official Blip Out sound (when file / note is sent)
 */
export function playOutSound(isMuted = false) {
  playAudioFile('/sounds/Out.wav', isMuted);
}

/**
 * Play official Blip tap/resolve
 */
export function playTapSound(isMuted = false) {
  playAudioFile('/sounds/Resolve.wav', isMuted);
}

/**
 * Play official Blip fail sound (when transfer or action fails)
 */
export function playFailSound(isMuted = false) {
  playAudioFile('/sounds/Fail.wav', isMuted);
}

// Fallback Synthesizer
let audioCtx = null;
function playSynthChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Ignore audio context errors
  }
}
