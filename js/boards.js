// 복권 판 생성기.
// 결과(배수 m)는 구매 순간 이미 정해져 있고, 여기서는 그 결과와 맞는 판 모양만 만든다.
// 같은 시드면 항상 같은 판이 나오므로 새로고침해도 판이 바뀌지 않는다.
import { mulberry32, pick, shuffle, randInt } from './rng.js';

const tierMults = (ticket) => ticket.tiers.map(([m]) => m);

// 슬롯 그림(낮은 등급 → 높은 등급)
export const SLOT_SYMBOLS = {
  t3: ['cherry', 'lemon', 'bell', 'horseshoe', 'bar', 'seven'],
  t9: ['cherry', 'lemon', 'bell', 'bar', 'seven', 'crown'],
};
export const KEY_DECOYS = ['coin', 'star', 'clover', 'horseshoe', 'bell', 'heart'];
export const GEM_DECOYS = ['pearl', 'ring', 'coin', 'star'];
export const GEM_MULTS = [1, 2, 3, 5, 10];
// 보석 배수에서 기본 금액으로 쓸 수 있는 배수
const GEM_BASES = [1, 2, 3, 4, 5, 10];

const cell = (id, zone, props) => ({ id, zone, ...props });

// 낮은 등급일수록 자주 보이게(실제 즉석 복권처럼 큰 금액은 드물게 보인다)
function pickLow(r, mults) {
  const w = mults.map((_, i) => 1 / (i + 1) ** 1.1);
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < mults.length; i++) { x -= w[i]; if (x < 0) return mults[i]; }
  return mults[0];
}

export function makeBoard(ticket, item) {
  const r = mulberry32(item.s);
  const fn = BUILDERS[ticket.rule];
  const b = fn(ticket, item, r);
  b.rule = ticket.rule;
  b.m = item.m;
  b.near = item.m === 0 && detectNear(ticket, b);
  return b;
}

// 판 전체(디버그·테스트용): 이 판이 보여주는 당첨 배수를 규칙대로 다시 계산
export function evaluate(ticket, b) {
  return EVALUATORS[ticket.rule](ticket, b);
}

// ───────────────────────── 같은 금액 3개 ─────────────────────────
function buildMatch3(ticket, item, r) {
  const n = ticket.cells;
  const mults = tierMults(ticket);
  const top = mults.at(-1);
  let vals = [];
  if (item.m > 0) {
    vals = [item.m, item.m, item.m];
    fillMax2(r, vals, mults.filter((x) => x !== item.m), n);
  } else if (item.n) {
    vals = [top, top];
    fillMax2(r, vals, mults.filter((x) => x !== top), n);
  } else {
    fillMax2(r, vals, mults, n);
    // 자연 판에서 최고 금액 쌍은 드물게만 남긴다(칸이 많으면 너무 자주 생긴다)
    if (vals.filter((x) => x === top).length === 2 && r() > 0.3) {
      const i = vals.indexOf(top);
      vals.splice(i, 1);
      fillMax2(r, vals, mults.filter((x) => x !== top), n);
    }
  }
  vals = shuffle(r, vals);
  const cells = vals.map((m, i) => cell(i, 'grid', { kind: 'amount', m }));
  const winCells = item.m > 0 ? cells.filter((c) => c.m === item.m).map((c) => c.id) : [];
  return { cells, winCells, cols: 3 };
}
function fillMax2(r, vals, pool, n) {
  const count = new Map();
  for (const v of vals) count.set(v, (count.get(v) || 0) + 1);
  let guard = 0;
  while (vals.length < n && guard++ < 2000) {
    const v = pickLow(r, pool);
    if ((count.get(v) || 0) >= 2) continue;
    count.set(v, (count.get(v) || 0) + 1);
    vals.push(v);
  }
  if (vals.length < n) throw new Error('match3 판 생성 실패');
}

