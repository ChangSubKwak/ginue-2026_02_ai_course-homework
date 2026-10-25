당신은 최종 검수 QA입니다. 교육용 웹앱 "분수교구함"의 3라운드 수정 결과를 독립적으로 재검증하세요. 앱 소스는 수정하지 않습니다.

# 도구·경로
- 앱 폴더(절대 경로): D:\workspace\ginue-2026_02_ai_course-homework\01_교과교육지원_분수교구함
- 앱 URL: file:///D:/workspace/ginue-2026_02_ai_course-homework/01_교과교육지원_분수교구함/index.html
- 공통 규약 문서(반드시 먼저 Read): D:\workspace\ginue-2026_02_ai_course-homework\_dev\tools\..\CONVENTIONS.md
- 정적 점검: node "D:\workspace\ginue-2026_02_ai_course-homework\_dev\tools\lint-app.js" "D:\workspace\ginue-2026_02_ai_course-homework\01_교과교육지원_분수교구함"
- 스모크 점검(콘솔 오류·가로 스크롤·3개 뷰 스크린샷): node "D:\workspace\ginue-2026_02_ai_course-homework\_dev\tools\pw-check.js" "D:\workspace\ginue-2026_02_ai_course-homework\01_교과교육지원_분수교구함\index.html" "<결과 폴더>"
- 인터랙티브 테스트 러너: node "D:\workspace\ginue-2026_02_ai_course-homework\_dev\tools\pw-run.js" "D:\workspace\ginue-2026_02_ai_course-homework\01_교과교육지원_분수교구함\index.html" "<테스트 모듈.js>" "<결과 폴더>"  (모듈 형식은 pw-run.js 상단 주석 참고; page는 Playwright Page 객체. 테스트 모듈 안에서 require('playwright')는 하지 않는다)
- 테스트/결과 파일은 반드시 이 폴더 아래에만 저장: D:\workspace\ginue-2026_02_ai_course-homework\_dev\tests\fraction-kit  (앱 폴더 안에 테스트 파일을 만들지 말 것)
- 파일 작성/수정은 Write/Edit 도구를 사용(Bash heredoc은 백틱이 포함된 JS/HTML에서 깨질 수 있음). 명령 실행은 Bash 도구. 한글 출력이 깨지면 PYTHONUTF8=1.
- 스크린샷 PNG는 Read 도구로 열어 직접 눈으로 확인할 수 있다.
- 프로젝트 루트(D:\workspace\ginue-2026_02_ai_course-homework)는 git 저장소다. 앱 소스를 수정하는 역할이면 git diff로 이전 수정 내역을 확인할 수 있다. 커밋은 하지 않는다.

# 입력 파일 (모두 Read)
- 결함 목록: D:\workspace\ginue-2026_02_ai_course-homework\_dev\tests\fraction-kit\findings-functional.json, D:\workspace\ginue-2026_02_ai_course-homework\_dev\tests\fraction-kit\findings-code.json, D:\workspace\ginue-2026_02_ai_course-homework\_dev\tests\fraction-kit\findings-ux.json
- 수정 보고서: D:\workspace\ginue-2026_02_ai_course-homework\_dev\tests\fraction-kit\fix-r3.json
- 이전 재검증: D:\workspace\ginue-2026_02_ai_course-homework\_dev\tests\fraction-kit\reverify-r2.json
- 기존 테스트 모듈: D:\workspace\ginue-2026_02_ai_course-homework\_dev\tests\fraction-kit\*.js

# 절차
1. lint-app.js, pw-check.js 실행 → 결과 기록(스크린샷 3장 Read로 확인).
2. 기존 테스트 모듈을 pw-run.js로 전부 재실행하고 결과 JSON을 읽는다. 실패가 있으면 앱 결함인지 테스트 결함인지 소스를 읽어 판단한다.
3. 결함 목록의 critical·major 항목이 실제로 해결되었는지 각각 소스/브라우저로 직접 확인한다(수정 보고서의 주장을 그대로 믿지 않는다). 회귀(regression)를 찾는다. UX 결함은 ux-shots 모듈을 다시 실행해 스크린샷으로 확인한다.
4. 스펙의 acceptance_criteria 전체를 다시 pass/fail/untested로 판정한다.
5. 최종 status: critical·major 잔여 이슈가 0건이고 테스트 실패·페이지 예외·가로 스크롤이 없으면 pass, 아니면 fail.

