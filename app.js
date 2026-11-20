import { TONES, unlockAudio, previewTone, startRing, stopRing, setVolume } from './sounds.js';

const COLORS = ['#ec4899', '#f472b6', '#8b5cf6', '#3b82f6', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#64748b'];
const QUICK = [30, 60, 120, 300, 600, 900, 1800, 3600];
const DEFAULT_SETTINGS = { defaultTone: 'campana', volume: 0.8, vibrate: true, wakeLock: true, theme: 'pig' };
const RING_MAX_MS = 5 * 60 * 1000; // la alarma deja de sonar sola tras 5 min

// ---------- Persistencia ----------
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('labtimer.' + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('labtimer.' + key, JSON.stringify(value)); } catch { /* almacenamiento lleno o bloqueado */ }
  },
};

const state = {
  library: store.get('library', []),
  active: store.get('active', []),
  settings: { ...DEFAULT_SETTINGS, ...store.get('settings', {}) },
  lastTest: store.get('lastTest', {}),
  query: '',
};

const saveLibrary = () => store.set('library', state.library);
const saveActive = () => store.set('active', state.active);
const saveSettings = () => store.set('settings', state.settings);

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hms(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
const fmtLeft = (ms) => hms(Math.max(0, Math.ceil(ms / 1000)));
const fmtOver = (ms) => hms(Math.max(0, Math.floor(ms / 1000)));
const clock = (ts) => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
const toneLabel = (id) => (TONES[id] || TONES.campana).label;

function humanDuration(sec) {
  if (sec < 60) return `${sec} s`;
  if (sec < 3600) return sec % 60 ? `${Math.floor(sec / 60)} min ${sec % 60} s` : `${sec / 60} min`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Sugiere el siguiente número de prueba: "12" → "13", "M-009" → "M-010".
function nextTest(value) {
  const m = /^(.*?)(\d+)$/.exec(value || '');
  if (!m) return null;
  return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0');
}

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path class="fill" d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12.3-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6z"/>',
  pause: '<rect class="fill" x="6" y="4.5" width="4" height="15" rx="1.2"/><rect class="fill" x="14" y="4.5" width="4" height="15" rx="1.2"/>',
  restart: '<path d="M3 12a9 9 0 1 0 2.64-6.36L3 8.3"/><path d="M3 3.5v4.8h4.8"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  pencil: '<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  bellOff: '<path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};
// Cerdito de perfil que camina sobre la barra de progreso (tema Cerditos).
const PIG_WALKER = `<div class="pig-track" aria-hidden="true"><div class="walker"><svg viewBox="0 0 48 36"><path class="tail" d="M7.5 15c-4 0-4-5 0-4s1 5-2 5" fill="none" stroke="#f27fa8" stroke-width="1.8" stroke-linecap="round"/><rect class="leg leg-b" x="10" y="22" width="4.5" height="10" rx="2.2" fill="#f59ab9"/><rect class="leg leg-a" x="15.5" y="22" width="4.5" height="10" rx="2.2" fill="#f59ab9"/><rect class="leg leg-a" x="24" y="22" width="4.5" height="10" rx="2.2" fill="#f59ab9"/><rect class="leg leg-b" x="29.5" y="22" width="4.5" height="10" rx="2.2" fill="#f59ab9"/><ellipse cx="21" cy="18" rx="14" ry="10" fill="#ffc9db"/><circle cx="34" cy="14" r="9" fill="#ffc9db"/><path d="M29 7 31 1l5 5z" fill="#f59ab9" stroke="#f59ab9" stroke-linejoin="round"/><circle cx="34.5" cy="18.5" r="2.2" fill="#ff8fb3" opacity=".6"/><circle class="eye-open" cx="36" cy="12" r="1.5" fill="#4a2238"/><path class="eye-closed" d="M34.6 12.2q1.4 1.3 2.8 0" fill="none" stroke="#4a2238" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="42" cy="16" rx="4" ry="3.4" fill="#ff9fbf"/><ellipse cx="41" cy="16" rx=".8" ry="1.2" fill="#c2446f"/><ellipse cx="43.2" cy="16" rx=".8" ry="1.2" fill="#c2446f"/></svg><span class="zz">z</span><span class="hearts"><i>♥</i><i>♥</i><i>♥</i></span></div></div>`;

const ic = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// ---------- Elementos ----------
const els = {
  activeSection: $('#activeSection'),
  activeList: $('#activeList'),
  activeCount: $('#activeCount'),
  library: $('#library'),
  libraryCount: $('#libraryCount'),
  libraryEmpty: $('#libraryEmpty'),
  searchWrap: $('#searchWrap'),
  search: $('#search'),
  alarmBanner: $('#alarmBanner'),
  alarmText: $('#alarmText'),
  toast: $('#toast'),
  installBtn: $('#installBtn'),
  startDialog: $('#startDialog'),
  presetDialog: $('#presetDialog'),
  settingsDialog: $('#settingsDialog'),
  installDialog: $('#installDialog'),
  testNo: $('#testNo'),
  presetName: $('#presetName'),
};

// Iconos estáticos
$('#settingsBtn').innerHTML = ic('sliders');
$('#newBtn').innerHTML = `${ic('plus')}<span>Nuevo timer</span>`;
$('#searchIcon').innerHTML = ic('search');
$('#startSubmit').innerHTML = `${ic('play')} Iniciar`;
document.querySelectorAll('[data-close].icon-btn').forEach((b) => { b.innerHTML = ic('x'); });

// ---------- Hojas (dialog) ----------
function openSheet(d) { if (!d.open) d.showModal(); }
function closeSheet(d) { if (d.open) d.close(); }
document.querySelectorAll('dialog.sheet').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
});

