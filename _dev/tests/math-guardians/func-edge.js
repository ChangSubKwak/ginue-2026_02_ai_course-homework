// func-edge.js — 엣지 케이스: 프로필 0명 상태, facts 600개 상한 정리, history 20개 상한, 새 프로필 모달 Enter, 같은 정답 몬스터 2마리 조준 규칙(A3) (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const txt = sel => page.locator(sel).first().innerText().catch(() => '');
  // 프로필 0명
  await page.evaluate(() => { const MG = window.__app.MG; MG.root.profiles = []; MG.root.activeProfileId = null; MG.guest = null; MG.UI.renderProfileBar(); MG.UI.showView('home'); });
  await page.click('[data-action="grade-tab"][data-grade="1"]');
  expect((await txt('#profile-name')) === '체험 학생' && (await page.locator('#profile-menu').innerText()).includes('프로필이 없습니다'), '프로필 0명 → 게스트 표시·드롭다운 안내');
  expect(await page.locator('.stage-card[data-stage="s1-1"] .start-btn').isEnabled() && await page.locator('.toolbar [data-action="new-profile"]').isVisible() && await page.locator('.toolbar [data-action="guest"]').isVisible(), '프로필 0명에서 새 프로필·체험하기 유도, 1-1 시작 가능');
  await page.click('#main-tabs [data-action="nav"][data-view="hall"]');
  const hallEmpty = await txt('#hall-view');
  expect(hallEmpty.includes('랭킹에 포함되지 않아요') || hallEmpty.includes('아직 기록이 없어요'), `프로필 0명 랭킹 빈 상태 메시지 (${hallEmpty.replace(/\s+/g, ' ').slice(0, 80)})`);
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  expect((await txt('#profile-count')).includes('0/40') && await page.locator('#profile-table tbody tr').count() === 0, '설정 프로필 표 0/40');
  // facts 600 상한 / history 20 상한
  const caps = await page.evaluate(() => { const MG = window.__app.MG; const p = MG.newProfile('임시', 1, 1, 1, 0); for (let i = 0; i < 650; i++) { const pr = { key: 'k' + i, stageId: 's1-1', p: {}, answerText: '1', text: 'k' + i }; for (let j = 0; j < 3; j++) MG.Facts.update(p, pr, 'hit'); } const weak = { key: 'weak', stageId: 's1-1', p: {}, answerText: '1', text: 'weak' }; MG.Facts.update(p, weak, 'miss'); for (let i = 0; i < 60; i++) MG.Facts.update(p, { key: 'z' + i, stageId: 's1-1', p: {}, answerText: '1', text: 'z' + i }, 'hit'); return { n: Object.keys(p.facts).length, weakKept: !!p.facts.weak, lowKept: Object.values(p.facts).filter(f => f.box < 3).length }; });
  expect(caps.n === 600 && caps.weakKept, `facts 600개 초과 시 숙달(상자 3·오답 0) 항목부터 정리, 약점 사실은 유지 (${JSON.stringify(caps)})`);
  await page.evaluate(() => window.__app.actions.resetSample());
  await reload();
  expect((await st()).profiles.length === 24, '샘플 복원');
  // 새 프로필 모달에서 Enter
  await page.click('.toolbar [data-action="new-profile"]');
  await page.fill('#np-name', '엔터학생'); await page.keyboard.press('Enter'); await sleep(150);
  const enterMade = (await st()).profiles.some(p => p.name === '엔터학생');
  expect(enterMade, '새 프로필 모달에서 Enter 키로 만들기');
  if (!enterMade) { await page.keyboard.press('Escape'); }
  // 같은 정답 몬스터 2마리: 가장 앞선 1마리만 격파
  await page.evaluate(() => { window.__app.actions.setSetting('unlockAll', true); window.__app.actions.showView('home'); });
  await page.click('[data-action="grade-tab"][data-grade="2"]');
  await page.click('.stage-card[data-stage="s2-3"] .start-btn');
  // 웨이브 3 이상(동시 2마리)까지 빠르게 진행하며 같은 answer 쌍을 기다림
  const t0 = Date.now(); let pair = null, g = null;
  while (Date.now() - t0 < 90000 && !pair) {
    g = (await st()).game; if (!g || g.state === 'ended') break;
    if (g.state === 'playing') {
      const live = g.monsters.filter(m => !m.locked && !m.isBoss);
      const same = live.find(a => live.some(b => b !== a && b.answer === a.answer));
      if (same) { pair = live.filter(m => m.answer === same.answer); break; }
      if (live.length) { await page.evaluate(a => window.__app.actions.fire(a), live[0].answerText); await sleep(230); } else await sleep(80);
    } else await sleep(80);
  }
  if (pair) {
    const front = pair.reduce((a, m) => m.progress > a.progress ? m : a);
    await page.evaluate(a => window.__app.actions.fire(a), front.answerText); await sleep(300);
    g = (await st()).game;
    const remaining = g.monsters.filter(m => pair.some(p => p.id === m.id));
    expect(remaining.length === pair.length - 1 && !remaining.some(m => m.id === front.id), `같은 정답 ${pair.length}마리 중 가장 앞선 1마리만 격파 (남은 ${remaining.length})`);
    await page.evaluate(a => window.__app.actions.fire(a), front.answerText); await sleep(300);
    expect((await st()).game.monsters.filter(m => pair.some(p => p.id === m.id)).length === pair.length - 2, '두 번째 발사로 나머지 격파');
  } else log('같은 정답 몬스터 쌍이 90초 안에 나타나지 않음(확률적) — 미검증');
  await page.evaluate(() => window.__app.actions.quit()); await sleep(800);
  await page.evaluate(() => window.__app.actions.setSetting('unlockAll', false));
};
