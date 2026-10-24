/* app.js — 저장·복원·시딩·마이그레이션(A13), 테마, 프로필 선택, 부팅, 테스트용 window.__app */
'use strict';
(function (MG) {
  const THEME_KEY = 'edu.math-guardians.theme';
  // localStorage 래퍼(try/catch) — 실패 시 메모리로만 동작
  const storage = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    getRaw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
  };
  MG.root = null; MG.storageOk = true; MG.guest = null;
  let saveTimer = 0;

  // ---- 타입 강제 도우미(가져온 JSON의 필드를 스키마 타입으로 정규화: 잘못된 값은 기본값) ----
  const num = (v, d, lo, hi) => { const n = typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null); return n == null ? d : Math.min(hi, Math.max(lo, n)); };
  const int = (v, d, lo, hi) => { const n = num(v, null, lo, hi); return n == null ? d : Math.round(n); };
  const str = (v, d, max) => typeof v === 'string' ? v.slice(0, max || 200) : d;
  const isoOrNull = v => typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v.slice(0, 40) : null;
  const END_KINDS = ['clear', 'gameover', 'timeout', 'quit'], P_KEYS = /^(op|a|b|n1|d1|n2|d2|keep|k|ka|kb|n|p|m)$/, P_MAX = 10000;
  // 문제 매개변수 p 정규화: 허용 키만 남기되 값이 0~10000 정수/불리언이 아니면 사실 전체를 버리고(거대한 수로 약수 탐색 등이 멈추지 않게), 실제로 build()가 유한한 정답·정상 문제 문자열을 내는 것만 통과
  const cleanP = (stageId, p) => {
    if (!p || typeof p !== 'object' || typeof p.op !== 'string' || p.op.length > 8) return null;
    const out = {};
    for (const [k, v] of Object.entries(p)) { if (!P_KEYS.test(k)) continue; if (k !== 'op' && typeof v !== 'boolean' && !(Number.isInteger(v) && v >= 0 && v <= P_MAX)) return null; out[k] = v; }
    try { const pr = MG.Problems.build(stageId, out); return pr && typeof pr.key === 'string' && Number.isFinite(pr.answer) && !/NaN|undefined|Infinity/.test(pr.key + pr.answerText) ? out : null; } catch (e) { return null; }
  };
  // 누락 필드 기본값 채우기 + 타입 강제(가져오기·구버전 대비). 렌더 템플릿에 들어가는 모든 값이 여기서 정해진 타입을 갖는다
  const migrate = root => {
    root.schemaVersion = 1;
    const def = MG.defaultSettings(), s = Object.assign({}, def, root.settings && typeof root.settings === 'object' ? root.settings : {});
    s.activeStageIds = [...new Set((Array.isArray(s.activeStageIds) ? s.activeStageIds : def.activeStageIds).filter(id => typeof id === 'string' && MG.stageById(id)))];
    s.speedPreset = MG.SPEED_PRESETS[s.speedPreset] ? s.speedPreset : 'normal'; s.timeLimitMin = [0, 3, 5, 10].includes(+s.timeLimitMin) ? +s.timeLimitMin : def.timeLimitMin;
    ['rankingPublic', 'unlockAll', 'adaptive', 'lowGradeChoice', 'muted', 'lowSpec', 'bigText'].forEach(k => { s[k] = !!s[k]; });
    s.volume = num(s.volume, def.volume, 0, 1); s.teacherPin = typeof s.teacherPin === 'string' && /^\d{4}$/.test(s.teacherPin) ? s.teacherPin : null; s.classLabel = str(s.classLabel, def.classLabel, 30) || def.classLabel;
    root.settings = s;
    const ids = new Set();
    root.profiles = (Array.isArray(root.profiles) ? root.profiles : []).filter(p => p && typeof p === 'object').map(p => {
      const base = MG.newProfile((str(p.name, '', 12) || '').trim() || '학생', int(p.grade, null, 1, 6), int(p.classNo, null, 1, 99), int(p.number, null, 1, 99), int(p.avatar, 0, 0, 7));
      const id = typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id) && !ids.has(p.id) ? p.id : base.id; ids.add(id);
      const m = Object.assign(base, { id, createdAt: isoOrNull(p.createdAt) || base.createdAt, skin: MG.SKINS.some(k => k.id === p.skin) ? p.skin : 'basic', theme: MG.THEMES.some(t => t.id === p.theme) ? p.theme : 'meadow' });
      const pc = p.counters && typeof p.counters === 'object' ? p.counters : {}; Object.keys(m.counters).forEach(k => { m.counters[k] = int(pc[k], 0, 0, 1e9); });
      const seenB = new Set(); m.badges = (Array.isArray(p.badges) ? p.badges : []).filter(b => b && MG.BADGES.some(x => x.id === b.id) && !seenB.has(b.id) && seenB.add(b.id)).map(b => ({ id: b.id, at: isoOrNull(b.at) || base.createdAt }));
      m.playDates = [...new Set((Array.isArray(p.playDates) ? p.playDates : []).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
      m.stageRecords = {}; Object.entries(p.stageRecords && typeof p.stageRecords === 'object' ? p.stageRecords : {}).forEach(([sid, r]) => { if (!MG.stageById(sid) || !r || typeof r !== 'object') return; m.stageRecords[sid] = { stageId: sid, bestScore: int(r.bestScore, 0, 0, 1e9), bestStars: int(r.bestStars, 0, 0, 3), bestCombo: int(r.bestCombo, 0, 0, 1e6), plays: int(r.plays, 0, 0, 1e6), clears: int(r.clears, 0, 0, 1e6), correct: int(r.correct, 0, 0, 1e9), wrong: int(r.wrong, 0, 0, 1e9), reached: int(r.reached, 0, 0, 1e9), avgMs: int(r.avgMs, 0, 0, 1e7), lastPlayedAt: isoOrNull(r.lastPlayedAt) }; });
      m.facts = {}; Object.entries(p.facts && typeof p.facts === 'object' ? p.facts : {}).slice(0, 600).forEach(([k, f]) => { if (!f || typeof f !== 'object' || !MG.stageById(f.stageId)) return; const pp = cleanP(f.stageId, f.p); if (!pp) return; m.facts[k] = { key: k, stageId: f.stageId, p: pp, box: int(f.box, 0, 0, 3), hit: int(f.hit, 0, 0, 1e6), miss: int(f.miss, 0, 0, 1e6), rtSum: int(f.rtSum, 0, 0, 1e10), lastAt: isoOrNull(f.lastAt), masteredAt: isoOrNull(f.masteredAt), answer: str(f.answer, '', 40), question: str(f.question, k, 60) }; });
      m.history = (Array.isArray(p.history) ? p.history : []).filter(h => h && typeof h === 'object' && MG.stageById(h.stageId)).slice(0, 20).map(h => ({ stageId: h.stageId, score: int(h.score, 0, 0, 1e9), stars: int(h.stars, 0, 0, 3), correct: int(h.correct, 0, 0, 1e6), wrong: int(h.wrong, 0, 0, 1e6), reached: int(h.reached, 0, 0, 1e6), maxCombo: int(h.maxCombo, 0, 0, 1e6), avgMs: int(h.avgMs, 0, 0, 1e7), revengeKills: int(h.revengeKills, 0, 0, 1e6), wrongKeys: (Array.isArray(h.wrongKeys) ? h.wrongKeys : []).filter(x => typeof x === 'string').map(x => x.slice(0, 40)), endedBy: END_KINDS.includes(h.endedBy) ? h.endedBy : 'quit', playedAt: isoOrNull(h.playedAt) || base.createdAt }));
      return m;
    });
    if (!root.profiles.some(p => p.id === root.activeProfileId)) root.activeProfileId = root.profiles[0] ? root.profiles[0].id : null;
    root.seededAt = isoOrNull(root.seededAt); root.savedAt = isoOrNull(root.savedAt);
    return root;
  };
  // 실제 저장 수행
  const flush = () => {
    saveTimer = 0; if (!MG.root) return;
    MG.root.savedAt = new Date().toISOString();
    const ok = storage.set(MG.STORAGE_KEY, MG.root);
    if (ok !== MG.storageOk) { MG.storageOk = ok; document.getElementById('storage-warn').hidden = ok; if (!ok) MG.UI.showToast('이 기기에서는 저장이 꺼져 있어 이번 세션만 유지됩니다', 'warn', 4000); }
    if (MG.UI.renderSaveStatus) MG.UI.renderSaveStatus();
  };
  // 300ms 디바운스 저장. 페이지 이탈(pagehide)·탭 숨김 시에는 대기 중인 저장을 즉시 실행해 마지막 변경이 유실되지 않게 한다
  MG.save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300); };
  MG.flushSave = flush;
  window.addEventListener('pagehide', () => { if (saveTimer) { clearTimeout(saveTimer); flush(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) { clearTimeout(saveTimer); flush(); } });
  // 현재 사용자(게스트 우선)
  MG.current = () => MG.guest || MG.root.profiles.find(p => p.id === MG.root.activeProfileId) || MG.root.profiles[0] || makeGuest();
  const makeGuest = () => { const g = MG.newProfile('체험 학생', null, null, null, 0); g.id = 'guest'; return g; };
  MG.setGuest = () => { MG.guest = makeGuest(); };
  MG.setActive = id => { MG.guest = null; MG.root.activeProfileId = id; };
  MG.replaceRoot = data => { MG.root = migrate(data); MG.guest = null; applySettingsSideEffects(); flush(); };
  MG.resetSample = () => { MG.root = MG.seedSample(); MG.guest = null; applySettingsSideEffects(); flush(); };
  const applySettingsSideEffects = () => { const s = MG.root.settings; MG.Audio.setVolume(s.volume); MG.UI.syncMute(); document.body.classList.toggle('big-text', !!s.bigText); };

  // 테마: 저장값 없으면 OS 설정(system)
  const applyTheme = () => {
    const t = storage.getRaw(THEME_KEY); const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.getElementById('theme-btn').textContent = dark ? '☀️' : '🌙';
  };
  MG.toggleTheme = () => {
    const root = document.documentElement, dark = root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    try { localStorage.setItem(THEME_KEY, dark ? 'light' : 'dark'); } catch (e) { /* 무시 */ }
    root.dataset.theme = dark ? 'light' : 'dark'; applyTheme();
  };

  // 부팅: 저장 데이터 로드 → 없으면 시딩, 손상 시 보관 후 재시딩
  const boot = () => {
    applyTheme();
    const raw = storage.getRaw(MG.STORAGE_KEY); let corrupt = false;
    if (raw) { try { MG.root = migrate(JSON.parse(raw)); } catch (e) { corrupt = true; storage.set(MG.STORAGE_KEY + '.corrupt', raw); } }
    const firstRun = !MG.root;
    if (!MG.root) { MG.root = MG.seedSample(); }
    // 저장 가능 여부 탐지
    try { localStorage.setItem('mathGuardians.probe', '1'); localStorage.removeItem('mathGuardians.probe'); } catch (e) { MG.storageOk = false; }
    document.getElementById('storage-warn').hidden = MG.storageOk;
    MG.UI.bind(); applySettingsSideEffects(); MG.UI.renderProfileBar(); MG.UI.showView('home');
    if (firstRun && MG.storageOk) flush();
    if (corrupt) MG.UI.showToast('저장 데이터가 손상되어 샘플로 다시 시작했어요(원본은 보관됨)', 'warn', 4000);
    else if (firstRun) MG.UI.showToast('프로필을 고르고 스테이지를 눌러 시작하세요', 'info', 3500);
    if (!MG.storageOk) MG.UI.showToast('저장 불가: 새로고침하면 샘플 데이터로 다시 시작됩니다', 'warn', 4000);
    try { if (sessionStorage.getItem('mathGuardians.inGame')) { sessionStorage.removeItem('mathGuardians.inGame'); MG.UI.showToast('진행 중이던 판은 저장되지 않았습니다', 'warn'); } } catch (e) { /* 무시 */ }
  };

  // 테스트·디버그용 공개 API(읽기 전용 스냅샷 + 주요 액션)
  window.__app = {
    version: MG.VERSION,
    getState: () => ({ view: MG.UI.view, activeProfileId: MG.root.activeProfileId, guest: !!MG.guest, current: MG.current().name, profiles: MG.root.profiles.map(p => ({ id: p.id, name: p.name, number: p.number, stars: Object.values(p.stageRecords).reduce((s, r) => s + r.bestStars, 0), records: Object.keys(p.stageRecords).length, badges: p.badges.map(b => b.id) })), settings: JSON.parse(JSON.stringify(MG.root.settings)), storageOk: MG.storageOk, muted: MG.Audio.muted, game: MG.Game.getState() }),
    actions: { showView: MG.UI.showView, startStage: MG.UI.startStage, fire: MG.Game.fire, choose: MG.Game.choose, useSuper: MG.Game.useSuper, pause: MG.Game.pause, resume: MG.Game.resume, quit: MG.Game.quit, setActive: id => { MG.setActive(id); MG.save(); MG.UI.renderProfileBar(); MG.UI.showView('home'); }, setGuest: () => { MG.setGuest(); MG.UI.renderProfileBar(); MG.UI.showView('home'); }, setSetting: (k, v) => { MG.root.settings[k] = v; MG.save(); }, resetSample: MG.resetSample, importJson: MG.UI.importJson, importRoster: MG.UI.importRoster, flushSave: flush, toggleTheme: MG.toggleTheme, toast: MG.UI.showToast },
    MG,
  };
  document.addEventListener('DOMContentLoaded', boot);
})(window.MG);