// ───────────────────────── 번호 맞추기 ─────────────────────────
function buildNumbers(ticket, item, r) {
  const W = ticket.win, M = ticket.mine;
  const maxN = W >= 3 ? 40 : 30;
  const mults = tierMults(ticket);
  const all = shuffle(r, Array.from({ length: maxN }, (_, i) => i + 1));
  const wins = all.slice(0, W);
  const rest = all.slice(W);
  const mine = [];
  for (let i = 0; i < M; i++) mine.push({ num: rest[i], m: pickLow(r, mults) });
  if (item.m > 0) {
    const k = randInt(r, 0, M - 1);
    mine[k] = { num: pick(r, wins), m: item.m };
  } else if (item.n) {
    // 최고 상금 칸의 번호가 행운 번호와 딱 1 차이
    const cands = [];
    for (const w of wins) for (const d of [-1, 1]) {
      const x = w + d;
      if (x >= 1 && x <= maxN && !wins.includes(x)) cands.push(x);
    }
    const near = pick(r, cands);
    const k = randInt(r, 0, M - 1);
    const dup = mine.findIndex((c, j) => j !== k && c.num === near);
    if (dup >= 0) mine[dup].num = mine[k].num; // 같은 번호가 다른 칸에 있으면 서로 바꾼다
    mine[k] = { num: near, m: mults.at(-1) };
  }
  const cells = [
    ...wins.map((num, i) => cell(i, 'wins', { kind: 'winnum', num })),
    ...mine.map((c, i) => cell(W + i, 'mine', { kind: 'mynum', num: c.num, m: c.m })),
  ];
  const winCells = [];
  if (item.m > 0) {
    const mc = cells.find((c) => c.kind === 'mynum' && wins.includes(c.num));
    winCells.push(mc.id, cells.find((c) => c.kind === 'winnum' && c.num === mc.num).id);
  }
  return { cells, winCells, wins, cols: M > 6 ? 4 : 3 };
}

// ───────────────────────── 슬롯 ─────────────────────────
function buildSlot(ticket, item, r) {
  const rows = ticket.rows;
  const syms = SLOT_SYMBOLS[ticket.id];
  const mults = tierMults(ticket);
  const symOf = (m) => syms[mults.indexOf(m)];
  const top = syms.at(-1);
  const grid = [];
  for (let i = 0; i < rows; i++) grid.push(randomNonTriple(r, syms));
  let winRow = -1;
  if (item.m > 0) {
    winRow = randInt(r, 0, rows - 1);
    const s = symOf(item.m);
    grid[winRow] = [s, s, s];
  } else if (item.n) {
    const k = randInt(r, 0, rows - 1);
    grid[k] = [top, top, pick(r, syms.filter((x) => x !== top))];
  }
  const cells = [];
  grid.forEach((row, ri) => row.forEach((sym, ci) => cells.push(cell(ri * 3 + ci, 'reel', { kind: 'symbol', sym, row: ri, col: ci }))));
  const winCells = winRow >= 0 ? [0, 1, 2].map((c) => winRow * 3 + c) : [];
  return { cells, winCells, cols: 3, rows, paytable: syms.map((s, i) => ({ sym: s, m: mults[i] })) };
}
function randomNonTriple(r, syms) {
  for (;;) {
    const row = [pick(r, syms), pick(r, syms), pick(r, syms)];
    if (!(row[0] === row[1] && row[1] === row[2])) return row;
  }
}

// ───────────────────────── 열쇠와 금고 ─────────────────────────
function buildKeys(ticket, item, r) {
  const n = ticket.cells;
  const mults = tierMults(ticket);
  let keys;
  let vaultM;
  if (item.m > 0) {
    keys = 3;
    vaultM = item.m;
  } else if (item.n) {
    keys = 2;
    vaultM = mults.at(-1);
  } else {
    const x = r();
    keys = x < 0.35 ? 0 : x < 0.75 ? 1 : 2;
    vaultM = pick(r, mults);
  }
  const syms = [];
  for (let i = 0; i < keys; i++) syms.push('key');
  while (syms.length < n) syms.push(pick(r, KEY_DECOYS));
  const order = shuffle(r, syms);
  const cells = order.map((sym, i) => cell(i, 'grid', { kind: 'keysym', sym }));
  cells.push(cell(n, 'vault', { kind: 'vault', m: vaultM }));
  const winCells = item.m > 0 ? [...cells.filter((c) => c.sym === 'key').map((c) => c.id), n] : [];
  return { cells, winCells, cols: n > 9 ? 4 : 3 };
}

