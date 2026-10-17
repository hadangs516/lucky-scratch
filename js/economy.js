// 게임 수치의 단일 출처.
// 게임 화면과 시뮬레이터(tools/simulate.mjs)가 같은 파일을 쓰므로 DOM에 의존하지 않는다.
// 수치를 바꾸면 `npm run sim`과 `npm run ev`로 진행 속도와 기대값을 다시 확인한다.

// ───────────────────────── 복권 ─────────────────────────
// 칸마다 그림이 하나씩 숨어 있고, 칸을 열면 그 자리에서 바로 돈이 들어온다(또는 나간다).
//   val   : 가격 × v 만큼 즉시 지급
//   mult  : 이 복권의 당첨금 전체 × k (먼저 연 칸도 소급)
//   trap  : 가격 × v 만큼 즉시 차감(함정). 함정이 있는 복권은 중간에 버릴 수 있다.
//   clover: 황금 클로버 1개(환생 화폐) 즉시 지급
//   match : 같은 그림 need개를 모으면 보너스 가격 × bonus
// 최종 배수 = (값 칸 합 + 보너스) × 배수 칸 곱 − 함정 합. 공개 순서와 상관없이 같다.
// 꽝 가중치(w0)는 tools/tune-cards.mjs가 목표 기대값(rtp)에 맞춰 푼 값이다.
export const GOLDEN = {
  baseChance: 0.02, // 황금 복권 등장 확률
  prizeMult: 2, // 황금 복권: 값 칸과 보너스 2배(함정은 그대로)
};

const v = (id, value, w, icon, tone = 0) => ({ id, kind: 'val', v: value, w, icon, tone });
const mult = (k, w) => ({ id: 'x' + k, kind: 'mult', k, w, icon: 'x' + k });
const trap = (id, value, w, icon) => ({ id, kind: 'trap', v: value, w, icon });
const clover = (w) => ({ id: 'gclover', kind: 'clover', w, icon: 'gclover' });

