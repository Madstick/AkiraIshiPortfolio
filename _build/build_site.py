# -*- coding: utf-8 -*-
"""Builds the portfolio pages: index.html, work.html, about.html and work/<slug>.html.

Words live in content.py. Run from the repository root:
    python _build/build_site.py
Needs only the Python standard library.
"""
import datetime
import html
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(__file__))
import content as C  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BY_SLUG = {w['slug']: w for w in C.WORKS + C.OTHER}
CHAPTER = {c['key']: c for c in C.CHAPTERS}
CHAPTER['X'] = C.OTHER_CHAPTER
MONTHS = {
    'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'fr': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
}


def date_pair(d):
    """(2024, 4) -> ('April 2024', 'avril 2024'); the month may be unknown."""
    year, month = d
    if month is None:
        return (str(year), str(year))
    return ('%s %d' % (MONTHS['en'][month - 1], year), '%s %d' % (MONTHS['fr'][month - 1], year))


def date_iso(d):
    return '%04d' % d[0] if d[1] is None else '%04d-%02d' % d


def url_path(path):
    """A file path as it goes in a URL (some picture names have spaces)."""
    return urllib.parse.quote(path)
FONTS = ('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@300;400;500'
         '&display=swap')


def jsonld(obj):
    """Structured data for search engines and link previews."""
    return '<script type="application/ld+json">%s</script>\n' % json.dumps(obj, ensure_ascii=False)


PERSON = {
    '@type': 'Person', 'name': C.NAME, 'url': C.SITE + '/', 'sameAs': [C.X_URL],
    'jobTitle': 'Generative artist',
    'description': 'Anonymous generative artist based in France, working mostly with Bitcoin Ordinals.',
}


def esc(s):
    return html.escape(s, quote=True)


def bi(pair):
    """A text in both languages; the page shows the one that matches <html lang>."""
    return '<span data-l="en">%s</span><span data-l="fr">%s</span>' % (esc(pair[0]), esc(pair[1]))


def chain_html(code):
    """The chain a work lives on, small and quiet, right after its name: (BTC)"""
    return ' <span class="chain">(%s)</span>' % code if code else ''


def item(slug):
    """Any work, with the line that describes it (its facet, or its medium when it has none)."""
    w = BY_SLUG[slug]
    return dict(title=w['title'], chain=C.CHAIN.get(slug), line=w['facet'] or w['tech'], status=w['status'],
                url=work_url(w), external=False, work=w)


def work_url(w):
    return '/work/%s.html' % w['slug']


def number(w):
    return '%02d' % C.WORKS.index(w)


def chapter_title(c):
    """'Chapter I - Realisation' as a pair."""
    if c['name'] is None:
        return c['label']
    return (c['label'][0] + ' — ' + c['name'][0], c['label'][1] + ' — ' + c['name'][1])


def chapter_anchor(c):
    if c['key'] == 'X':
        return 'other'
    return 'prologue' if c['key'] == '0' else 'chapter-' + c['key'].lower()


def short(text, n=155):
    if len(text) <= n:
        return text
    cut = text[:n].rsplit(' ', 1)[0]
    return cut.rstrip('.,;:') + '…'


# ------------------------------------------------------------------ media
def media_tag(w, cls='', lazy=True, sizes_attr=True):
    """The artwork itself: video for the Ossuary, otherwise an image (gif / animated webp stay animated)."""
    m = w['media']
    kind, path, width, height = m
    alt_en, alt_fr = w['alt']
    if kind == 'video':
        return ('<video src="/%s" poster="/%s" width="%d" height="%d" autoplay muted loop playsinline preload="metadata" '
                'aria-label="%s" data-alt-fr="%s" data-still="/%s" class="%s"></video>'
                % (url_path(path), url_path(w['still']), width, height, esc(alt_en), esc(alt_fr), url_path(w['still']), cls))
    animated = path.endswith('.gif') or w['still'] != path
    still = ' data-still="/%s"' % url_path(w['still']) if animated else ''
    return ('<img src="/%s" width="%d" height="%d" alt="%s" data-alt-fr="%s"%s %s class="%s">'
            % (url_path(path), width, height, esc(alt_en), esc(alt_fr), still, 'loading="lazy" decoding="async"' if lazy else 'fetchpriority="high"', cls))


