// ux-shots.js — 기억상자 UX 리뷰용: 모든 화면/탭/모달/상태를 4개 뷰포트(데스크톱 라이트·다크, 태블릿, 모바일)에서 촬영
'use strict';
const path = require('path');
const OUT = 'C:\\Users\\parad\\AppData\\Local\\Temp\\claude\\D--workspace-ginue-2026-02-ai-course-homework\\1716854d-9f4f-4d06-ba55-fb3e97031963\\scratchpad\\tests\\memory-box\\shots';

module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
  const shots = [];
  let prefix = 'dl';
  // 뷰포트 전체(고정 요소 포함)만 촬영
  const vshot = async (name) => { const p = path.join(OUT, `${prefix}-${name}.png`); await page.screenshot({ path: p, fullPage: false }); shots.push(p); return p; };
  // 전체 페이지 촬영
  const fshot = async (name) => { const p = path.join(OUT, `${prefix}-${name}.png`); await page.screenshot({ path: p, fullPage: true }); shots.push(p); return p; };
  const st = () => page.evaluate(() => window.__app.getState());
  const resample = async () => { await page.evaluate(() => { window.__app.actions.resample(); window.__app.actions.setView('home'); }); await sleep(200); };
  const esc = async () => { await page.keyboard.press('Escape'); await sleep(250); };
  const tab = async (v) => { await page.click(`#tab-${v}`); await sleep(250); };
  const hscroll = async (label) => { const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })); expect(r.sw <= r.iw, `${prefix} ${label}: 가로 스크롤 없음 (${r.sw}/${r.iw})`); };
  // 대비·크기 측정
  const measure = async (label) => {
    const m = await page.evaluate(() => {
      const lum = (rgb) => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
      const bgOf = (el) => { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.9) return c.rgb; e = e.parentElement; } return [255, 255, 255]; };
      const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2); };
      const sels = ['.tagline', '.tab[aria-selected="true"]', '.tab:not([aria-selected="true"]) span:last-child', '.box .box-gap', '.box .box-name', '.hero-sub', '.stat span', '.small.muted', '.btn-primary', '.badge', '.badge-box', '.badge-wrong', '.badge-repeat', '.dday .muted', '.app-footer', '.kbd-hint', '.toast', '.counter', '.chart text', '.legend', '.cal-tip', '.plan-day', '.plan-day b', '.mini-box', '.face-tag', '.card-row .back', '.deck-card .small', '.quad-cell small', '.coach', '.print-hint', '.tbl td', '.modal-title', '.btn-ok', '.btn-danger', '.chip-btn', '.seg button', '.reflect-item .small'];
      const out = {};
      sels.forEach(s => { const el = document.querySelector(s); if (!el) return; const cs = getComputedStyle(el); const fg = parse(cs.color || cs.fill); const bg = bgOf(el); const r = el.getBoundingClientRect(); out[s] = { font: cs.fontSize, w: Math.round(r.width), h: Math.round(r.height), contrast: fg ? ratio(fg.rgb, bg) : null }; });
      // 44px 미만 터치 타깃
      const small = [...document.querySelectorAll('button, a, input[type=checkbox], label.switch')].filter(b => b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); return { t: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 18), cls: b.className.toString().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.h > 0 && (x.h < 44 || x.w < 44));
      return { out, small: small.slice(0, 40) };
    });
    log(`[measure ${prefix} ${label}] ${JSON.stringify(m)}`);
  };

  const run = async (cfg) => {
    prefix = cfg.prefix;
    await page.setViewportSize({ width: cfg.w, height: cfg.h });
    await reload(); await resample(); await reload();
    // 테마 적용
    const curTheme = await page.evaluate(() => document.documentElement.dataset.theme || '');
    if (cfg.dark && curTheme !== 'dark') { await page.click('#theme-btn'); await sleep(200); }
    if (!cfg.dark && curTheme === 'dark') { await page.click('#theme-btn'); await sleep(200); }
    const theme = await page.evaluate(() => document.documentElement.dataset.theme || '');
    expect(cfg.dark ? theme === 'dark' : theme !== 'dark', `${prefix}: 테마 토글 동작(${theme || 'system'})`);
    await sleep(600);

    // 1. 홈
    await fshot('home'); if (cfg.w < 760) await vshot('home-viewport'); await hscroll('home'); await measure('home');
    const s0 = await st(); log(`${prefix} home queue=${s0.queue.length} overdue=${s0.overdue} streak=${s0.streak} boxes=${s0.boxCounts}`);
    // 프로필 팝오버
    await page.click('#profile-chip'); await sleep(200); await vshot('home-profile-menu'); await page.mouse.click(5, 5); await sleep(150);
    // 도움말
    await page.click('[data-action="help"]'); await sleep(300); await vshot('help'); await esc();

    if (cfg.full) {
      // 저장 불가 배너
      await page.evaluate(() => { Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; window.__app.actions.setDailyGoal(7); });
      await sleep(300); await vshot('home-storage-banner'); await reload(); await sleep(300);
    }

    // 2. 카드 탭
    await tab('cards'); await fshot('cards-decks'); await hscroll('cards'); await measure('cards');
    if (cfg.full) { await page.click('[data-action="new-deck"]'); await sleep(300); await vshot('deck-modal'); await esc(); }
    await page.click('.deck-card:has-text("수학 오답노트")'); await sleep(300); await fshot('cards-deck-detail'); await hscroll('deck-detail'); await measure('deck-detail');
    if (cfg.full) {
      await page.click('[data-action="delete-deck"]'); await sleep(300); await vshot('deck-delete-confirm'); await esc();
      // 카드 모달(암기 → 오답 → 손그림)
      await page.click('[data-action="new-card"]'); await sleep(300); await vshot('card-modal-memo');
      await page.click('.modal [data-type="wrong"]'); await sleep(200); await vshot('card-modal-wrong');
      await page.click('.modal [data-draw="open"]'); await sleep(300); await vshot('drawing-modal'); await esc(); await esc();
      // 카드 수정 모달(반복 오류 카드)
      await page.click('.card-row:has-text("3/4 - 1/6")'); await sleep(300); await vshot('card-modal-edit'); await esc();
      // CSV 미리보기
      const deckId = (await st()).data.decks.find(d => d.name === '수학 오답노트').id;
      await page.evaluate((id) => { window.__app.actions.importCsvText('앞면,뒷면,힌트,유형,원인\n"1/2 + 1/3 = ?",5/6,통분,오답,개념\n2/3 + 1/4 = ?,11/12,,오답,개념\n새 카드,정답,,암기,\n,빈 앞면,,,\n', id); }, deckId);
      await sleep(400); await vshot('csv-preview'); await esc();
    }
    await page.click('[data-action="back-decks"]'); await sleep(200);
    await page.click('[data-action="all-cards"]'); await sleep(300); await fshot('cards-all');
    if (cfg.full) { await page.click('[data-filter="type"][data-val="repeat"]'); await sleep(200); await vshot('cards-filter-repeat'); await page.click('[data-filter="box"][data-val="master"]'); await sleep(200); await vshot('cards-filter-master'); }

    // 3. 복습 세션(오답 덱으로 원인 패널까지)
    await page.click('[data-action="back-decks"]'); await sleep(200);
    await page.click('.deck-card:has-text("수학 오답노트")'); await sleep(200);
    await page.click('[data-action="start-deck"]'); await sleep(400);
    await vshot('session-front'); await measure('session'); await hscroll('session');
    await page.click('[data-action="conf"][data-c="2"]'); await sleep(200); await vshot('session-conf');
    await page.click('#flip-btn'); await sleep(600); await vshot('session-flipped');
    await page.click('[data-action="hint"]'); await sleep(150); await vshot('session-hint');
    await page.click('[data-action="grade"][data-ok="0"]'); await sleep(200); await vshot('session-reason');
    await page.click('[data-action="pick-reason"][data-reason="calc"]'); await sleep(700);
    await page.keyboard.press('Escape'); await sleep(300); await vshot('after-esc-cards'); await tab('home'); await fshot('home-resume');
    await page.click('[data-action="restart"]'); await sleep(400);
    // 오늘 큐 전부 처리 → 요약 모달
    let guard = 0;
    while (guard++ < 40) {
      const open = await page.evaluate(() => !document.getElementById('session').hidden && !!document.getElementById('flip-btn'));
      if (!open) break;
      await page.click('[data-action="conf"][data-c="3"]'); await page.click('#flip-btn'); await sleep(450);
      if (guard === 3) await vshot('session-mid');
      await page.click('[data-action="grade"][data-ok="1"]'); await sleep(550);
    }
    await sleep(500); await vshot('session-summary'); await measure('summary');
    await page.click('.quad-cell.quad-know'); await sleep(150); await vshot('session-summary-expanded');
    await page.fill('#reflect-in', '테스트 — 통분 후 분자만 더하기'); await page.click('.modal [data-value="true"]'); await sleep(400);
    await fshot('home-done'); await hscroll('home-done');
    if (cfg.full) { const pre = await page.$('[data-action="start-preview"]'); if (pre) { await pre.click(); await sleep(400); await vshot('session-preview'); await esc(); await page.evaluate(() => { const s = window.__app.getState(); }); } }

    // 4. 기록
    await tab('history'); await sleep(300); await fshot('history'); await hscroll('history'); await measure('history');
    await page.click('#forecast-toggle'); await sleep(300); await fshot('history-forecast-on');
    await page.click('.cal-cell[data-n]:not([data-n="0"])'); await sleep(150);
    await page.click('[data-action="weekly-report"]'); await sleep(400); await vshot('weekly-report'); await page.click('[data-action="print-back"]'); await sleep(200);

    // 5. 시험
    await tab('exam'); await fshot('exam'); await hscroll('exam'); await measure('exam');
    if (cfg.full) { await page.click('[data-action="new-exam"]'); await sleep(300); await vshot('exam-modal'); await esc(); }

    // 6. 인쇄
    await tab('print'); await fshot('print'); await hscroll('print'); await measure('print');
    await page.click('[data-action="print-deck"]:has-text("영어")'); await sleep(200);
    await page.click('[data-action="print-preview"]'); await sleep(500); await vshot('print-preview-cards'); await fshot('print-preview-cards-full');
    if (cfg.full) { await page.emulateMedia({ media: 'print' }); await sleep(300); await fshot('print-media-cards'); await page.emulateMedia({ media: 'screen' }); await sleep(200); }
    await page.click('[data-action="print-back"]'); await sleep(200);
    await page.click('[data-action="print-deck"]:has-text("영어")'); await page.click('[data-action="print-deck"]:has-text("수학")'); await page.click('[data-action="print-layout"][data-val="sheet"]'); await sleep(200);
    await page.click('[data-action="print-preview"]'); await sleep(500); await vshot('print-preview-sheet'); await fshot('print-preview-sheet-full');
    if (cfg.full) { await page.emulateMedia({ media: 'print' }); await sleep(300); await fshot('print-media-sheet'); await page.emulateMedia({ media: 'screen' }); await sleep(200); }
    await page.click('[data-action="print-back"]'); await sleep(200);

    // 7. 설정 + 교사
    await tab('settings'); await fshot('settings'); await hscroll('settings'); await measure('settings');
    if (cfg.full) {
      await page.evaluate(() => { window.__app.actions.restoreFromFile(new File(['{"a":1}'], 'bad.json', { type: 'application/json' })); }); await sleep(400); await vshot('restore-error'); await esc();
      await page.click('[data-action="wipe-profile"]'); await sleep(300); await vshot('wipe-confirm'); await esc();
      await page.click('[data-action="profile-add"]'); await sleep(300); await vshot('profile-modal'); await esc();
    }
    await page.click('input[data-action="set-teacher"]'); await sleep(300);
    await tab('teacher'); await fshot('teacher-empty'); await hscroll('teacher-empty');
    await page.click('[data-action="teacher-sample"]'); await sleep(400); await fshot('teacher-sample'); await hscroll('teacher'); await measure('teacher');
    await page.click('#unit-table td.clickable'); await sleep(150); await vshot('teacher-cell');
    const tsum = await page.evaluate(() => ({ rows: document.querySelectorAll('#student-list tbody tr').length, p1: (document.querySelector('#point-cards .point-card') || {}).textContent, focus: (document.querySelector('#focus-list') || {}).textContent }));
    log(`${prefix} teacher ${JSON.stringify(tsum)}`);
    // 교사 모드 끄기
    await tab('settings'); await page.click('input[data-action="set-teacher"]'); await sleep(200);

    if (cfg.full) {
      // 8. 빈 프로필(카드 0장)
      await page.click('[data-action="profile-add"]'); await sleep(200); await page.fill('#pf-name', '새학생'); await page.click('.modal [data-value="true"]'); await sleep(300);
      const pid = (await st()).meta.profiles.slice(-1)[0].id; await page.evaluate((id) => window.__app.actions.switchProfile(id), pid); await sleep(300);
      await tab('home'); await fshot('empty-home'); await tab('cards'); await fshot('empty-cards'); await tab('history'); await fshot('empty-history'); await tab('exam'); await fshot('empty-exam'); await tab('print'); await fshot('empty-print');
      await tab('home'); await page.click('.fab'); await sleep(300); await vshot('empty-fab-deckmodal'); await esc();
      // 이도윤 프로필
      const yid = (await st()).meta.profiles.find(p => p.name === '이도윤').id; await page.evaluate((id) => window.__app.actions.switchProfile(id), yid); await sleep(300); await tab('home'); await fshot('home-doyun'); await tab('history'); await fshot('history-doyun');
    }
  };

  await run({ prefix: 'dl', w: 1280, h: 800, dark: false, full: true });
  await run({ prefix: 'dd', w: 1280, h: 800, dark: true, full: false });
  await run({ prefix: 'tl', w: 820, h: 1100, dark: false, full: false });
  await run({ prefix: 'ml', w: 400, h: 860, dark: false, full: true });
  await run({ prefix: 'md', w: 400, h: 860, dark: true, full: false });
  log('SHOTS=' + JSON.stringify(shots));
};
