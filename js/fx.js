// 화면 효과: 동전·꽃가루·은박 부스러기 입자, 떠오르는 글자, 흔들림, 섬광
let canvas, ctx, dpr = 1;
let parts = [];
let running = false;
let reduced = false;

export function initFx(el) {
  canvas = el;
  ctx = canvas.getContext('2d');
  resize();
  addEventListener('resize', resize);
}

export function setReduced(on) {
  reduced = on;
}
export function isReduced() {
  return reduced;
}

function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}

function loop() {
  if (!parts.length) {
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  running = true;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const next = [];
  for (const p of parts) {
    p.life += 1 / 60;
    p.vy += p.g;
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const a = Math.max(0, 1 - p.life / p.max);
    if (a <= 0 || p.y > innerHeight + 40) continue;
    next.push(p);
    ctx.globalAlpha = Math.min(1, a * 1.6);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.kind === 'coin') drawCoin(p);
    else if (p.kind === 'flake') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-p.size, -p.size * 0.4);
      ctx.lineTo(p.size * 0.7, -p.size * 0.8);
      ctx.lineTo(p.size, p.size * 0.5);
      ctx.lineTo(-p.size * 0.3, p.size);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.scale(1, Math.cos(p.rot * 3));
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  parts = next;
  requestAnimationFrame(loop);
}

function drawCoin(p) {
  const s = p.size;
  const sx = Math.abs(Math.cos(p.rot * 2)) * 0.8 + 0.2;
  ctx.scale(sx, 1);
  ctx.fillStyle = '#c99500';
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd84a';
  ctx.beginPath();
  ctx.arc(-s * 0.08, -s * 0.08, s * 0.82, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -s * 0.35, s * 0.28, s * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function add(p) {
  parts.push({ g: 0.25, drag: 0.99, rot: 0, vr: 0, life: 0, max: 1.6, size: 6, color: '#fff', kind: 'coin', ...p });
  if (parts.length > 600) parts.splice(0, parts.length - 600);
  if (!running) requestAnimationFrame(loop);
}

export function coins(x, y, n = 12, power = 1) {
  n = reduced ? Math.ceil(n / 3) : n;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
    const sp = (4 + Math.random() * 7) * power;
    add({ kind: 'coin', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 6 + Math.random() * 5, vr: (Math.random() - 0.5) * 0.3, max: 1.4 + Math.random() * 0.8, g: 0.32 });
  }
}

const CONFETTI = ['#ffd84a', '#ff5a36', '#5aa9ff', '#62d2a2', '#ff6fb1', '#ffffff'];
export function confetti(n = 80) {
  n = reduced ? Math.ceil(n / 4) : n;
  for (let i = 0; i < n; i++) {
    const fromLeft = i % 2 === 0;
    add({
      kind: 'confetti', x: fromLeft ? -10 : innerWidth + 10, y: innerHeight * (0.35 + Math.random() * 0.4),
      vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9), vy: -(7 + Math.random() * 9), g: 0.22, drag: 0.985,
      size: 7 + Math.random() * 7, vr: (Math.random() - 0.5) * 0.4, color: CONFETTI[i % CONFETTI.length], max: 2.6 + Math.random(),
    });
  }
}

export function rain(n = 40) {
  n = reduced ? Math.ceil(n / 4) : n;
  for (let i = 0; i < n; i++) {
    add({ kind: 'coin', x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.5, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 4, g: 0.18, size: 7 + Math.random() * 6, vr: (Math.random() - 0.5) * 0.25, max: 3 });
  }
}

export function flakes(x, y, gold = false, n = 3) {
  if (reduced) return;
  for (let i = 0; i < n; i++) {
    add({
      kind: 'flake', x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, g: 0.28, size: 1.8 + Math.random() * 2.4,
      vr: (Math.random() - 0.5) * 0.5, color: gold ? (Math.random() < 0.5 ? '#e8c35a' : '#b98a1c') : Math.random() < 0.5 ? '#c3c8cf' : '#8e959e', max: 0.9,
    });
  }
}

export function sparks(x, y, n = 10, color = '#fff3b0') {
  if (reduced) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 4;
    add({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.05, drag: 0.94, size: 2 + Math.random() * 3, color, max: 0.6 });
  }
}

// 떠오르는 글자(+12원 등)
export function floatText(x, y, text, cls = '') {
  const el = document.createElement('div');
  el.className = 'float-text ' + cls;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  setTimeout(() => el.remove(), 2000);
}

export function shake(el, strength = 1) {
  if (reduced || !el) return;
  el.style.setProperty('--shake', strength);
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

export function flash(color = 'rgba(255,240,180,.85)') {
  if (reduced) return;
  const el = document.createElement('div');
  el.className = 'flash';
  el.style.background = color;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  setTimeout(() => el.remove(), 1200);
}
