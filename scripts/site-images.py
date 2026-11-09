# Converts the website's phone screenshots to WebP: python3 scripts/site-images.py   (needs Pillow)
# Each site/img/*.png except icon.png and og.png becomes a 640-wide .webp (2x the largest size the page shows),
# and the PNG is deleted. Keep site/index.html's width="640" height="1349" in step if the screens change shape.
import glob, os
from PIL import Image

here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "img")
for f in sorted(glob.glob(os.path.join(here, "*.png"))):
    if os.path.basename(f) in ("icon.png", "og.png"):
        continue
    im = Image.open(f).convert("RGBA")
    w = 640
    h = round(im.height * w / im.width)
    out = f[:-4] + ".webp"
    im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=82, method=6)
    os.remove(f)
    print(os.path.basename(out), w, h, os.path.getsize(out) // 1024, "KB")
