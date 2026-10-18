// 진행 속도 시뮬레이터.
// 사람이 하는 플레이를 단순화한 "봇"으로 1회차~무한 모드까지 돌려
// 첫 복권까지 탭 수, 해금 시점, 환생 시점, 수입 비중 등을 측정한다.
//
// 사용법: node tools/simulate.mjs [시드 개수=200] [--verbose]
import * as E from '../js/economy.js';
import { makeCard, cardAmount } from '../js/cards.js';

const args = process.argv.slice(2);
const SEEDS = Number(args.find((a) => /^\d+$/.test(a)) ?? 200);
const VERBOSE = args.includes('--verbose');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 플레이어 모델
const DEFAULT_PLAYER = {
  tapRate: 5, // 초당 탭
  scratchSpeed: 700, // 손가락 이동 px/초
  scratchEff: 0.55, // 겹쳐 긁는 비율을 뺀 효율
  overhead: 1.2, // 구매 버튼 → 결과 확인까지 고정 시간
  spendFrac: 0.5, // 업그레이드는 보유액의 이 비율 이하일 때 산다
  betFrac: 0.5, // 복권 한 장 값이 보유액의 이 비율 이하인 가장 비싼 복권을 고른다
  saveFrom: 0.3,
  tiersBack: 0, // 최신 복권이 비싸면 몇 단계 아래까지 사는지 // 다음 해금 비용의 이 비율 이상 모이면 복권을 멈추고 저축한다(목표 지향)
  decisionEvery: 1, // 탭하는 동안 몇 초마다 다시 판단하는지
};
const SCRATCH_AREA = 300 * 175; // 은박 면적(px²)

function manualTime(toolLevel, p) {
  const t = E.toolStats(toolLevel);
  return p.overhead + (SCRATCH_AREA * t.threshold) / (2 * t.radius * p.scratchSpeed * p.scratchEff) + 0.4;
}
function celebrateTime(mult) {
  const c = E.tierClass(mult);
  return { trap: 0.4, lose: 0, bit: 0.2, even: 0.3, small: 0.6, mid: 1.5, big: 3, mega: 4.5 }[c];
}

function newLife(perks, stage) {
  return {
    money: E.SEED_MONEY[perks.seed] ?? 0,
    peak: 0,
    job: 0, tool: perks.tool * E.TOOL_SUBLEVELS, luck: 0, helpers: 0, helperSpeed: 0, bulk: 0,
    unlocked: new Set(['t1']), stake: 0,
    stack: [], // 쌓인 복권 id
    stage,
  };
}

