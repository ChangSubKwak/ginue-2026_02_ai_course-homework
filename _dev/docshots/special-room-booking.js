// 특별실지기 설명서용 스크린샷 촬영 모듈 (pw-run.js용)
// node _dev/tools/pw-run.js <index.html> _dev/docshots/special-room-booking.js <docs/screens>
'use strict';
const path = require('path');
module.exports = async ({ page, expect, sleep, log }) => {
  const outdir = process.argv[4] || path.join(__dirname, 'out');
  const snap = async (name, full) => {
    await page.waitForTimeout(400);
    const p = path.join(outdir, name + '.png');
    await page.screenshot({ path: p, fullPage: !!full });
    log('shot ' + p);
  };
  const act = (code) => page.evaluate(code);
  const modal = () => page.locator('.modal-backdrop:not(.closing) .modal').last();
  const closeModal = async () => { await page.keyboard.press('Escape'); await sleep(300); };

  // 온보딩 → 샘플로 시작 (토스트가 사라질 때까지 대기)
  await page.click('[data-result="sample"]');
  await sleep(3900);

  // 01 예약판 메인: 과학실1, 2026-10-12 주
  await act(() => { window.__app.actions.selectResource('r_sci1'); window.__app.actions.goWeek('2026-10-12'); });
  await sleep(300);
  expect(await page.locator('.grid .block').count() >= 1, '01 블록 표시');
  await snap('01-main', true);

  // 02 강당: 운동회 연습 차단(빗금)·운동회 전체 차단·충돌 배지
  await act(() => { window.__app.actions.selectResource('r_gym'); window.__app.actions.goWeek('2026-10-19'); });
  await sleep(300);
  expect(await page.locator('.cell.blocked').count() >= 1, '02 차단 셀 표시');
  await snap('02-board-blocked', true);

  // 03 예약 모달(수량형 충돌): 태블릿 세트 10/20 3교시 세 번째 예약 → 잔여 0 + 대안 칩
  await act(() => { window.__app.actions.selectResource('r_tab'); window.__app.actions.goWeek('2026-10-19'); });
  await sleep(300);
  await act(() => { window.__app.actions.openBookingModal({ resourceId: 'r_tab', date: '2026-10-20', pStart: 3, pEnd: 3 }); });
  await sleep(300);
  await modal().locator('select[name="classSel"]').selectOption('4-1');
  await sleep(300);
  expect(await modal().locator('.validate .bad').count() === 1, '03 충돌 사유 표시');
  expect(await modal().locator('.alts .chip').count() >= 1, '03 대안 칩 표시');
  await snap('03-booking-conflict', false);
  await closeModal();

  // 04 정기 예약 미리보기: 과학실2 매주 목 1~2교시 6-1 → 추석 휴업일 제외
  await act(() => { window.__app.actions.selectResource('r_sci2'); });
  await sleep(200);
  await act(() => { window.__app.actions.openSeriesModal(); });
  await sleep(300);
  await modal().locator('select[name="resourceId"]').selectOption('r_sci2');
  await modal().locator('select[name="weekday"]').selectOption('4');
  await modal().locator('select[name="pStart"]').selectOption('1');
  await modal().locator('select[name="pEnd"]').selectOption('2');
  await modal().locator('select[name="classSel"]').selectOption('6-1');
  await sleep(200);
  await page.locator('.modal-backdrop:not(.closing) .modal-foot [data-act="preview"]').last().click();
  await sleep(400);
  expect(await modal().locator('.preview tbody tr').count() >= 10, '04 미리보기 행 표시');
  await snap('04-series-preview', false);
  await closeModal();

  // 05 학사일정(10월)
  await act(() => { window.__app.actions.selectTab('calendar'); });
  await sleep(300);
  await snap('05-calendar', true);

  // 06 특별실·기자재(자원 카드 영역, 뷰포트 1280x1000)
  await page.setViewportSize({ width: 1280, height: 1000 });
  await act(() => { window.__app.actions.selectTab('resources'); });
  await sleep(300);
  await act(() => window.scrollTo(0, 0));
  await snap('06-resources', false);

  // 07 통계(학기 전체): KPI·가동률·학년별·형평성 히트맵이 한 화면에 들어오게 1280x1260
  await page.setViewportSize({ width: 1280, height: 1260 });
  await act(() => { window.__app.actions.selectTab('stats'); });
  await sleep(400);
  expect(await page.locator('svg.chart').count() >= 4, '07 SVG 차트 4종');
  await act(() => window.scrollTo(0, 160));
  await snap('07-stats', false);
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(300);

  // 08 주간 이용 현황표 인쇄 미리보기 (과학실1, 10/12 주)
  await act(() => { window.__app.actions.selectTab('board'); window.__app.actions.selectResource('r_sci1'); window.__app.actions.goWeek('2026-10-12'); });
  await sleep(300);
  await page.click('[data-act="print-week"]');
  await sleep(500);
  expect(await page.locator('.paper .wk').count() >= 1, '08 인쇄 미리보기 표');
  await snap('08-print-weekly', false);
  await closeModal();

  // 09 설정(데이터 보관·인계·운영 방법 안내 영역, 1280x1000)
  await page.setViewportSize({ width: 1280, height: 1000 });
  await act(() => { window.__app.actions.selectTab('settings'); });
  await sleep(300);
  await act(() => window.scrollTo(0, 880));
  await snap('09-settings', false);
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(300);

  // 10 도움말 모달
  await act(() => { window.__app.actions.selectTab('board'); });
  await sleep(200);
  await page.click('#btn-help');
  await sleep(300);
  await snap('10-help', false);
  await closeModal();

  // 11 모바일 400px: 요일 탭(화요일)
  await page.setViewportSize({ width: 400, height: 800 });
  await sleep(500);
  await act(() => { window.__app.actions.selectResource('r_sci1'); window.__app.actions.goWeek('2026-10-12'); });
  await sleep(300);
  await page.click('[data-day-tab="2"]');
  await sleep(300);
  expect(await page.locator('.day-tabs').count() === 1, '11 요일 탭 표시');
  await snap('11-mobile', true);

  // 12 다크 모드(예약판, 1280px)
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(500);
  await act(() => { window.__app.actions.setTheme('dark'); window.__app.actions.selectResource('r_gym'); window.__app.actions.goWeek('2026-10-19'); });
  await sleep(400);
  await snap('12-dark', true);
  await act(() => { window.__app.actions.setTheme('light'); });
};