// ---------- Toast ----------
let toastTimer;
function hideToast() { els.toast.classList.remove('show'); }
function toast(message, action) {
  els.toast.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast-btn">${esc(action.label)}</button>` : ''}`;
  if (action) els.toast.querySelector('button').onclick = () => { action.fn(); hideToast(); };
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 5000 : 2200);
}

// ---------- Campo de duración (HH:MM:SS) ----------
function durationField(root, onChange = () => {}) {
  root.innerHTML = `
    <div class="dur">
      <label class="dur-cell"><input data-u="h" inputmode="numeric" maxlength="2" aria-label="Horas"><span>horas</span></label>
      <span class="dur-sep">:</span>
      <label class="dur-cell"><input data-u="m" inputmode="numeric" maxlength="2" aria-label="Minutos"><span>min</span></label>
      <span class="dur-sep">:</span>
      <label class="dur-cell"><input data-u="s" inputmode="numeric" maxlength="2" aria-label="Segundos"><span>seg</span></label>
    </div>`;
  const inputs = {};
  root.querySelectorAll('input').forEach((i) => { inputs[i.dataset.u] = i; });

  const num = (k) => parseInt(inputs[k].value, 10) || 0;
  const get = () => num('h') * 3600 + num('m') * 60 + num('s');
  const set = (sec) => {
    sec = Math.max(0, Math.min(Math.round(sec), 99 * 3600 + 59 * 60 + 59));
    inputs.h.value = pad(Math.floor(sec / 3600));
    inputs.m.value = pad(Math.floor((sec % 3600) / 60));
    inputs.s.value = pad(sec % 60);
  };
  Object.values(inputs).forEach((i) => {
    i.addEventListener('focus', () => i.select());
    i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, ''); onChange(get()); });
    i.addEventListener('blur', () => set(get())); // normaliza: 90 s → 01:30
  });
  return { get, set };
}

// ---------- Timers activos ----------
function remainingMs(t, now = Date.now()) {
  if (t.state === 'running') return t.endAt - now;
  if (t.state === 'paused') return t.remaining;
  return 0;
}
const isRinging = (t) => t.state === 'done' && !t.ack;

