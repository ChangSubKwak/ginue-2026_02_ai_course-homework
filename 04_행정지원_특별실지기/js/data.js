'use strict';
/* 특별실지기 — data.js
   샘플 데이터 정의(경인초등학교 2026학년도 2학기). 자원·학급·교사·학사일정은 그대로 쓰고,
   정기 예약 시리즈와 단건 예약 계획은 core.js의 buildSampleData()가 실제 충돌 검사로 전개한다.
   모든 인물·학교는 가상이며 학생 개인 데이터는 다루지 않는다. */
const APP_DATA = (() => {
  // 교시 구조(1~6교시 + 방과후 2개)
  const periods = [
    { key: 1, label: '1교시', time: '09:00~09:40' }, { key: 2, label: '2교시', time: '09:50~10:30' },
    { key: 3, label: '3교시', time: '10:40~11:20' }, { key: 4, label: '4교시', time: '11:30~12:10' },
    { key: 5, label: '5교시', time: '13:10~13:50' }, { key: 6, label: '6교시', time: '14:00~14:40' },
    { key: 7, label: '방과후1', time: '14:50~15:30' }, { key: 8, label: '방과후2', time: '15:40~16:20' },
  ];
  const settings = {
    schoolName: '경인초등학교', schoolYear: 2026, semester: 2,
    semesterStart: '2026-09-01', semesterEnd: '2026-12-31', periods, approvalLine: ['담당', '부장', '교감'],
  };
  // 학급 18개와 담임(공통 샘플 담임 '이가람'은 5-2)
  const homerooms = [
    ['1-1', '전미래'], ['1-2', '곽보라'], ['1-3', '남궁솔'], ['2-1', '차은하'], ['2-2', '유재민'], ['2-3', '진세라'],
    ['3-1', '하민석'], ['3-2', '표지원'], ['3-3', '설다정'], ['4-1', '마준혁'], ['4-2', '변서영'], ['4-3', '심규리'],
    ['5-1', '탁영진'], ['5-2', '이가람'], ['5-3', '피현수'], ['6-1', '국태민'], ['6-2', '도연희'], ['6-3', '봉수진'],
  ];
  const specialists = [['류은채', '과학 전담'], ['고태양', '영어 전담'], ['서하율', '음악 전담'], ['한시우', '체육 전담'], ['임도현', '정보 전담']];
  const teachers = homerooms.map(([, name], i) => ({ id: 't_' + String(i + 1).padStart(2, '0'), name, role: '담임' }))
    .concat(specialists.map(([name, role], i) => ({ id: 't_' + String(homerooms.length + i + 1).padStart(2, '0'), name, role })));
  const classes = homerooms.map(([id], i) => ({ id, grade: Number(id.split('-')[0]), room: Number(id.split('-')[1]), teacherId: teachers[i].id }));
  const T = Object.fromEntries(teachers.map(t => [t.name, t.id])); // 이름 → 교사 id
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8];
  // 자원 색상 팔레트(자원 카드·칩 색 띠용 8색)
  const PALETTE = ['#2E7D4F', '#1E3A5F', '#B4532A', '#6D4C9F', '#C2185B', '#00796B', '#8D6E1A', '#546E7A'];
  const res = (id, name, type, quantity, extra) => Object.assign({
    id, name, type, quantity, group: '', manager: '', capacity: 0, color: PALETTE[1], availablePeriods: ALL.slice(),
    notice: '', priorityRule: null, active: true, updatedAt: 1756684800000,
  }, extra);
  const resources = [
    res('r_sci1', '과학실1', 'room', 1, { group: '과학실', manager: '류은채', capacity: 30, color: PALETTE[0], notice: '실험 후 기구 세척·환기, 약품은 전담 교사 입회하에 사용' }),
    res('r_sci2', '과학실2', 'room', 1, { group: '과학실', manager: '류은채', capacity: 30, color: PALETTE[5], notice: '현미경 세트 비치, 사용 후 덮개 씌우기' }),
    res('r_com', '컴퓨터실', 'room', 1, { group: '정보', manager: '임도현', capacity: 28, color: PALETTE[1], priorityRule: { grades: [5, 6], weekdays: [1, 2] }, notice: '월·화요일은 5~6학년 정보 수업 우선. 음식물 반입 금지' }),
    res('r_gym', '강당', 'room', 1, { group: '체육', manager: '한시우', capacity: 300, color: PALETTE[2], notice: '실내화 착용, 행사 준비 기간에는 차단될 수 있음' }),
    res('r_av', '시청각실', 'room', 1, { group: '시청각', manager: '임도현', capacity: 120, color: PALETTE[3], notice: '조명·음향 조작은 담당 교사 안내 후 사용' }),
    res('r_eng', '영어체험실', 'room', 1, { group: '영어', manager: '고태양', capacity: 30, color: PALETTE[4], availablePeriods: [1, 2, 3, 4, 5, 6], notice: '방과후 시간은 영어 방과후 전용' }),
    res('r_music', '음악실', 'room', 1, { group: '음악', manager: '서하율', capacity: 32, color: PALETTE[6], notice: '악기 사용 후 제자리 정리' }),
    res('r_tab', '태블릿 세트', 'equipment', 2, { group: '정보기기', manager: '임도현', capacity: 30, color: PALETTE[1], notice: '1세트 30대. 사용 후 충전함에 꽂고 수량 확인' }),
    res('r_beam', '이동식 빔프로젝터', 'equipment', 3, { group: '정보기기', manager: '임도현', capacity: 0, color: PALETTE[7], notice: '램프 보호를 위해 끈 뒤 3분 후 이동' }),
    res('r_kit', '과학 탐구 교구 세트', 'equipment', 4, { group: '과학교구', manager: '류은채', capacity: 0, color: PALETTE[0], notice: '세트당 모둠 6개 분량. 소모품 부족 시 과학실에 메모' }),
  ];
  // 학사일정 10건
  const ev = (id, title, type, dateStart, dateEnd, blockResourceIds, blockPeriods, memo) =>
    ({ id, title, type, dateStart, dateEnd: dateEnd || dateStart, blockResourceIds: blockResourceIds || [], blockPeriods: blockPeriods || 'all', memo: memo || '', updatedAt: 1756684800000 });
  const events = [
    ev('e_01', '추석 연휴', 'holiday', '2026-09-24', '2026-09-25'),
    ev('e_02', '개천절 대체공휴일', 'holiday', '2026-10-05'),
    ev('e_03', '한글날', 'holiday', '2026-10-09'),
    ev('e_04', '재량휴업일', 'dayoff', '2026-11-02', null, [], 'all', '학교장 재량휴업일'),
    ev('e_05', '운동회 연습', 'event', '2026-10-19', '2026-10-22', ['r_gym'], [5, 6], '학년별 단체 종목 연습'),
    ev('e_06', '운동회', 'event', '2026-10-23', null, ['r_gym'], 'all', '전교 운동회'),
    ev('e_07', '학예회 리허설', 'event', '2026-11-09', '2026-11-13', ['r_gym'], 'all', '무대 설치·학년별 리허설'),
    ev('e_08', '학예회', 'event', '2026-11-13', null, ['r_av'], 'all', '시청각실 학부모 공개'),
    ev('e_09', '영어 말하기 대회', 'event', '2026-11-20', null, ['r_eng'], [1, 2, 3, 4, 5, 6], '3~6학년 대표'),
    ev('e_10', '겨울방학식', 'event', '2026-12-31', null, resources.map(r => r.id), 'all', '방학식 후 하교'),
  ];
  // 정기 예약 시리즈 10개(요일 1=월 … 5=금). 과학실2 목 1~2교시는 비워 둔다(체험용).
  const sr = (resourceId, weekday, periodStart, periodEnd, classId, teacher, tag) =>
    ({ resourceId, weekday, periodStart, periodEnd, classId, teacherId: T[teacher], tag, qty: 1 });
  const sampleSeries = [
    sr('r_sci1', 2, 1, 2, '5-1', '류은채', '실험'), sr('r_sci1', 4, 3, 4, '5-2', '류은채', '실험'),
    sr('r_sci2', 2, 3, 4, '6-1', '류은채', '실험'), sr('r_sci2', 5, 1, 2, '6-2', '류은채', '실험'),
    sr('r_sci2', 4, 5, 6, '6-3', '류은채', '실험'),
    sr('r_com', 5, 2, 3, '6-1', '임도현', '탐구'), sr('r_com', 3, 5, 5, '6-2', '임도현', '탐구'),
    sr('r_com', 1, 2, 3, '6-3', '임도현', '탐구'),
    sr('r_eng', 1, 4, 4, '3-1', '고태양', '발표'), sr('r_music', 2, 5, 5, '4-2', '서하율', '음악'),
  ];
  // 고정 단건(시연용): 태블릿 10/20 3교시 2/2, 빔프로젝터 10/21 4교시 3/3, 강당 차단 기간 충돌 3건+운동회 연습 충돌 1건, 5-3 과학실 2회
  const fx = (resourceId, date, periodStart, periodEnd, classId, teacher, tag, qty, memo) =>
    ({ resourceId, date, periodStart, periodEnd, classId, teacherId: T[teacher], tag, qty: qty || 1, memo: memo || '' });
  const sampleFixed = [
    fx('r_tab', '2026-10-20', 3, 3, '3-2', '표지원', '탐구', 1, '조사 학습'),
    fx('r_tab', '2026-10-20', 3, 3, '3-3', '설다정', '탐구', 1, '디지털 교과서'),
    fx('r_beam', '2026-10-21', 4, 4, '4-1', '마준혁', '발표'), fx('r_beam', '2026-10-21', 4, 4, '4-3', '심규리', '영상'),
    fx('r_beam', '2026-10-21', 4, 4, '2-2', '유재민', '영상'),
    fx('r_gym', '2026-10-20', 5, 6, '4-1', '한시우', '체육', 1, '운동회 연습 전 예약분'),
    fx('r_gym', '2026-11-10', 3, 4, '4-1', '한시우', '체육'), fx('r_gym', '2026-11-11', 1, 2, '2-3', '진세라', '체육'),
    fx('r_gym', '2026-11-12', 5, 6, '6-2', '한시우', '체육'),
    fx('r_sci1', '2026-09-15', 5, 6, '5-3', '류은채', '실험', 1, '보강'), fx('r_sci1', '2026-10-27', 5, 6, '5-3', '류은채', '실험'),
  ];
  // 무작위 단건 계획(가중치·학급 후보·길이·교시 후보). 3학년은 교구·시청각 비중을 높여 형평성 편중을 만든다.
  const G = g => classes.filter(c => c.grade === g).map(c => c.id);
  const samplePlan = [
    { w: 3, resourceId: 'r_gym', classes: [].concat(G(1), G(2), G(3), G(4)), len: 2, periods: [1, 3, 5], tag: '체육', teacher: '한시우' },
    { w: 2, resourceId: 'r_music', classes: [].concat(G(1), G(2), G(3), G(5)), len: 1, periods: [1, 2, 3, 4, 6], tag: '음악', teacher: '서하율' },
    { w: 2, resourceId: 'r_av', classes: [].concat(G(3), G(3), G(4), G(6)), len: 1, periods: [2, 3, 4, 5], tag: '영상' },
    { w: 2, resourceId: 'r_tab', classes: [].concat(G(3), G(4), G(5), G(6)), len: 1, periods: [2, 3, 4, 5], tag: '탐구' },
    { w: 1, resourceId: 'r_beam', classes: [].concat(G(1), G(2), G(4)), len: 1, periods: [1, 2, 4, 5], tag: '발표' },
    { w: 2, resourceId: 'r_kit', classes: [].concat(G(3), G(3), G(3), G(4)), len: 2, periods: [1, 3, 5], tag: '탐구' },
    { w: 1, resourceId: 'r_eng', classes: [].concat(G(4), G(5), G(6)), len: 1, periods: [1, 2, 3, 5, 6], tag: '발표', teacher: '고태양' },
    { w: 1, resourceId: 'r_sci1', classes: [].concat(G(3), G(4), G(6)), len: 2, periods: [1, 3, 5], tag: '실험' },
  ];
  // 한국 공휴일 템플릿(연도별 음력 공휴일 포함). '공휴일 기본 세트 추가'에서 학기 범위 안의 날짜만 삽입
  const HOLIDAYS = {
    fixed: [['01-01', '신정'], ['03-01', '삼일절'], ['05-05', '어린이날'], ['06-06', '현충일'], ['08-15', '광복절'], ['10-03', '개천절'], ['10-09', '한글날'], ['12-25', '성탄절']],
    byYear: {
      2026: [['2026-02-16', '2026-02-18', '설 연휴'], ['2026-05-24', '2026-05-24', '부처님오신날'], ['2026-05-25', '2026-05-25', '부처님오신날 대체공휴일'], ['2026-09-24', '2026-09-26', '추석 연휴'], ['2026-10-05', '2026-10-05', '개천절 대체공휴일']],
      2027: [['2027-02-06', '2027-02-08', '설 연휴'], ['2027-02-09', '2027-02-09', '설 연휴 대체공휴일'], ['2027-05-13', '2027-05-13', '부처님오신날'], ['2027-09-14', '2027-09-16', '추석 연휴']],
    },
  };
  return { settings, teachers, classes, resources, events, sampleSeries, sampleFixed, samplePlan, PALETTE, HOLIDAYS, teacherIdByName: T };
})();
