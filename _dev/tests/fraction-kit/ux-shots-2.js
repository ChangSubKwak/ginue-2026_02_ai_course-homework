// ux-shots-2.js — 보충 촬영·측정: 사슬 라벨 확대, SVG 렌더 크기 측정, 보관함 빈 상태, 활동지(모바일·태블릿·다크), 더 보기 메뉴 위치
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const path = require('path');
  const outdir = path.dirname(await shot('00-probe2'));
  const act = async (code) => page.evaluate(code);
  const tab = async (t) => { await act(`__app.actions.setTab('${t}')`); await sleep(250); };
  const elshot = async (sel, name, zoom) => {
    if (zoom) await page.evaluate(([s, z]) => { document.querySelector(s).style.zoom = z; }, [sel, zoom]);
    await sleep(150);
    const p = path.join(outdir, name + '.png');
    await page.locator(sel).first().screenshot({ path: p });
    if (zoom) await page.evaluate((s) => { document.querySelector(s).style.zoom = ''; }, sel);
    log('elshot ' + p); return p;
  };
  const measure = async (label) => {
    const m = await page.evaluate(() => {
      const bb = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
      const textH = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.height * 10) / 10; };
      const fs = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontSize : null; };
      return { kitBar: bb('.kit-bar'), kitCircle: bb('.kit-circle'), kitLine: bb('.kit-line'), cellLabelH: textH('.kit-bar .cell-label'), tickLabelH: textH('.kit-line .tick-label:not(.int)'), eqLabelFs: fs('.eq-label'), abSvg: bb('.ar-bars') || bb('.cmp-bars'), abRowLabelH: textH('.ar-bars .row-label') || textH('.cmp-bars .row-label'), abCellLabelH: textH('.ar-bars .cell-label'), stageBar: bb('#card-stage .kit-bar'), stageCellLabelH: textH('#card-stage .cell-label'), modelCardH: [...document.querySelectorAll('.view-kit .model')].map(e => Math.round(e.getBoundingClientRect().height)), moreList: (() => { const e = document.querySelector('.more-list'); if (!e) return null; const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth }; })(), sliderMax: (document.querySelector('#kit-d') || {}).max };
    });
    log('MEASURE ' + label + ' ' + JSON.stringify(m));
    return m;
  };

  // 1280: 사슬 라벨 확대 + 측정
  await page.setViewportSize({ width: 1280, height: 800 });
  await tab('kit');
  await act('__app.actions.kitSetD(2); __app.actions.kitSetN(1)'); await sleep(200);
  await page.click('#btn-x2'); await sleep(600); await page.click('#btn-x3'); await sleep(600);
  await page.click('[data-action=merge]'); await sleep(600);
  await elshot('.kit-chain', 'z-01-chain-zoom', 2.5);
  await elshot('.kit-symbol', 'z-02-symbol-zoom', 2);
  await elshot('.model[data-model=bar]', 'z-03-bar-zoom', 3);
  await elshot('.model[data-model=line]', 'z-04-line-zoom', 3);
  await measure('desktop1280-kit-6of12-chain');
  await act('__app.actions.kitSetD(12); __app.actions.kitSetN(6)'); await sleep(200);
  await elshot('.kit-symbol', 'z-05-symbol-6of12-decimal', 2);
  // 1920 칠판 측정
  await page.setViewportSize({ width: 1920, height: 1080 }); await act('__app.actions.setBoard(true)'); await sleep(300);
  await measure('board1920-kit');
  await elshot('.model[data-model=bar]', 'z-06-board-bar-1920', 1);
  await act('__app.actions.setBoard(false)');
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(200);
  // 채워진 칸 숫자 라벨 대비(라이트/다크)
  await tab('arith'); await act("__app.actions.arithSet('a',1,2); __app.actions.arithSet('b',1,3); __app.actions.arithOp('+')");
  for (let i = 0; i < 3; i++) { await act('__app.actions.arithNext()'); await sleep(900); }
  await elshot('.ar-bars', 'z-07-arith-bars-light', 1.5);
  await act("document.documentElement.dataset.theme='dark'"); await sleep(200);
  await elshot('.ar-bars', 'z-08-arith-bars-dark', 1.5);
  // 다크 A4 미리보기
  await tab('sheet'); await act("__app.actions.sheetAddCard('c3-03'); __app.actions.sheetAddCard('c4-01')"); await sleep(400);
  await shot('z-09-sheet-dark-a4');
  await act("document.documentElement.dataset.theme='light'"); await sleep(200);
  await elshot('.sheet-preview', 'z-10-sheet-a4-page1', 1);
  await elshot('.ws-item', 'z-11-ws-item-zoom', 2);
  // 보관함 빈 상태
  await tab('scenes'); await act('FK.app.db.scenes.length = 0; FK.scenes.render()'); await sleep(300); await shot('z-12-scenes-empty-state');
  await act('__app.actions.resetSamples()'); await sleep(300);
  // 학년 3 슬라이더 상한
  await tab('kit'); await act('__app.actions.setGrade(3)'); await sleep(300); const g3 = await measure('grade3'); expect(String(g3.sliderMax) === '10', '3학년 프리셋에서 분모 슬라이더 max=10'); await act('__app.actions.setGrade(null)');
  // 태블릿 활동지(문항 있음)
  await page.setViewportSize({ width: 820, height: 1180 }); await sleep(300); await tab('sheet'); await shot('z-13-sheet-tablet-items');
  // 모바일 활동지·더 보기 메뉴·카드 작업판 측정
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300); await shot('z-14-sheet-mobile-items');
  await page.click('#more-menu summary'); await sleep(200); await measure('mobile-more-menu'); await page.click('#more-menu summary');
  await tab('cards'); await act("__app.actions.selectCard('c3-01')"); await sleep(300); await measure('mobile-card-stage-make');
  await page.evaluate(() => document.querySelector('#card-stage').scrollIntoView()); await sleep(200); await elshot('#card-stage', 'z-15-mobile-card-stage', 1);
  await tab('arith'); await measure('mobile-arith'); await elshot('.ar-bars', 'z-16-mobile-arith-bars', 1);
  await tab('kit'); await page.click('[data-model-tab=line]'); await sleep(200); await measure('mobile-kit-line');
  await elshot('.model[data-model=line]', 'z-17-mobile-line', 2);
};
