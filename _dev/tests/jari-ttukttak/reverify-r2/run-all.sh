#!/bin/bash
APP="D:/workspace/ginue-2026_02_ai_course-homework/03_업무자동화_자리뚝딱/index.html"
TOOLS="C:/Users/parad/AppData/Local/Temp/claude/D--workspace-ginue-2026-02-ai-course-homework/1716854d-9f4f-4d06-ba55-fb3e97031963/scratchpad/tools"
BASE="C:/Users/parad/AppData/Local/Temp/claude/D--workspace-ginue-2026-02-ai-course-homework/1716854d-9f4f-4d06-ba55-fb3e97031963/scratchpad/tests/jari-ttukttak"
OUT="$BASE/reverify-r2"
: > "$OUT/run-all.summary.txt"
for m in acceptance.js code-01-accept.js code-02-bugs.js code-03-badge.js func-roster.js func-seats.js func-groups-present-print.js func-storage-responsive.js ux-shots.js fix-r1-verify.js fix-r2-verify.js reverify-r1/reverify.js; do
  name=$(basename "$m" .js)
  mkdir -p "$OUT/$name"
  node "$TOOLS/pw-run.js" "$APP" "$BASE/$m" "$OUT/$name" > "$OUT/$name.log" 2>&1
  node -e '
    const r=require(process.argv[1]);
    console.log(process.argv[2]+": "+r.passed.length+" passed / "+r.failed.length+" failed - pageErrors "+r.pageErrors.length+" - consoleErrors "+r.consoleErrors.length+" - dialogs "+r.dialogs.length+" - fatal "+(r.fatal?"YES":"none"));
    if(r.failed.length) console.log("  FAILED: "+JSON.stringify(r.failed));
    if(r.fatal) console.log("  FATAL: "+r.fatal);
    if(r.pageErrors.length) console.log("  PAGEERR: "+JSON.stringify(r.pageErrors));
    if(r.consoleErrors.length) console.log("  CONSOLE: "+JSON.stringify(r.consoleErrors));
  ' "$OUT/$name/$name.result.json" "$name" >> "$OUT/run-all.summary.txt" 2>&1 || echo "$name: NO RESULT (see log)" >> "$OUT/run-all.summary.txt"
done
echo "DONE" >> "$OUT/run-all.summary.txt"
