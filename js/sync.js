// 저장 관리: 브라우저 저장(5초), 서버 자동저장(1분), 오프라인 대기, 다른 기기 접속 감지.
import * as api from './api.js';
import * as store from './storage.js';
import { AUTOSAVE_SEC, LOCAL_SAVE_SEC } from './config.js';

export const MSG = {
  auto: '자동저장 완료',
  manual: '저장 완료',
  back: '다시 연결됐어요. 저장 완료',
  offline: '오프라인 상태라 저장하지 않고 있어요. 온라인이 되면 바로 저장돼요.',
};

export class Sync {
  // hooks: { toast(msg, kind), sessionLost(), replaceState(state) }
  constructor(game, auth, hooks) {
    this.game = game;
    this.auth = auth; // { id, pw, sid }
    this.hooks = hooks;
    this.inFlight = null;
    this.timers = [];
    this.offline = false;
    this.stopped = false;
  }

  start() {
    this.timers.push(setInterval(() => this.saveLocal(), LOCAL_SAVE_SEC * 1000));
    this.timers.push(setInterval(() => this.saveServer('auto'), AUTOSAVE_SEC * 1000));
    this.onOnline = () => this.saveServer('back');
    this.onOffline = () => { this.offline = true; this.saveLocal(); };
    this.onHide = () => {
      if (document.visibilityState === 'hidden') this.leave();
    };
    this.onPageHide = () => this.leave();
    addEventListener('online', this.onOnline);
    addEventListener('offline', this.onOffline);
    document.addEventListener('visibilitychange', this.onHide);
    addEventListener('pagehide', this.onPageHide);
    this.saveLocal();
  }

  stop() {
    this.stopped = true;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    removeEventListener('online', this.onOnline);
    removeEventListener('offline', this.onOffline);
    document.removeEventListener('visibilitychange', this.onHide);
    removeEventListener('pagehide', this.onPageHide);
  }

  saveLocal(dirty = true) {
    const prev = store.load(store.keys.save(this.auth.id));
    store.save(store.keys.save(this.auth.id), { data: this.game.serialize(), at: Date.now(), dirty: dirty || !!prev?.dirty });
  }

  // reason: auto | manual | back
  async saveServer(reason) {
    if (this.stopped) return { ok: false };
    this.saveLocal();
    if (this.inFlight) return this.inFlight;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.offline = true;
      this.hooks.toast(MSG.offline, 'warn');
      return { ok: false, offline: true };
    }
    this.inFlight = this._save(reason).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  async _save(reason) {
    try {
      if (!this.auth.sid) {
        // 오프라인으로 시작했다면 먼저 로그인해서 세션을 받는다
        const ok = await this.relogin();
        if (!ok) return { ok: false };
      }
      const data = this.game.serialize();
      const r = await api.saveRemote(this.auth.id, this.auth.sid, data, this.game.meta());
      if (r.ok) {
        const wasOffline = this.offline;
        this.offline = false;
        store.save(store.keys.save(this.auth.id), { data, at: Date.now(), dirty: false });
        this.hooks.toast(wasOffline && reason !== 'manual' ? MSG.back : reason === 'manual' ? MSG.manual : MSG.auto, 'ok');
        return { ok: true };
      }
      if (r.code === 'SESSION' || r.code === 'NO_USER') {
        this.stop();
        this.hooks.sessionLost(r.code);
        return { ok: false, session: true };
      }
      this.hooks.toast(`저장하지 못했어요: ${r.msg || r.code}`, 'warn');
      return { ok: false };
    } catch (e) {
      if (e.net) {
        this.offline = true;
        this.hooks.toast(MSG.offline, 'warn');
        return { ok: false, offline: true };
      }
      this.hooks.toast('저장 중 문제가 생겼어요. 잠시 후 다시 시도해요.', 'warn');
      return { ok: false };
    }
  }

  async relogin() {
    const r = await api.login(this.auth.id, this.auth.pw);
    if (!r.ok) {
      if (r.code === 'WRONG_PW' || r.code === 'NO_USER') {
        this.stop();
        this.hooks.sessionLost(r.code);
      }
      return false;
    }
    this.auth.sid = r.sid;
    // 다른 기기에서 더 오래 플레이한 저장본이 있으면 그걸로 바꾼다
    const remote = parse(r.data);
    if (remote && (remote.playSec || 0) > this.game.s.playSec + 5) this.hooks.replaceState(remote);
    return true;
  }

  leave() {
    if (this.stopped) return;
    this.saveLocal();
    if (this.auth.sid && navigator.onLine !== false) api.beacon(this.auth.id, this.auth.sid, this.game.serialize(), this.game.meta());
  }
}

export function parse(s) {
  if (!s) return null;
  try {
    const v = typeof s === 'string' ? JSON.parse(s) : s;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

// 로그인 직후 서버 저장본과 브라우저 저장본 중 더 오래 플레이한 쪽을 고른다
export function pickSave(remoteStr, id) {
  const remote = parse(remoteStr);
  const localRec = store.load(store.keys.save(id));
  const local = parse(localRec?.data);
  if (!remote && !local) return { state: null, from: 'new' };
  if (!remote) return { state: local, from: 'local' };
  if (!local) return { state: remote, from: 'remote' };
  return (local.playSec || 0) > (remote.playSec || 0) ? { state: local, from: 'local' } : { state: remote, from: 'remote' };
}
