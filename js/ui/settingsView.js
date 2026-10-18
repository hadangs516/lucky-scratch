// 설정 창, 앱 설치 안내, 게임 방법
import { settings, setSetting } from '../settings.js';
import { setSound, setBgm, unlockAudio, sfx } from '../audio.js';
import { setVibration, supported as vibSupported } from '../haptics.js';
import { setReduced } from '../fx.js';
import { ui } from '../icons.js';
import { APP_VERSION } from '../config.js';
import * as pwa from '../pwa.js';
import { openModal } from './modal.js';
import { onTap } from './dom.js';
import { toast } from './toast.js';

export function applySettings() {
  setSound(settings.sound);
  setBgm(settings.bgm);
  setVibration(settings.vib);
  setReduced(settings.reduced);
  document.documentElement.classList.toggle('reduced', settings.reduced);
}

export function openSettings(app) {
  const row = (key, icon, label, note = '', disabled = false) => `
    <label class="set-row${disabled ? ' off' : ''}">
      <span class="set-ic">${ui(icon)}</span>
      <span class="set-text"><b>${label}</b>${note ? `<small>${note}</small>` : ''}</span>
      <input type="checkbox" class="switch" id="set-${key}" data-key="${key}" ${settings[key] ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
    </label>`;
  const installNote = pwa.isStandalone() ? '이미 앱으로 실행 중이에요' : '홈 화면에 아이콘이 생기고 앱처럼 실행돼요';
  const m = openModal({
    title: '설정',
    body: `
      <div class="set-group">
        ${row('sound', 'sound', '효과음')}
        ${row('bgm', 'music', '배경음악', '잔잔한 음악(기본은 꺼짐)')}
        ${row('vib', 'vibrate', '진동', vibSupported ? '당첨·긴장 순간에만 짧게' : '이 기기·브라우저는 웹 진동을 지원하지 않아요(아이폰 등)', !vibSupported)}
        ${row('reduced', 'sparkle', '효과 줄이기', '번쩍임·흔들림·입자를 줄여요')}
      </div>
      <div class="set-group">
        <button class="set-btn" id="set-save">${ui('save')}<span><b>지금 저장</b><small>1분마다 자동으로도 저장돼요</small></span></button>
        <button class="set-btn" id="set-install" ${pwa.isStandalone() ? 'disabled' : ''}>${ui('install')}<span><b>앱 설치</b><small>${installNote}</small></span></button>
        <button class="set-btn" id="set-help">${ui('info')}<span><b>게임 방법 · 확률 안내</b><small>처음이라면 읽어 보세요</small></span></button>
        <button class="set-btn danger" id="set-logout">${ui('logout')}<span><b>로그아웃</b><small>${app.auth.id} · 이 기기의 자동 로그인을 끕니다</small></span></button>
      </div>
      <p class="muted tiny center">럭키 스크래치 v${APP_VERSION} · 게임 속 '원'은 가상 화폐이며 실제 돈·상품과 바꿀 수 없어요.</p>`,
  });
  for (const cb of m.body.querySelectorAll('.switch')) {
    cb.addEventListener('change', () => {
      setSetting(cb.dataset.key, cb.checked);
      unlockAudio();
      applySettings();
      sfx.click();
      if (cb.dataset.key === 'vib' && cb.checked) navigator.vibrate?.(30);
    });
  }
  onTap(m.body.querySelector('#set-save'), async () => {
    const r = await app.sync.saveServer('manual');
    if (r?.ok) m.close();
  });
  onTap(m.body.querySelector('#set-install'), () => install());
  onTap(m.body.querySelector('#set-help'), () => openHelp());
  onTap(m.body.querySelector('#set-logout'), () => {
    openModal({
      title: '로그아웃할까요?',
      body: '<p class="lead">지금까지 진행을 저장하고 로그아웃해요. 같은 아이디와 비밀번호로 언제든 이어서 할 수 있어요.</p>',
      actions: [
        { label: '취소', kind: 'ghost' },
        { label: '로그아웃', kind: 'danger', onClick: () => app.logout() },
      ],
    });
  });
}

