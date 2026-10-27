"""Assemble runtime CPU renders into a review animation, not a WebGL capture.

python compose-motion-preview.py FRAMES_DIR OUTPUT.gif
Requires Pillow; frame timing comes from the renderer's motion.json.
"""
import argparse
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('frames', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
meta = json.loads((args.frames / 'motion.json').read_text(encoding='utf-8'))
paths = sorted(args.frames.glob('[0-9][0-9][0-9].png'))
if len(paths) != meta['frames']:
    raise ValueError('Frame count differs from motion.json')
frames = []
for path in paths:
    with Image.open(path) as source:
        frames.append(source.convert('RGB'))
palette_source = Image.new('RGB', (64 * 8, 84 * ((len(frames) + 7) // 8)))
for index, frame in enumerate(frames):
    palette_source.paste(frame.resize((64, 84)), ((index % 8) * 64, (index // 8) * 84))
palette = palette_source.quantize(colors=128)
encoded = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
duration = meta['duration']
timing = [10 * (round((i + 1) * duration * 100 / len(frames)) - round(i * duration * 100 / len(frames))) for i in range(len(frames))]
args.output.parent.mkdir(parents=True, exist_ok=True)
encoded[0].save(args.output, save_all=True, append_images=encoded[1:], duration=timing, loop=0, disposal=2)
sheet = Image.new('RGB', (210 * 4, 280 * 3), '#ebe8e1')
for index in range(12):
    sample = round(index * (len(frames) - 1) / 11)
    sheet.paste(frames[sample].resize((210, 280)), ((index % 4) * 210, (index // 4) * 280))
sheet.save(args.output.with_suffix('.png'))
print(json.dumps({'animation': str(args.output), 'frames': len(frames), 'durationMs': sum(timing), 'renderer': meta['renderer']}))
