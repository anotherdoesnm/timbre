import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:8099/#chat', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const box = await page.evaluate(() => {
  const el = document.querySelector('.chat');
  const r = el?.getBoundingClientRect();
  return r ? { width: Math.round(r.width), x: Math.round(r.x) } : null;
});
console.log('chat box:', JSON.stringify(box));
await page.screenshot({ path: 'shots/phone-chat.png' });
await page.goto('http://127.0.0.1:8099/#auth', { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
await page.screenshot({ path: 'shots/phone-auth.png' });
await browser.close();
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
