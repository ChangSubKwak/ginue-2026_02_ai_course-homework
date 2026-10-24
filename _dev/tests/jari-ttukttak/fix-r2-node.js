// fix-r2-node.js — R-01(핀 고정 학생 옆자리 비움 회귀) 엔진 단위 검증 (node 전용, 브라우저 불필요)
// 사용법: node fix-r2-node.js  → JSON 요약 출력, 실패가 있으면 exit 1
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const APP = 'D:/workspace/ginue-2026_02_ai_course-homework/03_업무자동화_자리뚝딱';
const ctx = { console, Date, Math, JSON, Object, Array, Set, Map, String, Number };
vm.createContext(ctx);
const src = ['js/data.js', 'js/engine.js'].map(f => fs.readFileSync(path.join(APP, f), 'utf8').replace(/^'use strict';/m, '')).join('\n');
const { APP_DATA, Engine } = vm.runInContext(src + '\n;({ APP_DATA, Engine });', ctx, { filename: 'bundle.js' });

const results = { passed: [], failed: [] };
const expect = (cond, msg) => (cond ? results.passed : results.failed).push(msg);
const active = APP_DATA.students.filter(s => s.active);
const mkLayout = (off) => Engine.buildLayout('pair', { sections: 3, rows: 5 }, 'top', off || APP_DATA.layoutSpec.off, '수업형');
const BACK = ['4-1', '4-3', '4-4', '4-6'];

// 배치 실행: fixedMap = { 'r-c': studentId }
function run(layout, fixedMap, students) {
  const c = Engine.prepare(layout, students || active, APP_DATA.pairs, APP_DATA.conditions, [], APP_DATA.settings);
  const fixed = {}; c.desks.forEach((d, i) => { if (fixedMap[d.key]) fixed[i] = fixedMap[d.key]; });
  const free = (students || active).map(s => s.id).filter(id => !Object.values(fixed).includes(id));
  const best = Engine.solve(c, fixed, free, { timeMs: 400 });
  const seats = {}; best.assign.forEach((sid, i) => { if (sid) seats[c.desks[i].key] = sid; });
  const rep = Engine.evaluate(c, best.assign, true);
  const gp = rep.items.find(it => it.type === 'genderPair');
  return { seats, empties: c.desks.map(d => d.key).filter(k => !seats[k]).sort(), single: gp && gp.note ? Number((gp.note.match(/\d+/) || [0])[0]) : 0, penalty: rep.penalty };
}
const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const L = mkLayout();

// 1) 핀 없음: 빈 책상 4개가 뒷줄(4-1·4-3·4-4·4-6), 단독석 0 — 10회 모두
let ok1 = 0; for (let i = 0; i < 10; i++) { const r = run(L, {}); if (sameSet(r.empties, BACK) && r.single === 0) ok1++; }
expect(ok1 === 10, `핀 없음: 빈 책상 = 뒷줄 4석·단독석 0 (${ok1}/10)`);

// 2) 0-0 고정: 옆자리 0-1이 채워지고 빈 책상은 그대로 뒷줄 4석
let ok2 = 0, single2 = 0; for (let i = 0; i < 10; i++) { const r = run(L, { '0-0': 's01' }); if (r.seats['0-1'] && sameSet(r.empties, BACK)) ok2++; single2 += r.single; }
expect(ok2 === 10 && single2 === 0, `0-0 고정: 옆자리 0-1 채움·뒷줄 4석 비움·단독석 0 (${ok2}/10, 단독석 합 ${single2})`);

// 3) 3-0(뒤에서 두 번째 줄 가장자리) 고정: 옆자리 3-1 채움, 뒷줄 4석 비움
let ok3 = 0; for (let i = 0; i < 10; i++) { const r = run(L, { '3-0': 's07' }); if (r.seats['3-1'] && sameSet(r.empties, BACK)) ok3++; }
expect(ok3 === 10, `3-0 고정: 옆자리 3-1 채움·뒷줄 4석 비움 (${ok3}/10)`);

