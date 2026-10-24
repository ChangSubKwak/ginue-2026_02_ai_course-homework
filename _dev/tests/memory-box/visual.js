// 화면별 스크린샷 + 400px 가로 스크롤 점검 (desktop/mobile)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const over = () => page.evaluate(() => { const de = document.documentElement; const wide = []; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.right > de.clientWidth + 2 && getComputedStyle(el).position !== 'fixed') { wide.push(el.tagName + '.' + (el.className || '').toString().slice(0, 30) + ' r=' + Math.round(r.right)); if (wide.length > 5) break; } } return { o: de.scrollWidth > de.clientWidth + 1, wide }; });
  await page.evaluate(() => { window.__app.actions.loadTeacherSample(); });
  await page.click('#tab-settings'); await page.click('[data-action="set-teacher"]'); await sleep(200);
  for (const vp of [{ width: 1280, height: 800, n: 'd' }, { width: 400, height: 800, n: 'm' }]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const v of ['cards', 'history', 'exam', 'print', 'teacher', 'settings']) {
      await page.click('#tab-' + v); await sleep(250);
      if (v === 'cards') { await page.click('.deck-card'); await sleep(200); }
      if (v === 'print' && await page.locator('[data-action="print-deck"][aria-pressed="false"]').count() === await page.locator('[data-action="print-deck"]').count()) { await page.click('[data-action="print-deck"]'); await sleep(200); }
      const r = await over(); expect(!r.o, `${vp.n} ${v} 가로 스크롤 없음 ${JSON.stringify(r.wide)}`);
      await shot(`${vp.n}-${v}`);
      if (v === 'cards') { await page.click('[data-action="back-decks"]'); await sleep(100); }
    }
    // 인쇄 미리보기
    await page.click('#tab-print'); await sleep(150); await page.click('[data-action="print-preview"]'); await sleep(400); await shot(`${vp.n}-print-preview`); await page.click('[data-action="print-back"]'); await sleep(150);
    // 카드 모달
    await page.click('.fab'); await sleep(200); await page.click('.modal [data-type="wrong"]'); await sleep(100); const r2 = await over(); expect(!r2.o, `${vp.n} 카드 모달 가로 스크롤 없음`); await shot(`${vp.n}-card-modal`); await page.keyboard.press('Escape'); await sleep(150);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('#tab-home'); await page.click('[data-action="start-today"]'); await sleep(300); await shot('d-session-front');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await sleep(100); await shot('d-session-dark');
  await page.click('#conf-btns [data-c="2"]'); await page.click('#flip-btn'); await sleep(500); await shot('d-session-back-dark');
  await page.keyboard.press('Escape'); await sleep(200);
  await page.click('#tab-history'); await sleep(200); await shot('d-history-dark');
  await page.click('#tab-teacher'); await sleep(200); await shot('d-teacher-dark');
};
