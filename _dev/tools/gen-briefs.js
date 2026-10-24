// gen-briefs.js — final_specs.json에서 앱별 에이전트 브리프(빌드/검증/수정/재검증) 텍스트 파일 생성
// 사용법: node gen-briefs.js <final_specs.json> <출력 폴더> <프로젝트 루트> <tools 폴더> <tests 폴더> [단계=all|build|verify|fix|reverify]
'use strict';
const fs = require('fs');
const path = require('path');
const [, , specsFile, outDir, root, tools, testsDir, stageArg] = process.argv;
if (!specsFile || !outDir || !root || !tools || !testsDir) { console.error('usage: node gen-briefs.js <final_specs.json> <outDir> <root> <tools> <testsDir> [stage]'); process.exit(2); }
const data = JSON.parse(fs.readFileSync(specsFile, 'utf8'));
const specs = data.specs, shared = data.shared_sample_data;
const stage = stageArg || 'all';
fs.mkdirSync(outDir, { recursive: true });

function appDir(spec) { return root + '\\' + spec.folder_slug }
function appUrl(spec) { return 'file:///' + (root + '/' + spec.folder_slug + '/index.html').replace(/\\/g, '/') }
function testDir(spec) { return testsDir + '\\' + spec.app_name_en }

function toolsBlock(spec) {
  return `# 도구·경로
- 앱 폴더(절대 경로): ${appDir(spec)}
- 앱 URL: ${appUrl(spec)}
- 공통 규약 문서(반드시 먼저 Read): ${tools}\\..\\CONVENTIONS.md
- 정적 점검: node "${tools}\\lint-app.js" "${appDir(spec)}"
- 스모크 점검(콘솔 오류·가로 스크롤·3개 뷰 스크린샷): node "${tools}\\pw-check.js" "${appDir(spec)}\\index.html" "<결과 폴더>"
- 인터랙티브 테스트 러너: node "${tools}\\pw-run.js" "${appDir(spec)}\\index.html" "<테스트 모듈.js>" "<결과 폴더>"  (모듈 형식은 pw-run.js 상단 주석 참고; page는 Playwright Page 객체. 테스트 모듈 안에서 require('playwright')는 하지 않는다)
- 테스트/결과 파일은 반드시 이 폴더 아래에만 저장: ${testDir(spec)}  (앱 폴더 안에 테스트 파일을 만들지 말 것)
- 파일 작성/수정은 Write/Edit 도구를 사용(Bash heredoc은 백틱이 포함된 JS/HTML에서 깨질 수 있음). 명령 실행은 Bash 도구. 한글 출력이 깨지면 PYTHONUTF8=1.
- 스크린샷 PNG는 Read 도구로 열어 직접 눈으로 확인할 수 있다.
- 프로젝트 루트(${root})는 git 저장소다. 앱 소스를 수정하는 역할이면 git diff로 이전 수정 내역을 확인할 수 있다. 커밋은 하지 않는다.`
}
function sharedBlock() { return `# 공통 샘플 데이터 (학생 명단·학교명이 필요한 앱은 반드시 이 데이터 사용)\n${JSON.stringify(shared, null, 2)}` }

function buildPrompt(spec) {
  return `당신은 바이브코딩에 능숙한 시니어 프론트엔드 개발자이자 초등교육 콘텐츠 전문가입니다. 아래 스펙과 공통 규약에 따라 교육용 웹앱 **"${spec.app_name}"** 을 완성도 높게 구현하세요. (카테고리 ${spec.category_num}: ${spec.category})

${toolsBlock(spec)}

# 작업 순서
1. Read 도구로 공통 규약 문서(CONVENTIONS.md)를 끝까지 읽는다. 규약은 스펙보다 우선한다.
2. 앱 폴더를 만들고 index.html, css/style.css, js/data.js, js/app.js(필요 시 추가 분할), README.md를 작성한다.
3. must 기능은 전부, should는 가능한 한 전부, nice는 여유가 있으면 구현한다.
4. 시각 아이덴티티를 적용하되 라이트/다크 두 테마 모두 디자인한다.
5. window.__app = { getState(), actions: {...}, version } 를 노출한다.
6. 자가 점검: lint-app.js 0건, pw-check.js 0건, acceptance_criteria 확인.
7. README.md는 규약 10절 템플릿을 모두 채운다.

${sharedBlock()}

# 구현 스펙
${JSON.stringify(spec, null, 2)}

완료 보고 JSON 저장: ${testDir(spec)}\\build-report.json`
}

