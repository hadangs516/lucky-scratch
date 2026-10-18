// 편의점 계산대 화면: 컨베이어 위 물건의 바코드가 빨간 스캐너 선에 닿을 때 누른다
import * as E from '../economy.js';
import { short } from '../format.js';
import { jobItem } from '../icons.js';
import { sfx } from '../audio.js';
import { haptic } from '../haptics.js';
import * as fx from '../fx.js';
import { $ } from './dom.js';

const SCAN_X = 0.3; // 스캐너 선 위치(계산대 폭 대비)
const JUDGE = { perfect: '정확!', good: '좋아요', broken: '깨졌어요!', miss: '놓쳤어요' };

export class JobView {
  constructor(el, game, app) {
    this.el = el;
    this.game = game;
    this.app = app;
    this.reg = game.register;
    this.nodes = new Map(); // 물건 id → 요소
    el.innerHTML = `
      <div class="job-head">
        <span class="job-rank"></span>
        <span class="job-combo"><b class="job-combo-n"></b><span class="job-combo-label"></span></span>
        <span class="job-val"></span>
      </div>
      <div class="belt">
        <div class="belt-track"></div>
        <div class="scanner"><i class="scan-good"></i><i class="scan-perfect"></i><i class="laser"></i></div>
        <div class="belt-items"></div>
        <div class="belt-msg"></div>
      </div>`;
    this.belt = $('.belt', el);
    this.itemsEl = $('.belt-items', el);
    this.msg = $('.belt-msg', el);
    this.scanner = $('.scanner', el);
    el.addEventListener('pointerdown', (e) => this.onTap(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    new ResizeObserver(() => this.measure()).observe(this.belt);
    this.measure();
    this.render();
    this.showMsg();
  }

  measure() {
    this.w = this.belt.clientWidth || 300;
    this.sx = Math.round(this.w * SCAN_X);
    this.scanner.style.left = this.sx + 'px';
  }
  // 위치(0=스캐너 선, 1=오른쪽 끝) → px
  px(p) { return this.sx + p * (this.w - this.sx + 24); }

  pause() {
    if (this.reg.paused) return;
    this.reg.pause(performance.now());
    this.showMsg();
  }
  showMsg() {
    const first = this.game.s.stats.taps === 0;
    this.msg.innerHTML = this.reg.paused
      ? (first ? '<b>눌러서 계산 시작</b><small>바코드가 빨간 선에 닿을 때 누르세요</small>' : '<b>손님 대기 중</b><small>눌러서 계산 계속하기</small>')
      : '';
    this.el.classList.toggle('paused', this.reg.paused);
  }

  onTap(e) {
    e.preventDefault();
    const now = performance.now();
    const ev = this.game.work(now);
    if (ev.type === 'start') { sfx.click(); this.showMsg(); return; }
    if (ev.type === 'jammed') return;
    if (ev.type === 'jam') {
      sfx.jam();
      this.el.classList.remove('jam');
      void this.el.offsetWidth;
      this.el.classList.add('jam');
      this.label('삐빅! 헛손질', 'jam');
      if (ev.lost >= 10) this.app.owner?.say([`아이고, 연속 ${ev.lost}개가 날아갔네. 천천히!`], 1);
      this.render();
      return;
    }
    this.onScan(ev);
  }

  onScan(ev) {
    const node = this.nodes.get(ev.item.id);
    const r = node?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : innerWidth * SCAN_X;
    const y = r ? r.top : innerHeight - 80;
    const lvl = E.COMBO.tiers.indexOf(ev.tier);
    if (ev.res === 'perfect' || ev.res === 'good') {
      sfx.scan(ev.res === 'perfect', lvl);
      haptic.cell();
      node?.classList.add('scanned', ev.res);
      fx.floatText(x, y - 6, `+${short(ev.value)}`, ev.item.kind === 'gift' ? 'tip' : 'tap');
      this.label(JUDGE[ev.res], ev.res);
      if (ev.item.kind === 'gift') { fx.coins(x, y, 8, 0.7); haptic.small(); }
      if (ev.tierUp) {
        sfx.comboUp(lvl);
        haptic.combo();
        this.el.classList.add('tier-up');
        setTimeout(() => this.el.classList.remove('tier-up'), 400);
      }
    } else if (ev.res === 'broken') {
      sfx.crack();
      node?.classList.add('broken');
      this.label(JUDGE.broken, 'jam');
    } else {
      sfx.miss();
      node?.classList.add('missed');
      this.label(JUDGE.miss, 'miss');
    }
    if (ev.done) this.onCustomer(ev.done);
    this.render();
    this.app.tutorial?.update();
  }

  // 손님 한 명 계산 끝: 실수 없으면 보너스, 전부 정확이면 단골 팁
  onCustomer(d) {
    const r = this.belt.getBoundingClientRect();
    const x = r.left + this.sx, y = r.top - 6;
    if (d.perfect) {
      sfx.register(true);
      haptic.small();
      fx.floatText(x + 40, y - 18, `완벽 계산! 단골 팁 +${short(d.value)}`, 'tip');
      fx.coins(x, y, 10, 0.8);
      this.app.owner?.tip(d.value);
    } else if (d.clean) {
      sfx.register(false);
      fx.floatText(x + 40, y - 14, `실수 없음 +${short(d.value)}`, 'tap');
    }
  }

  label(text, cls) {
    const el = document.createElement('div');
    el.className = 'judge ' + cls;
    el.textContent = text;
    el.style.left = this.sx + 'px';
    this.belt.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  render() {
    const s = this.game.s;
    $('.job-rank', this.el).textContent = `${E.JOB_RANKS[E.jobRankIndex(s.life.job)]} · Lv.${s.life.job}`;
    const c = this.reg.combo;
    const tier = E.comboTier(c);
    $('.job-val', this.el).textContent = `${short(this.game.tapValue(tier.mult))}원`;
    $('.job-combo-n', this.el).textContent = c > 0 ? `${c}연속` : '';
    $('.job-combo-label', this.el).textContent = tier.mult > 1 ? `×${tier.mult} ${tier.label}` : c > 0 ? '' : '바코드를 빨간 선에 맞춰 누르기';
    this.el.classList.toggle('fever', tier.mult >= 2);
    this.el.dataset.tier = E.COMBO.tiers.indexOf(tier);
  }

  // 매 프레임: 놓친 물건 처리 + 물건 위치 그리기
  frame(now) {
    if (this.app.tab !== 'shop' || document.querySelector('.modal')) { this.pause(); return; }
    const evs = this.game.workUpdate(now);
    for (const ev of evs) {
      if (ev.type === 'scan') this.onScan(ev);
      if (ev.type === 'idle') this.showMsg();
    }
    // 판정 구역 폭(지금 속도 기준)
    const travel = this.reg.travel();
    const span = this.w - this.sx + 24;
    const pw = (E.REGISTER.perfectMs / travel) * span, gw = (E.REGISTER.goodMs / travel) * span;
    if (Math.abs(pw - (this.pw || 0)) > 0.5) {
      this.pw = pw;
      this.scanner.style.setProperty('--pw', pw * 2 + 'px');
      this.scanner.style.setProperty('--gw', gw * 2 + 'px');
    }
    const alive = new Set();
    for (const it of this.reg.items) {
      alive.add(it.id);
      let n = this.nodes.get(it.id);
      if (!n) {
        n = document.createElement('div');
        n.className = `bitem k-${it.kind}${it.pair ? ' pair' + it.pair : ''}`;
        n.innerHTML = `${it.pair === 2 ? '' : jobItem(it.kind, it.id)}<i class="barcode"></i>`;
        this.itemsEl.appendChild(n);
        this.nodes.set(it.id, n);
      }
      if (!n.classList.contains('scanned')) n.style.transform = `translateX(${this.px(this.reg.pos(it, now)).toFixed(1)}px)`;
    }
    for (const [id, n] of this.nodes) {
      if (!alive.has(id)) { n.remove(); this.nodes.delete(id); }
    }
    // 벨트 무늬도 물건과 같은 속도로 흐른다
    const dt = Math.min(100, now - (this.lastNow || now));
    this.lastNow = now;
    if (!this.reg.paused) {
      this.beltOff = ((this.beltOff || 0) + (dt * span) / travel) % 24;
      this.belt.style.setProperty('--belt', (-this.beltOff).toFixed(1) + 'px');
    }
  }
}
