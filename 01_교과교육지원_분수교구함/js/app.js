// app.js — 분수교구함(단순화판): 분수 유틸 · SVG 렌더(막대·원·수직선) · 상태/저장 · 이벤트를 한 파일에 담은 단일 화면 앱
'use strict';
(() => {
  const VERSION = '2.0.0';
  const D_MIN = 1, D_MAX = 12, N_UNITS_MAX = 2, CHAIN_MAX = 6; // 분모 범위, 분자 상한(분모×2), 동치 사슬 길이
  const BAR_W = 1000, BAR_H = 150, BAR_GAP = 36, CIRCLE_S = 320, CIRCLE_R = 142, LINE_H = 130; // SVG viewBox 단위
  const CHIPS = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [5, 6], [7, 4]];
  const DEFAULT = { n: 3, d: 4, show: { bar: true, circle: true, line: true, decimal: true, reading: true }, big: false, chain: [] };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---- 저장 래퍼(localStorage 실패 시 메모리 동작 + 토스트 1회) ----
  const storage = {
    key: k => 'edu.fraction-kit.' + k, warned: false,
    get(k, d) { try { const v = localStorage.getItem(this.key(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) {
      try { localStorage.setItem(this.key(k), JSON.stringify(v)); return true; }
      catch (e) { if (!this.warned) { this.warned = true; showToast('브라우저 저장소를 쓸 수 없어 이번 화면에서만 기억해요', 'warn', 3500); } return false; }
    },
    remove(k) { try { localStorage.removeItem(this.key(k)); } catch (e) { /* 무시 */ } },
  };

  // ---- 분수 유틸(정수 연산만) ----
  const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a || 1; };
  // 대분수 분해
  const toMixed = (n, d) => ({ whole: Math.floor(n / d), rem: n % d });
  // 소수 표기: 약분한 분모의 소인수가 2·5뿐이면 유한소수(=), 아니면 ≈ 셋째 자리 반올림
  const toDecimal = (n, d) => {
    if (n === 0) return { sign: '=', text: '0' };
    const g = gcd(n, d); n /= g; d /= g;
    let t = d;
    while (t % 2 === 0) t /= 2;
    while (t % 5 === 0) t /= 5;
    if (t !== 1) return { sign: '≈', text: (n / d).toFixed(3) };
    return { sign: '=', text: String(Math.round(n / d * 1000) / 1000) };
  };
  // 한국어 읽기: '4분의 3', 가분수는 '4분의 7'(대분수 '1과 4분의 3'은 별도 병기)
  const toText = (n, d) => (n === 0 ? '0' : d === 1 ? String(n) : `${d}분의 ${n}`);
  // 대분수 읽기
  const mixedText = (n, d) => { const { whole, rem } = toMixed(n, d); return rem ? `${whole}과 ${d}분의 ${rem}` : String(whole); };
  // 대분수 문자열 '1 3/4'
  const mixedStr = (n, d) => { const { whole, rem } = toMixed(n, d); return rem ? `${whole} ${rem}/${d}` : String(whole); };
  // 세로 분수 HTML(role=img + 읽기 라벨)
  const fracHtml = (n, d, cls = '') => `<span class="fr ${cls}" role="img" aria-label="${toText(n, d)}"><span class="fr-nd" aria-hidden="true"><span class="fr-n">${n}</span><span class="fr-d">${d}</span></span></span>`;
  // 대분수 HTML '1 3/4'
  const mixedHtml = (n, d) => { const { whole, rem } = toMixed(n, d); return `<span class="fr" role="img" aria-label="${mixedText(n, d)}"><span class="fr-w" aria-hidden="true">${whole}</span>${rem ? `<span class="fr-nd" aria-hidden="true"><span class="fr-n">${rem}</span><span class="fr-d">${d}</span></span>` : ''}</span>`; };

  // ---- 상태 ----
  let state = load();
  let anim = null; // 이번 렌더에만 적용할 분할선 애니메이션 {type:'split'|'merge', from:이전 분모}
  // 저장값 검증 후 복원(없거나 깨졌으면 기본값)
  function load() {
    const s = storage.get('v2.state', null), base = JSON.parse(JSON.stringify(DEFAULT));
    if (!s || s.version !== 2 || !Number.isInteger(s.d) || !Number.isInteger(s.n)) return base;
    base.d = clamp(s.d, D_MIN, D_MAX); base.n = clamp(s.n, 0, base.d * N_UNITS_MAX); base.big = !!s.big;
    for (const k in base.show) if (typeof (s.show || {})[k] === 'boolean') base.show[k] = s.show[k];
    if (!base.show.bar && !base.show.circle && !base.show.line) base.show.bar = true;
    if (Array.isArray(s.chain)) base.chain = s.chain.filter(f => f && Number.isInteger(f.n) && Number.isInteger(f.d) && f.d >= D_MIN && f.d <= D_MAX).slice(-CHAIN_MAX);
    return base;
  }
  // 저장
  const save = () => storage.set('v2.state', Object.assign({ version: 2 }, state));
  // 가분수면 단위(막대·원 개수, 수직선 범위) 2, 아니면 1
  const units = () => (state.n > state.d ? 2 : 1);

  // ---- 액션(상태 변경 → 저장 → 렌더) ----
  // 분수 직접 설정(사슬은 지움)
  function setFraction(n, d) {
    if (!Number.isInteger(n) || !Number.isInteger(d)) return;
    state.d = clamp(d, D_MIN, D_MAX); state.n = clamp(n, 0, state.d * N_UNITS_MAX); state.chain = [];
    anim = null; commit();
  }
  // 같게 쪼개기(×k): 분자·분모를 함께 곱하고 사슬에 추가
  function split(k) {
    if (state.d * k > D_MAX) { showToast(`분모는 ${D_MAX}까지만 쪼갤 수 있어요`, 'warn'); return; }
    pushChain(); anim = { type: 'split', from: state.d };
    state.n *= k; state.d *= k; pushChain(); commit();
  }
  // 합치기(약분): 최대공약수로 나눔
  function reduce() {
    const g = state.n === 0 ? 1 : gcd(state.n, state.d);
    if (g === 1) { showToast('이미 가장 간단한 분수예요', 'info'); return; }
    pushChain(); anim = { type: 'merge', from: state.d };
    state.n /= g; state.d /= g; pushChain(); commit();
  }
  // 사슬 끝에 현재 분수 추가(같은 값 연속 방지, 최대 6개)
  function pushChain() {
    const last = state.chain[state.chain.length - 1];
    if (last && last.n === state.n && last.d === state.d) return;
    state.chain.push({ n: state.n, d: state.d });
    if (state.chain.length > CHAIN_MAX) state.chain.shift();
  }
  // 처음으로: 사슬 첫 분수로 되돌리고 사슬 비움
  function clearChain() {
    const first = state.chain[0];
    if (first) { state.n = first.n; state.d = first.d; }
    state.chain = []; anim = null; commit();
  }
  // 모델 켜기/끄기(최소 1개 유지)
  function toggleModel(name) {
    if (!(name in state.show) || name === 'decimal' || name === 'reading') return;
    const on = ['bar', 'circle', 'line'].filter(k => state.show[k]);
    if (state.show[name] && on.length === 1) { showToast('모델은 최소 하나는 켜 두어야 해요', 'warn'); return; }
    state.show[name] = !state.show[name]; commit();
  }
  // 표시 옵션(bar/circle/line/decimal/reading)
  function setShow(key, bool) {
    if (!(key in state.show)) return;
    if (!bool && ['bar', 'circle', 'line'].includes(key)) { toggleModel(key); return; }
    state.show[key] = !!bool; commit();
  }
  // 큰 글씨
  function setBig(bool) { state.big = !!bool; commit(); }
  // 기본값으로 복원(테마는 유지)
  function reset() { state = JSON.parse(JSON.stringify(DEFAULT)); anim = null; commit(); }
  // 칸 클릭: i번째 칸까지 색칠, 이미 그 칸까지 색칠돼 있으면 하나 줄임
  function clickCell(i) { state.n = state.n === i + 1 ? i : i + 1; state.chain = []; anim = null; commit(); }
  function commit() { save(); render(); }

  // ---- 렌더 ----
  function render() {
    const { n, d, show } = state;
    if (state.big) document.documentElement.dataset.big = 'on'; else delete document.documentElement.dataset.big;
    $('[data-action="big"]').setAttribute('aria-pressed', String(state.big));
    $('#val-n').textContent = n; $('#val-d').textContent = d;
    $('[data-action="n-"]').disabled = n <= 0; $('[data-action="n+"]').disabled = n >= d * N_UNITS_MAX;
    $('[data-action="d-"]').disabled = d <= D_MIN; $('[data-action="d+"]').disabled = d >= D_MAX;
    $$('#chips .chip').forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.n === n && +c.dataset.d === d)));
    $('[data-action="split2"]').disabled = d * 2 > D_MAX;
    $('[data-action="split3"]').disabled = d * 3 > D_MAX;
    $('[data-action="reduce"]').disabled = n === 0 || gcd(n, d) === 1;
    $('[data-action="chain-clear"]').disabled = state.chain.length === 0;
    renderNumbers(); renderChain(); renderCaptions();
    $$('[data-model]').forEach(b => b.setAttribute('aria-pressed', String(show[b.dataset.model])));
    $$('[data-show]').forEach(c => { c.checked = show[c.dataset.show]; });
    $('#model-bar').hidden = !show.bar; $('#model-circle').hidden = !show.circle; $('#model-line').hidden = !show.line;
    if (show.bar) renderBar($('#svg-bar'));
    if (show.circle) renderCircle($('#svg-circle'));
    if (show.line) renderLine($('#svg-line'));
    anim = null;
  }
  // 수 표현 패널: 기호·대분수·소수·읽기
  function renderNumbers() {
    const { n, d, show } = state, dec = toDecimal(n, d), improper = n >= d && d > 1;
    const eq = (n % d === 0 || d === 1) ? `<span class="eq">=</span><span class="fr-w">${n / d}</span>` : '';
    $('#sym').innerHTML = fracHtml(n, d, 'big') + (improper && n % d ? `<span class="eq">=</span>${mixedHtml(n, d)}` : eq);
    const mixed = $('#mixed'); mixed.hidden = !improper;
    if (improper) mixed.querySelector('b').textContent = `${n}/${d} = ${mixedStr(n, d)}`;
    const decEl = $('#decimal'); decEl.hidden = !show.decimal; decEl.querySelector('b').textContent = `${dec.sign} ${dec.text}`;
    const readEl = $('#reading'); readEl.hidden = !show.reading;
    readEl.querySelector('b').textContent = toText(n, d) + (improper && n % d ? ` (${mixedText(n, d)})` : '');
  }
  // 동치 사슬 '3/4 = 6/8 = ...' (항을 누르면 그 분수로 돌아감)
  function renderChain() {
    const c = state.chain;
    if (!c.length) { $('#chain').innerHTML = '<span class="empty">×2, ×3, 합치기를 누르면 같은 크기의 분수가 이어져요.</span>'; return; }
    $('#chain').innerHTML = c.map((f, i) => `${i ? '<span class="eq">=</span>' : ''}<button type="button" class="term${f.n === state.n && f.d === state.d ? ' last' : ''}" data-chain="${i}" aria-label="${toText(f.n, f.d)}(으)로 보기">${f.n}/${f.d}</button>`).join('');
  }
  // 모델 캡션 요약('4칸 중 3칸')
  function renderCaptions() {
    const { n, d } = state, U = units();
    $('#cap-bar').textContent = `${d}칸 중 ${n}칸${U > 1 ? ` (막대 ${U}개)` : ''}`;
    $('#cap-circle').textContent = `${d}조각 중 ${n}조각${U > 1 ? ` (원 ${U}개)` : ''}`;
    $('#cap-line').textContent = `0~${U} 사이 ${n}/${d} 위치`;
  }
  // 사슬 항으로 이동(사슬은 유지)
  function gotoChain(i) { const f = state.chain[i]; if (!f) return; state.n = f.n; state.d = f.d; anim = null; commit(); }
  // 분할선 클래스: 쪼개기 직후 새 선은 .new, 합치기 직후 사라지는 선은 .ghost로 그린다
  const divClass = (j, d) => 'div' + (anim && anim.type === 'split' && j % (d / anim.from) !== 0 ? ' new' : '');
  const ghostIdx = d => (anim && anim.type === 'merge' ? [...Array(anim.from).keys()].filter(j => j && j % (anim.from / d) !== 0) : []);
  const ariaLabel = () => `${toText(state.n, state.d)}, ${state.d}칸 중 ${state.n}칸 색칠`;

  // 막대: 단위마다 한 줄, 가분수면 두 줄로 쌓임. 칸 번호 라벨 포함
  function renderBar(svg) {
    const { n, d } = state, U = units(), cell = BAR_W / d, ghosts = ghostIdx(d), gcell = anim ? BAR_W / anim.from : 0;
    let s = '';
    for (let u = 0; u < U; u++) {
      const y = u * (BAR_H + BAR_GAP);
      s += `<rect class="model-bg" x="0" y="${y}" width="${BAR_W}" height="${BAR_H}" rx="6"/>`;
      for (let i = 0; i < d; i++) {
        const gi = u * d + i, on = gi < n;
        s += `<rect class="cell${on ? ' on' : ''}" data-i="${gi}" x="${i * cell}" y="${y}" width="${cell}" height="${BAR_H}"><title>${gi + 1}번째 칸</title></rect>`;
        s += `<text class="cell-label${on ? ' on' : ''}" x="${(i + .5) * cell}" y="${y + BAR_H / 2}" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`;
      }
      for (const j of ghosts) s += `<line class="div ghost" x1="${j * gcell}" x2="${j * gcell}" y1="${y}" y2="${y + BAR_H}"/>`;
      for (let j = 1; j < d; j++) s += `<line class="${divClass(j, d)}" x1="${j * cell}" x2="${j * cell}" y1="${y}" y2="${y + BAR_H}"/>`;
      s += `<rect class="frame" x="0" y="${y}" width="${BAR_W}" height="${BAR_H}" rx="6"/>`;
    }
    svg.setAttribute('viewBox', `0 0 ${BAR_W} ${U * BAR_H + (U - 1) * BAR_GAP}`);
    svg.setAttribute('aria-label', '막대 모델: ' + ariaLabel());
    svg.innerHTML = s;
  }
  // 원: 부채꼴 d개, 가분수면 원 2개 나란히. 조각 번호 라벨 포함
  function renderCircle(svg) {
    const { n, d } = state, U = units(), R = CIRCLE_R, ghosts = ghostIdx(d);
    const pt = (cx, cy, deg, r = R) => `${(cx + r * Math.cos(deg * Math.PI / 180)).toFixed(2)} ${(cy + r * Math.sin(deg * Math.PI / 180)).toFixed(2)}`;
    let s = '';
    for (let u = 0; u < U; u++) {
      const cx = u * CIRCLE_S + CIRCLE_S / 2, cy = CIRCLE_S / 2;
      s += `<circle class="model-bg" cx="${cx}" cy="${cy}" r="${R}"/>`;
      for (let i = 0; i < d; i++) {
        const gi = u * d + i, on = gi < n, a0 = -90 + i * 360 / d, a1 = a0 + 360 / d;
        const shape = d === 1 ? `<circle class="cell${on ? ' on' : ''}" data-i="${gi}" cx="${cx}" cy="${cy}" r="${R}">`
          : `<path class="cell${on ? ' on' : ''}" data-i="${gi}" d="M ${cx} ${cy} L ${pt(cx, cy, a0)} A ${R} ${R} 0 ${360 / d > 180 ? 1 : 0} 1 ${pt(cx, cy, a1)} Z">`;
        s += `${shape}<title>${gi + 1}번째 조각</title></${d === 1 ? 'circle' : 'path'}>`;
        const [lx, ly] = pt(cx, cy, (a0 + a1) / 2, d === 1 ? 0 : R * .68).split(' ');
        s += `<text class="cell-label${on ? ' on' : ''}" x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`;
      }
      for (const j of ghosts) s += `<line class="div ghost" x1="${cx}" y1="${cy}" x2="${pt(cx, cy, -90 + j * 360 / anim.from).replace(' ', '" y2="')}"/>`;
      if (d > 1) for (let j = 0; j < d; j++) s += `<line class="${divClass(j, d)}" x1="${cx}" y1="${cy}" x2="${pt(cx, cy, -90 + j * 360 / d).replace(' ', '" y2="')}"/>`;
      s += `<circle class="frame" cx="${cx}" cy="${cy}" r="${R}"/>`;
    }
    svg.setAttribute('viewBox', `0 0 ${U * CIRCLE_S} ${CIRCLE_S}`);
    svg.setAttribute('aria-label', '원 모델: ' + ariaLabel());
    svg.innerHTML = s;
  }
  // 수직선: 0~1(또는 0~2), 1/d 눈금과 분수 라벨, 현재 분수 위치에 점
  function renderLine(svg) {
    const { n, d } = state, U = units(), x0 = 40, x1 = BAR_W - 40, y = 56, total = U * d;
    const px = v => (x0 + (x1 - x0) * v / U).toFixed(1);
    const every = (x1 - x0) / total < 72 ? 2 : 1; // 눈금이 촘촘하면 분수 라벨을 하나 걸러 표시
    let s = `<line class="axis" x1="${x0 - 14}" x2="${x1 + 14}" y1="${y}" y2="${y}"/><path class="axis-arrow" d="M ${x1 + 16} ${y} l -12 -7 v 14 z"/>`;
    if (n > 0) s += `<line class="pt-track" x1="${px(0)}" x2="${px(n / d)}" y1="${y}" y2="${y}"/>`;
    for (const j of ghostIdx(d)) for (let u = 0; u < U; u++) { const x = px(u + j / anim.from); s += `<line class="tick ghost" x1="${x}" x2="${x}" y1="${y - 10}" y2="${y + 10}"/>`; }
    for (let k = 0; k <= total; k++) {
      const isInt = k % d === 0, x = px(k / d), isNew = !isInt && anim && anim.type === 'split' && k % (d / anim.from) !== 0;
      s += `<line class="tick${isInt ? ' big' : ''}${isNew ? ' new' : ''}" x1="${x}" x2="${x}" y1="${y - (isInt ? 18 : 10)}" y2="${y + (isInt ? 18 : 10)}"/>`;
      if (isInt) s += `<text class="tick-label int" x="${x}" y="${y + 56}" text-anchor="middle">${k / d}</text>`;
      else if (d <= D_MAX && k % every === 0) s += `<text class="tick-label" x="${x}" y="${y + 48}" text-anchor="middle">${k}/${d}</text>`;
    }
    s += `<text class="pt-label" x="${px(n / d)}" y="${y - 30}" text-anchor="middle">${n}/${d}</text><circle class="pt" cx="${px(n / d)}" cy="${y}" r="15"/>`;
    svg.setAttribute('viewBox', `0 0 ${BAR_W} ${LINE_H}`);
    svg.setAttribute('aria-label', `수직선 모델: ${toText(n, d)}, 0부터 ${U}까지`);
    svg.innerHTML = s;
  }

  // ---- 토스트·모달 ----
  function showToast(message, type = 'info', ms = 2500) {
    const root = $('#toast-root');
    while (root.children.length >= 3) root.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast ' + type; t.setAttribute('role', 'status'); t.textContent = message;
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, ms);
  }
  // 확인 모달 → Promise<boolean>. cancelText가 빈 문자열이면 확인 버튼만 둔다
  function showModal({ title, body, confirmText = '확인', cancelText = '취소', danger = false }) {
    return new Promise(resolve => {
      const root = $('#modal-root'), prev = document.activeElement;
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <div class="modal-head"><h2 id="dlg-title"></h2><button type="button" class="modal-x" data-value="0" aria-label="닫기">×</button></div>
        <div class="modal-body"></div>
        <div class="modal-foot">${cancelText ? `<button type="button" class="btn" data-value="0"></button>` : ''}<button type="button" class="btn primary${danger ? ' danger' : ''}" data-value="1"></button></div></div>`;
      wrap.querySelector('h2').textContent = title;
      const foot = $$('.modal-foot .btn', wrap); foot[foot.length - 1].textContent = confirmText; if (cancelText) foot[0].textContent = cancelText;
      const bodyEl = wrap.querySelector('.modal-body');
      if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
      root.appendChild(wrap);
      const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); resolve(v); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        if (e.key === 'Tab') { // 포커스 트랩
          const f = $$('button', wrap), first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      wrap.addEventListener('click', e => {
        if (e.target === wrap) return close(false);
        const b = e.target.closest('[data-value]'); if (b) close(b.dataset.value === '1');
      });
      document.addEventListener('keydown', onKey);
      setTimeout(() => foot[0].focus(), 20);
    });
  }
  // 도움말 모달(README '사용 방법'과 동일)
  function showHelp() {
    showModal({
      title: '분수교구함 사용법', confirmText: '닫기', cancelText: '',
      body: `<ol>
        <li><b>분수 만들기</b> — 분모·분자 −/+ 버튼을 누르거나 자주 쓰는 분수 칩을 고르세요. 막대나 원의 칸을 직접 눌러 색칠해도 됩니다(마지막 칸을 다시 누르면 하나 줄어요).</li>
        <li><b>세 모델 함께 보기</b> — 막대(길이)·원(넓이)·수직선(수)과 분수 기호·소수·읽기가 동시에 바뀝니다. 분자가 분모보다 크면 막대·원이 2개가 되고 대분수가 함께 표시돼요.</li>
        <li><b>같게 쪼개기·합치기</b> — ×2, ×3을 누르면 모든 칸이 쪼개지고 색칠된 양은 그대로입니다(동치분수). 합치기(약분)는 다시 간단한 분수로 돌아가고, 과정이 동치 사슬에 쌓입니다.</li>
      </ol>
      <h3>수업 팁 — 동치분수 시연 순서</h3>
      <ul>
        <li>분모 4, 칸을 눌러 3/4를 만든 뒤 세 모델이 모두 같은 양을 나타냄을 짚어 주세요.</li>
        <li>"×2를 누르면 색칠된 양이 달라질까?" 예측하게 한 뒤 ×2 → 6/8이 되어도 색칠 양이 그대로임을 확인하고 사슬 '3/4 = 6/8'을 함께 읽습니다.</li>
        <li>합치기로 3/4로 돌아온 뒤, 소수·읽기 체크를 꺼 두고 학생이 먼저 예측하게 해 보세요.</li>
        <li>전자칠판·TV에서는 '큰 글씨'를 켜면 뒷자리까지 잘 보입니다. 보기 버튼으로 모델을 하나씩만 남겨 집중시킬 수도 있어요.</li>
      </ul>
      <p class="hint">키보드: ←/→ 분자, ↑/↓ 분모, Tab으로 이동, Enter/Space로 버튼 누르기, Esc로 창 닫기.</p>`,
    });
  }
  // 초기화 확인 모달
  async function confirmReset() {
    const ok = await showModal({ title: '처음 상태로 되돌릴까요?', body: '<p>분수는 3/4, 세 모델이 모두 켜진 기본 상태로 돌아갑니다. 동치 사슬도 지워져요.</p>', confirmText: '되돌리기', danger: true });
    if (ok) { reset(); showToast('처음 상태로 돌아왔어요', 'success'); }
  }

  // ---- 테마 ----
  const isDark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  function applyTheme(t) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    $('#btn-theme').textContent = isDark() ? '☀️' : '🌙';
  }
  function toggleTheme() { const t = isDark() ? 'light' : 'dark'; applyTheme(t); storage.set('theme', t); }
  // 저장된 테마가 없으면 OS 설정 변경을 따라 아이콘 갱신
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.dataset.theme) applyTheme(null); });

  // ---- 이벤트(위임) ----
  const ACTIONS = {
    'n-': () => setFraction(state.n - 1, state.d), 'n+': () => setFraction(state.n + 1, state.d),
    'd-': () => setFraction(state.n, state.d - 1), 'd+': () => setFraction(state.n, state.d + 1),
    split2: () => split(2), split3: () => split(3), reduce, 'chain-clear': clearChain,
    big: () => setBig(!state.big), theme: toggleTheme, help: showHelp, reset: confirmReset,
  };
  document.addEventListener('click', e => {
    const act = e.target.closest('[data-action]');
    if (act && ACTIONS[act.dataset.action]) { ACTIONS[act.dataset.action](); return; }
    const chip = e.target.closest('#chips .chip');
    if (chip) { setFraction(+chip.dataset.n, +chip.dataset.d); return; }
    const tg = e.target.closest('[data-model]');
    if (tg) { toggleModel(tg.dataset.model); return; }
    const term = e.target.closest('[data-chain]');
    if (term) { gotoChain(+term.dataset.chain); return; }
    const cell = e.target.closest('.model .cell');
    if (cell) clickCell(+cell.dataset.i);
  });
  document.addEventListener('change', e => {
    const c = e.target.closest('[data-show]');
    if (c) setShow(c.dataset.show, c.checked);
  });
  // 키보드 단축키: ←/→ 분자, ↑/↓ 분모 (모달이 열려 있거나 체크박스에 포커스가 있을 때는 제외)
  const KEYS = { ArrowRight: 'n+', ArrowLeft: 'n-', ArrowUp: 'd+', ArrowDown: 'd-' };
  document.addEventListener('keydown', e => {
    if (!KEYS[e.key] || e.altKey || e.ctrlKey || e.metaKey || $('#modal-root').children.length || e.target.matches('input')) return;
    e.preventDefault(); ACTIONS[KEYS[e.key]]();
  });
  // 자주 쓰는 분수 칩 생성
  $('#chips').innerHTML = CHIPS.map(([n, d]) => `<button type="button" class="chip" data-n="${n}" data-d="${d}" aria-label="${toText(n, d)}">${n}/${d}</button>`).join('');

  // ---- 시작 ----
  applyTheme(storage.get('theme', null));
  render();
  // 테스트·디버그용 공개 API
  window.__app = { version: VERSION, getState: () => JSON.parse(JSON.stringify(state)), actions: { setFraction, split, reduce, reset, toggleModel, setShow } };
})();
