// fix-r2-verify.js — 2라운드 수정(R-01 핀 옆자리, R-02 리사이즈 접힘·자동 축소, R-03 수동 확대값, R-04 토스트 위치) 브라우저 검증 (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const closeModal = async () => { let n = 0; while (await page.locator('.modal-back').count() && n++ < 6) { await page.keyboard.press('Escape'); await sleep(120); } };
  const tab = async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await sleep(150); };
  const genderNote = () => page.evaluate(() => { const r = [...document.querySelectorAll('#report .rep-row')].find(x => x.textContent.includes('남녀 짝')); return r ? r.querySelector('.lbl small').textContent : ''; });
  const BACK = ['4-1', '4-3', '4-4', '4-6'];
  await closeModal();

  // ── R-01: 핀 고정 학생의 옆자리가 '다시 섞기'마다 비워지던 회귀 ──
  await tab('seats'); await page.click('#btn-auto'); await page.waitForFunction(() => document.querySelectorAll('#seatmap .seat-card').length === 24, null, { timeout: 3000 });
  let st = await S();
  expect(BACK.every(k => !st.state.current.seats[k]), 'R-01 전제: 핀 없는 자동 배치는 뒷줄 4석(4-1·4-3·4-4·4-6)을 비움');
  const sid = st.state.current.seats['0-0'];
  await page.click(`#seatmap .seat-card[data-sid="${sid}"] .lock`); await sleep(150);
  st = await S(); expect(st.state.current.locked.includes(sid), 'R-01 0-0 학생 자물쇠 켜짐');
  let kept = 0, partnerFilled = 0, backEmpty = 0, singles = 0;
  for (let i = 0; i < 5; i++) {
    await page.click('#btn-shuffle'); await sleep(350); st = await S();
    if (st.state.current.seats['0-0'] === sid) kept++;
    if (st.state.current.seats['0-1']) partnerFilled++;
    if (BACK.every(k => !st.state.current.seats[k])) backEmpty++;
    if (/단독석/.test(await genderNote())) singles++;
  }
  expect(kept === 5, `R-01/AC5 고정 학생 좌석 5회 유지 (${kept}/5)`);
  expect(partnerFilled === 5, `R-01 고정 학생의 옆자리(0-1)가 다시 섞기마다 채워짐 (${partnerFilled}/5)`);
  expect(backEmpty === 5 && singles === 0, `R-01 빈 책상은 여전히 뒷줄 4석·단독석 표기 없음 (뒷줄 ${backEmpty}/5, 단독석 ${singles}회)`);
  const gp = await page.evaluate(() => { const r = [...document.querySelectorAll('#report .rep-row')].find(x => x.textContent.includes('남녀 짝')); return r ? r.querySelector('.val').textContent.trim() : ''; });
  expect(gp === '12/12 충족', 'R-01 고정 상태에서도 남녀 짝 12/12 충족: ' + gp);
  await shot('r2-pin-shuffle');
  // 뒤에서 두 번째 줄 가장자리(3-0) 학생 고정 → 옆자리 3-1 채움
  await page.click(`#seatmap .seat-card[data-sid="${sid}"] .lock`); await sleep(100);
  st = await S(); const sid2 = st.state.current.seats['3-0']; expect(!!sid2, 'R-01 3-0에 학생 있음(전제)');
  await page.click(`#seatmap .seat-card[data-sid="${sid2}"] .lock`); await sleep(100);
  let ok2 = 0; for (let i = 0; i < 3; i++) { await page.click('#btn-shuffle'); await sleep(350); st = await S(); if (st.state.current.seats['3-0'] === sid2 && st.state.current.seats['3-1'] && BACK.every(k => !st.state.current.seats[k])) ok2++; }
  expect(ok2 === 3, `R-01 3-0 고정: 옆자리 3-1 채움·뒷줄 4석 비움 (${ok2}/3)`);
  await page.click(`#seatmap .seat-card[data-sid="${sid2}"] .lock`); await sleep(100);
  st = await S(); expect(st.state.current.locked.length === 0, 'R-01 자물쇠 모두 해제');

  // ── R-04: 데스크톱 토스트는 상단 중앙 — 좌석표 격자·리포트와 겹치지 않음 ──
  await page.click('#btn-shuffle'); await sleep(200);
  const tp = await page.evaluate(() => { const r = document.querySelector('#toast-root'); const cs = getComputedStyle(r); const t = r.querySelector('.toast.show'); const g = document.querySelector('#seatmap .seat-grid').getBoundingClientRect(); const rep = document.querySelector('#report').getBoundingClientRect(); const tb = t && t.getBoundingClientRect(); return { top: cs.top, rootTop: Math.round(r.getBoundingClientRect().top), toastBottom: tb && Math.round(tb.bottom), gridTop: Math.round(g.top), repTop: Math.round(rep.top), cx: tb && Math.round(tb.left + tb.width / 2), pe: cs.pointerEvents, text: t && t.textContent }; });
  log('toast desktop: ' + JSON.stringify(tp));
  expect(tp.top === '12px' && tp.rootTop === 12, 'R-04 1280px 토스트 컨테이너가 상단 12px에 위치');
  expect(tp.toastBottom != null && tp.toastBottom < tp.gridTop && tp.toastBottom < tp.repTop, `R-04 토스트가 좌석표 격자(top ${tp.gridTop})·리포트(top ${tp.repTop}) 위쪽에 머무름(toast bottom ${tp.toastBottom})`);
  expect(tp.cx != null && Math.abs(tp.cx - 640) < 40 && tp.pe === 'none', 'R-04 토스트 가로 중앙·클릭 통과(pointer-events none)');
  await shot('r2-toast-top');
  // 토스트가 떠 있는 동안에도 그 아래 헤더 버튼을 누를 수 있음
  await page.click('[data-action="help"]'); await sleep(200);
  expect(await page.locator('.modal').count() === 1, 'R-04 토스트 아래의 도움말 버튼 클릭 가능');
  const helpTxt = await page.locator('.modal').innerText(); await closeModal();
  expect(/자물쇠/.test(helpTxt), '도움말 모달 표시');
  await page.click('[data-help="seats"]'); await sleep(200);
  const seatsHelp = await page.locator('.modal').innerText(); await closeModal();
  expect(/맞춤/.test(seatsHelp) && /옆자리/.test(seatsHelp), '자리 배치 도움말에 자동 맞춤·핀 옆자리 설명 포함');

  // ── R-02: 새로고침 없이 1280→400 리사이즈 → 패널 접힘·좌석표 자동 축소(48px)·토스트 하단 ──
  st = await S(); expect(st.ui.zoomManual === false, 'R-02 전제: 슬라이더를 만지지 않아 자동 맞춤 상태');
  const openBefore = await page.$$eval('details.panel', ds => ds.map(d => d.open));
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(450);
  const m = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); const tr = document.querySelector('#toast-root').getBoundingClientRect(); return { open: [...document.querySelectorAll('details.panel')].map(d => d.open), cell: getComputedStyle(w).getPropertyValue('--cell').trim(), zoomInput: document.querySelector('#zoom').value, sw: w.scrollWidth, cw: w.clientWidth, docSw: document.documentElement.scrollWidth, toastGap: Math.round(innerHeight - tr.bottom), toastBottomCss: getComputedStyle(document.querySelector('#toast-root')).bottom }; });
  log('after resize to 400: ' + JSON.stringify(m) + ' openBefore=' + JSON.stringify(openBefore));
  expect(openBefore.every(o => o) && m.open.every(o => !o), 'R-02 1280→400 리사이즈만으로 교실·조건 패널이 접힘');
  expect(m.cell === '48px' && m.zoomInput === '48' && m.sw - m.cw <= 20 && m.docSw <= 400, `R-02 리사이즈만으로 좌석표 자동 축소(48px)·가로 넘침 없음 (${m.sw}/${m.cw})`);
  expect(m.toastBottomCss === '84px' && m.toastGap === 84, 'R-04 400px에서는 토스트가 하단 탭 바 위(84px)에 위치');
  await shot('r2-mobile-resized');
  // 다시 넓히면 패널 펼침 + 폭에 맞춰 재맞춤
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(450);
  const d = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); const g = document.querySelector('#seatmap .seat-grid'); return { open: [...document.querySelectorAll('details.panel')].map(d => d.open), zoom: Number(document.querySelector('#zoom').value), cell: getComputedStyle(w).getPropertyValue('--cell').trim(), fits: g.getBoundingClientRect().width <= w.clientWidth }; });
  log('after resize back to 1280: ' + JSON.stringify(d));
  expect(d.open.every(o => o) && d.zoom > 48 && d.zoom % 4 === 0 && d.cell === d.zoom + 'px' && d.fits, `R-02 400→1280 복귀 시 패널 펼침·확대 재맞춤(zoom ${d.zoom})`);
  // 데스크톱에서 창을 좁혀 좌석표가 넘치면(자동 맞춤 상태) 다시 맞춤
  await page.setViewportSize({ width: 900, height: 800 }); await sleep(450);
  const n9 = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); const g = document.querySelector('#seatmap .seat-grid'); return { zoom: Number(document.querySelector('#zoom').value), fits: g.getBoundingClientRect().width <= w.clientWidth, sw: w.scrollWidth, cw: w.clientWidth }; });
  log('after resize to 900: ' + JSON.stringify(n9));
  expect(n9.fits && n9.sw <= n9.cw + 1, `R-02 900px에서도 좌석표가 폭 안에 들어옴(zoom ${n9.zoom})`);
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(450);

  // ── R-03: 수동 확대값은 리사이즈에서 유지, 레이아웃 변경·'맞춤'은 자동 맞춤으로 전환 ──
  await page.$eval('#zoom', el => { el.value = 60; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(100);
  st = await S(); expect(st.ui.zoomManual === true && st.ui.zoom === 60, 'R-03 슬라이더 조작 → 수동 상태(60)');
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(450);
  st = await S(); const cellM = await page.evaluate(() => getComputedStyle(document.querySelector('#seatmap-wrap')).getPropertyValue('--cell').trim());
  const openM = await page.$$eval('details.panel', ds => ds.map(d => d.open));
  expect(st.ui.zoom === 60 && cellM === '60px' && st.ui.zoomManual === true, 'R-03 수동 확대값은 400px 리사이즈에도 유지(60px)');
  expect(openM.every(o => !o), 'R-02 수동 확대 상태에서도 400px이면 패널은 접힘');
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(450);
  st = await S(); expect(st.ui.zoom === 60 && st.ui.zoomManual === true, 'R-03 수동 확대값은 1280px 복귀에도 유지');
  await page.check('#layout-panel input[name=preset][value=exam]'); await sleep(300);
  st = await S();
  expect(st.ui.zoomManual === false && st.ui.zoom !== 60 && st.ui.zoom % 4 === 0, `R-03 프리셋 변경 → 자동 맞춤 상태로 전환(zoom ${st.ui.zoom})`);
  const fitsExam = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); const g = document.querySelector('#seatmap .seat-grid'); return g.getBoundingClientRect().width <= w.clientWidth; });
  expect(fitsExam, 'R-03 프리셋 변경 후 좌석표가 폭 안에 들어옴');
  await page.$eval('#zoom', el => { el.value = 52; el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(100);
  await page.click('[data-action="fit-zoom"]'); await sleep(150);
  st = await S(); expect(st.ui.zoomManual === false && st.ui.zoom !== 52, `R-03 '맞춤' 버튼 → 자동 맞춤 상태(zoom ${st.ui.zoom})`);
  await shot('r2-exam-fit');
};
