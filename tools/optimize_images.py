"""Genera las imagenes WebP del juego a partir de los originales PNG.

Originales (no versionados): tools/src_images/{ops,maps}/*.png
  Se recuperan del historial: git show 3e4704e^:assets/ops/<id>.png  (420x756) y assets/maps/<id>.png (420x257).
  Los mapas ya estan en su resolucion nativa y no se regeneran (el WebP existente pesa menos).
Salida:
  assets/ops/<id>.webp    retrato 240 px de ancho (escritorio)
  assets/ops/s/<id>.webp  retrato 150 px de ancho (movil, via <picture>)
Uso: python tools/optimize_images.py
Tras regenerar, sube ASSET_VERSION en sw.js para invalidar la cache del service worker.
"""
import os, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'src_images')
# (carpeta origen, carpeta destino, ancho, calidad, calidad del canal alfa)
# El alfa de los retratos recortados pesa mucho: bajarlo a 50 ahorra ~25 % sin diferencia visible.
JOBS = (
    ('ops', os.path.join('assets', 'ops'), 240, 68, 50),
    ('ops', os.path.join('assets', 'ops', 's'), 150, 68, 50),
)

total = 0
for sub, dest, width, q, aq in JOBS:
    out_dir = os.path.join(ROOT, dest)
    os.makedirs(out_dir, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(SRC, sub, '*.png'))):
        im = Image.open(f).convert('RGBA')
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        out = os.path.join(out_dir, os.path.splitext(os.path.basename(f))[0] + '.webp')
        im.save(out, 'WEBP', quality=q, alpha_quality=aq, method=4)
        total += os.path.getsize(out)
    print(f'{dest}: ok')
print(f'total {total / 1024:.0f} KB')
