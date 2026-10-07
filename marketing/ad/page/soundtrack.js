// Renders the ad soundtrack offline: a lo-fi track from the app's jukebox engine plus
// sound effects at the director's cue times. Returns a 16-bit stereo WAV as base64.
import { createLofi } from '/js/jukebox.js';

const RATE = 44100;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function sfxKit(ctx, out) {
  let noiseBuf = null;
  const noiseSrc = () => {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, RATE, RATE);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    return s;
  };
  const tone = (f, t, dur, { type = 'sine', gain = 0.2, attack = 0.005, to } = {}) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const noise = (t, dur, { gain = 0.2, type = 'bandpass', freq = 1200, to, q = 0.8 } = {}) => {
    const s = noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t);
    s.stop(t + dur + 0.05);
  };
  return {
    click: (t) => tone(1500, t, 0.05, { type: 'triangle', gain: 0.06 }),
    pop: (t) => tone(500, t, 0.12, { gain: 0.16, to: 1300 }),
    slap: (t) => {
      noise(t, 0.12, { gain: 0.3, type: 'lowpass', freq: 900 });
      tone(180, t, 0.12, { gain: 0.22, to: 90 });
    },
    whoosh: (t) => noise(t, 0.45, { gain: 0.12, freq: 400, to: 3500 }),
    chime: (t) => [84, 88, 91].forEach((n, i) => tone(midi(n), t + i * 0.08, 0.6, { type: 'triangle', gain: 0.1 })),
    tv: (t) => {
      tone(60, t, 0.22, { type: 'sawtooth', gain: 0.04, to: 9000 });
      noise(t + 0.25, 0.4, { gain: 0.08, type: 'highpass', freq: 2500 });
    },
    party: (t) => {
      [67, 72, 76, 79].forEach((n, i) => tone(midi(n), t + i * 0.09, 0.45, { type: 'square', gain: 0.045 }));
      tone(midi(84), t + 0.4, 0.8, { type: 'square', gain: 0.05 });
      noise(t + 0.4, 0.5, { gain: 0.09, type: 'highpass', freq: 5000 });
    },
    blow: (t) => noise(t, 0.7, { gain: 0.2, type: 'lowpass', freq: 700, to: 300 }),
    win: (t) => [72, 76, 79, 84, 79, 84].forEach((n, i) => tone(midi(n), t + i * 0.1, 0.28, { type: 'square', gain: 0.05 })),
    dart: (t) => {
      noise(t, 0.08, { gain: 0.25, type: 'lowpass', freq: 2000 });
      tone(220, t, 0.08, { type: 'triangle', gain: 0.12, to: 110 });
    },
    sign: (t) => {
      tone(55, t, 0.5, { type: 'sawtooth', gain: 0.03 });
      noise(t, 0.25, { gain: 0.05, type: 'highpass', freq: 6000 });
    },
    end: (t) => {
      [60, 67, 72, 76].forEach((n, i) => tone(midi(n), t + i * 0.06, 1.6, { type: 'triangle', gain: 0.07 }));
      tone(midi(48), t, 1.8, { gain: 0.12 });
    },
  };
}

function toWav(buffer) {
  const ch = buffer.numberOfChannels;
  const len = buffer.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  data.setUint32(4, 36 + len * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, RATE, true);
  data.setUint32(28, RATE * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, 'data');
  data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  const bytes = new Uint8Array(data.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** duration: seconds. track: jukebox track index. cues: [{ t, name }]. */
export async function renderSoundtrack({ duration, track, cues, musicLevel = 0.75 }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * RATE), RATE);
  // Master with a gentle fade-out at the end
  const master = ctx.createGain();
  master.gain.setValueAtTime(1, 0);
  master.gain.setValueAtTime(1, duration - 1.6);
  master.gain.linearRampToValueAtTime(0, duration);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);

  const band = createLofi(ctx, master, track, { level: musicLevel, fadeIn: 0.6 });
  for (let step = 0; step * band.stepDur < duration; step++) band.playStep(step, step * band.stepDur);

  const sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);
  const kit = sfxKit(ctx, sfxBus);
  for (const c of cues) kit[c.name]?.(c.t);

  const rendered = await ctx.startRendering();
  return toWav(rendered);
}
