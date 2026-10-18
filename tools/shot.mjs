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
await page.waitForSelector('#game #job-btn', { timeout: 10000 });
await page.waitForTimeout(500);
await shot('03-game-start');
// 계산대: 바코드가 선에 닿을 때 누르는 "사람"을 페이지 안에서 흉내 낸다(offset ms만큼 어긋나게)
await page.evaluate(() => {
  const el = document.getElementById('job-btn');
  const press = () => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: innerHeight - 60 }));
  press();
  window.__bot = { on: true, offset: 40 };
  const loop = () => {
    if (!window.__bot.on) return;
    const reg = window.__app.game.register;
    const now = performance.now();
    const it = reg.items.filter((x) => x.res === null).sort((a, b) => a.hit - b.hit)[0];
    if (!reg.paused && it && now >= it.hit + window.__bot.offset - 8) press();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
await page.waitForTimeout(2500);
await shot('04-register');
await page.waitForFunction(() => window.__app.game.s.money >= 1000, null, { timeout: 90000 });
const jobStats = await page.evaluate(() => { window.__bot.on = false; return { scans: window.__app.game.s.stats.taps, play: window.__app.game.s.playSec ?? null, money: window.__app.game.s.money }; });
console.log('첫 복권까지', JSON.stringify(jobStats));
await shot('04b-after-job');
await page.click('#buy-btn');
await page.waitForTimeout(900);
await shot('05-ticket');
const play = await page.locator('.stage-deck .t-play').boundingBox();
let sweeps = 0;
await page.mouse.move(play.x + 5, play.y + 5);
await page.mouse.down();
// 먼저 가볍게 한 번만 쓸어서 은박이 얇아진 모습을 찍는다
for (let y = play.y + 10; y < play.y + play.height; y += 28) {
  await page.mouse.move(play.x + play.width - 5, y, { steps: 10 });
  await page.mouse.move(play.x + 5, y + 28, { steps: 10 });
}
await shot('06-scratching-0-thin');
// 위에서 아래로 한 번 쓸어내리는 것을 1회로 센다. 다 열릴 때까지 반복
for (let pass = 0; pass < 12; pass++) {
  for (let y = play.y + 10; y < play.y + play.height; y += 28) {
    await page.mouse.move(play.x + play.width - 5, y, { steps: 10 });
    await page.mouse.move(play.x + play.width - 5, y + 14, { steps: 2 });
    await page.mouse.move(play.x + 5, y + 14, { steps: 10 });
    await page.mouse.move(play.x + 5, y + 28, { steps: 2 });
  }
  sweeps++;
  if (pass === 0) await shot('06-scratching-1');
  if (pass === 1) await shot('06-scratching-2');
  const left = await page.evaluate(() => { const sc = window.__app.shop.cur?.scratcher; return sc && !sc.done ? sc.cells.length - sc.revealed.size : 0; });
  if (!left) break;
}
await page.mouse.up();
console.log('다 열릴 때까지 전체 쓸기', sweeps, '회');
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
