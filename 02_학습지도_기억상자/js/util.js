/* util.js — 기억상자 공용 유틸: 날짜·ID·이스케이프·CSV·파일·저장소·토스트·모달·공통 알고리즘 */
'use strict';

/* ---------- 날짜(로컬 구성 요소 기반, 문자열 비교용 YYYY-MM-DD) ---------- */
const pad2 = n => String(n).padStart(2, '0');
// Date → 'YYYY-MM-DD'
const fmtYmd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// 오늘 날짜 문자열
const todayStr = () => fmtYmd(new Date());
// 'YYYY-MM-DD' → 로컬 Date (자정)
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
// 날짜 문자열에 n일 더하기(구성 요소 연산, DST 안전)
const addDays = (s, n) => { const d = parseYmd(s); return fmtYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
// a에서 b까지 일수(b - a)
const diffDays = (a, b) => Math.round((Date.UTC(...ymdParts(b)) - Date.UTC(...ymdParts(a))) / 86400000);
const ymdParts = s => { const [y, m, d] = s.split('-').map(Number); return [y, m - 1, d]; };
// 'M/D' 표시용
const fmtMd = s => { const [, m, d] = s.split('-'); return `${Number(m)}/${Number(d)}`; };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
// 요일 글자
const weekdayKo = s => WEEKDAYS[parseYmd(s).getDay()];
// 해당 주의 월요일
const mondayOf = s => { const d = parseYmd(s); const off = (d.getDay() + 6) % 7; return addDays(s, -off); };
// ISO 주차 키 'YYYY-WW'(월요일 시작, 목요일이 속한 해 기준)
const isoWeekKey = s => { const d = parseYmd(s); const th = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + 3); const y = th.getFullYear(); const jan1 = new Date(y, 0, 1), firstThu = new Date(y, 0, 1 + ((4 - jan1.getDay()) + 7) % 7); return `${y}-${pad2(1 + Math.round((th - firstThu) / 604800000))}`; };

/* ---------- 작은 도우미 ---------- */
// 짧은 랜덤 ID
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
// HTML 이스케이프(사용자 입력을 innerHTML에 넣을 때 필수)
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
// 시드 랜덤(mulberry32) — 샘플 데이터 재생성이 결정적이도록
const mulberry32 = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// 문자열 앞부분 자르기
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
// 내려받기 파일명 정제: Windows 금지 문자·제어 문자 치환, 40자 제한
const safeFileName = s => String(s == null ? '' : s).replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 40) || '이름없음';
// 손그림 dataURL 형식 검사(JPEG/PNG base64만 허용) — 가져온 파일의 값을 src에 넣기 전에 반드시 통과
const isDrawing = s => typeof s === 'string' && s.length < 400000 && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(s);

/* ---------- CSV ---------- */
// UTF-8 BOM 문자(U+FEFF). 소스에 보이지 않는 문자를 두지 않도록 코드로 만든다
const BOM = String.fromCharCode(0xFEFF);
// 문자 단위 상태기계 파서: BOM 제거, 따옴표 안 쉼표·줄바꿈·"" 처리, \r\n/\n 모두
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return { rows: rows.filter(r => r.some(c => c.trim() !== '')), unbalanced: q };
}
// CSV 한 칸 이스케이프
const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
// 2차원 배열 → CSV 문자열(UTF-8 BOM 포함)
const toCsv = rows => BOM + rows.map(r => r.map(csvCell).join(',')).join('\r\n');

/* ---------- 파일 입출력 ---------- */
// Blob + a[download]로 내려받기
function download(name, text, mime = 'text/plain;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// File → 텍스트(Promise)
const readFileText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('파일을 읽을 수 없어요')); r.readAsText(file, 'utf-8'); });
// 드롭존 공통 배선: dragover 방지, 파일 배열을 콜백으로
function wireDropzone(zone, onFiles) {
  if (!zone) return;
  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('is-over'); }));
  zone.addEventListener('drop', e => { const fs = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (fs.length) onFiles(fs); });
  const input = zone.querySelector('input[type=file]');
  if (input) input.addEventListener('change', () => { const fs = [...input.files]; input.value = ''; if (fs.length) onFiles(fs); });
}

