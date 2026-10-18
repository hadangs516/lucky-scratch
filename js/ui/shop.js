// 복권방(홈) 화면: 복권대·복권 선택·구매·알바 버튼·도우미
import * as E from '../economy.js';
import { renderTicket, THEMES, themeStyle, symIcon, symLabel } from '../ticketView.js';
import { Scratcher } from '../scratch.js';
import { won, short, shortWon, pct, oneIn } from '../format.js';
import { symbol, ui, tool as toolIcon } from '../icons.js';
import { sfx, scratchStart, scratchSpeed, scratchStop } from '../audio.js';
import { haptic } from '../haptics.js';
import * as fx from '../fx.js';
import { $, onTap } from './dom.js';
import { openModal } from './modal.js';
import { celebrate } from './celebrate.js';
import { toast } from './toast.js';
import { JobView } from './job.js';

export class ShopView {
  constructor(root, game, app) {
    this.root = root;
    this.game = game;
    this.app = app;
    this.phase = 'idle'; // idle | scratch | result
    this.cur = null; // { it, ticket, board, view, scratcher }
    this.autoNext = null;
    this.build();
  }

  build() {
    this.root.innerHTML = `
      <div class="stage">
        <div class="stage-top">
          <div class="stack-badge" hidden></div>
          <div class="helpers"></div>
          <button class="chip-btn odds-btn" aria-label="확률표 보기">${ui('info')}<span>확률표</span></button>
        </div>
        <div class="stage-deck"></div>
      </div>
      <div class="picker" role="listbox" aria-label="복권 고르기"></div>
      <div class="buybar">
        <div class="qty" role="group" aria-label="구매 수량"></div>
        <button class="btn btn-buy" id="buy-btn"><span class="buy-main">구매</span><span class="buy-sub"></span></button>
      </div>
      <div class="job" id="job-btn" role="button" tabindex="0" aria-label="편의점 계산대: 바코드가 빨간 선에 닿을 때 누르세요"></div>`;
    this.stage = $('.stage', this.root);
    this.deck = $('.stage-deck', this.root);
    this.picker = $('.picker', this.root);
    this.qtyEl = $('.qty', this.root);
    this.buyBtn = $('#buy-btn', this.root);
    this.job = new JobView($('#job-btn', this.root), this.game, this.app);
    this.helpersEl = $('.helpers', this.root);
    this.stackBadge = $('.stack-badge', this.root);
    this.cursor = document.createElement('div');
    this.cursor.className = 'tool-cursor';
    this.cursor.hidden = true;
    document.body.appendChild(this.cursor);

    onTap(this.buyBtn, () => this.buy());
    onTap($('.odds-btn', this.root), () => this.showOdds(this.game.s.sel));
    this.renderPicker();
    this.renderQty();
    this.renderBuy();
    new ResizeObserver(() => this.fit()).observe(this.stage);
    this.game.on('stack', () => { this.renderStackBadge(); this.renderBuy(); });
    this.game.on('money', () => { this.renderBuy(); this.renderPickerAfford(); });
    this.game.on('upgrade', (id) => {
      if (id === 'job') this.job.render();
      if (id === 'bulk') this.renderQty();
      if (id === 'tool' && this.cur?.scratcher) this.cur.scratcher.setTool(...this.scratchTool(this.cur.ticket));
      if (id === 'stake') { this.renderPicker(); this.renderBuy(); this.showIdle(); }
    });
    this.game.on('unlock', () => { this.renderPicker(); this.renderBuy(); });
    this.game.on('prestige', () => this.reset());
    this.game.on('perk', () => this.job.render());
    // 컴퓨터에서는 스페이스바로도 계산할 수 있다
    addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.repeat || this.app.tab !== 'shop' || document.querySelector('.modal') || /INPUT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName)) return;
      e.preventDefault();
      this.job.onTap(e);
    });
  }

  reset() {
    if (this.cur?.scratcher) this.cur.scratcher.destroy();
    this.cur = null;
    this.phase = 'idle';
    this.renderPicker();
    this.renderQty();
    this.renderBuy();
    this.job.render();
    this.resume();
  }

  // 복권 크기를 무대에 맞춘다
  fit() {
    const r = this.deck.getBoundingClientRect();
    if (!r.width || !r.height) return; // 다른 탭에 가려진 동안은 건드리지 않는다
    const tw = Math.max(220, Math.floor(Math.min(r.width - 28, (r.height - 6) / 0.86, 440)));
    if (tw === this.tw) return;
    this.tw = tw;
    this.deck.style.setProperty('--tw', tw + 'px');
    // 크기가 실제로 바뀐 경우에만 은박을 다시 깐다(긁던 진행은 처음부터)
    if (this.cur?.scratcher && !this.cur.scratcher.done) {
      clearTimeout(this.relayout);
      this.relayout = setTimeout(() => this.cur?.scratcher && !this.cur.scratcher.done && this.cur.scratcher.layout(), 120);
    }
  }

  // 처음 열거나 이어하기: 직접 긁던 복권이나 쌓인 복권이 있으면 바로 올린다
  resume() {
    if (this.game.s.active) this.mountActive(this.game.s.active, false);
    else if (this.game.s.stack.length) this.loadNext(false);
    else this.showIdle();
    this.renderStackBadge();
  }

  // ───────── 복권 고르기 ─────────
  pickerTickets() {
    const g = this.game;
    const out = [];
    for (const t of E.TICKETS) {
      if (g.isUnlocked(t.id)) out.push({ t, state: 'open' });
      else if (g.canSeeUnlock(t.id)) out.push({ t, state: 'unlock' });
      else if (t.stageReq > g.s.stage && !out.some((x) => x.state === 'future')) out.push({ t, state: 'future' });
    }
    return out;
  }
  renderPicker() {
    const g = this.game;
    const sel = g.s.sel;
    this.picker.innerHTML = this.pickerTickets().map(({ t, state }) => {
      const price = g.price(t.id);
      const label = state === 'open' ? `${shortWon(price)}` : state === 'unlock' ? `해금 ${shortWon(g.unlockCost(t.id))}` : `환생 ${t.stageReq}회`;
      return `<button class="pick ${state}${t.id === sel ? ' sel' : ''}" data-id="${t.id}" role="option" aria-selected="${t.id === sel}" style="${themeStyle(t)}">
        <span class="pick-ic">${state === 'future' ? ui('lock') : symbol(THEMES[t.id].icon)}</span>
        <span class="pick-name">${state === 'future' ? '???' : t.name}</span>
        <span class="pick-price">${state === 'unlock' ? ui('lock') : ''}${label}</span>
      </button>`;
    }).join('');
    for (const b of this.picker.querySelectorAll('.pick')) onTap(b, () => this.onPick(b.dataset.id));
    this.renderPickerAfford();
    const selEl = this.picker.querySelector('.pick.sel');
    selEl?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  renderPickerAfford() {
    const g = this.game;
    for (const b of this.picker.querySelectorAll('.pick.unlock')) b.classList.toggle('afford', g.s.money >= g.unlockCost(b.dataset.id));
  }
  onPick(id) {
    const g = this.game;
    sfx.click();
    if (g.isUnlocked(id)) {
      g.s.sel = id;
      for (const b of this.picker.querySelectorAll('.pick')) {
        b.classList.toggle('sel', b.dataset.id === id);
        b.setAttribute('aria-selected', b.dataset.id === id);
      }
      this.renderBuy();
      if (this.phase === 'idle') this.showIdle();
    } else if (g.canSeeUnlock(id)) this.showUnlock(id);
    else {
      const t = E.TICKET_BY_ID[id];
      openModal({ title: '아직 잠겨 있어요', body: `<p class="lead">환생을 ${t.stageReq}번 하면 새로운 복권이 나타나요.</p><p class="muted">환생 탭에서 이번 회차 목표를 확인해 보세요.</p>`, actions: [{ label: '확인', kind: 'primary' }] });
    }
  }

  // ───────── 구매 ─────────
  renderQty() {
    const opts = this.game.bulkOptions();
    if (!opts.includes(this.game.s.qty)) this.game.s.qty = 1;
    this.qtyEl.hidden = opts.length < 2;
    this.qtyEl.innerHTML = opts.map((n) => `<button class="qty-btn${n === this.game.s.qty ? ' on' : ''}" data-n="${n}" aria-pressed="${n === this.game.s.qty}">×${n}</button>`).join('');
    for (const b of this.qtyEl.querySelectorAll('.qty-btn')) {
      onTap(b, () => {
        this.game.s.qty = Number(b.dataset.n);
        sfx.click();
        this.renderQty();
        this.renderBuy();
      });
    }
  }
  renderBuy() {
    const g = this.game;
    const id = g.s.sel;
    const n = g.s.qty;
    const c = g.canBuy(id, n);
    const t = E.TICKET_BY_ID[id];
    this.buyBtn.querySelector('.buy-main').textContent = n > 1 ? `${t.name} ${n}장 사기` : `${t.name} 사기`;
    this.buyBtn.querySelector('.buy-sub').textContent = c.ok ? won(g.price(id) * n) : c.short ? `${won(c.short)} 부족` : c.why;
    this.buyBtn.classList.toggle('disabled', !c.ok);
    this.buyBtn.setAttribute('aria-disabled', !c.ok);
  }
  buy() {
    const g = this.game;
    const id = g.s.sel;
    const n = g.s.qty;
    const c = g.canBuy(id, n);
    if (!c.ok) {
      sfx.error();
      fx.shake(this.buyBtn, 0.5);
      if (c.short) toast(`${won(c.short)}이 부족해요. 아래 계산대에서 알바해 보세요!`, 'warn', 1600);
      else toast(c.why, 'warn');
      return;
    }
    const items = g.buy(id, n);
    sfx.buy();
    haptic.buy();
    if (items.some((x) => x.g)) setTimeout(() => sfx.golden(), 150);
    const r = this.buyBtn.getBoundingClientRect();
    fx.floatText(r.left + r.width / 2, r.top, `-${short(c.cost)}원`, 'minus');
    if (this.phase !== 'scratch') {
      clearTimeout(this.autoNext);
      this.loadNext(true);
    }
    this.app.tutorial?.update();
  }

  // ───────── 복권대 ─────────
  showIdle() {
    this.phase = 'idle';
    const t = E.TICKET_BY_ID[this.game.s.sel];
    const price = this.game.price(t.id);
    const match = t.syms.find((x) => x.id === t.match?.sym);
    this.deck.innerHTML = `
      <div class="ticket display" style="${themeStyle(t)}">
        <div class="t-top"><span class="t-badge">${symbol(THEMES[t.id].icon)}</span><span class="t-name">${t.name}</span><span class="t-price">${shortWon(price)}</span></div>
        <div class="display-body">
          <div class="display-ic">${symbol(THEMES[t.id].icon)}</div>
          <p class="display-rule">${t.blurb}</p>
          <p class="display-top">칸 ${t.cells}개 · 최고 <b>${t.maxMult}배</b>${match ? ` · ${symIcon(match)}×${t.match.need} = +${shortWon(price * t.match.bonus)}` : ''}</p>
          <p class="display-cta">아래 버튼으로 사면 바로 긁을 수 있어요</p>
        </div>
      </div>`;
  }

  loadNext(animate = true) {
    const it = this.game.nextActive();
    if (!it) { this.showIdle(); return; }
    this.mountActive(it, animate);
  }

  mountActive(it, animate) {
    const ticket = E.TICKET_BY_ID[it.t];
    const card = this.game.cardOf(it);
    const view = renderTicket(ticket, it, card);
    if (animate) view.el.classList.add('deal');
    this.deck.innerHTML = '';
    // 뒤에 쌓인 복권 두께
    const behind = Math.min(3, this.game.s.stack.length);
    for (let i = behind; i >= 1; i--) {
      const b = document.createElement('div');
      b.className = 'ticket-back';
      b.style.setProperty('--i', i);
      this.deck.appendChild(b);
    }
    this.deck.appendChild(view.el);
    this.phase = 'scratch';
    const match = ticket.match ? ticket.match.sym : null;
    const cur = { it, ticket, card, view, beat: false, ladder: 0, match, bonusShown: false };
    this.cur = cur;
    this.setTotal(cur, it.paid || 0);
    if (it.g) setTimeout(() => fx.sparks(...centerOf(view.el), 24, '#ffe9a0'), 200);
    if (view.discardBtn) onTap(view.discardBtn, () => this.discard(cur));
    // 레이아웃이 잡힌 뒤 은박을 덮는다
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.cur !== cur) return;
      const [radius, strength] = this.scratchTool(ticket);
      cur.scratcher = new Scratcher(view.play, view.cellEls, {
        radius, strength, openAt: E.FOIL.openAt, golden: it.g,
        onStart: (e) => this.toolDown(e),
        onEnd: () => this.toolUp(),
        onHover: (e) => this.toolHover(e),
        onLeave: () => { if (!cur.scratcher?.drawing) this.cursor.hidden = true; },
        onStroke: (p, v, e, worn) => this.onStroke(cur, p, v, e, worn),
        onMove: (p, v, e) => this.onMove(cur, v, e),
        onCell: (id, revealed, silent) => this.onCell(cur, id, silent),
        onDone: () => this.onDone(cur),
      });
      // 이어하기: 이미 연 칸은 벗겨 둔다
      if (it.rv?.length) {
        cur.scratcher.restore(it.rv);
        for (const i of it.rv) cur.view.cellEls.find((c) => c.id === i)?.el.classList.add('revealed');
        if (it.rv.length >= ticket.cells) this.onDone(cur);
      }
      this.app.tutorial?.update();
    }));
    this.renderStackBadge();
  }

  // 도구 힘은 복권 은박 두께만큼 약해진다
  scratchTool(ticket) {
    const t = this.game.tool();
    return [t.radius, E.foilStrength(t.strength, E.foilThickness(ticket))];
  }

  setTotal(cur, total) {
    const el = cur.view.totalEl;
    el.textContent = (total < 0 ? '−' : total > 0 ? '+' : '') + won(Math.abs(total));
    el.parentElement.classList.toggle('neg', total < 0);
    el.parentElement.classList.toggle('pos', total > 0);
    el.parentElement.classList.toggle('over', total >= E.ticketPrice(cur.ticket, cur.it.k || 0));
    el.parentElement.classList.remove('bump');
    void el.offsetWidth;
    el.parentElement.classList.add('bump');
  }

  toolDown(e) {
    this.job.pause();
    this.cursor.innerHTML = toolIcon(this.game.tool().stage);
    this.cursor.hidden = false;
    this.cursor.classList.add('down');
    this.moveCursor(e.clientX, e.clientY, 0);
    scratchStart();
  }
  toolUp() {
    this.cursor.classList.remove('down');
    this.cursor.hidden = true;
    scratchStop();
  }
  toolHover(e) {
    if (e.pointerType !== 'mouse' || !this.cur?.scratcher || this.cur.scratcher.done) { this.cursor.hidden = true; return; }
    this.cursor.innerHTML = toolIcon(this.game.tool().stage);
    this.cursor.hidden = false;
    this.moveCursor(e.clientX, e.clientY, 0);
  }
  moveCursor(x, y, vx) {
    const size = Math.max(34, this.game.tool().radius * 2.1);
    this.cursor.style.setProperty('--size', size + 'px');
    // 손가락에 가리지 않게 살짝 위에 그린다
    this.cursor.style.transform = `translate(${x - size / 2}px, ${y - size * 0.95}px) rotate(${Math.max(-25, Math.min(25, vx * 0.02))}deg)`;
  }
  onMove(cur, v, e) {
    this.moveCursor(e.clientX, e.clientY, e.movementX ? e.movementX * 40 : 0);
    scratchSpeed(v);
  }
  // 은박이 깎일 때: 깎인 양만큼 부스러기, 열리기 직전 칸은 사각사각 소리와 떨림
  onStroke(cur, p, v, e, worn) {
    if (!worn) return;
    cur.wornAcc = (cur.wornAcc || 0) + worn;
    if (cur.wornAcc > 18) {
      fx.flakes(e.clientX, e.clientY, cur.it.g, Math.min(4, 1 + Math.floor(cur.wornAcc / 40)));
      cur.wornAcc = 0;
    }
    if (v > 250) haptic.scratch();
    const sc = cur.scratcher;
    if (!sc) return;
    for (const c of cur.view.cellEls) {
      if (c.el.classList.contains('revealed') || c.el.classList.contains('thin')) continue;
      if (sc.cellWear(c.id) > 0.7) { c.el.classList.add('thin'); sfx.thin(); }
    }
  }

  // 칸이 열리는 순간: 바로 정산하고 그 자리에서 터뜨린다
  onCell(cur, id, silent) {
    if (this.cur !== cur) return;
    const r = this.game.revealCell(id);
    if (!r) return;
    const cel = cur.view.cellEls.find((c) => c.id === id)?.el;
    if (!cel) return;
    cel.classList.add('pop');
    this.setTotal(cur, r.total);
    const [x, y] = centerOf(cel);
    const sym = r.sym;
    if (sym.kind === 'val') {
      cur.ladder++;
      sfx.coin(cur.ladder, sym.tone || 0);
      if (r.delta > 0) fx.floatText(x, y - 6, `+${short(r.delta)}`, `cell t${sym.tone || 0}`);
      if (sym.tone >= 5) { fx.sparks(x, y, 14, '#fff3b0'); fx.coins(x, y, 8, 0.7); haptic.small(); } else haptic.cell();
      if (sym.v >= 5) { sfx.mid(); fx.shake(cur.view.el, 0.5); }
    } else if (sym.kind === 'mult') {
      sfx.mult(sym.k);
      haptic.mid();
      fx.floatText(x, y - 10, `전체 ×${sym.k}!`, 'cell mult');
      if (r.delta > 0) setTimeout(() => fx.floatText(x, y + 12, `+${short(r.delta)}`, 'cell t5'), 250);
      fx.sparks(x, y, 18, '#d9b3ff');
      fx.shake(cur.view.el, 0.4);
    } else if (sym.kind === 'trap') {
      sfx.trap();
      haptic.mid();
      fx.floatText(x, y - 6, `−${short(-r.delta)}`, 'cell trap');
      cur.view.el.classList.remove('hurt');
      void cur.view.el.offsetWidth;
      cur.view.el.classList.add('hurt');
      fx.shake(cur.view.el, 0.7);
    } else if (sym.kind === 'clover') {
      sfx.clover();
      haptic.small();
      fx.floatText(x, y - 6, '황금 클로버 +1', 'cell clover');
      fx.sparks(x, y, 20, '#ffe066');
    } else {
      sfx.blank();
    }
    // 보너스 그림 긴장감: 하나 남았을 때 심장박동, 다 모으면 보너스
    if (cur.match) {
      const need = cur.ticket.match.need;
      const got = r.ev.matchCount;
      const matchEls = cur.view.cellEls.filter((c) => c.el.classList.contains('revealed') && c.el.classList.contains('is-match'));
      if (got >= need && !cur.bonusShown) {
        cur.bonusShown = true;
        cur.view.el.classList.remove('tense');
        for (const m of matchEls) { m.el.classList.add('win'); fx.sparks(...centerOf(m.el), 10); }
        const bonusAmt = Math.round(E.ticketPrice(cur.ticket, cur.it.k || 0) * cur.ticket.match.bonus * (cur.it.g ? E.GOLDEN.prizeMult : 1) * r.ev.multK * (1 + this.game.bonus()));
        setTimeout(() => {
          sfx.bonus();
          haptic.big();
          fx.floatText(...centerOf(cur.view.play), `보너스 +${short(bonusAmt)}!`, 'plus c-mid');
          fx.coins(...centerOf(cur.view.play), 30, 1.1);
        }, 120);
      } else if (got === need - 1 && !cur.beat && cur.view.cellEls.some((c) => !c.el.classList.contains('revealed'))) {
        cur.beat = true;
        for (const m of matchEls) m.el.classList.add('glow');
        sfx.heartbeat();
        haptic.tension();
        cur.view.el.classList.add('tense');
      }
    }
  }
  onDone(cur) {
    if (this.cur !== cur || cur.doneCalled) return;
    cur.doneCalled = true;
    scratchStop();
    this.cursor.hidden = true;
    cur.view.el.classList.remove('tense');
    setTimeout(() => this.finish(cur, false), 420);
  }

  // 함정이 무서우면 중간에 버린다: 안 연 칸은 정산하지 않는다
  discard(cur) {
    if (this.cur !== cur || cur.finished || !cur.scratcher || cur.scratcher.done) return;
    sfx.click();
    cur.scratcher.stop();
    scratchStop();
    this.cursor.hidden = true;
    for (const c of cur.view.cellEls) if (!c.el.classList.contains('revealed')) c.el.classList.add('missed');
    this.finish(cur, true);
  }

  async finish(cur, discard) {
    if (this.cur !== cur || cur.finished) return;
    cur.finished = true;
    const r = this.game.completeActive(discard);
    if (!r) return;
    this.phase = 'result';
    const v = cur.view;
    v.el.classList.remove('tense');
    for (const c of v.cellEls) c.el.classList.remove('glow');
    const res = v.el.querySelector('.t-result');
    res.hidden = false;
    const [cx, cy] = centerOf(v.el);
    const missedTraps = discard ? cur.card.cells.filter((c) => c.sym.kind === 'trap' && !r.it.rv.includes(c.i)).length : 0;
    const amt = `${r.total < 0 ? '−' : '+'}${won(Math.abs(r.total))}`;
    let label = E.TIER_LABEL[r.cls];
    let why = `가격의 ${fmtMult(r.m)}배`;
    if (discard) { label = '버림'; why = missedTraps ? `숨은 함정 ${missedTraps}개를 피했어요!` : '함정은 없었어요…'; }
    v.el.classList.add(r.m >= 1 ? 'won' : 'lost', 'c-' + r.cls);
    if (r.cls === 'lose') res.innerHTML = '<div class="stamp lose">꽝</div>';
    else res.innerHTML = `<div class="stamp win c-${r.cls}${r.total < 0 ? ' neg' : ''}"><span class="stamp-label">${label}${r.it.g ? ' · 황금 2배' : ''}</span><b class="stamp-amt">${amt}</b><span class="stamp-why">${why}</span></div>`;
    if (r.near) res.insertAdjacentHTML('beforeend', `<div class="res-note">${cur.ticket.match ? '보너스 그림 2개… 아깝다!' : '아깝다!'}</div>`);
    if (discard) sfx.click();
    else if (r.cls === 'trap') sfx.lose();
    else if (r.cls === 'lose' || r.cls === 'bit') r.near ? sfx.near() : sfx.lose();
    else if (r.cls === 'even') sfx.even();
    else if (r.cls === 'small') { sfx.small(); fx.coins(cx, cy, 10, 0.8); }
    else if (r.cls === 'mid') { sfx.mid(); haptic.mid(); fx.coins(cx, cy, 26, 1.1); fx.shake(v.el, 0.6); }
    if (r.cls === 'big' || r.cls === 'mega') {
      fx.shake(document.getElementById('game'), 1);
      await celebrate(r);
    }
    this.app.tutorial?.update();
    this.app.owner?.onResult(r);
    this.scheduleNext(r);
  }

  scheduleNext(r) {
    if (!this.game.s.stack.length) return;
    const delay = r.m < 1 ? 700 : r.cls === 'even' ? 850 : r.cls === 'small' ? 1100 : 1500;
    const go = () => {
      if (this.phase !== 'result') return;
      clearTimeout(this.autoNext);
      this.loadNext(true);
    };
    this.autoNext = setTimeout(go, delay);
    this.cur.view.el.addEventListener('pointerdown', go, { once: true });
  }

  renderStackBadge() {
    const n = this.game.s.stack.length;
    this.stackBadge.hidden = n === 0;
    this.stackBadge.textContent = `남은 복권 ${n}장`;
  }

  // ───────── 도우미: 작은 복권을 긁는 모습이 보이게 ─────────
  renderHelpers() {
    const s = this.game.s;
    if (!s.life.helpers) {
      if (this.helpersEl.childElementCount) this.helpersEl.innerHTML = '';
      return;
    }
    if (this.helpersEl.childElementCount !== s.life.helpers) {
      this.helpersEl.innerHTML = Array.from({ length: s.life.helpers }, (_, i) => `<span class="helper" data-i="${i}" title="도우미 ${i + 1}"><span class="helper-face">${ui('helper')}</span><span class="helper-card"><i class="hc-band"></i><i class="hc-foil"></i></span></span>`).join('');
    }
    [...this.helpersEl.children].forEach((el, i) => {
      const j = s.helperJobs[i];
      el.classList.toggle('busy', !!j);
      if (j) {
        const band = THEMES[j.it.t]?.band || '#888';
        if (el.dataset.band !== band) { el.dataset.band = band; el.style.setProperty('--hb', band); }
        el.style.setProperty('--p', (1 - Math.max(0, j.left) / j.total).toFixed(3));
      }
    });
  }
  onHelperResult(r) {
    const idx = Math.max(0, [...this.helpersEl.children].findIndex((el) => !el.classList.contains('busy')));
    const el = this.helpersEl.children[idx] || this.helpersEl.children[0];
    const [x, y] = el ? centerOf(el) : [innerWidth / 2, 120];
    if (el) { el.classList.remove('payout'); void el.offsetWidth; el.classList.add('payout'); }
    if (r.total > 0) {
      fx.floatText(x, y + 14, `+${shortWon(r.total)}`, 'plus small c-' + r.cls);
      if (r.cls === 'big' || r.cls === 'mega') celebrate(r);
      else if (r.cls === 'mid') { sfx.mid(); fx.coins(x, y, 10, 0.7); } else if (r.m >= 1) sfx.coin(2, 2);
    } else if (r.total < 0) fx.floatText(x, y + 14, `−${shortWon(-r.total)}`, 'plus small trap');
  }

  // 매 프레임
  frame(now = performance.now()) {
    this.renderHelpers();
    this.job.frame(now);
  }

  // ───────── 확률표·해금 ─────────
  oddsTable(id) {
    const g = this.game;
    const t = E.TICKET_BY_ID[id];
    const price = g.price(id);
    const ws = E.cellWeights(t, g.s.life.luck);
    const W = ws.reduce((a, b) => a + b.w, 0);
    const kindName = { blank: '꽝', val: '돈', mult: '배수', trap: '함정', clover: '황금 클로버' };
    const rows = ws.map(({ sym, w }) => `<tr class="k-${sym.kind}"><td class="o-ic">${symIcon(sym)}</td><td>${kindName[sym.kind]}${t.match && sym.id === t.match.sym ? ' · 보너스' : ''}</td><td class="num">${sym.kind === 'blank' ? '0원' : symLabel(t, sym, price, false)}</td><td class="num">${pct(w / W, w / W < 0.01 ? 2 : 1)}</td></tr>`).join('');
    const st = g.stats(id);
    return `
      <p class="muted tiny">칸 ${t.cells}개에 아래 그림이 하나씩, 칸마다 따로 정해져요(구매하는 순간 확정).</p>
      <table class="odds">
        <thead><tr><th></th><th>그림</th><th>금액</th><th>칸당 확률</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <ul class="facts">
        ${t.match ? `<li>같은 보너스 그림 ${t.match.need}개 → 보너스 <b>+${won(price * t.match.bonus)}</b></li>` : ''}
        <li>배수 칸은 이 복권에서 받은 돈 전체(보너스 포함)를 키워요. 함정 칸은 배수와 상관없이 그대로 빠져요.</li>
        <li>지금 기대값 약 <b>${pct(g.rtp(id))}</b> (전부 열 때 기준) · 본전 이상 ${pct(st.even, 0)} · 15배 이상 ${oneIn(st.big)}${st.trap ? ` · 함정 손해 ${pct(st.trap, 0)}` : ''}</li>
        <li>황금 복권 ${pct(g.goldenChance())} 확률로 등장, 돈·보너스 2배 · 행운 부적 Lv.${g.s.life.luck} 반영</li>
        <li>최고 ${t.maxMult}배를 넘는 판은 나오지 않아요. 연속 꽝 보정은 없어요.</li>
      </ul>`;
  }
  showOdds(id) {
    const t = E.TICKET_BY_ID[id];
    openModal({ title: `${t.name} 확률표`, body: `<p class="lead">${t.blurb}</p>${this.oddsTable(id)}`, actions: [{ label: '닫기', kind: 'primary' }] });
  }
  showUnlock(id) {
    const g = this.game;
    const t = E.TICKET_BY_ID[id];
    const cost = g.unlockCost(id);
    const can = g.s.money >= cost;
    const top = t.maxMult;
    const m = openModal({
      title: `새 복권: ${t.name}`,
      body: `
        <div class="unlock-hero" style="${themeStyle(t)}"><span class="unlock-ic">${symbol(THEMES[t.id].icon)}</span><div><b>${t.name}</b><span>한 장 ${won(g.price(id))} · 최고 ${top}배</span></div></div>
        <p class="lead">${t.blurb}</p>
        ${this.oddsTable(id)}`,
      actions: [
        { label: '닫기', kind: 'ghost' },
        {
          label: can ? `${won(cost)}에 해금` : `${won(cost - g.s.money)} 부족`, kind: 'primary', disabled: !can,
          onClick: (close) => {
            if (g.unlock(id)) {
              close();
              sfx.unlock();
              haptic.unlock();
              fx.confetti(40);
              toast(`${t.name} 해금! 이제 살 수 있어요`, 'ok');
              this.renderPicker();
              this.renderBuy();
              if (this.phase === 'idle') this.showIdle();
            }
          },
        },
      ],
    });
    return m;
  }
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

function fmtMult(m) {
  return (Math.round(m * 100) / 100).toLocaleString('ko-KR');
}
