/* data.js — 기억상자 상수·샘플 콘텐츠·샘플 데이터 생성기(모든 이름은 가상, 공통 샘플 명단 '가온초등학교 5학년 2반') */
'use strict';

const APP_DATA = {
  school: '가온초등학교', className: '5학년 2반', teacher: '이가람',
  // 오답 원인 태그
  REASONS: [
    { key: 'concept', label: '개념 부족', short: '개념' },
    { key: 'misread', label: '문제 잘못 읽음', short: '읽기' },
    { key: 'calc', label: '계산·표기 실수', short: '계산' },
    { key: 'time', label: '시간 부족', short: '시간' },
    { key: 'unknown', label: '몰랐음·찍었음', short: '몰랐음' },
  ],
  SUBJECTS: ['국어', '수학', '사회', '과학', '영어', '기타'],
  SUBJECT_KEY: { '국어': 'ko', '수학': 'ma', '사회': 'so', '과학': 'sc', '영어': 'en', '기타': 'etc' },
  CONF: { 1: '모르겠어요', 2: '애매해요', 3: '확실해요' },
  QUAD: { know: '알고 맞힘', lucky: '운 좋게 맞힘', illusion: '착각(확신했는데 틀림)', aware: '모르는 걸 알았어' },
  PROFILE_EMOJIS: ['🐳', '🦊', '🐼', '🐥', '🦉', '🐢', '🦄', '🐙'],
  CSV_HEADER: ['앞면', '뒷면', '힌트', '유형', '원인'],
  CSV_TEMPLATE: [['앞면', '뒷면', '힌트', '유형', '원인'], ['용질이 용매에 골고루 섞이는 현상', '용해', '설탕이 물에 녹는 것', '암기', ''], ['2/3 + 1/4 = ?', '11/12', '통분 먼저', '오답', '개념'], ['between', '~사이에', 'A and B', '암기', '']],
};

