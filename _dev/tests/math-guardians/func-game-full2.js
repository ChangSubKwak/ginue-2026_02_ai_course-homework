// func-game-full2.js — 이도윤 2-3 풀런: 오답 3회(정답률 94%) → 별 2개, 약점 큐 출제, 복수 몬스터, 보스 방패 중 약점 문제, 최고 기록 갱신 리본, 다시 풀기 후 상자 (pw-run.js 모듈, 실시간 약 2분)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await st()).game;
  const txt = sel => page.locator(sel).first().innerText().catch(() => '');
  const waitFor = async (fn, timeout = 15000, every = 60) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) return null; await sleep(every); } };
  const facts = () => page.evaluate(() => { const f = window.__app.MG.current().facts; return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { box: v.box, hit: v.hit, miss: v.miss, stage: v.stageId }])); });
  const doyunId = (await st()).profiles.find(p => p.name === '이도윤').id;
  await page.evaluate(id => window.__app.actions.setActive(id), doyunId);
  const weakBefore = Object.entries(await facts()).filter(([k, v]) => v.stage === 's2-3' && v.box < 2 && v.miss >= 1).map(([k]) => k);
  log('이도윤 2-3 약점: ' + weakBefore.join(','));
  const recBefore = await page.evaluate(() => { const r = window.__app.MG.current().stageRecords['s2-3']; return { best: r.bestScore, stars: r.bestStars, plays: r.plays }; });
  await page.click('[data-action="grade-tab"][data-grade="2"]');
  await page.click('.stage-card[data-stage="s2-3"] .start-btn');
  const tStart = Date.now();
  const seen = new Set(); let wrongs = 0; const wrongKeys = []; let revengeSeen = 0, revengeKilled = 0, weakSpawns = 0, bossShields = [], g = await game(), cardModels = 0;
  while (g && g.state !== 'ended' && Date.now() - tStart < 330000) {
    for (const m of g.monsters) if (!seen.has(m.id)) { seen.add(m.id); if (m.isRevenge) revengeSeen++; else if (!m.isBoss && weakBefore.includes(m.key)) weakSpawns++; }
    if (g.state === 'card') {
      // 교정 카드: 점 배열 확인 후 정답 입력
      if (await page.locator('.card-modal .arr-row').count() > 0) cardModels++;
      await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class') || '').includes('locked'), 2500, 50);
      const q = (await txt('.card-modal .card-q')).replace(' = ?', ''); const [a, b] = q.split(' × ').map(Number);
      await page.keyboard.type(String(a * b)); await page.keyboard.press('Enter'); await sleep(120);
    } else if (g.state === 'playing') {
      const tgt = g.monsters.find(m => !m.locked);
      if (tgt) {
        if (tgt.isBoss && !bossShields.includes(tgt.key)) bossShields.push(tgt.key);
        // 웨이브 1~3에서 3번 일부러 오답(복수 몬스터 아닌 일반 몬스터)
        if (wrongs < 3 && !tgt.isBoss && !tgt.isRevenge && g.wave <= 3 && !wrongKeys.includes(tgt.key)) { wrongs++; wrongKeys.push(tgt.key); await page.evaluate(a => window.__app.actions.fire(a), String(Number(tgt.answerText) + 1)); await sleep(150); }
        else { if (tgt.isRevenge) revengeKilled++; await page.evaluate(a => window.__app.actions.fire(a), tgt.answerText); await sleep(230); }
      } else await sleep(70);
    } else await sleep(70);
    g = await game();
  }
  const total = Math.round((Date.now() - tStart) / 1000);
  log(`플레이 ${total}s, wrongKeys=${wrongKeys.join(',')}, revengeSeen=${revengeSeen}, revengeKilled=${revengeKilled}, weakSpawns=${weakSpawns}, bossShields=${bossShields.join(',')}, final=${JSON.stringify(g && { score: g.score, correct: g.correct, wrong: g.wrong, reached: g.reached, hp: g.hp })}`);
  expect(g && g.state === 'ended', `판 종료 ${total}s`);
  expect(g && g.wrong === 3 && g.reached === 0 && g.correct === 47, `정답 47·오답 3·미응답 0 (${g && g.correct}/${g && g.wrong}/${g && g.reached})`);
  expect(cardModels === 3, `교정 카드 3회 모두 점 배열 모델 (${cardModels})`);
  expect(revengeSeen === 3 && revengeKilled === 3, `복수 몬스터 3마리 등장·격파 (${revengeSeen}/${revengeKilled})`);
  expect(weakSpawns >= 1, `약점 큐 출제(기존 약점 문제 ${weakSpawns}회 등장)`);
  const weakNow = Object.entries(await facts()).filter(([k, v]) => v.stage === 's2-3').map(([k, v]) => k);
  expect(bossShields.length === 3 && bossShields.some(k => weakBefore.includes(k) || wrongKeys.includes(k)), `보스 방패 중 1개는 약점 큐 문제 (${bossShields.join(',')} vs 약점 ${[...weakBefore, ...wrongKeys].join(',')})`);
  await waitFor(async () => (await st()).view === 'result', 4000, 50);
  await sleep(2300);
  const stars = await page.locator('#result-stars .got.pop').count();
  expect((await txt('.result-head h2')).includes('클리어') && stars === 2, `AC7 정답률 94%(47/50) → 별 2개 (${stars})`);
  const finalScore = Number((await txt('#result-score')).replace(/,/g, ''));
  expect(finalScore === g.score, `결과 점수 = 종료 시 점수(무피해 보너스 포함) (${finalScore})`);
  expect(await page.locator('.ribbon').count() === 1 && finalScore > recBefore.best, `최고 기록 갱신 리본 (${recBefore.best}→${finalScore})`);
  const stats = (await page.locator('.stat').allInnerTexts()).map(x => x.replace(/\s+/g, ' '));
  expect(stats.some(x => x.includes('정답률 94%')) && stats.some(x => x.includes('복수 격파 3')), `통계 ${stats.join(' | ')}`);
  const cards = await page.locator('.wrong-card').allInnerTexts();
  expect(cards.length === 3 && cards.every(c => c.includes('복수')) && wrongKeys.every(k => cards.some(c => c.includes(k.replace('×', ' × ')))), `틀린 문제 카드 3개(복수 표시) ${cards.map(c => c.replace(/\s+/g, ' ')).join(' | ')}`);
  const boxes = await page.evaluate(ks => ks.map(k => window.__app.MG.current().facts[k].box), wrongKeys);
  // 오답으로 0이 된 뒤 복수 격파 +1, 이후 약점 큐로 다시 출제·격파되면 더 오를 수 있음(≥1)
  expect(boxes.every(b => b >= 1 && b <= 3), `오답 사실 상자: 오답 0 → 복수 격파 +1 이상 (${boxes.join(',')}; 약점 큐 재출제 ${weakSpawns}회)`);
  const shownBoxes = await Promise.all(wrongKeys.map(k => page.locator(`.wrong-card[data-key="${k}"] .box-state`).innerText()));
  expect(shownBoxes.every((t, i) => t.includes(`${boxes[i]}/3`)), `결과 카드 상자 표시 = 실제 상자 (${shownBoxes.map(t => t.replace(/\s+/g, ' ')).join(' | ')})`);
  await shot('result-doyun-2stars');
  const rec = await page.evaluate(() => { const p = window.__app.MG.current(); const r = p.stageRecords['s2-3']; return { best: r.bestScore, stars: r.bestStars, plays: r.plays, wrong: r.wrong, hist: p.history.length, h0: p.history[0] }; });
  expect(rec.best === finalScore && rec.stars === 2 && rec.plays === recBefore.plays + 1 && rec.h0.wrongKeys.length === 3 && rec.h0.endedBy === 'clear', `이도윤 2-3 기록 갱신 ${JSON.stringify({ best: rec.best, stars: rec.stars, plays: rec.plays })}`);
  // 다시 풀기 → 상자 2
  await page.click('[data-action="review"]');
  for (let i = 0; i < 3; i++) {
    await waitFor(async () => (await page.locator('.card-modal').count()) === 1 && !(await page.getAttribute('.card-modal .card-pad', 'class') || '').includes('locked'), 3000, 50);
    const q = (await txt('.card-modal .card-q')).replace(' = ?', ''); const [a, b] = q.split(' × ').map(Number);
    await page.keyboard.type(String(a * b)); await page.keyboard.press('Enter'); await sleep(150);
  }
  const boxes2 = await page.evaluate(ks => ks.map(k => window.__app.MG.current().facts[k].box), wrongKeys);
  expect(boxes2.every((b, i) => b === Math.min(3, boxes[i] + 1)) && (await page.locator('#toast-root .toast').allInnerTexts()).some(t => t.includes('복습 완료 3/3')), `복습 후 상자 +1(최대 3) (${boxes.join(',')} → ${boxes2.join(',')})`);
  await sleep(400); await reload();
  const persisted = await page.evaluate(ks => ks.map(k => window.__app.MG.current().facts[k].box), wrongKeys);
  expect(JSON.stringify(persisted) === JSON.stringify(boxes2), `복습 결과 저장 유지 (${persisted.join(',')})`);
  // 도감 히트맵에 반영
  await page.click('#main-tabs [data-action="nav"][data-view="codex"]');
  const cls = await Promise.all(wrongKeys.map(k => page.locator(`.hm-cell[data-key="${k}"]`).getAttribute('class')));
  expect(cls.every((c, i) => c.includes(`box-${boxes2[i]}`)), `도감 칸 색 = 상자 값 (${cls.join(' | ')})`);
};
