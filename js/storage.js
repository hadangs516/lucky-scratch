// localStorage 래퍼: 사생활 보호 모드 등에서 실패해도 게임이 멈추지 않게 한다.
const PREFIX = 'luckyScratch.';

export function load(key, fallback = null) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // 무시
  }
}

export const keys = {
  auth: 'auth', // { id, pw } 자동 로그인
  settings: 'settings',
  save: (id) => 'save.' + id, // { data, at, dirty }
};
