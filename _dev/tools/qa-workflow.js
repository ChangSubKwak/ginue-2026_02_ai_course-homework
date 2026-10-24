export const meta = {
  name: 'edu-apps-qa',
  description: '앱별 검증(기능·코드·UX, 누락분만) → 수정 → 재검증 루프(최대 3라운드). 브리프 파일 기반',
  phases: [
    { title: 'Verify', detail: '누락된 검증만 실행 (기능 테스트 / 코드 리뷰 / UX 리뷰)' },
    { title: 'Fix', detail: '결함 수정 + 재점검' },
    { title: 'Re-verify', detail: '독립 재검증, critical/major 0건이면 종료' },
  ],
}

// args: { briefsDir, apps: [{ slug, app_name, verify: ['functional','code','ux'], startStage: 'verify'|'fix'|'reverify', startRound: 1 }], maxRounds }
const { briefsDir, apps, maxRounds } = args
const ROUNDS = maxRounds || 3

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    findings_file: { type: 'string' },
    critical: { type: 'integer' }, major: { type: 'integer' }, minor: { type: 'integer' },
    acceptance_fail: { type: 'integer' },
    summary: { type: 'string' },
  },
  required: ['findings_file', 'critical', 'major', 'minor', 'acceptance_fail', 'summary'],
}
const FIX_SCHEMA = {
  type: 'object',
  properties: {
    fix_file: { type: 'string' }, fixed: { type: 'integer' }, not_fixed: { type: 'integer' },
    lint_issues: { type: 'integer' }, pw_problems: { type: 'integer' }, tests_summary: { type: 'string' }, notes: { type: 'string' },
  },
  required: ['fix_file', 'fixed', 'not_fixed', 'lint_issues', 'pw_problems', 'tests_summary', 'notes'],
}
const REVERIFY_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pass', 'fail'] },
    reverify_file: { type: 'string' },
    remaining_critical_major: { type: 'integer' },
    new_critical_major: { type: 'integer' },
    acceptance_fail: { type: 'integer' },
    notes: { type: 'string' },
  },
  required: ['status', 'reverify_file', 'remaining_critical_major', 'new_critical_major', 'acceptance_fail', 'notes'],
}

const VERIFY_TITLE = { functional: '기능 검증(QA)', code: '코드 리뷰', ux: 'UX·시각 리뷰' }

function verifyPrompt(app, type) {
  const extra = type === 'functional'
    ? '빌더가 작성한 테스트 모듈이 테스트 폴더에 있어도 그대로 믿지 말고 독립적으로 func-*.js 모듈을 작성해 검증하세요(이전 담당자가 중단 전 작성한 func-*.js가 있으면 재활용·보완). Canvas 게임이면 window.__app.getState()와 DOM 표시값으로 검증합니다.'
    : type === 'ux'
      ? '모든 화면·탭·모달(게임이면 진행 중·결과 화면 포함)의 스크린샷을 찍어 Read로 직접 확인하세요. 이전 담당자가 찍은 스크린샷이 있으면 재활용하고 부족한 장면만 추가 촬영하세요.'
      : '의심되는 로직은 node 또는 pw-run.js로 직접 재현해 확인하고, 확인하지 못한 것은 "추정"으로 표시하세요.'
  return `교육용 웹앱 "${app.app_name}"의 ${VERIFY_TITLE[type]} 작업입니다. 전체 지시사항은 아래 브리프 파일에 있습니다. 가장 먼저 Read 도구로 브리프 전체를 읽고 지시대로 수행하세요. 앱 소스는 수정하지 않으며, 결과 JSON을 브리프에 적힌 경로에 저장합니다.

브리프: ${briefsDir}\\${app.slug}.verify-${type}.md
${extra}

완료 후 구조화 출력으로 findings 파일 경로, 심각도별 건수, 실패한 수용 기준 수, 한 줄 요약을 반환하세요.`
}

