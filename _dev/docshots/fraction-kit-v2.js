const { chromium } = require('D:/workspace/ginue-2026_02_ai_course-homework/_dev/tools/node_modules/playwright');
const path = require('path');
const ROOT = 'D:/workspace/ginue-2026_02_ai_course-homework/01_교과교육지원_분수교구함';
const URL = 'file:///' + ROOT + '/index.html';
const OUT = ROOT + '/docs/screens/';
const errors = [];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  async function fresh(w, h, scheme = 'light') {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    page.on('dialog', d => { errors.push('dialog ' + d.message()); d.dismiss(); });
    await page.goto(URL); await page.waitForTimeout(800);
    return { ctx, page };
  }
  const shot = async (page, name, full = true) => { await page.waitForTimeout(500); await page.screenshot({ path: OUT + name, fullPage: full }); console.log('shot', name); };
  const info = async (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }));

  // 01 main
  let { ctx, page } = await fresh(1280, 800);
  console.log('main', await info(page), await page.evaluate(() => window.__app.getState()));
  await shot(page, '01-main.png');
  // 02 improper 7/4 via chip
  await page.click('#chips .chip[data-n="7"][data-d="4"]');
  console.log('7/4', await page.textContent('#numbers'));
  await shot(page, '02-improper.png');
  // 03 chain: 2/3 -> x2 -> x2 -> 합치기
  await page.click('#chips .chip[data-n="2"][data-d="3"]');
  await page.click('[data-action="split2"]');
  await page.waitForTimeout(150);
  await shot(page, '03-split.png');  // right after x2 (4/6, new lines)
  await page.click('[data-action="split2"]');
  await page.click('[data-action="reduce"]');
  console.log('chain', await page.textContent('#chain'), JSON.stringify((await page.evaluate(() => window.__app.getState())).chain));
  await shot(page, '04-chain.png');
  await ctx.close();

  // 05 dark, 5/6
  ({ ctx, page } = await fresh(1280, 800));
  await page.click('[data-action="theme"]');
  await page.click('#chips .chip[data-n="5"][data-d="6"]');
  await shot(page, '05-dark.png');
  await ctx.close();

  // 06 predict-first: decimal/reading hidden, circle only, 2/5 -> click 4th sector
  ({ ctx, page } = await fresh(1280, 800));
  await page.click('#chips .chip[data-n="2"][data-d="5"]');
  await page.click('#svg-circle .cell[data-i="3"]');
  await page.uncheck('[data-show="decimal"]'); await page.uncheck('[data-show="reading"]');
  await page.click('[data-model="bar"]'); await page.click('[data-model="line"]');
  console.log('predict', JSON.stringify(await page.evaluate(() => window.__app.getState())));
  await shot(page, '06-predict.png');
  await ctx.close();

  // 07 big text 1280
  ({ ctx, page } = await fresh(1280, 800));
  await page.click('[data-action="big"]');
  console.log('big', await info(page));
  await shot(page, '07-bigtext.png');
  await ctx.close();

  // 08 help modal
  ({ ctx, page } = await fresh(1280, 800));
  await page.click('[data-action="help"]');
  await shot(page, '08-help.png', false);
  await ctx.close();

  // 09 mobile 400
  ({ ctx, page } = await fresh(400, 860));
  console.log('mobile', await info(page));
  await shot(page, '09-mobile.png');
  // mobile denominator 12 for label check
  await page.evaluate(() => window.__app.actions.setFraction(5, 12));
  await page.waitForTimeout(300);
  console.log('mobile 5/12', await info(page));
  await page.screenshot({ path: 'C:/Users/parad/AppData/Local/Temp/claude/D--workspace-ginue-2026-02-ai-course-homework/1716854d-9f4f-4d06-ba55-fb3e97031963/scratchpad/m12.png', fullPage: true });
  // mobile big text with long improper
  await page.click('[data-action="big"]');
  await page.evaluate(() => window.__app.actions.setFraction(23, 12));
  await page.waitForTimeout(300);
  console.log('mobile big 23/12', await info(page));
  await page.screenshot({ path: 'C:/Users/parad/AppData/Local/Temp/claude/D--workspace-ginue-2026-02-ai-course-homework/1716854d-9f4f-4d06-ba55-fb3e97031963/scratchpad/mbig.png', fullPage: true });
  await ctx.close();

  await browser.close();
  console.log('errors', errors);
})().catch(e => { console.error(e); process.exit(1); });
