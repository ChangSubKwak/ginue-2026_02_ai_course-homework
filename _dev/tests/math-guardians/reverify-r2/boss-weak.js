// reverify-r2/boss-weak.js — code-boss 실패 1건('보스 방패 1개는 약점 큐 사실에서 출제')의 원인 판별용 결정적 재현:
// 한수아 1-2에서 웨이브 9 동안 약점 사실 '8−3'(box 0, miss 1)을 매 폴링마다 다시 심어(게임 중 정답으로 숙달되는 경로 차단) 보스 방패에 포함되는지 확인한다.
'use strict';
module.exports = async ({ page, expect, log, sleep }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const inject = () => page.evaluate(() => { const p = window.__app.MG.current(); p.facts['8−3'] = { key: '8−3', stageId: 's1-2', p: { op: 'sub', a: 8, b: 3 }, box: 0, hit: 0, miss: 1, rtSum: 0, lastAt: new Date().toISOString(), masteredAt: null, answer: '5', question: '8 − 3' }; return Object.values(p.facts).filter(f => f.stageId === 's1-2' && f.box < 2 && f.miss >= 1).map(f => f.key + ':' + f.box); });
  const suaId = (await state()).profiles.find(p => p.name === '한수아').id;
  await act('setActive', suaId); await act('setSetting', 'timeLimitMin', 0);
  await act('startStage', 's1-2'); await sleep(200);
  const t0 = Date.now(); let bossKeys = new Set(), weakAtBoss = null, hits94 = 0;
  while (Date.now() - t0 < 240000) {
    const g = (await state()).game; if (!g || g.state === 'ended') break;
    if (g.wave === 9) { weakAtBoss = await inject(); }
    if (g.wave === 10) { const b = g.monsters.find(m => m.isBoss); if (b) bossKeys.add(b.key); }
    if (g.state !== 'playing') { await sleep(100); continue; }
    const alive = g.monsters.filter(m => g.elapsedMs >= m.spawnedAt && !m.locked);
    if (!alive.length) { await sleep(100); continue; }
    const m = alive.sort((a, b) => b.progress - a.progress)[0];
    if (m.key === '8−3') hits94++;
    await act('fire', m.answerText); await sleep(230);
  }
  const g = (await state()).game;
  log(`end state=${g && g.state} wave=${g && g.wave} correct=${g && g.correct} wrong=${g && g.wrong} weakBeforeBoss=${JSON.stringify(weakAtBoss)} bossKeys=${[...bossKeys].join(' | ')} 8−3 spawned ${hits94}x secs=${Math.round((Date.now() - t0) / 1000)}`);
  expect(bossKeys.size === 3, `보스 방패 3개 모두 관측(${bossKeys.size})`);
  expect(bossKeys.has('8−3'), `보스 직전 약점(box 0)인 사실 '8−3'이 보스 방패에 포함(${[...bossKeys].join(' | ')})`);
};
