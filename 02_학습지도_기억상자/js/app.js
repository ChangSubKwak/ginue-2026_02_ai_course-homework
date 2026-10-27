/* app.js — 기억상자 핵심: 상태·저장·라이트너 스케줄러·화면 렌더(홈/카드/기록/시험/인쇄/교사/설정)·복습 세션·모달 폼·이벤트 */
'use strict';
(function () {
  const VERSION = '1.0.0';
  const KEY = { meta: 'v1.meta', profile: id => 'v1.profile.' + id, teacher: 'v1.teacher', theme: 'theme' };
  const REASONS = APP_DATA.REASONS, REASON_KEYS = REASONS.map(r => r.key);
  const reasonLabel = k => (REASONS.find(r => r.key === k) || {}).label || '-';
  const reasonShort = k => (REASONS.find(r => r.key === k) || {}).short || '-';
  const LIMITS = { front: 300, back: 300, hint: 200, note: 200, reflect: 80, goal: [1, 50], csvRows: 1000, quota: 5 * 1024 * 1024 };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const emptyProfileData = () => ({ decks: [], cards: [], sessions: [], dailyLog: {}, reflections: [], exams: [], pendingSession: null, weeklyChecks: [] });
  // 가져온 파일(백업·요약)의 id·이모지·덱 색·숫자는 속성/클래스/텍스트에 그대로 들어가므로 허용 형식만 통과시킨다(아니면 새 id·기본값)
  const SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/, YMD = /^\d{4}-\d{2}-\d{2}$/, DECK_COLORS = Object.values(APP_DATA.SUBJECT_KEY);
  const safeId = (v, make) => (typeof v === 'string' && SAFE_ID.test(v) ? v : make());
  const safeEmoji = e => (APP_DATA.PROFILE_EMOJIS.includes(e) ? e : '🐼');
  const num0 = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const strN = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  // 저장·복원·가져온 프로필 데이터의 형식 보정(배열·숫자·날짜·id·손그림 검사) — 깨진 파일로 앱이 멈추거나 스크립트가 실행되지 않게
  function coerceProfileData(d) {
    const out = Object.assign(emptyProfileData(), d && typeof d === 'object' && !Array.isArray(d) ? d : {});
    ['decks', 'cards', 'sessions', 'reflections', 'exams', 'weeklyChecks'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
    const ymd = v => (typeof v === 'string' && YMD.test(v) ? v : today), obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const numObj = v => { const o = obj(v), r = {}; Object.keys(o).forEach(k => { r[k] = num0(o[k]); }); return r; };
    const reasonOrNull = v => (REASON_KEYS.includes(v) ? v : null);
    const deckMap = Object.create(null), cardMap = Object.create(null); // 형식이 어긋난 id는 새로 발급하고 참조(카드 deckId·시험 deckIds·진행 중 세션)도 따라 바꾼다
    out.decks = out.decks.filter(x => x && typeof x === 'object' && typeof x.name === 'string').map(x => { const id = safeId(x.id, uid), subject = APP_DATA.SUBJECTS.includes(x.subject) ? x.subject : '기타'; deckMap[x.id] = id; return Object.assign(x, { id, subject, unit: strN(x.unit, 40), color: DECK_COLORS.includes(x.color) ? x.color : APP_DATA.SUBJECT_KEY[subject] }); });
    out.cards = out.cards.filter(c => c && typeof c === 'object' && typeof c.front === 'string' && typeof c.back === 'string').map(c => { const id = safeId(c.id, uid); cardMap[c.id] = id; return Object.assign(c, { id, deckId: deckMap[c.deckId] || safeId(c.deckId, () => ''), type: c.type === 'wrong' ? 'wrong' : 'memo', hint: strN(c.hint, LIMITS.hint), note: strN(c.note, LIMITS.note), myAnswer: strN(c.myAnswer, 100), reason: reasonOrNull(c.reason), box: clamp(Math.round(Number(c.box)) || 1, 1, 5), mastered: !!c.mastered, due: ymd(c.due), createdAt: ymd(c.createdAt), failReasons: (Array.isArray(c.failReasons) ? c.failReasons : []).filter(k => REASON_KEYS.includes(k)), history: (Array.isArray(c.history) ? c.history : []).filter(h => h && typeof h === 'object'), drawing: isDrawing(c.drawing) ? c.drawing : null }); });
    out.sessions = out.sessions.filter(s => s && typeof s === 'object').map(s => Object.assign(s, { id: safeId(s.id, uid), date: ymd(s.date), count: num0(s.count), ok: num0(s.ok), fail: num0(s.fail), quadrants: numObj(s.quadrants), reasons: numObj(s.reasons), moves: numObj(s.moves) }));
    out.exams = out.exams.filter(e => e && typeof e === 'object' && Array.isArray(e.deckIds)).map(e => Object.assign(e, { id: safeId(e.id, uid), title: strN(e.title, 40), date: ymd(e.date), deckIds: e.deckIds.map(x => deckMap[x] || safeId(x, () => '')).filter(Boolean), plan: numObj(e.plan), status: e.status === 'done' ? 'done' : 'active' }));
    out.reflections = out.reflections.filter(r => r && typeof r === 'object' && typeof r.text === 'string').map(r => Object.assign(r, { id: safeId(r.id, uid), date: ymd(r.date), text: r.text.slice(0, LIMITS.reflect) }));
    const log = {}; Object.entries(obj(out.dailyLog)).forEach(([k, v]) => { if (YMD.test(k)) log[k] = { reviewed: num0(obj(v).reviewed), correct: num0(obj(v).correct) }; }); out.dailyLog = log;
    out.weeklyChecks = out.weeklyChecks.filter(w => typeof w === 'string');
    const p = out.pendingSession;
    out.pendingSession = p && typeof p === 'object' && Array.isArray(p.remainingCardIds) && Array.isArray(p.results) ? { startedDate: ymd(p.startedDate), kind: strN(p.kind, 10) || 'today', startedAt: strN(p.startedAt, 30), remainingCardIds: p.remainingCardIds.map(x => cardMap[x]).filter(Boolean),
      results: p.results.filter(r => r && typeof r === 'object').map(r => ({ cardId: cardMap[r.cardId] || '', front: strN(r.front, LIMITS.front), ok: !!r.ok, c: num0(r.c), from: num0(r.from), to: num0(r.to), reason: reasonOrNull(r.reason), repeat: !!r.repeat, wrongType: !!r.wrongType })) } : null;
    return out;
  }

  /* ---------- 상태 ---------- */
  const state = {
    meta: null, data: null, teacher: { imports: [] }, view: 'home', cardsMode: 'decks', deckId: null,
    filter: { q: '', box: 'all', type: 'all', sort: 'due' }, session: null, forecastToggle: false, teacherCell: null,
    print: { deckIds: [], boxMax: 5, type: 'all', layout: 'cards', hint: true, drawing: true, title: true },
  };
  let today = todayStr();

  /* ---------- 저장·로드 ---------- */
  const saveMeta = () => storage.set(KEY.meta, state.meta);
  const saveData = () => storage.set(KEY.profile(state.meta.activeProfileId), state.data);
  const saveTeacher = () => storage.set(KEY.teacher, state.teacher);
  // 샘플 데이터 생성 후 저장(첫 실행·샘플 다시 넣기)
  function seedSample() {
    const s = buildSampleData(today);
    storage.keys().filter(k => k.startsWith('v1.profile.')).forEach(k => storage.remove(k));
    state.meta = s.meta; saveMeta();
    Object.entries(s.profiles).forEach(([id, d]) => storage.set(KEY.profile(id), d));
    state.data = storage.get(KEY.profile(s.meta.activeProfileId), s.profiles[s.meta.activeProfileId]);
  }
  // 프로필 데이터 로드(없으면 빈 데이터, 있으면 형식 보정)
  const loadProfile = id => coerceProfileData(storage.get(KEY.profile(id), null));
  // 프로필 메타 보정(이모지는 허용 목록, 목표는 1~50). id는 호출자가 정한다(저장소 값은 그대로, 복원은 safeId로 검사한 값)
  const fixProfile = (p, id) => ({ id, name: String(p.name).trim().slice(0, 20) || '학생', emoji: safeEmoji(p.emoji), dailyGoal: clamp(Number(p.dailyGoal) || 10, ...LIMITS.goal), createdAt: typeof p.createdAt === 'string' && YMD.test(p.createdAt) ? p.createdAt : today, lastOpened: typeof p.lastOpened === 'string' ? p.lastOpened.slice(0, 10) : today });
  function loadAll() {
    const m = storage.get(KEY.meta, null);
    const profs = m && Array.isArray(m.profiles) ? m.profiles.filter(p => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string') : [];
    if (!profs.length) { seedSample(); showToast('샘플 데이터가 준비되었어요. 모든 기록은 이 기기에만 저장돼요.', 'info', 4000); }
    else {
      state.meta = m; state.meta.profiles = profs.map(p => fixProfile(p, p.id));
      if (!state.meta.profiles.some(p => p.id === state.meta.activeProfileId)) state.meta.activeProfileId = state.meta.profiles[0].id;
      state.data = loadProfile(state.meta.activeProfileId);
    }
    state.meta.settings = Object.assign({ teacherMode: false, reduceMotion: false }, state.meta.settings);
    const t = storage.get(KEY.teacher, null); state.teacher = { imports: (t && Array.isArray(t.imports) ? t.imports : []).map(normalizeSummary).filter(Boolean) }; // 손상 항목은 걸러낸다
    profile().lastOpened = today; saveMeta();
  }

  /* ---------- 파생 값 ---------- */
  const profile = () => state.meta.profiles.find(p => p.id === state.meta.activeProfileId);
  const cards = () => state.data.cards;
  const decks = () => state.data.decks;
  const deckById = id => decks().find(d => d.id === id);
  const cardById = id => cards().find(c => c.id === id);
  const deckClass = d => 'sc-' + (DECK_COLORS.includes(d.color) ? d.color : APP_DATA.SUBJECT_KEY[d.subject] || 'etc'); // class 속성에는 허용된 색 키만
  // 오늘 큐: 가장 많이 밀린 카드(오늘-due 일수 내림차순) → 낮은 상자 → 오래된 카드
  const todayQueue = () => cards().filter(c => c.due <= today).sort((a, b) => diffDays(b.due, today) - diffDays(a.due, today) || a.box - b.box || a.createdAt.localeCompare(b.createdAt));
  // 되새김 한 줄: 날짜 역순(최신이 위)
  const sortedReflections = () => state.data.reflections.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const overdueCount = () => cards().filter(c => c.due < today).length;
  // 미리 복습: 내일·모레 예정 중 낮은 상자 5장
  const previewQueue = () => cards().filter(c => c.due === addDays(today, 1) || c.due === addDays(today, 2)).sort((a, b) => a.box - b.box || a.due.localeCompare(b.due)).slice(0, 5);
  const reviewedOn = d => (state.data.dailyLog[d] || {}).reviewed || 0;
  // 스트릭: 오늘 기록이 있으면 오늘부터, 아니면 어제부터 연속 일수
  function streak() { let d = reviewedOn(today) > 0 ? today : addDays(today, -1), n = 0; while (reviewedOn(d) > 0) { n++; d = addDays(d, -1); } return n; }
  const boxCounts = (list = cards()) => [1, 2, 3, 4, 5].map(b => list.filter(c => c.box === b).length);
  const activeExams = () => state.data.exams.filter(e => e.status !== 'done' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  // 시험 계획 달력의 '남은 장수'를 현재 카드 due로 다시 센다(복습하면 줄어들고, 밀린 카드는 오늘 칸에 모은다). ex.plan은 생성 시점 기록
  const examPlanLive = ex => { const plan = {}; cards().filter(c => ex.deckIds.includes(c.deckId)).forEach(c => { const key = c.due < today ? today : c.due; if (key < ex.date) plan[key] = (plan[key] || 0) + 1; }); return plan; };
  const reduceMotion = () => state.meta.settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 반복 오류 등 카드 상태 배지 HTML
  function cardBadges(c, withDue = true) {
    const b = [`<span class="badge badge-box">${c.box}상자</span>`];
    if (c.mastered) b.push('<span class="badge badge-star">★ 숙달</span>');
    if (c.type === 'wrong') b.push(`<span class="badge badge-wrong">오답</span>`);
    if (c.type === 'wrong' && c.reason) b.push(`<span class="badge badge-reason">${escapeHtml(reasonShort(c.reason))}</span>`);
    if (isRepeat(c)) b.push('<span class="badge badge-repeat">같은 이유로 3번</span>');
    if (withDue) b.push(`<span class="badge ${c.due < today ? 'badge-late' : ''}">${c.due < today ? '⏰ 밀림 ' : ''}${escapeHtml(fmtMd(c.due))}</span>`);
    if (diffDays(today, c.due) > 45) b.push('<span class="badge badge-late" title="기기 날짜를 확인하세요">⚠ 날짜 확인</span>');
    if (c.drawing) b.push('<span class="badge">✎ 그림</span>');
    return b.join('');
  }

  /* ---------- 테마·화면 전환 ---------- */
  function applyTheme() {
    const t = storage.get(KEY.theme, null);
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const dark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('#theme-btn').textContent = dark ? '☀️' : '🌙';
    document.documentElement.dataset.motion = state.meta.settings.reduceMotion ? 'reduce' : '';
  }
  function toggleTheme() { const cur = document.documentElement.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); storage.set(KEY.theme, cur === 'dark' ? 'light' : 'dark'); applyTheme(); }
  function setView(v) { if (v === 'teacher' && !state.meta.settings.teacherMode) v = 'settings'; state.view = v; render(); window.scrollTo({ top: 0 }); }
  // 카드 탭을 첫 화면(덱 목록)으로 되돌린다
  const resetCards = () => { Object.assign(state, { cardsMode: 'decks', deckId: null }); state.filter = { q: '', box: 'all', type: 'all', sort: 'due' }; };

  /* ---------- 렌더 진입 ---------- */
  const views = {};
  function render() {
    today = todayStr();
    const p = profile();
    $('#profile-chip .chip-emoji').textContent = p.emoji; $('#profile-chip .chip-name').textContent = p.name;
    $('#tab-teacher').hidden = !state.meta.settings.teacherMode;
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === state.view)));
    $$('section[data-view]').forEach(s => { s.hidden = s.dataset.view !== state.view; });
    $('#storage-banner').hidden = !storage.failed;
    $('.fab').hidden = state.view === 'settings' || state.view === 'teacher';
    views[state.view]();
  }

  /* ---------- 홈 ---------- */
  views.home = () => {
    const q = todayQueue(), over = overdueCount(), p = profile(), done = reviewedOn(today), goal = p.dailyGoal || 10;
    const pend = state.data.pendingSession, remain = pend ? pend.remainingCardIds.filter(cardById).length : 0;
    const pre = previewQueue(), tomorrow = cards().filter(c => c.due <= addDays(today, 1)).length, st = streak();
    const counts = boxCounts(), ex = activeExams()[0];
    let main;
    if (!cards().length) main = `<div class="empty"><strong>아직 카드가 없어요</strong><p>카드 탭에서 첫 카드를 만들어 보세요. 외울 것, 틀린 것 무엇이든 좋아요.</p><button class="btn btn-primary" data-action="goto" data-view="cards">카드 만들러 가기</button></div>`;
    else if (pend && remain) main = `<p class="hero-sub">하던 복습이 남아 있어요.</p><button class="btn btn-primary btn-lg btn-block review-btn" data-action="resume">이어서 하기 <small>(남은 ${remain}장)</small></button><button class="btn btn-ghost" data-action="restart">새로 시작</button>`;
    else if (q.length) main = `<button class="btn btn-primary btn-lg btn-block review-btn" data-action="start-today">오늘 복습 ${q.length}장 <small>(밀림 ${over}장)</small></button><p class="hero-sub">카드를 보고 ‘얼마나 확실한지’ 먼저 고른 다음 뒤집어요.</p>`;
    else main = `<p class="hero-title">오늘은 다 했어요! 🎉</p><p class="hero-sub">내일 ${tomorrow}장이 기다려요.</p>${pre.length ? `<button class="btn btn-primary" data-action="start-preview">내일 카드 ${pre.length}장 미리 복습</button>` : ''}`;
    const ratio = Math.min(100, pct(done, goal));
    $('#view-home').innerHTML = `
      ${ex ? `<div class="dday"><div><b>D-${diffDays(today, ex.date) || 'Day'}</b> ${escapeHtml(ex.title)}</div><span class="muted small">오늘 계획 ${examPlanLive(ex)[today] || 0}장 · ${escapeHtml(fmtMd(ex.date))}(${weekdayKo(ex.date)})</span><button class="btn btn-sm" data-action="goto" data-view="exam">계획 보기</button></div>` : ''}
      <div class="hero">
        <div class="hero-main">${main}</div>
        <div class="panel" style="display:grid;gap:14px;align-content:start">
          <div><div class="row spread small"><span><b>하루 목표</b> <span class="num">${done}/${goal}장</span></span><span class="muted">${ratio >= 100 ? '목표 달성 ✓' : ratio + '%'}</span></div><div class="progress ${ratio >= 100 ? 'progress-done' : ''}" role="progressbar" aria-valuenow="${done}" aria-valuemax="${goal}"><i style="width:${ratio}%"></i></div></div>
          <div class="streak ${st > 0 ? 'on' : ''}"><span class="flame" aria-hidden="true">🔥</span><div class="stat"><b class="num">${st}일</b><span>연속 복습 ${st > 0 ? '중이에요' : '— 오늘 다시 시작해요'}</span></div></div>
          <div class="row small muted"><span>카드 ${cards().length}장</span><span>·</span><span>덱 ${decks().length}개</span><span>·</span><span>숙달 ${cards().filter(c => c.mastered).length}장</span></div>
        </div>
      </div>
      <div><h2 style="margin-bottom:10px">상자 5개 <span class="small muted" style="font-family:var(--font-body);font-weight:400">— 맞히면 다음 상자로, 틀리면 1상자로</span></h2>
      <div class="boxes">${[1, 2, 3, 4, 5].map(b => `<button class="box box-${b}" data-action="open-box" data-box="${b}" aria-label="${b}상자 ${counts[b - 1]}장"><b class="num">${counts[b - 1]}</b><span class="box-name">${b}상자</span><span class="box-gap">${INTERVALS[b]}일마다</span></button>`).join('')}</div></div>`;
  };

  /* ---------- 카드·덱 ---------- */
  views.cards = () => { $('#view-cards').innerHTML = state.cardsMode === 'decks' ? deckGridHtml() : deckDetailHtml(); if (state.cardsMode === 'list') wireDeckDetail(); };
  function deckGridHtml() {
    const dueBy = {}; todayQueue().forEach(c => { dueBy[c.deckId] = (dueBy[c.deckId] || 0) + 1; });
    const items = decks().map(d => {
      const list = cards().filter(c => c.deckId === d.id), bc = boxCounts(list), total = list.length || 1, late = list.filter(c => c.due < today).length, mast = list.filter(c => c.mastered).length;
      return `<div class="deck-card ${deckClass(d)}" role="button" tabindex="0" data-action="open-deck" data-id="${escapeHtml(d.id)}"><div class="row spread"><span class="badge">${escapeHtml(d.subject)}</span><span class="small muted num">${list.length}장</span></div><h3>${escapeHtml(d.name)}</h3><p class="small muted">${escapeHtml(d.unit || '단원 없음')}</p><div class="mini-bars" role="img" aria-label="상자 분포: ${bc.map((n, i) => `${i + 1}상자 ${n}장`).join(', ')}">${bc.map((n, i) => `<i style="width:${(n / total) * 100}%;background:var(--box-${i + 1})" title="${i + 1}상자 ${n}장"></i>`).join('')}</div><div class="row small muted num" style="gap:6px"><span>오늘 ${dueBy[d.id] || 0}장</span>${late ? `<span class="late-note">· ⏰ 밀림 ${late}장</span>` : ''}<span>· ★ 숙달 ${mast}장</span></div></div>`;
    }).join('');
    return `<div class="panel-head"><h2>내 덱 ${decks().length}개</h2><div class="row"><button class="btn btn-sm" data-action="all-cards">전체 카드 보기</button><button class="btn btn-primary btn-sm" data-action="new-deck">+ 덱</button></div></div>
      ${decks().length ? `<div class="deck-grid">${items}</div>` : `<div class="empty panel"><strong>첫 덱을 만들어 보세요</strong><p>덱은 과목·단원별 카드 묶음이에요. 교사가 준 CSV 파일도 넣을 수 있어요.</p><button class="btn btn-primary" data-action="new-deck">+ 덱 만들기</button></div>`}`;
  }
  // 필터·정렬 적용 카드 목록
  function filteredCards() {
    const f = state.filter, q = f.q.trim().toLowerCase();
    let list = state.deckId ? cards().filter(c => c.deckId === state.deckId) : cards().slice();
    if (q) list = list.filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q));
    if (f.box === 'master') list = list.filter(c => c.mastered); else if (f.box !== 'all') list = list.filter(c => c.box === Number(f.box));
    if (f.type === 'repeat') list = list.filter(isRepeat); else if (f.type !== 'all') list = list.filter(c => c.type === f.type);
    const sorters = { due: (a, b) => a.due.localeCompare(b.due), box: (a, b) => a.box - b.box || a.due.localeCompare(b.due), recent: (a, b) => b.createdAt.localeCompare(a.createdAt) };
    return list.sort(sorters[f.sort] || sorters.due);
  }
  function deckDetailHtml() {
    const d = state.deckId ? deckById(state.deckId) : null, f = state.filter;
    const chip = (name, val, label) => `<button class="chip-btn" data-filter="${name}" data-val="${val}" aria-pressed="${String(f[name]) === String(val)}">${label}</button>`;
    const head = d ? `<div class="panel-head"><div><button class="btn btn-sm btn-ghost" data-action="back-decks">← 덱 목록</button><h2 style="margin-top:6px"><span class="subj-dot ${deckClass(d)}"></span> ${escapeHtml(d.name)}</h2><p class="small muted">${escapeHtml(d.subject)} · ${escapeHtml(d.unit || '단원 없음')} · ${cards().filter(c => c.deckId === d.id).length}장</p></div>
        <div class="row"><button class="btn btn-primary btn-sm" data-action="new-card" data-deck="${escapeHtml(d.id)}">+ 카드</button><button class="btn btn-sm" data-action="start-deck" data-id="${escapeHtml(d.id)}" ${cards().some(c => c.deckId === d.id) ? '' : 'disabled'}>지금 복습</button><button class="btn btn-sm" data-action="export-csv" data-id="${escapeHtml(d.id)}">내보내기(CSV)</button><button class="btn btn-sm" data-action="edit-deck" data-id="${escapeHtml(d.id)}">수정</button><button class="btn btn-sm btn-ghost" data-action="delete-deck" data-id="${escapeHtml(d.id)}">삭제</button></div></div>
        <div class="dropzone" id="csv-drop"><span>📄 CSV 파일을 여기에 끌어 놓거나</span><label class="btn btn-sm">파일 선택<input type="file" accept=".csv,text/csv,text/plain" aria-label="CSV 파일 선택"></label><span class="small">열: 앞면, 뒷면, 힌트(선택), 유형(암기/오답), 원인 · UTF-8 · 첫 행 헤더 가능</span></div>`
      : `<div class="panel-head"><div><button class="btn btn-sm btn-ghost" data-action="back-decks">← 덱 목록</button><h2 style="margin-top:6px">전체 카드</h2><p class="small muted">${cards().length}장</p></div><button class="btn btn-primary btn-sm" data-action="new-card">+ 카드</button></div>`;
    return `${head}<div class="card-tools panel"><div class="row"><input class="input" id="card-q" type="search" placeholder="앞면·뒷면 검색" value="${escapeHtml(f.q)}" aria-label="카드 검색" style="max-width:280px"><select class="select" id="card-sort" aria-label="정렬" style="max-width:150px"><option value="due" ${f.sort === 'due' ? 'selected' : ''}>복습일 순</option><option value="box" ${f.sort === 'box' ? 'selected' : ''}>상자 순</option><option value="recent" ${f.sort === 'recent' ? 'selected' : ''}>최근 만든 순</option></select></div>
      <div class="chips">${chip('box', 'all', '전체')}${[1, 2, 3, 4, 5].map(b => chip('box', b, b + '상자')).join('')}${chip('box', 'master', '★ 숙달')}</div>
      <div class="chips">${chip('type', 'all', '모든 유형')}${chip('type', 'memo', '암기')}${chip('type', 'wrong', '오답')}${chip('type', 'repeat', '반복 오류')}</div></div><div class="list" id="card-list">${cardListHtml()}</div>`;
  }
  function cardListHtml() {
    const list = filteredCards();
    if (!list.length) return `<div class="empty panel"><strong>표시할 카드가 없어요</strong><p>필터를 바꾸거나 새 카드를 만들어 보세요.</p></div>`;
    return list.map(c => { const d = deckById(c.deckId); return `<div class="card-row" role="button" tabindex="0" data-action="edit-card" data-id="${escapeHtml(c.id)}"><div style="min-width:0"><div class="front">${escapeHtml(c.front)}</div><div class="back">${state.deckId ? '' : '<span class="subj-dot ' + (d ? deckClass(d) : '') + '"></span> ' + escapeHtml(d ? d.name : '') + ' · '}${escapeHtml(c.back)}</div></div><div class="meta">${cardBadges(c)}</div></div>`; }).join('');
  }
  function wireDeckDetail() {
    const q = $('#card-q'); if (q) q.addEventListener('input', () => { state.filter.q = q.value; $('#card-list').innerHTML = cardListHtml(); });
    const s = $('#card-sort'); if (s) s.addEventListener('change', () => { state.filter.sort = s.value; $('#card-list').innerHTML = cardListHtml(); });
    wireDropzone($('#csv-drop'), files => importCsvFile(files[0]));
  }

  /* ---------- 덱 모달 ---------- */
  function openDeckModal(deck) {
    const body = document.createElement('div'); body.className = 'list';
    body.innerHTML = `<div class="field"><label for="dk-name">덱 이름</label><input class="input" id="dk-name" maxlength="40" value="${escapeHtml(deck ? deck.name : '')}" autofocus placeholder="예) 과학 5-1 용해와 용액"></div>
      <div class="field-row"><div class="field"><label for="dk-subj">과목</label><select class="select" id="dk-subj">${APP_DATA.SUBJECTS.map(s => `<option ${deck && deck.subject === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label for="dk-unit">단원(선택)</label><input class="input" id="dk-unit" maxlength="40" value="${escapeHtml(deck ? deck.unit || '' : '')}"></div></div><p class="err" id="dk-err"></p>`;
    return showModal({ title: deck ? '덱 수정' : '새 덱', body, confirmText: '저장', onOpen: box => { const ok = () => { $('[data-value="true"]', box).disabled = !$('#dk-name', body).value.trim(); }; $('#dk-name', body).addEventListener('input', ok); ok(); },
      beforeClose: v => { if (v !== true) return; const name = $('#dk-name', body).value.trim(); if (!name) { $('#dk-err', body).textContent = '덱 이름을 입력하세요.'; return false; } const subject = $('#dk-subj', body).value, unit = $('#dk-unit', body).value.trim();
        if (deck) Object.assign(deck, { name, subject, unit, color: APP_DATA.SUBJECT_KEY[subject] }); else { const d = { id: uid(), name, subject, unit, color: APP_DATA.SUBJECT_KEY[subject], createdAt: today, source: 'manual' }; decks().push(d); state.deckId = d.id; state.cardsMode = 'list'; }
        saveData(); showToast(deck ? '덱을 수정했어요' : `덱 '${name}'을(를) 만들었어요`, 'success'); } }).then(v => { if (v === true) render(); });
  }
  async function deleteDeck(id) {
    const d = deckById(id), n = cards().filter(c => c.deckId === id).length;
    if (!await showModal({ title: '덱 삭제', body: `<p><b>${escapeHtml(d.name)}</b> 덱과 카드 <b>${n}장</b>을 삭제할까요? 되돌릴 수 없어요.</p>`, confirmText: '삭제', danger: true })) return;
    state.data.decks = decks().filter(x => x.id !== id); state.data.cards = cards().filter(c => c.deckId !== id);
    state.data.exams.forEach(e => { e.deckIds = e.deckIds.filter(x => x !== id); });
    state.cardsMode = 'decks'; state.deckId = null; saveData(); showToast('덱을 삭제했어요', 'info'); render();
  }

  /* ---------- 카드 모달(등록·수정, 손그림) ---------- */
  function openCardModal(opts = {}) {
    const card = opts.cardId ? cardById(opts.cardId) : null;
    const draft = card ? JSON.parse(JSON.stringify(card)) : { deckId: opts.deckId || (decks()[0] || {}).id, type: opts.type || 'memo', front: '', back: '', hint: '', note: '', myAnswer: '', reason: null, drawing: null };
    if (!decks().length) { showToast('먼저 덱을 만들어 주세요', 'warn'); return openDeckModal(); }
    const body = document.createElement('div'); body.className = 'list';
    const counter = (id, max) => `<div class="counter" data-for="${id}">0/${max}</div>`;
    body.innerHTML = `<div class="row spread"><div class="seg" role="group" aria-label="카드 유형"><button type="button" data-type="memo" aria-pressed="${draft.type === 'memo'}">암기 카드</button><button type="button" data-type="wrong" aria-pressed="${draft.type === 'wrong'}">오답 카드</button></div>
      <select class="select" id="cd-deck" aria-label="덱" style="max-width:220px">${decks().map(d => `<option value="${escapeHtml(d.id)}" ${d.id === draft.deckId ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="cd-front">앞면(문제·낱말) <span class="muted">필수</span></label><textarea class="textarea" id="cd-front" maxlength="${LIMITS.front}" autofocus>${escapeHtml(draft.front)}</textarea>${counter('cd-front', LIMITS.front)}<p class="err" id="cd-dup"></p></div>
      <div class="field" id="cd-my-wrap" ${draft.type === 'wrong' ? '' : 'hidden'}><label for="cd-my">내 답(틀린 답)</label><input class="input" id="cd-my" maxlength="100" value="${escapeHtml(draft.myAnswer || '')}"></div>
      <div class="field"><label for="cd-back">뒷면(정답) <span class="muted">필수</span></label><textarea class="textarea" id="cd-back" maxlength="${LIMITS.back}">${escapeHtml(draft.back)}</textarea>${counter('cd-back', LIMITS.back)}</div>
      <div class="field-row"><div class="field"><label for="cd-hint">힌트(선택)</label><input class="input" id="cd-hint" maxlength="${LIMITS.hint}" value="${escapeHtml(draft.hint || '')}"></div><div class="field"><label for="cd-note">다음에 조심할 점(선택)</label><input class="input" id="cd-note" maxlength="${LIMITS.note}" value="${escapeHtml(draft.note || '')}"></div></div>
      <div class="field" id="cd-reason-wrap" ${draft.type === 'wrong' ? '' : 'hidden'}><span class="field-label">틀린 원인 <span class="muted">(하나 선택)</span></span><div class="chips">${REASONS.map(r => `<button type="button" class="chip-btn" data-reason="${r.key}" aria-pressed="${draft.reason === r.key}">${r.label}</button>`).join('')}</div></div>
      <div class="row" id="cd-draw-row"><button type="button" class="btn btn-sm" data-draw="open">✎ ${draft.drawing ? '그림 수정' : '그림 추가'}</button>${draft.drawing ? `<img class="drawing-thumb" src="${escapeHtml(draft.drawing)}" alt="손그림"><button type="button" class="btn btn-sm btn-ghost" data-draw="clear">그림 삭제</button>` : ''}</div><p class="err" id="cd-err"></p>`;
    const buttons = [...(card ? [{ text: '삭제', value: 'delete', kind: 'danger' }] : []), { text: '취소', value: false, kind: 'ghost' }, ...(card ? [] : [{ text: '저장하고 하나 더', value: 'more', kind: 'ghost' }]), { text: '저장', value: true, kind: 'primary' }];
    const read = () => Object.assign(draft, { deckId: $('#cd-deck', body).value, front: $('#cd-front', body).value.trim(), back: $('#cd-back', body).value.trim(), hint: $('#cd-hint', body).value.trim(), note: $('#cd-note', body).value.trim(), myAnswer: $('#cd-my', body).value.trim() });
    let saveBtns = [];
    const validate = () => {
      read(); const okAll = draft.front && draft.back && (draft.type !== 'wrong' || draft.reason);
      saveBtns.forEach(b => { b.disabled = !okAll; });
      const dup = cards().find(c => c.deckId === draft.deckId && c.front === draft.front && (!card || c.id !== card.id));
      $('#cd-dup', body).textContent = dup ? '같은 앞면 카드가 이 덱에 이미 있어요(저장은 가능해요).' : '';
      $$('.counter', body).forEach(el => { const t = $('#' + el.dataset.for, body); el.textContent = `${t.value.length}/${t.maxLength}`; });
    };
    body.addEventListener('input', validate);
    body.addEventListener('click', async e => {
      const t = e.target.closest('[data-type],[data-reason],[data-draw]'); if (!t) return;
      if (t.dataset.type) { draft.type = t.dataset.type; $$('[data-type]', body).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === draft.type))); $('#cd-reason-wrap', body).hidden = $('#cd-my-wrap', body).hidden = draft.type !== 'wrong'; }
      if (t.dataset.reason) { draft.reason = t.dataset.reason; $$('[data-reason]', body).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.reason === draft.reason))); }
      if (t.dataset.draw === 'clear') { draft.drawing = null; $('#cd-draw-row', body).innerHTML = '<button type="button" class="btn btn-sm" data-draw="open">✎ 그림 추가</button>'; }
      if (t.dataset.draw === 'open') { const url = await openDrawingModal(draft.drawing); if (url) { draft.drawing = url; $('#cd-draw-row', body).innerHTML = `<button type="button" class="btn btn-sm" data-draw="open">✎ 그림 수정</button><img class="drawing-thumb" src="${escapeHtml(url)}" alt="손그림"><button type="button" class="btn btn-sm btn-ghost" data-draw="clear">그림 삭제</button>`; } }
      validate();
    });
    return showModal({ title: card ? '카드 수정' : '새 카드', body, buttons, wide: true, onOpen: box => { saveBtns = [$('[data-value="true"]', box), $('[data-value="more"]', box)].filter(Boolean); validate(); },
      beforeClose: v => { if (v !== true && v !== 'more') return; read(); if (!draft.front || !draft.back) { $('#cd-err', body).textContent = '앞면과 뒷면은 꼭 적어 주세요.'; return false; } if (draft.type === 'wrong' && !draft.reason) { $('#cd-err', body).textContent = '틀린 원인을 하나 골라 주세요.'; return false; } } })
      .then(async v => {
        if (v === 'delete') { if (await showModal({ title: '카드 삭제', body: `<p>‘${escapeHtml(card.front)}’ 카드를 삭제할까요?</p>`, confirmText: '삭제', danger: true })) { state.data.cards = cards().filter(c => c.id !== card.id); saveData(); showToast('카드를 삭제했어요', 'info'); render(); } return; }
        if (v !== true && v !== 'more') return;
        if (draft.drawing && !isDrawing(draft.drawing)) draft.drawing = null;
        if (draft.drawing && !checkDrawingQuota()) return;
        if (card) { Object.assign(card, draft); if (card.type === 'memo') { card.myAnswer = ''; } showToast('카드를 수정했어요', 'success'); }
        else { cards().push(Object.assign({ id: uid(), failReasons: draft.type === 'wrong' && draft.reason ? [draft.reason] : [], box: 1, mastered: false, due: today, lastReviewed: null, createdAt: today, history: [] }, draft)); showToast('카드가 1상자에 들어갔어요', 'success'); }
        saveData(); render();
        if (v === 'more') openCardModal({ deckId: draft.deckId, type: draft.type });
      });
  }
  // 손그림 용량 점검(150장·4MB 경고, 4.8MB 근접 시 안내)
  function checkDrawingQuota() {
    const n = cards().filter(c => c.drawing).length, used = storage.usage();
    if (used > 4.8 * 1024 * 1024) { showModal({ title: '저장 공간이 거의 찼어요', body: '<p>저장 용량이 5MB에 가까워요. 설정에서 JSON으로 백업한 뒤 그림이 있는 카드를 정리해 주세요.</p>', cancelText: null }); return false; }
    if (n >= 150 || used > 4 * 1024 * 1024) showToast(`그림 카드가 ${n}장이에요. JSON으로 내보내 보관하는 것을 권해요.`, 'warn', 4000);
    return true;
  }
  // 320×200 캔버스: 펜(검정/빨강, 2단계), 지우개, 되돌리기 10단계, 전체 지우기 → JPEG 0.6
  function openDrawingModal(initial) {
    const body = document.createElement('div'); body.className = 'canvas-wrap';
    body.innerHTML = `<div class="draw-tools"><button type="button" class="btn btn-sm on" data-t="pen-black">검정 펜</button><button type="button" class="btn btn-sm" data-t="pen-red">빨강 펜</button><button type="button" class="btn btn-sm on" data-t="w-thin">가는</button><button type="button" class="btn btn-sm" data-t="w-thick">굵은</button><button type="button" class="btn btn-sm" data-t="eraser">지우개</button><button type="button" class="btn btn-sm" data-t="undo">되돌리기</button><button type="button" class="btn btn-sm" data-t="clear">전체 지우기</button></div><canvas width="320" height="200" aria-label="손그림 캔버스"></canvas><p class="small muted">마우스·손가락·펜으로 그릴 수 있어요.</p>`;
    const cv = $('canvas', body), ctx = cv.getContext('2d'); let tool = 'pen', color = '#111', width = 2, drawing = false, undo = [], result = null;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 200); ctx.lineCap = ctx.lineJoin = 'round';
    if (initial) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, 320, 200); img.src = initial; }
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (320 / r.width), (e.clientY - r.top) * (200 / r.height)]; };
    cv.addEventListener('pointerdown', e => { undo.push(ctx.getImageData(0, 0, 320, 200)); if (undo.length > 10) undo.shift(); drawing = true; cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); ctx.strokeStyle = tool === 'eraser' ? '#fff' : color; ctx.lineWidth = tool === 'eraser' ? 16 : width; });
    cv.addEventListener('pointermove', e => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); });
    ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { drawing = false; }));
    body.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; const t = b.dataset.t;
      if (t === 'undo') { const im = undo.pop(); if (im) ctx.putImageData(im, 0, 0); return; }
      if (t === 'clear') { undo.push(ctx.getImageData(0, 0, 320, 200)); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 200); return; }
      if (t.startsWith('pen')) { tool = 'pen'; color = t === 'pen-red' ? '#d33' : '#111'; } else if (t === 'eraser') tool = 'eraser'; else width = t === 'w-thick' ? 5 : 2;
      $$('[data-t]', body).forEach(x => { const k = x.dataset.t; x.classList.toggle('on', (k.startsWith('pen') && tool === 'pen' && k === (color === '#d33' ? 'pen-red' : 'pen-black')) || (k === 'eraser' && tool === 'eraser') || k === (width === 5 ? 'w-thick' : 'w-thin')); }); });
    return showModal({ title: '손그림', body, confirmText: '그림 저장', beforeClose: v => { if (v === true) result = cv.toDataURL('image/jpeg', 0.6); } }).then(v => (v === true ? result : null));
  }

  /* ---------- CSV 가져오기·내보내기 ---------- */
  // CSV 원인 열 해석: 축약어(개념/읽기/계산/시간)·전체 라벨·영문 키 모두 허용, 그 외는 '몰랐음'
  function reasonFromText(t) { const s = String(t || '').trim().toLowerCase(); if (!s) return 'unknown'; if (/개념|concept/.test(s)) return 'concept'; if (/읽|misread/.test(s)) return 'misread'; if (/계산|표기|calc/.test(s)) return 'calc'; if (/시간|time/.test(s)) return 'time'; return 'unknown'; }
  async function importCsvFile(file) {
    if (!file || !state.deckId) return;
    let text; try { text = await readFileText(file); } catch (e) { return showToast(e.message, 'error'); }
    const parsed = parseCsv(text); let rows = parsed.rows;
    const hasHeader = rows.length && /^(앞면|front|문제)$/i.test((rows[0][0] || '').trim()); if (hasHeader) rows = rows.slice(1);
    const truncated = rows.length > LIMITS.csvRows; if (truncated) rows = rows.slice(0, LIMITS.csvRows); // 헤더를 뺀 뒤 1,000행으로 자른다
    const bad = (text.match(/�/g) || []).length;
    const deckCards = cards().filter(c => c.deckId === state.deckId), existing = new Set(deckCards.map(c => c.front));
    const items = rows.map(r => { const [front = '', back = '', hint = '', type = '', reason = ''] = r.map(x => x.trim()); const wrong = /오답|wrong/i.test(type); return { front, back, hint, type: wrong ? 'wrong' : 'memo', reason: wrong ? reasonFromText(reason) : null, reasonRaw: reason, skip: !front || !back, dup: existing.has(front) }; });
    const unrecognized = i => i.reason === 'unknown' && i.reasonRaw && !/몰랐|찍|unknown/i.test(i.reasonRaw);
    const valid = items.filter(i => !i.skip), dups = valid.filter(i => i.dup).length;
    const body = document.createElement('div'); body.className = 'list';
    body.innerHTML = `<p>감지된 열: <b>앞면, 뒷면, 힌트, 유형, 원인</b> · 총 <b>${rows.length}행</b> · 건너뜀 <b>${items.length - valid.length}행</b> · 중복 <b>${dups}행</b>${hasHeader ? ' · 헤더 제외' : ''}</p>
      ${parsed.unbalanced ? '<p class="err">따옴표 짝이 맞지 않아요. 열 구성을 확인하세요.</p>' : ''}${bad > 3 ? '<p class="err">깨진 글자가 많아요. 파일을 UTF-8로 저장해 주세요.</p>' : ''}${truncated ? `<p class="err">${LIMITS.csvRows}행을 넘어 앞 ${LIMITS.csvRows}행만 가져와요.</p>` : ''}
      <div class="scroll-x"><table class="tbl"><thead><tr><th>#</th><th>앞면</th><th>뒷면</th><th>힌트</th><th>유형</th><th>원인</th></tr></thead><tbody>${items.slice(0, 5).map((i, k) => `<tr ${i.skip ? 'class="muted"' : ''}><td>${k + 1}</td><td>${escapeHtml(truncate(i.front, 30))}</td><td>${escapeHtml(truncate(i.back, 30))}</td><td>${escapeHtml(truncate(i.hint, 20))}</td><td>${i.type === 'wrong' ? '오답' : '암기'}</td><td>${i.reason ? reasonShort(i.reason) + (unrecognized(i) ? ` <span class="err">(미인식: ${escapeHtml(truncate(i.reasonRaw, 10))})</span>` : '') : ''}</td></tr>`).join('') || '<tr><td colspan="6">읽을 수 있는 행이 없어요</td></tr>'}</tbody></table></div>
      ${items.some(unrecognized) ? '<p class="small muted">원인 열은 개념/읽기/계산/시간/몰랐음(또는 concept/misread/calc/time)으로 적어 주세요. 알 수 없는 값은 ‘몰랐음·찍었음’으로 들어가요.</p>' : ''}
      ${dups ? `<label class="switch"><input type="checkbox" id="csv-adddup"><span>중복 앞면도 추가하기(기본: 건너뛰기)</span></label>` : ''}`;
    const ok = await showModal({ title: 'CSV 미리보기', body, confirmText: '가져오기', wide: true, onOpen: box => { $('[data-value="true"]', box).disabled = !valid.length; } });
    if (!ok) return;
    const addDup = !!($('#csv-adddup', body) && $('#csv-adddup', body).checked); let added = 0, skipped = 0;
    valid.forEach(i => { if (i.dup && !addDup) { skipped++; return; } cards().push({ id: uid(), deckId: state.deckId, type: i.type, front: i.front, back: i.back, hint: i.hint, note: '', myAnswer: '', reason: i.reason, failReasons: i.reason ? [i.reason] : [], drawing: null, box: 1, mastered: false, due: today, lastReviewed: null, createdAt: today, history: [] }); added++; });
    const d = deckById(state.deckId); if (d.source === 'manual' && added) d.source = 'csv';
    saveData(); showToast(`추가 ${added}장, 중복 ${skipped}장 건너뜀`, 'success', 3500); render();
  }
  function exportCsv(deckId) {
    const d = deckById(deckId), list = cards().filter(c => c.deckId === deckId);
    download(safeFileName('기억상자_' + d.name) + '.csv', toCsv([APP_DATA.CSV_HEADER, ...list.map(c => [c.front, c.back, c.hint || '', c.type === 'wrong' ? '오답' : '암기', c.reason ? reasonShort(c.reason) : ''])]), 'text/csv;charset=utf-8');
    showToast(`${list.length}장을 CSV로 내보냈어요`, 'success');
  }

  /* ---------- 복습 세션 ---------- */
  const S = () => state.session;
  // 하던 복습(pendingSession)이 남아 있으면 다른 복습을 시작하기 전에 확인한다
  async function confirmNewSession() {
    const p = state.data.pendingSession, remain = p ? p.remainingCardIds.filter(cardById).length : 0;
    if (!p || !remain || !(p.results || []).length) return true;
    return showModal({ title: '하던 복습이 남아 있어요', body: `<p>아직 마치지 않은 복습(남은 <b>${remain}장</b>)이 있어요. 새 복습을 시작하면 그 진행 요약은 사라져요. 이미 처리한 카드의 상자 이동은 그대로 남아요.</p>`, confirmText: '새로 시작', danger: true });
  }
  function startSession(kind, ids, resume) {
    if (!ids.length) return showToast('복습할 카드가 없어요', 'warn');
    const pend = resume ? state.data.pendingSession : null;
    // done: 이어서 하기 전에 이미 처리한 장수(진행 표시 '현재/전체'의 기준). ids는 남은 카드
    state.session = { kind, ids, idx: 0, done: pend ? pend.results.length : 0, results: pend ? pend.results : [], conf: null, flipped: false, hint: false, awaitingReason: false, busy: false, date: pend ? pend.startedDate : today, startedAt: pend ? pend.startedAt : new Date().toISOString() };
    if (!resume) state.data.pendingSession = { startedDate: today, kind, remainingCardIds: ids.slice(), results: [], startedAt: state.session.startedAt };
    saveData(); $('#session').hidden = false; document.body.classList.add('modal-open'); renderSession();
  }
  const currentCard = () => (S() ? cardById(S().ids[S().idx]) : null);
  const faceCls = t => 'face-text' + (t.length > 60 ? ' long' : '');
  function renderSession() {
    const s = S(), c = currentCard(); if (!c) return finishSession();
    const total = s.done + s.ids.length, cur = s.done + s.idx + 1, d = deckById(c.deckId) || {};
    $('#session').innerHTML = `<div class="session-top"><button class="icon-btn" data-action="end-session" aria-label="세션 종료">✕</button><div class="progress" aria-label="진행"><i style="width:${pct(cur - 1, total)}%"></i></div><span class="num small"><b>${cur}</b> / ${total}</span></div>
      <div class="mini-boxes" id="mini-boxes">${boxCounts().map((n, i) => `<div class="mini-box box-${i + 1}" data-box="${i + 1}"><b class="num">${n}</b>${i + 1}상자</div>`).join('')}</div>
      <div class="flip-wrap" id="flip-wrap"><div class="flip-card" id="flip-card">
        <div class="face face-front"><div class="face-tag"><span class="subj-dot ${deckClass(d)}"></span>${escapeHtml(d.name || '')}${d.unit ? ' · ' + escapeHtml(d.unit) : ''}${c.type === 'wrong' ? '<span class="badge badge-wrong">오답</span>' : ''}${isRepeat(c) ? '<span class="badge badge-repeat">같은 이유로 3번</span>' : ''}</div><div class="${faceCls(c.front)}">${escapeHtml(c.front)}</div><div class="small muted" style="text-align:center">${c.box}상자 · 얼마나 확실한지 고르고 뒤집어요</div></div>
        <div class="face face-back"><div class="face-tag">정답</div><div class="${faceCls(c.back)}">${escapeHtml(c.back)}</div><div class="face-extra">${c.type === 'wrong' && c.myAnswer ? `<div><b>내 답:</b> <s>${escapeHtml(c.myAnswer)}</s></div>` : ''}<div id="hint-line" hidden><b>힌트:</b> ${escapeHtml(c.hint || '없음')}</div>${c.note ? `<div><b>조심할 점:</b> ${escapeHtml(c.note)}</div>` : ''}${isDrawing(c.drawing) ? `<img class="drawing" src="${escapeHtml(c.drawing)}" alt="손그림">` : ''}</div></div>
      </div></div>
      <div class="session-actions">
        <div class="conf-btns" id="conf-btns">${[1, 2, 3].map(k => `<button class="btn" data-action="conf" data-c="${k}" aria-pressed="false">${k === 3 ? '😊' : k === 2 ? '🤔' : '😵'} ${APP_DATA.CONF[k]}</button>`).join('')}</div>
        <button class="btn btn-primary btn-lg" id="flip-btn" data-action="flip" disabled>뒤집기</button>
        <div id="after-flip" hidden><div class="row spread" style="margin-bottom:8px"><button class="btn btn-sm" data-action="hint" ${c.hint ? '' : 'disabled'}>💡 힌트 보기</button><span class="small muted">← 왼쪽으로 밀면 틀림 · 오른쪽으로 밀면 맞음 →</span></div>
          <div class="grade-btns" id="grade-btns"><button class="btn btn-danger btn-lg" data-action="grade" data-ok="0">✗ 틀렸어요</button><button class="btn btn-ok btn-lg" data-action="grade" data-ok="1">✓ 맞았어요</button></div>
          <div class="reason-panel" id="reason-panel" hidden><b>왜 틀렸을까요? 하나를 골라요</b><div class="chips">${REASONS.map(r => `<button class="chip-btn" data-action="pick-reason" data-reason="${r.key}">${r.label}</button>`).join('')}</div></div></div>
        <div class="kbd-hint"><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 확신도</span><span><kbd>Space</kbd> 뒤집기</span><span><kbd>←</kbd> 틀림</span><span><kbd>→</kbd> 맞음</span><span><kbd>Esc</kbd> 종료</span></div>
      </div>`;
    Object.assign(s, { conf: null, flipped: false, hint: false, awaitingReason: false, busy: false });
    wireSwipe($('#flip-wrap'));
  }
  function chooseConf(c) { const s = S(); if (!s || s.flipped || s.busy) return; s.conf = c; $$('#conf-btns .btn').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.c) === c))); $('#flip-btn').disabled = false; }
  function flipCard() { const s = S(); if (!s || !s.conf || s.flipped || s.busy) return; s.flipped = true; $('#flip-card').classList.add('flipped'); $('#flip-btn').hidden = true; $('#conf-btns').hidden = true; $('#after-flip').hidden = false; }
  function toggleHint() { const el = $('#hint-line'); if (el) el.hidden = !el.hidden; }
  function grade(ok) {
    const s = S(); if (!s || !s.flipped || s.awaitingReason || s.busy) return; const c = currentCard(); if (!c) return;
    if (!ok && c.type === 'wrong') { s.awaitingReason = true; $('#grade-btns').hidden = true; $('#reason-panel').hidden = false; return; }
    finalizeGrade(ok, null);
  }
  function pickReason(r) { const s = S(); if (!s || !s.awaitingReason || s.busy) return; s.awaitingReason = false; finalizeGrade(false, r); }
  // 상자 이동 적용 → 기록 → 애니메이션 → 다음 카드. 애니메이션 동안(busy) 키·스와이프·버튼 입력은 모두 무시한다
  function finalizeGrade(ok, reason) {
    const s = S(), c = currentCard(); if (!s || !c || s.busy) return;
    s.busy = true; s.flipped = false;
    const now = todayStr(), from = c.box;
    const mv = applyGrade(c, ok, s.conf, now, reason);
    const log = state.data.dailyLog[now] || (state.data.dailyLog[now] = { reviewed: 0, correct: 0 }); log.reviewed++; if (ok) log.correct++;
    s.results.push({ cardId: c.id, front: c.front, ok, c: s.conf, from, to: mv.to, reason: ok ? null : (c.type === 'wrong' ? c.reason : 'unknown'), repeat: isRepeat(c), wrongType: c.type === 'wrong' });
    const pend = state.data.pendingSession; if (pend) { pend.remainingCardIds = pend.remainingCardIds.filter(id => id !== c.id); pend.results = s.results; }
    saveData();
    const target = $(`#mini-boxes [data-box="${mv.to}"]`);
    $$('#mini-boxes .mini-box').forEach((el, i) => { el.querySelector('b').textContent = boxCounts()[i]; });
    if (target) { target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); }
    const animate = !reduceMotion() && target;
    if (animate) { const from = $('#flip-card').getBoundingClientRect(), to = target.getBoundingClientRect(), fly = document.createElement('div'); fly.className = 'fly'; fly.style.left = (from.left + from.width / 2 - 45) + 'px'; fly.style.top = (from.top + from.height / 2 - 30) + 'px'; document.body.appendChild(fly); requestAnimationFrame(() => { fly.style.transform = `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(.3)`; fly.style.opacity = '0'; }); setTimeout(() => fly.remove(), 450); }
    $('#after-flip').hidden = true;
    s.idx++;
    setTimeout(() => { if (S() !== s) return; if (s.idx >= s.ids.length) finishSession(); else renderSession(); }, animate ? 420 : 0);
  }
  // 스와이프: 뒤집힌 뒤 가로 60px 이상(세로 우세 시 무시)
  function wireSwipe(el) {
    let sx = 0, sy = 0, active = false;
    el.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; active = true; });
    el.addEventListener('pointerup', e => { if (!active) return; active = false; const dx = e.clientX - sx, dy = e.clientY - sy; if (!S() || !S().flipped || S().busy || Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return; grade(dx > 0); });
  }
  function endSession(silent) {
    const s = S(); if (!s) return; const pend = state.data.pendingSession;
    if (pend && !pend.remainingCardIds.length) state.data.pendingSession = null;
    if (pend && !s.results.length) state.data.pendingSession = null;
    state.session = null; $('#session').hidden = true; document.body.classList.remove('modal-open'); saveData();
    if (!silent) showToast(state.data.pendingSession ? '진행 상황을 저장했어요. 홈에서 이어서 할 수 있어요.' : '복습을 마쳤어요', 'info'); render();
  }
  // 코칭 문장 규칙 R1~R6
  function coachingText(st, tomorrow) {
    const r = st.reasons, top = REASON_KEYS.reduce((a, k) => (r[k] > (r[a] || 0) ? k : a), 'concept');
    if (st.count >= 4 && st.quadrants.lucky / st.count >= 0.3) return `운 좋게 맞힌 카드가 ${st.quadrants.lucky}장이에요. 확실해질 때까지 상자에 머물러요. 뒤집기 전에 답을 소리 내어 말해 보세요.`;
    if (st.quadrants.illusion >= 2) return `확실하다고 했는데 틀린 카드가 ${st.quadrants.illusion}장. 비슷한 것과 헷갈리는지 짝지어 비교해 보세요.`;
    if (st.repeatFront) return `‘${st.repeatFront}’ 카드는 같은 이유로 3번 틀렸어요. 선생님께 질문 카드로 가져가 보세요.`;
    if (st.fail >= 2 && r[top] / st.fail >= 0.5) return { calc: '계산 실수가 많았어요. 풀고 나서 거꾸로 검산하는 습관을 들여요.', concept: '개념이 헷갈렸어요. 교과서 해당 쪽을 다시 읽고 예시를 하나 더 만들어 보세요.', misread: '문제를 잘못 읽은 경우가 많아요. 문제 조건에 밑줄 치고 묻는 것에 동그라미!', time: '시간이 부족했어요. 쉬운 카드부터, 막히면 넘기기.', unknown: '모르는 낱말이 많았어요. 모르는 낱말은 힌트 칸에 뜻을 적어 두세요.' }[top];
    if (st.count >= 5 && st.ok / st.count >= 0.9) return `오늘 ${st.count}장 중 ${st.ok}장 기억! 내일은 ${tomorrow}장이 기다려요.`;
    return `오늘 ${st.count}장 복습 완료. ${st.moves.up}장이 다음 상자로, ${st.moves.down}장이 1상자로 갔어요. 내일 ${tomorrow}장.`;
  }
  async function finishSession() {
    const s = S(); if (!s) return; const res = s.results;
    const st = { count: res.length, ok: res.filter(r => r.ok).length, fail: res.filter(r => !r.ok).length, quadrants: { know: 0, lucky: 0, illusion: 0, aware: 0 }, moves: { up: 0, down: 0, stay: 0 }, reasons: { concept: 0, misread: 0, calc: 0, time: 0, unknown: 0 }, repeatFront: null };
    res.forEach(r => { st.quadrants[quadrantOf(r.ok, r.c)]++; st.moves[r.to > r.from ? 'up' : r.to < r.from ? 'down' : 'stay']++; if (!r.ok && r.reason) st.reasons[r.reason]++; if (r.repeat && !r.ok && !st.repeatFront) st.repeatFront = r.front; });
    const tomorrow = cards().filter(c => c.due <= addDays(today, 1)).length;
    const sess = { id: uid(), date: s.date, startedAt: s.startedAt, endedAt: new Date().toISOString(), count: st.count, ok: st.ok, fail: st.fail, quadrants: st.quadrants, moves: st.moves, reasons: st.reasons, coaching: coachingText(st, tomorrow), reflectionId: null, kind: s.kind };
    state.data.sessions = [sess, ...state.data.sessions].slice(0, 200); state.data.pendingSession = null;
    state.session = null; $('#session').hidden = true; document.body.classList.remove('modal-open'); saveData();
    if (!st.count) { render(); return; }
    const body = document.createElement('div'); body.className = 'list';
    const cell = (k, cls) => { const list = res.filter(r => quadrantOf(r.ok, r.c) === k); return `<div role="button" tabindex="0" class="quad-cell quad-${cls}" data-q="${k}" aria-expanded="false"><b class="num">${st.quadrants[k]}</b><span>${APP_DATA.QUAD[k]}</span><small>${k === 'know' ? '확신 + 맞음' : k === 'lucky' ? '애매·모름 + 맞음' : k === 'illusion' ? '확신 + 틀림' : '애매·모름 + 틀림'}</small><ul class="quad-list" hidden>${list.map(r => `<li>${escapeHtml(truncate(r.front, 40))}</li>`).join('') || '<li>없음</li>'}</ul></div>`; };
    body.innerHTML = `<p class="hero-title" style="font-size:1.6rem">오늘 ${st.count}장 중 ${st.ok}장 기억</p><div class="quad">${cell('know', 'know')}${cell('lucky', 'lucky')}${cell('illusion', 'illusion')}${cell('aware', 'aware')}</div>
      <div class="row small muted"><span>↑ 다음 상자로 ${st.moves.up}장</span><span>↓ 1상자로 ${st.moves.down}장</span><span>→ 제자리 ${st.moves.stay}장</span><span>내일 예정 ${tomorrow}장</span></div><div class="coach" id="coach-line">${escapeHtml(sess.coaching)}</div>
      <div class="field"><label for="reflect-in">오늘 가장 헷갈린 것 한 줄</label><input class="input" id="reflect-in" maxlength="${LIMITS.reflect}" placeholder="예) 통분 후 분자만 더하기"><div class="counter" id="reflect-cnt">0/${LIMITS.reflect}</div></div>`;
    body.addEventListener('click', e => { const q = e.target.closest('.quad-cell'); if (!q) return; const ul = $('.quad-list', q); ul.hidden = !ul.hidden; q.setAttribute('aria-expanded', String(!ul.hidden)); });
    body.addEventListener('input', () => { $('#reflect-cnt', body).textContent = `${$('#reflect-in', body).value.length}/${LIMITS.reflect}`; });
    const v = await showModal({ title: '복습 끝! 오늘의 되새김', body, buttons: [{ text: '건너뛰기', value: 'skip', kind: 'ghost' }, { text: '저장하고 홈으로', value: true, kind: 'primary' }], backdrop: false });
    const text = $('#reflect-in', body).value.trim();
    if (v === true && text) { const r = { id: uid(), date: todayStr(), sessionId: sess.id, text }; state.data.reflections.unshift(r); sess.reflectionId = r.id; saveData(); showToast('되새김 한 줄을 기록했어요', 'success'); }
    state.view = 'home'; render();
  }

  /* ---------- 기록 대시보드(SVG 차트) ---------- */
  const svgEsc = escapeHtml;
  function renderCalendar() {
    const cells = []; const start = addDays(today, -83), startDow = parseYmd(start).getDay();
    const level = n => (n <= 0 ? 0 : n < 5 ? 1 : n < 10 ? 2 : n < 20 ? 3 : 4);
    const cols = Math.ceil((83 + startDow + 1) / 7), cw = 14, gap = 3, W = cols * (cw + gap) + 30, H = 7 * (cw + gap) + 18;
    let filled = 0;
    for (let i = 0; i < 84; i++) { const d = addDays(start, i), k = i + startDow, x = 30 + Math.floor(k / 7) * (cw + gap), y = 16 + (k % 7) * (cw + gap), n = d <= today ? reviewedOn(d) : 0; if (n) filled++; cells.push(`<rect class="cal-cell g${level(n)}" x="${x}" y="${y}" width="${cw}" height="${cw}" data-action="cal-cell" data-d="${d}" data-n="${n}"><title>${fmtMd(d)}(${weekdayKo(d)}) ${n}장</title></rect>`); }
    const months = []; let lastM = '', lastCol = -9; for (let i = 0; i < 84; i += 7) { const d = addDays(start, i), m = d.slice(5, 7), col = Math.floor((i + startDow) / 7); if (m !== lastM && col - lastCol >= 2) { months.push(`<text class="cal-lbl" x="${30 + col * (cw + gap)}" y="10">${Number(m)}월</text>`); lastM = m; lastCol = col; } }
    return { svg: `<svg class="svg-cal" viewBox="0 0 ${W} ${H}" role="img" aria-label="지난 12주 복습 달력">${months.join('')}${['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (i % 2 ? `<text class="cal-lbl" x="8" y="${16 + i * (cw + gap) + 11}">${w}</text>` : '')).join('')}${cells.join('')}</svg>`, filled };
  }
  function renderBars() {
    const bc = boxCounts(), max = Math.max(1, ...bc), W = 320, H = 150, bw = 44;
    return `<svg class="svg-bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="상자별 카드 분포">${bc.map((n, i) => { const h = (n / max) * 100, x = 20 + i * 60; return `<rect x="${x}" y="${120 - h}" width="${bw}" height="${h}" rx="6" style="fill:var(--box-${i + 1});stroke:var(--line)"/><text class="lbl-strong" x="${x + bw / 2}" y="${114 - h}" text-anchor="middle">${n}</text><text x="${x + bw / 2}" y="138" text-anchor="middle">${i + 1}상자${i === 4 ? ' ★' + cards().filter(c => c.mastered).length : ''}</text>`; }).join('')}<line class="axis" x1="10" y1="120.5" x2="310" y2="120.5"/></svg>`;
  }
  function renderDonut() {
    const counts = { concept: 0, misread: 0, calc: 0, time: 0, unknown: 0 };
    cards().filter(c => c.type === 'wrong').forEach(c => (c.failReasons || []).forEach(k => { if (k in counts) counts[k]++; }));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!total) return '<div class="empty"><strong>아직 오답 기록이 없어요</strong><p>오답 카드를 만들고 복습하면 원인이 모여요.</p></div>';
    let a0 = -Math.PI / 2; const R = 60, r = 38, cx = 80, cy = 80;
    const arcs = REASON_KEYS.map((k, i) => { const v = counts[k]; if (!v) return ''; const a1 = a0 + (v / total) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0; const p = [cx + R * Math.cos(a0), cy + R * Math.sin(a0), cx + R * Math.cos(a1), cy + R * Math.sin(a1), cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a0), cy + r * Math.sin(a0)].map(n => n.toFixed(1)); const d = v === total ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="var(--chart-${i + 1})" stroke-width="${R - r}"/>` : `<path d="M${p[0]},${p[1]} A${R},${R} 0 ${big},1 ${p[2]},${p[3]} L${p[4]},${p[5]} A${r},${r} 0 ${big},0 ${p[6]},${p[7]} Z" fill="var(--chart-${i + 1})"><title>${reasonLabel(k)} ${v}회</title></path>`; a0 = a1; return d; }).join('');
    const top = REASON_KEYS.reduce((a, k) => (counts[k] > counts[a] ? k : a), 'concept');
    return `<svg viewBox="0 0 160 160" role="img" aria-label="오답 원인 비율" style="max-width:220px;margin:0 auto">${arcs}<text class="donut-center" x="80" y="76" text-anchor="middle">${svgEsc(reasonShort(top))}</text><text class="donut-center" x="80" y="96" text-anchor="middle">${pct(counts[top], total)}%</text></svg><div class="legend">${REASON_KEYS.map((k, i) => `<span><i style="background:var(--chart-${i + 1})"></i>${reasonLabel(k)} ${counts[k]}</span>`).join('')}</div>`;
  }
  // 망각 예측: 앞으로 7일간 '오늘 복습하면' vs '지금 복습 안 하면'
  function forecastData() {
    const q = new Set(todayQueue().map(c => c.id)), noR = [], withR = [];
    for (let k = 0; k <= 7; k++) { const lim = addDays(today, k); noR.push(cards().filter(c => c.due <= lim).length); withR.push(cards().filter(c => { if (!q.has(c.id)) return c.due <= lim; const nb = Math.min(5, c.box + 1); return addDays(today, c.box >= 5 ? 30 : INTERVALS[nb]) <= lim; }).length); }
    return { noR, withR };
  }
  function renderForecast() {
    const { noR, withR } = forecastData(), same = noR.join() === withR.join(), showNo = state.forecastToggle; // 두 선이 같으면(오늘 큐 0장) 점선을 실선 위에 겹쳐 그리고 설명을 덧붙인다
    const max = Math.max(1, ...noR, ...withR), W = 376, H = 170, x = k => 36 + k * 40, y = v => 140 - (v / max) * 110;
    const line = arr => arr.map((v, k) => `${k ? 'L' : 'M'}${x(k)},${y(v).toFixed(1)}`).join(' ');
    return `<svg class="svg-line" viewBox="0 0 ${W} ${H}" role="img" aria-label="망각 예측"><line class="axis" x1="30" y1="140.5" x2="330" y2="140.5"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<text x="${x(k)}" y="158" text-anchor="middle">${k === 0 ? '오늘' : '+' + k}</text>`).join('')}
      <path d="${line(withR)}" fill="none" stroke="var(--chart-1)" stroke-width="2.5"/>${withR.map((v, k) => `<circle cx="${x(k)}" cy="${y(v)}" r="3" fill="var(--chart-1)"/>`).join('')}<text class="lbl-strong" x="${x(7) + 8}" y="${y(withR[7]) + 5}" text-anchor="start" style="fill:var(--chart-1)">${withR[7]}장</text>
      ${showNo ? `<path d="${line(noR)}" fill="none" stroke="var(--chart-2)" stroke-width="2.5" stroke-dasharray="6 4"/>${noR.map((v, k) => `<circle cx="${x(k)}" cy="${y(v)}" r="3" fill="var(--chart-2)"/>`).join('')}<text class="lbl-strong" x="${x(7)}" y="${y(noR[7]) - 10}" text-anchor="end" style="fill:var(--chart-2);font-size:14px">7일 뒤 ${noR[7]}장</text>` : ''}</svg>
      <div class="legend"><span><i style="background:var(--chart-1)"></i>오늘 복습하면 밀리는 카드</span>${state.forecastToggle ? '<span><i style="background:var(--chart-2)"></i>복습 안 하면 밀리는 카드</span>' : ''}</div>${state.forecastToggle && same ? '<p class="small muted">오늘 복습을 다 해서 두 선이 같아요(점선이 실선 위에 겹쳐 보여요). 내일 다시 확인해 보세요.</p>' : ''}`;
  }
  views.history = () => {
    const mon = mondayOf(today); let wk = 0, wkOk = 0; for (let d = mon; d <= today; d = addDays(d, 1)) { const l = state.data.dailyLog[d]; if (l) { wk += l.reviewed; wkOk += l.correct; } }
    const q30 = { know: 0, lucky: 0, illusion: 0, aware: 0 }; state.data.sessions.filter(s => s.date >= addDays(today, -30)).forEach(s => Object.keys(q30).forEach(k => { q30[k] += s.quadrants[k] || 0; })); const q30t = Object.values(q30).reduce((a, b) => a + b, 0);
    const subj = {}; cards().forEach(c => { const d = deckById(c.deckId); if (!d) return; const s = subj[d.subject] || (subj[d.subject] = { t: 0, m: 0 }); s.t++; if (c.box >= 4) s.m++; });
    const cal = renderCalendar(), noCards = !cards().length;
    $('#view-history').innerHTML = `<div class="panel-head"><h2>기록</h2><button class="btn btn-sm" data-action="weekly-report" ${noCards ? 'disabled' : ''}>이번 주 리포트</button></div>
      <div class="grid-4"><div class="panel stat"><b class="num">${streak()}일</b><span>현재 스트릭</span></div><div class="panel stat"><b class="num">${wk}장</b><span>이번 주 복습 · 정답률 ${pct(wkOk, wk)}%</span></div><div class="panel stat"><b class="num">${pct(q30.know, q30t)}%</b><span>최근 30일 ‘알고 맞힘’ · 운 ${pct(q30.lucky, q30t)}% · 착각 ${pct(q30.illusion, q30t)}% · 모르는 걸 알았어 ${pct(q30.aware, q30t)}%</span></div><div class="panel stat"><b class="num">${pct(cards().filter(c => c.box >= 4).length, cards().length)}%</b><span>숙달(4·5상자) · ${Object.entries(subj).map(([k, v]) => `${k} ${pct(v.m, v.t)}%`).join(' · ') || '카드 없음'}</span></div></div>
      <div class="panel chart"><div class="panel-head"><h3>지난 12주 복습 달력</h3><span class="legend"><span>적음</span><i style="background:var(--grass-0)"></i><i style="background:var(--grass-1)"></i><i style="background:var(--grass-2)"></i><i style="background:var(--grass-3)"></i><i style="background:var(--grass-4)"></i><span>많음 (0 · 1~4 · 5~9 · 10~19 · 20+)</span></span></div>${cal.svg}<p class="cal-tip" id="cal-tip">셀을 누르면 날짜와 장수가 보여요 · 기록 있는 날 ${cal.filled}일</p></div>
      <div class="grid-2"><div class="panel chart"><h3>상자별 카드 분포</h3>${noCards ? '<div class="empty"><strong>카드가 없어요</strong></div>' : renderBars()}</div><div class="panel chart"><h3>오답 원인</h3>${renderDonut()}</div></div>
      <div class="panel chart"><div class="panel-head"><h3>망각 예측(7일)</h3><label class="switch"><input type="checkbox" id="forecast-toggle" data-action="forecast-toggle" ${state.forecastToggle ? 'checked' : ''}><span>지금 복습 안 하면</span></label></div><div id="forecast-wrap">${noCards ? '<div class="empty"><strong>카드가 없어요</strong></div>' : renderForecast()}</div></div>
      <div class="panel"><h3>되새김 한 줄</h3><div id="reflect-list">${sortedReflections().slice(0, 20).map(r => { const s = state.data.sessions.find(x => x.id === r.sessionId); return `<div class="reflect-item"><span class="small muted">${escapeHtml(r.date)}${s ? ` · ${s.count}장 중 ${s.ok}장 기억` : ''}</span><q>${escapeHtml(r.text)}</q></div>`; }).join('') || '<p class="muted">복습을 마치면 ‘오늘 가장 헷갈린 것 한 줄’을 적을 수 있어요.</p>'}</div></div>`;
  }
  // 주간 리포트(A5) 미리보기
  function weeklyReport() {
    const mon = mondayOf(today), days = [...Array(7)].map((_, i) => addDays(mon, i)); let tot = 0, ok = 0;
    const reasons = { concept: 0, misread: 0, calc: 0, time: 0, unknown: 0 }; state.data.sessions.filter(s => s.date >= mon).forEach(s => REASON_KEYS.forEach(k => { reasons[k] += s.reasons[k] || 0; }));
    const top = REASON_KEYS.reduce((a, k) => (reasons[k] > reasons[a] ? k : a), 'concept');
    // 새로 숙달: 5상자에서 '확실·맞음'으로 처음 별을 받은 날이 이번 주인 카드
    const mastered = cards().filter(c => { if (!c.mastered) return false; const h = (c.history || []).find(x => x.r === 'ok' && x.c === 3 && x.from === 5 && x.to === 5); return !!h && h.d >= mon; }).length;
    const checked = state.data.weeklyChecks.includes(isoWeekKey(today));
    openPrintView(`<div class="page a5"><div class="page-title"><b>기억상자 주간 리포트</b><span>${escapeHtml(profile().name)} · ${fmtMd(mon)}~${fmtMd(days[6])}</span></div>
      <table class="tbl"><tr>${days.map(d => `<th style="text-align:center">${weekdayKo(d)}</th>`).join('')}</tr><tr>${days.map(d => { const n = d <= today ? reviewedOn(d) : 0; tot += n; ok += ((state.data.dailyLog[d] || {}).correct || 0); return `<td class="num" style="text-align:center">${n}</td>`; }).join('')}</tr></table>
      <p>이번 주 복습 <b>${tot}장</b> · 정답률 <b>${pct(ok, tot)}%</b> · 가장 많이 틀린 원인 <b>${reasons[top] ? reasonLabel(top) : '없음'}</b> · 새로 숙달 <b>${mastered}장</b></p>
      <h3>되새김 한 줄</h3><ul>${sortedReflections().filter(r => r.date >= mon).map(r => `<li>${escapeHtml(r.text)}</li>`).join('') || '<li>없음</li>'}</ul>
      <p class="page-foot">보호자 확인 ☐ &nbsp; 날짜: ________ &nbsp; 서명: ________${checked ? ' (앱에서 확인됨)' : ''}</p></div>`,
      { extra: `<label class="switch"><input type="checkbox" id="weekly-check" data-action="weekly-check" ${checked ? 'checked' : ''}><span>보호자 확인</span></label>`, hint: '인쇄 설정: 여백 없음 · A5 또는 A4에 맞춤' });
  }

  /* ---------- 시험 D-Day ---------- */
  views.exam = () => {
    state.data.exams.forEach(e => { if (e.date < today) e.status = 'done'; });
    const list = state.data.exams.slice().sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.date.localeCompare(b.date));
    $('#view-exam').innerHTML = `<div class="panel-head"><h2>시험 준비</h2><button class="btn btn-primary btn-sm" data-action="new-exam" ${decks().length ? '' : 'disabled'}>+ 시험</button></div>
      ${list.map(e => { const dn = diffDays(today, e.date), target = cards().filter(c => e.deckIds.includes(c.deckId)), remain = target.filter(c => c.due < e.date && c.due <= today).length, live = examPlanLive(e); const days = []; for (let d = today; d < e.date; d = addDays(d, 1)) days.push(d);
        return `<div class="panel" data-exam="${escapeHtml(e.id)}"><div class="panel-head"><div><h3>${e.status === 'done' ? '<span class="badge">시험 끝</span> ' : `<span class="badge badge-box dday-badge">D-${dn || 'Day'}</span> `}${escapeHtml(e.title)}</h3><p class="small muted">${escapeHtml(e.date)}(${weekdayKo(e.date)}) · 덱: ${e.deckIds.map(id => escapeHtml((deckById(id) || {}).name || '삭제된 덱')).join(', ')} · 카드 ${target.length}장 · 오늘까지 남은 ${remain}장</p></div>
          <div class="row">${e.status === 'done' ? `<button class="btn btn-sm btn-primary" data-action="exam-wrong" data-id="${escapeHtml(e.id)}">시험에서 틀린 문제 추가</button>` : `<button class="btn btn-sm" data-action="exam-regen" data-id="${escapeHtml(e.id)}">다시 생성</button>`}<button class="btn btn-sm btn-ghost" data-action="exam-delete" data-id="${escapeHtml(e.id)}">삭제</button></div></div>
          ${e.status === 'done' ? '' : `<div class="plan-cal" id="plan-${escapeHtml(e.id)}">${days.map(d => `<div class="plan-day ${d === today ? 'today' : ''}"><span>${fmtMd(d)}</span><b class="num">${live[d] || 0}</b><span>${weekdayKo(d)}</span></div>`).join('')}</div>`}</div>`; }).join('') || `<div class="empty panel"><strong>예정된 시험이 없어요</strong><p>시험 이름과 날짜, 덱을 고르면 복습 계획을 시험 전날까지 나눠 드려요.</p></div>`}`;
  };
  function openExamModal() {
    const body = document.createElement('div'); body.className = 'list'; const min = addDays(today, 1);
    body.innerHTML = `<div class="field"><label for="ex-title">시험 이름</label><input class="input" id="ex-title" maxlength="40" autofocus placeholder="예) 수학 5단원 단원평가"></div><div class="field"><label for="ex-date">시험 날짜(내일 이후)</label><input class="input" id="ex-date" type="date" min="${min}" value="${addDays(today, 7)}"></div>
      <div class="field"><span class="field-label">포함할 덱</span><div class="chips">${decks().map(d => `<button type="button" class="chip-btn" data-deck="${escapeHtml(d.id)}" aria-pressed="false">${escapeHtml(d.name)} (${cards().filter(c => c.deckId === d.id).length})</button>`).join('')}</div></div><p class="err" id="ex-err"></p>`;
    const sel = new Set(); let btn;
    const validate = () => { const okAll = $('#ex-title', body).value.trim() && $('#ex-date', body).value > today && sel.size; if (btn) btn.disabled = !okAll; };
    body.addEventListener('input', validate);
    body.addEventListener('click', e => { const b = e.target.closest('[data-deck]'); if (!b) return; const id = b.dataset.deck; sel.has(id) ? sel.delete(id) : sel.add(id); b.setAttribute('aria-pressed', String(sel.has(id))); validate(); });
    showModal({ title: '새 시험', body, confirmText: '저장하고 계획 만들기', onOpen: box => { btn = $('[data-value="true"]', box); validate(); }, beforeClose: v => { if (v !== true) return; const date = $('#ex-date', body).value; if (!(date > today)) { $('#ex-err', body).textContent = '시험 날짜는 내일 이후여야 해요.'; return false; } if (!sel.size) { $('#ex-err', body).textContent = '덱을 하나 이상 골라 주세요.'; return false; } } })
      .then(v => { if (v !== true) return; const ex = { id: uid(), title: $('#ex-title', body).value.trim(), date: $('#ex-date', body).value, deckIds: [...sel], createdAt: today, plan: {}, status: 'active' }; regenExam(ex); state.data.exams.push(ex); saveData(); render(); });
  }
  function regenExam(ex) { ex.plan = applyExamPlan(cards(), ex.deckIds, ex.date, today); const n = Object.values(ex.plan).reduce((a, b) => a + b, 0); showToast(`${n}장을 ${diffDays(today, ex.date)}일에 나눴어요`, 'success'); }

  /* ---------- 인쇄 ---------- */
  const printCards = () => cards().filter(c => state.print.deckIds.includes(c.deckId) && c.box <= state.print.boxMax && (state.print.type === 'all' || c.type === state.print.type)).sort((a, b) => a.box - b.box || a.createdAt.localeCompare(b.createdAt));
  views.print = () => {
    const p = state.print; p.deckIds = p.deckIds.filter(deckById); const n = printCards().length;
    $('#view-print').innerHTML = `<div class="panel-head"><h2>인쇄</h2><span class="small muted">선택 ${n}장</span></div>
      <div class="panel list"><span class="field-label">1. 덱 고르기</span><div class="chips">${decks().map(d => `<button class="chip-btn" data-action="print-deck" data-id="${escapeHtml(d.id)}" aria-pressed="${p.deckIds.includes(d.id)}">${escapeHtml(d.name)}</button>`).join('') || '<span class="muted">덱이 없어요</span>'}</div>
        <div class="field-row"><div class="field"><label for="print-box">상자 범위: <b id="print-box-label">${p.boxMax}상자 이하</b></label><input type="range" id="print-box" min="1" max="5" value="${p.boxMax}"></div><div class="field"><span class="field-label">유형</span><div class="seg">${[['all', '전체'], ['memo', '암기'], ['wrong', '오답']].map(([k, l]) => `<button data-action="print-type" data-val="${k}" aria-pressed="${p.type === k}">${l}</button>`).join('')}</div></div></div></div>
      <div class="panel list"><span class="field-label">2. 레이아웃</span><div class="seg">${[['cards', '암기카드 양면(2×4)'], ['sheet', '다시풀기 학습지']].map(([k, l]) => `<button data-action="print-layout" data-val="${k}" aria-pressed="${p.layout === k}">${l}</button>`).join('')}</div>
        <div class="row">${[['hint', '힌트 포함'], ['drawing', '손그림 포함'], ['title', '제목·이름 칸']].map(([k, l]) => `<label class="switch"><input type="checkbox" data-action="print-opt" data-key="${k}" ${p[k] ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <p class="small muted">양면 카드는 앞면 페이지 뒤에 뒷면 페이지가 좌우 반전되어 이어져요. 프린터에서 ‘양면 · 긴 쪽 넘김’을 고르면 앞뒤가 맞아요.</p>
        <div class="row"><button class="btn btn-primary btn-lg" data-action="print-preview" ${n ? '' : 'disabled'}>미리보기 (${n}장)</button>${n || !decks().length ? '' : '<span class="small muted">위 ‘1. 덱 고르기’에서 인쇄할 덱을 눌러 고르세요(여러 개 가능).</span>'}</div></div>`;
    $('#print-box').addEventListener('input', e => { p.boxMax = Number(e.target.value); views.print(); });
  };
  const sizeClass = t => (t.length <= 18 ? '' : t.length <= 40 ? 's2' : 's3');
  function buildPrintHtml(list) {
    const p = state.print, name = profile().name, names = decks().filter(d => p.deckIds.includes(d.id)).map(d => d.name);
    const deckTitle = names.length > 2 ? `${names[0]} 외 ${names.length - 1}개 덱` : names.join(', '); // 덱이 많으면 제목 줄을 줄인다
    const head = p.title ? `<div class="page-title"><b>기억상자 · ${escapeHtml(deckTitle)}</b><span>${APP_DATA.school} ${APP_DATA.className} 이름: ${escapeHtml(name)} &nbsp; 날짜: ${today}</span></div>` : '';
    const pages = [];
    if (p.layout === 'cards') {
      for (let i = 0; i < list.length; i += 8) {
        const chunk = list.slice(i, i + 8); while (chunk.length < 8) chunk.push(null);
        const front = c => (c ? `<div class="pcard"><small>${c.box}상자${c.type === 'wrong' ? ' · 오답' : ''}</small><div class="pc-text ${sizeClass(c.front)}">${escapeHtml(truncate(c.front, 120))}</div></div>` : '<div class="pcard"></div>');
        const back = c => (c ? `<div class="pcard"><small>정답</small><div class="pc-text ${sizeClass(c.back)}">${escapeHtml(truncate(c.back, 120))}</div>${p.hint && c.hint ? `<small>힌트: ${escapeHtml(c.hint)}</small>` : ''}${c.note ? `<small>조심: ${escapeHtml(c.note)}</small>` : ''}${p.drawing && isDrawing(c.drawing) ? `<img src="${escapeHtml(c.drawing)}" alt="">` : ''}</div>` : '<div class="pcard"></div>');
        const rows = [[0, 1], [2, 3], [4, 5], [6, 7]];
        pages.push(`<div class="page">${head}<div class="pcards">${rows.map(([a, b]) => front(chunk[a]) + front(chunk[b])).join('')}</div></div>`);
        pages.push(`<div class="page">${head}<div class="pcards">${rows.map(([a, b]) => back(chunk[b]) + back(chunk[a])).join('')}</div></div>`);
      }
    } else {
      for (let i = 0; i < list.length; i += 8) pages.push(`<div class="page">${head}<div class="sheet-q">${list.slice(i, i + 8).map((c, k) => `<div class="sheet-item"><span class="q-no">${i + k + 1}.</span>${escapeHtml(c.front)}${p.hint && c.hint ? ` <small>(힌트: ${escapeHtml(c.hint)})</small>` : ''}</div>`).join('')}</div></div>`);
      pages.push(`<div class="page"><div class="page-title"><b>정답표</b><span>${list.length}문제</span></div><div class="sheet-ans">${list.map((c, k) => `<div><b>${k + 1}.</b> ${escapeHtml(c.back)}${c.type === 'wrong' && c.myAnswer ? ` <small>(내 답: ${escapeHtml(c.myAnswer)})</small>` : ''}</div>`).join('')}</div></div>`);
    }
    return pages.join('');
  }
  const PRINT_HINT = '인쇄 설정: 여백 없음 · 배율 100% · 양면은 ‘긴 쪽 넘김’';
  // 인쇄 미리보기 열기. body.print-mode가 있을 때만 @media print에서 앱 UI를 숨긴다(일반 화면 Ctrl+P는 현재 화면 인쇄)
  function openPrintView(html, opts = {}) {
    $('#print-area').innerHTML = html; $('#print-extra').innerHTML = opts.extra || ''; $('#print-extra').hidden = !opts.extra; $('#print-hint').textContent = opts.hint || PRINT_HINT;
    $('#print-view').hidden = false; document.body.classList.add('modal-open', 'print-mode'); fitPrintPreview(); $('#print-view').scrollTo({ top: 0 }); window.scrollTo({ top: 0 });
  }
  function closePrintView() { $('#print-view').hidden = true; document.body.classList.remove('modal-open', 'print-mode'); $('#print-area').style.zoom = ''; }
  // 좁은 화면에서는 A4/A5 페이지를 화면 폭에 맞게 축소해 보여 준다(인쇄 시에는 CSS에서 원복)
  function fitPrintPreview() {
    const view = $('#print-view'), area = $('#print-area'); if (view.hidden) return;
    area.style.zoom = ''; const w = Math.max(1, ...$$('.page', area).map(p => p.offsetWidth)), z = Math.min(1, (view.clientWidth - 24) / w);
    area.style.zoom = z < 1 ? String(Math.floor(z * 1000) / 1000) : ''; $('#print-scale-note').hidden = z >= 1;
  }
  window.addEventListener('resize', fitPrintPreview);

  /* ---------- 교사 모드 ---------- */
  // 프로필 데이터 → 복습 요약 구조
  function buildSummary(data, name) {
    const since = addDays(today, -30); let rv = 0, ok = 0; Object.entries(data.dailyLog || {}).forEach(([d, l]) => { if (d >= since && d <= today) { rv += l.reviewed; ok += l.correct; } });
    const dk = id => (data.decks || []).find(d => d.id === id) || {};
    let d = (data.dailyLog || {})[today] && data.dailyLog[today].reviewed > 0 ? today : addDays(today, -1), st = 0; while (((data.dailyLog || {})[d] || {}).reviewed > 0) { st++; d = addDays(d, -1); }
    return { type: 'memory-box-summary', version: 1, exportedAt: new Date().toISOString(), student: { name }, decks: (data.decks || []).map(x => ({ name: x.name, subject: x.subject, unit: x.unit || '', total: data.cards.filter(c => c.deckId === x.id).length, boxes: boxCounts(data.cards.filter(c => c.deckId === x.id)) })),
      wrong: data.cards.filter(c => c.type === 'wrong').map(c => { const fails = (c.history || []).filter(h => h.r === 'fail'); return { deck: dk(c.deckId).name || '', unit: dk(c.deckId).unit || '', front: truncate(c.front, 40), reason: c.reason || 'unknown', fails: Math.max(fails.length, (c.failReasons || []).length), lastFail: fails.length ? fails[fails.length - 1].d : c.createdAt }; }),
      stats: { reviewed30d: rv, accuracy30d: pct(ok, rv), streak: st } };
  }
  // 요약 파일 구조 검사·정규화: wrong/decks는 배열이어야 하고 학생 이름이 있어야 한다. 모든 값을 문자열·숫자로 강제(화면에는 숫자만 들어가 XSS 불가)
  function normalizeSummary(sum) {
    if (!sum || typeof sum !== 'object' || !Array.isArray(sum.wrong) || (sum.decks != null && !Array.isArray(sum.decks))) return null;
    const name = String((sum.student && sum.student.name) || sum.studentName || '').trim().slice(0, 40); if (!name) return null;
    const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; }, str = (v, n) => String(v == null ? '' : v).slice(0, n), st = sum.stats && typeof sum.stats === 'object' ? sum.stats : {};
    return { studentName: name, exportedAt: str(sum.exportedAt, 40), importedAt: typeof sum.importedAt === 'string' ? sum.importedAt : new Date().toISOString(),
      decks: (sum.decks || []).filter(d => d && typeof d === 'object').map(d => ({ name: str(d.name, 60), subject: str(d.subject, 10), unit: str(d.unit, 60), total: num(d.total), boxes: Array.isArray(d.boxes) ? d.boxes.slice(0, 5).map(num) : [0, 0, 0, 0, 0] })),
      wrong: sum.wrong.filter(w => w && typeof w === 'object').map(w => ({ deck: str(w.deck, 60), unit: str(w.unit, 60), front: str(w.front, 40), reason: REASON_KEYS.includes(w.reason) ? w.reason : 'unknown', fails: Math.max(1, Math.round(num(w.fails)) || 1), lastFail: str(w.lastFail, 10) })),
      stats: { reviewed30d: num(st.reviewed30d), accuracy30d: num(st.accuracy30d), streak: num(st.streak) } };
  }
  // 백업 파일의 프로필 목록 검사: meta.profiles 배열의 각 항목에 id·name과 profiles[id] 객체가 있어야 한다
  const backupProfiles = obj => (obj && obj.meta && Array.isArray(obj.meta.profiles) && obj.profiles && typeof obj.profiles === 'object' ? obj.meta.profiles.filter((p, i, a) => p && typeof p.id === 'string' && typeof p.name === 'string' && obj.profiles[p.id] && typeof obj.profiles[p.id] === 'object' && a.findIndex(x => x && x.id === p.id) === i) : []);
  // 정규화된 요약을 학생 이름 기준으로 추가·교체(같은 이름은 exportedAt이 최신인 것만)
  function upsertImport(item) {
    const i = state.teacher.imports.findIndex(x => x.studentName === item.studentName);
    if (i >= 0) { if ((state.teacher.imports[i].exportedAt || '') <= item.exportedAt) state.teacher.imports[i] = item; } else state.teacher.imports.push(item);
  }
  async function importTeacherFiles(files) {
    let okN = 0;
    for (const f of files) {
      let obj; try { obj = JSON.parse(await readFileText(f)); } catch (e) { showToast(`${f.name}: JSON을 읽을 수 없어요`, 'error', 3500); continue; }
      if (obj && obj.type === 'memory-box-summary') { const item = normalizeSummary(obj); if (item) { upsertImport(item); okN++; } else showToast(`${f.name}: 요약 파일 형식이 맞지 않아요(wrong 배열·학생 이름 확인)`, 'error', 3500); }
      else if (obj && obj.type === 'memory-box-backup') {
        const ps = backupProfiles(obj); if (!ps.length) { showToast(`${f.name}: 백업 파일에 프로필이 없어요`, 'error', 3500); continue; }
        ps.forEach(p => { const item = normalizeSummary(Object.assign(buildSummary(coerceProfileData(obj.profiles[p.id]), p.name), { exportedAt: obj.exportedAt })); if (item) upsertImport(item); }); okN++;
      } else showToast(`${f.name}: 기억상자 요약/백업 파일이 아니에요`, 'error', 3500);
    }
    if (okN) { saveTeacher(); showToast(`${okN}개 파일에서 학생 자료를 가져왔어요`, 'success'); render(); }
  }
  function teacherAgg() {
    const units = {}, students = {};
    state.teacher.imports.forEach(s => {
      const st = students[s.studentName] = { reasons: { concept: 0, misread: 0, calc: 0, time: 0, unknown: 0 }, total: 0, stats: s.stats || {} };
      (Array.isArray(s.wrong) ? s.wrong : []).forEach(w => { if (!w || typeof w !== 'object') return; const key = w.unit || w.deck || '기타', u = units[key] || (units[key] = { unit: key, names: new Set(), cards: 0, fails: 0, reasons: { concept: 0, misread: 0, calc: 0, time: 0, unknown: 0 }, byReason: {} }); u.names.add(s.studentName); u.cards++; u.fails += Number(w.fails) || 1; const r = w.reason in u.reasons ? w.reason : 'unknown'; u.reasons[r]++; (u.byReason[r] = u.byReason[r] || new Set()).add(s.studentName); st.reasons[r]++; st.total++; });
    });
    const list = Object.values(units).map(u => { const top = REASON_KEYS.reduce((a, k) => (u.reasons[k] > u.reasons[a] ? k : a), 'concept'); return Object.assign(u, { top, topPct: pct(u.reasons[top], u.cards) }); }).sort((a, b) => b.fails - a.fails);
    const focus = { calc: [], concept: [], habit: [] };
    Object.entries(students).forEach(([n, s]) => { if (s.reasons.calc >= 3 && s.reasons.calc / s.total >= 0.5) focus.calc.push(`${n}(계산 ${s.reasons.calc}/${s.total})`); if (s.reasons.concept >= 3 && s.reasons.concept / s.total >= 0.5) focus.concept.push(`${n}(개념 ${s.reasons.concept}/${s.total})`); if ((s.stats.reviewed30d || 0) < 10 || !(s.stats.streak > 0)) focus.habit.push(`${n}(30일 ${s.stats.reviewed30d || 0}장 · 스트릭 ${s.stats.streak || 0})`); });
    return { list, focus };
  }
  views.teacher = () => {
    let agg; try { agg = teacherAgg(); } catch (e) { agg = { list: [], focus: { calc: [], concept: [], habit: [] }, error: true }; } // 집계가 실패해도 화면과 '지우기' 버튼은 남긴다
    const { list, focus } = agg, imps = agg.error ? [] : state.teacher.imports, cell = state.teacherCell, n = v => Number(v) || 0;
    $('#view-teacher').innerHTML = `<div class="panel-head"><div><h2>교사 모드 · 학급 오답 집계</h2><p class="small muted">학생들이 설정에서 내보낸 ‘복습 요약 JSON’을 모아 공통 오답 단원과 원인을 봅니다.</p></div><div class="row"><button class="btn btn-sm" data-action="teacher-sample">샘플 학급 불러오기</button><button class="btn btn-sm" data-action="teacher-template">학급 단어장 CSV 템플릿</button><button class="btn btn-sm" data-action="teacher-csv" ${list.length ? '' : 'disabled'}>집계 CSV 내보내기</button><button class="btn btn-sm btn-ghost" data-action="teacher-clear" ${imps.length || agg.error ? '' : 'disabled'}>교사 데이터 지우기</button></div></div>
      <div class="dropzone" id="teacher-drop"><span>📥 복습 요약 JSON(여러 개 가능)을 끌어 놓거나</span><label class="btn btn-sm">파일 선택<input type="file" accept=".json,application/json" multiple aria-label="요약 JSON 선택"></label><span class="small">전체 백업 파일도 자동 변환돼요 · 같은 이름은 최신 파일로 바뀌어요</span></div>
      ${agg.error ? '<div class="empty panel"><strong>가져온 자료를 집계할 수 없어요</strong><p>저장된 교사 자료가 손상된 것 같아요. ‘교사 데이터 지우기’로 초기화한 뒤 파일을 다시 넣어 주세요.</p></div>' : ''}
      ${imps.length ? `<div class="panel"><h3>가져온 학생 ${imps.length}명</h3><div class="scroll-x"><table class="tbl" id="student-list"><thead><tr><th>이름</th><th>내보낸 날짜</th><th class="num">오답 장수</th><th class="num">30일 복습</th><th class="num">정답률</th><th class="num">스트릭</th><th></th></tr></thead><tbody>${imps.map(s => `<tr><td><b>${escapeHtml(s.studentName)}</b></td><td>${escapeHtml((s.exportedAt || '').slice(0, 10))}</td><td class="num">${(s.wrong || []).length}</td><td class="num">${n((s.stats || {}).reviewed30d)}</td><td class="num">${n((s.stats || {}).accuracy30d)}%</td><td class="num">${n((s.stats || {}).streak)}</td><td><button class="btn btn-sm btn-ghost" data-action="teacher-remove" data-name="${escapeHtml(s.studentName)}">삭제</button></td></tr>`).join('')}</tbody></table></div></div>
      <div class="grid-3" id="point-cards">${list.slice(0, 3).map((u, i) => `<div class="panel point-card"><div class="rank">복습 포인트 ${i + 1}</div><h3>${escapeHtml(u.unit)}</h3><p class="small">${escapeHtml(u.unit)}: ${u.names.size}명 · 오답 ${u.cards}장 · 주 원인 ${reasonLabel(u.top)}(${u.topPct}%)</p><p class="small muted">${{ calc: '검산 습관과 받아내림·통분 과정을 칠판에서 함께 점검해요.', concept: '교과서 개념 쪽을 다시 읽고 예시 문제를 하나 더 풀어요.', misread: '문제 조건에 밑줄 치고 묻는 것에 동그라미 치는 연습을 해요.', time: '쉬운 문제부터 풀고 막히면 넘기는 전략을 안내해요.', unknown: '모르는 낱말·기호의 뜻을 먼저 확인하는 시간을 가져요.' }[u.top]}</p></div>`).join('')}</div>
      <div class="panel"><h3>단원 × 원인</h3><div class="scroll-x"><table class="tbl" id="unit-table"><thead><tr><th>단원</th><th class="num">학생 수</th><th class="num">오답 장수</th>${REASONS.map(r => `<th class="num">${r.short}</th>`).join('')}<th>주 원인</th></tr></thead><tbody>${list.map(u => `<tr><td>${escapeHtml(u.unit)}</td><td class="num">${u.names.size}</td><td class="num">${u.cards}</td>${REASON_KEYS.map(k => `<td class="num ${u.reasons[k] ? 'clickable' : ''}" data-action="teacher-cell" data-unit="${escapeHtml(u.unit)}" data-reason="${k}">${u.reasons[k]}</td>`).join('')}<td>${reasonShort(u.top)} ${u.topPct}%</td></tr>`).join('')}</tbody></table></div><p class="small muted" id="cell-detail">${cell ? `${escapeHtml(cell.unit)} · ${reasonLabel(cell.reason)}: ${escapeHtml(cell.names.join(', '))}` : '숫자 칸을 누르면 해당 학생 이름이 보여요.'}</p></div>
      <div class="grid-3" id="focus-list"><div class="panel"><h3>계산 실수형</h3><p>${focus.calc.map(escapeHtml).join('<br>') || '<span class="muted">없음</span>'}</p></div><div class="panel"><h3>개념 부족형</h3><p>${focus.concept.map(escapeHtml).join('<br>') || '<span class="muted">없음</span>'}</p></div><div class="panel"><h3>복습 습관 점검</h3><p>${focus.habit.map(escapeHtml).join('<br>') || '<span class="muted">없음</span>'}</p></div></div>` : (agg.error ? '' : `<div class="empty panel"><strong>아직 가져온 학생 자료가 없어요</strong><p>‘샘플 학급 불러오기’로 6명 자료를 체험해 보세요.</p></div>`)}`;
    wireDropzone($('#teacher-drop'), importTeacherFiles);
  };

  /* ---------- 설정·데이터 ---------- */
  views.settings = () => {
    const p = profile(), used = storage.usage(), usedKb = Math.round(used / 1024), s = state.meta.settings;
    $('#view-settings').innerHTML = `<h2>설정 · 데이터</h2>
      <div class="panel"><div class="panel-head"><h3>프로필</h3><button class="btn btn-sm btn-primary" data-action="profile-add">+ 프로필</button></div><div class="list">${state.meta.profiles.map(x => `<div class="list-item"><span>${escapeHtml(x.emoji)} <b>${escapeHtml(x.name)}</b> ${x.id === p.id ? '<span class="badge badge-box">사용 중</span>' : ''} <span class="small muted">카드 ${x.id === p.id ? cards().length : (storage.get(KEY.profile(x.id), { cards: [] }).cards || []).length}장 · 목표 ${x.dailyGoal}장</span></span><span class="row">${x.id !== p.id ? `<button class="btn btn-sm" data-action="switch-profile" data-id="${escapeHtml(x.id)}">전환</button>` : ''}<button class="btn btn-sm" data-action="profile-edit" data-id="${escapeHtml(x.id)}">수정</button><button class="btn btn-sm btn-ghost" data-action="profile-delete" data-id="${escapeHtml(x.id)}" ${state.meta.profiles.length <= 1 ? 'disabled title="마지막 프로필은 삭제할 수 없어요"' : ''}>삭제</button></span></div>`).join('')}</div>
        <div class="field" style="max-width:260px;margin-top:12px"><label for="goal-in">하루 목표(1~50장) — ${escapeHtml(p.name)}</label><div class="row"><input class="input" id="goal-in" type="number" min="1" max="50" value="${p.dailyGoal}"><button class="btn" data-action="goal-save">저장</button></div></div></div>
      <div class="grid-2"><div class="panel"><h3>복습 간격표</h3><div class="scroll-x"><table class="tbl"><tr><th>상자</th>${[1, 2, 3, 4, 5].map(b => `<th class="num">${b}</th>`).join('')}<th class="num">★ 숙달</th></tr><tr><td>다음 복습</td>${[1, 2, 3, 4, 5].map(b => `<td class="num">${INTERVALS[b]}일 뒤</td>`).join('')}<td class="num">30일 뒤</td></tr></table></div><p class="small muted" style="margin-top:8px">맞음+확실 → 다음 상자, 맞음+애매 → 제자리, 맞음+모름 → 내일 다시, 틀림 → 1상자.</p></div>
        <div class="panel list"><h3>화면·모드</h3><label class="switch"><input type="checkbox" data-action="set-teacher" ${s.teacherMode ? 'checked' : ''}><span>교사 모드(교사 탭 표시)</span></label><label class="switch"><input type="checkbox" data-action="set-motion" ${s.reduceMotion ? 'checked' : ''}><span>애니메이션 줄이기</span></label><p class="small muted">테마는 상단 🌙/☀️ 버튼으로 바꿔요.</p></div></div>
      <div class="panel list"><h3>백업·복원·제출</h3><div class="row"><button class="btn" data-action="backup">전체 백업(JSON) 내려받기</button><button class="btn" data-action="summary">복습 요약 JSON 내보내기(교사 제출용)</button><button class="btn" data-action="csv-template">CSV 템플릿</button></div>
        <div class="dropzone" id="restore-drop"><span>♻️ 백업 JSON을 여기에 끌어 놓거나</span><label class="btn btn-sm">파일 선택<input type="file" accept=".json,application/json" aria-label="백업 JSON 선택"></label><span class="small">형식 검사 후 ‘덮어쓰기 / 프로필로 추가’를 고를 수 있어요</span></div>
        <div class="row"><button class="btn" data-action="resample">샘플 데이터 다시 넣기</button><button class="btn btn-ghost" data-action="wipe-profile" style="color:var(--danger)">이 프로필 데이터 모두 삭제</button></div></div>
      <div class="panel list"><h3>저장 용량</h3><div class="gauge"><i style="width:${Math.min(100, (used / LIMITS.quota) * 100)}%"></i></div><p class="small muted num">${usedKb}KB / 5,120KB 사용 · 그림 카드 ${cards().filter(c => c.drawing).length}장${storage.failed ? ' · <b style="color:var(--danger)">저장 불가 상태(메모리 모드)</b>' : ''}</p><p class="small muted">모든 데이터는 이 기기의 브라우저(localStorage)에만 저장돼요. 다른 기기로 옮기려면 JSON 백업을 사용하세요. · 기억상자 v${VERSION}</p></div>`;
    wireDropzone($('#restore-drop'), files => restoreFromFile(files[0]));
  };
  function openProfileModal(p) {
    const body = document.createElement('div'); body.className = 'list';
    body.innerHTML = `<div class="field"><label for="pf-name">이름</label><input class="input" id="pf-name" maxlength="20" autofocus value="${escapeHtml(p ? p.name : '')}"></div><div class="field"><span class="field-label">이모지</span><div class="chips">${APP_DATA.PROFILE_EMOJIS.map(e => `<button type="button" class="chip-btn" data-emoji="${e}" aria-pressed="${(p ? p.emoji : '🐼') === e}">${e}</button>`).join('')}</div></div><div class="field" style="max-width:200px"><label for="pf-goal">하루 목표(1~50)</label><input class="input" id="pf-goal" type="number" min="1" max="50" value="${p ? p.dailyGoal : 10}"></div>`;
    let emoji = p ? p.emoji : '🐼';
    body.addEventListener('click', e => { const b = e.target.closest('[data-emoji]'); if (!b) return; emoji = b.dataset.emoji; $$('[data-emoji]', body).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.emoji === emoji))); });
    showModal({ title: p ? '프로필 수정' : '새 프로필', body, confirmText: '저장', onOpen: box => { const chk = () => { $('[data-value="true"]', box).disabled = !$('#pf-name', body).value.trim(); }; $('#pf-name', body).addEventListener('input', chk); chk(); } }).then(v => {
      if (v !== true) return; let name = $('#pf-name', body).value.trim(); const goal = clamp(Number($('#pf-goal', body).value) || 10, ...LIMITS.goal);
      if (state.meta.profiles.some(x => x.name === name && x !== p)) name += '(2)';
      if (p) Object.assign(p, { name, emoji, dailyGoal: goal }); else { const np = { id: 'p-' + uid(), name, emoji, dailyGoal: goal, createdAt: today, lastOpened: today }; state.meta.profiles.push(np); storage.set(KEY.profile(np.id), emptyProfileData()); }
      saveMeta(); showToast('프로필을 저장했어요', 'success'); render();
    });
  }
  function switchProfile(id) {
    if (id === state.meta.activeProfileId || !state.meta.profiles.some(p => p.id === id)) return;
    saveData(); state.meta.activeProfileId = id; state.data = loadProfile(id); profile().lastOpened = today; saveMeta();
    resetCards(); state.teacherCell = null; state.print.deckIds = [];
    showToast(`${profile().emoji} ${profile().name} 프로필로 바꿨어요`, 'info'); render();
  }
  async function deleteProfile(id) {
    const p = state.meta.profiles.find(x => x.id === id); if (!p || state.meta.profiles.length <= 1) return;
    const body = document.createElement('div'); body.innerHTML = `<p><b>${escapeHtml(p.name)}</b> 프로필과 모든 카드·기록을 삭제해요. 확인을 위해 이름을 입력하세요.</p><input class="input" id="del-name" autofocus placeholder="${escapeHtml(p.name)}">`;
    const ok = await showModal({ title: '프로필 삭제', body, confirmText: '삭제', danger: true, onOpen: box => { const b = $('[data-value="true"]', box); b.disabled = true; $('#del-name', body).addEventListener('input', e => { b.disabled = e.target.value.trim() !== p.name; }); } });
    if (!ok) return; storage.remove(KEY.profile(id)); state.meta.profiles = state.meta.profiles.filter(x => x.id !== id);
    if (state.meta.activeProfileId === id) { state.meta.activeProfileId = state.meta.profiles[0].id; state.data = loadProfile(state.meta.activeProfileId); }
    saveMeta(); showToast('프로필을 삭제했어요', 'info'); render();
  }
  function allProfilesData() { const out = {}; state.meta.profiles.forEach(p => { out[p.id] = p.id === state.meta.activeProfileId ? state.data : loadProfile(p.id); }); return out; }
  function exportBackup() { download(`기억상자_백업_${today}.json`, JSON.stringify({ type: 'memory-box-backup', version: 1, exportedAt: new Date().toISOString(), meta: state.meta, profiles: allProfilesData() }), 'application/json'); showToast('전체 백업을 내려받았어요', 'success'); }
  function exportSummary() { download(safeFileName(`기억상자_복습요약_${profile().name}_${today}`) + '.json', JSON.stringify(buildSummary(state.data, profile().name), null, 1), 'application/json'); showToast('복습 요약을 내려받았어요. 선생님께 제출하세요.', 'success'); }
  async function restoreFromFile(file) {
    if (!file) return; let obj;
    try { obj = JSON.parse(await readFileText(file)); } catch (e) { return showModal({ title: '복원 실패', body: '<p>JSON 파일을 읽을 수 없어요.</p>', cancelText: null }); }
    if (!obj || typeof obj !== 'object') obj = {};
    if (obj.type === 'memory-box-summary') return showModal({ title: '이 파일은 교사 모드용이에요', body: '<p>복습 요약 파일은 설정에서 교사 모드를 켠 뒤 교사 탭에 넣어 주세요.</p>', cancelText: null });
    if (obj.type !== 'memory-box-backup' || !obj.profiles || !obj.meta) return showModal({ title: '복원 실패', body: '<p>기억상자 백업 파일 형식이 아니에요(type: memory-box-backup).</p>', cancelText: null });
    if ((Number(obj.version) || 1) > 1) return showModal({ title: '복원 실패', body: `<p>이 파일은 더 새로운 버전(v${escapeHtml(obj.version)})이에요. 앱을 업데이트해 주세요.</p>`, cancelText: null });
    const ps = backupProfiles(obj); // 구조 검사: 프로필 목록과 각 프로필 데이터가 있어야 복원을 시작한다
    if (!ps.length) return showModal({ title: '복원 실패', body: '<p>백업 파일 안에 프로필 목록(meta.profiles)이나 프로필 데이터가 없어요. 파일이 손상되었을 수 있어요. 현재 데이터는 그대로 두었어요.</p>', cancelText: null });
    const names = ps.map(p => p.name).join(', ');
    const body = document.createElement('div'); body.className = 'list'; body.innerHTML = `<p>프로필 ${ps.length}개(${escapeHtml(names)}) · 내보낸 날짜 ${escapeHtml(String(obj.exportedAt || '').slice(0, 10))}</p><p class="small muted">덮어쓰기는 현재 데이터를 모두 지우고 파일 내용으로 바꿔요. 프로필로 추가는 현재 데이터를 두고 파일의 프로필을 옆에 추가해요.</p><button type="button" class="btn btn-sm" id="pre-backup">현재 데이터를 먼저 백업</button>`;
    $('#pre-backup', body).addEventListener('click', exportBackup);
    const v = await showModal({ title: '백업 복원', body, buttons: [{ text: '취소', value: false, kind: 'ghost' }, { text: '프로필로 추가', value: 'add', kind: 'ghost' }, { text: '덮어쓰기', value: 'over', kind: 'danger' }] });
    if (!v) return;
    // 프로필 id는 저장소 키·data-id 속성에 쓰이므로 허용 형식이 아니면 새로 발급하고, 이모지·목표·설정도 허용 값으로만 보정한다(파일의 다른 키는 버린다)
    const idMap = Object.create(null); ps.forEach(p => { idMap[p.id] = safeId(p.id, () => 'p-' + uid()); });
    if (v === 'over') {
      const next = Object.create(null); ps.forEach(p => { next[idMap[p.id]] = coerceProfileData(obj.profiles[p.id]); });
      Object.entries(next).forEach(([id, d]) => storage.set(KEY.profile(id), d)); // 새 데이터를 먼저 쓰고
      storage.keys().filter(k => k.startsWith('v1.profile.') && !next[k.slice(11)]).forEach(k => storage.remove(k)); // 남은 옛 키만 지운다
      const ms = obj.meta.settings && typeof obj.meta.settings === 'object' ? obj.meta.settings : {};
      state.meta = { version: 1, activeProfileId: idMap[obj.meta.activeProfileId] || idMap[ps[0].id], profiles: ps.map(p => fixProfile(p, idMap[p.id])), settings: { teacherMode: !!ms.teacherMode, reduceMotion: !!ms.reduceMotion }, intervals: INTERVALS };
      state.data = next[state.meta.activeProfileId];
    } else ps.forEach(p => { let id = idMap[p.id]; if (state.meta.profiles.some(x => x.id === id)) id = 'p-' + uid(); const np = fixProfile(p, id); if (state.meta.profiles.some(x => x.name === np.name)) np.name += '(2)'; state.meta.profiles.push(np); storage.set(KEY.profile(id), coerceProfileData(obj.profiles[p.id])); });
    resetCards(); state.print.deckIds = []; state.teacherCell = null;
    saveMeta(); applyTheme(); showToast(v === 'over' ? '백업으로 덮어썼어요' : '프로필을 추가했어요', 'success'); render();
  }

  /* ---------- 프로필 팝오버·도움말 ---------- */
  // 프로필 전환 팝오버: 바깥 클릭·Esc·Tab으로 닫고, ↑/↓로 항목 이동, 닫힐 때 칩으로 포커스 복귀
  function profileMenu(anchor) {
    const old = $('.pop-menu'); if (old) { old.remove(); anchor.setAttribute('aria-expanded', 'false'); return; }
    const m = document.createElement('div'); m.className = 'pop-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = state.meta.profiles.map(p => `<button type="button" role="menuitem" class="${p.id === state.meta.activeProfileId ? 'on' : ''}" data-action="switch-profile" data-id="${escapeHtml(p.id)}"><span>${escapeHtml(p.emoji)}</span><span>${escapeHtml(p.name)}</span></button>`).join('') + `<button type="button" role="menuitem" data-action="goto" data-view="settings">⚙️ 프로필 관리</button>`;
    anchor.parentElement.appendChild(m); anchor.setAttribute('aria-expanded', 'true');
    const items = $$('[role="menuitem"]', m);
    const close = back => { m.remove(); anchor.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey, true); if (back) anchor.focus(); };
    const onDoc = () => close(false);
    const onKey = e => { const i = items.indexOf(document.activeElement); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); } else if (e.key === 'Tab') close(false); };
    setTimeout(() => { document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey, true); items[0].focus(); }, 0);
  }
  const helpModal = () => showModal({ title: '기억상자 사용법', wide: true, cancelText: null, confirmText: '닫기', body: `<ol class="help-steps">
    <li><b>카드 넣기</b> — 카드 탭에서 덱을 만들고 ‘+ 카드’로 외울 것(암기)이나 틀린 것(오답)을 적어요. 교사가 준 CSV를 끌어 놓아도 돼요.</li>
    <li><b>오늘 복습</b> — 홈의 ‘오늘 복습 N장’을 누르면 잊기 직전인 카드만 골라 보여 줘요.</li>
    <li><b>확신도 → 뒤집기 → 채점</b> — 뒤집기 전에 ‘모르겠어요/애매해요/확실해요’를 고르고, 뒤집어 정답을 본 뒤 ‘맞았어요/틀렸어요’를 눌러요. 맞히면 다음 상자로, 틀리면 1상자로 가요.</li>
    <li><b>되새김</b> — 다 끝나면 4분면 표와 코칭 한 줄이 나와요. ‘오늘 가장 헷갈린 것 한 줄’을 적어 두세요.</li>
    <li><b>기록·시험·인쇄</b> — 기록 탭에서 잔디 달력·원인 도넛·망각 예측을 보고, 시험 탭에서 D-Day 계획을, 인쇄 탭에서 암기카드·학습지를 뽑아요.</li>
    <li><b>교사</b> — 설정에서 교사 모드를 켜고 학생들의 ‘복습 요약 JSON’을 모으면 학급 공통 오답을 집계해요.</li></ol>
    <p><b>팁</b> 상자 간격은 1·2·4·7·15일, 5상자에서 확실히 맞히면 30일 뒤(숙달 ★). 모든 데이터는 이 기기에만 저장되니 설정에서 가끔 JSON 백업을 받아 두세요.</p>
    <p class="small"><b>단축키(복습 중)</b> <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 확신도 · <kbd>Space</kbd> 뒤집기 · <kbd>←</kbd> 틀림 · <kbd>→</kbd> 맞음 · <kbd>Esc</kbd> 종료 · 뒤집힌 카드는 좌우로 밀어도 돼요.</p>` });

  /* ---------- 이벤트 위임 ---------- */
  const actions = {
    goto: el => setView(el.dataset.view), theme: toggleTheme, help: helpModal, 'profile-menu': el => profileMenu(el),
    'quick-add': () => openCardModal({ deckId: state.deckId || undefined }),
    'start-today': () => startSession('today', todayQueue().map(c => c.id)), 'start-preview': async () => { if (await confirmNewSession()) startSession('preview', previewQueue().map(c => c.id)); },
    'start-deck': async el => { if (await confirmNewSession()) startSession('deck', cards().filter(c => c.deckId === el.dataset.id).map(c => c.id)); },
    'cal-cell': el => { $('#cal-tip').textContent = `${el.dataset.d}(${weekdayKo(el.dataset.d)}) · ${el.dataset.n}장 복습`; },
    'forecast-toggle': el => { state.forecastToggle = el.checked; $('#forecast-wrap').innerHTML = renderForecast(); },
    'weekly-check': el => { const k = isoWeekKey(today); if (el.checked) { if (!state.data.weeklyChecks.includes(k)) state.data.weeklyChecks.push(k); } else state.data.weeklyChecks = state.data.weeklyChecks.filter(x => x !== k); saveData(); showToast(el.checked ? '보호자 확인을 기록했어요' : '확인을 해제했어요', 'success'); },
    resume: () => startSession(state.data.pendingSession.kind, state.data.pendingSession.remainingCardIds.filter(cardById), true),
    restart: () => { state.data.pendingSession = null; saveData(); startSession('today', todayQueue().map(c => c.id)); },
    'open-box': el => { Object.assign(state, { view: 'cards', cardsMode: 'list', deckId: null }); state.filter = { q: '', box: el.dataset.box, type: 'all', sort: 'due' }; render(); },
    'all-cards': () => { Object.assign(state, { cardsMode: 'list', deckId: null }); state.filter = { q: '', box: 'all', type: 'all', sort: 'due' }; render(); },
    'open-deck': el => { Object.assign(state, { cardsMode: 'list', deckId: el.dataset.id }); state.filter = { q: '', box: 'all', type: 'all', sort: 'due' }; render(); },
    'back-decks': () => { state.cardsMode = 'decks'; render(); }, 'new-deck': () => openDeckModal(), 'edit-deck': el => openDeckModal(deckById(el.dataset.id)), 'delete-deck': el => deleteDeck(el.dataset.id),
    'new-card': el => openCardModal({ deckId: el.dataset.deck }), 'edit-card': el => openCardModal({ cardId: el.dataset.id }), 'export-csv': el => exportCsv(el.dataset.id),
    'end-session': () => endSession(), conf: el => chooseConf(Number(el.dataset.c)), flip: flipCard, hint: toggleHint, grade: el => grade(el.dataset.ok === '1'), 'pick-reason': el => pickReason(el.dataset.reason),
    'weekly-report': weeklyReport, 'new-exam': openExamModal,
    'exam-regen': el => { const ex = state.data.exams.find(e => e.id === el.dataset.id); regenExam(ex); saveData(); render(); },
    'exam-delete': async el => { const ex = state.data.exams.find(e => e.id === el.dataset.id); if (await showModal({ title: '시험 삭제', body: `<p>‘${escapeHtml(ex.title)}’ 계획을 삭제할까요? 카드의 복습일은 그대로 둬요.</p>`, confirmText: '삭제', danger: true })) { state.data.exams = state.data.exams.filter(e => e !== ex); saveData(); render(); } },
    'exam-wrong': el => { const ex = state.data.exams.find(e => e.id === el.dataset.id); openCardModal({ deckId: ex.deckIds.find(deckById), type: 'wrong' }); },
    'print-deck': el => { const s = new Set(state.print.deckIds); s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.add(el.dataset.id); state.print.deckIds = [...s]; views.print(); },
    'print-type': el => { state.print.type = el.dataset.val; views.print(); }, 'print-layout': el => { state.print.layout = el.dataset.val; views.print(); },
    'print-opt': el => { state.print[el.dataset.key] = el.checked; }, 'print-preview': () => openPrintView(buildPrintHtml(printCards())), 'print-back': closePrintView, 'print-now': () => window.print(),
    'teacher-sample': () => { buildTeacherSample(today).map(normalizeSummary).filter(Boolean).forEach(upsertImport); saveTeacher(); showToast('샘플 학급 6명을 불러왔어요', 'success'); render(); },
    'teacher-template': () => { download('학급_단어장_템플릿.csv', toCsv(APP_DATA.CSV_TEMPLATE), 'text/csv;charset=utf-8'); showToast('CSV 템플릿을 내려받았어요', 'success'); },
    'teacher-csv': () => { const { list } = teacherAgg(); download(`학급_오답집계_${today}.csv`, toCsv([['단원', '학생수', '오답장수', '개념', '읽기', '계산', '시간', '몰랐음', '주원인'], ...list.map(u => [u.unit, u.names.size, u.cards, ...REASON_KEYS.map(k => u.reasons[k]), reasonLabel(u.top)])]), 'text/csv;charset=utf-8'); showToast('집계 CSV를 내려받았어요', 'success'); },
    'teacher-clear': async () => { if (await showModal({ title: '교사 데이터 지우기', body: '<p>가져온 학생 자료를 모두 지울까요?</p>', confirmText: '지우기', danger: true })) { state.teacher.imports = []; state.teacherCell = null; saveTeacher(); render(); } },
    'teacher-remove': el => { state.teacher.imports = state.teacher.imports.filter(s => s.studentName !== el.dataset.name); saveTeacher(); render(); },
    'teacher-cell': el => { const u = teacherAgg().list.find(x => x.unit === el.dataset.unit); const names = u && u.byReason[el.dataset.reason] ? [...u.byReason[el.dataset.reason]] : []; state.teacherCell = { unit: el.dataset.unit, reason: el.dataset.reason, names }; $('#cell-detail').textContent = `${el.dataset.unit} · ${reasonLabel(el.dataset.reason)}: ${names.join(', ') || '없음'}`; },
    'profile-add': () => openProfileModal(null), 'profile-edit': el => openProfileModal(state.meta.profiles.find(p => p.id === el.dataset.id)), 'profile-delete': el => deleteProfile(el.dataset.id), 'switch-profile': el => switchProfile(el.dataset.id),
    'goal-save': () => { const v = Number($('#goal-in').value); const g = clamp(v || 10, ...LIMITS.goal); profile().dailyGoal = g; saveMeta(); showToast(g !== v ? `1~50 사이로 보정해 ${g}장으로 저장했어요` : `하루 목표를 ${g}장으로 저장했어요`, 'success'); render(); },
    'set-teacher': el => { state.meta.settings.teacherMode = el.checked; saveMeta(); render(); }, 'set-motion': el => { state.meta.settings.reduceMotion = el.checked; saveMeta(); applyTheme(); },
    backup: exportBackup, summary: exportSummary, 'csv-template': () => { download('기억상자_CSV_템플릿.csv', toCsv(APP_DATA.CSV_TEMPLATE), 'text/csv;charset=utf-8'); showToast('CSV 템플릿을 내려받았어요', 'success'); },
    resample: async () => { if (await showModal({ title: '샘플 데이터 다시 넣기', body: '<p>모든 프로필과 기록을 지우고 처음 상태의 샘플(김하늘·이도윤)로 되돌려요. 계속할까요?</p>', confirmText: '다시 넣기', danger: true })) { seedSample(); resetCards(); showToast('샘플 데이터를 다시 넣었어요', 'success'); render(); } },
    'wipe-profile': async () => { const p = profile(); const body = document.createElement('div'); body.innerHTML = `<p><b>${escapeHtml(p.name)}</b>의 카드·기록을 모두 지워요(프로필은 남아요). 이름을 입력해 확인하세요.</p><input class="input" id="wipe-name" autofocus placeholder="${escapeHtml(p.name)}">`; if (await showModal({ title: '데이터 모두 삭제', body, confirmText: '삭제', danger: true, onOpen: box => { const b = $('[data-value="true"]', box); b.disabled = true; $('#wipe-name', body).addEventListener('input', e => { b.disabled = e.target.value.trim() !== p.name; }); } })) { state.data = emptyProfileData(); saveData(); showToast('데이터를 모두 지웠어요', 'info'); render(); } },
  };
  document.addEventListener('click', e => {
    const tab = e.target.closest('.tab[data-view]'); if (tab) { if (tab.dataset.view === 'cards') resetCards(); setView(tab.dataset.view); return; } // 탭은 항상 첫 화면(덱 목록)
    const f = e.target.closest('[data-filter]'); if (f) { state.filter[f.dataset.filter] = f.dataset.val; $$(`[data-filter="${f.dataset.filter}"]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.val === f.dataset.val))); $('#card-list').innerHTML = cardListHtml(); return; }
    const el = e.target.closest('[data-action]'); if (!el || el.disabled || el.type === 'checkbox') return;
    const fn = actions[el.dataset.action]; if (fn) fn(el);
  });
  document.addEventListener('change', e => { const el = e.target.closest('input[type=checkbox][data-action]'); if (el && actions[el.dataset.action]) actions[el.dataset.action](el); });
  document.addEventListener('keydown', e => {
    const rb = e.target instanceof Element ? e.target.closest('[role="button"]') : null; // div[role=button](덱 카드·카드 행·4분면 칸)은 Enter/Space로 누른다
    if (rb && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); rb.click(); return; }
    if (isModalOpen()) return;
    if (!$('#print-view').hidden) { if (e.key === 'Escape') closePrintView(); return; }
    if (!S()) return; const tag = (document.activeElement || {}).tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const map = { '1': () => chooseConf(1), '2': () => chooseConf(2), '3': () => chooseConf(3), ' ': flipCard, ArrowLeft: () => grade(false), ArrowRight: () => grade(true), Escape: () => endSession() };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  });
  storage.onFail = () => { $('#storage-banner').hidden = false; showToast('저장이 되지 않아요. JSON으로 내보내 보관하세요.', 'error', 5000); };
  window.addEventListener('pagehide', () => { if (state.data) saveData(); });

  /* ---------- 공개 디버그 API(테스트용, 읽기 전용 스냅샷 + 주요 액션) ---------- */
  window.__app = {
    version: VERSION,
    getState: () => JSON.parse(JSON.stringify({ view: state.view, today, profile: profile(), meta: state.meta, data: state.data, teacher: state.teacher, session: state.session, queue: todayQueue().map(c => c.id), overdue: overdueCount(), streak: streak(), boxCounts: boxCounts(), forecast: forecastData() })),
    actions: { setView, startSession, chooseConf, flip: flipCard, grade, pickReason, endSession, switchProfile, openCardModal, openDeckModal, importCsvText: (text, deckId) => { if (deckId) { state.deckId = deckId; state.cardsMode = 'list'; } return importCsvFile(new File([text], 'test.csv', { type: 'text/csv' })); }, importTeacherFiles, restoreFromFile, loadTeacherSample: actions['teacher-sample'], setDailyGoal: g => { profile().dailyGoal = clamp(g, ...LIMITS.goal); saveMeta(); render(); }, applyGrade: (cardId, ok, c, reason) => { const card = cardById(cardId); const mv = applyGrade(card, ok, c, todayStr(), reason); saveData(); render(); return mv; }, resample: seedSample, render },
  };

  /* ---------- 시작 ---------- */
  loadAll(); applyTheme(); render();
  if (state.data.pendingSession && !state.data.pendingSession.remainingCardIds.filter(cardById).length) { state.data.pendingSession = null; saveData(); }
})();
