// 아래에서 올라오는 시트형 창
import { html, onTap } from './dom.js';
import { ui } from '../icons.js';

let root;
const stack = [];

export function initModals(el) {
  root = el;
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length && stack.at(-1).dismissable) stack.at(-1).close();
  });
}

// actions: [{ label, kind: 'primary'|'ghost'|'danger', onClick(close) , disabled }]
export function openModal({ title, body = '', actions = [], dismissable = true, cls = '' }) {
  const el = html(`
    <div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-backdrop"></div>
      <div class="sheet">
        <div class="sheet-head">
          <h2>${title}</h2>
          ${dismissable ? `<button class="icon-btn sheet-close" aria-label="닫기">${ui('close')}</button>` : ''}
        </div>
        <div class="sheet-body"></div>
        <div class="sheet-actions"></div>
      </div>
    </div>`);
  const bodyEl = el.querySelector('.sheet-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  const act = el.querySelector('.sheet-actions');
  if (!actions.length) act.remove();
  let closed = false;
  const entry = {
    dismissable,
    close: () => {
      if (closed) return;
      closed = true;
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    },
  };
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = `btn btn-${a.kind || 'ghost'}`;
    b.textContent = a.label;
    if (a.disabled) b.disabled = true;
    if (a.id) b.id = a.id;
    onTap(b, () => a.onClick ? a.onClick(entry.close) : entry.close());
    act.appendChild(b);
  }
  if (dismissable) {
    el.querySelector('.modal-backdrop').addEventListener('click', entry.close);
    el.querySelector('.sheet-close').addEventListener('click', entry.close);
  }
  root.appendChild(el);
  stack.push(entry);
  requestAnimationFrame(() => el.classList.add('in'));
  return { el, body: bodyEl, close: entry.close };
}

export function closeAll() {
  for (const m of [...stack]) m.close();
}

export function isOpen() {
  return stack.length > 0;
}
