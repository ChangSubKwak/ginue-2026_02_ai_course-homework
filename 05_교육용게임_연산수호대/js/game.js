/* game.js — Canvas 디펜스 전투 루프(rAF·파티클), 조준·판정(A3), 웨이브·스폰(A4), 점수·콤보(A5), 적응형(A6), 사실 상자(A7), 입력 패드 */
'use strict';
(function (MG) {
  const W = 960, H = 540, GROUND = 330, TURRET = { x: 92, y: 282 }, SPAWN_X = 940, TRAVEL = 800;
  const WAVE_COUNTS = [3, 4, 4, 5, 5, 6, 6, 7, 7], BOSS_WAVE = 10, MAX_WAVE_T = 12, BOSS_T = 20, PROJ_MS = 180;
  const comboMult = c => c < 5 ? 1 : c < 10 ? 2 : c < 20 ? 3 : 4;
  const waveT = w => w === BOSS_WAVE ? BOSS_T : Math.max(6, MAX_WAVE_T - 0.6 * (w - 1));
  const THEME_COLORS = {
    meadow: { sky: ['#0b1335', '#1b2a6b'], hill: '#2f8f4e', hill2: '#24703d', ground: '#365a28' },
    desert: { sky: ['#1a1030', '#6a3a5a'], hill: '#d9a24c', hill2: '#b9833a', ground: '#8c6a3a' },
    snow: { sky: ['#0a1630', '#2b4a7a'], hill: '#e8f0fa', hill2: '#c9d9ec', ground: '#a9c0d8' },
    volcano: { sky: ['#1a0608', '#6a1a12'], hill: '#5a2a2a', hill2: '#8a3a1e', ground: '#3a1f1a' },
  };
  const SKIN_COLORS = { basic: ['#5c6b8a', '#3a4560', '#9fb3d9'], gold: ['#d4a017', '#9a7210', '#ffe38a'], crystal: ['#58c9e8', '#2b8fb0', '#d9f7ff'] };
  const MONSTER_COLORS = ['#7bd389', '#f9a03f', '#9b7bff', '#4fc3f7', '#ff7eb6', '#ffd166', '#6ee7b7', '#f28482'];
  const nowISO = () => new Date().toISOString();
  // 밤하늘 별 위치(고정 의사난수 — 매 판 동일한 배경)
  const STARS = (() => { let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; return Array.from({ length: 48 }, () => [Math.floor(r() * W), Math.floor(r() * 250), r() < 0.3 ? 3 : 2]); })();

  // ---- 사실 숙달 상자(A7): 게임·복습에서 공용 ----
  const Facts = {
    update(profile, pr, kind) {
      if (!profile) return;
      let f = profile.facts[pr.key];
      if (!f) f = profile.facts[pr.key] = { key: pr.key, stageId: pr.stageId, p: pr.p, box: 0, hit: 0, miss: 0, lastAt: null, masteredAt: null, answer: pr.answerText, question: pr.text };
      if (kind === 'hit' || kind === 'review') { f.box = Math.min(3, f.box + 1); if (kind === 'hit') f.hit++; if (f.box >= 2 && !f.masteredAt) f.masteredAt = nowISO(); }
      else if (kind === 'miss') { f.box = 0; f.miss++; f.masteredAt = null; }
      else if (kind === 'reached') { f.box = Math.max(0, f.box - 1); f.miss++; }
      f.lastAt = nowISO();
      const keys = Object.keys(profile.facts);
      if (keys.length > 600) keys.map(k => profile.facts[k]).filter(x => x.box === 3 && x.miss === 0).sort((a, b) => (a.lastAt || '').localeCompare(b.lastAt || '')).slice(0, keys.length - 600).forEach(x => { delete profile.facts[x.key]; });
      return f;
    },
  };

  // ---- 입력 패드: 키패드/소수점/3지선다, 게임·교정 카드·복습에서 재사용 ----
  const Pad = {
    active: null,
    create(container, type, handlers) {
      const pad = { type, input: '', choices: [], disabled: new Set(), container, handlers, setType(t) { pad.type = t; pad.input = ''; pad.render(); }, setChoices(c, dis) { pad.choices = c || []; pad.disabled = new Set(dis || []); pad.render(); } };
      pad.render = () => {
        if (pad.type === 'choice3') {
          container.innerHTML = `<div class="pad-hint">정답을 고르세요 (키보드 1·2·3)</div><div class="choices">${pad.choices.map((c, i) => `<button class="choice-btn" data-i="${i}" ${pad.disabled.has(i) ? 'disabled' : ''}><span class="num">${i + 1}</span>${c}</button>`).join('')}</div>`;
        } else {
          const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', pad.type === 'decimal' ? '.' : '', '0', 'back'];
          container.innerHTML = `<div class="input-display" aria-live="polite">${pad.input || '<span class="ph">?</span>'}</div><div class="keypad">${keys.map(k => k === '' ? '<span></span>' : `<button class="key ${k === 'back' ? 'key-back' : ''}" data-k="${k}" aria-label="${k === 'back' ? '지우기' : k}">${k === 'back' ? '⌫' : k}</button>`).join('')}<button class="key key-fire" data-k="fire">발사 ⏎</button></div>`;
        }
      };
      pad.updateDisplay = () => { const d = container.querySelector('.input-display'); if (d) d.innerHTML = pad.input || '<span class="ph">?</span>'; };
      pad.key = k => {
        if (pad.type === 'choice3') { const i = parseInt(k, 10) - 1; if (i >= 0 && i < pad.choices.length && !pad.disabled.has(i)) handlers.onChoose(i); return; }
        if (k === 'fire') { if (pad.input) { const v = pad.input; pad.input = ''; pad.updateDisplay(); handlers.onFire(v); } return; }
        if (k === 'back') { pad.input = pad.input.slice(0, -1); }
        else if (k === '.') { if (pad.type !== 'decimal' || pad.input.includes('.')) return; pad.input = (pad.input || '0') + '.'; }
        else if (/^\d$/.test(k)) { if (pad.input.replace('.', '').length >= 6) return; pad.input = pad.input === '0' ? k : pad.input + k; }
        pad.updateDisplay();
      };
      // 물리 키보드 → 패드 키 (처리하면 true)
      pad.handleKey = e => {
        const k = e.key;
        if (/^\d$/.test(k)) { pad.key(k); return true; }
        if (k === '.' || k === ',') { if (pad.type === 'decimal') pad.key('.'); return true; }
        if (k === 'Backspace') { pad.key('back'); return true; }
        if (k === 'Enter') { pad.key('fire'); return true; }
        return false;
      };
      container.addEventListener('pointerdown', e => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        e.preventDefault(); MG.Audio.init();
        if (b.dataset.k) pad.key(b.dataset.k); else if (b.dataset.i != null) pad.key(String(parseInt(b.dataset.i, 10) + 1));
      });
      pad.render();
      return pad;
    },
  };

  // ---- 게임 본체 ----
  let canvas, ctx, G = null, rafId = 0, lastTs = 0, hooks = {}, dprEff = 1, gamePad = null, fpsBad = 0, lastHud = '';
  const labelCache = new Map();
  const el = id => document.getElementById(id);

  // 캔버스 해상도 재계산(논리 960×540 유지, DPR 1.5 상한·저사양 1)
  const resize = () => {
    if (!canvas) return;
    dprEff = (G && G.settings.lowSpec) ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = W * dprEff; canvas.height = H * dprEff; ctx.setTransform(dprEff, 0, 0, dprEff, 0, 0);
  };
  const alive = () => G.monsters.filter(m => m.alive);
  const front = () => { let best = null; for (const m of alive()) if (!best || m.progress > best.progress) best = m; return best; };
  const boss = () => G.monsters.find(m => m.isBoss && m.alive);
  const speedPreset = () => MG.SPEED_PRESETS[G.settings.speedPreset] || 1;
  const inputMode = () => MG.Problems.effectiveInput(G.stage.id, G.settings);
  const mx = m => SPAWN_X - m.progress * TRAVEL;
  const my = m => GROUND + 6 * Math.sin(4 * (G.elapsedMs - m.spawnedAt) / 1000) - (m.isBoss ? 18 : 0);

  // 게임 시작
  const start = (stage, profile, settings) => {
    const limit = (settings.timeLimitMin || 0) * 60000;
    G = {
      stage, profile, settings, wave: 0, spawnedInWave: 0, remainingInWave: 0, spawnIndex: 0, monsters: [], projectiles: [], particles: [], floats: [], shake: 0,
      hp: 3, hpLost: 0, score: 0, combo: 0, maxCombo: 0, superGauge: 0, correct: 0, wrong: 0, reached: 0, reactionTimes: [], recent: [], adaptive: 1, capAdjust: 0, adaptSign: 0, adaptUntil: 0,
      revengeQueue: [], revengeKeys: new Set(), recentKeys: [], elapsedMs: 0, timeLimitMs: limit, state: 'playing', bannerUntil: 0, bannerText: '', waveClearAt: 0, lastSpawnAt: 0,
      flash: 0, flashColor: '#ffd166', turretAngle: 0, turretTarget: 0, revengeKills: 0, bossKills: 0, wrongList: [], superKills: 0, resumeAt: 0, targetId: null, endedBy: null, nextId: 1,
    };
    resize(); labelCache.clear(); fpsBad = 0; lastHud = '';
    gamePad.setType(inputMode()); Pad.active = gamePad;
    startWave(1);
    cancelAnimationFrame(rafId); lastTs = performance.now(); rafId = requestAnimationFrame(frame);
    updateHud(true);
  };
  // 웨이브 시작: 배너·보스 생성
  const startWave = w => {
    G.wave = w; G.spawnedInWave = 0; G.bannerUntil = G.elapsedMs + 1000; G.waveClearAt = 0;
    if (w === BOSS_WAVE) {
      G.remainingInWave = 0; G.bannerText = 'BOSS!'; MG.Audio.play('boss');
      const shields = [0, 1, 2].map(() => makeProblem(true));
      const weak = weakFacts(); if (weak.length) { const f = weak[Math.floor(Math.random() * weak.length)]; shields[1] = MG.Problems.build(G.stage.id, f.p, buildOpts()); }
      G.monsters.push({ id: G.nextId++, isBoss: true, alive: true, progress: 0, shields, problem: shields[0], spawnedAt: G.elapsedMs + 1000, color: '#c23b4a', isRevenge: false });
    } else { G.remainingInWave = WAVE_COUNTS[w - 1]; G.bannerText = 'WAVE ' + w; G.lastSpawnAt = G.elapsedMs + 1000 - interval() * 1000; }
    if (G.capAdjust < 0) G.capAdjust = 0;
  };
  const interval = () => Math.max(1.6, 2.8 - 0.15 * (G.wave - 1));
  const cap = () => { let c = G.wave <= 2 ? 1 : G.wave <= 6 ? 2 : 3; if (inputMode() === 'choice3') c = Math.min(c, 2); return Math.max(1, c + G.capAdjust); };
  const buildOpts = () => ({ choice: inputMode() === 'choice3' && G.stage.inputType === 'number' });
  // 약점 큐 후보: 같은 스테이지·상자<2·오답≥1·최근 5스폰에 없던 사실
  const weakFacts = () => Object.values(G.profile.facts || {}).filter(f => f.stageId === G.stage.id && f.box < 2 && f.miss >= 1 && f.p && !G.recentKeys.slice(-5).includes(f.key));
  // 스폰 문제 결정: 복수 큐 → 약점 큐(20%) → 일반 생성
  const makeProblem = forBoss => {
    const avoid = new Set(alive().map(m => m.problem.key).concat(G.recentKeys.slice(-3)));
    if (!forBoss) {
      const ri = G.revengeQueue.findIndex(r => r.due <= G.spawnIndex);
      if (ri >= 0) { const r = G.revengeQueue.splice(ri, 1)[0]; const pr = MG.Problems.build(G.stage.id, r.p, buildOpts()); pr.isRevenge = true; return pr; }
      const weak = weakFacts(); if (weak.length && Math.random() < 0.2) return MG.Problems.build(G.stage.id, weak[Math.floor(Math.random() * weak.length)].p, buildOpts());
    }
    return MG.Problems.generate(G.stage.id, buildOpts(), avoid);
  };
  const spawn = () => {
    G.spawnIndex++; G.spawnedInWave++; G.remainingInWave--; G.lastSpawnAt = G.elapsedMs;
    const pr = makeProblem(false); G.recentKeys.push(pr.key);
    G.monsters.push({ id: G.nextId++, problem: pr, progress: 0, alive: true, isBoss: false, isRevenge: pr.isRevenge, spawnedAt: G.elapsedMs, color: MONSTER_COLORS[(G.spawnIndex * 3 + G.wave) % MONSTER_COLORS.length], locked: false });
  };

  // 매 프레임 갱신(playing 상태)
  const update = dt => {
    G.elapsedMs += dt * 1000;
    if (G.timeLimitMs && G.elapsedMs >= G.timeLimitMs) return end('timeout');
    const t = G.elapsedMs;
    // 스폰
    if (G.remainingInWave > 0 && t >= G.bannerUntil) {
      const live = alive(), last = live[live.length - 1];
      if (live.length < cap() && (t - G.lastSpawnAt) / 1000 >= interval() && (!last || last.progress >= 0.18)) spawn();
    }
    // 몬스터 전진
    const v0 = speedPreset() * (G.settings.adaptive ? G.adaptive : 1);
    for (const m of G.monsters) {
      if (!m.alive || t < m.spawnedAt) continue;
      m.progress += v0 * (1 / waveT(m.isBoss ? BOSS_WAVE : G.wave)) * (m.isRevenge ? 1.1 : 1) * dt;
      if (m.progress >= 1) reach(m);
      if (G.state !== 'playing') return;
    }
    // 포탄
    for (const p of G.projectiles) { p.t += dt * 1000; if (p.t >= PROJ_MS) { p.done = true; hit(p.target); } }
    G.projectiles = G.projectiles.filter(p => !p.done);
    // 웨이브 종료 판정
    if (G.wave < BOSS_WAVE && G.remainingInWave === 0 && !alive().length && !G.projectiles.length) {
      if (!G.waveClearAt) { G.waveClearAt = t; addScore(100 * G.wave, W / 2, 200, `웨이브 클리어 +${100 * G.wave}`); MG.Audio.play('waveClear'); }
      else if (t - G.waveClearAt >= 1500) startWave(G.wave + 1);
    }
    updateFx(dt);
  };
  const updateFx = dt => {
    G.turretAngle += (G.turretTarget - G.turretAngle) * Math.min(1, dt * 14);
    for (const p of G.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt; }
    G.particles = G.particles.filter(p => p.life > 0);
    for (const f of G.floats) { f.y -= 40 * dt; f.life -= dt; }
    G.floats = G.floats.filter(f => f.life > 0);
    G.shake = Math.max(0, G.shake - dt); G.flash = Math.max(0, G.flash - dt);
  };
  // 성 도달
  const reach = m => {
    G.hp -= m.isBoss ? 2 : 1; G.hpLost += m.isBoss ? 2 : 1; G.combo = 0; G.reached++;
    if (!G.settings.lowSpec) G.shake = 0.3; MG.Audio.play('damage');
    if (m.isBoss) m.progress = 0.4;
    else { m.alive = false; Facts.update(G.profile, m.problem, 'reached'); G.wrongList.push({ problem: m.problem, kind: 'reached' }); adaptRecord(false, 1, true); }
    if (G.hp <= 0) { G.hp = 0; end('gameover'); }
  };
  const addScore = (pts, x, y, label) => { G.score += pts; if (x != null) G.floats.push({ x, y, text: label || `+${pts}`, life: 1.1, big: pts >= 500 }); };
  const burst = (x, y, color, n) => { const max = G.settings.lowSpec ? 40 : 120; for (let i = 0; i < n && G.particles.length < max; i++) { const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 220; G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.5, color, r: 3 + Math.random() * 4 }); } };

  // 발사(A3 ①~⑤): 입력 문자열 파싱 → 일치 몬스터 중 가장 앞선 것 조준
  const fire = raw => {
    if (G.state !== 'playing') return;
    const mode = inputMode();
    const val = mode === 'decimal' ? Math.round(parseFloat(raw.startsWith('.') ? '0' + raw : raw) * 100) : parseInt(raw, 10);
    if (Number.isNaN(val)) return;
    const b = boss(), matching = b ? (b.shields[0].answer === val ? [b] : []) : alive().filter(m => m.problem.answer === val);
    const cands = matching.filter(m => !m.locked);
    if (!cands.length) { if (matching.length) return; return wrong(null); } // 이미 조준된 몬스터만 있으면 무시
    shoot(cands.reduce((a, m) => m.progress > a.progress ? m : a));
  };
  const choose = i => {
    if (G.state !== 'playing') return;
    const tgt = boss() || front(); if (!tgt || tgt.locked) return;
    const pr = tgt.isBoss ? tgt.shields[0] : tgt.problem;
    if (i === pr.correctIndex) shoot(tgt); else wrong(i);
  };
  const shoot = m => {
    m.locked = true; const tx = mx(m), ty = my(m);
    G.turretTarget = Math.atan2(ty - TURRET.y, tx - TURRET.x);
    G.projectiles.push({ x: TURRET.x, y: TURRET.y, tx, ty, t: 0, target: m });
    MG.Audio.play('shoot');
  };
  // 명중 처리: 점수·콤보·사실 상자·반응시간
  const hit = m => {
    if (!m.alive || G.state === 'ended') return;
    m.locked = false;
    const mult = comboMult(G.combo), rt = G.elapsedMs - m.spawnedAt, x = mx(m), y = my(m);
    const pr = m.isBoss ? m.shields[0] : m.problem;
    G.correct++; G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.reactionTimes.push(rt);
    Facts.update(G.profile, pr, 'hit'); adaptRecord(true, rt / 1000 / waveT(G.wave), false);
    if (G.combo % 10 === 0 && G.superGauge < 2) G.superGauge++;
    MG.Audio.play('hit'); if (G.combo >= 5) MG.Audio.play('combo', G.combo);
    if (G.combo >= 10) { G.flash = 0.3; G.flashColor = '#ffd166'; }
    if (m.isBoss) {
      m.shields.shift(); m.progress = Math.max(0, m.progress - 0.15); burst(x, y, '#ffd166', 16);
      if (m.shields.length) { addScore(200 * mult, x, y - 70, `+${200 * mult}${mult > 1 ? ' ×' + mult : ''}`); m.problem = m.shields[0]; }
      else { m.alive = false; G.bossKills++; addScore(500 * mult, x, y - 70, `BOSS +${500 * mult}`); burst(x, y, '#ff5a66', 40); end('clear'); }
    } else {
      let pts = 100 * mult + (rt <= 3000 ? 50 : 0);
      if (m.isRevenge) { pts *= 2; G.revengeKills++; MG.Audio.play('revenge'); }
      m.alive = false; addScore(pts, x, y - 60, `+${pts}${mult > 1 ? ' ×' + mult : ''}${m.isRevenge ? ' 복수!' : ''}`); burst(x, y, m.color, m.isRevenge ? 20 : 12);
    }
    hooks.onBadgeCheck && hooks.onBadgeCheck(G);
  };
  // 오답: 버저·콤보 0·가장 앞선 몬스터에 귀속·교정 카드
  const wrong = wrongIndex => {
    MG.Audio.play('wrong'); G.combo = 0; G.wrong++;
    const tgt = boss() || front(); if (!tgt) return;
    const pr = tgt.isBoss ? tgt.shields[0] : tgt.problem;
    Facts.update(G.profile, pr, 'miss'); adaptRecord(false, 1, false);
    if (!G.revengeKeys.has(pr.key) && G.wave < BOSS_WAVE) { G.revengeKeys.add(pr.key); G.revengeQueue.push({ p: pr.p, key: pr.key, due: G.spawnIndex + 2 + Math.floor(Math.random() * 3) }); }
    G.wrongList.push({ problem: pr, kind: 'wrong', revenge: !tgt.isBoss });
    G.state = 'card'; G.cardTarget = tgt;
    hooks.onCard(pr, wrongIndex);
  };
  // 교정 카드에서 정답 입력 완료 → 몬스터 점수 없이 제거, 0.5초 후 재개
  const cardSolved = () => {
    if (!G || G.state !== 'card') return;
    const m = G.cardTarget; G.cardTarget = null;
    if (m && m.alive) { if (m.isBoss) { m.shields.shift(); m.progress = Math.max(0, m.progress - 0.15); if (!m.shields.length) { m.alive = false; G.bossKills++; } else m.problem = m.shields[0]; } else m.alive = false; burst(mx(m), my(m), '#9aa3b2', 8); }
    if (m && m.isBoss && !m.alive) return end('clear');
    G.state = 'resume'; G.resumeAt = performance.now() + 500; Pad.active = gamePad;
  };
  // 필살기: 보스 제외 전멸(100점씩) / 보스전은 방패 1개
  const useSuper = () => {
    if (!G || G.state !== 'playing' || G.superGauge <= 0) return;
    G.superGauge--; G.flash = 0.4; G.flashColor = '#ffffff'; MG.Audio.play('superSkill');
    const b = boss();
    if (b) { b.shields.shift(); b.progress = Math.max(0, b.progress - 0.15); if (b.shields.length) b.problem = b.shields[0]; else { b.alive = false; G.bossKills++; addScore(500, mx(b), my(b) - 70, 'BOSS +500'); return end('clear'); } }
    else for (const m of alive()) { m.alive = false; G.superKills++; addScore(100, mx(m), my(m) - 60, '+100'); burst(mx(m), my(m), m.color, 10); }
    G.projectiles = [];
  };
  // 적응형 난이도(A6)
  const adaptRecord = (ok, r, reached) => {
    if (!G.settings.adaptive) return;
    G.recent.push({ ok, r, reached }); if (G.recent.length > 10) G.recent.shift(); if (G.recent.length < 10) return;
    const acc = G.recent.filter(x => x.ok).length / 10, avgR = G.recent.reduce((s, x) => s + x.r, 0) / 10, rc = G.recent.filter(x => x.reached).length, before = G.adaptive;
    if (acc >= 0.9 && avgR <= 0.5) { G.adaptive = Math.min(1.5, G.adaptive + 0.05); G.capAdjust = 0; }
    else if (acc < 0.6 || rc >= 2) { G.adaptive = Math.max(0.7, G.adaptive - 0.08); G.capAdjust = -1; }
    else G.capAdjust = 0;
    if (G.adaptive !== before) { G.adaptSign = G.adaptive > before ? 1 : -1; G.adaptUntil = performance.now() + 1000; }
  };
  const pause = () => { if (G && G.state === 'playing') { G.state = 'paused'; hooks.onPause && hooks.onPause(); } };
  const resume = () => { if (G && G.state === 'paused') { G.state = 'playing'; lastTs = performance.now(); } };
  // 판 종료(A5 별·요약) → 훅으로 UI에 전달
  const end = reason => {
    if (!G || G.state === 'ended') return;
    G.state = 'ended'; G.endedBy = reason; cancelAnimationFrame(rafId); Pad.active = null;
    const total = G.correct + G.wrong + G.reached, acc = total ? G.correct / total : 0, clear = reason === 'clear';
    const stars = clear ? (acc >= 0.95 && G.hpLost === 0 ? 3 : acc >= 0.8 ? 2 : 1) : 0;
    const avgMs = G.reactionTimes.length ? Math.round(G.reactionTimes.reduce((a, b) => a + b, 0) / G.reactionTimes.length) : 0;
    if (clear && G.hpLost === 0) G.score += 1000;
    const summary = { stageId: G.stage.id, score: G.score, stars, correct: G.correct, wrong: G.wrong, reached: G.reached, maxCombo: G.maxCombo, avgMs, revengeKills: G.revengeKills,
      wrongKeys: [...new Set(G.wrongList.map(w => w.problem.key))], endedBy: reason, playedAt: nowISO(), hpLost: G.hpLost, hp: G.hp, total, acc, bossKills: G.bossKills, reactionSum: G.reactionTimes.reduce((a, b) => a + b, 0), wrongList: G.wrongList };
    render(); setTimeout(() => hooks.onEnd(summary), clear ? 900 : 400);
    if (clear) MG.Audio.play('fanfare');
  };

  // ---- 렌더링 ----
  const labelWidth = (text, size) => { const k = text + '|' + size; if (!labelCache.has(k)) { ctx.font = `bold ${size}px Jua, "Malgun Gothic", sans-serif`; labelCache.set(k, ctx.measureText(text).width); } return labelCache.get(k); };
  const roundRect = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const drawBackground = () => {
    const th = THEME_COLORS[G.profile.theme] || THEME_COLORS.meadow, g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (const [x, y, s] of STARS) ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#f4e9c8'; ctx.beginPath(); ctx.arc(820, 80, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = th.hill2; ctx.beginPath(); ctx.moveTo(0, 350); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 330 - 30 * Math.sin(x / 120) - 10 * Math.sin(x / 37)); ctx.lineTo(W, 400); ctx.lineTo(0, 400); ctx.fill();
    ctx.fillStyle = th.hill; ctx.beginPath(); ctx.moveTo(0, 370); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 362 - 18 * Math.sin(x / 90 + 2)); ctx.lineTo(W, 400); ctx.lineTo(0, 400); ctx.fill();
    ctx.fillStyle = th.ground; ctx.fillRect(0, 368, W, H - 368);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(140, 372); ctx.lineTo(W, 372); ctx.stroke();
  };
  const drawCastle = () => {
    const [base, barrel, acc] = SKIN_COLORS[G.profile.skin] || SKIN_COLORS.basic;
    ctx.fillStyle = '#4a5068'; ctx.fillRect(0, 300, 130, 90); ctx.fillStyle = '#5d637c'; for (let i = 0; i < 5; i++) ctx.fillRect(i * 26, 286, 16, 16);
    ctx.fillStyle = '#3b405a'; ctx.fillRect(10, 320, 110, 4); ctx.fillRect(10, 350, 110, 4); ctx.fillStyle = '#2b2f44'; roundRect(48, 340, 30, 50, 10); ctx.fill();
    ctx.fillStyle = '#5d637c'; ctx.fillRect(68, 250, 50, 60); ctx.fillStyle = '#6a7090'; for (let i = 0; i < 3; i++) ctx.fillRect(68 + i * 18, 238, 12, 14);
    ctx.fillStyle = '#E63946'; ctx.beginPath(); ctx.moveTo(93, 212); ctx.lineTo(93, 240); ctx.lineTo(118, 226); ctx.fill();
    ctx.save(); ctx.translate(TURRET.x, TURRET.y); ctx.fillStyle = barrel; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(G.turretAngle); ctx.fillStyle = base; roundRect(0, -9, 46, 18, 6); ctx.fill(); ctx.fillStyle = acc; ctx.fillRect(36, -6, 8, 12); ctx.restore();
    ctx.fillStyle = base; ctx.beginPath(); ctx.arc(TURRET.x, TURRET.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(TURRET.x - 4, TURRET.y - 4, 4, 0, Math.PI * 2); ctx.fill();
  };
  const drawMonster = (m, isTarget, size) => {
    const x = mx(m), y = my(m), r = m.isBoss ? 50 : 26, t = G.elapsedMs / 1000;
    if (m.isRevenge) { ctx.strokeStyle = `rgba(230,57,70,${0.5 + 0.4 * Math.sin(t * 8)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 8 + 3 * Math.sin(t * 8), 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, GROUND + 34, r * 0.9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = m.isBoss ? '#7a1f2b' : m.color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (m.isBoss) { ctx.fillStyle = '#ffd166'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 26 - 10, y - r + 6); ctx.lineTo(x + i * 26, y - r - 24); ctx.lineTo(x + i * 26 + 10, y - r + 6); ctx.fill(); } }
    else { ctx.fillStyle = m.color; for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(x + i * 12, y - r + 4); ctx.lineTo(x + i * 20, y - r - 14); ctx.lineTo(x + i * 4, y - r + 2); ctx.fill(); } }
    const eye = r * 0.3; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.15, eye, 0, Math.PI * 2); ctx.arc(x + r * 0.35, y - r * 0.15, eye, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1f3a'; ctx.beginPath(); ctx.arc(x - r * 0.35 - 3, y - r * 0.12, eye * 0.5, 0, Math.PI * 2); ctx.arc(x + r * 0.35 - 3, y - r * 0.12, eye * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b1f3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y + r * 0.3, r * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // 라벨(흰 둥근 상자 + 검정 굵은 글씨)
    const text = m.problem.text, tw = labelWidth(text, size), bw = tw + 28, bh = size + 18, lx = Math.min(W - bw - 4, Math.max(4, x - bw / 2)), ly = y - r - (m.isBoss ? 60 : 34) - bh;
    ctx.fillStyle = '#fff'; roundRect(lx, ly, bw, bh, 12); ctx.fill(); ctx.strokeStyle = m.isRevenge ? '#E63946' : 'rgba(0,0,0,0.2)'; ctx.lineWidth = m.isRevenge ? 3 : 1.5; ctx.stroke();
    ctx.fillStyle = '#111'; ctx.font = `bold ${size}px Jua, "Malgun Gothic", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, lx + bw / 2, ly + bh / 2 + 1);
    if (m.isRevenge) { ctx.fillStyle = '#E63946'; roundRect(lx + bw / 2 - 30, ly - 24, 60, 24, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Jua, "Malgun Gothic", sans-serif'; ctx.fillText('복수!', lx + bw / 2, ly - 12); }
    if (m.isBoss) for (let i = 0; i < 3; i++) { ctx.fillStyle = i < m.shields.length ? '#4fc3f7' : 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x - 24 + i * 24, ly - 16, 8, 0, Math.PI * 2); ctx.fill(); }
    if (isTarget) { ctx.strokeStyle = '#E63946'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 14, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => { ctx.moveTo(x + dx * (r + 6), y + dy * (r + 6)); ctx.lineTo(x + dx * (r + 22), y + dy * (r + 22)); }); ctx.stroke(); }
  };
  const render = () => {
    if (!G) return;
    ctx.save();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 16 * (G.shake / 0.3), (Math.random() - 0.5) * 16 * (G.shake / 0.3));
    drawBackground();
    if (boss()) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-20, -20, W + 40, H + 40); }
    drawCastle();
    const size = G.settings.bigText ? 34 : 28, tgt = inputMode() === 'choice3' ? (boss() || front()) : null;
    const list = alive().sort((a, b) => a.progress - b.progress);
    for (const m of list) if (G.elapsedMs >= m.spawnedAt) drawMonster(m, tgt === m, size);
    for (const p of G.projectiles) { const k = Math.min(1, p.t / PROJ_MS), x = p.x + (p.tx - p.x) * k, y = p.y + (p.ty - p.y) * k; ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,209,102,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - (p.tx - p.x) * 0.08, y - (p.ty - p.y) * 0.08); ctx.lineTo(x, y); ctx.stroke(); }
    for (const p of G.particles) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of G.floats) { ctx.globalAlpha = Math.min(1, f.life); ctx.font = `${f.big ? 34 : 26}px "Black Han Sans", "Malgun Gothic", sans-serif`; ctx.fillStyle = '#ffd166'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
    if (G.flash > 0) { ctx.globalAlpha = Math.min(0.55, G.flash); ctx.fillStyle = G.flashColor; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.globalAlpha = 1; }
    if (G.elapsedMs < G.bannerUntil && G.state !== 'ended') { ctx.font = '72px "Black Han Sans", "Malgun Gothic", sans-serif'; ctx.fillStyle = G.wave === BOSS_WAVE ? '#ff5a66' : '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 8; ctx.strokeText(G.bannerText, W / 2, H / 2 - 40); ctx.fillText(G.bannerText, W / 2, H / 2 - 40); }
    if (G.state === 'resume') { const left = Math.max(0, (G.resumeAt - performance.now()) / 1000); ctx.font = '40px "Black Han Sans", "Malgun Gothic", sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 6; ctx.strokeText(`재개 ${left.toFixed(1)}`, W / 2, H / 2 - 40); ctx.fillText(`재개 ${left.toFixed(1)}`, W / 2, H / 2 - 40); }
    if (G.state === 'paused') { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-20, -20, W + 40, H + 40); }
    ctx.restore();
  };
  // HUD DOM 갱신(값이 바뀔 때만)
  const updateHud = force => {
    const b = boss(), tgt = inputMode() === 'choice3' ? (b || front()) : null, tid = tgt ? tgt.id + ':' + (tgt.isBoss ? tgt.shields.length : 0) : null;
    if (tid !== G.targetId) { G.targetId = tid; gamePad.setChoices(tgt ? (tgt.isBoss ? tgt.shields[0] : tgt.problem).choices : []); }
    const left = G.timeLimitMs ? Math.max(0, Math.ceil((G.timeLimitMs - G.elapsedMs) / 1000)) : null;
    const sig = [G.score, G.combo, G.hp, G.wave, left, G.superGauge, G.adaptSign && performance.now() < G.adaptUntil ? G.adaptSign : 0].join('|');
    if (!force && sig === lastHud) return; lastHud = sig;
    el('hud-score').textContent = G.score.toLocaleString('ko-KR');
    const cm = comboMult(G.combo), ce = el('hud-combo'); ce.textContent = G.combo >= 5 ? `×${cm} COMBO!` : G.combo ? `${G.combo} 콤보` : ''; ce.classList.toggle('hot', G.combo >= 5);
    el('hud-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < G.hp ? 'on' : 'off'}">${i < G.hp ? '❤' : '🖤'}</span>`).join('');
    el('hud-wave').textContent = G.wave === BOSS_WAVE ? 'BOSS 10/10' : `WAVE ${G.wave}/10`;
    const te = el('hud-time'); te.hidden = left == null; if (left != null) te.textContent = `⏱ ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    const ad = el('hud-adapt'); const showAd = G.adaptSign && performance.now() < G.adaptUntil; ad.textContent = showAd ? (G.adaptSign > 0 ? '▲ 빨라짐' : '▼ 느려짐') : ''; ad.className = 'hud-adapt' + (showAd ? (G.adaptSign > 0 ? ' up' : ' down') : '');
    el('hud-gauge').querySelectorAll('i').forEach((n, i) => n.classList.toggle('on', i < G.superGauge));
    el('super-btn').disabled = G.superGauge <= 0;
  };
  // rAF 루프: dt 상한 50ms, 30fps 미만 3초 지속 시 저사양 제안
  const frame = ts => {
    if (!G || G.state === 'ended') return;
    rafId = requestAnimationFrame(frame);
    const raw = (ts - lastTs) / 1000, dt = Math.min(0.05, raw); lastTs = ts;
    if (raw > 1 / 30 && raw < 1) { fpsBad += raw; if (fpsBad > 3 && !G.settings.lowSpec && hooks.onLowFps) { fpsBad = -999; hooks.onLowFps(); } } else if (raw <= 1 / 30) fpsBad = Math.max(0, fpsBad - raw);
    if (G.state === 'playing') update(dt);
    else if (G.state === 'resume' && performance.now() >= G.resumeAt) { G.state = 'playing'; }
    if (G.state !== 'ended') { render(); updateHud(false); }
  };

  // 초기화: 캔버스·패드·키보드·가시성 훅 연결
  const init = h => {
    hooks = h; canvas = el('game-canvas'); ctx = canvas.getContext('2d');
    gamePad = Pad.create(el('input-panel'), 'number', { onFire: fire, onChoose: choose });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (Pad.active && Pad.active.handleKey(e)) { e.preventDefault(); MG.Audio.init(); return; }
      if (!G || G.state === 'ended' || !hooks.isGameView()) return;
      if (e.key === ' ') { e.preventDefault(); if (G.state === 'playing') useSuper(); }
      else if (e.key === 'Escape') { e.preventDefault(); if (G.state === 'playing') pause(); }
    });
  };
  const getState = () => G ? { stage: G.stage.id, wave: G.wave, state: G.state, score: G.score, combo: G.combo, hp: G.hp, superGauge: G.superGauge, correct: G.correct, wrong: G.wrong, reached: G.reached, adaptive: G.adaptive, elapsedMs: G.elapsedMs,
    monsters: alive().map(m => ({ id: m.id, key: m.problem.key, text: m.problem.text, answer: m.problem.answer, answerText: m.problem.answerText, progress: +m.progress.toFixed(3), spawnedAt: Math.round(m.spawnedAt), locked: !!m.locked, isBoss: m.isBoss, isRevenge: m.isRevenge, shields: m.shields ? m.shields.length : 0, choices: m.problem.choices, correctIndex: m.problem.correctIndex })),
    revengeQueue: G.revengeQueue.map(r => r.key), particles: G.particles.length, floats: G.floats.map(f => f.text) } : null;
  const quit = () => { if (G && G.state !== 'ended') end('quit'); };
  const destroy = () => { cancelAnimationFrame(rafId); G = null; Pad.active = null; };
  MG.Facts = Facts; MG.Pad = Pad;
  MG.Game = { init, start, fire, choose, useSuper, pause, resume, quit, cardSolved, destroy, resize, getState, get running() { return !!G && G.state !== 'ended'; }, get pad() { return gamePad; } };
})(window.MG);