/* ---------- localStorage 래퍼(try/catch, 실패 시 메모리 폴백) ---------- */
const storage = {
  prefix: 'edu.memory-box.', mem: {}, failed: false, onFail: null,
  key(k) { return this.prefix + k; },
  get(k, d) { try { const v = localStorage.getItem(this.key(k)); if (v == null) return k in this.mem ? this.mem[k] : d; return JSON.parse(v); } catch (e) { return k in this.mem ? this.mem[k] : d; } },
  set(k, v) { this.mem[k] = v; try { localStorage.setItem(this.key(k), JSON.stringify(v)); return true; } catch (e) { if (!this.failed) { this.failed = true; if (this.onFail) this.onFail(e); } return false; } },
  remove(k) { delete this.mem[k]; try { localStorage.removeItem(this.key(k)); } catch (e) { /* 메모리 모드 */ } },
  // 접두사로 시작하는 키 목록
  keys() { try { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(this.prefix)) out.push(k.slice(this.prefix.length)); } return out; } catch (e) { return Object.keys(this.mem); } },
  // 사용량(바이트 근사: UTF-16 2바이트)
  usage() { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(this.prefix)) n += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (e) { for (const k in this.mem) n += JSON.stringify(this.mem[k]).length * 2; } return n; },
};

/* ---------- 토스트 ---------- */
// 우하단 스택 토스트, 자동 사라짐
function showToast(message, type = 'info', ms = 2500) {
  const root = document.getElementById('toast-root'); if (!root) return;
  const el = document.createElement('div'); el.className = `toast toast-${type}`; el.textContent = message;
  root.appendChild(el);
  while (root.children.length > 4) root.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}

/* ---------- 모달(Promise) ---------- */
// showModal({title, body, confirmText, cancelText, danger, wide, buttons, beforeClose, onOpen, backdrop}) → Promise<값>
// buttons를 주면 [{text, value, kind:'primary'|'ghost'|'danger'}]로 하단 버튼을 구성한다.
// 키 입력은 document(capture)에서 받아 최상단 모달만 처리하므로 모달 안 빈 곳을 눌러 포커스가 body로 가도 ESC·Tab 트랩이 동작한다.
const modalStack = [];
function showModal(opts) {
  return new Promise(resolve => {
    const root = document.getElementById('modal-root');
    const prev = document.activeElement;
    const back = document.createElement('div'); back.className = 'modal-back';
    const box = document.createElement('div'); box.className = 'modal' + (opts.wide ? ' modal-wide' : ''); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.tabIndex = -1;
    const buttons = opts.buttons || [
      ...(opts.cancelText === null ? [] : [{ text: opts.cancelText || '취소', value: false, kind: 'ghost' }]),
      { text: opts.confirmText || '확인', value: true, kind: opts.danger ? 'danger' : 'primary' },
    ];
    box.innerHTML = `<div class="modal-head"><h2 class="modal-title">${escapeHtml(opts.title || '')}</h2><button class="icon-btn modal-x" type="button" aria-label="닫기">✕</button></div><div class="modal-body"></div><div class="modal-foot"></div>`;
    const bodyEl = box.querySelector('.modal-body');
    if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body; else if (opts.body) bodyEl.appendChild(opts.body);
    const foot = box.querySelector('.modal-foot');
    buttons.forEach(b => { const btn = document.createElement('button'); btn.type = 'button'; btn.className = `btn btn-${b.kind || 'ghost'}`; btn.textContent = b.text; btn.dataset.value = String(b.value); if (b.id) btn.id = b.id; btn.addEventListener('click', () => close(b.value)); foot.appendChild(btn); });
    const rec = { back }; back.appendChild(box); root.appendChild(back); modalStack.push(rec);
    document.body.classList.add('modal-open');
    const isTop = () => modalStack[modalStack.length - 1] === rec;
    // 모달 안의 포커스 가능 요소(비활성·숨김 제외)
    const focusables = () => [...box.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    const onKey = e => {
      if (!isTop()) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); return; }
      if (e.key === 'Tab') { // 포커스 트랩: 포커스가 모달 밖이면 안으로 끌어온다
        const f = focusables(); if (!f.length) { e.preventDefault(); box.focus(); return; }
        const first = f[0], last = f[f.length - 1], cur = document.activeElement;
        if (!box.contains(cur) || (e.shiftKey && cur === first)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
      }
    };
    function close(v) {
      if (opts.beforeClose && opts.beforeClose(v, box) === false) return;
      document.removeEventListener('keydown', onKey, true); back.remove();
      const i = modalStack.indexOf(rec); if (i >= 0) modalStack.splice(i, 1);
      if (!modalStack.length && !document.querySelector('.session:not([hidden]), .print-view:not([hidden])')) document.body.classList.remove('modal-open');
      if (prev && prev.focus && document.contains(prev)) setTimeout(() => prev.focus(), 0); // 브라우저 기본 포커스 이동 뒤에 복귀
      resolve(v);
    }
    document.addEventListener('keydown', onKey, true);
    let downOnBack = false;
    back.addEventListener('mousedown', e => { downOnBack = e.target === back; });
    back.addEventListener('click', e => { if (e.target === back && downOnBack && opts.backdrop !== false) close(false); downOnBack = false; });
    box.querySelector('.modal-x').addEventListener('click', () => close(false));
    if (opts.onOpen) opts.onOpen(box, close);
    // 첫 포커스: autofocus → 활성 primary/danger 버튼 → 첫 활성 요소(닫기 버튼 포함) → 모달 자체
    setTimeout(() => { const t = box.querySelector('[autofocus]') || [...foot.querySelectorAll('.btn-primary, .btn-danger')].find(b => !b.disabled) || focusables()[0] || box; t.focus(); }, 30);
  });
}
// 모달이 열려 있는지
const isModalOpen = () => modalStack.length > 0;

