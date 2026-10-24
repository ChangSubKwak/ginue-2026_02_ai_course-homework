// fix-r2-verify.js — 2라운드 수정 검증: R-01 보스전 정답 발사 직후 필살기(조준 고착 없음·정답 점수 보존), R-02 긴 라벨 스폰 지연 상한(진행도 ≤0.35), R-03 가져오기 facts.p 거대 수 제한(멈춤 없음)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await state()).game;
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const waitGame = async (pred, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const g = await game(); if (g && pred(g)) return g; await sleep(100); } return game(); };
  const view = v => page.evaluate(x => window.__app.MG.UI.showView(x), v);
  await page.waitForSelector('#stage-grid .stage-card');

  // ---- R-03: 거대한 수가 든 facts.p 가져오기 → 즉시 처리되고 해당 사실만 제외, 정상 사실은 유지 ----
  const data = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.MG.root)));
  const p1 = data.profiles[1]; // 이도윤
  p1.facts['거대'] = { key: '거대', stageId: 's5-1', p: { op: 'gcd', a: 1e12, b: 6 }, box: 0, hit: 0, miss: 2, lastAt: null, masteredAt: null, answer: '6', question: '거대' };
  p1.facts['음수'] = { key: '음수', stageId: 's2-3', p: { op: 'mul', a: -3, b: 4 }, box: 0, hit: 0, miss: 1, lastAt: null, masteredAt: null, answer: '-12', question: '음수' };
  p1.facts['소수p'] = { key: '소수p', stageId: 's2-3', p: { op: 'mul', a: 2.5, b: 4 }, box: 0, hit: 0, miss: 1, lastAt: null, masteredAt: null, answer: '10', question: '소수p' };
  p1.facts['영나누기'] = { key: '영나누기', stageId: 's3-2', p: { op: 'div', a: 8, b: 0 }, box: 0, hit: 0, miss: 1, lastAt: null, masteredAt: null, answer: 'x', question: '영나누기' };
  p1.facts['정상gcd'] = { key: '정상gcd', stageId: 's5-1', p: { op: 'gcd', a: 9999, b: 6 }, box: 0, hit: 0, miss: 1, lastAt: null, masteredAt: null, answer: '3', question: '정상gcd' };
  const t0 = Date.now();
  await page.evaluate(t => { window.__app.actions.importJson(t); }, JSON.stringify(data));
  await sleep(200); await page.click('.modal [data-m="true"]'); await sleep(300);
  const importMs = Date.now() - t0;
  const facts = await page.evaluate(() => Object.keys(window.__app.MG.root.profiles[1].facts));
  log(`import ms=${importMs} facts=${facts.length} has 8×7=${facts.includes('8×7')} has 거대=${facts.includes('거대')}`);
  expect(importMs < 3000, `R-03 거대 수 가져오기가 멈추지 않음(${importMs}ms)`);
  expect(!facts.includes('거대') && !facts.includes('음수') && !facts.includes('소수p') && !facts.includes('영나누기'), 'R-03 범위 밖·비정수·분모 0 매개변수 사실 제외');
  expect(facts.includes('8×7') && facts.includes('정상gcd'), 'R-03 정상 사실(8×7·9999와 6의 최대공약수)은 유지');
  const divMs = await page.evaluate(() => { const t = performance.now(); const pr = window.__app.MG.Problems.build('s5-1', { op: 'gcd', a: 9999, b: 6 }); return { ms: performance.now() - t, sol: pr.solution, ans: pr.answer }; });
  log('divisors ' + JSON.stringify(divMs));
  expect(divMs.ms < 50 && divMs.ans === 3 && divMs.sol.includes('1,3,9,11,33,99,101,303,909,1111,3333,9999'), 'R-03 divisors √n 탐색 결과 정렬·정답 3');
  // 부팅(migrate)도 멈추지 않는지: 저장 후 새로고침
  await page.evaluate(() => window.__app.actions.flushSave());
  const t1 = Date.now(); await page.reload(); await page.waitForSelector('#stage-grid .stage-card'); log(`reload ms=${Date.now() - t1}`);
  expect(Date.now() - t1 < 5000, 'R-03 재부팅 즉시 완료');

  // ---- R-02: 5-1(긴 라벨) 웨이브 3에서 두 번째 몬스터는 첫 몬스터 진행도 ≤0.36에 스폰(데스크톱·400px) ----
  await act('setSetting', 'unlockAll', true); await act('setSetting', 'timeLimitMin', 0);
  const pacing = async (w, h) => {
    await page.setViewportSize({ width: w, height: h }); await view('home'); await sleep(150);
    await act('startStage', 's5-1'); await sleep(200);
    const tt = Date.now(); let g = null, sample = null;
    while (Date.now() - tt < 60000) {
      g = await game(); if (!g || g.state === 'ended') break;
      if (g.wave >= 3) {
        const ms = g.monsters.filter(m => m.progress > 0);
        if (ms.length >= 2) { sample = ms.map(m => [m.text, m.progress]).sort((a, b) => b[1] - a[1]); break; }
        if (ms.length && ms[0].progress > 0.6) { await act('fire', String(ms[0].answer)); }
        await sleep(60); continue;
      }
      if (g.state === 'playing') { const m = g.monsters.filter(x => !x.locked && x.progress > 0).sort((a, b) => b.progress - a.progress)[0]; if (m) { await act('fire', String(m.answer)); await sleep(230); continue; } }
      await sleep(100);
    }
    await shot(`r2-pacing-${w}`); log(`pacing ${w}px wave=${g && g.wave} sample=${JSON.stringify(sample)}`);
    await act('quit'); await sleep(600);
    return sample;
  };
  const d = await pacing(1280, 800);
  expect(d && d[0][1] >= 0.17 && d[0][1] <= 0.40, `R-02 데스크톱 5-1 웨이브 3 두 번째 스폰 시 첫 몬스터 진행도 ${d && d[0][1]} (0.18~0.35+샘플링 여유)`);
  const m = await pacing(400, 800);
  expect(m && m[0][1] >= 0.17 && m[0][1] <= 0.40, `R-02 400px 5-1 웨이브 3 두 번째 스폰 시 첫 몬스터 진행도 ${m && m[0][1]}`);
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---- R-01: 2-3을 보스까지 자동 진행 → 정답 발사 직후 필살기 → 방패 2개 감소·조준 고착 없음·다음 정답으로 계속 공격 ----
  await view('home'); await sleep(100);
  await act('setActive', 'p_sample01'); await act('startStage', 's2-3'); await sleep(200);
  const tb = Date.now(); let reachedBoss = false, g = null, superChecked = false;
  while (Date.now() - tb < 170000) {
    g = await game(); if (!g || g.state === 'ended') break;
    if (g.wave === 10 && g.monsters.some(x => x.isBoss)) { reachedBoss = true; break; }
    if (g.state === 'playing' && g.monsters.length) {
      const live = g.monsters.filter(x => !x.locked).sort((a, b) => b.progress - a.progress), tgt = live[0];
      // 웨이브 중반: 게이지가 있고 몬스터 2마리 이상이면 정답 발사 직후 필살기 → 비행 중 포탄 명중 처리(정답 점수) + 나머지 100점씩
      if (!superChecked && g.superGauge >= 1 && live.length >= 2 && g.wave < 10) {
        const sc = g.score, combo = g.combo, n = g.monsters.length, mult = combo < 5 ? 1 : combo < 10 ? 2 : combo < 20 ? 3 : 4;
        await page.evaluate(a => { window.__app.actions.fire(a); window.__app.actions.useSuper(); }, String(tgt.answer));
        await sleep(250); const g2 = await game();
        const gained = g2.score - sc, expectMin = 100 * mult + 100 * (n - 1), expectMax = 100 * mult + 50 + 100 * (n - 1) + 100 * g.wave; // +속도 보너스·웨이브 클리어 보너스 가능
        log(`wave super: monsters ${n}→${g2.monsters.length}, gained ${gained} (expect ${expectMin}~${expectMax}), combo ${combo}→${g2.combo}, gauge ${g.superGauge}→${g2.superGauge}, correct ${g.correct}→${g2.correct}`);
        expect(g2.monsters.length === 0 && gained >= expectMin && gained <= expectMax && g2.correct === g.correct + 1 && g2.combo === combo + 1, 'R-01 일반 웨이브: 정답 발사 직후 필살기 → 비행 중 포탄 명중 처리(정답 1·콤보 +1·점수 보존) + 나머지 전멸');
        superChecked = true; continue;
      }
      if (tgt) { await act('fire', String(tgt.answer)); await sleep(230); continue; }
    }
    await sleep(120);
  }
  g = await game(); log(`boss reach=${reachedBoss} wave=${g && g.wave} score=${g && g.score} hp=${g && g.hp} gauge=${g && g.superGauge} secs=${Math.round((Date.now() - tb) / 1000)}`);
  expect(reachedBoss, `보스 도달 wave=${g && g.wave}`);
  if (reachedBoss) {
    await waitGame(x => x.monsters.some(b => b.isBoss && b.progress > 0.02), 5000);
    let b = (await game()).monsters.find(x => x.isBoss);
    if ((await game()).superGauge <= 0) log('게이지 0 — 보스 필살기 시나리오를 위해 게이지가 필요함');
    expect((await game()).superGauge >= 1, `보스전 진입 시 필살기 게이지 ≥1 (${(await game()).superGauge})`);
    await page.evaluate(a => { window.__app.actions.fire(a); window.__app.actions.useSuper(); }, String(b.answer));
    await sleep(400);
    g = await game(); const b2 = g.monsters.find(x => x.isBoss);
    log('boss after fire+super ' + JSON.stringify({ shields: b2 && b2.shields, locked: b2 && b2.locked, state: g.state, score: g.score, floats: g.floats }));
    expect(g.state === 'ended' || (b2 && b2.shields === 1 && b2.locked === false), `R-01 정답 발사 직후 필살기 → 방패 3→1(명중+필살기), locked=false (shields=${b2 && b2.shields}, locked=${b2 && b2.locked}, state=${g.state})`);
    if (b2 && g.state === 'playing') {
      await act('fire', String(b2.answer)); await sleep(400); g = await game(); const b3 = g.monsters.find(x => x.isBoss);
      log('boss after next fire ' + JSON.stringify({ shields: b3 && b3.shields, locked: b3 && b3.locked, state: g.state }));
      expect(!b3 || g.state === 'ended', `R-01 남은 방패를 정답으로 깨고 클리어 (state=${g.state})`);
    }
    await sleep(1500);
    expect(await page.locator('#result-view:not([hidden])').count() === 1 || (await state()).view === 'result', '보스 클리어 → 결과 화면');
    await shot('r2-boss-result');
  }
};
