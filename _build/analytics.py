# -*- coding: utf-8 -*-
"""Which visit counter the pages carry.

Set CF_TOKEN (the Cloudflare Web Analytics token) with:   python _build/set_analytics.py <TOKEN>
While it is empty the pages keep the Umami counter they had; once it is set, every page uses Cloudflare only.
"""

CF_TOKEN = ''
UMAMI_ID = 'ac694020-0336-46f7-8d6a-ae7a41a5fb30'

CF_SRC = 'https://static.cloudflareinsights.com/beacon.min.js'
UMAMI_SRC = 'https://cloud.umami.is/script.js'


def tag():
    if CF_TOKEN:
        return '<script defer src="%s" data-cf-beacon=\'{"token": "%s"}\'></script>' % (CF_SRC, CF_TOKEN)
    return '<script defer src="%s" data-website-id="%s"></script>' % (UMAMI_SRC, UMAMI_ID)
