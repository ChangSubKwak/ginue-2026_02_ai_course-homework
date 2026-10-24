// code-blocked.pw.js — localStorage 차단 환경: 경고 배지·플레이 가능·학년/랭킹 탭 전환(uiPref 메모리 폴백 여부)
'use strict';
module.exports = async ({ page, ctx, expect, shot, log, sleep }) => {
  await ctx.addInitScript(() => {
    const deny = () => { throw new DOMException('Access is denied for this document.', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: deny });
  });
  await page.reload({ waitUntil: 'load' }); await sleep(800);
  const blocked = await page.evaluate(() => { try { window.localStorage; return false; } catch (e) { return true; } });
  log('localStorage blocked in page: ' + blocked);
  expect(blocked, '(전제) 페이지에서 localStorage 접근이 예외를 던진다');
  expect(await page.locator('#storage-warn').isVisible(), "상단 '저장 불가' 경고 배지 표시");
  expect(await page.evaluate(() => window.__app.getState().storageOk === false), 'storageOk=false');
  expect((await page.locator('.stage-card').count()) === 3, '홈 스테이지 카드 표시(1학년 3개)');
  await page.click('#grade-tabs [data-grade="2"]'); await sleep(250);
  const nos = await page.locator('.stage-no').allTextContents();
  const selTab = await page.locator('#grade-tabs [aria-selected="true"]').getAttribute('data-grade');
  log(`after clicking 2학년 tab: cards=${nos.join(',')} selected=${selTab}`);
  expect(nos[0] === '2-1' && selTab === '2', 'localStorage 차단 시에도 학년 탭 전환이 동작한다');
  await shot('code-blocked-grade-tab');
  await page.evaluate(() => window.__app.actions.showView('hall')); await sleep(200);
  await page.click('[data-action="hall-tab"][data-tab="stars"]'); await sleep(250);
  const hallSel = await page.locator('[data-action="hall-tab"][aria-selected="true"]').getAttribute('data-tab');
  const hallHead = await page.locator('.rank-table th.num').textContent().catch(() => '');
  log(`after clicking 별 tab: selected=${hallSel} head="${hallHead}"`);
  expect(hallSel === 'stars', 'localStorage 차단 시에도 명예의 전당 탭 전환이 동작한다');
  await page.evaluate(() => window.__app.actions.startStage('s1-1')); await sleep(1600);
  const g = await page.evaluate(() => window.__app.getState().game);
  log(`game: state=${g && g.state} monsters=${g && g.monsters.length}`);
  expect(g && g.state === 'playing' && g.monsters.length >= 1, '차단 환경에서도 플레이 가능');
  await page.evaluate(() => window.__app.actions.quit()); await sleep(700);
};