/* ---------- 샘플 카드 콘텐츠 ---------- */
const SAMPLE_CONTENT = {
  dictation: [["'할께요'와 '할게요' 중 맞는 것", '할게요'], ['웬지 / 왠지 중 맞는 것', '왠지'], ["'며칠'과 '몇일' 중 맞는 것", '며칠'], ["'금세'와 '금새' 중 맞는 것", '금세'], ["'오랜만에'와 '오랬만에' 중 맞는 것", '오랜만에'], ["'설레다'와 '설레이다' 중 맞는 것", '설레다'], ["'깨끗이'와 '깨끗히' 중 맞는 것", '깨끗이'], ["'곰곰이'와 '곰곰히' 중 맞는 것", '곰곰이'], ["'나 ___?'에 들어갈 말: 어떡해 / 어떻게", '어떡해'], ["문장 끝에 맞는 것: '안 되' / '안 돼'", '안 돼'], ["'감기가 ___'에 맞는 것: 낳다 / 낫다", '낫다'], ["'소원'의 뜻으로 맞는 것: 바람 / 바램", '바람'], ["'역할'과 '역활' 중 맞는 것", '역할'], ["'희한하다'와 '희안하다' 중 맞는 것", '희한하다'], ["'선생님이 ___'에 맞는 것: 가르치다 / 가리키다", '가르치다'], ["'모양이 서로 ___'에 맞는 것: 다르다 / 틀리다", '다르다'], ["'뵙겠습니다'와 '봽겠습니다' 중 맞는 것", '뵙겠습니다'], ["'문득'과 '문뜩' 중 표준어", '문득'], ["'일찍이'와 '일찌기' 중 맞는 것", '일찍이'], ["'굳이'와 '구지' 중 맞는 것", '굳이']],
  english: [['library', '도서관'], ['hospital', '병원'], ['between', '~사이에'], ['museum', '박물관'], ['bakery', '빵집'], ['straight', '곧장, 똑바로'], ['corner', '모퉁이'], ['behind', '~뒤에'], ['across from', '~건너편에'], ['station', '역'], ['post office', '우체국'], ['restaurant', '식당'], ['turn left', '왼쪽으로 돌다'], ['next to', '~옆에'], ['bank', '은행'], ['park', '공원']],
  social: [['남한에서 가장 긴 강', '낙동강'], ['우리나라에서 가장 높은 산', '백두산'], ['우리나라 남쪽 끝에 있는 섬', '마라도'], ['우리나라 동쪽 끝에 있는 섬', '독도'], ['동쪽이 높고 서쪽이 낮은 우리 국토의 지형 특징', '동고서저'], ['한반도의 등줄기라 불리는 산맥', '태백산맥'], ['1년 동안 내린 비·눈의 양', '강수량'], ['땅의 생김새를 뜻하는 말', '지형'], ['우리나라에서 인구가 가장 많이 모여 사는 지역', '수도권'], ['하천 주변의 넓고 평평한 땅', '평야'], ['바다에 둘러싸인 땅', '섬'], ['특별시·광역시·도처럼 나라를 나눈 구역', '행정 구역']],
  science: [['용질이 용매에 골고루 섞이는 현상', '용해'], ['다른 물질에 녹는 물질', '용질'], ['다른 물질을 녹이는 물질', '용매'], ['용질이 용매에 골고루 섞여 있는 물질', '용액'], ['물의 온도가 높아지면 설탕이 녹는 양은?', '많아진다'], ['소금 10g을 물 100g에 녹인 용액의 무게', '110g'], ['용액의 진하기를 비교하는 방법 한 가지', '같은 물체(방울토마토)를 띄워 뜨는 높이 비교'], ['같은 양의 물에 더 많이 녹는 것: 소금 vs 설탕', '설탕'], ['소금물에서 용매는?', '물'], ['용해되지 않고 가라앉는 예', '흙탕물의 흙']],
  // 수학 오답: [단원, 앞면, 내 답, 뒷면, 조심할 점, 원인]
  math: [
    ['분수의 덧셈과 뺄셈', '2/3 + 1/4 = ?', '3/7', '11/12', '통분 먼저!', 'concept'],
    ['분수의 덧셈과 뺄셈', '5/6 - 1/3 = ?', '4/3', '1/2', '빼기인데 더하지 않기', 'calc'],
    ['분수의 덧셈과 뺄셈', '1 1/2 + 2 1/3 = ?', '3 2/5', '3 5/6', '자연수끼리, 분수끼리', 'calc'],
    ['분수의 덧셈과 뺄셈', '3/4 - 1/6 = ?', '2/2', '7/12', '분모는 그대로!', 'calc'],
    ['분수의 덧셈과 뺄셈', '2/5 + 3/10 = ?', '5/10', '7/10', '2/5 = 4/10', 'calc'],
    ['분수의 덧셈과 뺄셈', '4 1/4 - 1 3/4 = ?', '3 2/4', '2 1/2', '받아내림 확인', 'calc'],
    ['약분과 통분', '12/18을 기약분수로', '6/9', '2/3', '최대공약수로 한 번에', 'calc'],
    ['약분과 통분', '3/4과 5/6을 최소공배수로 통분하면?', '18/24, 20/24', '9/12, 10/12', '최소공배수 12', 'concept'],
    ['약분과 통분', '24와 36의 최대공약수', '6', '12', '공약수 중 가장 큰 수', 'concept'],
    ['약분과 통분', '8/12과 크기가 같은 분수(분모 3)', '3/3', '2/3', '분모·분자를 같은 수로', 'time'],
    ['다각형의 둘레와 넓이', '가로 7cm, 세로 4cm 직사각형의 둘레', '28cm', '22cm', '둘레는 더하기, 넓이는 곱하기', 'misread'],
    ['다각형의 둘레와 넓이', '한 변 6cm 정사각형의 넓이', '24cm', '36cm²', '단위 cm² 쓰기', 'misread'],
    ['다각형의 둘레와 넓이', '밑변 8cm, 높이 5cm 평행사변형의 넓이', '13cm²', '40cm²', '밑변×높이', 'unknown'],
    ['다각형의 둘레와 넓이', '밑변 10cm, 높이 6cm 삼각형의 넓이', '60cm²', '30cm²', '÷2 잊지 않기', 'calc'],
  ],
  reflections: ['통분하고 분자만 더해야 하는데 분모도 더했다', '왠지는 왜인지가 줄어든 말이라 ㅐ', 'between은 둘 사이, among은 여럿 사이', '둘레는 변을 다 더하고 넓이는 곱한다', '용매는 녹이는 것, 용질은 녹는 것'],
};

