// ux-extra.js — ux-play.js에서 빠진 장면 보충 + 추가 UX 검증 측정
// (복수 몬스터, 성 피격, 웨이브 7 다중 몬스터, 게임 오버 결과, 타이머 HUD, 긴 라벨 겹침,
//  짧은 폰(400x667) 토스트-발사 버튼 겹침, 1366x768 교정 카드 잘림, 1920 전자칠판 큰 글씨, A4 인쇄, 프로필 0명, 포커스 링)
'use strict';
const path = require('path');
module.exports = async ({ page, expect, log, sleep }) => {
  const outdir = path.join(__dirname, 'extra');
  require('fs').mkdirSync(outdir, { recursive: true });
  const snap = async (name, full) => { const p = path.join(outdir, name + '.png'); await page.screenshot({ path: p, fullPage: !!full }); log('shot ' + p); return p; };
  const act = code => page.evaluate(code);
  const state = () => page.evaluate(() => window.__app.getState());
  const setTheme = t => page.evaluate(t => { document.documentElement.dataset.theme = t; }, t);
  const vp = (w, h) => page.setViewportSize({ width: w, height: h });
  const pidOf = async name => (await state()).profiles.find(p => p.name === name).id;
  const solveCard = async () => {
    await page.evaluate(() => { const g = window.__app.getState().game; const m = g.monsters.slice().sort((a, b) => b.progress - a.progress)[0]; const p = window.__app.MG.Pad.active; if (!m || !p) return;
      if (m.choices) p.key(String(m.correctIndex + 1)); else { for (const ch of String(m.answerText)) p.key(ch); p.key('fire'); } });
    await sleep(800);
  };
  const waitFor = async (pred, ms = 15000, step = 100) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await state(); if (pred(s)) return s; await sleep(step); } return null; };
  const liveMonsters = g => g.monsters.filter(m => !m.locked && m.progress > 0.02);
  const frontOf = ms => ms.slice().sort((a, b) => b.progress - a.progress)[0];
  // 캔버스·HUD·키패드 치수와 라벨 실제 px 크기 측정
  const measure = () => page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), font: getComputedStyle(e).fontSize }; };
    const c = document.getElementById('game-canvas').getBoundingClientRect();
    return { viewport: [innerWidth, innerHeight], canvas: { w: Math.round(c.width), h: Math.round(c.height), labelPx: +(28 * c.width / 960).toFixed(1), bigLabelPx: +(34 * c.width / 960).toFixed(1), monsterRadiusPx: +(26 * c.width / 960).toFixed(1) },
      hudHeight: r('.hud') && r('.hud').h, hudIconBtn: r('.hud-btn.icon'), superBtn: r('#super-btn'), key: r('.key'), fire: r('.key-fire'), score: r('#hud-score'), wave: r('#hud-wave'), choice: r('.choice-btn') };
  });

  await vp(1280, 800); await setTheme('light');
  await act(`window.__app.actions.setActive('${await pidOf('이도윤')}')`); await sleep(200);
  await act(`window.__app.actions.setSetting('timeLimitMin', 0)`);
  await act(`window.__app.actions.setSetting('unlockAll', true)`);

  // ---- A) 치수 측정(데스크톱/태블릿/모바일/짧은 폰) ----
  await act(`window.__app.actions.startStage('s2-3')`); await sleep(600);
  log('metrics-desktop ' + JSON.stringify(await measure()));
  await vp(820, 1100); await sleep(300); log('metrics-tablet ' + JSON.stringify(await measure()));
  await vp(400, 800); await sleep(300); log('metrics-mobile ' + JSON.stringify(await measure()));
  await vp(400, 667); await sleep(300); log('metrics-mobile667 ' + JSON.stringify(await measure()));
  // ---- B) 짧은 폰에서 토스트가 sticky 입력 패널의 발사 버튼을 가리는지 ----
  await act(`window.__app.actions.toast('🏅 배지 획득: 첫 격파', 'success', 8000); window.__app.actions.toast('저장됨', 'success', 8000)`); await sleep(300);
  await snap('mobile667-toast-over-fire');
  const overlap = await page.evaluate(() => { const ts = [...document.querySelectorAll('.toast')]; const f = document.querySelector('.key-fire'); if (!ts.length || !f) return null; const b = f.getBoundingClientRect();
    return ts.map(t => { const a = t.getBoundingClientRect(); return { toast: [Math.round(a.left), Math.round(a.top), Math.round(a.right), Math.round(a.bottom)], fire: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], overlaps: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top }; }); });
  log('toast-overlap-400x667 ' + JSON.stringify(overlap));
  expect(!(overlap || []).some(o => o.overlaps), '400x667에서 토스트가 발사 버튼을 가리지 않음');
  await act(`window.__app.actions.quit()`); await sleep(900);

  // ---- C) 1366x768 노트북: 나눗셈 묶음 모델 교정 카드에서 발사 버튼이 보이는지 ----
  await vp(1366, 768); await sleep(200);
  await act(`window.__app.actions.startStage('s3-2')`); await sleep(400);
  await waitFor(s => s.game && s.game.monsters.length && s.game.monsters[0].progress > 0.05);
  await act(`window.__app.actions.fire('999')`); await sleep(1500); // fix-r1: '1'은 5÷5처럼 정답일 수 있어 확실히 틀린 값으로 교정 카드를 연다
  const cardFit = await page.evaluate(() => { const m = document.querySelector('.modal'); const f = document.querySelector('.modal .key-fire'); if (!m || !f) return null; const b = f.getBoundingClientRect();
    return { question: document.querySelector('.card-q').textContent, modalScrollH: m.scrollHeight, modalClientH: m.clientHeight, fireTop: Math.round(b.top), fireBottom: Math.round(b.bottom), viewportH: innerHeight, fireFullyVisible: b.bottom <= innerHeight && b.top >= 0 }; });
  log('card-fit-1366x768 ' + JSON.stringify(cardFit));
  expect(cardFit && cardFit.fireFullyVisible, '1366x768에서 교정 카드(나눗셈 묶음)의 발사 버튼이 스크롤 없이 보임');
  await snap('laptop1366-card-array-div');
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(900);
  // 같은 검사를 1280x800에서(5-2 통분 막대 + 3지선다)
  await vp(1280, 800); await sleep(200);
  await act(`window.__app.actions.startStage('s5-2')`); await sleep(400);
  await waitFor(s => s.game && s.game.monsters.length && s.game.monsters[0].progress > 0.05);
  await page.evaluate(() => { const g = window.__app.getState().game; const m = g.monsters[0]; window.__app.actions.choose((m.correctIndex + 1) % 3); }); await sleep(1800);
  const cardFit2 = await page.evaluate(() => { const m = document.querySelector('.modal'); const f = document.querySelector('.modal .choice-btn:last-child'); if (!m || !f) return null; const b = f.getBoundingClientRect();
    return { question: document.querySelector('.card-q').textContent, modalScrollH: m.scrollHeight, modalClientH: m.clientHeight, lastChoiceBottom: Math.round(b.bottom), viewportH: innerHeight, fullyVisible: b.bottom <= innerHeight }; });
  log('card-fit-1280x800-lcd ' + JSON.stringify(cardFit2));
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(900);

  // ---- D) 긴 라벨 겹침: 5-1 웨이브 3에서 몬스터 2마리 동시 ----
  await act(`window.__app.actions.startStage('s5-1')`); await sleep(400);
  {
    const t0 = Date.now(); let shot = false;
    while (Date.now() - t0 < 150000) {
      const g = (await state()).game; if (!g || g.state === 'ended') break;
      if (g.state === 'card') { await sleep(1200); await solveCard(); continue; }
      if (g.state !== 'playing') { await sleep(150); continue; }
      const ms = liveMonsters(g);
      if (g.wave >= 3) {
        if (ms.length >= 2 && ms.every(m => m.progress > 0.08)) { await sleep(400); await snap('longlabel-two-monsters'); log('longlabel monsters ' + JSON.stringify(ms.map(m => [m.text, m.progress]))); shot = true; break; }
        if (ms.length && frontOf(ms).progress > 0.85) { await act(`window.__app.actions.fire('${frontOf(ms).answer}')`); }
        await sleep(150); continue;
      }
      if (!ms.length) { await sleep(120); continue; }
      await act(`window.__app.actions.fire('${frontOf(ms).answer}')`); await sleep(300);
    }
    expect(shot, '5-1 웨이브 3에서 몬스터 2마리 동시 화면 촬영');
  }
  await act(`window.__app.actions.quit()`); await sleep(900);

  // ---- E) 복수 몬스터 · 성 피격 · 웨이브 7 몬스터 3마리 (2-3) ----
  await act(`window.__app.actions.startStage('s2-3')`); await sleep(400);
  {
    const flags = { wrong: false, revenge: false, damage: false, wave7: false };
    const t0 = Date.now();
    while (Date.now() - t0 < 220000) {
      const g = (await state()).game; if (!g || g.state === 'ended') break;
      if (g.state === 'card') { await sleep(1200); await solveCard(); continue; }
      if (g.state !== 'playing') { await sleep(150); continue; }
      const ms = liveMonsters(g);
      if (!ms.length) { await sleep(120); continue; }
      if (!flags.wrong) { flags.wrong = true; await act(`window.__app.actions.fire('1')`); await sleep(1500); continue; }
      const rev = g.monsters.find(m => m.isRevenge && !m.locked);
      if (rev && !flags.revenge) {
        if (rev.progress < 0.25) { await sleep(120); continue; }
        flags.revenge = true; await snap('revenge-monster'); await setTheme('dark'); await sleep(100); await snap('revenge-monster--dark'); await setTheme('light');
        await vp(400, 800); await sleep(300); await snap('revenge-monster--mobile'); await vp(1280, 800); await sleep(300);
        // 복수 격파 플로팅 텍스트
        await act(`window.__app.actions.fire('${rev.answer}')`); await sleep(260); await snap('revenge-kill-float'); await sleep(200); continue;
      }
      if (flags.revenge && !flags.damage) {
        const f = frontOf(ms);
        if (f.progress < 0.96) { await sleep(100); continue; }
        await waitFor(s => s.game && s.game.hp < 3, 5000, 40); flags.damage = true; await snap('castle-hit-hearts2'); continue;
      }
      if (g.wave >= 7 && !flags.wave7) {
        if (ms.length >= 3) { flags.wave7 = true; await snap('wave7-three-monsters'); log('wave7 monsters ' + JSON.stringify(ms.map(m => [m.text, m.progress]))); break; }
        if (frontOf(ms).progress > 0.8) { await act(`window.__app.actions.fire('${frontOf(ms).answer}')`); }
        await sleep(150); continue;
      }
      await act(`window.__app.actions.fire('${frontOf(ms).answer}')`); await sleep(300);
    }
    log('flags ' + JSON.stringify(flags));
    expect(flags.revenge, '복수 몬스터 촬영'); expect(flags.damage, '성 피격(하트 2) 촬영'); expect(flags.wave7, '웨이브 7 몬스터 3마리 촬영');
  }
  await act(`window.__app.actions.quit()`); await sleep(900);

  // ---- F) 게임 오버 결과(빠르게, 입력 없음) 4뷰 ----
  await act(`window.__app.actions.setSetting('speedPreset', 'fast')`);
  await act(`window.__app.actions.startStage('s1-1')`); await sleep(500);
  await waitFor(s => !s.game || s.game.state === 'ended', 100000, 400); await sleep(1300);
  expect((await state()).view === 'result', '게임 오버 후 결과 화면 표시');
  await snap('result-gameover--desktop-light'); await setTheme('dark'); await sleep(150); await snap('result-gameover--desktop-dark'); await setTheme('light');
  await vp(820, 1100); await sleep(250); await snap('result-gameover--tablet');
  await vp(400, 800); await sleep(300); await snap('result-gameover--mobile', true); await vp(1280, 800); await sleep(200);
  await act(`window.__app.actions.setSetting('speedPreset', 'normal')`);
  // 게임 오버 결과의 '다시 풀기'(미응답 문제) → 복습 모달 → 모두 풀기 → 홈 탭 실제 클릭 가능 여부
  if (await page.$('[data-action="review"]')) {
    await page.click('[data-action="review"]'); await sleep(1200);
    await snap('review-modal-reached');
    for (let i = 0; i < 6; i++) { if (!await page.$('.modal')) break; await page.evaluate(() => { const p = window.__app.MG.Pad.active; const q = document.querySelector('.card-q'); if (!p || !q) return; const m = q.textContent.match(/^(\d+)\s*([+−])\s*(\d+)/); if (!m) return; const v = m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]; for (const ch of String(v)) p.key(ch); p.key('fire'); }); await sleep(900); }
    expect(!(await page.$('.modal')), '복습 모달이 모두 닫힘');
    await sleep(300); await snap('result-gameover-after-review');
    let ok = true; try { await page.click('#main-tabs [data-view="home"]', { timeout: 5000 }); } catch (e) { ok = false; log('home tab click failed: ' + String(e.message).split('\n')[0]); }
    expect(ok, '복습 후 홈 탭을 실제 클릭할 수 있음'); await sleep(300);
    log('view after home click: ' + (await state()).view);
  }

  // ---- G) 시간 제한 HUD ----
  await act(`window.__app.actions.setSetting('timeLimitMin', 3)`);
  await act(`window.__app.actions.startStage('s2-3')`); await sleep(1500);
  await snap('hud-timer-3min');
  log('hud-time ' + (await page.evaluate(() => document.getElementById('hud-time').textContent)));
  await act(`window.__app.actions.quit()`); await sleep(900);
  await act(`window.__app.actions.setSetting('timeLimitMin', 5)`);

  // ---- H) 전자칠판 1920x1080 + 큰 글씨 ----
  await vp(1920, 1080); await act(`window.__app.actions.setSetting('bigText', true); document.body.classList.add('big-text')`);
  await act(`window.__app.actions.showView('home')`); await sleep(300); await snap('whiteboard1920-home');
  await act(`window.__app.actions.startStage('s2-3')`); await sleep(400);
  await waitFor(s => s.game && s.game.monsters.length && s.game.monsters[0].progress > 0.1); await snap('whiteboard1920-game-bigtext');
  log('metrics-1920-bigtext ' + JSON.stringify(await measure()));
  await act(`window.__app.actions.quit()`); await sleep(900);
  await act(`window.__app.actions.setSetting('bigText', false); document.body.classList.remove('big-text')`);
  await vp(1280, 800);

  // ---- I) 오늘 기록이 있는 인쇄 기록표(A4 근사 794x1123) ----
  await page.evaluate(() => {
    const MG = window.__app.MG, now = new Date().toISOString();
    const mk = (sid, score, stars, c, w, r, keys) => ({ stageId: sid, score, stars, correct: c, wrong: w, reached: r, maxCombo: 9, avgMs: 2500, revengeKills: 1, wrongKeys: keys, endedBy: 'clear', playedAt: now });
    const ps = MG.root.profiles;
    ps[0].history.unshift(mk('s2-3', 18200, 2, 44, 4, 1, ['7×8', '6×9'])); ps[1].history.unshift(mk('s2-2', 7900, 1, 33, 8, 2, ['62−27', '81−36', '53−18']));
    ps[2].history.unshift(mk('s3-2', 12100, 2, 45, 3, 0, ['72÷8'])); ps[3].history.unshift(mk('s2-3', 29100, 3, 50, 0, 0, [])); ps[4].history.unshift(mk('s3-4', 14000, 2, 43, 5, 1, ['59÷7 나머지', '83÷6 몫']));
    ps[5].history.unshift(mk('s1-1', 4100, 1, 31, 6, 3, ['4+5', '3+6', '2+7', '1+8', '5+4', '6+3']));
  });
  await act(`window.__app.actions.showView('hall')`); await sleep(400);
  await act(`window.print = () => {}`); await page.click('[data-action="print-today"]'); await sleep(300);
  await page.emulateMedia({ media: 'print' }); await sleep(200);
  await vp(794, 1123); await sleep(200);
  await snap('print-today-rows-a4', true);
  log('print-table-width ' + JSON.stringify(await page.evaluate(() => { const t = document.querySelector('#print-root table'); return t ? { tableW: Math.round(t.getBoundingClientRect().width), docW: document.documentElement.clientWidth, font: getComputedStyle(t).fontSize, rows: t.rows.length } : null; })));
  await page.emulateMedia({ media: 'screen' }); await vp(1280, 800); await sleep(200);
  // 인쇄 후 명예의 전당 화면 그대로인지(print-root가 화면에 보이지 않는지)
  await snap('hall-after-print');
  log('print-root-visible-on-screen ' + (await page.evaluate(() => { const e = document.getElementById('print-root'); return getComputedStyle(e).display; })));

  // ---- J) 포커스 링(키보드 Tab) ----
  await act(`window.__app.actions.showView('home')`); await sleep(300);
  await page.mouse.click(640, 700); for (let i = 0; i < 9; i++) await page.keyboard.press('Tab');
  await sleep(150); log('focused ' + (await page.evaluate(() => { const e = document.activeElement; return e.tagName + '.' + e.className + ' ' + (e.textContent || '').trim().slice(0, 20); })));
  await snap('focus-ring-home');

  // ---- K) 프로필 0명 빈 상태(홈·프로필 메뉴·명예의 전당) — 마지막에 실행(상태 파괴) ----
  await page.evaluate(() => { const MG = window.__app.MG; MG.root.profiles = []; MG.root.activeProfileId = null; MG.UI.renderProfileBar(); MG.UI.showView('home'); });
  await sleep(300); await page.click('#profile-btn'); await sleep(200); await snap('empty-profiles-home-menu');
  await page.keyboard.press('Escape'); await page.mouse.click(640, 700);
  await act(`window.__app.actions.showView('hall')`); await sleep(300); await snap('empty-profiles-hall');
  await act(`window.__app.actions.showView('settings')`); await sleep(300); await snap('empty-profiles-settings');
  log('done');
};
