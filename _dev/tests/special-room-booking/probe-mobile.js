// fix-r1 probe: 모바일 주 내비·차트 스크롤 단서·예약 모달 초기 안내 확인용 스크린샷
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const $ = sel => page.locator(sel);
  await $('[data-result="sample"]').click(); await sleep(400);
  await $('.grid .cell.free').first().click(); await sleep(300);
  await shot('desk-booking-modal-initial');
  expect(await $('.modal .validate .hint').count() === 1 && await $('.modal .validate .bad').count() === 0, '예약 모달 초기: 회색 안내(빨간 오류 없음)');
  await page.keyboard.press('Escape'); await sleep(300);
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(400);
  await shot('mobile-board');
  const nav = await page.evaluate(() => { const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return { prev: r('[data-act="prev-week"]'), label: r('.week-label'), next: r('[data-act="next-week"]'), thisW: r('[data-act="this-week"]'), input: r('[data-act="pick-week"]') }; });
  log('nav=' + JSON.stringify(nav));
  expect(nav.prev[1] === nav.next[1] && nav.thisW[1] > nav.prev[1] && nav.input[2] > 120, '모바일 주 내비 2행 배치(◀ 라벨 ▶ / 이번 주 · 날짜)');
  await $('.grid .cell.free').first().click(); await sleep(400);
  await shot('mobile-booking-modal');
  await page.keyboard.press('Escape'); await sleep(300);
  await page.evaluate(() => window.__app.actions.selectTab('stats')); await sleep(400);
  await shot('mobile-stats');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), '400px 통계 가로 스크롤 없음');
};
