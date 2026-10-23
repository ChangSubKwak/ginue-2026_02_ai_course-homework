// ui.js — 공용 UI 유틸: storage 래퍼·escapeHtml·토스트·모달(Promise)·DOM 툴팁·Pointer Events 드래그·파일 다운로드
'use strict';

const UI = (() => {
  const SLUG = 'jari-ttukttak';
  // localStorage 래퍼(try/catch, 실패 시 false 반환)
  const storage = {
    key: k => 'edu.' + SLUG + '.' + k,
    get(k, d) { try { const v = localStorage.getItem(this.key(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(this.key(k), JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove(k) { try { localStorage.removeItem(this.key(k)); } catch (e) { /* 무시 */ } },
    size() { try { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('edu.' + SLUG)) n += (localStorage.getItem(k) || '').length * 2; } return n; } catch (e) { return 0; } },
  };
  // HTML 이스케이프(사용자 입력을 innerHTML에 넣을 때 필수)
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // 토스트: 우하단 스택, 자동 소멸
  function showToast(message, type = 'info', ms = 2500) {
    const root = $('#toast-root'); const el = document.createElement('div');
    el.className = 'toast toast-' + type; el.textContent = message; root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
    return el;
  }

  // 모달: Promise<boolean>. body는 HTML 문자열 또는 Node. Esc·배경 클릭으로 닫힘, 포커스 트랩·복귀
  function showModal({ title, body, confirmText = '확인', cancelText = '취소', danger = false, wide = false, onOpen, validate }) {
    return new Promise(resolve => {
      const root = $('#modal-root'); const prev = document.activeElement;
      const back = document.createElement('div'); back.className = 'modal-back';
      back.innerHTML = `<div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${escapeHtml(title)}</h2><div class="modal-body"></div>
        <div class="modal-actions">${cancelText ? `<button type="button" class="btn btn-ghost" data-m="cancel">${escapeHtml(cancelText)}</button>` : ''}<button type="button" class="btn ${danger ? 'btn-danger' : 'btn-accent'}" data-m="ok">${escapeHtml(confirmText)}</button></div></div>`;
      const bodyEl = $('.modal-body', back);
      if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = body || '';
      root.appendChild(back); document.body.classList.add('modal-open');
      const modal = $('.modal', back);
      const close = (val) => {
        if (val && validate && validate(modal) === false) return;
        back.remove(); if (!root.children.length) document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', onKey, true);
        if (prev && prev.focus) prev.focus(); resolve(val);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); close(false); }
        if (e.key === 'Tab') { // 포커스 트랩
          const f = $$('button,input,select,textarea,[tabindex]:not([tabindex="-1"])', modal).filter(x => !x.disabled);
          if (!f.length) return; const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', onKey, true);
      back.addEventListener('click', e => { if (e.target === back) close(false); });
      modal.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) close(b.dataset.m === 'ok'); });
      if (onOpen) onOpen(modal, close);
      const focusTarget = $('input,select,textarea', bodyEl) || $('[data-m="ok"]', modal); if (focusTarget) focusTarget.focus();
    });
  }

  // DOM 툴팁: data-tip 속성 또는 직접 호출
  const tip = { el: null,
    show(text, x, y) { this.el = this.el || $('#tooltip'); this.el.textContent = text; this.el.hidden = false; this.move(x, y); },
    move(x, y) { if (!this.el || this.el.hidden) return; const w = this.el.offsetWidth, h = this.el.offsetHeight; const left = Math.min(x + 12, window.innerWidth - w - 8), top = y + 16 + h > window.innerHeight ? y - h - 8 : y + 16; this.el.style.left = Math.max(4, left) + 'px'; this.el.style.top = top + 'px'; },
    hide() { if (this.el) this.el.hidden = true; } };
  document.addEventListener('pointerover', e => { const t = e.target.closest('[data-tip]'); if (t && t.dataset.tip) tip.show(t.dataset.tip, e.clientX, e.clientY); });
  document.addEventListener('pointermove', e => { if (e.target.closest('[data-tip]')) tip.move(e.clientX, e.clientY); else tip.hide(); });   // 앵커가 재렌더로 사라져도 숨김
  document.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) tip.hide(); });

  // Pointer Events 드래그 + 탭-탭: 이동 거리 5px 미만이면 탭으로 간주. elementFromPoint로 드롭 대상 판정
  const TAP_PX = 5;
  function makeDraggable(container, { itemSel, targetSel, canDrag, onDrop, onTap }) {
    let start = null, ghost = null, item = null, dragging = false;
    container.addEventListener('pointerdown', e => {
      const it = e.target.closest(itemSel); if (!it || !container.contains(it) || e.button > 0) return;
      if (e.target.closest('button,input,select,a')) return;
      if (canDrag && !canDrag(it)) return;
      item = it; start = { x: e.clientX, y: e.clientY, id: e.pointerId }; dragging = false;
      try { it.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    });
    container.addEventListener('pointermove', e => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) >= TAP_PX) {
        dragging = true; ghost = item.cloneNode(true); ghost.className += ' drag-ghost';
        const r = item.getBoundingClientRect(); ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
        document.body.appendChild(ghost); item.classList.add('drag-src'); document.body.classList.add('dragging');
      }
      if (dragging) {
        ghost.style.transform = `translate(${e.clientX - ghost.offsetWidth / 2}px, ${e.clientY - ghost.offsetHeight / 2}px)`;
        ghost.hidden = true; const under = document.elementFromPoint(e.clientX, e.clientY); ghost.hidden = false;
        $$('.drop-over', container).forEach(x => x.classList.remove('drop-over'));
        const tg = under && under.closest(targetSel); if (tg && container.contains(tg)) tg.classList.add('drop-over');
        e.preventDefault();
      }
    });
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (dragging) {
        ghost.hidden = true; const under = document.elementFromPoint(e.clientX, e.clientY);
        const tg = under && under.closest(targetSel);
        ghost.remove(); item.classList.remove('drag-src'); document.body.classList.remove('dragging');
        $$('.drop-over', container).forEach(x => x.classList.remove('drop-over'));
        if (tg && container.contains(tg) && e.type === 'pointerup') onDrop(item, tg);
      } else if (e.type === 'pointerup' && onTap) onTap(item);
      start = null; item = null; dragging = false; ghost = null;
    };
    container.addEventListener('pointerup', end); container.addEventListener('pointercancel', end);
  }

  // Blob 다운로드
  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // 파일 텍스트 읽기(UTF-8)
  const readFile = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsText(file, 'utf-8'); });
  // 드롭존 바인딩(드래그 중 테두리 강조)
  function bindDropzone(el, onFile) {
    ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.remove('is-over'); }));
    el.addEventListener('drop', e => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) onFile(f); });
  }

  return { storage, escapeHtml, $, $$, todayStr, uid, debounce, showToast, showModal, tip, makeDraggable, download, readFile, bindDropzone };
})();
