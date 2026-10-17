// 복권 한 장의 칸 구성과 정산.
// 구매 순간 정한 시드(s)와 그때의 행운 레벨(l)로 칸 그림이 모두 정해진다(결과 확정).
// 같은 시드면 언제 열어도 같은 칸이 나온다. DOM에 의존하지 않는다(시뮬레이터·테스트 공용).
import * as E from './economy.js';
import { mulberry32 } from './rng.js';

// item: { t, s, l, g, n, f, k }
//   s 시드, l 구매 때 행운 레벨, g 황금 복권, n 니어미스 판, f 보장 당첨 판, k 판돈 단계
export function makeCard(ticket, item) {
  const r = mulberry32(item.s >>> 0);
  const ws = E.cellWeights(ticket, item.l || 0);
  const W = ws.reduce((a, b) => a + b.w, 0);
  const pick = () => {
    let x = r() * W;
    for (const e of ws) {
      x -= e.w;
      if (x < 0) return e.sym;
    }
    return ws[0].sym;
  };
  const forced = !!item.f;
  const tries = forced ? 60000 : 400;
  let syms = null;
  let ev = null;
  for (let a = 0; a < tries; a++) {
    const cand = Array.from({ length: ticket.cells }, pick);
    if (item.n) nearInject(ticket, cand, r);
    const e = evaluate(ticket, cand, null, false);
    if (forced) {
      if (e.m >= E.FORCED_WIN.lo && e.m <= E.FORCED_WIN.hi && e.traps === 0) { syms = cand; ev = e; break; }
      continue;
    }
    if (e.m <= ticket.maxMult) { syms = cand; ev = e; break; }
  }
  if (!syms) {
    // 거의 일어나지 않지만 안전장치: 보장 판은 보너스 그림 3개 + ×2로, 나머지는 꽝으로 만든다
    syms = Array.from({ length: ticket.cells }, () => ws[0].sym);
    if (forced && ticket.match) {
      const m = ticket.syms.find((s) => s.id === ticket.match.sym);
      for (let i = 0; i < ticket.match.need; i++) syms[i] = m;
      const x2 = ticket.syms.find((s) => s.kind === 'mult');
      if (x2 && evaluate(ticket, syms, null, false).m < E.FORCED_WIN.lo) syms[ticket.match.need] = x2;
    }
    ev = evaluate(ticket, syms, null, false);
  }
  const golden = !!item.g;
  const full = evaluate(ticket, syms, null, golden);
  return {
    cells: syms.map((sym, i) => ({ i, sym })),
    m: full.m, // 전부 열었을 때의 배수(황금 포함, 행운 보너스 제외)
    near: isNear(ticket, syms, full),
    clovers: full.clovers,
    traps: full.traps,
  };
}

// 손해 판이면 보너스 그림을 정확히 2개로 맞춘다(아깝다!)
function nearInject(ticket, syms, r) {
  if (!ticket.match) return;
  const e = evaluate(ticket, syms, null, false);
  if (e.m >= 1) return;
  const ms = ticket.syms.find((s) => s.id === ticket.match.sym);
  let count = syms.filter((s) => s.id === ms.id).length;
  if (count >= ticket.match.need - 1) return;
  const spots = syms.map((s, i) => i).filter((i) => syms[i].kind === 'blank' || syms[i].kind === 'val' && syms[i].id !== ms.id);
  while (count < ticket.match.need - 1 && spots.length) {
    const j = spots.splice(Math.floor(r() * spots.length), 1)[0];
    syms[j] = ms;
    count++;
  }
}

function isNear(ticket, syms, full) {
  if (!ticket.match) return false;
  const c = syms.filter((s) => s.id === ticket.match.sym).length;
  return c === ticket.match.need - 1 && full.m < 1;
}

// revealed: 공개된 칸 번호 집합(null이면 전부). 반환 배수는 가격 대비.
export function evaluate(ticket, syms, revealed, golden) {
  let pos = 0, multK = 1, traps = 0, clovers = 0, matchCount = 0;
  for (let i = 0; i < syms.length; i++) {
    if (revealed && !revealed.has(i)) continue;
    const s = syms[i];
    if (s.kind === 'val') {
      pos += s.v;
      if (ticket.match && s.id === ticket.match.sym) matchCount++;
    } else if (s.kind === 'mult') multK *= s.k;
    else if (s.kind === 'trap') traps += s.v;
    else if (s.kind === 'clover') clovers++;
  }
  const bonus = ticket.match && matchCount >= ticket.match.need ? ticket.match.bonus : 0;
  const g = golden ? E.GOLDEN.prizeMult : 1;
  const gain = (pos + bonus) * multK * g;
  return { m: round4(gain - traps), gain, pos, bonus, multK, traps, clovers, matchCount };
}

// 공개된 칸까지의 실제 금액(원). 보너스(prizeBonus)는 얻는 쪽에만 붙는다.
export function cardAmount(ticket, card, revealed, item, prizeBonus = 0) {
  const syms = card.cells.map((c) => c.sym);
  const e = evaluate(ticket, syms, revealed, !!item.g);
  const price = E.ticketPrice(ticket, item.k || 0);
  return {
    amount: Math.round(price * (e.gain * (1 + prizeBonus) - e.traps)),
    m: e.m,
    clovers: e.clovers,
    ev: e,
  };
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}
