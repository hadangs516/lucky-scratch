// 화면 하단 알림. 큰 당첨 연출 중에는 미뤘다가 끝난 뒤 띄운다.
let root;
let holdCount = 0;
const queue = [];

export function initToasts(el) {
  root = el;
}

export function hold(on) {
  holdCount = Math.max(0, holdCount + (on ? 1 : -1));
  if (!holdCount) flush();
}

export function toast(msg, kind = 'ok', ms = 1800) {
  // 같은 문구가 이미 떠 있으면 중복으로 띄우지 않는다
  if ([...root.children].some((c) => c.dataset.msg === msg)) return;
  if (holdCount) {
    if (!queue.some((q) => q.msg === msg)) queue.push({ msg, kind, ms });
    return;
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.dataset.msg = msg;
  el.setAttribute('role', 'status');
  el.textContent = msg;
  root.appendChild(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  const life = kind === 'warn' ? Math.max(ms, 3200) : ms;
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, life);
}

function flush() {
  while (queue.length) {
    const q = queue.shift();
    toast(q.msg, q.kind, q.ms);
  }
}