function launch(preset, duration, testNo) {
  const now = Date.now();
  state.active.push({
    id: uid(),
    presetId: preset.id,
    name: preset.name,
    color: preset.color,
    tone: preset.tone,
    testNo,
    base: duration,
    duration,
    state: 'running',
    endAt: now + duration * 1000,
    remaining: duration * 1000,
    createdAt: now,
  });
  commitActive();
  toast(testNo ? `${preset.name} · Prueba ${testNo} iniciado` : `${preset.name} iniciado`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const act = {
  pause(t) { t.remaining = Math.max(0, t.endAt - Date.now()); t.state = 'paused'; },
  resume(t) { t.endAt = Date.now() + t.remaining; t.state = 'running'; },
  plus(t) {
    if (t.state === 'running') { t.endAt += 60000; t.duration += 60; }
    else if (t.state === 'paused') { t.remaining += 60000; t.duration += 60; }
    else { Object.assign(t, { state: 'running', endAt: Date.now() + 60000, duration: 60, ack: false, doneAt: null }); }
  },
  restart(t) {
    Object.assign(t, { state: 'running', duration: t.base, endAt: Date.now() + t.base * 1000, ack: false, doneAt: null });
  },
  ack(t) { t.ack = true; },
  remove(t) {
    const i = state.active.indexOf(t);
    state.active.splice(i, 1);
    toast(`${t.name} quitado`, {
      label: 'Deshacer',
      fn: () => { state.active.splice(Math.min(i, state.active.length), 0, t); commitActive(); },
    });
  },
};

function commitActive() {
  saveActive();
  renderActive();
  syncAlarm();
  updateWakeLock();
}

function sortedActive(now) {
  const rank = (t) => (t.state === 'done' ? (t.ack ? 2 : 0) : 1);
  return [...state.active].sort((a, b) => rank(a) - rank(b) || remainingMs(a, now) - remainingMs(b, now));
}

function statusText(t) {
  if (t.state === 'running') return `Termina ${clock(t.endAt)}`;
  if (t.state === 'paused') return 'En pausa';
  return `Cumplido ${clock(t.doneAt)}`;
}

function timeText(t, now) {
  return t.state === 'done' ? `+${fmtOver(now - t.doneAt)}` : fmtLeft(remainingMs(t, now));
}

function progress(t, now) {
  if (t.state === 'done') return 1;
  return Math.min(1, Math.max(0, 1 - remainingMs(t, now) / (t.duration * 1000)));
}

function actionsFor(t) {
  if (isRinging(t)) {
    return `<button type="button" class="btn btn-danger btn-grow" data-action="ack">${ic('bellOff')} Detener alarma</button>
      <button type="button" class="btn btn-soft" data-action="plus">+1 min</button>`;
  }
  if (t.state === 'done') {
    return `<button type="button" class="btn btn-soft btn-grow" data-action="restart">${ic('restart')} Repetir</button>
      <button type="button" class="btn btn-soft" data-action="plus">+1 min</button>
      <button type="button" class="icon-btn" data-action="remove" aria-label="Quitar">${ic('x')}</button>`;
  }
  const running = t.state === 'running';
  return `<button type="button" class="btn ${running ? 'btn-soft' : 'btn-primary'} btn-grow" data-action="${running ? 'pause' : 'resume'}">${ic(running ? 'pause' : 'play')} ${running ? 'Pausar' : 'Reanudar'}</button>
    <button type="button" class="btn btn-soft" data-action="plus">+1 min</button>
    <button type="button" class="icon-btn" data-action="restart" aria-label="Reiniciar">${ic('restart')}</button>
    <button type="button" class="icon-btn" data-action="remove" aria-label="Quitar">${ic('x')}</button>`;
}

function renderActive() {
  const now = Date.now();
  const list = sortedActive(now);
  els.activeSection.hidden = list.length === 0;
  const running = list.filter((t) => t.state === 'running').length;
  els.activeCount.textContent = running ? `${running} corriendo` : `${list.length}`;
  els.activeList.innerHTML = list.map((t) => `
    <article class="timer is-${t.state}${isRinging(t) ? ' is-ringing' : ''}" data-id="${t.id}" style="--c0:${t.color};--p:${progress(t, now)}">
      <div class="timer-head">
        <div class="timer-title">
          <span class="timer-name">${esc(t.name)}</span>
          ${t.testNo ? `<span class="badge">Prueba ${esc(t.testNo)}</span>` : ''}
        </div>
        <span class="timer-status">${statusText(t)}</span>
      </div>
      <div class="timer-time" data-time>${timeText(t, now)}</div>
      ${PIG_WALKER}
      <div class="progress"><span data-bar style="transform:scaleX(${progress(t, now)})"></span></div>
      <div class="timer-actions">${actionsFor(t)}</div>
    </article>`).join('');
}

function updateTimes(now) {
  for (const t of state.active) {
    const card = els.activeList.querySelector(`[data-id="${t.id}"]`);
    if (!card) continue;
    const timeEl = card.querySelector('[data-time]');
    const text = timeText(t, now);
    if (timeEl.textContent !== text) timeEl.textContent = text;
    const p = progress(t, now);
    card.querySelector('[data-bar]').style.transform = `scaleX(${p})`;
    card.style.setProperty('--p', p);
  }
}

els.activeList.addEventListener('click', (e) => {
  const card = e.target.closest('.timer');
  if (!card) return;
  const t = state.active.find((x) => x.id === card.dataset.id);
  if (!t) return;
  const btn = e.target.closest('[data-action]');
  if (!btn) {
    // Tocar cualquier parte de una tarjeta que suena la silencia.
    if (isRinging(t)) { act.ack(t); commitActive(); }
    return;
  }
  act[btn.dataset.action]?.(t);
  commitActive();
});

$('#alarmStopAll').addEventListener('click', () => {
  state.active.filter(isRinging).forEach((t) => act.ack(t));
  commitActive();
});

// ---------- Bucle principal ----------
let lastBuzz = 0;

function syncAlarm(now = Date.now()) {
  const pending = state.active.filter(isRinging);
  const audible = pending.filter((t) => now - t.doneAt < RING_MAX_MS).sort((a, b) => b.doneAt - a.doneAt);

  if (audible.length) {
    startRing(audible[0].tone);
    if (state.settings.vibrate && navigator.vibrate && navigator.userActivation?.hasBeenActive !== false && now - lastBuzz > 3000) {
      navigator.vibrate([300, 150, 300, 150, 300]);
      lastBuzz = now;
    }
  } else {
    stopRing();
    if (lastBuzz) { navigator.vibrate?.(0); lastBuzz = 0; }
  }

  els.alarmBanner.hidden = pending.length === 0;
  if (pending.length) {
    const first = pending[0];
    const label = `${first.name}${first.testNo ? ` · Prueba ${first.testNo}` : ''}${pending.length > 1 ? ` y ${pending.length - 1} más` : ''}`;
    const text = `Tiempo cumplido: ${label}`;
    if (els.alarmText.textContent !== text) els.alarmText.textContent = text;
  }
}

function updateTitle(now) {
  let title = 'LabTimer';
  if (state.active.some(isRinging)) title = '⏰ Tiempo cumplido · LabTimer';
  else {
    const next = state.active.filter((t) => t.state === 'running').sort((a, b) => a.endAt - b.endAt)[0];
    if (next) title = `${fmtLeft(next.endAt - now)} · ${next.name}`;
  }
  if (document.title !== title) document.title = title;
}

function notifyFinished(timers, now) {
  if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  for (const t of timers) {
    if (now - t.doneAt > RING_MAX_MS) continue;
    const opts = {
      body: t.testNo ? `Prueba ${t.testNo} · ${humanDuration(t.duration)}` : humanDuration(t.duration),
      tag: t.id,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [300, 150, 300, 150, 300],
      requireInteraction: true,
    };
    const title = `⏰ ${t.name}: tiempo cumplido`;
    navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification(title, opts))
      .catch(() => { try { new Notification(title, opts); } catch { /* sin soporte */ } });
  }
}

function tick() {
  const now = Date.now();
  const finished = [];
  for (const t of state.active) {
    if (t.state === 'running' && t.endAt <= now) {
      Object.assign(t, { state: 'done', doneAt: t.endAt, ack: false });
      finished.push(t);
    }
  }
  if (finished.length) {
    saveActive();
    renderActive();
    notifyFinished(finished, now);
    updateWakeLock();
  } else {
    updateTimes(now);
  }
  syncAlarm(now);
  updateTitle(now);
}

// ---------- Mantener pantalla encendida ----------
let wakeLock = null;
let wakePending = false;
async function updateWakeLock() {
  if (!('wakeLock' in navigator)) return;
  const want = state.settings.wakeLock
    && document.visibilityState === 'visible'
    && state.active.some((t) => t.state === 'running' || isRinging(t));
  if (want && !wakeLock && !wakePending) {
    wakePending = true;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch { /* denegado (p. ej. batería baja) */ }
    wakePending = false;
  } else if (!want && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// ---------- Biblioteca ----------
const sortByName = (a, b) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });

function renderLibrary() {
  const q = state.query.trim().toLowerCase();
  const total = state.library.length;
  const items = [...state.library].sort(sortByName).filter((p) => !q || p.name.toLowerCase().includes(q));

  els.libraryEmpty.hidden = total > 0;
  els.searchWrap.hidden = total < 6;
  els.libraryCount.textContent = total ? String(total) : '';
  els.libraryCount.hidden = !total;

  if (total && !items.length) {
    els.library.innerHTML = `<p class="no-results">Sin resultados para “${esc(state.query.trim())}”</p>`;
    return;
  }
  els.library.innerHTML = items.map((p) => `
    <article class="preset" data-id="${p.id}" style="--c0:${p.color}">
      <button type="button" class="preset-main" data-action="open" aria-label="Usar ${esc(p.name)}">
        <span class="preset-name">${esc(p.name)}</span>
        <span class="preset-meta">
          <span class="preset-time">${hms(p.duration)}</span>
          <span class="meta-sep" aria-hidden="true"></span>
          ${ic('bell')}<span>${toneLabel(p.tone)}</span>
        </span>
      </button>
      <button type="button" class="icon-btn" data-action="edit" aria-label="Editar ${esc(p.name)}">${ic('pencil')}</button>
      <button type="button" class="play-btn" data-action="quick" aria-label="Iniciar ${esc(p.name)} ahora">${ic('play')}</button>
    </article>`).join('');
}

els.library.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const p = state.library.find((x) => x.id === btn.closest('.preset').dataset.id);
  if (!p) return;
  if (btn.dataset.action === 'open') openStart(p);
  else if (btn.dataset.action === 'quick') launch(p, p.duration, '');
  else if (btn.dataset.action === 'edit') openPreset(p);
});

