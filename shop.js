/* ============================================
   ONLINE SHOPS - small bits of behaviour
   ============================================ */

(function () {
    'use strict';

    /* Sticky header shadow */
    const header = document.getElementById('shop-header');
    if (header) {
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                header.classList.toggle('scrolled', window.scrollY > 8);
                ticking = false;
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* Mobile menu */
    const toggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('shop-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const open = nav.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(open));
            toggle.textContent = open ? '✕' : '☰';
        });

        nav.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && nav.classList.contains('open')) {
                nav.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.textContent = '☰';
            }
        });
    }

    /* Reveal on scroll */
    const revealables = document.querySelectorAll('.reveal');
    if (!revealables.length) return;

    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        revealables.forEach(el => el.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    revealables.forEach(el => observer.observe(el));
})();

/* ============================================
   THE ATELIER
   Still Life Code runs in its own page, dropped
   into an iframe the first time it is asked for.
   Same origin, so the panel can read the label it
   writes, drive its buttons and take its canvas.

   The studio paints at screen size. For an order, the same
   painting is painted again at the size the print needs at
   PRINT_DPI: bought on this site with the Worker's backend
   render on, after the payment, on GitHub (the visitor does
   not wait); otherwise here, out of sight, before ordering.
   The picture can be looked at in full screen, never saved.

   Ordering: with ORDER_API set, the painting is sent to the
   Cloudflare Worker (_worker/orders), which prices it from
   Gelato, takes the payment on this site (Stripe) and has
   Gelato print and ship it. Without it, the order controls
   stay hidden and the atelier only paints.
   ============================================ */

