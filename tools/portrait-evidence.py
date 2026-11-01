"""Compose reference/before/after evidence from unaltered model renders.

Run after tools/model-preview.cjs has rendered portrait-before and portrait-final.
This makes review sheets, not new character textures or a likeness score.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'model-preview-output'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--before', type=Path, default=WORK / 'portrait-before')
parser.add_argument('--after', type=Path, default=WORK / 'portrait-final')
parser.add_argument('--out', type=Path, default=ROOT / 'docs/model-preview')
parser.add_argument('--label', default='2026-11-01')
args = parser.parse_args()
OUT = args.out
OUT.mkdir(parents=True, exist_ok=True)
font_path = Path('C:/Windows/Fonts/arial.ttf')
font = ImageFont.truetype(str(font_path), 19) if font_path.exists() else ImageFont.load_default()
small = ImageFont.truetype(str(font_path), 14) if font_path.exists() else font
names = ['Liu Bang', 'Xiang Yu', 'Zhang Liang', 'Fan Zeng', 'Xiang Bo', 'Fan Kuai', 'Xiang Zhuang', 'Chen Ping']
ids = ['hai', 'u', 'ryo', 'zo', 'haku', 'kai', 'sou', 'chin']
atlas = Image.open(ROOT / 'src/assets/character-atlas.png').convert('RGB')
before = Image.open(args.before / 'portraits-high.png').convert('RGB')
after = Image.open(args.after / 'portraits-high.png').convert('RGB')
sheet = Image.new('RGB', (1560, 1420), '#ebe8e1')
d = ImageDraw.Draw(sheet)
d.text((16, 12), 'Portrait reference / previous model / updated model - ' + args.label, fill='#252a2a', font=font)
d.text((16, 40), 'Same CPU geometry renderer and framing for before/after. Not a WebGL or photorealistic comparison.', fill='#414848', font=small)
for i, name in enumerate(names):
    x = (i % 2) * 780
    y = 75 + (i // 2) * 330
    d.text((x+10, y), name, fill='#252a2a', font=font)
    for j, label in enumerate(['Portrait reference', 'Before', 'After']):
        d.text((x+j*260+10, y+27), label, fill='#414848', font=small)
    col, row = i % 4, i // 4
    ref = atlas.crop((round(col*atlas.width/4), round(row*atlas.height/2), round((col+1)*atlas.width/4), round((row+1)*atlas.height/2)))
    sheet.paste(ref.resize((250, 250), Image.Resampling.LANCZOS), (x+5, y+54))
    for j, image in enumerate([before, after]):
        tw, th = image.width//4, image.height//2
        tile = image.crop((col*tw, row*th+35, (col+1)*tw, (row+1)*th-15))
        tile.thumbnail((250, 270), Image.Resampling.LANCZOS)
        sheet.paste(tile, (x+(j+1)*260+(260-tile.width)//2, y+54))
sheet.save(OUT / 'portrait-comparison.jpg', quality=92)
after.save(OUT / 'portrait-after.jpg', quality=93)
Image.open(args.after / 'portraits-low.png').convert('RGB').save(OUT / 'portrait-low.jpg', quality=91)
# Preserve actual four-view head crops for all eight, with view labels visible.
multi = Image.new('RGB', (1440, 8*400), '#ebe8e1')
for i, cid in enumerate(ids):
    image = Image.open(args.after / f'views/{cid}-high.png').convert('RGB')
    multi.paste(image.crop((0, 720, 1440, 1120)), (0, i*400))
multi.save(OUT / 'portrait-multiview.jpg', quality=92)
print('Saved comparison, high/low portraits and four-view head evidence.')
