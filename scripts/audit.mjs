import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle' });
const report = await page.evaluate(() => {
  const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), radius: cs.borderRadius, bg: cs.backgroundColor }; };
  const rail = [...document.querySelectorAll('.rail-btn')].map((el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius, active: el.classList.contains('active') }; });
  return { rail, railBox: box('.rail'), rooms: box('.rooms'), chat: box('.chat'), members: box('.members'), header: box('.head'), bodyFont: getComputedStyle(document.body).fontFamily, overflowX: document.documentElement.scrollWidth > window.innerWidth };
});
console.log(JSON.stringify(report, null, 1));
await page.screenshot({ path: 'rail.png', clip: { x: 0, y: 0, width: 260, height: 560 } });
await browser.close();
