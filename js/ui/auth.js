// 로그인·회원가입 화면
import * as api from '../api.js';
import { $, onTap } from './dom.js';
import { symbol } from '../icons.js';

const ID_RE = /^[가-힣]{2,13}$/;
const PW_RE = /^[0-9]{4}$/;

export function cleanId(v) {
  return String(v || '').replace(/\s+/g, '').normalize('NFC');
}

export function validateId(id) {
  if (!id) return '아이디를 입력해 주세요.';
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(id)) return '자음·모음만 있는 글자는 쓸 수 없어요. 완성된 한글로 입력해 주세요.';
  if (!/^[가-힣]*$/.test(id)) return '아이디는 한글만 쓸 수 있어요.';
  if (!ID_RE.test(id)) return '아이디는 한글 2~13자예요.';
  return '';
}

export function validatePw(pw) {
  if (!PW_RE.test(pw)) return '비밀번호는 숫자 4자리예요.';
  return '';
}

export function showAuth(root, { onAuthed, lastId = '' }) {
  root.innerHTML = `
    <div class="auth-wrap">
      <div class="sign">
        <div class="sign-bulbs" aria-hidden="true"></div>
        <div class="sign-ic">${symbol('clover')}</div>
        <h1 class="sign-title">럭키 스크래치</h1>
        <p class="sign-sub">알바로 모은 돈, 긁는 순간 인생역전</p>
      </div>
      <div class="auth-card">
        <div class="seg" role="tablist">
          <button class="seg-btn on" data-mode="login" role="tab" aria-selected="true">로그인</button>
          <button class="seg-btn" data-mode="signup" role="tab" aria-selected="false">회원가입</button>
        </div>
        <form class="auth-form" novalidate>
          <p class="auth-note" data-only="signup">진행 상황을 저장하기 위한 회원가입이에요. 같은 아이디로 다른 기기에서도 이어서 할 수 있어요.</p>
          <label class="field">
            <span class="field-label">아이디 <small>한글 2~13자</small></span>
            <input id="auth-id" name="id" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" placeholder="예: 행운의주인공" value="">
          </label>
          <label class="field">
            <span class="field-label">비밀번호 <small>숫자 4자리</small></span>
            <input id="auth-pw" name="pw" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password" placeholder="••••">
          </label>
          <label class="field" data-only="signup">
            <span class="field-label">비밀번호 확인</span>
            <input id="auth-pw2" name="pw2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" placeholder="••••">
          </label>
          <p class="auth-err" role="alert" aria-live="polite"></p>
          <button class="btn btn-primary btn-lg auth-submit" type="submit">로그인</button>
        </form>
      </div>
      <p class="disclaimer">이 게임의 '원'은 가상 화폐예요. 실제 돈이나 상품으로 바꿀 수 없고, 현금을 받거나 쓰는 기능도 없어요.<br>실제 복권은 평균적으로 산 돈보다 적게 돌려받는 구조예요.</p>
    </div>`;
  let mode = 'login';
  const form = $('.auth-form', root);
  const idEl = $('#auth-id', root), pwEl = $('#auth-pw', root), pw2El = $('#auth-pw2', root);
  const err = $('.auth-err', root);
  const submit = $('.auth-submit', root);
  idEl.value = lastId;

  const setMode = (m) => {
    mode = m;
    for (const b of root.querySelectorAll('.seg-btn')) {
      b.classList.toggle('on', b.dataset.mode === m);
      b.setAttribute('aria-selected', b.dataset.mode === m);
    }
    for (const x of root.querySelectorAll('[data-only="signup"]')) x.hidden = m !== 'signup';
    submit.textContent = m === 'login' ? '로그인' : '가입하고 시작하기';
    pwEl.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    err.textContent = '';
  };
  for (const b of root.querySelectorAll('.seg-btn')) onTap(b, () => setMode(b.dataset.mode));
  setMode('login');

  const digitsOnly = (el) => el.addEventListener('input', () => {
    const v = el.value.replace(/\D/g, '').slice(0, 4);
    if (v !== el.value) el.value = v;
  });
  digitsOnly(pwEl);
  digitsOnly(pw2El);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = cleanId(idEl.value);
    idEl.value = id;
    const pw = pwEl.value;
    const msg = validateId(id) || validatePw(pw) || (mode === 'signup' && pw !== pw2El.value ? '비밀번호 확인이 달라요.' : '');
    if (msg) {
      err.textContent = msg;
      return;
    }
    err.textContent = '';
    submit.disabled = true;
    submit.textContent = mode === 'login' ? '확인 중…' : '만드는 중…';
    try {
      const r = mode === 'login' ? await api.login(id, pw) : await api.signup(id, pw);
      if (!r || typeof r.ok !== 'boolean') throw Object.assign(new Error('저장 서버가 아직 준비되지 않았어요.'), { server: true });
      if (!r.ok) {
        err.textContent = r.msg || '다시 시도해 주세요.';
        if (r.code === 'NO_USER') err.textContent += ' 위의 "회원가입"을 눌러 주세요.';
        return;
      }
      onAuthed({ id, pw, sid: r.sid, data: r.data, isNew: mode === 'signup' });
    } catch (ex) {
      err.textContent = ex.net ? `${ex.message}. 저장 서버에 연결할 수 없어요.` : ex.message || '문제가 생겼어요. 다시 시도해 주세요.';
    } finally {
      submit.disabled = false;
      submit.textContent = mode === 'login' ? '로그인' : '가입하고 시작하기';
    }
  });
}

export function showAutoLogin(root, id, onOther) {
  root.innerHTML = `
    <div class="auth-wrap">
      <div class="sign">
        <div class="sign-bulbs" aria-hidden="true"></div>
        <div class="sign-ic">${symbol('clover')}</div>
        <h1 class="sign-title">럭키 스크래치</h1>
        <p class="sign-sub"><b class="auto-id"></b>님, 다시 오셨네요</p>
      </div>
      <div class="auth-card auto">
        <div class="spinner" aria-hidden="true"></div>
        <p class="auto-msg" role="status">자동 로그인 중…</p>
        <button class="btn btn-ghost auto-other">다른 아이디로 로그인</button>
      </div>
    </div>`;
  $('.auto-id', root).textContent = id;
  onTap($('.auto-other', root), onOther);
  return (msg) => { $('.auto-msg', root).textContent = msg; };
}
