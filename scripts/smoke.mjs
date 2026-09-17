// Headless smoke test: boots the game in Chromium, loads every chapter and
// reports console errors. Run: node scripts/smoke.mjs   (needs a static server on :8080)
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(`${base}/index.html?quality=low`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const title = await page.title();
console.log('title:', title);
for (let i = 0; i < 6; i++) {
  await page.evaluate((i) => window.game.startChapter(i), i);
  await page.waitForFunction(() => window.game.current !== null, null, { timeout: 60000 });
  await page.click('#btn-card-go');
  await page.waitForTimeout(2500);
  // simulate some input
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyF'); await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  const errBox = await page.$eval('#error-box', (e) => e.classList.contains('hidden') ? '' : e.textContent);
  const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  console.log(`chapter ${i + 1}: loaded, ~${fps} fps (swiftshader), errorBox=${errBox ? errBox.slice(0, 200) : 'none'}`);
  await page.screenshot({ path: `${process.env.SHOT_DIR || '.'}/ch${i + 1}.png` });
}
await browser.close();
if (errors.length) { console.log('console errors/warnings:'); errors.forEach((e) => console.log(' ', e)); }
process.exit(errors.some((e) => e.startsWith('[pageerror]') || e.includes('Runtime error') || e.includes('failed to load')) ? 1 : 0);
