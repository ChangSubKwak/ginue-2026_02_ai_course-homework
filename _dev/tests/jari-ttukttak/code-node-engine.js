// code-node-engine.js — engine.js/data.js 순수 함수 검증 (node 전용, 브라우저 불필요)
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const APP = 'D:/workspace/ginue-2026_02_ai_course-homework/03_업무자동화_자리뚝딱';
const ctx = { console, Date, Math, JSON, Object, Array, Set, Map, String, Number };
vm.createContext(ctx);
const src = ['js/data.js', 'js/engine.js'].map(f => fs.readFileSync(path.join(APP, f), 'utf8').replace(/^'use strict';/m, '')).join('\n');
const { APP_DATA, Engine } = vm.runInContext(src + '\n;({ APP_DATA, Engine });', ctx, { filename: 'bundle.js' });
const out = {};

// 1) 샘플 히스토리: 이도윤-한수아 짝 횟수, 양은우 뒤 구역 비율
const layout = Engine.buildLayout(APP_DATA.layoutSpec.preset, APP_DATA.layoutSpec.params, APP_DATA.layoutSpec.teacherSide, APP_DATA.layoutSpec.off, APP_DATA.layoutSpec.name);
const hist = APP_DATA.history.map(h => ({ ...h, layoutSnapshot: layout }));
const F = Engine.fairness(APP_DATA.students, hist, APP_DATA.groupHistory);
out.doyun_sua_partner = F.partner[Engine.pairKey('s02', 's10')];
out.yang_zones = F.zones['s23'];
out.biased = F.biased;
out.deskCount = layout.cells.filter(c => c.desk).length;
out.frontDesks = Engine.zoneInfo(layout).frontDesks;

// 2) recentStats: avoidPartnerN=1, avoidSeat on, settings.avoidN=3 → 짝 반복 집계가 몇 건을 보는가
const active = APP_DATA.students.filter(s => s.active);
const cond1 = { ...APP_DATA.conditions, avoidPartnerN: 1, avoidSeat: true };
const c1 = Engine.prepare(layout, active, APP_DATA.pairs, cond1, hist, APP_DATA.settings);
out.recentStats_count_when_N1_avoidSeat = c1.hist.count;         // 기대 1, 실제?
out.partner_doyun_sua_when_N1 = c1.hist.partner[Engine.pairKey('s02', 's10')]; // N=1이면 h4 기준 0이어야 함
const cond1b = { ...APP_DATA.conditions, avoidPartnerN: 1, avoidSeat: false };
const c1b = Engine.prepare(layout, active, APP_DATA.pairs, cond1b, hist, APP_DATA.settings);
out.partner_doyun_sua_when_N1_noSeat = c1b.hist.partner[Engine.pairKey('s02', 's10')] || 0;

// 3) colTpl split 문제 재현
out.colTpl = layout.colTpl;
out.colTpl_split_len = layout.colTpl.split(' ').length;            // cols=8인데?
out.colTpl_reversed = layout.colTpl.split(' ').reverse().join(' ');
const g4 = Engine.buildLayout('group4', { groups: 6 }, 'top', [], '');
out.g4_rowTpl_reversed = g4.rowTpl.split(' ').reverse().join(' ');

// 4) parseRoster: BOM·탭·성별 누락·따옴표 쉼표
const bomSrc = fs.readFileSync(path.join(APP, 'js/engine.js'), 'utf8');
const m = bomSrc.match(/replace\(\/\^(.)\//);
out.bom_literal_codepoint = m ? m[1].codePointAt(0).toString(16) : 'not found';
out.parse_tab = Engine.parseRoster('\uFEFF1\t김가상\t남\n2\t이가상\t여\n3\t박가상\t남\n4\t최가상', 26, 60).map(r => [r.no, r.name, r.gender, r.status, r.msg]);
out.parse_quoted_comma = Engine.parseRoster('번호,이름,성별\n1,"김,가상",남', 26, 60).map(r => [r.no, r.name, r.gender, r.status]);
out.parse_mixed_space = Engine.parseRoster('1  김가상  남\n2 이가상 여', 26, 60).map(r => [r.no, r.name, r.gender, r.status]);
out.parse_limit0 = Engine.parseRoster('1\t김가상\t남', 26, 0).map(r => [r.status, r.msg]);

// 5) 자동 배치 실행 시간·결과 (node)
const t0 = Date.now();
const c = Engine.prepare(layout, active, APP_DATA.pairs, APP_DATA.conditions, hist, APP_DATA.settings);
const best = Engine.solve(c, {}, active.map(s => s.id));
out.solve_ms = Date.now() - t0;
const rep = Engine.evaluate(c, best.assign, true);
out.solve_penalty = rep.penalty;
out.solve_items = rep.items.map(it => `${it.label}:${it.ok}/${it.total} v${it.violations.length}${it.na ? ' NA' : ''}`);

// 6) 모둠: 24명 6모둠 역할 1개씩, 24명/5명 → 5모둠 편차
const gp = Engine.makeGroups(active, 'count', 6, { gender: true, level: true, pairs: true, avoidN: 3, roles: true }, APP_DATA.pairs, APP_DATA.groupHistory, APP_DATA.settings);
out.groups6_sizes = gp.groups.map(g => g.members.length);
out.groups6_roles_each_once = gp.groups.every(g => APP_DATA.settings.roles.every(r => g.members.filter(m => m.role === r).length === 1));
const gp5 = Engine.makeGroups(active, 'size', 5, { gender: true, level: false, pairs: false, avoidN: 0, roles: false }, [], [], APP_DATA.settings);
out.groups_size5_sizes = gp5.groups.map(g => g.members.length);

// 7) zoneInfo 경계: 책상 0개, 행 1/2개
out.zone_rows2 = (() => { const L = Engine.buildLayout('exam', { rows: 2, cols: 3 }, 'top', [], ''); const z = Engine.zoneInfo(L); return [z.zoneOf(0), z.zoneOf(1), z.frontDesks]; })();
out.zone_rows4 = (() => { const L = Engine.buildLayout('exam', { rows: 4, cols: 3 }, 'top', [], ''); const z = Engine.zoneInfo(L); return [0, 1, 2, 3].map(z.zoneOf); })();
out.zone_bottom = (() => { const L = Engine.buildLayout('exam', { rows: 3, cols: 3 }, 'bottom', [], ''); const z = Engine.zoneInfo(L); return [0, 1, 2].map(z.zoneOf); })();

console.log(JSON.stringify(out, null, 2));
