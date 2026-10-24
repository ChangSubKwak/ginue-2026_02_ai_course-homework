// func-seats.js — 자리뚝딱 QA: 레이아웃·조건·자동 배치·리포트·드래그/탭-탭·Undo/Redo·핀·확정·히스토리·공정성
'use strict';
const fs = require('fs');
const H = (page) => ({
  dismiss: async () => { for (let i = 0; i < 5 && await page.locator('#modal-root .modal').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); } },
  st: () => page.evaluate(() => window.__app.getState()),
  act: (name, ...args) => page.evaluate(([n, a]) => { const r = window.__app.actions[n](...a); return r && typeof r.then === 'function' ? 'promise' : typeof r; }, [name, args]),
  tab: async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await page.waitForTimeout(150); },
  toasts: () => page.$$eval('#toast-root .toast', els => els.map(e => e.textContent)),
  modalText: () => page.locator('#modal-root .modal').innerText().catch(() => ''),
  modalOk: async () => { await page.click('#modal-root .modal [data-m="ok"]'); await page.waitForTimeout(250); },
  today: () => page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }),
  drag: async (fromSel, toSel) => {
    const a = await page.locator(fromSel).boundingBox(); const b = await page.locator(toSel).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
    await page.mouse.up();
  },
});
const partnerOf = (k) => { const [r, c] = k.split('-').map(Number); return r + '-' + (c % 3 === 0 ? c + 1 : c - 1); };

