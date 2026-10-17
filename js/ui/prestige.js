// 환생 탭
import * as E from '../economy.js';
import { won, shortWon, pct } from '../format.js';
import { ui, symbol } from '../icons.js';
import { THEMES } from '../ticketView.js';
import { sfx } from '../audio.js';
import * as fx from '../fx.js';
import { onTap } from './dom.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

export class PrestigeView {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.root.innerHTML = `<div class="view-scroll"><div class="pr-body"></div></div>`;
    this.body = this.root.querySelector('.pr-body');
    game.on('money', () => this.visible && this.refreshTop());
    game.on('prestige', () => this.visible && this.render());
    game.on('perk', () => this.visible && this.render());
  }
  show() { this.visible = true; this.render(); }
  hide() { this.visible = false; }

  render() {
    const g = this.game;
    const p = g.prestigeInfo();
    const s = g.s;
    const arc = E.LIFE_NAMES.map((n, i) => `<li class="${i < s.stage ? 'done' : i === s.stage ? 'now' : ''}"><span class="dot"></span><span>${n}</span>${i > 0 && i <= 5 ? `<small>${E.TICKETS.find((t) => t.stageReq === i)?.name ?? ''} 등장</small>` : ''}</li>`).join('');
    const perks = g.perks().map((k) => `
      <div class="perk${k.maxed ? ' maxed' : ''}" data-id="${k.id}">
        <div class="perk-info"><b>${k.name}</b> <span class="perk-lv">Lv.${k.level}/${k.max}</span><div class="perk-desc">${k.desc}${k.now ? ` · ${k.now}` : ''}</div></div>
        <button class="btn btn-clover${k.can ? '' : ' disabled'}" ${k.maxed ? 'disabled' : ''}>${k.maxed ? 'MAX' : `${ui('clover')}${k.cost}`}</button>
      </div>`).join('');
    this.body.innerHTML = `
      <h2 class="view-title">환생</h2>
      <p class="view-sub">${p.final ? '마지막 환생까지 마쳤어요. 이제 무한 모드예요. 판돈을 올리며 끝없이 키워 보세요.' : '목표를 달성하면 처음부터 다시 시작하는 대신, 영구 강화에 쓰는 네잎 클로버를 받아요.'}</p>
      ${p.final ? `<div class="pr-card final">
          <div class="pr-row"><span>무한 모드</span><b>${E.LIFE_NAMES[5]}</b></div>
          <div class="pr-row"><span>판돈 단계</span><b>×${shortWon(E.stakeMult(s.life.stake)).replace('원', '')}</b></div>
          <div class="pr-row"><span>최고 보유액</span><b>${won(s.peak)}</b></div>
        </div>` : `<div class="pr-card">
          <div class="pr-row"><span>${E.LIFE_NAMES[s.stage]}</span><b>목표 ${won(p.goal)}</b></div>
          <div class="bar"><i style="transform:scaleX(${p.progress})"></i></div>
          <div class="pr-row small"><span>이번 회차 최고 보유액</span><b class="pr-peak">${won(p.peak)} (${pct(p.progress, 0)})</b></div>
          <div class="pr-row small"><span>지금 환생하면</span><b>${ui('clover')} ${p.clovers}개</b></div>
          ${p.nextTicket ? `<div class="pr-next">${symbol(THEMES[p.nextTicket.id].icon)}<span>환생하면 새 복권 <b>${p.nextTicket.name}</b>이(가) 나타나요</span></div>` : ''}
          <button class="btn btn-primary btn-lg pr-go" ${p.ready ? '' : 'disabled'}>${p.ready ? (p.pending ? `남은 복권 ${p.pending}장을 먼저 긁어 주세요` : '환생하기') : '목표를 달성하면 환생할 수 있어요'}</button>
          <p class="muted tiny">돈·강화·해금은 처음으로 돌아가요. 클로버 강화·기록·업적은 그대로예요.</p>
        </div>`}
      <ol class="arc">${arc}</ol>
      <div class="perk-head"><h3>영구 강화</h3><span class="clovers">${ui('clover')} <b>${s.clovers}</b>개</span></div>
      <div class="perk-list">${perks}</div>`;
    const go = this.body.querySelector('.pr-go');
    if (go) onTap(go, () => this.confirm());
    for (const el of this.body.querySelectorAll('.perk')) {
      const b = el.querySelector('.btn-clover');
      onTap(b, () => {
        if (g.buyPerk(el.dataset.id)) {
          sfx.levelup();
          const r = b.getBoundingClientRect();
          fx.sparks(r.left + r.width / 2, r.top + r.height / 2, 12, '#7fe0a0');
        } else sfx.error();
      });
    }
  }

  refreshTop() {
    const p = this.game.prestigeInfo();
    const bar = this.body.querySelector('.bar i');
    if (bar) bar.style.transform = `scaleX(${p.progress})`;
    const go = this.body.querySelector('.pr-go');
    if (go && !go.disabled !== p.ready) this.render();
    const peak = this.body.querySelector('.pr-peak');
    if (peak) peak.textContent = `${won(p.peak)} (${pct(p.progress, 0)})`;
  }

  confirm() {
    const g = this.game;
    const p = g.prestigeInfo();
    if (!p.ready) return;
    if (p.pending) {
      toast(`남은 복권 ${p.pending}장을 먼저 긁어 주세요`, 'warn');
      return;
    }
    const last = g.s.stage + 1 >= E.PRESTIGE.maxStage;
    openModal({
      title: last ? '마지막 환생' : '환생할까요?',
      body: `
        <p class="lead">${ui('clover')} 네잎 클로버 <b>${p.clovers}개</b>를 받고 ${E.LIFE_NAMES[g.s.stage + 1]}을(를) 시작해요.</p>
        <ul class="facts">
          <li>초기화: 보유 금액, 강화, 복권 해금</li>
          <li>유지: 클로버와 영구 강화, 기록, 업적</li>
          ${p.nextTicket ? `<li>새 복권 <b>${p.nextTicket.name}</b> 등장</li>` : ''}
          ${last ? '<li>마지막 환생 뒤에는 무한 모드가 열려요(판돈 올리기)</li>' : ''}
        </ul>`,
      actions: [
        { label: '아직이요', kind: 'ghost' },
        {
          label: '환생하기', kind: 'primary', onClick: (close) => {
            close();
            const got = g.prestige();
            if (got === false) return;
            sfx.unlock();
            fx.flash('rgba(160,255,200,.6)');
            fx.confetti(90);
            toast(`환생 완료! 클로버 ${got}개를 받았어요`, 'ok', 2600);
            this.render();
          },
        },
      ],
    });
  }
}
