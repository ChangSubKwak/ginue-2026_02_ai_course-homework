// fix-r2-xss.js — 2라운드 회귀 모듈(pw-run.js용): 백업 JSON의 프로필 emoji·덱 color·id·일일 기록·세션 통계·진행 중 세션 값으로
// 스크립트가 실행되지 않고(R-01), 형식이 어긋난 id는 새 id로 바뀌며 참조(카드 deckId·시험 deckIds·pendingSession)가 유지되는지 확인한다.
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const xss = () => page.evaluate(() => ({ emoji: window.__xssEmoji, color: window.__xssColor, id: window.__xssId, log: window.__xssLog, sess: window.__xssSess, pend: window.__xssPend, pid: window.__xssPid, ex: window.__xssEx }));
  // restoreFromFile은 모달이 닫힐 때까지 끝나지 않으므로 반환값을 기다리지 않는다(기다리면 교착)
  const restore = (obj, name) => page.evaluate(([o, n]) => { window.__app.actions.restoreFromFile(new File([JSON.stringify(o)], n, { type: 'application/json' })); }, [obj, name]);
  let s = await st(); const today = s.today;
  const addDays = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const t = new Date(y, m - 1, dd + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const IMG = k => `<img src=x onerror="window.__xss${k}=1">`;
  const BAD_ID = `d2"><img src=x onerror="window.__xssId=1"><i x="`;
  const evil = {
    type: 'memory-box-backup', version: 1, exportedAt: '2026-10-02T10:00:00',
    meta: { version: 1, activeProfileId: 'p-evil', profiles: [{ id: 'p-evil', name: '친구백업', emoji: IMG('Emoji'), dailyGoal: 999 }, { id: `p-x"><img src=x onerror="window.__xssPid=1"><i x="`, name: '둘째', emoji: '🦊', dailyGoal: 5 }] },
    profiles: {
      'p-evil': {
        decks: [{ id: 'd-evil', name: '덱', subject: '수학', color: `x"><img src=x onerror="window.__xssColor=1"><i class="` }, { id: BAD_ID, name: '덱2', subject: '국어' }],
        cards: [
          { id: 'c1', deckId: 'd-evil', type: 'memo', front: 'f1', back: 'b1', box: 1, due: today, createdAt: today },
          { id: `c-bad"><img src=x onerror="window.__xssId=1">`, deckId: BAD_ID, type: 'wrong', front: 'f2', back: 'b2', myAnswer: 'x', reason: 'calc', failReasons: ['calc', '<b>'], box: 7, due: addDays(today, -1), createdAt: today },
          { id: 'c3', deckId: BAD_ID, type: 'memo', front: 'f3', back: 'b3', box: 2, due: addDays(today, 3), createdAt: today },
        ],
        sessions: [{ id: 's1', date: addDays(today, -1), count: IMG('Sess'), ok: '<b>x</b>', fail: 1, quadrants: { know: '1' }, reasons: {}, moves: {} }],
        dailyLog: { [addDays(today, -1)]: { reviewed: IMG('Log'), correct: 2 }, [today]: { reviewed: '3', correct: '1' }, 'not-a-date': { reviewed: 99, correct: 1 } },
        reflections: [{ id: 'r1', date: addDays(today, -1), sessionId: 's1', text: '되새김' }],
        exams: [{ id: `e"><img src=x onerror="window.__xssEx=1">`, title: '시험', date: addDays(today, 5), deckIds: [BAD_ID, 'd-evil', 'ghost'], plan: {}, status: 'active' }],
        pendingSession: { startedDate: today, kind: 'today', remainingCardIds: ['c3', `c-bad"><img src=x onerror="window.__xssId=1">`, 'nope'], results: [{ cardId: 'c1', front: IMG('Pend'), ok: true, c: 3, from: 1, to: 2 }, 'junk'] },
        weeklyChecks: ['2026-40', 7],
      },
      [`p-x"><img src=x onerror="window.__xssPid=1"><i x="`]: { decks: [], cards: [], sessions: [], dailyLog: {}, reflections: [], exams: [], pendingSession: null, weeklyChecks: [] },
    },
  };

  /* ---- 1) '프로필로 추가' ---- */
  await page.click('#tab-settings'); await sleep(200);
  await restore(evil, 'evil.json'); await sleep(400);
  expect(await page.locator('.modal [data-value="add"]').count() === 1, '복원 모달(프로필로 추가) 표시');
  await page.click('.modal [data-value="add"]'); await sleep(600);
  let x = await xss(); log('after add + settings render: ' + JSON.stringify(x));
  expect(!x.emoji && !x.pid, 'R-01 설정 화면: 프로필 emoji·id의 HTML 미실행');
  s = await st();
  const evilP = s.meta.profiles.find(p => p.name.startsWith('친구백업')), second = s.meta.profiles.find(p => p.name.startsWith('둘째'));
  expect(!!evilP && evilP.emoji === '🐼' && evilP.dailyGoal === 50, 'R-01 emoji는 기본값 🐼, 목표 999→50 보정 (' + JSON.stringify(evilP && [evilP.emoji, evilP.dailyGoal]) + ')');
  expect(!!second && /^[A-Za-z0-9_-]{1,40}$/.test(second.id) && second.emoji === '🦊', 'R-01 형식 어긋난 프로필 id는 새 id로 교체, 허용 emoji는 유지 (' + (second && second.id) + ')');
  expect(s.meta.profiles.every(p => /^[A-Za-z0-9_-]{1,40}$/.test(p.id)), '모든 프로필 id가 허용 형식');
  await page.click('#tab-home'); await sleep(200); await page.click('#profile-chip'); await sleep(250);
  x = await xss(); expect(!x.emoji && !x.pid, 'R-01 프로필 팝오버: emoji·id의 HTML 미실행');
  expect(await page.locator('.pop-menu [role="menuitem"]:has-text("친구백업")').count() === 1, '팝오버에 추가된 프로필 표시');
  await page.keyboard.press('Escape'); await sleep(150);

  /* ---- 2) 추가된 프로필로 전환 → 카드·시험·기록·홈 렌더 ---- */
  await act('switchProfile', evilP.id); await sleep(400);
  s = await st();
  const decks = s.data.decks, cards = s.data.cards, bad = decks.find(d => d.name === '덱2'), good = decks.find(d => d.name === '덱');
  expect(decks.length === 2 && decks.every(d => /^[A-Za-z0-9_-]{1,40}$/.test(d.id)), 'R-01 덱 id 2개 모두 허용 형식 (' + decks.map(d => d.id).join(',') + ')');
  expect(good && good.color === 'ma' && bad && bad.color === 'ko', 'R-01 덱 color는 과목 색 키로 보정 (' + (good && good.color) + ',' + (bad && bad.color) + ')');
  expect(cards.length === 3 && cards.every(c => /^[A-Za-z0-9_-]{1,40}$/.test(c.id)), 'R-01 카드 id 3개 모두 허용 형식');
  expect(cards.filter(c => c.deckId === bad.id).length === 2 && cards.find(c => c.front === 'f1').deckId === good.id, 'R-01 새 덱 id로 카드 deckId 재연결 (덱2: ' + cards.filter(c => c.deckId === bad.id).length + '장)');
  const c2 = cards.find(c => c.front === 'f2');
  expect(c2.box === 5 && c2.failReasons.join() === 'calc' && c2.reason === 'calc', 'R-01 상자 7→5, failReasons 허용 키만 (' + c2.box + ',' + c2.failReasons.join('|') + ')');
  const ex = s.data.exams[0];
  expect(!!ex && /^[A-Za-z0-9_-]{1,40}$/.test(ex.id) && ex.deckIds.length === 3 && ex.deckIds.includes(bad.id) && ex.deckIds.includes(good.id) && ex.deckIds.includes('ghost'), 'R-01 시험 id 교체·deckIds 재연결 (' + (ex && ex.deckIds.join(',')) + ')');
  expect(s.data.dailyLog[addDays(today, -1)].reviewed === 0 && s.data.dailyLog[today].reviewed === 3 && !('not-a-date' in s.data.dailyLog), 'R-01 dailyLog 숫자 강제·날짜 아닌 키 제거');
  expect(s.data.sessions[0].count === 0 && s.data.sessions[0].ok === 0 && s.data.sessions[0].quadrants.know === 1, 'R-01 세션 count/ok/quadrants 숫자 강제');
  const pend = s.data.pendingSession;
  expect(!!pend && pend.remainingCardIds.length === 2 && pend.remainingCardIds.includes(c2.id) && pend.results.length === 1 && pend.results[0].front.startsWith('<img'), 'R-01 pendingSession: 남은 카드 id 재연결(2장)·결과 1건(문자열) (' + JSON.stringify(pend && [pend.remainingCardIds.length, pend.results.length]) + ')');
  expect(s.data.weeklyChecks.join() === '2026-40', 'R-01 weeklyChecks 문자열만');
  await page.click('#tab-cards'); await sleep(300);
  x = await xss(); expect(!x.color && !x.id, 'R-01 덱 목록: 덱 color·id의 HTML 미실행');
  expect(await page.locator('.deck-card.sc-ko').count() === 1 && await page.locator('.deck-card.sc-ma').count() === 1, '덱 카드 class가 sc-ko/sc-ma');
  await page.click(`.deck-card[data-id="${bad.id}"]`); await sleep(300);
  expect(await page.locator('.card-row').count() === 2, '덱2 상세에 카드 2장');
  x = await xss(); expect(!x.id, 'R-01 카드 목록: 카드 id의 HTML 미실행');
  await page.click('#tab-exam'); await sleep(300);
  x = await xss(); expect(!x.ex, 'R-01 시험 탭: 시험 id의 HTML 미실행');
  expect(await page.locator('.plan-cal').count() === 1, '시험 계획 달력 렌더');
  await page.click('#tab-history'); await sleep(300);
  x = await xss(); expect(!x.log && !x.sess, 'R-01 기록 탭: dailyLog·세션 통계의 HTML 미실행');
  await page.click('[data-action="weekly-report"]'); await sleep(400);
  x = await xss(); expect(!x.log, 'R-01 주간 리포트: dailyLog 값의 HTML 미실행');
  expect(await page.locator('#print-view:not([hidden])').count() === 1, '주간 리포트 미리보기 열림');
  await page.click('[data-action="print-back"]'); await sleep(200);
  await page.click('#tab-home'); await sleep(300);
  expect((await page.locator('[data-action="resume"]').textContent() || '').includes('남은 2장'), '홈: 이어서 하기 (남은 2장)');
  await page.click('[data-action="resume"]'); await sleep(400);
  expect((await page.locator('#session .session-top .num').textContent() || '').replace(/\s+/g, '') === '2/3', '이어서 하기 진행 2/3 (done 1 + 남은 2)');
  await page.keyboard.press('Escape'); await sleep(200);
  x = await xss(); expect(!x.pend, 'R-01 세션: pendingSession 결과의 HTML 미실행');
  await shot('r2-add-evil');

  /* ---- 3) '덮어쓰기' ---- */
  await page.click('#tab-settings'); await sleep(200);
  await restore(evil, 'evil2.json'); await sleep(400);
  await page.click('.modal [data-value="over"]'); await sleep(600);
  s = await st();
  expect(s.meta.profiles.length === 2 && s.meta.profiles.every(p => /^[A-Za-z0-9_-]{1,40}$/.test(p.id)), '덮어쓰기: 프로필 2개·id 허용 형식 (' + s.meta.profiles.map(p => p.id).join(',') + ')');
  expect(s.meta.activeProfileId === 'p-evil' && s.data.cards.length === 3, '덮어쓰기: 활성 프로필 p-evil·카드 3장');
  expect(s.meta.settings.teacherMode === false && s.meta.settings.reduceMotion === false && Object.keys(s.meta).sort().join() === 'activeProfileId,intervals,profiles,settings,version', '덮어쓰기: meta는 정해진 키만 (' + Object.keys(s.meta).sort().join() + ')');
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('edu.memory-box.v1.profile.')));
  expect(keys.length === 2 && keys.every(k => /^edu\.memory-box\.v1\.profile\.[A-Za-z0-9_-]{1,40}$/.test(k)), '덮어쓰기: 저장 키 2개, 옛 키 삭제 (' + keys.join(',') + ')');
  await reload();
  x = await xss(); expect(!x.emoji && !x.pid && !x.color && !x.id, '새로고침 후 홈·헤더 렌더에서 HTML 미실행');
  s = await st(); expect(s.profile.name === '친구백업' && s.profile.emoji === '🐼' && s.data.cards.length === 3, '새로고침 후 복원 데이터 유지');
  await page.click('#tab-settings'); await sleep(300);
  x = await xss(); expect(!x.emoji && !x.pid, '새로고침 후 설정 화면 HTML 미실행');
  await shot('r2-over-evil');

  /* ---- 4) 정상 백업 왕복: 샘플 → 백업 구조 → 덮어쓰기 → 72장·상자 분포 그대로 ---- */
  await page.evaluate(() => { window.__app.actions.resample(); window.__app.actions.render(); }); await reload();
  s = await st();
  const backup = { type: 'memory-box-backup', version: 1, exportedAt: new Date().toISOString(), meta: s.meta, profiles: {} };
  backup.profiles[s.meta.activeProfileId] = s.data;
  const other = s.meta.profiles.find(p => p.id !== s.meta.activeProfileId);
  backup.profiles[other.id] = await page.evaluate((id) => JSON.parse(localStorage.getItem('edu.memory-box.v1.profile.' + id)), other.id);
  await page.click('#tab-settings'); await sleep(200);
  await restore(backup, 'ok.json'); await sleep(400);
  await page.click('.modal [data-value="over"]'); await sleep(600);
  const s2 = await st();
  expect(s2.data.cards.length === 72 && s2.boxCounts.join() === s.boxCounts.join() && s2.data.decks.length === 5 && s2.queue.length === 11, '정상 백업 덮어쓰기: 72장·상자 분포·덱 5·큐 11 유지 (' + s2.boxCounts.join('/') + ', 큐 ' + s2.queue.length + ')');
  expect(s2.data.exams[0].deckIds.length === 1 && s2.data.exams[0].deckIds[0] === s2.data.decks[4].id, '정상 백업: 시험 deckIds 유지');
  expect(s2.meta.profiles.map(p => p.id).join() === s.meta.profiles.map(p => p.id).join() && s2.profile.emoji === '🐳', '정상 백업: 프로필 id·이모지 유지');
  await page.click('#tab-home'); await sleep(200);
  expect((await page.locator('[data-action="start-today"]').textContent() || '').includes('오늘 복습 11장'), '정상 백업 후 홈 오늘 복습 11장');

  // 샘플로 되돌리기
  await page.evaluate(() => { window.__app.actions.resample(); window.__app.actions.render(); }); await reload();
};
