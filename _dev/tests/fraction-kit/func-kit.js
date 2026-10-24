// func-kit.js — 교구판(3표상·쪼개기·합치기·가분수·드래그·수직선·어림·되돌리기) 기능 검증 (AC1~AC5, AC17)
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const txt = sel => page.locator(sel).first().innerText();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent));
  const ptx = () => page.evaluate(() => { const p = document.querySelector('.kit-line .pt'); return p ? +p.getAttribute('cx') : NaN; });
  const lineFrac = cx => (cx - 36) / 928;
  const setSlider = async v => { await page.locator('#kit-d').fill(String(v)); await page.locator('#kit-d').dispatchEvent('input'); await page.locator('#kit-d').dispatchEvent('change'); };
  const onWidth = () => page.evaluate(() => { const on = [...document.querySelectorAll('.kit-bar .cell.on')]; if (!on.length) return 0; const r = on.map(e => e.getBoundingClientRect()); return Math.max(...r.map(x => x.right)) - Math.min(...r.map(x => x.left)); });

  // ---------- AC1 첫 실행 ----------
  let s = await S();
  expect(s.tab === 'kit' && s.kit.n === 1 && s.kit.d === 2, 'AC1 첫 실행 교구판 1/2 (tab=' + s.tab + ')');
  expect(s.loadedSceneId === 'sc-b08', 'AC1 기본 장면 sc-b08 로드');
  expect(!(await page.locator('#memo-panel').isHidden()) && (await txt('#memo-panel')).includes('×2, ×3'), 'AC1 교사 메모 패널 발문 표시');
  expect(await page.locator('.kit-bar .cell').count() === 2 && await page.locator('.kit-bar .cell.on').count() === 1, 'AC1 막대 2칸 중 1칸 색칠');
  expect(await page.locator('.kit-circle .cell').count() === 2 && await page.locator('.kit-circle .cell.on').count() === 1, 'AC1 원 반쪽 색칠');
  const cx1 = await ptx(); expect(Math.abs(lineFrac(cx1) - 0.5) < 0.001, 'AC1 수직선 점 50% (cx=' + cx1 + ')');
  const ints1 = await page.evaluate(() => [...document.querySelectorAll('.kit-line .tick-label.int')].map(e => e.textContent).join(','));
  expect(ints1 === '0,1', 'AC1 수직선 범위 0~1 (' + ints1 + ')');
  let sym = await txt('.kit-symbol');
  expect(sym.includes('0.5') && sym.includes('2분의 1') && (await page.locator('.kit-symbol .fr-n').first().innerText()) === '1' && (await page.locator('.kit-symbol .fr-d').first().innerText()) === '2', 'AC1 기호 패널 1/2 · 0.5 · 2분의 1');
  expect((await txt('.kit-chain')).trim() === '1/2', 'AC1 사슬 초기 1/2');
  expect(s.counts.scenes === 12 && s.counts.cards === 24 && s.counts.cardSets === 2, 'AC1 내장 장면 12·카드 24·세트 2 ' + JSON.stringify(s.counts));
  expect(await page.locator('#btn-undo').isDisabled() && await page.locator('#btn-redo').isDisabled(), 'AC1 되돌리기·다시하기 초기 비활성');
  await shot('kit-initial');

  // ---------- AC2 분모 8, 3번째 칸 클릭 ----------
  await setSlider(8);
  s = await S(); expect(s.kit.d === 8 && s.kit.n === 1, '슬라이더 8 → 1/8 (분자 유지)');
  expect(await page.locator('.kit-bar .cell').count() === 8 && await page.locator('.kit-circle .cell').count() === 8, '세 모델 8등분 재렌더');
  await page.locator('.kit-bar .cell[data-i="2"]').click();
  s = await S(); expect(s.kit.n === 3 && s.kit.d === 8, 'AC2 3번째 칸 클릭 → 3/8');
  sym = await txt('.kit-symbol');
  expect(sym.includes('0.375') && sym.includes('8분의 3'), 'AC2 소수 0.375 · 읽기 8분의 3');
  expect(await page.locator('.kit-circle .cell.on').count() === 3, 'AC2 원 조각 3개 색칠');
  const cx2 = await ptx(); expect(Math.abs(lineFrac(cx2) - 0.375) < 0.001, 'AC2 수직선 점 37.5% (' + lineFrac(cx2).toFixed(4) + ')');
  await page.locator('.kit-bar .cell[data-i="2"]').click();
  s = await S(); expect(s.kit.n === 2, 'AC2 마지막 칸 재클릭 → 2/8');
  // 원 조각 클릭도 같은 규칙
  await page.locator('.kit-circle .cell[data-i="5"]').dispatchEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true });
  await page.locator('.kit-circle').dispatchEvent('pointerup', { pointerId: 1, bubbles: true });
  s = await S(); expect(s.kit.n === 6, '원 6번째 조각 클릭 → 6/8');
  expect(await page.locator('.kit-bar .cell.on').count() === 6, '원 조작 → 막대 동기화 6칸');
  const hint = await page.locator('.kit-symbol .sym-chip.hint').innerText();
  expect(hint.includes('3/4'), '약분 힌트 = 3/4 (' + hint + ')');
  // 칸 번호 라벨 d ≤ 12
  expect(await page.locator('.kit-bar .cell-label').count() === 8, '막대 칸 번호 라벨 8개');

  // ---------- 드래그 색칠/지우기 ----------
  await act('kitSetN', 0);
  const bar = await page.locator('.kit-bar').boundingBox();
  const cellW = bar.width / 8;
  await page.mouse.move(bar.x + cellW * 0.5, bar.y + bar.height / 2); await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(bar.x + cellW * (i + 0.5), bar.y + bar.height / 2, { steps: 3 });
  await page.mouse.up();
  s = await S(); expect(s.kit.n === 5, '드래그 색칠 0→5칸 (n=' + s.kit.n + ')');
  await page.mouse.move(bar.x + cellW * 4.5, bar.y + bar.height / 2); await page.mouse.down();
  for (let i = 3; i >= 2; i--) await page.mouse.move(bar.x + cellW * (i + 0.5), bar.y + bar.height / 2, { steps: 3 });
  await page.mouse.up();
  s = await S(); expect(s.kit.n === 2, '색칠 칸에서 시작한 드래그 = 지우기 모드 → 2 (n=' + s.kit.n + ')');
  expect((await S()).undo.past >= 2, '드래그 종료마다 undo 스택 push');

  // ---------- 수직선 점 드래그 스냅 ----------
  const line = await page.locator('.kit-line').boundingBox();
  const lx = v => line.x + line.width * (36 + 928 * v) / 1000, ly = line.y + line.height * 44 / 96;
  await page.mouse.move(lx(2 / 8), ly); await page.mouse.down(); await page.mouse.move(lx(0.70), ly, { steps: 6 }); await page.mouse.up();
  s = await S(); expect(s.kit.n === 6, '수직선 드래그 0.70 → 6/8 스냅 (n=' + s.kit.n + ')');
  expect(await page.locator('.kit-bar .cell.on').count() === 6 && await page.locator('.kit-circle .cell.on').count() === 6, '수직선 조작 → 막대·원 동기화');

  // ---------- AC3 ×2 ×3, 색칠 폭 불변, 24 상한 ----------
  await act('kitSetD', 2); await act('kitSetN', 1);
  const w1 = await onWidth();
  await page.click('#btn-x2'); await sleep(500);
  s = await S(); expect(s.kit.n === 2 && s.kit.d === 4, 'AC3 ×2 → 2/4');
  const w2 = await onWidth(); expect(Math.abs(w1 - w2) < 1, `AC3 색칠 폭 불변 ${w1.toFixed(1)}→${w2.toFixed(1)}`);
  let chain = await txt('.kit-chain');
  expect(/1\/2\s*×2\s*=\s*2\/4/.test(chain.replace(/\n/g, ' ')) || (chain.includes('1/2') && chain.includes('2/4') && chain.includes('×2')), 'AC3 사슬 1/2 = 2/4 + ×2 라벨: ' + chain.replace(/\n/g, ' '));
  const circOn = await page.locator('.kit-circle .cell.on').count(); expect(circOn === 2, 'AC3 원 색칠 조각 2개(각도 동일)');
  await page.click('#btn-x3'); await sleep(500);
  s = await S(); chain = await txt('.kit-chain');
  expect(s.kit.d === 12 && s.kit.n === 6 && chain.includes('6/12') && chain.includes('×3'), 'AC3 ×3 → 6/12 사슬 추가');
  const w3 = await onWidth(); expect(Math.abs(w1 - w3) < 1, 'AC3 ×3 후 색칠 폭 불변');
  expect(!(await page.locator('#btn-x2').isDisabled()) && await page.locator('#btn-x3').isDisabled(), 'AC3 분모 12: ×2 활성, ×3 비활성(36>24)');
  await page.click('#btn-x2'); await sleep(500);
  s = await S(); expect(s.kit.d === 24 && s.kit.n === 12, '×2 → 12/24');
  expect(await page.locator('#btn-x2').isDisabled() && await page.locator('#btn-x3').isDisabled() && (await page.locator('#btn-x2').getAttribute('title')) === '분모는 24까지 나눌 수 있어요' && (await page.locator('#btn-x3').getAttribute('title')) === '분모는 24까지 나눌 수 있어요', 'AC3 분모 24: ×2·×3 비활성 + 툴팁');
  expect(await page.locator('.kit-bar .cell-label').count() === 0 && await page.locator('.kit-line .tick-label:not(.int)').count() === 0, '분모 24: 칸 번호·분수 눈금 라벨 생략');
  await shot('kit-24');
  // 사슬 지우기
  await page.click('[data-action=clear-chain]');
  s = await S(); expect(s.kit.chain.length === 1 && (await txt('.kit-chain')).trim() === '12/24', '사슬 지우기 → 현재 분수 하나');

  // ---------- AC4 합치기 ----------
  await act('kitSetD', 12); await act('kitSetN', 8);
  await page.click('[data-action=merge]'); await sleep(500);
  s = await S(); expect(s.kit.n === 4 && s.kit.d === 6, 'AC4 8/12 → 4/6');
  await page.click('[data-action=merge]'); await sleep(500);
  s = await S(); expect(s.kit.n === 2 && s.kit.d === 3, 'AC4 4/6 → 2/3');
  chain = await txt('.kit-chain'); expect((chain.match(/÷2/g) || []).length === 2 && chain.includes('8/12') && chain.includes('2/3'), 'AC4 ÷2 라벨 2회: ' + chain.replace(/\n/g, ' '));
  await page.click('[data-action=merge]'); await sleep(150);
  expect((await toasts()).some(t => t.includes('더 약분할 수 없어요')), 'AC4 기약분수 토스트');
  s = await S(); expect(s.kit.n === 2 && s.kit.d === 3, 'AC4 기약분수에서 상태 불변');
  // 1/1 ×2 → 2/2 → ×3 불가(6 ok) 시연
  await act('kitSetD', 1); await act('kitSetN', 1);
  expect(await page.locator('.kit-bar .cell').count() === 1 && await page.locator('.kit-circle circle.cell').count() === 1, '분모 1: 막대 1칸·원 전체');
  await page.click('#btn-x2'); await sleep(450);
  chain = await txt('.kit-chain'); s = await S();
  expect(s.kit.n === 2 && s.kit.d === 2 && /^1\s*/.test(chain.trim()) && chain.includes('2/2'), '1/1 ×2 → 2/2, 사슬 "1 = 2/2": ' + chain.replace(/\n/g, ' '));
  // 분자 0
  await act('kitSetD', 4); await act('kitSetN', 0);
  sym = await txt('.kit-symbol');
  expect(await page.locator('.kit-bar .cell.on').count() === 0 && /소수\s*0\b/.test(sym) && /읽기\s*0\b/.test(sym), '분자 0: 색칠 없음, 소수 0, 읽기 0');
  expect(await page.locator('[data-action=kit-n][data-delta="-1"]').isDisabled(), '분자 0에서 − 비활성');

  // ---------- AC5 가분수·분모 13 ----------
  for (let i = 0; i < 7; i++) await page.click('[data-action=kit-n][data-delta="1"]');
  s = await S(); expect(s.kit.n === 7 && s.kit.d === 4, 'AC5 분자 + 7회 → 7/4');
  expect(await page.locator('.kit-bar .bar-frame').count() === 2 && await page.locator('.kit-circle .circle-frame').count() === 2, 'AC5 막대·원 2단위로 확장');
  const ints5 = await page.evaluate(() => [...document.querySelectorAll('.kit-line .tick-label.int')].map(e => e.textContent).join(','));
  expect(ints5 === '0,1,2', 'AC5 수직선 0~2 (' + ints5 + ')');
  sym = await txt('.kit-symbol');
  expect(sym.includes('1.75') && sym.includes('1과 4분의 3') && (await page.locator('.kit-symbol .sym-main .fr').count()) === 2 && (await page.locator('.kit-symbol .fr-w').innerText()) === '1', 'AC5 7/4 = 1 3/4 · 1.75 · 1과 4분의 3');
  for (let i = 0; i < 5; i++) await page.click('[data-action=kit-n][data-delta="1"]');
  s = await S(); expect(s.kit.n === 12 && await page.locator('[data-action=kit-n][data-delta="1"]').isDisabled(), '분자 상한 3×4=12에서 + 비활성');
  expect(await page.locator('.kit-bar .bar-frame').count() === 3, '12/4 → 막대 3단위');
  await act('kitSetN', 13);
  expect((await toasts()).some(t => t.includes('최대 3까지')) && (await S()).kit.n === 12, '분자 상한 초과 API → 토스트 + 클램프');
  await act('kitSetD', 13);
  s = await S(); expect(s.kit.d === 13 && s.kit.n === 12, '분모 13: 분자 유지(12 ≤ 39)');
  const capVis = await page.locator('.kit-circle-cap').isVisible();
  await page.locator('.kit-circle .cell[data-i="0"]').dispatchEvent('pointerdown', { pointerId: 2, clientX: 0, clientY: 0, bubbles: true });
  await page.locator('.kit-circle').dispatchEvent('pointerup', { pointerId: 2, bubbles: true });
  s = await S(); expect(s.kit.n === 12, 'AC5 분모 13에서 원 조각 클릭 무시');
  expect(capVis && (await txt('.kit-circle-cap')).includes('원은 12등분까지 조작할 수 있어요'), 'AC5 원 캡션 표시');
  expect(await page.locator('.kit-circle .div.thin').count() > 0, 'AC5 원 분할선 가늘게(.thin)');
  await page.locator('.kit-bar .cell[data-i="3"]').click();
  s = await S(); expect(s.kit.n === 4, '분모 13에서 막대 칸 클릭은 동작 → 4/13');
  sym = await txt('.kit-symbol'); expect(sym.includes('≈0.308'), '4/13 소수 ≈0.308');
  await shot('kit-13');
  // 분모 줄이면 분자 보정 min(n, 3d)
  await act('kitSetD', 12); await act('kitSetN', 36); await act('kitSetD', 2);
  s = await S(); expect(s.kit.d === 2 && s.kit.n === 6, '분모 12→2: 분자 36→6으로 보정');

  // ---------- 모델 표시·수직선 범위·소수 토글 ----------
  await act('kitSetD', 4); await act('kitSetN', 1);
  await page.uncheck('[data-model-toggle=circle]');
  expect(await page.locator('.model[data-model=circle]').isHidden() && (await S()).kit.models.circle === false, '원 모델 끄기');
  await page.uncheck('[data-model-toggle=bar]'); await page.uncheck('[data-model-toggle=line]');
  expect((await S()).kit.models.bar === true && (await toasts()).some(t => t.includes('하나 이상')), '모든 모델 끄기 방지(막대 자동 켜짐 + 토스트)');
  await page.check('[data-model-toggle=circle]'); await page.check('[data-model-toggle=line]');
  await page.selectOption('#kit-range', '3');
  const ints3 = await page.evaluate(() => [...document.querySelectorAll('.kit-line .tick-label.int')].map(e => e.textContent).join(','));
  expect(ints3 === '0,1,2,3' && await page.locator('.kit-bar .bar-frame').count() === 3, '수직선 범위 3 → 0~3, 막대 3단위');
  await page.selectOption('#kit-range', 'auto');
  expect(await page.locator('.kit-bar .bar-frame').count() === 1, '범위 자동 → 1단위');
  await page.uncheck('#kit-decimal');
  expect(!(await txt('.kit-symbol')).includes('소수'), '소수 표시 끄기');
  await page.check('#kit-decimal');

  // ---------- 어림해서 찍기 ----------
  await act('kitSetD', 8); await act('kitSetN', 1);
  await page.click('[data-action=estimate]'); await sleep(150);
  expect(await page.locator('.modal[role=dialog]').count() === 1 && (await txt('.modal')).includes('어림해서 찍기'), '어림 모달 열림');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'est-n', '어림 모달 첫 입력에 포커스');
  await page.fill('#est-n', '99'); await page.click('.modal-foot .btn.primary'); await sleep(100);
  expect(await page.locator('.modal').count() === 1 && (await txt('#est-err')).includes('분자는 0~'), '어림 목표 범위 초과 → 인라인 오류, 모달 유지');
  await page.fill('#est-n', '5'); await page.click('.modal-foot .btn.primary'); await sleep(150);
  s = await S(); expect(s.estimate && s.estimate.target.n === 5 && s.estimate.target.d === 8, '어림 모드 시작 목표 5/8');
  expect(await page.locator('.kit-line .tick-label:not(.int)').count() === 0 && await page.locator('.kit-line .tick-label.int').count() === 2 && await page.locator('.kit-line .pt').count() === 0, '어림: 분수 눈금 숨김·정수 눈금만·점 없음');
  expect((await txt('.kit-estimate')).includes('목표'), '어림 목표 분수 표시');
  const l2 = await page.locator('.kit-line').boundingBox();
  const lx2 = v => l2.x + l2.width * (36 + 928 * v) / 1000, ly2 = l2.y + l2.height * 44 / 96;
  await page.mouse.click(lx2(0.63), ly2); await sleep(500);
  let msg = await txt('.est-msg'); expect(msg.includes('정확해요'), '0.63 탭(목표 0.625, 오차<1/32) → 정확해요: ' + msg);
  expect(await page.locator('.kit-line .pt.f-r').count() === 1 && await page.locator('.kit-line .pt.f-a').count() === 1, '정답 초록 점 + 탭 점 표시');
  await page.click('[data-action=est-again]'); await sleep(100);
  expect(await page.locator('.kit-line .pt').count() === 0, '다시 → 점 제거');
  await page.mouse.click(lx2(0.70), ly2); await sleep(500);
  msg = await txt('.est-msg'); expect(msg.includes('가까워요') && msg.includes('1/8'), '0.70 탭(오차 0.075<1/8) → 가까워요 (차이 약 1/8): ' + msg);
  await page.click('[data-action=est-again]'); await sleep(100);
  await page.mouse.click(lx2(0.25), ly2); await sleep(500);
  msg = await txt('.est-msg'); expect(msg.includes('오른쪽으로 3칸'), '0.25 탭(오차 0.375=3칸) → 오른쪽으로 3칸: ' + msg);
  await page.click('[data-action=est-random]'); await sleep(100);
  s = await S(); expect(s.estimate && s.estimate.target.n >= 1 && s.estimate.target.n <= 8, '무작위 목표 범위 1~8 (' + (s.estimate && s.estimate.target.n) + ')');
  await page.click('.kit-estimate [data-action=estimate]'); await sleep(100);
  s = await S(); expect(!s.estimate && await page.locator('.kit-line .tick-label:not(.int)').count() === 7 && await page.locator('.kit-line .pt').count() === 1, '끝내기 → 눈금 복원');
  await page.click('[data-action=estimate]'); await sleep(100); await page.keyboard.press('Escape'); await sleep(100);
  expect(await page.locator('.modal').count() === 0 && !(await S()).estimate, 'ESC로 어림 모달 닫힘');

  // ---------- AC17 되돌리기/다시하기 ----------
  await act('kitSetD', 6); await act('kitSetN', 0);
  await page.locator('.kit-bar .cell[data-i="2"]').click();
  await page.click('#btn-x2'); await sleep(450);
  await setSlider(8);
  s = await S(); expect(s.kit.n === 6 && s.kit.d === 8, 'AC17 칸 클릭(3/6) → ×2(6/12) → 슬라이더 8 → 6/8');
  await page.keyboard.press('Control+z'); s = await S(); expect(s.kit.n === 6 && s.kit.d === 12 && s.kit.chain.length === 2, 'AC17 undo1 → 6/12 (사슬 복원)');
  await page.keyboard.press('Control+z'); s = await S(); expect(s.kit.n === 3 && s.kit.d === 6, 'AC17 undo2 → 3/6');
  await page.keyboard.press('Control+z'); s = await S(); expect(s.kit.n === 0 && s.kit.d === 6, 'AC17 undo3 → 0/6');
  expect(!(await page.locator('#btn-redo').isDisabled()), 'AC17 undo 후 다시하기 활성');
  await page.click('#btn-redo'); s = await S(); expect(s.kit.n === 3 && s.kit.d === 6, 'AC17 redo → 3/6');
  await page.keyboard.press('Control+y'); s = await S(); expect(s.kit.d === 12, 'AC17 Ctrl+Y redo → 6/12');
  await page.keyboard.press('Control+Shift+z'); s = await S(); expect(s.kit.d === 8, 'AC17 Ctrl+Shift+Z redo → 6/8');
  expect(await page.locator('#btn-redo').isDisabled() && !(await page.locator('#btn-undo').isDisabled()), 'AC17 스택 끝에서 redo 비활성');
  // 새 조작 후 future 비움
  await page.keyboard.press('Control+z'); await act('kitSetN', 1);
  expect(await page.locator('#btn-redo').isDisabled(), '새 조작 후 redo 스택 비움');
  // 50단계 상한
  for (let i = 0; i < 60; i++) await act('kitSetN', (i % 2) + 1);
  s = await S(); expect(s.undo.past === 50, '되돌리기 스택 최대 50 (' + s.undo.past + ')');
  // 탭별 별도 스택
  await page.click('[data-tab=compare]');
  expect(await page.locator('#btn-undo').isDisabled(), '비교 탭 스택은 비어 있음(탭별 분리)');
  await page.click('[data-tab=cards]');
  expect(await page.locator('#btn-undo').isDisabled() && await page.locator('#btn-redo').isDisabled(), '카드 탭에서 undo/redo 비활성');
  await page.click('[data-tab=kit]');
  expect(!(await page.locator('#btn-undo').isDisabled()), '교구판 복귀 시 스택 유지');

  // ---------- 새로고침 후 복원 ----------
  await act('kitSetD', 10); await act('kitSetN', 7); await page.selectOption('#kit-range', '2'); await sleep(400);
  await reload();
  s = await S(); expect(s.tab === 'kit' && s.kit.d === 10 && s.kit.n === 7 && s.kit.lineRange === 2, '새로고침 후 교구판 상태 복원 ' + JSON.stringify(s.kit));
  expect(await page.locator('#btn-undo').isDisabled(), '새로고침 후 undo 스택 초기화(의도)');
  expect(await page.locator('.kit-line .tick-label.int').count() === 3, '새로고침 후 수직선 범위 2 복원');
};
