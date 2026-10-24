// 사용: node _run.js <module.js> <outdir>  — pw-run.js 실행 후 요약만 출력
'use strict';
const { spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const [, , mod, out] = process.argv;
const runner = path.resolve(__dirname, '../../tools/pw-run.js');
const app = 'D:/workspace/ginue-2026_02_ai_course-homework/04_행정지원_특별실지기/index.html';
fs.mkdirSync(path.resolve(__dirname, out), { recursive: true });
const r = spawnSync('node', [runner, app, path.resolve(__dirname, mod), path.resolve(__dirname, out)], { encoding: 'utf8', maxBuffer: 1 << 26 });
fs.writeFileSync(path.resolve(__dirname, out, 'run.log'), (r.stdout || '') + (r.stderr || ''));
const resPath = path.resolve(__dirname, out, path.basename(mod, '.js') + '.result.json');
if (!fs.existsSync(resPath)) { console.log('NO RESULT; stderr:', (r.stderr || '').slice(0, 1500)); process.exit(1); }
const j = JSON.parse(fs.readFileSync(resPath, 'utf8'));
console.log('MODULE:', mod, '\nSUMMARY:', j.summary, '\nFAILED:', JSON.stringify(j.failed, null, 1), '\nLOGS:', j.logs.join('\n'), '\nPAGEERR:', JSON.stringify(j.pageErrors), '\nCONSOLE:', JSON.stringify(j.consoleErrors), '\nDIALOGS:', JSON.stringify(j.dialogs), '\nFATAL:', j.fatal);
