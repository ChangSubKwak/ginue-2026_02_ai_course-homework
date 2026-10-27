// reverify.js — 1라운드 수정 결과 독립 재검증 (pw-run.js 모듈). 수정 보고서의 주장과 무관하게 소스·DOM을 직접 확인
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const closeModal = async () => { let n = 0; while (await page.locator('.modal-back').count() && n++ < 6) { await page.keyboard.press('Escape'); await sleep(120); } };
  const tab = async (t) => { await page.click(`#tabs [data-tab="${t}"]`); await sleep(150); };
  const modalTitle = async () => (await page.locator('.modal-back').count()) ? (await page.locator('.modal-back h2').first().innerText()) : '';
  const section = async (name, fn) => { try { await fn(); } catch (e) { expect(false, `${name}: 예외 ${e.message.split('\n')[0]}`); await closeModal(); } };
  const seatOf = (st, sid) => Object.keys(st.state.current.seats).find(k => st.state.current.seats[k] === sid);
  const pairOf = (k) => { const [r, c] = k.split('-').map(Number); return r + '-' + (c % 3 === 0 ? c + 1 : c - 1); };
  await closeModal();

  // ── AC1: 초기 상태 ──
  await section('AC1', async () => {
    const n = await page.locator('#roster-table tbody tr').count(), inactive = await page.locator('#roster-table tr.is-inactive').count();
    expect(n === 25 && inactive === 1, `AC1 명렬 25행·비활성 1행 (${n}/${inactive})`);
    expect((await page.locator('#class-name-btn').innerText()).includes('경인초등학교 5학년 2반'), 'AC1 학급명 표시');
    await tab('history');
    const seatCards = await page.locator('.hist-card.kind-seat').count(), groupCards = await page.locator('.hist-card.kind-group').count();
    expect(seatCards === 4 && groupCards === 1, `AC1 히스토리 자리 4건·모둠 1건 (${seatCards}/${groupCards})`);
    // U-03: 배지 크기
    const badge = await page.locator('.hist-card .badge').first().boundingBox();
    expect(badge && badge.height < 30 && badge.width < 60, `U-03 히스토리 종류 배지가 작은 알약 크기 (${badge && Math.round(badge.width)}×${badge && Math.round(badge.height)})`);
    // U-09: 히트맵 라벨 11px, 셀 22px, TOP5 목록
    const heat = await page.evaluate(() => { const hl = document.querySelector('.heat .hl'); const rc = document.querySelector('.heat .hc'); return { fs: hl && getComputedStyle(hl).fontSize, cell: rc && rc.getBoundingClientRect().width, top5: document.querySelectorAll('.top-pairs li').length, firstTop: (document.querySelector('.top-pairs li') || {}).textContent }; });
    log('heat: ' + JSON.stringify(heat));
    expect(heat.fs === '11px' && heat.cell >= 20 && heat.top5 === 5 && /이도윤-한수아|한수아-이도윤/.test(heat.firstTop || ''), 'U-09 히트맵 라벨 11px·셀 ≥20px·TOP5 목록(1위 이도윤-한수아)');
    // U-02: 배치 미리보기 모달 격자
    await page.click('.hist-card.kind-seat >> nth=0'); await sleep(300);
    const mini = await page.evaluate(() => { const g = document.querySelector('.modal .seatmap-wrap.mini .seat-grid'); if (!g) return null; const cs = getComputedStyle(g); return { display: cs.display, cols: cs.gridTemplateColumns.split(' ').length, rows: cs.gridTemplateRows.split(' ').length, tops: new Set([...g.querySelectorAll('.seat')].map(s => Math.round(s.getBoundingClientRect().top))).size }; });
    log('mini grid: ' + JSON.stringify(mini));
    expect(mini && mini.display === 'grid' && mini.cols === 8 && mini.rows === 5 && mini.tops === 5, 'U-02 히스토리 미리보기 모달 좌석표 8열×5행 격자');
    await shot('r-hist-preview-modal'); await closeModal();
  });

  // ── AC2: 자동 배치 ──
  await section('AC2', async () => {
    await tab('seats');
    // U-06: 조건 라벨 줄바꿈 없음(라벨 span 높이가 한 줄)
    const condLabels = await page.evaluate(() => [...document.querySelectorAll('#cond-panel .ck-text > span')].map(s => ({ t: s.textContent.trim(), h: Math.round(s.getBoundingClientRect().height), lh: parseFloat(getComputedStyle(s).lineHeight) })));
    log('cond labels: ' + JSON.stringify(condLabels));
    expect(condLabels.length >= 6 && condLabels.every(x => x.h <= x.lh * 1.6), 'U-06 조건 라벨이 한 줄(글자 중간 줄바꿈 없음)');
    const t0 = Date.now(); await page.click('#btn-auto'); await page.waitForFunction(() => document.querySelectorAll('#seatmap .seat-card').length === 24, null, { timeout: 3000 }); const dt = Date.now() - t0;
    expect(dt < 1000, `AC2 자동 배치 ${dt}ms < 1초, 카드 24장`);
    const rep = await page.evaluate(() => [...document.querySelectorAll('#report .rep-row')].map(r => ({ lbl: r.querySelector('.lbl').childNodes[0].textContent.trim(), val: r.querySelector('.val').textContent.trim(), ok: r.classList.contains('st-ok'), color: getComputedStyle(r.querySelector('.val')).color })));
    log('report: ' + JSON.stringify(rep));
    const apart = rep.find(r => r.lbl === '분리 쌍'), front = rep.find(r => r.lbl === '앞자리 배려');
    expect(apart && apart.val === '2/2 충족' && apart.ok && front && front.val === '3/3 충족' && front.ok, 'AC2 리포트 분리 쌍 2/2·앞자리 배려 3/3 충족(초록)');
    // U-10: 빈 책상이 짝 단위로 뒷줄에 모임 → 단독석 0
    const gp = rep.find(r => r.lbl === '남녀 짝'); const note = await page.evaluate(() => { const r = [...document.querySelectorAll('#report .rep-row')].find(x => x.textContent.includes('남녀 짝')); return r ? r.querySelector('.lbl small').textContent : ''; });
    log('gender row: ' + JSON.stringify(gp) + ' note=' + note);
    expect(gp && gp.val === '12/12 충족' && !/단독석/.test(note), 'U-10 남녀 짝 12/12 충족·단독석 없음');
    const st = await S(); const emptyKeys = ['4-1', '4-3', '4-4', '4-6'].filter(k => !st.state.current.seats[k]);
    expect(emptyKeys.length === 4, 'U-10 빈 책상 4개가 모두 뒷줄(4-1·4-3·4-4·4-6)');
    // U-17 범례
    expect((await page.locator('#seat-legend').innerText()).includes('앞 구역') && (await page.locator('#seat-legend').innerText()).includes('고정'), 'U-17 좌석표 범례 표시');
    await shot('r-seats-auto');
  });

  // ── R-01 후보: 핀 고정 + 다시 섞기 → 고정 학생의 짝 책상이 비는가 ──
  await section('R-pin', async () => {
    let st = await S(); const sid = st.state.current.seats['0-0']; expect(!!sid, '0-0에 학생 배치됨(핀 테스트 전제)');
    await page.click(`#seatmap .seat-card[data-sid="${sid}"] .lock`); await sleep(150);
    st = await S(); expect(st.state.current.locked.includes(sid), '자물쇠 켜짐');
    let kept = 0, partnerEmpty = 0;
    for (let i = 0; i < 3; i++) { await page.click('#btn-shuffle'); await sleep(350); st = await S(); if (st.state.current.seats['0-0'] === sid) kept++; if (!st.state.current.seats['0-1']) partnerEmpty++; }
    expect(kept === 3, `AC5 자물쇠 학생 3회 섞기에도 0-0 유지 (${kept}/3)`);
    const rows4 = ['4-1', '4-3', '4-4', '4-6'].map(k => !!st.state.current.seats[k]);
    log(`pin+shuffle: partner(0-1) empty ${partnerEmpty}/3, back row filled=${JSON.stringify(rows4)}, unplaced=${st.state.current.unplaced.length}`);
    expect(partnerEmpty === 0, `R-01 핀 고정 학생의 짝 책상(0-1)이 다시 섞기 후에도 채워짐 (비어 있던 횟수 ${partnerEmpty}/3)`);
    const note = await page.evaluate(() => { const r = [...document.querySelectorAll('#report .rep-row')].find(x => x.textContent.includes('남녀 짝')); return r ? r.querySelector('.lbl small').textContent : ''; });
    log('after pin shuffle gender note: ' + note);
    await shot('r-pin-shuffle');
    await page.click(`#seatmap .seat-card[data-sid="${sid}"] .lock`); await sleep(150);
    await page.click('#btn-auto'); await sleep(350);
  });

  // ── AC4: 탭-탭 교환 → 분리 위반 토스트 → Ctrl+Z ──
  await section('AC4', async () => {
    let st = await S(); const kA = seatOf(st, 's04'), kB = seatOf(st, 's06'); const kP = pairOf(kA); const pid = st.state.current.seats[kP];
    log(`최민준 ${kA} 짝 ${kP}(${pid}) 강시우 ${kB}`);
    if (!pid) { expect(false, 'AC4 전제: 최민준 짝 책상이 비어 있음'); return; }
    await page.click(`#seatmap .seat-card[data-sid="s06"]`); await sleep(120);
    expect(await page.locator('#seatmap .seat.tap-sel').count() === 1, 'AC4 첫 탭 하이라이트');
    await page.click(`#seatmap .seat-card[data-sid="${pid}"]`); await sleep(250);
    st = await S();
    expect(st.state.current.seats[kP] === 's06' && st.state.current.seats[kB] === pid, 'AC4 탭-탭으로 두 학생 교환');
    const toasts = await page.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.className + '|' + t.textContent));
    log('toasts: ' + JSON.stringify(toasts));
    expect(toasts.some(t => t.includes('분리 조건 위반: 최민준-강시우') && t.includes('toast-warn')), 'AC4 토스트 "분리 조건 위반: 최민준-강시우"');
    expect(await page.locator('#seatmap .seat.viol').count() >= 2, 'AC4 위반 좌석 빨간 테두리(≥2)');
    await shot('r-violation');
    await page.keyboard.press('Control+z'); await sleep(250); st = await S();
    expect(st.state.current.seats[kB] === 's06' && st.state.current.seats[kP] === pid && (await page.locator('#seatmap .seat.viol').count()) === 0, 'AC4 Ctrl+Z로 원복·위반 해제');
    await page.keyboard.press('Control+y'); await sleep(200); st = await S(); expect(st.state.current.seats[kP] === 's06', 'Ctrl+Y 다시 실행'); await page.keyboard.press('Control+z'); await sleep(200);
  });

  // ── M-01: PNG 캔버스 기하(열 8트랙) ──
  await section('M-01', async () => {
    await page.evaluate(() => { window.__cv = null; const orig = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function (cb, type) { window.__cv = this; return orig.call(this, cb, type); }; });
    const dl = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
    await page.click('#btn-png'); await sleep(600); const d = await dl;
    const info = await page.evaluate(() => { const cv = window.__cv; if (!cv) return null; const x = cv.getContext('2d'); const px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data).slice(0, 3); return { w: cv.width, h: cv.height, gapPx: px(301, 175), deskPx: px(464, 215), desk7: px(756, 215) }; });
    log('png canvas: ' + JSON.stringify(info) + ' download=' + (d ? d.suggestedFilename() : 'none'));
    const isWhite = (p) => p && p[0] === 255 && p[1] === 255 && p[2] === 255;
    const isDesk = (p) => p && !isWhite(p) && (p[0] + p[1] + p[2]) > 600;
    expect(info && info.w === 894 && info.h === 814, `M-01 PNG 캔버스 크기 894×814(8트랙 기준) 실제 ${info && info.w}×${info && info.h}`);
    expect(info && isWhite(info.gapPx) && isDesk(info.deskPx) && isDesk(info.desk7), 'M-01 통로 열은 흰색, c=4·c=7 책상은 채움색');
    expect(!d || /^jari-\d{8}\.png$/.test(d.suggestedFilename()), 'PNG 파일명 jari-YYYYMMDD.png');
  });

  // ── AC10 / C-01 / U-01: 인쇄 교사용 180° 회전, 명패 6페이지 ──
  await section('AC10', async () => {
    const st = await S(); const sid00 = st.state.current.seats['0-0'];
    await page.click('#btn-print'); await sleep(300);
    const stu = await page.evaluate((sid) => { const g = document.querySelector('#print-pages .seat-grid'); const cs = getComputedStyle(g); const seats = [...g.querySelectorAll('.seat')]; const me = g.querySelector(`.seat-card[data-sid="${sid}"]`).closest('.seat').getBoundingClientRect(); const tops = seats.map(s => s.getBoundingClientRect().top), lefts = seats.map(s => s.getBoundingClientRect().left); return { cols: cs.gridTemplateColumns.split(' ').length, rows: cs.gridTemplateRows.split(' ').length, boardFirst: g.previousElementSibling && g.previousElementSibling.classList.contains('board-strip'), meTopMin: me.top <= Math.min(...tops) + 1, meLeftMin: me.left <= Math.min(...lefts) + 1 }; }, sid00);
    log('print student: ' + JSON.stringify(stu));
    expect(stu.cols === 8 && stu.rows === 5 && stu.boardFirst && stu.meTopMin && stu.meLeftMin, 'AC10 게시용: 8열×5행, 칠판 위, 0-0 학생이 좌상단');
    await page.check('input[name=print-kind][value=teacher]'); await sleep(350);
    const tea = await page.evaluate((sid) => { const g = document.querySelector('#print-pages .seat-grid'); const cs = getComputedStyle(g); const seats = [...g.querySelectorAll('.seat')]; const me = g.querySelector(`.seat-card[data-sid="${sid}"]`).closest('.seat').getBoundingClientRect(); const tops = seats.map(s => s.getBoundingClientRect().top), lefts = seats.map(s => s.getBoundingClientRect().left); return { inline: g.style.gridTemplateColumns, cols: cs.gridTemplateColumns.split(' ').length, rows: cs.gridTemplateRows.split(' ').length, distinctTops: new Set(tops.map(Math.round)).size, boardAfter: g.nextElementSibling && g.nextElementSibling.classList.contains('board-strip'), meTopMax: me.top >= Math.max(...tops) - 1, meLeftMax: me.left >= Math.max(...lefts) - 1, gridW: Math.round(g.getBoundingClientRect().width), gridH: Math.round(g.getBoundingClientRect().height) }; }, sid00);
    log('print teacher: ' + JSON.stringify(tea));
    expect(tea.cols === 8 && tea.rows === 5 && tea.distinctTops === 5 && tea.boardAfter, 'AC10/C-01 교사용: 격자 8열×5행(행 5개), 칠판 띠 아래');
    expect(tea.meTopMax && tea.meLeftMax, 'AC10 교사용: 0-0 학생이 우하단(180° 회전)');
    expect(tea.gridW > tea.gridH, '교사용 격자가 가로형(세로 1열 아님)');
    await shot('r-print-teacher');
    await page.emulateMedia({ media: 'print' }); await sleep(200);
    const pm = await page.evaluate(() => { const g = document.querySelector('#print-pages .seat-grid'); return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, tops: new Set([...g.querySelectorAll('.seat')].map(s => Math.round(s.getBoundingClientRect().top))).size, headerHidden: getComputedStyle(document.querySelector('.app-header')).display === 'none', tabsHidden: getComputedStyle(document.querySelector('#tabs')).display === 'none' }; });
    log('print media teacher: ' + JSON.stringify(pm));
    expect(pm.cols === 8 && pm.tops === 5 && pm.headerHidden && pm.tabsHidden, '인쇄 미디어에서도 교사용 8열×5행·네비 숨김');
    await shot('r-print-teacher-media');
    await page.emulateMedia({ media: null }); await sleep(100);
    await page.check('input[name=print-kind][value=plates]'); await sleep(350);
    const pl = await page.evaluate(() => ({ pages: document.querySelectorAll('#print-pages .page').length, perPage: [...document.querySelectorAll('#print-pages .page')].map(p => p.querySelectorAll('.plate').length), txt: document.querySelector('#print-pagecount').textContent, css: (document.querySelector('#page-style') || {}).textContent }));
    log('plates: ' + JSON.stringify(pl));
    expect(pl.pages === 6 && pl.perPage.every(n => n === 4) && /6페이지/.test(pl.txt) && /portrait/.test(pl.css), 'AC10 명패 6페이지×4개, A4 세로');
    await page.keyboard.press('Escape'); await sleep(150); expect(await page.locator('#print-panel').isHidden(), 'Esc로 인쇄 패널 닫힘');
  });

  // ── AC9 + M-02: 배치 확정 → 리포트 자기 비교 없음, 히스토리 맨 위, 히트맵 툴팁 ──
  await section('AC9/M-02', async () => {
    const before = await page.locator('#seatmap .seat.viol').count();
    await page.click('#btn-confirm'); await sleep(250); expect((await modalTitle()) === '배치 확정', 'AC9 배치 확정 모달');
    const dateVal = await page.inputValue('#m-date'); const today = new Date(); const ts = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    expect(dateVal === ts, `AC9 날짜 기본 오늘(${dateVal})`);
    await page.fill('#m-memo', '5차'); await page.click('.modal-back [data-m="ok"]'); await sleep(350);
    let st = await S(); expect(st.state.history.length === 5 && st.state.current.confirmedId === st.state.history[4].id, 'M-02 확정 기록에 confirmedId 연결');
    const rep1 = await page.evaluate(() => [...document.querySelectorAll('#report .rep-row')].map(r => r.querySelector('.lbl').childNodes[0].textContent.trim() + ':' + r.querySelector('.val').textContent.trim()));
    log('after confirm report: ' + JSON.stringify(rep1));
    expect(!rep1.some(r => /위반 2\d건/.test(r)) && (await page.locator('#seatmap .seat.viol').count()) === before, 'M-02 확정 직후 리포트가 자기 자신과 비교되지 않음(전원 위반 아님)');
    await page.click('#cond-panel [data-action="cond-hard"][data-cond="tall"][data-v="1"]'); await sleep(250);
    const rep2 = await page.evaluate(() => [...document.querySelectorAll('#report .rep-row')].map(r => r.querySelector('.lbl').childNodes[0].textContent.trim() + ':' + r.querySelector('.val').textContent.trim()));
    log('after cond toggle report: ' + JSON.stringify(rep2));
    expect(!rep2.some(r => /위반 2\d건/.test(r)) && (await page.locator('#seatmap .seat.viol').count()) <= before, 'M-02 확정 후 조건 변경 재계산에서도 전원 위반 없음');
    await page.click('#cond-panel [data-action="cond-hard"][data-cond="tall"][data-v="0"]'); await sleep(200);
    await tab('history');
    const first = await page.locator('.hist-card').first().innerText();
    expect(first.includes('5차') && first.includes(ts), 'AC9 히스토리 맨 위 오늘 날짜 5차 카드: ' + first.replace(/\n/g, ' '));
    const cell = page.locator('.heat rect.hc[data-tip^="이도윤-한수아"]').first(); await cell.hover(); await sleep(250);
    const tip = await page.locator('#tooltip').innerText(); log('tooltip: ' + tip);
    expect(!(await page.locator('#tooltip').isHidden()) && /짝 3회/.test(tip), 'AC9 히트맵 이도윤-한수아 툴팁 "짝 3회"');
    await shot('r-history-after-confirm');
    // 새 배치 → confirmedId 해제(최근 이력으로 다시 포함)
    await tab('seats'); await page.click('#btn-auto'); await sleep(350); st = await S(); expect(st.state.current.confirmedId == null, 'M-02 자동 배치 후 confirmedId 해제');
  });

  // ── AC8: 모둠 6 + M-02(모둠) ──
  await section('AC8', async () => {
    await tab('groups'); await page.check('input[name=gmode][value=count]'); await page.fill('#g-count', '6'); await page.check('#g-gender'); await page.check('#g-roles');
    await page.click('#btn-make-groups'); await sleep(300);
    const g = await page.evaluate(() => [...document.querySelectorAll('.group-card')].map(c => ({ n: c.querySelectorAll('.member').length, roles: [...c.querySelectorAll('.role')].map(r => r.textContent).sort().join(',') })));
    log('groups: ' + JSON.stringify(g));
    expect(g.length === 6 && g.every(x => x.n === 4 && x.roles === '기록이,나눔이,이끔이,지킴이'), 'AC8 6모둠×4명, 역할 4종 각 1개');
    await page.click('#btn-confirm-groups'); await sleep(200); await page.fill('#m-memo', '재검증'); await page.click('.modal-back [data-m="ok"]'); await sleep(300);
    const chip = await page.locator('#group-report').innerText(); log('group report after confirm: ' + chip.replace(/\n/g, ' '));
    expect(/반복 모둠 쌍 0건/.test(chip), 'M-02 모둠 확정 직후 반복 모둠 쌍 0건(자기 비교 없음)');
    await page.click('.gname >> nth=0'); await sleep(200); await page.fill('#m-gname', '별모둠'); await page.click('.modal-back [data-m="ok"]'); await sleep(250);
    const chip2 = await page.locator('#group-report').innerText();
    expect(/반복 모둠 쌍 0건/.test(chip2) && (await page.locator('.gname').first().innerText()) === '별모둠', 'M-02 모둠 이름 변경 재렌더 후에도 반복 모둠 쌍 0건');
    await shot('r-groups');
  });

  // ── M-05: 이름 변경 → 쌍 목록 갱신 ──
  await section('M-05', async () => {
    await tab('roster');
    const inp = page.locator('#roster-table tr[data-id="s04"] input[data-field="name"]'); await inp.fill('최민준B'); await inp.dispatchEvent('change'); await sleep(200);
    const pl = await page.locator('#pair-list').innerText(); const opt = await page.locator('#pair-a option[value="s04"]').innerText();
    expect(pl.includes('최민준B') && opt.includes('최민준B'), 'M-05 이름 변경 후 쌍 목록·드롭다운 갱신');
    await inp.fill('최민준'); await inp.dispatchEvent('change'); await sleep(200);
  });

  // ── AC13: 붙여넣기 등록 ──
  await section('AC13', async () => {
    await page.fill('#paste-area', '1\t김가상\t남\n2\t이가상\t여\n3\t박가상\t남\n4\t최가상'); await page.click('[data-action="parse-paste"]'); await sleep(200);
    const pv = await page.evaluate(() => ({ ok: document.querySelectorAll('#paste-preview tr.st-ok').length, warn: document.querySelectorAll('#paste-preview tr.st-warn').length, warnTxt: (document.querySelector('#paste-preview tr.st-warn') || {}).textContent }));
    expect(pv.ok === 3 && pv.warn === 1 && /성별 미지정/.test(pv.warnTxt || ''), `AC13 미리보기 정상 3·경고 1(성별 미지정) ${JSON.stringify(pv)}`);
    await page.click('[data-action="add-parsed"]'); await sleep(250);
    expect((await S()).state.students.length === 29, 'AC13 추가 후 29명');
    const dup = await page.evaluate(() => [...document.querySelectorAll('#roster-table tr .warn-ico')].length); log('dup number icons: ' + dup);
    expect(dup >= 4, '중복 번호 경고 아이콘 표시');
  });

  // ── AC3: 앞자리 태그 7명 하드 → 위반 1·완화 제안 ──
  await section('AC3', async () => {
    for (const id of ['s01', 's02', 's05', 's07']) { await page.click(`#roster-table tr[data-id="${id}"] [data-action="toggle-tag"][data-tag="front"]`); await sleep(80); }
    const cnt = (await S()).state.students.filter(s => s.active && s.tags.includes('front')).length; expect(cnt === 7, `AC3 앞자리 태그 7명 (${cnt})`);
    await tab('seats'); await page.click('#cond-panel [data-action="cond-hard"][data-cond="front"][data-v="1"]'); await sleep(150); await page.click('#btn-auto'); await sleep(400);
    const viol = await page.locator('#seatmap .seat.viol').count(); const sug = await page.locator('#report .suggest').innerText().catch(() => '');
    const st = await S(); const frontItem = st.report.items.find(i => i.type === 'front');
    log(`AC3 viol=${viol} front=${JSON.stringify({ total: frontItem.total, ok: frontItem.ok, v: frontItem.violations.length })} sug=${sug}`);
    expect(viol >= 1 && frontItem.total === 7 && frontItem.violations.length === 1 && /앞 구역 책상 부족\(7>6\)/.test(sug), 'AC3 위반 좌석 1·완화 제안 "앞 구역 책상 부족(7>6)"');
    const violColor = await page.evaluate(() => getComputedStyle(document.querySelector('#seatmap .seat.viol')).borderColor); log('viol border: ' + violColor);
    await shot('r-front-violation');
    await tab('roster'); for (const id of ['s01', 's02', 's05', 's07']) { await page.click(`#roster-table tr[data-id="${id}"] [data-action="toggle-tag"][data-tag="front"]`); await sleep(80); }
  });

  // ── AC6: 2분단×5열 → 책상 20 ──
  await section('AC6', async () => {
    await tab('seats'); await page.fill('#layout-panel input[data-param="sections"]', '2'); await page.dispatchEvent('#layout-panel input[data-param="sections"]', 'change'); await sleep(300);
    const c = await page.evaluate(() => { const s = document.querySelector('#desk-counter span'); return { t: s.textContent, color: getComputedStyle(s).color, short: s.classList.contains('is-short'), dis: document.querySelector('#btn-auto').disabled, unplacedShown: !document.querySelector('#unplaced-card').hidden, unplaced: document.querySelectorAll('#unplaced .chip').length }; });
    const act = (await S()).state.students.filter(s => s.active).length;   // 테스트 중 4명 추가 → 28명
    log('AC6: ' + JSON.stringify(c) + ' active=' + act);
    expect(c.t === `책상 20 / 학생 ${act}` && c.short && c.dis && c.color === 'rgb(210, 63, 63)', `AC6 빨간 카운터 책상 20 / 학생 ${act} + 자동 배치 비활성`);
    expect(c.unplacedShown && c.unplaced === act, `레이아웃 변경 시 미배치 목록 ${act}명 표시`);
    await page.fill('#layout-panel input[data-param="sections"]', '3'); await page.dispatchEvent('#layout-panel input[data-param="sections"]', 'change'); await sleep(300);
  });

  // ── F-03/U-05: ㄷ자형 24명 수용 + U-16 자동 맞춤 ──
  await section('F-03', async () => {
    await page.check('#layout-panel input[name=preset][value=u]'); await sleep(300);
    const u = await page.evaluate(() => { const L = window.__app.getState().state.layout; const w = document.querySelector('#seatmap-wrap'); const g = document.querySelector('#seatmap .seat-grid'); return { desks: L.cells.filter(c => c.desk).length, rows: L.rows, cols: L.cols, params: L.params, fields: [...document.querySelectorAll('#layout-panel input[data-param]')].map(i => i.dataset.param + ':' + i.min + '-' + i.max), counter: document.querySelector('#desk-counter').textContent, dis: document.querySelector('#btn-auto').disabled, zoom: document.querySelector('#zoom').value, fits: g.getBoundingClientRect().width <= w.clientWidth, wrapScroll: w.scrollWidth <= w.clientWidth }; });
    log('U preset: ' + JSON.stringify(u));
    expect(u.desks >= 24 && !u.dis && u.fields.some(f => f.startsWith('layers')), `F-03/U-05 ㄷ자형 기본 책상 ${u.desks}개 ≥ 24, 자동 배치 가능, 겹 파라미터`);
    expect(u.fits && u.wrapScroll, 'U-16 레이아웃 변경 시 좌석표가 컨테이너 폭에 자동 맞춤');
    await page.click('#btn-auto'); await sleep(400);
    const actU = (await S()).state.students.filter(s => s.active).length;
    expect(await page.locator('#seatmap .seat-card').count() === actU, `ㄷ자형에서 ${actU}명 자동 배치`);
    await shot('r-preset-u');
    await page.fill('#layout-panel input[data-param="cols"]', '12'); await page.dispatchEvent('#layout-panel input[data-param="cols"]', 'change'); await sleep(300);
    const u2 = await page.evaluate(() => { const L = window.__app.getState().state.layout; const w = document.querySelector('#seatmap-wrap'); const g = document.querySelector('#seatmap .seat-grid'); return { desks: L.cells.filter(c => c.desk).length, fits: g.getBoundingClientRect().width <= w.clientWidth + 1 }; });
    log('U 12 cols: ' + JSON.stringify(u2)); expect(u2.fits, 'ㄷ자형 가로 12에서도 1280px에 맞춤');
    await page.check('#layout-panel input[name=preset][value=pair]'); await sleep(300);
    await page.click('#btn-auto'); await sleep(400);
  });

  // ── U-20: 편집 모드 표시 + 책상 끄기 ──
  await section('U-20', async () => {
    await page.check('#edit-mode'); await sleep(200);
    const e = await page.evaluate(() => ({ outline: getComputedStyle(document.querySelector('#seatmap-wrap')).outlineStyle, note: !!document.querySelector('#seat-legend .edit-note') }));
    expect(e.outline === 'dashed' && e.note, 'U-20 편집 모드 점선 외곽선·안내 띠');
    await page.click('#seatmap .seat[data-key="3-0"]'); await sleep(250);
    const st = await S(); expect(!st.state.layout.cells.find(c => c.r === 3 && c.c === 0).desk && st.state.current.unplaced.length === 1, '편집 모드 클릭으로 책상 끄기 → 미배치 1명');
    await page.click('#seatmap .seat[data-key="3-0"]'); await sleep(250); await page.uncheck('#edit-mode'); await sleep(150);
    // 미배치 칩 탭 → 빈 책상 탭으로 배치
    const un = (await S()).state.current.unplaced; if (un.length) { await page.click(`#unplaced [data-sid="${un[0]}"]`); await sleep(120); await page.click('#seatmap .seat.empty >> nth=0'); await sleep(250); expect((await S()).state.current.unplaced.length === 0, '미배치 칩 탭-탭으로 빈 책상에 배치'); }
  });

  // ── AC7: 발표 모드 ──
  await section('AC7', async () => {
    const nAct = Object.keys((await S()).state.current.seats).length;
    await page.click('#btn-present'); await sleep(400);
    const p0 = await page.evaluate(() => ({ hidden: document.querySelector('#present').hidden, fs: !!document.fullscreenElement, fallback: document.querySelector('#present').classList.contains('fallback'), cards: document.querySelectorAll('#present-map .flip').length, flipped: document.querySelectorAll('#present-map .flipped').length, q: document.querySelector('#present-map .face.front').textContent }));
    log('present: ' + JSON.stringify(p0));
    expect(!p0.hidden && (p0.fs || p0.fallback) && p0.cards === nAct && p0.flipped === 0 && p0.q === '?', `AC7 발표 모드: ${nAct}장 ? 뒷면(전체 화면 또는 오버레이)`);
    await page.click('#pr-start'); await sleep(150); const f1 = await page.locator('#present-map .flipped').count(); await sleep(1450); const f2 = await page.locator('#present-map .flipped').count();
    expect(f1 === 1 && f2 === 3, `AC7 시작 직후 1장 → 1.6초 후 3장 (0.7초 간격) 실제 ${f1}/${f2}`);
    await page.click('#pr-start'); await sleep(100); const paused = await page.locator('#present-map .flipped').count(); await sleep(800); expect(await page.locator('#present-map .flipped').count() === paused, 'AC7 일시정지');
    await page.keyboard.press('Space'); await sleep(200); expect(await page.locator('#present-map .flipped').count() === paused + 1, 'AC7 Space로 다음 카드');
    expect((await page.locator('#present-progress').innerText()).includes(`${paused + 1}/${nAct}`), 'AC7 진행 표시 k/n');
    await shot('r-present');
    await page.keyboard.press('Escape'); await sleep(300);
    expect(await page.locator('#present').isHidden() && (await page.locator('#seatmap .seat-card').count()) === nAct, 'AC7 Esc 종료 후 배치 유지');
  });

  // ── AC11: 새로고침 복원 ──
  await section('AC11', async () => {
    await tab('roster'); const inp = page.locator('#roster-table tr[data-id="s01"] input[data-field="name"]'); await inp.fill('김하늘R'); await inp.dispatchEvent('change'); await sleep(500);
    const before = await S(); await reload(); await closeModal(); const after = await S();
    expect(after.state.students.find(s => s.id === 's01').name === '김하늘R' && JSON.stringify(after.state.current.seats) === JSON.stringify(before.state.current.seats) && after.state.students.length === 29, 'AC11 새로고침 후 이름 변경·미확정 배치 복원');
    expect(after.undo.past === 0, 'Undo 스택은 초기화');
  });

  // ── AC12 + C-02 + M-03 + F-02: 내보내기 → 전체 삭제 → 가져오기, 손상 파일 거부, 삭제 유지 ──
  await section('AC12', async () => {
    const root = (await S()).state; const good = JSON.stringify(root);
    await tab('settings');
    const dl = page.waitForEvent('download', { timeout: 4000 }).catch(() => null); await page.click('[data-action="export-json"]'); const d = await dl;
    expect(!!d && /^jari-ttukttak-\d{8}\.json$/.test(d.suggestedFilename()), 'AC12 JSON 내보내기 파일명: ' + (d && d.suggestedFilename()));
    await page.click('[data-action="wipe"]'); await sleep(200); expect(/1\/2/.test(await modalTitle()), '전체 삭제 1단계 모달'); await page.click('.modal-back [data-m="ok"]'); await sleep(200); expect(/2\/2/.test(await modalTitle()), '전체 삭제 2단계 모달'); await page.click('.modal-back [data-m="ok"]'); await sleep(400);
    let st = await S(); expect(st.state.students.length === 0 && st.state.history.length === 0, '전체 삭제 후 학생 0·히스토리 0');
    expect(await page.evaluate(() => localStorage.getItem('edu.jari-ttukttak.data') === null), '전체 삭제 후 저장 키 제거');
    await reload(); await closeModal(); st = await S();
    expect(st.state.students.length === 0, 'M-03/F-04 전체 삭제 후 새로고침해도 빈 학급 유지');
    expect((await page.locator('#seatmap').innerText().catch(() => '')).includes('') , 'noop');
    // F-02: 빈 상태에서 명렬 등록 → 모둠 편성 버튼 활성
    await tab('roster'); await page.fill('#paste-area', '1\t가\t남\n2\t나\t여\n3\t다\t남'); await page.click('[data-action="parse-paste"]'); await sleep(150); await page.click('[data-action="add-parsed"]'); await sleep(250);
    await tab('groups'); const dis = await page.locator('#btn-make-groups').isDisabled(); expect(!dis, 'F-02 명렬 등록 후 모둠 편성 버튼 활성');
    if (!dis) { await page.click('#btn-make-groups'); await sleep(300); expect((await page.locator('.group-card').count()) === 3, '학생 3명 → 모둠 수 자동 축소(3모둠)'); }
    await sleep(400); await reload(); await closeModal(); expect((await S()).state.students.length === 3, '삭제 후 새 입력은 새로고침 후에도 유지(ui.wiped 해제)');
    // C-02: 손상 파일(history 항목 layoutSnapshot 누락) → 실패 모달, 기존 데이터 유지
    await tab('settings');
    const bad = JSON.parse(good); bad.history = [{ id: 'hx', date: '2026-01-01', memo: 'x', seats: {} }];
    await page.setInputFiles('#json-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) }); await sleep(500);
    const t1 = await modalTitle(); const b1 = await page.locator('.modal-body').innerText().catch(() => ''); log('bad import modal: ' + t1 + ' / ' + b1);
    expect(t1 === '가져오기 실패' && /history/.test(b1), 'C-02 손상 항목 파일 → 가져오기 실패 모달(구조 검사)'); await closeModal();
    expect((await S()).state.students.length === 3 && (await page.evaluate(() => (JSON.parse(localStorage.getItem('edu.jari-ttukttak.data')) || {}).history.length === 0)), 'C-02 기존 데이터 유지·저장 안 됨');
    // C-02b: 구조 검사는 통과하지만 렌더에서 예외가 나는 파일(conditions.front=null) → 복귀 + 실패 모달
    const bad2 = JSON.parse(good); bad2.conditions.front = null;
    await page.setInputFiles('#json-file', { name: 'bad2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad2)) }); await sleep(500);
    const t2 = await modalTitle(); log('bad2 modal1: ' + t2);
    if (t2 === '백업 가져오기') { await page.click('.modal-back [data-m="ok"]'); await sleep(500); }
    const t3 = await modalTitle(); log('bad2 modal2: ' + t3);
    expect(t3 === '가져오기 실패', 'C-02 렌더 예외 파일 → 기존 데이터로 복귀 + 실패 모달'); await closeModal();
    expect((await S()).state.students.length === 3 && (await page.locator('#roster-table tbody tr').count()) === 3, 'C-02 렌더 예외 후 화면·상태가 기존 데이터');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('edu.jari-ttukttak.data')).students.length === 3), 'C-02 렌더 예외 데이터는 저장되지 않음');
    // 정상 파일 가져오기
    await page.setInputFiles('#json-file', { name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(good) }); await sleep(500);
    const body = await page.locator('.modal-body').innerText(); log('import modal: ' + body.replace(/\n/g, ' '));
    expect((await modalTitle()) === '백업 가져오기' && /학생 29명/.test(body) && /배치 5건/.test(body), 'AC12 요약 모달(학생 29명·배치 5건 — 테스트 중 4명 추가·1건 확정)');
    await page.click('.modal-back [data-m="ok"]'); await sleep(500);
    st = await S(); expect(st.state.students.length === 29 && st.state.history.length === 5 && JSON.stringify(st.state.current.seats) === JSON.stringify(root.current.seats) && Object.keys(root.current.seats).length >= 24, 'AC12 가져오기 후 명렬·히스토리·현재 배치(내보낸 것과 동일) 복원');
    await tab('history'); expect((await page.locator('.hist-card.kind-seat').count()) === 5, '히스토리 카드 5건 복원');
  });

  // ── 샘플 복원 → F-05/U-15 투어 ──
  await section('tour', async () => {
    await tab('settings'); await page.click('[data-action="reset-sample"]'); await sleep(200); await page.click('.modal-back [data-m="ok"]'); await sleep(400);
    expect((await S()).state.students.length === 25, '샘플 다시 불러오기 25명');
    await page.evaluate(() => { const u = JSON.parse(localStorage.getItem('edu.jari-ttukttak.ui')); u.tourDone = false; localStorage.setItem('edu.jari-ttukttak.ui', JSON.stringify(u)); });
    await reload(); await sleep(300); expect(/처음 오셨군요/.test(await modalTitle()), '투어 재표시(tourDone=false)');
    expect(await page.isChecked('#m-nomore'), '다시 보지 않기 기본 체크');
    await page.click('.modal-back [data-m="cancel"]'); await sleep(200); await reload(); await sleep(300);
    expect(!(await modalTitle()), 'F-05/U-15 건너뛰기로 닫아도 다음 실행에 투어 미표시');
    await page.evaluate(() => { const u = JSON.parse(localStorage.getItem('edu.jari-ttukttak.ui')); u.tourDone = false; localStorage.setItem('edu.jari-ttukttak.ui', JSON.stringify(u)); });
    await reload(); await sleep(300); await page.uncheck('#m-nomore'); await page.keyboard.press('Escape'); await sleep(200); await reload(); await sleep(300);
    expect(/처음 오셨군요/.test(await modalTitle()), '다시 보지 않기 해제 후 Esc → 다음 실행에 다시 표시'); await closeModal();
    await page.click('[data-action="help"]'); await sleep(200); expect(await page.locator('.modal [data-tour]').count() === 1, '도움말에 투어 다시 보기 버튼'); await closeModal();
  });

  // ── 역할 이름 변경 전파(m-08) ──
  await section('roles', async () => {
    await tab('settings'); const r0 = page.locator('#settings-roles input[data-role-i="0"]'); await r0.fill('리더'); await r0.dispatchEvent('change'); await sleep(250);
    const st = await S(); const cnt = st.state.groupHistory[0].groups.filter(g => g.members.some(m => m.role === '리더')).length;
    expect(st.state.settings.roles[0] === '리더' && cnt === 6, 'm-08 역할 이름 변경이 과거 모둠 기록에 전파');
    await tab('history'); expect((await page.locator('#fairness table th').allInnerTexts()).includes('리더'), '역할 경험 표 머리글 갱신');
    await tab('settings'); const r1 = page.locator('#settings-roles input[data-role-i="0"]'); await r1.fill('이끔이'); await r1.dispatchEvent('change'); await sleep(200);
  });

  // ── 400px: U-08 첫 로드 접힘·자동 축소, U-07 인쇄 버튼, U-21 발표, AC14 ──
  await section('mobile', async () => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.evaluate(() => { const u = JSON.parse(localStorage.getItem('edu.jari-ttukttak.ui')); u.tab = 'seats'; u.zoomManual = false; localStorage.setItem('edu.jari-ttukttak.ui', JSON.stringify(u)); });
    await reload(); await closeModal(); await sleep(300);
    const m = await page.evaluate(() => { const w = document.querySelector('#seatmap-wrap'); const b = document.querySelector('#btn-auto').getBoundingClientRect(); const tabs = getComputedStyle(document.querySelector('#tabs')); return { panelsOpen: [...document.querySelectorAll('.panel')].map(p => p.open), autoTop: Math.round(b.top), zoom: document.querySelector('#zoom').value, wrapW: w.clientWidth, scrollW: w.scrollWidth, docScroll: document.documentElement.scrollWidth, tabsPos: tabs.position, tabsBottom: tabs.bottom, cards: document.querySelectorAll('#seatmap .seat-card').length }; });
    log('mobile seats: ' + JSON.stringify(m));
    expect(m.panelsOpen.every(o => !o) && m.autoTop < 800, `U-08 400px 첫 로드: 패널 접힘, 자동 배치 버튼 첫 화면(top ${m.autoTop})`);
    expect(m.docScroll <= 400 && m.tabsPos === 'fixed' && m.tabsBottom === '0px', 'AC14 가로 스크롤 없음·탭 바 하단 고정');
    expect(m.scrollW <= m.wrapW + 16, `U-08 좌석표 자동 축소(zoom ${m.zoom}, scroll ${m.scrollW}/${m.wrapW})`);
    await shot('r-mobile-seats');
    if (!m.cards) { await page.click('#btn-auto'); await sleep(400); }
    const st = await S(); const k1 = Object.keys(st.state.current.seats)[0], k2 = Object.keys(st.state.current.seats)[5]; const s1 = st.state.current.seats[k1], s2 = st.state.current.seats[k2];
    await page.click(`#seatmap .seat-card[data-sid="${s1}"]`); await sleep(120); await page.click(`#seatmap .seat-card[data-sid="${s2}"]`); await sleep(250);
    const st2 = await S(); expect(st2.state.current.seats[k1] === s2 && st2.state.current.seats[k2] === s1, 'AC14 400px 탭-탭 교환');
    // U-07 인쇄 패널
    await page.click('#btn-print'); await sleep(300);
    const pr = await page.evaluate(() => { const b = document.querySelector('[data-action="do-print"]').getBoundingClientRect(); const c = document.querySelector('[data-action="close-print"]').getBoundingClientRect(); return { printY: Math.round(b.top), printVisible: b.top >= 0 && b.bottom <= 800 && b.width > 0, closeVisible: c.top >= 0 && c.bottom <= 800, docScroll: document.documentElement.scrollWidth }; });
    log('mobile print: ' + JSON.stringify(pr));
    expect(pr.printVisible && pr.closeVisible && pr.docScroll <= 400, 'U-07 400px 인쇄 패널에서 인쇄하기·닫기 버튼 노출');
    await page.evaluate(() => { document.querySelector('.print-side').scrollTop = 500; }); await sleep(150);
    const pr2 = await page.evaluate(() => { const b = document.querySelector('[data-action="do-print"]').getBoundingClientRect(); return b.top >= 0 && b.bottom <= 800; });
    expect(pr2, 'U-07 종류 패널 스크롤 후에도 인쇄하기 버튼 고정 노출');
    await shot('r-mobile-print'); await page.keyboard.press('Escape'); await sleep(200);
    // U-21 발표 모드
    await page.click('#btn-present'); await sleep(400);
    const pm = await page.evaluate(() => { const cell = getComputedStyle(document.querySelector('#present-map')).getPropertyValue('--cell'); const bar = document.querySelector('.present-bar').getBoundingClientRect(); const name = document.querySelector('#present-map .face.back .name'); const map = document.querySelector('#present-map').getBoundingClientRect(); return { cell, barVisible: bar.bottom <= 800 && bar.top >= 0, nameFs: name && getComputedStyle(name).fontSize, mapLeft: Math.round(map.left), docScroll: document.documentElement.scrollWidth }; });
    log('mobile present: ' + JSON.stringify(pm));
    expect(parseInt(pm.cell) >= 64 && pm.barVisible && parseFloat(pm.nameFs) >= 14 && pm.mapLeft >= 0, 'U-21 400px 발표: 셀 ≥64px·이름 ≥14px·하단 바 노출·왼쪽 잘림 없음');
    await shot('r-mobile-present'); await page.keyboard.press('Escape'); await sleep(200);
    // 명렬 탭 스크롤 안내
    await tab('roster'); expect(await page.locator('.scroll-hint').isVisible(), 'U-18 400px 명렬 표 스크롤 안내');
    await page.setViewportSize({ width: 1280, height: 800 }); await sleep(200);
  });
};
