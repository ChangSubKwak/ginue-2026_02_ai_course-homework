// reverify-r1-probe-chart.js — U-06 수정(.chart min-width 640px) 이후 데스크톱 통계 차트가 카드 안에 들어가는지 측정
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'reverify-r1-probe-chart');
fs.mkdirSync(OUT, { recursive: true });

module.exports = async ({ page, expect, log, sleep }) => {
  await page.locator('[data-result="sample"]').click(); await sleep(500);
  for (const w of [1280, 1920, 1024]) {
    await page.setViewportSize({ width: w, height: 900 }); await sleep(300);
    await page.evaluate(() => window.__app.actions.selectTab('stats')); await sleep(400);
    const r = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[data-view="stats"] .chart-wrap').forEach(wrap => {
        const svg = wrap.querySelector('svg'); const label = svg.getAttribute('aria-label'); const wr = wrap.getBoundingClientRect();
        const texts = Array.from(svg.querySelectorAll('text')).map(t => ({ t: t.textContent, r: t.getBoundingClientRect() }));
        const cut = texts.filter(x => x.r.right > wr.right + 0.5).map(x => `${x.t}(+${Math.round(x.r.right - wr.right)}px)`);
        const rects = Array.from(svg.querySelectorAll('rect.bar')).map(b => b.getBoundingClientRect()).filter(b => b.right > wr.right + 0.5).length;
        out.push({ label, svgW: Math.round(svg.getBoundingClientRect().width), wrapW: Math.round(wr.width), overflow: wrap.scrollWidth - wrap.clientWidth, cutTexts: cut, cutBars: rects, minW: getComputedStyle(svg).minWidth });
      });
      return out;
    });
    log(w + 'px: ' + JSON.stringify(r));
    r.forEach(c => expect(c.cutTexts.length === 0 && c.cutBars === 0, `${w}px: '${c.label}' 차트 내용이 카드 안에 보임(overflow ${c.overflow}px, 잘린 텍스트 ${c.cutTexts.join(', ') || '없음'}, 잘린 막대 ${c.cutBars})`));
    await page.screenshot({ path: path.join(OUT, `stats-${w}.png`), clip: { x: 0, y: 0, width: w, height: 900 } });
  }
};
