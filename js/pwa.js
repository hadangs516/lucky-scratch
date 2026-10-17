// 앱 설치(PWA)
let deferred = null;
const listeners = new Set();

if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    for (const f of listeners) f();
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    for (const f of listeners) f();
  });
}

export function onInstallChange(f) {
  listeners.add(f);
}
export function canPrompt() {
  return !!deferred;
}
export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
export const isInApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua);

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null;
  e.prompt();
  try {
    const r = await e.userChoice;
    return r.outcome;
  } catch {
    return 'dismissed';
  }
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const ok = location.protocol === 'https:' || location.hostname === 'localhost';
  if (!ok) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
