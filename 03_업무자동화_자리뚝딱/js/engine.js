// engine.js — 자리뚝딱 핵심 알고리즘: 레이아웃 생성·구역 판정·패널티 언덕 오르기 배치·충족 리포트·모둠 편성·역할 로테이션·공정성 통계·명렬 파싱
// UI와 무관한 순수 함수만 둔다(전역 네임스페이스 Engine).
'use strict';

const Engine = (() => {
  const rnd = Math.random;
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const key = (r, c) => r + '-' + c;
  const GAP_TOKEN = 'calc(var(--cell)*0.35)', GAP_RATIO = 0.35;       // 통로 트랙 폭(셀의 35%)
  // 격자 템플릿 문자열 → 트랙 배열(공백 포함 구버전 토큰도 허용). 화면·발표·인쇄·PNG가 공용
  const tplTracks = (tpl) => String(tpl || '').match(/calc\((?:[^()]|\([^()]*\))*\)|var\(--cell\)|\S+/g) || [];   // calc 안의 괄호 1단계 중첩 허용
  const normTpl = (tpl) => tplTracks(tpl).map(t => (t.includes(String(GAP_RATIO)) ? GAP_TOKEN : t)).join(' ');
  // 저장된 레이아웃의 템플릿을 현재 토큰 형식으로 정규화(구버전 저장 데이터 호환)
  function normalizeLayout(L) { if (L && typeof L === 'object') { if (L.colTpl) L.colTpl = normTpl(L.colTpl); if (L.rowTpl) L.rowTpl = normTpl(L.rowTpl); } return L; }

  // ── 레이아웃 생성: 프리셋 4종 → 격자 셀(desk 책상 / gap 통로·빈칸) ──
  function buildLayout(preset, params, teacherSide, offKeys, name) {
    const p = Object.assign({ sections: 3, rows: 5, groups: 6, cols: 6, layers: 2 }, params || {});
    const cells = []; let rows = 0, cols = 0; const colTpl = [], rowTpl = [];
    const CELL = 'var(--cell)', GAP = GAP_TOKEN;                   // 토큰 안에 공백이 없어야 split(' ')로 안전하게 뒤집을 수 있음
    if (preset === 'pair') {                       // 분단마다 2책상 + 통로 1칸
      rows = p.rows; cols = p.sections * 3 - 1;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const gap = c % 3 === 2;
        cells.push({ r, c, desk: !gap, gap, pairGroup: gap ? null : r * p.sections + Math.floor(c / 3) });
      }
      for (let c = 0; c < cols; c++) colTpl.push(c % 3 === 2 ? GAP : CELL);
      for (let r = 0; r < rows; r++) rowTpl.push(CELL);
    } else if (preset === 'group4') {              // 2×2 책상 묶음을 격자로 배열
      const G = p.groups, perRow = G <= 4 ? 2 : 3, gRows = Math.ceil(G / perRow);
      rows = gRows * 3 - 1; cols = perRow * 3 - 1;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const gi = Math.floor(r / 3) * perRow + Math.floor(c / 3);
        const gap = r % 3 === 2 || c % 3 === 2 || gi >= G;
        cells.push({ r, c, desk: !gap, gap, pairGroup: gap ? null : gi });
      }
      for (let c = 0; c < cols; c++) colTpl.push(c % 3 === 2 ? GAP : CELL);
      for (let r = 0; r < rows; r++) rowTpl.push(r % 3 === 2 ? GAP : CELL);
    } else if (preset === 'u') {                   // ㄷ자형: 뒤쪽 가로 줄 + 양쪽 세로 줄(교탁 쪽이 열림). 겹(layers) 1~2로 두께 조절
      const T = Math.max(1, Math.min(2, p.layers | 0, Math.floor((p.cols - 2) / 2)));
      cols = p.cols; rows = p.rows + T;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const desk = r >= rows - T || c < T || c >= cols - T;
        cells.push({ r, c, desk, gap: !desk, pairGroup: null });
      }
      for (let c = 0; c < cols; c++) colTpl.push(CELL);
      for (let r = 0; r < rows; r++) rowTpl.push(CELL);
    } else {                                       // 1인 시험형: 행×열 단일 책상
      rows = p.rows; cols = p.cols;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c, desk: true, gap: false, pairGroup: null });
      for (let c = 0; c < cols; c++) colTpl.push(CELL);
      for (let r = 0; r < rows; r++) rowTpl.push(CELL);
    }
    (offKeys || []).forEach(k => { const cell = cells.find(x => key(x.r, x.c) === k); if (cell && !cell.gap) cell.desk = false; });
    return { id: 'L' + Date.now().toString(36), name: name || '', preset, params: p, rows, cols, cells, teacherSide: teacherSide || 'top', colTpl: colTpl.join(' '), rowTpl: rowTpl.join(' ') };
  }

  // ── 구역 판정: 교탁 기준 책상 줄을 3등분(앞/중/뒤), 앞 2줄 판정 ──
  function zoneInfo(layout) {
    const deskRows = [...new Set(layout.cells.filter(c => c.desk).map(c => c.r))].sort((a, b) => a - b);
    if (layout.teacherSide === 'bottom') deskRows.reverse();
    const n = deskRows.length, k = Math.max(1, Math.floor(n / 3));
    const zoneOf = (r) => {
      const i = deskRows.indexOf(r);
      if (n === 1) return 'front';
      if (n === 2) return i === 0 ? 'front' : 'back';
      return i < k ? 'front' : (i >= n - k ? 'back' : 'mid');
    };
    const frontTwo = (r) => deskRows.indexOf(r) < 2;
    const frontDesks = layout.cells.filter(c => c.desk && zoneOf(c.r) === 'front').length;
    return { zoneOf, frontTwo, frontDesks, rowOrder: deskRows };
  }

  // 날짜 역순 정렬 키(같은 날짜는 생성 시각 → id 순). app.js의 정렬과 동일
  const sortKey = (h) => h.date + (h.createdAt || h.id || '');
  const latestFirst = (arr) => arr.slice().sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  // ── 히스토리에서 최근 N건의 짝 반복 횟수·좌석 이력 집계 ──
  function recentStats(history, n) {
    const partner = {}, seatHist = {};
    const recent = latestFirst(history).slice(0, n);
    recent.forEach(h => {
      const byPg = {};
      Object.entries(h.seats || {}).forEach(([k, sid]) => {
        (seatHist[sid] = seatHist[sid] || new Set()).add(k);
        const cell = (h.layoutSnapshot ? h.layoutSnapshot.cells : []).find(x => key(x.r, x.c) === k);
        if (cell && cell.pairGroup != null) (byPg[cell.pairGroup] = byPg[cell.pairGroup] || []).push(sid);
      });
      Object.values(byPg).forEach(ids => { for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const pk = pairKey(ids[i], ids[j]); partner[pk] = (partner[pk] || 0) + 1; } });
    });
    return { partner, seatHist, count: recent.length };
  }

  // ── 배치 컨텍스트 준비: 책상 목록·인접 관계·학생 정보·가중치 ──
  function prepare(layout, students, pairs, cond, history, settings) {
    const z = zoneInfo(layout);
    const desks = layout.cells.filter(c => c.desk).map(c => ({ key: key(c.r, c.c), r: c.r, c: c.c, pg: c.pairGroup, zone: z.zoneOf(c.r), frontTwo: z.frontTwo(c.r), nb: [] }));
    const idx = {}; desks.forEach((d, i) => { idx[d.key] = i; });
    desks.forEach((d, i) => {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => { const j = idx[key(d.r + dr, d.c + dc)]; if (j != null) d.nb.push(j); });
      desks.forEach((e, j) => { if (j !== i && d.pg != null && d.pg === e.pg && !d.nb.includes(j)) d.nb.push(j); });
    });
    const pgMembers = {}; desks.forEach((d, i) => { if (d.pg != null) (pgMembers[d.pg] = pgMembers[d.pg] || []).push(i); });
    const stu = {}; students.forEach(s => { stu[s.id] = s; });
    const N = cond.avoidPartnerN | 0;
    // 짝 반복은 조건 패널의 N건, 좌석 이력은 설정의 기본 회피 횟수(avoidN)건 — 창을 따로 집계
    const rsP = recentStats(history, N), rsS = recentStats(history, cond.avoidSeat ? (settings.avoidN || 3) : 0);
    const rs = { partner: rsP.partner, seatHist: rsS.seatHist, count: Math.max(rsP.count, rsS.count) };
    const activePairs = pairs.filter(p => stu[p.a] && stu[p.b] && p.a !== p.b);
    return {
      layout, desks, idx, pgMembers, stu, cond, W: settings.weights, students,
      apart: activePairs.filter(p => p.type === 'apart'), together: activePairs.filter(p => p.type === 'together'),
      genderPairOn: !!(cond.genderPair && cond.genderPair.on && layout.preset === 'pair'),
      hist: rs, hasHistory: history.length > 0, avoidN: N, frontDesks: z.frontDesks,
    };
  }

  // ── 패널티 평가(detailed=true면 조건별 리포트 생성) ──
  function evaluate(ctx, assign, detailed) {
    const { desks, stu, cond, W } = ctx;
    const where = {}; assign.forEach((sid, i) => { if (sid) where[sid] = i; });
    let P = 0; const items = [], cellV = {};
    const mk = (type, label, hard, total) => ({ type, label, hard: !!hard, total, ok: 0, violations: [] });
    const hit = (item, sids, idxs, reason, weight) => {
      P += weight;
      if (!detailed) return;
      const cells = idxs.map(i => desks[i].key);
      item.violations.push({ students: sids, cells, reason });
      cells.forEach(k => (cellV[k] = cellV[k] || []).push(reason));
    };
    const w = (type, hard) => (hard ? W.hard : W[type]);
    // 태그 조건 3종
    const tagItem = (type, label, pred) => {
      const c = cond[type]; if (!c || !c.on) return;
      const targets = ctx.students.filter(s => s.tags.includes(type) && where[s.id] != null);
      const item = mk(type, label, c.hard, targets.length);
      targets.forEach(s => { const d = desks[where[s.id]]; if (pred(d)) item.ok++; else hit(item, [s.id], [where[s.id]], `${s.name}: ${label} 위반`, w(type, c.hard)); });
      items.push(item);
    };
    tagItem('front', '앞자리 배려', d => d.zone === 'front');
    tagItem('focus', '집중 지원', d => d.frontTwo);
    tagItem('tall', '키 큼 뒤쪽', d => d.zone !== 'front');
    // 남녀 짝(2인 짝 레이아웃에서만)
    if (ctx.genderPairOn) {
      const item = mk('genderPair', '남녀 짝', cond.genderPair.hard, 0); let single = 0;
      Object.values(ctx.pgMembers).forEach(m => {
        const sids = m.map(i => assign[i]).filter(Boolean);
        if (sids.length === 1) { single++; return; }
        if (sids.length < 2) return;
        const g = sids.map(id => stu[id].gender);
        if (g.some(x => !x)) return;
        item.total++;
        if (g[0] !== g[1]) item.ok++; else hit(item, sids, m.filter(i => assign[i]), `같은 성별 짝: ${sids.map(id => stu[id].name).join('-')}`, w('gender', cond.genderPair.hard));
      });
      if (single) item.note = `${single}명 단독석(면제)`;
      items.push(item);
    }
    // 분리·결합 쌍
    if (cond.pairs && cond.pairs.on) {
      const adjacent = (i, j) => desks[i].nb.includes(j);
      const apartItem = mk('apart', '분리 쌍', false, 0), togItem = mk('together', '결합 쌍', false, 0);
      ctx.apart.forEach(p => {
        const i = where[p.a], j = where[p.b]; if (i == null || j == null) return; apartItem.total++;
        if (!adjacent(i, j)) apartItem.ok++; else hit(apartItem, [p.a, p.b], [i, j], `분리 조건 위반: ${stu[p.a].name}-${stu[p.b].name}`, w('apart', p.hard));
      });
      ctx.together.forEach(p => {
        const i = where[p.a], j = where[p.b]; if (i == null || j == null) return; togItem.total++;
        if (adjacent(i, j)) togItem.ok++; else hit(togItem, [p.a, p.b], [i, j], `결합 조건 위반: ${stu[p.a].name}-${stu[p.b].name}`, w('together', p.hard));
      });
      apartItem.hard = ctx.apart.some(p => p.hard); togItem.hard = ctx.together.some(p => p.hard);
      items.push(apartItem, togItem);
    }
    // 최근 N회 같은 짝 회피 / 같은 좌석 회피(소프트, 이력 없으면 해당 없음)
    if (ctx.avoidN > 0) {
      const item = mk('repeatPartner', `최근 ${ctx.avoidN}회 짝 회피`, false, 0); item.na = !ctx.hasHistory;
      if (!item.na) Object.values(ctx.pgMembers).forEach(m => {
        const ids = m.filter(i => assign[i]);
        for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
          const a = assign[ids[x]], b = assign[ids[y]], n = ctx.hist.partner[pairKey(a, b)] || 0; item.total++;
          if (!n) item.ok++; else hit(item, [a, b], [ids[x], ids[y]], `최근 ${n}회 같은 짝: ${stu[a].name}-${stu[b].name}`, W.repeatPartner * n);
        }
      });
      items.push(item);
    }
    if (cond.avoidSeat) {
      const item = mk('repeatSeat', '같은 좌석 회피', false, 0); item.na = !ctx.hasHistory;
      if (!item.na) assign.forEach((sid, i) => {
        if (!sid) return; item.total++;
        const set = ctx.hist.seatHist[sid];
        if (!set || !set.has(desks[i].key)) item.ok++; else hit(item, [sid], [i], `${stu[sid].name}: 최근에 앉았던 자리`, W.repeatSeat);
      });
      items.push(item);
    }
    return detailed ? { penalty: P, items, cellViolations: cellV } : P;
  }

  // ── 빈 책상 예약(2인 짝 레이아웃): 남는 책상을 짝 단위로 뒷줄·양끝부터 비워 혼자 앉는 학생을 최소화 ──
  // 핀 고정 학생의 옆자리는 '외딴 책상'이 아니므로 비우지 않는다(고정 학생이 매번 혼자 앉던 회귀 방지). 그 밖에 비울 책상이 없을 때만 마지막으로 사용
  function reserveEmpty(ctx, fixed, extra) {
    const reserved = new Set(); if (extra <= 0 || ctx.layout.preset !== 'pair') return reserved;
    const z = zoneInfo(ctx.layout); const backRank = (d) => z.rowOrder.indexOf(d.r);              // 교탁에서 먼 줄일수록 큼
    const center = (ctx.layout.cols - 1) / 2; const edge = (d) => Math.abs(d.c - center);
    const score = (g) => -(backRank(ctx.desks[g.free[0]]) * 100 + edge(ctx.desks[g.free[0]]));    // 뒤쪽·가장자리 우선
    const groups = Object.values(ctx.pgMembers).map(m => ({ free: m.filter(i => !fixed[i]), hasFixed: m.some(i => !!fixed[i]) })).filter(g => g.free.length).sort((a, b) => score(a) - score(b));
    const singles = groups.filter(g => g.free.length === 1 && !g.hasFixed);     // 짝 책상이 꺼져 혼자 남은 외딴 책상
    const pairsG = groups.filter(g => g.free.length >= 2);                        // 양쪽 모두 비어 있는 짝 책상
    const besideFixed = groups.filter(g => g.free.length === 1 && g.hasFixed);   // 고정 학생의 옆자리(마지막 수단)
    let left = extra;
    const take = (i) => { if (left > 0 && !reserved.has(i)) { reserved.add(i); left--; } };
    singles.forEach(g => take(g.free[0]));                                         // 외딴 책상부터
    pairsG.forEach(g => { if (left >= g.free.length) g.free.forEach(take); });     // 그다음 짝 책상 통째로
    if (left > 0) { const g = pairsG.find(x => !reserved.has(x.free[0])); if (g) take(g.free[0]); }   // 홀수면 1석만
    besideFixed.forEach(g => take(g.free[0]));                                     // 그래도 남으면 고정 학생 옆자리
    return reserved;
  }

  // ── 자동 배치: 핀 고정 유지 + 랜덤 재시작 언덕 오르기(최대 800ms) ──
  function solve(ctx, fixed, freeStudents, opts) {
    const o = Object.assign({ restarts: 30, iters: 2000, patience: 200, timeMs: 800 }, opts || {});
    const n = ctx.desks.length; const freeDesks = [];
    const nFixed = Object.keys(fixed).length;
    const reserved = reserveEmpty(ctx, fixed, n - nFixed - freeStudents.length);
    for (let i = 0; i < n; i++) if (!fixed[i] && !reserved.has(i)) freeDesks.push(i);
    let best = null; const t0 = Date.now();
    for (let rs = 0; rs < o.restarts && Date.now() - t0 < o.timeMs; rs++) {
      const assign = new Array(n).fill(null); Object.keys(fixed).forEach(i => { assign[i] = fixed[i]; });
      const order = shuffle(freeStudents); shuffle(freeDesks).forEach((d, i) => { assign[d] = order[i] || null; });
      let P = evaluate(ctx, assign, false), noImp = 0;
      for (let it = 0; it < o.iters && P > 0 && freeDesks.length > 1; it++) {
        const i = freeDesks[Math.floor(rnd() * freeDesks.length)], j = freeDesks[Math.floor(rnd() * freeDesks.length)];
        if (i === j || (!assign[i] && !assign[j])) continue;
        [assign[i], assign[j]] = [assign[j], assign[i]];
        const P2 = evaluate(ctx, assign, false);
        if (P2 <= P) { noImp = P2 < P ? 0 : noImp + 1; P = P2; } else { [assign[i], assign[j]] = [assign[j], assign[i]]; noImp++; }
        if (noImp >= o.patience) break;
      }
      if (!best || P < best.P) best = { assign, P };
      if (P === 0) break;
    }
    return best;
  }

  // ── 완화 제안: 하드 위반이 남은 원인을 규칙으로 설명 ──
  function suggest(ctx, report, locked) {
    const out = []; const stu = ctx.stu;
    report.items.forEach(item => {
      const hardV = item.violations.length && (item.hard || item.type === 'apart' || item.type === 'together');
      if (!hardV) return;
      if (item.type === 'front') {
        const nFront = item.total;
        if (nFront > ctx.frontDesks) out.push(`앞 구역 책상 부족(${nFront}>${ctx.frontDesks}): 분단 수를 늘리거나 '앞자리 배려'를 소프트로 바꾸세요.`);
        else out.push(`앞자리 배려 ${item.violations.length}건 미충족: 다시 섞기를 누르거나 조건을 소프트로 바꾸세요.`);
      } else if (item.type === 'apart' || item.type === 'together') {
        item.violations.forEach(v => {
          const p = (item.type === 'apart' ? ctx.apart : ctx.together).find(q => v.students.includes(q.a) && v.students.includes(q.b));
          if (!p || !p.hard) return;
          const names = v.students.map(id => stu[id].name).join('-');
          if (v.students.every(id => locked.includes(id))) out.push(`${names}: 두 학생 모두 핀 고정 상태입니다. 고정을 해제하세요.`);
          else out.push(`${names}(${item.label} 하드): 다시 섞기를 누르거나 쌍을 소프트로 바꾸세요.`);
        });
      } else if (item.type === 'genderPair') {
        const m = ctx.students.filter(s => s.gender === 'M').length, f = ctx.students.filter(s => s.gender === 'F').length;
        if (Math.abs(m - f) > 1) out.push(`성별 인원 차이(남 ${m}·여 ${f})로 완전한 남녀 짝이 불가능합니다. 남녀 짝을 소프트로 바꾸세요.`);
        else out.push('남녀 짝 하드 미충족: 다시 섞기를 누르거나 소프트로 바꾸세요.');
      } else out.push(`${item.label} 하드 미충족: 해당 조건을 소프트로 바꾸거나 다시 섞기를 누르세요.`);
    });
    return [...new Set(out)];
  }

  // ── 모둠 편성: 수준 내림차순·성별 교대 정렬 → 뱀 분배 → 교환 언덕 오르기 ──
  function makeGroups(students, mode, value, opts, pairs, groupHistory, settings) {
    const n = students.length; if (!n) return null;
    let G = mode === 'count' ? Math.min(value, n) : Math.ceil(n / Math.max(1, value));
    G = Math.max(1, Math.min(G, n));
    const stu = {}; students.forEach(s => { stu[s.id] = s; });
    const lv = s => s.level || 2;
    const recent = latestFirst(groupHistory).slice(0, opts.avoidN | 0);
    const repeat = {}; recent.forEach(gp => gp.groups.forEach(g => { const ids = g.members.map(m => m.studentId); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = pairKey(ids[i], ids[j]); repeat[k] = (repeat[k] || 0) + 1; } }));
    const apart = pairs.filter(p => p.type === 'apart' && stu[p.a] && stu[p.b]), together = pairs.filter(p => p.type === 'together' && stu[p.a] && stu[p.b]);
    const sortedList = () => { // 수준 내림차순, 같은 수준 안에서 남녀 교대
      const out = [];
      [3, 2, 1].forEach(l => {
        const m = shuffle(students.filter(s => lv(s) === l && s.gender === 'M')), f = shuffle(students.filter(s => lv(s) === l && s.gender === 'F')), x = shuffle(students.filter(s => lv(s) === l && !s.gender));
        while (m.length || f.length) { if (m.length) out.push(m.pop()); if (f.length) out.push(f.pop()); }
        out.push(...x);
      });
      return out;
    };
    const snake = (list) => { const gs = Array.from({ length: G }, () => []); list.forEach((s, i) => { const round = Math.floor(i / G), pos = i % G; gs[round % 2 ? G - 1 - pos : pos].push(s.id); }); return gs; };
    const Q = (gs) => {
      let q = 0; const gOf = {}; gs.forEach((g, gi) => g.forEach(id => { gOf[id] = gi; }));
      const sizes = gs.map(g => g.length); if (Math.max(...sizes) - Math.min(...sizes) > 1) q += 100;
      if (opts.gender) gs.forEach(g => { const m = g.filter(id => stu[id].gender === 'M').length, f = g.filter(id => stu[id].gender === 'F').length; if (Math.abs(m - f) > 1) q += 10; });
      if (opts.level) { const means = gs.map(g => g.reduce((a, id) => a + lv(stu[id]), 0) / Math.max(1, g.length)); const mu = means.reduce((a, b) => a + b, 0) / G; q += means.reduce((a, m) => a + (m - mu) ** 2, 0) / G * 20; }
      if (opts.pairs) { apart.forEach(p => { if (gOf[p.a] === gOf[p.b]) q += p.hard ? 1000 : 50; }); together.forEach(p => { if (gOf[p.a] !== gOf[p.b]) q += p.hard ? 1000 : 50; }); }
      if (opts.avoidN > 0) gs.forEach(g => { for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) q += 15 * (repeat[pairKey(g[i], g[j])] || 0); });
      return q;
    };
    let best = null;
    for (let rs = 0; rs < 10; rs++) {
      const gs = snake(rs === 0 ? sortedList() : shuffle(students)); let q = Q(gs);
      for (let it = 0; it < 1500 && q > 0 && G > 1; it++) {
        const a = Math.floor(rnd() * G); let b = Math.floor(rnd() * G); if (a === b) b = (b + 1) % G;
        if (!gs[a].length || !gs[b].length) continue;
        const i = Math.floor(rnd() * gs[a].length), j = Math.floor(rnd() * gs[b].length);
        [gs[a][i], gs[b][j]] = [gs[b][j], gs[a][i]];
        const q2 = Q(gs); if (q2 <= q) q = q2; else [gs[a][i], gs[b][j]] = [gs[b][j], gs[a][i]];
      }
      if (!best || q < best.q) best = { gs, q };
      if (q === 0) break;
    }
    const groups = best.gs.map((ids, gi) => ({ idx: gi, name: settings.groupNames[gi] || `${gi + 1}모둠`, color: settings.groupColors[gi] || '#888888', members: ids.map(studentId => ({ studentId, role: '모둠원' })) }));
    if (opts.roles) assignRoles(groups, settings.roles, groupHistory);
    return { id: 'g' + Date.now().toString(36), date: '', memo: '', groupCount: G, groups };
  }

  // ── 역할 배정: 과거 경험 횟수가 가장 적은 학생 우선(동률 랜덤) ──
  function roleCounts(groupHistory) {
    const cnt = {}; groupHistory.forEach(gp => gp.groups.forEach(g => g.members.forEach(m => { (cnt[m.studentId] = cnt[m.studentId] || {})[m.role] = (cnt[m.studentId][m.role] || 0) + 1; })));
    return cnt;
  }
  function assignRoles(groups, roles, groupHistory) {
    const cnt = roleCounts(groupHistory);
    groups.forEach(g => {
      g.members.forEach(m => { m.role = '모둠원'; });
      const free = shuffle(g.members);
      roles.forEach(role => {
        if (!free.length) return;
        free.sort((a, b) => ((cnt[a.studentId] || {})[role] || 0) - ((cnt[b.studentId] || {})[role] || 0));
        free.shift().role = role;
      });
    });
  }

  // ── 공정성 통계: 공동 횟수 매트릭스·구역 누적·역할 횟수·편중 판정 ──
  function fairness(students, history, groupHistory) {
    const partner = {}, group = {}, zones = {}, roles = roleCounts(groupHistory);
    students.forEach(s => { zones[s.id] = { front: 0, mid: 0, back: 0, total: 0 }; });
    history.forEach(h => {
      if (!h.layoutSnapshot) return;
      const z = zoneInfo(h.layoutSnapshot); const byPg = {};
      Object.entries(h.seats).forEach(([k, sid]) => {
        const cell = h.layoutSnapshot.cells.find(x => key(x.r, x.c) === k); if (!cell) return;
        if (zones[sid]) { zones[sid][z.zoneOf(cell.r)]++; zones[sid].total++; }
        if (cell.pairGroup != null) (byPg[cell.pairGroup] = byPg[cell.pairGroup] || []).push(sid);
      });
      Object.values(byPg).forEach(ids => { for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = pairKey(ids[i], ids[j]); partner[k] = (partner[k] || 0) + 1; } });
    });
    groupHistory.forEach(gp => gp.groups.forEach(g => { const ids = g.members.map(m => m.studentId); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = pairKey(ids[i], ids[j]); group[k] = (group[k] || 0) + 1; } }));
    const biased = students.filter(s => { const z = zones[s.id]; return z.total >= 3 && z.back / z.total >= 0.7; }).map(s => s.id);
    return { partner, group, zones, roles, biased, pairKey };
  }

  // ── 붙여넣기·CSV 파싱: BOM 제거 → 구분자 감지 → 헤더 판별 → 열 매핑 → 성별 정규화 ──
  // 한 줄을 구분자로 나눔(따옴표 안의 구분자는 보호, "" → ")
  function splitLine(line, sep) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (!q && ch === sep) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out;
  }
  function parseRoster(text, nextNo, limit) {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const anyTab = lines.some(l => l.includes('\t')), anyComma = lines.some(l => l.includes(','));
    const rows = []; let no = nextNo;
    const normGender = (v) => (/^(남|남자|m|male)$/i.test(v) ? 'M' : /^(여|여자|f|female)$/i.test(v) ? 'F' : null);
    lines.forEach((line, li) => {
      // 구분자: 탭 > 콤마 > 공백(줄마다 다시 판단해 한 칸 공백 줄도 분리)
      const sep = anyTab && line.includes('\t') ? '\t' : anyComma && line.includes(',') ? ',' : null;
      const parts = sep ? splitLine(line, sep) : line.split(/\s{2,}/.test(line) ? /\s{2,}/ : /\s+/);
      const cols = parts.map(c => c.replace(/^"|"$/g, '').trim()).filter(c => c !== '');
      if (li === 0 && cols.some(c => /이름|번호|성별|name/i.test(c))) return;   // 헤더 행
      let num = null, gender = null, name = null;
      cols.forEach(c => {
        if (num == null && /^\d{1,3}$/.test(c)) num = Number(c);
        else if (gender == null && normGender(c)) gender = normGender(c);
        else if (name == null) name = c;
      });
      if (!name) { rows.push({ line: li + 1, raw: line, status: 'error', msg: '이름 없음(열 부족)' }); return; }
      if (num == null) num = no++; else no = Math.max(no, num + 1);
      if (rows.filter(r => r.status !== 'error').length >= limit) { rows.push({ line: li + 1, raw: line, status: 'error', msg: `상한 ${limit}명 초과` }); return; }
      rows.push({ line: li + 1, raw: line, no: num, name: name.slice(0, 20), gender: gender || '', status: gender ? 'ok' : 'warn', msg: gender ? '정상' : '성별 미지정' });
    });
    return rows;
  }

  return { buildLayout, normalizeLayout, tplTracks, GAP_RATIO, zoneInfo, prepare, evaluate, solve, suggest, makeGroups, assignRoles, roleCounts, fairness, parseRoster, recentStats, latestFirst, shuffle, pairKey };
})();
