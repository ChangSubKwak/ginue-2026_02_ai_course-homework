// ux-mute.js — 음소거 저장: 디바운스(300ms) 전/후 새로고침 비교
'use strict';
module.exports = async ({ page, expect, log, sleep, reload }) => {
  await page.click('.app-header [data-action="toggle-mute"]'); await sleep(80);
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  const a = await page.evaluate(() => window.__app.getState().muted);
  log('reload 80ms after toggle → muted=' + a);
  // fix-r1: 첫 토글이 pagehide flush로 이미 저장되므로 두 번째 토글은 반대 값(!a)이 유지되어야 한다
  await page.click('.app-header [data-action="toggle-mute"]'); await sleep(700);
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  const b = await page.evaluate(() => window.__app.getState().muted);
  log('reload 700ms after toggle → muted=' + b);
  expect(b === !a, '700ms 뒤 새로고침하면 토글 결과 유지');
  expect(a === true, '80ms 뒤 새로고침해도 음소거 유지(pagehide flush)');
  // 설정 화면 저장 상태 표기
  await page.evaluate(() => window.__app.actions.showView('settings')); await sleep(300);
  log('save-status: ' + (await page.evaluate(() => document.getElementById('save-status').textContent)));
};