def is_dark(w):
    return w['slug'] in ('the-ossuary', 'connecting')


# ------------------------------------------------------------------ page shell
def head(title, title_fr, desc, url, og_image, extra=''):
    return '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>(function(){var l='en';try{var s=localStorage.getItem('akira-lang');if(s==='fr'||s==='en'){l=s}else if(!s){var a=navigator.languages||[navigator.language||'en'];for(var i=0;i<a.length;i++){var c=String(a[i]).toLowerCase().slice(0,2);if(c==='fr'||c==='en'){l=c;break}}}}catch(e){}document.documentElement.lang=l})();</script>
<title>%(title)s</title>
<meta name="x-title-en" content="%(title)s">
<meta name="x-title-fr" content="%(title_fr)s">
<meta name="description" content="%(desc)s">
<meta name="author" content="Akira Ishi">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#ffffff">
<link rel="canonical" href="%(site)s%(url)s">
<link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
<link rel="icon" type="image/x-icon" href="/images/favicon-ai.ico" sizes="any">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Akira Ishi">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(site)s%(url)s">
<meta property="og:image" content="%(site)s%(og)s">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="%(handle)s">
<meta name="twitter:creator" content="%(handle)s">
<meta name="twitter:title" content="%(title)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="twitter:image" content="%(site)s%(og)s">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="%(fonts)s">
<link rel="stylesheet" href="/site.css">
%(extra)s<script defer src="https://cloud.umami.is/script.js" data-website-id="ac694020-0336-46f7-8d6a-ae7a41a5fb30"></script>
</head>
''' % dict(title=esc(title), title_fr=esc(title_fr), desc=esc(desc), site=C.SITE, url=url, og=og_image,
           handle=C.X_HANDLE, fonts=FONTS, extra=extra)


NAV = [
    ('/work.html', ('Work', 'Œuvres'), 'work'),
    ('/about.html', ('About', 'À propos'), 'about'),
    ('/shop.html', ('Prints', 'Tirages'), 'prints'),
    ('/' + C.RELIQUARY_ENTRY, ('Reliquary', 'Reliquaire'), 'reliquary'),
]


def header(current=None):
    links = ''.join('<a href="%s"%s>%s</a>' % (u, ' aria-current="page"' if k == current else '', bi(t)) for u, t, k in NAV)
    return '''<a class="skip" href="#main">%s</a>
<header class="top">
  <a class="brand" href="/">%s</a>
  <nav class="nav" aria-label="Main">
    %s
    <span class="lang" role="group" aria-label="Language"><button type="button" data-set-lang="en" aria-pressed="true">EN</button><span aria-hidden="true">/</span><button type="button" data-set-lang="fr" aria-pressed="false">FR</button></span>
  </nav>
</header>
''' % (bi(('Skip to content', 'Aller au contenu')), C.NAME, links)


def footer():
    return '''<footer class="footer">
  <span>&copy; 2026 %s</span>
  <nav aria-label="Footer">
    <a href="%s" target="_blank" rel="noopener">X %s</a>
    <a href="mailto:%s">%s</a>
    <a href="/legal-en.html" data-l="en">Legal</a><a href="/legal.html" data-l="fr">Mentions légales</a>
  </nav>
