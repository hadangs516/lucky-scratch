// 복권방 사장님: 상황마다 한마디씩(너무 자주 말하지 않게 간격을 둔다)
import { won } from '../format.js';
import { TICKETS } from '../economy.js';

const FACE = `<svg class="ic owner-face" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M8 18c0-9 7-14 16-14s16 5 16 14z" fill="#2d4a8a"/><rect x="6" y="16" width="36" height="5" rx="2.5" fill="#1d3466"/>
  <circle cx="24" cy="28" r="14" fill="#ffd9b0"/><circle cx="18" cy="27" r="4.2" fill="none" stroke="#2b1d14" stroke-width="1.8"/>
  <circle cx="30" cy="27" r="4.2" fill="none" stroke="#2b1d14" stroke-width="1.8"/><path d="M22.2 27h3.6" stroke="#2b1d14" stroke-width="1.8"/>
  <circle cx="18" cy="27" r="1.4" fill="#2b1d14"/><circle cx="30" cy="27" r="1.4" fill="#2b1d14"/>
  <path d="M15 35c3-2 6-2 9 0 3-2 6-2 9 0-3 3-15 3-18 0z" fill="#6b5a4a"/><circle cx="12" cy="31" r="2" fill="#ffb3a6" opacity=".7"/><circle cx="36" cy="31" r="2" fill="#ffb3a6" opacity=".7"/>
</svg>`;

const pick = (a) => a[Math.floor(Math.random() * a.length)];

const LINES = {
  hello: ['어서 와, 학생! 오늘도 한 장 긁고 가?', '복권은 긁는 맛이지. 알바비 벌어서 와!', '알바 끝났어? 행운은 부지런한 사람한테 와.'],
  firstTicket: ['첫 장이네! 은박은 두꺼우니까 여러 번 문질러야 해.', '칸마다 돈이 숨어 있어. 하나씩 열어 봐!'],
  big: ['허허, 오늘 운수 대통이구먼!', '이야, 그게 터지네! 동네에 소문나겠어.', '내가 이 장사 30년에 그런 건 처음 봐!'],
  trap: ['아이고, 함정이었네. 빨간 게 비치면 버려도 돼.', '벌금 칸은 살짝 긁어 보면 빨갛게 비쳐.', '함정은 미리 보이는 법이야. 조심조심!'],
  discard: ['잘 참았어. 버릴 줄 아는 게 고수야.', '현명하네! 함정은 피하는 게 상책이지.'],
  near: ['아깝다! 하나만 더 나왔으면…', '두 개까지 갔는데! 다음엔 될 거야.'],
  broke: ['빈털터리야? 계산대에서 좀 벌고 와!', '돈이 떨어지면 일단 알바! 그게 인생이지.'],
  unlock: (name) => [`${name} 들여놨어! 비싼 만큼 크게 터져.`, `새 복권 ${name}, 한번 긁어 볼 텐가?`],
  golden: ['오, 황금 복권이잖아! 다 두 배야.', '번쩍번쩍하네! 황금 복권은 귀하다고.'],
  clover: ['황금 클로버! 그거 환생할 때 진짜 쓸모 있어.'],
  bonus: ['세 개 다 모았네! 보너스 나간다!'],
  prestige: ['목표 달성! 환생 탭에서 다시 태어나 봐. 더 세져서 돌아올걸.'],
  tip: ['완벽 계산! 단골손님이 팁 줬네. 친절이 돈이 되는구먼.'],
};

export class Owner {
  constructor(app, host) {
    this.app = app;
    this.el = document.createElement('div');
    this.el.className = 'owner';
    this.el.hidden = true;
    this.el.innerHTML = `${FACE}<p class="owner-text" role="status"></p>`;
    host.appendChild(this.el);
    this.text = this.el.querySelector('.owner-text');
    this.last = 0;
    this.lossRun = 0;
    this.el.addEventListener('pointerdown', () => this.hide());
    const g = app.game;
    g.on('unlock', (id) => {
      const t = TICKETS.find((x) => x.id === id);
      if (t) this.say(LINES.unlock(t.name), 2);
    });
    g.on('clover', () => this.say(LINES.clover, 1));
    g.on('money', () => this.checkBroke());
    setTimeout(() => this.say(app.game.s.stats.tickets ? LINES.hello : LINES.hello.slice(0, 1), 3), 1200);
  }

  // prio가 높을수록 간격 제한을 무시한다(0: 25초, 1: 8초, 2+: 바로)
  say(lines, prio = 0) {
    const now = performance.now();
    const gap = prio >= 2 ? 0 : prio === 1 ? 8000 : 25000;
    if (now - this.last < gap) return;
    if (this.app.tab !== 'shop') return;
    this.last = now;
    this.text.textContent = Array.isArray(lines) ? pick(lines) : lines;
    this.el.hidden = false;
    this.el.classList.remove('in');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), 4200);
  }
  hide() {
    this.el.classList.remove('in');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.el.hidden = true; }, 250);
  }

  onResult(r) {
    const st = this.app.game.s.stats;
    if (st.tickets === 1) return this.say(LINES.firstTicket, 2);
    if (r.cls === 'big' || r.cls === 'mega') return this.say(LINES.big, 2);
    if (r.discard) return this.say(LINES.discard, 1);
    if (r.ev?.bonus > 0) return this.say(LINES.bonus, 1);
    if (r.ev?.traps > 0 && st.trapHits <= 3) return this.say(LINES.trap, 1);
    if (r.ev?.traps > 0) return this.say(LINES.trap, 0);
    if (r.near) return this.say(LINES.near, 0);
    if (r.it.g) return this.say(LINES.golden, 1);
    if (this.app.game.prestigeInfo().ready && !this.prestigeSaid) {
      this.prestigeSaid = true;
      return this.say(LINES.prestige, 2);
    }
  }
  checkBroke() {
    const g = this.app.game;
    if (g.s.tut < 3 || g.pendingCount() > 0) return;
    if (g.s.money < g.price('t1') && !this.brokeSaid) {
      this.brokeSaid = true;
      this.say(LINES.broke, 1);
    } else if (g.s.money >= g.price('t1') * 5) this.brokeSaid = false;
  }
  tip(amount) {
    this.say([`${LINES.tip[0]} +${won(amount)}`], 0);
  }
}
