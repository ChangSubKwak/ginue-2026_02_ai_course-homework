// code-01-accept.js — 자리뚝딱 acceptance_criteria 검증 (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const closeModal = async () => { while (await page.locator('.modal-back').count()) { await page.keyboard.press('Escape'); await sleep(150); } };
  await closeModal(); // 첫 실행 투어 닫기

  // AC1: 명렬 25명(비활성 1) + 히스토리 4건
  let st = await S();
  expect(st.state.students.length === 25, 'AC1 명렬 25명');
  expect(await page.locator('#roster-table tr.is-inactive').count() === 1, 'AC1 비활성 1명 회색 행');
  expect(st.state.history.length === 4, 'AC1 히스토리 4건');
  expect(st.state.classInfo.school === '경인초등학교' && st.state.classInfo.className === '5학년 2반', 'AC1 학급명');

  // AC2: 자동 배치 1초 이내, 24장, 리포트
  await page.click('[data-tab=seats]'); await sleep(200);
  const t0 = Date.now(); await page.click('#btn-auto'); await page.waitForSelector('#seatmap .seat.filled'); const dt = Date.now() - t0;
  log('autoArrange ms=' + dt); expect(dt < 1000, 'AC2 자동 배치 1초 이내');
  expect(await page.locator('#seatmap .seat.filled').count() === 24, 'AC2 좌석 카드 24장');
  const repTxt = await page.locator('#report').innerText();
  expect(/분리 쌍[\s\S]*?2\/2 충족/.test(repTxt), 'AC2 분리 쌍 2/2 충족'); expect(/앞자리 배려[\s\S]*?3\/3 충족/.test(repTxt), 'AC2 앞자리 배려 3/3 충족');
  st = await S(); log('report items: ' + st.report.items.map(i => `${i.label}:${i.ok}/${i.total} v${i.violations.length}`).join(' | ') + ' penalty=' + st.report.penalty);
  await shot('ac2-seats');

  // AC3: 앞자리 태그 7명(하드) → 위반 1 + 완화 제안
  await page.evaluate(() => { const s = window.__app.getState().state; const extra = s.students.filter(x => x.active && !x.tags.includes('front')).slice(0, 4).map(x => x.id); window.__extra = extra; });
  await page.click('[data-tab=roster]'); await sleep(100);
  const extra = await page.evaluate(() => window.__extra);
  for (const id of extra) await page.click(`#roster-table tr[data-id="${id}"] [data-action=toggle-tag][data-tag=front]`);
  await page.click('[data-tab=seats]'); await sleep(100); await page.click('#btn-auto'); await sleep(300);
  st = await S(); const front = st.report.items.find(i => i.type === 'front');
  expect(front && front.total === 7 && front.violations.length === 1, `AC3 앞자리 7명 중 위반 1 (실제 total=${front && front.total}, v=${front && front.violations.length})`);
  expect(await page.locator('#seatmap .seat.viol').count() >= 1, 'AC3 위반 좌석 빨간 테두리');
  expect(st.report.suggestions.some(s => /앞 구역 책상 부족\(7>6\)/.test(s)), 'AC3 완화 제안 "앞 구역 책상 부족(7>6)"');
  await shot('ac3-front-violation');
  // 태그 복원
  await page.click('[data-tab=roster]'); for (const id of extra) await page.click(`#roster-table tr[data-id="${id}"] [data-action=toggle-tag][data-tag=front]`);
  await page.click('[data-tab=seats]'); await page.click('#btn-auto'); await sleep(300);

  // AC4: 분리 쌍 인접 교환 → 토스트·빨간 테두리·Ctrl+Z
  const keys = await page.evaluate(() => { const s = window.__app.getState().state; const seats = s.state ? s.state.current.seats : s.current.seats; const inv = {}; Object.entries(seats).forEach(([k, id]) => { inv[id] = k; }); const k4 = inv['s04']; const [r, c] = k4.split('-').map(Number); const c2 = c % 3 === 0 ? c + 1 : c - 1; return { k4, partnerKey: r + '-' + c2, k6: inv['s06'] }; });
  log(JSON.stringify(keys));
  const before = JSON.stringify((await S()).state.current.seats);
  // 드래그: s06 카드를 최민준 짝자리 카드 위로
  const src = page.locator(`#seatmap .seat[data-key="${keys.k6}"] .seat-card`); const dst = page.locator(`#seatmap .seat[data-key="${keys.partnerKey}"]`);
  const sb = await src.boundingBox(), db = await dst.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await page.mouse.down(); await page.mouse.move(sb.x + 20, sb.y + 20, { steps: 3 }); await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2, { steps: 8 }); await page.mouse.up(); await sleep(250);
  const toast = await page.locator('#toast-root .toast').allInnerTexts();
  log('toasts: ' + JSON.stringify(toast));
  expect(toast.some(t => t.includes('분리 조건 위반: 최민준-강시우')), 'AC4 토스트 "분리 조건 위반: 최민준-강시우"');
  expect(await page.locator('#seatmap .seat.viol').count() >= 2, 'AC4 빨간 테두리 2개 이상');
  await shot('ac4-apart-violation');
  await page.keyboard.press('Control+z'); await sleep(200);
  expect(JSON.stringify((await S()).state.current.seats) === before, 'AC4 Ctrl+Z로 원복');

  // AC5: 자물쇠 + 다시 섞기 3회
  const lockKey = keys.k4; await page.click(`#seatmap .seat[data-key="${lockKey}"] .lock`); await sleep(100);
  let same = true; for (let i = 0; i < 3; i++) { await page.click('#btn-shuffle'); await sleep(250); const s2 = (await S()).state.current.seats; if (s2[lockKey] !== 's04') same = false; }
  expect(same, 'AC5 핀 고정 학생 좌석 유지(3회)');
  await page.click(`#seatmap .seat[data-key="${lockKey}"] .lock`);

  // AC6: 2분단×5열 → 카운터 빨강, 버튼 비활성
  await page.selectOption('#layout-panel select#layout-select', '');
  await page.fill('#layout-panel input[data-param=sections]', '2'); await page.locator('#layout-panel input[data-param=sections]').dispatchEvent('change'); await sleep(200);
  expect((await page.locator('#desk-counter').innerText()).replace(/\s+/g, ' ').includes('책상 20 / 학생 24'), 'AC6 카운터 "책상 20 / 학생 24"');
  expect(await page.locator('#desk-counter .is-short').count() === 1, 'AC6 카운터 빨간색 클래스');
  expect(await page.locator('#btn-auto').isDisabled(), 'AC6 자동 배치 비활성');
  await shot('ac6-short');
  await page.fill('#layout-panel input[data-param=sections]', '3'); await page.locator('#layout-panel input[data-param=sections]').dispatchEvent('change'); await sleep(200);
  await page.click('#btn-auto'); await sleep(300);

  // AC7: 발표 모드
  await page.click('#btn-present'); await sleep(300);
  expect(!(await page.locator('#present').isHidden()), 'AC7 발표 오버레이 표시');
  expect(await page.locator('#present-map .flip').count() === 24 && await page.locator('#present-map .flip.flipped').count() === 0, 'AC7 카드 24장 모두 ? 뒷면');
  await page.click('#pr-start'); await sleep(1600);
  const flipped = await page.locator('#present-map .flip.flipped').count(); log('flipped after 1.6s: ' + flipped);
  expect(flipped >= 2 && flipped <= 4, 'AC7 0.7초 간격 플립(1.6초 후 2~4장)');
  await page.click('#pr-start'); await sleep(100); const paused = await page.locator('#present-map .flip.flipped').count();
  await page.keyboard.press('Space'); await sleep(150);
  expect(await page.locator('#present-map .flip.flipped').count() === paused + 1, 'AC7 Space로 다음 카드');
  await shot('ac7-present');
  await page.keyboard.press('Escape'); await sleep(200);
  expect(await page.locator('#present').isHidden(), 'AC7 Esc로 종료');

  // AC8: 모둠 6 + 성별 균형 + 역할
  await page.click('[data-tab=groups]'); await sleep(100);
  await page.check('input[name=gmode][value=count]'); await page.fill('#g-count', '6'); await page.check('#g-gender'); await page.check('#g-roles'); await page.click('#btn-make-groups'); await sleep(200);
  expect(await page.locator('#group-grid .group-card').count() === 6, 'AC8 모둠 카드 6개');
  const sizes = await page.locator('#group-grid .group-card .members').evaluateAll(els => els.map(e => e.querySelectorAll('.member').length));
  expect(sizes.every(n => n === 4), 'AC8 각 4명 ' + sizes.join(','));
  const roleOk = await page.locator('#group-grid .group-card').evaluateAll(cards => cards.every(c => ['이끔이', '기록이', '나눔이', '지킴이'].every(r => [...c.querySelectorAll('.role')].filter(x => x.textContent.trim() === r).length === 1)));
  expect(roleOk, 'AC8 모둠마다 역할 4종 1개씩');
  await shot('ac8-groups');

  // AC9: 배치 확정 '5차' → 히스토리 맨 위, 히트맵 툴팁
  await page.click('[data-tab=seats]'); await page.click('#btn-confirm'); await page.waitForSelector('.modal'); await page.fill('#m-memo', '5차'); await page.click('.modal [data-m=ok]'); await sleep(300);
  await page.click('[data-tab=history]'); await sleep(200);
  const firstCard = await page.locator('#hist-list .hist-card').first().innerText();
  const today = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  expect(firstCard.includes('5차') && firstCard.includes(today), 'AC9 히스토리 맨 위 오늘 날짜 5차 카드: ' + firstCard.replace(/\n/g, ' '));
  const tipText = await page.locator('#fairness .heat .hc[data-tip^="이도윤-한수아"]').first().getAttribute('data-tip');
  log('heat tip: ' + tipText); expect(/짝 3회/.test(tipText || ''), 'AC9 히트맵 이도윤-한수아 "짝 3회"');
  const cell = page.locator('#fairness .heat .hc[data-tip^="이도윤-한수아"]').first(); await cell.hover(); await sleep(100);
  expect(!(await page.locator('#tooltip').isHidden()) && (await page.locator('#tooltip').innerText()).includes('짝 3회'), 'AC9 호버 툴팁 표시');
  // fix-r1: 5번째 배치를 확정한 뒤의 편중 여부는 양은우가 어느 구역에 앉았는지에 따라 달라지므로(엔진이 남는 책상을 뒷줄부터 비움), 배지가 구역 누적 수치(뒤 ≥70%·3회 이상)와 일치하는지로 검사. 초기 상태 배지는 code-03-badge.js가 검증
  const yz = await page.evaluate(() => { const row = [...document.querySelectorAll('#fairness .zrow')].find(r => r.querySelector('.zname').textContent.includes('양은우')); if (!row) return null; const [f, m, b] = row.querySelector('.zcnt').textContent.split('/').map(Number); return { f, m, b, bad: row.classList.contains('is-bad'), badge: !!row.querySelector('.badge') }; });
  log('양은우 zones after 5th confirm: ' + JSON.stringify(yz));
  const yTotal = yz ? yz.f + yz.m + yz.b : 0, expectBad = !!yz && yTotal >= 3 && yz.b / yTotal >= 0.7;
  expect(!!yz && yz.bad === expectBad && yz.badge === expectBad, `AC9 양은우 편중 주의 배지가 구역 누적(뒤 ${yz && yz.b}/${yTotal})과 일치(배지 ${expectBad ? '표시' : '없음'})`);
  await shot('ac9-history');

  // AC10: 인쇄 교사용 180도, 명패 6페이지
  await page.click('#btn-print'); await sleep(200);
  const stuGrid = await page.evaluate(() => { const g = document.querySelector('#print-pages .seat-grid'); const b = g.getBoundingClientRect(); const board = document.querySelector('#print-pages .board-strip').getBoundingClientRect(); return { boardAbove: board.top < b.top, cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, w: b.width, h: b.height }; });
  log('student print: ' + JSON.stringify(stuGrid));
  expect(stuGrid.boardAbove && stuGrid.cols === 8, 'AC10 게시용: 칠판 위, 8열 격자');
  await page.check('input[name=print-kind][value=teacher]'); await sleep(200);
  const teaGrid = await page.evaluate(() => { const g = document.querySelector('#print-pages .seat-grid'); const b = g.getBoundingClientRect(); const board = document.querySelector('#print-pages .board-strip').getBoundingClientRect(); const seats = [...g.querySelectorAll('.seat')].map(s => s.getBoundingClientRect()); const rows = new Set(seats.map(s => Math.round(s.top))).size; return { boardBelow: board.top > b.bottom - 1, inlineCols: g.style.gridTemplateColumns, computedCols: getComputedStyle(g).gridTemplateColumns, distinctRowTops: rows, w: Math.round(b.width), h: Math.round(b.height) }; });
  log('teacher print: ' + JSON.stringify(teaGrid));
  expect(teaGrid.boardBelow, 'AC10 교사용: 칠판 띠 아래');
  expect(teaGrid.computedCols.split(' ').length === 8 && teaGrid.distinctRowTops === 5, `AC10 교사용 격자 8열×5행 유지(실제 computed cols="${teaGrid.computedCols}", 행 ${teaGrid.distinctRowTops})`);
  await shot('ac10-print-teacher');
  await page.check('input[name=print-kind][value=plates]'); await sleep(200);
  expect(await page.locator('#print-pages .page.plates').count() === 6, 'AC10 명패 6페이지');
  expect((await page.locator('#print-pagecount').innerText()).includes('총 6페이지'), 'AC10 페이지 수 표기');
  await shot('ac10-print-plates');
  await page.click('[data-action=close-print]');

  // AC13: 붙여넣기 등록
  await page.click('[data-tab=roster]'); await page.fill('#paste-area', '31\t김가상\t남\n32\t이가상\t여\n33\t박가상\t남\n34\t최가상'); await page.click('[data-action=parse-paste]'); await sleep(150);
  expect(await page.locator('#paste-preview tr.st-ok').count() === 3 && await page.locator('#paste-preview tr.st-warn').count() === 1, 'AC13 미리보기 3정상·1경고');
  expect((await page.locator('#paste-preview tr.st-warn').innerText()).includes('성별 미지정'), 'AC13 경고 사유 "성별 미지정"');
  const n0 = (await S()).state.students.length; await page.click('[data-action=add-parsed]'); await sleep(150);
  expect((await S()).state.students.length === n0 + 4, 'AC13 추가 시 4명 증가');

  // AC11: 새로고침 복원(명렬 변경 + 미확정 배치)
  await page.click('[data-tab=seats]'); await page.click('#btn-auto'); await sleep(400);
  const seatsBefore = JSON.stringify((await S()).state.current.seats);
  await sleep(500); await reload(); await closeModal();
  st = await S();
  expect(st.state.students.length === n0 + 4 && JSON.stringify(st.state.current.seats) === seatsBefore, 'AC11 새로고침 후 명렬·미확정 배치 복원');

  // AC12: 내보내기 JSON → 전체 삭제 → 가져오기
  const exported = JSON.stringify(st.state);
  await page.click('[data-tab=settings]'); await page.click('[data-action=wipe]'); await page.waitForSelector('.modal'); await page.click('.modal [data-m=ok]'); await page.waitForSelector('.modal'); await page.click('.modal [data-m=ok]'); await sleep(200);
  expect((await S()).state.students.length === 0, 'AC12 전체 삭제 후 학생 0명');
  await page.setInputFiles('#json-file', { name: 'jari-ttukttak-backup.json', mimeType: 'application/json', buffer: Buffer.from(exported, 'utf8') }); await page.waitForSelector('.modal'); await sleep(100);
  const mtxt = await page.locator('.modal').innerText(); log('import modal: ' + mtxt.replace(/\n/g, ' '));
  expect(mtxt.includes(`학생 ${n0 + 4}명`) && mtxt.includes('배치 5건'), 'AC12 요약 모달(학생 n명·배치 5건)');
  await page.click('.modal [data-m=ok]'); await sleep(300);
  st = await S(); expect(st.state.students.length === n0 + 4 && st.state.history.length === 5, 'AC12 가져오기 후 명렬·히스토리 복원');
  await page.click('[data-action=reset-sample]'); await page.waitForSelector('.modal'); await page.click('.modal [data-m=ok]'); await sleep(300);

  // AC14: 400px — 하단 탭, 가로 스크롤 없음, 탭-탭 교환
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  await page.click('[data-tab=seats]'); await sleep(100); await page.click('#btn-auto'); await sleep(400);
  const m = await page.evaluate(() => { const t = document.querySelector('#tabs'); const cs = getComputedStyle(t); return { pos: cs.position, bottom: cs.bottom, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
  log('mobile: ' + JSON.stringify(m));
  expect(m.pos === 'fixed' && m.bottom === '0px', 'AC14 탭 바 하단 고정'); expect(m.sw <= m.cw, 'AC14 가로 스크롤 없음');
  const two = await page.evaluate(() => [...document.querySelectorAll('#seatmap .seat.filled')].slice(0, 2).map(s => s.dataset.key));
  const sA = (await S()).state.current.seats;
  await page.locator(`#seatmap .seat[data-key="${two[0]}"] .seat-card`).scrollIntoViewIfNeeded(); await page.locator(`#seatmap .seat[data-key="${two[0]}"] .seat-card`).click(); await sleep(150);
  expect(await page.locator(`#seatmap .seat[data-key="${two[0]}"].tap-sel`).count() === 1, 'AC14 첫 탭 하이라이트');
  await page.locator(`#seatmap .seat[data-key="${two[1]}"] .seat-card`).click(); await sleep(200);
  const sB = (await S()).state.current.seats;
  expect(sA[two[0]] === sB[two[1]] && sA[two[1]] === sB[two[0]], 'AC14 탭-탭 교환');
  await shot('ac14-mobile');
  await page.setViewportSize({ width: 1280, height: 800 });
};
