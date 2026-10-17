// 강화 탭
import { won } from '../format.js';
import { ui, tool as toolIcon } from '../icons.js';
import { toolStage } from '../economy.js';
import { sfx } from '../audio.js';
import * as fx from '../fx.js';
import { onTap } from './dom.js';
import { toast } from './toast.js';

const ICON = { job: 'job', tool: 'tool', luck: 'luck', hire: 'helper', train: 'train', bulk: 'bulk', stake: 'stake' };

export class UpgradesView {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.root.innerHTML = `
      <div class="view-scroll">
        <h2 class="view-title">강화</h2>
        <p class="view-sub">이번 회차 동안 유지돼요. 환생하면 처음부터 다시 올려요.</p>
        <div class="up-list"></div>
      </div>`;
    this.list = this.root.querySelector('.up-list');
    game.on('money', () => this.visible && this.refreshAfford());
    game.on('upgrade', () => this.visible && this.render());
    game.on('prestige', () => this.visible && this.render());
  }

  show() {
    this.visible = true;
    this.render();
  }
  hide() {
    this.visible = false;
  }

  render() {
    const ups = this.game.upgrades();
    this.list.innerHTML = ups.map((u) => `
      <div class="up-card${u.max ? ' maxed' : ''}" data-id="${u.id}">
        <div class="up-ic">${u.id === 'tool' ? toolIcon(toolStage(this.game.s.life.tool)) : ui(ICON[u.id])}</div>
        <div class="up-info">
          <div class="up-head"><b>${u.name}</b><span class="up-lv">${u.title}</span></div>
          <div class="up-desc">${u.desc}</div>
          ${u.note ? `<div class="up-note">${u.note}</div>` : ''}
        </div>
        <button class="btn btn-up${u.can ? '' : ' disabled'}" ${u.max ? 'disabled' : ''} aria-disabled="${!u.can}">${u.max ? 'MAX' : won(u.cost)}</button>
      </div>`).join('');
    for (const card of this.list.querySelectorAll('.up-card')) {
      const btn = card.querySelector('.btn-up');
      onTap(btn, () => this.buy(card.dataset.id, btn));
    }
  }

  refreshAfford() {
    const ups = this.game.upgrades();
    for (const u of ups) {
      const btn = this.list.querySelector(`.up-card[data-id="${u.id}"] .btn-up`);
      if (!btn) { this.render(); return; }
      btn.classList.toggle('disabled', !u.can);
      btn.setAttribute('aria-disabled', !u.can);
    }
  }

  buy(id, btn) {
    const u = this.game.upgrades().find((x) => x.id === id);
    if (!u || u.max) return;
    if (id === 'stake' && this.game.pendingCount() > 0) {
      toast('남은 복권을 모두 긁은 뒤에 판돈을 올릴 수 있어요', 'warn');
      return;
    }
    if (!this.game.buyUpgrade(id)) {
      sfx.error();
      fx.shake(btn, 0.4);
      toast(`${won(u.cost - this.game.s.money)}이 더 필요해요`, 'warn', 1400);
      return;
    }
    sfx.levelup();
    const r = btn.getBoundingClientRect();
    fx.sparks(r.left + r.width / 2, r.top + r.height / 2, 14, '#ffd84a');
    const after = this.game.upgrades().find((x) => x.id === id);
    if (id === 'tool' && toolStage(this.game.s.life.tool) > toolStage(this.game.s.life.tool - 1)) {
      sfx.unlock();
      fx.confetti(30);
      toast(`긁개 진화! ${this.game.tool().name}`, 'ok', 2200);
    } else if (id === 'job' && after && after.title.split(' · ')[0] !== u.title.split(' · ')[0]) {
      sfx.unlock();
      toast(`승진! 이제 ${after.title.split(' · ')[0]}`, 'ok', 2200);
    } else if (id === 'hire') {
      toast('도우미가 왔어요! 쌓아둔 복권을 대신 긁어줘요', 'ok', 2400);
    }
  }
}