(function () {
    'use strict';

    // The Worker's address, e.g. 'https://still-life-code-orders.<you>.workers.dev'.
    // Empty hides the order controls.
    const ORDER_API = 'https://still-life-code-orders.leakiraishi.workers.dev';

    const GENERATOR = 'still-life-code.html';

    // The order button is closed for now: it reads "Coming soon" and cannot be pressed. Set to true to open it.
    // To try it out while it is closed (Stripe is in test mode, Gelato takes drafts), open the page with ?orders=test
    const ORDERS_OPEN = false;
    const ordersOpen = ORDERS_OPEN || new URLSearchParams(location.search).get('orders') === 'test';

    // The print file is painted at this resolution
    const PRINT_DPI = 300;
    // ...up to this long side, in millimetres, by what the device can hold while it paints (a 300 dpi A3 takes about
    // 3 GB and a few minutes on a computer): A3 on a computer, A4 on a small one, 10 x 15 cm on a phone.
    function printLongMm() {
        const mem = navigator.deviceMemory || 8;
        const phone = window.matchMedia && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 900;
        if (phone || mem <= 2) return 148;
        if (mem <= 4) return 297;
        return 420;
    }

    const $ = (id) => document.getElementById(id);
    const stage = $('atelier-stage');
    const poster = $('atelier-poster');
    const openBtn = $('atelier-open');
    if (!stage || !poster || !openBtn) return;

    const titleEl = $('atelier-title');
    const metaEl = $('atelier-meta');
    const refEl = $('atelier-ref');
    const newBtn = $('atelier-new');
    const fullBtn = $('atelier-full');
    const orderBtn = $('atelier-order');
    const buyBox = $('atelier-buy');
    const productField = $('atelier-product-field');
    const productSel = $('atelier-product');
    const soonEl = $('atelier-soon');
    const countrySel = $('atelier-country');
    const variantBox = $('atelier-variant-fields');
    const mockupBox = $('atelier-mockup-box');
    const mockup = $('atelier-mockup');
    const mockupCaption = $('atelier-mockup-caption');
    const priceEl = $('atelier-price');
    const captchaEl = $('atelier-captcha');
    const statusEl = $('atelier-status');
    const fineprint = $('atelier-fineprint');

    const i18n = () => window.AkiraI18n;
    const t = (key, fallback) => (i18n() ? i18n().t(key, fallback) : fallback);
    const lang = () => (i18n() && i18n().lang) || 'en';

    let frame = null;
    let reference = '';
    let config = null;       // the Worker's answer, once ordering is live
    let busy = false;
    let captchaToken = '';
    let captchaWidget = null;
    let lastStatus = null;
    let direct = null;       // what the painting can be printed on: { key, data, prices, picks }
    let chosen = '';         // the id of the product the visitor's choices come to
    let printJob = null;     // the print file being painted: { key, frame, blob, progress }

    /* ---- the frame ---- */

    function frameDoc() {
        try {
            return frame && frame.contentDocument;
        } catch (e) {
            return null;
        }
    }

    function finished() {
        const doc = frameDoc();
        const status = doc && doc.getElementById('status');
        return Boolean(status && /^finished/i.test(status.textContent.trim()));
    }

    function canvasOf() {
        const doc = frameDoc();
        return doc && doc.getElementById('c');
    }

    // The print file's size in pixels: the painting's own proportions, its long side at PRINT_DPI
    function printSize() {
        const c = canvasOf();
        if (!c || !c.width) return null;
        const long = Math.round(printLongMm() / 25.4 * PRINT_DPI);
        const short = Math.round(long * Math.min(c.width, c.height) / Math.max(c.width, c.height));
        return c.width >= c.height ? { w: long, h: short, long: long } : { w: short, h: long, long: long };
    }

    function refresh() {
        const doc = frameDoc();
        if (!doc) return;

        const title = (doc.getElementById('title').textContent || '').trim();
        const meta = (doc.getElementById('meta').textContent || '').trim();
        const query = frame.contentWindow.location.search || '';
        const seed = new URLSearchParams(query).get('seed');

        if (title) titleEl.textContent = title;
        if (meta) metaEl.textContent = meta;

        // The link is the painting: it repaints it stroke for stroke.
        reference = seed
            ? location.origin + location.pathname.replace(/[^/]*$/, '') + GENERATOR + query
            : '';
        refEl.textContent = reference || '\u2014';
        if (reference) refEl.setAttribute('href', reference);
        else refEl.removeAttribute('href');

        newBtn.disabled = fullBtn.disabled = !seed;
        // another painting: the print file of the last one is no use any more
        if (printJob && printJob.key !== printKey()) cancelPrint();
        if (config) refreshChoice();
    }

    // The studio rewrites its status line many times a second while it paints.
    // A timer rather than a frame, so the panel still catches up in a hidden tab.
    let queued = 0;
    function refreshSoon() {
        if (queued) return;
        queued = setTimeout(() => { queued = 0; refresh(); }, 200);
    }

    /* ---- opening it ---- */

    function open() {
        if (frame) return;

        frame = document.createElement('iframe');
        frame.src = GENERATOR;
        frame.title = t('shop.atelier-frame-title', 'Still Life Code, a generative still-life painter');
        frame.setAttribute('allow', 'fullscreen');
        frame.addEventListener('load', () => {
            const doc = frameDoc();
            if (!doc) return;
            // The studio rewrites its label as it paints; follow that instead of polling.
            const label = doc.getElementById('label');
            if (label && 'MutationObserver' in window) {
                new MutationObserver(refreshSoon).observe(label, {
                    childList: true, subtree: true, characterData: true
                });
            }
            refresh();
        });

        poster.remove();
        stage.appendChild(frame);
        // While the studio paints, the section must keep rendering
        const section = stage.closest('section');
        if (section) section.classList.add('atelier-live');
        metaEl.textContent = t('shop.the-first-painting-is-on-its', 'The first painting is on its way — give it half a minute.');
    }

    openBtn.addEventListener('click', open);

    /* ---- driving it from the panel ---- */

    function press(id) {
        const doc = frameDoc();
        const button = doc && doc.getElementById(id);
        if (button) button.click();
    }

    newBtn.addEventListener('click', () => press('st-new'));

    /* ---- full screen ---- */

    // The frame itself goes full screen where the browser can do it; elsewhere (an iPhone) it is laid over the page.
    // The studio inside is told either way, and shows the painting alone.
    const post = (msg) => { if (frame) frame.contentWindow.postMessage(msg, location.origin); };
    const docFs = () => document.fullscreenElement || document.webkitFullscreenElement;
    function overlay(on) {
        stage.classList.toggle('atelier-full', on);
        document.documentElement.classList.toggle('atelier-noscroll', on);
    }
    fullBtn.addEventListener('click', () => {
        if (!frame) return;
        post({ slc: 'fullscreen-enter' });
        const req = stage.requestFullscreen || stage.webkitRequestFullscreen;
        if (!req) { overlay(true); return; }
        try {
            const p = req.call(stage);
            if (p && p.catch) p.catch(() => overlay(true));
        } catch (e) { overlay(true); }
    });
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
        document.addEventListener(ev, () => { if (!docFs()) post({ slc: 'fullscreen-exit' }); });
    }
    window.addEventListener('message', (e) => {
        if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
        const d = e.data || {};
        if (d.slc !== 'fullscreen') return;
        if (d.on) { if (!docFs()) overlay(true); return; }
        overlay(false);
        if (docFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    });
    // no menu to save the picture from, around it either
    stage.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---- status line under the order button ---- */

    function say(key, fallback, link) {
        lastStatus = key ? { key: key, fallback: fallback, link: link } : null;
        renderStatus();
    }

    function renderStatus() {
        statusEl.textContent = '';
        if (!lastStatus) return;
        statusEl.append(t(lastStatus.key, lastStatus.fallback));
        // while the print file is painted, the painter's own progress
        if (lastStatus.key === 'shop.status-printing' && printJob && printJob.progress) {
            statusEl.append(' (' + printJob.progress + ')');
        }
        if (lastStatus.link) {
            const a = document.createElement('a');
            a.href = lastStatus.link;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = ' →';
            statusEl.append(a);
        }
    }

    // Back from the payment page
    if (new URLSearchParams(location.search).get('order') === 'thanks') {
        say('shop.status-thanks', 'Thank you! Your payment went through and your print is being made. A confirmation email is on its way.');
    }

    /* ---- what can be bought ---- */

    const current = () => (config ? config.products.find((p) => p.id === productSel.value) : null);

    // An amount in its own currency, to the cent: these are prices, not round numbers
    function money(amount, currency) {
        const code = currency || config.currency;
        try {
            return new Intl.NumberFormat(lang(), { style: 'currency', currency: code }).format(amount);
        } catch (e) {
            return Number(amount).toFixed(2) + ' ' + code;
        }
    }

    function fill(select, items, keep) {
        select.textContent = '';
        items.forEach((item) => {
            const o = document.createElement('option');
            o.value = item.value;
            o.textContent = item.text;
            select.appendChild(o);
        });
        const still = items.some((i) => i.value === keep);
        if (items.length) select.value = still ? keep : items[0].value;
    }

    function fillProducts() {
        fill(productSel, config.products.map((p) => ({
            value: p.id,
            text: t('shop.product-' + p.id, p.label)
        })), productSel.value);
        // one thing to print on: nothing to choose
        productField.hidden = config.products.length < 2;
    }

    function fillCountries() {
        let names = null;
        try { names = new Intl.DisplayNames([lang()], { type: 'region' }); } catch (e) { /* plain codes then */ }
        const home = ((navigator.language || '').split('-')[1] || '').toUpperCase();
        const wanted = countrySel.value || (config.countries.indexOf(home) > -1 ? home : '');
        fill(countrySel, config.countries.map((c) => ({
            value: c,
            text: (names && names.of(c)) || c
        })), wanted);
    }

    function labelOrder() {
        orderBtn.textContent = ordersOpen
            ? t('shop.order-direct', 'Pay securely and order')
            : t('shop.coming-soon', 'Coming soon');
        orderBtn.disabled = !ordersOpen;
    }

    // The price as it is made: the painting (yours), the printing, the delivery, and the total
    function showPrice() {
        priceEl.textContent = '';
        const info = direct && chosen && direct.prices ? direct.prices[chosen] : null;
        if (!chosen) return;
        if (!info) {
            priceEl.textContent = t('shop.price-loading', 'Looking up the price\u2026');
            return;
        }

        const rows = document.createElement('dl');
        rows.className = 'price-rows';
        const add = (label, amount, cls) => {
            const row = document.createElement('div');
            row.className = 'price-row' + (cls ? ' ' + cls : '');
            const dt = document.createElement('dt');
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.textContent = money(amount, info.currency);
            row.appendChild(dt);
            row.appendChild(dd);
            rows.appendChild(row);
        };
        add(t('shop.price-artist', 'The painting (artist\u2019s price)'), info.artist);
        add(t('shop.price-printing', 'Printing and materials'), info.printing);
        add(t('shop.price-delivery', 'Delivery') +
            (info.shippingEstimated ? ' (' + t('shop.price-estimated', 'estimate') + ')' : ''), info.shipping);
        add(t('shop.price-total', 'Total'), info.total, 'total');
        priceEl.appendChild(rows);

        const note = document.createElement('p');
        note.className = 'price-note';
        note.textContent = t('shop.price-note',
            'Printing and delivery are Gelato\u2019s own prices for this product and this country, passed on without any addition. Local taxes, if any, are shown at payment.');
        priceEl.appendChild(note);

        // a big print from the A3 file: said, not hidden
        const dpi = chosenDpi();
        if (dpi && dpi < 200) {
            const big = document.createElement('p');
            big.className = 'price-note';
            big.textContent = t('shop.dpi-note',
                'Large format (about {dpi} dpi): made to be seen from a distance of a metre or more.')
                .replace('{dpi}', String(Math.round(dpi / 5) * 5));
            priceEl.appendChild(big);
        }

        // One price in euros: Stripe's payment page can show it in the visitor's own currency
        if (info.currency === 'EUR') {
            const fx = document.createElement('p');
            fx.className = 'price-note';
            fx.textContent = t('shop.price-currency-note',
                'Prices are in euros. On the payment page they may be shown in your own currency, at Stripe\u2019s exchange rate.');
            priceEl.appendChild(fx);
        }
    }

    // The part of the painting that a size prints: all of it, cut to the shape of the size from the top and the left,
    // so that the signature's corner stays. [width, height] of the print in millimetres; no size: no cut.
    function cropFor(srcW, srcH, sizeMm) {
        const whole = { sx: 0, sy: 0, sw: srcW, sh: srcH };
        if (!sizeMm || !(sizeMm[0] > 0) || !(sizeMm[1] > 0) || !srcW || !srcH) return whole;
        const target = sizeMm[0] / sizeMm[1];
        const aspect = srcW / srcH;
        if (Math.abs(target - aspect) / aspect < 0.004) return whole;
        if (target < aspect) {
            const sw = Math.round(srcH * target);
            return { sx: srcW - sw, sy: 0, sw: sw, sh: srcH };
        }
        const sh = Math.round(srcW / target);
        return { sx: 0, sy: srcH - sh, sw: srcW, sh: sh };
    }

    // The resolution the print file gives at the chosen size: its long side over the print's long side
    function chosenDpi() {
        const size = printSize();
        const v = direct && direct.data && direct.data.variants
            ? direct.data.variants.find((x) => x.id === chosen) : null;
        if (!size || !v || !v.size_mm || !v.size_mm.length) return 0;
        const long = Math.max.apply(null, v.size_mm);
        const cut = cropFor(size.w, size.h, v.size_mm);
        return long > 0 ? Math.max(cut.sw, cut.sh) / (long / 25.4) : 0;
    }

    // Sizes and frames the painting can fill, with what they cost, for a country
    function loadDirect() {
        const size = printSize();
        const p = current();
        if (!size || !p) return;

        // offered: the sizes the print file (not the studio's screen-size canvas) can fill
        const key = [p.id, size.w, size.h, countrySel.value].join('|');
        if (direct && direct.key === key) return;
        direct = { key: key, data: null, prices: {}, picks: {} };
        chosen = '';
        variantBox.textContent = '';
        showPrice();

        const q = new URLSearchParams({
            product: p.id, w: size.w, h: size.h, country: countrySel.value
        });
        fetch(ORDER_API + '/api/direct/options?' + q)
            .then((r) => r.json().then((d) => ({ ok: r.ok, d: d })))
            .then((res) => {
                if (!direct || direct.key !== key) return; // the painting changed meanwhile
                if (!res.ok) {
                    const k = REFUSALS[res.d.error] || 'shop.status-error';
                    say(k, REFUSAL_TEXT[k] || GENERIC_ERROR);
                    return;
                }
                say(null);
                direct.data = res.d;
                buildVariantFields();
            })
            .catch(() => { if (direct && direct.key === key) direct = null; });
    }

    /* ---- the preview ---- */

    // What a frame colour called by Gelato looks like
    function frameShade(text) {
        const x = String(text || '').toLowerCase();
        if (/black/.test(x)) return { base: '#17130f', light: '#3a332b' };
        if (/white/.test(x)) return { base: '#f5f3ec', light: '#ffffff' };
        if (/dark/.test(x)) return { base: '#3d2a1c', light: '#5c4230' };
        if (/natural|wood|oak|light/.test(x)) return { base: '#c19a66', light: '#dcb887' };
        if (/gold/.test(x)) return { base: '#bf9b30', light: '#e6c85b' };
        if (/silver|alumin/.test(x)) return { base: '#b9bcc0', light: '#e3e5e8' };
        if (/copper/.test(x)) return { base: '#b06a3b', light: '#d89464' };
        return { base: '#2a241f', light: '#4a4038' };
    }

    function roundedSize(mm) {
        const cm = mm / 10;
        return Math.abs(cm - Math.round(cm)) < 0.15 ? String(Math.round(cm)) : cm.toFixed(1);
    }

    // The painting inside what it is printed on, on a wall; the picture is the one just painted
    function drawMockup() {
        const variant = direct && direct.data && chosen
            ? direct.data.variants.filter((v) => v.id === chosen)[0]
            : null;
        const source = canvasOf();
        const product = current();
        if (!variant || !source || !source.width || !product || !(variant.size_mm && variant.size_mm[0] > 0)) {
            mockupBox.hidden = true;
            return;
        }
        mockupBox.hidden = false;

        const kind = product.id;
        const colourOpt = (variant.options || []).filter((o) => /colou?r/i.test(o.name))[0];
        const matted = /mount|mat\b|passe|mat-/i.test(kind + ' ' + (variant.options || []).map((o) => o.name + ' ' + o.value).join(' '));
        const framed = /framed|frame|mounted/.test(kind) || Boolean(colourOpt);
        const isCanvas = /canvas/.test(kind);
        const isAcrylic = /acrylic/.test(kind);
        const isMetal = /metal/.test(kind);
        const isWood = /^wood/.test(kind);
        const hanger = /hanging|hanger/.test(kind);
        const shade = frameShade(colourOpt ? colourOpt.value : '');

        const W = mockup.width;
        const H = mockup.height;
        const g = mockup.getContext('2d');

        // wall and floor
        const wall = g.createLinearGradient(0, 0, 0, H);
        wall.addColorStop(0, '#efeadf');
        wall.addColorStop(1, '#e2dccf');
        g.fillStyle = wall;
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#c9bfae';
        g.fillRect(0, H * 0.9, W, H * 0.1);
        g.fillStyle = 'rgba(0,0,0,0.08)';
        g.fillRect(0, H * 0.9 - 3, W, 3);

        // the print, fitted: as large as the wall allows
        const mmW = variant.size_mm[0];
        const mmH = variant.size_mm[1];
        const room = { w: W * 0.62, h: H * 0.62 };
        const k = Math.min(room.w / mmW, room.h / mmH);
        let w = mmW * k;
        let h = mmH * k;
        const frameW = framed ? Math.max(5, Math.min(w, h) * 0.055) : 0;
        const matW = framed && matted ? Math.max(8, Math.min(w, h) * 0.12) : 0;
        const depth = isCanvas ? Math.max(6, Math.min(w, h) * 0.035) : (isAcrylic || isMetal || isWood ? 5 : 0);

        const totalW = w + 2 * (frameW + matW);
        const totalH = h + 2 * (frameW + matW);
        const x = (W - totalW) / 2;
        const y = Math.max(H * 0.06 + (hanger ? 10 : 0), (H * 0.9 - totalH) / 2 - H * 0.04);

        // shadow on the wall
        g.save();
        g.shadowColor = 'rgba(40,30,20,0.35)';
        g.shadowBlur = 22;
        g.shadowOffsetX = 6;
        g.shadowOffsetY = 12;
        g.fillStyle = '#fff';
        g.fillRect(x, y, totalW, totalH);
        g.restore();

        if (hanger) {
            g.fillStyle = '#6b4f33';
            g.fillRect(x - 4, y - 9, totalW + 8, 9);
            g.fillRect(x - 4, y + totalH, totalW + 8, 9);
            g.strokeStyle = 'rgba(60,45,30,0.6)';
            g.lineWidth = 1.5;
            g.beginPath();
            g.moveTo(x + totalW * 0.2, y - 9);
            g.lineTo(x + totalW / 2, y - 34);
            g.lineTo(x + totalW * 0.8, y - 9);
            g.stroke();
        }

        // the side of a canvas, a slab of acrylic, metal or wood
        if (depth) {
            g.fillStyle = isCanvas ? '#e9e2d3' : isWood ? '#a9814f' : '#cfd6dc';
            g.fillRect(x + totalW, y + 3, depth, totalH);
            g.fillStyle = isCanvas ? '#d8d0bf' : isWood ? '#8a6738' : '#b4bcc4';
            g.fillRect(x + 3, y + totalH, totalW, depth);
        }

        // the frame
        if (framed && frameW) {
            const f = g.createLinearGradient(x, y, x + totalW, y + totalH);
            f.addColorStop(0, shade.light);
            f.addColorStop(0.5, shade.base);
            f.addColorStop(1, shade.base);
            g.fillStyle = f;
            g.fillRect(x, y, totalW, totalH);
            g.strokeStyle = 'rgba(0,0,0,0.25)';
            g.lineWidth = 1;
            g.strokeRect(x + frameW, y + frameW, totalW - 2 * frameW, totalH - 2 * frameW);
        }

        // the mat, then the painting
        const ix = x + frameW;
        const iy = y + frameW;
        if (matW) {
            g.fillStyle = '#f7f5ef';
            g.fillRect(ix, iy, totalW - 2 * frameW, totalH - 2 * frameW);
            g.strokeStyle = 'rgba(0,0,0,0.18)';
            g.strokeRect(ix + matW - 1, iy + matW - 1, w + 2, h + 2);
        }
        const px = ix + matW;
        const py = iy + matW;
        const cut = cropFor(source.width, source.height, variant.size_mm);
        g.drawImage(source, cut.sx, cut.sy, cut.sw, cut.sh, px, py, w, h);

        // light on the surface
        if (isAcrylic || isMetal) {
            const shine = g.createLinearGradient(px, py, px + w, py + h);
            shine.addColorStop(0, 'rgba(255,255,255,0.28)');
            shine.addColorStop(0.35, 'rgba(255,255,255,0.04)');
            shine.addColorStop(0.5, 'rgba(255,255,255,0.0)');
            shine.addColorStop(0.7, 'rgba(255,255,255,0.14)');
            shine.addColorStop(1, 'rgba(255,255,255,0.02)');
            g.fillStyle = shine;
            g.fillRect(px, py, w, h);
        } else if (framed) {
            // glass over a framed print
            const glass = g.createLinearGradient(px, py, px + w * 0.8, py + h * 0.8);
            glass.addColorStop(0, 'rgba(255,255,255,0.16)');
            glass.addColorStop(0.4, 'rgba(255,255,255,0)');
            g.fillStyle = glass;
            g.fillRect(px, py, w, h);
        } else if (isCanvas) {
            g.fillStyle = 'rgba(255,255,255,0.05)';
            g.fillRect(px, py, w, h);
        }
        g.strokeStyle = 'rgba(0,0,0,0.2)';
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);

        // the size, as on a shop drawing
        const dy = y + totalH + depth + 20;
        g.strokeStyle = '#7a6a54';
        g.fillStyle = '#7a6a54';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, dy);
        g.lineTo(x + totalW, dy);
        g.moveTo(x, dy - 5);
        g.lineTo(x, dy + 5);
        g.moveTo(x + totalW, dy - 5);
        g.lineTo(x + totalW, dy + 5);
        g.stroke();
        g.font = '15px Georgia, serif';
        g.textAlign = 'center';
        g.fillText(roundedSize(mmW) + ' \u00d7 ' + roundedSize(mmH) + ' cm', W / 2, dy + 19);

        mockupCaption.textContent = (variant.options || []).map((o) => o.value).join(' \u00b7 ');
    }

    // The name of a choice, in the visitor's language when there is one
    function optionName(name) {
        return t('shop.opt-' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-'), name);
    }

    // A product that has no such choice (a print with no frame, among framed ones) answers "none"
    const NONE = '\u0000none';
    const valueOrNone = (variant, name) => {
        const o = (variant.options || []).filter((x) => x.name === name)[0];
        return o ? o.value : NONE;
    };

    // One list per choice (size, frame colour, paper...). Each list offers only what goes with the choices
    // above it, so the visitor can never end on a combination that does not exist.
    function buildVariantFields() {
        variantBox.textContent = '';
        chosen = '';
        const list = direct && direct.data ? direct.data.variants : [];
        if (!list.length) { showPrice(); return; }

        const names = [];
        list.forEach((v) => (v.options || []).forEach((o) => { if (names.indexOf(o.name) < 0) names.push(o.name); }));

        names.forEach((name) => {
            const label = document.createElement('label');
            label.className = 'atelier-field';
            const span = document.createElement('span');
            span.textContent = optionName(name);
            const sel = document.createElement('select');
            sel.dataset.name = name;
            sel.addEventListener('change', () => { direct.picks[name] = sel.value; cascade(); });
            label.appendChild(span);
            label.appendChild(sel);
            variantBox.appendChild(label);
        });
        cascade();
    }

    function cascade() {
        const list = direct.data.variants;
        let pool = list;
        variantBox.querySelectorAll('select').forEach((sel) => {
            const name = sel.dataset.name;
            const values = [];
            pool.forEach((v) => {
                const x = valueOrNone(v, name);
                if (values.indexOf(x) < 0) values.push(x);
            });
            fill(sel, values.map((x) => ({ value: x, text: x === NONE ? t('shop.opt-none', 'None') : x })), direct.picks[name]);
            direct.picks[name] = sel.value;
            pool = pool.filter((v) => valueOrNone(v, name) === sel.value);
        });
        chosen = pool.length ? pool[0].id : '';
        showPrice();
        loadPrice();
        drawMockup();
    }

    // Only the price of the one chosen is asked for: with frames in four colours and a dozen sizes there are many
    function loadPrice() {
        const d = direct;
        const id = chosen;
        const size = printSize();
        const p = current();
        if (!d || !id || !size || !p || d.prices[id]) return;
        const q = new URLSearchParams({
            product: p.id, variant: id, w: size.w, h: size.h, country: countrySel.value
        });
        fetch(ORDER_API + '/api/direct/price?' + q)
            .then((r) => r.json().then((j) => ({ ok: r.ok, d: j })))
            .then((res) => {
                if (direct !== d) return;
                if (res.ok) {
                    d.prices[id] = res.d;
                } else {
                    const k = REFUSALS[res.d.error] || 'shop.status-error';
                    say(k, REFUSAL_TEXT[k] || GENERIC_ERROR);
                }
                showPrice();
            })
            .catch(() => { /* the price line stays on "looking up"; choosing again asks again */ });
    }

    // The studio rewrites its label many times while it paints: the preview is redrawn when the painting is done
    let mockupShown = '';
    function refreshChoice() {
        labelOrder();
        showPrice();
        loadDirect();
        const state = chosen + '|' + finished() + '|' + reference;
        if (state !== mockupShown) {
            mockupShown = state;
            drawMockup();
        }
    }

    productSel.addEventListener('change', () => { say(null); refreshChoice(); });
    countrySel.addEventListener('change', refreshChoice);

    /* ---- the human check ---- */

    function loadTurnstile(siteKey) {
        const mount = () => {
            captchaWidget = window.turnstile.render(captchaEl, {
                sitekey: siteKey,
                callback: (token) => { captchaToken = token; },
                'expired-callback': () => { captchaToken = ''; },
                'error-callback': () => { captchaToken = ''; }
            });
        };
        if (window.turnstile) { mount(); return; }
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = mount;
        document.head.appendChild(script);
    }

    function goLive(cfg) {
        config = cfg;
        buyBox.hidden = false;
        soonEl.hidden = true;
        // From here on the panel words these itself, in the visitor's language
        orderBtn.removeAttribute('data-i18n');
        fineprint.removeAttribute('data-i18n');
        fillProducts();
        fillCountries();
        if (cfg.turnstileSiteKey) loadTurnstile(cfg.turnstileSiteKey);
        renderFineprint();
        refreshChoice();
    }

    function renderFineprint() {
        fineprint.textContent = t('shop.api-fineprint',
            'Pay securely on this site; the print is made to order and shipped to you.');
    }

    // The order service could not be reached (an ad blocker, a network): say so, instead of "opens soon"
    function unreachable() {
        soonEl.removeAttribute('data-i18n');
        soonEl.textContent = t('shop.orders-unreachable',
            'The order service cannot be reached right now. Reload the page, or allow this site in your ad blocker.');
    }

    if (ORDER_API) {
        fetch(ORDER_API + '/api/config')
            .then((r) => (r.ok ? r.json() : null))
            .then((cfg) => {
                if (!cfg) { unreachable(); return; }
                if (cfg.enabled) goLive(cfg);
            })
            .catch(unreachable);
    }

    /* ---- placing the order ---- */

    const REFUSALS = {
        too_many_from_you: 'shop.status-limit',
        too_many_today: 'shop.status-limit',
        ordering_closed: 'shop.status-closed',
        captcha_missing: 'shop.status-captcha',
        captcha_failed: 'shop.status-captcha',
        image_too_small: 'shop.status-too-small',
        no_size_for_format: 'shop.status-no-format',
        variant_not_available: 'shop.status-too-small',
        unknown_format: 'shop.status-too-small'
    };

    const REFUSAL_TEXT = {
        'shop.status-limit': 'Too many orders from you today — please try again tomorrow.',
        'shop.status-closed': 'Ordering is paused for the moment.',
        'shop.status-captcha': 'Please confirm you are not a robot first.',
        'shop.status-too-small': 'This device cannot paint that size at 300 dpi: pick a smaller size, or order from a computer.',
        'shop.status-no-format': 'This format is not available as a print. In the studio, set Size to 4:5, 3:4, A or 1:1 and paint again.'
    };

    const GENERIC_ERROR = 'Something went wrong. Please try again, or write to me.';

    function canvasBlob(canvas, type, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), type, quality);
        });
    }

    /* ---- the print file ---- */

    function printKey() {
        return (frame ? frame.contentWindow.location.search || '' : '') + '|' + printLongMm();
    }

    function cancelPrint() {
        if (!printJob) return;
        printJob.frame.remove();
        printJob = null;
    }

    // The same painting (same seed, same choices) painted again in a hidden frame, at print size. At the moment of
    // ordering it is cut to the chosen size and made a JPEG (as a PNG a 300 dpi A3 would weigh 30 MB or more).
    function renderPrint() {
        const key = printKey();
        if (printJob && printJob.key === key) return printJob.promise;
        cancelPrint();
        const size = printSize();
        const q = new URLSearchParams(frame.contentWindow.location.search);
        q.set('print', String(size.long));
        const f = document.createElement('iframe');
        f.setAttribute('aria-hidden', 'true');
        f.tabIndex = -1;
        f.style.cssText = 'position:absolute;left:-10000px;top:0;width:800px;height:600px;border:0;';
        f.src = GENERATOR + '?' + q.toString();
        document.body.appendChild(f);
        const job = { key: key, frame: f, blob: null, progress: '' };
        job.promise = new Promise((resolve, reject) => {
            const iv = setInterval(() => {
                if (printJob !== job) { clearInterval(iv); reject(new Error('cancelled')); return; }
                let s = '';
                try { s = f.contentDocument.getElementById('status').textContent.trim(); } catch (e) { /* still loading */ }
                if (/^error/i.test(s)) { clearInterval(iv); reject(new Error(s)); return; }
                if (/^finished/i.test(s)) {
                    clearInterval(iv);
                    // kept whole (the cut depends on the size chosen, and the size can still change), as a plain
                    // canvas: the painter's own frame, which holds gigabytes while it works, goes at once
                    const done = f.contentDocument.getElementById('c');
                    const copy = document.createElement('canvas');
                    copy.width = done.width;
                    copy.height = done.height;
                    copy.getContext('2d').drawImage(done, 0, 0);
                    f.remove();
                    job.canvas = copy;
                    job.blob = true;
                    resolve(true);
                    return;
                }
                if (s && s !== job.progress) { job.progress = s; renderStatus(); }
            }, 1000);
        });
        printJob = job;
        return job.promise;
    }

    // The picture that is sent: the painting (or its print-size copy) cut to the shape of the chosen size
    function cutBlob(source, type, quality) {
        const v = direct && direct.data && direct.data.variants
            ? direct.data.variants.find((x) => x.id === chosen) : null;
        const cut = cropFor(source.width, source.height, v && v.size_mm);
        const out = document.createElement('canvas');
        out.width = cut.sw;
        out.height = cut.sh;
        out.getContext('2d').drawImage(source, cut.sx, cut.sy, cut.sw, cut.sh, 0, 0, cut.sw, cut.sh);
        return canvasBlob(out, type, quality);
    }

    async function order(event) {
        if (!config) return;
        event.preventDefault();
        if (!ordersOpen) return;
        if (busy) return;

        const doc = frameDoc();
        const product = current();
        if (!frame || !doc || !finished() || !product) {
            say('shop.status-paint-first', 'Let the painting finish first, then order.');
            return;
        }
        if (!chosen) {
            say('shop.status-variant', 'Choose a size and a frame first.');
            return;
        }
        if (config.turnstileSiteKey && !captchaToken) {
            say('shop.status-captcha', REFUSAL_TEXT['shop.status-captcha']);
            return;
        }

        // With the Worker's backend render on: ordered from the picture as it is; the 300 dpi file is painted after
        // the payment, on GitHub, before the order goes to the printer. Nothing to wait for here.
        const later = Boolean(config.backendRender);

        // Otherwise, first the file the print is made from. It takes minutes, so the visitor presses again once it is
        // ready (a new tab can only be opened straight from a click).
        if (!later && (!printJob || printJob.key !== printKey() || !printJob.blob)) {
            busy = true;
            orderBtn.setAttribute('aria-disabled', 'true');
            say('shop.status-printing', 'Painting the print file at 300 dpi. This takes a few minutes: keep this page open.');
            try {
                await renderPrint();
                say('shop.status-print-ready', 'The print file is ready. Press the button again to go on.');
            } catch (err) {
                if (err.message !== 'cancelled') say('shop.status-print-failed', 'The print file could not be painted on this device. Try again, or order from a computer.');
            } finally {
                busy = false;
                orderBtn.removeAttribute('aria-disabled');
            }
            return;
        }

        busy = true;
        orderBtn.setAttribute('aria-disabled', 'true');
        say('shop.status-sending', 'Preparing your payment… a few seconds.');
        // Opened now, while the click still counts, so the pop-up blocker lets it through
        const tab = window.open('', '_blank');
        const leave = (url) => {
            if (tab && !tab.closed) tab.location.href = url;
        };

        try {
            const canvas = canvasOf();
            const query = new URLSearchParams(frame.contentWindow.location.search);
            const seed = query.get('seed');
            query.delete('seed');
            const params = {};
            query.forEach((value, key) => { params[key] = value; });

            const meta = {
                seed: seed,
                params: params,
                product: product.id,
                title: (doc.getElementById('title').textContent || '').trim(),
                variant: chosen,
                country: countrySel.value
            };

            const form = new FormData();
            form.set('meta', JSON.stringify(meta));
            if (later) form.set('image', await cutBlob(canvas, 'image/png'), 'painting.png');
            else form.set('image', await cutBlob(printJob.canvas, 'image/jpeg', 0.95), 'painting.jpg');
            if (captchaToken) form.set('cf-turnstile-response', captchaToken);

            const res = await fetch(ORDER_API + '/api/checkout', { method: 'POST', body: form });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                const key = REFUSALS[data.error] || 'shop.status-error';
                say(key, REFUSAL_TEXT[key] || GENERIC_ERROR);
                if (tab) tab.close();
                return;
            }

            say('shop.status-redirecting', 'Taking you to the secure payment page…', data.url);
            leave(data.url);
        } catch (err) {
            say('shop.status-error', GENERIC_ERROR);
            if (tab) tab.close();
        } finally {
            busy = false;
            orderBtn.removeAttribute('aria-disabled');
            // A Turnstile token works once
            captchaToken = '';
            if (captchaWidget !== null && window.turnstile) window.turnstile.reset(captchaWidget);
        }
    }

    orderBtn.addEventListener('click', order);

    // The legal pages exist in French (which prevails) and English
    function legalLinks() {
        const page = lang() === 'fr' ? 'legal.html' : 'legal-en.html';
        const terms = $('atelier-legal-link');
        if (terms) terms.setAttribute('href', page + '#' + (lang() === 'fr' ? 'cgv' : 'terms'));
        document.querySelectorAll('.legal-footer-link').forEach((a) => a.setAttribute('href', page));
    }
    legalLinks();

    /* The panel writes its own text, so it has to be redrawn on a language change */
    document.addEventListener('akira:langchange', () => {
        legalLinks();
        if (frame) refresh();
        renderStatus();
        if (config) {
            fillProducts();
            fillCountries();
            if (direct && direct.data) buildVariantFields();
            renderFineprint();
            refreshChoice();
        }
    });
})();
