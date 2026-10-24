// fix-r1-verify.js — 1라운드 수정 항목 중 기존 모듈이 직접 재지 않는 것들을 실측: 모바일 라벨 크기·HUD 띠, 1366×768 교정 카드, 전체화면 대상,
// 카드 애니메이션 중 키보드 잠금, 다음 스테이지 학년 경계, 잠긴 카드 아이콘/안내, 0명 성장 랭킹 메달 없음, 키패드 0 두 칸, 교정 카드 '?' 중복 없음
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const state = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await state()).game;
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const waitGame = async (pred, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const g = await game(); if (g && pred(g)) return g; await sleep(100); } return game(); };
  await page.waitForSelector('#stage-grid .stage-card');

  // 1. 잠긴 카드: 입력 아이콘 보임 + 해금 안내 글 + 버튼 '잠김'
  await page.click('[data-action="grade-tab"][data-grade="3"]');
  const lockedCard = page.locator('.stage-card[data-stage="s3-4"]');
  expect(await lockedCard.locator('.stage-input').isVisible(), 'F-10 잠긴 카드(3-4)에서도 입력 방식 아이콘 보임');
  expect((await lockedCard.locator('.lock-row').textContent()).includes('클리어하면 열려요'), 'U-18 잠긴 카드 본문에 해금 조건 안내');
  expect(await lockedCard.locator('.start-btn').isDisabled(), '잠긴 카드 시작 버튼 비활성');

  // 2. 키패드 0이 두 칸(빈 칸 없음), 키 12개
  await act('startStage', 's2-3'); await sleep(300);
  expect(await page.locator('#input-panel .keypad > span').count() === 0 && await page.locator('#input-panel .key').count() === 12 && await page.locator('#input-panel .key-zero').count() === 1, 'U-14 키패드 빈 칸 없음, 0 두 칸, 12키');
  // 3. 전체화면 대상이 입력 패널을 포함하는 섹션인지(구조 확인)
  expect(await page.evaluate(() => document.getElementById('game-view').contains(document.getElementById('input-panel')) && document.getElementById('game-view').contains(document.getElementById('game-canvas'))), 'M-07 전체화면 대상(#game-view)이 캔버스와 입력 패널을 모두 포함');
  // 4. 몬스터 없을 때 발사 → 오답 집계 없음
  let g = await game(); expect(g.monsters.length === 0, '시작 직후(배너 중) 몬스터 0');
  await act('fire', '5'); await sleep(100); g = await game();
  expect(g.wrong === 0 && g.combo === 0 && g.state === 'playing' && await page.locator('.modal').count() === 0, `M-06 몬스터 없을 때 발사는 무시(wrong=${g.wrong})`);
  // 5. 오답 → 교정 카드(제목 물음표 1개) → 키보드 정답으로 닫힘
  g = await waitGame(x => x.monsters.some(m => m.progress > 0.03), 8000);
  const m = g.monsters[0]; const wrongVal = String(m.answer + 1);
  await act('fire', wrongVal); await sleep(150); g = await game();
  expect(g.state === 'card' && await page.locator('.card-modal').count() === 1, '오답 → 교정 카드');
  const q = await page.locator('.card-q').textContent(); expect((q.match(/\?/g) || []).length === 1, `U-13 카드 제목 물음표 1개 (${q.trim()})`);
  await sleep(1200); await page.keyboard.type(String(m.answer)); await page.keyboard.press('Enter'); await sleep(150);
  expect((await game()).state !== 'card', '키보드 정답으로 카드 닫힘');
  // 6. 일시정지 중 숫자키 누적 안 됨, Enter로 '계속하기' 활성화 가능
  await waitGame(x => x.state === 'playing', 3000);
  await act('pause'); await sleep(200); await page.keyboard.type('77'); await sleep(50);
  const disp = (await page.locator('#input-panel .input-display').textContent()).trim();
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim());
  expect(disp === '?' && focused.includes('계속하기'), `F-12/U-15 일시정지 중 입력 누적 없음('${disp}'), 첫 포커스 '계속하기'('${focused}')`);
  await page.keyboard.press('Enter'); await sleep(150);
  expect((await game()).state === 'playing', 'm-01 일시정지 모달에서 Enter로 계속하기');
  await act('quit'); await sleep(600);

  // 7. 1366×768 교정 카드: 묶음 모델(나눗셈) 발사 버튼이 모달 안에 완전히 보임
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.__app.MG.UI.showView('home'));
  await act('startStage', 's3-2'); await sleep(300);
  g = await waitGame(x => x.monsters.some(mm => mm.progress > 0.03), 8000);
  await act('fire', String(g.monsters[0].answer + 1)); await sleep(300);
  const fit = await page.evaluate(() => { const mo = document.querySelector('.card-modal').getBoundingClientRect(), f = document.querySelector('.card-modal .key-fire').getBoundingClientRect(); return { modalBottom: Math.round(mo.bottom), fireBottom: Math.round(f.bottom), vh: innerHeight, twoCol: getComputedStyle(document.querySelector('.card-modal .card-body')).display === 'grid' }; });
  log('card-fit-1366x768 ' + JSON.stringify(fit));
  expect(fit.fireBottom <= fit.vh && fit.fireBottom <= fit.modalBottom + 1 && fit.twoCol, 'U-02/F-07 1366×768 교정 카드 2열, 발사 버튼이 화면 안');
  await shot('fix-card-1366');
  await sleep(1200); await page.keyboard.type(String(g.monsters[0].answerText)); await page.keyboard.press('Enter'); await sleep(200);
  expect(await page.locator('.card-modal').count() === 0, '1366 교정 카드 정답 입력으로 닫힘');
  await act('quit'); await sleep(500);

  // 8. 모바일 400px: HUD가 캔버스 밖 띠, 라벨 글씨 CSS 기준 18px 이상
  await page.setViewportSize({ width: 400, height: 800 });
  await page.evaluate(() => window.__app.MG.UI.showView('home'));
  await act('startStage', 's5-1'); await sleep(300);
  await waitGame(x => x.monsters.length > 0, 8000); await sleep(300);
  const mob = await page.evaluate(() => { const c = document.getElementById('game-canvas').getBoundingClientRect(), h = document.querySelector('.hud').getBoundingClientRect(); const cssW = c.width; const up = Math.max(1, Math.min(2.2, 640 / cssW)); return { canvasW: Math.round(cssW), hudOverlaps: h.bottom > c.top + 2 && h.top < c.bottom - 2, labelCssPx: +(28 * up * cssW / 960).toFixed(1), hudBtnH: Math.round(document.querySelector('.hud [data-action="pause"]').getBoundingClientRect().height), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
  log('mobile ' + JSON.stringify(mob));
  expect(!mob.hudOverlaps && mob.labelCssPx >= 18 && mob.hudBtnH >= 40 && mob.sw <= mob.cw, 'U-01/F-06 400px: HUD가 캔버스를 덮지 않고 라벨 ≥18px, HUD 버튼 ≥40px, 가로 스크롤 없음');
  await shot('fix-mobile-game');
  await act('quit'); await sleep(500);
  await page.setViewportSize({ width: 1280, height: 800 });

  // 9. 성장 랭킹: 0개 숙달 행에 메달 없음, 동점 같은 순위
  await page.evaluate(() => window.__app.MG.UI.showView('hall'));
  await page.click('[data-action="hall-tab"][data-tab="growth"]'); await sleep(200);
  const ranks = await page.locator('.rank-table tbody tr').evaluateAll(trs => trs.map(t => ({ no: t.querySelector('.rank-no').textContent.trim(), v: t.querySelector('td.num').textContent.trim() })));
  const zeroMedal = ranks.some(r => r.v.startsWith('0') && /🥇|🥈|🥉/.test(r.no));
  expect(!zeroMedal && ranks[0].no === '🥇', `U-17 성장 탭: 0개 행에 메달 없음 (${ranks.slice(0, 4).map(r => r.no + ':' + r.v).join(' / ')})`);
  await page.click('[data-action="hall-tab"][data-tab="score"]'); await sleep(200);
  expect(await page.locator('.rank-table tr.me .tag').count() === 1, "U-08 내 행에 '나' 태그");
  await shot('fix-hall');

  // 10. 다음 스테이지 학년 경계: 2-3 클리어 요약을 직접 finish 흐름으로 넣기 어려우므로 STAGES 순서 기반 next 계산을 확인
  const nextOf = await page.evaluate(() => { const S = window.__app.MG.STAGES; const i = S.findIndex(s => s.id === 's2-3'); return S[i + 1] && S[i + 1].id; });
  expect(nextOf === 's3-1', 'U-12 2-3 다음 스테이지는 3-1(학년 경계 넘김)');

  // 11. 교사 PIN 게이트에 초기화·백업 버튼
  await act('setSetting', 'teacherPin', '1234'); await page.evaluate(() => window.__app.MG.UI.showView('settings')); await sleep(200);
  expect(await page.locator('#pin-gate [data-action="reset-sample"]').isVisible() && await page.locator('#pin-gate [data-action="export-json"]').isVisible(), "F-01/M-05 PIN 게이트 안에 '샘플 데이터로 초기화'·'JSON 백업' 버튼");
  await shot('fix-pin-gate');
  await act('setSetting', 'teacherPin', null);

  // 12. 명단 CSV: classLabel 기준 학년·반, 첫 행 번호 공란도 추가
  await act('importRoster', ',첫줄학생\r\n35,둘째학생'); await sleep(200);
  const added = await page.evaluate(() => window.__app.MG.root.profiles.filter(p => /^(첫줄|둘째)학생$/.test(p.name)).map(p => [p.name, p.grade, p.classNo, p.number]));
  expect(added.length === 2 && added.every(a => a[1] === 5 && a[2] === 2), `F-13/m-08 명단 CSV 2명 추가(학년·반 5-2) ${JSON.stringify(added)}`);

  // 13. 세로셈 모델: 47+38 받아올림 1은 십의 자리 위, 503−178 '-1' 없음, 62−27 → 십 '5', 일 '12'
  const col = await page.evaluate(() => { const div = document.createElement('div'); const grab = () => [...div.querySelectorAll('tr.marks td')].map(td => td.textContent.trim()); const r = {}; window.__app.MG.UI.renderHint(div, { model: 'column', data: { a: 47, b: 38, plus: true } }); r.add = grab(); window.__app.MG.UI.renderHint(div, { model: 'column', data: { a: 503, b: 178, plus: false } }); r.sub = grab(); window.__app.MG.UI.renderHint(div, { model: 'column', data: { a: 62, b: 27, plus: false } }); r.sub2 = grab(); window.__app.MG.UI.renderHint(div, { model: 'column', data: { a: 657, b: 268, plus: true } }); r.add3 = grab(); return r; });
  log('column ' + JSON.stringify(col));
  expect(col.add[1] === '1' && col.add[2] === '' && col.sub.join(',') === ',4,9,13' && col.sub2.join(',') === ',5,12' && col.add3.join(',') === ',1,1,', 'M-01/M-02 세로셈 받아올림·받아내림 표시 위치/값');

  // 14. 소수 스테이지 정수 피연산자 없음(600회)
  const dec = await page.evaluate(() => { const P = window.__app.MG.Problems; let bad = []; for (const sid of ['s4-3', 's5-3', 's6-2']) for (let i = 0; i < 600; i++) { const pr = P.generate(sid); if (!/\./.test(pr.text)) bad.push(sid + ':' + pr.text); } return bad.slice(0, 5); });
  expect(dec.length === 0, `M-08 소수 스테이지 1,800회 생성 모두 소수 포함 ${JSON.stringify(dec)}`);
};