els.search.addEventListener('input', () => { state.query = els.search.value; renderLibrary(); });

// ---------- Hoja: iniciar ----------
let startPreset = null;
const startResetBtn = $('#startResetTime');
const startDur = durationField($('#startDuration'), (sec) => { startResetBtn.hidden = !startPreset || sec === startPreset.duration; });

function openStart(p) {
  startPreset = p;
  $('#startTitle').textContent = p.name;
  $('#startMeta').innerHTML = `${ic('clock')} ${humanDuration(p.duration)} <span class="meta-sep"></span> ${ic('bell')} ${toneLabel(p.tone)}`;
  startDur.set(p.duration);
  startResetBtn.hidden = true;
  startResetBtn.textContent = `Restablecer (${hms(p.duration)})`;
  els.testNo.value = '';

  const last = state.lastTest[p.id];
  const next = nextTest(last);
  const chips = [];
  if (next) chips.push(`<button type="button" class="chip chip-accent" data-value="${esc(next)}">Siguiente: ${esc(next)}</button>`);
  if (last) chips.push(`<button type="button" class="chip" data-value="${esc(last)}">Última: ${esc(last)}</button>`);
  $('#testSuggest').innerHTML = chips.join('');
  $('#testSuggest').hidden = !chips.length;
  openSheet(els.startDialog);
}

