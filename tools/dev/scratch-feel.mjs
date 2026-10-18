import { chromium } from 'playwright';
import { startMockServer } from '../mock-server.mjs';
const { server, url } = await startMockServer(5191, { latency: 10 });
const browser = await chromium.launch({ args: ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=localhost;127.0.0.1'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(url + '/');
await page.click('.seg-btn[data-mode="signup"]');
await page.fill('#auth-id', '디버그'); await page.fill('#auth-pw', '1234'); await page.fill('#auth-pw2', '1234');
await page.click('.auth-submit');
await page.waitForSelector('#job-btn');
const toolLv = Number(process.argv[2] || 0), tk = process.argv[3] || 't1';
await page.evaluate(([lv, tk]) => { const g = window.__app.game; g.s.money = 1e12; g.s.tut = 5; g.s.life.tool = lv; g.s.life.unlocked = ['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10','t11']; g.s.sel = tk; window.__app.shop.renderBuy(); }, [toolLv, tk]);
await page.click('#buy-btn');
await page.waitForTimeout(800);
const play = await page.locator('.stage-deck .t-play').boundingBox();
const t0 = Date.now();
let sweeps = 0;
await page.mouse.move(play.x + 5, play.y + 5);
await page.mouse.down();
await page.waitForTimeout(50);
const r = await page.evaluate(() => window.__app.shop.cur.scratcher.opts.radius);
let dist = 0;
// 한 번 쓸기 = 은박 전체를 붓 폭(2r) 간격의 가로줄로 한 번씩 덮기(겹치지 않게)
for (let pass = 0; pass < 12; pass++) {
  const off = (pass % 2) * r; // 다음 쓸기는 반 칸 어긋나게
  let dir = 0;
  for (let y = play.y + r * 0.6 + off * 0.5; y < play.y + play.height; y += 2 * r) {
    const x0 = dir ? play.x + play.width - 5 : play.x + 5;
    await page.mouse.move(x0, y, { steps: 3 }); // 줄 끝에서 아래로
    await page.mouse.move(dir ? play.x + 5 : play.x + play.width - 5, y, { steps: Math.ceil(play.width / 12) });
    dist += play.width;
    dir ^= 1;
  }
  sweeps++;
  const st = await page.evaluate(() => { const sc = window.__app.shop.cur?.scratcher; return sc ? sc.cells.map((c) => [c.id, sc.revealed.has(c.id), +(c.left / c.total).toFixed(2), Math.round(c.y), Math.round(c.h)]) : null; });
  if (process.env.V) console.log('pass', pass, JSON.stringify(st));
  if (!st || st.every((x) => x[1])) break;
}
await page.mouse.up();
console.log(tk, 'tool', toolLv, 'r', r.toFixed(1), 'sweeps', sweeps, 'dist', Math.round(dist), 'px', 'time@1000px/s', (dist / 1000).toFixed(1) + 's');
await browser.close(); server.close();