/* ---------- 교사 모드 샘플 학급(6명, 공통 명단) ---------- */
// [학생, 단원, 원인, 장수, 틀림 횟수 합]
const TEACHER_SAMPLE_ROWS = [
  ['박서아', '분수의 덧셈과 뺄셈', 'calc', 4, 9], ['한수아', '분수의 덧셈과 뺄셈', 'calc', 4, 8], ['최민준', '분수의 덧셈과 뺄셈', 'concept', 3, 7], ['이도윤', '분수의 덧셈과 뺄셈', 'concept', 2, 4], ['이도윤', '분수의 덧셈과 뺄셈', 'calc', 1, 2], ['정하윤', '분수의 덧셈과 뺄셈', 'misread', 3, 5],
  ['최민준', '약분과 통분', 'concept', 3, 6], ['송민재', '약분과 통분', 'concept', 2, 3], ['송민재', '약분과 통분', 'unknown', 1, 2], ['정하윤', '약분과 통분', 'concept', 1, 1], ['정하윤', '약분과 통분', 'time', 1, 1], ['이도윤', '약분과 통분', 'time', 1, 2],
  ['정하윤', '다각형의 둘레와 넓이', 'misread', 2, 3], ['박서아', '다각형의 둘레와 넓이', 'misread', 2, 3], ['박서아', '다각형의 둘레와 넓이', 'calc', 1, 1], ['송민재', '다각형의 둘레와 넓이', 'unknown', 2, 3],
  ['한수아', '소수의 곱셈', 'calc', 2, 3], ['송민재', '소수의 곱셈', 'unknown', 2, 2],
];
const TEACHER_SAMPLE_STATS = { '박서아': [34, 71, 3], '한수아': [28, 68, 2], '최민준': [22, 60, 1], '이도윤': [19, 64, 1], '정하윤': [41, 78, 5], '송민재': [6, 50, 0] };
const UNIT_FRONTS = { '분수의 덧셈과 뺄셈': ['2/3 + 1/4', '5/6 - 1/3', '1 1/2 + 2 1/3', '3/4 - 1/6'], '약분과 통분': ['12/18 기약분수', '3/4, 5/6 통분', '24와 36의 최대공약수'], '다각형의 둘레와 넓이': ['직사각형 둘레 7×4', '정사각형 넓이 6cm', '삼각형 넓이 10×6'], '소수의 곱셈': ['0.3 × 0.4', '1.2 × 5'] };
// 샘플 학급을 요약 파일 구조로 변환
function buildTeacherSample(today) {
  const map = {};
  TEACHER_SAMPLE_ROWS.forEach(([name, unit, reason, n, fails]) => {
    const s = map[name] || (map[name] = { studentName: name, exportedAt: addDays(today, -1) + 'T16:00:00', importedAt: '', decks: [{ name: '수학 오답노트', subject: '수학', unit: '5학년 1학기', total: 0, boxes: [0, 0, 0, 0, 0] }], wrong: [], stats: {} });
    // 틀림 횟수 합(fails)을 n장에 정확히 나눠 담는다(앞쪽 카드부터 나머지 1씩)
    for (let i = 0; i < n; i++) { const f = UNIT_FRONTS[unit][i % UNIT_FRONTS[unit].length]; s.wrong.push({ deck: '수학 오답노트', unit, front: f + (i >= UNIT_FRONTS[unit].length ? ' (' + (i + 1) + ')' : ''), reason, fails: Math.max(1, Math.floor(fails / n) + (i < fails % n ? 1 : 0)), lastFail: addDays(today, -(i + 2)) }); }
  });
  Object.values(map).forEach(s => { const [rv, acc, st] = TEACHER_SAMPLE_STATS[s.studentName]; s.stats = { reviewed30d: rv, accuracy30d: acc, streak: st }; s.decks[0].total = s.wrong.length + 6; s.decks[0].boxes = [s.wrong.length, 3, 2, 1, 0]; });
  return Object.values(map);
}

