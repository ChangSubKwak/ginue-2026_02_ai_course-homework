const { chromium } = require('D:/workspace/ginue-2026_02_ai_course-homework/_dev/tools/node_modules/playwright');
const URL = 'file:///D:/workspace/ginue-2026_02_ai_course-homework/01_교과교육지원_분수교구함/index.html';
const OUT = 'D:/workspace/ginue-2026_02_ai_course-homework/01_교과교육지원_분수교구함/docs/screens/';
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  let ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  let p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(600);
  await p.click('[data-action="big"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '07-bigtext.png', fullPage: true, clip: { x: 0, y: 0, width: 1280, height: 1000 } });
  await ctx.close();
  ctx = await b.newContext({ viewport: { width: 400, height: 860 }, colorScheme: 'light' });
  p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '09-mobile-top.png', fullPage: true, clip: { x: 0, y: 0, width: 400, height: 860 } });
  await p.screenshot({ path: OUT + '10-mobile-models.png', fullPage: true, clip: { x: 0, y: 760, width: 400, height: 865 } });
  await b.close();
})();