export const TICKETS = [
  {
    id: 't1', name: '동전 줍기', price: 1_000, cells: 6, cols: 3, unlockCost: 0, stageReq: 0, rtp: 1.05, maxMult: 20,
    blurb: '칸을 열면 동전이 바로 들어와요. 복주머니 3개면 보너스!', blank: 'dust',
    w0: 45.66,
    syms: [v('c50', 0.05, 30, 'coin', 0), v('c100', 0.1, 26, 'coin', 1), v('c200', 0.2, 16, 'coin', 2), v('c500', 0.5, 8, 'coin', 3), v('c1k', 1, 3.5, 'coin', 4), v('c2k', 2, 1.2, 'coin', 5), v('c5k', 5, 0.3, 'coin', 6), v('toad', 10, 0.25, 'toad', 6), v('pouch', 0.2, 7, 'pouch', 2)],
    match: { sym: 'pouch', need: 3, bonus: 12 },
  },
  {
    id: 't2', name: '네잎클로버', price: 6_000, cells: 8, cols: 4, unlockCost: 15_000, stageReq: 0, rtp: 1.08, maxMult: 25,
    blurb: '잎이 많을수록 큰돈! ×2 칸은 이 복권 전체를 두 배로.', blank: 'leaf',
    w0: 62.07,
    syms: [v('l1', 0.05, 30, 'leaf1', 0), v('l2', 0.1, 24, 'leaf2', 1), v('l3', 0.25, 14, 'leaf3', 2), v('bug', 0.5, 7, 'ladybug', 3), v('l5', 1, 3, 'leaf5', 4), v('rain', 8, 0.18, 'rainbow', 6), mult(2, 1.6), v('clover4', 0.25, 6, 'clover', 3)],
    match: { sym: 'clover4', need: 3, bonus: 15 },
  },
  {
    id: 't3', name: '럭키 세븐', price: 40_000, cells: 9, cols: 3, unlockCost: 120_000, stageReq: 0, rtp: 1.11, maxMult: 30,
    blurb: '과일은 조금, BAR는 많이. 7이 3개면 대박!', blank: 'reel',
    w0: 96.34,
    syms: [v('cherry', 0.05, 28, 'cherry', 0), v('lemon', 0.1, 22, 'lemon', 1), v('bell', 0.25, 13, 'bell', 2), v('bar', 0.75, 5, 'bar', 3), v('bar3', 2, 1.4, 'bar3', 5), mult(2, 1.4), v('jack', 12, 0.12, 'jackpot', 6), v('seven', 0.5, 5.5, 'seven', 4)],
    match: { sym: 'seven', need: 3, bonus: 20 },
  },
  {
    id: 't4', name: '열쇠와 금고', price: 250_000, cells: 9, cols: 3, unlockCost: 900_000, stageReq: 0, rtp: 1.14, maxMult: 40,
    blurb: '빨간 경보기는 벌금! 비치면 버려도 돼요. 열쇠 3개면 금고가 열려요.', blank: 'dust',
    w0: 80.07,
    syms: [v('coin', 0.1, 26, 'coin', 1), v('cash', 0.3, 15, 'cash', 2), v('gold', 1, 5, 'goldbar', 4), v('bag', 3, 1.2, 'moneybag', 5), v('vault', 15, 0.1, 'vault', 6), mult(2, 1), trap('alarm', 0.6, 7, 'alarm'), v('key', 0.25, 5.5, 'key', 3), clover(0.12)],
    match: { sym: 'key', need: 3, bonus: 25 },
  },
  {
    id: 't5', name: '주사위 대박', price: 1_500_000, cells: 8, cols: 4, unlockCost: 6_000_000, stageReq: 0, rtp: 1.17, maxMult: 50,
    blurb: '눈이 클수록 큰돈. ×2·×3 칸이 겹치면 폭발! 6이 3개면 보너스.', blank: 'dice0',
    w0: 86.57,
    syms: [v('d1', 0.05, 26, 'dice1', 0), v('d2', 0.1, 22, 'dice2', 1), v('d3', 0.25, 14, 'dice3', 2), v('d4', 0.5, 8, 'dice4', 3), v('d5', 1.5, 2.5, 'dice5', 4), mult(2, 1.5), mult(3, 0.5), v('dgold', 15, 0.1, 'dicegold', 6), v('d6', 0.5, 6, 'dice6', 5), clover(0.12)],
    match: { sym: 'd6', need: 3, bonus: 30 },
  },
  {
    id: 't6', name: '보석 배수', price: 10_000_000, cells: 9, cols: 3, unlockCost: 45_000_000, stageReq: 0, rtp: 1.2, maxMult: 50,
    blurb: '가짜 보석(회색)은 벌금! ×5 칸이 숨어 있어요. 다이아 3개면 보너스.', blank: 'rock',
    w0: 76.19,
    syms: [v('ruby', 0.1, 26, 'ruby', 1), v('emer', 0.3, 15, 'emerald', 2), v('sapph', 1, 5, 'sapphire', 4), mult(2, 1.4), mult(5, 0.25), trap('fake', 0.8, 5, 'fakegem'), v('crownjewel', 20, 0.08, 'crownjewel', 6), v('dia', 0.5, 5.5, 'diamond', 5), clover(0.12)],
    match: { sym: 'dia', need: 3, bonus: 30 },
  },
  {
    id: 't7', name: '황금 동전', price: 60_000_000, cells: 12, cols: 4, unlockCost: 300_000_000, stageReq: 1, rtp: 1.2, maxMult: 50,
    blurb: '12칸 동전 비! 금화 3개면 보너스, 녹슨 동전은 벌금.', blank: 'dust',
    w0: 95.6,
    syms: [v('c1', 0.05, 26, 'coin', 0), v('c2', 0.15, 20, 'coin', 2), v('c3', 0.5, 9, 'coin', 4), v('c4', 2, 1.6, 'coin', 6), mult(2, 1.2), trap('rust', 0.6, 5, 'rustcoin'), v('toad', 15, 0.1, 'toad', 6), v('gcoin', 0.4, 5, 'goldcoin', 5), clover(0.15)],
    match: { sym: 'gcoin', need: 3, bonus: 25 },
  },
  {
    id: 't8', name: '별똥별', price: 400_000_000, cells: 12, cols: 4, unlockCost: 2_200_000_000, stageReq: 2, rtp: 1.2, maxMult: 50,
    blurb: '블랙홀은 큰 벌금! 별똥별 3개면 소원 보너스.', blank: 'space',
    w0: 101.45,
    syms: [v('s1', 0.05, 26, 'star', 0), v('s2', 0.2, 18, 'star', 2), v('moon', 0.6, 8, 'moon', 4), v('planet', 2, 1.5, 'planet', 5), mult(3, 0.7), trap('hole', 1.2, 3.5, 'blackhole'), v('sun', 20, 0.08, 'sun', 6), v('comet', 0.4, 5, 'comet', 5), clover(0.15)],
    match: { sym: 'comet', need: 3, bonus: 30 },
  },
  {
    id: 't9', name: '왕관 슬롯', price: 2_500_000_000, cells: 12, cols: 4, unlockCost: 15_000_000_000, stageReq: 3, rtp: 1.2, maxMult: 50,
    blurb: '왕관 3개면 왕의 보너스! ×2 칸은 두 개까지 겹쳐요.', blank: 'reel',
    w0: 116.27,
    syms: [v('cherry', 0.05, 26, 'cherry', 0), v('bell', 0.2, 18, 'bell', 2), v('bar', 0.6, 8, 'bar', 3), v('seven', 2, 1.6, 'seven', 5), mult(2, 1.6), trap('jester', 0.8, 4, 'jester'), v('jack', 20, 0.08, 'jackpot', 6), v('crown', 0.4, 5, 'crown', 5), clover(0.15)],
    match: { sym: 'crown', need: 3, bonus: 35 },
  },
  {
    id: 't10', name: '해적 금고', price: 15_000_000_000, cells: 12, cols: 4, unlockCost: 100_000_000_000, stageReq: 4, rtp: 1.2, maxMult: 50,
    blurb: '해골은 큰 벌금, 보물은 큰돈. 지도 3장이면 보물섬 보너스!', blank: 'sand',
    w0: 95.66,
    syms: [v('coin', 0.1, 24, 'coin', 1), v('pearl', 0.4, 12, 'pearl', 3), v('chest', 2.5, 2, 'chest', 5), mult(2, 1.2), trap('skull', 1.5, 4.5, 'skull'), v('ship', 20, 0.08, 'ship', 6), v('map', 0.4, 5, 'map', 4), clover(0.18)],
    match: { sym: 'map', need: 3, bonus: 40 },
  },
  {
    id: 't11', name: '다이아 광산', price: 100_000_000_000, cells: 12, cols: 4, unlockCost: 700_000_000_000, stageReq: 5, rtp: 1.2, maxMult: 50,
    blurb: '낙석은 벌금! ×5 칸을 찾으면 광맥 대박. 다이아 3개면 보너스.', blank: 'rock',
    w0: 120.86,
    syms: [v('ore', 0.1, 24, 'ore', 1), v('gold', 0.4, 12, 'goldbar', 3), v('sapph', 1.5, 3, 'sapphire', 4), mult(2, 1.2), mult(5, 0.25), trap('rockfall', 1, 4.5, 'rockfall'), v('crownjewel', 20, 0.08, 'crownjewel', 6), v('dia', 0.5, 5, 'diamond', 5), clover(0.18)],
    match: { sym: 'dia', need: 3, bonus: 40 },
  },
];

