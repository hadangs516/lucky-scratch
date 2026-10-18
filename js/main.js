// 시작점: 로그인 → 게임 화면 → 저장 관리
import { Game, migrate } from './state.js';
import * as E from './economy.js';
import * as api from './api.js';
import * as store from './storage.js';
import { Sync, pickSave, MSG } from './sync.js';
import { won, short } from './format.js';
import { ui } from './icons.js';
import { unlockAudio, sfx } from './audio.js';
import { initFx } from './fx.js';
import * as pwa from './pwa.js';
import { $, onTap } from './ui/dom.js';
import { initToasts, toast } from './ui/toast.js';
import { initModals, openModal, closeAll } from './ui/modal.js';
import { showAuth, showAutoLogin } from './ui/auth.js';
import { ShopView } from './ui/shop.js';
import { UpgradesView } from './ui/upgrades.js';
import { PrestigeView } from './ui/prestige.js';
import { RecordsView } from './ui/records.js';
import { openSettings, applySettings, install } from './ui/settingsView.js';
import { Tutorial } from './ui/tutorial.js';
import { Owner } from './ui/owner.js';
import { isCelebrating } from './ui/celebrate.js';

const app = { tab: 'shop' };
globalThis.__app = app; // 테스트·디버그용

function boot() {
  initFx($('#fx'));
  initToasts($('#toasts'));
  initModals($('#modal-root'));
  applySettings();
  pwa.registerSW();
  // 첫 터치에서 소리 켜기(브라우저 정책)
  addEventListener('pointerdown', unlockAudio, { capture: true });
  const auth = store.load(store.keys.auth);
  if (auth?.id && auth?.pw) autoLogin(auth);
  else showLogin();
  $('#boot').remove();
}

function screen(name) {
  $('#auth').hidden = name !== 'auth';
  $('#game').hidden = name !== 'game';
}

function showLogin(lastId = '') {
  screen('auth');
  showAuth($('#auth'), {
    lastId,
    onAuthed: (a) => {
      store.save(store.keys.auth, { id: a.id, pw: a.pw });
      startGame(a, a.isNew ? null : a.data, a.isNew);
    },
  });
}

async function autoLogin(auth) {
  screen('auth');
  const status = showAutoLogin($('#auth'), auth.id, () => {
    store.remove(store.keys.auth);
    showLogin(auth.id);
  });
  try {
    const r = await api.login(auth.id, auth.pw);
    if (!r || typeof r.ok !== 'boolean') throw Object.assign(new Error('저장 서버가 아직 준비되지 않았어요'), { server: true });
    if (r.ok) {
      startGame({ ...auth, sid: r.sid }, r.data, false);
      return;
    }
    store.remove(store.keys.auth);
    showLogin(auth.id);
    toast(r.msg || '다시 로그인해 주세요', 'warn');
  } catch (e) {
    // 인터넷이 안 될 때: 이 기기에 저장본이 있으면 오프라인으로 이어서 한다
    const local = store.load(store.keys.save(auth.id));
    if (e.net && local?.data) {
      startGame({ ...auth, sid: null }, null, false);
      setTimeout(() => toast(MSG.offline, 'warn'), 600);
      return;
    }
    status(`${e.message}. 잠시 후 다시 시도해 주세요.`);
    const card = $('.auth-card.auto', $('#auth'));
    if (card && !card.querySelector('.retry')) {
      const b = document.createElement('button');
      b.className = 'btn btn-primary retry';
      b.textContent = '다시 시도';
      onTap(b, () => autoLogin(auth));
      card.insertBefore(b, card.querySelector('.auto-other'));
    }
  }
}

function startGame(auth, remoteData, isNew) {
  app.auth = auth;
  const picked = isNew ? { state: null, from: 'new' } : pickSave(remoteData, auth.id);
  const game = new Game(picked.state ? migrate(picked.state) : undefined);
  app.game = game;
  screen('game');
  buildGame();
  app.sync = new Sync(game, auth, {
    toast: (m, k) => toast(m, k),
    sessionLost: (code) => sessionLost(code),
    replaceState: (state) => {
      store.save(store.keys.save(auth.id), { data: JSON.stringify(state), at: Date.now(), dirty: false });
      location.reload();
    },
  });
  app.sync.start();
  if (picked.from === 'local' || isNew) setTimeout(() => app.sync.saveServer('auto'), 1500);
  loop();
}

