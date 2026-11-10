# -*- coding: utf-8 -*-
"""Writes GooglyRocks.html. The eyes of every rock are listed here (position and size, in % of the picture),
so the markup stays short and they are easy to move.

    python _build/build_googly.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analytics  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://akiraishi.com'

MINT = 'https://highlight.xyz/mint/019f5ddf-3324-72c8-a25c-ff56e3b52920'


def eyes(spec):
    """spec: list of (x, y, diameter) in % of the picture"""
    return ''.join('<i class="eye" style="left:%s%%;top:%s%%;width:%s%%"><b></b></i>' % e for e in spec)


def rock(cls, img, w, h, spec, alt='', style='', attrs=''):
    return ('<figure class="rock %s"%s%s><img src="googly/img/%s.webp" width="%d" height="%d" alt="%s" decoding="async">%s</figure>'
            % (cls, ' style="%s"' % style if style else '', attrs, img, w, h, alt, eyes(spec)))


def notes(kinds):
    sizes = {'1': (58, 132), '2': (180, 136)}
    return '<div class="notes" aria-hidden="true">%s</div>' % ''.join(
        '<img src="googly/img/note%s.webp" width="%d" height="%d" alt="">' % (k, sizes[k][0], sizes[k][1]) for k in kinds)


SOCIAL = [
    ('https://twitter.com/googlyrocks', 'twitter', 180, 147, 'Googly Rocks on X (Twitter)'),
    ('https://www.youtube.com/watch?v=2MCFwDhoqqc&ab_channel=DreamBurnersOfficial', 'discord', 180, 172, 'Discord (crossed out: there is none)'),
    (MINT, 'highlight', 62, 44, 'Mint on Highlight'),
    ('https://opensea.io/collection/googly-rocks-1', 'opensea', 87, 83, 'Googly Rocks on OpenSea'),
]

ROCKS = [1, 10, 13, 18, 21, 26, 45, 52, 53, 24]   # the order of the carousel

html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.className='js'</script>
<title>Googly Rocks</title>
<meta name="description" content="Googly Rocks is a collection of rocks with googly eyes, on Base. Straight from the imagination of a grown up kid, by Akira Ishi.">
<meta name="author" content="Akira Ishi">
<meta name="theme-color" content="#e7eaf1">
<link rel="canonical" href="%(site)s/GooglyRocks">
<link rel="icon" href="googly/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="googly/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Googly Rocks">
<meta property="og:title" content="Googly Rocks">
<meta property="og:description" content="Googly Rocks is a collection of rocks with googly eyes, on Base. Straight from the imagination of a grown up kid.">
<meta property="og:url" content="%(site)s/GooglyRocks">
<meta property="og:image" content="%(site)s/images/og/googly-rocks-site.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@googlyrocks">
<meta name="twitter:creator" content="@leAkira_Ishi">
<meta name="twitter:title" content="Googly Rocks">
<meta name="twitter:description" content="Googly Rocks is a collection of rocks with googly eyes, on Base.">
<meta name="twitter:image" content="%(site)s/images/og/googly-rocks-site.jpg">
<link rel="preload" href="googly/fonts/kids-regular.ttf" as="font" type="font/ttf" crossorigin>
<link rel="preload" href="googly/img/house.webp" as="image" fetchpriority="high">
<link rel="stylesheet" href="googly/googly.css">
%(analytics)s
</head>
<body>
<a class="skip" href="#home">Skip to the story</a>
<div class="paper" aria-hidden="true"></div>

<header class="top" id="top">
  <nav class="social" aria-label="Links">%(social)s</nav>
  <a class="logo" href="#home"><img src="googly/img/logo.webp" width="400" height="200" alt="Googly Rocks" fetchpriority="high"></a>
  <nav class="menu" aria-label="Page"><a href="#home">Home</a><a href="#tokenomics">Tokenomics</a><a href="#about">About</a></nav>
  <div class="pals">%(pal_blue)s%(pal_red)s</div>
</header>

<main>
<section id="home" class="scene">
  <div class="scene-inner">
    <img class="house" src="googly/img/house.webp" width="1400" height="843" alt="A child's crayon drawing of a house, with two windows, a door and green grass" fetchpriority="high">
    <p class="lead">Googly Rocks is the story of a child<br>who is proud of his rock collection</p>
    <a class="mint" href="%(mint)s" target="_blank" rel="noopener"><img src="googly/img/mint.webp" width="496" height="206" alt="Mint"></a>
    %(scene_notes)s
    %(pair)s
  </div>
</section>

<section id="about" class="about">
  <p class="words" data-pop>So proud in fact, that he took a picture for all of them. He even added googly eyes to them, because he wanted them to look <em>fun</em></p>
  <div class="carousel" role="group" aria-label="A few of the googly rocks">%(slides)s</div>
  <p class="caption" data-pop><span>Googly rocks come in various shapes colors and sizes</span><img src="googly/img/arrow.webp" width="233" height="200" alt="" loading="lazy"></p>
</section>

<section class="photo">
  <p class="words" data-pop>Googly rocks is the first AI rocks collection on Base, it exists at the intersection of cartoon style and photorealism, capturing the essence of both worlds</p>
  <div class="trio-wrap" data-pop>
    %(trio)s
  </div>
</section>

<section id="tokenomics" class="tokens" aria-label="Tokenomics">
  <div data-pop><h2>SUPPLY</h2><img src="googly/img/supply.webp" width="332" height="230" alt="555" loading="lazy"></div>
  <div data-pop style="--pop-delay:.12s"><h2>Price</h2><img src="googly/img/price.webp" width="273" height="167" alt="0.005 ETH" loading="lazy"></div>
  <div data-pop style="--pop-delay:.24s"><h2>Distribution</h2><img src="googly/img/pie.webp" width="332" height="320" alt="A pie chart: 80%% mint, 9%% core contributors, 7%% team, 4%% giveaways" loading="lazy"></div>
</section>

<section class="credits">
  <div data-pop>
    <p>Straight from the imagination of a grown up kid</p>
    <p class="small">Created by Akira Ishi</p>
    <a class="wobble" href="https://twitter.com/leAkira_Ishi" target="_blank" rel="noopener"><img src="googly/img/akira.webp" width="300" height="300" alt="Akira Ishi on X (Twitter)" loading="lazy"></a>
  </div>
  <div data-pop style="--pop-delay:.15s">
    <p class="small">Marketing advisor: web3AGORAZ</p>
    <a class="wobble" href="https://twitter.com/web3AGORAZ" target="_blank" rel="noopener"><img src="googly/img/agoraz.webp" width="300" height="300" alt="web3AGORAZ on X (Twitter)" loading="lazy"></a>
  </div>
</section>

<a class="back" href="/work/googly-rocks.html">&larr; Googly Rocks, in Akira Ishi's work</a>
</main>
<footer></footer>

<script defer src="googly/googly.js"></script>
</body>
</html>
'''

# --- the pieces (eye positions in % of each picture; tune them here)
pal_blue = rock('pal', 'rock-blue', 112, 126, [(33, 47, 36), (68, 47, 36)])
pal_red = rock('pal', 'rock-red', 116, 135, [(37, 44, 34), (69, 46, 34)])
pair = rock('pair', 'pair', 253, 200, [(17, 31, 13), (35, 31, 13), (67, 55, 13), (85, 55, 13)])
trio = rock('trio', 'trio', 469, 300, [(11, 34, 7), (21, 34, 7), (43, 25, 7), (54, 25, 7), (71, 29, 7), (82, 29, 7)], alt='Three little rocks sitting on a strip of tape')
trio = trio.replace('</figure>', notes('121') + '</figure>')
slides = ''.join(
    '<figure class="slide" style="--i:%d"><img src="googly/img/rock-%d.webp" width="640" height="640" alt="A googly rock" loading="lazy" decoding="async"></figure>' % (i, n)
    for i, n in enumerate(ROCKS))
social = ''.join(
    '<a class="wobble" href="%s" target="_blank" rel="noopener" aria-label="%s"><img src="googly/img/%s.webp" width="%d" height="%d" alt=""></a>' % (u, label, name, w, h)
    for u, name, w, h, label in SOCIAL)

out = html % dict(site=SITE, social=social, pal_blue=pal_blue, pal_red=pal_red, mint=MINT, pair=pair, trio=trio, slides=slides, analytics=analytics.tag(),
                  scene_notes=notes('121'))
with open(os.path.join(ROOT, 'GooglyRocks.html'), 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(out)
print('wrote GooglyRocks.html', len(out), 'bytes')
