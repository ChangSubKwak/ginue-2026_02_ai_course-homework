// code-01-bugs.js — 분수교구함 코드 리뷰 의심 로직 재현 모듈 (pw-run.js용)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const overflow = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    past: [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1; }).slice(0, 6).map(el => el.tagName + (el.id ? '#' + el.id : '') + '.' + el.className + ' right=' + Math.round(el.getBoundingClientRect().right)) }));
  const setFrac = (n, d) => page.evaluate(([n, d]) => window.__app.actions.setFraction(n, d), [n, d]);

  // ---- B1: 400px 폭 가로 스크롤(읽기 텍스트 nowrap, 큰 글씨) ----
  await page.setViewportSize({ width: 400, height: 900 });
  await setFrac(7, 4); await sleep(100);
  let o = await overflow(); log('B1 400px 7/4 normal: ' + JSON.stringify(o));
  expect(o.sw <= o.cw, 'B1a 400px 7/4 보통 모드 가로 스크롤 없음');
  await setFrac(12, 11); await sleep(100);
  o = await overflow(); log('B1 400px 12/11 normal: ' + JSON.stringify(o));
  expect(o.sw <= o.cw, 'B1b 400px 12/11 보통 모드 가로 스크롤 없음');
  await shot('b1-400-12of11-normal');
  await page.click('[data-action="big"]'); await sleep(150);
  o = await overflow(); log('B1 400px 12/11 big: ' + JSON.stringify(o));
  expect(o.sw <= o.cw, 'B1c 400px 12/11 큰 글씨 모드 가로 스크롤 없음');
  await shot('b1-400-12of11-big');
  await setFrac(7, 4); await sleep(100);
  o = await overflow(); log('B1 400px 7/4 big: ' + JSON.stringify(o));
  expect(o.sw <= o.cw, 'B1d 400px 7/4 큰 글씨 모드 가로 스크롤 없음');
  await setFrac(3, 4); await sleep(100);
  o = await overflow(); log('B1 400px 3/4 big: ' + JSON.stringify(o));
  expect(o.sw <= o.cw, 'B1e 400px 3/4 큰 글씨 모드 가로 스크롤 없음');
  // 큰 글씨 모드 버튼 크기
  const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)).map(b => b.textContent.trim() + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)));
  log('B1 small buttons(big mode 400px): ' + JSON.stringify(small));
  await page.click('[data-action="big"]'); await sleep(100);
  const small2 = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)).map(b => b.textContent.trim() + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)));
  expect(small2.length === 0, 'B1f 400px 보통 모드 44px 미만 버튼 없음 ' + JSON.stringify(small2));

  // ---- B2: 수직선 분수 라벨 겹침(d=12, 400px) + 막대 칸 터치 크기 ----
  await setFrac(5, 12); await sleep(100);
  const measure = () => page.evaluate(() => {
    const labs = [...document.querySelectorAll('#svg-line .tick-label:not(.int)')].map(t => { const r = t.getBoundingClientRect(); return { x: r.left, w: r.width, t: t.textContent }; }).sort((a, b) => a.x - b.x);
    let overlaps = 0; for (let i = 1; i < labs.length; i++) if (labs[i].x < labs[i - 1].x + labs[i - 1].w - 0.5) overlaps++;
    const cell = document.querySelector('#svg-bar .cell').getBoundingClientRect();
    const circLabels = [...document.querySelectorAll('#svg-circle .cell-label')].map(t => t.getBoundingClientRect());
    let circOverlap = 0; for (let i = 0; i < circLabels.length; i++) for (let j = i + 1; j < circLabels.length; j++) { const a = circLabels[i], b = circLabels[j]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) circOverlap++; }
    return { count: labs.length, overlaps, sample: labs.slice(0, 3), cellW: cell.width, cellH: cell.height, circOverlap, fontPx: getComputedStyle(document.querySelector('#svg-line .tick-label:not(.int)')).fontSize };
  });
  let m = await measure(); log('B2 400px d=12 U=1: ' + JSON.stringify(m));
  expect(m.overlaps === 0, 'B2a 400px 분모 12 수직선 라벨 겹침 없음 (겹침 ' + m.overlaps + '/' + m.count + ')');
  expect(m.cellW >= 44 && m.cellH >= 44, 'B2b 400px 분모 12 막대 칸 터치 크기 44px 이상 (' + Math.round(m.cellW) + 'x' + Math.round(m.cellH) + ')');
  await shot('b2-400-5of12');
  await setFrac(13, 12); await sleep(100);
  m = await measure(); log('B2 400px d=12 U=2: ' + JSON.stringify(m));
  expect(m.overlaps === 0, 'B2c 400px 13/12 수직선 라벨 겹침 없음 (겹침 ' + m.overlaps + '/' + m.count + ')');
  await shot('b2-400-13of12');
  await page.setViewportSize({ width: 1280, height: 800 });
  await setFrac(5, 12); await sleep(100);
  m = await measure(); log('B2 1280px d=12 U=1: ' + JSON.stringify(m));
  expect(m.overlaps === 0, 'B2d 1280px 분모 12 수직선 라벨 겹침 없음 (겹침 ' + m.overlaps + '/' + m.count + ')');
  await setFrac(13, 12); await sleep(100);
  m = await measure(); log('B2 1280px d=12 U=2: ' + JSON.stringify(m));
  expect(m.overlaps === 0, 'B2e 1280px 13/12 수직선 라벨 겹침 없음 (겹침 ' + m.overlaps + '/' + m.count + ')');
  await shot('b2-1280-13of12');
  await page.setViewportSize({ width: 768, height: 1024 });
  await setFrac(13, 12); await sleep(100);
  m = await measure(); log('B2 768px d=12 U=2: ' + JSON.stringify(m));
  expect(m.overlaps === 0, 'B2f 768px 13/12 수직선 라벨 겹침 없음 (겹침 ' + m.overlaps + '/' + m.count + ')');
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---- B3: 저장값 chain 항의 n 범위 미검증 → 사슬 항 클릭으로 n > 2d / 음수 상태 ----
  await page.evaluate(() => localStorage.setItem('edu.fraction-kit.v2.state', JSON.stringify({ version: 2, n: 3, d: 4, show: { bar: true, circle: true, line: true, decimal: true, reading: true }, big: false, chain: [{ n: 3, d: 4 }, { n: 100, d: 4 }, { n: -3, d: 4 }] })));
  await reload();
  let s = await st(); log('B3 loaded chain: ' + JSON.stringify(s.chain));
  expect(s.chain.length === 1, 'B3a 범위 밖 chain 항(n=100, n=-3)이 복원 시 걸러짐 (실제 ' + s.chain.length + '개)');
  if (s.chain.length === 3) {
    await page.click('[data-chain="1"]'); await sleep(100);
    s = await st(); log('B3 after goto 100/4: ' + JSON.stringify({ n: s.n, d: s.d }) + ' cap=' + await page.textContent('#cap-line') + ' ptLabel=' + await page.textContent('#svg-line .pt-label'));
    const ptx = await page.evaluate(() => { const c = document.querySelector('#svg-line .pt'); const r = c.getBoundingClientRect(), sv = c.ownerSVGElement.getBoundingClientRect(); return { ptRight: Math.round(r.right), svgRight: Math.round(sv.right) }; });
    log('B3 pt pos: ' + JSON.stringify(ptx));
    expect(s.n <= s.d * 2, 'B3b 사슬 항 이동 후 n ≤ 2d 유지 (n=' + s.n + ')');
    await shot('b3-chain-100of4');
    await page.click('[data-chain="2"]'); await sleep(100);
    s = await st(); log('B3 after goto -3/4: ' + JSON.stringify({ n: s.n, d: s.d }) + ' reading=' + await page.textContent('#reading b') + ' dec=' + await page.textContent('#decimal b'));
    expect(s.n >= 0, 'B3c 사슬 항 이동 후 n ≥ 0 유지 (n=' + s.n + ')');
    await shot('b3-chain-neg3of4');
  }
  await page.evaluate(() => localStorage.clear()); await reload();

  // ---- B4: ×2 → 합치기 후 사슬에 같은 분수 2개가 모두 .last 강조 ----
  await page.click('[data-action="split2"]'); await sleep(400);
  await page.click('[data-action="reduce"]'); await sleep(400);
  const chainTxt = await page.evaluate(() => [...document.querySelectorAll('#chain .term')].map(t => t.textContent + (t.classList.contains('last') ? '*' : '')));
  log('B4 chain: ' + JSON.stringify(chainTxt));
  expect(chainTxt.filter(t => t.endsWith('*')).length === 1, 'B4 사슬에서 현재 분수 강조(.last)가 1개만 (실제 ' + chainTxt.filter(t => t.endsWith('*')).length + '개)');
  await shot('b4-chain-dup-last');

  // ---- B5: '처음으로'가 사슬만 지우는 것이 아니라 분수도 첫 항으로 되돌림(스펙·README 문구와 다름) ----
  await page.evaluate(() => localStorage.clear()); await reload();
  await page.click('[data-action="split2"]'); await sleep(350);
  s = await st(); log('B5 after split2: ' + s.n + '/' + s.d);
  await page.click('[data-action="chain-clear"]'); await sleep(100);
  s = await st(); log('B5 after chain-clear: ' + s.n + '/' + s.d + ' chain=' + s.chain.length);
  expect(s.n === 6 && s.d === 8, 'B5 처음으로는 사슬만 지우고 현재 분수(6/8)는 유지 (실제 ' + s.n + '/' + s.d + ')');

  // ---- B6: 테마 저장값 검증 없음 ----
  await page.evaluate(() => localStorage.setItem('edu.fraction-kit.theme', JSON.stringify('blue')));
  await reload();
  const th = await page.evaluate(() => ({ attr: document.documentElement.dataset.theme, icon: document.querySelector('#btn-theme').textContent }));
  log('B6 theme garbage: ' + JSON.stringify(th));
  expect(th.attr === undefined || th.attr === 'light' || th.attr === 'dark', 'B6 잘못된 테마 저장값은 무시됨 (실제 data-theme=' + th.attr + ')');
  await page.evaluate(() => localStorage.clear());

  // ---- B7: localStorage 사용 불가 시 토스트 시점 ----
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } }); });
  await reload(); await sleep(400);
  let toasts = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent));
  log('B7 toasts on load: ' + JSON.stringify(toasts));
  const toastOnLoad = toasts.length;
  await page.click('[data-action="n+"]'); await sleep(300);
  toasts = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent));
  log('B7 toasts after first action: ' + JSON.stringify(toasts));
  expect(toasts.length === 1, 'B7a 저장소 불가 시 토스트 1회 (첫 조작 후 ' + toasts.length + '개)');
  log('B7b 로드 직후 토스트 수 = ' + toastOnLoad + ' (0이면 첫 조작 전까지 안내 없음)');
  s = await st(); expect(s.n === 4, 'B7c 저장소 불가 시 메모리 동작(n=4)');
  await page.click('[data-action="n+"]'); await sleep(300);
  toasts = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent));
  expect(toasts.length === 1, 'B7d 두 번째 조작에도 토스트 누적 안 됨 (' + toasts.length + ')');

  // ---- B8: 화살표 키가 전역 preventDefault → 키보드 페이지 스크롤 차단 ----
  await page.setViewportSize({ width: 400, height: 500 });
  await page.evaluate(() => { window.scrollTo(0, 0); document.body.focus(); });
  await page.keyboard.press('ArrowDown'); await sleep(300);
  const sy = await page.evaluate(() => window.scrollY);
  s = await st();
  log('B8 ArrowDown at body: scrollY=' + sy + ' d=' + s.d);
  expect(sy > 0 || s.d === 4, 'B8 본문에서 ↓키: 스크롤되거나 분모가 바뀜(둘 중 하나) scrollY=' + sy + ' d=' + s.d);
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---- B9: 모달 안에서 mousedown → 배경에서 mouseup(드래그 선택) 시 모달 닫힘 ----
  await page.click('[data-action="help"]'); await sleep(200);
  const box = await page.locator('.modal-body').boundingBox();
  await page.mouse.move(box.x + 40, box.y + 40); await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 5 }); await page.mouse.up(); await sleep(200);
  const open = await page.evaluate(() => !!document.querySelector('.modal'));
  expect(open, 'B9 모달 본문 드래그 후 배경에서 놓아도 모달 유지 (실제 open=' + open + ')');
  if (open) await page.keyboard.press('Escape');
  await sleep(200);
};
