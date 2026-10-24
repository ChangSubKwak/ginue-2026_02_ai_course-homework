// ux-shots2.js — 기억상자 UX 리뷰 보강: ux-shots.js 스크린샷에서 발견한 의심 지점을 수치로 확인(대비·겹침·인쇄 폭·정렬 순서)하고 부족한 장면을 추가 촬영
'use strict';
const path = require('path');
const OUT = 'C:\\Users\\parad\\AppData\\Local\\Temp\\claude\\D--workspace-ginue-2026-02-ai-course-homework\\1716854d-9f4f-4d06-ba55-fb3e97031963\\scratchpad\\tests\\memory-box\\shots2';

module.exports = async ({ page, expect, log, sleep, reload }) => {
  const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
  const shots = [];
  const vshot = async (name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p, fullPage: false }); shots.push(p); return p; };
  const fshot = async (name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p, fullPage: true }); shots.push(p); return p; };
  const resample = async () => { await page.evaluate(() => { window.__app.actions.resample(); window.__app.actions.setView('home'); }); await sleep(200); };
  const setTheme = async (t) => { await page.evaluate((t) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }, t); await sleep(150); };
  const esc = async () => { await page.keyboard.press('Escape'); await sleep(250); };
  const tab = async (v) => { await page.click(`#tab-${v}`); await sleep(250); };
  // 색 대비·크기 측정(페이지 컨텍스트)
  const measure = (sels) => page.evaluate((sels) => {
    const lum = (rgb) => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const parse = (s) => { const m = (s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
    const bgOf = (el) => { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.9) return c.rgb; e = e.parentElement; } return [255, 255, 255]; };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)); };
    const out = {};
    sels.forEach(s => { const el = document.querySelector(s); if (!el) { out[s] = null; return; } const cs = getComputedStyle(el); const fg = parse(cs.color); const bg = bgOf(el); const r = el.getBoundingClientRect(); out[s] = { font: cs.fontSize, weight: cs.fontWeight, fg: cs.color, bg: `rgb(${bg.join(',')})`, contrast: fg ? ratio(fg.rgb, bg) : null, w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 24) }; });
    return out;
  }, sels);
  const rect = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);
  const finishQueue = async () => {
    let guard = 0;
    while (guard++ < 40) {
      const open = await page.evaluate(() => !document.getElementById('session').hidden && !!document.getElementById('flip-btn'));
      if (!open) break;
      await page.click('[data-action="conf"][data-c="3"]'); await page.click('#flip-btn'); await sleep(450);
      await page.click('[data-action="grade"][data-ok="1"]'); await sleep(550);
    }
    await sleep(500);
  };

  // ===== A. 데스크톱 1280 =====
  await page.setViewportSize({ width: 1280, height: 800 });
  await reload(); await resample(); await reload(); await setTheme('light');

  // A1. 채점 버튼·배지 대비(라이트/다크)
  await tab('cards'); await page.click('.deck-card:has-text("수학 오답노트")'); await sleep(300);
  log('[A1 badges light] ' + JSON.stringify(await measure(['.badge-repeat', '.badge-wrong', '.badge-late', '.badge-box', '.badge-reason', '.deck-card .small', '.card-row .back'])));
  await setTheme('dark');
  log('[A1 badges dark] ' + JSON.stringify(await measure(['.badge-repeat', '.badge-wrong', '.badge-late', '.badge-box', '.badge-reason'])));
  await setTheme('light');
  await page.click('[data-action="start-deck"]'); await sleep(400);
  await page.click('[data-action="conf"][data-c="3"]'); await page.click('#flip-btn'); await sleep(600);
  log('[A1 grade light] ' + JSON.stringify(await measure(['[data-action="grade"][data-ok="1"]', '[data-action="grade"][data-ok="0"]', '[data-action="hint"]', '.kbd-hint', '.face-tag', '.face-text', '.mini-box', '.mini-box b', '#session .swipe-hint, #session .small.muted'])));
  await setTheme('dark');
  log('[A1 grade dark] ' + JSON.stringify(await measure(['[data-action="grade"][data-ok="1"]', '[data-action="grade"][data-ok="0"]', '.face-text', '.mini-box'])));
  await vshot('d2-session-flipped-dark');
  await setTheme('light');
  await esc(); await sleep(300);
  // 홈: 리뷰 버튼 보조 글자, 상자 간격 라벨, D-Day 배지
  await tab('home');
  log('[A1 home] ' + JSON.stringify(await measure(['.review-btn small', '.review-btn', '.box .box-gap', '.box .box-name', '.hero-sub', '.dday .muted', '.dday b', '.app-footer', '.tagline', '.stat span', '.streak .small, .streak span'])));
  await tab('exam');
  log('[A1 exam badge] ' + JSON.stringify(await measure(['#view-exam .badge-box', '.plan-day', '.plan-day b'])));

  // A2. 요약 모달 4분면 펼침 시 이웃 칸 레이아웃
  await tab('home');
  const resume = await page.$('[data-action="restart"]'); if (resume) { await resume.click(); await sleep(400); } else { await page.click('[data-action="start-today"], .review-btn'); await sleep(400); }
  await finishQueue();
  const hasSummary = await page.$('.quad-cell.quad-know');
  expect(!!hasSummary, 'A2: 요약 모달 표시');
  if (hasSummary) {
    await page.click('.quad-cell.quad-know'); await sleep(200);
    const q = await page.evaluate(() => { const c = document.querySelector('.quad-cell.quad-lucky'); const cr = c.getBoundingClientRect(); const kids = [...c.children].map(k => { const r = k.getBoundingClientRect(); return { tag: k.tagName, top: Math.round(r.top - cr.top), h: Math.round(r.height), hidden: k.hidden }; }); return { cellH: Math.round(cr.height), alignContent: getComputedStyle(c).alignContent, kids }; });
    log('[A2 quad sibling] ' + JSON.stringify(q));
    expect(q.cellH < 200, `A2: 펼친 칸 옆의 빈 칸이 과도하게 늘어나지 않음(높이 ${q.cellH}px)`);
    await vshot('d2-summary-expanded-sibling');
    const skip = await page.$('.modal button:has-text("건너뛰기")'); if (skip) await skip.click(); else await esc(); await sleep(400);
  }

  // A3. 기록: 되새김 순서, 망각 예측 두 선 동일 여부, 차트 글자 크기
  await tab('history'); await sleep(300);
  const hist = await page.evaluate(() => {
    const dates = [...document.querySelectorAll('.reflect-item .small')].map(e => e.textContent.trim().slice(0, 10));
    const sortedDesc = dates.slice().sort().reverse();
    const texts = [...document.querySelectorAll('.svg-cal text')].map(t => { const r = t.getBoundingClientRect(); return { t: t.textContent, h: Math.round(r.height), fs: getComputedStyle(t).fontSize }; }).slice(0, 6);
    const cells = [...document.querySelectorAll('.cal-cell')].slice(0, 1).map(c => { const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
    const donut = [...document.querySelectorAll('.donut-center')].map(t => { const r = t.getBoundingClientRect(); return { t: t.textContent, h: Math.round(r.height) }; });
    const bars = [...document.querySelectorAll('.svg-bars text')].slice(0, 2).map(t => { const r = t.getBoundingClientRect(); return { t: t.textContent, h: Math.round(r.height) }; });
    return { dates, isDesc: JSON.stringify(dates) === JSON.stringify(sortedDesc), calText: texts, cell: cells[0], donut, bars };
  });
  log('[A3 history] ' + JSON.stringify(hist));
  expect(hist.isDesc, `A3: 되새김 한 줄이 날짜 역순(${hist.dates.join(',')})`);
  await page.click('#forecast-toggle'); await sleep(300);
  const fc = await page.evaluate(() => { const ps = [...document.querySelectorAll('.svg-line path, .svg-line polyline')].map(p => (p.getAttribute('d') || p.getAttribute('points') || '').slice(0, 400)); const uniq = new Set(ps); const labels = [...document.querySelectorAll('.svg-line text')].map(t => t.textContent); const q = window.__app.getState().queue.length; return { paths: ps.length, distinct: uniq.size, labels, queue: q }; });
  log('[A3 forecast after done] ' + JSON.stringify(fc));
  await vshot('d2-forecast-on-after-done');
  await page.click('#forecast-toggle'); await sleep(200);

  // A4. 인쇄: 화면 미리보기와 print 미디어에서 제목 줄 충돌·페이지 폭
  await tab('print'); await page.click('[data-action="print-deck"]:has-text("사회")'); await sleep(200);
  const acc = await page.evaluate(() => ({ accent: getComputedStyle(document.querySelector('input[type=range]')).accentColor, h: document.querySelector('input[type=range]').getBoundingClientRect().height }));
  log('[A4 range] ' + JSON.stringify(acc));
  await page.click('[data-action="print-preview"]'); await sleep(500);
  const pt = () => page.evaluate(() => { const pg = document.querySelector('.page'); const t = document.querySelector('.page-title'); const [b, s] = [...t.children].map(k => k.getBoundingClientRect()); const pr = pg.getBoundingClientRect(); return { pageW: Math.round(pr.width), pageH: Math.round(pr.height), bRight: Math.round(b.right), sLeft: Math.round(s.left), gap: Math.round(s.left - b.right), bH: Math.round(b.height), sH: Math.round(s.height), titleText: t.textContent.trim().slice(0, 80) }; });
  const ptScreen = await pt(); log('[A4 title screen] ' + JSON.stringify(ptScreen));
  await vshot('d2-print-preview-social');
  await page.emulateMedia({ media: 'print' }); await sleep(300);
  const ptPrint = await pt(); log('[A4 title print] ' + JSON.stringify(ptPrint));
  expect(ptPrint.gap >= 8, `A4: print 미디어에서 제목과 학급 정보 사이 간격 ${ptPrint.gap}px`);
  const pcards = await page.evaluate(() => [...document.querySelectorAll('.page')].map(p => ({ h: Math.round(p.getBoundingClientRect().height), cards: p.querySelectorAll('.pcard').length, cardH: Math.round((p.querySelector('.pcard') || p).getBoundingClientRect().height) })));
  log('[A4 pages print] ' + JSON.stringify(pcards));
  await page.emulateMedia({ media: 'screen' }); await sleep(200);
  await page.click('[data-action="print-back"]'); await sleep(200);
  // 학습지: 페이지별 문항 높이 차이
  await page.click('[data-action="print-deck"]:has-text("사회")'); await page.click('[data-action="print-deck"]:has-text("수학")'); await page.click('[data-action="print-layout"][data-val="sheet"]'); await sleep(200);
  await page.click('[data-action="print-preview"]'); await sleep(500);
  await page.emulateMedia({ media: 'print' }); await sleep(300);
  const sheet = await page.evaluate(() => [...document.querySelectorAll('.page')].map(p => ({ h: Math.round(p.getBoundingClientRect().height), items: p.querySelectorAll('.sheet-item').length, itemH: p.querySelector('.sheet-item') ? Math.round(p.querySelector('.sheet-item').getBoundingClientRect().height) : null })));
  log('[A4 sheet pages print] ' + JSON.stringify(sheet));
  await page.emulateMedia({ media: 'screen' }); await sleep(200);
  await page.click('[data-action="print-back"]'); await sleep(200);

  // A5. 주간 리포트: 다크 모드에서 표 머리글 색
  await tab('history'); await setTheme('dark');
  await page.click('[data-action="weekly-report"]'); await sleep(400);
  log('[A5 weekly dark] ' + JSON.stringify(await measure(['.a5 .tbl th', '.a5 .tbl td', '.a5 h3', '.a5 .page-title b', '.a5 .page-title span', '.a5 li', '.a5 p, .a5 .small'])));
  await vshot('d2-weekly-report-dark');
  const tb = await page.evaluate(() => { const t = document.querySelector('.print-toolbar'); return [...t.children].map(k => { const r = k.getBoundingClientRect(); return { cls: k.className, tag: k.tagName, y: Math.round(r.top), h: Math.round(r.height), text: k.textContent.trim().slice(0, 20) }; }); });
  log('[A5 weekly toolbar] ' + JSON.stringify(tb));
  await page.click('[data-action="print-back"]'); await sleep(200);
  await setTheme('light');

  // A6. 포커스 링: Tab 키로 이동한 요소에 outline이 보이는가
  await tab('home'); await page.mouse.click(640, 700); await page.keyboard.press('Tab'); await sleep(100);
  const focus = await page.evaluate(() => { const el = document.activeElement; const cs = getComputedStyle(el); return { tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20), outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor }; });
  log('[A6 focus] ' + JSON.stringify(focus));
  await vshot('d2-focus-ring');

  // ===== B. 모바일 400 =====
  await page.setViewportSize({ width: 400, height: 860 });
  await reload(); await resample(); await reload(); await setTheme('light');
  // B1. FAB과 5상자 겹침, 탭 글자 크기, 푸터
  const fab = await rect('.fab'), box5 = await rect('.boxes .box:last-child'), footer = await rect('.app-footer');
  const ovX = Math.max(0, Math.min(fab.r, box5.r) - Math.max(fab.x, box5.x)), ovY = Math.max(0, Math.min(fab.b, box5.b) - Math.max(fab.y, box5.y));
  log('[B1 fab/box5] ' + JSON.stringify({ fab, box5, footer, overlap: { w: ovX, h: ovY }, scrollH: await page.evaluate(() => document.documentElement.scrollHeight), innerH: 860 }));
  expect(ovX * ovY === 0, `B1: 400px 첫 화면에서 FAB이 5상자를 가리지 않음(겹침 ${ovX}x${ovY}px)`);
  log('[B1 tab] ' + JSON.stringify(await measure(['.tab span:last-child', '.tab[aria-selected="true"]', '.box .box-gap', '.box b', '.review-btn', '.review-btn small'])));
  await vshot('m2-home-top');
  await page.evaluate(() => window.scrollTo(0, 99999)); await sleep(200); await vshot('m2-home-bottom');
  const fab2 = await rect('.fab'), box5b = await rect('.boxes .box:last-child'), foot2 = await rect('.app-footer');
  log('[B1 bottom] ' + JSON.stringify({ fab: fab2, box5: box5b, footer: foot2 }));
  await page.evaluate(() => window.scrollTo(0, 0));
  // B2. 저장 불가 배너 버튼
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; window.__app.actions.setDailyGoal(7); }); await sleep(300);
  const bb = await page.evaluate(() => { const b = document.querySelector('#storage-banner .btn'); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { w: Math.round(r.width), h: Math.round(r.height), whiteSpace: cs.whiteSpace, flexShrink: cs.flexShrink, text: b.textContent.trim() }; });
  log('[B2 banner btn] ' + JSON.stringify(bb));
  expect(bb.h <= 48, `B2: 배너 버튼이 한 줄(높이 ${bb.h}px, 폭 ${bb.w}px)`);
  await vshot('m2-storage-banner'); await reload(); await sleep(300);
  // B3. 긴 앞면 카드 세션(받아쓰기 덱) 글자 크기
  await tab('cards'); await page.click('.deck-card:has-text("받아쓰기")'); await sleep(300);
  await page.click('[data-action="start-deck"]'); await sleep(400);
  log('[B3 session 400] ' + JSON.stringify(await measure(['.face-text', '.face-tag', '.kbd-hint', '[data-action="conf"][data-c="1"]', '#flip-btn'])));
  const kb = await rect('.kbd-hint'); log('[B3 kbd-hint rect] ' + JSON.stringify(kb));
  await vshot('m2-session-long-front');
  await page.click('[data-action="conf"][data-c="2"]'); await page.click('#flip-btn'); await sleep(600); await vshot('m2-session-long-back');
  await esc(); await sleep(300);
  // B4. 인쇄 미리보기 폭(A4·A5) — 뷰 안 가로 스크롤
  await tab('print'); await page.click('[data-action="print-deck"]:has-text("영어")'); await sleep(200);
  await page.click('[data-action="print-preview"]'); await sleep(500);
  const pv = await page.evaluate(() => { const v = document.querySelector('.print-view'); const p = document.querySelector('.page'); return { viewScrollW: v.scrollWidth, viewClientW: v.clientWidth, pageW: Math.round(p.getBoundingClientRect().width), pageRight: Math.round(p.getBoundingClientRect().right), innerW: innerWidth }; });
  log('[B4 print preview 400] ' + JSON.stringify(pv));
  expect(pv.pageRight <= pv.innerW + 1, `B4: 400px 인쇄 미리보기 페이지가 화면 안에 들어옴(페이지 폭 ${pv.pageW}px)`);
  await vshot('m2-print-preview-a4');
  await page.click('[data-action="print-back"]'); await sleep(200);
  await tab('history'); await page.click('[data-action="weekly-report"]'); await sleep(400);
  const pv2 = await page.evaluate(() => { const v = document.querySelector('.print-view'); const p = document.querySelector('.page'); return { viewScrollW: v.scrollWidth, viewClientW: v.clientWidth, pageW: Math.round(p.getBoundingClientRect().width), innerW: innerWidth }; });
  log('[B4 weekly 400] ' + JSON.stringify(pv2));
  await vshot('m2-weekly-a5');
  await page.click('[data-action="print-back"]'); await sleep(200);
  // B5. 표 가로 스크롤 컨테이너(교사·설정 간격표)
  await tab('settings');
  const st = await page.evaluate(() => { const t = document.querySelector('#view-settings table.tbl'); const wrap = t.parentElement; const cs = getComputedStyle(wrap); return { tableW: t.scrollWidth, wrapW: wrap.clientWidth, wrapOverflowX: cs.overflowX, wrapCls: wrap.className, panelOverflow: getComputedStyle(t.closest('.panel')).overflow }; });
  log('[B5 settings interval table] ' + JSON.stringify(st));
  await page.click('input[data-action="set-teacher"]'); await sleep(300); await tab('teacher'); await page.click('[data-action="teacher-sample"]'); await sleep(400);
  const tt = await page.evaluate(() => [...document.querySelectorAll('#view-teacher table.tbl')].map(t => { const wrap = t.parentElement; return { tableW: t.scrollWidth, wrapW: wrap.clientWidth, overflowX: getComputedStyle(wrap).overflowX, cls: wrap.className }; }));
  log('[B5 teacher tables] ' + JSON.stringify(tt));
  await vshot('m2-teacher-table');
  await tab('settings'); await page.click('input[data-action="set-teacher"]'); await sleep(200);
  // B6. 카드 모달 푸터가 뷰포트 안에 있는가
  await tab('cards'); await page.click('.deck-card:has-text("수학 오답노트")'); await sleep(300); await page.click('[data-action="new-card"]'); await sleep(300);
  const mf = await page.evaluate(() => { const f = document.querySelector('.modal-foot'); const m = document.querySelector('.modal'); const r = f.getBoundingClientRect(); return { footBottom: Math.round(r.bottom), innerH: innerHeight, modalH: Math.round(m.getBoundingClientRect().height), bodyScroll: document.querySelector('.modal-body').scrollHeight, bodyClient: document.querySelector('.modal-body').clientHeight }; });
  log('[B6 card modal 400] ' + JSON.stringify(mf));
  expect(mf.footBottom <= mf.innerH, `B6: 카드 모달 푸터가 화면 안(${mf.footBottom}/${mf.innerH})`);
  await esc();
  // B7. 덱 상세 머리 버튼 줄바꿈
  const hb = await page.evaluate(() => [...document.querySelectorAll('#view-cards .panel-head .btn, #view-cards .row .btn')].slice(0, 6).map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), y: Math.round(r.top), h: Math.round(r.height) }; }));
  log('[B7 deck head btns] ' + JSON.stringify(hb));

  // ===== C. 태블릿 820 — 홈/세션 요약만 =====
  await page.setViewportSize({ width: 820, height: 1100 });
  await reload(); await sleep(300);
  log('[C1 tablet home] ' + JSON.stringify(await measure(['.review-btn', '.box b', '.box .box-gap', '.tab[aria-selected="true"]'])));
  const hero = await page.evaluate(() => { const h = document.querySelector('.hero'); return { cols: getComputedStyle(h).gridTemplateColumns }; });
  log('[C1 hero cols 820] ' + JSON.stringify(hero));
  log('SHOTS=' + JSON.stringify(shots));
};
