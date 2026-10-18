// 화면 갤러리: 복권 11종(덮인 상태·공개 상태)과 모든 탭·창을 모바일 크기로 찍는다.
// 사용법: node tools/gallery.mjs [출력 폴더] [가로] [세로]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startMockServer } from './mock-server.mjs';

const out = process.argv[2] || 'screenshots/gallery';
const W = Number(process.argv[3] || 390), H = Number(process.argv[4] || 780);
fs.mkdirSync(out, { recursive: true });
const { server, url } = await startMockServer(5182, { latency: 30 });
const browser = await chromium.launch({ args: process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=localhost;127.0.0.1'] : [] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);

try {
  await page.goto(url + '/');
  await page.click('.seg-btn[data-mode="signup"]');
  await page.fill('#auth-id', '갤러리');
  await page.fill('#auth-pw', '1234');
  await page.fill('#auth-pw2', '1234');
  await page.click('.auth-submit');
  await page.waitForSelector('#job-btn');
  // 튜토리얼 끝내고, 모든 복권 해금
  await page.evaluate(() => {
    const { game } = window.__app;
    game.s.tut = 4;
    game.s.stage = 5;
    game.s.money = 5e13;
    game.s.peak = 5e13;
    game.s.life.unlocked = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11'];
    game.s.life.helpers = 2;
    game.s.life.bulk = 3;
    game.s.life.tool = 9;
    game.emit('unlock');
    game.emit('money', game.s.money);
    window.__app.shop.renderPicker();
    window.__app.shop.renderQty();
  });
  await wait(300);
  const ids = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11'];
  for (const [i, id] of ids.entries()) {
    await page.evaluate(({ id, g }) => {
      const { game, shop } = window.__app;
      game.s.sel = id;
      if (shop.cur?.scratcher) shop.cur.scratcher.destroy();
      game.s.active = null;
      // 보여주기 좋은 판(배수나 보너스가 있는 판)을 찾는다
      let pick = null;
      for (let s = 1; s < 4000 && !pick; s++) {
        const it = { t: id, s: s * 7919, l: 3, g, n: false, k: 0 };
        const c = game.cardOf(it);
        const kinds = new Set(c.cells.map((x) => x.sym.kind));
        if (c.m >= 2 && c.m < 15 && kinds.has('mult') + kinds.has('trap') + kinds.has('clover') >= 1) pick = it;
      }
      game.s.stack.unshift(pick || { t: id, s: 1, l: 0, g, n: false, k: 0 });
      shop.phase = 'result';
      shop.loadNext(false);
    }, { id, g: i === 2 });
    await wait(500);
    await shot(`t${String(i + 1).padStart(2, '0')}-${id}-covered`);
    await page.evaluate(() => window.__app.shop.cur.scratcher.finish(false));
    await wait(1500);
    await shot(`t${String(i + 1).padStart(2, '0')}-${id}-result`);
  }
  // 니어미스 판
  await page.evaluate(() => {
    const { game, shop } = window.__app;
    let pick = null;
    for (let s = 1; s < 5000 && !pick; s++) {
      const it = { t: 't3', s: s * 31, l: 0, g: false, n: true, k: 0 };
      if (game.cardOf(it).near) pick = it;
    }
    game.s.stack.unshift(pick);
    shop.phase = 'result';
    shop.loadNext(false);
  });
  await wait(500);
  await page.evaluate(() => window.__app.shop.cur.scratcher.finish(false));
  await wait(1200);
  await shot('u01-near-miss');
  // 함정 복권 버리기
  await page.evaluate(() => {
    const { game, shop } = window.__app;
    let pick = null;
    for (let s = 1; s < 5000 && !pick; s++) {
      const it = { t: 't10', s: s * 13, l: 0, g: false, n: false, k: 0 };
      if (game.cardOf(it).cells.filter((c) => c.sym.kind === 'trap').length >= 2) pick = it;
    }
    game.s.stack.unshift(pick);
    shop.phase = 'result';
    shop.loadNext(false);
  });
  await wait(600);
  await page.evaluate(() => {
    const cur = window.__app.shop.cur;
    for (const c of cur.card.cells) if (c.sym.kind !== 'trap' && c.i % 3 === 0) cur.scratcher.openCell(cur.scratcher.cells.find((x) => x.id === c.i));
  });
  await wait(700);
  await shot('u02-partial-trap');
  await page.click('.t-discard');
  await wait(1200);
  await shot('u03-discard');
  // 대박 연출(보장 판)
  await page.evaluate(() => {
    const { game, shop } = window.__app;
    game.s.stack.unshift({ t: 't3', s: 4242, l: 0, g: false, n: false, f: 1, k: 0 });
    shop.phase = 'result';
    shop.loadNext(false);
  });
  await wait(500);
  await page.evaluate(() => window.__app.shop.cur.scratcher.finish(false));
  await wait(1700);
  await shot('u04-big-win');
  await wait(4500);
  // 탭들
  for (const tab of ['upgrade', 'prestige', 'records']) {
    await page.click(`.tab[data-tab="${tab}"]`);
    await wait(400);
    await shot(`v-${tab}`);
  }
  // 1회차 환생 화면(진행 중)
  await page.evaluate(() => {
    const { game } = window.__app;
    game.s.stage = 0;
    game.s.peak = 1.2e9;
    game.s.money = 1.2e9;
  });
  await page.click('.tab[data-tab="shop"]');
  await page.click('.tab[data-tab="prestige"]');
  await wait(300);
  await shot('v-prestige-stage0');
  await page.click('.tab[data-tab="shop"]');
  await wait(300);
  await page.click('#settings-btn');
  await wait(400);
  await shot('m-settings');
  await page.click('#set-help');
  await wait(400);
  await shot('m-help');
  await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
  await page.click('.odds-btn');
  await wait(400);
  await shot('m-odds');
  await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
  // 해금 창
  await page.evaluate(() => {
    const { game, shop } = window.__app;
    game.s.life.unlocked = ['t1', 't2'];
    game.s.money = 200000;
    shop.renderPicker();
    shop.showUnlock('t3');
  });
  await wait(400);
  await shot('m-unlock');
} catch (e) {
  console.log('실패:', e.message);
  await shot('zz-fail');
}
console.log(errors.length ? errors.join('\n') : '콘솔 오류 없음');
await browser.close();
server.close();
