// 복권방(홈) 화면: 복권대·복권 선택·구매·알바 버튼·도우미
import * as E from '../economy.js';
import { makeBoard, revealState, NEAR_TEXT, WIN_TEXT } from '../boards.js';
import { renderTicket, THEMES, themeStyle } from '../ticketView.js';
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
      <button class="job-btn" id="job-btn" aria-label="알바하기(연타)">
        <span class="job-ic">${ui('job')}</span>
        <span class="job-text"><b class="job-title">편의점 알바</b><small class="job-rank"></small></span>
        <span class="job-val"></span>
        <span class="combo"><span class="combo-fill"></span><span class="combo-label"></span></span>
      </button>`;
    this.stage = $('.stage', this.root);
    this.deck = $('.stage-deck', this.root);
    this.picker = $('.picker', this.root);
    this.qtyEl = $('.qty', this.root);
    this.buyBtn = $('#buy-btn', this.root);
    this.jobBtn = $('#job-btn', this.root);
    this.helpersEl = $('.helpers', this.root);
    this.stackBadge = $('.stack-badge', this.root);
    this.cursor = document.createElement('div');
    this.cursor.className = 'tool-cursor';
    this.cursor.hidden = true;
    document.body.appendChild(this.cursor);

    onTap(this.buyBtn, () => this.buy());
    onTap($('.odds-btn', this.root), () => this.showOdds(this.game.s.sel));
    this.bindJob();
    this.renderPicker();
    this.renderQty();
    this.renderBuy();
    this.renderJob();
    new ResizeObserver(() => this.fit()).observe(this.stage);
    this.game.on('stack', () => { this.renderStackBadge(); this.renderBuy(); });
    this.game.on('money', () => { this.renderBuy(); this.renderPickerAfford(); });
    this.game.on('upgrade', (id) => {
      if (id === 'job') this.renderJob();
      if (id === 'bulk') this.renderQty();
      if (id === 'tool' && this.cur?.scratcher) { const t = this.game.tool(); this.cur.scratcher.setTool(t.radius, t.threshold); }
      if (id === 'stake') { this.renderPicker(); this.renderBuy(); this.showIdle(); }
    });
    this.game.on('unlock', () => { this.renderPicker(); this.renderBuy(); });
    this.game.on('prestige', () => this.reset());
    this.game.on('perk', () => this.renderJob());
  }

  reset() {
    if (this.cur?.scratcher) this.cur.scratcher.destroy();
    this.cur = null;
    this.phase = 'idle';
    this.renderPicker();
    this.renderQty();
    this.renderBuy();
    this.renderJob();
    this.resume();
  }

  // 복권 크기를 무대에 맞춘다
  fit() {
    const r = this.deck.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const tw = Math.floor(Math.min(r.width - 28, (r.height - 6) / 0.86, 440));
    this.deck.style.setProperty('--tw', Math.max(220, tw) + 'px');
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
      if (c.short) toast(`${won(c.short)}이 부족해요. 알바 버튼을 연타해 보세요!`, 'warn', 1600);
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
    const top = Math.max(...t.tiers.map(([m]) => m));
    this.deck.innerHTML = `
      <div class="ticket display" style="${themeStyle(t)}">
        <div class="t-top"><span class="t-badge">${symbol(THEMES[t.id].icon)}</span><span class="t-name">${t.name}</span><span class="t-price">${shortWon(price)}</span></div>
        <div class="display-body">
          <div class="display-ic">${symbol(THEMES[t.id].icon)}</div>
          <p class="display-rule">${t.blurb}</p>
          <p class="display-top">최고 <b>${top}배</b> · ${shortWon(price * top)}</p>
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
    const board = makeBoard(ticket, it);
    const view = renderTicket(ticket, it, board);
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
    const cur = { it, ticket, board, view, beat: false, foundShown: false };
    this.cur = cur;
    if (it.g) setTimeout(() => fx.sparks(...centerOf(view.el), 24, '#ffe9a0'), 200);
    // 레이아웃이 잡힌 뒤 은박을 덮는다
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.cur !== cur) return;
      const t = this.game.tool();
      cur.scratcher = new Scratcher(view.play, view.cellEls, {
        radius: t.radius, threshold: t.threshold, golden: it.g,
        onStart: (e) => this.toolDown(e),
        onEnd: () => this.toolUp(),
        onHover: (e) => this.toolHover(e),
        onLeave: () => { if (!cur.scratcher?.drawing) this.cursor.hidden = true; },
        onStroke: (p, v, e) => this.onStroke(cur, p, v, e),
        onCell: (id, revealed, auto) => this.onCell(cur, id, revealed, auto),
        onDone: () => this.onDone(cur),
      });
      this.app.tutorial?.update();
    }));
    this.renderStackBadge();
  }

  toolDown(e) {
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
  onStroke(cur, p, v, e) {
    this.moveCursor(e.clientX, e.clientY, e.movementX ? e.movementX * 40 : 0);
    scratchSpeed(v);
    cur.dist = (cur.dist || 0) + 1;
    if (cur.dist % 3 === 0) fx.flakes(e.clientX, e.clientY, cur.it.g, 2);
    if (v > 250) haptic.scratch();
  }
  onCell(cur, id, revealed, auto) {
    if (this.cur !== cur) return;
    const st = revealState(cur.ticket, cur.board, revealed);
    for (const c of cur.view.cellEls) c.el.classList.toggle('glow', st.glow.includes(c.id));
    if (!auto) {
      sfx.reveal();
      haptic.cell();
      const cel = cur.view.cellEls.find((c) => c.id === id)?.el;
      cel?.classList.add('pop');
    }
    if (st.heartbeat && !st.found && !cur.beat && !auto) {
      cur.beat = true;
      sfx.heartbeat();
      haptic.tension();
      cur.view.el.classList.add('tense');
    }
    if (st.found && !cur.foundShown && !auto) {
      cur.foundShown = true;
      cur.view.el.classList.remove('tense');
      for (const gid of st.glow) {
        const el = cur.view.cellEls.find((c) => c.id === gid)?.el;
        if (el) fx.sparks(...centerOf(el), 8);
      }
    }
  }
  onDone(cur) {
    if (this.cur !== cur) return;
    scratchStop();
    this.cursor.hidden = true;
    cur.view.el.classList.remove('tense');
    setTimeout(() => this.finish(cur), 380);
  }

  async finish(cur) {
    if (this.cur !== cur || cur.finished) return;
    cur.finished = true;
    const r = this.game.completeActive();
    if (!r) return;
    this.phase = 'result';
    const v = cur.view;
    for (const c of v.cellEls) {
      c.el.classList.remove('glow');
      c.el.classList.toggle('win', cur.board.winCells.includes(c.id));
      if (r.it.m > 0 && !cur.board.winCells.includes(c.id)) c.el.classList.add('dim');
    }
    const res = v.el.querySelector('.t-result');
    res.hidden = false;
    const [cx, cy] = centerOf(v.el);
    if (r.it.m === 0) {
      v.el.classList.add('lost');
      if (cur.board.near) this.game.noteNear();
      res.innerHTML = `<div class="stamp lose">꽝</div>${cur.board.near ? `<div class="res-note">${NEAR_TEXT[cur.ticket.rule]}</div>` : ''}`;
      cur.board.near ? sfx.near() : sfx.lose();
    } else {
      v.el.classList.add('won', 'c-' + r.cls);
      res.innerHTML = `
        <div class="stamp win c-${r.cls}">
          <span class="stamp-label">${E.TIER_LABEL[r.cls]}${r.it.g ? ' · 황금 2배' : ''}</span>
          <b class="stamp-amt">+${won(r.total)}</b>
          <span class="stamp-why">${WIN_TEXT[cur.ticket.rule]}${r.extra > 0 ? ` · 보너스 +${short(r.extra)}` : ''}</span>
        </div>`;
      if (r.cls === 'even') { sfx.even(); }
      else if (r.cls === 'small') { sfx.small(); haptic.small(); fx.coins(cx, cy, 10, 0.8); }
      else if (r.cls === 'mid') { sfx.mid(); haptic.mid(); fx.coins(cx, cy, 26, 1.1); fx.shake(v.el, 0.6); }
      if (r.cls === 'big' || r.cls === 'mega') {
        fx.shake(document.getElementById('game'), 1);
        await celebrate(r);
      }
      fx.floatText(cx, cy - 20, `+${shortWon(r.total)}`, 'plus c-' + r.cls);
    }
    this.app.tutorial?.update();
    this.scheduleNext(r);
  }

  scheduleNext(r) {
    if (!this.game.s.stack.length) return;
    const delay = r.it.m === 0 ? 650 : r.cls === 'even' ? 800 : r.cls === 'small' ? 1100 : 1500;
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

  // ───────── 도우미 ─────────
  renderHelpers() {
    const s = this.game.s;
    if (!s.life.helpers) {
      if (this.helpersEl.childElementCount) this.helpersEl.innerHTML = '';
      return;
    }
    if (this.helpersEl.childElementCount !== s.life.helpers) {
      this.helpersEl.innerHTML = Array.from({ length: s.life.helpers }, (_, i) => `<span class="helper" data-i="${i}" title="도우미 ${i + 1}">${ui('helper')}<i class="helper-ring"></i></span>`).join('');
    }
    [...this.helpersEl.children].forEach((el, i) => {
      const j = s.helperJobs[i];
      el.classList.toggle('busy', !!j);
      el.style.setProperty('--p', j ? 1 - Math.max(0, j.left) / j.total : 0);
    });
  }
  onHelperResult(r) {
    const el = this.helpersEl.children[0];
    const [x, y] = el ? centerOf(el) : [innerWidth / 2, 120];
    if (r.it.m > 0) {
      fx.floatText(x, y + 10, `+${shortWon(r.total)}`, 'plus small c-' + r.cls);
      if (r.cls === 'big' || r.cls === 'mega') celebrate(r);
      else if (r.cls === 'mid') { sfx.mid(); fx.coins(x, y, 10, 0.7); } else sfx.even();
    }
  }

  // ───────── 알바 ─────────
  bindJob() {
    const btn = this.jobBtn;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = this.game.tap(performance.now());
      const level = E.COMBO.tiers.indexOf(r.tier);
      sfx.tap(level);
      fx.floatText(e.clientX + (Math.random() - 0.5) * 30, e.clientY - 24, `+${short(r.value)}`, 'tap');
      btn.classList.remove('press');
      void btn.offsetWidth;
      btn.classList.add('press');
      if (r.tierUp) {
        sfx.comboUp(level);
        haptic.combo();
        btn.classList.add('tier-up');
        setTimeout(() => btn.classList.remove('tier-up'), 400);
      }
      this.renderCombo();
      this.app.tutorial?.update();
    });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  renderJob() {
    const s = this.game.s;
    $('.job-rank', this.jobBtn).textContent = `${E.JOB_RANKS[E.jobRankIndex(s.life.job)]} · Lv.${s.life.job}`;
    this.renderCombo();
  }
  renderCombo() {
    const now = performance.now();
    const c = this.game.comboNow(now);
    const tier = E.comboTier(c);
    const v = this.game.tapValue(tier.mult);
    const vEl = $('.job-val', this.jobBtn);
    const txt = `+${short(v)}원`;
    if (vEl.textContent !== txt) vEl.textContent = txt;
    $('.combo-fill', this.jobBtn).style.transform = `scaleX(${Math.min(1, c / 100)})`;
    const label = c > 0 ? `콤보 ${c}${tier.mult > 1 ? ` · ×${tier.mult} ${tier.label}` : ''}` : '연타하면 콤보 보너스!';
    const lEl = $('.combo-label', this.jobBtn);
    if (lEl.textContent !== label) lEl.textContent = label;
    this.jobBtn.classList.toggle('fever', tier.mult >= 2);
    this.jobBtn.dataset.tier = E.COMBO.tiers.indexOf(tier);
  }

  // 매 프레임
  frame() {
    this.renderHelpers();
    if (this.game.combo.count && performance.now() - this.game.combo.last > E.COMBO.timeout * 1000 - 50) this.renderCombo();
  }

  // ───────── 확률표·해금 ─────────
  oddsTable(id) {
    const g = this.game;
    const t = E.TICKET_BY_ID[id];
    const tiers = E.effectiveTiers(t, g.s.life.luck);
    const price = g.price(id);
    const lose = 1 - tiers.reduce((s, [, w]) => s + w, 0) / E.WEIGHT_TOTAL;
    const rows = tiers.slice().reverse().map(([m, w]) => {
      const p = w / E.WEIGHT_TOTAL;
      return `<tr><td>${E.TIER_LABEL[E.tierClass(m)]}</td><td>${m}배</td><td class="num">${won(price * m)}</td><td class="num">${pct(p, p < 0.01 ? 2 : 1)}</td><td class="num muted">${oneIn(p)}</td></tr>`;
    }).join('');
    return `
      <table class="odds">
        <thead><tr><th>등급</th><th>배수</th><th>당첨금</th><th>확률</th><th></th></tr></thead>
        <tbody>${rows}<tr class="lose-row"><td>꽝</td><td>-</td><td class="num">0원</td><td class="num">${pct(lose)}</td><td></td></tr></tbody>
      </table>
      <ul class="facts">
        <li>지금 기대값 <b>${pct(g.rtp(id))}</b> (가격 1원당 평균 ${g.rtp(id).toFixed(2)}원을 돌려받아요)</li>
        <li>황금 복권 확률 ${pct(g.goldenChance())} · 황금 복권은 당첨금 2배</li>
        <li>행운 부적 Lv.${g.s.life.luck} 반영${g.bonus() > 0 ? ` · 당첨금 보너스 +${pct(g.bonus(), 0)}` : ''}</li>
        <li>결과는 구매하는 순간 정해지고, 긁기는 공개하는 과정이에요. 연속 꽝을 보정하는 장치는 없어요.</li>
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
    const top = Math.max(...t.tiers.map(([m]) => m));
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
