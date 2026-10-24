// reverify-r1-majors.js — 1라운드 수정 재검증: critical/major 항목(F-01/C-02, F-02/C-01, C-03, U-01~U-06)과 회귀 확인
// 독립 작성(수정 보고서·기존 모듈의 판정을 재사용하지 않음). pw-run.js 모듈 형식.
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'reverify-r1-majors');
fs.mkdirSync(OUT, { recursive: true });

module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const $ = (sel, opts) => page.locator(sel, opts);
  const modalCount = () => $('.modal-backdrop:not(.closing)').count();
  const closeAll = async () => { for (let i = 0; i < 6 && (await modalCount()); i++) { await page.keyboard.press('Escape'); await sleep(250); } };
  const st = () => page.evaluate(() => window.__app.getState());
  const toasts = async () => (await $('.toast').allTextContents()).join(' | ');
  const clearToasts = () => page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && document.body.scrollWidth <= document.documentElement.clientWidth + 1);
  const act = (name, arg) => page.evaluate(([n, a]) => { window.__app.actions[n](a); }, [name, arg]);
  const snap = async name => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p }); log('snap ' + p); return p; };

  // ───────── 0. 온보딩(F-05 회귀 포함)
  expect((await modalCount()) === 1, '첫 실행 온보딩 모달 표시');
  await page.keyboard.press('Escape'); await sleep(500);
  const onb = await page.evaluate(() => localStorage.getItem('srb.v1.onboarded'));
  expect((await modalCount()) === 1 && onb === null, 'F-05: 온보딩 ESC → 모달 재표시·onboarded 미저장 (modal=' + (await modalCount()) + ', onboarded=' + onb + ')');
  expect(/시작 방식/.test(await toasts()), 'F-05: 시작 방식 선택 안내 토스트');
  await $('[data-result="sample"]').click(); await sleep(600);
  expect((await modalCount()) === 0, '샘플로 시작 → 온보딩 닫힘');
  const s0 = await st(); log('bookings=' + s0.data.bookings.length + ' weekStart=' + s0.ui.weekStart + ' series=' + s0.data.series.length);
  expect(s0.data.resources.length === 10 && (await $('.chip[data-resource]').count()) === 10 && (await $('.cell').count()) === 40 && (await $('.block').count()) >= 1, 'AC1: 칩 10개·5×8 격자·블록 1개 이상');

  // ───────── 1. F-01/C-02 정기 예약 미리보기 체크박스
  await act('selectResource', 'r_sci2'); await sleep(200);
  await $('[data-act="series"]').click(); await sleep(300);
  expect((await modalCount()) === 1, '정기 예약 모달 열림');
  await page.selectOption('.modal select[name="resourceId"]', 'r_sci2');
  await page.selectOption('.modal select[name="weekday"]', '4');
  await page.selectOption('.modal select[name="pStart"]', '1');
  await page.selectOption('.modal select[name="pEnd"]', '2');
  await page.selectOption('.modal select[name="classSel"]', '6-1'); await sleep(200);
  const teacherAuto = await page.evaluate(() => document.querySelector('.modal select[name="teacherId"]').selectedOptions[0].textContent);
  expect(/국태민/.test(teacherAuto), '정기 예약: 6-1 선택 시 담임 자동(' + teacherAuto + ')');
  const createBtn = $('.modal-foot [data-act="create"]');
  await $('.modal-foot [data-act="preview"]').click(); await sleep(400);
  const rows0 = await $('.modal .preview tbody tr').count();
  const chk0 = await $('.modal .preview input[data-row]:checked').count();
  const sum0 = (await $('.modal .validate').textContent()).trim();
  log(`preview rows=${rows0} checked=${chk0} summary=${sum0}`);
  expect(rows0 >= 15 && chk0 >= 14, '미리보기 표 생성(행 ' + rows0 + ', 체크 ' + chk0 + ')');
  expect((await $('.modal .preview tr.st-holiday', { hasText: '9/24' }).count()) >= 1, 'AC6: 9/24 추석 행 휴업일 제외');
  expect(!(await createBtn.isDisabled()), '미리보기 후 생성 버튼 활성');
  await $('.modal .preview input[data-row]:checked').first().click(); await sleep(350);
  const rows1 = await $('.modal .preview tbody tr').count();
  const chk1 = await $('.modal .preview input[data-row]:checked').count();
  const sum1 = (await $('.modal .validate').textContent()).trim();
  log(`after uncheck rows=${rows1} checked=${chk1} summary=${sum1}`);
  expect(rows1 === rows0, 'F-01: 체크 해제 후 미리보기 표 유지(' + rows1 + '/' + rows0 + ')');
  expect(chk1 === chk0 - 1, 'F-01: 체크 수 1 감소');
  expect(new RegExp(`^${chk0 - 1}건 생성`).test(sum1), 'F-01: 요약 건수 감소 반영(' + sum1 + ')');
  expect(!(await createBtn.isDisabled()), 'F-01: 생성 버튼 활성 유지');
  await snap('rv-series-after-uncheck');
  await $('.modal .preview input[data-row]:not(:checked)').first().click(); await sleep(300);
  expect((await $('.modal .preview input[data-row]:checked').count()) === chk0, 'F-01: 다시 체크 → 원복');
  const onlyFirst = await page.evaluate(() => { const boxes = Array.from(document.querySelectorAll('.modal .preview input[data-row]')); boxes.slice(1).forEach(b => { if (b.checked) b.click(); }); return { checked: boxes.filter(b => b.checked).length, rows: document.querySelectorAll('.modal .preview tbody tr').length, label: boxes[0].getAttribute('aria-label') }; });
  log('onlyFirst=' + JSON.stringify(onlyFirst));
  expect(onlyFirst.checked === 1 && onlyFirst.rows === rows0, '첫 행만 체크 상태로 조정(표 유지)');
  await clearToasts(); await createBtn.click(); await sleep(500);
  const s1 = await st();
  const newSeries = s1.data.series.filter(x => !s0.data.series.some(y => y.id === x.id));
  const created = newSeries.length ? s1.data.bookings.filter(b => b.seriesId === newSeries[0].id) : [];
  log(`created series=${newSeries.length} bookings=${created.length} dates=${created.map(b => b.date).join(',')}`);
  expect(newSeries.length === 1 && created.length === 1 && created[0].date === '2026-09-03' && created[0].periodStart === 1 && created[0].periodEnd === 2, 'F-01: 체크된 1건(9/3 목 1~2교시)만 생성됨');
  expect(/정기 예약 1건/.test(await toasts()), '생성 토스트: 정기 예약 1건');
  expect((await modalCount()) === 0, '생성 후 모달 닫힘');

  // 충돌 행 수동 체크 → 생성 → 같은 셀 블록 2개(C-03 격자 표현)
  await $('[data-act="series"]').click(); await sleep(300);
  await page.selectOption('.modal select[name="resourceId"]', 'r_sci1');
  await page.selectOption('.modal select[name="weekday"]', '2');
  await page.selectOption('.modal select[name="pStart"]', '1');
  await page.selectOption('.modal select[name="pEnd"]', '2');
  await page.selectOption('.modal select[name="classSel"]', '3-1');
  await page.fill('.modal input[name="dateFrom"]', '2026-10-26'); await page.fill('.modal input[name="dateTo"]', '2026-11-06'); await sleep(200);
  await $('.modal-foot [data-act="preview"]').click(); await sleep(400);
  const conf = await $('.modal .preview tr.st-conflict').count();
  const confChecked = await $('.modal .preview tr.st-conflict input:checked').count();
  const sumC = (await $('.modal .validate').textContent()).trim();
  log(`conflict rows=${conf} checked=${confChecked} summary=${sumC}`);
  expect(conf === 2 && confChecked === 0 && /^0건 생성/.test(sumC) && (await createBtn.isDisabled()), '충돌 행(화 1~2교시 5-1 겹침) 기본 해제·생성 비활성');
  await $('.modal .preview tr.st-conflict input[data-row]').first().click(); await sleep(300);
  const sumC2 = (await $('.modal .validate').textContent()).trim();
  expect((await $('.modal .preview tbody tr').count()) === conf && /^1건 생성/.test(sumC2) && !(await createBtn.isDisabled()), 'F-01: 충돌 행 수동 체크 → 표 유지·1건 생성·생성 활성(' + sumC2 + ')');
  await clearToasts(); await createBtn.click(); await sleep(500);
  const s2 = await st();
  const forced = s2.data.bookings.filter(b => b.resourceId === 'r_sci1' && b.date === '2026-10-27' && b.periodStart === 1);
  log('forced=' + JSON.stringify(forced.map(b => [b.id, b.classId, b.seriesId])));
  expect(forced.length === 2, '충돌 행 강제 생성 → 같은 자원·날짜·교시 예약 2건');
  await act('selectResource', 'r_sci1'); await act('goWeek', '2026-10-26'); await sleep(300);
  const dup = await page.evaluate(() => {
    const bl = Array.from(document.querySelectorAll('.block[data-day="2"]')).filter(b => b.style.gridRowStart === '2');
    const r = bl.map(b => { const x = b.getBoundingClientRect(); return { id: b.dataset.bookingId, x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.width), h: Math.round(x.height), dup: b.classList.contains('dup'), conflict: b.classList.contains('conflict'), badge: Array.from(b.querySelectorAll('.badge')).map(i => i.textContent).join('/'), z: getComputedStyle(b).zIndex, text: b.textContent.replace(/\s+/g, ' ').trim() }; });
    let firstVisible = false, first = null;
    if (bl.length === 2) { const a = bl[0].getBoundingClientRect(); first = { x: a.x + 6, y: a.y + 6 }; const el = document.elementFromPoint(a.x + 6, a.y + 6); firstVisible = !!el && bl[0].contains(el); }
    return { n: bl.length, r, firstVisible, first };
  });
  log('dup=' + JSON.stringify(dup));
  expect(dup.n === 2, 'C-03: 같은 셀에 블록 2개 렌더');
  expect(dup.n === 2 && (dup.r[1].x - dup.r[0].x >= 12) && (dup.r[1].y - dup.r[0].y >= 12), 'C-03: 두 번째 블록이 비켜 쌓임(완전 겹침 아님)');
  expect(dup.n === 2 && dup.r[1].dup && /중복/.test(dup.r[1].badge) && !dup.r[0].dup, 'C-03: 두 번째 블록에 중복 배지');
  expect(dup.firstVisible, 'C-03: 첫 블록 좌상단이 가려지지 않음');
  await snap('rv-dup-block');
  if (dup.first) {
    await page.mouse.click(dup.first.x, dup.first.y); await sleep(350);
    const edit = await page.evaluate(() => { const m = document.querySelector('.modal-backdrop:not(.closing) .modal'); if (!m) return null; return { title: m.querySelector('h2').textContent, cls: m.querySelector('select[name="classSel"]').value }; });
    log('edit=' + JSON.stringify(edit));
    expect(!!edit && /예약 수정/.test(edit.title) && edit.cls === '5-1', 'C-03: 첫(원래) 블록 클릭 → 5-1 수정 모달');
    await closeAll();
  }
  // 정리: 강제 생성 건 삭제
  const forcedNew = forced.find(b => b.classId === '3-1');
  if (forcedNew) await page.evaluate(id => window.__app.actions.deleteBooking(id), forcedNew.id);
  await sleep(200);
  const good = (await st()).data; const nGood = good.bookings.length; log('baseline bookings=' + nGood);

  // ───────── 2. F-02/C-01 손상 JSON 가져오기
  await clearToasts();
  const corrupt1 = { meta: { app: 'special-room-booking', version: 1 }, settings: { periods: good.settings.periods }, resources: [], classes: [], teachers: [], events: [], series: [], bookings: [null, { id: 'x' }] };
  const r1 = await page.evaluate(o => window.__app.actions.importData(o, 'replace'), corrupt1); await sleep(400);
  const t1 = await toasts();
  const ls1 = await page.evaluate(() => { try { const d = JSON.parse(localStorage.getItem('srb.v1.data')); return { n: d.bookings.length, hasNull: d.bookings.some(b => b === null), res: d.resources.length, school: d.settings.schoolName }; } catch (e) { return { err: String(e) }; } });
  log(`corrupt1 ret=${r1} toast=${t1} ls=${JSON.stringify(ls1)}`);
  expect(r1 === true && /손상 항목 2건/.test(t1), 'F-02: 손상 항목 2건 제외 토스트');
  expect(ls1.n === 0 && ls1.hasNull === false, 'F-02: 손상 항목(null)이 localStorage에 저장되지 않음');
  expect((await $('[data-view="board"] .empty').count()) === 1, 'F-02: 교체 직후 화면 갱신(자원 0 → 빈 상태 카드)');
  await reload();
  const alive1 = await page.evaluate(() => { const v = document.querySelector('[data-view]:not([hidden])'); return { app: !!window.__app, view: v ? v.dataset.view : null, len: v ? v.innerHTML.length : 0, modal: document.querySelectorAll('.modal-backdrop').length, tabs: document.querySelectorAll('.tabs [role="tab"]').length }; });
  log('after reload: ' + JSON.stringify(alive1));
  expect(alive1.app && alive1.len > 100, 'F-02: 새로고침 후 앱 동작(백지 아님)');
  await act('selectTab', 'stats'); await sleep(200);
  expect((await $('[data-view="stats"] .empty').count()) === 1, '빈 데이터 통계 탭 빈 상태 문구');
  await act('selectTab', 'board'); await sleep(200);
  await clearToasts();
  const rr = await page.evaluate(o => window.__app.actions.importData(o, 'replace'), good); await sleep(400);
  const tr = await toasts();
  expect(rr === true && (await st()).data.bookings.length === nGood && !/손상/.test(tr), '정상 데이터 교체 복원(정규화에서 손상 처리 없음): ' + tr);

  // C-01: 항목 필드 누락(availablePeriods·blockResourceIds 없음)
  await clearToasts();
  const broken = { meta: { app: 'special-room-booking', version: 1 }, settings: good.settings, resources: [{ id: 'r_x', name: '엑스실', type: 'room', active: true }], classes: [{ id: '3-1' }], teachers: [], events: [{ id: 'e_x', title: '행사', type: 'event', dateStart: '2026-10-27', dateEnd: '2026-10-27' }], series: [], bookings: [{ id: 'b_x', resourceId: 'r_x', date: '2026-10-28', periodStart: 2, periodEnd: 3 }] };
  const r2 = await page.evaluate(o => window.__app.actions.importData(o, 'replace'), broken); await sleep(400);
  await act('selectTab', 'board'); await sleep(300);
  const b2 = await page.evaluate(() => ({ cells: document.querySelectorAll('.cell').length, blocks: document.querySelectorAll('.block').length, chips: document.querySelectorAll('.chip[data-resource]').length }));
  const s3 = await st();
  log('broken import → ' + JSON.stringify(b2) + ' toast=' + (await toasts()));
  expect(r2 === true && b2.cells === 40 && b2.blocks === 1 && b2.chips === 1, 'C-01: 필드 누락 자원·예약 교체 후 예약판 정상 렌더 ' + JSON.stringify(b2));
  expect(Array.isArray(s3.data.resources[0].availablePeriods) && s3.data.resources[0].availablePeriods.length === 8 && Array.isArray(s3.data.events[0].blockResourceIds) && s3.data.events[0].blockPeriods === 'all' && s3.data.bookings[0].qty === 1 && s3.data.bookings[0].used === null, 'C-01: 기본값 보충(availablePeriods·blockResourceIds·blockPeriods·qty·used)');
  await act('selectTab', 'calendar'); await sleep(300);
  expect((await $('.event-list li').count()) === 1 && (await $('.cal-cell').count()) > 28, 'C-01: 학사일정 달력·목록 렌더');
  await act('selectTab', 'stats'); await sleep(300);
  expect((await $('[data-view="stats"] svg.chart').count()) === 4, 'C-01: 통계 탭 차트 4종 렌더');
  await act('selectTab', 'board'); await sleep(200);

  // 병합 모드에서 손상 항목
  await clearToasts();
  await page.evaluate(o => window.__app.actions.importData(o, 'replace'), good); await sleep(300); await clearToasts();
  const mergeObj = { meta: { app: 'special-room-booking', version: 1 }, settings: good.settings, resources: [], classes: [], teachers: [], events: [], series: [], bookings: [null, 'junk', { id: 'b_m1', resourceId: 'r_sci1', date: '2026-12-02', periodStart: 1, periodEnd: 1, classId: '3-1', teacherId: 't_07', tag: '실험', qty: 1, createdAt: 5, updatedAt: 5 }, { id: 'b_m2', resourceId: 'r_sci1', date: 'bad-date', periodStart: 1, periodEnd: 1 }, { id: 'b_"x', resourceId: 'r_sci1', date: '2026-12-02', periodStart: 2, periodEnd: 2 }] };
  const r3 = await page.evaluate(o => window.__app.actions.importData(o, 'merge'), mergeObj); await sleep(400);
  const t3 = await toasts(); const s4 = await st();
  log('merge corrupt → ' + t3 + ' bookings=' + s4.data.bookings.length);
  expect(r3 === true && /손상 항목 4건/.test(t3) && s4.data.bookings.length === nGood + 1 && s4.data.bookings.some(b => b.id === 'b_m1') && !s4.data.bookings.some(b => b.id === 'b_"x'), 'F-02/C-16: 병합 시 손상·불량 id 항목 제외, 정상 항목만 추가');
  await page.evaluate(() => window.__app.actions.deleteBooking('b_m1')); await sleep(200);

  // 기동 경로: 손상된 저장 데이터
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('srb.v1.data')); d.bookings[0] = null; delete d.resources[0].availablePeriods; d.events.push({ id: 'e_bad' }); localStorage.setItem('srb.v1.data', JSON.stringify(d)); });
  await reload(); await sleep(300);
  const s5 = await st().catch(() => null); const t5 = await toasts();
  const grid5 = await page.evaluate(() => document.querySelectorAll('.cell').length);
  log('init corrupt → ' + t5 + ' bookings=' + (s5 ? s5.data.bookings.length : 'n/a') + ' cells=' + grid5);
  expect(!!s5 && s5.data.bookings.length === nGood - 1 && s5.data.resources[0].availablePeriods.length === 8 && !s5.data.events.some(e => e.id === 'e_bad'), 'F-02: 손상된 저장 데이터로 기동 시 손상 항목 제외하고 정상 기동');
  expect(/손상 항목 2건/.test(t5) && grid5 === 40, 'F-02: 기동 시 안내 토스트·격자 렌더');
  await page.evaluate(o => window.__app.actions.importData(o, 'replace'), good); await sleep(300);
  expect((await st()).data.bookings.length === nGood, '기준 데이터 복원');

  // ───────── 3. U-01 글자 크기, C-04/U-13 터치 타깃, U-05 수량형 칩, U-07 차단 라벨
  await act('selectResource', 'r_sci1'); await act('goWeek', '2026-10-26'); await sleep(300);
  const fsz = await page.evaluate(() => { const g = (s, p = 'fontSize') => { const e = document.querySelector(s); return e ? Math.round(parseFloat(getComputedStyle(e)[p]) * 10) / 10 : null; }; const h = s => Math.round(document.querySelector(s).getBoundingClientRect().height); return { block: g('.block'), blockB: g('.block b'), blockSpan: g('.block span'), cell: g('.cell'), phB: g('.ph b'), phSpan: g('.ph span'), chipH: h('.chip'), btnSmH: h('.btn-sm'), dateH: h('.week-nav .input'), role: document.querySelector('.grid').getAttribute('role') }; });
  log('fonts=' + JSON.stringify(fsz));
  expect(fsz.block >= 13.5 && fsz.blockSpan >= 12 && fsz.cell >= 12.5 && fsz.phSpan >= 12 && fsz.phB >= 14, 'U-01: 격자 글자 확대(블록 ' + fsz.block + 'px, 태그 ' + fsz.blockSpan + 'px, 셀 ' + fsz.cell + 'px)');
  expect(fsz.chipH >= 44 && fsz.btnSmH >= 44 && fsz.dateH >= 44, 'C-04/U-13: 칩·btn-sm·날짜 입력 44px 이상');
  expect(fsz.role === 'group', 'C-12: 격자 role=group');
  await shot('rv-board-desktop');
  await act('selectResource', 'r_tab'); await act('goWeek', '2026-10-19'); await sleep(300);
  const eq = await page.evaluate(() => { const cell = document.querySelector('.cell[data-date="2026-10-20"][data-period="3"]'); const chips = Array.from(cell.querySelectorAll('.eq-chip')); return { n: chips.length, texts: chips.map(c => c.textContent.replace(/\s+/g, ' ').trim()), h: chips.map(c => Math.round(c.getBoundingClientRect().height)), w: chips.map(c => Math.round(c.getBoundingClientRect().width)), cellW: Math.round(cell.getBoundingClientRect().width), fs: chips.length ? parseFloat(getComputedStyle(chips[0]).fontSize) : 0, left: (cell.querySelector('.left') || {}).textContent, full: cell.classList.contains('full') }; });
  log('eq=' + JSON.stringify(eq));
  expect(eq.n === 2 && eq.texts.every(t => /(표지원|설다정)/.test(t) && /탐구/.test(t) && /3-[23]/.test(t)), 'U-05: 수량형 칩에 학급·교사·태그 표시');
  expect(eq.h.every(x => x >= 32) && eq.w.every(x => x >= eq.cellW - 14) && eq.fs >= 12.5, 'U-05: 칩 높이 32px 이상·셀 폭 전체·글자 확대(' + eq.h + ', ' + eq.fs + 'px)');
  expect(eq.full && /2\/2 사용 중/.test(eq.left || ''), 'AC4: 샘플 10/20 3교시 태블릿 2/2 사용 중');
  await act('selectResource', 'r_gym'); await act('goWeek', '2026-11-09'); await sleep(300);
  const lab = await page.evaluate(() => { const col = Array.from(document.querySelectorAll('.cell[data-date="2026-11-10"]')); return { blocked: col.filter(c => c.classList.contains('blocked')).length, labels: col.reduce((a, c) => a + c.querySelectorAll('.blk-label').length, 0), firstLabel: (col[0].querySelector('.blk-label') || {}).textContent, conflictBlocks: document.querySelectorAll('.block.conflict').length, badges: Array.from(document.querySelectorAll('.block .badge-danger')).map(b => b.textContent) }; });
  log('blocked col=' + JSON.stringify(lab));
  expect(lab.blocked === 8 && lab.labels === 1 && /학예회 리허설/.test(lab.firstLabel || ''), 'U-07: 연속 차단 셀은 첫 셀에만 사유 라벨');
  expect(lab.conflictBlocks >= 3 && lab.badges.filter(b => b === '충돌').length >= 3, '차단 기간 강당 예약 3건 충돌 배지');
  await shot('rv-gym-conflict-week');

  // ───────── 4. U-04 인쇄 서식
  await act('selectResource', 'r_sci1'); await act('goWeek', '2026-10-19'); await sleep(200);
  await $('[data-act="print-week"]').click(); await sleep(500);
  const pr = await page.evaluate(() => { const pg = document.querySelector('.modal .paper .print-page'); const td = pg.querySelector('.wk tbody td'); const th = pg.querySelector('.wk thead th'); const foot = pg.querySelector('.print-foot'); return { tdFs: parseFloat(getComputedStyle(td).fontSize), thFs: parseFloat(getComputedStyle(th).fontSize), tdH: Math.round(td.getBoundingClientRect().height), footFs: parseFloat(getComputedStyle(foot).fontSize), pages: document.querySelectorAll('.modal .paper .print-page').length, rowVar: getComputedStyle(pg).getPropertyValue('--wk-row').trim(), head: pg.querySelector('.print-head').textContent.replace(/\s+/g, ' ').trim(), approvalThs: Array.from(pg.querySelectorAll('.approval th')).map(t => t.textContent), paperW: Math.round(pg.closest('.paper').getBoundingClientRect().width), tableH: Math.round(pg.querySelector('.wk').getBoundingClientRect().height) }; });
  log('print=' + JSON.stringify(pr));
  expect(pr.tdFs >= 13 && pr.thFs >= 13 && pr.tdH >= 56 && pr.footFs >= 10, 'U-04: 인쇄 셀 글자 13px·행 높이 58px·각주 10px');
  expect(pr.pages === 10 && /가온초등학교/.test(pr.head) && /특별실 주간 이용 현황표/.test(pr.head) && /10\/19~10\/23/.test(pr.head) && pr.approvalThs.join('/') === '결재/담당/부장/교감', 'AC7: 자원당 1쪽·학교명·제목·주차·결재란 3칸');
  await snap('rv-print-weekly');
  await closeAll();

  // ───────── 5. 모바일 400px: U-02, U-03, U-06, U-14, 가로 스크롤
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(450);
  await act('selectResource', 'r_sci1'); await act('goWeek', '2026-10-26'); await sleep(300);
  expect((await $('.day-tabs button').count()) === 5 && (await $('.gh.day').count()) === 1 && (await $('.cell').count()) === 8, 'AC11: 400px 요일 탭 5개·한 열');
  expect(await noHScroll(), '400px 예약판 가로 스크롤 없음');
  const nav = await page.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return { prev: r('[data-act="prev-week"]'), label: r('.week-label'), next: r('[data-act="next-week"]'), thisW: r('[data-act="this-week"]'), input: r('[data-act="pick-week"]') }; });
  log('nav=' + JSON.stringify(nav));
  const labelInRow = nav.label[1] >= nav.prev[1] && nav.label[1] + nav.label[3] <= nav.prev[1] + nav.prev[3] && nav.label[0] > nav.prev[0] + nav.prev[2] && nav.label[0] + nav.label[2] <= nav.next[0]; // 라벨은 ◀ ▶ 사이에 세로 가운데 정렬
  expect(nav.prev[1] === nav.next[1] && nav.thisW[1] > nav.prev[1] && Math.abs(nav.input[1] - nav.thisW[1]) < 6 && labelInRow, 'U-14: 모바일 주 내비 2행(◀ 라벨 ▶ / 이번 주·날짜)');
  await shot('rv-mobile-board');
  // U-02 충돌 모달(화 1~2교시 과학실1 = 5-1 정기 예약 자리)
  await page.evaluate(() => { window.__app.actions.openBookingModal({ resourceId: 'r_sci1', date: '2026-10-27', pStart: 1, pEnd: 2 }); }); await sleep(400);
  await page.selectOption('.modal select[name="classSel"]', '4-1'); await sleep(300);
  const u2 = await page.evaluate(() => { const ih = window.innerHeight; const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; }; const body = document.querySelector('.modal .modal-body'); return { ih, verdict: r('.modal .verdict'), bad: r('.modal .validate .bad'), alt: r('.modal .chip.alt'), alts: document.querySelectorAll('.modal .chip.alt').length, saveDisabled: document.querySelector('.modal-foot [data-act="save"]').disabled, bodyScrollTop: body.scrollTop, bodyScrollable: body.scrollHeight > body.clientHeight + 1, pos: getComputedStyle(document.querySelector('.modal .verdict')).position, reasons: Array.from(document.querySelectorAll('.modal .validate li')).map(l => l.textContent), modalW: Math.round(document.querySelector('.modal').getBoundingClientRect().width) }; });
  log('u2=' + JSON.stringify(u2));
  expect(u2.saveDisabled && u2.alts >= 1 && u2.alts <= 3 && u2.reasons.some(x => /5-1/.test(x)), 'AC3(모바일): 충돌 모달 저장 비활성·사유·대안 칩 1~3개');
  expect(u2.pos === 'sticky' && u2.bodyScrollable && u2.bodyScrollTop === 0 && u2.verdict && u2.verdict.top >= 0 && u2.verdict.bottom <= u2.ih && u2.bad && u2.bad.bottom <= u2.ih && u2.alt && u2.alt.bottom <= u2.ih, 'U-02: 스크롤하지 않아도 검증 결과·대안 칩이 화면 안에 보임(sticky)');
  expect(u2.modalW >= 398, 'AC11: 모바일 시트형 전체 폭 모달');
  await snap('rv-mobile-conflict-modal');
  await $('.modal .chip.alt').first().click(); await sleep(300);
  expect((await $('.modal .validate .ok').count()) === 1 && !(await $('.modal-foot [data-act="save"]').isDisabled()), 'AC3: 대안 칩 클릭 → 녹색 예약 가능·저장 활성');
  await closeAll();
  // U-03 미확인 예약 표
  expect((await $('[data-act="unchecked"]').count()) === 1, '지난 예약 미확인 링크 표시');
  await $('[data-act="unchecked"]').click(); await sleep(400);
  const u3 = await page.evaluate(() => { const tr = document.querySelector('.modal tbody tr'); const tds = Array.from(tr.querySelectorAll('td')); const wrap = document.querySelector('.modal .table-wrap'); return { rows: document.querySelectorAll('.modal tbody tr').length, trH: Math.round(tr.getBoundingClientRect().height), ws: tds.map(td => getComputedStyle(td).whiteSpace), texts: tds.slice(0, 4).map(td => td.textContent.trim()), wrapScroll: wrap.scrollWidth > wrap.clientWidth, tableW: wrap.scrollWidth, wrapW: wrap.clientWidth, btnText: tr.querySelector('[data-mark="false"]').textContent, btnH: Math.round(tr.querySelector('[data-mark="false"]').getBoundingClientRect().height) }; });
  log('u3=' + JSON.stringify(u3));
  expect(u3.ws.every(w => w === 'nowrap') && u3.trH <= 66 && u3.texts[1].length >= 2, 'U-03: 표 셀 nowrap·한 줄 행(' + u3.trH + 'px) ' + JSON.stringify(u3.texts));
  expect(u3.wrapScroll && (await noHScroll()), 'U-03: 표는 .table-wrap 안에서 가로 스크롤, 페이지 가로 스크롤 없음');
  await snap('rv-mobile-unchecked-modal');
  await closeAll();
  // U-06 통계
  await act('selectTab', 'stats'); await sleep(500);
  const u6 = await page.evaluate(() => { const wraps = Array.from(document.querySelectorAll('[data-view="stats"] .chart-wrap')); const charts = Array.from(document.querySelectorAll('[data-view="stats"] svg.chart')); return { charts: charts.length, widths: charts.map(c => Math.round(c.getBoundingClientRect().width)), scrolls: wraps.map(w => w.scrollWidth > w.clientWidth + 1), textFs: charts.map(c => { const t = c.querySelector('text'); return t ? parseFloat(getComputedStyle(t).fontSize) : null; }), lowmarks: document.querySelectorAll('.heat polygon.lowmark').length, lowText: Array.from(document.querySelectorAll('.heat text')).filter(t => /저조/.test(t.textContent)).length, low53: Array.from(document.querySelectorAll('.low-list li')).some(li => /5-3/.test(li.textContent)), kpi: Array.from(document.querySelectorAll('.kpi b')).map(b => b.textContent) }; });
  log('u6=' + JSON.stringify(u6));
  expect(u6.charts === 4 && u6.widths.every(w => w >= 360) && u6.textFs.every(f => f >= 12) && u6.scrolls.filter(Boolean).length >= 3, 'U-06: 400px 차트 축소 없음(컨테이너 가로 스크롤)·라벨 12px 이상');
  expect(await noHScroll(), 'U-06: 통계 탭 페이지 가로 스크롤 없음');
  expect(u6.lowmarks >= 1 && u6.lowText === 0 && u6.low53, 'C-13/U-11/AC8: 저조 표시는 모서리 삼각형(텍스트 겹침 없음)·저조 목록에 5-3');
  await shot('rv-mobile-stats');
  for (const t of ['calendar', 'resources', 'settings']) { await act('selectTab', t); await sleep(300); expect(await noHScroll(), '400px ' + t + ' 탭 가로 스크롤 없음'); }
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(400);
  await act('selectTab', 'board'); await sleep(300);
  expect((await $('.gh.day').count()) === 5, '데스크톱 복귀 시 5열 격자');
  log('done');
};