function simulateRun(seed, player = DEFAULT_PLAYER, opts = {}) {
  const rng = mulberry32(seed);
  const p = player;
  const perks = Object.fromEntries(E.PERKS.map((x) => [x.id, 0]));
  let clovers = 0;
  const lives = [];
  let totalTime = 0;
  let lifeClovers = 0;
  let forcedAt = E.FORCED_WIN.minSec + rng() * (E.FORCED_WIN.maxSec - E.FORCED_WIN.minSec);
  let forcedDone = false;
  const maxLives = opts.maxLives ?? 6;
  const infiniteSecs = opts.infiniteSecs ?? 3600;

  for (let stage = 0; stage < maxLives; stage++) {
    const L = newLife(perks, stage);
    const goal = E.prestigeGoal(stage);
    const log = { stage, events: [], tapIncome: 0, ticketNet: 0, tickets: 0, bigWins: 0, busts: 0, firstTicketTaps: null, taps: 0 };
    let t = 0;
    let combo = 0, lastTap = -99;
    let busy = 0; // 사람의 남은 작업 시간
    let pending = null; // 사람이 긁고 있는 복권 결과
    const helperTimers = [];
    let nextDecision = 0;
    let wasRich = false;
    const dt = 0.1;
    const limit = stage >= E.PRESTIGE.maxStage ? infiniteSecs : 6 * 3600;
    const bonus = () => E.prizeBonus(L.luck, perks.prize);
    const gChance = E.goldenChance(perks.golden);

    const resolve = (id, who) => {
      const tk = E.TICKET_BY_ID[id];
      const item = { t: id, s: Math.floor(rng() * 4294967296), l: L.luck, g: rng() < gChance, n: rng() < E.NEAR_MISS_EXTRA, k: L.stake };
      if (!forcedDone && stage === 0 && totalTime + t >= forcedAt) {
        item.f = 1; forcedDone = true;
      }
      const card = makeCard(tk, item);
      if (item.f) log.events.push([t, `보장 당첨 ${tk.name} ${card.m}배`]);
      if (card.m >= 15 && stage === 0) forcedDone = true;
      const pay = cardAmount(tk, card, null, item, bonus()).amount;
      L.money = Math.max(0, L.money + pay);
      lifeClovers += card.clovers;
      log.ticketNet += pay;
      log.tickets++;
      if (card.m >= 15) log.bigWins++;
      return who === 'human' ? celebrateTime(card.m) : 0;
    };

    const buyUpgrades = () => {
      for (let guard = 0; guard < 50; guard++) {
        const c = [];
        const next = E.TICKETS.find((x) => !L.unlocked.has(x.id) && x.stageReq <= stage);
        if (next) c.push({ cost: E.unlockCost(next, perks.discount), prio: true, go: () => { L.unlocked.add(next.id); log.events.push([t, `해금 ${next.name}`]); } });
        c.push({ cost: E.jobCost(L.job), go: () => L.job++ });
        if (L.tool < E.TOOL_MAX_LEVEL) c.push({ cost: E.toolCost(L.tool), go: () => L.tool++ });
        c.push({ cost: E.luckCost(L.luck), go: () => L.luck++ });
        if (L.helpers < E.HELPER.hireCosts.length) c.push({ cost: E.HELPER.hireCosts[L.helpers], go: () => { L.helpers++; helperTimers.push(0); } });
        if (L.helpers > 0 && L.helperSpeed < E.HELPER.maxSpeedLevel) c.push({ cost: E.helperSpeedCost(L.helperSpeed), go: () => L.helperSpeed++ });
        if (L.bulk < E.BULK.length - 1) c.push({ cost: E.BULK[L.bulk + 1].cost, go: () => L.bulk++ });
        if (stage >= E.PRESTIGE.maxStage && L.unlocked.size === E.TICKETS.length) c.push({ cost: E.stakeCost(L.stake), go: () => { L.stake++; log.events.push([t, `판돈 ${L.stake}단계`]); } });
        // 목표 지향: 다음 해금 비용의 saveFrom 이상 모았으면 해금 비용의 5% 이하 업그레이드만 산다
        const saving = next && L.money >= p.saveFrom * E.unlockCost(next, perks.discount);
        const cap = saving ? Math.min(L.money * p.spendFrac, 0.05 * E.unlockCost(next, perks.discount)) : L.money * p.spendFrac;
        const ok = c.filter((x) => (x.prio ? x.cost <= L.money * 0.85 : x.cost <= cap));
        if (!ok.length) return;
        ok.sort((a, b) => (b.prio ? 1 : 0) - (a.prio ? 1 : 0) || a.cost - b.cost);
        L.money -= ok[0].cost;
        ok[0].go();
      }
    };

    // 사람 모델: 최신 복권(또는 바로 아래 등급)만 산다. 옛날 싼 복권으로는 잘 돌아가지 않는다.
    const chooseTicket = () => {
      const next = E.TICKETS.find((x) => !L.unlocked.has(x.id) && x.stageReq <= stage);
      if (next && L.money >= p.saveFrom * E.unlockCost(next, perks.discount)) return null;
      const owned = E.TICKETS.filter((x) => L.unlocked.has(x.id));
      const cands = owned.slice(-1 - p.tiersBack).reverse();
      const frac = owned.length === 1 ? 1 : p.betFrac; // 처음엔 1장 살 돈만 있어도 산다
      for (const x of cands) if (E.ticketPrice(x, L.stake) <= L.money * frac) return x;
      return null;
    };

    while (t < limit) {
      // 도우미
      for (let i = 0; i < helperTimers.length; i++) {
        if (helperTimers[i] > 0) {
          helperTimers[i] -= dt;
          if (helperTimers[i] <= 0) resolve(helperTimers[`id${i}`], 'helper');
        } else if (L.stack.length) {
          helperTimers[`id${i}`] = L.stack.shift();
          helperTimers[i] = E.helperTime(L.helperSpeed, perks.helper);
        }
      }
      if (busy > 0) {
        busy -= dt;
        if (busy <= 0 && pending) {
          busy = resolve(pending, 'human');
          pending = null;
        }
      } else if (L.stack.length) {
        pending = L.stack.shift();
        busy = manualTime(L.tool, p);
      } else if (t >= nextDecision) {
        nextDecision = t + p.decisionEvery;
        if (log.firstTicketTaps !== null || stage > 0) buyUpgrades(); // 튜토리얼: 첫 복권 전에는 강화 탭이 잠겨 있다
        const tk = chooseTicket();
        if (tk) {
          const price = E.ticketPrice(tk, L.stake);
          const n = Math.max(1, Math.min(E.BULK[L.bulk].n, Math.floor((L.money * (L.unlocked.size === 1 ? 1 : p.betFrac)) / price)));
          for (let i = 0; i < n && L.money >= price; i++) { L.money -= price; log.ticketNet -= price; L.stack.push(tk.id); }
          if (log.firstTicketTaps === null) log.firstTicketTaps = log.taps;
        }
      }
      // 사람이 할 일이 없으면 탭
      if (busy <= 0 && !L.stack.length && !pending) {
        const taps = p.tapRate * dt;
        if (t - lastTap > E.COMBO.timeout) combo = 0;
        combo += taps;
        lastTap = t;
        const v = E.tapValue(L.job, perks.job, E.comboTier(combo).mult) * taps;
        L.money += v; log.tapIncome += v; log.taps += taps;
      }
      L.peak = Math.max(L.peak, L.money);
      const top = E.TICKETS.filter((x) => L.unlocked.has(x.id)).at(-1);
      if (L.money > 20 * E.ticketPrice(top, L.stake)) wasRich = true;
      if (wasRich && L.money < E.ticketPrice(E.TICKETS[0], L.stake)) { log.busts++; wasRich = false; }
      if (opts.trace && Math.abs((t + 1e-6) % 120) < dt * 0.99) console.error(`  ${mins(t)}분 돈 ${E.roundNice(L.money)} job ${L.job} tool ${L.tool} luck ${L.luck} helper ${L.helpers}/${L.helperSpeed} bulk ${L.bulk} unlocked ${L.unlocked.size} tap ${E.tapValue(L.job, perks.job)}`);
      t += dt;
      if (stage < E.PRESTIGE.maxStage && L.peak >= goal && !L.stack.length && busy <= 0) break;
    }
    log.time = t;
    log.peak = L.peak;
    log.final = { job: L.job, tool: L.tool, luck: L.luck, helpers: L.helpers, helperSpeed: L.helperSpeed, unlocked: L.unlocked.size, stake: L.stake, money: L.money };
    totalTime += t;
    if (stage < E.PRESTIGE.maxStage) {
      const got = E.cloversFor(L.peak, stage);
      log.clovers = got;
      log.cellClovers = lifeClovers;
      clovers += got + lifeClovers;
      lifeClovers = 0;
      // 클로버 소비: 싼 것부터
      for (let guard = 0; guard < 200; guard++) {
        const opts2 = E.PERKS.filter((x) => perks[x.id] < x.max).map((x) => ({ x, c: x.cost(perks[x.id]) })).filter((o) => o.c <= clovers);
        if (!opts2.length) break;
        opts2.sort((a, b) => a.c - b.c);
        clovers -= opts2[0].c; perks[opts2[0].x.id]++;
      }
      log.perks = { ...perks };
    }
    lives.push(log);
    if (opts.trace) for (const [tt, e] of log.events) console.error(`  [${E.LIFE_NAMES[stage]}] ${mins(tt)}분 ${e}`);
  }
  return lives;
}

