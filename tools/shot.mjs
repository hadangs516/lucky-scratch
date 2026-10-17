// 빠른 화면 확인: 모의 서버를 띄우고 모바일 화면으로 가입 → 알바 → 구매 → 긁기까지 진행하며 스크린샷을 남긴다.
// 사용법: node tools/shot.mjs [출력 폴더=screenshots]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startMockServer } from './mock-server.mjs';

const out = process.argv[2] || 'screenshots';
fs.mkdirSync(out, { recursive: true });
const { server, url } = await startMockServer(5180, { latency: 60 });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  // Playwright의 proxy 옵션은 localhost까지 프록시로 보내므로 크롬 플래그로 직접 지정한다
  args: process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=localhost;127.0.0.1'] : [],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true, locale: 'ko-KR' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });

try {
await page.goto(url + '/');
await page.waitForSelector('#auth .auth-form');
await page.waitForTimeout(800);
await shot('01-login');
await page.click('.seg-btn[data-mode="signup"]');
await page.fill('#auth-id', '행운의주인공');
await page.fill('#auth-pw', '0516');
await page.fill('#auth-pw2', '0516');
await shot('02-signup');
await page.click('.auth-submit');
await page.waitForSelector('#game .job-btn', { timeout: 10000 });
await page.waitForTimeout(500);
await shot('03-game-start');
const jb = await page.locator('#job-btn').boundingBox();
for (let i = 0; i < 95; i++) {
  await page.touchscreen.tap(jb.x + jb.width / 2, jb.y + jb.height / 2);
  await page.waitForTimeout(40);
}
await shot('04-after-taps');
await page.click('#buy-btn');
await page.waitForTimeout(900);
await shot('05-ticket');
const play = await page.locator('.stage-deck .t-play').boundingBox();
await page.mouse.move(play.x + 5, play.y + 5);
await page.mouse.down();
for (let y = play.y + 5; y < play.y + play.height; y += 14) {
  await page.mouse.move(play.x + play.width - 5, y, { steps: 6 });
  await page.mouse.move(play.x + 5, y + 7, { steps: 6 });
  if (y > play.y + play.height * 0.4 && y < play.y + play.height * 0.4 + 14) await shot('06-scratching');
}
await page.mouse.up();
await page.waitForTimeout(1200);
await shot('07-result');
await page.waitForTimeout(2500);
await shot('08-after');
} catch (e) {
  console.log('실패:', e.message);
  await shot('99-fail');
}
console.log(errors.length ? errors.join('\n') : '콘솔 오류 없음');
await browser.close();
server.close();
