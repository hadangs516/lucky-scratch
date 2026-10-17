// 복권별 확률표·기대값·분산 보고서(기획서용 마크다운 출력)
// 사용법: node tools/ev-report.mjs
import * as E from '../js/economy.js';

const won = (n) => n.toLocaleString('ko-KR') + '원';
const lines = [];
lines.push('| 복권 | 가격 | 해금 비용 | 해금 조건 | 규칙 | 당첨률(행운 0/15) | 기대값 행운 0 | 행운 5 | 행운 10 | 행운 15 | 분산 σ² | 최고 배수 |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const t of E.TICKETS) {
  const h0 = E.effectiveTiers(t, 0).reduce((s, [, w]) => s + w, 0) / E.WEIGHT_TOTAL;
  const h15 = E.effectiveTiers(t, 15).reduce((s, [, w]) => s + w, 0) / E.WEIGHT_TOTAL;
  const r = (lv) => (E.effectiveRtp(t, lv, 0, 0) * 100).toFixed(1) + '%';
  const rt = E.tableRtp(t);
  const m2 = t.tiers.reduce((s, [m, w]) => s + m * m * w, 0) / E.WEIGHT_TOTAL;
  lines.push(`| ${t.name} | ${won(t.price)} | ${t.unlockCost ? won(t.unlockCost) : '-'} | ${t.stageReq ? `환생 ${t.stageReq}회` : '-'} | ${t.blurb} | ${(h0 * 100).toFixed(1)}% / ${(h15 * 100).toFixed(1)}% | ${r(0)} | ${r(5)} | ${r(10)} | ${r(15)} | ${(m2 - rt * rt).toFixed(1)} | ${Math.max(...t.tiers.map(([m]) => m))}배 |`);
}
lines.push('');
lines.push('기대값에는 황금 복권(기본 2%, 당첨금 2배)이 포함되어 있다. 행운 16레벨부터는 레벨마다 당첨금 +3%가 추가된다.');
lines.push('');
for (const t of E.TICKETS) {
  lines.push(`#### ${t.name} (${won(t.price)}) 등급표`);
  lines.push('');
  lines.push('| 등급 | 배수 | 당첨금 | 확률(행운 0) | 약 N장에 1번 |');
  lines.push('|---|---|---|---|---|');
  for (const [m, w] of t.tiers) {
    lines.push(`| ${E.TIER_LABEL[E.tierClass(m)]} | ${m}배 | ${won(t.price * m)} | ${(w / 1e4).toFixed(3)}% | ${Math.round(E.WEIGHT_TOTAL / w).toLocaleString('ko-KR')} |`);
  }
  const lose = E.WEIGHT_TOTAL - t.tiers.reduce((s, [, w]) => s + w, 0);
  lines.push(`| 꽝 | 0 | 0원 | ${(lose / 1e4).toFixed(3)}% | - |`);
  lines.push('');
}
console.log(lines.join('\n'));