# 스펙
{
  "category_num": 1,
  "category": "교과 교육지원 앱",
  "app_name": "분수교구함",
  "app_name_en": "fraction-kit",
  "folder_slug": "01_교과교육지원_분수교구함",
  "tagline": "분수 하나를 막대·원·수직선으로 함께 보는 단일 화면 분수 교구",
  "purpose": "분수는 초등 3~5학년에 걸쳐 반복 등장하지만 '2/4와 1/2은 다르다', '분모가 크면 더 크다' 같은 오개념이 굳어지기 쉽다. 분수교구함은 분수 하나를 고르면 막대(길이)·원(넓이)·수직선(수)의 세 표상과 분수 기호·소수·읽는 법이 동시에 바뀌는 가상 교구다. 교사는 전자칠판에서 분모를 바꾸고 칸을 색칠하며 '같게 쪼개기'로 동치분수가 만들어지는 과정을 보여 주고, 학생은 태블릿에서 직접 조작하며 분수의 크기를 눈으로 확인한다. 기능을 최소화한 단일 화면 앱으로, 설명 없이도 1분 안에 사용법을 익힐 수 있어야 한다.",
  "target_users": "초등 3~5학년 수학 수업의 교사(전자칠판·TV 시연)와 학생(태블릿·PC 개별 조작), 가정 복습용 학부모",
  "judge_rationale": "사용자 요청에 따라 원래 스펙(6개 탭: 교구판·비교통분·덧셈뺄셈·탐구카드·보관함·활동지)에서 교구판 하나만 남긴 단순화 버전. 핵심 가치인 '세 표상 동기화'와 '같게 쪼개기(동치분수)'는 유지한다.",
  "features": [
    {
      "name": "세 표상 동기화 교구판",
      "description": "화면 가운데에 막대·원·수직선 세 모델이 한 분수를 동시에 보여 준다. 분모(1~12)와 분자(0~분모×2, 가분수 허용)를 바꾸면 세 모델과 분수 기호가 즉시 함께 바뀐다. 분자가 분모보다 크면 막대·원이 2개로 늘어나고 수직선은 0~2로 확장되며 대분수 표기(예: 7/4 = 1 3/4)를 함께 보여 준다.",
      "priority": "must"
    },
    {
      "name": "분수 입력",
      "description": "분모·분자 각각 −/+ 버튼과 숫자 표시. 막대나 원의 칸을 클릭(터치)하면 그 칸까지 색칠되어 분자가 바뀐다(이미 색칠된 마지막 칸을 누르면 하나 줄어든다). 자주 쓰는 분수 칩 8개(1/2, 1/3, 2/3, 1/4, 3/4, 2/5, 5/6, 7/4)를 누르면 바로 설정된다.",
      "priority": "must"
    },
    {
      "name": "같게 쪼개기·합치기(동치분수)",
      "description": "'×2', '×3' 버튼을 누르면 모든 칸이 2배·3배로 쪼개지며(짧은 분할선 애니메이션) 분자·분모가 함께 곱해져 색칠된 양은 그대로임을 보여 준다(2/3 → 4/6). '합치기(약분)' 버튼은 최대공약수로 약분한다(4/6 → 2/3, 이미 기약분수면 비활성). 변화 과정은 화면 아래 '동치 사슬'(2/3 = 4/6 = 8/12)에 누적 표시되고 '처음으로' 버튼으로 사슬을 지운다. 분모 상한 12를 넘는 쪼개기는 비활성.",
      "priority": "must"
    },
    {
      "name": "수 표현 패널",
      "description": "현재 분수를 기호(세로 분수), 소수(소수점 셋째 자리까지, 유한소수면 =, 아니면 ≈), 읽는 법('4분의 3'), 대분수(가분수일 때)로 함께 표시한다. 소수·읽기는 체크박스로 숨길 수 있다(수업 중 '예측 먼저' 용도).",
      "priority": "must"
    },
    {
      "name": "모델 표시 선택과 큰 글씨",
      "description": "막대·원·수직선 각각을 켜고 끌 수 있는 토글(최소 1개는 켜짐). '큰 글씨' 토글을 켜면 글꼴·버튼·모델이 1.4배로 커져 전자칠판·TV에서 뒷자리까지 보인다.",
      "priority": "should"
    },
    {
      "name": "설정 기억과 초기화",
      "description": "현재 분수·표시 설정·테마를 localStorage에 저장해 다시 열면 복원한다(try/catch 래퍼). 헤더의 '처음 상태로' 버튼은 모달 확인 후 기본값(3/4, 세 모델 켜짐)으로 되돌린다.",
      "priority": "should"
    },
    {
      "name": "도움말·테마",
      "description": "헤더의 '?' 버튼으로 3단계 사용법과 수업 팁(동치분수 시연 순서)을 보여 주는 모달. 라이트/다크 테마 토글. alert/confirm/prompt 미사용.",
      "priority": "must"
    }
  ],
  "screens": [
    {
      "name": "교구판(단일 화면)",
      "description": "헤더(앱 이름, 큰 글씨·테마·도움말·처음 상태로) / 왼쪽 또는 상단: 분수 입력(분모·분자 ±, 자주 쓰는 분수 칩) / 가운데: 막대·원·수직선 모델(세로로 쌓임, 좁은 화면에서는 1열) / 오른쪽 또는 하단: 수 표현 패널과 쪼개기·합치기 버튼, 동치 사슬 / 푸터",
      "elements": [
        "분모 −/+ 버튼과 값",
        "분자 −/+ 버튼과 값",
        "분수 칩 8개",
        "막대 모델(SVG, 칸 클릭 가능)",
        "원 모델(SVG 부채꼴, 칸 클릭 가능)",
        "수직선 모델(SVG, 0~1 또는 0~2, 눈금·점)",
        "×2 / ×3 / 합치기 / 처음으로 버튼",
        "동치 사슬 표시",
        "수 표현 패널(기호·소수·읽기·대분수, 소수·읽기 숨김 체크박스)",
        "모델 토글 3개, 큰 글씨 토글",
        "도움말 모달, 초기화 확인 모달, 토스트"
      ]
    }
  ],
  "data_model": [
    {
      "entity": "state",
      "fields": [
        "n(분자)",
        "d(분모)",
        "show: {bar, circle, line, decimal, reading}",
        "big(큰 글씨)",
        "chain(동치 사슬 배열)"
      ],
      "storage": "localStorage 'edu.fraction-kit.v2.state'(JSON, version 2), 테마는 'edu.fraction-kit.theme'"
    }
  ],
  "algorithms": [
    "동치 사슬: ×k를 누르면 (n·k)/(d·k)로 바꾸고 사슬 끝에 추가. 합치기는 g=gcd(n,d)로 (n/g)/(d/g). 사슬은 최대 6개까지 표시하고 넘치면 앞을 버린다.",
    "소수 표시: 약분한 분모의 소인수가 2와 5뿐이면 유한소수(= 표기), 아니면 ≈ 표기로 소수 셋째 자리 반올림.",
    "읽기: '분모분의 분자' 형식(예: 4분의 3), 가분수는 '7분의 4' 그대로 읽고 대분수는 '1과 4분의 3' 병기.",
    "칸 클릭: 막대·원의 i번째 칸을 누르면 n=i+1, 단 n이 이미 i+1이면 n=i(토글). 가분수 상태에서 두 번째 막대/원의 칸은 n=d+i+1."
  ],
  "user_flows": [
    "교사: 앱을 열고 분모를 4로, 칸을 눌러 3/4를 만든 뒤 세 모델을 가리키며 같은 양임을 설명 → ×2를 눌러 6/8이 되는 동안 색칠된 양이 그대로인 것을 보여 주고 동치 사슬(3/4 = 6/8)을 읽는다 → 합치기로 3/4로 돌아온다.",
    "학생: 칩에서 2/5를 고르고 원 모델의 칸을 눌러 4/5로 바꾼다 → 소수 체크를 끄고 '얼마쯤일까' 예측한 뒤 켜서 0.8을 확인한다."
  ],
  "sample_data": "샘플 데이터는 기본 분수 3/4뿐이다. 학생 명단·학교명은 사용하지 않는다.",
  "edge_cases": [
    "분자 0(아무 칸도 색칠 안 됨, 소수 0, 읽기 '0')",
    "분자 = 분모(1, 막대·원이 꽉 참, 수직선 점이 1 위)",
    "가분수 최대 2(분자 = 분모×2)",
    "분모 1(칸 하나)",
    "×2·×3로 분모 12 초과 시 버튼 비활성과 토스트",
    "합치기 비활성(기약분수)",
    "localStorage 사용 불가(토스트 1회, 메모리 동작)",
    "400px 폭에서 세 모델 1열·버튼 44px 이상",
    "다크 모드에서 색칠·분할선 보임",
    "키보드만으로 모든 버튼 조작 가능"
  ],
  "acceptance_criteria": [
    "처음 열면 3/4가 막대·원·수직선 세 모델과 기호 '3/4', 소수 '= 0.75', 읽기 '4분의 3'으로 표시된다",
    "분모 + 버튼을 누르면 분모가 5가 되고 세 모델의 칸 수(막대 5칸, 원 5조각, 수직선 눈금 5칸)가 즉시 바뀐다",
    "막대의 5번째 칸을 클릭하면 분자가 5가 되고 원·수직선도 5/5로 바뀐다",
    "칩 '7/4'를 누르면 막대·원이 2개가 되고 수직선이 0~2로 확장되며 '7/4 = 1 3/4'가 표시된다",
    "3/4에서 ×2를 누르면 6/8이 되고 색칠된 비율이 동일하며 동치 사슬에 '3/4 = 6/8'이 표시된다",
    "6/8에서 합치기를 누르면 3/4가 되고 기약분수 상태에서는 합치기 버튼이 비활성이다",
    "분모 12인 상태에서 ×2 버튼은 비활성이고 누르면 토스트가 뜨지 않거나 안내 토스트가 뜬다",
    "1/3은 소수가 '≈ 0.333'으로, 1/4은 '= 0.25'로 표시된다",
    "소수 체크박스를 끄면 소수 표시가 사라지고 새로고침 후에도 꺼진 상태가 유지된다",
    "원 모델 토글을 끄면 원이 사라지고, 막대·수직선 토글을 모두 끄려 하면 마지막 하나는 꺼지지 않는다",
    "'처음 상태로'를 누르면 확인 모달이 뜨고 확인하면 3/4·세 모델 켜짐으로 돌아간다",
    "400px 뷰포트에서 가로 스크롤이 없고 모든 버튼이 44px 이상이다",
    "다크 모드에서 body 배경과 모델 색이 라이트와 다르며 콘솔 오류가 없다",
    "큰 글씨 토글을 켜면 분수 기호 글꼴 크기가 1.3배 이상 커진다",
    "alert/confirm/prompt가 한 번도 호출되지 않고 페이지 예외가 0건이다"
  ],
  "tech_notes": "파일 구성: index.html(~120줄), css/style.css(~300줄), js/app.js(~450줄, 분수 유틸·SVG 렌더·상태·이벤트 모두 포함; 필요하면 js/render.js로 분리), README.md. 일반 <script>, 외부 라이브러리 없음, Google Fonts(Gowun Dodum·Noto Sans KR) 링크 + 시스템 폰트 폴백. 모델은 SVG(viewBox)로 그리고 쪼개기 애니메이션은 CSS transition 또는 rAF 300ms. 전체 코드 700~900줄.",
  "out_of_scope": [
    "비교·통분, 덧셈·뺄셈 단계 시각화",
    "탐구 카드·학급 집계",
    "장면 보관함·JSON 내보내기/가져오기",
    "활동지 생성·인쇄",
    "펜 주석·칠판 커튼",
    "되돌리기/다시하기",
    "학년 프리셋",
    "PNG 저장"
  ],
  "tech_highlight": "SVG 3표상(막대·원·수직선) 실시간 동기화 + 같게 쪼개기 애니메이션(동치분수)",
  "visual_identity": {
    "accent_hex": "#3B82F6",
    "accent_name": "교구 블루",
    "mood": "흰 칠판 위에 놓인 선명한 파랑·주황 교구 — 명료하고 정확한 수학 수업, 전자칠판 고대비",
    "font_display": "Gowun Dodum",
    "font_body": "Noto Sans KR"
  }
}

# 결과 보고
다음 JSON을 Write 도구로 저장: D:\workspace\ginue-2026_02_ai_course-homework\_dev\tests\fraction-kit\reverify-r3.json
{ "status": "pass|fail", "remaining": [{ "id": "...", "severity": "...", "title": "...", "evidence": "..." }], "new_findings": [{ "id": "R-01", "severity": "...", "title": "...", "description": "...", "evidence": "...", "suggested_fix": "..." }],
  "acceptance_results": [{ "criterion": "...", "status": "pass|fail|untested", "note": "..." }], "lint_issues": 0, "pw_problems": [], "tests_summary": "...", "notes": "..." }