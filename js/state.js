// 게임 상태와 규칙. DOM에 의존하지 않는다(테스트에서 그대로 쓴다).
import * as E from './economy.js';
import { rand, newSeed } from './rng.js';
import { ACHIEVEMENTS } from './achievements.js';
import { short } from './format.js';

export const SAVE_VERSION = 1;
export const STACK_MAX = 100;

function zeroPerks() {
  return Object.fromEntries(E.PERKS.map((p) => [p.id, 0]));
}

export function newLife(perks) {
  return {
    job: 0, tool: Math.min(E.TOOL_MAX_LEVEL, (perks.tool || 0) * E.TOOL_SUBLEVELS),
    luck: 0, helpers: 0, helperSpeed: 0, bulk: 0, unlocked: ['t1'], stake: 0, earned: 0,
  };
}

const ZERO_STATS = {
  tickets: 0, wins: 0, even: 0, small: 0, mid: 0, big: 0, mega: 0, near: 0, golden: 0, goldenWins: 0,
  taps: 0, tapIncome: 0, best: 0, bestName: '', bestMult: 0, totalWon: 0, spent: 0,
  loseStreak: 0, maxLoseStreak: 0, maxCombo: 0, helperTickets: 0, prestiges: 0,
};

export function defaultState() {
  const perks = zeroPerks();
  return {
    v: SAVE_VERSION,
    created: Date.now(),
    playSec: 0,
    money: 0,
    peak: 0,
    stage: 0,
    clovers: 0,
    perks,
    life: newLife(perks),
    sel: 't1',
    qty: 1,
    stack: [], // 산 복권(결과 확정): { t, m, g, n, s, k }
    active: null, // 지금 직접 긁는 복권
    helperJobs: [], // 도우미가 긁는 중: { it, left, total }
    forced: { at: Math.round(E.FORCED_WIN.minSec + rand() * (E.FORCED_WIN.maxSec - E.FORCED_WIN.minSec)), done: false },
    stats: { ...ZERO_STATS },
    ach: {},
    tut: 0,
  };
}

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const isItem = (x) => x && typeof x === 'object' && E.TICKET_BY_ID[x.t] && Number.isFinite(x.m) && Number.isFinite(x.s);

// 저장 데이터를 현재 형식으로 맞춘다(빠진 값은 기본값, 이상한 값은 버린다)
export function migrate(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const s = { ...d, ...raw };
  s.v = SAVE_VERSION;
  for (const k of ['playSec', 'money', 'peak', 'stage', 'clovers', 'created', 'qty', 'tut']) s[k] = Math.max(0, num(s[k], d[k]));
  s.stage = Math.min(E.PRESTIGE.maxStage, Math.floor(s.stage));
  s.perks = { ...zeroPerks(), ...(raw.perks || {}) };
  for (const p of E.PERKS) s.perks[p.id] = Math.min(p.max, Math.max(0, Math.floor(num(s.perks[p.id]))));
  s.life = { ...newLife(s.perks), ...(raw.life || {}) };
  for (const k of ['job', 'tool', 'luck', 'helpers', 'helperSpeed', 'bulk', 'stake', 'earned']) s.life[k] = Math.max(0, num(s.life[k]));
  s.life.tool = Math.min(E.TOOL_MAX_LEVEL, s.life.tool);
  s.life.helpers = Math.min(E.HELPER.hireCosts.length, s.life.helpers);
  s.life.helperSpeed = Math.min(E.HELPER.maxSpeedLevel, s.life.helperSpeed);
  s.life.bulk = Math.min(E.BULK.length - 1, s.life.bulk);
  s.life.unlocked = Array.isArray(s.life.unlocked) ? s.life.unlocked.filter((id) => E.TICKET_BY_ID[id]) : ['t1'];
  if (!s.life.unlocked.includes('t1')) s.life.unlocked.unshift('t1');
  if (!E.TICKET_BY_ID[s.sel] || !s.life.unlocked.includes(s.sel)) s.sel = s.life.unlocked.at(-1);
  s.stack = Array.isArray(s.stack) ? s.stack.filter(isItem).slice(0, STACK_MAX) : [];
  s.active = isItem(s.active) ? s.active : null;
  s.helperJobs = Array.isArray(s.helperJobs) ? s.helperJobs.filter((j) => j && isItem(j.it)).map((j) => ({ it: j.it, left: num(j.left, 5), total: num(j.total, 5) })) : [];
  s.forced = { at: num(raw.forced?.at, d.forced.at), done: !!raw.forced?.done };
  s.stats = { ...ZERO_STATS, ...(raw.stats || {}) };
  s.ach = raw.ach && typeof raw.ach === 'object' ? raw.ach : {};
  return s;
}

