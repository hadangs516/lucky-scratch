# 스크린샷 여러 장을 한 장으로 모아 보기(검토용)
# 사용법: python3 tools/montage.py 출력.png 열수 폭 이미지...
import sys
from PIL import Image, ImageDraw
out, cols, width = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in files]
w = width
hs = [int(im.height * w / im.width) for im in ims]
h = max(hs)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 8) + 8, rows * (h + 28) + 8), (40, 40, 40))
d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, files)):
    x = 8 + (i % cols) * (w + 8)
    y = 8 + (i // cols) * (h + 28)
    sheet.paste(im.resize((w, int(im.height * w / im.width))), (x, y + 20))
    d.text((x, y + 4), f.split('/')[-1], fill=(255, 255, 255))
sheet.save(out)
