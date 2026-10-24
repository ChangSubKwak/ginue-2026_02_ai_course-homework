// code-01-bugs.js — 기억상자 코드 리뷰: 의심 결함 재현 (큐 정렬, 애니메이션 중 중복 채점, 리스너 누적, CSV 한도, XSS, 복원/교사 가져오기 검증 누락)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());

  // 1) 오늘 큐 정렬: 밀린 카드가 먼저 와야 함
  let s = await st();
  const cardsById = Object.fromEntries(s.data.cards.map(c => [c.id, c]));
  const dues = s.queue.map(id => cardsById[id].due);
  log('queue dues: ' + dues.join(','));
  const firstOverdueIdx = dues.findIndex(d => d < s.today);
  const firstTodayIdx = dues.findIndex(d => d === s.today);
  expect(firstOverdueIdx >= 0 && firstTodayIdx >= 0, '큐에 밀린 카드와 오늘 카드 모두 존재');
  expect(firstOverdueIdx < firstTodayIdx, '[B1] 밀린 카드가 오늘 카드보다 앞에 정렬됨 (스펙: 밀린 카드 먼저)');

  // 2) 기록 탭 리스너 누적: #view-history 에 addEventListener 호출 횟수 측정
  await page.evaluate(() => {
    window.__cnt = 0; const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (t, ...a) { if (this && this.id === 'view-history' && t === 'click') window.__cnt++; return orig.call(this, t, ...a); };
  });
  for (let i = 0; i < 3; i++) { await page.click('#tab-home'); await page.click('#tab-history'); await sleep(100); }
  const cnt = await page.evaluate(() => window.__cnt);
  log('view-history click listeners added after 3 visits: ' + cnt);
  expect(cnt <= 1, '[B2] 기록 탭 재방문 시 클릭 리스너가 중복 등록되지 않음 (실측 ' + cnt + '회)');

  // 3) 애니메이션(420ms) 중 → 키 두 번: 다음 카드가 보이지도 않은 채 채점되는지 + 마지막 카드에서 예외
  await page.click('#tab-home');
  s = await st();
  const deckId = s.data.decks[0].id;
  const twoIds = s.data.cards.filter(c => c.deckId === deckId).slice(0, 2).map(c => c.id);
  await page.evaluate(ids => window.__app.actions.startSession('deck', ids), twoIds);
  await sleep(200);
  await page.keyboard.press('3'); await page.keyboard.press(' '); await sleep(450);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); // 두 번 연속
  await sleep(100);
  s = await st();
  const resultsNow = s.session ? s.session.results.length : -1;
  log('results after double ArrowRight on card 1: ' + resultsNow + ' (session ' + (s.session ? 'alive' : 'ended') + ')');
  expect(resultsNow === 1, '[B3] 애니메이션 중 → 두 번 눌러도 1장만 채점됨 (실측 ' + resultsNow + '장)');
  await sleep(600);
  // 마지막 카드(세션이 아직 살아 있으면)에서 두 번 누르기 → TypeError 여부
  s = await st();
  if (s.session) {
    await page.keyboard.press('3'); await page.keyboard.press(' '); await sleep(450);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await sleep(700);
  }
  const errAfter = await page.evaluate(() => window.__lastErr || null);
  // 모달(세션 요약) 닫기
  await page.evaluate(() => window.__app.actions.endSession && window.__app.actions.endSession(true));
  const modalBtn = page.locator('.modal-foot .btn-primary'); if (await modalBtn.count()) await modalBtn.first().click();
  await sleep(300);

  // 4) CSV 1,000행 제한 off-by-one: 헤더 없이 1001행 → 몇 장 추가되는가
  await page.evaluate(() => window.__app.actions.setView('cards'));
  const csv = Array.from({ length: 1001 }, (_, i) => `q${i},a${i}`).join('\n');
  const before = (await st()).data.cards.length;
  await page.evaluate(([t, d]) => { window.__app.actions.importCsvText(t, d); }, [csv, deckId]);
  await sleep(800);
  const totalRowText = await page.locator('.modal-body').innerText().catch(() => '');
  log('csv modal: ' + totalRowText.slice(0, 160).replace(/\n/g, ' '));
  await page.click('.modal-foot .btn-primary'); await sleep(400);
  const added = (await st()).data.cards.length - before;
  log('csv added: ' + added);
  expect(added === 1000, '[B4] 헤더 없는 1001행 CSV는 1,000장만 추가됨 (실측 ' + added + '장)');

  // 5) XSS: 교사 요약 JSON의 stats 값에 HTML 삽입
  await page.evaluate(() => { window.__app.actions.setDailyGoal(10); });
  const summary = { type: 'memory-box-summary', version: 1, exportedAt: '2026-10-01T00:00:00', student: { name: '테스트' }, decks: [], wrong: [{ deck: 'd', unit: 'u', front: 'f', reason: 'calc', fails: 1 }], stats: { reviewed30d: '<img src=x onerror="window.__xss1=1">', accuracy30d: 50, streak: 1 } };
  await page.evaluate(() => { const st = window.__app.getState(); });
  await page.evaluate(async txt => { await window.__app.actions.importTeacherFiles([new File([txt], 's.json', { type: 'application/json' })]); }, JSON.stringify(summary));
  await page.evaluate(() => { document.querySelector('[data-action="set-teacher"]') || null; });
  // 교사 모드 켜고 교사 탭 렌더
  await page.evaluate(() => window.__app.actions.setView('settings'));
  await page.click('input[data-action="set-teacher"]'); await sleep(200);
  await page.evaluate(() => window.__app.actions.setView('teacher')); await sleep(600);
  const xss1 = await page.evaluate(() => window.__xss1 || 0);
  expect(!xss1, '[B5] 교사 요약 JSON stats 값이 이스케이프됨 (onerror 실행 여부 ' + xss1 + ')');
  await shot('teacher-xss');

  // 6) 교사 가져오기 검증 누락: wrong이 배열이 아닌 요약 → 교사 탭 렌더 예외, 저장되어 새로고침 후에도 지속
  const bad = { type: 'memory-box-summary', version: 1, exportedAt: '2026-10-02T00:00:00', student: { name: '깨진파일' }, wrong: {}, stats: {} };
  const errsBefore = await page.evaluate(() => (window.__errs || []).length);
  await page.evaluate(() => { window.__errs = []; window.addEventListener('error', e => window.__errs.push(e.message)); });
  await page.evaluate(async txt => { try { await window.__app.actions.importTeacherFiles([new File([txt], 'bad.json', { type: 'application/json' })]); } catch (e) { window.__errs.push('import: ' + e.message); } }, JSON.stringify(bad));
  await sleep(500);
  let errs = await page.evaluate(() => window.__errs);
  log('teacher bad import errors: ' + JSON.stringify(errs));
  const teacherHtmlLen = await page.evaluate(() => document.getElementById('view-teacher').innerHTML.length);
  log('teacher view html length after bad import: ' + teacherHtmlLen);
  await reload();
  await page.evaluate(() => window.__app.actions.setView('teacher')).catch(e => log('setView teacher threw: ' + e.message));
  await sleep(400);
  const teacherHtmlLen2 = await page.evaluate(() => document.getElementById('view-teacher').innerHTML.length);
  log('teacher view html length after reload: ' + teacherHtmlLen2);
  expect(teacherHtmlLen2 > 200, '[B6] 형식이 어긋난 요약 파일을 넣어도 교사 탭이 렌더됨 (새로고침 후 길이 ' + teacherHtmlLen2 + ')');
  await shot('teacher-after-bad-import');

  // 7) 복원 검증 누락 + 데이터 손실: type만 맞고 profiles/meta.profiles가 빈 백업으로 '덮어쓰기'
  await page.evaluate(() => { window.__app.actions.setView('settings'); });
  const cardsBefore = (await st()).data.cards.length;
  log('cards before bad restore: ' + cardsBefore);
  const badBackup = { type: 'memory-box-backup', version: 1, exportedAt: '2026-10-01T00:00:00', meta: {}, profiles: {} };
  await page.evaluate(txt => { window.__errs = window.__errs || []; window.__app.actions.restoreFromFile(new File([txt], 'b.json', { type: 'application/json' })).catch(e => window.__errs.push('restore: ' + e.message)); }, JSON.stringify(badBackup));
  await sleep(600);
  const overBtn = page.locator('.modal-foot .btn-danger');
  const modalShown = await overBtn.count();
  log('restore modal shown: ' + modalShown);
  if (modalShown) { await overBtn.click(); await sleep(600); }
  errs = await page.evaluate(() => window.__errs);
  log('restore errors: ' + JSON.stringify(errs));
  await reload();
  const after = await page.evaluate(() => { try { return window.__app.getState().data.cards.length; } catch (e) { return 'ERR ' + e.message; } });
  log('cards after bad restore + reload: ' + after);
  expect(after === cardsBefore, '[B7] 형식이 어긋난 백업으로 덮어쓰기 시 기존 데이터가 보존됨 (전 ' + cardsBefore + ' → 후 ' + after + ')');
  await shot('after-bad-restore');
};
