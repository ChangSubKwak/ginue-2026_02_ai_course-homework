// func-roster.js — 자리뚝딱 QA: 첫 화면·탭·명렬 관리(입력 검증·XSS·붙여넣기/CSV·쌍·상한)
'use strict';
const H = (page) => ({
  dismiss: async () => { for (let i = 0; i < 5 && await page.locator('#modal-root .modal').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); } },
  st: () => page.evaluate(() => window.__app.getState()),
  tab: async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await page.waitForTimeout(150); },
  toasts: () => page.$$eval('#toast-root .toast', els => els.map(e => e.textContent)),
  modalText: () => page.locator('#modal-root .modal').innerText().catch(() => ''),
  modalOk: async () => { await page.click('#modal-root .modal [data-m="ok"]'); await page.waitForTimeout(250); },
});

module.exports = async ({ page, expect, shot, log, sleep }) => {
  const h = H(page);
  await h.dismiss();
  const find = (s, id) => s.state.students.find(x => x.id === id);

  // ── AC1: 첫 화면 ──
  let s = await h.st();
  expect(s.state.students.length === 25, 'AC1 샘플 명렬 25명 로드');
  expect(await page.locator('#roster-table tbody tr').count() === 25, 'AC1 명렬 표 25행');
  expect(await page.locator('#roster-table tr.is-inactive').count() === 1, 'AC1 비활성 1명(is-inactive) 표시');
  const inOp = await page.$eval('#roster-table tr.is-inactive td', td => getComputedStyle(td).opacity);
  expect(Number(inOp) < 1, '비활성 행 회색 처리(opacity<1): ' + inOp);
  expect((await page.textContent('#class-name-btn')).includes('가온초등학교 5학년 2반'), 'AC1 학급명 표시');
  expect((await page.textContent('#roster-summary')).includes('활성 24명 (남 12·여 12)'), '요약 칩 활성 24명(남 12·여 12)');
  expect((await page.textContent('#roster-summary')).includes('앞자리 필요 3') && (await page.textContent('#roster-summary')).includes('키 큼 3'), '요약 칩 태그 인원');
  expect(s.state.history.length === 4 && s.state.groupHistory.length === 1, 'AC1 히스토리 4건 + 모둠 1건');
  expect(await page.locator('.pair-item').count() === 3, '분리·결합 쌍 3개 표시');
  expect((await page.textContent('#save-text')) === '저장됨', '저장 상태 "저장됨"');
  await h.tab('history');
  expect(await page.locator('.hist-card.kind-seat').count() === 4, 'AC1 히스토리 탭 자리 기록 카드 4건');
  expect(await page.locator('.hist-card.kind-group').count() === 1, '모둠 기록 카드 1건');
  const dates = await page.$$eval('.hist-card .date', es => es.map(e => e.textContent));
  expect(dates.join(',') === dates.slice().sort().reverse().join(','), '히스토리 날짜 역순 정렬: ' + dates.join(','));
  await shot('01-history');

  // 모든 탭 열림
  for (const t of ['roster', 'seats', 'groups', 'history', 'settings']) {
    await h.tab(t);
    expect(await page.isVisible(`section[data-view="${t}"]`), `탭 열림: ${t}`);
    expect((await page.getAttribute(`#tabs [data-tab="${t}"]`, 'aria-selected')) === 'true', `aria-selected: ${t}`);
    expect(await page.locator('#app > section:not([hidden])').count() === 1, `한 번에 한 섹션만 표시: ${t}`);
  }
  await h.tab('roster');
  // 도움말
  await page.click('[data-action="help-tab"][data-help="roster"]'); await sleep(200);
  expect((await h.modalText()).includes('명렬 도움말'), '명렬 ? → 도움말 모달');
  await h.dismiss();
  await page.click('[data-action="help"]'); await sleep(200);
  expect((await h.modalText()).includes('사용법') && (await h.modalText()).includes('Ctrl+Z'), '툴바 ? → 전체 도움말(단축키 포함)');
  await h.dismiss();

  // ── 학생 추가 / 빈 이름 / XSS ──
  await page.click('[data-action="add-student"]'); await sleep(200);
  s = await h.st();
  expect(s.state.students.length === 26, '학생 추가 → 26명');
  const newId = s.state.students[25].id;
  expect(s.state.students[25].no === 26, '새 학생 번호 = 최대+1 (26)');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.dataset.field) === 'name', '학생 추가 후 이름 입력에 포커스');
  expect(await page.locator(`tr[data-id="${newId}"] input[data-field=name].is-invalid`).count() === 1, '빈 이름 행 is-invalid 표시');
  const xss = '<img src=x onerror="window.__xss=1">';
  await page.fill(`tr[data-id="${newId}"] input[data-field=name]`, xss); await page.keyboard.press('Tab'); await sleep(300);
  s = await h.st();
  expect(find(s, newId).name.startsWith('<img'), 'XSS 문자열 이름 그대로 저장');
  await h.tab('seats');
  expect(await page.evaluate(() => window.__xss === undefined), 'XSS 미실행(window.__xss undefined)');
  expect(await page.locator('#seatmap img, #roster-table img, #unplaced img').count() === 0, '<img> 태그가 DOM 요소로 삽입되지 않음');
  expect((await page.locator('#unplaced .chip').allTextContents()).some(t => t.includes('<img')), '미배치 칩에 이스케이프된 이름 텍스트');
  await page.click('#btn-auto'); await sleep(300);
  expect((await page.locator('#seatmap .seat-card .name').allTextContents()).some(t => t.includes('<img')), '좌석 카드에 이스케이프된 이름');
  expect(await page.locator('#seatmap .seat-card img').count() === 0, '좌석 카드 내 img 요소 없음');
  await h.tab('roster');

  // ── 번호 검증(음수·큰 값·중복) ──
  await page.fill(`tr[data-id="${newId}"] input[data-field=no]`, '-5'); await page.keyboard.press('Tab'); await sleep(300);
  s = await h.st(); expect(find(s, newId).no === 1, '번호 -5 → 1로 보정: ' + find(s, newId).no);
  expect(await page.locator('#roster-table .warn-ico').count() >= 2, '중복 번호(1) 경고 아이콘 2개 이상');
  await page.fill(`tr[data-id="${newId}"] input[data-field=no]`, '999'); await page.keyboard.press('Tab'); await sleep(300);
  s = await h.st(); expect(find(s, newId).no === 99, '번호 999 → 99로 보정: ' + find(s, newId).no);
  expect(await page.locator('#roster-table .warn-ico').count() === 0, '중복 해소 후 경고 아이콘 없음');
  // 중복 이름 → 카드에 (번호) 병기
  await page.fill('tr[data-id="s02"] input[data-field=name]', '김하늘'); await page.keyboard.press('Tab'); await sleep(300);
  await h.tab('seats');
  const names = await page.locator('#seatmap .seat-card .name').allTextContents();
  expect(names.includes('김하늘(1)') && names.includes('김하늘(2)'), '중복 이름 카드에 (번호) 병기: ' + names.filter(n => n.includes('김하늘')).join(','));
  await h.tab('roster');
  await page.fill('tr[data-id="s02"] input[data-field=name]', '이도윤'); await page.keyboard.press('Tab'); await sleep(300);
  // 빈 이름 경고
  await page.fill('tr[data-id="s02"] input[data-field=name]', ''); await page.keyboard.press('Tab'); await sleep(300);
  expect((await h.toasts()).some(t => t.includes('이름을 입력')), '이름 비우면 경고 토스트');
  await page.fill('tr[data-id="s02"] input[data-field=name]', '이도윤'); await page.keyboard.press('Tab'); await sleep(300);
  // 성별·수준 변경
  await page.selectOption('tr[data-id="s01"] select[data-field=gender]', ''); await sleep(300);
  s = await h.st(); expect(find(s, 's01').gender === '', '성별 미지정 변경');
  expect((await page.textContent('#roster-summary')).includes('남 12·여 11'), '요약 칩 성별 갱신(여 11)');
  await page.selectOption('tr[data-id="s01"] select[data-field=gender]', 'F'); await sleep(300);
  await page.selectOption('tr[data-id="s01"] select[data-field=level]', '3'); await sleep(300);
  s = await h.st(); expect(find(s, 's01').level === 3, '학습수준 변경');

  // ── 태그 토글 ──
  await page.click('tr[data-id="s01"] [data-tag="front"]'); await sleep(200);
  s = await h.st(); expect(find(s, 's01').tags.includes('front'), '태그 칩 켜기');
  expect((await page.textContent('#roster-summary')).includes('앞자리 필요 4'), '요약 칩 태그 인원 갱신(4)');
  expect(await page.locator('tr[data-id="s01"] [data-tag="front"].is-on').count() === 1, '태그 칩 is-on 스타일');
  await page.click('tr[data-id="s01"] [data-tag="front"]'); await sleep(200);
  s = await h.st(); expect(!find(s, 's01').tags.includes('front'), '태그 칩 끄기');

  // ── 비활성 토글 → 쌍 회색 ──
  await page.click('tr[data-id="s06"] .switch'); await sleep(300);
  s = await h.st(); expect(find(s, 's06').active === false, '비활성 토글');
  expect(await page.locator('#roster-table tr.is-inactive').count() === 2, '비활성 2명 회색');
  expect((await page.textContent('#roster-summary')).includes('활성 24명'), '활성 24명(25-1 추가 1)');
  expect(await page.locator('.pair-item.is-off[data-pid="p1"]').count() === 1 && (await page.textContent('.pair-item[data-pid="p1"]')).includes('계산 제외'), '비활성 포함 쌍 회색·계산 제외 문구');
  await page.click('tr[data-id="s06"] .switch'); await sleep(300);
  s = await h.st(); expect(find(s, 's06').active === true, '활성 복귀');

  // ── 삭제(모달) ──
  await page.click(`tr[data-id="${newId}"] [data-action="del-student"]`); await sleep(200);
  expect((await h.modalText()).includes('삭제'), '삭제 → 모달 확인');
  await page.keyboard.press('Escape'); await sleep(200);
  s = await h.st(); expect(s.state.students.length === 26, 'Esc 취소 → 삭제 안 됨');
  await page.click(`tr[data-id="${newId}"] [data-action="del-student"]`); await sleep(200); await h.modalOk();
  s = await h.st(); expect(s.state.students.length === 25, '모달 확인 후 삭제 → 25명');
  // 쌍 포함 학생 삭제 → 관련 쌍 삭제
  await page.click('tr[data-id="s16"] [data-action="del-student"]'); await sleep(200); await h.modalOk();
  s = await h.st(); expect(s.state.students.length === 24 && s.state.pairs.length === 2 && !s.state.pairs.some(p => p.a === 's16' || p.b === 's16'), '학생 삭제 시 관련 쌍 함께 삭제');

  // ── 쌍 추가 검증 ──
  await page.selectOption('#pair-a', 's01'); await page.selectOption('#pair-b', 's01');
  await page.click('[data-action="add-pair"][data-type="apart"]'); await sleep(200);
  expect((await h.toasts()).some(t => t.includes('같은 학생')), '자기 자신과 쌍 → 차단 토스트');
  await page.selectOption('#pair-a', 's06'); await page.selectOption('#pair-b', 's04');
  await page.click('[data-action="add-pair"][data-type="together"]'); await sleep(200);
  expect((await h.toasts()).some(t => t.includes('이미 등록된')), '기존 분리 쌍(역순)에 결합 쌍 → 차단 토스트');
  s = await h.st(); expect(s.state.pairs.length === 2, '차단 시 쌍 수 유지');
  await page.selectOption('#pair-a', 's01'); await page.selectOption('#pair-b', 's03');
  await page.click('[data-action="add-pair"][data-type="together"]'); await sleep(200);
  s = await h.st();
  const np = s.state.pairs[s.state.pairs.length - 1];
  expect(s.state.pairs.length === 3 && np.type === 'together' && np.hard === false, '결합 쌍 추가(기본 가능하면)');
  expect((await h.toasts()).some(t => t.includes('결합 쌍을 추가')), '쌍 추가 성공 토스트');
  await page.click(`.pair-item[data-pid="${np.id}"] [data-action="pair-hard"][data-v="1"]`); await sleep(200);
  s = await h.st(); expect(s.state.pairs.find(p => p.id === np.id).hard === true, '쌍 반드시(하드) 전환');
  expect(await page.locator(`.pair-item[data-pid="${np.id}"] [data-v="1"].is-on`).count() === 1, '하드 스위치 is-on');
  await page.selectOption('#pair-a', 's05'); await page.selectOption('#pair-b', 's07');
  await page.click('[data-action="add-pair"][data-type="apart"]'); await sleep(200);
  s = await h.st(); expect(s.state.pairs[s.state.pairs.length - 1].type === 'apart' && s.state.pairs[s.state.pairs.length - 1].hard === true, '분리 쌍 추가(기본 반드시)');
  await page.click(`.pair-item[data-pid="${np.id}"] [data-action="del-pair"]`); await sleep(200);
  s = await h.st(); expect(s.state.pairs.length === 3 && !s.state.pairs.some(p => p.id === np.id), '쌍 삭제');

  // ── AC13: 붙여넣기 등록 ──
  await page.fill('#paste-area', '1\t김가상\t남\n2\t이가상\t여\n3\t박가상\t남\n4\t최가상');
  await page.click('[data-action="parse-paste"]'); await sleep(200);
  expect(await page.locator('#paste-preview tr.st-ok').count() === 3, 'AC13 정상 3행');
  expect(await page.locator('#paste-preview tr.st-warn').count() === 1, 'AC13 경고 1행');
  expect((await page.textContent('#paste-preview tr.st-warn')).includes('성별 미지정'), 'AC13 경고 사유 "성별 미지정"');
  expect((await page.textContent('#paste-preview')).includes('정상 3 · 경고 1 · 오류 0'), '미리보기 집계 문구');
  const okBg = await page.$eval('#paste-preview tr.st-ok td', td => getComputedStyle(td).backgroundColor);
  const warnBg = await page.$eval('#paste-preview tr.st-warn td', td => getComputedStyle(td).backgroundColor);
  expect(okBg !== warnBg, '정상/경고 행 색 구분');
  const before = (await h.st()).state.students.length;
  await page.click('[data-action="add-parsed"]'); await sleep(300);
  s = await h.st();
  expect(s.state.students.length === before + 4, 'AC13 추가 시 4명 증가');
  expect(s.state.students[s.state.students.length - 1].gender === '' && s.state.students[s.state.students.length - 1].name === '최가상', '성별 미지정 학생 gender 빈값');
  expect((await page.inputValue('#paste-area')) === '', '추가 후 textarea 비움');
  expect(await page.locator('#roster-table .warn-ico').count() >= 8, '중복 번호(1~4) 경고 아이콘 표시');
  await shot('02-paste');
  // CSV 형식(헤더·콤마·따옴표·오류·빈 줄·여자)
  await page.fill('#paste-area', '번호,이름,성별\n5,"정가상",여자\n6\n\n7,강가상,X\n김홀로');
  await page.click('[data-action="parse-paste"]'); await sleep(200);
  expect(await page.locator('#paste-preview tbody tr').count() === 4, 'CSV: 헤더·빈 줄 제외 4행');
  expect(await page.locator('#paste-preview tr.st-ok').count() === 1 && (await page.textContent('#paste-preview tr.st-ok')).includes('여'), 'CSV: 따옴표 제거·"여자" 성별 인식');
  expect(await page.locator('#paste-preview tr.st-error').count() === 1 && (await page.textContent('#paste-preview tr.st-error')).includes('이름 없음'), 'CSV: 열 부족 행 오류 사유');
  expect(await page.locator('#paste-preview tr.st-warn').count() === 2, 'CSV: 성별 미인식 2행 경고');
  await page.click('[data-action="clear-paste"]'); await sleep(100);
  expect((await page.textContent('#paste-preview')).trim() === '' && (await page.inputValue('#paste-area')) === '', '지우기 → 미리보기·textarea 비움');
  // CSV 파일 선택(BOM + 탭 헤더)
  await page.setInputFiles('#csv-file', { name: 'r.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿번호\t이름\t성별\n8\t한가상\tM\n9\t오가상\tF') }); await sleep(400);
  expect(await page.locator('#paste-preview tr.st-ok').count() === 2, 'CSV 파일 선택 → 2행 정상(BOM·헤더 처리)');
  await page.click('[data-action="clear-paste"]');
  // 60명 상한
  s = await h.st(); const n0 = s.state.students.length;
  const lines = Array.from({ length: 40 }, (_, i) => `${100 + i}\t학생${i}\t남`).join('\n');
  await page.fill('#paste-area', lines); await page.click('[data-action="parse-paste"]'); await sleep(300);
  expect(await page.locator('#paste-preview tr.st-error').count() === n0 + 40 - 60, `60명 상한 초과 ${n0 + 40 - 60}행 오류 표시`);
  expect((await h.toasts()).some(t => t.includes('상한')), '상한 토스트');
  await page.click('[data-action="add-parsed"]'); await sleep(400);
  s = await h.st(); expect(s.state.students.length === 60, '상한까지 60명 등록');
  await page.click('[data-action="add-student"]'); await sleep(200);
  expect((await h.toasts()).some(t => t.includes('최대')), '61번째 학생 추가 → 상한 토스트');
  s = await h.st(); expect(s.state.students.length === 60, '60명 유지');
  await shot('03-roster-60');
  await page.fill('#paste-area', '   \n\n'); await page.click('[data-action="parse-paste"]'); await sleep(200);
  expect((await h.toasts()).some(t => t.includes('인식할 내용')), '빈 붙여넣기 → 안내 토스트');
  // 60명 → 자리 배치 탭 책상 부족
  await h.tab('seats');
  expect(await page.isDisabled('#btn-auto') && await page.locator('#desk-counter .is-short').count() === 1, '59명 활성 > 28책상 → 배치 비활성·빨간 카운터');
};
