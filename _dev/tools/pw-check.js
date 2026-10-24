// pw-check.js — 정적 웹앱 스모크 점검 (Playwright + 시스템 Edge)
// 사용법: node pw-check.js <index.html 경로 또는 URL> <결과 폴더>
// 출력: 콘솔 오류/페이지 예외/실패한 요청, 가로 스크롤 여부, 3개 뷰(데스크톱 라이트/다크, 모바일 400px) 스크린샷, report.json
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

function toUrl(target) {
  if (/^(https?|file):/i.test(target)) return target;
  return 'file:///' + path.resolve(target).replace(/\\/g, '/');
}

(async () => {
  const [, , target, outdir] = process.argv;
  if (!target || !outdir) { console.error('usage: node pw-check.js <path-or-url> <outdir>'); process.exit(2); }
  fs.mkdirSync(outdir, { recursive: true });
  const url = toUrl(target);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const report = { url, consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], dialogs: [], views: {} };

  async function view(name, opts) {
    const ctx = await browser.newContext({ viewport: opts.viewport, colorScheme: opts.colorScheme, locale: 'ko-KR', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('console', m => {
      const t = m.type(); const line = '[' + name + '] ' + m.text();
      if (t === 'error') report.consoleErrors.push(line); else if (t === 'warning') report.consoleWarnings.push(line);
    });
    page.on('pageerror', e => report.pageErrors.push('[' + name + '] ' + e.message));
    page.on('requestfailed', r => report.failedRequests.push('[' + name + '] ' + r.url() + ' ' + ((r.failure() || {}).errorText || '')));
    page.on('dialog', async d => { report.dialogs.push('[' + name + '] ' + d.type() + ': ' + d.message()); await d.dismiss(); });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => {
      const de = document.documentElement;
      const wide = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > de.clientWidth + 2 && getComputedStyle(el).position !== 'fixed') {
          const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
          wide.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls + ' right=' + Math.round(r.right));
          if (wide.length >= 8) break;
        }
      }
      return {
        title: document.title, lang: de.lang, hasDoctype: !!document.doctype,
        clientWidth: de.clientWidth, scrollWidth: de.scrollWidth,
        horizontalOverflow: de.scrollWidth > de.clientWidth + 1 || document.body.scrollWidth > de.clientWidth + 1,
        elementsPastRightEdge: wide,
        headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 25).map(h => h.tagName + ': ' + h.textContent.trim().slice(0, 60)),
        buttons: document.querySelectorAll('button,[role=button],input[type=button],input[type=submit]').length,
        inputs: document.querySelectorAll('input,select,textarea').length,
        textLength: document.body.innerText.length,
        externalScripts: [...document.scripts].map(s => s.src).filter(Boolean).filter(s => !s.startsWith('file:')),
        externalStyles: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href).filter(h => !h.startsWith('file:')),
        usesModules: [...document.scripts].some(s => s.type === 'module'),
        bodyBg: getComputedStyle(document.body).backgroundColor, bodyColor: getComputedStyle(document.body).color,
        rootDataTheme: de.getAttribute('data-theme'),
        firstText: document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 400),
      };
    });
    const shot = path.join(outdir, name + '.png');
    await page.screenshot({ path: shot, fullPage: true });
    report.views[name] = Object.assign(info, { screenshot: shot });
    await ctx.close();
  }

  await view('desktop-light', { viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  await view('desktop-dark', { viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await view('mobile-light', { viewport: { width: 400, height: 800 }, colorScheme: 'light' });
  await browser.close();

  const v = report.views['desktop-light'];
  const problems = [];
  if (report.pageErrors.length) problems.push('페이지 예외 ' + report.pageErrors.length + '건');
  if (report.consoleErrors.length) problems.push('콘솔 오류 ' + report.consoleErrors.length + '건');
  if (report.failedRequests.length) problems.push('실패한 요청 ' + report.failedRequests.length + '건');
  if (report.dialogs.length) problems.push('alert/confirm/prompt 사용 ' + report.dialogs.length + '건');
  for (const [name, info] of Object.entries(report.views)) if (info.horizontalOverflow) problems.push(name + ': 가로 스크롤 발생 (scrollWidth ' + info.scrollWidth + ' > ' + info.clientWidth + ')');
  if (!v.hasDoctype) problems.push('doctype 없음');
  if (v.lang !== 'ko') problems.push('html lang="' + v.lang + '" (ko 권장)');
  if (v.usesModules) problems.push('type="module" 사용 (file://에서 차단될 수 있음)');
  if (v.externalScripts.length) problems.push('외부 스크립트: ' + v.externalScripts.join(', '));
  const nonFont = v.externalStyles.filter(s => !/fonts\.googleapis\.com/.test(s));
  if (nonFont.length) problems.push('외부 스타일시트(폰트 외): ' + nonFont.join(', '));
  if (report.views['desktop-dark'].bodyBg === v.bodyBg) problems.push('다크 모드에서 body 배경이 라이트와 동일 (테마 토큰 미적용 가능)');
  if (v.textLength < 50) problems.push('첫 화면에 텍스트가 거의 없음(샘플 데이터 미표시?)');
  report.problems = problems;
  fs.writeFileSync(path.join(outdir, 'report.json'), JSON.stringify(report, null, 2));
  const summary = {
    url, problems, title: v.title, headings: v.headings.slice(0, 12), buttons: v.buttons, inputs: v.inputs,
    pageErrors: report.pageErrors, consoleErrors: report.consoleErrors.slice(0, 20), consoleWarnings: report.consoleWarnings.slice(0, 10),
    failedRequests: report.failedRequests.slice(0, 10), dialogs: report.dialogs,
    overflowElements: Object.fromEntries(Object.entries(report.views).map(([k, i]) => [k, i.elementsPastRightEdge])),
    screenshots: Object.values(report.views).map(i => i.screenshot), firstText: v.firstText,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error('pw-check FAILED:', e.message); process.exit(3); });
