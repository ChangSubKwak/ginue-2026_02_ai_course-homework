// func-groups-present-print.js — 자리뚝딱 QA: 모둠 편성·역할 로테이션·발표 모드·인쇄 4종
'use strict';
const H = (page) => ({
  dismiss: async () => { for (let i = 0; i < 5 && await page.locator('#modal-root .modal').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); } },
  st: () => page.evaluate(() => window.__app.getState()),
  act: (name, ...args) => page.evaluate(([n, a]) => { const r = window.__app.actions[n](...a); return r && typeof r.then === 'function' ? 'promise' : typeof r; }, [name, args]),
  tab: async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await page.waitForTimeout(150); },
  toasts: () => page.$$eval('#toast-root .toast', els => els.map(e => e.textContent)),
  modalText: () => page.locator('#modal-root .modal').innerText().catch(() => ''),
  modalOk: async () => { await page.click('#modal-root .modal [data-m="ok"]'); await page.waitForTimeout(250); },
  drag: async (fromSel, toSel) => {
    const a = await page.locator(fromSel).boundingBox(); const b = await page.locator(toSel).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
    await page.mouse.up();
  },
});
const groupsOf = (st) => st.state.currentGroups.groups;

module.exports = async ({ page, expect, shot, log, sleep }) => {
  const h = H(page); await h.dismiss();

  // ── 모둠 편성 AC8 ──
  await h.tab('groups');
  expect((await page.textContent('#group-grid')).includes('아직 편성하지 않았습니다'), '모둠 초기 빈 상태 안내');
  expect(await page.isDisabled('#btn-confirm-groups') && await page.isDisabled('#btn-regroup'), '편성 전 확정/다시 편성 비활성');
  await page.check('input[name=gmode][value="count"]'); await page.fill('#g-count', '6'); await page.check('#g-gender'); await page.check('#g-roles');
  await page.click('#btn-make-groups'); await sleep(300);
  const cards = await page.$$eval('#group-grid .group-card', cs => cs.map(c => ({ name: c.querySelector('.gname').textContent, n: c.querySelectorAll('.member').length, roles: [...c.querySelectorAll('.member .role')].map(r => r.textContent), band: getComputedStyle(c.querySelector('.gband')).backgroundColor })));
  expect(cards.length === 6, 'AC8 모둠 카드 6개: ' + cards.length);
  expect(cards.every(c => c.n === 4), 'AC8 각 4명: ' + cards.map(c => c.n).join(','));
  const need = ['이끔이', '기록이', '나눔이', '지킴이'];
  expect(cards.every(c => need.every(r => c.roles.filter(x => x === r).length === 1)), 'AC8 모둠별 역할 4종 1개씩: ' + JSON.stringify(cards.map(c => c.roles)));
  expect(cards[0].name === '빨강모둠' && cards[5].name === '보라모둠', '기본 모둠 이름 빨강~보라');
  expect(new Set(cards.map(c => c.band)).size === 6, '모둠별 색 띠 상이');
  const rep = (await page.textContent('#group-report')).replace(/\s+/g, ' ');
  expect(rep.includes('성별 균형 모둠 6/6'), '편성 리포트 성별 균형 6/6: ' + rep);
  expect(rep.includes('분리 쌍 위반 0건') && rep.includes('반복 모둠 쌍'), '분리 쌍 위반 0건·반복 모둠 쌍 표시');
  expect((await h.toasts()).some(t => t.includes('6개 모둠')), '편성 토스트');
  let st = await h.st();
  const gOf = {}; groupsOf(st).forEach(g => g.members.forEach(m => { gOf[m.studentId] = g.idx; }));
  expect(gOf.s04 !== gOf.s06 && gOf.s08 !== gOf.s14, '분리 쌍(최민준-강시우, 장지우-권유나) 다른 모둠');
  expect(gOf.s16 === gOf.s12, '결합 쌍(안지아-서아린) 같은 모둠');
  // 역할 로테이션(엔진 직접 검증): 이끔이 2회 경험 학생은 이끔이 회피
  const roleTest = await page.evaluate(() => {
    const hist = [{ groups: [{ members: [{ studentId: 'a', role: '이끔이' }, { studentId: 'b', role: '기록이' }] }] }, { groups: [{ members: [{ studentId: 'a', role: '이끔이' }, { studentId: 'c', role: '기록이' }] }] }];
    const res = []; for (let i = 0; i < 30; i++) { const g = [{ members: ['a', 'b', 'c', 'd'].map(studentId => ({ studentId, role: '모둠원' })) }]; Engine.assignRoles(g, ['이끔이', '기록이', '나눔이', '지킴이'], hist); res.push(g[0].members.find(m => m.studentId === 'a').role); }
    return res;
  });
  expect(roleTest.every(r => r !== '이끔이'), '역할 로테이션: 경험 많은 역할 회피(30회)');
  // 멤버 5명 > 역할 4 → 모둠원, 멤버 3 < 역할 4 → 뒤 역할 생략
  const roleEdge = await page.evaluate(() => { const g = [{ members: ['a', 'b', 'c', 'd', 'e'].map(studentId => ({ studentId, role: '' })) }, { members: ['x', 'y', 'z'].map(studentId => ({ studentId, role: '' })) }]; Engine.assignRoles(g, ['이끔이', '기록이', '나눔이', '지킴이'], []); return [g[0].members.filter(m => m.role === '모둠원').length, g[1].members.map(m => m.role).sort().join(',')]; });
  expect(roleEdge[0] === 1 && roleEdge[1] === '기록이,나눔이,이끔이', '역할 수 초과/부족 처리: ' + JSON.stringify(roleEdge));
  const sig = JSON.stringify(groupsOf(st).map(g => g.members.map(m => m.studentId)));
  await page.click('#btn-regroup'); await sleep(300);
  expect(JSON.stringify(groupsOf(await h.st()).map(g => g.members.map(m => m.studentId))) !== sig, '다시 편성 → 구성 변경');
  // 인원 모드 5 → 5모둠
  await page.check('input[name=gmode][value="size"]'); await page.fill('#g-size', '5'); await page.click('#btn-make-groups'); await sleep(300);
  st = await h.st(); const sizes = groupsOf(st).map(g => g.members.length).sort((a, b) => b - a);
  expect(sizes.join(',') === '5,5,5,5,4', '모둠 인원 5 → 5모둠(5·5·5·5·4): ' + sizes.join(','));
  expect(await page.locator('#group-grid .badge.warn').count() === 0, '편차 1 → 경고 없음');
  await page.check('input[name=gmode][value="count"]'); await page.fill('#g-count', '99'); await page.keyboard.press('Tab'); await sleep(200);
  expect((await page.inputValue('#g-count')) === '10', '모둠 수 99 → 10 보정');
  await page.fill('#g-count', '1'); await page.keyboard.press('Tab'); await sleep(200);
  expect((await page.inputValue('#g-count')) === '2', '모둠 수 1 → 2 보정');
  await page.fill('#g-count', '6'); await page.keyboard.press('Tab'); await page.uncheck('#g-level'); await page.click('#btn-make-groups'); await sleep(300);
  // 멤버 탭-탭 이동(카드 영역 탭)
  st = await h.st(); const m0 = groupsOf(st)[0].members[0].studentId;
  await page.click(`#group-grid .member[data-sid="${m0}"] .name`); await sleep(150);
  expect(await page.locator(`#group-grid .member.tap-sel[data-sid="${m0}"]`).count() === 1, '멤버 첫 탭 하이라이트');
  await page.click('#group-grid .group-card[data-g="1"] .gcount'); await sleep(300);
  st = await h.st();
  expect(groupsOf(st)[1].members.some(m => m.studentId === m0) && groupsOf(st)[1].members.length === 5 && groupsOf(st)[0].members.length === 3, '탭-탭 멤버 이동 → 5명/3명');
  expect(await page.locator('#group-grid .group-card[data-g="1"] .badge.warn').count() === 1 && await page.locator('#group-grid .group-card[data-g="0"] .badge.warn').count() === 1, '인원 편차 2 → 편차 주의 배지');
  expect((await page.textContent('#group-report')).includes('인원 3·5'), '편성 리포트 인원 갱신');
  await h.drag(`#group-grid .member[data-sid="${m0}"]`, '#group-grid .group-card[data-g="0"] .ghead'); await sleep(300);
  st = await h.st(); expect(groupsOf(st)[0].members.some(m => m.studentId === m0) && groupsOf(st)[0].members.length === 4, '드래그로 멤버 복귀');
  const a = groupsOf(st)[2].members[0].studentId, b = groupsOf(st)[3].members[0].studentId;
  await page.click(`#group-grid .member[data-sid="${a}"] .name`); await sleep(100); await page.click(`#group-grid .member[data-sid="${b}"] .name`); await sleep(300);
  st = await h.st(); expect(groupsOf(st)[3].members.some(m => m.studentId === a) && groupsOf(st)[2].members.some(m => m.studentId === b), '멤버 탭-탭 교환');
  await page.click(`#group-grid .member[data-sid="${a}"] .role`); await sleep(200);
  expect(await page.locator('#modal-root #m-role').count() === 1 && await page.locator('#modal-root #m-role option').count() === 5, '역할 배지 → 드롭다운 모달(모둠원+4)');
  await page.selectOption('#m-role', '지킴이'); await h.modalOk();
  st = await h.st(); expect(groupsOf(st)[3].members.find(m => m.studentId === a).role === '지킴이', '역할 수동 변경');
  await page.click('#group-grid .group-card[data-g="0"] .gname'); await sleep(200); await page.fill('#m-gname', '<i>독수리</i>'); await h.modalOk();
  expect((await page.textContent('#group-grid .group-card[data-g="0"] .gname')) === '<i>독수리</i>' && await page.locator('#group-grid .gname i').count() === 0, '모둠 이름 편집 + 이스케이프');
  await page.click('#group-grid .group-card[data-g="0"] .gname'); await sleep(200); await page.fill('#m-gname', ''); await page.click('#modal-root [data-m="ok"]'); await sleep(200);
  expect(await page.locator('#modal-root .modal').count() === 1, '빈 모둠 이름 차단');
  await h.dismiss();
  // 자리표에서 가져오기
  await page.click('[data-action="groups-from-seats"]'); await sleep(200);
  expect((await h.toasts()).some(t => t.includes('4인 모둠형')), '모둠형 아닌 레이아웃 → 안내 토스트');
  await h.act('rebuildLayout', { preset: 'group4', params: { groups: 6 } }); await h.act('autoArrange'); await sleep(200);
  await page.click('[data-action="groups-from-seats"]'); await sleep(300);
  st = await h.st(); expect(groupsOf(st).length === 6 && groupsOf(st).every(g => g.members.length === 4), '자리표(4인 모둠형)에서 가져오기 → 6×4');
  expect(await page.evaluate(() => { const s = window.__app.getState().state; const byPg = {}; s.layout.cells.forEach(c => { const sid = s.current.seats[c.r + '-' + c.c]; if (sid) (byPg[c.pairGroup] = byPg[c.pairGroup] || []).push(sid); }); return Object.values(byPg).every(ids => s.currentGroups.groups.some(g => ids.every(id => g.members.some(m => m.studentId === id)))); }), '가져온 모둠 = 책상 묶음');
  expect(groupsOf(st).every(g => need.every(r => g.members.filter(m => m.role === r).length === 1)), '가져오기 시 역할 자동 배정');
  await shot('20-groups');
  await page.click('#btn-confirm-groups'); await sleep(200);
  expect((await h.modalText()).includes('편성 확정'), '편성 확정 모달');
  await page.fill('#m-memo', '검증 모둠'); await h.modalOk();
  st = await h.st(); expect(st.state.groupHistory.length === 2 && st.state.groupHistory[1].memo === '검증 모둠', '편성 확정 → 모둠 히스토리 2건');
  await h.tab('history');
  expect(await page.locator('.hist-card.kind-group').count() === 2, '히스토리 탭 모둠 카드 2건');
  const roleTable = await page.textContent('#fairness table.tbl');
  expect(roleTable.includes('이끔이'), '역할 경험 표 갱신');
  await h.act('rebuildLayout', { preset: 'pair', params: { sections: 3, rows: 5 } }); await h.act('autoArrange'); await sleep(200);
  await h.tab('seats');

  // ── 발표 모드 AC7 ──
  const seatsBefore = JSON.stringify((await h.st()).state.current.seats);
  await page.click('#btn-present'); await sleep(400);
  expect(await page.isVisible('#present'), 'AC7 발표 오버레이 표시');
  const fsInfo = await page.evaluate(() => ({ fsEl: !!document.fullscreenElement, fallback: document.querySelector('#present').classList.contains('fallback'), pos: getComputedStyle(document.querySelector('#present')).position }));
  log('present ' + JSON.stringify(fsInfo));
  expect((fsInfo.fsEl || fsInfo.fallback) && fsInfo.pos === 'fixed', 'Fullscreen 또는 fixed 오버레이 폴백');
  expect(await page.locator('#present-map .flip').count() === 24, 'AC7 카드 24장');
  expect(await page.locator('#present-map .flip.flipped').count() === 0, 'AC7 시작 전 모두 뒷면');
  expect(await page.$$eval('#present-map .face.front', es => es.length === 24 && es.every(e => e.textContent.trim() === '?')), 'AC7 뒷면 "?"');
  expect(await page.locator('#present-map .seat.empty').count() === 6, '빈 책상 6개 플립 대상 제외');
  expect((await page.textContent('#present-progress')) === '0/24 공개', '진행 표시 0/24 공개');
  expect((await page.textContent('#present-title')).includes('가온초등학교 5학년 2반'), '발표 제목 학급명');
  const flipCss = await page.$eval('#present-map .flip', el => getComputedStyle(el).transformStyle + '|' + getComputedStyle(el).transitionDuration);
  expect(flipCss.startsWith('preserve-3d') && flipCss.includes('0.5s'), 'CSS 3D 플립(preserve-3d, 0.5s): ' + flipCss);
  const cellPx = await page.$eval('#present-map', el => parseInt(el.style.getPropertyValue('--cell')));
  expect(cellPx >= 48, '발표 좌석표 화면 맞춤 --cell: ' + cellPx);
  await shot('21-present-before');
  await page.click('#pr-start'); await sleep(120);
  expect(await page.locator('#present-map .flip.flipped').count() === 1, 'AC7 시작 직후 1장 공개');
  await sleep(1480);
  const n16 = await page.locator('#present-map .flip.flipped').count();
  expect(n16 >= 2 && n16 <= 4, `AC7 1.6초 후 ${n16}장 공개(0.7초 간격, 기대 3)`);
  const flippedKeys = await page.$$eval('#present-map .flip.flipped', es => es.map(e => e.closest('.seat').dataset.key));
  expect(flippedKeys.every(k => k.startsWith('0-')) && flippedKeys.join() === flippedKeys.slice().sort().join(), '좌석순: 앞줄 왼쪽부터: ' + flippedKeys.join(' '));
  expect(await page.$$eval('#present-map .flip.flipped .face.back .name', es => es.every(e => e.textContent.trim().length > 0)), '뒤집힌 카드에 이름 표시');
  expect((await page.textContent('#pr-start')).includes('일시정지'), '진행 중 버튼 → 일시정지');
  await page.click('#pr-start'); await sleep(100);
  const nPause = await page.locator('#present-map .flip.flipped').count();
  await sleep(900);
  expect(await page.locator('#present-map .flip.flipped').count() === nPause, '일시정지 → 진행 멈춤');
  expect((await page.textContent('#pr-start')).includes('재개'), '일시정지 후 버튼 → 재개');
  await page.keyboard.press('Space'); await sleep(150);
  expect(await page.locator('#present-map .flip.flipped').count() === nPause + 1, 'AC7 Space → 다음 한 장');
  await page.click('[data-action="pr-next"]'); await sleep(150);
  expect(await page.locator('#present-map .flip.flipped').count() === nPause + 2 && (await page.textContent('#present-progress')) === `${nPause + 2}/24 공개`, '다음 한 장 버튼 + 진행 표시');
  await page.click('#pr-sound'); await sleep(100); expect((await page.textContent('#pr-sound')).includes('켜짐'), '소리 켜기');
  await page.click('[data-action="pr-next"]'); await sleep(150);
  await page.click('#pr-sound'); await sleep(100); expect((await page.textContent('#pr-sound')).includes('꺼짐'), '소리 끄기');
  await page.click('[data-action="pr-all"]'); await sleep(200);
  expect(await page.locator('#present-map .flip.flipped').count() === 24 && (await page.textContent('#present-progress')) === '24/24 공개', '전체 공개 → 24/24');
  expect((await page.textContent('#pr-start')).includes('처음부터'), '완료 후 버튼 "처음부터"');
  await shot('22-present-after');
  await page.click('#pr-order'); await sleep(150);
  expect((await page.textContent('#pr-order')).includes('무작위') && await page.locator('#present-map .flip.flipped').count() === 0, '무작위 전환 → 카드 리셋');
  await page.click('#pr-start'); await sleep(100); await page.click('#pr-start'); await sleep(100);
  expect(await page.locator('#present-map .flip.flipped').count() === 1, '무작위 순서 시작 1장');
  await page.click('#pr-order'); await sleep(100);
  await page.keyboard.press('Escape'); await sleep(300);
  expect(await page.isHidden('#present'), 'AC7 Esc → 종료');
  expect(JSON.stringify((await h.st()).state.current.seats) === seatsBefore && await page.locator('#seatmap .seat.filled').count() === 24, 'AC7 종료 후 배치 유지');
  expect(await page.isVisible('section[data-view="seats"]') && !(await page.evaluate(() => document.body.classList.contains('presenting'))), '원래 화면 복귀');
  await page.click('#btn-present'); await sleep(300); await page.click('[data-action="pr-exit"]'); await sleep(200);
  expect(await page.isHidden('#present'), '종료 버튼');

  // ── 인쇄 AC10 ──
  await page.click('#btn-print'); await sleep(400);
  expect(await page.isVisible('#print-panel'), '인쇄 미리보기 열림');
  expect(await page.locator('#print-pages .page.landscape').count() === 1, '게시용 A4 가로 1페이지');
  const studentOrder = await page.$eval('#print-pages .p-seatmap', el => [...el.children].map(c => c.className));
  expect(studentOrder[0] === 'board-strip' && studentOrder.length === 2, 'AC10 게시용: 칠판 띠 위: ' + studentOrder.join('|'));
  expect((await page.$eval('#print-pages .seat-grid .seat', el => el.dataset.key)) === '0-0', '게시용 첫 셀 0-0');
  const gridS = await page.$eval('#print-pages .seat-grid', el => getComputedStyle(el).gridTemplateColumns.split(' ').length + 'x' + getComputedStyle(el).gridTemplateRows.split(' ').length);
  expect(gridS === '8x5', '게시용 격자 8열×5행: ' + gridS);
  const pageW = await page.$eval('#print-pages .page', el => el.offsetWidth / el.offsetHeight);
  expect(Math.abs(pageW - 297 / 210) < 0.02, 'A4 가로 비율: ' + pageW.toFixed(3));
  expect(await page.locator('#print-pages .seat-card[data-drag]').count() === 0 && await page.locator('#print-pages .lock').count() === 0, '인쇄 격자에 드래그/자물쇠 없음');
  const nm = await page.evaluate(() => { const s = window.__app.getState().state; const sid = s.current.seats['0-0']; const el = document.querySelector('#print-pages .seat[data-key="0-0"] .name'); return [sid && s.students.find(x => x.id === sid).name, el && el.textContent]; });
  expect(nm[0] === nm[1], '게시용 0-0 이름 일치: ' + nm.join('='));
  await page.check('input[name=print-kind][value="teacher"]'); await sleep(300);
  const teacherOrder = await page.$eval('#print-pages .p-seatmap', el => [...el.children].map(c => c.className));
  expect(teacherOrder[teacherOrder.length - 1] === 'board-strip' && teacherOrder[0] !== 'board-strip', 'AC10 교사용: 칠판 띠 아래: ' + teacherOrder.join('|'));
  const tKey = await page.$eval('#print-pages .seat-grid .seat', el => el.dataset.key);
  expect(tKey === '4-7', 'AC10 교사용 180° 회전(첫 셀 = 원래 4-7): ' + tKey);
  const gridInfo = await page.$eval('#print-pages .seat-grid', el => ({ inline: el.style.gridTemplateColumns, tracks: getComputedStyle(el).gridTemplateColumns.split(' ').length, rows: getComputedStyle(el).gridTemplateRows.split(' ').length, attr: el.getAttribute('style') }));
  log('teacher grid: ' + JSON.stringify(gridInfo));
  expect(gridInfo.tracks === 8 && gridInfo.rows === 5, 'AC10 교사용 격자가 8열×5행으로 렌더됨(실제 ' + gridInfo.tracks + '열×' + gridInfo.rows + '행, inline="' + gridInfo.inline + '")');
  const lastKey = await page.$$eval('#print-pages .seat-grid .seat', es => es[es.length - 1].dataset.key);
  expect(lastKey === '0-0', '교사용 마지막 셀 = 원래 0-0');
  const nm2 = await page.evaluate(() => { const s = window.__app.getState().state; const sid = s.current.seats['0-0']; const el = document.querySelector('#print-pages .seat[data-key="0-0"] .name'); return [sid && s.students.find(x => x.id === sid).name, el && el.textContent]; });
  expect(nm2[0] === nm2[1], '교사용 이름 매핑 유지');
  expect((await page.textContent('#print-pagecount')).includes('A4 가로') && (await page.textContent('#print-pages .p-title')).includes('교사용'), '교사용 제목·가로');
  await shot('23-print-teacher');
  await page.check('input[name=print-kind][value="plates"]'); await sleep(300);
  expect(await page.locator('#print-pages .page.plates').count() === 6, 'AC10 명패 6페이지');
  expect(await page.locator('#print-pages .plate').count() === 24 && await page.locator('#print-pages .page.plates').first().locator('.plate').count() === 4, '명패 24개, 4개/장');
  expect(await page.locator('#print-pages .plate .half.upside').count() === 24, '접이식 명패(상단 반전)');
  expect((await page.textContent('#print-pagecount')).includes('총 6페이지') && (await page.textContent('#print-pagecount')).includes('세로'), '총 6페이지·A4 세로');
  expect((await page.$eval('#page-style', el => el.textContent)).includes('portrait'), '@page portrait');
  const plateTxt = await page.textContent('#print-pages .plate');
  expect(plateTxt.includes('번') && plateTxt.includes('가온초등학교'), '명패 큰 이름+번호+학급');
  expect(await page.locator('#print-pages .plate .pl-name').count() === 48 && (await page.$eval('#print-pages .pl-name', el => parseFloat(getComputedStyle(el).fontSize))) >= 48, '명패 이름 큰 글자');
  await shot('24-print-plates');
  await page.check('input[name=print-kind][value="groups"]'); await sleep(300);
  expect(await page.locator('#print-pages .p-group').count() === 6 && await page.locator('#print-pages .page.portrait').count() === 1, '모둠 명단표 6모둠 1페이지(2열)');
  expect(await page.locator('#print-pages .p-group li .role:not(.plain)').count() === 24, '모둠표 역할 배지 24');
  expect((await page.$eval('#print-pages .p-groups', el => getComputedStyle(el).gridTemplateColumns.split(' ').length)) === 2, '모둠표 2열');
  await page.check('input[name=print-kind][value="student"]'); await sleep(200);
  await page.uncheck('#opt-no'); await sleep(200);
  expect(await page.locator('#print-pages .seat-card .no').count() === 0, '번호 표시 해제');
  await page.uncheck('#opt-gender'); await sleep(200);
  expect(await page.locator('#print-pages .seat-card.gender-M').count() === 0 && await page.locator('#print-pages .seat-card.gender-N').count() === 24, '성별 색상 해제');
  await page.uncheck('#opt-title'); await sleep(200);
  expect(await page.locator('#print-pages .p-title').count() === 0, '제목 해제');
  await page.check('#opt-no'); await page.check('#opt-gender'); await page.check('#opt-title'); await sleep(200);
  expect((await page.textContent('#print-pages .p-title')).includes('가온초등학교 5학년 2반'), '인쇄 제목 학급명');
  expect((await h.st()).state.settings.print.showNo === true, '인쇄 옵션 설정 저장');
  await page.check('input[name=print-kind][value="plates"]'); await sleep(200);
  await page.emulateMedia({ media: 'print' }); await sleep(100);
  const pv = await page.evaluate(() => ({ header: getComputedStyle(document.querySelector('.app-header')).display, tabs: getComputedStyle(document.querySelector('.tabs')).display, side: getComputedStyle(document.querySelector('.print-side')).display, pages: getComputedStyle(document.querySelector('#print-pages')).display, main: getComputedStyle(document.querySelector('#app')).display, present: getComputedStyle(document.querySelector('#present')).display }));
  expect(pv.header === 'none' && pv.tabs === 'none' && pv.side === 'none' && pv.main === 'none' && pv.present === 'none' && pv.pages !== 'none', '@media print 네비·버튼·발표 오버레이 숨김: ' + JSON.stringify(pv));
  const brks = await page.$$eval('#print-pages .page-outer', es => es.map(e => getComputedStyle(e).breakAfter));
  expect(brks.length === 6 && brks.slice(0, 5).every(b => b === 'page') && brks[5] === 'auto', 'page-break-after 적용(마지막 제외): ' + brks.join(','));
  await page.emulateMedia({ media: 'screen' }); await sleep(100);
  await page.check('input[name=print-kind][value="student"]'); await sleep(200);
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click('[data-action="do-print"]'); await sleep(100);
  expect((await page.evaluate(() => window.__printed)) === 1, '인쇄하기 → window.print() 호출');
  await page.keyboard.press('Escape'); await sleep(200);
  expect(await page.isHidden('#print-panel'), 'Esc → 인쇄 미리보기 닫힘');
  await page.click('#btn-print'); await sleep(200); await page.click('[data-action="close-print"]'); await sleep(200);
  expect(await page.isHidden('#print-panel') && !(await page.evaluate(() => document.body.classList.contains('print-open'))), '닫기 버튼');
  // 모둠 없을 때 모둠표 안내
  await page.evaluate(() => { const s = window.__app.getState().state; s.currentGroups = null; window.__app.actions.importRoot(s); });
  await page.click('#btn-print'); await sleep(200); await page.check('input[name=print-kind][value="groups"]'); await sleep(200);
  expect((await page.textContent('#print-pages')).includes('편성된 모둠이 없습니다'), '모둠 없음 → 안내');
  await page.keyboard.press('Escape');
};
