/* data.js — 스테이지 메타·배지·스킨·공통 샘플 데이터·시딩 (전역 네임스페이스 window.MG) */
'use strict';
window.MG = window.MG || {};
(function (MG) {
  // 공통 샘플 데이터(가상의 학교·학급·학생)
  const APP_DATA = {
    school: '가온초등학교', teacher: '이가람', classLabel: '5학년 2반',
    students: ['김하늘(여)', '이도윤(남)', '박서아(여)', '최민준(남)', '정하윤(여)', '강시우(남)', '윤서준(남)', '장지우(여)', '임예준(남)', '한수아(여)',
      '오지호(남)', '서아린(여)', '신준서(남)', '권유나(여)', '황도현(남)', '안지아(여)', '송민재(남)', '류채원(여)', '홍태양(남)', '배소율(여)',
      '조현우(남)', '문다은(여)', '양은우(남)', '노시은(여)'],
  };
  MG.APP_DATA = APP_DATA;
  MG.VERSION = '1.0.0';
  MG.STORAGE_KEY = 'mathGuardians.v1';

  // 17개 스테이지 메타 (생성 규칙은 problems.js)
  const S = (id, grade, order, name, inputType, hintModel, gridFacts) => ({ id, grade, order, name, inputType, hintModel, gridFacts: !!gridFacts });
  MG.STAGES = [
    S('s1-1', 1, 1, '9까지의 덧셈', 'number', 'dots'), S('s1-2', 1, 2, '9까지의 뺄셈', 'number', 'dots'), S('s1-3', 1, 3, '받아올림 없는 두 자리 덧셈·뺄셈', 'number', 'column'),
    S('s2-1', 2, 1, '받아올림 있는 두 자리 덧셈', 'number', 'column'), S('s2-2', 2, 2, '받아내림 있는 두 자리 뺄셈', 'number', 'column'), S('s2-3', 2, 3, '곱셈구구', 'number', 'array', true),
    S('s3-1', 3, 1, '세 자리 수 덧셈·뺄셈', 'number', 'column'), S('s3-2', 3, 2, '나눗셈(곱셈구구 범위)', 'number', 'array'), S('s3-3', 3, 3, '(두 자리)×(한 자리)', 'number', 'text'), S('s3-4', 3, 4, '나머지가 있는 나눗셈', 'number', 'text'),
    S('s4-1', 4, 1, '(두 자리)×(두 자리)·(세 자리)÷(두 자리)', 'number', 'text'), S('s4-2', 4, 2, '분모가 같은 분수의 덧셈·뺄셈', 'choice3', 'bar'), S('s4-3', 4, 3, '소수의 덧셈·뺄셈', 'decimal', 'text'),
    S('s5-1', 5, 1, '최대공약수·최소공배수', 'number', 'text'), S('s5-2', 5, 2, '분모가 다른 분수의 덧셈·뺄셈', 'choice3', 'bar'), S('s5-3', 5, 3, '소수의 곱셈', 'decimal', 'text'),
    S('s6-1', 6, 1, '분수의 나눗셈', 'choice3', 'bar'), S('s6-2', 6, 2, '소수의 나눗셈', 'decimal', 'text'), S('s6-3', 6, 3, '비율과 백분율', 'number', 'text'),
  ];
  MG.stageById = id => MG.STAGES.find(s => s.id === id);
  MG.stageLabel = s => `${s.grade}-${s.order}`;
  MG.LOW_GRADE = ['s1-1', 's1-2', 's1-3', 's2-1', 's2-2'];

  // 배지 10종 (A8)
  MG.BADGES = [
    { id: 'first_kill', name: '첫 격파', icon: '🎯', desc: '몬스터를 처음 격파' }, { id: 'combo10', name: '콤보 10', icon: '🔥', desc: '한 판 최대 콤보 10 이상' },
    { id: 'combo20', name: '콤보 20', icon: '💥', desc: '한 판 최대 콤보 20 이상' }, { id: 'perfect', name: '철벽 수호', icon: '🛡️', desc: '성 피해 없이 스테이지 클리어' },
    { id: 'stars3x5', name: '별 사냥꾼', icon: '⭐', desc: '3★ 클리어 누적 5회' }, { id: 'gugudan', name: '구구단 마스터', icon: '📗', desc: '곱셈구구 72개 사실 모두 숙달(상자 2 이상)' },
    { id: 'revenge10', name: '복수 완료', icon: '👹', desc: '복수 몬스터 격파 누적 10' }, { id: 'boss10', name: '보스 헌터', icon: '👑', desc: '보스 격파 누적 10' },
    { id: 'streak7', name: '7일 연속', icon: '📅', desc: '오늘 포함 7일 연속 플레이' }, { id: 'problems1000', name: '천 문제', icon: '🏅', desc: '푼 문제 누적 1,000개' },
  ];
  // 스킨·테마 해금 (Σ 최고 별 기준)
  MG.SKINS = [{ id: 'basic', name: '기본 포탑', stars: 0 }, { id: 'gold', name: '황금 포탑', stars: 15 }, { id: 'crystal', name: '크리스탈 포탑', stars: 30 }];
  MG.THEMES = [{ id: 'meadow', name: '초원', stars: 0 }, { id: 'desert', name: '사막', stars: 6 }, { id: 'snow', name: '설원', stars: 18 }, { id: 'volcano', name: '화산', stars: 36 }];
  MG.AVATAR_NAMES = ['청록', '파랑', '주황', '초록', '빨강', '보라', '분홍', '노랑'];
  MG.SPEED_PRESETS = { slow: 0.75, normal: 1.0, fast: 1.3 };
  MG.MAX_PROFILES = 40;

  // 기본 설정값
  MG.defaultSettings = () => ({
    activeStageIds: MG.STAGES.map(s => s.id), speedPreset: 'normal', timeLimitMin: 5, rankingPublic: true, unlockAll: false, adaptive: true,
    lowGradeChoice: false, volume: 0.4, muted: false, lowSpec: false, bigText: false, teacherPin: null, classLabel: APP_DATA.classLabel,
  });
  // 빈 프로필 생성
  MG.newProfile = (name, grade, classNo, number, avatar) => ({
    id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, grade, classNo, number, avatar: avatar == null ? Math.floor(Math.random() * 8) : avatar,
    createdAt: new Date().toISOString(), skin: 'basic', theme: 'meadow',
    counters: { totalProblems: 0, totalCorrect: 0, revengeKills: 0, bossKills: 0, threeStarClears: 0 },
    badges: [], playDates: [], stageRecords: {}, facts: {}, history: [],
  });
  const dayISO = (d, h) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h || 15, 10, 0, 0); return t.toISOString(); };
  MG.localDate = d => { const t = d ? new Date(d) : new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

  // 샘플 기록 생성 보조: 스테이지 기록 1개
  const rec = (stageId, bestScore, bestStars, bestCombo, plays, acc, avgMs, daysAgo, clears) => {
    const total = plays * 30, correct = Math.round(total * acc), wrong = Math.round((total - correct) * 0.7), reached = total - correct - wrong;
    return { stageId, bestScore, bestStars, bestCombo, plays, clears: clears == null ? Math.max(1, plays - 1) : clears, correct, wrong, reached, avgMs, lastPlayedAt: dayISO(daysAgo) };
  };
  // 사실 1개 (problems.js 빌더로 문제·정답 문자열 생성)
  const fact = (stageId, p, box, hit, miss, daysAgo, masteredDaysAgo) => {
    const pr = MG.Problems.build(stageId, p);
    return { key: pr.key, stageId, p, box, hit, miss, lastAt: dayISO(daysAgo), masteredAt: masteredDaysAgo == null ? null : dayISO(masteredDaysAgo), answer: pr.answerText, question: pr.text };
  };
  const summary = (stageId, score, stars, correct, wrong, reached, maxCombo, avgMs, wrongKeys, endedBy, daysAgo) =>
    ({ stageId, score, stars, correct, wrong, reached, maxCombo, avgMs, revengeKills: wrongKeys.length ? 1 : 0, wrongKeys, endedBy, playedAt: dayISO(daysAgo) });
  const addFacts = (profile, list) => list.forEach(f => { profile.facts[f.key] = f; });
  const mul = (a, b) => ({ op: 'mul', a, b });

  // 첫 실행 샘플 시딩: 24명(6명은 기록 포함). 날짜는 시딩 시점 기준 상대값
  MG.seedSample = () => {
    const profiles = APP_DATA.students.map((s, i) => {
      const p = MG.newProfile(s.replace(/\(.\)$/, ''), 5, 2, i + 1, (i + 1) % 8);
      p.id = 'p_sample' + String(i + 1).padStart(2, '0'); p.createdAt = dayISO(30);
      return p;
    });
    const [haneul, doyun, seoa, minjun, hayun] = profiles; const sua = profiles[9];
    // (1) 김하늘 — 1~2학년 전부 클리어, 2-3 19,800 2★, 3-1 2★, 3-2 1★, 총 별 16, 황금 포탑
    haneul.avatar = 1; haneul.skin = 'gold';
    [rec('s1-1', 6200, 2, 9, 3, 0.9, 2800, 12), rec('s1-2', 5900, 2, 8, 2, 0.88, 3000, 11), rec('s1-3', 7400, 2, 10, 2, 0.86, 3600, 10), rec('s2-1', 11200, 3, 12, 3, 0.96, 3400, 8),
      rec('s2-2', 9800, 2, 11, 4, 0.85, 3900, 7), rec('s2-3', 19800, 2, 14, 6, 0.9, 2600, 2), rec('s3-1', 14200, 2, 12, 3, 0.84, 4200, 3), rec('s3-2', 8900, 1, 7, 2, 0.78, 3800, 1)]
      .forEach(r => { haneul.stageRecords[r.stageId] = r; });
    haneul.badges = [{ id: 'first_kill', at: dayISO(12) }, { id: 'combo10', at: dayISO(8) }, { id: 'perfect', at: dayISO(8) }];
    haneul.history = [summary('s3-2', 8900, 1, 36, 6, 2, 7, 3800, ['56÷7', '63÷9'], 'clear', 1), summary('s2-3', 19800, 2, 44, 4, 1, 14, 2600, ['6×9', '7×6'], 'clear', 2), summary('s3-1', 14200, 2, 40, 5, 0, 12, 4200, ['534−278'], 'clear', 3)];
    addFacts(haneul, [fact('s2-3', mul(6, 9), 1, 3, 2, 2), fact('s2-3', mul(7, 6), 1, 2, 2, 2), fact('s2-3', mul(7, 8), 3, 5, 0, 2, 9), fact('s2-3', mul(8, 8), 3, 4, 0, 2, 9), fact('s2-3', mul(9, 9), 2, 3, 1, 2, 9),
      fact('s3-2', { op: 'div', a: 56, b: 7 }, 0, 1, 2, 1), fact('s3-2', { op: 'div', a: 63, b: 9 }, 1, 2, 1, 1)]);
    // (2) 이도윤 — 약점 7개(8×7 오답 3회 등), 복수 몬스터·약점 출제 시연용
    doyun.avatar = 2;
    [rec('s1-1', 4100, 1, 6, 1, 0.8, 3300, 9, 1), rec('s2-1', 8700, 2, 9, 3, 0.83, 4100, 6), rec('s2-2', 7300, 1, 6, 4, 0.74, 4600, 4), rec('s2-3', 9600, 1, 8, 5, 0.72, 4800, 1)]
      .forEach(r => { doyun.stageRecords[r.stageId] = r; });
    doyun.badges = [{ id: 'first_kill', at: dayISO(9) }];
    doyun.history = [summary('s2-3', 9600, 1, 34, 9, 4, 8, 4800, ['8×7', '8×6', '9×8'], 'clear', 1), summary('s2-2', 7300, 1, 33, 8, 3, 6, 4600, ['62−27', '81−36'], 'clear', 4), summary('s2-3', 7100, 0, 20, 7, 3, 5, 5100, ['8×7', '6×7', '53−18'], 'gameover', 5)];
    addFacts(doyun, [fact('s2-3', mul(8, 7), 0, 1, 3, 1), fact('s2-3', mul(8, 6), 0, 1, 2, 1), fact('s2-3', mul(9, 8), 0, 0, 2, 1), fact('s2-3', mul(6, 7), 0, 1, 2, 5),
      fact('s2-2', { op: 'sub', a: 62, b: 27 }, 0, 0, 2, 4), fact('s2-2', { op: 'sub', a: 81, b: 36 }, 0, 1, 2, 4), fact('s2-2', { op: 'sub', a: 53, b: 18 }, 0, 1, 1, 5),
      fact('s2-3', mul(2, 5), 3, 4, 0, 1, 9), fact('s2-3', mul(3, 4), 3, 3, 0, 1, 9), fact('s2-3', mul(5, 5), 2, 2, 0, 1, 9), fact('s2-3', mul(4, 6), 2, 2, 1, 1, 9), fact('s2-3', mul(9, 2), 2, 2, 0, 1, 9)]);
    // (3) 박서아 — 어제까지 7일 연속 플레이(streak7), 최근 7일 숙달 18개(성장 1위), 총 별 11
    seoa.avatar = 3;
    [rec('s1-1', 7000, 3, 11, 2, 0.97, 2300, 8), rec('s1-2', 5600, 2, 9, 2, 0.9, 2500, 7), rec('s1-3', 6900, 2, 10, 3, 0.88, 3100, 6), rec('s2-3', 15300, 2, 12, 6, 0.9, 2900, 1), rec('s3-2', 11800, 2, 10, 4, 0.87, 3200, 2)]
      .forEach(r => { seoa.stageRecords[r.stageId] = r; });
    seoa.playDates = [7, 6, 5, 4, 3, 2, 1].map(d => MG.localDate(dayISO(d)));
    seoa.badges = [{ id: 'first_kill', at: dayISO(8) }, { id: 'combo10', at: dayISO(3) }, { id: 'streak7', at: dayISO(1) }];
    seoa.history = [summary('s2-3', 15300, 2, 42, 4, 1, 12, 2900, ['7×9'], 'clear', 1), summary('s3-2', 11800, 2, 40, 5, 1, 10, 3200, ['72÷8'], 'clear', 2), summary('s2-3', 13100, 2, 41, 6, 0, 9, 3100, ['7×9', '8×6'], 'clear', 3)];
    const seoaFacts = []; let n = 0;
    for (let a = 2; a <= 9 && n < 18; a++) for (let b = 2; b <= 9 && n < 18; b += 3) { seoaFacts.push(fact('s2-3', mul(a, b), 2, 3, 1, 1 + (n % 6), 1 + (n % 6))); n++; }
    addFacts(seoa, seoaFacts.concat([fact('s2-3', mul(7, 9), 1, 2, 2, 1), fact('s3-2', { op: 'div', a: 72, b: 8 }, 1, 2, 1, 2)]));
    // (4) 최민준 — 2-3 3★ 28,400 콤보 31, 3-1 3★, 3-3 2★, 총 별 19, 사막 테마·황금 포탑
    minjun.avatar = 4; minjun.theme = 'desert'; minjun.skin = 'gold';
    [rec('s1-1', 6800, 2, 10, 2, 0.92, 2200, 14), rec('s1-2', 6100, 2, 9, 1, 0.9, 2400, 13, 1), rec('s1-3', 7600, 2, 10, 2, 0.9, 2900, 12), rec('s2-1', 10900, 2, 12, 2, 0.9, 3000, 11), rec('s2-2', 9900, 2, 11, 2, 0.88, 3300, 10),
      rec('s2-3', 28400, 3, 31, 9, 0.98, 2100, 1), rec('s3-1', 21700, 3, 19, 4, 0.96, 3500, 3), rec('s3-2', 9100, 1, 8, 2, 0.8, 3700, 5), rec('s3-3', 12100, 2, 11, 3, 0.85, 4300, 2)]
      .forEach(r => { minjun.stageRecords[r.stageId] = r; });
    minjun.counters = { totalProblems: 810, totalCorrect: 740, revengeKills: 6, bossKills: 7, threeStarClears: 4 };
    minjun.badges = [{ id: 'first_kill', at: dayISO(14) }, { id: 'combo10', at: dayISO(9) }, { id: 'combo20', at: dayISO(4) }, { id: 'perfect', at: dayISO(3) }];
    minjun.history = [summary('s2-3', 28400, 3, 50, 0, 0, 31, 2100, [], 'clear', 1), summary('s3-3', 12100, 2, 43, 5, 1, 11, 4300, ['47×8', '68×7'], 'clear', 2), summary('s3-1', 21700, 3, 49, 1, 0, 19, 3500, ['615−287'], 'clear', 3)];
    addFacts(minjun, [fact('s3-3', mul(47, 8), 1, 2, 2, 2), fact('s3-3', mul(68, 7), 1, 1, 1, 2), fact('s2-3', mul(7, 8), 3, 6, 0, 1, 12), fact('s2-3', mul(9, 6), 3, 5, 0, 1, 12)]);
    // (5) 정하윤 — 2학년 전부 3★, 3-2 3★, 3-4 2★, 총 별 23, stars3x5·boss10, 구구단 72개 중 60개 숙달
    hayun.avatar = 5;
    [rec('s1-1', 6400, 2, 9, 2, 0.9, 2500, 20), rec('s1-2', 6000, 2, 8, 2, 0.9, 2600, 19), rec('s1-3', 8100, 3, 11, 2, 0.96, 2900, 18), rec('s2-1', 12900, 3, 15, 3, 0.97, 3000, 15), rec('s2-2', 12200, 3, 14, 3, 0.96, 3200, 13),
      rec('s2-3', 24150, 3, 22, 8, 0.97, 2300, 4), rec('s3-1', 9900, 1, 8, 2, 0.8, 4000, 9), rec('s3-2', 20500, 3, 18, 5, 0.96, 2700, 6), rec('s3-3', 9400, 1, 8, 2, 0.79, 4400, 8), rec('s3-4', 13600, 2, 12, 3, 0.86, 4100, 2)]
      .forEach(r => { hayun.stageRecords[r.stageId] = r; });
    hayun.counters = { totalProblems: 960, totalCorrect: 880, revengeKills: 9, bossKills: 11, threeStarClears: 6 };
    hayun.badges = [{ id: 'first_kill', at: dayISO(20) }, { id: 'combo10', at: dayISO(15) }, { id: 'perfect', at: dayISO(15) }, { id: 'stars3x5', at: dayISO(6) }, { id: 'boss10', at: dayISO(4) }];
    hayun.history = [summary('s3-4', 13600, 2, 44, 4, 1, 12, 4100, ['59÷7 나머지'], 'clear', 2), summary('s2-3', 24150, 3, 50, 1, 0, 22, 2300, ['9×7'], 'clear', 4), summary('s3-2', 20500, 3, 49, 2, 0, 18, 2700, [], 'clear', 6), summary('s3-3', 9400, 1, 38, 8, 2, 8, 4400, ['76×9'], 'clear', 8)];
    const hayunFacts = []; let k = 0;
    for (let a = 2; a <= 9; a++) for (let b = 1; b <= 9; b++) { const weak = k % 6 === 5; hayunFacts.push(weak ? fact('s2-3', mul(a, b), 1, 2, 1, 4) : fact('s2-3', mul(a, b), k % 3 ? 3 : 2, 4, 0, 4, 12 + (k % 9))); k++; }
    addFacts(hayun, hayunFacts.concat([fact('s3-4', { op: 'divr', a: 59, b: 7 }, 0, 1, 2, 2)]));
    // (6) 한수아 — 1-1 1★ 3,200점 1회만
    sua.avatar = 7;
    sua.stageRecords['s1-1'] = rec('s1-1', 3200, 1, 5, 1, 0.75, 4600, 3, 1);
    sua.badges = [{ id: 'first_kill', at: dayISO(3) }];
    sua.history = [summary('s1-1', 3200, 1, 30, 7, 3, 5, 4600, ['4+5', '3+6'], 'clear', 3)];
    addFacts(sua, [fact('s1-1', { op: 'add', a: 4, b: 5 }, 0, 1, 2, 3), fact('s1-1', { op: 'add', a: 3, b: 6 }, 1, 1, 1, 3)]);
    // 공통 카운터·플레이 날짜 보정
    profiles.forEach(p => {
      const recs = Object.values(p.stageRecords);
      if (!recs.length) return;
      const tp = recs.reduce((s, r) => s + r.correct + r.wrong + r.reached, 0), tc = recs.reduce((s, r) => s + r.correct, 0);
      if (!p.counters.totalProblems) p.counters = { totalProblems: tp, totalCorrect: tc, revengeKills: p.counters.revengeKills, bossKills: Math.min(6, recs.reduce((s, r) => s + r.clears, 0)), threeStarClears: recs.filter(r => r.bestStars === 3).length };
      if (!p.playDates.length) p.playDates = [...new Set(recs.map(r => MG.localDate(r.lastPlayedAt)))].sort();
    });
    return { schemaVersion: 1, seededAt: new Date().toISOString(), savedAt: null, activeProfileId: haneul.id, settings: MG.defaultSettings(), profiles };
  };
})(window.MG);
