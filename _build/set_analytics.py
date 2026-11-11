# -*- coding: utf-8 -*-
"""Moves the whole site from Umami to Cloudflare Web Analytics.

    python _build/set_analytics.py <TOKEN>

The token is the "token" value in the snippet Cloudflare shows when you add the site under
Analytics & Logs > Web Analytics (it is public: it ends up in every page). The script
  1. stores it in _build/analytics.py,
  2. swaps the counter in the hand-written pages (Reliquary, shop, Connecting, Jardin) and adds it where none existed,
  3. rebuilds the generated pages (portfolio, Googly Rocks).
Run it again with another token to change it.
"""
import io
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

if len(sys.argv) != 2 or not re.fullmatch(r'[0-9a-fA-F]{20,64}', sys.argv[1]):
    sys.exit('Usage: python _build/set_analytics.py <TOKEN>   (a hexadecimal token of 32 characters)')
token = sys.argv[1]


def read(path):
    return io.open(path, encoding='utf-8', newline='').read()


def write(path, text):
    io.open(path, 'w', encoding='utf-8', newline='').write(text)


# 1. the token
path = os.path.join(HERE, 'analytics.py')
text = read(path)
text, n = re.subn(r"^CF_TOKEN = '.*'$", "CF_TOKEN = '%s'" % token, text, flags=re.M)
assert n == 1
write(path, text)
import analytics  # noqa: E402
tag = analytics.tag()

# 2. the hand-written pages
existing = re.compile(r'<script[^>]*src="https://(?:cloud\.umami\.is/script\.js|static\.cloudflareinsights\.com/beacon\.min\.js)"[^>]*></script>')
for name in ('reliquary.html', 'shop.html', 'Connecting.html', 'Jardin-Algorithmique.html'):
    p = os.path.join(ROOT, name)
    if not os.path.exists(p):
        continue
    html = read(p)
    if existing.search(html):
        html = existing.sub(lambda m: tag, html, count=1)
    else:
        nl = '\r\n' if '\r\n' in html else '\n'
        html = html.replace('</head>', tag + nl + '</head>', 1)
    write(p, html)
    print('counter set in', name)

# 3. the generated pages
for script in ('build_site.py', 'build_googly.py'):
    subprocess.check_call([sys.executable, os.path.join(HERE, script)], stdout=subprocess.DEVNULL)
print('done: every page now uses Cloudflare Web Analytics only')
