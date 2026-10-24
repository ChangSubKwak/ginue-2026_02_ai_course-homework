// code-misc.pw.js — 도움말·테마·새 프로필 검증·명단 CSV·CSV/JSON 다운로드·삭제·비활성 스테이지·체험 모드·시간 종료·일시정지·인쇄 CSS
'use strict';
const fs = require('fs');
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const lastToast = () => page.locator('#toast-root .toast').last().textContent().catch(() => '');
  const modals = () => page.locator('.modal-backdrop').count();

  // 1. 도움말·테마
  await page.click('[data-action="help"]'); await sleep(150);
  expect((await page.locator('.modal ol.help li').count()) === 6, '도움말 모달 6단계');
  await page.keyboard.press('Escape'); await sleep(100);
  expect((await modals()) === 0, 'Esc로 도움말 닫힘');
  await page.click('#theme-btn'); await sleep(100);
  const theme = await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('edu.math-guardians.theme')]);
  expect(theme[0] === 'dark' && theme[1] === 'dark', '테마 토글 → data-theme=dark, edu.math-guardians.theme 저장');
  await page.click('#theme-btn'); await sleep(50);

  // 2. 새 프로필 모달 검증·중복 (2)
  await page.click('.app-header [data-action="new-profile"]'); await sleep(150);
  await page.fill('#np-name', '가'); await page.click('.modal [data-m="ok"]'); await sleep(100);
  const err = await page.locator('#np-error').textContent();
  expect((await modals()) === 1 && err.includes('2~12자'), '이름 1자 → 인라인 오류, 모달 유지');
  await page.fill('#np-name', '김하늘'); await page.click('.modal [data-m="ok"]'); await sleep(200);
  let st = await state();
  log(`new profile: current=${st.current} count=${st.profiles.length} toast="${await lastToast()}"`);
  expect(st.current === '김하늘(2)' && st.profiles.length === 25, "중복 이름 → '김하늘(2)' 생성·활성화");

  // 3. 명단 CSV 가져오기(헤더·CRLF·따옴표·빈 줄·불량 행·중복·상한)
  const csv = '﻿번호,이름\r\n25,백건우\r\n26,구하린\r\n27,"김,하늘"\r\n,홍길동\r\nx,나쁨\r\n28,a\r\n\r\n29,김하늘\r\n';
  await page.evaluate(t => window.__app.actions.importRoster(t), csv); await sleep(200);
  st = await state(); const names = st.profiles.map(p => p.name); const toast1 = await lastToast();
  log(`roster import: count=${st.profiles.length} toast="${toast1}" tail=${names.slice(-5).join('|')}`);
  expect(st.profiles.length === 30 && toast1.includes('5명 추가, 2행 건너뜀') && names.includes('김,하늘') && names.includes('홍길동') && names.includes('김하늘(3)'), '명단 CSV: 헤더·빈 줄·따옴표·중복(3)·불량 행 처리 → 5명 추가, 2행 건너뜀');
  const gradeOfImported = st.profiles.find(p => p.name === '백건우');
  log('imported profile sample: ' + JSON.stringify(await page.evaluate(() => { const p = window.__app.MG.root.profiles.find(x => x.name === '백건우'); return { grade: p.grade, classNo: p.classNo, number: p.number, avatar: p.avatar }; })));
  const big = '번호,이름\n' + Array.from({ length: 15 }, (_, i) => `${40 + i},학생${String(i + 1).padStart(2, '0')}`).join('\n');
  await page.evaluate(t => window.__app.actions.importRoster(t), big); await sleep(200);
  st = await state(); const toasts = await page.locator('#toast-root .toast').allTextContents();
  log(`cap: count=${st.profiles.length} toasts=${JSON.stringify(toasts)}`);
  expect(st.profiles.length === 40 && toasts.some(t => t.includes('상한')), '40명 상한에서 중단 + 안내 토스트');
  await page.evaluate(() => { window.__app.actions.importRoster('번호,이름\n1,a\n2,b'); }); await sleep(200);
  const failModal = await page.locator('.modal-body').textContent().catch(() => '');
  expect(failModal.includes('추가된 학생이 없습니다'), '0명 추가 → 안내 모달');
  await page.click('.modal [data-m="true"]').catch(() => {}); await sleep(100);

  // 4. CSV/JSON 내보내기(다운로드 캡처)
  const dl = async sel => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click(sel)]); const p = await d.path(); return { name: d.suggestedFilename(), text: fs.readFileSync(p, 'utf8') }; };
  await act('showView', 'settings'); await sleep(200);
  const rec = await dl('#settings-view [data-action="export-records"]');
  const lines = rec.text.split('\r\n');
  log(`records csv: ${rec.name} lines=${lines.length} head="${lines[0].slice(0, 70)}" row1="${lines[1]}"`);
  expect(/^math-guardians-records-\d{8}\.csv$/.test(rec.name) && rec.text.charCodeAt(0) === 0xFEFF && lines[0].replace('﻿', '') === '프로필,학년,반,번호,스테이지,최고점수,별,최대콤보,플레이수,클리어수,정답수,오답수,미응답수,평균반응시간(초),최근플레이' && lines.length > 20, '기록 CSV: 파일명·BOM·헤더 15열·CRLF');
  const weak = await dl('#settings-view [data-action="export-weak"]');
  const wl = weak.text.split('\r\n');
  log(`weak csv: ${weak.name} lines=${wl.length} head="${wl[0]}" row1="${wl[1]}"`);
  expect(/^math-guardians-weakfacts-\d{8}\.csv$/.test(weak.name) && wl[0].replace('﻿', '') === '프로필,스테이지,문제,정답,정답수,오답수,상자,마지막시도' && wl.length > 5, '약점 CSV: 파일명·헤더 8열');
  await page.evaluate(() => { window.__app.MG.root.profiles[0].name = '김,"하늘"'; });
  const rec2 = await dl('#settings-view [data-action="export-records"]');
  const quoted = rec2.text.split('\r\n').find(l => l.startsWith('"김,""하늘"""'));
  log('csv escaped row: ' + (quoted || 'NOT FOUND'));
  expect(!!quoted, 'CSV 쉼표·따옴표 포함 필드 큰따옴표 이스케이프');
  const js = await dl('#settings-view [data-action="export-json"]');
  let parsed = null; try { parsed = JSON.parse(js.text); } catch (e) { parsed = null; }
  log(`json: ${js.name} schema=${parsed && parsed.schemaVersion} profiles=${parsed && parsed.profiles.length}`);
  expect(/^math-guardians-backup-\d{8}\.json$/.test(js.name) && parsed && parsed.schemaVersion === 1 && parsed.profiles.length === 40, 'JSON 백업: 파일명·schemaVersion 1·프로필 40');
  await act('resetSample'); await sleep(200);

  // 5. 프로필 삭제(확인 모달) · 활성 삭제 시 첫 프로필로
  await act('showView', 'settings'); await sleep(200);
  st = await state(); const activeId = st.activeProfileId;
  await page.click(`[data-action="delete-profile"][data-pid="${activeId}"]`); await sleep(150);
  expect((await page.locator('.modal .btn.danger').count()) === 1, '삭제 확인 모달(빨간 확인 버튼)');
  await page.click('.modal [data-m="false"]'); await sleep(100);
  expect((await state()).profiles.length === 24, '취소 시 삭제 안 됨');
  await page.click(`[data-action="delete-profile"][data-pid="${activeId}"]`); await sleep(150); await page.click('.modal [data-m="true"]'); await sleep(200);
  st = await state(); log(`after delete active: count=${st.profiles.length} current=${st.current}`);
  expect(st.profiles.length === 23 && st.current === '이도윤', '활성 프로필 삭제 → 첫 프로필(이도윤)로 전환');
  await act('resetSample'); await sleep(200);

  // 6. 전체 비활성 안내 카드 / 닫힌 스테이지 토스트
  await act('setSetting', 'activeStageIds', []); await act('showView', 'home'); await sleep(100);
  expect((await page.locator('#stage-grid .empty').textContent().catch(() => '')).includes('모든 스테이지를 닫아'), '모든 스테이지 비활성 → 안내 카드');
  await act('setSetting', 'activeStageIds', ['s1-2', 's1-3']); await act('showView', 'home'); await sleep(100);
  await page.click('#grade-tabs [data-grade="1"]'); await sleep(100);
  const c11 = await page.locator('.stage-card[data-stage="s1-1"]').getAttribute('class');
  await page.click('.stage-card[data-stage="s1-1"] [data-action="start-stage"]'); await sleep(150);
  const t2 = await lastToast();
  log(`disabled stage: class="${c11}" toast="${t2}" view=${(await state()).view}`);
  expect(/disabled/.test(c11) && t2.includes('선생님이 닫아 둔 스테이지입니다') && (await state()).view === 'home', '비활성 스테이지: 회색 카드 + 토스트, 시작 안 됨');
  await act('resetSample'); await sleep(100);

  // 7. 체험 모드
  const recSum = (await state()).profiles.reduce((s, p) => s + p.records, 0);
  await page.click('[data-action="guest"]'); await sleep(100);
  st = await state(); expect(st.guest && st.current === '체험 학생', '체험하기 → 게스트');
  await act('startStage', 's1-1'); await sleep(1500); await act('quit'); await sleep(900);
  const guestBtn = await page.locator('#result-view [data-action="new-profile"]').count();
  expect(guestBtn === 1 && (await state()).view === 'result', "게스트 결과 화면에 '프로필 만들어 기록 저장하기' 버튼");
  await act('showView', 'hall'); await sleep(100);
  expect((await page.locator('#hall-view .empty').textContent().catch(() => '')).includes('체험 모드'), '게스트 랭킹: 체험 모드 안내');
  expect((await state()).profiles.reduce((s, p) => s + p.records, 0) === recSum, '게스트 판은 프로필에 기록되지 않음');

  // 8. 시간 종료(3초 제한) → '시간 종료' 결과
  const haneulId = (await state()).profiles.find(p => p.name === '김하늘').id; await act('setActive', haneulId);
  await act('setSetting', 'timeLimitMin', 0.05); await act('startStage', 's1-1'); await sleep(4300);
  st = await state(); const headT = await page.locator('.result-head h2').textContent().catch(() => '');
  log(`timeout: view=${st.view} head="${headT}" stars=${await page.locator('.result-stars .got').count()}`);
  expect(st.view === 'result' && headT.includes('시간 종료') && (await page.locator('.result-stars .got').count()) === 0, '시간 제한 도달 → 시간 종료 결과(별 0)');
  await act('setSetting', 'timeLimitMin', 5);

  // 9. 키패드 pointerdown 포커스 없음 / Esc 일시정지 / visibilitychange 자동 일시정지 / 그만하기
  await act('startStage', 's1-1'); await sleep(1500);
  await page.locator('#input-panel .key[data-k="7"]').dispatchEvent('pointerdown'); await sleep(50);
  const padState = await page.evaluate(() => ({ disp: document.querySelector('#input-panel .input-display').textContent, focusTag: document.activeElement.tagName, focusCls: document.activeElement.className }));
  log('keypad pointerdown: ' + JSON.stringify(padState));
  expect(padState.disp === '7' && !/key/.test(padState.focusCls), '키패드 pointerdown → 즉시 입력, 포커스 이동 없음');
  await page.keyboard.press('Escape'); await sleep(150);
  st = await state(); expect(st.game.state === 'paused' && (await page.locator('.modal-title').textContent()).includes('일시정지'), 'Esc → 일시정지 모달');
  await page.click('.modal [data-m="resume"]'); await sleep(100);
  expect((await state()).game.state === 'playing', '계속하기 → 재개');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await sleep(150);
  st = await state(); expect(st.game.state === 'paused' && (await modals()) === 1, '탭 숨김(visibilitychange) → 자동 일시정지 모달');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
  await page.click('.modal [data-m="quit"]'); await sleep(900);
  expect((await state()).view === 'result' && (await page.locator('.result-head h2').textContent()).includes('중단'), '그만하기 → 중단 결과');

  // 10. 인쇄용 기록표(@media print): window.print 대체 후 DOM/CSS 확인
  await act('showView', 'hall'); await sleep(100);
  await page.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await page.click('[data-action="print-today"]'); await sleep(100);
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => ({ printed: window.__printed, root: getComputedStyle(document.getElementById('print-root')).display, main: getComputedStyle(document.querySelector('main')).display, header: getComputedStyle(document.querySelector('.app-header')).display, text: document.getElementById('print-root').textContent.replace(/\s+/g, ' ').slice(0, 120) }));
  log('print: ' + JSON.stringify(pr));
  expect(pr.printed === 1 && pr.root === 'block' && pr.main === 'none' && pr.header === 'none', '인쇄: 기록표만 표시, 게임 UI 숨김');
  const rows = await page.locator('#print-root tbody tr').count(), rowTxt = rows ? (await page.locator('#print-root tbody tr').first().textContent()).replace(/\s+/g, ' ') : '';
  log(`print rows=${rows} row="${rowTxt}"`);
  expect(rows >= 2 && /김하늘/.test(rowTxt) && /중단|시간 종료/.test(await page.locator('#print-root').textContent()) === false, '오늘 플레이한 판이 기록표에 행으로 표시');
  await page.emulateMedia({ media: 'screen' });
  await shot('code-misc-end');
};
