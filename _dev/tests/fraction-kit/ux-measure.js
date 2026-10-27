// ux-measure.js — UX 리뷰 보조 측정: 1열 레이아웃에서 쪼개기 패널 위치, 400px 수직선 라벨 겹침, 색 대비
'use strict';
module.exports = async ({ page, expect, log, sleep }) => {
  const set = async (n, d) => { await page.evaluate(([n, d]) => window.__app.actions.setFraction(n, d), [n, d]); await sleep(120); };
  const out = {};
  for (const [w, h] of [[820, 1180], [400, 800], [1180, 820], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(200); await set(3, 4);
    out['layout_' + w] = await page.evaluate(() => {
      const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { top: Math.round(b.top + scrollY), bottom: Math.round(b.bottom + scrollY) }; };
      return { equiv: r('.panel-equiv'), bar: r('#model-bar'), circle: r('#model-circle'), line: r('#model-line'), page: document.documentElement.scrollHeight, vh: innerHeight };
    });
  }
  // 400px 수직선 라벨 겹침
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(200);
  for (const [n, d] of [[11, 12], [23, 12], [7, 8], [9, 10], [5, 6]]) {
    await set(n, d);
    out['labels400_' + n + '_' + d] = await page.evaluate(() => {
      const ls = [...document.querySelectorAll('#svg-line .tick-label:not(.int)')].map(t => t.getBoundingClientRect());
      let overlaps = 0; for (let i = 1; i < ls.length; i++) if (ls[i].left < ls[i - 1].right - 1) overlaps++;
      return { count: ls.length, overlaps, fontPx: ls[0] ? Math.round(ls[0].height) : 0, sampleW: ls[0] ? Math.round(ls[0].width) : 0 };
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(200);
  for (const [n, d] of [[11, 12], [23, 12]]) {
    await set(n, d);
    out['labels1280_' + n + '_' + d] = await page.evaluate(() => {
      const ls = [...document.querySelectorAll('#svg-line .tick-label:not(.int)')].map(t => t.getBoundingClientRect());
      let overlaps = 0; for (let i = 1; i < ls.length; i++) if (ls[i].left < ls[i - 1].right - 1) overlaps++;
      return { count: ls.length, overlaps, fontPx: ls[0] ? Math.round(ls[0].height) : 0 };
    });
  }
  // 색 대비
  const lum = c => { const [r, g, b] = c.match(/\d+/g).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return ((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)).toFixed(2); };
  await set(3, 4);
  await page.evaluate(() => { window.__app.actions.split(2); });
  await sleep(100);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme); await sleep(100);
    const pairs = await page.evaluate(() => {
      const cs = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : { color: 'rgb(0, 0, 0)', backgroundColor: 'rgb(0, 0, 0)', missing: s }; };
      const root = getComputedStyle(document.documentElement);
      const v = k => root.getPropertyValue(k).trim();
      const el = document.createElement('div'); document.body.appendChild(el);
      const toRgb = c => { el.style.color = c; return getComputedStyle(el).color; };
      const res = {
        'btn.primary(white on accent)': [cs('.btn.primary').color, cs('.btn.primary').backgroundColor],
        'chip pressed': [cs('.chip[aria-pressed="true"]').color, cs('.chip[aria-pressed="true"]').backgroundColor],
        'cap-sum(accent on surface)': [cs('.cap-sum').color, cs('.model').backgroundColor],
        'chain term.last(accent on accent-soft)': [cs('.chain .term.last').color, cs('.chain .term.last').backgroundColor],
        'fg-muted on surface': [cs('.hint').color, cs('.panel').backgroundColor],
        'fg-muted on bg': [cs('.tagline').color, cs('body').backgroundColor],
        'chain empty on surface': [toRgb(v('--fg-muted')), toRgb(v('--surface'))],
        'cell-label unfilled(fg-muted on model-bg)': [toRgb(v('--fg-muted')), toRgb(v('--model-bg'))],
        'cell-label filled(fill-fg on fill)': [toRgb(v('--fill-fg')), toRgb(v('--fill'))],
        'danger btn(white on danger)': ['rgb(255, 255, 255)', toRgb(v('--danger'))],
        'tick-label(fg-muted on surface)': [toRgb(v('--fg-muted')), toRgb(v('--surface'))],
        'accent on surface (stepper output)': [cs('.stepper output').color, cs('.panel').backgroundColor],
        'disabled btn text(approx 40%)': [cs('button:disabled').color, cs('button:disabled').backgroundColor],
        'fill-new on model-bg': [toRgb(v('--fill-new')), toRgb(v('--model-bg'))],
        'fill-new on fill': [toRgb(v('--fill-new')), toRgb(v('--fill'))],
        'div on fill': [toRgb(v('--div')), toRgb(v('--fill'))],
      };
      el.remove(); return res;
    });
    out['contrast_' + theme] = Object.fromEntries(Object.entries(pairs).map(([k, [a, b]]) => [k, ratio(a, b) + ' (' + a + ' / ' + b + ')']));
  }
  log(JSON.stringify(out, null, 1));
  expect(true, 'measured');
};
