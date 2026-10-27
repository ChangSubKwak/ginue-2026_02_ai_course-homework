# package.py — 과제 제출물 폴더 구성 (앱별 소스 zip, 설명서 docx/pdf 복사, 전체 소스 zip, 목록 파일)
# 사용법: python -I package.py <프로젝트 루트> [제출물 폴더명=과제제출물]
import os
import re
import sys
import zipfile
import shutil

root = os.path.abspath(sys.argv[1])
out_name = sys.argv[2] if len(sys.argv) > 2 else "과제제출물"
out = os.path.join(root, out_name)
os.makedirs(out, exist_ok=True)

EXCLUDE_DIRS = {".idea", "node_modules", ".git", "__pycache__", out_name, "_dev"}
EXCLUDE_FILES = {"_preview.docx", "manual.content.json", "manual.simple.content.json","report.content.json", "main.py"}


def app_dirs():
    return sorted(d for d in os.listdir(root) if re.match(r"^0[1-5]_", d) and os.path.isdir(os.path.join(root, d)))


def add_tree(z, base, arc_prefix, skip_docs=False):
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in EXCLUDE_DIRS and not (skip_docs and d == "docs")]
        for fn in sorted(fns):
            if fn in EXCLUDE_FILES or fn.endswith(".zip") or fn.startswith("~$"):
                continue
            full = os.path.join(dp, fn)
            arc = os.path.join(arc_prefix, os.path.relpath(full, base)).replace("\\", "/")
            z.write(full, arc)


lines = ["[과제 제출물 목록] 바이브코딩으로 만드는 교육용 앱 개발", ""]
for d in app_dirs():
    app_path = os.path.join(root, d)
    zip_path = os.path.join(out, f"{d}_소스.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        add_tree(z, app_path, d, skip_docs=True)
    lines.append(f"■ {d}")
    lines.append(f"   - {os.path.basename(zip_path)}  (앱 소스: index.html, css/, js/, README.md — 압축 해제 후 index.html 더블클릭)")
    docs = os.path.join(app_path, "docs")
    if os.path.isdir(docs):
        for fn in sorted(os.listdir(docs)):
            if fn.endswith((".docx", ".pdf")) and not fn.startswith("_") and not fn.startswith("~$"):
                dst = os.path.join(out, f"{d}_{fn}")
                shutil.copy2(os.path.join(docs, fn), dst)
                kind = "1~2쪽 간단 사용법" if "간단사용법" in fn else "앱 개요 및 설명서"
                lines.append(f"   - {os.path.basename(dst)}  ({kind})")
    lines.append("")

all_zip = os.path.join(out, "00_전체소스_모든앱.zip")
with zipfile.ZipFile(all_zip, "w", zipfile.ZIP_DEFLATED) as z:
    for fn in ("index.html", "README.md"):
        p = os.path.join(root, fn)
        if os.path.exists(p):
            z.write(p, fn)
    for d in app_dirs():
        add_tree(z, os.path.join(root, d), d, skip_docs=True)
lines.append(f"■ 전체: {os.path.basename(all_zip)}  (5개 앱 + 허브 페이지 index.html + README.md)")

for fn in sorted(os.listdir(out)):
    if fn.startswith("00_") and fn.endswith((".docx", ".pdf")):
        lines.append(f"■ 보고서: {fn}")

lines.append("")
lines.append("실행 방법: zip을 풀고 index.html을 더블클릭하면 브라우저(Chrome/Edge 권장)에서 바로 실행됩니다. 설치·인터넷 연결이 필요 없습니다.")
with open(os.path.join(out, "제출물_목록.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

for fn in sorted(os.listdir(out)):
    print(f"{os.path.getsize(os.path.join(out, fn)):>10,d}  {fn}")
