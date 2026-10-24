// code-accept2.pw.js — 수용 기준 2(스테이지 카드 상태)·3(보통 속도 12초 도달)·14(다시 풀기 → 상자 +1 → 주황 칸) 실측
'use strict';
module.exports = async ({ page, expect, log, sleep, shot }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const waitMonster = () => page.waitForFunction(() => { const g = window.__app.getState().game; return g && g.state === 'playing' && g.monsters.length > 0; }, null, { timeout: 6000 });
  // AC2
  await page.click('#grade-tabs [data-grade="2"]'); await sleep(100);
  const best = await page.locator('.stage-card[data-stage="s2-3"] .best').textContent();
  const starsTxt = await page.locator('.stage-card[data-stage="s2-3"] .stars').textContent();
  await page.click('#grade-tabs [data-grade="3"]'); await sleep(100);
  const c33 = await page.locator('.stage-card[data-stage="s3-3"]').getAttribute('class'), c34 = await page.locator('.stage-card[data-stage="s3-4"]').getAttribute('class');
  const lock34 = await page.locator('.stage-card[data-stage="s3-4"] .lock').textContent().catch(() => '');
  log(`AC2: 2-3 "${best}" "${starsTxt}"; 3-3 "${c33}"; 3-4 "${c34}" "${lock34}"`);
  expect(best.includes('19,800') && starsTxt === '★★☆' && /open/.test(c33) && /locked/.test(c34) && lock34.includes('잠김'), 'AC2 2-3 카드 19,800 ★★☆ / 3-3 열림 / 3-4 잠금 아이콘');
  await shot('code-home-grade3');
  // AC3: 보통 속도 12초
  await act('startStage', 's2-3'); await waitMonster();
  const m0 = (await state()).game.monsters[0];
  await page.waitForFunction(() => window.__app.getState().game.hp < 3, null, { timeout: 20000 });
  let g = (await state()).game; const hearts = await page.locator('#hud-hearts').textContent();
  log(`AC3: reached after ${Math.round(g.elapsedMs - m0.spawnedAt)}ms hearts="${hearts}" reached=${g.reached} combo=${g.combo}`);
  expect(Math.abs(g.elapsedMs - m0.spawnedAt - 12000) <= 1000 && hearts === '❤❤🖤', 'AC3 보통 속도 약 12초 도달, 하트 3→2');
  await act('quit'); await sleep(900);
  // AC14: 이도윤 → 오답 1건 → 결과 '다시 풀기' → 정답 → 상자 0→1 → 도감 주황
  const doyun = (await state()).profiles.find(p => p.name === '이도윤').id; await act('setActive', doyun);
  await act('startStage', 's2-3'); await waitMonster();
  const m1 = (await state()).game.monsters[0];
  const boxBefore = await page.evaluate(k => { const f = window.__app.MG.current().facts[k]; return f ? f.box : null; }, m1.key);
  await act('fire', '999'); await sleep(300);
  await page.keyboard.type(m1.answerText); await page.keyboard.press('Enter'); await sleep(700);
  await act('quit'); await sleep(900);
  const wrongCards = await page.locator('.wrong-card').count();
  await page.click('[data-action="review"]'); await sleep(300);
  const title = await page.locator('.modal-title').textContent();
  await page.keyboard.type(m1.answerText); await page.keyboard.press('Enter'); await sleep(300);
  const toast = await page.locator('#toast-root .toast').last().textContent().catch(() => '');
  const boxAfter = await page.evaluate(k => window.__app.MG.current().facts[k].box, m1.key);
  const boxTxt = await page.locator('.wrong-card .box-state').first().textContent();
  log(`AC14: key=${m1.key} wrongCards=${wrongCards} title="${title}" toast="${toast}" box ${boxBefore}→${boxAfter} cardBox="${boxTxt}"`);
  expect(wrongCards === 1 && title.includes('다시 풀기 1/1') && toast.includes('복습 완료 1/1') && boxAfter === 1 && boxTxt.includes('1/3'), 'AC14 다시 풀기 정답 → 상자 0→1, 결과 카드 상자 표시 갱신');
  await act('showView', 'codex'); await sleep(200);
  const cellCls = await page.locator(`.hm-cell[data-key="${m1.key}"]`).getAttribute('class');
  log('codex cell class: ' + cellCls);
  expect(cellCls.includes('box-1'), 'AC14 도감 칸 주황(box-1)');
  await shot('code-codex-after-review');
  // AC11 보조: choice3 스테이지에서 살아 있는 목표 몬스터의 크로스헤어 스크린샷
  await act('setSetting', 'unlockAll', true); await act('startStage', 's4-2'); await waitMonster(); await sleep(2500);
  const gm = (await state()).game; log(`choice3 live: monsters=${gm.monsters.length} key=${gm.monsters[0] && gm.monsters[0].key} choices=${JSON.stringify(gm.monsters[0] && gm.monsters[0].choices)}`);
  await shot('code-choice3-crosshair');
  await act('quit'); await sleep(900); await act('setSetting', 'unlockAll', false);
};
