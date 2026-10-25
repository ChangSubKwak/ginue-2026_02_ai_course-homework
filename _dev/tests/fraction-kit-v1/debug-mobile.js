module.exports = async ({ page, expect, shot, log }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const c = document.querySelector('#kit-ctrl'), b = c.querySelector('.ctrl-body');
    const r = c.getBoundingClientRect();
    return { ctrlH: r.height, top: r.top, bodyDisplay: getComputedStyle(b).display, ctrlPos: getComputedStyle(c).position, cls: c.className, children: [...c.children].map(x => x.className + ':' + x.getBoundingClientRect().height) };
  });
  log(JSON.stringify(info));
  await page.screenshot({ path: require('path').join(__dirname, 'out', 'mobile-viewport.png') });
  expect(true, 'debug');
};
