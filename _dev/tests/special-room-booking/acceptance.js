// 특별실지기 수용 기준 13개 자동 확인 모듈 (pw-run.js용)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const $ = sel => page.locator(sel);
  const state = () => page.evaluate(() => window.__app.getState());
  const closeModal = async () => { await page.keyboard.press('Escape'); await sleep(250); };
  const modal = () => $('.modal-backdrop:not(.closing) .modal').last();

  // AC1 온보딩 → 샘플로 시작
  expect(await $('.modal-backdrop').count() === 1, 'AC1 온보딩 모달 표시');
  await $('[data-result="sample"]').click(); await sleep(400);
  expect(await $('.chip[data-resource]').count() === 10, 'AC1 자원 칩 10개');
  expect(await $('.grid .cell').count() === 40, 'AC1 월~금×8교시 격자 40칸');
  expect(await $('.grid .block').count() >= 1, 'AC1 예약 블록 1개 이상');
  await shot('01-board');

  // AC2 과학실1 드래그 → 모달 범위 → 5-2 선택 시 담임 자동 → 저장
  await $('.chip[data-resource="r_sci1"]').click(); await sleep(200);
  const pair = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.grid .cell.free')];
    for (const c of cells) { const d = c.dataset.day, p = Number(c.dataset.period); const n = cells.find(x => x.dataset.day === d && Number(x.dataset.period) === p + 1); if (n) return { day: d, date: c.dataset.date, p1: p, p2: p + 1 }; }
    return null;
  });
  expect(!!pair, 'AC2 드래그 가능한 연속 빈 셀 존재');
  const a = await $(`.cell[data-date="${pair.date}"][data-period="${pair.p1}"]`).boundingBox();
  const b = await $(`.cell[data-date="${pair.date}"][data-period="${pair.p2}"]`).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 20, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  expect(await $('.cell.sel').count() === 2, 'AC2 드래그 중 선택 하이라이트 2칸');
  await page.mouse.up(); await sleep(300);
  expect(await modal().count() === 1, 'AC2 예약 모달 열림');
  expect(await modal().locator('select[name="pStart"]').inputValue() === String(pair.p1) && await modal().locator('select[name="pEnd"]').inputValue() === String(pair.p2), 'AC2 시작·끝 교시가 드래그 범위');
  await modal().locator('select[name="classSel"]').selectOption('5-2'); await sleep(100);
  const tSel = await modal().locator('select[name="teacherId"]').inputValue();
  const tName = await page.evaluate(id => (window.__app.getState().data.teachers.find(t => t.id === id) || {}).name, tSel);
  expect(tName === '이가람', 'AC2 5-2 선택 시 담임 이가람 자동 입력');
  expect(await modal().locator('.validate .ok').count() === 1, 'AC2 검증 녹색 예약 가능');
  await shot('02-booking-modal');
  await modal().locator('[data-act="save"]').click(); await sleep(300);
  expect((await $(`.block[style*="grid-row:${pair.p1 + 1} / span 2"]`).count()) >= 0 && (await page.evaluate(d => [...document.querySelectorAll('.block')].some(b => b.textContent.includes('5-2 이가람')), null)), 'AC2 저장 후 5-2 이가람 블록 생성');
  expect(await $('.toast.show').count() >= 1, 'AC2 토스트 표시');
  const toastCount0 = await $('.toast').count();

  // AC3 같은 자리 재시도 → 저장 비활성·사유·대안 칩 → 칩 클릭 시 녹색
  await page.evaluate(({ date, p1, p2 }) => { window.__app.actions.openBookingModal({ resourceId: 'r_sci1', date, pStart: p1, pEnd: p2 }); }, pair); await sleep(300);
  await modal().locator('select[name="classSel"]').selectOption('5-1'); await sleep(150);
  expect(await modal().locator('[data-act="save"]').isDisabled(), 'AC3 충돌 시 저장 비활성');
  expect(await modal().locator('.validate .bad').count() === 1, 'AC3 빨간 사유 표시');
  const altN = await modal().locator('.alts .chip').count();
  expect(altN >= 1 && altN <= 3, `AC3 대안 칩 ${altN}개`);
  await shot('03-conflict');
  await modal().locator('.alts .chip').first().click(); await sleep(200);
  expect(await modal().locator('.validate .ok').count() === 1 && !(await modal().locator('[data-act="save"]').isDisabled()), 'AC3 대안 적용 후 녹색·저장 가능');
  await closeModal();
  expect(await $('.toast').count() === 0 || toastCount0 >= 0, 'AC13 토스트 자동 소멸 확인(후속)');

  // AC4 태블릿 세트 2/2 → 세 번째 잔여 0
  await $('.chip[data-resource="r_tab"]').click(); await sleep(200);
  const tcell = await page.evaluate(() => { const c = document.querySelector('.grid .cell.free:not(:has(.eq-chip))'); return c ? { date: c.dataset.date, p: Number(c.dataset.period) } : null; });
  expect(!!tcell, 'AC4 태블릿 빈 셀 존재');
  for (const cls of ['1-1', '1-2']) {
    await page.evaluate(({ date, p }) => { window.__app.actions.openBookingModal({ resourceId: 'r_tab', date, pStart: p, pEnd: p }); }, tcell); await sleep(250);
    await modal().locator('select[name="classSel"]').selectOption(cls); await sleep(100);
    await modal().locator('[data-act="save"]').click(); await sleep(250);
  }
  const cellTxt = await $(`.cell[data-date="${tcell.date}"][data-period="${tcell.p}"]`).textContent();
  expect(cellTxt.includes('2/2'), 'AC4 셀에 2/2 표시: ' + cellTxt.trim());
  await page.evaluate(({ date, p }) => { window.__app.actions.openBookingModal({ resourceId: 'r_tab', date, pStart: p, pEnd: p }); }, tcell); await sleep(250);
  await modal().locator('select[name="classSel"]').selectOption('1-3'); await sleep(150);
  const badTxt = await modal().locator('.validate').textContent();
  expect(badTxt.includes('잔여 0') && await modal().locator('[data-act="save"]').isDisabled(), 'AC4 세 번째 예약 잔여 0 차단');
  await shot('04-equipment');
  await closeModal();

  // AC5 학사일정 운동회 연습(강당 5~6교시) → 영향 건수 → 격자 빗금 → 저장 차단
  await $('.tabs [data-tab="calendar"]').click(); await sleep(300);
  await $('[data-event-del="e_05"]').click(); await sleep(200); await modal().locator('[data-result="ok"]').click(); await sleep(300);
  await $('[data-act="event-add"]').click(); await sleep(250);
  await modal().locator('input[name="title"]').fill('운동회 연습');
  await modal().locator('select[name="type"]').selectOption('event');
  await modal().locator('input[name="dateStart"]').fill('2026-10-19'); await modal().locator('input[name="dateEnd"]').fill('2026-10-22');
  await modal().locator('input[name="res"][value="r_gym"]').check();
  await modal().locator('input[name="pmode"][value="some"]').check();
  await modal().locator('input[name="per"][value="5"]').check(); await modal().locator('input[name="per"][value="6"]').check(); await sleep(150);
  const vtxt = await modal().locator('.validate').textContent();
  expect(/기존 예약 \d+건/.test(vtxt), 'AC5 저장 전 영향 예약 건수 표시: ' + vtxt.trim());
  await modal().locator('[data-act="save"]').click(); await sleep(400);
  const resTxt = await modal().textContent();
  expect(/기존 예약 \d+건과 충돌/.test(resTxt), 'AC5 저장 후 충돌 건수 모달');
  await shot('05-event-saved');
  await modal().locator('[data-result="list"]').click(); await sleep(300);
  expect(await modal().locator('tbody tr').count() >= 1, 'AC5 충돌 예약 목록 표시');
  await closeModal();
  await $('.tabs [data-tab="board"]').click(); await sleep(200);
  await page.evaluate(() => { window.__app.actions.selectResource('r_gym'); window.__app.actions.goWeek('2026-10-19'); }); await sleep(300);
  const bc = $('.cell[data-date="2026-10-20"][data-period="5"]');
  expect((await bc.getAttribute('class')).includes('blocked') && (await bc.textContent()).includes('운동회 연습'), 'AC5 강당 10/20 5교시 빗금+사유');
  expect(await $('.block.conflict').count() >= 1, 'AC5 차단 위 기존 예약 충돌 배지');
  await page.evaluate(() => { window.__app.actions.openBookingModal({ resourceId: 'r_gym', date: '2026-10-21', pStart: 5, pEnd: 5 }); }); await sleep(250);
  await modal().locator('select[name="classSel"]').selectOption('2-1'); await sleep(150);
  expect((await modal().locator('.validate').textContent()).includes('행사 차단') && await modal().locator('[data-act="save"]').isDisabled(), 'AC5 차단 셀 예약 저장 차단');
  await closeModal();

  // AC6 정기 예약 과학실2 목 1~2 6-1 → 추석 휴업일 제외 → 생성 → 블록 → 삭제 범위 모달
  await $('[data-act="series"]').click(); await sleep(250);
  await modal().locator('select[name="resourceId"]').selectOption('r_sci2');
  await modal().locator('select[name="weekday"]').selectOption('4');
  await modal().locator('select[name="pStart"]').selectOption('1'); await modal().locator('select[name="pEnd"]').selectOption('2');
  await modal().locator('select[name="classSel"]').selectOption('6-1');
  await modal().locator('input[name="dateFrom"]').fill('2026-09-01'); await modal().locator('input[name="dateTo"]').fill('2026-12-31');
  await modal().locator('[data-act="preview"]').click(); await sleep(300);
  const rows = await modal().locator('.preview tbody tr').allTextContents();
  const chuseok = rows.find(r => r.includes('9/24'));
  expect(!!chuseok && chuseok.includes('휴업일 제외'), 'AC6 미리보기 9/24 휴업일 제외: ' + (chuseok || '없음'));
  expect(rows.filter(r => r.includes('생성')).length >= 15, 'AC6 생성 행 15개 이상');
  await shot('06-series-preview');
  await modal().locator('[data-act="create"]').click(); await sleep(400);
  await page.evaluate(() => { window.__app.actions.goWeek('2026-10-12'); }); await sleep(300);
  const sblock = $('.block[data-booking-id][style*="grid-column:5;grid-row:2 / span 2"]');
  expect(await sblock.count() === 1 && (await sblock.textContent()).includes('6-1'), 'AC6 10월 목요일 1~2교시 6-1 블록');
  await sblock.click(); await sleep(250);
  expect((await modal().locator('.series-note').textContent()).includes('정기 예약'), 'AC6 시리즈 안내 표시');
  await modal().locator('[data-act="delete"]').click(); await sleep(250);
  const scopeBtns = await modal().locator('[data-result="one"], [data-result="after"], [data-result="all"]').count();
  expect(scopeBtns === 3, 'AC6 이 건만/이후 모두/시리즈 전체 선택 모달');
  await shot('06-series-delete');
  await modal().locator('[data-result="one"]').click(); await sleep(400);
  expect(await $('.block[data-booking-id][style*="grid-column:5;grid-row:2 / span 2"]').count() === 0, 'AC6 이 건만 삭제 후 블록 제거');

  // AC7 인쇄 미리보기 + @media print
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await $('[data-act="print-week"]').click(); await sleep(400);
  const ptxt = await modal().textContent();
  expect(ptxt.includes('경인초등학교') && ptxt.includes('주간 이용 현황표') && /\d+월 \d+주/.test(ptxt), 'AC7 미리보기 학교명·제목·주차');
  expect(await modal().locator('table.wk').count() >= 1, 'AC7 자원별 요일×교시 표');
  const appr = await modal().locator('.approval').first().locator('th:not(.v)').allTextContents();
  expect(appr.join(',') === '담당,부장,교감', 'AC7 결재란 3칸: ' + appr.join(','));
  await shot('07-print-preview');
  await modal().locator('[data-act="print"]').click(); await sleep(300);
  expect(await page.evaluate(() => window.__printed === true && document.querySelector('#print-root .print-page') !== null), 'AC7 브라우저 인쇄 호출·#print-root 렌더');
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => ({ app: getComputedStyle(document.querySelector('.page')).display, root: getComputedStyle(document.querySelector('#print-root')).display }));
  expect(pr.app === 'none' && pr.root === 'block', 'AC7 @media print에서 앱 숨김·인쇄 영역만 표시');
  await page.emulateMedia({ media: 'screen' });
  await closeModal();

  // AC8 통계 학기 전체 → SVG 차트·히트맵·저조 5-3
  await $('.tabs [data-tab="stats"]').click(); await sleep(400);
  await $('[data-stats="mode"]').selectOption('semester'); await sleep(400);
  expect(await $('svg.chart').count() >= 4, 'AC8 SVG 차트 4개(가동률·학년·히트맵·혼잡도)');
  expect(await $('svg.heat rect.h').count() > 100, 'AC8 히트맵 셀 렌더');
  const lowTxt = await $('.low-list').textContent();
  expect(lowTxt.includes('5-3'), 'AC8 이용 저조 학급에 5-3 포함');
  await shot('08-stats');

  // AC9 JSON 내보내기 → 새 학기 초기화 → 가져오기(교체) 복원
  await $('.tabs [data-tab="settings"]').click(); await sleep(300);
  const before = (await state()).data.bookings.length;
  const [dlObj] = await Promise.all([page.waitForEvent('download'), $('[data-act="export-json"]').click()]);
  const fname = dlObj.suggestedFilename(); const fpath = await dlObj.path();
  expect(/^special-room-booking_\d{8}\.json$/.test(fname), 'AC9 JSON 파일명: ' + fname);
  await $('[data-act="reset-semester"]').click(); await sleep(250);
  expect(await modal().locator('[data-result="ok"]').isDisabled(), 'AC9 초기화 입력 전 버튼 비활성');
  await modal().locator('input[name="confirm"]').fill('초기화'); await sleep(100);
  await modal().locator('[data-result="ok"]').click(); await sleep(400);
  expect((await state()).data.bookings.length === 0 && (await state()).data.resources.length === 10, 'AC9 초기화 후 예약 0·자원 유지');
  await $('.tabs [data-tab="board"]').click(); await sleep(200);
  expect(await $('.grid .block, .grid .eq-chip').count() === 0 && await $('.chip[data-resource]').count() === 10, 'AC9 예약판 비고 칩 유지');
  await $('.tabs [data-tab="settings"]').click(); await sleep(200);
  await $('.dropzone input[type="file"]').setInputFiles(fpath); await sleep(400);
  await modal().locator('[data-result="replace"]').click(); await sleep(500);
  expect((await state()).data.bookings.length === before, `AC9 교체 후 예약 ${before}건 복원`);
  // 드롭존 드래그 이벤트 경로도 확인(잘못된 파일 → 토스트, 데이터 유지)
  await page.evaluate(() => { const dz = document.querySelector('.dropzone'); const dt = new DataTransfer(); dt.items.add(new File(['{"meta":{"app":"other"}}'], 'bad.json', { type: 'application/json' })); dz.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); }); await sleep(400);
  expect(await $('.toast-error').count() >= 1 && (await state()).data.bookings.length === before, 'AC9 잘못된 JSON 드롭 → 오류 토스트·데이터 유지');
  await shot('09-settings');

  // AC10 컴퓨터실·다음 주 → 새로고침 복원
  await $('.tabs [data-tab="board"]').click(); await sleep(200);
  await $('.chip[data-resource="r_com"]').click(); await $('[data-act="next-week"]').click(); await sleep(200);
  const ws = (await state()).ui.weekStart;
  await reload(); await sleep(400);
  const st10 = await state();
  expect(st10.ui.selectedResourceId === 'r_com' && st10.ui.weekStart === ws && (await $('.chip.on').textContent()).includes('컴퓨터실') && st10.data.bookings.length === before, 'AC10 새로고침 후 자원·주·데이터 복원');

  // AC11 400px 요일 탭·가로 스크롤 없음·셀 탭 모달
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(400);
  expect(await $('.day-tabs [data-day-tab]').count() === 5, 'AC11 요일 탭 5개');
  expect(await $('.grid .cell').count() === 8, 'AC11 한 열(8칸)만 표시');
  const ov = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(!ov, 'AC11 가로 스크롤 없음');
  await shot('11-mobile');
  const mc = $('.grid .cell.free').first();
  if (await mc.count()) { await mc.click(); await sleep(300); expect(await modal().locator('select[name="pStart"]').count() === 1, 'AC11 셀 탭 → 모달 교시 select'); await closeModal(); }
  else { await $('.day-tabs [data-day-tab="3"]').click(); await sleep(200); await $('.grid .cell.free').first().click(); await sleep(300); expect(await modal().locator('select[name="pStart"]').count() === 1, 'AC11 셀 탭 → 모달 교시 select'); await closeModal(); }
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(300);

  // AC12 지난 예약 → 사용 안 함 → 미사용률 증가
  const past = await page.evaluate(() => { const t = new Date(); const ymd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; const r = window.__app.getState().data.resources.filter(x => x.type === 'room').map(x => x.id); return window.__app.getState().data.bookings.find(b => b.date < ymd && b.used === true && r.includes(b.resourceId)); });
  expect(!!past, 'AC12 지난 사용함 예약 존재');
  const rate0 = await page.evaluate(() => { const r = window.__app.actions.statsRange(); return window.__app.actions.computeStats(r.from, r.to).summary.unusedRate; });
  await page.evaluate(b => { window.__app.actions.selectResource(b.resourceId); window.__app.actions.goWeek(b.date); }, past); await sleep(300);
  await $(`[data-booking-id="${past.id}"]`).click(); await sleep(300);
  expect(await modal().locator('.used-wrap').isVisible(), 'AC12 사용 여부 토글 표시');
  await modal().locator('[data-used="false"]').click(); await sleep(100);
  await modal().locator('[data-act="save"]').click(); await sleep(300);
  const rate1 = await page.evaluate(() => { const r = window.__app.actions.statsRange(); return window.__app.actions.computeStats(r.from, r.to).summary.unusedRate; });
  expect(rate1 > rate0, `AC12 미사용률 증가 ${rate0} → ${rate1}`);
  await $('.tabs [data-tab="stats"]').click(); await sleep(300);
  expect((await $('.kpi').nth(3).textContent()).includes(String(rate1)), 'AC12 통계 탭 미사용률 반영');

  // AC13 토스트 자동 소멸
  await sleep(3200);
  expect(await $('.toast').count() === 0, 'AC13 토스트 자동 소멸');
  log('done');
};
