// run-mods.js — pw-run.js로 테스트 모듈을 차례로 실행하고 요약(통과/실패/페이지 오류/치명 오류)만 출력
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const TOOLS = 'C:\\Users\\parad\\AppData\\Local\\Temp\\claude\\D--workspace-ginue-2026-02-ai-course-homework\\1716854d-9f4f-4d06-ba55-fb3e97031963\\scratchpad\\tools';
const TESTS = 'C:\\Users\\parad\\AppData\\Local\\Temp\\claude\\D--workspace-ginue-2026-02-ai-course-homework\\1716854d-9f4f-4d06-ba55-fb3e97031963\\scratchpad\\tests\\memory-box';
const APP = 'D:\\workspace\\ginue-2026_02_ai_course-homework\\02_학습지도_기억상자\\index.html';
const mods = process.argv.slice(2);
const summary = {};
for (const m of mods) {
  const out = path.join(TESTS, 'fix-r1', m);
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(TOOLS, 'pw-run.js'), APP, path.join(TESTS, m + '.js'), out], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const resFile = path.join(out, m + '.result.json');
  let res = null; try { res = JSON.parse(fs.readFileSync(resFile, 'utf8')); } catch (e) { /* 없음 */ }
  const sec = Math.round((Date.now() - t0) / 1000);
  if (!res) { console.log(`### ${m}: 결과 파일 없음 (${sec}s)\n` + (r.stderr || '').slice(-800)); summary[m] = 'no result'; continue; }
  console.log(`### ${m}: ${res.summary} (${sec}s)`);
  res.failed.forEach(f => console.log('  FAIL: ' + f));
  res.pageErrors.forEach(e => console.log('  PAGEERR: ' + e));
  res.consoleErrors.slice(0, 5).forEach(e => console.log('  CONSOLE: ' + e.slice(0, 200)));
  if (res.dialogs.length) console.log('  DIALOGS: ' + res.dialogs.join(' | '));
  if (res.fatal) console.log('  FATAL: ' + res.fatal);
  summary[m] = `${res.passed.length} passed / ${res.failed.length} failed` + (res.pageErrors.length ? ` / pageErrors ${res.pageErrors.length}` : '') + (res.fatal ? ' / FATAL' : '');
}
console.log('SUMMARY ' + JSON.stringify(summary));
