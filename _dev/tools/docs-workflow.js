export const meta = {
  name: 'edu-apps-docs',
  description: '앱별 개요·설명서 콘텐츠 작성(스크린샷 포함) → 정확성 검토 → 수정, (선택) 전체 과제 보고서 초안 작성',
  phases: [
    { title: 'Write', detail: '앱별 문서 작성자: 큐레이션 스크린샷 촬영 + 설명서 콘텐츠 JSON 작성' },
    { title: 'Review', detail: '앱별 검토자: 문서 내용이 실제 앱과 일치하는지 확인' },
    { title: 'Revise', detail: '지적 사항 반영' },
    { title: 'Report', detail: '전체 과제 보고서 콘텐츠 작성' },
  ],
}

const { specs, root, tools, buildResults, processSummaryPath, specsPath, qaPath, submitter, courseName, today, liveLinks, skipReport } = args

const DOC_FORMAT = `# 문서 콘텐츠 JSON 형식 (make-docx.js 입력; 반드시 이 형식)
{
  "title": "<앱 이름>", "subtitle": "앱 개요 및 설명서", "cover_label": "과제 제출물 · 카테고리 0N. <카테고리명>",
  "accent": "<visual_identity.accent_hex 에서 # 제거>",
  "meta_rows": [["과제명","바이브코딩으로 만드는 교육용 앱 개발"],["앱 분류","0N. <카테고리명>"],["앱 이름","<앱 이름> — <태그라인>"],["개발 도구","Claude Code(바이브코딩), HTML/CSS/JavaScript"],["제출자","<submitter>"],["작성일","<today>"]],
  "cover_note": "내장된 학교·학급·학생 데이터는 모두 가상의 샘플입니다.",
  "toc": true, "header_text": "<앱 이름> 개요 및 설명서",
  "sections": [ { "heading": "1. 앱 개요", "level": 1, "page_break_before": false, "blocks": [ ...블록... ] }, ... ]
}
블록 종류: {"type":"paragraph","text":"**굵게**, \`코드\` 인라인 가능"} / {"type":"bullets","items":[...]} / {"type":"numbered","items":[...]} /
{"type":"table","header":[...],"rows":[[...]],"widths":[30,70]} / {"type":"image","path":"screens/파일.png","caption":"그림 N. 설명","width_pct":90} /
{"type":"code","text":"..."} / {"type":"callout","text":"..."} / {"type":"page_break"}
- image의 path는 content JSON 파일 기준 상대 경로(docs/manual.content.json 옆의 screens/ 폴더).
- 표의 셀 안 줄바꿈은 \\n. 문장은 보고서체("~한다", "~이다")로 통일.`

function docSections() {
  return `# 설명서 구성 (이 순서와 제목을 그대로 사용, 각 절은 충실하게)
1. 앱 개요 — 1.1 개발 배경과 목적 / 1.2 대상 사용자와 활용 장면 / 1.3 카테고리 적합성 / 1.4 핵심 특징 요약(표)
2. 주요 기능 — 기능 표(기능명 · 설명 · 사용 위치) + 기능별 상세 설명(동작 규칙, 알고리즘을 교사가 이해할 수 있는 말로)
3. 화면 구성 — 화면/탭마다 스크린샷 + 구성 요소 설명
4. 사용 방법 — 4.1 실행 방법(더블클릭, 권장 브라우저, 오프라인 가능, 온라인 링크) / 4.2 단계별 사용 절차(번호 목록, 스크린샷) / 4.3 활용 팁과 수업/업무 적용 예시 2~3개
5. 데이터 관리 — 저장 방식(localStorage), 내보내기/가져오기(JSON/CSV), 샘플로 초기화, 개인정보 유의사항
6. 기술 구조 — 6.1 파일 구조(code 블록) / 6.2 기술 스택과 설계 원칙 / 6.3 핵심 알고리즘·대표 기술 / 6.4 접근성·반응형·인쇄 등 품질 요소
7. 품질 검증 — 수행한 검증(정적 점검, 브라우저 자동화 테스트, 코드 리뷰, UX 리뷰, 수정·재검증 라운드)과 결과 요약 표. 아래 '빌드·검증 결과'의 사실만 기록
8. 바이브코딩 개발 과정 — 8.1 개발 절차 / 8.2 실제 사용한 프롬프트 요지(3~5개) / 8.3 AI 협업에서 배운 점·주의점 / 8.4 반복 횟수·발견된 결함 수(자료에 있는 사실만)
9. 제한 사항 및 향후 개선 — 현재 한계, 개선 아이디어 3~5개
부록 — A. 제출물 구성(설명서·소스 zip·실행 파일·온라인 링크) / B. 자주 묻는 질문 3~5개 / C. 수용 기준 체크리스트(스펙의 acceptance_criteria와 최종 판정 표)`
}