export class Game {
  constructor(state = defaultState(), rng = rand) {
    this.s = migrate(state);
    this.rng = rng;
    this.handlers = {};
    this.combo = { count: 0, last: -1e9 };
  }

  on(evt, fn) { (this.handlers[evt] ||= []).push(fn); return this; }
  emit(evt, data) { for (const fn of this.handlers[evt] || []) fn(data); }

  // ───────── 파생 값 ─────────
  ticket(id) { return E.TICKET_BY_ID[id]; }
  price(id, stake = this.s.life.stake) { return E.ticketPrice(this.ticket(id), stake); }
  isUnlocked(id) { return this.s.life.unlocked.includes(id); }
  // 해금 순서: 앞 복권이 열려 있고 환생 조건을 만족해야 한다
  canSeeUnlock(id) {
    const t = this.ticket(id);
    const i = E.TICKETS.indexOf(t);
    return !this.isUnlocked(id) && t.stageReq <= this.s.stage && (i === 0 || this.isUnlocked(E.TICKETS[i - 1].id));
  }
  unlockCost(id) { return E.unlockCost(this.ticket(id), this.s.perks.discount); }
  tapValue(comboMult = 1) { return E.tapValue(this.s.life.job, this.s.perks.job, comboMult); }
  bonus() { return E.prizeBonus(this.s.life.luck, this.s.perks.prize); }
  goldenChance() { return E.goldenChance(this.s.perks.golden); }
  tool() { return E.toolStats(this.s.life.tool); }
  helperTime() { return E.helperTime(this.s.life.helperSpeed, this.s.perks.helper); }
  bulkOptions() { return E.BULK.slice(0, this.s.life.bulk + 1).map((b) => b.n); }
  isFinal() { return this.s.stage >= E.PRESTIGE.maxStage; }
  pendingCount() { return this.s.stack.length + (this.s.active ? 1 : 0) + this.s.helperJobs.length; }
  rtp(id) { return E.effectiveRtp(this.ticket(id), this.s.life.luck, this.s.perks.prize, this.s.perks.golden); }

  addMoney(v) {
    this.s.money += v;
    if (this.s.money > this.s.peak) this.s.peak = this.s.money;
    this.emit('money', this.s.money);
  }
  spend(v) {
    this.s.money -= v;
    this.emit('money', this.s.money);
  }

  // ───────── 알바 ─────────
  comboNow(nowMs) {
    return nowMs - this.combo.last <= E.COMBO.timeout * 1000 ? this.combo.count : 0;
  }
  tap(nowMs) {
    const before = E.comboTier(this.comboNow(nowMs));
    this.combo.count = this.comboNow(nowMs) + 1;
    this.combo.last = nowMs;
    const tier = E.comboTier(this.combo.count);
    const value = this.tapValue(tier.mult);
    this.s.stats.taps++;
    this.s.stats.tapIncome += value;
    if (this.combo.count > this.s.stats.maxCombo) this.s.stats.maxCombo = this.combo.count;
    this.addMoney(value);
    if (this.s.tut === 0 && this.s.money >= this.price('t1')) this.setTut(1);
    return { value, combo: this.combo.count, tier, tierUp: tier.at > before.at };
  }

