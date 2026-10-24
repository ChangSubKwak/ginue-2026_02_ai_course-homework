#!/bin/sh
# reverify-r1 러너: 기존 테스트 모듈 전부를 pw-run.js로 순차 실행하고 요약을 출력
T="C:/Users/parad/AppData/Local/Temp/claude/D--workspace-ginue-2026-02-ai-course-homework/1716854d-9f4f-4d06-ba55-fb3e97031963/scratchpad"
APP="D:/workspace/ginue-2026_02_ai_course-homework/03_업무자동화_자리뚝딱/index.html"
OUT="$T/tests/jari-ttukttak/reverify-r1"
mkdir -p "$OUT"
export PYTHONUTF8=1
for m in "$@"; do
  name=$(basename "$m" .js)
  echo "=== $name"
  node "$T/tools/pw-run.js" "$APP" "$T/tests/jari-ttukttak/$m" "$OUT/$name" > "$OUT/$name.log" 2>&1
  echo "exit=$?"
  node -e '
    const fs=require("fs"); const log=fs.readFileSync(process.argv[1],"utf8");
    const i=log.lastIndexOf("\n{"); let j; try { j=JSON.parse(log.slice(i+1)); } catch(e) { console.log(log.slice(-1500)); process.exit(0); }
    console.log("passed", j.passed.length, "failed", j.failed.length, "pageErrors", j.pageErrors.length, "consoleErrors", j.consoleErrors.length, "dialogs", j.dialogs.length, "fatal", j.fatal);
    j.failed.forEach(f=>console.log("  FAIL:", f)); j.pageErrors.forEach(f=>console.log("  PAGEERR:", f)); j.consoleErrors.forEach(f=>console.log("  CONSOLE:", f)); j.dialogs.forEach(f=>console.log("  DIALOG:", f));
  ' "$OUT/$name.log"
done
echo "=== ALL DONE"
