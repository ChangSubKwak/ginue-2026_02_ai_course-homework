// func-03-responsive.js — 분수교구함 QA: 400px 뷰포트(가로 스크롤·44px 타깃·1열)·다크 모드 색·큰 글씨+모바일·토스트 위치 검증 (pw-run.js 모듈)
'use strict';
module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
  const st = () => page.evaluate(() => window.__app.getState());
  const act = (name, ...args) => page.evaluate(([n, a]) => window.__app.actions[n](...a), [name, args]);
  const text = async sel => (await page.locator(sel).evaluate(el => el.textContent)).replace(/\s+/g, ' ').trim();
  const overflow = () => page.evaluate(() => {
    const de = document.documentElement, wide = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > de.clientWidth + 1 && getComputedStyle(el).position !== 'fixed') wide.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : '') + ' right=' + Math.round(r.right));
    }
    return { scroll: de.scrollWidth > de.clientWidth, sw: de.scrollWidth, cw: de.clientWidth, wide: wide.slice(0, 8) };
  });
  const smallButtons = () => page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('button, [role="button"]')) {
      if (b.closest('[hidden]') || b.hidden) continue;
      const r = b.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 44 || r.height < 44) out.push((b.dataset.action || b.dataset.model || b.textContent.trim().slice(0, 8)) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  const checkOverflow = async (label) => {
    const o = await overflow();
    expect(!o.scroll && o.wide.length === 0, `${label}: 가로 스크롤 없음 (scrollWidth ${o.sw}/${o.cw}${o.wide.length ? '; 넘침: ' + o.wide.join(', ') : ''})`);
    return o;
  };

  // ---- AC12: 400px 뷰포트 ----
  await page.setViewportSize({ width: 400, height: 800 });
  await reload();
  await checkOverflow('400px 초기 3/4');
  let small = await smallButtons();
  expect(small.length === 0, '400px: 모든 버튼 44px 이상' + (small.length ? ' (작은 버튼: ' + small.join(', ') + ')' : ''));
  const cols = await page.locator('.layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols === 1, `400px: 레이아웃 1열 (열 수 ${cols})`);
  const stacked = await page.evaluate(() => {
    const b = document.getElementById('model-bar').getBoundingClientRect(), c = document.getElementById('model-circle').getBoundingClientRect(), l = document.getElementById('model-line').getBoundingClientRect();
    return b.bottom <= c.top + 1 && c.bottom <= l.top + 1;
  });
  expect(stacked, '400px: 막대 → 원 → 수직선 세로 1열로 쌓임');
  const barW = await page.locator('#svg-bar').evaluate(el => el.getBoundingClientRect().width);
  expect(barW >= 300 && barW <= 400, `400px: 막대 폭 ${Math.round(barW)}px (화면 폭 활용)`);
  await shot('resp-01-400-initial');
  // 체크박스 라벨(터치 타깃)
  const labelH = await page.locator('.check-row label').first().evaluate(el => el.getBoundingClientRect().height);
  expect(labelH >= 44, `400px: 체크박스 라벨 높이 ${Math.round(labelH)}px ≥ 44`);

  // 가분수·긴 읽기 문자열(23/12)에서 넘침
  await act('setFraction', 23, 12);
  await sleep(100);
  const o2312 = await checkOverflow('400px 23/12(긴 읽기·대분수 문자열)');
  log('23/12 reading: ' + await text('#reading') + ' / mixed: ' + await text('#mixed'));
  await shot('resp-02-400-improper');
  // 동치 사슬 6항
  await act('setFraction', 1, 2);
  for (let i = 0; i < 5; i++) { await act('split', 2); await act('reduce'); }
  await sleep(350);
  await checkOverflow('400px 사슬 6항');
  small = await smallButtons();
  expect(small.length === 0, '400px 사슬 항 버튼 44px 이상' + (small.length ? ' (' + small.join(', ') + ')' : ''));
  // 모달 400px
  await page.click('[data-action="help"]');
  await sleep(100);
  const modalBox = await page.locator('#modal-root .modal').evaluate(el => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height }; });
  expect(modalBox.l >= 0 && modalBox.r <= 400 && modalBox.h <= 800, `400px: 도움말 모달이 화면 안 (left ${Math.round(modalBox.l)}, right ${Math.round(modalBox.r)}, h ${Math.round(modalBox.h)})`);
  const bodyScroll = await page.locator('#modal-root .modal-body').evaluate(el => getComputedStyle(el).overflowY);
  expect(bodyScroll === 'auto' || bodyScroll === 'scroll', '모달 본문 세로 스크롤 가능');
  await shot('resp-03-400-help');
  await page.keyboard.press('Escape');
  // 토스트 위치
  await act('toggleModel', 'bar'); await act('toggleModel', 'circle'); await act('toggleModel', 'line');
  await sleep(300);
  const toastBox = await page.locator('#toast-root .toast').first().evaluate(el => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom }; });
  expect(toastBox.l >= 0 && toastBox.r <= 400 && toastBox.b <= 800, `400px: 토스트가 화면 안 (left ${Math.round(toastBox.l)}, right ${Math.round(toastBox.r)})`);
  await shot('resp-04-400-toast');
  await act('toggleModel', 'bar'); await act('toggleModel', 'circle');

  // 400px + 큰 글씨
  await act('setFraction', 23, 12);
  await page.click('[data-action="big"]');
  await sleep(100);
  await checkOverflow('400px 큰 글씨 23/12');
  await act('setFraction', 3, 4);
  await checkOverflow('400px 큰 글씨 3/4');
  small = await smallButtons();
  expect(small.length === 0, '400px 큰 글씨: 버튼 44px 이상' + (small.length ? ' (' + small.join(', ') + ')' : ''));
  await shot('resp-05-400-big');
  await page.click('[data-action="big"]');

  // 320px(초소형) 참고 점검
  await page.setViewportSize({ width: 320, height: 700 });
  await sleep(100);
  const o320 = await overflow();
  log('320px overflow: ' + JSON.stringify(o320));
  await shot('resp-06-320');

  // ---- AC13: 다크 모드 ----
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => localStorage.clear());
  await reload();
  const light = await page.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    fill: getComputedStyle(document.querySelector('#svg-bar .cell.on')).fill,
    div: getComputedStyle(document.querySelector('#svg-bar .div')).stroke,
    label: getComputedStyle(document.querySelector('#svg-bar .cell-label.on')).fill,
    modelBg: getComputedStyle(document.querySelector('#svg-bar .model-bg')).fill,
  }));
  await page.click('#btn-theme');
  await sleep(100);
  const dark = await page.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    fill: getComputedStyle(document.querySelector('#svg-bar .cell.on')).fill,
    div: getComputedStyle(document.querySelector('#svg-bar .div')).stroke,
    label: getComputedStyle(document.querySelector('#svg-bar .cell-label.on')).fill,
    modelBg: getComputedStyle(document.querySelector('#svg-bar .model-bg')).fill,
    fg: getComputedStyle(document.body).color,
  }));
  expect(light.bg !== dark.bg, `AC13 다크 body 배경 다름 (${light.bg} → ${dark.bg})`);
  expect(light.fill !== dark.fill, `AC13 다크 색칠 색 다름 (${light.fill} → ${dark.fill})`);
  expect(light.div !== dark.div && dark.div !== dark.modelBg, `AC13 다크 분할선 색 다름·모델 배경과 구분 (${dark.div} vs bg ${dark.modelBg})`);
  expect(dark.fill !== dark.modelBg, '다크: 색칠 색과 모델 배경 구분');
  // 쪼개기 애니메이션 선 색(다크)
  await page.click('[data-action="split2"]');
  await sleep(30);
  const newStroke = await page.evaluate(() => { const l = document.querySelector('#svg-bar .div.new'); return l ? getComputedStyle(l).stroke : null; });
  expect(newStroke && newStroke !== dark.modelBg && newStroke !== dark.div, `다크: 새 분할선 강조색 보임 (${newStroke})`);
  await sleep(400);
  // 다크 모드에서 전체 조작 흐름 → 콘솔 오류 없음(러너가 집계)
  await act('setFraction', 7, 4);
  await page.click('#svg-circle .cell[data-i="5"]');
  await page.click('[data-action="help"]'); await sleep(50); await page.keyboard.press('Escape');
  await shot('resp-07-dark-1280');
  // OS 다크 설정(저장값 없음) 추종
  await page.evaluate(() => localStorage.removeItem('edu.fraction-kit.theme'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await reload();
  const osDark = await page.evaluate(() => ({ attr: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, icon: document.getElementById('btn-theme').textContent }));
  expect(osDark.attr === undefined && osDark.bg === dark.bg && osDark.icon === '☀️', `저장 테마 없으면 OS 다크 추종 (attr=${osDark.attr}, icon=${osDark.icon})`);
  await page.click('#btn-theme');
  expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'OS 다크 상태에서 토글 → light 고정');
  await page.emulateMedia({ colorScheme: 'light' });
  // 다크 + 400px
  await page.evaluate(() => localStorage.setItem('edu.fraction-kit.theme', '"dark"'));
  await page.setViewportSize({ width: 400, height: 800 });
  await reload();
  await checkOverflow('400px 다크');
  await shot('resp-08-dark-400');

  // ---- reduced motion에서 동작 ----
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await act('setFraction', 3, 4);
  await page.click('[data-action="split2"]');
  await sleep(100);
  expect((await st()).d === 8, 'reduced-motion에서도 쪼개기 동작');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // ---- 중간 폭(860px 경계) ----
  await page.setViewportSize({ width: 861, height: 800 });
  await reload();
  const c861 = await page.locator('.layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  await page.setViewportSize({ width: 860, height: 800 });
  await sleep(100);
  const c860 = await page.locator('.layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(c861 === 2 && c860 === 1, `861px 2열 / 860px 1열 (실제 ${c861}/${c860})`);
  await checkOverflow('860px');
  await page.setViewportSize({ width: 600, height: 800 });
  await act('setFraction', 23, 12);
  await checkOverflow('600px 23/12');
  await shot('resp-09-600');
};
