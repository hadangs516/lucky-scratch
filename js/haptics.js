// 진동: 안드로이드 크롬 등에서만 동작(아이폰 사파리는 웹 진동을 지원하지 않는다).
// 과하지 않게: 최소 간격을 두고, 2초 안에 너무 많이 울리면 덜 중요한 진동은 건너뛴다.
let enabled = true;
let last = 0;
const recent = [];

export function setVibration(on) {
  enabled = on;
}

export const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function vib(pattern, { gap = 60, important = false } = {}) {
  if (!enabled || !supported) return;
  const t = performance.now();
  if (!important && t - last < gap) return;
  while (recent.length && t - recent[0] > 2000) recent.shift();
  if (!important && recent.length >= 6) return;
  last = t;
  recent.push(t);
  try {
    navigator.vibrate(pattern);
  } catch {
    // 무시
  }
}

export const haptic = {
  scratch: () => vib(4, { gap: 140 }),
  cell: () => vib(10, { gap: 90 }),
  tension: () => vib([22, 70, 22], { gap: 500 }),
  combo: () => vib(14, { gap: 300 }),
  buy: () => vib(8, { gap: 150 }),
  small: () => vib(18, { important: true }),
  mid: () => vib([35, 45, 35], { important: true }),
  big: () => vib([70, 50, 100, 50, 180], { important: true }),
  mega: () => vib([90, 40, 90, 40, 90, 40, 280], { important: true }),
  unlock: () => vib([20, 40, 40], { important: true }),
};
