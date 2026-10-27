// 특별실지기 QA — 예약판·예약 모달·충돌·수량형·키보드·테마·복원·사용 여부 (AC1~4, 10, 12, 13)
'use strict';
module.exports = async (h) => {
  const { page, expect, shot, log, sleep, reload } = h;
  const { $, modal, modalCount, state, startSample, closeModal, closeAll, tab } = require('./_helpers')(h);

  // ── AC1 온보딩 → 샘플
  expect(await $('.modal-backdrop').count() === 1 && (await modal().textContent()).includes('샘플로 시작'), 'AC1 온보딩 모달(샘플/빈 상태 선택) 표시');
  expect(await $('.modal-backdrop .choice[data-result="empty"]').count() === 1 && (await modal().textContent()).includes('공용 PC'), 'AC1 빈 상태 선택지 + 운영 방법 안내');
  await startSample();
  expect(await $('.chip[data-resource]').count() === 10, 'AC1 자원 칩 10개');
  expect(await $('.grid .gh.day').count() === 5 && await $('.grid .ph').count() === 8 && await $('.grid .cell').count() === 40, 'AC1 월~금 × 8교시 격자(40칸)');
  expect(await $('.grid .block').count() >= 1, 'AC1 예약 블록 1개 이상');
  const st0 = await state();
  log('bookings=' + st0.data.bookings.length + ' weekStart=' + st0.ui.weekStart);
  expect(st0.data.bookings.length >= 150, '샘플 예약 150건 이상 (' + st0.data.bookings.length + ')');
  expect((await $('#school-label').textContent()).includes('경인초등학교'), '헤더 학교명·학기 표시');
  expect(/이번 주 예약 \d+건 · 빈 교시 \d+칸/.test(await $('.summary').textContent()), '하단 요약 표시');
  expect(await $('.legend li').count() >= 8, '범례 표시');
  await shot('board-01-initial');

  // ── 모든 탭 열림 + 키보드 탭 이동
  for (const t of ['calendar', 'resources', 'stats', 'settings', 'board']) {
    await tab(t);
    const vis = await $(`[data-view="${t}"]`).isVisible(); const html = await $(`[data-view="${t}"]`).innerHTML();
    expect(vis && html.length > 200 && (await $(`.tabs [data-tab="${t}"]`).getAttribute('aria-selected')) === 'true', `탭 '${t}' 열림·aria-selected`);
  }
  await $('.tabs [data-tab="board"]').focus(); await page.keyboard.press('ArrowRight'); await sleep(200);
  expect(await $('[data-view="calendar"]').isVisible(), '탭 ArrowRight 키보드 이동');
  await tab('board');

  // ── 주 이동
  const week0 = (await state()).ui.weekStart;
  await $('[data-act="next-week"]').click(); await sleep(200);
  const week1 = (await state()).ui.weekStart;
  expect(week1 > week0 && (await $('[data-act="pick-week"]').inputValue()) === week1, '▶ 다음 주 이동');
  await $('[data-act="prev-week"]').click(); await sleep(150); await $('[data-act="prev-week"]').click(); await sleep(200);
  expect((await state()).ui.weekStart < week0, '◀ 이전 주 이동');
  await $('[data-act="this-week"]').click(); await sleep(200);
  expect((await state()).ui.weekStart === week0, "'이번 주' 복귀");
  await $('[data-act="pick-week"]').fill('2026-10-17'); await $('[data-act="pick-week"]').dispatchEvent('change'); await sleep(200);
  expect((await state()).ui.weekStart === '2026-10-19', '토요일(10/17) 입력 → 다음 주 월요일(10/19) 정규화: ' + (await state()).ui.weekStart);
  expect((await $('.week-label').textContent()).includes('2026년 10월 4주'), '주차 라벨 2026년 10월 4주');
  await $('[data-act="pick-week"]').fill('2027-01-11'); await $('[data-act="pick-week"]').dispatchEvent('change'); await sleep(200);
  expect(await $('.notice-bar').count() === 1 && await $('.grid-wrap.dim').count() === 1 && await $('.grid .cell.free').count() === 0, '학기 밖 주: 안내 + 격자 흐림 + 빈 셀 예약 불가');
  await page.evaluate(() => window.__app.actions.goWeek('2026-10-05')); await sleep(200);
  expect(await $('.gh.day.closed').count() === 2 && (await $('.gh.day.closed').first().textContent()).includes('개천절'), '휴업일 열 머리 회색+사유(10/5, 10/9)');
  expect(await $('.cell.closed').count() === 16, '휴업일 열 셀 16칸 closed');
  await shot('board-02-holiday-week');

  // ── AC2 과학실1 드래그 → 모달 → 5-2 → 저장
  await page.evaluate(() => window.__app.actions.goWeek('2026-10-19'));
  await $('.chip[data-resource="r_sci1"]').click(); await sleep(200);
  expect((await $('.res-title h2').textContent()) === '과학실1' && (await $('.chip.on').getAttribute('data-resource')) === 'r_sci1', '칩 선택 → 자원 전환');
  const pair = await page.evaluate(() => { const cells = [...document.querySelectorAll('.grid .cell.free')]; for (const c of cells) { const n = cells.find(x => x.dataset.date === c.dataset.date && Number(x.dataset.period) === Number(c.dataset.period) + 1); if (n) return { date: c.dataset.date, p1: Number(c.dataset.period), p2: Number(c.dataset.period) + 1 }; } return null; });
  expect(!!pair, 'AC2 연속 빈 셀 존재');
  const a = await $(`.cell[data-date="${pair.date}"][data-period="${pair.p1}"]`).boundingBox();
  const b = await $(`.cell[data-date="${pair.date}"][data-period="${pair.p2}"]`).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 12, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 }); await sleep(100);
  expect(await $('.cell.sel').count() === 2, 'AC2 드래그 중 하이라이트 2칸');
  await shot('board-03-drag');
  await page.mouse.up(); await sleep(300);
  expect(await modalCount() === 1 && (await modal().locator('h2').textContent()) === '예약 등록', 'AC2 드래그 후 예약 모달');
  expect(await modal().locator('select[name="pStart"]').inputValue() === String(pair.p1) && await modal().locator('select[name="pEnd"]').inputValue() === String(pair.p2), 'AC2 시작·끝 교시 = 드래그 범위');
  expect(await modal().locator('input[name="date"]').inputValue() === pair.date && await modal().locator('select[name="resourceId"]').inputValue() === 'r_sci1', 'AC2 날짜·자원 채워짐');
  expect(await modal().locator('[data-act="save"]').isDisabled() && (await modal().locator('.validate').textContent()).includes('학급'), '학급 미선택 시 저장 비활성 + 안내');
  await modal().locator('select[name="classSel"]').selectOption('5-2'); await sleep(150);
  const tid = await modal().locator('select[name="teacherId"]').inputValue();
  const tname = await page.evaluate(id => (window.__app.getState().data.teachers.find(t => t.id === id) || {}).name, tid);
  expect(tname === '이가람', 'AC2 5-2 선택 → 담임 이가람 자동 입력');
  await modal().locator('[data-tag="실험"]').click();
  expect(await modal().locator('.validate .ok').count() === 1 && !(await modal().locator('[data-act="save"]').isDisabled()), 'AC2 녹색 예약 가능 + 저장 활성');
  await modal().locator('[data-act="save"]').click(); await sleep(300);
  expect(await modalCount() === 0, 'AC2 저장 후 모달 닫힘');
  const newBlock = await page.evaluate(({ date, p1, p2 }) => { const st = window.__app.getState(); const bk = st.data.bookings.find(x => x.resourceId === 'r_sci1' && x.date === date && x.periodStart === p1 && x.periodEnd === p2); const el = bk && document.querySelector(`.block[data-booking-id="${bk.id}"]`); return bk ? { id: bk.id, text: el ? el.textContent : '', style: el ? el.getAttribute('style') : '' } : null; }, pair);
  expect(!!newBlock && newBlock.text.includes('5-2 이가람') && newBlock.text.includes('실험') && newBlock.style.includes('span 2'), 'AC2 "5-2 이가람 실험" 2교시 블록 생성');
  expect(await $('.toast.show').count() >= 1 && (await $('.toast').last().textContent()).includes('예약되었습니다'), 'AC2 토스트 표시');
  await shot('board-04-saved');
  await sleep(3200);
  expect(await $('.toast').count() === 0, 'AC13 토스트 자동 소멸(3.2s 후 0건)');

  // ── AC3 같은 자리 재시도 → 저장 비활성·사유·대안 칩 → 칩 클릭 → 녹색
  await page.evaluate(({ date, p1, p2 }) => { window.__app.actions.openBookingModal({ resourceId: 'r_sci1', date, pStart: p1, pEnd: p2 }); }, pair); await sleep(300);
  await modal().locator('select[name="classSel"]').selectOption('5-1'); await sleep(150);
  const bad = (await modal().locator('.validate .bad').textContent()).replace(/\s+/g, ' ');
  expect(await modal().locator('[data-act="save"]').isDisabled() && bad.includes('5-2 이가람 사용 중'), 'AC3 저장 비활성 + 빨간 사유: ' + bad.slice(0, 90));
  const alts = await modal().locator('.alts .chip').allTextContents();
  expect(alts.length >= 1 && alts.length <= 3, 'AC3 대안 칩 1~3개: ' + alts.join(' | '));
  expect(alts.some(x => x.startsWith('같은 날')) && alts.some(x => x.includes('과학실2 같은 교시')) && alts.some(x => x.includes('요일 같은 교시')), '대안 3종(같은 날/같은 그룹 자원/다른 요일) 모두 제시');
  await shot('board-05-conflict');
  const before = { r: await modal().locator('select[name="resourceId"]').inputValue(), d: await modal().locator('input[name="date"]').inputValue(), s: await modal().locator('select[name="pStart"]').inputValue() };
  await modal().locator('.alts .chip').first().click(); await sleep(250);
  const after = { r: await modal().locator('select[name="resourceId"]').inputValue(), d: await modal().locator('input[name="date"]').inputValue(), s: await modal().locator('select[name="pStart"]').inputValue() };
  expect(JSON.stringify(before) !== JSON.stringify(after), 'AC3 칩 클릭 시 폼 값 변경');
  expect(await modal().locator('.validate .ok').count() === 1 && !(await modal().locator('[data-act="save"]').isDisabled()) && await modal().locator('.alts .chip').count() === 0, 'AC3 대안 적용 후 녹색 예약 가능(대안 칩 사라짐)');
  // 입력 검증
  await modal().locator('input[name="date"]').fill('2026-10-24'); await sleep(150);
  expect((await modal().locator('.validate').textContent()).includes('주말') && await modal().locator('[data-act="save"]').isDisabled(), '주말 날짜 → 수업일 아님 차단');
  await modal().locator('input[name="date"]').fill('2027-03-02'); await sleep(150);
  expect((await modal().locator('.validate').textContent()).includes('학기 기간 밖'), '학기 밖 날짜 → 사유');
  await modal().locator('input[name="date"]').fill(''); await sleep(150);
  expect((await modal().locator('.validate').textContent()).includes('날짜') && await modal().locator('[data-act="save"]').isDisabled(), '빈 날짜 → 차단');
  await modal().locator('input[name="date"]').fill(pair.date);
  await modal().locator('select[name="pStart"]').selectOption('6'); await modal().locator('select[name="pEnd"]').selectOption('3'); await sleep(150);
  expect(await modal().locator('select[name="pEnd"]').inputValue() === '6', '끝 교시 < 시작 → 자동 교정');
  await closeModal();

  // ── 직접 입력·메모 XSS
  const freeCell = $('.grid .cell.free').first();
  await freeCell.click(); await sleep(250);
  await modal().locator('select[name="classSel"]').selectOption('custom'); await sleep(100);
  expect(!(await modal().locator('.custom-wrap').isHidden()), "'기타 직접 입력' 선택 → 입력칸 표시");
  expect(await modal().locator('[data-act="save"]').isDisabled(), '직접 입력 비어 있으면 저장 비활성');
  await modal().locator('input[name="customLabel"]').fill('<i>xss</i>');
  await modal().locator('input[name="memo"]').fill('"><img src=x onerror="window.__xss=1">');
  await modal().locator('select[name="teacherId"]').selectOption({ index: 1 }); await sleep(150);
  expect(await modal().locator('.validate .ok').count() === 1, '직접 입력 라벨로 예약 가능');
  await modal().locator('[data-act="save"]').click(); await sleep(400);
  const xb = await page.evaluate(() => { const st = window.__app.getState(); const bk = st.data.bookings.find(x => x.customLabel === '<i>xss</i>'); const el = bk && document.querySelector(`.block[data-booking-id="${bk.id}"]`); return { found: !!bk, text: el ? el.querySelector('b').textContent : 'no-el', hasI: !!(el && el.querySelector('i:not(.badge)')), title: el ? el.getAttribute('title') : '', xss: window.__xss || 0 }; });
  expect(xb.found && xb.text.includes('<i>xss</i>') && !xb.hasI && xb.xss === 0 && xb.title.includes('<img'), 'XSS 문자열이 텍스트로 이스케이프, 스크립트 미실행: ' + JSON.stringify(xb).slice(0, 120));
  await closeAll();

  // ── AC4 태블릿 2/2 → 잔여 0
  await $('.chip[data-resource="r_tab"]').click(); await sleep(200);
  expect((await $('.chip[data-resource="r_tab"]').textContent()).includes('×2') && (await $('.res-title').textContent()).includes('보유 2'), '수량형 칩 ×2 · 제목 보유 2');
  const sampleFull = await $('.cell[data-date="2026-10-20"][data-period="3"]').textContent();
  expect(sampleFull.includes('2/2') && await $('.cell[data-date="2026-10-20"][data-period="3"] .eq-chip').count() === 2, '샘플 태블릿 10/20 3교시 2/2 사용 중: ' + sampleFull.trim());
  const tcell = await page.evaluate(() => { const c = [...document.querySelectorAll('.grid .cell.free')].find(x => !x.querySelector('.eq-chip')); return c ? { date: c.dataset.date, p: Number(c.dataset.period) } : null; });
  expect(!!tcell, 'AC4 태블릿 빈 셀 존재');
  const tsel = `.cell[data-date="${tcell.date}"][data-period="${tcell.p}"]`;
  expect(!(await $(tsel).textContent()).includes('잔여'), '빈 수량형 셀은 잔여 표기 없음(예약 생기면 표시)');
  for (const cls of ['1-1', '1-2']) {
    await page.evaluate(({ date, p }) => { window.__app.actions.openBookingModal({ resourceId: 'r_tab', date, pStart: p, pEnd: p }); }, tcell); await sleep(250);
    expect(!(await modal().locator('.qty-wrap').isHidden()), 'AC4 수량형 → 수량 입력 표시');
    if (cls === '1-1') {
      await modal().locator('input[name="qty"]').fill('0'); await sleep(120); expect(await modal().locator('input[name="qty"]').inputValue() === '1', '수량 0 → 1 클램프');
      await modal().locator('input[name="qty"]').fill('9'); await sleep(120); expect(await modal().locator('input[name="qty"]').inputValue() === '2', '수량 9 → 보유 2 클램프');
      await modal().locator('input[name="qty"]').fill('-5'); await sleep(120); expect(await modal().locator('input[name="qty"]').inputValue() === '1', '수량 -5 → 1');
      await modal().locator('input[name="qty"]').fill('1.7'); await sleep(120); expect(await modal().locator('input[name="qty"]').inputValue() === '1', '수량 1.7 → 1(정수)');
    }
    await modal().locator('select[name="classSel"]').selectOption(cls); await sleep(120);
    const vt = await modal().locator('.validate').textContent();
    expect(vt.includes('잔여'), 'AC4 교시별 잔여 표시: ' + vt.replace(/\s+/g, ' ').slice(0, 70));
    await modal().locator('[data-act="save"]').click(); await sleep(250);
  }
  const ct = await $(tsel).textContent();
  expect(ct.includes('2/2') && await $(`${tsel} .eq-chip`).count() === 2, 'AC4 두 건 저장 후 셀 2/2 + 칩 2개: ' + ct.trim());
  await page.evaluate(({ date, p }) => { window.__app.actions.openBookingModal({ resourceId: 'r_tab', date, pStart: p, pEnd: p }); }, tcell); await sleep(250);
  await modal().locator('select[name="classSel"]').selectOption('1-3'); await sleep(150);
  const v3 = await modal().locator('.validate').textContent();
  expect(v3.includes('잔여 0') && await modal().locator('[data-act="save"]').isDisabled(), 'AC4 세 번째 예약 잔여 0 차단');
  await shot('board-06-equipment');
  await closeModal();
  // 수량 2 예약 시 셀 '×2' 표기
  const t2 = await page.evaluate(() => { const c = [...document.querySelectorAll('.grid .cell.free')].find(x => !x.querySelector('.eq-chip')); return c ? { date: c.dataset.date, p: Number(c.dataset.period) } : null; });
  await page.evaluate(({ date, p }) => { window.__app.actions.openBookingModal({ resourceId: 'r_tab', date, pStart: p, pEnd: p }); }, t2); await sleep(250);
  await modal().locator('input[name="qty"]').fill('2'); await modal().locator('select[name="classSel"]').selectOption('2-1'); await sleep(120);
  await modal().locator('[data-act="save"]').click(); await sleep(250);
  const t2txt = await $(`.cell[data-date="${t2.date}"][data-period="${t2.p}"]`).textContent();
  expect(t2txt.includes('×2') && t2txt.includes('2/2'), '수량 2 예약 → 칩 ×2 + 2/2: ' + t2txt.trim());

  // ── 블록 클릭 → 수정/삭제
  await $('.chip[data-resource="r_sci1"]').click(); await sleep(200);
  await $(`.block[data-booking-id="${newBlock.id}"]`).click(); await sleep(250);
  expect(await modalCount() === 1 && (await modal().locator('h2').textContent()) === '예약 수정' && await modal().locator('[data-act="delete"]').count() === 1, '블록 클릭 → 수정 모달(삭제 버튼)');
  expect(await modal().locator('.validate .ok').count() === 1, '수정 모달에서 자기 자신과의 충돌 미보고(excludeId)');
  const isPast = pair.date < new Date().toLocaleDateString('sv-SE');
  expect((await modal().locator('.used-wrap').isHidden()) === !isPast, `사용 여부 토글은 지난 예약에만 표시(예약일 ${pair.date}, 과거=${isPast})`);
  await modal().locator('input[name="memo"]').fill('수정 메모'); await modal().locator('[data-act="save"]').click(); await sleep(250);
  const edited = (await state()).data.bookings.find(x => x.id === newBlock.id);
  expect(edited.memo === '수정 메모' && edited.updatedAt > edited.createdAt - 1, '수정 저장 반영');
  await $(`.block[data-booking-id="${newBlock.id}"]`).click(); await sleep(250);
  await modal().locator('[data-act="delete"]').click(); await sleep(250);
  expect(await modalCount() === 2 && (await modal().textContent()).includes('삭제할까요'), '삭제 → 인앱 확인 모달');
  await modal().locator('[data-result=""]').click(); await sleep(250);
  expect(await modalCount() === 1 && !!(await state()).data.bookings.find(x => x.id === newBlock.id), '삭제 취소 시 유지');
  await modal().locator('[data-act="delete"]').click(); await sleep(250); await modal().locator('[data-result="ok"]').click(); await sleep(300);
  expect(await modalCount() === 0 && !(await state()).data.bookings.find(x => x.id === newBlock.id) && await $(`.block[data-booking-id="${newBlock.id}"]`).count() === 0, '삭제 확인 → 블록 제거');

  // ── 키보드·포커스·배경 클릭
  const firstFree = $('.grid .cell.free').first();
  await firstFree.focus(); await page.keyboard.press('Enter'); await sleep(250);
  expect(await modalCount() === 1, '빈 셀 포커스 + Enter → 예약 모달');
  expect(await page.evaluate(() => !!document.activeElement.closest('.modal')), '모달 열릴 때 포커스가 모달 안으로 이동');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.modal')), 'Tab 이동 후에도 모달 안 요소에 포커스');
  await page.keyboard.press('Escape'); await sleep(300);
  expect(await modalCount() === 0, 'ESC로 모달 닫힘');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('cell')), '닫힌 뒤 원래 셀로 포커스 복귀');
  await firstFree.click(); await sleep(250);
  await page.mouse.click(5, 400); await sleep(300);
  expect(await modalCount() === 0, '배경 클릭으로 모달 닫힘');
  await firstFree.click(); await sleep(250);
  await modal().locator('[data-close]').click(); await sleep(300);
  expect(await modalCount() === 0, '✕ 버튼으로 모달 닫힘');

  // ── 도움말·테마
  await $('#btn-help').click(); await sleep(250);
  expect(await modalCount() === 1 && (await modal().textContent()).includes('사용법') && await modal().locator('.help-steps li').count() >= 3, '도움말 모달(단계 3개 이상)');
  await closeModal();
  await $('#btn-theme').click(); await sleep(150);
  const theme = await page.evaluate(() => ({ t: document.documentElement.dataset.theme, ls: localStorage.getItem('edu.special-room-booking.theme'), bg: getComputedStyle(document.body).backgroundColor }));
  expect(theme.t === 'dark' && theme.ls === '"dark"' && theme.bg === 'rgb(18, 22, 29)', '테마 토글 → data-theme=dark + localStorage: ' + JSON.stringify(theme));
  await shot('board-07-dark-toggle');
  await reload(); await sleep(300);
  expect(await page.evaluate(() => document.documentElement.dataset.theme === 'dark'), '새로고침 후 테마 유지');
  await $('#btn-theme').click(); await sleep(150);
  expect(await page.evaluate(() => document.documentElement.dataset.theme === 'light'), '토글 → light');
  await $('#btn-data').click(); await sleep(200);
  expect(await $('[data-view="settings"]').isVisible(), '데이터 아이콘 → 설정 탭');
  await tab('board');

  // ── AC10 새로고침 복원
  await $('.chip[data-resource="r_com"]').click(); await sleep(150);
  await $('[data-act="next-week"]').click(); await sleep(200);
  const uiBefore = (await state()).ui; const cnt = (await state()).data.bookings.length;
  await reload(); await sleep(300);
  const st2 = await state();
  expect(await $('.modal-backdrop').count() === 0, '새로고침 후 온보딩 재표시 없음');
  expect(st2.ui.selectedResourceId === 'r_com' && st2.ui.weekStart === uiBefore.weekStart && (await $('.chip.on').getAttribute('data-resource')) === 'r_com' && (await $('[data-act="pick-week"]').inputValue()) === uiBefore.weekStart && (await $('.res-title h2').textContent()) === '컴퓨터실', 'AC10 새로고침 후 자원(컴퓨터실)·주 복원');
  expect(st2.data.bookings.length === cnt, '새로고침 후 예약 건수 유지 ' + cnt);
  await page.evaluate(() => localStorage.setItem('srb.v1.ui', '{broken')); await reload(); await sleep(300);
  expect((await state()).data.bookings.length === cnt && await $('.grid .cell').count() === 40, 'ui 저장 손상 시에도 데이터 유지·격자 렌더');

  // ── 우선 학년 규칙 경고(컴퓨터실 월·화 5~6학년)
  await page.evaluate(() => { window.__app.actions.selectResource('r_com'); window.__app.actions.goWeek('2026-10-26'); }); await sleep(200);
  const comCell = await page.evaluate(() => { const c = [...document.querySelectorAll('.grid .cell.free')].find(x => x.dataset.day === '1' || x.dataset.day === '2'); return c ? { date: c.dataset.date, p: Number(c.dataset.period) } : null; });
  if (comCell) {
    await page.evaluate(({ date, p }) => { window.__app.actions.openBookingModal({ resourceId: 'r_com', date, pStart: p, pEnd: p }); }, comCell); await sleep(250);
    await modal().locator('select[name="classSel"]').selectOption('3-1'); await sleep(150);
    expect(await modal().locator('.validate .warn').count() === 1 && !(await modal().locator('[data-act="save"]').isDisabled()), '우선 학년 규칙: 노란 경고 + 저장 허용');
    await modal().locator('select[name="classSel"]').selectOption('6-1'); await sleep(150);
    expect(await modal().locator('.validate .warn').count() === 0, '우선 학년(6학년)은 경고 없음');
    await closeModal();
  } else log('컴퓨터실 월·화 빈 셀 없음 — 우선 규칙 미검증');

  // ── AC12 지난 예약 사용 여부 → 미사용률 증가
  const pastInfo = await page.evaluate(() => { const st = window.__app.getState(); const t = new Date(); const ts = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; const bk = st.data.bookings.filter(x => x.resourceId === 'r_sci1' && x.date < ts && x.used !== false).sort((p, q) => q.date.localeCompare(p.date))[0]; return bk ? { id: bk.id, date: bk.date, used: bk.used } : null; });
  expect(!!pastInfo, 'AC12 지난 예약 존재: ' + JSON.stringify(pastInfo));
  await page.evaluate(d => { window.__app.actions.selectResource('r_sci1'); window.__app.actions.goWeek(d); }, pastInfo.date); await sleep(250);
  expect(await $(`.block.past[data-booking-id="${pastInfo.id}"]`).count() === 1, '지난 예약 블록 past 스타일');
  const rateBefore = await page.evaluate(() => { const r = window.__app.actions.statsRange(); return window.__app.actions.computeStats(r.from, r.to).summary.unusedRate; });
  await $(`.block[data-booking-id="${pastInfo.id}"]`).click(); await sleep(250);
  expect(!(await modal().locator('.used-wrap').isHidden()) && await modal().locator('[data-used="false"]').count() === 1 && await modal().locator('[data-used="true"]').count() === 1, 'AC12 지난 예약 모달에 실제 사용함/사용 안 함 토글');
  await modal().locator('[data-used="false"]').click(); await sleep(100);
  expect(await modal().locator('[data-used="false"].on').count() === 1, '사용 안 함 선택 표시');
  await modal().locator('[data-act="save"]').click(); await sleep(300);
  const rateAfter = await page.evaluate(() => { const r = window.__app.actions.statsRange(); return window.__app.actions.computeStats(r.from, r.to).summary.unusedRate; });
  expect((await state()).data.bookings.find(x => x.id === pastInfo.id).used === false && rateAfter > rateBefore, `AC12 미사용률 ${rateBefore} → ${rateAfter} 증가`);
  expect(await $(`.block[data-booking-id="${pastInfo.id}"] .badge-warn`).count() === 1, '미사용 배지 블록에 표시');
  await tab('stats');
  expect((await $('.kpi').nth(3).textContent()).includes(String(rateAfter)), 'AC12 통계 탭 미사용률 카드 ' + rateAfter);
  await tab('board');

  // ── 미확인 예약 일괄 체크
  const unLink = $('[data-act="unchecked"]');
  expect(await unLink.count() === 1, "'지난 예약 미확인 n건' 링크 표시");
  await unLink.click(); await sleep(250);
  const rows = await modal().locator('tbody tr').count();
  expect(rows >= 1 && (await modal().textContent()).includes(`${rows}건`), '미확인 목록 ' + rows + '건');
  await modal().locator('tbody tr').first().locator('[data-mark="false"]').click(); await sleep(200);
  expect(await modal().locator('tbody tr').count() === rows - 1, '개별 사용 안 함 처리 → 행 제거');
  await modal().locator('[data-act="all-used"]').click(); await sleep(350);
  expect(await modalCount() === 0 && await $('[data-act="unchecked"]').count() === 0, '모두 사용함 → 링크 사라짐');
  const pu = await page.evaluate(() => { const r = window.__app.actions.statsRange(); return window.__app.actions.computeStats(r.from, r.to).summary.pastUnchecked; });
  expect(pu === 0, '통계 pastUnchecked 0');

  // ── 드래그 세부: 예약 셀을 지나면 직전 범위에서 멈춤 + 토스트 / 5px 미만 이동은 클릭
  await page.evaluate(() => { window.__app.actions.selectResource('r_sci1'); window.__app.actions.goWeek('2026-11-16'); }); await sleep(250);
  const cfg = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.grid .cell')]; const by = (d, p) => cells.find(c => c.dataset.date === d && Number(c.dataset.period) === p);
    for (const c of cells) { if (!c.classList.contains('free')) continue; const d = c.dataset.date, k = Number(c.dataset.period); const n1 = by(d, k + 1), n2 = by(d, k + 2); if (n1 && n1.classList.contains('free') && n2 && !n2.classList.contains('free')) return { date: d, k }; }
    return null;
  });
  if (!cfg) { await page.evaluate(() => { window.__app.actions.addBooking({ resourceId: 'r_sci1', date: '2026-11-18', periodStart: 3, periodEnd: 3, classId: '1-1', teacherId: 't_01' }); }); await sleep(200); }
  const cfg2 = cfg || { date: '2026-11-18', k: 1 };
  const d0 = await $(`.cell[data-date="${cfg2.date}"][data-period="${cfg2.k}"]`).boundingBox();
  const d2 = await $(`.cell[data-date="${cfg2.date}"][data-period="${cfg2.k + 2}"]`).boundingBox();
  await page.mouse.move(d0.x + d0.width / 2, d0.y + d0.height / 2); await page.mouse.down();
  await page.mouse.move(d0.x + d0.width / 2, d0.y + d0.height / 2 + 10, { steps: 2 });
  await page.mouse.move(d2.x + d2.width / 2, d2.y + 6, { steps: 8 }); await sleep(150);
  const selN = await $('.cell.sel').count(); const toastN = await $('.toast', { hasText: '지나 선택할 수 없습니다' }).count();
  await page.mouse.up(); await sleep(300);
  expect(selN === 2, `예약 블록을 지나는 드래그: 직전 유효 범위 2칸에서 멈춤(sel=${selN})`);
  expect(toastN === 1, `예약 블록을 지나는 드래그 시 안내 토스트 표시(toast=${toastN})`);
  expect(await modalCount() === 1 && (await modal().locator('select[name="pStart"]').inputValue()) === String(cfg2.k) && (await modal().locator('select[name="pEnd"]').inputValue()) === String(cfg2.k + 1), '놓으면 멈춘 범위(2교시)로 모달');
  await closeModal();
  const f1 = await $('.grid .cell.free').first().boundingBox();
  await page.mouse.move(f1.x + f1.width / 2, f1.y + f1.height / 2); await page.mouse.down(); await page.mouse.move(f1.x + f1.width / 2 + 2, f1.y + f1.height / 2 + 2); await page.mouse.up(); await sleep(300);
  expect(await modalCount() === 1 && (await modal().locator('select[name="pStart"]').inputValue()) === (await modal().locator('select[name="pEnd"]').inputValue()), '5px 미만 이동은 클릭(1교시 모달, 중복 모달 없음)');
  await closeModal();
  // 다른 열로 벗어난 드래그는 범위 확장 안 됨
  const colA = await $(`.cell[data-date="${cfg2.date}"][data-period="${cfg2.k}"]`).boundingBox();
  await page.mouse.move(colA.x + colA.width / 2, colA.y + colA.height / 2); await page.mouse.down();
  await page.mouse.move(colA.x + colA.width + 40, colA.y + colA.height / 2, { steps: 4 });
  await page.mouse.move(colA.x + colA.width + 40, colA.y + colA.height * 2, { steps: 4 }); await sleep(100);
  const selOther = await page.evaluate(d => [...document.querySelectorAll('.cell.sel')].map(c => c.dataset.date).filter(x => x !== d).length, cfg2.date);
  await page.mouse.up(); await sleep(300);
  expect(selOther === 0 && await modalCount() === 1 && (await modal().locator('input[name="date"]').inputValue()) === cfg2.date, `다른 요일 열로 이동 시 그 열은 선택되지 않음(other=${selOther}), 앵커 날짜로 모달`);
  await closeModal();
  // 행사 차단(빗금) 셀을 지나는 드래그 → 토스트
  await page.evaluate(() => { window.__app.actions.selectResource('r_gym'); window.__app.actions.goWeek('2026-10-19'); }); await sleep(250);
  const g4 = await $('.cell[data-date="2026-10-19"][data-period="4"]').boundingBox(); const g6 = await $('.cell[data-date="2026-10-19"][data-period="6"]').boundingBox();
  const g4free = (await $('.cell[data-date="2026-10-19"][data-period="4"]').getAttribute('class')).includes('free');
  if (g4free) {
    await page.mouse.move(g4.x + g4.width / 2, g4.y + g4.height / 2); await page.mouse.down();
    await page.mouse.move(g4.x + g4.width / 2, g4.y + g4.height / 2 + 10, { steps: 2 }); await page.mouse.move(g6.x + g6.width / 2, g6.y + g6.height / 2, { steps: 8 }); await sleep(150);
    const bl = { sel: await $('.cell.sel').count(), toast: await $('.toast', { hasText: '지나 선택할 수 없습니다' }).count() };
    await page.mouse.up(); await sleep(300);
    expect(bl.sel === 1 && bl.toast === 1, `차단(빗금) 셀을 지나는 드래그: 1칸 유지 + 토스트 ${JSON.stringify(bl)}`);
    await closeAll();
  } else log('강당 10/19 4교시가 빈 셀이 아니라 차단 드래그 토스트 미검증');
  await shot('board-08-final');
};
