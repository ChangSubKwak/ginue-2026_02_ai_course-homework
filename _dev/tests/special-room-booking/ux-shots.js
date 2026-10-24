// ux-shots.js — 특별실지기 모든 화면/모달 스크린샷(데스크톱 1280 라이트·다크, 태블릿 820, 모바일 400, 인쇄 미디어)
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'ux');
fs.mkdirSync(OUT, { recursive: true });

module.exports = async ({ page, expect, log, sleep }) => {
  const shots = [];
  const snap = async (name, { full = true } = {}) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p, fullPage: full }); shots.push(p); process.stderr.write(`[shot] ${name}\n`); return p; };
  const vp = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await sleep(350); };
  const theme = async v => { await page.evaluate(v => window.__app.actions.setTheme(v), v); await sleep(250); };
  const tab = async t => { await page.evaluate(t => window.__app.actions.selectTab(t), t); await sleep(300); };
  const res = async id => { await page.evaluate(id => window.__app.actions.selectResource(id), id); await sleep(300); };
  const week = async d => { await page.evaluate(d => window.__app.actions.goWeek(d), d); await sleep(300); };
  const closeAll = async () => { for (let i = 0; i < 5; i++) { if (!(await page.locator('.modal-backdrop:not(.closing)').count())) break; await page.keyboard.press('Escape'); await sleep(250); } await sleep(200); };
  const modalOpen = async () => (await page.locator('.modal-backdrop:not(.closing)').count()) > 0;
  const viewports = async (name, { modal = false, mobile = true, tablet = false } = {}) => {
    await vp(1280, 900); await theme('light'); await snap(`${name}--desk-light`, { full: !modal });
    await theme('dark'); await snap(`${name}--desk-dark`, { full: !modal });
    await theme('light');
    if (tablet) { await vp(820, 1100); await snap(`${name}--tablet`, { full: !modal }); }
    if (mobile) { await vp(400, 800); await snap(`${name}--mobile`, { full: !modal }); await vp(400, 800); }
    await vp(1280, 900);
  };

  // 0. 온보딩
  await vp(1280, 900);
  expect(await modalOpen(), '첫 실행 온보딩 모달 표시');
  await snap('00-onboarding--desk-light', { full: false });
  await vp(400, 800); await snap('00-onboarding--mobile', { full: false }); await vp(1280, 900);
  await page.click('.choice[data-result="sample"]'); await sleep(400);
  await snap('01-board-after-onboard-toast', { full: false });

  // 1. 예약판(과학실1, 이번 주)
  const state = await page.evaluate(() => window.__app.getState());
  log('weekStart=' + state.ui.weekStart + ' bookings=' + state.data.bookings.length);
  expect(state.data.resources.length === 10, '자원 칩 10개');
  await viewports('10-board-sci1', { tablet: true });
  // 모바일 요일 탭(수요일) 상태
  await vp(400, 800); await page.click('[data-day-tab="3"]'); await sleep(250); await snap('11-board-mobile-wed'); await vp(1280, 900);

  // 강당(행사 차단·빗금), 태블릿 세트(수량형)
  await res('r_gym'); await viewports('12-board-gym-blocked', { tablet: false });
  await res('r_tab'); await viewports('13-board-tablet-equipment', { tablet: false });
  // 학예회 리허설 주(11/9) 강당: 차단 + 충돌 배지
  await res('r_gym'); await week('2026-11-09'); await snap('14-board-gym-conflict-week--desk-light');
  await theme('dark'); await snap('14-board-gym-conflict-week--desk-dark'); await theme('light');
  // 휴업일 주(10/5 대체공휴일, 10/9 한글날) 과학실1 + 지난 예약(배지)
  await res('r_sci1'); await week('2026-10-05'); await snap('15-board-holiday-week--desk-light');
  await theme('dark'); await snap('15-board-holiday-week--desk-dark'); await theme('light');
  await vp(400, 800); await snap('15-board-holiday-week--mobile'); await vp(1280, 900);
  // 학기 밖 주
  await week('2027-01-04'); await snap('16-board-out-of-semester--desk-light', { full: false });
  await week('2026-10-19');

  // 2. 드래그 선택 하이라이트 → 예약 모달
  const target = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.cell'));
    const byDate = {}; cells.forEach(c => { (byDate[c.dataset.date] = byDate[c.dataset.date] || {})[c.dataset.period] = c.classList.contains('free'); });
    for (const d of Object.keys(byDate).sort()) { const f = byDate[d]; for (let p = 1; p <= 6; p++) if (f[p] && f[p + 1] && f[p + 2]) return { date: d, p }; }
    return null;
  });
  log('drag target=' + JSON.stringify(target));
  if (target) {
    const a = page.locator(`.cell[data-date="${target.date}"][data-period="${target.p}"]`);
    const b = page.locator(`.cell[data-date="${target.date}"][data-period="${target.p + 2}"]`);
    const ab = await a.boundingBox(), bb = await b.boundingBox();
    await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2); await page.mouse.down();
    await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2 + 20, { steps: 3 });
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 }); await sleep(150);
    expect((await page.locator('.cell.sel').count()) === 3, '드래그 중 3칸 하이라이트');
    await snap('20-drag-selecting', { full: false });
    await page.mouse.up(); await sleep(400);
    expect(await modalOpen(), '드래그 후 예약 모달');
    const rng = await page.evaluate(() => { const f = document.querySelector('.modal form'); return [f.elements.pStart.value, f.elements.pEnd.value]; });
    expect(Number(rng[0]) === target.p && Number(rng[1]) === target.p + 2, '모달 교시 범위 = 드래그 범위 ' + rng.join('~'));
    await snap('21-booking-modal-new-invalid--desk-light', { full: false });
    await page.selectOption('.modal select[name="classSel"]', '5-2'); await sleep(250);
    const tname = await page.evaluate(() => { const f = document.querySelector('.modal form'); return f.elements.teacherId.selectedOptions[0].textContent; });
    expect(/이가람/.test(tname), '5-2 선택 시 담임 이가람 자동: ' + tname);
    await snap('22-booking-modal-new-ok--desk-light', { full: false });
    await theme('dark'); await snap('22-booking-modal-new-ok--desk-dark', { full: false }); await theme('light');
    await vp(400, 800); await snap('22-booking-modal-new-ok--mobile', { full: false }); await vp(1280, 900);
    await page.click('.modal-foot [data-act="save"]'); await sleep(200);
    await snap('23-board-after-save-toast', { full: false });
    await sleep(600);
  }

  // 3. 충돌 상태 모달(기존 블록 자리와 동일 조건)
  const conf = await page.evaluate(() => {
    const st = window.__app.getState(); const ws = st.ui.weekStart; const days = []; for (let i = 0; i < 5; i++) { const d = new Date(ws.slice(0, 4), Number(ws.slice(5, 7)) - 1, Number(ws.slice(8, 10)) + i); days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); }
    const b = st.data.bookings.find(x => x.resourceId === 'r_sci1' && days.includes(x.date)); return b ? { date: b.date, pStart: b.periodStart, pEnd: b.periodEnd } : null;
  });
  if (conf) {
    await page.evaluate(c => { window.__app.actions.openBookingModal({ resourceId: 'r_sci1', date: c.date, pStart: c.pStart, pEnd: c.pEnd }); }, conf); await sleep(300); // (fix-r1) 모달 Promise를 반환하면 evaluate가 영원히 대기
    await page.selectOption('.modal select[name="classSel"]', '4-1'); await sleep(250);
    const dis = await page.locator('.modal-foot [data-act="save"]').isDisabled();
    expect(dis, '충돌 시 저장 버튼 disabled');
    const alts = await page.locator('.modal .chip.alt').count(); expect(alts >= 1 && alts <= 3, '대안 칩 1~3개: ' + alts);
    await snap('24-booking-modal-conflict--desk-light', { full: false });
    await theme('dark'); await snap('24-booking-modal-conflict--desk-dark', { full: false }); await theme('light');
    await vp(400, 800); await snap('24-booking-modal-conflict--mobile', { full: false }); await vp(1280, 900);
    if (alts) { await page.click('.modal .chip.alt >> nth=0'); await sleep(300); expect(await page.locator('.modal .validate .ok').count() === 1, '대안 칩 클릭 후 예약 가능'); await snap('25-booking-modal-after-alt', { full: false }); }
    await closeAll();
  }

  // 4. 수량형 모달(태블릿 세트 10/20 3교시: 잔여 0)
  await page.evaluate(() => { window.__app.actions.openBookingModal({ resourceId: 'r_tab', date: '2026-10-20', pStart: 3, pEnd: 3 }); }); await sleep(300);
  await page.selectOption('.modal select[name="classSel"]', '3-1'); await sleep(250);
  await snap('26-booking-modal-equipment-full--desk-light', { full: false });
  await closeAll();
  await page.evaluate(() => { window.__app.actions.openBookingModal({ resourceId: 'r_tab', date: '2026-10-21', pStart: 2, pEnd: 3 }); }); await sleep(300);
  await page.selectOption('.modal select[name="classSel"]', '3-1'); await sleep(250);
  await snap('26-booking-modal-equipment-ok--desk-light', { full: false });
  await closeAll();

  // 5. 지난 예약 수정 모달(사용 여부 토글) + 시리즈 삭제 범위 모달
  await week('2026-10-05');
  const past = page.locator('.block.past').first();
  if (await past.count()) {
    await past.click(); await sleep(300);
    expect(!(await page.locator('.modal .used-wrap').isHidden()), '지난 예약 모달에 사용 여부 토글');
    await snap('27-booking-modal-edit-past--desk-light', { full: false });
    await theme('dark'); await snap('27-booking-modal-edit-past--desk-dark', { full: false }); await theme('light');
    await vp(400, 800); await snap('27-booking-modal-edit-past--mobile', { full: false }); await vp(1280, 900);
    await page.click('.modal-foot [data-act="delete"]'); await sleep(300);
    await snap('28-delete-confirm--desk-light', { full: false });
    await closeAll();
  }
  await week('2026-10-19');
  const ser = page.locator('.block', { hasText: '정기' }).first();
  if (await ser.count()) { await ser.click(); await sleep(300); await snap('29-booking-modal-series--desk-light', { full: false }); await page.click('.modal-foot [data-act="delete"]'); await sleep(300); await snap('29-series-delete-scope--desk-light', { full: false }); await vp(400, 800); await snap('29-series-delete-scope--mobile', { full: false }); await vp(1280, 900); await closeAll(); }

  // 6. 정기 예약 모달(빈 상태 → 미리보기)
  await page.click('[data-act="series"]'); await sleep(300);
  await snap('30-series-modal-empty--desk-light', { full: false });
  await page.selectOption('.modal select[name="resourceId"]', 'r_sci2'); await page.selectOption('.modal select[name="weekday"]', '4');
  await page.selectOption('.modal select[name="pStart"]', '1'); await page.selectOption('.modal select[name="pEnd"]', '2'); await page.selectOption('.modal select[name="classSel"]', '6-1'); await sleep(200);
  await page.click('.modal-foot [data-act="preview"]'); await sleep(400);
  const hasChuseok = await page.locator('.modal .preview tr.st-holiday', { hasText: '9/24' }).count();
  expect(hasChuseok >= 1, '정기 예약 미리보기에 추석(9/24) 휴업일 제외 행');
  await snap('31-series-modal-preview--desk-light', { full: false });
  await theme('dark'); await snap('31-series-modal-preview--desk-dark', { full: false }); await theme('light');
  await vp(400, 800); await snap('31-series-modal-preview--mobile', { full: false }); await vp(1280, 900);
  await closeAll();

  // 7. 미확인 예약 모달
  if (await page.locator('[data-act="unchecked"]').count()) { await page.click('[data-act="unchecked"]'); await sleep(300); await snap('32-unchecked-modal--desk-light', { full: false }); await vp(400, 800); await snap('32-unchecked-modal--mobile', { full: false }); await vp(1280, 900); await closeAll(); }

  // 8. 주간 이용 현황표 인쇄 미리보기 + print 미디어
  await page.click('[data-act="print-week"]'); await sleep(500);
  expect(await page.locator('.modal .paper .approval').count() >= 1, '인쇄 미리보기에 결재란');
  await snap('40-print-weekly-preview--desk-light', { full: false });
  await theme('dark'); await snap('40-print-weekly-preview--desk-dark', { full: false }); await theme('light');
  await vp(400, 800); await snap('40-print-weekly-preview--mobile', { full: false }); await vp(1280, 900);
  await page.evaluate(() => { document.querySelector('#print-root').innerHTML = document.querySelector('.modal .paper').innerHTML; document.querySelector('#print-page-style').textContent = '@page { size: A4 landscape; margin: 12mm; }'; });
  await page.emulateMedia({ media: 'print' }); await vp(1123, 794); await sleep(300);
  await snap('41-print-weekly-media-print');
  await page.emulateMedia({ media: 'screen' }); await vp(1280, 900); await closeAll();

  // 9. 학사일정
  await tab('calendar'); await viewports('50-calendar', { tablet: true });
  await page.click('[data-act="event-add"]'); await sleep(300);
  await page.fill('.modal input[name="title"]', '학예회 리허설'); await page.check('.modal input[name="res"][value="r_gym"]'); await page.check('.modal input[name="pmode"][value="some"]'); await sleep(200);
  await snap('51-event-modal--desk-light', { full: false });
  await theme('dark'); await snap('51-event-modal--desk-dark', { full: false }); await theme('light');
  await vp(400, 800); await snap('51-event-modal--mobile', { full: false }); await vp(1280, 900);
  await closeAll();
  const af = page.locator('[data-affected]').first();
  if (await af.count()) { await af.click(); await sleep(300); await snap('52-affected-modal--desk-light', { full: false }); await closeAll(); }
  await page.locator('[data-event-del]').first().click(); await sleep(300); await snap('53-event-delete-confirm', { full: false }); await closeAll();

  // 10. 자원·명단
  await tab('resources'); await viewports('60-resources', { tablet: true });
  await page.click('[data-res-edit="r_com"]'); await sleep(300);
  await snap('61-resource-modal--desk-light', { full: false });
  await theme('dark'); await snap('61-resource-modal--desk-dark', { full: false }); await theme('light');
  await vp(400, 800); await snap('61-resource-modal--mobile', { full: false }); await vp(1280, 900);
  await closeAll();
  await page.click('[data-res-del="r_sci1"]'); await sleep(300); await snap('62-resource-cannot-delete', { full: false }); await closeAll();
  await page.click('[data-act="class-add"]'); await sleep(300); await snap('63-class-modal', { full: false }); await closeAll();
  await page.click('[data-act="teacher-add"]'); await sleep(300); await snap('64-teacher-modal', { full: false }); await closeAll();

  // 11. 통계
  await tab('stats'); await viewports('70-stats', { tablet: true });
  const rect = page.locator('.heat rect.h.low').first();
  if (await rect.count()) { await rect.hover(); await sleep(200); await snap('71-stats-tooltip', { full: false }); }
  expect((await page.locator('.low-list li', { hasText: '5-3' }).count()) >= 1, "이용 저조 학급 목록에 5-3");
  await page.selectOption('[data-stats="mode"]', 'month'); await sleep(300); await snap('72-stats-month--desk-light');
  await page.selectOption('[data-stats="mode"]', 'semester'); await sleep(300);
  await page.click('[data-act="stats-print"]'); await sleep(500);
  await snap('73-print-report-preview--desk-light', { full: false });
  await theme('dark'); await snap('73-print-report-preview--desk-dark', { full: false }); await theme('light');
  await vp(400, 800); await snap('73-print-report-preview--mobile', { full: false }); await vp(1280, 900);
  await page.evaluate(() => { document.querySelector('#print-root').innerHTML = document.querySelector('.modal .paper').innerHTML; document.querySelector('#print-page-style').textContent = '@page { size: A4 portrait; margin: 12mm; }'; });
  await page.emulateMedia({ media: 'print' }); await vp(794, 1123); await sleep(300);
  await snap('74-print-report-media-print');
  await page.emulateMedia({ media: 'screen' }); await vp(1280, 900); await closeAll();

  // 12. 설정
  await tab('settings'); await viewports('80-settings', { tablet: true });
  await page.click('[data-act="reset-semester"]'); await sleep(300); await snap('81-reset-modal-disabled', { full: false });
  await page.fill('.modal input[name="confirm"]', '초기화'); await sleep(150); await snap('81-reset-modal-enabled', { full: false }); await closeAll();
  // JSON 가져오기 모달(내보낸 데이터 파일 사용)
  const data = (await page.evaluate(() => window.__app.getState())).data;
  const jsonPath = path.join(OUT, 'export-sample.json'); fs.writeFileSync(jsonPath, JSON.stringify(data));
  await page.setInputFiles('[data-view="settings"] input[type="file"]', jsonPath); await sleep(500);
  expect(await modalOpen(), 'JSON 가져오기 교체/병합 모달');
  await snap('82-import-modal', { full: false }); await closeAll();
  const badPath = path.join(OUT, 'bad.json'); fs.writeFileSync(badPath, '{"hello":1}');
  await page.setInputFiles('[data-view="settings"] input[type="file"]', badPath); await sleep(250);
  await snap('83-import-error-toast', { full: false }); await sleep(3500);

  // 13. 도움말
  await page.click('#btn-help'); await sleep(300);
  await snap('90-help--desk-light', { full: false });
  await theme('dark'); await snap('90-help--desk-dark', { full: false }); await theme('light');
  await vp(400, 800); await snap('90-help--mobile', { full: false }); await vp(1280, 900);
  await closeAll();

  // 14. 포커스 표시(탭 → 빈 셀)
  await tab('board'); await res('r_sci1'); await week('2026-10-19');
  await page.focus('.cell.free'); await sleep(150); await snap('91-focus-cell', { full: false });
  await page.focus('.tabs [role="tab"].on'); await sleep(150); await snap('91-focus-tab', { full: false });

  // 15. 테마 토글 버튼 동작
  await page.evaluate(() => { localStorage.removeItem('edu.special-room-booking.theme'); delete document.documentElement.dataset.theme; });
  await page.click('#btn-theme'); await sleep(200);
  const th = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(th === 'dark', '테마 토글 클릭 → dark: ' + th);
  await page.click('#btn-theme'); await sleep(200); await theme('light');

  // 16. 빈 상태(교체 가져오기로 자원 0개)
  await page.evaluate(() => window.__app.actions.importData({ meta: { app: 'special-room-booking', version: 1 }, settings: window.__app.getState().data.settings, resources: [], classes: [], teachers: [], events: [], series: [], bookings: [] }, 'replace')); await sleep(400);
  await tab('board'); await snap('95-empty-board--desk-light'); await vp(400, 800); await snap('95-empty-board--mobile'); await vp(1280, 900);
  await tab('stats'); await snap('96-empty-stats--desk-light');
  await tab('calendar'); await snap('97-empty-calendar--desk-light');
  await tab('resources'); await snap('98-empty-resources--desk-light');

  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(shots, null, 2));
  log('shots=' + shots.length);
};
