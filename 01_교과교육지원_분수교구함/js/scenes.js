// scenes.js — 장면 보관함(저장·불러오기·JSON 내보내기/가져오기·샘플 복원)과 활동지(문항 구성·A4 미리보기·인쇄)
'use strict';
(() => {
  const F = FK.frac, R = FK.render, U = FK.ui, D = APP_DATA;
  const { $, escapeHtml, toast } = U;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const GRADE_TXT = g => (g ? `${g}학년` : '학년 없음');
  const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
  const cut = (s, n) => String(s ?? '').slice(0, n);
  let app, st, db;
  const sc = { search: '', grade: '' };

  // ---- 장면 보관함 ----
  const primaryFr = s => (s.tab === 'compare' ? s.compare.a : s.tab === 'arith' ? s.arith.a : { n: s.kit.n, d: s.kit.d });
  const uniqueName = name => { let n = name, i = 2; while (db.scenes.some(s => s.name === n)) n = `${name} (${i++})`; return n; };
  function visibleScenes() {
    let list = [...db.scenes].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (sc.grade === 'none') list = list.filter(s => !s.grade); else if (sc.grade) list = list.filter(s => String(s.grade) === sc.grade);
    if (sc.search) { const q = sc.search.toLowerCase(); list = list.filter(s => `${s.name} ${s.unit} ${s.memo}`.toLowerCase().includes(q)); }
    return list;
  }
  function renderScenes() {
    const grid = $('#scene-grid'), list = visibleScenes();
    if (!db.scenes.length) { grid.innerHTML = `<div class="empty-state"><p>저장된 장면이 없어요. 교구판에서 장면 저장을 눌러 보세요</p><button type="button" class="chip-btn accent" data-action="reset-samples">샘플 복원</button></div>`; return; }
    grid.innerHTML = list.length ? list.map(s => { const id = escapeHtml(s.id); return `<article class="scene-card" data-id="${id}">
      <label class="scene-check"><input type="checkbox" data-scene-check="${id}" aria-label="장면 선택"></label>
      <div class="scene-thumb">${R.thumb(primaryFr(s.state), s.state.tab === 'arith' ? 'r' : 'a')}</div>
      <h3 class="scene-name">${escapeHtml(s.name)}</h3>
      <div class="scene-meta"><span class="badge g${s.grade || 0}">${GRADE_TXT(s.grade)}</span>${s.builtin ? '<span class="badge soft">내장</span>' : ''}<span class="muted">${escapeHtml(s.unit)}</span></div>
      <p class="scene-memo">${escapeHtml((s.memo || '').split(/\s+\/\s+|\n/)[0])}</p>
      <div class="scene-foot"><span class="muted">${fmtDate(s.updatedAt)} · ${({ kit: '교구판', compare: '비교·통분', arith: '덧셈·뺄셈' })[s.state.tab]}</span></div>
      <div class="btn-row"><button type="button" class="chip-btn accent" data-sc="load" data-id="${id}">불러오기</button><button type="button" class="chip-btn ghost" data-sc="rename" data-id="${id}">이름 바꾸기</button><button type="button" class="chip-btn ghost" data-sc="dup" data-id="${id}">복제</button><button type="button" class="chip-btn ghost danger" data-sc="del" data-id="${id}">삭제</button></div></article>`; }).join('')
      : '<p class="empty">조건에 맞는 장면이 없어요</p>';
  }
  // 장면 저장 모달
  async function saveSceneDialog() {
    if (db.scenes.length >= app.LIM.scenes) return toast('장면은 200개까지 저장할 수 있어요. 오래된 장면을 삭제하거나 내보내기로 보관하세요', 'warn', 3500);
    const loaded = st.loadedSceneId && db.scenes.find(s => s.id === st.loadedSceneId);
    let meta = null;
    const ok = await U.openDialog({ title: '장면 저장', buttons: [{ text: '취소', value: null }, { text: '저장', value: true, primary: true }],
      body: `<div class="form-stack">${loaded ? '<p class="muted">새 장면으로 저장돼요. 불러온 장면은 그대로 남아요.</p>' : ''}<label>이름 <span class="req">(필수, 40자)</span><input type="text" id="sv-name" maxlength="40" value="${escapeHtml(loaded ? uniqueName(loaded.name) : '')}"></label>
        <label>학년 <select id="sv-grade"><option value="">없음</option>${[3, 4, 5, 6].map(g => `<option value="${g}" ${loaded && loaded.grade === g ? 'selected' : ''}>${g}학년</option>`).join('')}</select></label>
        <label>단원 <input type="text" id="sv-unit" maxlength="30" value="${escapeHtml(loaded ? loaded.unit : '')}" placeholder="예: 5-1 약분과 통분"></label>
        <label>메모(발문) <textarea id="sv-memo" maxlength="300" rows="3" placeholder="학생에게 던질 질문을 적어 두세요">${escapeHtml(loaded ? loaded.memo : '')}</textarea></label><p class="form-err" id="sv-err"></p></div>`,
      validate(a) { const name = a.body.querySelector('#sv-name').value.trim(); a.body.querySelector('#sv-err').textContent = name ? '' : '이름을 입력하세요'; if (!name) return false; meta = { name, grade: +a.body.querySelector('#sv-grade').value || null, unit: a.body.querySelector('#sv-unit').value.trim(), memo: a.body.querySelector('#sv-memo').value.trim() }; return true; } });
    if (ok && meta) saveScene(meta);
  }
  function saveScene(meta) {
    if (db.scenes.length >= app.LIM.scenes) { toast('장면은 200개까지 저장할 수 있어요', 'warn'); return null; }
    const now = new Date().toISOString();
    const s = { id: U.uid('sc-'), name: uniqueName(cut(meta.name, 40).trim() || '장면'), grade: [3, 4, 5, 6].includes(meta.grade) ? meta.grade : null, unit: cut(meta.unit, 30), memo: cut(meta.memo, 300), builtin: false, createdAt: now, updatedAt: now, state: app.getSceneState() };
    db.scenes.push(s); app.saveDb(); st.loadedSceneId = s.id; app.renderMemo(); app.persist();
    toast(`'${s.name}' 장면을 저장했어요`, 'success'); if (st.tab === 'scenes') renderScenes();
    return s.id;
  }
  function load(id) {
    const s = db.scenes.find(x => x.id === id); if (!s) return;
    const ns = app.sanitizeState(s.state);
    app.pushUndo(ns.tab); st.kit = ns.kit; st.compare = ns.compare; st.arith = ns.arith; st.loadedSceneId = s.id; app.tr.estimate = null;
    app.tr.abCarry = false; if (app.tr.pen.on) app.penClear(); // 불러온 장면은 비교→연산 이어 붙이기로 덮지 않고, 펜 주석은 지운다
    app.setTab(ns.tab); toast(`'${s.name}' 장면을 불러왔어요`, 'success');
  }
  async function rename(id) {
    const s = db.scenes.find(x => x.id === id); if (!s) return; let name = '';
    const ok = await U.openDialog({ title: '이름 바꾸기', body: `<label class="form-label">새 이름 <input type="text" id="rn-name" maxlength="40" value="${escapeHtml(s.name)}"></label><p class="form-err" id="rn-err"></p>`, buttons: [{ text: '취소', value: null }, { text: '저장', value: true, primary: true }],
      validate(a) { name = a.body.querySelector('#rn-name').value.trim(); a.body.querySelector('#rn-err').textContent = name ? '' : '이름을 입력하세요'; return !!name; } });
    if (!ok) return; if (name !== s.name) s.name = uniqueName(name); s.updatedAt = new Date().toISOString(); app.saveDb(); renderScenes(); app.renderMemo();
  }
  function duplicate(id) {
    const s = db.scenes.find(x => x.id === id); if (!s) return;
    if (db.scenes.length >= app.LIM.scenes) return toast('장면은 200개까지 저장할 수 있어요', 'warn');
    const now = new Date().toISOString(); db.scenes.push(Object.assign(app.clone(s), { id: U.uid('sc-'), name: uniqueName(s.name), builtin: false, createdAt: now, updatedAt: now }));
    app.saveDb(); renderScenes(); toast('장면을 복제했어요', 'success');
  }
  async function removeScene(id) {
    const s = db.scenes.find(x => x.id === id); if (!s) return;
    if (!await U.showModal({ title: '장면 삭제', body: `<p>'${escapeHtml(s.name)}' 장면을 삭제할까요?${s.builtin ? '<br><span class="muted">내장 장면은 샘플 복원으로 되살릴 수 있어요.</span>' : ''}</p>`, confirmText: '삭제', danger: true })) return;
    db.scenes = db.scenes.filter(x => x.id !== id); if (st.loadedSceneId === id) { st.loadedSceneId = null; app.renderMemo(); }
    app.saveDb(); renderScenes(); toast('장면을 삭제했어요', 'info');
  }

  // ---- 내보내기 / 가져오기 ----
  const exportData = ids => ({ app: 'fraction-kit', schema: 1, exportedAt: new Date().toISOString(), scenes: ids ? db.scenes.filter(s => ids.includes(s.id)) : db.scenes, cards: ids ? [] : db.cards, cardSets: ids ? [] : db.cardSets });
  function exportJson(ids) {
    if (ids && !ids.length) return toast('내보낼 장면을 체크하세요', 'warn');
    const d = new Date(), name = `fraction-kit-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    U.download(name, JSON.stringify(exportData(ids), null, 2)); toast(`${name} 내려받기 시작`, 'success');
  }
  const TYPES = ['make', 'compare', 'split', 'add', 'sub', 'convert', 'decimal', 'line'];
  const ID_RE = /^[A-Za-z0-9_-]{1,40}$/; // 가져온 id는 안전한 문자만 허용(innerHTML 속성에 들어가므로)
  const frOk = (fr, dMin, dMax) => F.valid(fr, dMin, dMax);
  // 가져오기 본체: 모든 검증 후 원자적 병합. 결과 {scenes, cards, sets, skipped:[사유]}
  function importText(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { toast('JSON 형식이 아닙니다', 'error'); return null; }
    if (!obj || obj.app !== 'fraction-kit') { toast('분수교구함 파일이 아닙니다', 'error'); return null; }
    if (obj.schema > 1) toast('새 버전 파일이에요. 가능한 항목만 가져옵니다', 'warn');
    const skipped = [], newScenes = [], newCards = [], newSets = [], idMap = {}, usedIds = new Set([...db.scenes, ...db.cards, ...db.cardSets].map(x => x.id));
    const freshId = p => { let id; do { id = U.uid(p); } while (usedIds.has(id)); usedIds.add(id); return id; };
    const safeId = (v, p) => (typeof v === 'string' && ID_RE.test(v) ? v : freshId(p)); // 형식이 어긋난 id는 새 id로 교체
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    (Array.isArray(obj.scenes) ? obj.scenes : []).forEach((s, i) => {
      const label = `장면 ${i + 1}${s && s.name ? ` '${cut(s.name, 20)}'` : ''}`;
      if (!s || typeof s.name !== 'string' || !s.state || !['kit', 'compare', 'arith'].includes(s.state.tab)) return skipped.push(`${label}: 형식 오류`);
      const k = s.state.kit, c = s.state.compare, a = s.state.arith;
      if (k && !frOk(k, 1, 24)) return skipped.push(`${label}: 교구판 분수 범위 오류`);
      if (c && !(frOk(c.a, 2, 12) && frOk(c.b, 2, 12))) return skipped.push(`${label}: 비교 분수 범위 오류`);
      if (a && !(frOk(a.a, 2, 12) && frOk(a.b, 2, 12))) return skipped.push(`${label}: 연산 분수 범위 오류`);
      const now = new Date().toISOString();
      // builtin 플래그는 내장 id일 때만 인정하고, 새 id를 받는 사본은 사용자 항목으로 취급(샘플 복원 대상과 어긋나지 않게)
      const clean = { id: safeId(s.id, 'sc-'), name: cut(s.name, 40), grade: [3, 4, 5, 6].includes(s.grade) ? s.grade : null, unit: cut(s.unit, 30), memo: cut(s.memo, 300), builtin: !!s.builtin && D.scenes.some(x => x.id === s.id), createdAt: s.createdAt || now, updatedAt: s.updatedAt || now, state: app.sanitizeState(s.state) };
      const ex = db.scenes.find(x => x.id === clean.id);
      if (ex) { if (same(ex, clean) || same(ex, s)) return skipped.push(`${label}: 동일한 장면이 이미 있음`); clean.id = freshId('sc-'); clean.builtin = false; }
      else if (newScenes.some(x => x.id === clean.id)) { clean.id = freshId('sc-'); clean.builtin = false; }
      newScenes.push(clean);
    });
    (Array.isArray(obj.cards) ? obj.cards : []).forEach((c, i) => {
      const label = `카드 ${i + 1}${c && c.question ? ` '${cut(c.question, 16)}…'` : ''}`;
      if (!c || !TYPES.includes(c.type) || typeof c.question !== 'string' || !Array.isArray(c.choices) || c.choices.length < 2 || c.choices.length > 4 || c.choices.some(x => typeof x !== 'string')) return skipped.push(`${label}: 형식 오류`);
      if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= c.choices.length) return skipped.push(`${label}: 정답 인덱스 오류`);
      const su = c.setup || {}, kitType = ['make', 'split', 'convert', 'decimal', 'line'].includes(c.type);
      if (!frOk(su.a, kitType ? 1 : 2, kitType ? 24 : 12) || (su.b && !frOk(su.b, 2, 12))) return skipped.push(`${label}: 분수 범위 오류`);
      const clean = { id: safeId(c.id, 'cd-'), grade: [3, 4, 5].includes(c.grade) ? c.grade : 5, unit: cut(c.unit, 30), type: c.type, question: cut(c.question, 120), choices: c.choices.map(x => cut(x, 30)), answer: c.answer, setup: { a: { n: su.a.n, d: su.a.d }, b: su.b ? { n: su.b.n, d: su.b.d } : null, op: c.type === 'add' ? '+' : c.type === 'sub' ? '-' : null, model: ['bar', 'circle', 'line'].includes(su.model) ? su.model : 'bar', lineRange: [1, 2, 3].includes(su.lineRange) ? su.lineRange : 1 }, explanation: cut(c.explanation, 300), builtin: !!c.builtin && D.cards.some(x => x.id === c.id), order: Number.isInteger(c.order) ? c.order : 999 };
      if (typeof c.id === 'string' && clean.id !== c.id) idMap[c.id] = clean.id; // 교체된 id는 세트의 cardIds 치환용으로 기록
      const ex = db.cards.find(x => x.id === clean.id);
      if (ex) { if (same(ex, clean) || same(ex, c)) return skipped.push(`${label}: 동일한 카드가 이미 있음`); const nid = freshId('cd-'); idMap[c.id] = nid; clean.id = nid; clean.builtin = false; }
      else if (newCards.some(x => x.id === clean.id)) { const nid = freshId('cd-'); idMap[c.id] = nid; clean.id = nid; clean.builtin = false; }
      newCards.push(clean);
    });
    (Array.isArray(obj.cardSets) ? obj.cardSets : []).forEach((s, i) => {
      const label = `세트 ${i + 1}${s && s.name ? ` '${cut(s.name, 20)}'` : ''}`;
      if (!s || typeof s.name !== 'string' || !Array.isArray(s.cardIds)) return skipped.push(`${label}: 형식 오류`);
      const ids = s.cardIds.map(id => idMap[id] || id).filter(id => db.cards.some(c => c.id === id) || newCards.some(c => c.id === id));
      if (!ids.length) return skipped.push(`${label}: 포함된 카드가 없음`);
      const clean = { id: safeId(s.id, 'cs-'), name: cut(s.name, 40), cardIds: ids, builtin: !!s.builtin && D.cardSets.some(x => x.id === s.id), createdAt: s.createdAt || new Date().toISOString() };
      const ex = db.cardSets.find(x => x.id === clean.id);
      if (ex) { if (same(ex, clean) || same(ex, s)) return skipped.push(`${label}: 동일한 세트가 이미 있음`); clean.id = freshId('cs-'); clean.builtin = false; }
      else if (newSets.some(x => x.id === clean.id)) { clean.id = freshId('cs-'); clean.builtin = false; }
      newSets.push(clean);
    });
    if (db.scenes.length + newScenes.length > app.LIM.scenes) { toast(`장면이 200개를 넘어 가져올 수 없어요 (현재 ${db.scenes.length}개)`, 'error', 3500); return null; }
    db.scenes.push(...newScenes); db.cards.push(...newCards); db.cardSets.push(...newSets); app.saveDb();
    const res = { scenes: newScenes.length, cards: newCards.length, sets: newSets.length, skipped };
    toast(`장면 ${res.scenes}개, 카드 ${res.cards}개, 세트 ${res.sets}개 가져옴 (${skipped.length}개 건너뜀)`, 'success', 3500);
    if (skipped.length) U.openDialog({ title: '가져오기 결과', size: 'wide', buttons: [{ text: '닫기', value: true, primary: true }], body: `<p>장면 ${res.scenes}개, 카드 ${res.cards}개, 세트 ${res.sets}개를 가져왔어요.</p><details><summary>건너뛴 항목 ${skipped.length}개 (사유 보기)</summary><ul class="skip-list">${skipped.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></details>` });
    if (st.tab === 'scenes') renderScenes(); if (FK.cards && st.tab === 'cards') FK.cards.render(); if (FK.sheet && st.tab === 'sheet') FK.sheet.render();
    return res;
  }
  function importFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('5MB 이하의 파일만 가져올 수 있어요', 'error');
    const rd = new FileReader(); rd.onload = () => importText(String(rd.result)); rd.onerror = () => toast('파일을 읽지 못했어요', 'error'); rd.readAsText(file);
  }
  // 샘플 복원: 내장 항목만 다시 주입, 사용자 항목 유지
  async function restoreSamples(skipConfirm) {
    if (!skipConfirm && !await U.showModal({ title: '샘플 복원', body: '<p>내장 장면 12개·탐구 카드 24장·세트 2개를 원본으로 되살려요. 직접 만든 장면·카드는 그대로 유지됩니다.</p>', confirmText: '복원' })) return;
    const upsert = (arr, items) => { items.forEach(it => { const i = arr.findIndex(x => x.id === it.id); if (i >= 0) arr[i] = app.clone(it); else arr.push(app.clone(it)); }); };
    upsert(db.scenes, D.scenes); upsert(db.cards, D.cards); upsert(db.cardSets, D.cardSets);
    Object.keys(D.tally).forEach(k => { if (!db.tally[k]) db.tally[k] = app.clone(D.tally[k]); });
    app.saveDb(); toast('샘플 데이터를 복원했어요', 'success'); app.renderTab();
  }

  function initScenes() {
    $('#scene-search').addEventListener('input', e => { sc.search = e.target.value.trim(); renderScenes(); });
    $('#scene-grade').addEventListener('change', e => { sc.grade = e.target.value; renderScenes(); });
    $('#scene-grid').addEventListener('click', e => { const b = e.target.closest('[data-sc]'); if (!b) return; ({ load, rename, dup: duplicate, del: removeScene })[b.dataset.sc](b.dataset.id); });
    const dz = $('#dropzone');
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => importFile(e.dataTransfer.files[0]));
    dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#import-file').click(); } });
    $('#import-file').addEventListener('change', e => { importFile(e.target.files[0]); e.target.value = ''; });
    document.addEventListener('dragover', e => e.preventDefault()); document.addEventListener('drop', e => e.preventDefault());
    Object.assign(FK.actions, { 'save-scene': saveSceneDialog, export: () => exportJson(null), 'export-selected': () => exportJson($$('[data-scene-check]:checked').map(c => c.dataset.sceneCheck)), 'reset-samples': () => restoreSamples(false) });
  }
  FK.scenes = { init: initScenes, render: renderScenes, saveScene, load, importText, exportData, restoreSamples };

  // ---- 활동지 ----
  const ws = () => st.worksheet;
  const TYPE_TXT = { color: '색칠하기', write: '분수 쓰기', line: '수직선 표시', compare: '크기 비교', arith: '덧셈·뺄셈' };
  const CARD_MAP = { make: 'color', compare: 'compare', split: 'write', convert: 'write', decimal: 'write', add: 'arith', sub: 'arith', line: 'line' };
  const qa = { a: { n: 3, d: 8 }, b: { n: 1, d: 4 } };
  function itemFromCard(c) { const t = CARD_MAP[c.type]; return { id: U.uid('wi-'), type: t, a: { ...c.setup.a }, b: ['compare', 'arith'].includes(t) ? { ...(c.setup.b || c.setup.a) } : null, op: t === 'arith' ? (c.type === 'sub' ? '-' : '+') : null, model: c.setup.model === 'circle' ? 'circle' : 'bar', lineRange: Math.min(2, c.setup.lineRange || 1), sourceId: c.id }; }
  function itemFromScene(s) {
    const x = s.state;
    if (x.tab === 'compare') return { id: U.uid('wi-'), type: 'compare', a: { ...x.compare.a }, b: { ...x.compare.b }, op: null, model: 'bar', lineRange: 1, sourceId: s.id };
    if (x.tab === 'arith') return { id: U.uid('wi-'), type: 'arith', a: { ...x.arith.a }, b: { ...x.arith.b }, op: x.arith.op, model: 'bar', lineRange: 1, sourceId: s.id };
    return { id: U.uid('wi-'), type: 'color', a: { n: x.kit.n, d: x.kit.d }, b: null, op: null, model: 'bar', lineRange: 1, sourceId: s.id };
  }
  function toggleSource(kind, id, on) {
    const items = ws().items, has = items.some(i => i.sourceId === id);
    if (on && !has) { const src = kind === 'card' ? db.cards.find(c => c.id === id) : db.scenes.find(s => s.id === id); if (src) items.push(kind === 'card' ? itemFromCard(src) : itemFromScene(src)); }
    else if (!on && has) ws().items = items.filter(i => i.sourceId !== id);
    app.persist(); renderSheet();
  }
  function shuffle() { const a = ws().items; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } app.persist(); renderSheet(); }
  // 문항 정답 문자열
  function answerOf(it) {
    const a = it.a, extra = fr => { const parts = [F.str(fr.n, fr.d)]; if (fr.n >= fr.d && fr.d > 1) parts.push('= ' + F.mixedStr(fr.n, fr.d)); const r = F.reduce(fr.n, fr.d); if (fr.n > 0 && r.d !== fr.d) parts.push('= ' + F.str(r.n, r.d)); return parts.join(' '); };
    if (it.type === 'color') return `${F.str(a.n, a.d)} (${a.d}칸 중 ${a.n}칸)`;
    if (it.type === 'write') { const dec = F.toDecimal(a.n, a.d); return `${extra(a)} ${dec.startsWith('≈') ? '≈ ' + dec.slice(1) : '= ' + dec}`; } // '= ≈0.667' 겹침 방지
    if (it.type === 'line') return `${F.str(a.n, a.d)} 위치 (0에서 ${a.n}칸, 소수 ${F.toDecimal(a.n, a.d)})`;
    const x = app.Compare.calc({ a: it.a, b: it.b });
    if (it.type === 'compare') return `${F.str(a.n, a.d)} ${x.sign > 0 ? '>' : x.sign < 0 ? '<' : '='} ${F.str(it.b.n, it.b.d)}  (${F.str(x.A.n, x.L)} vs ${F.str(x.B.n, x.L)})`;
    const y = app.Arith.calc({ a: it.a, b: it.b, op: it.op }); if (y.N < 0) return '앞의 분수가 더 작아 뺄 수 없음';
    return extra({ n: y.N, d: y.L });
  }
  // 분리된 SVG 생성 → 문자열
  const svgStr = (fn, cls) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ws-svg ' + (cls || '')); fn(s); return s.outerHTML; };
  function itemHtml(it, i, opt) {
    const a = it.a, bw = opt.bwPattern, model = it.model === 'circle' || (opt.model === 'circle' && it.type !== 'line');
    const shape = (fr, o) => model && fr.d <= 12 ? svgStr(s => R.circle(s, Object.assign({ n: fr.n, d: fr.d, units: R.unitsFor(fr.n, fr.d, 'auto'), fill: 'a', bw }, o)), 'circ') : svgStr(s => R.bar(s, Object.assign({ n: fr.n, d: fr.d, units: R.unitsFor(fr.n, fr.d, 'auto'), fill: 'a', bw, labels: false, height: 180 }, o))); // 2열 폭(약 75mm)에서 13mm 안팎의 색칠 가능한 높이
    let prompt = '', fig = '';
    if (it.type === 'color') { prompt = `${F.inline(F.str(a.n, a.d))}만큼 색칠하세요.`; fig = shape(a, { outline: true }); }
    else if (it.type === 'write') { prompt = '색칠한 부분을 분수로 쓰세요.'; fig = shape(a, {}) + '<div class="ws-blank">답: <span class="line"></span></div>'; }
    else if (it.type === 'line') { prompt = `${F.inline(F.str(a.n, a.d))}을(를) 수직선에 ↑로 표시하세요.`; fig = svgStr(s => R.line(s, { d: a.d, range: Math.max(it.lineRange || 1, Math.ceil(a.n / a.d) || 1), points: [], labels: false })); }
    else if (it.type === 'compare') { prompt = `두 분수를 색칠하고 ○ 안에 &gt;, &lt;, =를 쓰세요. <span class="ws-eq">${F.inline(F.str(a.n, a.d))} ○ ${F.inline(F.str(it.b.n, it.b.d))}</span>`; fig = shape(a, { outline: true }) + shape(it.b, { outline: true }); }
    else { prompt = `<span class="ws-eq">${F.inline(F.str(a.n, a.d))} ${it.op === '-' ? '−' : '+'} ${F.inline(F.str(it.b.n, it.b.d))} = </span>`; fig = shape(a, { outline: true }) + shape(it.b, { outline: true }) + '<div class="ws-blank">답: <span class="line"></span></div>'; }
    return `<div class="ws-item"><div class="ws-num">${i + 1}</div><div class="ws-body"><p class="ws-prompt">${prompt}</p><div class="ws-fig ${model ? 'circ' : ''}">${fig}</div></div></div>`;
  }
  function sheetHtml() {
    const w = ws(), items = w.items, pages = [];
    for (let i = 0; i < items.length; i += 6) pages.push(items.slice(i, i + 6));
    const head = p => `<header class="ws-head"><h1>${escapeHtml(w.title || '분수 활동지')}</h1>${w.showBlanks ? `<div class="ws-blanks"><span>학교: <i></i></span><span>학년: <i class="s"></i></span><span>반: <i class="s"></i></span><span>이름: <i></i></span></div>` : ''}<span class="ws-page">${p}</span></header>`;
    let html = pages.map((pg, pi) => `<section class="a4">${head(`${pi + 1} / ${pages.length + (w.withAnswers ? 1 : 0)}`)}<div class="ws-grid">${pg.map((it, j) => itemHtml(it, pi * 6 + j, w)).join('')}</div></section>`).join('');
    if (w.withAnswers && items.length) html += `<section class="a4 answers">${head('정답')}<h2>정답지</h2><ol class="ws-answers">${items.map(it => `<li><span class="muted">${TYPE_TXT[it.type]}</span> ${escapeHtml(answerOf(it))}</li>`).join('')}</ol></section>`;
    return html;
  }
  // 인쇄 루트: 문항이 없으면 빈 종이 대신 안내 한 줄(Ctrl+P 대비)
  function renderPrint() { $('#print-root').innerHTML = ws().items.length ? sheetHtml() : '<p class="print-empty">활동지 문항이 없어요. 활동지 탭에서 문항을 추가한 뒤 인쇄하세요</p>'; $('#print-root').classList.toggle('bw', !!ws().bwPattern); }
  function renderSheet() {
    const w = ws(), used = new Set(w.items.map(i => i.sourceId));
    $('#sheet-cards').innerHTML = [...db.cards].sort((a, b) => a.order - b.order).map(c => `<li><label><input type="checkbox" data-src="card" data-id="${escapeHtml(c.id)}" ${used.has(c.id) ? 'checked' : ''}> <span class="badge soft">${c.grade}</span> ${escapeHtml(c.question)}</label></li>`).join('') || '<li class="muted">카드 없음</li>';
    $('#sheet-scenes').innerHTML = db.scenes.map(s => `<li><label><input type="checkbox" data-src="scene" data-id="${escapeHtml(s.id)}" ${used.has(s.id) ? 'checked' : ''}> ${escapeHtml(s.name)}</label></li>`).join('') || '<li class="muted">장면 없음</li>';
    $('#sheet-items').innerHTML = w.items.map((it, i) => `<li><span class="badge soft">${TYPE_TXT[it.type]}</span><span class="ws-item-fr">${F.str(it.a.n, it.a.d)}${it.b ? ` ${it.type === 'arith' ? (it.op === '-' ? '−' : '+') : 'vs'} ${F.str(it.b.n, it.b.d)}` : ''}</span><span class="card-ops"><button type="button" data-wmove="-1" data-i="${i}" aria-label="위로" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-wmove="1" data-i="${i}" aria-label="아래로" ${i === w.items.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-wdel="${i}" aria-label="삭제">×</button></span></li>`).join('') || '<li class="muted">문항이 없어요</li>';
    $('#sheet-count').textContent = w.items.length ? `${w.items.length}문항 · ${Math.ceil(w.items.length / 6)}쪽` : '';
    $('#ws-title').value = w.title; $('#ws-blanks').checked = !!w.showBlanks; $('#ws-answers').checked = !!w.withAnswers; $('#ws-bw').checked = !!w.bwPattern; $('#ws-model').value = w.model;
    const t = $('#qa-type').value; $('#qa-b-btn').hidden = !['compare', 'arith'].includes(t); $('#qa-op').hidden = t !== 'arith'; $('#qa-a').textContent = F.str(qa.a.n, qa.a.d); $('#qa-b').textContent = F.str(qa.b.n, qa.b.d);
    $('#btn-print').disabled = !w.items.length; $('#print-hint').textContent = w.items.length ? 'A4 세로 · 쪽당 6문항' : '문항을 추가하면 인쇄할 수 있어요';
    $('#sheet-empty').hidden = !!w.items.length; // 빈 상태 안내는 축소(zoom)된 미리보기 밖에 표시
    $('#sheet-preview').innerHTML = sheetHtml(); $('#sheet-preview').classList.toggle('bw', !!w.bwPattern); renderPrint();
  }
  function initSheet() {
    const pane = $('.sheet-pane');
    pane.addEventListener('change', e => {
      const t = e.target; const w = ws();
      if (t.dataset.src) return toggleSource(t.dataset.src, t.dataset.id, t.checked);
      if (t.id === 'ws-blanks') w.showBlanks = t.checked; else if (t.id === 'ws-answers') w.withAnswers = t.checked; else if (t.id === 'ws-bw') w.bwPattern = t.checked; else if (t.id === 'ws-model') w.model = t.value; else if (t.id === 'qa-type') { /* 표시만 */ } else return;
      app.persist(); renderSheet();
    });
    $('#ws-title').addEventListener('input', U.debounce(e => { ws().title = e.target.value.slice(0, 40); app.persist(); $('#sheet-preview').innerHTML = sheetHtml(); renderPrint(); }, 200));
    $('#sheet-items').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const a = ws().items;
      if (b.dataset.wdel != null) a.splice(+b.dataset.wdel, 1); else if (b.dataset.wmove) { const i = +b.dataset.i, j = i + +b.dataset.wmove; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; }
      app.persist(); renderSheet();
    });
    Object.assign(FK.actions, {
      'sheet-shuffle': () => { if (ws().items.length < 2) return toast('문항이 2개 이상일 때 섞을 수 있어요', 'info'); shuffle(); toast('문항 순서를 섞었어요', 'info', 1500); },
      'sheet-clear': async () => { if (!ws().items.length) return; if (await U.showModal({ title: '모두 지우기', body: '<p>활동지 문항을 모두 지울까요?</p>', confirmText: '지우기', danger: true })) { ws().items = []; app.persist(); renderSheet(); } },
      'qa-a': async () => { const fr = await U.keypad({ value: qa.a, dMin: 1, dMax: 12, title: '분수 A' }); if (fr) { qa.a = fr; renderSheet(); } },
      'qa-b': async () => { const fr = await U.keypad({ value: qa.b, title: '분수 B' }); if (fr) { qa.b = fr; renderSheet(); } },
      'qa-add': () => {
        const t = $('#qa-type').value, needB = ['compare', 'arith'].includes(t);
        if (needB && (qa.a.d < 2 || qa.b.d < 2)) return toast('비교·연산 문항의 분모는 2 이상이어야 해요', 'warn');
        if (t === 'arith' && $('#qa-op').value === '-' && F.compare(qa.a, qa.b) < 0) return toast('뺄셈은 앞의 분수가 더 커야 해요', 'warn');
        ws().items.push({ id: U.uid('wi-'), type: t, a: { ...qa.a }, b: needB ? { ...qa.b } : null, op: t === 'arith' ? $('#qa-op').value : null, model: ws().model, lineRange: qa.a.n > qa.a.d ? 2 : 1, sourceId: null });
        app.persist(); renderSheet(); toast('문항을 추가했어요', 'success', 1500);
      },
      print: () => { if (!ws().items.length) return toast('문항을 먼저 추가하세요', 'warn'); renderPrint(); window.print(); },
    });
    window.addEventListener('beforeprint', renderPrint);
  }
  FK.sheet = { init: initSheet, render: renderSheet, renderPrint, toggleSource, shuffle, answerOf };
  // 두 모듈 공통 초기화
  const initAll = () => { app = FK.app; st = app.state; db = app.db; initScenes(); initSheet(); };
  FK.scenes.init = initAll; FK.sheet.init = () => {};
})();
