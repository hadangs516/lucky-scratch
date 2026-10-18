// 칸 복권: 결과가 시드로 확정되고, 정산이 공개 순서와 무관한지 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/economy.js';
import { makeCard, cardAmount, evaluate } from '../js/cards.js';
import { CARD_STATS } from '../js/cardStats.js';

const item = (t, s, extra = {}) => ({ t: t.id, s, l: 0, g: false, n: false, k: 0, ...extra });

test('같은 시드면 같은 칸', () => {
  for (const t of E.TICKETS) {
    const a = makeCard(t, item(t, 12345));
    const b = makeCard(t, item(t, 12345));
    assert.deepEqual(a, b);
    assert.equal(a.cells.length, t.cells);
  }
});

test('최대 배수를 넘는 판은 나오지 않는다(1000배 같은 잭팟 없음)', () => {
  for (const t of E.TICKETS) {
    for (let s = 1; s <= 3000; s++) {
      const c = makeCard(t, item(t, s * 7919));
      assert.ok(c.m <= t.maxMult, `${t.id} ${c.m}`);
    }
  }
});

test('공개 순서가 달라도 최종 금액은 같다(배수 칸 소급 포함)', () => {
  for (const t of E.TICKETS) {
    for (let s = 1; s <= 200; s++) {
      const it = item(t, s * 104729, { g: s % 7 === 0 });
      const c = makeCard(t, it);
      const full = cardAmount(t, c, null, it, 0.1).amount;
      // 무작위 순서로 하나씩 열며 차액을 더한다
      const order = c.cells.map((x) => x.i).sort(() => Math.sin(s * 99 + 1) - 0.5);
      const rv = new Set();
      let paid = 0;
      for (const i of order) {
        rv.add(i);
        const now = cardAmount(t, c, rv, it, 0.1).amount;
        paid += now - paid;
      }
      assert.equal(paid, full);
    }
  }
});

test('보장 당첨 판은 15~25배, 함정 없음', () => {
  for (const t of E.TICKETS) {
    for (let s = 1; s <= 5; s++) {
      const c = makeCard(t, item(t, s * 31, { f: 1 }));
      assert.ok(c.m >= E.FORCED_WIN.lo && c.m <= E.FORCED_WIN.hi, `${t.id} ${c.m}`);
      assert.ok(!c.cells.some((x) => x.sym.kind === 'trap'));
    }
  }
});

test('니어미스 판: 손해 판이면 보너스 그림을 2개로 채운다', () => {
  for (const t of E.TICKETS) {
    let checked = 0;
    for (let s = 1; s <= 400 && checked < 50; s++) {
      const c = makeCard(t, item(t, s * 977, { n: true }));
      if (c.m >= 1) continue;
      checked++;
      const cnt = c.cells.filter((x) => x.sym.id === t.match.sym).length;
      assert.ok(cnt >= t.match.need - 1, `${t.id} 개수 ${cnt}`);
    }
  }
});

test('황금 복권은 값 칸과 보너스만 2배, 함정은 그대로', () => {
  const t = E.TICKET_BY_ID.t4;
  const syms = [t.syms.find((x) => x.id === 'gold'), t.syms.find((x) => x.id === 'alarm')];
  const n = evaluate(t, syms, null, false);
  const g = evaluate(t, syms, null, true);
  assert.equal(n.m, 1 - 0.6);
  assert.equal(g.m, 2 - 0.6);
});

test('기대값 표: 기본 105~120%, 120% 이하, 행운을 올리면 오른다', () => {
  for (const t of E.TICKETS) {
    const r0 = CARD_STATS[t.id][0].rtp;
    assert.ok(Math.abs(r0 - t.rtp) < 0.02, `${t.id} ${r0} vs ${t.rtp}`);
    assert.ok(r0 <= 1.2 + 0.02);
    assert.ok(CARD_STATS[t.id][15].rtp > r0);
  }
});
