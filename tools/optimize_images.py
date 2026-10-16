"""Convierte assets/ops/*.png y assets/maps/*.png a WebP reducido (y borra los PNG). Uso: python tools/optimize_images.py"""
import os, glob
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for sub, width, q in (('ops', 300, 80), ('maps', 720, 76)):
    for f in glob.glob(os.path.join(ROOT, 'assets', sub, '*.png')):
        im = Image.open(f).convert('RGBA')
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(f[:-4] + '.webp', 'WEBP', quality=q, method=6)
        os.remove(f)
print('ok')
