// ux-play.js — 실제 플레이 진행 스크린샷: 콤보 HUD·복수 몬스터·보스·클리어 결과·복습 모달·게임 오버 결과·다음 스테이지 해금
'use strict';
const path = require('path');
module.exports = async ({ page, expect, log, sleep }) => {
  const outdir = path.join(__dirname, 'play');
  require('fs').mkdirSync(outdir, { recursive: true });
  const VP = { desktop: { width: 1280, height: 800 }, tablet: { width: 820, height: 1100 }, mobile: { width: 400, height: 800 } };
  const setTheme = t => page.evaluate(t => { document.documentElement.dataset.theme = t; }, t);
  const snap = async (name, full) => { const p = path.join(outdir, name + '.png'); await page.screenshot({ path: p, fullPage: !!full }); log('shot ' + p); return p; };
  const multi = async (name, full = true) => {
    for (const v of ['desktop-light', 'desktop-dark', 'tablet', 'mobile']) {
      if (v === 'desktop-light') { await page.setViewportSize(VP.desktop); await setTheme('light'); }
      if (v === 'desktop-dark') { await page.setViewportSize(VP.desktop); await setTheme('dark'); }
      if (v === 'tablet') { await page.setViewportSize(VP.tablet); await setTheme('light'); }
      if (v === 'mobile') { await page.setViewportSize(VP.mobile); await setTheme('light'); }
      await sleep(250); await snap(`${name}--${v}`, v === 'mobile' ? true : full);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(!sw, `${name} ${v}: 가로 스크롤 없음`);
    }
    await page.setViewportSize(VP.desktop); await setTheme('light'); await sleep(150);
  };
  const act = code => page.evaluate(code);
  const state = () => page.evaluate(() => window.__app.getState());
  const pidOf = async name => (await state()).profiles.find(p => p.name === name).id;
  const solveCard = async () => {
    await page.evaluate(() => { const g = window.__app.getState().game; const m = g.monsters.slice().sort((a, b) => b.progress - a.progress)[0]; const p = window.__app.MG.Pad.active; if (!m || !p) return;
      if (m.choices) p.key(String(m.correctIndex + 1)); else { for (const ch of String(m.answerText)) p.key(ch); p.key('fire'); } });
    await sleep(800);
  };
  await page.setViewportSize(VP.desktop); await setTheme('light');

  // ---- 1) 이도윤으로 2-3 곱셈구구 한 판 자동 클리어 (오답 1회 → 복수 몬스터, 콤보 HUD, 보스) ----
  await act(`window.__app.actions.setActive('${await pidOf('이도윤')}')`); await sleep(200);
  await act(`window.__app.actions.setSetting('timeLimitMin', 0)`);
  await act(`window.__app.actions.startStage('s2-3')`); await sleep(1500);
  const flags = { wrongDone: false, revengeShot: false, comboShot: false, bossShot: false, bossDarkShot: false, waveShot: false, floatShot: false };
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    const g = (await state()).game;
    if (!g || g.state === 'ended') break;
    if (g.state === 'card') { await sleep(1200); await solveCard(); continue; }
    if (g.state !== 'playing') { await sleep(200); continue; }
    const ms = g.monsters.filter(m => !m.locked && m.progress > 0.02);
    if (!ms.length) { await sleep(150); continue; }
    // 첫 몬스터는 일부러 틀린다 → 교정 카드·복수 큐
    if (!flags.wrongDone) { flags.wrongDone = true; await act(`window.__app.actions.fire('1')`); await sleep(1500); await snap('play-card-first-wrong'); continue; }
    const rev = ms.find(m => m.isRevenge);
    if (rev && !flags.revengeShot && rev.progress > 0.15) { flags.revengeShot = true; await snap('play-revenge-monster'); await setTheme('dark'); await sleep(100); await snap('play-revenge-monster--dark'); await setTheme('light'); }
    if (g.combo >= 10 && !flags.comboShot) { flags.comboShot = true; await sleep(200); await snap('play-hud-combo10'); await page.setViewportSize(VP.mobile); await sleep(300); await snap('play-hud-combo10--mobile'); await page.setViewportSize(VP.desktop); await sleep(200); }
    if (g.wave >= 7 && !flags.waveShot && ms.length >= 3) { flags.waveShot = true; await snap('play-wave7-three-monsters'); }
    if (g.monsters.some(m => m.isBoss) && !flags.bossShot) { flags.bossShot = true; await sleep(300); await snap('play-boss'); await page.setViewportSize(VP.mobile); await sleep(300); await snap('play-boss--mobile', true); await page.setViewportSize(VP.desktop); await sleep(200); }
    // 콤보 10 이후 필살기 한 번 사용 시연(보스 전)
    if (g.superGauge > 0 && g.combo >= 12 && g.wave < 10 && !flags.superUsed) { flags.superUsed = true; await act(`window.__app.actions.useSuper()`); await sleep(120); await snap('play-super-flash'); continue; }
    const target = ms.sort((a, b) => b.progress - a.progress)[0];
    await act(`window.__app.actions.fire('${target.answer}')`);
    if (!flags.floatShot && g.correct >= 2) { flags.floatShot = true; await sleep(260); await snap('play-hit-particles'); }
    await sleep(350);
  }
  const g1 = (await state()).game; log('end state ' + JSON.stringify(g1 && { state: g1.state, wave: g1.wave, score: g1.score, hp: g1.hp, correct: g1.correct, wrong: g1.wrong, reached: g1.reached }));
  await sleep(2600);
  expect((await state()).view === 'result', '클리어 후 결과 화면 표시');
  await multi('result-clear');
  // 복습 모달
  const hasReview = await page.$('[data-action="review"]');
  if (hasReview) { await page.click('[data-action="review"]'); await sleep(1400); await multi('review-modal', false); await solveCard(); await sleep(500); await snap('result-after-review'); }
  // 다음 스테이지 버튼 → 홈 3학년 카드 상태
  await page.click('[data-action="nav"][data-view="home"]'); await sleep(200);
  await page.click('[data-action="grade-tab"][data-grade="2"]'); await sleep(200); await snap('home-after-clear-g2');
  // 도감 히트맵 갱신 확인
  await page.click('#main-tabs [data-view="codex"]'); await sleep(300); await snap('codex-after-play');
  // 명예의 전당 갱신
  await page.click('#main-tabs [data-view="hall"]'); await sleep(600); await snap('hall-after-play');
  // 인쇄 미리보기(오늘 기록 있음)
  await act(`window.print = () => {}`); await page.click('[data-action="print-today"]'); await sleep(300);
  await page.emulateMedia({ media: 'print' }); await sleep(200); await snap('print-today-rows', true); await page.emulateMedia({ media: 'screen' });

  // ---- 2) 게임 오버: 1-1 빠르게, 입력하지 않고 방치 ----
  await act(`window.__app.actions.setSetting('speedPreset', 'fast')`);
  await act(`window.__app.actions.startStage('s1-1')`); await sleep(500);
  const t1 = Date.now(); let dmgShot = false;
  while (Date.now() - t1 < 70000) { const g = (await state()).game; if (!g || g.state === 'ended') break; if (g.hp < 3 && !dmgShot) { dmgShot = true; await snap('play-hp2-after-damage'); } await sleep(400); }
  await sleep(1200);
  await multi('result-gameover');
  await act(`window.__app.actions.setSetting('speedPreset', 'normal')`);

  // ---- 3) 시간 제한 HUD 표시(3분) ----
  await act(`window.__app.actions.setSetting('timeLimitMin', 3)`);
  await act(`window.__app.actions.startStage('s2-3')`); await sleep(1800);
  await snap('play-hud-timer'); await page.setViewportSize(VP.tablet); await sleep(300); await snap('play-hud-timer--tablet'); await page.setViewportSize(VP.desktop);
  await act(`window.__app.actions.quit()`); await sleep(800);
  await act(`window.__app.actions.setSetting('timeLimitMin', 5)`);
  log('done');
};
