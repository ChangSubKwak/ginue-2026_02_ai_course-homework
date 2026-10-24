// ux-shots.js — 자리뚝딱 모든 화면/탭/모달 스크린샷 (데스크톱 1280 라이트·다크, 모바일 400, 태블릿 820, 인쇄 미디어)
'use strict';
const path = require('path');

module.exports = async ({ page, expect, shot, log, sleep }) => {
  const first = await shot('_probe');
  const outdir = path.dirname(first);
  const shots = [];
  const shotV = async (name) => { const p = path.join(outdir, name + '.png'); await page.screenshot({ path: p, fullPage: false }); shots.push(p); return p; };
  const shotF = async (name) => { const p = await shot(name); shots.push(p); return p; };
  const tab = async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await sleep(250); };
  const closeModal = async () => { if (await page.locator('.modal-back').count()) { await page.keyboard.press('Escape'); await sleep(200); } };
  const noHScroll = async (label) => {
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(r.sw <= r.cw + 1, `${label}: 가로 스크롤 없음 (scrollWidth ${r.sw} / clientWidth ${r.cw})`);
  };
  const metrics = async (label) => {
    const m = await page.evaluate(() => {
      const q = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, color: cs.color, bg: cs.backgroundColor }; };
      return { body: getComputedStyle(document.body).fontSize, hint: q('.hint'), chip: q('.chip'), seg: q('.seg button'), lock: q('.seat-card .lock'), tabBtn: q('#tabs [role=tab]'), counter: q('.counter span'), repRow: q('.rep-row'), seatName: q('.seat-card .name'), seatNo: q('.seat-card .no'), chipBtn: q('.chip-btn'), iconSm: q('.icon-btn.sm'), tagline: q('.tagline'), heatLabel: q('.heat .hl'), zrow: q('.zrow'), role: q('.role') };
    });
    log(`${label} metrics: ` + JSON.stringify(m));
  };

  // ── 1) 첫 방문 투어 모달 ──
  await sleep(600);
  expect(await page.locator('.modal-back').count() === 1, '첫 방문 투어 모달 표시');
  await shotV('d-light-00-tour-step1');
  await page.click('.modal-back [data-m="ok"]'); await sleep(250); await shotV('d-light-00-tour-step2');
  await page.click('.modal-back [data-m="ok"]'); await sleep(250); await shotV('d-light-00-tour-step3');
  await page.click('.modal-back [data-m="ok"]'); await sleep(250);
  expect(await page.locator('.modal-back').count() === 0, '투어 완료 후 모달 닫힘');

  // ── 2) 명렬 탭 ──
  await shotF('d-light-01-roster');
  await metrics('desktop roster');
  const rosterWrap = await page.evaluate(() => { const w = document.querySelector('#roster-table'); const t = w.querySelector('table'); return { wrap: w.clientWidth, table: t.scrollWidth }; });
  log('roster table width vs wrap: ' + JSON.stringify(rosterWrap));
  expect(rosterWrap.table <= rosterWrap.wrap, `데스크톱 1280에서 명렬 표가 카드 안에 다 보임 (table ${rosterWrap.table} / wrap ${rosterWrap.wrap})`);
  await page.click('[data-action="help"]'); await sleep(250); await shotV('d-light-02-help-global'); await closeModal();
  await page.click('[data-help="roster"]'); await sleep(250); await shotV('d-light-03-help-roster'); await closeModal();
  await page.click('#class-name-btn'); await sleep(250); await shotV('d-light-04-modal-classname'); await closeModal();
  await page.fill('#paste-area', '1\t김가상\t남\n2\t이가상\t여\n3\t박가상\t남\n4\t최가상');
  await page.click('[data-action="parse-paste"]'); await sleep(250); await shotF('d-light-05-paste-preview');
  await page.click('[data-action="clear-paste"]'); await sleep(150);
  await page.click('#roster-table tr:nth-child(1) [data-action="del-student"]'); await sleep(250); await shotV('d-light-06-modal-delete-student'); await closeModal();

  // ── 3) 자리 배치 탭 ──
  await tab('seats'); await shotF('d-light-10-seats-empty');
  await page.click('[data-help="seats"]'); await sleep(250); await shotV('d-light-11-help-seats'); await closeModal();
  await page.click('#btn-auto'); await sleep(600); await shotF('d-light-12-seats-auto');
  await metrics('desktop seats');
  const rep = await page.evaluate(() => document.querySelector('#report').innerText);
  log('report: ' + rep.replace(/\n/g, ' | '));
  expect(/분리 쌍[\s\S]*2\/2 충족/.test(rep) || /2\/2 충족/.test(rep), '리포트에 2/2 충족 표시');
  expect(await page.locator('#seatmap .seat-card').count() === 24, '좌석 카드 24개');
  // 탭 선택 상태 + 잠금
  const firstCardSeat = await page.locator('#seatmap .seat.filled').first();
  await firstCardSeat.locator('.seat-card').click(); await sleep(200); await shotV('d-light-13-seats-tapsel');
  await firstCardSeat.locator('.seat-card').click(); await sleep(100);
  await page.locator('#seatmap .seat.filled .lock').first().click(); await sleep(200); await shotV('d-light-14-seats-locked');
  // 분리 쌍 인접 → 위반 토스트
  for (let attempt = 0; attempt < 4; attempt++) {
    const st = await page.evaluate(() => window.__app.getState());
    const byName = (n) => st.state.students.find(s => s.name === n).id;
    const seatOf = (sid) => Object.keys(st.state.current.seats).find(k => st.state.current.seats[k] === sid);
    const cellOf = (key) => st.state.layout.cells.find(c => (c.r + '-' + c.c) === key);
    const kA = seatOf(byName('최민준')), kB = seatOf(byName('강시우'));
    const pg = cellOf(kA).pairGroup; const partner = st.state.layout.cells.find(c => c.desk && c.pairGroup === pg && (c.r + '-' + c.c) !== kA);
    const kP = partner ? partner.r + '-' + partner.c : null;
    log(`violation attempt ${attempt}: A=${kA} B=${kB} partner=${kP} partnerFilled=${!!(kP && st.state.current.seats[kP])}`);
    if (kP && st.state.current.seats[kP] && kP !== kB) {
      await page.evaluate(([a, b]) => window.__app.actions.swapSeats(a, b), [kP, kB]); await sleep(150);
      if (await page.locator('#seatmap .seat.viol').count()) { await shotF('d-light-15-seats-violation-toast'); break; }
      await page.keyboard.press('Control+z'); await sleep(150);
    }
    await page.click('#btn-shuffle'); await sleep(600);
  }
  const repV = await page.evaluate(() => document.querySelector('#report').innerText); log('violation report: ' + repV.replace(/\n/g, ' | '));
  expect(await page.locator('#seatmap .seat.viol').count() >= 1, '분리 쌍 인접 시 빨간 테두리 좌석');
  await page.keyboard.press('Control+z'); await sleep(200);
  expect(await page.locator('#seatmap .seat.viol').count() === 0, 'Ctrl+Z 후 위반 해제');
  // 편집 모드
  await page.check('#edit-mode'); await sleep(200); await shotF('d-light-16-seats-editmode'); await page.uncheck('#edit-mode'); await sleep(150);
  // 책상 부족
  await page.evaluate(() => window.__app.actions.rebuildLayout({ params: { sections: 2 } })); await sleep(250); await shotF('d-light-17-seats-shortage');
  const cnt = await page.evaluate(() => document.querySelector('#desk-counter').innerText); log('counter: ' + cnt);
  expect(/책상 20 \/ 학생 24/.test(cnt) && await page.locator('#btn-auto').isDisabled(), '책상 20/학생 24 빨간 카운터 + 자동 배치 비활성');
  await page.evaluate(() => window.__app.actions.rebuildLayout({ params: { sections: 3 } })); await sleep(200);
  // 하드 앞자리 위반 + 완화 제안: 앞자리 태그 늘리기
  await tab('roster');
  const frontBtns = page.locator('#roster-table tr:not(.is-inactive) .chip-btn.tag-front:not(.is-on)');
  const toggled = [];
  for (let i = 0; i < 12; i++) { const b = page.locator('#roster-table tr:not(.is-inactive) .chip-btn.tag-front:not(.is-on)').first(); const id = await b.evaluate(el => el.closest('tr').dataset.id); toggled.push(id); await b.click(); await sleep(60); }
  await tab('seats'); await page.click('#btn-auto'); await sleep(900); await shotF('d-light-18-seats-hard-violation');
  const repH = await page.evaluate(() => document.querySelector('#report').innerText); log('hard violation report: ' + repH.replace(/\n/g, ' | '));
  expect(/완화 제안/.test(repH), '하드 위반 시 완화 제안 표시');
  await tab('roster');
  for (const id of toggled) { await page.click(`#roster-table tr[data-id="${id}"] .chip-btn.tag-front`); await sleep(40); }
  await tab('seats'); await page.click('#btn-auto'); await sleep(700);
  // 다른 프리셋들
  for (const [p, nm] of [['group4', 'group4'], ['u', 'u'], ['exam', 'exam']]) {
    await page.evaluate((pp) => window.__app.actions.rebuildLayout({ preset: pp, params: pp === 'u' ? { cols: 10, rows: 5 } : {} }), p); await sleep(200);
    const dis = await page.locator('#btn-auto').isDisabled(); log(`preset ${nm}: counter=${await page.evaluate(() => document.querySelector('#desk-counter').innerText)} autoDisabled=${dis}`);
    if (!dis) { await page.click('#btn-auto'); await sleep(700); }
    await shotF('d-light-19-seats-preset-' + nm);
  }
  await page.evaluate(() => window.__app.actions.rebuildLayout({ preset: 'pair' })); await sleep(200); await page.click('#btn-auto'); await sleep(700);
  // 교탁 아래
  await page.click('[data-action="teacher-side"][data-v="bottom"]'); await sleep(200); await shotF('d-light-20-seats-teacher-bottom');
  await page.click('[data-action="teacher-side"][data-v="top"]'); await sleep(200);
  // 줌 최소
  await page.evaluate(() => { const z = document.querySelector('#zoom'); z.value = 48; z.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(200); await shotF('d-light-21-seats-zoom-min');
  await page.evaluate(() => { const z = document.querySelector('#zoom'); z.value = 84; z.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(100);
  // 배치 확정 모달
  await page.click('#btn-confirm'); await sleep(250); await shotV('d-light-22-modal-confirm'); await closeModal();
  // 레이아웃 저장 모달
  await page.click('[data-action="save-layout"]'); await sleep(250); await shotV('d-light-23-modal-save-layout'); await closeModal();

  // ── 4) 발표 모드 ──
  await page.click('#btn-present'); await sleep(500); await shotV('d-light-30-present-start');
  const pr = await page.evaluate(() => ({ hidden: document.querySelector('#present').hidden, fallback: document.querySelector('#present').classList.contains('fallback'), cell: getComputedStyle(document.querySelector('#present-map')).getPropertyValue('--cell') }));
  log('present: ' + JSON.stringify(pr));
  expect(!pr.hidden, '발표 모드 오버레이 표시');
  expect(await page.locator('#present-map .face.front').count() === 24, '발표 모드 카드 24장 ? 뒷면');
  await page.click('#pr-start'); await sleep(1800); await page.click('#pr-start'); await sleep(300); await shotV('d-light-31-present-partial');
  await page.keyboard.press(' '); await sleep(400);
  await page.click('[data-action="pr-all"]'); await sleep(700); await shotV('d-light-32-present-all');
  await page.keyboard.press('Escape'); await sleep(300);
  expect(await page.evaluate(() => document.querySelector('#present').hidden), 'Esc로 발표 모드 종료');

  // ── 5) 모둠 탭 ──
  await tab('groups'); await shotF('d-light-40-groups-empty');
  await page.click('[data-help="groups"]'); await sleep(250); await shotV('d-light-41-help-groups'); await closeModal();
  await page.click('#btn-make-groups'); await sleep(500); await shotF('d-light-42-groups-made');
  await metrics('desktop groups');
  expect(await page.locator('#group-grid .group-card').count() === 6, '모둠 카드 6개');
  const roleCounts = await page.evaluate(() => [...document.querySelectorAll('#group-grid .group-card')].map(c => [...c.querySelectorAll('.role')].map(r => r.textContent.trim()).sort().join(',')));
  log('roles per group: ' + JSON.stringify(roleCounts));
  expect(roleCounts.every(r => r === '기록이,나눔이,이끔이,지킴이'), '각 모둠에 역할 4종 1개씩');
  await page.locator('#group-grid .member').first().click(); await sleep(200); await shotV('d-light-43-groups-tapsel');
  await page.locator('#group-grid .member').first().click(); await sleep(100);
  await page.locator('#group-grid .role').first().click(); await sleep(250); await shotV('d-light-44-modal-role'); await closeModal();
  await page.locator('#group-grid .gname').first().click(); await sleep(250); await shotV('d-light-45-modal-rename-group'); await closeModal();
  await page.click('#btn-confirm-groups'); await sleep(250); await shotV('d-light-46-modal-confirm-groups'); await closeModal();
  // 모둠 인원 모드 5명 → 편차
  await page.check('input[name=gmode][value=size]'); await page.fill('#g-size', '5'); await page.click('#btn-make-groups'); await sleep(500); await shotF('d-light-47-groups-size5');
  await page.check('input[name=gmode][value=count]'); await page.fill('#g-count', '6'); await page.click('#btn-make-groups'); await sleep(500);

  // ── 6) 히스토리·공정성 ──
  await tab('history'); await sleep(300); await shotF('d-light-50-history');
  await metrics('desktop history');
  await page.click('[data-help="history"]'); await sleep(250); await shotV('d-light-51-help-history'); await closeModal();
  await page.locator('.hist-card.kind-seat').first().click(); await sleep(300); await shotV('d-light-52-modal-hist-seat'); await closeModal();
  await page.locator('.hist-card.kind-group').first().click(); await sleep(300); await shotV('d-light-53-modal-hist-group'); await closeModal();
  await page.click('#hist-filter [data-filter="group"]'); await sleep(200); await shotV('d-light-54-history-filter-group'); await page.click('#hist-filter [data-filter="all"]');
  // 히트맵 호버 툴팁
  const cell = page.locator('.heat .hc').nth(30); await cell.hover(); await sleep(200); await shotV('d-light-55-heatmap-tooltip');
  const tipTxt = await page.evaluate(() => document.querySelector('#tooltip').textContent); log('heat tooltip: ' + tipTxt);
  const biased = await page.evaluate(() => [...document.querySelectorAll('.zrow.is-bad .zname')].map(x => x.textContent)); log('biased: ' + JSON.stringify(biased));
  expect(biased.some(x => /양은우/.test(x)), '양은우 편중 주의 배지');

  // ── 7) 설정 ──
  await tab('settings'); await shotF('d-light-60-settings');
  await page.click('[data-help="settings"]'); await sleep(250); await shotV('d-light-61-help-settings'); await closeModal();
  await page.click('[data-action="wipe"]'); await sleep(250); await shotV('d-light-62-modal-wipe-1'); await closeModal();
  await page.click('[data-action="reset-sample"]'); await sleep(250); await shotV('d-light-63-modal-reset-sample'); await closeModal();

  // ── 8) 인쇄 미리보기 ──
  await tab('seats');
  await page.click('#btn-print'); await sleep(500); await shotV('d-light-70-print-student');
  const pc = async () => page.evaluate(() => document.querySelector('#print-pagecount').textContent);
  log('print student: ' + await pc());
  await page.check('input[name=print-kind][value=teacher]'); await sleep(400); await shotV('d-light-71-print-teacher');
  await page.check('input[name=print-kind][value=groups]'); await sleep(400); await shotV('d-light-72-print-groups');
  await page.check('input[name=print-kind][value=plates]'); await sleep(400); await shotF('d-light-73-print-plates'); log('print plates: ' + await pc());
  expect(/총 6페이지/.test(await pc()), '명패 6페이지');
  // 인쇄 미디어 에뮬레이션
  const setKind = async (k) => { await page.evaluate((kk) => { const r = document.querySelector(`input[name=print-kind][value=${kk}]`); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }, k); await sleep(400); };
  await page.emulateMedia({ media: 'print' }); await sleep(300); await shotF('d-print-74-plates-media');
  await setKind('student'); await shotF('d-print-75-student-media');
  await setKind('teacher'); await shotF('d-print-76-teacher-media');
  await setKind('groups'); await shotF('d-print-77-groups-media');
  await page.emulateMedia({ media: 'screen' }); await sleep(200);
  const printInfo = await page.evaluate(() => { const p = document.querySelector('#print-pages .page'); return { pageW: p.offsetWidth, pageH: p.offsetHeight, pageCss: document.querySelector('#page-style').textContent }; }); log('print page: ' + JSON.stringify(printInfo));
  await page.uncheck('#opt-gender'); await page.uncheck('#opt-no'); await page.check('input[name=print-kind][value=student]'); await sleep(400); await shotV('d-light-78-print-student-nogender');
  await page.check('#opt-gender'); await page.check('#opt-no');
  await page.keyboard.press('Escape'); await sleep(200);
  expect(await page.evaluate(() => document.querySelector('#print-panel').hidden), 'Esc로 인쇄 미리보기 닫힘');

  // ── 9) 다크 모드 (데스크톱) ──
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(300);
  await tab('roster'); await shotF('d-dark-01-roster');
  await tab('seats'); await shotF('d-dark-12-seats-auto'); await metrics('dark seats');
  await page.click('#btn-confirm'); await sleep(250); await shotV('d-dark-22-modal-confirm'); await closeModal();
  await page.click('[data-help="seats"]'); await sleep(250); await shotV('d-dark-11-help'); await closeModal();
  await page.click('#btn-present'); await sleep(400); await page.click('[data-action="pr-all"]'); await sleep(700); await shotV('d-dark-32-present-all'); await page.keyboard.press('Escape'); await sleep(200);
  await tab('groups'); await shotF('d-dark-42-groups');
  await tab('history'); await sleep(300); await shotF('d-dark-50-history');
  await page.locator('.hist-card.kind-seat').first().click(); await sleep(300); await shotV('d-dark-52-modal-hist-seat'); await closeModal();
  await tab('settings'); await shotF('d-dark-60-settings');
  await page.click('#btn-print'); await sleep(400); await shotV('d-dark-70-print-student'); await page.check('input[name=print-kind][value=plates]'); await sleep(400); await shotV('d-dark-73-print-plates'); await page.keyboard.press('Escape'); await sleep(200);
  // 테마 토글 버튼 동작 확인
  await page.click('#theme-btn'); await sleep(200);
  const themeAttr = await page.evaluate(() => document.documentElement.dataset.theme); log('after toggle in dark system: data-theme=' + themeAttr);
  expect(themeAttr === 'light', '다크(시스템)에서 토글 → light');
  await tab('seats'); await shotV('d-light-toggle-seats');
  await page.click('#theme-btn'); await sleep(200);
  expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', '토글 → dark');
  await page.emulateMedia({ colorScheme: 'light' }); await page.click('#theme-btn'); await sleep(200);   // 다시 light 상태로

  // ── 10) 태블릿 820 ──
  await page.setViewportSize({ width: 820, height: 1100 }); await sleep(300);
  await tab('roster'); await shotF('t-820-01-roster'); await noHScroll('tablet roster');
  await tab('seats'); await sleep(200); await shotF('t-820-12-seats'); await noHScroll('tablet seats');
  await tab('groups'); await shotF('t-820-42-groups');
  await tab('history'); await sleep(200); await shotF('t-820-50-history');
  await page.click('#btn-print'); await sleep(400); await shotV('t-820-70-print'); await page.keyboard.press('Escape'); await sleep(200);

  // ── 11) 모바일 400 ──
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  await tab('roster'); await shotF('m-400-01-roster'); await noHScroll('mobile roster'); await metrics('mobile roster');
  await page.click('[data-action="help"]'); await sleep(250); await shotV('m-400-02-help'); await closeModal();
  await page.fill('#paste-area', '1\t김가상\t남\n2\t이가상'); await page.click('[data-action="parse-paste"]'); await sleep(250); await shotF('m-400-05-paste-preview'); await page.click('[data-action="clear-paste"]');
  await tab('seats'); await sleep(300); await shotF('m-400-12-seats'); await noHScroll('mobile seats'); await metrics('mobile seats');
  const mSeat = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); return { wrapW: w.clientWidth, scrollW: w.scrollWidth, cell: getComputedStyle(w).getPropertyValue('--cell') }; }); log('mobile seatmap: ' + JSON.stringify(mSeat));
  await page.evaluate(() => { const z = document.querySelector('#zoom'); z.value = 48; z.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(200); await shotV('m-400-13-seats-zoom-min');
  await page.evaluate(() => { const z = document.querySelector('#zoom'); z.value = 84; z.dispatchEvent(new Event('input', { bubbles: true })); });
  // 모바일 탭-탭 교환
  const cards = page.locator('#seatmap .seat.filled .seat-card');
  const n1 = await cards.nth(0).getAttribute('data-sid'), n2 = await cards.nth(1).getAttribute('data-sid');
  await cards.nth(0).click(); await sleep(150); await shotV('m-400-14-seats-tapsel'); await cards.nth(1).click(); await sleep(200);
  const after = await page.evaluate(() => [...document.querySelectorAll('#seatmap .seat.filled .seat-card')].slice(0, 2).map(c => c.dataset.sid));
  expect(after[0] === n2 && after[1] === n1, '모바일 탭-탭 교환 동작');
  await page.click('#btn-confirm'); await sleep(250); await shotV('m-400-22-modal-confirm'); await closeModal();
  await page.click('#btn-present'); await sleep(500); await shotV('m-400-30-present'); await page.click('[data-action="pr-all"]'); await sleep(700); await shotV('m-400-32-present-all'); await page.keyboard.press('Escape'); await sleep(200);
  await tab('groups'); await sleep(200); await shotF('m-400-42-groups'); await noHScroll('mobile groups');
  await tab('history'); await sleep(300); await shotF('m-400-50-history'); await noHScroll('mobile history');
  await page.locator('.hist-card.kind-seat').first().click(); await sleep(300); await shotV('m-400-52-modal-hist-seat'); await closeModal();
  await tab('settings'); await shotF('m-400-60-settings'); await noHScroll('mobile settings');
  await page.click('#btn-print'); await sleep(500); await shotV('m-400-70-print'); await page.check('input[name=print-kind][value=plates]'); await sleep(400); await shotV('m-400-73-print-plates'); await page.keyboard.press('Escape'); await sleep(200);
  await page.emulateMedia({ colorScheme: 'dark' }); await tab('seats'); await sleep(200); await shotF('m-dark-12-seats'); await tab('roster'); await shotV('m-dark-01-roster'); await page.emulateMedia({ colorScheme: 'light' });

  // ── 12) 빈 상태 (데스크톱) ──
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(200);
  await page.evaluate(() => window.__app.actions.wipe()); await sleep(400);
  await tab('roster'); await shotF('d-empty-01-roster');
  await tab('seats'); await sleep(200); await shotF('d-empty-12-seats');
  await tab('groups'); await shotF('d-empty-42-groups');
  await tab('history'); await sleep(200); await shotF('d-empty-50-history');
  await tab('settings'); await shotF('d-empty-60-settings');
  const dis = await page.evaluate(() => ({ present: document.querySelector('#btn-present').disabled, print: document.querySelector('#btn-print').disabled, auto: document.querySelector('#btn-auto').disabled, make: document.querySelector('#btn-make-groups').disabled }));
  log('empty disabled: ' + JSON.stringify(dis));
  expect(dis.present && dis.print && dis.auto && dis.make, '학생 0명: 발표·인쇄·자동 배치·편성 비활성');
  await page.evaluate(() => window.__app.actions.resetSample()); await sleep(300);
  log('SHOTS=' + JSON.stringify(shots));
};
