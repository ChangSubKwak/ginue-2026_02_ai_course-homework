// 추가 흐름 테스트: 새 프로필 검증, 체험 모드, 일시정지, 도움말, PIN, 저학년 3지선다, 인쇄, 도감 약점 목록
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const txt = sel => page.locator(sel).first().innerText();
  // 새 프로필 검증
  await page.click('[data-action="new-profile"]'); await page.waitForSelector('.modal');
  await page.fill('#np-name', '김'); await page.click('.modal [data-m="ok"]');
  expect((await txt('#np-error')).includes('2~12자'), '이름 유효성 메시지');
  await page.fill('#np-name', '김하늘'); await page.click('.modal [data-m="ok"]'); await sleep(300);
  let s = await st(); expect(s.current === '김하늘(2)' && s.profiles.length === 25, '중복 이름 → 김하늘(2) 생성·활성');
  // 체험 모드 → 결과 화면 안내 버튼
  await page.click('[data-action="guest"]'); s = await st(); expect(s.guest && s.current === '체험 학생', '체험 모드 진입');
  await act('setSetting', 'timeLimitMin', 0); await act('startStage', 's1-1'); await sleep(1500);
  // 일시정지 모달(Esc) → 계속하기
  await page.keyboard.press('Escape'); await page.waitForSelector('.modal'); expect((await txt('.modal-title')).includes('일시정지'), '일시정지 모달');
  s = await st(); expect(s.game.state === 'paused', '상태 paused');
  await page.click('.modal [data-m="resume"]'); await sleep(200); s = await st(); expect(s.game.state === 'playing', '계속하기 → playing');
  await page.click('.hud [data-action="pause"]'); await page.waitForSelector('.modal'); await page.click('.modal [data-m="quit"]');
  await page.waitForSelector('#result-view:not([hidden]) .result-head', { timeout: 5000 });
  expect((await txt('.result-head h2')).includes('중단') && await page.locator('#result-view [data-action="new-profile"]').count() === 1, '중단 결과 + 게스트 프로필 만들기 버튼');
  s = await st(); expect(s.profiles.length === 25, '게스트 기록 미저장');
  await shot('guest-result');
  // 도움말
  await act('setActive', s.profiles[0].id); await page.click('[data-action="help"]'); await page.waitForSelector('.modal');
  expect((await page.locator('.modal .help li').count()) === 6, '도움말 6단계'); await page.keyboard.press('Escape'); await sleep(200);
  expect(await page.locator('.modal').count() === 0, 'Esc로 모달 닫힘');
  // 저학년 3지선다 모드
  await act('setSetting', 'lowGradeChoice', true); await act('startStage', 's1-1'); await sleep(1600);
  expect(await page.locator('#input-panel .choice-btn').count() === 3, '저학년 3지선다 모드: 1-1 선택지 3개');
  s = await st(); const m = s.game.monsters[0]; await act('choose', (m.correctIndex + 1) % 3); await sleep(300);
  expect(await page.locator('.card-modal .dots').count() === 1 && await page.locator('.card-modal .choice-btn[disabled]').count() === 1, '오선택 → 점 모델 카드 + 틀린 선택지 비활성');
  await shot('card-dots-choice');
  await sleep(900); await page.keyboard.press(String(m.correctIndex + 1)); await sleep(300);
  expect(await page.locator('.card-modal').count() === 0, '카드에서 재선택으로 닫힘');
  await act('quit'); await sleep(700); await act('setSetting', 'lowGradeChoice', false);
  // 교정 카드 세로셈 모델(2-2) · 분수 막대(5-2) · 텍스트(6-3)
  await act('setSetting', 'unlockAll', true);
  for (const [sid, sel, name] of [['s2-2', 'table.column .borrow', '세로셈 받아내림'], ['s5-2', '.fbar', '분수 막대'], ['s6-3', '.hint-text', '한 줄 풀이']]) {
    await act('startStage', sid); await page.waitForFunction(() => { const g = window.__app.getState().game; return g && g.monsters.length && g.monsters[0].progress > 0; }, null, { timeout: 5000 });
    const mm = (await st()).game.monsters[0]; if (mm.choices) await act('choose', (mm.correctIndex + 1) % 3); else await act('fire', '999999'); await sleep(400);
    expect(await page.locator('.card-modal ' + sel).count() >= 1, `교정 카드 ${name} 모델`);
    await shot('card-' + sid);
    if (mm.choices) await page.keyboard.press(String(mm.correctIndex + 1)); else { for (const ch of mm.answerText) await page.keyboard.press(ch); await page.keyboard.press('Enter'); }
    await sleep(300); await act('quit'); await sleep(800);
  }
  // 도감 약점 목록(2-2, 이도윤)
  s = await st(); await act('setActive', s.profiles.find(p => p.name === '이도윤').id); await page.click('[data-view="codex"]'); await page.selectOption('#codex-stage', 's2-2'); await sleep(200);
  const weakRows = await page.locator('#codex-view table tbody tr').allInnerTexts(); expect(weakRows.length >= 3 && weakRows[0].includes('62 − 27'), '2-2 약점 목록(오답 많은 순): ' + weakRows[0].replace(/\s+/g, ' '));
  // PIN 게이트
  await page.click('[data-view="settings"]'); await page.fill('#pin-input', '1234'); await page.click('[data-action="save-pin"]'); await page.click('[data-view="home"]'); await page.click('[data-view="settings"]');
  expect(!(await page.locator('#pin-gate').isHidden()) && await page.locator('#settings-body').isHidden(), 'PIN 게이트 표시');
  await page.fill('#pin-gate-input', '0000'); await page.click('[data-action="pin-unlock"]'); expect(await page.locator('#settings-body').isHidden(), '틀린 PIN 거부');
  await page.fill('#pin-gate-input', '1234'); await page.click('[data-action="pin-unlock"]'); expect(!(await page.locator('#settings-body').isHidden()), '올바른 PIN 통과');
  await page.fill('#pin-input', ''); await page.click('[data-action="save-pin"]');
  // 인쇄용 기록표 생성(window.print 스텁)
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.click('[data-view="hall"]'); await page.click('[data-action="print-today"]');
  const pr = await page.evaluate(() => ({ printed: window.__printed, html: document.getElementById('print-root').innerText }));
  expect(pr.printed && pr.html.includes('오늘의 기록표') && pr.html.includes('가온초등학교'), '인쇄용 기록표 생성: ' + pr.html.slice(0, 60).replace(/\s+/g, ' '));
  // 기록 CSV 다운로드
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-records"]')]);
  expect(/math-guardians-records-\d{8}\.csv/.test(dl.suggestedFilename()), 'CSV 파일명 ' + dl.suggestedFilename());
  // 모든 스테이지 비활성 안내 카드
  await act('setSetting', 'activeStageIds', []); await page.click('[data-view="home"]'); expect((await txt('#stage-grid')).includes('모든 스테이지를 닫아'), '전체 비활성 안내 카드');
  await act('setSetting', 'activeStageIds', ['s1-1']); await page.click('[data-view="home"]'); await page.click('[data-action="grade-tab"][data-grade="1"]');
  await page.click('.stage-card[data-stage="s1-2"] .start-btn'); expect((await page.locator('.toast').allInnerTexts()).some(t => t.includes('선생님이 닫아 둔')), '닫힌 스테이지 토스트');
  await shot('home-disabled');
};
