// 은박 긁기 엔진
// - 칸마다 은박 창을 그린다(칸 사이 인쇄 글자는 보인다)
// - 긁은 면적은 5px 격자 표본으로 계산해서 getImageData 없이 가볍게 처리한다
// - 칸의 threshold(도구에 따라 50%→20%) 이상을 긁으면 그 칸의 은박이 통째로 벗겨지며 "공개"된다
// - 모든 칸이 공개되면 끝. 전체 자동 벗기기는 없다(함정 칸을 피할 수 있어야 하므로)
const STEP = 5;

let foilCache = new Map();
function foilPattern(ctx, golden, dpr) {
  const key = (golden ? 'g' : 's') + dpr;
  if (foilCache.has(key)) return ctx.createPattern(foilCache.get(key), 'repeat');
  const c = document.createElement('canvas');
  const S = Math.round(96 * dpr);
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, S, S);
  if (golden) {
    grad.addColorStop(0, '#f6d77a'); grad.addColorStop(0.45, '#d9a92e'); grad.addColorStop(0.55, '#f9e49b'); grad.addColorStop(1, '#c48f1b');
  } else {
    grad.addColorStop(0, '#d9dde2'); grad.addColorStop(0.45, '#aeb5bd'); grad.addColorStop(0.55, '#e4e7ea'); grad.addColorStop(1, '#9ea6af');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // 반짝이 점
  for (let i = 0; i < 260 * dpr; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.08)';
    g.fillRect(Math.random() * S, Math.random() * S, dpr, dpr);
  }
  // 사선 무늬
  g.strokeStyle = golden ? 'rgba(120,80,0,.12)' : 'rgba(60,70,80,.1)';
  g.lineWidth = 2 * dpr;
  for (let i = -S; i < S * 2; i += 12 * dpr) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i - S, S); g.stroke();
  }
  // 작은 클로버 무늬
  g.fillStyle = golden ? 'rgba(140,95,0,.16)' : 'rgba(80,90,100,.13)';
  for (const [x, y] of [[24, 24], [72, 72]]) {
    for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      g.beginPath(); g.arc((x + dx) * dpr, (y + dy) * dpr, 4.2 * dpr, 0, Math.PI * 2); g.fill();
    }
  }
  foilCache.set(key, c);
  return ctx.createPattern(c, 'repeat');
}

export class Scratcher {
  // host: 은박을 덮을 요소(position:relative). cells: [{ id, el }]
  constructor(host, cells, opts) {
    this.host = host;
    this.cellsIn = cells;
    this.opts = opts; // { radius, threshold, golden, onCell, onProgress, onDone, onStroke, onStart, onEnd }
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'foil';
    this.canvas.setAttribute('aria-label', '은박을 손가락으로 문질러 긁으세요');
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.done = false;
    this.revealed = new Set();
    this.drawing = false;
    this.last = null;
    this.layout();
    this.bind();
  }

  layout() {
    const hr = this.host.getBoundingClientRect();
    this.w = hr.width;
    this.h = hr.height;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.cells = this.cellsIn.map(({ id, el }) => {
      const r = el.getBoundingClientRect();
      const x = r.left - hr.left, y = r.top - hr.top;
      const cols = Math.max(1, Math.floor(r.width / STEP)), rows = Math.max(1, Math.floor(r.height / STEP));
      return { id, el, x, y, w: r.width, h: r.height, cols, rows, hit: new Uint8Array(cols * rows), count: 0, total: cols * rows };
    });
    this.totalSamples = this.cells.reduce((s, c) => s + c.total, 0);
    this.covered = 0;
    this.paint();
  }