export async function install() {
  if (pwa.isStandalone()) {
    toast('이미 앱으로 실행 중이에요', 'ok');
    return;
  }
  if (pwa.canPrompt()) {
    const r = await pwa.promptInstall();
    if (r === 'accepted') toast('설치했어요! 홈 화면에서 실행해 보세요', 'ok', 2600);
    return;
  }
  let steps;
  if (pwa.isInApp) {
    steps = `<p class="lead">카카오톡 같은 앱 안의 브라우저에서는 설치할 수 없어요.</p>
      <ol class="steps"><li>오른쪽 아래(또는 위) <b>⋮ / 공유</b> 메뉴를 눌러요</li><li><b>다른 브라우저로 열기</b>(아이폰은 Safari, 안드로이드는 Chrome)를 골라요</li><li>열린 화면에서 설정 → <b>앱 설치</b>를 다시 눌러요</li></ol>`;
  } else if (pwa.isIOS) {
    steps = `<p class="lead">아이폰·아이패드는 Safari에서 이렇게 설치해요. (Apple이 웹에서 설치 창을 띄우는 기능을 막아 두었어요.)</p>
      <ol class="steps"><li>아래쪽 <b>공유 버튼</b>(네모에서 화살표가 나온 모양)을 눌러요</li><li><b>홈 화면에 추가</b>를 눌러요</li><li>오른쪽 위 <b>추가</b>를 누르면 홈 화면에 앱이 생겨요</li></ol>`;
  } else {
    steps = `<p class="lead">이 브라우저에서는 설치 창을 바로 띄울 수 없어요.</p>
      <ol class="steps"><li>브라우저 메뉴 <b>⋮</b>를 눌러요</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요</li></ol>
      <p class="muted">안드로이드 Chrome에서는 이 버튼으로 바로 설치할 수 있어요. 방금 열었다면 잠시 뒤 다시 눌러 보세요.</p>`;
  }
  openModal({ title: '앱 설치', body: steps, actions: [{ label: '확인', kind: 'primary' }] });
}

export function openHelp() {
  openModal({
    title: '게임 방법',
    body: `
      <ol class="steps">
        <li><b>알바하기</b>: 아래 큰 버튼을 연타하면 돈을 벌어요. 빠르게 연타하면 콤보 보너스가 붙어요(최대 2배).</li>
        <li><b>복권 사기</b>: 위에서 복권을 고르고 사요. 칸마다 무엇이 들었는지는 사는 순간 정해져요.</li>
        <li><b>긁기</b>: 칸을 문질러 열 때마다 그 자리에서 바로 돈이 들어와요. 같은 보너스 그림 3개면 보너스, 보라색 배수 칸은 이 복권 전체를 키워요.</li>
        <li><b>함정</b>: 빨간 칸은 벌금이에요. 살짝 긁으면 빨갛게 비치니, 위험하면 "그만 긁고 버리기"를 눌러요. 안 연 칸은 정산하지 않아요.</li>
        <li><b>강화</b>: 승진(알바 수입), 긁개(긁는 폭), 행운 부적(당첨 확률), 도우미(쌓인 복권 대신 긁기), 묶음 구매.</li>
        <li><b>새 복권</b>: 돈을 모아 더 비싼 복권을 해금해요. 비쌀수록 기대값이 높아요.</li>
        <li><b>환생</b>: 회차 목표를 달성하면 처음부터 다시 시작하고, 영구 강화용 클로버를 받아요. 5번째 환생 뒤엔 무한 모드예요.</li>
      </ol>
      <h3>확률 안내</h3>
      <ul class="facts">
        <li>모든 복권의 확률표는 복권방의 "확률표" 버튼에서 볼 수 있어요.</li>
        <li>전부 열었을 때 기본 기대값은 복권마다 105~120%예요. 행운 부적을 올리면 더 높아져요.</li>
        <li>4번 복권부터 아주 드물게 황금 클로버 칸이 나와요. 환생 강화에 쓰여요.</li>
        <li>연속 꽝을 보정하는 장치는 없어요. 처음 시작한 지 10~30분 사이에 한 번, 큰 당첨을 선물로 드려요.</li>
        <li>게임에 접속해 있을 때만 돈을 벌어요(꺼져 있는 동안의 수익 없음).</li>
      </ul>
      <p class="muted">이 게임의 '원'은 가상 화폐예요. 실제 돈이나 상품으로 바꿀 수 없어요. 실제 복권은 평균적으로 산 돈보다 적게 돌려받아요.</p>`,
    actions: [{ label: '알겠어요', kind: 'primary' }],
  });
}
