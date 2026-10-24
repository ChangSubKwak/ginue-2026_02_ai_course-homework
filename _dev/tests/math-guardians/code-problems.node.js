// problems.js 생성기 스트레스 테스트 (node) — 스테이지별 3000회 생성해 제약·선택지 유효성 검사
'use strict';
const fs = require('fs');
const vm = require('vm');
const APP = 'D:/workspace/ginue-2026_02_ai_course-homework/05_교육용게임_연산수호대/';
const sandbox = { window: {}, console };
sandbox.window.MG = {};
vm.createContext(sandbox);
for (const f of ['js/data.js', 'js/problems.js']) vm.runInContext(fs.readFileSync(APP + f, 'utf8'), sandbox, { filename: f });
const MG = sandbox.window.MG;
const P = MG.Problems;
const issues = {};
const add = (k, msg) => { (issues[k] = issues[k] || []).length < 5 && issues[k].push(msg); issues[k].n = (issues[k].n || 0) + 1; };
const dec = (s) => Math.round(parseFloat(s) * 100);
for (const st of MG.STAGES) {
  const keys = new Set();
  for (let i = 0; i < 3000; i++) {
    const pr = P.generate(st.id, {}, null);
    keys.add(pr.key);
    if (pr.inputType === 'choice3') {
      if (!pr.choices || pr.choices.length !== 3) add(st.id + ':choices-len', JSON.stringify(pr.choices) + ' ' + pr.text);
      else {
        if (new Set(pr.choices).size !== 3) add(st.id + ':choices-dup', pr.text + ' => ' + pr.choices.join(' | '));
        if (pr.choices[pr.correctIndex] !== pr.answerText) add(st.id + ':correctIndex', pr.text);
        if (pr.answer !== pr.correctIndex) add(st.id + ':answer!=idx', pr.text);
      }
    } else if (pr.inputType === 'decimal') {
      if (dec(pr.answerText) !== pr.answer) add(st.id + ':dec-mismatch', `${pr.text} = ${pr.answerText} (answer ${pr.answer})`);
      if (!Number.isInteger(pr.answer)) add(st.id + ':dec-nonint', pr.text + ' ' + pr.answer);
    } else {
      if (!Number.isInteger(pr.answer) || pr.answer < 0) add(st.id + ':num-nonint', pr.text + ' ' + pr.answer);
      if (String(pr.answer) !== pr.answerText) add(st.id + ':num-text', pr.text + ' ' + pr.answerText);
    }
    const p = pr.p;
    // 스테이지별 범위 제약
    if (st.id === 's1-1' && !(p.a >= 1 && p.b >= 1 && p.a + p.b <= 9)) add('s1-1:range', pr.text);
    if (st.id === 's1-2' && !(p.b >= 1 && p.b < p.a && p.a <= 9)) add('s1-2:range', pr.text);
    if (st.id === 's1-3') { if (p.op === 'add' && P.carryCount(p.a, p.b)) add('s1-3:carry', pr.text); if (p.op === 'sub' && P.borrowCount(p.a, p.b)) add('s1-3:borrow', pr.text); if (p.a < 10 || p.b < 10 || p.a > 99 || p.b > 99) add('s1-3:digits', pr.text); }
    if (st.id === 's2-1' && !(p.a % 10 + p.b % 10 >= 10 && p.a + p.b <= 150)) add('s2-1:range', pr.text);
    if (st.id === 's2-2' && !(p.a > p.b && p.a % 10 < p.b % 10)) add('s2-2:range', pr.text);
    if (st.id === 's3-1') { if (p.op === 'add' && (p.a + p.b > 999 || P.carryCount(p.a, p.b) < 1)) add('s3-1:add', pr.text); if (p.op === 'sub' && (p.a <= p.b || P.borrowCount(p.a, p.b) < 1)) add('s3-1:sub', pr.text); }
    if (st.id === 's3-4' && p.a % p.b === 0) add('s3-4:divisible', pr.text);
    if (st.id === 's4-3' && (p.a > 99 || p.b > 99 || p.a < 1 || p.b < 1)) add('s4-3:range>9.9', pr.text + ' (a=' + p.a + ', b=' + p.b + ')');
    if (st.id === 's4-3' && p.op === 'dsub' && p.a <= p.b) add('s4-3:neg', pr.text);
    if (st.id === 's5-1' && p.op === 'gcd' && P.gcd(p.a, p.b) < 2) add('s5-1:gcd', pr.text);
    if (st.id === 's5-1' && p.op === 'lcm' && P.lcm(p.a, p.b) > 100) add('s5-1:lcm', pr.text);
    if (st.id === 's5-2' && P.gcd(p.n1 * (P.lcm(p.d1, p.d2) / p.d1) + (p.op === 'fadd' ? 1 : -1) * p.n2 * (P.lcm(p.d1, p.d2) / p.d2), 1) < 0) add('s5-2:neg', pr.text);
    if (st.id === 's6-3' && !Number.isInteger(pr.answer)) add('s6-3:nonint', pr.text);
    if (st.id === 's6-2' && !/^\d+(\.\d)?$/.test(pr.answerText)) add('s6-2:fmt', pr.text + ' = ' + pr.answerText);
  }
  console.log(st.id, 'distinct keys:', keys.size);
}
// 저학년 3지선다 모드
for (const id of MG.LOW_GRADE) for (let i = 0; i < 1000; i++) { const pr = P.generate(id, { choice: true }, null); if (pr.inputType !== 'choice3' || pr.choices.length !== 3 || new Set(pr.choices).size !== 3 || pr.choices[pr.correctIndex] !== pr.answerText) add(id + ':lowchoice', pr.text + ' ' + JSON.stringify(pr.choices)); if (pr.choices.some(c => +c < 0)) add(id + ':lowchoice-neg', pr.text); }
// 2-3 사실 키 72개 확인
const k23 = new Set(); for (let a = 2; a <= 9; a++) for (let b = 1; b <= 9; b++) k23.add(P.build('s2-3', { op: 'mul', a, b }).key); console.log('s2-3 keys', k23.size);
// 표기 유틸
console.log('fmtDec', P.fmtDec(420, 2), P.fmtDec(100, 2), P.fmtDec(7, 1), P.fmtDec(100, 1), P.fmtDec(5, 0));
console.log('fmtFrac', P.fmtFrac(4, 4, true), P.fmtFrac(7, 4, true), P.fmtFrac(6, 4), P.fmtFrac(2, 1));
console.log('gcd/lcm key', P.build('s5-1', { op: 'gcd', a: 12, b: 18 }).key, '|', P.build('s5-1', { op: 'lcm', a: 10, b: 4 }).key);
console.log('s4-3 a==b case', JSON.stringify(P.build('s4-3', { op: 'dsub', a: 100, b: 99, k: 1 }).text));
console.log('6-1 t2 sample', P.build('s6-1', { op: 'fdiv', n1: 2, d1: 4, n2: 3, d2: 6 }).text, '|', P.build('s6-1', { op: 'fdiv', n1: 2, d1: 4, n2: 3, d2: 6 }).solution);
console.log('ISSUES', JSON.stringify(issues, null, 1));
