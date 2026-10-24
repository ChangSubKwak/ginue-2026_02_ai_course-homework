// func-session.js — 홈·복습 세션·스케줄러·요약·이어서 하기 독립 검증 (pw-run.js용)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const txt = async sel => (await page.locator(sel).first().textContent()) || '';
  const st = () => page.evaluate(() => window.__app.getState());
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  const md = s => { const [, m, d] = s.split('-'); return `${Number(m)}/${Number(d)}`; };
  const visible = async sel => (await page.locator(sel).count()) > 0 && await page.locator(sel).first().isVisible();
  const prog = async () => (await txt('.session-top .num')).replace(/\s/g, '');
  // 카드 탭은 마지막 상태(덱 상세/목록)를 유지하므로 전체 카드 목록까지 안전하게 이동
  const goAllCards = async () => { await page.click('#tab-cards'); await sleep(150); if (await visible('[data-action="back-decks"]')) { await page.click('[data-action="back-decks"]'); await sleep(150); } await page.click('[data-action="all-cards"]'); await sleep(150); };
  const INT = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 15 };
  let s = await st(); const today = s.today;
  log('today=' + today);

  /* ---- AC1 첫 화면 ---- */
  const home = await txt('#view-home');
  expect((await txt('#profile-chip')).includes('김하늘'), 'AC1 프로필 칩 김하늘');
  expect(/오늘 복습 11장/.test(home) && /밀림 3장/.test(home), 'AC1 오늘 복습 11장(밀림 3장) 표시: ' + (home.match(/오늘 복습 \d+장 \(밀림 \d+장\)/) || ['없음'])[0]);
  expect(s.streak === 6 && /6일/.test(home), 'AC1 스트릭 6 (실제 ' + s.streak + ')');
  expect(/D-12/.test(home) && home.includes('수학 5단원 단원평가'), 'AC1 D-12 수학 5단원 단원평가 배너');
  expect(s.data.cards.length === 72 && s.data.decks.length === 5, '샘플 카드 72장·덱 5개 (실제 ' + s.data.cards.length + '/' + s.data.decks.length + ')');
  expect(s.boxCounts.join(',') === '14,18,16,14,10', '상자 분포 14,18,16,14,10 (실제 ' + s.boxCounts.join(',') + ')');
  expect(s.data.cards.filter(c => c.mastered).length === 3, '숙달 3장');
  expect(/하루 목표/.test(home) && /0\/10장/.test(home), '하루 목표 진행 바 0/10장');
  // 큐 정렬: 스펙 = 밀린 카드(오늘-due 일수 내림차순) 먼저 → 낮은 상자 → 오래된 카드
  const qCards = s.queue.map(id => s.data.cards.find(c => c.id === id));
  const overdueFirst = qCards.slice(0, 3).every(c => c.due < today) && qCards.slice(3).every(c => c.due === today);
  expect(overdueFirst, '[스펙] 큐 정렬: 밀린 3장이 맨 앞 (실제 due 순서: ' + qCards.map(c => c.due === today ? '오늘' : c.due).join(',') + ')');
  const repeatCard = s.data.cards.find(c => c.front === '5/6 - 1/3 = ?');
  expect(repeatCard && repeatCard.failReasons.join() === 'calc,calc,calc' && s.queue.includes(repeatCard.id), '반복 오류 샘플 카드가 오늘 큐에 포함');
  await shot('s01-home');

  // 상자 그림 클릭 → 해당 상자 카드 목록
  await page.click('.boxes [data-box="3"]'); await sleep(200);
  expect(await visible('#view-cards') && (await page.locator('[data-filter="box"][data-val="3"][aria-pressed="true"]').count()) === 1, '상자 3 클릭 → 카드 탭 3상자 필터');
  const rows3 = await page.locator('#card-list .card-row').count();
  expect(rows3 === 16, '3상자 카드 목록 16장 (실제 ' + rows3 + ')');
  // 반복 오류 배지·필터
  await page.click('[data-filter="box"][data-val="all"]'); await page.click('[data-filter="type"][data-val="repeat"]'); await sleep(150);
  expect((await page.locator('#card-list .card-row').count()) === 1 && (await page.locator('#card-list .badge-repeat').count()) === 1, '반복 오류 필터 1장 + "같은 이유로 3번" 배지');
  await page.click('#tab-home'); await sleep(200);

  /* ---- AC2 세션 시작·확신도·뒤집기 ---- */
  await page.click('[data-action="start-today"]'); await sleep(300);
  expect(await visible('#session'), 'AC2 세션 화면 열림');
  expect(await prog() === '1/11', 'AC2 진행 1 / 11 (실제 ' + await prog() + ')');
  expect(await page.locator('#flip-btn').isDisabled(), 'AC2 확신도 전 뒤집기 disabled');
  await page.keyboard.press('Space'); await sleep(150);
  expect((await page.locator('#flip-card.flipped').count()) === 0, 'AC2 확신도 전 스페이스는 무시');
  await page.click('#conf-btns [data-c="3"]');
  expect(!(await page.locator('#flip-btn').isDisabled()), 'AC2 확실해요 후 뒤집기 활성');
  await page.keyboard.press('Space'); await sleep(250);
  expect((await page.locator('#flip-card.flipped').count()) === 1, 'AC2 스페이스로 뒤집힘');
  expect(await visible('#grade-btns'), 'AC2 틀렸어요/맞았어요 버튼 표시');
  s = await st(); const cur1 = s.data.cards.find(c => c.id === s.session.ids[0]);
  expect((await txt('.face-back .face-text')).trim() === cur1.back, 'AC2 뒷면 정답 표시 (' + cur1.back + ')');
  expect(await page.locator('#hint-line').isHidden(), '힌트는 기본 숨김');
  if (cur1.hint) { await page.click('[data-action="hint"]'); await sleep(100); expect(!(await page.locator('#hint-line').isHidden()), '힌트 보기 토글 동작'); }
  else expect(await page.locator('[data-action="hint"]').isDisabled(), '힌트 없는 카드는 힌트 버튼 비활성');
  await shot('s02-flipped');

  /* ---- 카드 처리 공통 루틴(현재 카드 유형에 따라 원인 패널 처리, 첫 오답 틀림 시 AC4 검증) ---- */
  let ac4done = false; const processed = [];
  async function doCard(conf, ok, viaKeys) {
    s = await st(); const c = s.data.cards.find(x => x.id === s.session.ids[s.session.idx]);
    if (c.id === repeatCard.id) expect((await page.locator('.face-front .badge-repeat').count()) === 1, '세션 앞면에 "같은 이유로 3번" 배지(반복 카드)');
    if (!(await page.locator('#flip-card.flipped').count())) {
      if (viaKeys) { await page.keyboard.press(String(conf)); await sleep(80); expect((await page.locator(`#conf-btns [data-c="${conf}"][aria-pressed="true"]`).count()) === 1, '키보드 ' + conf + ' → 확신도 선택'); await page.keyboard.press('Space'); }
      else { await page.click(`#conf-btns [data-c="${conf}"]`); await page.click('#flip-btn'); }
      await sleep(250);
    }
    const p0 = await prog();
    if (viaKeys) await page.keyboard.press(ok ? 'ArrowRight' : 'ArrowLeft'); else await page.click(`#grade-btns [data-ok="${ok ? 1 : 0}"]`);
    await sleep(200);
    let reason = null;
    if (!ok && c.type === 'wrong') {
      if (!ac4done) {
        expect(await visible('#reason-panel'), 'AC4 오답 카드 틀림 → 원인 태그 패널 표시');
        expect((await page.locator('#reason-panel .chip-btn').count()) === 5, 'AC4 원인 칩 5개');
        await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); await page.click('#grade-btns [data-ok="1"]', { force: true }).catch(() => {}); await sleep(400);
        expect(await prog() === p0 && await visible('#reason-panel'), 'AC4 태그 선택 전에는 다음 카드로 넘어가지 않음');
        ac4done = true;
      }
      reason = c.reason === 'misread' ? 'time' : 'misread';
      await page.click(`#reason-panel [data-reason="${reason}"]`);
    }
    await sleep(650);
    processed.push({ id: c.id, box: c.box, due: c.due, type: c.type, conf, ok, reason, front: c.front });
    return c;
  }

  /* ---- 카드 1~3: (확실,틀림) (애매,맞음)[키보드] (모름,맞음)[키보드] ---- */
  await doCard(3, false);
  s = await st(); const a1 = s.data.cards.find(c => c.id === processed[0].id);
  expect(a1.box === 1 && a1.due === addDays(today, 1), '틀림 → 1상자·내일 (' + a1.box + '/' + a1.due + ')');
  if (processed[0].type === 'wrong') expect(a1.reason === processed[0].reason && a1.failReasons.slice(-1)[0] === processed[0].reason, 'AC4 선택한 원인으로 reason·failReasons 갱신 (' + a1.reason + ')');
  else expect(a1.failReasons.slice(-1)[0] === 'unknown', '암기 카드 틀림 → failReasons unknown');
  expect(a1.history.slice(-1)[0].r === 'fail' && a1.history.slice(-1)[0].c === 3, 'history fail·c=3 기록');
  expect(await prog() === '2/11', '[스펙] 1장 처리 후 진행 표시 2 / 11 (실제 ' + await prog() + ')');
  expect(s.data.pendingSession && s.data.pendingSession.remainingCardIds.length === 10, 'pendingSession 남은 10장 즉시 저장');
  expect(s.data.dailyLog[today] && s.data.dailyLog[today].reviewed === 1 && s.data.dailyLog[today].correct === 0, 'dailyLog 오늘 reviewed 1 / correct 0');

  await doCard(2, true, true);
  s = await st(); const a2 = s.data.cards.find(c => c.id === processed[1].id);
  expect(a2.box === processed[1].box && a2.due === addDays(today, INT[processed[1].box]), '→ 맞음∧애매 → 상자 유지·간격 재설정 (' + processed[1].box + '상자, ' + a2.due + ')');
  await doCard(1, true, true);
  s = await st(); const a3 = s.data.cards.find(c => c.id === processed[2].id);
  expect(a3.box === processed[2].box && a3.due === addDays(today, 1), '맞음∧모르겠어요 → 상자 유지·내일 (' + a3.due + ')');
  expect(await prog() === '4/11', '[스펙] 3장 처리 후 진행 표시 4 / 11 (실제 ' + await prog() + ')');

  /* ---- AC6 Esc 종료 → 새로고침 → 이어서 하기 ---- */
  await page.keyboard.press('Escape'); await sleep(300);
  expect(await page.locator('#session').isHidden(), 'AC6 Esc로 세션 종료');
  expect((await txt('#view-home')).includes('이어서 하기') && (await txt('#view-home')).includes('남은 8장'), 'AC6 홈 이어서 하기(남은 8장) 표시');
  await reload();
  const homeR = await txt('#view-home');
  expect(homeR.includes('이어서 하기') && homeR.includes('남은 8장'), 'AC6 새로고침 후 이어서 하기(남은 8장) 유지');
  s = await st();
  expect(s.data.cards.find(c => c.id === processed[0].id).box === 1, 'AC6 처리한 카드 상자 변경 유지');
  expect(s.data.dailyLog[today].reviewed === 3, 'AC6 dailyLog 3장 유지');
  expect(/3\/10장/.test(homeR), '홈 진행 바 3/10장');
  await shot('s03-resume');

  /* ---- 이어서 하기 → 나머지 8장 → AC5 요약 ---- */
  await page.click('[data-action="resume"]'); await sleep(300);
  expect(await prog() === '4/11', '이어서 하기 진행 4 / 11 (실제 ' + await prog() + ')');
  const miniNums = await page.$$eval('#mini-boxes .mini-box b', els => els.map(e => Number(e.textContent)));
  expect(miniNums.join(',') === s.boxCounts.join(','), '미니 상자 5개 숫자 = 상자 분포 (' + miniNums.join(',') + ')');
  const plan = [[3, true], [3, true], [3, true], [3, true], [2, true], [3, false], [3, false], [1, false]];
  for (const [c, ok] of plan) await doCard(c, ok);
  await sleep(400);
  expect(ac4done, 'AC4 오답 카드 틀림 사례가 세션 중 발생함');
  expect(await visible('.modal'), 'AC5 요약 모달 표시');
  const mt = await txt('.modal');
  expect(mt.includes('오늘 11장 중 7장 기억'), 'AC5 결과 문장 "오늘 11장 중 7장 기억" (' + (mt.match(/오늘 \d+장 중 \d+장 기억/) || ['없음'])[0] + ')');
  const quad = await page.$$eval('.quad-cell > b', els => els.map(e => Number(e.textContent)));
  expect(quad.length === 4 && quad.reduce((a, b) => a + b, 0) === 11, 'AC5 4분면 합 11 (' + quad.join('+') + ')');
  expect(quad.join(',') === '4,3,3,1', '4분면 know4/lucky3/illusion3/aware1 (실제 ' + quad.join(',') + ')');
  const coach = (await txt('#coach-line')).trim();
  expect(coach.length > 0, 'AC5 코칭 문장 1개: ' + coach);
  expect(coach.includes('확실하다고 했는데 틀린 카드가 3장'), '코칭 규칙 R2(착각 3장) 선택 (lucky 3/11<0.3)');
  await page.click('.quad-cell.quad-know'); await sleep(100);
  expect(!(await page.locator('.quad-cell.quad-know .quad-list').isHidden()) && (await page.locator('.quad-cell.quad-know .quad-list li').count()) === 4, '4분면 칸 클릭 → 카드 4장 목록 펼침');
  const moveRow = (await txt('.modal .row.small.muted')).replace(/\s+/g, ' ').trim();
  log('상자 이동 요약 행: ' + moveRow);
  expect(/다음 상자로 \d+장/.test(moveRow) && /1상자로 \d+장/.test(moveRow) && moveRow.includes('내일 예정'), '상자 이동 요약(↑·↓·내일 예정) 표시 (' + moveRow + ')');
  await shot('s04-summary');
  await page.fill('#reflect-in', 'x'.repeat(100));
  expect((await page.inputValue('#reflect-in')).length === 80, '되새김 80자 제한');
  await page.fill('#reflect-in', '테스트');
  await page.click('.modal [data-value="true"]'); await sleep(300);
  s = await st();
  expect(s.data.pendingSession === null, '세션 완료 후 pendingSession 해제');
  expect(s.data.sessions[0].count === 11 && s.data.sessions[0].ok === 7 && s.data.sessions[0].reflectionId === s.data.reflections[0].id, '세션 기록 저장(11장·7 ok·되새김 연결)');
  expect(s.streak === 7, '완료 후 스트릭 7 (실제 ' + s.streak + ')');
  const homeD = await txt('#view-home');
  expect(homeD.includes('오늘은 다 했어요') && /내일 \d+장/.test(homeD), '큐 비면 완료 메시지 + 내일 N장');
  expect(/11\/10장/.test(homeD) && homeD.includes('목표 달성'), '진행 바 11/10장·목표 달성 라벨');
  await page.click('#tab-history'); await sleep(200);
  const firstRef = (await txt('#reflect-list .reflect-item q')).trim();
  expect(firstRef === '테스트', 'AC5 기록 탭 되새김 맨 위 = 테스트 (실제 ' + firstRef + ')');
  expect((await page.locator('#reflect-list .reflect-item').count()) === 6, '되새김 목록 6개(샘플 5 + 1)');
  await shot('s05-history-after');

  /* ---- AC4 후속: 카드 목록에서 원인 태그 변경 확인 ---- */
  const wrongDone = processed.find(p => p.type === 'wrong' && !p.ok);
  if (wrongDone) {
    await goAllCards();
    await page.fill('#card-q', wrongDone.front); await sleep(150);
    const short = { concept: '개념', misread: '읽기', calc: '계산', time: '시간', unknown: '몰랐음' }[wrongDone.reason];
    const rt = await txt('#card-list .card-row .meta');
    expect((await page.locator('#card-list .card-row').count()) >= 1 && rt.includes(short), 'AC4 카드 목록 원인 태그가 "' + short + '"로 바뀌어 보임 (' + rt.replace(/\s+/g, ' ').trim() + ')');
  }

  /* ---- 미리 복습 5장 + 스와이프 ---- */
  await page.click('#tab-home'); await sleep(200);
  s = await st();
  const pre = s.data.cards.filter(c => c.due === addDays(today, 1) || c.due === addDays(today, 2)).length;
  if (pre) {
    expect(await visible('[data-action="start-preview"]'), '미리 복습 버튼 표시(내일·모레 ' + pre + '장)');
    await page.click('[data-action="start-preview"]'); await sleep(300);
    const total = (await prog()).split('/')[1];
    expect(Number(total) === Math.min(5, pre), '미리 복습 카드 수 = min(5, ' + pre + ') (실제 ' + total + ')');
    const box = await page.locator('#flip-wrap').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy, { steps: 5 }); await page.mouse.up(); await sleep(300);
    expect((await prog()).startsWith('1/'), '뒤집기 전 스와이프 무시');
    await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(250);
    const preCardId = (await st()).session.ids[0];
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 70, cy + 150, { steps: 5 }); await page.mouse.up(); await sleep(300);
    expect((await prog()).startsWith('1/'), '세로 우세 스와이프 무시');
    const selLen = await page.evaluate(() => String(getSelection()).length);
    expect(selLen === 0, '[UX] 마우스 스와이프 시 카드 글자가 드래그 선택되지 않음 (선택된 글자 ' + selLen + '자)');
    // (1) 글자가 선택된 상태 그대로 오른쪽 스와이프 → 선택 글자 위 드래그는 브라우저 네이티브 드래그가 되어 pointerup이 오지 않을 수 있음
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy + 10, { steps: 5 }); await page.mouse.up(); await sleep(700);
    s = await st();
    const swipedOnSel = !!(s.session && s.session.idx === 1);
    log('선택 글자 위 스와이프 → 채점됨: ' + swipedOnSel);
    expect(swipedOnSel, '[UX] 글자가 선택된 상태에서도 오른쪽 스와이프가 동작함');
    if (!swipedOnSel) {
      // (2) 선택 해제 후 다시 스와이프(본 검증)
      await page.evaluate(() => getSelection().removeAllRanges()); await sleep(100);
      await page.mouse.move(cx, cy - 100); await page.mouse.down(); await page.mouse.move(cx + 120, cy - 90, { steps: 5 }); await page.mouse.up(); await sleep(700);
      s = await st();
    }
    const pc = s.data.cards.find(c => c.id === preCardId);
    log('swipe: prog=' + await prog() + ' idx=' + (s.session && s.session.idx) + ' results=' + (s.session && s.session.results.length) + ' hist=' + JSON.stringify(pc.history.slice(-1)[0]));
    expect(pc.history.slice(-1)[0].r === 'ok' && pc.history.slice(-1)[0].d === today && !!s.session && s.session.idx === 1, '오른쪽 스와이프 → 맞음 처리·다음 카드');
    if (s.session && s.session.idx !== 1) { if (await visible('#conf-btns')) { await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(250); } await page.click('#grade-btns [data-ok="1"]'); await sleep(700); }
    await page.click('[data-action="end-session"]'); await sleep(300);
    s = await st();
    expect(s.data.pendingSession && s.data.pendingSession.kind === 'preview', '미리 복습 중단 → pendingSession(preview) 저장');
    await page.click('[data-action="restart"]'); await sleep(300);
    expect((await page.locator('#toast-root .toast').last().textContent()).includes('복습할 카드가 없어요'), '새로 시작(큐 0) → 안내 토스트');
    s = await st();
    expect(s.data.pendingSession === null, '새로 시작 → pendingSession 해제');
  } else log('미리 복습 대상 없음(스킵)');

  /* ---- AC3 2상자 카드 확실→맞음 → 3상자·오늘+4, 다시 틀림 → 1상자·오늘+1 ---- */
  s = await st();
  const b2 = s.data.cards.find(c => c.box === 2 && c.type === 'memo');
  await page.evaluate(id => window.__app.actions.startSession('deck', [id]), b2.id); await sleep(300);
  const mini3Before = Number(await page.locator('#mini-boxes [data-box="3"] b').textContent());
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(250);
  await page.click('#grade-btns [data-ok="1"]'); await sleep(150);
  const mini3After = Number(await page.locator('#mini-boxes [data-box="3"] b').textContent());
  expect(mini3After === mini3Before + 1, 'AC3 미니 상자 3 숫자 +1 (' + mini3Before + '→' + mini3After + ')');
  expect((await page.locator('.fly').count()) >= 1, '상자로 날아가는 애니메이션 요소 생성');
  await sleep(900);
  if (await visible('.modal')) { await page.click('.modal [data-value="skip"]'); await sleep(300); }
  s = await st(); let c2 = s.data.cards.find(c => c.id === b2.id);
  expect(c2.box === 3 && c2.due === addDays(today, 4), 'AC3 상자 3·다음 복습일 오늘+4 (' + c2.box + ', ' + c2.due + ')');
  await goAllCards();
  await page.fill('#card-q', b2.front); await sleep(150);
  const rowTxt = await txt('#card-list .card-row');
  expect(rowTxt.includes('3상자') && rowTxt.includes(md(addDays(today, 4))), 'AC3 카드 목록에 3상자·' + md(addDays(today, 4)) + ' 표시');
  await page.evaluate(id => window.__app.actions.startSession('deck', [id]), b2.id); await sleep(300);
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(250);
  await page.click('#grade-btns [data-ok="0"]'); await sleep(900);
  if (await visible('.modal')) { await page.click('.modal [data-value="skip"]'); await sleep(300); }
  s = await st(); c2 = s.data.cards.find(c => c.id === b2.id);
  expect(c2.box === 1 && c2.due === addDays(today, 1), 'AC3 틀림 → 상자 1·오늘+1 (' + c2.box + ', ' + c2.due + ')');

  /* ---- AC15 5상자 카드 확실→맞음 → 숙달 ---- */
  const b5 = s.data.cards.find(c => c.box === 5 && !c.mastered);
  await page.evaluate(id => window.__app.actions.startSession('deck', [id]), b5.id); await sleep(300);
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(250);
  await page.click('#grade-btns [data-ok="1"]'); await sleep(900);
  if (await visible('.modal')) { await page.click('.modal [data-value="skip"]'); await sleep(300); }
  s = await st(); const c5 = s.data.cards.find(c => c.id === b5.id);
  expect(c5.box === 5 && c5.mastered === true && c5.due === addDays(today, 30), 'AC15 5상자 유지·숙달·오늘+30 (' + c5.box + '/' + c5.mastered + '/' + c5.due + ')');
  await goAllCards();
  await page.fill('#card-q', b5.front); await sleep(150);
  expect((await page.locator('#card-list .card-row .badge-star').count()) === 1, 'AC15 카드 목록에 ★ 숙달 배지');
  await page.fill('#card-q', ''); await page.click('[data-filter="box"][data-val="master"]'); await sleep(150);
  s = await st(); const masteredN = s.data.cards.filter(c => c.mastered).length;
  expect((await page.locator('#card-list .card-row').count()) === masteredN && masteredN >= 4, '숙달 필터 = 숙달 카드 수 ' + masteredN + '장(샘플 3 + 오늘 승급분)');
  await shot('s06-master');

  /* ---- 덱 세션 중 pendingSession 덮어쓰기 여부(기존 진행 보호) ---- */
  s = await st();
  const deckA = s.data.decks[0].id;
  await page.evaluate(id => window.__app.actions.startSession('deck', window.__app.getState().data.cards.filter(c => c.deckId === id).map(c => c.id)), deckA); await sleep(400);
  await page.keyboard.press('3'); await sleep(100); await page.keyboard.press('Space'); await sleep(300); await page.keyboard.press('ArrowRight'); await sleep(700);
  await page.keyboard.press('Escape'); await sleep(300);
  s = await st();
  expect(!!s.data.pendingSession && s.data.pendingSession.kind === 'deck' && s.data.pendingSession.results.length === 1, '덱 복습 중단 → pendingSession(deck, 1장 처리) 저장');
  await page.click('#tab-home'); await sleep(200);
  expect((await txt('#view-home')).includes('이어서 하기'), '덱 복습 중단 → 홈에 이어서 하기 표시');
  await page.click('[data-action="resume"]'); await sleep(300);
  expect((await prog()).startsWith('2/'), '덱 세션 이어서 하기 2/N부터');
  await page.keyboard.press('Escape'); await sleep(200);
};
