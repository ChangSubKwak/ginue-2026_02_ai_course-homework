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

  // 누락 필드 기본값 채우기(가져오기·구버전 대비)
  const migrate = root => {
    root.schemaVersion = 1; root.settings = Object.assign(MG.defaultSettings(), root.settings || {});
    root.settings.activeStageIds = (root.settings.activeStageIds || []).filter(id => MG.stageById(id));
    root.profiles = (root.profiles || []).map(p => {
      const base = MG.newProfile(p.name, p.grade ?? null, p.classNo ?? null, p.number ?? null, p.avatar ?? 0);
      const m = Object.assign(base, p); m.counters = Object.assign(base.counters, p.counters || {}); m.badges = p.badges || []; m.playDates = p.playDates || []; m.stageRecords = p.stageRecords || {}; m.facts = p.facts || {}; m.history = p.history || [];
      if (!MG.SKINS.some(s => s.id === m.skin)) m.skin = 'basic'; if (!MG.THEMES.some(t => t.id === m.theme)) m.theme = 'meadow';
      return m;
    });
    if (!root.profiles.some(p => p.id === root.activeProfileId)) root.activeProfileId = root.profiles[0] ? root.profiles[0].id : null;
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
  // 300ms 디바운스 저장
  MG.save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300); };
  MG.flushSave = flush;
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
