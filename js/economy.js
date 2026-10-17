// 게임 수치의 단일 출처.
// 게임 화면과 시뮬레이터(tools/simulate.mjs)가 같은 파일을 쓰므로 DOM에 의존하지 않는다.
// 수치를 바꾸면 `npm run sim`과 `npm run ev`로 진행 속도와 기대값을 다시 확인한다.

// ───────────────────────── 복권 ─────────────────────────
// tiers: [배수, 1,000,000분율 가중치]. 나머지 확률은 꽝.
// 가중치는 tools/solve-tables.mjs로 산출했다(당첨률·기대값 목표 동시 충족).
export const WEIGHT_TOTAL = 1_000_000;

export const GOLDEN = {
  baseChance: 0.02, // 황금 복권 등장 확률
  prizeMult: 2, // 황금 복권 당첨금 배율
};

export const TICKETS = [
  {
    id: 't1', name: '동전 줍기', price: 1_000, rule: 'match3', cells: 6,
    unlockCost: 0, stageReq: 0,
    blurb: '같은 금액 3개를 찾으면 그 금액 당첨!',
    tiers: [[1, 266415], [2, 105053], [3, 60953], [5, 30701], [10, 12106], [20, 4774]],
  },
  {
    id: 't2', name: '네잎클로버', price: 6_000, rule: 'numbers', win: 2, mine: 6,
    unlockCost: 15_000, stageReq: 0,
    blurb: '내 번호가 행운 번호와 같으면 아래 금액 당첨!',
    tiers: [[1, 251369], [2, 104371], [3, 62414], [5, 32656], [10, 13559], [20, 5630]],
  },
  {
    id: 't3', name: '럭키 세븐', price: 40_000, rule: 'slot', rows: 3,
    unlockCost: 120_000, stageReq: 0,
    blurb: '한 줄에 같은 그림 3개가 나오면 당첨!',
    tiers: [[1, 237489], [2, 103717], [3, 63883], [5, 34692], [10, 15151], [25, 5068]],
  },
  {
    id: 't4', name: '열쇠와 금고', price: 250_000, rule: 'keys', cells: 9,
    unlockCost: 900_000, stageReq: 0,
    blurb: '열쇠 3개를 모으면 금고 속 금액 당첨!',
    tiers: [[1, 260168], [2, 113010], [4, 49089], [10, 16303], [20, 7082], [30, 4348]],
  },
  {
    id: 't5', name: '숫자 대결', price: 1_500_000, rule: 'beat', mine: 5,
    unlockCost: 6_000_000, stageReq: 0,
    blurb: '내 숫자가 상대 숫자보다 크면 옆 금액 당첨!',
    tiers: [[1, 266070], [2, 116166], [5, 38842], [10, 16958], [20, 7404], [30, 4560]],
  },
  {
    id: 't6', name: '보석 배수', price: 10_000_000, rule: 'gem', cells: 6,
    unlockCost: 45_000_000, stageReq: 0,
    blurb: '보석이 나온 칸의 금액 × 배수 당첨!',
    tiers: [[1, 221441], [2, 98768], [3, 61589], [5, 33970], [10, 15151], [20, 6758], [50, 2324]],
  },
  {
    id: 't7', name: '황금 동전', price: 60_000_000, rule: 'match3', cells: 9,
    unlockCost: 300_000_000, stageReq: 1,
    blurb: '9칸 중 같은 금액 3개를 찾으면 당첨!',
    tiers: [[1, 254461], [2, 114750], [4, 51746], [10, 18058], [20, 8143], [50, 2842]],
  },
  {
    id: 't8', name: '별빛 번호', price: 400_000_000, rule: 'numbers', win: 3, mine: 8,
    unlockCost: 2_200_000_000, stageReq: 2,
    blurb: '별빛 번호 3개 중 하나와 내 번호가 같으면 당첨!',
    tiers: [[1, 256287], [2, 115724], [5, 40454], [10, 18267], [25, 6385], [50, 2883]],
  },
  {
    id: 't9', name: '왕관 슬롯', price: 2_500_000_000, rule: 'slot', rows: 4,
    unlockCost: 15_000_000_000, stageReq: 3,
    blurb: '네 줄 중 한 줄이라도 같은 그림 3개면 당첨!',
    tiers: [[1, 261582], [2, 117752], [5, 40996], [15, 11570], [30, 5208], [50, 2892]],
  },
  {
    id: 't10', name: '해적 금고', price: 15_000_000_000, rule: 'keys', cells: 12,
    unlockCost: 100_000_000_000, stageReq: 4,
    blurb: '12칸에서 열쇠 3개를 모으면 금고 속 금액 당첨!',
    tiers: [[1, 247971], [2, 113401], [4, 51860], [10, 18436], [30, 5335], [50, 2997]],
  },
  {
    id: 't11', name: '다이아 대결', price: 100_000_000_000, rule: 'beat', mine: 6,
    unlockCost: 700_000_000_000, stageReq: 5,
    blurb: '내 다이아 숫자가 상대보다 크면 옆 금액 당첨!',
    tiers: [[1, 264589], [2, 117902], [5, 40500], [10, 18047], [25, 6199], [50, 2762]],
  },
];

export const TICKET_BY_ID = Object.fromEntries(TICKETS.map((t) => [t.id, t]));

