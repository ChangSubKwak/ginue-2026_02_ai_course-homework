# pdf2png.py — PDF 페이지를 PNG로 렌더링 (pymupdf)
# 사용법: python -I pdf2png.py in.pdf out_prefix [zoom]
import sys
import pymupdf

doc = pymupdf.open(sys.argv[1])
prefix = sys.argv[2]
zoom = float(sys.argv[3]) if len(sys.argv) > 3 else 1.2
for i, page in enumerate(doc):
    page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(f"{prefix}-{i+1:02d}.png")
print(f"{len(doc)} pages -> {prefix}-NN.png")
