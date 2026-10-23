// app.js — 상태·저장·되돌리기·앱 셸(탭/테마/칠판/펜/커튼/전체화면)·교구판·비교·덧셈뺄셈 보드
'use strict';
(() => {
  const F = FK.frac, R = FK.render, A = FK.anim, U = FK.ui, D = APP_DATA;
  const { $, escapeHtml, clamp, store, toast } = U;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = o => JSON.parse(JSON.stringify(o));
  const LIM = { kitD: 24, abDmin: 2, abDmax: 12, mul: 3, undo: 50, scenes: 200 };
  const ROWH = 112, BAR_TOP = 24, BAR_H = 76, ANIM = 400;
  FK.data = D;
  FK.actions = {};

  // ---- 상태 ----
  const defaults = {
    kit: () => ({ n: 1, d: 2, lineRange: 'auto', models: { bar: true, circle: true, line: true }, showDecimal: true, chain: [{ n: 1, d: 2, op: 'start' }] }),
    compare: () => ({ a: { n: 2, d: 3 }, b: { n: 3, d: 5 }, overlay: false, step: 0 }),
    arith: () => ({ a: { n: 1, d: 2 }, b: { n: 1, d: 3 }, op: '+', step: 0, mirror: false }),
  };
  const state = { tab: 'kit', kit: defaults.kit(), compare: defaults.compare(), arith: defaults.arith(), currentCardId: null, currentSetId: null, loadedSceneId: null, worksheet: clone(D.worksheet) };
  const settings = { teacherMode: true, boardMode: false, gradePreset: null, lastTab: 'kit', reduceMotion: 'auto', bwPattern: false };
  const db = { scenes: [], cards: [], cardSets: [], tally: {} };
  const tr = { curtain: false, pen: { on: false, tool: 'red', strokes: [] }, estimate: null, fsFallback: false, autoplay: null };
  FK.reduceMotion = () => settings.reduceMotion === 'on' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 분수 정상화(정수·범위)
  const fixFr = (fr, dMin, dMax, def) => {
    if (!fr || !Number.isInteger(fr.n) || !Number.isInteger(fr.d)) return def;
    const d = clamp(fr.d, dMin, dMax); return { n: clamp(fr.n, 0, LIM.mul * d), d };
  };
  // 작업 상태 정상화(불러오기·가져오기 공통)
  function sanitizeState(s) {
    const out = { tab: ['kit', 'compare', 'arith'].includes(s && s.tab) ? s.tab : 'kit', kit: defaults.kit(), compare: defaults.compare(), arith: defaults.arith() };
    if (s && s.kit) {
      const k = s.kit, fr = fixFr(k, 1, LIM.kitD, { n: 1, d: 2 });
      Object.assign(out.kit, { n: fr.n, d: fr.d, lineRange: ['auto', 1, 2, 3].includes(k.lineRange) ? k.lineRange : 'auto', showDecimal: k.showDecimal !== false });
      if (k.models) out.kit.models = { bar: k.models.bar !== false, circle: k.models.circle !== false, line: k.models.line !== false };
      const chain = Array.isArray(k.chain) ? k.chain.filter(c => Number.isInteger(c.n) && Number.isInteger(c.d) && c.d >= 1 && c.d <= LIM.kitD) : [];
      out.kit.chain = chain.length && chain[chain.length - 1].n === fr.n && chain[chain.length - 1].d === fr.d ? chain : [{ n: fr.n, d: fr.d, op: 'start' }];
    }
    if (s && s.compare) { const c = s.compare; out.compare = { a: fixFr(c.a, 2, 12, { n: 2, d: 3 }), b: fixFr(c.b, 2, 12, { n: 3, d: 5 }), overlay: !!c.overlay, step: clamp(c.step | 0, 0, 3) }; }
    if (s && s.arith) { const r = s.arith; out.arith = { a: fixFr(r.a, 2, 12, { n: 1, d: 2 }), b: fixFr(r.b, 2, 12, { n: 1, d: 3 }), op: r.op === '-' ? '-' : '+', step: clamp(r.step | 0, 0, 4), mirror: !!r.mirror }; }
    return out;
  }
  const getSceneState = () => ({ tab: ['kit', 'compare', 'arith'].includes(state.tab) ? state.tab : 'kit', kit: clone(state.kit), compare: clone(state.compare), arith: clone(state.arith) });

  // ---- 저장 ----
  const persist = U.debounce(() => store.set('v1.workspace', state), 300);
  const saveSettings = () => store.set('v1.settings', settings);
  const saveDb = () => { store.set('v1.scenes', db.scenes); store.set('v1.cards', db.cards); store.set('v1.cardSets', db.cardSets); store.set('v1.tally', db.tally); };
  // 첫 실행 시드(내장 데이터 주입)
  function seed() {
    db.scenes = clone(D.scenes); db.cards = clone(D.cards); db.cardSets = clone(D.cardSets); db.tally = clone(D.tally);
    state.worksheet = clone(D.worksheet);
    saveDb(); store.set('v1.meta', { schema: 1, seededAt: new Date().toISOString(), builtinVersion: D.builtinVersion });
  }
  function loadAll() {
    Object.assign(settings, store.get('v1.settings', {}));
    const meta = store.get('v1.meta', null);
    db.scenes = store.get('v1.scenes', []); db.cards = store.get('v1.cards', []); db.cardSets = store.get('v1.cardSets', []); db.tally = store.get('v1.tally', {});
    if (!Array.isArray(db.scenes)) db.scenes = []; if (!Array.isArray(db.cards)) db.cards = []; if (!Array.isArray(db.cardSets)) db.cardSets = []; if (!db.tally || typeof db.tally !== 'object') db.tally = {};
    const ws = store.get('v1.workspace', null);
    if (!meta) {
      seed();
      const sc = db.scenes.find(s => s.id === D.defaultSceneId);
      if (sc) { Object.assign(state, sanitizeState(sc.state)); state.loadedSceneId = sc.id; }
    } else if (ws) {
      Object.assign(state, sanitizeState(ws));
      state.currentCardId = ws.currentCardId || null; state.currentSetId = ws.currentSetId || null; state.loadedSceneId = ws.loadedSceneId || null;
      if (ws.worksheet && Array.isArray(ws.worksheet.items)) state.worksheet = Object.assign(clone(D.worksheet), ws.worksheet);
    }
    if (!['kit', 'compare', 'arith', 'cards', 'scenes', 'sheet'].includes(settings.lastTab)) settings.lastTab = 'kit';
  }

  // ---- 되돌리기(탭별 50단계) ----
  const undo = { kit: { past: [], future: [] }, compare: { past: [], future: [] }, arith: { past: [], future: [] } };
  function pushUndo(tab = state.tab) {
    const u = undo[tab]; if (!u) return;
    u.past.push(JSON.stringify(state[tab])); if (u.past.length > LIM.undo) u.past.shift(); u.future = [];
    updateUndoButtons();
  }
  function updateUndoButtons() {
    const u = undo[state.tab];
    $('#btn-undo').disabled = !u || !u.past.length; $('#btn-redo').disabled = !u || !u.future.length;
  }
  function doUndo(redo) {
    const u = undo[state.tab]; if (!u) return;
    const from = redo ? u.future : u.past, to = redo ? u.past : u.future;
    if (!from.length) return;
    A.finishAll(); stopAuto();
    to.push(JSON.stringify(state[state.tab])); state[state.tab] = JSON.parse(from.pop());
    tr.estimate = null; renderTab(); updateUndoButtons(); persist();
  }

  // ---- 탭 ----
  const TABS = ['kit', 'compare', 'arith', 'cards', 'scenes', 'sheet'];
  function setTab(tab) {
    if (!TABS.includes(tab)) return;
    A.finishAll(); stopAuto();
    if (state.tab === 'compare' && tab === 'arith' && state.arith.step === 0) { state.arith.a = clone(state.compare.a); state.arith.b = clone(state.compare.b); }
    state.tab = tab; settings.lastTab = tab; saveSettings();
    $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $$('main [data-view]').forEach(s => { s.hidden = s.dataset.view !== tab; });
    document.body.dataset.tab = tab;
    if (tr.pen.on) penClear();
    renderTab(); updateUndoButtons(); persist();
  }
  function renderTab(o = {}) {
    const t = state.tab;
    if (t === 'kit') Kit.render($('[data-view=kit]'), state.kit, Object.assign({ interactive: true, controls: true }, o));
    else if (t === 'compare') Compare.render($('[data-view=compare]'), state.compare, Object.assign({ interactive: true, controls: true }, o));
    else if (t === 'arith') Arith.render($('[data-view=arith]'), state.arith, Object.assign({ interactive: true, controls: true }, o));
    else if (FK[t] && FK[t].render) FK[t].render();
    renderMemo();
  }
  // 불러온 장면의 교사 메모 패널
  function renderMemo() {
    const p = $('#memo-panel'), sc = state.loadedSceneId && db.scenes.find(s => s.id === state.loadedSceneId);
    const show = sc && sc.memo && ['kit', 'compare', 'arith'].includes(state.tab);
    p.hidden = !show;
    if (show) { $('#memo-title').textContent = '— ' + sc.name; $('#memo-body').textContent = sc.memo; }
  }
  function stopAuto() { if (tr.autoplay) { tr.autoplay.stop(); tr.autoplay = null; } }

  // ---- A/B 입력 블록(비교·연산 공통) ----
  const abBlockHtml = (tab, who) => `<div class="ab-block ${who}" data-who="${who}">
    <div class="ab-head"><span class="ab-tag">${who.toUpperCase()}</span><span class="ab-val" aria-live="polite"></span></div>
    <div class="ab-row"><span>분모</span><div class="stepper"><button type="button" data-action="${tab}-d" data-who="${who}" data-delta="-1" aria-label="${who} 분모 줄이기">−</button><output class="ab-d"></output><button type="button" data-action="${tab}-d" data-who="${who}" data-delta="1" aria-label="${who} 분모 늘리기">+</button></div>
    <button type="button" class="chip-btn" data-action="${tab}-keypad" data-who="${who}">분수 입력</button></div>
    <div class="chips">${D.chips.map(([n, d]) => `<button type="button" class="chip" data-action="${tab}-chip" data-who="${who}" data-n="${n}" data-d="${d}">${n}/${d}</button>`).join('')}</div></div>`;
  function updateAb(root, who, fr) {
    const b = root.querySelector(`.ab-block[data-who=${who}]`); if (!b) return;
    b.querySelector('.ab-val').innerHTML = F.html(fr.n, fr.d, { mixed: true }) + `<span class="muted"> ${F.str(fr.n, fr.d)}</span>`;
    b.querySelector('.ab-d').textContent = fr.d;
    b.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.n === fr.n && +c.dataset.d === fr.d)));
    b.querySelectorAll('[data-delta]').forEach(x => { x.disabled = (+x.dataset.delta < 0 && fr.d <= LIM.abDmin) || (+x.dataset.delta > 0 && fr.d >= LIM.abDmax); });
  }
  // A/B 입력 공통 처리: 분모 ±, 칩, 키패드, 칸 클릭 → 단계 0으로
  function abSet(tab, who, fr) {
    A.finishAll(); stopAuto(); pushUndo(tab);
    const s = state[tab]; s[who] = { n: fr.n, d: fr.d }; s.step = 0; if (tab === 'arith') s.mirror = false;
    renderTab(); persist();
  }
  function bindAb(tab) {
    FK.actions[tab + '-d'] = b => { const fr = state[tab][b.dataset.who]; const d = clamp(fr.d + +b.dataset.delta, LIM.abDmin, LIM.abDmax); if (d !== fr.d) abSet(tab, b.dataset.who, { n: Math.min(fr.n, LIM.mul * d), d }); };
    FK.actions[tab + '-chip'] = b => abSet(tab, b.dataset.who, { n: +b.dataset.n, d: +b.dataset.d });
    FK.actions[tab + '-keypad'] = async b => { const fr = await U.keypad({ value: state[tab][b.dataset.who], title: `${b.dataset.who.toUpperCase()} 분수 입력` }); if (fr) abSet(tab, b.dataset.who, fr); };
  }
  // 보드 막대 칸 클릭(비교·연산): data-who 그룹 안 .cell
  function bindBoardCells(svg, tab) {
    svg.addEventListener('pointerdown', e => {
      const cell = e.target.closest('.cell'); if (!cell || tr.pen.on) return;
      const g = cell.closest('[data-who]'); if (!g) return;
      const who = g.dataset.who, s = state[tab], fr = s[who];
      if (s.step > 0) return toast('처음으로를 누른 뒤 분수를 바꿀 수 있어요', 'info');
      const i = +cell.dataset.i, n = i + 1 === fr.n ? i : i + 1;
      if (n > LIM.mul * fr.d) return;
      abSet(tab, who, { n, d: fr.d });
    });
  }

  // ---- 교구판 ----
  const Kit = {
    units: k => R.unitsFor(k.n, k.d, k.lineRange),
    render(root, k, o = {}) {
      const Un = this.units(k), m = k.models;
      root.querySelectorAll('.model').forEach(el => { el.hidden = !m[el.dataset.model]; });
      const common = { n: k.n, d: k.d, units: Un, fill: 'a', interactive: o.interactive };
      if (o.anim) common[o.anim.type === 'split' ? 'newFrom' : 'ghostD'] = o.anim.from;
      if (m.bar) R.bar(root.querySelector('.kit-bar'), common);
      if (m.circle) { R.circle(root.querySelector('.kit-circle'), common); const cap = root.querySelector('.kit-circle-cap'); if (cap) cap.hidden = k.d <= 12; }
      if (m.line) {
        const est = tr.estimate && o.controls ? tr.estimate : null;
        const points = est ? [] : [{ n: k.n, cls: 'a', drag: true }];
        if (est) { if (est.tapped != null) points.push({ n: est.tapped, d: 1, cls: 'a' }); if (est.revealed) points.push({ n: est.target.n, cls: 'r' }); }
        R.line(root.querySelector('.kit-line'), Object.assign({ d: k.d, range: Un, points, hideTicks: !!est }, common.newFrom ? { newFrom: common.newFrom } : {}, common.ghostD ? { ghostD: common.ghostD } : {}));
      }
      if (o.anim) { if (o.anim.type === 'split') A.fadeIn(root, '.new', ANIM); else A.fadeOut(root, '.ghost', ANIM); }
      root.querySelector('.kit-symbol').innerHTML = this.symbolHtml(k);
      root.querySelector('.kit-chain').innerHTML = this.chainHtml(k.chain);
      if (o.controls) this.controls(root, k);
    },
    symbolHtml(k) {
      const { n, d } = k, parts = [];
      let main = F.html(n, d, { cls: 'big' });
      if (n >= d && d > 1) main += `<span class="sym-eq">=</span>` + F.html(n, d, { mixed: true, cls: 'big' });
      main += `<span class="sr-only">${F.str(n, d)}${n >= d && d > 1 ? ' = ' + F.mixedStr(n, d) : ''}</span>`;
      if (k.showDecimal) parts.push(`<span class="sym-chip"><small>소수</small>${F.toDecimal(n, d)}</span>`);
      parts.push(`<span class="sym-chip"><small>읽기</small>${F.toText(n, d)}</span>`);
      const r = F.reduce(n, d); if (n > 0 && r.d !== d) parts.push(`<span class="sym-chip hint"><small>약분</small>= ${F.str(r.n, r.d)}</span>`);
      return `<div class="sym-main">${main}</div><div class="sym-extra">${parts.join('')}</div>`;
    },
    chainHtml: chain => chain.map((c, i) => (i ? `<span class="eq"><span class="eq-label">${c.op}</span>=</span>` : '') + `<span class="term">${F.str(c.n, c.d)}</span>`).join(''),
    controls(root, k) {
      const sl = root.querySelector('#kit-d'); sl.value = k.d; sl.max = gradeMaxD();
      root.querySelector('#kit-d-val').textContent = k.d; root.querySelector('#kit-n-val').textContent = k.n;
      root.querySelectorAll('[data-action=split]').forEach(b => { const ok = k.d * +b.dataset.k <= LIM.kitD; b.disabled = !ok; b.title = ok ? '' : '분모는 24까지 나눌 수 있어요'; });
      root.querySelector('[data-action=kit-n][data-delta="1"]').disabled = k.n >= LIM.mul * k.d;
      root.querySelector('[data-action=kit-n][data-delta="-1"]').disabled = k.n <= 0;
      root.querySelector('#kit-range').value = String(k.lineRange);
      root.querySelectorAll('[data-model-toggle]').forEach(c => { c.checked = !!k.models[c.dataset.modelToggle]; });
      root.querySelector('#kit-decimal').checked = !!k.showDecimal;
      root.querySelector('[data-action=estimate]').textContent = tr.estimate ? '어림 끝내기' : '어림해서 찍기';
      this.renderEstimate(root);
    },
    // 어림 모드 안내 박스
    renderEstimate(root) {
      const box = root.querySelector('.kit-estimate'), e = tr.estimate; box.hidden = !e; if (!e) return;
      box.innerHTML = `<div class="est-target">목표 ${F.html(e.target.n, e.target.d, { mixed: true })}<span class="muted">${F.str(e.target.n, e.target.d)}</span></div>
        <p class="est-msg ${e.cls || ''}">${e.msg || '수직선에서 목표 분수가 있을 자리를 눌러 보세요'}</p>
        <div class="btn-row"><button type="button" class="chip-btn" data-action="est-again">다시</button><button type="button" class="chip-btn" data-action="est-random">무작위 목표</button><button type="button" class="chip-btn ghost" data-action="estimate">끝내기</button></div>`;
    },
  };
  const gradeMaxD = () => ({ 3: 10, 4: 12 }[settings.gradePreset] || LIM.kitD);
  const kitRoot = () => $('[data-view=kit]');
  function kitChange(mut, anim, keepChain) { A.finishAll(); pushUndo('kit'); mut(state.kit); if (!anim && !keepChain) state.kit.chain = [{ n: state.kit.n, d: state.kit.d, op: 'start' }]; Kit.render(kitRoot(), state.kit, { interactive: true, controls: true, anim }); persist(); }
  function kitSetD(d) { d = clamp(d, 1, gradeMaxD()); if (d === state.kit.d) return; tr.estimate = null; kitChange(k => { k.d = d; k.n = Math.min(k.n, LIM.mul * d); }); }
  function kitSetN(n) {
    if (n > LIM.mul * state.kit.d) { toast('최대 3까지만 나타낼 수 있어요', 'warn'); n = LIM.mul * state.kit.d; }
    n = clamp(n, 0, LIM.mul * state.kit.d); if (n === state.kit.n) return;
    kitChange(k => { k.n = n; });
  }
  function kitSplit(k) { const s = state.kit; if (s.d * k > LIM.kitD) return toast('분모는 24까지 나눌 수 있어요', 'warn'); const from = s.d; kitChange(st => { st.n *= k; st.d *= k; st.chain.push({ n: st.n, d: st.d, op: '×' + k }); }, { type: 'split', from }); }
  function kitMerge() {
    const s = state.kit, g = F.gcd(s.n, s.d);
    if (g === 1 || s.d === 1) return toast('더 약분할 수 없어요(기약분수)', 'info');
    const p = F.spf(g), from = s.d;
    kitChange(st => { st.n /= p; st.d /= p; st.chain.push({ n: st.n, d: st.d, op: '÷' + p }); }, { type: 'merge', from });
  }
  // 막대·원 칸 드래그 색칠
  function bindCellDrag(svg) {
    let drag = null;
    svg.addEventListener('pointerdown', e => {
      const cell = e.target.closest('.cell'); if (!cell || tr.pen.on || svg.querySelector('.locked')) return;
      A.finishAll(); const i = +cell.dataset.i, k = state.kit;
      drag = { start: i, min: i, max: i, erase: i < k.n, moved: false, before: JSON.stringify(k) };
      svg.setPointerCapture(e.pointerId); document.body.classList.add('dragging'); e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      const el = document.elementFromPoint(e.clientX, e.clientY), cell = el && el.closest ? el.closest('.cell') : null;
      if (!cell || !svg.contains(cell)) return;
      const i = +cell.dataset.i; if (i === drag.start && !drag.moved) return;
      drag.moved = true; drag.min = Math.min(drag.min, i); drag.max = Math.max(drag.max, i);
      const n = clamp(drag.erase ? drag.min : drag.max + 1, 0, LIM.mul * state.kit.d);
      if (n !== state.kit.n) { state.kit.n = n; Kit.render(kitRoot(), state.kit, { interactive: true, controls: true }); }
    });
    const up = () => {
      if (!drag) return; const k = state.kit;
      const n = drag.moved ? k.n : (drag.start + 1 === k.n ? drag.start : drag.start + 1);
      const before = drag.before; drag = null; document.body.classList.remove('dragging');
      const u = undo.kit; u.past.push(before); if (u.past.length > LIM.undo) u.past.shift(); u.future = [];
      k.n = clamp(n, 0, LIM.mul * k.d); k.chain = [{ n: k.n, d: k.d, op: 'start' }];
      Kit.render(kitRoot(), k, { interactive: true, controls: true }); updateUndoButtons(); persist();
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  }
  // 수직선 점 드래그(스냅) + 어림 모드 탭
  function bindLineDrag(svg) {
    let drag = null;
    const valueAt = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); const Un = Kit.units(state.kit); return clamp((p.x - 36) / (R.W - 72) * Un, 0, Un); };
    svg.addEventListener('pointerdown', e => {
      if (tr.pen.on) return; A.finishAll();
      if (tr.estimate) { estimateTap(valueAt(e)); return; }
      drag = { before: JSON.stringify(state.kit) }; svg.setPointerCapture(e.pointerId); document.body.classList.add('dragging'); e.preventDefault();
      moveTo(valueAt(e));
    });
    const moveTo = v => { const k = state.kit, n = clamp(Math.round(v * k.d), 0, LIM.mul * k.d); if (n !== k.n) { k.n = n; Kit.render(kitRoot(), k, { interactive: true, controls: true }); } };
    svg.addEventListener('pointermove', e => { if (drag) moveTo(valueAt(e)); });
    const up = () => { if (!drag) return; const u = undo.kit; u.past.push(drag.before); if (u.past.length > LIM.undo) u.past.shift(); u.future = []; drag = null; document.body.classList.remove('dragging'); state.kit.chain = [{ n: state.kit.n, d: state.kit.d, op: 'start' }]; Kit.render(kitRoot(), state.kit, { interactive: true, controls: true }); updateUndoButtons(); persist(); };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  }
  // 어림 피드백
  function estimateTap(v) {
    const e = tr.estimate; if (!e || e.revealed) return;
    const k = state.kit, t = e.target.n / k.d, err = Math.abs(v - t);
    e.tapped = v;
    Kit.render(kitRoot(), k, { interactive: true, controls: true });
    setTimeout(() => {
      if (tr.estimate !== e) return; e.revealed = true;
      if (err < 1 / (4 * k.d)) { e.msg = '정확해요!'; e.cls = 'ok'; }
      else if (err < 1 / k.d) { e.msg = `가까워요 (차이 약 1/${k.d})`; e.cls = 'warn'; }
      else { e.msg = `${v < t ? '오른쪽' : '왼쪽'}으로 ${Math.round(err * k.d)}칸`; e.cls = 'warn'; }
      Kit.render(kitRoot(), k, { interactive: true, controls: true });
    }, A.motionOff() ? 0 : 300);
  }
  function randomTarget() { const k = state.kit, total = Kit.units(k) * k.d; let n = 1 + Math.floor(Math.random() * Math.max(1, total - 1)); if (tr.estimate && n === tr.estimate.target.n && total > 2) n = 1 + Math.floor(Math.random() * (total - 1)); return { n, d: k.d }; }
  async function openEstimate() {
    if (tr.estimate) { tr.estimate = null; renderTab(); return; }
    const k = state.kit, total = Kit.units(k) * k.d;
    const body = `<p class="muted">현재 분모 ${k.d}에서 목표 분수를 정하세요. 수직선의 눈금이 숨겨지고 정수 눈금만 남아요.</p>
      <div class="form-row"><label>분자 <input type="number" id="est-n" min="0" max="${total}" value="${Math.min(total, Math.max(1, k.n))}"></label><span class="big-slash">/ ${k.d}</span><button type="button" class="chip-btn" id="est-rand">무작위</button></div><p class="form-err" id="est-err"></p>`;
    let chosen = null;
    const v = await U.openDialog({
      title: '어림해서 찍기', body, buttons: [{ text: '취소', value: null }, { text: '시작', value: true, primary: true }],
      onOpen(a) { a.body.querySelector('#est-rand').addEventListener('click', () => { a.body.querySelector('#est-n').value = randomTarget().n; }); },
      validate(a) { const n = +a.body.querySelector('#est-n').value; const ok = Number.isInteger(n) && n >= 0 && n <= total; a.body.querySelector('#est-err').textContent = ok ? '' : `분자는 0~${total}`; if (ok) chosen = n; return ok; },
    });
    if (!v || chosen == null) return;
    tr.estimate = { target: { n: chosen, d: k.d }, tapped: null, revealed: false };
    renderTab();
  }

  // ---- 비교·통분 ----
  const Compare = {
    calc(c) { const L = F.lcm(c.a.d, c.b.d), k1 = L / c.a.d, k2 = L / c.b.d, Ax = { n: c.a.n * k1, d: L }, Bx = { n: c.b.n * k2, d: L }; return { L, k1, k2, A: Ax, B: Bx, sign: F.compare(c.a, c.b), diff: F.reduce(Math.abs(Ax.n - Bx.n), L), same: c.a.d === c.b.d }; },
    units: c => Math.max(R.unitsFor(c.a.n, c.a.d, 'auto'), R.unitsFor(c.b.n, c.b.d, 'auto')),
    render(root, c, o = {}) {
      const x = this.calc(c), Un = this.units(c), svg = root.querySelector('.cmp-bars');
      R.clear(svg); svg.setAttribute('viewBox', `0 0 ${R.W} ${ROWH * 2}`);
      const g = R.svgEl('g', { class: 'bar' + (o.interactive ? ' interactive' : '') }, svg);
      const va = c.a.n / c.a.d, vb = c.b.n / c.b.d;
      [['a', c.step >= 1 ? x.A : c.a, o.anim === 'a' ? c.a.d : null], ['b', c.step >= 2 ? x.B : c.b, o.anim === 'b' ? c.b.d : null]].forEach(([who, fr, newFrom], i) => {
        R.svgEl('text', { class: 'row-label f-' + who, x: 0, y: i * ROWH + 14 }, g).textContent = who.toUpperCase();
        const gw = R.svgEl('g', { 'data-who': who }, g);
        const opts = { n: fr.n, d: fr.d, units: Un, fill: who, top: i * ROWH + BAR_TOP, height: BAR_H, newFrom };
        if (who === 'a' && c.overlay) { opts.overlay = { v: vb, fill: 'b' }; opts.hatch = [Math.min(va, vb), Math.max(va, vb)]; }
        R.barInto(gw, opts);
      });
      if (o.anim) A.fadeIn(svg, '.new', ANIM);
      const tickD = x.L <= 48 ? x.L : 1;
      R.line(root.querySelector('.cmp-line'), { d: tickD, range: Un, points: [{ n: x.A.n, d: x.L, cls: 'a', label: 'A' }, { n: x.B.n, d: x.L, cls: 'b', label: 'B' }], labels: x.L <= 12 });
      root.querySelectorAll('.cmp-steps li').forEach((li, i) => { li.classList.toggle('active', c.step === i + 1); li.classList.toggle('done', c.step > i + 1); });
      const sg = x.sign > 0 ? '>' : x.sign < 0 ? '<' : '=', lines = [];
      if (c.step >= 1 && !x.same) lines.push(`${F.str(c.a.n, c.a.d)} = ${F.str(x.A.n, x.L)}`);
      if (c.step >= 2 && !x.same) lines.push(`${F.str(c.b.n, c.b.d)} = ${F.str(x.B.n, x.L)}`);
      if (c.step >= 3) lines.push(`${F.str(x.A.n, x.L)} ${sg} ${F.str(x.B.n, x.L)} → ${F.str(c.a.n, c.a.d)} ${sg} ${F.str(c.b.n, c.b.d)}`);
      if (c.step >= 3 || c.overlay) lines.push(`차이: ${F.str(x.diff.n, x.diff.d)}`);
      root.querySelector('.cmp-formula').innerHTML = lines.length ? lines.map(l => `<div class="fline">${escapeHtml(l)}</div>`).join('') : '<div class="fline muted">같은 분모로 맞추기를 눌러 통분 과정을 확인하세요</div>';
      if (o.controls) {
        updateAb(root, 'a', c.a); updateAb(root, 'b', c.b);
        root.querySelector('[data-action=cmp-overlay]').setAttribute('aria-pressed', String(c.overlay));
        root.querySelector('[data-action=cmp-next]').disabled = c.step >= 3; root.querySelector('[data-action=cmp-auto]').disabled = c.step >= 3;
      }
    },
    // 한 단계 진행: {anim, msg} 또는 null(끝)
    advance(c) {
      if (c.step >= 3) return null;
      if (c.step === 0) { if (this.calc(c).same) { c.step = 3; return { msg: '이미 분모가 같아요' }; } c.step = 1; return { anim: 'a' }; }
      if (c.step === 1) { c.step = 2; return { anim: 'b' }; }
      c.step = 3; return {};
    },
  };
  function cmpStep() { const c = state.compare; A.finishAll(); const r = Compare.advance(c); if (!r) return false; if (r.msg) toast(r.msg, 'info'); renderTab({ anim: r.anim }); persist(); return c.step < 3; }
  function cmpChange(mut) { A.finishAll(); stopAuto(); pushUndo('compare'); mut(state.compare); renderTab(); persist(); }

  // ---- 덧셈·뺄셈 ----
  const Arith = {
    calc(r) {
      const L = F.lcm(r.a.d, r.b.d), k1 = L / r.a.d, k2 = L / r.b.d, Ax = { n: r.a.n * k1, d: L }, Bx = { n: r.b.n * k2, d: L }, sub = r.op === '-';
      const N = sub ? Ax.n - Bx.n : Ax.n + Bx.n, red = F.reduce(Math.max(N, 0), L);
      const wrongN = sub ? r.a.n - r.b.n : r.a.n + r.b.n, wrongD = r.a.d + r.b.d;
      return { L, k1, k2, A: Ax, B: Bx, sub, N, red, canReduce: N > 0 && red.d !== L, same: r.a.d === r.b.d, wrongN, wrongD, wrongDiff: wrongN >= 0 ? F.reduce(Math.abs(N * wrongD - wrongN * L), L * wrongD) : null };
    },
    units(r) { const x = this.calc(r); return Math.max(R.unitsFor(r.a.n, r.a.d, 'auto'), R.unitsFor(r.b.n, r.b.d, 'auto'), R.unitsFor(Math.max(x.N, 0), x.L, 'auto')); },
    render(root, r, o = {}) {
      const x = this.calc(r), Un = this.units(r), svg = root.querySelector('.ar-bars');
      const mirror = r.mirror && r.step >= 3 && settings.teacherMode, rows = mirror && x.wrongN >= 0 ? 4 : 3;
      R.clear(svg); svg.setAttribute('viewBox', `0 0 ${R.W} ${ROWH * rows}`);
      const g = R.svgEl('g', { class: 'bar' + (o.interactive ? ' interactive' : '') }, svg);
      const row = (i, label, cls) => { R.svgEl('text', { class: 'row-label ' + cls, x: 0, y: i * ROWH + 14 }, g).textContent = label; return i * ROWH + BAR_TOP; };
      const common = o.anim === 'common' && !x.same;
      R.barInto(R.svgEl('g', { 'data-who': 'a' }, g), { n: (r.step >= 1 ? x.A : r.a).n, d: (r.step >= 1 ? x.A : r.a).d, units: Un, fill: 'a', top: row(0, 'A', 'f-a'), height: BAR_H, newFrom: common ? r.a.d : null });
      R.barInto(R.svgEl('g', { 'data-who': 'b' }, g), { n: (r.step >= 1 ? x.B : r.b).n, d: (r.step >= 1 ? x.B : r.b).d, units: Un, fill: 'b', top: row(1, 'B', 'f-b'), height: BAR_H, newFrom: common ? r.b.d : null });
      const rt = row(2, '결과', 'f-r');
      const resN = r.step >= 2 ? Math.max(x.N, 0) : 0, moving = o.anim === 'move';
      const resOpts = { n: moving ? x.A.n : resN, d: x.L, units: Un, fill: 'r', top: rt, height: BAR_H, flash: o.anim === 'flash' && x.N >= x.L, highlight: o.highlight ? [0, resN] : null };
      if (r.step >= 4 && x.canReduce) { resOpts.d = x.red.d; resOpts.n = x.red.n; if (o.anim === 'reduce') resOpts.ghostD = x.L; }
      const geo = R.barInto(R.svgEl('g', { 'data-who': 'r' }, g), resOpts);
      if (rows === 4) {
        const mt = row(3, '분자끼리·분모끼리 (오개념)', 'f-w'), cd = F.lcm(x.L, x.wrongD);
        R.barInto(R.svgEl('g', {}, g), { n: x.wrongN, d: x.wrongD, units: Un, fill: 'w', top: mt, height: BAR_H, bw: false, labels: false, faintD: cd <= 144 ? cd : null });
      }
      if (common) A.fadeIn(svg, '.new', ANIM);
      if (o.anim === 'reduce') A.fadeOut(svg, '.ghost', ANIM);
      if (moving) { // B의 색칠 칸 그룹 이동
        const mg = R.svgEl('g', { class: 'moving' }, g), xOf = i => Math.floor(i / x.L) * (geo.unitW + R.GAP) + (i % x.L) * geo.cell;
        for (let i = 0; i < x.B.n; i++) R.svgEl('rect', { class: 'cell on f-b', x: xOf(i), y: ROWH + BAR_TOP, width: geo.cell, height: BAR_H }, mg);
        const dx = xOf(x.sub ? x.A.n - x.B.n : x.A.n), dy = rt - (ROWH + BAR_TOP);
        A.move(mg, [0, 0], [dx, dy], 600, () => {
          if (!x.sub) return this.render(root, r, Object.assign({}, o, { anim: null }));
          mg.querySelectorAll('rect').forEach(e => e.setAttribute('fill', 'url(#hatch-wrong)'));
          A.run(500, t => { mg.style.opacity = 1 - t; }, () => this.render(root, r, Object.assign({}, o, { anim: null, highlight: true })));
        });
      }
      root.querySelectorAll('.ar-steps li').forEach((li, i) => { li.classList.toggle('active', r.step === i + 1); li.classList.toggle('done', r.step > i + 1); li.classList.toggle('skip', (i === 0 && x.same) || (i === 3 && r.step >= 3 && !x.canReduce)); });
      const op = x.sub ? '−' : '+', terms = [`${F.str(r.a.n, r.a.d)} ${op} ${F.str(r.b.n, r.b.d)}`];
      if (r.step >= 1 && !x.same) terms.push(`${F.str(x.A.n, x.L)} ${op} ${F.str(x.B.n, x.L)}`);
      if (r.step >= 3) { terms.push(x.N >= 0 ? F.str(x.N, x.L) : '?'); if (x.N >= x.L && x.L > 1) terms.push(F.mixedStr(x.N, x.L)); }
      if (r.step >= 4 && x.canReduce) terms.push(F.mixedStr(x.red.n, x.red.d));
      root.querySelector('.ar-formula').innerHTML = `<div class="fline">${terms.map((t, i) => (i ? '<span class="eq-sign">=</span>' : '') + `<span class="term ${i === terms.length - 1 && i > 0 ? 'last' : ''}">${escapeHtml(t)}</span>`).join('')}</div>`;
      const ml = root.querySelector('.ar-mirror-label'); if (ml) ml.hidden = !mirror;
      if (mirror && ml) ml.textContent = x.wrongN < 0 ? `분자끼리·분모끼리 빼면 ${x.wrongN}/${x.wrongD} — 이 방법으로는 뺄 수도 없어요` : `분자끼리·분모끼리 ${x.sub ? '빼면' : '더하면'} ${F.str(x.wrongN, x.wrongD)} — 실제 결과 ${F.str(x.N, x.L)}과의 차이: ${F.str(x.wrongDiff.n, x.wrongDiff.d)}`;
      if (o.controls) {
        updateAb(root, 'a', r.a); updateAb(root, 'b', r.b);
        root.querySelectorAll('[data-action=ar-op]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.op === r.op)));
        const end = r.step >= 4 || (r.step >= 3 && !x.canReduce);
        root.querySelector('[data-action=ar-next]').disabled = end; root.querySelector('[data-action=ar-auto]').disabled = end;
        const mb = root.querySelector('[data-action=ar-mirror]'); mb.disabled = r.step < 3; mb.setAttribute('aria-pressed', String(!!r.mirror));
      }
    },
    advance(r) {
      const x = this.calc(r);
      if (r.step === 0) { r.step = x.same ? 2 : 1; return { anim: x.same ? 'move' : 'common' }; }
      if (r.step === 1) { r.step = 2; return { anim: 'move' }; }
      if (r.step === 2) { r.step = 3; return { anim: 'flash' }; }
      if (r.step === 3 && x.canReduce) { r.step = 4; return { anim: 'reduce' }; }
      return null;
    },
  };
  async function arStep(fromUser) {
    const r = state.arith; A.finishAll();
    if (r.step === 0 && r.op === '-' && F.compare(r.a, r.b) < 0) {
      stopAuto();
      const ok = fromUser && await U.showModal({ title: '뺄셈 순서', body: '<p>앞의 분수가 더 작아요. 자리를 바꿀까요?</p>', confirmText: '바꾸기', cancelText: '취소' });
      if (!ok) return false;
      pushUndo('arith'); [r.a, r.b] = [r.b, r.a];
    } else pushUndo('arith');
    const res = Arith.advance(r); if (!res) return false;
    renderTab({ anim: res.anim }); persist();
    return !!Arith.advance(clone(r));
  }
  function arChange(mut) { A.finishAll(); stopAuto(); pushUndo('arith'); mut(state.arith); renderTab(); persist(); }

  // ---- 앱 셸: 테마·칠판·교사·전체화면·커튼·학년 ----
  function applyTheme() {
    const t = store.get('theme', null), html = document.documentElement;
    if (t) html.dataset.theme = t; else delete html.dataset.theme;
    const dark = (html.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    $('#btn-theme').textContent = dark ? '☀️' : '🌙'; $('#btn-theme').setAttribute('aria-label', dark ? '라이트 테마로 전환' : '다크 테마로 전환');
  }
  function applySettings() {
    const html = document.documentElement;
    html.dataset.board = settings.boardMode ? 'on' : 'off'; $('#btn-board').setAttribute('aria-pressed', String(!!settings.boardMode));
    html.dataset.teacher = settings.teacherMode ? 'on' : 'off'; const tb = $('#btn-teacher'); tb.setAttribute('aria-pressed', String(!!settings.teacherMode)); tb.textContent = '교사 모드: ' + (settings.teacherMode ? '켬' : '끔');
    $('#grade-preset').value = settings.gradePreset ? String(settings.gradePreset) : '';
    html.dataset.grade = settings.gradePreset || '';
    $('.tabs [data-tab=arith]').hidden = settings.gradePreset === 3;
    if (settings.gradePreset === 3 && state.tab === 'arith') setTab('kit');
  }
  function setGrade(g) {
    settings.gradePreset = g || null; saveSettings();
    if (state.kit.d > gradeMaxD()) { state.kit.d = gradeMaxD(); state.kit.n = Math.min(state.kit.n, LIM.mul * state.kit.d); state.kit.chain = [{ n: state.kit.n, d: state.kit.d, op: 'start' }]; }
    if (g) { state.kit.showDecimal = g === 3 || g === 6; state.worksheet.model = g === 3 ? 'circle' : 'bar'; }
    if (FK.cards) FK.cards.setGradeFilter(g && g <= 5 ? String(g) : '');
    $('#kit-d').max = gradeMaxD();
    applySettings(); renderTab(); persist();
    toast(g ? `${g}학년 프리셋 적용` : '학년 프리셋 해제', 'info');
  }
  function toggleFullscreen() {
    const html = document.documentElement, fb = () => { tr.fsFallback = !tr.fsFallback; html.dataset.fs = tr.fsFallback ? 'on' : 'off'; };
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (tr.fsFallback) { fb(); return; }
    try { const p = html.requestFullscreen(); if (p && p.catch) p.catch(fb); } catch (e) { fb(); }
  }
  const setCurtain = on => { tr.curtain = on; document.documentElement.dataset.curtain = on ? 'on' : 'off'; $('#btn-curtain').setAttribute('aria-pressed', String(on)); };
  FK.setCurtain = setCurtain;

  // ---- 펜 주석 레이어 ----
  const pen = tr.pen, canvas = $('#pen-canvas'), pctx = canvas.getContext('2d');
  const TOOLS = { red: { color: '#ef4444', w: 4, a: 1 }, blue: { color: '#2563eb', w: 4, a: 1 }, hl: { color: '#facc15', w: 18, a: 0.4 }, eraser: { w: 24, erase: true } };
  function penResize() {
    const area = $('.work-area'), rect = area.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
    penRedraw();
  }
  function penDrawStroke(s) {
    const t = TOOLS[s.tool]; pctx.save(); pctx.lineCap = pctx.lineJoin = 'round'; pctx.lineWidth = t.w * (canvas.width / 1000) * (1000 / Math.max(600, canvas.clientWidth)); pctx.strokeStyle = t.color || '#000'; pctx.globalAlpha = t.a || 1;
    pctx.globalCompositeOperation = t.erase ? 'destination-out' : 'source-over'; pctx.beginPath();
    s.pts.forEach(([x, y], i) => { const X = x * canvas.width, Y = y * canvas.height; if (i) pctx.lineTo(X, Y); else pctx.moveTo(X, Y); });
    if (s.pts.length === 1) pctx.lineTo(s.pts[0][0] * canvas.width + 0.1, s.pts[0][1] * canvas.height);
    pctx.stroke(); pctx.restore();
  }
  function penRedraw() { pctx.clearRect(0, 0, canvas.width, canvas.height); pen.strokes.forEach(penDrawStroke); }
  function penClear() { pen.strokes = []; penRedraw(); }
  function setPen(on) {
    pen.on = on; document.documentElement.dataset.pen = on ? 'on' : 'off'; $('#pen-layer').hidden = !on; $('#pen-tools').hidden = !on; $('#btn-pen').setAttribute('aria-pressed', String(on));
    if (on) penResize(); else penClear();
  }
  (() => {
    let cur = null, snap = null;
    const norm = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    canvas.addEventListener('pointerdown', e => { if (!pen.on) return; canvas.setPointerCapture(e.pointerId); snap = pctx.getImageData(0, 0, canvas.width, canvas.height); cur = { tool: pen.tool, pts: [norm(e)] }; penDrawStroke(cur); e.preventDefault(); });
    canvas.addEventListener('pointermove', e => { if (!cur) return; cur.pts.push(norm(e)); pctx.putImageData(snap, 0, 0); penDrawStroke(cur); });
    const up = () => { if (!cur) return; pen.strokes.push(cur); cur = null; snap = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    $('#pen-tools').addEventListener('click', e => {
      const b = e.target.closest('[data-pen]'); if (!b) return; const t = b.dataset.pen;
      if (t === 'off') return setPen(false); if (t === 'clear') return penClear();
      pen.tool = t; $$('#pen-tools .pen-tool').forEach(x => x.classList.toggle('active', x === b));
    });
    window.addEventListener('resize', U.debounce(() => { if (pen.on) penResize(); }, 150));
  })();

  // ---- 그림(PNG) 저장 ----
  async function savePng() {
    const stage = $(`main [data-view=${state.tab}] .stage`) || $(`main [data-view=${state.tab}]`);
    const svgs = $$('svg', stage).filter(s => s.getBoundingClientRect().width > 0 && !s.closest('[hidden]'));
    if (!svgs.length) return toast('저장할 그림이 없어요. 교구판·비교·덧셈뺄셈 탭에서 이용하세요', 'warn');
    let includePen = true;
    const go = await U.openDialog({ title: '그림 저장(PNG)', body: '<label><input type="checkbox" id="png-pen" checked> 펜 주석 포함</label>', buttons: [{ text: '취소', value: null }, { text: '저장', value: true, primary: true }], validate(a) { includePen = a.body.querySelector('#png-pen').checked; return true; } });
    if (!go) return;
    try {
      const Wpx = 1600, cs = getComputedStyle(document.documentElement), css = `.bar-bg{fill:${cs.getPropertyValue('--bar-bg')}}.cell{fill:transparent}.cell.on.f-a{fill:${cs.getPropertyValue('--fill-a')}}.cell.on.f-b{fill:${cs.getPropertyValue('--fill-b')}}.cell.on.f-r{fill:${cs.getPropertyValue('--fill-r')}}.cell.ov{opacity:.55}.div,.tick,.axis,.bar-frame,.circle-frame{stroke:${cs.getPropertyValue('--div')};stroke-width:2;fill:none}.tick.big{stroke-width:3}.cell-label,.tick-label,.row-label{font:20px sans-serif;fill:${cs.getPropertyValue('--fg')}}.pt{fill:${cs.getPropertyValue('--fill-a')}}.pt.f-b{fill:${cs.getPropertyValue('--fill-b')}}.hatch{opacity:.8}`;
      const parts = await Promise.all(svgs.map(s => new Promise((res, rej) => {
        const vb = s.viewBox.baseVal, h = Math.round(Wpx * vb.height / vb.width), c = s.cloneNode(true);
        c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', Wpx); c.setAttribute('height', h); c.insertAdjacentHTML('afterbegin', `<style>${css}</style>`);
        const img = new Image(), url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], { type: 'image/svg+xml' }));
        img.onload = () => { URL.revokeObjectURL(url); res({ img, h }); }; img.onerror = () => rej(new Error('svg')); img.src = url;
      })));
      const out = document.createElement('canvas'); out.width = Wpx; out.height = parts.reduce((a, p) => a + p.h + 40, 40);
      const ctx = out.getContext('2d'); ctx.fillStyle = cs.getPropertyValue('--surface') || '#fff'; ctx.fillRect(0, 0, out.width, out.height);
      let y = 20; parts.forEach(p => { ctx.drawImage(p.img, 0, y); y += p.h + 40; });
      if (includePen && pen.on) ctx.drawImage(canvas, 0, 0, out.width, out.height);
      const name = (state.loadedSceneId && (db.scenes.find(s => s.id === state.loadedSceneId) || {}).name) || state.tab;
      U.download(`fraction-kit-${name}.png`, await new Promise(r => out.toBlob(r, 'image/png')), 'image/png');
      toast('그림을 저장했어요', 'success');
    } catch (e) { toast('이 브라우저에서는 그림 저장을 지원하지 않아요. 인쇄를 이용하세요', 'error'); }
  }

  // ---- 도움말 ----
  function openHelp() {
    const body = `<ol class="help-steps">${D.help.map(([t, b]) => `<li><b>${escapeHtml(t)}</b><p>${escapeHtml(b)}</p></li>`).join('')}</ol>
      <h3>팁</h3><p class="muted">칠판 모드와 전체화면을 함께 켜면 전자칠판에서 보기 좋아요. 커튼으로 결과를 가리고 학생 예측을 먼저 받아 보세요. 교사 모드를 끄면 해설·집계·편집 기능이 숨겨져 학생용 화면이 됩니다.</p>
      <h3>단축키</h3><table class="help-keys">${D.shortcuts.map(([k, v]) => `<tr><td><kbd>${escapeHtml(k)}</kbd></td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>`;
    U.openDialog({ title: '분수교구함 사용법', body, size: 'wide', buttons: [{ text: '닫기', value: true, primary: true }] });
  }

  // ---- 액션 등록 ----
  Object.assign(FK.actions, {
    undo: () => doUndo(false), redo: () => doUndo(true), help: openHelp, png: savePng,
    theme: () => { const html = document.documentElement; const cur = html.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); store.set('theme', cur === 'dark' ? 'light' : 'dark'); applyTheme(); },
    board: () => { settings.boardMode = !settings.boardMode; saveSettings(); applySettings(); if (pen.on) penResize(); },
    teacher: () => { settings.teacherMode = !settings.teacherMode; saveSettings(); applySettings(); renderTab(); },
    fullscreen: toggleFullscreen,
    curtain: () => setCurtain(!tr.curtain),
    pen: () => setPen(!pen.on),
    'close-banner': () => { $('#save-banner').hidden = true; },
    'toggle-ctrl': b => { const c = b.closest('.ctrl'); c.classList.toggle('open'); b.setAttribute('aria-expanded', String(c.classList.contains('open'))); },
    'kit-d': b => kitSetD(state.kit.d + +b.dataset.delta),
    'kit-n': b => kitSetN(state.kit.n + +b.dataset.delta),
    split: b => kitSplit(+b.dataset.k), merge: kitMerge,
    'clear-chain': () => kitChange(k => { k.chain = [{ n: k.n, d: k.d, op: 'start' }]; }, null),
    estimate: openEstimate,
    'est-again': () => { if (tr.estimate) { tr.estimate.tapped = null; tr.estimate.revealed = false; tr.estimate.msg = ''; renderTab(); } },
    'est-random': () => { if (tr.estimate) { tr.estimate = { target: randomTarget(), tapped: null, revealed: false }; renderTab(); } },
    'cmp-start': () => { const c = state.compare; if (c.step !== 0) return toast('처음으로를 누른 뒤 다시 시작하세요', 'info'); stopAuto(); pushUndo('compare'); cmpStep(); },
    'cmp-next': () => { stopAuto(); pushUndo('compare'); cmpStep(); },
    'cmp-auto': () => { stopAuto(); pushUndo('compare'); tr.autoplay = A.playSteps(cmpStep, 600, () => { tr.autoplay = null; }); },
    'cmp-reset': () => cmpChange(c => { c.step = 0; }),
    'cmp-overlay': () => cmpChange(c => { c.overlay = !c.overlay; }),
    'cmp-swap': () => cmpChange(c => { [c.a, c.b] = [c.b, c.a]; c.step = 0; }),
    'cmp-clear': () => cmpChange(c => Object.assign(c, defaults.compare())),
    'ar-next': () => { stopAuto(); arStep(true); },
    'ar-auto': () => { stopAuto(); const r = state.arith; if (r.step === 0 && r.op === '-' && F.compare(r.a, r.b) < 0) return arStep(true); tr.autoplay = A.playSteps(() => { const before = state.arith.step; arStep(false); if (state.arith.step === before) return false; return !!Arith.advance(clone(state.arith)); }, 900, () => { tr.autoplay = null; }); },
    'ar-reset': () => arChange(r => { r.step = 0; r.mirror = false; }),
    'ar-mirror': () => arChange(r => { r.mirror = !r.mirror; }),
    'ar-swap': () => arChange(r => { [r.a, r.b] = [r.b, r.a]; r.step = 0; r.mirror = false; }),
    'ar-op': b => arChange(r => { r.op = b.dataset.op; r.step = 0; r.mirror = false; }),
  });

  // ---- 이벤트 바인딩 ----
  function bind() {
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-action]'); if (!b || b.disabled) return;
      const h = FK.actions[b.dataset.action]; if (h) { h(b, e); const m = b.closest('.more'); if (m && b.tagName === 'BUTTON') m.open = false; }
    });
    document.addEventListener('click', e => { const m = $('#more-menu'); if (m && m.open && !m.contains(e.target)) m.open = false; });
    $('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
    $('#grade-preset').addEventListener('change', e => setGrade(e.target.value ? +e.target.value : null));
    // 교구판 컨트롤
    const kr = kitRoot(), slider = $('#kit-d'); let sliding = false;
    slider.addEventListener('input', () => { const d = +slider.value; if (d === state.kit.d) return; if (!sliding) { sliding = true; pushUndo('kit'); } tr.estimate = null; A.finishAll(); state.kit.d = d; state.kit.n = Math.min(state.kit.n, LIM.mul * d); state.kit.chain = [{ n: state.kit.n, d, op: 'start' }]; Kit.render(kr, state.kit, { interactive: true, controls: true }); persist(); });
    slider.addEventListener('change', () => { sliding = false; });
    $('#kit-range').addEventListener('change', e => kitChange(k => { k.lineRange = e.target.value === 'auto' ? 'auto' : +e.target.value; }, null, true));
    $$('[data-model-toggle]').forEach(c => c.addEventListener('change', () => { state.kit.models[c.dataset.modelToggle] = c.checked; if (!Object.values(state.kit.models).some(Boolean)) { state.kit.models.bar = true; toast('모델은 하나 이상 켜 두세요', 'info'); } renderTab(); persist(); }));
    $('#kit-decimal').addEventListener('change', e => { state.kit.showDecimal = e.target.checked; renderTab(); persist(); });
    $('.model-tabs').addEventListener('click', e => { const b = e.target.closest('[data-model-tab]'); if (!b) return; $('.models').dataset.activeModel = b.dataset.modelTab; $$('[data-model-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b))); });
    bindCellDrag($('.kit-bar')); bindCellDrag($('.kit-circle')); bindLineDrag($('.kit-line'));
    // 비교·연산 입력 블록
    $('#cmp-inputs').innerHTML = abBlockHtml('compare', 'a') + abBlockHtml('compare', 'b');
    $('#ar-inputs').innerHTML = abBlockHtml('arith', 'a') + `<div class="op-toggle" role="group" aria-label="연산"><button type="button" data-action="ar-op" data-op="+" aria-pressed="true">+</button><button type="button" data-action="ar-op" data-op="-" aria-pressed="false">−</button></div>` + abBlockHtml('arith', 'b');
    bindAb('compare'); bindAb('arith');
    bindBoardCells($('.cmp-bars'), 'compare'); bindBoardCells($('.ar-bars'), 'arith');
    // 단축키
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === 'Escape') { if (tr.fsFallback) { tr.fsFallback = false; document.documentElement.dataset.fs = 'off'; } return; }
      const textLike = tag === 'textarea' || tag === 'select' || (tag === 'input' && !['range', 'checkbox', 'radio', 'file'].includes(e.target.type));
      if (textLike || document.documentElement.dataset.modal === 'on') return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(false); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); doUndo(true); }
      }
    });
    document.addEventListener('fullscreenchange', () => { $('#btn-fs').textContent = document.fullscreenElement ? '전체화면 해제' : '전체화면'; });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  }

  // ---- 시작 ----
  function boot() {
    loadAll(); applyTheme(); applySettings(); bind();
    ['cards', 'scenes', 'sheet'].forEach(m => { if (FK[m] && FK[m].init) FK[m].init(); });
    $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', 'false'));
    setTab(settings.lastTab);
    if (store.failed) $('#save-banner').hidden = false;
  }
  FK.app = { state, settings, db, tr, LIM, defaults, clone, sanitizeState, getSceneState, persist, saveDb, saveSettings, pushUndo, setTab, renderTab, renderMemo, Kit, Compare, Arith, updateAb, stopAuto, seed, setPen, penClear };
  window.__app = {
    version: '1.0.0',
    getState: () => clone({ tab: state.tab, kit: state.kit, compare: state.compare, arith: state.arith, currentCardId: state.currentCardId, currentSetId: state.currentSetId, loadedSceneId: state.loadedSceneId, worksheet: state.worksheet, settings, counts: { scenes: db.scenes.length, cards: db.cards.length, cardSets: db.cardSets.length }, curtain: tr.curtain, pen: pen.on, estimate: tr.estimate, undo: { past: (undo[state.tab] || { past: [] }).past.length, future: (undo[state.tab] || { future: [] }).future.length } }),
    actions: {
      setTab, kitSetD, kitSetN, kitSplit, kitMerge, undo: () => doUndo(false), redo: () => doUndo(true),
      compareSet: (who, n, d) => abSet('compare', who, { n, d }), compareNext: () => FK.actions['cmp-next'](), compareStart: () => FK.actions['cmp-start'](), compareOverlay: () => FK.actions['cmp-overlay'](),
      arithSet: (who, n, d) => abSet('arith', who, { n, d }), arithOp: op => arChange(r => { r.op = op; r.step = 0; r.mirror = false; }), arithNext: () => arStep(true), arithMirror: () => FK.actions['ar-mirror'](),
      setCurtain, setPen, setBoard: on => { settings.boardMode = !!on; saveSettings(); applySettings(); }, setTeacher: on => { settings.teacherMode = !!on; saveSettings(); applySettings(); renderTab(); }, setGrade,
      getDb: () => clone(db), selectCard: id => FK.cards && FK.cards.select(id), predict: i => FK.cards && FK.cards.predict(i), confirmCard: () => FK.cards && FK.cards.confirm(), setTally: counts => FK.cards && FK.cards.setTally(counts),
      saveScene: meta => FK.scenes && FK.scenes.saveScene(meta), loadScene: id => FK.scenes && FK.scenes.load(id), importJson: text => FK.scenes && FK.scenes.importText(text), exportJson: () => FK.scenes && FK.scenes.exportData(), resetSamples: () => FK.scenes && FK.scenes.restoreSamples(true),
      sheetAddCard: id => FK.sheet && FK.sheet.toggleSource('card', id, true), sheetShuffle: () => FK.sheet && FK.sheet.shuffle(),
    },
  };
  document.addEventListener('DOMContentLoaded', boot);
})();
