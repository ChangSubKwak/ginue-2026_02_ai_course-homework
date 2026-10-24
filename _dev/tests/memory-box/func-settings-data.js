// func-settings-data.js — 설정·프로필 전환(AC12)·하루 목표(AC8)·백업/복원/요약 JSON·CSV 템플릿·교사 모드(AC11)·샘플 다시 넣기·프로필 삭제·테마·도움말 (pw-run.js용)
'use strict';
const fs = require('fs');
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const txt = async sel => (await page.locator(sel).first().textContent()) || '';
  const st = () => page.evaluate(() => window.__app.getState());
  const visible = async sel => (await page.locator(sel).count()) > 0 && await page.locator(sel).first().isVisible();
  const modal = () => page.locator('.modal').last();
  const lastToast = async () => { const t = page.locator('#toast-root .toast'); return (await t.count()) ? (await t.last().textContent()) : ''; };
  // 다운로드 → {name, text}
  const dl = async (clickSel, within) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), (within || page).locator(clickSel).first().click()]);
    if (!d) return null; const p = await d.path(); return { name: d.suggestedFilename(), text: fs.readFileSync(p, 'utf-8') };
  };
  const file = (name, text, mimeType = 'application/json') => ({ name, mimeType, buffer: Buffer.from(text, 'utf-8') });
  let s = await st(); const today = s.today;

  /* ---- AC12 프로필 칩 팝오버 전환 ---- */
  await page.click('#profile-chip'); await sleep(150);
  expect(await visible('.pop-menu') && (await page.locator('.pop-menu [data-action="switch-profile"]').count()) === 2, '프로필 칩 → 팝오버(프로필 2개)');
  await page.click('.pop-menu [data-action="switch-profile"][data-id="p-doyun"]'); await sleep(300);
  expect(!(await visible('.pop-menu')), '전환 후 팝오버 닫힘');
  s = await st();
  expect((await txt('#profile-chip')).includes('이도윤') && s.profile.id === 'p-doyun', 'AC12 칩 이름 이도윤');
  expect(/오늘 복습 9장/.test(await txt('#view-home')) && s.queue.length === 9, 'AC12 이도윤 홈 큐 9장 (실제 ' + s.queue.length + ')');
  expect(s.data.decks.length === 2 && s.data.cards.length === 22 && s.streak === 0, 'AC12 이도윤 덱 2·카드 22·스트릭 0');
  await page.click('#tab-cards'); await sleep(200);
  expect((await page.locator('.deck-card').count()) === 2, 'AC12 카드 탭 덱 2개');
  expect(/0\/8장/.test(await txt('#view-home')), '이도윤 하루 목표 8장 반영');
  await page.click('#profile-chip'); await sleep(150);
  await page.click('.pop-menu [data-action="switch-profile"][data-id="p-haneul"]'); await sleep(300);
  s = await st();
  await page.click('#tab-home'); await sleep(150);
  expect(/오늘 복습 11장/.test(await txt('#view-home')) && s.data.decks.length === 5 && s.data.cards.length === 72, 'AC12 김하늘 복귀: 11장·5덱·72장');
  await reload(); s = await st();
  expect(s.profile.id === 'p-haneul', '새로고침 후 활성 프로필 유지');
  // 팝오버의 '프로필 관리' → 설정
  await page.click('#profile-chip'); await sleep(150); await page.click('.pop-menu [data-action="goto"][data-view="settings"]'); await sleep(200);
  expect(await visible('#view-settings'), '팝오버 "프로필 관리" → 설정 탭');

  /* ---- AC8 하루 목표 ---- */
  expect((await page.inputValue('#goal-in')) === '10', '설정 하루 목표 초기 10');
  await page.fill('#goal-in', '5'); await page.click('[data-action="goal-save"]'); await sleep(200);
  expect((await lastToast()).includes('5장'), '목표 저장 토스트');
  await reload(); await page.click('#tab-settings'); await sleep(200);
  expect((await page.inputValue('#goal-in')) === '5', 'AC8 새로고침 후 설정 값 5 유지');
  await page.click('#tab-home'); await sleep(150);
  expect(/\/5장/.test(await txt('#view-home')), 'AC8 홈 진행 바 분모 5');
  await page.click('#tab-settings'); await sleep(150);
  for (const [v, want] of [['0', 10], ['100', 50], ['-3', 1], ['', 10], ['7', 7]]) {
    await page.fill('#goal-in', v); await page.click('[data-action="goal-save"]'); await sleep(150);
    s = await st(); expect(s.profile.dailyGoal === want, `목표 입력 "${v}" → ${want}로 보정/저장 (실제 ${s.profile.dailyGoal})`);
  }
  expect(/1일 뒤.*2일 뒤.*4일 뒤.*7일 뒤.*15일 뒤.*30일 뒤/s.test(await txt('#view-settings')), '간격표 1·2·4·7·15·30 표시');
  expect(/\d+KB \/ 5,120KB/.test(await txt('#view-settings')), '저장 용량 게이지 KB/5,120KB');
  expect((await txt('#view-settings')).includes('v1.0.0'), '버전 표시');

  /* ---- 백업·요약·CSV 템플릿 내려받기 ---- */
  const backup = await dl('[data-action="backup"]');
  let bk = null; try { bk = backup && JSON.parse(backup.text); } catch (e) { /* */ }
  expect(!!backup && /^기억상자_백업_\d{4}-\d{2}-\d{2}\.json$/.test(backup.name), '전체 백업 JSON 다운로드 (' + (backup && backup.name) + ')');
  expect(!!bk && bk.type === 'memory-box-backup' && bk.version === 1 && bk.meta.profiles.length === 2 && Object.keys(bk.profiles).length === 2 && bk.profiles['p-haneul'].cards.length === 72 && bk.profiles['p-doyun'].cards.length === 22, '백업 구조: type/version/meta/profiles(2) 카드 72+22');
  const summ = await dl('[data-action="summary"]');
  let sm = null; try { sm = summ && JSON.parse(summ.text); } catch (e) { /* */ }
  expect(!!summ && summ.name.includes('복습요약') && summ.name.includes('김하늘'), '복습 요약 JSON 다운로드 (' + (summ && summ.name) + ')');
  expect(!!sm && sm.type === 'memory-box-summary' && sm.student.name === '김하늘' && sm.decks.length === 5 && sm.wrong.length === 14 && sm.stats.streak === 6 && typeof sm.stats.reviewed30d === 'number', '요약 구조: 덱 5·오답 14·스트릭 6');
  const tpl = await dl('[data-action="csv-template"]');
  expect(!!tpl && tpl.name.endsWith('.csv') && tpl.text.charCodeAt(0) === 0xFEFF && tpl.text.slice(1).startsWith('앞면,뒷면,힌트,유형,원인'), 'CSV 템플릿: BOM+헤더');

  /* ---- 복원: 잘못된 파일들 ---- */
  const restoreInput = '#restore-drop input[type=file]';
  await page.setInputFiles(restoreInput, file('bad.json', '{ not json')); await sleep(300);
  expect((await txt('.modal-title')).includes('복원 실패') && (await txt('.modal-body')).includes('읽을 수 없어요'), '깨진 JSON → 복원 실패 모달');
  await page.keyboard.press('Escape'); await sleep(150);
  await page.setInputFiles(restoreInput, file('summary.json', summ.text)); await sleep(300);
  expect((await txt('.modal-title')).includes('교사 모드용'), '요약 파일을 복원에 넣으면 "교사 모드용" 안내');
  await page.keyboard.press('Escape'); await sleep(150);
  await page.setInputFiles(restoreInput, file('other.json', JSON.stringify({ type: 'something-else', data: [] }))); await sleep(300);
  expect((await txt('.modal-body')).includes('형식이 아니에요'), '다른 형식 JSON → 형식 오류 모달');
  await page.keyboard.press('Escape'); await sleep(150);
  await page.setInputFiles(restoreInput, file('v2.json', JSON.stringify(Object.assign({}, bk, { version: 2 })))); await sleep(300);
  expect((await txt('.modal-body')).includes('더 새로운 버전'), '상위 버전 백업 거부');
  await page.keyboard.press('Escape'); await sleep(150);
  expect((await st()).data.cards.length === 72, '잘못된 복원 시도 후 데이터 그대로(72장)');

  /* ---- 복원: 프로필로 추가 / 덮어쓰기 ---- */
  await page.setInputFiles(restoreInput, file('backup.json', backup.text)); await sleep(300);
  expect((await txt('.modal-title')).includes('백업 복원') && (await txt('.modal-body')).includes('프로필 2개') && (await txt('.modal-body')).includes('김하늘'), '복원 모달: 프로필 2개(이름) 표시');
  const pre = await dl('#pre-backup', modal());
  expect(!!pre && pre.name.includes('백업'), '"현재 데이터를 먼저 백업" 버튼 다운로드');
  await modal().locator('[data-value="add"]').click(); await sleep(400);
  s = await st();
  expect(s.meta.profiles.length === 4 && s.meta.profiles.filter(p => p.name === '김하늘(2)').length === 1 && s.meta.profiles.filter(p => p.name === '이도윤(2)').length === 1, '프로필로 추가 → 4개, 이름 중복은 (2) 부여');
  const added = s.meta.profiles.find(p => p.name === '김하늘(2)');
  expect(!!added && added.id !== 'p-haneul', '추가된 프로필은 새 id');
  await page.evaluate(id => window.__app.actions.switchProfile(id), added.id); await sleep(300);
  s = await st(); expect(s.data.cards.length === 72 && s.data.decks.length === 5, '추가된 프로필 데이터(72장) 로드');
  await page.click('#tab-settings'); await sleep(150);
  await page.setInputFiles(restoreInput, file('backup.json', backup.text)); await sleep(300);
  await modal().locator('[data-value="over"]').click(); await sleep(400);
  s = await st();
  expect(s.meta.profiles.length === 2 && s.profile.id === 'p-haneul' && s.data.cards.length === 72, '덮어쓰기 → 프로필 2개·김하늘 72장 복원');
  await reload(); s = await st();
  expect(s.meta.profiles.length === 2 && s.data.cards.length === 72, '새로고침 후 복원 상태 유지');

  /* ---- AC11 교사 모드 ---- */
  await page.click('#tab-settings'); await sleep(150);
  expect(await page.locator('#tab-teacher').isHidden(), '교사 모드 전 교사 탭 숨김');
  await page.evaluate(() => window.__app.actions.setView('teacher')); await sleep(150);
  expect(await visible('#view-settings') && !(await visible('#view-teacher')), '교사 모드 꺼진 상태에서 teacher 뷰 직접 진입 → 설정으로 우회');
  await page.check('input[data-action="set-teacher"]'); await sleep(200);
  expect(!(await page.locator('#tab-teacher').isHidden()), '교사 모드 켜면 교사 탭 표시');
  await page.click('#tab-teacher'); await sleep(200);
  expect(await visible('#view-teacher') && (await txt('#view-teacher')).includes('아직 가져온 학생 자료가 없어요'), '교사 탭 빈 상태');
  expect(await page.locator('[data-action="teacher-csv"]').isDisabled() && await page.locator('[data-action="teacher-clear"]').isDisabled(), '학생 0명: 집계 CSV·지우기 비활성');
  await page.click('[data-action="teacher-sample"]'); await sleep(300);
  expect((await page.locator('#student-list tbody tr').count()) === 6, 'AC11 샘플 학급 학생 6명');
  const names = await page.$$eval('#student-list tbody tr td:first-child', els => els.map(e => e.textContent.trim()));
  expect(['이도윤', '박서아', '최민준', '정하윤', '한수아', '송민재'].every(n => names.includes(n)), '학생 이름 6명 (' + names.join(',') + ')');
  const pc1 = await txt('#point-cards .point-card');
  expect(pc1.includes('복습 포인트 1') && pc1.includes('분수의 덧셈과 뺄셈') && pc1.includes('5명'), 'AC11 복습 포인트 1위: 분수의 덧셈과 뺄셈·5명 (' + pc1.replace(/\s+/g, ' ').trim().slice(0, 90) + ')');
  expect(/오답 17장/.test(pc1) && /계산·표기 실수\(\d+%\)/.test(pc1), '포인트 1 오답 17장·주 원인 계산 (' + (pc1.match(/오답 \d+장 · 주 원인 [^(]+\(\d+%\)/) || [''])[0] + ')');
  expect((await page.locator('#point-cards .point-card').count()) === 3, '복습 포인트 카드 3장');
  const focus = await page.$$eval('#focus-list .panel', els => els.map(e => e.textContent.replace(/\s+/g, ' ')));
  expect(focus[0].includes('박서아') && focus[0].includes('한수아') && !focus[0].includes('최민준'), 'AC11 계산 실수형: 박서아·한수아 (' + focus[0].slice(0, 80) + ')');
  expect(focus[1].includes('최민준'), '개념 부족형: 최민준');
  expect(focus[2].includes('송민재'), '복습 습관 점검: 송민재');
  const unitRows = await page.$$eval('#unit-table tbody tr', els => els.map(e => [...e.querySelectorAll('td')].map(t => t.textContent.trim()).join('|')));
  expect(unitRows.length === 4 && unitRows[0].startsWith('분수의 덧셈과 뺄셈|5|17|5|3|9|0|0') && unitRows[1].startsWith('약분과 통분|4|9|6|') && unitRows[2].startsWith('다각형의 둘레와 넓이|3|7|0|4') && unitRows[3].startsWith('소수의 곱셈|2|4'), '단원×원인 표 4행·학생수·장수·원인별 수 (' + unitRows.join(' / ') + ')');
  await page.locator('#unit-table tbody tr').first().locator('td.clickable').first().click(); await sleep(100);
  const cd = await txt('#cell-detail');
  expect(cd.includes('분수의 덧셈과 뺄셈') && /[가-힣]{3}/.test(cd.split(':')[1] || ''), '셀 클릭 → 학생 이름 펼침 (' + cd + ')');
  await shot('d01-teacher');
  const agg = await dl('[data-action="teacher-csv"]');
  expect(!!agg && agg.text.charCodeAt(0) === 0xFEFF && agg.text.slice(1).startsWith('단원,학생수,오답장수,개념,읽기,계산,시간,몰랐음,주원인') && agg.text.split('\r\n').length === 5, '집계 CSV: BOM+헤더+4행');
  const ttpl = await dl('[data-action="teacher-template"]');
  expect(!!ttpl && ttpl.name.includes('템플릿') && ttpl.text.slice(1).startsWith('앞면,뒷면'), '학급 단어장 CSV 템플릿 다운로드');
  // 파일 가져오기: 유효 요약 + 깨진 JSON + 다른 형식 + 전체 백업(자동 변환) 한 번에
  const mkSum = (name, exportedAt, n, extra) => Object.assign({ type: 'memory-box-summary', version: 1, exportedAt, student: { name }, decks: [], wrong: Array.from({ length: n }, (_, i) => ({ deck: '수학 오답노트', unit: '소수의 곱셈', front: '0.3 × 0.4 (' + i + ')', reason: 'calc', fails: 2, lastFail: today })), stats: { reviewed30d: 5, accuracy30d: 60, streak: 0 } }, extra || {});
  await page.setInputFiles('#teacher-drop input[type=file]', [file('a.json', JSON.stringify(mkSum('테스트학생', '2026-10-20T10:00:00', 3))), file('broken.json', '{{{'), file('other.json', JSON.stringify({ type: 'nope' })), file('backup.json', backup.text)]); await sleep(600);
  s = await st();
  const impNames = s.teacher.imports.map(i => i.studentName);
  expect(impNames.includes('테스트학생') && impNames.includes('김하늘') && s.teacher.imports.length === 8, '요약 1 + 백업(프로필 2, 이도윤은 최신으로 교체) → 8명 (' + impNames.join(',') + ')');
  const toasts = await page.$$eval('#toast-root .toast', els => els.map(e => e.textContent));
  expect(toasts.some(t => t.includes('broken.json') && t.includes('읽을 수 없어요')) && toasts.some(t => t.includes('other.json') && t.includes('아니에요')), '파일별 실패 토스트(깨진 JSON·형식 불일치) (' + toasts.join(' / ') + ')');
  const haneulImp = s.teacher.imports.find(i => i.studentName === '김하늘');
  expect(!!haneulImp && haneulImp.wrong.length === 14 && haneulImp.stats.streak === 6, '백업 → 요약 자동 변환(김하늘 오답 14·스트릭 6)');
  // 같은 이름: 최신 exportedAt만 교체
  await page.setInputFiles('#teacher-drop input[type=file]', [file('old.json', JSON.stringify(mkSum('테스트학생', '2026-10-01T10:00:00', 9)))]); await sleep(300);
  s = await st(); let t1 = s.teacher.imports.filter(i => i.studentName === '테스트학생');
  expect(t1.length === 1 && t1[0].wrong.length === 3, '오래된 파일 재가져오기 → 교체 안 됨(오답 3 유지)');
  await page.setInputFiles('#teacher-drop input[type=file]', [file('new.json', JSON.stringify(mkSum('테스트학생', '2026-10-22T10:00:00', 5)))]); await sleep(300);
  s = await st(); t1 = s.teacher.imports.filter(i => i.studentName === '테스트학생');
  expect(t1.length === 1 && t1[0].wrong.length === 5, '최신 파일 재가져오기 → 교체(오답 5)');
  // XSS: stats 값에 HTML
  await page.setInputFiles('#teacher-drop input[type=file]', [file('xss.json', JSON.stringify(mkSum('<b>엑스</b>', '2026-10-23T10:00:00', 1, { stats: { reviewed30d: '<img src=x onerror="window.__xssT=1">', accuracy30d: 50, streak: 0 } })))]); await sleep(500);
  const xssT = await page.evaluate(() => window.__xssT);
  expect(xssT === undefined && (await page.locator('#student-list img').count()) === 0, '[보안] 교사 요약 stats 값의 HTML이 실행되지 않음 (__xssT=' + xssT + ')');
  expect((await txt('#student-list')).includes('<b>엑스</b>'), '학생 이름 HTML은 이스케이프됨');
  await page.click('[data-action="teacher-remove"][data-name="테스트학생"]'); await sleep(200);
  s = await st(); expect(!s.teacher.imports.some(i => i.studentName === '테스트학생'), '학생 삭제');
  // 집계 형식이 깨진 요약(wrong이 배열 아님) → 교사 탭 렌더 여부
  const before = (await st()).teacher.imports.length;
  await page.setInputFiles('#teacher-drop input[type=file]', [file('badwrong.json', JSON.stringify({ type: 'memory-box-summary', version: 1, exportedAt: '2026-10-23T10:00:00', student: { name: '형식오류' }, wrong: 'oops', stats: {} }))]); await sleep(500);
  const savedBad = await page.evaluate(() => (JSON.parse(localStorage.getItem('edu.memory-box.v1.teacher') || '{"imports":[]}').imports || []).some(i => i.studentName === '형식오류'));
  await reload(); await page.click('#tab-teacher'); await sleep(300);
  const teacherHtml = (await txt('#view-teacher')).trim();
  const teacherOk = teacherHtml.length > 0 && await visible('#student-list');
  log('형식 깨진 요약 저장됨: ' + savedBad + ', 새로고침 후 교사 탭 내용 길이: ' + teacherHtml.length);
  expect(teacherOk, '[결함 재현] wrong이 배열이 아닌 요약 파일 1개를 넣어도 교사 탭이 계속 렌더됨(실제: ' + (teacherOk ? '정상' : '빈 화면·예외') + ')');
  if (!teacherOk) {
    await shot('d04-teacher-broken');
    // 복구: 저장소에서 해당 항목 제거 후 새로고침
    await page.evaluate(() => { const k = 'edu.memory-box.v1.teacher'; const t = JSON.parse(localStorage.getItem(k)); t.imports = t.imports.filter(i => i.studentName !== '형식오류'); localStorage.setItem(k, JSON.stringify(t)); });
    await reload(); await page.click('#tab-teacher'); await sleep(200);
    log('형식오류 항목 제거 후 복구됨: ' + await visible('#student-list'));
  }
  await reload(); await sleep(100);
  expect(!(await page.locator('#tab-teacher').isHidden()), '새로고침 후 교사 모드 유지');
  await page.click('#tab-teacher'); await sleep(200);
  s = await st();
  expect(s.teacher.imports.length >= 7 && (await page.locator('#student-list tbody tr').count()) === s.teacher.imports.length, '새로고침 후 교사 데이터 유지 (' + s.teacher.imports.length + '명)');
  await page.click('[data-action="teacher-clear"]'); await sleep(200);
  expect((await txt('.modal-title')).includes('교사 데이터 지우기'), '지우기 확인 모달');
  await modal().locator('.btn-danger').click(); await sleep(300);
  expect((await st()).teacher.imports.length === 0 && (await txt('#view-teacher')).includes('아직 가져온 학생 자료가 없어요'), '교사 데이터 지우기 → 빈 상태');
  await page.click('#tab-settings'); await sleep(150);
  await page.uncheck('input[data-action="set-teacher"]'); await sleep(200);
  expect(await page.locator('#tab-teacher').isHidden(), '교사 모드 끄면 탭 숨김');

  /* ---- 프로필 추가·수정·삭제 ---- */
  await page.click('[data-action="profile-add"]'); await sleep(200);
  expect(await modal().locator('[data-value="true"]').isDisabled(), '프로필 이름 빈값 → 저장 비활성');
  await page.fill('#pf-name', '김하늘'); await page.click('.modal [data-emoji="🦉"]'); await page.fill('#pf-goal', '99');
  await modal().locator('[data-value="true"]').click(); await sleep(300);
  s = await st();
  const dup = s.meta.profiles.find(p => p.name === '김하늘(2)');
  expect(!!dup && dup.emoji === '🦉' && dup.dailyGoal === 50 && s.meta.profiles.length === 3, '프로필 추가: 중복 이름 → 김하늘(2), 이모지, 목표 99→50');
  await page.click(`[data-action="switch-profile"][data-id="${dup.id}"]`); await sleep(300);
  s = await st(); expect(s.profile.id === dup.id && s.data.cards.length === 0, '설정에서 전환 → 새 프로필(카드 0)');
  await page.click('#tab-home'); await sleep(150);
  expect((await txt('#view-home')).includes('아직 카드가 없어요') && await visible('#view-home [data-action="goto"][data-view="cards"]'), '카드 0장 홈: 안내+바로가기');
  await page.click('#tab-settings'); await sleep(150);
  await page.click(`[data-action="profile-edit"][data-id="${dup.id}"]`); await sleep(200);
  expect((await page.inputValue('#pf-name')) === '김하늘(2)', '프로필 수정 모달 값 채움');
  await page.fill('#pf-name', '  '); expect(await modal().locator('[data-value="true"]').isDisabled(), '수정: 공백 이름 → 저장 비활성');
  await page.fill('#pf-name', '새이름'); await modal().locator('[data-value="true"]').click(); await sleep(300);
  expect((await txt('#profile-chip')).includes('새이름'), '프로필 이름 수정 → 칩 반영');
  // 삭제: 이름 입력 확인(틀린 이름은 비활성), 활성 프로필 삭제 시 첫 프로필로 전환
  await page.click(`[data-action="profile-delete"][data-id="${dup.id}"]`); await sleep(200);
  expect((await txt('.modal-title')).includes('프로필 삭제') && await modal().locator('[data-value="true"]').isDisabled(), '삭제 모달: 이름 입력 전 비활성');
  await page.fill('#del-name', '다른이름'); await sleep(50);
  expect(await modal().locator('[data-value="true"]').isDisabled(), '틀린 이름 → 비활성');
  await page.fill('#del-name', '새이름'); await sleep(50);
  expect(!(await modal().locator('[data-value="true"]').isDisabled()), '정확한 이름 → 활성');
  await modal().locator('[data-value="true"]').click(); await sleep(300);
  s = await st();
  expect(s.meta.profiles.length === 2 && s.profile.id === 'p-haneul' && s.data.cards.length === 72, '활성 프로필 삭제 → 김하늘로 전환·72장');
  expect((await page.evaluate(id => localStorage.getItem('edu.memory-box.v1.profile.' + id), dup.id)) === null, '삭제된 프로필 저장 키 제거');
  await page.click('[data-action="profile-delete"][data-id="p-doyun"]'); await sleep(200);
  await page.fill('#del-name', '이도윤'); await modal().locator('[data-value="true"]').click(); await sleep(300);
  s = await st();
  expect(s.meta.profiles.length === 1 && await page.locator('[data-action="profile-delete"]').isDisabled(), '마지막 1개 프로필 삭제 버튼 비활성');

  /* ---- 샘플 데이터 다시 넣기 ---- */
  await page.click('[data-action="resample"]'); await sleep(200);
  expect((await txt('.modal-title')).includes('샘플 데이터 다시 넣기'), '샘플 다시 넣기 확인 모달');
  await page.keyboard.press('Escape'); await sleep(150);
  expect((await st()).meta.profiles.length === 1, 'ESC 취소 → 변화 없음');
  await page.click('[data-action="resample"]'); await sleep(200); await modal().locator('.btn-danger').click(); await sleep(400);
  s = await st();
  expect(s.meta.profiles.length === 2 && s.profile.name === '김하늘' && s.data.cards.length === 72 && s.profile.dailyGoal === 10, '샘플 다시 넣기 → 프로필 2·72장·목표 10');
  await page.click('#tab-home'); await sleep(150);
  expect(/오늘 복습 11장/.test(await txt('#view-home')) && /밀림 3장/.test(await txt('#view-home')), '샘플 복원 후 홈 11장(밀림 3장)');

  /* ---- 이 프로필 데이터 모두 삭제(이름 확인) ---- */
  await page.click('#tab-settings'); await sleep(150);
  await page.click('[data-action="wipe-profile"]'); await sleep(200);
  expect(await modal().locator('[data-value="true"]').isDisabled(), '데이터 삭제: 이름 입력 전 비활성');
  await page.fill('#wipe-name', '김하늘'); await sleep(50); await modal().locator('[data-value="true"]').click(); await sleep(300);
  s = await st();
  expect(s.data.cards.length === 0 && s.meta.profiles.length === 2 && s.profile.name === '김하늘', '데이터 삭제 → 카드 0·프로필은 유지');
  await reload(); s = await st();
  expect(s.data.cards.length === 0, '새로고침 후 삭제 상태 유지');
  await page.click('#tab-settings'); await sleep(150);
  await page.click('[data-action="resample"]'); await sleep(200); await modal().locator('.btn-danger').click(); await sleep(400);
  expect((await st()).data.cards.length === 72, '샘플 복원(72장)');

  /* ---- 테마 토글·애니메이션 줄이기·도움말 ---- */
  await page.click('#theme-btn'); await sleep(100);
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && (await page.evaluate(() => localStorage.getItem('edu.memory-box.theme'))) === '"dark"', '테마 토글 → data-theme=dark + edu.memory-box.theme 저장');
  await reload();
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && (await txt('#theme-btn')).includes('☀️'), '새로고침 후 다크 유지·버튼 ☀️');
  await page.click('#theme-btn'); await sleep(100);
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', '다시 토글 → light');
  await page.click('#tab-settings'); await sleep(150);
  await page.check('input[data-action="set-motion"]'); await sleep(100);
  expect((await page.evaluate(() => document.documentElement.dataset.motion)) === 'reduce', '애니메이션 줄이기 → data-motion=reduce');
  await reload(); expect((await page.evaluate(() => document.documentElement.dataset.motion)) === 'reduce', '새로고침 후 애니메이션 줄이기 유지');
  await page.click('#tab-settings'); await sleep(100); await page.uncheck('input[data-action="set-motion"]'); await sleep(100);
  await page.click('[data-action="help"]'); await sleep(200);
  expect((await txt('.modal-title')).includes('기억상자 사용법') && (await page.locator('.modal .help-steps li').count()) >= 3 && (await txt('.modal')).includes('Space'), '도움말 모달: 단계 3개 이상·단축키');
  await page.keyboard.press('Escape'); await sleep(150);
  expect(!(await visible('.modal')), 'ESC로 도움말 닫힘');
  await shot('d02-settings');

  /* ---- [결함 재현] 형식이 깨진 백업 덮어쓰기 → 데이터 손실 여부 ---- */
  await page.click('#tab-settings'); await sleep(150);
  await page.setInputFiles(restoreInput, file('broken-backup.json', JSON.stringify({ type: 'memory-box-backup', version: 1, meta: {}, profiles: {} }))); await sleep(300);
  const openedOver = (await txt('.modal-title')).includes('백업 복원');
  expect(!openedOver, '[결함 재현] meta.profiles 없는 백업은 형식 검사에서 거부되어야 함(실제: ' + (openedOver ? '복원 모달 열림' : '거부') + ')');
  if (openedOver) {
    await modal().locator('[data-value="over"]').click(); await sleep(500);
    await reload(); await sleep(200);
    const after = await page.evaluate(() => { try { return window.__app.getState().data.cards.length; } catch (e) { return 'ERR:' + e.message; } });
    log('깨진 백업 덮어쓰기 후 새로고침 카드 수: ' + after);
    expect(after === 72, '[결함 재현] 깨진 백업 덮어쓰기 후에도 기존 데이터(72장) 보존 (실제 ' + after + ')');
    await shot('d03-after-broken-restore');
  }
};
