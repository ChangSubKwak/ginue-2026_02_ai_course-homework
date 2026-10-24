// func-game-full.js — 새 프로필로 1-1 전 웨이브 무결점 클리어(AC7·AC8): 웨이브 수·동시 상한·보스 방패 3·팡파르·별 3·무피해 +1000·배지·다음 스테이지 해금·새로고침 유지·적응형 ▲ (pw-run.js 모듈, 실시간 약 2분)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await st()).game;
  const txt = sel => page.locator(sel).first().innerText().catch(() => '');
  const waitFor = async (fn, timeout = 15000, every = 60) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) return null; await sleep(every); } };
  await page.evaluate(() => { const A = window.__app.MG.Audio, orig = A.play; window.__sounds = []; A.play = (n, a) => { window.__sounds.push(n); return orig(n, a); }; });
  const sounds = () => page.evaluate(() => window.__sounds.splice(0));
  const WAVE_COUNTS = [3, 4, 4, 5, 5, 6, 6, 7, 7];

  // 새 프로필 생성 → 1-1 시작
  await page.click('.toolbar [data-action="new-profile"]');
  await page.fill('#np-name', '풀런학생'); await page.fill('#np-number', '30'); await page.click('.modal [data-m="ok"]'); await sleep(150);
  let s = await st();
  expect(s.current === '풀런학생' && s.profiles.length === 25, '새 프로필 풀런학생 생성');
  await page.click('[data-action="grade-tab"][data-grade="1"]');
  expect((await page.locator('.stage-card[data-stage="s1-2"]').getAttribute('class')).includes('locked') && (await txt('.stage-card[data-stage="s1-1"] .best')).includes('—'), '시작 전: 1-2 잠금, 1-1 최고 점수 없음');
  await page.click('.stage-card[data-stage="s1-1"] .start-btn');
  const tStart = Date.now();

  // 자동 플레이: 살아 있는 미조준 몬스터를 즉시 격파, 웨이브별 스폰 수·동시 수 기록
  const seen = new Set(); const perWave = {}; const maxLive = {}; let adaptSeen = '', adaptMax = 1, bossSeen = null, bossShieldKeys = {}, waveBannerSeen = new Set(), combo20 = false, superUsed = false, lastWave = 0, waveClearFloat = 0, hudTimeSeen = '', lastShot = null;
  let g = await game();
  while (g && g.state !== 'ended' && Date.now() - tStart < 330000) {
    for (const m of g.monsters) if (!seen.has(m.id)) { seen.add(m.id); perWave[g.wave] = (perWave[g.wave] || 0) + 1; if (m.isBoss) { bossSeen = m; } }
    maxLive[g.wave] = Math.max(maxLive[g.wave] || 0, g.monsters.filter(m => !m.isBoss).length);
    if (g.wave !== lastWave) { lastWave = g.wave; waveBannerSeen.add(await txt('#hud-wave')); }
    if (g.floats.some(f => f.includes('웨이브 클리어'))) waveClearFloat++;
    if (g.combo >= 20) combo20 = true;
    if (g.adaptive > adaptMax) adaptMax = g.adaptive;
    const ad = await txt('#hud-adapt'); if (ad) adaptSeen = ad;
    if (g.state === 'playing') {
      const tgt = g.monsters.find(m => !m.locked);
      if (tgt) {
        if (tgt.isBoss) { bossShieldKeys[tgt.shields] = tgt.key; if (tgt.shields === 1) lastShot = { score: g.score, combo: g.combo }; }
        // 콤보 10 이후 필살기 1회 사용(일반 웨이브)
        if (!superUsed && g.superGauge >= 1 && !tgt.isBoss) { await page.keyboard.press('Space'); superUsed = true; await sleep(80); g = await game(); continue; }
        await page.evaluate(a => window.__app.actions.fire(a), tgt.answerText);
        await sleep(230);
      } else await sleep(70);
    } else await sleep(70);
    g = await game();
    if (g && g.wave === 10 && !hudTimeSeen) hudTimeSeen = await txt('#hud-time');
  }
  const total = Math.round((Date.now() - tStart) / 1000);
  log(`플레이 ${total}s, perWave=${JSON.stringify(perWave)}, maxLive=${JSON.stringify(maxLive)}, adaptMax=${adaptMax}, adaptSeen='${adaptSeen}', boss=${JSON.stringify(bossSeen)}, shields=${JSON.stringify(bossShieldKeys)}, banners=${[...waveBannerSeen].join('/')}`);
  expect(g && g.state === 'ended', `판 종료(ended) — ${total}s`);
  expect(JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9].map(w => perWave[w])) === JSON.stringify(WAVE_COUNTS), `웨이브 1~9 몬스터 수 ${JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9].map(w => perWave[w]))} = [3,4,4,5,5,6,6,7,7]`);
  expect(perWave[10] === 1 && bossSeen && bossSeen.isBoss && bossSeen.shields === 3, `AC7 10웨이브 보스 1마리·방패 3개 (${JSON.stringify(bossSeen)})`);
  const shieldList = [3, 2, 1].map(k => bossShieldKeys[k]);
  expect(shieldList.every(Boolean), `보스 방패 문제 3개 차례로 출제 (${shieldList.join(', ')})`);
  expect(new Set(shieldList).size === 3, `보스 방패 3개 문제가 서로 다름 (${shieldList.join(', ')})`);
  expect([1, 2].every(w => maxLive[w] <= 1) && [3, 4, 5, 6].every(w => maxLive[w] <= 2) && [7, 8, 9].every(w => maxLive[w] <= 3), `동시 출현 상한 준수 ${JSON.stringify(maxLive)}`);
  expect(waveBannerSeen.has('BOSS 10/10') && waveBannerSeen.has('WAVE 9/10'), `HUD 웨이브 표기 (${[...waveBannerSeen].slice(-3).join('/')})`);
  expect(combo20, '콤보 20 도달(×4 배율)');
  expect(superUsed, '필살기 1회 사용');
  expect(adaptMax > 1.0 && adaptSeen.includes('▲'), `적응형 난이도 상승·HUD ▲ 표시 (max ${adaptMax}, '${adaptSeen}')`);
  const snd = await sounds();
  expect(snd.includes('boss') && snd.includes('fanfare') && snd.filter(x => x === 'waveClear').length === 9, `보스 드럼·팡파르·웨이브 클리어 9회 효과음 (boss=${snd.filter(x => x === 'boss').length}, fanfare=${snd.filter(x => x === 'fanfare').length}, waveClear=${snd.filter(x => x === 'waveClear').length})`);
  expect(g && g.hp === 3 && g.wrong === 0 && g.reached === 0 && g.correct === 50, `무결점: HP 3·정답 50·오답 0·미응답 0 (correct=${g && g.correct}, wrong=${g && g.wrong}, reached=${g && g.reached})`);
  log(`종료 점수 ${g && g.score}, maxCombo? combo=${g && g.combo}`);

  // 결과 화면
  await waitFor(async () => (await st()).view === 'result', 4000, 50);
  expect((await txt('.result-head h2')).includes('스테이지 클리어'), `AC7 결과 헤더 '${await txt('.result-head h2')}'`);
  await sleep(2300);
  const gotStars = await page.locator('#result-stars .got.pop').count();
  expect(gotStars === 3, `AC7 정답률 100%·무피해 → 별 3개 팝인 (${gotStars})`);
  const finalScore = Number((await txt('#result-score')).replace(/,/g, ''));
  const bossPts = lastShot ? 500 * (lastShot.combo < 5 ? 1 : lastShot.combo < 10 ? 2 : lastShot.combo < 20 ? 3 : 4) : 0;
  expect(lastShot && finalScore === lastShot.score + bossPts + 1000 && finalScore === g.score, `보스 격파 500×배율(${bossPts}) + 무피해 클리어 +1,000 반영 (${lastShot && lastShot.score} → ${finalScore})`);
  const stats = (await page.locator('.stat').allInnerTexts()).map(x => x.replace(/\s+/g, ' '));
  expect(stats.some(x => x.includes('정답률 100%')) && stats.some(x => x.includes('문제 수 50')), `통계 ${stats.join(' | ')}`);
  expect((await txt('#result-view')).includes('틀린 문제 없음'), "'틀린 문제 없음! 완벽해요' 표시");
  const unlockList = await txt('.unlock-list');
  expect(unlockList.includes("'첫 격파'") && unlockList.includes("'콤보 10'") && unlockList.includes("'콤보 20'") && unlockList.includes("'철벽 수호'") && unlockList.includes('다음 스테이지 1-2'), `새 획득 알림: 배지 4종·다음 스테이지 해금 (${unlockList.replace(/\s+/g, ' ').slice(0, 160)})`);
  expect(await page.locator('.result-actions [data-action="start-stage"][data-stage="s1-2"]').count() === 1, "AC8 '다음 스테이지 ▶' 버튼 표시");
  const sndStar = await sounds(); expect(sndStar.filter(x => x === 'star').length === 3 && sndStar.includes('badge'), `별 팝인 효과음 3회·배지음 (${[...new Set(sndStar)].join(',')})`);
  await shot('result-clear-3stars');
  // 기록 확인
  const rec = await page.evaluate(() => { const p = window.__app.MG.current(); return { r: p.stageRecords['s1-1'], badges: p.badges.map(b => b.id), hist: p.history[0], dates: p.playDates, ct: p.counters }; });
  log('기록: ' + JSON.stringify(rec));
  expect(rec.r.bestScore === finalScore && rec.r.bestStars === 3 && rec.r.plays === 1 && rec.r.clears === 1 && rec.r.correct === 50 && rec.r.avgMs > 0, `스테이지 기록 갱신 (best ${rec.r.bestScore}, ★${rec.r.bestStars}, plays ${rec.r.plays}, avgMs ${rec.r.avgMs})`);
  expect(rec.hist.endedBy === 'clear' && rec.hist.stars === 3 && rec.dates.length === 1 && rec.ct.totalProblems === 50 && rec.ct.bossKills === 1 && rec.ct.threeStarClears === 1, 'history·playDates·counters 갱신');
  expect(['first_kill', 'combo10', 'combo20', 'perfect'].every(b => rec.badges.includes(b)) && rec.badges.length === 4, `배지 ${rec.badges.join(',')}`);
  // AC8: 다음 스테이지 버튼 → 1-2 시작됨(스테이지 맵이 아님)
  await page.click('.result-actions [data-action="start-stage"][data-stage="s1-2"]'); await sleep(300);
  s = await st();
  log(`다음 스테이지 버튼 후 view=${s.view}, stage=${s.game && s.game.stage}`);
  expect(s.view === 'game' && s.game.stage === 's1-2', `'다음 스테이지' 버튼 → 1-2 게임이 바로 시작 (view=${s.view})`);
  await page.evaluate(() => window.__app.actions.quit());
  await waitFor(async () => (await st()).view === 'result', 3000, 50);
  await page.click('[data-action="nav"][data-view="home"]');
  await page.click('[data-action="grade-tab"][data-grade="1"]');
  const c12 = page.locator('.stage-card[data-stage="s1-2"]'), c11 = page.locator('.stage-card[data-stage="s1-1"]');
  expect((await c12.getAttribute('class')).includes('open') && !(await c12.locator('.start-btn').isDisabled()), 'AC8 스테이지 맵에서 1-2 잠금 해제');
  expect((await txt('.stage-card[data-stage="s1-1"] .best')).includes(finalScore.toLocaleString('ko-KR')) && (await c11.locator('.stars').innerText()) === '★★★', `AC8 1-1 카드 최고 점수 ${await txt('.stage-card[data-stage="s1-1"] .best')}·별 3`);
  expect((await txt('#summary-card')).includes('총 별 3') && (await txt('#summary-card')).includes('배지 4'), '요약 카드 총 별 3·배지 4');
  await shot('home-after-clear');
  await reload();
  await page.click('[data-action="grade-tab"][data-grade="1"]');
  expect((await page.locator('.stage-card[data-stage="s1-2"]').getAttribute('class')).includes('open') && (await txt('.stage-card[data-stage="s1-1"] .best')).includes(finalScore.toLocaleString('ko-KR')), 'AC8 새로고침 후에도 해금·최고 점수 유지');
  s = await st();
  expect(s.current === '풀런학생' && s.profiles.find(p => p.name === '풀런학생').badges.length === 4, '새로고침 후 배지 유지');
  // 명예의 전당 1-1 점수 탭에 반영
  await page.click('#main-tabs [data-action="nav"][data-view="hall"]');
  await page.click('[data-action="hall-tab"][data-tab="score"]');
  expect(await page.locator('#hall-stage').inputValue() === 's1-2' || await page.locator('#hall-stage').inputValue() === 's1-1', `점수 탭 기본 스테이지 = 최근 플레이 (${await page.locator('#hall-stage').inputValue()})`);
  await page.selectOption('#hall-stage', 's1-1');
  const rows = (await page.locator('.rank-table tbody tr').allInnerTexts()).map(r => r.replace(/\s+/g, ' '));
  expect(rows[0].includes('풀런학생') && rows[0].includes(finalScore.toLocaleString('ko-KR')) && (await page.locator('.rank-table tr.me.rank-1').count()) === 1, `1-1 랭킹 1위 풀런학생 ${finalScore} (${rows[0]})`);
  // 오늘의 기록표에 오늘 판 포함
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('[data-action="print-today"]');
  const pr = await page.locator('#print-root').innerText();
  expect(pr.includes('풀런학생') && pr.includes('1-1') && pr.includes('100%'), `오늘의 기록표에 오늘 판 포함 (${pr.replace(/\s+/g, ' ').slice(0, 120)})`);
};
