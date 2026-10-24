// func-responsive.js — 400px 뷰포트 핵심 흐름(AC16), 다크 모드, 터치 타깃·키보드 포커스, localStorage 차단(AC17), 외부 네트워크 요청(AC18) (pw-run.js 모듈)
'use strict';
const path = require('path');
module.exports = async ({ page, expect, shot, log, sleep, reload, browser }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const game = async () => (await st()).game;
  const txt = sel => page.locator(sel).first().innerText().catch(() => '');
  const waitFor = async (fn, timeout = 15000, every = 60) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) return null; await sleep(every); } };
  const sw = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, body: document.body.scrollWidth }));
  const noHScroll = async label => { const v = await sw(); expect(v.sw <= v.cw && v.body <= v.cw, `${label}: 가로 스크롤 없음 (scrollWidth ${v.sw}/${v.body} ≤ ${v.cw})`); return v; };
  const url = page.url();

  // ---------- 400px 흐름 ----------
  await page.setViewportSize({ width: 400, height: 800 });
  await reload();
  await noHScroll('400px 홈');
  expect(await page.locator('#profile-btn').isVisible() && await page.locator('.toolbar [data-action="nav"][data-view="settings"]').isVisible(), '400px 상단바 프로필·설정 버튼 보임');
  await shot('m-home');
  await page.click('[data-action="grade-tab"][data-grade="1"]');
  await page.click('.stage-card[data-stage="s1-1"] .start-btn');
  await noHScroll('400px 게임');
  const dims = await page.evaluate(() => { const c = document.getElementById('game-canvas').getBoundingClientRect(), p = document.getElementById('input-panel').getBoundingClientRect(), h = document.querySelector('.hud').getBoundingClientRect(); return { cw: c.width, ch: c.height, ratio: c.width / c.height, panelTop: p.top, panelBottom: p.bottom, hudW: h.width, vh: innerHeight, sticky: getComputedStyle(document.getElementById('input-panel')).position }; });
  log('400px 게임 레이아웃: ' + JSON.stringify(dims));
  expect(dims.cw <= 400 && Math.abs(dims.ratio - 16 / 9) < 0.02, `캔버스 폭 ${dims.cw.toFixed(0)}px·16:9 유지`);
  expect(dims.panelTop >= dims.ch && dims.panelBottom <= dims.vh + 1, `입력 패널이 캔버스 아래·화면 안 (${dims.panelTop.toFixed(0)}~${dims.panelBottom.toFixed(0)}, vh ${dims.vh})`);
  expect(dims.sticky === 'sticky', '입력 패널 sticky');
  const keyHs = await page.locator('#input-panel .key').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  expect(keyHs.length === 12 && Math.min(...keyHs) >= 56, `AC16 키패드 버튼 ${keyHs.length}개, 높이 최소 ${Math.min(...keyHs)}px ≥ 56`);
  const hudVisible = await page.evaluate(() => ['hud-score', 'hud-hearts', 'hud-wave', 'super-btn'].every(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth + 1 && r.left >= 0; }));
  expect(hudVisible, 'AC16 HUD 요소가 화면 안에 보임');
  await shot('m-game');
  // 키패드로 한 마리 격파(핵심 흐름)
  const g = await waitFor(async () => { const g = await game(); return g.monsters.length ? g : null; }, 5000);
  for (const d of g.monsters[0].answerText) await page.click(`#input-panel .key[data-k="${d}"]`);
  await page.click('#input-panel .key-fire');
  expect(!!(await waitFor(async () => (await game()).correct === 1, 1500, 30)), '400px 키패드로 격파 가능');
  // 오답 카드가 화면 안에
  const m2 = await waitFor(async () => { const g = await game(); return g.state === 'playing' ? g.monsters.find(x => !x.locked) || null : null; }, 6000);
  await page.keyboard.type(String(Number(m2.answerText) + 1)); await page.keyboard.press('Enter'); await sleep(150);
  const modalBox = await page.locator('.card-modal').boundingBox();
  expect(modalBox && modalBox.width <= 400 - 32 + 1 && modalBox.x >= 15, `교정 카드 모달 폭 ${modalBox && modalBox.width.toFixed(0)}px 화면 안`);
  await noHScroll('400px 교정 카드');
  await shot('m-card');
  await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class')).includes('locked'), 2500, 50);
  await page.keyboard.type(m2.answerText); await page.keyboard.press('Enter'); await sleep(100);
  await page.evaluate(() => window.__app.actions.quit());
  await waitFor(async () => (await st()).view === 'result', 3000, 50);
  await noHScroll('400px 결과');
  await shot('m-result');
  for (const v of ['codex', 'hall', 'settings']) {
    await page.evaluate(v => window.__app.actions.showView(v), v);
    await noHScroll(`400px ${v}`);
    await shot(`m-${v}`);
  }
  await page.evaluate(() => window.__app.actions.showView('hall'));
  await page.click('[data-action="hall-tab"][data-tab="stars"]');
  await noHScroll('400px 명예의 전당 별 탭(24행)');
  await page.evaluate(() => window.__app.actions.showView('home'));
  await page.click('.toolbar [data-action="new-profile"]');
  const npBox = await page.locator('.modal').boundingBox();
  expect(npBox && npBox.width <= 368 + 1, `새 프로필 모달 폭 ${npBox && npBox.width.toFixed(0)}px`);
  await page.keyboard.press('Escape');
  // 터치 타깃 44px 점검(보이는 버튼)
  const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 12), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.h < 44 || x.w < 44));
  log('400px 홈 44px 미만 버튼: ' + JSON.stringify(small));
  expect(small.length === 0, `홈 화면 44px 미만 터치 타깃 ${small.length}개 ${JSON.stringify(small.slice(0, 5))}`);
  await page.click('.stage-card[data-stage="s1-1"] .start-btn');
  const smallHud = await page.evaluate(() => [...document.querySelectorAll('.hud button')].map(b => { const r = b.getBoundingClientRect(); return { t: (b.getAttribute('aria-label') || b.textContent).trim(), w: Math.round(r.width), h: Math.round(r.height) }; }));
  log('400px HUD 버튼 크기: ' + JSON.stringify(smallHud));
  expect(smallHud.every(b => b.h >= 44 && b.w >= 44), `HUD 버튼 44px 이상 (${smallHud.map(b => `${b.t}:${b.w}x${b.h}`).join(', ')})`);
  await page.evaluate(() => window.__app.actions.quit());
  await waitFor(async () => (await st()).view === 'result', 3000, 50);
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---------- 다크 모드(OS 설정) ----------
  await page.emulateMedia({ colorScheme: 'dark' });
  await reload();
  const dark = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'system', bg: getComputedStyle(document.body).backgroundColor, btn: document.getElementById('theme-btn').textContent, fg: getComputedStyle(document.body).color }));
  expect(dark.theme === 'system' && dark.bg === 'rgb(15, 22, 48)' && dark.btn === '☀️', `OS 다크 → 다크 토큰 적용 ${JSON.stringify(dark)}`);
  await shot('d-home');
  await page.click('[data-action="grade-tab"][data-grade="1"]');
  await page.click('.stage-card[data-stage="s1-1"] .start-btn');
  await waitFor(async () => { const g = await game(); return g.monsters.length ? g : null; }, 5000);
  await shot('d-game');
  const g2 = await game();
  await page.keyboard.type(String(Number(g2.monsters[0].answerText) + 1)); await page.keyboard.press('Enter'); await sleep(900);
  await shot('d-card');
  const cardColors = await page.evaluate(() => { const q = document.querySelector('.card-q'), m = document.querySelector('.modal'); return { fg: getComputedStyle(q).color, bg: getComputedStyle(m).backgroundColor }; });
  expect(cardColors.fg !== cardColors.bg, `다크 모달 글자/배경 구분 ${JSON.stringify(cardColors)}`);
  await waitFor(async () => !(await page.getAttribute('.card-modal .card-pad', 'class')).includes('locked'), 2500, 50);
  await page.keyboard.type(g2.monsters[0].answerText); await page.keyboard.press('Enter'); await sleep(100);
  await page.evaluate(() => window.__app.actions.quit());
  await waitFor(async () => (await st()).view === 'result', 3000, 50);
  await shot('d-result');
  for (const v of ['codex', 'hall', 'settings']) { await page.evaluate(v => window.__app.actions.showView(v), v); await shot(`d-${v}`); }
  // 다크에서 히트맵·표 글자색 토큰 확인
  await page.evaluate(() => window.__app.actions.showView('codex'));
  const hm = await page.evaluate(() => { const c = document.querySelector('.hm-cell.box-none'); return c ? { fg: getComputedStyle(c).color, bg: getComputedStyle(c).backgroundColor } : null; });
  expect(hm && hm.fg !== hm.bg, `다크 히트맵 미출제 칸 글자 보임 ${JSON.stringify(hm)}`);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => window.__app.actions.showView('home'));

  // ---------- 키보드 포커스 링 ----------
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { tag: a.tagName, label: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 10), outline: cs.outlineStyle, w: cs.outlineWidth }; });
  expect(focus.tag === 'BUTTON' && focus.outline !== 'none' && parseFloat(focus.w) >= 2, `Tab 포커스 링 표시 ${JSON.stringify(focus)}`);
  const ariaMissing = await page.evaluate(() => [...document.querySelectorAll('button.icon-btn, .hud-btn.icon')].filter(b => !b.getAttribute('aria-label')).length);
  expect(ariaMissing === 0, `아이콘 버튼 aria-label 누락 ${ariaMissing}개`);

  // ---------- AC17: localStorage 차단 환경 ----------
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' });
  await ctx2.addInitScript(() => { const thrower = { get() { throw new DOMException('blocked', 'SecurityError'); } }; Object.defineProperty(window, 'localStorage', thrower); });
  const p2 = await ctx2.newPage(); const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message)); p2.on('console', m => { if (m.type() === 'error') errs2.push('console: ' + m.text()); });
  await p2.goto(url, { waitUntil: 'load' }); await p2.waitForTimeout(600);
  const s2 = await p2.evaluate(() => window.__app.getState());
  expect(s2.view === 'home' && s2.profiles.length === 24 && s2.storageOk === false, `AC17 저장 차단: 홈·샘플 24명·storageOk=false (${JSON.stringify({ v: s2.view, n: s2.profiles.length, ok: s2.storageOk })})`);
  const warn = await p2.locator('#storage-warn');
  expect(await warn.isVisible() && (await warn.innerText()).includes('저장 불가'), `AC17 상단 '저장 불가' 경고 배지 (${(await warn.innerText()).slice(0, 30)})`);
  expect((await p2.locator('#toast-root .toast').allInnerTexts()).some(t => t.includes('저장 불가')), '저장 불가 안내 토스트');
  await p2.click('[data-action="grade-tab"][data-grade="1"]');
  await p2.click('.stage-card[data-stage="s1-1"] .start-btn');
  const g3 = await (async () => { for (let i = 0; i < 60; i++) { const g = await p2.evaluate(() => window.__app.getState().game); if (g && g.monsters.length) return g; await p2.waitForTimeout(80); } return null; })();
  expect(!!g3, 'AC17 저장 차단 환경에서도 플레이 가능(몬스터 스폰)');
  if (g3) { await p2.evaluate(a => window.__app.actions.fire(a), g3.monsters[0].answerText); await p2.waitForTimeout(400); expect((await p2.evaluate(() => window.__app.getState().game)).correct === 1, '저장 차단 환경에서 격파'); }
  await p2.evaluate(() => window.__app.actions.quit()); await p2.waitForTimeout(800);
  expect((await p2.evaluate(() => window.__app.getState())).view === 'result', '저장 차단 환경에서 결과 화면');
  await p2.evaluate(() => window.__app.actions.showView('settings'));
  expect((await p2.locator('#save-status').innerText()).includes('저장 불가'), '설정의 저장 상태 표시가 저장 불가를 알림');
  await p2.screenshot({ path: path.join(__dirname, 'func-out', 'storage-blocked.png'), fullPage: true });
  expect(errs2.length === 0, `저장 차단 환경 오류 0건 (${errs2.join(' | ').slice(0, 200)})`);
  await ctx2.close();

  // ---------- AC18: 외부 네트워크 요청 ----------
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' });
  const p3 = await ctx3.newPage(); const reqs = [];
  p3.on('request', r => reqs.push(r.url()));
  await p3.goto(url, { waitUntil: 'load' }); await p3.waitForTimeout(800);
  await p3.click('[data-action="grade-tab"][data-grade="2"]'); await p3.click('.stage-card[data-stage="s2-3"] .start-btn'); await p3.waitForTimeout(2500);
  await p3.evaluate(() => window.__app.actions.quit()); await p3.waitForTimeout(800);
  for (const v of ['codex', 'hall', 'settings']) { await p3.evaluate(v => window.__app.actions.showView(v), v); await p3.waitForTimeout(150); }
  const external = reqs.filter(u => !u.startsWith('file:') && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));
  log('요청 목록: ' + JSON.stringify([...new Set(reqs)]));
  expect(external.length === 0, `AC18 Google Fonts 외 외부 요청 0건 (${external.join(', ')})`);
  expect(reqs.filter(u => u.startsWith('file:')).length >= 8, `로컬 파일 로드 ${reqs.filter(u => u.startsWith('file:')).length}건(html/css/js 6개)`);
  await ctx3.close();
};
