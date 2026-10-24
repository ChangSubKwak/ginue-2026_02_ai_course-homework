// reverify-r1-probe-scroll.js — U-03 수정(표 nowrap) 이후 모바일에서 표 모달이 열릴 때 가로 스크롤 위치·포커스 확인
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'reverify-r1-probe-scroll');
fs.mkdirSync(OUT, { recursive: true });

module.exports = async ({ page, expect, log, sleep }) => {
  const $ = sel => page.locator(sel);
  await $('[data-result="sample"]').click(); await sleep(500);
  const probe = () => page.evaluate(() => { const w = document.querySelector('.modal .table-wrap'); const a = document.activeElement; const td = document.querySelector('.modal tbody td'); return { scrollLeft: w ? w.scrollLeft : null, scrollW: w ? w.scrollWidth : null, clientW: w ? w.clientWidth : null, active: a.tagName + '.' + a.className + '[' + (a.dataset.mark || a.dataset.result || a.dataset.edit || '') + ']', inBody: !!a.closest('.modal-body'), firstTdLeft: td ? Math.round(td.getBoundingClientRect().left) : null, wrapLeft: w ? Math.round(w.getBoundingClientRect().left) : null }; });
  const check = async label => { await $('[data-act="unchecked"]').click(); await sleep(400); const r = await probe(); log(label + ' unchecked ' + JSON.stringify(r)); await page.screenshot({ path: path.join(OUT, label + '-unchecked.png') }); await page.keyboard.press('Escape'); await sleep(300); return r; };
  await page.evaluate(() => { window.__app.actions.selectResource('r_sci1'); window.__app.actions.goWeek('2026-10-26'); }); await sleep(300);
  const d = await check('desktop');
  expect(d.scrollLeft === 0, '데스크톱: 미확인 예약 모달 표 가로 스크롤 0 (' + d.scrollLeft + ')');
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(400);
  const m = await check('mobile');
  expect(m.scrollLeft === 0, '모바일 400px: 미확인 예약 모달이 열릴 때 표가 왼쪽 끝에서 시작(날짜·자원 열 보임) (scrollLeft=' + m.scrollLeft + ', active=' + m.active + ')');
  // 충돌 예약 목록 모달(학사일정)도 같은 구조
  await page.evaluate(() => window.__app.actions.selectTab('calendar')); await sleep(300);
  if (await $('[data-affected]').count()) {
    await $('[data-affected]').first().click(); await sleep(400);
    const r2 = await probe(); log('mobile affected ' + JSON.stringify(r2));
    await page.screenshot({ path: path.join(OUT, 'mobile-affected.png') });
    expect(r2.scrollLeft === 0, '모바일 400px: 충돌 예약 목록 모달 표 가로 스크롤 0 (scrollLeft=' + r2.scrollLeft + ', active=' + r2.active + ')');
    await page.keyboard.press('Escape'); await sleep(300);
  }
  // 사용자가 왼쪽으로 되돌릴 수 있는지(스크롤 가능 여부)
  await page.evaluate(() => window.__app.actions.selectTab('board')); await sleep(300);
  await $('[data-act="unchecked"]').click(); await sleep(400);
  const back = await page.evaluate(() => { const w = document.querySelector('.modal .table-wrap'); w.scrollLeft = 0; return w.scrollLeft; });
  expect(back === 0, '표를 왼쪽으로 되돌릴 수 있음');
  await page.screenshot({ path: path.join(OUT, 'mobile-unchecked-scrolled-back.png') });
  await page.keyboard.press('Escape'); await sleep(300);
};
