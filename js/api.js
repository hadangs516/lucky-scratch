// 저장 서버 통신. Apps Script는 CORS 사전 요청을 못 받으므로 text/plain 단순 요청으로 보낸다.
import { apiUrl } from './config.js';

export class NetError extends Error {
  constructor(msg) {
    super(msg);
    this.net = true;
  }
}

export async function call(payload, { timeout = 20000 } = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  let res;
  try {
    res = await fetch(apiUrl(), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      cache: 'no-store',
      signal: ctrl?.signal,
    });
  } catch (e) {
    throw new NetError(e?.name === 'AbortError' ? '서버 응답이 너무 늦어요' : '인터넷 연결을 확인해 주세요');
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) throw new NetError(`서버 응답 오류(${res.status})`);
  try {
    return await res.json();
  } catch {
    throw new NetError('서버 응답을 읽지 못했어요');
  }
}

export const signup = (id, pw) => call({ a: 'signup', id, pw });
export const login = (id, pw) => call({ a: 'login', id, pw });
export const saveRemote = (id, sid, data, meta) => call({ a: 'save', id, sid, data, meta });

// 페이지를 떠날 때 마지막 저장(응답은 못 받는다)
export function beacon(id, sid, data, meta) {
  try {
    if (!navigator.sendBeacon) return false;
    const blob = new Blob([JSON.stringify({ a: 'save', id, sid, data, meta })], { type: 'text/plain;charset=UTF-8' });
    return navigator.sendBeacon(apiUrl(), blob);
  } catch {
    return false;
  }
}
