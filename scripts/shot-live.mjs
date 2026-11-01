// Discovery against the real flagship, through the dev proxy (npm run dev on :5173).
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://127.0.0.1:5173/#auth', { waitUntil: 'networkidle' });
await page.getByPlaceholder('har.mony.lol').fill('har.mony.lol');
await page.getByRole('button', { name: 'Продолжить' }).click();
await page.getByText('GitHub').waitFor({ timeout: 15000 });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/auth-live.png' });
await browser.close();
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
