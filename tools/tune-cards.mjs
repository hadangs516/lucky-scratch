// 칸 복권 조율 도구
// 1) 복권마다 꽝 칸 가중치(w0)를 이분 탐색해서 "전부 열었을 때 기대값"을 목표(rtp)에 맞춘다.
// 2) 행운 레벨별 통계(기대값, 뭐라도 받을 확률, 본전 이상, 대박, 함정 손해)를 js/cardStats.js로 만든다.
// 사용법: node tools/tune-cards.mjs          (w0 값만 출력)
//         node tools/tune-cards.mjs --write  (economy.js의 w0를 고치고 cardStats.js 생성)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../js/economy.js';
import { makeCard } from '../js/cards.js';
import { mulberry32 } from '../js/rng.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const N = 30000;

function sample(t, luck, n = N, seed0 = 7) {
  const r = mulberry32(seed0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const item = { t: t.id, s: Math.floor(r() * 4294967296), l: luck, g: r() < E.GOLDEN.baseChance, n: r() < E.NEAR_MISS_EXTRA, k: 0 };
    out.push(makeCard(t, item));
  }
  return out;
}
const mean = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;

const results = {};
for (const t of E.TICKETS) {
  let lo = 0, hi = 3000;
  t.w0 = 0;
  const top = mean(sample(t, 0, 8000), (c) => c.m);
  if (top < t.rtp) {
    console.log(`경고 ${t.id}: 꽝이 하나도 없어도 기대값 ${top.toFixed(3)} < 목표 ${t.rtp}`);
    results[t.id] = 0;
    continue;
  }
  for (let it = 0; it < 22; it++) {
    t.w0 = (lo + hi) / 2;
    const m = mean(sample(t, 0, 30000), (c) => c.m);
    if (m > t.rtp) lo = t.w0; else hi = t.w0;
  }
  t.w0 = Math.round(((lo + hi) / 2) * 100) / 100;
  results[t.id] = t.w0;
}

const stats = {};
for (const t of E.TICKETS) {
  stats[t.id] = [];
  for (let L = 0; L <= 15; L++) {
    const cs = sample(t, L, 30000, L === 0 ? 7 : 99 + L);
    stats[t.id].push({
      rtp: +mean(cs, (c) => c.m).toFixed(4),
      any: +mean(cs, (c) => (c.m > 0 ? 1 : 0)).toFixed(4),
      even: +mean(cs, (c) => (c.m >= 1 ? 1 : 0)).toFixed(4),
      big: +mean(cs, (c) => (c.m >= 15 ? 1 : 0)).toFixed(5),
      trap: +mean(cs, (c) => (c.m < 0 ? 1 : 0)).toFixed(4),
      clover: +mean(cs, (c) => c.clovers).toFixed(5),
      sd: +Math.sqrt(mean(cs, (c) => c.m * c.m) - mean(cs, (c) => c.m) ** 2).toFixed(3),
    });
  }
  const s0 = stats[t.id][0], s15 = stats[t.id][15];
  console.log(`${t.id} ${t.name} w0=${results[t.id]} | L0 rtp ${s0.rtp} any ${s0.any} even ${s0.even} big ${s0.big} trap ${s0.trap} sd ${s0.sd} | L15 rtp ${s15.rtp} even ${s15.even}`);
}

if (WRITE) {
  const p = path.join(ROOT, 'js/economy.js');
  let src = fs.readFileSync(p, 'utf8');
  for (const t of E.TICKETS) {
    src = src.replace(new RegExp(`(id: '${t.id}',[\\s\\S]*?w0: )[\\d.]+`), `$1${results[t.id]}`);
  }
  fs.writeFileSync(p, src);
  const out = `// tools/tune-cards.mjs가 만든 파일(직접 고치지 말 것). 행운 레벨 0~15별 몬테카를로 통계.
// rtp: 전부 열었을 때 기대값(가격 대비, 황금 포함, 보너스 제외), any: 뭐라도 받을 확률, even: 본전 이상,
// big: 15배 이상, trap: 산 값보다 더 잃을 확률, clover: 장당 황금 클로버 기대 개수, sd: 표준편차
export const CARD_STATS = ${JSON.stringify(stats)};
`;
  fs.writeFileSync(path.join(ROOT, 'js/cardStats.js'), out);
  console.log('economy.js w0 갱신, js/cardStats.js 생성');
}
