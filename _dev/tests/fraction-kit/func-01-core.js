// func-01-core.js — 분수교구함 QA: 핵심 기능(초기 상태·입력·칸 클릭·칩·쪼개기·합치기·사슬·수 표현·경계값) 독립 검증 (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const text = async sel => (await page.locator(sel).evaluate(el => el.textContent)).replace(/\s+/g, ' ').trim();
  const count = sel => page.locator(sel).count();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const disabled = sel => page.locator(sel).evaluate(el => el.disabled);
  const toastTexts = () => page.locator('#toast-root .toast').allTextContents();
  const fillRatio = async svgSel => page.locator(svgSel).evaluate(svg => {
    // 색칠된 칸의 넓이 합 / 전체 칸 넓이 합(막대) — 색칠 비율 동일성 검증
    const cells = [...svg.querySelectorAll('.cell')];
    const area = r => r.getBBox().width * r.getBBox().height;
    const on = cells.filter(c => c.classList.contains('on')).reduce((a, c) => a + area(c), 0);
    const all = cells.reduce((a, c) => a + area(c), 0);
    return on / all;
  });

  // ---- AC1: 첫 화면 3/4 ----
  let s = await st();
  expect(s.n === 3 && s.d === 4, 'AC1 초기 상태 n=3, d=4');
  expect(await text('#val-n') === '3' && await text('#val-d') === '4', 'AC1 스테퍼 표시 3 / 4');
  expect(await count('#svg-bar .cell') === 4 && await count('#svg-bar .cell.on') === 3, 'AC1 막대 4칸 중 3칸 색칠');
  expect(await count('#svg-circle .cell') === 4 && await count('#svg-circle .cell.on') === 3, 'AC1 원 4조각 중 3조각 색칠');
  expect(await count('#svg-line .tick') === 5 && await count('#svg-line .pt') === 1 && await count('#svg-line .tick-label.int') === 2, 'AC1 수직선 0~1, 눈금 4칸, 점 1개');
  expect(await text('#sym .fr-n') === '3' && await text('#sym .fr-d') === '4', 'AC1 기호 3/4');
  expect(await text('#decimal') === '소수 = 0.75', 'AC1 소수 "= 0.75"');
  expect(await text('#reading') === '읽기 4분의 3', 'AC1 읽기 "4분의 3"');
  expect(await page.locator('#mixed').isHidden(), 'AC1 진분수에서 대분수 항목 숨김');
  expect(await text('#cap-bar') === '4칸 중 3칸' && await text('#cap-circle') === '4조각 중 3조각' && await text('#cap-line') === '0~1 사이 3/4 위치', 'AC1 모델 캡션 요약');
  expect((await text('#chain')).includes('×2, ×3, 합치기'), 'AC1 동치 사슬 빈 상태 안내');
  expect(await disabled('[data-action="chain-clear"]') && await disabled('[data-action="reduce"]'), 'AC1 처음으로·합치기(기약분수) 비활성');
  expect(await page.locator('#chips .chip[data-n="3"][data-d="4"]').getAttribute('aria-pressed') === 'true', 'AC1 칩 3/4 선택 표시');
  expect(await count('#chips .chip') === 8, '칩 8개 생성');
  expect(await page.locator('#chips .chip').allTextContents().then(a => a.join(',')) === '1/2,1/3,2/3,1/4,3/4,2/5,5/6,7/4', '칩 목록 1/2,1/3,2/3,1/4,3/4,2/5,5/6,7/4');
  await shot('core-01-initial');

  // ---- AC2: 분모 + → 5 ----
  await page.click('[data-action="d+"]');
  s = await st();
  expect(s.d === 5 && s.n === 3 && await text('#val-d') === '5', 'AC2 분모 + → 5 (분자 3 유지)');
  expect(await count('#svg-bar .cell') === 5, 'AC2 막대 5칸');
  expect(await count('#svg-circle .cell') === 5, 'AC2 원 5조각');
  expect(await count('#svg-line .tick') === 6, 'AC2 수직선 눈금 5칸(눈금선 6개)');
  expect(await text('#decimal') === '소수 = 0.6', 'AC2 3/5 소수 = 0.6');

  // ---- AC3: 막대 5번째 칸 클릭 → 5/5 ----
  await page.click('#svg-bar .cell[data-i="4"]');
  s = await st();
  expect(s.n === 5 && s.d === 5, 'AC3 막대 5번째 칸 클릭 → 5/5');
  expect(await count('#svg-circle .cell.on') === 5, 'AC3 원 5/5 꽉 참');
  expect(await text('#svg-line .pt-label') === '5/5', 'AC3 수직선 점 라벨 5/5');
  expect(await page.locator('#svg-line .pt').evaluate(el => +el.getAttribute('cx')) === await page.locator('#svg-line .tick.big').nth(1).evaluate(el => +el.getAttribute('x1')), 'AC3 수직선 점이 1 눈금 위');
  expect(await text('#sym') === '5 5 = 1', '분자=분모: 기호 5/5 = 1');
  expect(await text('#decimal') === '소수 = 1', '분자=분모: 소수 = 1');
  // 이미 색칠된 마지막 칸 재클릭 → 하나 줄어듦
  await page.click('#svg-bar .cell[data-i="4"]');
  expect((await st()).n === 4, '칸 토글: 마지막 색칠 칸 재클릭 → 4/5');
  // 원의 칸 클릭(2번째 조각) → n=2
  await page.click('#svg-circle .cell[data-i="1"]');
  expect((await st()).n === 2, '원 2번째 조각 클릭 → 2/5');
  expect(await count('#svg-bar .cell.on') === 2, '원 클릭 후 막대도 2칸 색칠');
  // 색칠된 중간 칸 클릭(1번째) → n=1 (i+1 규칙)
  await page.click('#svg-circle .cell[data-i="0"]');
  expect((await st()).n === 1, '원 1번째 조각 클릭 → 1/5');
  await page.click('#svg-circle .cell[data-i="0"]');
  expect((await st()).n === 0, '원 1번째 조각 재클릭 → 0/5');

  // ---- 경계: 분자 0 ----
  s = await st();
  expect(s.n === 0 && await count('#svg-bar .cell.on') === 0 && await count('#svg-circle .cell.on') === 0, '분자 0: 색칠 없음');
  expect(await text('#decimal') === '소수 = 0', '분자 0: 소수 = 0');
  expect(await text('#reading') === '읽기 0', '분자 0: 읽기 0');
  expect(await disabled('[data-action="n-"]'), '분자 0: − 버튼 비활성');
  expect(await disabled('[data-action="reduce"]'), '분자 0: 합치기 비활성');
  expect(await count('#svg-line .pt-track') === 0 && await text('#svg-line .pt-label') === '0/5', '분자 0: 수직선 점 0 위치');
  await shot('core-02-zero');

  // ---- AC4: 칩 7/4 → 가분수 ----
  await page.click('#chips .chip[data-n="7"][data-d="4"]');
  s = await st();
  expect(s.n === 7 && s.d === 4, 'AC4 칩 7/4 설정');
  expect(await count('#svg-bar .frame') === 2 && await count('#svg-bar .cell') === 8 && await count('#svg-bar .cell.on') === 7, 'AC4 막대 2개(8칸 중 7칸)');
  expect(await count('#svg-circle .frame') === 2 && await count('#svg-circle .cell') === 8 && await count('#svg-circle .cell.on') === 7, 'AC4 원 2개(8조각 중 7조각)');
  expect(await count('#svg-line .tick-label.int') === 3 && (await page.locator('#svg-line .tick-label.int').allTextContents()).join('') === '012', 'AC4 수직선 0~2 확장');
  expect(await text('#mixed') === '대분수 7/4 = 1 3/4', 'AC4 대분수 "7/4 = 1 3/4"');
  expect((await text('#sym')).replace(/\s/g, '') === '74=134', 'AC4 기호 영역 7/4 = 1 3/4');
  expect(await text('#reading') === '읽기 4분의 7 (1과 4분의 3)', 'AC4 읽기 "4분의 7 (1과 4분의 3)"');
  expect(await text('#decimal') === '소수 = 1.75', 'AC4 소수 = 1.75');
  expect(await text('#cap-bar') === '4칸 중 7칸 (막대 2개)', 'AC4 막대 캡션 (막대 2개)');
  expect(await page.locator('#chips .chip[data-n="7"][data-d="4"]').getAttribute('aria-pressed') === 'true', 'AC4 칩 7/4 선택 표시');
  // 두 번째 막대의 칸(data-i=4+1=5) 클릭 → n = d+i+1 = 6
  await page.click('#svg-bar .cell[data-i="5"]');
  expect((await st()).n === 6, '가분수: 두 번째 막대 2번째 칸 클릭 → 6/4');
  await page.click('#svg-circle .cell[data-i="7"]');
  expect((await st()).n === 8, '가분수: 두 번째 원 4번째 조각 클릭 → 8/4(최대)');
  expect(await disabled('[data-action="n+"]'), '분자 최대(분모×2)에서 + 비활성');
  expect(await text('#sym') === '8 4 = 2', '8/4 기호 = 2');
  expect(await text('#decimal') === '소수 = 2', '8/4 소수 = 2');
  expect(await page.locator('#mixed').isVisible() && await text('#mixed') === '대분수 8/4 = 2', '8/4 대분수 항목 "8/4 = 2"');
  await shot('core-03-improper-max');
  // 가분수에서 첫 막대 마지막 칸(data-i=3) 클릭 → n=4 → 막대 1개로 복귀
  await page.click('#svg-bar .cell[data-i="3"]');
  expect((await st()).n === 4 && await count('#svg-bar .frame') === 1, '첫 막대 4번째 칸 클릭 → 4/4, 막대 1개로 복귀');

  // ---- 분모 1 ----
  await act('setFraction', 1, 1);
  expect(await count('#svg-bar .cell') === 1 && await count('#svg-circle circle.cell') === 1, '분모 1: 칸 하나(원은 circle 요소)');
  expect(await disabled('[data-action="d-"]'), '분모 1: − 비활성');
  expect(await text('#reading') === '읽기 1' && await text('#decimal') === '소수 = 1', '분모 1: 읽기 1, 소수 = 1');
  expect(await count('#svg-circle .div') === 0, '분모 1: 원 분할선 없음');
  await act('setFraction', 2, 1);
  expect(await count('#svg-bar .frame') === 2 && await text('#reading') === '읽기 2', '2/1: 막대 2개, 읽기 2');

  // ---- 분모 12 / 스테퍼 상한 ----
  await act('setFraction', 5, 12);
  expect(await disabled('[data-action="d+"]'), 'AC7 분모 12: + 비활성');
  expect(await count('#svg-bar .cell') === 12 && await count('#svg-circle .cell') === 12 && await count('#svg-line .tick') === 13, '분모 12: 12칸·12조각·눈금 13개');
  expect(await disabled('[data-action="split2"]') && await disabled('[data-action="split3"]'), 'AC7 분모 12: ×2·×3 비활성');
  await page.click('[data-action="split2"]', { force: true }).catch(() => {});
  await sleep(100);
  s = await st();
  expect(s.d === 12 && s.n === 5, 'AC7 비활성 ×2 강제 클릭에도 상태 불변');
  const t7 = await toastTexts();
  expect(t7.length === 0 || t7.some(t => t.includes('12')), 'AC7 토스트 없음 또는 안내 토스트');
  // API 경로로 split 호출 시 안내 토스트
  await act('split', 2);
  await sleep(100);
  expect((await toastTexts()).some(t => t.includes('12')), 'API split(2) 분모 초과 → 안내 토스트');
  expect((await st()).d === 12, 'API split(2) 분모 초과 → 상태 불변');
  // 분모 5에서 ×3 비활성, ×2 활성
  await act('setFraction', 2, 5);
  expect(!(await disabled('[data-action="split2"]')) && await disabled('[data-action="split3"]'), '분모 5: ×2 활성, ×3 비활성(15>12)');
  await act('setFraction', 1, 6);
  expect(!(await disabled('[data-action="split2"]')) && await disabled('[data-action="split3"]'), '분모 6: ×2 활성(12), ×3 비활성(18)');
  await act('setFraction', 1, 7);
  expect(await disabled('[data-action="split2"]') && await disabled('[data-action="split3"]'), '분모 7: ×2·×3 모두 비활성');

  // ---- AC5: 3/4 ×2 → 6/8 ----
  await act('setFraction', 3, 4);
  const ratioBefore = await fillRatio('#svg-bar');
  await page.click('[data-action="split2"]');
  await sleep(50);
  expect(await count('#svg-bar .div.new') === 4 && await count('#svg-circle .div.new') === 4 && await count('#svg-line .tick.new') === 4, 'AC5 쪼개기 직후 새 분할선 .new 4개씩(막대·원·수직선)');
  await sleep(350);
  s = await st();
  expect(s.n === 6 && s.d === 8, 'AC5 ×2 → 6/8');
  const ratioAfter = await fillRatio('#svg-bar');
  expect(Math.abs(ratioBefore - ratioAfter) < 1e-6 && Math.abs(ratioAfter - 0.75) < 1e-6, 'AC5 색칠 비율 동일(0.75)');
  expect(await count('#svg-bar .cell.on') === 6 && await count('#svg-bar .cell') === 8, 'AC5 막대 8칸 중 6칸');
  expect(await text('#chain') === '3/4 = 6/8', 'AC5 동치 사슬 "3/4 = 6/8"');
  expect(await count('#chain .term.last') === 1 && await text('#chain .term.last') === '6/8', 'AC5 사슬 현재 항 강조 6/8');
  expect(!(await disabled('[data-action="chain-clear"]')), 'AC5 처음으로 활성');
  expect(await text('#decimal') === '소수 = 0.75', 'AC5 6/8 소수 = 0.75');
  await shot('core-04-split');

  // ---- AC6: 합치기 → 3/4, 기약분수 비활성 ----
  expect(!(await disabled('[data-action="reduce"]')), 'AC6 6/8 합치기 활성');
  await page.click('[data-action="reduce"]');
  await sleep(50);
  expect(await count('#svg-bar .div.ghost') === 4 && await count('#svg-circle .div.ghost') === 4 && await count('#svg-line .tick.ghost') === 4, 'AC6 합치기 직후 사라지는 선 .ghost 4개씩');
  await sleep(350);
  s = await st();
  expect(s.n === 3 && s.d === 4, 'AC6 합치기 → 3/4');
  expect(await disabled('[data-action="reduce"]'), 'AC6 기약분수 3/4에서 합치기 비활성');
  expect(await text('#chain') === '3/4 = 6/8 = 3/4', 'AC6 사슬 누적 "3/4 = 6/8 = 3/4"');
  // 합치기 비활성 상태 강제 클릭 → 불변
  await page.click('[data-action="reduce"]', { force: true }).catch(() => {});
  expect((await st()).n === 3 && (await st()).d === 4, '비활성 합치기 강제 클릭 → 불변');

  // ---- 사슬: ×3, 항 클릭, 처음으로 ----
  await act('setFraction', 2, 3);
  await page.click('[data-action="split3"]');
  await sleep(350);
  expect((await st()).n === 6 && (await st()).d === 9 && await text('#chain') === '2/3 = 6/9', '×3: 2/3 → 6/9, 사슬');
  await page.click('[data-action="reduce"]');
  await sleep(350);
  await page.click('[data-action="split2"]');
  await sleep(350);
  expect((await st()).n === 4 && (await st()).d === 6 && await text('#chain') === '2/3 = 6/9 = 2/3 = 4/6', '합치기 후 ×2: 사슬 4항');
  await page.click('#chain .term[data-chain="1"]');
  s = await st();
  expect(s.n === 6 && s.d === 9 && s.chain.length === 4, '사슬 항(6/9) 클릭 → 그 분수로 이동, 사슬 유지');
  expect(await text('#chain .term.last') === '6/9', '사슬 현재 항 강조 6/9');
  await page.click('[data-action="chain-clear"]');
  s = await st();
  expect(s.chain.length === 0 && (await text('#chain')).includes('×2, ×3'), '처음으로: 사슬 비움');
  expect(s.n === 2 && s.d === 3, '처음으로: 사슬 첫 분수 2/3로 복귀(빌더 설계)');
  expect(await disabled('[data-action="chain-clear"]'), '사슬 비면 처음으로 비활성');

  // ---- 사슬 최대 6개 ----
  await act('setFraction', 1, 2);
  for (let i = 0; i < 5; i++) { await act('split', 2); await act('reduce'); } // 1/2,2/4,1/2,2/4,... 교대로 누적
  s = await st();
  expect(s.chain.length === 6, '사슬 최대 6개 유지(초과 시 앞 버림)');
  expect(await count('#chain .term') === 6, '사슬 DOM 항 6개');
  // 분수 직접 변경 시 사슬 지워짐
  await page.click('[data-action="n+"]');
  expect((await st()).chain.length === 0, '스테퍼 조작 시 사슬 초기화');

  // ---- AC8: 소수 표기 ----
  await page.click('#chips .chip[data-n="1"][data-d="3"]');
  expect(await text('#decimal') === '소수 ≈ 0.333', 'AC8 1/3 → "≈ 0.333"');
  await page.click('#chips .chip[data-n="1"][data-d="4"]');
  expect(await text('#decimal') === '소수 = 0.25', 'AC8 1/4 → "= 0.25"');
  await act('setFraction', 2, 3);
  expect(await text('#decimal') === '소수 ≈ 0.667', '2/3 → ≈ 0.667(반올림)');
  await act('setFraction', 5, 6);
  expect(await text('#decimal') === '소수 ≈ 0.833', '5/6 → ≈ 0.833');
  await act('setFraction', 1, 8);
  expect(await text('#decimal') === '소수 = 0.125', '1/8 → = 0.125');
  await act('setFraction', 3, 6);
  expect(await text('#decimal') === '소수 = 0.5', '3/6 → 약분 후 유한소수 = 0.5');
  await act('setFraction', 4, 12);
  expect(await text('#decimal') === '소수 ≈ 0.333', '4/12 → ≈ 0.333');
  await act('setFraction', 7, 10);
  expect(await text('#decimal') === '소수 = 0.7', '7/10 → = 0.7');
  await act('setFraction', 11, 12);
  expect(await text('#decimal') === '소수 ≈ 0.917', '11/12 → ≈ 0.917');
  expect(await text('#reading') === '읽기 12분의 11', '11/12 읽기 12분의 11');
  await act('setFraction', 23, 12);
  expect(await text('#reading') === '읽기 12분의 23 (1과 12분의 11)' && await text('#mixed') === '대분수 23/12 = 1 11/12', '23/12 읽기·대분수');

  // ---- 스테퍼 경계·분모 감소 시 분자 클램프 ----
  await act('setFraction', 7, 4);
  await page.click('[data-action="d-"]');
  s = await st();
  expect(s.d === 3 && s.n === 6, '7/4에서 분모 − → 분자 6/3으로 클램프');
  await act('setFraction', 0, 1);
  expect(await disabled('[data-action="n-"]') && await disabled('[data-action="d-"]'), '0/1: − 두 개 비활성');
  await page.click('[data-action="n+"]'); await page.click('[data-action="n+"]');
  expect((await st()).n === 2 && await disabled('[data-action="n+"]'), '0/1 → n+ 두 번 → 2/1, + 비활성');

  // ---- API 입력 검증 ----
  await act('setFraction', 3, 4);
  await act('setFraction', 1.5, 4);
  expect((await st()).n === 3, 'setFraction(1.5,4) 무시');
  await act('setFraction', 99, 99);
  s = await st();
  expect(s.d === 12 && s.n === 24, 'setFraction(99,99) → 클램프 24/12');
  await act('setFraction', -5, 0);
  s = await st();
  expect(s.d === 1 && s.n === 0, 'setFraction(-5,0) → 클램프 0/1');
  await page.evaluate(() => window.__app.actions.setFraction('3', '4'));
  expect((await st()).d === 1, 'setFraction("3","4") 문자열 무시');

  // ---- 키보드 단축키 ----
  await act('setFraction', 3, 4);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowRight');
  expect((await st()).n === 4, '→ 키: 분자 +1');
  await page.keyboard.press('ArrowLeft');
  expect((await st()).n === 3, '← 키: 분자 −1');
  await page.keyboard.press('ArrowUp');
  expect((await st()).d === 5, '↑ 키: 분모 +1');
  await page.keyboard.press('ArrowDown');
  expect((await st()).d === 4, '↓ 키: 분모 −1');
  // 체크박스 포커스 중에는 단축키 무시
  await page.focus('[data-show="decimal"]');
  await page.keyboard.press('ArrowRight');
  expect((await st()).n === 3, '체크박스 포커스 시 → 키 무시');

  // ---- Tab 키로 모든 버튼 도달 가능(키보드 조작) ----
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  const reached = new Set();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => { const a = document.activeElement; return a ? (a.tagName + '|' + (a.dataset.action || a.dataset.model || a.dataset.show || (a.dataset.n ? a.dataset.n + '/' + a.dataset.d : '') || a.id)) : ''; });
    reached.add(id);
    if (id === 'BODY|') break;
  }
  const need = ['BUTTON|big', 'BUTTON|theme', 'BUTTON|help', 'BUTTON|reset', 'BUTTON|n-', 'BUTTON|n+', 'BUTTON|d-', 'BUTTON|d+', 'BUTTON|1/2', 'BUTTON|7/4', 'INPUT|decimal', 'INPUT|reading', 'BUTTON|bar', 'BUTTON|circle', 'BUTTON|line', 'BUTTON|split2', 'BUTTON|split3'];
  const missing = need.filter(k => !reached.has(k));
  expect(missing.length === 0, 'Tab으로 주요 버튼 모두 도달' + (missing.length ? ' (누락: ' + missing.join(',') + ')' : ''));
  log('tab reached: ' + [...reached].join(' '));
  // Enter로 버튼 실행
  await page.focus('[data-action="n+"]');
  await page.keyboard.press('Enter');
  expect((await st()).n === 4, 'Enter 키로 분자 + 실행');
  await page.focus('[data-action="n-"]');
  await page.keyboard.press('Space');
  expect((await st()).n === 3, 'Space 키로 분자 − 실행');

  // ---- 토스트 스택 최대 3 ----
  await act('setFraction', 1, 12);
  for (let i = 0; i < 5; i++) await act('split', 2);
  expect(await count('#toast-root .toast') <= 3, '토스트 스택 3개 이하');
  await sleep(3000);
  expect(await count('#toast-root .toast') === 0, '토스트 자동 사라짐');

  // ---- 수직선 라벨 간격(촘촘할 때 하나 걸러) ----
  await act('setFraction', 13, 12);
  const labels = await count('#svg-line .tick-label:not(.int)');
  expect(labels === 11, '13/12 수직선: 분수 라벨 하나 걸러 표시(11개)' + ` (실제 ${labels})`);
  await shot('core-05-line-dense');
};
