/* audio.js — Web Audio 합성 효과음 9종(A11). 오디오 파일 0개, 첫 사용자 입력 후 AudioContext 생성 */
'use strict';
(function (MG) {
  let ctx = null, master = null, noiseBuf = null, active = 0;
  const state = { volume: 0.4, muted: false };
  const MAX_NODES = 16;
  // 첫 pointerdown/keydown에서 호출: 컨텍스트 생성·resume
  const init = () => {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        applyVolume();
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (e) { ctx = null; }
  };
  const applyVolume = () => { if (master) master.gain.value = state.muted ? 0 : state.volume; };
  // 게인 엔벨로프(attack 5ms → decay 후 0) 노드를 만들고 소스를 연결
  const env = (src, peak, dur, at, filter) => {
    if (active >= MAX_NODES) return;
    const g = ctx.createGain(); const t0 = at == null ? ctx.currentTime : at;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    if (filter) { src.connect(filter); filter.connect(g); } else src.connect(g);
    g.connect(master); active++;
    src.start(t0); src.stop(t0 + dur + 0.02); src.onended = () => { active--; };
  };
  const tone = (type, freq, dur, peak, at, freqEnd, filter) => {
    const o = ctx.createOscillator(); o.type = type; const t0 = at == null ? ctx.currentTime : at;
    o.frequency.setValueAtTime(freq, t0); if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    env(o, peak == null ? 0.3 : peak, dur, t0, filter);
  };
  const noise = (dur, peak, at, filter) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; env(s, peak, dur, at, filter); };
  const seq = (type, notes, durs, peak) => { let t = ctx.currentTime; notes.forEach((f, i) => { const d = (durs[i] || durs[0]) / 1000; tone(type, f, d, peak, t); t += d; }); };
  const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
  const sounds = {
    shoot: () => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1; noise(0.08, 0.5, null, f); },
    hit: () => seq('triangle', [C5, E5, G5], [60], 0.3),
    combo: combo => tone('square', 440 * Math.pow(2, Math.min(combo, 24) / 12), 0.08, 0.15),
    wrong: () => { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; tone('sawtooth', 110, 0.25, 0.35, null, 0, f); },
    damage: () => { tone('sine', 60, 0.3, 0.6); noise(0.15, 0.3); },
    boss: () => { for (let i = 0; i < 4; i++) tone('sine', 150, 0.12, 0.6, ctx.currentTime + i * 0.5, 40); },
    waveClear: () => seq('triangle', [C5, D5, E5, G5, C6], [90], 0.3),
    fanfare: () => seq('square', [C5, E5, G5, C6, G5, C6], [90, 90, 90, 180, 90, 360], 0.2),
    superSkill: () => tone('sawtooth', 200, 0.4, 0.3, null, 1200),
    revenge: () => seq('sawtooth', [220, 330, 440, 660], [50], 0.2),
    star: () => seq('triangle', [G5, C6], [80], 0.3),
    badge: () => seq('square', [E5, G5, C6, E5 * 2], [70], 0.15),
  };
  // 효과음 재생(음소거면 노드 생성 자체를 생략)
  const play = (name, arg) => { if (!ctx || state.muted || !sounds[name]) return; try { sounds[name](arg); } catch (e) { /* 오디오 실패는 무시 */ } };
  const setVolume = v => { state.volume = Math.max(0, Math.min(1, v)); applyVolume(); };
  const setMuted = m => { state.muted = !!m; applyVolume(); };
  MG.Audio = { init, play, setVolume, setMuted, get muted() { return state.muted; }, get ready() { return !!ctx; } };
})(window.MG);
