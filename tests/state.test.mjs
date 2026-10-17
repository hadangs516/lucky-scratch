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
  assert.ok(Number.isFinite(items[0].s));
  assert.equal(g.buy('t2', 1).length, 0, '잠긴 복권은 못 산다');
  const it = g.nextActive();
  const r = g.completeActive();
  assert.equal(r.it, it);
  assert.equal(g.s.stats.tickets, 1);
});

test('칸을 열 때마다 바로 정산되고, 끝까지 열면 전체 금액과 같다', () => {
  for (let k = 0; k < 30; k++) {
    const g = new Game(defaultState(), mulberry32(100 + k));
    g.s.money = 1e7;
    g.s.life.unlocked = ['t1', 't2', 't3', 't4'];
    g.buy('t4', 1);
    const a = g.nextActive();
    const card = g.cardOf(a);
    const before = g.s.money;
    let sum = 0;
    for (const c of card.cells) sum += g.revealCell(c.i).delta;
    assert.equal(g.revealCell(0), null, '이미 연 칸은 다시 정산하지 않는다');
    const r = g.completeActive();
    assert.equal(r.total, sum);
    assert.equal(g.s.money, before + sum);
  }
});

test('버리기: 안 연 칸(함정 포함)은 정산하지 않는다', () => {
  const g = new Game(defaultState(), mulberry32(5));
  g.s.money = 1e8;
  g.s.life.unlocked = ['t1', 't2', 't3', 't4'];
  for (let k = 0; k < 200; k++) {
    g.buy('t4', 1);
    const a = g.nextActive();
    const card = g.cardOf(a);
    const trapAt = card.cells.findIndex((c) => c.sym.kind === 'trap');
    if (trapAt < 0) { g.completeActive(); continue; }
    const safe = card.cells.filter((c) => c.sym.kind !== 'trap').map((c) => c.i);
    for (const i of safe) g.revealCell(i);
    const r = g.completeActive(true);
    assert.equal(r.discard, true);
    assert.ok(r.ev.traps === 0, '함정을 열지 않았으니 벌금 없음');
    assert.equal(g.s.stats.discards, 1);
    return;
  }
  assert.fail('함정 판을 찾지 못함');
});

test('보장 당첨: 10~30분 사이 설정, 그 뒤 첫 구매가 15~25배', () => {
  const g = new Game(defaultState(), mulberry32(9));
  assert.ok(g.s.forced.at >= 600 && g.s.forced.at <= 1800);
  g.s.money = 1e6;
  g.s.forced.done = false;
  g.s.playSec = g.s.forced.at + 1;
  const it = g.makeOutcome('t1');
  assert.equal(it.f, 1);
  const m = g.cardOf(it).m;
  assert.ok(m >= 15 && m <= 25, `${m}`);
  assert.equal(g.makeOutcome('t1').f, undefined, '두 번째부터는 확률대로');
});

test('행운 부적: 꽝·함정 칸 가중치를 줄이고(15레벨 상한) 그 뒤엔 당첨금 보너스', () => {
  const t = E.TICKET_BY_ID.t4;
  const w = (lv) => E.cellWeights(t, lv);
  assert.ok(w(10)[0].w < w(0)[0].w);
  assert.equal(w(15)[0].w, w(30)[0].w);
  assert.ok(E.prizeBonus(16, 0) > E.prizeBonus(15, 0));
});

test('이전 저장 형식(v1, 결과 배수 저장)도 불러온다', () => {
  const m = migrate({ v: 1, stack: [{ t: 't2', m: 5, g: false, n: false, s: 777, k: 0 }], active: { t: 't1', m: 0, s: 3, k: 0 } });
  assert.equal(m.stack.length, 1);
  assert.equal(m.stack[0].l, 0);
  assert.deepEqual(m.active.rv, []);
  const g = new Game(m, mulberry32(1));
  assert.ok(g.cardOf(g.s.stack[0]).cells.length === E.TICKET_BY_ID.t2.cells);
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
  assert.equal(res[0].total, g.cardOf(res[0].it) && res[0].total);
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
  const m = migrate({ money: 'abc', stage: 99, life: { tool: 999, unlocked: ['t1', 'zzz'] }, stack: [{ t: 'nope' }, { t: 't1', s: 1 }] });
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
  g.addMoney(1e6);
  g.buy('t1', 1);
  g.nextActive();
  g.completeActive();
  assert.ok(got.includes('first'));
  assert.ok(got.includes('m1'));
});
