// func-static-problems.node.js — 브라우저 없이 data.js/problems.js를 로드해 17개 생성기 규칙(A1)·3지선다(A2)·소수/분수 표기(A14)·샘플 시딩을 각 600회 검증. 실행: node func-static-problems.node.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = 'D:/workspace/ginue-2026_02_ai_course-homework/05_교육용게임_연산수호대';
const ctx = { window: {}, console };
ctx.window.window = ctx.window; vm.createContext(ctx);
for (const f of ['js/data.js', 'js/problems.js']) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx, { filename: f });
const MG = ctx.window.MG;
const results = { passed: [], failed: [], samples: {} };
const expect = (c, m) => (c ? results.passed : results.failed).push(m);
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
const N = 600;
const digitsSum = (a, b) => (a % 10) + (b % 10);
const check = (sid, fn) => { const bad = []; for (let i = 0; i < N; i++) { const pr = MG.Problems.generate(sid); const r = fn(pr); if (r) bad.push(`${pr.key} (${r})`); if (!results.samples[sid]) results.samples[sid] = []; if (results.samples[sid].length < 4) results.samples[sid].push(`${pr.text} = ${pr.answerText}${pr.choices ? ' ' + JSON.stringify(pr.choices) : ''}`); } expect(bad.length === 0, `${sid} ${N}회 규칙 준수${bad.length ? ' — 위반 ' + bad.length + '건: ' + bad.slice(0, 5).join('; ') : ''}`); };
const common = pr => { if (!pr.key || !pr.text || pr.answer == null || !pr.answerText || !pr.hint || !pr.solution) return '필수 필드 누락'; if (pr.inputType === 'choice3') { if (!pr.choices || pr.choices.length !== 3 || new Set(pr.choices).size !== 3 || pr.choices[pr.correctIndex] !== pr.answerText || pr.answer !== pr.correctIndex) return '3지선다 구조'; } return null; };
check('s1-1', pr => common(pr) || (pr.p.a < 1 || pr.p.a > 8 || pr.p.b < 1 || pr.p.a + pr.p.b > 9 || pr.answer !== pr.p.a + pr.p.b ? '범위' : null));
check('s1-2', pr => common(pr) || (pr.p.b < 1 || pr.p.b >= pr.p.a || pr.p.a > 9 || pr.answer !== pr.p.a - pr.p.b ? '범위' : null));
check('s1-3', pr => common(pr) || (pr.p.a < 10 || pr.p.a > 99 || pr.p.b < 10 || pr.p.b > 99 ? '두 자리' : pr.p.op === 'add' ? (digitsSum(pr.p.a, pr.p.b) > 9 || Math.floor(pr.p.a / 10) + Math.floor(pr.p.b / 10) > 9 ? '받아올림' : null) : (pr.p.a <= pr.p.b || pr.p.a % 10 < pr.p.b % 10 ? '받아내림' : null)));
check('s2-1', pr => common(pr) || (pr.p.a < 10 || pr.p.a > 99 || pr.p.b < 10 || pr.p.b > 99 || digitsSum(pr.p.a, pr.p.b) < 10 || pr.p.a + pr.p.b > 150 ? '규칙' : null));
check('s2-2', pr => common(pr) || (pr.p.a < 10 || pr.p.a > 99 || pr.p.b < 10 || pr.p.b > 99 || pr.p.a <= pr.p.b || pr.p.a % 10 >= pr.p.b % 10 ? '규칙' : null));
check('s2-3', pr => common(pr) || (pr.p.a < 2 || pr.p.a > 9 || pr.p.b < 1 || pr.p.b > 9 || pr.key !== `${pr.p.a}×${pr.p.b}` || pr.hint.model !== 'array' ? '규칙' : null));
check('s3-1', pr => common(pr) || (pr.p.a < 100 || pr.p.a > 899 || pr.p.b < 100 || pr.p.b > 899 ? '범위' : pr.p.op === 'add' ? (pr.p.a + pr.p.b > 999 || MG.Problems.carryCount(pr.p.a, pr.p.b) < 1 ? '받아올림 1회 이상' : null) : (pr.p.a <= pr.p.b || MG.Problems.borrowCount(pr.p.a, pr.p.b) < 1 ? '받아내림' : null)));
check('s3-2', pr => common(pr) || (pr.p.b < 2 || pr.p.b > 9 || pr.answer < 1 || pr.answer > 9 || pr.p.a !== pr.p.b * pr.answer ? '규칙' : null));
check('s3-3', pr => common(pr) || (pr.p.a < 11 || pr.p.a > 99 || pr.p.b < 2 || pr.p.b > 9 || pr.hint.model !== 'text' ? '규칙' : null));
check('s3-4', pr => common(pr) || (pr.p.a < 10 || pr.p.a > 99 || pr.p.b < 2 || pr.p.b > 9 || pr.p.a % pr.p.b === 0 || !/ (몫|나머지)$/.test(pr.key) ? '규칙' : null));
check('s4-1', pr => common(pr) || (pr.p.op === 'mul' ? (pr.p.a < 11 || pr.p.a > 59 || pr.p.b < 11 || pr.p.b > 59 ? '곱셈 범위' : null) : (pr.p.b < 11 || pr.p.b > 29 || pr.answer < 2 || pr.answer > 9 ? '나눗셈 범위' : null)));
check('s4-2', pr => common(pr) || (pr.inputType !== 'choice3' || pr.p.d1 !== pr.p.d2 || pr.p.d1 < 3 || pr.p.d1 > 12 ? '분모' : pr.p.op === 'fsub' && pr.p.n1 <= pr.p.n2 ? '뺄셈 양수' : pr.hint.model !== 'bar' ? '막대' : (!pr.answerText.endsWith('/' + pr.p.d1) && !/^\d+$/.test(pr.answerText)) ? `약분 안 함 위반 '${pr.answerText}'` : null));
check('s4-3', pr => common(pr) || (pr.inputType !== 'decimal' || pr.p.a < 1 || pr.p.a > 99 || pr.p.b < 1 || pr.p.b > 99 ? `범위 a=${pr.p.a / 10} b=${pr.p.b / 10}` : pr.p.op === 'dsub' && pr.p.a <= pr.p.b ? '뺄셈' : !Number.isInteger(pr.answer) || Math.round(parseFloat(pr.answerText) * 100) !== pr.answer ? '×100 정수' : null));
check('s5-1', pr => common(pr) || (pr.p.a < 2 || pr.p.a > 30 || pr.p.b < 2 || pr.p.b > 30 ? '범위' : pr.p.op === 'gcd' ? (gcd(pr.p.a, pr.p.b) < 2 || pr.answer !== gcd(pr.p.a, pr.p.b) ? 'gcd' : null) : (pr.answer > 100 || pr.answer !== pr.p.a / gcd(pr.p.a, pr.p.b) * pr.p.b ? 'lcm' : null)));
check('s5-2', pr => common(pr) || (pr.inputType !== 'choice3' || pr.p.d1 === pr.p.d2 || ![2, 3, 4, 5, 6, 8, 10, 12].includes(pr.p.d1) || ![2, 3, 4, 5, 6, 8, 10, 12].includes(pr.p.d2) || pr.p.n1 >= pr.p.d1 || pr.p.n2 >= pr.p.d2 ? '분모·진분수' : /^\d+\/\d+$/.test(pr.answerText) && gcd(...pr.answerText.split('/').map(Number)) !== 1 ? '기약분수' : null));
check('s5-3', pr => common(pr) || (pr.inputType !== 'decimal' || !Number.isInteger(pr.answer) || Math.round(parseFloat(pr.answerText) * 100) !== pr.answer ? '×100 정수' : pr.p.kb === 0 && (pr.p.b < 1 || pr.p.b > 9) ? '자연수 범위' : null));
check('s6-1', pr => common(pr) || (pr.inputType !== 'choice3' || !/÷/.test(pr.key) ? '구조' : /^\d+\/\d+$/.test(pr.answerText) && gcd(...pr.answerText.split('/').map(Number)) !== 1 ? '기약분수' : null));
check('s6-2', pr => common(pr) || (pr.inputType !== 'decimal' || !Number.isInteger(pr.answer) || Math.round(parseFloat(pr.answerText) * 100) !== pr.answer ? '×100 정수' : pr.p.kb ? (!/^\d+$/.test(pr.answerText) ? '자연수 결과' : null) : (!/^\d+(\.\d)?$/.test(pr.answerText) ? '소수 한 자리' : null)));
check('s6-3', pr => common(pr) || (!Number.isInteger(pr.answer) ? '정수 결과' : pr.p.op === 'pctof' ? (pr.p.n > 200 || ![5, 10, 20, 25, 30, 40, 50, 60, 75, 80].includes(pr.p.p) ? 'pctof' : null) : null));
// 중복 회피: avoid 집합에 든 key는 10회 내 회피
{ let dup = 0; for (let i = 0; i < 200; i++) { const a = MG.Problems.generate('s1-1'); const b = MG.Problems.generate('s1-1', null, new Set([a.key])); if (a.key === b.key) dup++; } expect(dup < 10, `중복 회피 재생성 동작 (200회 중 중복 ${dup})`); }
// 저학년 3지선다 모드
{ let bad = 0; for (let i = 0; i < N; i++) { const pr = MG.Problems.generate('s1-2', { choice: true }); const ans = Number(pr.answerText); if (pr.inputType !== 'choice3' || pr.choices.length !== 3 || !pr.choices.filter((c, j) => j !== pr.correctIndex).every(c => [1, 2, 10].includes(Math.abs(Number(c) - ans)) && Number(c) >= 0)) bad++; } expect(bad === 0, `저학년 3지선다 오답 ±1/±2/±10·음수 없음 (위반 ${bad})`); }
expect(MG.Problems.effectiveInput('s1-1', { lowGradeChoice: true }) === 'choice3' && MG.Problems.effectiveInput('s2-3', { lowGradeChoice: true }) === 'number', '저학년 3지선다 적용 범위 1-1~2-2');
// 표기 유틸
expect(MG.Problems.fmtDec(420, 2) === '4.2' && MG.Problems.fmtDec(500, 2) === '5' && MG.Problems.fmtDec(7, 1) === '0.7', 'fmtDec 뒤 0 제거');
expect(MG.Problems.fmtFrac(7, 5) === '1 2/5' && MG.Problems.fmtFrac(4, 2) === '2' && MG.Problems.fmtFrac(6, 8) === '3/4' && MG.Problems.fmtFrac(6, 8, true) === '6/8', 'fmtFrac 대분수·자연수·기약·유지');
// 스테이지 메타
expect(MG.STAGES.length === 19 && MG.STAGES.filter(s => s.inputType === 'choice3').length === 3 && MG.STAGES.filter(s => s.inputType === 'decimal').length === 3 && MG.STAGES.filter(s => s.gridFacts).length === 1, `스테이지 19개(스펙이 열거한 전부; 스펙 본문의 '17개'는 집계 오류)·3지선다 3·소수 3·히트맵 1 (실제 ${MG.STAGES.length})`);
// 샘플 시딩
const root = MG.seedSample();
const by = n => root.profiles.find(p => p.name === n);
const tot = p => Object.values(p.stageRecords).reduce((s, r) => s + r.bestStars, 0);
expect(root.schemaVersion === 1 && root.profiles.length === 24 && root.activeProfileId === by('김하늘').id, '시딩: 24명·활성 김하늘');
expect(root.profiles.every((p, i) => p.number === i + 1 && p.grade === 5 && p.classNo === 2), '시딩: 번호 1~24·5학년 2반');
expect(tot(by('김하늘')) === 16 && tot(by('이도윤')) === 5 && tot(by('박서아')) === 11 && tot(by('최민준')) === 19 && tot(by('정하윤')) === 23 && tot(by('한수아')) === 1, `시딩: 총 별 ${['김하늘', '이도윤', '박서아', '최민준', '정하윤', '한수아'].map(n => tot(by(n))).join('/')}`);
expect(root.profiles.filter(p => Object.keys(p.stageRecords).length).length === 6, '시딩: 기록 보유 6명');
expect(by('김하늘').stageRecords['s2-3'].bestScore === 19800 && by('최민준').stageRecords['s2-3'].bestScore === 28400 && by('정하윤').stageRecords['s2-3'].bestScore === 24150, '시딩: 2-3 점수');
expect(by('이도윤').facts['8×7'].box === 0 && by('이도윤').facts['8×7'].miss === 3 && Object.values(by('이도윤').facts).filter(f => f.box < 2 && f.miss >= 1).length === 7, '시딩: 이도윤 약점 7개(8×7 miss 3)');
expect(by('박서아').playDates.length === 7 && by('박서아').badges.some(b => b.id === 'streak7'), '시딩: 박서아 7일 연속·streak7');
const g7 = p => Object.values(p.facts).filter(f => f.masteredAt && Date.now() - new Date(f.masteredAt).getTime() <= 7 * 86400000).length;
expect(g7(by('박서아')) === 18 && root.profiles.every(p => p.name === '박서아' || g7(p) < 18), `시딩: 박서아 최근 7일 숙달 18개(성장 1위) — ${g7(by('박서아'))}`);
expect(Object.values(by('정하윤').facts).filter(f => f.stageId === 's2-3' && f.box >= 2).length === 60, `시딩: 정하윤 구구단 숙달 60개 (${Object.values(by('정하윤').facts).filter(f => f.stageId === 's2-3' && f.box >= 2).length})`);
expect(by('김하늘').skin === 'gold' && by('최민준').theme === 'desert' && by('최민준').skin === 'gold', '시딩: 스킨·테마');
expect(root.settings.timeLimitMin === 5 && root.settings.activeStageIds.length === 19 &&root.settings.volume === 0.4 && root.settings.rankingPublic === true, '시딩: 설정 기본값');
// 소스 정적 점검
const src = ['js/data.js', 'js/problems.js', 'js/audio.js', 'js/game.js', 'js/ui.js', 'js/app.js', 'index.html'].map(f => fs.readFileSync(path.join(APP, f), 'utf8')).join('\n');
expect(!/\b(window\.)?(alert|confirm|prompt)\s*\(/.test(src), 'AC18 alert/confirm/prompt 호출 없음');
expect(!/\bfetch\s*\(|XMLHttpRequest|type="module"|\bimport\s|\bexport\s/.test(src), 'fetch/XHR/ES 모듈 없음');
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
expect(/<link[^>]+fonts\.googleapis\.com/.test(html) && !/<script[^>]+src="https?:/.test(html) && (html.match(/<script src="js\//g) || []).length === 6, '외부 스크립트 없음·Google Fonts link 1개·로컬 스크립트 6개');
expect(/--font-body:[^;]*"Malgun Gothic"[^;]*sans-serif/.test(fs.readFileSync(path.join(APP, 'css/style.css'), 'utf8')) && /--font-display:[^;]*"Malgun Gothic"/.test(fs.readFileSync(path.join(APP, 'css/style.css'), 'utf8')), '시스템 폰트 대체 스택(--font-body/--font-display)');
results.summary = `${results.passed.length} passed, ${results.failed.length} failed`;
fs.writeFileSync(path.join(__dirname, 'func-out', 'func-static-problems.result.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
process.exit(results.failed.length ? 1 : 0);