function buildGame() {
  const root = $('#game');
  root.innerHTML = `
    <header class="topbar">
      <div class="money-box">
        <b class="money" id="money" aria-live="off">0원</b>
        <button class="goal" id="goal" aria-label="다음 목표"><span class="goal-label"></span><span class="goal-bar"><i></i></span></button>
      </div>
      <span class="net-chip" id="net-chip" hidden>오프라인</span>
      <button class="icon-btn" id="settings-btn" aria-label="설정">${ui('gear')}</button>
    </header>
    <main class="views">
      <section class="view" id="view-shop"></section>
      <section class="view" id="view-upgrade" hidden></section>
      <section class="view" id="view-prestige" hidden></section>
      <section class="view" id="view-records" hidden></section>
    </main>
    <nav class="tabbar" role="tablist">
      <button class="tab on" data-tab="shop" role="tab">${ui('shop')}<span>복권방</span></button>
      <button class="tab" data-tab="upgrade" role="tab">${ui('upgrade')}<span>강화</span><i class="badge" hidden></i></button>
      <button class="tab" data-tab="prestige" role="tab">${ui('prestige')}<span>환생</span><i class="badge" hidden></i></button>
      <button class="tab" data-tab="records" role="tab">${ui('trophy')}<span>기록</span></button>
    </nav>`;
  const game = app.game;
  app.shop = new ShopView($('#view-shop'), game, app);
  app.views = {
    shop: app.shop,
    upgrade: new UpgradesView($('#view-upgrade'), game),
    prestige: new PrestigeView($('#view-prestige'), game),
    records: new RecordsView($('#view-records'), game, app),
  };
  for (const t of root.querySelectorAll('.tab')) onTap(t, () => switchTab(t.dataset.tab));
  onTap($('#settings-btn'), () => openSettings(app));
  onTap($('#goal'), () => {
    const goal = game.nextGoal();
    if (!goal) return;
    if (goal.kind === 'unlock') { switchTab('shop'); app.shop.showUnlock(goal.id); } else if (goal.kind === 'prestige') switchTab('prestige');
    else switchTab('upgrade');
  });
  app.tutorial = new Tutorial(app);
  app.owner = new Owner(app, $('#view-shop .stage'));
  app.shop.resume();
  app.displayMoney = game.s.money;
  renderTabs();
  renderGoal();
  game.on('money', () => { renderGoal(); renderBadges(); });
  game.on('upgrade', () => renderBadges());
  game.on('unlock', () => { renderTabs(); renderGoal(); });
  game.on('tut', () => renderTabs());
  game.on('prestige', () => { renderTabs(); renderGoal(); app.displayMoney = game.s.money; });
  // 업적이 한꺼번에 여러 개 달성되면 차례로 하나씩 알린다
  let achAt = 0;
  game.on('ach', (a) => {
    const at = Math.max(performance.now() + 500, achAt + 1400);
    achAt = at;
    setTimeout(() => {
      sfx.ach();
      toast(`업적 달성: ${a.name}`, 'ach', 2200);
    }, at - performance.now());
  });
  const net = () => { $('#net-chip').hidden = navigator.onLine !== false; };
  addEventListener('online', net);
  addEventListener('offline', net);
  net();
  pwa.onInstallChange(() => maybeInstallHint());
  setTimeout(() => maybeInstallHint(), 4000);
}

function tabLocked(tab) {
  const g = app.game;
  if (tab === 'upgrade' || tab === 'records') return g.s.tut < 3 && g.s.stats.tickets === 0 ? '첫 복권을 긁으면 열려요' : '';
  if (tab === 'prestige') return g.s.stage === 0 && !g.isUnlocked('t3') ? '럭키 세븐을 해금하면 열려요' : '';
  return '';
}

function renderTabs() {
  for (const t of document.querySelectorAll('.tab')) {
    const locked = !!tabLocked(t.dataset.tab);
    t.classList.toggle('locked', locked);
    t.classList.toggle('on', t.dataset.tab === app.tab);
    t.setAttribute('aria-selected', t.dataset.tab === app.tab);
  }
  renderBadges();
}

let badgeT = 0;
function renderBadges() {
  const now = performance.now();
  if (now - badgeT < 250) return;
  badgeT = now;
  const g = app.game;
  const up = document.querySelector('.tab[data-tab="upgrade"] .badge');
  const pr = document.querySelector('.tab[data-tab="prestige"] .badge');
  if (up) up.hidden = !!tabLocked('upgrade') || !g.upgrades().some((u) => u.can);
  if (pr) pr.hidden = !!tabLocked('prestige') || !g.prestigeInfo().ready;
}

function switchTab(tab) {
  const why = tabLocked(tab);
  if (why) {
    sfx.error();
    toast(why, 'warn', 1500);
    return;
  }
  if (tab === app.tab) return;
  sfx.click();
  app.views[app.tab].hide?.();
  app.tab = tab;
  for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== 'view-' + tab;
  app.views[tab].show?.();
  if (tab === 'upgrade' && app.game.s.tut === 3) app.game.setTut(4);
  renderTabs();
  app.tutorial.update();
}