function writePrompt(spec, build) {
  const dir = root + '\\' + spec.folder_slug
  const url = 'file:///' + (root + '/' + spec.folder_slug + '/index.html').replace(/\\/g, '/')
  return `당신은 교육용 소프트웨어의 사용 설명서를 쓰는 테크니컬 라이터이자 초등교육 전문가입니다. 완성된 웹앱 "${spec.app_name}"의 **개요 및 설명서** 콘텐츠를 작성하세요. 교육대학교 과제 "바이브코딩으로 만드는 교육용 앱 개발"의 제출물로, 교수자가 앱을 열어 보지 않아도 무엇을 하는 앱인지, 어떻게 쓰는지, 어떻게 만들었는지 알 수 있어야 합니다. 분량 목표: A4 12~20쪽(스크린샷 포함).

# 경로·도구
- 앱 폴더: ${dir}
- 앱 URL: ${url}
- 스크린샷 저장 폴더(새로 생성): ${dir}\\docs\\screens\\
- 콘텐츠 JSON 저장 경로: ${dir}\\docs\\manual.content.json
- 스크린샷 촬영: node "${tools}\\pw-run.js" "${dir}\\index.html" "<테스트 모듈.js>" "${dir}\\docs\\screens"  (모듈 형식은 pw-run.js 상단 주석; shot('이름')으로 PNG 저장. 모듈 파일은 ${tools}\\..\\docshots\\${spec.app_name_en}.js 에 저장)
- 파일 작성은 Write 도구(Bash heredoc 금지). 스크린샷 PNG는 Read 도구로 열어 확인한다.

# 절차
1. 앱 폴더의 README.md, index.html, css, js를 모두 읽어 실제 동작·화면·용어를 정확히 파악한다(스펙이 아니라 **실제 구현**이 기준).
2. 스크린샷 촬영 모듈을 작성해 실행한다. 최소 6장, 최대 12장: 첫 화면(1280px 라이트), 각 주요 화면/탭, 핵심 기능이 동작한 결과 화면, 도움말 모달, 모바일 400px 화면, 다크 모드 1장. 각 장면은 샘플 데이터가 보이는 의미 있는 상태로. 파일명은 01-main.png처럼 번호-내용.png. 촬영 전 page.waitForTimeout(400). 화면이 길면 fullPage: false.
3. 촬영한 PNG를 모두 Read로 열어 의도한 장면인지 확인하고, 아니면 다시 찍는다.
4. 아래 구성대로 콘텐츠 JSON을 작성해 저장한다. 모든 서술은 실제 앱과 일치해야 하며(없는 기능 서술 금지), 알고리즘·규칙은 코드에서 확인한 대로 적는다.
5. node "${tools}\\make-docx.js" "${dir}\\docs\\manual.content.json" "${dir}\\docs\\_preview.docx" 로 변환이 오류 없이 되는지 확인한 뒤 미리보기 파일은 삭제한다.

${docSections()}

${DOC_FORMAT}

# 메타 정보
- 제출자: ${submitter}
- 작성일: ${today}
- 카테고리: ${spec.category_num}. ${spec.category}
${liveLinks && liveLinks[spec.app_name_en] ? `- 온라인 실행 링크(4.1절과 부록 A에 포함): ${liveLinks[spec.app_name_en]}` : ''}

# 빌드·검증 결과(7절·8절의 근거; 여기 있는 사실만 사용) — Read 도구로 읽을 것: ${qaPath} 의 apps 배열에서 app.app_name_en == "${spec.app_name_en}" 항목
${build ? JSON.stringify(build, null, 2) : ''}

# 개발 과정 요약(8절의 근거) — Read 도구로 읽을 것: ${processSummaryPath}

# 스펙(참고. 실제 구현과 다르면 구현이 우선) — Read 도구로 읽을 것: ${specsPath} 의 specs 배열에서 app_name_en == "${spec.app_name_en}" 항목(특히 features, screens, acceptance_criteria, tech_highlight, visual_identity)
${JSON.stringify(spec, null, 2)}

완료 후 content_path, 촬영한 스크린샷 목록(경로+캡션), 절별 블록 수, 확신이 낮은 서술 목록을 반환합니다.`
}

const WRITE_SCHEMA = {
  type: 'object',
  properties: {
    content_path: { type: 'string' },
    screenshots: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, caption: { type: 'string' } }, required: ['path', 'caption'] } },
    section_block_counts: { type: 'array', items: { type: 'object', properties: { heading: { type: 'string' }, blocks: { type: 'integer' } }, required: ['heading', 'blocks'] } },
    uncertain_claims: { type: 'array', items: { type: 'string' } },
    docx_preview_ok: { type: 'boolean' },
  },
  required: ['content_path', 'screenshots', 'section_block_counts', 'uncertain_claims', 'docx_preview_ok'],
}