</footer>
<script src="/site.js" defer></script>
</body>
</html>
''' % (C.NAME, C.X_URL, C.X_HANDLE, C.EMAIL, C.EMAIL)


def status_tag(w):
    return '<span class="tag">%s</span>' % bi(w['status']) if w['status'] else ''


def key_mark():
    return ('<span class="key" aria-label="A secret is hidden here" title="A secret is hidden in this work" '
            'data-title-fr="Un secret est caché dans cette œuvre">&#9919;</span>')


def write(relpath, text):
    path = os.path.join(ROOT, *relpath.split('/'))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(text)
    print('wrote', relpath)


# ------------------------------------------------------------------ home
def build_home():
    latest_html = ''
    for slug in C.LATEST:
        it = item(slug)
        latest_html += '<a href="%s"%s><div><b>%s%s</b><span class="f">%s</span></div>%s</a>' % (
            it['url'], ' target="_blank" rel="noopener"' if it['external'] else '', esc(it['title']), chain_html(it['chain']),
            bi(it['line']), '<span class="tag">%s</span>' % bi(it['status']) if it['status'] else '')
    chapters = [c for c in C.CHAPTERS if c['key'] != '0']
    index_html = ''.join(
        '<a href="/work.html#%s"><span class="mono">%s</span><span>%s</span><span class="mono">%s</span></a>' % (
            chapter_anchor(c), c['key'], bi(c['name']),
            bi(('%d works' % len([w for w in C.WORKS if w['chapter'] == c['key']]),
                '%d œuvres' % len([w for w in C.WORKS if w['chapter'] == c['key']]))))
        for c in chapters)

    def cell(slug, cls='', tag=None, lazy=True):
        w = BY_SLUG[slug]
        t = '<span class="tag">%s</span>' % bi(tag) if tag else ''
        inner = media_tag(w, lazy=lazy)
        return '<a class="cell %s" href="%s" aria-label="%s">%s%s</a>' % (cls, work_url(w), esc(w['title']), inner, t)

    # Three columns of squares. The two 16:9 works take two squares side by side (2:1), so they are
    # shown at almost their own ratio instead of floating small inside a square.
    sheet = ''.join([
        cell('the-ossuary', 'big', ('Latest', 'Dernière'), lazy=False),
        cell('beaties', '', ('Upcoming', 'À venir')),
        '<a class="cell cover dark" href="/shop.html" aria-label="Still Life Code">'
        '<img src="/images/atelier/slc-hero.webp" width="900" height="1125" alt="Still Life Code: a still life with sunflowers and oranges" '
        'data-alt-fr="Still Life Code : une nature morte aux tournesols et aux oranges" loading="lazy" decoding="async">'
        '<span class="tag">%s</span></a>' % bi(('Prints', 'Tirages')),
        cell('jardin-algorithmique'), cell('four-seasons'), cell('technosignatures'),
        cell('connecting', 'wide dark'),
        '<a class="cell soon" href="/work/genesis.html"><span>%s</span></a>' % bi(('Genesis, in progress', 'Genesis, en cours')),
        cell('navigating-the-trenches', 'wide dark'),
        cell('knights-of-the-round-table', '', ('Prologue', 'Prologue')),
    ])
    desc = ('Akira Ishi writes code to map what it is to be human - one work, multiple facets, all linked by a hidden story.')
    out = head('Akira Ishi | Generative artist', 'Akira Ishi | Artiste génératif', desc, '/', '/images/og/home.jpg',
               extra='<link rel="preload" as="image" href="/images/projects/ossuary.webp" fetchpriority="high">\n' +
               jsonld({'@context': 'https://schema.org', '@graph': [
                   {'@type': 'WebSite', 'name': C.NAME, 'url': C.SITE + '/', 'inLanguage': ['en', 'fr'], 'description': desc},
                   PERSON]}))
    out += '<body>\n' + header(None) + '''<main id="main">
<div class="home">
  <div class="home-l">
    <div>
      <h1 class="home-name">%s</h1>
      <p class="home-one">%s</p>
      <p class="home-based">%s</p>
      <div class="latest"><h2>%s</h2>%s</div>
    </div>
    <div class="index"><h2>%s</h2>%s</div>
  </div>
  <div class="sheet">%s</div>
