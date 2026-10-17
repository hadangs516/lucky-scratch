// 난수: 결과 추첨은 crypto, 판 모양은 시드 고정(새로고침해도 같은 판)
const buf = new Uint32Array(1);

export function rand() {
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

export function newSeed() {
  return Math.floor(rand() * 4294967296) >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(r, arr) {
  return arr[Math.floor(r() * arr.length)];
}

export function shuffle(r, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randInt(r, lo, hi) {
  return lo + Math.floor(r() * (hi - lo + 1));
}
