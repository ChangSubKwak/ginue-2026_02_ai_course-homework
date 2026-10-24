// code-gen.node.js — problems.js 생성기 규칙(A1/A2/A14)·data.js 샘플 시딩을 node에서 순수 함수로 검증
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = 'D:/workspace/ginue-2026_02_ai_course-homework/05_교육용게임_연산수호대';
global.window = global; window.MG = {};
for (const f of ['js/data.js', 'js/problems.js']) vm.runInThisContext(fs.readFileSync(path.join(APP, f), 'utf8'), { filename: f });
const MG = window.MG, P = MG.Problems;
const N = 4000;
const checks = [], stats = {};
const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
const gen = (sid, opts) => P.generate(sid, opts);
const digits = n => String(n).length;
const bad = {};
const note = (k, s) => { (bad[k] = bad[k] || []).length < 5 && bad[k].push(s); };

// 공통: 모든 스테이지 N회 생성 → 예외 없음, choice3는 선택지 3개·유일·정답 포함
for (const st of MG.STAGES) {
  let err = null, badChoice = 0, keyText = 0;
  for (let i = 0; i < N; i++) {
    try {
      const pr = gen(st.id);
      if (pr.inputType === 'choice3') {
        const u = new Set(pr.choices);
        if (pr.choices.length !== 3 || u.size !== 3 || pr.choices[pr.correctIndex] !== pr.answerText || pr.answer !== pr.correctIndex) { badChoice++; note(st.id + ' choice', JSON.stringify(pr.choices) + ' ans=' + pr.answerText); }
      }
      if (!pr.key || !pr.text || pr.answerText == null) keyText++;
    } catch (e) { err = e.message; break; }
  }
  check(`${st.id} 생성 ${N}회 예외 없음`, !err, err);
  if (st.inputType === 'choice3') check(`${st.id} 3지선다: 선택지 3개·중복 없음·정답 포함`, badChoice === 0, `불량 ${badChoice}건 ${JSON.stringify(bad[st.id + ' choice'] || [])}`);
}