function reviewPrompt(spec, written) {
  const dir = root + '\\' + spec.folder_slug
  return `당신은 꼼꼼한 기술 문서 검토자입니다. 웹앱 "${spec.app_name}"의 설명서 콘텐츠(${written.content_path})가 **실제 앱과 정확히 일치**하는지, 과제 제출물로서 충분한지 검토하세요. 문서와 앱 소스는 수정하지 않습니다.

# 절차
1. 콘텐츠 JSON을 읽고, 앱 폴더(${dir})의 README.md, index.html, css, js를 읽는다. 스크린샷(${dir}\\docs\\screens\\*.png)을 Read로 열어 캡션·본문 설명과 맞는지 확인한다.
2. 사실 오류(없는 기능, 다른 버튼 이름, 잘못된 규칙 설명), 누락(주요 기능·화면·필수 절), 스크린샷 문제(빈 화면·캡션 불일치·깨진 경로·6장 미만), 형식 오류(JSON 블록 type 오타, image path 오류, widths 합≠100), 과제 적합성(카테고리 적합성·개발 과정 구체성·분량 12쪽 이상)을 점검한다.
3. 각 지적에 위치(절 제목/블록 번호)와 수정안을 적는다. 심각도: critical(사실 오류/누락 절/깨진 이미지) · major(중요 누락·오해 소지) · minor(문체·오탈자).

# 작성자 보고
${JSON.stringify(written, null, 2)}

# 스펙(참고) — Read 도구로 읽을 것: ${specsPath} 의 specs 배열에서 app_name_en == "${spec.app_name_en}" 항목(features, screens, acceptance_criteria, tech_highlight)
${JSON.stringify(spec, null, 2)}`
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['ok', 'needs-revision'] },
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'major', 'minor'] }, location: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } },
      required: ['severity', 'location', 'problem', 'fix'] } },
    estimated_pages: { type: 'integer' },
    notes: { type: 'string' },
  },
  required: ['verdict', 'issues', 'estimated_pages', 'notes'],
}

function revisePrompt(spec, written, review) {
  const dir = root + '\\' + spec.folder_slug
  return `당신은 웹앱 "${spec.app_name}" 설명서의 작성자입니다. 검토자의 지적을 반영해 콘텐츠 JSON(${written.content_path})을 수정하세요.

# 절차
1. 콘텐츠 JSON과 지적 목록을 읽는다. 사실 확인이 필요한 지적은 앱 소스(${dir})를 읽어 확인한다.
2. critical·major는 모두 반영, minor도 가능한 한 반영. 스크린샷을 다시 찍어야 하면 node "${tools}\\pw-run.js" "${dir}\\index.html" "<모듈.js>" "${dir}\\docs\\screens" 로 촬영하고 Read로 확인한다.
3. 수정 후 node "${tools}\\make-docx.js" "${written.content_path}" "${dir}\\docs\\_preview.docx" 로 변환 오류가 없는지 확인하고 미리보기 파일은 삭제한다.
4. 파일 작성은 Write/Edit 도구 사용.

${DOC_FORMAT}

# 검토 결과
${JSON.stringify(review, null, 2)}

# 작성자 보고(원본)
${JSON.stringify(written, null, 2)}

반영한 항목과 반영하지 않은 항목(이유)을 반환합니다.`
}

const REVISE_SCHEMA = {
  type: 'object',
  properties: {
    applied: { type: 'array', items: { type: 'string' } },
    skipped: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, why: { type: 'string' } }, required: ['issue', 'why'] } },
    docx_preview_ok: { type: 'boolean' },
    screenshots_now: { type: 'array', items: { type: 'string' } },
  },
  required: ['applied', 'skipped', 'docx_preview_ok', 'screenshots_now'],
}

