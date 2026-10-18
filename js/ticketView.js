// 복권 카드 화면 만들기(칸 복권)
import { coin, symbol, ui, TIER_COLORS } from './icons.js';
import { short } from './format.js';
import { ticketPrice, hasTraps, GOLDEN } from './economy.js';

export const THEMES = {
  t1: { band: '#e9771b', paper: '#fff4e2', ink: '#4a2a0c', accent: '#ffcf6b', icon: 'pouch' },
  t2: { band: '#2f9e4f', paper: '#effae8', ink: '#16402a', accent: '#a7e69a', icon: 'clover' },
  t3: { band: '#d7263d', paper: '#fff1ec', ink: '#4a0f17', accent: '#ffc531', icon: 'seven' },
  t4: { band: '#2d4a8a', paper: '#eef2fb', ink: '#14244a', accent: '#e6b422', icon: 'key' },
  t5: { band: '#6b3fa0', paper: '#f6effc', ink: '#2c1747', accent: '#ff9f40', icon: 'dice6' },
  t6: { band: '#0f8f9e', paper: '#e9fbfc', ink: '#073c42', accent: '#31d1e0', icon: 'diamond' },
  t7: { band: '#a87a00', paper: '#fff8df', ink: '#3d2c00', accent: '#ffd84a', icon: 'goldcoin' },
  t8: { band: '#232864', paper: '#eceefe', ink: '#141638', accent: '#ffd84a', icon: 'comet' },
  t9: { band: '#8e1b2c', paper: '#fff0f0', ink: '#3a0a12', accent: '#ffc531', icon: 'crown' },
  t10: { band: '#5a3b1e', paper: '#f6efe4', ink: '#2e1e0e', accent: '#e6b422', icon: 'map' },
  t11: { band: '#2b6f9e', paper: '#eef8ff', ink: '#0f2c40', accent: '#9ae6ff', icon: 'crownjewel' },
};

export function themeStyle(ticket) {
  const th = THEMES[ticket.id];
  return `--band:${th.band};--paper:${th.paper};--ink:${th.ink};--accent:${th.accent}`;
}

export function symIcon(sym) {
  if (sym.icon === 'coin') return coin(TIER_COLORS[sym.tone ?? 2], '₩');
  return symbol(sym.icon);
}

// 칸 그림 아래 글자
export function symLabel(ticket, sym, price, golden) {
  const g = golden ? GOLDEN.prizeMult : 1;
  switch (sym.kind) {
    case 'val': return `+${short(price * sym.v * g)}`;
    case 'mult': return `전체 ×${sym.k}`;
    case 'trap': return `−${short(price * sym.v)}`;
    case 'clover': return '황금 클로버';
    default: return '';
  }
}

// item: { t, s, l, g, n, f, k }, card: makeCard 결과
export function renderTicket(ticket, item, card) {
  const price = ticketPrice(ticket, item.k || 0);
  const el = document.createElement('div');
  const rows = Math.ceil(ticket.cells / ticket.cols);
  el.className = `ticket rows-${rows}${item.g ? ' golden' : ''}`;
  el.setAttribute('style', `${themeStyle(ticket)};--cols:${ticket.cols};--rows:${rows}`);
  const match = ticket.match ? ticket.syms.find((s) => s.id === ticket.match.sym) : null;
  const cells = card.cells.map(({ i, sym }) => {
    const isMatch = match && sym.id === match.id;
    return `<div class="cell k-${sym.kind}${isMatch ? ' is-match' : ''}${sym.tone >= 5 && sym.kind === 'val' ? ' is-top' : ''}" data-id="${i}">
      <span class="c-ic">${symIcon(sym)}</span>${sym.kind === 'blank' ? '' : `<b class="c-val">${symLabel(ticket, sym, price, item.g)}</b>`}
    </div>`;
  }).join('');
  const g = item.g ? GOLDEN.prizeMult : 1;
  el.innerHTML = `
    <div class="t-top">
      <span class="t-badge">${symbol(THEMES[ticket.id].icon)}</span>
      <span class="t-name">${ticket.name}</span>
      ${item.g ? '<span class="t-gold">황금 ×2</span>' : ''}
      <span class="t-price">${short(price)}원</span>
    </div>
    <div class="t-sub">
      ${match ? `<span class="t-match" title="같은 그림 ${ticket.match.need}개면 보너스">${symIcon(match)}<i>×${ticket.match.need}</i><b>+${short(price * ticket.match.bonus * g)}</b></span>` : ''}
      <span class="t-total" aria-live="polite"><small>받은 돈</small><b>0원</b></span>
    </div>
    <div class="t-play"><div class="board">${cells}</div></div>
    <div class="t-foot">
      <span>No.${String(item.s).padStart(10, '0').replace(/(\d{3})(\d{4})(\d{3})/, '$1-$2-$3')}</span>
      ${hasTraps(ticket) ? `<button class="t-discard" type="button">${ui('close')}그만 긁고 버리기</button>` : '<span>결과는 구매 순간 확정 · 가상 화폐</span>'}
    </div>
    <div class="t-result" hidden></div>`;
  const play = el.querySelector('.t-play');
  const cellEls = [...el.querySelectorAll('.cell')].map((c) => ({ id: Number(c.dataset.id), el: c }));
  return { el, play, cellEls, totalEl: el.querySelector('.t-total b'), discardBtn: el.querySelector('.t-discard') };
}

export { ui };
