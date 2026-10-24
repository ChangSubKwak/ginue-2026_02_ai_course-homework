// func-cards.js — 덱·카드 등록/수정/삭제·입력 검증·XSS·CSV 가져오기/내보내기·필터 독립 검증 (pw-run.js용)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const txt = async sel => (await page.locator(sel).first().textContent()) || '';
  const st = () => page.evaluate(() => window.__app.getState());
  const visible = async sel => (await page.locator(sel).count()) > 0 && await page.locator(sel).first().isVisible();
  const modal = () => page.locator('.modal').last();
  const saveBtn = () => modal().locator('[data-value="true"]');
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  let s = await st(); const today = s.today;
  const box1Home = () => st().then(x => x.boxCounts[0]);

  /* ---- 덱 목록 ---- */
  await page.click('#tab-cards'); await sleep(200);
  expect((await page.locator('.deck-card').count()) === 5, '덱 목록 5개');
  const deckTxt = await txt('.deck-card');
  expect(/\d+장/.test(deckTxt) && (await page.locator('.deck-card .mini-bars').count()) === 5, '덱 카드에 카드 수·상자 분포 미니 막대');
  expect(/오늘 \d+장/.test(await txt('.deck-grid')), '덱 카드에 오늘 예정 장수');
  await shot('c01-decks');

  /* ---- + 덱: 빈 이름 비활성, 공백만 비활성, 저장 ---- */
  await page.click('[data-action="new-deck"]'); await sleep(200);
  expect(await visible('.modal'), '덱 모달 열림');
  expect(await saveBtn().isDisabled(), '덱 이름 빈값 → 저장 비활성');
  await page.fill('#dk-name', '   ');
  expect(await saveBtn().isDisabled(), '덱 이름 공백만 → 저장 비활성');
  await page.fill('#dk-name', '<img src=x onerror=__xss=1> 테스트 덱');
  await page.selectOption('#dk-subj', '과학'); await page.fill('#dk-unit', '용해와 용액 <b>굵게</b>');
  expect(!(await saveBtn().isDisabled()), '덱 이름 입력 → 저장 활성');
  await saveBtn().click(); await sleep(300);
  s = await st();
  const newDeck = s.data.decks.find(d => d.name.includes('테스트 덱'));
  expect(!!newDeck && s.data.decks.length === 6 && newDeck.subject === '과학', '새 덱 저장(6개)·과목 과학');
  expect(await visible('#csv-drop') && (await txt('#view-cards h2')).includes('테스트 덱'), '저장 후 덱 상세로 이동(드롭존 표시)');
  expect((await page.evaluate(() => window.__xss)) === undefined && (await page.locator('#view-cards img').count()) === 0, 'XSS: 덱 이름의 <img onerror> 실행·렌더 안 됨');
  expect(await visible('[data-action="start-deck"][disabled]'), '빈 덱은 "지금 복습" 비활성');

  /* ---- + 카드: 검증 ---- */
  await page.click('[data-action="new-card"]'); await sleep(200);
  expect(await visible('.modal'), '카드 모달 열림');
  expect(await saveBtn().isDisabled() && await modal().locator('[data-value="more"]').isDisabled(), '앞/뒷면 빈값 → 저장·저장하고 하나 더 비활성');
  expect(await page.locator('#cd-reason-wrap').isHidden() && await page.locator('#cd-my-wrap').isHidden(), '암기 유형: 원인 칩·내 답 숨김');
  await page.fill('#cd-front', '앞면만');
  expect(await saveBtn().isDisabled(), '앞면만 입력 → 저장 비활성');
  await page.fill('#cd-back', '뒷면');
  expect(!(await saveBtn().isDisabled()), '앞·뒷면 입력 → 저장 활성');
  // 300자 제한·카운터
  await page.fill('#cd-front', 'ㄱ'.repeat(350));
  expect((await page.inputValue('#cd-front')).length === 300, '앞면 300자 제한');
  expect((await txt('.counter[data-for="cd-front"]')).trim() === '300/300', '글자 수 카운터 300/300');
  // 오답 유형 → 원인 필수
  await page.click('.seg [data-type="wrong"]'); await sleep(100);
  expect(!(await page.locator('#cd-reason-wrap').isHidden()) && !(await page.locator('#cd-my-wrap').isHidden()), '오답 유형: 원인 칩·내 답 표시');
  expect((await page.locator('#cd-reason-wrap .chip-btn').count()) === 5, '원인 칩 5개');
  expect(await saveBtn().isDisabled(), '오답 유형 원인 미선택 → 저장 비활성');
  await page.click('#cd-reason-wrap [data-reason="calc"]'); await sleep(100);
  expect(!(await saveBtn().isDisabled()), '원인 선택 → 저장 활성');
  // XSS 문자열 저장
  const xssFront = '<script>window.__xss2=1</script>2/3 + 1/4 = ?', xssBack = '<img src=x onerror="window.__xss3=1">11/12';
  await page.fill('#cd-front', xssFront); await page.fill('#cd-back', xssBack); await page.fill('#cd-my', '3/7'); await page.fill('#cd-hint', '통분'); await page.fill('#cd-note', '"따옴표" & <b>');
  await modal().locator('[data-value="more"]').click(); await sleep(350);
  s = await st();
  const c1 = s.data.cards.find(c => c.front === xssFront);
  expect(!!c1 && c1.deckId === newDeck.id && c1.type === 'wrong' && c1.box === 1 && c1.due === today && c1.reason === 'calc' && c1.failReasons.join() === 'calc', '저장: 1상자·due 오늘·오답 calc·failReasons [calc]');
  expect((await page.locator('#toast-root .toast').last().textContent()).includes('카드가 1상자에 들어갔어요'), '토스트 "카드가 1상자에 들어갔어요"');
  expect(await visible('.modal') && (await page.inputValue('#cd-front')) === '' && (await page.locator('.seg [data-type="wrong"][aria-pressed="true"]').count()) === 1 && (await page.inputValue('#cd-deck')) === newDeck.id, '"저장하고 하나 더": 폼 비움·유형/덱 유지');
  // 두 번째 카드: 중복 앞면 경고(저장 허용)
  await page.fill('#cd-front', xssFront); await sleep(100);
  expect((await txt('#cd-dup')).includes('같은 앞면'), '중복 앞면 경고 표시');
  await page.click('.seg [data-type="memo"]'); await page.fill('#cd-front', '용질이 용매에 골고루 섞이는 현상'); await page.fill('#cd-back', '용해');
  await saveBtn().click(); await sleep(300);
  s = await st();
  expect(s.data.cards.filter(c => c.deckId === newDeck.id).length === 2 && !(await visible('.modal')), '두 번째 카드 저장(덱 2장)·모달 닫힘');
  expect((await page.evaluate(() => window.__xss2 || window.__xss3)) === undefined && (await page.locator('#card-list img, #card-list script').count()) === 0, 'XSS: 카드 앞/뒷면 스크립트·img 실행 안 됨');
  expect((await txt('#card-list')).includes('<script>'), '카드 목록에 특수문자 원문 그대로 표시');
  expect((await page.locator('#card-list .card-row').count()) === 2, '덱 카드 목록 2장');
  expect((await txt('#view-cards h2')).includes('테스트 덱') && (await txt('#view-cards .panel-head')).includes('2장'), '덱 상세 카드 수 2장');
  await shot('c02-cards-xss');

  /* ---- 카드 수정 모달·삭제 ---- */
  await page.click(`#card-list .card-row[data-id="${c1.id}"]`); await sleep(200);
  expect((await txt('.modal-title')).includes('카드 수정') && (await page.inputValue('#cd-front')) === xssFront && (await page.inputValue('#cd-my')) === '3/7', '카드 클릭 → 수정 모달(값 채워짐)');
  expect((await modal().locator('[data-value="delete"]').count()) === 1 && (await modal().locator('[data-value="more"]').count()) === 0, '수정 모드: 삭제 버튼 있고 "하나 더" 없음');
  await page.fill('#cd-back', '11/12 수정'); await saveBtn().click(); await sleep(300);
  s = await st();
  expect(s.data.cards.find(c => c.id === c1.id).back === '11/12 수정', '카드 수정 저장');
  await page.click(`#card-list .card-row[data-id="${c1.id}"]`); await sleep(200);
  await modal().locator('[data-value="delete"]').click(); await sleep(200);
  expect((await txt('.modal-title')).includes('카드 삭제'), '삭제 → 확인 모달');
  await page.keyboard.press('Escape'); await sleep(200);
  s = await st();
  expect(!!s.data.cards.find(c => c.id === c1.id) && !(await visible('.modal')), 'ESC로 삭제 취소(카드 유지)');
  await page.click(`#card-list .card-row[data-id="${c1.id}"]`); await sleep(200);
  await modal().locator('[data-value="delete"]').click(); await sleep(200);
  await modal().locator('.btn-danger').click(); await sleep(300);
  s = await st();
  expect(!s.data.cards.find(c => c.id === c1.id) && (await page.locator('#card-list .card-row').count()) === 1, '삭제 확인 → 카드 삭제(1장)');

  /* ---- AC7 CSV 가져오기: 헤더 + 3열 10행(쉼표 포함 1행) ---- */
  const csvRows = [['앞면', '뒷면', '힌트']];
  for (let i = 1; i <= 10; i++) csvRows.push(i === 4 ? ['"between, among"', '"~사이에, ~중에"', '쉼표 행'] : [`word${i}`, `뜻${i}`, i % 2 ? `힌트${i}` : '']);
  const csvText = '﻿' + csvRows.map(r => r.join(',')).join('\r\n');
  const b1Before = await box1Home(); const homeB1 = b1Before;
  await page.setInputFiles('#csv-drop input[type=file]', { name: 'test.csv', mimeType: 'text/csv', buffer: Buffer.from(csvText, 'utf-8') }); await sleep(400);
  expect(await visible('.modal') && (await txt('.modal-title')).includes('CSV 미리보기'), 'AC7 CSV 미리보기 모달');
  const pv = await txt('.modal-body');
  expect(pv.includes('총 10행'), 'AC7 "총 10행" 표시 (' + (pv.match(/총 \d+행/) || ['없음'])[0] + ')');
  expect(pv.includes('건너뜀 0행') && pv.includes('헤더 제외'), '건너뜀 0행·헤더 제외 표시');
  expect((await page.locator('.modal tbody tr').count()) === 5, '미리보기 처음 5행');
  expect((await txt('.modal tbody tr:nth-child(4)')).includes('between, among'), 'AC7 쉼표 포함 행 앞면이 따옴표 처리로 온전함');
  await shot('c03-csv-preview');
  await saveBtn().click(); await sleep(400);
  s = await st();
  const deckCount = s.data.cards.filter(c => c.deckId === newDeck.id).length;
  expect(deckCount === 11, 'AC7 가져오기 후 덱 카드 수 11(1+10) (실제 ' + deckCount + ')');
  expect(s.boxCounts[0] === homeB1 + 10, 'AC7 1상자 수 +10 (' + homeB1 + '→' + s.boxCounts[0] + ')');
  const between = s.data.cards.find(c => c.front === 'between, among');
  expect(!!between && between.back === '~사이에, ~중에' && between.hint === '쉼표 행' && between.due === today && between.box === 1, 'AC7 쉼표 행 앞면·뒷면 온전, 1상자·오늘');
  expect((await page.locator('#toast-root .toast').last().textContent()).includes('추가 10장, 중복 0장'), '토스트 "추가 10장, 중복 0장 건너뜀"');
  expect((await txt('#view-cards .panel-head')).includes('11장'), '덱 상세 카드 수 11장 갱신');
  await page.click('#tab-home'); await sleep(200);
  expect(Number(await txt('.boxes [data-box="1"] b')) === homeB1 + 10 && (await txt('#view-home')).includes(`오늘 복습 ${s.queue.length}장`), '홈 1상자 숫자·오늘 큐 갱신(' + s.queue.length + '장)');
  await page.click('#tab-cards'); await sleep(200);
  // 카드 탭을 다시 누르면 덱 목록이 아니라 마지막 덱 상세가 열림(상태 유지) → 덱 목록으로 돌아가는지 기록
  const reopenedDetail = await visible('[data-action="back-decks"]');
  log('카드 탭 재진입 시 덱 상세 유지: ' + reopenedDetail);
  expect(!reopenedDetail, '[UX] 카드 탭을 다시 누르면 덱 목록(첫 화면)이 열림 (실제: 마지막 덱 상세 유지)');
  if (reopenedDetail) { await page.click('[data-action="back-decks"]'); await sleep(200); }
  await page.click(`[data-action="open-deck"][data-id="${newDeck.id}"]`); await sleep(200);

  /* ---- CSV 중복 처리: 같은 파일 다시 → 중복 10, 기본 건너뜀 / 체크 시 추가 ---- */
  await page.setInputFiles('#csv-drop input[type=file]', { name: 'test.csv', mimeType: 'text/csv', buffer: Buffer.from(csvText, 'utf-8') }); await sleep(400);
  expect((await txt('.modal-body')).includes('중복 10행') && (await page.locator('#csv-adddup').count()) === 1, '중복 10행 표시 + 중복 추가 옵션');
  await saveBtn().click(); await sleep(400);
  expect((await page.locator('#toast-root .toast').last().textContent()).includes('추가 0장, 중복 10장'), '중복 기본 건너뜀(추가 0장, 중복 10장)');
  s = await st(); expect(s.data.cards.filter(c => c.deckId === newDeck.id).length === 11, '중복 건너뜀 후 11장 유지');
  await page.setInputFiles('#csv-drop input[type=file]', { name: 'test.csv', mimeType: 'text/csv', buffer: Buffer.from(csvText, 'utf-8') }); await sleep(400);
  await page.check('#csv-adddup'); await saveBtn().click(); await sleep(400);
  s = await st(); expect(s.data.cards.filter(c => c.deckId === newDeck.id).length === 21, '중복 추가 허용 → 21장');

  /* ---- CSV 엣지: 헤더 없음·열 부족·빈 행·오답 유형·따옴표 불일치·빈 파일·1000행 초과 ---- */
  const edge = 'a1,b1\n,b2\na3\n\n"a4,b4,힌트,오답,개념\n';
  await page.setInputFiles('#csv-drop input[type=file]', { name: 'edge.csv', mimeType: 'text/csv', buffer: Buffer.from(edge, 'utf-8') }); await sleep(400);
  const ev = await txt('.modal-body');
  expect(ev.includes('따옴표 짝이 맞지 않아요'), '따옴표 불일치 경고');
  expect(/건너뜀 [1-9]\d*행/.test(ev), '열 부족·빈 행 건너뜀 수 표시 (' + (ev.match(/건너뜀 \d+행/) || [''])[0] + ')');
  await page.keyboard.press('Escape'); await sleep(200);
  const typed = '문제,정답,힌트,유형,원인\n5/6 - 1/3,1/2,,오답,계산\n12/18 기약분수,2/3,,오답,\nhello,안녕,,암기,';
  await page.setInputFiles('#csv-drop input[type=file]', { name: 'typed.csv', mimeType: 'text/csv', buffer: Buffer.from(typed, 'utf-8') }); await sleep(400);
  expect((await txt('.modal-body')).includes('총 3행') && (await txt('.modal tbody')).includes('오답') && (await txt('.modal tbody')).includes('계산'), '헤더 "문제" 인식·유형/원인 열 매핑');
  await saveBtn().click(); await sleep(400);
  s = await st();
  const w1 = s.data.cards.find(c => c.front === '5/6 - 1/3' && c.deckId === newDeck.id), w2 = s.data.cards.find(c => c.front === '12/18 기약분수' && c.deckId === newDeck.id);
  expect(w1 && w1.type === 'wrong' && w1.reason === 'calc' && w2 && w2.type === 'wrong' && w2.reason === 'unknown', 'CSV 오답 유형: 계산→calc, 원인 공백→unknown');
  await page.setInputFiles('#csv-drop input[type=file]', { name: 'empty.csv', mimeType: 'text/csv', buffer: Buffer.from('\n\n', 'utf-8') }); await sleep(400);
  expect(await visible('.modal') && await saveBtn().isDisabled() && (await txt('.modal tbody')).includes('읽을 수 있는 행이 없어요'), '0행 CSV → 가져오기 비활성');
  // 확인 버튼이 비활성인 모달은 포커스가 모달 안으로 들어가지 않아 ESC가 먹지 않는지 확인
  const focusIn = await page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.modal')));
  await page.keyboard.press('Escape'); await sleep(200);
  const escClosed = !(await visible('.modal'));
  expect(escClosed, '[a11y] 0행 CSV 미리보기 모달(확인 버튼 비활성)이 ESC로 닫힘 (모달 안 포커스: ' + focusIn + ')');
  if (!escClosed) { await page.click('.modal-x'); await sleep(200); }
  const big = Array.from({ length: 1005 }, (_, i) => `big${i},뜻${i}`).join('\n');
  await page.setInputFiles('#csv-drop input[type=file]', { name: 'big.csv', mimeType: 'text/csv', buffer: Buffer.from(big, 'utf-8') }); await sleep(600);
  const bigTxt = await modal().locator('.modal-body').textContent();
  expect(bigTxt.includes('1000행을 넘어'), '1,000행 초과 경고');
  await saveBtn().click(); await sleep(800);
  const bigToast = await page.locator('#toast-root .toast').last().textContent();
  expect(bigToast.includes('추가 1000장'), '[스펙] 1,000행 초과 시 앞 1,000행만 추가 (토스트: ' + bigToast + ')');
  s = await st();
  const bigAdded = s.data.cards.filter(c => c.deckId === newDeck.id && c.front.startsWith('big')).length;
  expect(bigAdded === 1000, '[스펙] 실제 추가 big 카드 1000장 (실제 ' + bigAdded + ')');
  // 깨진 글자(U+FFFD) 감지
  await page.setInputFiles('#csv-drop input[type=file]', { name: 'euckr.csv', mimeType: 'text/csv', buffer: Buffer.from('����,��\n�,�', 'utf-8') }); await sleep(400);
  expect((await modal().locator('.modal-body').textContent()).includes('UTF-8로 저장'), '깨진 글자 다수 → UTF-8 저장 안내');
  await page.keyboard.press('Escape'); await sleep(200);
  if (await visible('.modal')) { await page.click('.modal-x'); await sleep(200); }

  /* ---- 검색·필터·정렬 ---- */
  await page.fill('#card-q', 'between'); await sleep(150);
  expect((await page.locator('#card-list .card-row').count()) === 2, '검색 "between" → 2장(원본+중복)');
  await page.fill('#card-q', '~사이에'); await sleep(150);
  expect((await page.locator('#card-list .card-row').count()) === 2, '뒷면 검색 동작');
  await page.fill('#card-q', ''); await page.click('[data-filter="type"][data-val="wrong"]'); await sleep(150);
  expect((await page.locator('#card-list .card-row').count()) === 2, '유형 필터 오답 2장');
  await page.click('[data-filter="type"][data-val="all"]'); await page.click('[data-filter="box"][data-val="2"]'); await sleep(150);
  expect((await txt('#card-list')).includes('표시할 카드가 없어요'), '2상자 필터 → 빈 상태 문구');
  await page.click('[data-filter="box"][data-val="all"]'); await page.selectOption('#card-sort', 'recent'); await sleep(150);
  expect((await page.locator('#card-list .card-row').count()) > 1000, '정렬 변경 후 목록 유지');

  /* ---- CSV 내보내기(다운로드) ---- */
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('[data-action="export-csv"]')]);
  expect(!!dl && /\.csv$/.test(dl.suggestedFilename()), 'CSV 내보내기 다운로드 발생 (' + (dl && dl.suggestedFilename()) + ')');
  if (dl) {
    const fs = require('fs'); const p = await dl.path(); const content = fs.readFileSync(p, 'utf-8');
    expect(content.charCodeAt(0) === 0xFEFF && content.startsWith('﻿앞면,뒷면,힌트,유형,원인'), 'CSV UTF-8 BOM + 헤더');
    expect(content.includes('"between, among"') && content.includes('"<script>window.__xss2=1</script>2/3 + 1/4 = ?"') === false, 'CSV 쉼표 포함 셀 따옴표 이스케이프');
    expect(content.split('\r\n').length === 1 + s.data.cards.filter(c => c.deckId === newDeck.id).length, 'CSV 행 수 = 헤더 + 덱 카드 수');
  }

  /* ---- 덱 수정·삭제(확인 모달에 카드 수) ---- */
  await page.click('[data-action="edit-deck"]'); await sleep(200);
  expect((await page.inputValue('#dk-name')).includes('테스트 덱'), '덱 수정 모달 값 채움');
  await page.fill('#dk-name', '수정된 덱'); await saveBtn().click(); await sleep(300);
  expect((await txt('#view-cards h2')).includes('수정된 덱'), '덱 이름 수정 반영');
  await page.click('[data-action="delete-deck"]'); await sleep(200);
  const n = s.data.cards.filter(c => c.deckId === newDeck.id).length;
  s = await st(); const nNow = s.data.cards.filter(c => c.deckId === newDeck.id).length;
  expect((await txt('.modal-body')).includes(`${nNow}장`), '덱 삭제 모달에 카드 수 ' + nNow + '장 표시');
  await modal().locator('.btn-danger').click(); await sleep(300);
  s = await st();
  expect(s.data.decks.length === 5 && !s.data.cards.some(c => c.deckId === newDeck.id) && (await page.locator('.deck-card').count()) === 5, '덱 삭제 → 덱 5개·카드 제거');
  await reload();
  s = await st();
  expect(s.data.decks.length === 5 && s.data.cards.length === 72, '새로고침 후 삭제 상태 유지(72장)');

  /* ---- 빠른 추가(FAB)·세션 중 입력란 포커스 시 단축키 무시 ---- */
  await page.click('#tab-home'); await sleep(150);
  await page.click('.fab'); await sleep(200);
  expect(await visible('.modal') && (await txt('.modal-title')).includes('새 카드'), 'FAB → 새 카드 모달');
  expect((await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'cd-front', '모달 열리면 앞면에 포커스');
  // Tab 포커스 트랩: 여러 번 Tab 해도 모달 안에 머무름
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.modal')), 'Tab 25회 후에도 포커스가 모달 안');
  await page.keyboard.press('Escape'); await sleep(200);
  expect(!(await visible('.modal')), 'ESC로 카드 모달 닫힘');
  expect((await page.evaluate(() => document.activeElement && document.activeElement.className)) === 'fab', '모달 닫힌 뒤 포커스가 FAB로 복귀');
  // 덱이 0개인 프로필에서 FAB → 덱 모달 유도
  await page.evaluate(() => window.__app.actions.switchProfile('p-doyun')); await sleep(300);
  s = await st(); expect(s.data.decks.length === 2, '이도윤 전환(덱 2)');
  await page.click('#tab-cards'); await sleep(200);
  await page.click('[data-action="open-deck"]'); await sleep(200);
  await page.click('[data-action="start-deck"]'); await sleep(300);
  await page.keyboard.press('3'); await sleep(50);
  expect((await page.locator('#conf-btns [data-c="3"][aria-pressed="true"]').count()) === 1, '세션 키보드 3 동작');
  await page.keyboard.press('Escape'); await sleep(200);
  await page.evaluate(() => window.__app.actions.switchProfile('p-haneul')); await sleep(300);
  await shot('c04-end');
};