function reportPrompt(docResults) {
  return `당신은 교육대학교 AI 활용 강좌 수강생의 입장에서 과제 "바이브코딩으로 만드는 교육용 앱 개발"의 **전체 과제 보고서** 콘텐츠를 작성하는 테크니컬 라이터입니다. 5개 앱의 설명서는 각각 별도 문서로 제출되므로, 이 보고서는 전체를 조망하는 문서입니다. 분량 목표: A4 10~16쪽.

# 경로·도구
- 프로젝트 루트: ${root}
- 콘텐츠 JSON 저장 경로: ${root}\\과제제출물\\report.content.json  (폴더가 없으면 생성)
- 스크린샷: 각 앱의 docs/screens/01-*.png(첫 화면)를 사용. image path는 콘텐츠 JSON 기준 상대 경로: "../<folder_slug>/docs/screens/<파일>"
- 각 앱의 README.md와 docs/manual.content.json을 읽어 요약에 활용한다. 파일 작성은 Write 도구.
- 작성 후 node "${tools}\\make-docx.js" "${root}\\과제제출물\\report.content.json" "${root}\\과제제출물\\_preview.docx" 로 변환 확인 후 미리보기 삭제.

# 보고서 구성
1. 과제 개요 — 과제 요구사항(5개 카테고리, 제출물), 목표, 전체 접근 방식(바이브코딩 정의와 이 과제에서의 적용)
2. 개발한 앱 요약 — 5개 앱 표(번호·카테고리·앱 이름·한 줄 소개·대표 기술·폴더명) + 앱별 1쪽 요약(첫 화면 스크린샷, 목적, 핵심 기능 3~5개, 카테고리 적합성, 교육적/업무적 가치)
3. 공통 설계와 기술 구조 — 순수 HTML/CSS/JS 선택 이유, 공통 규약, 공통 샘플 데이터
4. 바이브코딩 개발 과정 — 4.1 전체 절차와 각 단계의 지시 요지 / 4.2 멀티 에이전트 워크플로(관점별 제안·심사, 3관점 검증, 수정 라운드) / 4.3 자동화 검증 도구 / 4.4 반복 횟수·결함 수 등 수치(자료의 사실만) / 4.5 프롬프트 작성에서 배운 점
5. 품질 검증 결과 — 앱별 검증 결과 표(결함 발견 수, 수정 라운드, 최종 상태, 코드 줄 수)
6. 활용 방안과 기대 효과
7. 한계와 향후 과제
8. 소감(1인칭, 과장 없이)
부록 — A. 제출물 목록과 폴더 구조 / B. 실행 방법 / C. 온라인 실행 링크(GitHub 저장소·GitHub Pages)

${DOC_FORMAT}
(title: "바이브코딩으로 만드는 교육용 앱 개발", subtitle: "과제 보고서 — 5개 교육용 앱 개발 결과", cover_label: "과제 제출물", accent: "1F3A5F", meta_rows: 과제명/강좌(${courseName})/제출자(${submitter})/제출일(${today})/개발 도구)

# 메타
- 제출자: ${submitter} / 작성일: ${today} / 강좌: ${courseName}
${liveLinks ? `- 온라인 실행 링크: ${JSON.stringify(liveLinks)}` : ''}

# 개발 과정 요약(사실 근거) — Read 도구로 읽을 것: ${processSummaryPath}

# 앱 목록과 빌드·검증 결과 — Read 도구로 읽을 것: ${qaPath}
${buildResults ? JSON.stringify(buildResults, null, 2) : ''}

# 앱별 설명서 작성 결과
${JSON.stringify(docResults.map(d => ({ app: d.app, screenshots: d.written ? d.written.screenshots.slice(0, 2) : [] })), null, 2)}

# 스펙 요약
${JSON.stringify(specs.map(s => ({ category_num: s.category_num, category: s.category, app_name: s.app_name, app_name_en: s.app_name_en, folder_slug: s.folder_slug, tagline: s.tagline, purpose: s.purpose, tech_highlight: s.tech_highlight })), null, 2)}

완료 후 content_path와 절별 블록 수, 확신이 낮은 서술을 반환합니다.`
}

phase('Write')
const docResults = await pipeline(
  specs,
  (spec) => {
    const build = (buildResults || []).find(b => b.app && b.app.app_name_en === spec.app_name_en) || null
    return agent(writePrompt(spec, build), { label: `doc-write:${spec.app_name_en}`, phase: 'Write', schema: WRITE_SCHEMA })
  },
  async (written, spec) => {
    if (!written) return null
    log(`[${spec.app_name}] 설명서 초안 완료(스크린샷 ${written.screenshots.length}장) → 검토`)
    const review = await agent(reviewPrompt(spec, written), { label: `doc-review:${spec.app_name_en}`, phase: 'Review', schema: REVIEW_SCHEMA })
    let revise = null
    if (review && (review.verdict === 'needs-revision' || review.issues.some(i => i.severity !== 'minor'))) {
      log(`[${spec.app_name}] 검토 지적 ${review.issues.length}건 → 수정`)
      revise = await agent(revisePrompt(spec, written, review), { label: `doc-revise:${spec.app_name_en}`, phase: 'Revise', schema: REVISE_SCHEMA })
    }
    return { app: { app_name: spec.app_name, app_name_en: spec.app_name_en, folder_slug: spec.folder_slug }, written, review, revise }
  }
)
const done = docResults.filter(Boolean)
log(`앱별 설명서 ${done.length}/${specs.length} 완료`)

if (skipReport) {
  log('전체 보고서 작성은 건너뜁니다(skipReport)')
  return { docs: done, report: null }
}
phase('Report')
const report = await agent(reportPrompt(done), { label: 'report', phase: 'Report', schema: WRITE_SCHEMA })
return { docs: done, report }
