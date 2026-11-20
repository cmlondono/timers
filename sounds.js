// Tonos generados con Web Audio API: no requieren archivos de audio y funcionan sin conexión.

let ctx = null;
let master = null;
let volume = 0.8;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
}

// Los navegadores móviles solo permiten audio después de un gesto del usuario.
export function unlockAudio() {
  try {
    // Safari 16.4+: reproducir aunque el interruptor de silencio esté activo.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* no soportado */ }
  if (ctx && ctx.state === 'running') return;
  const c = audio();
  if (!c) return;
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start(0);
}

function note(dest, { type = 'sine', freq, to, start, dur, gain = 0.5, attack = 0.005 }) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env).connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

export const TONES = {
  campana: {
    label: 'Campana',
    length: 2.0,
    play(d, t) {
      [[1, 0.5], [2, 0.22], [3, 0.12], [4.2, 0.07]].forEach(([r, g]) =>
        note(d, { freq: 660 * r, start: t, dur: 1.8, gain: g }));
    },
  },
  digital: {
    label: 'Digital',
    length: 1.3,
    play(d, t) {
      for (let i = 0; i < 4; i++) note(d, { type: 'square', freq: 1000, start: t + i * 0.15, dur: 0.09, gain: 0.16, attack: 0.002 });
    },
  },
  alarma: {
    label: 'Alarma',
    length: 1.6,
    play(d, t) {
      for (let i = 0; i < 8; i++) note(d, { type: 'sawtooth', freq: i % 2 ? 660 : 880, start: t + i * 0.18, dur: 0.16, gain: 0.15, attack: 0.003 });
    },
  },
  suave: {
    label: 'Suave',
    length: 2.4,
    play(d, t) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        note(d, { type: 'triangle', freq: f, start: t + i * 0.16, dur: 1.0, gain: 0.35, attack: 0.01 }));
    },
  },
  pulso: {
    label: 'Pulso',
    length: 1.6,
    play(d, t) {
      for (let i = 0; i < 3; i++) note(d, { freq: 440, start: t + i * 0.3, dur: 0.22, gain: 0.55, attack: 0.01 });
    },
  },
  ascendente: {
    label: 'Ascendente',
    length: 1.5,
    play(d, t) {
      for (let i = 0; i < 2; i++) note(d, { freq: 420, to: 1260, start: t + i * 0.6, dur: 0.45, gain: 0.4, attack: 0.01 });
    },
  },
};

const toneOf = (id) => TONES[id] || TONES.campana;

function fadeOut(g) {
  g.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  setTimeout(() => g.disconnect(), 400);
}

let previewGain = null;

export function previewTone(id) {
  const c = audio();
  if (!c) return;
  if (previewGain) fadeOut(previewGain);
  const g = c.createGain();
  g.connect(master);
  previewGain = g;
  toneOf(id).play(g, c.currentTime + 0.03);
  setTimeout(() => { if (previewGain === g) previewGain = null; g.disconnect(); }, 3000);
}

let ringTimer = null;
let ringGain = null;
let ringingTone = null;

// Reproduce el tono en bucle hasta stopRing(). Llamarlo de nuevo con el mismo tono no hace nada.
export function startRing(id) {
  if (ringingTone === id) return;
  stopRing();
  const c = audio();
  if (!c) return;
  ringingTone = id;
  ringGain = c.createGain();
  ringGain.connect(master);
  const def = toneOf(id);
  const g = ringGain;
  const loop = () => {
    audio();
    if (c.state === 'running') def.play(g, c.currentTime + 0.03);
    ringTimer = setTimeout(loop, (def.length + 0.6) * 1000);
  };
  loop();
}

export function stopRing() {
  clearTimeout(ringTimer);
  ringTimer = null;
  ringingTone = null;
  if (ringGain) {
    fadeOut(ringGain);
    ringGain = null;
  }
}
