// 편의점 계산대(알바) 진행 로직. 화면과 분리되어 있어 테스트·시뮬레이터에서 그대로 쓴다.
// 물건마다 "스캐너 선에 닿는 시각(hit)"을 미리 정해 두고, 누른 시각과의 차이로 판정한다.
// 시간은 모두 밀리초. 멈춘 동안 흐른 시간은 물건 시각을 그만큼 뒤로 밀어 없던 일로 한다.
import * as E from './economy.js';

const R = E.REGISTER;

export class Register {
  // rng: 0~1 난수, rank: () => 지금 직급 번호
  constructor(rng = Math.random, rank = () => 0) {
    this.rng = rng;
    this.rank = rank;
    this.items = []; // { id, kind, mult, hit, res: null|'perfect'|'good'|'miss'|'broken', cust, pair }
    this.seq = 0;
    this.combo = 0;
    this.paused = true;
    this.pausedAt = 0;
    this.jamUntil = 0;
    this.lastTap = -1e9;
    this.idleMisses = 0;
    this.cust = null; // 지금 손님 { id, left, sum, clean, perfect }
    this.custSeq = 0;
    this.nextAt = 0; // 다음 물건이 스캐너에 닿을 시각
  }

  speed() { return E.registerSpeed(this.combo); }
  travel() { return R.travelMs / this.speed(); }

  start(now) {
    if (!this.paused) return;
    const d = now - this.pausedAt;
    if (this.pausedAt) for (const it of this.items) it.hit += d;
    this.nextAt = this.pausedAt ? this.nextAt + d : now + this.travel();
    this.jamUntil = 0;
    this.paused = false;
    this.idleMisses = 0;
    this.lastTap = now;
  }
  pause(now) {
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = now;
  }

  pickKind() {
    const rank = this.rank();
    const pool = E.JOB_ITEMS.filter((x) => x.rank <= rank);
    let r = this.rng() * pool.reduce((s, x) => s + x.w, 0);
    for (const x of pool) if ((r -= x.w) <= 0) return x;
    return pool[0];
  }

  // 물건을 미리 채워 둔다(오른쪽 끝에 나타날 때까지)
  spawn(now) {
    while (this.nextAt <= now + this.travel()) {
      if (!this.cust || this.cust.toSpawn <= 0) {
        if (this.cust) this.nextAt += R.customerGap / this.speed();
        const n = R.basket[0] + Math.floor(this.rng() * (R.basket[1] - R.basket[0] + 1));
        this.cust = { id: ++this.custSeq, toSpawn: n, left: n, sum: 0, clean: true, perfect: true };
      }
      const k = this.pickKind();
      const cust = this.cust;
      const travel = this.travel();
      const make = (hit, pair) => ({ id: ++this.seq, kind: k.kind, mult: k.mult, hit, travel, res: null, cust, pair });
      if (k.kind === 'pair') {
        // 묶음은 바코드 두 개: 짧은 간격으로 두 번 찍는다
        this.items.push(make(this.nextAt, 1), make(this.nextAt + 260 / this.speed(), 2));
        cust.left++;
      } else this.items.push(make(this.nextAt));
      cust.toSpawn--;
      const [g0, g1] = R.gap;
      this.nextAt += (g0 + this.rng() * (g1 - g0)) / this.speed() + (k.kind === 'pair' ? 260 / this.speed() : 0);
    }
  }

  // 매 프레임: 지나간 물건을 놓침 처리. 돌려주는 사건 목록을 화면이 보여준다.
  update(now) {
    const out = [];
    if (this.paused) return out;
    this.spawn(now);
    for (const it of this.items) {
      if (it.res === null && now - it.hit > R.goodMs) {
        it.res = 'miss';
        out.push(this.resolve(it, now, 'miss'));
        if (now - this.lastTap > R.goodMs * 2) this.idleMisses++;
      }
    }
    // 화면 밖으로 나간 물건은 지운다
    this.items = this.items.filter((it) => now - it.hit < it.travel * 0.6);
    if (this.idleMisses >= R.idleMisses) {
      this.pause(now);
      out.push({ type: 'idle' });
    }
    return out;
  }

  // 화면을 눌렀다
  tap(now) {
    if (this.paused) { this.start(now); return { type: 'start' }; }
    this.lastTap = now;
    this.idleMisses = 0;
    if (now < this.jamUntil) return { type: 'jammed' };
    let best = null;
    for (const it of this.items) {
      if (it.res !== null) continue;
      const d = Math.abs(now - it.hit);
      if (d <= R.goodMs && (!best || d < Math.abs(now - best.hit))) best = it;
    }
    if (!best) {
      // 헛손질: 스캐너가 잠깐 먹통이 되고 연속 계산이 끊긴다
      this.jamUntil = now + R.jamMs;
      const lost = this.combo;
      this.combo = 0;
      if (this.cust) { this.cust.clean = false; this.cust.perfect = false; }
      return { type: 'jam', lost };
    }
    const d = Math.abs(now - best.hit);
    let res = d <= R.perfectMs ? 'perfect' : 'good';
    if (best.kind === 'egg' && res !== 'perfect') res = 'broken';
    best.res = res;
    return this.resolve(best, now, res, now - best.hit);
  }

  // 판정 결과를 정리한다. value는 기본 수입 배수(연속 배수·판정·물건 배수 반영), 돈 계산은 Game이 한다.
  resolve(it, now, res, offset = 0) {
    const before = E.comboTier(this.combo);
    let mult = 0;
    if (res === 'perfect' || res === 'good') {
      this.combo++;
      const tier = E.comboTier(this.combo);
      mult = (res === 'perfect' ? R.perfectMult : R.goodMult) * tier.mult * it.mult;
    } else {
      this.combo = 0;
      it.cust.clean = false;
    }
    if (res !== 'perfect') it.cust.perfect = false;
    it.cust.sum += mult;
    it.cust.left--;
    const ev = { type: 'scan', item: it, res, mult, offset, combo: this.combo, tier: E.comboTier(this.combo), tierUp: E.comboTier(this.combo).at > before.at };
    if (it.cust.left === 0) {
      const c = it.cust;
      const bonus = c.perfect ? R.perfectBonus : c.clean ? R.cleanBonus : 0;
      ev.done = { sum: c.sum, bonus: c.sum * bonus, perfect: c.perfect, clean: c.clean };
    }
    return ev;
  }

  // 화면용: 물건의 위치(0=스캐너 선, 1=오른쪽 끝, 음수=지나감)
  pos(it, now) {
    const t = this.paused ? this.pausedAt : now;
    return (it.hit - t) / it.travel;
  }
}
