# collect-qa.py — 앱별 빌드·검증·수정·재검증 결과를 하나의 JSON으로 수집 (문서화 단계 입력)
# 사용법: python -I collect-qa.py <final_specs.json> <tests 폴더> <출력 json> [pages_base_url]
import json
import os
import sys
from collections import Counter
from urllib.parse import quote

sys.stdout.reconfigure(encoding="utf-8")
specs_file, tests_dir, out_file = sys.argv[1], sys.argv[2], sys.argv[3]
pages_base = sys.argv[4] if len(sys.argv) > 4 else ""
specs = json.load(open(specs_file, encoding="utf-8"))["specs"]


def load(path):
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:
        return None


results = []
live_links = {}
for s in specs:
    d = os.path.join(tests_dir, s["app_name_en"])
    build = load(os.path.join(d, "build-report.json")) or {}
    findings = {}
    for kind in ("functional", "code", "ux"):
        j = load(os.path.join(d, f"findings-{kind}.json"))
        if j:
            f = j.get("findings", [])
            sev = Counter(x.get("severity") for x in f)
            findings[kind] = {
                "total": len(f), "critical": sev.get("critical", 0), "major": sev.get("major", 0), "minor": sev.get("minor", 0),
                "acceptance_fail": sum(1 for a in j.get("acceptance_results", []) if a.get("status") == "fail"),
                "summary": (j.get("summary") or "")[:400],
                "top": [{"id": x.get("id"), "severity": x.get("severity"), "title": x.get("title")} for x in f if x.get("severity") != "minor"][:8],
            }
    rounds = []
    for r in (1, 2, 3):
        fx = load(os.path.join(d, f"fix-r{r}.json"))
        rv = load(os.path.join(d, f"reverify-r{r}.json"))
        if not fx and not rv:
            continue
        rounds.append({
            "round": r,
            "fixed": len(fx.get("fixed", [])) if fx else None,
            "not_fixed": [{"id": x.get("id"), "why": x.get("why")} for x in fx.get("not_fixed", [])] if fx else None,
            "recheck": fx.get("recheck") if fx else None,
            "reverify_status": rv.get("status") if rv else None,
            "remaining_critical_major": [x for x in rv.get("remaining", []) if x.get("severity") != "minor"] if rv else None,
            "new_critical_major": [x for x in rv.get("new_findings", []) if x.get("severity") != "minor"] if rv else None,
            "acceptance": {"pass": sum(1 for a in rv.get("acceptance_results", []) if a.get("status") == "pass"),
                           "fail": sum(1 for a in rv.get("acceptance_results", []) if a.get("status") == "fail"),
                           "untested": sum(1 for a in rv.get("acceptance_results", []) if a.get("status") == "untested")} if rv else None,
            "tests_summary": (rv.get("tests_summary") or rv.get("notes") or "")[:300] if rv else None,
        })
    final = rounds[-1] if rounds else None
    app_dir = os.path.join(os.path.dirname(specs_file), "..", s["folder_slug"])
    lines = 0
    for dp, dns, fns in os.walk(os.path.abspath(app_dir)):
        dns[:] = [x for x in dns if x not in ("docs",)]
        for fn in fns:
            if fn.endswith((".html", ".css", ".js")):
                lines += sum(1 for _ in open(os.path.join(dp, fn), encoding="utf-8", errors="ignore"))
    link = f"{pages_base.rstrip('/')}/{quote(s['folder_slug'])}/" if pages_base else ""
    if link:
        live_links[s["app_name_en"]] = link
    results.append({
        "app": {"app_name": s["app_name"], "app_name_en": s["app_name_en"], "folder_slug": s["folder_slug"], "category_num": s["category_num"], "category": s["category"]},
        "code_lines": lines,
        "build": {"files": build.get("files"), "features": build.get("features"), "self_check": build.get("self_check"), "known_issues": build.get("known_issues")},
        "findings": findings,
        "findings_total": sum(v["total"] for v in findings.values()),
        "findings_critical_major": sum(v["critical"] + v["major"] for v in findings.values()),
        "rounds": rounds,
        "final_status": final["reverify_status"] if final else "unknown",
        "live_link": link,
    })
    print(f"{s['app_name']}: {lines}줄 | 결함 {sum(v['total'] for v in findings.values())}건(critical/major {sum(v['critical']+v['major'] for v in findings.values())}) | 라운드 {len(rounds)} | 최종 {final['reverify_status'] if final else '-'}")

json.dump({"apps": results, "live_links": live_links, "pages_base": pages_base}, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("wrote", out_file)
