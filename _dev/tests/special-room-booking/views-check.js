// 탭별 400px 가로 스크롤·다크 모드·빈 상태·교시 축소 차단·CSV 확인
'use strict';
module.exports = async ({ page, expect, shot, sleep }) => {
  const $ = sel => page.locator(sel);
  await $('[data-result="sample"]').click(); await sleep(300);
  const ov = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  for (const tab of ['calendar', 'resources', 'stats', 'settings']) { await $(`.tabs [data-tab="${tab}"]`).click(); await sleep(300); await shot(`desk-${tab}`); }
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  for (const tab of ['board', 'calendar', 'resources', 'stats', 'settings']) { await $(`.tabs [data-tab="${tab}"]`).click(); await sleep(300); expect(!(await ov()), `400px ${tab} 가로 스크롤 없음`); await shot(`m-${tab}`); }
  await $('.tabs [data-tab="board"]').click(); await $('[data-act="series"]').click(); await sleep(300); expect(!(await ov()), '400px 모달 가로 스크롤 없음'); await shot('m-modal'); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(200);
  // 다크 모드 예약판·통계
  await page.evaluate(() => window.__app.actions.setTheme('dark')); await sleep(200); await shot('dark-board');
  await $('.tabs [data-tab="stats"]').click(); await sleep(300); await shot('dark-stats');
  await page.evaluate(() => window.__app.actions.setTheme('light'));
  // 교시 개수 축소 차단
  await $('.tabs [data-tab="settings"]').click(); await sleep(200);
  await $('[data-form="periods"] input[name="count"]').fill('5'); await page.dispatchEvent('[data-form="periods"] input[name="count"]', 'change'); await sleep(100);
  await $('[data-form="periods"] button[type="submit"]').click(); await sleep(200);
  expect((await $('[data-form="periods"] .validate').textContent()).includes('줄일 수 없습니다'), '교시 축소 차단 안내');
  // CSV 내보내기 파일명
  const [dl] = await Promise.all([page.waitForEvent('download'), $('[data-act="export-csv"]').click()]);
  expect(/bookings_\d{8}\.csv$/.test(dl.suggestedFilename()), 'CSV 파일명 ' + dl.suggestedFilename());
  // 빈 상태 체험: 자원 0개
  await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await sleep(500);
  await $('[data-result="empty"]').click(); await sleep(300);
  expect((await $('[data-view="board"] .empty').count()) === 1, '빈 상태 안내 카드');
  await $('.tabs [data-tab="stats"]').click(); await sleep(200); expect((await $('[data-view="stats"] .empty').count()) === 1, '통계 빈 상태');
  await shot('empty-board');
  // 자원 추가 후 격자 표시
  await $('.tabs [data-tab="resources"]').click(); await sleep(200); await $('[data-act="res-add"]').click(); await sleep(200);
  await $('.modal input[name="name"]').fill('과학실'); await $('.modal [data-act="save"]').click(); await sleep(300);
  await $('.tabs [data-tab="board"]').click(); await sleep(200); expect((await $('.grid .cell').count()) === 40, '자원 추가 후 격자');
};
