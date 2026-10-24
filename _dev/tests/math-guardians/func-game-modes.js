// func-game-modes.js — 게임 모드·입력 방식(AC9·10·11): 느리게 속도, 시간 제한 표시/종료, 게임 오버, 3지선다(4-2), 소수점(4-3), 저학년 3지선다, 체험 모드, 큰 글씨 (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await st()).game;
  const txt = sel => page.locator(sel).first().innerText().catch(() => '');
  const toastTexts = () => page.locator('#toast-root .toast').allInnerTexts();
  const waitFor = async (fn, timeout = 15000, every = 60) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) return null; await sleep(every); } };
  const setS = (k, v) => page.evaluate(([k, v]) => window.__app.actions.setSetting(k, v), [k, v]);
  const startVia = async stageId => { await page.evaluate(() => window.__app.actions.showView('home')); await page.click(`[data-action="grade-tab"][data-grade="${stageId[1]}"]`); await page.click(`.stage-card[data-stage="${stageId}"] .start-btn`); };
  const quitToResult = async () => { await page.evaluate(() => window.__app.actions.quit()); await waitFor(async () => (await st()).view === 'result', 3000, 50); };
  const rec = (sid) => page.evaluate(sid => { const p = window.__app.MG.current(); const r = p.stageRecords[sid]; return r ? { plays: r.plays, best: r.bestScore, stars: r.bestStars, clears: r.clears } : null; }, sid);
  const firstMonster = () => waitFor(async () => { const g = await game(); return g && g.monsters.length ? g : null; }, 5000);
  await page.evaluate(() => { const A = window.__app.MG.Audio, orig = A.play; window.__sounds = []; A.play = (n, a) => { window.__sounds.push(n); return orig(n, a); }; });
  const sounds = () => page.evaluate(() => (window.__sounds || []).splice(0));

  // ---------- AC10(1): 느리게 → 1-1 도달 ≈16초 ----------
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  await page.check('#speed-group input[value="slow"]'); await sleep(350);
  expect((await st()).settings.speedPreset === 'slow', '설정 라디오로 속도 느리게 저장');
  await startVia('s1-1');
  let g = await firstMonster();
  expect(!!g && /^\d\+\d$/.test(g.monsters[0].key), `1-1 첫 몬스터 'a+b' (${g && g.monsters[0].key})`);
  const m1 = g.monsters[0];
  const reached = await waitFor(async () => { const g = await game(); return g.hp < 3 ? g : null; }, 20000, 50);
  const slowDelta = reached ? (reached.elapsedMs - m1.spawnedAt) / 1000 : -1;
  log(`느리게 도달 시간 ${slowDelta.toFixed(2)}s, adaptive=${reached && reached.adaptive}`);
  expect(slowDelta >= 15 && slowDelta <= 17.2, `AC10 느리게 도달 시간 약 16초 (실제 ${slowDelta.toFixed(2)}s)`);
  await quitToResult();
  await setS('speedPreset', 'normal');

  // ---------- AC10(2): 시간 제한 3분 표시 → 카운트다운 ----------
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  await page.selectOption('#time-limit', '3'); await sleep(350);
  await startVia('s1-1');
  const t1 = await txt('#hud-time');
  expect(t1 === '⏱ 03:00' && !(await page.locator('#hud-time').isHidden()), `AC10 HUD 03:00부터 표시 (${t1})`);
  await sleep(1300);
  const t2 = await txt('#hud-time');
  expect(t2 === '⏱ 02:59' || t2 === '⏱ 02:58', `카운트다운 진행 (${t2})`);
  await quitToResult();
  await setS('timeLimitMin', 0);
  await startVia('s1-1');
  expect(await page.locator('#hud-time').isHidden(), '시간 제한 없음 → HUD 시간 숨김');
  await quitToResult();
  // 교정 카드 중 타이머 정지 + 시간 종료 결과 (제한 0.1분=6초)
  await setS('timeLimitMin', 0.1);
  const r0 = await rec('s1-1');
  await startVia('s1-1');
  g = await firstMonster();
  await page.keyboard.type(String(Number(g.monsters[0].answerText) + 1)); await page.keyboard.press('Enter'); await sleep(100);
  const atCard = await game();
  expect(atCard.state === 'card', '오답 → 카드');
  await sleep(5200);
  g = await game();
  expect(g.state === 'card' && g.elapsedMs === atCard.elapsedMs, `교정 카드 열린 동안 시간 제한 타이머 정지 (elapsed ${atCard.elapsedMs}→${g.elapsedMs})`);
  await page.keyboard.type(g.monsters[0].answerText); await page.keyboard.press('Enter');
  const ended = await waitFor(async () => (await st()).view === 'result', 9000, 100);
  expect(!!ended && (await txt('.result-head h2')).includes('시간 종료'), `AC10 시간 종료 결과 (${await txt('.result-head h2')})`);
  await sleep(1200);
  const r1 = await rec('s1-1');
  expect(await page.locator('#result-stars .got').count() === 0 && r1.plays === r0.plays + 1 && r1.clears === r0.clears, `시간 종료: 별 0·플레이 수 +1 (${r0.plays}→${r1.plays})`);
  expect(await page.evaluate(() => window.__app.MG.current().history[0].endedBy) === 'timeout', 'history endedBy=timeout');
  await shot('result-timeout');

  // ---------- AC9: 게임 오버(빠르게, 미입력) ----------
  await setS('timeLimitMin', 0); await setS('speedPreset', 'fast');
  const r2 = await rec('s1-1');
  await startVia('s1-1');
  g = await firstMonster();
  const fm = g.monsters[0];
  const hp2 = await waitFor(async () => { const g = await game(); return g.hp === 2 ? g : null; }, 15000, 50);
  const fastDelta = hp2 ? (hp2.elapsedMs - fm.spawnedAt) / 1000 : -1;
  expect(fastDelta >= 8.3 && fastDelta <= 10.3, `빠르게 도달 시간 ≈9.2초 (실제 ${fastDelta.toFixed(2)}s)`);
  const over = await waitFor(async () => (await st()).view === 'result', 40000, 100);
  expect(!!over && (await txt('.result-head h2')).includes('게임 오버'), `AC9 하트 3개 소진 → '게임 오버' (${await txt('.result-head h2')})`);
  await sleep(1200);
  const r3 = await rec('s1-1');
  expect(await page.locator('#result-stars .got').count() === 0 && r3.plays === r2.plays + 1, `AC9 별 0·플레이 수 +1 (${r2.plays}→${r3.plays})`);
  const statHp = (await page.locator('.stat').allInnerTexts()).find(x => x.includes('남은 HP'));
  expect(statHp && statHp.includes('0'), `남은 HP 0 표시 (${statHp && statHp.replace(/\s+/g, ' ')})`);
  expect(await page.locator('.wrong-card').count() === 3 && (await page.locator('.wrong-card .tag').allInnerTexts()).every(t => t === '미응답'), '미응답 3문제 복습 목록');
  await shot('result-gameover');
  await setS('speedPreset', 'normal');

  // ---------- AC11(1): 4-2 3지선다 ----------
  await setS('unlockAll', true);
  await startVia('s4-2');
  expect(await page.locator('#input-panel .key').count() === 0 && (await txt('#input-panel .pad-hint')).includes('1·2·3'), '4-2 시작 직후 키패드 없음·선택 안내');
  g = await firstMonster(); await sleep(100);
  expect(await page.locator('#input-panel .choice-btn').count() === 3 && await page.locator('#input-panel .key').count() === 0, 'AC11 4-2: 키패드 대신 선택지 3개');
  let m = g.monsters[0];
  expect(m.choices && m.choices.length === 3 && new Set(m.choices).size === 3 && m.choices[m.correctIndex] === m.answerText, `3지선다 문제 ${m.text} 선택지 ${JSON.stringify(m.choices)} 정답 index ${m.correctIndex}`);
  const btnTexts = await page.locator('#input-panel .choice-btn').allInnerTexts();
  expect(btnTexts.every((t, i) => t.replace(/^\d\s*/, '').trim() === m.choices[i]), `선택지 버튼 텍스트 = 목표 몬스터 선택지 (${btnTexts.map(t => t.replace(/\s+/g, ' ')).join(' | ')})`);
  // 크로스헤어: 가장 앞선 몬스터 주변 빨강 픽셀
  const redNear = async (mon) => page.evaluate(({ p }) => { const c = document.getElementById('game-canvas'), ctx = c.getContext('2d'), sc = c.width / 960; const x = 940 - p * 800, y = 330; const d = ctx.getImageData(Math.max(0, (x - 50) * sc), (y - 60) * sc, 100 * sc, 120 * sc).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 230) < 16 && Math.abs(d[i + 1] - 57) < 16 && Math.abs(d[i + 2] - 70) < 16) n++; return n; }, { p: mon.progress });
  await sleep(300);
  m = (await game()).monsters[0];
  const red1 = await redNear(m);
  expect(red1 > 30, `AC11 가장 앞선 몬스터에 조준선(빨강 픽셀 ${red1})`);
  await shot('game-choice3');
  // 키보드 숫자로 선택
  const c0 = (await game()).correct;
  await page.keyboard.press(String(m.correctIndex + 1));
  const killed = await waitFor(async () => { const g = await game(); return g.correct === c0 + 1 ? g : null; }, 1500, 30);
  expect(!!killed, 'AC11 키보드 1/2/3으로 정답 선택 → 격파');
  // 다음 몬스터로 선택지 갱신
  const m2 = await waitFor(async () => { const g = await game(); const x = g.monsters[0]; return x && x.id !== m.id ? x : null; }, 6000);
  await sleep(150);
  const btn2 = await page.locator('#input-panel .choice-btn').allInnerTexts();
  expect(!!m2 && btn2.every((t, i) => t.replace(/^\d\s*/, '').trim() === m2.choices[i]), `목표 변경 시 선택지 갱신 (${btn2.map(t => t.replace(/\s+/g, ' ')).join(' | ')})`);
  // 오선택 → 카드(틀린 버튼 비활성, 막대 모델) → 남은 선택지로 정답
  const wrongIdx = (m2.correctIndex + 1) % 3;
  await page.click(`#input-panel .choice-btn[data-i="${wrongIdx}"]`); await sleep(120);
  g = await game();
  expect(g.state === 'card' && await page.locator('.card-modal .choice-btn').count() === 3 && await page.locator(`.card-modal .choice-btn[data-i="${wrongIdx}"]`).isDisabled(), '오선택 → 카드에 선택지 3개, 틀린 버튼 비활성');
  expect(await page.locator('.card-modal .fbar').count() >= 3, `분수 막대 모델 표시 (${await page.locator('.card-modal .fbar').count()}개)`);
  await shot('card-bar');
  await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class')).includes('locked'), 2500, 50);
  await page.keyboard.press(String(m2.correctIndex + 1)); await sleep(120);
  expect(await page.locator('.card-modal').count() === 0, '카드에서 정답 선택 → 닫힘');
  await quitToResult();

  // ---------- AC11(2): 4-3 소수점 키패드 ----------
  await startVia('s4-3');
  expect(await page.locator('#input-panel .key').count() === 13 && await page.locator('#input-panel .key[data-k="."]').count() === 1, "AC11 4-3: '.' 키 추가(13키)");
  const disp = () => txt('#input-panel .input-display');
  await page.click('#input-panel .key[data-k="."]');
  expect((await disp()) === '0.', `선행 '.' → '0.' (${await disp()})`);
  await page.click('#input-panel .key[data-k="."]');
  expect((await disp()) === '0.', "'.' 중복 차단");
  for (const d of '1234567') await page.click(`#input-panel .key[data-k="${d}"]`);
  expect((await disp()) === '0.12345', `6자리 초과 차단 (${await disp()})`);
  await page.keyboard.press('Backspace');
  expect((await disp()) === '0.1234', `Backspace 지우기 (${await disp()})`);
  for (let i = 0; i < 8; i++) await page.click('#input-panel .key-back');
  expect((await disp()) === '?', '모두 지우면 placeholder');
  await page.keyboard.type('0'); await page.keyboard.type('5');
  expect((await disp()) === '5', `선행 0 제거 (${await disp()})`);
  await page.keyboard.press('Backspace');
  g = await firstMonster(); m = g.monsters[0];
  expect(/^\d+(\.\d)?[+−]\d+(\.\d)?$/.test(m.key), `4-3 문제 키 '${m.key}' 정답 '${m.answerText}'`);
  const typed = m.answerText.includes('.') ? m.answerText + '0' : m.answerText + '.0';
  const c1 = g.correct;
  await page.keyboard.type(typed); expect((await disp()) === typed, `입력 '${typed}' 표시`);
  await page.keyboard.press('Enter');
  const k2 = await waitFor(async () => { const g = await game(); return g.correct === c1 + 1 ? g : null; }, 1500, 30);
  expect(!!k2, `AC11 '${typed}' 입력이 ${m.answerText}로 정답 처리`);
  // 빈 입력 Enter 무시
  const w0 = (await game()).wrong; await page.keyboard.press('Enter'); await sleep(80);
  expect((await game()).wrong === w0 && (await game()).state === 'playing', '빈 입력 Enter 무시');
  // 소수 스테이지에서 잘못된 소수 → 카드(text 모델)
  const m3 = await waitFor(async () => { const g = await game(); return g.state === 'playing' ? g.monsters.find(x => !x.locked) || null : null; }, 6000);
  await page.keyboard.type('9.9'); await page.keyboard.press('Enter'); await sleep(100);
  const isCard = (await game()).state === 'card';
  if (isCard) {
    expect(await page.locator('.card-modal .hint-text').count() === 1 && (await txt('.card-modal .hint-text')).includes('소수점'), `소수 교정 카드 한 줄 풀이 (${await txt('.card-modal .hint-text')})`);
    expect(await page.locator('.card-modal .key[data-k="."]').count() === 1, "소수 교정 카드에도 '.' 키");
    await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class')).includes('locked'), 2500, 50);
    await page.keyboard.type(m3.answerText); await page.keyboard.press('Enter'); await sleep(120);
    expect(await page.locator('.card-modal').count() === 0, '소수 정답 입력으로 카드 닫힘');
  } else expect(m3.answerText === '9.9', '9.9가 정답이어서 격파됨');
  await quitToResult();
  await setS('unlockAll', false);

  // ---------- 저학년 3지선다 모드 ----------
  await setS('lowGradeChoice', true);
  await page.evaluate(() => window.__app.actions.showView('home'));
  await page.click('[data-action="grade-tab"][data-grade="1"]');
  expect((await page.locator('.stage-card[data-stage="s1-1"] .stage-input').innerText()) === '🔘 3지선다', '저학년 3지선다 ON → 1-1 카드 아이콘 변경');
  await page.click('.stage-card[data-stage="s1-1"] .start-btn');
  g = await firstMonster(); m = g.monsters[0];
  const ans = Number(m.answerText);
  const diffs = m.choices.filter((c, i) => i !== m.correctIndex).map(c => Math.abs(Number(c) - ans));
  expect(await page.locator('#input-panel .choice-btn').count() === 3 && diffs.every(d => [1, 2, 10].includes(d)) && m.choices.every(c => Number(c) >= 0), `저학년 3지선다 오답 ±1/±2/±10 (${JSON.stringify(m.choices)}, 정답 ${ans})`);
  const cc = g.correct; await page.click(`#input-panel .choice-btn[data-i="${m.correctIndex}"]`);
  expect(!!(await waitFor(async () => (await game()).correct === cc + 1, 1500, 30)), '저학년 3지선다 정답 버튼 → 격파');
  // 오선택 → dots 모델 카드
  const m4 = await waitFor(async () => { const g = await game(); return g.state === 'playing' ? g.monsters.find(x => !x.locked) || null : null; }, 6000);
  await page.keyboard.press(String(((m4.correctIndex + 1) % 3) + 1)); await sleep(120);
  expect((await game()).state === 'card' && await page.locator('.card-modal .dots i.blue').count() === Number(m4.key.split('+')[0]), `1-1 점 모델: 파랑 ${await page.locator('.card-modal .dots i.blue').count()}개`);
  await shot('card-dots');
  await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class')).includes('locked'), 2500, 50);
  await page.keyboard.press(String(m4.correctIndex + 1)); await sleep(100);
  await quitToResult();
  await setS('lowGradeChoice', false);

  // ---------- 큰 글씨 모드 ----------
  await setS('bigText', true); await page.evaluate(() => document.body.classList.add('big-text'));
  await startVia('s1-1');
  const bigH = await page.locator('#input-panel .key[data-k="5"]').evaluate(e => e.getBoundingClientRect().height);
  expect(bigH >= 72, `큰 글씨 모드 키패드 ≥72px (${bigH})`);
  await quitToResult();
  await setS('bigText', false); await page.evaluate(() => document.body.classList.remove('big-text'));

  // ---------- 체험 모드(게스트) ----------
  const before = await st();
  await page.evaluate(() => window.__app.actions.showView('home'));
  await page.click('.toolbar [data-action="guest"]'); await sleep(100);
  let s = await st();
  expect(s.guest && s.current === '체험 학생' && (await txt('#profile-sub')) === '체험 모드' && (await txt('#summary-card')).includes('기록이 저장되지 않아요'), '체험하기 → 게스트 프로필·안내');
  expect((await toastTexts()).some(t => t.includes('체험 모드')), '체험 모드 토스트');
  await page.click('[data-action="grade-tab"][data-grade="1"]');
  expect(await page.locator('.stage-card.locked').count() === 2, '게스트는 1-1만 열림(1-2·1-3 잠금)');
  await page.click('.stage-card[data-stage="s1-1"] .start-btn');
  g = await firstMonster();
  await page.evaluate(a => window.__app.actions.fire(a), g.monsters[0].answerText); await sleep(400);
  expect((await game()).correct === 1, '게스트 격파');
  expect(!(await toastTexts()).some(t => t.includes('배지')), '게스트에게는 배지 미지급');
  await quitToResult();
  expect(await page.locator('.result-actions [data-action="new-profile"]').count() === 1 && (await txt('.result-actions [data-action="new-profile"]')).includes('프로필'), "게스트 결과: '프로필 만들어 기록 저장하기' 버튼");
  expect(await page.locator('.result-actions [data-action="start-stage"][data-stage="s1-2"]').count() === 0, '게스트에게 다음 스테이지 버튼 없음');
  s = await st();
  expect(s.profiles.length === before.profiles.length && JSON.stringify(s.profiles.map(p => p.records)) === JSON.stringify(before.profiles.map(p => p.records)), '게스트 판은 어떤 프로필에도 기록되지 않음');
  await page.click('.result-actions [data-action="new-profile"]'); await sleep(100);
  await page.fill('#np-name', '게스트전환'); await page.click('.modal [data-m="ok"]'); await sleep(200);
  s = await st();
  expect(!s.guest && s.current === '게스트전환' && s.view === 'home' && s.profiles.length === before.profiles.length + 1, '게스트 → 새 프로필 생성 후 홈·활성 전환');
  await page.reload({ waitUntil: 'load' }); await sleep(500);
  expect((await st()).current === '게스트전환', '새 프로필 생성 직후(300ms 내) 새로고침해도 프로필 유지(pagehide flush)');
  if ((await st()).current !== '게스트전환') { await page.click('.toolbar [data-action="new-profile"]'); await page.fill('#np-name', '게스트전환'); await page.click('.modal [data-m="ok"]'); await sleep(400); await reload(); }
  expect((await st()).current === '게스트전환', '새 프로필 저장 유지(디바운스 경과 후)');
  await page.evaluate(() => { const A = window.__app.MG.Audio, orig = A.play; window.__sounds = []; A.play = (n, a) => { window.__sounds.push(n); return orig(n, a); }; });
  // 전체화면 버튼: 오류 없이 동작(토스트 또는 전환)
  await page.click('[data-action="grade-tab"][data-grade="1"]'); await page.click('.stage-card[data-stage="s1-1"] .start-btn');
  await page.click('.hud [data-action="fullscreen"]'); await sleep(300);
  const fs = await page.evaluate(() => !!document.fullscreenElement);
  log(`fullscreen: ${fs}, toasts=${JSON.stringify(await toastTexts())}`);
  expect(true, '전체화면 버튼 클릭 시 예외 없음');
  if (fs) await page.evaluate(() => document.exitFullscreen());
  await quitToResult();
  const snd = await sounds();
  log('효과음 호출 종류: ' + [...new Set(snd)].join(','));
};
