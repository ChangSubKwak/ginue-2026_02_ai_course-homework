// reverify-r2/reverify-wave.js — reverify.js에서 시나리오가 발동하지 않은 2건의 보완:
// (1) cleanP 과잉 거부 검사: 17개 생성기 × 30개(600개 상한 이하) 사실을 가져와 전부 보존되는지
// (2) 일반 웨이브에서 몬스터 2마리를 일부러 기다린 뒤: 포탄 2발 동시 비행 → 둘 다 명중 / 정답 발사 80ms 뒤 필살기 → 정답 보존 + 전멸 + 게이지 -1
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await state()).game;
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  await page.waitForSelector('#stage-grid .stage-card');

  // ---- (1) cleanP: 600개 상한 이하의 정상 사실은 모두 통과 ----
  const data = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.MG.root)));
  const gen = await page.evaluate(() => { const P = window.__app.MG.Problems, out = {}; for (const st of window.__app.MG.STAGES) for (let i = 0; i < 30; i++) { const pr = P.generate(st.id); out[pr.key] = { key: pr.key, stageId: st.id, p: pr.p, box: 1, hit: 1, miss: 1, rtSum: 1000, lastAt: new Date().toISOString(), masteredAt: null, answer: pr.answerText, question: pr.text }; } return out; });
  const genN = Object.keys(gen).length; data.profiles[7].facts = gen;
  await page.evaluate(t => { window.__app.actions.importJson(t); }, JSON.stringify(data));
  await sleep(200); await page.click('.modal [data-m="true"]'); await sleep(300);
  const kept = await page.evaluate(() => Object.keys(window.__app.MG.root.profiles[7].facts).length);
  const byStage = await page.evaluate(() => { const o = {}; Object.values(window.__app.MG.root.profiles[7].facts).forEach(f => { o[f.stageId] = (o[f.stageId] || 0) + 1; }); return o; });
  log(`cleanP kept ${kept}/${genN} byStage=${JSON.stringify(byStage)}`);
  expect(kept === genN && genN <= 600 && Object.keys(byStage).length === 17, `R-03 17개 스테이지 생성기 사실 ${kept}/${genN} 모두 cleanP 통과(과잉 거부 없음)`);
  await act('resetSample'); await sleep(300);

  // ---- (2) 2-3 일반 웨이브 ----
  await act('setSetting', 'timeLimitMin', 0); await act('setActive', 'p_sample01'); await act('startStage', 's2-3'); await sleep(200);
  const t0 = Date.now(); let twoShotDone = false, waveSuperDone = false, g;
  while (Date.now() - t0 < 180000 && !(twoShotDone && waveSuperDone)) {
    g = await game(); if (!g || g.state === 'ended' || g.wave >= 10) break;
    if (g.state !== 'playing') { await sleep(100); continue; }
    const ms = g.monsters.filter(x => x.progress > 0), live = ms.filter(x => !x.locked).sort((a, b) => b.progress - a.progress);
    if (!live.length) { await sleep(80); continue; }
    const wantTwo = g.wave >= 3 && (!twoShotDone || (!waveSuperDone && g.superGauge >= 1));
    if (wantTwo && live.length < 2) { if (live[0].progress > 0.8) { await act('fire', String(live[0].answer)); } await sleep(80); continue; } // 2마리가 될 때까지 대기
    if (wantTwo && !twoShotDone && live.length >= 2 && live[0].answer !== live[1].answer) {
      const c0 = g.correct, w0 = g.wrong;
      await page.evaluate(([a, b]) => { window.__app.actions.fire(a); window.__app.actions.fire(b); }, [String(live[0].answer), String(live[1].answer)]);
      await sleep(40); const m2 = await game(); const lockedN = m2.monsters.filter(x => x.locked).length; await sleep(400); const g2 = await game();
      log(`two shots: locked ${lockedN}, correct ${c0}→${g2.correct}, wrong ${w0}→${g2.wrong}, monsters ${g2.monsters.length}`);
      expect(lockedN === 2 && g2.correct === c0 + 2 && g2.wrong === w0, 'isLocked: 서로 다른 몬스터에 포탄 2발 동시 비행 → 둘 다 명중·오답 없음');
      twoShotDone = true; continue;
    }
    if (wantTwo && twoShotDone && !waveSuperDone && g.superGauge >= 1 && live.length >= 2) {
      const sc = g.score, combo = g.combo, n = ms.length, mult = combo < 5 ? 1 : combo < 10 ? 2 : combo < 20 ? 3 : 4, c0 = g.correct;
      await act('fire', String(live[0].answer)); await sleep(80); await act('useSuper'); await sleep(300);
      const g2 = await game(); const gained = g2.score - sc;
      log(`wave super(80ms): monsters ${n}→${g2.monsters.length}, gained ${gained} (min ${100 * mult + 100 * (n - 1)}), combo ${combo}→${g2.combo}, gauge ${g.superGauge}→${g2.superGauge}, correct ${c0}→${g2.correct}, floats=${JSON.stringify(g2.floats)}`);
      expect(g2.monsters.length === 0 && g2.correct === c0 + 1 && g2.combo === combo + 1 && g2.superGauge === g.superGauge - 1 && gained >= 100 * mult + 100 * (n - 1), 'R-01 일반 웨이브: 정답 발사 80ms 뒤 필살기 → 정답 명중 보존(정답 +1·콤보 +1) + 나머지 전멸(+100씩) + 게이지 -1');
      await shot('wave-super-after'); waveSuperDone = true; continue;
    }
    if (wantTwo && live.length >= 2 && live[0].answer === live[1].answer) { await act('fire', String(live[0].answer)); await sleep(200); continue; }
    await act('fire', String(live[0].answer)); await sleep(200);
  }
  g = await game(); log(`end wave=${g && g.wave} gauge=${g && g.superGauge} correct=${g && g.correct} wrong=${g && g.wrong} twoShot=${twoShotDone} waveSuper=${waveSuperDone} secs=${Math.round((Date.now() - t0) / 1000)}`);
  expect(twoShotDone && waveSuperDone, `웨이브 중 시나리오 2건 수행(twoShot=${twoShotDone}, waveSuper=${waveSuperDone})`);
  await act('quit'); await sleep(500);
};
