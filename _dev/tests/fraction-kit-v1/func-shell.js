// func-shell.js — 앱 셸(탭·툴바·도움말·테마·칠판·펜·커튼·전체화면·학년 프리셋·PNG), 활동지·인쇄, 반응형 400/1920px, 다크 모드 (AC13~AC15)
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const txt = sel => page.locator(sel).first().innerText();
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent));
  const modalCount = () => page.locator('.modal[role=dialog]').count();
  const penPixels = () => page.evaluate(() => { const c = document.querySelector('#pen-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  const overflow = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
  let s;

  // ---------- 탭 전부 열기 + 마지막 탭 복원 ----------
  for (const t of ['compare', 'arith', 'cards', 'scenes', 'sheet', 'kit']) {
    await page.click(`.tabs [data-tab=${t}]`); await sleep(120);
    const vis = await page.evaluate(() => [...document.querySelectorAll('main [data-view]')].filter(v => !v.hidden).map(v => v.dataset.view));
    expect(vis.length === 1 && vis[0] === t && (await page.locator(`.tabs [data-tab=${t}]`).getAttribute('aria-selected')) === 'true', `탭 ${t} 열림(단독 표시)`);
  }
  await page.click('.tabs [data-tab=sheet]'); await sleep(100); await reload();
  expect((await S()).tab === 'sheet' && !(await page.locator('[data-view=sheet]').isHidden()), '새로고침 후 마지막 탭(활동지) 복원');

  // ---------- AC13 활동지 ----------
  expect(await page.locator('#sheet-items li').count() === 8 && (await txt('#sheet-count')).includes('8문항') && await page.locator('#sheet-preview .a4').count() === 2, '활동지 초기 8문항·미리보기 2쪽');
  expect(await page.locator('#sheet-preview .a4').first().locator('.ws-item').count() === 6 && await page.locator('#sheet-preview .a4').nth(1).locator('.ws-item').count() === 2, '쪽당 최대 6문항');
  expect((await page.locator('#ws-title').inputValue()) === '분수 활동지' && await page.locator('#ws-blanks').isChecked() && !(await page.locator('#ws-answers').isChecked()), '설정 기본값(제목·이름칸 켬·정답지 끔)');
  expect(await page.locator('#sheet-preview .ws-blanks').count() === 2 && (await txt('#sheet-preview .ws-blanks')).includes('학교'), '머리글 학교·학년·반·이름 빈칸');
  const circItem = page.locator('#sheet-preview .ws-item').nth(3);
  expect(await circItem.locator('svg.circ').count() === 1 && await circItem.locator('.cell.on').count() === 0, '4번 문항 원 모델 빈 원(색칠하기)');
  await page.click('[data-action=sheet-clear]'); await sleep(100); await page.click('.modal-foot .btn.primary'); await sleep(100);
  expect(await page.locator('#sheet-items li.muted').count() === 1 && await page.locator('#btn-print').isDisabled() && (await txt('#print-hint')).includes('추가하면'), '모두 지우기 → 인쇄 비활성 + 안내');
  expect(await page.locator('#print-root .a4').count() === 0, '문항 0개 → 인쇄 루트 비어 있음');
  for (const id of ['c3-01', 'c3-02', 'c3-03', 'c4-01', 'c4-03', 'c5-08']) await page.check(`#sheet-cards [data-id="${id}"]`);
  await sleep(100);
  expect(await page.locator('#sheet-items li').count() === 6, 'AC13 카드 6장 체크 → 6문항');
  const types = await page.locator('#sheet-items li .badge').allInnerTexts();
  expect(types.join(',') === '색칠하기,색칠하기,크기 비교,덧셈·뺄셈,분수 쓰기,수직선 표시', '카드 유형 자동 매핑: ' + types.join(','));
  expect(await page.locator('#print-root .a4').count() === 1 && await page.locator('#print-root .a4.answers').count() === 0, '정답지 끔 → 1쪽');
  await page.check('#ws-answers'); await sleep(150);
  expect(await page.locator('#print-root .a4').count() === 2 && await page.locator('#print-root .a4.answers').count() === 1 && await page.locator('#print-root .ws-item').count() === 6, 'AC13 정답지 포함 → A4 2쪽(6문항 + 정답지)');
  const answers = await page.locator('#print-root .ws-answers li').allInnerTexts();
  expect(answers.length === 6 && answers[2].includes('1/3 > 1/4') && answers[3].includes('4/5') && answers[4].includes('7/4 = 1 3/4') && answers[4].includes('1.75'), '정답 자동 계산(비교·연산·대분수·소수): ' + answers.join(' | '));
  const cols = await page.evaluate(() => { const g = document.querySelector('#sheet-preview .ws-grid'); return getComputedStyle(g).gridTemplateColumns.split(' ').length; });
  expect(cols === 2, '문항 2열 배치 (' + cols + ')');
  const order1 = await page.locator('#sheet-items .ws-item-fr').allInnerTexts();
  let changes = 0; let prev = order1.join();
  for (let i = 0; i < 6; i++) { await page.click('[data-action=sheet-shuffle]'); const o = (await page.locator('#sheet-items .ws-item-fr').allInnerTexts()).join(); if (o !== prev) changes++; prev = o; }
  expect(changes >= 3, 'AC13 순서 섞기 누를 때마다 재섞임 (' + changes + '/6 변경)');
  const pvOrder = await page.locator('#sheet-preview .ws-item .ws-num').allInnerTexts();
  expect(pvOrder.join() === '1,2,3,4,5,6', '미리보기 번호 재부여');
  const liTexts = () => page.locator('#sheet-items li').allInnerTexts(); // 유형 배지 포함(1/4 색칠·1/4 수직선처럼 분수만 같은 문항 구분)
  const beforeMove = (await liTexts()).join('|');
  await page.click('#sheet-items li:nth-child(2) [data-wmove="-1"]'); await sleep(50);
  expect((await liTexts()).join('|') !== beforeMove, '문항 ↑ 이동');
  await page.click('#sheet-items [data-wdel="0"]'); await sleep(50);
  expect(await page.locator('#sheet-items li').count() === 5, '문항 삭제 → 5');
  // 설정 반영
  await page.fill('#ws-title', '<b>제목</b> 테스트'); await sleep(350);
  const h1 = await page.evaluate(() => document.querySelector('#print-root .ws-head h1').innerHTML);
  expect(h1.includes('&lt;b&gt;'), 'XSS: 활동지 제목 이스케이프');
  await page.uncheck('#ws-blanks'); await sleep(100);
  expect(await page.locator('#sheet-preview .ws-blanks').count() === 0, '이름칸 끄기');
  await page.check('#ws-bw'); await sleep(100);
  expect((await page.locator('#print-root').getAttribute('class')).includes('bw'), '흑백 빗금 옵션 → bw 클래스');
  await page.selectOption('#ws-model', 'circle'); await sleep(100);
  expect(await page.locator('#sheet-preview svg.circ').count() >= 2, '문항 모델 원 → 원 렌더');
  await page.selectOption('#ws-model', 'bar');
  // 빠른 문항 추가 + 유효성
  await page.selectOption('#qa-type', 'arith'); await sleep(50);
  expect(!(await page.locator('#qa-b-btn').isHidden()) && !(await page.locator('#qa-op').isHidden()), '덧셈·뺄셈 선택 시 분수 B·연산 노출');
  await page.selectOption('#qa-op', '-');
  await page.click('[data-action=qa-a]'); await sleep(150); await page.keyboard.type('1/8'); await page.keyboard.press('Enter'); await sleep(150);
  await page.click('[data-action=qa-add]'); await sleep(100);
  expect((await toasts()).some(t => t.includes('앞의 분수가 더 커야')) && await page.locator('#sheet-items li').count() === 5, '뺄셈 A<B 빠른 문항 → 거부');
  await page.selectOption('#qa-op', '+'); await page.click('[data-action=qa-add]'); await sleep(100);
  expect(await page.locator('#sheet-items li').count() === 6 && (await page.locator('#sheet-items li').last().innerText()).includes('1/8 + 1/4'), '빠른 문항 1/8 + 1/4 추가');
  await page.selectOption('#qa-type', 'line'); await page.click('[data-action=qa-add]'); await sleep(100);
  const lineItem = page.locator('#sheet-preview .ws-item').last();
  expect(await lineItem.locator('.tick').count() === 9 && await lineItem.locator('.tick-label:not(.int)').count() === 0, '수직선 문항: 1/8 눈금만, 분수 라벨 없음');
  // 장면 출처
  await page.evaluate(() => { document.querySelector('#sheet-scenes').closest('details').open = true; });
  await page.check('#sheet-scenes [data-id="sc-b09"]'); await sleep(100);
  expect((await page.locator('#sheet-items li').last().innerText()).includes('2/3 vs 3/5'), '장면(비교) 출처 → 크기 비교 문항');
  await page.uncheck('#sheet-scenes [data-id="sc-b09"]'); await sleep(100);
  expect(await page.locator('#sheet-items li').count() === 7, '출처 체크 해제 → 문항 제거');
  // 인쇄 미디어
  await page.emulateMedia({ media: 'print' });
  const pv = await page.evaluate(() => ({ shell: getComputedStyle(document.querySelector('.app-shell')).display, root: getComputedStyle(document.querySelector('#print-root')).display, tabs: getComputedStyle(document.querySelector('.tabs')).display, ans: getComputedStyle(document.querySelector('#print-root .a4.answers')).breakBefore, item: getComputedStyle(document.querySelector('#print-root .ws-item')).breakInside, bg: getComputedStyle(document.body).backgroundColor }));
  expect(pv.shell === 'none' && pv.root === 'block' && pv.tabs === 'none', 'AC13 @media print: 앱 UI 숨김·활동지만 ' + JSON.stringify(pv));
  expect(pv.ans === 'page' && pv.item === 'avoid' && pv.bg === 'rgb(255, 255, 255)', '정답지 break-before:page·문항 break-inside:avoid·흰 배경');
  await page.emulateMedia({ media: 'screen' });
  await page.click('[data-action=print]'); await sleep(300);
  expect(await page.locator('#print-root .a4').count() === 3, '인쇄 버튼 → 인쇄 루트 갱신(7문항 2쪽 + 정답지, window.print 호출)');
  await shot('sheet');
  await reload();
  expect(await page.locator('#sheet-items li').count() === 7 && (await page.locator('#ws-title').inputValue()).includes('제목') && await page.locator('#ws-answers').isChecked(), '새로고침 후 활동지 구성·설정 복원');

  // ---------- 도움말·테마·툴바 ----------
  await page.click('.tabs [data-tab=kit]'); await sleep(100);
  await page.click('.logo'); await sleep(150);
  expect(await modalCount() === 1 && (await txt('.modal')).includes('사용법') && await page.locator('.modal .help-steps li').count() === 5 && (await txt('.modal')).includes('Ctrl+Z'), '로고 → 도움말 모달(5단계 + 단축키)');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.modal')), 'Tab 포커스 트랩(모달 안 유지)');
  await page.keyboard.press('Escape'); await sleep(100);
  expect(await modalCount() === 0, 'ESC로 도움말 닫힘');
  await page.click('.toolbar [data-action=help]'); await sleep(100); expect(await modalCount() === 1, '? 버튼 도움말'); await page.click('.modal-x'); await sleep(100);
  expect(await modalCount() === 0, '× 버튼으로 닫힘');
  await page.click('#btn-theme'); await sleep(100);
  const th = await page.evaluate(() => ({ attr: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, saved: localStorage.getItem('edu.fraction-kit.theme') }));
  expect(th.attr === 'dark' && th.bg === 'rgb(15, 23, 42)' && th.saved === '"dark"', '테마 토글 → dark + 저장: ' + JSON.stringify(th));
  await shot('theme-dark');
  await reload();
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', '새로고침 후 다크 테마 유지');
  await page.click('#btn-theme'); await sleep(50);
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', '테마 → light');
  // 교사 모드 토글 버튼
  await page.click('#more-menu summary'); await page.click('#btn-teacher'); await sleep(100);
  expect((await S()).settings.teacherMode === false && (await page.evaluate(() => document.documentElement.dataset.teacher)) === 'off' && (await page.evaluate(() => document.querySelector('#more-menu').open)) === false, '교사 모드 끔 + 메뉴 자동 닫힘');
  await reload();
  expect((await S()).settings.teacherMode === false, '새로고침 후 교사 모드 설정 유지');
  await act('setTeacher', true);

  // ---------- AC14 칠판·펜·커튼 ----------
  await page.click('#btn-board'); await sleep(150);
  const board = await page.evaluate(() => ({ attr: document.documentElement.dataset.board, fs: getComputedStyle(document.documentElement).fontSize, x2: document.querySelector('#btn-x2').getBoundingClientRect().height, tb: document.querySelector('#btn-pen').getBoundingClientRect().height, fillA: getComputedStyle(document.documentElement).getPropertyValue('--fill-a').trim(), div: getComputedStyle(document.querySelector('.kit-bar .div')).strokeWidth, bg: getComputedStyle(document.body).backgroundColor, pressed: document.querySelector('#btn-board').getAttribute('aria-pressed') }));
  expect(board.attr === 'on' && board.fs === '24px' && board.pressed === 'true', 'AC14 data-board=on, 글꼴 24px(1.5배): ' + JSON.stringify(board));
  expect(board.x2 >= 56 && board.tb >= 56, 'AC14 버튼 56px 이상 (' + board.x2 + ', ' + board.tb + ')');
  expect(board.fillA === '#1d4ed8' && board.div === '3px' && board.bg === 'rgb(255, 255, 255)', 'AC14 고대비 팔레트(진파랑·분할선 3px·흰 배경)');
  expect(await page.locator('#kit-range').isHidden() && await page.locator('[data-model-toggle=bar]').isHidden(), '칠판 모드: 제어 패널 보조 행 축소');
  expect((await overflow()).sw <= (await overflow()).cw + 1, '칠판 모드 가로 스크롤 없음');
  await shot('board');
  await reload();
  expect((await page.evaluate(() => document.documentElement.dataset.board)) === 'on', '새로고침 후 칠판 모드 유지');
  await page.click('#btn-board'); await sleep(100);
  expect((await page.evaluate(() => document.documentElement.dataset.board)) === 'off', '칠판 모드 해제');
  // 펜
  await act('kitSetD', 4); await act('kitSetN', 0);
  await page.click('#btn-pen'); await sleep(150);
  const penState = await page.evaluate(() => ({ attr: document.documentElement.dataset.pen, layer: !document.querySelector('#pen-layer').hidden, tools: !document.querySelector('#pen-tools').hidden, pe: getComputedStyle(document.querySelector('#pen-layer')).pointerEvents, svgPe: getComputedStyle(document.querySelector('.view-kit .kit-bar')).pointerEvents, pressed: document.querySelector('#btn-pen').getAttribute('aria-pressed') }));
  expect(penState.attr === 'on' && penState.layer && penState.tools && penState.pe === 'auto' && penState.svgPe === 'none' && penState.pressed === 'true', 'AC14 펜 켬: 캔버스 pointer-events auto, SVG none ' + JSON.stringify(penState));
  expect(await page.locator('#pen-tools [data-pen]').count() === 6, '펜 도구 6개(빨강·파랑·형광·지우개·모두 지우기·끄기)');
  const bar = await page.locator('.view-kit .kit-bar').boundingBox();
  await page.mouse.move(bar.x + 10, bar.y + 10); await page.mouse.down(); await page.mouse.move(bar.x + 200, bar.y + 30, { steps: 6 }); await page.mouse.up();
  const drawn = await penPixels();
  expect(drawn > 100, 'AC14 빨간 선 그림(px=' + drawn + ')');
  const redPx = await page.evaluate(() => { const c = document.querySelector('#pen-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) return [d[i], d[i + 1], d[i + 2]]; return null; });
  expect(redPx && redPx[0] > 200 && redPx[1] < 100, '선 색 빨강 ' + JSON.stringify(redPx));
  expect((await S()).kit.n === 0, '펜 모드에서 막대 드래그가 색칠을 바꾸지 않음');
  await page.click('[data-pen=hl]'); await page.mouse.move(bar.x + 10, bar.y + 50); await page.mouse.down(); await page.mouse.move(bar.x + 200, bar.y + 50, { steps: 4 }); await page.mouse.up();
  const hlPx = await page.evaluate(() => { const c = document.querySelector('#pen-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let semi = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 60 && d[i] < 140) semi++; return semi; });
  expect(hlPx > 100, '형광펜 반투명(알파≈0.4) 픽셀 ' + hlPx);
  await page.click('[data-pen=eraser]'); await page.mouse.move(bar.x + 5, bar.y + 10); await page.mouse.down(); await page.mouse.move(bar.x + 210, bar.y + 30, { steps: 8 }); await page.mouse.up();
  const afterErase = await penPixels();
  expect(afterErase < drawn + hlPx, '지우개(destination-out) 픽셀 감소 ' + drawn + '+' + hlPx + ' → ' + afterErase);
  // 리사이즈 후 비율 재그리기
  const strokesBefore = await page.evaluate(() => window.FK.app.tr.pen.strokes.length);
  await page.setViewportSize({ width: 1000, height: 800 }); await sleep(400);
  const afterResize = await penPixels();
  expect(strokesBefore >= 3 && afterResize > 0 && afterResize !== afterErase, '창 크기 변경 후 정규화 좌표로 재그리기 (' + afterErase + ' → ' + afterResize + ')');
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(400);
  await page.click('[data-pen=clear]'); await sleep(50);
  expect(await penPixels() === 0 && (await page.evaluate(() => window.FK.app.tr.pen.strokes.length)) === 0, 'AC14 모두 지우기');
  await page.click('[data-pen=red]'); await page.mouse.move(bar.x + 10, bar.y + 10); await page.mouse.down(); await page.mouse.move(bar.x + 100, bar.y + 30, { steps: 3 }); await page.mouse.up();
  await page.click('.tabs [data-tab=compare]'); await sleep(100);
  expect((await S()).pen === true && (await page.evaluate(() => window.FK.app.tr.pen.strokes.length)) === 0, '탭 전환 시 주석 지워짐(펜 모드 유지)');
  await page.click('.tabs [data-tab=kit]'); await sleep(100);
  await page.click('[data-pen=off]'); await sleep(100);
  expect((await page.evaluate(() => document.documentElement.dataset.pen)) === 'off' && await page.locator('#pen-tools').isHidden() && await page.locator('#pen-layer').isHidden(), '펜 끄기');
  await page.locator('.kit-bar .cell[data-i="1"]').click();
  expect((await S()).kit.n === 2, 'AC14 펜 끄기 후 칸 클릭 동작 → 2/4');
  // 커튼
  await page.click('#btn-curtain'); await sleep(100);
  const cur = await page.evaluate(() => ({ attr: document.documentElement.dataset.curtain, sym: getComputedStyle(document.querySelector('.kit-symbol'), '::after').content, chain: getComputedStyle(document.querySelector('.kit-chain'), '::after').content, pressed: document.querySelector('#btn-curtain').getAttribute('aria-pressed') }));
  expect(cur.attr === 'on' && cur.sym.includes('커튼') && cur.chain.includes('커튼') && cur.pressed === 'true', 'AC14 커튼: 기호 패널·식 영역 가림 ' + JSON.stringify(cur));
  await shot('curtain');
  await page.click('#btn-curtain'); await sleep(50);
  expect((await page.evaluate(() => getComputedStyle(document.querySelector('.kit-symbol'), '::after').content)) === 'none', '커튼 내림');
  // 전체화면(헤드리스에서는 대체 레이아웃)
  await page.click('#btn-fs'); await sleep(300);
  const fsState = await page.evaluate(() => ({ el: !!document.fullscreenElement, fb: document.documentElement.dataset.fs, pos: getComputedStyle(document.querySelector('.app-shell')).position }));
  expect(fsState.el || (fsState.fb === 'on' && fsState.pos === 'fixed'), '전체화면 API 또는 fixed 대체 레이아웃 ' + JSON.stringify(fsState));
  if (fsState.el) expect((await txt('#btn-fs')).includes('해제'), '전체화면 중 버튼 문구 "전체화면 해제"');
  await page.keyboard.press('Escape'); await sleep(200);
  let fsAfter = await page.evaluate(() => ({ el: !!document.fullscreenElement, fb: document.documentElement.dataset.fs }));
  log('ESC 후 전체화면 상태(헤드리스에서는 브라우저가 ESC를 처리하지 않음): ' + JSON.stringify(fsAfter));
  if (fsAfter.el || fsAfter.fb === 'on') { await page.click('#btn-fs'); await sleep(300); fsAfter = await page.evaluate(() => ({ el: !!document.fullscreenElement, fb: document.documentElement.dataset.fs })); }
  expect(!fsAfter.el && fsAfter.fb !== 'on', '전체화면 해제(ESC 또는 버튼 재클릭) ' + JSON.stringify(fsAfter));

  // ---------- 학년 프리셋 ----------
  await page.click('.tabs [data-tab=arith]'); await sleep(50);
  await page.click('#more-menu summary'); await page.selectOption('#grade-preset', '3'); await sleep(200);
  const g3 = await page.evaluate(() => ({ max: document.querySelector('#kit-d').max, arithHidden: document.querySelector('.tabs [data-tab=arith]').hidden, grade: document.documentElement.dataset.grade, tab: window.__app.getState().tab, dec: window.__app.getState().kit.showDecimal, wsModel: window.__app.getState().worksheet.model, cardFilter: document.querySelector('#card-grade [data-grade="3"]').getAttribute('aria-pressed') }));
  expect(g3.max === '10' && g3.arithHidden && g3.grade === '3' && g3.tab !== 'arith' && g3.dec === true && g3.wsModel === 'circle', '3학년 프리셋: 상한 10·연산 탭 숨김·소수 켬·활동지 원 ' + JSON.stringify(g3));
  await act('kitSetD', 24);
  expect((await S()).kit.d === 10, '3학년에서 분모 24 요청 → 10 클램프');
  await page.click('.tabs [data-tab=cards]'); await sleep(100);
  expect((await page.locator('#card-grade [data-grade="3"]').getAttribute('aria-pressed')) === 'true' && await page.locator('#card-list .card-item').count() === 8, '3학년 프리셋 → 카드 필터 3학년');
  await page.click('#more-menu summary'); await page.selectOption('#grade-preset', '5'); await sleep(200);
  const g5 = await page.evaluate(() => ({ max: document.querySelector('#kit-d').max, arithHidden: document.querySelector('.tabs [data-tab=arith]').hidden, dec: window.__app.getState().kit.showDecimal }));
  expect(g5.max === '24' && !g5.arithHidden && g5.dec === false, '5학년 프리셋: 상한 24·연산 탭 표시·소수 끔 ' + JSON.stringify(g5));
  await reload();
  expect((await S()).settings.gradePreset === 5 && (await page.locator('#grade-preset').inputValue()) === '5', '새로고침 후 학년 프리셋 유지');
  await page.click('#more-menu summary'); await page.selectOption('#grade-preset', ''); await sleep(100);
  expect((await S()).settings.gradePreset === null && (await toasts()).some(t => t.includes('해제')), '프리셋 해제');

  // ---------- PNG 저장 ----------
  await page.click('.tabs [data-tab=kit]'); await sleep(100);
  await page.click('#more-menu summary'); await page.click('[data-action=png]'); await sleep(150);
  expect(await modalCount() === 1 && (await txt('.modal')).includes('펜 주석 포함'), 'PNG 저장 다이얼로그');
  const [dlp] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('.modal-foot .btn.primary')]);
  expect(dlp && /^fraction-kit-.+\.png$/.test(dlp.suggestedFilename()), 'PNG 다운로드 파일명 ' + (dlp && dlp.suggestedFilename()));
  if (dlp) { const buf = require('fs').readFileSync(await dlp.path()); expect(buf.length > 1000 && buf[1] === 0x50 && buf[2] === 0x4e, 'PNG 시그니처·크기 ' + buf.length); }
  await page.click('.tabs [data-tab=scenes]'); await page.click('#more-menu summary'); await page.click('[data-action=png]'); await sleep(150);
  const pngScenes = { modal: await modalCount(), toast: (await toasts()).some(t => t.includes('저장할 그림이 없어요')) }; log('보관함 탭 PNG: ' + JSON.stringify(pngScenes)); await page.keyboard.press('Escape');
  expect(pngScenes.modal === 0 && pngScenes.toast, '[스펙] 보관함 탭에서 그림 저장 → "교구판·비교·덧셈뺄셈 탭에서 이용하세요" 토스트(실제: 썸네일 SVG로 저장 다이얼로그 열림)');

  // ---------- 다크 모드(OS) 전체 탭 오류 없음 ----------
  await page.emulateMedia({ colorScheme: 'dark' }); await page.evaluate(() => localStorage.removeItem('edu.fraction-kit.theme')); await reload();
  const dk = await page.evaluate(() => ({ attr: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, fg: getComputedStyle(document.body).color, btn: document.querySelector('#btn-theme').textContent }));
  expect(!dk.attr && dk.bg === 'rgb(15, 23, 42)' && dk.btn.includes('☀'), 'OS 다크 모드 따름(속성 없음) ' + JSON.stringify(dk));
  for (const t of ['kit', 'compare', 'arith', 'cards', 'scenes', 'sheet']) { await page.click(`.tabs [data-tab=${t}]`); await sleep(120); }
  await page.click('.tabs [data-tab=compare]'); await page.click('[data-action=cmp-overlay]'); await sleep(100);
  const dkFill = await page.evaluate(() => ({ a: getComputedStyle(document.querySelector('.cmp-bars [data-who=a] .cell.on')).fill, lbl: getComputedStyle(document.querySelector('.cmp-bars .row-label')).fill, chip: getComputedStyle(document.querySelector('.chip')).color }));
  expect(dkFill.a === 'rgb(96, 165, 250)' && dkFill.lbl !== 'rgb(0, 0, 0)', '다크 모드 막대·라벨 토큰 적용 ' + JSON.stringify(dkFill));
  await shot('dark-compare');
  await page.emulateMedia({ colorScheme: 'light' });

  // ---------- AC15 400px 핵심 흐름 ----------
  await page.setViewportSize({ width: 400, height: 800 }); await page.click('.tabs [data-tab=kit]'); await sleep(300);
  let ov = await overflow();
  expect(ov.sw <= ov.cw + 1 && ov.bw <= ov.cw + 1, 'AC15 400px 가로 스크롤 없음 ' + JSON.stringify(ov));
  const m = await page.evaluate(() => ({ tabs: getComputedStyle(document.querySelector('.model-tabs')).display, ctrlPos: getComputedStyle(document.querySelector('#kit-ctrl')).position, visible: [...document.querySelectorAll('.view-kit .model')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.dataset.model), bodyOpen: getComputedStyle(document.querySelector('#kit-ctrl .ctrl-body')).display, navScroll: getComputedStyle(document.querySelector('.tabs')).overflowX }));
  expect(m.tabs === 'flex' && m.visible.join() === 'bar' && m.ctrlPos === 'fixed' && m.bodyOpen === 'none' && m.navScroll === 'auto', 'AC15 세 모델 탭 전환·하단 시트·탭 가로 스크롤 ' + JSON.stringify(m));
  await page.click('[data-model-tab=circle]'); await sleep(100);
  expect((await page.evaluate(() => [...document.querySelectorAll('.view-kit .model')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.dataset.model))).join() === 'circle', '모델 탭 원 전환');
  await page.click('[data-model-tab=line]'); await sleep(100);
  expect((await page.evaluate(() => [...document.querySelectorAll('.view-kit .model')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.dataset.model))).join() === 'line', '모델 탭 수직선 전환');
  await page.click('[data-model-tab=bar]');
  await page.click('[data-action=toggle-ctrl]'); await sleep(150);
  expect((await page.evaluate(() => getComputedStyle(document.querySelector('#kit-ctrl .ctrl-body')).display)) !== 'none' && (await page.locator('[data-action=toggle-ctrl]').getAttribute('aria-expanded')) === 'true', '하단 시트 펼침');
  await shot('mobile-kit-sheet');
  await page.click('#btn-x2'); await sleep(450);
  s = await S(); expect(s.kit.d === 8 || s.kit.d === 4, '400px 시트에서 ×2 동작 (d=' + s.kit.d + ')');
  await page.click('[data-action=toggle-ctrl]'); await sleep(100);
  const b400 = await page.locator('.view-kit .kit-bar').boundingBox();
  await page.mouse.click(b400.x + b400.width * 0.3, b400.y + b400.height / 2);
  expect((await S()).kit.n >= 1, '400px 막대 탭 색칠');
  // 비교 탭 세로 배치
  await page.click('.tabs [data-tab=compare]'); await sleep(200);
  const ab = await page.evaluate(() => { const a = document.querySelector('#cmp-inputs .ab-block.a').getBoundingClientRect(), b = document.querySelector('#cmp-inputs .ab-block.b').getBoundingClientRect(); return { stacked: b.top >= a.bottom - 1, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
  expect(ab.stacked && ab.sw <= ab.cw + 1, '400px 비교: A/B 세로 배치·가로 스크롤 없음 ' + JSON.stringify(ab));
  await page.click('#cmp-inputs .ab-block.a .chip[data-n="1"][data-d="2"]'); await page.click('[data-action=cmp-auto]'); await sleep(2500);
  expect((await S()).compare.step === 3, '400px 비교 자동 재생 완료');
  await page.click('.tabs [data-tab=arith]'); await sleep(200); ov = await overflow();
  expect(ov.sw <= ov.cw + 1, '400px 연산 탭 가로 스크롤 없음');
  await page.click('[data-action=ar-auto]'); await sleep(5000);
  expect((await S()).arith.step >= 3, '400px 연산 자동 재생');
  await page.click('.tabs [data-tab=cards]'); await sleep(200); ov = await overflow();
  expect(ov.sw <= ov.cw + 1, '400px 카드 탭 가로 스크롤 없음');
  await page.click('[data-pick="c3-03"]'); await page.click('#card-view .choice[data-choice="0"]'); await page.click('[data-card=confirm]'); await sleep(2600);
  expect((await txt('.result-msg')).includes('예측대로예요'), '400px 카드 예측-확인 흐름');
  await shot('mobile-cards');
  await page.click('.tabs [data-tab=scenes]'); await sleep(200); ov = await overflow();
  expect(ov.sw <= ov.cw + 1 && await page.locator('.scene-card').count() === 12, '400px 보관함 가로 스크롤 없음');
  await page.click('.scene-card[data-id="sc-b06"] [data-sc=load]'); await sleep(200);
  expect((await S()).tab === 'kit' && (await S()).kit.n === 7, '400px 장면 불러오기');
  await page.click('.tabs [data-tab=sheet]'); await sleep(200); ov = await overflow();
  expect(ov.sw <= ov.cw + 1, '400px 활동지 가로 스크롤 없음 ' + JSON.stringify(ov));
  const zoom = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet-preview')).zoom);
  expect(+zoom < 1, '400px 활동지 미리보기 축소 (zoom=' + zoom + ')');
  await shot('mobile-sheet');
  // 키패드 모달 400px
  await page.click('.tabs [data-tab=compare]'); await page.click('#cmp-inputs .ab-block.a [data-action=compare-keypad]'); await sleep(150);
  const kp = await page.evaluate(() => { const r = document.querySelector('.modal').getBoundingClientRect(); return { right: r.right, cw: document.documentElement.clientWidth }; });
  expect(kp.right <= kp.cw + 1, '400px 키패드 모달 화면 안 ' + JSON.stringify(kp));
  await page.keyboard.press('Escape');
  // 툴바 더 보기 메뉴
  await page.click('.tabs [data-tab=kit]');
  await page.click('#more-menu summary'); await sleep(100);
  const menu = await page.evaluate(() => { const r = document.querySelector('.more-list').getBoundingClientRect(); return { open: document.querySelector('#more-menu').open, left: r.left, right: r.right, cw: document.documentElement.clientWidth }; });
  expect(menu.open && menu.left >= -1 && menu.right <= menu.cw + 1, '400px 더 보기 메뉴 화면 안 ' + JSON.stringify(menu));
  await page.mouse.click(200, 700); await sleep(50);
  expect((await page.evaluate(() => document.querySelector('#more-menu').open)) === false, '바깥 클릭으로 메뉴 닫힘');
  // 터치 타깃 44px
  const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => ({ t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 12), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })).filter(b => b.h < 44 || b.w < 44).slice(0, 12));
  log('400px 44px 미만 버튼: ' + JSON.stringify(small));
  expect(small.length === 0 || small.every(b => b.h >= 40), '400px 보이는 버튼 터치 타깃 ≥ 44px (미달: ' + JSON.stringify(small) + ')');

  // ---------- AC15 1920px ----------
  await page.setViewportSize({ width: 1920, height: 1080 }); await sleep(300);
  const big = await page.evaluate(() => ({ tops: [...document.querySelectorAll('.view-kit .model')].map(e => Math.round(e.getBoundingClientRect().top)), vis: [...document.querySelectorAll('.view-kit .model')].filter(e => e.getBoundingClientRect().height > 0).length, tabs: getComputedStyle(document.querySelector('.model-tabs')).display, ctrl: getComputedStyle(document.querySelector('#kit-ctrl')).position, barW: document.querySelector('.view-kit .kit-bar').getBoundingClientRect().width }));
  expect(big.vis === 3 && big.tops.every(t => t === big.tops[0]) && big.tabs === 'none' && big.ctrl !== 'fixed', 'AC15 1920px 세 모델 나란히 ' + JSON.stringify(big));
  await shot('desktop-1920');
  await page.setViewportSize({ width: 1280, height: 800 });
};
