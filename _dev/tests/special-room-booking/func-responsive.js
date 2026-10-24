// 특별실지기 QA — 400px 모바일(요일 탭·시트 모달·가로 스크롤), 다크 모드, 터치 타깃 (AC11)
'use strict';
module.exports = async (h) => {
  const { page, expect, shot, log, sleep } = h;
  const { $, modal, modalCount, state, startSample, closeModal, closeAll, tab, noHScroll } = require('./_helpers')(h);
  await startSample();
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(450);
  expect(await $('.day-tabs [data-day-tab]').count() === 5 && (await $('.day-tabs [data-day-tab]').first().textContent()).match(/월\d+\/\d+/), 'AC11 요일 탭 5개(요일+날짜)');
  expect(await $('.grid .gh.day').count() === 1 && await $('.grid .cell').count() === 8, 'AC11 한 열(8칸) 격자');
  expect(await noHScroll(), 'AC11 예약판 가로 스크롤 없음');
  expect(await page.evaluate(() => { const c = document.querySelector('.chips-row'); return c.scrollWidth > c.clientWidth && getComputedStyle(c).overflowX === 'auto'; }), '자원 칩은 컨테이너 내부 가로 스크롤');
  expect((await state()).ui.mobileDay === 1 && (await $('.day-tabs .on').getAttribute('data-day-tab')) === '1', '기본 월요일 탭');
  await shot('m-01-board');
  await $('[data-day-tab="3"]').click(); await sleep(200);
  expect((await $('.grid .gh.day b').textContent()) === '수' && (await state()).ui.mobileDay === 3 && (await $('.day-tabs .on').getAttribute('aria-selected')) === 'true', '요일 탭 수요일 전환');
  await page.evaluate(() => { window.__app.actions.selectResource('r_av'); window.__app.actions.goWeek('2026-11-16'); }); await sleep(200);
  const free = await page.evaluate(() => { const cells = [...document.querySelectorAll('.grid .cell.free')]; for (const c of cells) { const p = Number(c.dataset.period); if (cells.some(x => Number(x.dataset.period) === p + 1)) return { date: c.dataset.date, p }; } return null; });
  expect(!!free, '연속 빈 셀 존재');
  // 터치 드래그는 모바일에서 비활성(pointerType touch) — CDP 터치 시뮬레이션
  const c1 = await $(`.cell[data-date="${free.date}"][data-period="${free.p}"]`).boundingBox();
  const c2 = await $(`.cell[data-date="${free.date}"][data-period="${free.p + 1}"]`).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c1.x + c1.width / 2, y: c1.y + c1.height / 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c2.x + c2.width / 2, y: c2.y + c2.height / 2 }] });
  const selDuringTouch = await $('.cell.sel').count();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
  expect(selDuringTouch === 0, '모바일 터치 드래그 비활성(선택 하이라이트 없음)');
  await closeAll();
  await $(`.cell[data-date="${free.date}"][data-period="${free.p}"]`).click(); await sleep(300);
  expect(await modalCount() === 1, 'AC11 셀 탭 → 모달');
  const mb = await modal().boundingBox();
  expect(mb.width >= 398 && mb.width <= 400 && mb.y + mb.height >= 790, '모달 전체 폭 시트형(하단 고정): ' + JSON.stringify({ w: Math.round(mb.width), bottom: Math.round(mb.y + mb.height) }));
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.modal .form-grid')).gridTemplateColumns.split(' ').length === 1), '모달 폼 1열 배치');
  await modal().locator('select[name="pEnd"]').selectOption(String(free.p + 1)); await sleep(100);
  await modal().locator('select[name="classSel"]').selectOption('6-2'); await sleep(150);
  expect(await modal().locator('.validate .ok').count() === 1, 'AC11 select로 2교시 범위 지정 → 예약 가능');
  await shot('m-02-modal');
  expect(await noHScroll(), '모달 열린 상태 가로 스크롤 없음');
  await modal().locator('[data-act="save"]').click(); await sleep(300);
  const saved = (await state()).data.bookings.find(b => b.resourceId === 'r_av' && b.date === free.date && b.periodStart === free.p);
  expect(!!saved && saved.periodEnd === free.p + 1 && await $(`.block[data-booking-id="${saved.id}"]`).count() === 1, 'AC11 모바일 저장 → 2교시 블록');
  for (const t of ['calendar', 'resources', 'stats', 'settings']) {
    await tab(t); await sleep(250);
    expect(await noHScroll(), `400px ${t} 탭 가로 스크롤 없음`);
    await shot('m-03-' + t);
  }
  await tab('stats');
  expect(await page.evaluate(() => [...document.querySelectorAll('.chart-wrap')].every(w => getComputedStyle(w).overflowX === 'auto') && [...document.querySelectorAll('.table-wrap')].every(w => getComputedStyle(w).overflowX === 'auto')), '차트·표 컨테이너 overflow-x auto');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.kpi-row')).gridTemplateColumns.split(' ').length === 2), 'KPI 카드 2열');
  await $('[data-act="stats-print"]').click(); await sleep(400);
  expect(await modalCount() === 1 && await noHScroll(), '400px 실적 보고 미리보기 열림·페이지 가로 스크롤 없음');
  await closeModal();
  await tab('board'); await $('[data-act="print-week"]').click(); await sleep(400);
  expect(await modalCount() === 1 && await noHScroll() && await page.evaluate(() => { const w = document.querySelector('.paper-wrap'); return w.scrollWidth > w.clientWidth; }), '400px 주간표 미리보기: 종이는 컨테이너 내부 스크롤');
  await closeModal();
  await $('[data-act="series"]').click(); await sleep(300);
  expect(await modalCount() === 1 && await noHScroll(), '400px 정기 예약 모달');
  await closeModal();
  await tab('calendar'); await $('[data-act="event-add"]').click(); await sleep(300);
  expect(await modalCount() === 1 && await noHScroll(), '400px 일정 모달');
  await closeModal();
  const small = await page.evaluate(() => [...document.querySelectorAll('.tabs [role=tab], .day-tabs button, .icon-btn, .btn:not(.btn-sm)')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 40).map(b => (b.textContent.trim() || b.getAttribute('aria-label')) + ':' + Math.round(b.getBoundingClientRect().height)));
  expect(small.length === 0, '탭·요일 탭·아이콘·일반 버튼 높이 40px 이상: ' + small.join(','));
  await tab('board');
  const tabH = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.tabs [role=tab], .day-tabs button, .icon-btn')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)));
  expect(tabH >= 44, '탭·요일 탭·아이콘 버튼 44px 이상: ' + tabH);
  await tab('board');
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(450);
  expect(await $('.grid .gh.day').count() === 5 && await $('.day-tabs').count() === 0, '데스크톱 복귀 시 5열 격자(matchMedia 재렌더)');

  // ── 다크 모드(OS 설정)
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(300);
  const dark = await page.evaluate(() => { const cs = getComputedStyle(document.body); return { bg: cs.backgroundColor, fg: cs.color, scheme: getComputedStyle(document.documentElement).colorScheme, theme: document.documentElement.dataset.theme || null, sun: getComputedStyle(document.querySelector('.ic-sun')).display }; });
  expect(dark.scheme === 'dark' && dark.theme === null && dark.bg === 'rgb(18, 22, 29)' && dark.fg === 'rgb(230, 234, 240)' && dark.sun === 'block', 'OS 다크 → 토큰 적용(data-theme 없음, 아이콘 전환): ' + JSON.stringify(dark));
  for (const t of ['board', 'calendar', 'resources', 'stats', 'settings']) { await tab(t); await sleep(150); await shot('dark-' + t); }
  await tab('board');
  const blk = await page.evaluate(() => { const b = document.querySelector('.block'); const cs = getComputedStyle(b); return { color: cs.color, bg: cs.backgroundColor }; });
  expect(blk.color === 'rgb(27, 34, 48)', '다크에서도 블록 글자는 어두운 색 고정(밝은 학년 배경 위): ' + JSON.stringify(blk));
  await $('.grid .cell.free').first().click(); await sleep(250);
  const mcol = await page.evaluate(() => { const m = document.querySelector('.modal'); const cs = getComputedStyle(m); const inp = getComputedStyle(document.querySelector('.modal input[name="date"]')); return { bg: cs.backgroundColor, fg: cs.color, inpBg: inp.backgroundColor, inpFg: inp.color }; });
  expect(mcol.bg === 'rgb(27, 33, 43)' && mcol.fg === 'rgb(230, 234, 240)' && mcol.inpBg === 'rgb(27, 33, 43)' && mcol.inpFg === 'rgb(230, 234, 240)', '다크 모달·입력 토큰 적용: ' + JSON.stringify(mcol));
  await shot('dark-modal');
  await closeModal();
  await tab('stats');
  const txt = await page.evaluate(() => ({ text: getComputedStyle(document.querySelector('.chart text')).fill, bar: getComputedStyle(document.querySelector('.bar.c1')).fill, kpi: getComputedStyle(document.querySelector('.kpi b')).color }));
  expect(txt.text === 'rgb(230, 234, 240)' && txt.bar === 'rgb(143, 179, 222)' && txt.kpi === 'rgb(143, 179, 222)', '다크 모드 차트 텍스트·막대·KPI 밝은 토큰: ' + JSON.stringify(txt));
  await $('[data-act="stats-print"]').click(); await sleep(400);
  const paper = await page.evaluate(() => { const p = document.querySelector('.paper'); const cs = getComputedStyle(p); return { bg: cs.backgroundColor, fg: cs.color }; });
  expect(paper.bg === 'rgb(255, 255, 255)' && paper.fg === 'rgb(0, 0, 0)', '다크에서도 인쇄 미리보기 종이는 흰 바탕·검정 글자');
  await closeModal();
  await $('#btn-theme').click(); await sleep(150);
  expect(await page.evaluate(() => document.documentElement.dataset.theme === 'light' && getComputedStyle(document.body).backgroundColor === 'rgb(242, 243, 245)' && localStorage.getItem('edu.special-room-booking.theme') === '"light"'), 'OS 다크 + 토글 → light 강제 저장');
  await page.emulateMedia({ colorScheme: 'light' });
  await shot('dark-99-end');

  // ── 접근성 보조: 모달 포커스 트랩, 온보딩 ESC 처리
  await tab('board'); await $('.grid .cell.free').first().click(); await sleep(250);
  let escaped = false; for (let i = 0; i < 40 && !escaped; i++) { await page.keyboard.press('Tab'); escaped = await page.evaluate(() => !document.activeElement.closest('.modal')); }
  expect(!escaped, '모달 내 Tab 순환(포커스 트랩) — 40회 Tab 동안 모달 밖으로 나가지 않음');
  await closeAll();
  await page.evaluate(() => localStorage.clear()); await h.reload(); await sleep(400);
  expect(await $('[data-result="sample"]').count() === 1, '온보딩 재표시');
  await page.keyboard.press('Escape'); await sleep(400);
  const ob = await page.evaluate(() => ({ onboarded: localStorage.getItem('srb.v1.onboarded'), res: window.__app.getState().data.resources.length, modal: document.querySelectorAll('.modal-backdrop:not(.closing)').length }));
  log('온보딩 ESC → ' + JSON.stringify(ob));
  expect(ob.modal === 1 || ob.onboarded === null, '온보딩에서 ESC/닫기 시 선택 없이 진행하지 않음(모달 유지 또는 미완료 유지): ' + JSON.stringify(ob));
};