$('#testSuggest').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-value]');
  if (chip) els.testNo.value = chip.dataset.value;
});

startResetBtn.addEventListener('click', () => {
  startDur.set(startPreset.duration);
  startResetBtn.hidden = true;
});

$('#startForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const duration = startDur.get();
  if (duration <= 0) { toast('El tiempo debe ser mayor que cero'); return; }
  const testNo = els.testNo.value.trim();
  if (testNo) {
    state.lastTest[startPreset.id] = testNo;
    store.set('lastTest', state.lastTest);
  }
  closeSheet(els.startDialog);
  launch(startPreset, duration, testNo);
});

// ---------- Hoja: crear / editar ----------
let editing = null;
let draftTone = state.settings.defaultTone;
let draftColor = COLORS[0];
const presetDur = durationField($('#presetDuration'), (sec) => { setError('#fieldDuration', ''); syncChips(sec); });

$('#presetChips').innerHTML = QUICK.map((s) => `<button type="button" class="chip" data-sec="${s}">${humanDuration(s)}</button>`).join('');
$('#presetChips').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-sec]');
  if (!chip) return;
  presetDur.set(Number(chip.dataset.sec));
  setError('#fieldDuration', '');
  syncChips(presetDur.get());
});

function syncChips(sec) {
  $('#presetChips').querySelectorAll('[data-sec]').forEach((c) => {
    c.setAttribute('aria-pressed', String(Number(c.dataset.sec) === sec));
  });
}

