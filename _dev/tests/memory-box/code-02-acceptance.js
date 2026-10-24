// code-02-acceptance.js — 기억상자 스펙 acceptance_criteria 15개 자동 확인
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const text = sel => page.locator(sel).innerText();
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  let s = await st(); const today = s.today;

  // AC1 첫 화면
  const home = await text('#view-home'); const chip = await text('#profile-chip');
  expect(chip.includes('김하늘'), 'AC1 프로필 김하늘 선택');
  expect(home.includes('오늘 복습 11장') && home.includes('밀림 3장'), 'AC1 오늘 복습 11장(밀림 3장)');
  expect(/6일/.test(home), 'AC1 스트릭 6');
  expect(home.includes('D-12') && home.includes('수학 5단원 단원평가'), 'AC1 D-12 배너');

  // AC12 프로필 전환(변경 전 먼저)
  await page.click('#profile-chip'); await sleep(150); await page.click('.pop-menu [data-action="switch-profile"]:not(.on)'); await sleep(300);
  s = await st(); expect(s.profile.name === '이도윤' && s.queue.length === 9 && s.data.decks.length === 2, `AC12 이도윤 전환: 큐 ${s.queue.length}·덱 ${s.data.decks.length}`);
  await page.evaluate(() => window.__app.actions.switchProfile('p-haneul')); await sleep(300);
  s = await st(); expect(s.profile.name === '김하늘' && s.queue.length === 11 && s.data.decks.length === 5, `AC12 김하늘 복귀: 큐 ${s.queue.length}·덱 ${s.data.decks.length}`);

  // AC9 기록 탭
  await page.click('#tab-history'); await sleep(300);
  const filled = await page.locator('.cal-cell:not(.g0)').count(); expect(filled >= 30, `AC9 잔디 달력 채워진 셀 ${filled}개 ≥ 30`);
  let paths = await page.locator('#forecast-wrap path').count(); expect(paths === 1, `AC9 토글 전 선 ${paths}개`);
  await page.click('#forecast-toggle'); await sleep(200);
  paths = await page.locator('#forecast-wrap path').count(); const fw = await text('#forecast-wrap');
  expect(paths === 2 && /7일 뒤 \d+장/.test(fw), `AC9 토글 후 선 ${paths}개 · 7일 뒤 표시`);
  await page.click('#forecast-toggle'); await sleep(200);
  paths = await page.locator('#forecast-wrap path').count(); expect(paths === 1 && !/7일 뒤/.test(await text('#forecast-wrap')), 'AC9 토글 끄면 두 번째 선 사라짐');
  await shot('history');

  // AC13 400px
  await page.setViewportSize({ width: 400, height: 800 });
  for (const v of ['home', 'cards', 'history', 'exam', 'print', 'settings']) {
    await page.click('#tab-' + v); await sleep(200);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(ov <= 0, `AC13 400px ${v} 가로 스크롤 없음(초과 ${ov}px)`);
  }
  await page.click('#tab-home'); await page.click('[data-action="start-today"]'); await sleep(300);
  await shot('session-400-front');
  await page.keyboard.press('3'); await page.keyboard.press(' '); await sleep(500);
  const gradeVisible = await page.evaluate(() => { const b = document.querySelector('#grade-btns'); if (!b) return false; const r = b.getBoundingClientRect(); return r.bottom <= window.innerHeight && r.width > 0; });
  expect(gradeVisible, 'AC13 400px 세션 채점 버튼 화면 안에 보임');
  const sov = await page.evaluate(() => document.getElementById('session').scrollWidth - document.getElementById('session').clientWidth);
  expect(sov <= 0, `AC13 400px 세션 가로 스크롤 없음(초과 ${sov}px)`);
  await shot('session-400-back');
  await page.keyboard.press('Escape'); await sleep(300);
  await page.setViewportSize({ width: 1280, height: 800 });
  // 세션 중단 상태 정리(아직 채점 없음 → pending 없음)
  s = await st(); log('pending after esc w/o grading: ' + JSON.stringify(s.data.pendingSession));

  // AC2 세션 시작 → 뒤집기 비활성 → 확실해요 → Space
  await page.click('[data-action="start-today"]'); await sleep(300);
  expect(await page.locator('#flip-btn').isDisabled(), 'AC2 확신도 전 뒤집기 disabled');
  await page.click('[data-action="conf"][data-c="3"]'); expect(!(await page.locator('#flip-btn').isDisabled()), 'AC2 확신도 후 뒤집기 활성');
  await page.keyboard.press(' '); await sleep(450);
  expect(await page.locator('#flip-card.flipped').count() === 1 && await page.locator('#grade-btns').isVisible(), 'AC2 뒤집힘 + 틀렸어요/맞았어요 표시');
  await shot('session-flipped');

  // AC3 (현재 카드) 확실→맞음 → 미니 상자 숫자 증가, 카드 상자/복습일
  s = await st(); let cid = s.session.ids[s.session.idx]; let card = s.data.cards.find(c => c.id === cid); const fromBox = card.box;
  const miniBefore = await page.$$eval('#mini-boxes b', els => els.map(e => Number(e.textContent)));
  await page.keyboard.press('ArrowRight'); await sleep(150);
  const miniAfter = await page.$$eval('#mini-boxes b', els => els.map(e => Number(e.textContent)));
  const toBox = Math.min(5, fromBox + 1);
  expect(fromBox >= 5 || miniAfter[toBox - 1] === miniBefore[toBox - 1] + 1, `AC3 미니 상자 ${toBox} 숫자 +1 (${miniBefore[toBox - 1]}→${miniAfter[toBox - 1]})`);
  s = await st(); card = s.data.cards.find(c => c.id === cid);
  const expDue = fromBox >= 5 ? addDays(today, 30) : addDays(today, { 2: 2, 3: 4, 4: 7, 5: 15 }[toBox]);
  expect(card.box === toBox && card.due === expDue, `AC3 카드 상자 ${fromBox}→${card.box}, due ${card.due} (기대 ${expDue})`);
  await sleep(500);
  // AC3 두 번째 부분: 2상자 카드 확실→맞음 → 3상자·오늘+4, 같은 카드 틀림 → 1상자·오늘+1 (디버그 API)
  s = await st(); const box2 = s.data.cards.find(c => c.box === 2 && c.type === 'memo');
  let mv = await page.evaluate(id => window.__app.actions.applyGrade(id, true, 3), box2.id); s = await st(); let c2 = s.data.cards.find(c => c.id === box2.id);
  expect(c2.box === 3 && c2.due === addDays(today, 4), `AC3 2상자 확실·맞음 → ${c2.box}상자 ${c2.due}`);
  await page.evaluate(id => window.__app.actions.applyGrade(id, false, 3), box2.id); s = await st(); c2 = s.data.cards.find(c => c.id === box2.id);
  expect(c2.box === 1 && c2.due === addDays(today, 1), `AC3 같은 카드 틀림 → ${c2.box}상자 ${c2.due}`);

  // AC6 Esc 종료 → 새로고침 → 이어서 하기
  await page.keyboard.press('Escape'); await sleep(300);
  await reload();
  const homeTxt = await text('#view-home');
  expect(/이어서 하기/.test(homeTxt) && /남은 \d+장/.test(homeTxt), 'AC6 새로고침 후 이어서 하기(남은 N장)');
  s = await st(); card = s.data.cards.find(c => c.id === cid); expect(card.box === toBox, 'AC6 처리한 카드의 상자 변경 유지');
  await page.click('[data-action="resume"]'); await sleep(300);

  // 남은 큐 진행(AC4·AC5)
  let reasonChecked = false, wrongCardId = null, guard = 0;
  while (guard++ < 30) {
    s = await st(); if (!s.session) break;
    cid = s.session.ids[s.session.idx]; card = s.data.cards.find(c => c.id === cid);
    await page.keyboard.press('3'); await page.keyboard.press(' '); await sleep(450);
    if (card.type === 'wrong' && !reasonChecked) {
      const before = s.session.results.length;
      await page.keyboard.press('ArrowLeft'); await sleep(100);
      expect(await page.locator('#reason-panel').isVisible(), 'AC4 오답 카드 틀림 → 원인 패널 표시');
      await page.keyboard.press('ArrowRight'); await sleep(100);
      const after = (await st()).session.results.length;
      expect(after === before, 'AC4 원인 선택 전에는 다음 카드로 넘어가지 않음');
      const newReason = card.reason === 'time' ? 'concept' : 'time';
      await page.click(`[data-action="pick-reason"][data-reason="${newReason}"]`); await sleep(150);
      const c3 = (await st()).data.cards.find(c => c.id === cid);
      expect(c3.reason === newReason, `AC4 원인 태그 갱신 ${card.reason}→${c3.reason}`);
      reasonChecked = true; wrongCardId = cid;
    } else await page.keyboard.press('ArrowRight');
    await sleep(550);
  }
  // 요약 모달
  await sleep(300);
  const quad = await page.$$eval('.quad-cell b', els => els.map(e => Number(e.textContent)));
  const qsum = quad.reduce((a, b) => a + b, 0);
  expect(quad.length === 4 && qsum === 11, `AC5 4분면 합 ${qsum} (= 11)`);
  const coach = await text('#coach-line'); expect(coach.length > 5, 'AC5 코칭 문장: ' + coach);
  await shot('summary');
  await page.fill('#reflect-in', '테스트'); await page.click('.modal-foot .btn-primary'); await sleep(300);
  await page.click('#tab-history'); await sleep(300);
  const firstReflect = await page.locator('#reflect-list .reflect-item q').first().innerText();
  expect(firstReflect === '테스트', 'AC5 되새김 맨 위 = 테스트 (실제: ' + firstReflect + ')');
  // AC4 카드 목록에서 원인 배지 확인
  if (wrongCardId) { await page.click('#tab-cards'); await page.click('[data-action="all-cards"]'); await sleep(200); const row = await page.locator(`.card-row[data-id="${wrongCardId}"]`).innerText(); log('wrong card row: ' + row.replace(/\n/g, ' ')); }

  // AC15 5상자 카드 확실·맞음 → 유지, +30, 숙달 ★
  s = await st(); const b5 = s.data.cards.find(c => c.box === 5 && !c.mastered);
  await page.evaluate(id => window.__app.actions.applyGrade(id, true, 3), b5.id); s = await st(); const b5a = s.data.cards.find(c => c.id === b5.id);
  expect(b5a.box === 5 && b5a.due === addDays(today, 30) && b5a.mastered === true, `AC15 5상자 → ${b5a.box}상자 ${b5a.due} mastered=${b5a.mastered}`);
  await page.click('#tab-home'); await page.click('[data-action="open-box"][data-box="5"]'); await sleep(200);
  const row5 = await page.locator(`.card-row[data-id="${b5.id}"]`).innerText(); expect(/숙달/.test(row5), 'AC15 카드 목록 ★ 숙달 배지');

  // AC7 새 덱 + CSV 10행(따옴표 안 쉼표 포함)
  await page.click('#tab-cards'); await page.click('[data-action="back-decks"]').catch(() => {}); await sleep(100);
  await page.click('[data-action="new-deck"]'); await sleep(200); await page.fill('#dk-name', 'CSV 테스트'); await page.click('.modal-foot .btn-primary'); await sleep(300);
  s = await st(); const newDeck = s.data.decks.find(d => d.name === 'CSV 테스트'); expect(!!newDeck, 'AC7 새 덱 생성');
  const box1Before = s.boxCounts[0];
  const csv = '앞면,뒷면,힌트\n' + Array.from({ length: 10 }, (_, i) => i === 3 ? '"쉼표, 포함 앞면",답3,힌트3' : `앞${i},답${i},힌트${i}`).join('\n');
  await page.evaluate(([t, d]) => { window.__app.actions.importCsvText(t, d); }, [csv, newDeck.id]); await sleep(600);
  const mt = await text('.modal-body'); expect(/총 10행/.test(mt), 'AC7 미리보기 총 10행: ' + mt.split('\n')[0]);
  await page.click('.modal-foot .btn-primary'); await sleep(400);
  s = await st(); const nd = s.data.cards.filter(c => c.deckId === newDeck.id);
  expect(nd.length === 10 && s.boxCounts[0] === box1Before + 10, `AC7 덱 카드 ${nd.length}장, 1상자 +${s.boxCounts[0] - box1Before}`);
  expect(nd.some(c => c.front === '쉼표, 포함 앞면'), 'AC7 쉼표 포함 앞면 보존');

  // AC8 하루 목표 5
  await page.click('#tab-settings'); await sleep(200); await page.fill('#goal-in', '5'); await page.click('[data-action="goal-save"]'); await sleep(200);
  await reload(); await page.click('#tab-settings'); await sleep(200);
  const gv = await page.inputValue('#goal-in'); await page.click('#tab-home'); await sleep(200);
  const h2 = await text('#view-home'); expect(gv === '5' && /\/5장/.test(h2), `AC8 목표 ${gv}, 홈 분모 5`);

  // AC10 시험 D-10, 영어 덱
  await page.click('#tab-exam'); await page.click('[data-action="new-exam"]'); await sleep(200);
  await page.fill('#ex-title', '영어 단어 시험'); await page.fill('#ex-date', addDays(today, 10));
  s = await st(); const en = s.data.decks.find(d => d.name === '영어 5학년 Unit 4 단어');
  await page.click(`[data-deck="${en.id}"]`); await page.click('.modal-foot .btn-primary'); await sleep(400);
  s = await st(); const ex = s.data.exams.find(e => e.title === '영어 단어 시험');
  const planSum = Object.values(ex.plan).reduce((a, b) => a + b, 0); const planDays = Object.keys(ex.plan).length;
  const enCards = s.data.cards.filter(c => c.deckId === en.id);
  expect(planSum >= 16, `AC10 계획 합 ${planSum} ≥ 16 (날짜 ${planDays}칸)`);
  expect(enCards.every(c => c.due <= addDays(today, 9)), 'AC10 영어 덱 모든 카드 due ≤ 시험 전날');
  await page.click('#tab-home'); const h3 = await text('#view-home');
  expect(/D-10/.test(h3), 'AC10 홈 배너 D-10 (가장 가까운 시험이 D-10)');
  await shot('home-after');

  // AC11 교사 모드 + 샘플 학급
  await page.click('#tab-settings'); await page.click('input[data-action="set-teacher"]'); await sleep(200);
  expect(!(await page.locator('#tab-teacher').isHidden()), 'AC11 교사 탭 표시');
  await page.click('#tab-teacher'); await page.click('[data-action="teacher-sample"]'); await sleep(400);
  const rows = await page.locator('#student-list tbody tr').count(); const p1 = await page.locator('#point-cards .point-card').first().innerText(); const focus = await text('#focus-list');
  expect(rows === 6, `AC11 학생 ${rows}명`);
  expect(p1.includes('분수의 덧셈과 뺄셈') && p1.includes('5명'), 'AC11 복습 포인트 1위: ' + p1.replace(/\n/g, ' ').slice(0, 80));
  const calcSec = focus.split('개념 부족형')[0]; expect(calcSec.includes('박서아') && calcSec.includes('한수아'), 'AC11 계산 실수형 박서아·한수아');
  await shot('teacher');
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(200); await shot('teacher-tabs-400');
  const tabsOv = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); expect(tabsOv <= 0, `탭 7개 400px 가로 스크롤 없음(초과 ${tabsOv}px)`);
  await page.setViewportSize({ width: 1280, height: 800 });

  // AC14 저장 불가: setItem 예외 → 배너 + 동작
  await page.addInitScript(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; });
  await reload();
  expect(!(await page.locator('#storage-banner').isHidden()), 'AC14 저장 불가 배너 표시');
  s = await st(); const anyCard = s.data.cards[0];
  mv = await page.evaluate(id => window.__app.actions.applyGrade(id, true, 2), anyCard.id);
  expect(mv && mv.from === anyCard.box, 'AC14 메모리 모드에서 채점 동작');
  await page.click('#tab-cards'); await page.click('[data-action="new-deck"]'); await sleep(200); await page.fill('#dk-name', '메모리덱'); await page.click('.modal-foot .btn-primary'); await sleep(300);
  s = await st(); expect(s.data.decks.some(d => d.name === '메모리덱'), 'AC14 메모리 모드에서 덱 추가 동작');
  await shot('storage-fail');
};
