// 작은 DOM 도우미
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

// 누르는 즉시 반응하는 버튼(모바일 300ms 지연 없음). 스크롤 중 실수 터치는 무시한다.
export function onTap(el, fn) {
  let sx = 0, sy = 0, moved = false, id = null;
  el.addEventListener('pointerdown', (e) => { id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false; });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) moved = true; });
  el.addEventListener('click', (e) => {
    if (moved) { moved = false; return; }
    fn(e);
  });
}
