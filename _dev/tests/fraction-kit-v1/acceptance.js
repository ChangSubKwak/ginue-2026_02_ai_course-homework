// 분수교구함 수용 기준 자동 확인(pw-run.js 모듈)
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const txt = sel => page.locator(sel).first().innerText();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const clickCell = async (sel, i) => { await page.locator(`${sel} .cell[data-i="${i}"]`).first().dispatchEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }); await page.locator(sel).first().dispatchEvent('pointerup', { pointerId: 1 }); };

  // AC1 첫 실행
  let s = await S();
  expect(s.tab === 'kit' && s.kit.n === 1 && s.kit.d === 2, 'AC1 첫 실행: 교구판 1/2');
  expect(await page.locator('.kit-bar .cell.on').count() === 1, 'AC1 막대 1칸 색칠');
  expect(await page.locator('.kit-circle .cell.on').count() === 1, 'AC1 원 반쪽 색칠');
  const ptx = await page.evaluate(() => { const p = document.querySelector('.kit-line .pt'); return +p.getAttribute('cx'); });
  expect(Math.abs(ptx - 500) < 1, 'AC1 수직선 점 50% 위치(cx=' + ptx + ')');
  const sym = await txt('.kit-symbol');
  expect(sym.includes('0.5') && sym.includes('2분의 1'), 'AC1 기호 패널 0.5 · 2분의 1');
  expect(s.counts.scenes === 12 && s.counts.cards === 24 && s.counts.cardSets === 2, 'AC1 내장 장면 12·카드 24·세트 2');

  // AC2 분모 8, 3번째 칸 클릭
  await page.locator('#kit-d').fill('8'); await page.locator('#kit-d').dispatchEvent('input'); await page.locator('#kit-d').dispatchEvent('change');
  await clickCell('.kit-bar', 2);
  s = await S(); expect(s.kit.n === 3 && s.kit.d === 8, 'AC2 3/8');
  const sym2 = await txt('.kit-symbol');
  expect(sym2.includes('0.375') && sym2.includes('8분의 3'), 'AC2 소수 0.375 · 8분의 3');
  expect(await page.locator('.kit-circle .cell.on').count() === 3, 'AC2 원 조각 3개 색칠');
  const ptx2 = await page.evaluate(() => +document.querySelector('.kit-line .pt').getAttribute('cx'));
  expect(Math.abs((ptx2 - 36) / 928 - 0.375) < 0.001, 'AC2 수직선 37.5%');
  await clickCell('.kit-bar', 2);
  s = await S(); expect(s.kit.n === 2, 'AC2 다시 클릭 → 2/8');

  // AC3 ×2 ×3, 색칠 폭 불변
  await act('kitSetD', 2); await act('kitSetN', 1);
  const widthOf = () => page.evaluate(() => { const on = [...document.querySelectorAll('.kit-bar .cell.on')]; if (!on.length) return 0; const r = on.map(e => e.getBoundingClientRect()); return Math.max(...r.map(x => x.right)) - Math.min(...r.map(x => x.left)); });
  const w1 = await widthOf();
  await page.click('#btn-x2'); await sleep(500);
  s = await S(); expect(s.kit.n === 2 && s.kit.d === 4, 'AC3 ×2 → 2/4');
  const w2 = await widthOf(); expect(Math.abs(w1 - w2) < 1, `AC3 색칠 폭 불변 ${w1}→${w2}`);
  let chain = await txt('.kit-chain'); expect(chain.includes('1/2') && chain.includes('2/4') && chain.includes('×2'), 'AC3 사슬 1/2 = 2/4 ×2');
  await page.click('#btn-x3'); await sleep(500);
  s = await S(); chain = await txt('.kit-chain'); expect(s.kit.d === 12 && chain.includes('6/12'), 'AC3 ×3 → 6/12');
  await page.click('#btn-x2'); await sleep(500);
  const x2dis = await page.locator('#btn-x2').isDisabled(), x3dis = await page.locator('#btn-x3').isDisabled(), tip = await page.locator('#btn-x2').getAttribute('title');
  expect(x2dis && x3dis && tip === '분모는 24까지 나눌 수 있어요', 'AC3 분모 24에서 ×2·×3 비활성 + 툴팁');

  // AC4 합치기
  await act('kitSetD', 12); await act('kitSetN', 8);
  await page.click('[data-action=merge]'); await sleep(500); s = await S(); expect(s.kit.n === 4 && s.kit.d === 6, 'AC4 8/12 → 4/6');
  await page.click('[data-action=merge]'); await sleep(500); s = await S(); expect(s.kit.n === 2 && s.kit.d === 3, 'AC4 → 2/3');
  chain = await txt('.kit-chain'); expect((chain.match(/÷2/g) || []).length === 2, 'AC4 ÷2 라벨 2회');
  await page.click('[data-action=merge]'); await sleep(200);
  expect((await txt('#toast-root')).includes('더 약분할 수 없어요'), 'AC4 기약분수 토스트');

  // AC5 가분수·분모 13
  await act('kitSetD', 4); await act('kitSetN', 0);
  for (let i = 0; i < 7; i++) await page.click('[data-action=kit-n][data-delta="1"]');
  s = await S(); expect(s.kit.n === 7, 'AC5 분자 7');
  expect(await page.locator('.kit-bar .bar-frame').count() === 2 && await page.locator('.kit-circle .circle-frame').count() === 2, 'AC5 막대·원 2개');
  const ints = await page.evaluate(() => [...document.querySelectorAll('.kit-line .tick-label.int')].map(e => e.textContent).join(','));
  expect(ints === '0,1,2', 'AC5 수직선 0~2 (' + ints + ')');
  const sym5 = await txt('.kit-symbol'); expect(sym5.includes('1.75') && sym5.includes('1과 4분의 3'), 'AC5 1.75 · 1과 4분의 3');
  await act('kitSetD', 13); await clickCell('.kit-circle', 0);
  s = await S(); expect(s.kit.d === 13 && s.kit.n === 7, 'AC5 분모 13에서 원 클릭 무시');
  expect(await page.locator('.kit-circle-cap').isVisible() && (await txt('.kit-circle-cap')).includes('12등분까지'), 'AC5 원 캡션');
  await shot('kit-7-13');

  // AC6 비교·통분
  await page.click('[data-tab=compare]');
  await page.click('#cmp-inputs .ab-block.a .chip[data-n="2"][data-d="3"]'); await page.click('#cmp-inputs .ab-block.b .chip[data-n="3"][data-d="5"]');
  await page.click('[data-action=cmp-start]'); await sleep(450); await page.click('[data-action=cmp-next]'); await sleep(450); await page.click('[data-action=cmp-next]'); await sleep(200);
  const f6 = await txt('.cmp-formula');
  expect(f6.includes('2/3 = 10/15') && f6.includes('3/5 = 9/15') && f6.includes('10/15 > 9/15 → 2/3 > 3/5') && f6.includes('차이: 1/15'), 'AC6 통분 식');
  expect(await page.locator('.cmp-bars [data-who=a] .div').count() === 14, 'AC6 A 막대 15등분');
  await page.click('[data-action=cmp-overlay]'); await sleep(100);
  expect(await page.locator('.cmp-bars .cell.ov').count() === 1 && await page.locator('.cmp-bars .hatch').count() === 1, 'AC6 겹쳐 보기 + 빗금');
  await shot('compare');

  // AC7 덧셈
  await page.click('[data-tab=arith]');
  await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 1, 3); await act('arithOp', '+');
  for (let i = 0; i < 3; i++) { await page.click('[data-action=ar-next]'); await sleep(750); }
  const f7 = (await txt('.ar-formula')).replace(/\s+/g, ' ');
  expect(f7.includes('1/2 + 1/3') && f7.includes('3/6 + 2/6') && f7.includes('5/6'), 'AC7 식 전개 ' + f7);
  expect(await page.locator('.ar-bars [data-who=r] .cell.on').count() === 5 && await page.locator('.ar-bars [data-who=r] .cell').count() === 6, 'AC7 결과 막대 6칸 중 5칸');
  await act('arithSet', 'a', 3, 4); await act('arithSet', 'b', 3, 4);
  for (let i = 0; i < 2; i++) { await page.click('[data-action=ar-next]'); await sleep(750); }
  let f = (await txt('.ar-formula')).replace(/\s+/g, ' '); expect(f.includes('6/4') && f.includes('1 2/4'), 'AC7 6/4 = 1 2/4 ' + f);
  expect(await page.locator('.ar-bars [data-who=r] .bar-frame').count() === 2, 'AC7 결과 막대 2단위');
  await page.click('[data-action=ar-next]'); await sleep(500);
  f = (await txt('.ar-formula')).replace(/\s+/g, ' '); expect(f.includes('1 1/2'), 'AC7 약분 1 1/2');
  await shot('arith');

  // AC8 뺄셈 모달 + 오개념 거울
  await act('arithSet', 'a', 1, 3); await act('arithSet', 'b', 1, 2); await act('arithOp', '-');
  await page.click('[data-action=ar-next]'); await sleep(200);
  expect((await txt('.modal')).includes('앞의 분수가 더 작아요'), 'AC8 자리 바꾸기 모달');
  await page.click('.modal-foot .btn.primary'); await sleep(700);
  s = await S(); expect(s.arith.a.n === 1 && s.arith.a.d === 2 && s.arith.b.d === 3, 'AC8 A=1/2, B=1/3 교환');
  await page.click('[data-action=ar-next]'); await sleep(1300); await page.click('[data-action=ar-next]'); await sleep(400);
  f = (await txt('.ar-formula')).replace(/\s+/g, ' '); expect(f.includes('1/6'), 'AC8 결과 1/6 ' + f);
  await act('arithSet', 'a', 1, 2); await act('arithSet', 'b', 1, 3); await act('arithOp', '+');
  for (let i = 0; i < 3; i++) { await page.click('[data-action=ar-next]'); await sleep(750); }
  await page.click('[data-action=ar-mirror]'); await sleep(200);
  const ml = await txt('.ar-mirror-label');
  expect(ml.includes('분자끼리·분모끼리 더하면 2/5 — 실제 결과 5/6과의 차이: 13/30'), 'AC8 오개념 거울 라벨: ' + ml);
  expect(await page.locator('.ar-bars .cell.on.f-w').count() === 2, 'AC8 빨간 빗금 막대');
  await shot('mirror');

  // AC9 탐구 카드
  await page.click('[data-tab=cards]');
  await page.click('[data-pick="c3-03"]'); await sleep(200);
  expect(await page.locator('#card-stage .curtained').count() >= 1, 'AC9 커튼 가림');
  await page.click('.choice[data-choice="1"]'); await sleep(100);
  expect((await txt('.predict-badge')).includes('예측'), 'AC9 예측 배지');
  await page.click('[data-card=confirm]'); await sleep(2800);
  expect(await page.locator('#card-stage .curtained').count() === 0, 'AC9 커튼 해제');
  const f9 = await txt('#card-stage .cmp-formula');
  expect(f9.includes('4/12 > 3/12 → 1/3 > 1/4') && f9.includes('차이: 1/12'), 'AC9 1/3 > 1/4, 차이 1/12: ' + f9);
  expect((await txt('.result-msg')).includes('예측과 달라요') && await page.locator('.explain').count() === 1, 'AC9 주황 메시지 + 해설');
  await page.click('[data-pick="c3-04"]'); await page.click('[data-pick="c3-03"]'); await page.click('.choice[data-choice="0"]'); await page.click('[data-card=confirm]'); await sleep(300);
  expect((await txt('.result-msg')).includes('예측대로예요'), 'AC9 초록 메시지');
  await shot('cards');

  // AC10 학급 집계
  await act('setTally', [9, 12, 3]); await sleep(100);
  const widths = await page.evaluate(() => [...document.querySelectorAll('.tally-fill')].map(e => e.style.width));
  expect(widths.join(',') === '37.5%,50%,12.5%', 'AC10 막대 폭 ' + widths.join(','));
  const tl = await page.locator('.tally-label').allInnerTexts();
  expect(tl[0].includes('9명') && tl[1].includes('12명') && tl[2].includes('3명'), 'AC10 라벨');
  expect(await page.locator('.tally-row.correct').count() === 1 && (await page.locator('.tally-row.correct input').inputValue()) === '9', 'AC10 정답 막대 강조');
  await reload(); await sleep(300);
  const t10 = await page.evaluate(() => window.__app.actions.getDb().tally['c3-03'].counts);
  expect(t10.join(',') === '9,12,3', 'AC10 새로고침 후 유지');

  // AC11 장면 저장/복원
  await page.click('[data-tab=kit]'); await act('kitSetD', 5); await act('kitSetN', 3); await act('kitSplit', 2);
  await page.click('[data-action=save-scene]'); await sleep(200);
  await page.fill('#sv-name', '테스트 장면'); await page.selectOption('#sv-grade', '5'); await page.fill('#sv-memo', '발문 테스트'); await page.click('.modal-foot .btn.primary'); await sleep(200);
  s = await S(); expect(s.counts.scenes === 13, 'AC11 장면 13개');
  await reload(); await sleep(300);
  s = await S(); expect(s.counts.scenes === 13, 'AC11 새로고침 후 유지');
  await page.click('[data-tab=scenes]'); await sleep(200);
  expect(await page.locator('.scene-card:has-text("테스트 장면") .thumb').count() === 1, 'AC11 썸네일 카드');
  await page.click('[data-tab=kit]'); await act('kitSetD', 3); await act('kitSetN', 1);
  await page.click('[data-tab=scenes]'); await page.click('.scene-card:has-text("테스트 장면") [data-sc=load]'); await sleep(300);
  s = await S(); expect(s.tab === 'kit' && s.kit.n === 6 && s.kit.d === 10 && s.kit.chain.length === 2, 'AC11 불러오기 복원(6/10, 사슬 2)');
  expect((await txt('#memo-panel')).includes('발문 테스트'), 'AC11 교사 메모 패널');

  // AC12 내보내기/가져오기
  const exported = await page.evaluate(() => JSON.stringify(window.__app.actions.exportJson()));
  const res = await page.evaluate(t => window.__app.actions.importJson(t), exported);
  expect(res.scenes === 0 && res.cards === 0 && res.sets === 0 && res.skipped.length === 13 + 24 + 2, 'AC12 동일 내용 모두 건너뜀 ' + JSON.stringify({ ...res, skipped: res.skipped.length }));
  await page.click('.modal-foot .btn'); await sleep(100);
  const bad = await page.evaluate(() => window.__app.actions.importJson('hello, not json'));
  expect(bad === null && (await txt('#toast-root')).includes('JSON 형식이 아닙니다'), 'AC12 JSON 아님 토스트');
  s = await S(); expect(s.counts.scenes === 13, 'AC12 장면 수 불변');
  // 드롭존 파일 입력
  const buf = Buffer.from(exported.replace(/"name":"테스트 장면"/, '"name":"가져온 장면"').replace(/"id":"sc-[a-z0-9]+","name":"가져온 장면"/, '"id":"sc-import1","name":"가져온 장면"'));
  await page.click('[data-tab=scenes]');
  await page.setInputFiles('#import-file', { name: 'fraction-kit-20260301.json', mimeType: 'application/json', buffer: buf }); await sleep(400);
  s = await S(); expect(s.counts.scenes === 14 && (await txt('#toast-root')).includes('가져옴'), 'AC12 파일 가져오기 토스트 + 장면 14');
  await page.click('.modal-foot .btn'); await sleep(100);

  // AC13 활동지
  await page.click('[data-tab=sheet]'); await page.click('[data-action=sheet-clear]'); await sleep(100); await page.click('.modal-foot .btn.primary'); await sleep(100);
  for (const id of ['c3-01', 'c3-02', 'c3-03', 'c4-01', 'c4-03', 'c5-08']) await page.check(`#sheet-cards [data-id="${id}"]`);
  await page.check('#ws-answers'); await sleep(200);
  const pages = await page.locator('#print-root .a4').count();
  expect(pages === 2 && await page.locator('#print-root .a4.answers').count() === 1 && await page.locator('#print-root .ws-item').count() === 6, 'AC13 A4 2쪽(문항 6 + 정답지)');
  const order1 = await page.locator('#sheet-items .ws-item-fr').allInnerTexts();
  let changed = false; for (let i = 0; i < 5 && !changed; i++) { await page.click('[data-action=sheet-shuffle]'); const o2 = await page.locator('#sheet-items .ws-item-fr').allInnerTexts(); changed = o2.join() !== order1.join(); }
  expect(changed, 'AC13 순서 섞기');
  const printHidden = await page.evaluate(() => { const s = document.createElement('style'); return true; });
  await page.emulateMedia({ media: 'print' });
  const pv = await page.evaluate(() => ({ shell: getComputedStyle(document.querySelector('.app-shell')).display, root: getComputedStyle(document.querySelector('#print-root')).display }));
  expect(pv.shell === 'none' && pv.root === 'block', 'AC13 인쇄 시 앱 UI 숨김 ' + JSON.stringify(pv));
  await page.emulateMedia({ media: 'screen' });
  await shot('sheet');

  // AC14 칠판·펜·커튼
  await page.click('[data-tab=kit]');
  await page.click('#btn-board'); await sleep(100);
  const board = await page.evaluate(() => ({ attr: document.documentElement.dataset.board, fs: getComputedStyle(document.documentElement).fontSize, btn: document.querySelector('#btn-x2').getBoundingClientRect().height }));
  expect(board.attr === 'on' && board.fs === '24px' && board.btn >= 56, 'AC14 칠판 모드 ' + JSON.stringify(board));
  await shot('board');
  await page.click('#btn-pen'); await sleep(100);
  const bar = await page.locator('.kit-bar').boundingBox();
  await page.mouse.move(bar.x + 10, bar.y + 10); await page.mouse.down(); await page.mouse.move(bar.x + 200, bar.y + 30, { steps: 5 }); await page.mouse.up();
  const drawn = await page.evaluate(() => { const c = document.querySelector('#pen-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  expect(drawn > 100, 'AC14 펜 선 그림(px=' + drawn + ')');
  await page.click('[data-pen=clear]');
  const cleared = await page.evaluate(() => { const c = document.querySelector('#pen-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  expect(cleared === 0, 'AC14 모두 지우기');
  await page.click('[data-pen=off]'); await act('kitSetD', 4); await act('kitSetN', 0);
  await page.locator('.kit-bar .cell[data-i="1"]').click();
  s = await S(); expect(s.kit.n === 2, 'AC14 펜 끄기 후 칸 클릭 동작');
  await page.click('#btn-curtain'); await sleep(100);
  const cur = await page.evaluate(() => getComputedStyle(document.querySelector('.kit-symbol'), '::after').content);
  expect(cur.includes('커튼'), 'AC14 커튼 가림');
  await page.click('#btn-curtain'); await page.click('#btn-board');

  // AC15 400px / 1920px
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, tabs: getComputedStyle(document.querySelector('.model-tabs')).display, ctrl: getComputedStyle(document.querySelector('#kit-ctrl')).position, visibleModels: [...document.querySelectorAll('.view-kit .model')].filter(e => e.getBoundingClientRect().height > 0).length }));
  expect(m.sw <= m.cw + 1 && m.tabs === 'flex' && m.ctrl === 'fixed' && m.visibleModels === 1, 'AC15 400px ' + JSON.stringify(m));
  await page.click('[data-action=toggle-ctrl]'); await sleep(100); await shot('mobile-kit');
  await page.click('[data-action=toggle-ctrl]');
  await page.setViewportSize({ width: 1920, height: 1080 }); await sleep(300);
  const big = await page.evaluate(() => [...document.querySelectorAll('.view-kit .model')].map(e => Math.round(e.getBoundingClientRect().top)));
  expect(big.length === 3 && big.every(t => t === big[0]), 'AC15 1920px 세 모델 나란히 ' + big.join(','));
  await page.setViewportSize({ width: 1280, height: 800 });

  // AC17 되돌리기
  await act('kitSetD', 6); await act('kitSetN', 0);
  await page.locator('.kit-bar .cell[data-i="2"]').click(); await page.click('#btn-x2'); await sleep(450);
  await page.locator('#kit-d').fill('8'); await page.locator('#kit-d').dispatchEvent('input'); await page.locator('#kit-d').dispatchEvent('change');
  s = await S(); expect(s.kit.d === 8, 'AC17 슬라이더 8');
  await page.keyboard.press('Control+z'); s = await S(); expect(s.kit.n === 6 && s.kit.d === 12, 'AC17 undo1 → 6/12');
  await page.keyboard.press('Control+z'); s = await S(); expect(s.kit.n === 3 && s.kit.d === 6, 'AC17 undo2 → 3/6');
  await page.keyboard.press('Control+z'); s = await S(); expect(s.kit.n === 0 && s.kit.d === 6, 'AC17 undo3 → 0/6');
  await page.click('#btn-redo'); s = await S(); expect(s.kit.n === 3, 'AC17 redo → 3/6');
  await page.click('#btn-redo'); await page.click('#btn-redo');
  expect(await page.locator('#btn-redo').isDisabled(), 'AC17 스택 끝 redo 비활성');

  // AC16 localStorage 실패
  await page.addInitScript(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('quota'); }; });
  await reload(); await sleep(300);
  const ls = await page.evaluate(() => ({ banner: !document.querySelector('#save-banner').hidden, text: document.querySelector('#save-banner').innerText, kit: window.__app.getState().kit.d }));
  expect(ls.banner && ls.text.includes('저장이 꺼져 있어요'), 'AC16 저장 불가 배너');
  await act('saveScene', { name: '메모리 장면', grade: null, unit: '', memo: '' });
  s = await S(); expect(s.counts.scenes >= 1 && (await page.evaluate(() => window.__app.actions.exportJson().scenes.some(x => x.name === '메모리 장면'))), 'AC16 세션 내 장면 저장 + 내보내기 가능');
};
