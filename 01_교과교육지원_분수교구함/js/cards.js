// cards.js — 예측-확인 탐구 카드: 목록·세트·학년 필터, 예측 → 확인(커튼 해제 + 자동 재생), 학급 집계, 카드 편집·세트 저장
'use strict';
(() => {
  const F = FK.frac, R = FK.render, A = FK.anim, U = FK.ui;
  const { $, escapeHtml, clamp, toast } = U;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TYPE_LABEL = { make: '만들기', compare: '비교', split: '쪼개기', add: '덧셈', sub: '뺄셈', convert: '변환', decimal: '소수', line: '수직선' };
  const KIT_TYPES = ['make', 'split', 'convert', 'decimal', 'line'];
  let app, st, db;
  const cur = { predict: null, revealed: false, board: null, filterGrade: '', search: '', play: null };

  // 현재 목록(세트·학년·검색 반영)
  function visible() {
    let list;
    const set = st.currentSetId && db.cardSets.find(s => s.id === st.currentSetId);
    if (set) list = set.cardIds.map(id => db.cards.find(c => c.id === id)).filter(Boolean);
    else list = [...db.cards].sort((a, b) => a.order - b.order);
    if (cur.filterGrade) list = list.filter(c => String(c.grade) === cur.filterGrade);
    if (cur.search) { const q = cur.search.toLowerCase(); list = list.filter(c => (c.question + ' ' + c.unit).toLowerCase().includes(q)); }
    return list;
  }
  const current = () => db.cards.find(c => c.id === st.currentCardId) || null;

  // 카드 setup → 작업판 상태
  function boardFor(card) {
    const s = card.setup, kind = card.type === 'compare' ? 'compare' : (card.type === 'add' || card.type === 'sub') ? 'arith' : 'kit';
    if (kind === 'compare') return { kind, s: { a: { ...s.a }, b: { ...(s.b || s.a) }, overlay: false, step: 0 } };
    if (kind === 'arith') return { kind, s: { a: { ...s.a }, b: { ...(s.b || s.a) }, op: card.type === 'sub' ? '-' : '+', step: 0, mirror: false } };
    const k = app.defaults.kit(); k.n = s.a.n; k.d = s.a.d; k.lineRange = s.lineRange || 'auto'; k.showDecimal = card.type === 'decimal' || card.type === 'line'; k.chain = [{ n: k.n, d: k.d, op: 'start' }];
    k.models = { bar: true, circle: s.model !== 'line' && s.a.d <= 12, line: true };
    return { kind, s: k, b: s.b || null };
  }
  function select(id) {
    if (cur.play) { cur.play.stop(); cur.play = null; } A.finishAll();
    st.currentCardId = id; cur.predict = null; cur.revealed = false;
    const c = current(); cur.board = c ? boardFor(c) : null;
    app.persist(); render();
  }
  function predict(i) { if (cur.revealed) return; cur.predict = i; renderView(); }
  // 확인: 커튼 해제 + 유형별 자동 재생
  function reveal() {
    const c = current(); if (!c || cur.predict == null || cur.revealed) return;
    cur.revealed = true; FK.setCurtain(false); A.finishAll();
    const b = cur.board, stage = $('#card-stage');
    renderView(); renderTally(); renderStage();
    if (b.kind === 'compare') cur.play = A.playSteps(() => { const r = app.Compare.advance(b.s); if (!r) return false; app.Compare.render(stage, b.s, { anim: r.anim }); return b.s.step < 3; }, 700);
    else if (b.kind === 'arith') cur.play = A.playSteps(() => { const before = b.s.step, r = app.Arith.advance(b.s); if (!r) return false; app.Arith.render(stage, b.s, { anim: r.anim }); return before !== b.s.step && !!app.Arith.advance(app.clone(b.s)); }, 1000);
    else if (c.type === 'split') cur.play = A.playSteps(() => { const k = b.s, g = F.gcd(k.n, k.d); if (g === 1 || k.d === 1) return false; const p = F.spf(g), from = k.d; k.n /= p; k.d /= p; k.chain.push({ n: k.n, d: k.d, op: '÷' + p }); app.Kit.render(stage, k, { anim: { type: 'merge', from } }); return F.gcd(k.n, k.d) > 1 && k.d > 1; }, 800);
  }

  // ---- 렌더 ----
  function render() { renderSetSelect(); renderList(); renderView(); renderTally(); renderStage(); }
  function renderSetSelect() {
    const sel = $('#card-set');
    sel.innerHTML = `<option value="">전체 카드 (${db.cards.length}장)</option>` + db.cardSets.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${s.cardIds.length})</option>`).join('');
    sel.value = st.currentSetId && db.cardSets.some(s => s.id === st.currentSetId) ? st.currentSetId : '';
    $$('#card-grade .chip').forEach(ch => ch.setAttribute('aria-pressed', String(ch.dataset.grade === cur.filterGrade)));
  }
  function renderList() {
    const list = visible(), ul = $('#card-list');
    if (!db.cards.length) { ul.innerHTML = `<li class="empty">카드가 없어요.<br><button type="button" class="chip-btn" data-action="reset-samples">샘플 복원</button></li>`; return; }
    ul.innerHTML = list.length ? list.map((c, i) => { const id = escapeHtml(c.id); return `<li class="card-item ${c.id === st.currentCardId ? 'active' : ''}" data-id="${id}">
      <input type="checkbox" class="card-check teacher-only" data-check="${id}" aria-label="카드 선택">
      <button type="button" class="card-pick" data-pick="${id}"><span class="badge t-${c.type}">${TYPE_LABEL[c.type]}</span><span class="card-q">${escapeHtml(c.question)}</span><span class="muted">${c.grade}학년 · ${escapeHtml(c.unit)}</span></button>
      <span class="card-ops teacher-only"><button type="button" data-move="-1" data-id="${id}" aria-label="위로" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" data-id="${id}" aria-label="아래로" ${i === list.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-edit="${id}" aria-label="편집">✎</button><button type="button" data-del="${id}" aria-label="삭제">×</button></span></li>`; }).join('')
      : '<li class="empty">조건에 맞는 카드가 없어요</li>';
  }
  function renderView() {
    const c = current(), v = $('#card-view'), list = visible(), idx = list.findIndex(x => x.id === st.currentCardId);
    if (!c) { v.innerHTML = '<p class="empty">왼쪽 목록에서 카드를 고르세요</p>'; return; }
    const correct = cur.predict === c.answer;
    v.innerHTML = `<div class="card-meta"><span class="badge t-${c.type}">${TYPE_LABEL[c.type]}</span><span class="muted">${c.grade}학년 · ${escapeHtml(c.unit)}${c.builtin ? ' · 내장' : ''}</span><span class="muted">${idx + 1} / ${list.length}</span></div>
      <h2 class="card-q-big">${escapeHtml(c.question)}</h2>
      <div class="choices">${c.choices.map((ch, i) => `<button type="button" class="choice ${cur.predict === i ? 'picked' : ''} ${cur.revealed && i === c.answer ? 'answer' : ''} ${cur.revealed && cur.predict === i && i !== c.answer ? 'wrong' : ''}" data-choice="${i}" ${cur.revealed ? 'disabled' : ''}>${F.inline(escapeHtml(ch))}</button>`).join('')}</div>
      <div class="card-actions">
        <span class="predict-badge" ${cur.predict == null ? 'hidden' : ''}>예측: ${cur.predict != null ? F.inline(escapeHtml(c.choices[cur.predict])) : ''}</span>
        <button type="button" class="chip-btn accent" data-card="confirm" ${cur.predict == null || cur.revealed ? 'disabled' : ''}>확인</button>
        <button type="button" class="chip-btn ghost" data-card="prev" ${idx <= 0 ? 'disabled' : ''}>이전</button>
        <button type="button" class="chip-btn ghost" data-card="next">${idx >= list.length - 1 ? '처음 카드로' : '다음'}</button>
      </div>
      ${cur.revealed ? `<p class="result-msg ${correct ? 'ok' : 'warn'}">${correct ? '예측대로예요!' : '예측과 달라요 — 왜 그럴까요?'}</p><div class="explain teacher-only"><b>교사용 해설</b><p>${escapeHtml(c.explanation)}</p></div>` : ''}`;
  }
  // 현재 카드의 집계(0~99 클램프)와 합계
  const tallyOf = c => { const t = db.tally[c.id] || { counts: c.choices.map(() => 0), label: '' }; const counts = c.choices.map((_, i) => clamp(t.counts[i] | 0, 0, 99)); return { t, counts, total: counts.reduce((a, b) => a + b, 0) }; };
  const tallyLabel = (n, total) => `${n}명 · ${total ? (n / total * 100).toFixed(1) + '%' : '-'}`;
  const tallyTotal = (t, total) => `손든 수 입력 · 합계 ${total}명${t.label ? ' · ' + t.label : ''}`;
  function renderTally() {
    const c = current(), p = $('#tally-panel');
    if (!c) { p.innerHTML = ''; return; }
    const { t, counts, total } = tallyOf(c);
    p.innerHTML = `<div class="tally-head"><b>학급 집계</b><span class="muted tally-total">${escapeHtml(tallyTotal(t, total))}</span><button type="button" class="chip-btn ghost" data-tally="clear">지우기</button></div>
      ${c.choices.map((ch, i) => `<div class="tally-row ${cur.revealed && i === c.answer ? 'correct' : ''}"><span class="tally-choice">${F.inline(escapeHtml(ch))}</span><input type="number" min="0" max="99" value="${counts[i]}" data-tally="${i}" aria-label="선택지 ${i + 1} 인원"><div class="tally-bar"><div class="tally-fill" style="width:${total ? counts[i] / total * 100 : 0}%"></div></div><span class="tally-label">${tallyLabel(counts[i], total)}</span></div>`).join('')}`;
  }
  // 입력 중에는 입력란을 다시 만들지 않고 막대·라벨·합계만 갱신(캐럿 위치 보존 → 두 자리 수 타이핑 가능)
  function updateTallyBars() {
    const c = current(), p = $('#tally-panel'); if (!c) return;
    const { t, counts, total } = tallyOf(c);
    const tot = p.querySelector('.tally-total'); if (tot) tot.textContent = tallyTotal(t, total);
    p.querySelectorAll('.tally-row').forEach((row, i) => { row.querySelector('.tally-fill').style.width = (total ? counts[i] / total * 100 : 0) + '%'; row.querySelector('.tally-label').textContent = tallyLabel(counts[i], total); });
  }
  function setTally(counts, quiet) {
    const c = current(); if (!c) return;
    db.tally[c.id] = { counts: c.choices.map((_, i) => clamp(Math.round(+counts[i]) || 0, 0, 99)), label: (db.tally[c.id] || {}).label || '', updatedAt: new Date().toISOString() };
    app.saveDb(); if (quiet) updateTallyBars(); else renderTally();
  }
  // 연동 작업판
  function renderStage() {
    const c = current(), stage = $('#card-stage'), b = cur.board;
    if (!c || !b) { stage.innerHTML = '<p class="empty">카드를 고르면 교구가 준비돼요</p>'; return; }
    const cover = cur.revealed ? '' : 'curtained';
    if (b.kind === 'compare') {
      stage.innerHTML = `<svg class="cmp-bars ab-svg" role="img" aria-label="두 분수 막대"></svg><svg class="cmp-line nline-svg" role="img" aria-label="수직선"></svg><ol class="steps cmp-steps"><li>A 재분할</li><li>B 재분할</li><li>비교</li></ol><div class="formula ${cover} cmp-formula"></div>`;
      app.Compare.render(stage, b.s, {});
    } else if (b.kind === 'arith') {
      stage.innerHTML = `<svg class="ar-bars ab-svg" role="img" aria-label="덧셈·뺄셈 막대"></svg><ol class="steps ar-steps"><li>통분</li><li>합치기/지우기</li><li>결과</li><li>약분</li></ol><div class="formula ${cover} ar-formula"></div><p class="mirror-label ar-mirror-label" hidden></p>`;
      app.Arith.render(stage, b.s, {});
    } else {
      stage.innerHTML = `<div class="models stage-models"><figure class="model" data-model="bar"><figcaption>막대</figcaption><svg class="kit-bar"></svg></figure><figure class="model" data-model="circle"><figcaption>원</figcaption><svg class="kit-circle"></svg></figure><figure class="model" data-model="line"><figcaption>수직선</figcaption><svg class="kit-line"></svg></figure></div><div class="symbol-row"><div class="symbol-panel ${cover} kit-symbol"></div><div class="formula ${cover} kit-chain"></div></div>`;
      app.Kit.render(stage, b.s, {});
      if (b.b) { // 수직선 위 두 분수(예: 1/4과 0.3)
        const L = F.lcm(b.s.d, b.b.d), Un = R.unitsFor(Math.max(b.s.n * L / b.s.d, b.b.n * L / b.b.d), L, b.s.lineRange);
        R.line(stage.querySelector('.kit-line'), { d: L, range: Un, points: [{ n: b.s.n * (L / b.s.d), cls: 'a', label: F.str(b.s.n, b.s.d) }, { n: b.b.n * (L / b.b.d), cls: 'b', label: F.toDecimal(b.b.n, b.b.d) }], labels: L <= 12 });
        stage.querySelector('.kit-chain').innerHTML = `<span class="term">${F.str(b.s.n, b.s.d)}</span><span class="eq">vs</span><span class="term">${F.str(b.b.n, b.b.d)} = ${F.toDecimal(b.b.n, b.b.d)}</span>`;
      }
    }
  }

  // ---- 이동·순서·세트 ----
  function step(dir) {
    const list = visible(); if (!list.length) return;
    const idx = list.findIndex(x => x.id === st.currentCardId);
    select(list[dir > 0 ? (idx >= list.length - 1 ? 0 : idx + 1) : Math.max(0, idx - 1)].id);
  }
  function move(id, dir) {
    const set = st.currentSetId && db.cardSets.find(s => s.id === st.currentSetId);
    if (set) { const i = set.cardIds.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= set.cardIds.length) return; [set.cardIds[i], set.cardIds[j]] = [set.cardIds[j], set.cardIds[i]]; }
    else { const sorted = [...db.cards].sort((a, b) => a.order - b.order), i = sorted.findIndex(c => c.id === id), j = i + dir; if (j < 0 || j >= sorted.length) return; [sorted[i].order, sorted[j].order] = [sorted[j].order, sorted[i].order]; }
    app.saveDb(); renderList();
  }
  async function saveSet() {
    const ids = $$('#card-list [data-check]:checked').map(c => c.dataset.check);
    if (ids.length < 1) return toast('세트에 넣을 카드를 먼저 체크하세요', 'warn');
    let name = '';
    const ok = await U.openDialog({ title: '세트로 저장', body: `<label class="form-label">세트 이름 <input type="text" id="set-name" maxlength="40" placeholder="예: 5-1 통분 도입"></label><p class="form-err" id="set-err"></p><p class="muted">체크한 카드 ${ids.length}장</p>`, buttons: [{ text: '취소', value: null }, { text: '저장', value: true, primary: true }],
      validate(a) { name = a.body.querySelector('#set-name').value.trim(); a.body.querySelector('#set-err').textContent = name ? '' : '이름을 입력하세요'; return !!name; } });
    if (!ok) return;
    const set = { id: U.uid('cs-'), name, cardIds: ids, builtin: false, createdAt: new Date().toISOString() };
    db.cardSets.push(set); app.saveDb(); st.currentSetId = set.id; select(ids[0]); toast(`세트 '${name}' 저장`, 'success');
  }
  async function remove(id) {
    const c = db.cards.find(x => x.id === id); if (!c) return;
    if (!await U.showModal({ title: '카드 삭제', body: `<p>'${escapeHtml(c.question)}' 카드를 삭제할까요?${c.builtin ? '<br><span class="muted">내장 카드는 샘플 복원으로 되살릴 수 있어요.</span>' : ''}</p>`, confirmText: '삭제', danger: true })) return;
    db.cards = db.cards.filter(x => x.id !== id); db.cardSets.forEach(s => { s.cardIds = s.cardIds.filter(x => x !== id); }); delete db.tally[id];
    app.saveDb(); toast('카드를 삭제했어요', 'info');
    if (st.currentCardId === id) { const l = visible(); st.currentCardId = null; if (l.length) return select(l[0].id); cur.board = null; }
    render();
  }

  // ---- 카드 편집 모달 ----
  function edit(id) {
    const base = id ? app.clone(db.cards.find(c => c.id === id)) : { id: null, grade: 5, unit: '5-1 약분과 통분', type: 'compare', question: '', choices: ['', ''], answer: 0, setup: { a: { n: 1, d: 2 }, b: { n: 1, d: 3 }, op: null, model: 'bar', lineRange: 1 }, explanation: '', builtin: false };
    const c = base; if (!c.setup.b) c.setup.b = { n: 1, d: 3 };
    const needB = t => ['compare', 'add', 'sub', 'line'].includes(t);
    const body = `<div class="edit-form">
      <div class="form-grid">
        <label>학년 <select id="ef-grade">${[3, 4, 5].map(g => `<option value="${g}" ${c.grade === g ? 'selected' : ''}>${g}학년</option>`).join('')}</select></label>
        <label>단원 <input type="text" id="ef-unit" maxlength="30" value="${escapeHtml(c.unit)}"></label>
        <label>유형 <select id="ef-type">${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}" ${c.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>모델 <select id="ef-model">${[['bar', '막대'], ['circle', '원'], ['line', '수직선']].map(([k, v]) => `<option value="${k}" ${c.setup.model === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>수직선 범위 <select id="ef-range">${[1, 2, 3].map(r => `<option value="${r}" ${c.setup.lineRange === r ? 'selected' : ''}>0~${r}</option>`).join('')}</select></label>
        <div class="fr-btns"><button type="button" class="chip-btn" id="ef-a">분수 A: <span></span></button><button type="button" class="chip-btn" id="ef-b">분수 B: <span></span></button></div>
      </div>
      <label>질문 <textarea id="ef-q" maxlength="120" rows="2">${escapeHtml(c.question)}</textarea></label>
      <div class="choices-edit"><b>선택지(2~4개, 정답에 표시)</b><div id="ef-choices"></div><button type="button" class="chip-btn ghost" id="ef-add">선택지 추가</button></div>
      <label>해설 <textarea id="ef-exp" maxlength="300" rows="3">${escapeHtml(c.explanation)}</textarea></label>
      <p class="form-err" id="ef-err" role="alert"></p></div>`;
    let api;
    const kitType = () => KIT_TYPES.includes(api.body.querySelector('#ef-type').value);
    const drawChoices = () => {
      api.body.querySelector('#ef-choices').innerHTML = c.choices.map((ch, i) => `<div class="choice-row"><input type="radio" name="ef-ans" value="${i}" ${c.answer === i ? 'checked' : ''} aria-label="정답 ${i + 1}"><input type="text" data-ch="${i}" maxlength="30" value="${escapeHtml(ch)}" placeholder="선택지 ${i + 1} (예: 3/4)"><button type="button" data-rm="${i}" aria-label="선택지 삭제" ${c.choices.length <= 2 ? 'disabled' : ''}>×</button></div>`).join('');
      api.body.querySelector('#ef-add').disabled = c.choices.length >= 4;
    };
    const sync = () => { api.body.querySelector('#ef-a span').textContent = F.str(c.setup.a.n, c.setup.a.d); api.body.querySelector('#ef-b span').textContent = F.str(c.setup.b.n, c.setup.b.d); api.body.querySelector('#ef-b').hidden = !needB(api.body.querySelector('#ef-type').value); validate(); };
    const validate = () => {
      const b = api.body, t = b.querySelector('#ef-type').value, errs = [];
      c.grade = +b.querySelector('#ef-grade').value; c.unit = b.querySelector('#ef-unit').value.trim(); c.type = t; c.question = b.querySelector('#ef-q').value.trim(); c.explanation = b.querySelector('#ef-exp').value.trim();
      c.setup.model = b.querySelector('#ef-model').value; c.setup.lineRange = +b.querySelector('#ef-range').value; c.setup.op = t === 'add' ? '+' : t === 'sub' ? '-' : null;
      b.querySelectorAll('[data-ch]').forEach(i => { c.choices[+i.dataset.ch] = i.value.trim(); });
      const r = b.querySelector('input[name=ef-ans]:checked'); c.answer = r ? +r.value : -1;
      if (!c.question) errs.push('질문을 입력하세요');
      if (c.choices.length < 2 || c.choices.length > 4 || c.choices.some(x => !x)) errs.push('선택지는 2~4개, 빈칸 없이');
      if (!(c.answer >= 0 && c.answer < c.choices.length)) errs.push('정답을 고르세요');
      if (!F.valid(c.setup.a, kitType() ? 1 : 2, kitType() ? 24 : 12)) errs.push('분수 A 범위 오류');
      if (needB(t) && !F.valid(c.setup.b, 2, 12)) errs.push('분수 B 범위 오류');
      if (t === 'sub' && F.compare(c.setup.a, c.setup.b) < 0) errs.push('뺄셈은 A ≥ B여야 해요');
      b.querySelector('#ef-err').textContent = errs.join(' · '); api.setDisabled(1, errs.length > 0); return !errs.length;
    };
    U.openDialog({ title: id ? '카드 편집' : '새 카드', body, size: 'wide', buttons: [{ text: '취소', value: null }, { text: '저장', value: true, primary: true }], validate: () => validate(),
      onOpen(a) {
        api = a; drawChoices(); sync();
        a.body.addEventListener('input', validate); a.body.addEventListener('change', e => { if (e.target.id === 'ef-type') sync(); else validate(); });
        a.body.addEventListener('click', async e => {
          const t = e.target.closest('button'); if (!t) return;
          if (t.id === 'ef-add' && c.choices.length < 4) { c.choices.push(''); drawChoices(); validate(); }
          else if (t.dataset.rm != null && c.choices.length > 2) { c.choices.splice(+t.dataset.rm, 1); if (c.answer >= c.choices.length) c.answer = 0; drawChoices(); validate(); }
          else if (t.id === 'ef-a') { const fr = await U.keypad({ value: c.setup.a, dMin: kitType() ? 1 : 2, dMax: kitType() ? 24 : 12, title: '분수 A' }); if (fr) { c.setup.a = fr; sync(); } }
          else if (t.id === 'ef-b') { const fr = await U.keypad({ value: c.setup.b, title: '분수 B' }); if (fr) { c.setup.b = fr; sync(); } }
        });
      } }).then(ok => {
      if (!ok) return;
      if (!needB(c.type)) c.setup.b = null;
      if (id) { const i = db.cards.findIndex(x => x.id === id); db.cards[i] = Object.assign(db.cards[i], c); }
      else { c.id = U.uid('cd-'); c.builtin = false; c.order = db.cards.reduce((m, x) => Math.max(m, x.order), 0) + 1; db.cards.push(c); }
      app.saveDb(); toast(id ? '카드를 저장했어요' : '새 카드를 추가했어요', 'success'); select(c.id);
    });
  }

  // ---- 초기화 ----
  function init() {
    app = FK.app; st = app.state; db = app.db;
    cur.filterGrade = app.settings.gradePreset && app.settings.gradePreset <= 5 ? String(app.settings.gradePreset) : '';
    $('#card-set').addEventListener('change', e => { st.currentSetId = e.target.value || null; const l = visible(); if (!l.some(c => c.id === st.currentCardId)) select(l.length ? l[0].id : null); else { app.persist(); render(); } });
    $('#card-grade').addEventListener('click', e => { const b = e.target.closest('[data-grade]'); if (!b) return; cur.filterGrade = b.dataset.grade; render(); });
    $('#card-search').addEventListener('input', e => { cur.search = e.target.value.trim(); renderList(); });
    $('#card-list').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pick) select(b.dataset.pick); else if (b.dataset.move) move(b.dataset.id, +b.dataset.move); else if (b.dataset.edit) edit(b.dataset.edit); else if (b.dataset.del) remove(b.dataset.del);
    });
    $('#card-view').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.choice != null) predict(+b.dataset.choice); else if (b.dataset.card === 'confirm') reveal(); else if (b.dataset.card === 'prev') step(-1); else if (b.dataset.card === 'next') step(1);
    });
    // 집계 입력: 입력란을 다시 만들지 않고(포커스·캐럿 유지) 막대만 갱신하며, 범위를 벗어난 값만 그 자리에서 보정
    $('#tally-panel').addEventListener('input', e => {
      const inp = e.target; if (inp.dataset.tally == null || inp.dataset.tally === 'clear') return;
      setTally($$('#tally-panel input[data-tally]').map(i => i.value === '' ? 0 : +i.value), true);
      const n = clamp(Math.round(+inp.value) || 0, 0, 99); if (String(n) !== inp.value) inp.value = n;
    });
    $('#tally-panel').addEventListener('click', e => { if (e.target.closest('[data-tally=clear]')) { const c = current(); if (c) { delete db.tally[c.id]; app.saveDb(); renderTally(); } } });
    FK.actions['card-new'] = () => edit(null); FK.actions['set-save'] = saveSet;
    if (!st.currentCardId || !db.cards.some(c => c.id === st.currentCardId)) { const l = visible(); st.currentCardId = l.length ? l[0].id : null; }
    const c = current(); cur.board = c ? boardFor(c) : null;
  }
  FK.cards = { init, render, select, predict, confirm: reveal, setTally, setGradeFilter: g => { cur.filterGrade = g || ''; if (st.tab === 'cards') render(); } };
})();
