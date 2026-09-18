// End-to-end flow test: drives one chapter through its debug hooks, dialogue and
// quiz to the end screen. Usage: node scripts/flow.mjs <chapterIndex 0-5>
// Env: BASE_URL (default http://127.0.0.1:8080), CHROMIUM_PATH, SHOT_DIR.
import { chromium } from 'playwright';
const ch = Number(process.argv[2]);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = [];
page.on('pageerror', (e) => { errs.push(e.message); console.log(`[pageerror] ${e.message}`); });
page.on('console', (m) => { if (m.type() === 'error') { errs.push(m.text()); console.log(`[err] ${m.text().slice(0, 400)}`); } });
await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:8080'}/index.html?quality=low`, { waitUntil: 'load' });
await page.waitForTimeout(1000);
await page.evaluate((i) => { window.game.startChapter(i); }, ch);
await page.waitForFunction(() => window.game.current !== null, null, { timeout: 120000 });
await page.click('#btn-card-go');
await page.waitForTimeout(500);
const CORRECT = ['A, U and M', 'Creation, preservation', 'The Self'];
const steps = {
  0: [['collectAll', () => true]],
  1: [['grant', () => true], ['hitAll', (st) => st.cnt.includes('/ 10')]],
  2: [['gatherAll', (st) => st.obj.includes('gather')], ['teach', (st) => st.cnt === '3 / 3']],
  3: [['win', (st) => st.obj.includes('golden ring')]],
  4: [['killAll', (st) => st.cnt === '5 asuras'], ['killAll', (st) => st.cnt === '7 asuras' && st.obj.includes('Wave 2')], ['killAll', (st) => st.cnt === '7 asuras' && st.obj.includes('Wave 3')], ['killAll', (st) => st.cnt.startsWith('Surapadman')], ['splitTree', (st) => st.phase === 'tree']],
  5: [['meetValli', () => true], ['lightAll', (st) => st.cnt.includes('/ 6 lamps')]],
}[ch];
let si = 0; const t0 = Date.now(); let lastLog = '';
while (Date.now() - t0 < 400000) {
  const st = await page.evaluate(() => ({
    dlg: !document.getElementById('dialogue').classList.contains('hidden'),
    quiz: !document.getElementById('quiz').classList.contains('hidden'),
    end: !document.getElementById('end-screen').classList.contains('hidden'),
    err: document.getElementById('error-box').textContent.slice(0, 300),
    obj: document.getElementById('objective').textContent, cnt: document.getElementById('counter').textContent,
    phase: window.game.current?.handle?.debug?.phase, time: window.game.time.toFixed(1),
  }));
  if (st.err) { console.log('ERRORBOX', st.err); break; }
  if (st.end) { console.log('END SCREEN reached at', st.time); break; }
  const log = `${st.obj} | ${st.cnt} | ${st.phase ?? ''}`;
  if (log !== lastLog) { console.log('  ', st.time, log); lastLog = log; }
  if (st.dlg) { await page.evaluate(() => window.game.ui.advanceDialogue()); await page.waitForTimeout(150); await page.evaluate(() => window.game.ui.advanceDialogue()); await page.waitForTimeout(150); continue; }
  if (st.quiz) { const btns = await page.$$('#quiz-options button'); for (const b of btns) { const tx = await b.textContent(); if (CORRECT.some((c) => tx.includes(c))) { await b.click(); break; } } await page.waitForTimeout(300); continue; }
  if (si < steps.length && steps[si][1](st)) {
    const fn = steps[si][0];
    const ok = await page.evaluate((fn) => { const d = window.game.current?.handle?.debug; if (!d || !d[fn]) return false; d[fn](); return true; }, fn);
    if (ok) { console.log('  called', fn); si++; }
    await page.waitForTimeout(800);
    continue;
  }
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${process.env.SHOT_DIR || '.'}/flow${ch}.png` });
await browser.close();
console.log(errs.length ? `ERRORS: ${errs.length}` : 'no console errors');