function renderGoal() {
  const g = app.game;
  const goal = g.nextGoal();
  const el = $('#goal');
  if (!el) return;
  if (!goal) { el.hidden = true; return; }
  el.hidden = false;
  const p = Math.min(1, goal.have / goal.cost);
  el.querySelector('.goal-label').textContent = p >= 1 ? `${goal.label} 가능!` : `다음 목표 · ${goal.label} ${short(goal.cost)}원`;
  el.querySelector('.goal-bar i').style.transform = `scaleX(${p})`;
  el.classList.toggle('ready', p >= 1);
}

function maybeInstallHint() {
  if (pwa.isStandalone() || store.load('installHintDone') || !app.game || app.game.s.tut < 4 || !pwa.canPrompt()) return;
  store.save('installHintDone', true);
  openModal({
    title: '앱으로 설치할까요?',
    body: '<p class="lead">홈 화면에 아이콘이 생기고, 주소창 없이 꽉 찬 화면으로 바로 실행돼요.</p>',
    actions: [{ label: '나중에', kind: 'ghost' }, { label: '설치하기', kind: 'primary', onClick: (c) => { c(); install(); } }],
  });
}

// ───────── 게임 루프 ─────────
let lastT = 0;
let moneyEl;
function loop() {
  moneyEl = $('#money');
  lastT = performance.now();
  requestAnimationFrame(frame);
}

function frame(t) {
  const game = app.game;
  if (!game || app.dead) return;
  // 화면이 안 보이면 시간이 흐르지 않는다(접속하지 않으면 수익 없음)
  const dt = Math.min(0.25, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  if (document.visibilityState === 'visible') {
    game.tickPlay(dt);
    const done = game.helperTick(dt);
    for (const r of done) app.shop.onHelperResult(r);
  }
  app.shop.frame();
  // 금액 표시: 늘어날 때는 빠르게 따라 올라가고, 줄어들 때는 바로 반영
  const target = game.s.money;
  if (target < app.displayMoney || isCelebrating()) app.displayMoney = target < app.displayMoney ? target : app.displayMoney;
  else app.displayMoney += (target - app.displayMoney) * 0.22;
  if (Math.abs(target - app.displayMoney) < 1) app.displayMoney = target;
  const txt = won(app.displayMoney);
  if (moneyEl.textContent !== txt) moneyEl.textContent = txt;
  requestAnimationFrame(frame);
}

function sessionLost(code) {
  app.dead = false;
  closeAll();
  const wrong = code === 'WRONG_PW' || code === 'NO_USER';
  openModal({
    title: wrong ? '다시 로그인해 주세요' : '다른 기기에서 접속했어요',
    dismissable: false,
    body: wrong
      ? '<p class="lead">계정 정보가 바뀌어서 이 기기의 로그인이 풀렸어요.</p>'
      : '<p class="lead">같은 아이디로 다른 기기에서 로그인해서, 이 기기는 저장을 멈췄어요.</p><p class="muted">한 계정은 마지막으로 로그인한 기기 하나에서만 저장돼요.</p>',
    actions: [
      { label: '로그아웃', kind: 'ghost', onClick: () => logoutNow() },
      ...(wrong ? [] : [{
        label: '이 기기에서 계속하기', kind: 'primary', onClick: async (close) => {
          try {
            const r = await api.login(app.auth.id, app.auth.pw);
            if (!r.ok) { toast(r.msg, 'warn'); return; }
            close();
            // 다른 기기 진행이 더 많으면 그걸 불러오고, 아니면 이 기기 진행을 저장한다
            const remote = r.data ? JSON.parse(r.data) : null;
            if (remote && (remote.playSec || 0) > app.game.s.playSec) {
              store.save(store.keys.save(app.auth.id), { data: r.data, at: Date.now(), dirty: false });
              location.reload();
              return;
            }
            app.auth.sid = r.sid;
            app.sync = new Sync(app.game, app.auth, app.sync.hooks);
            app.sync.start();
            app.sync.saveServer('manual');
          } catch (e) {
            toast(e.message || '연결하지 못했어요', 'warn');
          }
        },
      }]),
    ],
  });
}

async function logoutNow() {
  app.dead = true;
  app.sync?.stop();
  store.remove(store.keys.auth);
  location.reload();
}

app.logout = async () => {
  try {
    const r = await app.sync.saveServer('manual');
    if (!r?.ok && !r?.session) {
      // 저장 실패 시에도 이 기기 저장본은 남는다
      toast('서버 저장은 못 했지만 이 기기에는 저장돼 있어요', 'warn');
    }
  } finally {
    logoutNow();
  }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export { E };
