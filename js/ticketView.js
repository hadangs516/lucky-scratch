// 복권 카드 화면 만들기
import { coin, symbol, ui, TIER_COLORS } from './icons.js';
import { short } from './format.js';
import { ticketPrice } from './economy.js';

export const THEMES = {
  t1: { band: '#e9771b', paper: '#fff4e2', ink: '#4a2a0c', accent: '#ffcf6b', icon: 'coin', tag: '동전' },
  t2: { band: '#2f9e4f', paper: '#effae8', ink: '#16402a', accent: '#a7e69a', icon: 'clover', tag: '번호' },
  t3: { band: '#d7263d', paper: '#fff1ec', ink: '#4a0f17', accent: '#ffc531', icon: 'seven', tag: '슬롯' },
  t4: { band: '#2d4a8a', paper: '#eef2fb', ink: '#14244a', accent: '#e6b422', icon: 'key', tag: '열쇠' },
  t5: { band: '#6b3fa0', paper: '#f6effc', ink: '#2c1747', accent: '#ff9f40', icon: 'star', tag: '대결' },
  t6: { band: '#0f8f9e', paper: '#e9fbfc', ink: '#073c42', accent: '#31d1e0', icon: 'gem', tag: '배수' },
  t7: { band: '#a87a00', paper: '#fff8df', ink: '#3d2c00', accent: '#ffd84a', icon: 'coin', tag: '동전' },
  t8: { band: '#232864', paper: '#eceefe', ink: '#141638', accent: '#ffd84a', icon: 'star', tag: '번호' },
  t9: { band: '#8e1b2c', paper: '#fff0f0', ink: '#3a0a12', accent: '#ffc531', icon: 'crown', tag: '슬롯' },
  t10: { band: '#5a3b1e', paper: '#f6efe4', ink: '#2e1e0e', accent: '#e6b422', icon: 'vault', tag: '열쇠' },
  t11: { band: '#2b6f9e', paper: '#eef8ff', ink: '#0f2c40', accent: '#9ae6ff', icon: 'diamond', tag: '대결' },
};

function tierColor(ticket, m) {
  const i = ticket.tiers.findIndex(([x]) => x === m);
  const n = ticket.tiers.length;
  return TIER_COLORS[Math.round((Math.max(0, i) / Math.max(1, n - 1)) * (TIER_COLORS.length - 1))];
}

export function themeStyle(ticket) {
  const th = THEMES[ticket.id];
  return `--band:${th.band};--paper:${th.paper};--ink:${th.ink};--accent:${th.accent}`;
}

