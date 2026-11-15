// Synthesised sound effects (WebAudio, no audio files): short oscillator blips and
// filtered noise bursts. Everything is guarded — a browser with no audio, or a
// headless screenshot run, simply stays silent. The context is created on the first
// user gesture, which is also the only time a browser allows sound to start.

import { MUTE_KEY } from './config.js';

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = readMuted();

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // A sound failing must never break the game.
    }
  }

  function noise(dur, vol, cutoff) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
    } catch {
      // A sound failing must never break the game.
    }
  }

  return {
    /** Call on any user gesture so later sounds are allowed to play. */
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Storage off: the mute lasts this visit only.
      }
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    shoot() {
      tone(720, 0.07, 'square', 0.12, 320);
    },
    boom(big) {
      noise(big ? 0.5 : 0.28, big ? 0.5 : 0.3, big ? 900 : 1600);
      tone(big ? 90 : 140, big ? 0.4 : 0.22, 'sawtooth', 0.25, 40);
    },
    hit() {
      tone(160, 0.3, 'sawtooth', 0.4, 50);
      noise(0.2, 0.3, 700);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25, 990);
      setTimeout(() => tone(990, 0.12, 'sine', 0.25, 1320), 70);
    },
    wave() {
      tone(440, 0.12, 'triangle', 0.3);
      setTimeout(() => tone(554, 0.12, 'triangle', 0.3), 110);
      setTimeout(() => tone(659, 0.2, 'triangle', 0.3), 220);
    },
    boss() {
      tone(110, 0.5, 'sawtooth', 0.35, 55);
      setTimeout(() => tone(110, 0.5, 'sawtooth', 0.35, 55), 550);
    },
    over() {
      tone(330, 0.25, 'triangle', 0.3, 220);
      setTimeout(() => tone(220, 0.3, 'triangle', 0.3, 147), 240);
      setTimeout(() => tone(147, 0.5, 'triangle', 0.3, 98), 520);
    },
  };
}
