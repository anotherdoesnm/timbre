// Renders the built app and saves screenshots. Usage: node scripts/screenshot.mjs
// Needs a static server on BASE_URL (default http://127.0.0.1:8099/).
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:8099/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const shot = (name) => page.screenshot({ path: name });

// 1-2. Chat shell, normal and encrypted channel.
await page.goto(`${base}#chat`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await shot('shots/chat-general.png');
await page.getByText('design', { exact: true }).first().click();
await page.waitForTimeout(250);
await shot('shots/chat-encrypted.png');

// 3. Auth, empty state.
await page.goto(`${base}#auth`, { waitUntil: 'networkidle' });
await page.waitForTimeout(250);
await shot('shots/auth-idle.png');

// 4. Auth, resolved instance (canned reply, marked "демо").
await page.goto(`${base}?demo=1#auth`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('har.mony.lol').fill('har.mony.lol');
await page.getByRole('button', { name: 'Продолжить' }).click();
await page.getByText('GitHub').waitFor({ timeout: 5000 });
await page.waitForTimeout(200);
await shot('shots/auth-instance.png');

// 5. Auth, failure state — a real request that the instance refuses to a foreign origin.
await page.goto(`${base}#auth`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('har.mony.lol').fill('har.mony.lol');
await page.getByRole('button', { name: 'Продолжить' }).click();
await page.locator('.error').waitFor({ timeout: 8000 });
await page.waitForTimeout(150);
await shot('shots/auth-error.png');

// 6. OAuth callback, success (demo).
await page.goto(`${base}?demo=1#auth/callback`, { waitUntil: 'networkidle' });
await page.getByText('Вход выполнен').waitFor({ timeout: 5000 });
await page.waitForTimeout(150);
await shot('shots/auth-callback.png');

await browser.close();
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
