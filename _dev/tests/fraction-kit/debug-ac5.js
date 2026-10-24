module.exports = async ({ page, expect, log }) => {
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  await act('kitSetD', 4); await act('kitSetN', 0);
  for (let i = 0; i < 7; i++) await page.click('[data-action=kit-n][data-delta="1"]');
  const info = await page.evaluate(() => ({ st: window.__app.getState().kit, frames: document.querySelectorAll('.kit-bar .bar-frame').length, cf: document.querySelectorAll('.kit-circle .circle-frame').length, ints: [...document.querySelectorAll('.kit-line .tick-label.int')].map(e => e.textContent), vb: document.querySelector('.kit-bar').getAttribute('viewBox') }));
  log(JSON.stringify(info));
  expect(true, 'x');
};
