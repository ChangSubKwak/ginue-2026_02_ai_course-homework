// 연산수호대 설명서용 스크린샷 촬영 모듈 (pw-run.js용)
// node _dev/tools/pw-run.js <index.html> _dev/docshots/math-guardians.js <docs/screens>
// 정적 화면(홈·도감·랭킹·설정·도움말·다크)을 샘플 데이터 그대로 먼저 찍고, 그 뒤 게임을 자동 플레이해 전투·카드·복수·보스·결과·모바일을 찍는다.
'use strict';
const path = require('path');
module.exports = async ({ page, expect, sleep, log }) => {
  const outdir = process.argv[4] || path.join(__dirname, 'out');
  const snap = async (name, full) => {
    await page.waitForTimeout(400);
    const p = path.join(outdir, name + '.png');
    await page.screenshot({ path: p, fullPage: !!full });
    log('shot ' + p);
  };
  const act = (code) => page.evaluate(code);
  const state = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await state()).game;
  const closeModal = async () => { await page.keyboard.press('Escape'); await sleep(300); };
  const setVp = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await sleep(300); };
  // 교정 카드가 열려 있으면 정답을 키보드로 입력해 닫는다
  const solveCard = async () => {
    const g = await game(); if (!g || g.state !== 'card') return false;
    const ans = await page.evaluate(() => { const G = window.__app.getState().game; const t = G.monsters.sort((a, b) => b.progress - a.progress)[0]; return t ? t.answerText : null; });
    if (ans == null) return false;
    await sleep(1600); // 시각 모델 애니메이션 종료 대기
    await page.keyboard.type(String(ans)); await page.keyboard.press('Enter'); await sleep(700);
    return true;
  };
  // 자동 플레이: 가장 앞선(조준되지 않은) 몬스터의 정답을 발사. stopWhen(g)이 true면 중단.
  // hold: { revenge: true } 복수 몬스터는 progress 0.5까지 쏘지 않음, { boss: true } 보스는 progress 0.15까지 쏘지 않음(촬영용)
  const autoPlay = async (stopWhen, maxMs, hold) => {
    hold = hold || {}; const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const g = await game(); if (!g || g.state === 'ended') return g;
      if (stopWhen && stopWhen(g)) return g;
      if (g.state === 'card') { await solveCard(); continue; }
      if (g.state === 'playing') {
        const vis = g.monsters.filter(m => !m.locked && m.spawnedAt <= g.elapsedMs && m.progress > 0.2).sort((a, b) => b.progress - a.progress)
          .filter(m => !(hold.revenge && m.isRevenge && m.progress < 0.5)).filter(m => !(hold.boss && m.isBoss && m.progress < 0.15));
        if (vis.length) await page.evaluate(ans => window.__app.actions.fire(ans), String(vis[0].answerText));
      }
      await sleep(200);
    }
    return await game();
  };

  // ---------- 정적 화면(샘플 데이터 원본 상태) ----------
  await sleep(600);
  // 01 홈(김하늘, 2학년 탭: 곱셈구구 19,800 ★★☆)
  await page.click('[data-action="grade-tab"][data-grade="2"]');
  await sleep(300);
  expect(await page.locator('.stage-card').count() === 3, '01 2학년 스테이지 카드 3개');
  await snap('01-home', true);

  // 12 다크 모드 홈(3학년 탭: 3-3 열림·3-4 잠김)
  await act(() => window.__app.actions.toggleTheme());
  await page.click('[data-action="grade-tab"][data-grade="3"]');
  await sleep(400);
  expect(await page.locator('.stage-card.locked').count() === 1, '12 3-4 잠김 카드');
  await snap('12-dark', true);
  await act(() => window.__app.actions.toggleTheme());
  await sleep(200);

  // 07 도감: 이도윤(약점 7개) 2-3 히트맵 + 8×7 툴팁
  await act(() => window.__app.actions.setActive('p_sample02'));
  await sleep(200);
  await act(() => window.__app.actions.showView('codex'));
  await sleep(400);
  expect(await page.locator('.hm-cell.box-0').count() >= 4, '07 히트맵 빨간 칸');
  await page.click('.hm-cell[data-key="8×7"]');
  await sleep(200);
  await setVp(1280, 1150);
  await snap('07-codex', false);
  await setVp(1280, 800);

  // 08 명예의 전당: 점수 탭 2-3(최민준 28,400 / 정하윤 24,150 / 김하늘 19,800)
  await act(() => window.__app.actions.showView('hall'));
  await sleep(300);
  await page.selectOption('#hall-stage', 's2-3');
  await sleep(500);
  expect(await page.locator('.rank-table tbody tr').count() >= 5, '08 순위표 행');
  await snap('08-hall', true);

  // 09 선생님 설정(위쪽: 게임 설정~교사 PIN 입력란) + 09b(아래쪽: 프로필 표 하단·명단 CSV·데이터 섹션)
  await act(() => window.__app.actions.showView('settings'));
  await sleep(400);
  await act(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await setVp(1280, 1340);
  await act(() => window.scrollTo(0, 0));
  await snap('09-settings', false);
  await setVp(1280, 1000);
  await act(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(300);
  await act(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await snap('09b-settings-data', false);
  await setVp(1280, 800);

  // 10 도움말 모달
  await act(() => window.__app.actions.showView('home'));
  await sleep(200);
  await page.click('[data-action="help"]');
  await sleep(300);
  expect(await page.locator('.modal .help').count() === 1, '10 도움말 모달');
  await snap('10-help', false);
  await closeModal();

  // ---------- 게임(김하늘, 2-3 곱셈구구, 시간 제한 없음) ----------
  await act(() => { window.__app.actions.setActive('p_sample01'); window.__app.actions.setSetting('timeLimitMin', 0); });
  await sleep(200);
  await act(() => window.__app.actions.startStage('s2-3'));
  await sleep(3300);
  let g = await game();
  expect(g && g.monsters.length >= 1, '02 몬스터 등장');
  await snap('02-game-wave1', false);

  // 03 교정 카드: 오답 발사 → 점 배열 모델
  g = await game();
  const first = g.monsters[0];
  await page.evaluate(ans => window.__app.actions.fire(ans), String(first.answer + 1));
  await sleep(1700);
  expect(await page.locator('.card-modal').count() === 1, '03 교정 카드 표시');
  await snap('03-card-array', false);
  await page.keyboard.type(String(first.answerText)); await page.keyboard.press('Enter');
  await sleep(900);

  // 04 복수 몬스터: 자동 플레이로 진행하다 복수 몬스터가 화면 안에 들어오면 촬영
  g = await autoPlay(x => x.monsters.some(m => m.isRevenge && m.progress >= 0.15), 90000, { revenge: true });
  expect(g && g.monsters.some(m => m.isRevenge), '04 복수 몬스터 등장');
  await snap('04-revenge', false);

  // 05 보스: 10웨이브 보스가 화면에 들어오면 촬영
  g = await autoPlay(x => x.wave === 10 && x.monsters.some(m => m.isBoss && m.progress >= 0.12), 300000, { boss: true });
  expect(g && g.wave === 10 && g.monsters.some(m => m.isBoss && m.shields === 3), '05 보스(방패 3) 등장');
  await snap('05-boss', false);

  // 06 결과 화면(클리어)
  g = await autoPlay(null, 120000);
  await sleep(2800);
  expect(await page.locator('#result-view:not([hidden])').count() === 1, '06 결과 화면 표시');
  await setVp(1280, 1100);
  await snap('06-result', false);
  await setVp(1280, 800);

  // 11 모바일 400px 게임 화면(1-1)
  await setVp(400, 820);
  await act(() => window.__app.actions.startStage('s1-1'));
  await sleep(3500);
  g = await game();
  expect(g && g.monsters.length >= 1, '11 모바일 몬스터 등장');
  await snap('11-mobile-game', false);
  await act(() => window.__app.actions.quit());
  await sleep(800);
  await setVp(1280, 800);
};
