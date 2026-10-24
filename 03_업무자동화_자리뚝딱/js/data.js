// data.js — 자리뚝딱 샘플 데이터·기본 설정·상수 (전역 const APP_DATA)
// 가온초등학교 5학년 2반(담임 이가람)은 가상의 학급이며 학생 이름은 모두 가상입니다.
'use strict';

const APP_DATA = (() => {
  // 시드 랜덤(mulberry32) — 샘플 히스토리를 항상 같은 모양으로 만들기 위함
  const mulberry32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 공통 샘플 명렬 24명 + 확장 규칙 25번 백건우(전출로 비활성 — 전출 학생 처리 시연용)
  // [번호, 이름, 성별, 학습수준(1하·2중·3상), 태그]
  const roster = [
    [1, '김하늘', 'F', 2, []], [2, '이도윤', 'M', 3, []], [3, '박서아', 'F', 2, ['front']], [4, '최민준', 'M', 1, []],
    [5, '정하윤', 'F', 3, []], [6, '강시우', 'M', 1, ['focus']], [7, '윤서준', 'M', 2, []], [8, '장지우', 'F', 3, []],
    [9, '임예준', 'M', 2, []], [10, '한수아', 'F', 2, []], [11, '오지호', 'M', 1, ['front']], [12, '서아린', 'F', 3, []],
    [13, '신준서', 'M', 2, []], [14, '권유나', 'F', 2, []], [15, '황도현', 'M', 1, ['focus']], [16, '안지아', 'F', 2, []],
    [17, '송민재', 'M', 3, []], [18, '류채원', 'F', 2, []], [19, '홍태양', 'M', 2, ['tall']], [20, '배소율', 'F', 3, []],
    [21, '조현우', 'M', 1, ['tall']], [22, '문다은', 'F', 3, []], [23, '양은우', 'M', 2, ['tall']], [24, '노시은', 'F', 1, ['front']],
    [25, '백건우', 'M', 2, []],
  ];
  const students = roster.map(([no, name, gender, level, tags]) => ({
    id: 's' + String(no).padStart(2, '0'), no, name, gender, level, tags, active: no !== 25,
  }));
  const activeIds = students.filter(s => s.active).map(s => s.id);

  // 샘플 레이아웃: 2인 짝 분단형 3분단×5열(30책상) 중 뒷줄 양끝 2개를 꺼서 28책상, 교탁 위
  const layoutSpec = { preset: 'pair', params: { sections: 3, rows: 5 }, off: ['4-0', '4-7'], teacherSide: 'top', name: '수업형' };
  // 짝 분단형 격자의 책상 키 목록(열 2,5는 통로) — 히스토리 좌석 생성용
  const deskKeys = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) if (c % 3 !== 2 && !layoutSpec.off.includes(r + '-' + c)) deskKeys.push(r + '-' + c);
  const pairOf = (key) => { const [r, c] = key.split('-').map(Number); const c2 = c % 3 === 0 ? c + 1 : c - 1; return r + '-' + c2; };

  // 히스토리 4건: 이도윤(s02)-한수아(s10)를 3회 연속 짝으로, 양은우(s23)를 4회 중 3회 뒤 구역(5열)에 배치
  const makeSeats = (seed, pairDoyun, backYang) => {
    const rnd = mulberry32(seed);
    const seats = {}; let free = deskKeys.slice();
    const take = (key) => { free = free.filter(k => k !== key); return key; };
    if (pairDoyun) {
      const cand = free.filter(k => !k.startsWith('4-') && free.includes(pairOf(k)));
      const k = cand[Math.floor(rnd() * cand.length)];
      seats[take(k)] = 's02'; seats[take(pairOf(k))] = 's10';
    }
    const yangCand = free.filter(k => backYang ? k.startsWith('4-') : !k.startsWith('4-'));
    seats[take(yangCand[Math.floor(rnd() * yangCand.length)])] = 's23';
    const rest = shuffled(activeIds.filter(id => !Object.values(seats).includes(id)), rnd);
    const freeShuffled = shuffled(free, rnd);
    rest.forEach((id, i) => { seats[freeShuffled[i]] = id; });
    return seats;
  };
  const history = [
    { id: 'h1', date: '2026-03-02', memo: '1차(개학)', seats: makeSeats(11, true, true) },
    { id: 'h2', date: '2026-04-06', memo: '2차', seats: makeSeats(22, true, true) },
    { id: 'h3', date: '2026-05-11', memo: '3차', seats: makeSeats(33, true, false) },
    { id: 'h4', date: '2026-09-07', memo: '2학기 1차', seats: makeSeats(44, false, true) },
  ];

  const roles = ['이끔이', '기록이', '나눔이', '지킴이'];
  const groupNames = ['빨강모둠', '주황모둠', '노랑모둠', '초록모둠', '파랑모둠', '보라모둠', '하늘모둠', '분홍모둠', '갈색모둠', '회색모둠'];
  const groupColors = ['#E25555', '#F59E0B', '#EAC435', '#3BA55D', '#3B82F6', '#8B5CF6', '#06B6D4', '#EC4899', '#A16207', '#6B7280'];

  // 모둠 히스토리 1건: 2026-05-20 과학 실험 6모둠(각 4명), 역할 4종 배정
  const makeGroupPlan = () => {
    const rnd = mulberry32(55);
    const ids = shuffled(activeIds, rnd);
    const groups = [];
    for (let g = 0; g < 6; g++) {
      groups.push({ idx: g, name: groupNames[g], color: groupColors[g], members: ids.slice(g * 4, g * 4 + 4).map((studentId, i) => ({ studentId, role: roles[i] })) });
    }
    return { id: 'g1', date: '2026-05-20', memo: '과학 실험', groupCount: 6, groups };
  };

  return {
    version: 1,
    appVersion: '1.0.0',
    classInfo: { school: '가온초등학교', grade: 5, classNo: 2, teacher: '이가람', className: '5학년 2반' },
    students,
    pairs: [
      { id: 'p1', a: 's04', b: 's06', type: 'apart', hard: true, memo: '' },
      { id: 'p2', a: 's08', b: 's14', type: 'apart', hard: true, memo: '' },
      { id: 'p3', a: 's16', b: 's12', type: 'together', hard: false, memo: '또래 도우미' },
    ],
    layoutSpec,
    conditions: {
      front: { on: true, hard: true }, focus: { on: true, hard: false }, tall: { on: true, hard: false },
      genderPair: { on: true, hard: false }, pairs: { on: true }, avoidPartnerN: 3, avoidSeat: true,
    },
    history,
    groupHistory: [makeGroupPlan()],
    settings: {
      roles, groupNames, groupColors, avoidN: 3, flipIntervalMs: 700, sound: false,
      print: { showNo: true, genderColor: true, title: true },
      weights: { hard: 1000, apart: 50, together: 50, front: 40, focus: 30, tall: 20, gender: 10, repeatPartner: 15, repeatSeat: 5 },
    },
    // 프리셋 정의(이름·수치 입력 범위)
    presets: {
      pair: { label: '2인 짝 분단형', fields: [['sections', '분단', 2, 4], ['rows', '열(줄)', 3, 7]] },
      group4: { label: '4인 모둠형', fields: [['groups', '모둠', 4, 9]] },
      u: { label: 'ㄷ자형', fields: [['cols', '가로 책상', 6, 12], ['rows', '세로 깊이', 2, 6], ['layers', '겹(줄 두께)', 1, 2]] },
      exam: { label: '1인 시험형', fields: [['rows', '행', 3, 8], ['cols', '열', 3, 8]] },
    },
    tagLabels: { front: '앞자리 필요', focus: '집중 지원', tall: '키 큼' },
    condLabels: { front: '앞자리 배려', focus: '집중 지원 교탁 근접', tall: '키 큼 뒤쪽', genderPair: '남녀 짝', apart: '분리 쌍', together: '결합 쌍', repeatPartner: '최근 짝 회피', repeatSeat: '같은 좌석 회피' },
    // 첫 실행 가이드 투어 3단계
    tour: [
      { title: '1단계 · 명렬 확인', body: '명렬 탭에서 학생 번호·이름·성별과 배려 태그(앞자리 필요·집중 지원·키 큼)를 확인하세요. 전출·장기결석 학생은 비활성으로 두면 배치에서 빠집니다.' },
      { title: '2단계 · 조건 체크', body: '자리 배치 탭 왼쪽 조건 패널에서 지킬 조건을 체크하고 하드(반드시)/소프트(가능하면)를 고르세요. 떨어뜨릴 짝·붙일 짝은 명렬 탭에서 등록합니다.' },
      { title: '3단계 · 자동 배치·발표', body: '자동 배치를 누르면 1초 안에 좌석표가 완성되고 충족 리포트가 조건별 결과를 보여 줍니다. 발표 모드로 TV에서 카드를 한 장씩 뒤집어 공개한 뒤 배치 확정·인쇄하세요.' },
    ],
    // 탭별 도움말
    help: {
      roster: ['표에서 번호·이름·성별·수준·태그를 바로 고칩니다.', '엑셀에서 "번호 이름 성별" 열을 복사해 붙여넣기 영역에 넣고 인식 → 추가하면 일괄 등록됩니다.', '학생 2명을 고른 뒤 떨어뜨리기/붙이기로 분리·결합 쌍을 만들고 하드/소프트를 정합니다.'],
      seats: ['교실 패널에서 프리셋과 수치를 고르고, 편집 모드에서 책상을 눌러 켜고 끕니다.', '조건을 체크한 뒤 자동 배치 → 리포트에서 충족 여부를 확인합니다.', '카드를 드래그하거나 두 카드를 차례로 탭하면 교환됩니다. Ctrl+Z/Ctrl+Y로 되돌립니다.', '자물쇠를 켠 학생은 다시 섞기에서도 자리를 지킵니다.', '발표 모드: Space=다음 카드, Esc=종료.'],
      groups: ['모둠 수 또는 모둠 인원을 정하고 옵션을 체크한 뒤 편성을 누릅니다.', '멤버를 드래그/탭-탭으로 옮기고 역할 배지를 눌러 역할을 바꿉니다.', '현재 자리표에서 가져오기는 4인 모둠형 레이아웃의 책상 묶음을 모둠으로 바꿉니다.'],
      history: ['확정된 배치·모둠이 날짜 역순으로 쌓입니다. 카드를 누르면 미리보기·불러오기·삭제가 가능합니다.', '히트맵 셀에 마우스를 올리면 두 학생이 짝·모둠이 된 횟수가 보입니다.', '뒤 구역 비율 70% 이상(3회 이상)인 학생은 편중 주의로 표시됩니다.'],
      settings: ['역할·모둠 이름과 색, 회피 횟수, 플립 간격을 바꿉니다.', 'JSON 내보내기로 백업하고 가져오기로 복원합니다. 공용 PC에서는 사용 후 전체 데이터 삭제를 권장합니다.'],
    },
  };
})();
