// fix-r1-run-group.js — 테스트 모듈 여러 개를 순서대로 pw-run.js로 실행하고 요약(passed/failed/오류)을 한 JSON에 모은다.
// 사용법: node fix-r1-run-group.js <그룹이름> <모듈1.js> [모듈2.js ...]
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/workspace/ginue-2026_02_ai_course-homework';
const APP = `${ROOT}/05_교육용게임_연산수호대/index.html`;
const RUNNER = `${ROOT}/_dev/tools/pw-run.js`;
const HERE = __dirname;
const [, , group, ...mods] = process.argv;
const outRoot = path.join(HERE, 'fix-r1-out', group);
fs.mkdirSync(outRoot, { recursive: true });
const summary = {};
for (const m of mods) {
  const name = m.replace(/\.js$/, '');
  const outdir = path.join(outRoot, name);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [RUNNER, APP, path.join(HERE, m), outdir], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PYTHONUTF8: '1' } });
  const text = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(path.join(outdir, 'stdout.txt'), text);
  let parsed = null;
  try { const i = text.lastIndexOf('\n{'); parsed = JSON.parse(text.slice(i >= 0 ? i + 1 : 0)); } catch (e) { parsed = null; }
  if (!parsed) { const files = fs.existsSync(outdir) ? fs.readdirSync(outdir).filter(f => /result\.json$/i.test(f)) : []; if (files.length) { try { parsed = JSON.parse(fs.readFileSync(path.join(outdir, files[0]), 'utf8')); } catch (e) { /* 무시 */ } } }
  summary[name] = parsed ? { passed: parsed.passed.length, failed: parsed.failed.length, failedList: parsed.failed, pageErrors: parsed.pageErrors, consoleErrors: parsed.consoleErrors, dialogs: parsed.dialogs, fatal: parsed.fatal, secs: Math.round((Date.now() - t0) / 1000) }
    : { error: 'no-json', exit: r.status, tail: text.slice(-800), secs: Math.round((Date.now() - t0) / 1000) };
  fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(summary, null, 2));
}
console.log(JSON.stringify(summary, null, 2));
