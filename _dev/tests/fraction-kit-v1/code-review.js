// code-review.js — 분수교구함 코드 리뷰용 재현 테스트(수용 기준 + 의심 결함 재현)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const st = () => ev(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const text = sel => page.locator(sel).first().innerText().catch(() => '');
  const toasts = () => ev(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent));
  const count = sel => page.locator(sel).count();

  // ---- AC1 초기 상태 ----
  let s = await st();
  expect(s.tab === 'kit' && s.kit.n === 1 && s.kit.d === 2, 'AC1 초기 1/2');
  let sym = await text('.kit-symbol');
  expect(sym.includes('0.5') && sym.includes('2분의 1'), 'AC1 기호 패널 0.5 · 2분의 1: ' + sym.replace(/\s+/g, ' '));
  expect(s.counts.scenes === 12 && s.counts.cards === 24 && s.counts.cardSets === 2, 'AC1 내장 12/24/2: ' + JSON.stringify(s.counts));
  expect(s.loadedSceneId === 'sc-b08', 'AC1 기본 장면 sc-b08 로드');
  const ptx = await ev(() => +document.querySelector('.kit-line .pt').getAttribute('cx'));
  expect(Math.abs(ptx - (36 + 928 * 0.5)) < 1, 'AC1 수직선 점 50% 위치 cx=' + ptx);

  // ---- AC2 분모 8, 3번째 칸 ----
  await act('kitSetD', 8);
  await page.click('.kit-bar .cell[data-i="2"]');
  s = await st(); sym = await text('.kit-symbol');
  expect(s.kit.n === 3 && s.kit.d === 8, 'AC2 3/8 상태');
  expect(sym.includes('0.375') && sym.includes('8분의 3'), 'AC2 기호 0.375 · 8분의 3');
  expect(await count('.kit-circle .cell.on') === 3, 'AC2 원 조각 3개 색칠');
  const ptx2 = await ev(() => +document.querySelector('.kit-line .pt').getAttribute('cx'));
  expect(Math.abs(ptx2 - (36 + 928 * 0.375)) < 1, 'AC2 수직선 37.5% cx=' + ptx2);
  await page.click('.kit-bar .cell[data-i="2"]');
  s = await st(); expect(s.kit.n === 2, 'AC2 다시 클릭 → 2/8');

  // ---- AC3 ×2 ×3, 색칠 폭 불변 ----
  await act('kitSetD', 2); await act('kitSetN', 1);
  const fillW = () => ev(() => { const on = [...document.querySelectorAll('.kit-bar .cell.on')]; const r = on.map(e => e.getBoundingClientRect()); return Math.max(...r.map(x => x.right)) - Math.min(...r.map(x => x.left)); });
  const w1 = await fillW();
  await act('kitSplit', 2); await sleep(500);
  const w2 = await fillW(); s = await st();
  expect(s.kit.n === 2 && s.kit.d === 4 && Math.abs(w1 - w2) < 0.5, `AC3 ×2 → 2/4, 폭 ${w1.toFixed(1)}→${w2.toFixed(1)}`);
  let chain = await text('.kit-chain');
  expect(chain.includes('1/2') && chain.includes('2/4') && chain.includes('×2'), 'AC3 사슬 1/2 = 2/4 ×2: ' + chain.replace(/\s+/g, ' '));
  await act('kitSplit', 3); await sleep(500);
  s = await st(); chain = await text('.kit-chain');
  expect(s.kit.n === 6 && s.kit.d === 12 && chain.includes('6/12'), 'AC3 ×3 → 6/12');
  await act('kitSetD', 24);
  const dis = await ev(() => ({ x2: document.querySelector('#btn-x2').disabled, t2: document.querySelector('#btn-x2').title, x3: document.querySelector('#btn-x3').disabled }));
  expect(dis.x2 && dis.x3 && dis.t2 === '분모는 24까지 나눌 수 있어요', 'AC3 분모 24에서 ×2/×3 비활성+툴팁');

  // ---- AC4 합치기 ----
  await act('kitSetD', 12); await act('kitSetN', 8);
  await act('kitMerge'); await sleep(450); s = await st(); expect(s.kit.n === 4 && s.kit.d === 6, 'AC4 8/12 → 4/6');
  await act('kitMerge'); await sleep(450); s = await st(); expect(s.kit.n === 2 && s.kit.d === 3, 'AC4 4/6 → 2/3');
  chain = await text('.kit-chain'); expect((chain.match(/÷2/g) || []).length === 2, 'AC4 ÷2 라벨 2개');
  await act('kitMerge'); const t4 = await toasts();
  expect(t4.some(t => t.includes('더 약분할 수 없어요(기약분수)')), 'AC4 기약분수 토스트: ' + t4.join('|'));

  // ---- AC5 7/4, 분모 13 ----
  await act('kitSetD', 4); await act('kitSetN', 7);
  sym = await text('.kit-symbol');
  const units = await count('.kit-bar .bar-bg'), cu = await count('.kit-circle .circle-frame');
  const intLabels = await ev(() => [...document.querySelectorAll('.kit-line .tick-label.int')].map(t => t.textContent));
  expect(units === 2 && cu === 2 && intLabels.join(',') === '0,1,2', `AC5 7/4 막대2 원2 수직선0~2 (${units},${cu},${intLabels})`);
  expect(sym.includes('1.75') && sym.includes('1과 4분의 3'), 'AC5 1.75 · 1과 4분의 3');
  await act('kitSetD', 13);
  const capHidden = await ev(() => document.querySelector('.kit-circle-cap').hidden);
  const locked = await count('.kit-circle .locked');
  const nBefore = (await st()).kit.n;
  await page.click('.kit-circle .cell', { force: true }).catch(() => {});
  expect(!capHidden && locked === 1 && (await st()).kit.n === nBefore, 'AC5 분모 13: 원 잠김+캡션, 클릭 무시');

  // ---- AC6 비교 ----
  await act('setTab', 'compare');
  await act('compareSet', 'a', 2, 3); await act('compareSet', 'b', 3, 5);
  await act('compareStart'); await sleep(450); await act('compareNext'); await sleep(450); await act('compareNext'); await sleep(100);
  let f = await text('.cmp-formula');
  expect(['2/3 = 10/15', '3/5 = 9/15', '10/15 > 9/15 → 2/3 > 3/5', '차이: 1/15'].every(x => f.includes(x)), 'AC6 통분 식 4줄: ' + f.replace(/\s+/g, ' '));
  await act('compareOverlay');
  expect(await count('.cmp-bars .cell.ov') === 1 && await count('.cmp-bars .hatch') >= 1, 'AC6 겹쳐 보기 반투명+빗금');
  const ovOp = await ev(() => getComputedStyle(document.querySelector('.cmp-bars .cell.ov')).opacity);
  expect(ovOp === '0.55', 'AC6 overlay opacity 0.55: ' + ovOp);
  await act('compareOverlay');
  // 같은 분모
  await act('compareSet', 'a', 2, 5); await act('compareSet', 'b', 4, 5); await act('compareStart');
  const t6 = await toasts(); s = await st();
  expect(s.compare.step === 3 && t6.some(t => t.includes('이미 분모가 같아요')), '비교 같은 분모 → 3단계+토스트');

  // ---- AC7 덧셈 ----
  await act('setTab', 'arith');
  await act('arithOp', '+'); await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 1, 3);
  for (let i = 0; i < 3; i++) { await act('arithNext'); await sleep(750); }
  f = await text('.ar-formula');
  expect(f.includes('1/2 + 1/3') && f.includes('3/6 + 2/6') && f.includes('5/6'), 'AC7 1/2+1/3 식 전개: ' + f.replace(/\s+/g, ' '));
  expect(await count('.ar-bars [data-who="r"] .cell.on') === 5 && await count('.ar-bars [data-who="r"] .cell') === 6, 'AC7 결과 막대 6칸 중 5칸');
  await act('arithSet', 'a', 3, 4); await act('arithSet', 'b', 3, 4);
  for (let i = 0; i < 4; i++) { await act('arithNext'); await sleep(750); }
  f = await text('.ar-formula');
  expect(f.includes('6/4') && f.includes('1 2/4') && f.includes('1 1/2'), 'AC7 3/4+3/4: 6/4 = 1 2/4 = 1 1/2: ' + f.replace(/\s+/g, ' '));
  expect(await count('.ar-bars [data-who="r"] .bar-bg') === 2, 'AC7 결과 막대 2단위');

  // ---- AC8 뺄셈 모달 + 오개념 거울 ----
  await act('arithOp', '-'); await act('arithSet', 'a', 1, 3); await act('arithSet', 'b', 1, 2);
  await page.click('[data-action="ar-next"]'); await sleep(200);
  const mtxt = await text('.modal');
  expect(mtxt.includes('앞의 분수가 더 작아요. 자리를 바꿀까요?'), 'AC8 뺄셈 모달 문구');
  await page.click('.modal-foot .btn.primary'); await sleep(700);
  s = await st(); expect(s.arith.a.n === 1 && s.arith.a.d === 2 && s.arith.b.d === 3, 'AC8 바꾸기 → A=1/2 B=1/3');
  for (let i = 0; i < 2; i++) { await act('arithNext'); await sleep(1300); }
  f = await text('.ar-formula'); expect(f.includes('1/6'), 'AC8 결과 1/6: ' + f.replace(/\s+/g, ' '));
  await act('arithOp', '+'); await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 1, 3);
  for (let i = 0; i < 3; i++) { await act('arithNext'); await sleep(750); }
  await act('arithMirror'); await sleep(100);
  const ml = await text('.ar-mirror-label');
  expect(ml === '분자끼리·분모끼리 더하면 2/5 — 실제 결과 5/6과의 차이: 13/30', 'AC8 거울 라벨: ' + ml);
  expect(await count('.ar-bars .cell.on.f-w') === 2, 'AC8 거울 막대(빗금) 2칸');
  await shot('arith-mirror');

  // ---- 결함 재현: 결과 막대 클릭 시 예외 ----
  await act('arithSet', 'a', 1, 2); // step 0
  errs.length = 0;
  await page.click('.ar-bars [data-who="r"] .cell >> nth=0'); await sleep(100);
  log('result-bar click errors: ' + JSON.stringify(errs));
  expect(errs.length === 0, 'D 결과 막대 칸 클릭 시 예외 없음 (errs=' + errs.join(';') + ')');
  errs.length = 0;

  // ---- 결함 재현: 뺄셈 이동 애니메이션 중 되돌리기 → 오래된 렌더 ----
  await act('arithOp', '-'); await act('arithSet', 'a', 5, 6); await act('arithSet', 'b', 2, 6);
  await ev(() => { window.__app.actions.arithNext(); }); await sleep(50);
  await act('undo'); await sleep(1600);
  s = await st();
  const activeSteps = await count('.ar-steps li.active'), onR = await count('.ar-bars [data-who="r"] .cell.on');
  log(`stale-render: state.step=${s.arith.step}, activeSteps=${activeSteps}, result cells on=${onR}`);
  expect(s.arith.step === 0 && activeSteps === 0 && onR === 0, `D 되돌리기 후 화면이 상태(step 0)와 일치 (active=${activeSteps}, on=${onR})`);

  // ---- AC9 탐구 카드 c3-03 ----
  await act('setTab', 'cards'); await act('selectCard', 'c3-03'); await sleep(100);
  expect(await count('#card-stage .curtained') >= 1, 'AC9 카드 로드 시 식 영역 커튼');
  await act('predict', 1); await act('confirmCard'); await sleep(2600);
  f = await text('#card-stage .cmp-formula');
  expect(f.includes('1/3 > 1/4') && f.includes('차이: 1/12'), 'AC9 확인 후 1/3 > 1/4, 차이 1/12: ' + f.replace(/\s+/g, ' '));
  expect(await count('#card-stage .curtained') === 0, 'AC9 커튼 내려감');
  let rm = await text('.result-msg');
  expect(rm.includes('예측과 달라요 — 왜 그럴까요?') && await count('.explain') === 1, 'AC9 주황 메시지+해설');
  await act('selectCard', 'c3-03'); await act('predict', 0); await act('confirmCard'); await sleep(2600);
  rm = await text('.result-msg'); expect(rm.includes('예측대로예요!'), 'AC9 정답 예측 → 초록 메시지');
  // 선택지 '4/1' 렌더
  await act('selectCard', 'c3-01'); await sleep(100);
  const ch3 = await ev(() => { const c = document.querySelectorAll('#card-view .choice')[2]; return { txt: c.textContent.trim(), hasD: !!c.querySelector('.fr-d') }; });
  log('choice 4/1 render: ' + JSON.stringify(ch3));
  expect(ch3.hasD, 'D 선택지 "4/1"이 분수 형태로 표시됨 (실제: ' + ch3.txt + ')');
  // c5-08 (수직선 두 점) 오류 없음
  errs.length = 0; await act('selectCard', 'c5-08'); await sleep(100);
  expect(errs.length === 0 && await count('#card-stage .kit-line .pt') === 2, 'c5-08 수직선 두 점, 오류 없음');

  // ---- AC10 집계 ----
  await act('selectCard', 'c3-03'); await act('setTally', [9, 12, 3]); await sleep(100);
  const widths = await ev(() => [...document.querySelectorAll('.tally-fill')].map(e => e.style.width));
  const labels = await ev(() => [...document.querySelectorAll('.tally-label')].map(e => e.textContent));
  expect(widths.join(',') === '37.5%,50%,12.5%', 'AC10 막대 폭 ' + widths.join(','));
  expect(labels[0].startsWith('9명') && labels[1].startsWith('12명') && labels[2].startsWith('3명'), 'AC10 라벨 ' + labels.join('|'));
  await act('predict', 0); await act('confirmCard'); await sleep(200);
  expect(await count('.tally-row.correct') === 1, 'AC10 확인 후 정답 막대 강조');
  await reload();
  const tl = await ev(() => window.__app.actions.getDb().tally['c3-03'].counts);
  expect(tl.join(',') === '9,12,3', 'AC10 새로고침 후 집계 유지');

  // ---- AC11 장면 저장/복원 ----
  await act('setTab', 'kit'); await act('kitSetD', 6); await act('kitSetN', 4); await act('kitSplit', 2); await sleep(450);
  const sid = await act('saveScene', { name: '테스트 장면', grade: 5, unit: '5-1', memo: '발문 테스트' });
  s = await st(); expect(s.counts.scenes === 13 && typeof sid === 'string', 'AC11 저장 후 장면 13개');
  await reload(); s = await st(); expect(s.counts.scenes === 13, 'AC11 새로고침 후 유지');
  await act('setTab', 'scenes');
  expect(await count('.scene-card') === 13 && await count('.scene-card .thumb') === 13, 'AC11 보관함 카드·썸네일 13');
  await act('setTab', 'kit'); await act('kitSetD', 3); await act('kitSetN', 1);
  await act('loadScene', sid); await sleep(100); s = await st();
  const memo = await ev(() => ({ hidden: document.querySelector('#memo-panel').hidden, body: document.querySelector('#memo-body').textContent }));
  expect(s.tab === 'kit' && s.kit.n === 8 && s.kit.d === 12 && s.kit.chain.length === 2, 'AC11 불러오기 → 8/12 + 사슬 복원');
  expect(!memo.hidden && memo.body === '발문 테스트', 'AC11 교사 메모 패널 표시');

  // ---- AC12 내보내기/가져오기 ----
  const exp = await ev(() => JSON.stringify(window.__app.actions.exportJson()));
  const r1 = await ev(t => window.__app.actions.importJson(t), exp);
  expect(r1 && r1.scenes === 0 && r1.cards === 0 && r1.sets === 0 && r1.skipped.length === 39, 'AC12 같은 파일 재가져오기 → 모두 건너뜀: ' + JSON.stringify(r1 && { ...r1, skipped: r1.skipped.length }));
  await ev(() => { document.querySelector('.modal-x') && document.querySelector('.modal-x').click(); });
  const r2 = await ev(() => window.__app.actions.importJson('hello world'));
  const t12 = await toasts(); s = await st();
  expect(r2 === null && t12.some(t => t.includes('JSON 형식이 아닙니다')) && s.counts.scenes === 13, 'AC12 텍스트 파일 → JSON 형식 오류, 장면 수 불변');
  // 결함 재현: 가져오기 id·chain.op 이스케이프 누락(XSS)
  const evil = JSON.stringify({ app: 'fraction-kit', schema: 1, scenes: [{ id: 'sc-x"><img src=x onerror="window.__xss1=1">', name: 'xss', state: { tab: 'kit', kit: { n: 1, d: 2, chain: [{ n: 1, d: 2, op: '<img src=x onerror="window.__xss2=1">' }] } } }] });
  const r3 = await ev(t => window.__app.actions.importJson(t), evil);
  await act('setTab', 'scenes'); await sleep(300);
  const x1 = await ev(() => ({ img: document.querySelectorAll('#scene-grid img').length, ran: window.__xss1 === 1 }));
  log('xss scene grid: ' + JSON.stringify({ r3, x1 }));
  expect(x1.img === 0 && !x1.ran, 'D 가져온 장면 id가 innerHTML에 이스케이프 없이 삽입되지 않음 (img=' + x1.img + ', ran=' + x1.ran + ')');
  const xid = await ev(() => (window.__app.actions.getDb().scenes.find(s => s.name === 'xss') || {}).id);
  await ev(id => window.__app.actions.loadScene(id), xid); await sleep(300);
  const x2 = await ev(() => ({ img: document.querySelectorAll('.kit-chain img').length, ran: window.__xss2 === 1 }));
  log('xss chain op: ' + JSON.stringify(x2));
  expect(x2.img === 0 && !x2.ran, 'D 가져온 chain.op가 이스케이프 없이 식 영역에 삽입되지 않음 (img=' + x2.img + ', ran=' + x2.ran + ')');
  await shot('xss-chain');

  // ---- AC13 활동지 ----
  await act('setTab', 'sheet');
  await ev(() => { FK.app.state.worksheet.items = []; FK.app.state.worksheet.withAnswers = true; FK.sheet.render(); });
  for (const id of ['c3-01', 'c3-02', 'c3-03', 'c4-01', 'c5-05', 'c5-08']) await act('sheetAddCard', id);
  const pr = await ev(() => ({ pages: document.querySelectorAll('#print-root section.a4').length, items: document.querySelectorAll('#print-root .ws-item').length, ans: document.querySelectorAll('#print-root .a4.answers li').length, printDisp: getComputedStyle(document.querySelector('#print-root')).display }));
  expect(pr.pages === 2 && pr.items === 6 && pr.ans === 6, 'AC13 6문항 → 문항 1쪽 + 정답지 1쪽: ' + JSON.stringify(pr));
  const order = () => ev(() => FK.app.state.worksheet.items.map(i => i.sourceId).join(','));
  const o0 = await order(); let changed = false;
  for (let i = 0; i < 4; i++) { await act('sheetShuffle'); if (await order() !== o0) changed = true; }
  expect(changed, 'AC13 순서 섞기로 순서 변경');
  await page.emulateMedia({ media: 'print' });
  const pm = await ev(() => ({ shell: getComputedStyle(document.querySelector('.app-shell')).display, root: getComputedStyle(document.querySelector('#print-root')).display }));
  await page.emulateMedia({ media: 'screen' });
  expect(pm.shell === 'none' && pm.root === 'block', 'AC13 인쇄 미디어에서 앱 UI 숨김/활동지만 표시: ' + JSON.stringify(pm));
  await shot('sheet');

  // ---- AC14 칠판·펜·커튼 ----
  await act('setTab', 'kit'); await act('setBoard', true); await sleep(100);
  const bd = await ev(() => ({ attr: document.documentElement.dataset.board, fs: getComputedStyle(document.documentElement).fontSize, btn: document.querySelector('.tb').getBoundingClientRect().height, bg: getComputedStyle(document.body).backgroundColor }));
  expect(bd.attr === 'on' && bd.fs === '24px' && bd.btn >= 56 && bd.bg === 'rgb(255, 255, 255)', 'AC14 칠판 모드 24px/56px/흰 배경: ' + JSON.stringify(bd));
  // 결함 재현: 다크 테마 + 칠판 모드 → 고대비 팔레트 미적용
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(100);
  const bdDark = await ev(() => ({ bg: getComputedStyle(document.body).backgroundColor, fg: getComputedStyle(document.body).color, fillA: getComputedStyle(document.documentElement).getPropertyValue('--fill-a').trim() }));
  log('board+dark: ' + JSON.stringify(bdDark));
  expect(bdDark.bg === 'rgb(255, 255, 255)', 'D 다크 모드에서도 칠판 모드 흰 배경 적용 (실제 ' + bdDark.bg + ', --fill-a ' + bdDark.fillA + ')');
  await shot('board-dark');
  await page.emulateMedia({ colorScheme: 'light' }); await act('setBoard', false);
  await act('setPen', true); await sleep(100);
  const bb = await page.locator('.kit-bar').boundingBox();
  await page.mouse.move(bb.x + 20, bb.y + 20); await page.mouse.down(); await page.mouse.move(bb.x + 200, bb.y + 40, { steps: 8 }); await page.mouse.up();
  let strokes = await ev(() => FK.app.tr.pen.strokes.length);
  expect(strokes === 1, '펜 스트로크 1개 기록');
  const penColor = await ev(() => { const c = document.querySelector('#pen-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) return [d[i], d[i + 1], d[i + 2]]; return null; });
  expect(penColor && penColor[0] > 200 && penColor[1] < 100, 'AC14 빨간 선 그려짐 ' + JSON.stringify(penColor));
  await page.click('[data-pen="clear"]'); strokes = await ev(() => FK.app.tr.pen.strokes.length);
  expect(strokes === 0, 'AC14 모두 지우기');
  await page.click('[data-pen="off"]'); await sleep(50);
  const nb = (await st()).kit.n; await page.click('.kit-bar .cell[data-i="0"]'); s = await st();
  expect(s.kit.n !== nb && !s.pen, 'AC14 펜 끄기 후 칸 클릭 동작');
  await act('setCurtain', true);
  const cur = await ev(() => ({ attr: document.documentElement.dataset.curtain, after: getComputedStyle(document.querySelector('.kit-symbol'), '::after').content }));
  expect(cur.attr === 'on' && cur.after.includes('커튼'), 'AC14 커튼 오버레이: ' + JSON.stringify(cur));
  await act('setCurtain', false);

  // ---- 결함 재현: 어림 모드 중 ×2 → 목표 분모 불일치 ----
  await act('kitSetD', 4); await act('kitSetN', 1);
  await ev(() => { FK.app.tr.estimate = { target: { n: 3, d: 4 }, tapped: null, revealed: false }; FK.app.renderTab(); });
  await act('kitSplit', 2); await sleep(450);
  const est = await ev(() => ({ d: FK.app.state.kit.d, target: FK.app.tr.estimate && FK.app.tr.estimate.target, txt: document.querySelector('.est-target') && document.querySelector('.est-target').textContent }));
  log('estimate after split: ' + JSON.stringify(est));
  const lb = await page.locator('.kit-line').boundingBox();
  await page.mouse.click(lb.x + lb.width * (36 + 928 * 0.75) / 1000, lb.y + lb.height * 44 / 96); await sleep(600);
  const estMsg = await text('.est-msg');
  log('estimate msg after tapping at 3/4: ' + estMsg);
  expect(estMsg.includes('정확해요'), 'D 어림 목표 3/4 자리를 정확히 눌렀을 때 "정확해요" (실제: ' + estMsg + ')');
  await act('setTab', 'compare'); await act('setTab', 'kit'); await ev(() => { FK.app.tr.estimate = null; FK.app.renderTab(); });

  // ---- 결함 재현: 키패드에서 취소 버튼에 포커스 두고 Enter ----
  await act('setTab', 'compare'); await act('compareSet', 'a', 2, 3);
  await page.click('[data-action="compare-keypad"][data-who="a"]'); await sleep(150);
  await page.keyboard.press('1'); // 분자 2 → 1
  await page.focus('.modal.kp .modal-foot .btn:not(.primary)');
  await page.keyboard.press('Enter'); await sleep(150);
  s = await st();
  log('keypad Enter on cancel → a=' + JSON.stringify(s.compare.a));
  expect(s.compare.a.n === 2 && s.compare.a.d === 3, 'D 키패드 취소 버튼에서 Enter → 취소되어야 함 (실제 A=' + s.compare.a.n + '/' + s.compare.a.d + ')');
  await ev(() => { const x = document.querySelector('.modal-x'); if (x) x.click(); });

  // ---- AC17 되돌리기 ----
  await act('setTab', 'kit'); await act('kitSetD', 4); await act('kitSetN', 1);
  const u0 = (await st()).undo.past;
  await page.click('.kit-bar .cell[data-i="2"]'); // 3/4
  await act('kitSplit', 2); await sleep(450); // 6/8
  await act('kitSetD', 10); // 6/10
  const seq = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Control+z'); s = await st(); seq.push(s.kit.n + '/' + s.kit.d); }
  expect(seq.join(' ') === '6/8 3/4 1/4', 'AC17 Ctrl+Z 3회 역순 복원: ' + seq.join(' '));
  s = await st(); const undoBtn = await ev(() => ({ u: document.querySelector('#btn-undo').disabled, r: document.querySelector('#btn-redo').disabled }));
  expect(s.undo.past === u0 && undoBtn.u === (u0 === 0) && !undoBtn.r, 'AC17 스택 끝 버튼 상태 ' + JSON.stringify(undoBtn));
  await page.click('#btn-redo'); s = await st(); expect(s.kit.n === 3 && s.kit.d === 4, 'AC17 다시하기 → 3/4');

  // ---- 학년 프리셋 ----
  await act('setGrade', 3); await sleep(100);
  const g3 = await ev(() => ({ hidden: document.querySelector('.tabs [data-tab=arith]').hidden, max: document.querySelector('#kit-d').max }));
  expect(g3.hidden && g3.max === '10', '학년 3 프리셋: 덧셈 탭 숨김, 슬라이더 상한 10');
  await act('kitSetD', 6); await act('kitSplit', 2); s = await st();
  log('grade3 split 6×2 → d=' + s.kit.d);
  expect(s.kit.d <= 10, 'D 학년 3 프리셋에서 ×2로 상한(10) 초과 불가 (실제 d=' + s.kit.d + ')');
  await act('setGrade', null);

  // ---- AC15 400px ----
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  const m = await ev(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, tabs: getComputedStyle(document.querySelector('.model-tabs')).display, ctrlPos: getComputedStyle(document.querySelector('#kit-ctrl')).position, visibleModels: [...document.querySelectorAll('.view-kit .model')].filter(e => getComputedStyle(e).display !== 'none').length }));
  expect(m.sw <= m.cw && m.tabs === 'flex' && m.ctrlPos === 'fixed' && m.visibleModels === 1, 'AC15 400px: 가로 스크롤 없음, 모델 탭, 하단 시트: ' + JSON.stringify(m));
  await shot('mobile-400');
  await page.setViewportSize({ width: 1000, height: 800 }); await act('setTab', 'sheet'); await sleep(200);
  const sp = await ev(() => { const w = document.querySelector('.sheet-preview-wrap').getBoundingClientRect(), a = document.querySelector('.a4').getBoundingClientRect(); return { wrap: Math.round(w.width), a4: Math.round(a.width), clipped: a.right > w.right + 1 }; });
  log('sheet preview @1000px: ' + JSON.stringify(sp));
  expect(!sp.clipped, 'D 1000px 폭에서 A4 미리보기가 잘리지 않음 ' + JSON.stringify(sp));
  await shot('sheet-1000');
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---- AC16 localStorage 실패 ----
  await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new Error('quota'); }; });
  await reload();
  const banner = await ev(() => document.querySelector('#save-banner').hidden);
  const before = (await st()).counts.scenes;
  await act('saveScene', { name: '메모리 장면', grade: null, unit: '', memo: '' });
  s = await st();
  expect(!banner && s.counts.scenes === before + 1 && errs.length === 0, 'AC16 저장 실패 배너 + 세션 내 저장 동작');
  log('final page errors: ' + JSON.stringify(errs));
};