// ───────────────────────── 숫자 대결 ─────────────────────────
function buildBeat(ticket, item, r) {
  const M = ticket.mine;
  const mults = tierMults(ticket);
  const opp = randInt(r, 9, 16);
  const rows = [];
  for (let i = 0; i < M; i++) {
    let num = randInt(r, 1, opp);
    // 자연적인 동점은 가끔만(동점 = 꽝)
    if (num === opp && r() < 0.6) num = randInt(r, 1, opp - 1);
    rows.push({ num, m: pickLow(r, mults) });
  }
  if (item.m > 0) {
    const k = randInt(r, 0, M - 1);
    rows[k] = { num: randInt(r, opp + 1, 20), m: item.m };
  } else if (item.n) {
    const k = randInt(r, 0, M - 1);
    rows[k] = { num: opp, m: mults.at(-1) };
  }
  const cells = [cell(0, 'opp', { kind: 'opp', num: opp }), ...rows.map((x, i) => cell(i + 1, 'rows', { kind: 'beatrow', num: x.num, m: x.m }))];
  const winCells = item.m > 0 ? [0, cells.find((c) => c.kind === 'beatrow' && c.num > opp).id] : [];
  return { cells, winCells, opp, cols: 2 };
}

// ───────────────────────── 보석 × 배수 ─────────────────────────
function buildGem(ticket, item, r) {
  const n = ticket.cells;
  const mults = tierMults(ticket);
  let mult;
  let gemAt = -1;
  let base = 0;
  if (item.m > 0) {
    const opts = [];
    for (const k of GEM_MULTS) for (const b of GEM_BASES) if (b * k === item.m) opts.push([b, k]);
    [base, mult] = pick(r, opts);
    gemAt = randInt(r, 0, n - 1);
  } else if (item.n) {
    mult = 10;
  } else {
    const x = r();
    mult = x < 0.35 ? 1 : x < 0.65 ? 2 : x < 0.8 ? 3 : x < 0.92 ? 5 : 10;
  }
  const cells = [];
  for (let i = 0; i < n; i++) {
    if (i === gemAt) cells.push(cell(i, 'grid', { kind: 'gemcell', sym: 'gem', m: base }));
    else cells.push(cell(i, 'grid', { kind: 'gemcell', sym: pick(r, GEM_DECOYS), m: pick(r, GEM_BASES.filter((b) => mults.includes(b) || b <= 5)) }));
  }
  cells.push(cell(n, 'mult', { kind: 'mult', k: mult }));
  const winCells = item.m > 0 ? [gemAt, n] : [];
  return { cells, winCells, cols: 3 };
}

const BUILDERS = { match3: buildMatch3, numbers: buildNumbers, slot: buildSlot, keys: buildKeys, beat: buildBeat, gem: buildGem };

// ───────────────────────── 규칙대로 다시 계산(검증용) ─────────────────────────
const EVALUATORS = {
  match3(t, b) {
    const count = new Map();
    for (const c of b.cells) count.set(c.m, (count.get(c.m) || 0) + 1);
    let best = 0;
    for (const [m, k] of count) if (k >= 3) best = Math.max(best, m);
    return best;
  },
  numbers(t, b) {
    const wins = b.cells.filter((c) => c.kind === 'winnum').map((c) => c.num);
    return b.cells.filter((c) => c.kind === 'mynum' && wins.includes(c.num)).reduce((s, c) => s + c.m, 0);
  },
  slot(t, b) {
    let s = 0;
    for (let row = 0; row < b.rows; row++) {
      const rc = b.cells.filter((c) => c.row === row);
      if (rc[0].sym === rc[1].sym && rc[1].sym === rc[2].sym) s += b.paytable.find((p) => p.sym === rc[0].sym).m;
    }
    return s;
  },
  keys(t, b) {
    const keys = b.cells.filter((c) => c.sym === 'key').length;
    return keys >= 3 ? b.cells.find((c) => c.kind === 'vault').m : 0;
  },
  beat(t, b) {
    return b.cells.filter((c) => c.kind === 'beatrow' && c.num > b.opp).reduce((s, c) => s + c.m, 0);
  },
  gem(t, b) {
    const k = b.cells.find((c) => c.kind === 'mult').k;
    return b.cells.filter((c) => c.sym === 'gem').reduce((s, c) => s + c.m * k, 0);
  },
};

// ───────────────────────── 니어미스 판별 ─────────────────────────
function detectNear(ticket, b) {
  const top = tierMults(ticket).at(-1);
  switch (ticket.rule) {
    case 'match3': return b.cells.filter((c) => c.m === top).length === 2;
    case 'numbers': {
      const wins = b.cells.filter((c) => c.kind === 'winnum').map((c) => c.num);
      return b.cells.some((c) => c.kind === 'mynum' && c.m === top && wins.some((w) => Math.abs(w - c.num) === 1));
    }
    case 'slot': {
      const topSym = b.paytable.at(-1).sym;
      for (let row = 0; row < b.rows; row++) {
        const rc = b.cells.filter((c) => c.row === row);
        if (rc[0].sym === topSym && rc[1].sym === topSym) return true;
      }
      return false;
    }
    case 'keys': return b.cells.filter((c) => c.sym === 'key').length === 2 && b.cells.find((c) => c.kind === 'vault').m >= tierMults(ticket).at(-2);
    case 'beat': return b.cells.some((c) => c.kind === 'beatrow' && c.num === b.opp && c.m === top);
    case 'gem': return b.cells.find((c) => c.kind === 'mult').k === 10;
    default: return false;
  }
}

