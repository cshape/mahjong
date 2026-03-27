/**
 * useSoundEffects: generates game sound effects using Web Audio API.
 * No external audio files needed — all synthesized.
 */
import { useCallback, useRef } from 'react';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Soft "click/thud" for tile placement */
function playTilePlace() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // Short noise burst filtered to a thud
  const bufLen = ctx.sampleRate * 0.06;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.15));
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t);
}

/** Punchy three-tone chime for claims (Pong, Sheung, Kong) */
function playClaimChime() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // Quick ascending power chord
  [440, 554, 659].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    const start = t + i * 0.06;
    gain.gain.setValueAtTime(0.2, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.45);
  });

  // Impact thud
  const bufLen = ctx.sampleRate * 0.08;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.1));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t);
}

/** Celebration fanfare for Mah Jong win — ascending arpeggio + shimmer */
function playWinFanfare() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // Ascending arpeggio
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    const start = t + i * 0.12;
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.65);
  });

  // Shimmer chord at the end
  [1047, 1319, 1568].forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    const start = t + 0.5;
    gain.gain.setValueAtTime(0.15, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.3);
  });
}

/** Soft draw sound — lighter than tile place */
function playTileDraw() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 800;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

export type SoundType = 'discard' | 'claim' | 'win' | 'draw';

export function useSoundEffects() {
  const enabledRef = useRef(true);

  const play = useCallback((sound: SoundType) => {
    if (!enabledRef.current) return;
    try {
      switch (sound) {
        case 'discard': playTilePlace(); break;
        case 'claim': playClaimChime(); break;
        case 'win': playWinFanfare(); break;
        case 'draw': playTileDraw(); break;
      }
    } catch {
      // AudioContext might not be available
    }
  }, []);

  const toggle = useCallback(() => {
    enabledRef.current = !enabledRef.current;
    return enabledRef.current;
  }, []);

  return { play, toggle, enabled: enabledRef };
}
