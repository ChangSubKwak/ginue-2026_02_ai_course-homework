// 자리뚝딱 설명서용 스크린샷 촬영 모듈 (pw-run.js용)
// node _dev/tools/pw-run.js <index.html> _dev/docshots/jari-ttukttak.js <docs/screens>
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
  const act = (fn, arg) => page.evaluate(fn, arg);
  const esc = async () => { await page.keyboard.press('Escape'); await sleep(300); };

  await page.setViewportSize({ width: 1280, height: 900 });
  await sleep(300);
  // 첫 실행 투어 닫기(Esc → '다시 보지 않기' 기본 체크 상태로 종료)
  await esc();

  // 01 명렬 탭(첫 화면): 샘플 25명(비활성 1명), 요약 칩, 붙여넣기 등록, 분리·결합 쌍
  expect(await page.locator('#roster-table tr[data-id]').count() === 25, '01 명렬 25명 표시');
  await snap('01-main', false);

  // 02 자리 배치 탭: 자동 배치 → 좌석표 + 충족 리포트
  await act(() => { window.__app.actions.setTab('seats'); });
  await sleep(300);
  await act(() => { window.__app.actions.autoArrange(); });
  await sleep(600);
  expect(await page.locator('#seatmap .seat.filled').count() === 24, '02 좌석 카드 24개');
  await sleep(2600); // 배치 완료 토스트가 사라진 뒤 촬영
  await snap('02-seats-auto', false);

  // 03 수동 조정으로 분리 쌍(최민준-강시우)을 인접시킴 → 위반 토스트 + 빨간 테두리 + 리포트 '위반'
  await act(() => {
    const st = window.__app.getState().state;
    const seats = st.current.seats;
    const keyOf = (sid) => Object.keys(seats).find(k => seats[k] === sid);
    const k4 = keyOf('s04'), k6 = keyOf('s06');
    const [r, c] = k4.split('-').map(Number);
    const partner = r + '-' + (c % 3 === 0 ? c + 1 : c - 1);
    if (partner !== k6) window.__app.actions.swapSeats(k6, partner);
  });
  await sleep(350);
  expect(await page.locator('#seatmap .seat.viol').count() >= 2, '03 위반 좌석 빨간 테두리');
  await snap('03-seats-violation', false);
  await act(() => { window.__app.actions.undo(); });
  await sleep(2800);

  // 04 발표 모드: 카드 뒷면 '?' → 일부 카드 공개(헤드리스에서는 전체 화면 거부 → 오버레이 폴백)
  await act(() => { window.__app.actions.openPresent(); });
  await sleep(500);
  for (let i = 0; i < 9; i++) { await act(() => { window.__app.actions.flipOne(); }); await sleep(120); }
  await sleep(600);
  expect(await page.locator('#present-map .flip.flipped').count() === 9, '04 카드 9장 공개');
  await snap('04-present', false);
  await act(() => { window.__app.actions.closePresent(); });
  await sleep(300);

  // 05 모둠 탭: 6모둠 편성(성별·수준 균형, 역할 자동)
  await page.setViewportSize({ width: 1280, height: 1000 });
  await act(() => { window.__app.actions.setTab('groups'); });
  await sleep(300);
  await act(() => { window.__app.actions.makeGroups(); });
  await sleep(500);
  expect(await page.locator('.group-card').count() === 6, '05 모둠 카드 6개');
  await sleep(2400);
  await snap('05-groups', false);

  // 06 히스토리·공정성 탭: 기록 카드 5장 + 히트맵·TOP 5·구역 막대('편중 주의' 배지)
  await page.setViewportSize({ width: 1280, height: 1250 });
  await act(() => { window.__app.actions.setTab('history'); window.scrollTo(0, 0); });
  await sleep(400);
  expect(await page.locator('.hist-card').count() === 5, '06 히스토리 카드 5개');
  expect(await page.locator('svg.heat').count() === 1, '06 히트맵 표시');
  expect(await page.locator('.zrow.is-bad').count() >= 1, '06 편중 주의 배지');
  await snap('06-history', false);

  // 07 인쇄 미리보기: 교사용 자리표(180° 회전, 칠판 아래)
  await page.setViewportSize({ width: 1280, height: 900 });
  await act(() => { window.__app.actions.setTab('seats'); });
  await sleep(300);
  await act(() => { window.__app.actions.openPrint('teacher'); });
  await sleep(600);
  expect(await page.locator('#print-pages .page.landscape').count() === 1, '07 교사용 A4 가로 1쪽');
  await snap('07-print-teacher', false);

  // 08 인쇄 미리보기: 책상 명패(4개/장 → 6쪽) — A4 세로 1쪽이 통째로 보이도록 세로 뷰포트
  await page.setViewportSize({ width: 1280, height: 1220 });
  await page.check('input[name="print-kind"][value="plates"]');
  await sleep(700);
  expect(await page.locator('#print-pages .page.plates').count() === 6, '08 명패 6쪽');
  await snap('08-print-plates', false);
  await act(() => { window.__app.actions.closePrint(); });
  await sleep(300);

  // 09 설정·백업 탭
  await page.setViewportSize({ width: 1280, height: 1000 });
  await act(() => { window.__app.actions.setTab('settings'); window.scrollTo(0, 0); });
  await sleep(400);
  await snap('09-settings', false);

  // 10 도움말 모달(툴바 ?)
  await page.setViewportSize({ width: 1280, height: 900 });
  await act(() => { window.__app.actions.setTab('seats'); });
  await sleep(300);
  await page.click('.toolbar [data-action="help"]');
  await sleep(400);
  expect(await page.locator('.modal').count() === 1, '10 도움말 모달');
  await snap('10-help', false);
  await esc();

  // 11 모바일 400px: 하단 탭 바, 접힌 패널, 폭에 맞춘 좌석표
  await page.setViewportSize({ width: 400, height: 860 });
  await sleep(600);
  await act(() => { window.__app.actions.setTab('seats'); window.scrollTo(0, 0); });
  await sleep(500);
  const overflow = await act(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(!overflow, '11 400px 가로 스크롤 없음');
  await snap('11-mobile', false);

  // 12 다크 모드(자리 배치 탭, 1280px)
  await page.setViewportSize({ width: 1280, height: 900 });
  await sleep(500);
  await act(() => { window.__app.actions.toggleTheme(); window.__app.actions.setTab('seats'); window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); });
  await sleep(500);
  expect(await act(() => document.documentElement.dataset.theme === 'dark'), '12 다크 테마 적용');
  await snap('12-dark', false);
  await act(() => { window.__app.actions.toggleTheme(); });
};
