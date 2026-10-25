// acceptance.js — 분수교구함(단순화판) 수용 기준 15개 테스트 (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  let dialogs = 0, pageErrors = 0, consoleErrors = 0;
  page.on('dialog', () => { dialogs++; });
  page.on('pageerror', () => { pageErrors++; });
  page.on('console', m => { if (m.type() === 'error') consoleErrors++; });
  const st = () => page.evaluate(() => window.__app.getState());
  const text = sel => page.locator(sel).evaluate(el => el.textContent);
  const count = sel => page.locator(sel).count();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const norm = s => s.replace(/\s+/g, ' ').trim();

  // AC1: 첫 화면 3/4
  let s = await st();
  expect(s.n === 3 && s.d === 4, 'AC1 초기 상태 3/4');
  expect(await count('#svg-bar .cell') === 4 && await count('#svg-bar .cell.on') === 3, 'AC1 막대 4칸 중 3칸 색칠');
  expect(await count('#svg-circle .cell') === 4 && await count('#svg-circle .cell.on') === 3, 'AC1 원 4조각 중 3조각 색칠');
  expect(await count('#svg-line .tick') === 5 && await count('#svg-line .pt') === 1, 'AC1 수직선 0~1 눈금 4칸 + 점');
  expect(await text('#sym .fr-n') === '3' && await text('#sym .fr-d') === '4', 'AC1 기호 3/4(세로 분수)');
  expect((await text('#decimal')).includes('= 0.75'), 'AC1 소수 = 0.75');
  expect((await text('#reading')).includes('4분의 3'), 'AC1 읽기 4분의 3');
  await shot('01-initial');

  // AC2: 분모 + → 5
  await page.click('[data-action="d+"]');
  s = await st();
  expect(s.d === 5 && await text('#val-d') === '5', 'AC2 분모 5');
  expect(await count('#svg-bar .cell') === 5 && await count('#svg-circle .cell') === 5 && await count('#svg-line .tick') === 6, 'AC2 막대 5칸·원 5조각·수직선 눈금 5칸');

  // AC3: 막대 5번째 칸 클릭 → 5/5
  await page.click('#svg-bar .cell[data-i="4"]');
  s = await st();
  expect(s.n === 5 && s.d === 5, 'AC3 분자 5');
  expect(await count('#svg-circle .cell.on') === 5 && (await text('#svg-line')).includes('5/5'), 'AC3 원·수직선 5/5');
  await page.click('#svg-bar .cell[data-i="4"]');
  expect((await st()).n === 4, 'AC3 같은 칸 다시 누르면 하나 줄어듦(토글)');

  // AC4: 칩 7/4 → 가분수
  await page.click('#chips .chip[data-n="7"][data-d="4"]');
  s = await st();
  expect(s.n === 7 && s.d === 4, 'AC4 7/4 설정');
  expect(await count('#svg-bar .frame') === 2 && await count('#svg-circle .frame') === 2, 'AC4 막대·원 2개');
  expect(await count('#svg-line .tick-label.int') === 3, 'AC4 수직선 0~2');
  expect(norm(await text('#mixed')).includes('7/4 = 1 3/4'), 'AC4 대분수 7/4 = 1 3/4');
  await shot('02-improper');

  // AC5: 3/4 ×2 → 6/8, 사슬
  await act('setFraction', 3, 4);
  await page.click('[data-action="split2"]');
  await sleep(350);
  s = await st();
  expect(s.n === 6 && s.d === 8, 'AC5 ×2 → 6/8');
  expect(await count('#svg-bar .cell.on') === 6 && await count('#svg-bar .cell') === 8, 'AC5 색칠 비율 동일(8칸 중 6칸)');
  expect(/3\/4\s*=\s*6\/8/.test(norm(await text('#chain'))), 'AC5 동치 사슬 3/4 = 6/8');
  await shot('03-split');

  // AC6: 합치기 → 3/4, 비활성
  await page.click('[data-action="reduce"]');
  s = await st();
  expect(s.n === 3 && s.d === 4, 'AC6 합치기 → 3/4');
  expect(await page.locator('[data-action="reduce"]').isDisabled(), 'AC6 기약분수에서 합치기 비활성');

  // AC7: 분모 12에서 ×2 비활성
  await act('setFraction', 5, 12);
  expect(await page.locator('[data-action="split2"]').isDisabled() && await page.locator('[data-action="split3"]').isDisabled(), 'AC7 분모 12에서 ×2·×3 비활성');
  await act('split', 2);
  s = await st();
  expect(s.d === 12 && s.n === 5, 'AC7 API로 쪼개기 시도해도 변화 없음(안내 토스트)');

  // AC8: 소수 표기
  await act('setFraction', 1, 3);
  expect((await text('#decimal')).includes('≈ 0.333'), 'AC8 1/3 ≈ 0.333');
  await act('setFraction', 1, 4);
  expect((await text('#decimal')).includes('= 0.25'), 'AC8 1/4 = 0.25');

  // AC9: 소수 체크 끄기 + 새로고침 유지
  await page.click('input[data-show="decimal"]');
  expect(await page.locator('#decimal').isHidden(), 'AC9 소수 숨김');
  await reload();
  expect(await page.locator('#decimal').isHidden() && !(await page.locator('input[data-show="decimal"]').isChecked()), 'AC9 새로고침 후에도 숨김 유지');
  expect((await st()).n === 1 && (await st()).d === 4, 'AC9 분수도 복원(1/4)');
  await page.click('input[data-show="decimal"]');

  // AC10: 모델 토글
  await page.click('[data-model="circle"]');
  expect(await page.locator('#model-circle').isHidden(), 'AC10 원 모델 숨김');
  await page.click('[data-model="bar"]');
  await page.click('[data-model="line"]');
  s = await st();
  expect(await page.locator('#model-line').isVisible() && s.show.line === true && s.show.bar === false, 'AC10 마지막 모델(수직선)은 꺼지지 않음');
  await shot('04-line-only');

  // AC11: 처음 상태로 → 모달 → 확인
  await page.click('[data-action="reset"]');
  expect(await count('.modal[role="dialog"]') === 1, 'AC11 확인 모달 표시');
  await page.click('.modal-foot .btn.primary');
  s = await st();
  expect(s.n === 3 && s.d === 4 && s.show.bar && s.show.circle && s.show.line && s.chain.length === 0, 'AC11 3/4·세 모델 켜짐으로 복원');

  // AC12: 400px 뷰포트
  await page.setViewportSize({ width: 400, height: 800 });
  await sleep(300);
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const small = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label')).trim(), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(b => b.w < 44 || b.h < 44);
    return { overflow: de.scrollWidth > de.clientWidth + 1 || document.body.scrollWidth > de.clientWidth + 1, small };
  });
  expect(!m.overflow, 'AC12 400px 가로 스크롤 없음');
  expect(m.small.length === 0, 'AC12 모든 버튼 44px 이상' + (m.small.length ? ' (작은 버튼: ' + JSON.stringify(m.small) + ')' : ''));
  await shot('05-mobile');
  await page.setViewportSize({ width: 1280, height: 800 });

  // AC13: 다크 모드
  const probe = () => page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, cell: getComputedStyle(document.querySelector('#svg-bar .cell.on')).fill, div: getComputedStyle(document.querySelector('#svg-bar .div')).stroke }));
  const light = await probe();
  await page.emulateMedia({ colorScheme: 'dark' });
  await sleep(100);
  const dark = await probe();
  expect(light.bg !== dark.bg, 'AC13 다크 모드 body 배경이 라이트와 다름');
  expect(light.cell !== dark.cell && light.div !== dark.div, 'AC13 다크 모드 색칠·분할선 색이 다름');
  await shot('06-dark');
  await page.click('[data-action="theme"]');
  expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'AC13 테마 토글 버튼으로 라이트 전환');
  await page.emulateMedia({ colorScheme: 'light' });

  // AC14: 큰 글씨
  const fontPx = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#sym .fr')).fontSize));
  const f0 = await fontPx();
  await page.click('[data-action="big"]');
  await sleep(100);
  const f1 = await fontPx();
  expect(f1 >= f0 * 1.3, `AC14 큰 글씨: 기호 ${f0}px → ${f1}px (≥1.3배)`);
  await shot('07-big');
  await page.click('[data-action="big"]');

  // 모델 크기(1280px): 막대 폭 700 이상, 원 지름 260 이상, 라벨 14px 이상
  const size = await page.evaluate(() => {
    const bar = document.querySelector('#svg-bar .frame').getBoundingClientRect();
    const circ = document.querySelector('#svg-circle .frame').getBoundingClientRect();
    const lbl = document.querySelector('#svg-bar .cell-label').getBoundingClientRect();
    return { bar: Math.round(bar.width), circle: Math.round(circ.width), label: Math.round(lbl.height) };
  });
  log('모델 크기 ' + JSON.stringify(size));
  expect(size.bar >= 700 && size.circle >= 260 && size.label >= 14, '보너스: 1280px 모델 크기(막대 ' + size.bar + ', 원 ' + size.circle + ', 라벨 ' + size.label + ')');

  // 도움말 모달 열고 ESC
  await page.click('[data-action="help"]');
  expect(await count('.modal[role="dialog"]') === 1, '보너스: 도움말 모달 열림');
  await page.keyboard.press('Escape');
  expect(await count('.modal[role="dialog"]') === 0, '보너스: ESC로 닫힘');

  // AC15: alert/confirm/prompt·페이지 예외 0
  expect(dialogs === 0 && pageErrors === 0 && consoleErrors === 0, `AC15 dialog ${dialogs}, pageError ${pageErrors}, consoleError ${consoleErrors}`);
};