function setError(fieldSel, msg) {
  const field = $(fieldSel);
  const p = field.querySelector('.field-error');
  p.textContent = msg;
  p.hidden = !msg;
  field.classList.toggle('has-error', !!msg);
}

function renderToneList() {
  $('#toneList').innerHTML = Object.entries(TONES).map(([id, t]) => `
    <button type="button" class="tone-opt" role="radio" aria-checked="${id === draftTone}" data-tone="${id}">
      ${ic(id === draftTone ? 'check' : 'bell')}<span>${t.label}</span>
    </button>`).join('');
}

function renderColorList() {
  $('#colorList').innerHTML = COLORS.map((c) => `
    <button type="button" class="swatch" role="radio" aria-checked="${c === draftColor}" aria-label="Color ${c}" data-color="${c}" style="--c0:${c}"></button>`).join('');
}

$('#toneList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tone]');
  if (!b) return;
  draftTone = b.dataset.tone;
  renderToneList();
  previewTone(draftTone);
});

$('#colorList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]');
  if (!b) return;
  draftColor = b.dataset.color;
  renderColorList();
});

function openPreset(p = null) {
  editing = p;
  $('#presetTitle').textContent = p ? 'Editar timer' : 'Nuevo timer';
  els.presetName.value = p ? p.name : '';
  presetDur.set(p ? p.duration : 300);
  syncChips(presetDur.get());
  draftTone = p ? p.tone : state.settings.defaultTone;
  draftColor = p ? p.color : COLORS[state.library.length % COLORS.length];
  setError('#fieldName', '');
  setError('#fieldDuration', '');
  renderToneList();
  renderColorList();
  $('#presetDelete').hidden = !p;
  openSheet(els.presetDialog);
  if (!p) requestAnimationFrame(() => els.presetName.focus());
}

els.presetName.addEventListener('input', () => setError('#fieldName', ''));

$('#presetForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = els.presetName.value.trim().replace(/\s+/g, ' ');
  const duration = presetDur.get();
  let ok = true;
  if (!name) { setError('#fieldName', 'Escribe un nombre para el timer'); ok = false; }
  if (duration <= 0) { setError('#fieldDuration', 'El tiempo debe ser mayor que cero'); ok = false; }
  if (!ok) return;

  if (editing) {
    Object.assign(editing, { name, duration, tone: draftTone, color: draftColor });
  } else {
    state.library.push({ id: uid(), name, duration, tone: draftTone, color: draftColor, createdAt: Date.now() });
  }
  saveLibrary();
  renderLibrary();
  closeSheet(els.presetDialog);
  toast(editing ? 'Cambios guardados' : 'Timer guardado en la biblioteca');
});

$('#presetDelete').addEventListener('click', () => {
  const p = editing;
  const i = state.library.indexOf(p);
  state.library.splice(i, 1);
  saveLibrary();
  renderLibrary();
  closeSheet(els.presetDialog);
  toast(`${p.name} eliminado`, {
    label: 'Deshacer',
    fn: () => { state.library.splice(i, 0, p); saveLibrary(); renderLibrary(); },
  });
});

$('#newBtn').addEventListener('click', () => openPreset());
$('#emptyNewBtn').addEventListener('click', () => openPreset());

// ---------- Hoja: ajustes ----------
const setTone = $('#setTone');
const setVol = $('#setVolume');
const setVibrate = $('#setVibrate');
const setWake = $('#setWake');
const notifBtn = $('#notifBtn');

setTone.innerHTML = Object.entries(TONES).map(([id, t]) => `<option value="${id}">${t.label}</option>`).join('');

function renderNotif() {
  const status = $('#notifStatus');
  if (!('Notification' in window)) {
    status.textContent = 'No disponibles aquí';
    notifBtn.hidden = true;
    return;
  }
  const perm = Notification.permission;
  status.textContent = perm === 'granted' ? 'Activadas' : perm === 'denied' ? 'Bloqueadas en el navegador' : 'Desactivadas';
  notifBtn.hidden = perm !== 'default';
}

