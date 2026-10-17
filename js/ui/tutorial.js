// 처음 1분 안내: 알바 → 구매 → 긁기 → 강화 탭
import { won } from '../format.js';

export class Tutorial {
  constructor(app) {
    this.app = app;
    this.el = document.createElement('div');
    this.el.className = 'tut';
    this.el.hidden = true;
    this.el.innerHTML = '<div class="tut-ring"></div><div class="tut-bubble"><p class="tut-text"></p><p class="tut-sub"></p></div><div class="tut-finger" hidden></div>';
    document.body.appendChild(this.el);
    this.ring = this.el.querySelector('.tut-ring');
    this.bubble = this.el.querySelector('.tut-bubble');
    this.finger = this.el.querySelector('.tut-finger');
    addEventListener('resize', () => this.update());
    app.game.on('tut', () => this.update());
    this.update();
  }

  step() {
    const { game, shop, tab } = this.app;
    const s = game.s;
    if (tab !== 'shop' && s.tut < 3) return null;
    if (s.tut === 0) return { target: '#job-btn', text: '알바 버튼을 연타해서 돈을 모아요!', sub: `1,000원이면 첫 복권을 살 수 있어요 · 지금 ${won(s.money)}` };
    if (s.tut === 1) {
      if (shop.phase === 'scratch') return { target: '.stage-deck .t-play', text: '손가락으로 은박을 문질러 긁어요!', sub: '같은 금액 3개가 나오면 당첨', finger: true };
      return { target: '#buy-btn', text: '1,000원이 모였어요! 첫 복권을 사 볼까요?', sub: '' };
    }
    if (s.tut === 2) {
      if (shop.phase === 'scratch') return { target: '.stage-deck .t-play', text: '손가락으로 은박을 문질러 긁어요!', sub: '같은 금액 3개가 나오면 당첨', finger: true };
      return null;
    }
    if (s.tut === 3 && tab === 'shop' && shop.phase !== 'scratch') {
      // 강화 탭 안내는 잠깐만 보여주고 스스로 사라진다(플레이를 가리지 않게)
      if (!this.t3) this.t3 = setTimeout(() => game.setTut(4), 7000);
      return { target: '.tab[data-tab="upgrade"]', text: '강화 탭이 열렸어요!', sub: '승진하면 알바 수입이 늘어나요' };
    }
    return null;
  }

  update() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.place());
  }

  place() {
    const st = this.step();
    const target = st && document.querySelector(st.target);
    if (!st || !target) {
      this.el.hidden = true;
      return;
    }
    const r = target.getBoundingClientRect();
    if (!r.width) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    this.el.querySelector('.tut-text').textContent = st.text;
    const sub = this.el.querySelector('.tut-sub');
    sub.textContent = st.sub;
    sub.hidden = !st.sub;
    const pad = 6;
    Object.assign(this.ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const bw = Math.min(300, innerWidth - 32);
    this.bubble.style.width = bw + 'px';
    const bh = this.bubble.offsetHeight || 64;
    const above = r.top - bh - 18 > 8;
    const top = above ? r.top - bh - 16 : Math.min(innerHeight - bh - 8, r.bottom + 16);
    const left = Math.max(16, Math.min(innerWidth - bw - 16, r.left + r.width / 2 - bw / 2));
    Object.assign(this.bubble.style, { left: left + 'px', top: top + 'px' });
    this.bubble.classList.toggle('below', !above);
    this.bubble.style.setProperty('--arrow-x', Math.max(16, Math.min(bw - 16, r.left + r.width / 2 - left)) + 'px');
    this.finger.hidden = !st.finger;
    if (st.finger) Object.assign(this.finger.style, { left: r.left + r.width * 0.25 + 'px', top: r.top + r.height * 0.45 + 'px', '--dx': r.width * 0.5 + 'px' });
  }
}
