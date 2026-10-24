// func-home-data.js — 홈·샘플 데이터·프로필·명예의 전당·도감·설정·JSON/CSV·저장/복원 검증 (pw-run.js 모듈)
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const txt = sel => page.locator(sel).first().innerText().catch(() => '');
  const toastTexts = () => page.locator('#toast-root .toast').allInnerTexts();
  const modalOpen = () => page.locator('.modal-backdrop').count();
  const outDir = path.join(__dirname, 'func-out');
  fs.mkdirSync(outDir, { recursive: true });

  // ---------- AC1: 첫 화면·샘플 데이터 ----------
  let s = await st();
  expect(s.view === 'home', 'AC1 첫 화면이 홈');
  expect(s.profiles.length === 24, `AC1 프로필 24명 (실제 ${s.profiles.length})`);
  expect(s.current === '김하늘' && s.profiles[0].number === 1, 'AC1 활성 프로필 김하늘(1번)');
  const withRec = s.profiles.filter(p => p.records > 0).map(p => p.name);
  expect(withRec.length === 6 && ['김하늘', '이도윤', '박서아', '최민준', '정하윤', '한수아'].every(n => withRec.includes(n)), `AC1 기록 보유 6명: ${withRec.join(',')}`);
  const numbersSorted = s.profiles.every((p, i) => p.number === i + 1);
  expect(numbersSorted, 'AC1 번호순 1~24');
  await page.click('#profile-btn');
  const menuItems = await page.locator('#profile-menu li[data-pid]').allInnerTexts();
  expect(menuItems.length === 24 && menuItems[0].includes('김하늘') && menuItems[23].includes('노시은'), `AC1 드롭다운 24명 번호순 (첫:${menuItems[0].replace(/\s+/g, ' ')}, 끝:${menuItems[23].replace(/\s+/g, ' ')})`);
  expect(!(await page.locator('#profile-menu').isHidden()), '프로필 메뉴 열림');
  // 키보드 접근성: 옵션이 포커스 가능한가
  const focusable = await page.evaluate(() => [...document.querySelectorAll('#profile-menu li')].some(li => li.tabIndex >= 0));
  expect(focusable, 'a11y 프로필 드롭다운 옵션이 키보드 포커스 가능(tabindex)');
  await page.keyboard.press('Escape');
  await page.click('body', { position: { x: 5, y: 400 } });
  expect(await page.locator('#profile-menu').isHidden(), '바깥 클릭으로 프로필 메뉴 닫힘');
  await shot('home-first');
  const firstToast = await toastTexts();
  log('첫 토스트: ' + JSON.stringify(firstToast));
  expect(firstToast.some(t => t.includes('프로필을 고르고')), '첫 방문 안내 토스트');

  // 요약 카드
  const summary = await txt('#summary-card');
  expect(/총 별\s*16/.test(summary) && /배지\s*3/.test(summary), `요약 카드 총 별 16·배지 3 (${summary.replace(/\s+/g, ' ').slice(0, 80)})`);
  expect(summary.includes('황금 포탑'), '요약 카드에 선택 스킨(황금 포탑) 표시');

  // ---------- AC2: 2학년 곱셈구구 카드 / 3학년 잠금 ----------
  await page.click('[data-action="grade-tab"][data-grade="2"]');
  const card23 = page.locator('.stage-card[data-stage="s2-3"]');
  const c23 = await card23.innerText();
  expect(c23.includes('19,800') && c23.includes('★★☆'), `AC2 2-3 카드 최고 19,800·별 2 (${c23.replace(/\s+/g, ' ')})`);
  expect(await card23.locator('.stage-input').innerText() === '⌨ 키패드', '2-3 카드 입력 방식 아이콘(키패드)');
  await page.click('[data-action="grade-tab"][data-grade="3"]');
  const c33 = page.locator('.stage-card[data-stage="s3-3"]'), c34 = page.locator('.stage-card[data-stage="s3-4"]');
  expect((await c33.getAttribute('class')).includes('open') && !(await c33.locator('.start-btn').isDisabled()), 'AC2 3-3 카드 열림');
  expect((await c34.getAttribute('class')).includes('locked') && (await c34.locator('.lock').count()) === 1 && (await c34.locator('.lock').innerText()).includes('🔒'), 'AC2 3-4 카드 잠금 아이콘');
  expect(await c34.locator('.start-btn').isDisabled(), '3-4 시작 버튼 비활성');
  expect((await c34.locator('.lock').getAttribute('title') || '').includes('클리어'), '잠금 해금 조건 툴팁');
  await shot('home-grade3');
  // 학년 탭 기억
  await reload();
  expect(await page.locator('[data-action="grade-tab"][data-grade="3"]').getAttribute('aria-selected') === 'true', '새로고침 후 마지막 학년 탭(3학년) 기억');
  // 4학년 탭: 입력 방식 아이콘 3종
  await page.click('[data-action="grade-tab"][data-grade="4"]');
  const icons = await page.locator('.stage-card .stage-input').evaluateAll(els => els.map(e => ({ t: e.textContent, vis: getComputedStyle(e).visibility })));
  expect(icons.some(i => i.t === '🔘 3지선다') && icons.some(i => i.t === '🔢 소수점'), `4학년 카드 입력 방식 아이콘(3지선다·소수점) ${JSON.stringify(icons)}`);
  expect(icons.every(i => i.vis === 'visible'), `잠긴 카드에서도 입력 방식 아이콘이 보임 (${icons.filter(i => i.vis !== 'visible').length}개 숨김)`);
  // 각 학년 탭이 모두 열리는가
  for (const g of [1, 2, 3, 4, 5, 6]) { await page.click(`[data-action="grade-tab"][data-grade="${g}"]`); const n = await page.locator('.stage-card').count(); expect(n === (g === 3 ? 4 : 3), `${g}학년 탭 카드 ${n}개`); }
  await page.click('[data-action="grade-tab"][data-grade="1"]');

  // ---------- 탭·화면 전환 ----------
  for (const v of ['codex', 'hall', 'settings', 'home']) {
    await page.click(`${v === 'settings' ? '.toolbar' : '#main-tabs'} [data-action="nav"][data-view="${v}"]`);
    expect((await st()).view === v && await page.locator(`section[data-view="${v}"]`).isVisible(), `화면 전환 ${v}`);
  }
  // 도움말 모달 + Esc + 포커스 복귀
  await page.click('[data-action="help"]');
  expect(await modalOpen() === 1 && (await txt('.modal')).includes('사용법'), '도움말 모달 열림');
  await page.keyboard.press('Escape'); await sleep(100);
  expect(await modalOpen() === 0, 'Esc로 도움말 모달 닫힘');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.dataset.action === 'help'), '모달 닫힌 뒤 포커스 복귀');
  // Tab 포커스 트랩
  await page.click('[data-action="reset-sample"]', { force: true }).catch(() => {});
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  await page.click('[data-action="reset-sample"]');
  expect(await modalOpen() === 1, '초기화 확인 모달 열림');
  const focusedFirst = await page.evaluate(() => document.activeElement.textContent);
  expect(focusedFirst === '취소', `모달 열릴 때 첫 버튼(취소)에 포커스 (실제 '${focusedFirst}')`);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const trapped = await page.evaluate(() => !!document.activeElement.closest('.modal'));
  expect(trapped, 'Tab 포커스가 모달 안에 머무름(포커스 트랩)');
  await page.keyboard.press('Escape'); await sleep(100);
  expect(await modalOpen() === 0 && (await st()).profiles.length === 24, 'Esc로 초기화 모달 취소, 데이터 유지');
  // 배경 클릭으로 닫힘
  await page.click('[data-action="reset-sample"]');
  await page.mouse.click(5, 5); await sleep(100);
  expect(await modalOpen() === 0, '배경 클릭으로 모달 닫힘');

  // ---------- AC13: 명예의 전당 ----------
  await page.click('#main-tabs [data-action="nav"][data-view="hall"]');
  await page.selectOption('#hall-stage', 's2-3');
  let rows = await page.locator('.rank-table tbody tr').allInnerTexts();
  log('hall s2-3: ' + JSON.stringify(rows.map(r => r.replace(/\s+/g, ' '))));
  const top3 = rows.slice(0, 3).map(r => r.replace(/\s+/g, ' '));
  expect(top3[0].includes('최민준') && top3[0].includes('28,400') && top3[1].includes('정하윤') && top3[1].includes('24,150') && top3[2].includes('김하늘') && top3[2].includes('19,800'), `AC13 2-3 점수 순위 최민준/정하윤/김하늘 (${top3.join(' | ')})`);
  expect(rows.length === 5, `2-3 점수 탭 5명 표시 (실제 ${rows.length})`);
  expect((await page.locator('.rank-table tr.rank-1').count()) === 1 && (await page.locator('.rank-table tr.me').innerText()).includes('김하늘'), '1위 금색 행·내 행 강조');
  await shot('hall-score');
  await page.click('[data-action="hall-tab"][data-tab="stars"]');
  rows = (await page.locator('.rank-table tbody tr').allInnerTexts()).map(r => r.replace(/\s+/g, ' '));
  expect(rows.length === 24 && rows[0].includes('정하윤') && rows[0].includes('23') && rows[1].includes('최민준') && rows[1].includes('19') && rows[2].includes('김하늘') && rows[2].includes('16') && rows[3].includes('박서아') && rows[3].includes('11'), `별 탭 순위 정하윤23/최민준19/김하늘16/박서아11 (${rows.slice(0, 4).join(' | ')})`);
  await page.click('[data-action="hall-tab"][data-tab="growth"]');
  rows = (await page.locator('.rank-table tbody tr').allInnerTexts()).map(r => r.replace(/\s+/g, ' '));
  expect(rows[0].includes('박서아') && rows[0].includes('18'), `성장 탭 1위 박서아 18개 (${rows[0]})`);
  await reload();
  await page.click('#main-tabs [data-action="nav"][data-view="hall"]');
  expect(await page.locator('[data-action="hall-tab"][data-tab="growth"]').getAttribute('aria-selected') === 'true', '새로고침 후 마지막 전당 탭 기억');
  // 랭킹 비공개
  await page.evaluate(() => window.__app.actions.setSetting('rankingPublic', false));
  await page.click('[data-action="hall-tab"][data-tab="score"]');
  await page.selectOption('#hall-stage', 's2-3');
  rows = (await page.locator('.rank-table tbody tr').allInnerTexts()).map(r => r.replace(/\s+/g, ' '));
  const note = await txt('#hall-view .note');
  expect(rows.length === 1 && rows[0].includes('김하늘') && /내 순위\s*3\/5/.test(note), `AC13 랭킹 비공개: 내 행만 + 내 순위 3/5 (${note.replace(/\s+/g, ' ')})`);
  await shot('hall-private');
  // 랭킹 비공개 + 같은 스테이지 기록자 10명 초과 → 상위 10 밖 학생의 내 순위
  await page.evaluate(() => { const MG = window.__app.MG; MG.root.profiles.slice(6, 18).forEach((p, i) => { p.stageRecords['s2-3'] = { stageId: 's2-3', bestScore: 30000 + i * 100, bestStars: 1, bestCombo: 5, plays: 1, clears: 1, correct: 30, wrong: 2, reached: 0, avgMs: 3000, lastPlayedAt: new Date().toISOString() }; }); MG.UI.showView('hall'); });
  await page.click('[data-action="hall-tab"][data-tab="score"]'); await page.selectOption('#hall-stage', 's2-3');
  const noteLow = await txt('#hall-view .note'), lowRows = await page.locator('.rank-table tbody tr').count(), lowText = await txt('#hall-view');
  log(`비공개·17명 기록: note='${noteLow.replace(/\s+/g, ' ')}', rows=${lowRows}`);
  expect(/내 순위\s*15\/17/.test(noteLow) && lowRows === 1, `랭킹 비공개에서 상위 10 밖 학생(김하늘 15/17)도 내 순위·내 행 표시 (${noteLow.replace(/\s+/g, ' ')}, 행 ${lowRows})`);
  expect(!lowText.includes('아직 기록이 없어요'), "기록이 있는 학생에게 '아직 기록이 없어요' 문구가 나오지 않음");
  await page.evaluate(() => { const MG = window.__app.MG; MG.root.profiles.slice(6, 18).forEach(p => { delete p.stageRecords['s2-3']; }); });
  await page.evaluate(() => window.__app.actions.setSetting('rankingPublic', true));
  // 인쇄: window.print 스텁 후 기록표 내용 확인
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click('[data-action="print-today"]');
  const printed = await page.evaluate(() => window.__printed);
  const printHtml = await page.locator('#print-root').innerHTML();
  expect(printed === 1 && printHtml.includes('오늘의 기록표') && printHtml.includes('오늘 기록이 없습니다'), '오늘의 기록표 인쇄 호출 + 빈 기록 문구');
  await page.emulateMedia({ media: 'print' });
  const printVis = await page.evaluate(() => ({ main: getComputedStyle(document.querySelector('main')).display, pr: getComputedStyle(document.getElementById('print-root')).display, hdr: getComputedStyle(document.querySelector('.app-header')).display }));
  expect(printVis.main === 'none' && printVis.pr === 'block' && printVis.hdr === 'none', `@media print: 게임 UI 숨김·기록표 표시 ${JSON.stringify(printVis)}`);
  await page.emulateMedia({ media: 'screen' });

  // ---------- AC14 (1): 이도윤 도감 8×7 ----------
  const doyunId = (await st()).profiles.find(p => p.name === '이도윤').id;
  await page.click('#profile-btn');
  await page.click(`#profile-menu li[data-pid="${doyunId}"]`);
  expect((await st()).current === '이도윤' && (await txt('#profile-name')) === '이도윤', '드롭다운으로 이도윤 선택');
  await page.click('#main-tabs [data-action="nav"][data-view="codex"]');
  expect(await page.locator('#codex-stage').inputValue() === 's2-3', '도감 기본 스테이지 2-3');
  expect(await page.locator('.hm-cell').count() === 72, '히트맵 72칸');
  const cell87 = page.locator('.hm-cell[data-key="8×7"]');
  const cls87 = await cell87.getAttribute('class');
  const bg87 = await cell87.evaluate(e => getComputedStyle(e).backgroundColor);
  expect(cls87.includes('box-0') && bg87 === 'rgb(230, 57, 70)', `AC14 8×7 칸 빨강 (${cls87}, ${bg87})`);
  await cell87.click();
  const tip = await txt('#fact-tip');
  expect(tip.includes('오답 3회') && tip.includes('8×7'), `AC14 8×7 툴팁 오답 3회 (${tip})`);
  // 색 범례 검증
  const colors = await page.evaluate(() => ['box-0', 'box-1', 'box-2', 'box-3', 'box-none'].map(c => { const e = document.querySelector('.legend .' + c); return e ? getComputedStyle(e).backgroundColor : null; }));
  log('legend colors: ' + JSON.stringify(colors));
  expect(new Set(colors).size === 5, '상자 0~3·미출제 5색 구분');
  const greens = await page.locator('.hm-cell.box-2, .hm-cell.box-3').count();
  expect(greens >= 5, `이도윤 숙달 칸(box≥2) ${greens}개 표시`);
  await shot('codex-doyun');
  // 다른 스테이지: 약점 목록
  await page.selectOption('#codex-stage', 's2-2');
  const weakRows = await page.locator('#codex-view table tbody tr').allInnerTexts();
  expect(weakRows.length === 3 && weakRows[0].includes('62') && weakRows.some(r => r.includes('81 − 36')), `2-2 약점 목록 3개 오답순 (${weakRows.map(r => r.replace(/\s+/g, ' ')).join(' | ')})`);
  expect((await txt('.progress-row')).includes('숙달 0 / 출제 3'), '진행 막대 숙달/출제 수');
  // 배지·스킨
  expect(await page.locator('.badge').count() === 10 && await page.locator('.badge.got').count() === 1, '배지 10개 중 1개 획득(이도윤)');
  const lockedSkins = await page.locator('.skin:disabled').count();
  expect(lockedSkins === 5, `이도윤(별 5) 잠긴 스킨/테마 5개 (실제 ${lockedSkins})`);
  expect((await page.locator('.skin.theme-desert small').innerText()).includes('별 6개 필요'), '잠긴 테마에 필요 별 수 표시');
  // 최민준(별 19): 황금 포탑·설원 선택 가능
  const minId = (await st()).profiles.find(p => p.name === '최민준').id;
  await page.evaluate(id => window.__app.actions.setActive(id), minId);
  await page.click('#main-tabs [data-action="nav"][data-view="codex"]');
  expect((await page.locator('.skin.turret-gold').getAttribute('class')).includes('selected') && (await page.locator('.skin.theme-desert').getAttribute('class')).includes('selected'), '최민준 황금 포탑·사막 테마 선택 상태');
  await page.click('.skin.theme-snow');
  expect((await page.locator('.skin.theme-snow').getAttribute('class')).includes('selected'), '설원 테마 선택 즉시 반영');
  await sleep(400); await reload();
  await page.click('#main-tabs [data-action="nav"][data-view="codex"]');
  expect((await page.locator('.skin.theme-snow').getAttribute('class')).includes('selected'), '새로고침 후 테마 선택 유지');
  expect(await page.locator('.skin.turret-crystal').isDisabled(), '크리스탈 포탑(30★) 잠김');
  await page.click('.skin.theme-desert');
  await page.evaluate(() => window.__app.actions.setActive('p_sample01'));

  // ---------- 새 프로필 모달: 입력 검증·XSS·중복 ----------
  await page.click('.toolbar [data-action="new-profile"]');
  expect(await modalOpen() === 1 && await page.evaluate(() => document.activeElement.id === 'np-name'), '새 프로필 모달 열림·이름에 포커스');
  await page.click('.modal [data-m="ok"]');
  expect((await txt('#np-error')).includes('2~12자') && await modalOpen() === 1, '빈 이름 거부');
  await page.fill('#np-name', '가'); await page.click('.modal [data-m="ok"]');
  expect((await txt('#np-error')).includes('2~12자'), '1자 이름 거부');
  await page.fill('#np-name', '가나다라마바사아자차카타파');
  expect((await page.inputValue('#np-name')).length === 12, 'maxlength 12 적용');
  await page.fill('#np-name', '테스트학생'); await page.fill('#np-number', '0'); await page.click('.modal [data-m="ok"]');
  expect((await txt('#np-error')).includes('1~99'), '번호 0 거부');
  await page.fill('#np-number', '100'); await page.click('.modal [data-m="ok"]');
  expect((await txt('#np-error')).includes('1~99'), '번호 100 거부');
  await page.fill('#np-number', '-3'); await page.click('.modal [data-m="ok"]');
  expect((await txt('#np-error')).includes('1~99') && await modalOpen() === 1, '번호 음수 거부');
  await page.fill('#np-number', '25'); await page.fill('#np-name', '<b>x</b>'); await page.click('.modal [data-m="ok"]'); await sleep(150);
  s = await st();
  expect(await modalOpen() === 0 && s.current === '<b>x</b>' && s.profiles.length === 25, 'XSS 문자열 이름으로 프로필 생성(25명)');
  const rawName = await page.evaluate(() => ({ bar: document.getElementById('profile-name').innerHTML, sum: document.querySelector('.summary-name').innerHTML, menu: document.querySelector('#profile-menu li[aria-selected="true"] span:not(.avatar)').innerHTML }));
  expect(!rawName.bar.includes('<b>') && rawName.sum.includes('&lt;b&gt;') && rawName.menu.includes('&lt;b&gt;'), `XSS 이스케이프(프로필바·요약·메뉴) ${JSON.stringify(rawName)}`);
  expect((await page.locator('#summary-card b').count()) >= 1 && !(await page.evaluate(() => !!document.querySelector('.summary-name > b'))), '요약 카드에 <b> 태그가 실제 요소로 삽입되지 않음');
  // 중복 이름 → (2)
  await page.click('.toolbar [data-action="new-profile"]'); await page.fill('#np-name', '김하늘'); await page.click('.modal [data-m="ok"]'); await sleep(150);
  s = await st();
  expect(s.current === '김하늘(2)' && s.profiles.length === 26, `중복 이름은 '김하늘(2)' (실제 ${s.current})`);
  // 새로고침 후 유지(디바운스 300ms 경과 후)
  await sleep(400); await reload();
  s = await st();
  expect(s.profiles.length === 26 && s.current === '김하늘(2)', '새로고침 후 새 프로필·활성 프로필 유지');

  // ---------- 설정 패널 ----------
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  expect(await page.locator('[data-stage-check]').count() === 19 && await page.locator('[data-stage-check]:checked').count() === 19, '활성 스테이지 체크 19개(스펙 열거 전부) 모두 선택');
  expect(await page.locator('#speed-group input[value="normal"]').isChecked() && await page.inputValue('#time-limit') === '5', '기본 속도 보통·시간 제한 5분');
  expect((await txt('#profile-count')).includes('26/40'), '프로필 인원 26/40 표시');
  expect(await page.locator('#profile-table tbody tr').count() === 26, '프로필 표 26행');
  const xssRow = await page.evaluate(() => { const i = [...document.querySelectorAll('#profile-table input[data-field="name"]')].find(x => x.value === '<b>x</b>'); return i ? i.value : null; });
  expect(xssRow === '<b>x</b>', '프로필 표에서 XSS 이름이 값으로만 표시');
  // 속도 느리게 + 토스트 + 저장 시각
  await page.check('#speed-group input[value="slow"]'); await sleep(400);
  let t = await toastTexts();
  expect(t.some(x => x === '저장됨'), "설정 변경 시 '저장됨' 토스트");
  expect(!(await txt('#save-status')).includes('—'), `마지막 저장 시각 표시 (${await txt('#save-status')})`);
  await page.selectOption('#time-limit', '3');
  await page.click('[data-action="grade-all"][data-grade="6"][data-on="0"]');
  expect(await page.locator('[data-stage-check]:checked').count() === 16, '6학년 전체 해제 → 16개 체크');
  await page.uncheck('[data-stage-check="s1-2"]');
  await page.check('[data-setting="unlockAll"]');
  await page.fill('#volume', '0.8'); await page.locator('#volume').dispatchEvent('change');
  await page.fill('#pin-input', '12a'); await page.click('[data-action="save-pin"]');
  t = await toastTexts(); expect(t.some(x => x.includes('4자리')), 'PIN 4자리 아니면 오류 토스트');
  await sleep(400); await reload();
  s = await st();
  expect(s.settings.speedPreset === 'slow' && s.settings.timeLimitMin === 3 && s.settings.unlockAll === true && s.settings.volume === 0.8 && !s.settings.activeStageIds.includes('s1-2') && s.settings.activeStageIds.length === 15,`새로고침 후 설정 유지 ${JSON.stringify({ sp: s.settings.speedPreset, tl: s.settings.timeLimitMin, ua: s.settings.unlockAll, vol: s.settings.volume, n: s.settings.activeStageIds.length })}`);
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  expect(await page.locator('#speed-group input[value="slow"]').isChecked() && (await txt('#volume-out')) === '0.80', '설정 UI에 저장값 반영');
  // 변경 직후(300ms 디바운스 전) 새로고침 — 마지막 변경 유실 여부
  await page.check('[data-setting="lowSpec"]');
  await page.reload({ waitUntil: 'load' }); await sleep(500);
  expect((await st()).settings.lowSpec === true, '설정 변경 직후(300ms 내) 새로고침/창 닫기에도 마지막 변경 유지(pagehide flush)');
  await page.evaluate(() => window.__app.actions.setSetting('lowSpec', false)); await sleep(400);
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  // 홈: 비활성 카드 회색 + 토스트, 전체 해금
  await page.click('#main-tabs [data-action="nav"][data-view="home"]');
  await page.click('[data-action="grade-tab"][data-grade="1"]');
  const c12 = page.locator('.stage-card[data-stage="s1-2"]');
  expect((await c12.getAttribute('class')).includes('disabled') && (await c12.locator('.start-btn').innerText()) === '닫힌 스테이지', '비활성 스테이지 회색 카드');
  await c12.locator('.start-btn').click(); await sleep(100);
  t = await toastTexts(); expect(t.some(x => x.includes('선생님이 닫아 둔 스테이지')), "비활성 카드 클릭 → '선생님이 닫아 둔 스테이지입니다' 토스트");
  expect((await st()).view === 'home', '비활성 카드 클릭 시 게임 시작 안 함');
  await page.click('[data-action="grade-tab"][data-grade="6"]');
  expect(await page.locator('.stage-card.disabled').count() === 3, '6학년 3개 모두 닫힘 표시');
  await page.click('[data-action="grade-tab"][data-grade="4"]');
  expect(await page.locator('.stage-card.locked').count() === 0 && await page.locator('.stage-card.open').count() === 3, '전체 해금 ON → 4학년 카드 모두 열림');
  await shot('home-unlockall');
  // 모든 스테이지 비활성
  await page.evaluate(() => { window.__app.actions.setSetting('activeStageIds', []); window.__app.actions.showView('home'); });
  expect((await txt('#stage-grid')).includes('모든 스테이지를 닫아'), '모든 스테이지 비활성 안내 카드');
  await page.evaluate(() => { window.__app.actions.setSetting('activeStageIds', window.__app.MG.STAGES.map(x => x.id)); window.__app.actions.setSetting('unlockAll', false); window.__app.actions.setSetting('speedPreset', 'normal'); window.__app.actions.setSetting('timeLimitMin', 5); window.__app.actions.showView('home'); });

  // ---------- 프로필 표 인라인 수정·삭제 ----------
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  const rowSel = pid => `#profile-table tr[data-pid="${pid}"]`;
  const cur = (await st()).activeProfileId; // 김하늘(2)
  await page.fill(`${rowSel(cur)} input[data-field="name"]`, '김'); await page.locator(`${rowSel(cur)} input[data-field="name"]`).dispatchEvent('change'); await sleep(100);
  t = await toastTexts(); expect(t.some(x => x.includes('2~12자')) && (await page.inputValue(`${rowSel(cur)} input[data-field="name"]`)) === '김하늘(2)', '표에서 1자 이름 거부·원복');
  await page.fill(`${rowSel(cur)} input[data-field="number"]`, '150'); await page.locator(`${rowSel(cur)} input[data-field="number"]`).dispatchEvent('change'); await sleep(100);
  t = await toastTexts(); expect(t.some(x => x.includes('올바른 숫자')), '표에서 번호 150 거부');
  await page.fill(`${rowSel(cur)} input[data-field="name"]`, '수정된이름'); await page.locator(`${rowSel(cur)} input[data-field="name"]`).dispatchEvent('change'); await sleep(100);
  expect((await txt('#profile-name')) === '수정된이름', '인라인 이름 수정이 프로필바에 즉시 반영');
  // 활성 프로필 삭제 → 첫 프로필로 전환
  await page.click(`${rowSel(cur)} [data-action="delete-profile"]`);
  expect(await modalOpen() === 1 && (await page.locator('.modal .btn.danger').innerText()) === '삭제', '삭제 확인 모달(빨간 확인 버튼)');
  await page.click('.modal [data-m="false"]'); await sleep(100);
  expect((await st()).profiles.length === 26, '취소 시 삭제 안 됨');
  await page.click(`${rowSel(cur)} [data-action="delete-profile"]`); await page.click('.modal [data-m="true"]'); await sleep(150);
  s = await st();
  expect(s.profiles.length === 25 && s.current === '김하늘' && s.activeProfileId === 'p_sample01', `활성 프로필 삭제 → 첫 프로필(김하늘)로 전환 (현재 ${s.current})`);
  // XSS 프로필도 삭제
  const xid = s.profiles.find(p => p.name === '<b>x</b>').id;
  await page.click(`${rowSel(xid)} [data-action="delete-profile"]`); await page.click('.modal [data-m="true"]'); await sleep(150);
  expect((await st()).profiles.length === 24, '테스트 프로필 삭제 후 24명');

  // ---------- CSV 내보내기(기록·약점) ----------
  const dl = async (action) => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click(`[data-action="${action}"]`)]); const p = path.join(outDir, d.suggestedFilename()); await d.saveAs(p); return { name: d.suggestedFilename(), text: fs.readFileSync(p, 'utf8'), path: p }; };
  // 쉼표·따옴표가 든 이름으로 이스케이프 검증
  await page.fill(`${rowSel('p_sample10')} input[data-field="name"]`, '한,"수아'); await page.locator(`${rowSel('p_sample10')} input[data-field="name"]`).dispatchEvent('change'); await sleep(100);
  const rec = await dl('export-records');
  const today = new Date(); const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  expect(rec.name === `math-guardians-records-${ymd}.csv`, `기록 CSV 파일명 ${rec.name}`);
  expect(rec.text.charCodeAt(0) === 0xFEFF && rec.text.includes('프로필,학년,반,번호,스테이지,최고점수'), '기록 CSV BOM + 헤더');
  const recLines = rec.text.split('\r\n');
  expect(recLines.length === 1 + 8 + 4 + 5 + 9 + 10 + 1, `기록 CSV 행 수 ${recLines.length - 1} (기대 37)`);
  expect(rec.text.includes('"한,""수아"'), '쉼표·따옴표 포함 필드 큰따옴표 이스케이프');
  const weak = await dl('export-weak');
  expect(weak.name === `math-guardians-weakfacts-${ymd}.csv` && weak.text.includes('8 × 7,56,1,3,0'), `약점 CSV 파일명·8×7 행 (${weak.name})`);
  await page.fill(`${rowSel('p_sample10')} input[data-field="name"]`, '한수아'); await page.locator(`${rowSel('p_sample10')} input[data-field="name"]`).dispatchEvent('change'); await sleep(100);

  // ---------- 명단 CSV 가져오기 ----------
  const roster = path.join(outDir, 'roster.csv');
  fs.writeFileSync(roster, '﻿번호,이름\r\n30,새학생\r\n31,김하늘\r\n,번호없음\r\n32,가\r\n33,"쉼,표"\r\nab,이상번호\r\n\r\n34,<i>태그</i>\r\n', 'utf8');
  await page.setInputFiles('#roster-file', roster); await sleep(300);
  t = await toastTexts(); log('roster toast: ' + JSON.stringify(t));
  s = await st();
  expect(s.profiles.length === 29 && t.some(x => x.includes('5명 추가, 2행 건너뜀')), `명단 CSV: 5명 추가·2행 건너뜀 (프로필 ${s.profiles.length}, ${JSON.stringify(t)})`);
  expect(s.profiles.some(p => p.name === '김하늘(2)') && s.profiles.some(p => p.name === '쉼,표') && s.profiles.some(p => p.name === '번호없음' && p.number === null), '명단 중복 (2)·따옴표 필드·빈 번호 허용');
  const tagCell = await page.evaluate(() => [...document.querySelectorAll('#profile-table input[data-field="name"]')].some(i => i.value === '<i>태그</i>') && !document.querySelector('#profile-table i'));
  expect(tagCell, '명단 XSS 이름 이스케이프');
  // 빈 번호 첫 행이 헤더로 오인되는지
  const roster2 = path.join(outDir, 'roster2.csv'); fs.writeFileSync(roster2, ',첫줄학생\r\n35,둘째학생\r\n', 'utf8');
  await page.setInputFiles('#roster-file', roster2); await sleep(300);
  s = await st();
  expect(s.profiles.some(p => p.name === '첫줄학생'), '번호가 빈 첫 행도 학생으로 추가(헤더 오인 없음)');
  // 잘못된 파일: 헤더만 / txt
  const roster3 = path.join(outDir, 'roster3.csv'); fs.writeFileSync(roster3, '번호,이름\r\n', 'utf8');
  await page.setInputFiles('#roster-file', roster3); await sleep(300);
  expect(await modalOpen() === 1 && (await txt('.modal')).includes('추가된 학생이 없습니다'), '헤더만 있는 CSV → 안내 모달');
  await page.keyboard.press('Escape'); await sleep(100);
  const notCsv = path.join(outDir, 'notes.txt'); fs.writeFileSync(notCsv, '1,아무개', 'utf8');
  await page.setInputFiles('#roster-file', notCsv); await sleep(200);
  t = await toastTexts(); expect(t.some(x => x.includes('지원하지 않는 파일')), 'CSV 아닌 파일 거부 토스트');
  // 40명 상한
  const many = ['번호,이름'].concat(Array.from({ length: 20 }, (_, i) => `${50 + i},상한학생${i + 1}`)).join('\r\n');
  const roster4 = path.join(outDir, 'roster4.csv'); fs.writeFileSync(roster4, many, 'utf8');
  await page.setInputFiles('#roster-file', roster4); await sleep(300);
  s = await st(); t = await toastTexts();
  expect(s.profiles.length === 40 && t.some(x => x.includes('상한')), `40명 상한에서 중단 (${s.profiles.length}명, ${JSON.stringify(t)})`);
  await page.click('.toolbar [data-action="new-profile"]'); await sleep(100);
  t = await toastTexts(); expect(await modalOpen() === 0 && t.some(x => x.includes('최대 40명')), '40명일 때 새 프로필 차단 토스트');
  expect((await txt('#profile-count')).includes('40/40'), '인원 40/40 표시');

  // ---------- AC15: JSON 백업 → 초기화 → 복원 / 잘못된 파일 ----------
  const before = (await st()).profiles.map(p => p.name);
  const bk = await dl('export-json');
  expect(bk.name === `math-guardians-backup-${ymd}.json`, `JSON 백업 파일명 ${bk.name}`);
  const parsed = JSON.parse(bk.text);
  expect(parsed.schemaVersion === 1 && parsed.profiles.length === 40 && parsed.settings && parsed.activeProfileId, 'JSON 백업 구조(schemaVersion·profiles·settings)');
  await page.click('[data-action="reset-sample"]'); await page.click('.modal [data-m="true"]'); await sleep(300);
  s = await st();
  expect(s.profiles.length === 24 && s.view === 'home' && s.current === '김하늘', `샘플 초기화 후 24명·홈·김하늘 (${s.profiles.length})`);
  await reload();
  expect((await st()).profiles.length === 24, '초기화 결과가 저장됨');
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  // 임의 텍스트(.txt) 파일
  await page.setInputFiles('#json-file', notCsv); await sleep(200);
  t = await toastTexts();
  const txtModal = await modalOpen();
  log(`txt 파일 투입: modal=${txtModal}, toasts=${JSON.stringify(t)}`);
  expect(txtModal === 1 || t.some(x => x.includes('지원하지 않는')), '.txt 파일 거부(모달 또는 토스트)');
  expect(txtModal === 1 && (await txt('.modal')).includes('형식이 맞지 않는 파일입니다'), "AC15 임의 텍스트 파일 → '형식이 맞지 않는 파일입니다' 모달");
  if (txtModal) { await page.keyboard.press('Escape'); await sleep(100); }
  // 깨진 JSON / 다른 앱 JSON
  const badJson = path.join(outDir, 'bad.json'); fs.writeFileSync(badJson, '{ not json', 'utf8');
  await page.setInputFiles('#json-file', badJson); await sleep(200);
  expect(await modalOpen() === 1 && (await txt('.modal')).includes('형식이 맞지 않는 파일입니다'), "손상 JSON → '형식이 맞지 않는 파일입니다' 모달");
  await page.keyboard.press('Escape'); await sleep(100);
  const otherJson = path.join(outDir, 'other.json'); fs.writeFileSync(otherJson, JSON.stringify({ version: 1, items: [1, 2], schemaVersion: 2, profiles: [] }), 'utf8');
  await page.setInputFiles('#json-file', otherJson); await sleep(200);
  expect(await modalOpen() === 1 && (await txt('.modal')).includes('형식이 맞지 않는'), 'schemaVersion 불일치 JSON 거부');
  await page.keyboard.press('Escape'); await sleep(100);
  expect((await st()).profiles.length === 24, '잘못된 파일 투입 후 데이터 불변');
  // 정상 복원: 확인 모달 취소 → 불변, 확인 → 복원
  await page.setInputFiles('#json-file', bk.path); await sleep(200);
  expect(await modalOpen() === 1 && (await txt('.modal')).includes('현재 데이터를 덮어씁니다'), "복원 확인 모달 '현재 데이터를 덮어씁니다'");
  await page.click('.modal [data-m="false"]'); await sleep(100);
  expect((await st()).profiles.length === 24, '복원 취소 시 불변');
  await page.setInputFiles('#json-file', bk.path); await sleep(200);
  await page.click('.modal [data-m="true"]'); await sleep(300);
  s = await st(); t = await toastTexts();
  expect(s.profiles.length === 40 && JSON.stringify(s.profiles.map(p => p.name)) === JSON.stringify(before) && t.some(x => x.includes('복원 완료: 프로필 40명')), `AC15 백업 복원: 40명·동일 명단·토스트 (${JSON.stringify(t)})`);
  await reload();
  expect((await st()).profiles.length === 40, '복원 결과 새로고침 후 유지');
  // 드롭 영역 drop 이벤트로도 가져오기 되는가 (DataTransfer)
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  const dt = await page.evaluateHandle(text => { const d = new DataTransfer(); d.items.add(new File([text], 'drop.json', { type: 'application/json' })); return d; }, bk.text);
  await page.dispatchEvent('#json-drop', 'dragover', { dataTransfer: dt });
  expect((await page.getAttribute('#json-drop', 'class')).includes('over'), '드롭 영역 dragover 강조');
  await page.dispatchEvent('#json-drop', 'drop', { dataTransfer: dt }); await sleep(200);
  expect(await modalOpen() === 1 && (await txt('.modal')).includes('덮어씁니다'), '드롭 영역에 JSON 드롭 → 확인 모달');
  await page.keyboard.press('Escape'); await sleep(100);
  await page.click('[data-action="reset-sample"]'); await page.click('.modal [data-m="true"]'); await sleep(300);

  // ---------- 교사 PIN 잠금 ----------
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  await page.fill('#pin-input', '1234'); await page.click('[data-action="save-pin"]'); await sleep(100);
  expect((await txt('#pin-status')) === 'PIN 설정됨', 'PIN 저장됨 표시');
  await sleep(400); await reload();
  await page.click('.toolbar [data-action="nav"][data-view="settings"]');
  expect(!(await page.locator('#pin-gate').isHidden()) && await page.locator('#settings-body').isHidden(), '새로고침 후 설정 진입 시 PIN 게이트');
  const resetVisible = await page.locator('[data-action="reset-sample"]').isVisible();
  expect(resetVisible, "PIN 게이트 상태에서 안내문대로 '샘플 데이터로 초기화' 버튼에 접근 가능");
  await page.fill('#pin-gate-input', '0000'); await page.click('[data-action="pin-unlock"]'); await sleep(100);
  t = await toastTexts(); expect(t.some(x => x.includes('PIN이 맞지')) && await page.locator('#settings-body').isHidden(), '틀린 PIN 거부');
  await page.fill('#pin-gate-input', '1234'); await page.click('[data-action="pin-unlock"]'); await sleep(100);
  expect(!(await page.locator('#settings-body').isHidden()), '맞는 PIN으로 열림');
  await page.fill('#pin-input', ''); await page.click('[data-action="save-pin"]'); await sleep(100);
  expect((await txt('#pin-status')) === 'PIN 없음' && (await st()).settings.teacherPin === null, 'PIN 비우면 해제');
  await shot('settings-final');

  // ---------- 저장 손상·세션 플래그 ----------
  await page.evaluate(() => localStorage.setItem('mathGuardians.v1', '{broken json'));
  await reload();
  t = await toastTexts(); s = await st();
  const corruptKept = await page.evaluate(() => localStorage.getItem('mathGuardians.v1.corrupt'));
  expect(s.profiles.length === 24 && corruptKept === '{broken json' && t.some(x => x.includes('손상')), `손상 저장 데이터 → .corrupt 보관 + 재시딩 + 토스트 (${JSON.stringify(t)})`);
  await page.evaluate(() => sessionStorage.setItem('mathGuardians.inGame', '1'));
  await reload();
  t = await toastTexts();
  expect(t.some(x => x.includes('진행 중이던 판은 저장되지 않았습니다')), '게임 중 새로고침 플래그 → 안내 토스트');
  // 테마 토글
  const before2 = await page.evaluate(() => document.documentElement.dataset.theme || 'system');
  await page.click('#theme-btn');
  const after2 = await page.evaluate(() => ({ t: document.documentElement.dataset.theme, ls: localStorage.getItem('edu.math-guardians.theme'), bg: getComputedStyle(document.body).backgroundColor }));
  expect(after2.t === 'dark' && after2.ls === 'dark' && after2.bg === 'rgb(15, 22, 48)', `테마 토글 → dark 저장·배경 변경 (${before2}→${JSON.stringify(after2)})`);
  await shot('home-dark-toggle');
  await page.click('#theme-btn');
  expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', '테마 토글 → light');

  // ---------- 프로필 0명 상태 / facts 600개 상한 ----------
  await page.evaluate(() => { const MG = window.__app.MG; MG.root.profiles = []; MG.root.activeProfileId = null; MG.guest = null; MG.UI.renderProfileBar(); MG.UI.showView('home'); });
  expect((await txt('#profile-name')) === '체험 학생' && (await page.locator('#profile-menu').innerText()).includes('프로필이 없습니다'), '프로필 0명 → 게스트 표시·드롭다운 안내');
  expect(await page.locator('.stage-card[data-stage="s1-1"] .start-btn').isEnabled(), '프로필 0명에서도 1-1 시작 가능(게스트)');
  await page.click('#main-tabs [data-action="nav"][data-view="hall"]');
  expect((await txt('#hall-view')).includes('랭킹에 포함되지 않아요') || (await txt('#hall-view')).includes('아직 기록이 없어요'), '프로필 0명 랭킹 빈 상태 메시지');
  const factCount = await page.evaluate(() => { const MG = window.__app.MG; const p = MG.newProfile('임시', 1, 1, 1, 0); for (let i = 0; i < 650; i++) { const pr = { key: 'k' + i, stageId: 's1-1', p: {}, answerText: '1', text: 'k' + i }; for (let j = 0; j < 3; j++) MG.Facts.update(p, pr, 'hit'); } return Object.keys(p.facts).length; });
  expect(factCount === 600, `facts 600개 초과 시 숙달·오답 0 항목부터 정리 (${factCount})`);
  await page.evaluate(() => window.__app.actions.resetSample());
  await reload();
  expect((await st()).profiles.length === 24, '마무리: 샘플 복원');
};