function verifyFunctionalPrompt(spec) {
  return `당신은 꼼꼼한 QA 엔지니어입니다. 교육용 웹앱 "${spec.app_name}"이 스펙의 수용 기준을 실제로 만족하는지 Playwright로 **직접 실행하여** 검증하세요. 목표는 결함을 찾아내는 것입니다. 앱 소스 파일은 절대 수정하지 않습니다.

${toolsBlock(spec)}

# 절차
1. CONVENTIONS.md와 앱 소스(index.html, css, js 전부)를 읽고 DOM 구조·셀렉터·window.__app API를 파악한다.
2. ${testDir(spec)} 아래에 pw-run.js용 테스트 모듈(func-*.js, 2~5개)을 작성한다. 각 acceptance_criteria 항목마다 최소 1개의 expect를 두고, 공통 시나리오(첫 화면 샘플 데이터, 모든 탭·버튼, 입력 검증·XSS 문자열, 새로고침 복원, 샘플 초기화, JSON 내보내기·가져오기(잘못된 JSON 포함), 모달·ESC·Tab, 400px 뷰포트, 다크 모드, 게임/타이머 흐름)를 검증한다.
3. 각 모듈을 실행하고 결과 JSON을 읽는다. 실패는 재현 절차와 함께 기록한다.
4. lint-app.js와 pw-check.js도 실행해 결과를 포함한다.

# 심각도 기준
critical: 동작 불가/데이터 손실/예외 발생/must 기능 미구현 · major: 기능이 스펙과 다르거나 흔한 입력에서 오작동 · minor: 사소한 불편·문구

# 스펙
${JSON.stringify(spec, null, 2)}

# 결과 보고
다음 JSON을 Write 도구로 저장: ${testDir(spec)}\\findings-functional.json
{ "summary": "...", "findings": [{ "id": "F-01", "severity": "critical|major|minor", "area": "...", "title": "...", "description": "...", "evidence": "...", "file": "...", "line": 0, "suggested_fix": "..." }],
  "acceptance_results": [{ "criterion": "...", "status": "pass|fail|untested", "note": "..." }], "test_files": ["..."], "screenshots": ["..."] }`
}

function verifyCodePrompt(spec) {
  return `당신은 엄격한 시니어 코드 리뷰어입니다. 교육용 웹앱 "${spec.app_name}"의 소스 전체를 읽고 결함을 찾아내세요. 앱 소스는 수정하지 않습니다.

${toolsBlock(spec)}

# 절차
1. CONVENTIONS.md를 읽고, 앱 폴더의 모든 파일을 처음부터 끝까지 읽는다.
2. 논리 오류·상태/렌더 불일치·데이터(localStorage, 가져오기 검증, CSV 이스케이프)·보안(XSS)·규약 위반·스펙 누락·코드 품질 관점으로 결함을 찾는다(파일:줄 번호와 코드 인용 첨부).
3. 의심되는 로직은 node 또는 pw-run.js 모듈(${testDir(spec)}\\code-*.js)로 재현해 확인한다.

# 심각도 기준
critical: 동작 불가/데이터 손실/예외/보안 · major: 흔한 사용에서 오작동 또는 스펙 must 위반 · minor: 품질·문구·가독성

${sharedBlock()}

# 스펙
${JSON.stringify(spec, null, 2)}

# 결과 보고
다음 JSON을 Write 도구로 저장: ${testDir(spec)}\\findings-code.json (형식은 findings-functional과 동일, id는 C-01…)`
}

function verifyUxPrompt(spec) {
  return `당신은 교육용 소프트웨어 UX 디자이너이자 접근성 전문가입니다. 교육용 웹앱 "${spec.app_name}"을 실제로 렌더링한 스크린샷을 보고 시각·사용성 결함을 찾아내세요. 앱 소스는 수정하지 않습니다.

${toolsBlock(spec)}

# 절차
1. CONVENTIONS.md를 읽고 앱 구조와 셀렉터를 파악한다.
2. pw-check.js를 실행하고 스크린샷 3장을 Read로 연다.
3. ${testDir(spec)}\\ux-shots.js 모듈로 모든 화면/탭/모달을 데스크톱 1280 라이트·다크, 모바일 400, 태블릿 820, 인쇄 미디어로 촬영한다.
4. 모든 스크린샷을 Read로 열어 레이아웃·가독성(글자 크기·대비)·테마·사용성·교육 현장 적합성·디자인 완성도를 점검한다.
5. 각 결함에 스크린샷 경로와 CSS/HTML 수준의 수정안을 적는다.

# 심각도 기준
critical: 핵심 기능이 보이지 않거나 사용 불가 · major: 눈에 띄는 깨짐/가독성 문제/모바일 사용 불가 · minor: 다듬기

# 스펙
${JSON.stringify(spec, null, 2)}

# 결과 보고
다음 JSON을 Write 도구로 저장: ${testDir(spec)}\\findings-ux.json (형식은 findings-functional과 동일, id는 U-01…)`
}

