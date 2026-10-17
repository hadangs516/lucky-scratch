// 게임 규칙 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, defaultState, migrate } from '../js/state.js';
import * as E from '../js/economy.js';
import { mulberry32 } from '../js/rng.js';

const tapUntil = (g, money) => { let t = 0; while (g.s.money < money) g.tap((t += 150)); return t; };

test('첫 복권까지 70~100회 탭(콤보 유지 시)', () => {
  const g = new Game(defaultState(), mulberry32(1));
  let n = 0, t = 0;
  while (g.s.money < 1000) { g.tap((t += 150)); n++; }
  assert.ok(n >= 70 && n <= 100, `탭 ${n}회`);
  assert.equal(g.s.tut, 1);
});

test('콤보는 1.2초 쉬면 끊긴다', () => {
  const g = new Game(defaultState(), mulberry32(1));
  for (let i = 0; i < 30; i++) g.tap(i * 100);
  assert.equal(g.combo.count, 30);
  const r = g.tap(30 * 100 + 1300);
  assert.equal(r.combo, 1);
});

test('구매하면 돈이 빠지고 결과가 확정된 복권이 쌓인다', () => {
  const g = new Game(defaultState(), mulberry32(2));
  tapUntil(g, 5000);
  const before = g.s.money;
  const items = g.buy('t1', 1);
  assert.equal(items.length, 1);
  assert.equal(g.s.money, before - 1000);
  assert.equal(g.s.stack.length, 1);
  assert.ok(Number.isFinite(items[0].m));
  assert.equal(g.buy('t2', 1).length, 0, '잠긴 복권은 못 산다');
  const it = g.nextActive();
  const r = g.completeActive();
  assert.equal(r.it, it);
  assert.equal(g.s.stats.tickets, 1);
});

test('당첨금 = 가격 × 배수 × 황금 × (1+보너스)', () => {
  const t = E.TICKET_BY_ID.t3;
  assert.deepEqual(E.payout(t, 5, false, 0), { base: 200000, extra: 0, total: 200000 });
  assert.deepEqual(E.payout(t, 5, true, 0.1), { base: 400000, extra: 40000, total: 440000 });
  assert.equal(E.payout(t, 2, false, 0, 2).base, 40000 * 100 * 2);
});

test('보장 당첨: 10~30분 사이 설정, 그 뒤 첫 구매가 대박', () => {
  const g = new Game(defaultState(), () => 0.999999); // 확률상 항상 꽝이 나오게
  assert.ok(g.s.forced.at >= 600 && g.s.forced.at <= 1800);
  g.s.money = 1e6;
  assert.equal(g.makeOutcome('t1').m, 0);
  g.s.playSec = g.s.forced.at + 1;
  const it = g.makeOutcome('t1');
  assert.equal(it.m, E.forcedTierMult(E.TICKET_BY_ID.t1));
  assert.equal(it.f, 1);
  assert.equal(g.makeOutcome('t1').m, 0, '두 번째부터는 확률대로');
});

test('자연 대박이 먼저 나오면 보장은 생략', () => {
  const g = new Game(defaultState(), () => 0.9999999);
  g.s.life.luck = 0;
  // 20배가 나오도록 rng 조작: drawTier가 20배 구간을 고르게
  const t = E.TICKET_BY_ID.t1;
  const before20 = t.tiers.slice(0, 5).reduce((s, [, w]) => s + w, 0);
  g.rng = () => (before20 + 10) / E.WEIGHT_TOTAL;
  assert.equal(g.makeOutcome('t1').m, 20);
  assert.equal(g.s.forced.done, true);
});

test('행운 부적은 당첨률을 올린다(분산은 거의 그대로)', () => {
  const t = E.TICKET_BY_ID.t3;
  const hit = (lv) => E.effectiveTiers(t, lv).reduce((s, [, w]) => s + w, 0) / E.WEIGHT_TOTAL;
  assert.ok(Math.abs(hit(0) - 0.46) < 1e-6);
  assert.ok(Math.abs(hit(10) - 0.66) < 1e-6);
  assert.ok(Math.abs(hit(15) - hit(30)) < 1e-9, '16레벨부터는 확률 고정');
  assert.ok(E.effectiveRtp(t, 16, 0, 0) > E.effectiveRtp(t, 15, 0, 0), '16레벨부터는 당첨금 보너스');
});

