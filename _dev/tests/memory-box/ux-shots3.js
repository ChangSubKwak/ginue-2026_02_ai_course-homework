// ux-shots3.js — ux-shots2.js에서 중단된 나머지 확인: 400px 카드 모달 푸터, 덱 상세 버튼 줄바꿈, 인쇄 제목 줄(덱 여러 개) 충돌, 태블릿 820 홈
'use strict';
const path = require('path');
const OUT = 'C:\\Users\\parad\\AppData\\Local\\Temp\\claude\\D--workspace-ginue-2026-02-ai-course-homework\\1716854d-9f4f-4d06-ba55-fb3e97031963\\scratchpad\\tests\\memory-box\\shots2';

module.exports = async ({ page, expect, log, sleep, reload }) => {
  const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
  const shots = [];
  const vshot = async (name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p, fullPage: false }); shots.push(p); return p; };
  const resample = async () => { await page.evaluate(() => { window.__app.actions.resample(); window.__app.actions.setView('home'); }); await sleep(200); };
  const esc = async () => { await page.keyboard.press('Escape'); await sleep(250); };
  const tab = async (v) => { await page.click(`#tab-${v}`); await sleep(250); };
  const toDecks = async () => { await tab('cards'); const b = await page.$('[data-action="back-decks"]'); if (b) { await b.click(); await sleep(200); } };
  const measure = (sels) => page.evaluate((sels) => {
    const out = {}; sels.forEach(s => { const el = document.querySelector(s); if (!el) { out[s] = null; return; } const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); out[s] = { font: cs.fontSize, w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 24) }; }); return out;
  }, sels);

  // ===== B(계속). 모바일 400 =====
  await page.setViewportSize({ width: 400, height: 860 });
  await reload(); await resample(); await reload();
  await toDecks(); await page.click('.deck-card:has-text("수학 오답노트")'); await sleep(300);
  const hb = await page.evaluate(() => [...document.querySelectorAll('#view-cards .btn')].slice(0, 8).map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), x: Math.round(r.left), y: Math.round(r.top), h: Math.round(r.height) }; }));
  log('[B7 deck head btns 400] ' + JSON.stringify(hb));
  await page.click('[data-action="new-card"]'); await sleep(300);
  const mf = await page.evaluate(() => { const f = document.querySelector('.modal-foot'); const m = document.querySelector('.modal'); const r = f.getBoundingClientRect(); const body = document.querySelector('.modal-body'); return { footBottom: Math.round(r.bottom), innerH: innerHeight, modalH: Math.round(m.getBoundingClientRect().height), bodyScroll: body.scrollHeight, bodyClient: body.clientHeight }; });
  log('[B6 card modal 400] ' + JSON.stringify(mf));
  expect(mf.footBottom <= mf.innerH, `B6: 카드 모달 푸터가 화면 안(${mf.footBottom}/${mf.innerH})`);
  await page.click('.modal [data-type="wrong"]'); await sleep(200);
  const mf2 = await page.evaluate(() => { const body = document.querySelector('.modal-body'); return { bodyScroll: body.scrollHeight, bodyClient: body.clientHeight }; });
  log('[B6 card modal wrong 400] ' + JSON.stringify(mf2));
  await esc();
  // 카드 목록 행: 400px에서 FAB이 행의 배지를 가리는지
  const rows = await page.evaluate(() => { const fab = document.querySelector('.fab').getBoundingClientRect(); const hit = [...document.querySelectorAll('.card-row .badge')].filter(b => { const r = b.getBoundingClientRect(); return r.right > fab.left && r.left < fab.right && r.bottom > fab.top && r.top < fab.bottom; }).map(b => b.textContent.trim()); return { fabLeft: Math.round(fab.left), hit }; });
  log('[B8 fab over badges 400] ' + JSON.stringify(rows));

  // ===== A(추가). 데스크톱 1280: 덱 5개 선택 시 인쇄 제목 줄 =====
  await page.setViewportSize({ width: 1280, height: 800 });
  await reload(); await sleep(300);
  await tab('print');
  for (const n of ['받아쓰기', '영어', '사회', '과학', '수학']) { await page.click(`[data-action="print-deck"]:has-text("${n}")`); await sleep(80); }
  await page.click('[data-action="print-preview"]'); await sleep(600);
  const pt = await page.evaluate(() => { const t = document.querySelector('.page-title'); const [b, s] = [...t.children].map(k => k.getBoundingClientRect()); const pr = document.querySelector('.page').getBoundingClientRect(); return { pageW: Math.round(pr.width), bLeft: Math.round(b.left), bRight: Math.round(b.right), bH: Math.round(b.height), sLeft: Math.round(s.left), sRight: Math.round(s.right), sH: Math.round(s.height), pageRight: Math.round(pr.right), overlap: Math.round(b.right - s.left), titleLen: t.children[0].textContent.length }; });
  log('[A7 title all decks screen] ' + JSON.stringify(pt));
  expect(pt.overlap <= 0 && pt.sRight <= pt.pageRight, `A7: 덱 5개 선택 시 인쇄 제목과 학급 정보가 겹치지 않음(겹침 ${pt.overlap}px, 오른쪽 넘침 ${pt.sRight - pt.pageRight}px)`);
  await vshot('d2-print-title-all-decks');
  await page.emulateMedia({ media: 'print' }); await sleep(300);
  const ptp = await page.evaluate(() => { const t = document.querySelector('.page-title'); const [b, s] = [...t.children].map(k => k.getBoundingClientRect()); const pr = document.querySelector('.page').getBoundingClientRect(); return { pageW: Math.round(pr.width), bRight: Math.round(b.right), sLeft: Math.round(s.left), sRight: Math.round(s.right), pageRight: Math.round(pr.right), bH: Math.round(b.height), sH: Math.round(s.height) }; });
  log('[A7 title all decks print] ' + JSON.stringify(ptp));
  await vshot('d2-print-title-all-decks-media');
  await page.emulateMedia({ media: 'screen' }); await sleep(200);
  await page.click('[data-action="print-back"]'); await sleep(200);

  // 긴 앞면 카드의 인쇄 카드 글자 축소 확인(받아쓰기 덱)
  for (const n of ['영어', '사회', '과학', '수학']) { await page.click(`[data-action="print-deck"]:has-text("${n}")`); await sleep(80); }
  await page.click('[data-action="print-preview"]'); await sleep(500);
  const pc = await page.evaluate(() => [...document.querySelectorAll('.pcard .pc-text')].slice(0, 8).map(e => ({ cls: e.className, fs: getComputedStyle(e).fontSize, t: e.textContent.trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height), sh: e.scrollHeight })));
  log('[A8 pcard text sizes] ' + JSON.stringify(pc));
  await vshot('d2-print-cards-long-front');
  await page.click('[data-action="print-back"]'); await sleep(200);

  // ===== C. 태블릿 820 =====
  await page.setViewportSize({ width: 820, height: 1100 });
  await reload(); await sleep(300);
  log('[C1 tablet home] ' + JSON.stringify(await measure(['.review-btn', '.box b', '.box .box-gap', '.tab[aria-selected="true"]', '.tagline'])));
  const hero = await page.evaluate(() => ({ cols: getComputedStyle(document.querySelector('.hero')).gridTemplateColumns, tabsPos: getComputedStyle(document.querySelector('.tabs')).position }));
  log('[C1 hero 820] ' + JSON.stringify(hero));
  // 820 세션 요약 모달
  await page.click('.review-btn'); await sleep(400);
  let guard = 0;
  while (guard++ < 40) { const open = await page.evaluate(() => !document.getElementById('session').hidden && !!document.getElementById('flip-btn')); if (!open) break; await page.click('[data-action="conf"][data-c="3"]'); await page.click('#flip-btn'); await sleep(450); await page.click('[data-action="grade"][data-ok="1"]'); await sleep(550); }
  await sleep(500); await vshot('t2-summary'); const skip = await page.$('.modal button:has-text("건너뛰기")'); if (skip) await skip.click(); await sleep(300);
  await tab('history'); await page.click('[data-action="weekly-report"]'); await sleep(400); await vshot('t2-weekly-report'); await page.click('[data-action="print-back"]'); await sleep(200);
  log('SHOTS=' + JSON.stringify(shots));
};
