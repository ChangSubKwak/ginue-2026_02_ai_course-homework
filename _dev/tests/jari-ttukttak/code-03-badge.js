// code-03-badge.js — 초기 샘플 상태에서 양은우 편중 주의 배지·히스토리 카드 확인(AC9 보조)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  while (await page.locator('.modal-back').count()) { await page.keyboard.press('Escape'); await sleep(150); }
  await page.click('[data-tab=history]'); await sleep(200);
  const badges = await page.locator('#fairness .zrow.is-bad').allInnerTexts(); log('biased rows: ' + JSON.stringify(badges));
  expect(badges.length === 1 && badges[0].includes('양은우') && badges[0].includes('편중 주의'), 'AC9 초기 상태 양은우 편중 주의 배지');
  expect(await page.locator('#hist-list .hist-card.kind-seat').count() === 4, 'AC1 히스토리 자리 카드 4건');
  await shot('ac9-initial-history');
  await page.click('#theme-btn'); await sleep(200); await shot('ac9-history-dark');
};
