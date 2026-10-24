// code-ui.pw.js — 의심 로직 재현(세로셈 모델·무몬스터 발사·PIN 잠금·가져오기 XSS·일시정지 키보드) + 수용 기준 일부 실측
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await state()).game;
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const waitMonster = async (ms = 10000) => { await page.waitForFunction(() => { const g = window.__app.getState().game; return g && g.state === 'playing' && g.monsters.length > 0; }, null, { timeout: ms }); const g = await game(); return g.monsters.slice().sort((a, b) => b.progress - a.progress)[0]; };
  const quitToHome = async () => { await act('quit'); await sleep(800); await act('showView', 'home'); await sleep(200); };
  const modalCount = () => page.locator('.modal-backdrop').count();

  // ---------- 1. 세로셈 시각 모델(A10): 받아올림 위치·연쇄 받아내림 ----------
  const col = await page.evaluate(() => {
    const MG = window.__app.MG; const div = document.createElement('div'); const out = {};
    const grab = () => ({ marks: [...div.querySelectorAll('tr.marks td')].map(td => td.textContent.trim()), top: [...div.querySelectorAll('tr:nth-child(2) td')].map(td => td.textContent.trim()), res: [...div.querySelectorAll('tr.res td')].map(td => td.textContent.trim()), html: div.innerHTML });
    MG.UI.renderHint(div, { model: 'column', data: { a: 47, b: 38, plus: true } }); out.add = grab();
    MG.UI.renderHint(div, { model: 'column', data: { a: 503, b: 178, plus: false } }); out.sub = grab();
    MG.UI.renderHint(div, { model: 'column', data: { a: 62, b: 27, plus: false } }); out.sub2 = grab();
    MG.UI.renderHint(div, { model: 'column', data: { a: 657, b: 268, plus: true } }); out.add3 = grab();
    return out;
  });
  log('47+38 marks(연산자,십,일)=' + JSON.stringify(col.add.marks) + ' digits=' + JSON.stringify(col.add.top));
  expect(col.add.marks[1] === '1' && col.add.marks[2] === '', '47+38: 받아올림 1이 십의 자리(윗자리) 위에 표시된다');
  log('657+268 marks=' + JSON.stringify(col.add3.marks) + ' res=' + JSON.stringify(col.add3.res));
  log('503−178 marks=' + JSON.stringify(col.sub.marks) + ' res=' + JSON.stringify(col.sub.res));
  expect(!col.sub.marks.some(m => m.includes('-1')), '503−178: 연쇄 받아내림에서 십의 자리 위에 "-1"이 표시되지 않는다');
  log('62−27 marks=' + JSON.stringify(col.sub2.marks) + ' res=' + JSON.stringify(col.sub2.res));

  // ---------- 2. 전체화면 대상에 입력 패널 포함 여부 ----------
  const fsContains = await page.evaluate(() => document.getElementById('stage-wrap').contains(document.getElementById('input-panel')));
  expect(fsContains, '전체화면 대상(#stage-wrap)이 입력 패널을 포함한다');

  // ---------- 3. 몬스터가 없는 순간(WAVE 배너 중) 발사 → 오답 집계? ----------
  await act('startStage', 's2-3'); await sleep(250);
  let g = await game(); log(`banner: t=${Math.round(g.elapsedMs)}ms monsters=${g.monsters.length} state=${g.state}`);
  await act('fire', '5'); await sleep(50);
  g = await game(); const mc = await modalCount();
  log(`no-monster fire → wrong=${g.wrong} combo=${g.combo} state=${g.state} modal=${mc}`);
  expect(!(g.wrong === 1 && mc === 0), '몬스터가 없을 때 발사하면 오답으로 집계되지 않는다(교정 카드 없이 wrong++ 금지)');

  // ---------- 4. 정답 격파 '+150' / 오답 카드 / 복수 몬스터 / 콤보 ×2 ----------
  let m = await waitMonster();
  log(`first monster key=${m.key} answer=${m.answerText} spawnedAt=${m.spawnedAt}`);
  let before = (await game()).score;
  await act('fire', m.answerText); await sleep(350);
  g = await game();
  log(`after hit: score ${before}→${g.score} floats=${JSON.stringify(g.floats)} correct=${g.correct}`);
  expect(g.score - before === 150 && g.floats.includes('+150'), '3초 이내 정답 격파 시 +150 표시·점수 가산');
  // 오답 → 교정 카드(점 배열)
  m = await waitMonster();
  await act('fire', '999'); await sleep(300);
  g = await game();
  const cardQ = await page.locator('.card-modal .card-q').textContent().catch(() => '');
  const arrRows = await page.locator('.card-modal .arr-row').count();
  log(`wrong → state=${g.state} combo=${g.combo} cardQ="${cardQ}" arrRows=${arrRows} revengeQueue=${JSON.stringify(g.revengeQueue)}`);
  expect(g.state === 'card' && cardQ.includes('= ?') && arrRows > 0, '오답 시 교정 카드(문제 + 점 배열)가 뜬다');
  expect(g.combo === 0, '오답 시 콤보 0');
  expect(g.revengeQueue.includes(m.key), '오답 사실이 복수 큐에 등록된다');
  await shot('code-card-array');
  // 카드에서 정답 입력(물리 키보드) → 닫힘 → 0.5초 후 재개
  await page.keyboard.type(m.answerText); await page.keyboard.press('Enter'); await sleep(150);
  g = await game(); const mc2 = await modalCount();
  log(`card solved → state=${g.state} modal=${mc2}`);
  expect(mc2 === 0 && g.state === 'resume', '정답 입력 시 카드가 닫히고 재개 카운트 상태');
  await sleep(600); g = await game(); expect(g.state === 'playing', '0.5초 후 playing 복귀');
  // 복수 몬스터가 나올 때까지 격파 반복(최대 12마리)
  let revengeSeen = null, comboHud = '', kills = 0, scoreAt5 = null;
  for (let i = 0; i < 18 && !(revengeSeen && comboHud); i++) {
    try { m = await waitMonster(12000); } catch (e) { log('waitMonster timeout at kill ' + i); break; }
    g = await game(); const rv = g.monsters.find(x => x.isRevenge);
    if (rv && !revengeSeen) {
      revengeSeen = rv; before = g.score; const comboBefore = g.combo;
      await act('fire', rv.answerText); await sleep(350); kills++;
      g = await game();
      const mult = comboBefore < 5 ? 1 : comboBefore < 10 ? 2 : comboBefore < 20 ? 3 : 4;
      log(`revenge kill (spawnIndex≈${kills + 3}): score +${g.score - before} (combo ${comboBefore}, mult ${mult}) floats=${JSON.stringify(g.floats)}`);
      expect(g.score - before === 2 * (100 * mult + 50) && g.floats.some(f => f.includes('복수!')), '복수 몬스터 격파 시 2배 점수 + 복수! 표시');
      await shot('code-revenge');
      if (g.combo === 5) comboHud = await page.locator('#hud-combo').textContent();
      continue;
    }
    before = g.score;
    await act('fire', m.answerText); await sleep(300); kills++;
    g = await game();
    if (g.combo === 5) { comboHud = await page.locator('#hud-combo').textContent(); scoreAt5 = g.score; }
    else if (g.combo === 6 && scoreAt5 != null) { log(`6th kill score delta = ${g.score - scoreAt5} floats=${JSON.stringify(g.floats)}`); expect(g.score - scoreAt5 >= 200 && g.floats.some(f => f.startsWith('+2') || f.startsWith('+3')), '콤보 5 이후 격파 점수 200(+보너스)'); }
  }
  log(`kills=${kills} comboHud@5="${comboHud}" revenge=${revengeSeen ? revengeSeen.key : 'none'} wave=${(await game()).wave}`);
  expect(comboHud.includes('×2 COMBO'), '5연속 정답 시 HUD "×2 COMBO!"');
  if (!revengeSeen) expect(false, '복수 몬스터가 2~4스폰 안에 등장');

  // ---------- 5. 일시정지 모달: 첫 포커스·Enter 키 ----------
  await act('pause'); await sleep(200);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim());
  log('pause modal first focus = ' + focused);
  await page.keyboard.press('Enter'); await sleep(200);
  g = await game(); const pm = await modalCount();
  log(`after Enter: state=${g.state} modal=${pm}`);
  expect(pm === 0, '일시정지 모달에서 Enter로 포커스된 버튼을 활성화할 수 있다');
  if (pm) { await page.click('.modal-backdrop [data-m="resume"]'); await sleep(100); }
  await quitToHome();

  // ---------- 6. 교사 PIN 잠금 → '샘플 데이터로 초기화' 접근 가능? ----------
  await act('setSetting', 'teacherPin', '1234'); await act('showView', 'settings'); await sleep(200);
  const gateVisible = await page.locator('#pin-gate').isVisible(), resetVisible = await page.locator('[data-action="reset-sample"]').isVisible();
  log(`PIN gate visible=${gateVisible}, reset button visible=${resetVisible}`);
  expect(gateVisible && resetVisible, "PIN 잠금 화면에서도 안내문대로 '샘플 데이터로 초기화' 버튼에 접근할 수 있다");
  await shot('code-pin-gate');
  await page.fill('#pin-gate-input', '1234'); await page.click('[data-action="pin-unlock"]'); await sleep(150);
  expect(await page.locator('#settings-body').isVisible(), 'PIN 입력 후 설정 본문 표시');
  await act('setSetting', 'teacherPin', null);

  // ---------- 7. JSON 가져오기: 이스케이프 누락(avatar/grade 속성) XSS ----------
  const crafted = await page.evaluate(() => { const r = JSON.parse(JSON.stringify(window.__app.MG.root)); r.profiles[1].avatar = '1"><img src=x onerror="window.__xss=(window.__xss||0)+1">'; r.profiles[2].grade = '5" autofocus onfocus="window.__xss2=1'; return JSON.stringify(r); });
  await page.evaluate(t => { window.__app.actions.importJson(t); }, crafted); await sleep(300);
  expect((await modalCount()) === 1, 'JSON 가져오기 확인 모달 표시');
  await page.click('.modal-backdrop [data-m="true"]'); await sleep(500);
  await act('showView', 'settings'); await sleep(400);
  const xss = await page.evaluate(() => ({ a: window.__xss || 0, b: window.__xss2 || 0, avatarCls: document.querySelector('#profile-menu li:nth-child(2) .avatar') && document.querySelector('#profile-menu li:nth-child(2) .avatar').outerHTML.slice(0, 120) }));
  log('xss probe: ' + JSON.stringify(xss));
  expect(!xss.a && !xss.b, '가져온 JSON의 avatar/grade 값이 innerHTML 속성에 이스케이프 없이 삽입되지 않는다(스크립트 실행 없음)');
  await act('resetSample'); await sleep(200);

  // ---------- 8. 잘못된 JSON(텍스트) 가져오기 → 실패 모달, 데이터 불변 ----------
  const beforeCount = (await state()).profiles.length;
  await page.evaluate(() => { window.__app.actions.importJson('hello world'); }); await sleep(200);
  const failTitle = await page.locator('.modal-title').textContent().catch(() => '');
  const failBody = await page.locator('.modal-body').textContent().catch(() => '');
  log(`invalid import → title="${failTitle}" body="${failBody.slice(0, 40)}"`);
  expect(failBody.includes('형식이 맞지 않는 파일입니다') && (await state()).profiles.length === beforeCount, "임의 텍스트 가져오기 → '형식이 맞지 않는 파일입니다' 모달, 데이터 불변");
  await page.click('.modal-backdrop [data-m="true"]'); await sleep(100);

  // ---------- 9. 명예의 전당: 2-3 순위·비공개 ----------
  await act('showView', 'hall'); await sleep(200);
  await page.click('[data-action="hall-tab"][data-tab="score"]'); await sleep(100);
  await page.selectOption('#hall-stage', 's2-3'); await sleep(200);
  let names = await page.locator('.rank-table tbody tr td:nth-child(2)').allTextContents();
  let vals = await page.locator('.rank-table tbody tr td:nth-child(4)').allTextContents();
  log('hall 2-3: ' + names.map((n, i) => n.trim() + ' ' + vals[i]).join(' / '));
  expect(names.slice(0, 3).map(n => n.trim().replace(/^.\s*/, '')).join() === '최민준,정하윤,김하늘' && vals[0].startsWith('28,400') && vals[1].startsWith('24,150') && vals[2].startsWith('19,800'), '명예의 전당 2-3: 최민준 28,400 / 정하윤 24,150 / 김하늘 19,800');
  await act('setSetting', 'rankingPublic', false); await act('showView', 'hall'); await sleep(200);
  const privRows = await page.locator('.rank-table tbody tr').count(), privNote = await page.locator('.note').textContent().catch(() => '');
  log(`ranking private: rows=${privRows} note="${privNote}"`);
  expect(privRows === 1 && /내 순위\s*3\/5/.test(privNote.replace(/\s+/g, ' ')), '랭킹 비공개: 내 행만 + 내 순위 3/5');
  await act('setSetting', 'rankingPublic', true);

  // ---------- 10. 도감: 이도윤 8×7 빨강 + 툴팁 ----------
  const doyunId = (await state()).profiles.find(p => p.name === '이도윤').id;
  await act('setActive', doyunId); await act('showView', 'codex'); await sleep(200);
  const cell = page.locator('.hm-cell[data-key="8×7"]');
  const cellCls = await cell.getAttribute('class'); await cell.click(); await sleep(100);
  const tip = await page.locator('#fact-tip').textContent();
  log(`8×7 cell class="${cellCls}" tip="${tip}"`);
  expect(cellCls.includes('box-0') && tip.includes('오답 3회'), '이도윤 8×7 칸 빨강(box-0) + 오답 3회 툴팁');
  expect(/반응/.test(tip), '칸 툴팁에 평균 반응시간이 포함된다(스펙)');
  await shot('code-codex-doyun');

  // ---------- 11. 음소거 유지 + 시간 제한 03:00 + 느리게 16초 ----------
  await page.click('.app-header [data-action="toggle-mute"]'); await sleep(400);
  await reload(); await sleep(300);
  const st = await state(); log(`after reload muted=${st.muted} settings.muted=${st.settings.muted} current=${st.current}`);
  expect(st.muted === true && st.settings.muted === true, '음소거 상태가 새로고침 후 유지');
  await act('setSetting', 'muted', false); await page.evaluate(() => window.__app.MG.UI.syncMute());
  await act('setSetting', 'speedPreset', 'slow'); await act('setSetting', 'timeLimitMin', 3);
  await act('startStage', 's1-1'); await sleep(300);
  const hudTime = await page.locator('#hud-time').textContent();
  log('hud time at start = ' + hudTime);
  expect(hudTime.includes('03:00'), '시간 제한 3분 → HUD 03:00');
  m = await waitMonster(); const spawnedAt = m.spawnedAt;
  await page.waitForFunction(() => window.__app.getState().game.hp < 3, null, { timeout: 25000 });
  g = await game(); const reachMs = g.elapsedMs - spawnedAt;
  log(`slow preset: reached after ${Math.round(reachMs)}ms (spawn ${spawnedAt}), hp=${g.hp}, reached=${g.reached}, combo=${g.combo}`);
  expect(Math.abs(reachMs - 16000) <= 1000, '느리게: 몬스터 성 도달 약 16초(±1초)');
  await quitToHome();
  await act('setSetting', 'speedPreset', 'fast'); await act('setSetting', 'timeLimitMin', 5);

  // ---------- 12. 게임 오버(빠르게 ≈9.2초×3) → 별 0, plays +1 ----------
  const haneulId = (await state()).profiles.find(p => p.name === '김하늘').id; await act('setActive', haneulId);
  const playsBefore = await page.evaluate(() => window.__app.MG.current().stageRecords['s1-1'].plays);
  await act('startStage', 's1-1');
  m = await waitMonster(); const t0 = m.spawnedAt;
  await page.waitForFunction(() => window.__app.getState().game.hp < 3, null, { timeout: 20000 });
  g = await game(); log(`fast preset: first reach after ${Math.round(g.elapsedMs - t0)}ms`);
  expect(Math.abs(g.elapsedMs - t0 - 12000 / 1.3) <= 1000, '빠르게: 도달 약 9.2초');
  await page.waitForFunction(() => { const g = window.__app.getState().game; return g.state === 'ended'; }, null, { timeout: 40000 });
  await sleep(700);
  const headTxt = await page.locator('.result-head h2').textContent(), starsGot = await page.locator('.result-stars .got').count();
  const playsAfter = await page.evaluate(() => window.__app.MG.current().stageRecords['s1-1'].plays);
  log(`gameover: head="${headTxt}" stars=${starsGot} plays ${playsBefore}→${playsAfter}`);
  expect(headTxt.includes('게임 오버') && starsGot === 0 && playsAfter === playsBefore + 1, '게임 오버 결과: 별 0, 플레이 수 +1');
  await shot('code-gameover');
  await act('setSetting', 'speedPreset', 'normal');

  // ---------- 13. choice3(4-2) 크로스헤어·선택지·키보드, decimal(4-3) '4.20' ----------
  await act('setSetting', 'unlockAll', true); await act('showView', 'home'); await sleep(100);
  await act('startStage', 's4-2'); m = await waitMonster(); await sleep(100);
  const choiceBtns = await page.locator('#input-panel .choice-btn').count();
  const choices = await page.locator('#input-panel .choice-btn').allTextContents();
  log(`4-2 choices=${JSON.stringify(choices)} correctIndex=${m.correctIndex} answer=${m.answerText}`);
  expect(choiceBtns === 3 && choices[m.correctIndex].endsWith(m.answerText), '4-2: 선택지 버튼 3개, 목표 몬스터의 선택지');
  before = (await game()).score; await page.keyboard.press(String(m.correctIndex + 1)); await sleep(350);
  g = await game(); expect(g.score > before, '키보드 1/2/3으로 정답 선택 → 격파');
  await shot('code-choice3');
  m = await waitMonster(); const wrongIdx = (m.correctIndex + 1) % 3;
  await act('choose', wrongIdx); await sleep(300);
  const fbars = await page.locator('.card-modal .fbar').count(), disabledChoice = await page.locator('.card-modal .choice-btn:disabled').count();
  log(`4-2 wrong choose → fbars=${fbars} disabled=${disabledChoice}`);
  expect(fbars > 0 && disabledChoice === 1, '3지선다 오선택 → 막대 모델 카드, 틀린 선택지 비활성');
  await page.locator(`.card-modal .choice-btn[data-i="${m.correctIndex}"]`).dispatchEvent('pointerdown'); await sleep(200);
  expect((await modalCount()) === 0, '카드에서 정답 선택 시 닫힘');
  await quitToHome();
  await act('startStage', 's4-3'); m = await waitMonster();
  const keyDot = await page.locator('#input-panel .key[data-k="."]').count();
  before = (await game()).score;
  const typed = m.answerText.includes('.') ? m.answerText + '0' : m.answerText + '.00';
  await act('fire', typed); await sleep(350); g = await game();
  log(`4-3 answer=${m.answerText} typed=${typed} score ${before}→${g.score} dotKey=${keyDot}`);
  expect(keyDot === 1 && g.score > before, "4-3: '.' 키 있음, '4.20' 형태 입력 정답 처리");
  await quitToHome();
  await act('setSetting', 'unlockAll', false);
  await act('flushSave');
  log('done');
};