function fixPrompt(app, round) {
  return `교육용 웹앱 "${app.app_name}"의 결함 수정(${round}라운드) 작업입니다. 전체 지시사항은 아래 브리프 파일에 있습니다. 가장 먼저 Read 도구로 브리프 전체를 읽고, 브리프가 가리키는 결함 목록 JSON(findings-functional/code/ux${round > 1 ? `, reverify-r${round - 1}` : ''})과 앱 소스를 읽은 뒤 지시대로 수정·재점검하세요. critical·major는 반드시 수정하고, 기존 테스트 모듈을 모두 재실행해 통과시키세요. 결과 JSON을 브리프에 적힌 경로(fix-r${round}.json)에 저장합니다. 파일 수정은 Write/Edit 도구만 사용(Bash heredoc 금지). 프로젝트 루트는 git 저장소이므로 git diff로 이전 수정 내역을 확인할 수 있습니다.

브리프: ${briefsDir}\\${app.slug}.fix-r${round}.md

완료 후 구조화 출력으로 fix 파일 경로, 수정/미수정 건수, lint·pw-check 결과, 테스트 요약을 반환하세요.`
}

function reverifyPrompt(app, round) {
  return `교육용 웹앱 "${app.app_name}"의 ${round}라운드 수정 결과를 독립적으로 재검증하는 작업입니다. 전체 지시사항은 아래 브리프 파일에 있습니다. 가장 먼저 Read 도구로 브리프 전체를 읽고 지시대로 수행하세요(수정 보고서의 주장을 믿지 말고 소스·브라우저로 직접 확인, 회귀 탐지). 앱 소스는 수정하지 않습니다. 결과 JSON을 브리프에 적힌 경로(reverify-r${round}.json)에 저장합니다.

브리프: ${briefsDir}\\${app.slug}.reverify-r${round}.md

완료 후 구조화 출력으로 status(pass/fail), reverify 파일 경로, 잔여 critical/major 수, 새로 발견된 critical/major 수, 실패한 수용 기준 수, 요약을 반환하세요.`
}

const results = await pipeline(
  apps,
  async (app) => {
    const stage = app.startStage || 'verify'
    const out = { slug: app.slug, app_name: app.app_name, verify: {}, rounds: [], final: null }
    if (stage === 'verify' && app.verify && app.verify.length) {
      log(`[${app.app_name}] 검증 시작: ${app.verify.join(', ')}`)
      const vs = await parallel(app.verify.map(type => () =>
        agent(verifyPrompt(app, type), { label: `verify-${type}:${app.slug}`, phase: 'Verify', schema: VERIFY_SCHEMA })))
      app.verify.forEach((type, i) => { out.verify[type] = vs[i] })
      const cm = vs.filter(Boolean).reduce((a, v) => a + v.critical + v.major, 0)
      log(`[${app.app_name}] 검증 완료: critical/major ${cm}건`)
    }
    let round = app.startRound || 1
    let skipFix = stage === 'reverify'
    for (; round <= ROUNDS; round++) {
      let fix = null
      if (!skipFix) {
        fix = await agent(fixPrompt(app, round), { label: `fix-r${round}:${app.slug}`, phase: 'Fix', schema: FIX_SCHEMA })
        log(`[${app.app_name}] ${round}라운드 수정: ${fix ? `${fix.fixed}건 수정, ${fix.not_fixed}건 미수정` : '결과 없음'}`)
      }
      skipFix = false
      const rv = await agent(reverifyPrompt(app, round), { label: `reverify-r${round}:${app.slug}`, phase: 'Re-verify', schema: REVERIFY_SCHEMA })
      out.rounds.push({ round, fix, reverify: rv })
      out.final = rv
      if (!rv) { log(`[${app.app_name}] ${round}라운드 재검증 결과 없음`); break }
      const remaining = rv.remaining_critical_major + rv.new_critical_major
      log(`[${app.app_name}] ${round}라운드 재검증: ${rv.status} (critical/major 잔여 ${remaining}건, AC 실패 ${rv.acceptance_fail}건)`)
      if (rv.status === 'pass' || (remaining === 0 && rv.acceptance_fail === 0)) break
    }
    return out
  }
)
return results.filter(Boolean)
