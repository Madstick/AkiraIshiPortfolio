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
from content import WORKS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def p(*parts):
    return os.path.join(ROOT, *parts)


def frame(path, index):
    im = Image.open(path)
    n = getattr(im, 'n_frames', 1)
    im.seek(min(index, n - 1))
    return im.convert('RGB')


def make_stills():
    os.makedirs(p('images', 'work', 'stills'), exist_ok=True)
    jobs = [
        ('four-seasons', 'images/projects/4seasons_AkiraIshi75.gif', 0, 900),
        ('connecting', 'images/projects/connecting.webp', 60, 512),
        ('navigating-the-trenches', 'images/projects/navigating.webp', 100, 512),
    ]
    for slug, src, idx, width in jobs:
        im = frame(p(*src.split('/')), idx)
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
    for w in WORKS:
        if w['still']:
            card([w['still']], w['slug'], bg=(16, 16, 17) if w['slug'] in ('the-ossuary', 'connecting') else (241, 241, 239))
    collage = ['images/projects/ossuary.webp', 'images/projects/Technosignatures2.webp',
               'images/work/stills/four-seasons.webp', 'images/projects/beaties.webp']
    for name in ('home', 'work', 'about'):
        card(collage, name)


if __name__ == '__main__':
    make_stills()
    make_ossuary_video()
    make_cards()
