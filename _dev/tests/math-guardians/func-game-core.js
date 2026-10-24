// func-game-core.js — 전투 루프 핵심(AC3·4·5·6·12·14-2): 성 도달 시간, 키패드 격파, 오답 교정 카드, 복수 몬스터, 콤보·필살기, 일시정지/중단, 복습, 음소거 (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await st()).game;
  const txt = sel => page.locator(sel).first().innerText().catch(() => '');
  const toastTexts = () => page.locator('#toast-root .toast').allInnerTexts();
  const waitFor = async (fn, timeout = 15000, every = 60) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) return null; await sleep(every); } };
  const comboMult = c => c < 5 ? 1 : c < 10 ? 2 : c < 20 ? 3 : 4;
  // 효과음 호출 기록 + 오디오 노드 생성 카운터
  await page.evaluate(() => {
    const A = window.__app.MG.Audio, orig = A.play; window.__sounds = []; A.play = (n, a) => { window.__sounds.push(n); return orig(n, a); };
    window.__nodes = 0; const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { for (const m of ['createOscillator', 'createBufferSource']) { const o = AC.prototype[m]; AC.prototype[m] = function () { window.__nodes++; return o.apply(this, arguments); }; } }
  });
  const sounds = () => page.evaluate(() => window.__sounds.splice(0));
  const nodes = () => page.evaluate(() => window.__nodes);
  // 다음 살아 있는 일반 몬스터를 API로 격파
  const killNext = async (timeout = 12000) => {
    const m = await waitFor(async () => { const g = await game(); if (!g || g.state !== 'playing') return null; return g.monsters.find(x => !x.locked && !x.isBoss) || null; }, timeout);
    if (!m) return null;
    const g0 = await game();
    await page.evaluate(a => window.__app.actions.fire(a), m.answerText);
    const gone = await waitFor(async () => { const g = await game(); return g && !g.monsters.some(x => x.id === m.id) ? g : null; }, 1500, 30);
    return { m, before: g0, after: gone };
  };

  // ---------- 시작: 2학년 → 곱셈구구 '시작' ----------
  await page.click('[data-action="grade-tab"][data-grade="2"]');
  await page.click('.stage-card[data-stage="s2-3"] .start-btn');
  let s = await st();
  expect(s.view === 'game' && s.game && s.game.stage === 's2-3' && s.game.state === 'playing', '2-3 시작 → 게임 화면·playing');
  expect(await page.evaluate(() => document.body.classList.contains('in-game') && document.querySelector('.app-header').offsetParent === null), '게임 중 헤더·탭 숨김');
  expect((await txt('#hud-wave')) === 'WAVE 1/10' && (await page.locator('#hud-hearts span').allInnerTexts()).join('') === '❤❤❤', 'HUD 웨이브 1/10·하트 3개');
  expect((await txt('#hud-time')).includes('05:00'), `HUD 시간 제한 기본 5분 표시 (${await txt('#hud-time')})`);
  expect(await page.locator('#input-panel .key').count() === 12 && await page.locator('#input-panel .key[data-k="."]').count() === 0 && await page.locator('#input-panel .key-fire').count() === 1, 'number 키패드: 0~9·지우기·발사, 소수점 키 없음');
  const keyH = await page.locator('#input-panel .key[data-k="5"]').evaluate(e => e.getBoundingClientRect().height);
  expect(keyH >= 56, `키패드 버튼 높이 ${keyH.toFixed(1)}px ≥ 56`);
  expect(await page.locator('#super-btn').isDisabled(), '필살기 버튼 초기 비활성');
  expect(await page.evaluate(() => sessionStorage.getItem('mathGuardians.inGame') === '1'), '게임 중 세션 플래그 설정');
  const wall0 = Date.now();
  const first = await waitFor(async () => { const g = await game(); return g.monsters.length ? g : null; }, 4000);
  expect(!!first, 'WAVE 1 배너 후 몬스터 등장');
  if (!first) return;
  const m1 = first.monsters[0];
  log(`첫 몬스터: ${JSON.stringify(m1)} elapsed=${first.elapsedMs}`);
  expect(/^\d×\d$/.test(m1.key) && /^\d × \d$/.test(m1.text) && m1.progress < 0.1, `첫 몬스터 'a×b' 라벨, 오른쪽 끝 등장 (${m1.text}, p=${m1.progress})`);
  expect(first.monsters.length === 1 && Math.abs(m1.spawnedAt - 1000) < 200, `웨이브 1 동시 1마리, 배너 1초 후 스폰 (spawnedAt=${m1.spawnedAt})`);
  await shot('game-wave1');

  // ---------- AC3: 입력 없이 성 도달 ≈12초 ----------
  const t0wall = Date.now() - (first.elapsedMs - m1.spawnedAt);
  const reached = await waitFor(async () => { const g = await game(); return g.hp < 3 ? g : null; }, 16000, 50);
  const wallDelta = (Date.now() - t0wall) / 1000;
  expect(!!reached, '몬스터가 성에 도달해 HP 감소');
  if (reached) {
    const gameDelta = (reached.elapsedMs - m1.spawnedAt) / 1000;
    log(`도달 시간: game=${gameDelta.toFixed(2)}s wall=${wallDelta.toFixed(2)}s`);
    expect(gameDelta >= 11 && gameDelta <= 13.2, `AC3 보통 속도 도달 시간 약 12초(게임시간 ${gameDelta.toFixed(2)}s)`);
    expect(wallDelta >= 10.5 && wallDelta <= 14, `AC3 실제 경과 ${wallDelta.toFixed(2)}s`);
    expect(reached.hp === 2 && reached.reached === 1 && reached.combo === 0, 'HP 3→2, 미응답 1');
    const hearts = await page.locator('#hud-hearts span').allInnerTexts();
    expect(hearts.join('') === '❤❤🖤', `하트 표시 ${hearts.join('')}`);
    const snd = await sounds();
    expect(snd.includes('damage'), `피격음 호출 (${snd.join(',')})`);
    expect(!reached.monsters.some(x => x.id === m1.id), '도달한 몬스터 소멸');
  }

  // ---------- AC4: 키패드로 정답 입력 → 발사 ----------
  const m2 = await waitFor(async () => { const g = await game(); return g.monsters.find(x => !x.locked) || null; }, 6000);
  expect(!!m2, '두 번째 몬스터 등장');
  await sounds(); const n0 = await nodes();
  const score0 = (await game()).score;
  for (const d of m2.answerText) await page.click(`#input-panel .key[data-k="${d}"]`);
  expect((await txt('#input-panel .input-display')) === m2.answerText, `입력 표시창 '${m2.answerText}'`);
  expect(await page.evaluate(() => document.activeElement === document.body), '키패드 클릭 후 포커스가 버튼으로 이동하지 않음');
  const comboBefore = (await game()).combo;
  await page.keyboard.press('Enter');
  const fired = await waitFor(async () => { const g = await game(); return g.monsters.some(x => x.id === m2.id && x.locked) || !g.monsters.some(x => x.id === m2.id) ? g : null; }, 1000, 20);
  expect(!!fired, '발사 후 목표 몬스터 조준(locked)');
  expect((await txt('#input-panel .input-display')) === '?', '발사 후 입력창 초기화');
  let seenParticles = 0, seenFloat = null, hitState = null;
  for (let i = 0; i < 30; i++) { const g = await game(); seenParticles = Math.max(seenParticles, g.particles); const f = g.floats.find(x => /^\+\d/.test(x)); if (f) seenFloat = f; if (!g.monsters.some(x => x.id === m2.id)) { hitState = g; if (seenFloat) break; } await sleep(25); }
  const pts = 100 * comboMult(comboBefore) + 50;
  expect(!!hitState && hitState.score === score0 + pts, `AC4 명중 후 점수 +${pts} (${score0}→${hitState && hitState.score})`);
  expect(seenFloat === `+${pts}`, `AC4 플로팅 텍스트 '+${pts}' (실제 ${seenFloat})`);
  expect(seenParticles >= 12, `AC4 파티클 ${seenParticles}개 (≥12)`);
  expect((await txt('#hud-score')) === String(score0 + pts).replace(/\B(?=(\d{3})+(?!\d))/g, ','), `HUD 점수 ${await txt('#hud-score')}`);
  const snd2 = await sounds();
  expect(snd2.includes('shoot') && snd2.includes('hit'), `발사음·명중음 호출 (${snd2.join(',')})`);
  const n1 = await nodes();
  log(`오디오 노드 생성: ${n0}→${n1}, ready=${await page.evaluate(() => window.__app.MG.Audio.ready)}`);
  expect(n1 > n0, '음소거 해제 상태에서 오디오 노드 생성됨');
  expect(hitState && hitState.combo === 1 && (await txt('#hud-combo')) === '1 콤보', 'HUD 콤보 1');
  await shot('game-after-hit');

  // ---------- AC5: 오답 → 교정 카드 → 복수 몬스터 ----------
  const m3 = await waitFor(async () => { const g = await game(); return g.state === 'playing' ? g.monsters.find(x => !x.locked) || null : null; }, 6000);
  expect(!!m3, '세 번째 몬스터 등장');
  const wrongVal = String(Number(m3.answerText) + 1);
  const [wa, wb] = m3.key.split('×').map(Number);
  await sounds();
  await page.keyboard.type(wrongVal); await page.keyboard.press('Enter');
  await sleep(150);
  let g = await game();
  const snd3 = await sounds();
  expect(g.state === 'card' && g.combo === 0 && g.wrong === 1, `AC5 오답 → state=card·콤보 0 (${g.state}, combo=${g.combo})`);
  expect(snd3.includes('wrong'), `버저음 호출 (${snd3.join(',')})`);
  const cardQ = await txt('.card-modal .card-q');
  expect(cardQ === `${m3.text} = ?`, `AC5 교정 카드 문제 '${cardQ}'`);
  const rows = await page.locator('.card-modal .arr-row').count(), cols = await page.locator('.card-modal .arr-row').first().locator('i').count();
  expect(rows === wa && cols === wb, `AC5 점 배열 ${rows}행×${cols}열 (기대 ${wa}×${wb})`);
  expect((await page.getAttribute('.card-modal .card-pad', 'class')).includes('locked'), '카드 애니메이션 중 입력 잠금');
  const fireBox = await page.locator('.card-modal .key-fire').boundingBox(), modalBox = await page.locator('.card-modal').boundingBox();
  expect(fireBox && modalBox && fireBox.y + fireBox.height <= modalBox.y + modalBox.height + 1, `교정 카드 발사 버튼이 1280×800에서 모달 가시 영역 안 (버튼 하단 ${fireBox && Math.round(fireBox.y + fireBox.height)}px, 모달 하단 ${modalBox && Math.round(modalBox.y + modalBox.height)}px)`);
  await shot('card-array');
  await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class')).includes('locked'), 2500, 50);
  expect(!(await page.getAttribute('.card-modal .card-pad', 'class')).includes('locked'), '≤1.5초 후 카드 입력 활성');
  expect(await page.locator('.card-modal .key').count() === 12, '카드 안 같은 키패드 12키');
  // 카드에서 오답 → 닫히지 않음
  await page.keyboard.type(wrongVal); await page.keyboard.press('Enter'); await sleep(100);
  expect(await page.locator('.card-modal').count() === 1 && (await page.getAttribute('.card-modal .card-pad', 'class')).includes('shake'), '카드에서 오답 → 흔들림, 유지');
  await page.keyboard.press('Escape'); await sleep(50);
  expect(await page.locator('.card-modal').count() === 1, 'Esc로 교정 카드가 닫히지 않음(정답 필수)');
  // 카드 키패드 버튼으로 정답 입력
  for (const d of m3.answerText) await page.click(`.card-modal .key[data-k="${d}"]`);
  const scoreBeforeCard = (await game()).score;
  await page.click('.card-modal .key-fire'); await sleep(80);
  g = await game();
  expect(await page.locator('.card-modal').count() === 0 && g.state === 'resume', `정답 입력 → 카드 닫힘·재개 카운트 (${g.state})`);
  expect(!g.monsters.some(x => x.id === m3.id) && g.score === scoreBeforeCard, '카드 대상 몬스터 점수 없이 제거');
  const resumed = await waitFor(async () => (await game()).state === 'playing', 1500, 30);
  expect(resumed, '0.5초 뒤 playing 재개');
  // 복수 몬스터: 이후 2~4번째 스폰 안에 같은 key·isRevenge
  const seen = new Set((await game()).monsters.map(x => x.id)); let spawnNo = 0, revenge = null, revengeAt = null;
  const tEnd = Date.now() + 40000;
  while (Date.now() < tEnd && !revenge) {
    g = await game(); if (!g || g.state === 'ended') break;
    for (const m of g.monsters) if (!seen.has(m.id)) { seen.add(m.id); spawnNo++; if (m.isRevenge) { revenge = m; revengeAt = spawnNo; } }
    if (revenge) break;
    const tgt = g.state === 'playing' ? g.monsters.find(x => !x.locked && !x.isRevenge) : null;
    if (tgt) { await page.evaluate(a => window.__app.actions.fire(a), tgt.answerText); await sleep(250); } else await sleep(60);
  }
  log(`복수 몬스터: ${JSON.stringify(revenge)} at spawn #${revengeAt}, queue=${JSON.stringify(g && g.revengeQueue)}`);
  expect(!!revenge && revenge.key === m3.key, `AC5 복수 몬스터 같은 문제 '${m3.key}' 재등장`);
  expect(revengeAt >= 2 && revengeAt <= 4, `AC5 복수 몬스터가 2~4번째 스폰에 등장 (실제 ${revengeAt}번째)`);
  await shot('game-revenge');
  if (revenge) {
    // 다른 포탄이 비행 중이면 콤보가 바뀌므로 모든 몬스터가 미조준 상태일 때까지 대기
    const gb = await waitFor(async () => { const g = await game(); return g.state === 'playing' && g.monsters.some(x => x.id === revenge.id && !x.locked) && !g.monsters.some(x => x.locked) ? g : null; }, 3000, 30);
    const cb = gb ? gb.combo : 0, sb = gb ? gb.score : 0;
    await sounds();
    await page.evaluate(a => window.__app.actions.fire(a), revenge.answerText);
    let rf = null, ga = null;
    for (let i = 0; i < 30; i++) { const g2 = await game(); const f = g2.floats.find(x => x.includes('복수')); if (f) rf = f; if (!g2.monsters.some(x => x.id === revenge.id)) { ga = g2; if (rf) break; } await sleep(25); }
    const exp = 2 * (100 * comboMult(cb) + 50);
    const diff = ga ? ga.score - sb : -1, waveBonus = gb ? 100 * gb.wave : 0; // 웨이브 마지막 몬스터면 '웨이브 클리어' 보너스가 함께 합산됨
    expect(diff === exp || diff === exp + waveBonus, `AC5 복수 몬스터 격파 점수 2배 (+${diff}, 기대 ${exp}${diff === exp + waveBonus ? ' + 웨이브 클리어 ' + waveBonus : ''})`);
    expect(rf && rf.startsWith(`+${exp}`) && rf.includes('복수!'), `복수 플로팅 텍스트 '${rf}'`);
    const sndR = await sounds(); expect(sndR.includes('revenge'), `복수 전용 효과음 (${sndR.join(',')})`);
  }

  // ---------- AC6: 콤보 5 → ×2, 10 → ×3 + 필살기 ----------
  let comboHit = null;
  for (let i = 0; i < 25; i++) {
    const r = await killNext(10000); if (!r || !r.after) break;
    const c = r.after.combo;
    if (c === 5) { expect((await txt('#hud-combo')) === '×2 COMBO!' && (await page.getAttribute('#hud-combo', 'class')).includes('hot'), `AC6 콤보 5 → HUD '×2 COMBO!' (${await txt('#hud-combo')})`); await shot('game-combo5'); }
    if (c === 6) { const got = r.after.score - r.before.score; expect(got === 250, `AC6 ×2 배율 격파 점수 200+50 (실제 ${got})`); expect(r.after.floats.some(f => f === '+250 ×2'), `플로팅 '+250 ×2' (${r.after.floats.join('|')})`); }
    if (c === 10) { comboHit = r.after; break; }
  }
  g = await game();
  expect(!!comboHit && comboHit.superGauge === 1, `AC6 콤보 10 → 필살기 게이지 1칸 (combo=${g.combo}, gauge=${g.superGauge})`);
  expect((await txt('#hud-combo')) === '×3 COMBO!', `AC6 콤보 10 → '×3 COMBO!' (${await txt('#hud-combo')})`);
  expect(await page.locator('#hud-gauge i.on').count() === 1 && !(await page.locator('#super-btn').isDisabled()), 'HUD 게이지 1칸 점등·필살기 버튼 활성');
  const sndC = await sounds(); expect(sndC.includes('combo'), `콤보 상승음 호출 (${[...new Set(sndC)].join(',')})`);
  await shot('game-combo10');
  // Space 필살기: 몬스터가 있을 때
  const live = await waitFor(async () => { const g = await game(); return g.state === 'playing' && g.monsters.length ? g : null; }, 8000, 50);
  expect(!!live, '필살기 전 몬스터 존재');
  await sounds();
  const sBefore = live ? live.score : 0, nLive = live ? live.monsters.length : 0;
  await page.keyboard.press('Space'); await sleep(120);
  g = await game();
  const sndS = await sounds();
  expect(g.monsters.length === 0 && g.superGauge === 0, `AC6 Space 필살기 → 몬스터 ${nLive}→${g.monsters.length}, 게이지 0`);
  expect(g.score - sBefore === 100 * nLive && g.floats.filter(f => f === '+100').length >= 1, `필살기 격파 100점씩 (+${g.score - sBefore})`);
  expect(sndS.includes('superSkill') && g.combo === 10, `필살기 효과음·콤보 유지(${g.combo})`);
  expect(await page.locator('#super-btn').isDisabled(), '게이지 0 → 필살기 버튼 비활성');
  expect(await page.evaluate(() => window.scrollY) === 0, 'Space로 페이지 스크롤 안 됨');

  // ---------- 일시정지: Esc·모달·탭 숨김 ----------
  await page.keyboard.press('Escape'); await sleep(100);
  g = await game();
  expect(g.state === 'paused' && (await txt('.modal')).includes('일시정지'), 'Esc → 일시정지 모달');
  const btns = await page.locator('.modal .modal-actions button').allInnerTexts();
  expect(btns.includes('계속하기') && btns.includes('그만하기'), `일시정지 버튼 ${btns.join('/')}`);
  const e1 = g.elapsedMs; await sleep(400);
  expect((await game()).elapsedMs === e1, '일시정지 중 게임 시간 정지');
  await page.keyboard.press('Escape'); await sleep(50);
  expect(await page.locator('.modal').count() === 1, 'Esc로 일시정지 모달이 닫히지 않음(명시적 선택)');
  await page.keyboard.type('77'); await sleep(50);
  const hiddenInput = await txt('#input-panel .input-display');
  expect(hiddenInput === '?', `일시정지 모달 중 숫자키가 게임 입력창에 쌓이지 않음 (입력창 '${hiddenInput}')`);
  for (let i = 0; i < 2; i++) await page.keyboard.press('Backspace');
  await page.click('.modal [data-m="resume"]'); await sleep(100);
  expect((await game()).state === 'playing' && await page.locator('.modal').count() === 0, '계속하기 → 재개');
  // visibilitychange 자동 일시정지
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(100);
  expect((await game()).state === 'paused' && (await txt('.modal')).includes('일시정지'), '탭 숨김 → 자동 일시정지 모달');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); });
  // HUD 일시정지 버튼은 모달 열린 상태에서 중복 안 됨
  await page.click('.modal [data-m="resume"]'); await sleep(50);
  await page.click('.hud [data-action="pause"]'); await sleep(100);
  expect((await game()).state === 'paused' && await page.locator('.modal').count() === 1, 'HUD 일시정지 버튼 동작');
  // 그만하기 → 중단 결과
  const recBefore = await page.evaluate(() => { const p = window.__app.MG.current(); const r = p.stageRecords['s2-3']; return { plays: r.plays, hist: p.history.length, best: r.bestScore }; });
  const finalScore = (await game()).score;
  await page.click('.modal [data-m="quit"]');
  await waitFor(async () => (await st()).view === 'result', 3000, 50);
  s = await st();
  expect(s.view === 'result' && (await txt('.result-head h2')).includes('중단'), `그만하기 → 결과 화면 '중단' (${await txt('.result-head h2')})`);
  await sleep(1300);
  expect(await page.locator('#result-stars .got').count() === 0, '중단 결과 별 0개');
  expect((await txt('#result-score')).replace(/,/g, '') === String(finalScore), `결과 점수 카운트업 완료 ${await txt('#result-score')}`);
  const recAfter = await page.evaluate(() => { const p = window.__app.MG.current(); const r = p.stageRecords['s2-3']; return { plays: r.plays, hist: p.history.length, ended: p.history[0].endedBy, best: r.bestScore, saved: !!localStorage.getItem('mathGuardians.v1') }; });
  expect(recAfter.plays === recBefore.plays + 1 && recAfter.ended === 'quit' && recAfter.hist === recBefore.hist + 1, `중단 판 기록: plays ${recBefore.plays}→${recAfter.plays}, history endedBy=${recAfter.ended}`);
  const wrongCards = await page.locator('.wrong-card').allInnerTexts();
  log('틀린 문제 카드: ' + JSON.stringify(wrongCards.map(x => x.replace(/\s+/g, ' '))));
  expect(wrongCards.length === 2 && wrongCards.some(c => c.includes(m3.text) && c.includes('복수')) && wrongCards.some(c => c.includes(m1.text) && c.includes('미응답')), '틀린 문제 카드: 오답(복수 태그)·미응답 태그');
  const statTexts = await page.locator('.stat').allInnerTexts();
  expect(statTexts.some(x => x.includes('정답률')) && statTexts.some(x => x.includes('최대 콤보') && x.includes('10')) && statTexts.some(x => x.includes('복수 격파') && x.includes('1')), `통계 카드 ${statTexts.map(x => x.replace(/\s+/g, ' ')).join(' | ')}`);
  expect(await page.locator('#result-view [data-action="review"]').count() === 1 && await page.locator('#result-view [data-action="start-stage"][data-stage="s2-3"]').count() === 1, "'다시 풀기'·'다시 도전' 버튼");
  expect(await page.evaluate(() => sessionStorage.getItem('mathGuardians.inGame')) === null, '판 종료 후 세션 플래그 해제');
  await shot('result-quit');
  // 다시 풀기(복습): 2문제
  await page.click('[data-action="review"]'); await sleep(100);
  expect((await txt('.modal-title')).includes('다시 풀기 1/2'), `복습 모달 제목 '${await txt('.modal-title')}'`);
  for (let i = 0; i < 2; i++) {
    await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class') || '').includes('locked'), 2500, 50);
    const q = (await txt('.card-modal .card-q')).replace(' = ?', '');
    const ans = await page.evaluate(q => { const MG = window.__app.MG; const [a, b] = q.split(' × ').map(Number); return String(a * b); }, q);
    await page.keyboard.type(ans); await page.keyboard.press('Enter'); await sleep(150);
  }
  const tR = await toastTexts();
  expect(await page.locator('.card-modal').count() === 0 && tR.some(x => x.includes('복습 완료 2/2')), `복습 완료 토스트 (${JSON.stringify(tR)})`);
  const boxAfter = await page.evaluate(k => window.__app.MG.current().facts[k].box, m3.key);
  expect(boxAfter === 2, `복습 후 오답 사실 상자 +1 (복수 격파 1 → 복습 2, 실제 ${boxAfter})`);
  expect((await page.locator(`.wrong-card[data-key="${m3.key}"] .box-state`).innerText()).includes('2/3'), '결과 카드 상자 표시 갱신');
  // '다시 도전' → 같은 스테이지 재시작, '스테이지 맵' → 홈
  await page.click('#result-view [data-action="start-stage"][data-stage="s2-3"]'); await sleep(200);
  s = await st(); expect(s.view === 'game' && s.game.stage === 's2-3' && s.game.score === 0, "'다시 도전' → 2-3 새 판 시작");
  await page.evaluate(() => window.__app.actions.quit()); await waitFor(async () => (await st()).view === 'result', 3000, 50);
  await page.click('#result-view [data-action="nav"][data-view="home"]');
  expect((await st()).view === 'home', "'스테이지 맵' → 홈");

  // ---------- AC14(2)+AC12: 이도윤으로 오답→중단→다시 풀기→도감 주황 / 음소거 ----------
  await page.click('#main-tabs [data-action="nav"][data-view="home"]');
  const doyunId = (await st()).profiles.find(p => p.name === '이도윤').id;
  await page.click('#profile-btn'); await page.click(`#profile-menu li[data-pid="${doyunId}"]`);
  expect((await st()).current === '이도윤', '이도윤 선택');
  await page.click('[data-action="grade-tab"][data-grade="2"]');
  await page.click('.stage-card[data-stage="s2-3"] .start-btn');
  // HUD 스피커로 음소거
  await page.click('.hud [data-action="toggle-mute"]'); await sleep(50);
  s = await st();
  expect(s.muted && s.settings.muted && (await page.locator('.hud [data-action="toggle-mute"]').innerText()) === '🔇', 'AC12 HUD 스피커 → 음소거');
  const nm0 = await nodes();
  const k1 = await killNext(8000);
  expect(!!(k1 && k1.after), '음소거 상태에서 격파');
  await sleep(100);
  const nm1 = await nodes();
  expect(nm1 === nm0, `AC12 음소거 중 오디오 노드 생성 없음 (${nm0}→${nm1})`);
  await page.click('.hud [data-action="toggle-mute"]'); await sleep(50);
  expect(!(await st()).muted, 'HUD 스피커 → 음소거 해제');
  // 오답 → 카드 → 즉시 중단
  const d1 = await waitFor(async () => { const g = await game(); return g.state === 'playing' ? g.monsters.find(x => !x.locked) || null : null; }, 8000);
  const boxBefore = await page.evaluate(k => { const f = window.__app.MG.current().facts[k]; return f ? f.box : null; }, d1.key);
  await page.keyboard.type(String(Number(d1.answerText) + 1)); await page.keyboard.press('Enter'); await sleep(100);
  expect((await game()).state === 'card', '이도윤 오답 → 카드');
  await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class')).includes('locked'), 2500, 50);
  await page.keyboard.type(d1.answerText); await page.keyboard.press('Enter');
  await waitFor(async () => (await game()).state === 'playing', 1500, 30);
  await page.click('.hud [data-action="pause"]'); await sleep(80);
  await page.click('.modal [data-m="quit"]');
  await waitFor(async () => (await st()).view === 'result', 3000, 50);
  const box0 = await page.evaluate(k => window.__app.MG.current().facts[k].box, d1.key);
  expect(box0 === 0 && (await page.locator(`.wrong-card[data-key="${d1.key}"] .box-state`).innerText()).includes('0/3'), `오답 사실 상자 0 (이전 ${boxBefore})`);
  await page.click('[data-action="review"]'); await sleep(100);
  await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class') || '').includes('locked'), 2500, 50);
  await page.keyboard.type(d1.answerText); await page.keyboard.press('Enter'); await sleep(150);
  const box1 = await page.evaluate(k => window.__app.MG.current().facts[k].box, d1.key);
  expect(box1 === 1 && (await toastTexts()).some(x => x.includes('복습 완료 1/1')), `AC14 다시 풀기 정답 → 상자 1 (실제 ${box1})`);
  await page.click('#main-tabs [data-action="nav"][data-view="codex"]');
  const cell = page.locator(`.hm-cell[data-key="${d1.key}"]`);
  const cellCls = await cell.getAttribute('class'), cellBg = await cell.evaluate(e => getComputedStyle(e).backgroundColor);
  expect(cellCls.includes('box-1') && cellBg === 'rgb(243, 147, 44)', `AC14 도감 칸 주황(box-1) (${cellCls}, ${cellBg})`);
  await shot('codex-after-review');
  // 음소거 저장·새로고침 유지
  await page.click('.toolbar [data-action="toggle-mute"]'); await sleep(400);
  await reload();
  s = await st();
  expect(s.muted === true && s.settings.muted === true && (await page.locator('.toolbar [data-action="toggle-mute"]').innerText()) === '🔇', 'AC12 새로고침 후 음소거 유지');
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  expect(await page.locator('[data-setting="muted"]').isChecked(), '설정의 음소거 체크박스 동기화');
  await page.click('.toolbar [data-action="toggle-mute"]'); await sleep(400);
  expect(!(await st()).muted, '음소거 해제');
};
