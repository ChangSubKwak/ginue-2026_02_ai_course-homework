// 연산수호대 수용 기준 테스트 모듈 (pw-run.js용)
'use strict';
const path = require('path');
const fs = require('fs');
module.exports = async ({ page, expect, shot, log, sleep, reload, ctx }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const txt = sel => page.locator(sel).first().innerText();
  const waitGame = (fn, ms) => page.waitForFunction(f => { const g = window.__app.getState().game; return g && (new Function('g', 'return (' + f + ')(g)'))(g); }, fn.toString(), { timeout: ms || 20000 }).then(() => st()).catch(() => st());
  // 몬스터 자동 격파 도우미: 조건 충족 또는 시간 초과까지
  const autoplay = async (until, maxMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const s = await st(); const g = s.game;
      if (!g || until(g, s)) return s;
      if (g.state === 'playing') {
        const live = g.monsters.filter(m => !m.locked && m.progress > 0).sort((a, b) => b.progress - a.progress);
        if (live.length) { const m = live[0]; if (m.choices) await act('choose', m.correctIndex); else await act('fire', m.answerText); }
      }
      await sleep(220);
    }
    return st();
  };

  // 1. 부팅·프로필
  let s = await st();
  expect(s.profiles.length === 24, '프로필 24명 시딩');
  expect(s.current === '김하늘' && s.profiles[0].number === 1, '활성 프로필 김하늘(1번)');
  const withRec = s.profiles.filter(p => p.records > 0).map(p => p.name);
  expect(withRec.length === 6 && ['김하늘', '이도윤', '박서아', '최민준', '정하윤', '한수아'].every(n => withRec.includes(n)), '기록 있는 프로필 6명: ' + withRec.join(','));
  await page.click('#profile-btn'); const items = await page.locator('#profile-menu li').allInnerTexts(); expect(items.length === 24 && items[0].includes('김하늘') && items[23].includes('노시은'), '드롭다운 24명 번호순');
  await page.keyboard.press('Escape'); await page.click('body', { position: { x: 5, y: 400 } });
  // 2. 홈 카드
  await page.click('[data-action="grade-tab"][data-grade="2"]');
  const c23 = page.locator('.stage-card[data-stage="s2-3"]');
  expect((await c23.innerText()).includes('19,800') && (await c23.locator('.stars').innerText()) === '★★☆', '2-3 카드 19,800 ★★');
  await page.click('[data-action="grade-tab"][data-grade="3"]');
  expect(await page.locator('.stage-card[data-stage="s3-3"].open').count() === 1 && await page.locator('.stage-card[data-stage="s3-4"].locked').count() === 1, '3-3 열림 / 3-4 잠금');
  await shot('home-grade3');
  // 2b. 명예의 전당(샘플 상태)
  await page.click('[data-view="hall"]'); await page.selectOption('#hall-stage', 's2-3'); await sleep(300);
  const rows0 = await page.locator('.rank-table tbody tr').allInnerTexts();
  expect(rows0[0].includes('최민준') && rows0[0].includes('28,400') && rows0[1].includes('정하윤') && rows0[1].includes('24,150') && rows0[2].includes('김하늘') && rows0[2].includes('19,800'), '2-3 랭킹 순서(샘플): ' + rows0.slice(0, 3).map(r => r.replace(/\s+/g, ' ')).join(' | '));
  await page.click('[data-action="hall-tab"][data-tab="stars"]'); const srows = await page.locator('.rank-table tbody tr').allInnerTexts();
  expect(srows[0].includes('정하윤') && srows[0].includes('23') && srows[1].includes('최민준') && srows[2].includes('김하늘'), '별 탭 순서: ' + srows.slice(0, 3).map(r => r.replace(/\s+/g, ' ')).join(' | '));
  await page.click('[data-action="hall-tab"][data-tab="growth"]'); const grows = await page.locator('.rank-table tbody tr').allInnerTexts();
  expect(grows[0].includes('박서아'), '성장 탭 1위 박서아: ' + grows[0].replace(/\s+/g, ' '));
  await page.click('[data-action="hall-tab"][data-tab="score"]'); await page.click('[data-view="home"]');

  // 3. 곱셈구구 시작 → 몬스터 등장 → 12초 후 성 도달
  await act('setSetting', 'timeLimitMin', 0);
  await page.click('[data-action="grade-tab"][data-grade="2"]'); await page.click('[data-action="start-stage"][data-stage="s2-3"]');
  await sleep(300); s = await st(); expect(s.view === 'game' && s.game && s.game.wave === 1, 'WAVE 1 시작');
  s = await waitGame(g => g.monsters.length >= 1 && g.monsters[0].progress > 0, 5000);
  const m0 = s.game.monsters[0]; expect(/^\d×\d$/.test(m0.key), '몬스터 라벨 a×b: ' + m0.text);
  await shot('game-wave1');
  s = await waitGame(g => g.hp === 2, 16000);
  const reachMs = s.game.elapsedMs - m0.spawnedAt;
  expect(s.game.hp === 2 && Math.abs(reachMs - 12000) <= 1000, `보통 속도 성 도달 ${Math.round(reachMs)}ms (12s±1s), HP 3→2`);
  // 4. 키패드로 정답 발사
  s = await waitGame(g => g.monsters.some(m => m.progress > 0.05), 8000);
  let m = s.game.monsters.find(x => x.progress > 0.05); const before = s.game.score;
  for (const ch of m.answerText) await page.click(`.key[data-k="${ch}"]`);
  expect((await txt('#input-panel .input-display')) === m.answerText, '입력 표시창 ' + m.answerText);
  await page.keyboard.press('Enter'); await sleep(400);
  s = await st(); const gained = s.game.score - before;
  expect((gained === 150 || gained === 100) && !s.game.monsters.some(x => x.id === m.id), `정답 격파 +${gained}, 몬스터 소멸, 플로팅 ${JSON.stringify(s.game.floats)}`);
  // 5. 오답 → 교정 카드 → 복수 몬스터
  s = await waitGame(g => g.monsters.some(x => x.progress > 0.05 && !x.locked), 8000);
  m = s.game.monsters.find(x => x.progress > 0.05); const wrongVal = String(m.answer + 1 === 100 ? 98 : m.answer + 1);
  await act('fire', wrongVal); await sleep(300);
  s = await st(); expect(s.game.state === 'card' && s.game.combo === 0, '오답 → 콤보 0, 교정 카드 상태');
  const cardQ = await txt('.card-modal .card-q'); expect(cardQ.startsWith(m.text), '교정 카드 문제 ' + cardQ);
  expect(await page.locator('.card-modal .arr-row').count() === m.key.split('×')[0] * 1, '점 배열 행 수 = ' + m.key.split('×')[0]);
  await shot('card-array');
  await sleep(1200);
  for (const ch of m.answerText) await page.keyboard.press(ch);
  await page.keyboard.press('Enter'); await sleep(200);
  s = await st(); expect(await page.locator('.card-modal').count() === 0 && (s.game.state === 'resume' || s.game.state === 'playing'), '카드 닫힘 후 재개 상태: ' + s.game.state);
  expect(s.game.revengeQueue.includes(m.key), '복수 큐 등록 ' + m.key);
  await sleep(600); s = await st(); expect(s.game.state === 'playing', '0.5초 뒤 playing');
  const revKey = m.key;
  s = await autoplay(g => g.monsters.some(x => x.isRevenge && x.key === revKey), 40000);
  const rev = s.game.monsters.find(x => x.isRevenge); expect(!!rev && rev.key === revKey, '복수 몬스터 등장 ' + revKey);
  await shot('revenge');
  // 복수 몬스터 격파 점수 2배
  s = await waitGame(g => g.monsters.some(x => x.isRevenge && x.progress > 0) && !g.monsters.some(x => x.locked), 8000);
  const sc0 = s.game.score, cmb = s.game.combo; await act('fire', rev.answerText); await sleep(450); s = await st();
  const d = s.game.score - sc0, mu = cmb < 5 ? 1 : cmb < 10 ? 2 : cmb < 20 ? 3 : 4;
  expect(d === 200 * mu || d === 200 * mu + 100, `복수 격파 점수 2배: +${d} (콤보 ${cmb}, 배율 ${mu})`);
  // 6. 콤보·필살기
  s = await autoplay(g => g.combo >= 5, 60000);
  expect(s.game.combo >= 5 && (await txt('#hud-combo')).includes('×2 COMBO!'), 'HUD ×2 COMBO!');
  s = await autoplay(g => g.combo >= 10, 60000);
  expect(s.game.combo >= 10 && (await txt('#hud-combo')).includes('×3') && s.game.superGauge >= 1, '콤보 10 → ×3, 필살기 게이지 1');
  s = await waitGame(g => g.monsters.filter(x => x.progress > 0).length >= 1 && g.state === 'playing', 8000);
  await page.keyboard.press('Space'); await sleep(300); s = await st();
  expect(s.game.monsters.filter(x => x.progress > 0 && !x.isBoss).length === 0 && s.game.superGauge === 0, '필살기: 몬스터 전멸, 게이지 소모');
  // 7. 보스까지 자동 플레이 → 클리어
  s = await autoplay(g => g.wave === 10 && g.monsters.some(x => x.isBoss && x.progress > 0), 240000);
  expect(s.game && s.game.wave === 10 && s.game.monsters.some(x => x.isBoss && x.shields === 3), '10웨이브 보스 방패 3개 등장');
  await shot('boss');
  s = await autoplay(g => g.state === 'ended', 60000);
  await page.waitForSelector('#result-view:not([hidden]) .result-head', { timeout: 5000 }).catch(() => {});
  const head = await txt('.result-head h2');
  expect(head.includes('클리어'), '결과 화면: ' + head);
  await sleep(2200);
  const starsGot = await page.locator('.result-stars .got.pop').count(); const accTxt = await page.locator('.stat b').first().innerText();
  expect(starsGot >= 1 && starsGot <= 3, `별 ${starsGot}개 팝인 (정답률 ${accTxt})`);
  await shot('result');
  expect((await page.locator('.wrong-card').count()) >= 1, '틀린 문제 카드 표시');
  // 8. 다음 스테이지 해금 + 새로고침 유지
  const nextBtn = page.locator('[data-action="start-stage"][data-stage="s3-1"]');
  s = await st(); const rec23 = s.profiles[0];
  await act('flushSave');
  await reload();
  await page.click('[data-action="grade-tab"][data-grade="2"]');
  s = await st(); expect(s.profiles[0].stars >= rec23.stars && (await page.locator('.stage-card[data-stage="s2-3"]').innerText()).includes('최고'), '새로고침 후 기록 유지');
  // 9. 게임 오버 (빠르게: 속도 fast)
  await act('setSetting', 'speedPreset', 'fast'); await act('setSetting', 'timeLimitMin', 0);
  const plays0 = await page.evaluate(() => window.__app.MG.current().stageRecords['s1-1'].plays);
  await act('startStage', 's1-1');
  s = await waitGame(g => g.hp === 0 || g.state === 'ended', 60000);
  await page.waitForSelector('#result-view:not([hidden]) .result-head', { timeout: 5000 }).catch(() => {});
  const h2 = await txt('.result-head h2'); const plays1 = await page.evaluate(() => window.__app.MG.current().stageRecords['s1-1'].plays);
  expect(h2.includes('게임 오버') && (await page.locator('.result-stars .got').count()) === 0 && plays1 === plays0 + 1, `게임 오버 결과, 별 0, 플레이 수 ${plays0}→${plays1}`);
  // 10. 느리게 + 시간 제한
  await act('setSetting', 'speedPreset', 'slow'); await act('setSetting', 'timeLimitMin', 3);
  await act('startStage', 's1-1'); await sleep(400);
  const t0 = await txt('#hud-time'); expect(/0[23]:[0-5]\d/.test(t0), 'HUD 카운트다운 ' + t0);
  s = await waitGame(g => g.monsters.length >= 1 && g.monsters[0].progress > 0, 5000); const sm = s.game.monsters[0];
  s = await waitGame(g => g.hp === 2, 20000); const slowMs = s.game.elapsedMs - sm.spawnedAt;
  expect(Math.abs(slowMs - 16000) <= 1000, `느리게 성 도달 ${Math.round(slowMs)}ms (16s±1s)`);
  await act('quit'); await sleep(800);
  await act('setSetting', 'timeLimitMin', 0.03); await act('startStage', 's1-1');
  s = await waitGame(g => g.state === 'ended', 8000); await page.waitForSelector('#result-view:not([hidden]) .result-head', { timeout: 5000 }).catch(() => {});
  expect((await txt('.result-head h2')).includes('시간 종료'), '시간 종료 결과');
  await act('setSetting', 'speedPreset', 'normal'); await act('setSetting', 'timeLimitMin', 0); await act('setSetting', 'unlockAll', true);
  // 11. 4-2 3지선다 / 4-3 소수
  await act('startStage', 's4-2'); s = await waitGame(g => g.monsters.length >= 1 && g.monsters[0].progress > 0, 5000); await sleep(300);
  expect(await page.locator('#input-panel .choice-btn').count() === 3 && await page.locator('#input-panel .key').count() === 0, '4-2 선택지 3개, 키패드 없음');
  await shot('choice3');
  m = s.game.monsters[0]; const sc1 = s.game.score; await page.keyboard.press(String(m.correctIndex + 1)); await sleep(400); s = await st();
  expect(s.game.score > sc1, '키보드 1/2/3 선택 격파');
  await act('quit'); await sleep(700);
  await act('startStage', 's4-3'); s = await waitGame(g => g.monsters.length >= 1 && g.monsters[0].progress > 0, 5000); await sleep(200);
  expect(await page.locator('#input-panel .key[data-k="."]').count() === 1, '4-3 소수점 키');
  m = s.game.monsters[0]; const sc2 = s.game.score, dec = m.answerText.includes('.') ? m.answerText + '0' : m.answerText + '.0'; await act('fire', dec); await sleep(400); s = await st();
  expect(s.game.score > sc2, `'${dec}' 입력도 ${m.answerText}로 정답 처리`);
  // 12. 음소거 + 새로고침 유지
  await page.click('.hud [data-action="toggle-mute"]'); s = await st(); expect(s.muted === true && s.settings.muted === true, 'HUD 음소거');
  await act('flushSave'); await reload(); s = await st(); expect(s.muted === true, '새로고침 후 음소거 유지');
  await page.click('[data-action="toggle-mute"]'); await act('flushSave');
  // 13. 명예의 전당
  await page.click('[data-view="hall"]'); await page.selectOption('#hall-stage', 's2-3'); await sleep(300);
  const rows = await page.locator('.rank-table tbody tr').allInnerTexts();
  expect(rows[0].includes('최민준') && rows.some(r => r.includes('김하늘')) && page.locator('.rank-table tr.me').count, '플레이 후 랭킹 표시(내 행 강조): ' + rows.slice(0, 3).map(r => r.replace(/\s+/g, ' ')).join(' | '));
  await shot('hall');
  await act('setSetting', 'rankingPublic', false); await page.click('[data-action="hall-tab"][data-tab="score"]'); await sleep(200);
  expect(await page.locator('.rank-table tbody tr').count() === 1 && (await txt('#hall-view .note')).includes('내 순위'), '랭킹 비공개: 내 행 + 내 순위');
  await act('setSetting', 'rankingPublic', true);
  // 14. 도감(이도윤) + 다시 풀기
  const doyun = s.profiles.find(p => p.name === '이도윤').id; await act('setActive', doyun);
  await page.click('[data-view="codex"]'); await sleep(200);
  const cell = page.locator('.hm-cell[data-key="8×7"]'); expect((await cell.getAttribute('class')).includes('box-0'), '8×7 칸 빨강(box-0)');
  await cell.click(); expect((await txt('#fact-tip')).includes('오답 3회'), '툴팁 오답 3회');
  await shot('codex');
  // 결과 화면 다시 풀기: 1-1에서 일부러 틀리고 중단
  await act('startStage', 's1-1'); s = await waitGame(g => g.monsters.length >= 1 && g.monsters[0].progress > 0, 5000);
  m = s.game.monsters[0]; await act('fire', String(m.answer + 1)); await sleep(300); await sleep(900);
  for (const ch of m.answerText) await page.keyboard.press(ch); await page.keyboard.press('Enter'); await sleep(700);
  await act('quit'); await page.waitForSelector('#result-view:not([hidden]) [data-action="review"]', { timeout: 5000 });
  const boxBefore = await txt('.wrong-card .box-state');
  await page.click('[data-action="review"]'); await page.waitForSelector('.card-modal'); await sleep(900);
  for (const ch of m.answerText) await page.keyboard.press(ch); await page.keyboard.press('Enter'); await sleep(400);
  const boxAfter = await txt('.wrong-card .box-state');
  expect(boxBefore.includes('0/3') && boxAfter.includes('1/3'), `다시 풀기 후 상자 ${boxBefore} → ${boxAfter}`);
  expect((await page.locator('.toast').allInnerTexts()).some(t => t.includes('복습 완료 1/1')), '복습 완료 토스트');
  // 15. JSON 백업 → 초기화 → 가져오기 / 잘못된 파일
  await page.click('[data-view="settings"]'); await sleep(200);
  const outdir = path.join(__dirname, 'out'); fs.mkdirSync(outdir, { recursive: true });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-json"]')]);
  const bak = path.join(outdir, dl.suggestedFilename()); await dl.saveAs(bak);
  expect(/math-guardians-backup-\d{8}\.json/.test(dl.suggestedFilename()), '백업 파일명 ' + dl.suggestedFilename());
  await page.click('[data-action="reset-sample"]'); await page.click('.modal [data-m="true"]'); await sleep(400);
  s = await st(); expect(s.current === '김하늘' && s.profiles.length === 24, '샘플 초기화');
  await page.click('[data-view="settings"]'); await sleep(200);
  await page.setInputFiles('#json-file', bak); await page.waitForSelector('.modal'); expect((await txt('.modal-body')).includes('덮어씁니다'), '가져오기 확인 모달');
  await page.click('.modal [data-m="true"]'); await sleep(500); s = await st();
  expect(s.current === '이도윤' && s.profiles.length === 24, '백업 복원(활성 프로필 이도윤 유지)');
  const bad = path.join(outdir, 'bad.json'); fs.writeFileSync(bad, 'hello world');
  await page.setInputFiles('#json-file', bad); await page.waitForSelector('.modal'); expect((await txt('.modal-body')).includes('형식이 맞지 않는 파일입니다'), '잘못된 파일 모달');
  await page.click('.modal [data-m="true"]');
  // 명단 CSV 가져오기
  const csv = path.join(outdir, 'roster.csv'); fs.writeFileSync(csv, '﻿번호,이름\r\n25,백건우\r\n26,구하린\r\n,x\r\n');
  await page.setInputFiles('#roster-file', csv); await sleep(400); s = await st();
  expect(s.profiles.length === 26 && (await page.locator('.toast').allInnerTexts()).some(t => t.includes('2명 추가, 1행 건너뜀')), '명단 CSV 2명 추가 1행 건너뜀');
  await shot('settings');
  // 16. 400px 폭 게임 화면
  await page.setViewportSize({ width: 400, height: 800 }); await act('setActive', s.profiles[0].id); await act('startStage', 's2-3'); await sleep(500);
  const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, kh: Math.min(...[...document.querySelectorAll('#input-panel .key')].map(k => k.getBoundingClientRect().height)) }));
  expect(ov.sw <= ov.cw + 1 && ov.kh >= 56, `400px: 가로 스크롤 없음(${ov.sw}/${ov.cw}), 키 높이 ${ov.kh}`);
  await shot('mobile-game');
  await act('quit'); await page.setViewportSize({ width: 1280, height: 800 });
  // 17. localStorage 차단 환경
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await p2.goto(page.url(), { waitUntil: 'load' }); await p2.waitForTimeout(700);
  const warn = await p2.evaluate(() => ({ warn: !document.getElementById('storage-warn').hidden, home: !document.querySelector('[data-view="home"]').hidden, ok: window.__app.getState().storageOk }));
  expect(warn.warn && warn.home && !warn.ok, 'localStorage 차단: 홈 표시 + 경고 배지');
  await p2.close();
  await page.waitForTimeout(300);
  // 18. 다크 테마 토글 저장
  await page.click('#theme-btn'); expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', '테마 토글 dark');
  await page.click('[data-view="home"]'); await shot('home-dark');
  await page.click('#theme-btn');
};
