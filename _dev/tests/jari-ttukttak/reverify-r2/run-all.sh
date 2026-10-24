#!/bin/sh
# reverify-r2 러너: 기존 테스트 모듈 전부를 pw-run.js로 순차 실행하고 요약을 출력
ROOT="D:/workspace/ginue-2026_02_ai_course-homework"
APP="$ROOT/03_업무자동화_자리뚝딱/index.html"
TD="$ROOT/_dev/tests/jari-ttukttak"
OUT="$TD/reverify-r2"
mkdir -p "$OUT"
export PYTHONUTF8=1
SUM="$OUT/run-all.summary.txt"
: > "$SUM"
for m in "$@"; do
  name=$(basename "$m" .js)
  echo "=== $name"
  node "$ROOT/_dev/tools/pw-run.js" "$APP" "$TD/$m" "$OUT/$name" > "$OUT/$name.log" 2>&1
  echo "exit=$?"
  node -e '
    const fs=require("fs"); const log=fs.readFileSync(process.argv[1],"utf8"); const name=process.argv[2], sum=process.argv[3];
    const i=log.lastIndexOf("\n{"); let j; try { j=JSON.parse(log.slice(i+1)); } catch(e) { console.log(log.slice(-1500)); fs.appendFileSync(sum, name+": PARSE FAIL\n"); process.exit(0); }
    const line = name+": "+j.passed.length+" passed / "+j.failed.length+" failed · pageErrors "+j.pageErrors.length+" · consoleErrors "+j.consoleErrors.length+" · dialogs "+j.dialogs.length+" · fatal "+(j.fatal?"YES":"none");
    console.log(line); fs.appendFileSync(sum, line+"\n");
    j.failed.forEach(f=>{console.log("  FAIL:", f); fs.appendFileSync(sum, "  FAIL: "+f+"\n");}); j.pageErrors.forEach(f=>{console.log("  PAGEERR:", f); fs.appendFileSync(sum, "  PAGEERR: "+f+"\n");}); j.consoleErrors.forEach(f=>console.log("  CONSOLE:", f)); j.dialogs.forEach(f=>console.log("  DIALOG:", f)); if (j.fatal) { console.log("  FATAL:", j.fatal); fs.appendFileSync(sum, "  FATAL: "+j.fatal+"\n"); }
  ' "$OUT/$name.log" "$name" "$SUM"
done
echo "=== ALL DONE"
