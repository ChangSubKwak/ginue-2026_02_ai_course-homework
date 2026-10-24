// reverify.js — 1라운드 수정(critical·major) 독립 재검증 모듈 (pw-run.js용). 수정 보고서 주장을 소스·브라우저로 직접 확인하고 회귀·잔여 취약점을 찾는다
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const txt = async sel => (await page.locator(sel).first().textContent()) || '';
  const st = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  const skipSummary = async () => { await sleep(700); if (await page.locator('.modal [data-value="skip"]').count()) { await page.click('.modal [data-value="skip"]'); await sleep(300); } };
  const esc = async () => { await page.keyboard.press('Escape'); await sleep(200); };
  const hscroll = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  // WCAG 대비 계산
  const contrast = (sel) => page.evaluate((sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const cs = getComputedStyle(el);
    const parse = s => { const m = s.match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); };
    let bg = parse(cs.backgroundColor); let e = el; let bgc = cs.backgroundColor;
    while (e && /rgba?\(0, 0, 0, 0\)|transparent/.test(bgc)) { e = e.parentElement; if (!e) break; bgc = getComputedStyle(e).backgroundColor; }
    if (e) bg = parse(bgc);
    const fg = parse(cs.color);
    const lum = c => { const a = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
    const l1 = lum(fg), l2 = lum(bg); const r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { ratio: Math.round(r * 100) / 100, fg: cs.color, bg: bgc, size: cs.fontSize, weight: cs.fontWeight };
  }, sel);
  let s = await st(); const today = s.today;

  /* ---- F-04 / M-01: 오늘 큐 정렬(밀린 카드 먼저, 밀린 일수 내림차순) ---- */
  const qDue = s.queue.map(id => s.data.cards.find(c => c.id === id).due);
  const late = qDue.filter(d => d < today);
  expect(late.length === 3 && qDue.slice(0, 3).every(d => d < today), 'F-04 큐 앞 3장이 밀린 카드: ' + qDue.slice(0, 4).join(','));
  expect(qDue.slice(0, 3).join(',') === late.slice().sort().join(','), 'F-04 밀린 일수 내림차순(가장 오래 밀린 카드 먼저): ' + qDue.slice(0, 3).join(','));
  const boxesOfToday = s.queue.slice(3).map(id => s.data.cards.find(c => c.id === id).box);
  expect(boxesOfToday.every((b, i, a) => i === 0 || a[i - 1] <= b), 'F-04 오늘 카드는 상자 오름차순: ' + boxesOfToday.join(','));

  /* ---- F-05: 진행 표시 ---- */
  await page.click('[data-action="start-today"]'); await sleep(300);
  const prog = async () => (await txt('#session .session-top .num')).replace(/\s+/g, '');
  const barW = async () => page.evaluate(() => document.querySelector('#session .progress i').style.width);
  expect((await prog()) === '1/11', 'F-05 시작 진행 1/11 (실제 ' + (await prog()) + ')');
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(150); await page.click('#grade-btns [data-ok="1"]'); await sleep(600);
  expect((await prog()) === '2/11', 'F-05 1장 처리 후 2/11 (실제 ' + (await prog()) + ', 바 ' + (await barW()) + ')');
  await page.click('#conf-btns [data-c="2"]'); await page.click('#flip-btn'); await sleep(150); await page.click('#grade-btns [data-ok="1"]'); await sleep(600);
  expect((await prog()) === '3/11', 'F-05 2장 처리 후 3/11 (실제 ' + (await prog()) + ')');
  await esc(); await reload();
  await page.click('[data-action="resume"]'); await sleep(300);
  expect((await prog()) === '3/11', 'F-05 이어서 하기 진행 3/11 (실제 ' + (await prog()) + ')');
  await esc();

  /* ---- F-16 / m-05: 하던 복습이 남아 있으면 새 복습 전 확인 ---- */
  await page.click('#tab-home'); await sleep(150);
  const pend = (await st()).data.pendingSession;
  expect(!!pend && pend.results.length === 2, 'F-16 사전 조건: pendingSession 결과 2장 (실제 ' + (pend && pend.results.length) + ')');
  s = await st(); const dk = s.data.decks[0];
  await page.evaluate((id) => { document.querySelector('#tab-cards').click(); }, dk.id); await sleep(200);
  await page.click(`.deck-card[data-id="${dk.id}"]`); await sleep(200);
  await page.click('[data-action="start-deck"]'); await sleep(300);
  expect(await page.locator('.modal:has-text("하던 복습이 남아 있어요")').count() === 1, 'F-16 덱 복습 전 확인 모달');
  await shot('r-f16-confirm');
  await page.click('.modal [data-value="false"]'); await sleep(200);
  expect(await page.locator('#session').isHidden(), 'F-16 취소 시 세션 미시작');


  /* ---- F-06 / M-02: 애니메이션 중 입력 잠금 ---- */
  s = await st(); const two = s.data.cards.filter(c => c.type === 'memo' && !s.queue.includes(c.id)).slice(0, 2).map(c => c.id); const hBefore6 = two.map(id => (s.data.cards.find(c => c.id === id).history || []).length);
  await act('startSession', 'deck', two); await sleep(300);
  const firstFront = await txt('#flip-card .face-front .face-text');
  await page.keyboard.press('3'); await page.keyboard.press('Space'); await sleep(120);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); await sleep(100);
  let ss = (await st()).session;
  expect(ss && ss.results.length === 1 && ss.idx === 1, 'F-06 빠른 →→← 직후 채점 1장만 (results ' + (ss && ss.results.length) + ', idx ' + (ss && ss.idx) + ')');
  await sleep(600);
  ss = (await st()).session;
  const secondFront = await txt('#flip-card .face-front .face-text');
  expect(ss && ss.results.length === 1 && secondFront !== firstFront && !ss.busy, 'F-06 애니메이션 뒤 2번째 카드가 미채점 상태로 표시(busy 해제)');
  // 스와이프도 busy 중 무시되는지: 2번째 카드 채점 직후 즉시 스와이프
  await page.keyboard.press('2'); await page.keyboard.press('Space'); await sleep(120); await page.keyboard.press('ArrowRight');
  const box = await page.locator('#flip-wrap').boundingBox();
  if (box) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2, { steps: 3 }); await page.mouse.up(); }
  await sleep(900);
  s = await st();
  const hAfter6 = two.map(id => (s.data.cards.find(c => c.id === id).history || []).length); expect(!s.session && hAfter6.every((n, i) => n === hBefore6[i] + 1), 'F-06 마지막 카드 채점 후 연타·스와이프로 중복 history 없음 ' + JSON.stringify([hBefore6, hAfter6]));
  await skipSummary();
  // 1장 세션에서 마지막 카드 →→ 연타 시 예외 없음(pageErrors는 러너가 수집)
  await act('startSession', 'deck', [two[0]]); await sleep(300);
  await page.keyboard.press('1'); await page.keyboard.press('Space'); await sleep(120); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await sleep(900);
  await skipSummary();
  expect(!(await st()).session, 'F-06 1장 세션 연타 후 정상 종료');

  /* ---- F-14: 카드 탭 재클릭 → 덱 목록 ---- */
  await page.click('#tab-cards'); await sleep(200);
  expect(await page.locator('.deck-card').count() >= 5 && !(await page.locator('[data-action="back-decks"]').count()), 'F-14 카드 탭 클릭 시 덱 목록으로');

  /* ---- F-07 ~ F-10, U-07, U-08 등: 되새김 역순 ---- */
  await page.click('#tab-history'); await sleep(300);
  const dates = await page.$$eval('#reflect-list .reflect-item .small', els => els.map(e => e.textContent.slice(0, 10)));
  expect(dates.length >= 5 && dates.every((d, i, a) => i === 0 || a[i - 1] >= d), 'U-07/F-10 되새김 날짜 역순: ' + dates.join(' '));
  await shot('r-history');

  /* ---- U-08: 4분면 펼침 시 옆 칸 정렬 ---- */
  s = await st(); const three = s.data.cards.filter(c => c.type === 'memo' && !two.includes(c.id)).slice(0, 3).map(c => c.id);
  await act('startSession', 'deck', three); await sleep(300);
  for (let i = 0; i < 3; i++) { await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(150); await page.click(`#grade-btns [data-ok="${i < 2 ? 1 : 0}"]`); await sleep(150); if (await page.locator('#reason-panel:not([hidden])').count()) await page.click('#reason-panel [data-reason="calc"]'); await sleep(600); }
  await sleep(500);
  expect(await page.locator('.modal .quad').count() === 1, 'U-08 요약 모달 4분면 표시');
  const hBefore = await page.$$eval('.quad-cell', els => els.map(e => e.getBoundingClientRect().height));
  await page.click('.quad-cell.quad-know'); await sleep(200);
  const geo = await page.$$eval('.quad-cell', els => els.map(e => { const r = e.getBoundingClientRect(); const b = e.querySelector('b').getBoundingClientRect(); return { h: r.height, bTop: b.top - r.top }; }));
  expect(geo[0].h > hBefore[0] && geo.slice(1).every((g, i) => Math.abs(g.h - hBefore[i + 1]) < 2 && g.bTop < 24), 'U-08 펼친 칸만 길어지고 옆 칸 숫자는 위에 고정: ' + JSON.stringify(geo.map(g => [Math.round(g.h), Math.round(g.bTop)])));
  await shot('r-u08-quad-expanded');
  await page.click('.modal [data-value="skip"]'); await sleep(300);

  /* ---- U-04 / F-09: 채점 버튼 대비 (라이트) ---- */
  await act('startSession', 'deck', [three[0]]); await sleep(300);
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(500);
  let ok = await contrast('#grade-btns .btn-ok'), dg = await contrast('#grade-btns .btn-danger');
  expect(ok && ok.ratio >= 4.5 && dg && dg.ratio >= 4.5, `U-04 라이트 채점 버튼 대비 ok ${ok && ok.ratio} / danger ${dg && dg.ratio}`);
  await shot('r-u04-session-light');
  // 다크
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(300);
  ok = await contrast('#grade-btns .btn-ok'); dg = await contrast('#grade-btns .btn-danger');
  expect(ok && ok.ratio >= 4.5 && dg && dg.ratio >= 4.5, `U-04 다크 채점 버튼 대비 ok ${ok && ok.ratio} / danger ${dg && dg.ratio}`);
  await shot('r-u04-session-dark');
  await esc(); await skipSummary();

  /* ---- U-03: 다크 모드 주간 리포트 표 머리글 ---- */
  await page.click('#tab-history'); await sleep(200); await page.click('[data-action="weekly-report"]'); await sleep(500);
  const th = await contrast('#print-area .tbl th'), td = await contrast('#print-area .tbl td'), h3 = await contrast('#print-area h3');
  expect(th && th.ratio >= 4.5 && td && td.ratio >= 4.5 && h3 && h3.ratio >= 4.5, `U-03 다크 주간 리포트 th ${th && th.ratio} / td ${td && td.ratio} / h3 ${h3 && h3.ratio}`);
  await shot('r-u03-weekly-dark');
  await page.click('[data-action="print-back"]'); await sleep(200);
  await page.emulateMedia({ colorScheme: 'light' }); await sleep(200);

  /* ---- U-05: 배지 대비(라이트) ---- */
  await page.click('#tab-cards'); await sleep(150); await page.click('.deck-card:has-text("수학 오답노트")'); await sleep(300);
  const br = await contrast('.badge-repeat'), bw = await contrast('.badge-wrong'), bl = await contrast('.badge-late');
  expect(br && br.ratio >= 4.5 && bw && bw.ratio >= 4.5 && bl && bl.ratio >= 4.5, `U-05 배지 대비 repeat ${br && br.ratio} / wrong ${bw && bw.ratio} / late ${bl && bl.ratio}`);
  expect(br && parseFloat(br.size) >= 12.5, 'U-05 배지 글자 크기 ' + (br && br.size));
  await shot('r-u05-badges');

  /* ---- F-01 / F-03 / C-02 / C-03: 교사 요약 가져오기 검증·XSS ---- */
  await page.click('#tab-settings'); await page.click('[data-action="set-teacher"]'); await sleep(200);
  await page.click('#tab-teacher'); await sleep(200);
  const mkFile = (obj, name) => page.evaluate(([o, n]) => window.__app.actions.importTeacherFiles([new File([JSON.stringify(o)], n, { type: 'application/json' })]), [obj, name]);
  await mkFile({ type: 'memory-box-summary', version: 1, exportedAt: '2026-10-20', student: { name: '<b>엑스</b>' }, decks: [], wrong: [{ deck: '수학', unit: '<img src=x onerror="window.__xssU=1">', front: 'f', reason: 'calc', fails: '<img src=x onerror="window.__xssF=1">', lastFail: today }], stats: { reviewed30d: '<img src=x onerror="window.__xssT=1">', accuracy30d: '<svg onload="window.__xssA=1">', streak: '7' } }, 'xss.json');
  await sleep(600);
  let x = await page.evaluate(() => ({ t: window.__xssT, a: window.__xssA, u: window.__xssU, f: window.__xssF }));
  expect(!x.t && !x.a && !x.u && !x.f, 'F-01/C-03 요약 stats·unit·fails의 HTML 미실행 ' + JSON.stringify(x));
  const rowT = await txt('#student-list tbody tr');
  expect(rowT.includes('<b>엑스</b>') && rowT.includes('0') && rowT.includes('7'), 'F-01 이름 이스케이프·stats 숫자화: ' + rowT.replace(/\s+/g, ' ').slice(0, 80));
  expect((await txt('#unit-table')).includes('<img'), 'F-01 단원명 HTML이 문자 그대로 표시');
  // wrong 비배열 파일 → 토스트, 화면 유지
  await mkFile({ type: 'memory-box-summary', version: 1, student: { name: '깨진파일' }, wrong: {}, stats: {} }, 'broken.json');
  await sleep(500);
  expect((await page.locator('#toast-root').textContent()).includes('형식이 맞지 않아요'), 'F-03 형식 불일치 파일 토스트');
  expect((await st()).teacher.imports.length === 1 && !(await st()).teacher.imports.some(i => i.studentName === '깨진파일'), 'F-03 깨진 파일은 저장되지 않음');
  await mkFile({ type: 'memory-box-summary', version: 1, student: { name: '문자열' }, wrong: 'abc', stats: 'x' }, 'broken2.json'); await sleep(300);
  await mkFile({ type: 'memory-box-summary', version: 1, wrong: [] }, 'noname.json'); await sleep(300);
  await mkFile({ type: 'memory-box-backup', version: 1, meta: {}, profiles: {} }, 'emptybackup.json'); await sleep(300);
  // 저장된 교사 데이터에 손상 항목을 직접 심은 뒤 새로고침 → 탭이 렌더되고 지우기 버튼이 있어야 함
  await page.evaluate(() => { const k = 'edu.memory-box.v1.teacher'; const t = JSON.parse(localStorage.getItem(k)); t.imports.push({ studentName: '손상', wrong: {}, stats: null }); t.imports.push(null); localStorage.setItem(k, JSON.stringify(t)); });
  await reload(); await page.click('#tab-teacher'); await sleep(300);
  const tv = await txt('#view-teacher');
  expect(tv.length > 100 && (await page.locator('[data-action="teacher-clear"]').count()) === 1, 'F-03 손상 항목이 저장돼 있어도 교사 탭 렌더 + 지우기 버튼');
  expect(await page.locator('#student-list tbody tr').count() === 1, 'F-03 손상 항목 필터 후 학생 1명');
  await shot('r-f03-teacher');
  // 샘플 학급 집계가 그대로인지(회귀)
  await page.click('[data-action="teacher-sample"]'); await sleep(300);
  const p1 = await txt('#point-cards .point-card');
  expect(await page.locator('#student-list tbody tr').count() === 7 && p1.includes('분수의 덧셈과 뺄셈') && p1.includes('5명') && p1.includes('17장'), 'C-02 회귀: 샘플 학급 집계 유지(분수 5명·17장): ' + p1.slice(0, 60));
  await page.click('[data-action="teacher-clear"]'); await sleep(200); if (await page.locator('.modal').count()) { await page.click('.modal [data-value="true"]'); await sleep(200); }

  /* ---- F-02 / C-01: 깨진 백업 복원 ---- */
  const restore = (obj, name) => page.evaluate(([o, n]) => { window.__app.actions.restoreFromFile(new File([JSON.stringify(o)], n, { type: 'application/json' })); }, [obj, name]);
  await page.click('#tab-settings'); await sleep(150);
  const cardsBefore = (await st()).data.cards.length;
  await restore({ type: 'memory-box-backup', version: 1, meta: {}, profiles: {} }, 'bad1.json'); await sleep(400);
  expect((await page.locator('.modal').textContent()).includes('복원 실패') && !(await page.locator('.modal:has-text("덮어쓰기")').count()), 'F-02 meta.profiles 없는 백업은 거부');
  await shot('r-f02-reject'); await esc();
  await restore({ type: 'memory-box-backup', version: 1, meta: { profiles: [{ id: 'p-haneul', name: '김하늘' }] }, profiles: {} }, 'bad2.json'); await sleep(400);
  expect((await page.locator('.modal').textContent()).includes('복원 실패'), 'F-02 profiles[id] 없는 백업은 거부'); await esc();
  await restore({ type: 'memory-box-backup', version: 2, meta: { profiles: [{ id: 'a', name: 'a' }] }, profiles: { a: {} } }, 'v2.json'); await sleep(400);
  expect((await page.locator('.modal').textContent()).includes('새로운 버전'), 'F-02 상위 버전 거부'); await esc();
  await reload();
  expect((await st()).data.cards.length === cardsBefore, 'F-02 거부 후 새로고침해도 카드 수 유지 ' + cardsBefore);
  // 구조는 맞지만 내용이 빈 프로필 → 덮어쓰기 시 예외 없이 보정, 이전 프로필 키 정리
  await page.click('#tab-settings'); await sleep(150);
  await restore({ type: 'memory-box-backup', version: 1, exportedAt: '2026-10-01', meta: { version: 1, activeProfileId: 'zzz', profiles: [{ id: 'p-new', name: '새싹', emoji: '🌱', dailyGoal: 3 }] }, profiles: { 'p-new': { cards: 'x', decks: [{ name: '덱A', subject: '국어' }, null, 'bad'], sessions: null, dailyLog: [], reflections: [{ text: 't' }], exams: [{ deckIds: 'no' }], pendingSession: { remainingCardIds: 'x' } } } }, 'coerce.json'); await sleep(400);
  expect(await page.locator('.modal:has-text("덮어쓰기")').count() === 1, 'F-02 구조 통과 파일은 복원 모달');
  await page.click('.modal [data-value="over"]'); await sleep(500);
  s = await st();
  expect(s.profile && s.profile.name === '새싹' && s.data.cards.length === 0 && s.data.decks.length === 1 && s.data.exams.length === 0 && s.data.pendingSession === null, 'F-02 덮어쓰기 후 보정된 데이터(카드 0·덱 1·시험 0)');
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('edu.memory-box.v1.profile.')));
  expect(keys.length === 1 && keys[0].endsWith('p-new'), 'F-02 옛 프로필 키 정리됨: ' + keys.join(','));
  await reload(); s = await st();
  expect(s.profile.name === '새싹' && s.meta.profiles.length === 1, 'F-02 새로고침 후 복원 상태 유지');
  await shot('r-f02-after-over');

  /* ---- 신규 점검: 백업 파일의 다른 필드(프로필 emoji·덱 color·id)로 XSS가 되는지 ---- */
  await page.click('#tab-settings'); await sleep(150);
  const evil = { type: 'memory-box-backup', version: 1, exportedAt: '2026-10-02', meta: { version: 1, activeProfileId: 'p-evil', profiles: [{ id: 'p-evil', name: '친구백업', emoji: '<img src=x onerror="window.__xssEmoji=1">', dailyGoal: 10 }] },
    profiles: { 'p-evil': { decks: [{ id: 'd-evil', name: '덱', subject: '수학', color: 'x"><img src=x onerror="window.__xssColor=1"><i class="' }, { id: 'd2"><img src=x onerror="window.__xssId=1"><i x="', name: '덱2', subject: '국어' }], cards: [{ id: 'c1', deckId: 'd-evil', type: 'memo', front: 'f', back: 'b', box: 1, due: today, createdAt: today }], sessions: [], dailyLog: {}, reflections: [], exams: [], pendingSession: null, weeklyChecks: [] } } };
  await restore(evil, 'evil.json'); await sleep(400);
  if (await page.locator('.modal [data-value="add"]').count()) { await page.click('.modal [data-value="add"]'); await sleep(500); }
  x = await page.evaluate(() => ({ emoji: window.__xssEmoji, color: window.__xssColor, id: window.__xssId }));
  log('XSS(backup add) after settings render: ' + JSON.stringify(x));
  expect(!x.emoji, 'R 신규: 백업 프로필 emoji의 HTML이 설정 화면에서 실행되지 않음');
  await page.click('#tab-home'); await sleep(200); await page.click('#profile-chip'); await sleep(200);
  x = await page.evaluate(() => ({ emoji: window.__xssEmoji, color: window.__xssColor, id: window.__xssId }));
  log('XSS after profile popover: ' + JSON.stringify(x));
  await page.mouse.click(5, 5); await sleep(150);
  s = await st(); const evilP = s.meta.profiles.find(p => p.name.startsWith('친구백업'));
  if (evilP) { await act('switchProfile', evilP.id); await sleep(300); await page.click('#tab-cards'); await sleep(300); }
  x = await page.evaluate(() => ({ emoji: window.__xssEmoji, color: window.__xssColor, id: window.__xssId }));
  log('XSS after switching to evil profile + cards tab: ' + JSON.stringify(x));
  expect(!x.color, 'R 신규: 백업 덱 color의 HTML이 덱 목록에서 실행되지 않음');
  expect(!x.id, 'R 신규: 백업 덱 id의 HTML이 덱 목록에서 실행되지 않음');
  await shot('r-new-xss-backup');
  // 샘플로 되돌리기
  await page.evaluate(() => { window.__app.actions.resample(); window.__app.actions.render(); }); await reload();

  /* ---- U-01 / U-06 / U-02 / F-13: 400px ---- */
  await page.setViewportSize({ width: 400, height: 860 }); await sleep(300);
  await page.click('#tab-home'); await sleep(200); await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  const ov = await page.evaluate(() => { const f = document.querySelector('.fab').getBoundingClientRect(); const out = []; document.querySelectorAll('.boxes .box, .boxes > *').forEach(b => { const r = b.getBoundingClientRect(); const w = Math.min(f.right, r.right) - Math.max(f.left, r.left), h = Math.min(f.bottom, r.bottom) - Math.max(f.top, r.top); if (w > 0 && h > 0) out.push(`${b.className.split(' ').slice(0, 2).join('.')}:${Math.round(w)}x${Math.round(h)}`); }); return { fab: [Math.round(f.left), Math.round(f.top), Math.round(f.width), Math.round(f.height)], overlaps: out, sh: document.documentElement.scrollHeight, boxesBottom: Math.round(document.querySelector('.boxes').getBoundingClientRect().bottom) }; });
  log('U-06 FAB geometry: ' + JSON.stringify(ov));
  expect(ov.overlaps.length === 0, 'U-06 400px 첫 화면에서 FAB이 상자 그림과 겹치지 않음 ' + JSON.stringify(ov.overlaps));
  await page.screenshot({ path: require('path').join(__dirname, 'r-u06-mobile-home-viewport.png') });
  await page.evaluate(() => window.scrollTo(0, 99999)); await sleep(200);
  const ovFoot = await page.evaluate(() => { const f = document.querySelector('.fab').getBoundingClientRect(); const r = document.querySelector('.app-footer').getBoundingClientRect(); const w = Math.min(f.right, r.right) - Math.max(f.left, r.left), h = Math.min(f.bottom, r.bottom) - Math.max(f.top, r.top); return w > 0 && h > 0 ? `${Math.round(w)}x${Math.round(h)}` : ''; });
  log('U-06 FAB vs footer overlap at bottom: ' + (ovFoot || 'none'));
  // U-01: 저장 불가 배너 버튼
  await page.evaluate(() => { document.querySelector('#storage-banner').hidden = false; }); await sleep(100);
  const bb = await page.evaluate(() => { const b = document.querySelector('#storage-banner .btn'); const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), ws: getComputedStyle(b).whiteSpace }; });
  expect(bb.w >= 60 && bb.h <= 48 && bb.ws === 'nowrap', 'U-01 배너 버튼 ' + JSON.stringify(bb));
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: require('path').join(__dirname, 'r-u01-banner-mobile.png') });
  await page.evaluate(() => { document.querySelector('#storage-banner').hidden = true; });
  // U-02 / F-13: 인쇄 미리보기 축소
  await page.click('#tab-print'); await sleep(200);
  if (await page.locator('[data-action="print-preview"]:not([disabled])').count() === 0) { await page.locator('[data-action="print-deck"]').first().click(); await sleep(200); }
  await page.click('[data-action="print-preview"]'); await sleep(600);
  const pv = await page.evaluate(() => { const v = document.querySelector('#print-view'), a = document.querySelector('#print-area'); return { sw: v.scrollWidth, cw: v.clientWidth, zoom: a.style.zoom, note: !document.querySelector('#print-scale-note').hidden, pageW: Math.round(document.querySelector('.page').getBoundingClientRect().width) }; });
  expect(pv.sw <= pv.cw + 1 && pv.zoom && Number(pv.zoom) < 1 && pv.note, 'U-02/F-13 400px 인쇄 미리보기 축소 ' + JSON.stringify(pv));
  await page.screenshot({ path: require('path').join(__dirname, 'r-u02-print-mobile.png') });
  await page.click('[data-action="print-back"]'); await sleep(200);
  await page.click('#tab-history'); await sleep(200); await page.click('[data-action="weekly-report"]'); await sleep(500);
  const pv2 = await page.evaluate(() => { const v = document.querySelector('#print-view'); return { sw: v.scrollWidth, cw: v.clientWidth, zoom: document.querySelector('#print-area').style.zoom }; });
  expect(pv2.sw <= pv2.cw + 1, 'U-02 400px 주간 리포트 미리보기 가로 스크롤 없음 ' + JSON.stringify(pv2));
  await page.screenshot({ path: require('path').join(__dirname, 'r-u02-weekly-mobile.png') });
  await page.click('[data-action="print-back"]'); await sleep(200);
  // 교사 모드 켠 상태의 400px 탭 7개
  await page.click('#tab-settings'); await sleep(200); await page.click('[data-action="set-teacher"]'); await sleep(200);
  const over = [];
  for (const v of ['home', 'cards', 'history', 'exam', 'print', 'teacher', 'settings']) { await page.click('#tab-' + v); await sleep(200); if (await hscroll()) over.push(v); }
  expect(over.length === 0, '400px 탭 7개 가로 스크롤 없음 ' + over.join(','));
  await page.setViewportSize({ width: 1280, height: 800 });

  /* ---- F-12 / m-11: 일반 화면 Ctrl+P → .app 보임 ---- */
  await page.click('#tab-home'); await sleep(200);
  await page.emulateMedia({ media: 'print' }); await sleep(200);
  const appShown = await page.evaluate(() => getComputedStyle(document.querySelector('.app')).display !== 'none' && document.querySelector('#print-view').hidden);
  expect(appShown, 'F-12 일반 화면 인쇄 매체에서 .app 표시');
  await page.emulateMedia({ media: 'screen' });

  /* ---- F-11 / m-02: CSV 1,000행 제한 ---- */
  const newDeck = async (name) => { await page.click('#tab-cards'); await sleep(300); try { await page.locator('[data-action="new-deck"]').first().click({ timeout: 8000 }); } catch (e) { log('new-deck click error: ' + e.message.split('\n').slice(0, 12).join(' | ')); await page.evaluate(() => document.querySelector('[data-action="new-deck"]').click()); } await sleep(200); await page.fill('#dk-name', name); await page.click('.modal [data-value="true"]'); await sleep(300); return (await st()).data.decks.find(d => d.name === name); };
  const nd = await newDeck('천행');
  const big = [...Array(1005)].map((_, i) => 'q' + (i + 1) + ',a' + (i + 1)).join('\n');
  page.evaluate(([t, id]) => window.__app.actions.importCsvText(t, id), [big, nd.id]).catch(() => {}); await sleep(800);
  const prevTxt = await txt('.modal');
  expect(prevTxt.includes('총 1000행') || prevTxt.includes('총 1,000행'), 'F-11 헤더 없는 1,005행 → 총 1000행: ' + (prevTxt.match(/총 [\d,]+행/) || [''])[0]);
  await page.click('.modal [data-value="true"]'); await sleep(800);
  expect((await st()).data.cards.filter(c => c.deckId === nd.id).length === 1000, 'F-11 1,000장만 추가');
  const bigH = '앞면,뒷면\n' + [...Array(1001)].map((_, i) => 'h' + (i + 1) + ',a' + (i + 1)).join('\n');
  const nd2 = await newDeck('천행2');
  page.evaluate(([t, id]) => window.__app.actions.importCsvText(t, id), [bigH, nd2.id]).catch(() => {}); await sleep(800);
  const prev2 = await txt('.modal');
  expect(/총 1,?000행/.test(prev2) && prev2.includes('1000행만'), 'F-11 헤더 포함 1,002행 → 1000행 + 안내: ' + (prev2.match(/총 [\d,]+행/) || [''])[0]);
  await esc();

  /* ---- m-04: 시험 계획 달력이 현재 due 기준으로 줄어드는지 + 홈 배너 ---- */
  await page.click('#tab-home'); await sleep(200);
  const homeTxt = await txt('#view-home');
  const planToday = Number((homeTxt.match(/오늘 계획 (\d+)장/) || [0, 0])[1]);
  s = await st(); const ex = s.data.exams[0]; const mathDeck = s.data.decks.find(d => ex.deckIds.includes(d.id));
  const liveToday = s.data.cards.filter(c => ex.deckIds.includes(c.deckId) && c.due <= today).length;
  expect(planToday === liveToday, `m-04 홈 배너 오늘 계획 ${planToday} = 현재 due≤오늘 카드 ${liveToday}`);
  await page.click('#tab-exam'); await sleep(300);
  const sum = await page.$$eval(`#plan-${ex.id} .plan-day b`, els => els.map(e => Number(e.textContent)).reduce((a, b) => a + b, 0));
  const expectSum = s.data.cards.filter(c => ex.deckIds.includes(c.deckId) && c.due < ex.date).length;
  expect(sum === expectSum, `m-04 계획 달력 합 ${sum} = 시험 전 due 카드 ${expectSum}`);
  await shot('r-exam');
  log('done');
};
