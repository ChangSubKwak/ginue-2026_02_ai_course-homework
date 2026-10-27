/* ui.js — 화면 전환·모달·토스트·홈·결과·교정 카드(A10)·도감·명예의 전당(A9)·설정·CSV/JSON(A12·A13)·배지(A8) */
'use strict';
(function (MG) {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('ko-KR');
  const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const totalStars = p => Object.values(p.stageRecords || {}).reduce((s, r) => s + (r.bestStars || 0), 0);
  const profLabel = p => p.id === 'guest' ? '체험 모드' : [p.grade && `${p.grade}학년`, p.classNo && `${p.classNo}반`, p.number && `${p.number}번`].filter(Boolean).join(' ') || '학급 정보 없음';
  const avIdx = p => Number.isInteger(p.avatar) && p.avatar >= 0 && p.avatar <= 7 ? p.avatar : 0; // 가져온 데이터의 avatar는 0~7 정수만 신뢰
  const avatarHtml = (p, cls) => `<span class="avatar av-${avIdx(p)} ${cls || ''}" aria-hidden="true">${esc(String(p.name).slice(0, 1))}</span>`;
  // 화면 상태는 메모리에 두고(localStorage 차단 시에도 탭 전환 동작) uiPref는 복원·저장에만 쓴다
  const UI = { view: 'home', pauseOpen: false, cardPad: null, sessionBadges: [], gradeTab: null, hallTab: null };
  const uiPref = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('mathGuardians.ui') || '{}')[k] ?? d; } catch (e) { return d; } }, set: (k, v) => { try { const o = JSON.parse(localStorage.getItem('mathGuardians.ui') || '{}'); o[k] = v; localStorage.setItem('mathGuardians.ui', JSON.stringify(o)); } catch (e) { /* 무시 */ } } };

  // ---- 토스트 (최대 3개 스택) ----
  const showToast = (message, type = 'info', ms = 2500) => {
    const root = el('toast-root'); while (root.children.length >= 3) root.firstChild.remove();
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = message; root.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  };
  // ---- 모달: 포커스 트랩·Esc·배경 클릭 ----
  const openModal = ({ title, body, actions, persistent, wide, onOpen, cls }) => new Promise(resolve => {
    const prev = document.activeElement, wrap = document.createElement('div'); wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3 class="modal-title">${title}</h3><div class="modal-body"></div><div class="modal-actions">${(actions || []).map(a => `<button class="btn ${a.cls || ''}" data-m="${a.value}">${a.text}</button>`).join('')}</div></div>`;
    const mb = $('.modal-body', wrap); if (typeof body === 'string') mb.innerHTML = body; else if (body) mb.appendChild(body);
    let closed = false;
    const close = v => { if (closed) return; closed = true; wrap.removeEventListener('keydown', onKey); wrap.remove(); resolve(v); if (prev && prev.focus) prev.focus(); };
    const onKey = e => {
      if (e.key === 'Escape' && !persistent) { e.preventDefault(); close(false); }
      if (e.key === 'Tab') { const f = [...wrap.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    };
    wrap.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => { if (e.target === wrap && !persistent) close(false); const b = e.target.closest('[data-m]'); if (b) close(b.dataset.m === 'true' ? true : b.dataset.m === 'false' ? false : b.dataset.m); });
    el('modal-root').appendChild(wrap);
    const first = wrap.querySelector('.modal-actions button, .modal-body input, .modal-body button'); if (first) first.focus();
    if (onOpen) onOpen(wrap, close);
  });
  const showModal = ({ title, body, confirmText = '확인', cancelText = '취소', danger = false, wide = false }) =>
    openModal({ title, body, wide, actions: [cancelText && { text: cancelText, value: 'false' }, { text: confirmText, value: 'true', cls: danger ? 'danger' : 'primary' }].filter(Boolean) });

  // ---- 화면 전환 ----
  const showView = name => {
    if (UI.view === 'game' && name !== 'game' && MG.Game.running) MG.Game.quit();
    UI.view = name;
    document.querySelectorAll('main > section[data-view]').forEach(s => { s.hidden = s.dataset.view !== name; });
    document.querySelectorAll('#main-tabs [role=tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
    document.body.classList.toggle('in-game', name === 'game');
    if (name === 'home') renderHome(); else if (name === 'codex') renderCodex(); else if (name === 'hall') renderHall(); else if (name === 'settings') renderSettings();
    if (name === 'game') MG.Game.resize();
    window.scrollTo(0, 0);
  };

  // ---- 프로필 표시·드롭다운 ----
  const renderProfileBar = () => {
    const p = MG.current(); el('profile-name').textContent = p.name; el('profile-sub').textContent = profLabel(p);
    const av = el('profile-avatar'); av.className = `avatar av-${avIdx(p)}`; av.textContent = p.name.slice(0, 1);
    el('profile-menu').innerHTML = MG.root.profiles.map(x => `<li role="option" tabindex="0" aria-selected="${x.id === p.id}" data-pid="${esc(x.id)}">${avatarHtml(x, 'sm')}<span>${esc(x.name)}</span><small>${esc(profLabel(x))}</small></li>`).join('') || '<li class="muted">프로필이 없습니다. 새 프로필을 만드세요.</li>';
  };
  // 드롭다운 열기/닫기(열 때 선택된 항목에 포커스 → 키보드로 ↑↓·Enter 선택 가능)
  const toggleProfileMenu = open => { const m = el('profile-menu'), o = open == null ? m.hidden : open; m.hidden = !o; el('profile-btn').setAttribute('aria-expanded', String(o)); if (o) { const sel = m.querySelector('[aria-selected="true"]') || m.querySelector('[data-pid]'); if (sel && document.activeElement === el('profile-btn')) sel.focus(); } };
  const pickProfile = pid => { MG.setActive(pid); MG.save(); toggleProfileMenu(false); renderProfileBar(); showView(UI.view === 'game' || UI.view === 'result' ? 'home' : UI.view); };

  // ---- 홈: 요약 카드·학년 탭·스테이지 카드 ----
  const stageStatus = (st, p) => {
    const s = MG.root.settings; if (!s.activeStageIds.includes(st.id)) return 'disabled';
    if (s.unlockAll || st.order === 1) return 'open';
    const prev = MG.STAGES.find(x => x.grade === st.grade && x.order === st.order - 1), r = p.stageRecords[prev.id];
    return r && r.bestStars >= 1 ? 'open' : 'locked';
  };
  const inputIcon = t => t === 'choice3' ? '🔘 3지선다' : t === 'decimal' ? '🔢 소수점' : '⌨ 키패드';
  const renderHome = () => {
    const p = MG.current(), s = MG.root.settings, ts = totalStars(p), weak = Object.values(p.facts).filter(f => f.box < 2 && f.miss >= 1).length, skin = MG.SKINS.find(k => k.id === p.skin);
    el('summary-card').innerHTML = `<div class="summary-main">${avatarHtml(p, 'lg')}<div><div class="summary-name">${esc(p.name)} <small class="muted">${esc(profLabel(p))}</small></div><div class="summary-stats"><span>⭐ 총 별 <b>${ts}</b></span><span>🏅 배지 <b>${p.badges.length}</b>/10</span><button class="linkish" data-action="nav" data-view="codex">👹 약점 문제 <b>${weak}</b></button></div></div></div>
      <div class="summary-skin turret-${p.skin}"><span class="turret-preview" aria-hidden="true"></span><small>${esc(skin.name)} · ${esc(MG.THEMES.find(t => t.id === p.theme).name)} 테마</small></div>
      ${p.id === 'guest' ? '<p class="note">체험 모드에서는 기록이 저장되지 않아요. 프로필을 만들면 기록·랭킹이 남습니다.</p>' : ''}`;
    const g = UI.gradeTab || (UI.gradeTab = +uiPref.get('lastGradeTab', 1) || 1);
    el('grade-tabs').innerHTML = [1, 2, 3, 4, 5, 6].map(i => `<button role="tab" aria-selected="${i === g}" data-action="grade-tab" data-grade="${i}">${i}학년</button>`).join('');
    const list = MG.STAGES.filter(st => st.grade === g);
    if (!MG.STAGES.some(st => s.activeStageIds.includes(st.id))) { el('stage-grid').innerHTML = '<div class="card empty"><p>🔒 선생님이 모든 스테이지를 닫아 두었어요.<br>선생님 설정에서 스테이지를 활성화하면 시작할 수 있습니다.</p><button class="btn primary" data-action="nav" data-view="settings">⚙ 선생님 설정 열기</button></div>'; return; }
    el('stage-grid').innerHTML = list.map(st => {
      const r = p.stageRecords[st.id], status = stageStatus(st, p), it = MG.Problems.effectiveInput(st.id, s), prev = MG.STAGES.find(x => x.grade === st.grade && x.order === st.order - 1);
      return `<article class="stage-card ${status}" data-stage="${st.id}"><header><span class="stage-no">${MG.stageLabel(st)}</span><span class="stage-input">${inputIcon(it)}</span></header>
        <h3>${esc(st.name)}</h3><div class="stage-meta"><span class="best">최고 ${r ? fmt(r.bestScore) : '—'}</span><span class="stars" aria-label="별 ${r ? r.bestStars : 0}개">${stars(r ? r.bestStars : 0)}</span></div>
        ${status === 'locked' ? `<div class="lock-row"><span class="lock" title="이전 스테이지를 별 1개 이상으로 클리어하면 열려요">🔒 잠김</span><small class="muted">${prev ? `${MG.stageLabel(prev)} ${esc(prev.name)}` : '이전 스테이지'}를 ★1 이상으로 클리어하면 열려요</small></div>` : status === 'disabled' ? '<div class="lock-row"><span class="lock">⛔ 닫힘</span><small class="muted">선생님이 닫아 둔 스테이지예요</small></div>' : ''}
        <button class="btn primary start-btn" data-action="start-stage" data-stage="${st.id}" ${status === 'locked' ? 'disabled' : ''}>${status === 'disabled' ? '닫힌 스테이지' : status === 'locked' ? '🔒 잠김' : '시작'}</button></article>`;
    }).join('');
  };

  // ---- 게임 시작·훅 ----
  const startStage = stageId => {
    const st = MG.stageById(stageId), p = MG.current(), status = stageStatus(st, p);
    if (status === 'disabled') return showToast('선생님이 닫아 둔 스테이지입니다', 'warn');
    if (status === 'locked') return showToast('이전 스테이지를 먼저 클리어하세요', 'warn');
    MG.Audio.init(); UI.sessionBadges = []; UI.stageId = stageId;
    try { sessionStorage.setItem('mathGuardians.inGame', '1'); } catch (e) { /* 무시 */ }
    showView('game'); MG.Game.start(st, p, MG.root.settings);
  };
  const checkAnswer = (pr, raw, idx) => pr.inputType === 'choice3' ? idx === pr.correctIndex : pr.inputType === 'decimal' ? Math.round(parseFloat(raw.startsWith('.') ? '0' + raw : raw) * 100) === pr.answer : parseInt(raw, 10) === pr.answer;
  // 교정 카드: 문제 + 시각 모델 + 같은 입력 방식, 정답 입력 시 닫힘
  const showCard = (pr, wrongIndex, onDone, titleText, onFail) => {
    const body = document.createElement('div'); body.className = 'card-body';
    body.innerHTML = `<div class="card-q">${esc(pr.text)}${pr.text.includes('?') ? '' : ' = ?'}</div><div class="hint-box"></div><div class="card-pad locked"></div>`;
    const ms = renderHint($('.hint-box', body), pr.hint);
    openModal({ title: titleText || '🛡️ 다시 생각해 봐요', body, persistent: true, wide: true, cls: 'card-modal', actions: [], onOpen: (wrap, close) => {
      const padEl = $('.card-pad', body); let tries = 0;
      const done = () => { MG.Audio.play('hit'); MG.Pad.active = null; close(true); onDone(tries === 0); };
      const fail = () => { tries++; MG.Audio.play('wrong'); padEl.classList.remove('shake'); void padEl.offsetWidth; padEl.classList.add('shake'); if (onFail) onFail(tries); };
      const pad = MG.Pad.create(padEl, pr.inputType, { onFire: v => checkAnswer(pr, v) ? done() : fail(), onChoose: i => { if (checkAnswer(pr, null, i)) done(); else { pad.disabled.add(i); pad.render(); fail(); } } });
      if (pr.inputType === 'choice3') pad.setChoices(pr.choices, wrongIndex != null ? [wrongIndex] : []);
      MG.Pad.active = pad; setTimeout(() => padEl.classList.remove('locked'), Math.min(1500, ms));
    } });
  };
  const hooks = {
    isGameView: () => UI.view === 'game',
    onCard: (pr, wrongIndex) => showCard(pr, wrongIndex, () => MG.Game.cardSolved()),
    onPause: async () => {
      if (UI.pauseOpen) return; UI.pauseOpen = true;
      const r = await openModal({ title: '⏸ 일시정지', body: '<p>잠시 쉬어 가요. 계속할까요?</p>', persistent: true, actions: [{ text: '계속하기', value: 'resume', cls: 'primary' }, { text: '그만하기', value: 'quit', cls: 'danger-outline' }] });
      UI.pauseOpen = false; if (r === 'quit') MG.Game.quit(); else MG.Game.resume();
    },
    // 저사양 제안: 모달 뒤에서 몬스터가 전진하지 않도록 조용히 멈춘 뒤 닫히면 재개
    onLowFps: async () => { MG.Game.pause(true); if (await showModal({ title: '화면이 느린가요?', body: '저사양 모드(파티클 축소·흔들림 끔)를 켜면 더 부드러워질 수 있어요.', confirmText: '저사양 모드 켜기' })) { MG.root.settings.lowSpec = true; MG.save(); showToast('저사양 모드를 켰습니다', 'success'); } if (!UI.pauseOpen) MG.Game.resume(); },
    onBadgeCheck: g => { const p = MG.current(); if (p.id === 'guest') return; awardBadges(p, { maxCombo: g.maxCombo, liveRevenge: g.revengeKills, liveKills: g.correct }); },
    onEnd: summary => finishGame(summary),
  };

  // ---- 배지(A8)·해금(A9) ----
  const streakDays = dates => { const set = new Set(dates); let n = 0; const d = new Date(); while (set.has(MG.localDate(d))) { n++; d.setDate(d.getDate() - 1); } return n; };
  const awardBadges = (p, c) => {
    const has = id => p.badges.some(b => b.id === id), ct = p.counters, got = [];
    const cond = { first_kill: ct.totalCorrect + (c.liveKills || 0) >= 1, combo10: (c.maxCombo || 0) >= 10, combo20: (c.maxCombo || 0) >= 20, perfect: !!c.perfect, stars3x5: ct.threeStarClears >= 5,
      gugudan: (() => { for (let a = 2; a <= 9; a++) for (let b = 1; b <= 9; b++) { const f = p.facts[`${a}×${b}`]; if (!f || f.box < 2) return false; } return true; })(),
      revenge10: ct.revengeKills + (c.liveRevenge || 0) >= 10, boss10: ct.bossKills >= 10, streak7: streakDays(p.playDates) >= 7, problems1000: ct.totalProblems >= 1000 };
    MG.BADGES.forEach(b => { if (!has(b.id) && cond[b.id]) { p.badges.push({ id: b.id, at: new Date().toISOString() }); got.push(b); UI.sessionBadges.push(b); showToast(`🏅 배지 획득: ${b.name}`, 'success'); MG.Audio.play('badge'); } });
    return got;
  };
  // 판 종료: 기록 갱신(A5)·배지·해금·결과 화면
  const finishGame = summary => {
    try { sessionStorage.removeItem('mathGuardians.inGame'); } catch (e) { /* 무시 */ }
    const p = MG.current(), guest = p.id === 'guest', before = totalStars(p), prevRec = p.stageRecords[summary.stageId], prevBest = prevRec ? prevRec.bestScore : 0;
    const st = MG.stageById(summary.stageId), next = MG.STAGES[MG.STAGES.indexOf(st) + 1] || null, nextWasLocked = next && stageStatus(next, p) === 'locked'; // 학년 마지막 스테이지는 다음 학년 첫 스테이지로 이어짐
    const unlocks = [];
    if (!guest) {
      const r = prevRec || { stageId: summary.stageId, bestScore: 0, bestStars: 0, bestCombo: 0, plays: 0, clears: 0, correct: 0, wrong: 0, reached: 0, avgMs: 0, lastPlayedAt: null };
      r.avgMs = (r.correct + summary.correct) ? Math.round((r.avgMs * r.correct + summary.reactionSum) / (r.correct + summary.correct)) : 0;
      r.bestScore = Math.max(r.bestScore, summary.score); r.bestStars = Math.max(r.bestStars, summary.stars); r.bestCombo = Math.max(r.bestCombo, summary.maxCombo);
      r.plays++; r.clears += summary.endedBy === 'clear' ? 1 : 0; r.correct += summary.correct; r.wrong += summary.wrong; r.reached += summary.reached; r.lastPlayedAt = summary.playedAt;
      p.stageRecords[summary.stageId] = r;
      const today = MG.localDate(); if (!p.playDates.includes(today)) p.playDates.push(today);
      p.history.unshift({ stageId: summary.stageId, score: summary.score, stars: summary.stars, correct: summary.correct, wrong: summary.wrong, reached: summary.reached, maxCombo: summary.maxCombo, avgMs: summary.avgMs, revengeKills: summary.revengeKills, wrongKeys: summary.wrongKeys, endedBy: summary.endedBy, playedAt: summary.playedAt });
      p.history = p.history.slice(0, 20);
      const ct = p.counters; ct.totalProblems += summary.total; ct.totalCorrect += summary.correct; ct.revengeKills += summary.revengeKills; ct.bossKills += summary.bossKills; ct.threeStarClears += summary.stars === 3 ? 1 : 0;
      awardBadges(p, { maxCombo: summary.maxCombo, perfect: summary.endedBy === 'clear' && summary.hpLost === 0 });
      const after = totalStars(p);
      MG.SKINS.concat(MG.THEMES).forEach(k => { if (k.stars > before && k.stars <= after) unlocks.push(`${MG.SKINS.includes(k) ? '포탑' : '배경 테마'} '${k.name}' 해금 (별 ${k.stars}개)`); });
      if (next && nextWasLocked && stageStatus(next, p) === 'open') unlocks.push(`다음 스테이지 ${MG.stageLabel(next)} ${next.name} 해금`);
      MG.save();
    }
    renderResult(summary, { guest, prevBest, unlocks, next, badges: UI.sessionBadges.slice() });
    showView('result'); renderProfileBar();
  };
  const END_LABEL = { clear: '🎉 스테이지 클리어!', gameover: '💀 게임 오버', timeout: '⏰ 시간 종료', quit: '🚪 중단' };
  const renderResult = (s, x) => {
    const p = MG.current(), st = MG.stageById(s.stageId), acc = Math.round(s.acc * 100), newBest = !x.guest && s.score > x.prevBest && x.prevBest > 0;
    const wrongs = []; const seen = new Set();
    s.wrongList.forEach(w => { if (seen.has(w.problem.key)) return; seen.add(w.problem.key); const f = p.facts[w.problem.key]; wrongs.push({ ...w, box: f ? f.box : 0 }); });
    UI.lastWrongs = wrongs;
    el('result-view').innerHTML = `<div class="result-head ${s.endedBy}"><p class="result-stage">${MG.stageLabel(st)} ${esc(st.name)}</p><h2>${END_LABEL[s.endedBy]}</h2>
      <div class="result-score" id="result-score">0</div>${newBest ? '<div class="ribbon">🏆 최고 기록 갱신!</div>' : ''}<div class="result-stars" id="result-stars">${[0, 1, 2].map(i => `<span class="${i < s.stars ? 'got' : ''}">★</span>`).join('')}</div></div>
      <div class="stat-grid">${[['정답률', acc + '%'], ['최대 콤보', s.maxCombo], ['평균 반응', (s.avgMs / 1000).toFixed(1) + '초'], ['남은 HP', '❤'.repeat(s.hp) || '0'], ['복수 격파', s.revengeKills], ['문제 수', s.total]].map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
      ${x.badges.length || x.unlocks.length ? `<div class="card unlock-list"><h3>✨ 새 획득</h3><ul>${x.badges.map(b => `<li>${b.icon} 배지 '${esc(b.name)}'</li>`).join('')}${x.unlocks.map(u => `<li>🔓 ${esc(u)}</li>`).join('')}</ul></div>` : ''}
      <div class="card"><h3>틀린 문제 ${wrongs.length}개</h3>${wrongs.length ? `<div class="wrong-list">${wrongs.map(w => `<div class="wrong-card" data-key="${esc(w.problem.key)}"><div class="wq">${esc(w.problem.text)} = <b>${esc(w.problem.answerText)}</b>${w.revenge ? ' <span class="tag revenge">복수</span>' : ''}${w.kind === 'reached' ? ' <span class="tag">미응답</span>' : ''}</div><div class="ws muted">${esc(w.problem.solution)}</div><div class="box-state">상자 ${boxDots(w.box)}</div></div>`).join('')}</div><button class="btn primary" data-action="review">🔁 다시 풀기</button>` : '<p class="perfect">틀린 문제 없음! 완벽해요 🎉</p>'}</div>
      <div class="result-actions">${x.guest ? '<button class="btn primary" data-action="new-profile">프로필 만들어 기록 저장하기</button>' : ''}<button class="btn ${s.endedBy === 'clear' ? '' : 'primary'}" data-action="start-stage" data-stage="${s.stageId}">다시 도전</button>${s.endedBy === 'clear' && x.next && !x.guest && stageStatus(x.next, p) === 'open' ? `<button class="btn primary" data-action="start-stage" data-stage="${x.next.id}">다음 스테이지 ${MG.stageLabel(x.next)} ▶</button>` : ''}<button class="btn" data-action="nav" data-view="home">스테이지 맵</button></div>`;
    // 점수 카운트업 + 별 팝인
    const t0 = performance.now(), se = el('result-score');
    const tick = now => { const k = Math.min(1, (now - t0) / 900); se.textContent = fmt(Math.round(s.score * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    el('result-stars').querySelectorAll('.got').forEach((n, i) => setTimeout(() => { n.classList.add('pop'); MG.Audio.play('star'); }, 900 + i * 350));
  };
  const boxDots = b => `<span class="box-dots">${[0, 1, 2].map(i => `<i class="${i < b ? 'on' : ''}"></i>`).join('')}</span> ${b}/3`;
  // 복습 모드: 틀린 문제를 차례로 다시 풀기 (첫 시도 정답 → 상자 +1, 카드 안에서 틀리면 그 순간 1회만 오답 기록, 재시도 끝 정답은 변동 없음)
  const startReview = async () => {
    const list = (UI.lastWrongs || []).map(w => w.problem), p = MG.current(); let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const pr = MG.Problems.build(list[i].stageId, list[i].p);
      await new Promise(res => showCard(pr, null, firstTry => { if (firstTry) { ok++; MG.Facts.update(p, pr, 'review'); } res(); }, `🔁 다시 풀기 ${i + 1}/${list.length}`, tries => { if (tries === 1) MG.Facts.update(p, pr, 'miss'); }));
    }
    if (p.id !== 'guest') MG.save();
    showToast(`복습 완료 ${ok}/${list.length}`, 'success');
    if (UI.view === 'result') el('result-view').querySelectorAll('.wrong-card[data-key]').forEach(c => { const f = p.facts[c.dataset.key]; if (f) c.querySelector('.box-state').innerHTML = `상자 ${boxDots(f.box)}`; });
  };

  // ---- 교정 카드 시각 모델(A10): 애니메이션 길이(ms) 반환 ----
  const renderHint = (box, hint) => {
    const d = hint.data; box.innerHTML = '';
    if (hint.model === 'dots') {
      const cells = []; for (let i = 0; i < 20; i++) { const row = i < 10 ? 0 : 1, idx = i; let c = ''; if (d.plus) c = idx < d.a ? 'blue' : idx < d.a + d.b ? 'yellow' : ''; else c = idx < d.a ? 'blue' + (idx >= d.a - d.b ? ' cross' : '') : ''; cells.push(`<i class="${c}" style="animation-delay:${idx * 30}ms"></i>`); if (row === 0 && i === 9) cells.push('<br>'); }
      box.innerHTML = `<div class="dots">${cells.join('')}</div><p class="hint-cap">${d.plus ? `파랑 ${d.a}개 + 노랑 ${d.b}개 = ${d.a + d.b}개` : `${d.a}개에서 ${d.b}개를 지우면 ${d.a - d.b}개`}</p>`; return 700;
    }
    if (hint.model === 'array') {
      // 행(묶음)이 7개 이상이면 점을 작게(dense) 그려 모달이 화면을 넘지 않게 한다
      if (d.rows) { let h = ''; for (let r = 0; r < d.rows; r++) h += `<div class="arr-row" style="animation-delay:${r * (900 / d.rows)}ms">${'<i></i>'.repeat(d.cols)}</div>`; box.innerHTML = `<div class="arr ${d.rows >= 7 ? 'dense' : ''}">${h}</div><p class="hint-cap">${d.cols}개씩 ${d.rows}줄 = ${d.rows * d.cols}개</p>`; return 1000; }
      const q = d.total / d.group; let h = ''; for (let r = 0; r < q; r++) h += `<div class="arr-row group" style="animation-delay:${r * (900 / q)}ms">${'<i></i>'.repeat(d.group)}</div>`; box.innerHTML = `<div class="arr ${q >= 7 ? 'dense' : ''}">${h}</div><p class="hint-cap">${d.total}개를 ${d.group}개씩 묶으면 ${q}묶음</p>`; return 1000;
    }
    if (hint.model === 'column') {
      // 세로셈: 일→십→백 순으로 400ms 간격. 받아올림 1은 윗자리(한 열 왼쪽) 위에, 받아내림은 빌려준 뒤의 값(0은 연쇄로 9)을 각 자리 위에 표시
      const A = String(d.a).split('').map(Number), n = A.length, B = String(d.b).padStart(n, ' ').split('').map(c => c === ' ' ? null : +c);
      const marks = Array(n).fill(''), res = Array(n + 1).fill(''), struck = Array(n).fill(false); let carry = 0, topCarry = '';
      const mark = (i, cls, step, v) => { marks[i] = `<small class="${cls} step" data-step="${step}">${v}</small>`; };
      if (d.plus) {
        for (let i = n - 1; i >= 0; i--) { const step = n - 1 - i, s = A[i] + (B[i] || 0) + carry; carry = s >= 10 ? 1 : 0; res[i + 1] = `<b class="step" data-step="${step}">${s % 10}</b>`; if (carry) { if (i > 0) mark(i - 1, 'carry', step, 1); else topCarry = `<small class="carry step" data-step="${step}">1</small>`; } }
        if (carry) res[0] = `<b class="step" data-step="${n}">1</b>`;
      } else {
        const adj = A.slice(), out = Array(n).fill(0); // adj[i] = 빌려주고 빌린 뒤 실제로 계산에 쓰는 값
        for (let i = n - 1; i >= 0; i--) { const step = n - 1 - i; let x = A[i] - (i < n - 1 ? out[i + 1] : 0); if (x < (B[i] || 0)) { x += 10; out[i] = 1; } adj[i] = x; res[i + 1] = `<b class="step" data-step="${step}">${x - (B[i] || 0)}</b>`; }
        for (let i = 0; i < n; i++) if (adj[i] !== A[i]) { const step = out[i] ? n - 1 - i : Math.max(0, n - 2 - i); mark(i, 'borrow', step, adj[i]); struck[i] = true; }
      }
      box.innerHTML = `<table class="column"><tr class="marks"><td>${topCarry}</td>${marks.map(m => `<td>${m}</td>`).join('')}</tr><tr><td></td>${A.map((v, i) => `<td class="${struck[i] ? 'struck' : ''}">${v}</td>`).join('')}</tr><tr class="op"><td>${d.plus ? '+' : '−'}</td>${B.map(v => `<td>${v == null ? '' : v}</td>`).join('')}</tr><tr class="res"><td>${res[0]}</td>${res.slice(1).map(v => `<td>${v}</td>`).join('')}</tr></table>`;
      box.querySelectorAll('.step').forEach(e => setTimeout(() => e.classList.add('show'), 300 + 400 * +e.dataset.step));
      return 400 * (n + 1) + 300;
    }
    if (hint.model === 'bar') {
      const bar = (nn, dd, cls, delay) => `<div class="fbar ${cls || ''}" style="animation-delay:${delay || 0}ms">${Array.from({ length: dd }, (_, i) => `<i class="${i < nn ? 'on' : ''}"></i>`).join('')}<small>${nn}/${dd}</small></div>`;
      if (d.div) { box.innerHTML = `${bar(Math.min(d.n1, d.d1), d.d1)}<p class="hint-cap">${esc(d.solution)}</p>`; return 600; }
      const same = d.d1 === d.d2; let h = bar(d.n1, d.d1) + `<div class="fop">${d.plus ? '+' : '−'}</div>` + bar(d.n2, d.d2, '', 200);
      if (!same) h += `<div class="fop">↓ 통분 (분모 ${d.L})</div>` + bar(d.n1 * d.L / d.d1, d.L, '', 500) + `<div class="fop">${d.plus ? '+' : '−'}</div>` + bar(d.n2 * d.L / d.d2, d.L, '', 700);
      h += `<div class="fop">=</div>` + bar(Math.min(d.rn, d.L), d.L, 'result', same ? 600 : 1000) + `<p class="hint-cap">정답 ${esc(d.result)}${d.rn > d.L ? ' (막대 1개를 넘어요)' : ''}</p>`;
      box.innerHTML = h; return same ? 1000 : 1400;
    }
    box.innerHTML = `<p class="hint-text">${esc(d)}</p>`; return 300;
  };

  // ---- 도감: 히트맵·약점 목록·배지·스킨 ----
  const renderCodex = () => {
    const p = MG.current(), ts = totalStars(p), sid = UI.codexStage || 's2-3', st = MG.stageById(sid), facts = Object.values(p.facts).filter(f => f.stageId === sid);
    let body;
    if (st.gridFacts) {
      body = `<div class="heatmap" role="grid"><div class="hm-corner"></div>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(b => `<div class="hm-head">×${b}</div>`).join('')}${[2, 3, 4, 5, 6, 7, 8, 9].map(a => `<div class="hm-head">${a}단</div>` + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(b => { const f = p.facts[`${a}×${b}`]; return `<button class="hm-cell box-${f ? f.box : 'none'}" data-action="fact-tip" data-key="${a}×${b}" aria-label="${a}×${b} ${f ? `상자 ${f.box}` : '미출제'}">${a * b}</button>`; }).join('')).join('')}</div>
        <div class="legend"><span class="box-0">상자 0 · 다시 연습</span><span class="box-1">1 · 조금 익숙</span><span class="box-2">2 · 거의 완성</span><span class="box-3">3 · 완전 숙달</span><span class="box-none">아직 안 나옴</span></div><div class="fact-tip muted" id="fact-tip">칸을 누르면 정답/오답 횟수와 평균 반응시간이 보여요.</div>`;
    } else {
      const weak = facts.filter(f => f.box < 2).sort((a, b) => b.miss - a.miss).slice(0, 20), mastered = facts.filter(f => f.box >= 2).length;
      body = `<div class="progress-row"><span>숙달 ${mastered} / 출제 ${facts.length}</span><div class="bar"><i style="width:${facts.length ? mastered / facts.length * 100 : 0}%"></i></div></div>
        ${weak.length ? `<table class="table"><thead><tr><th>문제</th><th>정답</th><th>오답</th><th>상자</th></tr></thead><tbody>${weak.map(f => `<tr><td>${esc(f.question)}</td><td>${esc(f.answer)}</td><td>${f.miss}</td><td>${boxDots(f.box)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted empty">이 스테이지의 약점 문제가 없어요.</p>'}`;
    }
    el('codex-view').innerHTML = `<div class="card codex-head">${avatarHtml(p, 'lg')}<div><h2>${esc(p.name)}의 도감</h2><p class="muted">⭐ 총 별 ${ts} · 푼 문제 ${fmt(p.counters.totalProblems)}개 · 만난 문제 ${Object.keys(p.facts).length}가지</p></div></div>
      <div class="card"><div class="inline between wrap"><h3>내 실력 지도 <small class="muted">(숙달 상자 0~3)</small></h3><select id="codex-stage" aria-label="스테이지 선택">${MG.STAGES.map(s => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${MG.stageLabel(s)} ${esc(s.name)}</option>`).join('')}</select></div>${body}</div>
      <div class="card"><h3>배지 ${p.badges.length}/10</h3><div class="badge-grid">${MG.BADGES.map(b => { const got = p.badges.find(x => x.id === b.id); return `<div class="badge ${got ? 'got' : ''}" title="${esc(got ? '획득 ' + MG.localDate(got.at) : '조건: ' + b.desc)}"><span class="bi">${b.icon}</span><b>${b.name}</b><small>${got ? '획득 ' + MG.localDate(got.at) : '🔒 ' + b.desc}</small></div>`; }).join('')}</div></div>
      <div class="card"><h3>스킨</h3><div class="skin-row">${MG.SKINS.map(k => `<button class="skin turret-${k.id} ${p.skin === k.id ? 'selected' : ''}" data-action="pick-skin" data-skin="${k.id}" ${ts < k.stars ? 'disabled' : ''}><span class="turret-preview"></span><b>${k.name}</b><small>${ts < k.stars ? `🔒 별 ${k.stars}개 필요` : p.skin === k.id ? '사용 중' : '선택'}</small></button>`).join('')}</div>
      <h3>배경 테마</h3><div class="skin-row">${MG.THEMES.map(k => `<button class="skin theme-${k.id} ${p.theme === k.id ? 'selected' : ''}" data-action="pick-theme" data-theme="${k.id}" ${ts < k.stars ? 'disabled' : ''}><span class="theme-preview"></span><b>${k.name}</b><small>${ts < k.stars ? `🔒 별 ${k.stars}개 필요` : p.theme === k.id ? '사용 중' : '선택'}</small></button>`).join('')}</div></div>`;
    el('codex-stage').addEventListener('change', e => { UI.codexStage = e.target.value; renderCodex(); });
  };

  // ---- 명예의 전당(A9) ----
  const growth7 = p => { const lim = Date.now() - 7 * 86400000; return Object.values(p.facts).filter(f => f.masteredAt && new Date(f.masteredAt).getTime() >= lim).length; };
  const renderHall = () => {
    const me = MG.current(), s = MG.root.settings, tab = UI.hallTab || (UI.hallTab = uiPref.get('lastHallTab', 'score')), profiles = MG.root.profiles;
    const lastPlayed = me.history[0] ? me.history[0].stageId : null, sid = UI.hallStage || lastPlayed || uiPref.get('lastHallStageId', null) || 's2-3';
    // 전체 정렬(all)에서 내 순위·N을 구하고, 공개 모드의 점수 탭만 상위 10으로 잘라 표시(내가 10위 밖이면 내 행을 덧붙임)
    let all;
    if (tab === 'score') all = profiles.filter(p => p.stageRecords[sid]).map(p => ({ p, v: p.stageRecords[sid].bestScore, s2: p.stageRecords[sid].bestStars, t: p.stageRecords[sid].lastPlayedAt })).sort((a, b) => b.v - a.v || b.s2 - a.s2 || String(a.t).localeCompare(String(b.t)));
    else if (tab === 'stars') all = profiles.map(p => ({ p, v: totalStars(p) })).sort((a, b) => b.v - a.v);
    else all = profiles.map(p => ({ p, v: growth7(p) })).sort((a, b) => b.v - a.v);
    const unit = tab === 'score' ? '점' : tab === 'stars' ? '★' : '개 숙달', myIdx = all.findIndex(r => r.p.id === me.id), rows = all;
    const rankOf = r => r.v > 0 ? all.findIndex(x => x.v === r.v) + 1 : 0; // 동점은 같은 순위, 0은 순위 없음
    const top = tab === 'score' ? all.slice(0, 10) : all;
    const shown = s.rankingPublic ? (myIdx >= 10 ? top.concat([all[myIdx]]) : top) : all.filter(r => r.p.id === me.id);
    el('hall-view').innerHTML = `<h2 class="view-title">🏆 명예의 전당 <small class="muted">${esc(s.classLabel)}</small></h2>
      <div class="inline between wrap"><div class="sub-tabs" role="tablist">${[['score', '점수'], ['stars', '별'], ['growth', '성장(7일)']].map(([k, n]) => `<button role="tab" aria-selected="${tab === k}" data-action="hall-tab" data-tab="${k}">${n}</button>`).join('')}</div>
      ${tab === 'score' ? `<select id="hall-stage" aria-label="스테이지 선택">${MG.STAGES.map(x => `<option value="${x.id}" ${x.id === sid ? 'selected' : ''}>${MG.stageLabel(x)} ${esc(x.name)}</option>`).join('')}</select>` : ''}</div>
      ${!s.rankingPublic ? `<p class="note">선생님이 랭킹을 비공개로 설정했어요. 내 기록과 내 순위만 보입니다 — 내 순위 <b>${myIdx >= 0 ? myIdx + 1 : '-'}/${rows.length}</b></p>` : me.id === 'guest' ? '<p class="note">체험 모드는 랭킹에 포함되지 않아요. 프로필을 만들면 내 기록이 순위에 올라요.</p>' : ''}
      ${shown.length ? `<table class="table rank-table"><thead><tr><th>순위</th><th>이름</th><th>학급</th><th class="num">${tab === 'score' ? '최고 점수' : tab === 'stars' ? '총 별' : '새로 숙달'}</th></tr></thead><tbody>${shown.map((r, i) => { const rank = rankOf(r); return `<tr class="${rank ? 'rank-' + rank : 'rank-none'} ${r.p.id === me.id ? 'me' : ''}" style="animation-delay:${Math.min(i, 8) * 50}ms"><td class="rank-no">${rank === 0 ? '—' : rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}</td><td>${avatarHtml(r.p, 'sm')} ${esc(r.p.name)}</td><td class="muted">${esc(profLabel(r.p))}${r.p.id === me.id ? ' <span class="tag">나</span>' : ''}</td><td class="num">${fmt(r.v)}${unit}</td></tr>`; }).join('')}</tbody></table>` : `<p class="muted empty">${me.id === 'guest' ? '체험 모드는 랭킹에 포함되지 않아요.' : '아직 기록이 없어요. 첫 판을 플레이해 보세요!'}</p>`}
      <div class="inline wrap"><button class="btn" data-action="print-today">🖨 오늘의 기록표 인쇄</button><button class="btn" data-action="export-records">기록 CSV 내보내기</button></div>`;
    const sel = el('hall-stage'); if (sel) sel.addEventListener('change', e => { UI.hallStage = e.target.value; uiPref.set('lastHallStageId', e.target.value); renderHall(); });
  };
  // 오늘의 기록표(인쇄)
  const printToday = () => {
    const today = MG.localDate(), rows = [];
    MG.root.profiles.forEach(p => p.history.filter(h => MG.localDate(h.playedAt) === today).forEach(h => rows.push({ p, h })));
    const END_SHORT = { clear: '클리어', gameover: '게임 오버', timeout: '시간 종료', quit: '중단' };
    el('print-root').innerHTML = `<h1>연산수호대 오늘의 기록표</h1><p>${esc(MG.APP_DATA.school)} ${esc(MG.root.settings.classLabel)} (담임 ${esc(MG.APP_DATA.teacher)}) · ${today} · 인쇄 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
      ${rows.length ? `<table><thead><tr><th>번호</th><th>이름</th><th>스테이지</th><th>결과</th><th>점수</th><th>별</th><th>정답률</th><th>최대 콤보</th><th>틀린 문제</th></tr></thead><tbody>${rows.map(({ p, h }) => { const t = h.correct + h.wrong + h.reached, st = MG.stageById(h.stageId); return `<tr class="${h.endedBy === 'quit' ? 'quit' : ''}"><td>${esc(p.number || '')}</td><td>${esc(p.name)}</td><td>${st ? `${MG.stageLabel(st)} ${esc(st.name)}` : esc(h.stageId)}</td><td>${END_SHORT[h.endedBy] || ''}</td><td>${fmt(h.score)}</td><td>${stars(h.stars || 0)}</td><td>${t ? Math.round(h.correct / t * 100) : 0}%</td><td>${h.maxCombo || 0}</td><td>${esc((h.wrongKeys || []).join(', '))}</td></tr>`; }).join('')}</tbody></table>` : '<p>오늘 기록이 없습니다.</p>'}`;
    window.print();
  };

  // ---- 선생님 설정 ----
  const renderSettings = () => {
    const s = MG.root.settings, gate = el('pin-gate'), body = el('settings-body');
    if (s.teacherPin && !UI.pinOk) {
      gate.hidden = false; body.hidden = true;
      gate.innerHTML = `<h3>🔒 교사 PIN</h3><p class="muted">설정을 열려면 4자리 PIN을 입력하세요.</p><div class="inline wrap"><input type="password" id="pin-gate-input" inputmode="numeric" maxlength="4" aria-label="PIN"><button class="btn primary" data-action="pin-unlock">열기</button></div>
        <p class="muted">PIN을 잊었다면 아래 버튼으로 샘플 데이터로 초기화해야 해제됩니다(모든 프로필·기록·설정이 삭제됨). 초기화 전에 백업이 필요하면 'JSON 백업'을 먼저 받으세요.</p><div class="inline wrap"><button class="btn" data-action="export-json">JSON 백업</button><button class="btn danger-outline" data-action="reset-sample">샘플 데이터로 초기화</button></div>`;
      return;
    }
    gate.hidden = true; gate.innerHTML = ''; body.hidden = false;
    el('active-stages').innerHTML = [1, 2, 3, 4, 5, 6].map(g => `<div class="stage-check-row"><b>${g}학년</b> <button class="linkish" data-action="grade-all" data-grade="${g}" data-on="1">전체 선택</button><button class="linkish" data-action="grade-all" data-grade="${g}" data-on="0">해제</button><div>${MG.STAGES.filter(x => x.grade === g).map(x => `<label class="chk"><input type="checkbox" data-stage-check="${x.id}" ${s.activeStageIds.includes(x.id) ? 'checked' : ''}> ${MG.stageLabel(x)} ${esc(x.name)}</label>`).join('')}</div></div>`).join('');
    document.querySelectorAll('#speed-group input').forEach(r => { r.checked = r.value === s.speedPreset; });
    document.querySelectorAll('[data-setting]').forEach(i => { const k = i.dataset.setting; if (i.type === 'checkbox') i.checked = !!s[k]; else i.value = s[k]; });
    el('volume-out').textContent = s.volume.toFixed(2); el('pin-status').textContent = s.teacherPin ? 'PIN 설정됨' : 'PIN 없음'; el('pin-input').value = '';
    renderProfileTable(); renderSaveStatus();
  };
  const renderProfileTable = () => {
    const ps = MG.root.profiles; el('profile-count').textContent = `${ps.length}/${MG.MAX_PROFILES}명`;
    el('profile-table').innerHTML = `<thead><tr><th>이름</th><th>학년</th><th>반</th><th>번호</th><th>별</th><th>플레이</th><th></th></tr></thead><tbody>${ps.map(p => `<tr data-pid="${esc(p.id)}"><td><input class="cell" data-field="name" value="${esc(p.name)}" maxlength="12" aria-label="이름"></td><td><input class="cell sm" data-field="grade" type="number" min="1" max="6" value="${esc(p.grade || '')}" aria-label="학년"></td><td><input class="cell sm" data-field="classNo" type="number" min="1" max="20" value="${esc(p.classNo || '')}" aria-label="반"></td><td><input class="cell sm" data-field="number" type="number" min="1" max="99" value="${esc(p.number || '')}" aria-label="번호"></td><td>${totalStars(p)}</td><td>${Object.values(p.stageRecords).reduce((a, r) => a + (r.plays || 0), 0)}</td><td><button class="icon-btn" data-action="delete-profile" data-pid="${esc(p.id)}" aria-label="${esc(p.name)} 삭제">🗑</button></td></tr>`).join('')}</tbody>`;
  };
  const renderSaveStatus = () => { const e = el('save-status'); if (e) e.textContent = MG.storageOk ? `마지막 저장: ${MG.root.savedAt ? new Date(MG.root.savedAt).toLocaleString('ko-KR') : '—'}` : '저장 불가 상태 — 이번 세션만 유지됩니다'; };
  // 프로필 표 인라인 편집
  const editProfileCell = input => {
    const tr = input.closest('tr'), p = MG.root.profiles.find(x => x.id === tr.dataset.pid), f = input.dataset.field; if (!p) return;
    if (f === 'name') { const v = input.value.trim(); if (v.length < 2 || v.length > 12) { showToast('이름은 2~12자여야 합니다', 'error'); input.value = p.name; return; } p.name = v; }
    else { const v = input.value === '' ? null : parseInt(input.value, 10); if (v != null && (Number.isNaN(v) || v < 1 || v > (f === 'grade' ? 6 : 99))) { showToast('올바른 숫자를 입력하세요', 'error'); input.value = p[f] || ''; return; } p[f] = v; }
    MG.save(); renderProfileBar(); showToast('저장됨', 'success', 1200);
  };
  // 새 프로필 모달(이름 2~12자, 학년·반·번호, 아바타 색)
  const newProfileModal = async () => {
    if (MG.root.profiles.length >= MG.MAX_PROFILES) return showToast(`프로필은 최대 ${MG.MAX_PROFILES}명까지입니다`, 'warn');
    const body = document.createElement('div'); body.className = 'form';
    body.innerHTML = `<label>이름 <input id="np-name" maxlength="12" placeholder="2~12자" autocomplete="off"></label><div class="form-row"><label>학년 <select id="np-grade"><option value="">선택</option>${[1, 2, 3, 4, 5, 6].map(g => `<option value="${g}" ${g === 5 ? 'selected' : ''}>${g}학년</option>`).join('')}</select></label><label>반 <input id="np-class" type="number" min="1" max="20" value="2"></label><label>번호 <input id="np-number" type="number" min="1" max="99" value="${MG.root.profiles.length + 1}"></label></div>
      <div class="avatar-pick" role="radiogroup" aria-label="아바타 색">${MG.AVATAR_NAMES.map((n, i) => `<label><input type="radio" name="np-avatar" value="${i}" aria-label="${n}" ${i === MG.root.profiles.length % 8 ? 'checked' : ''}><span class="avatar av-${i}" title="${n}"></span></label>`).join('')}</div><p class="form-error" id="np-error" role="alert"></p>`;
    let result = null;
    await openModal({ title: '＋ 새 프로필', body, actions: [{ text: '취소', value: 'false' }, { text: '만들기', value: 'ok', cls: 'primary' }], onOpen: (wrap, close) => {
      $('#np-name', wrap).focus();
      wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); $('[data-m="ok"]', wrap).click(); } }); // 입력란에서 Enter = 만들기
      wrap.addEventListener('click', e => {
        if (!e.target.closest('[data-m="ok"]')) return; e.stopImmediatePropagation();
        const name = $('#np-name', wrap).value.trim(), num = $('#np-number', wrap).value, err = $('#np-error', wrap);
        if (name.length < 2 || name.length > 12) { err.textContent = '이름은 2~12자로 입력하세요.'; return; }
        if (num !== '' && (+num < 1 || +num > 99)) { err.textContent = '번호는 1~99 사이여야 합니다.'; return; }
        result = { name, grade: +$('#np-grade', wrap).value || null, classNo: +$('#np-class', wrap).value || null, number: num === '' ? null : +num, avatar: +($('input[name=np-avatar]:checked', wrap) || {}).value || 0 };
        close(true);
      }, true);
    } });
    if (!result) return;
    let name = result.name, n = 2; while (MG.root.profiles.some(p => p.name === name)) name = `${result.name}(${n++})`;
    const p = MG.newProfile(name, result.grade, result.classNo, result.number, result.avatar);
    MG.root.profiles.push(p); MG.setActive(p.id); MG.save(); showToast(`'${name}' 프로필을 만들었어요`, 'success');
    renderProfileBar(); if (UI.view === 'settings') renderProfileTable(); if (UI.view === 'home') renderHome(); if (UI.view === 'result') showView('home');
  };

  // ---- CSV(A12)·JSON(A13) 입출력 ----
  const csvEsc = v => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCsv = rows => '﻿' + rows.map(r => r.map(csvEsc).join(',')).join('\r\n');
  const parseCsv = text => {
    text = text.replace(/^﻿/, ''); const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  };
  const stamp = () => MG.localDate().replace(/-/g, '');
  const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  const exportRecords = () => {
    const rows = [['프로필', '학년', '반', '번호', '스테이지', '최고점수', '별', '최대콤보', '플레이수', '클리어수', '정답수', '오답수', '미응답수', '평균반응시간(초)', '최근플레이']];
    MG.root.profiles.forEach(p => Object.values(p.stageRecords).forEach(r => rows.push([p.name, p.grade, p.classNo, p.number, `${MG.stageLabel(MG.stageById(r.stageId))} ${MG.stageById(r.stageId).name}`, r.bestScore, r.bestStars, r.bestCombo, r.plays, r.clears, r.correct, r.wrong, r.reached, (r.avgMs / 1000).toFixed(1), r.lastPlayedAt || ''])));
    download(`math-guardians-records-${stamp()}.csv`, toCsv(rows), 'text/csv'); showToast(`기록 CSV ${rows.length - 1}행 내보냄`, 'success');
  };
  const exportWeak = () => {
    const rows = [['프로필', '스테이지', '문제', '정답', '정답수', '오답수', '상자', '마지막시도']];
    MG.root.profiles.forEach(p => Object.values(p.facts).filter(f => f.box < 2 && f.miss >= 1).forEach(f => rows.push([p.name, MG.stageLabel(MG.stageById(f.stageId)), f.question, f.answer, f.hit, f.miss, f.box, f.lastAt || ''])));
    download(`math-guardians-weakfacts-${stamp()}.csv`, toCsv(rows), 'text/csv'); showToast(`약점 문제 CSV ${rows.length - 1}행 내보냄`, 'success');
  };
  // 명단 CSV: 첫 행 첫 칸이 '비어 있지 않은 비숫자'(예: '번호')일 때만 헤더로 간주. 학년·반은 settings.classLabel('5학년 2반')에서 가져옴
  const importRoster = text => {
    let rows = parseCsv(text); const h0 = rows.length ? (rows[0][0] || '').trim() : ''; if (rows.length && h0 !== '' && !/^\d+$/.test(h0)) rows = rows.slice(1);
    const cl = /(\d)\s*학년\s*(\d+)\s*반/.exec(MG.root.settings.classLabel || ''), grade = cl ? +cl[1] : null, classNo = cl ? +cl[2] : null;
    let added = 0, skipped = 0;
    for (const r of rows) {
      const num = (r[0] || '').trim(), name = (r[1] || '').trim();
      if (MG.root.profiles.length >= MG.MAX_PROFILES) { showToast(`프로필 상한 ${MG.MAX_PROFILES}명에 도달해 중단했습니다`, 'warn'); break; }
      if (name.length < 2 || name.length > 12 || (num && !/^\d+$/.test(num))) { skipped++; continue; }
      let nm = name, n = 2; while (MG.root.profiles.some(p => p.name === nm)) nm = `${name}(${n++})`;
      MG.root.profiles.push(MG.newProfile(nm, grade, classNo, num ? +num : null, added % 8)); added++;
    }
    if (!added) return showModal({ title: '가져오기 실패', body: '추가된 학생이 없습니다. 열이 "번호,이름" 순서인 UTF-8 CSV인지 확인하세요.', cancelText: '' });
    MG.save(); showToast(`${added}명 추가, ${skipped}행 건너뜀`, 'success'); renderProfileTable(); renderProfileBar();
  };
  const validateRoot = d => d && typeof d === 'object' && d.schemaVersion === 1 && Array.isArray(d.profiles) && d.settings && typeof d.settings === 'object' && d.profiles.every(p => p && typeof p.id === 'string' && typeof p.name === 'string');
  const importJson = async text => {
    let data = null; try { data = JSON.parse(text); } catch (e) { data = null; }
    if (!validateRoot(data)) return showModal({ title: '가져오기 실패', body: '형식이 맞지 않는 파일입니다. 연산수호대의 JSON 백업 파일(schemaVersion 1)만 가져올 수 있어요.', cancelText: '' });
    if (!await showModal({ title: 'JSON 가져오기', body: `현재 데이터를 덮어씁니다. 프로필 ${data.profiles.length}명을 복원할까요?`, confirmText: '덮어쓰기', danger: true })) return;
    MG.replaceRoot(data); showToast(`복원 완료: 프로필 ${data.profiles.length}명`, 'success'); UI.pinOk = false; renderProfileBar(); showView(UI.view);
  };
  const readFile = (file, cb) => { const r = new FileReader(); r.onload = () => cb(String(r.result || '')); r.onerror = () => showToast('파일을 읽을 수 없습니다', 'error'); r.readAsText(file, 'UTF-8'); };
  // 드롭 영역: JSON 백업 영역은 확장자 불일치도 '형식이 맞지 않는 파일입니다' 모달(AC15), 명단 CSV 영역은 토스트로 거부
  const bindDrop = (zoneId, inputId, accept, handler, kind) => {
    const z = el(zoneId), inp = el(inputId);
    const take = f => { if (!f) return; if (!accept.test(f.name)) return kind ? showModal({ title: '가져오기 실패', body: `형식이 맞지 않는 파일입니다. ${kind} 파일만 가져올 수 있어요. (선택한 파일: ${esc(f.name)})`, cancelText: '' }) : showToast('지원하지 않는 파일 형식입니다(CSV만 가능)', 'error'); readFile(f, handler); };
    ['dragover', 'dragenter'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove('over'); if (ev === 'drop') take(e.dataTransfer.files[0]); }));
    z.addEventListener('click', e => { if (e.target !== inp) { e.preventDefault(); inp.click(); } });
    inp.addEventListener('change', () => { take(inp.files[0]); inp.value = ''; });
  };

  // ---- 도움말 ----
  const showHelp = () => showModal({ title: '❓ 연산수호대 사용법', wide: true, cancelText: '', body: `<ol class="help">
    <li>상단에서 <b>내 프로필</b>을 고르거나 <b>새 프로필</b>을 만들어요. 이름 없이 <b>체험하기</b>도 가능해요(기록 저장 안 됨).</li>
    <li>학년 탭에서 스테이지 카드의 <b>시작</b>을 눌러요. 이전 스테이지를 별 1개 이상으로 클리어하면 다음이 열려요.</li>
    <li>몬스터 머리 위 문제의 답을 <b>키패드로 입력하고 발사(Enter)</b>하면 포탑이 자동으로 조준해 격파해요. 3지선다 스테이지는 1·2·3 버튼으로 골라요.</li>
    <li>틀리면 <b>교정 카드</b>에서 그림으로 다시 생각하고 정답을 입력해요. 틀린 문제는 <b>복수 몬스터</b>로 돌아오니 꼭 복수하세요(점수 2배).</li>
    <li>콤보를 이어 배율을 올리고, 콤보 10마다 <b>필살기(Space)</b>가 충전돼요. 10웨이브 보스의 방패 3개를 깨면 클리어!</li>
    <li>결과 화면의 <b>다시 풀기</b>로 틀린 문제를 복습하고, <b>도감·명예의 전당</b>에서 숙달·배지·랭킹을 확인해요.</li></ol>
    <p class="muted">단축키: 숫자·Enter·Backspace·'.'(소수) · Space 필살기 · Esc 일시정지 · 1/2/3 선택지 &nbsp;|&nbsp; 선생님은 ⚙에서 스테이지·속도·시간 제한·랭킹 공개·프로필·백업을 관리해요.</p>` });

  // ---- 설정 변경 적용 ----
  const applySetting = (k, v) => {
    const s = MG.root.settings; s[k] = v; MG.save();
    if (k === 'volume') { MG.Audio.setVolume(v); el('volume-out').textContent = v.toFixed(2); }
    if (k === 'muted') syncMute();
    if (k === 'bigText') document.body.classList.toggle('big-text', !!v);
    showToast('저장됨', 'success', 1000); renderSaveStatus();
  };
  const syncMute = () => { const m = !!MG.root.settings.muted; MG.Audio.setMuted(m); document.querySelectorAll('[data-action="toggle-mute"]').forEach(b => { b.textContent = m ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(m)); }); const c = $('[data-setting="muted"]'); if (c) c.checked = m; };

  // ---- 이벤트 위임 ----
  const actions = {
    nav: b => showView(b.dataset.view), help: showHelp, 'new-profile': newProfileModal,
    guest: () => { MG.setGuest(); renderProfileBar(); showView('home'); showToast('체험 모드: 기록은 저장되지 않아요', 'info'); },
    'profile-menu': () => toggleProfileMenu(),
    'toggle-mute': () => { MG.Audio.init(); MG.root.settings.muted = !MG.root.settings.muted; MG.save(); syncMute(); },
    'toggle-theme': () => MG.toggleTheme(),
    'grade-tab': b => { UI.gradeTab = +b.dataset.grade; uiPref.set('lastGradeTab', UI.gradeTab); renderHome(); },
    'start-stage': b => startStage(b.dataset.stage),
    review: startReview, super: () => MG.Game.useSuper(), pause: () => MG.Game.pause(),
    // 전체화면은 캔버스+HUD+입력 패널을 모두 담은 게임 섹션 전체를 대상으로(태블릿에서도 입력 가능)
    fullscreen: () => { const w = el('game-view'); if (!document.fullscreenEnabled || !w.requestFullscreen) return showToast('이 브라우저에서는 전체화면을 지원하지 않아요', 'warn'); if (document.fullscreenElement) document.exitFullscreen(); else w.requestFullscreen().catch(() => showToast('전체화면 전환에 실패했어요', 'warn')); },
    'fact-tip': b => { const f = MG.current().facts[b.dataset.key]; document.querySelectorAll('.hm-cell.selected').forEach(c => c.classList.remove('selected')); b.classList.add('selected'); el('fact-tip').textContent = f ? `${b.dataset.key} = ${f.answer} · 정답 ${f.hit}회 / 오답 ${f.miss}회 · 상자 ${f.box} · 평균 반응 ${f.hit && f.rtSum ? (f.rtSum / f.hit / 1000).toFixed(1) + '초' : '—'} · 마지막 ${f.lastAt ? MG.localDate(f.lastAt) : '-'}` : `${b.dataset.key} · 아직 출제되지 않았어요`; },
    'pick-skin': b => { const p = MG.current(); p.skin = b.dataset.skin; MG.save(); renderCodex(); showToast('포탑 스킨을 바꿨어요', 'success'); },
    'pick-theme': b => { const p = MG.current(); p.theme = b.dataset.theme; MG.save(); renderCodex(); showToast('배경 테마를 바꿨어요', 'success'); },
    'hall-tab': b => { UI.hallTab = b.dataset.tab; uiPref.set('lastHallTab', UI.hallTab); renderHall(); },
    'print-today': printToday, 'export-records': exportRecords, 'export-weak': exportWeak,
    'export-json': () => { download(`math-guardians-backup-${stamp()}.json`, JSON.stringify(MG.root, null, 1), 'application/json'); showToast('JSON 백업 파일을 내려받았어요', 'success'); },
    'reset-sample': async () => { if (await showModal({ title: '샘플 데이터로 초기화', body: '모든 프로필·기록·설정이 삭제되고 경인초등학교 5학년 2반 샘플로 돌아갑니다. 계속할까요?', confirmText: '초기화', danger: true })) { MG.resetSample(); UI.pinOk = false; renderProfileBar(); showView('home'); showToast('샘플 데이터로 초기화했어요', 'success'); } },
    'grade-all': b => { const ids = MG.STAGES.filter(x => x.grade === +b.dataset.grade).map(x => x.id), s = MG.root.settings; s.activeStageIds = b.dataset.on === '1' ? [...new Set(s.activeStageIds.concat(ids))] : s.activeStageIds.filter(id => !ids.includes(id)); applySetting('activeStageIds', s.activeStageIds); renderSettings(); },
    'save-pin': () => { const v = el('pin-input').value.trim(); if (v && !/^\d{4}$/.test(v)) return showToast('PIN은 숫자 4자리입니다', 'error'); applySetting('teacherPin', v || null); el('pin-status').textContent = v ? 'PIN 설정됨' : 'PIN 없음'; },
    'pin-unlock': () => { if (el('pin-gate-input').value === MG.root.settings.teacherPin) { UI.pinOk = true; renderSettings(); } else showToast('PIN이 맞지 않아요', 'error'); },
    'delete-profile': async b => {
      const p = MG.root.profiles.find(x => x.id === b.dataset.pid); if (!p) return;
      if (!await showModal({ title: '프로필 삭제', body: `'${esc(p.name)}' 프로필과 모든 기록을 삭제할까요? 되돌릴 수 없어요.`, confirmText: '삭제', danger: true })) return;
      MG.root.profiles = MG.root.profiles.filter(x => x !== p); if (MG.root.activeProfileId === p.id) MG.setActive(MG.root.profiles[0] ? MG.root.profiles[0].id : null);
      MG.save(); renderProfileTable(); renderProfileBar(); showToast('삭제했어요', 'success');
    },
  };
  const bind = () => {
    document.addEventListener('click', e => {
      const li = e.target.closest('#profile-menu li[data-pid]'); if (li) { pickProfile(li.dataset.pid); return; }
      if (!e.target.closest('.profile-box')) toggleProfileMenu(false);
      const b = e.target.closest('[data-action]'); if (!b || b.disabled) return;
      if (b.closest('.modal-backdrop') && !['toggle-mute', 'new-profile'].includes(b.dataset.action)) return;
      const fn = actions[b.dataset.action]; if (fn) { MG.Audio.init(); fn(b); }
    });
    // 프로필 드롭다운 키보드: ↑↓ 이동, Enter/Space 선택, Esc 닫기
    el('profile-menu').addEventListener('keydown', e => {
      const items = [...el('profile-menu').querySelectorAll('li[data-pid]')], i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; if (n) n.focus(); }
      else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) { e.preventDefault(); pickProfile(items[i].dataset.pid); el('profile-btn').focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); toggleProfileMenu(false); el('profile-btn').focus(); }
    });
    // 드롭 영역 밖에 파일을 놓아도 브라우저가 그 파일로 이동하지 않게 막는다
    ['dragover', 'drop'].forEach(ev => document.addEventListener(ev, e => { if (e.target.closest && e.target.closest('.drop-zone')) return; e.preventDefault(); if (ev === 'drop') showToast('파일은 설정 화면의 점선 영역에 놓아 주세요', 'warn'); }));
    document.addEventListener('pointerdown', () => MG.Audio.init(), { once: true });
    document.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-setting]')) { const k = t.dataset.setting; applySetting(k, t.type === 'checkbox' ? t.checked : t.type === 'range' ? parseFloat(t.value) : t.tagName === 'SELECT' ? +t.value : t.value); if (k === 'rankingPublic' || k === 'unlockAll' || k === 'lowGradeChoice') { /* 홈·랭킹은 다음 렌더에 반영 */ } }
      else if (t.matches('#speed-group input')) applySetting('speedPreset', t.value);
      else if (t.matches('[data-stage-check]')) { const s = MG.root.settings, id = t.dataset.stageCheck; s.activeStageIds = t.checked ? [...new Set(s.activeStageIds.concat(id))] : s.activeStageIds.filter(x => x !== id); applySetting('activeStageIds', s.activeStageIds); }
      else if (t.matches('#profile-table input.cell')) editProfileCell(t);
    });
    document.addEventListener('input', e => { if (e.target.matches('#volume')) el('volume-out').textContent = parseFloat(e.target.value).toFixed(2); });
    bindDrop('json-drop', 'json-file', /\.json$/i, importJson, '연산수호대 JSON 백업(.json)'); bindDrop('roster-drop', 'roster-file', /\.csv$/i, importRoster, null);
    MG.Game.init(hooks);
  };
  MG.UI = { showToast, showModal, openModal, showView, renderProfileBar, renderHome, renderHint, syncMute, bind, startStage, newProfileModal, exportRecords, importJson, importRoster, renderSaveStatus, get view() { return UI.view; } };
})(window.MG);
