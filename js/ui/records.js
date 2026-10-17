// 기록 탭: 통계·업적·자랑하기
import { ACHIEVEMENTS } from '../achievements.js';
import { won, comma, pct } from '../format.js';
import { ui } from '../icons.js';
import { LIFE_NAMES } from '../economy.js';
import { onTap } from './dom.js';
import { toast } from './toast.js';

export class RecordsView {
  constructor(root, game, app) {
    this.root = root;
    this.game = game;
    this.app = app;
    this.root.innerHTML = `<div class="view-scroll"><div class="rec-body"></div></div>`;
    this.body = this.root.querySelector('.rec-body');
    game.on('ach', () => this.visible && this.render());
  }
  show() { this.visible = true; this.render(); }
  hide() { this.visible = false; }

  render() {
    const s = this.game.s;
    const st = s.stats;
    const got = ACHIEVEMENTS.filter((a) => s.ach[a.id]).length;
    const stats = [
      ['지금 회차', LIFE_NAMES[s.stage]],
      ['긁은 복권', `${comma(st.tickets)}장`],
      ['당첨', `${comma(st.wins)}번 (${st.tickets ? pct(st.wins / st.tickets, 0) : '0%'})`],
      ['최고 당첨금', st.best ? `${won(st.best)}` : '-'],
      ['최고 당첨 복권', st.bestName ? `${st.bestName} ${st.bestMult}배` : '-'],
      ['누적 당첨금', won(st.totalWon)],
      ['대박·초대박', `${comma(st.big)}번 · ${comma(st.mega)}번`],
      ['황금 복권', `${comma(st.golden)}장 (당첨 ${comma(st.goldenWins)})`],
      ['아깝다!', `${comma(st.near)}번`],
      ['최장 연속 꽝', `${comma(st.maxLoseStreak)}번`],
      ['알바 탭', `${comma(st.taps)}번`],
      ['최고 콤보', comma(st.maxCombo)],
      ['환생', `${comma(st.prestiges)}번`],
    ];
    this.body.innerHTML = `
      <h2 class="view-title">기록</h2>
      <div class="brag">
        <div><span class="muted">${this.app.auth.id}님의 최고 당첨</span><b>${st.best ? won(st.best) : '아직 없어요'}</b></div>
        <button class="btn btn-primary share-btn">${ui('share')}자랑하기</button>
      </div>
      <dl class="stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <div class="ach-head"><h3>업적</h3><span>${got}/${ACHIEVEMENTS.length}</span></div>
      <ul class="ach-list">${ACHIEVEMENTS.map((a) => `<li class="${s.ach[a.id] ? 'got' : ''}"><span class="ach-ic">${s.ach[a.id] ? ui('trophy') : ui('lock')}</span><div><b>${a.name}</b><small>${a.desc}</small></div></li>`).join('')}</ul>`;
    onTap(this.body.querySelector('.share-btn'), () => this.share());
  }

  async share() {
    const st = this.game.s.stats;
    const url = location.origin + location.pathname;
    const text = st.best
      ? `럭키 스크래치에서 ${st.bestName} 복권으로 ${won(st.best)} 당첨! (${st.bestMult}배) 나보다 크게 긁을 수 있어?`
      : '럭키 스크래치에서 알바하고 복권 긁는 중! 같이 해 보자.';
    try {
      if (navigator.share) {
        await navigator.share({ title: '럭키 스크래치', text, url });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('자랑 문구를 복사했어요. 카톡에 붙여넣어 보세요!', 'ok', 2400);
    } catch {
      toast('복사하지 못했어요. 주소창의 링크를 공유해 주세요.', 'warn');
    }
  }
}
