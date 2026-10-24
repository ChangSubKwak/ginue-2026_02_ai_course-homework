// ux-theme.js — 테마 토글 버튼·음소거 아이콘 전환·새로고침 유지·도움말 모달 Esc/포커스 복귀 확인
'use strict';
const path = require('path');
module.exports = async ({ page, expect, log, sleep }) => {
  const outdir = path.join(__dirname, 'extra');
  require('fs').mkdirSync(outdir, { recursive: true });
  await page.click('#theme-btn'); await sleep(300);
  const t1 = await page.evaluate(() => [document.documentElement.dataset.theme, document.getElementById('theme-btn').textContent, getComputedStyle(document.body).backgroundColor, localStorage.getItem('edu.math-guardians.theme')]);
  log('after toggle ' + JSON.stringify(t1)); expect(t1[0] === 'dark' && t1[3] === 'dark', '테마 토글 버튼 → dark 저장');
  await page.screenshot({ path: path.join(outdir, 'theme-toggle-dark.png') });
  await page.click('.app-header [data-action="toggle-mute"]'); await sleep(200);
  const m = await page.evaluate(() => [...document.querySelectorAll('[data-action="toggle-mute"]')].map(b => b.textContent + '/' + b.getAttribute('aria-pressed')));
  log('mute icons ' + JSON.stringify(m)); expect(m.every(x => x.startsWith('🔇')), '음소거 아이콘이 헤더·HUD 모두 🔇로 전환');
  await page.screenshot({ path: path.join(outdir, 'muted-header.png'), clip: { x: 640, y: 0, width: 640, height: 80 } });
  await page.reload({ waitUntil: 'load' }); await sleep(700);
  const t2 = await page.evaluate(() => [document.documentElement.dataset.theme, window.__app.getState().muted, document.querySelector('.app-header [data-action="toggle-mute"]').textContent]);
  log('after reload ' + JSON.stringify(t2)); expect(t2[0] === 'dark' && t2[1] === true && t2[2] === '🔇', '새로고침 후 테마·음소거 유지');
  await page.click('#theme-btn'); await sleep(200);
  // 도움말 모달: Enter로 열기 → Esc로 닫기 → 포커스 복귀
  await page.focus('[data-action="help"]'); await page.keyboard.press('Enter'); await sleep(300);
  expect(!!(await page.$('.modal')), '도움말 모달 열림');
  const first = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim());
  log('modal initial focus: ' + first);
  await page.keyboard.press('Escape'); await sleep(300);
  const f = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-action'));
  expect(!(await page.$('.modal')), 'Esc로 도움말 닫힘'); log('focus after close: ' + f); expect(f === 'help', '닫힌 뒤 도움말 버튼으로 포커스 복귀');
  // 잠긴 카드의 시작 버튼 disabled, 닫힌 카드 클릭 시 토스트
  await page.click('[data-action="grade-tab"][data-grade="3"]'); await sleep(200);
  const locked = await page.evaluate(() => { const b = document.querySelector('.stage-card.locked .start-btn'); return b ? { disabled: b.disabled, text: b.textContent, title: document.querySelector('.stage-card.locked .lock').title } : null; });
  log('locked card ' + JSON.stringify(locked)); expect(locked && locked.disabled, '잠긴 카드의 시작 버튼 비활성');
  // 프로필 메뉴 키보드 접근성: Tab으로 li에 도달 가능한지
  await page.click('#profile-btn'); await sleep(200);
  const focusables = await page.evaluate(() => [...document.querySelectorAll('#profile-menu li')].filter(li => li.tabIndex >= 0).length);
  log('profile-menu focusable options: ' + focusables); expect(focusables > 0, '프로필 메뉴 항목이 키보드로 포커스 가능');
  await page.keyboard.press('Escape');
  log('done');
};