// item: { t, m, g, n, s, k }, board: makeBoard 결과
export function renderTicket(ticket, item, board) {
  const price = ticketPrice(ticket, item.k || 0);
  const amt = (m) => short(price * m);
  const el = document.createElement('div');
  el.className = `ticket rule-${ticket.rule}${item.g ? ' golden' : ''}`;
  el.setAttribute('style', themeStyle(ticket));
  const cellHtml = (c) => {
    const base = `class="cell k-${c.kind}" data-id="${c.id}"`;
    switch (c.kind) {
      case 'amount': return `<div ${base}><span class="c-ic">${coin(tierColor(ticket, c.m))}</span><b class="c-val">${amt(c.m)}</b></div>`;
      case 'winnum': return `<div ${base}><b class="c-num">${c.num}</b></div>`;
      case 'mynum': return `<div ${base}><b class="c-num">${c.num}</b><span class="c-prize">${amt(c.m)}</span></div>`;
      case 'symbol': return `<div ${base}>${symbol(c.sym)}</div>`;
      case 'keysym': return `<div ${base}>${symbol(c.sym)}</div>`;
      case 'vault': return `<div ${base}><span class="c-ic">${symbol('vault')}</span><b class="c-val">${amt(c.m)}</b></div>`;
      case 'opp': return `<div ${base}><b class="c-num">${c.num}</b></div>`;
      case 'beatrow': return `<div ${base}><b class="c-num">${c.num}</b><span class="c-prize">${amt(c.m)}</span></div>`;
      case 'gemcell': return `<div ${base}><span class="c-ic">${symbol(c.sym)}</span><b class="c-val">${amt(c.m)}</b></div>`;
      case 'mult': return `<div ${base}><b class="c-mult">×${c.k}</b></div>`;
      default: return '';
    }
  };
  const cells = (pred) => board.cells.filter(pred).map(cellHtml).join('');
  let body = '';
  let sub = `<div class="t-rule">${ticket.blurb}</div>`;
  switch (ticket.rule) {
    case 'match3':
      body = `<div class="board" style="--cols:3">${cells(() => true)}</div>`;
      break;
    case 'numbers':
      body = `<div class="board b-numbers">
        <div class="zone z-wins"><div class="z-label">${ticket.win >= 3 ? '별빛 번호' : '행운 번호'}</div><div class="z-cells" style="--cols:${board.cells.filter((c) => c.kind === 'winnum').length}">${cells((c) => c.kind === 'winnum')}</div></div>
        <div class="zone z-mine"><div class="z-label">내 번호</div><div class="z-cells" style="--cols:${board.cols}">${cells((c) => c.kind === 'mynum')}</div></div>
      </div>`;
      break;
    case 'slot': {
      const rows = [];
      for (let r = 0; r < board.rows; r++) rows.push(`<div class="reel-row">${cells((c) => c.kind === 'symbol' && c.row === r)}</div>`);
      body = `<div class="board b-slot" style="--rows:${board.rows}">${rows.join('')}</div>`;
      sub = `<div class="t-pay">${board.paytable.slice().reverse().map((p) => `<span class="pay">${symbol(p.sym)}<b>${amt(p.m)}</b></span>`).join('')}</div>`;
      break;
    }
    case 'keys':
      body = `<div class="board b-keys">
        <div class="z-cells" style="--cols:${board.cols}">${cells((c) => c.kind === 'keysym')}</div>
        <div class="zone z-side"><div class="z-label">금고</div>${cells((c) => c.kind === 'vault')}</div>
      </div>`;
      break;
    case 'beat':
      body = `<div class="board b-beat">
        <div class="zone z-side"><div class="z-label">상대</div>${cells((c) => c.kind === 'opp')}</div>
        <div class="zone z-rows"><div class="z-label">내 숫자</div><div class="z-cells" style="--cols:2">${cells((c) => c.kind === 'beatrow')}</div></div>
      </div>`;
      break;
    case 'gem':
      body = `<div class="board b-gem">
        <div class="z-cells" style="--cols:3">${cells((c) => c.kind === 'gemcell')}</div>
        <div class="zone z-side"><div class="z-label">배수</div>${cells((c) => c.kind === 'mult')}</div>
      </div>`;
      break;
  }
  el.innerHTML = `
    <div class="t-top">
      <span class="t-badge">${symbol(THEMES[ticket.id].icon)}</span>
      <span class="t-name">${ticket.name}</span>
      ${item.g ? '<span class="t-gold">황금 ×2</span>' : ''}
      <span class="t-price">${short(price)}원</span>
    </div>
    <div class="t-sub">${sub}</div>
    <div class="t-play">${body}</div>
    <div class="t-foot"><span>No.${String(item.s).padStart(10, '0').replace(/(\d{3})(\d{4})(\d{3})/, '$1-$2-$3')}</span><span>결과는 구매 순간 확정 · 가상 화폐</span></div>
    <div class="t-result" hidden></div>`;
  const play = el.querySelector('.t-play');
  const cellEls = [...el.querySelectorAll('.cell')].map((c) => ({ id: Number(c.dataset.id), el: c }));
  return { el, play, cellEls };
}

// 복권 선택 칩·확률표에 쓰는 작은 카드
export function miniTicket(ticket, stake = 0) {
  return `<span class="mini" style="${themeStyle(ticket)}"><span class="mini-ic">${symbol(THEMES[ticket.id].icon)}</span></span>`;
}

export { ui };
