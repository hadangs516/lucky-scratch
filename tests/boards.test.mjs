// 판 생성기: 보이는 판이 확정 결과와 반드시 일치하는지 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import { TICKETS } from '../js/economy.js';
import { makeBoard, evaluate, revealState } from '../js/boards.js';

test('모든 복권·모든 등급에서 판이 결과와 일치한다', () => {
  for (const t of TICKETS) {
    const outcomes = [0, ...t.tiers.map(([m]) => m)];
    for (const m of outcomes) {
      for (let s = 1; s <= 400; s++) {
        const item = { m, g: false, n: false, s: s * 7919 };
        const b = makeBoard(t, item);
        assert.equal(evaluate(t, b), m, `${t.id} m=${m} seed=${s}`);
        if (m > 0) assert.ok(b.winCells.length >= 2, `${t.id} 당첨 칸 표시`);
      }
    }
  }
});

test('니어미스 강제 판은 꽝이면서 니어미스 모양이다', () => {
  for (const t of TICKETS) {
    for (let s = 1; s <= 300; s++) {
      const b = makeBoard(t, { m: 0, g: false, n: true, s: s * 104729 });
      assert.equal(evaluate(t, b), 0, `${t.id} seed=${s} 꽝이어야 함`);
      assert.equal(b.near, true, `${t.id} seed=${s} 니어미스여야 함`);
    }
  }
});

test('같은 시드면 같은 판', () => {
  const t = TICKETS[2];
  const a = makeBoard(t, { m: 5, g: false, n: false, s: 42 });
  const b = makeBoard(t, { m: 5, g: false, n: false, s: 42 });
  assert.deepEqual(a, b);
});

test('자연 니어미스 비율(참고 출력)', () => {
  const lines = [];
  for (const t of TICKETS) {
    let near = 0;
    const N = 4000;
    for (let s = 1; s <= N; s++) if (makeBoard(t, { m: 0, g: false, n: false, s: s * 31337 }).near) near++;
    lines.push(`${t.name} ${((near / N) * 100).toFixed(1)}%`);
  }
  console.log('자연 니어미스(꽝 판 중):', lines.join(', '));
});

test('긴장감: 모든 칸을 공개하면 당첨 판은 found, 꽝 판은 found 아님', () => {
  for (const t of TICKETS) {
    for (const m of [0, t.tiers[2][0]]) {
      const b = makeBoard(t, { m, g: false, n: false, s: 99 });
      const st = revealState(t, b, new Set(b.cells.map((c) => c.id)));
      assert.equal(st.found, m > 0, `${t.id} m=${m}`);
      assert.equal(st.heartbeat, false, '다 공개되면 심장박동 없음');
    }
  }
});
