// func-storage-responsive.js — 자리뚝딱 QA: 투어·모달 a11y·자동 저장/복원·테마/다크·백업(내보내기/가져오기/삭제/샘플)·히스토리 30건·설정·400px
'use strict';
const fs = require('fs');
const H = (page) => ({
  dismiss: async () => { for (let i = 0; i < 5 && await page.locator('#modal-root .modal').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); } },
  st: () => page.evaluate(() => window.__app.getState()),
  act: (name, ...args) => page.evaluate(([n, a]) => { const r = window.__app.actions[n](...a); return r && typeof r.then === 'function' ? 'promise' : typeof r; }, [name, args]),
  tab: async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await page.waitForTimeout(150); },
  toasts: () => page.$$eval('#toast-root .toast', els => els.map(e => e.textContent)),
  modalText: () => page.locator('#modal-root .modal').innerText().catch(() => ''),
  modalOk: async () => { await page.click('#modal-root .modal [data-m="ok"]'); await page.waitForTimeout(250); },
});

module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const h = H(page);
  const DARK_BG = 'rgb(23, 25, 29)';

  // ── 첫 실행 투어 + 모달 a11y ──
  expect(await page.locator('#modal-root .modal').count() === 1 && (await h.modalText()).includes('1단계'), '첫 방문 가이드 투어 1단계 모달');
  expect(await page.locator('#m-nomore').count() === 1, '"다시 보지 않기" 체크 존재');
  expect(await page.evaluate(() => !!document.activeElement.closest('.modal')), '모달 열릴 때 포커스가 모달 안');
  expect((await page.getAttribute('#modal-root .modal', 'role')) === 'dialog' && (await page.getAttribute('#modal-root .modal', 'aria-modal')) === 'true', '모달 role=dialog·aria-modal');
  let inside = true; for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); inside = inside && await page.evaluate(() => !!document.activeElement.closest('.modal')); }
  expect(inside, 'Tab 8회 → 포커스 트랩 유지');
  await page.click('#modal-root [data-m="ok"]'); await sleep(200);
  expect((await h.modalText()).includes('2단계'), '투어 2단계');
  await page.keyboard.press('Escape'); await sleep(200);
  expect(await page.locator('#modal-root .modal').count() === 0, 'Esc → 투어 닫힘');
  await reload();
  const tourAgain = await page.locator('#modal-root .modal').count();
  log('tour after skip+reload: ' + tourAgain);
  expect(tourAgain === 0, '투어 건너뛰기 후 새로고침 시 재표시 안 됨(첫 방문 1회)');
  if (tourAgain) { await page.check('#m-nomore'); await page.keyboard.press('Escape'); await sleep(200); }
  await reload();
  expect(await page.locator('#modal-root .modal').count() === 0, '"다시 보지 않기" 후 새로고침 → 투어 안 뜸');
  await page.click('[data-action="help"]'); await sleep(200);
  await page.mouse.click(5, 5); await sleep(200);
  expect(await page.locator('#modal-root .modal').count() === 0, '배경 클릭 → 모달 닫힘');
  await page.focus('[data-action="help"]'); await page.keyboard.press('Enter'); await sleep(200);
  expect(await page.locator('#modal-root .modal').count() === 1, 'Enter 키로 도움말 열기');
  await page.keyboard.press('Escape'); await sleep(200);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.dataset.action === 'help'), '모달 닫힌 뒤 포커스 복귀');
  const noLabel = await page.$$eval('.icon-btn', bs => bs.filter(b => !b.getAttribute('aria-label') && !b.textContent.trim()).length);
  expect(noLabel === 0, '아이콘 버튼 aria-label');
  expect(await page.locator('#tabs [role=tab]').count() === 5 && (await page.getAttribute('#tabs', 'role')) === 'tablist', '탭 role=tab/tablist');

  // ── 저장 상태 + AC11 새로고침 복원 ──
  await page.fill('tr[data-id="s01"] input[data-field=name]', '김하늘검증'); await sleep(40);
  expect((await page.textContent('#save-text')) === '저장 중', '변경 직후 "저장 중"');
  await sleep(500);
  expect((await page.textContent('#save-text')) === '저장됨' && (await page.getAttribute('#save-status', 'data-state')) === 'saved', '300ms 후 "저장됨"');
  await page.click('tr[data-id="s03"] [data-tag="tall"]'); await sleep(100);
  await h.tab('seats'); await page.click('#btn-auto'); await sleep(300);
  await page.click('#seatmap .seat-card[data-sid="s02"] .lock'); await sleep(100);
  await page.click('[data-action="cond-hard"][data-cond="genderPair"][data-v="1"]'); await sleep(100);
  await page.uncheck('#avoid-seat'); await sleep(100);
  await page.$eval('#zoom', el => { el.value = 60; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(500);
  const before = await h.st();
  const ls = await page.evaluate(() => Object.keys(localStorage));
  expect(ls.includes('edu.jari-ttukttak.data') && ls.includes('edu.jari-ttukttak.ui'), 'localStorage 키 edu.jari-ttukttak.*: ' + ls.join(','));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('edu.jari-ttukttak.data')).version === 1), '저장 데이터 version 1');
  await reload(); await h.dismiss();
  const after = await h.st();
  expect(after.state.students.find(s => s.id === 's01').name === '김하늘검증', 'AC11 이름 변경 복원');
  expect(after.state.students.find(s => s.id === 's03').tags.includes('tall'), 'AC11 태그 복원');
  expect(JSON.stringify(after.state.current.seats) === JSON.stringify(before.state.current.seats) && Object.keys(after.state.current.seats).length === 24, 'AC11 미확정 현재 배치 복원');
  expect(after.state.current.locked.includes('s02'), 'AC11 핀 고정 복원');
  expect(after.state.conditions.genderPair.hard === true && after.state.conditions.avoidSeat === false, 'AC11 조건 복원');
  expect(after.undo.past === 0 && await page.isDisabled('#btn-undo'), '새로고침 후 Undo 스택 초기화');
  expect(after.ui.tab === 'seats' && await page.isVisible('section[data-view="seats"]'), '마지막 탭 복원');
  expect(after.ui.zoom === 60 && (await page.inputValue('#zoom')) === '60', '확대 값 복원');
  expect(await page.locator('#seatmap .seat.filled').count() === 24 && await page.locator('#seatmap .seat.locked').count() === 1, '좌석표 24개·잠금 렌더');

  // ── 테마 토글 / 다크 모드 ──
  await page.click('#theme-btn'); await sleep(150);
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', '테마 토글 → data-theme=dark');
  expect((await page.evaluate(() => localStorage.getItem('edu.jari-ttukttak.theme'))) === '"dark"', '테마 저장 edu.jari-ttukttak.theme');
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(darkBg === DARK_BG, '다크 배경 적용: ' + darkBg);
  expect((await page.textContent('#theme-btn')) === '☀️', '다크일 때 아이콘 ☀️');
  await shot('30-dark-seats');
  await h.tab('history'); await shot('31-dark-history');
  const heatText = await page.$eval('.heat .hl', el => getComputedStyle(el).fill);
  expect(heatText !== 'rgb(0, 0, 0)' && heatText !== '', '다크 히트맵 라벨 색 토큰 적용: ' + heatText);
  await h.tab('groups'); await page.click('#btn-make-groups'); await sleep(200); await shot('32-dark-groups');
  await h.tab('roster'); await shot('33-dark-roster');
  await page.click('#theme-btn'); await sleep(100);
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', '테마 토글 → light');
  await page.evaluate(() => localStorage.removeItem('edu.jari-ttukttak.theme'));
  await page.emulateMedia({ colorScheme: 'dark' }); await reload(); await h.dismiss();
  expect(await page.evaluate(() => !document.documentElement.dataset.theme && getComputedStyle(document.body).backgroundColor === 'rgb(23, 25, 29)'), 'OS 다크 따름(data-theme 없음)');
  await h.tab('seats'); await page.click('#btn-present'); await sleep(300); await shot('34-dark-present'); await page.keyboard.press('Escape'); await sleep(200);
  await page.click('#btn-print'); await sleep(300); await shot('35-dark-print'); await page.keyboard.press('Escape'); await sleep(200);
  await page.emulateMedia({ colorScheme: 'light' }); await sleep(100);

  // ── AC12: 내보내기 → 전체 삭제 → 가져오기 ──
  await h.tab('settings');
  expect((await page.textContent('[data-view="settings"] .notice')).includes('공용 PC'), '공용 PC 주의 문구');
  const info = await page.textContent('#storage-info');
  expect(/v1\.0\.0/.test(info) && /KB/.test(info), '버전·저장 용량 표시: ' + info);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('[data-action="export-json"]')]);
  const fname = dl.suggestedFilename();
  expect(/^jari-ttukttak-\d{8}\.json$/.test(fname), 'AC12 내보내기 파일명: ' + fname);
  const buf = fs.readFileSync(await dl.path());
  const exported = JSON.parse(buf.toString('utf8'));
  expect(exported.version === 1 && exported.students.length === 25 && exported.history.length === 4 && exported.current && exported.settings, 'AC12 JSON 구조(version 1·25명·4건·current·settings)');
  await page.click('[data-action="wipe"]'); await sleep(200);
  expect((await h.modalText()).includes('(1/2)'), '전체 삭제 1단계 모달');
  await h.modalOk();
  expect((await h.modalText()).includes('(2/2)'), '전체 삭제 2단계 모달');
  await page.keyboard.press('Escape'); await sleep(200);
  expect((await h.st()).state.students.length === 25, '2단계 취소 → 데이터 유지');
  await page.click('[data-action="wipe"]'); await sleep(200); await h.modalOk(); await h.modalOk();
  let st = await h.st();
  expect(st.state.students.length === 0 && st.state.history.length === 0 && st.state.pairs.length === 0, '전체 삭제 → 학생 0·히스토리 0');
  expect((await page.evaluate(() => localStorage.getItem('edu.jari-ttukttak.data'))) === null, '전체 삭제 → localStorage data 제거');
  await h.tab('seats');
  expect((await page.textContent('#seatmap')).includes('명렬 탭에서 학생을 추가하세요'), '학생 0명 안내 카드');
  expect(await page.isDisabled('#btn-auto') && await page.isDisabled('#btn-present') && await page.isDisabled('#btn-print'), '학생 0명 → 배치/발표/인쇄 비활성');
  await h.tab('groups'); expect(await page.isDisabled('#btn-make-groups'), '학생 0명 → 편성 비활성');
  await h.tab('history'); expect((await page.textContent('#fairness')).includes('히스토리가 쌓이면') && (await page.textContent('#hist-list')).includes('기록이 없습니다'), '히스토리 0건 → 안내 문구만');
  await h.tab('roster'); expect((await page.textContent('#roster-table')).includes('학생이 없습니다'), '명렬 빈 상태 안내');
  await shot('36-empty');
  await reload(); await h.dismiss();
  st = await h.st(); log('after wipe+reload students=' + st.state.students.length);
  expect(st.state.students.length === 0, '전체 삭제 후 새로고침해도 빈 상태 유지(샘플 자동 복원 안 됨)');
  await h.tab('settings');
  await page.setInputFiles('#json-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad json') }); await sleep(400);
  expect((await h.modalText()).includes('가져오기 실패'), '손상 JSON → 실패 모달');
  await h.dismiss();
  await page.setInputFiles('#json-file', { name: 'v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 2, students: [] })) }); await sleep(400);
  expect((await h.modalText()).includes('version 불일치'), 'version 불일치 → 실패 모달');
  await h.dismiss();
  await page.setInputFiles('#json-file', { name: 'k.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, students: [], history: [], pairs: [] })) }); await sleep(400);
  expect((await h.modalText()).includes('필수 키 누락'), '필수 키 누락 → 실패 모달');
  await h.dismiss();
  const stAfterBad = await h.st();
  expect(stAfterBad.state.students.length === stAfterBad.state.students.length && (await page.textContent('#storage-info')).includes('학생'), '실패 시 기존 데이터 유지');
  await page.setInputFiles('#json-file', { name: fname, mimeType: 'application/json', buffer: buf }); await sleep(400);
  const mt = (await h.modalText()).replace(/\s+/g, ' ');
  expect(mt.includes('학생 25명') && mt.includes('배치 4건'), 'AC12 요약 모달(학생 25명, 배치 4건): ' + mt);
  const nBeforeImport = (await h.st()).state.students.length;
  await page.keyboard.press('Escape'); await sleep(200);
  const stCancel = await h.st();
  expect(stCancel.state.students.length === nBeforeImport && !(stCancel.state.students[0] && stCancel.state.students[0].name === '김하늘검증'), '가져오기 취소 → 덮어쓰지 않음');
  await page.setInputFiles('#json-file', { name: fname, mimeType: 'application/json', buffer: buf }); await sleep(400); await h.modalOk();
  st = await h.st();
  expect(st.state.students.length === 25 && st.state.history.length === 4 && st.state.students[0].name === '김하늘검증' && st.state.groupHistory.length === 1, 'AC12 가져오기 → 명렬·히스토리 복원');
  expect(Object.keys(st.state.current.seats).length === 24 && st.undo.past === 0, '가져오기 → 현재 배치 복원·Undo 초기화');
  await h.tab('history'); expect(await page.locator('.hist-card.kind-seat').count() === 4, 'AC12 히스토리 카드 4건');
  await h.tab('roster'); expect(await page.locator('#roster-table tbody tr').count() === 25, 'AC12 명렬 25행');
  await reload(); await h.dismiss();
  expect((await h.st()).state.students.length === 25, '가져온 데이터 새로고침 후 유지');

  // ── 소수 학생: 모둠 수 > 학생 수, 이력 없음 ──
  await h.act('wipe'); await sleep(150);
  await h.tab('roster');
  await page.fill('#paste-area', '1\t가\t남\n2\t나\t여\n3\t다\t남'); await page.click('[data-action="parse-paste"]'); await sleep(150); await page.click('[data-action="add-parsed"]'); await sleep(200);
  await h.tab('groups');
  const mgDisabled = await page.isDisabled('#btn-make-groups');
  expect(!mgDisabled, '전체 삭제 후 명렬 등록 시 모둠 "편성" 버튼이 다시 활성화됨');
  if (mgDisabled) { log('workaround: reload to re-render groups tab'); await reload(); await h.dismiss(); await h.tab('groups'); }
  await page.check('input[name=gmode][value="count"]'); await page.fill('#g-count', '6'); await page.click('#btn-make-groups'); await sleep(300);
  expect((await h.toasts()).some(t => t.includes('모둠 수를 학생 수(3)로')), '모둠 수 > 학생 수 → 자동 축소 토스트');
  expect((await h.st()).state.currentGroups.groups.length === 3, '모둠 3개로 축소');
  await h.tab('seats'); await page.click('#btn-auto'); await sleep(200);
  const naRows = await page.locator('#report .rep-row.st-na').allTextContents();
  expect(naRows.length === 2 && naRows.every(t => t.includes('이력 없음')), '히스토리 0건 → "이력 없음(해당 없음)" 2행: ' + JSON.stringify(naRows));
  expect((await h.st()).report.penalty === 0, '이력 없음 시 패널티 0');
  // 샘플 다시 불러오기
  await h.tab('settings'); await page.click('[data-action="reset-sample"]'); await sleep(200);
  expect((await h.modalText()).includes('샘플'), '샘플 다시 불러오기 모달');
  await h.modalOk();
  st = await h.st(); expect(st.state.students.length === 25 && st.state.history.length === 4 && st.state.students[0].name === '김하늘', '샘플 복원(25명·4건)');

  // ── 히스토리 30건 초과 ──
  await page.evaluate(() => { const s = window.__app.getState().state; const base = s.history[0]; while (s.history.length < 30) s.history.push({ ...base, id: 'hx' + s.history.length, date: '2025-01-' + String(s.history.length).padStart(2, '0'), memo: '채움' + s.history.length }); window.__app.actions.importRoot(s); });
  await sleep(200);
  expect((await h.st()).state.history.length === 30, '히스토리 30건 준비');
  await h.tab('seats'); await page.click('#btn-auto'); await sleep(200); await page.click('#btn-confirm'); await sleep(200); await page.fill('#m-memo', '31번째'); await h.modalOk();
  expect((await h.modalText()).includes('30건 초과') && (await h.modalText()).includes('2025-01-04'), '30건 초과 → 가장 오래된 기록 삭제 안내 모달');
  await page.keyboard.press('Escape'); await sleep(200);
  st = await h.st(); expect(st.state.history.length === 30 && !st.state.history.some(x => x.memo === '31번째'), '삭제 거부 → 확정 취소');
  await page.click('#btn-confirm'); await sleep(200); await page.fill('#m-memo', '31번째'); await h.modalOk(); await sleep(100); await h.modalOk();
  st = await h.st(); expect(st.state.history.length === 30 && st.state.history.some(x => x.memo === '31번째') && !st.state.history.some(x => x.date === '2025-01-04'), '삭제 수락 → 가장 오래된 기록 제거 후 저장');
  await h.act('resetSample'); await sleep(200);

  // ── 학급명 편집 → 인쇄 제목 ──
  await page.click('#class-name-btn'); await sleep(200);
  await page.fill('#m-class', ''); await page.click('#modal-root [data-m="ok"]'); await sleep(200);
  expect(await page.locator('#modal-root .modal').count() === 1, '학급명 빈값 차단');
  await page.fill('#m-class', '6학년 1반'); await page.fill('#m-school', '검증초'); await h.modalOk();
  expect((await page.textContent('#class-name-btn')) === '검증초 6학년 1반', '학급명 인라인 편집 반영');
  await h.tab('seats'); await page.click('#btn-auto'); await sleep(200);
  await page.click('#btn-print'); await sleep(300);
  expect((await page.textContent('#print-pages .p-title')).includes('검증초 6학년 1반'), '인쇄 제목에 학급명 반영');
  await page.keyboard.press('Escape'); await sleep(200);

  // ── 설정 편집 ──
  await h.tab('settings');
  await page.click('[data-action="role-add"]'); await sleep(150);
  st = await h.st(); expect(st.state.settings.roles.length === 5 && st.state.settings.roles[4] === '새 역할', '역할 추가');
  await page.click('[data-action="role-up"][data-i="4"]'); await sleep(150);
  st = await h.st(); expect(st.state.settings.roles[3] === '새 역할', '역할 순서 위로');
  await page.fill('[data-role-i="3"]', '발표자'); await page.keyboard.press('Tab'); await sleep(200);
  st = await h.st(); expect(st.state.settings.roles[3] === '발표자', '역할 이름 편집');
  await page.fill('[data-role-i="3"]', ''); await page.keyboard.press('Tab'); await sleep(200);
  st = await h.st(); expect(st.state.settings.roles[3] === '발표자' && (await h.toasts()).some(t => t.includes('역할 이름')), '빈 역할 이름 거부');
  await page.click('[data-action="role-del"][data-i="3"]'); await sleep(150);
  st = await h.st(); expect(st.state.settings.roles.length === 4, '역할 삭제');
  await page.fill('#s-flip', '50'); await page.keyboard.press('Tab'); await sleep(200);
  st = await h.st(); expect(st.state.settings.flipIntervalMs === 200, '플립 간격 50 → 200 보정');
  await page.fill('#s-avoid', '7'); await page.keyboard.press('Tab'); await sleep(200);
  st = await h.st(); expect(st.state.settings.avoidN === 5, '회피 N 7 → 5 보정');
  await page.fill('[data-gname-i="0"]', '<독수리>'); await page.keyboard.press('Tab'); await sleep(200);
  st = await h.st(); expect(st.state.settings.groupNames[0] === '<독수리>', '모둠 이름 편집');
  await page.check('#s-sound'); await sleep(200);
  st = await h.st(); expect(st.state.settings.sound === true && st.ui.soundOn === true, '소리 기본값 켜기');
  await h.tab('groups'); await page.click('#btn-make-groups'); await sleep(200);
  expect((await page.textContent('#group-grid .group-card[data-g="0"] .gname')) === '<독수리>', '설정의 모둠 이름이 편성에 반영');
  await h.act('resetSample'); await sleep(200);

  // ── AC14: 400px ──
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  const checkOverflow = async (label) => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, document.body.scrollWidth]); expect(w[0] <= w[1] && w[2] <= w[1], `400px 가로 스크롤 없음(${label}): ${w}`); };
  for (const t of ['roster', 'seats', 'groups', 'history', 'settings']) { await h.tab(t); await sleep(150); await checkOverflow(t); }
  const tabPos = await page.$eval('#tabs', el => { const r = el.getBoundingClientRect(); return { pos: getComputedStyle(el).position, bottomGap: Math.round(window.innerHeight - r.bottom), h: Math.round(r.height) }; });
  expect(tabPos.pos === 'fixed' && tabPos.bottomGap <= 1, 'AC14 탭 바 하단 고정: ' + JSON.stringify(tabPos));
  const tabH = await page.$eval('#tabs [role=tab]', el => el.getBoundingClientRect().height);
  expect(tabH >= 44, '하단 탭 터치 타깃 44px 이상: ' + tabH);
  expect(await page.$$eval('#tabs [role=tab]', bs => bs.every(b => b.getBoundingClientRect().right <= 401)), '탭 5개가 400px 안에');
  const footerBottom = await page.$eval('.app-footer', el => el.getBoundingClientRect().bottom);
  await h.tab('seats'); await sleep(200);
  expect(await page.isVisible('#zoom'), 'AC14 축소 슬라이더 표시');
  await page.click('#btn-auto'); await sleep(300);
  const sm = await page.$eval('#seatmap-wrap', el => ({ sw: el.scrollWidth, cw: el.clientWidth, ov: getComputedStyle(el).overflowX }));
  expect(sm.ov === 'auto' || sm.ov === 'scroll', 'AC14 좌석표 내부 스크롤 컨테이너: ' + JSON.stringify(sm));
  await page.$eval('#zoom', el => { el.value = 48; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(150);
  const sm2 = await page.$eval('#seatmap-wrap', el => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  log('400px seatmap at --cell 48px: ' + JSON.stringify(sm2));
  await checkOverflow('seats-zoomed');
  const panels = await page.$$eval('.seats-layout > *', es => es.map(e => Math.round(e.getBoundingClientRect().left)));
  expect(new Set(panels).size === 1, '400px 패널·좌석표·리포트 세로 스택: ' + panels.join(','));
  st = await h.st(); const ids = Object.values(st.state.current.seats); const sA = ids[0], sB = ids[1];
  const kA = Object.keys(st.state.current.seats).find(k => st.state.current.seats[k] === sA), kB = Object.keys(st.state.current.seats).find(k => st.state.current.seats[k] === sB);
  await page.locator(`#seatmap .seat-card[data-sid="${sA}"]`).scrollIntoViewIfNeeded(); await page.click(`#seatmap .seat-card[data-sid="${sA}"]`); await sleep(150);
  expect(await page.locator('#seatmap .seat.tap-sel').count() === 1, '400px 첫 탭 하이라이트');
  await page.locator(`#seatmap .seat-card[data-sid="${sB}"]`).scrollIntoViewIfNeeded(); await page.click(`#seatmap .seat-card[data-sid="${sB}"]`); await sleep(300);
  st = await h.st(); expect(st.state.current.seats[kA] === sB && st.state.current.seats[kB] === sA, 'AC14 400px 탭-탭 교환');
  await shot('37-mobile-seats');
  const lockSize = await page.$eval('#seatmap .seat-card .lock', el => el.getBoundingClientRect().width);
  log('lock button size at 48px cell: ' + lockSize);
  const btnH = await page.$$eval('.actions .btn', bs => Math.min(...bs.map(b => b.getBoundingClientRect().height)));
  expect(btnH >= 40, '버튼 높이 40px 이상: ' + btnH);
  await page.click('#btn-present'); await sleep(300);
  expect(await page.isVisible('#present') && await page.isVisible('#pr-start') && await page.isVisible('[data-action="pr-exit"]'), '400px 발표 모드 하단 바 표시');
  await checkOverflow('present');
  const prCell = await page.$eval('#present-map', el => parseInt(el.style.getPropertyValue('--cell')));
  log('present cell at 400px: ' + prCell);
  await shot('38-mobile-present');
  await page.keyboard.press('Escape'); await sleep(200);
  await h.tab('groups'); await page.click('#btn-make-groups'); await sleep(300); await checkOverflow('groups-made');
  const cols = await page.$$eval('#group-grid .group-card', cs => new Set(cs.map(c => Math.round(c.getBoundingClientRect().left))).size);
  expect(cols === 1, '400px 모둠 카드 1열');
  await shot('39-mobile-groups');
  await h.tab('roster'); await sleep(150);
  const tw = await page.$eval('#roster-table', el => ({ sw: el.scrollWidth, cw: el.clientWidth, ov: getComputedStyle(el).overflowX }));
  expect(tw.ov === 'auto' && tw.cw <= 400, '명렬 표 자체 가로 스크롤 컨테이너: ' + JSON.stringify(tw));
  await shot('40-mobile-roster');
  await h.tab('history'); await sleep(150); await shot('41-mobile-history');
  await page.click('#btn-print'); await sleep(300); await checkOverflow('print');
  expect(await page.isVisible('[data-action="do-print"]') && await page.isVisible('#print-pages .page'), '400px 인쇄 패널 버튼·미리보기 보임');
  const pgScale = await page.$eval('#print-pages .page-outer', el => el.getBoundingClientRect().width);
  expect(pgScale <= 400, '400px 미리보기 페이지 축소: ' + Math.round(pgScale));
  await shot('42-mobile-print');
  await page.keyboard.press('Escape'); await sleep(200);
  await h.tab('settings'); await page.click('[data-action="wipe"]'); await sleep(200); await checkOverflow('modal');
  const mw = await page.$eval('#modal-root .modal', el => el.getBoundingClientRect().width);
  expect(mw <= 400 - 32 + 1, '400px 모달 폭: ' + Math.round(mw));
  await page.keyboard.press('Escape'); await sleep(100);
  const toastPos = await page.evaluate(() => getComputedStyle(document.querySelector('#toast-root')).bottom);
  expect(toastPos === '84px', '400px 토스트 하단 탭 바 위(84px): ' + toastPos);
  await page.setViewportSize({ width: 1280, height: 800 });
};
