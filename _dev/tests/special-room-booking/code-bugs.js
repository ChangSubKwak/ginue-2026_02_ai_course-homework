// 특별실지기 코드 리뷰 — 의심 결함 재현 모듈(pw-run.js)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const S = sel => page.locator(sel);
  const st = () => page.evaluate(() => window.__app.getState());
  const modal = () => S('#modal-root .modal-backdrop:not(.closing)').last();
  await S('.choice[data-result="sample"]').click(); await sleep(400);

  // 1) 결재란 구조 확인
  await page.evaluate(() => window.__app.actions.goWeek('2026-10-12'));
  await S('[data-act="print-week"]').click(); await sleep(300);
  const ap = await modal().locator('.paper .approval').first().evaluate(t => ({ ths: Array.from(t.querySelectorAll('th')).map(x => x.textContent), tds: t.querySelectorAll('td').length }));
  log('approval=' + JSON.stringify(ap));
  expect(ap.ths.length === 4 && ap.ths.slice(1).join('/') === '담당/부장/교감' && ap.tds === 3, '결재란 담당/부장/교감 3칸 + 서명칸 3');
  await page.keyboard.press('Escape'); await sleep(250);

  // 2) 순수 함수 경계값(SRB 전역)
  const pure = await page.evaluate(() => ({
    feb30: SRB.isValidDate('2026-02-30'), bad: SRB.isValidDate('2026-13-01'), weekLabel1130: SRB.weekLabel('2026-11-30'), weekLabel0928: SRB.weekLabel('2026-09-28'),
    mondaySat: SRB.mondayOf('2026-10-24'), mondaySun: SRB.mondayOf('2026-10-25'), mondayMon: SRB.mondayOf('2026-10-26'),
    csv: SRB.toCsv([['a,b', 'c"d', 'e\nf', '2026-10-01']]).slice(1), rangeLabel: SRB.rangeLabel(7, 8), rangeLabel2: SRB.rangeLabel(1, 3),
    conflictNull: SRB.checkConflict(null, '2026-10-20', 1, 2, 1, null, '').reasons,
    revRange: window.__app.actions.checkConflict('r_sci1', '2026-10-20', 4, 2, 1).ok,
  }));
  log('pure=' + JSON.stringify(pure));
  expect(pure.feb30 === false, 'isValidDate(2026-02-30)가 false (실제 ' + pure.feb30 + ')');
  expect(pure.csv === '"a,b","c""d","e\nf",2026-10-01', 'CSV 이스케이프: ' + JSON.stringify(pure.csv));
  expect(pure.revRange === false, '끝<시작 교시 범위는 checkConflict에서 ok가 아니어야 함(실제 ok=' + pure.revRange + ')');

  // 3) 시리즈 'after' 삭제 범위 → series.dateTo 갱신
  const s1 = await st();
  const sb = s1.data.bookings.filter(b => b.seriesId === 's_01').sort((a, b) => a.date.localeCompare(b.date));
  const mid = sb[Math.floor(sb.length / 2)];
  const afterRes = await page.evaluate(id => { const b = SRB.state.data.bookings.find(x => x.id === id); const n = SRB.deleteSeriesScope(b, 'after'); SRB.save(); const sr = SRB.state.data.series.find(s => s.id === 's_01'); return { n, dateTo: sr.dateTo, left: SRB.state.data.bookings.filter(x => x.seriesId === 's_01').length }; }, mid.id);
  log('series after=' + JSON.stringify(afterRes) + ' mid=' + mid.date);
  expect(afterRes.dateTo === SRB_addDays(mid.date, -1) && afterRes.left === sb.indexOf(mid), '이후 모두 삭제 → dateTo 전날·남은 건수 일치');

  // 4) 중복 예약(강제 생성) 시 격자 표현: 같은 자리에 블록 2개 겹침
  await page.evaluate(() => { const now = Date.now(); const b0 = SRB.state.data.bookings.find(b => b.resourceId === 'r_sci1' && b.date === '2026-10-20' && b.periodStart === 1); SRB.state.data.bookings.push({ id: 'b_dup', resourceId: 'r_sci1', date: '2026-10-20', periodStart: 1, periodEnd: 2, classId: '3-1', teacherId: 't_07', tag: '실험', qty: 1, memo: '', seriesId: null, used: null, createdAt: now, updatedAt: now }); SRB.save(); window.__app.actions.goWeek('2026-10-19'); window.__app.actions.selectResource('r_sci1'); });
  await sleep(200);
  const dup = await page.evaluate(() => { const bl = Array.from(document.querySelectorAll('.block')).filter(b => /grid-column:3;grid-row:2 /.test(b.getAttribute('style'))); return { n: bl.length, conflictBadge: bl.filter(b => b.classList.contains('conflict')).length, overlap: bl.length === 2 && (() => { const a = bl[0].getBoundingClientRect(), c = bl[1].getBoundingClientRect(); return Math.abs(a.x - c.x) < 2 && Math.abs(a.y - c.y) < 2; })() }; });
  log('dup=' + JSON.stringify(dup));
  expect(dup.n === 2 && dup.conflictBadge > 0, '초과 예약(중복)은 충돌 배지 등으로 표시되어야 함(실제 겹친 블록 ' + dup.n + ', 배지 ' + dup.conflictBadge + ', 완전 겹침 ' + dup.overlap + ')');
  await shot('bug-dup-block');
  await page.evaluate(() => { SRB.state.data.bookings = SRB.state.data.bookings.filter(b => b.id !== 'b_dup'); SRB.save(); SRB.render(); });

  // 5) 병합 시 초과 예약 재검사 토스트
  const exp = await st();
  const dupObj = JSON.parse(JSON.stringify(exp.data)); dupObj.bookings = [{ id: 'b_merge1', resourceId: 'r_sci1', date: '2026-10-20', periodStart: 1, periodEnd: 1, classId: '3-2', teacherId: 't_08', tag: '실험', qty: 1, memo: '', seriesId: null, used: null, createdAt: 1, updatedAt: 1 }];
  dupObj.resources = []; dupObj.classes = []; dupObj.teachers = []; dupObj.events = []; dupObj.series = [];
  const mergeRes = await page.evaluate(o => window.__app.actions.importData(o, 'merge'), dupObj); await sleep(200);
  const toastTxt = (await S('.toast').allTextContents()).join(' | ');
  expect(mergeRes === true && /초과 예약 2건/.test(toastTxt), '병합 후 초과 예약 재검사 토스트: ' + toastTxt);
  await page.evaluate(() => { SRB.state.data.bookings = SRB.state.data.bookings.filter(b => b.id !== 'b_merge1'); SRB.save(); SRB.render(); });

  // 6) 드래그 중 포인터가 격자 밖으로 나가 놓이면? (스펙: pointercancel로 선택 해제)
  await sleep(300); await page.evaluate(() => { window.__app.actions.selectResource('r_sci1'); window.__app.actions.goWeek('2026-10-19'); }); await sleep(200);
  const c1 = S('.cell.free[data-date="2026-10-19"][data-period="1"]'); const bb = await c1.boundingBox();
  await page.mouse.move(bb.x + 10, bb.y + 10); await page.mouse.down(); await page.mouse.move(bb.x + 10, bb.y + 60, { steps: 5 }); await page.mouse.move(bb.x - 400, bb.y + 60, { steps: 5 }); await page.mouse.up(); await sleep(300);
  const outsideModal = await S('#modal-root .modal-backdrop:not(.closing)').count();
  log('drag released outside grid → modal count=' + outsideModal);
  expect(outsideModal === 0, '격자 밖에서 놓으면 선택 해제(모달 미표시)');
  if (outsideModal) { await page.keyboard.press('Escape'); await sleep(250); }

  // 7) 터치 타깃 크기
  const sizes = await page.evaluate(() => { const g = sel => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().height) : null; }; return { chip: g('.chip'), btnSm: g('.btn-sm'), weekInput: g('.week-nav .input'), tab: g('.tabs [role=tab]') }; });
  log('sizes=' + JSON.stringify(sizes));
  expect(sizes.chip >= 44 && sizes.btnSm >= 44, '터치 타깃 44px 이상(칩 ' + sizes.chip + ', btn-sm ' + sizes.btnSm + ')');

  // 8) 모달 포커스 트랩 여부
  await S('.cell.free[data-date="2026-10-19"][data-period="1"]').click(); await sleep(250);
  let escaped = false;
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => !!document.activeElement.closest('.modal')))) { escaped = true; break; } }
  expect(!escaped, '모달 안에서 Tab 포커스가 밖으로 나가지 않음');
  await page.keyboard.press('Escape'); await sleep(250);

  // 9) 자원 비활성화 시 영향 예약 수 안내 모달 여부(스펙 edge)
  await S('.tabs [data-tab="resources"]').click(); await sleep(200);
  await S('input[data-toggle="r_sci1"]').click(); await sleep(200);
  const deactModal = await S('#modal-root .modal-backdrop:not(.closing)').count();
  expect(deactModal === 1, '자원 비활성화 시 영향 예약 수 모달(실제 모달 ' + deactModal + '개, 토스트만)');
  // (fix-r1) 모달이 떠 있으면 확인해 비활성화를 완료한 뒤 다시 활성화한다(모달 아래 요소 클릭 방지)
  if (deactModal) { await modal().locator('[data-result="ok"]').click(); await sleep(250); }
  await S('input[data-toggle="r_sci1"]').click(); await sleep(200);

  // 10) 가져오기: 필드가 빠진 자원(availablePeriods 없음) → 렌더 예외?
  await S('.tabs [data-tab="board"]').click(); await sleep(200);
  const base = (await st()).data;
  const broken = { meta: { app: 'special-room-booking', version: 1 }, settings: base.settings, resources: [{ id: 'r_x', name: '엑스실', type: 'room', active: true }], classes: [], teachers: [], events: [{ id: 'e_x', title: '행사', type: 'event', dateStart: '2026-10-20', dateEnd: '2026-10-20' }], series: [], bookings: [] };
  await page.evaluate(o => window.__app.actions.importData(o, 'replace'), broken).catch(e => log('import threw: ' + e.message)); await sleep(300);
  const errState = await page.evaluate(() => ({ board: document.querySelector('[data-view="board"]').innerHTML.length, chips: document.querySelectorAll('.chip').length }));
  log('broken import → ' + JSON.stringify(errState));
  await S('.tabs [data-tab="calendar"]').click().catch(() => {}); await sleep(300);
  await shot('bug-broken-import');
};
function SRB_addDays(s, n) { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; }
