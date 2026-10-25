// 분수교구함 설명서용 스크린샷 촬영 모듈 (pw-run.js용)
// node _dev/tools/pw-run.js <index.html> _dev/docshots/fraction-kit.js <docs/screens>
'use strict';
const path = require('path');
module.exports = async ({ page, expect, sleep, log }) => {
  const outdir = process.argv[4] || path.join(__dirname, 'out');
  const snap = async (name, full) => {
    await page.waitForTimeout(400);
    const p = path.join(outdir, name + '.png');
    await page.screenshot({ path: p, fullPage: !!full });
    log('shot ' + p);
  };
  const act = (code) => page.evaluate(code);
  const closeModal = async () => { await page.keyboard.press('Escape'); await sleep(300); };
  const top = () => act(() => window.scrollTo(0, 0));

  await page.setViewportSize({ width: 1280, height: 900 });
  await sleep(400);

  // 01 첫 화면: 교구판, 내장 장면 '5-1 동치분수 찾기'(1/2) + 교사 메모
  expect((await act(() => window.__app.getState().tab)) === 'kit', '01 교구판 탭');
  expect((await act(() => window.__app.getState().counts.scenes)) === 12, '01 내장 장면 12개');
  await snap('01-main', false);

  // 02 같게 쪼개기: ×2 → ×3 → 동치 사슬 1/2 = 2/4 = 6/12
  await act(() => window.__app.actions.kitSplit(2));
  await sleep(600);
  await act(() => window.__app.actions.kitSplit(3));
  await sleep(700);
  expect((await act(() => { const k = window.__app.getState().kit; return k.n === 6 && k.d === 12 && k.chain.length === 3; })), '02 6/12 사슬 3항');
  await snap('02-kit-split', false);

  // 03 가분수: 분모 4, 분자 7 → 막대·원 2개, 7/4 = 1 3/4
  await act(() => { window.__app.actions.kitSetD(4); window.__app.actions.kitSetN(7); });
  await sleep(400);
  expect((await act(() => { const k = window.__app.getState().kit; return k.n === 7 && k.d === 4; })), '03 7/4');
  await snap('03-kit-mixed', false);

  // 04 비교·통분: 2/3 vs 3/5, 겹쳐 보기 + 통분 3단계 완료
  await act(() => { window.__app.actions.setTab('compare'); });
  await sleep(300);
  await act(() => { window.__app.actions.compareSet('a', 2, 3); window.__app.actions.compareSet('b', 3, 5); });
  await sleep(200);
  await act(() => window.__app.actions.compareOverlay());
  await sleep(200);
  await act(() => window.__app.actions.compareStart());
  await sleep(600);
  await act(() => window.__app.actions.compareNext());
  await sleep(600);
  await act(() => window.__app.actions.compareNext());
  await sleep(600);
  expect((await act(() => window.__app.getState().compare.step)) === 3, '04 통분 3단계');
  await top();
  await snap('04-compare', false);

  // 05 덧셈·뺄셈: 1/2 + 1/3 → 결과 단계 + 오개념 거울
  await act(() => { window.__app.actions.setTab('arith'); });
  await sleep(300);
  await act(() => { window.__app.actions.arithSet('a', 1, 2); window.__app.actions.arithSet('b', 1, 3); window.__app.actions.arithOp('+'); });
  await sleep(200);
  await act(() => window.__app.actions.arithNext());
  await sleep(700);
  await act(() => window.__app.actions.arithNext());
  await sleep(1000);
  await act(() => window.__app.actions.arithNext());
  await sleep(700);
  await act(() => window.__app.actions.arithMirror());
  await sleep(500);
  expect((await act(() => { const r = window.__app.getState().arith; return r.step === 3 && r.mirror; })), '05 결과 단계 + 거울');
  await top();
  await snap('05-arith-mirror', false);

  // 06 탐구 카드: '2/3와 3/5 중 큰 것은?' 집계 11·9·4, 예측 3/5 → 확인(자동 재생)
  await page.setViewportSize({ width: 1280, height: 1180 });
  await act(() => { window.__app.actions.setTab('cards'); });
  await sleep(300);
  await act(() => { window.__app.actions.selectCard('c5-03'); });
  await sleep(300);
  await act(() => { window.__app.actions.setTally([11, 9, 4]); window.__app.actions.predict(1); });
  await sleep(300);
  await act(() => { window.__app.actions.confirmCard(); });
  await sleep(3200);
  expect(await page.locator('.result-msg').count() === 1, '06 결과 메시지 표시');
  await top();
  await snap('06-cards', false);

  // 07 장면 보관함 그리드
  await page.setViewportSize({ width: 1280, height: 1000 });
  await act(() => { window.__app.actions.setTab('scenes'); });
  await sleep(400);
  expect(await page.locator('.scene-card').count() === 12, '07 장면 카드 12장');
  await top();
  await snap('07-scenes', false);

  // 08 활동지: 기본 문항 8개 + 정답지 포함
  await act(() => { window.__app.actions.setTab('sheet'); });
  await sleep(300);
  await page.check('#ws-answers');
  await sleep(400);
  expect(await page.locator('#sheet-preview .a4').count() >= 2, '08 A4 미리보기 2쪽 이상');
  await top();
  await snap('08-sheet', false);

  // 09 칠판 모드(전자칠판 고대비): 교구판 8/12
  await page.setViewportSize({ width: 1280, height: 900 });
  await act(() => { window.__app.actions.setTab('kit'); window.__app.actions.kitSetD(12); window.__app.actions.kitSetN(8); window.__app.actions.setBoard(true); });
  await sleep(500);
  await act(() => window.__app.actions.setTab('kit'));
  await sleep(400);
  expect((await act(() => document.documentElement.dataset.board)) === 'on', '09 칠판 모드');
  await top();
  await snap('09-board', false);
  await act(() => window.__app.actions.setBoard(false));
  await sleep(300);
  await act(() => window.__app.actions.setTab('kit'));
  await sleep(300);

  // 10 도움말 모달
  await page.click('.tb[data-action="help"]');
  await sleep(400);
  expect(await page.locator('.modal').count() === 1, '10 도움말 모달');
  await snap('10-help', false);
  await closeModal();

  // 11 모바일 400px: 교구판(모델 탭 + 하단 시트)
  await page.setViewportSize({ width: 400, height: 800 });
  await sleep(500);
  await act(() => { window.__app.actions.kitSetD(8); window.__app.actions.kitSetN(3); window.__app.actions.setTab('kit'); });
  await sleep(400);
  await top();
  await snap('11-mobile', true);

  // 12 다크 모드: 비교·통분 탭
  await page.setViewportSize({ width: 1280, height: 900 });
  await sleep(400);
  await act(() => { window.FK.actions.theme(); window.__app.actions.setTab('compare'); });
  await sleep(500);
  expect((await act(() => document.documentElement.dataset.theme)) === 'dark', '12 다크 테마');
  await top();
  await snap('12-dark', false);
  await act(() => { window.FK.actions.theme(); });
};
