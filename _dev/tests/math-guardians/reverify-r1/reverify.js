// reverify-r1/reverify.js — 재검증 QA 독립 확인: critical/major 수정 항목을 소스가 아닌 동작으로 재확인하고 회귀 후보를 실측한다.
// (C-01 XSS 변종, M-01/M-02 세로셈, M-04 비공개 랭킹 12명+, M-05 PIN 게이트, M-06 몬스터 없을 때 발사, M-07 전체화면 대상,
//  M-08 소수 생성, U-01 모바일 라벨/HUD, U-03 긴 라벨 스폰 간격(회귀 후보: 페이싱), U-04/U-05 대비, 보스+필살기 잠금 회귀 후보, cleanP 대형 수 처리 시간)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await state()).game;
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const waitGame = async (pred, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const g = await game(); if (g && pred(g)) return g; await sleep(100); } return game(); };
  const view = v => page.evaluate(x => window.__app.MG.UI.showView(x), v);
  await page.waitForSelector('#stage-grid .stage-card');

  // ---- C-01 변종: 가져오기 JSON의 모든 문자열 필드에 페이로드 → 스크립트 미실행·마크업 미삽입 ----
  const payload = '"><img src=x onerror="window.__xssA=1">';
  const evil = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.MG.root)));
  evil.settings.classLabel = payload + '<b id="xssb">';
  const p0 = evil.profiles[1]; // 이도윤(기록·facts 보유)
  p0.id = 'x" onmouseover="window.__xssB=1'; p0.name = '<img src=x onerror="window.__xssC=1">'; p0.avatar = payload; p0.grade = payload; p0.classNo = payload; p0.number = payload;
  p0.skin = '"><img src=x onerror="window.__xssD=1">'; p0.theme = payload;
  p0.facts['<img src=x onerror="window.__xssE=1">'] = { key: '<img src=x onerror="window.__xssE=1">', stageId: 's2-3', p: { op: 'mul', a: 8, b: 7 }, box: 0, hit: 0, miss: 5, lastAt: new Date().toISOString(), masteredAt: null, answer: '<img src=x onerror="window.__xssF=1">', question: '<img src=x onerror="window.__xssG=1">' };
  p0.facts['8×6'].question = '<img src=x onerror="window.__xssH=1">'; p0.facts['8×6'].answer = '<svg onload="window.__xssI=1">';
  p0.history[0].wrongKeys = ['<img src=x onerror="window.__xssJ=1">']; p0.history[0].playedAt = new Date().toISOString();
  p0.badges.push({ id: '<img src=x onerror="window.__xssK=1">', at: 'x' });
  evil.profiles.push({ id: 'dup', name: 'A' }); evil.profiles.push({ id: 'dup', name: '<script>window.__xssL=1</script>' });
  evil.activeProfileId = p0.id;
  await page.evaluate(t => { window.__app.actions.importJson(t); }, JSON.stringify(evil)); // 모달을 기다리는 Promise를 await하지 않는다
  await sleep(300); await page.click('.modal [data-m="true"]'); await sleep(400);
  // 모든 화면을 렌더해 본다
  for (const v of ['home', 'codex', 'hall', 'settings']) { await view(v); await sleep(150); }
  await page.evaluate(() => { document.getElementById('profile-btn').click(); });
  await sleep(150);
  await page.evaluate(() => { const c = document.querySelector('.hm-cell[data-key="8×6"]'); if (c) c.click(); });
  await page.evaluate(() => { const s = document.getElementById('codex-stage'); if (s) { s.value = 's2-2'; s.dispatchEvent(new Event('change')); } });
  await sleep(200);
  await page.evaluate(() => { window.__app.MG.UI.showView('hall'); document.querySelector('[data-action="hall-tab"][data-tab="stars"]').click(); });
  await sleep(300);
  const xss = await page.evaluate(() => ({ flags: Object.keys(window).filter(k => /^__xss/.test(k)), imgs: document.querySelectorAll('img, svg[onload], #xssb').length, prof: window.__app.MG.root.profiles.slice(0, 3).map(p => [p.id, p.name, p.avatar, p.grade, p.classNo, p.number, p.skin, p.theme]), label: window.__app.MG.root.settings.classLabel, badges: window.__app.MG.root.profiles[1].badges.map(b => b.id), factKeys: Object.keys(window.__app.MG.root.profiles[1].facts).filter(k => /</.test(k)), n: window.__app.MG.root.profiles.length }));
  log('xss ' + JSON.stringify(xss));
  expect(xss.flags.length === 0 && xss.imgs === 0, `C-01 가져오기 페이로드 14종 모두 미실행(flags=${xss.flags.join(',')} imgs=${xss.imgs})`);
  expect(xss.prof[1][2] === 0 && xss.prof[1][3] === null && xss.prof[1][6] === 'basic' && xss.prof[1][7] === 'meadow' && /^p_/.test(xss.prof[1][0]) && !xss.badges.some(b => /</.test(b)), `C-01 migrate 타입 강제(avatar/grade/skin/theme/id/badges) ${JSON.stringify(xss.prof[1])}`);
  expect(xss.n === 26, `중복 id 프로필도 서로 다른 id로 보존(26명) n=${xss.n}`);
  // 인쇄표(오늘 기록 1건: wrongKeys 페이로드) — window.print는 헤드리스에서 무해
  await page.evaluate(() => { window.print = () => {}; document.querySelector('[data-action="print-today"]').click(); });
  const printHtml = await page.evaluate(() => document.getElementById('print-root').innerHTML);
  expect(!/<img|<svg/.test(printHtml) && /&lt;img/.test(printHtml), 'C-01 인쇄 기록표의 틀린 문제 키 이스케이프');
  await shot('rv-xss-codex');
  await act('resetSample'); await sleep(300); await view('home'); await sleep(200);

  // ---- cleanP: 가져온 facts의 p에 큰 수가 들어있을 때 처리 시간(divisors 루프) ----
  const tBig = await page.evaluate(() => { const t0 = performance.now(); try { window.__app.MG.Problems.build('s5-1', { op: 'gcd', a: 3e7, b: 2 }); } catch (e) { /* */ } return Math.round(performance.now() - t0); });
  log('build gcd a=3e7 ms=' + tBig);

  // ---- M-01/M-02 세로셈(추가 사례 포함) ----
  const col = await page.evaluate(() => { const div = document.createElement('div'); const grab = () => ({ marks: [...div.querySelectorAll('tr.marks td')].map(td => td.textContent.trim()), res: [...div.querySelectorAll('tr.res td')].map(td => td.textContent.trim()), struck: [...div.querySelectorAll('td.struck')].map(td => td.textContent.trim()) }); const R = window.__app.MG.UI.renderHint; const r = {}; R(div, { model: 'column', data: { a: 47, b: 38, plus: true } }); r.a1 = grab(); R(div, { model: 'column', data: { a: 657, b: 268, plus: true } }); r.a2 = grab(); R(div, { model: 'column', data: { a: 85, b: 76, plus: true } }); r.a3 = grab(); R(div, { model: 'column', data: { a: 503, b: 178, plus: false } }); r.s1 = grab(); R(div, { model: 'column', data: { a: 62, b: 27, plus: false } }); r.s2 = grab(); R(div, { model: 'column', data: { a: 600, b: 178, plus: false } }); r.s3 = grab(); R(div, { model: 'column', data: { a: 45, b: 23, plus: false } }); r.s4 = grab(); return r; });
  log('column ' + JSON.stringify(col));
  expect(col.a1.marks.join(',') === ',1,' && col.a1.res.join('') === '85', `M-01 47+38: 받아올림 1이 십의 자리 위 ${JSON.stringify(col.a1)}`);
  expect(col.a2.marks.join(',') === ',1,1,' && col.a2.res.join('') === '925', `M-01 657+268 ${JSON.stringify(col.a2)}`);
  expect(col.a3.marks.join(',') === '1,1,' && col.a3.res.join('') === '161', `M-01 85+76: 최상위 넘침 1은 연산자 열 ${JSON.stringify(col.a3)}`);
  expect(col.s1.marks.join(',') === ',4,9,13' && col.s1.res.join('') === '325' && !col.s1.marks.some(m => m.includes('-')), `M-02 503−178: '-1' 없음 ${JSON.stringify(col.s1)}`);
  expect(col.s3.marks.join(',') === ',5,9,10' && col.s3.res.join('') === '422', `M-02 600−178 연쇄 받아내림 ${JSON.stringify(col.s3)}`);
  expect(col.s2.marks.join(',') === ',5,12' && col.s4.marks.join(',') === ',,' && col.s4.res.join('') === '22', `M-02 62−27 / 45−23(받아내림 없음) ${JSON.stringify(col.s4)}`);

  // ---- M-04: 비공개 랭킹에서 12명 기록·내가 12위 → '내 순위 12/12' + 내 행 1개 ----
  await page.evaluate(() => { const MG = window.__app.MG; MG.root.profiles.slice(6, 18).forEach((p, i) => { p.stageRecords['s2-3'] = { stageId: 's2-3', bestScore: 30000 - i * 100, bestStars: 2, bestCombo: 5, plays: 1, clears: 1, correct: 40, wrong: 5, reached: 1, avgMs: 3000, lastPlayedAt: new Date().toISOString() }; }); MG.root.settings.rankingPublic = false; MG.root.activeProfileId = 'p_sample02'; MG.save(); });
  await view('hall'); await sleep(200);
  await page.click('[data-action="hall-tab"][data-tab="score"]'); await sleep(200);
  await page.evaluate(() => { const s = document.getElementById('hall-stage'); s.value = 's2-3'; s.dispatchEvent(new Event('change')); }); await sleep(200);
  const priv = await page.evaluate(() => ({ note: (document.querySelector('#hall-view .note') || {}).textContent, rows: document.querySelectorAll('.rank-table tbody tr').length, me: document.querySelectorAll('.rank-table tr.me').length, empty: !!document.querySelector('#hall-view .empty') }));
  log('private ' + JSON.stringify(priv));
  expect(/내 순위 17\/17/.test(priv.note || '') && priv.rows === 1 && priv.me === 1 && !priv.empty, `M-04/F-02 비공개 랭킹 17명 중 최하위 → '내 순위 17/17' 내 행 1개 (${priv.note && priv.note.slice(-12)}, rows=${priv.rows})`);
  await page.evaluate(() => { window.__app.MG.root.settings.rankingPublic = true; window.__app.MG.save(); }); await view('hall'); await sleep(200);
  const pub = await page.evaluate(() => ({ rows: document.querySelectorAll('.rank-table tbody tr').length, lastMe: !!document.querySelector('.rank-table tbody tr:last-child.me'), lastNo: document.querySelector('.rank-table tbody tr:last-child .rank-no').textContent.trim() }));
  expect(pub.rows === 11 && pub.lastMe && pub.lastNo === '17', `M-04 공개 랭킹: 상위 10 + 내 행(17위) 덧붙임 ${JSON.stringify(pub)}`);
  await shot('rv-hall-public-11');
  await act('resetSample'); await sleep(300);

  // ---- M-05/F-01: PIN 게이트에서 초기화 실제 동작(확인 모달 → 샘플 복귀 → 게이트 해제) ----
  await page.evaluate(() => { window.__app.MG.root.settings.teacherPin = '4321'; window.__app.MG.root.profiles[0].name = '변경됨'; window.__app.MG.save(); });
  await view('settings'); await sleep(200);
  expect(await page.locator('#pin-gate').isVisible() && await page.locator('#settings-body').isHidden(), 'PIN 설정 시 게이트 표시·본문 숨김');
  await page.click('#pin-gate [data-action="reset-sample"]'); await sleep(200);
  expect(await page.locator('.modal .btn.danger').count() === 1, 'PIN 게이트 초기화 → 위험 확인 모달');
  await page.click('.modal .btn.danger'); await sleep(400);
  await view('settings'); await sleep(200);
  const afterReset = await page.evaluate(() => ({ pin: window.__app.MG.root.settings.teacherPin, name: window.__app.MG.root.profiles[0].name, gate: document.getElementById('pin-gate').hidden, body: document.getElementById('settings-body').hidden }));
  expect(afterReset.pin === null && afterReset.name === '김하늘' && afterReset.gate && !afterReset.body, `F-01/M-05 PIN 잊음 → 게이트 안 초기화로 해제 ${JSON.stringify(afterReset)}`);

  // ---- M-07: 전체화면 대상 ----
  expect(await page.evaluate(() => { const gv = document.getElementById('game-view'); return gv.contains(document.getElementById('input-panel')) && gv.contains(document.getElementById('game-canvas')) && gv.contains(document.querySelector('.hud')); }), 'M-07 전체화면 대상 #game-view가 캔버스·HUD·입력 패널 포함');

  // ---- M-08: 소수 스테이지 1,500회 + 키 교차 충돌(2-3·1-1·3-2·4-1·3-3) ----
  const gen = await page.evaluate(() => { const P = window.__app.MG.Problems; const keys = {}; const ids = ['s1-1', 's2-3', 's3-2', 's3-3', 's4-1', 's4-3', 's5-3', 's6-2', 's6-1']; for (const sid of ids) { keys[sid] = new Set(); for (let i = 0; i < 500; i++) keys[sid].add(P.generate(sid).key); } const bad = []; for (const sid of ['s4-3', 's5-3', 's6-2']) for (const k of keys[sid]) if (!k.includes('.')) bad.push(sid + ':' + k); const cross = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (const k of keys[ids[i]]) if (keys[ids[j]].has(k)) cross.push(ids[i] + '/' + ids[j] + ':' + k); return { bad: bad.slice(0, 5), cross: cross.slice(0, 5) }; });
  expect(gen.bad.length === 0 && gen.cross.length === 0, `M-08 소수 피연산자 보장·스테이지 간 사실 key 충돌 없음 ${JSON.stringify(gen)}`);

  // ---- M-06 + 보스전 회귀 후보: 정답 발사 직후 필살기 → 보스 locked 고착? ----
  await view('home'); await sleep(100);
  await act('setActive', 'p_sample01'); await act('startStage', 's2-3'); await sleep(200);
  let g = await game(); await act('fire', '12'); await sleep(50); g = await game();
  expect(g.wrong === 0 && g.combo === 0 && g.state === 'playing', `M-06 몬스터 없을 때 발사 무시 wrong=${g.wrong}`);
  // 보스 웨이브로 강제 이동(내부 상태 직접 조작: 테스트 전용) — MG.Game에 공개 API가 없으므로 10웨이브까지 필살기 게이지를 주고 몬스터를 처리한다
  await page.evaluate(() => { window.__app.MG.Game.__t = true; });
  // 1~9웨이브: 몬스터가 뜨면 정답을 쏴서 빠르게 진행(최대 150초 상한)
  const t0 = Date.now(); let reachedBoss = false;
  while (Date.now() - t0 < 170000) {
    g = await game(); if (!g) break;
    if (g.wave === 10 && g.monsters.some(m => m.isBoss)) { reachedBoss = true; break; }
    if (g.state === 'playing' && g.monsters.length) { const m = g.monsters.filter(x => !x.locked).sort((a, b) => b.progress - a.progress)[0]; if (m) { await act('fire', String(m.answer)); await sleep(230); continue; } }
    await sleep(120);
  }
  g = await game(); log(`boss reach=${reachedBoss} wave=${g && g.wave} score=${g && g.score} hp=${g && g.hp} gauge=${g && g.superGauge} secs=${Math.round((Date.now() - t0) / 1000)}`);
  expect(reachedBoss && g.hp === 3, `보스 도달(무피해) wave=${g.wave} hp=${g.hp}`);
  if (reachedBoss) {
    await waitGame(x => x.monsters.some(m => m.isBoss && m.progress > 0.02), 5000);
    const b = (await game()).monsters.find(m => m.isBoss);
    const gauge = (await game()).superGauge;
    if (gauge > 0) {
      await act('fire', String(b.answer)); await act('useSuper'); await sleep(400);
      g = await game(); const b2 = g.monsters.find(m => m.isBoss);
      log('boss after fire+super ' + JSON.stringify({ shields: b2 && b2.shields, locked: b2 && b2.locked, state: g.state, score: g.score }));
      // 이제 다음 방패 정답을 쏴 본다 → 격파되어야 정상
      if (b2 && b2.alive !== false) { await act('fire', String(b2.answer)); await sleep(400); g = await game(); const b3 = g.monsters.find(m => m.isBoss); log('boss after next fire ' + JSON.stringify({ shields: b3 && b3.shields, locked: b3 && b3.locked, state: g.state })); expect(!b3 || b3.shields < b2.shields || g.state === 'ended', `회귀 후보: 정답 발사 직후 필살기 뒤에도 보스를 계속 공격할 수 있다(locked=${b3 && b3.locked})`); }
    } else log('게이지 0 — 보스 잠금 시나리오 미실행');
  }
  await act('quit'); await sleep(600);

  // ---- U-03 회귀 후보: 긴 라벨 스테이지(5-1) 스폰 간격 — 데스크톱/400px에서 2번째 스폰까지 걸린 시간 ----
  const pacing = async (w, h) => {
    await page.setViewportSize({ width: w, height: h }); await view('home'); await sleep(100);
    await act('startStage', 's5-1'); await sleep(200);
    const first = await waitGame(x => x.monsters.length >= 1, 8000); const t1 = first.elapsedMs;
    const second = await waitGame(x => x.monsters.length >= 2 || x.reached > 0, 20000);
    const r = { w, firstAt: Math.round(t1), secondAt: Math.round(second.elapsedMs), gap: +((second.elapsedMs - t1) / 1000).toFixed(1), p1: second.monsters[0] && second.monsters[0].progress, texts: second.monsters.map(m => m.text), reached: second.reached };
    await shot(`rv-pacing-${w}`); await act('quit'); await sleep(500); return r;
  };
  const pd = await pacing(1280, 800); log('pacing desktop ' + JSON.stringify(pd));
  const pm = await pacing(400, 800); log('pacing mobile400 ' + JSON.stringify(pm));
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---- U-01: 400px에서 몬스터 라벨 실제 CSS px·HUD 분리 ----
  await page.setViewportSize({ width: 400, height: 800 }); await view('home'); await sleep(100);
  await act('startStage', 's2-3'); await sleep(200); await waitGame(x => x.monsters.length > 0 && x.monsters[0].progress > 0.1, 9000);
  const mob = await page.evaluate(() => { const c = document.getElementById('game-canvas').getBoundingClientRect(), h = document.querySelector('.hud').getBoundingClientRect(), ip = document.getElementById('input-panel').getBoundingClientRect(); const up = Math.max(1, Math.min(2.2, 640 / c.width)); return { canvasW: Math.round(c.width), canvasH: Math.round(c.height), hudBottom: Math.round(h.bottom), canvasTop: Math.round(c.top), labelCss: +(28 * up * c.width / 960).toFixed(1), panelTop: Math.round(ip.top), vh: innerHeight, sw: document.documentElement.scrollWidth, keyH: Math.round(document.querySelector('#input-panel .key').getBoundingClientRect().height) }; });
  log('mobile ' + JSON.stringify(mob));
  expect(mob.hudBottom <= mob.canvasTop + 1 && mob.labelCss >= 18 && mob.sw <= 400 && mob.keyH >= 56 && mob.panelTop + 100 < mob.vh, `U-01/AC16 400px: HUD 띠가 캔버스 위, 라벨 ${mob.labelCss}px, 키 ${mob.keyH}px, 가로 스크롤 없음`);
  await shot('rv-mobile-game');
  await act('quit'); await sleep(400); await page.setViewportSize({ width: 1280, height: 800 });

  // ---- U-04/U-05: 히트맵 칸 글자색·배지 가독성 ----
  await act('setActive', 'p_sample05'); await view('codex'); await sleep(200);
  const cx = await page.evaluate(() => { const c1 = document.querySelector('.hm-cell.box-1'), c2 = document.querySelector('.hm-cell.box-2'), c0 = document.querySelector('.hm-cell.box-0'), bd = document.querySelector('.badge:not(.got)'), bs = bd && bd.querySelector('small'); const cs = e => e && getComputedStyle(e); return { c1: cs(c1) && cs(c1).color, c2: cs(c2) && cs(c2).color, c0: cs(c0) && cs(c0).color, badgeOp: cs(bd) && cs(bd).opacity, badgeFilter: cs(bd) && cs(bd).filter, smallPx: bs && parseFloat(cs(bs).fontSize), smallText: bs && bs.textContent }; });
  log('codex ' + JSON.stringify(cx));
  expect(cx.c1 === 'rgb(29, 33, 64)' && cx.c2 === 'rgb(29, 33, 64)' && cx.c0 === 'rgb(255, 255, 255)', `U-04 주황·연두 칸 어두운 글자, 빨강 칸 흰 글자 (${cx.c1}/${cx.c2}/${cx.c0})`);
  expect(cx.badgeOp === '1' && cx.badgeFilter === 'none' && cx.smallPx >= 13, `U-05 미획득 배지 카드 흐림 없음, 조건 글자 ${cx.smallPx}px`);
  await shot('rv-codex-hayun');
  await page.emulateMedia({ colorScheme: 'dark' }); await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await sleep(100); await shot('rv-codex-hayun-dark'); await page.evaluate(() => { delete document.documentElement.dataset.theme; }); await page.emulateMedia({ colorScheme: 'light' });

  // ---- AC12: HUD 음소거 → 효과음 노드 0 → 새로고침 유지 (independent) ----
  await act('setActive', 'p_sample01'); await view('home'); await act('startStage', 's1-1'); await sleep(200);
  await page.evaluate(() => { const AC = window.AudioContext; window.__nodes = 0; const o = AC.prototype.createOscillator, bsrc = AC.prototype.createBufferSource; AC.prototype.createOscillator = function () { window.__nodes++; return o.call(this); }; AC.prototype.createBufferSource = function () { window.__nodes++; return bsrc.call(this); }; });
  await page.click('.hud [data-action="toggle-mute"]'); await sleep(100);
  g = await waitGame(x => x.monsters.length > 0, 8000); await act('fire', String(g.monsters[0].answer)); await sleep(400);
  const nodes = await page.evaluate(() => window.__nodes); const mutedNow = (await state()).muted;
  expect(mutedNow && nodes === 0, `AC12 HUD 음소거 후 격파 시 오디오 노드 생성 0 (nodes=${nodes}, muted=${mutedNow})`);
  await reload(); await sleep(300);
  expect((await state()).settings.muted === true && (await page.locator('.toolbar [data-action="toggle-mute"]').textContent()).includes('🔇'), 'AC12 새로고침 후 음소거 유지');
  await act('setSetting', 'muted', false);

  // ---- 저장 경고 배지 숨김 상태·외부 요청 없음은 pw-check로 확인. 추가: alert/confirm/prompt 소스 검사 ----
  const src = await page.evaluate(async () => { const files = ['js/app.js', 'js/ui.js', 'js/game.js', 'js/problems.js', 'js/audio.js', 'js/data.js']; let hits = []; for (const f of files) { try { const t = await (await fetch(f)).text(); const m = t.match(/\b(window\.)?(alert|confirm|prompt)\s*\(/g); if (m) hits.push(f + ':' + m.length); } catch (e) { hits.push(f + ':fetch-fail'); } } return hits; });
  log('alert/confirm/prompt scan ' + JSON.stringify(src));
};
