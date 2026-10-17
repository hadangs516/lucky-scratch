// 기기별 설정(소리·진동 등은 기기마다 다르게 쓰므로 서버가 아니라 이 브라우저에 저장)
import * as store from './storage.js';

const reducedDefault = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const settings = {
  sound: true,
  bgm: false,
  vib: true,
  reduced: reducedDefault,
  ...store.load(store.keys.settings, {}),
};

export function setSetting(key, value) {
  settings[key] = value;
  store.save(store.keys.settings, settings);
}