  // ───────── 구매 ─────────
  canBuy(id, n) {
    if (!this.isUnlocked(id)) return { ok: false, why: '잠긴 복권이에요' };
    if (this.s.stack.length + n > STACK_MAX) return { ok: false, why: `복권은 ${STACK_MAX}장까지 쌓을 수 있어요` };
    const cost = this.price(id) * n;
    if (this.s.money < cost) return { ok: false, why: '돈이 부족해요', short: cost - this.s.money };
    return { ok: true, cost };
  }
  makeOutcome(id) {
    const t = this.ticket(id);
    const s = this.s;
    let m = E.drawTier(t, this.rng, s.life.luck);
    let forced = false;
    if (s.stage === 0 && !s.forced.done && s.playSec >= s.forced.at) {
      m = E.forcedTierMult(t);
      s.forced.done = true;
      forced = true;
    }
    if (m >= 20 && s.stage === 0) s.forced.done = true; // 이미 대박을 맛봤으면 보장은 생략
    const g = this.rng() < this.goldenChance();
    const n = m === 0 && this.rng() < E.NEAR_MISS_EXTRA;
    const it = { t: id, m, g, n, s: newSeed(), k: s.life.stake };
    if (forced) it.f = 1;
    return it;
  }
  buy(id, n) {
    const c = this.canBuy(id, n);
    if (!c.ok) return [];
    this.spend(c.cost);
    this.s.stats.spent += c.cost;
    const items = [];
    for (let i = 0; i < n; i++) items.push(this.makeOutcome(id));
    this.s.stack.push(...items);
    if (this.s.tut === 1) this.setTut(2);
    this.emit('stack');
    return items;
  }
  nextActive() {
    if (!this.s.active && this.s.stack.length) {
      this.s.active = this.s.stack.shift();
      this.emit('stack');
    }
    return this.s.active;
  }
  completeActive() {
    const it = this.s.active;
    if (!it) return null;
    this.s.active = null;
    return this.resolve(it, 'me');
  }

  resolve(it, source) {
    const t = this.ticket(it.t);
    const s = this.s;
    const st = s.stats;
    const cls = E.tierClass(it.m);
    const pay = it.m > 0 ? E.payout(t, it.m, it.g, this.bonus(), it.k) : { base: 0, extra: 0, total: 0 };
    st.tickets++;
    if (source === 'helper') st.helperTickets++;
    if (it.g) st.golden++;
    if (it.m > 0) {
      st.wins++;
      st[cls]++;
      if (it.g) st.goldenWins++;
      st.totalWon += pay.total;
      st.loseStreak = 0;
      if (pay.total > st.best) { st.best = pay.total; st.bestName = t.name; st.bestMult = it.m * (it.g ? 2 : 1); }
      s.life.earned += pay.total;
      this.addMoney(pay.total);
    } else {
      st.loseStreak++;
      if (st.loseStreak > st.maxLoseStreak) st.maxLoseStreak = st.loseStreak;
    }
    const result = { it, ticket: t, source, cls, ...pay };
    if (s.tut === 2 && source === 'me') this.setTut(3);
    this.emit('result', result);
    this.checkAch();
    return result;
  }
  // 판 모양으로 판정된 니어미스는 화면에서 알려준다(통계용)
  noteNear() { this.s.stats.near++; this.checkAch(); }

  // ───────── 도우미 ─────────
  helperTick(dt) {
    const s = this.s;
    const done = [];
    while (s.helperJobs.length < s.life.helpers && s.stack.length) {
      const it = s.stack.pop(); // 직접 긁을 다음 복권(앞쪽)은 남겨두고 뒤에서 가져간다
      const total = this.helperTime();
      s.helperJobs.push({ it, left: total, total });
      this.emit('stack');
    }
    for (const j of s.helperJobs) j.left -= dt;
    const finished = s.helperJobs.filter((j) => j.left <= 0);
    if (finished.length) {
      s.helperJobs = s.helperJobs.filter((j) => j.left > 0);
      for (const j of finished) done.push(this.resolve(j.it, 'helper'));
      this.emit('stack');
    }
    return done;
  }