function fixPrompt(spec, round) {
  const td = testDir(spec)
  return `당신은 교육용 웹앱 "${spec.app_name}"의 담당 개발자입니다. 검증팀(기능 테스트·코드 리뷰·UX 리뷰)이 찾은 결함을 수정하세요. (${round}라운드)

${toolsBlock(spec)}

# 입력 파일 (모두 Read)
- 결함 목록: ${td}\\findings-functional.json, ${td}\\findings-code.json, ${td}\\findings-ux.json${round > 1 ? `\n- 이전 라운드 재검증 결과(잔여 이슈·회귀): ${td}\\reverify-r${round - 1}.json` : ''}${round > 1 ? `\n- 이전 라운드 수정 보고서: ${td}\\fix-r${round - 1}.json` : ''}
- 기존 테스트 모듈: ${td}\\*.js (각 findings JSON의 test_files 참고)

# 절차
1. CONVENTIONS.md와 앱 소스 전체, 결함 목록을 읽는다. git diff로 이미 반영된 수정이 있는지 확인한다(이전 담당자가 중단되었을 수 있음).
2. 결함을 심각도 순으로 처리한다: critical·major는 반드시 수정, minor는 수정 비용이 낮으면 수정. 지적이 틀렸다고 판단되면 직접 재현해 확인한 뒤 not_fixed에 근거를 적는다.
3. 수정 후 반드시 재점검: lint-app.js(issues 0), pw-check.js(problems 0), 기존 테스트 모듈을 pw-run.js로 모두 재실행해 실패가 없게 한다. 테스트 모듈 자체가 잘못된 경우에만 테스트를 고치고 notes에 적는다.
4. README.md가 바뀐 동작과 일치하도록 갱신한다. 새 기능을 추가하지 않는다.

${sharedBlock()}

# 스펙
${JSON.stringify(spec, null, 2)}

# 결과 보고
다음 JSON을 Write 도구로 저장: ${td}\\fix-r${round}.json
{ "fixed": [{ "id": "F-01", "how": "..." }], "not_fixed": [{ "id": "...", "why": "..." }], "files_changed": ["..."],
  "recheck": { "lint_issues": 0, "pw_problems": [], "tests_summary": "모듈별 passed/failed" }, "notes": "..." }`
}

function reverifyPrompt(spec, round) {
  const td = testDir(spec)
  return `당신은 최종 검수 QA입니다. 교육용 웹앱 "${spec.app_name}"의 ${round}라운드 수정 결과를 독립적으로 재검증하세요. 앱 소스는 수정하지 않습니다.

${toolsBlock(spec)}

# 입력 파일 (모두 Read)
- 결함 목록: ${td}\\findings-functional.json, ${td}\\findings-code.json, ${td}\\findings-ux.json
- 수정 보고서: ${td}\\fix-r${round}.json${round > 1 ? `\n- 이전 재검증: ${td}\\reverify-r${round - 1}.json` : ''}
- 기존 테스트 모듈: ${td}\\*.js

# 절차
1. lint-app.js, pw-check.js 실행 → 결과 기록(스크린샷 3장 Read로 확인).
2. 기존 테스트 모듈을 pw-run.js로 전부 재실행하고 결과 JSON을 읽는다. 실패가 있으면 앱 결함인지 테스트 결함인지 소스를 읽어 판단한다.
3. 결함 목록의 critical·major 항목이 실제로 해결되었는지 각각 소스/브라우저로 직접 확인한다(수정 보고서의 주장을 그대로 믿지 않는다). 회귀(regression)를 찾는다. UX 결함은 ux-shots 모듈을 다시 실행해 스크린샷으로 확인한다.
4. 스펙의 acceptance_criteria 전체를 다시 pass/fail/untested로 판정한다.
5. 최종 status: critical·major 잔여 이슈가 0건이고 테스트 실패·페이지 예외·가로 스크롤이 없으면 pass, 아니면 fail.

# 스펙
${JSON.stringify(spec, null, 2)}

# 결과 보고
다음 JSON을 Write 도구로 저장: ${td}\\reverify-r${round}.json
{ "status": "pass|fail", "remaining": [{ "id": "...", "severity": "...", "title": "...", "evidence": "..." }], "new_findings": [{ "id": "R-01", "severity": "...", "title": "...", "description": "...", "evidence": "...", "suggested_fix": "..." }],
  "acceptance_results": [{ "criterion": "...", "status": "pass|fail|untested", "note": "..." }], "lint_issues": 0, "pw_problems": [], "tests_summary": "...", "notes": "..." }`
}

const stages = {
  build: s => buildPrompt(s),
  'verify-functional': s => verifyFunctionalPrompt(s),
  'verify-code': s => verifyCodePrompt(s),
  'verify-ux': s => verifyUxPrompt(s),
  'fix-r1': s => fixPrompt(s, 1), 'fix-r2': s => fixPrompt(s, 2), 'fix-r3': s => fixPrompt(s, 3),
  'reverify-r1': s => reverifyPrompt(s, 1), 'reverify-r2': s => reverifyPrompt(s, 2), 'reverify-r3': s => reverifyPrompt(s, 3),
}
const wanted = stage === 'all' ? Object.keys(stages) : stage === 'verify' ? ['verify-functional', 'verify-code', 'verify-ux'] : [stage]
for (const s of specs) {
  for (const st of wanted) {
    const p = path.join(outDir, `${s.app_name_en}.${st}.md`)
    fs.writeFileSync(p, stages[st](s))
  }
}
console.log(`briefs written: ${specs.length * wanted.length} files -> ${outDir}`)
