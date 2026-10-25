// 기억상자 설명서용 스크린샷 07(기록 탭)만 다시 찍는 모듈 (pw-run.js용)
// node _dev/tools/pw-run.js <index.html> _dev/docshots/memory-box-07.js <docs/screens>
// 다른 11장과 같은 날짜(2026-10-25) 기준으로 샘플을 다시 심은 뒤, 망각 예측 x축 라벨까지 들어가도록 세로를 넉넉히(1620px) 잡아 촬영한다.
'use strict';
const path = require('path');
module.exports = async ({ page, expect, sleep, log, reload }) => {
  const outdir = process.argv[4] || path.join(__dirname, 'out');
  const snap = async (name) => {
    await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    await page.waitForTimeout(400);
    const p = path.join(outdir, name + '.png');
    await page.screenshot({ path: p, fullPage: false });
    log('shot ' + p);
  };
  // 기존 촬영일(2026-10-25 일요일)로 고정하고 샘플을 다시 심는다(월요일에 찍으면 '이번 주 복습'이 0장이 된다)
  await page.clock.setFixedTime(new Date(2026, 9, 25, 10, 0, 0));
  await page.evaluate(() => localStorage.clear());
  await reload();
  await sleep(500);
  const st = await page.evaluate(() => window.__app.getState());
  expect(st.today === '2026-10-25', '07 기준일 2026-10-25');
  expect(st.queue.length === 11, '07 오늘 큐 11장');
  expect(st.streak === 6, '07 스트릭 6');
  await page.click('#tab-history');
  await sleep(300);
  await page.click('#forecast-toggle');
  await sleep(300);
  expect(await page.locator('.cal-cell.g1, .cal-cell.g2, .cal-cell.g3, .cal-cell.g4').count() >= 30, '07 잔디 달력 채워진 셀 30+');
  expect(st.forecast.noR[7] > st.forecast.withR[7], '07 망각 예측 두 선이 다름');
  log('forecast ' + st.forecast.noR[7] + ' vs ' + st.forecast.withR[7]);
  await page.setViewportSize({ width: 1280, height: 1620 });
  await sleep(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap('07-history');
};
