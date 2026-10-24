// reverify-r1-minors.js — 1라운드 minor 수정 재검증·회귀 확인(F-03/F-04/F-06, C-06~C-10, C-14, U-08/U-09/U-15 등)
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'reverify-r1-minors');
fs.mkdirSync(OUT, { recursive: true });

module.exports = async ({ page, expect, shot, log, sleep }) => {
  const $ = (sel, opts) => page.locator(sel, opts);
  const modalCount = () => $('.modal-backdrop:not(.closing)').count();
  const closeAll = async () => { for (let i = 0; i < 6 && (await modalCount()); i++) { await page.keyboard.press('Escape'); await sleep(250); } };
  const st = () => page.evaluate(() => window.__app.getState());
  const toasts = async () => (await $('.toast').allTextContents()).join(' | ');
  const clearToasts = () => page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const act = (name, arg) => page.evaluate(([n, a]) => { window.__app.actions[n](a); }, [name, arg]);
  const snap = async name => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p }); log('snap ' + p); return p; };

  await $('[data-result="sample"]').click(); await sleep(600);
  const good = (await st()).data;

  // C-07 / C-08 순수 함수
  const pure = await page.evaluate(() => ({ feb30: SRB.isValidDate('2026-02-30'), m13: SRB.isValidDate('2026-13-01'), ok: SRB.isValidDate('2026-10-31'), nonStr: SRB.isValidDate(20261031), rev: window.__app.actions.checkConflict('r_sci1', '2026-10-28', 4, 2, 1), outRange: window.__app.actions.checkConflict('r_sci1', '2026-10-28', 8, 9, 1), float: window.__app.actions.checkConflict('r_sci1', '2026-10-28', 1.5, 2, 1) }));
  log('pure=' + JSON.stringify(pure));
  expect(pure.feb30 === false && pure.m13 === false && pure.ok === true && pure.nonStr === false, 'C-07: isValidDate 실존 날짜만 허용');
  expect(pure.rev.ok === false && /교시 범위/.test(pure.rev.reasons[0]) && pure.outRange.ok === false && pure.float.ok === false, 'C-08: 역순·범위 밖·소수 교시는 checkConflict 거부');

  // U-08 / F-04 / C-06: 예약 모달 초기 안내·포커스 트랩·토스트 위치
  await act('selectResource', 'r_sci1'); await act('goWeek', '2026-10-26'); await sleep(300);
  await $('.cell.free').first().click(); await sleep(300);
  expect((await modalCount()) === 1, '빈 셀 클릭 → 예약 모달');
  expect((await $('.modal .validate .hint').count()) === 1 && (await $('.modal .validate .bad').count()) === 0 && (await $('.modal-foot [data-act="save"]').isDisabled()), 'U-08: 입력 전에는 회색 안내(빨간 오류 없음)·저장 비활성');
  const toastPos = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('#toast-root')); return { top: cs.top, bottom: cs.bottom, pe: cs.pointerEvents, modalOpen: document.body.classList.contains('modal-open') }; });
  expect(toastPos.modalOpen && toastPos.top === '16px' && toastPos.pe === 'none', 'C-06: 모달 열림 시 토스트 상단 이동·클릭 통과 ' + JSON.stringify(toastPos));
  let escaped = false; const seen = new Set();
  for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); const r = await page.evaluate(() => { const a = document.activeElement; return { inside: !!a.closest('.modal'), tag: a.tagName + (a.name ? '[' + a.name + ']' : '') + (a.dataset.act ? '[' + a.dataset.act + ']' : '') }; }); seen.add(r.tag); if (!r.inside) { escaped = true; log('escaped at ' + i + ' → ' + r.tag); break; } }
  for (let i = 0; i < 6 && !escaped; i++) { await page.keyboard.press('Shift+Tab'); if (!(await page.evaluate(() => !!document.activeElement.closest('.modal')))) { escaped = true; log('escaped on shift+tab ' + i); } }
  log('focus seen=' + Array.from(seen).join(','));
  expect(!escaped && seen.size >= 5, 'F-04/C-05: Tab·Shift+Tab 30회 동안 포커스가 모달 안에서 순환');
  await page.fill('.modal input[name="memo"]', '준비물'); await sleep(250); // 입력을 시작하면(touched) 미입력 항목이 빨간 사유로 전환
  expect((await $('.modal .validate .bad').count()) === 1 && /학급/.test(await $('.modal .validate').textContent()) && (await $('.modal-foot [data-act="save"]').isDisabled()), 'U-08: 입력 시작 후에는 미입력 사유 빨간 표시·저장 비활성 유지');
  await closeAll();
  const toastPos2 = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('#toast-root')); return { top: cs.top, bottom: cs.bottom, modalOpen: document.body.classList.contains('modal-open') }; });
  expect(!toastPos2.modalOpen && toastPos2.bottom === '16px', 'C-06: 모달 닫힘 → 토스트 우하단 복귀');

  // F-03: 예약 블록을 지나는 드래그 → 토스트 + 직전 범위 유지, 블록 위에서 놓으면 모달
  const target = await page.evaluate(() => { const cells = Array.from(document.querySelectorAll('.cell')); const by = {}; cells.forEach(c => { (by[c.dataset.date] = by[c.dataset.date] || {})[c.dataset.period] = c; }); for (const d of Object.keys(by).sort()) { const col = by[d]; for (let p = 1; p <= 6; p++) { const a = col[p], b = col[p + 1], c = col[p + 2]; if (a && b && c && a.classList.contains('free') && b.classList.contains('free') && c.classList.contains('full') && !c.classList.contains('blocked') && !c.classList.contains('closed')) return { date: d, p }; } } return null; });
  log('drag target=' + JSON.stringify(target));
  expect(!!target, '드래그 대상(빈 2칸 + 아래 예약 블록) 존재');
  if (target) {
    const box = async p => $(`.cell[data-date="${target.date}"][data-period="${p}"]`).boundingBox();
    const a = await box(target.p), b = await box(target.p + 1), c = await box(target.p + 2);
    await clearToasts();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 15, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 }); await sleep(100);
    const sel1 = await $('.cell.sel').count();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 6 }); await sleep(200);
    const sel2 = await $('.cell.sel').count(); const t = await toasts();
    log(`sel ${sel1} → ${sel2}, toast=${t}`);
    expect(sel1 === 2 && sel2 === 2, '드래그 선택 2칸 유지(블록을 지나도 확장 안 됨)');
    expect(/지나 선택할 수 없습니다/.test(t), 'F-03: 예약 블록을 지날 때 안내 토스트');
    await page.mouse.up(); await sleep(400);
    const rng = await page.evaluate(() => { const f = document.querySelector('.modal-backdrop:not(.closing) form'); return f ? [Number(f.elements.pStart.value), Number(f.elements.pEnd.value), f.elements.date.value] : null; });
    expect(!!rng && rng[0] === target.p && rng[1] === target.p + 1 && rng[2] === target.date, '블록 위에서 놓음 → 직전 유효 범위로 모달 ' + JSON.stringify(rng));
    await closeAll();
    // C-10: 격자 밖에서 놓으면 취소
    await clearToasts();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 15, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
    await page.mouse.move(4, b.y + b.height / 2, { steps: 5 }); await sleep(100); // x=4: body 좌측 패딩(격자 밖)
    const outsideEl = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? el.tagName + '.' + el.className : null; }, [4, b.y + b.height / 2]);
    await page.mouse.up(); await sleep(400);
    const t2 = await toasts();
    log('outside release el=' + outsideEl + ' toast=' + t2);
    expect((await modalCount()) === 0 && /격자 밖/.test(t2) && (await $('.cell.sel').count()) === 0, 'C-10: 격자 밖에서 놓으면 선택 해제·모달 없음·토스트(' + t2 + ')');
    await closeAll();
    // C-15: 드롭존 밖 파일 드롭은 기본 동작(파일로 이동) 차단 + 안내 토스트
    await clearToasts();
    const dropRes = await page.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['{}'], 'a.json', { type: 'application/json' })); const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }); document.body.dispatchEvent(over); const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }); document.body.dispatchEvent(drop); return { over: over.defaultPrevented, drop: drop.defaultPrevented }; });
    await sleep(200);
    expect(dropRes.over && dropRes.drop && /드롭존/.test(await toasts()), 'C-15: 드롭존 밖 드롭 preventDefault + 안내 토스트 ' + JSON.stringify(dropRes));
    // 회귀: 정상 드래그(2칸) → 모달 교시 범위
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 15, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 }); await sleep(100);
    await page.mouse.up(); await sleep(400);
    const rng2 = await page.evaluate(() => { const f = document.querySelector('.modal-backdrop:not(.closing) form'); return f ? [Number(f.elements.pStart.value), Number(f.elements.pEnd.value)] : null; });
    expect(!!rng2 && rng2[0] === target.p && rng2[1] === target.p + 1, 'AC2 회귀: 빈 셀 드래그 → 모달 범위 채움 ' + JSON.stringify(rng2));
    await page.selectOption('.modal select[name="classSel"]', '5-2'); await sleep(250);
    const tn = await page.evaluate(() => document.querySelector('.modal select[name="teacherId"]').selectedOptions[0].textContent);
    expect(/이가람/.test(tn), 'AC2: 5-2 선택 시 담임 이가람 자동');
    await clearToasts(); await $('.modal-foot [data-act="save"]').click(); await sleep(400);
    const saved = (await st()).data.bookings.find(b => b.date === target.date && b.resourceId === 'r_sci1' && b.periodStart === target.p && b.classId === '5-2');
    expect(!!saved && /예약되었습니다/.test(await toasts()) && (await $('.block', { hasText: '5-2 이가람' }).count()) >= 1, 'AC2: 저장 후 5-2 이가람 블록·토스트');
    if (saved) { await page.evaluate(id => window.__app.actions.deleteBooking(id), saved.id); await sleep(200); }
  }

  // C-09: 자원 비활성화 확인 모달(취소 시 되돌림)
  await act('selectTab', 'resources'); await sleep(300);
  await $('input[data-toggle="r_sci1"]').click(); await sleep(300);
  const dm = await page.evaluate(() => { const m = document.querySelector('.modal-backdrop:not(.closing) .modal'); return m ? m.textContent.replace(/\s+/g, ' ') : ''; });
  expect(/비활성화/.test(dm) && /오늘 이후 예약 \d+건/.test(dm), 'C-09: 비활성화 전 영향 예약 수 모달(' + dm.slice(0, 80) + ')');
  await $('.modal-foot [data-result=""]').click(); await sleep(300);
  const after = await page.evaluate(() => ({ checked: document.querySelector('input[data-toggle="r_sci1"]').checked, active: window.__app.getState().data.resources.find(r => r.id === 'r_sci1').active }));
  expect(after.checked && after.active, 'C-09: 취소 시 스위치·활성 상태 유지');
  await $('input[data-toggle="r_sci1"]').click(); await sleep(300); await $('.modal-foot [data-result="ok"]').click(); await sleep(300);
  const after2 = await page.evaluate(() => ({ active: window.__app.getState().data.resources.find(r => r.id === 'r_sci1').active, chips: 0 }));
  await act('selectTab', 'board'); await sleep(300);
  expect(!after2.active && (await $('.chip[data-resource="r_sci1"]').count()) === 0 && (await $('.chip[data-resource]').count()) === 9, 'C-09: 확인 시 비활성화 → 예약판 칩에서 숨김');
  await act('selectTab', 'resources'); await sleep(300); await $('input[data-toggle="r_sci1"]').click(); await sleep(300);
  expect((await st()).data.resources.find(r => r.id === 'r_sci1').active === true, '재활성화 즉시 적용');

  // U-15: 일정 추가 기본 날짜 = 보고 있는 달의 오늘/1일
  await act('selectTab', 'calendar'); await sleep(300);
  const today = await page.evaluate(() => SRB.todayStr());
  await $('[data-act="event-add"]').click(); await sleep(300);
  const d1 = await page.evaluate(() => document.querySelector('.modal input[name="dateStart"]').value);
  await closeAll();
  await $('[data-act="cal-next"]').click(); await sleep(300);
  const cm = (await st()).ui.calMonth;
  await $('[data-act="event-add"]').click(); await sleep(300);
  const d2 = await page.evaluate(() => document.querySelector('.modal input[name="dateStart"]').value);
  await closeAll(); await $('[data-act="cal-prev"]').click(); await sleep(200);
  log(`event default dates: ${d1} (today ${today}), ${d2} (calMonth ${cm})`);
  expect(d1 === today && d2 === cm + '-01', 'U-15: 일정 추가 기본 날짜 = 오늘 / 다음 달 1일');

  // F-06/C-14: 교시 축소 — 차단 메시지 라벨, 행사·시리즈 정리
  const added = await page.evaluate(() => window.__app.actions.addBooking({ resourceId: 'r_music', date: '2026-11-18', periodStart: 8, periodEnd: 8, classId: '2-1', teacherId: 't_04', tag: '음악' }));
  expect(added.ok === true, '방과후2 예약 추가(API)');
  await act('selectTab', 'settings'); await sleep(300);
  await page.fill('form[data-form="periods"] input[name="count"]', '6'); await page.keyboard.press('Tab'); await sleep(200);
  expect((await $('form[data-form="periods"] tbody tr').count()) === 6, '교시 개수 변경 시 표 행 6개로 갱신');
  await $('form[data-form="periods"] button[type="submit"]').click(); await sleep(300);
  const blockMsg = (await $('form[data-form="periods"] .validate').textContent()).trim();
  log('periods block msg=' + blockMsg);
  expect(/방과후1 이후에 예약 1건/.test(blockMsg) && (await st()).data.settings.periods.length === 8, 'F-06: 범위 밖 예약 시 라벨(방과후1 이후) 안내·변경 차단');
  await page.evaluate(id => window.__app.actions.deleteBooking(id), added.booking.id); await sleep(200);
  const mod = JSON.parse(JSON.stringify(good));
  mod.events.push({ id: 'e_p78', title: '방과후 차단', type: 'event', dateStart: '2026-11-16', dateEnd: '2026-11-16', blockResourceIds: ['r_gym'], blockPeriods: [7, 8], memo: '', updatedAt: 1 });
  mod.events.push({ id: 'e_p68', title: '6~8교시 차단', type: 'event', dateStart: '2026-11-17', dateEnd: '2026-11-17', blockResourceIds: ['r_gym'], blockPeriods: [6, 7, 8], memo: '', updatedAt: 1 });
  mod.series.push({ id: 's_p', resourceId: 'r_music', weekday: 3, periodStart: 7, periodEnd: 8, classId: '2-1', teacherId: 't_04', tag: '음악', qty: 1, dateFrom: '2026-09-01', dateTo: '2026-12-31', createdAt: 1 });
  await page.evaluate(o => window.__app.actions.importData(o, 'replace'), mod); await sleep(400);
  await act('selectTab', 'settings'); await sleep(300); await clearToasts();
  await page.fill('form[data-form="periods"] input[name="count"]', '6'); await page.keyboard.press('Tab'); await sleep(200);
  await $('form[data-form="periods"] button[type="submit"]').click(); await sleep(400);
  const tP = await toasts(); const sP = (await st()).data;
  const e78 = sP.events.find(e => e.id === 'e_p78'), e68 = sP.events.find(e => e.id === 'e_p68'), sp = sP.series.find(s => s.id === 's_p'), e05 = sP.events.find(e => e.id === 'e_05');
  log('periods cleanup toast=' + tP + ' e78=' + JSON.stringify(e78 && [e78.blockPeriods, e78.blockResourceIds]) + ' e68=' + JSON.stringify(e68 && e68.blockPeriods) + ' s_p=' + JSON.stringify(sp && [sp.periodStart, sp.periodEnd]));
  expect(sP.settings.periods.length === 6 && /6교시/.test(tP) && /3건을 정리/.test(tP), 'F-06/C-14: 6교시로 축소 저장·정리 건수 토스트');
  expect(!!e78 && e78.blockPeriods === 'all' && e78.blockResourceIds.length === 0 && !!e68 && JSON.stringify(e68.blockPeriods) === '[6]' && !!sp && sp.periodStart === 6 && sp.periodEnd === 6 && JSON.stringify(e05.blockPeriods) === '[5,6]', 'F-06/C-14: 행사 차단 교시 필터·시리즈 범위 클램프·기존 [5,6] 유지');
  expect(sP.resources.every(r => r.availablePeriods.every(p => p <= 6)), '자원 사용 가능 교시 정리');
  await act('selectTab', 'board'); await sleep(300);
  expect((await $('.cell').count()) === 30 && (await $('.ph').count()) === 6, '축소 후 격자 6행 렌더');
  await page.evaluate(o => window.__app.actions.importData(o, 'replace'), good); await sleep(300);
  expect((await st()).data.settings.periods.length === 8 && (await st()).data.bookings.length === good.bookings.length, '기준 데이터 복원');

  // U-09: 설정 라벨 줄바꿈 없음
  await act('selectTab', 'settings'); await sleep(300);
  const lbl = await page.evaluate(() => Array.from(document.querySelectorAll('[data-view="settings"] .row > label')).map(l => ({ t: l.firstChild.textContent.trim(), ws: getComputedStyle(l).whiteSpace, h: Math.round(l.getBoundingClientRect().height) })));
  log('labels=' + JSON.stringify(lbl));
  expect(lbl.length >= 2 && lbl.every(x => x.ws === 'nowrap' && x.h <= 48), 'U-09: 칸 수·교시 개수 라벨 한 줄');

  // 다크 모드 시각 확인용(U-18/U-20): 휴업일 주·블록 왼쪽 띠
  await act('selectTab', 'board'); await act('selectResource', 'r_sci1'); await act('goWeek', '2026-10-05'); await sleep(200);
  await act('setTheme', 'dark'); await sleep(300);
  const dark = await page.evaluate(() => { const closed = document.querySelector('.cell.closed'); const cell = document.querySelector('.cell.free'); return { closedBg: getComputedStyle(closed).backgroundColor, cellBg: getComputedStyle(cell).backgroundColor, closedImg: getComputedStyle(closed).backgroundImage.slice(0, 40), knob: getComputedStyle(document.documentElement).getPropertyValue('--knob').trim(), dangerFg: getComputedStyle(document.documentElement).getPropertyValue('--danger-fg').trim() }; });
  log('dark=' + JSON.stringify(dark));
  expect(dark.closedBg === 'rgb(46, 54, 66)' && /repeating-linear-gradient/.test(dark.closedImg) && dark.knob === '#E6EAF0' && dark.dangerFg === '#1B0F0E', 'U-20/U-18/C-11: 다크 휴업일 배경·가로선·토큰(knob/danger-fg) 적용');
  await shot('rv-dark-holiday-week');
  await act('setTheme', 'light'); await sleep(200);
  await page.evaluate(() => localStorage.removeItem('edu.special-room-booking.theme'));

  // AC12 회귀: 지난 예약 사용 안 함 → 미사용률 증가
  await act('goWeek', '2026-09-14'); await sleep(300);
  const before = await page.evaluate(() => window.__app.actions.computeStats('2026-09-01', '2026-12-31', 'all').summary.unusedRate);
  const pastId = await page.evaluate(() => { const data = window.__app.getState().data; const els = Array.from(document.querySelectorAll('.block.past')); const el = els.find(e => { const b = data.bookings.find(x => x.id === e.dataset.bookingId); return b && b.used !== false; }); return el ? el.dataset.bookingId : null; }); // 이미 '사용 안 함'인 건은 제외
  expect(!!pastId, '지난 예약 블록 존재(9/14 주, used≠false)');
  if (pastId) {
    await $(`.block[data-booking-id="${pastId}"]`).click(); await sleep(300);
    expect(!(await $('.modal .used-wrap').isHidden()), 'AC12: 지난 예약 모달에 사용 여부 토글');
    await $('.modal [data-used="false"]').click(); await sleep(150); await $('.modal-foot [data-act="save"]').click(); await sleep(400);
    const afterU = await page.evaluate(() => window.__app.actions.computeStats('2026-09-01', '2026-12-31', 'all').summary.unusedRate);
    const b = (await st()).data.bookings.find(x => x.id === pastId);
    log(`unusedRate ${before} → ${afterU}, used=${b && b.used}`);
    expect(b && b.used === false && (afterU > before || (b.used === false && before === null)), 'AC12: 사용 안 함 저장 → used=false·미사용률 증가');
  }
  log('done');
};