export const TICKET_BY_ID = Object.fromEntries(TICKETS.map((t) => [t.id, t]));
export const SYM_BY_ID = (ticket, id) => ticket.syms.find((s) => s.id === id);
export const hasTraps = (ticket) => ticket.syms.some((s) => s.kind === 'trap');

// 최종 배수(가격 대비)로 연출 강도를 정한다
export function tierClass(m) {
  if (m < 0) return 'trap'; // 산 값보다 더 잃음
  if (m === 0) return 'lose';
  if (m < 1) return 'bit'; // 조금 돌려받음
  if (m < 2) return 'even'; // 본전 이상
  if (m < 5) return 'small';
  if (m < 15) return 'mid';
  if (m < 35) return 'big';
  return 'mega';
}
export const TIER_LABEL = {
  trap: '함정', lose: '꽝', bit: '조금', even: '본전', small: '당첨', mid: '중박', big: '대박', mega: '초대박',
};

// 첫 플레이 10~30분 사이 한 번, 큰 당첨(15~25배)을 보장한다(1회차 한정).
export const FORCED_WIN = { minSec: 600, maxSec: 1800, lo: 15, hi: 25 };

// 니어미스: 손해 판 중 자연 발생분에 더해 10%를 "보너스 그림 2개" 판으로 만든다.
export const NEAR_MISS_EXTRA = 0.10;