  // ───────── 강화 ─────────
  upgrades() {
    const s = this.s;
    const L = s.life;
    const list = [];
    const rank = (lv) => E.JOB_RANKS[E.jobRankIndex(lv)];
    list.push({
      id: 'job', icon: 'job', name: '승진', level: L.job,
      title: `${rank(L.job)} · Lv.${L.job}`,
      desc: `탭 수입 ${short(this.tapValue())}원 → ${short(E.tapValue(L.job + 1, s.perks.job))}원`,
      note: E.jobRankIndex(L.job + 1) > E.jobRankIndex(L.job) ? `다음 레벨에 ${rank(L.job + 1)} 승진!` : '',
      cost: E.jobCost(L.job), max: false,
    });
    const tool = E.toolStats(L.tool);
    const nextTool = L.tool < E.TOOL_MAX_LEVEL ? E.toolStats(L.tool + 1) : null;
    list.push({
      id: 'tool', icon: 'tool', name: '긁개', level: L.tool,
      title: `${tool.name} · Lv.${L.tool}`,
      desc: nextTool ? (nextTool.stage > tool.stage ? `${nextTool.name}(으)로 진화!` : `긁는 폭 ${Math.round(tool.radius * 2)} → ${Math.round(nextTool.radius * 2)}`) : '최고 도구예요',
      note: `${Math.round(tool.threshold * 100)}%만 긁으면 자동으로 벗겨져요`,
      cost: nextTool ? E.toolCost(L.tool) : null, max: !nextTool,
    });
    const shift = E.luckShift(L.luck);
    list.push({
      id: 'luck', icon: 'luck', name: '행운 부적', level: L.luck,
      title: `Lv.${L.luck}`,
      desc: L.luck < E.LUCK.shiftLevels ? `당첨 확률 +${Math.round(shift * 100)}%p → +${Math.round(E.luckShift(L.luck + 1) * 100)}%p` : `당첨금 보너스 +${Math.round(E.prizeBonus(L.luck, 0) * 100)}% → +${Math.round(E.prizeBonus(L.luck + 1, 0) * 100)}%`,
      note: L.luck < E.LUCK.shiftLevels ? '꽝이 줄고 작은 당첨이 늘어요' : '당첨 확률은 최대예요. 이제 당첨금이 늘어요',
      cost: E.luckCost(L.luck), max: false,
    });
    if (L.helpers < E.HELPER.hireCosts.length) {
      list.push({
        id: 'hire', icon: 'helper', name: '도우미 고용', level: L.helpers,
        title: `${L.helpers}/${E.HELPER.hireCosts.length}명`,
        desc: L.helpers === 0 ? '쌓아둔 복권을 대신 긁어줘요(구매는 직접)' : '도우미가 한 명 더 긁어줘요',
        note: `한 장에 ${this.helperTime().toFixed(1)}초`,
        cost: E.HELPER.hireCosts[L.helpers], max: false,
      });
    }
    if (L.helpers > 0) {
      const maxed = L.helperSpeed >= E.HELPER.maxSpeedLevel;
      list.push({
        id: 'train', icon: 'train', name: '도우미 교육', level: L.helperSpeed,
        title: `Lv.${L.helperSpeed}`,
        desc: maxed ? '최고 속도예요' : `한 장 ${this.helperTime().toFixed(1)}초 → ${E.helperTime(L.helperSpeed + 1, s.perks.helper).toFixed(1)}초`,
        note: '직접 긁는 게 훨씬 빨라요',
        cost: maxed ? null : E.helperSpeedCost(L.helperSpeed), max: maxed,
      });
    }
    if (L.bulk < E.BULK.length - 1) {
      list.push({
        id: 'bulk', icon: 'bulk', name: '묶음 구매', level: L.bulk,
        title: `×${E.BULK[L.bulk].n}까지`,
        desc: `한 번에 ${E.BULK[L.bulk + 1].n}장씩 살 수 있어요`,
        note: '구매는 항상 직접 해요',
        cost: E.BULK[L.bulk + 1].cost, max: false,
      });
    }
    if (this.isFinal() && L.unlocked.length === E.TICKETS.length) {
      list.push({
        id: 'stake', icon: 'stake', name: '판돈 올리기', level: L.stake,
        title: `×${short(E.stakeMult(L.stake))}`,
        desc: `모든 복권 가격과 당첨금 ×${short(E.stakeMult(L.stake + 1))}`,
        note: '무한 모드 전용. 끝없이 올릴 수 있어요',
        cost: E.stakeCost(L.stake), max: false,
      });
    }
    for (const u of list) u.can = u.cost != null && s.money >= u.cost;
    return list;
  }
  buyUpgrade(id) {
    const u = this.upgrades().find((x) => x.id === id);
    if (!u || u.cost == null || this.s.money < u.cost) return false;
    const L = this.s.life;
    this.spend(u.cost);
    if (id === 'job') L.job++;
    else if (id === 'tool') L.tool++;
    else if (id === 'luck') L.luck++;
    else if (id === 'hire') L.helpers++;
    else if (id === 'train') L.helperSpeed++;
    else if (id === 'bulk') L.bulk++;
    else if (id === 'stake') {
      if (this.pendingCount() > 0) { this.addMoney(u.cost); return false; }
      L.stake++;
    }
    this.emit('upgrade', id);
    this.checkAch();
    return true;
  }
  unlock(id) {
    if (!this.canSeeUnlock(id)) return false;
    const cost = this.unlockCost(id);
    if (this.s.money < cost) return false;
    this.spend(cost);
    this.s.life.unlocked.push(id);
    this.s.sel = id;
    this.emit('unlock', id);
    this.checkAch();
    return true;
  }