export const NEAR_TEXT = {
  match3: '큰 금액이 2개뿐… 아깝다!',
  numbers: '번호가 딱 1 차이… 아깝다!',
  slot: '마지막 한 칸이… 아깝다!',
  keys: '열쇠 하나만 더 있었으면…',
  beat: '동점은 꽝… 아깝다!',
  gem: '×10인데 보석이 없다니…',
};
export const WIN_TEXT = {
  match3: '같은 금액 3개!',
  numbers: '번호 일치!',
  slot: '한 줄 완성!',
  keys: '열쇠 3개로 금고 열기!',
  beat: '숫자 대결 승리!',
  gem: '보석 × 배수!',
};

// ───────────────────────── 긁는 도중의 긴장감 ─────────────────────────
// revealed: 공개된 칸 id 집합. 반환: 빛낼 칸, 심장박동 여부, 당첨 확인 여부
export function revealState(ticket, b, revealed) {
  const has = (id) => revealed.has(id);
  const hidden = b.cells.some((c) => !has(c.id));
  const mults = tierMults(ticket);
  const bigM = mults[Math.max(0, mults.length - 3)]; // 위에서 3번째 등급 이상이면 심장박동
  const out = { glow: [], heartbeat: false, found: false };
  switch (ticket.rule) {
    case 'match3': {
      const by = new Map();
      for (const c of b.cells) if (has(c.id)) (by.get(c.m) || by.set(c.m, []).get(c.m)).push(c.id);
      for (const [m, ids] of by) {
        if (ids.length >= 3) { out.found = true; out.glow.push(...ids); } else if (ids.length === 2 && hidden) {
          out.glow.push(...ids);
          if (m >= bigM) out.heartbeat = true;
        }
      }
      break;
    }
    case 'numbers': {
      const wins = b.cells.filter((c) => c.kind === 'winnum' && has(c.id));
      for (const c of b.cells) {
        if (c.kind !== 'mynum' || !has(c.id)) continue;
        const w = wins.find((x) => x.num === c.num);
        if (w) { out.found = true; out.glow.push(c.id, w.id); }
      }
      break;
    }
    case 'slot': {
      for (let row = 0; row < b.rows; row++) {
        const rc = b.cells.filter((c) => c.row === row);
        const rv = rc.filter((c) => has(c.id));
        if (rv.length === 3 && rc[0].sym === rc[1].sym && rc[1].sym === rc[2].sym) { out.found = true; out.glow.push(...rc.map((c) => c.id)); } else if (rv.length === 2 && rv[0].sym === rv[1].sym) {
          out.glow.push(...rv.map((c) => c.id));
          const m = b.paytable.find((p) => p.sym === rv[0].sym).m;
          if (m >= bigM) out.heartbeat = true;
        }
      }
      break;
    }
    case 'keys': {
      const ks = b.cells.filter((c) => c.sym === 'key' && has(c.id)).map((c) => c.id);
      const vault = b.cells.find((c) => c.kind === 'vault');
      if (ks.length >= 3) { out.found = true; out.glow.push(...ks, vault.id); } else if (ks.length === 2 && b.cells.some((c) => c.kind === 'keysym' && !has(c.id))) {
        out.glow.push(...ks);
        out.heartbeat = true;
      }
      break;
    }
    case 'beat': {
      const opp = b.cells[0];
      if (!has(opp.id)) break;
      for (const c of b.cells) if (c.kind === 'beatrow' && has(c.id) && c.num > opp.num) { out.found = true; out.glow.push(c.id, opp.id); }
      break;
    }
    case 'gem': {
      const gem = b.cells.find((c) => c.sym === 'gem' && has(c.id));
      const mult = b.cells.find((c) => c.kind === 'mult');
      if (gem && has(mult.id)) { out.found = true; out.glow.push(gem.id, mult.id); } else if (gem) {
        out.glow.push(gem.id, mult.id);
        out.heartbeat = true;
      }
      break;
    }
  }
  out.glow = [...new Set(out.glow)];
  return out;
}
