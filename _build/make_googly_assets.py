# -*- coding: utf-8 -*-
"""Makes the light pictures used by GooglyRocks.html from the original site's PNGs.

The original site (googly-main) weighed 6.8 MB, mostly PNGs. Here every picture becomes a WebP of the size it is
actually shown at, the favicon shrinks from 188 KB to a few KB, and a 1200x630 share card is composed.

Run from the repository root, pointing at the unzipped original:
    python _build/make_googly_assets.py "C:/path/to/googly-main"
"""
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'googly')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser('~'), 'Downloads', 'googly-main')


def src(*parts):
    return os.path.join(SRC, *parts)


def out(*parts):
    path = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def save_webp(im, name, width=None, quality=82, lossless=False, alpha_quality=60):
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    # the edge of a crayon line is soft anyway: a lossy alpha channel is a third of the weight and looks the same
    kwargs = {'lossless': True} if lossless else {'quality': quality, 'alpha_quality': alpha_quality}
    im.save(out('img', name), 'WEBP', method=6, **kwargs)
    print('%-34s %5d KB  %s' % (name, os.path.getsize(out('img', name)) // 1024, im.size))


def main():
    # the crumpled graph paper behind everything (a fixed layer, so one screenful is enough)
    save_webp(Image.open(src('public', 'feuilletest-1500w.png')).convert('RGB'), 'paper.webp', width=1100, quality=62)

    # the crayon drawings: flat colours, so they stay sharp at a small size
    save_webp(Image.open(src('public', 'maison2-1200h.png')).convert('RGBA'), 'house.webp', width=1400, quality=70, alpha_quality=25)
    drawings = (  # (original file, new name, width, quality)
        ('logogoogly-200h', 'logo', 420), ('mint', 'mint', 520), ('two-200h', 'pair', 330), ('3little-300h', 'trio', 470),
        ('rock1-200w', 'rock-blue', 120), ('rock2-200w', 'rock-red', 120), ('fleche1-200h', 'arrow', 240),
        ('note simple-500h', 'note1', 60), ('notedouble-500h', 'note2', 180),
        ('supply-1200w', 'supply', 340), ('price-1200w', 'price', 280), ('pie-1200w', 'pie', 340),
        # the four little logos
        ('logotwitter-1500w', 'twitter', 180), ('logodiscord2-1500w', 'discord', 180),
        ('logohighlight', 'highlight', 124), ('logoopensea', 'opensea', 174),
    )
    for name, new_name, width in drawings:
        save_webp(Image.open(src('public', name + '.png')).convert('RGBA'), new_name + '.webp', width=width, quality=84)
    # the two avatars of the credits
    save_webp(Image.open(src('public', 'agoraz-300h.png')).convert('RGB'), 'agoraz.webp', width=300, quality=80)
    # Akira's picture is the portfolio's own, not the original site's
    save_webp(Image.open(os.path.join(ROOT, 'images', 'desktop-icons', 'reliquary', 'pfpAkira.jpg')).convert('RGB'),
              'akira.webp', width=480, quality=82)

    # the ten rocks: photographs, shown at about 420 px wide
    for n in (1, 10, 13, 18, 21, 24, 26, 45, 52, 53):
        save_webp(Image.open(src('images', 'coolrock%d.png' % n)).convert('RGB'), 'rock-%d.webp' % n, width=640, quality=76)

    # the font (12 KB) and a small favicon set instead of the 256 px, 188 KB .ico
    os.makedirs(out('fonts'), exist_ok=True)
    shutil.copyfile(src('public', 'fonts', 'kids-regular.ttf'), out('fonts', 'kids-regular.ttf'))
    ico = Image.open(src('googly.ico')).convert('RGBA')
    ico.resize((180, 180), Image.LANCZOS).save(out('apple-touch-icon.png'), 'PNG', optimize=True)
    ico.resize((64, 64), Image.LANCZOS).save(out('favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])

    # share card: the logo and two rocks on the paper
    card = Image.open(src('public', 'feuilletest-1500w.png')).convert('RGB')
    card = card.crop((0, 300, 1260, 300 + round(1260 * 630 / 1200))).resize((1200, 630), Image.LANCZOS)
    logo = Image.open(src('public', 'logogoogly-200h.png')).convert('RGBA')
    logo = logo.resize((560, 280), Image.LANCZOS)
    card.paste(logo, (60, 175), logo)
    for n, x, rot in ((26, 660, -6), (10, 880, 5)):
        rock = Image.open(src('images', 'coolrock%d.png' % n)).convert('RGB').resize((300, 300), Image.LANCZOS)
        rock = rock.rotate(rot, expand=True, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
        card.paste(rock, (x, 165 if rot < 0 else 215))
    os.makedirs(os.path.join(ROOT, 'images', 'og'), exist_ok=True)
    card.save(os.path.join(ROOT, 'images', 'og', 'googly-rocks-site.jpg'), 'JPEG', quality=84, optimize=True)

    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print('googly/ total: %d KB' % (total // 1024))


if __name__ == '__main__':
    main()