// 황금 복권을 제외한 표 기대값(가격 대비 배수)
export function tableRtp(ticket) {
  return ticket.tiers.reduce((s, [m, w]) => s + m * w, 0) / WEIGHT_TOTAL;
}
export function hitRate(ticket) {
  return ticket.tiers.reduce((s, [, w]) => s + w, 0) / WEIGHT_TOTAL;
}
// 황금 복권까지 포함한 기본 기대값(업그레이드 보너스 제외)
export function baseRtp(ticket, goldenChance = GOLDEN.baseChance) {
  return tableRtp(ticket) * (1 + goldenChance * (GOLDEN.prizeMult - 1));
}

// 당첨 등급 이름(연출 강도 결정용). 배수 기준.
export function tierClass(mult) {
  if (mult <= 0) return 'lose';
  if (mult < 2) return 'even'; // 본전
  if (mult < 5) return 'small'; // 소액
  if (mult < 20) return 'mid'; // 중박
  if (mult < 50) return 'big'; // 대박
  return 'mega'; // 초대박
}
export const TIER_LABEL = {
  lose: '꽝', even: '본전', small: '당첨', mid: '중박', big: '대박', mega: '초대박',
};

// 첫 플레이 10~30분 사이 한 번, 확률 낮은 등급을 보장한다(1회차 한정).
export const FORCED_WIN = { minSec: 600, maxSec: 1800, maxMult: 25 };
export function forcedTierMult(ticket) {
  const ms = ticket.tiers.map(([m]) => m).filter((m) => m <= FORCED_WIN.maxMult);
  return Math.max(...ms);
}

// 니어미스: 꽝 판 중 자연 발생분에 더해 10%를 "아깝다" 판으로 만든다.
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
export const TOOL_STAGES = [
  { name: '10원 동전', radius: 15, threshold: 0.7 },
  { name: '500원 동전', radius: 20, threshold: 0.66 },
  { name: '포인트 카드', radius: 27, threshold: 0.62 },
  { name: '전용 긁개', radius: 35, threshold: 0.56 },
  { name: '황금 긁개', radius: 45, threshold: 0.5 },
  { name: '전동 긁개', radius: 58, threshold: 0.42 },
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
// 1~15레벨: 레벨마다 꽝 확률 2%p를 낮은 등급(앞의 3개) 당첨으로 옮긴다.
//   → 당첨이 잦아지고 기대값이 오르지만 분산은 거의 늘지 않는다(파산 위험을 키우지 않음).
// 16레벨부터: 레벨마다 당첨금 보너스 +3% (끝없이 성장).
export const LUCK = { shiftPerLevel: 0.02, shiftLevels: 15, bonusPerLevel: 0.03, costBase: 3_000, growth: 2.1 };
export function luckCost(level) {
  return roundNice(LUCK.costBase * LUCK.growth ** level);
}
export function luckShift(level) {
  return LUCK.shiftPerLevel * Math.min(level, LUCK.shiftLevels);
}
const effCache = new Map();
// 행운 레벨을 반영한 실제 확률표(정수 가중치)
export function effectiveTiers(ticket, luckLevel = 0) {
  const lv = Math.min(luckLevel, LUCK.shiftLevels);
  const key = ticket.id + ':' + lv;
  if (effCache.has(key)) return effCache.get(key);
  const shift = Math.round(luckShift(lv) * WEIGHT_TOTAL);
  const low = ticket.tiers.slice(0, 3);
  const lowSum = low.reduce((s, [, w]) => s + w, 0);
  let given = 0;
  const out = ticket.tiers.map(([m, w], i) => {
    if (i >= 3) return [m, w];
    const add = i === 2 ? shift - given : Math.round((shift * w) / lowSum);
    given += add;
    return [m, w + add];
  });
  effCache.set(key, out);
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
  goals: [3_000_000_000, 30_000_000_000, 300_000_000_000, 2_500_000_000_000, 15_000_000_000_000],
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
  return LUCK.bonusPerLevel * Math.max(0, luckLevel - LUCK.shiftLevels) + 0.05 * perkPrize;
}
// 행운·보너스·황금 복권을 모두 반영한 기대값
export function effectiveRtp(ticket, luckLevel, perkPrize, perkGolden) {
  const t = effectiveTiers(ticket, luckLevel);
  const table = t.reduce((s, [m, w]) => s + m * w, 0) / WEIGHT_TOTAL;
  const g = goldenChance(perkGolden);
  return table * (1 + g * (GOLDEN.prizeMult - 1)) * (1 + prizeBonus(luckLevel, perkPrize));
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
// 실제 지급액: 기본 당첨금 × 황금 배율 + 보너스(반올림)
export function payout(ticket, mult, golden, bonus, stakeLevel = 0) {
  const base = ticketPrice(ticket, stakeLevel) * mult * (golden ? GOLDEN.prizeMult : 1);
  const extra = Math.round(base * bonus);
  return { base, extra, total: base + extra };
}

// 확률 추첨. rng는 [0,1) 난수 함수.
export function drawTier(ticket, rng, luckLevel = 0) {
  let r = Math.floor(rng() * WEIGHT_TOTAL);
  for (const [m, w] of effectiveTiers(ticket, luckLevel)) {
    if (r < w) return m;
    r -= w;
  }
  return 0;
}

// 비용 표기를 깔끔하게: 유효숫자 2자리로 반올림
export function roundNice(x) {
  if (x < 100) return Math.round(x);
  const p = 10 ** (Math.floor(Math.log10(x)) - 1);
  return Math.round(x / p) * p;
}