// ───────────────────────── 본업(알바) ─────────────────────────
// 탭 수입은 레벨마다 ×1.3, 비용은 ×1.45 → 갈수록 효율이 떨어져 후반엔 복권이 주 수입원이 된다.
// 설계 기준: "지금 최신 복권 1장 ≈ 탭 70~100회".
export const JOB = {
  baseTap: 10,
  growth: 1.3,
  costBase: 150,
  costGrowth: 1.45,
  rankEvery: 3, // 3레벨마다 직급 승진(호칭 변경)
};
export const JOB_RANKS = [
  '신입 알바', '주말 알바', '야간 알바', '베테랑 알바', '부매니저', '매니저',
  '부점장', '점장', '지점장', '본부장', '상무', '전무', '부사장', '사장', '회장',
];
export function jobRankIndex(level) {
  return Math.min(JOB_RANKS.length - 1, Math.floor(level / JOB.rankEvery));
}
export function jobTapBase(level) {
  return JOB.baseTap * JOB.growth ** level;
}
export function jobCost(level) {
  return roundNice(JOB.costBase * JOB.costGrowth ** level);
}

// 광클 콤보. 마지막 탭 후 timeout초 안에 다시 누르면 콤보가 이어진다.
export const COMBO = {
  timeout: 1.2,
  tiers: [
    { at: 0, mult: 1, label: '' },
    { at: 20, mult: 1.2, label: '좋아요' },
    { at: 50, mult: 1.5, label: '손이 빨라요!' },
    { at: 100, mult: 2, label: '피버 타임!' },
  ],
};
export function comboTier(count) {
  let t = COMBO.tiers[0];
  for (const x of COMBO.tiers) if (count >= x.at) t = x;
  return t;
}

// ───────────────────────── 긁개(도구) ─────────────────────────
// 단계마다 3레벨. 레벨이 오를수록 반경이 커지고, 단계가 오르면 도구가 진화한다.
// threshold: 한 칸의 이만큼만 긁으면 그 칸이 통째로 열린다.
export const TOOL_STAGES = [
  { name: '10원 동전', radius: 16, threshold: 0.5 },
  { name: '500원 동전', radius: 21, threshold: 0.45 },
  { name: '포인트 카드', radius: 27, threshold: 0.4 },
  { name: '전용 긁개', radius: 35, threshold: 0.34 },
  { name: '황금 긁개', radius: 45, threshold: 0.28 },
  { name: '전동 긁개', radius: 58, threshold: 0.2 },
];
export const TOOL_SUBLEVELS = 3;
export const TOOL_MAX_LEVEL = TOOL_STAGES.length * TOOL_SUBLEVELS - 1;
export function toolStage(level) {
  return Math.min(TOOL_STAGES.length - 1, Math.floor(level / TOOL_SUBLEVELS));
}
export function toolStats(level) {
  const st = TOOL_STAGES[toolStage(level)];
  const sub = level % TOOL_SUBLEVELS;
  return { name: st.name, stage: toolStage(level), radius: st.radius * (1 + 0.1 * sub), threshold: st.threshold };
}
export function toolCost(level) {
  return roundNice(1_500 * 2.7 ** level);
}

// ───────────────────────── 행운 부적 ─────────────────────────
// 1~15레벨: 레벨마다 꽝 칸과 함정 칸이 나올 확률(가중치)을 3%씩 줄인다(15레벨이면 45% 감소).
//   → 열리는 칸마다 돈이 나올 확률이 올라간다. 분산은 크게 늘지 않는다.
// 16레벨부터: 레벨마다 당첨금 보너스 +3% (끝없이 성장).
export const LUCK = { cutPerLevel: 0.03, cutLevels: 15, bonusPerLevel: 0.03, costBase: 3_000, growth: 2.1 };
export function luckCost(level) {
  return roundNice(LUCK.costBase * LUCK.growth ** level);
}
export function luckCut(level) {
  return LUCK.cutPerLevel * Math.min(level, LUCK.cutLevels);
}
// 행운 레벨을 반영한 칸 그림 가중치 목록 [{sym, w}]
export function cellWeights(ticket, luckLevel = 0) {
  const cut = 1 - luckCut(luckLevel);
  const out = [{ sym: { id: 'blank', kind: 'blank', icon: ticket.blank }, w: ticket.w0 * cut }];
  for (const s of ticket.syms) out.push({ sym: s, w: s.kind === 'trap' ? s.w * cut : s.w });
  return out;
}

// ───────────────────────── 도우미(자동 긁기) ─────────────────────────
// 보상은 직접 긁기와 같고 속도만 느리다. 구매는 자동화하지 않는다(쌓아둔 복권만 긁는다).
export const HELPER = {
  hireCosts: [20_000, 3_000_000, 300_000_000],
  baseTime: 18, // 한 장 긁는 데 걸리는 초
  speedGrowth: 0.85,
  minTime: 5,
  speedCostBase: 25_000,
  speedCostGrowth: 2.4,
  maxSpeedLevel: 8, // 8레벨이면 최소 시간(5초)에 도달
};
export function helperTime(speedLevel, perkLevel = 0) {
  return Math.max(HELPER.minTime * 0.9 ** perkLevel, HELPER.baseTime * HELPER.speedGrowth ** speedLevel * 0.9 ** perkLevel);
}
export function helperSpeedCost(level) {
  return roundNice(HELPER.speedCostBase * HELPER.speedCostGrowth ** level);
}

