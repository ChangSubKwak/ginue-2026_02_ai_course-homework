'use strict';
/* 특별실지기 — core.js
   공통 유틸(날짜·HTML), localStorage 래퍼, 토스트·모달, 상태와 저장,
   충돌 검사·대안 추천·정기 예약 전개·학사일정 영향·통계 계산·샘플 생성 알고리즘.
   다른 파일(board.js, views.js)은 전역 SRB 객체를 통해 이 기능을 사용한다. */
const SRB = (() => {
  const VERSION = '1.0.0';
  const KEYS = { data: 'srb.v1.data', ui: 'srb.v1.ui', onboard: 'srb.v1.onboarded', theme: 'edu.special-room-booking.theme' };
  const TAGS = ['실험', '탐구', '발표', '영상', '체육', '음악', '행사', '기타'];
  const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
  const EVENT_TYPE = { holiday: '공휴일', dayoff: '재량휴업일', event: '학교행사' };
  const MOBILE_Q = '(max-width: 639px)';
  const MS_DAY = 864e5;

  // ───────── 날짜 유틸: 'YYYY-MM-DD' 문자열과 로컬 Date만 사용(시간대 오차 방지)
  const pad2 = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseDate = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const isValidDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(parseDate(s).getTime());
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dayOfWeek = s => parseDate(s).getDay();
  const todayStr = () => ymd(new Date());
  // 주의 월요일로 정규화(토·일은 다음 주 월요일)
  const mondayOf = s => { const w = dayOfWeek(s); return addDays(s, w === 0 ? 1 : w === 6 ? 2 : 1 - w); };
  const fmtMD = s => { const d = parseDate(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const fmtMDW = s => `${fmtMD(s)}(${DAY_KO[dayOfWeek(s)]})`;
  const fmtKo = s => { const d = parseDate(s); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${DAY_KO[d.getDay()]})`; };
  // 주차 라벨: 그 달 1일이 속한 주(월요일 시작)를 1주로 센다
  function weekLabel(monday) {
    const d = parseDate(monday);
    const first = ymd(new Date(d.getFullYear(), d.getMonth(), 1));
    const firstMon = addDays(first, -((dayOfWeek(first) + 6) % 7));
    const n = Math.round((parseDate(monday) - parseDate(firstMon)) / MS_DAY / 7) + 1;
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${n}주`;
  }
  // 학기 안의 월 목록 ['2026-09', …]
  function semesterMonths() {
    const s = state.data.settings; const out = [];
    let d = parseDate(s.semesterStart); d.setDate(1);
    while (ymd(d) <= s.semesterEnd) { out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`); d.setMonth(d.getMonth() + 1); }
    return out;
  }

  // ───────── HTML·기타 유틸
  const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const dl = (name, text, type) => { // Blob + a[download] 파일 저장
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const toCsv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const stamp = () => { const d = new Date(); return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; };

  // ───────── localStorage 래퍼(try/catch, 실패 시 메모리 모드)
  const storage = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
  };

  // ───────── 토스트(우하단 스택, 자동 소멸)
  function showToast(message, type = 'info', ms = 2500) {
    const root = $('#toast-root'); if (!root) return;
    const t = document.createElement('div'); t.className = `toast toast-${type}`; t.setAttribute('role', 'status'); t.textContent = message;
    root.appendChild(t); while (root.children.length > 4) root.firstElementChild.remove();
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
  }

  // ───────── 모달(Promise 기반). openModal은 핸들을, showModal은 확인 여부를 돌려준다
  function openModal({ title, body, footer = '', cls = '', onClose }) {
    const root = $('#modal-root'); const prev = document.activeElement;
    const wrap = document.createElement('div'); wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="modal-head"><h2>${escapeHtml(title)}</h2><button type="button" class="icon-btn" data-close aria-label="닫기">✕</button></header>
      <div class="modal-body"></div><footer class="modal-foot"></footer></div>`;
    const bodyEl = $('.modal-body', wrap); const footEl = $('.modal-foot', wrap);
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    if (footer) footEl.innerHTML = footer; else footEl.remove();
    root.appendChild(wrap); document.body.classList.add('modal-open');
    let resolve; const done = new Promise(r => { resolve = r; }); let closed = false;
    const close = (v = null) => {
      if (closed) return; closed = true; document.removeEventListener('keydown', onKey);
      wrap.classList.add('closing'); setTimeout(() => wrap.remove(), 150);
      if (!root.querySelector('.modal-backdrop:not(.closing)')) document.body.classList.remove('modal-open');
      if (prev && prev.focus && document.contains(prev)) prev.focus();
      if (onClose) onClose(v); resolve(v);
    };
    const onKey = e => { if (e.key === 'Escape' && root.lastElementChild === wrap) close(null); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) wrap.dataset.down = '1'; else delete wrap.dataset.down; });
    wrap.addEventListener('click', e => {
      if (e.target === wrap) { if (wrap.dataset.down) close(null); return; }
      if (e.target.closest('[data-close]')) { close(null); return; }
      const b = e.target.closest('[data-result]'); if (b && !b.disabled) close(b.dataset.result);
    });
    requestAnimationFrame(() => { const f = $('.modal-foot button:not([disabled]), .modal-body input, .modal-body select, .modal-body button', wrap); (f || $('[data-close]', wrap)).focus(); });
    return { el: wrap, body: bodyEl, foot: footEl, close, done };
  }
  function showModal({ title, body, confirmText = '확인', cancelText = '취소', danger = false }) {
    const m = openModal({ title, body, footer: `${cancelText ? `<button type="button" class="btn" data-result="">${escapeHtml(cancelText)}</button>` : ''}<button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-result="ok">${escapeHtml(confirmText)}</button>` });
    return m.done.then(v => v === 'ok');
  }

  // ───────── 상태
  const state = { data: null, ui: null, memoryMode: false, index: new Map() };
  const defaultUi = () => ({ tab: 'board', selectedResourceId: null, weekStart: null, statsRange: { mode: 'semester', month: '' }, statsResource: 'all', mobileDay: 1, calMonth: '' });
  const defaultSettings = () => ({
    schoolName: '우리초등학교', schoolYear: 2026, semester: 2, semesterStart: '2026-09-01', semesterEnd: '2026-12-31',
    periods: JSON.parse(JSON.stringify(APP_DATA.settings.periods)), approvalLine: ['담당', '부장', '교감'],
  });
  const emptyData = () => ({ meta: { app: 'special-room-booking', version: 1, savedAt: null }, settings: defaultSettings(), resources: [], classes: [], teachers: [], events: [], series: [], bookings: [] });
  const COLLECTIONS = ['resources', 'classes', 'teachers', 'events', 'series', 'bookings'];

  // 자원·날짜 인덱스(`${resourceId}|${date}` → 예약 배열)로 격자 렌더·충돌 검사를 O(1) 조회로 처리
  function rebuildIndex() {
    state.index = new Map();
    for (const b of state.data.bookings) indexAdd(b);
  }
  function indexAdd(b) { const k = `${b.resourceId}|${b.date}`; const arr = state.index.get(k); if (arr) arr.push(b); else state.index.set(k, [b]); }
  const bookingsAt = (resourceId, date) => state.index.get(`${resourceId}|${date}`) || [];

  // 저장(실패 시 메모리 모드 배너)
  function save() {
    state.data.meta.savedAt = Date.now();
    const ok = storage.set(KEYS.data, state.data);
    const was = state.memoryMode; state.memoryMode = !ok;
    rebuildIndex(); renderSaveStatus();
    if (!ok && !was) showToast('저장 불가 — 메모리 모드로 동작합니다. JSON 내보내기를 권장합니다.', 'warn', 4000);
  }
  const saveUi = () => storage.set(KEYS.ui, state.ui);
  function renderSaveStatus() {
    const dot = $('#save-status'); const banner = $('#mem-banner');
    if (dot) { dot.classList.toggle('mem', state.memoryMode); dot.title = state.memoryMode ? '메모리 모드' : '저장됨'; $('span', dot).textContent = state.memoryMode ? '메모리 모드' : '저장됨'; }
    if (banner) banner.hidden = !state.memoryMode;
  }

  // ───────── 조회 도우미
  const resourceById = id => state.data.resources.find(r => r.id === id) || null;
  const classById = id => state.data.classes.find(c => c.id === id) || null;
  const teacherById = id => state.data.teachers.find(t => t.id === id) || null;
  const teacherName = id => { const t = teacherById(id); return t ? t.name : ''; };
  const periodKeys = () => state.data.settings.periods.map(p => p.key);
  const periodObj = k => state.data.settings.periods.find(p => p.key === k);
  const periodLabel = k => { const p = periodObj(k); return p ? p.label : `${k}교시`; };
  function rangeLabel(a, b) {
    const la = periodLabel(a), lb = periodLabel(b); if (a === b) return la;
    return /^\d+교시$/.test(la) && /^\d+교시$/.test(lb) ? `${parseInt(la, 10)}~${parseInt(lb, 10)}교시` : `${la}~${lb}`;
  }
  const gradeOf = v => { const m = /^(\d)(?:-\d+|학년)/.exec(String(v || '')); return m ? Number(m[1]) : 0; };
  const classLabel = b => b.classId || b.customLabel || '';
  const bookingShort = b => `${classLabel(b)} ${teacherName(b.teacherId)}`.trim();
  const sortedClasses = () => state.data.classes.slice().sort((a, b) => a.grade - b.grade || a.room - b.room);
  const inSemester = date => date >= state.data.settings.semesterStart && date <= state.data.settings.semesterEnd;
  const eventsOn = date => state.data.events.filter(e => e.dateStart <= date && date <= e.dateEnd);
  const closureOn = date => eventsOn(date).find(e => e.type === 'holiday' || e.type === 'dayoff') || null;
  const blockEventsFor = (resourceId, date) => eventsOn(date).filter(e => e.type === 'event' && (e.blockResourceIds || []).includes(resourceId));
  const blockAt = (resourceId, date, p) => blockEventsFor(resourceId, date).find(e => e.blockPeriods === 'all' || e.blockPeriods.includes(p)) || null;

  // ───────── 충돌 검사(공간형·수량형 공통). 반환 {ok, reasons, warnings, conflictBookings, remaining}
  function checkConflict(resource, date, pStart, pEnd, qty, excludeId, classId) {
    const r = { ok: false, reasons: [], warnings: [], conflictBookings: [], remaining: [] };
    const s = state.data.settings;
    if (!resource) r.reasons.push('자원을 선택하세요');
    if (!isValidDate(date)) { r.reasons.push('날짜를 입력하세요'); return r; }
    if (date < s.semesterStart || date > s.semesterEnd) r.reasons.push(`학기 기간 밖(${fmtMD(s.semesterStart)}~${fmtMD(s.semesterEnd)})`);
    const w = dayOfWeek(date); if (w === 0 || w === 6) r.reasons.push('수업일 아님(주말)');
    const closed = closureOn(date); if (closed) r.reasons.push(`휴업일: ${closed.title}`);
    if (resource) {
      const q = resource.type === 'room' ? 1 : Number(qty) || 1;
      if (resource.type === 'equipment' && (q < 1 || q > resource.quantity)) r.reasons.push(`사용 수량은 1~${resource.quantity} 사이여야 합니다`);
      for (const ev of blockEventsFor(resource.id, date)) {
        if (ev.blockPeriods === 'all' || ev.blockPeriods.some(p => p >= pStart && p <= pEnd)) r.reasons.push(`행사 차단: ${ev.title}`);
      }
      const unavailable = [];
      for (let p = pStart; p <= pEnd; p++) {
        const list = bookingsAt(resource.id, date).filter(b => b.id !== excludeId && b.periodStart <= p && p <= b.periodEnd);
        const used = sum(list.map(b => b.qty || 1));
        if (resource.type === 'room') {
          if (used >= 1) { r.reasons.push(`${periodLabel(p)}: ${bookingShort(list[0])} 사용 중`); list.forEach(b => { if (!r.conflictBookings.includes(b)) r.conflictBookings.push(b); }); }
        } else {
          const left = Math.max(0, resource.quantity - used); r.remaining.push({ p, left });
          if (used + q > resource.quantity) { r.reasons.push(`${periodLabel(p)}: 잔여 ${left}`); list.forEach(b => { if (!r.conflictBookings.includes(b)) r.conflictBookings.push(b); }); }
        }
        if (!(resource.availablePeriods || []).includes(p)) unavailable.push(p);
      }
      if (unavailable.length) r.reasons.push(`사용 불가 교시: ${unavailable.map(periodLabel).join(', ')}`);
      const pr = resource.priorityRule; const g = gradeOf(classId);
      if (pr && pr.grades && pr.grades.length && pr.weekdays && pr.weekdays.includes(w) && g && !pr.grades.includes(g)) {
        r.warnings.push(`${pr.weekdays.map(d => DAY_KO[d]).join('·')}요일은 ${pr.grades.join('·')}학년 우선 자원입니다(저장은 가능)`);
      }
    }
    r.ok = r.reasons.length === 0; return r;
  }

  // ───────── 대안 추천(최대 3개): 같은 날 다른 교시 → 같은 그룹 다른 자원 → 같은 주 다른 요일
  function suggestAlternatives(req) {
    const out = []; const res = resourceById(req.resourceId); if (!res || !isValidDate(req.date)) return out;
    const keys = periodKeys(); const len = req.pEnd - req.pStart + 1;
    const tryIt = (resourceId, date, pStart, pEnd, label) => {
      const c = checkConflict(resourceById(resourceId), date, pStart, pEnd, req.qty, req.excludeId, req.classId);
      if (c.ok) out.push({ label, patch: { resourceId, date, pStart, pEnd } }); return c.ok;
    };
    const starts = keys.filter(k => k !== req.pStart && keys.includes(k + len - 1)).sort((a, b) => Math.abs(a - req.pStart) - Math.abs(b - req.pStart));
    for (const s of starts) if (tryIt(res.id, req.date, s, s + len - 1, `같은 날 ${rangeLabel(s, s + len - 1)}`)) break;
    if (res.group) for (const o of state.data.resources) {
      if (o.id !== res.id && o.active && o.group === res.group && tryIt(o.id, req.date, req.pStart, req.pEnd, `${o.name} 같은 교시`)) break;
    }
    const mon = mondayOf(req.date); const base = parseDate(req.date).getTime();
    const days = [0, 1, 2, 3, 4].map(i => addDays(mon, i)).filter(d => d !== req.date).sort((a, b) => Math.abs(parseDate(a) - base) - Math.abs(parseDate(b) - base));
    for (const d of days) if (tryIt(res.id, d, req.pStart, req.pEnd, `${DAY_KO[dayOfWeek(d)]}요일 같은 교시`)) break;
    return out.slice(0, 3);
  }

  // ───────── 정기 예약 전개: 날짜별 상태(ok/holiday/blocked/conflict/skip)와 사유
  function expandSeries(sr) {
    const rows = []; const res = resourceById(sr.resourceId);
    if (!res || !isValidDate(sr.dateFrom) || !isValidDate(sr.dateTo) || sr.dateFrom > sr.dateTo) return rows;
    for (let d = sr.dateFrom; d <= sr.dateTo; d = addDays(d, 1)) {
      if (dayOfWeek(d) !== Number(sr.weekday)) continue;
      const c = checkConflict(res, d, sr.periodStart, sr.periodEnd, sr.qty, null, sr.classId);
      let status = 'ok';
      if (!c.ok) status = c.reasons.some(x => x.startsWith('휴업일')) ? 'holiday' : c.reasons.some(x => x.startsWith('행사 차단')) ? 'blocked' : c.conflictBookings.length ? 'conflict' : 'skip';
      rows.push({ date: d, status, reason: c.reasons.join(' / '), checked: status === 'ok' });
    }
    return rows;
  }
  // 시리즈 삭제 범위 적용: one(이 건만) / after(이 날짜 이후 모두) / all(전체)
  function deleteSeriesScope(booking, scope) {
    const d = state.data; const sid = booking.seriesId;
    if (scope === 'one' || !sid) { d.bookings = d.bookings.filter(b => b.id !== booking.id); return 1; }
    const victims = d.bookings.filter(b => b.seriesId === sid && (scope === 'all' || b.date >= booking.date));
    d.bookings = d.bookings.filter(b => !victims.includes(b));
    const sr = d.series.find(s => s.id === sid);
    if (scope === 'all') d.series = d.series.filter(s => s.id !== sid);
    else if (sr) sr.dateTo = addDays(booking.date, -1);
    return victims.length;
  }

  // ───────── 학사일정 영향 예약 계산
  function affectedBookings(ev) {
    return state.data.bookings.filter(b => {
      if (b.date < ev.dateStart || b.date > ev.dateEnd) return false;
      if (ev.type !== 'event') return true;
      if (!(ev.blockResourceIds || []).includes(b.resourceId)) return false;
      return ev.blockPeriods === 'all' || ev.blockPeriods.some(p => p >= b.periodStart && p <= b.periodEnd);
    });
  }

  // ───────── 통계(가동률·학급×자원 히트맵·학년별·요일×교시 혼잡도·미사용률)
  function computeStats(from, to, resourceFilter = 'all') {
    const d = state.data; const t = todayStr();
    const resources = d.resources.filter(r => resourceFilter === 'all' || r.id === resourceFilter);
    const schoolDays = [];
    for (let x = from; x <= to; x = addDays(x, 1)) { const w = dayOfWeek(x); if (w >= 1 && w <= 5 && !closureOn(x)) schoolDays.push(x); }
    const bookings = d.bookings.filter(b => b.date >= from && b.date <= to && (resourceFilter === 'all' || b.resourceId === resourceFilter));
    const perResource = resources.map(r => {
      let available = 0;
      for (const day of schoolDays) {
        const blocked = new Set();
        for (const ev of blockEventsFor(r.id, day)) (ev.blockPeriods === 'all' ? r.availablePeriods : ev.blockPeriods).forEach(p => blocked.add(p));
        available += r.availablePeriods.filter(p => !blocked.has(p)).length * (r.quantity || 1);
      }
      const list = bookings.filter(b => b.resourceId === r.id);
      const used = sum(list.map(b => (b.periodEnd - b.periodStart + 1) * (b.qty || 1)));
      return { id: r.id, name: r.name, active: r.active, available, used, count: list.length, unused: list.filter(b => b.used === false).length, rate: available ? Math.round(used / available * 1000) / 10 : null };
    });
    const gradeCounts = [0, 0, 0, 0, 0, 0, 0];
    const matrix = {}; const congestion = {}; let congMax = 0;
    for (const b of bookings) {
      const g = gradeOf(b.classId || b.customLabel); if (g >= 1 && g <= 6) gradeCounts[g]++;
      if (b.classId) matrix[`${b.classId}|${b.resourceId}`] = (matrix[`${b.classId}|${b.resourceId}`] || 0) + 1;
      const w = dayOfWeek(b.date);
      for (let p = b.periodStart; p <= b.periodEnd; p++) { const k = `${w}|${p}`; congestion[k] = (congestion[k] || 0) + 1; congMax = Math.max(congMax, congestion[k]); }
    }
    const classes = sortedClasses(); const low = []; const avgMap = {};
    for (const r of resources) for (let g = 1; g <= 6; g++) {
      const cls = classes.filter(c => c.grade === g); if (!cls.length) continue;
      const avg = sum(cls.map(c => matrix[`${c.id}|${r.id}`] || 0)) / cls.length;
      for (const c of cls) {
        avgMap[`${c.id}|${r.id}`] = avg; const n = matrix[`${c.id}|${r.id}`] || 0;
        if (avg >= 2 && n < avg * 0.5) low.push({ classId: c.id, resourceId: r.id, resourceName: r.name, count: n, avg: Math.round(avg * 10) / 10 });
      }
    }
    const checked = bookings.filter(b => b.used === true || b.used === false);
    const rates = perResource.filter(x => x.rate !== null).map(x => x.rate);
    return {
      from, to, schoolDays: schoolDays.length, perResource, gradeCounts, matrix, avgMap, low, classes, resources, congestion, congMax,
      summary: {
        count: bookings.length, usedPeriods: sum(bookings.map(b => (b.periodEnd - b.periodStart + 1) * (b.qty || 1))),
        avgRate: rates.length ? Math.round(sum(rates) / rates.length * 10) / 10 : null,
        unusedRate: checked.length ? Math.round(bookings.filter(b => b.used === false).length / checked.length * 1000) / 10 : null,
        checked: checked.length, unused: bookings.filter(b => b.used === false).length, pastUnchecked: bookings.filter(b => b.date < t && b.used == null).length,
      },
    };
  }
  // 통계 기간 범위(월 또는 학기 전체)를 학기와 교차해 돌려준다
  function statsRange() {
    const s = state.data.settings; const r = state.ui.statsRange;
    if (r.mode === 'month' && /^\d{4}-\d{2}$/.test(r.month)) {
      const [y, m] = r.month.split('-').map(Number); const from = `${y}-${pad2(m)}-01`; const to = ymd(new Date(y, m, 0));
      return { from: from < s.semesterStart ? s.semesterStart : from, to: to > s.semesterEnd ? s.semesterEnd : to, label: `${y}년 ${m}월` };
    }
    return { from: s.semesterStart, to: s.semesterEnd, label: `${s.schoolYear}학년도 ${s.semester}학기 전체` };
  }

  // ───────── 데이터 검증·병합
  function validateImport(obj) {
    if (!obj || typeof obj !== 'object' || !obj.meta || obj.meta.app !== 'special-room-booking') return '올바른 백업 파일이 아닙니다(앱 식별자 불일치)';
    for (const k of COLLECTIONS) if (!Array.isArray(obj[k])) return `올바른 백업 파일이 아닙니다(${k} 누락)`;
    if (!obj.settings || !Array.isArray(obj.settings.periods)) return '올바른 백업 파일이 아닙니다(settings 누락)';
    return '';
  }
  function mergeData(incoming) {
    const cur = state.data;
    for (const k of COLLECTIONS) {
      const map = new Map(cur[k].map(x => [x.id, x]));
      for (const item of incoming[k]) {
        const ex = map.get(item.id);
        if (!ex) { map.set(item.id, item); continue; }
        const a = ex.updatedAt || ex.createdAt || 0, b = item.updatedAt || item.createdAt || 0;
        if (b > a) map.set(item.id, item);
      }
      cur[k] = Array.from(map.values());
    }
    return countOverbooked();
  }
  // 병합 후 자원·날짜·교시별 초과 예약 재검사(관련 예약 건수)
  function countOverbooked() {
    rebuildIndex(); const bad = new Set();
    for (const [k, list] of state.index) {
      const r = resourceById(k.split('|')[0]); if (!r) continue;
      for (const p of periodKeys()) {
        const on = list.filter(b => b.periodStart <= p && p <= b.periodEnd);
        if (sum(on.map(b => b.qty || 1)) > (r.type === 'room' ? 1 : r.quantity)) on.forEach(b => bad.add(b.id));
      }
    }
    return bad.size;
  }

  // ───────── 샘플 데이터 생성: 시리즈를 실제 충돌 검사로 전개하고 단건은 시드 난수로 배치
  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function buildSampleData() {
    const base = JSON.parse(JSON.stringify({ settings: APP_DATA.settings, resources: APP_DATA.resources, classes: APP_DATA.classes, teachers: APP_DATA.teachers, events: APP_DATA.events }));
    const data = Object.assign(emptyData(), base); state.data = data; rebuildIndex();
    const now = 1756684800000; let seq = 0; // 샘플 생성 시각(2026-09-01 고정)
    const add = b => { const bk = Object.assign({ id: `b_s${String(++seq).padStart(3, '0')}`, qty: 1, memo: '', seriesId: null, used: null, customLabel: '', createdAt: now, updatedAt: now }, b); data.bookings.push(bk); indexAdd(bk); return bk; };
    APP_DATA.sampleSeries.forEach((sd, i) => {
      const sr = Object.assign({ id: `s_${String(i + 1).padStart(2, '0')}`, dateFrom: data.settings.semesterStart, dateTo: data.settings.semesterEnd, createdAt: now }, sd);
      data.series.push(sr);
      expandSeries(sr).filter(r => r.status === 'ok').forEach(r => add({ resourceId: sr.resourceId, date: r.date, periodStart: sr.periodStart, periodEnd: sr.periodEnd, classId: sr.classId, teacherId: sr.teacherId, tag: sr.tag, qty: sr.qty, seriesId: sr.id }));
    });
    APP_DATA.sampleFixed.forEach(f => add(f));
    const rnd = mulberry32(20260901); const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const plans = []; APP_DATA.samplePlan.forEach(p => { for (let i = 0; i < p.w; i++) plans.push(p); });
    for (let mon = '2026-08-31'; mon <= '2026-11-30'; mon = addDays(mon, 7)) {
      const target = (mon >= '2026-10-05' && mon <= '2026-10-26') ? 8 : 4; let made = 0, tries = 0;
      while (made < target && tries++ < 60) {
        const plan = pick(plans); const date = addDays(mon, Math.floor(rnd() * 5)); const classId = pick(plan.classes);
        const start = pick(plan.periods); const end = start + plan.len - 1; const res = resourceById(plan.resourceId);
        if (!checkConflict(res, date, start, end, 1, null, classId).ok) continue;
        const cls = classById(classId);
        add({ resourceId: res.id, date, periodStart: start, periodEnd: end, classId, teacherId: plan.teacher ? APP_DATA.teacherIdByName[plan.teacher] : cls.teacherId, tag: plan.tag, qty: 1 });
        made++;
      }
    }
    const t = todayStr(); let k = 0; // 지난 예약의 사용 여부 패턴(사용함 다수·사용 안 함·미확인)
    data.bookings.forEach(b => { if (b.date < t) { const m = k++ % 15; b.used = (m === 3 || m === 9 || m === 13) ? false : m === 7 ? null : true; } });
    data.bookings.sort((a, b) => a.date.localeCompare(b.date) || a.periodStart - b.periodStart);
    return data;
  }

  // ───────── 테마
  function applyTheme(v) { if (v === 'light' || v === 'dark') document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme; }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark'; applyTheme(next); storage.set(KEYS.theme, next);
  }

  return {
    VERSION, KEYS, TAGS, DAY_KO, EVENT_TYPE, MOBILE_Q, COLLECTIONS, state,
    pad2, ymd, parseDate, isValidDate, addDays, dayOfWeek, todayStr, mondayOf, fmtMD, fmtMDW, fmtKo, weekLabel, semesterMonths,
    escapeHtml, uid, clamp, sum, $, $$, dl, toCsv, stamp, storage, showToast, openModal, showModal,
    defaultUi, defaultSettings, emptyData, rebuildIndex, bookingsAt, save, saveUi, renderSaveStatus,
    resourceById, classById, teacherById, teacherName, periodKeys, periodObj, periodLabel, rangeLabel, gradeOf, classLabel, bookingShort, sortedClasses,
    inSemester, eventsOn, closureOn, blockEventsFor, blockAt,
    checkConflict, suggestAlternatives, expandSeries, deleteSeriesScope, affectedBookings, computeStats, statsRange,
    validateImport, mergeData, countOverbooked, buildSampleData, applyTheme, toggleTheme,
  };
})();
