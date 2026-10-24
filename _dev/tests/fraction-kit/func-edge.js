// func-edge.js — 경계값·오개념·키보드·접근성·장면 덮어쓰기 등 추가 결함 탐색 (스펙 edge_cases 기반)
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const txt = sel => page.locator(sel).first().innerText();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent));
  const norm = s => s.replace(/\s+/g, ' ').trim();
  let s;

  // ---------- 분자 0에서 합치기 ----------
  await act('kitSetD', 6); await act('kitSetN', 0);
  await page.click('[data-action=merge]'); await sleep(450);
  s = await S();
  log('0/6 합치기 결과: ' + JSON.stringify(s.kit) + ' toasts=' + JSON.stringify(await toasts()));
  expect(s.kit.d === 6 && s.kit.n === 0, '[스펙 reduce(0,d)→(0,d)] 0/6에서 합치기는 분모를 유지해야 함(실제 ' + s.kit.n + '/' + s.kit.d + ')');

  // ---------- 슬라이더 키보드 조작 + 되돌리기 ----------
  await act('kitSetD', 4); await act('kitSetN', 1);
  await page.locator('#kit-d').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await sleep(100);
  s = await S(); expect(s.kit.d === 6, '슬라이더 키보드 → 분모 6');
  await page.keyboard.press('Control+z'); s = await S();
  expect(s.kit.d === 5 || s.kit.d === 4, '슬라이더 포커스 상태에서 Ctrl+Z 동작 (d=' + s.kit.d + ')');
  // 입력창 포커스에서는 Ctrl+Z가 앱 되돌리기를 가로채지 않음
  await page.click('.tabs [data-tab=cards]'); await page.locator('#card-search').focus(); await page.keyboard.type('abc'); await page.keyboard.press('Control+z'); await sleep(50);
  expect((await S()).tab === 'cards', '검색창 Ctrl+Z → 앱 오류 없음');
  await page.fill('#card-search', '');

  // ---------- 장면 불러오기 → 비교 탭 경유 시 연산 입력 덮어쓰기(재현) ----------
  await page.click('.tabs [data-tab=scenes]'); await sleep(100);
  await page.click('.scene-card[data-id="sc-b05"] [data-sc=load]'); await sleep(200);
  s = await S(); expect(s.tab === 'arith' && s.arith.a.n === 2 && s.arith.a.d === 5 && s.arith.b.n === 2, '장면 "4-2 분모가 같은 덧셈"(2/5+2/5) 불러오기');
  await page.click('.tabs [data-tab=compare]'); await sleep(100); await page.click('.tabs [data-tab=arith]'); await sleep(100);
  s = await S();
  log('장면 로드 후 compare 경유: arith=' + JSON.stringify(s.arith));
  expect(s.arith.a.n === 2 && s.arith.a.d === 5 && s.arith.b.n === 2 && s.arith.b.d === 5, '[결함 재현] 불러온 덧셈 장면(2/5+2/5)이 비교 탭을 거쳐 돌아오면 유지되어야 함(실제 ' + s.arith.a.n + '/' + s.arith.a.d + ' + ' + s.arith.b.n + '/' + s.arith.b.d + ')');
  expect((await txt('#memo-panel')).includes('분모도 더해야 할까'), '메모 패널은 여전히 해당 장면 발문 표시(상태 불일치 여부)');

  // ---------- 모델을 끈 채 400px에서 모델 탭 ----------
  await page.click('.tabs [data-tab=kit]'); await sleep(100);
  await page.uncheck('[data-model-toggle=bar]'); await sleep(50);
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  const vis = await page.evaluate(() => ({ active: document.querySelector('.models').dataset.activeModel, visible: [...document.querySelectorAll('.view-kit .model')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.dataset.model), barTabHidden: document.querySelector('[data-model-tab=bar]').hidden }));
  log('400px 막대 모델 끈 상태: ' + JSON.stringify(vis));
  expect(vis.visible.length === 1, '[UI] 400px에서 막대 모델을 끄면 보이는 모델이 없어짐 (visible=' + vis.visible.join(',') + ')');
  await page.setViewportSize({ width: 1280, height: 800 }); await page.check('[data-model-toggle=bar]'); await sleep(100);

  // ---------- 모달 포커스·aria ----------
  await page.click('[data-action=save-scene]'); await sleep(150);
  const dlg = await page.evaluate(() => { const m = document.querySelector('.modal'); return { role: m.getAttribute('role'), modal: m.getAttribute('aria-modal'), labelled: !!document.getElementById(m.getAttribute('aria-labelledby')), focusIn: m.contains(document.activeElement) }; });
  expect(dlg.role === 'dialog' && dlg.modal === 'true' && dlg.labelled && dlg.focusIn, '모달 role=dialog·aria-modal·labelledby·포커스 ' + JSON.stringify(dlg));
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.modal')), 'Tab 12회 후에도 포커스가 모달 안');
  await page.keyboard.press('Escape'); await sleep(100);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.dataset.action === 'save-scene'), '닫힌 뒤 장면 저장 버튼으로 포커스 복귀');
  // 아이콘 버튼 aria-label
  const noLabel = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).map(b => b.outerHTML.slice(0, 80)));
  expect(noLabel.length === 0, '텍스트 없는 버튼은 모두 aria-label 보유 ' + JSON.stringify(noLabel));
  const tabsA11y = await page.evaluate(() => ({ tablist: !!document.querySelector('.tabs[role=tablist]'), tabs: document.querySelectorAll('.tabs [role=tab]').length, live: document.querySelector('#toast-root').getAttribute('aria-live') }));
  expect(tabsA11y.tablist && tabsA11y.tabs === 6 && tabsA11y.live === 'polite', '탭 role·토스트 aria-live');

  // ---------- 토스트 최대 3개·자동 소멸 ----------
  await act('kitSetD', 3); await act('kitSetN', 2);
  for (let i = 0; i < 5; i++) await page.click('[data-action=merge]');
  expect(await page.locator('#toast-root .toast').count() <= 3, '토스트 최대 3개 쌓임');
  await sleep(3000);
  expect(await page.locator('#toast-root .toast').count() === 0, '토스트 2.5초 후 소멸');

  // ---------- 비교·연산 분수 범위(분모 13 요청) ----------
  await act('compareSet', 'a', 1, 13);
  s = await S(); log('compareSet 1/13 → ' + JSON.stringify(s.compare.a));
  await act('compareSet', 'a', 2, 3);
  // 워크스페이스 손상 복구
  await page.evaluate(() => localStorage.setItem('edu.fraction-kit.v1.workspace', JSON.stringify({ tab: 'arith', kit: { n: 99, d: 99 }, compare: { a: { n: -3, d: 0 }, b: null }, arith: { a: { n: 'x' }, b: { n: 1, d: 2 }, op: '*', step: 9 }, worksheet: { items: 'bad' } })));
  await reload(); await sleep(300); await page.click('.tabs [data-tab=arith]'); await sleep(150);
  s = await S();
  expect(s.kit.d === 24 && s.kit.n === 72 && s.compare.a.d === 2 && s.compare.a.n === 0 && s.arith.a.n === 1 && s.arith.op === '+' && s.arith.step === 4 && Array.isArray(s.worksheet.items), '손상된 workspace 값 정상화(클램프·기본값) ' + JSON.stringify({ kit: s.kit, c: s.compare.a, ar: s.arith }));
  expect(await page.locator('.ar-bars [data-who=r] .cell').count() > 0, '정상화된 상태로 렌더 오류 없음');

  // ---------- 카드 편집: 기존 카드 편집 후 활동지 반영·연산 유형 b 필요 ----------
  await page.evaluate(() => localStorage.clear()); await reload(); await sleep(300);
  await page.click('.tabs [data-tab=sheet]'); await sleep(100);
  await page.check('#sheet-cards [data-id="c5-06"]'); await sleep(100);
  const li = await page.locator('#sheet-items li').last().innerText();
  expect(li.includes('3/4 − 1/6'), '뺄셈 카드 → 활동지 뺄셈 문항');
  const ans = await page.evaluate(() => window.FK.sheet.answerOf({ type: 'arith', a: { n: 3, d: 4 }, b: { n: 1, d: 6 }, op: '-' }));
  expect(ans === '7/12', '뺄셈 정답 7/12: ' + ans);
  const ans2 = await page.evaluate(() => window.FK.sheet.answerOf({ type: 'write', a: { n: 8, d: 12 } }));
  expect(ans2 === '8/12 = 2/3 = ≈0.667', '분수 쓰기 정답(기약·소수): ' + ans2);
  const ans3 = await page.evaluate(() => window.FK.sheet.answerOf({ type: 'arith', a: { n: 1, d: 3 }, b: { n: 1, d: 2 }, op: '-' }));
  expect(ans3.includes('뺄 수 없음'), 'A<B 뺄셈 문항 정답 문구: ' + ans3);
  await shot('edge-sheet');
};
