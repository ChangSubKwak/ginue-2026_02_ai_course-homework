// func-responsive-theme.js — 400px 뷰포트 핵심 흐름(AC13)·탭바·가로 스크롤·다크 모드·reduced-motion·대비 (pw-run.js용)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const txt = async sel => (await page.locator(sel).first().textContent()) || '';
  const st = () => page.evaluate(() => window.__app.getState());
  const visible = async sel => (await page.locator(sel).count()) > 0 && await page.locator(sel).first().isVisible();
  const noHScroll = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, body: document.body.scrollWidth }));
  const inView = async sel => page.$$eval(sel, els => els.map(e => { const r = e.getBoundingClientRect(); return { ok: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth && r.width > 0, t: e.textContent.trim().slice(0, 12) }; }));
  // 상대 휘도·대비
  const lum = rgb => { const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const colors = sel => page.$eval(sel, e => { const cs = getComputedStyle(e); let bg = cs.backgroundColor, p = e; while (p && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { p = p.parentElement; if (!p) break; bg = getComputedStyle(p).backgroundColor; } return { fg: cs.color, bg }; });
  // 오늘 복습 시작(이어서 하기 상태면 새로 시작)
  const startToday = async () => { if (await visible('[data-action="start-today"]')) await page.click('[data-action="start-today"]'); else if (await visible('[data-action="restart"]')) await page.click('[data-action="restart"]'); else await page.click('[data-action="resume"]'); await sleep(300); };

  /* ---- 400px: 탭바·모든 화면 이동·가로 스크롤 없음 ---- */
  await page.setViewportSize({ width: 400, height: 800 }); await sleep(300);
  const tabBox = await page.locator('#tabs').boundingBox();
  expect(tabBox && tabBox.y + tabBox.height <= 801 && tabBox.y > 600, 'AC13 400px: 탭바가 하단 고정 (y=' + Math.round(tabBox.y) + ')');
  for (const v of ['home', 'cards', 'history', 'exam', 'print', 'settings']) {
    await page.click('#tab-' + v); await sleep(250);
    const o = await noHScroll();
    expect(await visible('#view-' + v) && o.sw <= o.cw && o.body <= 400, `AC13 400px ${v} 탭 열림·가로 스크롤 없음 (scrollWidth ${o.sw}/${o.cw})`);
    const still = await page.locator('#tabs').boundingBox();
    expect(still && still.y + still.height <= 801, `400px ${v}: 탭바 화면 안 (y=${Math.round(still.y)})`);
  }
  await page.click('#tab-home'); await sleep(200); await shot('m01-home-400');
  const boxes = await inView('.boxes .box');
  expect(boxes.length === 5 && boxes.every(b => b.ok), '400px 홈 상자 5개 모두 화면 안 (' + boxes.filter(b => !b.ok).length + '개 밖)');
  // 카드 탭: 덱 상세·전체 카드 목록
  await page.click('#tab-cards'); await sleep(200);
  if (await visible('[data-action="back-decks"]')) { await page.click('[data-action="back-decks"]'); await sleep(150); }
  await page.locator('.deck-card').first().click(); await sleep(250);
  let o = await noHScroll(); expect(o.sw <= o.cw, '400px 덱 상세 가로 스크롤 없음 (' + o.sw + ')');
  await shot('m02-deck-400');
  await page.click('[data-action="back-decks"]'); await sleep(150); await page.click('[data-action="all-cards"]'); await sleep(250);
  o = await noHScroll(); expect(o.sw <= o.cw, '400px 전체 카드 72장 목록 가로 스크롤 없음 (' + o.sw + ')');
  // 기록 탭 SVG 비율
  await page.click('#tab-history'); await sleep(300);
  const svgW = await page.$$eval('#view-history svg', els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  expect(svgW.length >= 4 && svgW.every(w => w <= 368 && w > 100), '400px 기록 SVG 4개 폭 ≤ 컨테이너 (' + svgW.join(',') + ')');
  await shot('m03-history-400');
  // 설정 탭 간격표(scroll-x 컨테이너)
  await page.click('#tab-settings'); await sleep(250);
  o = await noHScroll(); expect(o.sw <= o.cw, '400px 설정 가로 스크롤 없음 (' + o.sw + ')');
  // 교사 모드 켜서 탭 7개
  await page.check('input[data-action="set-teacher"]'); await sleep(200);
  const tabs = await page.$$eval('#tabs .tab:not([hidden])', els => els.map(e => ({ w: Math.round(e.getBoundingClientRect().width), clip: e.scrollWidth > e.clientWidth + 1, t: e.textContent.trim() })));
  o = await noHScroll();
  expect(tabs.length === 7 && o.sw <= o.cw, '400px 탭 7개(교사 포함) 가로 스크롤 없음 (' + tabs.map(t => t.w).join(',') + ')');
  expect(tabs.every(t => !t.clip && t.w >= 44), '400px 탭 7개 터치 폭 ≥44·글자 안 잘림 (' + tabs.map(t => t.t + ':' + t.w).join(' ') + ')');
  log('[스펙] 좁은 화면 탭 7개 이상이면 "더보기"로 묶음 — 실제: ' + (tabs.length === 7 ? '7개 모두 나열' : ''));
  await page.click('#tab-teacher'); await sleep(200); await page.click('[data-action="teacher-sample"]'); await sleep(300);
  o = await noHScroll(); expect(o.sw <= o.cw && (await page.locator('#unit-table').evaluate(e => e.closest('.scroll-x').scrollWidth >= e.closest('.scroll-x').clientWidth)), '400px 교사 집계 표는 scroll-x 컨테이너 안에서만 넓어짐 (' + o.sw + ')');
  await shot('m04-teacher-400');
  await page.click('#tab-settings'); await sleep(150); await page.uncheck('input[data-action="set-teacher"]'); await sleep(150);
  // 모달 400px
  await page.click('#tab-home'); await sleep(150); await page.click('.fab'); await sleep(250);
  const mb = await page.locator('.modal').boundingBox();
  expect(mb && mb.width <= 400 && mb.x >= 0 && mb.height <= 800, '400px 카드 모달이 화면 안 (' + Math.round(mb.width) + '×' + Math.round(mb.height) + ')');
  const saveBox = await page.locator('.modal [data-value="true"]').boundingBox();
  expect(saveBox && saveBox.y + saveBox.height <= 800, '400px 카드 모달 저장 버튼 보임');
  await shot('m05-modal-400');
  await page.keyboard.press('Escape'); await sleep(150);

  /* ---- AC13 400px 세션: 버튼 모두 보임 ---- */
  await page.click('[data-action="start-today"]'); await sleep(300);
  let btns = await inView('#conf-btns .btn, #flip-btn, [data-action="end-session"]');
  expect(btns.length === 5 && btns.every(b => b.ok), 'AC13 400px 세션 앞면: 확신도 3·뒤집기·종료 버튼 모두 화면 안 (' + btns.filter(b => !b.ok).map(b => b.t).join(',') + ')');
  const kbd = await inView('.kbd-hint'); log('400px 단축키 안내 줄 화면 안: ' + (kbd[0] && kbd[0].ok));
  o = await noHScroll(); expect(o.sw <= o.cw && (await page.evaluate(() => document.getElementById('session').scrollWidth <= document.getElementById('session').clientWidth + 1)), '400px 세션 가로 스크롤 없음');
  await shot('m06-session-front-400');
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(400);
  btns = await inView('#grade-btns .btn, [data-action="hint"]');
  expect(btns.length === 3 && btns.every(b => b.ok), 'AC13 400px 세션 뒷면: 틀렸어요/맞았어요/힌트 버튼 화면 안 (' + btns.filter(b => !b.ok).map(b => b.t).join(',') + ')');
  await shot('m07-session-back-400');
  await page.click('#grade-btns [data-ok="0"]'); await sleep(300);
  if (await visible('#reason-panel')) {
    const chips = await inView('#reason-panel .chip-btn');
    expect(chips.length === 5 && chips.every(b => b.ok), '400px 원인 태그 칩 5개 화면 안');
    await page.click('#reason-panel [data-reason="calc"]'); await sleep(600);
  } else await sleep(500);
  expect(await visible('#session') && (await txt('.session-top .num')).replace(/\s/g, '').split('/')[1] !== undefined, '400px 세션 다음 카드 진행');
  await page.keyboard.press('Escape'); await sleep(300);
  // 인쇄 미리보기 400px(알려진 제한: 페이지 폭)
  await page.click('#tab-print'); await sleep(150);
  await page.locator('[data-action="print-deck"]').first().click(); await sleep(150);
  await page.click('[data-action="print-preview"]'); await sleep(400);
  const pv = await page.evaluate(() => { const v = document.getElementById('print-view'); return { sw: v.scrollWidth, cw: v.clientWidth, pageW: Math.round(document.querySelector('#print-area .page').getBoundingClientRect().width) }; });
  log('400px 인쇄 미리보기: print-view scrollWidth ' + pv.sw + '/' + pv.cw + ', page 폭 ' + pv.pageW);
  expect(pv.sw <= pv.cw + 1, '400px 인쇄 미리보기 컨테이너 가로 스크롤 없음 (' + pv.sw + '/' + pv.cw + ')');
  const pcards = await page.$$eval('#print-area .page:first-child .pcard', els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  expect(pcards.every(w => w > 60), '400px 인쇄 미리보기 카드 칸이 찌그러지지 않음(폭 ' + pcards[0] + ')');
  await shot('m08-print-400');
  await page.click('[data-action="print-back"]'); await sleep(150);

  /* ---- 다크 모드(OS 설정) ---- */
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' }); await reload();
  const bodyBg = await page.$eval('body', e => getComputedStyle(e).backgroundColor);
  expect(lum(bodyBg) < 0.1, '다크 모드: body 배경이 어두움 (' + bodyBg + ')');
  expect((await txt('#theme-btn')).includes('☀️') && (await page.evaluate(() => document.documentElement.dataset.theme)) === undefined, '다크 모드: 저장값 없으면 data-theme 없음(system)·버튼 ☀️');
  const c1 = await colors('#view-home .hero-sub'); expect(contrast(c1.fg, c1.bg) >= 4.5, '다크 본문(muted) 대비 ≥4.5 (' + contrast(c1.fg, c1.bg).toFixed(2) + ')');
  const c2 = await colors('.review-btn'); expect(contrast(c2.fg, c2.bg) >= 4.5, '다크 primary 버튼 대비 ≥4.5 (' + contrast(c2.fg, c2.bg).toFixed(2) + ')');
  const c3 = await colors('.tab[aria-selected="true"]'); expect(contrast(c3.fg, c3.bg) >= 4.5, '다크 선택 탭 대비 ≥4.5 (' + contrast(c3.fg, c3.bg).toFixed(2) + ')');
  const c4 = await colors('.box b'); expect(contrast(c4.fg, c4.bg) >= 4.5, '다크 상자 숫자 대비 (' + contrast(c4.fg, c4.bg).toFixed(2) + ')');
  await shot('t01-home-dark');
  await page.click('#tab-history'); await sleep(300);
  const svgText = await page.$eval('.chart text', e => getComputedStyle(e).fill);
  const panelBg = await page.$eval('.panel.chart', e => getComputedStyle(e).backgroundColor);
  expect(contrast(svgText, panelBg) >= 3, '다크 차트 글자 대비 ≥3 (' + contrast(svgText, panelBg).toFixed(2) + ')');
  const grass = await page.$$eval('.svg-cal .cal-cell', els => [...new Set(els.map(e => getComputedStyle(e).fill))]);
  expect(grass.length >= 4, '다크 잔디 달력 색 단계 구분 (' + grass.length + '색)');
  await shot('t02-history-dark');
  await page.click('#tab-home'); await sleep(150); await startToday();
  const c5 = await colors('.face-front .face-text'); expect(contrast(c5.fg, c5.bg) >= 4.5, '다크 세션 카드 글자 대비 (' + contrast(c5.fg, c5.bg).toFixed(2) + ')');
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(400);
  const c6 = await colors('.face-back .face-text'); expect(contrast(c6.fg, c6.bg) >= 4.5, '다크 세션 뒷면 글자 대비 (' + contrast(c6.fg, c6.bg).toFixed(2) + ')');
  const c7 = await colors('#grade-btns .btn-ok'); expect(contrast(c7.fg, c7.bg) >= 4.5, '[theme] 다크 "맞았어요" 버튼 글자 대비 ≥4.5 (' + contrast(c7.fg, c7.bg).toFixed(2) + ', ' + c7.fg + ' on ' + c7.bg + ')');
  const c8 = await colors('#grade-btns .btn-danger'); expect(contrast(c8.fg, c8.bg) >= 4.5, '[theme] 다크 "틀렸어요" 버튼 글자 대비 ≥4.5 (' + contrast(c8.fg, c8.bg).toFixed(2) + ', ' + c8.fg + ' on ' + c8.bg + ')');
  await shot('t03-session-dark');
  await page.keyboard.press('Escape'); await sleep(300);
  // 라이트 토큰을 다크에서 토글 → light 강제
  await page.click('#theme-btn'); await sleep(100);
  expect((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light' && lum(await page.$eval('body', e => getComputedStyle(e).backgroundColor)) > 0.8, 'OS 다크 + 토글 → light 강제(밝은 배경)');
  await page.click('#theme-btn'); await sleep(100);
  await page.evaluate(() => localStorage.removeItem('edu.memory-box.theme'));
  // 라이트 대비
  await page.emulateMedia({ colorScheme: 'light' }); await reload();
  const l1 = await colors('#view-home .hero-sub'); expect(contrast(l1.fg, l1.bg) >= 4.5, '라이트 muted 글자 대비 ≥4.5 (' + contrast(l1.fg, l1.bg).toFixed(2) + ')');
  const l2 = await colors('.review-btn'); expect(contrast(l2.fg, l2.bg) >= 4.5, '라이트 primary 버튼 대비 ≥4.5 (' + contrast(l2.fg, l2.bg).toFixed(2) + ')');
  const l3 = await colors('.box .box-gap'); expect(contrast(l3.fg, l3.bg) >= 4.5, '라이트 상자 간격 라벨 대비 (' + contrast(l3.fg, l3.bg).toFixed(2) + ')');
  await startToday(); await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(400);
  const l4 = await colors('#grade-btns .btn-ok'); expect(contrast(l4.fg, l4.bg) >= 4.5, '[theme] 라이트 "맞았어요" 버튼 글자 대비 ≥4.5 (' + contrast(l4.fg, l4.bg).toFixed(2) + ', ' + l4.fg + ' on ' + l4.bg + ')');
  const l5 = await colors('#grade-btns .btn-danger'); expect(contrast(l5.fg, l5.bg) >= 4.5, '[theme] 라이트 "틀렸어요" 버튼 글자 대비 ≥4.5 (' + contrast(l5.fg, l5.bg).toFixed(2) + ', ' + l5.fg + ' on ' + l5.bg + ')');
  await page.keyboard.press('Escape'); await sleep(300);

  /* ---- prefers-reduced-motion: 날아가는 애니메이션 생략 ---- */
  await page.emulateMedia({ reducedMotion: 'reduce' }); await reload();
  await startToday();
  const p0 = (await txt('.session-top .num')).replace(/\s/g, '');
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(200);
  await page.click('#grade-btns [data-ok="1"]'); await sleep(50);
  expect((await page.locator('.fly').count()) === 0, 'reduced-motion: .fly 애니메이션 요소 생성 안 함');
  await sleep(200);
  expect((await txt('.session-top .num')).replace(/\s/g, '') !== p0, 'reduced-motion: 즉시 다음 카드');
  await page.keyboard.press('Escape'); await sleep(300);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // 설정 토글로도 생략
  await page.click('#tab-settings'); await sleep(150); await page.check('input[data-action="set-motion"]'); await sleep(100);
  await page.click('#tab-home'); await sleep(150); await startToday();
  await page.click('#conf-btns [data-c="3"]'); await page.click('#flip-btn'); await sleep(200); await page.click('#grade-btns [data-ok="1"]'); await sleep(50);
  expect((await page.locator('.fly').count()) === 0, '설정 "애니메이션 줄이기" 켜면 .fly 생략');
  await page.keyboard.press('Escape'); await sleep(300);
};
