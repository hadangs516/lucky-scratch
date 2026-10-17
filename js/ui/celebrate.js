// 대박·초대박 전체 화면 연출. 순서대로 하나씩 보여준다.
import { won } from '../format.js';
import { TIER_LABEL } from '../economy.js';
import { sfx } from '../audio.js';
import { haptic } from '../haptics.js';
import * as fx from '../fx.js';
import { hold } from './toast.js';

let chain = Promise.resolve();
let activeCount = 0;

export function isCelebrating() {
  return activeCount > 0;
}

export function celebrate(result) {
  activeCount++;
  hold(true);
  chain = chain.then(() => show(result)).finally(() => {
    activeCount--;
    hold(false);
  });
  return chain;
}

function show(r) {
  return new Promise((resolve) => {
    const mega = r.cls === 'mega';
    const el = document.createElement('div');
    el.className = `celebrate ${r.cls}${r.it.g ? ' golden' : ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `${TIER_LABEL[r.cls]} ${won(r.total)}`);
    el.innerHTML = `
      <div class="cel-rays" aria-hidden="true"></div>
      <div class="cel-box">
        <div class="cel-kicker">${r.source === 'helper' ? '도우미가 긁은 복권에서' : r.ticket.name}</div>
        <div class="cel-title">${mega ? '초대박!' : '대박!'}</div>
        <div class="cel-mult">${r.it.m}배${r.it.g ? ' × 황금 2배' : ''}</div>
        <div class="cel-amount">0원</div>
        ${r.extra > 0 ? `<div class="cel-bonus">행운 보너스 +${won(r.extra)} 포함</div>` : ''}
        <div class="cel-hint">화면을 누르면 계속해요</div>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const amountEl = el.querySelector('.cel-amount');
    const dur = fx.isReduced() ? 300 : mega ? 2400 : 1500;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - (1 - p) ** 3;
      amountEl.textContent = won(Math.round(r.total * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else el.classList.add('landed');
    };
    raf = requestAnimationFrame(tick);
    if (mega) { sfx.mega(); haptic.mega(); } else { sfx.big(); haptic.big(); }
    fx.flash(mega ? 'rgba(255,230,140,.9)' : 'rgba(255,240,190,.75)');
    fx.confetti(mega ? 140 : 80);
    setTimeout(() => fx.rain(mega ? 60 : 30), 300);
    if (mega) setTimeout(() => fx.confetti(100), 1300);
    const minShow = fx.isReduced() ? 400 : mega ? 1800 : 1000;
    const autoClose = mega ? 5200 : 3600;
    let closable = false;
    setTimeout(() => { closable = true; el.classList.add('closable'); }, minShow);
    const close = () => {
      if (!closable) return;
      cancelAnimationFrame(raf);
      clearTimeout(auto);
      el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, 250);
    };
    const auto = setTimeout(() => { closable = true; close(); }, autoClose);
    el.addEventListener('pointerdown', close);
  });
}
