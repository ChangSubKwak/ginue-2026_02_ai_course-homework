// fix-r1-verify.js — 1라운드 수정 사항 직접 검증 (pw-run.js 모듈). 기존 모듈이 다루지 않는 경로만 확인
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const closeModal = async () => { while (await page.locator('.modal-back').count()) { await page.keyboard.press('Escape'); await sleep(120); } };
  const tab = async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await sleep(120); };
  await closeModal();

  // 1) 구버전 저장 데이터(공백 포함 calc 토큰) 호환: 로드 시 정규화되어 화면·교사용 인쇄 격자가 유지되는가
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('edu.jari-ttukttak.data')); const old = (t) => t.split('calc(var(--cell)*0.35)').join('calc(var(--cell) * 0.35)'); d.layout.colTpl = old(d.layout.colTpl); d.history.forEach(h => { h.layoutSnapshot.colTpl = old(h.layoutSnapshot.colTpl); }); localStorage.setItem('edu.jari-ttukttak.data', JSON.stringify(d)); });
  await reload(); await closeModal();
  const tpl = (await S()).state.layout.colTpl; log('normalized colTpl: ' + tpl);
  expect(!tpl.includes(' * '), '구버전 템플릿 토큰이 로드 시 정규화됨');
  await tab('seats'); await page.click('#btn-auto'); await sleep(300);
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('#seatmap .seat-grid')).gridTemplateColumns.split(' ').length);
  expect(cols === 8, '구버전 데이터 로드 후 화면 격자 8열: ' + cols);
  await page.click('#btn-print'); await sleep(200); await page.check('input[name=print-kind][value=teacher]'); await sleep(300);
  const tcols = await page.evaluate(() => { const g = document.querySelector('#print-pages .seat-grid'); return { n: getComputedStyle(g).gridTemplateColumns.split(' ').length, boardBelow: g.nextElementSibling && g.nextElementSibling.classList.contains('board-strip') }; });
  expect(tcols.n === 8 && tcols.boardBelow, '교사용 인쇄 8열 + 칠판 아래: ' + JSON.stringify(tcols));
  await page.keyboard.press('Escape'); await sleep(150);

  // 2) 키보드: 카드 Enter 선택 → Tab으로 빈 책상 이동 → Enter로 이동
  let st = await S(); const filledKey = Object.keys(st.state.current.seats)[0]; const sid = st.state.current.seats[filledKey];
  const emptyKey = await page.evaluate(() => { const e = document.querySelector('#seatmap .seat.empty'); return e && e.dataset.key; });
  expect(!!emptyKey && (await page.getAttribute(`#seatmap .seat[data-key="${emptyKey}"]`, 'tabindex')) === '0', '빈 책상이 키보드 포커스 가능(tabindex=0)');
  await page.focus(`#seatmap .seat-card[data-sid="${sid}"]`); await page.keyboard.press('Enter'); await sleep(150);
  expect(await page.evaluate(() => document.activeElement.classList.contains('seat-card')), 'Enter 선택 후 포커스가 카드에 유지');
  await page.focus(`#seatmap .seat[data-key="${emptyKey}"]`); await page.keyboard.press('Enter'); await sleep(200);
  st = await S(); expect(st.state.current.seats[emptyKey] === sid && !st.state.current.seats[filledKey], '빈 책상에서 Enter → 선택한 학생 이동');

  // 3) 자물쇠 확장 히트 영역(84px): 버튼 바깥 5px 지점 클릭으로도 고정됨
  const lockBox = await page.locator(`#seatmap .seat-card[data-sid="${sid}"] .lock`).boundingBox();
  await page.mouse.click(lockBox.x - 5, lockBox.y - 5); await sleep(150);
  st = await S(); expect(st.state.current.locked.includes(sid), '자물쇠 버튼 바깥 5px 클릭으로 고정(확장 히트 영역)');
  await page.click(`#seatmap .seat-card[data-sid="${sid}"] .lock`); await sleep(100);
  // 3b) 48px에서는 카드 중앙 클릭이 자물쇠를 건드리지 않음(탭 선택)
  await page.$eval('#zoom', el => { el.value = 48; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(100);
  await page.click(`#seatmap .seat-card[data-sid="${sid}"]`); await sleep(150);
  st = await S(); expect(!st.state.current.locked.includes(sid) && (await page.locator('#seatmap .seat.tap-sel').count()) === 1, '48px 셀에서 카드 중앙 클릭 = 탭 선택(자물쇠 아님)');
  await page.click(`#seatmap .seat-card[data-sid="${sid}"]`); await sleep(100);
  await page.click('[data-action="fit-zoom"]'); await sleep(100);
  st = await S(); log('fit zoom at 1280: ' + st.ui.zoom); expect(st.ui.zoom >= 48 && st.ui.zoom <= 120 && st.ui.zoom % 4 === 0, '맞춤 버튼 → 확대값 계산');

  // 4) Ctrl+Z는 자리 배치 탭에서만
  await page.click('#btn-auto'); await sleep(250); st = await S(); const seatsBefore = JSON.stringify(st.state.current.seats); const undoBefore = st.undo.past;
  await tab('roster'); await page.keyboard.press('Control+z'); await sleep(150);
  st = await S(); expect(JSON.stringify(st.state.current.seats) === seatsBefore && st.undo.past === undoBefore, '다른 탭에서 Ctrl+Z 무시');
  await tab('seats'); await page.keyboard.press('Control+z'); await sleep(150);
  st = await S(); expect(st.undo.past === undoBefore - 1, '자리 배치 탭에서 Ctrl+Z 동작');

  // 5) 탭 화살표 이동·aria-controls
  await page.focus('#tabs [data-tab="seats"]'); await page.keyboard.press('ArrowRight'); await sleep(150);
  expect((await S()).ui.tab === 'groups' && (await page.getAttribute('#tabs [data-tab="groups"]', 'aria-controls')) === 'view-groups', '탭 → 키로 다음 탭(모둠) 이동 + aria-controls');

  // 6) 모둠 편성 → 확정 → 재렌더 시 반복 모둠 쌍이 자기 자신과 비교되지 않음 / 역할 이름 변경 전파
  await page.click('#btn-make-groups'); await sleep(250); await page.click('#btn-confirm-groups'); await page.waitForSelector('.modal'); await page.click('.modal [data-m=ok]'); await sleep(250);
  expect(/반복 모둠 쌍 0건/.test(await page.locator('#group-report').innerText()), '편성 확정 직후 반복 모둠 쌍 0건(자기 자신 제외)');
  await tab('settings'); const roleInp = page.locator('#settings-roles input[data-role-i="0"]'); await roleInp.fill('모둠장'); await roleInp.dispatchEvent('change'); await sleep(200);
  st = await S(); expect(st.state.groupHistory.every(g => g.groups.every(x => x.members.every(m => m.role !== '이끔이'))) && st.state.groupHistory.some(g => g.groups.some(x => x.members.some(m => m.role === '모둠장'))), '역할 이름 변경이 과거 모둠 기록에 전파');

  // 7) beforeprint로 자동 열린 인쇄 패널은 afterprint에서 닫힘
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await sleep(150);
  expect(!(await page.locator('#print-panel').isHidden()), 'beforeprint → 인쇄 패널 자동 열림');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await sleep(150);
  expect(await page.locator('#print-panel').isHidden(), 'afterprint → 자동 열린 패널 닫힘');

  // 8) 히스토리 카드에 레이아웃명 표시, 터치 pointerdown 툴팁
  await tab('history');
  expect((await page.locator('#hist-list .hist-card.kind-seat').first().innerText()).includes('수업형'), '히스토리 카드에 레이아웃명(수업형) 표시');
  await page.evaluate(() => { const c = document.querySelector('#fairness .heat .hc[data-tip^="이도윤-한수아"]'); c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 300, clientY: 300 })); c.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'touch' })); });
  await sleep(100);
  expect(!(await page.locator('#tooltip').isHidden()) && (await page.locator('#tooltip').innerText()).includes('짝 3회'), '터치 탭으로 히트맵 툴팁 표시·유지');
  const badgeBox = await page.locator('#hist-list .badge.kind-seat').first().boundingBox();
  expect(badgeBox && badgeBox.height < 30, '히스토리 자리 배지가 작은 알약 크기: ' + Math.round(badgeBox.height));
  await shot('v1-history');

  // 9) 모바일 첫 로드: 패널 접힘 + 좌석표 자동 맞춤(가로 내부 스크롤 거의 없음)
  await page.setViewportSize({ width: 400, height: 800 }); await page.evaluate(() => { const u = JSON.parse(localStorage.getItem('edu.jari-ttukttak.ui')); u.zoomManual = false; u.tab = 'seats'; localStorage.setItem('edu.jari-ttukttak.ui', JSON.stringify(u)); });
  await reload(); await closeModal(); await sleep(300);
  const mob = await page.evaluate(() => ({ open: [...document.querySelectorAll('details.panel')].map(d => d.open), cell: getComputedStyle(document.querySelector('#seatmap-wrap')).getPropertyValue('--cell').trim(), sw: document.querySelector('#seatmap-wrap').scrollWidth, cw: document.querySelector('#seatmap-wrap').clientWidth, docSw: document.documentElement.scrollWidth, autoTop: Math.round(document.querySelector('#btn-auto').getBoundingClientRect().top) }));
  log('mobile first load: ' + JSON.stringify(mob));
  expect(mob.open.every(o => !o), '모바일 첫 로드: 교실·조건 패널 접힘');
  expect(mob.cell === '48px' && mob.sw - mob.cw <= 20 && mob.docSw <= 400, '모바일 첫 로드: 좌석표 자동 축소(48px)·가로 스크롤 없음');
  expect(mob.autoTop < 600, '모바일 첫 화면에 자동 배치 버튼 보임(top ' + mob.autoTop + ')');
  await shot('v2-mobile-seats-first');
  await page.click('#btn-print'); await sleep(300);
  const pr = await page.evaluate(() => { const b = document.querySelector('[data-action="do-print"]').getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight }; });
  expect(pr.top >= 0 && pr.bottom <= pr.ih, '모바일 인쇄 패널: 인쇄하기 버튼이 보임 ' + JSON.stringify(pr));
  await page.evaluate(() => { document.querySelector('.print-side').scrollTop = 500; }); await sleep(100);
  const pr2 = await page.evaluate(() => { const b = document.querySelector('[data-action="do-print"]').getBoundingClientRect(); const s = document.querySelector('.print-side').getBoundingClientRect(); return b.top >= s.top - 1 && b.bottom <= s.bottom + 1; });
  expect(pr2, '모바일 인쇄 패널 스크롤 후에도 인쇄하기 버튼 고정 노출');
  await shot('v3-mobile-print');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 800 });
};
