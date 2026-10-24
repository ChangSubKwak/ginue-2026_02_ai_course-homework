// 기억상자 수용 기준 테스트 모듈 (pw-run.js용)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const txt = async sel => (await page.locator(sel).first().textContent()) || '';
  const st = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  const skipSummary = async () => { await sleep(700); if (await page.locator('.modal [data-value="skip"]').count()) { await page.click('.modal [data-value="skip"]'); await sleep(300); } };
  const gradeInSession = async (ok, conf = 3, reason = 'misread') => {
    await page.click(`#conf-btns [data-c="${conf}"]`); await page.click('#flip-btn'); await sleep(150);
    await page.click(`#grade-btns [data-ok="${ok ? 1 : 0}"]`); await sleep(150);
    if (await page.locator('#reason-panel:not([hidden])').count()) await page.click(`#reason-panel [data-reason="${reason}"]`);
    await sleep(600);
  };
  const allCards = async () => { await page.click('#tab-cards'); await sleep(150); if (await page.locator('[data-action="back-decks"]').count()) { await page.click('[data-action="back-decks"]'); await sleep(150); } await page.click('[data-action="all-cards"]'); await sleep(150); };
  let s = await st(); const today = s.today;

  // AC1: 첫 화면
  const home = await txt('#view-home');
  expect((await txt('#profile-chip')).includes('김하늘'), 'AC1 프로필 김하늘 선택');
  expect(home.includes('오늘 복습 11장') && home.includes('밀림 3장'), 'AC1 오늘 복습 11장(밀림 3장): ' + (home.match(/오늘 복습 \d+장 \(밀림 \d+장\)/) || [''])[0]);
  expect(home.includes('6일') && s.streak === 6, 'AC1 스트릭 6 (실제 ' + s.streak + ')');
  expect(home.includes('D-12') && home.includes('수학 5단원 단원평가'), 'AC1 D-12 배너');
  expect(s.boxCounts.join(',') === '14,18,16,14,10', 'AC1 상자 분포 14/18/16/14/10 (실제 ' + s.boxCounts.join(',') + ')');
  await shot('01-home');

  // AC2: 세션 시작, 확신도 전 뒤집기 비활성, 스페이스 뒤집기
  await page.click('[data-action="start-today"]'); await sleep(300);
  expect(!(await page.locator('#session').isHidden()), 'AC2 세션 화면 열림');
  expect(await page.locator('#flip-btn').isDisabled(), 'AC2 확신도 전 뒤집기 disabled');
  await page.click('#conf-btns [data-c="3"]');
  expect(!(await page.locator('#flip-btn').isDisabled()), 'AC2 확신도 후 뒤집기 활성');
  await page.keyboard.press('Space'); await sleep(200);
  expect(await page.locator('#flip-card.flipped').count() === 1, 'AC2 스페이스로 뒤집힘');
  expect(await page.locator('#grade-btns:visible').count() === 1, 'AC2 틀렸어요/맞았어요 표시');
  await shot('02-session-flipped');
  // 첫 카드 → 맞음(키보드), 이어서 3장 더 처리 후 Esc
  const firstId = s.queue[0];
  await page.keyboard.press('ArrowRight'); await sleep(600);
  for (let i = 0; i < 3; i++) await gradeInSession(i % 2 === 0, 2, 'calc');
  const beforeEsc = await st(); const movedCard = beforeEsc.data.cards.find(c => c.id === firstId);
  await page.keyboard.press('Escape'); await sleep(300);
  expect(await page.locator('#session').isHidden(), 'AC6 Esc로 세션 종료');
  await reload();
  const h2 = await txt('#view-home');
  expect(/이어서 하기\s*\(남은 7장\)/.test(h2.replace(/\s+/g, ' ')), 'AC6 새로고침 후 이어서 하기(남은 7장): ' + (h2.match(/남은 \d+장/) || [''])[0]);
  const afterReload = await st(); const mc2 = afterReload.data.cards.find(c => c.id === firstId);
  expect(mc2.box === movedCard.box && mc2.due === movedCard.due && mc2.box === (movedCard.history.slice(-1)[0].from + 1 <= 5 ? movedCard.history.slice(-1)[0].from + 1 : 5), 'AC6 처리한 카드 상자 변경 유지(box ' + mc2.box + ')');

  // AC5: 이어서 11장 모두 처리 → 요약 모달 4분면 합 = 11, 되새김 저장
  await page.click('[data-action="resume"]'); await sleep(300);
  for (let i = 0; i < 7; i++) { if (await page.locator('.modal').count()) break; await gradeInSession(i % 3 !== 0, (i % 3) + 1, 'concept'); }
  await sleep(500);
  expect(await page.locator('.modal').count() === 1, 'AC5 요약 모달 표시');
  const quad = await page.$$eval('.quad-cell b', els => els.map(e => Number(e.textContent)));
  expect(quad.length === 4 && quad.reduce((a, b) => a + b, 0) === 11, 'AC5 4분면 합 = 11 (' + quad.join('+') + ')');
  expect((await txt('#coach-line')).length > 5, 'AC5 코칭 문장: ' + (await txt('#coach-line')));
  await shot('03-summary');
  await page.fill('#reflect-in', '테스트'); await page.click('.modal [data-value="true"]'); await sleep(300);
  await page.click('#tab-history'); await sleep(300);
  expect((await txt('#reflect-list .reflect-item q')).trim() === '테스트', 'AC5 기록 탭 되새김 맨 위 = 테스트');
  // AC9: 망각 예측 토글·잔디 달력
  expect(await page.locator('#forecast-wrap path[stroke-dasharray]').count() === 0, 'AC9 토글 전 두 번째 선 없음');
  await page.click('#forecast-toggle'); await sleep(200);
  expect(await page.locator('#forecast-wrap path[stroke-dasharray]').count() === 1 && (await txt('#forecast-wrap')).includes('7일 뒤'), 'AC9 토글 후 두 번째 선 + 7일 뒤 N장');
  await shot('04-history-forecast');
  await page.click('#forecast-toggle'); await sleep(200);
  expect(await page.locator('#forecast-wrap path[stroke-dasharray]').count() === 0, 'AC9 토글 끄면 사라짐');
  const filled = await page.locator('.cal-cell:not(.g0)').count();
  expect(filled >= 30, 'AC9 잔디 달력 채워진 셀 ' + filled + ' >= 30');

  // AC3: 2상자 카드 확실→맞음 → 3상자, 오늘+4 / 틀림 → 1상자, 오늘+1
  s = await st(); const c2 = s.data.cards.find(c => c.box === 2 && c.type === 'memo');
  await act('startSession', 'deck', [c2.id]); await sleep(300);
  const mini3Before = Number(await txt('#mini-boxes [data-box="3"] b'));
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(150); await page.click('#grade-btns [data-ok="1"]'); await sleep(100);
  const mini3After = Number(await txt('#mini-boxes [data-box="3"] b'));
  expect(mini3After === mini3Before + 1, 'AC3 미니 상자 3 숫자 +1 (' + mini3Before + '→' + mini3After + ')');
  await skipSummary();
  s = await st(); let cc = s.data.cards.find(c => c.id === c2.id);
  expect(cc.box === 3 && cc.due === addDays(today, 4), 'AC3 상자 3, 다음 복습일 오늘+4 (' + cc.box + ', ' + cc.due + ')');
  await allCards(); await page.fill('#card-q', c2.front); await sleep(200);
  const rowTxt = await txt('#card-list .card-row');
  expect(rowTxt.includes('3상자') && rowTxt.includes(`${Number(cc.due.slice(5, 7))}/${Number(cc.due.slice(8))}`), 'AC3 카드 목록에 3상자·날짜 표시');
  await act('startSession', 'deck', [c2.id]); await sleep(300);
  await gradeInSession(false, 3); await skipSummary();
  s = await st(); cc = s.data.cards.find(c => c.id === c2.id);
  expect(cc.box === 1 && cc.due === addDays(today, 1), 'AC3 틀림 → 상자 1, 오늘+1 (' + cc.box + ', ' + cc.due + ')');

  // AC4: 오답 카드 틀림 → 원인 패널, 고르기 전 진행 안 됨
  const w = s.data.cards.find(c => c.type === 'wrong' && c.reason !== 'misread');
  await act('startSession', 'deck', [w.id]); await sleep(300);
  await page.click('#conf-btns [data-c="2"]'); await page.click('#flip-btn'); await sleep(150); await page.click('#grade-btns [data-ok="0"]'); await sleep(150);
  expect(await page.locator('#reason-panel:visible').count() === 1, 'AC4 원인 태그 패널 표시');
  await page.keyboard.press('ArrowRight'); await sleep(300);
  expect(!(await page.locator('#session').isHidden()) && await page.locator('#reason-panel:visible').count() === 1, 'AC4 태그 고르기 전에는 넘어가지 않음');
  await shot('05-reason-panel');
  await page.click('#reason-panel [data-reason="misread"]'); await skipSummary();
  s = await st(); const w2 = s.data.cards.find(c => c.id === w.id);
  expect(w2.reason === 'misread' && w2.box === 1, 'AC4 원인 misread로 갱신');
  await allCards(); await page.fill('#card-q', w.front); await sleep(200);
  expect((await txt('#card-list .card-row')).includes('읽기'), 'AC4 카드 목록 원인 배지 ‘읽기’');

  // AC15: 5상자 카드 확실→맞음 → 5상자 유지, 오늘+30, 숙달
  const c5 = s.data.cards.find(c => c.box === 5 && !c.mastered);
  await act('startSession', 'deck', [c5.id]); await sleep(300); await gradeInSession(true, 3); await skipSummary();
  s = await st(); const c5b = s.data.cards.find(c => c.id === c5.id);
  expect(c5b.box === 5 && c5b.due === addDays(today, 30) && c5b.mastered, 'AC15 5상자 유지·오늘+30·숙달');
  await allCards(); await page.fill('#card-q', c5.front); await sleep(200);
  expect((await txt('#card-list .card-row')).includes('숙달'), 'AC15 카드 목록 ★ 숙달 표시');

  // AC7: 새 덱 + CSV 10행(따옴표 안 쉼표 포함) 가져오기
  const box1Before = (await st()).boxCounts[0];
  await page.click('#tab-cards'); await sleep(150); if (await page.locator('[data-action="back-decks"]').count()) await page.click('[data-action="back-decks"]'); await page.click('[data-action="new-deck"]'); await sleep(200);
  await page.fill('#dk-name', 'CSV 테스트 덱'); await page.click('.modal [data-value="true"]'); await sleep(300);
  s = await st(); const nd = s.data.decks.find(d => d.name === 'CSV 테스트 덱');
  expect(!!nd, 'AC7 새 덱 생성');
  const csv = '앞면,뒷면,힌트\n' + [...Array(9)].map((_, i) => `문제 ${i + 1},정답 ${i + 1},힌트 ${i + 1}`).join('\n') + '\n"쉼표, 포함 앞면","정답, 10",힌트';
  page.evaluate(([t, id]) => window.__app.actions.importCsvText(t, id), [csv, nd.id]).catch(() => {}); await sleep(600);
  const prev = await txt('.modal');
  expect(prev.includes('총 10행'), 'AC7 미리보기 ‘총 10행’');
  await shot('06-csv-preview');
  await page.click('.modal [data-value="true"]'); await sleep(400);
  s = await st();
  expect(s.data.cards.filter(c => c.deckId === nd.id).length === 10, 'AC7 덱 카드 수 10');
  expect(s.boxCounts[0] === box1Before + 10, 'AC7 1상자 +10 (' + box1Before + '→' + s.boxCounts[0] + ')');
  expect(s.data.cards.some(c => c.front === '쉼표, 포함 앞면' && c.back === '정답, 10'), 'AC7 쉼표 포함 행 보존');

  // AC8: 하루 목표 5 → 새로고침 유지
  await page.click('#tab-settings'); await page.fill('#goal-in', '5'); await page.click('[data-action="goal-save"]'); await sleep(200);
  await reload(); await page.click('#tab-settings'); await sleep(200);
  expect((await page.inputValue('#goal-in')) === '5', 'AC8 설정 목표 5 유지');
  await page.click('#tab-home'); await sleep(200);
  expect((await txt('#view-home')).includes('/5장'), 'AC8 홈 진행 바 분모 5');

  // AC10: 시험 오늘+10, 영어 덱
  await page.click('#tab-exam'); await page.click('[data-action="new-exam"]'); await sleep(200);
  await page.fill('#ex-title', '영어 단어 시험'); await page.fill('#ex-date', addDays(today, 10));
  await page.click('.modal [data-deck]:has-text("영어 5학년 Unit 4 단어")'); await page.click('.modal [data-value="true"]'); await sleep(400);
  s = await st(); const ex = s.data.exams.find(e => e.title === '영어 단어 시험'); const enDeck = s.data.decks.find(d => d.name === '영어 5학년 Unit 4 단어');
  const planSum = await page.$$eval(`#plan-${ex.id} .plan-day b`, els => els.map(e => Number(e.textContent)).reduce((a, b) => a + b, 0));
  const planCells = await page.locator(`#plan-${ex.id} .plan-day`).count();
  expect(planCells === 10 && planSum >= 16, 'AC10 계획 달력 10칸, 장수 합 ' + planSum + ' >= 16');
  expect(s.data.cards.filter(c => c.deckId === enDeck.id).every(c => c.due <= addDays(today, 9)), 'AC10 영어 덱 모든 카드 복습일 ≤ 시험 전날');
  await shot('07-exam');
  await page.click('#tab-home'); await sleep(200);
  expect((await txt('#view-home')).includes('D-10'), 'AC10 홈 배너 D-10');

  // AC11: 교사 모드 샘플 학급
  await page.click('#tab-settings'); await page.click('[data-action="set-teacher"]'); await sleep(200);
  expect(!(await page.locator('#tab-teacher').isHidden()), 'AC11 교사 탭 표시');
  await page.click('#tab-teacher'); await page.click('[data-action="teacher-sample"]'); await sleep(300);
  expect(await page.locator('#student-list tbody tr').count() === 6, 'AC11 학생 6명');
  const p1 = await txt('#point-cards .point-card');
  expect(p1.includes('분수의 덧셈과 뺄셈') && p1.includes('5명'), 'AC11 복습 포인트 1위 분수의 덧셈과 뺄셈 5명: ' + p1.slice(0, 80));
  const calcTxt = await txt('#focus-list .panel');
  expect(calcTxt.includes('박서아') && calcTxt.includes('한수아'), 'AC11 계산 실수형 박서아·한수아: ' + calcTxt);
  const conceptTxt = await page.locator('#focus-list .panel').nth(1).textContent();
  expect(conceptTxt.includes('최민준') && !conceptTxt.includes('이도윤') && !conceptTxt.includes('송민재'), 'AC11 개념 부족형 최민준만');
  expect((await page.locator('#focus-list .panel').nth(2).textContent()).includes('송민재'), 'AC11 복습 습관 점검 송민재');
  await shot('08-teacher');

  // AC12: 프로필 전환
  const before = await st(); const bq = before.queue.length, bd = before.data.decks.length;
  await page.click('#tab-home'); await page.click('#profile-chip'); await sleep(150); await page.click('.pop-menu [data-id="p-doyun"]'); await sleep(300);
  s = await st();
  expect(s.profile.name === '이도윤' && s.queue.length === 9 && s.data.decks.length === 2, 'AC12 이도윤: 큐 9·덱 2 (' + s.queue.length + ', ' + s.data.decks.length + ')');
  expect((await txt('#view-home')).includes('오늘 복습 9장'), 'AC12 홈 큐 9장 표시');
  await page.click('#profile-chip'); await sleep(150); await page.click('.pop-menu [data-id="p-haneul"]'); await sleep(300);
  s = await st();
  expect(s.profile.name === '김하늘' && s.queue.length === bq && s.data.decks.length === bd, 'AC12 김하늘 복귀 시 큐·덱 유지');

  // AC13: 400px 가로 스크롤 없음, 탭 이동, 세션 버튼 보임
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(200);
  const over = [];
  for (const v of ['home', 'cards', 'history', 'exam', 'print', 'teacher', 'settings']) { await page.click('#tab-' + v); await sleep(250); const o = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1); if (o) over.push(v); }
  expect(over.length === 0, 'AC13 400px 가로 스크롤 없음 (' + (over.join(',') || '없음') + ')');
  await allCards(); await sleep(200);
  expect(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), 'AC13 카드 목록 400px 가로 스크롤 없음');
  await shot('09-mobile-cards');
  s = await st(); const anyId = s.data.cards[0].id;
  await act('startSession', 'deck', [anyId]); await sleep(300); await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(300);
  const vis = await page.evaluate(() => [...document.querySelectorAll('#grade-btns button, #conf-btns button, #session .icon-btn')].map(b => { const r = b.getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1; }));
  expect(vis.every(Boolean), 'AC13 세션 버튼 모두 화면 안');
  expect(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), 'AC13 세션 400px 가로 스크롤 없음');
  await shot('10-mobile-session');
  await page.keyboard.press('Escape'); await sleep(200);
  await page.setViewportSize({ width: 1280, height: 800 });

  // AC14: localStorage.setItem 예외 → 배너 + 동작 유지
  await page.addInitScript(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; window.__origSet = o; });
  await reload(); await sleep(300);
  expect(!(await page.locator('#storage-banner').isHidden()) && (await txt('#storage-banner')).includes('저장이 되지 않아요'), 'AC14 저장 불가 배너');
  const pe = (await st()).data.cards.length;
  await page.click('.fab'); await sleep(200); await page.fill('#cd-front', '메모리 모드 카드'); await page.fill('#cd-back', '정답'); await sleep(100); await page.click('.modal [data-value="true"]'); await sleep(300);
  expect((await st()).data.cards.length === pe + 1, 'AC14 카드 추가 동작(메모리 모드)');
  s = await st(); const q0 = s.queue[0];
  await page.click('#tab-home'); await sleep(100);
  const startBtn = await page.locator('[data-action="start-today"], [data-action="resume"]').first();
  await startBtn.click(); await sleep(300);
  expect(!(await page.locator('#session').isHidden()), 'AC14 복습 시작 동작(메모리 모드)');
  await gradeInSession(true, 3);
  expect((await st()).data.cards.find(c => c.id === q0).lastReviewed === today, 'AC14 복습 처리 반영(메모리 모드)');
  await shot('11-storage-fail');
  log('done');
};
