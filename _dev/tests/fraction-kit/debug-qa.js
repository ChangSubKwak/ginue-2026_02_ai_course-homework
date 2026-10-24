// debug-qa.js — 카드 탭 실패 항목 원인 확인용(c5-08 수직선 라벨, 카드 전부 삭제 후 샘플 복원)
module.exports = async ({ page, expect, log, sleep }) => {
  const S = () => page.evaluate(() => window.__app.getState());
  await page.click('.tabs [data-tab=cards]'); await sleep(200);
  await page.click('[data-pick="c5-08"]'); await sleep(200);
  const info = await page.evaluate(() => ({ pts: document.querySelectorAll('#card-stage .kit-line .pt').length, labels: [...document.querySelectorAll('#card-stage .kit-line .pt-label')].map(e => e.textContent), ticks: document.querySelectorAll('#card-stage .kit-line .tick').length, circleHidden: document.querySelector('#card-stage .model[data-model=circle]').hidden, chain: document.querySelector('#card-stage .kit-chain').textContent }));
  log('c5-08: ' + JSON.stringify(info));
  await page.evaluate(() => { const a = window.FK.app; a.db.cards = []; a.db.cardSets.forEach(s => s.cardIds = []); a.saveDb(); a.state.currentCardId = null; window.FK.cards.render(); });
  await sleep(100);
  log('empty list html: ' + (await page.evaluate(() => document.querySelector('#card-list').innerHTML)).slice(0, 300));
  await page.click('#card-list [data-action=reset-samples]'); await sleep(200);
  log('modal count after click: ' + await page.locator('.modal[role=dialog]').count() + ' text=' + (await page.locator('.modal').count() ? await page.locator('.modal').innerText() : '-'));
  if (await page.locator('.modal-foot .btn.primary').count()) await page.click('.modal-foot .btn.primary');
  await sleep(300);
  log('after restore counts: ' + JSON.stringify((await S()).counts) + ' listItems=' + await page.locator('#card-list .card-item').count() + ' toasts=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent))));
  expect(true, 'debug');
};
