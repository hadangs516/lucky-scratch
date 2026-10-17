// 장시간 플레이 테스트: 실제 화면을 사람처럼 조작(알바 연타 → 구매 → 손으로 긁기 → 강화·해금)하며
// 오류·이상 상태(NaN, 음수 돈, 멈춘 화면)를 찾는다.
// 사용법: node tools/soak.mjs [분=4] [스크린샷 폴더]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startMockServer } from './mock-server.mjs';

const minutes = Number(process.argv[2] || 4);
const out = process.argv[3] || 'screenshots/soak';
fs.mkdirSync(out, { recursive: true });
const { server, url } = await startMockServer(5185, { latency: 50 });
const browser = await chromium.launch({ args: process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=localhost;127.0.0.1'] : [] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const G = (fn, a) => page.evaluate(fn, a);

await page.goto(url + '/');
await page.click('.seg-btn[data-mode="signup"]');
await page.fill('#auth-id', '오래하기');
await page.fill('#auth-pw', '7777');
await page.fill('#auth-pw2', '7777');
await page.click('.auth-submit');
await page.waitForSelector('#job-btn');

const end = Date.now() + minutes * 60_000;
const stats = { taps: 0, buys: 0, scratched: 0, upgrades: 0, unlocks: 0, loops: 0 };
let shotN = 0;
while (Date.now() < end) {
  stats.loops++;
  await page.evaluate(() => document.querySelectorAll('.celebrate').forEach((c) => c.dispatchEvent(new PointerEvent('pointerdown'))));
  const s = await G(() => {
    const { game, shop } = window.__app;
    return { money: game.s.money, phase: shop.phase, stack: game.s.stack.length, sel: game.s.sel, tut: game.s.tut, modal: document.querySelectorAll('.modal').length };
  });
  if (!Number.isFinite(s.money) || s.money < 0) { errors.push('이상한 돈: ' + s.money); break; }
  if (s.modal) { await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove())); continue; }
  if (s.phase === 'scratch') {
    // 손으로 긁기
    const box = await page.locator('.stage-deck .t-play').boundingBox().catch(() => null);
    if (box) {
      await page.mouse.move(box.x + 4, box.y + 4);
      await page.mouse.down();
      for (let y = box.y + 4; y < box.y + box.height; y += 18) {
        await page.mouse.move(box.x + box.width - 4, y, { steps: 3 });
        await page.mouse.move(box.x + 4, y + 9, { steps: 3 });
      }
      await page.mouse.up();
      stats.scratched++;
      await page.waitForTimeout(500);
    }
    continue;
  }
  // 강화·해금(가끔)
  if (stats.loops % 4 === 0) {
    const did = await G(() => {
      const { game, shop } = window.__app;
      let n = 0, u = 0;
      const next = game.nextGoal();
      if (next?.kind === 'unlock' && game.s.money >= next.cost) { if (game.unlock(next.id)) { u++; shop.renderPicker(); } }
      for (const up of game.upgrades()) if (up.can && up.cost < game.s.money * 0.4 && game.buyUpgrade(up.id)) n++;
      return [n, u];
    });
    stats.upgrades += did[0];
    stats.unlocks += did[1];
  }
  const canBuy = await G(() => { const g = window.__app.game; const top = g.s.life.unlocked.at(-1); g.s.sel = g.price(top) * 2 <= g.s.money ? top : g.s.sel; return g.canBuy(g.s.sel, g.s.qty).ok; });
  if (canBuy) {
    await page.click('#buy-btn');
    stats.buys++;
    await page.waitForTimeout(300);
  } else {
    const jb = await page.locator('#job-btn').boundingBox();
    for (let i = 0; i < 25; i++) await page.touchscreen.tap(jb.x + jb.width / 2, jb.y + jb.height / 2);
    stats.taps += 25;
  }
  if (stats.loops % 60 === 0) await page.screenshot({ path: `${out}/soak-${String(++shotN).padStart(2, '0')}.png` });
}
const final = await G(() => { const g = window.__app.game; return { money: Math.floor(g.s.money), unlocked: g.s.life.unlocked, job: g.s.life.job, tickets: g.s.stats.tickets, wins: g.s.stats.wins, near: g.s.stats.near, play: Math.floor(g.s.playSec) }; });
await page.screenshot({ path: `${out}/soak-final.png` });
console.log(JSON.stringify({ stats, final }));
console.log(errors.length ? '오류:\n' + errors.join('\n') : '오류 없음');
await browser.close();
server.close();
process.exitCode = errors.length ? 1 : 0;
