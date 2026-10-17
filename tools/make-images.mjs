// 앱 아이콘과 링크 미리보기(OG) 이미지 생성
// 사용법: node tools/make-images.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { symbol, coin } from '../js/icons.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Jua&display=swap">';

const iconHtml = (size, maskable) => `<!doctype html><html><head>${FONTS}<style>
  html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent}
  .bg{position:absolute;inset:0;border-radius:${maskable ? 0 : size * 0.22}px;background:radial-gradient(circle at 50% 35%,#e5432f,#9d2112);overflow:hidden}
  .bg::after{content:'';position:absolute;inset:${size * 0.035}px;border-radius:${maskable ? 0 : size * 0.19}px;box-shadow:inset 0 0 0 ${size * 0.02}px #ffcf3f}
  .card{position:absolute;left:50%;top:52%;width:${size * (maskable ? 0.5 : 0.62)}px;height:${size * (maskable ? 0.4 : 0.5)}px;transform:translate(-50%,-50%) rotate(-8deg);background:#fff4e2;border-radius:${size * 0.05}px;box-shadow:0 ${size * 0.03}px ${size * 0.06}px rgba(0,0,0,.35);overflow:hidden}
  .band{height:28%;background:#e9771b}
  .foil{position:absolute;left:10%;right:10%;top:40%;bottom:12%;border-radius:${size * 0.03}px;background:linear-gradient(135deg,#d9dde2,#aeb5bd 45%,#e4e7ea 55%,#9ea6af)}
  .scr{position:absolute;left:10%;top:40%;width:52%;bottom:12%;border-radius:${size * 0.03}px 0 0 ${size * 0.03}px;background:#fff;display:grid;place-items:center}
  .scr svg{width:70%;height:70%}
  .clover{position:absolute;right:${maskable ? 18 : 8}%;top:${maskable ? 16 : 7}%;width:${size * 0.24}px;height:${size * 0.24}px;filter:drop-shadow(0 ${size * 0.01}px 0 rgba(0,0,0,.3))}
  .clover svg{width:100%;height:100%}
</style></head><body><div class="bg"></div><div class="card"><div class="band"></div><div class="foil"></div><div class="scr">${coin('#f2c14e', '₩')}</div></div><div class="clover">${symbol('clover')}</div></body></html>`;

const ogHtml = `<!doctype html><html><head>${FONTS}<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{background:radial-gradient(120% 90% at 30% 20%,#3a2414,#1d120c);font-family:'Jua',sans-serif;position:relative}
  .sign{position:absolute;left:70px;top:90px;width:560px;padding:34px 30px 30px;border-radius:30px;background:linear-gradient(180deg,#c8301e,#9d2112);box-shadow:0 0 0 7px #ffcf3f,0 0 0 12px #6b1408,0 30px 60px rgba(0,0,0,.5);text-align:center}
  .t{font-family:'Black Han Sans';font-size:96px;line-height:1;color:#fff3c4;text-shadow:0 6px 0 #6b1408,0 0 30px rgba(255,220,120,.6)}
  .s{margin-top:16px;font-size:36px;color:#ffe2b0}
  .tags{position:absolute;left:70px;top:430px;display:flex;gap:14px}
  .tag{font-size:28px;color:#3a2400;background:#ffcf3f;padding:8px 20px;border-radius:999px}
  .note{position:absolute;left:72px;bottom:44px;font-size:24px;color:#cdb89c}
  .ticket{position:absolute;right:80px;top:70px;width:400px;height:480px;border-radius:22px;background:#fff1ec;transform:rotate(7deg);box-shadow:0 30px 60px rgba(0,0,0,.5);overflow:hidden}
  .tb{height:86px;background:#d7263d;color:#fff;font-size:44px;display:flex;align-items:center;padding:0 26px;gap:12px}
  .tb svg{width:52px;height:52px;background:#fff1ec;border-radius:12px}
  .grid{position:absolute;left:24px;right:24px;top:116px;bottom:80px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .c{background:#fff;border-radius:14px;display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)}
  .c svg{width:70%;height:70%}
  .f{background:linear-gradient(135deg,#d9dde2,#aeb5bd 45%,#e4e7ea 55%,#9ea6af);font-family:'Black Han Sans';font-size:54px;color:rgba(60,70,80,.35)}
  .w{box-shadow:0 0 0 5px #ffcf3f,0 0 24px rgba(255,207,63,.8);background:#fff7c7}
  .amt{position:absolute;left:0;right:0;bottom:16px;text-align:center;font-family:'Black Han Sans';font-size:44px;color:#c43b00}
  .coins span{position:absolute;width:70px;height:70px}
  .coins svg{width:100%;height:100%}
</style></head><body>
  <div class="sign"><div class="t">럭키 스크래치</div><div class="s">알바로 모은 돈, 긁는 순간 인생역전</div></div>
  <div class="tags"><span class="tag">설치 없이 바로</span><span class="tag">복권 11종</span><span class="tag">환생·무한 모드</span></div>
  <div class="note">가상 화폐만 쓰는 게임이에요 · 실제 돈·상품과 무관</div>
  <div class="ticket"><div class="tb">${symbol('seven')}럭키 세븐</div>
    <div class="grid">
      <div class="c w">${symbol('seven')}</div><div class="c w">${symbol('seven')}</div><div class="c w">${symbol('seven')}</div>
      <div class="c">${symbol('cherry')}</div><div class="c f">?</div><div class="c">${symbol('bell')}</div>
      <div class="c f">?</div><div class="c">${symbol('lemon')}</div><div class="c f">?</div>
    </div><div class="amt">+100만원 대박!</div></div>
  <div class="coins"><span style="left:600px;top:470px;transform:rotate(-20deg)">${coin('#f2c14e', '₩')}</span><span style="left:690px;top:520px;width:50px;height:50px">${coin('#f2c14e', '₩')}</span><span style="left:1110px;top:40px;width:56px;height:56px">${coin('#f2c14e', '₩')}</span></div>
</body></html>`;

const browser = await chromium.launch({ args: process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY] : [] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
async function render(html, w, h, file, transparent = true) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, file), omitBackground: transparent });
  await page.close();
  console.log('만듦:', file);
}
await render(iconHtml(192, false), 192, 192, 'icons/icon-192.png');
await render(iconHtml(512, false), 512, 512, 'icons/icon-512.png');
await render(iconHtml(512, true), 512, 512, 'icons/maskable-512.png', false);
await render(iconHtml(180, true), 180, 180, 'icons/apple-touch-icon.png', false);
await render(ogHtml, 1200, 630, 'og.png', false);
await browser.close();
