// func-scenes.js — 장면 보관함(저장·불러오기·이름/복제/삭제·검색·필터), JSON 내보내기/가져오기(드롭·파일·오류), 샘플 복원, 저장 실패 배너 (AC11, AC12, AC16)
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const txt = sel => page.locator(sel).first().innerText();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent));
  const modalCount = () => page.locator('.modal[role=dialog]').count();
  const closeModals = async () => { for (let i = 0; i < 3 && (await modalCount()); i++) { await page.keyboard.press('Escape'); await sleep(80); } };
  // 드롭존에 File을 drop 이벤트로 투입
  const dropFile = async (name, content, type = 'application/json') => {
    const dt = await page.evaluateHandle(([n, c, t]) => { const dt = new DataTransfer(); dt.items.add(new File([c], n, { type: t })); return dt; }, [name, content, type]);
    await page.dispatchEvent('#dropzone', 'dragenter', { dataTransfer: dt });
    const over = await page.evaluate(() => document.querySelector('#dropzone').classList.contains('over'));
    await page.dispatchEvent('#dropzone', 'drop', { dataTransfer: dt });
    await sleep(400);
    return over;
  };
  let s;

  // ---------- 보관함 초기 ----------
  await page.click('.tabs [data-tab=scenes]'); await sleep(200);
  expect(await page.locator('.scene-card').count() === 12 && await page.locator('.scene-card .thumb').count() === 12, '보관함 내장 장면 12개 + 썸네일');
  expect(await page.locator('.scene-card .badge.soft:has-text("내장")').count() === 12, '내장 배지 12');
  const card08 = page.locator('.scene-card[data-id="sc-b08"]');
  expect((await card08.locator('.scene-name').innerText()) === '5-1 동치분수 찾기' && (await card08.locator('.scene-memo').innerText()).startsWith('×2, ×3을 눌러도') && (await card08.locator('.scene-foot').innerText()).includes('2026.03.02'), '장면 카드: 이름·메모 첫 줄·날짜');
  expect(await card08.locator('.thumb .cell.on').count() === 1 && await card08.locator('.thumb .cell').count() === 1, '썸네일 1/2 막대(색칠 1칸)');
  // 검색·필터
  await page.fill('#scene-search', '오개념'); await sleep(100);
  expect(await page.locator('.scene-card').count() === 1 && (await txt('.scene-card .scene-name')) === '5-1 분모가 다른 덧셈', '메모 검색 "오개념" → 1개');
  await page.fill('#scene-search', ''); await page.selectOption('#scene-grade', '3'); await sleep(100);
  expect(await page.locator('.scene-card').count() === 4, '3학년 필터 4개');
  await page.selectOption('#scene-grade', ''); await sleep(50);

  // ---------- AC11 장면 저장 ----------
  await page.click('.tabs [data-tab=kit]'); await sleep(100);
  await act('kitSetD', 5); await act('kitSetN', 3); await act('kitSplit', 2); await sleep(450);
  await page.uncheck('[data-model-toggle=circle]'); await page.uncheck('#kit-decimal');
  await page.click('[data-action=save-scene]'); await sleep(200);
  expect(await modalCount() === 1 && (await txt('.modal-head')).includes('장면 저장'), '장면 저장 모달');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'sv-name', '첫 입력(이름)에 포커스');
  await page.fill('#sv-name', '   '); await page.click('.modal-foot .btn.primary'); await sleep(100);
  expect(await modalCount() === 1 && (await txt('#sv-err')).includes('이름'), '공백 이름 → 오류, 저장 안 됨');
  expect((await page.locator('#sv-name').getAttribute('maxlength')) === '40' && (await page.locator('#sv-memo').getAttribute('maxlength')) === '300', '이름 40자·메모 300자 제한');
  await page.fill('#sv-name', '테스트 장면'); await page.selectOption('#sv-grade', '5'); await page.fill('#sv-unit', '5-1 약분과 통분'); await page.fill('#sv-memo', '발문 테스트');
  await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.scenes === 13 && (await toasts()).some(t => t.includes("'테스트 장면' 장면을 저장했어요")), 'AC11 저장 → 13개 + 토스트');
  expect(s.loadedSceneId && s.loadedSceneId.startsWith('sc-') && (await txt('#memo-panel')).includes('발문 테스트'), '저장 직후 메모 패널에 발문');
  await reload(); await sleep(300);
  s = await S(); expect(s.counts.scenes === 13, 'AC11 새로고침 후 13개 유지');
  await page.click('.tabs [data-tab=scenes]'); await sleep(200);
  const tc = page.locator('.scene-card:has-text("테스트 장면")');
  expect(await tc.count() === 1 && await tc.locator('.thumb').count() === 1 && (await tc.locator('.badge').first().innerText()) === '5학년' && (await tc.innerText()).includes('교구판'), 'AC11 썸네일 카드(5학년·교구판)');
  expect(await tc.locator('.thumb .div').count() === 9 && await tc.locator('.thumb .cell.on').count() === 6, '썸네일 6/10(분할선 9·색칠 6)');
  expect((await page.locator('.scene-card').first().innerText()).includes('테스트 장면'), '최근 저장 장면이 맨 앞');
  // 상태 바꾼 뒤 불러오기
  await page.click('.tabs [data-tab=kit]'); await act('kitSetD', 3); await act('kitSetN', 1); await page.check('[data-model-toggle=circle]'); await page.check('#kit-decimal');
  await page.click('.tabs [data-tab=scenes]'); await tc.locator('[data-sc=load]').click(); await sleep(300);
  s = await S();
  expect(s.tab === 'kit' && s.kit.n === 6 && s.kit.d === 10 && s.kit.chain.length === 2 && s.kit.chain[1].op === '×2' && s.kit.models.circle === false && s.kit.showDecimal === false, 'AC11 불러오기 → 6/10·사슬·표시 옵션 복원 ' + JSON.stringify(s.kit));
  expect(!(await page.locator('#memo-panel').isHidden()) && (await txt('#memo-panel')).includes('발문 테스트') && (await txt('#memo-title')).includes('테스트 장면'), 'AC11 교사 메모 패널 "발문 테스트"');
  expect((await txt('.kit-chain')).includes('3/5') && (await txt('.kit-chain')).includes('6/10'), '불러온 사슬 3/5 = 6/10 렌더');
  expect(!(await page.locator('#btn-undo').isDisabled()), '불러오기는 되돌리기 가능한 확정 이벤트');
  await page.keyboard.press('Control+z');
  s = await S(); expect(s.kit.d === 3 && s.kit.n === 1, '불러오기 되돌리기 → 이전 1/3');
  // 비교/연산 장면 불러오기 → 해당 탭 전환
  await page.click('.tabs [data-tab=scenes]'); await page.click('.scene-card[data-id="sc-b03"] [data-sc=load]'); await sleep(300);
  s = await S(); expect(s.tab === 'compare' && s.compare.a.n === 1 && s.compare.a.d === 3 && s.compare.b.d === 4 && s.compare.overlay === true, '비교 장면 불러오기 → 비교 탭·겹쳐 보기 켬');
  expect(await page.locator('.cmp-bars .cell.ov').count() === 1 && (await txt('.cmp-formula')).includes('차이: 1/12'), '겹쳐 보기 렌더 + 차이 1/12');
  await page.click('.tabs [data-tab=scenes]'); await page.click('.scene-card[data-id="sc-b07"] [data-sc=load]'); await sleep(300);
  s = await S(); expect(s.tab === 'arith' && s.arith.op === '-' && s.arith.a.n === 5 && s.arith.b.n === 2, '뺄셈 장면 불러오기 → 연산 탭 5/6 − 2/6');
  // 같은 이름 저장 → (2)
  await page.click('.tabs [data-tab=kit]');
  await act('saveScene', { name: '테스트 장면', grade: 5, unit: '', memo: '' }); await act('saveScene', { name: '테스트 장면', grade: 5, unit: '', memo: '' });
  const names = (await act('getDb')).scenes.map(x => x.name).filter(n => n.startsWith('테스트 장면'));
  expect(names.includes('테스트 장면 (2)') && names.includes('테스트 장면 (3)'), '중복 이름 → (2), (3) 접미: ' + names.join(','));
  // 이름 XSS·길이 초과
  const longName = 'ㄱ'.repeat(60);
  await act('saveScene', { name: '<img src=x onerror=alert(1)>', grade: 9, unit: 'u'.repeat(50), memo: 'm'.repeat(400) });
  const db1 = await act('getDb'); const xs = db1.scenes.find(x => x.name.startsWith('<img'));
  expect(xs && xs.grade === null && xs.unit.length === 30 && xs.memo.length === 300, 'API 저장: 잘못된 학년 null·단원 30·메모 300자 절단');
  await act('saveScene', { name: longName, grade: null, unit: '', memo: '' });
  expect((await act('getDb')).scenes.some(x => x.name === 'ㄱ'.repeat(40)), '이름 40자 절단');
  await page.click('.tabs [data-tab=scenes]'); await sleep(200);
  const gridHtml = await page.evaluate(() => document.querySelector('#scene-grid').innerHTML);
  expect(!gridHtml.includes('<img src=x') && gridHtml.includes('&lt;img'), 'XSS: 장면 이름 이스케이프');
  await shot('scenes-grid');
  // 이름 바꾸기·복제·삭제
  const xcard = page.locator('.scene-card:has-text("onerror")').first();
  await xcard.locator('[data-sc=rename]').click(); await sleep(150);
  expect((await page.locator('#rn-name').inputValue()).startsWith('<img'), '이름 바꾸기 모달 기존 이름');
  await page.fill('#rn-name', '테스트 장면'); await page.click('.modal-foot .btn.primary'); await sleep(150);
  expect(await page.locator('.scene-card:has-text("테스트 장면 (4)")').count() === 1, '이름 바꾸기 중복 → (4)');
  await page.click('.scene-card[data-id="sc-b01"] [data-sc=dup]'); await sleep(150);
  s = await S(); const dup = (await act('getDb')).scenes.find(x => x.name === '3-1 피자 똑같이 나누기 (2)');
  expect(dup && dup.builtin === false && dup.id !== 'sc-b01', '복제 → "(2)" 비내장 새 id');
  const before = s.counts.scenes;
  await page.click('.scene-card[data-id="sc-b01"] [data-sc=del]'); await sleep(150);
  expect(await modalCount() === 1 && (await txt('.modal')).includes('샘플 복원으로 되살릴'), '내장 삭제 확인 모달 안내');
  await page.keyboard.press('Escape'); await sleep(100);
  expect((await S()).counts.scenes === before, 'ESC → 삭제 취소');
  await page.click('.scene-card[data-id="sc-b01"] [data-sc=del]'); await sleep(150); await page.click('.modal-foot .btn.primary'); await sleep(150);
  expect((await S()).counts.scenes === before - 1 && await page.locator('.scene-card[data-id="sc-b01"]').count() === 0, '내장 장면 삭제');
  // 삭제한 장면이 불러온 장면이면 메모 패널 숨김
  await page.click('.scene-card[data-id="sc-b08"] [data-sc=load]'); await sleep(200);
  await page.click('.tabs [data-tab=scenes]'); await page.click('.scene-card[data-id="sc-b08"] [data-sc=del]'); await sleep(150); await page.click('.modal-foot .btn.primary'); await sleep(150);
  await page.click('.tabs [data-tab=kit]');
  expect(await page.locator('#memo-panel').isHidden() && (await S()).loadedSceneId === null, '불러온 장면 삭제 → 메모 패널 숨김');

  // ---------- AC12 내보내기(download) ----------
  await page.click('.tabs [data-tab=scenes]'); await sleep(100);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('.scene-tools [data-action=export]')]);
  const today = new Date(); const expName = `fraction-kit-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}.json`;
  expect(dl && dl.suggestedFilename() === expName, 'AC12 내보내기 다운로드 파일명 ' + (dl && dl.suggestedFilename()));
  let exported = null;
  if (dl) { const p = await dl.path(); exported = require('fs').readFileSync(p, 'utf8'); }
  let obj = null; try { obj = JSON.parse(exported); } catch (e) { /* */ }
  s = await S();
  expect(obj && obj.app === 'fraction-kit' && obj.schema === 1 && obj.scenes.length === s.counts.scenes && obj.cards.length === 24 && obj.cardSets.length === 2, '내보낸 JSON 구조(app/schema/scenes/cards/cardSets)');
  // 선택만 내보내기
  await page.click('[data-action=export-selected]'); await sleep(100);
  expect((await toasts()).some(t => t.includes('체크하세요')), '선택 없이 선택 내보내기 → 안내 토스트');
  await page.check('[data-scene-check="sc-b02"]'); await page.check('[data-scene-check="sc-b03"]');
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('[data-action=export-selected]')]);
  const sel = dl2 ? JSON.parse(require('fs').readFileSync(await dl2.path(), 'utf8')) : null;
  expect(sel && sel.scenes.length === 2 && sel.scenes.map(x => x.id).sort().join() === 'sc-b02,sc-b03', '선택만 내보내기 → 장면 2개');
  // 더 보기 메뉴의 JSON 내보내기 버튼
  await page.click('#more-menu summary');
  const [dl3] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#more-menu [data-action=export]')]);
  expect(!!dl3, '툴바 더 보기 → JSON 내보내기 다운로드');

  // ---------- AC12 가져오기 ----------
  const nScenes = s.counts.scenes;
  let over = await dropFile('fraction-kit-20260301.json', exported);
  expect(over, '드래그 중 드롭존 테두리 강조(.over)');
  let t = await toasts();
  expect(t.some(x => /장면 0개, 카드 0개, 세트 0개 가져옴 \(\d+개 건너뜀\)/.test(x)), 'AC12 같은 파일 드롭 → 동일 내용 모두 건너뜀 토스트: ' + t.join('|'));
  expect(await modalCount() === 1 && (await txt('.modal')).includes('건너뛴 항목'), '건너뜀 요약 모달');
  await page.click('.modal summary'); await sleep(50);
  expect(await page.locator('.modal .skip-list li').count() === nScenes + 24 + 2, '건너뜀 사유 목록 개수 = 장면+카드+세트');
  await closeModals();
  expect((await S()).counts.scenes === nScenes, '동일 파일 가져오기 → 장면 수 불변');
  // 내용이 다른 같은 id → 새 id 부여, 세트 cardIds 치환
  const mod = JSON.parse(exported);
  mod.scenes = [Object.assign({}, mod.scenes.find(x => x.id === 'sc-b02'), { name: '변경된 장면', memo: '새 메모' })];
  mod.cards = [Object.assign({}, mod.cards.find(x => x.id === 'c3-01'), { question: '변경된 질문' })];
  mod.cardSets = [{ id: 'cs-new', name: '가져온 세트', cardIds: ['c3-01', 'c3-02', 'no-such'], builtin: false, createdAt: '2026-01-01T00:00:00.000Z' }];
  await page.setInputFiles('#import-file', { name: 'mod.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mod)) }); await sleep(400);
  t = await toasts(); expect(t.some(x => x.includes('장면 1개, 카드 1개, 세트 1개 가져옴 (0개 건너뜀)')), '파일 선택 가져오기: 변경된 항목 → 새 id로 병합: ' + t.join('|'));
  const db2 = await act('getDb');
  const imp = db2.scenes.find(x => x.name === '변경된 장면'), impc = db2.cards.find(x => x.question === '변경된 질문'), impset = db2.cardSets.find(x => x.name === '가져온 세트');
  expect(imp && imp.id !== 'sc-b02' && db2.scenes.some(x => x.id === 'sc-b02'), '충돌 장면 새 id, 기존 유지');
  expect(impc && impc.id !== 'c3-01' && impset && impset.cardIds.length === 2 && impset.cardIds.includes(impc.id) && impset.cardIds.includes('c3-02'), '세트 cardIds 치환 + 없는 카드 제거');
  expect(await page.locator('.scene-card:has-text("변경된 장면")').count() === 1, '가져온 장면 그리드 즉시 반영');
  // 잘못된 파일들
  const n0 = (await S()).counts.scenes;
  await dropFile('notes.json', 'hello, not json');
  t = await toasts(); expect(t.some(x => x.includes('JSON 형식이 아닙니다')) && (await S()).counts.scenes === n0, 'AC12 확장자만 .json인 텍스트 → "JSON 형식이 아닙니다", 장면 수 불변');
  await dropFile('other.json', JSON.stringify({ app: 'other-app', scenes: [] }));
  expect((await toasts()).some(x => x.includes('분수교구함 파일이 아닙니다')), '다른 앱 파일 → 거부 토스트');
  await dropFile('arr.json', '[1,2,3]');
  expect((await toasts()).some(x => x.includes('분수교구함 파일이 아닙니다')), '배열 JSON → 거부');
  await dropFile('big.json', '{"app":"fraction-kit"}' + ' '.repeat(5 * 1024 * 1024 + 10));
  expect((await toasts()).some(x => x.includes('5MB')), '5MB 초과 → 거부 토스트');
  // 부분 유효성 실패 + 악성 값
  const partial = { app: 'fraction-kit', schema: 1, scenes: [
    { id: 'sc-ok1', name: '정상', state: { tab: 'kit', kit: { n: 2, d: 3 } } },
    { id: 'sc-bad1', name: '분모 초과', state: { tab: 'kit', kit: { n: 1, d: 30 } } },
    { id: 'sc-bad2', name: '탭 오류', state: { tab: 'xx' } },
    { id: 'sc-bad3', name: '분자 초과', state: { tab: 'compare', compare: { a: { n: 40, d: 12 }, b: { n: 1, d: 2 } } } },
    { id: 'sc-bad4', name: 'kit 숫자', state: { tab: 'kit', kit: 5 } },
    { id: 'sc-bad5', name: 1234, state: { tab: 'kit' } },
    null, 'string', { id: 'sc-ok2', name: '<svg onload=alert(1)>', grade: '5', unit: null, memo: 42, state: { tab: 'arith', arith: { a: { n: 1.5, d: 2 }, b: { n: 1, d: 2 } } } },
  ], cards: [
    { id: 'cd-ok1', type: 'make', question: '정상 카드', choices: ['1/2', '1/3'], answer: 0, setup: { a: { n: 1, d: 2 } } },
    { id: 'cd-bad1', type: 'make', question: '정답 범위', choices: ['1/2', '1/3'], answer: 5, setup: { a: { n: 1, d: 2 } } },
    { id: 'cd-bad2', type: 'nope', question: 'x', choices: ['a', 'b'], answer: 0 },
    { id: 'cd-bad3', type: 'make', question: '선택지 1개', choices: ['a'], answer: 0, setup: { a: { n: 1, d: 2 } } },
    { id: 'cd-bad4', type: 'compare', question: 'b 없음·setup null', choices: ['a', 'b'], answer: 0, setup: null },
    { id: 'cd-bad5', type: 'make', question: '비문자 선택지', choices: ['a', 2], answer: 0, setup: { a: { n: 1, d: 2 } } },
  ], cardSets: [{ id: 'cs-x', name: '빈 세트', cardIds: ['없음'] }, { id: 'cs-y', name: 'cardIds 아님', cardIds: 'x' }, 7] };
  await dropFile('partial.json', JSON.stringify(partial));
  t = await toasts();
  expect(t.some(x => x.includes('장면 1개, 카드 1개, 세트 0개 가져옴 (16개 건너뜀)')), '부분 유효성: 장면 1·카드 1·세트 0, 16개 건너뜀(장면 8·카드 5·세트 3): ' + t.join('|'));
  expect(await modalCount() === 1, '건너뜀 요약 모달');
  await page.click('.modal summary'); await sleep(50);
  const reasons = await page.locator('.modal .skip-list li').allInnerTexts();
  expect(reasons.some(r => r.includes('교구판 분수 범위')) && reasons.some(r => r.includes('형식 오류')) && reasons.some(r => r.includes('정답 인덱스')) && reasons.some(r => r.includes('포함된 카드가 없음')), '건너뜀 사유 분류: ' + reasons.join(' / '));
  await closeModals();
  const db3 = await act('getDb');
  expect(db3.scenes.some(x => x.id === 'sc-ok1') && !db3.scenes.some(x => x.name.includes('<svg')) && db3.cards.some(x => x.id === 'cd-ok1') && !db3.cards.some(x => x.id === 'cd-bad1'), '유효 항목만 병합, 소수 분자(1.5) 장면 거부');
  // 가져온 뒤 교구판에서 정상 동작
  await page.click('.scene-card:has-text("정상") [data-sc=load]'); await sleep(200);
  s = await S(); expect(s.tab === 'kit' && s.kit.n === 2 && s.kit.d === 3 && s.kit.chain.length === 1, '가져온 장면 불러오기 정상(2/3)');
  // 가져오기 결과 새로고침 유지
  await reload(); await sleep(300);
  s = await S(); expect(s.counts.scenes === n0 + 1 && (await act('getDb')).cards.some(x => x.id === 'cd-ok1'), '새로고침 후 가져온 항목 유지');

  // ---------- 샘플 복원 ----------
  await page.click('.tabs [data-tab=scenes]'); await sleep(100);
  const dbBefore = (await act('getDb')).scenes; const nUser = dbBefore.filter(x => !x.builtin).length; const impCopy = dbBefore.find(x => x.name === '변경된 장면');
  expect(impCopy && impCopy.builtin === false, '[데이터 무결성] 내장 장면의 변경 사본을 가져오면 builtin 플래그가 해제되어야 함 (실제 builtin=' + (impCopy && impCopy.builtin) + ')');
  await page.click('.scene-tools [data-action=reset-samples]'); await sleep(150);
  expect(await modalCount() === 1 && (await txt('.modal')).includes('샘플 복원'), '샘플 복원 확인 모달');
  await page.click('.modal-foot .btn:not(.primary)'); await sleep(100);
  expect(await page.locator('.scene-card[data-id="sc-b01"]').count() === 0, '취소 → 복원 안 됨');
  await page.click('.scene-tools [data-action=reset-samples]'); await sleep(150); await page.click('.modal-foot .btn.primary'); await sleep(250);
  const db4 = await act('getDb');
  const builtinIds = ['sc-b01','sc-b02','sc-b03','sc-b04','sc-b05','sc-b06','sc-b07','sc-b08','sc-b09','sc-b10','sc-b11','sc-b12'];
  expect(builtinIds.every(id => db4.scenes.some(x => x.id === id)) && db4.scenes.length === dbBefore.length + 2 && db4.scenes.filter(x => !x.builtin).length === nUser && db4.scenes.find(x => x.id === 'sc-b02').name === '3-1 분수와 소수: 0.3은 3/10', '샘플 복원: 내장 12 id 복구(+2)·사용자 항목 유지·내장 원본 덮어쓰기 (' + db4.scenes.length + ')');
  expect(await page.locator('.scene-card[data-id="sc-b01"]').count() === 1 && await page.locator('.scene-card[data-id="sc-b08"]').count() === 1, '삭제했던 내장 장면 복구 표시');
  // 빈 상태
  await page.evaluate(() => { const a = window.FK.app; a.db.scenes = []; a.saveDb(); window.FK.scenes.render(); });
  await sleep(100);
  expect((await txt('#scene-grid')).includes('저장된 장면이 없어요') && await page.locator('#scene-grid [data-action=reset-samples]').count() === 1, '빈 상태 안내 + 샘플 복원 버튼');
  await page.click('#scene-grid [data-action=reset-samples]'); await sleep(150); await page.click('.modal-foot .btn.primary'); await sleep(250);
  expect(await page.locator('.scene-card').count() === 12, '빈 상태에서 샘플 복원 → 12');

  // ---------- 200개 상한 ----------
  await page.evaluate(() => { const a = window.FK.app; const base = a.db.scenes[0]; for (let i = a.db.scenes.length; i < 199; i++) a.db.scenes.push(Object.assign(a.clone(base), { id: 'sc-fill' + i, name: '채움 ' + i, builtin: false })); a.saveDb(); });
  await act('saveScene', { name: '200번째', grade: null, unit: '', memo: '' });
  expect((await S()).counts.scenes === 200, '200개까지 저장');
  const r201 = await act('saveScene', { name: '201번째', grade: null, unit: '', memo: '' });
  expect(r201 === null && (await S()).counts.scenes === 200 && (await toasts()).some(x => x.includes('200개')), '201번째 저장 거부 + 토스트');
  await page.click('[data-action=save-scene]'); await sleep(150);
  expect(await modalCount() === 0 && (await toasts()).some(x => x.includes('200개')), '상한에서 저장 버튼 → 모달 대신 토스트');
  await page.click('.tabs [data-tab=scenes]'); await sleep(200);
  await page.click('.scene-card[data-id="sc-b01"] [data-sc=dup]'); await sleep(100);
  expect((await S()).counts.scenes === 200, '상한에서 복제 거부');
  await dropFile('one.json', JSON.stringify({ app: 'fraction-kit', scenes: [{ id: 'sc-z', name: '초과', state: { tab: 'kit' } }] }));
  expect((await S()).counts.scenes === 200 && (await toasts()).some(x => x.includes('200개를 넘어')), '상한 초과 가져오기 거부(원자적)');
  await shot('scenes-200');

  // ---------- 손상된 저장값 ----------
  await page.evaluate(() => { localStorage.setItem('edu.fraction-kit.v1.cards', '{broken json'); localStorage.setItem('edu.fraction-kit.v1.settings', '[1,2'); });
  await reload(); await sleep(600);
  s = await S();
  expect(s.counts.cards === 0 && (await toasts()).some(x => x.includes('손상')), '손상된 JSON → 기본값 + 토스트 1회 (cards=' + s.counts.cards + ')');
  await page.evaluate(() => { localStorage.clear(); });

  // ---------- AC16 localStorage 쓰기 실패 ----------
  await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; });
  await reload(); await sleep(400);
  const ls = await page.evaluate(() => ({ banner: !document.querySelector('#save-banner').hidden, text: document.querySelector('#save-banner').innerText, kit: window.__app.getState().kit, counts: window.__app.getState().counts }));
  expect(ls.banner && ls.text.includes('저장이 꺼져 있어요. JSON 내보내기로 보관하세요'), 'AC16 저장 불가 배너 1회 표시');
  expect(ls.kit.n === 1 && ls.kit.d === 2 && ls.counts.scenes === 12 && ls.counts.cards === 24, 'AC16 저장 실패 상태에서도 시드·기본 장면 정상');
  await page.click('[data-action=close-banner]'); expect(await page.locator('#save-banner').isHidden(), '배너 닫기');
  await act('kitSetD', 6); await act('kitSplit', 2); await sleep(450);
  expect(await page.locator('#save-banner').isHidden() && (await S()).kit.d === 12, '추가 저장 실패에도 배너 재표시 없음·조작 정상');
  await page.click('[data-action=save-scene]'); await sleep(150); await page.fill('#sv-name', '메모리 장면'); await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.scenes === 13, 'AC16 세션 내 장면 저장');
  await page.click('.tabs [data-tab=scenes]'); await sleep(200);
  expect(await page.locator('.scene-card:has-text("메모리 장면")').count() === 1, 'AC16 보관함에 표시');
  const [dl4] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('.scene-tools [data-action=export]')]);
  const ex4 = dl4 ? JSON.parse(require('fs').readFileSync(await dl4.path(), 'utf8')) : null;
  expect(ex4 && ex4.scenes.some(x => x.name === '메모리 장면'), 'AC16 내보내기에 세션 장면 포함');
  await page.click('.tabs [data-tab=cards]'); await page.click('[data-pick="c3-04"]'); await sleep(100);
  await page.locator('.tally-row input[data-tally="0"]').fill('5'); await sleep(100);
  expect((await page.locator('.tally-row input[data-tally="0"]').inputValue()) === '5', 'AC16 저장 실패 상태에서 집계 입력 정상');
};
