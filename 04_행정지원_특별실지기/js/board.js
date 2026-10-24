'use strict';
/* 특별실지기 — board.js
   예약판(자원 칩·주 내비·요일×교시 격자), 드래그 범위 선택, 예약 등록/수정 모달(실시간 충돌 검사·대안 칩),
   정기 예약 미리보기·생성, 미확인 예약 일괄 체크, 주간 이용 현황표 인쇄 미리보기 */
SRB.board = (() => {
  const S = SRB; const esc = S.escapeHtml;
  const view = () => S.$('[data-view="board"]');
  const isMobile = () => window.matchMedia(S.MOBILE_Q).matches;
  const DRAG_THRESHOLD = 5; // px 미만 이동은 클릭으로 처리

  // 선택 자원(비활성이면 첫 활성 자원으로 교정)
  function currentResource() {
    const act = S.state.data.resources.filter(r => r.active); if (!act.length) return null;
    let r = act.find(x => x.id === S.state.ui.selectedResourceId);
    if (!r) { r = act[0]; S.state.ui.selectedResourceId = r.id; S.saveUi(); }
    return r;
  }
  // 주 시작일 보정(없거나 학기 밖이면 오늘 주 → 학기 첫 주)
  function ensureWeek() {
    const s = S.state.data.settings; const ui = S.state.ui;
    if (ui.weekStart && S.isValidDate(ui.weekStart)) return;
    const t = S.todayStr();
    if (S.inSemester(t)) ui.weekStart = S.mondayOf(t);
    else { ui.weekStart = S.mondayOf(s.semesterStart); if (S.state.data.resources.length) S.showToast('오늘이 학기 밖이라 학기 첫 주로 이동했습니다.', 'info'); }
    S.saveUi();
  }
  const weekDays = () => [0, 1, 2, 3, 4].map(i => S.addDays(S.state.ui.weekStart, i));
  const pastUnchecked = () => { const t = S.todayStr(); return S.state.data.bookings.filter(b => b.date < t && b.used == null); };

  // ───────── 예약판 렌더
  function renderBoard() {
    const root = view(); const d = S.state.data; const s = d.settings; ensureWeek();
    const active = d.resources.filter(r => r.active);
    if (!active.length) {
      root.innerHTML = `<div class="empty card"><h2>자원을 먼저 등록하세요</h2><p>과학실·강당 같은 특별실이나 태블릿 세트 같은 기자재를 '특별실·기자재' 탭에서 추가하면 요일×교시 예약판이 그려집니다.</p>
        <div class="row"><button type="button" class="btn btn-primary" data-act="go-resources">특별실·기자재 탭으로 이동</button><button type="button" class="btn" data-act="load-sample">샘플 데이터로 시작</button></div></div>`;
      return;
    }
    const res = currentResource(); const days = weekDays(); const mon = days[0]; const t = S.todayStr();
    const out = days[4] < s.semesterStart || mon > s.semesterEnd;
    const chips = active.map(r => `<button type="button" class="chip${r.id === res.id ? ' on' : ''}" data-resource="${r.id}" aria-pressed="${r.id === res.id}"><i style="background:${esc(r.color)}"></i>${esc(r.name)}${r.type === 'equipment' ? `<small>×${r.quantity}</small>` : ''}</button>`).join('');
    const unchecked = pastUnchecked().length;
    const weekBookings = days.reduce((a, dt) => a + S.bookingsAt(res.id, dt).length, 0);
    const mobile = isMobile(); const dayTabs = mobile ? `<div class="day-tabs" role="tablist">${days.map((dt, i) => `<button type="button" role="tab" class="${S.state.ui.mobileDay === i + 1 ? 'on' : ''}" aria-selected="${S.state.ui.mobileDay === i + 1}" data-day-tab="${i + 1}">${S.DAY_KO[i + 1]}<small>${S.fmtMD(dt)}</small></button>`).join('')}</div>` : '';
    const grid = gridHTML(res, mobile ? [days[S.clamp(S.state.ui.mobileDay, 1, 5) - 1]] : days);
    root.innerHTML = `
      <div class="chips-row" aria-label="자원 선택">${chips}</div>
      <div class="board-head">
        <div class="week-nav">
          <button type="button" class="btn btn-sm" data-act="prev-week" aria-label="이전 주">◀</button>
          <button type="button" class="btn btn-sm" data-act="this-week">이번 주</button>
          <button type="button" class="btn btn-sm" data-act="next-week" aria-label="다음 주">▶</button>
          <input type="date" class="input" data-act="pick-week" value="${mon}" aria-label="주 선택">
          <span class="week-label"><b>${S.weekLabel(mon)}</b> ${S.fmtMD(mon)}~${S.fmtMD(days[4])}</span>
        </div>
        <div class="row"><button type="button" class="btn" data-act="series">정기 예약</button><button type="button" class="btn" data-act="print-week">인쇄</button></div>
      </div>
      <div class="res-title"><span class="dot" style="background:${esc(res.color)}"></span><h2>${esc(res.name)}</h2><span class="muted">${res.type === 'equipment' ? `수량형 · 보유 ${res.quantity}` : `공간형${res.capacity ? ` · 수용 ${res.capacity}명` : ''}`}${res.manager ? ` · 담당 ${esc(res.manager)}` : ''}</span>${res.notice ? `<span class="notice">${esc(res.notice)}</span>` : ''}</div>
      ${out ? '<p class="notice-bar">학기 기간 밖의 주입니다. 예약을 저장할 수 없습니다.</p>' : ''}
      ${dayTabs}
      <div class="grid-wrap${out ? ' dim' : ''}">${grid}</div>
      <div class="board-foot">
        <p class="summary">이번 주 예약 <b>${weekBookings}</b>건 · 빈 교시 <b>${countFree(res, days)}</b>칸${unchecked ? ` · <button type="button" class="link" data-act="unchecked">지난 예약 미확인 ${unchecked}건</button>` : ''}</p>
        <ul class="legend">${[1, 2, 3, 4, 5, 6].map(g => `<li><i class="sw g${g}"></i>${g}학년</li>`).join('')}<li><i class="sw blocked"></i>행사 차단</li><li><i class="sw closed"></i>휴업일</li><li><i class="sw conf"></i>차단과 충돌</li></ul>
      </div>`;
    if (!mobile) root.querySelectorAll('.grid').forEach(g => { g.style.touchAction = 'none'; });
  }
  const countFree = (res, days) => { let n = 0; for (const dt of days) for (const p of S.periodKeys()) if (cellState(res, dt, p).free) n++; return n; };

  // 셀 상태 계산(휴업·차단·사용 불가·사용량)
  function cellState(res, date, p) {
    const closed = S.closureOn(date); const blk = S.blockAt(res.id, date, p); const unavail = !res.availablePeriods.includes(p);
    const list = S.bookingsAt(res.id, date).filter(b => b.periodStart <= p && p <= b.periodEnd);
    const used = S.sum(list.map(b => b.qty || 1)); const cap = res.type === 'room' ? 1 : res.quantity;
    const full = used >= cap;
    return { closed, blk, unavail, list, used, cap, full, free: !closed && !blk && !unavail && !full && S.inSemester(date) };
  }
  // 격자 HTML(CSS Grid, 셀은 data-day/data-period, 공간형 블록은 grid-row span)
  function gridHTML(res, cols) {
    const keys = S.periodKeys(); const t = S.todayStr();
    let h = `<div class="grid" style="--cols:${cols.length}" role="group" aria-label="${esc(res.name)} 주간 예약 격자"><div class="gh corner">교시</div>`;
    cols.forEach((date, ci) => {
      const closed = S.closureOn(date);
      h += `<div class="gh day${date === t ? ' is-today' : ''}${closed ? ' closed' : ''}" style="grid-column:${ci + 2};grid-row:1"><b>${S.DAY_KO[S.dayOfWeek(date)]}</b><span>${S.fmtMD(date)}</span>${closed ? `<em>${esc(closed.title)}</em>` : ''}</div>`;
    });
    const lastBlk = {}; // 열마다 직전 교시의 차단 행사(연속 차단 셀은 첫 셀에만 사유 표기)
    keys.forEach((p, ri) => {
      const po = S.periodObj(p);
      h += `<div class="ph" style="grid-row:${ri + 2}"><b>${esc(po.label)}</b><span>${esc(po.time || '')}</span></div>`;
      cols.forEach((date, ci) => {
        const st = cellState(res, date, p);
        let cls = 'cell'; if (st.closed) cls += ' closed'; if (st.blk) cls += ' blocked'; if (st.unavail) cls += ' unavail'; if (st.full) cls += ' full'; if (st.free) cls += ' free'; if (date === t) cls += ' is-today';
        let inner = '';
        if (st.blk) { if (!lastBlk[ci] || lastBlk[ci] !== st.blk) inner += `<span class="blk-label">■ ${esc(st.blk.title)}</span>`; }
        else if (st.unavail && !st.closed) inner += '<span class="blk-label muted">사용 불가</span>';
        lastBlk[ci] = st.blk;
        if (res.type === 'equipment' && !st.closed && st.list.length) {
          const over = st.used > st.cap;
          inner += st.list.map(b => `<button type="button" class="eq-chip g${S.gradeOf(b.classId || b.customLabel)}${st.blk || over ? ' conflict' : ''}" data-booking-id="${esc(b.id)}" title="${esc(S.bookingShort(b))} ${esc(b.tag)}${b.memo ? ` · ${esc(b.memo)}` : ''}"><b>${esc(S.classLabel(b))}</b> ${esc(S.teacherName(b.teacherId))}<small>${esc(b.tag)}${(b.qty || 1) > 1 ? ` ×${b.qty}` : ''}</small></button>`).join('');
          inner += `<span class="left${st.full ? ' full' : ''}">${over ? `${st.used}/${st.cap} 초과` : st.full ? `${st.used}/${st.cap} 사용 중` : `잔여 ${st.cap - st.used}`}</span>`;
        }
        const a11y = st.free ? ` tabindex="0" role="button" aria-label="${S.fmtMDW(date)} ${esc(po.label)} 예약"` : '';
        h += `<div class="${cls}" data-day="${S.dayOfWeek(date)}" data-date="${date}" data-period="${p}" style="grid-column:${ci + 2};grid-row:${ri + 2}"${a11y}>${inner}</div>`;
      });
    });
    if (res.type === 'room') cols.forEach((date, ci) => {
      const placed = []; // 같은 열에서 교시가 겹치는 예약(병합·강제 생성으로 생긴 초과 예약)은 비켜 쌓고 '중복' 배지
      const list = S.bookingsAt(res.id, date).slice().sort((x, y) => x.periodStart - y.periodStart || (x.createdAt || 0) - (y.createdAt || 0));
      for (const b of list) {
        const si = keys.indexOf(b.periodStart), ei = keys.indexOf(b.periodEnd); if (si < 0 && ei < 0) continue;
        const a = si < 0 ? 0 : si, z = ei < 0 ? keys.length - 1 : ei;
        let conflict = !!S.closureOn(date); for (let p = b.periodStart; p <= b.periodEnd && !conflict; p++) if (S.blockAt(res.id, date, p)) conflict = true;
        const lane = placed.filter(x => x.periodStart <= b.periodEnd && b.periodStart <= x.periodEnd).length; placed.push(b);
        h += `<button type="button" class="block g${S.gradeOf(b.classId || b.customLabel)}${conflict || lane ? ' conflict' : ''}${lane ? ' dup' : ''}${b.date < t ? ' past' : ''}" data-booking-id="${esc(b.id)}" data-day="${S.dayOfWeek(date)}" style="grid-column:${ci + 2};grid-row:${a + 2} / span ${z - a + 1};--lane:${lane}" title="${esc(S.bookingShort(b))} · ${esc(b.tag)}${b.memo ? ` · ${esc(b.memo)}` : ''}${lane ? ' · 같은 교시에 다른 예약과 겹침' : ''}">
          <b>${esc(S.classLabel(b))} ${esc(S.teacherName(b.teacherId))}</b><span>${esc(b.tag)}${b.seriesId ? ' · 정기' : ''}</span>${lane ? '<i class="badge badge-danger">중복</i>' : conflict ? '<i class="badge badge-danger">충돌</i>' : ''}${b.used === false ? '<i class="badge badge-warn">미사용</i>' : b.used === true ? '<i class="badge badge-ok">사용</i>' : ''}</button>`;
      }
    });
    return h + '</div>';
  }

  // ───────── 드래그 범위 선택(Pointer Events)
  let drag = null; let suppressClick = false;
  function clearSel(root) { S.$$('.cell.sel', root).forEach(c => c.classList.remove('sel')); }
  function applySel(root, day, lo, hi) {
    clearSel(root);
    S.$$(`.cell[data-day="${day}"]`, root).forEach(c => { const p = Number(c.dataset.period); if (p >= lo && p <= hi) c.classList.add('sel'); });
  }
  function onPointerDown(e) {
    const cell = e.target.closest('.cell'); if (!cell || e.button !== 0 || !cell.classList.contains('free')) return;
    if (e.pointerType === 'touch' && isMobile()) return; // 모바일 터치는 탭만
    drag = { root: cell.closest('.grid'), day: cell.dataset.day, date: cell.dataset.date, anchor: Number(cell.dataset.period), range: null, moved: false, x: e.clientX, y: e.clientY, warned: false };
    try { cell.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  }
  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const el = document.elementFromPoint(e.clientX, e.clientY); const c = el && el.closest('.cell');
    const warn = () => { if (!drag.warned) { drag.warned = true; S.showToast('예약·차단된 교시를 지나 선택할 수 없습니다.', 'warn', 1800); } };
    if (!c) { const blk = el && el.closest('.block'); if (blk && blk.dataset.day === drag.day) warn(); return; } // 같은 열의 예약 블록 위
    if (c.dataset.day !== drag.day) return;
    const p = Number(c.dataset.period); const lo = Math.min(p, drag.anchor), hi = Math.max(p, drag.anchor);
    const cells = S.$$(`.cell[data-day="${drag.day}"]`, drag.root).filter(x => { const k = Number(x.dataset.period); return k >= lo && k <= hi; });
    if (cells.every(x => x.classList.contains('free'))) { drag.range = [lo, hi]; drag.warned = false; applySel(drag.root, drag.day, lo, hi); }
    else warn();
  }
  function onPointerUp(e) {
    if (!drag) return; const dg = drag; drag = null; clearSel(dg.root);
    if (!dg.moved) return;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 300);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.closest('.grid')) { S.showToast('격자 밖에서 놓아 선택을 취소했습니다.', 'info', 1500); return; } // 격자 밖 → 선택 해제
    const [lo, hi] = dg.range || [dg.anchor, dg.anchor];
    openBookingModal({ resourceId: currentResource().id, date: dg.date, pStart: lo, pEnd: hi });
  }
  function onPointerCancel() { if (drag) { clearSel(drag.root); drag = null; } }

  // ───────── 이벤트 위임
  function initBoard() {
    const root = view();
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerCancel);
    root.addEventListener('click', e => {
      const chip = e.target.closest('.chip[data-resource]');
      if (chip) { S.state.ui.selectedResourceId = chip.dataset.resource; S.saveUi(); renderBoard(); return; }
      const bk = e.target.closest('[data-booking-id]');
      if (bk) { const b = S.state.data.bookings.find(x => x.id === bk.dataset.bookingId); if (b) openBookingModal({ booking: b }); return; }
      const tab = e.target.closest('[data-day-tab]');
      if (tab) { S.state.ui.mobileDay = Number(tab.dataset.dayTab); S.saveUi(); renderBoard(); return; }
      const cell = e.target.closest('.cell.free');
      if (cell) { if (!suppressClick) openBookingModal({ resourceId: currentResource().id, date: cell.dataset.date, pStart: Number(cell.dataset.period), pEnd: Number(cell.dataset.period) }); return; }
      const act = e.target.closest('[data-act]'); if (!act) return;
      const ui = S.state.ui;
      switch (act.dataset.act) {
        case 'prev-week': ui.weekStart = S.addDays(ui.weekStart, -7); S.saveUi(); renderBoard(); break;
        case 'next-week': ui.weekStart = S.addDays(ui.weekStart, 7); S.saveUi(); renderBoard(); break;
        case 'this-week': ui.weekStart = S.mondayOf(S.todayStr()); S.saveUi(); renderBoard(); break;
        case 'series': openSeriesModal(); break;
        case 'print-week': openWeeklyPrint(); break;
        case 'unchecked': openUncheckedModal(); break;
        case 'go-resources': S.selectTab('resources'); break;
        case 'load-sample': S.loadSample(); break;
        default: break;
      }
    });
    root.addEventListener('change', e => {
      if (e.target.matches('[data-act="pick-week"]') && S.isValidDate(e.target.value)) { S.state.ui.weekStart = S.mondayOf(e.target.value); S.saveUi(); renderBoard(); }
    });
    root.addEventListener('keydown', e => {
      const cell = e.target.closest('.cell.free'); if (!cell || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault(); openBookingModal({ resourceId: currentResource().id, date: cell.dataset.date, pStart: Number(cell.dataset.period), pEnd: Number(cell.dataset.period) });
    });
    window.matchMedia(S.MOBILE_Q).addEventListener('change', () => { if (S.state.ui.tab === 'board' && S.state.data) renderBoard(); });
  }

  // ───────── 예약 모달(등록·수정)
  const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
  function classOptions(sel) {
    let h = opt('', '학급 선택', !sel) + S.sortedClasses().map(c => opt(c.id, `${c.id} (${S.teacherName(c.teacherId) || '담임 미지정'})`, sel === c.id)).join('');
    h += `<optgroup label="학년 전체">${[1, 2, 3, 4, 5, 6].map(g => opt(`grade:${g}`, `${g}학년 전체`, sel === `grade:${g}`)).join('')}</optgroup>`;
    return h + opt('custom', '기타 직접 입력', sel === 'custom');
  }
  function openBookingModal(init) {
    const d = S.state.data; const b = init.booking || null; const isEdit = !!b; const t = S.todayStr();
    const f = b ? {
      resourceId: b.resourceId, date: b.date, pStart: b.periodStart, pEnd: b.periodEnd, classSel: b.classId || (b.customLabel ? (/^\d학년 전체$/.test(b.customLabel) ? `grade:${b.customLabel[0]}` : 'custom') : ''),
      customLabel: b.customLabel || '', teacherId: b.teacherId || '', tag: b.tag || '기타', qty: b.qty || 1, memo: b.memo || '', used: b.used == null ? null : b.used,
    } : { resourceId: init.resourceId, date: init.date, pStart: init.pStart, pEnd: init.pEnd, classSel: '', customLabel: '', teacherId: '', tag: '실험', qty: 1, memo: '', used: null };
    const keys = S.periodKeys(); const pOpts = sel => keys.map(k => opt(k, `${S.periodLabel(k)} ${S.periodObj(k).time || ''}`.trim(), k === sel)).join('');
    const body = document.createElement('form'); body.className = 'form'; body.noValidate = true;
    body.innerHTML = `
      <div class="form-grid">
        <label>자원<select name="resourceId">${d.resources.filter(r => r.active || r.id === f.resourceId).map(r => opt(r.id, `${r.name}${r.type === 'equipment' ? ` (보유 ${r.quantity})` : ''}`, r.id === f.resourceId)).join('')}</select></label>
        <label>날짜<input type="date" name="date" value="${f.date}" required></label>
        <label>시작 교시<select name="pStart">${pOpts(f.pStart)}</select></label>
        <label>끝 교시<select name="pEnd">${pOpts(f.pEnd)}</select></label>
        <label>학급<select name="classSel">${classOptions(f.classSel)}</select></label>
        <label>교사<select name="teacherId">${opt('', '교사 선택', !f.teacherId)}${d.teachers.map(x => opt(x.id, `${x.name} (${x.role})`, x.id === f.teacherId)).join('')}</select></label>
        <label class="custom-wrap" hidden>직접 입력(동아리·외부 강사 등)<input name="customLabel" maxlength="20" value="${esc(f.customLabel)}" placeholder="예: 방송부"></label>
        <label class="qty-wrap" hidden>사용 수량<input type="number" name="qty" min="1" step="1" value="${f.qty}"></label>
      </div>
      <div class="field"><span class="lbl">활동 태그</span><div class="chips tag-chips">${S.TAGS.map(x => `<button type="button" class="chip${x === f.tag ? ' on' : ''}" data-tag="${x}" aria-pressed="${x === f.tag}">${x}</button>`).join('')}</div></div>
      <label>메모<input name="memo" maxlength="60" value="${esc(f.memo)}" placeholder="준비물·특이사항(선택)"></label>
      <div class="field used-wrap" hidden><span class="lbl">사용 여부(지난 예약)</span><div class="seg">
        <button type="button" data-used="null">미확인</button><button type="button" data-used="true">실제 사용함</button><button type="button" data-used="false">사용 안 함</button></div></div>
      <p class="series-note muted" hidden></p>
      <div class="verdict"><div class="validate" aria-live="polite"></div><div class="alts"></div></div>`;
    const footer = `<button type="button" class="btn" data-result="">취소</button>${isEdit ? '<button type="button" class="btn btn-danger-outline" data-act="delete">삭제</button>' : ''}<button type="button" class="btn btn-primary" data-act="save">저장</button>`;
    const m = S.openModal({ title: isEdit ? '예약 수정' : '예약 등록', body, footer, cls: 'modal-lg' });
    const q = n => body.elements[n]; const saveBtn = S.$('[data-act="save"]', m.foot);
    if (b && b.seriesId) { const sr = d.series.find(x => x.id === b.seriesId); const note = S.$('.series-note', body); note.hidden = false; note.textContent = sr ? `매주 ${S.DAY_KO[sr.weekday]} ${S.rangeLabel(sr.periodStart, sr.periodEnd)} 정기 예약 시리즈(${S.fmtMD(sr.dateFrom)}~${S.fmtMD(sr.dateTo)})에 속한 건입니다.` : '정기 예약 시리즈에 속한 건입니다.'; }
    let last = null; let touched = isEdit; // 마지막 검증 결과 · 사용자가 입력을 시작했는지(미입력 안내를 빨간 오류로 보이지 않게)
    // 폼 값 읽기·정규화(끝<시작 교정, 수량 클램프)
    const read = () => {
      f.resourceId = q('resourceId').value; f.date = q('date').value; f.pStart = Number(q('pStart').value); f.pEnd = Number(q('pEnd').value);
      if (f.pEnd < f.pStart) { f.pEnd = f.pStart; q('pEnd').value = f.pStart; }
      f.classSel = q('classSel').value; f.customLabel = q('customLabel').value.trim(); f.teacherId = q('teacherId').value; f.memo = q('memo').value.trim();
      const res = S.resourceById(f.resourceId); const eq = res && res.type === 'equipment';
      S.$('.qty-wrap', body).hidden = !eq; S.$('.custom-wrap', body).hidden = f.classSel !== 'custom';
      if (eq) { q('qty').max = res.quantity; const v = Math.floor(Number(q('qty').value)); f.qty = S.clamp(isNaN(v) ? 1 : v, 1, res.quantity); if (String(f.qty) !== q('qty').value) q('qty').value = f.qty; } else f.qty = 1;
      const usedWrap = S.$('.used-wrap', body); usedWrap.hidden = !(isEdit && f.date < t);
      S.$$('[data-used]', usedWrap).forEach(x => x.classList.toggle('on', String(f.used) === x.dataset.used));
    };
    const classIdOf = () => (f.classSel && f.classSel !== 'custom' && !f.classSel.startsWith('grade:')) ? f.classSel : '';
    const labelOf = () => f.classSel === 'custom' ? f.customLabel : f.classSel.startsWith('grade:') ? `${f.classSel.split(':')[1]}학년 전체` : '';
    // 검증 + 대안 칩 갱신
    const validate = () => {
      read(); const res = S.resourceById(f.resourceId);
      const c = S.checkConflict(res, f.date, f.pStart, f.pEnd, f.qty, b ? b.id : null, classIdOf() || labelOf()); last = c;
      const formErr = [];
      if (!classIdOf() && !labelOf()) formErr.push('학급(또는 직접 입력)을 선택하세요');
      if (!f.teacherId) formErr.push('교사를 선택하세요');
      const box = S.$('.validate', body); const alts = S.$('.alts', body);
      const remain = c.remaining.length ? `<p class="muted">교시별 잔여: ${c.remaining.map(x => `${S.periodLabel(x.p)} 잔여 ${x.left}`).join(', ')}</p>` : '';
      const slot = `${S.fmtMDW(f.date)} ${S.rangeLabel(f.pStart, f.pEnd)}${res ? ` · ${esc(res.name)}` : ''}`;
      if (c.ok && !formErr.length) box.innerHTML = `<div class="ok"><b>예약 가능</b> · ${slot}</div>${remain}`;
      else if (c.ok && !touched) box.innerHTML = `<div class="hint"><b>자리는 비어 있습니다</b> · ${slot}<br>학급과 교사를 고르면 저장할 수 있습니다.</div>${remain}`;
      else box.innerHTML = `<div class="bad"><b>${c.ok ? '입력을 확인하세요' : '예약할 수 없습니다'}</b><ul>${c.reasons.concat(touched ? formErr : []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>${remain}`;
      if (c.warnings.length) box.innerHTML += `<div class="warn">${c.warnings.map(esc).join('<br>')}</div>`;
      const list = c.ok ? [] : S.suggestAlternatives({ resourceId: f.resourceId, date: f.date, pStart: f.pStart, pEnd: f.pEnd, qty: f.qty, excludeId: b ? b.id : null, classId: classIdOf() });
      alts.innerHTML = list.length ? `<span class="lbl">대안</span>${list.map((a, i) => `<button type="button" class="chip alt" data-alt="${i}">${esc(a.label)}</button>`).join('')}` : '';
      alts._list = list;
      saveBtn.disabled = !c.ok || formErr.length > 0;
    };
    body.addEventListener('input', () => { touched = true; validate(); }); body.addEventListener('change', e => {
      if (e.target.name === 'classSel') { const cls = S.classById(e.target.value); if (cls && cls.teacherId) q('teacherId').value = cls.teacherId; }
      touched = true; validate();
    });
    body.addEventListener('submit', e => e.preventDefault());
    body.addEventListener('click', e => {
      const tg = e.target.closest('[data-tag]'); if (tg) { f.tag = tg.dataset.tag; S.$$('[data-tag]', body).forEach(x => { x.classList.toggle('on', x === tg); x.setAttribute('aria-pressed', x === tg); }); return; }
      const us = e.target.closest('[data-used]'); if (us) { f.used = us.dataset.used === 'null' ? null : us.dataset.used === 'true'; validate(); return; }
      const alt = e.target.closest('[data-alt]'); if (alt) {
        const a = S.$('.alts', body)._list[Number(alt.dataset.alt)]; if (!a) return;
        q('resourceId').value = a.patch.resourceId; q('date').value = a.patch.date; q('pStart').value = a.patch.pStart; q('pEnd').value = a.patch.pEnd; validate();
        S.showToast(`대안 '${a.label}'을 적용했습니다.`, 'info', 1500);
      }
    });
    m.foot.addEventListener('click', async e => {
      const act = e.target.closest('[data-act]'); if (!act) return;
      if (act.dataset.act === 'save') {
        touched = true; validate(); if (saveBtn.disabled) return;
        const now = Date.now(); const payload = { resourceId: f.resourceId, date: f.date, periodStart: f.pStart, periodEnd: f.pEnd, classId: classIdOf(), customLabel: labelOf(), teacherId: f.teacherId, tag: f.tag, qty: f.qty, memo: f.memo, used: f.date < t ? f.used : null, updatedAt: now };
        if (isEdit) Object.assign(b, payload); else d.bookings.push(Object.assign({ id: S.uid('b'), seriesId: null, createdAt: now }, payload));
        S.save(); m.close('saved'); S.showToast(isEdit ? '예약이 수정되었습니다.' : '예약되었습니다.', 'success'); S.render();
      } else if (act.dataset.act === 'delete') {
        const n = await deleteBookingFlow(b); if (n) { m.close('deleted'); S.render(); }
      }
    });
    validate();
    return m.done;
  }
  // 삭제 흐름(단건 확인 / 시리즈 범위 선택). 삭제 건수 반환
  async function deleteBookingFlow(b) {
    let scope = 'one';
    if (b.seriesId) {
      const mm = S.openModal({ title: '정기 예약 삭제 범위', body: `<p>${S.fmtKo(b.date)} ${S.rangeLabel(b.periodStart, b.periodEnd)} 예약은 정기 예약 시리즈에 속해 있습니다. 어디까지 삭제할까요?</p>`,
        footer: '<button type="button" class="btn" data-result="">취소</button><button type="button" class="btn" data-result="one">이 건만</button><button type="button" class="btn" data-result="after">이 날짜 이후 모두</button><button type="button" class="btn btn-danger" data-result="all">시리즈 전체</button>' });
      scope = await mm.done; if (!scope) return 0;
    } else if (!(await S.showModal({ title: '예약 삭제', body: `<p><b>${esc(S.bookingShort(b))}</b> · ${S.fmtKo(b.date)} ${S.rangeLabel(b.periodStart, b.periodEnd)} 예약을 삭제할까요?</p>`, confirmText: '삭제', danger: true }))) return 0;
    const n = S.deleteSeriesScope(b, scope); S.save(); S.showToast(`예약 ${n}건을 삭제했습니다.`, 'success'); return n;
  }

  // ───────── 정기 예약 모달(미리보기 → 생성)
  function openSeriesModal() {
    const d = S.state.data; const s = d.settings; const res0 = currentResource(); if (!res0) return;
    const keys = S.periodKeys();
    const body = document.createElement('form'); body.className = 'form'; body.noValidate = true;
    body.innerHTML = `
      <div class="form-grid">
        <label>자원<select name="resourceId">${d.resources.filter(r => r.active).map(r => opt(r.id, r.name, r.id === res0.id)).join('')}</select></label>
        <label>요일<select name="weekday">${[1, 2, 3, 4, 5].map(w => opt(w, `매주 ${S.DAY_KO[w]}요일`, w === 1)).join('')}</select></label>
        <label>시작 교시<select name="pStart">${keys.map(k => opt(k, S.periodLabel(k), k === keys[0])).join('')}</select></label>
        <label>끝 교시<select name="pEnd">${keys.map(k => opt(k, S.periodLabel(k), k === keys[0])).join('')}</select></label>
        <label>학급<select name="classSel">${classOptions('')}</select></label>
        <label>교사<select name="teacherId">${opt('', '교사 선택', true)}${d.teachers.map(x => opt(x.id, `${x.name} (${x.role})`)).join('')}</select></label>
        <label class="custom-wrap" hidden>직접 입력<input name="customLabel" maxlength="20"></label>
        <label class="qty-wrap" hidden>사용 수량<input type="number" name="qty" min="1" step="1" value="1"></label>
        <label>태그<select name="tag">${S.TAGS.map(x => opt(x, x)).join('')}</select></label>
        <label>시작일<input type="date" name="dateFrom" value="${s.semesterStart}" min="${s.semesterStart}" max="${s.semesterEnd}"></label>
        <label>종료일<input type="date" name="dateTo" value="${s.semesterEnd}" min="${s.semesterStart}" max="${s.semesterEnd}"></label>
      </div>
      <div class="validate" aria-live="polite"></div>
      <div class="preview"></div>`;
    const footer = '<button type="button" class="btn" data-result="">취소</button><button type="button" class="btn" data-act="preview">미리보기</button><button type="button" class="btn btn-primary" data-act="create" disabled>생성</button>';
    const m = S.openModal({ title: '정기 예약 일괄 생성', body, footer, cls: 'modal-lg' });
    const q = n => body.elements[n]; const createBtn = S.$('[data-act="create"]', m.foot); let rows = []; let sr = null;
    const read = () => {
      const res = S.resourceById(q('resourceId').value); const eq = res && res.type === 'equipment';
      S.$('.qty-wrap', body).hidden = !eq; S.$('.custom-wrap', body).hidden = q('classSel').value !== 'custom';
      let pS = Number(q('pStart').value), pE = Number(q('pEnd').value); if (pE < pS) { pE = pS; q('pEnd').value = pS; }
      let qty = 1; if (eq) { q('qty').max = res.quantity; qty = S.clamp(Math.floor(Number(q('qty').value)) || 1, 1, res.quantity); q('qty').value = qty; }
      let from = q('dateFrom').value, to = q('dateTo').value;
      if (S.isValidDate(to) && to > s.semesterEnd) { to = s.semesterEnd; q('dateTo').value = to; }
      if (S.isValidDate(from) && from < s.semesterStart) { from = s.semesterStart; q('dateFrom').value = from; }
      const sel = q('classSel').value; const classId = sel && sel !== 'custom' && !sel.startsWith('grade:') ? sel : '';
      const customLabel = sel === 'custom' ? q('customLabel').value.trim() : sel.startsWith('grade:') ? `${sel.split(':')[1]}학년 전체` : '';
      const errs = [];
      if (!classId && !customLabel) errs.push('학급을 선택하세요'); if (!q('teacherId').value) errs.push('교사를 선택하세요');
      if (!S.isValidDate(from) || !S.isValidDate(to)) errs.push('기간을 입력하세요'); else if (from > to) errs.push('종료일이 시작일보다 앞섭니다');
      return { sr: { resourceId: res.id, weekday: Number(q('weekday').value), periodStart: pS, periodEnd: pE, classId, customLabel, teacherId: q('teacherId').value, tag: q('tag').value, qty, dateFrom: from, dateTo: to }, errs };
    };
    const invalidate = () => { read(); createBtn.disabled = true; rows = []; S.$('.preview', body).innerHTML = ''; S.$('.validate', body).innerHTML = '<p class="muted">조건을 입력하고 미리보기를 눌러 날짜별 생성 여부를 확인하세요.</p>'; };
    // 조건 입력이 바뀌면 미리보기 무효화. 미리보기 표 안의 행 체크박스 이벤트는 제외(체크 상태만 바꿈)
    const fromPreview = e => !!e.target.closest('.preview');
    body.addEventListener('input', e => { if (!fromPreview(e)) invalidate(); });
    body.addEventListener('change', e => { if (fromPreview(e)) return; if (e.target.name === 'classSel') { const cls = S.classById(e.target.value); if (cls && cls.teacherId) q('teacherId').value = cls.teacherId; } invalidate(); });
    body.addEventListener('submit', e => e.preventDefault());
    body.addEventListener('click', e => {
      const cb = e.target.closest('input[data-row]'); if (cb) { rows[Number(cb.dataset.row)].checked = cb.checked; summarize(); }
    });
    const summarize = () => {
      const n = rows.filter(r => r.checked).length; const cnt = k => rows.filter(r => r.status === k).length;
      S.$('.validate', body).innerHTML = `<div class="${n ? 'ok' : 'bad'}"><b>${n}건 생성</b> · ${cnt('holiday')}건 휴업일 제외 · ${cnt('blocked')}건 차단 제외 · ${cnt('conflict')}건 충돌${cnt('skip') ? ` · ${cnt('skip')}건 제외` : ''}</div>`;
      createBtn.disabled = n === 0;
    };
    m.foot.addEventListener('click', e => {
      const act = e.target.closest('[data-act]'); if (!act) return;
      if (act.dataset.act === 'preview') {
        const r = read(); if (r.errs.length) { S.$('.validate', body).innerHTML = `<div class="bad"><ul>${r.errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`; return; }
        sr = r.sr; rows = S.expandSeries(sr);
        if (!rows.length) { S.$('.validate', body).innerHTML = '<div class="bad">생성할 건이 없습니다(요일·기간을 확인하세요).</div>'; S.$('.preview', body).innerHTML = ''; createBtn.disabled = true; return; }
        const lab = { ok: '생성', holiday: '휴업일 제외', blocked: '차단 제외', conflict: '충돌', skip: '제외' };
        S.$('.preview', body).innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th></th><th>날짜</th><th>상태</th><th>사유</th></tr></thead><tbody>${rows.map((x, i) => `<tr class="st-${x.status}"><td>${x.status === 'ok' || x.status === 'conflict' ? `<input type="checkbox" data-row="${i}"${x.checked ? ' checked' : ''} aria-label="${S.fmtMDW(x.date)} 생성">` : ''}</td><td>${S.fmtMDW(x.date)}</td><td><span class="badge st-${x.status}">${lab[x.status]}</span></td><td class="muted wrap">${esc(x.reason)}</td></tr>`).join('')}</tbody></table></div>`;
        summarize();
      } else if (act.dataset.act === 'create' && rows.length) {
        const now = Date.now(); const series = Object.assign({ id: S.uid('s'), createdAt: now }, sr);
        const picked = rows.filter(x => x.checked); if (!picked.length) return;
        d.series.push(series);
        picked.forEach(x => d.bookings.push({ id: S.uid('b'), resourceId: sr.resourceId, date: x.date, periodStart: sr.periodStart, periodEnd: sr.periodEnd, classId: sr.classId, customLabel: sr.customLabel, teacherId: sr.teacherId, tag: sr.tag, qty: sr.qty, memo: '', seriesId: series.id, used: null, createdAt: now, updatedAt: now }));
        S.save(); m.close('created'); S.showToast(`정기 예약 ${picked.length}건을 생성했습니다.`, 'success'); S.state.ui.selectedResourceId = sr.resourceId; S.saveUi(); S.render();
      }
    });
    invalidate();
    return m.done;
  }

  // ───────── 지난 예약 미확인 목록(일괄 체크)
  function openUncheckedModal() {
    const list = pastUnchecked().sort((a, b) => b.date.localeCompare(a.date));
    const rowsHtml = () => list.map(b => `<tr data-id="${b.id}"><td>${S.fmtMDW(b.date)}</td><td>${esc((S.resourceById(b.resourceId) || {}).name || '')}</td><td>${S.rangeLabel(b.periodStart, b.periodEnd)}</td><td>${esc(S.bookingShort(b))}</td>
      <td class="row"><button type="button" class="btn btn-sm" data-mark="true">사용함</button><button type="button" class="btn btn-sm" data-mark="false">사용 안 함</button></td></tr>`).join('');
    const body = document.createElement('div');
    body.innerHTML = `<p class="muted">지난 예약 ${list.length}건의 실제 사용 여부가 확인되지 않았습니다. 통계의 미사용률에 반영됩니다.</p><div class="table-wrap"><table class="table"><thead><tr><th>날짜</th><th>자원</th><th>교시</th><th>학급·교사</th><th>확인</th></tr></thead><tbody>${rowsHtml()}</tbody></table></div>`;
    const m = S.openModal({ title: '미확인 예약 사용 여부 확인', body, footer: '<button type="button" class="btn" data-result="">닫기</button><button type="button" class="btn btn-primary" data-act="all-used">모두 사용함으로 표시</button>', cls: 'modal-lg' });
    const mark = (ids, v) => { const now = Date.now(); S.state.data.bookings.forEach(b => { if (ids.includes(b.id)) { b.used = v; b.updatedAt = now; } }); S.save(); };
    body.addEventListener('click', e => {
      const btn = e.target.closest('[data-mark]'); if (!btn) return; const tr = btn.closest('tr');
      mark([tr.dataset.id], btn.dataset.mark === 'true'); tr.remove(); S.showToast('사용 여부를 기록했습니다.', 'success', 1200);
      if (!S.$('tbody tr', body)) { m.close('done'); S.render(); }
    });
    m.foot.addEventListener('click', e => { if (e.target.closest('[data-act="all-used"]')) { mark(S.$$('tbody tr', body).map(tr => tr.dataset.id), true); m.close('done'); S.showToast('모두 사용함으로 표시했습니다.', 'success'); S.render(); } });
    m.done.then(() => { if (S.state.ui.tab === 'board') renderBoard(); });
  }

  // ───────── 인쇄 미리보기(공용): build(opts) → HTML, orientation 'landscape'|'portrait'
  function openPrintPreview({ title, build, orientation, options }) {
    let opts = {}; (options || []).forEach(o => { opts[o.name] = o.value; });
    const body = document.createElement('div'); body.className = 'print-preview';
    const optHtml = (options || []).map(o => `<label class="radio-group"><span class="lbl">${esc(o.label)}</span>${o.choices.map(c => `<label><input type="radio" name="${o.name}" value="${c.value}"${c.value === o.value ? ' checked' : ''}> ${esc(c.label)}</label>`).join('')}</label>`).join('');
    body.innerHTML = `${optHtml ? `<div class="print-opts">${optHtml}</div>` : ''}<div class="paper-wrap"><div class="paper ${orientation}"></div></div>`;
    const render = () => { S.$('.paper', body).innerHTML = build(opts); };
    body.addEventListener('change', e => { if (e.target.name in opts) { opts[e.target.name] = e.target.value; render(); } });
    render();
    const m = S.openModal({ title, body, footer: '<button type="button" class="btn" data-result="">닫기</button><button type="button" class="btn btn-primary" data-act="print">브라우저 인쇄</button>', cls: 'modal-xl' });
    m.foot.addEventListener('click', e => {
      if (!e.target.closest('[data-act="print"]')) return;
      S.$('#print-root').innerHTML = build(opts); S.$('#print-page-style').textContent = `@page { size: A4 ${orientation}; margin: 12mm; }`;
      window.print();
    });
    return m.done;
  }
  // 결재란 HTML
  const approvalHtml = () => { const line = S.state.data.settings.approvalLine; return `<table class="approval"><tr><th rowspan="2" class="v">결재</th>${line.map(x => `<th>${esc(x)}</th>`).join('')}</tr><tr>${line.map(() => '<td></td>').join('')}</tr></table>`; };
  // 주간 이용 현황표(자원당 1쪽, A4 가로)
  function weeklyPrintHtml(resources, days) {
    const s = S.state.data.settings; const keys = S.periodKeys();
    const rowH = Math.min(58, Math.floor(540 / keys.length)); // 교시 수에 따라 행 높이를 맞춰 A4 가로 1쪽에 들어가게
    return resources.map(res => `<section class="print-page" style="--wk-row:${rowH}px">
      <header class="print-head"><div><p class="school">${esc(s.schoolName)}</p><h1>${s.schoolYear}학년도 ${s.semester}학기 특별실 주간 이용 현황표</h1>
      <p class="meta">${S.weekLabel(days[0])} (${S.fmtMD(days[0])}~${S.fmtMD(days[4])}) · 자원: <b>${esc(res.name)}</b>${res.manager ? ` (담당 ${esc(res.manager)})` : ''} · 출력일 ${S.fmtKo(S.todayStr())}</p></div>${approvalHtml()}</header>
      <table class="wk"><thead><tr><th class="pcol">교시</th>${days.map(dt => `<th>${S.DAY_KO[S.dayOfWeek(dt)]} ${S.fmtMD(dt)}</th>`).join('')}</tr></thead><tbody>
      ${keys.map(p => `<tr><th class="pcol">${esc(S.periodLabel(p))}<br><small>${esc(S.periodObj(p).time || '')}</small></th>${days.map(dt => {
        const st = cellState(res, dt, p);
        if (st.closed) return `<td class="closed">휴업 · ${esc(st.closed.title)}</td>`;
        const items = st.list.map(b => `${esc(S.classLabel(b))} ${esc(S.teacherName(b.teacherId))} ${esc(b.tag)}${res.type === 'equipment' && (b.qty || 1) > 1 ? ` ×${b.qty}` : ''}`);
        if (st.blk) return `<td class="blocked">■ ${esc(st.blk.title)}${items.length ? `<br><s>${items.join('<br>')}</s>` : ''}</td>`;
        if (st.unavail) return '<td class="closed">—</td>';
        return `<td>${items.join('<br>')}${res.type === 'equipment' && st.list.length ? `<br><small>${st.used}/${st.cap}</small>` : ''}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table>
      <p class="print-foot">${res.notice ? `주의사항: ${esc(res.notice)} · ` : ''}특별실지기에서 출력</p></section>`).join('');
  }
  function openWeeklyPrint() {
    const res = currentResource(); if (!res) return; const days = weekDays();
    return openPrintPreview({
      title: '주간 이용 현황표 인쇄 미리보기', orientation: 'landscape',
      options: [{ name: 'scope', label: '출력 범위', value: 'all', choices: [{ value: 'all', label: '전체 자원(자원당 1쪽)' }, { value: 'one', label: `선택 자원만(${res.name})` }] }],
      build: o => weeklyPrintHtml(o.scope === 'one' ? [res] : S.state.data.resources.filter(r => r.active), days),
    });
  }

  return { initBoard, renderBoard, openBookingModal, openSeriesModal, openUncheckedModal, openWeeklyPrint, openPrintPreview, approvalHtml, deleteBookingFlow, currentResource, ensureWeek, cellState };
})();