// 스테이지별 규칙(A1)
const rule = (sid, name, fn) => { let fail = 0, ex = []; for (let i = 0; i < N; i++) { const pr = gen(sid); if (!fn(pr.p, pr)) { fail++; if (ex.length < 4) ex.push(pr.key); } } check(`${sid} 규칙: ${name}`, fail === 0, `위반 ${fail}/${N} 예 ${ex.join(' | ')}`); };
rule('s1-1', '1≤a,b≤8, a+b≤9', p => p.op === 'add' && p.a >= 1 && p.a <= 8 && p.b >= 1 && p.b <= 8 && p.a + p.b <= 9);
rule('s1-2', '1≤b<a≤9', p => p.op === 'sub' && p.b >= 1 && p.b < p.a && p.a <= 9);
rule('s1-3', '두 자리, 덧셈 받아올림 0 / 뺄셈 받아내림 0·a>b', p => digits(p.a) === 2 && digits(p.b) === 2 && (p.op === 'add' ? P.carryCount(p.a, p.b) === 0 : (p.a > p.b && P.borrowCount(p.a, p.b) === 0)));
rule('s2-1', '10~99, 일의 자리 합≥10, 합≤150', p => p.a >= 10 && p.a <= 99 && p.b >= 10 && p.b <= 99 && p.a % 10 + p.b % 10 >= 10 && p.a + p.b <= 150);
rule('s2-2', '10~99, a>b, a일<b일', p => p.a >= 10 && p.a <= 99 && p.b >= 10 && p.b <= 99 && p.a > p.b && p.a % 10 < p.b % 10);
rule('s2-3', 'a 2~9, b 1~9', p => p.a >= 2 && p.a <= 9 && p.b >= 1 && p.b <= 9);
rule('s3-1', '100~899, 덧셈 합≤999·받아올림≥1 / 뺄셈 a>b·받아내림≥1', p => p.a >= 100 && p.a <= 899 && p.b >= 100 && p.b <= 899 && (p.op === 'add' ? (p.a + p.b <= 999 && P.carryCount(p.a, p.b) >= 1) : (p.a > p.b && P.borrowCount(p.a, p.b) >= 1)));
rule('s3-2', 'b 2~9, a=b×q, q 1~9', p => p.b >= 2 && p.b <= 9 && p.a % p.b === 0 && p.a / p.b >= 1 && p.a / p.b <= 9);
rule('s3-3', 'a 11~99, b 2~9', p => p.a >= 11 && p.a <= 99 && p.b >= 2 && p.b <= 9);
rule('s3-4', 'a 10~99, b 2~9, a mod b≠0', p => p.a >= 10 && p.a <= 99 && p.b >= 2 && p.b <= 9 && p.a % p.b !== 0);
rule('s4-1', 'mul 11~59 / div b 11~29·q 2~9', p => p.op === 'mul' ? (p.a >= 11 && p.a <= 59 && p.b >= 11 && p.b <= 59) : (p.b >= 11 && p.b <= 29 && p.a % p.b === 0 && p.a / p.b >= 2 && p.a / p.b <= 9));
rule('s4-2', 'd 3~12, 덧셈 n1+n2≤2d−1 / 뺄셈 n1>n2≥1, 분모 유지', (p, pr) => p.d1 === p.d2 && p.d1 >= 3 && p.d1 <= 12 && (p.op === 'fadd' ? (p.n1 >= 1 && p.n2 >= 1 && p.n1 + p.n2 <= 2 * p.d1 - 1) : (p.n1 > p.n2 && p.n2 >= 1)) && pr.answerText.replace(/^\d+ /, '').match(/\/(\d+)$/) ? +pr.answerText.match(/\/(\d+)$/)[1] === p.d1 : true);
rule('s4-3', '0.1~9.9, 뺄셈 a>b, answer=(a±b)×10', (p, pr) => p.a >= 1 && p.a <= 100 && p.b >= 1 && p.b <= 99 && (p.op === 'dadd' ? pr.answer === (p.a + p.b) * 10 : (p.a > p.b && pr.answer === (p.a - p.b) * 10)));
rule('s5-1', '2~30, gcd≥2 / lcm≤100', p => p.a >= 2 && p.a <= 30 && p.b >= 2 && p.b <= 30 && (p.op === 'gcd' ? P.gcd(p.a, p.b) >= 2 : P.lcm(p.a, p.b) <= 100));
rule('s5-2', '서로 다른 분모∈{2,3,4,5,6,8,10,12}, 진분수, 뺄셈>0', p => p.d1 !== p.d2 && [2, 3, 4, 5, 6, 8, 10, 12].includes(p.d1) && [2, 3, 4, 5, 6, 8, 10, 12].includes(p.d2) && p.n1 < p.d1 && p.n2 < p.d2 && (p.op === 'fadd' || p.n1 * p.d2 > p.n2 * p.d1));
rule('s5-3', '×100 정수 답', (p, pr) => Number.isInteger(pr.answer) && pr.answer === p.a * p.b * Math.pow(10, 2 - p.ka - p.kb));
rule('s6-1', '결과 기약분수 표기', (p, pr) => { const m = pr.answerText.match(/(\d+)\/(\d+)$/); return !m || P.gcd(+m[1], +m[2]) === 1; });
rule('s6-2', '나누어떨어짐(×100 정수), 소수÷소수는 자연수', (p, pr) => Number.isInteger(pr.answer) && (p.kb === 0 || pr.answer % 100 === 0));
rule('s6-3', '정수 답, pctof n≤200', (p, pr) => Number.isInteger(pr.answer) && (p.op !== 'pctof' || p.n <= 200));

// 소수 스테이지가 정수 피연산자 문제를 만드는 빈도 + 저학년 사실 key 충돌
const keys23 = new Set(); for (let a = 2; a <= 9; a++) for (let b = 1; b <= 9; b++) keys23.add(`${a}×${b}`);
const keys11 = new Set(); for (let a = 1; a <= 8; a++) for (let b = 1; b <= 9 - a; b++) keys11.add(`${a}+${b}`);
const cnt = sid => { let intOps = 0, collide = 0, ex = []; for (let i = 0; i < N; i++) { const pr = gen(sid); const isInt = !/\./.test(pr.text); if (isInt) { intOps++; if (ex.length < 5) ex.push(pr.text); } if (keys23.has(pr.key) || keys11.has(pr.key)) collide++; } return { intOps, collide, ex, pct: (intOps / N * 100).toFixed(1) + '%', collidePct: (collide / N * 100).toFixed(1) + '%' }; };
stats.decimalInteger = { 's4-3': cnt('s4-3'), 's5-3': cnt('s5-3'), 's6-2': cnt('s6-2') };
check('s5-3 소수의 곱셈: 소수점 없는 정수×정수 문제가 생성되지 않음', stats.decimalInteger['s5-3'].intOps === 0, JSON.stringify(stats.decimalInteger['s5-3']));
check('s4-3 소수의 덧셈·뺄셈: 정수±정수 문제가 생성되지 않음', stats.decimalInteger['s4-3'].intOps === 0, JSON.stringify(stats.decimalInteger['s4-3']));
check('s6-2 소수의 나눗셈: 정수÷정수 문제가 생성되지 않음', stats.decimalInteger['s6-2'].intOps === 0, JSON.stringify(stats.decimalInteger['s6-2']));

