// ux-shots.js — 연산수호대 모든 화면/모달/상태 스크린샷 (데스크톱 1280 라이트·다크, 태블릿 820, 모바일 400 fullPage)
'use strict';
const path = require('path');
module.exports = async ({ page, expect, log, sleep }) => {
  const outdir = path.join(__dirname, 'shots');
  require('fs').mkdirSync(outdir, { recursive: true });
  const VP = { desktop: { width: 1280, height: 800 }, tablet: { width: 820, height: 1100 }, mobile: { width: 400, height: 800 } };
  const setTheme = t => page.evaluate(t => { document.documentElement.dataset.theme = t; }, t);
  const snap = async (name, opts = {}) => { const p = path.join(outdir, name + '.png'); await page.screenshot({ path: p, fullPage: !!opts.full }); log('shot ' + p); return p; };
  // 한 화면을 4가지 뷰로 촬영 (게임 화면은 리사이즈 이벤트 반영을 위해 잠깐 대기)
  const multi = async (name, { full = true, views = ['desktop-light', 'desktop-dark', 'tablet', 'mobile'] } = {}) => {
    for (const v of views) {
      if (v === 'desktop-light') { await page.setViewportSize(VP.desktop); await setTheme('light'); }
      if (v === 'desktop-dark') { await page.setViewportSize(VP.desktop); await setTheme('dark'); }
      if (v === 'tablet') { await page.setViewportSize(VP.tablet); await setTheme('light'); }
      if (v === 'mobile') { await page.setViewportSize(VP.mobile); await setTheme('light'); }
      await sleep(250);
      await snap(`${name}--${v}`, { full: v === 'mobile' ? true : full });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(!sw, `${name} ${v}: 가로 스크롤 없음`);
    }
    await page.setViewportSize(VP.desktop); await setTheme('light'); await sleep(150);
  };
  const act = (code) => page.evaluate(code);
  const state = () => page.evaluate(() => window.__app.getState());
  const pidOf = async name => (await state()).profiles.find(p => p.name === name).id;
  const closeModal = async () => { await page.keyboard.press('Escape'); await sleep(200); };

  await page.setViewportSize(VP.desktop); await setTheme('light');
  // 1) 홈: 1학년(첫 화면 토스트 포함) · 2학년 · 3학년(잠금 카드) · 6학년(3지선다/소수점 아이콘)
  await multi('home-g1');
  await page.click('[data-action="grade-tab"][data-grade="2"]'); await sleep(200);
  await multi('home-g2');
  await page.click('[data-action="grade-tab"][data-grade="3"]'); await sleep(200);
  await multi('home-g3-locked');
  await page.click('[data-action="grade-tab"][data-grade="6"]'); await sleep(200);
  await snap('home-g6--desktop-light');
  await page.click('[data-action="grade-tab"][data-grade="4"]'); await sleep(200);
  await snap('home-g4--desktop-light');
  // 프로필 드롭다운
  await page.click('#profile-btn'); await sleep(250);
  await snap('home-profile-menu--desktop-light');
  await setTheme('dark'); await sleep(150); await snap('home-profile-menu--desktop-dark'); await setTheme('light');
  await page.setViewportSize(VP.mobile); await sleep(200); await snap('home-profile-menu--mobile', { full: true }); await page.setViewportSize(VP.desktop);
  await page.keyboard.press('Escape'); await page.mouse.click(600, 600); await sleep(200);
  // 홈 스테이지 카드 터치 타깃/글자 크기 측정
  const metrics = await page.evaluate(() => {
    const px = el => el ? parseFloat(getComputedStyle(el).fontSize) : null;
    const h = el => el ? el.getBoundingClientRect().height : null;
    return { bodyFont: px(document.body), cardTitle: px(document.querySelector('.stage-card h3')), best: px(document.querySelector('.stage-card .best')), tagline: px(document.querySelector('.tagline')), tab: h(document.querySelector('#main-tabs [role=tab]')), gradeTab: h(document.querySelector('.grade-tabs [role=tab]')), linkish: h(document.querySelector('.linkish')), iconBtn: h(document.querySelector('.icon-btn')), footer: px(document.querySelector('.app-footer')), stageHeader: px(document.querySelector('.stage-card header')), profileSub: px(document.querySelector('#profile-sub')) };
  });
  log('metrics ' + JSON.stringify(metrics));
  // 2) 도움말 모달
  await page.click('[data-action="help"]'); await sleep(300);
  await multi('help-modal');
  await closeModal();
  // 3) 새 프로필 모달 + 유효성 오류
  await page.click('.app-header [data-action="new-profile"]'); await sleep(300);
  await snap('new-profile-modal--desktop-light');
  await page.click('.modal [data-m="ok"]'); await sleep(200);
  await multi('new-profile-modal-error');
  await closeModal();
  // 4) 체험 모드 홈
  await page.click('[data-action="guest"]'); await sleep(300);
  await snap('home-guest--desktop-light');
  await page.setViewportSize(VP.mobile); await sleep(200); await snap('home-guest--mobile', { full: true }); await page.setViewportSize(VP.desktop);
  // 5) 도감: 이도윤(약점 있음) 2-3 히트맵 + 칸 툴팁
  const doyun = await pidOf('이도윤');
  await act(`window.__app.actions.setActive('${doyun}')`); await sleep(300);
  await page.click('#main-tabs [data-view="codex"]'); await sleep(300);
  await page.click('.hm-cell[data-key="8×7"]'); await sleep(200);
  await multi('codex-heatmap');
  // 정하윤(히트맵 대부분 초록·배지 많음)
  await act(`window.__app.actions.setActive('${await pidOf('정하윤')}')`); await sleep(200);
  await page.click('#main-tabs [data-view="codex"]'); await sleep(300);
  await snap('codex-heatmap-hayun--desktop-light');
  // 다른 스테이지(약점 목록) · 약점 없는 스테이지(빈 상태)
  await act(`window.__app.actions.setActive('${doyun}')`); await sleep(200);
  await page.click('#main-tabs [data-view="codex"]'); await sleep(300);
  await page.selectOption('#codex-stage', 's2-2'); await sleep(300);
  await multi('codex-weaklist', { views: ['desktop-light', 'desktop-dark', 'mobile'] });
  await page.selectOption('#codex-stage', 's6-3'); await sleep(300);
  await snap('codex-empty--desktop-light');
  // 6) 명예의 전당: 점수 / 별 / 성장 / 비공개 / 게스트
  await act(`window.__app.actions.setActive('${await pidOf('김하늘')}')`); await sleep(200);
  await page.click('#main-tabs [data-view="hall"]'); await sleep(400);
  await page.selectOption('#hall-stage', 's2-3'); await sleep(600);
  await multi('hall-score');
  await page.click('[data-action="hall-tab"][data-tab="stars"]'); await sleep(600);
  await multi('hall-stars', { views: ['desktop-light', 'mobile'] });
  await page.click('[data-action="hall-tab"][data-tab="growth"]'); await sleep(600);
  await snap('hall-growth--desktop-light');
  await act(`window.__app.actions.setSetting('rankingPublic', false)`);
  await page.click('[data-action="hall-tab"][data-tab="score"]'); await sleep(600);
  await multi('hall-private', { views: ['desktop-light', 'desktop-dark', 'mobile'] });
  await act(`window.__app.actions.setSetting('rankingPublic', true)`);
  await act(`window.__app.actions.setGuest()`); await sleep(200);
  await page.click('#main-tabs [data-view="hall"]'); await sleep(400);
  await snap('hall-guest--desktop-light');
  // 인쇄 미리보기(오늘의 기록표) — window.print 무력화 후 인쇄 매체로 촬영
  await act(`window.__app.actions.setActive('${await pidOf('김하늘')}')`); await sleep(200);
  await page.click('#main-tabs [data-view="hall"]'); await sleep(300);
  await act(`window.print = () => {}`);
  await page.click('[data-action="print-today"]'); await sleep(300);
  await page.emulateMedia({ media: 'print' }); await sleep(200);
  await snap('print-today-empty', { full: true });
  await page.emulateMedia({ media: 'screen' });
  // 7) 선생님 설정 전체 + 삭제 확인 + 초기화 확인 + PIN 게이트
  await page.click('[data-action="nav"][data-view="settings"]'); await sleep(400);
  await multi('settings');
  await page.click('#profile-table [data-action="delete-profile"]'); await sleep(300);
  await snap('settings-delete-confirm--desktop-light');
  await closeModal();
  await page.click('[data-action="reset-sample"]'); await sleep(300);
  await multi('settings-reset-confirm', { views: ['desktop-light', 'desktop-dark', 'mobile'] });
  await closeModal();
  await page.fill('#pin-input', '1234'); await page.click('[data-action="save-pin"]'); await sleep(400);
  await snap('settings-pin-saved-toast--desktop-light');
  await page.click('#main-tabs [data-view="home"]'); await sleep(200);
  await page.click('[data-action="nav"][data-view="settings"]'); await sleep(300);
  await multi('settings-pin-gate', { views: ['desktop-light', 'mobile'] });
  await page.fill('#pin-gate-input', '0000'); await page.click('[data-action="pin-unlock"]'); await sleep(300);
  await snap('settings-pin-wrong-toast--desktop-light');
  await page.fill('#pin-gate-input', '1234'); await page.click('[data-action="pin-unlock"]'); await sleep(300);
  await page.fill('#pin-input', ''); await page.click('[data-action="save-pin"]'); await sleep(300);
  // 저장 불가 배지(상태 재현) + 모든 스테이지 닫힘 빈 상태
  await act(`document.getElementById('storage-warn').hidden = false`);
  await page.click('#main-tabs [data-view="home"]'); await sleep(300);
  await snap('home-storage-warn--desktop-light');
  await page.setViewportSize(VP.mobile); await sleep(200); await snap('home-storage-warn--mobile', { full: true }); await page.setViewportSize(VP.desktop);
  await act(`document.getElementById('storage-warn').hidden = true`);
  await act(`window.__app.actions.setSetting('activeStageIds', [])`);
  await page.click('#main-tabs [data-view="home"]'); await sleep(300);
  await snap('home-all-disabled--desktop-light');
  // 일부 스테이지 닫힘(회색 카드)
  await act(`window.__app.actions.setSetting('activeStageIds', ['s1-1','s1-3','s2-1','s2-2','s2-3'])`);
  await page.click('#main-tabs [data-view="home"]'); await sleep(200);
  await page.click('[data-action="grade-tab"][data-grade="1"]'); await sleep(200);
  await snap('home-disabled-card--desktop-light');
  await page.click('.stage-card.disabled .start-btn'); await sleep(200);
  await snap('home-disabled-toast--desktop-light');
  await act(`window.__app.actions.setSetting('activeStageIds', window.__app.MG.STAGES.map(s => s.id))`);
  await act(`window.__app.actions.setSetting('unlockAll', true)`);

  // ---- 게임 화면 ----
  const waitMonster = async (ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const g = (await state()).game; if (g && g.monsters.length && g.monsters[0].progress > 0.06) return g; await sleep(150); } return (await state()).game; };
  const solveCard = async () => {
    // 교정 카드의 활성 패드에 정답을 넣어 닫는다
    await page.evaluate(() => { const g = window.__app.getState().game; const m = g.monsters.slice().sort((a, b) => b.progress - a.progress)[0]; const p = window.__app.MG.Pad.active; if (!m || !p) return;
      if (m.choices) { p.key(String(m.correctIndex + 1)); } else { for (const ch of String(m.answerText)) p.key(ch); p.key('fire'); } });
    await sleep(900);
  };
  const startGame = async (sid) => { await act(`window.__app.actions.startStage('${sid}')`); await sleep(400); return waitMonster(); };

  // 2-3 곱셈구구: 게임 화면(HUD·키패드) 4뷰 + 입력 중 표시
  await startGame('s2-3');
  await page.keyboard.press('5'); await page.keyboard.press('6'); await sleep(100);
  await multi('game-number', { full: false });
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  // 오답 → 교정 카드(점 배열)
  await act(`window.__app.actions.fire('1')`); await sleep(1300);
  await multi('card-array', { full: false });
  await solveCard(); await sleep(300);
  await snap('game-resume-count--desktop-light');
  // 일시정지 모달
  await sleep(600); await page.keyboard.press('Escape'); await sleep(300);
  await multi('pause-modal', { full: false, views: ['desktop-light', 'mobile'] });
  await page.click('.modal [data-m="resume"]'); await sleep(300);
  // 큰 글씨 모드 게임 화면
  await act(`window.__app.actions.setSetting('bigText', true); document.body.classList.add('big-text')`); await sleep(200);
  await snap('game-bigtext--desktop-light');
  await page.setViewportSize(VP.mobile); await sleep(300); await snap('game-bigtext--mobile', { full: true }); await page.setViewportSize(VP.desktop);
  await act(`window.__app.actions.setSetting('bigText', false); document.body.classList.remove('big-text')`);
  // 중단 → 결과(중단) 화면
  await act(`window.__app.actions.quit()`); await sleep(1500);
  await multi('result-quit');
  // 1-1 덧셈 → dots 카드
  await startGame('s1-1'); await act(`window.__app.actions.fire('99')`); await sleep(1000);
  await snap('card-dots--desktop-light'); await setTheme('dark'); await sleep(100); await snap('card-dots--desktop-dark'); await setTheme('light');
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 1-2 뺄셈 → dots(X 표시)
  await startGame('s1-2'); await act(`window.__app.actions.fire('99')`); await sleep(1000);
  await snap('card-dots-sub--desktop-light');
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 2-2 받아내림 뺄셈 → column 카드
  await startGame('s2-2'); await act(`window.__app.actions.fire('1')`); await sleep(2200);
  await multi('card-column', { full: false, views: ['desktop-light', 'desktop-dark', 'mobile'] });
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 3-1 세 자리 덧셈 → column 카드(받아올림)
  await startGame('s3-1'); await act(`window.__app.actions.fire('1')`); await sleep(2400);
  await snap('card-column-add3--desktop-light');
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 3-2 나눗셈 → array 묶음
  await startGame('s3-2'); await act(`window.__app.actions.fire('1')`); await sleep(1300);
  await snap('card-array-div--desktop-light');
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 4-2 분수(3지선다): 게임 화면 + 크로스헤어 + bar 카드(오선택 흔들림)
  await startGame('s4-2'); await sleep(300);
  await multi('game-choice3', { full: false });
  await page.evaluate(() => { const g = window.__app.getState().game; const m = g.monsters[0]; window.__app.actions.choose((m.correctIndex + 1) % 3); }); await sleep(1600);
  await multi('card-bar', { full: false, views: ['desktop-light', 'desktop-dark', 'mobile'] });
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 5-2 분모 다른 분수 → 통분 bar 카드
  await startGame('s5-2'); await page.evaluate(() => { const g = window.__app.getState().game; const m = g.monsters[0]; window.__app.actions.choose((m.correctIndex + 1) % 3); }); await sleep(1800);
  await snap('card-bar-lcd--desktop-light');
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 4-3 소수: 소수점 키패드 + text 카드
  await startGame('s4-3'); await page.keyboard.press('4'); await page.keyboard.press('.'); await page.keyboard.press('2'); await sleep(100);
  await multi('game-decimal', { full: false, views: ['desktop-light', 'mobile'] });
  await act(`window.__app.actions.fire('0.1')`); await sleep(700);
  await snap('card-text-decimal--desktop-light');
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 5-1 최대공약수 → 긴 라벨 + text 카드
  await startGame('s5-1'); await sleep(200); await snap('game-longlabel-gcd--desktop-light');
  await act(`window.__app.actions.fire('1')`); await sleep(700);
  await multi('card-text-gcd', { full: false, views: ['desktop-light', 'mobile'] });
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 6-3 비율: 가장 긴 문장형 라벨
  await startGame('s6-3'); await sleep(200); await snap('game-longlabel-ratio--desktop-light');
  await page.setViewportSize(VP.mobile); await sleep(300); await snap('game-longlabel-ratio--mobile'); await page.setViewportSize(VP.desktop);
  await act(`window.__app.actions.fire('1')`); await sleep(700);
  await snap('card-text-ratio--desktop-light');
  await solveCard(); await act(`window.__app.actions.quit()`); await sleep(800);
  // 4-1 두 자리 곱셈 라벨
  await startGame('s4-1'); await sleep(200); await snap('game-label-4-1--desktop-light');
  await act(`window.__app.actions.quit()`); await sleep(800);
  // 저학년 3지선다 모드 1-1
  await act(`window.__app.actions.setSetting('lowGradeChoice', true)`);
  await startGame('s1-1'); await sleep(200); await snap('game-lowgrade-choice--desktop-light');
  await page.setViewportSize(VP.mobile); await sleep(300); await snap('game-lowgrade-choice--mobile', { full: true }); await page.setViewportSize(VP.desktop);
  await act(`window.__app.actions.quit()`); await sleep(800);
  await act(`window.__app.actions.setSetting('lowGradeChoice', false)`);
  // 체험 모드 결과 화면(프로필 만들기 버튼)
  await act(`window.__app.actions.setGuest()`); await sleep(200);
  await startGame('s1-1'); await page.evaluate(() => { const m = window.__app.getState().game.monsters[0]; window.__app.actions.fire(String(m.answer)); }); await sleep(600);
  await act(`window.__app.actions.quit()`); await sleep(1500);
  await snap('result-guest--desktop-light');
  // 테마 스킨 변경 후 게임 배경(사막·황금) 확인
  await act(`window.__app.actions.setActive('${await pidOf('최민준')}')`); await sleep(200);
  await startGame('s2-3'); await sleep(200); await snap('game-theme-desert--desktop-light');
  await act(`window.__app.actions.quit()`); await sleep(800);
  log('done');
};