// ───────────────────────── 묶음 구매 ─────────────────────────
export const BULK = [
  { n: 1, cost: 0 },
  { n: 5, cost: 15_000 },
  { n: 10, cost: 300_000 },
  { n: 20, cost: 30_000_000 },
];

// ───────────────────────── 환생 ─────────────────────────
// stage = 지금까지 환생한 횟수. 5번째 환생이 마지막이며 그 뒤로는 무한 모드.
export const PRESTIGE = {
  maxStage: 5,
  goals: [5_000_000_000, 100_000_000_000, 1_200_000_000_000, 10_000_000_000_000, 80_000_000_000_000],
  baseClovers: 10,
};
export function prestigeGoal(stage) {
  return PRESTIGE.goals[stage] ?? Infinity;
}
export function cloversFor(peak, stage) {
  const g = prestigeGoal(stage);
  if (!(peak >= g)) return 0;
  return Math.floor(PRESTIGE.baseClovers * (1 + 0.5 * stage) * Math.sqrt(peak / g));
}
export const LIFE_NAMES = ['1회차: 알바생', '2회차: 재도전', '3회차: 단골손님', '4회차: 행운아', '5회차: 복권 마스터', '무한 모드: 전설'];

// 클로버로 사는 영구 강화
export const PERKS = [
  { id: 'job', name: '알바의 달인', desc: '탭 수입 +50%', max: 20, cost: (lv) => 2 + 2 * lv },
  { id: 'prize', name: '네잎 부적', desc: '당첨금 보너스 +5%', max: 20, cost: (lv) => 3 + 3 * lv },
  { id: 'seed', name: '비상금', desc: '환생 직후 시작 자금', max: 5, cost: (lv) => 4 + 4 * lv },
  { id: 'helper', name: '도우미 교육', desc: '도우미 속도 +10%', max: 10, cost: (lv) => 3 + 3 * lv },
  { id: 'golden', name: '황금 손', desc: '황금 복권 확률 +1%p', max: 5, cost: (lv) => 5 + 5 * lv },
  { id: 'discount', name: '단골 할인', desc: '복권 해금 비용 -5%', max: 8, cost: (lv) => 4 + 4 * lv },
  { id: 'tool', name: '손에 익은 도구', desc: '환생 후 긁개 1단계 유지', max: 3, cost: (lv) => 6 + 6 * lv },
];
export const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));
export const SEED_MONEY = [0, 20_000, 300_000, 5_000_000, 80_000_000, 1_000_000_000];

// ───────────────────────── 무한 모드: 판돈 올리기 ─────────────────────────
// 마지막 환생 뒤에만 열린다. 한 단계마다 모든 복권의 가격과 당첨금이 10배.
export const STAKE = { costBase: 5_000_000_000_000, growth: 40 };
export function stakeCost(level) {
  return roundNice(STAKE.costBase * STAKE.growth ** level);
}

// ───────────────────────── 파생 계산 ─────────────────────────
export function prizeBonus(luckLevel, perkPrize) {
  return LUCK.bonusPerLevel * Math.max(0, luckLevel - LUCK.cutLevels) + 0.05 * perkPrize;
}
export function goldenChance(perkGolden) {
  return GOLDEN.baseChance + 0.01 * perkGolden;
}
export function tapValue(jobLevel, perkJob, comboMult = 1) {
  return Math.round(jobTapBase(jobLevel) * (1 + 0.5 * perkJob) * comboMult);
}
export function unlockCost(ticket, perkDiscount) {
  return roundNice(ticket.unlockCost * (1 - 0.05 * perkDiscount));
}
export function stakeMult(stakeLevel) {
  return 10 ** stakeLevel;
}
export function ticketPrice(ticket, stakeLevel = 0) {
  return ticket.price * stakeMult(stakeLevel);
}
// 비용 표기를 깔끔하게: 유효숫자 2자리로 반올림
export function roundNice(x) {
  if (x < 100) return Math.round(x);
  const p = 10 ** (Math.floor(Math.log10(x)) - 1);
  return Math.round(x / p) * p;
}