</div>
</main>
''' % (C.NAME, bi(C.ONELINER), bi(C.BASED), bi(('Latest', 'Dernières œuvres')), latest_html,
       bi(('The work, in three chapters', "L'œuvre, en trois chapitres")), index_html, sheet)
    out += footer()
    write('index.html', out)


# ------------------------------------------------------------------ work page
def row_html(w):
    dark = ' dk' if is_dark(w) else ''
    thumb = media_tag(w) if w['media'] else ''
    return ('<a class="row" href="%s"><div class="no">%s</div><div class="th%s">%s</div>'
            '<div class="ti"><span class="t">%s</span>%s%s%s</div><div class="fa">%s</div><div class="te">%s</div></a>') % (
        work_url(w), number(w), dark, thumb, esc(w['title']), chain_html(C.CHAIN.get(w['slug'])), key_mark(), status_tag(w),
        bi(w['facet']), bi(w['tech']))


def more_row():
    """A placeholder line: this chapter is not finished."""
    return ('<div class="row more"><div class="no"></div><div class="th"></div>'
            '<div class="ti"><span class="t">%s</span></div><div class="fa"></div><div class="te"></div></div>') % bi(C.MORE_TO_COME)


def build_work():
    parts = []
    for c in C.CHAPTERS:
        cls = ' prologue' if c['key'] == '0' else ''
        label = c['label']
        parts.append('<div class="chh%s" id="%s"><div class="label">%s</div><div>%s<p>%s</p></div></div>' % (
            cls, chapter_anchor(c), bi(label), '<h2>%s</h2>' % bi(c['name']) if c['name'] else '', bi(c['line'])))
        parts.extend(row_html(w) for w in C.WORKS if w['chapter'] == c['key'])
        if c['key'] in ('II', 'III'):
            parts.append(more_row())

    def lat(slug):
        it = item(slug)
        w = it['work']
        tag = '<span class="tag">%s</span>' % bi(it['status']) if it['status'] else ''
        dark = ' dk' if is_dark(w) else ''
        return ('<a href="%s"><div class="ph%s">%s%s</div><h3>%s%s</h3><div class="f">%s</div><div class="te">%s</div></a>') % (
            it['url'], dark, media_tag(w, lazy=False), tag, esc(w['title']), chain_html(it['chain']),
            bi(w['facet']) if w['facet'] else '', bi(w['tech']))

    lat_tiles = ''.join(lat(slug) for slug in C.LATEST_TILES)

    other = ''.join(
        '<a href="%s"><div class="mini">%s</div><div><div class="b">%s%s%s</div></div><div class="s">%s%s</div></a>' % (
            work_url(o), media_tag(o), esc(o['title']), chain_html(C.CHAIN.get(o['slug'])),
            (' <span class="tag mute">%s</span>' % bi(o['status'])) if o['status'] else '',
            ('<span class="mono yr">%s</span> ' % bi(date_pair(o['date']))) if o['date'] else '', bi(o['tech'])) for o in C.OTHER)
    collabs = ''.join(
        ('<a href="%s" target="_blank" rel="noopener"><div class="b">%s</div><div class="s">%s</div></a>' % (c['url'], esc(c['title']), bi(c['line'])))
        if c['url'] else ('<div><div class="b">%s</div><div class="s">%s</div></div>' % (esc(c['title']), bi(c['line'])))
        for c in C.COLLABS)
    press = ''.join(
        '<a href="%s" target="_blank" rel="noopener"><div class="b">%s</div><div class="s">%s</div></a>' % (p['url'], bi(p['title']), bi(p['line']))
        for p in C.PRESS)

    desc = short(C.STATEMENT_SHORT[0])
    out = head('Akira Ishi | Work', 'Akira Ishi | Œuvres', desc, '/work.html', '/images/og/work.jpg')
    out += '<body>\n' + header('work') + '''<main id="main">
<section class="intro"><div class="label">%s</div><p>%s</p></section>
<section class="lat"><div class="label">%s</div>
  <div class="lat-grid">%s</div>
</section>
%s
<section class="sec" id="series"><div class="label">%s</div>
  <div class="series"><a href="/shop.html" class="cell cover dark" style="aspect-ratio:4/5"><img src="/images/atelier/slc-hero.webp" width="900" height="1125" alt="Still Life Code: a still life with sunflowers and oranges" data-alt-fr="Still Life Code : une nature morte aux tournesols et aux oranges" loading="lazy" decoding="async"></a>
  <div><h2 style="font:500 26px/1.2 'IBM Plex Sans',sans-serif;letter-spacing:-.015em;margin-bottom:14px">Still Life Code</h2><p>%s</p><a class="more plain-link" href="/shop.html">%s</a></div></div>
