// 특별실지기 QA — JSON/CSV 입출력, 새 학기 초기화, 가져오기 검증·병합, 샘플 복원, 설정(학교·결재란·교시), 빈 상태, 메모리 모드 (AC9)
'use strict';
const fs = require('fs'); const path = require('path');
module.exports = async (h) => {
  const { page, expect, shot, log, sleep, reload } = h;
  const { $, modal, modalCount, state, startSample, closeModal, closeAll, tab, lastToast } = require('./_helpers')(h);
  const outDir = path.join(__dirname, 'out-data', 'files'); fs.mkdirSync(outDir, { recursive: true });
  await startSample();
  const n0 = (await state()).data.bookings.length;
  await tab('settings');
  expect(await $('[data-form="school"]').count() === 1 && await $('[data-form="periods"]').count() === 1 && await $('[data-form="approval"]').count() === 1 && await $('.dropzone').count() === 1 && (await $('[data-view="settings"]').textContent()).includes('공용 PC 1대 운영'), '설정 화면 구성(학교·교시·결재란·데이터·운영 안내)');

  // ── AC9 JSON 내보내기
  const [dl] = await Promise.all([page.waitForEvent('download'), $('[data-act="export-json"]').click()]);
  const fname = dl.suggestedFilename(); const jsonPath = path.join(outDir, fname); await dl.saveAs(jsonPath);
  expect(/^special-room-booking_\d{8}\.json$/.test(fname), 'AC9 JSON 파일명: ' + fname);
  const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  expect(exported.meta.app === 'special-room-booking' && exported.meta.version === 1 && exported.meta.savedAt > 0 && exported.bookings.length === n0 && exported.series.length === 10 && exported.events.length === 10 && exported.settings.periods.length === 8, 'AC9 내보낸 JSON 구조·예약 ' + n0 + '건');
  expect(await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('srb.v1.data')); return d.meta.app === 'special-room-booking' && Array.isArray(d.bookings); }), "localStorage 'srb.v1.data' 구조");
  // ── 예약 CSV
  const [dl2] = await Promise.all([page.waitForEvent('download'), $('[data-act="export-csv"]').click()]);
  const csv = fs.readFileSync(await dl2.path(), 'utf8'); const lines = csv.split('\r\n');
  expect(/^special-room-booking_bookings_\d{8}\.csv$/.test(dl2.suggestedFilename()) && csv.charCodeAt(0) === 0xFEFF, '예약 CSV 파일명·BOM');
  expect(lines[0] === '﻿날짜,요일,교시,자원,학급,교사,태그,수량,사용여부,메모' && lines.length === n0 + 1 && /^\d{4}-\d{2}-\d{2},[월화수목금],/.test(lines[1]), '예약 CSV 헤더·행 수·날짜 형식');
  expect(lines.some(l => l.includes(',사용 안 함,')) && lines.some(l => l.includes(',사용함,')) && lines.some(l => l.includes(',미확인,')), 'CSV 사용여부 3종 표기');
  await page.evaluate(() => { window.__app.actions.addBooking({ resourceId: 'r_music', date: '2026-12-01', periodStart: 7, periodEnd: 7, classId: '1-1', teacherId: 't_01', tag: '기타', memo: '쉼표, "따옴표"\n줄바꿈' }); });
  const [dl3] = await Promise.all([page.waitForEvent('download'), $('[data-act="export-csv"]').click()]);
  const csv3 = fs.readFileSync(await dl3.path(), 'utf8');
  expect(csv3.includes('"쉼표, ""따옴표""\n줄바꿈"'), 'CSV RFC4180 이스케이프(큰따옴표 감싸기·내부 따옴표 2회)');
  await page.evaluate(() => { const st = window.__app.getState(); const b = st.data.bookings.find(x => x.memo && x.memo.startsWith('쉼표')); window.__app.actions.deleteBooking(b.id); });

  // ── AC9 새 학기 초기화
  await $('[data-act="reset-semester"]').click(); await sleep(250);
  expect(await modalCount() === 1 && await modal().locator('[data-result="ok"]').isDisabled(), "초기화 모달: '초기화' 입력 전 버튼 비활성");
  await modal().locator('input[name="confirm"]').fill('초기'); await sleep(100);
  expect(await modal().locator('[data-result="ok"]').isDisabled(), '부분 입력 시 비활성');
  await modal().locator('input[name="confirm"]').fill('초기화'); await sleep(100);
  expect(!(await modal().locator('[data-result="ok"]').isDisabled()), "'초기화' 입력 → 활성");
  await modal().locator('[data-result="ok"]').click(); await sleep(400);
  const s1 = await state();
  expect(s1.data.bookings.length === 0 && s1.data.series.length === 0 && s1.data.events.length === 0 && s1.data.resources.length === 10 && s1.data.classes.length === 18 && s1.data.teachers.length === 23 && s1.data.settings.schoolName === '경인초등학교', 'AC9 초기화: 예약·시리즈·일정 삭제, 자원·명단·설정 유지');
  await tab('board');
  expect(await $('.chip[data-resource]').count() === 10 && await $('.grid .block').count() === 0 && (await $('.summary').textContent()).includes('예약 0건'), 'AC9 예약판 비고 칩 유지');
  await shot('data-01-after-reset');
  await reload(); await sleep(300);
  expect((await state()).data.bookings.length === 0 && await $('.modal-backdrop').count() === 0, '초기화 상태 새로고침 후 유지');
  await tab('settings');

  // ── 잘못된 JSON → 토스트 + 데이터 유지
  const dropText = async (text, name) => { await page.evaluate(({ text, name }) => { const dz = document.querySelector('.dropzone'); const dt = new DataTransfer(); dt.items.add(new File([text], name, { type: 'application/json' })); dz.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); dz.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, { text, name }); await sleep(450); };
  await page.evaluate(() => { const dz = document.querySelector('.dropzone'); dz.dispatchEvent(new DragEvent('dragover', { dataTransfer: new DataTransfer(), bubbles: true, cancelable: true })); });
  expect(await page.evaluate(() => document.querySelector('.dropzone').classList.contains('over')), 'dragover 시 드롭존 강조');
  await dropText('{broken json', 'broken.json');
  expect((await lastToast()).includes('올바른 백업 파일이 아닙니다') && await modalCount() === 0 && !(await page.evaluate(() => document.querySelector('.dropzone').classList.contains('over'))), '손상 JSON → 토스트, 모달 없음, 강조 해제');
  await dropText('', 'empty.json');
  expect((await lastToast()).includes('올바른 백업 파일이 아닙니다'), '빈 파일 → 토스트');
  await dropText(JSON.stringify({ meta: { app: 'other-app', version: 1 }, bookings: [] }), 'other.json');
  expect((await lastToast()).includes('올바른 백업 파일이 아닙니다'), '다른 앱 파일 → 토스트');
  const missing = Object.assign({}, exported); delete missing.events;
  await dropText(JSON.stringify(missing), 'missing.json');
  expect((await lastToast()).includes('events 누락'), '필수 배열 누락 → 토스트');
  await dropText('[1,2,3]', 'array.json');
  expect((await lastToast()).includes('올바른 백업 파일이 아닙니다'), '배열 JSON → 토스트');
  expect((await state()).data.bookings.length === 0 && (await state()).data.resources.length === 10, '잘못된 가져오기 후 데이터 유지');
  // ── AC9 정상 파일 드롭 → 교체
  await dropText(fs.readFileSync(jsonPath, 'utf8'), fname);
  expect(await modalCount() === 1 && (await modal().textContent()).includes(`예약 ${n0}건`) && (await modal().textContent()).includes(fname) && await modal().locator('[data-result="replace"]').count() === 1 && await modal().locator('[data-result="merge"]').count() === 1, 'AC9 드롭 → 검증 후 교체/병합 선택 모달');
  await shot('data-02-import-modal');
  await modal().locator('[data-result=""]').click(); await sleep(250);
  expect((await state()).data.bookings.length === 0, '가져오기 취소 시 변경 없음');
  await dropText(fs.readFileSync(jsonPath, 'utf8'), fname);
  await modal().locator('[data-result="replace"]').click(); await sleep(500);
  const s2 = await state();
  expect(s2.data.bookings.length === n0 && s2.data.events.length === 10 && s2.data.series.length === 10, `AC9 교체 후 예약 ${s2.data.bookings.length} = 초기화 전 ${n0}`);
  expect((await lastToast()).includes(`교체했습니다(예약 ${n0}건)`), '교체 토스트');
  await tab('board'); expect(await $('.grid .block').count() >= 1 && (await $('.summary').textContent()).match(/예약 [1-9]\d*건/), '교체 후 예약판 블록 복원'); await tab('settings');
  // ── 병합
  const mod = JSON.parse(JSON.stringify(exported));
  mod.bookings[0].memo = '병합 최신'; mod.bookings[0].updatedAt = Date.now() + 1000;
  mod.bookings[1].memo = '병합 과거'; mod.bookings[1].updatedAt = 1;
  mod.bookings.push({ id: 'b_merge_new', resourceId: 'r_sci1', date: mod.bookings[0].date, periodStart: mod.bookings[0].periodStart, periodEnd: mod.bookings[0].periodEnd, classId: '1-1', teacherId: 't_01', tag: '기타', qty: 1, memo: '', seriesId: null, used: null, createdAt: 1, updatedAt: 1 });
  mod.teachers.push({ id: 't_merge', name: '병합교사', role: '담임' });
  mod.settings.schoolName = '다른학교';
  await dropText(JSON.stringify(mod), 'merge.json');
  await modal().locator('[data-result="merge"]').click(); await sleep(500);
  const s3 = await state();
  const b0 = s3.data.bookings.find(x => x.id === mod.bookings[0].id), b1 = s3.data.bookings.find(x => x.id === mod.bookings[1].id);
  expect(s3.data.bookings.length === n0 + 1 && b0.memo === '병합 최신' && b1.memo !== '병합 과거' && s3.data.settings.schoolName === '경인초등학교' && s3.data.teachers.length === 24, '병합: 최신 우선·과거 무시·설정 유지·신규 추가');
  expect(/초과 예약 2건 확인 필요/.test(await lastToast()), '병합 후 초과 예약 재검사 토스트(겹친 2건): ' + await lastToast());
  await page.evaluate(() => { window.__app.actions.deleteBooking('b_merge_new'); });
  // ── 파일 선택 input 경로
  await page.setInputFiles('.dropzone input[type="file"]', { name: 'pick.json', mimeType: 'application/json', buffer: fs.readFileSync(jsonPath) }); await sleep(450);
  expect(await modalCount() === 1 && (await modal().textContent()).includes('pick.json'), '파일 선택 input 경로도 가져오기 모달');
  await modal().locator('[data-result=""]').click(); await sleep(250);
  // ── 스키마는 통과하지만 항목이 손상된 파일(bookings:[null])
  await page.evaluate(() => { window.__errs = []; window.addEventListener('error', e => window.__errs.push('error: ' + e.message)); window.__addEventListener = true; window.addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + (e.reason && e.reason.message))); });
  const corrupt = Object.assign({}, exported, { bookings: [null, { id: 'x' }] });
  await dropText(JSON.stringify(corrupt), 'corrupt.json');
  if (await modalCount()) { await modal().locator('[data-result="replace"]').click(); await sleep(500); }
  const crash = await page.evaluate(() => ({ errs: window.__errs, saved: (() => { try { const d = JSON.parse(localStorage.getItem('srb.v1.data')); return d.bookings.length + ':' + String(d.bookings[0]); } catch (e) { return 'err'; } })(), toast: [...document.querySelectorAll('.toast')].map(t => t.textContent), boardHtml: document.querySelector('[data-view="board"]').innerHTML.length, stateBookings: window.__app.getState().data.bookings.length }));
  log('corrupt import → ' + JSON.stringify(crash));
  expect(!crash.saved.startsWith('2:null'), '항목 손상(null) JSON이 localStorage에 그대로 저장되지 않음: saved=' + crash.saved);
  expect(crash.toast.some(t => t.includes('교체했습니다')), '손상 파일 교체 후 사용자 피드백 토스트 존재: ' + JSON.stringify(crash.toast));
  await shot('data-03-after-corrupt');
  await reload(); await sleep(500);
  // (fix-r1) 새로고침 시 마지막 탭(설정)이 복원되므로 보이는 뷰의 렌더 여부를 확인한다(예약판 섹션은 탭 전환 전까지 비어 있음)
  const alive = await page.evaluate(() => !!window.__app && !!document.querySelector('.tabs .on') && document.querySelector('[data-view]:not([hidden])').innerHTML.length > 100);
  expect(alive, '손상 항목이 저장된 뒤 새로고침해도 앱 동작(예약판 렌더)');
  await shot('data-04-after-corrupt-reload');
  if (!alive) { await page.evaluate(() => { localStorage.removeItem('srb.v1.data'); }); await reload(); await sleep(400); await startSample(); }
  // ── 샘플 복원
  await tab('settings');
  await $('[data-act="load-sample"]').click(); await sleep(250);
  expect(await modalCount() === 1 && (await modal().textContent()).includes('샘플'), '샘플 복원 확인 모달');
  await modal().locator('[data-result=""]').click(); await sleep(250);
  await $('[data-act="load-sample"]').click(); await sleep(250); await modal().locator('[data-result="ok"]').click(); await sleep(500);
  expect((await state()).data.bookings.length === n0 && (await state()).data.events.length === 10 && (await state()).data.teachers.length === 23 && (await lastToast()).includes('복원'), '샘플 데이터 복원 → 예약 ' + n0 + '건');

  // ── 설정: 학교 정보
  await $('[data-form="school"] input[name="schoolName"]').fill(''); await $('[data-form="school"] button[type="submit"]').click(); await sleep(200);
  expect((await $('[data-form="school"] .validate').textContent()).includes('학교명'), '학교명 빈 값 오류');
  await $('[data-form="school"] input[name="schoolName"]').fill('테스트초'); await $('[data-form="school"] input[name="semesterEnd"]').fill('2026-08-01'); await $('[data-form="school"] button[type="submit"]').click(); await sleep(200);
  expect((await $('[data-form="school"] .validate').textContent()).includes('뒤여야'), '학기 종료일 ≤ 시작일 오류');
  await $('[data-form="school"] input[name="schoolYear"]').fill('1999'); await $('[data-form="school"] input[name="semesterEnd"]').fill('2026-12-31'); await $('[data-form="school"] button[type="submit"]').click(); await sleep(200);
  expect((await $('[data-form="school"] .validate').textContent()).includes('학년도'), '학년도 범위 오류');
  await $('[data-form="school"] input[name="schoolYear"]').fill('2026'); await $('[data-form="school"] button[type="submit"]').click(); await sleep(200);
  expect((await $('#school-label').textContent()).includes('테스트초') && (await state()).data.settings.schoolName === '테스트초', '학교명 저장 → 헤더 반영');
  await $('[data-form="school"] input[name="semesterEnd"]').fill('2026-11-30'); await $('[data-form="school"] button[type="submit"]').click(); await sleep(200);
  expect(/학기 밖 예약 \d+건/.test(await lastToast()) && (await state()).data.settings.semesterEnd === '2026-11-30', '학기 종료일 단축 → 학기 밖 예약 안내 토스트');
  await tab('stats');
  expect((await $('[data-view="stats"] .stats-controls .muted').textContent()).includes('수업일 60일') && await $('[data-stats="month"] option').count() === 3, '학기 기간 변경 → 통계 수업일(9~11월 60일)·월 목록 3개 반영: ' + (await $('[data-view="stats"] .stats-controls .muted').textContent()));
  await tab('board'); await page.evaluate(() => window.__app.actions.goWeek('2026-12-07')); await sleep(200);
  expect(await $('.notice-bar').count() === 1 && await $('.grid .block').count() >= 1, '학기 밖 주: 기존 12월 예약은 흐린 격자에 표시');
  await tab('settings'); await $('[data-form="school"] input[name="semesterEnd"]').fill('2026-12-31'); await $('[data-form="school"] button[type="submit"]').click(); await sleep(200);
  // ── 결재란
  await $('[data-form="approval"] select[name="count"]').selectOption('4'); await sleep(100);
  expect(!(await $('[data-form="approval"] input[name="a3"]').locator('..').isHidden()), '4칸 선택 시 4번째 입력 표시');
  await $('[data-form="approval"] button[type="submit"]').click(); await sleep(200);
  expect((await $('[data-form="approval"] .validate').textContent()).includes('모두 입력'), '빈 직위 → 오류');
  await $('[data-form="approval"] input[name="a3"]').fill('교장'); await $('[data-form="approval"] button[type="submit"]').click(); await sleep(200);
  expect(JSON.stringify((await state()).data.settings.approvalLine) === '["담당","부장","교감","교장"]', '결재란 4칸 저장');
  await tab('board'); await $('[data-act="print-week"]').click(); await sleep(400);
  expect((await modal().locator('.approval').first().locator('th').allTextContents()).join(',') === '결재,담당,부장,교감,교장' && (await modal().locator('.print-head').first().textContent()).includes('테스트초'), '인쇄 결재란 4칸·학교명 반영');
  await closeModal(); await tab('settings');
  await $('[data-form="approval"] select[name="count"]').selectOption('1'); await $('[data-form="approval"] button[type="submit"]').click(); await sleep(200);
  expect((await state()).data.settings.approvalLine.length === 1, '결재란 1칸 저장');
  // ── 교시 구조
  await page.evaluate(() => { window.__app.actions.addBooking({ resourceId: 'r_music', date: '2026-12-02', periodStart: 8, periodEnd: 8, classId: '1-1', teacherId: 't_01', tag: '기타' }); });
  await $('[data-form="periods"] input[name="count"]').fill('6'); await $('[data-form="periods"] input[name="count"]').dispatchEvent('change'); await sleep(100);
  expect(await $('.periods tbody tr').count() === 6, '교시 개수 6 입력 → 표 6행');
  await $('[data-form="periods"] button[type="submit"]').click(); await sleep(200);
  expect((await $('[data-form="periods"] .validate').textContent()).includes('예약 1건이 있어') && (await state()).data.settings.periods.length === 8, '방과후2 예약 존재 → 6교시 축소 차단(건수 안내)');
  await page.evaluate(() => { const st = window.__app.getState(); const b = st.data.bookings.find(x => x.date === '2026-12-02' && x.periodStart === 8); window.__app.actions.deleteBooking(b.id); });
  await $('[data-form="periods"] input[name="count"]').fill('6'); await $('[data-form="periods"] input[name="count"]').dispatchEvent('change'); await sleep(100);
  await $('[data-form="periods"] button[type="submit"]').click(); await sleep(300);
  expect((await state()).data.settings.periods.length === 6 && (await state()).data.resources.every(x => x.availablePeriods.every(p => p <= 6)), '예약 없으면 6교시로 축소 + 자원 교시 정리');
  await $('[data-form="periods"] input[name="count"]').fill('10'); await $('[data-form="periods"] input[name="count"]').dispatchEvent('change'); await sleep(100);
  expect(await $('.periods tbody tr').count() === 10 && (await $('[data-form="periods"] input[name="label8"]').inputValue()) === '9교시', '10개로 확장 시 새 행 기본 라벨');
  await $('[data-form="periods"] input[name="label8"]').fill('돌봄1'); await $('[data-form="periods"] input[name="time8"]').fill('16:30~17:10');
  await $('[data-form="periods"] input[name="label0"]').fill(''); await $('[data-form="periods"] button[type="submit"]').click(); await sleep(300);
  const per = (await state()).data.settings.periods;
  expect(per.length === 10 && per[8].label === '돌봄1' && per[8].time === '16:30~17:10' && per[0].label === '1교시', '교시 10개로 확장 저장(빈 라벨은 이전 값 유지)');
  expect((await state()).data.resources.find(x => x.id === 'r_sci1').availablePeriods.length === 10, '전체 사용 자원은 새 교시 포함');
  await tab('board');
  expect(await $('.grid .ph').count() === 10 && await $('.grid .cell').count() === 50 && (await $('.grid .ph').nth(8).textContent()).includes('돌봄1'), '격자 10행 반영');
  await $('.grid .cell.free').first().click(); await sleep(250);
  expect(await modal().locator('select[name="pStart"] option').count() === 10, '예약 모달 교시 select 10개');
  await closeModal();
  await shot('data-05-periods10');
  await tab('settings');
  await $('[data-form="periods"] input[name="count"]').fill('15'); await $('[data-form="periods"] input[name="count"]').dispatchEvent('change'); await sleep(100);
  expect(await $('.periods tbody tr').count() === 10, '15 입력 → 10 클램프');
  await $('[data-form="periods"] input[name="count"]').fill('2'); await $('[data-form="periods"] input[name="count"]').dispatchEvent('change'); await sleep(100);
  expect(await $('.periods tbody tr').count() === 4, '2 입력 → 4 클램프');

  // ── 온보딩 '빈 상태' 흐름
  await page.evaluate(() => localStorage.clear()); await reload(); await sleep(400);
  expect(await $('[data-result="empty"]').count() === 1, '저장 없음 → 온보딩 재표시');
  await $('[data-result="empty"]').click(); await sleep(400);
  const e0 = await state();
  expect(e0.data.resources.length === 0 && e0.data.bookings.length === 0 && (await $('[data-view="board"] .empty').textContent()).includes('자원을 먼저 등록하세요') && await $('[data-act="go-resources"]').count() === 1, '빈 상태: 안내 카드 + 자원 탭 버튼');
  expect((await $('#school-label').textContent()).includes('우리초등학교'), '빈 상태 기본 학교명');
  await shot('data-06-empty');
  await tab('stats');
  expect((await $('[data-view="stats"] .empty').textContent()).includes('데이터 없음') && await $('[data-view="stats"] svg').count() === 0, '빈 상태 통계: 데이터 없음, 차트 없음');
  await tab('calendar'); expect((await $('[data-view="calendar"]').textContent()).includes('등록된 일정이 없습니다'), '빈 상태 학사일정 안내');
  await tab('board'); await $('[data-act="go-resources"]').click(); await sleep(250);
  expect(await $('[data-view="resources"]').isVisible() && (await $('[data-view="resources"]').textContent()).includes('등록된 자원이 없습니다'), '자원 탭 이동 + 빈 안내');
  await $('[data-act="res-add"]').click(); await sleep(250); await modal().locator('input[name="name"]').fill('새 과학실'); await modal().locator('[data-act="save"]').click(); await sleep(300);
  await tab('board');
  expect(await $('.chip[data-resource]').count() === 1 && await $('.grid .cell').count() === 40, '빈 상태에서 자원 1개 추가 → 격자 표시');
  await reload(); await sleep(400);
  expect(await $('.modal-backdrop').count() === 0 && (await state()).data.resources.length === 1, '빈 상태 모드 새로고침 유지(온보딩 재표시 없음)');
  await $('.grid .cell.free').first().click(); await sleep(250);
  const copt = await modal().locator('select[name="classSel"] option').allTextContents();
  expect(await modalCount() === 1 && copt.includes('기타 직접 입력') && copt.includes('5학년 전체') && await modal().locator('select[name="teacherId"] option').count() === 1, '학급·교사 0명이어도 예약 모달 동작(학년 전체·직접 입력)');
  await modal().locator('select[name="classSel"]').selectOption('grade:3'); await sleep(100);
  expect((await modal().locator('.validate').textContent()).includes('교사를 선택하세요') && await modal().locator('[data-act="save"]').isDisabled(), '교사 없으면 저장 불가 안내');
  await closeModal();
  await page.evaluate(() => { localStorage.removeItem('srb.v1.data'); }); await reload(); await sleep(400);
  expect(await $('.modal-backdrop').count() === 0 && (await state()).data.resources.length === 0 && await $('[data-view="board"] .empty').count() === 1, '빈 모드 + 데이터 손실 시 빈 상태로 복구(온보딩 없음)');
  await $('[data-act="load-sample"]').click(); await sleep(500);
  expect((await state()).data.resources.length === 10 && await $('.grid .block').count() >= 1, "빈 상태 카드의 '샘플 데이터로 시작' 버튼");

  // ── 메모리 모드(setItem 차단) — 마지막 단계
  await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await reload(); await sleep(700);
  expect(!(await $('#mem-banner').isHidden()) && (await $('#save-status').textContent()).includes('메모리 모드') && await $('#save-status.mem').count() === 1, '저장 불가 → 메모리 모드 배너·상태 점 표시');
  expect((await state()).data.bookings.length === n0 && (await state()).memoryMode === true, '메모리 모드에서도 기존 데이터 읽기·동작');
  await page.evaluate(() => { window.__app.actions.addBooking({ resourceId: 'r_music', date: '2026-12-02', periodStart: 7, periodEnd: 7, classId: '1-1', teacherId: 't_01' }); }); await sleep(200);
  expect((await state()).data.bookings.length === n0 + 1 && !(await $('#mem-banner').isHidden()), '메모리 모드에서 예약 추가 동작(예외 없음)');
  await tab('settings');
  const [dl4] = await Promise.all([page.waitForEvent('download'), $('[data-act="export-json"]').click()]);
  expect(JSON.parse(fs.readFileSync(await dl4.path(), 'utf8')).bookings.length === n0 + 1, '메모리 모드에서 JSON 내보내기 가능');
  await shot('data-07-memory-mode');
};