  // ───────── 환생 ─────────
  prestigeInfo() {
    const s = this.s;
    const goal = E.prestigeGoal(s.stage);
    return {
      stage: s.stage, final: this.isFinal(), goal, peak: s.peak,
      progress: Math.min(1, s.peak / goal),
      ready: !this.isFinal() && s.peak >= goal,
      clovers: E.cloversFor(s.peak, s.stage),
      pending: this.pendingCount(),
      nextTicket: E.TICKETS.find((t) => t.stageReq === s.stage + 1) || null,
    };
  }
  prestige() {
    const p = this.prestigeInfo();
    if (!p.ready || p.pending > 0) return false;
    const s = this.s;
    s.stage++;
    s.stats.prestiges++;
    s.clovers += p.clovers;
    s.life = newLife(s.perks);
    s.money = E.SEED_MONEY[s.perks.seed] || 0;
    s.peak = s.money;
    s.sel = 't1';
    this.combo = { count: 0, last: -1e9 };
    this.emit('prestige', p);
    this.emit('money', s.money);
    this.checkAch();
    return p.clovers;
  }
  perks() {
    return E.PERKS.map((p) => {
      const lv = this.s.perks[p.id];
      const max = lv >= p.max;
      const cost = max ? null : p.cost(lv);
      let now = '';
      if (p.id === 'seed') now = `지금 ${short(E.SEED_MONEY[lv])}원`;
      return { ...p, level: lv, maxed: max, cost, can: !max && this.s.clovers >= cost, now };
    });
  }
  buyPerk(id) {
    const p = this.perks().find((x) => x.id === id);
    if (!p || !p.can) return false;
    this.s.clovers -= p.cost;
    this.s.perks[id]++;
    if (id === 'tool') this.s.life.tool = Math.max(this.s.life.tool, Math.min(E.TOOL_MAX_LEVEL, this.s.perks.tool * E.TOOL_SUBLEVELS));
    this.emit('perk', id);
    return true;
  }

  // ───────── 목표·기타 ─────────
  nextGoal() {
    const next = E.TICKETS.find((t) => this.canSeeUnlock(t.id));
    if (next) return { kind: 'unlock', id: next.id, label: `${next.name} 해금`, cost: this.unlockCost(next.id), have: this.s.money };
    if (!this.isFinal()) {
      const p = this.prestigeInfo();
      return { kind: 'prestige', label: '환생 목표(최고 보유액)', cost: p.goal, have: this.s.peak };
    }
    const st = this.upgrades().find((u) => u.id === 'stake');
    if (st) return { kind: 'stake', label: '판돈 올리기', cost: st.cost, have: this.s.money };
    const locked = E.TICKETS.find((t) => !this.isUnlocked(t.id));
    return locked ? { kind: 'unlock', id: locked.id, label: `${locked.name} 해금`, cost: this.unlockCost(locked.id), have: this.s.money } : null;
  }
  tickPlay(dt) { this.s.playSec += dt; }
  setTut(n) { if (n > this.s.tut) { this.s.tut = n; this.emit('tut', n); } }
  checkAch() {
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (!this.s.ach[a.id] && a.test(this.s)) {
        this.s.ach[a.id] = Date.now();
        got.push(a);
      }
    }
    for (const a of got) this.emit('ach', a);
    return got;
  }
  serialize() { return JSON.stringify(this.s); }
  meta() {
    const s = this.s;
    return { play: Math.floor(s.playSec), money: Math.floor(s.money), peak: Math.floor(s.peak), stage: s.stage, clovers: s.clovers, tickets: s.stats.tickets, best: s.stats.best };
  }
}