/* ---------- 샘플 프로필 생성기 ---------- */
// 오늘 날짜 기준 상대 날짜로 프로필 2개(김하늘·이도윤)의 전체 데이터를 만든다
function buildSampleData(today) {
  const rnd = mulberry32(20260517);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const mkDeck = (name, subject, unit) => ({ id: uid(), name, subject, unit, color: APP_DATA.SUBJECT_KEY[subject], createdAt: addDays(today, -60), source: 'sample' });
  const mkCard = (deckId, pair, box, extra) => Object.assign({ id: uid(), deckId, type: 'memo', front: pair[0], back: pair[1], hint: '', note: '', myAnswer: '', reason: null, failReasons: [], drawing: null, box, mastered: false, due: addDays(today, 1 + Math.floor(rnd() * 20)), lastReviewed: addDays(today, -1 - Math.floor(rnd() * 6)), createdAt: addDays(today, -50 + Math.floor(rnd() * 30)), history: [] }, extra || {});
  // 상자 배정표로 카드 생성
  const spread = (deckId, pairs, boxPlan, extraFn) => { const out = []; let i = 0; boxPlan.forEach((cnt, bi) => { for (let k = 0; k < cnt; k++, i++) out.push(mkCard(deckId, pairs[i], bi + 1, extraFn ? extraFn(pairs[i], i) : null)); }); return out; };

  /* 김하늘: 덱 5개·카드 72장 */
  const d1 = mkDeck('받아쓰기 5급', '국어', '5-2 받아쓰기'), d2 = mkDeck('영어 5학년 Unit 4 단어', '영어', 'Unit 4 Where is the library?'), d3 = mkDeck('사회 5-1 국토와 우리 생활', '사회', '국토와 우리 생활'), d4 = mkDeck('과학 5-1 용해와 용액', '과학', '용해와 용액'), d5 = mkDeck('수학 오답노트', '수학', '분수의 덧셈과 뺄셈 외');
  const mathPairs = SAMPLE_CONTENT.math.map(m => [m[1], m[3], m]);
  const cards = [
    ...spread(d1.id, SAMPLE_CONTENT.dictation, [4, 5, 5, 4, 2]),
    ...spread(d2.id, SAMPLE_CONTENT.english, [3, 4, 3, 3, 3], (p, i) => ({ hint: i % 3 === 0 ? '교과서 Unit 4 그림 사전' : '' })),
    ...spread(d3.id, SAMPLE_CONTENT.social, [2, 3, 3, 2, 2]),
    ...spread(d4.id, SAMPLE_CONTENT.science, [2, 3, 2, 2, 1]),
    ...spread(d5.id, mathPairs, [3, 3, 3, 3, 2], p => { const m = p[2]; return { type: 'wrong', myAnswer: m[2], note: m[4], reason: m[5], failReasons: [m[5]], hint: m[0] }; }),
  ];
  // 숙달 3장(5상자), 반복 오류 1장('5/6 - 1/3')
  cards.filter(c => c.box === 5).slice(0, 3).forEach(c => { c.mastered = true; c.due = addDays(today, 10 + Math.floor(rnd() * 15)); });
  const rep = cards.find(c => c.front === '5/6 - 1/3 = ?'); rep.failReasons = ['calc', 'calc', 'calc']; rep.box = 1;
  rep.history = [-9, -6, -3].map(n => ({ d: addDays(today, n), r: 'fail', c: 3, from: 1, to: 1, reason: 'calc' }));
  // 복습 이력 몇 개(4분면 통계 재료)
  cards.forEach(c => { if (c.history.length || rnd() > 0.5) return; const d = c.lastReviewed; const ok = rnd() > 0.25; c.history.push({ d, r: ok ? 'ok' : 'fail', c: ok ? 3 : pick([1, 2, 3]), from: Math.max(1, c.box - 1), to: c.box, reason: ok ? null : c.reason }); });
  // 오늘 큐: 밀림 3장(오늘-1~-3) + 오늘 8장 = 11장. 수학 2장·2상자 카드 포함
  const overdue = [rep, cards.find(c => c.deckId === d1.id && c.box === 1), cards.find(c => c.deckId === d2.id && c.box === 2)];
  overdue.forEach((c, i) => { c.due = addDays(today, -(i + 1)); });
  cards.find(c => c.deckId === d5.id && c.box === 2).due = today;
  // 시험 1건: 수학 5단원 단원평가(오늘+12) → 재분배(앞당기기) 후 나머지 덱에서 채워 오늘 큐를 정확히 11장으로
  const exam = { id: uid(), title: '수학 5단원 단원평가', date: addDays(today, 12), deckIds: [d5.id], createdAt: addDays(today, -2), plan: {}, status: 'active' };
  exam.plan = applyExamPlan(cards, exam.deckIds, exam.date, today);
  const groups = [cards.filter(c => c.box === 2 && c.deckId !== d5.id), cards.filter(c => c.box === 3), cards.filter(c => c.box === 4), cards.filter(c => c.box === 5 && !c.mastered)].map(g => g.filter(c => c.due > today));
  const fill = []; for (let i = 0; i < 6; i++) groups.forEach(g => { if (g[i]) fill.push(g[i]); });
  for (const c of fill) { if (cards.filter(x => x.due <= today).length >= 11) break; c.due = today; }
  // 일일 기록: 지난 56일 중 38일, 어제부터 6일 연속, 오늘 0 → 스트릭 6
  const dailyLog = {}; const days = [];
  for (let k = 1; k <= 56; k++) days.push(addDays(today, -k));
  const chosen = new Set(days.slice(0, 6));
  while (chosen.size < 38) chosen.add(pick(days.slice(7))); // 오늘-7은 비워 스트릭이 정확히 6이 되게
  chosen.forEach(d => { const r = 3 + Math.floor(rnd() * 20); dailyLog[d] = { reviewed: r, correct: Math.round(r * (0.6 + rnd() * 0.3)) }; });
  // 세션 14건(4분면 know 55 / lucky 20 / illusion 10 / aware 15), 되새김 5건
  const sessions = [], reflections = [];
  [...chosen].sort().slice(-14).forEach((d, i) => {
    const cnt = dailyLog[d].reviewed, know = Math.round(cnt * 0.55), lucky = Math.round(cnt * 0.2), illusion = Math.round(cnt * 0.1), aware = cnt - know - lucky - illusion;
    const s = { id: uid(), date: d, startedAt: d + 'T19:00:00', endedAt: d + 'T19:12:00', count: cnt, ok: know + lucky, fail: illusion + aware, quadrants: { know, lucky, illusion, aware }, moves: { up: know, down: illusion + aware, stay: lucky }, reasons: { concept: Math.round(aware * 0.3), misread: 0, calc: Math.round(aware * 0.5), time: 0, unknown: illusion }, coaching: '', reflectionId: null, kind: 'today' };
    if (i >= 9) { const r = { id: uid(), date: d, sessionId: s.id, text: SAMPLE_CONTENT.reflections[i - 9] }; reflections.unshift(r); s.reflectionId = r.id; } // 최신이 앞
    sessions.push(s);
  });
  const haneul = { decks: [d1, d2, d3, d4, d5], cards, sessions, dailyLog, reflections, exams: [exam], pendingSession: null, weeklyChecks: [] };

  /* 이도윤: 덱 2개·22장, 오늘 큐 9장, 스트릭 0 */
  const e1 = mkDeck('영어 5학년 Unit 4 단어', '영어', 'Unit 4 Where is the library?'), e2 = mkDeck('수학 오답노트', '수학', '분수의 덧셈과 뺄셈');
  const cards2 = [...spread(e1.id, SAMPLE_CONTENT.english, [9, 7, 0, 0, 0]), ...spread(e2.id, mathPairs.slice(0, 6), [4, 2, 0, 0, 0], p => { const m = p[2]; const reason = ['concept', 'concept', 'calc', 'concept', 'misread', 'concept'][mathPairs.indexOf(p)]; return { type: 'wrong', myAnswer: m[2], note: m[4], reason, failReasons: [reason], hint: m[0] }; })];
  cards2.forEach((c, i) => { c.due = i < 9 ? addDays(today, i < 2 ? -1 : 0) : addDays(today, 1 + (i % 6)); });
  const log2 = {}; [3, 4, 7, 10].forEach(k => { log2[addDays(today, -k)] = { reviewed: 6 + k, correct: 4 + k }; });
  const doyun = { decks: [e1, e2], cards: cards2, sessions: [], dailyLog: log2, reflections: [], exams: [], pendingSession: null, weeklyChecks: [] };

  const p1 = { id: 'p-haneul', name: '김하늘', emoji: '🐳', dailyGoal: 10, createdAt: addDays(today, -60), lastOpened: today };
  const p2 = { id: 'p-doyun', name: '이도윤', emoji: '🦊', dailyGoal: 8, createdAt: addDays(today, -30), lastOpened: addDays(today, -3) };
  return { meta: { version: 1, activeProfileId: p1.id, profiles: [p1, p2], settings: { teacherMode: false, reduceMotion: false }, intervals: INTERVALS }, profiles: { [p1.id]: haneul, [p2.id]: doyun } };
}
