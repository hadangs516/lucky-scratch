// 은박 긁기 엔진
// - 칸마다 은박 창을 그린다(칸 사이 인쇄 글자는 보인다)
// - 은박은 한 번에 벗겨지지 않는다. 지나갈 때마다 조금씩 얇아져서 아래 그림이 서서히 비친다.
//   손가락이 반경의 절반만큼 움직일 때마다 그 구간을 한 번 칠한다(느리게 긁든 빠르게 긁든 거리만큼만 깎인다).
// - 남은 은박은 5px 격자 표본(0~1)으로 기억한다. 칸 평균이 openAt 아래로 내려가면 그 칸이 "툭" 열린다.
// - 모든 칸이 열리면 끝. 전체 자동 벗기기는 없다(함정 칸을 피할 수 있어야 하므로)
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
    // { radius, strength(한 번 지나갈 때 깎이는 비율), openAt, golden, onCell, onProgress, onDone, onStroke, onStart, onEnd }
    this.opts = { openAt: 0.35, ...opts };
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

  // 위치는 화면 좌표가 아니라 배치(offset) 기준으로 잰다.
  // 복권이 날아 들어오는 애니메이션(회전) 중에 재도 은박이 칸과 어긋나지 않게 하기 위해서다.
  layout() {
    this.w = this.host.offsetWidth;
    this.h = this.host.offsetHeight;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.cells = this.cellsIn.map(({ id, el }) => {
      const { x, y } = offsetIn(el, this.host);
      const r = { width: el.offsetWidth, height: el.offsetHeight };
      const cols = Math.max(1, Math.floor(r.width / STEP)), rows = Math.max(1, Math.floor(r.height / STEP));
      // 열림 판정은 칸 안쪽 80%만 본다(손가락이 닿기 어려운 모서리 때문에 안 열리는 일이 없게)
      const inner = new Uint8Array(cols * rows);
      let total = 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const u = (i + 0.5) / cols, v = (j + 0.5) / rows;
          if (u > 0.1 && u < 0.9 && v > 0.1 && v < 0.9) { inner[j * cols + i] = 1; total++; }
        }
      }
      if (!total) { inner.fill(1); total = cols * rows; }
      return { id, el, x, y, w: r.width, h: r.height, cols, rows, hp: new Float32Array(cols * rows).fill(1), inner, left: total, total };
    });
    this.totalSamples = this.cells.reduce((s, c) => s + c.total, 0);
    this.paint();
    for (const c of this.cells) if (this.revealed.has(c.id)) this.clearCell(c);
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
      this.anchor = p;
      this.opts.onStart?.(e);
      this.stroke(p, p, 0, e); // 누른 자리도 살짝 깎인다
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
        this.last = { ...p, t };
        this.opts.onMove?.(p, v, ev);
        // 긴 이동은 일정한 길이로 잘라 칠한다(빠르게 긁어 이벤트가 듬성듬성해도 깎이는 양이 같게)
        const step = this.chunk();
        let d2 = Math.hypot(p.x - this.anchor.x, p.y - this.anchor.y);
        while (d2 >= step && !this.done) {
          const k = step / d2;
          const q = { x: this.anchor.x + (p.x - this.anchor.x) * k, y: this.anchor.y + (p.y - this.anchor.y) * k };
          this.stroke(this.anchor, q, v, ev);
          this.anchor = q;
          d2 -= step;
        }
      }
    };
    this.onUp = (e) => {
      if (e.pointerId !== this.pointerId) return;
      if (this.drawing && !this.done && this.anchor && Math.hypot(this.last.x - this.anchor.x, this.last.y - this.anchor.y) > 1) this.stroke(this.anchor, this.last, 0, e);
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

  // 화면이 확대·축소돼 보이는 경우(애니메이션 등)에도 캔버스 좌표로 맞춘다
  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * this.w) / (r.width || 1), y: ((e.clientY - r.top) * this.h) / (r.height || 1) };
  }

  setTool(radius, strength) {
    this.opts.radius = radius;
    this.opts.strength = strength;
  }
  chunk() { return Math.max(3, this.opts.radius * 0.5); }

  // a→b 구간을 한 번 칠한다. 깎이는 양은 움직인 거리에 비례한다.
  stroke(a, b, v, ev) {
    const { ctx } = this;
    const r = this.opts.radius;
    const len = Math.max(this.chunk() * 0.5, Math.hypot(b.x - a.x, b.y - a.y));
    const alpha = 1 - (1 - this.opts.strength) ** (len / (2 * r));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = r * 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y);
    ctx.stroke();
    // 가장자리를 거칠게: 작은 원 몇 개(보이는 것만, 계산에는 넣지 않는다)
    ctx.globalAlpha = alpha * 0.6;
    const n = Math.min(4, 1 + Math.floor(len / 10));
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      const ang = Math.random() * Math.PI * 2;
      const rr = r * (0.85 + Math.random() * 0.3);
      ctx.beginPath();
      ctx.arc(a.x + (b.x - a.x) * t + Math.cos(ang) * rr * 0.75, a.y + (b.y - a.y) * t + Math.sin(ang) * rr * 0.75, r * (0.2 + Math.random() * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    const worn = this.mark(a, b, r, alpha);
    this.opts.onStroke?.(b, v, ev, worn);
  }

  // 선분 a-b에서 반경 r 안의 표본을 (1-alpha)배로 얇게 한다. 깎인 양(표본 단위)을 돌려준다.
  mark(a, b, r, alpha) {
    const minX = Math.min(a.x, b.x) - r, maxX = Math.max(a.x, b.x) + r;
    const minY = Math.min(a.y, b.y) - r, maxY = Math.max(a.y, b.y) + r;
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy || 1;
    const r2 = r * r;
    const keep = 1 - alpha;
    let worn = 0;
    for (const c of this.cells) {
      if (this.revealed.has(c.id)) continue;
      if (c.x > maxX || c.x + c.w < minX || c.y > maxY || c.y + c.h < minY) continue;
      const before = c.left;
      for (let j = 0; j < c.rows; j++) {
        const py = c.y + (j + 0.5) * (c.h / c.rows);
        if (py < minY || py > maxY) continue;
        for (let i = 0; i < c.cols; i++) {
          const px = c.x + (i + 0.5) * (c.w / c.cols);
          if (px < minX || px > maxX) continue;
          let t = ((px - a.x) * dx + (py - a.y) * dy) / L2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = a.x + dx * t - px, qy = a.y + dy * t - py;
          if (qx * qx + qy * qy <= r2) {
            const k = j * c.cols + i;
            const h = c.hp[k];
            c.hp[k] = h * keep;
            if (c.inner[k]) c.left -= h - c.hp[k];
          }
        }
      }
      if (c.left !== before) {
        worn += before - c.left;
        if (c.left / c.total < this.opts.openAt) this.openCell(c);
      }
    }
    if (worn > 0) {
      this.opts.onProgress?.(this.progress());
      if (!this.done && this.revealed.size === this.cells.length) this.finish(true);
    }
    return worn;
  }
  // 전체 진행도(0~1): 열린 칸은 1, 나머지는 깎인 비율
  progress() {
    let s = 0;
    for (const c of this.cells) s += this.revealed.has(c.id) ? c.total : c.total - c.left;
    return s / this.totalSamples;
  }
  // 칸 하나가 얼마나 얇아졌는지(0~1, 1이면 열림 직전)
  cellWear(id) {
    const c = this.cells.find((x) => x.id === id);
    if (!c) return 0;
    if (this.revealed.has(c.id)) return 1;
    return Math.min(1, (1 - c.left / c.total) / (1 - this.opts.openAt));
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
    this.clearCell(c);
    if (!quiet) this.opts.onCell?.(c.id, this.revealed, silent);
  }
  clearCell(c) {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    roundRect(ctx, c.x - 2, c.y - 2, c.w + 4, c.h + 4, Math.min(10, c.w * 0.14, c.h * 0.2));
    ctx.fill();
    ctx.restore();
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

// host 안에서의 위치(변형 무시). host까지 offsetParent를 따라 올라간다
function offsetIn(el, host) {
  let x = 0, y = 0, e = el;
  while (e && e !== host) {
    x += e.offsetLeft;
    y += e.offsetTop;
    const p = e.offsetParent;
    if (p && p !== host && !host.contains(p)) {
      // host가 위치 기준 요소가 아니면 화면 좌표로 대신 잰다
      const hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: r.left - hr.left, y: r.top - hr.top };
    }
    e = p;
  }
  return { x, y };
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
