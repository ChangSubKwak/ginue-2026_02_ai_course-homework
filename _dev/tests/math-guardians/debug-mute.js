'use strict';
module.exports = async ({ page, expect, log, sleep }) => {
  await page.evaluate(() => window.__app.actions.startStage('s2-3'));
  await sleep(800);
  try { await page.click('.hud [data-action="toggle-mute"]', { timeout: 4000 }); log('clicked'); } catch (e) { log('ERR ' + e.message.slice(0, 600)); }
  const info = await page.evaluate(() => { const b = document.querySelector('.hud [data-action="toggle-mute"]'); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { r: [r.x, r.y, r.width, r.height], top: top && (top.tagName + '.' + top.className), pe: getComputedStyle(b).pointerEvents }; });
  log(JSON.stringify(info));
  expect(true, 'x');
};