test('도우미는 쌓인 복권을 뒤에서 가져가 긁는다', () => {
  const g = new Game(defaultState(), mulberry32(3));
  g.s.money = 1e6;
  g.s.life.helpers = 1;
  g.buy('t1', 3);
  const front = g.s.stack[0];
  g.helperTick(0.1);
  assert.equal(g.s.helperJobs.length, 1);
  assert.equal(g.s.stack[0], front, '앞쪽 복권은 직접 긁을 몫');
  const res = g.helperTick(g.helperTime());
  assert.equal(res.length, 1);
  assert.equal(res[0].source, 'helper');
});

test('환생: 목표 달성 + 남은 복권 없음일 때만, 클로버 지급, 강화 초기화', () => {
  const g = new Game(defaultState(), mulberry32(4));
  g.s.money = 5e9; g.s.peak = 5e9; g.s.life.job = 30; g.s.life.unlocked = E.TICKETS.slice(0, 6).map((t) => t.id);
  g.s.stack.push(g.makeOutcome('t1'));
  assert.equal(g.prestige(), false, '남은 복권이 있으면 불가');
  g.s.stack = [];
  const c = g.prestige();
  assert.equal(c, E.cloversFor(5e9, 0));
  assert.equal(g.s.stage, 1);
  assert.equal(g.s.life.job, 0);
  assert.deepEqual(g.s.life.unlocked, ['t1']);
  assert.ok(g.canSeeUnlock('t2'));
  assert.ok(!g.canSeeUnlock('t7'), '앞 복권부터 순서대로');
});

test('마지막 환생 뒤엔 환생 불가, 판돈 올리기 등장', () => {
  const g = new Game(defaultState(), mulberry32(5));
  g.s.stage = 5;
  g.s.peak = 1e30;
  assert.equal(g.prestigeInfo().ready, false);
  g.s.life.unlocked = E.TICKETS.map((t) => t.id);
  g.s.money = E.stakeCost(0);
  assert.ok(g.upgrades().some((u) => u.id === 'stake'));
  assert.ok(g.buyUpgrade('stake'));
  assert.equal(g.price('t1'), 10000);
});

test('저장·복원과 이상한 값 정리', () => {
  const g = new Game(defaultState(), mulberry32(6));
  g.s.money = 12345;
  const back = new Game(JSON.parse(g.serialize()));
  assert.equal(back.s.money, 12345);
  const m = migrate({ money: 'abc', stage: 99, life: { tool: 999, unlocked: ['t1', 'zzz'] }, stack: [{ t: 'nope' }, { t: 't1', m: 0, s: 1 }] });
  assert.equal(m.money, 0);
  assert.equal(m.stage, 5);
  assert.equal(m.life.tool, E.TOOL_MAX_LEVEL);
  assert.deepEqual(m.life.unlocked, ['t1']);
  assert.equal(m.stack.length, 1);
});

test('긴 플레이 저장 크기가 시트 한 칸(45,000자)을 넘지 않는다', () => {
  const g = new Game(defaultState(), mulberry32(7));
  g.s.money = 1e12;
  g.s.life.unlocked = E.TICKETS.slice(0, 6).map((t) => t.id);
  for (let i = 0; i < 5; i++) g.buy('t6', 20);
  for (const a of Object.keys(g.s.ach)) g.s.ach[a] = Date.now();
  assert.ok(g.serialize().length < 20000, `${g.serialize().length}자`);
});

test('업적이 조건에 맞게 달성된다', () => {
  const g = new Game(defaultState(), mulberry32(8));
  const got = [];
  g.on('ach', (a) => got.push(a.id));
  g.s.money = 1e6;
  g.buy('t1', 1);
  g.nextActive();
  g.completeActive();
  assert.ok(got.includes('first'));
  assert.ok(got.includes('m1'));
});
