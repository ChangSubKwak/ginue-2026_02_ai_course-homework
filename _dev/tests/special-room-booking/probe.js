'use strict';
module.exports = async ({ page, expect, shot, log }) => {
  const t0 = Date.now();
  log('loaded ' + (await page.title()));
  await page.setViewportSize({ width: 1280, height: 900 }); log('vp ' + (Date.now() - t0));
  const n = await page.locator('.modal-backdrop').count(); log('modal ' + n + ' ' + (Date.now() - t0));
  await shot('probe'); log('shot ' + (Date.now() - t0));
  expect(n === 1, 'onboarding');
};
