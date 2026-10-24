// code-review-2.js — 추가 재현(chain.op XSS, 400px 넘침 요소, A=B 뺄셈, 같은 탭 클릭 시 펜 삭제, 결과>3단위, 비교→연산 이어짐, models 모두 false 가져오기)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const st = () => ev(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const text = sel => page.locator(sel).first().innerText().catch(() => '');
  const count = sel => page.locator(sel).count();

  // 1) chain.op XSS (두 번째 항의 op 라벨이 innerHTML에 그대로 삽입)
  const evil = JSON.stringify({ app: 'fraction-kit', schema: 1, scenes: [{ id: 'sc-evil2', name: 'xss2', state: { tab: 'kit', kit: { n: 2, d: 4, chain: [{ n: 1, d: 2, op: 'start' }, { n: 2, d: 4, op: '<img src=x onerror="window.__xss2=1">' }] } } }] });
  const r = await ev(t => window.__app.actions.importJson(t), evil);
  await act('loadScene', 'sc-evil2'); await sleep(300);
  const x2 = await ev(() => ({ img: document.querySelectorAll('.kit-chain img').length, ran: window.__xss2 === 1, html: document.querySelector('.kit-chain').innerHTML.slice(0, 200) }));
  log('chain.op xss: ' + JSON.stringify({ r, x2 }));
  expect(x2.img === 0 && !x2.ran, 'D 가져온 chain.op 라벨이 이스케이프 없이 삽입되지 않음 (img=' + x2.img + ', ran=' + x2.ran + ')');

  // 1b) models 모두 false 장면 가져오기 → 모델이 하나도 안 보임
  const evil3 = JSON.stringify({ app: 'fraction-kit', schema: 1, scenes: [{ id: 'sc-nomodel', name: 'nomodel', state: { tab: 'kit', kit: { n: 1, d: 2, models: { bar: false, circle: false, line: false } } } }] });
  await ev(t => window.__app.actions.importJson(t), evil3);
  await act('loadScene', 'sc-nomodel'); await sleep(100);
  const vis = await ev(() => [...document.querySelectorAll('.view-kit .model')].filter(e => !e.hidden).length);
  log('models all false → visible models: ' + vis);
  expect(vis >= 1, 'D 가져온 장면의 models가 모두 false여도 모델이 최소 1개 표시 (실제 ' + vis + ')');

  // 2) 400px에서 넘치는 버튼 식별
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  const over = await ev(() => [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().right > 400 && b.getBoundingClientRect().width > 0).map(b => ({ t: b.textContent.trim().slice(0, 12), p: b.parentElement.className, r: Math.round(b.getBoundingClientRect().right) })));
  log('400px overflow buttons: ' + JSON.stringify(over));
  await page.setViewportSize({ width: 1280, height: 800 });

  // 3) A=B 뺄셈 → 0/L 표시
  await act('setTab', 'arith'); await act('arithOp', '-'); await act('arithSet', 'a', 2, 5); await act('arithSet', 'b', 2, 5);
  for (let i = 0; i < 3; i++) { await act('arithNext'); await sleep(750); }
  const f0 = await text('.ar-formula'); const s0 = await st();
  log('A=B 뺄셈: step=' + s0.arith.step + ' formula=' + f0.replace(/\s+/g, ' '));
  expect(s0.arith.step === 3 && f0.includes('0/5') && errs.length === 0, 'A=B 뺄셈 결과 0/5, 오류 없음');

  // 4) 결과가 3단위를 넘는 덧셈(6/2 + 6/2 = 6): 이동 그룹·결과 막대
  await act('arithOp', '+'); await act('arithSet', 'a', 6, 2); await act('arithSet', 'b', 6, 2);
  await act('arithNext'); await sleep(50); // same d → move anim
  const mv = await ev(() => { const g = document.querySelector('.ar-bars .moving'); if (!g) return null; const xs = [...g.querySelectorAll('rect')].map(r => +r.getAttribute('x')); const tr = g.getAttribute('transform'); return { n: xs.length, maxX: Math.max(...xs), tr }; });
  await sleep(900);
  const f6 = await text('.ar-formula'); const onR = await count('.ar-bars [data-who="r"] .cell.on'), cellsR = await count('.ar-bars [data-who="r"] .cell');
  log('6/2+6/2: moving=' + JSON.stringify(mv) + ' formula=' + f6.replace(/\s+/g, ' ') + ' resultCells=' + onR + '/' + cellsR);
  await act('arithNext'); await sleep(300);
  const f6b = await text('.ar-formula');
  log('6/2+6/2 step3 formula=' + f6b.replace(/\s+/g, ' '));
  expect(/12\/2\s*=\s*6/.test(f6b), '6/2+6/2 식 12/2 = 6');

  // 5) 비교 → 연산 이어짐(user_flow 4)
  await act('setTab', 'compare'); await act('compareSet', 'a', 3, 4); await act('compareSet', 'b', 1, 6);
  await act('arithSet', 'a', 1, 2); // arith step 0
  await act('setTab', 'compare'); await act('setTab', 'arith');
  const s5 = await st();
  expect(s5.arith.a.n === 3 && s5.arith.a.d === 4 && s5.arith.b.n === 1 && s5.arith.b.d === 6, '비교 탭의 A·B가 덧셈·뺄셈 탭으로 이어짐');

  // 6) 현재 탭을 다시 클릭하면 펜 주석이 지워짐
  await act('setTab', 'kit'); await ev(() => { FK.app.state.kit.models = { bar: true, circle: true, line: true }; FK.app.renderTab(); });
  await act('setPen', true); await sleep(100);
  const bb = await page.locator('.kit-bar').boundingBox();
  await page.mouse.move(bb.x + 20, bb.y + 20); await page.mouse.down(); await page.mouse.move(bb.x + 200, bb.y + 40, { steps: 6 }); await page.mouse.up();
  const n1 = await ev(() => FK.app.tr.pen.strokes.length);
  await page.click('.tabs [data-tab="kit"]'); await sleep(100);
  const n2 = await ev(() => FK.app.tr.pen.strokes.length);
  log('same-tab click: strokes ' + n1 + ' → ' + n2);
  expect(n1 === 1 && n2 === 1, 'D 현재 탭을 다시 눌러도 펜 주석 유지 (실제 ' + n1 + '→' + n2 + ')');
  await act('setPen', false);

  // 7) 분모 스테퍼 경계: d=1에서 − 눌러도 피드백 없음 / 버튼 활성 상태
  await act('kitSetD', 1);
  const stp = await ev(() => ({ minus: document.querySelector('[data-action=kit-d][data-delta="-1"]').disabled }));
  await act('kitSetD', 24);
  const stp2 = await ev(() => ({ plus: document.querySelector('[data-action=kit-d][data-delta="1"]').disabled }));
  log('kit-d stepper disabled at bounds: ' + JSON.stringify({ ...stp, ...stp2 }));

  // 8) 카드 삭제(현재 카드) → 토스트 여부
  await act('setTab', 'cards'); await act('selectCard', 'c3-01');
  await page.click('#card-list [data-del="c3-01"]'); await sleep(150);
  await page.click('.modal-foot .btn.primary'); await sleep(150);
  const tdel = await ev(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent));
  const s8 = await st();
  log('delete current card: toasts=' + JSON.stringify(tdel) + ' cards=' + s8.counts.cards + ' current=' + s8.currentCardId);
  expect(s8.counts.cards === 23, '카드 삭제 반영');
  expect(tdel.some(t => t.includes('삭제했어요')), 'D 현재 카드 삭제 시 삭제 토스트 표시');

  // 9) 세로 분수 HTML 접근성 텍스트(선택지)
  await act('selectCard', 'c5-05');
  const a11y = await ev(() => [...document.querySelectorAll('#card-view .choice')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  log('choice textContent: ' + JSON.stringify(a11y));

  log('errors: ' + JSON.stringify(errs));
  expect(errs.length === 0, '추가 테스트 중 페이지 오류 없음');
};
