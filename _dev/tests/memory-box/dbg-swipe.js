'use strict';
module.exports = async ({ page, expect, log, sleep }) => {
  const prog = async () => (await page.locator('.session-top .num').textContent()).replace(/\s/g, '');
  await page.click('[data-action="start-today"]'); await sleep(300);
  log('p0=' + await prog());
  await page.evaluate(() => { window.__ev = []; const el = document.getElementById('flip-wrap'); ['pointerdown', 'pointerup', 'pointermove'].forEach(t => el.addEventListener(t, e => window.__ev.push(t + ':' + Math.round(e.clientX) + ',' + Math.round(e.clientY) + ':' + e.target.className))); });
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(300);
  log('p1=' + await prog());
  const box = await page.locator('#flip-wrap').boundingBox(); log(JSON.stringify(box));
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy + 10, { steps: 5 }); await page.mouse.up(); await sleep(800);
  log('ev=' + JSON.stringify(await page.evaluate(() => window.__ev.filter(e => !e.startsWith('pointermove')))));
  log('p2=' + await prog());
  // second card progress after graded by click
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(300);
  await page.click('#grade-btns [data-ok="1"]'); await sleep(800);
  log('p3=' + await prog());
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(300);
  await page.click('#grade-btns [data-ok="1"]'); await sleep(800);
  log('p4=' + await prog());
  const w = (await page.locator('.session-top .progress > i').getAttribute('style'));
  log('bar=' + w);
};
