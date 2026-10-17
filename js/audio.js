// 효과음·배경음악을 Web Audio로 직접 합성한다(외부 음원 없음 → 저작권 걱정 없음).
let ctx = null;
let master, sfxBus, bgmBus, noiseBuf;
let soundOn = true;
let bgmOn = false;
let bgmTimer = null;

function ensure() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = soundOn ? 1 : 0;
  sfxBus.connect(master);
  bgmBus = ctx.createGain();
  bgmBus.gain.value = 0;
  bgmBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// iOS·크롬은 사용자 조작 안에서만 소리를 켤 수 있다
export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  if (bgmOn && !bgmTimer) startBgm();
}

export function setSound(on) {
  soundOn = on;
  if (sfxBus) sfxBus.gain.value = on ? 1 : 0;
  if (!on) scratchStop();
}

export function setBgm(on) {
  bgmOn = on;
  if (!ctx) return;
  if (on) startBgm();
  else stopBgm();
}

function now() {
  return ctx.currentTime;
}

function tone(f, { type = 'sine', dur = 0.15, vol = 0.3, at = 0, attack = 0.005, slide = 0, bus = sfxBus } = {}) {
  if (!ctx || (bus === sfxBus && !soundOn)) return;
  const t = now() + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.1, vol = 0.2, at = 0, freq = 2000, q = 1, type = 'bandpass' } = {}) {
  if (!ctx || !soundOn) return;
  const t = now() + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

export const sfx = {
  tap(level = 0) { tone(2300 + level * 160, { type: 'sine', dur: 0.05, vol: 0.07 }); },
  comboUp(level) { [0, 4, 7].forEach((s, i) => tone(NOTE(72 + level * 2 + s), { type: 'triangle', dur: 0.12, vol: 0.12, at: i * 0.05 })); },
  click() { tone(900, { type: 'triangle', dur: 0.05, vol: 0.08 }); },
  buy() {
    noise({ dur: 0.06, vol: 0.25, freq: 3500, q: 2 });
    tone(NOTE(84), { type: 'square', dur: 0.08, vol: 0.06, at: 0.04 });
    tone(NOTE(91), { type: 'square', dur: 0.14, vol: 0.06, at: 0.1 });
  },
  reveal() { tone(1200, { type: 'sine', dur: 0.06, vol: 0.12, slide: 1.4 }); },
  heartbeat() {
    tone(62, { type: 'sine', dur: 0.16, vol: 0.5, slide: 0.7 });
    tone(58, { type: 'sine', dur: 0.2, vol: 0.4, at: 0.22, slide: 0.7 });
  },
  lose() {
    tone(NOTE(55), { type: 'triangle', dur: 0.18, vol: 0.18 });
    tone(NOTE(50), { type: 'triangle', dur: 0.3, vol: 0.16, at: 0.14 });
  },
  near() {
    tone(NOTE(67), { type: 'triangle', dur: 0.14, vol: 0.14 });
    tone(NOTE(66), { type: 'triangle', dur: 0.14, vol: 0.14, at: 0.13 });
    tone(NOTE(62), { type: 'triangle', dur: 0.4, vol: 0.14, at: 0.26, slide: 0.94 });
  },
  even() { tone(NOTE(79), { type: 'sine', dur: 0.25, vol: 0.2 }); },
  small() {
    tone(NOTE(84), { type: 'sine', dur: 0.18, vol: 0.22 });
    tone(NOTE(88), { type: 'sine', dur: 0.3, vol: 0.22, at: 0.09 });
    coinsSound(3, 0.12);
  },
  mid() {
    [72, 76, 79, 84, 88].forEach((n, i) => tone(NOTE(n), { type: 'triangle', dur: 0.22, vol: 0.18, at: i * 0.07 }));
    coinsSound(8, 0.25);
  },
  big() {
    const chord = (ns, at, dur) => ns.forEach((n) => tone(NOTE(n), { type: 'sawtooth', dur, vol: 0.05, at, attack: 0.02 }));
    chord([60, 64, 67, 72], 0, 0.25);
    chord([62, 65, 69, 74], 0.22, 0.25);
    chord([64, 67, 72, 76], 0.44, 0.9);
    [84, 88, 91, 96].forEach((n, i) => tone(NOTE(n), { type: 'triangle', dur: 0.3, vol: 0.12, at: 0.44 + i * 0.08 }));
    coinsSound(16, 0.5);
  },
  mega() {
    sfx.big();
    const chord = (ns, at, dur) => ns.forEach((n) => tone(NOTE(n), { type: 'sawtooth', dur, vol: 0.05, at, attack: 0.03 }));
    chord([65, 69, 72, 77], 1.25, 0.3);
    chord([67, 71, 74, 79], 1.5, 0.3);
    chord([72, 76, 79, 84], 1.75, 1.4);
    [96, 100, 103, 108, 103, 108].forEach((n, i) => tone(NOTE(n), { type: 'sine', dur: 0.25, vol: 0.09, at: 1.75 + i * 0.09 }));
    coinsSound(24, 1.2);
  },
  golden() { [79, 83, 86, 91].forEach((n, i) => tone(NOTE(n), { type: 'sine', dur: 0.5, vol: 0.12, at: i * 0.06 })); },
  unlock() { [67, 72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), { type: 'triangle', dur: 0.3, vol: 0.15, at: i * 0.06 })); },
  levelup() { [76, 79, 84].forEach((n, i) => tone(NOTE(n), { type: 'triangle', dur: 0.16, vol: 0.14, at: i * 0.05 })); },
  error() { tone(220, { type: 'square', dur: 0.12, vol: 0.06 }); tone(180, { type: 'square', dur: 0.16, vol: 0.06, at: 0.1 }); },
  ach() { [84, 91, 96].forEach((n, i) => tone(NOTE(n), { type: 'sine', dur: 0.35, vol: 0.12, at: i * 0.08 })); },
};

