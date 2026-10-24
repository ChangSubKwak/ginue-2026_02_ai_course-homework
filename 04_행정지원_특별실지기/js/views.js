'use strict';
/* 특별실지기 — views.js
   학사일정(월간 달력·행사 차단·영향 예약), 자원·학급·교사 관리, 통계(SVG 차트·히트맵·실적 보고),
   설정(학교·교시·결재란·데이터 입출력·초기화), 온보딩·도움말·탭 라우팅·초기화(init) */
(() => {
  const S = SRB; const B = SRB.board; const esc = S.escapeHtml;
  const view = name => S.$(`[data-view="${name}"]`);
  const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
  const badgeType = t => `<span class="badge type-${t}">${S.EVENT_TYPE[t] || t}</span>`;

  // ═════════ 학사일정
  function renderCalendar() {
    const root = view('calendar'); const d = S.state.data; const s = d.settings; const ui = S.state.ui; const t = S.todayStr();
    if (!/^\d{4}-\d{2}$/.test(ui.calMonth)) ui.calMonth = (S.inSemester(t) ? t : s.semesterStart).slice(0, 7);
    const [y, m] = ui.calMonth.split('-').map(Number); const startDow = new Date(y, m - 1, 1).getDay(); const dim = new Date(y, m, 0).getDate();
    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell blank"></div>';
    for (let day = 1; day <= dim; day++) {
      const date = `${y}-${S.pad2(m)}-${S.pad2(day)}`; const evs = S.eventsOn(date); const w = (startDow + day - 1) % 7;
      cells += `<button type="button" class="cal-cell${S.inSemester(date) ? '' : ' out'}${date === t ? ' is-today' : ''}${w === 0 || w === 6 ? ' weekend' : ''}${evs.some(e => e.type !== 'event') ? ' closed' : ''}" data-cal-date="${date}" aria-label="${S.fmtKo(date)} 일정 ${evs.length}건">
        <span class="n">${day}</span><span class="dots">${evs.slice(0, 4).map(e => `<i class="type-${e.type}" title="${esc(e.title)}"></i>`).join('')}</span>${evs.length ? `<span class="cal-title">${esc(evs[0].title)}${evs.length > 1 ? ` 외 ${evs.length - 1}` : ''}</span>` : ''}</button>`;
    }
    const list = d.events.slice().sort((a, b) => a.dateStart.localeCompare(b.dateStart));
    root.innerHTML = `
      <div class="split">
        <section class="card">
          <div class="card-head"><div class="row"><button type="button" class="btn btn-sm" data-act="cal-prev" aria-label="이전 달">◀</button><h2>${y}년 ${m}월</h2><button type="button" class="btn btn-sm" data-act="cal-next" aria-label="다음 달">▶</button></div>
            <div class="row"><button type="button" class="btn" data-act="holiday-set">공휴일 기본 세트 추가</button><button type="button" class="btn btn-primary" data-act="event-add">일정 추가</button></div></div>
          <div class="cal-grid">${['일', '월', '화', '수', '목', '금', '토'].map(x => `<div class="cal-head">${x}</div>`).join('')}${cells}</div>
          <ul class="legend"><li><i class="sw type-holiday"></i>공휴일</li><li><i class="sw type-dayoff"></i>재량휴업일</li><li><i class="sw type-event"></i>학교행사(자원 차단)</li></ul>
        </section>
        <section class="card">
          <div class="card-head"><h2>일정 목록 <small class="muted">${list.length}건</small></h2></div>
          ${list.length ? `<ul class="event-list">${list.map(e => {
            const n = S.affectedBookings(e).length; const names = e.type === 'event' ? e.blockResourceIds.map(id => (S.resourceById(id) || {}).name).filter(Boolean) : [];
            return `<li><div class="ev-main"><b>${esc(e.title)}</b> ${badgeType(e.type)}<div class="muted">${S.fmtMDW(e.dateStart)}${e.dateEnd !== e.dateStart ? ` ~ ${S.fmtMDW(e.dateEnd)}` : ''}${e.type === 'event' ? ` · 차단: ${names.length ? esc(names.join(', ')) : '없음'}${names.length ? ` · ${e.blockPeriods === 'all' ? '전체 교시' : e.blockPeriods.map(S.periodLabel).join(',')}` : ''}` : ' · 전체 자원 예약 불가'}${e.memo ? ` · ${esc(e.memo)}` : ''}</div></div>
              <div class="row">${n ? `<button type="button" class="btn btn-sm btn-danger-outline" data-affected="${esc(e.id)}">충돌 ${n}건</button>` : ''}<button type="button" class="btn btn-sm" data-event-edit="${esc(e.id)}">수정</button><button type="button" class="btn btn-sm" data-event-del="${esc(e.id)}">삭제</button></div></li>`;
          }).join('')}</ul>` : '<p class="empty-inline">등록된 일정이 없습니다. 달력의 날짜를 누르거나 \'일정 추가\'로 등록하세요.</p>'}
        </section>
      </div>`;
  }
  function initCalendar() {
    view('calendar').addEventListener('click', async e => {
      const ui = S.state.ui; const shift = n => { const [y, m] = ui.calMonth.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); ui.calMonth = `${d.getFullYear()}-${S.pad2(d.getMonth() + 1)}`; S.saveUi(); renderCalendar(); };
      const act = e.target.closest('[data-act]');
      if (act) { if (act.dataset.act === 'cal-prev') shift(-1); else if (act.dataset.act === 'cal-next') shift(1); else if (act.dataset.act === 'event-add') openEventModal(null, ''); else if (act.dataset.act === 'holiday-set') addHolidaySet(); return; }
      const dc = e.target.closest('[data-cal-date]'); if (dc) { openEventModal(null, dc.dataset.calDate); return; }
      const ed = e.target.closest('[data-event-edit]'); if (ed) { openEventModal(S.state.data.events.find(x => x.id === ed.dataset.eventEdit)); return; }
      const af = e.target.closest('[data-affected]'); if (af) { openAffectedModal(S.state.data.events.find(x => x.id === af.dataset.affected)); return; }
      const del = e.target.closest('[data-event-del]');
      if (del) {
        const ev = S.state.data.events.find(x => x.id === del.dataset.eventDel);
        if (await S.showModal({ title: '일정 삭제', body: `<p><b>${esc(ev.title)}</b>(${S.fmtMDW(ev.dateStart)}) 일정을 삭제할까요? 연결된 예약 차단도 해제됩니다.</p>`, confirmText: '삭제', danger: true })) {
          S.state.data.events = S.state.data.events.filter(x => x !== ev); S.save(); S.showToast('일정을 삭제했습니다.', 'success'); renderCalendar();
        }
      }
    });
  }
  // 일정 모달(등록·수정) → 저장 시 영향 예약 수 안내
  function openEventModal(ev, presetDate) {
    const d = S.state.data; const isEdit = !!ev; const t = S.todayStr(); const cm = S.state.ui.calMonth;
    const base = presetDate || (t.startsWith(cm) ? t : `${cm}-01`); // 기본 날짜: 보고 있는 달의 오늘(아니면 1일)
    const f = ev ? JSON.parse(JSON.stringify(ev)) : { title: '', type: 'event', dateStart: base, dateEnd: base, blockResourceIds: [], blockPeriods: 'all', memo: '' };
    const body = document.createElement('form'); body.className = 'form'; body.noValidate = true;
    body.innerHTML = `
      <div class="form-grid">
        <label>제목<input name="title" maxlength="30" value="${esc(f.title)}" placeholder="예: 학예회 리허설" required></label>
        <label>유형<select name="type">${Object.entries(S.EVENT_TYPE).map(([k, v]) => opt(k, v, k === f.type)).join('')}</select></label>
        <label>시작일<input type="date" name="dateStart" value="${f.dateStart}"></label>
        <label>종료일<input type="date" name="dateEnd" value="${f.dateEnd}"></label>
      </div>
      <div class="field only-event"><span class="lbl">차단 자원(학교행사)</span><div class="check-grid">${d.resources.map(r => `<label><input type="checkbox" name="res" value="${r.id}"${f.blockResourceIds.includes(r.id) ? ' checked' : ''}> ${esc(r.name)}</label>`).join('')}</div>
        <div class="row"><button type="button" class="btn btn-sm" data-act="res-all">모두 선택</button><button type="button" class="btn btn-sm" data-act="res-none">모두 해제</button></div></div>
      <div class="field only-event"><span class="lbl">차단 교시</span><div class="row"><label><input type="radio" name="pmode" value="all"${f.blockPeriods === 'all' ? ' checked' : ''}> 전체 교시</label><label><input type="radio" name="pmode" value="some"${f.blockPeriods !== 'all' ? ' checked' : ''}> 일부 교시</label></div>
        <div class="check-grid pcheck">${S.periodKeys().map(k => `<label><input type="checkbox" name="per" value="${k}"${Array.isArray(f.blockPeriods) && f.blockPeriods.includes(k) ? ' checked' : ''}> ${esc(S.periodLabel(k))}</label>`).join('')}</div></div>
      <label>메모<input name="memo" maxlength="60" value="${esc(f.memo)}"></label>
      <div class="validate" aria-live="polite"></div>`;
    const m = S.openModal({ title: isEdit ? '일정 수정' : '일정 등록', body, footer: '<button type="button" class="btn" data-result="">취소</button><button type="button" class="btn btn-primary" data-act="save">저장</button>', cls: 'modal-lg' });
    const q = n => body.elements[n]; const saveBtn = S.$('[data-act="save"]', m.foot);
    const read = () => {
      f.title = q('title').value.trim(); f.type = q('type').value; f.dateStart = q('dateStart').value; f.dateEnd = q('dateEnd').value;
      if (S.isValidDate(f.dateStart) && (!S.isValidDate(f.dateEnd) || f.dateEnd < f.dateStart)) { f.dateEnd = f.dateStart; q('dateEnd').value = f.dateEnd; }
      f.blockResourceIds = S.$$('input[name="res"]:checked', body).map(x => x.value);
      const some = q('pmode').value === 'some'; S.$('.pcheck', body).hidden = !some;
      f.blockPeriods = some ? S.$$('input[name="per"]:checked', body).map(x => Number(x.value)) : 'all';
      f.memo = q('memo').value.trim();
      S.$$('.only-event', body).forEach(x => { x.hidden = f.type !== 'event'; });
      const errs = [];
      if (!f.title) errs.push('제목을 입력하세요'); if (!S.isValidDate(f.dateStart)) errs.push('시작일을 입력하세요');
      if (f.type === 'event' && some && !f.blockPeriods.length) errs.push('차단 교시를 1개 이상 선택하세요');
      const probe = Object.assign({}, f, { blockPeriods: f.blockPeriods.length === 0 ? 'all' : f.blockPeriods });
      const n = errs.length ? 0 : S.affectedBookings(probe).length;
      S.$('.validate', body).innerHTML = errs.length ? `<div class="bad"><ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : `<div class="${n ? 'warn' : 'ok'}">${f.type === 'event' ? (f.blockResourceIds.length ? `자원 ${f.blockResourceIds.length}개 차단` : '차단 자원 없음(안내용 일정)') : '해당 날짜의 모든 자원 예약 불가'} · 기존 예약 <b>${n}</b>건과 충돌</div>`;
      saveBtn.disabled = errs.length > 0; return errs;
    };
    body.addEventListener('input', read); body.addEventListener('change', read); body.addEventListener('submit', e => e.preventDefault());
    body.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; S.$$('input[name="res"]', body).forEach(x => { x.checked = a.dataset.act === 'res-all'; }); read(); });
    m.foot.addEventListener('click', async e => {
      if (!e.target.closest('[data-act="save"]') || read().length) return;
      const now = Date.now(); const rec = { title: f.title, type: f.type, dateStart: f.dateStart, dateEnd: f.dateEnd, blockResourceIds: f.type === 'event' ? f.blockResourceIds : [], blockPeriods: f.type === 'event' ? f.blockPeriods : 'all', memo: f.memo, updatedAt: now };
      let target = ev; if (isEdit) Object.assign(ev, rec); else { target = Object.assign({ id: S.uid('e') }, rec); d.events.push(target); }
      S.save(); m.close('saved'); S.render();
      const n = S.affectedBookings(target).length;
      if (!n) { S.showToast('일정을 저장했습니다.', 'success'); return; }
      const mm = S.openModal({ title: '일정 저장됨', body: `<p><b>${esc(target.title)}</b> 일정이 저장되었습니다.</p><p class="warn-text">기존 예약 <b>${n}</b>건과 충돌합니다. 차단이 우선 적용되며, 예약판에는 '충돌' 배지로 표시됩니다.</p>`,
        footer: '<button type="button" class="btn" data-result="">나중에</button><button type="button" class="btn btn-primary" data-result="list">목록 보기</button>' });
      if (await mm.done === 'list') openAffectedModal(target);
    });
    read();
  }
  // 영향 예약 목록(각 건 수정/삭제)
  function openAffectedModal(ev) {
    const body = document.createElement('div');
    const draw = () => {
      const list = S.affectedBookings(ev);
      body.innerHTML = `<p class="muted">${esc(ev.title)}(${S.fmtMDW(ev.dateStart)}${ev.dateEnd !== ev.dateStart ? `~${S.fmtMDW(ev.dateEnd)}` : ''})과 충돌하는 예약 ${list.length}건</p>
        ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>날짜</th><th>자원</th><th>교시</th><th>학급·교사</th><th></th></tr></thead><tbody>${list.map(b => `<tr><td>${S.fmtMDW(b.date)}</td><td>${esc((S.resourceById(b.resourceId) || {}).name || '')}</td><td>${S.rangeLabel(b.periodStart, b.periodEnd)}</td><td>${esc(S.bookingShort(b))}</td><td class="row"><button type="button" class="btn btn-sm" data-edit="${b.id}">수정</button><button type="button" class="btn btn-sm btn-danger-outline" data-del="${b.id}">삭제</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="ok-text">충돌하는 예약이 없습니다.</p>'}`;
    };
    draw();
    const m = S.openModal({ title: '충돌 예약 목록', body, footer: '<button type="button" class="btn" data-result="">닫기</button>', cls: 'modal-lg' });
    body.addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]'); const dl = e.target.closest('[data-del]'); if (!ed && !dl) return;
      const b = S.state.data.bookings.find(x => x.id === (ed ? ed.dataset.edit : dl.dataset.del)); if (!b) return;
      if (ed) await B.openBookingModal({ booking: b }); else await B.deleteBookingFlow(b);
      draw(); S.render();
    });
  }
  // 공휴일 기본 세트(학기 범위 안, 중복 날짜 건너뜀)
  function addHolidaySet() {
    const d = S.state.data; const s = d.settings; const years = new Set([s.semesterStart.slice(0, 4), s.semesterEnd.slice(0, 4)]);
    const cands = [];
    years.forEach(y => { APP_DATA.HOLIDAYS.fixed.forEach(([md, title]) => cands.push({ title, dateStart: `${y}-${md}`, dateEnd: `${y}-${md}` })); (APP_DATA.HOLIDAYS.byYear[y] || []).forEach(([a, b, title]) => cands.push({ title, dateStart: a, dateEnd: b })); });
    let added = 0; const now = Date.now();
    cands.filter(c => c.dateStart >= s.semesterStart && c.dateStart <= s.semesterEnd).forEach(c => {
      if (d.events.some(e => e.type !== 'event' && e.dateStart <= c.dateStart && c.dateStart <= e.dateEnd)) return;
      d.events.push({ id: S.uid('e'), title: c.title, type: 'holiday', dateStart: c.dateStart, dateEnd: c.dateEnd, blockResourceIds: [], blockPeriods: 'all', memo: '공휴일 기본 세트', updatedAt: now }); added++;
    });
    if (added) { S.save(); renderCalendar(); }
    S.showToast(added ? `공휴일 ${added}건을 추가했습니다(이미 있는 날짜는 건너뜀).` : '추가할 공휴일이 없습니다(모두 등록됨).', added ? 'success' : 'info');
  }

  // ═════════ 자원·학급·교사 관리
  function renderResources() {
    const root = view('resources'); const d = S.state.data;
    const cards = d.resources.map(r => {
      const n = d.bookings.filter(b => b.resourceId === r.id).length;
      return `<article class="res-card${r.active ? '' : ' inactive'}" style="--res-color:${esc(r.color)}">
        <div class="res-card-head"><h3>${esc(r.name)}</h3><span class="badge">${r.type === 'equipment' ? `수량형 · ${r.quantity}개` : '공간형'}</span></div>
        <dl><dt>그룹</dt><dd>${esc(r.group || '-')}</dd><dt>담당</dt><dd>${esc(r.manager || '-')}</dd><dt>수용</dt><dd>${r.capacity ? `${r.capacity}명` : '-'}</dd><dt>교시</dt><dd>${r.availablePeriods.length === S.periodKeys().length ? '전체' : r.availablePeriods.map(S.periodLabel).join(', ')}</dd>${r.priorityRule ? `<dt>우선</dt><dd>${r.priorityRule.weekdays.map(w => S.DAY_KO[w]).join('·')}요일 ${r.priorityRule.grades.join('·')}학년</dd>` : ''}<dt>예약</dt><dd>${n}건</dd></dl>
        ${r.notice ? `<p class="muted small">${esc(r.notice)}</p>` : ''}
        <div class="res-card-foot"><label class="switch"><input type="checkbox" data-toggle="${esc(r.id)}"${r.active ? ' checked' : ''}> <span>${r.active ? '활성' : '비활성'}</span></label><div class="row"><button type="button" class="btn btn-sm" data-res-edit="${esc(r.id)}">수정</button><button type="button" class="btn btn-sm" data-res-del="${esc(r.id)}">삭제</button></div></div></article>`;
    }).join('');
    const classes = S.sortedClasses();
    root.innerHTML = `
      <section class="card"><div class="card-head"><h2>특별실·기자재 <small class="muted">${d.resources.length}개 · 활성 ${d.resources.filter(r => r.active).length}</small></h2><button type="button" class="btn btn-primary" data-act="res-add">자원 추가</button></div>
        ${d.resources.length ? `<div class="res-grid">${cards}</div>` : '<p class="empty-inline">등록된 자원이 없습니다. \'자원 추가\'로 특별실·기자재를 등록하세요.</p>'}</section>
      <div class="split">
        <section class="card"><div class="card-head"><h2>학급 <small class="muted">${classes.length}개</small></h2><button type="button" class="btn" data-act="class-add">학급 추가</button></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>학급</th><th>담임</th><th></th></tr></thead><tbody>${classes.map(c => `<tr><td><b>${esc(c.id)}</b></td><td>${esc(S.teacherName(c.teacherId) || '-')}</td><td class="row"><button type="button" class="btn btn-sm" data-class-edit="${c.id}">수정</button><button type="button" class="btn btn-sm" data-class-del="${c.id}">삭제</button></td></tr>`).join('') || '<tr><td colspan="3" class="muted">학급이 없습니다.</td></tr>'}</tbody></table></div></section>
        <section class="card"><div class="card-head"><h2>교사 <small class="muted">${d.teachers.length}명</small></h2><button type="button" class="btn" data-act="teacher-add">교사 추가</button></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>이름</th><th>담당</th><th></th></tr></thead><tbody>${d.teachers.map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.role)}</td><td class="row"><button type="button" class="btn btn-sm" data-teacher-edit="${x.id}">수정</button><button type="button" class="btn btn-sm" data-teacher-del="${x.id}">삭제</button></td></tr>`).join('') || '<tr><td colspan="3" class="muted">교사가 없습니다.</td></tr>'}</tbody></table></div></section>
      </div>`;
  }
  function initResources() {
    const root = view('resources');
    root.addEventListener('change', async e => {
      const tg = e.target.closest('[data-toggle]'); if (!tg) return;
      const r = S.resourceById(tg.dataset.toggle); const on = tg.checked;
      if (!on) { // 비활성화 전 영향 예약 수 확인(예약은 유지되고 예약판에서만 숨김)
        const t = S.todayStr(); const n = S.state.data.bookings.filter(b => b.resourceId === r.id && b.date >= t).length;
        const ok = await S.showModal({ title: '자원 비활성화', body: `<p><b>${esc(r.name)}</b>을(를) 비활성화하면 예약판 칩에서 숨겨지고 새 예약을 받지 않습니다.</p><p class="${n ? 'warn-text' : 'muted'}">오늘 이후 예약 <b>${n}</b>건은 삭제되지 않고 유지되며 통계에도 남습니다.</p>`, confirmText: '비활성화' });
        if (!ok) { renderResources(); return; }
      }
      r.active = on; r.updatedAt = Date.now(); S.save(); renderResources();
      S.showToast(on ? `${r.name}을(를) 활성화했습니다.` : `${r.name}을(를) 비활성화했습니다. 예약판 칩에서 숨겨지고 통계에는 남습니다.`, 'info');
    });
    root.addEventListener('click', async e => {
      const d = S.state.data; const act = e.target.closest('[data-act]');
      if (act) { if (act.dataset.act === 'res-add') openResourceModal(null); else if (act.dataset.act === 'class-add') openClassModal(null); else if (act.dataset.act === 'teacher-add') openTeacherModal(null); return; }
      const re = e.target.closest('[data-res-edit]'); if (re) { openResourceModal(S.resourceById(re.dataset.resEdit)); return; }
      const rd = e.target.closest('[data-res-del]');
      if (rd) {
        const r = S.resourceById(rd.dataset.resDel); const n = d.bookings.filter(b => b.resourceId === r.id).length;
        if (n) { await S.showModal({ title: '삭제할 수 없음', body: `<p><b>${esc(r.name)}</b>에는 예약 ${n}건이 있어 삭제 대신 <b>비활성화</b>만 가능합니다. 비활성 자원은 예약판에서 숨겨지고 통계에는 유지됩니다.</p>`, confirmText: '확인', cancelText: '' }); return; }
        if (await S.showModal({ title: '자원 삭제', body: `<p><b>${esc(r.name)}</b> 자원을 삭제할까요?</p>`, confirmText: '삭제', danger: true })) { d.resources = d.resources.filter(x => x !== r); d.events.forEach(ev => { ev.blockResourceIds = (ev.blockResourceIds || []).filter(id => id !== r.id); }); S.save(); renderResources(); S.showToast('자원을 삭제했습니다.', 'success'); }
        return;
      }
      const ce = e.target.closest('[data-class-edit]'); if (ce) { openClassModal(S.classById(ce.dataset.classEdit)); return; }
      const cd = e.target.closest('[data-class-del]');
      if (cd) {
        const c = S.classById(cd.dataset.classDel); const n = d.bookings.filter(b => b.classId === c.id).length;
        if (n) { await S.showModal({ title: '삭제할 수 없음', body: `<p>${esc(c.id)} 학급에는 예약 ${n}건이 연결되어 있어 삭제할 수 없습니다.</p>`, confirmText: '확인', cancelText: '' }); return; }
        if (await S.showModal({ title: '학급 삭제', body: `<p>${esc(c.id)} 학급을 삭제할까요?</p>`, confirmText: '삭제', danger: true })) { d.classes = d.classes.filter(x => x !== c); S.save(); renderResources(); S.showToast('학급을 삭제했습니다.', 'success'); }
        return;
      }
      const te = e.target.closest('[data-teacher-edit]'); if (te) { openTeacherModal(S.teacherById(te.dataset.teacherEdit)); return; }
      const td = e.target.closest('[data-teacher-del]');
      if (td) {
        const x = S.teacherById(td.dataset.teacherDel); const n = d.bookings.filter(b => b.teacherId === x.id).length + d.classes.filter(c => c.teacherId === x.id).length;
        if (n) { await S.showModal({ title: '삭제할 수 없음', body: `<p>${esc(x.name)} 교사는 예약 또는 학급 담임 ${n}건에 연결되어 있어 삭제할 수 없습니다.</p>`, confirmText: '확인', cancelText: '' }); return; }
        if (await S.showModal({ title: '교사 삭제', body: `<p>${esc(x.name)} 교사를 삭제할까요?</p>`, confirmText: '삭제', danger: true })) { d.teachers = d.teachers.filter(y => y !== x); S.save(); renderResources(); S.showToast('교사를 삭제했습니다.', 'success'); }
      }
    });
  }
  // 자원별 교시 최대 동시 사용 수량(수량 감소 차단 판단용)
  function maxConcurrent(resourceId) {
    let max = 0; const per = {};
    S.state.data.bookings.filter(b => b.resourceId === resourceId).forEach(b => { for (let p = b.periodStart; p <= b.periodEnd; p++) { const k = `${b.date}|${p}`; per[k] = (per[k] || 0) + (b.qty || 1); max = Math.max(max, per[k]); } });
    return max;
  }
  function openResourceModal(r) {
    const d = S.state.data; const isEdit = !!r; const keys = S.periodKeys();
    const f = r ? JSON.parse(JSON.stringify(r)) : { name: '', type: 'room', quantity: 1, group: '', manager: '', capacity: 0, color: APP_DATA.PALETTE[1], availablePeriods: keys.slice(), notice: '', priorityRule: null, active: true };
    const pr = f.priorityRule || { grades: [], weekdays: [] };
    const body = document.createElement('form'); body.className = 'form'; body.noValidate = true;
    body.innerHTML = `
      <div class="form-grid">
        <label>이름<input name="name" maxlength="20" value="${esc(f.name)}" placeholder="예: 과학실1" required></label>
        <label>유형<select name="type">${opt('room', '공간형(교실·강당)', f.type === 'room')}${opt('equipment', '수량형(기자재 세트)', f.type === 'equipment')}</select></label>
        <label class="qty-wrap">보유 수량<input type="number" name="quantity" min="1" max="99" step="1" value="${f.quantity}"></label>
        <label>그룹(대안 추천용)<input name="group" maxlength="12" value="${esc(f.group)}" placeholder="예: 과학실" list="group-list"><datalist id="group-list">${[...new Set(d.resources.map(x => x.group).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
        <label>담당 교사<input name="manager" maxlength="12" value="${esc(f.manager)}" list="teacher-list"><datalist id="teacher-list">${d.teachers.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist></label>
        <label>수용 인원<input type="number" name="capacity" min="0" max="999" step="1" value="${f.capacity || 0}"></label>
      </div>
      <div class="field"><span class="lbl">색상</span><div class="palette">${APP_DATA.PALETTE.map(c => `<label class="swatch" style="--sw:${c}"><input type="radio" name="color" value="${c}"${c === f.color ? ' checked' : ''}><span></span></label>`).join('')}</div></div>
      <div class="field"><span class="lbl">사용 가능 교시</span><div class="check-grid">${keys.map(k => `<label><input type="checkbox" name="per" value="${k}"${f.availablePeriods.includes(k) ? ' checked' : ''}> ${esc(S.periodLabel(k))}</label>`).join('')}</div></div>
      <label>주의사항<input name="notice" maxlength="80" value="${esc(f.notice)}"></label>
      <div class="field"><span class="lbl">우선 학년·요일 규칙(선택)</span><div class="row wrap"><span class="muted small">학년</span>${[1, 2, 3, 4, 5, 6].map(g => `<label><input type="checkbox" name="pg" value="${g}"${pr.grades.includes(g) ? ' checked' : ''}> ${g}</label>`).join('')}<span class="muted small">요일</span>${[1, 2, 3, 4, 5].map(w => `<label><input type="checkbox" name="pw" value="${w}"${pr.weekdays.includes(w) ? ' checked' : ''}> ${S.DAY_KO[w]}</label>`).join('')}</div><p class="muted small">둘 다 선택하면 다른 학년이 해당 요일에 예약할 때 노란 경고를 표시합니다(저장은 허용).</p></div>
      <div class="validate" aria-live="polite"></div>`;
    const m = S.openModal({ title: isEdit ? '자원 수정' : '자원 추가', body, footer: '<button type="button" class="btn" data-result="">취소</button><button type="button" class="btn btn-primary" data-act="save">저장</button>', cls: 'modal-lg' });
    const q = n => body.elements[n]; const saveBtn = S.$('[data-act="save"]', m.foot);
    const read = () => {
      f.name = q('name').value.trim(); f.type = q('type').value; S.$('.qty-wrap', body).hidden = f.type !== 'equipment';
      f.quantity = f.type === 'room' ? 1 : S.clamp(Math.floor(Number(q('quantity').value)) || 1, 1, 99);
      f.group = q('group').value.trim(); f.manager = q('manager').value.trim(); f.capacity = S.clamp(Math.floor(Number(q('capacity').value)) || 0, 0, 999);
      f.color = (S.$('input[name="color"]:checked', body) || {}).value || APP_DATA.PALETTE[1];
      f.availablePeriods = S.$$('input[name="per"]:checked', body).map(x => Number(x.value)); f.notice = q('notice').value.trim();
      const g = S.$$('input[name="pg"]:checked', body).map(x => Number(x.value)), w = S.$$('input[name="pw"]:checked', body).map(x => Number(x.value));
      f.priorityRule = g.length && w.length ? { grades: g, weekdays: w } : null;
      const errs = [];
      if (!f.name) errs.push('이름을 입력하세요'); else if (d.resources.some(x => x !== r && x.name === f.name)) errs.push('같은 이름의 자원이 이미 있습니다');
      if (!f.availablePeriods.length) errs.push('사용 가능 교시를 1개 이상 선택하세요');
      if (isEdit) {
        const mc = maxConcurrent(r.id);
        if (f.type === 'equipment' && f.quantity < mc) errs.push(`최대 동시 사용 ${mc}건인 예약이 있어 수량을 ${mc} 미만으로 줄일 수 없습니다`);
        if (f.type === 'room' && r.type === 'equipment' && mc > 1) errs.push(`같은 교시에 ${mc}건이 겹치는 예약이 있어 공간형으로 바꿀 수 없습니다`);
        const removed = r.availablePeriods.filter(p => !f.availablePeriods.includes(p));
        const hit = d.bookings.filter(b => b.resourceId === r.id && removed.some(p => p >= b.periodStart && p <= b.periodEnd)).length;
        if (hit) errs.push(`해제하려는 교시에 예약 ${hit}건이 있어 변경할 수 없습니다`);
      }
      S.$('.validate', body).innerHTML = errs.length ? `<div class="bad"><ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<div class="ok">저장할 수 있습니다</div>';
      saveBtn.disabled = errs.length > 0; return errs;
    };
    body.addEventListener('input', read); body.addEventListener('change', read); body.addEventListener('submit', e => e.preventDefault());
    m.foot.addEventListener('click', e => {
      if (!e.target.closest('[data-act="save"]') || read().length) return;
      const rec = { name: f.name, type: f.type, quantity: f.quantity, group: f.group, manager: f.manager, capacity: f.capacity, color: f.color, availablePeriods: f.availablePeriods.sort((a, b) => a - b), notice: f.notice, priorityRule: f.priorityRule, updatedAt: Date.now() };
      if (isEdit) Object.assign(r, rec); else d.resources.push(Object.assign({ id: S.uid('r'), active: true }, rec));
      S.save(); m.close('saved'); renderResources(); S.showToast(isEdit ? '자원을 수정했습니다.' : '자원을 추가했습니다.', 'success');
    });
    read();
  }
  function openClassModal(c) {
    const d = S.state.data; const isEdit = !!c;
    const nextRoom = g => Math.max(0, ...d.classes.filter(x => x.grade === g).map(x => x.room)) + 1; // 추가 시 비어 있는 다음 반 번호
    const body = document.createElement('form'); body.className = 'form'; body.noValidate = true;
    body.innerHTML = `<div class="form-grid"><label>학년<select name="grade">${[1, 2, 3, 4, 5, 6].map(g => opt(g, `${g}학년`, c ? c.grade === g : g === 1)).join('')}</select></label>
      <label>반<input type="number" name="room" min="1" max="30" step="1" value="${c ? c.room : Math.min(30, nextRoom(1))}"></label>
      <label>담임<select name="teacherId">${opt('', '미지정', !c || !c.teacherId)}${d.teachers.map(x => opt(x.id, `${x.name} (${x.role})`, c && c.teacherId === x.id)).join('')}</select></label></div><div class="validate"></div>`;
    const m = S.openModal({ title: isEdit ? '학급 수정' : '학급 추가', body, footer: '<button type="button" class="btn" data-result="">취소</button><button type="button" class="btn btn-primary" data-act="save">저장</button>' });
    const q = n => body.elements[n]; const saveBtn = S.$('[data-act="save"]', m.foot);
    const read = () => {
      const grade = Number(q('grade').value), room = S.clamp(Math.floor(Number(q('room').value)) || 1, 1, 30); q('room').value = room; const id = `${grade}-${room}`;
      const dup = d.classes.some(x => x !== c && x.id === id); S.$('.validate', body).innerHTML = dup ? `<div class="bad">${id} 학급이 이미 있습니다</div>` : ''; saveBtn.disabled = dup;
      return { id, grade, room, teacherId: q('teacherId').value, dup };
    };
    body.addEventListener('input', read); body.addEventListener('change', read); body.addEventListener('submit', e => e.preventDefault());
    m.foot.addEventListener('click', e => {
      if (!e.target.closest('[data-act="save"]')) return; const v = read(); if (v.dup) return;
      if (isEdit) { if (c.id !== v.id) { d.bookings.forEach(b => { if (b.classId === c.id) b.classId = v.id; }); d.series.forEach(s => { if (s.classId === c.id) s.classId = v.id; }); } Object.assign(c, { id: v.id, grade: v.grade, room: v.room, teacherId: v.teacherId }); }
      else d.classes.push({ id: v.id, grade: v.grade, room: v.room, teacherId: v.teacherId });
      S.save(); m.close('saved'); renderResources(); S.showToast(isEdit ? '학급을 수정했습니다.' : '학급을 추가했습니다.', 'success');
    });
    read();
  }
  function openTeacherModal(t) {
    const d = S.state.data; const isEdit = !!t;
    const body = document.createElement('form'); body.className = 'form'; body.noValidate = true;
    body.innerHTML = `<div class="form-grid"><label>이름<input name="name" maxlength="12" value="${esc(t ? t.name : '')}" required></label><label>담당<input name="role" maxlength="12" value="${esc(t ? t.role : '담임')}" list="role-list" placeholder="담임 / 과학 전담"><datalist id="role-list">${[...new Set(d.teachers.map(x => x.role))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label></div><div class="validate"></div>`;
    const m = S.openModal({ title: isEdit ? '교사 수정' : '교사 추가', body, footer: '<button type="button" class="btn" data-result="">취소</button><button type="button" class="btn btn-primary" data-act="save">저장</button>' });
    const q = n => body.elements[n]; const saveBtn = S.$('[data-act="save"]', m.foot);
    let touched = isEdit; // 입력 전에는 '이름을 입력하세요'를 오류로 보이지 않게
    const read = () => { const name = q('name').value.trim(); const err = !name ? '이름을 입력하세요' : d.teachers.some(x => x !== t && x.name === name) ? '같은 이름의 교사가 이미 있습니다' : ''; S.$('.validate', body).innerHTML = err && touched ? `<div class="bad">${err}</div>` : ''; saveBtn.disabled = !!err; return { name, role: q('role').value.trim() || '담임', err }; };
    body.addEventListener('input', () => { touched = true; read(); }); body.addEventListener('submit', e => e.preventDefault());
    m.foot.addEventListener('click', e => {
      if (!e.target.closest('[data-act="save"]')) return; const v = read(); if (v.err) return;
      if (isEdit) Object.assign(t, { name: v.name, role: v.role }); else d.teachers.push({ id: S.uid('t'), name: v.name, role: v.role });
      S.save(); m.close('saved'); renderResources(); S.showToast(isEdit ? '교사를 수정했습니다.' : '교사를 추가했습니다.', 'success');
    });
    read();
  }

  // ═════════ 통계·보고(SVG 직접 생성)
  const pct = v => v == null ? '-' : `${v}%`;
  const heatLevel = (v, max) => !v ? 0 : v <= max * 0.25 ? 1 : v <= max * 0.5 ? 2 : v <= max * 0.75 ? 3 : 4;
  // (1) 자원별 가동률 가로 막대
  function svgRateBars(st) {
    const rows = st.perResource; const W = 640, L = 150, BW = 400, RH = 30; const H = rows.length * RH + 10;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="자원별 가동률">${rows.map((r, i) => { const y = i * RH + 6; const w = r.rate == null ? 0 : Math.max(0, Math.min(BW, BW * r.rate / 100)); return `<text x="${L - 8}" y="${y + 15}" text-anchor="end" class="lbl">${esc(r.name)}</text><rect x="${L}" y="${y}" width="${BW}" height="18" class="track"/><rect x="${L}" y="${y}" width="${w}" height="18" class="bar c${i % 6 + 1}" data-tip="${esc(r.name)}: 사용 ${r.used} / 가용 ${r.available}교시 (${pct(r.rate)})"/><text x="${L + w + 6}" y="${y + 14}" class="val">${pct(r.rate)}</text>`; }).join('')}</svg>`;
  }
  // (2) 학급×자원 히트맵(학년 평균 50% 미만 '저조')
  function svgHeatmap(st) {
    const cols = st.resources; const rows = st.classes; const CW = 52, RH = 26, L = 48, T = 84; const W = L + cols.length * CW + 76, H = T + rows.length * RH + 6;
    let max = 1; rows.forEach(c => cols.forEach(r => { max = Math.max(max, st.matrix[`${c.id}|${r.id}`] || 0); }));
    const lowSet = new Set(st.low.map(x => `${x.classId}|${x.resourceId}`));
    // '저조' 칸은 빨간 테두리 + 우상단 모서리 삼각형(.lowmark)으로 표시해 숫자와 겹치지 않게 한다
    const mark = (x, y) => `<polygon class="lowmark" points="${x + CW - 11},${y} ${x + CW - 2},${y} ${x + CW - 2},${y + 9}"><title>저조</title></polygon>`;
    return `<svg class="chart heat" viewBox="0 0 ${W} ${H}" style="width:${W}px" role="img" aria-label="학급별 자원 이용 횟수 히트맵">
      ${cols.map((r, i) => `<text transform="translate(${L + i * CW + CW / 2 + 4} ${T - 6}) rotate(-40)" class="lbl small">${esc(r.name.length > 9 ? r.name.slice(0, 9) + '…' : r.name)}</text>`).join('')}
      ${rows.map((c, j) => `<text x="${L - 6}" y="${T + j * RH + 17}" text-anchor="end" class="lbl">${esc(c.id)}</text>${cols.map((r, i) => { const k = `${c.id}|${r.id}`; const v = st.matrix[k] || 0; const low = lowSet.has(k); const x = L + i * CW, y = T + j * RH; return `<rect x="${x}" y="${y}" width="${CW - 2}" height="${RH - 2}" class="h h${heatLevel(v, max)}${low ? ' low' : ''}" data-tip="${esc(c.id)} × ${esc(r.name)}: ${v}회 (${c.grade}학년 평균 ${Math.round((st.avgMap[k] || 0) * 10) / 10}회)${low ? ' · 저조' : ''}"/><text x="${x + (CW - 2) / 2}" y="${y + 16}" text-anchor="middle" class="hv${v ? '' : ' zero'}">${v ? v : '·'}</text>${low ? mark(x, y) : ''}`; }).join('')}`).join('')}</svg>`;
  }
  // (4) 학년별 이용 횟수 세로 막대
  function svgGradeBars(st) {
    const W = 460, H = 180, L = 36, BW = 48, GAP = 22, base = 150; const max = Math.max(1, ...st.gradeCounts.slice(1));
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="학년별 이용 횟수">${[1, 2, 3, 4, 5, 6].map(g => { const v = st.gradeCounts[g]; const h = Math.round(120 * v / max); const x = L + (g - 1) * (BW + GAP); return `<rect x="${x}" y="${base - h}" width="${BW}" height="${h}" class="bar g${g}" data-tip="${g}학년: ${v}건"/><text x="${x + BW / 2}" y="${base - h - 5}" text-anchor="middle" class="val">${v}</text><text x="${x + BW / 2}" y="${base + 16}" text-anchor="middle" class="lbl">${g}학년</text>`; }).join('')}<line x1="${L - 4}" y1="${base}" x2="${W}" y2="${base}" class="axis"/></svg>`;
  }
  // (5) 요일×교시 혼잡도 히트맵
  function svgCongestion(st) {
    const keys = S.periodKeys(); const CW = 64, RH = 24, L = 64, T = 24; const W = L + 5 * CW + 6, H = T + keys.length * RH + 4;
    return `<svg class="chart heat" viewBox="0 0 ${W} ${H}" style="width:${W}px" role="img" aria-label="요일×교시 혼잡도">${[1, 2, 3, 4, 5].map(w => `<text x="${L + (w - 1) * CW + CW / 2}" y="16" text-anchor="middle" class="lbl">${S.DAY_KO[w]}</text>`).join('')}
      ${keys.map((p, j) => `<text x="${L - 6}" y="${T + j * RH + 16}" text-anchor="end" class="lbl small">${esc(S.periodLabel(p))}</text>${[1, 2, 3, 4, 5].map(w => { const v = st.congestion[`${w}|${p}`] || 0; return `<rect x="${L + (w - 1) * CW}" y="${T + j * RH}" width="${CW - 2}" height="${RH - 2}" class="h h${heatLevel(v, st.congMax || 1)}" data-tip="${S.DAY_KO[w]}요일 ${esc(S.periodLabel(p))}: ${v}건"/><text x="${L + (w - 1) * CW + (CW - 2) / 2}" y="${T + j * RH + 15}" text-anchor="middle" class="hv${v ? '' : ' zero'}">${v || '·'}</text>`; }).join('')}`).join('')}</svg>`;
  }
  const lowListHtml = st => st.low.length ? `<ul class="low-list">${st.low.sort((a, b) => a.classId.localeCompare(b.classId)).map(x => `<li><b>${esc(x.classId)}</b> — ${esc(x.resourceName)} ${x.count}회 <span class="muted">(${x.classId[0]}학년 평균 ${x.avg}회)</span></li>`).join('')}</ul>` : '<p class="ok-text">학년 평균의 50% 미만인 학급이 없습니다.</p>';
  function renderStats() {
    const root = view('stats'); const d = S.state.data; const ui = S.state.ui; const rg = S.statsRange();
    const months = S.semesterMonths(); if (ui.statsRange.mode === 'month' && !months.includes(ui.statsRange.month)) ui.statsRange.month = months[0] || '';
    const st = S.computeStats(rg.from, rg.to, ui.statsResource); const sm = st.summary;
    const controls = `<div class="stats-controls card">
      <label>기간<select data-stats="mode">${opt('semester', '학기 전체', ui.statsRange.mode === 'semester')}${opt('month', '월 선택', ui.statsRange.mode === 'month')}</select></label>
      <label${ui.statsRange.mode === 'month' ? '' : ' hidden'}>월<select data-stats="month">${months.map(mm => opt(mm, `${Number(mm.slice(0, 4))}년 ${Number(mm.slice(5))}월`, mm === ui.statsRange.month)).join('')}</select></label>
      <label>자원<select data-stats="resource">${opt('all', '전체 자원', ui.statsResource === 'all')}${d.resources.map(r => opt(r.id, r.name + (r.active ? '' : ' (비활성)'), ui.statsResource === r.id)).join('')}</select></label>
      <span class="muted">${esc(rg.label)} · 수업일 ${st.schoolDays}일</span>
      <div class="row grow-end"><button type="button" class="btn" data-act="stats-csv">집계 CSV 내보내기</button><button type="button" class="btn btn-primary" data-act="stats-print">실적 보고 인쇄</button></div></div>`;
    if (!d.resources.length || !sm.count) {
      root.innerHTML = `${controls}<div class="empty card"><h2>데이터 없음</h2><p>${d.resources.length ? '선택한 기간·자원에 예약이 없습니다. 기간을 바꾸거나 예약판에서 예약을 등록하세요.' : '자원과 예약이 없어 통계를 계산할 수 없습니다.'}</p></div>`; return;
    }
    root.innerHTML = `${controls}
      <div class="kpi-row">
        <div class="kpi"><span>예약 건수</span><b>${sm.count}</b><small>건</small></div><div class="kpi"><span>사용 교시</span><b>${sm.usedPeriods}</b><small>교시</small></div>
        <div class="kpi"><span>평균 가동률</span><b>${sm.avgRate == null ? '-' : sm.avgRate}</b><small>%</small></div><div class="kpi"><span>미사용률</span><b>${sm.unusedRate == null ? '-' : sm.unusedRate}</b><small>% (${sm.unused}/${sm.checked}건${sm.pastUnchecked ? `, 미확인 ${sm.pastUnchecked}` : ''})</small></div>
      </div>
      <div class="split">
        <section class="card"><h2>자원별 가동률</h2><p class="muted small">사용 교시 ÷ 가용 교시(수업일 × 사용 가능 교시 − 차단 교시, 수량형은 × 보유 수량)</p><div class="chart-wrap">${svgRateBars(st)}</div></section>
        <section class="card"><h2>학년별 이용 횟수</h2><p class="muted small">학급 또는 '학년 전체' 예약 건수</p><div class="chart-wrap">${svgGradeBars(st)}</div></section>
      </div>
      <section class="card"><h2>학급 × 자원 이용 형평성 히트맵</h2><p class="muted small">칸의 숫자는 예약 건수. 같은 학년 평균의 50% 미만(평균 2건 이상)이면 빨간 테두리와 모서리 표시로 '저조'를 나타냅니다.</p><div class="chart-wrap">${svgHeatmap(st)}</div>
        <h3>이용 저조 학급 <small class="muted">${st.low.length}건</small></h3>${lowListHtml(st)}</section>
      <section class="card"><h2>요일 × 교시 혼잡도</h2><p class="muted small">교시 단위 예약 건수(수량 무시), 최댓값 기준 5단계 농도</p><div class="chart-wrap narrow">${svgCongestion(st)}</div></section>`;
  }
  function reportHtml() {
    const d = S.state.data; const s = d.settings; const rg = S.statsRange(); const st = S.computeStats(rg.from, rg.to, S.state.ui.statsResource); const sm = st.summary;
    return `<section class="print-page portrait-page"><header class="print-head"><div><p class="school">${esc(s.schoolName)}</p><h1>${s.schoolYear}학년도 ${s.semester}학기 특별실 운영 실적 보고서</h1>
      <p class="meta">집계 기간 ${esc(rg.label)} (${S.fmtMD(rg.from)}~${S.fmtMD(rg.to)}, 수업일 ${st.schoolDays}일) · 출력일 ${S.fmtKo(S.todayStr())}</p></div>${B.approvalHtml()}</header>
      <h2>1. 요약</h2><table class="rep"><tr><th>예약 건수</th><th>사용 교시</th><th>평균 가동률</th><th>미사용률</th></tr><tr><td>${sm.count}건</td><td>${sm.usedPeriods}교시</td><td>${pct(sm.avgRate)}</td><td>${pct(sm.unusedRate)} (${sm.unused}/${sm.checked}건)</td></tr></table>
      <h2>2. 자원별 운영 실적</h2><table class="rep"><thead><tr><th>자원</th><th>예약 건수</th><th>사용 교시</th><th>가용 교시</th><th>가동률</th><th>미사용 건</th></tr></thead><tbody>${st.perResource.map(r => `<tr><td class="l">${esc(r.name)}${r.active ? '' : ' (비활성)'}</td><td>${r.count}</td><td>${r.used}</td><td>${r.available}</td><td>${pct(r.rate)}</td><td>${r.unused}</td></tr>`).join('')}</tbody></table>
      <h2>3. 학년별 이용 횟수</h2><table class="rep"><tr>${[1, 2, 3, 4, 5, 6].map(g => `<th>${g}학년</th>`).join('')}</tr><tr>${[1, 2, 3, 4, 5, 6].map(g => `<td>${st.gradeCounts[g]}건</td>`).join('')}</tr></table>
      <h2>4. 학급 × 자원 이용 형평성</h2><div class="rep-chart">${svgHeatmap(st)}</div>
      <h3>이용 저조 학급(학년 평균의 50% 미만)</h3>${st.low.length ? `<table class="rep"><thead><tr><th>학급</th><th>자원</th><th>이용 횟수</th><th>학년 평균</th></tr></thead><tbody>${st.low.map(x => `<tr><td>${esc(x.classId)}</td><td class="l">${esc(x.resourceName)}</td><td>${x.count}회</td><td>${x.avg}회</td></tr>`).join('')}</tbody></table>` : '<p>해당 없음</p>'}
      <p class="print-foot">특별실지기에서 자동 집계 · 미사용률 = 사용 안 함 건수 ÷ 사용 여부 확인 건수</p></section>`;
  }
  function initStats() {
    const root = view('stats'); const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; document.body.appendChild(tip);
    root.addEventListener('change', e => {
      const k = e.target.dataset.stats; if (!k) return; const ui = S.state.ui;
      if (k === 'mode') { ui.statsRange.mode = e.target.value; if (ui.statsRange.mode === 'month' && !ui.statsRange.month) ui.statsRange.month = (S.semesterMonths().find(mm => mm === S.todayStr().slice(0, 7)) || S.semesterMonths()[0] || ''); }
      else if (k === 'month') ui.statsRange.month = e.target.value; else if (k === 'resource') ui.statsResource = e.target.value;
      S.saveUi(); renderStats();
    });
    root.addEventListener('click', e => {
      const act = e.target.closest('[data-act]'); if (!act) return;
      if (act.dataset.act === 'stats-print') B.openPrintPreview({ title: '운영 실적 보고서 인쇄 미리보기', orientation: 'portrait', build: reportHtml });
      else if (act.dataset.act === 'stats-csv') {
        const rg = S.statsRange(); const st = S.computeStats(rg.from, rg.to, S.state.ui.statsResource);
        const rows = [['자원', '예약 건수', '사용 교시', '가용 교시', '가동률(%)', '미사용 건', '집계 기간'], ...st.perResource.map(r => [r.name, r.count, r.used, r.available, r.rate == null ? '' : r.rate, r.unused, `${rg.from}~${rg.to}`])];
        S.dl(`special-room-booking_stats_${S.stamp()}.csv`, S.toCsv(rows), 'text/csv;charset=utf-8'); S.showToast('집계 CSV를 내보냈습니다.', 'success');
      }
    });
    const move = e => { const el = e.target.closest ? e.target.closest('[data-tip]') : null; if (!el) { tip.hidden = true; return; } tip.textContent = el.dataset.tip; tip.hidden = false; const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8); tip.style.left = `${x}px`; tip.style.top = `${e.clientY + 16}px`; };
    root.addEventListener('mousemove', move); root.addEventListener('mouseleave', () => { tip.hidden = true; });
  }

  // ═════════ 설정·데이터
  function renderSettings() {
    const root = view('settings'); const s = S.state.data.settings;
    root.innerHTML = `
      <div class="split">
        <section class="card"><h2>학교·학기 정보</h2><form class="form" data-form="school" novalidate>
          <div class="form-grid"><label>학교명<input name="schoolName" maxlength="20" value="${esc(s.schoolName)}" required></label><label>학년도<input type="number" name="schoolYear" min="2000" max="2100" value="${s.schoolYear}"></label>
          <label>학기<select name="semester">${opt(1, '1학기', s.semester === 1)}${opt(2, '2학기', s.semester === 2)}</select></label><label>학기 시작일<input type="date" name="semesterStart" value="${s.semesterStart}"></label><label>학기 종료일<input type="date" name="semesterEnd" value="${s.semesterEnd}"></label></div>
          <div class="validate"></div><div class="row"><button type="submit" class="btn btn-primary">학교 정보 저장</button></div></form></section>
        <section class="card"><h2>결재란</h2><form class="form" data-form="approval" novalidate><p class="muted small">인쇄 서식 우측 상단 결재란의 직위(1~4칸)</p>
          <div class="row"><label>칸 수<select name="count">${[1, 2, 3, 4].map(n => opt(n, `${n}칸`, s.approvalLine.length === n)).join('')}</select></label></div>
          <div class="form-grid approval-inputs">${[0, 1, 2, 3].map(i => `<label${i < s.approvalLine.length ? '' : ' hidden'}>${i + 1}번째<input name="a${i}" maxlength="8" value="${esc(s.approvalLine[i] || '')}"></label>`).join('')}</div>
          <div class="validate"></div><div class="row"><button type="submit" class="btn btn-primary">결재란 저장</button></div></form></section>
      </div>
      <section class="card"><h2>교시 구조</h2><form class="form" data-form="periods" novalidate><p class="muted small">교시 개수 4~10. 줄이려는 범위에 예약이 있으면 변경이 차단됩니다.</p>
        <div class="row"><label>교시 개수<input type="number" name="count" min="4" max="10" value="${s.periods.length}"></label></div>
        <div class="table-wrap"><table class="table periods"><thead><tr><th>순번</th><th>라벨</th><th>시간</th></tr></thead><tbody>${s.periods.map((p, i) => `<tr><td>${i + 1}</td><td><input name="label${i}" maxlength="8" value="${esc(p.label)}"></td><td><input name="time${i}" maxlength="13" value="${esc(p.time || '')}" placeholder="09:00~09:40"></td></tr>`).join('')}</tbody></table></div>
        <div class="validate"></div><div class="row"><button type="submit" class="btn btn-primary">교시 구조 저장</button></div></form></section>
      <section class="card"><h2>데이터 보관·인계</h2>
        <div class="data-grid">
          <div><h3>내보내기</h3><p class="muted small">JSON은 전체 백업(자원·명단·일정·예약·설정), CSV는 예약 목록(엑셀용 UTF-8 BOM).</p><div class="row"><button type="button" class="btn btn-primary" data-act="export-json">JSON 내보내기</button><button type="button" class="btn" data-act="export-csv">예약 CSV 내보내기</button></div></div>
          <div><h3>가져오기</h3><div class="dropzone" tabindex="0" role="button" aria-label="JSON 파일 드롭 또는 선택"><p><b>JSON 파일을 여기에 끌어다 놓거나</b> 클릭해 선택하세요</p><p class="muted small">검증 후 '교체' 또는 '병합(같은 id는 최신 우선)'을 선택합니다</p><input type="file" accept=".json,application/json" hidden></div></div>
        </div>
        <div class="danger-zone"><div><h3>새 학기 초기화</h3><p class="muted small">예약·정기 예약·학사일정만 삭제하고 자원·학급·교사·설정은 유지합니다.</p></div><button type="button" class="btn btn-danger-outline" data-act="reset-semester">새 학기 초기화</button>
          <div><h3>샘플 데이터 복원</h3><p class="muted small">내장된 가온초등학교 샘플(자원 10개·예약 약 220건)로 되돌립니다.</p></div><button type="button" class="btn" data-act="load-sample">샘플 데이터 복원</button></div>
      </section>
      <section class="card guide"><h2>운영 방법 안내</h2><div class="split">
        <div><h3>공용 PC 1대 운영</h3><p>교무실 공용 PC의 브라우저에서 index.html을 열어 두고 모든 교사가 같은 화면에서 예약합니다. 데이터는 그 PC의 브라우저(localStorage)에 저장되므로 주 1회 JSON 내보내기로 백업하세요.</p></div>
        <div><h3>담당자 PC + JSON 공유 드라이브</h3><p>담당 교사가 예약을 입력하고 JSON을 공유 드라이브에 보관합니다. 다른 PC에서는 '가져오기 → 교체'로 최신 파일을 읽어 조회·인쇄하며, 두 사람이 각각 입력했다면 '병합'으로 합칩니다(같은 예약은 최신 수정이 우선).</p></div>
      </div><p class="muted small">역할 안내: 자원·일정·설정은 담당 부서(관리자), 예약 등록·사용 여부 체크는 예약자(담임·전담)가 맡는 것을 권장합니다. 실시간 동시 편집·로그인은 지원하지 않습니다.</p></section>`;
  }
  function initSettings() {
    const root = view('settings');
    root.addEventListener('submit', e => {
      e.preventDefault(); const form = e.target; const d = S.state.data; const s = d.settings; const q = n => form.elements[n]; const out = S.$('.validate', form); const errs = [];
      if (form.dataset.form === 'school') {
        const v = { schoolName: q('schoolName').value.trim(), schoolYear: Number(q('schoolYear').value), semester: Number(q('semester').value), semesterStart: q('semesterStart').value, semesterEnd: q('semesterEnd').value };
        if (!v.schoolName) errs.push('학교명을 입력하세요'); if (!(v.schoolYear >= 2000 && v.schoolYear <= 2100)) errs.push('학년도는 2000~2100 사이로 입력하세요');
        if (!S.isValidDate(v.semesterStart) || !S.isValidDate(v.semesterEnd)) errs.push('학기 시작·종료일을 입력하세요'); else if (v.semesterStart >= v.semesterEnd) errs.push('학기 종료일은 시작일보다 뒤여야 합니다');
        if (errs.length) { out.innerHTML = `<div class="bad"><ul>${errs.map(x => `<li>${x}</li>`).join('')}</ul></div>`; return; }
        const outside = d.bookings.filter(b => b.date < v.semesterStart || b.date > v.semesterEnd).length;
        Object.assign(s, v); S.state.ui.weekStart = null; S.save(); renderHeader(); out.innerHTML = '<div class="ok">저장했습니다</div>';
        S.showToast(outside ? `저장했습니다. 학기 밖 예약 ${outside}건은 격자에서 흐리게 표시됩니다.` : '학교 정보를 저장했습니다.', outside ? 'warn' : 'success');
      } else if (form.dataset.form === 'approval') {
        const n = Number(q('count').value); const line = []; for (let i = 0; i < n; i++) line.push(q(`a${i}`).value.trim());
        if (line.some(x => !x)) { out.innerHTML = '<div class="bad">결재란 직위를 모두 입력하세요</div>'; return; }
        s.approvalLine = line; S.save(); out.innerHTML = '<div class="ok">저장했습니다</div>'; S.showToast('결재란을 저장했습니다.', 'success');
      } else if (form.dataset.form === 'periods') {
        const n = S.clamp(Math.floor(Number(q('count').value)) || 8, 4, 10);
        const hit = d.bookings.filter(b => b.periodEnd > n).length;
        if (hit) { out.innerHTML = `<div class="bad">${esc(S.periodLabel(n + 1))} 이후에 예약 ${hit}건이 있어 교시 개수를 ${n}개로 줄일 수 없습니다. 해당 예약을 먼저 정리하세요.</div>`; return; }
        const periods = []; for (let i = 0; i < n; i++) { const old = s.periods[i]; const lab = q(`label${i}`) ? q(`label${i}`).value.trim() : ''; periods.push({ key: i + 1, label: lab || (old ? old.label : `${i + 1}교시`), time: q(`time${i}`) ? q(`time${i}`).value.trim() : (old ? old.time : '') }); }
        if (periods.some(p => !p.label)) { out.innerHTML = '<div class="bad">교시 라벨을 모두 입력하세요</div>'; return; }
        const prevN = s.periods.length; s.periods = periods; let cleaned = 0;
        d.resources.forEach(r => { // 범위 밖 교시는 제거하고, 전체 사용이던 자원은 새 교시도 사용 가능으로 확장
          const wasAll = r.availablePeriods.length >= prevN; r.availablePeriods = r.availablePeriods.filter(p => p <= n);
          if (wasAll) for (let p = prevN + 1; p <= n; p++) r.availablePeriods.push(p);
          if (!r.availablePeriods.length) r.availablePeriods = periods.map(p => p.key);
        });
        if (n < prevN) { // 축소 시 행사 차단 교시·정기 예약 정의의 범위 밖 교시도 정리
          d.events.forEach(ev => { if (!Array.isArray(ev.blockPeriods)) return; const kept = ev.blockPeriods.filter(p => p <= n); if (kept.length !== ev.blockPeriods.length) { cleaned++; ev.blockPeriods = kept.length ? kept : 'all'; if (!kept.length) ev.blockResourceIds = []; } });
          d.series.forEach(sr => { if (sr.periodEnd > n) { cleaned++; sr.periodEnd = n; sr.periodStart = Math.min(sr.periodStart, n); } });
        }
        S.save(); renderSettings(); S.showToast(`교시 구조를 저장했습니다(${n}교시).${cleaned ? ` 범위 밖 교시를 쓰던 행사·정기 예약 정의 ${cleaned}건을 정리했습니다.` : ''}`, 'success', cleaned ? 4000 : 2500);
      }
    });
    root.addEventListener('change', e => {
      if (e.target.name === 'count' && e.target.closest('[data-form="approval"]')) { const n = Number(e.target.value); S.$$('.approval-inputs label', root).forEach((l, i) => { l.hidden = i >= n; }); }
      if (e.target.name === 'count' && e.target.closest('[data-form="periods"]')) {
        const n = S.clamp(Math.floor(Number(e.target.value)) || 8, 4, 10); const tb = S.$('.periods tbody', root); const cur = tb.rows.length;
        for (let i = cur; i < n; i++) tb.insertAdjacentHTML('beforeend', `<tr><td>${i + 1}</td><td><input name="label${i}" maxlength="8" value="${i + 1}교시"></td><td><input name="time${i}" maxlength="13" placeholder="09:00~09:40"></td></tr>`);
        while (tb.rows.length > n) tb.deleteRow(-1);
      }
      if (e.target.type === 'file' && e.target.files[0]) { importFile(e.target.files[0]); e.target.value = ''; }
    });
    root.addEventListener('click', e => {
      const dz = e.target.closest('.dropzone'); if (dz) { S.$('input[type="file"]', dz).click(); return; }
      const act = e.target.closest('[data-act]'); if (!act) return;
      ({ 'export-json': exportJson, 'export-csv': exportCsv, 'reset-semester': resetSemester, 'load-sample': () => S.loadSample(true) }[act.dataset.act] || (() => {}))();
    });
    root.addEventListener('keydown', e => { if (e.target.classList.contains('dropzone') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); S.$('input[type="file"]', e.target).click(); } });
    ['dragenter', 'dragover'].forEach(t => root.addEventListener(t, e => { const dz = e.target.closest('.dropzone'); if (dz) { e.preventDefault(); dz.classList.add('over'); } }));
    root.addEventListener('dragleave', e => { const dz = e.target.closest('.dropzone'); if (dz) dz.classList.remove('over'); });
    root.addEventListener('drop', e => { const dz = e.target.closest('.dropzone'); if (!dz) return; e.preventDefault(); dz.classList.remove('over'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) importFile(f); });
    // 드롭존 밖에 파일을 떨어뜨려도 브라우저가 파일로 이동하지 않게 막는다
    document.addEventListener('dragover', e => { if (!e.target.closest || !e.target.closest('.dropzone')) e.preventDefault(); });
    document.addEventListener('drop', e => { if (e.target.closest && e.target.closest('.dropzone')) return; e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) S.showToast('JSON 파일은 설정 탭의 가져오기 드롭존에 놓아 주세요.', 'info', 3000); });
  }
  function exportJson() { S.dl(`special-room-booking_${S.stamp()}.json`, JSON.stringify(S.state.data, null, 2), 'application/json'); S.showToast('JSON 파일을 내보냈습니다.', 'success'); }
  function exportCsv() {
    const rows = [['날짜', '요일', '교시', '자원', '학급', '교사', '태그', '수량', '사용여부', '메모'], ...S.state.data.bookings.slice().sort((a, b) => a.date.localeCompare(b.date) || a.periodStart - b.periodStart).map(b => [b.date, S.DAY_KO[S.dayOfWeek(b.date)], S.rangeLabel(b.periodStart, b.periodEnd), (S.resourceById(b.resourceId) || {}).name || b.resourceId, S.classLabel(b), S.teacherName(b.teacherId), b.tag, b.qty || 1, b.used === true ? '사용함' : b.used === false ? '사용 안 함' : '미확인', b.memo || ''])];
    S.dl(`special-room-booking_bookings_${S.stamp()}.csv`, S.toCsv(rows), 'text/csv;charset=utf-8'); S.showToast('예약 CSV를 내보냈습니다.', 'success');
  }
  function importFile(file) {
    const reader = new FileReader();
    reader.onerror = () => S.showToast('파일을 읽을 수 없습니다.', 'error');
    reader.onload = () => { let obj = null; try { obj = JSON.parse(String(reader.result || '')); } catch (err) { obj = null; } importData(obj, null, file.name); };
    reader.readAsText(file, 'utf-8');
  }
  // 가져오기 적용: mode가 없으면 교체/병합 선택 모달
  async function importData(obj, mode, name) {
    const err = obj ? S.validateImport(obj) : '올바른 백업 파일이 아닙니다(JSON 해석 실패 또는 빈 파일)';
    if (err) { S.showToast(err, 'error', 3500); return false; }
    const norm = S.normalizeData(obj); const inc = norm.data; // 항목 단위 검증: 손상 항목은 제외하고 기본값을 채운다
    const dropNote = norm.dropped ? `, 손상 항목 ${norm.dropped}건 제외` : '';
    if (!mode) {
      const m = S.openModal({ title: 'JSON 가져오기', body: `<p><b>${esc(name || '파일')}</b> — 예약 ${inc.bookings.length}건 · 자원 ${inc.resources.length}개 · 일정 ${inc.events.length}건${inc.meta.savedAt ? ` · 저장 ${new Date(inc.meta.savedAt).toLocaleString('ko-KR')}` : ''}</p>${norm.dropped ? `<p class="warn-text">필수 항목이 빠졌거나 형식이 틀린 손상 항목 ${norm.dropped}건은 제외됩니다.</p>` : ''}<ul class="muted small"><li><b>교체</b>: 현재 데이터를 모두 지우고 파일 내용으로 바꿉니다.</li><li><b>병합</b>: 같은 id는 수정 시각이 최신인 쪽을 남기고 나머지는 합칩니다(설정은 현재 값 유지).</li></ul>`,
        footer: '<button type="button" class="btn" data-result="">취소</button><button type="button" class="btn" data-result="merge">병합</button><button type="button" class="btn btn-danger" data-result="replace">교체</button>' });
      mode = await m.done; if (!mode) return false;
    }
    const prev = JSON.parse(JSON.stringify(S.state.data)); let conflicts = 0; // 실패 시 되돌릴 스냅샷
    try {
      if (mode === 'replace') S.state.data = inc; else conflicts = S.mergeData(inc);
      S.state.ui.weekStart = null; S.save(); S.render();
    } catch (e) {
      S.state.data = prev; S.save(); S.render(); S.showToast('가져오기 중 오류가 나서 이전 데이터로 되돌렸습니다.', 'error', 4000); return false;
    }
    S.showToast(mode === 'replace' ? `데이터를 교체했습니다(예약 ${S.state.data.bookings.length}건${dropNote}).` : `병합했습니다(예약 ${S.state.data.bookings.length}건${conflicts ? `, 초과 예약 ${conflicts}건 확인 필요` : ', 초과 예약 없음'}${dropNote}).`, conflicts || norm.dropped ? 'warn' : 'success', 3500);
    return true;
  }
  async function resetSemester() {
    const body = document.createElement('div');
    body.innerHTML = '<p>예약·정기 예약·학사일정을 <b>모두 삭제</b>합니다. 자원·학급·교사·설정은 유지됩니다. 되돌릴 수 없으니 먼저 JSON을 내보내 두세요.</p><label>확인을 위해 <b>초기화</b>를 입력하세요<input class="input" name="confirm" autocomplete="off"></label>';
    const m = S.openModal({ title: '새 학기 초기화', body, footer: '<button type="button" class="btn" data-result="">취소</button><button type="button" class="btn btn-danger" data-result="ok" disabled>초기화 실행</button>' });
    const inp = S.$('input', body); const ok = S.$('[data-result="ok"]', m.foot);
    inp.addEventListener('input', () => { ok.disabled = inp.value.trim() !== '초기화'; });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !ok.disabled) ok.click(); });
    if (await m.done !== 'ok') return false;
    const d = S.state.data; d.bookings = []; d.series = []; d.events = []; S.state.ui.weekStart = null; S.save(); S.render(); S.showToast('새 학기 초기화를 완료했습니다. 자원·명단은 유지됩니다.', 'success'); return true;
  }

  // ═════════ 온보딩·도움말·헤더·라우팅
  function showOnboarding() {
    const body = document.createElement('div');
    body.innerHTML = `<p class="lead">특별실·기자재 예약을 요일×교시 격자에서 드래그로 등록하고, 이중 예약·휴업일·행사 차단을 저장 전에 잡아내는 학교 공유 자원 예약판입니다.</p>
      <div class="onboard-choice"><button type="button" class="choice" data-result="sample"><b>샘플로 시작</b><span>가온초등학교 자원 10개·예약 약 220건으로 바로 체험</span></button><button type="button" class="choice" data-result="empty"><b>빈 상태로 시작</b><span>우리 학교 자원·학급을 직접 등록</span></button></div>
      <p class="guide-title">운영 방법 안내</p><div class="split small-gap"><div class="guide-box"><h3>공용 PC 운영</h3><p>교무실 공용 PC 브라우저에 데이터가 저장됩니다. 주 1회 JSON 백업을 권장합니다.</p></div><div class="guide-box"><h3>JSON 공유 드라이브</h3><p>담당자가 입력하고 JSON을 공유합니다. 다른 PC는 '가져오기 → 교체'로 최신 파일을 읽습니다.</p></div></div>`;
    const m = S.openModal({ title: '특별실지기에 오신 것을 환영합니다', body, cls: 'modal-lg' });
    m.done.then(v => {
      if (v !== 'sample' && v !== 'empty') { S.showToast('시작 방식을 선택해 주세요.', 'info', 1800); showOnboarding(); return; } // ESC·배경 클릭은 선택으로 보지 않음
      const mode = v;
      if (mode === 'empty') { S.state.data = S.emptyData(); S.state.ui = S.defaultUi(); }
      S.save(); S.storage.set(S.KEYS.onboard, { done: true, mode }); S.state.ui.weekStart = null; S.saveUi(); S.render();
      S.showToast(mode === 'empty' ? '빈 상태로 시작합니다. 자원 탭에서 특별실을 등록하세요.' : '샘플 데이터로 시작합니다. 격자를 드래그해 예약해 보세요.', 'info', 3500);
    });
  }
  function showHelp() {
    S.openModal({ title: '도움말 — 특별실지기 사용법', cls: 'modal-lg', body: `<ol class="help-steps">
      <li><b>자원 고르기</b> — 예약판 상단 칩에서 과학실·강당·태블릿 세트 등 자원을 선택합니다. ◀ ▶·'이번 주'·날짜 입력으로 주를 이동합니다.</li>
      <li><b>예약하기</b> — 빈 셀을 클릭하면 1교시 예약, 같은 요일에서 아래로 드래그하면 연속 교시 예약 모달이 열립니다. 학급을 고르면 담임이 자동 입력되고, 겹치면 빨간 사유와 대안 칩(같은 날 다른 교시·같은 그룹 자원·다른 요일)이 나타납니다.</li>
      <li><b>정기 예약</b> — '정기 예약'에서 요일·교시·기간을 넣고 미리보기로 휴업일 제외·충돌을 확인한 뒤 생성합니다. 시리즈 블록 삭제 시 '이 건만/이후 모두/전체'를 고릅니다.</li>
      <li><b>학사일정</b> — 공휴일·재량휴업일은 전체 자원을, 학교행사는 지정 자원·교시를 차단합니다. 저장 시 충돌 예약 수를 알려 주고 목록에서 수정·삭제할 수 있습니다.</li>
      <li><b>통계·보고</b> — 자원별 가동률, 학급×자원 형평성 히트맵('저조' 표시), 요일×교시 혼잡도를 보고 '실적 보고 인쇄'로 A4 보고서를 출력합니다. 지난 예약은 '실제 사용함/사용 안 함'을 체크해 미사용률에 반영합니다.</li>
      <li><b>인쇄·보관</b> — 예약판 '인쇄'는 교무실 게시용 주간 이용 현황표(A4 가로·결재란)를 만듭니다. 설정 탭에서 JSON 내보내기/가져오기, CSV, 새 학기 초기화를 합니다. 특별실·기자재와 학급·교사 명단은 '특별실·기자재' 탭에서 관리합니다.</li></ol>
      <p class="muted small">팁: 640px 미만 화면에서는 요일 탭으로 한 요일씩 보고 셀을 탭해 교시 범위를 select로 지정합니다. 단축키: 모달은 Esc로 닫기, 격자 빈 셀은 Tab 이동 후 Enter로 예약.</p>`, footer: '<button type="button" class="btn btn-primary" data-result="ok">확인</button>' });
  }
  function renderHeader() {
    const s = S.state.data.settings; S.$('#school-label').textContent = `${s.schoolName} · ${s.schoolYear}학년도 ${s.semester}학기`; S.renderSaveStatus();
  }
  const RENDER = { board: () => B.renderBoard(), calendar: renderCalendar, resources: renderResources, stats: renderStats, settings: renderSettings };
  function selectTab(tab) {
    if (!RENDER[tab]) tab = 'board'; S.state.ui.tab = tab; S.saveUi();
    S.$$('.tabs [role="tab"]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    S.$$('[data-view]').forEach(sec => { sec.hidden = sec.dataset.view !== tab; });
    render();
  }
  function render() { renderHeader(); (RENDER[S.state.ui.tab] || RENDER.board)(); }
  async function loadSample(confirm) {
    if (confirm && !(await S.showModal({ title: '샘플 데이터 복원', body: '<p>현재 데이터를 지우고 내장 샘플(가온초등학교)로 되돌립니다. 계속할까요?</p>', confirmText: '복원', danger: true }))) return false;
    S.buildSampleData(); S.state.ui = Object.assign(S.defaultUi(), { tab: S.state.ui.tab }); S.save(); S.saveUi(); render();
    if (confirm) S.showToast('샘플 데이터를 복원했습니다.', 'success'); return true;
  }
  Object.assign(S, { render, selectTab, loadSample, importData });

  // ═════════ 초기화
  function init() {
    S.applyTheme(S.storage.get(S.KEYS.theme, null));
    const probe = S.storage.set('srb.v1.probe', 1); S.storage.remove('srb.v1.probe'); S.state.memoryMode = !probe;
    S.state.ui = Object.assign(S.defaultUi(), S.storage.get(S.KEYS.ui, null) || {});
    if (!S.state.ui.statsRange || typeof S.state.ui.statsRange !== 'object') S.state.ui.statsRange = { mode: 'semester', month: '' };
    const saved = S.storage.get(S.KEYS.data, null); const onboarded = S.storage.get(S.KEYS.onboard, null);
    let dropped = 0;
    if (saved && !S.validateImport(saved)) { const n = S.normalizeData(saved); S.state.data = n.data; dropped = n.dropped; } // 저장 데이터도 항목 단위로 정규화해 손상 항목이 있어도 기동
    else if (onboarded && onboarded.mode === 'empty') S.state.data = S.emptyData();
    else S.buildSampleData();
    S.rebuildIndex();
    if (dropped) { S.save(); S.showToast(`저장된 데이터에서 손상 항목 ${dropped}건을 제외하고 불러왔습니다.`, 'warn', 4500); }
    B.initBoard(); initCalendar(); initResources(); initStats(); initSettings();
    S.$('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) selectTab(b.dataset.tab); });
    S.$('.tabs').addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const tabs = S.$$('.tabs [role="tab"]'); const i = tabs.findIndex(b => b.classList.contains('on'));
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; selectTab(n.dataset.tab); n.focus();
    });
    S.$('#btn-theme').addEventListener('click', S.toggleTheme);
    S.$('#btn-help').addEventListener('click', showHelp);
    S.$('#btn-data').addEventListener('click', () => selectTab('settings'));
    selectTab(S.state.ui.tab);
    if (!onboarded) showOnboarding();
    else if (S.state.memoryMode) S.showToast('저장소를 사용할 수 없어 메모리 모드로 동작합니다.', 'warn', 4000);
    // 테스트·디버그용 API(읽기 전용 스냅샷 + 주요 액션)
    window.__app = {
      version: S.VERSION,
      getState: () => JSON.parse(JSON.stringify({ data: S.state.data, ui: S.state.ui, memoryMode: S.state.memoryMode })),
      actions: {
        selectTab, selectResource: id => { S.state.ui.selectedResourceId = id; S.saveUi(); render(); }, goWeek: date => { S.state.ui.weekStart = S.mondayOf(date); S.saveUi(); render(); },
        checkConflict: (resourceId, date, pStart, pEnd, qty, excludeId, classId) => S.checkConflict(S.resourceById(resourceId), date, pStart, pEnd, qty || 1, excludeId || null, classId || ''),
        suggestAlternatives: S.suggestAlternatives, expandSeries: S.expandSeries, computeStats: (from, to, f) => S.computeStats(from, to, f || 'all'), statsRange: S.statsRange,
        addBooking: p => { const r = S.resourceById(p.resourceId); const c = S.checkConflict(r, p.date, p.periodStart, p.periodEnd, p.qty || 1, null, p.classId || ''); if (!c.ok) return { ok: false, reasons: c.reasons }; const now = Date.now(); const b = Object.assign({ id: S.uid('b'), tag: '기타', qty: 1, memo: '', customLabel: '', seriesId: null, used: null, createdAt: now, updatedAt: now }, p); S.state.data.bookings.push(b); S.save(); render(); return { ok: true, booking: b }; },
        deleteBooking: id => { const b = S.state.data.bookings.find(x => x.id === id); if (!b) return 0; const n = S.deleteSeriesScope(b, 'one'); S.save(); render(); return n; },
        openBookingModal: B.openBookingModal, openSeriesModal: B.openSeriesModal, loadSample: () => loadSample(false), resetSemester, importData: (obj, mode) => importData(obj, mode || 'replace', 'api'), exportJson, setTheme: v => { S.applyTheme(v); S.storage.set(S.KEYS.theme, v); },
      },
    };
  }
  document.addEventListener('DOMContentLoaded', init);
})();
