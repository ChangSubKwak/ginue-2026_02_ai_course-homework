// func-robustness.js — 저장 불가(AC14)·세션 입력 경합·손그림 캔버스·인쇄 버튼·키보드/모달 규칙·되새김 정렬·큐 정렬 증거 (pw-run.js용)
'use strict';
const path = require('path');
module.exports = async ({ page, ctx, expect, shot, log, sleep, reload }) => {
  const txt = async sel => (await page.locator(sel).first().textContent()) || '';
  const st = () => page.evaluate(() => window.__app.getState());
  const visible = async sel => (await page.locator(sel).count()) > 0 && await page.locator(sel).first().isVisible();
  const modal = () => page.locator('.modal').last();
  const prog = async () => (await txt('.session-top .num')).replace(/\s/g, '');
  const outdir = path.join(__dirname, 'qa2-robust');
  let s = await st(); const today = s.today;

  /* ---- 오늘 큐 정렬 증거(스펙: 밀린 카드 먼저) ---- */
  const q = s.queue.map(id => s.data.cards.find(c => c.id === id));
  log('큐 due 순서: ' + q.map(c => c.due).join(','));
  expect(q[0].due < today && q[1].due < today && q[2].due < today, '[스펙] 오늘 큐 맨 앞 3장이 밀린 카드 (실제 첫 3장 due: ' + q.slice(0, 3).map(c => c.due).join(',') + ')');

  /* ---- 진행 표시(현재/전체)와 진행 바 ---- */
  await page.click('[data-action="start-today"]'); await sleep(300);
  expect(await prog() === '1/11', '세션 시작 진행 1/11');
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(250);
  await page.click('#grade-btns [data-ok="1"]'); await sleep(700);
  const p1 = await prog(), bar1 = await page.locator('.session-top .progress > i').getAttribute('style');
  expect(p1 === '2/11', '[결함] 1장 처리 후 진행 표시 2/11 (실제 ' + p1 + ', 바 ' + bar1 + ')');
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(250);
  await page.click('#grade-btns [data-ok="1"]'); await sleep(700);
  const pr2 = await prog();
  expect(pr2 === '3/11', '[결함] 2장 처리 후 진행 표시 3/11 (실제 ' + pr2 + ')');
  // 중단 → 이어서 하기 시에는 올바른가
  await page.keyboard.press('Escape'); await sleep(300);
  await page.click('[data-action="resume"]'); await sleep(300);
  expect(await prog() === '3/11', '이어서 하기 진행 3/11 (실제 ' + await prog() + ')');
  await page.keyboard.press('Escape'); await sleep(300);

  /* ---- 상자 이동 애니메이션 중 키 입력 경합: →를 빠르게 두 번 ---- */
  s = await st();
  const memo2 = s.data.cards.filter(c => c.type === 'memo' && c.box === 2 && !s.queue.includes(c.id)).slice(0, 3).map(c => c.id);
  await page.evaluate(ids => window.__app.actions.startSession('deck', ids), memo2); await sleep(300);
  await page.keyboard.press('3'); await page.keyboard.press('Space'); await sleep(300);
  const frontShown = await txt('.face-front .face-text');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await sleep(900);
  s = await st();
  const res = s.session ? s.session.results : [];
  log('빠른 →→ 후 results=' + res.length + ' idx=' + (s.session && s.session.idx) + ' fronts=' + res.map(r => r.front).join(' | ') + ' (화면에 보였던 카드: ' + frontShown.trim() + ')');
  expect(res.length === 1, '[결함] 애니메이션 중 두 번째 → 키는 무시되어야 함(화면에 안 보인 다음 카드가 채점되면 안 됨) (실제 채점 ' + res.length + '장)');
  const second = s.data.cards.find(c => c.id === memo2[1]);
  expect(!(second.history.length && second.history.slice(-1)[0].d === today && res.length > 1), '[결함] 보지 않은 두 번째 카드에 history가 남지 않음');
  await page.keyboard.press('Escape'); await sleep(300);
  // 정리: pendingSession 제거(새로 시작 → 바로 종료)
  if (await visible('[data-action="restart"]')) { await page.click('[data-action="restart"]'); await sleep(300); }
  if (await visible('#session')) { await page.click('[data-action="end-session"]'); await sleep(300); }

  /* ---- 뒤집기 전 ←/→ 무시, 모달 열림 중 단축키 무시 ---- */
  await page.evaluate(ids => window.__app.actions.startSession('deck', ids), memo2.slice(2)); await sleep(300);
  await page.keyboard.press('ArrowRight'); await sleep(200);
  s = await st(); expect(s.session && s.session.results.length === 0 && (await page.locator('#flip-card.flipped').count()) === 0, '뒤집기 전 → 키 무시');
  await page.keyboard.press('Space'); await sleep(100);
  expect((await page.locator('#flip-card.flipped').count()) === 0, '확신도 전 Space 무시');
  await page.click('[data-action="end-session"]'); await sleep(300);
  expect(await page.locator('#session').isHidden() && (await st()).data.pendingSession === null, 'X 버튼으로 종료(결과 0장 → pending 없음)');

  /* ---- 손그림 캔버스 → 카드 저장 → 세션 뒷면·인쇄에 표시 ---- */
  await page.click('#tab-home'); await sleep(100);
  await page.click('.fab'); await sleep(200);
  await page.click('.modal [data-draw="open"]'); await sleep(250);
  expect((await page.locator('.modal').count()) === 2 && (await modal().locator('.modal-title').textContent()).includes('손그림') && (await page.locator('.modal canvas').count()) === 1, '그림 추가 → 캔버스 모달(320×200)');
  const cv = page.locator('.modal canvas');
  const b = await cv.boundingBox();
  const cvAttr = await cv.evaluate(c => [c.width, c.height]);
  expect(cvAttr[0] === 320 && cvAttr[1] === 200 && Math.abs(b.width - 320) <= 2 && Math.abs(b.height - 200) <= 2, '캔버스 크기 320×200 (속성 ' + cvAttr.join('×') + ', 표시 ' + Math.round(b.width) + '×' + Math.round(b.height) + ')');
  const draw = async (x1, y1, x2, y2) => { await page.mouse.move(b.x + x1, b.y + y1); await page.mouse.down(); await page.mouse.move(b.x + x2, b.y + y2, { steps: 8 }); await page.mouse.up(); };
  const pix = () => page.evaluate(() => { const c = document.querySelector('.modal canvas'); const d = c.getContext('2d').getImageData(0, 0, 320, 200).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) n++; return n; });
  await draw(20, 20, 200, 120);
  const n1 = await pix(); expect(n1 > 100, '검정 펜 드로잉 픽셀 ' + n1);
  await page.click('.modal [data-t="pen-red"]'); await page.click('.modal [data-t="w-thick"]'); await draw(40, 150, 280, 150);
  const red = await page.evaluate(() => { const c = document.querySelector('.modal canvas'); const d = c.getContext('2d').getImageData(0, 0, 320, 200).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 100 && d[i + 2] < 100) n++; return n; });
  expect(red > 100, '빨강 굵은 펜 픽셀 ' + red);
  await page.click('.modal [data-t="undo"]'); await sleep(50);
  const afterUndo = await pix(); expect(afterUndo < n1 + 50 && afterUndo >= n1 - 50, '되돌리기 → 빨강 선 제거 (' + afterUndo + ' ≈ ' + n1 + ')');
  await page.click('.modal [data-t="eraser"]'); await draw(20, 20, 200, 120); await sleep(50);
  const afterErase = await pix(); expect(afterErase < n1, '지우개로 픽셀 감소 (' + n1 + '→' + afterErase + ')');
  await page.click('.modal [data-t="clear"]'); await sleep(50);
  expect((await pix()) === 0, '전체 지우기 → 0픽셀');
  await page.click('.modal [data-t="undo"]'); await sleep(50);
  expect((await pix()) === afterErase, '전체 지우기도 되돌리기 가능');
  await page.click('.modal [data-t="pen-black"]'); await draw(10, 10, 300, 190);
  await modal().locator('[data-value="true"]').click(); await sleep(300);
  expect((await page.locator('.modal').count()) === 1 && (await page.locator('.modal .drawing-thumb').count()) === 1 && (await txt('.modal [data-draw="open"]')).includes('그림 수정'), '그림 저장 → 카드 모달에 썸네일·"그림 수정"');
  await page.fill('#cd-front', '그림 카드 앞면'); await page.fill('#cd-back', '그림 카드 뒷면');
  await modal().locator('[data-value="true"]').click(); await sleep(300);
  s = await st();
  const dc = s.data.cards.find(c => c.front === '그림 카드 앞면');
  expect(!!dc && typeof dc.drawing === 'string' && dc.drawing.startsWith('data:image/jpeg') && dc.drawing.length > 500 && dc.drawing.length < 60000, '카드에 JPEG dataURL 저장 (' + (dc && dc.drawing.length) + '자)');
  await reload(); s = await st();
  expect(!!s.data.cards.find(c => c.front === '그림 카드 앞면' && c.drawing && c.drawing.startsWith('data:image/jpeg')), '새로고침 후 그림 유지');
  await page.click('#tab-cards'); await sleep(150); if (await visible('[data-action="back-decks"]')) { await page.click('[data-action="back-decks"]'); await sleep(150); }
  await page.click('[data-action="all-cards"]'); await sleep(150); await page.fill('#card-q', '그림 카드'); await sleep(150);
  expect((await txt('#card-list .card-row .meta')).includes('그림'), '카드 목록에 그림 배지');
  await page.evaluate(id => window.__app.actions.startSession('deck', [id]), dc.id); await sleep(300);
  await page.click('#conf-btns [data-c="2"]'); await page.click('#flip-btn'); await sleep(300);
  expect((await page.locator('.face-back img.drawing').count()) === 1 && (await page.locator('.face-back img.drawing').getAttribute('src')).startsWith('data:image/jpeg'), '세션 뒷면에 손그림 표시');
  await shot('r01-drawing-back');
  await page.keyboard.press('Escape'); await sleep(300);
  await page.click('#tab-print'); await sleep(150);
  await page.click(`[data-action="print-deck"][data-id="${dc.deckId}"]`); await sleep(150);
  await page.click('[data-action="print-preview"]'); await sleep(400);
  expect((await page.locator('#print-area .pcard img').count()) >= 1, '인쇄 양면 뒷면에 손그림 포함');
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click('[data-action="print-now"]'); await sleep(100);
  expect((await page.evaluate(() => window.__printed)) === 1, '"인쇄" 버튼이 window.print() 호출');
  await page.keyboard.press('Escape'); await sleep(150);
  expect(await page.locator('#print-view').isHidden(), 'ESC로 인쇄 미리보기 닫힘');
  // 손그림 포함 옵션 끄면 인쇄물에서 제외, 제목 칸 옵션, 유형 필터
  await page.uncheck('input[data-action="print-opt"][data-key="drawing"]'); await page.uncheck('input[data-action="print-opt"][data-key="title"]'); await sleep(100);
  await page.click('[data-action="print-preview"]'); await sleep(300);
  expect((await page.locator('#print-area .pcard img').count()) === 0, '손그림 포함 옵션 해제 → 인쇄물에서 제외');
  expect((await page.locator('#print-area .page-title').count()) === 0, '제목·이름 칸 옵션 해제 → 페이지 제목 없음');
  await page.click('[data-action="print-back"]'); await sleep(150);
  s = await st();
  const selDeck = dc.deckId, wrongN = s.data.cards.filter(c => c.deckId === selDeck && c.type === 'wrong').length, memoN = s.data.cards.filter(c => c.deckId === selDeck && c.type === 'memo').length;
  await page.click('[data-action="print-type"][data-val="wrong"]'); await sleep(150);
  expect((await txt('#view-print')).includes(`선택 ${wrongN}장`), '인쇄 유형 필터 오답 → ' + wrongN + '장');
  await page.click('[data-action="print-type"][data-val="memo"]'); await sleep(150);
  expect((await txt('#view-print')).includes(`선택 ${memoN}장`), '인쇄 유형 필터 암기 → ' + memoN + '장');
  await page.click('[data-action="print-type"][data-val="all"]'); await sleep(100);
  // 저장 불가 배너의 "설정으로" 버튼(평소엔 숨김) 존재 확인
  expect((await page.locator('#storage-banner [data-action="goto"][data-view="settings"]').count()) === 1 && await page.locator('#storage-banner').isHidden(), '저장 배너는 평소 숨김·설정 바로가기 포함');

  /* ---- 되새김 목록 정렬(날짜 역순) ---- */
  await page.click('#tab-history'); await sleep(200);
  const refDates = await page.$$eval('#reflect-list .reflect-item .small', els => els.map(e => e.textContent.slice(0, 10)));
  expect(refDates.every((d, i) => i === 0 || refDates[i - 1] >= d), '[스펙] 되새김 목록 날짜 역순 (실제: ' + refDates.join(' > ') + ')');

  /* ---- 모달 규칙: ESC 닫기·배경 클릭·포커스 복귀·Tab 트랩 ---- */
  await page.click('#tab-cards'); await sleep(150); if (await visible('[data-action="back-decks"]')) { await page.click('[data-action="back-decks"]'); await sleep(150); }
  await page.click('[data-action="new-deck"]'); await sleep(200);
  expect((await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'dk-name', '덱 모달 열리면 이름 입력에 포커스');
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.modal')), 'Tab 12회 후 포커스가 모달 안');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.modal')), 'Shift+Tab 후에도 모달 안');
  await page.mouse.click(5, 5); await sleep(200);
  expect(!(await visible('.modal')), '배경 클릭으로 모달 닫힘');
  expect((await page.evaluate(() => document.activeElement && document.activeElement.dataset.action)) === 'new-deck', '닫힌 뒤 포커스가 연 버튼으로 복귀');
  await page.click('[data-action="new-deck"]'); await sleep(150); await page.keyboard.press('Escape'); await sleep(150);
  expect(!(await visible('.modal')), 'ESC로 모달 닫힘');
  // 모달 안 비포커스 영역(제목 글자)을 클릭한 뒤 ESC → 포커스가 body로 빠져 keydown이 모달에 닿지 않는지
  await page.click('[data-action="new-deck"]'); await sleep(150);
  await page.click('.modal-title'); await sleep(50);
  const ae = await page.evaluate(() => (document.activeElement && (document.activeElement.tagName + '#' + document.activeElement.id)) || 'none');
  await page.keyboard.press('Escape'); await sleep(150);
  const closedAfterClick = !(await visible('.modal'));
  expect(closedAfterClick, '[a11y] 모달 제목을 클릭한 뒤에도 ESC로 닫힘 (클릭 후 활성 요소: ' + ae + ')');
  if (!closedAfterClick) {
    await page.keyboard.press('Tab'); await sleep(50);
    const esc = await page.evaluate(() => !document.activeElement.closest('.modal'));
    expect(!esc, '[a11y] 모달 제목 클릭 후 Tab 포커스가 모달 밖으로 나가지 않음');
    await page.click('.modal-x'); await sleep(150);
  }
  // 모달 안 input 포커스 중 세션 단축키 비활성: 세션 중 요약 모달이 아닌 일반 모달은 열 수 없으므로, 세션 중 활성 요소가 BUTTON일 때 숫자키 동작·입력란이면 무시를 DOM으로 검증
  await page.evaluate(id => window.__app.actions.startSession('deck', [id]), dc.id); await sleep(300);
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'tmp-in'; document.querySelector('.session').appendChild(i); i.focus(); });
  await page.keyboard.press('3'); await sleep(100);
  expect((await page.locator('#conf-btns [aria-pressed="true"]').count()) === 0, '입력란 포커스 중 숫자키 무시');
  await page.evaluate(() => { document.getElementById('tmp-in').remove(); });
  await page.keyboard.press('3'); await sleep(100);
  expect((await page.locator('#conf-btns [data-c="3"][aria-pressed="true"]').count()) === 1, '입력란 제거 후 숫자키 동작');
  await page.keyboard.press('Escape'); await sleep(300);
  await shot('r02-after-modal-tests');

  /* ---- AC14 localStorage.setItem 예외 → 배너 + 메모리 모드 동작(새 페이지에서 초기화 스크립트로 주입) ---- */
  const p2 = await ctx.newPage();
  const errs = []; p2.on('pageerror', e => errs.push(e.message)); p2.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p2.addInitScript(() => { Storage.prototype.setItem = function () { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }; });
  await p2.goto(page.url(), { waitUntil: 'load' }); await p2.waitForTimeout(700);
  expect(!(await p2.locator('#storage-banner').isHidden()) && (await p2.locator('#storage-banner').textContent()).includes('저장이 되지 않아요'), 'AC14 상단 "저장이 되지 않아요" 배너');
  expect((await p2.locator('#toast-root .toast').allTextContents()).some(t => t.includes('저장이 되지 않아요')), 'AC14 저장 불가 토스트');
  const home14 = await p2.locator('#view-home').textContent();
  expect(/오늘 복습 \d+장/.test(home14), 'AC14 메모리 모드에서도 샘플/홈 표시 (' + (home14.match(/오늘 복습 \d+장/) || [''])[0] + ')');
  const s14a = await p2.evaluate(() => window.__app.getState()); const rv0 = (s14a.data.dailyLog[s14a.today] || {}).reviewed || 0;
  if (await p2.locator('[data-action="start-today"]').isVisible()) await p2.click('[data-action="start-today"]'); else await p2.click('[data-action="restart"]');
  await p2.waitForTimeout(300);
  await p2.click('#conf-btns [data-c="3"]'); await p2.click('#flip-btn'); await p2.waitForTimeout(250); await p2.click('#grade-btns [data-ok="1"]'); await p2.waitForTimeout(700);
  const s14 = await p2.evaluate(() => window.__app.getState());
  expect(s14.data.dailyLog[s14.today] && s14.data.dailyLog[s14.today].reviewed === rv0 + 1 && s14.session && s14.session.results.length === 1, 'AC14 복습 1장 처리됨(메모리, reviewed ' + rv0 + '→' + ((s14.data.dailyLog[s14.today] || {}).reviewed) + ')');
  await p2.keyboard.press('Escape'); await p2.waitForTimeout(300);
  await p2.click('.fab'); await p2.waitForTimeout(200);
  await p2.fill('#cd-front', '메모리 모드 카드'); await p2.fill('#cd-back', '뒷면'); await p2.locator('.modal [data-value="true"]').click(); await p2.waitForTimeout(300);
  const s14b = await p2.evaluate(() => window.__app.getState());
  expect(s14b.data.cards.some(c => c.front === '메모리 모드 카드'), 'AC14 카드 추가 동작(메모리)');
  await p2.click('#tab-settings'); await p2.waitForTimeout(200);
  expect((await p2.locator('#view-settings').textContent()).includes('저장 불가 상태'), '설정에 저장 불가 상태 표시');
  await p2.screenshot({ path: path.join(outdir, 'r03-storage-fail.png'), fullPage: true });
  expect(errs.length === 0, 'AC14 저장 불가 상태에서 페이지/콘솔 오류 없음 (' + errs.join(' | ') + ')');
  await p2.close();

  /* ---- 새 페이지(같은 컨텍스트)에서 데이터 공유·복원 확인 ---- */
  const p3 = await ctx.newPage(); await p3.goto(page.url(), { waitUntil: 'load' }); await p3.waitForTimeout(500);
  const s3 = await p3.evaluate(() => window.__app.getState());
  expect(s3.data.cards.some(c => c.front === '그림 카드 앞면') && !s3.data.cards.some(c => c.front === '메모리 모드 카드'), '정상 페이지: 저장된 카드 복원·메모리 모드 카드는 저장되지 않음');
  await p3.close();
};