// 4) 4-3(원래 비워지던 뒷줄) 고정: 옆자리 4-4 채움, 대신 외딴 4-1·4-6 + 다른 짝 책상 1쌍을 비움
let ok4 = 0; for (let i = 0; i < 10; i++) { const r = run(L, { '4-3': 's13' }); const e = r.empties; const pairEmpty = e.filter(k => !['4-1', '4-6'].includes(k)); const [a, b] = pairEmpty; const isPair = pairEmpty.length === 2 && a.split('-')[0] === b.split('-')[0] && Math.abs(Number(a.split('-')[1]) - Number(b.split('-')[1])) === 1; if (r.seats['4-4'] && e.includes('4-1') && e.includes('4-6') && isPair && r.single === 0) ok4++; }
expect(ok4 === 10, `4-3 고정: 옆자리 4-4 채움·외딴 2석 + 짝 책상 1쌍 비움·단독석 0 (${ok4}/10)`);

// 5a) 27석/24명(4-3도 끔 → 외딴 책상 3개): 외딴 3석을 비워 단독석 0, 고정 학생(0-0) 옆자리는 채움
const L27 = mkLayout(['4-0', '4-7', '4-3']);
let ok5a = 0; for (let i = 0; i < 10; i++) { const r = run(L27, { '0-0': 's01' }); if (r.seats['0-1'] && sameSet(r.empties, ['4-1', '4-4', '4-6']) && r.single === 0) ok5a++; }
expect(ok5a === 10, `27석/24명 + 0-0 고정: 외딴 3석(4-1·4-4·4-6) 비움·단독석 0·옆자리 채움 (${ok5a}/10)`);
// 5b) 진짜 홀수 여분(30석/23명 → 7석): 뒷줄 3쌍(6석) + 그 앞줄 1석 → 단독석 1명, 고정 학생 옆자리는 채움
const L30 = mkLayout([]); const s23 = active.slice(0, 23);
let ok5b = 0; for (let i = 0; i < 10; i++) { const r = run(L30, { '0-0': 's01' }, s23); const back = r.empties.filter(k => k.startsWith('4-')).length; if (r.seats['0-1'] && r.empties.length === 7 && back === 6 && r.single === 1) ok5b++; }
expect(ok5b === 10, `30석/23명 + 0-0 고정: 뒷줄 6석 + 1석 비움·단독석 1명·옆자리 채움 (${ok5b}/10)`);

// 6) 마지막 수단: 2석 짝 묶음 13곳에 모두 고정 학생이 있으면 외딴 2석 다음으로 고정 학생 옆자리를 비움(배치 가능, 미배치 없음)
const pinAll = {}; ['0-0', '0-3', '0-6', '1-0', '1-3', '1-6', '2-0', '2-3', '2-6', '3-0', '3-3', '3-6', '4-3'].forEach((k, i) => { pinAll[k] = active[i].id; });
const r6 = run(L, pinAll);
expect(Object.keys(r6.seats).length === 24 && r6.empties.length === 4 && r6.empties.includes('4-1') && r6.empties.includes('4-6'), `모든 짝 묶음 고정: 24명 전원 배치·빈 4석(외딴 2석 포함) (${r6.empties.join(',')})`);

// 7) ㄷ자형·시험형(짝 없음)에서는 예약 없이 정상 배치
const LU = Engine.buildLayout('u', { cols: 6, rows: 5, layers: 2 }, 'top', [], '');
const rU = run(LU, { '0-0': 's01' });
expect(Object.keys(rU.seats).length === 24 && rU.seats['0-0'] === 's01', `ㄷ자형 32석 + 고정: 24명 배치·고정 유지`);

results.summary = `${results.passed.length} passed, ${results.failed.length} failed`;
console.log(JSON.stringify(results, null, 2));
process.exit(results.failed.length ? 1 : 0);
