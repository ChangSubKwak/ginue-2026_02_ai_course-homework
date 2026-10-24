# summarize-findings.py — 검증 결과 JSON 요약. 사용법: python -I summarize-findings.py <tests 폴더> [앱 슬러그...]
import json
import os
import sys
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8")
base = sys.argv[1]
apps = sys.argv[2:] or sorted(d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d)) and d != "hub")
for app in apps:
    d = os.path.join(base, app)
    print(f"\n######## {app}")
    for fn in sorted(os.listdir(d)):
        if not (fn.startswith("findings-") or fn.startswith("fix-r") or fn.startswith("reverify-r")) or not fn.endswith(".json"):
            continue
        try:
            j = json.load(open(os.path.join(d, fn), encoding="utf-8"))
        except Exception as e:
            print(f"  == {fn}: JSON 오류 {e}")
            continue
        if fn.startswith("findings-"):
            f = j.get("findings", [])
            ac = j.get("acceptance_results", [])
            print(f"  == {fn}: findings {len(f)} {dict(Counter(x.get('severity') for x in f))} | AC fail {sum(1 for a in ac if a.get('status')=='fail')}/{len(ac)} | tests {len(j.get('test_files', []))}")
            print("     summary:", (j.get("summary") or "")[:260].replace("\n", " "))
            for x in f:
                if x.get('severity') != 'minor':
                    print(f"     - {x['id']} [{x['severity']}] {x['title'][:100]}")
        elif fn.startswith("fix-r"):
            print(f"  == {fn}: fixed {len(j.get('fixed', []))} / not_fixed {len(j.get('not_fixed', []))} | recheck lint {j.get('recheck', {}).get('lint_issues')} pw {j.get('recheck', {}).get('pw_problems')} | {str(j.get('recheck', {}).get('tests_summary'))[:160]}")
            for x in j.get("not_fixed", []):
                print(f"     - not fixed {x['id']}: {x['why'][:120]}")
        else:
            rem = [r for r in j.get("remaining", []) if r["severity"] != "minor"]
            new = [r for r in j.get("new_findings", []) if r["severity"] != "minor"]
            ac = j.get("acceptance_results", [])
            print(f"  == {fn}: status {j.get('status')} | remaining(critical/major) {len(rem)} | new {len(new)} | AC fail {sum(1 for a in ac if a.get('status')=='fail')}/{len(ac)} | lint {j.get('lint_issues')} pw {j.get('pw_problems')}")
            for r in rem + new:
                print(f"     - {r['id']} [{r['severity']}] {r['title'][:100]}")