</section>
<section class="sec" id="other"><div class="label">%s</div><div class="plain-list">%s</div></section>
<section class="sec" id="collaborations"><div class="label">%s</div><div class="plain-list noimg">%s</div></section>
<section class="sec" id="press"><div class="label">%s</div><div class="plain-list noimg">%s</div></section>
</main>
''' % (bi(('Work', 'Œuvres')), bi(C.STATEMENT_SHORT), bi(('Latest', 'Dernières œuvres')), lat_tiles,
       '\n'.join(parts), bi(('Series', 'Série')), bi(C.SERIES_NOTE),
       bi(('See the series →', 'Voir la série →')), bi(('Other works', 'Autres œuvres')), other,
       bi(('Collaborations', 'Collaborations')), collabs, bi(('Writing & press', 'Écrits & presse')), press)
    out += footer()
    write('work.html', out)


# ------------------------------------------------------------------ a work
def hero_frame(w):
    """The picture in a frame of its own proportions, never a wide banner around a small image."""
    if not w['media']:
        return ('<div class="hero-frame" style="--w:820px;--r:1.6"><span class="mono" style="color:#888">%s</span></div>'
                % bi(('In progress', 'En cours')))
    _, _, width, height = w['media']
    ratio = width / float(height)
    shown = 800 if ratio > 1.3 else (560 if ratio < 0.9 else 820)   # px: wide, tall, near-square
    return '<div class="hero-frame%s" style="--w:%dpx;--r:%.4f">%s</div>' % (
        ' dk' if is_dark(w) else '', shown, ratio, media_tag(w, lazy=False))


def build_piece(group, i, w):
    c = CHAPTER[w['chapter']]
    ct = chapter_title(c)
    frame = hero_frame(w)

    facts = ['<div><dt>%s</dt><dd>%s</dd></div>' % (bi(('Chapter', 'Chapitre')), bi(ct))]
    if w['date']:
        facts.append('<div><dt>%s</dt><dd>%s</dd></div>' % (bi(('Released', 'Sortie')), bi(date_pair(w['date']))))
    facts.append('<div><dt>%s</dt><dd>%s</dd></div>' % (bi(('Medium', 'Médium')), bi(w['tech'])))
    if w['inscription']:
        iid, iurl = w['inscription']
        shown = iid if len(iid) <= 20 else iid[:6] + '…' + iid[-5:]
        facts.append('<div><dt>%s</dt><dd><a class="plain-link" href="%s" target="_blank" rel="noopener">#%s</a></dd></div>' % (
            bi(('Inscription', 'Inscription')), iurl, esc(shown)))
    if w['status']:
        facts.append('<div><dt>%s</dt><dd>%s</dd></div>' % (bi(('Status', 'Statut')), bi(w['status'])))

    logic = '<p class="logic">%s</p>' % bi(w['logic']) if w['logic'] else ''
    desc = ''.join('<p>%s</p>' % bi(p) for p in w['desc'])
    kinds = {'live': ('Live', 'En direct'), 'marketplace': ('Marketplace', 'Marketplace'),
             'inscription': ('Inscription', 'Inscription'), 'article': ('Article', 'Article')}
    links = ''.join('<a href="%s"%s><span>%s</span><span class="k">%s</span></a>' % (
        url, '' if url.startswith('https://akiraishi.com') else ' target="_blank" rel="noopener"', bi(lab), bi(kinds[kind]))
        for kind, lab, url in w['links'])
    extras = ''.join(
        '<figure><img src="/%s" width="%d" height="%d" alt="%s" data-alt-fr="%s" loading="lazy" decoding="async"><figcaption>%s</figcaption></figure>' % (
            url_path(p), wd, ht, esc(cap[0]), esc(cap[1]), bi(cap)) for p, wd, ht, cap in w['extras'])

    prev_w = group[i - 1] if i > 0 else None
    next_w = group[i + 1] if i < len(group) - 1 else None
    pn = '<nav class="pn" aria-label="%s">%s%s</nav>' % (
        'Works',
        ('<a href="%s"><div class="label">%s</div><b>%s</b></a>' % (work_url(prev_w), bi(('Previous', 'Précédente')), esc(prev_w['title']))) if prev_w else '<span></span>',
        ('<a href="%s"><div class="label">%s</div><b>%s</b></a>' % (work_url(next_w), bi(('Next', 'Suivante')), esc(next_w['title']))) if next_w else '<span></span>')

    title_en = '%s | Akira Ishi' % w['title']
    desc_meta = short(w['desc'][0][0])
    og = '/images/og/%s.jpg' % w['slug'] if w['still'] else '/images/og/work.jpg'
    artwork = {'@context': 'https://schema.org', '@type': 'VisualArtwork', 'name': w['title'],
               'url': C.SITE + work_url(w), 'image': C.SITE + og, 'description': w['desc'][0][0],
               'artform': 'Generative art', 'artMedium': w['tech'][0], 'creator': PERSON}
    if w['date']:
        artwork['dateCreated'] = date_iso(w['date'])
    out = head(title_en, title_en, desc_meta, work_url(w), og, extra=jsonld(artwork))
    out += '<body>\n' + header('work') + '''<main id="main">
