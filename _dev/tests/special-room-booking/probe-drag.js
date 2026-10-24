// fix-r1 probe: 드래그 후 pointerup/lostpointercapture 순서와 모달 표시 확인
'use strict';
module.exports = async ({ page, expect, log, sleep }) => {
  const $ = sel => page.locator(sel);
  await $('[data-result="sample"]').click(); await sleep(400);
  await page.evaluate(() => { window.__ev = []; const r = document.querySelector('[data-view="board"]'); ['pointerup', 'lostpointercapture', 'pointercancel'].forEach(t => r.addEventListener(t, e => window.__ev.push(t + ':' + (e.target.className || '').slice(0, 20)), true)); });
  const pair = await page.evaluate(() => { const cells = [...document.querySelectorAll('.grid .cell.free')]; for (const c of cells) { const n = cells.find(x => x.dataset.date === c.dataset.date && Number(x.dataset.period) === Number(c.dataset.period) + 1); if (n) return { date: c.dataset.date, p1: Number(c.dataset.period), p2: Number(c.dataset.period) + 1 }; } return null; });
  const a = await $(`.cell[data-date="${pair.date}"][data-period="${pair.p1}"]`).boundingBox();
  const b = await $(`.cell[data-date="${pair.date}"][data-period="${pair.p2}"]`).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 12, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 }); await sleep(100);
  log('sel=' + await $('.cell.sel').count());
  await page.evaluate(() => { window.__up = []; document.addEventListener('pointerup', e => window.__up.push({ x: e.clientX, y: e.clientY, el: (document.elementFromPoint(e.clientX, e.clientY) || {}).className, sw: window.innerWidth, sh: window.innerHeight }), true); });
  await page.screenshot({ path: require('path').join(__dirname, 'r1-probe', 'full.png'), fullPage: true });
  log('after shot sel=' + await $('.cell.sel').count() + ' b=' + JSON.stringify(b));
  await page.mouse.up(); await sleep(300);
  log('up=' + JSON.stringify(await page.evaluate(() => window.__up)));
  log('events=' + JSON.stringify(await page.evaluate(() => window.__ev)));
  log('modal=' + await $('.modal-backdrop').count() + ' toast=' + JSON.stringify(await $('.toast').allTextContents()));
  expect(await $('.modal-backdrop').count() === 1, 'drag → modal');
};
