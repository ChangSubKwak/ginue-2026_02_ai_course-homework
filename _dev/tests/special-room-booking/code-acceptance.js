// 특별실지기 코드 리뷰용 수용 기준 테스트(pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const S = sel => page.locator(sel);
  const st = () => page.evaluate(() => window.__app.getState());
  const modal = () => S('#modal-root .modal-backdrop:not(.closing)').last();

  // ── AC1 온보딩 → 샘플로 시작
  expect(await S('.modal-backdrop .choice').count() === 2, 'AC1 온보딩 모달에 선택 2개');
  await S('.choice[data-result="sample"]').click(); await sleep(400);
  expect(await S('.chips-row .chip').count() === 10, 'AC1 자원 칩 10개');
  expect(await S('.grid .gh.day').count() === 5, 'AC1 요일 열 5개');
  expect(await S('.grid .ph').count() === 8, 'AC1 교시 행 8개');
  expect(await S('.grid .block').count() >= 1, 'AC1 예약 블록 1개 이상');
  const s0 = await st(); log('bookings=' + s0.data.bookings.length + ' weekStart=' + s0.ui.weekStart + ' sample used: true=' + s0.data.bookings.filter(b => b.used === true).length + ' false=' + s0.data.bookings.filter(b => b.used === false).length + ' null-past=' + s0.data.bookings.filter(b => b.used == null && b.date < '2026-10-18').length);
  await shot('ac1-board');

  // ── AC2 드래그 → 모달 범위 → 5-2 담임 자동 → 저장
  await page.evaluate(() => window.__app.actions.goWeek('2026-10-19'));
  await S('.chip[data-resource="r_sci1"]').click(); await sleep(200);
  // 월 10/19 1~2교시가 비어 있는지 확인
  const c1 = S('.cell.free[data-date="2026-10-19"][data-period="1"]'); const c2 = S('.cell[data-date="2026-10-19"][data-period="2"]');
  const b1 = await c1.boundingBox(); const b2 = await c2.boundingBox();
  expect(!!b1 && !!b2, 'AC2 10/19 1~2교시 셀 존재');
  await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2); await page.mouse.down();
  await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2 + 20, { steps: 4 });
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 6 }); await sleep(100);
  const selCount = await S('.cell.sel').count();
  await page.mouse.up(); await sleep(300);
  expect(selCount === 2, 'AC2 드래그 중 선택 하이라이트 2칸(실제 ' + selCount + ')');
  expect(await modal().locator('select[name="pStart"]').inputValue() === '1' && await modal().locator('select[name="pEnd"]').inputValue() === '2', 'AC2 모달 시작1·끝2 교시 채워짐');
  expect(await S('#modal-root .modal-backdrop').count() === 1, 'AC2 드래그 후 모달 1개만 열림(클릭 중복 없음)');
  await modal().locator('select[name="classSel"]').selectOption('5-2'); await sleep(100);
  expect(await modal().locator('select[name="teacherId"]').inputValue() === 't_14', 'AC2 5-2 선택 시 담임 이가람(t_14) 자동');
  expect(await modal().locator('.validate .ok').count() === 1, 'AC2 검증 녹색');
  await modal().locator('[data-act="save"]').click(); await sleep(300);
  expect((await S('.block[data-booking-id]').filter({ hasText: '5-2 이가람' }).count()) >= 1, 'AC2 저장 후 5-2 이가람 블록');
  expect(await S('.toast').count() >= 1, 'AC2 토스트 표시');
  await shot('ac2-saved');

  // ── AC3 같은 자리 충돌 → 저장 disabled, 사유, 대안 칩 → 칩 클릭 시 녹색
  await S('.cell.free[data-date="2026-10-19"][data-period="3"]').click(); await sleep(200);
  await modal().locator('select[name="pStart"]').selectOption('1'); await modal().locator('select[name="pEnd"]').selectOption('2');
  await modal().locator('select[name="classSel"]').selectOption('5-1'); await sleep(150);
  expect(await modal().locator('[data-act="save"]').isDisabled(), 'AC3 충돌 시 저장 비활성');
  const reason = await modal().locator('.validate .bad').textContent();
  expect(/사용 중/.test(reason || ''), 'AC3 빨간 사유(사용 중): ' + (reason || '').slice(0, 60));
  const alts = await modal().locator('.chip.alt').count();
  expect(alts >= 1 && alts <= 3, 'AC3 대안 칩 1~3개(실제 ' + alts + ')');
  log('alts: ' + (await modal().locator('.chip.alt').allTextContents()).join(' | '));
  await shot('ac3-conflict');
  await modal().locator('.chip.alt').first().click(); await sleep(150);
  expect(await modal().locator('.validate .ok').count() === 1, 'AC3 대안 적용 후 녹색');
  await modal().locator('[data-result=""]').first().click(); await sleep(250);

  // ── AC4 태블릿 세트 2/2 → 세 번째 잔여 0
  await S('.chip[data-resource="r_tab"]').click(); await sleep(200);
  const freeDate = '2026-10-22'; const fp = '1';
  for (const cls of ['1-1', '1-2']) {
    await S(`.cell.free[data-date="${freeDate}"][data-period="${fp}"]`).click(); await sleep(150);
    await modal().locator('select[name="classSel"]').selectOption(cls); await sleep(100);
    await modal().locator('[data-act="save"]').click(); await sleep(250);
  }
  const cellTxt = await S(`.cell[data-date="${freeDate}"][data-period="${fp}"]`).textContent();
  expect(/2\/2/.test(cellTxt || ''), 'AC4 셀에 2/2 표시: ' + (cellTxt || '').trim());
  expect(await S(`.cell.free[data-date="${freeDate}"][data-period="${fp}"]`).count() === 0, 'AC4 가득 찬 셀은 free 아님');
  // 세 번째: 옆 셀에서 열어 교시 이동
  await S(`.cell.free[data-date="${freeDate}"][data-period="2"]`).click(); await sleep(150);
  await modal().locator('select[name="pStart"]').selectOption(fp); await modal().locator('select[name="pEnd"]').selectOption(fp); await sleep(150);
  const r4 = await modal().locator('.validate').textContent();
  expect(/잔여 0/.test(r4 || '') && await modal().locator('[data-act="save"]').isDisabled(), 'AC4 세 번째 예약 잔여 0 차단: ' + (r4 || '').slice(0, 80));
  await shot('ac4-tablet');
  await modal().locator('[data-result=""]').first().click(); await sleep(250);

  // ── AC5 학사일정: 운동회 연습 영향 건수·격자 빗금
  await S('.tabs [data-tab="calendar"]').click(); await sleep(200);
  const evItem = S('.event-list li').filter({ hasText: '운동회 연습' });
  expect(await evItem.count() === 1, 'AC5 운동회 연습 일정 존재');
  const affTxt = await evItem.locator('[data-affected]').textContent().catch(() => '');
  expect(/충돌 \d+건/.test(affTxt || ''), 'AC5 영향 예약 건수 표시: ' + affTxt);
  // 새 행사 등록 흐름(UI)
  await S('[data-act="event-add"]').click(); await sleep(150);
  await modal().locator('input[name="title"]').fill('테스트 행사');
  await modal().locator('input[name="dateStart"]').fill('2026-10-26'); await modal().locator('input[name="dateEnd"]').fill('2026-10-29');
  await modal().locator('input[name="res"][value="r_gym"]').check();
  await modal().locator('input[name="pmode"][value="some"]').check();
  await modal().locator('input[name="per"][value="5"]').check(); await modal().locator('input[name="per"][value="6"]').check(); await sleep(100);
  const preTxt = await modal().locator('.validate').textContent();
  expect(/기존 예약 \d+건과 충돌/.test(preTxt || ''), 'AC5 저장 전 영향 건수 실시간: ' + (preTxt || '').trim());
  await modal().locator('[data-act="save"]').click(); await sleep(300);
  const afterSave = await S('#modal-root .modal-backdrop:not(.closing)').count();
  log('AC5 저장 후 모달 수=' + afterSave + ' (충돌 있으면 1)');
  if (afterSave) { await modal().locator('[data-result=""]').first().click(); await sleep(200); }
  await S('.tabs [data-tab="board"]').click(); await sleep(150);
  await page.evaluate(() => window.__app.actions.goWeek('2026-10-19'));
  await S('.chip[data-resource="r_gym"]').click(); await sleep(200);
  expect(await S('.cell.blocked[data-date="2026-10-20"][data-period="5"]').count() === 1, 'AC5 강당 10/20 5교시 빗금 차단 셀');
  expect(await S('.cell.free[data-date="2026-10-20"][data-period="6"]').count() === 0, 'AC5 차단 셀은 클릭 불가(free 아님)');
  expect(await S('.block.conflict').count() >= 1, 'AC5 차단 위 기존 예약에 충돌 배지');
  await shot('ac5-gym-blocked');

  // ── AC6 정기 예약: 과학실2 목 1~2 6-1 → 9/24 휴업일 제외 → 생성 → 삭제 범위 모달
  await S('[data-act="series"]').click(); await sleep(200);
  await modal().locator('select[name="resourceId"]').selectOption('r_sci2');
  await modal().locator('select[name="weekday"]').selectOption('4');
  await modal().locator('select[name="pStart"]').selectOption('1'); await modal().locator('select[name="pEnd"]').selectOption('2');
  await modal().locator('select[name="classSel"]').selectOption('6-1'); await sleep(100);
  await modal().locator('[data-act="preview"]').click(); await sleep(300);
  const rowsN = await modal().locator('.preview tbody tr').count();
  const holidayRow = modal().locator('.preview tbody tr').filter({ hasText: '9/24' });
  expect(rowsN > 10 && /휴업일 제외/.test(await holidayRow.textContent().catch(() => '')), 'AC6 미리보기 ' + rowsN + '행, 9/24 휴업일 제외');
  const sumTxt = await modal().locator('.validate').textContent(); log('AC6 요약: ' + (sumTxt || '').trim());
  // 결함 재현: 체크박스 토글 시 미리보기가 사라지는지
  const cbN = await modal().locator('.preview input[data-row]').count();
  await modal().locator('.preview input[data-row]').first().click(); await sleep(200);
  const cbAfter = await modal().locator('.preview input[data-row]').count();
  expect(cbAfter === cbN, 'BUG 정기 예약 미리보기 체크박스 토글 후 표 유지(전 ' + cbN + ' → 후 ' + cbAfter + ')');
  const createDisabled = await modal().locator('[data-act="create"]').isDisabled();
  log('AC6 체크박스 토글 후 생성 버튼 disabled=' + createDisabled);
  if (cbAfter === 0) { await modal().locator('[data-act="preview"]').click(); await sleep(300); }
  await shot('ac6-series-preview');
  await modal().locator('[data-act="create"]').click(); await sleep(400);
  await page.evaluate(() => window.__app.actions.goWeek('2026-10-12'));
  await S('.chip[data-resource="r_sci2"]').click(); await sleep(200);
  const thuBlock = S('.block[style*="grid-column:5"]').filter({ hasText: '6-1' });
  expect(await thuBlock.count() >= 1, 'AC6 10/15(목) 1~2교시 6-1 블록');
  await thuBlock.first().click(); await sleep(200);
  expect(await modal().locator('.series-note').isVisible(), 'AC6 시리즈 소속 안내 표시');
  await modal().locator('[data-act="delete"]').click(); await sleep(200);
  expect(await S('#modal-root .modal-backdrop:not(.closing)').count() === 2 && await modal().locator('[data-result="after"]').count() === 1, 'AC6 삭제 시 이 건만/이후 모두/전체 선택 모달');
  await shot('ac6-delete-scope');
  await modal().locator('[data-result="one"]').click(); await sleep(300);
  expect(await S('#modal-root .modal-backdrop:not(.closing)').count() === 0, 'AC6 이 건만 삭제 후 모달 모두 닫힘');

  // ── AC7 인쇄 미리보기
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await S('[data-act="print-week"]').click(); await sleep(300);
  const paper = modal().locator('.paper');
  const ptxt = await paper.textContent();
  expect(/경인초등학교/.test(ptxt) && /주간 이용 현황표/.test(ptxt) && /10월 3주/.test(ptxt), 'AC7 학교명·제목·주차 표시');
  // (fix-r1) 전체 자원 10쪽이 한 .paper에 있으므로 첫 결재란만 센다(기존 셀렉터는 40개를 세어 항상 실패)
  expect(await paper.locator('.approval').first().locator('th').count() === 4 && /담당부장교감/.test((await paper.locator('.approval').first().textContent()).replace(/\s/g, '')), 'AC7 결재란 담당/부장/교감 3칸');
  expect(await paper.locator('.print-page').count() === 10, 'AC7 전체 자원 자원당 1쪽(10쪽)');
  await modal().locator('input[name="scope"][value="one"]').check(); await sleep(150);
  expect(await paper.locator('.print-page').count() === 1, 'AC7 선택 자원만 1쪽');
  await shot('ac7-print-preview');
  await modal().locator('[data-act="print"]').click(); await sleep(200);
  expect(await page.evaluate(() => window.__printed === 1 && document.querySelector('#print-root .print-page') !== null), 'AC7 브라우저 인쇄 호출·#print-root 채움');
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => ({ page: getComputedStyle(document.querySelector('body > .page')).display, root: getComputedStyle(document.querySelector('#print-root')).display, modal: getComputedStyle(document.querySelector('#modal-root')).display }));
  expect(pr.page === 'none' && pr.root === 'block' && pr.modal === 'none', 'AC7 @media print: 앱 UI 숨김·인쇄 영역만 ' + JSON.stringify(pr));
  await page.emulateMedia({ media: 'screen' });
  await modal().locator('[data-result=""]').first().click(); await sleep(250);

  // ── AC8 통계
  await S('.tabs [data-tab="stats"]').click(); await sleep(400);
  expect(await S('select[data-stats="mode"]').inputValue() === 'semester', 'AC8 기간 기본 학기 전체');
  expect(await S('svg.chart').count() === 4, 'AC8 SVG 차트 4개');
  expect(await S('svg.chart.heat').count() === 2, 'AC8 히트맵 2개');
  const lowTxt = await S('.low-list').textContent().catch(() => '');
  expect(/5-3/.test(lowTxt || ''), 'AC8 이용 저조 학급에 5-3 포함: ' + (lowTxt || '').slice(0, 120));
  const stats = await page.evaluate(() => { const r = window.__app.actions.statsRange(); const s = window.__app.actions.computeStats(r.from, r.to); return { summary: s.summary, low: s.low, per: s.perResource.map(x => [x.name, x.available, x.used, x.rate]) }; });
  log('AC8 stats summary=' + JSON.stringify(stats.summary) + ' per=' + JSON.stringify(stats.per));
  await S('svg.chart.heat rect.h').first().hover(); await sleep(100);
  expect(await S('.tip').isVisible(), 'AC8 히트맵 DOM 툴팁');
  await shot('ac8-stats');

  // ── AC12 지난 예약 사용 안 함 → 미사용률 증가
  const before = stats.summary.unusedRate;
  await S('.tabs [data-tab="board"]').click(); await sleep(150);
  await S('.chip[data-resource="r_sci1"]').click();
  await page.evaluate(() => window.__app.actions.goWeek('2026-09-14')); await sleep(200);
  const pastUsed = S('.block.past').filter({ hasNot: page.locator('.badge-warn') }).first();
  expect(await pastUsed.count() === 1, 'AC12 지난 예약 블록 존재');
  await pastUsed.click(); await sleep(200);
  expect(await modal().locator('.used-wrap').isVisible() && await modal().locator('[data-used="false"]').count() === 1, 'AC12 실제 사용함/사용 안 함 토글');
  await modal().locator('[data-used="false"]').click(); await modal().locator('[data-act="save"]').click(); await sleep(300);
  const after = await page.evaluate(() => { const r = window.__app.actions.statsRange(); return window.__app.actions.computeStats(r.from, r.to).summary.unusedRate; });
  expect(after > before, `AC12 미사용률 증가 ${before} → ${after}`);

  // ── AC10 컴퓨터실 선택 + 다음 주 → 새로고침 복원
  await page.evaluate(() => window.__app.actions.goWeek('2026-10-19'));
  await S('.chip[data-resource="r_com"]').click(); await S('[data-act="next-week"]').click(); await sleep(200);
  const wk = await S('.week-label').textContent();
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  expect(await S('.chip.on').getAttribute('data-resource') === 'r_com' && await S('.week-label').textContent() === wk, 'AC10 새로고침 후 자원·주 복원: ' + wk);
  expect(await S('#modal-root .modal-backdrop').count() === 0, 'AC10 재실행 시 온보딩 다시 안 뜸');

  // ── AC9 JSON 내보내기 → 초기화 → 가져오기 교체
  const nBefore = (await st()).data.bookings.length;
  await S('.tabs [data-tab="settings"]').click(); await sleep(200);
  const [dlEv] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), S('[data-act="export-json"]').click()]);
  const fname = dlEv ? dlEv.suggestedFilename() : '';
  expect(/^special-room-booking_\d{8}\.json$/.test(fname), 'AC9 JSON 다운로드 파일명: ' + fname);
  let jsonText = '';
  if (dlEv) { const p = await dlEv.path(); jsonText = require('fs').readFileSync(p, 'utf8'); }
  const [csvEv] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), S('[data-act="export-csv"]').click()]);
  if (csvEv) { const buf = require('fs').readFileSync(await csvEv.path()); expect(buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF, 'AC9 CSV UTF-8 BOM'); const head = buf.toString('utf8').split('\r\n')[0]; expect(/날짜,요일,교시,자원,학급,교사,태그,수량,사용여부,메모/.test(head), 'AC9 CSV 헤더: ' + head); log('csv name=' + csvEv.suggestedFilename()); }
  await S('[data-act="reset-semester"]').click(); await sleep(200);
  expect(await modal().locator('[data-result="ok"]').isDisabled(), 'AC9 초기화 입력 전 버튼 비활성');
  await modal().locator('input[name="confirm"]').fill('초기화'); await sleep(50);
  await modal().locator('[data-result="ok"]').click(); await sleep(300);
  const s9 = await st();
  expect(s9.data.bookings.length === 0 && s9.data.series.length === 0 && s9.data.events.length === 0 && s9.data.resources.length === 10 && s9.data.classes.length === 18, 'AC9 초기화: 예약·시리즈·일정 0, 자원 10·학급 18 유지');
  await S('.tabs [data-tab="board"]').click(); await sleep(200);
  expect(await S('.chips-row .chip').count() === 10 && await S('.block').count() === 0, 'AC9 예약판 비고 칩 유지');
  await S('.tabs [data-tab="settings"]').click(); await sleep(200);
  if (jsonText) {
    await S('.dropzone input[type="file"]').setInputFiles({ name: fname, mimeType: 'application/json', buffer: Buffer.from(jsonText, 'utf8') }); await sleep(400);
    expect(await modal().locator('[data-result="replace"]').count() === 1 && await modal().locator('[data-result="merge"]').count() === 1, 'AC9 가져오기 교체/병합 선택 모달');
    await modal().locator('[data-result="replace"]').click(); await sleep(400);
    expect((await st()).data.bookings.length === nBefore, `AC9 교체 후 예약 ${nBefore}건 복원`);
  }
  // 잘못된 파일
  await S('.dropzone input[type="file"]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"meta":{"app":"other"}}') }); await sleep(300);
  expect(await S('.toast-error').count() >= 1 && (await st()).data.bookings.length === nBefore, 'AC9 잘못된 JSON은 토스트·기존 데이터 유지');
  await shot('ac9-settings');

  // ── AC13 토스트 자동 소멸
  await sleep(4000);
  expect(await S('.toast').count() === 0, 'AC13 토스트 자동 소멸');

  // ── AC11 400px 모바일
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  await S('.tabs [data-tab="board"]').click(); await sleep(300);
  expect(await S('.day-tabs button').count() === 5, 'AC11 요일 탭 5개');
  expect(await S('.grid .gh.day').count() === 1, 'AC11 격자 1열');
  const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw.sw <= sw.cw, 'AC11 가로 스크롤 없음 ' + JSON.stringify(sw));
  await S('.day-tabs button[data-day-tab="3"]').click(); await sleep(200);
  const mcell = S('.cell.free').first();
  await mcell.tap().catch(async () => mcell.click()); await sleep(250);
  expect(await modal().locator('select[name="pStart"]').count() === 1 && await modal().locator('select[name="pEnd"]').count() === 1, 'AC11 셀 탭 → 모달 교시 select');
  const mw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(mw.sw <= mw.cw, 'AC11 모달 열린 상태 가로 스크롤 없음');
  await shot('ac11-mobile-modal');
  await page.keyboard.press('Escape'); await sleep(200);
  for (const t of ['calendar', 'resources', 'stats', 'settings']) {
    await S(`.tabs [data-tab="${t}"]`).click(); await sleep(300);
    const x = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(x.sw <= x.cw, `AC11 ${t} 탭 400px 가로 스크롤 없음 ` + JSON.stringify(x));
  }
  await shot('ac11-mobile-stats');
};