function coinsSound(n, spread) {
  for (let i = 0; i < n; i++) {
    const at = Math.random() * spread;
    tone(3000 + Math.random() * 2500, { type: 'sine', dur: 0.08, vol: 0.05, at });
    tone(5200 + Math.random() * 1500, { type: 'sine', dur: 0.05, vol: 0.03, at: at + 0.02 });
  }
}

// ───────── 긁는 소리(속도에 따라 커지는 잡음) ─────────
let scr = null;
export function scratchStart() {
  if (!ctx || !soundOn || scr) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2600;
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(sfxBus);
  src.start();
  scr = { src, f, g };
}
export function scratchSpeed(v) {
  if (!scr) return;
  const t = now();
  const vol = Math.min(0.22, v * 0.00035);
  scr.g.gain.setTargetAtTime(vol, t, 0.03);
  scr.f.frequency.setTargetAtTime(1800 + Math.min(2600, v * 1.5), t, 0.05);
}
export function scratchStop() {
  if (!scr) return;
  const s = scr;
  scr = null;
  s.g.gain.setTargetAtTime(0, now(), 0.04);
  setTimeout(() => { try { s.src.stop(); } catch { /* 이미 멈춤 */ } }, 200);
}

// ───────── 배경음악: 잔잔한 로파이 루프 ─────────
const PROG = [
  [57, 60, 64, 67], // Am7
  [53, 57, 60, 64], // Fmaj7
  [48, 52, 55, 59], // Cmaj7
  [55, 59, 62, 65], // G7
];
let bgmStep = 0;
let bgmNext = 0;
function startBgm() {
  if (!ctx || bgmTimer) return;
  bgmBus.gain.setTargetAtTime(0.5, now(), 0.5);
  bgmNext = now() + 0.1;
  bgmStep = 0;
  bgmTimer = setInterval(scheduleBgm, 120);
}
function stopBgm() {
  if (!bgmTimer) return;
  clearInterval(bgmTimer);
  bgmTimer = null;
  bgmBus.gain.setTargetAtTime(0, now(), 0.3);
}
function scheduleBgm() {
  const beat = 60 / 84;
  while (bgmNext < now() + 0.6) {
    const bar = Math.floor(bgmStep / 8) % PROG.length;
    const step = bgmStep % 8;
    const at = bgmNext - now();
    const chord = PROG[bar];
    if (step === 0) chord.forEach((n) => tone(NOTE(n), { type: 'triangle', dur: beat * 3.6, vol: 0.035, at, attack: 0.25, bus: bgmBus }));
    if (step === 0 || step === 3 || step === 5) tone(NOTE(chord[0] - 12), { type: 'sine', dur: beat * 0.9, vol: 0.12, at, attack: 0.01, bus: bgmBus });
    if (step % 2 === 1) tone(NOTE(chord[(step + bar) % 4] + 12), { type: 'sine', dur: beat * 0.5, vol: 0.03, at, bus: bgmBus });
    bgmNext += beat / 2;
    bgmStep++;
  }
}