<div class="crumb"><a href="/work.html">%s</a> / <a href="/work.html#%s">%s</a></div>
<section class="hero">%s</section>
<section class="sheet-meta">
  <div>
    <h1>%s%s%s%s</h1>
    %s
    <dl class="facts">%s</dl>
  </div>
  <div>
    %s
    <div class="desc">%s</div>
    <div class="links">%s</div>
  </div>
</section>
%s%s
</main>
''' % (bi(('Work', 'Œuvres')), chapter_anchor(c), bi(ct), frame, esc(w['title']), chain_html(C.CHAIN.get(w['slug'])), key_mark(),
       ('<span class="tag status">%s</span>' % bi(w['status'])) if w['status'] else '',
       ('<p class="facet">%s</p>' % bi(w['facet'])) if w['facet'] else '', ''.join(facts), logic, desc,
       links, '<section class="extras">%s</section>' % extras if extras else '', pn)
    out += footer()
    write('work/%s.html' % w['slug'], out)


# ------------------------------------------------------------------ about
def cv_line(year, name, sub=None, url=None):
    n = esc(name) if isinstance(name, str) else bi(name)
    if url:
        extra = '' if url.startswith('/') or url.startswith('https://akiraishi.com') else ' target="_blank" rel="noopener"'
        n = '<a class="plain-link" href="%s"%s>%s</a>' % (url, extra, n)
    s = '<small>%s</small>' % (esc(sub) if isinstance(sub, str) else bi(sub)) if sub else ''
    y = bi(year) if isinstance(year, tuple) else (year or '')
    return '<div class="line"><div class="y">%s</div><div class="n">%s%s</div></div>' % (y, n, s)


# newest first; the ones without a known date come last
CV_ORDER = ['the-ossuary', 'jardin-algorithmique', 'connecting', 'beaties', 'navigating-the-trenches', 'technosignatures',
            'four-seasons', 'googly-rocks', 'songe-d-un-soir', 'aodach', 'tezos-curated-works', 'whats-the-point',
            'comics-extracts', 'art-on-solana', 'knights-of-the-round-table']


def build_about():
    long_html = ''.join('<p>%s</p>' % bi(p) for p in C.STATEMENT_LONG)
    cv = '<h3>%s</h3>' % bi(('Selected works', 'Œuvres choisies'))
    for slug in CV_ORDER:
        w = BY_SLUG[slug]
        sub_line = w['tech']
        if w['status'] and w['status'][0] in ('Upcoming', 'Suspended'):
            sub_line = (sub_line[0] + ' · ' + w['status'][0].lower(), sub_line[1] + ' · ' + w['status'][1].lower())
        cv += cv_line(date_pair(w['date']) if w['date'] else '', w['title'], sub_line, work_url(w))
    cv += '<h3>%s</h3>' % bi(('Collaborations', 'Collaborations'))
    cv += ''.join(cv_line('', c['title'], c['line'], c['url']) for c in C.COLLABS)
    cv += '<h3>%s</h3>' % bi(('Press & writing', 'Presse & écrits'))
    cv += ''.join(cv_line('', p['title'], p['line'], p['url']) for p in C.PRESS)
    cv += '<h3>%s</h3>' % bi(('Side projects', 'Projets annexes'))
    cv += ''.join(cv_line('', sp['title'], sp['line'], sp['url']) for sp in C.SIDE)

    desc = short(C.BIO[0], 160)
    out = head('About | Akira Ishi', 'À propos | Akira Ishi', desc, '/about.html', '/images/og/about.jpg',
               extra=jsonld({'@context': 'https://schema.org', '@type': 'AboutPage', 'name': 'About Akira Ishi',
                             'url': C.SITE + '/about.html', 'mainEntity': PERSON}))
    out += '<body>\n' + header('about') + '''<main id="main">
<section class="about-head"><h1>%s</h1><p>%s</p></section>
<section class="about-sec" id="statement"><div class="label">%s</div><div class="body">%s</div></section>
<section class="about-sec" id="bio"><div class="label">%s</div><div class="body"><p>%s</p></div></section>
<section class="about-sec" id="cv"><div class="label">CV</div><div class="cv">%s</div></section>
<section class="about-sec contact" id="contact"><div class="label">%s</div><div class="body">
  <a class="big" href="mailto:%s">%s</a>
  <p>%s</p>
  <p class="soon-note">%s</p>