/* ---------- 라이트너 공통 알고리즘(샘플 생성기와 앱이 함께 사용) ---------- */
const INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 15, master: 30 };
// 상자 이동 규칙: ok(맞음 여부), c(확신도 1~3) → 카드 갱신, {from,to} 반환
function applyGrade(card, ok, c, today, reason) {
  const from = card.box;
  if (!ok) {
    card.box = 1; card.due = addDays(today, 1);
    if (card.type === 'wrong') { if (reason) card.reason = reason; card.failReasons = (card.failReasons || []).concat(reason || card.reason || 'unknown'); }
    else card.failReasons = (card.failReasons || []).concat('unknown');
  } else if (c === 3) {
    if (card.box < 5) { card.box += 1; card.due = addDays(today, INTERVALS[card.box]); } else { card.due = addDays(today, INTERVALS.master); card.mastered = true; }
  } else if (c === 2) card.due = addDays(today, INTERVALS[card.box]);
  else card.due = addDays(today, 1);
  card.lastReviewed = today;
  card.history = (card.history || []).concat({ d: today, r: ok ? 'ok' : 'fail', c, from, to: card.box, reason: ok ? null : (card.type === 'wrong' ? card.reason : null) }).slice(-50);
  return { from, to: card.box };
}
// 4분면 분류
const quadrantOf = (ok, c) => (ok ? (c === 3 ? 'know' : 'lucky') : (c === 3 ? 'illusion' : 'aware'));
// 반복 오류: 마지막 3개 원인이 모두 같고, 최근 2회 연속 맞음이 아니면 true
function isRepeat(card) {
  if (card.type !== 'wrong') return false;
  const f = card.failReasons || []; if (f.length < 3) return false;
  const [a, b, c] = f.slice(-3); if (!(a && a === b && b === c)) return false;
  const h = (card.history || []).slice(-2);
  return !(h.length === 2 && h.every(x => x.r === 'ok'));
}
// D-Day 재분배: 대상 카드 due를 시험 전날까지 균등 분배(앞당기기만), plan 반환
function applyExamPlan(cards, deckIds, examDate, today) {
  const D = Math.max(1, diffDays(today, examDate));
  const targets = cards.filter(c => deckIds.includes(c.deckId)).sort((a, b) => a.box - b.box || a.due.localeCompare(b.due));
  const plan = {};
  targets.forEach((c, i) => {
    const planDue = addDays(today, i % D);
    if (c.due > planDue) { c.history = (c.history || []).concat({ d: today, r: 'manual', c: null, from: c.box, to: c.box, reason: 'exam' }).slice(-50); c.due = planDue; }
    const key = c.due < today ? today : c.due; // 밀린 카드는 오늘 칸에 집계
    if (key < examDate) plan[key] = (plan[key] || 0) + 1;
  });
  return plan;
}
