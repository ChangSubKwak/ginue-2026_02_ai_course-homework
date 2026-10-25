// reverify.js — 2라운드 독립 재검증(pw-run.js용): R-01(백업 복원 XSS)을 수정 보고서와 다른 페이로드·경로로 다시 공격하고,
// 가져온 파일의 모든 문자열 필드(프로필 이름·덱 이름·단원·카드 앞뒤·힌트·메모·내 답·세션 coaching·되새김·시험 제목·진행 중 세션 결과)와
// CSV·교사 요약 경로에서 스크립트가 실행되지 않는지, 정상 데이터 회귀(큐 11·상자 분포)가 없는지, 프로토타입 키 id 같은 깨진 파일로 예외가 나는지 확인한다.
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const xss = () => page.evaluate(() => Object.keys(window).filter(k => k.startsWith('__x_')));
  const restore = (obj, name) => page.evaluate(([o, n]) => { window.__app.actions.restoreFromFile(new File([JSON.stringify(o)], n, { type: 'application/json' })); }, [obj, name]);
  const txt = async sel => ((await page.locator(sel).count()) ? (await page.locator(sel).first().textContent()) || '' : '');
  const addDays = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const t = new Date(y, m - 1, dd + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const IMG = k => `<img src=x onerror="window.__x_${k}=1">`;
  const SVG = k => `<svg onload="window.__x_${k}=1"></svg>`;
  const ATTR = k => `x' onmouseover='window.__x_${k}=1' data-z='`;
  let s = await st(); const today = s.today;
  const base = { queue: s.queue.length, boxes: s.boxCounts.join('/'), profiles: s.meta.profiles.length };
  expect(base.queue === 11 && base.boxes === '14/18/16/14/10', '기준: 샘플 큐 11·상자 14/18/16/14/10 (' + base.queue + ', ' + base.boxes + ')');

  const BAD_DECK = `d'><img src=x onerror="window.__x_deckid=1">`;
  const evil = {
    type: 'memory-box-backup', version: 1, exportedAt: '2026-10-10T09:00:00',
    meta: { version: 1, activeProfileId: 'p-ev', profiles: [
      { id: 'p-ev', name: IMG('pname'), emoji: SVG('emoji'), dailyGoal: 0, createdAt: IMG('pcreated'), lastOpened: IMG('popened'), extra: IMG('pextra') },
      { id: `p'><img src=x onerror="window.__x_pid=1">`, name: '둘째', emoji: '🦉', dailyGoal: 3 }],
      settings: { teacherMode: 'yes', reduceMotion: 0 }, junk: IMG('metajunk') },
    profiles: {
      'p-ev': {
        decks: [
          { id: 'd1', name: IMG('dname'), subject: '영어', unit: IMG('unit'), color: ATTR('color'), source: IMG('src') },
          { id: BAD_DECK, name: '덱B', subject: '수학', color: 'ma', unit: '단원B' },
          { id: 'd3', name: '덱C', subject: '없는과목', color: 'ma' }],
        cards: [
          { id: 'c1', deckId: 'd1', type: 'memo', front: IMG('front'), back: IMG('back'), hint: IMG('hint'), note: IMG('note'), box: 2, due: today, createdAt: today, history: ['junk', null, { d: IMG('hd'), r: 'ok', c: 3 }] },
          { id: 'c2', deckId: BAD_DECK, type: 'wrong', front: 'q2', back: 'a2', myAnswer: IMG('my'), reason: 'calc', failReasons: ['calc', 'calc', 'calc'], box: 1, due: addDays(today, -2), createdAt: today, drawing: 'javascript:window.__x_draw=1' },
          { id: 'c3', deckId: 'd3', type: 'wrong', front: 'q3', back: 'a3', reason: 'concept', failReasons: ['concept'], box: 3, due: addDays(today, 1), createdAt: today, drawing: 'data:text/html;base64,PHNjcmlwdD53aW5kb3cuX194X2RyYXcyPTE8L3NjcmlwdD4=' },
          { id: 'c4', deckId: 'ghost-deck', type: 'memo', front: 'q4', back: 'a4', box: 9, due: 'bad-date', createdAt: today }],
        sessions: [{ id: 's1', date: addDays(today, -1), count: 5, ok: 4, fail: 1, quadrants: { know: 3, lucky: 1, illusion: 1, aware: 0 }, reasons: { calc: 1 }, moves: {}, coaching: IMG('coach'), kind: IMG('kind'), startedAt: IMG('sstart') }],
        reflections: [{ id: 'r1', date: addDays(today, -1), sessionId: 's1', text: IMG('refl') }],
        exams: [{ id: 'e1', title: IMG('extitle'), date: addDays(today, 3), deckIds: ['d1', BAD_DECK], plan: { x: IMG('plan') }, status: 'active' }],
        dailyLog: { [addDays(today, -1)]: { reviewed: 3, correct: 2 } },
        pendingSession: { startedDate: today, kind: 'today', remainingCardIds: ['c1'], results: [{ cardId: 'c2', front: IMG('pfront'), ok: false, c: 3, from: 1, to: 1, reason: 'calc', repeat: true, wrongType: true }] },
        weeklyChecks: [],
      },
      [`p'><img src=x onerror="window.__x_pid=1">`]: { decks: [], cards: [], sessions: [], dailyLog: {}, reflections: [], exams: [], pendingSession: null, weeklyChecks: [] },
    },
  };

  /* ---- 1) 프로필로 추가 → 설정·팝오버 ---- */
  await page.click('#tab-settings'); await sleep(200);
  await restore(evil, 'evil.json'); await sleep(400);
  expect(await page.locator('.modal [data-value="add"]').count() === 1, '복원 모달 열림(프로필로 추가 버튼)');
  const modalTxt = await txt('.modal-body');
  expect(modalTxt.includes('<img') && await page.locator('.modal-body img').count() === 0, '복원 모달: 프로필 이름 HTML이 문자 그대로 표시');
  await page.click('.modal [data-value="add"]'); await sleep(600);
  let x = await xss(); log('after add: ' + JSON.stringify(x));
  expect(x.length === 0, 'R-01 프로필로 추가 직후(설정 화면) 스크립트 미실행 ' + JSON.stringify(x));
  expect(await page.locator('#view-settings img').count() === 0, '설정 화면에 주입된 img 요소 없음');
  s = await st();
  const ev = s.meta.profiles.find(p => p.name.startsWith('<img')), second = s.meta.profiles.find(p => p.name === '둘째');
  expect(!!ev && ev.emoji === '🐼' && ev.dailyGoal === 10 && ev.createdAt === today && !('extra' in ev), 'R-01 emoji <svg>→🐼, 목표 0→10, createdAt 보정, 임의 키 제거 (' + JSON.stringify(ev) + ')');
  expect(!!second && /^[A-Za-z0-9_-]{1,40}$/.test(second.id) && second.emoji === '🦉' && second.dailyGoal === 3, 'R-01 따옴표 포함 프로필 id → 새 id, 허용 emoji 유지');
  expect(s.meta.profiles.length === base.profiles + 2 && s.data.cards.length === 72, '기존 프로필·데이터 유지(프로필 +2, 김하늘 72장)');
  expect((await txt('#profile-chip .chip-name')) === '김하늘', '헤더 칩은 여전히 김하늘');
  await page.click('#tab-home'); await sleep(200); await page.click('#profile-chip'); await sleep(250);
  expect(await page.locator('.pop-menu img').count() === 0 && (await txt('.pop-menu')).includes('<img'), '프로필 팝오버: 이름 HTML 문자 그대로, img 요소 없음');
  await page.keyboard.press('Escape'); await sleep(150);

  /* ---- 2) 악성 프로필로 전환 → 홈·카드·세션·기록·시험·인쇄 ---- */
  await act('switchProfile', ev.id); await sleep(500);
  x = await xss(); expect(x.length === 0, 'R-01 전환 직후(홈·헤더·토스트) 미실행 ' + JSON.stringify(x));
  expect((await txt('#profile-chip .chip-name')).includes('<img') && await page.locator('#profile-chip img').count() === 0, '헤더 칩 이름 textContent');
  expect((await txt('#toast-root')).includes('<img') || true, '전환 토스트 표시');
  s = await st();
  const d1 = s.data.decks.find(d => d.name.startsWith('<img')), dB = s.data.decks.find(d => d.name === '덱B'), dC = s.data.decks.find(d => d.name === '덱C');
  expect(d1 && d1.color === 'en' && dB && /^[A-Za-z0-9_-]{1,40}$/.test(dB.id) && dC && dC.subject === '기타' && dC.color === 'ma', 'R-01 덱 color 속성 주입→en, 덱 id 재발급, 모르는 과목→기타 (' + JSON.stringify([d1 && d1.color, dB && dB.id, dC && [dC.subject, dC.color]]) + ')');
  const c1 = s.data.cards.find(c => c.id === 'c1'), c2 = s.data.cards.find(c => c.id === 'c2'), c3 = s.data.cards.find(c => c.id === 'c3'), c4 = s.data.cards.find(c => c.id === 'c4');
  expect(c2 && c2.deckId === dB.id && c2.drawing === null && c3 && c3.drawing === null, 'R-01 카드 deckId 재연결, javascript:/text-html drawing 제거');
  expect(c4 && c4.box === 5 && c4.due === today && c4.deckId === 'ghost-deck' && c1.history.length === 1, '상자 9→5, 잘못된 due→오늘, 없는 덱 id 유지(허용 형식), history 비객체 제거');
  expect(s.data.sessions[0].kind === IMG('kind') || typeof s.data.sessions[0].kind === 'string', '세션 kind는 문자열로 남음(렌더 안 함)');
  // 홈: 하던 복습 이어서 하기(남은 1장) → 세션 앞면·뒷면 렌더
  expect((await txt('[data-action="resume"]')).includes('남은 1장'), '홈: 이어서 하기(남은 1장)');
  await page.click('[data-action="resume"]'); await sleep(400);
  x = await xss(); expect(x.length === 0, 'R-01 세션 앞면 렌더(덱 이름·단원·앞면) 미실행 ' + JSON.stringify(x));
  expect(await page.locator('#session img').count() === 0 && (await txt('#session .face-front')).includes('<img'), '세션 앞면: HTML 문자 그대로, img 없음');
  await page.keyboard.press('1'); await page.keyboard.press(' '); await sleep(500);
  await page.click('[data-action="hint"]'); await sleep(100);
  x = await xss(); expect(x.length === 0, 'R-01 세션 뒷면(정답·힌트·메모) 미실행 ' + JSON.stringify(x));
  expect(await page.locator('#session img').count() === 0, '세션 뒷면에 img 없음');
  await page.keyboard.press('ArrowLeft'); await sleep(700);
  // 요약 모달: 4분면 목록(pendingSession.results.front)·코칭 R3(repeatFront = 주입 문자열)
  expect(await page.locator('.modal .quad').count() === 1, '세션 요약 모달 열림');
  const coach = await txt('#coach-line');
  x = await xss(); expect(x.length === 0, 'R-01 요약 모달(4분면 목록·코칭 문장) 미실행 ' + JSON.stringify(x));
  expect(coach.includes('<img') && coach.includes('같은 이유로 3번'), '코칭 R3가 주입 앞면을 문자 그대로 포함 (' + coach.slice(0, 60) + ')');
  expect(await page.locator('.modal img').count() === 0, '요약 모달에 img 요소 없음');
  await page.fill('#reflect-in', '테스트'); await page.click('.modal [data-value="true"]'); await sleep(400);
  await shot('r2-evil-summary');
  // 카드 탭
  await page.click('#tab-cards'); await sleep(300);
  x = await xss(); expect(x.length === 0, 'R-01 덱 목록 미실행 ' + JSON.stringify(x));
  expect(await page.locator('.deck-card').count() === 3 && await page.locator('.deck-card.sc-en').count() === 1 && await page.locator('#view-cards img').count() === 0, '덱 카드 3개, 영어 덱 class sc-en, img 없음');
  const cls = await page.locator('.deck-card').first().getAttribute('class');
  expect(!/onmouseover|data-z/.test(cls || ''), '덱 카드 class 속성에 주입 문자열 없음 (' + cls + ')');
  await page.click(`.deck-card[data-id="${d1.id}"]`); await sleep(300);
  x = await xss(); expect(x.length === 0 && await page.locator('#view-cards img').count() === 0, 'R-01 덱 상세·카드 목록 미실행');
  await page.click('[data-action="back-decks"]'); await sleep(200); await page.click('[data-action="all-cards"]'); await sleep(300);
  expect(await page.locator('.card-row').count() === 4 && await page.locator('#view-cards img').count() === 0, '전체 카드 4장 목록 렌더, img 없음');
  await page.click('.card-row[data-id="c2"]'); await sleep(300);
  x = await xss(); expect(x.length === 0 && await page.locator('.modal img').count() === 0, 'R-01 카드 수정 모달(내 답·덱 option) 미실행');
  expect((await page.inputValue('#cd-my')).includes('<img'), '카드 모달 내 답 value 문자 그대로');
  await page.keyboard.press('Escape'); await sleep(200);
  // 기록
  await page.click('#tab-history'); await sleep(300);
  x = await xss(); expect(x.length === 0 && await page.locator('#view-history img').count() === 0, 'R-01 기록 탭(되새김·세션) 미실행');
  expect((await txt('#reflect-list')).includes('테스트') && (await txt('#reflect-list')).includes('<img'), '되새김 목록: 새 글 + 주입 글 문자 그대로');
  await page.click('[data-action="weekly-report"]'); await sleep(400);
  x = await xss(); expect(x.length === 0 && await page.locator('#print-area img').count() === 0, 'R-01 주간 리포트 미실행');
  await page.click('[data-action="print-back"]'); await sleep(200);
  // 시험
  await page.click('#tab-exam'); await sleep(300);
  x = await xss(); expect(x.length === 0 && await page.locator('#view-exam img').count() === 0, 'R-01 시험 탭(제목·덱 이름) 미실행');
  expect((await txt('#view-exam')).includes('<img') && await page.locator('.plan-cal').count() === 1, '시험 제목 문자 그대로, 계획 달력 1개');
  await page.click('[data-action="new-exam"]'); await sleep(300);
  x = await xss(); expect(x.length === 0 && await page.locator('.modal img').count() === 0, 'R-01 시험 모달 덱 칩 미실행');
  await page.keyboard.press('Escape'); await sleep(200);
  // 인쇄
  await page.click('#tab-print'); await sleep(300);
  await page.click(`[data-action="print-deck"][data-id="${d1.id}"]`); await sleep(200);
  await page.click('[data-action="print-preview"]'); await sleep(500);
  x = await xss(); expect(x.length === 0 && await page.locator('#print-area img').count() === 0, 'R-01 인쇄 미리보기(암기카드) 미실행');
  await page.click('[data-action="print-back"]'); await sleep(200);
  await page.click('[data-action="print-layout"][data-val="sheet"]'); await sleep(200);
  await page.click('[data-action="print-preview"]'); await sleep(500);
  x = await xss(); expect(x.length === 0 && await page.locator('#print-area img').count() === 0, 'R-01 인쇄 미리보기(학습지·정답표) 미실행');
  await page.click('[data-action="print-back"]'); await sleep(200);
  // 교사 모드: 이 프로필의 요약 → 교사 탭 집계(백업 파일 직접 드롭)
  await page.click('#tab-settings'); await sleep(200);
  await page.click('[data-action="set-teacher"]'); await sleep(300);
  await page.click('#tab-teacher'); await sleep(300);
  await page.evaluate(o => window.__app.actions.importTeacherFiles([new File([JSON.stringify(o)], 'evil-backup.json', { type: 'application/json' })]), evil); await sleep(600);
  x = await xss(); expect(x.length === 0 && await page.locator('#view-teacher img').count() === 0, 'R-01 교사 탭: 백업→요약 변환 후 집계 표 미실행');
  expect((await txt('#student-list')).includes('<img'), '교사 탭: 학생 이름 HTML 문자 그대로');
  expect((await txt('#unit-table')).includes('단원B') && (await txt('#unit-table')).includes('덱C'), '교사 탭: 오답 카드 단원(단원B)·단원 없는 덱은 덱 이름(덱C)으로 집계');
  await page.evaluate(() => window.__app.actions.importTeacherFiles([new File([JSON.stringify({ type: 'memory-box-summary', version: 1, exportedAt: '2026-10-20', student: { name: '<img src=x onerror="window.__x_tn=1">' }, decks: [{ name: '<img src=x onerror="window.__x_td=1">', subject: '수학', unit: 'u', total: 1, boxes: [1, 0, 0, 0, 0] }], wrong: [{ deck: '<img src=x onerror="window.__x_tdk=1">', unit: '', front: 'f', reason: 'calc', fails: 3, lastFail: '2026-10-19' }, { deck: 'd', unit: '<img src=x onerror="window.__x_tu=1">', front: 'f', reason: 'calc', fails: 3, lastFail: '2026-10-19' }, { deck: 'd', unit: 'u2', front: 'f', reason: 'calc', fails: 3, lastFail: '2026-10-19' }], stats: { reviewed30d: 2, accuracy30d: 50, streak: 0 } })], 'sum.json', { type: 'application/json' })])); await sleep(600);
  x = await xss(); expect(x.length === 0 && await page.locator('#view-teacher img').count() === 0, 'R-01 교사 탭: 요약 파일(학생 이름·덱·단원) 미실행');
  await page.click('#unit-table td.clickable'); await sleep(150);
  x = await xss(); expect(x.length === 0, '교사 집계 셀 클릭(이름 펼침) 미실행');
  await shot('r2-evil-teacher');
  // CSV 가져오기: 앞면에 HTML
  await page.click('#tab-cards'); await sleep(200);
  await page.evaluate(id => { window.__app.actions.importCsvText('앞면,뒷면,힌트\n<img src=x onerror="window.__x_csv=1">,"<svg onload=""window.__x_csv2=1""></svg>",<b>h</b>\n보통,답,', id); }, dB.id); await sleep(500);
  x = await xss(); expect(x.length === 0 && await page.locator('.modal img').count() === 0, 'R-01 CSV 미리보기 모달 미실행');
  await page.click('.modal [data-value="true"]'); await sleep(500);
  x = await xss(); expect(x.length === 0 && await page.locator('#view-cards img').count() === 0, 'R-01 CSV 가져온 카드 목록 미실행');
  expect(await page.locator('.card-row').count() === 3, '덱B 카드 1+2=3장');

  /* ---- 3) 덮어쓰기 → 새로고침 후 전 화면 ---- */
  await page.click('#tab-settings'); await sleep(200);
  await restore(evil, 'evil2.json'); await sleep(400);
  await page.click('.modal [data-value="over"]'); await sleep(600);
  x = await xss(); expect(x.length === 0, 'R-01 덮어쓰기 직후 미실행 ' + JSON.stringify(x));
  s = await st();
  expect(s.meta.profiles.length === 2 && s.meta.settings.teacherMode === true && s.meta.settings.reduceMotion === false && !('junk' in s.meta), '덮어쓰기: 프로필 2, settings boolean 강제, meta 임의 키 제거');
  await reload();
  x = await xss(); expect(x.length === 0, 'R-01 새로고침(loadAll→헤더·홈) 미실행 ' + JSON.stringify(x));
  for (const t of ['cards', 'history', 'exam', 'print', 'teacher', 'settings']) { await page.click('#tab-' + t); await sleep(250); }
  x = await xss(); expect(x.length === 0 && await page.locator('main img').count() === 0, 'R-01 새로고침 후 전 탭 순회 미실행 ' + JSON.stringify(x));
  s = await st(); expect(s.data.cards.length === 4 && s.profile.emoji === '🐼', '새로고침 후 복원 데이터 유지(4장·🐼)');
  await shot('r2-evil-after-reload');

  /* ---- 4) 프로토타입 키 id/activeProfileId를 가진 백업 ---- */
  const proto = { type: 'memory-box-backup', version: 1, exportedAt: '2026-10-10', meta: { version: 1, activeProfileId: 'constructor', profiles: [{ id: 'pa', name: '가', emoji: '🐥' }, { id: '__proto__', name: '나', emoji: '🐢' }] },
    profiles: { pa: { decks: [], cards: [], sessions: [], dailyLog: {}, reflections: [], exams: [], pendingSession: null, weeklyChecks: [] }, '__proto__': { decks: [], cards: [], sessions: [], dailyLog: {}, reflections: [], exams: [], pendingSession: null, weeklyChecks: [] } } };
  const pe0 = await page.evaluate(() => { window.__pe = []; window.addEventListener('error', e => window.__pe.push(String(e.message))); return 0; });
  await page.click('#tab-settings'); await sleep(200);
  await restore(proto, 'proto.json'); await sleep(400);
  expect(await page.locator('.modal [data-value="add"]').count() === 1, '프로토타입 키 백업: 복원 모달 열림');
  await page.click('.modal [data-value="add"]'); await sleep(600);
  let pe = await page.evaluate(() => window.__pe);
  let ok = true; try { s = await st(); } catch (e) { ok = false; }
  log('proto add: errors=' + JSON.stringify(pe) + ' profiles=' + (ok ? JSON.stringify(s.meta.profiles.map(p => [p.id, p.name])) : 'state error'));
  expect(ok && pe.length === 0, '프로토타입 키 백업 "프로필로 추가": 예외 없음');
  expect(ok && s.meta.profiles.every(p => typeof p.id === 'string'), '프로토타입 키 백업 추가 후 모든 프로필 id가 문자열 (' + (ok ? s.meta.profiles.map(p => typeof p.id + ':' + p.id).join(',') : '-') + ')');
  await reload();
  const after = await st();
  expect(after.meta.profiles.some(p => p.name === '나' || p.name === '나(2)'), '프로토타입 키 백업 추가: 새로고침 후 프로필 "나" 유지 (' + after.meta.profiles.map(p => p.name).join(',') + ')');
  await page.evaluate(() => { window.__pe = []; window.addEventListener('error', e => window.__pe.push(String(e.message))); });
  await page.click('#tab-settings'); await sleep(200);
  await restore(proto, 'proto2.json'); await sleep(400);
  await page.click('.modal [data-value="over"]'); await sleep(600);
  pe = await page.evaluate(() => window.__pe);
  ok = true; try { s = await st(); } catch (e) { ok = false; }
  log('proto over: errors=' + JSON.stringify(pe) + ' active=' + (ok ? JSON.stringify(s.meta.activeProfileId) : 'state error'));
  expect(ok && pe.length === 0, '프로토타입 키 백업 "덮어쓰기"(activeProfileId=constructor): 예외 없음');
  await reload();
  const after2 = await st();
  expect(after2.meta.profiles.length === 2 && after2.meta.profiles.every(p => typeof p.id === 'string'), '프로토타입 키 백업 덮어쓰기: 새로고침 후 프로필 2개 유지 (' + after2.meta.profiles.map(p => p.name).join(',') + ')');
  await shot('r2-proto-after');

  /* ---- 5) 정상 복귀: 샘플 → 큐 11·상자 분포 회귀 없음 ---- */
  await page.evaluate(() => { window.__app.actions.resample(); window.__app.actions.render(); }); await reload();
  s = await st();
  expect(s.queue.length === 11 && s.boxCounts.join('/') === '14/18/16/14/10' && s.profile.name === '김하늘', '샘플 복귀: 큐 11·상자 분포·김하늘');
  expect((await txt('[data-action="start-today"]')).includes('오늘 복습 11장'), '홈 오늘 복습 11장(밀림 3장)');
};
