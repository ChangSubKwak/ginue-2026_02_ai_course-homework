// reverify-r1.js — 1라운드 수정 독립 재검증(critical·major 결함별 재현 + 회귀 탐지). 기존 테스트와 다른 입력·경로를 사용한다.
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
  const rect = sel => ev(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; }, sel);
  const glyphH = sel => ev(s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().height : 0; }, sel);
  const hscroll = () => ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const errCount = () => errs.length;

  // ===== C-01 가져온 id XSS (다른 벡터: svg onload, 카드·세트·활동지 출처 목록까지) =====
  const evil = JSON.stringify({ app: 'fraction-kit', schema: 1,
    scenes: [{ id: 'sc-z"><svg onload="window.__rx1=1"><b', name: 'rv-scene', state: { tab: 'kit', kit: { n: 1, d: 2, chain: [{ n: 1, d: 2, op: 'start' }] } } }],
    cards: [{ id: 'cd-z"><svg onload="window.__rx2=1"><b', grade: 3, unit: 'u', type: 'make', question: 'rv-card', choices: ['1/2', '1/3'], answer: 0, setup: { a: { n: 1, d: 2 }, b: null, op: null, model: 'bar', lineRange: 1 } }],
    cardSets: [{ id: 'cs-z"><svg onload="window.__rx3=1"><b', name: 'rv-set', cardIds: ['cd-z"><svg onload="window.__rx2=1"><b'] }] });
  const ir = await ev(t => window.__app.actions.importJson(t), evil); await sleep(200);
  log('import evil: ' + JSON.stringify(ir));
  const ids = await ev(() => { const db = window.__app.actions.getDb(); return { sc: db.scenes.filter(s => s.name === 'rv-scene').map(s => s.id), cd: db.cards.filter(c => c.question === 'rv-card').map(c => c.id), cs: db.cardSets.filter(s => s.name === 'rv-set').map(s => ({ id: s.id, cardIds: s.cardIds })) }; });
  log('ids after import: ' + JSON.stringify(ids));
  const safe = /^[A-Za-z0-9_-]{1,40}$/;
  expect(ids.sc.length === 1 && safe.test(ids.sc[0]) && ids.cd.length === 1 && safe.test(ids.cd[0]) && ids.cs.length === 1 && safe.test(ids.cs[0].id), 'C-01 가져온 위험 id가 안전한 새 id로 교체됨');
  expect(ids.cs.length === 1 && ids.cs[0].cardIds.length === 1 && ids.cs[0].cardIds[0] === ids.cd[0], 'C-01 세트의 cardIds가 교체된 카드 id로 치환됨(' + JSON.stringify(ids.cs) + ')');
  for (const tab of ['scenes', 'cards', 'sheet']) { await act('setTab', tab); await sleep(150); }
  await act('setTab', 'cards'); await ev(() => { const s = document.querySelector('#card-set'); s.value = [...s.options].find(o => o.textContent.includes('rv-set')).value; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(150);
  const xs = await ev(() => ({ svg: document.querySelectorAll('#scene-grid svg[onload], #card-list svg, #card-set svg, #sheet-cards svg, #sheet-scenes svg').length, r1: !!window.__rx1, r2: !!window.__rx2, r3: !!window.__rx3 }));
  expect(!xs.r1 && !xs.r2 && !xs.r3 && xs.svg === 0, 'C-01 보관함·카드·세트·활동지 출처에서 스크립트 실행 없음 ' + JSON.stringify(xs));
  expect(await count('#card-list .card-item') === 1 && (await text('#card-list')).includes('rv-card'), 'C-01 세트 선택 시 교체된 id로 카드 1장 표시');
  expect(errCount() === 0, 'C-01 페이지 예외 0 (' + errs.join('|') + ')');

  // ===== C-02 chain op 검증 (허용 목록 밖은 사슬 초기화, 허용값은 유지) =====
  const chainFile = JSON.stringify({ app: 'fraction-kit', schema: 1, scenes: [
    { id: 'sc-rvbad', name: 'rv-badop', state: { tab: 'kit', kit: { n: 4, d: 8, chain: [{ n: 1, d: 2, op: 'start' }, { n: 2, d: 4, op: '×2' }, { n: 4, d: 8, op: '<b onmouseover=1>x</b>' }] } } },
    { id: 'sc-rvok', name: 'rv-okop', state: { tab: 'kit', kit: { n: 6, d: 12, chain: [{ n: 1, d: 2, op: 'start' }, { n: 2, d: 4, op: '×2' }, { n: 6, d: 12, op: '×3' }] } } },
    { id: 'sc-rvbig', name: 'rv-bigop', state: { tab: 'kit', kit: { n: 2, d: 4, chain: [{ n: 1, d: 2, op: 'start' }, { n: 2, d: 4, op: '×999' }] } } }] });
  await ev(t => window.__app.actions.importJson(t), chainFile); await sleep(100);
  await act('loadScene', 'sc-rvbad'); await sleep(150);
  let s = await st(); let ch = await text('.view-kit .kit-chain');
  expect(s.kit.chain.length === 1 && s.kit.chain[0].op === 'start' && (await count('.view-kit .kit-chain b')) === 0, 'C-02 허용되지 않는 op → 사슬 초기화, 태그 없음: ' + ch.replace(/\s+/g, ' '));
  await act('loadScene', 'sc-rvok'); await sleep(150); s = await st(); ch = await text('.view-kit .kit-chain');
  expect(s.kit.chain.length === 3 && ch.includes('×2') && ch.includes('×3') && ch.includes('6/12'), 'C-02 정상 사슬은 유지(1/2 ×2 2/4 ×3 6/12): ' + ch.replace(/\s+/g, ' '));
  await act('loadScene', 'sc-rvbig'); await sleep(150); s = await st();
  expect(s.kit.chain.length === 1, 'C-02 ×999(형식 밖) → 사슬 초기화');
  expect(await count('.view-kit .kit-chain .fline') === 1, 'U-02 사슬이 .fline(가로 한 줄) 안에 렌더됨');

  // ===== U-02 사슬 가로 배치·라벨 크기 =====
  await act('kitSetD', 2); await act('kitSetN', 1); await act('kitSplit', 2); await sleep(450); await act('kitSplit', 3); await sleep(450);
  const chainGeo = await ev(() => { const t = [...document.querySelectorAll('.view-kit .kit-chain .term')].map(e => e.getBoundingClientRect()); const lbl = document.querySelector('.view-kit .kit-chain .eq-label'); return { tops: t.map(r => Math.round(r.top)), lblFont: lbl ? parseFloat(getComputedStyle(lbl).fontSize) : 0, lblTxt: lbl ? lbl.textContent : '' }; });
  log('chain geometry: ' + JSON.stringify(chainGeo));
  expect(chainGeo.tops.length === 3 && Math.max(...chainGeo.tops) - Math.min(...chainGeo.tops) < 4, 'U-02 사슬 3항이 같은 줄에 가로 배치 ' + JSON.stringify(chainGeo.tops));
  expect(chainGeo.lblFont >= 15 && chainGeo.lblTxt === '×2', 'U-02 ×2 라벨 글자 ' + chainGeo.lblFont + 'px (≥15)');
  // U-03 소수 표기
  const dec = await ev(() => [[6, 12], [3, 6], [2, 6], [9, 12], [3, 8], [7, 4], [0, 5], [10, 4], [5, 1]].map(([n, d]) => window.FK.frac.toDecimal(n, d)));
  expect(JSON.stringify(dec) === JSON.stringify(['0.5', '0.5', '≈0.333', '0.75', '0.375', '1.75', '0', '2.5', '5']), 'U-03 toDecimal 약분 후 판정: ' + JSON.stringify(dec));
  const symDec = await text('.view-kit .kit-symbol'); expect(symDec.includes('0.5') && !symDec.includes('≈'), 'U-03 기호 패널 6/12 → 소수 0.5 (≈ 없음)');

  // ===== U-01 / F-08 데스크톱 1280 막대·라벨 크기 =====
  await act('kitSetD', 8); await act('kitSetN', 3); await sleep(100);
  const kitGeo = await ev(() => { const bar = document.querySelector('.kit-bar'), lbl = document.querySelector('.kit-bar .cell-label'), tick = document.querySelector('.kit-line .tick-label:not(.int)'), circ = document.querySelector('.kit-circle'); const r = e => e ? e.getBoundingClientRect() : { width: 0, height: 0 }; return { bar: [Math.round(r(bar).width), Math.round(r(bar).height)], lblH: Math.round(r(lbl).height), tickH: Math.round(r(tick).height), circ: [Math.round(r(circ).width), Math.round(r(circ).height)] }; });
  log('kit geometry 1280: ' + JSON.stringify(kitGeo));
  expect(kitGeo.bar[0] >= 480 && kitGeo.bar[1] >= 55, 'U-01 1280px 막대 크기 ' + kitGeo.bar.join('×') + ' (≥480×55)');
  expect(kitGeo.lblH >= 14 && kitGeo.tickH >= 11, 'U-01 칸 번호 ' + kitGeo.lblH + 'px / 눈금 라벨 ' + kitGeo.tickH + 'px 판독 가능');
  await shot('rv-kit-1280');
  // F-07 모델 토글: 원만 켜면 원이 전체 폭, 막대 끄기 → data-shown 갱신
  await page.uncheck('[data-model-toggle=bar]'); await page.uncheck('[data-model-toggle=line]'); await sleep(100);
  const shown = await ev(() => ({ shown: document.querySelector('.view-kit .models').dataset.shown, visible: [...document.querySelectorAll('.view-kit .model')].filter(e => !e.hidden && e.offsetParent).map(e => e.dataset.model) }));
  expect(shown.shown === 'circle' && shown.visible.join() === 'circle', 'F-07 막대·수직선 끄면 data-shown=circle, 원만 표시 ' + JSON.stringify(shown));
  await page.uncheck('[data-model-toggle=circle]'); await sleep(50);
  expect((await st()).kit.models.circle === true || (await st()).kit.models.bar === true, '모델 전부 끄기 차단(하나는 켜짐) ' + JSON.stringify((await st()).kit.models) + ' toasts=' + JSON.stringify(await toasts()));
  await page.check('[data-model-toggle=bar]'); await page.check('[data-model-toggle=line]'); await sleep(50);

  // ===== C-13 / C-08 분모 ± 경계·학년 상한 =====
  await act('kitSetD', 1);
  expect(await ev(() => document.querySelector('[data-action=kit-d][data-delta="-1"]').disabled), 'C-13 d=1에서 − 비활성');
  await act('setGrade', 3); await act('kitSetD', 6); await sleep(50);
  const g3 = await ev(() => ({ x2: document.querySelector('#btn-x2').disabled, x2t: document.querySelector('#btn-x2').title, x3: document.querySelector('#btn-x3').disabled, max: document.querySelector('#kit-d').max }));
  expect(g3.x2 && g3.x3 && g3.x2t.includes('10') && g3.max === '10', 'C-08 3학년 프리셋 d=6에서 ×2/×3 비활성·툴팁 10: ' + JSON.stringify(g3));
  await act('kitSplit', 2); s = await st(); expect(s.kit.d === 6, 'C-08 kitSplit 액션 직접 호출도 상한(10) 차단: d=' + s.kit.d);
  await act('kitSetD', 10); expect(await ev(() => document.querySelector('[data-action=kit-d][data-delta="1"]').disabled), 'C-13 학년 상한(10)에서 + 비활성');
  await act('setGrade', null); await sleep(50);

  // ===== C-06 어림 모드 중 ×2·합치기 =====
  await act('kitSetD', 4); await act('kitSetN', 1);
  await ev(() => { window.FK.app.tr.estimate = { target: { n: 3, d: 4 }, tapped: null, revealed: false }; window.FK.app.renderTab(); });
  await act('kitSplit', 2); await sleep(450);
  const tapAt = async v => { const r = await rect('.view-kit .kit-line'); const vb = await ev(() => { const svg = document.querySelector('.view-kit .kit-line'); const [, , w] = svg.getAttribute('viewBox').split(/\s+/).map(Number); return w; }); const Un = await ev(() => window.FK.app.Kit.units(window.FK.app.state.kit)); const x = r.left + (36 + (vb - 72) * v / Un) * (r.w / vb); const y = r.top + r.h * 0.46; await page.mouse.click(x, y); };
  await tapAt(0.75); await sleep(450);
  let estMsg = await text('.view-kit .est-msg'); let estTarget = await text('.view-kit .est-target');
  expect(estMsg.includes('정확해요'), 'C-06 ×2 뒤(d=8) 목표 3/4 자리 탭 → 정확해요 (실제: ' + estMsg + ' / ' + estTarget.replace(/\s+/g, ' ') + ')');
  expect(!/\d\/\d/.test(estTarget.replace(/\s/g, '')) || true, 'U-22 (정보) 목표 표기: ' + estTarget.replace(/\s+/g, ' '));
  await ev(() => { window.FK.app.tr.estimate = { target: { n: 3, d: 8 }, tapped: null, revealed: false }; window.FK.app.renderTab(); });
  await act('kitSetN', 4); await act('kitMerge'); await sleep(450); // 4/8 → 2/4 (d=4), 목표 3/8 유지
  await tapAt(0.5); await sleep(450); estMsg = await text('.view-kit .est-msg');
  expect(estMsg.includes('왼쪽으로 1칸'), 'C-06 합치기 뒤(d=4) 목표 3/8, 0.5 탭 → 왼쪽으로 1칸 (실제: ' + estMsg + ')');
  await ev(() => { window.FK.app.tr.estimate = null; window.FK.app.renderTab(); });

  // ===== F-02 비교→연산 이어 붙이기 =====
  await act('setTab', 'arith'); await act('arithSet', 'a', 5, 6); await act('arithSet', 'b', 1, 6);
  await act('setTab', 'compare'); await act('setTab', 'arith'); s = await st();
  expect(s.arith.a.n === 5 && s.arith.a.d === 6 && s.arith.b.n === 1, 'F-02(a) 비교 탭 경유만으로는 연산 입력(5/6,1/6) 유지: ' + JSON.stringify([s.arith.a, s.arith.b]));
  await act('setTab', 'compare'); await act('compareSet', 'a', 3, 4); await act('compareSet', 'b', 1, 6); await act('setTab', 'arith'); s = await st();
  expect(s.arith.a.n === 3 && s.arith.a.d === 4 && s.arith.b.d === 6 && s.arith.b.n === 1, 'F-02(b) 비교에서 바꾼 3/4,1/6은 연산 탭으로 1회 이어짐');
  expect(s.undo.past >= 1, 'F-02(b) 이어 붙이기가 undo 스택에 기록됨 past=' + s.undo.past);
  await act('undo'); s = await st(); expect(s.arith.a.n === 5 && s.arith.a.d === 6, 'F-02(b) Ctrl+Z로 이어 붙이기 되돌림 → 5/6');
  await act('redo'); await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 1, 4);
  await act('setTab', 'compare'); await act('setTab', 'arith'); s = await st();
  expect(s.arith.a.n === 1 && s.arith.a.d === 2 && s.arith.b.d === 4, 'F-02(c) 비교 탭 재방문(변경 없음) → 다시 덮어쓰지 않음');
  await act('setTab', 'compare'); await act('compareSet', 'b', 5, 6); await act('setTab', 'kit'); await act('setTab', 'arith'); s = await st();
  log('F-02(d) compare→kit→arith: ' + JSON.stringify([s.arith.a, s.arith.b]));
  await act('setTab', 'compare'); await act('compareSet', 'a', 2, 3); await act('setTab', 'scenes'); await act('loadScene', 'sc-b05'); await sleep(150); s = await st();
  expect(s.tab === 'arith' && s.arith.a.n === 2 && s.arith.a.d === 5 && s.arith.b.n === 2, 'F-02(e) 비교 변경 후 덧셈 장면 불러오기 → 장면 값 2/5+2/5 유지');
  await act('setTab', 'compare'); await act('setTab', 'arith'); s = await st();
  expect(s.arith.a.n === 2 && s.arith.a.d === 5, 'F-02(e) 불러온 장면이 비교 탭 경유 후에도 유지');
  // C-18 메모 패널은 장면 탭과 같은 탭에서만
  expect(await ev(() => !document.querySelector('#memo-panel').hidden), 'C-18 덧셈 장면 불러온 뒤 연산 탭에 메모 표시');
  await act('setTab', 'kit'); expect(await ev(() => document.querySelector('#memo-panel').hidden), 'C-18 교구판 탭에서는 덧셈 장면 메모 숨김');
  await act('setTab', 'arith');

  // ===== C-03 결과 막대·오개념 막대 클릭 =====
  await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 1, 3); await act('arithOp', '+');
  const before3 = errCount();
  await page.locator('.ar-bars [data-who="r"] .cell').first().click({ force: true }); await sleep(50);
  await page.locator('.ar-bars [data-who="r"] .bar-frame').first().click({ force: true }); await sleep(50);
  for (let i = 0; i < 3; i++) await act('arithNext'); await sleep(900);
  await act('arithMirror'); await sleep(100);
  const mirrorCells = await count('.ar-bars .cell.f-w');
  if (mirrorCells) await page.locator('.ar-bars .cell.f-w').first().click({ force: true });
  await page.locator('.ar-bars [data-who="r"] .cell').first().click({ force: true }); await sleep(50);
  expect(errCount() === before3, 'C-03 결과·오개념 막대 클릭 시 예외 없음 (' + errs.slice(before3).join('|') + ')');
  s = await st(); expect(s.arith.step === 3 && s.arith.a.n === 1 && s.arith.b.n === 1, 'C-03 결과 막대 클릭이 상태를 바꾸지 않음');
  const mirrorLbl = await text('main [data-view="arith"]');
  expect(mirrorLbl.includes('2/5') && mirrorLbl.includes('13/30'), 'AC8 오개념 거울 라벨 2/5 · 13/30: ' + mirrorLbl.replace(/\s+/g, ' ').slice(0, 160));

  // ===== C-05 애니메이션 중 되돌리기/장면 불러오기 =====
  await act('arithOp', '-'); await act('arithSet', 'a', 5, 6); await act('arithSet', 'b', 2, 6);
  await act('arithNext'); await sleep(100); // 같은 분모 → 통분 생략
  s = await st(); log('C-05 step after first next: ' + s.arith.step);
  if (s.arith.step < 2) await act('arithNext');
  await sleep(40); await act('undo'); await sleep(1700);
  s = await st();
  const dom5 = await ev(() => ({ active: [...document.querySelectorAll('.ar-steps li')].findIndex(li => li.classList.contains('active')) + 1, resOn: document.querySelectorAll('.ar-bars [data-who="r"] .cell.on').length, moving: document.querySelectorAll('.ar-bars .moving').length }));
  log('C-05 undo during move: state.step=' + s.arith.step + ' dom=' + JSON.stringify(dom5));
  expect(dom5.active === s.arith.step && dom5.resOn === (s.arith.step >= 2 ? 3 : 0) && dom5.moving === 0, 'C-05 뺄셈 이동 중 되돌리기 → 1.7초 후 DOM이 상태와 일치');
  await act('redo'); await act('arithNext'); await sleep(40); // 다시 이동 애니메이션 중
  await act('loadScene', 'sc-b10'); await sleep(1700); s = await st();
  const dom5b = await ev(() => ({ active: [...document.querySelectorAll('.ar-steps li')].findIndex(li => li.classList.contains('active')) + 1, resOn: document.querySelectorAll('.ar-bars [data-who="r"] .cell.on').length, aOn: document.querySelectorAll('.ar-bars [data-who="a"] .cell.on').length }));
  expect(s.arith.step === 0 && dom5b.active === 0 && dom5b.resOn === 0 && dom5b.aOn === 1, 'C-05 이동 중 장면 불러오기(1/2+1/3) → 옛 콜백이 덮어쓰지 않음 ' + JSON.stringify(dom5b));
  // C-19 3단위 초과
  await act('arithOp', '+'); await act('arithSet', 'a', 6, 2); await act('arithSet', 'b', 6, 2); await act('arithNext'); await act('arithNext'); await sleep(100);
  expect((await toasts()).some(t => t.includes('3까지만')), 'C-19 결과 6 → 안내 토스트');
  expect(await count('.ar-bars .moving') === 0, 'C-19 이동 애니메이션 생략');

  // ===== F-01 학급 집계 키보드 입력 =====
  await act('setTab', 'cards'); await ev(() => { const s = document.querySelector('#card-set'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }); await act('selectCard', 'c5-05'); await sleep(150);
  const tin = i => page.locator(`#tally-panel input[data-tally="${i}"]`);
  await tin(0).click({ clickCount: 3 }); await page.keyboard.type('12'); await sleep(80);
  await tin(1).click({ clickCount: 3 }); await page.keyboard.type('7'); await sleep(80);
  await tin(2).click({ clickCount: 3 }); await page.keyboard.type('1'); await page.keyboard.type('1'); await sleep(120);
  const typed = await ev(() => [...document.querySelectorAll('#tally-panel input[data-tally]')].map(i => i.value));
  const bars = await ev(() => [...document.querySelectorAll('.tally-fill')].map(e => e.style.width));
  const lbls = await ev(() => [...document.querySelectorAll('.tally-label')].map(e => e.textContent));
  expect(typed.join() === '12,7,11', 'F-01 키보드 타이핑 12·7·11 그대로 입력됨: ' + typed.join());
  expect(bars[0] === '40%' && lbls[0].startsWith('12명') && (await text('.tally-total')).includes('합계 30명'), 'F-01 입력 중 막대·라벨·합계 즉시 갱신: ' + JSON.stringify({ bars, lbls }));
  expect(await ev(() => document.activeElement && document.activeElement.dataset.tally === '2'), 'F-01 입력 중 포커스 유지');
  await tin(2).press('Backspace'); await tin(2).press('Backspace'); await sleep(80);
  { const v2 = await tin(2).inputValue(), c2 = await ev(() => window.__app.actions.getDb().tally['c5-05'].counts[2]); expect((v2 === '' || v2 === '0') && c2 === 0, 'F-01 Backspace로 지우면 저장값 0 (입력란 ' + JSON.stringify(v2) + ', 저장 ' + c2 + ')'); await tin(2).click({ clickCount: 3 }); await page.keyboard.press('Backspace'); await page.keyboard.type('15'); await sleep(80); const v3 = await tin(2).inputValue(); expect(v3 === '15', 'F-01 전체 선택→Backspace→15 타이핑 = 15 (실제 ' + v3 + ')'); }
  await tin(2).type('150'); await sleep(80); expect((await tin(2).inputValue()) === '99', 'F-01 범위 초과(150) 즉시 99로 보정');
  await reload(); await act('setTab', 'cards'); await act('selectCard', 'c5-05'); await sleep(150);
  expect((await ev(() => [...document.querySelectorAll('#tally-panel input[data-tally]')].map(i => i.value))).join() === '12,7,99', 'F-01 새로고침 후 집계 복원 12,7,99');
  await act('predict', 0); await act('confirmCard'); await sleep(1800);
  expect(await count('.tally-row.correct') === 1, '확인 후 정답 막대 강조');
  expect(errCount() === 0, '카드 탭 예외 0');

  // ===== U-08 카드 목록 레이아웃(교사 모드) =====
  const cardItem = await ev(() => { const li = document.querySelector('#card-list .card-item'); const q = li.querySelector('.card-q'); const ops = li.querySelector('.card-ops'); const pr = li.querySelector('.card-pick').getBoundingClientRect(); return { pickW: Math.round(pr.width), qLines: Math.round(q.getBoundingClientRect().height / parseFloat(getComputedStyle(q).lineHeight || 20)), opsBelow: ops.getBoundingClientRect().top >= pr.bottom - 2, liH: Math.round(li.getBoundingClientRect().height) }; });
  log('U-08 card item: ' + JSON.stringify(cardItem));
  expect(cardItem.pickW >= 260 && cardItem.opsBelow, 'U-08 질문 영역 ' + cardItem.pickW + 'px, 아이콘 버튼은 아래 줄');
  await shot('rv-cards-1280');

  // ===== U-04 장면 메모 첫 줄 =====
  await act('setTab', 'scenes'); await sleep(150);
  const memos = await ev(() => [...document.querySelectorAll('#scene-grid .scene-card')].map(c => ({ name: c.querySelector('.scene-name, h3, .scene-title') ? c.querySelector('.scene-name, h3, .scene-title').textContent.trim() : '', memo: (c.querySelector('.scene-memo') || {}).textContent || '' })));
  log('memos: ' + JSON.stringify(memos.map(m => m.memo.slice(0, 40))));
  const badMemo = memos.filter(m => !m.name.startsWith('rv-')).filter(m => /^\s*\d+\s*$/.test(m.memo) || m.memo.trim().length < 6);
  expect(badMemo.length === 0, 'U-04 장면 메모 미리보기가 숫자 한 글자로 잘리지 않음 ' + JSON.stringify(badMemo));
  expect(memos.some(m => m.memo.startsWith('7/4는 1보다 클까?')) && memos.some(m => m.memo.startsWith('합치기를 두 번 누르면? 한 번에 2/3로')), 'U-04 7/4·2/3 포함 메모가 분수 슬래시에서 잘리지 않음');
  // F-04 내장 사본 가져오기
  const dupe = await ev(() => { const d = window.__app.actions.getDb(); const sc = JSON.parse(JSON.stringify(d.scenes.find(x => x.id === 'sc-b02'))); sc.name = 'rv-changed-builtin'; return window.__app.actions.importJson(JSON.stringify({ app: 'fraction-kit', schema: 1, scenes: [sc] })); });
  const dupeRec = await ev(() => window.__app.actions.getDb().scenes.find(x => x.name === 'rv-changed-builtin'));
  expect(dupeRec && dupeRec.id !== 'sc-b02' && dupeRec.builtin === false, 'F-04 내장 장면 변경 사본은 새 id + builtin=false ' + JSON.stringify({ id: dupeRec && dupeRec.id, b: dupeRec && dupeRec.builtin }));
  await shot('rv-scenes-1280');

  // ===== U-09 활동지 막대 크기, F-11 빈 인쇄 =====
  await act('setTab', 'sheet'); await sleep(200);
  await ev(() => { const m = document.querySelector('#ws-model'); m.value = 'bar'; m.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(150);
  // A4(210mm) 용지 폭 대비 비율로 mm 환산(zoom·뷰포트와 무관)
  const wsGeo = await ev(() => { const a4 = document.querySelector('#sheet-preview .a4').getBoundingClientRect(); const k = 210 / a4.width; const items = [...document.querySelectorAll('#sheet-preview .ws-item')].map(it => { const svg = it.querySelector('.ws-fig svg'); const r = svg.getBoundingClientRect(); return { t: it.querySelector('.ws-prompt').textContent.trim().slice(0, 14), w: +(r.width * k).toFixed(1), h: +(r.height * k).toFixed(1) }; }); const pg = document.querySelector('#sheet-preview .a4'); const grid = pg.querySelector('.ws-grid').getBoundingClientRect(); return { a4w: Math.round(a4.width), items, page1FillPct: Math.round((grid.bottom - a4.top) / a4.height * 100) }; });
  log('U-09 worksheet figures(mm, A4 기준): ' + JSON.stringify(wsGeo));
  const colorBars = wsGeo.items.filter(i => i.t.includes('만큼 색칠') && i.w > i.h * 2); // 원(1/4) 문항 제외
  expect(colorBars.length >= 3 && colorBars.every(i => i.h >= 10 && i.w >= 60), 'U-09 색칠하기 막대 A4 환산 ' + colorBars.map(i => i.w + '×' + i.h).join(', ') + 'mm (≥60×10)');
  log('U-09 1쪽 문항 영역이 차지하는 비율: ' + wsGeo.page1FillPct + '%');
  await page.click('[data-action=sheet-clear]'); await sleep(100);
  const modal = await count('#modal-root [role=dialog]'); if (modal) { await page.click('#modal-root [role=dialog] button:has-text("지우기")'); await sleep(100); }
  const pr = await ev(() => { window.dispatchEvent(new Event('beforeprint')); return document.querySelector('#print-root').textContent.trim(); });
  expect(pr.includes('문항이 없어요'), 'F-11 문항 0개 인쇄 루트에 안내 문구: ' + pr.slice(0, 60));
  expect(await ev(() => document.querySelector('#btn-print').disabled), '문항 0개 → 인쇄 버튼 비활성');
  await ev(() => ['c3-01', 'c3-03', 'c4-01', 'c5-02', 'c5-05', 'c5-08'].forEach(id => window.__app.actions.sheetAddCard(id))); await page.check('#ws-answers'); await sleep(150);
  await page.emulateMedia({ media: 'print' }); await sleep(200);
  const printInfo = await ev(() => { window.dispatchEvent(new Event('beforeprint')); const pages = document.querySelectorAll('#print-root .a4'); const items = document.querySelectorAll('#print-root .ws-item'); const shellVisible = getComputedStyle(document.querySelector('.app-shell') || document.body).display !== 'none'; return { pages: pages.length, items: items.length, shellVisible, rootVisible: getComputedStyle(document.querySelector('#print-root')).display !== 'none' }; });
  log('print: ' + JSON.stringify(printInfo));
  expect(printInfo.items === 6 && printInfo.rootVisible && !printInfo.shellVisible, 'AC13 인쇄 미디어: 문항 6 · 앱 UI 숨김 · 인쇄 루트 표시 ' + JSON.stringify(printInfo));
  await shot('rv-print-media');
  await page.emulateMedia({ media: 'screen' });

  // ===== C-04 / U-05 다크 + 칠판 =====
  await act('setTab', 'kit');
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(100);
  await act('setBoard', true); await sleep(150);
  const bd = await ev(() => { const cs = getComputedStyle(document.body); const r = getComputedStyle(document.documentElement); return { bg: cs.backgroundColor, fillA: r.getPropertyValue('--fill-a').trim(), fg: cs.color, font: cs.fontSize, board: document.documentElement.dataset.board }; });
  log('dark+board: ' + JSON.stringify(bd));
  expect(bd.board === 'on' && bd.bg === 'rgb(255, 255, 255)' && parseFloat(bd.font) >= 22, 'C-04 OS 다크에서 칠판 모드 → 흰 배경·큰 글꼴 ' + JSON.stringify(bd));
  await shot('rv-board-osdark');
  await ev(() => { document.documentElement.dataset.theme = 'dark'; }); await sleep(50);
  const bd2 = await ev(() => getComputedStyle(document.body).backgroundColor);
  expect(bd2 === 'rgb(255, 255, 255)', 'C-04 수동 다크(data-theme=dark)+칠판 → 흰 배경: ' + bd2);
  await act('setBoard', false); await sleep(100);
  const bd3 = await ev(() => getComputedStyle(document.body).backgroundColor);
  expect(bd3 !== 'rgb(255, 255, 255)', 'C-04 칠판 끄면 다크 배경 복귀: ' + bd3);
  await ev(() => { delete document.documentElement.dataset.theme; }); await page.emulateMedia({ colorScheme: 'light' }); await sleep(50);

  // ===== 칠판 1920 막대 크기 =====
  await page.setViewportSize({ width: 1920, height: 1080 }); await act('setBoard', true); await sleep(200);
  const bg = await ev(() => { const r = e => e ? e.getBoundingClientRect() : { width: 0, height: 0 }; return { bar: [Math.round(r(document.querySelector('.kit-bar')).width), Math.round(r(document.querySelector('.kit-bar')).height)], lblH: Math.round(r(document.querySelector('.kit-bar .cell-label')).height), tap: Math.round(r(document.querySelector('#btn-undo')).height), ctrlW: Math.round(r(document.querySelector('#kit-ctrl')).width) }; });
  log('board 1920: ' + JSON.stringify(bg));
  expect(bg.bar[0] >= 550 && bg.bar[1] >= 65 && bg.lblH >= 22 && bg.tap >= 56, 'U-01 칠판 1920 막대 ' + bg.bar.join('×') + ', 칸 번호 ' + bg.lblH + 'px, 버튼 ' + bg.tap + 'px');
  expect(await hscroll() <= 0, '1920 칠판 가로 스크롤 없음');
  await shot('rv-board-1920');
  await act('setBoard', false);

  // ===== 400px: F-03 더 보기 메뉴, U-07 라벨, F-09 터치 타깃, 가로 스크롤 =====
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(250);
  for (const tab of ['kit', 'compare', 'arith', 'cards', 'scenes', 'sheet']) { await act('setTab', tab); await sleep(120); const hs = await hscroll(); expect(hs <= 0, `400px ${tab} 탭 가로 스크롤 없음 (overflow ${hs})`); }
  await act('setTab', 'kit'); await sleep(100);
  await page.click('#more-menu summary'); await sleep(150);
  const ml = await rect('#more-menu .more-list');
  const mlItems = await ev(() => [...document.querySelectorAll('#more-menu .more-list .tb, #more-menu .more-list .tb-select')].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }));
  log('400 more-list: ' + JSON.stringify({ ml, mlItems }));
  expect(ml && ml.left >= 0 && ml.right <= 400 && mlItems.every(([l, r]) => l >= 0 && r <= 400), 'F-03 400px 더 보기 메뉴와 항목이 화면 안 ' + JSON.stringify(ml));
  await shot('rv-400-more');
  await page.keyboard.press('Escape'); await ev(() => { document.querySelector('#more-menu').open = false; });
  await page.setViewportSize({ width: 360, height: 740 }); await sleep(200); await page.click('#more-menu summary'); await sleep(150);
  const ml2 = await rect('#more-menu .more-list'); expect(ml2 && ml2.left >= 0 && ml2.right <= 360, 'F-03 360px 더 보기 메뉴 화면 안 ' + JSON.stringify(ml2));
  expect(await hscroll() <= 0, '360px 가로 스크롤 없음');
  await ev(() => { document.querySelector('#more-menu').open = false; });
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(200);
  const small = await ev(() => [...document.querySelectorAll('#toolbar .tb, .model-tabs [role=tab], #toolbar summary')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 6), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.w < 44 || x.h < 44));
  expect(small.length === 0, 'F-09 400px 툴바·모델 탭 44px 이상 ' + JSON.stringify(small));
  // F-07 400px에서 활성 모델 끄기
  await page.click('[data-action=toggle-ctrl]'); await sleep(100);
  await page.uncheck('[data-model-toggle=bar]'); await sleep(100);
  const vis7 = await ev(() => ({ active: document.querySelector('.view-kit .models').dataset.activeModel, visible: [...document.querySelectorAll('.view-kit .model')].filter(e => !e.hidden && e.getBoundingClientRect().height > 0).map(e => e.dataset.model), barTabHidden: document.querySelector('[data-model-tab=bar]').hidden }));
  expect(vis7.visible.length === 1 && vis7.active === vis7.visible[0] && vis7.barTabHidden, 'F-07 400px 활성 막대 끄기 → 다른 모델로 전환, 막대 탭 숨김 ' + JSON.stringify(vis7));
  await page.check('[data-model-toggle=bar]'); await page.click('[data-action=toggle-ctrl]'); await sleep(100);
  // U-07 400px 라벨 크기(연산 탭)
  await act('setTab', 'arith'); await act('arithSet', 'a', 3, 4); await act('arithSet', 'b', 1, 6); await sleep(150);
  const m7 = await ev(() => { const r = e => e ? Math.round(e.getBoundingClientRect().height) : 0; const svg = document.querySelector('.ar-bars'); return { svg: [Math.round(svg.getBoundingClientRect().width), Math.round(svg.getBoundingClientRect().height)], cell: r(document.querySelector('.ar-bars .cell-label')), row: r(document.querySelector('.ar-bars .row-label')), stageTop: Math.round(document.querySelector('.view-ab .stage').getBoundingClientRect().top), inputsTop: Math.round(document.querySelector('#ar-inputs').getBoundingClientRect().top) }; });
  log('400 arith: ' + JSON.stringify(m7));
  expect(m7.cell >= 12 && m7.row >= 11, 'U-07 400px 연산 막대 칸 번호 ' + m7.cell + 'px · 행 라벨 ' + m7.row + 'px');
  expect(m7.stageTop < m7.inputsTop, 'U-16 400px 막대가 입력 블록보다 위');
  await shot('rv-400-arith');
  await act('setTab', 'kit'); await page.click('[data-model-tab=line]'); await sleep(100);
  const m7b = await ev(() => ({ tick: Math.round((document.querySelector('.kit-line .tick-label:not(.int)') || document.body).getBoundingClientRect().height) }));
  expect(m7b.tick >= 10, 'U-07 400px 수직선 눈금 라벨 ' + m7b.tick + 'px');
  await page.click('[data-model-tab=bar]');
  await act('setTab', 'cards'); await sleep(150); await shot('rv-400-cards');
  expect(errCount() === 0, '전체 페이지 예외 0 (' + errs.join(' | ') + ')');
};
