// code-mobile.pw.js — 400px 게임 화면(가로 스크롤·키패드 56px·카드) + 명예의 전당 '내 순위 n/N' 상위 10 밖 처리
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.evaluate(() => window.__app.actions.startStage('s2-3')); await sleep(1500);
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth]);
  log('scrollWidth(doc,body,inner)=' + sw.join(','));
  expect(sw[0] <= 400 && sw[1] <= 400, '400px 게임 화면 가로 스크롤 없음');
  const keyH = await page.locator('#input-panel .key').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  log('key heights=' + keyH.join(','));
  expect(keyH.length === 12 && keyH.every(h => h >= 56), '키패드 버튼 12개 높이 ≥56px');
  const vis = await page.evaluate(() => { const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; }; return { canvas: r('game-canvas'), hud: r('hud-score'), panel: r('input-panel'), vh: window.innerHeight }; });
  log('layout=' + JSON.stringify(vis));
  expect(vis.canvas.bottom <= vis.vh && vis.panel.top < vis.vh, '캔버스·HUD·키패드가 한 화면에 보임');
  await shot('code-mobile-game');
  await page.evaluate(() => window.__app.actions.fire('999')); await sleep(400);
  const sw2 = await page.evaluate(() => document.documentElement.scrollWidth);
  const cardVisible = await page.locator('.card-modal').isVisible();
  log(`card at 400px: visible=${cardVisible} scrollWidth=${sw2}`);
  expect(cardVisible && sw2 <= 400, '400px 교정 카드 표시·가로 스크롤 없음');
  await shot('code-mobile-card');
  const ans = await page.evaluate(() => { const g = window.__app.getState().game; return g.monsters.slice().sort((a, b) => b.progress - a.progress)[0].answerText; });
  await page.keyboard.type(ans); await page.keyboard.press('Enter'); await sleep(150);
  await page.evaluate(() => window.__app.actions.quit()); await sleep(900);
  await shot('code-mobile-result');
  await page.evaluate(() => window.__app.actions.showView('home')); await sleep(100);
  await page.setViewportSize({ width: 1280, height: 800 });

  // 명예의 전당 '내 순위 n/N': 2-3 기록 보유자 14명, 내가 최하위(11위 밖)
  await page.evaluate(() => { const MG = window.__app.MG; MG.root.profiles.forEach((p, i) => { if (!p.stageRecords['s2-3'] && i < 14) p.stageRecords['s2-3'] = { stageId: 's2-3', bestScore: 9000 - i * 100, bestStars: 1, bestCombo: 3, plays: 1, clears: 1, correct: 20, wrong: 5, reached: 2, avgMs: 3000, lastPlayedAt: new Date().toISOString() }; }); MG.root.settings.rankingPublic = false; });
  const n23 = await page.evaluate(() => window.__app.MG.root.profiles.filter(p => p.stageRecords['s2-3']).length);
  const lowId = await page.evaluate(() => { const MG = window.__app.MG; return MG.root.profiles.filter(p => p.stageRecords['s2-3']).sort((a, b) => a.stageRecords['s2-3'].bestScore - b.stageRecords['s2-3'].bestScore)[0].id; });
  await page.evaluate(id => window.__app.actions.setActive(id), lowId);
  await page.evaluate(() => window.__app.actions.showView('hall')); await sleep(200);
  await page.selectOption('#hall-stage', 's2-3'); await sleep(200);
  const note = (await page.locator('.note').textContent().catch(() => '')).replace(/\s+/g, ' ');
  const rowsShown = await page.locator('.rank-table tbody tr').count();
  log(`2-3 기록 ${n23}명, 최하위 프로필 활성, 비공개: note="${note}", rows=${rowsShown}`);
  expect(new RegExp(`내 순위 ${n23}/${n23}`).test(note) && rowsShown === 1, `랭킹 비공개 시 상위 10 밖 학생도 내 기록·내 순위 ${n23}/${n23} 표시`);
  await shot('code-hall-private-11th');
  await page.evaluate(() => window.__app.actions.resetSample());
};