function pct(arr, q) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
const mins = (s) => (s / 60).toFixed(1);

export function runReport(n = SEEDS, player = DEFAULT_PLAYER, label = '기본 플레이어') {
  const runs = [];
  for (let i = 0; i < n; i++) runs.push(simulateRun(1000 + i, player));
  const out = [];
  out.push(`## ${label} (시드 ${n}개, 초당 ${player.tapRate}탭, 베팅 비율 ${player.betFrac})`);
  out.push('');
  out.push('| 회차 | 소요 시간 P10 / 중앙값 / P90 (분) | 탭 수입 비중 | 긁은 복권(중앙값) | 15배 이상 당첨(중앙값) | 파산 경험 비율 | 클로버(중앙값) |');
  out.push('|---|---|---|---|---|---|---|');
  for (let s = 0; s < runs[0].length; s++) {
    const L = runs.map((r) => r[s]);
    const time = L.map((x) => x.time);
    const share = L.map((x) => x.tapIncome / Math.max(1, x.tapIncome + Math.max(0, x.ticketNet)));
    out.push(`| ${E.LIFE_NAMES[s]} | ${mins(pct(time, 0.1))} / ${mins(pct(time, 0.5))} / ${mins(pct(time, 0.9))} | ${(pct(share, 0.5) * 100).toFixed(0)}% | ${pct(L.map((x) => x.tickets), 0.5)} | ${pct(L.map((x) => x.bigWins), 0.5)} | ${((L.filter((x) => x.busts > 0).length / L.length) * 100).toFixed(0)}% | ${L[0].clovers === undefined ? '-' : pct(L.map((x) => x.clovers), 0.5)} |`);
  }
  const ft = runs.map((r) => r[0].firstTicketTaps);
  out.push('');
  out.push(`- 첫 복권까지 탭 수: 중앙값 ${pct(ft, 0.5).toFixed(0)}회 (범위 ${Math.min(...ft).toFixed(0)}~${Math.max(...ft).toFixed(0)})`);
  // 1회차 이벤트 시점 중앙값
  const evTimes = {};
  for (const r of runs) for (const [t, e] of r[0].events) { const k = e.replace(/^보장 당첨 .*/, '보장 당첨'); (evTimes[k] ??= []).push(t); }
  out.push(`- 1회차 주요 사건 시점(중앙값, 분): ` + Object.entries(evTimes).map(([k, v]) => `${k} ${mins(pct(v, 0.5))}`).join(', '));
  const inf = runs.map((r) => r.at(-1));
  out.push(`- 무한 모드 1시간 뒤 판돈 단계(중앙값): ${pct(inf.map((x) => x.final.stake), 0.5)}, 보유액 중앙값 ${E.roundNice(pct(inf.map((x) => x.final.money), 0.5)).toExponential(2)}원`);
  const tot = runs.map((r) => r.slice(0, E.PRESTIGE.maxStage).reduce((s, x) => s + x.time, 0));
  out.push(`- 마지막(5번째) 환생까지 총 시간: 중앙값 ${(pct(tot, 0.5) / 3600).toFixed(1)}시간 (P10 ${(pct(tot, 0.1) / 3600).toFixed(1)} ~ P90 ${(pct(tot, 0.9) / 3600).toFixed(1)})`);
  if (VERBOSE) {
    for (const s of runs[0]) console.error(E.LIFE_NAMES[s.stage], mins(s.time), JSON.stringify(s.final), s.events.map(([t, e]) => `${mins(t)}:${e}`).join(' | '));
  }
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}` && args.includes('--life1')) {
  const runs = [];
  for (let i = 0; i < SEEDS; i++) runs.push(simulateRun(1000 + i, DEFAULT_PLAYER, { maxLives: 1 })[0]);
  const ev = {};
  for (const r of runs) for (const [t, e] of r.events) { const k = e.replace(/^보장 당첨 .*/, '보장'); (ev[k] ??= []).push(t); }
  console.log('life1 time P10/50/90', [0.1, 0.5, 0.9].map((q) => mins(pct(runs.map((r) => r.time), q))).join(' / '), 'tapShare', (pct(runs.map((r) => r.tapIncome / (r.tapIncome + Math.max(1, r.ticketNet))), 0.5) * 100).toFixed(0) + '%', 'firstTaps', pct(runs.map((r) => r.firstTicketTaps), 0.5));
  console.log(Object.entries(ev).map(([k, v]) => `${k}:${mins(pct(v, 0.5))}`).join('  '));
  console.log('final', JSON.stringify(runs[0].final));
} else if (import.meta.url === `file://${process.argv[1]}` && args.includes('--trace')) {
  simulateRun(1001, DEFAULT_PLAYER, { trace: true, maxLives: 2 });
} else if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(runReport());
  console.log('');
  console.log(runReport(SEEDS, { ...DEFAULT_PLAYER, tapRate: 3.5, betFrac: 0.25, tiersBack: 1, spendFrac: 0.7, saveFrom: 0.2 }, '신중한 플레이어(느린 탭, 적게 베팅)'));
  console.log('');
  console.log(runReport(SEEDS, { ...DEFAULT_PLAYER, tapRate: 7, betFrac: 1, spendFrac: 0.4, saveFrom: 2 }, '공격적인 플레이어(빠른 탭, 크게 베팅)'));
}
