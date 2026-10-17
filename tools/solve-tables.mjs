// 복권 등급별 확률 산출 도구: p_i ∝ m_i^(-α) 형태(멱법칙)로
// 목표 당첨률(H)과 목표 기대값(R, 황금 복권 포함)을 동시에 맞추는 α를 찾는다.
// 결과는 1,000,000 분율 정수 가중치로 반올림해 js/economy.js에 그대로 옮긴다.
// 사용법: node tools/solve-tables.mjs
const GOLDEN = 1.02; // 황금 복권(2%, 당첨금 2배)이 기대값에 더하는 배율
export const SPECS = [
  ['t1', [1, 2, 3, 5, 10, 20], 0.48, 1.05],
  ['t2', [1, 2, 3, 5, 10, 20], 0.47, 1.08],
  ['t3', [1, 2, 3, 5, 10, 25], 0.46, 1.11],
  ['t4', [1, 2, 4, 10, 20, 30], 0.45, 1.14],
  ['t5', [1, 2, 5, 10, 20, 30], 0.45, 1.17],
  ['t6', [1, 2, 3, 5, 10, 20, 50], 0.44, 1.20],
  ['t7', [1, 2, 4, 10, 20, 50], 0.45, 1.20],
  ['t8', [1, 2, 5, 10, 25, 50], 0.44, 1.20],
  ['t9', [1, 2, 5, 15, 30, 50], 0.44, 1.20],
  ['t10', [1, 2, 4, 10, 30, 50], 0.44, 1.20],
  ['t11', [1, 2, 5, 10, 25, 50], 0.45, 1.20],
];
for (const [id, ms, H, Rtot] of SPECS) {
  const R = Rtot / GOLDEN;
  const ratio = (a) => ms.reduce((s, m) => s + m ** (1 - a), 0) / ms.reduce((s, m) => s + m ** -a, 0);
  let lo = 0, hi = 8;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (ratio(mid) > R / H) lo = mid; else hi = mid; }
  const a = (lo + hi) / 2;
  const c = H / ms.reduce((s, m) => s + m ** -a, 0);
  const w = ms.map((m) => Math.round(c * m ** -a * 1e6));
  const hit = w.reduce((s, x) => s + x, 0) / 1e6;
  const rtp = w.reduce((s, x, i) => s + x * ms[i], 0) / 1e6;
  const m2 = w.reduce((s, x, i) => s + x * ms[i] ** 2, 0) / 1e6;
  const varr = m2 - rtp * rtp;
  console.log(`${id} α=${a.toFixed(2)} tiers: [${ms.map((m, i) => `[${m}, ${w[i]}]`).join(', ')}] hit ${hit.toFixed(3)} rtp ${(rtp * GOLDEN).toFixed(4)} σ²=${varr.toFixed(2)} kelly@+0%=${((rtp * GOLDEN - 1) / varr * 100).toFixed(1)}% kelly@+30%luck=${((rtp * GOLDEN * 1.3 - 1) / (varr * 1.69) * 100).toFixed(1)}%`);
}
