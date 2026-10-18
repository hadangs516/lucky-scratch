// 칸 복권 확률·기대값 보고서(기획서용 마크다운)
// 사용법: node tools/ev-report.mjs
import * as E from '../js/economy.js';
import { CARD_STATS } from '../js/cardStats.js';

const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
const one = (p) => (p > 0 ? `약 ${Math.round(1 / p).toLocaleString('ko-KR')}장에 1번` : '-');
const L = [];
L.push('| 복권 | 가격 | 해금 | 칸 | 기대값 Lv0 / 5 / 10 / 15 | 뭐라도 받음 | 본전 이상 | 15배 이상 | 함정 손해 | 표준편차 | 최고 |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|');
for (const t of E.TICKETS) {
  const s = CARD_STATS[t.id];
  L.push(`| ${t.name} | ${won(t.price)} | ${t.unlockCost ? won(t.unlockCost) : '-'}${t.stageReq ? ` (환생 ${t.stageReq}회)` : ''} | ${t.cells} | ${[0, 5, 10, 15].map((l) => pct(s[l].rtp)).join(' / ')} | ${pct(s[0].any, 0)} | ${pct(s[0].even, 0)} | ${one(s[0].big)} | ${s[0].trap ? pct(s[0].trap, 0) : '-'} | ${s[0].sd} | ${t.maxMult}배 |`);
}
L.push('');
L.push('기대값은 모든 칸을 열었을 때 기준이다(황금 복권 2% 포함, 행운 16레벨 이후의 당첨금 보너스는 제외). 함정 복권은 중간에 버리면 이보다 높아질 수 있다.');
L.push('');
const kindName = { blank: '꽝', val: '돈', mult: '배수', trap: '함정', clover: '황금 클로버' };
for (const t of E.TICKETS) {
  const ws = E.cellWeights(t, 0);
  const W = ws.reduce((a, b) => a + b.w, 0);
  L.push(`#### ${t.name} (${won(t.price)}, 칸 ${t.cells}개)`);
  L.push('');
  L.push(t.blurb);
  L.push('');
  L.push('| 그림 | 종류 | 금액·효과 | 칸당 확률(행운 0) |');
  L.push('|---|---|---|---|');
  for (const { sym, w } of ws) {
    const eff = sym.kind === 'val' ? won(t.price * sym.v) : sym.kind === 'mult' ? `전체 ×${sym.k}` : sym.kind === 'trap' ? `−${won(t.price * sym.v)}` : sym.kind === 'clover' ? '+1개' : '0원';
    L.push(`| ${sym.id === 'blank' ? '빈칸' : sym.id} | ${kindName[sym.kind]}${t.match && sym.id === t.match.sym ? '(보너스 그림)' : ''} | ${eff} | ${pct(w / W, 2)} |`);
  }
  if (t.match) L.push(`\n보너스: ${t.match.sym} ${t.match.need}개 → +${won(t.price * t.match.bonus)}`);
  L.push('');
}
console.log(L.join('\n'));
