module.exports = async ({ page, expect, shot, sleep, log }) => {
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  await page.click('#more-menu summary'); await sleep(150);
  const r = await page.evaluate(() => { const m = document.querySelector('.more-list').getBoundingClientRect(), b = document.querySelector('#more-menu summary').getBoundingClientRect(); return { menu: [m.left, m.right, m.width], summary: [b.left, b.right], cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, firstBtn: document.querySelector('.more-list .tb').getBoundingClientRect().left }; });
  log(JSON.stringify(r));
  await page.screenshot({ path: require('path').join(__dirname, 'qa-out', 'mobile-more-menu.png'), fullPage: false });
  expect(true, 'debug');
};