// 4-1 나눗셈 힌트 모델(스펙 text) / 4-2 오답 선택지 표기(분모 유지 여부)
{ let arr = 0, div = 0; for (let i = 0; i < N; i++) { const pr = gen('s4-1'); if (pr.p.op === 'div') { div++; if (pr.hint.model === 'array') arr++; } } stats.s41divArrayHint = { div, arrayHint: arr }; check('s4-1 나눗셈 힌트 모델이 스펙대로 text', arr === 0, `array 모델 ${arr}/${div}`); }
{ let mixedFmt = 0, ex = []; for (let i = 0; i < N; i++) { const pr = gen('s4-2'); const d = pr.p.d1; const wrong = pr.choices.filter((c, i) => i !== pr.correctIndex); const off = wrong.filter(c => { const m = c.match(/\/(\d+)$/); return m && +m[1] !== d; }); if (off.length) { mixedFmt++; if (ex.length < 5) ex.push(`${pr.text} → ${pr.choices.join(' , ')}`); } } stats.s42choiceDenoms = { mixedFmt, pct: (mixedFmt / N * 100).toFixed(1) + '%', ex }; check('s4-2 오답 선택지도 정답과 같은 분모 d로 표기', mixedFmt === 0, JSON.stringify(stats.s42choiceDenoms)); }

// 저학년 3지선다 모드
for (const sid of MG.LOW_GRADE) { let fail = 0; for (let i = 0; i < 1000; i++) { const pr = gen(sid, { choice: true }); const u = new Set(pr.choices); if (pr.inputType !== 'choice3' || pr.choices.length !== 3 || u.size !== 3 || pr.choices.some(c => +c < 0) || pr.choices[pr.correctIndex] !== pr.answerText) fail++; } check(`${sid} 저학년 3지선다 모드 선택지 유효`, fail === 0, `불량 ${fail}`); }

// 중복 회피 교착 방지
{ const avoid = new Set(keys23); const t = Date.now(); const pr = P.generate('s2-3', {}, avoid); check('generate: 모든 key 회피 시에도 10회 후 반환(교착 없음)', !!pr && Date.now() - t < 1000, pr && pr.key); }

// 표기 유틸(A14)
check("fmtDec(420,2)='4.2'", P.fmtDec(420, 2) === '4.2', P.fmtDec(420, 2));
check("fmtDec(100,1)='10'", P.fmtDec(100, 1) === '10', P.fmtDec(100, 1));
check("fmtDec(5,1)='0.5'", P.fmtDec(5, 1) === '0.5', P.fmtDec(5, 1));
check("fmtFrac(9,6,true)='1 3/6'", P.fmtFrac(9, 6, true) === '1 3/6', P.fmtFrac(9, 6, true));
check("fmtFrac(9,6)='1 1/2'", P.fmtFrac(9, 6) === '1 1/2', P.fmtFrac(9, 6));
check("fmtFrac(4,2)='2'", P.fmtFrac(4, 2) === '2', P.fmtFrac(4, 2));
check('carryCount(47,38)=1 / borrowCount(503,178)=2', P.carryCount(47, 38) === 1 && P.borrowCount(503, 178) === 2, `${P.carryCount(47, 38)} / ${P.borrowCount(503, 178)}`);
check("gcd key 조사: 12와/15와/16과/20과", (() => { const k = n => P.build('s5-1', { op: 'gcd', a: n, b: 18 }).key.split(' ')[0]; return k(12) === '12와' && k(15) === '15와' && k(16) === '16과' && k(20) === '20과'; })());

