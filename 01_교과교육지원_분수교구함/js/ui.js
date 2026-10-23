// ui.js — 저장 래퍼(store), 토스트, 모달(확인·입력·키패드), 공통 DOM 유틸
'use strict';
window.FK = window.FK || {};
(() => {
  const F = FK.frac;
  const $ = (s, r = document) => r.querySelector(s);
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ---- 저장 계층: localStorage 실패 시 메모리로 폴백 + 배너 1회 ----
  const store = {
    prefix: 'edu.fraction-kit.', memory: {}, failed: false, corrupted: false,
    get(k, d) {
      try {
        const v = localStorage.getItem(this.prefix + k);
        if (v == null) return (k in this.memory) ? this.memory[k] : d;
        return JSON.parse(v);
      } catch (e) {
        if (!this.corrupted && e instanceof SyntaxError) { this.corrupted = true; setTimeout(() => toast('저장된 값 일부가 손상되어 기본값으로 대체했어요', 'warn'), 300); }
        return (k in this.memory) ? this.memory[k] : d;
      }
    },
    set(k, v) {
      this.memory[k] = v;
      try { localStorage.setItem(this.prefix + k, JSON.stringify(v)); return true; }
      catch (e) { if (!this.failed) { this.failed = true; const b = $('#save-banner'); if (b) b.hidden = false; } return false; }
    },
    remove(k) { delete this.memory[k]; try { localStorage.removeItem(this.prefix + k); } catch (e) { /* 무시 */ } },
  };

  // ---- 토스트(하단 중앙, 최대 3개) ----
  function toast(message, type = 'info', ms = 2500) {
    const root = $('#toast-root');
    while (root.children.length >= 3) root.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast ' + type; t.setAttribute('role', 'status'); t.textContent = message;
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, ms);
  }

  // ---- 범용 다이얼로그: Promise<버튼 value | null> ----
  let dialogDepth = 0;
  function openDialog({ title, body, buttons = [{ text: '확인', value: true, primary: true }], onOpen, size = '', validate }) {
    return new Promise(resolve => {
      const root = $('#modal-root'), prev = document.activeElement;
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="dlg-title-${dialogDepth}">
        <div class="modal-head"><h2 id="dlg-title-${dialogDepth}">${escapeHtml(title)}</h2><button type="button" class="modal-x" data-value="__close" aria-label="닫기">×</button></div>
        <div class="modal-body"></div>
        <div class="modal-foot">${buttons.map((b, i) => `<button type="button" class="btn ${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}" data-idx="${i}">${escapeHtml(b.text)}</button>`).join('')}</div></div>`;
      const bodyEl = wrap.querySelector('.modal-body');
      if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
      root.appendChild(wrap); dialogDepth++;
      document.documentElement.dataset.modal = 'on';
      const close = v => {
        wrap.remove(); dialogDepth--;
        if (!root.children.length) delete document.documentElement.dataset.modal;
        document.removeEventListener('keydown', onKey);
        if (prev && prev.focus) prev.focus();
        resolve(v);
      };
      const api = { root: wrap, body: bodyEl, close, setDisabled(i, dis) { const b = wrap.querySelector(`[data-idx="${i}"]`); if (b) b.disabled = !!dis; } };
      wrap.addEventListener('click', e => {
        if (e.target === wrap) return close(null);
        const btn = e.target.closest('[data-idx],[data-value="__close"]');
        if (!btn) return;
        if (btn.dataset.value === '__close') return close(null);
        const b = buttons[+btn.dataset.idx];
        if (validate && b.primary && !validate(api)) return;
        close(b.value);
      });
      const onKey = e => {
        if (wrap !== root.lastElementChild) return;
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
        if (e.key === 'Tab') { // 포커스 트랩
          const f = [...wrap.querySelectorAll('button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]')];
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', onKey);
      if (onOpen) onOpen(api);
      const focusTarget = bodyEl.querySelector('input,select,textarea,button') || wrap.querySelector('.modal-foot .btn.primary') || wrap.querySelector('.modal-foot .btn');
      if (focusTarget) setTimeout(() => focusTarget.focus(), 20);
    });
  }
  // 확인 모달: Promise<boolean>
  const showModal = ({ title, body, confirmText = '확인', cancelText = '취소', danger = false }) =>
    openDialog({ title, body, buttons: [{ text: cancelText, value: false }, { text: confirmText, value: true, primary: true, danger }] }).then(v => v === true);

  // ---- 분수 키패드 모달 → Promise<{n,d}|null> ----
  function keypad({ value, dMin = 2, dMax = 12, allowWhole = true, title = '분수 입력' } = {}) {
    const init = value ? F.toMixed(value.n, value.d) : { whole: 0, rem: 0 };
    const fld = { w: allowWhole && value && init.whole ? String(init.whole) : '', n: value ? String(init.rem) : '', d: value ? String(value.d) : '' };
    let active = 'n';
    const fresh = { w: true, n: true, d: true }; // 미리 채워진 값은 첫 입력 시 교체
    const chips = (FK.data && FK.data.chips) || [];
    const body = `<div class="keypad">
      <div class="kp-fields">${allowWhole ? `<button type="button" class="kp-field" data-f="w" aria-label="자연수"><small>자연수</small><b></b></button>` : ''}
        <div class="kp-frac"><button type="button" class="kp-field" data-f="n" aria-label="분자"><small>분자</small><b></b></button><button type="button" class="kp-field" data-f="d" aria-label="분모"><small>분모</small><b></b></button></div>
        <div class="kp-preview" aria-live="polite"></div></div>
      <div class="kp-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(k => `<button type="button" data-k="${k}">${k}</button>`).join('')}<button type="button" data-k="back" aria-label="지우기">←</button><button type="button" data-k="clear">모두 지우기</button></div>
      <div class="kp-chips">${chips.map(([n, d]) => `<button type="button" class="chip" data-chip="${n}/${d}">${n}/${d}</button>`).join('')}</div>
      <p class="kp-msg" role="alert"></p></div>`;
    let api;
    const parsed = () => {
      const w = fld.w === '' ? 0 : +fld.w, n = fld.n === '' ? 0 : +fld.n, d = fld.d === '' ? 0 : +fld.d;
      if (fld.d === '' || fld.n === '' && fld.w === '') return { ok: false, msg: '분자와 분모를 입력하세요' };
      if (d < dMin || d > dMax) return { ok: false, msg: `분모는 ${dMin}~${dMax}` };
      if (w > 2) return { ok: false, msg: '자연수는 0~2' };
      const total = w * d + n;
      if (total > 3 * d) return { ok: false, msg: '분자는 0~3×분모(자연수 포함)' };
      return { ok: true, fr: { n: total, d } };
    };
    const refresh = () => {
      const r = api.body;
      r.querySelectorAll('.kp-field').forEach(b => { b.classList.toggle('active', b.dataset.f === active); b.querySelector('b').textContent = fld[b.dataset.f] || ' '; });
      const p = parsed();
      r.querySelector('.kp-preview').innerHTML = p.ok ? F.html(p.fr.n, p.fr.d, { mixed: true }) + `<span class="muted"> = ${F.str(p.fr.n, p.fr.d)} · ${F.toDecimal(p.fr.n, p.fr.d)}</span>` : '';
      r.querySelector('.kp-msg').textContent = p.ok ? '' : p.msg;
      api.setDisabled(1, !p.ok);
    };
    const type = k => {
      if (k === 'back') { fld[active] = fld[active].slice(0, -1); fresh[active] = false; }
      else if (k === 'clear') { fld.w = fld.n = fld.d = ''; active = allowWhole ? 'w' : 'n'; }
      else { if (fresh[active]) { fld[active] = ''; fresh[active] = false; } if (fld[active].length >= 2) return; fld[active] = (fld[active] === '0' ? '' : fld[active]) + k; if (fld[active].length === 2 || (active === 'w')) active = active === 'w' ? 'n' : active === 'n' ? 'd' : 'd'; }
      refresh();
    };
    return openDialog({
      title, body, size: 'kp',
      buttons: [{ text: '취소', value: null }, { text: '확인', value: true, primary: true }],
      onOpen(a) {
        api = a; refresh();
        a.body.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.f) { active = b.dataset.f; fresh[active] = true; refresh(); }
          else if (b.dataset.k) type(b.dataset.k);
          else if (b.dataset.chip) { const [n, d] = b.dataset.chip.split('/'); fld.w = ''; fld.n = n; fld.d = d; refresh(); }
        });
        a.root.addEventListener('keydown', e => {
          if (/^[0-9]$/.test(e.key)) { type(e.key); e.preventDefault(); }
          else if (e.key === 'Backspace') { type('back'); e.preventDefault(); }
          else if (e.key === '/') { active = 'd'; refresh(); e.preventDefault(); }
          else if (e.key === 'Enter') { const p = parsed(); if (p.ok) a.close(true); e.preventDefault(); }
        });
      },
    }).then(v => (v ? parsed().fr : null));
  }

  // Blob 다운로드(file://에서도 동작)
  function download(name, content, type = 'application/json') {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  FK.ui = { $, escapeHtml, uid, clamp, debounce, store, toast, openDialog, showModal, keypad, download };
})();
