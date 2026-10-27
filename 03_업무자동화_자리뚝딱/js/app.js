// app.js — 자리뚝딱 앱 로직: 상태·저장·렌더링·이벤트·드래그·발표 모드·인쇄·PNG·백업
// 상태(state) → render() 단방향. 이벤트는 data-action 위임.
'use strict';

(() => {
  const { storage, escapeHtml: esc, $, $$, todayStr, uid, debounce, showToast, showModal, makeDraggable, download, readFile, bindDropzone } = UI;
  const VERSION = APP_DATA.appVersion;
  const MAX_STUDENTS = 60, MAX_HISTORY = 30, MAX_UNDO = 50, MAX_LAYOUTS = 5;
  const GENDER_LABEL = { M: '남', F: '여', '': '미지정' };
  const PRESET_LABEL = Object.fromEntries(Object.entries(APP_DATA.presets).map(([k, v]) => [k, v.label]));

  // ── 상태 ──
  let state = null;                                   // Root(저장 대상)
  let ui = { tab: 'roster', zoom: 84, zoomManual: false, tourDone: false, soundOn: false, histFilter: 'all', groupOpts: null, present: { random: false } };
  const undo = { past: [], future: [] };              // 메모리 전용
  let storageOk = true, lastReport = null, tapSel = null, pendingRows = [], rendering = 0, fitOnShow = false, autoPrint = false;
  const ZOOM_MIN = 48, ZOOM_MAX = 120, ZOOM_STEP = 4, MOBILE_MQ = '(max-width: 600px)';
  const PRINT_CELL_MAX = 110, PRINT_GRID_W = 1000, PRINT_GRID_H = 600;   // 인쇄 미리보기 격자 기준 크기(px)
  const CELL_GAP_RATIO = 0.1;                                           // .seat-grid gap = --cell × 0.1 (style.css와 동일)
  // innerHTML 교체를 렌더 구간으로 표시(중첩 이벤트 차단용)
  const setHtml = (el, html) => { rendering++; try { el.innerHTML = html; } finally { rendering--; } };

  // ── 기본 Root 생성(빈 학급) / 샘플 로드 ──
  const defaultRoot = () => ({
    version: 1, updatedAt: new Date().toISOString(),
    classInfo: { school: '', grade: null, classNo: null, teacher: '', className: '우리 반' },
    students: [], pairs: [], layout: Engine.buildLayout('pair', { sections: 3, rows: 5 }, 'top', [], '수업형'), layouts: [],
    conditions: JSON.parse(JSON.stringify(APP_DATA.conditions)),
    current: { seats: {}, locked: [], unplaced: [] }, currentGroups: null, history: [], groupHistory: [],
    settings: JSON.parse(JSON.stringify(APP_DATA.settings)),
  });
  // 샘플 데이터 → Root (히스토리의 레이아웃 스냅샷·리포트를 엔진으로 채움)
  function sampleRoot() {
    const root = defaultRoot(); const d = APP_DATA;
    root.classInfo = { ...d.classInfo }; root.students = JSON.parse(JSON.stringify(d.students)); root.pairs = JSON.parse(JSON.stringify(d.pairs));
    root.layout = Engine.buildLayout(d.layoutSpec.preset, d.layoutSpec.params, d.layoutSpec.teacherSide, d.layoutSpec.off, d.layoutSpec.name);
    root.conditions = JSON.parse(JSON.stringify(d.conditions)); root.groupHistory = JSON.parse(JSON.stringify(d.groupHistory));
    const active = root.students.filter(s => s.active);
    root.history = d.history.map(h => {
      const layout = JSON.parse(JSON.stringify(root.layout));
      const ctx = Engine.prepare(layout, active, root.pairs, root.conditions, [], root.settings);
      const assign = ctx.desks.map(dk => h.seats[dk.key] || null);
      const rep = Engine.evaluate(ctx, assign, true);
      return { id: h.id, date: h.date, memo: h.memo, layoutSnapshot: layout, seats: { ...h.seats }, locked: [], conditionsSnapshot: JSON.parse(JSON.stringify(root.conditions)), report: { penalty: rep.penalty, items: rep.items } };
    });
    return root;
  }

  // ── 저장(300ms 디바운스) ──
  const setSaveStatus = (ok) => { const el = $('#save-status'); el.dataset.state = ok ? 'saved' : 'fail'; $('#save-text').textContent = ok ? '저장됨' : '저장 불가'; $('#storage-banner').hidden = ok; };
  const saveNow = () => { state.updatedAt = new Date().toISOString(); storageOk = storage.set('data', state); setSaveStatus(storageOk); ui.wiped = false; storage.set('ui', ui); };
  const save = debounce(saveNow, 300);
  const touch = () => { $('#save-status').dataset.state = 'pending'; $('#save-text').textContent = '저장 중'; save(); };

  // ── 파생 값 ──
  const activeStudents = () => state.students.filter(s => s.active).sort((a, b) => a.no - b.no);
  const byId = (id) => state.students.find(s => s.id === id);
  const nameOf = (id) => { const s = byId(id); return s ? s.name : '?'; };
  const deskCells = () => state.layout.cells.filter(c => c.desk);
  const cellKey = (c) => c.r + '-' + c.c;
  const placedIds = () => Object.values(state.current.seats);
  const classTitle = () => `${state.classInfo.school ? state.classInfo.school + ' ' : ''}${state.classInfo.className}`;
  const dupNames = () => { const cnt = {}; state.students.forEach(s => { cnt[s.name] = (cnt[s.name] || 0) + 1; }); return new Set(Object.keys(cnt).filter(n => cnt[n] > 1)); };
  const displayName = (s, dups) => (dups && dups.has(s.name) ? `${s.name}(${s.no})` : s.name);
  const violCount = (h) => ((h.report && h.report.items) || []).reduce((a, it) => a + (it.violations || []).length, 0);
  const sortedByDate = (arr) => Engine.latestFirst(arr);                 // 엔진의 최근 N건 집계와 같은 정렬 키
  // 격자 템플릿 → 트랙 배열(통로 calc 토큰을 쪼개지 않음). 회전·발표·인쇄·PNG 공용
  const tracks = (tpl) => Engine.tplTracks(tpl);
  const isGap = (t) => t.includes(String(Engine.GAP_RATIO));
  const trackUnits = (tpl, n) => tracks(tpl).reduce((a, t) => a + (isGap(t) ? Engine.GAP_RATIO : 1), 0) + (n - 1) * CELL_GAP_RATIO;   // 셀 단위 전체 폭
  // 방금 확정한 기록은 '최근 이력'에서 제외(자기 자신과 비교해 전원 위반으로 뜨는 문제 방지)
  const histForCtx = () => state.history.filter(h => h.id !== state.current.confirmedId);
  // 저장·가져온 Root 정리: 구버전 템플릿 토큰 정규화, 누락 배열 보정
  function normalizeRoot(root) {
    Engine.normalizeLayout(root.layout); (root.layouts || []).forEach(Engine.normalizeLayout);
    root.students.forEach(s => { s.tags = s.tags || []; });
    root.history.forEach(h => { Engine.normalizeLayout(h.layoutSnapshot); h.locked = h.locked || []; h.seats = h.seats || {}; });
    (root.groupHistory || []).forEach(g => { g.groups = g.groups || []; });
    return root;
  }

  // 현재 배치 정리: 꺼진 책상·비활성 학생 제거, 미배치 목록 재계산
  function syncCurrent() {
    const keys = new Set(deskCells().map(cellKey)); const act = new Set(activeStudents().map(s => s.id)); const seen = new Set();
    Object.entries(state.current.seats).forEach(([k, sid]) => { if (!keys.has(k) || !act.has(sid) || seen.has(sid)) delete state.current.seats[k]; else seen.add(sid); });
    state.current.locked = state.current.locked.filter(sid => seen.has(sid));
    state.current.unplaced = activeStudents().filter(s => !seen.has(s.id)).map(s => s.id);
  }
  // 배치 컨텍스트·리포트 계산
  function makeCtx(layout) { return Engine.prepare(layout || state.layout, activeStudents(), state.pairs, state.conditions, histForCtx(), state.settings); }
  function computeReport() {
    const ctx = makeCtx(); const assign = ctx.desks.map(d => state.current.seats[d.key] || null);
    const rep = Engine.evaluate(ctx, assign, true); rep.suggestions = Engine.suggest(ctx, rep, state.current.locked); rep.ctx = ctx;
    return rep;
  }

  // ── Undo/Redo ──
  const snapshot = () => JSON.stringify({ seats: state.current.seats, locked: state.current.locked });
  const pushUndo = () => { undo.past.push(snapshot()); if (undo.past.length > MAX_UNDO) undo.past.shift(); undo.future = []; };
  const resetUndo = () => { undo.past = []; undo.future = []; };
  const restore = (snap) => { const o = JSON.parse(snap); state.current.seats = o.seats; state.current.locked = o.locked; syncCurrent(); };
  function doUndo() { if (!undo.past.length) return showToast('되돌릴 작업이 없습니다', 'info'); undo.future.push(snapshot()); restore(undo.past.pop()); afterSeatChange(false); }
  function doRedo() { if (!undo.future.length) return showToast('다시 실행할 작업이 없습니다', 'info'); undo.past.push(snapshot()); restore(undo.future.pop()); afterSeatChange(false); }

  // 좌석 변경 후: 리포트 재계산, 새 위반 토스트, 렌더
  function afterSeatChange(toastNew) {
    const before = lastReport ? Object.values(lastReport.cellViolations).flat() : [];
    syncCurrent(); lastReport = computeReport();
    if (toastNew) { // 새로 생긴 위반만 토스트(분리·결합 쌍 위반을 우선, 최대 2건)
      const prio = r => (/분리 조건|결합 조건/.test(r) ? 0 : 1);
      const now = [...new Set(Object.values(lastReport.cellViolations).flat())];
      now.filter(r => !before.includes(r)).sort((a, b) => prio(a) - prio(b)).slice(0, 2).forEach(r => showToast(r, 'warn'));
    }
    renderSeats(); touch();
  }

  // ── 자동 배치 / 다시 섞기 ──
  function autoArrange() {
    const act = activeStudents(); const desks = deskCells();
    if (!act.length) return showToast('명렬 탭에서 학생을 추가하세요', 'warn');
    if (desks.length < act.length) return showToast(`책상 ${desks.length}개 < 학생 ${act.length}명: 레이아웃을 넓히세요`, 'error');
    state.current.confirmedId = null;                 // 새 배치는 확정된 모든 이력과 비교
    const ctx = makeCtx(); const fixed = {};
    ctx.desks.forEach((d, i) => { const sid = state.current.seats[d.key]; if (sid && state.current.locked.includes(sid)) fixed[i] = sid; });
    const free = act.map(s => s.id).filter(id => !Object.values(fixed).includes(id));
    const best = Engine.solve(ctx, fixed, free);
    pushUndo(); state.current.seats = {};
    best.assign.forEach((sid, i) => { if (sid) state.current.seats[ctx.desks[i].key] = sid; });
    afterSeatChange(false);
    showToast(lastReport.penalty === 0 ? '모든 조건을 충족하는 배치를 찾았습니다' : `배치 완료 — 위반 ${lastReport.items.reduce((a, it) => a + it.violations.length, 0)}건(패널티 ${Math.round(lastReport.penalty)})`, lastReport.penalty === 0 ? 'success' : 'warn');
  }
  // 두 좌석 교환(빈 책상이면 이동)
  function swapSeats(k1, k2) {
    if (k1 === k2) return; const s = state.current.seats; if (!s[k1] && !s[k2]) return;
    pushUndo(); const a = s[k1], b = s[k2];
    if (b) s[k1] = b; else delete s[k1]; if (a) s[k2] = a; else delete s[k2];
    afterSeatChange(true);
  }
  // 미배치 학생을 빈 책상에 배치
  function placeStudent(sid, key) {
    if (state.current.seats[key]) return showToast('빈 책상을 선택하세요', 'warn');
    pushUndo(); state.current.seats[key] = sid; afterSeatChange(true);
  }
  // 탭-탭 교환: 첫 탭 선택(하이라이트) → 같은 카드 재탭 해제 → 다른 카드 탭 교환. 미배치 칩 선택 중이면 빈 책상에 배치
  function seatTap(k) {
    if (tapSel && tapSel.startsWith('u:')) { if (!state.current.seats[k]) { const sid = tapSel.slice(2); tapSel = null; placeStudent(sid, k); } else showToast('빈 책상을 선택하세요', 'warn'); return; }
    if (!tapSel) { if (!state.current.seats[k]) return; tapSel = k; renderSeats(); }
    else if (tapSel === k) { tapSel = null; renderSeats(); }
    else { const from = tapSel; tapSel = null; swapSeats(from, k); }
  }
  function toggleLock(sid) { pushUndo(); const L = state.current.locked; const i = L.indexOf(sid); if (i >= 0) L.splice(i, 1); else L.push(sid); renderSeats(); touch(); }

  // 레이아웃 교체(현재 배치는 모두 미배치 목록으로 내려감, Undo 초기화)
  function setLayout(layout) {
    state.current.showUnplaced = placedIds().length > 0;   // 배치가 있었을 때만 미배치 목록 노출(초기 빈 상태에서는 숨김)
    state.layout = layout; state.current.seats = {}; state.current.locked = []; state.current.confirmedId = null; resetUndo(); tapSel = null;
    fitZoom(); afterSeatChange(false);
  }
  // 교탁 위치 전환: 격자는 유지하고 앞/뒤 판정·인쇄 반전 기준만 바뀜
  function setTeacherSide(side) { state.layout.teacherSide = side; lastReport = null; renderSeats(); touch(); }
  function rebuildLayout(changes) {
    const L = state.layout; const preset = changes.preset || L.preset; const params = { ...L.params, ...(changes.params || {}) };
    APP_DATA.presets[preset].fields.forEach(([f, , mn, mx]) => { params[f] = Math.max(mn, Math.min(mx, Number(params[f]) || mn)); });   // 프리셋별 범위로 수치 보정
    setLayout(Engine.buildLayout(preset, params, L.teacherSide, [], L.name));
  }
  // 좌석표 확대값을 컨테이너 폭에 맞춤(레이아웃 변경·'맞춤' 버튼·좁은 화면 전환). 호출 뒤에는 '자동 맞춤' 상태 — 슬라이더를 움직이면 그 값이 수동으로 유지됨
  function fitZoom() {
    ui.zoomManual = false;
    const wrap = $('#seatmap-wrap'); if (!wrap || !wrap.clientWidth) { fitOnShow = true; return; }   // 탭이 숨겨져 폭을 모르면 다음 표시 때 맞춤
    const avail = wrap.clientWidth - 2 * parseFloat(getComputedStyle(wrap).paddingLeft || 0) - 2;
    const z = Math.floor(avail / trackUnits(state.layout.colTpl, state.layout.cols) / ZOOM_STEP) * ZOOM_STEP;
    ui.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); fitOnShow = false; storage.set('ui', ui);
  }
  // 확대값만 화면에 반영(--cell·슬라이더). 패널을 다시 그리지 않으므로 리사이즈 중에도 입력 포커스를 잃지 않음
  const applyZoom = () => { $('#seatmap-wrap').style.setProperty('--cell', ui.zoom + 'px'); $('#zoom').value = ui.zoom; };
  function toggleDesk(key) {
    const cell = state.layout.cells.find(c => cellKey(c) === key); if (!cell || cell.gap) return;
    cell.desk = !cell.desk; resetUndo(); afterSeatChange(false);
  }

  // ── 배치 확정(모달: 날짜·메모) ──
  async function confirmArrangement() {
    if (!placedIds().length) return showToast('먼저 자동 배치를 실행하세요', 'warn');
    if (state.current.unplaced.length) return showToast(`미배치 학생 ${state.current.unplaced.length}명을 먼저 배치하세요`, 'warn');
    const body = `<label class="field">날짜<input type="date" id="m-date" value="${todayStr()}"></label><label class="field">메모<input type="text" id="m-memo" maxlength="30" placeholder="예: 5차, 2학기 2차"></label>`;
    let date = '', memo = '';
    const ok = await showModal({ title: '배치 확정', body, confirmText: '확정', validate: (m) => { date = $('#m-date', m).value; memo = $('#m-memo', m).value.trim(); if (!date) { showToast('날짜를 입력하세요', 'error'); return false; } } });
    if (!ok) return;
    if (!await ensureHistoryRoom(state.history, '배치')) return;
    const rep = computeReport(); const id = uid('h');
    state.history.push({ id, date, memo, createdAt: new Date().toISOString(), layoutSnapshot: JSON.parse(JSON.stringify(state.layout)), seats: { ...state.current.seats }, locked: state.current.locked.slice(), conditionsSnapshot: JSON.parse(JSON.stringify(state.conditions)), report: { penalty: rep.penalty, items: rep.items } });
    state.current.confirmedId = id; lastReport = null;   // 방금 확정한 기록은 이후 재계산에서 '최근 이력'으로 세지 않음
    touch(); showToast(`'${memo || date}' 배치를 히스토리에 저장했습니다`, 'success'); renderSeats(); renderHistory();
  }
  // 히스토리 30건 초과 시 가장 오래된 기록 삭제 안내
  async function ensureHistoryRoom(arr, label) {
    if (arr.length < MAX_HISTORY) return true;
    const oldest = sortedByDate(arr).pop();
    const ok = await showModal({ title: `${label} 기록 ${MAX_HISTORY}건 초과`, body: `가장 오래된 기록 <b>${esc(oldest.date)} ${esc(oldest.memo)}</b>을 삭제하고 저장할까요?`, confirmText: '삭제 후 저장', danger: true });
    if (ok) arr.splice(arr.indexOf(oldest), 1);
    return ok;
  }

  // ── 렌더링 ──
  function renderAll() { renderHeader(); renderRoster(); renderSeats(); renderGroups(); renderHistory(); renderSettings(); }
  function renderHeader() {
    $('#class-name-btn').textContent = classTitle();
    $$('#tabs [role=tab]').forEach(b => { const on = b.dataset.tab === ui.tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    $$('#app > section').forEach(s => { s.hidden = s.dataset.view !== ui.tab; });
    $('#theme-btn').textContent = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches) ? '☀️' : '🌙';
    const none = !activeStudents().length, noSeat = !placedIds().length;
    $('#btn-present').disabled = none || noSeat; $('#btn-present').title = noSeat ? '먼저 자동 배치를 실행하세요' : ''; $('#btn-print').disabled = none;
    const mg = $('#btn-make-groups'); if (mg) mg.disabled = none;   // 학생 수 변화를 모둠 '편성' 버튼에도 즉시 반영
  }
  // 탭 전환(탭별로 필요한 재렌더 포함)
  function setTab(t) {
    ui.tab = t; storage.set('ui', ui); renderHeader();
    if (t === 'history') renderHistory(); else if (t === 'seats') renderSeats(); else if (t === 'groups') renderGroups();
  }

  // 명렬 탭
  function renderRoster() {
    // 재렌더로 사라지는 포커스(표 안 입력)를 같은 행·필드로 복원
    const ae = document.activeElement, aTr = ae && ae.closest && ae.closest('#roster-table tr[data-id]'); const focusKey = aTr && ae.dataset.field ? [aTr.dataset.id, ae.dataset.field] : null;
    const nos = {}; state.students.forEach(s => { nos[s.no] = (nos[s.no] || 0) + 1; });
    const rows = state.students.slice().sort((a, b) => a.no - b.no).map(s => `<tr data-id="${s.id}" class="${s.active ? '' : 'is-inactive'}">
      <td class="num"><input type="number" data-field="no" value="${s.no}" min="1" max="99" aria-label="번호">${nos[s.no] > 1 ? '<span class="warn-ico" data-tip="중복 번호">⚠</span>' : ''}</td>
      <td><input type="text" data-field="name" value="${esc(s.name)}" maxlength="20" placeholder="이름" class="${s.name.trim() ? '' : 'is-invalid'}" aria-label="이름"></td>
      <td><select data-field="gender" aria-label="성별">${['', 'M', 'F'].map(g => `<option value="${g}" ${s.gender === g ? 'selected' : ''}>${GENDER_LABEL[g]}</option>`).join('')}</select></td>
      <td><select data-field="level" aria-label="학습수준"><option value="">-</option>${[1, 2, 3].map(l => `<option value="${l}" ${s.level === l ? 'selected' : ''}>${['하', '중', '상'][l - 1]}</option>`).join('')}</select></td>
      <td><div class="chips">${Object.entries(APP_DATA.tagLabels).map(([t, lb]) => `<button type="button" class="chip chip-btn tag-${t} ${s.tags.includes(t) ? 'is-on' : ''}" data-action="toggle-tag" data-tag="${t}">${lb}</button>`).join('')}</div></td>
      <td><label class="switch" title="${s.active ? '활성(배치 대상)' : '비활성(전출·장기결석)'}"><input type="checkbox" data-field="active" ${s.active ? 'checked' : ''} aria-label="활성"><i></i></label></td>
      <td><button type="button" class="icon-btn sm" data-action="del-student" aria-label="${esc(s.name)} 삭제">🗑</button></td></tr>`).join('');
    setHtml($('#roster-table'), state.students.length ? `<table class="tbl roster"><thead><tr><th>번호</th><th>이름</th><th>성별</th><th>수준</th><th>배려 태그</th><th>활성</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty">학생이 없습니다. "학생 추가" 또는 붙여넣기 등록으로 명렬을 만드세요.</div>');
    if (focusKey) { const el = $(`#roster-table tr[data-id="${focusKey[0]}"] [data-field="${focusKey[1]}"]`); if (el) el.focus({ preventScroll: true }); }
    renderPairs(); renderPastePreview();
  }
  // 요약 칩·쌍 선택 드롭다운·쌍 목록(이름 변경 시 표 전체 대신 이 부분만 갱신)
  function renderPairs() {
    const act = activeStudents(); const m = act.filter(s => s.gender === 'M').length, f = act.filter(s => s.gender === 'F').length;
    const tagCnt = Object.keys(APP_DATA.tagLabels).map(t => `<span class="chip">${APP_DATA.tagLabels[t]} ${act.filter(s => s.tags.includes(t)).length}</span>`).join('');
    $('#roster-summary').innerHTML = `<span class="chip chip-accent">활성 ${act.length}명 (남 ${m}·여 ${f})</span>${tagCnt}<span class="chip">비활성 ${state.students.length - act.length}명</span>`;
    const opts = act.map(s => `<option value="${s.id}">${s.no}. ${esc(s.name)}</option>`).join('');
    const a = $('#pair-a'), b = $('#pair-b'); const pa = a.value, pb = b.value; a.innerHTML = opts; b.innerHTML = opts;
    a.value = pa; if (!a.value) a.value = act[0] ? act[0].id : ''; b.value = pb; if (!b.value) b.value = act[1] ? act[1].id : '';   // 선택값이 사라지면(비활성 등) 첫 옵션으로 폴백
    $('#pair-list').innerHTML = state.pairs.length ? state.pairs.map(p => { const sa = byId(p.a), sb = byId(p.b); const off = !sa || !sb || !sa.active || !sb.active; return `<div class="pair-item ${off ? 'is-off' : ''}" data-pid="${p.id}"><span class="pair-type ${p.type}">${p.type === 'apart' ? '↔ 분리' : '🔗 결합'}</span><b>${esc(nameOf(p.a))}</b> · <b>${esc(nameOf(p.b))}</b>${p.memo ? `<small>${esc(p.memo)}</small>` : ''}${off ? '<small>(비활성 포함 — 계산 제외)</small>' : ''}<span class="grow"></span><div class="seg"><button type="button" class="${p.hard ? 'is-on' : ''}" data-action="pair-hard" data-v="1">반드시</button><button type="button" class="${p.hard ? '' : 'is-on'}" data-action="pair-hard" data-v="0">가능하면</button></div><button type="button" class="icon-btn sm" data-action="del-pair" aria-label="쌍 삭제">🗑</button></div>`; }).join('') : '<div class="empty">등록된 쌍이 없습니다.</div>';
  }
  function renderPastePreview() {
    const box = $('#paste-preview'); if (!pendingRows.length) { box.innerHTML = ''; return; }
    const okN = pendingRows.filter(r => r.status !== 'error').length;
    box.innerHTML = `<div class="table-wrap"><table class="tbl sm"><thead><tr><th>줄</th><th>번호</th><th>이름</th><th>성별</th><th>상태</th></tr></thead><tbody>${pendingRows.map(r => `<tr class="st-${r.status}"><td>${r.line}</td><td>${r.no == null ? '' : r.no}</td><td>${esc(r.name || r.raw)}</td><td>${GENDER_LABEL[r.gender || ''] || ''}</td><td>${esc(r.msg)}</td></tr>`).join('')}</tbody></table></div>
      <div class="row between"><span class="hint">정상 ${pendingRows.filter(r => r.status === 'ok').length} · 경고 ${pendingRows.filter(r => r.status === 'warn').length} · 오류 ${pendingRows.filter(r => r.status === 'error').length}(제외)</span><button type="button" class="btn btn-accent" data-action="add-parsed" ${okN ? '' : 'disabled'}>＋ ${okN}명 추가</button></div>`;
  }

  // 자리 배치 탭(패널·좌석표·리포트)
  function renderSeats() {
    syncCurrent(); if (!lastReport) lastReport = computeReport();
    if (fitOnShow && $('#seatmap-wrap').clientWidth) fitZoom();          // 모바일 첫 표시: 좌석표가 폭에 맞게 보이도록
    const L = state.layout, act = activeStudents(), desks = deskCells();
    const ae = document.activeElement, focusSid = ae && ae.closest && ae.closest('#seatmap') ? ae.dataset.sid : null;   // 재렌더 후 포커스 복원용
    const short = desks.length < act.length;
    $('#desk-counter').innerHTML = `<span class="${short ? 'is-short' : ''}">책상 ${desks.length} / 학생 ${act.length}</span>`;
    $('#desk-counter').title = short ? '책상이 부족합니다' : '';
    // 교실 패널
    const P = APP_DATA.presets[L.preset];
    setHtml($('#layout-panel'), `
      <div class="row wrap"><select id="layout-select" aria-label="저장된 레이아웃"><option value="">현재 레이아웃${L.name ? ' (' + esc(L.name) + ')' : ''}</option>${state.layouts.map(l => `<option value="${l.id}">${esc(l.name)} · ${PRESET_LABEL[l.preset]}</option>`).join('')}</select><button type="button" class="btn sm" data-action="save-layout" title="현재 레이아웃을 이름으로 저장(최대 5개)">저장</button><button type="button" class="btn sm btn-ghost" data-action="del-layout" ${state.layouts.length ? '' : 'disabled'}>삭제</button></div>
      <div class="stack-sm">${Object.entries(APP_DATA.presets).map(([k, p]) => `<label class="radio"><input type="radio" name="preset" value="${k}" ${L.preset === k ? 'checked' : ''}> ${p.label}</label>`).join('')}</div>
      <div class="row wrap">${P.fields.map(([f, lb, mn, mx]) => `<label class="field inline">${lb}<input type="number" data-param="${f}" min="${mn}" max="${mx}" value="${L.params[f]}"></label>`).join('')}</div>
      <div class="row wrap"><span class="lbl">교탁 위치</span><div class="seg"><button type="button" class="${L.teacherSide === 'top' ? 'is-on' : ''}" data-action="teacher-side" data-v="top">위</button><button type="button" class="${L.teacherSide === 'bottom' ? 'is-on' : ''}" data-action="teacher-side" data-v="bottom">아래</button></div></div>
      <label class="check"><input type="checkbox" id="edit-mode" ${ui.editMode ? 'checked' : ''}> 편집 모드 <small>셀을 클릭해 책상 켜기/끄기</small></label>`);
    // 조건 패널
    const C = state.conditions; const pairOnly = L.preset !== 'pair';
    // 조건 행: 체크박스 + (라벨/설명 세로 묶음) + 하드/소프트 세그먼트(아래 줄 오른쪽) — 라벨이 글자 중간에서 끊기지 않게
    const ck = (inputHtml, lb, sub) => `<label class="check cond-check">${inputHtml}<span class="ck-text"><span>${lb}</span><small>${sub}</small></span></label>`;
    const condRow = (k, lb, sub, dis) => `<div class="cond ${dis ? 'is-dis' : ''}">${ck(`<input type="checkbox" data-cond="${k}" ${C[k].on ? 'checked' : ''} ${dis ? 'disabled' : ''}>`, lb, sub)}<div class="seg"><button type="button" class="${C[k].hard ? 'is-on' : ''}" data-action="cond-hard" data-cond="${k}" data-v="1" ${dis ? 'disabled' : ''}>하드</button><button type="button" class="${C[k].hard ? '' : 'is-on'}" data-action="cond-hard" data-cond="${k}" data-v="0" ${dis ? 'disabled' : ''}>소프트</button></div></div>`;
    setHtml($('#cond-panel'), condRow('front', '앞자리 배려', '태그 학생을 앞 1/3 구역') + condRow('focus', '집중 지원 교탁 근접', '앞 2줄') + condRow('tall', '키 큼 뒤쪽', '앞 구역 제외') + condRow('genderPair', '남녀 짝', pairOnly ? '2인 짝 레이아웃에서만' : '같은 성별 짝 회피', pairOnly)
      + `<div class="cond">${ck(`<input type="checkbox" data-cond="pairs" ${C.pairs.on ? 'checked' : ''}>`, '분리·결합 쌍 반영', '쌍별 반드시/가능하면 적용')}</div>
      <div class="cond">${ck(`<input type="checkbox" id="avoid-partner" ${C.avoidPartnerN > 0 ? 'checked' : ''}>`, `최근 <input type="number" id="avoid-n" min="1" max="5" value="${C.avoidPartnerN || C.avoidPartnerPref || state.settings.avoidN}" aria-label="회피 횟수">회 같은 짝 회피`, '소프트')}</div>
      <div class="cond">${ck(`<input type="checkbox" id="avoid-seat" ${C.avoidSeat ? 'checked' : ''}>`, '같은 좌석 회피', `소프트 · 최근 ${state.settings.avoidN}회(설정)`)}</div>`);
    // 버튼 상태
    const none = !act.length; const noSeat = !placedIds().length;
    $('#btn-auto').disabled = none || short; $('#btn-auto').title = short ? '책상 수가 활성 학생 수보다 적습니다' : (none ? '학생이 없습니다' : '');
    $('#btn-shuffle').disabled = none || short || noSeat; $('#btn-confirm').disabled = noSeat || state.current.unplaced.length > 0; $('#btn-png').disabled = noSeat;
    $('#btn-undo').disabled = !undo.past.length; $('#btn-redo').disabled = !undo.future.length;
    $('#btn-present').disabled = none || noSeat; $('#btn-print').disabled = none;
    // 좌석표
    const wrap = $('#seatmap-wrap'); wrap.style.setProperty('--cell', ui.zoom + 'px'); $('#zoom').value = ui.zoom; wrap.classList.toggle('edit-mode', !!ui.editMode);
    $('#seatmap').innerHTML = none ? '<div class="empty big">명렬 탭에서 학생을 추가하세요.<br><small>샘플 데이터는 설정 탭에서 다시 불러올 수 있습니다.</small></div>' : seatGridHtml(L, state.current.seats, { violations: lastReport.cellViolations, locked: state.current.locked, edit: ui.editMode, tapSel });
    // 범례(격자보다 넓어지지 않도록 #seatmap 바깥에 둠)
    $('#seat-legend').hidden = none;
    $('#seat-legend').innerHTML = `<span>교탁: ${L.teacherSide === 'top' ? '위(칠판 쪽)' : '아래'}</span><i class="zone-swatch"></i>앞 구역 <i class="dot tag-front"></i>앞자리 필요 <i class="dot tag-focus"></i>집중 지원 <i class="dot tag-tall"></i>키 큼 <span>🔒 고정</span>${ui.editMode ? '<b class="edit-note">편집 모드: 책상을 눌러 켜고 끕니다(학생 이동 불가)</b>' : ''}`;
    if (focusSid) { const el = $(`#seatmap .seat-card[data-sid="${focusSid}"]`); if (el) el.focus({ preventScroll: true }); }
    // 미배치(배치가 있거나 레이아웃 변경으로 좌석을 잃은 경우에만 표시)
    const un = state.current.unplaced; $('#unplaced-card').hidden = !un.length || none || (noSeat && !state.current.showUnplaced);
    $('#unplaced').innerHTML = un.map(id => { const s = byId(id); return `<button type="button" class="chip chip-btn gender-${s.gender || 'N'} ${tapSel === 'u:' + id ? 'is-on' : ''}" data-action="tap-unplaced" data-sid="${id}">${s.no}. ${esc(s.name)}</button>`; }).join('');
    renderReport(); renderHeader();
  }
  // 좌석 격자 HTML(화면·발표·인쇄·미리보기 공용). opts: violations, locked, edit, tapSel, mode('present'|'print'), rotate, showNo, genderColor
  function seatGridHtml(L, seats, opts) {
    const o = opts || {}; const dups = dupNames(); const cells = L.cells.slice();
    const rot = !!o.rotate; const z = Engine.zoneInfo(L);
    const boardTop = rot ? L.teacherSide !== 'top' : L.teacherSide === 'top';
    const ordered = rot ? cells.map(c => ({ ...c, r: L.rows - 1 - c.r, c: L.cols - 1 - c.c })).sort((a, b) => a.r - b.r || a.c - b.c) : cells;
    const colTpl = rot ? tracks(L.colTpl).reverse().join(' ') : L.colTpl, rowTpl = rot ? tracks(L.rowTpl).reverse().join(' ') : L.rowTpl;   // 트랙 단위로 뒤집음(calc 토큰 보존)
    const interactive = !o.mode;                      // 화면 좌석표에서만 키보드 포커스·탭 대상
    const inner = ordered.map(c => {
      const origKey = rot ? (L.rows - 1 - c.r) + '-' + (L.cols - 1 - c.c) : cellKey(c);
      if (c.gap) return '<div class="gap"></div>';
      if (!c.desk) return `<div class="seat off" data-key="${origKey}" ${o.edit ? 'data-tip="클릭하면 책상 켜기" role="button" tabindex="0"' : ''}></div>`;
      const sid = seats[origKey]; const s = sid && byId(sid); const v = o.violations && o.violations[origKey];
      const zone = z.zoneOf(rot ? L.rows - 1 - c.r : c.r);
      const cls = ['seat', s ? 'filled' : 'empty', v ? 'viol' : '', o.locked && s && o.locked.includes(sid) ? 'locked' : '', o.tapSel === origKey ? 'tap-sel' : '', 'zone-' + zone].join(' ');
      const tip = v ? v.join(' / ') : (o.edit ? '클릭하면 책상 끄기' : '');
      if (!s) return `<div class="${cls}" data-key="${origKey}" ${tip ? `data-tip="${esc(tip)}"` : ''} ${interactive ? 'role="button" tabindex="0" aria-label="빈 책상"' : ''}><span class="dash">—</span></div>`;
      const gcls = o.genderColor === false ? 'gender-N' : 'gender-' + (s.gender || 'N');
      const tags = s.tags.map(t => `<i class="dot tag-${t}" title="${APP_DATA.tagLabels[t]}"></i>`).join('');
      if (o.mode === 'present') return `<div class="${cls}" data-key="${origKey}"><div class="flip" data-sid="${sid}"><div class="face front">?</div><div class="face back ${gcls}"><span class="no">${s.no}</span><span class="name">${esc(displayName(s, dups))}</span></div></div></div>`;
      const drag = o.mode === 'print' ? '' : `role="button" tabindex="0" aria-label="${esc(s.name)} 좌석" data-drag`;
      return `<div class="${cls}" data-key="${origKey}" ${tip ? `data-tip="${esc(tip)}"` : ''}><div class="seat-card ${gcls}" data-sid="${sid}" ${drag}>${o.showNo === false ? '' : `<span class="no">${s.no}</span>`}<span class="name">${esc(displayName(s, dups))}</span><span class="tags">${tags}</span>${o.mode === 'print' ? '' : `<button type="button" class="lock" data-action="lock" data-sid="${sid}" aria-label="자리 고정" title="자리 고정(다시 섞기에서 유지)">${o.locked && o.locked.includes(sid) ? '🔒' : '🔓'}</button>`}</div></div>`;
    }).join('');
    const board = '<div class="board-strip">칠 판</div>';
    return `${boardTop ? board : ''}<div class="seat-grid" style="grid-template-columns:${colTpl};grid-template-rows:${rowTpl}">${inner}</div>${boardTop ? '' : board}${o.mode === 'present' ? `<div class="teacher-note">교탁: ${L.teacherSide === 'top' ? '위(칠판 쪽)' : '아래'}</div>` : ''}`;
  }
  function renderReport() {
    const R = lastReport; const el = $('#report');
    if (!placedIds().length) { el.innerHTML = '<h3>충족 리포트</h3><div class="empty">자동 배치를 실행하면 조건별 충족 결과가 여기에 표시됩니다.</div>'; return; }
    const totalV = R.items.reduce((a, it) => a + it.violations.length, 0);
    const rows = R.items.map(it => {
      const st = it.na ? 'na' : it.violations.length ? 'bad' : 'ok';
      const txt = it.na ? '이력 없음(해당 없음)' : it.violations.length ? `위반 ${it.violations.length}건` : it.total ? `${it.ok}/${it.total} 충족` : '<span class="none">대상 없음</span>';
      return `<div class="rep-row st-${st}" data-tip="${esc(it.violations.map(v => v.reason).join(' / ') || '')}"><span class="ico">${st === 'ok' ? '✓' : st === 'bad' ? '✗' : '－'}</span><span class="lbl">${it.label}<small>${it.hard ? '하드' : '소프트'}${it.note ? ' · ' + it.note : ''}</small></span><span class="val">${txt}</span></div>`;
    }).join('');
    el.innerHTML = `<h3>충족 리포트</h3><div class="rep-total ${totalV ? 'bad' : 'ok'}">${totalV ? `위반 ${totalV}건 · 패널티 ${Math.round(R.penalty)}` : '모든 조건 충족 · 패널티 0'}</div>${rows}
      ${R.suggestions.length ? `<h4>완화 제안</h4><ul class="suggest">${R.suggestions.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}`;
  }

  // 모둠 탭
  function renderGroups() {
    const box = $('#group-options');
    if (!ui.groupOpts) ui.groupOpts = { mode: 'count', count: 6, size: 4, gender: true, level: true, pairs: true, avoidN: state.settings.avoidN, roles: true };
    const g = ui.groupOpts;
    if (!box.children.length) box.innerHTML = `<div class="row wrap"><label class="radio"><input type="radio" name="gmode" value="count" ${g.mode === 'count' ? 'checked' : ''}> 모둠 수</label><input type="number" id="g-count" min="2" max="10" value="${g.count}" aria-label="모둠 수"><label class="radio"><input type="radio" name="gmode" value="size" ${g.mode === 'size' ? 'checked' : ''}> 모둠 인원</label><input type="number" id="g-size" min="2" max="8" value="${g.size}" aria-label="모둠 인원"></div>
      <div class="row wrap"><label class="check"><input type="checkbox" id="g-gender" ${g.gender ? 'checked' : ''}> 성별 균형</label><label class="check"><input type="checkbox" id="g-level" ${g.level ? 'checked' : ''}> 학습수준 이질 균형</label><label class="check"><input type="checkbox" id="g-pairs" ${g.pairs ? 'checked' : ''}> 분리·결합 쌍 반영</label><label class="check"><input type="checkbox" id="g-avoid" ${g.avoidN > 0 ? 'checked' : ''}> 최근 <input type="number" id="g-avoid-n" min="1" max="5" value="${g.avoidN || 3}" aria-label="회피 횟수">회 같은 모둠 회피</label><label class="check"><input type="checkbox" id="g-roles" ${g.roles ? 'checked' : ''}> 역할 자동 배정</label></div>
      <div class="row wrap"><button type="button" class="btn btn-accent" data-action="make-groups" id="btn-make-groups">🧩 편성</button><button type="button" class="btn" data-action="make-groups" id="btn-regroup">🔀 다시 편성</button><button type="button" class="btn" data-action="groups-from-seats">현재 자리표에서 가져오기</button><button type="button" class="btn" data-action="confirm-groups" id="btn-confirm-groups">✔ 편성 확정</button></div>`;
    const none = !activeStudents().length; $('#btn-make-groups').disabled = none; $('#btn-regroup').disabled = none || !state.currentGroups; $('#btn-confirm-groups').disabled = !state.currentGroups;
    const GP = state.currentGroups; const grid = $('#group-grid'), rep = $('#group-report');
    rep.hidden = !GP;
    if (!GP) { grid.innerHTML = '<div class="empty card">아직 편성하지 않았습니다. 옵션을 정하고 "편성"을 누르세요.</div>'; rep.innerHTML = ''; return; }
    const sizes = GP.groups.map(x => x.members.length), mx = Math.max(...sizes), mn = Math.min(...sizes);
    grid.innerHTML = GP.groups.map(gr => `<div class="group-card" data-g="${gr.idx}" style="--gc:${esc(gr.color)}"><div class="gband"></div><div class="ghead"><button type="button" class="gname" data-action="rename-group" data-g="${gr.idx}" title="이름 편집">${esc(gr.name)}</button><span class="gcount">${gr.members.length}명</span>${mx - mn >= 2 && (gr.members.length === mx || gr.members.length === mn) ? '<span class="badge warn" data-tip="인원 편차 2 이상">편차 주의</span>' : ''}</div>
      <div class="members">${gr.members.map(m => { const s = byId(m.studentId); if (!s) return ''; return `<div class="member gender-${s.gender || 'N'}" data-sid="${m.studentId}" data-g="${gr.idx}" role="button" tabindex="0" aria-label="${esc(s.name)}"><span class="no">${s.no}</span><span class="name">${esc(s.name)}</span><button type="button" class="role ${m.role === '모둠원' ? 'plain' : ''}" data-action="change-role" data-sid="${m.studentId}" data-g="${gr.idx}" title="역할 변경">${esc(m.role)}</button></div>`; }).join('')}</div></div>`).join('');
    // 편성 리포트
    const gOf = {}; GP.groups.forEach(gr => gr.members.forEach(m => { gOf[m.studentId] = gr.idx; }));
    const balanced = GP.groups.filter(gr => { const m = gr.members.filter(x => (byId(x.studentId) || {}).gender === 'M').length, f = gr.members.filter(x => (byId(x.studentId) || {}).gender === 'F').length; return Math.abs(m - f) <= 1; }).length;
    const apartV = state.pairs.filter(p => p.type === 'apart' && gOf[p.a] != null && gOf[p.a] === gOf[p.b]);
    const recent = sortedByDate(state.groupHistory.filter(h => h.id !== GP.confirmedId)).slice(0, ui.groupOpts.avoidN || 0); let repeatN = 0;   // 방금 확정한 편성 자신은 제외
    GP.groups.forEach(gr => { const ids = gr.members.map(m => m.studentId); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (recent.some(h => h.groups.some(x => x.members.some(m => m.studentId === ids[i]) && x.members.some(m => m.studentId === ids[j])))) repeatN++; });
    rep.innerHTML = `<h3>편성 리포트</h3><div class="chips"><span class="chip ${balanced === GP.groups.length ? 'ok' : 'warn'}">성별 균형 모둠 ${balanced}/${GP.groups.length}</span><span class="chip ${apartV.length ? 'bad' : 'ok'}">분리 쌍 위반 ${apartV.length}건${apartV.length ? ': ' + apartV.map(p => esc(nameOf(p.a) + '-' + nameOf(p.b))).join(', ') : ''}</span><span class="chip ${repeatN ? 'warn' : 'ok'}">반복 모둠 쌍 ${repeatN}건</span><span class="chip">인원 ${sizes.join('·')}</span></div>`;
  }
  // 모둠 옵션 읽기
  function readGroupOpts() {
    const g = ui.groupOpts; g.mode = ($('input[name=gmode]:checked') || {}).value || 'count';
    g.count = Math.min(10, Math.max(2, Number($('#g-count').value) || 6)); g.size = Math.min(8, Math.max(2, Number($('#g-size').value) || 4));
    g.gender = $('#g-gender').checked; g.level = $('#g-level').checked; g.pairs = $('#g-pairs').checked; g.roles = $('#g-roles').checked;
    g.avoidN = $('#g-avoid').checked ? Math.min(5, Math.max(1, Number($('#g-avoid-n').value) || 3)) : 0;
    $('#g-count').value = g.count; $('#g-size').value = g.size; storage.set('ui', ui); return g;
  }
  function makeGroupsAction() {
    const act = activeStudents(); if (!act.length) return showToast('학생이 없습니다', 'warn');
    const g = readGroupOpts(); let value = g.mode === 'count' ? g.count : g.size;
    if (g.mode === 'count' && value > act.length) { showToast(`모둠 수를 학생 수(${act.length})로 줄였습니다`, 'warn'); value = act.length; }
    state.currentGroups = Engine.makeGroups(act, g.mode, value, g, state.pairs, state.groupHistory, state.settings);
    renderGroups(); touch(); showToast(`${state.currentGroups.groups.length}개 모둠을 편성했습니다`, 'success');
  }
  // 현재 자리표(4인 모둠형)의 책상 묶음 → 모둠
  function groupsFromSeats() {
    if (state.layout.preset !== 'group4') return showToast('4인 모둠형 레이아웃에서만 가져올 수 있습니다', 'warn');
    if (!placedIds().length) return showToast('먼저 자리를 배치하세요', 'warn');
    const byPg = {}; deskCells().forEach(c => { const sid = state.current.seats[cellKey(c)]; if (sid) (byPg[c.pairGroup] = byPg[c.pairGroup] || []).push(sid); });
    const groups = Object.keys(byPg).sort((a, b) => a - b).map((pg, i) => ({ idx: i, name: state.settings.groupNames[i] || `${i + 1}모둠`, color: state.settings.groupColors[i] || APP_DATA.settings.groupColors[APP_DATA.settings.groupColors.length - 1], members: byPg[pg].map(studentId => ({ studentId, role: '모둠원' })) }));
    if (ui.groupOpts.roles) Engine.assignRoles(groups, state.settings.roles, state.groupHistory);
    state.currentGroups = { id: uid('g'), date: '', memo: '', groupCount: groups.length, groups }; renderGroups(); touch(); showToast('자리표의 책상 묶음을 모둠으로 가져왔습니다', 'success');
  }
  function moveMember(sid, fromG, toG) {
    if (fromG === toG) return; const GP = state.currentGroups; const from = GP.groups[fromG], to = GP.groups[toG];
    const i = from.members.findIndex(m => m.studentId === sid); if (i < 0) return;
    const m = from.members.splice(i, 1)[0]; if (m.role !== '모둠원' && to.members.some(x => x.role === m.role)) m.role = '모둠원';
    to.members.push(m); renderGroups(); touch();
  }
  async function changeRole(sid, gi) {
    const gr = state.currentGroups.groups[gi]; const m = gr.members.find(x => x.studentId === sid);
    const roles = ['모둠원', ...state.settings.roles]; let chosen = m.role;
    const ok = await showModal({ title: `${nameOf(sid)} 역할`, body: `<select id="m-role" class="wide">${roles.map(r => `<option ${r === m.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>`, confirmText: '변경', validate: (md) => { chosen = $('#m-role', md).value; } });
    if (ok) { m.role = chosen; renderGroups(); touch(); }
  }
  async function confirmGroups() {
    const GP = state.currentGroups; if (!GP) return;
    let date = '', memo = '';
    const ok = await showModal({ title: '편성 확정', body: `<label class="field">날짜<input type="date" id="m-date" value="${todayStr()}"></label><label class="field">메모<input type="text" id="m-memo" maxlength="30" placeholder="예: 과학 실험"></label>`, confirmText: '확정', validate: (m) => { date = $('#m-date', m).value; memo = $('#m-memo', m).value.trim(); if (!date) { showToast('날짜를 입력하세요', 'error'); return false; } } });
    if (!ok) return; if (!await ensureHistoryRoom(state.groupHistory, '모둠')) return;
    const id = uid('g'); delete GP.confirmedId;
    state.groupHistory.push({ ...JSON.parse(JSON.stringify(GP)), id, date, memo, createdAt: new Date().toISOString() });
    GP.confirmedId = id;                             // 반복 모둠 집계에서 자기 자신 제외
    touch(); renderGroups(); renderHistory(); showToast(`'${memo || date}' 모둠 편성을 저장했습니다`, 'success');
  }

  // 히스토리·공정성 탭
  function renderHistory() {
    const items = [...state.history.map(h => ({ ...h, kind: 'seat' })), ...state.groupHistory.map(h => ({ ...h, kind: 'group' }))];
    const list = sortedByDate(items).filter(h => ui.histFilter === 'all' || h.kind === ui.histFilter);
    $$('#hist-filter .chip').forEach(c => c.classList.toggle('is-on', c.dataset.filter === ui.histFilter));
    $('#hist-list').innerHTML = list.length ? list.map(h => {
      const v = h.kind === 'seat' ? violCount(h) : null;
      const LS = h.layoutSnapshot || {}; const lname = LS.name ? `${esc(LS.name)}(${PRESET_LABEL[LS.preset] || '?'})` : (PRESET_LABEL[LS.preset] || '레이아웃 없음');
      return `<button type="button" class="hist-card kind-${h.kind}" data-action="open-hist" data-kind="${h.kind}" data-id="${h.id}"><span class="badge kind-${h.kind}">${h.kind === 'seat' ? '자리' : '모둠'}</span><b class="date">${esc(h.date)}</b><span class="memo">${esc(h.memo) || '(메모 없음)'}</span><small>${h.kind === 'seat' ? `${lname} · ${Object.keys(h.seats || {}).length}명 · ${v ? `위반 ${v}건` : '위반 0'}` : `${h.groups.length}모둠 · ${h.groups.reduce((a, g) => a + g.members.length, 0)}명`}</small></button>`;
    }).join('') : '<div class="empty card">기록이 없습니다. 자리 배치 탭에서 "배치 확정"을 누르면 여기에 쌓입니다.</div>';
    renderFairness();
  }
  function renderFairness() {
    const el = $('#fairness');
    if (!state.history.length && !state.groupHistory.length) { el.innerHTML = '<div class="empty card">히스토리가 쌓이면 짝·모둠 히트맵, 구역 누적 막대, 역할 경험 표가 표시됩니다.</div>'; return; }
    const stu = state.students.slice().sort((a, b) => a.no - b.no); const F = Engine.fairness(stu, state.history, state.groupHistory);
    const n = stu.length, cs = 22, pad = 72, W = pad + n * cs + 8, H = pad + n * cs + 8;
    let svg = `<svg class="heat" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="짝·모둠 공동 횟수 히트맵">`;
    stu.forEach((s, i) => { svg += `<text x="${pad + i * cs + cs / 2}" y="${pad - 6}" transform="rotate(-60 ${pad + i * cs + cs / 2} ${pad - 6})" class="hl">${esc(s.name)}</text><text x="${pad - 6}" y="${pad + i * cs + cs / 2 + 4}" text-anchor="end" class="hl">${esc(s.name)}</text>`; });
    stu.forEach((a, i) => stu.forEach((b, j) => {
      if (i === j) { svg += `<rect x="${pad + j * cs}" y="${pad + i * cs}" width="${cs - 1}" height="${cs - 1}" class="diag"/>`; return; }
      const k = F.pairKey(a.id, b.id), p = F.partner[k] || 0, g = F.group[k] || 0, t = p + g;
      svg += `<rect x="${pad + j * cs}" y="${pad + i * cs}" width="${cs - 1}" height="${cs - 1}" class="hc" style="opacity:${t ? Math.min(1, 0.18 + t * 0.27) : 0.06}" data-tip="${esc(a.name)}-${esc(b.name)}: 짝 ${p}회·모둠 ${g}회"/>`;
    }));
    svg += '</svg>';
    // 가장 자주 함께한 상위 5쌍(TV·터치 기기에서 호버 없이 읽을 수 있게)
    const tops = []; stu.forEach((a, i) => stu.forEach((b, j) => { if (i < j) { const k = F.pairKey(a.id, b.id), p = F.partner[k] || 0, g = F.group[k] || 0; if (p + g) tops.push({ a, b, p, g, t: p + g }); } }));
    tops.sort((x, y) => y.t - x.t || y.p - x.p);
    const topList = tops.length ? `<ol class="top-pairs">${tops.slice(0, 5).map(x => `<li><b>${esc(x.a.name)}-${esc(x.b.name)}</b> 짝 ${x.p}회·모둠 ${x.g}회</li>`).join('')}</ol>` : '';
    const bars = stu.filter(s => F.zones[s.id].total > 0).map(s => { const z = F.zones[s.id]; const pct = k => (z[k] / z.total * 100).toFixed(1); const bad = F.biased.includes(s.id);
      return `<div class="zrow ${bad ? 'is-bad' : ''}"><span class="zname">${esc(s.name)}${bad ? '<span class="badge bad">편중 주의</span>' : ''}</span><svg viewBox="0 0 100 10" preserveAspectRatio="none" class="zbar" data-tip="${esc(s.name)}: 앞 ${z.front}·중 ${z.mid}·뒤 ${z.back} (${z.total}회)"><rect x="0" y="0" width="${pct('front')}" height="10" class="zf"/><rect x="${pct('front')}" y="0" width="${pct('mid')}" height="10" class="zm"/><rect x="${(z.front + z.mid) / z.total * 100}" y="0" width="${pct('back')}" height="10" class="zb"/></svg><span class="zcnt">${z.front}/${z.mid}/${z.back}</span></div>`; }).join('');
    const roles = state.settings.roles;
    const roleRows = stu.filter(s => F.roles[s.id]).map(s => `<tr><td>${s.no}. ${esc(s.name)}</td>${roles.map(r => `<td class="num">${(F.roles[s.id] || {})[r] || 0}</td>`).join('')}<td class="num">${(F.roles[s.id] || {})['모둠원'] || 0}</td></tr>`).join('');
    el.innerHTML = `<div class="fair-grid"><div class="card stack-sm"><h3>짝·모둠 공동 횟수 히트맵</h3><p class="hint">셀이 진할수록 자주 함께했습니다. 셀에 마우스를 올리거나 탭하면 횟수가 보입니다.</p><div class="table-wrap">${svg}</div>${topList ? `<h4>자주 함께한 쌍 TOP 5</h4>${topList}` : ''}</div>
      <div class="card stack-sm"><h3>구역 누적(앞/중/뒤)</h3><p class="hint">뒤 구역 비율 70% 이상·3회 이상이면 <span class="badge bad">편중 주의</span></p><div class="legend"><i class="zf"></i>앞 <i class="zm"></i>중 <i class="zb"></i>뒤</div><div class="zlist">${bars || '<div class="empty">자리 배치 기록이 없습니다.</div>'}</div></div></div>
      <div class="card stack-sm"><h3>역할 경험 횟수</h3><div class="table-wrap">${roleRows ? `<table class="tbl sm"><thead><tr><th>학생</th>${roles.map(r => `<th>${esc(r)}</th>`).join('')}<th>모둠원</th></tr></thead><tbody>${roleRows}</tbody></table>` : '<div class="empty">모둠 기록이 없습니다.</div>'}</div></div>`;
  }
  // 히스토리 카드 → 읽기 전용 미리보기 모달(불러오기·삭제)
  async function openHistory(kind, id) {
    const arr = kind === 'seat' ? state.history : state.groupHistory; const h = arr.find(x => x.id === id); if (!h) return;
    const body = document.createElement('div'); body.className = 'stack-sm';
    if (kind === 'seat') body.innerHTML = `<p class="hint">${esc(h.date)} · ${esc(h.memo)} · ${PRESET_LABEL[h.layoutSnapshot.preset] || ''} · 위반 ${violCount(h)}건</p><div class="seatmap-wrap mini" style="--cell:52px">${seatGridHtml(h.layoutSnapshot, h.seats, { mode: 'print' })}</div>`;
    else body.innerHTML = `<p class="hint">${esc(h.date)} · ${esc(h.memo)} · ${h.groups.length}모둠</p><div class="group-grid mini">${h.groups.map(g => `<div class="group-card" style="--gc:${esc(g.color)}"><div class="gband"></div><div class="ghead"><b>${esc(g.name)}</b></div><div class="members">${g.members.map(m => `<div class="member"><span class="name">${esc(nameOf(m.studentId))}</span><span class="role ${m.role === '모둠원' ? 'plain' : ''}">${esc(m.role)}</span></div>`).join('')}</div></div>`).join('')}</div>`;
    body.insertAdjacentHTML('beforeend', '<div class="row wrap"><button type="button" class="btn btn-accent" data-h="load">이 기록 불러오기</button><button type="button" class="btn btn-danger" data-h="del">삭제</button></div>');
    let action = null;
    await showModal({ title: kind === 'seat' ? '배치 미리보기' : '모둠 미리보기', body, confirmText: '닫기', cancelText: '', wide: true, onOpen: (m, close) => { body.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) { action = b.dataset.h; close(false); } }); } });
    if (action === 'del') {
      if (!await showModal({ title: '기록 삭제', body: `<b>${esc(h.date)} ${esc(h.memo)}</b> 기록을 삭제할까요?`, confirmText: '삭제', danger: true })) return;
      arr.splice(arr.indexOf(h), 1); lastReport = null; touch(); renderHistory(); renderSeats(); showToast('기록을 삭제했습니다', 'success');
    } else if (action === 'load') {
      if (kind === 'seat') { state.layout = JSON.parse(JSON.stringify(h.layoutSnapshot)); state.current = { seats: { ...h.seats }, locked: (h.locked || []).slice(), unplaced: [], confirmedId: h.id }; resetUndo(); lastReport = null; setTab('seats'); fitZoom(); afterSeatChange(false); showToast('배치를 현재 자리표로 불러왔습니다', 'success'); }
      else { state.currentGroups = { ...JSON.parse(JSON.stringify(h)), confirmedId: h.id }; touch(); setTab('groups'); showToast('모둠 편성을 불러왔습니다', 'success'); }
    }
  }

  // 설정 탭
  function renderSettings() {
    const S = state.settings;
    setHtml($('#settings-roles'), `<h3>역할 목록 <small class="hint">모둠 역할 배지(순서대로 배정)</small></h3><div class="stack-sm">${S.roles.map((r, i) => `<div class="row"><input type="text" data-role-i="${i}" value="${esc(r)}" maxlength="10" aria-label="역할 이름"><button type="button" class="icon-btn sm" data-action="role-up" data-i="${i}" aria-label="위로" ${i ? '' : 'disabled'}>↑</button><button type="button" class="icon-btn sm" data-action="role-down" data-i="${i}" aria-label="아래로" ${i < S.roles.length - 1 ? '' : 'disabled'}>↓</button><button type="button" class="icon-btn sm" data-action="role-del" data-i="${i}" aria-label="삭제" ${S.roles.length > 1 ? '' : 'disabled'}>🗑</button></div>`).join('')}</div><div><button type="button" class="btn sm" data-action="role-add" ${S.roles.length >= 8 ? 'disabled' : ''}>＋ 역할 추가</button></div>`);
    setHtml($('#settings-groups'), `<h3>모둠 이름·색</h3><div class="gset">${S.groupNames.map((nm, i) => `<label class="row"><input type="color" data-gcolor-i="${i}" value="${esc(S.groupColors[i])}" aria-label="모둠 색"><input type="text" data-gname-i="${i}" value="${esc(nm)}" maxlength="10" aria-label="모둠 이름"></label>`).join('')}</div>`);
    setHtml($('#settings-misc'), `<h3>기본값</h3><label class="field inline">기본 회피 횟수(N)<input type="number" id="s-avoid" min="1" max="5" value="${S.avoidN}"></label><label class="field inline">발표 플립 간격(ms)<input type="number" id="s-flip" min="200" max="3000" step="100" value="${S.flipIntervalMs}"></label><label class="check"><input type="checkbox" id="s-sound" ${S.sound ? 'checked' : ''}> 발표 모드 소리 기본 켜기</label>`);
    $('#storage-info').textContent = `자리뚝딱 v${VERSION} · 저장 용량 약 ${(storage.size() / 1024).toFixed(1)} KB · 학생 ${state.students.length}명 · 배치 ${state.history.length}건 · 모둠 ${state.groupHistory.length}건`;
  }

  // ── 명렬 편집 ──
  function addStudent() {
    if (state.students.length >= MAX_STUDENTS) return showToast(`학생은 최대 ${MAX_STUDENTS}명까지 등록할 수 있습니다`, 'error');
    const no = state.students.reduce((a, s) => Math.max(a, s.no), 0) + 1;
    const s = { id: uid('s'), no, name: '', gender: '', level: null, tags: [], active: true }; state.students.push(s); lastReport = null; renderRoster(); renderSeats(); touch();
    const inp = $(`#roster-table tr[data-id="${s.id}"] input[data-field=name]`); if (inp) { inp.focus(); inp.scrollIntoView({ block: 'nearest' }); }
  }
  async function deleteStudent(id) {
    const s = byId(id); if (!s) return;
    if (!await showModal({ title: '학생 삭제', body: `<b>${esc(s.name || '(이름 없음)')}</b> 학생을 명렬에서 삭제할까요? 관련 분리·결합 쌍도 함께 삭제됩니다.`, confirmText: '삭제', danger: true })) return;
    state.students = state.students.filter(x => x.id !== id); state.pairs = state.pairs.filter(p => p.a !== id && p.b !== id); resetUndo(); lastReport = null; renderRoster(); renderSeats(); touch();
  }
  function addPair(type) {
    const a = $('#pair-a').value, b = $('#pair-b').value; if (!a || !b) return showToast('학생을 선택하세요', 'warn');
    if (a === b) return showToast('같은 학생끼리는 쌍을 만들 수 없습니다', 'error');
    if (state.pairs.some(p => (p.a === a && p.b === b) || (p.a === b && p.b === a))) return showToast('이미 등록된 쌍입니다(분리·결합 중복 불가)', 'error');
    state.pairs.push({ id: uid('p'), a, b, type, hard: type === 'apart', memo: '' }); lastReport = null; renderRoster(); renderSeats(); touch(); showToast(`${nameOf(a)}-${nameOf(b)} ${type === 'apart' ? '분리' : '결합'} 쌍을 추가했습니다`, 'success');
  }
  function parsePaste(text) {
    const nextNo = state.students.reduce((a, s) => Math.max(a, s.no), 0) + 1;
    pendingRows = Engine.parseRoster(text, nextNo, Math.max(0, MAX_STUDENTS - state.students.length));
    if (!pendingRows.length) showToast('인식할 내용이 없습니다', 'warn');
    else if (pendingRows.some(r => /상한/.test(r.msg))) showToast(`학생 상한 ${MAX_STUDENTS}명을 넘는 행은 제외됩니다`, 'warn');
    renderPastePreview();
  }
  function addParsed() {
    const rows = pendingRows.filter(r => r.status !== 'error'); if (!rows.length) return;
    rows.forEach(r => state.students.push({ id: uid('s'), no: r.no, name: r.name, gender: r.gender, level: null, tags: [], active: true }));
    pendingRows = []; $('#paste-area').value = ''; lastReport = null; renderRoster(); renderSeats(); touch(); showToast(`${rows.length}명을 추가했습니다`, 'success');
  }

  // ── 발표 모드 ──
  const present = { active: false, order: [], idx: 0, timer: null, running: false, audio: null };
  function openPresent() {
    if (!placedIds().length) return showToast('먼저 자리를 배치하세요', 'warn');
    const el = $('#present'); $('#present-title').textContent = classTitle() + ' 자리 발표';
    $('#present-map').innerHTML = seatGridHtml(state.layout, state.current.seats, { mode: 'present' });
    el.hidden = false; document.body.classList.add('presenting'); present.active = true; present.idx = 0; present.running = false; clearTimeout(present.timer);
    buildOrder(); updatePresentBar();
    if (el.requestFullscreen) el.requestFullscreen().catch(() => { el.classList.add('fallback'); }); else el.classList.add('fallback');
    fitPresent();
  }
  function buildOrder() {
    const L = state.layout; const z = Engine.zoneInfo(L);
    const filled = deskCells().filter(c => state.current.seats[cellKey(c)]).sort((a, b) => z.rowOrder.indexOf(a.r) - z.rowOrder.indexOf(b.r) || a.c - b.c).map(cellKey);
    present.order = ui.present.random ? Engine.shuffle(filled) : filled;
  }
  const PRESENT_CELL_MIN = 64, PRESENT_CELL_MAX = 180, PRESENT_PAD_W = 40, PRESENT_PAD_H = 90;   // 발표 좌석표 셀 크기 범위·여백(px)
  function fitPresent() { // 좌석표가 화면에 꽉 차도록 --cell 계산(좁은 화면에서는 최소 크기 유지 + 내부 스크롤)
    const L = state.layout; const body = $('.present-body');
    const cw = (body.clientWidth - PRESENT_PAD_W) / trackUnits(L.colTpl, L.cols), ch = (body.clientHeight - PRESENT_PAD_H) / trackUnits(L.rowTpl, L.rows);
    $('#present-map').style.setProperty('--cell', Math.max(PRESENT_CELL_MIN, Math.min(PRESENT_CELL_MAX, Math.floor(Math.min(cw, ch)))) + 'px');
  }
  function flipOne(silent) {                        // silent=true면 소리·진행 표시 생략(전체 공개 일괄 처리용)
    if (present.idx >= present.order.length) { pausePresent(); return false; }
    const key = present.order[present.idx++]; const card = $(`#present-map .seat[data-key="${key}"] .flip`); if (card) card.classList.add('flipped');
    if (!silent) { if (ui.soundOn) ding(); updatePresentBar(); } return true;
  }
  function tick() { if (!present.running) return; if (flipOne() && present.idx < present.order.length) present.timer = setTimeout(tick, state.settings.flipIntervalMs); else pausePresent(); }
  function startPresent() { if (present.running) return pausePresent(); if (present.idx >= present.order.length) { resetPresentCards(); } if (ui.soundOn) ensureAudio(); present.running = true; updatePresentBar(); tick(); }
  function pausePresent() { present.running = false; clearTimeout(present.timer); updatePresentBar(); }
  function resetPresentCards() { present.idx = 0; $$('#present-map .flipped').forEach(x => x.classList.remove('flipped')); buildOrder(); }
  function updatePresentBar() {
    $('#present-progress').textContent = `${present.idx}/${present.order.length} 공개`;
    $('#pr-start').textContent = present.running ? '⏸ 일시정지' : (present.idx >= present.order.length && present.order.length ? '↺ 처음부터' : (present.idx ? '▶ 재개' : '▶ 시작'));
    $('#pr-order').textContent = `순서: ${ui.present.random ? '무작위' : '좌석순'}`; $('#pr-sound').textContent = ui.soundOn ? '🔔 소리 켜짐' : '🔇 소리 꺼짐';
  }
  function closePresent() {
    if (!present.active) return; present.active = false; pausePresent(); const el = $('#present'); el.hidden = true; el.classList.remove('fallback'); document.body.classList.remove('presenting');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  // Web Audio '딩' 1종(sine 880Hz 0.15s)
  function ensureAudio() { try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; present.audio = present.audio || new AC(); if (present.audio.state === 'suspended') present.audio.resume().catch(() => {}); } catch (e) { present.audio = null; } }
  function ding() {
    ensureAudio(); const ac = present.audio; if (!ac) return;
    try { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.15); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.16); } catch (e) { /* 무음 진행 */ }
  }

  // ── 인쇄 미리보기 ──
  function openPrint(kind) {
    if (!activeStudents().length) return showToast('학생이 없습니다', 'warn');
    const P = state.settings.print; $('#opt-no').checked = P.showNo; $('#opt-gender').checked = P.genderColor; $('#opt-title').checked = P.title;
    if (kind) { const r = $(`input[name=print-kind][value=${kind}]`); if (r) r.checked = true; }
    $('#print-panel').hidden = false; document.body.classList.add('print-open'); renderPrint();
  }
  function closePrint() { $('#print-panel').hidden = true; document.body.classList.remove('print-open'); }
  function renderPrint() {
    const kind = ($('input[name=print-kind]:checked') || {}).value || 'student';
    const showNo = $('#opt-no').checked, genderColor = $('#opt-gender').checked, title = $('#opt-title').checked;
    state.settings.print = { showNo, genderColor, title }; save();
    const landscape = kind === 'student' || kind === 'teacher'; const pages = [];
    const head = (sub) => title ? `<div class="p-title"><b>${esc(classTitle())}</b> ${sub ? `<span>${esc(sub)}</span>` : ''}<span class="p-date">${todayStr()}</span></div>` : '';
    const L = state.layout;
    if (kind === 'student' || kind === 'teacher') {
      if (!placedIds().length) pages.push(`<div class="page landscape">${head('')}<div class="empty">배치된 좌석이 없습니다. 자동 배치 후 인쇄하세요.</div></div>`);
      else { const cell = Math.min(PRINT_CELL_MAX, Math.floor(PRINT_GRID_W / trackUnits(L.colTpl, L.cols)), Math.floor(PRINT_GRID_H / trackUnits(L.rowTpl, L.rows)));
        pages.push(`<div class="page landscape">${head(kind === 'teacher' ? '교사용(교탁에서 본 방향)' : '학생 게시용')}<div class="p-seatmap" style="--cell:${cell}px">${seatGridHtml(L, state.current.seats, { mode: 'print', rotate: kind === 'teacher', showNo, genderColor })}</div></div>`); }
    } else if (kind === 'groups') {
      const GP = state.currentGroups;
      if (!GP) pages.push(`<div class="page portrait">${head('모둠 명단표')}<div class="empty">편성된 모둠이 없습니다. 모둠 탭에서 편성 후 인쇄하세요.</div></div>`);
      else for (let i = 0; i < GP.groups.length; i += 8) pages.push(`<div class="page portrait">${head('모둠 명단표' + (GP.memo ? ' · ' + GP.memo : ''))}<div class="p-groups">${GP.groups.slice(i, i + 8).map(g => `<div class="p-group" style="--gc:${esc(g.color)}"><div class="gband"></div><h4>${esc(g.name)} <small>${g.members.length}명</small></h4><ul>${g.members.map(m => { const s = byId(m.studentId); return s ? `<li class="${genderColor ? 'gender-' + (s.gender || 'N') : ''}">${showNo ? `<span class="no">${s.no}</span>` : ''}<span class="name">${esc(s.name)}</span><span class="role ${m.role === '모둠원' ? 'plain' : ''}">${esc(m.role)}</span></li>` : ''; }).join('')}</ul></div>`).join('')}</div></div>`);
    } else {
      const list = activeStudents();
      for (let i = 0; i < list.length; i += 4) pages.push(`<div class="page portrait plates">${list.slice(i, i + 4).map(s => { const g = genderColor ? 'gender-' + (s.gender || 'N') : ''; const inner = `<div class="plate-in ${g}"><span class="pl-class">${esc(classTitle())}</span><span class="pl-name">${esc(s.name)}</span>${showNo ? `<span class="pl-no">${s.no}번</span>` : ''}</div>`; return `<div class="plate"><div class="half upside">${inner}</div><div class="half">${inner}</div></div>`; }).join('')}</div>`);
    }
    $('#print-pages').innerHTML = pages.map(p => `<div class="page-outer">${p}</div>`).join('');
    $('#print-pagecount').textContent = `총 ${pages.length}페이지 · A4 ${landscape ? '가로' : '세로'}`;
    let st = $('#page-style'); if (!st) { st = document.createElement('style'); st.id = 'page-style'; document.head.appendChild(st); }
    st.textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`;
    scalePrintPreview();
  }
  function scalePrintPreview() { // A4 페이지를 미리보기 폭에 맞게 축소
    const pv = $('#print-preview'); const avail = pv.clientWidth - 32;
    $$('#print-pages .page-outer').forEach(o => { const p = o.firstElementChild; const w = p.offsetWidth, h = p.offsetHeight; const sc = Math.min(1, avail / w); p.style.transform = `scale(${sc})`; o.style.height = h * sc + 'px'; o.style.width = w * sc + 'px'; });
  }

  // ── PNG 저장(Canvas 2D) ──
  function savePng() {
    if (!placedIds().length) return showToast('배치된 좌석이 없습니다', 'warn');
    const L = state.layout, cell = PRINT_CELL_MAX, gap = Math.round(cell * CELL_GAP_RATIO), trackPx = (t) => (isGap(t) ? cell * Engine.GAP_RATIO : cell);
    const colW = tracks(L.colTpl).map(trackPx), rowH = tracks(L.rowTpl).map(trackPx);   // 트랙 단위(열 수와 길이 일치)
    const gw = colW.reduce((a, b) => a + b, 0) + gap * (L.cols - 1), gh = rowH.reduce((a, b) => a + b, 0) + gap * (L.rows - 1);
    const pad = 40, top = 120, cv = document.createElement('canvas'); cv.width = gw + pad * 2; cv.height = gh + top + 100; const x = cv.getContext('2d');
    const css = getComputedStyle(document.documentElement); const col = (v, d) => (css.getPropertyValue(v).trim() || d);
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, cv.width, cv.height);
    x.fillStyle = '#1f2937'; x.font = 'bold 30px "Do Hyeon", "Malgun Gothic", sans-serif'; x.fillText(`${classTitle()} 자리표`, pad, 50);
    x.font = '16px "IBM Plex Sans KR", "Malgun Gothic", sans-serif'; x.fillStyle = '#6b7280'; x.fillText(todayStr(), pad, 78);
    const boardY = L.teacherSide === 'top' ? 92 : top + gh + 20; x.fillStyle = col('--accent', '#F59E0B'); x.fillRect(pad, boardY, gw, 18); x.fillStyle = '#ffffff'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.fillText('칠 판', pad + gw / 2, boardY + 14);
    const xs = [pad]; colW.forEach((w, i) => xs.push(xs[i] + w + gap)); const ys = [top]; rowH.forEach((h, i) => ys.push(ys[i] + h + gap));
    L.cells.forEach(c => {
      if (c.gap) return; const X = xs[c.c], Y = ys[c.r], w = colW[c.c], h = rowH[c.r]; x.beginPath(); x.roundRect(X, Y, w, h, 10);
      if (!c.desk) { x.setLineDash([5, 5]); x.strokeStyle = '#d1d5db'; x.stroke(); x.setLineDash([]); return; }
      const sid = state.current.seats[cellKey(c)], s = sid && byId(sid);
      x.fillStyle = s ? (s.gender === 'M' ? '#DBEAFE' : s.gender === 'F' ? '#FCE7F3' : '#F3F4F6') : '#FAFAFA'; x.fill(); x.strokeStyle = '#d1d5db'; x.stroke();
      if (!s) { x.fillStyle = '#9ca3af'; x.font = '20px sans-serif'; x.fillText('—', X + w / 2, Y + h / 2 + 7); return; }
      x.fillStyle = '#6b7280'; x.font = '14px sans-serif'; x.textAlign = 'left'; x.fillText(String(s.no), X + 10, Y + 22); x.textAlign = 'center';
      x.fillStyle = '#111827'; x.font = 'bold 24px "Do Hyeon", "Malgun Gothic", sans-serif'; x.fillText(s.name, X + w / 2, Y + h / 2 + 12);
    });
    x.fillStyle = '#9ca3af'; x.font = '12px sans-serif'; x.textAlign = 'right'; x.fillText('자리뚝딱', cv.width - pad, cv.height - 20);
    cv.toBlob(b => { if (b) download(`jari-${todayStr().replace(/-/g, '')}.png`, b, 'image/png'); showToast('PNG 이미지를 저장했습니다', 'success'); }, 'image/png');
  }

  // ── 백업: 내보내기·가져오기·샘플·삭제 ──
  function exportJson() { download(`jari-ttukttak-${todayStr().replace(/-/g, '')}.json`, JSON.stringify(state, null, 2)); showToast('JSON 파일을 내보냈습니다', 'success'); }
  async function importJson(file) {
    let obj; try { obj = JSON.parse(await readFile(file)); } catch (e) { return showModal({ title: '가져오기 실패', body: 'JSON 파일을 읽을 수 없습니다(손상되었거나 형식이 다릅니다). 기존 데이터는 그대로 유지됩니다.', cancelText: '' }); }
    const err = validateRoot(obj); if (err) return showModal({ title: '가져오기 실패', body: `파일 구조가 맞지 않습니다: ${esc(err)}<br>기존 데이터는 그대로 유지됩니다.`, cancelText: '' });
    const ok = await showModal({ title: '백업 가져오기', body: `<p><b>${esc(obj.classInfo.school || '')} ${esc(obj.classInfo.className || '')}</b></p><ul><li>학생 ${obj.students.length}명</li><li>배치 ${obj.history.length}건 · 모둠 ${(obj.groupHistory || []).length}건</li><li>저장 시각 ${esc(obj.updatedAt || '-')}</li></ul><p class="warn-text">현재 데이터를 모두 덮어씁니다.</p>`, confirmText: '덮어쓰기', danger: true });
    if (!ok) return;
    if (applyRoot(obj)) showToast('백업을 가져왔습니다', 'success');
  }
  // Root 구조 검증(최상위 키 + 학생·쌍·레이아웃·히스토리 항목 스키마). 오류 문자열 또는 null
  function validateRoot(o) {
    if (!o || typeof o !== 'object') return '객체가 아님'; if (o.version !== 1) return `version 불일치(${o.version})`;
    for (const k of ['students', 'history', 'pairs']) if (!Array.isArray(o[k])) return `${k} 배열 누락`;
    if (!o.conditions || !o.settings || !o.classInfo) return '필수 키 누락(conditions/settings/classInfo)';
    const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
    const layoutOk = (L) => isObj(L) && Array.isArray(L.cells) && L.cells.every(c => isObj(c) && Number.isInteger(c.r) && Number.isInteger(c.c)) && Number.isInteger(L.rows) && Number.isInteger(L.cols) && typeof L.colTpl === 'string' && typeof L.rowTpl === 'string';
    if (!layoutOk(o.layout)) return 'layout 구조 오류';
    if (o.layouts != null && !(Array.isArray(o.layouts) && o.layouts.every(layoutOk))) return 'layouts 구조 오류';
    if (!o.students.every(s => isObj(s) && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.no === 'number')) return 'students 항목 오류(id/name/no)';
    if (!o.pairs.every(p => isObj(p) && typeof p.a === 'string' && typeof p.b === 'string' && (p.type === 'apart' || p.type === 'together'))) return 'pairs 항목 오류';
    if (!o.history.every(h => isObj(h) && typeof h.id === 'string' && typeof h.date === 'string' && isObj(h.seats) && layoutOk(h.layoutSnapshot))) return 'history 항목 오류(layoutSnapshot/seats)';
    if (o.groupHistory != null && !(Array.isArray(o.groupHistory) && o.groupHistory.every(g => isObj(g) && typeof g.id === 'string' && Array.isArray(g.groups) && g.groups.every(x => isObj(x) && Array.isArray(x.members))))) return 'groupHistory 항목 오류';
    if (o.currentGroups != null && !(isObj(o.currentGroups) && Array.isArray(o.currentGroups.groups))) return 'currentGroups 구조 오류';
    if (o.current != null && !(isObj(o.current) && isObj(o.current.seats || {}))) return 'current 구조 오류';
    return null;
  }
  // Root 적용: 기본값 병합·정규화 → (silent가 아니면) 렌더 성공 후 저장. 렌더 중 예외면 기존 데이터로 복귀
  function applyRoot(root, silent) {
    const base = defaultRoot(), prev = state;
    const next = normalizeRoot({ ...base, ...root, settings: { ...base.settings, ...(root.settings || {}), weights: { ...base.settings.weights, ...((root.settings || {}).weights || {}) } }, conditions: { ...base.conditions, ...(root.conditions || {}) }, current: { ...base.current, ...(root.current || {}) }, layouts: root.layouts || [], groupHistory: root.groupHistory || [] });
    state = next; resetUndo(); lastReport = null; tapSel = null; pendingRows = [];
    if (silent) { storageOk = storage.set('data', state); setSaveStatus(storageOk); return true; }
    try { renderAll(); } catch (e) {
      state = prev; lastReport = null; if (prev) renderAll();
      showModal({ title: '가져오기 실패', body: '데이터를 화면에 표시하는 중 오류가 났습니다. 기존 데이터는 그대로 유지됩니다.', cancelText: '' }); return false;
    }
    saveNow(); return true;
  }
  async function resetSample() {
    if (!await showModal({ title: '샘플 데이터 다시 불러오기', body: '현재 데이터를 지우고 경인초등학교 5학년 2반 샘플(학생 25명·히스토리 4건)로 되돌립니다. 계속할까요?', confirmText: '샘플 불러오기', danger: true })) return;
    applyRoot(sampleRoot()); showToast('샘플 데이터를 불러왔습니다', 'success');
  }
  async function wipeAll() {
    if (!await showModal({ title: '전체 데이터 삭제 (1/2)', body: '명렬·쌍·배치·히스토리·설정을 모두 삭제합니다. 먼저 JSON으로 내보내 두셨나요?', confirmText: '다음', danger: true })) return;
    if (!await showModal({ title: '전체 데이터 삭제 (2/2)', body: '<b>정말 삭제할까요?</b> 이 작업은 되돌릴 수 없습니다.', confirmText: '영구 삭제', danger: true })) return;
    applyRoot(defaultRoot()); storage.remove('data'); ui.wiped = true; storage.set('ui', ui);   // 저장 키는 비우되 '삭제됨' 플래그로 새로고침 시 샘플 자동 복원을 막음
    showToast('모든 데이터를 삭제했습니다', 'success');
  }
  async function editClass() {
    const C = state.classInfo;
    const ok = await showModal({ title: '학급 정보', body: `<label class="field">학교명<input type="text" id="m-school" value="${esc(C.school)}" maxlength="20"></label><label class="field">학급명<input type="text" id="m-class" value="${esc(C.className)}" maxlength="20"></label><label class="field">담임<input type="text" id="m-teacher" value="${esc(C.teacher)}" maxlength="10"></label>`, confirmText: '저장', validate: (m) => { if (!$('#m-class', m).value.trim()) { showToast('학급명을 입력하세요', 'error'); return false; } C.school = $('#m-school', m).value.trim(); C.className = $('#m-class', m).value.trim(); C.teacher = $('#m-teacher', m).value.trim(); } });
    if (ok) { renderHeader(); touch(); }
  }
  // 레이아웃 복수 저장(최대 5)
  async function saveLayout() {
    if (state.layouts.length >= MAX_LAYOUTS) return showToast(`레이아웃은 최대 ${MAX_LAYOUTS}개까지 저장할 수 있습니다`, 'error');
    let name = '';
    const ok = await showModal({ title: '레이아웃 저장', body: '<label class="field">이름<input type="text" id="m-lname" placeholder="예: 수업형, 토론형, 시험형" maxlength="12"></label>', confirmText: '저장', validate: (m) => { name = $('#m-lname', m).value.trim(); if (!name) { showToast('이름을 입력하세요', 'error'); return false; } } });
    if (!ok) return; state.layouts.push({ ...JSON.parse(JSON.stringify(state.layout)), id: uid('L'), name }); state.layout.name = name; renderSeats(); touch(); showToast(`'${name}' 레이아웃을 저장했습니다`, 'success');
  }

  // ── 도움말·투어 ──
  function helpModal(tab) {
    const steps = tab ? APP_DATA.help[tab] : ['명렬 탭에서 학생·태그·분리/결합 쌍을 확인합니다.', '자리 배치 탭에서 교실 프리셋과 조건을 고르고 자동 배치를 누릅니다.', '충족 리포트를 확인하고 드래그/탭-탭으로 미세 조정합니다(Ctrl+Z 되돌리기).', '발표 모드로 TV에서 카드를 뒤집어 공개하고 배치 확정으로 히스토리에 저장합니다.', '인쇄에서 게시용·교사용 자리표, 모둠표, 책상 명패를 출력합니다.', '모둠 탭에서 모둠과 역할을 편성하고, 히스토리 탭에서 공정성을 점검합니다.'];
    const title = tab ? { roster: '명렬', seats: '자리 배치', groups: '모둠', history: '히스토리', settings: '설정' }[tab] + ' 도움말' : '자리뚝딱 사용법';
    return showModal({ title, body: `<ol class="help">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="hint"><b>단축키</b> Ctrl+Z 실행 취소 · Ctrl+Y 다시 실행(자리 배치 탭) · 발표 모드 Space 다음 카드 · Esc 종료<br><b>팁</b> 자물쇠로 고정한 학생은 다시 섞기에서도 자리를 지킵니다. 모든 데이터는 이 브라우저에만 저장되니 JSON으로 백업하세요.</p>${tab ? '' : '<button type="button" class="btn sm" data-m="cancel" data-tour="1">처음 안내(3단계) 다시 보기</button>'}`, confirmText: '닫기', cancelText: '', onOpen: (m) => { const b = $('[data-tour]', m); if (b) b.addEventListener('click', () => setTimeout(runTour, 200)); } });
  }
  // 첫 실행 투어: 한 번 띄우면(건너뛰기·Esc 포함) 다시 뜨지 않음. '다시 보지 않기'를 끄면 다음 실행 때 다시 표시
  async function runTour() {
    let noMore = true;
    for (let i = 0; i < APP_DATA.tour.length; i++) {
      const t = APP_DATA.tour[i];
      const ok = await showModal({ title: `처음 오셨군요 · ${t.title}`, body: `<p>${esc(t.body)}</p><label class="check"><input type="checkbox" id="m-nomore" ${noMore ? 'checked' : ''}> 다시 보지 않기</label>`, confirmText: i === APP_DATA.tour.length - 1 ? '시작하기' : '다음', cancelText: '건너뛰기', onOpen: (m) => { $('#m-nomore', m).addEventListener('change', e => { noMore = e.target.checked; }); } });
      if (!ok) break;
    }
    ui.tourDone = noMore; storage.set('ui', ui);
  }

  // ── 테마 ──
  function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  function toggleTheme() {
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark'; applyTheme(next); storage.set('theme', next); renderHeader();
  }

  // ── 이벤트 바인딩 ──
  function bind() {
    // 렌더(innerHTML 교체) 중 포커스된 입력이 제거되며 발생하는 중첩 change/blur 이벤트 차단(재진입 방지)
    ['change', 'input'].forEach(ev => document.addEventListener(ev, e => { if (rendering > 0 || !e.target.isConnected) e.stopImmediatePropagation(); }, true));
    // 탭
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
    $('#tabs').addEventListener('keydown', e => {   // 좌우 화살표로 탭 이동
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; const tabs = $$('#tabs [role=tab]'); const i = tabs.findIndex(t => t.dataset.tab === ui.tab);
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; setTab(n.dataset.tab); n.focus(); e.preventDefault();
    });
    // 드롭존 밖에 파일을 놓아도 페이지가 파일로 바뀌지 않게
    ['dragover', 'drop'].forEach(ev => document.addEventListener(ev, e => { if (!e.target.closest('.dropzone')) e.preventDefault(); }));
    // data-action 위임
    document.addEventListener('click', async e => {
      const b = e.target.closest('[data-action]'); if (!b || b.disabled) return; const a = b.dataset.action; const tr = b.closest('tr[data-id]'); const sid = tr ? tr.dataset.id : b.dataset.sid;
      const map = {
        'toggle-theme': toggleTheme, help: () => helpModal(), 'help-tab': () => helpModal(b.dataset.help), 'edit-class': editClass, 'go-seats': () => setTab('seats'), 'fit-zoom': () => { fitZoom(); renderSeats(); },
        'add-student': addStudent, 'del-student': () => deleteStudent(sid), 'toggle-tag': () => { const s = byId(sid); const t = b.dataset.tag; s.tags = s.tags.includes(t) ? s.tags.filter(x => x !== t) : [...s.tags, t]; lastReport = null; renderRoster(); renderSeats(); touch(); },
        'parse-paste': () => parsePaste($('#paste-area').value), 'clear-paste': () => { $('#paste-area').value = ''; pendingRows = []; renderPastePreview(); }, 'add-parsed': addParsed,
        'add-pair': () => addPair(b.dataset.type), 'del-pair': () => { const id = b.closest('[data-pid]').dataset.pid; state.pairs = state.pairs.filter(p => p.id !== id); lastReport = null; renderRoster(); renderSeats(); touch(); },
        'pair-hard': () => { const p = state.pairs.find(x => x.id === b.closest('[data-pid]').dataset.pid); p.hard = b.dataset.v === '1'; lastReport = null; renderRoster(); renderSeats(); touch(); },
        'teacher-side': () => setTeacherSide(b.dataset.v), 'cond-hard': () => { state.conditions[b.dataset.cond].hard = b.dataset.v === '1'; lastReport = null; renderSeats(); touch(); },
        'save-layout': saveLayout, 'del-layout': async () => { const sel = $('#layout-select'); const l = state.layouts.find(x => x.id === sel.value) || state.layouts[state.layouts.length - 1]; if (!l) return; if (await showModal({ title: '레이아웃 삭제', body: `'${esc(l.name)}' 레이아웃을 삭제할까요?`, confirmText: '삭제', danger: true })) { state.layouts = state.layouts.filter(x => x !== l); renderSeats(); touch(); } },
        auto: autoArrange, shuffle: autoArrange, undo: doUndo, redo: doRedo, 'confirm-arr': confirmArrangement, 'save-png': savePng, lock: () => toggleLock(sid),
        'tap-unplaced': () => { tapSel = tapSel === 'u:' + sid ? null : 'u:' + sid; renderSeats(); },
        'make-groups': makeGroupsAction, 'groups-from-seats': groupsFromSeats, 'confirm-groups': confirmGroups, 'change-role': () => changeRole(sid, Number(b.dataset.g)),
        'rename-group': async () => { const g = state.currentGroups.groups[Number(b.dataset.g)]; let nm = ''; if (await showModal({ title: '모둠 이름', body: `<input type="text" id="m-gname" value="${esc(g.name)}" maxlength="10" class="wide">`, confirmText: '저장', validate: (m) => { nm = $('#m-gname', m).value.trim(); if (!nm) { showToast('이름을 입력하세요', 'error'); return false; } } })) { g.name = nm; renderGroups(); touch(); } },
        'open-hist': () => openHistory(b.dataset.kind, b.dataset.id),
        'role-add': () => { state.settings.roles.push('새 역할'); renderSettings(); touch(); }, 'role-del': () => { state.settings.roles.splice(Number(b.dataset.i), 1); renderSettings(); touch(); },
        'role-up': () => { const r = state.settings.roles, i = Number(b.dataset.i); [r[i - 1], r[i]] = [r[i], r[i - 1]]; renderSettings(); touch(); }, 'role-down': () => { const r = state.settings.roles, i = Number(b.dataset.i); [r[i + 1], r[i]] = [r[i], r[i + 1]]; renderSettings(); touch(); },
        'export-json': exportJson, 'reset-sample': resetSample, wipe: wipeAll,
        'open-present': openPresent, 'pr-start': startPresent, 'pr-next': () => { pausePresent(); if (present.idx >= present.order.length) resetPresentCards(); flipOne(); }, 'pr-all': () => { pausePresent(); const had = present.idx < present.order.length; while (present.idx < present.order.length) flipOne(true); if (had && ui.soundOn) ding(); updatePresentBar(); },
        'pr-order': () => { ui.present.random = !ui.present.random; storage.set('ui', ui); resetPresentCards(); updatePresentBar(); }, 'pr-sound': () => { ui.soundOn = !ui.soundOn; if (ui.soundOn) ensureAudio(); storage.set('ui', ui); updatePresentBar(); }, 'pr-exit': closePresent,
        'open-print': () => openPrint(), 'close-print': closePrint, 'do-print': () => window.print(),
      };
      if (map[a]) await map[a]();
    });
    // 명렬 표 입력
    $('#roster-table').addEventListener('input', e => { const f = e.target.dataset.field; if (f !== 'name') return; const s = byId(e.target.closest('tr').dataset.id); s.name = e.target.value; e.target.classList.toggle('is-invalid', !s.name.trim()); touch(); });
    $('#roster-table').addEventListener('change', e => {
      const f = e.target.dataset.field; if (!f || !e.target.isConnected) return; const s = byId(e.target.closest('tr').dataset.id);
      if (f === 'no') { const v = Math.max(1, Math.min(99, Number(e.target.value) || s.no)); s.no = v; }
      else if (f === 'gender') s.gender = e.target.value; else if (f === 'level') s.level = e.target.value ? Number(e.target.value) : null;
      else if (f === 'active') { s.active = e.target.checked; resetUndo(); }
      else if (f === 'name') { if (!s.name.trim()) showToast('이름을 입력하세요', 'warn'); lastReport = null; renderPairs(); renderSeats(); touch(); return; }   // 이름은 input에서 이미 반영 → 표 대신 쌍 목록·요약만 갱신
      lastReport = null; renderRoster(); renderSeats(); touch();
    });
    $('#csv-file').addEventListener('change', async e => { const f = e.target.files[0]; if (f) { $('#paste-area').value = await readFile(f); parsePaste($('#paste-area').value); } e.target.value = ''; });
    bindDropzone($('#csv-drop'), async f => { $('#paste-area').value = await readFile(f); parsePaste($('#paste-area').value); });
    $('#json-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; });
    bindDropzone($('#json-drop'), importJson);
    // 교실·조건 패널
    $('#layout-panel').addEventListener('change', e => {
      const t = e.target;
      if (t.name === 'preset') rebuildLayout({ preset: t.value });
      else if (t.dataset.param) { const v = Math.max(Number(t.min), Math.min(Number(t.max), Number(t.value) || Number(t.min))); t.value = v; rebuildLayout({ params: { [t.dataset.param]: v } }); }
      else if (t.id === 'edit-mode') { ui.editMode = t.checked; tapSel = null; renderSeats(); }
      else if (t.id === 'layout-select' && t.value) { const l = state.layouts.find(x => x.id === t.value); if (l) { setLayout(JSON.parse(JSON.stringify(l))); showToast(`'${l.name}' 레이아웃으로 전환했습니다`, 'info'); } }
    });
    $('#cond-panel').addEventListener('change', e => {
      const t = e.target; const C = state.conditions;
      if (t.dataset.cond) C[t.dataset.cond].on = t.checked;
      else if (t.id === 'avoid-partner' || t.id === 'avoid-n') { const n = Math.max(1, Math.min(5, Number($('#avoid-n').value) || 3)); C.avoidPartnerPref = n; C.avoidPartnerN = $('#avoid-partner').checked ? n : 0; }   // 끌 때도 입력한 N은 보존
      else if (t.id === 'avoid-seat') C.avoidSeat = t.checked;
      lastReport = null; renderSeats(); touch();
    });
    $('#zoom').addEventListener('input', e => { ui.zoom = Number(e.target.value); ui.zoomManual = true; fitOnShow = false; $('#seatmap-wrap').style.setProperty('--cell', ui.zoom + 'px'); storage.set('ui', ui); });
    // 좌석표: 편집 모드 클릭(책상 켜기/끄기) + 드래그/탭-탭
    $('#seatmap').addEventListener('click', e => {
      const seat = e.target.closest('.seat'); if (!seat || e.target.closest('button')) return;
      if (ui.editMode) { toggleDesk(seat.dataset.key); return; }
      if (seat.classList.contains('empty') && tapSel) seatTap(seat.dataset.key);   // 채워진 카드는 makeDraggable의 onTap이 처리
    });
    makeDraggable($('#seatmap'), { itemSel: '.seat-card[data-drag]', targetSel: '.seat:not(.off)', canDrag: () => !ui.editMode,
      onDrop: (item, tg) => { tapSel = null; swapSeats(item.closest('.seat').dataset.key, tg.dataset.key); },
      onTap: (item) => seatTap(item.closest('.seat').dataset.key) });
    // 모둠: 멤버 드래그/탭-탭
    let gTap = null;
    makeDraggable($('#group-grid'), { itemSel: '.member[data-sid]', targetSel: '.group-card[data-g]',
      onDrop: (item, tg) => { gTap = null; moveMember(item.dataset.sid, Number(item.dataset.g), Number(tg.dataset.g)); },
      onTap: (item) => { $$('#group-grid .member.tap-sel').forEach(x => x.classList.remove('tap-sel')); if (gTap && gTap.sid !== item.dataset.sid) { const from = gTap; gTap = null; if (from.g !== Number(item.dataset.g)) { moveMember(from.sid, from.g, Number(item.dataset.g)); moveMember(item.dataset.sid, Number(item.dataset.g), from.g); } } else if (gTap) gTap = null; else { gTap = { sid: item.dataset.sid, g: Number(item.dataset.g) }; item.classList.add('tap-sel'); } } });
    $('#group-grid').addEventListener('click', e => { const card = e.target.closest('.group-card'); if (gTap && card && !e.target.closest('.member')) { const from = gTap; gTap = null; moveMember(from.sid, from.g, Number(card.dataset.g)); } });
    $('#group-options').addEventListener('change', () => readGroupOpts());
    $('#hist-filter').addEventListener('click', e => { const c = e.target.closest('[data-filter]'); if (c) { ui.histFilter = c.dataset.filter; storage.set('ui', ui); renderHistory(); } });
    // 설정 입력
    const setRoot = $('[data-view=settings]');
    setRoot.addEventListener('change', e => {
      const t = e.target; const S = state.settings;
      if (t.dataset.roleI != null) {   // 역할 이름 변경: 과거 모둠 기록·현재 편성의 역할 문자열도 함께 바꿔 경험 횟수 집계 유지
        const v = t.value.trim(), i = Number(t.dataset.roleI), old = S.roles[i]; if (!v) { showToast('역할 이름을 입력하세요', 'warn'); t.value = old; return; }
        S.roles[i] = v; [...state.groupHistory, state.currentGroups].filter(Boolean).forEach(gp => gp.groups.forEach(g => g.members.forEach(m => { if (m.role === old) m.role = v; }))); renderGroups();
      }
      else if (t.dataset.gnameI != null) { S.groupNames[Number(t.dataset.gnameI)] = t.value.trim() || `${Number(t.dataset.gnameI) + 1}모둠`; }
      else if (t.dataset.gcolorI != null) S.groupColors[Number(t.dataset.gcolorI)] = t.value;
      else if (t.id === 's-avoid') { S.avoidN = Math.max(1, Math.min(5, Number(t.value) || 3)); ui.groupOpts.avoidN = S.avoidN; }
      else if (t.id === 's-flip') S.flipIntervalMs = Math.max(200, Math.min(3000, Number(t.value) || 700));
      else if (t.id === 's-sound') { S.sound = t.checked; ui.soundOn = t.checked; }
      else return;
      renderSettings(); touch();
    });
    // 인쇄 패널
    $('#print-panel').addEventListener('change', e => { if (e.target.closest('.print-side')) renderPrint(); });
    // 창 크기·기기 방향이 바뀔 때(새로고침 없이): 600px 경계를 넘으면 교실·조건 패널을 접거나 펼치고, 자동 맞춤 상태면 좌석표를 폭에 다시 맞춤
    const mq = matchMedia(MOBILE_MQ);
    mq.addEventListener('change', () => { $$('.panel').forEach(d => { d.open = !mq.matches; }); if (!ui.zoomManual) { fitZoom(); applyZoom(); } });
    const refitOnResize = debounce(() => { const w = $('#seatmap-wrap'); if (ui.zoomManual || $('#view-seats').hidden || w.scrollWidth <= w.clientWidth + 1) return; fitZoom(); applyZoom(); }, 150);   // 자동 맞춤 상태에서 좌석표가 폭을 넘치면 다시 맞춤
    window.addEventListener('resize', () => { if (!$('#print-panel').hidden) scalePrintPreview(); if (present.active) fitPresent(); refitOnResize(); });
    window.addEventListener('beforeprint', () => { if ($('#print-panel').hidden) { autoPrint = true; openPrint(); } });
    window.addEventListener('afterprint', () => { if (autoPrint) { autoPrint = false; closePrint(); } });   // Ctrl+P로 자동 열린 패널은 인쇄 후 닫음
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && present.active) closePresent(); else if (present.active) setTimeout(fitPresent, 50); });
    // 키보드: Ctrl+Z/Y, 발표 모드 Space/Esc, 인쇄 Esc
    document.addEventListener('keydown', e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
      if (present.active) { if (e.key === ' ') { e.preventDefault(); if (document.activeElement) document.activeElement.blur(); pausePresent(); if (present.idx >= present.order.length) resetPresentCards(); flipOne(); } else if (e.key === 'Escape') closePresent(); return; }
      if (e.key === 'Escape' && !$('#print-panel').hidden) { closePrint(); return; }
      if (typing || $('#modal-root').children.length) return;
      const onSeats = ui.tab === 'seats';            // 좌석 Undo/Redo는 자리 배치 탭에서만
      if (onSeats && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
      else if (onSeats && (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); doRedo(); }
      else if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('#seatmap .seat')) {   // 키보드: 카드·빈 책상 선택/교환, 편집 모드 켜기/끄기
        const seat = e.target.closest('.seat'); if (e.target.closest('button')) return; e.preventDefault();
        if (ui.editMode) toggleDesk(seat.dataset.key); else seatTap(seat.dataset.key);
      }
    });
  }

  // ── 초기화 ──
  function init() {
    applyTheme(storage.get('theme', null));
    const savedUi = storage.get('ui', null); if (savedUi) ui = { ...ui, ...savedUi, present: { ...ui.present, ...(savedUi.present || {}) } };
    const saved = storage.get('data', null);
    applyRoot(saved && !validateRoot(saved) ? saved : (ui.wiped ? defaultRoot() : sampleRoot()), true);   // 저장 데이터 없음·손상 → 샘플(전체 삭제 직후면 빈 학급)
    if (!storageOk) { showToast('브라우저 저장소를 사용할 수 없어 메모리 모드로 동작합니다', 'warn', 4000); }
    ui.soundOn = ui.soundOn || state.settings.sound; ui.editMode = false;
    if (matchMedia(MOBILE_MQ).matches) { $$('.panel').forEach(d => { d.open = false; }); if (!ui.zoomManual) fitOnShow = true; }   // 좁은 화면: 패널 접고 좌석표를 폭에 맞춤
    bind(); renderAll();
    if (!ui.tourDone) setTimeout(runTour, 400);
  }

  // ── 테스트·디버그용 공개 API(읽기 전용 스냅샷 + 주요 액션) ──
  window.__app = {
    version: VERSION,
    getState: () => JSON.parse(JSON.stringify({ state, ui, undo: { past: undo.past.length, future: undo.future.length }, report: lastReport && { penalty: lastReport.penalty, items: lastReport.items, suggestions: lastReport.suggestions }, present: { active: present.active, idx: present.idx, total: present.order.length, running: present.running } })),
    actions: { autoArrange, shuffle: autoArrange, swapSeats, placeStudent, toggleLock, undo: doUndo, redo: doRedo, confirmArrangement, setTab, rebuildLayout, toggleDesk, makeGroups: makeGroupsAction, groupsFromSeats, confirmGroups, openPresent, closePresent, startPresent, flipOne, openPrint, closePrint, savePng, exportJson, importRoot: applyRoot, resetSample: () => applyRoot(sampleRoot()), wipe: () => applyRoot(defaultRoot()), parseRoster: parsePaste, addParsed, addPair, addStudent, computeReport, setCondition: (k, v) => { Object.assign(state.conditions[k], v); lastReport = null; renderSeats(); touch(); }, toggleTheme },
  };

  document.addEventListener('DOMContentLoaded', init);
})();
