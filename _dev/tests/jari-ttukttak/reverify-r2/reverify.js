// reverify.js — 2라운드 수정(R-01~R-04) 독립 재검증 + 1라운드 핵심 항목 회귀 스팟체크 (pw-run.js 모듈)
// 수정 보고서(fix-r2.json)의 시나리오와 다른 핀 위치·복수 핀·양쪽 핀·뷰포트 경계 넘기기를 직접 수행한다
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const closeModal = async () => { let n = 0; while (await page.locator('.modal-back').count() && n++ < 6) { await page.keyboard.press('Escape'); await sleep(120); } };
  const tab = async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await sleep(150); };
  const section = async (name, fn) => { try { await fn(); } catch (e) { expect(false, `${name}: 예외 ${e.message.split('\n')[0]}`); await closeModal(); } };
  const BACK = ['4-1', '4-3', '4-4', '4-6'];
  const PAIR_COLS = [[0, 1], [3, 4], [6, 7]];
  // 2인 짝 3분단×5열(뒷줄 양끝 꺼짐)에서 '혼자 앉는 학생 수'와 빈 책상 목록 계산
  const analyze = (st) => {
    const seats = st.state.current.seats; const L = st.state.layout; const on = new Set(L.cells.filter(c => c.desk).map(c => c.r + '-' + c.c));
    let singles = 0; const empties = [...on].filter(k => !seats[k]).sort();
    for (let r = 0; r < L.rows; r++) for (const [a, b] of PAIR_COLS) {
      const ka = r + '-' + a, kb = r + '-' + b; const fa = !!seats[ka], fb = !!seats[kb];
      if (on.has(ka) && on.has(kb)) { if (fa !== fb) singles++; }
      else if (on.has(ka) && fa) singles++; else if (on.has(kb) && fb) singles++;   // 외딴 책상(짝 꺼짐)에 앉은 학생도 단독
    }
    return { singles, empties, filled: Object.keys(seats).length };
  };
  const genderNote = () => page.evaluate(() => { const r = [...document.querySelectorAll('#report .rep-row')].find(x => x.textContent.includes('남녀 짝')); return r ? { note: (r.querySelector('.lbl small') || {}).textContent || '', val: r.querySelector('.val').textContent.trim() } : null; });
  const lockOf = async (sid) => { await page.click(`#seatmap .seat-card[data-sid="${sid}"] .lock`); await sleep(150); };
  const shuffle = async () => { await page.click('#btn-shuffle'); await sleep(350); };
  await closeModal();

  // ── 0. 핀 없는 자동 배치: U-10 효과 유지(빈 책상 4개 뒷줄, 단독석 0) ──
  await section('U-10', async () => {
    await tab('seats'); const t0 = Date.now(); await page.click('#btn-auto');
    await page.waitForFunction(() => document.querySelectorAll('#seatmap .seat-card').length === 24, null, { timeout: 3000 }); const dt = Date.now() - t0;
    expect(dt < 1000, `AC2 자동 배치 ${dt}ms < 1초·카드 24장`);
    const st = await S(); const a = analyze(st);
    expect(a.empties.join() === BACK.join() && a.singles === 0, `U-10 핀 없음: 빈 책상=${a.empties.join('/')} · 단독 ${a.singles}명`);
    const rep = await page.evaluate(() => [...document.querySelectorAll('#report .rep-row')].map(r => ({ lbl: r.querySelector('.lbl').childNodes[0].textContent.trim(), val: r.querySelector('.val').textContent.trim(), ok: r.classList.contains('st-ok') })));
    const apart = rep.find(r => r.lbl === '분리 쌍'), front = rep.find(r => r.lbl === '앞자리 배려');
    expect(apart && apart.val === '2/2 충족' && apart.ok && front && front.val === '3/3 충족' && front.ok, 'AC2 분리 쌍 2/2·앞자리 배려 3/3 충족');
  });

  // ── R-01a. 앞줄 0-0 고정 + 다시 섞기 5회: 좌석 유지·옆자리 채움·단독석 0·빈 책상 뒷줄 ──
  await section('R-01a', async () => {
    let st = await S(); const sid = st.state.current.seats['0-0'];
    await lockOf(sid); st = await S(); expect(st.state.current.locked.includes(sid), 'R-01a 0-0 자물쇠 켜짐');
    let kept = 0, partner = 0, singlesSum = 0, backOk = 0;
    for (let i = 0; i < 5; i++) { await shuffle(); st = await S(); const a = analyze(st); if (st.state.current.seats['0-0'] === sid) kept++; if (st.state.current.seats['0-1']) partner++; singlesSum += a.singles; if (a.empties.join() === BACK.join()) backOk++; }
    expect(kept === 5, `AC5/R-01a 고정 학생 좌석 5회 유지 (${kept}/5)`);
    expect(partner === 5 && singlesSum === 0 && backOk === 5, `R-01a 옆자리 채움 ${partner}/5 · 단독석 합계 ${singlesSum} · 뒷줄 4석 비움 ${backOk}/5`);
    const g = await genderNote(); expect(g && g.val === '12/12 충족' && !/단독석/.test(g.note), `R-01a 남녀 짝 ${g && g.val} · 비고 '${g && g.note}'`);
    await shot('r2-pin-00'); await lockOf(sid);
  });

  // ── R-01b. 뒷줄 짝 책상 4-3 고정(평소 비워지던 자리): 옆자리 4-4 채움·단독석 0·빈 책상 4개 ──
  await section('R-01b', async () => {
    await page.evaluate(() => window.__app.actions.swapSeats('0-0', '4-3'));   // 4-3은 비어 있으므로 이동
    await sleep(200); let st = await S(); const sid = st.state.current.seats['4-3']; expect(!!sid, 'R-01b 4-3에 학생 이동(전제)');
    await lockOf(sid); let ok = 0, singlesSum = 0;
    for (let i = 0; i < 3; i++) { await shuffle(); st = await S(); const a = analyze(st); if (st.state.current.seats['4-3'] === sid && st.state.current.seats['4-4'] && a.empties.length === 4) ok++; singlesSum += a.singles; log(`R-01b #${i} empties=${a.empties.join('/')} singles=${a.singles}`); }
    expect(ok === 3 && singlesSum === 0, `R-01b 4-3 고정: 좌석 유지·4-4 채움·빈 책상 4개 (${ok}/3) · 단독석 합계 ${singlesSum}`);
    await lockOf(sid);
  });

  // ── R-01c. 서로 다른 짝 묶음에 2명 고정(1-3, 3-6): 둘 다 옆자리 채움·단독석 0 ──
  await section('R-01c', async () => {
    await page.click('#btn-auto'); await sleep(350); let st = await S();
    const sA = st.state.current.seats['1-3'], sB = st.state.current.seats['3-6']; expect(!!sA && !!sB, 'R-01c 1-3·3-6 학생 있음(전제)');
    await lockOf(sA); await lockOf(sB); let ok = 0, singlesSum = 0;
    for (let i = 0; i < 3; i++) { await shuffle(); st = await S(); const a = analyze(st); if (st.state.current.seats['1-3'] === sA && st.state.current.seats['3-6'] === sB && st.state.current.seats['1-4'] && st.state.current.seats['3-7']) ok++; singlesSum += a.singles; }
    expect(ok === 3 && singlesSum === 0, `R-01c 2명 고정: 좌석 유지·양쪽 옆자리 채움 (${ok}/3) · 단독석 합계 ${singlesSum}`);
    await lockOf(sA); await lockOf(sB);
  });

  // ── R-01d. 한 짝 묶음의 두 학생 모두 고정(2-0·2-1): 그대로 유지·빈 책상 뒷줄·단독석 0 ──
  await section('R-01d', async () => {
    let st = await S(); const sA = st.state.current.seats['2-0'], sB = st.state.current.seats['2-1'];
    await lockOf(sA); await lockOf(sB); let ok = 0, singlesSum = 0;
    for (let i = 0; i < 3; i++) { await shuffle(); st = await S(); const a = analyze(st); if (st.state.current.seats['2-0'] === sA && st.state.current.seats['2-1'] === sB && a.empties.join() === BACK.join()) ok++; singlesSum += a.singles; }
    expect(ok === 3 && singlesSum === 0, `R-01d 짝 양쪽 고정: 유지·뒷줄 4석 비움 (${ok}/3) · 단독석 ${singlesSum}`);
    await lockOf(sA); await lockOf(sB);
  });

  // ── R-01e. 외딴 책상 4-1에 고정: 불가피한 단독석(고정 1 + 여분 홀수 1)만 발생하고 그 외 짝은 유지 ──
  await section('R-01e', async () => {
    await page.evaluate(() => window.__app.actions.swapSeats('0-0', '4-1')); await sleep(200);
    let st = await S(); const sid = st.state.current.seats['4-1']; await lockOf(sid); let worst = 0;
    for (let i = 0; i < 3; i++) { await shuffle(); st = await S(); const a = analyze(st); worst = Math.max(worst, a.singles); log(`R-01e #${i} empties=${a.empties.join('/')} singles=${a.singles}`); }
    expect(worst <= 2, `R-01e 외딴 책상 고정: 단독석 최대 ${worst}명(하한 2명)`);
    await lockOf(sid);
  });

  // ── R-01f. 미배치가 있는 상태에서 자동 배치/핀: 책상 꺼서 26석/24명(여분 2) + 0-3 고정 ──
  await section('R-01f', async () => {
    await page.check('#edit-mode'); await sleep(100);
    await page.click('#seatmap .seat[data-key="4-3"]'); await sleep(200); await page.click('#seatmap .seat[data-key="4-4"]'); await sleep(200);
    await page.uncheck('#edit-mode'); await sleep(150);
    await page.click('#btn-auto'); await sleep(350); let st = await S(); let a = analyze(st);
    expect(a.filled === 24 && a.singles === 0 && a.empties.join() === '4-1,4-6', `R-01f 26석/24명 핀 없음: 빈 책상 ${a.empties.join('/')} · 단독 ${a.singles}`);
    const sid = st.state.current.seats['0-3']; await lockOf(sid); let ok = 0;
    for (let i = 0; i < 3; i++) { await shuffle(); st = await S(); a = analyze(st); if (st.state.current.seats['0-3'] === sid && st.state.current.seats['0-4'] && a.singles === 0) ok++; }
    expect(ok === 3, `R-01f 26석/24명 + 0-3 고정: 옆자리 채움·단독석 0 (${ok}/3)`);
    await lockOf(sid);
    await page.check('#edit-mode'); await page.click('#seatmap .seat[data-key="4-3"]'); await sleep(150); await page.click('#seatmap .seat[data-key="4-4"]'); await sleep(150); await page.uncheck('#edit-mode'); await sleep(150);
  });

  // ── R-04. 1280px 토스트: 상단 중앙·좌석표/리포트와 겹치지 않음·클릭 통과 ──
  await section('R-04', async () => {
    await page.click('#btn-auto'); await sleep(250);
    const tp = await page.evaluate(() => { const root = document.querySelector('#toast-root'); const t = root.querySelector('.toast'); const g = document.querySelector('#seatmap .seat-grid'); const rep = document.querySelector('#report'); const r = t && t.getBoundingClientRect(); return { n: root.children.length, pos: getComputedStyle(root).position, top: getComputedStyle(root).top, bottom: r && Math.round(r.bottom), cx: r && Math.round(r.left + r.width / 2), gridTop: Math.round(g.getBoundingClientRect().top), repTop: Math.round(rep.getBoundingClientRect().top), pe: getComputedStyle(root).pointerEvents, under: r && (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) || {}).id, visible: r && getComputedStyle(t).opacity }; });
    log('toast@1280: ' + JSON.stringify(tp));
    expect(tp.n >= 1 && tp.pos === 'fixed' && tp.top === '12px' && tp.bottom < tp.gridTop && tp.bottom < tp.repTop, `R-04 토스트 상단 고정(bottom ${tp.bottom} < 격자 ${tp.gridTop}·리포트 ${tp.repTop})`);
    expect(Math.abs(tp.cx - 640) < 40 && tp.pe === 'none' && tp.under !== 'toast-root', 'R-04 가로 중앙·pointer-events none(아래 요소가 hit-test 됨)');
    await shot('r2-toast-desktop');
    // 토스트가 떠 있는 동안 헤더의 도움말 버튼 클릭 가능
    await page.click('#btn-auto'); await sleep(120); await page.click('.app-header [data-action="help"]'); await sleep(200);
    expect(await page.locator('.modal-back').count() === 1, 'R-04 토스트 표시 중 헤더 버튼 클릭 가능'); await closeModal();
    await sleep(2800); expect(await page.locator('#toast-root .toast').count() === 0, '토스트 자동 소멸(≤3초)');
  });

  // ── R-02. 새로고침 없이 1280→400: 패널 접힘·좌석표 자동 축소·가로 스크롤 없음·탭-탭 동작·토스트 하단 ──
  await section('R-02', async () => {
    let st = await S(); expect(st.ui.zoomManual === false, 'R-02 전제: 자동 맞춤 상태');
    await page.setViewportSize({ width: 400, height: 800 }); await sleep(500);
    const m = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); const g = document.querySelector('#seatmap .seat-grid'); const tabs = getComputedStyle(document.querySelector('#tabs')); return { open: [...document.querySelectorAll('details.panel')].map(d => d.open), cell: getComputedStyle(w).getPropertyValue('--cell').trim(), zoom: document.querySelector('#zoom').value, gw: Math.round(g.getBoundingClientRect().width), cw: w.clientWidth, sw: w.scrollWidth, docSw: document.documentElement.scrollWidth, tabsPos: tabs.position, tabsBottom: tabs.bottom, autoTop: Math.round(document.querySelector('#btn-auto').getBoundingClientRect().top), toastBottom: getComputedStyle(document.querySelector('#toast-root')).bottom, toastGap: Math.round(innerHeight - document.querySelector('#toast-root').getBoundingClientRect().bottom) }; });
    log('after 1280->400: ' + JSON.stringify(m));
    expect(m.open.length === 2 && m.open.every(o => !o), 'R-02 리사이즈만으로 교실·조건 패널 접힘');
    expect(m.cell === '48px' && m.zoom === '48' && m.gw <= m.cw + 2 && m.docSw <= 400, `R-02 좌석표 48px 자동 축소·격자 ${m.gw} ≤ 래퍼 ${m.cw}·문서 폭 ${m.docSw}`);
    expect(m.tabsPos === 'fixed' && m.tabsBottom === '0px' && m.autoTop < 800, `AC14 탭 바 하단 고정·자동 배치 버튼 첫 화면(top ${m.autoTop})`);
    expect(m.toastBottom === '84px' && m.toastGap === 84, `R-04 400px 토스트 하단 84px(실측 ${m.toastGap})`);
    // 탭-탭 교환(400px)
    st = await S(); const k1 = '1-0', k2 = '2-3', s1 = st.state.current.seats[k1], s2 = st.state.current.seats[k2];
    await page.click(`#seatmap .seat-card[data-sid="${s1}"]`); await sleep(120);
    expect(await page.locator(`#seatmap .seat-card[data-sid="${s1}"]`).evaluate(el => el.closest('.seat').classList.contains('tap-sel')), 'AC14 첫 탭 하이라이트(.tap-sel)');
    await page.click(`#seatmap .seat-card[data-sid="${s2}"]`); await sleep(250);
    st = await S(); expect(st.state.current.seats[k1] === s2 && st.state.current.seats[k2] === s1, 'AC14 400px 탭-탭 교환');
    await shot('r2-resized-400');
    // 인쇄·발표 오버레이도 400px에서 가로 넘침 없음
    await page.click('#btn-print'); await sleep(400);
    const pr = await page.evaluate(() => ({ docSw: document.documentElement.scrollWidth, btnTop: Math.round(document.querySelector('#print-panel [data-action="do-print"]').getBoundingClientRect().top) }));
    expect(pr.docSw <= 400 && pr.btnTop < 800 && pr.btnTop >= 0, `U-07 400px 인쇄 패널 가로 넘침 없음·인쇄하기 버튼 노출(top ${pr.btnTop})`);
    await page.keyboard.press('Escape'); await sleep(200);
    // 다시 1280: 패널 펼침·재맞춤
    await page.setViewportSize({ width: 1280, height: 800 }); await sleep(500);
    const d = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); const g = document.querySelector('#seatmap .seat-grid'); return { open: [...document.querySelectorAll('details.panel')].map(d => d.open), zoom: Number(document.querySelector('#zoom').value), cell: getComputedStyle(w).getPropertyValue('--cell').trim(), fits: g.getBoundingClientRect().width <= w.clientWidth }; });
    log('after 400->1280: ' + JSON.stringify(d));
    expect(d.open.every(o => o) && d.zoom > 48 && d.cell === d.zoom + 'px' && d.fits, `R-02 1280 복귀: 패널 펼침·zoom ${d.zoom} 재맞춤`);
    // 중간 폭(1000·700)에서도 격자가 래퍼 안에 들어옴(resize 디바운스 경로)
    for (const w of [1000, 700, 1280]) {
      await page.setViewportSize({ width: w, height: 800 }); await sleep(450);
      const f = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); const g = document.querySelector('#seatmap .seat-grid'); return { gw: Math.round(g.getBoundingClientRect().width), cw: w.clientWidth, zoom: document.querySelector('#zoom').value, docSw: document.documentElement.scrollWidth }; });
      log(`width ${w}: ${JSON.stringify(f)}`);
      expect(f.gw <= f.cw + 2 && f.docSw <= w, `R-02 ${w}px에서 좌석표 폭 안(격자 ${f.gw}/래퍼 ${f.cw}, zoom ${f.zoom})`);
    }
  });

  // ── R-03. 수동 확대값 유지 규칙: 슬라이더 → 리사이즈·새로고침 유지, 레이아웃 변경·맞춤 → 자동 ──
  await section('R-03', async () => {
    await page.locator('#zoom').fill('60'); await page.locator('#zoom').dispatchEvent('input'); await sleep(150);
    let st = await S(); expect(st.ui.zoomManual === true && st.ui.zoom === 60, 'R-03 슬라이더 → 수동(60)');
    await page.setViewportSize({ width: 400, height: 800 }); await sleep(500);
    st = await S(); const cellM = await page.evaluate(() => getComputedStyle(document.querySelector('#seatmap-wrap')).getPropertyValue('--cell').trim());
    const openM = await page.$$eval('details.panel', ds => ds.map(d => d.open));
    expect(st.ui.zoom === 60 && st.ui.zoomManual && cellM === '60px' && openM.every(o => !o), 'R-03 400px에서도 수동 60 유지(패널은 접힘)');
    await page.setViewportSize({ width: 1280, height: 800 }); await sleep(500);
    st = await S(); expect(st.ui.zoom === 60 && st.ui.zoomManual, 'R-03 1280 복귀에도 수동 60 유지');
    await reload(); await closeModal(); await tab('seats'); await sleep(200);
    st = await S(); const cellR = await page.evaluate(() => getComputedStyle(document.querySelector('#seatmap-wrap')).getPropertyValue('--cell').trim());
    expect(st.ui.zoom === 60 && st.ui.zoomManual && cellR === '60px', `R-03 새로고침 후에도 수동 60 유지(--cell ${cellR})`);
    expect(Object.keys(st.state.current.seats).length === 24, 'AC11 새로고침 후 미확정 배치 24석 복원');
    await page.evaluate(() => window.__app.actions.rebuildLayout({ preset: 'exam', params: { rows: 5, cols: 6 } })); await sleep(250);
    st = await S(); const fits = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); const g = document.querySelector('#seatmap .seat-grid'); return g.getBoundingClientRect().width <= w.clientWidth; });
    expect(st.ui.zoomManual === false && st.ui.zoom % 4 === 0 && fits, `R-03 프리셋 변경 → 자동 맞춤(zoom ${st.ui.zoom})`);
    expect(st.state.current.unplaced.length === 24 || Object.keys(st.state.current.seats).length === 0, '레이아웃 변경 시 배치 초기화(미배치 목록)');
    await page.locator('#zoom').fill('52'); await page.locator('#zoom').dispatchEvent('input'); await sleep(100);
    await page.click('[data-action="fit-zoom"]'); await sleep(200); st = await S();
    expect(st.ui.zoomManual === false && st.ui.zoom !== 52, `R-03 '맞춤' → 자동(zoom ${st.ui.zoom})`);
    await page.click('#view-seats [data-action="help-tab"][data-help="seats"]'); await sleep(250);
    const help = await page.locator('.modal').innerText(); await closeModal();
    expect(/맞춤/.test(help) && /옆자리/.test(help), '도움말에 자동 맞춤·핀 옆자리 설명');
    await page.evaluate(() => window.__app.actions.rebuildLayout({ preset: 'pair', params: { sections: 3, rows: 5 } })); await sleep(250);
  });

  // ── 회귀 스팟체크: AC6 카운터, C-01 교사용 인쇄 8열, U-02 미리보기 격자, AC9 확정·히트맵 ──
  await section('AC6', async () => {
    await page.evaluate(() => window.__app.actions.rebuildLayout({ preset: 'pair', params: { sections: 2, rows: 5 } })); await sleep(250);
    const c = await page.evaluate(() => { const s = document.querySelector('#desk-counter span'); return { t: s.textContent, short: s.classList.contains('is-short'), color: getComputedStyle(s).color, dis: document.querySelector('#btn-auto').disabled }; });
    expect(c.t === '책상 20 / 학생 24' && c.short && c.dis && c.color === 'rgb(210, 63, 63)', `AC6 ${c.t} 빨간색·자동 배치 비활성`);
    await page.evaluate(() => window.__app.actions.rebuildLayout({ preset: 'pair', params: { sections: 3, rows: 5 } })); await sleep(250);
    await page.check('#edit-mode'); await page.click('#seatmap .seat[data-key="4-0"]'); await sleep(120); await page.click('#seatmap .seat[data-key="4-7"]'); await sleep(120); await page.uncheck('#edit-mode');
    await page.click('#btn-auto'); await sleep(400);
    expect(await page.locator('#seatmap .seat-card').count() === 24, '샘플 레이아웃 복원 후 자동 배치 24장');
  });
  await section('AC10', async () => {
    await page.click('#btn-print'); await sleep(300);
    await page.check('#print-panel input[name="print-kind"][value="teacher"]'); await sleep(300);
    const t = await page.evaluate(() => { const g = document.querySelector('#print-pages .seat-grid'); const cs = getComputedStyle(g); const tops = [...g.querySelectorAll('.seat')].map(s => Math.round(s.getBoundingClientRect().top)); return { cols: cs.gridTemplateColumns.split(' ').length, rows: new Set(tops).size, boardAfter: !!(g.nextElementSibling && g.nextElementSibling.classList.contains('board-strip')) }; });
    expect(t.cols === 8 && t.rows === 5 && t.boardAfter, `AC10/C-01 교사용 8열×5행·칠판 아래 (${t.cols}×${t.rows})`);
    await page.check('#print-panel input[name="print-kind"][value="plates"]'); await sleep(300);
    expect(await page.locator('#print-pages .page').count() === 6, 'AC10 명패 6페이지');
    await page.keyboard.press('Escape'); await sleep(200);
  });
  await section('AC9', async () => {
    await page.click('#btn-confirm'); await sleep(250); await page.fill('#m-memo', '5차'); await page.click('.modal-back [data-m="ok"]'); await sleep(400);
    let st = await S(); const newest = st.state.history[st.state.history.length - 1]; const today = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    expect(st.state.history.length === 5 && newest.memo === '5차' && newest.date === today, `AC9 히스토리 ${st.state.history.length}건·최신 기록 '${newest && newest.memo}' ${newest && newest.date} (오늘 ${today})`);
    const rep = await page.evaluate(() => [...document.querySelectorAll('#report .rep-row')].map(r => r.textContent.replace(/\s+/g, ' ')).join(' | '));
    expect(!/위반 24건/.test(rep), 'M-02 확정 직후 같은 좌석 회피 전원 위반 아님');
    await tab('history'); const top = await page.locator('#hist-list .hist-card').first().innerText();
    expect(/5차/.test(top), 'AC9 히스토리 탭 맨 위 카드 5차');
    const cell = page.locator('#view-history rect.hc[data-tip^="이도윤-한수아"]').first();
    expect(await cell.count() === 1, 'AC9 히트맵 이도윤-한수아 셀 존재');
    await cell.hover({ force: true }); await sleep(250);
    const tip = await page.evaluate(() => { const t = document.querySelector('#tooltip'); return t && !t.hidden ? t.textContent : ''; });
    expect(/이도윤-한수아: 짝 3회/.test(tip), `AC9 히트맵 호버 툴팁 '${tip}'`);
    await page.locator('#hist-list .hist-card').first().click(); await sleep(300);
    const mini = await page.evaluate(() => { const g = document.querySelector('.modal .seat-grid'); if (!g) return null; const cs = getComputedStyle(g); return { display: cs.display, cols: cs.gridTemplateColumns.split(' ').length }; });
    expect(mini && mini.display === 'grid' && mini.cols === 8, 'U-02 히스토리 미리보기 모달 8열 격자'); await closeModal();
  });
  await shot('r2-final');
};