// 샘플 시딩(data.js) — 스펙 sample_data 대조
const root = MG.seedSample();
const byName = n => root.profiles.find(p => p.name === n);
const ts = p => Object.values(p.stageRecords).reduce((s, r) => s + r.bestStars, 0);
check('프로필 24명, 번호 1~24, 학년 5 반 2', root.profiles.length === 24 && root.profiles.every((p, i) => p.number === i + 1 && p.grade === 5 && p.classNo === 2));
check('활성 프로필 = 김하늘', root.activeProfileId === byName('김하늘').id);
check('기록 보유 6명만', root.profiles.filter(p => Object.keys(p.stageRecords).length).map(p => p.name).sort().join() === ['김하늘', '이도윤', '박서아', '최민준', '정하윤', '한수아'].sort().join(), root.profiles.filter(p => Object.keys(p.stageRecords).length).map(p => p.name).join());
check('총 별: 정하윤23/최민준19/김하늘16/박서아11/이도윤5/한수아1', [23, 19, 16, 11, 5, 1].join() === ['정하윤', '최민준', '김하늘', '박서아', '이도윤', '한수아'].map(n => ts(byName(n))).join(), ['정하윤', '최민준', '김하늘', '박서아', '이도윤', '한수아'].map(n => n + ts(byName(n))).join());
check('2-3 점수: 최민준28400/정하윤24150/김하늘19800/박서아15300/이도윤9600', root.profiles.filter(p => p.stageRecords['s2-3']).sort((a, b) => b.stageRecords['s2-3'].bestScore - a.stageRecords['s2-3'].bestScore).map(p => p.name + p.stageRecords['s2-3'].bestScore).join() === '최민준28400,정하윤24150,김하늘19800,박서아15300,이도윤9600');
check('김하늘 3-2 1★(3-3 해금) & 3-3 기록 없음(3-4 잠금)', byName('김하늘').stageRecords['s3-2'].bestStars === 1 && !byName('김하늘').stageRecords['s3-3']);
check("이도윤 '8×7' box 0 miss 3, 약점 7개", byName('이도윤').facts['8×7'].box === 0 && byName('이도윤').facts['8×7'].miss === 3 && Object.values(byName('이도윤').facts).filter(f => f.box < 2 && f.miss >= 1).length === 7, Object.values(byName('이도윤').facts).filter(f => f.box < 2 && f.miss >= 1).map(f => f.key).join());
const lim = Date.now() - 7 * 86400000;
check('박서아 최근 7일 숙달 18개(성장 1위)', root.profiles.map(p => [p.name, Object.values(p.facts).filter(f => f.masteredAt && new Date(f.masteredAt) >= lim).length]).sort((a, b) => b[1] - a[1])[0].join() === '박서아,18', JSON.stringify(root.profiles.map(p => [p.name, Object.values(p.facts).filter(f => f.masteredAt && new Date(f.masteredAt) >= lim).length]).filter(x => x[1])));
check('박서아 playDates 어제까지 7일 연속', byName('박서아').playDates.length === 7 && byName('박서아').badges.some(b => b.id === 'streak7'));
check('정하윤 2-3 facts 72개 중 60개 box≥2', Object.values(byName('정하윤').facts).filter(f => f.stageId === 's2-3').length === 72 && Object.values(byName('정하윤').facts).filter(f => f.stageId === 's2-3' && f.box >= 2).length === 60);
check('아바타: 김하늘1 이도윤2 박서아3 최민준4 정하윤5 한수아7, 기본 (순번%8)', byName('김하늘').avatar === 1 && byName('이도윤').avatar === 2 && byName('박서아').avatar === 3 && byName('최민준').avatar === 4 && byName('정하윤').avatar === 5 && byName('한수아').avatar === 7 && root.profiles[5].avatar === 6 % 8 && root.profiles[7].avatar === 8 % 8);
check('샘플 history wrongKeys가 실제 key 표기와 일치(−, ÷, 나머지)', (() => { const all = root.profiles.flatMap(p => p.history.flatMap(h => h.wrongKeys)); return all.every(k => /^(\d+[+−×÷]\d+( 몫| 나머지)?)$/.test(k)); })(), root.profiles.flatMap(p => p.history.flatMap(h => h.wrongKeys)).join(' '));
check('기본 설정: 17개 활성·보통·5분·랭킹공개·해금OFF·적응ON·저학년OFF·0.4·음소거OFF', (() => { const s = root.settings; return s.activeStageIds.length === 17 && s.speedPreset === 'normal' && s.timeLimitMin === 5 && s.rankingPublic && !s.unlockAll && s.adaptive && !s.lowGradeChoice && s.volume === 0.4 && !s.muted && !s.lowSpec && !s.bigText && s.teacherPin === null; })());

const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ summary: `${checks.length - failed.length} passed, ${failed.length} failed`, failed, stats }, null, 2));
fs.writeFileSync(path.join(__dirname, 'code-gen.result.json'), JSON.stringify({ checks, stats }, null, 2));
