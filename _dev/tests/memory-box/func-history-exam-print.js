// func-history-exam-print.js — 기록 대시보드(SVG 차트)·시험 D-Day·인쇄·주간 리포트 독립 검증 (pw-run.js용)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const txt = async sel => (await page.locator(sel).first().textContent()) || '';
  const st = () => page.evaluate(() => window.__app.getState());
  const visible = async sel => (await page.locator(sel).count()) > 0 && await page.locator(sel).first().isVisible();
  const modal = () => page.locator('.modal').last();
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
  let s = await st(); const today = s.today;

  /* ---- 기록 탭 ---- */
  await page.click('#tab-history'); await sleep(300);
  expect(await visible('#view-history'), '기록 탭 열림');
  const stats = await page.$$eval('#view-history .grid-4 .stat', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  expect(stats.length === 4 && stats[0].includes('6일') && stats[0].includes('스트릭'), '요약 카드 4개·스트릭 6일 (' + stats[0] + ')');
  expect(/\d+장/.test(stats[1]) && /정답률 \d+%/.test(stats[1]), '이번 주 복습 장수·정답률 (' + stats[1] + ')');
  expect(/알고 맞힘/.test(stats[2]) && /운 \d+%/.test(stats[2]) && /착각 \d+%/.test(stats[2]), '최근 30일 4분면 비율 (' + stats[2] + ')');
  expect(/숙달/.test(stats[3]) && /국어 \d+%/.test(stats[3]) && /수학 \d+%/.test(stats[3]), '과목별 숙달 비율 (' + stats[3] + ')');
  // 4분면 30일 비율: 샘플 know 55% 근사
  const know = Number((stats[2].match(/^(\d+)%/) || [0, 0])[1]);
  expect(know >= 50 && know <= 60, '알고 맞힘 비율 50~60% (실제 ' + know + '%)');
  // 잔디 달력
  const cells = await page.locator('.svg-cal .cal-cell').count();
  const filled = await page.locator('.svg-cal .cal-cell:not(.g0)').count();
  expect(cells === 84, '잔디 달력 셀 84개(12주×7일) (실제 ' + cells + ')');
  expect(filled >= 30, 'AC9 잔디 달력 색 채워진 셀 ' + filled + '개 >= 30');
  const levels = await page.$$eval('.svg-cal .cal-cell', els => [...new Set(els.map(e => e.getAttribute('class').split(' ')[1]))].sort());
  expect(levels.length >= 4, '잔디 색 단계 ' + levels.join(',') );
  // 미래 날짜 셀 없음(오늘이 마지막)
  const lastD = await page.$$eval('.svg-cal .cal-cell', els => els[els.length - 1].dataset.d);
  expect(lastD === today, '잔디 달력 마지막 셀 = 오늘');
  // 셀 클릭 → 툴팁 텍스트
  const someCell = page.locator('.svg-cal .cal-cell:not(.g0)').first(); const dd = await someCell.getAttribute('data-d'), nn = await someCell.getAttribute('data-n');
  await someCell.click({ force: true }); await sleep(100);
  expect((await txt('#cal-tip')).includes(dd) && (await txt('#cal-tip')).includes(nn + '장'), '달력 셀 클릭 → 날짜·장수 표시 (' + (await txt('#cal-tip')) + ')');
  expect((await page.locator('.svg-cal .cal-cell title').count()) === 84, '셀 hover 툴팁(title) 84개');
  // 상자 분포 막대
  const barNums = await page.$$eval('.svg-bars .lbl-strong', els => els.map(e => Number(e.textContent)));
  expect(barNums.join(',') === s.boxCounts.join(','), '상자 분포 막대 숫자 = 상자 분포 (' + barNums.join(',') + ')');
  expect((await txt('.svg-bars')).includes('★3'), '막대 차트 숙달 3 표시');
  // 원인 도넛
  const donut = await txt('.chart:has(.legend) svg[aria-label="오답 원인 비율"]');
  expect((await page.locator('svg[aria-label="오답 원인 비율"] path, svg[aria-label="오답 원인 비율"] circle').count()) >= 4, '원인 도넛 호 4개 이상');
  const center = await page.$$eval('svg[aria-label="오답 원인 비율"] .donut-center', els => els.map(e => e.textContent));
  expect(center[0] === '계산' && /^\d+%$/.test(center[1]), '도넛 중앙 1위 원인 "계산"·% (' + center.join(' ') + ')');
  // 원인 집계 검증: failReasons 전체(샘플: calc 7+2 = 9, 총 16)
  const counts = {}; s.data.cards.filter(c => c.type === 'wrong').forEach(c => c.failReasons.forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
  const tot = Object.values(counts).reduce((a, b) => a + b, 0);
  expect(center[1] === Math.round(counts.calc / tot * 100) + '%', '도넛 % = calc/전체 (' + counts.calc + '/' + tot + ')');
  // 망각 예측
  expect((await page.locator('.svg-line path').count()) === 1, 'AC9 토글 전 선 1개');
  const base = await txt('.svg-line');
  expect(!/7일 뒤/.test(base), 'AC9 토글 전 "7일 뒤 N장" 없음');
  await page.check('#forecast-toggle'); await sleep(200);
  expect((await page.locator('.svg-line path').count()) === 2 && /7일 뒤 \d+장/.test(await txt('.svg-line')), 'AC9 토글 켜면 두 번째 선 + "7일 뒤 N장" (' + (await txt('.svg-line')).match(/7일 뒤 \d+장/) + ')');
  const f = s.forecast;
  const shown = Number(((await txt('.svg-line')).match(/7일 뒤 (\d+)장/) || [0, -1])[1]);
  expect(shown === f.noR[7], '7일 뒤 숫자 = noReview[7] (' + f.noR[7] + ')');
  expect(f.noR[0] === s.queue.length && f.withR[0] === 0 && f.noR[7] >= f.withR[7], '예측 값: noR[0]=큐 ' + f.noR[0] + ', withR[0]=0, noR[7] ' + f.noR[7] + ' >= withR[7] ' + f.withR[7]);
  expect((await page.locator('#view-history .legend span').count()) >= 2, '범례에 두 번째 선 추가');
  await shot('h01-history-toggle');
  await page.uncheck('#forecast-toggle'); await sleep(200);
  expect((await page.locator('.svg-line path').count()) === 1 && !/7일 뒤/.test(await txt('.svg-line')), 'AC9 토글 끄면 두 번째 선·숫자 사라짐');
  // 되새김 목록
  expect((await page.locator('#reflect-list .reflect-item').count()) === 5, '되새김 한 줄 샘플 5개');
  const refs = await page.$$eval('#reflect-list .reflect-item .small', els => els.map(e => e.textContent.slice(0, 10)));
  expect(refs.every((d, i) => i === 0 || refs[i - 1] >= d), '되새김 날짜 역순 (' + refs.join(' > ') + ')');
  expect(await visible('[data-action="weekly-report"]'), '"이번 주 리포트" 버튼');

  /* ---- 주간 리포트(nice) ---- */
  await page.click('[data-action="weekly-report"]'); await sleep(300);
  expect(await visible('#print-view') && (await txt('#print-area')).includes('기억상자 주간 리포트') && (await txt('#print-area')).includes('김하늘'), '주간 리포트 미리보기 열림');
  expect((await page.locator('#print-area .page.a5').count()) === 1 && (await page.locator('#print-area th').count()) === 7, 'A5 1장·월~일 7칸');
  expect(await visible('#weekly-check'), '보호자 확인 체크');
  await page.check('#weekly-check'); await sleep(200);
  s = await st(); expect(s.data.weeklyChecks.length === 1, '보호자 확인 → weeklyChecks 저장');
  await page.keyboard.press('Escape'); await sleep(200);
  expect(await page.locator('#print-view').isHidden(), 'ESC로 미리보기 닫힘');

  /* ---- 빈 상태: 카드 0장 프로필에서 기록·홈 ---- */
  await page.evaluate(() => { window.__app.actions.openCardModal; }); // noop
  await page.click('#tab-settings'); await sleep(200);
  await page.click('[data-action="profile-add"]'); await sleep(200);
  await page.fill('#pf-name', '빈프로필'); await modal().locator('[data-value="true"]').click(); await sleep(300);
  s = await st(); const emptyP = s.meta.profiles.find(p => p.name === '빈프로필');
  expect(!!emptyP, '빈 프로필 생성');
  await page.evaluate(id => window.__app.actions.switchProfile(id), emptyP.id); await sleep(300);
  await page.click('#tab-home'); await sleep(200);
  const h0 = await txt('#view-home');
  expect(h0.includes('아직 카드가 없어요') && (await page.locator('[data-action="start-today"]').count()) === 0 && await visible('#view-home [data-action="goto"][data-view="cards"]'), '카드 0장: 안내 카드+바로가기, 복습 버튼 없음');
  await page.click('#tab-history'); await sleep(300);
  const h = await txt('#view-history');
  expect(h.includes('카드가 없어요') && h.includes('아직 오답 기록이 없어요') && (await page.locator('.svg-cal').count()) === 1, '카드 0장: 차트 빈 상태 문구(0 나누기 없음)');
  expect(await page.locator('[data-action="weekly-report"]').isDisabled(), '카드 0장: 주간 리포트 비활성');
  await page.click('#tab-exam'); await sleep(200);
  expect(await page.locator('[data-action="new-exam"]').isDisabled() && (await txt('#view-exam')).includes('예정된 시험이 없어요'), '카드 0장: + 시험 비활성·빈 상태');
  await page.click('#tab-print'); await sleep(200);
  expect(await page.locator('[data-action="print-preview"]').isDisabled() && (await txt('#view-print')).includes('덱이 없어요'), '카드 0장: 인쇄 미리보기 비활성');
  await page.click('#tab-cards'); await sleep(200);
  expect((await txt('#view-cards')).includes('첫 덱을 만들어 보세요'), '카드 0장: 덱 빈 상태');
  await page.click('.fab'); await sleep(200);
  expect((await txt('.modal-title')).includes('새 덱'), '덱 없을 때 FAB → 덱 모달 유도');
  await page.keyboard.press('Escape'); await sleep(200);
  await page.evaluate(() => window.__app.actions.switchProfile('p-haneul')); await sleep(300);

  /* ---- AC10 시험 D-Day ---- */
  await page.click('#tab-exam'); await sleep(200);
  expect((await page.locator('#view-exam [data-exam]').count()) === 1 && (await txt('#view-exam')).includes('D-12') && (await txt('#view-exam')).includes('수학 오답노트'), '시험 목록: 샘플 D-12 1건');
  expect((await page.locator('#view-exam .plan-day').count()) === 12, '샘플 계획 달력 12칸');
  const planSum0 = await page.$$eval('#view-exam .plan-day b', els => els.reduce((a, e) => a + Number(e.textContent), 0));
  expect(planSum0 === 14, '샘플 계획 합 14장(수학 오답노트 전체) (실제 ' + planSum0 + ')');
  await page.click('[data-action="new-exam"]'); await sleep(200);
  expect(await visible('.modal') && (await page.getAttribute('#ex-date', 'min')) === addDays(today, 1), '시험 모달 날짜 min=내일');
  const sv = () => modal().locator('[data-value="true"]');
  expect(await sv().isDisabled(), '이름·덱 없음 → 저장 비활성');
  await page.fill('#ex-title', '영어 단어 시험');
  expect(await sv().isDisabled(), '덱 미선택 → 저장 비활성');
  const enDeck = s.data.decks.find(d => d.name === '영어 5학년 Unit 4 단어');
  await page.click(`.modal [data-deck="${enDeck.id}"]`); await sleep(100);
  await page.fill('#ex-date', today); await page.dispatchEvent('#ex-date', 'input'); await sleep(100);
  expect(await sv().isDisabled(), '날짜 오늘 → 저장 비활성');
  await page.fill('#ex-date', addDays(today, 10)); await page.dispatchEvent('#ex-date', 'input'); await sleep(100);
  expect(!(await sv().isDisabled()), '날짜 오늘+10·덱 선택 → 저장 활성');
  await sv().click(); await sleep(400);
  expect((await page.locator('#toast-root .toast').last().textContent()).includes('16장을 10일에 나눴어요'), '토스트 "16장을 10일에 나눴어요" (' + (await page.locator('#toast-root .toast').last().textContent()) + ')');
  s = await st();
  const ex = s.data.exams.find(e => e.title === '영어 단어 시험');
  expect(!!ex && ex.date === addDays(today, 10) && ex.deckIds.join() === enDeck.id && ex.status === 'active', '시험 저장(날짜 오늘+10, 덱 영어)');
  const planSum = Object.values(ex.plan).reduce((a, b) => a + b, 0);
  expect(planSum >= 16 && Object.keys(ex.plan).length <= 10, 'AC10 계획 합 ' + planSum + ' >= 16, 날짜 칸 ' + Object.keys(ex.plan).length + '개');
  const enCards = s.data.cards.filter(c => c.deckId === enDeck.id);
  expect(enCards.length === 16 && enCards.every(c => c.due <= addDays(today, 9)), 'AC10 영어 덱 16장 모두 due <= 시험 전날');
  expect(enCards.filter(c => c.history.some(h => h.r === 'manual' && h.reason === 'exam')).length > 0, '앞당긴 카드 history에 manual/exam 기록');
  const examPanel = page.locator(`#view-exam [data-exam="${ex.id}"]`);
  expect((await examPanel.locator('.plan-day').count()) === 10, 'AC10 계획 달력 10칸');
  const uiSum = await examPanel.locator('.plan-day b').evaluateAll(els => els.reduce((a, e) => a + Number(e.textContent), 0));
  expect(uiSum >= 16, 'AC10 달력 칸 장수 합 ' + uiSum + ' >= 16');
  expect((await examPanel.textContent()).includes('D-10') && (await examPanel.locator('.plan-day.today').count()) === 1, '시험 카드 D-10·오늘 칸 강조');
  await shot('h02-exam');
  await page.click('#tab-home'); await sleep(200);
  const hb = await txt('#view-home .dday');
  expect(hb.includes('D-10') && hb.includes('영어 단어 시험') && /오늘 계획 \d+장/.test(hb), 'AC10 홈 배너 D-10 영어 단어 시험 (' + hb.replace(/\s+/g, ' ').trim() + ')');
  expect((await txt('#view-home')).includes(`오늘 복습 ${s.queue.length}장`) && s.queue.length > 11, '재분배로 오늘 큐 증가 (' + s.queue.length + '장)');
  await reload();
  expect((await txt('#view-home .dday')).includes('D-10'), '새로고침 후 D-10 배너 유지');
  // 다시 생성·삭제
  await page.click('#tab-exam'); await sleep(200);
  await page.click(`#view-exam [data-exam="${ex.id}"] [data-action="exam-regen"]`); await sleep(300);
  expect((await page.locator('#toast-root .toast').last().textContent()).includes('10일에 나눴어요'), '다시 생성 토스트');
  await page.click(`#view-exam [data-exam="${ex.id}"] [data-action="exam-delete"]`); await sleep(200);
  expect((await txt('.modal-title')).includes('시험 삭제'), '시험 삭제 확인 모달');
  await modal().locator('.btn-danger').click(); await sleep(300);
  s = await st();
  expect(!s.data.exams.find(e => e.id === ex.id) && (await page.locator('#view-exam [data-exam]').count()) === 1, '시험 삭제 → 1건');
  // 지난 시험 → '시험 끝' + 틀린 문제 추가
  await page.evaluate(d => { const st = window.__app.getState(); }, 0);
  await page.evaluate(() => { const s = window.__app.getState(); });
  // 과거 시험 주입: 앱이 pagehide 때 메모리 상태를 다시 저장하므로 reload 직전에 localStorage를 고쳐도 덮어써진다 → 초기화 스크립트(앱 스크립트 실행 전)에서 주입
  await page.addInitScript(() => {
    try {
      const k = 'edu.memory-box.v1.profile.p-haneul'; const d = JSON.parse(localStorage.getItem(k) || 'null'); if (!d || !Array.isArray(d.exams) || d.exams.some(e => e.id === 'ex-past')) return;
      const t = new Date(); t.setDate(t.getDate() - 1); const ymd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      d.exams.push({ id: 'ex-past', title: '지난 시험', date: ymd, deckIds: [d.decks[0].id], createdAt: ymd, plan: {}, status: 'active' }); localStorage.setItem(k, JSON.stringify(d));
    } catch (e) { /* 무시 */ }
  });
  await reload(); await page.click('#tab-exam'); await sleep(200);
  expect((await page.locator('#view-exam [data-exam="ex-past"]').count()) === 1, '지난 시험 주입 후 목록에 표시');
  if (!(await page.locator('#view-exam [data-exam="ex-past"]').count())) { log('지난 시험 주입 실패 → 이후 시험 끝 검증 생략'); return; }
  const past = page.locator('#view-exam [data-exam="ex-past"]');
  expect((await past.textContent()).includes('시험 끝') && (await past.locator('[data-action="exam-wrong"]').count()) === 1, '지난 시험 → "시험 끝" + "시험에서 틀린 문제 추가"');
  await past.locator('[data-action="exam-wrong"]').click(); await sleep(200);
  s = await st();
  expect((await txt('.modal-title')).includes('새 카드') && (await page.inputValue('#cd-deck')) === s.data.decks[0].id && (await page.locator('.seg [data-type="wrong"][aria-pressed="true"]').count()) === 1, '틀린 문제 추가 → 덱 선택·오답 유형 모달');
  await page.keyboard.press('Escape'); await sleep(200);
  expect(!(await txt('#view-home')).includes('지난 시험'), '지난 시험은 홈 배너에 없음');

  /* ---- 인쇄 ---- */
  await page.click('#tab-print'); await sleep(200);
  expect((await txt('#view-print')).includes('선택 0장') && await page.locator('[data-action="print-preview"]').isDisabled(), '인쇄: 0장 선택 시 미리보기 비활성');
  await page.click(`[data-action="print-deck"][data-id="${enDeck.id}"]`); await sleep(150);
  expect((await txt('#view-print')).includes('선택 16장') && !(await page.locator('[data-action="print-preview"]').isDisabled()), '영어 덱 선택 → 16장·활성');
  await page.locator('#print-box').fill('2'); await page.dispatchEvent('#print-box', 'input'); await sleep(150);
  s = await st();
  const le2 = s.data.cards.filter(c => c.deckId === enDeck.id && c.box <= 2).length;
  expect((await txt('#view-print')).includes(`선택 ${le2}장`) && (await txt('#print-box-label')).includes('2상자 이하'), '상자 범위 2 이하 → ' + le2 + '장');
  await page.locator('#print-box').fill('5'); await page.dispatchEvent('#print-box', 'input'); await sleep(150);
  await page.click('[data-action="print-preview"]'); await sleep(400);
  expect(await visible('#print-view') && await visible('[data-action="print-now"]') && (await txt('.print-hint')).includes('배율 100%'), '미리보기 열림·인쇄 버튼·여백/배율 안내');
  const pages = await page.locator('#print-area .page').count();
  expect(pages === 4, '양면 16장 → 앞면 2쪽+뒷면 2쪽 = 4쪽 (실제 ' + pages + ')');
  expect((await page.locator('#print-area .page .pcard').count()) === 32, '페이지당 8칸(2×4) 총 32칸');
  // 뒷면 반전: 1쪽 1행 [a,b] ↔ 2쪽 1행 [b,a]
  const fronts = await page.$$eval('#print-area .page:nth-child(1) .pcard .pc-text', els => els.map(e => e.textContent));
  const backs = await page.$$eval('#print-area .page:nth-child(2) .pcard .pc-text', els => els.map(e => e.textContent));
  const map = {}; s.data.cards.forEach(c => { map[c.front] = c.back; });
  expect(fronts.length === 8 && backs.length === 8 && backs[0] === map[fronts[1]] && backs[1] === map[fronts[0]] && backs[7] === map[fronts[6]], '뒷면 페이지 좌우 반전 순서(앞 [a,b] → 뒤 [b,a])');
  expect((await page.locator('#print-area .page-title').count()) === 4 && (await txt('#print-area .page-title')).includes('김하늘'), '제목·이름 칸 표시');
  await shot('h03-print-cards');
  await page.click('[data-action="print-back"]'); await sleep(200);
  expect(await page.locator('#print-view').isHidden() && await visible('#view-print'), '돌아가기 → 인쇄 탭');
  // 8장 미만 → 빈 칸 유지
  const mathDeck = s.data.decks.find(d => d.name === '수학 오답노트');
  await page.click(`[data-action="print-deck"][data-id="${enDeck.id}"]`); await page.click(`[data-action="print-deck"][data-id="${mathDeck.id}"]`); await sleep(150);
  await page.locator('#print-box').fill('2'); await page.dispatchEvent('#print-box', 'input'); await sleep(150);
  const m2 = s.data.cards.filter(c => c.deckId === mathDeck.id && c.box <= 2).length;
  await page.click('[data-action="print-preview"]'); await sleep(300);
  const pc = await page.locator('#print-area .page').count(), cards = await page.locator('#print-area .page .pcard').count();
  expect(pc === Math.ceil(m2 / 8) * 2 && cards === pc * 8, `수학 ${m2}장(2상자 이하) → ${pc}쪽·빈 칸 포함 ${cards}칸`);
  await page.click('[data-action="print-back"]'); await sleep(200);
  // 다시풀기 학습지
  await page.click('[data-action="print-layout"][data-val="sheet"]'); await sleep(150);
  await page.click('[data-action="print-preview"]'); await sleep(300);
  const sp = await txt('#print-area');
  expect((await page.locator('#print-area .sheet-item').count()) === m2 && sp.includes('정답표') && (await page.locator('#print-area .sheet-ans > div').count()) === m2, `학습지 문제 ${m2}개 + 별지 정답표`);
  const firstQ = await txt('#print-area .sheet-item');
  const myAns = s.data.cards.filter(c => c.deckId === mathDeck.id && c.box <= 2).map(c => c.myAnswer).filter(Boolean);
  expect(!myAns.some(a => firstQ.includes('내 답')) && !(await txt('#print-area .sheet-q')).includes('내 답'), '문제지에는 내 답 가림');
  expect((await txt('#print-area .sheet-ans')).includes('내 답'), '정답표에 내 답 표시');
  await shot('h04-print-sheet');
  // @media print 동작: 인쇄 매체로 바꾸면 앱 UI는 숨고 인쇄 영역만 보임(file:// 스타일시트는 cssRules 접근이 막혀 computed style로 검증)
  await page.emulateMedia({ media: 'print' }); await sleep(100);
  const pr = await page.evaluate(() => ({ app: getComputedStyle(document.querySelector('.app')).display, toolbar: getComputedStyle(document.querySelector('.print-toolbar')).display, page: getComputedStyle(document.querySelector('#print-area .page')).display, pos: getComputedStyle(document.getElementById('print-view')).position, bodyBg: getComputedStyle(document.body).backgroundColor }));
  expect(pr.app === 'none' && pr.toolbar === 'none' && pr.page !== 'none' && pr.pos === 'static' && pr.bodyBg === 'rgb(255, 255, 255)', '@media print: .app·툴바 숨김, 인쇄 페이지만 흰 배경으로 표시 (' + JSON.stringify(pr) + ')');
  await page.emulateMedia({ media: 'screen' }); await sleep(100);
  await page.click('[data-action="print-back"]'); await sleep(200);
  // 일반 화면에서 Ctrl+P: 앱도 숨고 #print-view도 hidden이면 빈 종이
  await page.emulateMedia({ media: 'print' }); await sleep(100);
  const blank = await page.evaluate(() => [...document.body.querySelectorAll('*')].every(e => { const r = e.getBoundingClientRect(); return r.width === 0 || r.height === 0 || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden'; }));
  expect(!blank, '[인쇄] 일반 화면(홈·카드 등)에서 Ctrl+P 해도 빈 종이가 아님');
  await page.emulateMedia({ media: 'screen' }); await sleep(100);
};
