# -*- coding: utf-8 -*-
"""Makes the small derived images the portfolio pages need.

  - still frames of the animated works (used for share cards and for visitors who ask for reduced motion)
  - the larger Ossuary video for its own page
  - 1200x630 share images (Open Graph) for every page

Needs Pillow, and imageio-ffmpeg for the video (only the first time).
Run from the repository root:  python _build/make_assets.py
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from content import WORKS, OTHER  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def p(*parts):
    return os.path.join(ROOT, *parts)


def frame(path, index):
    im = Image.open(path)
    n = getattr(im, 'n_frames', 1)
    im.seek(min(index, n - 1))
    return im.convert('RGB')


# Connecting and Navigating the Trenches were recorded as 16:9 videos with the artwork in the middle and black
# on both sides. These are the artwork's own rectangles inside the 800x450 frames: (width, height, x, y).
# The GIFs in images/projects are the sources for the cropped loops (and nothing else uses them).
ARTWORK_BOX = {
    'connecting': (434, 450, 182, 0),
    'navigating': (374, 374, 212, 47),
}


def crop_box(im, name):
    w, h, x, y = ARTWORK_BOX[name]
    return im.crop((x, y, x + w, y + h))


def make_square_loops():
    """images/projects/connecting.webm and navigating.webm: the artwork alone, silent, looping."""
    import imageio_ffmpeg
    import subprocess
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    for name, (w, h, x, y) in ARTWORK_BOX.items():
        src = p('images', 'projects', name + '.gif')
        out = p('images', 'projects', name + '.webm')
        subprocess.check_call([ff, '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-an',
                               '-vf', 'crop=%d:%d:%d:%d,fps=25' % (w, h, x, y), '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0',
                               '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', out])
        print('loop', name, os.path.getsize(out) // 1024, 'KB')


def make_stills():
    os.makedirs(p('images', 'work', 'stills'), exist_ok=True)
    jobs = [
        ('four-seasons', 'images/projects/4seasons_AkiraIshi75.gif', 0, 900, None),
        ('connecting', 'images/projects/connecting.gif', 90, 900, 'connecting'),
        ('navigating-the-trenches', 'images/projects/navigating.gif', 100, 900, 'navigating'),
    ]
    for slug, src, idx, width, box in jobs:
        im = frame(p(*src.split('/')), idx)
        if box:
            im = crop_box(im, box)
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(p('images', 'work', 'stills', slug + '.webp'), 'WEBP', quality=82, method=6)
        print('still', slug, im.size)


def make_ossuary_video():
    out = p('images', 'projects', 'ossuary-hero.webm')
    src = os.path.join(os.path.expanduser('~'), 'Downloads', 'ossuary-1.mp4')
    if os.path.exists(out):
        print('exists', out)
        return
    if not os.path.exists(src):
        print('skipped the Ossuary video: source not found at', src)
        return
    import imageio_ffmpeg
    import subprocess
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.check_call([ff, '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-an',
                           '-vf', 'scale=720:900:flags=lanczos,fps=24', '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0',
                           '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', out])
    print('video', os.path.getsize(out) // 1024, 'KB')


def card(paths, name, bg=(241, 241, 239)):
    """A 1200x630 share image: the artwork(s) contained on a neutral ground."""
    canvas = Image.new('RGB', (1200, 630), bg)
    imgs = [Image.open(p(*path.split('/'))).convert('RGB') for path in paths]
    if len(imgs) == 1:
        slots = [(0, 0, 1200, 630)]
    else:
        n = len(imgs)
        w = 1200 // n
        slots = [(i * w, 0, w, 630) for i in range(n)]
    for im, (x, y, w, h) in zip(imgs, slots):
        scale = min(w / im.width, h / im.height) if len(imgs) == 1 else max(w / im.width, h / im.height)
        im2 = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
        if len(imgs) > 1:
            left = (im2.width - w) // 2
            top = (im2.height - h) // 2
            im2 = im2.crop((left, top, left + w, top + h))
        canvas.paste(im2, (x + (w - im2.width) // 2, y + (h - im2.height) // 2))
    os.makedirs(p('images', 'og'), exist_ok=True)
    canvas.save(p('images', 'og', name + '.jpg'), 'JPEG', quality=86, optimize=True)
    print('og', name)


def make_cards():
    for w in WORKS + OTHER:
        if w['still']:
            card([w['still']], w['slug'], bg=(16, 16, 17) if w['slug'] in ('the-ossuary', 'connecting', 'genesis') else (241, 241, 239))
    collage = ['images/projects/ossuary.webp', 'images/projects/Technosignatures2.webp',
               'images/work/stills/four-seasons.webp', 'images/projects/beaties.webp']
    for name in ('home', 'work', 'about'):
        card(collage, name)
    # the shop and the stand-alone pieces get their own share cards too
    card(['images/atelier/slc-hero.webp'], 'shop')
    card(['images/projects/jardin-algorithmique.webp'], 'jardin-algorithmique')


def make_icons():
    """A plain monogram for the portfolio pages (the Reliquary keeps its own icon)."""
    from PIL import ImageDraw, ImageFont
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0d0d0d"/>'
           '<text x="32" y="43" text-anchor="middle" font-family="IBM Plex Sans, Arial, sans-serif" font-weight="500" '
           'font-size="30" letter-spacing="-1" fill="#ffffff">AI</text></svg>')
    with open(p('images', 'favicon.svg'), 'w', encoding='utf-8') as fh:
        fh.write(svg)
    font_path = None
    for candidate in (r'C:\Windows\Fonts\arial.ttf', '/Library/Fonts/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(candidate):
            font_path = candidate
            break
    def draw(size):
        im = Image.new('RGB', (size, size), (13, 13, 13))
        d = ImageDraw.Draw(im)
        font = ImageFont.truetype(font_path, round(size * 0.47)) if font_path else ImageFont.load_default()
        box = d.textbbox((0, 0), 'AI', font=font)
        d.text(((size - (box[2] - box[0])) / 2 - box[0], (size - (box[3] - box[1])) / 2 - box[1]), 'AI', fill=(255, 255, 255), font=font)
        return im
    draw(180).save(p('images', 'apple-touch-icon.png'), 'PNG')
    draw(256).save(p('images', 'favicon-ai.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    print('icons')


if __name__ == '__main__':
    make_square_loops()
    make_stills()
    make_ossuary_video()
    make_cards()
    make_icons()