function applyTheme() {
  const theme = state.settings.theme;
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && darkQuery.matches);
  $('meta[name="theme-color"]').content = theme === 'pig' ? '#fff4f8' : dark ? '#0c0e13' : '#f3f4f7';
  document.querySelectorAll('[data-theme-opt]').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.themeOpt === theme));
  });
}
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
darkQuery.addEventListener('change', applyTheme);

$('#themeSwitch').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-opt]');
  if (!b) return;
  state.settings.theme = b.dataset.themeOpt;
  saveSettings();
  applyTheme();
});

function openSettings() {
  setTone.value = state.settings.defaultTone;
  setVol.value = state.settings.volume;
  setVibrate.checked = state.settings.vibrate;
  setWake.checked = state.settings.wakeLock;
  setWake.disabled = !('wakeLock' in navigator);
  setVibrate.disabled = !('vibrate' in navigator);
  renderNotif();
  openSheet(els.settingsDialog);
}

$('#settingsBtn').addEventListener('click', openSettings);

setTone.addEventListener('change', () => {
  state.settings.defaultTone = setTone.value;
  saveSettings();
  previewTone(setTone.value);
});
setVol.addEventListener('input', () => {
  state.settings.volume = Number(setVol.value);
  setVolume(state.settings.volume);
  saveSettings();
});
setVol.addEventListener('change', () => previewTone(state.settings.defaultTone));
$('#testSound').addEventListener('click', () => previewTone(state.settings.defaultTone));
setVibrate.addEventListener('change', () => {
  state.settings.vibrate = setVibrate.checked;
  saveSettings();
  if (setVibrate.checked) navigator.vibrate?.(200);
});
setWake.addEventListener('change', () => {
  state.settings.wakeLock = setWake.checked;
  saveSettings();
  updateWakeLock();
});
notifBtn.addEventListener('click', async () => {
  try { await Notification.requestPermission(); } catch { /* sin soporte */ }
  renderNotif();
});

$('#exportBtn').addEventListener('click', () => {
  const data = { app: 'labtimer', version: 1, exportedAt: new Date().toISOString(), library: state.library };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `labtimer-biblioteca-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = (Array.isArray(data) ? data : data.library || [])
      .filter((p) => p && typeof p.name === 'string' && Number(p.duration) > 0);
    const known = new Set(state.library.map((p) => p.id));
    let added = 0;
    for (const p of incoming) {
      if (p.id && known.has(p.id)) continue;
      state.library.push({
        id: p.id || uid(),
        name: p.name.slice(0, 40),
        duration: Math.round(Number(p.duration)),
        tone: TONES[p.tone] ? p.tone : state.settings.defaultTone,
        color: COLORS.includes(p.color) ? p.color : COLORS[0],
        createdAt: p.createdAt || Date.now(),
      });
      added++;
    }
    saveLibrary();
    renderLibrary();
    toast(added ? `${added} timer(s) importado(s)` : 'No había timers nuevos para importar');
  } catch {
    toast('El archivo no es una biblioteca válida');
  }
});

// ---------- Instalación ----------
let deferredPrompt = null;
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (isIOS && !isStandalone) els.installBtn.hidden = false;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.hidden = false;
});
window.addEventListener('appinstalled', () => { els.installBtn.hidden = true; deferredPrompt = null; });
els.installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    els.installBtn.hidden = true;
  } else {
    openSheet(els.installDialog);
  }
});

// ---------- Arranque ----------
// Activa el tema Cerditos una sola vez para quienes ya tenían otro tema guardado.
if (!state.settings.pigIntro) {
  state.settings.theme = 'pig';
  state.settings.pigIntro = true;
  saveSettings();
}
applyTheme();
// iOS ignora user-scalable=no: bloquear el gesto de pellizcar para que no haga zoom.
document.addEventListener('gesturestart', (e) => e.preventDefault());
setVolume(state.settings.volume);
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, unlockAudio, { passive: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') tick();
  updateWakeLock();
});

renderLibrary();
renderActive();
tick();
updateWakeLock();
setInterval(tick, 250);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