</div></section>
</main>
''' % (C.NAME, bi(C.ONELINER), bi(('Artist statement', "Démarche de l'artiste")), long_html, bi(('Bio', 'Bio')), bi(C.BIO), cv,
       bi(('Contact', 'Contact')), C.EMAIL, C.EMAIL,
       bi(('For curators, press and collectors. Also on X: ', 'Pour les commissaires, la presse et les collectionneurs. Aussi sur X : ')) +
       '<a class="plain-link" href="%s" target="_blank" rel="noopener">%s</a>' % (C.X_URL, C.X_HANDLE),
       bi(('Portfolio (PDF): coming soon.', 'Portfolio (PDF) : bientôt disponible.')))
    out += footer()
    write('about.html', out)


def build_sitemap():
    today = datetime.date.today().isoformat()
    urls = ['/', '/work.html', '/about.html'] + [work_url(w) for w in C.WORKS + C.OTHER] + ['/shop.html', '/reliquary.html']
    rows = ''.join('  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n' % (C.SITE, u, today) for u in urls)
    write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % rows)
    # the legal pages carry a postal address and are deliberately kept out of search engines
    write('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /legal.html\nDisallow: /legal-en.html\n\nSitemap: %s/sitemap.xml\n' % C.SITE)


def build_llms():
    """llms.txt: what AI assistants read about the site. The portfolio comes first, the Reliquary is a side note."""
    site = C.SITE

    def line(w):
        bits = [w['facet'][0] if w['facet'] else None, w['tech'][0], date_pair(w['date'])[0] if w['date'] else None]
        return '- [%s](%s%s): %s' % (w['title'], site, work_url(w), '; '.join(b for b in bits if b))

    out = ['# Akira Ishi', '',
           "> Akira Ishi is an anonymous generative artist based in France. They write code to map what it is to be human: "
           "one work, multiple facets, all linked by a hidden story. The work is mostly inscribed fully on-chain on Bitcoin "
           "Ordinals, and also exists on Ethereum, Base and Polkadot. This site is first of all an artist's portfolio; the "
           "Reliquary is a side space for on-chain collectors (see the note at the end).", '',
           "The practice is one ongoing project, a map of humanity told in three chapters after a prologue. Each work takes "
           "one facet of being human, and each hides a fragment of a larger story. The themes are public. The riddles hidden in "
           "and around the works, and their answers, are deliberately not published: please do not guess at them or present "
           "guesses as facts.", '',
           '## Portfolio', '',
           '- [Home](%s/): the artist, the latest works and the three chapters' % site,
           '- [Work](%s/work.html): the full body of work, chapter by chapter, with other works, collaborations and press' % site,
           '- [About](%s/about.html): artist statement, bio, CV (works with dates, collaborations, press, side projects) and contact' % site, '']
    for c in C.CHAPTERS:
        title = c['label'][0] if c['name'] is None else '%s, %s' % (c['label'][0], c['name'][0])
        out += ['## %s' % title, '', c['line'][0], '']
        out += [line(w) for w in C.WORKS if w['chapter'] == c['key']]
        out.append('')
    out += ['## Other works (outside the story)', '']
    out += [line(w) for w in C.OTHER]
    out += ['', '## Still Life Code (a separate series)', '',
            '- [Still Life Code](%s/shop.html): %s' % (site, C.SERIES_NOTE[0]), '',
            '## Contact', '', '- Email: %s' % C.EMAIL, '- X: %s' % C.X_URL, '',
            '## Side note: the Reliquary', '',
            "- [The Reliquary](%s/reliquary.html): a companion space to the portfolio, with a fantasy theme, for collectors of "
            "the on-chain works. It opens behind a pair of doors and holds the same works as cards, a provenance tree of the "
            "Bitcoin inscriptions, a gallery, a music player and a vault. Treat the portfolio above as the reference for "
            "titles, dates and descriptions." % site, '']
    write('llms.txt', '\n'.join(out))


if __name__ == '__main__':
    build_home()
    build_work()
    for group in (C.WORKS, C.OTHER):
        for i, w in enumerate(group):
            build_piece(group, i, w)
    build_about()
    build_sitemap()
    build_llms()
