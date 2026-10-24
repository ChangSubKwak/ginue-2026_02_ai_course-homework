// reverify-r2/reverify.js — 2라운드 재검증 QA 독립 모듈(수정 보고서와 무관하게 동작으로 확인)
// R-03 cleanP(정상 사실 보존·17개 생성기 전부 통과·악성 p 거부·divisors), C-01/M-08/M-06 회귀,
// isLocked 의미(같은 정답 연타·포탄 2발), 교정 카드 중 필살기 무시, 일반 웨이브·보스전 '정답 발사 직후 필살기'(다른 타이밍 80ms),
// R-02 400px 5-1 웨이브 3(2마리)·웨이브 7(3마리) 스폰 간격·라벨 스크린샷, U-01/AC16 400px 지표
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await state()).game;
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const waitGame = async (pred, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const g = await game(); if (g && pred(g)) return g; await sleep(80); } return game(); };
  const view = v => page.evaluate(x => window.__app.MG.UI.showView(x), v);
  await page.waitForSelector('#stage-grid .stage-card');

  // ---- R-03a: 샘플 데이터 새로고침(migrate→cleanP) 전후 프로필별 사실 수 동일 ----
  const before = await page.evaluate(() => window.__app.MG.root.profiles.map(p => Object.keys(p.facts).length));
  await reload(); await page.waitForSelector('#stage-grid .stage-card');
  const after = await page.evaluate(() => window.__app.MG.root.profiles.map(p => Object.keys(p.facts).length));
  log(`facts before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  expect(JSON.stringify(before) === JSON.stringify(after) && before.reduce((a, b) => a + b, 0) >= 80, `R-03 새로고침 후 샘플 사실 보존(${before.reduce((a, b) => a + b, 0)}개)`);

  // ---- R-03b: 17개 스테이지 생성기 × 40개 사실 + 악성 p 11종을 가져오기 → 정상은 전부 보존, 악성은 제외, 멈춤 없음 ----
  const data = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.MG.root)));
  const gen = await page.evaluate(() => { const P = window.__app.MG.Problems, out = {}; for (const st of window.__app.MG.STAGES) for (let i = 0; i < 40; i++) { const pr = P.generate(st.id); out[pr.key] = { key: pr.key, stageId: st.id, p: pr.p, box: 1, hit: 1, miss: 1, rtSum: 1000, lastAt: new Date().toISOString(), masteredAt: null, answer: pr.answerText, question: pr.text }; } return out; });
  const genN = Object.keys(gen).length; data.profiles[7].facts = gen;
  const mk = (k, sid, p) => ({ key: k, stageId: sid, p, box: 0, hit: 0, miss: 2, lastAt: null, masteredAt: null, answer: 'x', question: k });
  const bad = { '거대': mk('거대', 's5-1', { op: 'gcd', a: 1e12, b: 6 }), '거대lcm': mk('거대lcm', 's5-1', { op: 'lcm', a: 7, b: 999999999 }), '음수': mk('음수', 's2-3', { op: 'mul', a: -3, b: 4 }), '소수p': mk('소수p', 's2-3', { op: 'mul', a: 2.5, b: 4 }), '분모0': mk('분모0', 's3-2', { op: 'div', a: 8, b: 0 }), '빠진키': mk('빠진키', 's5-3', { op: 'dmul', a: 12, b: 3 }), '문자': mk('문자', 's2-3', { op: 'mul', a: '8', b: 7 }), 'op이상': mk('op이상', 's2-3', { op: 'zzz', a: 1, b: 1 }), 'op길이': mk('op길이', 's2-3', { op: 'x'.repeat(50), a: 1, b: 1 }), 'pct0': mk('pct0', 's6-3', { op: 'pct', n: 0, m: 1 }), 'fadd분모0': mk('fadd분모0', 's4-2', { op: 'fadd', n1: 1, d1: 0, n2: 1, d2: 2, keep: true }), 'p없음': { key: 'p없음', stageId: 's2-3', box: 0, hit: 0, miss: 1 } };
  Object.assign(data.profiles[1].facts, bad);
  const t0 = Date.now();
  await page.evaluate(t => { window.__app.actions.importJson(t); }, JSON.stringify(data));
  await sleep(200); await page.click('.modal [data-m="true"]'); await sleep(300);
  const importMs = Date.now() - t0;
  const res = await page.evaluate(() => { const P = window.__app.MG.root.profiles; return { gen: Object.keys(P[7].facts).length, p1: Object.keys(P[1].facts), n: P.length }; });
  const leaked = Object.keys(bad).filter(k => res.p1.includes(k));
  log(`import ms=${importMs} gen kept ${res.gen}/${genN} leaked=${JSON.stringify(leaked)} p1facts=${res.p1.length}`);
  expect(importMs < 4000, `R-03 악성 p(1e12 gcd·9억 lcm 등) 포함 가져오기 ${importMs}ms에 완료`);
  expect(res.gen === genN && genN >= 17 * 20, `R-03 17개 스테이지 생성기 사실 ${res.gen}/${genN} 모두 cleanP 통과(과잉 거부 없음)`);
  expect(leaked.length === 0 && res.p1.includes('8×7') && res.p1.includes('62−27'), `R-03 악성 p 12종 모두 제외, 정상 사실 유지(leaked=${leaked.join(',')})`);
  // 가져온 생성기 사실로 도감 렌더(약점 목록·히트맵)도 예외 없이 동작
  await act('setActive', data.profiles[7].id); await view('codex'); await sleep(200);
  for (const sid of ['s2-3', 's4-2', 's5-3', 's6-3']) { await page.evaluate(s => { const sel = document.getElementById('codex-stage'); sel.value = s; sel.dispatchEvent(new Event('change')); }, sid); await sleep(120); }
  const weakRows = await page.evaluate(() => document.querySelectorAll('#codex-view li, #codex-view tr, #codex-view .weak-item').length);
  log('codex weak rows ' + weakRows);
  const div = await page.evaluate(() => { const P = window.__app.MG.Problems; const t = performance.now(); const a = P.build('s5-1', { op: 'gcd', a: 36, b: 24 }), b = P.build('s5-1', { op: 'lcm', a: 0, b: 5 }), c = P.build('s5-1', { op: 'gcd', a: 1, b: 1 }); return { ms: performance.now() - t, sol: a.solution, ans: a.answer, lcm0: b.answer, g11: c.solution }; });
  log('divisors ' + JSON.stringify(div));
  expect(div.ans === 12 && div.sol.includes('36의 약수 1,2,3,4,6,9,12,18,36') && div.sol.includes('24의 약수 1,2,3,4,6,8,12,24') && div.ms < 50, `R-03 divisors √n(완전제곱수 중복 없음·정렬) ${div.sol}`);
  await act('resetSample'); await sleep(300); await view('home'); await sleep(150);

  // ---- C-01 회귀: 가져오기 페이로드(id·name·avatar·skin·fact key·wrongKeys) → 미실행 ----
  const evil = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.MG.root)));
  const pl = '"><img src=x onerror="window.__xssA=1">'; const e1 = evil.profiles[1];
  e1.id = 'x" onmouseover="window.__xssB=1'; e1.name = '<img src=x onerror="window.__xssC=1">'; e1.avatar = pl; e1.skin = pl; e1.grade = pl;
  e1.facts['<img src=x onerror="window.__xssD=1">'] = { key: '<img src=x onerror="window.__xssD=1">', stageId: 's2-3', p: { op: 'mul', a: 8, b: 7 }, box: 0, hit: 0, miss: 5, lastAt: new Date().toISOString(), masteredAt: null, answer: '<img src=x onerror="window.__xssE=1">', question: '<img src=x onerror="window.__xssF=1">' };
  e1.history[0].wrongKeys = ['<img src=x onerror="window.__xssG=1">']; e1.history[0].playedAt = new Date().toISOString(); evil.activeProfileId = e1.id; evil.settings.classLabel = pl;
  await page.evaluate(t => { window.__app.actions.importJson(t); }, JSON.stringify(evil)); await sleep(250); await page.click('.modal [data-m="true"]'); await sleep(300);
  for (const v of ['home', 'codex', 'hall', 'settings']) { await view(v); await sleep(120); }
  await page.evaluate(() => { document.getElementById('profile-btn').click(); }); await sleep(120);
  const xss = await page.evaluate(() => ({ flags: Object.keys(window).filter(k => /^__xss/.test(k)), imgs: document.querySelectorAll('img').length, p1: [window.__app.MG.root.profiles[1].id, window.__app.MG.root.profiles[1].avatar, window.__app.MG.root.profiles[1].skin] }));
  log('xss ' + JSON.stringify(xss));
  expect(xss.flags.length === 0 && xss.imgs === 0 && /^p_/.test(xss.p1[0]) && xss.p1[1] === 0 && xss.p1[2] === 'basic', `C-01 회귀 없음(flags=${xss.flags.join(',')} imgs=${xss.imgs})`);
  await act('resetSample'); await sleep(300); await view('home'); await sleep(150);

  // ---- M-08 회귀: 소수 스테이지 '.' 보장 + 스테이지 간 key 충돌 0 (500회) ----
  const m8 = await page.evaluate(() => { const P = window.__app.MG.Problems; const keys = {}; const ids = ['s1-1', 's1-2', 's2-3', 's3-2', 's3-3', 's4-1', 's4-3', 's5-3', 's6-2']; for (const sid of ids) { keys[sid] = new Set(); for (let i = 0; i < 500; i++) keys[sid].add(P.generate(sid).key); } const bad = []; for (const sid of ['s4-3', 's5-3', 's6-2']) for (const k of keys[sid]) if (!k.includes('.')) bad.push(sid + ':' + k); const cross = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (const k of keys[ids[i]]) if (keys[ids[j]].has(k)) cross.push(ids[i] + '/' + ids[j] + ':' + k); return { bad: bad.slice(0, 5), cross: cross.slice(0, 5) }; });
  expect(m8.bad.length === 0 && m8.cross.length === 0, `M-08 회귀 없음 ${JSON.stringify(m8)}`);

  // ---- 게임: M-06 + isLocked 의미 + 카드 중 필살기 + 일반 웨이브 필살기(80ms) + 보스 필살기(80ms) ----
  await act('setSetting', 'timeLimitMin', 0); await act('setSetting', 'unlockAll', true);
  await act('setActive', 'p_sample01'); await act('startStage', 's2-3'); await sleep(200);
  await act('fire', '12'); await sleep(60); let g = await game();
  expect(g && g.wrong === 0 && g.combo === 0 && g.state === 'playing', `M-06 몬스터 없을 때 발사 무시(wrong=${g && g.wrong})`);
  // 같은 정답 연타: 첫 발사로 조준(locked) → 두 번째는 무시(오답 아님), 명중 1회만
  g = await waitGame(x => x.monsters.length >= 1 && x.monsters[0].progress > 0.03, 9000);
  const a1 = g.monsters[0].answer;
  await page.evaluate(a => { window.__app.actions.fire(a); window.__app.actions.fire(a); }, String(a1));
  await sleep(40); const mid = await game(); await sleep(400); g = await game();
  log(`double fire: mid locked=${mid.monsters[0] && mid.monsters[0].locked} → correct=${g.correct} wrong=${g.wrong} monsters=${g.monsters.length}`);
  expect(mid.monsters[0] && mid.monsters[0].locked === true && g.correct === 1 && g.wrong === 0 && g.monsters.length === 0, 'isLocked: 같은 정답 연타 시 두 번째는 무시(오답·중복 명중 없음)');
  // 교정 카드 중 필살기·발사 무시(게이지는 나중에 확인) — 오답 '0'은 2-3에 없음
  g = await waitGame(x => x.monsters.length >= 1 && x.monsters[0].progress > 0.03, 9000);
  await act('fire', '0'); await sleep(150); g = await game();
  expect(g.state === 'card' && g.wrong === 1 && (await page.locator('.modal').count()) >= 1, `오답 → 교정 카드(state=${g.state})`);
  const gaugeBeforeCard = g.superGauge; await act('useSuper'); await act('fire', String(g.monsters[0].answer)); await sleep(100); const gc = await game();
  expect(gc.state === 'card' && gc.superGauge === gaugeBeforeCard && gc.correct === 1, '교정 카드 중 필살기·발사 무시');
  const cardAns = await page.evaluate(() => { const m = document.querySelector('.modal'); return m ? (m.textContent.match(/(\d+)\s*×\s*(\d+)/) || []).slice(1, 3) : null; });
  await sleep(1300); // 카드 애니메이션(≤1.5초) 후 키보드 입력
  await page.keyboard.type(String(cardAns ? cardAns[0] * cardAns[1] : g.monsters[0].answer)); await page.keyboard.press('Enter'); await sleep(200);
  g = await game(); expect(g.state === 'resume' || g.state === 'playing', `카드 정답 입력 → 재개(state=${g.state})`);
  await waitGame(x => x.state === 'playing', 2000);
  // 1~9웨이브 자동 진행. 게이지가 생기고 몬스터 2마리 이상이면: 정답 발사 → 80ms 뒤 필살기(포탄 비행 중)
  const tb = Date.now(); let reachedBoss = false, waveSuperDone = false, twoShotDone = false;
  while (Date.now() - tb < 240000) {
    g = await game(); if (!g || g.state === 'ended') break;
    if (g.wave === 10 && g.monsters.some(x => x.isBoss)) { reachedBoss = true; break; }
    if (g.state !== 'playing' || !g.monsters.length) { await sleep(100); continue; }
    const live = g.monsters.filter(x => !x.locked && x.progress > 0).sort((a, b) => b.progress - a.progress);
    if (!live.length) { await sleep(60); continue; }
    if (!twoShotDone && live.length >= 2 && live[0].answer !== live[1].answer) {
      // 포탄 2발 동시 비행(서로 다른 몬스터) → 둘 다 명중, 둘 다 locked 표시
      const c0 = g.correct;
      await page.evaluate(([a, b]) => { window.__app.actions.fire(a); window.__app.actions.fire(b); }, [String(live[0].answer), String(live[1].answer)]);
      await sleep(40); const m2 = await game(); const lockedN = m2.monsters.filter(x => x.locked).length; await sleep(400); const g2 = await game();
      log(`two shots: locked ${lockedN}, correct ${c0}→${g2.correct}, wrong ${g2.wrong}`);
      expect(lockedN === 2 && g2.correct === c0 + 2 && g2.wrong === 1, 'isLocked: 서로 다른 몬스터에 포탄 2발 동시 비행 → 둘 다 명중');
      twoShotDone = true; continue;
    }
    if (!waveSuperDone && g.superGauge >= 1 && live.length >= 2) {
      const sc = g.score, combo = g.combo, n = g.monsters.length, mult = combo < 5 ? 1 : combo < 10 ? 2 : combo < 20 ? 3 : 4, c0 = g.correct;
      await act('fire', String(live[0].answer)); await sleep(80); await act('useSuper'); await sleep(300);
      const g2 = await game(); const gained = g2.score - sc;
      log(`wave super(80ms): monsters ${n}→${g2.monsters.length}, gained ${gained}, combo ${combo}→${g2.combo}, gauge ${g.superGauge}→${g2.superGauge}, correct ${c0}→${g2.correct}, floats=${JSON.stringify(g2.floats)}`);
      expect(g2.monsters.length === 0 && g2.correct === c0 + 1 && g2.combo === combo + 1 && g2.superGauge === g.superGauge - 1 && gained >= 100 * mult + 100 * (n - 1), 'R-01 일반 웨이브: 정답 발사 80ms 뒤 필살기 → 정답 명중 보존 + 나머지 전멸 + 게이지 -1');
      waveSuperDone = true; continue;
    }
    await act('fire', String(live[0].answer)); await sleep(200);
  }
  g = await game(); log(`boss reach=${reachedBoss} wave=${g && g.wave} score=${g && g.score} hp=${g && g.hp} gauge=${g && g.superGauge} correct=${g && g.correct} wrong=${g && g.wrong} secs=${Math.round((Date.now() - tb) / 1000)}`);
  expect(reachedBoss, `보스 도달 wave=${g && g.wave}`);
  expect(twoShotDone && waveSuperDone, `웨이브 중 시나리오 수행(twoShot=${twoShotDone}, waveSuper=${waveSuperDone})`);
  if (reachedBoss) {
    await waitGame(x => x.monsters.some(b => b.isBoss && b.progress > 0.02), 6000);
    g = await game(); let b = g.monsters.find(x => x.isBoss);
    expect(g.superGauge >= 1, `보스전 진입 시 게이지 ≥1 (${g.superGauge})`);
    if (g.superGauge >= 1) {
      const sc = g.score;
      await act('fire', String(b.answer)); await sleep(80); await act('useSuper'); await sleep(350);
      g = await game(); const b2 = g.monsters.find(x => x.isBoss);
      log('boss after fire(80ms)+super ' + JSON.stringify({ shields: b2 && b2.shields, locked: b2 && b2.locked, state: g.state, gained: g.score - sc, floats: g.floats }));
      expect(g.state === 'ended' || (b2 && b2.shields === 1 && b2.locked === false && g.score - sc >= 200), `R-01 보스: 정답 발사 80ms 뒤 필살기 → 방패 3→1·locked=false·방패 점수 보존 (shields=${b2 && b2.shields}, locked=${b2 && b2.locked})`);
      if (b2 && g.state === 'playing') {
        // 방패가 1개 남은 보스에 오답 → 카드 → 정답 입력 → 보스 격파(점수 없이) 흐름 대신, 정답 발사로 클리어
        await act('fire', String(b2.answer)); await sleep(400); g = await game();
        expect(g.state === 'ended', `R-01 남은 방패를 정답으로 깨고 클리어(state=${g.state})`);
      }
    } else { await act('fire', String(b.answer)); await sleep(400); b = (await game()).monsters.find(x => x.isBoss); await act('fire', String(b.answer)); await sleep(400); b = (await game()).monsters.find(x => x.isBoss); await act('fire', String(b.answer)); await sleep(400); }
    await sleep(1500);
    const rv = await page.evaluate(() => ({ view: window.__app.MG.UI.view, head: (document.querySelector('#result-view h2') || {}).textContent, stars: document.querySelectorAll('#result-view .star.on, #result-view .stars .on').length, text: document.getElementById('result-view').textContent.slice(0, 200) }));
    log('result ' + JSON.stringify(rv));
    expect(rv.view === 'result' && /클리어/.test(rv.text), '보스 클리어 → 결과 화면(스테이지 클리어)');
    await shot('rv2-boss-result');
  }

  // ---- R-02 + U-01/AC16: 400px 5-1 웨이브 3(2마리)·웨이브 7(3마리) ----
  await page.setViewportSize({ width: 400, height: 800 }); await view('home'); await sleep(150);
  await act('startStage', 's5-1'); await sleep(200);
  const tp = Date.now(); let s3 = null, s7 = null, mob = null;
  while (Date.now() - tp < 200000) {
    g = await game(); if (!g || g.state === 'ended') break;
    if (!mob && g.monsters.length) mob = await page.evaluate(() => { const c = document.getElementById('game-canvas').getBoundingClientRect(), h = document.querySelector('.hud').getBoundingClientRect(), ip = document.getElementById('input-panel').getBoundingClientRect(); return { canvasW: Math.round(c.width), hudBottom: Math.round(h.bottom), canvasTop: Math.round(c.top), panelTop: Math.round(ip.top), vh: innerHeight, sw: document.documentElement.scrollWidth, keyH: Math.round(document.querySelector('#input-panel .key').getBoundingClientRect().height) }; });
    const ms = g.monsters.filter(m => m.progress > 0);
    if (g.wave === 3 && !s3 && ms.length >= 2) { s3 = ms.map(m => [m.text, m.progress]).sort((a, b) => b[1] - a[1]); await shot('rv2-400-wave3-two'); }
    if (g.wave >= 7 && !s7) { if (ms.length >= 3) { s7 = ms.map(m => [m.text, m.progress]).sort((a, b) => b[1] - a[1]); await shot('rv2-400-wave7-three'); break; } if (ms.length && ms[0].progress > 0.8) await act('fire', String(ms[0].answer)); await sleep(60); continue; }
    if (g.wave === 3 && !s3) { if (ms.length && ms[0].progress > 0.75) await act('fire', String(ms[0].answer)); await sleep(60); continue; }
    if (g.state === 'playing') { const m = ms.filter(x => !x.locked).sort((a, b) => b.progress - a.progress)[0]; if (m) { await act('fire', String(m.answer)); await sleep(200); continue; } }
    await sleep(100);
  }
  g = await game(); log(`400px pacing wave=${g && g.wave} s3=${JSON.stringify(s3)} s7=${JSON.stringify(s7)} mob=${JSON.stringify(mob)} secs=${Math.round((Date.now() - tp) / 1000)}`);
  expect(s3 && s3[0][1] >= 0.17 && s3[0][1] <= 0.40, `R-02 400px 5-1 웨이브 3 두 번째 스폰 시 첫 몬스터 진행도 ${s3 && s3[0][1]} (0.18~0.35+여유)`);
  expect(s7 && s7.length === 3 && s7[0][1] - s7[2][1] <= 0.85, `R-02 400px 5-1 웨이브 7 3마리 동시 출현(진행도 ${s7 && s7.map(x => x[1]).join('/')})`);
  expect(mob && mob.hudBottom <= mob.canvasTop + 1 && mob.sw <= 400 && mob.keyH >= 56 && mob.panelTop + 100 < mob.vh, `U-01/AC16 400px: HUD 띠가 캔버스 위, 키 ${mob && mob.keyH}px, scrollWidth ${mob && mob.sw}`);
  await act('quit'); await sleep(600);
  await page.setViewportSize({ width: 1280, height: 800 });
  // 데스크톱 5-1 웨이브 7 3마리 스크린샷(라벨 계단식 확인)
  await view('home'); await sleep(150); await act('startStage', 's5-1'); await sleep(200);
  const td = Date.now(); let d7 = null;
  while (Date.now() - td < 200000) {
    g = await game(); if (!g || g.state === 'ended') break;
    const ms = g.monsters.filter(m => m.progress > 0);
    if (g.wave >= 7) { if (ms.length >= 3) { d7 = ms.map(m => [m.text, +m.progress.toFixed(2)]); await shot('rv2-1280-wave7-three'); break; } if (ms.length && ms[0].progress > 0.8) await act('fire', String(ms[0].answer)); await sleep(60); continue; }
    if (g.state === 'playing') { const m = ms.filter(x => !x.locked).sort((a, b) => b.progress - a.progress)[0]; if (m) { await act('fire', String(m.answer)); await sleep(200); continue; } }
    await sleep(100);
  }
  log(`1280 wave7 d7=${JSON.stringify(d7)} secs=${Math.round((Date.now() - td) / 1000)}`);
  expect(!!d7, '데스크톱 5-1 웨이브 7 3마리 스크린샷 확보');
  await act('quit'); await sleep(500);
};
