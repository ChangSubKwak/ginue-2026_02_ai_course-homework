// ux-shots.js — 분수교구함 UX 리뷰용 스크린샷 일괄 촬영 (pw-run.js 모듈)
// 데스크톱 1280 라이트·다크, 태블릿 820, 모바일 400(fullPage + viewport) / 모든 탭·모달·상태 변화·인쇄 미디어
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const path = require('path');
  const outdir = path.dirname((await shot('00-probe')));
  const vshot = async (name) => { const p = path.join(outdir, name + '.png'); await page.screenshot({ path: p, fullPage: false }); log('vshot ' + p); return p; };
  const esc = async () => { await page.keyboard.press('Escape'); await sleep(150); };
  const act = async (code) => page.evaluate(code);
  const tab = async (t) => { await act(`__app.actions.setTab('${t}')`); await sleep(250); };
  const setTheme = async (t) => { await act(`document.documentElement.dataset.theme='${t}'; localStorage.setItem('edu.fraction-kit.theme', JSON.stringify('${t}'))`); await sleep(150); };
  const metrics = {};
  const measure = async (key) => {
    metrics[key] = await page.evaluate(() => {
      const de = document.documentElement;
      const small = [];
      for (const el of document.querySelectorAll('button, a, input, select, label, summary, [role=tab]')) {
        if (el.hidden || el.closest('[hidden]')) continue;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        if (r.width < 40 || r.height < 40) small.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '')) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 14) + '"');
        if (small.length >= 25) break;
      }
      const tiny = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!el.childNodes.length || el.closest('[hidden]') || el.closest('svg') || el.closest('.a4')) continue;
        const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!hasText) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 13) { const r = el.getBoundingClientRect(); if (r.width && r.height) tiny.push(el.tagName.toLowerCase() + '.' + String(el.className).split(/\s+/)[0] + ' ' + fs + 'px "' + el.textContent.trim().slice(0, 16) + '"'); }
        if (tiny.length >= 20) break;
      }
      return { clientWidth: de.clientWidth, scrollWidth: de.scrollWidth, bodyScrollWidth: document.body.scrollWidth, overflow: de.scrollWidth > de.clientWidth + 1, smallTargets: small, tinyText: tiny, fontBody: getComputedStyle(document.body).fontSize };
    });
  };

  // ============ 데스크톱 1280 라이트 ============
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(200);
  await shot('d-01-kit-initial');
  await vshot('d-01v-kit-initial');
  await measure('d-kit');
  // 포커스 표시 확인
  await page.focus('#btn-undo'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await sleep(100);
  await vshot('d-02-focus-ring');
  // 더 보기 메뉴
  await page.click('#more-menu summary'); await sleep(200); await vshot('d-03-more-menu'); await page.click('#more-menu summary'); await sleep(100);
  // 도움말 모달
  await page.click('.toolbar [data-action=help]'); await sleep(300); await shot('d-04-help-modal');
  await esc();
  // 분모 8, 3번째 칸
  await act('__app.actions.kitSetD(8)'); await sleep(200);
  await page.locator('.kit-bar .cell').nth(2).click(); await sleep(400);
  await shot('d-05-kit-3of8');
  // 쪼개기 사슬: 1/2 → ×2 → ×3 → 합치기
  await act('__app.actions.kitSetD(2); __app.actions.kitSetN(1)'); await sleep(200);
  await page.click('#btn-x2'); await sleep(600); await page.click('#btn-x3'); await sleep(600);
  await shot('d-06-kit-chain-x2-x3');
  await page.click('[data-action=merge]'); await sleep(600); await page.click('[data-action=merge]'); await sleep(600);
  await page.click('[data-action=merge]'); await sleep(300);
  await vshot('d-07-kit-merge-toast');
  await sleep(1200);
  // 가분수 7/4
  await act('__app.actions.kitSetD(4); __app.actions.kitSetN(7)'); await sleep(300);
  await shot('d-08-kit-7of4');
  // 분모 13·24 (원 캡션, 라벨 생략, 버튼 비활성)
  await act('__app.actions.kitSetD(13); __app.actions.kitSetN(5)'); await sleep(300);
  await shot('d-09-kit-d13');
  await act('__app.actions.kitSetD(24); __app.actions.kitSetN(50)'); await sleep(300);
  await shot('d-10-kit-d24-max');
  // 어림해서 찍기
  await act('__app.actions.kitSetD(8); __app.actions.kitSetN(5)'); await sleep(200);
  await page.click('[data-action=estimate]'); await sleep(300); await shot('d-11-estimate-modal');
  await page.click('.modal-foot .btn.primary'); await sleep(300); await shot('d-12-estimate-active');
  // 수직선 탭: 축의 30% 지점
  const ln = await page.locator('.kit-line').boundingBox();
  if (ln) { await page.mouse.click(ln.x + ln.width * 0.3, ln.y + ln.height * 0.45); await sleep(600); await shot('d-13-estimate-feedback'); }
  await page.click('[data-action=estimate]'); await sleep(200);
  // 커튼
  await page.click('#btn-curtain'); await sleep(200); await shot('d-14-curtain-on'); await page.click('#btn-curtain'); await sleep(100);
  // 펜
  await page.click('#btn-pen'); await sleep(200);
  const bar = await page.locator('.kit-bar').boundingBox();
  if (bar) { await page.mouse.move(bar.x + 20, bar.y + 20); await page.mouse.down(); await page.mouse.move(bar.x + bar.width - 40, bar.y + 30, { steps: 10 }); await page.mouse.up(); }
  await page.click('[data-pen=hl]'); if (bar) { await page.mouse.move(bar.x + 30, bar.y + 60); await page.mouse.down(); await page.mouse.move(bar.x + 300, bar.y + 62, { steps: 8 }); await page.mouse.up(); }
  await sleep(200); await vshot('d-15-pen-on');
  await page.click('[data-pen=off]'); await sleep(150);
  // 장면 저장 모달
  await page.click('.toolbar [data-action=save-scene]'); await sleep(300); await shot('d-16-save-scene-modal');
  // 검증 오류(빈 이름으로 저장)
  await page.fill('#sv-name', ''); await page.click('.modal-foot .btn.primary'); await sleep(200); await vshot('d-17-save-scene-error');
  await esc();
  // 모델 끄기(막대만)
  await act('__app.actions.kitSetD(6); __app.actions.kitSetN(4)');
  await page.uncheck('[data-model-toggle=circle]'); await page.uncheck('[data-model-toggle=line]'); await sleep(200); await shot('d-18-kit-bar-only');
  await page.check('[data-model-toggle=circle]'); await page.check('[data-model-toggle=line]');

  // ---- 비교·통분 ----
  await tab('compare'); await shot('d-20-compare-initial'); await measure('d-compare');
  await act("__app.actions.compareSet('a',2,3); __app.actions.compareSet('b',3,5)"); await sleep(200);
  await act('__app.actions.compareOverlay()'); await sleep(300); await shot('d-21-compare-overlay');
  await act('__app.actions.compareOverlay()');
  await act('__app.actions.compareStart()'); await sleep(700); await shot('d-22-compare-step1');
  await act('__app.actions.compareNext()'); await sleep(700); await act('__app.actions.compareNext()'); await sleep(700); await shot('d-23-compare-step3');
  // 같은 분모 토스트
  await page.click('[data-action=cmp-reset]'); await act("__app.actions.compareSet('a',2,5); __app.actions.compareSet('b',4,5)"); await sleep(200);
  await act('__app.actions.compareStart()'); await sleep(300); await vshot('d-24-compare-same-d-toast');
  // 큰 L (11 vs 12)
  await page.click('[data-action=cmp-reset]'); await act("__app.actions.compareSet('a',7,11); __app.actions.compareSet('b',8,12)"); await sleep(200);
  await act('__app.actions.compareStart()'); await sleep(700); await act('__app.actions.compareNext()'); await sleep(700); await act('__app.actions.compareNext()'); await sleep(700); await shot('d-25-compare-L132');
  // 키패드 모달
  await page.locator('[data-action=compare-keypad][data-who=a]').click(); await sleep(300); await shot('d-26-keypad-modal');
  await page.click('.kp-pad [data-k="7"]'); await page.click('.kp-pad [data-k="1"]'); await page.click('.kp-pad [data-k="5"]'); await sleep(200); await vshot('d-27-keypad-invalid');
  await esc();

  // ---- 덧셈·뺄셈 ----
  await tab('arith'); await shot('d-30-arith-initial'); await measure('d-arith');
  await act("__app.actions.arithSet('a',1,2); __app.actions.arithSet('b',1,3); __app.actions.arithOp('+')"); await sleep(200);
  await act('__app.actions.arithNext()'); await sleep(900); await shot('d-31-arith-step1');
  await act('__app.actions.arithNext()'); await sleep(900); await shot('d-32-arith-step2');
  await act('__app.actions.arithNext()'); await sleep(900); await shot('d-33-arith-result');
  await act('__app.actions.arithMirror()'); await sleep(500); await shot('d-34-arith-mirror');
  // 3/4 + 3/4 (대분수·약분)
  await page.click('[data-action=ar-reset]'); await act("__app.actions.arithSet('a',3,4); __app.actions.arithSet('b',3,4); __app.actions.arithOp('+')"); await sleep(200);
  for (let i = 0; i < 4; i++) { await act('__app.actions.arithNext()'); await sleep(900); }
  await shot('d-35-arith-mixed-reduce');
  // 뺄셈 A<B 모달
  await page.click('[data-action=ar-reset]'); await act("__app.actions.arithSet('a',1,3); __app.actions.arithSet('b',1,2); __app.actions.arithOp('-')"); await sleep(200);
  await page.click('[data-action=ar-next]'); await sleep(300); await shot('d-36-arith-swap-modal');
  await page.click('.modal-foot .btn.primary'); await sleep(400);
  for (let i = 0; i < 3; i++) { await act('__app.actions.arithNext()'); await sleep(900); }
  await shot('d-37-arith-sub-result');
  // 뺄셈 오개념 거울(음수)
  await page.click('[data-action=ar-reset]'); await act("__app.actions.arithSet('a',5,6); __app.actions.arithSet('b',2,6); __app.actions.arithOp('-')"); await sleep(200);
  for (let i = 0; i < 3; i++) { await act('__app.actions.arithNext()'); await sleep(900); }
  await act('__app.actions.arithMirror()'); await sleep(400); await shot('d-38-arith-sub-mirror');

  // ---- 탐구 카드 ----
  await tab('cards'); await shot('d-40-cards-initial'); await measure('d-cards');
  await act("__app.actions.selectCard('c3-03')"); await sleep(300); await shot('d-41-card-c3-03-curtain');
  await act('__app.actions.predict(1)'); await sleep(200); await shot('d-42-card-predicted');
  await act('__app.actions.setTally([9,12,3])'); await sleep(200);
  await act('__app.actions.confirmCard()'); await sleep(2800); await shot('d-43-card-revealed-wrong');
  await act("__app.actions.selectCard('c5-05')"); await act('__app.actions.predict(0)'); await act('__app.actions.confirmCard()'); await sleep(4500); await shot('d-44-card-arith-revealed-ok');
  await act("__app.actions.selectCard('c3-01')"); await sleep(300); await shot('d-45-card-make-circle');
  await act("__app.actions.selectCard('c5-02')"); await act('__app.actions.predict(0)'); await act('__app.actions.confirmCard()'); await sleep(2500); await shot('d-46-card-split-revealed');
  // 편집 모달 / 새 카드 / 세트 저장 / 삭제 모달
  await page.locator('[data-edit="c3-03"]').click(); await sleep(300); await shot('d-47-card-edit-modal');
  await page.fill('#ef-choices [data-ch="0"]', ''); await page.dispatchEvent('#ef-choices [data-ch="0"]', 'input'); await sleep(200); await vshot('d-48-card-edit-invalid');
  await esc();
  await page.click('[data-action=card-new]'); await sleep(300); await shot('d-49-card-new-modal'); await esc();
  await page.click('[data-action=set-save]'); await sleep(300); await vshot('d-50-set-save-modal'); await esc();
  await page.locator('[data-del="c3-03"]').click(); await sleep(300); await vshot('d-51-card-delete-modal'); await esc();
  // 세트 선택, 학년 필터, 검색 없음
  await page.selectOption('#card-set', { index: 1 }); await sleep(300); await shot('d-52-cards-set');
  await page.fill('#card-search', 'zzzz'); await page.dispatchEvent('#card-search', 'input'); await sleep(200); await vshot('d-53-cards-search-empty'); await page.fill('#card-search', ''); await page.dispatchEvent('#card-search', 'input');
  await page.selectOption('#card-set', { index: 0 });
  // 학생 모드
  await act('__app.actions.setTeacher(false)'); await sleep(300); await shot('d-54-cards-student-mode'); await act('__app.actions.setTeacher(true)'); await sleep(200);

  // ---- 장면 보관함 ----
  await tab('scenes'); await shot('d-60-scenes'); await measure('d-scenes');
  await page.locator('[data-sc=rename]').first().click(); await sleep(300); await vshot('d-61-scene-rename-modal'); await esc();
  await page.locator('[data-sc=del]').first().click(); await sleep(300); await vshot('d-62-scene-delete-modal'); await esc();
  await page.locator('.scene-tools [data-action=reset-samples]').click(); await sleep(300); await vshot('d-63-restore-modal'); await esc();
  await page.fill('#scene-search', 'zzzz'); await page.dispatchEvent('#scene-search', 'input'); await sleep(200); await vshot('d-64-scenes-search-empty'); await page.fill('#scene-search', ''); await page.dispatchEvent('#scene-search', 'input');
  await act("__app.actions.importJson('not json at all')"); await sleep(300); await vshot('d-65-import-error-toast');
  const exported = await act('__app.actions.exportJson()');
  if (exported) { await sleep(2600); await act(`__app.actions.importJson(${JSON.stringify(typeof exported === 'string' ? exported : JSON.stringify(exported))})`); await sleep(400); await vshot('d-66-import-dup-toast'); await esc(); await esc(); }
  // 불러오기 → 메모 패널
  await page.locator('[data-sc=load]').nth(2).click({ force: true }); await sleep(400); await shot('d-67-scene-loaded-memo');
  // 빈 상태
  await act("localStorage.setItem('edu.fraction-kit.scenes', '[]')"); await page.reload({ waitUntil: 'load' }); await sleep(600); await tab('scenes'); await shot('d-68-scenes-empty');
  await act('__app.actions.resetSamples()'); await sleep(400); await vshot('d-69-after-restore-toast');

  // ---- 활동지 ----
  await tab('sheet'); await shot('d-70-sheet-initial'); await measure('d-sheet');
  await page.check('#ws-answers'); await page.check('#ws-blanks'); await sleep(300); await shot('d-71-sheet-answers-blanks');
  await page.check('#ws-bw'); await page.selectOption('#ws-model', 'circle'); await sleep(300); await shot('d-72-sheet-bw-circle');
  await page.uncheck('#ws-bw'); await page.selectOption('#ws-model', 'bar');
  // 카드 6장 추가 → 2쪽 이상
  for (const id of ['c3-03', 'c4-01', 'c4-02', 'c5-02', 'c5-06', 'c3-07']) await act(`__app.actions.sheetAddCard('${id}')`);
  await sleep(400); await shot('d-73-sheet-14-items');
  await page.emulateMedia({ media: 'print' }); await sleep(300); await shot('d-74-sheet-print-media'); await page.emulateMedia({ media: 'screen' }); await sleep(200);
  await page.click('[data-action=sheet-clear]'); await sleep(300); await vshot('d-75-sheet-clear-modal');
  await page.click('.modal-foot .btn.primary'); await sleep(300); await shot('d-76-sheet-empty');
  // 빠른 문항 키패드
  await page.click('[data-action=qa-a]'); await sleep(300); await vshot('d-77-sheet-quick-keypad'); await esc();
  await page.selectOption('#qa-type', 'arith'); await sleep(200); await vshot('d-78-sheet-quick-arith');
  await act('__app.actions.resetSamples()'); await sleep(300); await page.reload({ waitUntil: 'load' }); await sleep(600);

  // ---- 칠판 모드 / 학년 프리셋 ----
  await tab('kit'); await act('__app.actions.setBoard(true)'); await sleep(300); await shot('d-80-board-kit'); await measure('d-board-kit');
  await tab('compare'); await act("__app.actions.compareSet('a',2,3); __app.actions.compareSet('b',3,5)"); await sleep(200); await shot('d-81-board-compare');
  await tab('cards'); await act("__app.actions.selectCard('c3-03')"); await sleep(300); await shot('d-82-board-cards');
  await tab('kit'); await page.setViewportSize({ width: 1920, height: 1080 }); await sleep(300); await vshot('d-83-board-kit-1920');
  await page.setViewportSize({ width: 1280, height: 800 }); await act('__app.actions.setBoard(false)'); await sleep(200);
  await act('__app.actions.setGrade(3)'); await sleep(300); await vshot('d-84-grade3-preset'); await act('__app.actions.setGrade(null)'); await sleep(200);
  // 전체화면 대체
  await page.click('#btn-fs'); await sleep(400); await vshot('d-85-fullscreen'); await page.keyboard.press('Escape'); await sleep(200);
  if (await act("document.fullscreenElement ? 1 : 0")) await act('document.exitFullscreen()');
  await act("document.documentElement.dataset.fs='off'");
  // 저장 배너
  await act("document.getElementById('save-banner').hidden=false"); await sleep(100); await vshot('d-86-save-banner'); await act("document.getElementById('save-banner').hidden=true");

  // ============ 데스크톱 다크 ============
  await setTheme('dark'); await page.reload({ waitUntil: 'load' }); await sleep(600);
  await tab('kit'); await act('__app.actions.kitSetD(8); __app.actions.kitSetN(3)'); await page.click('#btn-x2'); await sleep(600); await shot('k-01-kit-dark');
  await page.click('.toolbar [data-action=help]'); await sleep(300); await vshot('k-02-help-dark'); await esc();
  await tab('compare'); await act("__app.actions.compareSet('a',2,3); __app.actions.compareSet('b',3,5); __app.actions.compareOverlay()"); await sleep(200);
  await act('__app.actions.compareStart()'); await sleep(700); await act('__app.actions.compareNext()'); await sleep(700); await act('__app.actions.compareNext()'); await sleep(700); await shot('k-03-compare-dark');
  await page.locator('[data-action=compare-keypad][data-who=a]').click(); await sleep(300); await vshot('k-04-keypad-dark'); await esc();
  await tab('arith'); await act("__app.actions.arithSet('a',1,2); __app.actions.arithSet('b',1,3); __app.actions.arithOp('+')");
  for (let i = 0; i < 3; i++) { await act('__app.actions.arithNext()'); await sleep(900); }
  await act('__app.actions.arithMirror()'); await sleep(400); await shot('k-05-arith-mirror-dark');
  await tab('cards'); await act("__app.actions.selectCard('c3-03')"); await act('__app.actions.setTally([9,12,3])'); await act('__app.actions.predict(1)'); await act('__app.actions.confirmCard()'); await sleep(2800); await shot('k-06-cards-dark');
  await page.locator('[data-edit="c3-03"]').click(); await sleep(300); await vshot('k-07-card-edit-dark'); await esc();
  await tab('scenes'); await shot('k-08-scenes-dark');
  await page.click('.toolbar [data-action=save-scene]'); await sleep(300); await vshot('k-09-save-modal-dark'); await esc();
  await tab('sheet'); await page.check('#ws-answers'); await sleep(300); await shot('k-10-sheet-dark');
  await tab('kit'); await page.click('#btn-curtain'); await page.click('#btn-pen'); await sleep(200); await vshot('k-11-curtain-pen-dark'); await page.click('[data-pen=off]'); await page.click('#btn-curtain');
  await act("__app.actions.importJson('x')"); await sleep(300); await vshot('k-12-toast-dark');
  await act('__app.actions.setBoard(true)'); await sleep(300); await vshot('k-13-board-while-dark'); await act('__app.actions.setBoard(false)');
  await setTheme('light');

  // ============ 태블릿 820 ============
  await page.setViewportSize({ width: 820, height: 1180 }); await page.reload({ waitUntil: 'load' }); await sleep(600);
  await tab('kit'); await shot('t-01-kit'); await measure('t-kit');
  await tab('compare'); await act("__app.actions.compareSet('a',2,3); __app.actions.compareSet('b',3,5); __app.actions.compareStart()"); await sleep(700); await shot('t-02-compare');
  await tab('arith'); await shot('t-03-arith');
  await tab('cards'); await act("__app.actions.selectCard('c3-03')"); await sleep(300); await shot('t-04-cards');
  await tab('scenes'); await shot('t-05-scenes');
  await tab('sheet'); await shot('t-06-sheet');

  // ============ 모바일 400 ============
  await page.setViewportSize({ width: 400, height: 800 }); await page.reload({ waitUntil: 'load' }); await sleep(600);
  await tab('kit'); await shot('m-01-kit-full'); await vshot('m-01v-kit-top'); await measure('m-kit');
  await page.click('.ctrl-toggle'); await sleep(300); await vshot('m-02-kit-ctrl-open');
  await page.evaluate(() => document.querySelector('.ctrl').scrollTop = 9999); await sleep(150); await vshot('m-03-kit-ctrl-open-scrolled');
  await page.click('.ctrl-toggle'); await sleep(200);
  await page.click('[data-model-tab=circle]'); await sleep(200); await vshot('m-04-kit-circle-tab');
  await page.click('[data-model-tab=line]'); await sleep(200); await vshot('m-05-kit-line-tab');
  await page.evaluate(() => window.scrollTo(0, 9999)); await sleep(150); await vshot('m-06-kit-bottom');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.toolbar [data-action=help]'); await sleep(300); await vshot('m-07-help-modal'); await esc();
  await page.click('#more-menu summary'); await sleep(200); await vshot('m-08-more-menu'); await page.click('#more-menu summary');
  await page.click('.toolbar [data-action=save-scene]'); await sleep(300); await vshot('m-09-save-modal'); await esc();
  await page.click('#btn-pen'); await sleep(200); await vshot('m-10-pen-tools'); await page.click('[data-pen=off]');
  await page.click('.ctrl-toggle'); await sleep(200); await page.click('[data-action=estimate]'); await sleep(300); await vshot('m-11-estimate-modal'); await esc(); await page.click('.ctrl-toggle'); await sleep(100);
  await tab('compare'); await act("__app.actions.compareSet('a',2,3); __app.actions.compareSet('b',3,5); __app.actions.compareOverlay()"); await sleep(200);
  await act('__app.actions.compareStart()'); await sleep(700); await act('__app.actions.compareNext()'); await sleep(700); await act('__app.actions.compareNext()'); await sleep(700);
  await shot('m-12-compare-full'); await measure('m-compare');
  await page.locator('[data-action=compare-keypad][data-who=a]').click(); await sleep(300); await vshot('m-13-keypad'); await esc();
  await tab('arith'); await act("__app.actions.arithSet('a',1,2); __app.actions.arithSet('b',1,3); __app.actions.arithOp('+')");
  for (let i = 0; i < 3; i++) { await act('__app.actions.arithNext()'); await sleep(900); }
  await act('__app.actions.arithMirror()'); await sleep(400); await shot('m-14-arith-full'); await measure('m-arith');
  await tab('cards'); await act("__app.actions.selectCard('c3-03')"); await act('__app.actions.setTally([9,12,3])'); await act('__app.actions.predict(1)'); await sleep(200); await shot('m-15-cards-full'); await measure('m-cards');
  await act('__app.actions.confirmCard()'); await sleep(2800); await shot('m-16-cards-revealed');
  await page.locator('[data-edit="c3-03"]').click(); await sleep(300); await vshot('m-17-card-edit'); await esc();
  await tab('scenes'); await shot('m-18-scenes-full'); await measure('m-scenes');
  await tab('sheet'); await shot('m-19-sheet-full'); await measure('m-sheet');
  await act('__app.actions.setBoard(true)'); await tab('kit'); await sleep(300); await vshot('m-20-board-kit'); await measure('m-board'); await act('__app.actions.setBoard(false)');
  await setTheme('dark'); await sleep(200); await tab('kit'); await vshot('m-21-kit-dark'); await tab('cards'); await vshot('m-22-cards-dark'); await setTheme('light');

  // 360px 극소 폭
  await page.setViewportSize({ width: 360, height: 740 }); await page.reload({ waitUntil: 'load' }); await sleep(500);
  await tab('kit'); await vshot('s-01-kit-360'); await measure('s-kit-360');
  await tab('compare'); await vshot('s-02-compare-360'); await measure('s-compare-360');

  log('METRICS ' + JSON.stringify(metrics));
  expect(!Object.values(metrics).some(m => m.overflow), '가로 스크롤 없음(모든 뷰)');
};
