// SVG 아이콘·심볼. 기기마다 모양이 다른 이모지 대신 직접 그린다. viewBox 0 0 48 48.
const svg = (body, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`;

// 등급 색(낮음 → 높음)
export const TIER_COLORS = ['#c58b52', '#b9c3cc', '#f2c14e', '#62d2a2', '#5aa9ff', '#ff6fb1', '#ff5a36'];

export function coin(color = '#f2c14e', label = '') {
  return svg(`<circle cx="24" cy="24" r="20" fill="${color}"/>
  <circle cx="24" cy="24" r="15.5" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2.5"/>
  <path d="M14 17a14 14 0 0 1 12-7" stroke="rgba(255,255,255,.55)" stroke-width="3" fill="none" stroke-linecap="round"/>
  ${label ? `<text x="24" y="29.5" text-anchor="middle" font-size="15" font-weight="900" fill="rgba(0,0,0,.45)" font-family="sans-serif">${label}</text>` : ''}`);
}

const SYMBOLS = {
  cherry: `<path d="M24 8c-2 8-8 13-12 17M24 8c3 7 8 12 13 15" stroke="#3f8f3a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M24 8c4-3 10-3 13 0-4 3-9 3-13 0z" fill="#58b84f"/><circle cx="13" cy="31" r="9" fill="#e23a3a"/><circle cx="35" cy="29" r="9" fill="#d12d4a"/><circle cx="10" cy="28" r="2.5" fill="#fff" opacity=".6"/><circle cx="32" cy="26" r="2.5" fill="#fff" opacity=".6"/>`,
  lemon: `<ellipse cx="24" cy="25" rx="17" ry="13" fill="#ffd93b" transform="rotate(-20 24 25)"/><path d="M9 32l-3 3M39 18l3-3" stroke="#e7b400" stroke-width="4" stroke-linecap="round"/><ellipse cx="19" cy="20" rx="5" ry="3" fill="#fff" opacity=".45" transform="rotate(-20 19 20)"/>`,
  bell: `<path d="M24 7c-8 0-12 6-12 14v8l-5 6h34l-5-6v-8c0-8-4-14-12-14z" fill="#ffc531" stroke="#c98e00" stroke-width="2"/><circle cx="24" cy="38" r="4" fill="#c98e00"/><path d="M17 15c2-3 4-4 7-4" stroke="#fff" stroke-width="3" opacity=".6" fill="none" stroke-linecap="round"/>`,
  horseshoe: `<path d="M12 10v14a12 12 0 0 0 24 0V10" stroke="#9aa7b4" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M12 10v14a12 12 0 0 0 24 0V10" stroke="#d7dee6" stroke-width="2.5" fill="none" stroke-linecap="round"/><g fill="#5d6873"><circle cx="12" cy="16" r="1.6"/><circle cx="36" cy="16" r="1.6"/><circle cx="14" cy="27" r="1.6"/><circle cx="34" cy="27" r="1.6"/></g>`,
  bar: `<rect x="5" y="14" width="38" height="20" rx="4" fill="#2b2b38"/><rect x="7" y="16" width="34" height="16" rx="3" fill="none" stroke="#ffc531" stroke-width="2"/><text x="24" y="29" text-anchor="middle" font-size="13" font-weight="900" fill="#ffc531" font-family="sans-serif" letter-spacing="1">BAR</text>`,
  seven: `<path d="M10 9h28v6L24 40h-9l13-24H10z" fill="#e5432f" stroke="#8f1d10" stroke-width="2.5" stroke-linejoin="round"/><path d="M13 12h20" stroke="#ffb3a6" stroke-width="2" stroke-linecap="round"/>`,
  crown: `<path d="M7 35l-2-20 10 8 9-14 9 14 10-8-2 20z" fill="#ffc531" stroke="#b37a00" stroke-width="2.5" stroke-linejoin="round"/><rect x="7" y="35" width="34" height="6" rx="2" fill="#e0a400"/><circle cx="24" cy="26" r="3.5" fill="#e5432f"/><circle cx="14" cy="29" r="2.5" fill="#5aa9ff"/><circle cx="34" cy="29" r="2.5" fill="#5aa9ff"/>`,
  key: `<circle cx="15" cy="17" r="9" fill="none" stroke="#e6b422" stroke-width="5"/><path d="M21 23l17 17M31 33l4-4M35 37l4-4" stroke="#e6b422" stroke-width="5" stroke-linecap="round"/><circle cx="15" cy="17" r="9" fill="none" stroke="#fff3b0" stroke-width="1.5" opacity=".7"/>`,
  coin: `<circle cx="24" cy="24" r="17" fill="#f2c14e" stroke="#b9870e" stroke-width="2.5"/><text x="24" y="30" text-anchor="middle" font-size="17" font-weight="900" fill="#9a6e06" font-family="sans-serif">₩</text>`,
  star: `<path d="M24 5l5.6 12.2 13.4 1.4-10 9 2.8 13.2L24 34.2l-11.8 6.6L15 27.6l-10-9 13.4-1.4z" fill="#ffd84a" stroke="#c99500" stroke-width="2" stroke-linejoin="round"/>`,
  clover: `<g fill="#3aa655"><circle cx="17" cy="17" r="8"/><circle cx="31" cy="17" r="8"/><circle cx="17" cy="31" r="8"/><circle cx="31" cy="31" r="8"/></g><path d="M24 24l8 16" stroke="#2c7d40" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="3" fill="#2c7d40"/>`,
  heart: `<path d="M24 41S6 30 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 12-18 23-18 23z" fill="#ff5c8a" stroke="#c42d5a" stroke-width="2"/>`,
  gem: `<path d="M12 8h24l8 11-20 23L4 19z" fill="#31d1e0" stroke="#0b7f8a" stroke-width="2" stroke-linejoin="round"/><path d="M4 19h40M12 8l6 11 6-11 6 11 6-11M18 19l6 23 6-23" stroke="#0b7f8a" stroke-width="1.6" fill="none"/><path d="M14 11l3 6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`,
  pearl: `<circle cx="24" cy="25" r="15" fill="#f4eef8" stroke="#b6a6c7" stroke-width="2"/><circle cx="19" cy="20" r="5" fill="#fff"/>`,
  ring: `<circle cx="24" cy="29" r="12" fill="none" stroke="#d9b45a" stroke-width="5"/><path d="M18 14l6-7 6 7-6 5z" fill="#c9cfd8" stroke="#8b93a0" stroke-width="1.5"/>`,
  vault: `<rect x="5" y="9" width="38" height="31" rx="4" fill="#5b6675" stroke="#2f3742" stroke-width="2.5"/><circle cx="24" cy="24.5" r="9" fill="#8a96a6" stroke="#2f3742" stroke-width="2"/><path d="M24 17.5v14M17 24.5h14" stroke="#2f3742" stroke-width="2.5"/><rect x="9" y="40" width="6" height="3" fill="#2f3742"/><rect x="33" y="40" width="6" height="3" fill="#2f3742"/>`,
  diamond: `<path d="M24 4l16 20-16 20L8 24z" fill="#9ae6ff" stroke="#2b8fb5" stroke-width="2"/><path d="M8 24h32M24 4v40" stroke="#2b8fb5" stroke-width="1.2"/>`,
  // ── 칸 복권 그림 ──
  dust: `<g fill="#b7aa95" opacity=".55"><circle cx="16" cy="28" r="3"/><circle cx="26" cy="22" r="2.2"/><circle cx="32" cy="31" r="2.6"/><circle cx="21" cy="34" r="1.6"/></g>`,
  leaf: `<path d="M12 36c0-14 10-24 24-24 0 14-10 24-24 24z" fill="#a9c9a0" opacity=".55"/>`,
  reel: `<rect x="10" y="12" width="28" height="24" rx="5" fill="#d9d2c4" opacity=".5"/><path d="M14 24h20" stroke="#b9ae9b" stroke-width="2" opacity=".6"/>`,
  dice0: `<rect x="9" y="9" width="30" height="30" rx="7" fill="#e6e0d6" opacity=".6"/>`,
  rock: `<path d="M8 34l6-14 10-6 12 4 5 12-6 6H12z" fill="#9b958c" opacity=".55"/>`,
  space: `<g fill="#9aa3c8" opacity=".5"><circle cx="15" cy="16" r="1.6"/><circle cx="33" cy="22" r="1.2"/><circle cx="24" cy="33" r="1.8"/><circle cx="36" cy="36" r="1"/></g>`,
  sand: `<path d="M6 34c8-6 14-6 20-2s12 4 16 0v8H6z" fill="#e2c98f" opacity=".6"/>`,
  pouch: `<path d="M16 16c-6 6-9 12-9 17 0 6 7 9 17 9s17-3 17-9c0-5-3-11-9-17z" fill="#e5432f" stroke="#8f1d10" stroke-width="2"/><path d="M15 12h18l-3 5H18z" fill="#c22e1c"/><path d="M14 17h20" stroke="#ffc531" stroke-width="3" stroke-linecap="round"/><text x="24" y="35" text-anchor="middle" font-size="13" font-weight="900" fill="#ffd84a" font-family="sans-serif">福</text>`,
  toad: `<ellipse cx="24" cy="29" rx="17" ry="12" fill="#e8b923" stroke="#9c6f00" stroke-width="2"/><circle cx="15" cy="17" r="6" fill="#e8b923" stroke="#9c6f00" stroke-width="2"/><circle cx="33" cy="17" r="6" fill="#e8b923" stroke="#9c6f00" stroke-width="2"/><circle cx="15" cy="17" r="2.6" fill="#3a2400"/><circle cx="33" cy="17" r="2.6" fill="#3a2400"/><circle cx="24" cy="31" r="5" fill="#fff3b0" stroke="#9c6f00" stroke-width="1.5"/><path d="M14 27c3 3 17 3 20 0" stroke="#9c6f00" stroke-width="2" fill="none"/>`,
  leaf1: `<path d="M24 40V22" stroke="#2c7d40" stroke-width="3"/><ellipse cx="24" cy="16" rx="7" ry="9" fill="#7ccf6f"/>`,
  leaf2: `<path d="M24 40V24" stroke="#2c7d40" stroke-width="3"/><ellipse cx="17" cy="18" rx="7" ry="8" fill="#5fbf55"/><ellipse cx="31" cy="18" rx="7" ry="8" fill="#5fbf55"/>`,
  leaf3: `<path d="M24 41V27" stroke="#2c7d40" stroke-width="3"/><g fill="#45ad4b"><circle cx="24" cy="13" r="7.5"/><circle cx="16" cy="25" r="7.5"/><circle cx="32" cy="25" r="7.5"/></g>`,
  leaf5: `<g fill="#2f9e4f"><circle cx="24" cy="11" r="7"/><circle cx="13" cy="20" r="7"/><circle cx="35" cy="20" r="7"/><circle cx="17" cy="33" r="7"/><circle cx="31" cy="33" r="7"/></g><circle cx="24" cy="23" r="4" fill="#ffd84a"/>`,
  ladybug: `<circle cx="24" cy="27" r="14" fill="#e23a3a"/><path d="M24 13v28" stroke="#2b1d14" stroke-width="2"/><circle cx="24" cy="12" r="6" fill="#2b1d14"/><g fill="#2b1d14"><circle cx="17" cy="23" r="3"/><circle cx="31" cy="23" r="3"/><circle cx="18" cy="33" r="2.6"/><circle cx="30" cy="33" r="2.6"/></g>`,
  rainbow: `<path d="M6 36a18 18 0 0 1 36 0" stroke="#e5432f" stroke-width="4" fill="none"/><path d="M10 36a14 14 0 0 1 28 0" stroke="#ffc531" stroke-width="4" fill="none"/><path d="M14 36a10 10 0 0 1 20 0" stroke="#3aa655" stroke-width="4" fill="none"/><path d="M18 36a6 6 0 0 1 12 0" stroke="#5aa9ff" stroke-width="4" fill="none"/>`,
  bar3: `<g><rect x="6" y="6" width="36" height="11" rx="3" fill="#2b2b38"/><rect x="6" y="19" width="36" height="11" rx="3" fill="#2b2b38"/><rect x="6" y="32" width="36" height="11" rx="3" fill="#2b2b38"/></g><g font-size="8" font-weight="900" fill="#ffc531" font-family="sans-serif" text-anchor="middle"><text x="24" y="14.5">BAR</text><text x="24" y="27.5">BAR</text><text x="24" y="40.5">BAR</text></g>`,
  jackpot: `<circle cx="24" cy="24" r="19" fill="#ffd84a" stroke="#b37a00" stroke-width="2.5"/><circle cx="24" cy="24" r="14" fill="#e5432f"/><text x="24" y="31" text-anchor="middle" font-size="18" font-weight="900" fill="#fff3b0" font-family="sans-serif">777</text>`,
  cash: `<rect x="5" y="13" width="38" height="22" rx="3" fill="#7cc58a" stroke="#2e7a3e" stroke-width="2"/><circle cx="24" cy="24" r="6" fill="#bfe8c5" stroke="#2e7a3e" stroke-width="1.5"/><text x="24" y="28" text-anchor="middle" font-size="9" font-weight="900" fill="#2e7a3e" font-family="sans-serif">₩</text>`,
  goldbar: `<path d="M6 34l6-16h24l6 16z" fill="#f2c14e" stroke="#a87a00" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 18l3 6h18l3-6" fill="none" stroke="#fff3b0" stroke-width="2"/>`,
  moneybag: `<path d="M18 14c-8 6-12 13-12 19 0 7 8 9 18 9s18-2 18-9c0-6-4-13-12-19z" fill="#d9a441" stroke="#8a5a10" stroke-width="2"/><path d="M17 8l7 6 7-6" fill="none" stroke="#8a5a10" stroke-width="3" stroke-linejoin="round"/><text x="24" y="36" text-anchor="middle" font-size="15" font-weight="900" fill="#6a4300" font-family="sans-serif">₩</text>`,
  alarm: `<path d="M12 36V24a12 12 0 0 1 24 0v12z" fill="#e5432f" stroke="#7c1609" stroke-width="2.5"/><rect x="8" y="36" width="32" height="5" rx="2" fill="#4a1a10"/><path d="M5 14l5 3M43 14l-5 3M24 4v5" stroke="#ff7a5a" stroke-width="3" stroke-linecap="round"/><circle cx="19" cy="24" r="3" fill="#ffb3a6"/>`,
  dice1: `<rect x="7" y="7" width="34" height="34" rx="8" fill="#fff" stroke="#9c8f7c" stroke-width="2"/><circle cx="24" cy="24" r="4.5" fill="#e5432f"/>`,
  dice2: `<rect x="7" y="7" width="34" height="34" rx="8" fill="#fff" stroke="#9c8f7c" stroke-width="2"/><g fill="#2b1d14"><circle cx="16" cy="16" r="3.6"/><circle cx="32" cy="32" r="3.6"/></g>`,
  dice3: `<rect x="7" y="7" width="34" height="34" rx="8" fill="#fff" stroke="#9c8f7c" stroke-width="2"/><g fill="#2b1d14"><circle cx="16" cy="16" r="3.6"/><circle cx="24" cy="24" r="3.6"/><circle cx="32" cy="32" r="3.6"/></g>`,
  dice4: `<rect x="7" y="7" width="34" height="34" rx="8" fill="#fff" stroke="#9c8f7c" stroke-width="2"/><g fill="#2b1d14"><circle cx="16" cy="16" r="3.6"/><circle cx="32" cy="16" r="3.6"/><circle cx="16" cy="32" r="3.6"/><circle cx="32" cy="32" r="3.6"/></g>`,
  dice5: `<rect x="7" y="7" width="34" height="34" rx="8" fill="#fff" stroke="#9c8f7c" stroke-width="2"/><g fill="#2b1d14"><circle cx="16" cy="16" r="3.6"/><circle cx="32" cy="16" r="3.6"/><circle cx="24" cy="24" r="3.6"/><circle cx="16" cy="32" r="3.6"/><circle cx="32" cy="32" r="3.6"/></g>`,
  dice6: `<rect x="7" y="7" width="34" height="34" rx="8" fill="#6b3fa0" stroke="#3a1f5c" stroke-width="2"/><g fill="#fff"><circle cx="16" cy="15" r="3.4"/><circle cx="32" cy="15" r="3.4"/><circle cx="16" cy="24" r="3.4"/><circle cx="32" cy="24" r="3.4"/><circle cx="16" cy="33" r="3.4"/><circle cx="32" cy="33" r="3.4"/></g>`,
  dicegold: `<rect x="7" y="7" width="34" height="34" rx="8" fill="#ffd84a" stroke="#a87a00" stroke-width="2.5"/><g fill="#a87a00"><circle cx="16" cy="15" r="3.4"/><circle cx="32" cy="15" r="3.4"/><circle cx="16" cy="24" r="3.4"/><circle cx="32" cy="24" r="3.4"/><circle cx="16" cy="33" r="3.4"/><circle cx="32" cy="33" r="3.4"/></g><path d="M11 11l6 6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  ruby: `<path d="M24 6l14 12-14 24L10 18z" fill="#e23a5a" stroke="#8a1030" stroke-width="2" stroke-linejoin="round"/><path d="M10 18h28M24 6v36" stroke="#8a1030" stroke-width="1.2" opacity=".6"/>`,
  emerald: `<path d="M15 6h18l8 9v18l-8 9H15l-8-9V15z" fill="#2fbf71" stroke="#156b3d" stroke-width="2" stroke-linejoin="round"/><rect x="16" y="15" width="16" height="18" fill="#62d99a" opacity=".7"/>`,
  sapphire: `<path d="M12 8h24l8 11-20 23L4 19z" fill="#3a6fe0" stroke="#173a8a" stroke-width="2" stroke-linejoin="round"/><path d="M4 19h40M18 19l6 23 6-23" stroke="#173a8a" stroke-width="1.5" fill="none" opacity=".7"/><path d="M14 11l3 6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`,
  crownjewel: `<path d="M7 33l-2-18 10 7 9-13 9 13 10-7-2 18z" fill="#ffc531" stroke="#b37a00" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 22l6 7-6 9-6-9z" fill="#31d1e0" stroke="#0b7f8a" stroke-width="1.5"/><rect x="7" y="33" width="34" height="6" rx="2" fill="#e0a400"/>`,
  fakegem: `<path d="M12 8h24l8 11-20 23L4 19z" fill="#9aa0a8" stroke="#5c626b" stroke-width="2" stroke-linejoin="round"/><path d="M14 16l20 18M34 16L14 34" stroke="#e5432f" stroke-width="3.5" stroke-linecap="round"/>`,
  goldcoin: `<circle cx="24" cy="24" r="19" fill="#ffd84a" stroke="#a87a00" stroke-width="2.5"/><circle cx="24" cy="24" r="13" fill="none" stroke="#a87a00" stroke-width="2"/><path d="M24 15l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.5-4 6-.6z" fill="#a87a00"/>`,
  rustcoin: `<circle cx="24" cy="24" r="17" fill="#8a5a3c" stroke="#4a2a18" stroke-width="2.5"/><g fill="#5a3420"><circle cx="17" cy="19" r="3"/><circle cx="29" cy="28" r="4"/><circle cx="20" cy="31" r="2"/></g><path d="M12 12l24 24" stroke="#e5432f" stroke-width="3" stroke-linecap="round"/>`,
  moon: `<path d="M30 6a18 18 0 1 0 12 28A15 15 0 0 1 30 6z" fill="#ffe8a3" stroke="#c9a54a" stroke-width="2"/>`,
  planet: `<circle cx="24" cy="24" r="12" fill="#ff9f40" stroke="#b35a00" stroke-width="2"/><ellipse cx="24" cy="25" rx="21" ry="6" fill="none" stroke="#ffd84a" stroke-width="3" transform="rotate(-18 24 25)"/>`,
  blackhole: `<circle cx="24" cy="24" r="18" fill="#1b1036"/><circle cx="24" cy="24" r="18" fill="none" stroke="#8a4dff" stroke-width="3" stroke-dasharray="6 4"/><circle cx="24" cy="24" r="7" fill="#000"/><path d="M8 24c6-4 12-4 16 0s10 4 16 0" stroke="#c49bff" stroke-width="2" fill="none"/>`,
  comet: `<path d="M8 40L30 18" stroke="#9ae6ff" stroke-width="6" stroke-linecap="round" opacity=".55"/><path d="M14 40L32 22" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/><circle cx="33" cy="15" r="9" fill="#ffd84a" stroke="#c99500" stroke-width="2"/>`,
  sun: `<g stroke="#ff9f40" stroke-width="3.5" stroke-linecap="round"><path d="M24 3v7M24 38v7M3 24h7M38 24h7M9 9l5 5M34 34l5 5M9 39l5-5M34 14l5-5"/></g><circle cx="24" cy="24" r="11" fill="#ffd84a" stroke="#e08a00" stroke-width="2"/>`,
  jester: `<path d="M8 20l8-12 8 10 8-10 8 12-6 6H14z" fill="#8e1b2c" stroke="#4a0a12" stroke-width="2"/><circle cx="24" cy="31" r="10" fill="#ffe2c4" stroke="#7a4a2a" stroke-width="2"/><path d="M19 33c3 3 7 3 10 0" stroke="#7a1d1d" stroke-width="2" fill="none"/><circle cx="20" cy="29" r="1.5" fill="#2b1d14"/><circle cx="28" cy="29" r="1.5" fill="#2b1d14"/>`,
  chest: `<rect x="6" y="20" width="36" height="20" rx="3" fill="#a0642b" stroke="#5a3410" stroke-width="2.5"/><path d="M6 20c0-8 8-12 18-12s18 4 18 12z" fill="#c07a36" stroke="#5a3410" stroke-width="2.5"/><rect x="21" y="18" width="6" height="9" rx="1.5" fill="#ffd84a" stroke="#8a5a10" stroke-width="1.5"/><path d="M10 14l4 4M38 14l-4 4" stroke="#ffd84a" stroke-width="2.5" stroke-linecap="round"/>`,
  skull: `<path d="M24 6c-10 0-16 7-16 15 0 5 3 9 6 11v6h20v-6c3-2 6-6 6-11 0-8-6-15-16-15z" fill="#efe8dc" stroke="#5a5048" stroke-width="2.5"/><circle cx="18" cy="22" r="4.5" fill="#2b1d14"/><circle cx="30" cy="22" r="4.5" fill="#2b1d14"/><path d="M22 30h4M20 38v-4M24 38v-4M28 38v-4" stroke="#5a5048" stroke-width="2"/>`,
  ship: `<path d="M6 32h36l-6 9H12z" fill="#7a4a24" stroke="#3a2210" stroke-width="2"/><path d="M24 6v26" stroke="#3a2210" stroke-width="2.5"/><path d="M24 8l14 18H24z" fill="#efe8dc" stroke="#8a7a68" stroke-width="1.5"/><path d="M24 12l-12 14h12z" fill="#e5432f"/>`,
  map: `<path d="M6 10l11-4 14 4 11-4v32l-11 4-14-4-11 4z" fill="#f2deb0" stroke="#8a6a3a" stroke-width="2"/><path d="M14 18c6 2 8 8 14 8" stroke="#8a6a3a" stroke-width="2" stroke-dasharray="3 3" fill="none"/><path d="M30 26l6 6M36 26l-6 6" stroke="#e5432f" stroke-width="3" stroke-linecap="round"/>`,
  ore: `<path d="M8 34l6-14 10-6 12 4 5 12-6 6H12z" fill="#7a746c" stroke="#45403a" stroke-width="2"/><g fill="#9ae6ff"><circle cx="19" cy="25" r="2.6"/><circle cx="29" cy="22" r="2"/><circle cx="27" cy="31" r="2.4"/></g>`,
  rockfall: `<path d="M8 12l8-4 6 5-2 7-8 1z" fill="#7a746c" stroke="#45403a" stroke-width="2"/><path d="M24 22l9-3 6 6-3 8-9 1-4-5z" fill="#8a837a" stroke="#45403a" stroke-width="2"/><path d="M10 40h28" stroke="#e5432f" stroke-width="3.5" stroke-linecap="round"/><path d="M14 30l-2 6M20 28l1 6" stroke="#45403a" stroke-width="2"/>`,
  gclover: `<g fill="#ffd84a" stroke="#b37a00" stroke-width="1.8"><circle cx="17" cy="17" r="8"/><circle cx="31" cy="17" r="8"/><circle cx="17" cy="31" r="8"/><circle cx="31" cy="31" r="8"/></g><circle cx="24" cy="24" r="3.5" fill="#b37a00"/><path d="M12 12l4 4" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  x2: `<circle cx="24" cy="24" r="20" fill="#7a3fd1" stroke="#3d1a73" stroke-width="2.5"/><text x="24" y="31" text-anchor="middle" font-size="19" font-weight="900" fill="#fff" font-family="sans-serif">×2</text>`,
  x3: `<circle cx="24" cy="24" r="20" fill="#c2185b" stroke="#6a0d34" stroke-width="2.5"/><text x="24" y="31" text-anchor="middle" font-size="19" font-weight="900" fill="#fff" font-family="sans-serif">×3</text>`,
  x5: `<circle cx="24" cy="24" r="20" fill="#ff5a36" stroke="#8a1f00" stroke-width="2.5"/><circle cx="24" cy="24" r="16" fill="none" stroke="#ffd84a" stroke-width="2"/><text x="24" y="31" text-anchor="middle" font-size="19" font-weight="900" fill="#fff" font-family="sans-serif">×5</text>`,
};
export function symbol(name, cls = '') {
  return svg(SYMBOLS[name] || SYMBOLS.star, cls);
}

// 긁개 6단계
const TOOLS = [
  `<circle cx="24" cy="24" r="19" fill="#c87f4a" stroke="#7d4520" stroke-width="2.5"/><circle cx="24" cy="24" r="14" fill="none" stroke="#9c5a2c" stroke-width="2"/><text x="24" y="30" text-anchor="middle" font-size="15" font-weight="900" fill="#6a3815" font-family="sans-serif">10</text>`,
  `<circle cx="24" cy="24" r="20" fill="#d9dde3" stroke="#8a929c" stroke-width="2.5"/><circle cx="24" cy="24" r="15" fill="none" stroke="#a7aeb7" stroke-width="2"/><text x="24" y="29.5" text-anchor="middle" font-size="13" font-weight="900" fill="#5b6470" font-family="sans-serif">500</text>`,
  `<rect x="5" y="12" width="38" height="25" rx="4" fill="#e5432f" stroke="#8f1d10" stroke-width="2"/><rect x="5" y="17" width="38" height="5" fill="#2b2b38"/><rect x="9" y="27" width="14" height="5" rx="1.5" fill="#ffc531"/>`,
  `<path d="M8 30l22-22 10 10-22 22z" fill="#ffc531" stroke="#b37a00" stroke-width="2.5" stroke-linejoin="round"/><path d="M8 30l10 10" stroke="#7a5200" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="18" r="3" fill="#b37a00"/>`,
  `<path d="M8 30l22-22 10 10-22 22z" fill="#ffe16b" stroke="#d29a00" stroke-width="2.5" stroke-linejoin="round"/><path d="M8 30l10 10" stroke="#fff6c2" stroke-width="5" stroke-linecap="round"/><path d="M26 10l3 3M34 16l3 3" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="38" cy="8" r="2.5" fill="#fff"/>`,
  `<rect x="18" y="4" width="12" height="22" rx="4" fill="#3a8dde" stroke="#1d4f80" stroke-width="2.5"/><rect x="10" y="26" width="28" height="12" rx="4" fill="#5aa9ff" stroke="#1d4f80" stroke-width="2.5"/><path d="M12 42h24" stroke="#ffc531" stroke-width="5" stroke-linecap="round"/><path d="M21 10h6" stroke="#cfe7ff" stroke-width="2" stroke-linecap="round"/>`,
];
export function tool(stage) {
  return svg(TOOLS[Math.max(0, Math.min(TOOLS.length - 1, stage))], 'tool');
}

const UI = {
  gear: `<path d="M24 15a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm17 12v-6l-5-1a13 13 0 0 0-1.6-3.9l3-4.2-4.3-4.3-4.2 3A13 13 0 0 0 25 9l-1-5h-6l-1 5a13 13 0 0 0-3.9 1.6l-4.2-3L4.6 11.9l3 4.2A13 13 0 0 0 6 20l-5 1v6l5 1a13 13 0 0 0 1.6 3.9l-3 4.2 4.3 4.3 4.2-3A13 13 0 0 0 17 39l1 5h6l1-5a13 13 0 0 0 3.9-1.6l4.2 3 4.3-4.3-3-4.2A13 13 0 0 0 36 28z" fill="currentColor" transform="translate(3 0)"/>`,
  shop: `<path d="M6 18l4-10h28l4 10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M6 18c0 3 2.5 5 6 5s6-2 6-5c0 3 2.5 5 6 5s6-2 6-5c0 3 2.5 5 6 5s6-2 6-5" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M9 24v16h30V24" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="20" y="30" width="8" height="10" fill="currentColor"/>`,
  upgrade: `<path d="M24 6l14 16h-8v12H18V22h-8z" fill="currentColor"/><rect x="14" y="38" width="20" height="4" rx="2" fill="currentColor"/>`,
  prestige: `<g fill="currentColor"><circle cx="17" cy="17" r="7.5"/><circle cx="31" cy="17" r="7.5"/><circle cx="17" cy="31" r="7.5"/><circle cx="31" cy="31" r="7.5"/></g><circle cx="24" cy="24" r="3.5" fill="var(--nav-bg, #000)"/>`,
  trophy: `<path d="M14 6h20v10a10 10 0 0 1-20 0z" fill="currentColor"/><path d="M14 10H7v3a7 7 0 0 0 7 7M34 10h7v3a7 7 0 0 1-7 7" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="21" y="25" width="6" height="8" fill="currentColor"/><rect x="14" y="33" width="20" height="7" rx="2" fill="currentColor"/>`,
  lock: `<rect x="10" y="21" width="28" height="21" rx="4" fill="currentColor"/><path d="M16 21v-6a8 8 0 0 1 16 0v6" fill="none" stroke="currentColor" stroke-width="4.5"/>`,
  sound: `<path d="M8 18h8l10-8v28l-10-8H8z" fill="currentColor"/><path d="M32 16a10 10 0 0 1 0 16M36 11a16 16 0 0 1 0 26" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
  music: `<path d="M18 34V10l20-4v24" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="13" cy="35" r="6" fill="currentColor"/><circle cx="33" cy="31" r="6" fill="currentColor"/>`,
  vibrate: `<rect x="16" y="6" width="16" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M9 16v16M4 20v8M39 16v16M44 20v8" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
  sparkle: `<path d="M24 4l4 14 14 4-14 4-4 14-4-14-14-4 14-4z" fill="currentColor"/>`,
  save: `<path d="M8 8h26l6 6v26H8z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><rect x="15" y="8" width="16" height="10" fill="currentColor"/><rect x="14" y="26" width="20" height="14" rx="2" fill="currentColor"/>`,
  install: `<path d="M24 6v24M14 20l10 10 10-10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 32v8h32v-8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  info: `<circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="22" y="21" width="4" height="13" rx="2" fill="currentColor"/><circle cx="24" cy="15" r="2.6" fill="currentColor"/>`,
  logout: `<path d="M20 8H8v32h12" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M18 24h22M32 16l8 8-8 8" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  close: `<path d="M12 12l24 24M36 12L12 36" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`,
  share: `<circle cx="36" cy="10" r="6" fill="currentColor"/><circle cx="12" cy="24" r="6" fill="currentColor"/><circle cx="36" cy="38" r="6" fill="currentColor"/><path d="M17 21l14-8M17 27l14 8" stroke="currentColor" stroke-width="3.5"/>`,
  job: `<rect x="6" y="12" width="36" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M12 18v12M16 18v12M19 18v12M24 18v12M27 18v12M31 18v12M36 18v12" stroke="currentColor" stroke-width="2.2"/>`,
  tool: `<path d="M8 30l22-22 10 10-22 22z" fill="currentColor"/><path d="M8 30l10 10" stroke="var(--card, #fff)" stroke-width="4" stroke-linecap="round"/>`,
  luck: `<path d="M24 42c-8-6-16-12-16-21a8 8 0 0 1 16-2 8 8 0 0 1 16 2c0 9-8 15-16 21z" fill="currentColor"/><path d="M24 14v28" stroke="var(--card, #fff)" stroke-width="2.5"/>`,
  helper: `<circle cx="24" cy="14" r="8" fill="currentColor"/><path d="M8 42c0-10 7-16 16-16s16 6 16 16z" fill="currentColor"/>`,
  train: `<circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M24 13v12l8 5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/>`,
  bulk: `<rect x="12" y="6" width="28" height="18" rx="3" fill="currentColor" opacity=".45"/><rect x="9" y="14" width="28" height="18" rx="3" fill="currentColor" opacity=".7"/><rect x="6" y="22" width="28" height="18" rx="3" fill="currentColor"/>`,
  stake: `<ellipse cx="24" cy="34" rx="16" ry="6" fill="currentColor"/><ellipse cx="24" cy="26" rx="16" ry="6" fill="currentColor" opacity=".75"/><ellipse cx="24" cy="18" rx="16" ry="6" fill="currentColor" opacity=".5"/>`,
  clover: `<g fill="currentColor"><circle cx="17" cy="17" r="7"/><circle cx="31" cy="17" r="7"/><circle cx="17" cy="31" r="7"/><circle cx="31" cy="31" r="7"/></g>`,
  check: `<path d="M10 25l9 9 19-20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  chevron: `<path d="M18 10l14 14-14 14" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
};
// 알바 버튼에서 튀어나오는 물건들
const ITEMS = [
  `<rect x="15" y="10" width="18" height="30" rx="3" fill="#fff" stroke="#5aa9ff" stroke-width="2.5"/><path d="M15 16l4-6h10l4 6" fill="#5aa9ff"/><text x="24" y="31" text-anchor="middle" font-size="9" font-weight="900" fill="#2d6fd0" font-family="sans-serif">우유</text>`,
  `<path d="M8 18h32l-4 20H12z" fill="#e5432f" stroke="#8f1d10" stroke-width="2"/><path d="M12 14c4-4 20-4 24 0" stroke="#ffc531" stroke-width="3" fill="none"/><text x="24" y="31" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="sans-serif">라면</text>`,
  `<path d="M24 7L41 38H7z" fill="#fff" stroke="#3a2a1c" stroke-width="2"/><path d="M14 30h20l3 8H11z" fill="#2b2b38"/><circle cx="24" cy="22" r="3" fill="#e5432f"/>`,
  `<rect x="14" y="8" width="20" height="32" rx="5" fill="#3aa655" stroke="#1d6e35" stroke-width="2"/><rect x="14" y="17" width="20" height="10" fill="#ffd84a"/><rect x="19" y="5" width="10" height="4" rx="1" fill="#9aa7b4"/>`,
];
export function item(i) {
  return svg(ITEMS[i % ITEMS.length], 'item');
}

export function ui(name, cls = '') {
  return svg(UI[name] || UI.info, cls);
}