module.exports = async ({ page, expect, shot, log, sleep }) => {
  const h = H(page); await h.dismiss();
  const keyOf = (sid) => page.$eval(`#seatmap .seat-card[data-sid="${sid}"]`, el => el.closest('.seat').dataset.key).catch(() => null);
  await h.tab('seats');

  // ── 초기 상태 ──
  expect(await page.locator('#seatmap .seat.empty').count() === 28, '초기 빈 책상 28개(—)');
  expect(await page.locator('#seatmap .seat.off').count() === 2, '꺼진 책상 2개');
  expect((await page.$eval('#seatmap .seat.off', el => getComputedStyle(el).borderStyle)) === 'dashed', '꺼진 책상 점선');
  expect((await page.textContent('#desk-counter')).includes('책상 28 / 학생 24'), '카운터 책상 28 / 학생 24');
  expect(!(await page.isDisabled('#btn-auto')), '자동 배치 활성');
  expect(await page.isDisabled('#btn-shuffle') && await page.isDisabled('#btn-confirm') && await page.isDisabled('#btn-present') && await page.isDisabled('#btn-png'), '배치 전 섞기/확정/발표/PNG 비활성');
  expect(await page.locator('#seatmap .seat.zone-front').count() === 6, '앞 구역 책상 6개(앞 1/3)');
  expect((await page.textContent('#report')).includes('자동 배치를 실행하면'), '배치 전 리포트 안내');
  expect((await page.$eval('#seatmap', el => el.firstElementChild.className)) === 'board-strip', '칠판 띠가 격자 위');
  expect(await page.locator('#cond-panel input[type=checkbox]').count() === 7, '조건 체크박스 7종');

  // ── AC2: 자동 배치 ──
  const t0 = Date.now();
  await page.click('#btn-auto');
  await page.waitForFunction(() => document.querySelectorAll('#seatmap .seat.filled').length === 24, null, { timeout: 3000 }).catch(() => {});
  const dt = Date.now() - t0;
  await sleep(100);
  const filled = await page.locator('#seatmap .seat.filled').count();
  expect(filled === 24, 'AC2 24개 좌석 카드 채움: ' + filled);
  expect(dt < 1500, `AC2 클릭→채움 ${dt}ms`);
  const inPage = await page.evaluate(() => { const t = performance.now(); window.__app.actions.autoArrange(); return performance.now() - t; });
  expect(inPage < 1000, `자동 배치 함수 ${Math.round(inPage)}ms < 1000ms`);
  log(`auto arrange: click=${dt}ms inPage=${Math.round(inPage)}ms`);
  const rows = await page.$$eval('#report .rep-row', rs => rs.map(r => ({ cls: r.className, txt: r.textContent.replace(/\s+/g, ' ') })));
  const row = (lbl) => rows.find(r => r.txt.includes(lbl)) || { cls: '', txt: '(없음)' };
  expect(row('분리 쌍').txt.includes('2/2 충족') && row('분리 쌍').cls.includes('st-ok'), 'AC2 리포트 분리 쌍 2/2 충족: ' + row('분리 쌍').txt);
  expect(row('앞자리 배려').txt.includes('3/3 충족') && row('앞자리 배려').cls.includes('st-ok'), 'AC2 리포트 앞자리 배려 3/3 충족: ' + row('앞자리 배려').txt);
  expect(row('결합 쌍').txt.includes('1/1'), '결합 쌍 1/1: ' + row('결합 쌍').txt);
  const okColor = await page.$eval('#report .rep-row.st-ok .val', el => getComputedStyle(el).color);
  expect(okColor === 'rgb(46, 139, 87)', 'AC2 충족 행 초록(--ok): ' + okColor);
  let st = await h.st();
  log('after auto: penalty=' + st.report.penalty + ' items=' + JSON.stringify(st.report.items.map(i => [i.type, i.ok, i.total, i.violations.length, !!i.na])));
  const rp = st.report.items.find(i => i.type === 'repeatPartner');
  expect(rp && !rp.na && rp.label.includes('3회'), '이력 있음 → 최근 3회 짝 회피 평가');
  expect(st.report.items.find(i => i.type === 'repeatSeat') && !st.report.items.find(i => i.type === 'repeatSeat').na, '같은 좌석 회피 평가');
  expect(await page.locator('#seatmap .seat-card .tags .dot').count() === 8, '태그 점 8개(3+2+3)');
  expect(await page.locator('#seatmap .seat-card.gender-M').count() === 12 && await page.locator('#seatmap .seat-card.gender-F').count() === 12, '성별 색 카드 12/12');
  expect(!(await page.isDisabled('#btn-undo')), '자동 배치 후 실행 취소 활성');
  await shot('10-auto');
  // 다시 섞기(최대 5회)로 패널티 0 상태 확보
  for (let i = 0; i < 6 && (await h.st()).report.penalty > 0; i++) { await page.click('#btn-shuffle'); await sleep(150); }
  st = await h.st(); log('penalty after reshuffles: ' + st.report.penalty);
  expect(st.report.penalty === 0 && (await page.textContent('#report')).includes('모든 조건 충족'), '다시 섞기로 "모든 조건 충족 · 패널티 0" 도달');

  // ── AC5: 핀 고정 + 다시 섞기 3회 ──
  const k01 = await keyOf('s01');
  await page.click('#seatmap .seat-card[data-sid="s01"] .lock'); await sleep(200);
  st = await h.st(); expect(st.state.current.locked.includes('s01'), '자물쇠 → locked 추가');
  expect(await page.locator('#seatmap .seat.locked .seat-card[data-sid="s01"]').count() === 1 && (await page.textContent('#seatmap .seat-card[data-sid="s01"] .lock')) === '🔒', '잠긴 카드 표시 🔒');
  for (let i = 0; i < 3; i++) { await page.click('#btn-shuffle'); await sleep(150); }
  expect((await keyOf('s01')) === k01, `AC5 3회 다시 섞기 후 고정 좌석 유지(${k01})`);
  await page.click('#seatmap .seat-card[data-sid="s01"] .lock'); await sleep(200);
  st = await h.st(); expect(!st.state.current.locked.includes('s01'), '자물쇠 해제');
  const snap1 = JSON.stringify(st.state.current.seats); await page.click('#btn-shuffle'); await sleep(150);
  st = await h.st(); expect(JSON.stringify(st.state.current.seats) !== snap1, '다시 섞기 → 배치 변경');
  for (let i = 0; i < 6 && (await h.st()).report.penalty > 0; i++) { await page.click('#btn-shuffle'); await sleep(150); }
  st = await h.st(); expect(st.report.penalty === 0, '교환 테스트 전 패널티 0 상태');

  // ── AC4: 탭-탭 교환 + 위반 토스트 + Ctrl+Z ──
  const kA = await keyOf('s04'); const pKey = partnerOf(kA); const pSid = st.state.current.seats[pKey] || null; const kB = await keyOf('s06');
  log(`최민준 ${kA} 짝자리 ${pKey}(${pSid}) 강시우 ${kB}`);
  await page.click('#seatmap .seat-card[data-sid="s06"]'); await sleep(150);
  expect(await page.locator(`#seatmap .seat.tap-sel[data-key="${kB}"]`).count() === 1, '첫 탭 → 카드 하이라이트(tap-sel)');
  await page.click('#seatmap .seat-card[data-sid="s06"]'); await sleep(150);
  expect(await page.locator('#seatmap .seat.tap-sel').count() === 0, '같은 카드 재탭 → 해제');
  await page.click('#seatmap .seat-card[data-sid="s06"]'); await sleep(150);
  if (pSid) await page.click(`#seatmap .seat[data-key="${pKey}"] .seat-card`); else await page.click(`#seatmap .seat[data-key="${pKey}"]`);
  await sleep(300);
  st = await h.st();
  expect(st.state.current.seats[pKey] === 's06', 'AC4 탭-탭 교환: 강시우 → 최민준 짝 자리');
  if (pSid) expect(st.state.current.seats[kB] === pSid, 'AC4 탭-탭 교환: 상대 학생 ↔');
  const toasts = await h.toasts();
  expect(toasts.some(t => t.includes('분리 조건 위반: 최민준-강시우')), 'AC4 토스트 "분리 조건 위반: 최민준-강시우": ' + JSON.stringify(toasts));
  const tCls = await page.$$eval('#toast-root .toast', els => (els.find(e => e.textContent.includes('분리 조건 위반')) || {}).className);
  expect(String(tCls).includes('toast-warn'), '위반 토스트 유형 클래스 toast-warn: ' + tCls);
  expect(await page.locator('#seatmap .seat.viol').count() >= 2, 'AC4 위반 좌석 빨간 테두리 2개 이상');
  const vb = await page.$eval('#seatmap .seat.viol', el => getComputedStyle(el).borderColor);
  expect(vb === 'rgb(210, 63, 63)', '위반 테두리 --danger: ' + vb);
  const tipAttr = await page.getAttribute(`#seatmap .seat[data-key="${pKey}"]`, 'data-tip');
  expect(!!tipAttr && tipAttr.includes('분리 조건 위반'), '위반 좌석 data-tip 이유');
  await page.hover(`#seatmap .seat[data-key="${pKey}"]`); await sleep(150);
  expect(await page.isVisible('#tooltip') && (await page.textContent('#tooltip')).includes('최민준-강시우'), '호버 → DOM 툴팁');
  expect((await page.textContent('#report')).includes('위반 1건'), '리포트 분리 쌍 위반 1건');
  expect(await page.locator('#report .rep-total.bad').count() === 1, '리포트 총계 빨강');
  await shot('11-violation');
  await page.mouse.move(2, 2);
  await page.keyboard.press('Control+z'); await sleep(300);
  st = await h.st();
  expect(st.state.current.seats[kB] === 's06' && st.state.current.seats[kA] === 's04' && (!pSid || st.state.current.seats[pKey] === pSid), 'AC4 Ctrl+Z → 원래 배치 복원');
  expect(await page.locator('#seatmap .seat.viol').count() === 0, 'Ctrl+Z 후 위반 표시 제거');
  await page.keyboard.press('Control+y'); await sleep(300);
  st = await h.st(); expect(st.state.current.seats[pKey] === 's06', 'Ctrl+Y → 다시 실행');
  await page.keyboard.press('Control+z'); await sleep(300);
  await page.keyboard.press('Control+Shift+z'); await sleep(300);
  st = await h.st(); expect(st.state.current.seats[pKey] === 's06', 'Ctrl+Shift+Z → 다시 실행(Redo 별칭)');
  await page.click('#btn-undo'); await sleep(300);
  st = await h.st(); expect(st.state.current.seats[kB] === 's06', '실행 취소 버튼(1)');
  await page.click('#btn-redo'); await sleep(300);
  st = await h.st(); expect(st.state.current.seats[pKey] === 's06', '다시 실행 버튼');
  await page.click('#btn-undo'); await sleep(300);
  st = await h.st(); expect(st.state.current.seats[kB] === 's06', '실행 취소 버튼');
  expect(!(await page.isDisabled('#btn-redo')), '실행 취소 후 다시 실행 버튼 활성');
  // 토스트 3초 소멸
  await sleep(2600);
  expect((await h.toasts()).length === 0, '토스트 자동 소멸');

  // ── 드래그(Pointer Events) ──
  const kX = await keyOf('s01'), kY = await keyOf('s02');
  await h.drag('#seatmap .seat-card[data-sid="s01"]', `#seatmap .seat[data-key="${kY}"]`); await sleep(300);
  st = await h.st();
  expect(st.state.current.seats[kY] === 's01' && st.state.current.seats[kX] === 's02', 'AC4 드래그 교환');
  expect(await page.locator('.drag-ghost').count() === 0 && !(await page.evaluate(() => document.body.classList.contains('dragging'))), '드래그 종료 후 고스트 정리');
  const emptyKey = await page.$eval('#seatmap .seat.empty', el => el.dataset.key); const kZ = await keyOf('s03');
  await h.drag('#seatmap .seat-card[data-sid="s03"]', `#seatmap .seat[data-key="${emptyKey}"]`); await sleep(300);
  st = await h.st(); expect(st.state.current.seats[emptyKey] === 's03' && !st.state.current.seats[kZ], '빈 책상으로 드래그 → 이동');
  // 꺼진 책상으로 드래그 → 무시
  const offKey = await page.$eval('#seatmap .seat.off', el => el.dataset.key); const kW = await keyOf('s05');
  await h.drag('#seatmap .seat-card[data-sid="s05"]', `#seatmap .seat.off[data-key="${offKey}"]`); await sleep(300);
  st = await h.st(); expect(st.state.current.seats[kW] === 's05' && !st.state.current.seats[offKey], '꺼진 책상으로 드래그 → 무시');
  expect(st.undo.past >= 3, 'Undo 스택 누적: ' + st.undo.past);
  // 키보드 Enter 선택
  await page.focus('#seatmap .seat-card[data-sid="s05"]'); await page.keyboard.press('Enter'); await sleep(150);
  expect(await page.locator('#seatmap .seat.tap-sel').count() === 1, 'Enter 키로 카드 선택');
  const af = await page.evaluate(() => (document.activeElement.className || document.activeElement.tagName));
  log('activeElement after Enter: ' + af);
  expect(String(af).includes('seat-card'), 'a11y: 키보드 선택 후 포커스가 카드에 유지');
  await page.click('#seatmap .seat.tap-sel .seat-card'); await sleep(150);
  expect(await page.locator('#seatmap .seat.tap-sel').count() === 0, '선택 해제');
  // Undo 50 상한
  await page.evaluate(() => { const s = window.__app.getState().state; const ks = Object.keys(s.current.seats); for (let i = 0; i < 60; i++) window.__app.actions.toggleLock(s.current.seats[ks[i % 3]]); });
  st = await h.st(); expect(st.undo.past === 50, 'Undo 스택 최대 50: ' + st.undo.past);

  // ── AC3: 앞자리 필요 7명 ──
  await h.tab('roster');
  for (const id of ['s01', 's02', 's04', 's05']) await page.click(`tr[data-id="${id}"] [data-tag="front"]`);
  await sleep(200);
  expect((await page.textContent('#roster-summary')).includes('앞자리 필요 7'), 'AC3 앞자리 필요 7명');
  await h.tab('seats');
  expect(await page.locator('[data-action="cond-hard"][data-cond="front"][data-v="1"].is-on').count() === 1, '앞자리 배려 기본 하드');
  await page.click('#btn-auto'); await sleep(300);
  st = await h.st();
  const fr = st.report.items.find(i => i.type === 'front');
  expect(!!fr && fr.total === 7 && fr.violations.length === 1, `AC3 앞자리 7명 중 위반 1건: ${fr && fr.violations.length}/${fr && fr.total}`);
  const violN = await page.locator('#seatmap .seat.viol').count();
  expect(violN >= 1, 'AC3 위반 좌석 빨간 테두리: ' + violN);
  log('AC3 viol seats=' + violN + ' penalty=' + st.report.penalty + ' suggestions=' + JSON.stringify(st.report.suggestions));
  expect(st.report.suggestions.some(x => x.includes('앞 구역 책상 부족(7>6)')), 'AC3 완화 제안 "앞 구역 책상 부족(7>6)"');
  expect((await page.textContent('#report .suggest')).includes('앞 구역 책상 부족'), 'AC3 리포트 UI 완화 제안');
  expect((await page.textContent('#report .rep-row.st-bad')).includes('위반 1건'), 'AC3 앞자리 배려 행 위반 1건(빨강)');
  const badColor = await page.$eval('#report .rep-row.st-bad .val', el => getComputedStyle(el).color);
  expect(badColor === 'rgb(210, 63, 63)', '위반 행 빨강 색');
  await shot('12-front-violation');
  await page.click('[data-action="cond-hard"][data-cond="front"][data-v="0"]'); await sleep(200);
  st = await h.st();
  expect(st.state.conditions.front.hard === false && !st.report.suggestions.some(x => x.includes('앞 구역')), '소프트 전환 → 완화 제안 제거');
  expect(st.report.penalty < 1000, '소프트 전환 → 패널티 1000 미만: ' + st.report.penalty);
  await page.click('[data-action="cond-hard"][data-cond="front"][data-v="1"]'); await sleep(200);
  await h.tab('roster');
  for (const id of ['s01', 's02', 's04', 's05']) await page.click(`tr[data-id="${id}"] [data-tag="front"]`);
  await h.tab('seats');

  // ── AC6: 2분단×5열 ──
  await page.fill('#layout-panel input[data-param="sections"]', '2'); await page.keyboard.press('Tab'); await sleep(300);
  expect((await page.textContent('#desk-counter')).includes('책상 20 / 학생 24'), 'AC6 카운터 "책상 20 / 학생 24"');
  expect(await page.locator('#desk-counter .is-short').count() === 1, 'AC6 카운터 is-short');
  const cColor = await page.$eval('#desk-counter .is-short', el => getComputedStyle(el).color);
  expect(cColor === 'rgb(210, 63, 63)', 'AC6 카운터 빨간색: ' + cColor);
  expect(await page.isDisabled('#btn-auto'), 'AC6 자동 배치 비활성');
  expect(((await page.getAttribute('#btn-auto', 'title')) || '').includes('책상'), '비활성 버튼 툴팁');
  expect(await page.locator('#unplaced .chip').count() === 24 && !(await page.isHidden('#unplaced-card')), '레이아웃 변경 → 미배치 24명');
  expect(await page.isDisabled('#btn-confirm'), '미배치 → 확정 비활성');
  st = await h.st(); expect(st.undo.past === 0, '레이아웃 변경 → Undo 초기화');
  await shot('13-short');
  await page.fill('#layout-panel input[data-param="sections"]', '9'); await page.keyboard.press('Tab'); await sleep(300);
  st = await h.st(); expect(st.state.layout.params.sections === 4 && (await page.textContent('#desk-counter')).includes('책상 40'), '분단 9 → 4 보정(40책상)');
  await page.fill('#layout-panel input[data-param="rows"]', '0'); await page.keyboard.press('Tab'); await sleep(300);
  st = await h.st(); expect(st.state.layout.params.rows === 3, '열 0 → 3 보정: ' + st.state.layout.params.rows);
  await page.fill('#layout-panel input[data-param="rows"]', '5'); await page.keyboard.press('Tab');
  await page.fill('#layout-panel input[data-param="sections"]', '3'); await page.keyboard.press('Tab'); await sleep(300);
  expect((await page.textContent('#desk-counter')).includes('책상 30 / 학생 24'), '3분단 복귀 → 30책상');
  // 프리셋 전환
  await page.check('#layout-panel input[name=preset][value="group4"]'); await sleep(300);
  st = await h.st();
  const g4desks = await page.locator('#seatmap .seat:not(.off)').count();
  log('group4 default groups=' + st.state.layout.params.groups + ' desks=' + g4desks);
  expect(st.state.layout.preset === 'group4', '4인 모둠형 전환');
  expect(g4desks >= 24, '4인 모둠형 전환 시 기본 수치가 학생 24명을 수용(책상 ' + g4desks + ')');
  expect(await page.locator('#cond-panel .cond.is-dis input[data-cond="genderPair"][disabled]').count() === 1, '모둠형에서 남녀 짝 비활성');
  await page.fill('#layout-panel input[data-param="groups"]', '6'); await page.keyboard.press('Tab'); await sleep(300);
  expect((await page.textContent('#desk-counter')).includes('책상 24 / 학생 24'), '모둠 6 → 24책상');
  await page.click('#btn-auto'); await sleep(300);
  st = await h.st(); expect(Object.keys(st.state.current.seats).length === 24 && !st.report.items.find(i => i.type === 'genderPair'), '모둠형 배치 24명·남녀 짝 조건 제외');
  await page.check('#layout-panel input[name=preset][value="exam"]'); await sleep(300);
  st = await h.st(); log('exam default ' + JSON.stringify(st.state.layout.params) + ' desks=' + await page.locator('#seatmap .seat:not(.off)').count());
  expect(st.state.layout.preset === 'exam' && (await page.locator('#seatmap .seat.zone-front').count()) > 0, '1인 시험형 전환');
  await page.fill('#layout-panel input[data-param="rows"]', '5'); await page.keyboard.press('Tab');
  await page.fill('#layout-panel input[data-param="cols"]', '5'); await page.keyboard.press('Tab'); await sleep(300);
  expect((await page.textContent('#desk-counter')).includes('책상 25 / 학생 24'), '시험형 5×5 = 25책상');
  await page.check('#layout-panel input[name=preset][value="u"]'); await sleep(300);
  await page.fill('#layout-panel input[data-param="cols"]', '10'); await page.keyboard.press('Tab');
  await page.fill('#layout-panel input[data-param="rows"]', '5'); await page.keyboard.press('Tab'); await sleep(300);
  const uDesks = await page.locator('#seatmap .seat:not(.off)').count();
  log('u-shape max desks=' + uDesks);
  expect(uDesks >= 24, 'ㄷ자형 최대 수치로 학생 24명 수용 가능(책상 ' + uDesks + ')');
  await page.check('#layout-panel input[name=preset][value="pair"]'); await sleep(300);
  expect((await page.textContent('#desk-counter')).includes('책상 30 / 학생 24'), '2인 짝 분단형 복귀');

  // ── 편집 모드 ──
  await page.click('#btn-auto'); await sleep(300);
  await page.check('#edit-mode'); await sleep(200);
  const fk = await page.$eval('#seatmap .seat.filled', el => el.dataset.key);
  await page.click(`#seatmap .seat[data-key="${fk}"]`); await sleep(300);
  st = await h.st();
  expect(st.state.layout.cells.find(c => c.r + '-' + c.c === fk).desk === false, '편집 모드 클릭 → 책상 끄기');
  expect(await page.locator(`#seatmap .seat.off[data-key="${fk}"]`).count() === 1, '꺼진 책상 점선 표시');
  expect(st.state.current.unplaced.length === 1 && await page.locator('#unplaced .chip').count() === 1, '좌석 잃은 학생 → 미배치 1명');
  expect(await page.isDisabled('#btn-confirm'), '미배치 있으면 확정 비활성');
  await page.click(`#seatmap .seat[data-key="${fk}"]`); await sleep(300);
  st = await h.st(); expect(st.state.layout.cells.find(c => c.r + '-' + c.c === fk).desk === true, '편집 모드 클릭 → 책상 켜기');
  await page.uncheck('#edit-mode'); await sleep(200);
  const unSid = st.state.current.unplaced[0];
  await page.click(`#unplaced .chip[data-sid="${unSid}"]`); await sleep(150);
  expect(await page.locator('#unplaced .chip.is-on').count() === 1, '미배치 칩 선택 하이라이트');
  await page.click('#seatmap .seat.filled .seat-card'); await sleep(200);
  expect((await h.toasts()).some(t => t.includes('빈 책상')), '채워진 자리에 배치 시도 → 안내 토스트');
  await page.click('#seatmap .seat.empty'); await sleep(300);
  st = await h.st(); expect(st.state.current.unplaced.length === 0 && Object.values(st.state.current.seats).includes(unSid), '칩 → 빈 책상 탭 배치');
  expect(!(await page.isDisabled('#btn-confirm')) && await page.isHidden('#unplaced-card'), '미배치 0 → 확정 활성·카드 숨김');

  // ── 교탁 위치 ──
  await page.click('[data-action="teacher-side"][data-v="bottom"]'); await sleep(300);
  const order = await page.$eval('#seatmap', el => [...el.children].map(c => c.className));
  expect(order[0].includes('seat-grid') && order[1] === 'board-strip', '교탁 아래 → 칠판 띠 아래: ' + order.join('|'));
  const frontRows = await page.$$eval('#seatmap .seat.zone-front', els => [...new Set(els.map(e => e.dataset.key.split('-')[0]))]);
  expect(frontRows.length === 1 && frontRows[0] === '4', '교탁 아래 → 앞 구역 = 마지막 행: ' + frontRows);
  await page.click('[data-action="teacher-side"][data-v="top"]'); await sleep(300);

  // ── 조건 패널 ──
  await page.uncheck('#cond-panel input[data-cond="front"]'); await sleep(200);
  st = await h.st(); expect(st.state.conditions.front.on === false && !st.report.items.find(i => i.type === 'front'), '조건 해제 → 리포트 제외');
  await page.check('#cond-panel input[data-cond="front"]'); await sleep(200);
  await page.fill('#avoid-n', '5'); await page.keyboard.press('Tab'); await sleep(200);
  st = await h.st(); expect(st.state.conditions.avoidPartnerN === 5, '최근 N 5');
  await page.fill('#avoid-n', '9'); await page.keyboard.press('Tab'); await sleep(200);
  st = await h.st(); expect(st.state.conditions.avoidPartnerN === 5, 'N=9 → 5 보정: ' + st.state.conditions.avoidPartnerN);
  await page.uncheck('#avoid-partner'); await sleep(200);
  st = await h.st(); expect(st.state.conditions.avoidPartnerN === 0 && !st.report.items.find(i => i.type === 'repeatPartner'), '짝 회피 해제 → 0·리포트 제외');
  await page.check('#avoid-partner'); await sleep(200);
  st = await h.st(); expect(st.state.conditions.avoidPartnerN === 5, '짝 회피 재체크 → 입력값(5) 유지');
  await page.uncheck('#cond-panel input[data-cond="pairs"]'); await sleep(200);
  st = await h.st(); expect(!st.report.items.find(i => i.type === 'apart'), '쌍 반영 해제 → 분리 쌍 리포트 제외');
  await page.check('#cond-panel input[data-cond="pairs"]'); await sleep(200);

  // ── 확대/축소 ──
  await page.$eval('#zoom', el => { el.value = 48; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(100);
  expect((await page.$eval('#seatmap-wrap', el => el.style.getPropertyValue('--cell'))) === '48px', '슬라이더 → --cell 48px');
  expect(Math.round(await page.$eval('#seatmap .seat', el => el.getBoundingClientRect().width)) === 48, '좌석 폭 48px');
  const lockW = await page.$eval('#seatmap .seat-card .lock', el => el.getBoundingClientRect().width);
  log('lock button width at 48px: ' + lockW);
  await page.$eval('#zoom', el => { el.value = 84; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(100);

  // ── PNG 저장 ──
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#btn-png')]);
  expect(!!dl && /^jari-\d{8}\.png$/.test(dl.suggestedFilename()), 'PNG 파일명 jari-YYYYMMDD.png: ' + (dl && dl.suggestedFilename()));
  if (dl) { const buf = fs.readFileSync(await dl.path()); expect(buf.slice(1, 4).toString() === 'PNG' && buf.length > 5000, `PNG 시그니처·크기 ${buf.length}B`); }

  // ── 레이아웃 복수 저장 ──
  for (let i = 0; i < 5; i++) { await page.click('[data-action="save-layout"]'); await sleep(200); await page.fill('#m-lname', '레이아웃' + i); await h.modalOk(); }
  st = await h.st(); expect(st.state.layouts.length === 5, '레이아웃 5개 저장');
  expect(await page.locator('#layout-select option').count() === 6, '드롭다운 현재+5');
  await page.click('[data-action="save-layout"]'); await sleep(200);
  expect(await page.locator('#modal-root .modal').count() === 0 && (await h.toasts()).some(t => t.includes('최대')), '6번째 저장 → 상한 토스트');
  await page.selectOption('#layout-select', st.state.layouts[0].id); await sleep(300);
  st = await h.st(); expect(st.state.current.unplaced.length === 24 && Object.keys(st.state.current.seats).length === 0, '저장 레이아웃 전환 → 미배치');
  await page.click('[data-action="del-layout"]'); await sleep(200);
  expect((await h.modalText()).includes('레이아웃 삭제'), '레이아웃 삭제 모달');
  await h.modalOk();
  st = await h.st(); expect(st.state.layouts.length === 4, '레이아웃 삭제');

  // ── 공정성 대시보드(샘플 4건 상태) ──
  await h.tab('history');
  const badRows0 = await page.locator('.zrow.is-bad').allTextContents();
  expect(badRows0.length === 1 && badRows0[0].includes('양은우') && badRows0[0].includes('편중 주의'), '샘플 4건: 양은우만 편중 주의 배지: ' + JSON.stringify(badRows0));
  if (badRows0.length) {
    expect((await page.$eval('.zrow.is-bad .zname', el => getComputedStyle(el).color)) === 'rgb(210, 63, 63)', '편중 학생 이름 빨간색');
    await page.hover('.zrow.is-bad .zbar'); await sleep(150);
    expect((await page.textContent('#tooltip')).includes('양은우') && /뒤 3/.test(await page.textContent('#tooltip')), '구역 막대 툴팁(양은우 뒤 3회): ' + await page.textContent('#tooltip'));
  }
  expect(await page.locator('.zrow').count() === 24 && await page.locator('#fairness table.tbl tbody tr').count() === 24, '구역 막대 24명·역할 경험 표 24명');
  const fair = await page.evaluate(() => { const s = window.__app.getState().state; const F = Engine.fairness(s.students, s.history, s.groupHistory); return { yang: F.zones.s23, biased: F.biased, dh: F.partner[F.pairKey('s02', 's10')] }; });
  expect(fair.yang.back === 3 && fair.yang.total === 4 && fair.biased.join() === 's23' && fair.dh === 3, '공정성 통계: 양은우 뒤 3/4·이도윤-한수아 짝 3회: ' + JSON.stringify(fair));
  await h.tab('seats');

  // ── AC9: 배치 확정 → 히스토리 → 히트맵 ──
  await page.click('#btn-auto'); await sleep(300);
  st = await h.st();
  const kd = Object.keys(st.state.current.seats).find(k => st.state.current.seats[k] === 's02');
  if (st.state.current.seats[partnerOf(kd)] === 's10') { const other = Object.keys(st.state.current.seats).find(k => !['s02', 's10'].includes(st.state.current.seats[k]) && partnerOf(k) !== kd); await h.act('swapSeats', partnerOf(kd), other); await sleep(200); log('이도윤-한수아 짝 회피 위해 교환'); }
  const today = await h.today();
  await page.click('#btn-confirm'); await sleep(250);
  expect((await h.modalText()).includes('배치 확정'), 'AC9 배치 확정 모달');
  expect((await page.inputValue('#m-date')) === today, 'AC9 날짜 기본값 오늘: ' + today);
  await page.fill('#m-date', ''); await page.click('#modal-root [data-m="ok"]'); await sleep(200);
  expect(await page.locator('#modal-root .modal').count() === 1 && (await h.toasts()).some(t => t.includes('날짜')), '날짜 비움 → 확정 차단');
  await page.fill('#m-date', today); await page.fill('#m-memo', '5차'); await h.modalOk();
  st = await h.st();
  expect(st.state.history.length === 5 && st.state.history[4].memo === '5차' && st.state.history[4].date === today, 'AC9 히스토리 5건, 마지막 "5차"');
  expect(st.state.history[4].layoutSnapshot && st.state.history[4].report && Object.keys(st.state.history[4].seats).length === 24, '확정 기록에 레이아웃 스냅샷·리포트·좌석');
  expect((await h.toasts()).some(t => t.includes("'5차'")), '확정 토스트');
  await h.tab('history');
  const first = page.locator('.hist-card').first();
  const ft = (await first.textContent()).replace(/\s+/g, ' ');
  expect(ft.includes(today) && ft.includes('5차') && (await first.getAttribute('class')).includes('kind-seat'), 'AC9 히스토리 맨 위 오늘 "5차" 카드: ' + ft);
  const rect = page.locator('.heat rect[data-tip^="이도윤-한수아"]').first();
  expect((await rect.count()) === 1, 'AC9 히트맵 이도윤-한수아 셀');
  await rect.hover({ force: true }); await sleep(200);
  const tipTxt = await page.textContent('#tooltip');
  expect(await page.isVisible('#tooltip') && tipTxt.includes('짝 3회'), 'AC9 호버 툴팁 "짝 3회": ' + tipTxt);
  const op3 = await rect.evaluate(el => el.style.opacity);
  const rect0 = page.locator('.heat rect.hc[data-tip*="짝 0회·모둠 0회"]').first();
  expect(Number(op3) > Number(await rect0.evaluate(el => el.style.opacity)), '셀 농도 = 횟수(3회 > 0회)');
  await shot('14-heatmap');
  const yangBack = await page.evaluate(() => { const s = window.__app.getState().state; const z = Engine.fairness(s.students, s.history, s.groupHistory).zones.s23; return z; });
  const yangBad = await page.locator('.zrow.is-bad').allTextContents();
  log('after 5차: 양은우 zones=' + JSON.stringify(yangBack) + ' badRows=' + JSON.stringify(yangBad));
  expect((yangBack.back / yangBack.total >= 0.7) === yangBad.some(t => t.includes('양은우')), '확정 후 편중 판정이 통계와 일치(뒤 ' + yangBack.back + '/' + yangBack.total + ')');
  expect((await page.textContent('.zrow .zcnt')).split('/').length === 3, '구역 누적 수치 앞/중/뒤');
  // 메모 XSS
  await h.tab('seats'); await page.click('#btn-confirm'); await sleep(200); await page.fill('#m-memo', '<b onclick=1>x</b>'); await h.modalOk();
  await h.tab('history');
  expect(await page.locator('.hist-card .memo b').count() === 0 && (await page.locator('.hist-card .memo').first().textContent()).includes('<b'), '메모 XSS 이스케이프');
  // 카드 → 미리보기 → 불러오기 / 삭제
  await page.locator('.hist-card.kind-seat').nth(2).click(); await sleep(300);
  expect((await h.modalText()).includes('배치 미리보기') && await page.locator('#modal-root .seat-grid').count() === 1 && await page.locator('#modal-root .seat-card[data-drag]').count() === 0, '카드 → 읽기 전용 미리보기 모달');
  await page.click('#modal-root [data-h="load"]'); await sleep(300);
  st = await h.st(); expect(st.ui.tab === 'seats' && Object.keys(st.state.current.seats).length === 24 && await page.isVisible('section[data-view="seats"]'), '불러오기 → 현재 배치 복원 + 탭 이동');
  await h.tab('history');
  const nCards = await page.locator('.hist-card').count();
  await page.locator('.hist-card.kind-seat').nth(0).click(); await sleep(300);
  await page.click('#modal-root [data-h="del"]'); await sleep(300);
  expect((await h.modalText()).includes('기록 삭제'), '삭제 → 확인 모달');
  await page.keyboard.press('Escape'); await sleep(200);
  expect(await page.locator('.hist-card').count() === nCards, '삭제 취소 → 유지');
  await page.locator('.hist-card.kind-seat').nth(0).click(); await sleep(300); await page.click('#modal-root [data-h="del"]'); await sleep(300); await h.modalOk();
  expect(await page.locator('.hist-card').count() === nCards - 1, '삭제 후 카드 1개 감소');
  await page.click('#hist-filter [data-filter="group"]'); await sleep(150);
  expect(await page.locator('.hist-card').count() === 1 && await page.locator('.hist-card.kind-group').count() === 1, '필터 모둠');
  await page.click('#hist-filter [data-filter="seat"]'); await sleep(150);
  expect(await page.locator('.hist-card').count() === nCards - 2 && await page.locator('#hist-filter .chip.is-on[data-filter="seat"]').count() === 1, '필터 자리');
  await page.click('#hist-filter [data-filter="all"]'); await sleep(150);
  // 모둠 기록 미리보기
  await page.locator('.hist-card.kind-group').first().click(); await sleep(300);
  expect((await h.modalText()).includes('모둠 미리보기') && await page.locator('#modal-root .group-card').count() === 6, '모둠 기록 미리보기 6모둠');
  await h.dismiss();

  // ── 홀수 인원·비활성 쌍 ──
  await h.tab('roster'); await page.click('tr[data-id="s06"] .switch'); await sleep(300);
  await h.tab('seats'); await page.click('#btn-auto'); await sleep(300);
  st = await h.st();
  expect((await page.textContent('#report')).includes('단독석'), '홀수 인원 → 리포트 단독석 표기');
  expect(st.report.items.find(i => i.type === 'apart').total === 1, '비활성 포함 분리 쌍 계산 제외(total 1)');
  expect(Object.keys(st.state.current.seats).length === 23, '활성 23명 배치');
  await h.tab('roster'); await page.click('tr[data-id="s06"] .switch'); await sleep(300);
  await h.tab('seats');
  // 패널 아코디언
  await page.click('details.panel summary >> nth=0'); await sleep(100);
  expect(!(await page.locator('details.panel').first().evaluate(el => el.open)), '교실 패널 접기');
  await page.click('details.panel summary >> nth=0');
  await shot('15-seats-final');
};
