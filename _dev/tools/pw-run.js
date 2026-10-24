// pw-run.js — 인터랙티브 수용 테스트 러너 (Playwright + 시스템 Edge)
// 사용법: node pw-run.js <index.html 경로 또는 URL> <테스트 모듈.js> [결과 폴더]
// 테스트 모듈 형식:
//   module.exports = async ({ page, expect, shot, log, sleep, reload }) => {
//     await page.click('#tab-groups');
//     expect(await page.locator('.group-card').count() === 6, '모둠 6개 표시');
//     await shot('groups-6');            // 결과 폴더에 groups-6.png 저장
//   };
// expect(조건, 설명)은 실패해도 멈추지 않고 기록합니다. 끝에 JSON 요약(passed/failed/오류)을 출력합니다.
// 기본 뷰포트 1280x800, 라이트 테마, locale ko-KR. localStorage는 매 실행마다 새 컨텍스트(비어 있음)로 시작합니다.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

function toUrl(target) {
  if (/^(https?|file):/i.test(target)) return target;
  return 'file:///' + path.resolve(target).replace(/\\/g, '/');
}

(async () => {
  const [, , target, testFile, outdirArg] = process.argv;
  if (!target || !testFile) { console.error('usage: node pw-run.js <path-or-url> <test.js> [outdir]'); process.exit(2); }
  const outdir = outdirArg || path.join(path.dirname(path.resolve(testFile)), 'out');
  fs.mkdirSync(outdir, { recursive: true });
  const testFn = require(path.resolve(testFile));
  const url = toUrl(target);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR', colorScheme: 'light' });
  const page = await ctx.newPage();
  const result = { url, test: path.basename(testFile), passed: [], failed: [], logs: [], pageErrors: [], consoleErrors: [], dialogs: [], screenshots: [], fatal: null };
  page.on('pageerror', e => result.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push(m.text()); });
  page.on('dialog', async d => { result.dialogs.push(d.type() + ': ' + d.message()); await d.dismiss(); });
  const helpers = {
    page, browser, ctx,
    expect: (cond, msg) => { (cond ? result.passed : result.failed).push(msg); return !!cond; },
    shot: async (name) => { const p = path.join(outdir, name + '.png'); await page.screenshot({ path: p, fullPage: true }); result.screenshots.push(p); return p; },
    log: (m) => result.logs.push(String(m)),
    sleep: (ms) => page.waitForTimeout(ms),
    reload: async () => { await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500); },
  };
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await testFn(helpers);
  } catch (e) {
    result.fatal = (e && e.stack) ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e);
  }
  await browser.close();
  result.summary = result.passed.length + ' passed, ' + result.failed.length + ' failed, ' + result.pageErrors.length + ' page errors, ' + result.consoleErrors.length + ' console errors' + (result.fatal ? ', FATAL' : '');
  fs.writeFileSync(path.join(outdir, path.basename(testFile, '.js') + '.result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.failed.length || result.fatal || result.pageErrors.length ? 1 : 0);
})().catch(e => { console.error('pw-run FAILED:', e.message); process.exit(3); });
