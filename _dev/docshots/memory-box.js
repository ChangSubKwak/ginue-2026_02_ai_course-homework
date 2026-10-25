// 기억상자 설명서용 스크린샷 촬영 모듈 (pw-run.js용)
// node _dev/tools/pw-run.js <index.html> _dev/docshots/memory-box.js <docs/screens>
// 샘플 데이터(김하늘) 그대로 홈·모바일·덱·카드 목록을 먼저 찍고, 오늘 큐 11장 세션을 자동 진행하며 앞면·뒷면(원인 패널)·요약을 찍은 뒤
// 기록·시험(다크)·인쇄 미리보기·교사 모드·도움말을 찍는다.
'use strict';
const path = require('path');
module.exports = async ({ page, expect, sleep, log }) => {
  const outdir = process.argv[4] || path.join(__dirname, 'out');
  const snap = async (name, full) => {
    await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    await page.waitForTimeout(400);
    const p = path.join(outdir, name + '.png');
    await page.screenshot({ path: p, fullPage: !!full });
    log('shot ' + p);
  };
  const act = (fn, arg) => page.evaluate(fn, arg);
  const state = () => page.evaluate(() => window.__app.getState());
  const setVp = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await sleep(300); };

  // ---------- 01 홈(1280 라이트): 오늘 복습 11장(밀림 3장)·스트릭 6·D-12 배너·상자 5개 ----------
  await sleep(500);
  let st = await state();
  expect(st.queue.length === 11, '01 오늘 큐 11장');
  expect(st.streak === 6, '01 스트릭 6');
  await snap('01-home', false);

  // ---------- 12 모바일 400px 홈 ----------
  await setVp(400, 860);
  await act(() => window.scrollTo(0, 0));
  await snap('12-mobile-home', false);
  await setVp(1280, 800);

  // ---------- 02 카드 탭: 덱 5개 ----------
  await page.click('#tab-cards');
  await sleep(300);
  expect(await page.locator('.deck-card').count() === 5, '02 덱 카드 5개');
  await snap('02-decks', false);

  // ---------- 03 덱 상세: 수학 오답노트(오답·원인·같은 이유로 3번 배지) ----------
  await page.click('.deck-card:has-text("수학 오답노트")');
  await sleep(300);
  expect(await page.locator('.card-row').count() === 14, '03 수학 오답노트 카드 14장');
  expect(await page.locator('.badge-repeat').count() >= 1, '03 같은 이유로 3번 배지');
  await setVp(1280, 1150);
  await act(() => window.scrollTo(0, 0));
  await snap('03-deck-cards', false);
  await setVp(1280, 800);

  // ---------- 07 기록(세션 전: 오늘 큐 11장이 남아 있어 망각 예측 두 선이 갈라져 보인다) ----------
  await page.click('#tab-history');
  await sleep(300);
  await page.click('#forecast-toggle');
  await sleep(300);
  expect(await page.locator('.cal-cell.g1, .cal-cell.g2, .cal-cell.g3, .cal-cell.g4').count() >= 30, '07 잔디 달력 채워진 셀 30+');
  st = await state();
  expect(st.forecast.noR[7] > st.forecast.withR[7], '07 망각 예측 두 선이 다름');
  await setVp(1280, 1500);
  await act(() => window.scrollTo(0, 0));
  await snap('07-history', false);
  await setVp(1280, 800);

  // ---------- 복습 세션(오늘 큐 11장) ----------
  await page.click('#tab-home');
  await sleep(200);
  await page.click('[data-action="start-today"]');
  await sleep(500);
  expect(await page.locator('#session:not([hidden])').count() === 1, '04 세션 화면 열림');
  // 카드별 처리 계획: [확신도, 맞음] — 4분면이 골고루 나오게. 세 번째 카드(수학 오답·같은 이유로 3번)는 촬영용
  const plan = [[3, true], [2, true], [3, false], [3, true], [1, true], [3, true], [2, false], [3, true], [3, true], [1, false], [3, true]];
  for (let i = 0; i < plan.length; i++) {
    const [c, ok] = plan[i];
    const s = await state(); if (!s.session) break;
    const cardId = s.session.ids[s.session.idx];
    const card = s.data.cards.find(x => x.id === cardId);
    await act(k => window.__app.actions.chooseConf(k), c);
    await sleep(150);
    if (i === 2) {
      expect(card && card.type === 'wrong', '04 세 번째 카드는 오답 카드');
      await snap('04-session-front', false);
    }
    await act(() => window.__app.actions.flip());
    await sleep(500);
    await act(v => window.__app.actions.grade(v), ok);
    await sleep(200);
    if (!ok && card && card.type === 'wrong') {
      if (i === 2) {
        expect(await page.locator('#reason-panel:not([hidden])').count() === 1, '05 원인 패널 표시');
        await snap('05-session-back', false);
      }
      await act(() => window.__app.actions.pickReason('calc'));
    }
    await sleep(650); // 상자 이동 애니메이션(420ms) 종료 대기
  }
  await sleep(400);
  expect(await page.locator('.modal .quad').count() === 1, '06 세션 요약 모달(4분면)');
  await page.fill('#reflect-in', '통분한 뒤에는 분자만 더하기, 분모는 그대로');
  await setVp(1280, 1000);
  await snap('06-session-summary', false);
  await page.click('.modal [data-value="true"]');
  await sleep(400);
  await setVp(1280, 800);

  // ---------- 08 시험 탭(다크 모드) ----------
  await page.click('#theme-btn');
  await sleep(200);
  await page.click('#tab-exam');
  await sleep(300);
  expect(await page.locator('.plan-day').count() === 12, '08 계획 달력 12칸');
  await snap('08-exam-dark', false);
  await page.click('#theme-btn');
  await sleep(200);

  // ---------- 09 인쇄: 영어 Unit 4 덱 → 암기카드 양면 미리보기 ----------
  await page.click('#tab-print');
  await sleep(300);
  await page.click('[data-action="print-deck"]:has-text("영어 5학년 Unit 4 단어")');
  await sleep(300);
  await page.click('[data-action="print-preview"]');
  await sleep(500);
  expect(await page.locator('#print-area .page').count() === 4, '09 인쇄 페이지 4장(앞 2+뒤 2)');
  await setVp(1280, 1250);
  await act(() => { document.getElementById('print-view').scrollTo(0, 0); });
  await snap('09-print-preview', false);
  await page.click('[data-action="print-back"]');
  await sleep(300);
  await setVp(1280, 800);

  // ---------- 10 교사 모드: 설정에서 켠 뒤 샘플 학급 6명 ----------
  await page.click('#tab-settings');
  await sleep(300);
  await page.click('input[data-action="set-teacher"]');
  await sleep(300);
  await page.click('#tab-teacher');
  await sleep(300);
  await page.click('[data-action="teacher-sample"]');
  await sleep(400);
  expect(await page.locator('#student-list tbody tr').count() === 6, '10 학생 6명');
  expect((await page.locator('#point-cards .point-card').first().textContent()).includes('분수의 덧셈과 뺄셈'), '10 복습 포인트 1위 분수의 덧셈과 뺄셈');
  await setVp(1280, 1450);
  await act(() => window.scrollTo(0, 0));
  await snap('10-teacher', false);
  await setVp(1280, 800);

  // ---------- 11 도움말 모달 ----------
  await page.click('#tab-home');
  await sleep(200);
  await page.click('[data-action="help"]');
  await sleep(300);
  expect(await page.locator('.modal .help-steps').count() === 1, '11 도움말 모달');
  await snap('11-help', false);
  await page.keyboard.press('Escape');
  await sleep(200);
};
