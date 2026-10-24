// dbg-print.js — emulateMedia(print→screen) 후 버튼 클릭이 막히는지 확인
'use strict';
module.exports = async ({ page, expect, log, sleep }) => {
  await page.click('#tab-cards'); await sleep(200);
  await page.emulateMedia({ media: 'print' }); await sleep(200);
  log('print: app display=' + await page.evaluate(() => getComputedStyle(document.querySelector('.app')).display + ' btn=' + getComputedStyle(document.querySelector('[data-action="new-deck"]')).display));
  await page.emulateMedia({ media: 'screen' }); await sleep(200);
  log('screen: btn=' + await page.evaluate(() => getComputedStyle(document.querySelector('[data-action="new-deck"]')).display + ' vis=' + (document.querySelector('[data-action="new-deck"]').getBoundingClientRect().width)));
  try { await page.click('[data-action="new-deck"]', { timeout: 3000 }); log('click ok (screen)'); } catch (e) { log('click fail (screen): ' + e.message.split('\n').slice(0, 6).join(' | ')); }
  await page.keyboard.press('Escape'); await sleep(200);
  await page.emulateMedia({ media: null }); await sleep(200);
  try { await page.click('[data-action="new-deck"]', { timeout: 3000 }); log('click ok (null)'); } catch (e) { log('click fail (null): ' + e.message.split('\n').slice(0, 3).join(' | ')); }
  expect(true, 'done');
};
