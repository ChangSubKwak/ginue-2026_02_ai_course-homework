#!/usr/bin/env bash
# render-docs.sh — 각 앱의 docs/manual.content.json → docs/<앱이름>_개요및설명서.docx/.pdf, 과제제출물/report.content.json → 과제보고서
# 사용법: bash render-docs.sh <프로젝트 루트> [앱 폴더명...]   (앱 폴더명 생략 시 0*_ 전체 + 보고서)
set -u
ROOT="$1"; shift || true
TOOLS="$ROOT/_dev/tools"
render() { # $1=content.json  $2=출력 기본 경로(확장자 제외)
  local src="$1" base="$2"
  node "$TOOLS/make-docx.js" "$src" "$base.docx" || { echo "FAIL docx: $src"; return 1; }
  powershell -NoProfile -File "$(cygpath -w "$TOOLS/docx2pdf.ps1")" -In "$(cygpath -w "$base.docx")" -Out "$(cygpath -w "$base.pdf")" || { echo "FAIL pdf: $base"; return 1; }
}
if [ "$#" -eq 0 ]; then set -- $(cd "$ROOT" && ls -d 0*_*/ | tr -d '/'); DO_REPORT=1; else DO_REPORT=0; fi
for app in "$@"; do
  c="$ROOT/$app/docs/manual.content.json"
  if [ -f "$c" ]; then
    name="${app#*_}"; name="${name#*_}"   # 0N_카테고리_앱이름 → 앱이름
    render "$c" "$ROOT/$app/docs/${name}_개요및설명서"
  else
    echo "SKIP (no content): $app"
  fi
done
if [ "${DO_REPORT:-0}" = "1" ] && [ -f "$ROOT/과제제출물/report.content.json" ]; then
  render "$ROOT/과제제출물/report.content.json" "$ROOT/과제제출물/00_과제보고서_바이브코딩교육용앱개발"
fi