  paint() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const pat = foilPattern(ctx, this.opts.golden, dpr);
    pat.setTransform?.(new DOMMatrix().scale(1 / dpr));
    for (const c of this.cells) {
      const r = Math.min(10, c.w * 0.14, c.h * 0.2);
      ctx.save();
      roundRect(ctx, c.x - 1, c.y - 1, c.w + 2, c.h + 2, r);
      ctx.fillStyle = pat;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.opts.golden ? 'rgba(120,80,0,.35)' : 'rgba(40,50,60,.25)';
      ctx.stroke();
      // 가운데 물음표
      ctx.fillStyle = this.opts.golden ? 'rgba(110,70,0,.35)' : 'rgba(60,70,80,.3)';
      ctx.font = `900 ${Math.round(Math.min(c.w, c.h) * 0.42)}px 'Black Han Sans', 'Jua', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', c.x + c.w / 2, c.y + c.h / 2 + 1);
      ctx.restore();
    }
  }

  bind() {
    const cv = this.canvas;
    this.onDown = (e) => {
      if (this.done) return;
      e.preventDefault();
      cv.setPointerCapture?.(e.pointerId);
      this.drawing = true;
      this.pointerId = e.pointerId;
      const p = this.pos(e);
      this.last = { ...p, t: performance.now() };
      this.opts.onStart?.(e);
      this.stroke(p, p, 0, e);
    };
    this.onMove = (e) => {
      if (this.done) return;
      if (!this.drawing || e.pointerId !== this.pointerId) {
        this.opts.onHover?.(e);
        return;
      }
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const p = this.pos(ev);
        const t = performance.now();
        const d = Math.hypot(p.x - this.last.x, p.y - this.last.y);
        const v = d / Math.max(1, t - this.last.t) * 1000;
        this.stroke(this.last, p, v, ev);
        this.last = { ...p, t };
      }
    };
    this.onUp = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.drawing = false;
      this.opts.onEnd?.(e);
    };
    cv.addEventListener('pointerdown', this.onDown);
    cv.addEventListener('pointermove', this.onMove);
    cv.addEventListener('pointerup', this.onUp);
    cv.addEventListener('pointercancel', this.onUp);
    cv.addEventListener('lostpointercapture', this.onUp);
    cv.addEventListener('pointerleave', (e) => this.opts.onLeave?.(e));
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  setTool(radius, threshold) {
    this.opts.radius = radius;
    this.opts.threshold = threshold;
  }

  stroke(a, b, v, ev) {
    const { ctx } = this;
    const r = this.opts.radius;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = r * 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y);
    ctx.stroke();
    // 가장자리를 거칠게: 작은 원 몇 개
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.min(6, 1 + Math.floor(len / 10));
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      const ang = Math.random() * Math.PI * 2;
      const rr = r * (0.85 + Math.random() * 0.3);
      ctx.beginPath();
      ctx.arc(a.x + (b.x - a.x) * t + Math.cos(ang) * rr * 0.6, a.y + (b.y - a.y) * t + Math.sin(ang) * rr * 0.6, r * (0.25 + Math.random() * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    this.mark(a, b, r);
    this.opts.onStroke?.(b, v, ev);
  }

  // 선분 a-b에서 반경 r 안의 표본을 긁은 것으로 표시
  mark(a, b, r) {
    const minX = Math.min(a.x, b.x) - r, maxX = Math.max(a.x, b.x) + r;
    const minY = Math.min(a.y, b.y) - r, maxY = Math.max(a.y, b.y) + r;
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy || 1;
    const r2 = r * r;
    let changed = false;
    for (const c of this.cells) {
      if (c.x > maxX || c.x + c.w < minX || c.y > maxY || c.y + c.h < minY) continue;
      const before = c.count;
      for (let j = 0; j < c.rows; j++) {
        const py = c.y + (j + 0.5) * (c.h / c.rows);
        if (py < minY || py > maxY) continue;
        for (let i = 0; i < c.cols; i++) {
          const k = j * c.cols + i;
          if (c.hit[k]) continue;
          const px = c.x + (i + 0.5) * (c.w / c.cols);
          if (px < minX || px > maxX) continue;
          let t = ((px - a.x) * dx + (py - a.y) * dy) / L2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = a.x + dx * t - px, qy = a.y + dy * t - py;
          if (qx * qx + qy * qy <= r2) { c.hit[k] = 1; c.count++; }
        }
      }
      if (c.count !== before) {
        changed = true;
        this.covered += c.count - before;
        if (!this.revealed.has(c.id) && c.count / c.total >= this.opts.threshold) this.openCell(c);
      }
    }
    if (changed) {
      const p = this.covered / this.totalSamples;
      this.opts.onProgress?.(p);
      if (!this.done && this.revealed.size === this.cells.length) this.finish(true);
    }
  }

  // 칸 하나의 은박을 통째로 벗긴다
  // 이어하기: 이미 연 칸은 정산 없이 벗겨 둔다
  restore(ids) {
    for (const c of this.cells) if (ids.includes(c.id)) this.openCell(c, true, true);
  }

  openCell(c, silent = false, quiet = false) {
    if (this.revealed.has(c.id)) return;
    this.revealed.add(c.id);
    c.el.classList.add('revealed');
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    roundRect(ctx, c.x - 2, c.y - 2, c.w + 4, c.h + 4, Math.min(10, c.w * 0.14, c.h * 0.2));
    ctx.fill();
    ctx.restore();
    if (!quiet) this.opts.onCell?.(c.id, this.revealed, silent);
  }

  // 남은 은박을 모두 벗긴다
  finish(animated = true) {
    if (this.done) return;
    this.done = true;
    this.drawing = false;
    for (const c of this.cells) if (!this.revealed.has(c.id)) this.openCell(c, true);
    if (animated) {
      this.canvas.classList.add('peel');
      setTimeout(() => this.canvas.remove(), 450);
    } else this.canvas.remove();
    this.opts.onDone?.();
  }

  // 버리기: 더 긁지 못하게 멈춘다(남은 은박은 화면에서 따로 보여준다)
  stop() {
    this.done = true;
    this.drawing = false;
    this.canvas.classList.add('peel');
    setTimeout(() => this.canvas.remove(), 450);
  }

  destroy() {
    this.done = true;
    this.canvas.remove();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
