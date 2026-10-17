// 금액·숫자 표기
const UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극', '항하사', '아승기', '나유타', '불가사의', '무량대수'];

export function comma(n) {
  return Math.floor(n).toLocaleString('ko-KR');
}

function unitExp(n) {
  let e = Math.floor(Math.log10(n) / 4);
  if (Math.floor(n / 10 ** (4 * e)) >= 10000) e++;
  if (Math.floor(n / 10 ** (4 * e)) < 1) e--;
  return e;
}

// 1234567890 → "12억 3,456만원" (큰 단위 2개까지)
export function won(value) {
  const n = Math.floor(Math.max(0, Number(value) || 0));
  if (n < 10000) return comma(n) + '원';
  const e = unitExp(n);
  if (e >= UNITS.length) return n.toExponential(2) + '원';
  const big = Math.floor(n / 10 ** (4 * e));
  const rest = Math.floor((n - big * 10 ** (4 * e)) / 10 ** (4 * (e - 1)));
  return comma(big) + UNITS[e] + (rest > 0 ? ' ' + comma(rest) + UNITS[e - 1] : '') + '원';
}

// 좁은 칸용: 1,000 / 1.5만 / 25만 / 3억 / 1.2조 (원 없이)
export function short(value) {
  const n = Math.floor(Math.max(0, Number(value) || 0));
  if (n < 10000) return comma(n);
  const e = unitExp(n);
  if (e >= UNITS.length) return n.toExponential(1);
  const v = n / 10 ** (4 * e);
  const s = v < 10 && v % 1 !== 0 ? (Math.floor(v * 10) / 10).toString() : comma(v);
  return s + UNITS[e];
}

export function shortWon(value) {
  return short(value) + '원';
}

export function pct(x, digits = 1) {
  return (x * 100).toFixed(digits).replace(/\.0+$/, '') + '%';
}

// 확률 → "약 N장에 1번"
export function oneIn(p) {
  if (p <= 0) return '-';
  const n = 1 / p;
  if (n < 10) return `약 ${n.toFixed(1).replace(/\.0$/, '')}장에 1번`;
  return `약 ${comma(Math.round(n))}장에 1번`;
}
