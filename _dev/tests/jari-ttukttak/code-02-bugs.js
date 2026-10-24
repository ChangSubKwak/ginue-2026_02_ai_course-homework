// code-02-bugs.js — 코드 리뷰에서 의심한 결함 재현 (pw-run.js 모듈)
'use strict';
const path = require('path');
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  const closeModal = async () => { while (await page.locator('.modal-back').count()) { await page.keyboard.press('Escape'); await sleep(150); } };
  await closeModal();
  await page.click('[data-tab=seats]'); await page.click('#btn-auto'); await sleep(400);

  // B1: PNG 저장 — 다운로드 캡처 후 파일로 저장(눈으로 확인)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-png')]);
  const pngPath = path.join(__dirname, 'out', 'b1-saved-png.png'); await dl.saveAs(pngPath); log('png saved: ' + pngPath + ' name=' + dl.suggestedFilename());
  expect(/^jari-\d{8}\.png$/.test(dl.suggestedFilename()), 'B1 PNG 파일명 jari-YYYYMMDD.png');
  const geom = await page.evaluate(() => { const L = window.__app.getState().state.layout; const cell = 110; const colW = L.colTpl.split(' ').map(x => x.includes('0.35') ? cell * 0.35 : cell); return { cols: L.cols, colWLen: colW.length, colW }; });
  log('png colW: ' + JSON.stringify(geom));
  expect(geom.colWLen === geom.cols, `B1 PNG 열 폭 배열 길이(${geom.colWLen}) == cols(${geom.cols})`);

  // B2: 배치 확정 후 리포트 재계산 → 방금 확정한 배치가 자기 자신과 비교되어 반복 위반으로 표시되는가
  await page.click('#btn-confirm'); await page.waitForSelector('.modal'); await page.fill('#m-memo', '검증'); await page.click('.modal [data-m=ok]'); await sleep(300);
  let st = await S(); const repAfterConfirm = st.report.items.filter(i => i.type === 'repeatSeat' || i.type === 'repeatPartner').map(i => `${i.label}: v${i.violations.length}`);
  log('report right after confirm (stale?): ' + repAfterConfirm.join(' | '));
  await page.evaluate(() => window.__app.actions.setCondition('tall', { on: false })); await sleep(100);
  await page.evaluate(() => window.__app.actions.setCondition('tall', { on: true })); await sleep(100);
  st = await S(); const rs = st.report.items.find(i => i.type === 'repeatSeat'), rp = st.report.items.find(i => i.type === 'repeatPartner');
  log(`after recompute: repeatSeat v=${rs && rs.violations.length}, repeatPartner v=${rp && rp.violations.length}, viol cells=${await page.locator('#seatmap .seat.viol').count()}`);
  expect(!(rs && rs.violations.length >= 20), `B2 확정 직후 재계산 시 같은 좌석 회피 위반이 전원(${rs && rs.violations.length}건)으로 표시됨`);
  await shot('b2-self-compare');
  // 모둠도 동일: 편성 → 확정 → 이름 변경 등으로 재렌더 → 반복 모둠 쌍
  await page.click('[data-tab=groups]'); await page.click('#btn-make-groups'); await sleep(200);
  await page.click('#btn-confirm-groups'); await page.waitForSelector('.modal'); await page.click('.modal [data-m=ok]'); await sleep(200);
  await page.evaluate(() => window.__app.actions.makeGroups === undefined); // noop
  await page.locator('#group-grid .gname').first().click(); await page.waitForSelector('.modal'); await page.click('.modal [data-m=ok]'); await sleep(200);
  const grep = await page.locator('#group-report').innerText(); log('group report after confirm+rerender: ' + grep.replace(/\n/g, ' '));
  expect(!/반복 모둠 쌍 (3[0-9])건/.test(grep), 'B2 모둠 확정 후 재렌더 시 반복 모둠 쌍이 전원(36건)으로 표시됨');

  // B3: 전체 데이터 삭제 → 새로고침 → 샘플 데이터 복귀?
  await page.click('[data-tab=settings]'); await page.click('[data-action=wipe]'); await page.waitForSelector('.modal'); await page.click('.modal [data-m=ok]'); await page.waitForSelector('.modal'); await page.click('.modal [data-m=ok]'); await sleep(400);
  expect((await S()).state.students.length === 0, 'B3 삭제 직후 학생 0명');
  const lsAfterWipe = await page.evaluate(() => localStorage.getItem('edu.jari-ttukttak.data'));
  log('localStorage data after wipe: ' + (lsAfterWipe === null ? 'null' : lsAfterWipe.length + ' chars'));
  await reload(); await closeModal();
  const nAfterReload = (await S()).state.students.length; log('students after wipe+reload: ' + nAfterReload);
  expect(nAfterReload === 0, `B3 전체 삭제 후 새로고침해도 빈 상태 유지(실제 ${nAfterReload}명)`);

  // B4: 손상된 히스토리 항목이 있는 JSON 가져오기 — 최상위 키만 검증하므로 통과 → 렌더 예외 + 저장
  await page.evaluate(() => window.__app.actions.resetSample()); await sleep(200);
  const good = (await S()).state; const bad = JSON.parse(JSON.stringify(good)); bad.history.push({ id: 'hx', date: '2026-01-01', memo: '깨진 항목', seats: {} }); // layoutSnapshot·locked 누락
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.click('[data-tab=settings]');
  await page.setInputFiles('#json-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad), 'utf8') }); await sleep(300);
  const modalTitle = await page.locator('.modal h2').count() ? await page.locator('.modal h2').innerText() : '(모달 없음)'; log('import modal title: ' + modalTitle);
  if (await page.locator('.modal [data-m=ok]').count()) { await page.click('.modal [data-m=ok]'); await sleep(400); }
  log('pageerrors after bad import: ' + JSON.stringify(errs));
  expect(modalTitle.includes('실패') || errs.length === 0, 'B4 손상 히스토리 항목 가져오기: 거부되거나 예외 없이 처리');
  const saved = await page.evaluate(() => { try { const d = JSON.parse(localStorage.getItem('edu.jari-ttukttak.data')); return d.history.some(h => h.id === 'hx'); } catch (e) { return 'parse-fail'; } });
  log('bad history persisted to localStorage: ' + saved);
  expect(saved !== true, 'B4 깨진 데이터가 localStorage에 저장되지 않음');
  await reload(); await closeModal();
  const afterReloadOk = await page.evaluate(() => !!document.querySelector('#storage-info').textContent);
  log('after reload storage-info rendered: ' + afterReloadOk);
  expect(afterReloadOk, 'B4 새로고침 후 renderAll 완료(설정 탭 렌더됨)');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await reload(); await closeModal();

  // B5: 비활성 학생이 쌍 선택 드롭다운의 기존 선택값일 때 — 그냥 확인용 로그
  // B6: 이름 변경(change) 후 쌍 목록 이름이 갱신되는가
  await page.click('[data-tab=roster]');
  const firstPair = await page.locator('#pair-list .pair-item').first().innerText(); log('pair before rename: ' + firstPair.replace(/\n/g, ' '));
  const nameInp = page.locator('#roster-table tr[data-id="s04"] input[data-field=name]'); await nameInp.fill('최민준B'); await nameInp.dispatchEvent('change'); await sleep(200);
  const pairAfter = await page.locator('#pair-list .pair-item').first().innerText(); log('pair after rename: ' + pairAfter.replace(/\n/g, ' '));
  expect(pairAfter.includes('최민준B'), 'B6 이름 변경 후 쌍 목록·요약에 새 이름 반영');

  // B7: 미배치 카드 — 샘플 초기 상태(배치 전)에 24명 칩이 모두 노출되는가(스펙: 레이아웃 변경·좌석 부족 시)
  await page.evaluate(() => window.__app.actions.resetSample()); await sleep(200); await page.click('[data-tab=seats]'); await sleep(100);
  const unplacedChips = await page.locator('#unplaced .chip').count(); log('unplaced chips before any arrange: ' + unplacedChips);
  await shot('b7-initial-seats');

  // B8: 발표 모드 전체 공개 시 소리 켜져 있으면 ding 24회 — 로그만
  // B9: 400px 키보드 접근: 빈 책상은 포커스 불가
  const focusable = await page.evaluate(() => { window.__app.actions.autoArrange(); return document.querySelectorAll('#seatmap .seat.empty[tabindex], #seatmap .seat.off[tabindex]').length; });
  log('focusable empty/off desks: ' + focusable);
};
