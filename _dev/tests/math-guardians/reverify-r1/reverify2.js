// reverify-r1/reverify2.js — 보충 확인: AC15 .txt 파일 → '형식이 맞지 않는 파일입니다' 모달·데이터 불변, U-04 히트맵 칸 글자색 실측
'use strict';
module.exports = async ({ page, expect, shot, log, sleep }) => {
  await page.waitForSelector('#stage-grid .stage-card');
  await page.evaluate(() => window.__app.MG.UI.showView('settings')); await sleep(200);
  const before = await page.evaluate(() => JSON.stringify(window.__app.MG.root.profiles.map(p => p.name)));
  await page.setInputFiles('#json-file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello world 임의 텍스트') }); await sleep(400);
  const modal = await page.locator('.modal').count() ? await page.locator('.modal').innerText() : '';
  log('txt modal: ' + modal.replace(/\s+/g, ' ').slice(0, 120));
  expect(/형식이 맞지 않는 파일입니다/.test(modal), 'AC15 .txt 파일 선택 → 형식 불일치 모달');
  await shot('rv2-txt-modal');
  if (await page.locator('.modal [data-m]').count()) await page.click('.modal [data-m]');
  await sleep(200);
  // .json 확장자이지만 내용이 텍스트인 파일
  await page.setInputFiles('#json-file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('hello world') }); await sleep(400);
  const modal2 = await page.locator('.modal').count() ? await page.locator('.modal').innerText() : '';
  expect(/형식이 맞지 않는 파일입니다/.test(modal2), 'AC15 손상 .json → 형식 불일치 모달');
  if (await page.locator('.modal [data-m]').count()) await page.click('.modal [data-m]');
  const after = await page.evaluate(() => JSON.stringify(window.__app.MG.root.profiles.map(p => p.name)));
  expect(before === after && await page.locator('.modal').count() === 0, 'AC15 잘못된 파일 후 데이터 불변');
  // U-04
  await page.evaluate(() => { window.__app.actions.setActive('p_sample05'); window.__app.MG.UI.showView('codex'); }); await sleep(300);
  const cx = await page.evaluate(() => { const cs = e => e ? getComputedStyle(e).color : null; return { c1: cs(document.querySelector('.hm-cell.box-1')), c2: cs(document.querySelector('.hm-cell.box-2')), c0: cs(document.querySelector('.hm-cell.box-0')), c3: cs(document.querySelector('.hm-cell.box-3')), l1: cs(document.querySelector('.legend .box-1')), l2: cs(document.querySelector('.legend .box-2')), px: parseFloat(getComputedStyle(document.querySelector('.hm-cell.box-2')).fontSize), w: parseFloat(getComputedStyle(document.querySelector('.hm-cell.box-2')).fontWeight) }; });
  log('heatmap ' + JSON.stringify(cx));
  expect(cx.c1 === 'rgb(29, 33, 64)' && cx.c2 === 'rgb(29, 33, 64)' && cx.l1 === 'rgb(29, 33, 64)' && cx.l2 === 'rgb(29, 33, 64)' && cx.c0 === 'rgb(255, 255, 255)' && cx.c3 === 'rgb(255, 255, 255)' && cx.px >= 15 && cx.w >= 700, `U-04 주황·연두 칸/범례 어두운 글자(#1d2140), 빨강·초록 흰 글자, ${cx.px}px bold`);
};
