// 모바일 화면 E2E 테스트(모의 서버 + Code.gs 실제 실행)
// 사용법: node tools/e2e.mjs [스크린샷 폴더]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startMockServer } from './mock-server.mjs';

const out = process.argv[2] || 'screenshots/e2e';
fs.mkdirSync(out, { recursive: true });
const { server, url } = await startMockServer(5183, { latency: 40 });
const browser = await chromium.launch({ args: process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=localhost;127.0.0.1'] : [] });
const device = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true };
const ctx = await browser.newContext(device);
const page = await ctx.newPage();
const errors = [];
const watch = (p) => {
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
};
watch(page);
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n, p = page) => p.screenshot({ path: `${out}/${n}.png` });
const sheet = async () => (await fetch(url + '/__mock/sheet')).json();
const toastText = (p = page) => p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
const G = (fn, arg, p = page) => p.evaluate(fn, arg);
let step = 0;
const ok = (name) => console.log(`  ✓ ${++step}. ${name}`);

async function scratchAll(p = page) {
  await p.waitForFunction(() => window.__app.shop.cur?.scratcher);
  await p.evaluate(() => window.__app.shop.cur.scratcher.finish(false));
  await p.waitForTimeout(700);
}

try {
  await page.goto(url + '/');
  await page.waitForSelector('.auth-form');

  // 1. 입력 검사
  await page.click('.seg-btn[data-mode="signup"]');
  await page.fill('#auth-id', 'abc');
  await page.fill('#auth-pw', '0042');
  await page.fill('#auth-pw2', '0042');
  await page.click('.auth-submit');
  assert.match(await page.textContent('.auth-err'), /한글만/);
  await page.fill('#auth-id', 'ㅎㅎ테스트');
  await page.click('.auth-submit');
  assert.match(await page.textContent('.auth-err'), /자음·모음/);
  await page.fill('#auth-id', '테스트 유저');
  await page.fill('#auth-pw2', '0043');
  await page.click('.auth-submit');
  assert.match(await page.textContent('.auth-err'), /확인이 달라요/);
  assert.equal(await page.inputValue('#auth-id'), '테스트유저', '공백은 자동 제거');
  await page.fill('#auth-pw', '12a4');
  assert.equal(await page.inputValue('#auth-pw'), '124', '숫자만 입력');
  ok('회원가입 입력 검사(한글만, 자음 모음, 비밀번호 확인, 숫자만)');

  // 2. 가입
  await page.fill('#auth-pw', '0042');
  await page.fill('#auth-pw2', '0042');
  await page.click('.auth-submit');
  await page.waitForSelector('#job-btn');
  let sh = await sheet();
  assert.equal(sh.rows[1][0], '테스트유저');
  assert.strictEqual(sh.rows[1][1], '0042');
  ok('가입 → 시트에 아이디·비밀번호(앞자리 0 보존) 기록');

  // 3. 중복 가입은 거절(다른 창)
  const p2 = await (await browser.newContext(device)).newPage();
  watch(p2);
  await p2.goto(url + '/');
  await p2.click('.seg-btn[data-mode="signup"]');
  await p2.fill('#auth-id', '테스트유저');
  await p2.fill('#auth-pw', '1111');
  await p2.fill('#auth-pw2', '1111');
  await p2.click('.auth-submit');
  await p2.waitForFunction(() => document.querySelector('.auth-err').textContent.length > 0);
  assert.match(await p2.textContent('.auth-err'), /이미 있는 아이디/);
  ok('중복 아이디 가입 거절');

  // 4. 알바 → 첫 복권
  const jb = await page.locator('#job-btn').boundingBox();
  let taps = 0;
  while ((await G(() => window.__app.game.s.money)) < 1000) {
    await page.touchscreen.tap(jb.x + jb.width / 2, jb.y + jb.height / 2);
    taps++;
  }
  assert.ok(taps >= 70 && taps <= 100, `첫 복권까지 ${taps}회`);
  assert.equal(await G(() => window.__app.game.s.tut), 1);
  ok(`첫 복권까지 탭 ${taps}회(70~100)`);
  // 강화 탭은 아직 잠김
  await page.click('.tab[data-tab="upgrade"]');
  assert.match(await toastText(), /첫 복권을 긁으면 열려요/);
  await page.click('#buy-btn');
  await scratchAll();
  assert.equal(await G(() => window.__app.game.s.stats.tickets), 1);
  ok('구매 → 긁기 → 결과, 강화 탭 잠금 해제 전 안내');

  // 5. 수동 저장
  await wait(1700);
  await page.click('#settings-btn');
  await page.click('#set-save');
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('저장 완료')));
  sh = await sheet();
  assert.ok(sh.rows[1][13].length > 50, '저장 데이터');
  assert.ok(sh.rows[1][2] > 0, '플레이 시간');
  await shot('01-manual-save');
  ok('설정 → 지금 저장 → "저장 완료" 표시, 시트에 데이터·플레이 시간 기록');

  // 6. 자동저장 알림
  await wait(2000);
  await G(() => window.__app.sync.saveServer('auto'));
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('자동저장 완료')));
  await shot('02-autosave');
  ok('자동저장 → "자동저장 완료" 표시');

  // 7. 오프라인 → 안내 → 복귀 시 즉시 저장
  await wait(2000);
  await page.context().setOffline(true);
  await wait(200);
  assert.equal(await page.isVisible('#net-chip'), true);
  await G(() => window.__app.sync.saveServer('auto'));
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('오프라인 상태라')));
  await shot('03-offline');
  const before = (await sheet()).calls.length;
  await G(() => { window.__app.game.s.money += 777; });
  await page.context().setOffline(false);
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('다시 연결됐어요')), null, { timeout: 8000 });
  assert.ok((await sheet()).calls.length > before, '온라인 복귀 즉시 저장 요청');
  ok('오프라인 안내 → 온라인 복귀 즉시 저장 + "다시 연결됐어요"');

  // 8. 새로고침 → 자동 로그인 → 이어하기
  const moneyBefore = await G(() => Math.floor(window.__app.game.s.money));
  await page.reload();
  await page.waitForSelector('#job-btn', { timeout: 10000 });
  await wait(300);
  const moneyAfter = await G(() => Math.floor(window.__app.game.s.money));
  assert.equal(moneyAfter, moneyBefore);
  assert.equal(await G(() => window.__app.game.s.stats.tickets), 1);
  ok('새로고침 → 자동 로그인 → 진행 그대로');

  // 9. 다른 기기 로그인 → 이 기기 저장 시 차단 창
  await p2.click('.seg-btn[data-mode="login"]');
  await p2.fill('#auth-id', '테스트유저');
  await p2.fill('#auth-pw', '0042');
  await p2.click('.auth-submit');
  await p2.waitForSelector('#job-btn');
  ok('다른 기기에서 같은 계정 로그인(앞자리 0 비밀번호)');
  await G(() => window.__app.sync.saveServer('auto'));
  await page.waitForSelector('.modal .sheet-head h2');
  assert.match(await page.textContent('.modal .sheet-head h2'), /다른 기기에서 접속/);
  await shot('04-session-lost');
  ok('앞 기기: 다음 저장에서 "다른 기기에서 접속했어요" 창');
  await page.click('.modal .btn-primary');
  await wait(1500);
  assert.equal(await page.locator('.modal').count(), 0);
  await G(() => window.__app.sync.saveServer('manual'));
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('저장 완료')));
  ok('"이 기기에서 계속하기" → 다시 저장됨');
  await p2.close();

  // 10. 강화 구매
  await G(() => { const g = window.__app.game; g.s.money = 50000; g.emit('money', g.s.money); });
  await page.click('.tab[data-tab="upgrade"]');
  await wait(300);
  const lv0 = await G(() => window.__app.game.s.life.job);
  await page.click('.up-card[data-id="job"] .btn-up');
  assert.equal(await G(() => window.__app.game.s.life.job), lv0 + 1);
  await shot('05-upgrades');
  ok('강화 탭에서 승진 구매');

  // 11. 해금 → 환생
  await page.click('.tab[data-tab="shop"]');
  await G(() => { const g = window.__app.game; g.s.money = 200000; g.emit('money', g.s.money); });
  await page.click('.pick[data-id="t2"]');
  await page.click('.modal .btn-primary');
  assert.ok(await G(() => window.__app.game.isUnlocked('t2')));
  await G(() => { const g = window.__app.game; g.s.money = 500000; g.emit('money', g.s.money); });
  await page.click('.pick[data-id="t3"]');
  await page.click('.modal .btn-primary');
  assert.ok(await G(() => window.__app.game.isUnlocked('t3')));
  ok('복권 선택 줄에서 해금(네잎클로버, 럭키 세븐)');
  await G(() => { const g = window.__app.game; g.s.money = 6e9; g.s.peak = 6e9; g.emit('money', g.s.money); });
  await page.click('.tab[data-tab="prestige"]');
  await wait(300);
  await shot('06-prestige-ready');
  await page.click('.pr-go');
  await page.click('.modal .btn-primary');
  // 인생역전 복권을 손가락으로 긁는다
  await page.waitForSelector('.rebirth .rb-play canvas');
  await wait(300);
  const rb = await page.locator('.rebirth .rb-play').boundingBox();
  await page.mouse.move(rb.x + 4, rb.y + 4);
  await page.mouse.down();
  for (let y = rb.y + 4; y < rb.y + rb.height; y += 16) {
    await page.mouse.move(rb.x + rb.width - 4, y, { steps: 4 });
    await page.mouse.move(rb.x + 4, y + 8, { steps: 4 });
  }
  await page.mouse.up();
  await wait(600);
  await shot('06b-rebirth');
  await page.waitForFunction(() => window.__app.game.s.stage === 1, null, { timeout: 5000 });
  await page.waitForSelector('.rebirth', { state: 'detached', timeout: 6000 });
  assert.ok((await G(() => window.__app.game.s.clovers)) >= 10);
  await page.click('.perk[data-id="job"] .btn-clover');
  assert.equal(await G(() => window.__app.game.s.perks.job), 1);
  await shot('07-after-prestige');
  ok('환생 → 인생역전 복권 긁기 → 클로버 지급 → 영구 강화 구매');

  // 12. 도우미가 쌓인 복권을 긁는다
  await page.click('.tab[data-tab="shop"]');
  await G(() => { const g = window.__app.game; g.s.life.helpers = 1; g.s.life.helperSpeed = 8; g.s.life.bulk = 1; g.s.qty = 5; g.s.money = 1e6; g.emit('money', g.s.money); window.__app.shop.renderQty(); window.__app.shop.renderBuy(); });
  const t0 = await G(() => window.__app.game.s.stats.helperTickets);
  await page.click('#buy-btn');
  await wait(5600);
  assert.ok((await G(() => window.__app.game.s.stats.helperTickets)) > t0, '도우미가 1장 이상 긁음');
  await shot('08-helper');
  ok('도우미 자동 긁기');

  // 13. 로그아웃 → 잘못된 비밀번호 → 다시 로그인
  await page.click('#settings-btn');
  await page.click('#set-logout');
  await page.click('.modal .btn-danger');
  await page.waitForSelector('.auth-form', { timeout: 10000 });
  assert.equal(await G(() => localStorage.getItem('luckyScratch.auth')), null);
  await page.fill('#auth-id', '테스트유저');
  await page.fill('#auth-pw', '0041');
  await page.click('.auth-submit');
  await page.waitForFunction(() => document.querySelector('.auth-err').textContent.includes('비밀번호'));
  await page.fill('#auth-pw', '0042');
  await page.click('.auth-submit');
  await page.waitForSelector('#job-btn');
  assert.equal(await G(() => window.__app.game.s.stage), 1);
  ok('로그아웃 → 틀린 비밀번호 거절 → 다시 로그인하면 환생 상태 유지');

  // 14. 다른 화면 크기
  for (const [w, h] of [[360, 640], [414, 896], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    await wait(400);
    const overflow = await G(() => document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth);
    assert.equal(overflow, false, `${w}x${h} 가로 넘침`);
    await shot(`09-size-${w}x${h}`);
  }
  ok('320~414px 화면에서 가로 넘침 없음');

  assert.deepEqual(errors, [], '콘솔 오류');
  ok('콘솔 오류 없음');
  console.log('E2E 통과');
} catch (e) {
  console.log('E2E 실패:', e.message);
  console.log(errors.join('\n'));
  await shot('zz-fail');
  process.exitCode = 1;
}
await browser.close();
server.close();
