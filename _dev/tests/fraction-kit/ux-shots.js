// ux-shots.js — 분수교구함 UX 리뷰용 전 화면 촬영 모듈 (pw-run.js로 실행)
// 데스크톱 1280 라이트/다크(뷰포트·전체), 1280x720 폴드, 1920, 태블릿 820, 모바일 400, 큰 글씨, 모달·토스트·애니메이션, 인쇄 미디어
'use strict';
const path = require('path');
const OUT = 'D:/workspace/ginue-2026_02_ai_course-homework/_dev/tests/fraction-kit/ux';

module.exports = async ({ page, expect, shot, log, sleep }) => {
  const vp = async (name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p, fullPage: false }); return p; };
  const set = async (n, d) => { await page.evaluate(([n, d]) => window.__app.actions.setFraction(n, d), [n, d]); await sleep(150); };
  const theme = async (t) => { await page.evaluate(t => { document.documentElement.dataset.theme = t; }, t); await sleep(100); };
  const size = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await sleep(250); };
  const metrics = {};

  // ---- 데스크톱 1280x800 라이트 ----
  await size(1280, 800);
  await theme('light');
  await vp('d-1280-initial-fold');
  metrics.pageHeight1280 = await page.evaluate(() => document.documentElement.scrollHeight);
  metrics.lineTop1280 = await page.evaluate(() => document.querySelector('#model-line').getBoundingClientRect().top);
  await shot('d-1280-initial-full');
  // 폴드 1280x720(프로젝터)
  await size(1280, 720); await vp('d-1280x720-fold');
  await size(1280, 800);

  // 가분수 7/4
  await set(7, 4); await shot('d-1280-improper');
  // 분모 12, 분자 11 (수직선 라벨 밀도)
  await set(11, 12); await shot('d-1280-d12');
  // 분모 12 가분수 (23/12) 라벨 밀도 최고
  await set(23, 12); await shot('d-1280-d12-improper');
  // 분모 1, 분자 0·1·2
  await set(0, 1); await shot('d-1280-d1-n0');
  await set(2, 1); await shot('d-1280-d1-n2');
  // 분자 0, 분모 5
  await set(0, 5); await shot('d-1280-n0');
  // 분자 = 분모
  await set(5, 5); await shot('d-1280-whole');
  // 분모 7(유한소수 아님) 가분수 10/7
  await set(10, 7); await shot('d-1280-10-7');

  // 동치 사슬 6개 채우기
  await set(1, 2);
  for (const a of ['split', 2, 'split', 3, 'reduce', null, 'split', 2, 'split', 2, 'reduce', null]) { /* 아래 루프에서 처리 */ }
  const seq = [['split', 2], ['split', 3], ['reduce'], ['split', 2], ['split', 2], ['reduce']];
  for (const [fn, k] of seq) { await page.evaluate(([fn, k]) => window.__app.actions[fn](k), [fn, k]); await sleep(400); }
  const chainLen = await page.evaluate(() => window.__app.getState().chain.length);
  log('chain length ' + chainLen);
  await shot('d-1280-chain6');

  // 쪼개기 애니메이션 중간 프레임(2/3 → ×2)
  await set(2, 3);
  await page.click('[data-action="split2"]'); await sleep(120); await vp('d-1280-split-anim');
  await sleep(500); await shot('d-1280-split-after');
  // 합치기 애니메이션 중간
  await page.click('[data-action="reduce"]'); await sleep(120); await vp('d-1280-merge-anim');
  await sleep(500);

  // 칸 hover 상태
  await set(3, 4);
  await page.hover('#svg-bar .cell[data-i="3"]'); await sleep(200); await vp('d-1280-cell-hover');
  await page.mouse.move(0, 0);
  // 칩 포커스 링(키보드)
  await page.focus('#chips .chip[data-n="2"][data-d="5"]'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await sleep(100);
  await vp('d-1280-focus-chip');
  // 막대 칸에 키보드 포커스 가능 여부
  metrics.cellTabbable = await page.evaluate(() => { const c = document.querySelector('#svg-bar .cell'); return c.tabIndex >= 0 || c.hasAttribute('tabindex'); });

  // 소수·읽기 숨김
  await page.evaluate(() => { window.__app.actions.setShow('decimal', false); window.__app.actions.setShow('reading', false); }); await sleep(150);
  await shot('d-1280-hide-dec-read');
  await page.evaluate(() => { window.__app.actions.setShow('decimal', true); window.__app.actions.setShow('reading', true); });
  // 원만 보기
  await page.evaluate(() => { window.__app.actions.toggleModel('bar'); window.__app.actions.toggleModel('line'); }); await sleep(150);
  await shot('d-1280-circle-only');
  // 마지막 모델 끄기 시도 → 토스트
  await page.click('[data-model="circle"]'); await sleep(300); await vp('d-1280-toast-warn');
  await page.evaluate(() => { window.__app.actions.toggleModel('bar'); window.__app.actions.toggleModel('line'); }); await sleep(2800);

  // 도움말 모달 / 초기화 모달
  await page.click('[data-action="help"]'); await sleep(300); await vp('d-1280-help');
  metrics.helpScroll = await page.evaluate(() => { const b = document.querySelector('.modal-body'); return { sh: b.scrollHeight, ch: b.clientHeight }; });
  await page.keyboard.press('Escape'); await sleep(200);
  await page.click('[data-action="reset"]'); await sleep(300); await vp('d-1280-reset-modal');
  await page.keyboard.press('Escape'); await sleep(200);

  // ---- 데스크톱 1280 다크 ----
  await theme('dark');
  await set(3, 4); await vp('d-1280-dark-fold'); await shot('d-1280-dark-full');
  await set(7, 4); await shot('d-1280-dark-improper');
  await set(2, 3); await page.click('[data-action="split2"]'); await sleep(120); await vp('d-1280-dark-split-anim'); await sleep(500);
  await shot('d-1280-dark-split-after');
  await page.click('[data-action="help"]'); await sleep(300); await vp('d-1280-dark-help'); await page.keyboard.press('Escape'); await sleep(200);
  await page.click('[data-action="reset"]'); await sleep(300); await vp('d-1280-dark-reset-modal'); await page.keyboard.press('Escape'); await sleep(200);
  await page.evaluate(() => window.__app.actions.toggleModel('circle')); await page.evaluate(() => window.__app.actions.toggleModel('bar')); await sleep(100);
  await page.click('[data-model="line"]'); await sleep(300); await vp('d-1280-dark-toast');
  await page.evaluate(() => { window.__app.actions.toggleModel('bar'); window.__app.actions.toggleModel('circle'); }); await sleep(2800);

  // ---- 큰 글씨 모드(라이트) ----
  await theme('light'); await set(3, 4);
  await page.click('[data-action="big"]'); await sleep(300);
  await vp('d-1280-big-fold'); await shot('d-1280-big-full');
  metrics.pageHeightBig = await page.evaluate(() => document.documentElement.scrollHeight);
  metrics.bigLineTop = await page.evaluate(() => document.querySelector('#model-line').getBoundingClientRect().top);
  metrics.bigBarTop = await page.evaluate(() => document.querySelector('#model-bar').getBoundingClientRect().top);
  await set(7, 4); await shot('d-1280-big-improper');
  await set(3, 4);
  // 1920x1080 큰 글씨(전자칠판)
  await size(1920, 1080); await vp('d-1920-big-fold'); await shot('d-1920-big-full');
  metrics.bigLineTop1920 = await page.evaluate(() => document.querySelector('#model-line').getBoundingClientRect().bottom);
  await page.click('[data-action="big"]'); await sleep(300);
  await vp('d-1920-fold'); await shot('d-1920-full');
  metrics.pageHeight1920 = await page.evaluate(() => document.documentElement.scrollHeight);

  // ---- 태블릿 820 ----
  await size(820, 1180); await set(3, 4); await shot('t-820-initial'); await vp('t-820-fold');
  await set(7, 4); await shot('t-820-improper');
  await set(11, 12); await shot('t-820-d12');
  await page.click('[data-action="help"]'); await sleep(300); await vp('t-820-help'); await page.keyboard.press('Escape'); await sleep(200);
  // 가로 태블릿 1180x820 (860 초과 → 2열)
  await size(1180, 820); await set(3, 4); await vp('t-1180-fold'); await shot('t-1180-full');
  // 900px(2열 경계 직후): 좌 300 + 우
  await size(900, 800); await shot('d-900-initial');

  // ---- 모바일 400 ----
  await size(400, 800); await theme('light'); await set(3, 4);
  await vp('m-400-fold'); await shot('m-400-initial');
  metrics.overflow400 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  metrics.smallButtons400 = await page.evaluate(() => [...document.querySelectorAll('button, label')].filter(b => b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 12), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.w < 44 || x.h < 44));
  metrics.fontSizes400 = await page.evaluate(() => {
    const pick = s => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); return { s, fs: cs.fontSize, color: cs.color, bg: cs.backgroundColor }; };
    return ['.hint', '.sym-item small', '.app-footer', '.tagline', '.stepper-name', '.model figcaption', '.cap-sum', '.chain .empty', '.toggles-label', '.tb.small', '.chip', '.btn.primary', '.sym-item b', '.chain .term'].map(pick);
  });
  await set(7, 4); await shot('m-400-improper');
  await set(11, 12); await shot('m-400-d12');
  await set(23, 12); await shot('m-400-d12-improper');
  await set(10, 7); await shot('m-400-10-7');
  // 사슬 6개
  await set(1, 2);
  for (const [fn, k] of seq) { await page.evaluate(([fn, k]) => window.__app.actions[fn](k), [fn, k]); await sleep(350); }
  await shot('m-400-chain6');
  await set(3, 4);
  await page.click('[data-action="help"]'); await sleep(300); await vp('m-400-help');
  metrics.helpScroll400 = await page.evaluate(() => { const b = document.querySelector('.modal-body'); return { sh: b.scrollHeight, ch: b.clientHeight }; });
  await page.keyboard.press('Escape'); await sleep(200);
  await page.click('[data-action="reset"]'); await sleep(300); await vp('m-400-reset-modal'); await page.keyboard.press('Escape'); await sleep(200);
  await page.evaluate(() => { window.__app.actions.toggleModel('circle'); window.__app.actions.toggleModel('bar'); }); await sleep(100);
  await page.click('[data-model="line"]'); await sleep(300); await vp('m-400-toast');
  await page.evaluate(() => { window.__app.actions.toggleModel('bar'); window.__app.actions.toggleModel('circle'); }); await sleep(2800);
  // 모바일 다크
  await theme('dark'); await shot('m-400-dark'); await theme('light');
  // 모바일 큰 글씨
  await page.click('[data-action="big"]'); await sleep(300); await shot('m-400-big');
  metrics.overflow400big = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  metrics.wide400big = await page.evaluate(() => { const de = document.documentElement, out = []; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.right > de.clientWidth + 2 && getComputedStyle(el).position !== 'fixed') out.push((el.className || el.tagName).toString().slice(0, 40)); } return out.slice(0, 10); });
  await page.click('[data-action="big"]'); await sleep(300);
  // 모바일 가로 360
  await size(360, 740); await shot('m-360-initial');
  metrics.overflow360 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // ---- 인쇄 미디어 ----
  await size(794, 1123); await theme('light'); await set(3, 4);
  await page.emulateMedia({ media: 'print' }); await sleep(200); await shot('p-print-light');
  await theme('dark'); await sleep(100); await shot('p-print-dark');
  await page.emulateMedia({ media: 'screen' }); await theme('light');

  // ---- 대비 측정용 계산 색 ----
  await size(1280, 800);
  metrics.colors = await page.evaluate(() => {
    const g = s => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); return { s, color: cs.color, bg: cs.backgroundColor, fs: cs.fontSize, fw: cs.fontWeight }; };
    return ['.cap-sum', '.chip[aria-pressed="true"]', '.btn.primary', '.chain .term.last', '.stepper output', '.sym-big', '.tagline', '.hint', '.sym-item small', '.tick-label', '.cell-label', '.pt-label', '.toast', '.model figcaption', '.chain .empty', 'button:disabled'].map(g);
  });
  log(JSON.stringify(metrics));
  expect(true, 'ux shots done');
};
