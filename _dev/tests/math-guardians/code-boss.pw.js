// code-boss.pw.js — 한수아로 1-2 전체 플레이: 필살기(Space)·적응형·보스 방패 3개(약점 1개)·클리어 별·다음 스테이지 해금·새로고침 유지
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const suaId = (await state()).profiles.find(p => p.name === '한수아').id;
  await act('setActive', suaId);
  await page.evaluate(() => { const p = window.__app.MG.current(); p.facts['9−4'] = { key: '9−4', stageId: 's1-2', p: { op: 'sub', a: 9, b: 4 }, box: 0, hit: 0, miss: 2, lastAt: new Date().toISOString(), masteredAt: null, answer: '5', question: '9 − 4' }; });
  await page.click('#grade-tabs [data-grade="1"]'); await sleep(100);
  const cls13 = await page.locator('.stage-card[data-stage="s1-3"]').getAttribute('class');
  const best12 = await page.locator('.stage-card[data-stage="s1-2"] .best').textContent();
  log(`before: 1-3 class="${cls13}", 1-2 best="${best12}"`);
  expect(/locked/.test(cls13), '시작 전 1-3 카드 잠김(한수아)');
  await act('startStage', 's1-2');
  const t0 = Date.now(); let superUsed = false, bossSeen = false, adaptUp = false, lastWave = 0, kills = 0, bossKeys = new Set(), maxShields = 0, gauge10 = false, injected = false, prevScore = 0, prevCombo = 0;
  while (Date.now() - t0 < 330000) {
    const g = (await state()).game;
    if (!g || g.state === 'ended') break;
    if (g.state === 'card') { log('unexpected card state'); break; }
    if (g.wave !== lastWave) { lastWave = g.wave; log(`wave ${g.wave} @${Math.round(g.elapsedMs)}ms score=${g.score} combo=${g.combo} adaptive=${g.adaptive} hp=${g.hp}`); }
    if (g.wave === 9 && !injected) { injected = true; await page.evaluate(() => { const p = window.__app.MG.current(); p.facts['8−3'] = { key: '8−3', stageId: 's1-2', p: { op: 'sub', a: 8, b: 3 }, box: 0, hit: 0, miss: 1, lastAt: new Date().toISOString(), masteredAt: null, answer: '5', question: '8 − 3' }; }); log('injected weak fact 8−3 at wave 9'); }
    prevScore = g.score; prevCombo = g.combo;
    if (g.adaptive > 1) adaptUp = true;
    if (g.combo === 10 && g.superGauge >= 1) gauge10 = true;
    if (g.wave === 10) { const b = g.monsters.find(m => m.isBoss); if (b) { bossKeys.add(b.key); maxShields = Math.max(maxShields, b.shields); if (!bossSeen) { bossSeen = true; log(`boss: shields=${b.shields} key=${b.key} progress=${b.progress}`); await sleep(1200); await shot('code-boss'); } } }
    if (!superUsed && g.superGauge >= 1 && g.wave < 10 && g.monsters.length >= 2) {
      const n = g.monsters.length, sc = g.score, cb = g.combo;
      await page.keyboard.press('Space'); await sleep(120);
      const g2 = (await state()).game;
      log(`Space super: monsters ${n}→${g2.monsters.length}, score +${g2.score - sc}, gauge ${g.superGauge}→${g2.superGauge}, combo ${cb}→${g2.combo}, floats=${JSON.stringify(g2.floats)}`);
      expect(g2.monsters.length === 0 && g2.score - sc === 100 * n && g2.combo === cb && g2.superGauge === g.superGauge - 1, 'Space 필살기: 화면의 몬스터 전부 격파(100점씩), 콤보 유지, 게이지 -1');
      superUsed = true; continue;
    }
    const alive = g.monsters.filter(m => g.elapsedMs >= m.spawnedAt && !m.locked);
    if (!alive.length) { await sleep(100); continue; }
    const m = alive.sort((a, b) => b.progress - a.progress)[0];
    await act('fire', m.answerText); kills++; await sleep(230);
  }
  const gEnd = (await state()).game;
  log(`loop end: state=${gEnd && gEnd.state} wave=${gEnd && gEnd.wave} score=${gEnd && gEnd.score} kills=${kills} correct=${gEnd && gEnd.correct} wrong=${gEnd && gEnd.wrong} reached=${gEnd && gEnd.reached} adaptive=${gEnd && gEnd.adaptive} elapsed=${Math.round(Date.now() - t0)}ms`);
  log(`boss keys seen: ${[...bossKeys].join(' | ')} maxShields=${maxShields}`);
  expect(gauge10, '콤보 10에서 필살기 게이지 1칸 충전');
  expect(adaptUp, '빠른 정답 지속 시 적응형 속도 배수 상승(>1.0)');
  expect(bossSeen && maxShields === 3, '10웨이브 보스 등장, 방패 3개');
  expect(bossKeys.has('8−3') || bossKeys.has('9−4'), '보스 방패 1개는 약점 큐 사실(8−3 또는 9−4)에서 출제');
  expect(gEnd && gEnd.state === 'ended', '보스 격파 후 판 종료');
  const mult = prevCombo < 5 ? 1 : prevCombo < 10 ? 2 : prevCombo < 20 ? 3 : 4;
  log(`final kill: score ${prevScore}→${gEnd && gEnd.score} (combo ${prevCombo}, mult ${mult}; expected boss 500×${mult} + 무피해 1000 = ${500 * mult + 1000})`);
  expect(gEnd && gEnd.score - prevScore === 500 * mult + 1000, '보스 격파 500×배율 + 무피해 +1,000');
  await sleep(1300);
  const head = await page.locator('.result-head h2').textContent().catch(() => ''), got = await page.locator('.result-stars .got').count();
  await sleep(1200); const popped = await page.locator('.result-stars .got.pop').count();
  const scoreTxt = await page.locator('#result-score').textContent();
  const unlockTxt = (await page.locator('.unlock-list').textContent().catch(() => '')).replace(/\s+/g, ' ');
  const nextBtn = await page.locator('#result-view [data-action="start-stage"][data-stage="s1-3"]').count();
  log(`result: head="${head}" stars=${got} popped=${popped} score=${scoreTxt} unlocks="${unlockTxt}" nextBtn=${nextBtn}`);
  expect(head.includes('스테이지 클리어') && got === 3 && popped === 3, '클리어 결과: 별 3개 팝인(정답률 100%·무피해)');
  expect(/1-3/.test(unlockTxt) && nextBtn === 1, "'다음 스테이지 1-3 해금' 알림 + 다음 스테이지 버튼");
  expect(+scoreTxt.replace(/,/g, '') === gEnd.score, '결과 점수 카운트업이 최종 점수(무피해 +1,000 포함)와 일치');
  await shot('code-result-clear');
  await page.click('#result-view [data-action="start-stage"][data-stage="s1-3"]'); await sleep(600);
  const g13 = (await state()).game; log(`next stage started: ${g13 && g13.stage} state=${g13 && g13.state}`);
  expect(g13 && g13.stage === 's1-3' && g13.state === 'playing', '다음 스테이지 버튼 → 1-3 시작');
  await act('quit'); await sleep(900); await act('showView', 'home'); await sleep(200);
  await page.click('#grade-tabs [data-grade="1"]'); await sleep(100);
  const cls13b = await page.locator('.stage-card[data-stage="s1-3"]').getAttribute('class'), best12b = await page.locator('.stage-card[data-stage="s1-2"] .best').textContent();
  log(`after: 1-3 class="${cls13b}" 1-2 best="${best12b}"`);
  expect(/open/.test(cls13b) && best12b !== best12, '스테이지 맵: 1-3 해금, 1-2 최고 점수 갱신');
  await reload(); await sleep(300);
  await page.click('#grade-tabs [data-grade="1"]'); await sleep(100);
  const cls13c = await page.locator('.stage-card[data-stage="s1-3"]').getAttribute('class'), best12c = await page.locator('.stage-card[data-stage="s1-2"] .best').textContent();
  const cur = (await state()).current;
  log(`after reload: current=${cur} 1-3 class="${cls13c}" 1-2 best="${best12c}"`);
  expect(cur === '한수아' && /open/.test(cls13c) && best12c === best12b, '새로고침 후에도 해금·최고 점수 유지');
  const sua = (await state()).profiles.find(p => p.id === suaId);
  log('한수아 badges after: ' + sua.badges.join(',') + ' stars=' + sua.stars);
  expect(sua.badges.includes('combo10') && sua.badges.includes('perfect'), '배지 combo10·perfect 획득');
};
