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
    const ORDER_API = '';

    const GENERATOR = 'still-life-code.html';

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
    const variantSel = $('atelier-variant');
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
    let direct = null;       // sizes and prices for the direct route: { key, data }
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
        refEl.textContent = reference || '—';

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

    function money(amount) {
        try {
            return new Intl.NumberFormat(lang(), {
                style: 'currency', currency: config.currency, maximumFractionDigits: 0
            }).format(amount);
        } catch (e) {
            return amount + ' ' + config.currency;
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
        orderBtn.textContent = t('shop.order-direct', 'Pay securely and order');
    }

    function showPrice() {
        const v = direct && direct.data && variantSel.value
            ? direct.data.variants.filter((x) => x.id === variantSel.value)[0]
            : null;
        priceEl.textContent = v ? t('shop.price-direct',
            '{price} + {shipping} delivery. Made to order; payment by Stripe.')
            .replace('{price}', money(v.price)).replace('{shipping}', money(direct.data.shipping)) : '';
    }

    // Sizes and frames the painting can fill, with what they cost, for a country
    function loadDirect() {
        const size = printSize();
        const p = current();
        if (!size || !p) return;

        // offered: the sizes the print file (not the studio's screen-size canvas) can fill
        const key = [p.id, size.w, size.h, countrySel.value].join('|');
        if (direct && direct.key === key) return;
        direct = { key: key, data: null };
        variantSel.disabled = true;
        variantSel.textContent = '';
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
                fill(variantSel, res.d.variants.map((v) => ({ value: v.id, text: v.label + ' — ' + money(v.price) })), variantSel.value);
                variantSel.disabled = !res.d.variants.length;
                showPrice();
            })
            .catch(() => { if (direct && direct.key === key) direct = null; });
    }

    function refreshChoice() {
        labelOrder();
        showPrice();
        loadDirect();
    }

    productSel.addEventListener('change', () => { say(null); refreshChoice(); });
    countrySel.addEventListener('change', refreshChoice);
    variantSel.addEventListener('change', showPrice);

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

    if (ORDER_API) {
        fetch(ORDER_API + '/api/config')
            .then((r) => (r.ok ? r.json() : null))
            .then((cfg) => { if (cfg && cfg.enabled) goLive(cfg); })
            .catch(() => { /* Worker unreachable: the fallback stays */ });
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

    // The same painting (same seed, same choices) painted again in a hidden frame, at print size; then a JPEG of it
    // (as a PNG a 300 dpi A3 would weigh 30 MB or more)
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
                    canvasBlob(f.contentDocument.getElementById('c'), 'image/jpeg', 0.95).then((b) => {
                        job.blob = b;
                        f.remove();
                        resolve(b);
                    }, reject);
                    return;
                }
                if (s && s !== job.progress) { job.progress = s; renderStatus(); }
            }, 1000);
        });
        printJob = job;
        return job.promise;
    }

    async function order(event) {
        if (!config) return;
        event.preventDefault();
        if (busy) return;

        const doc = frameDoc();
        const product = current();
        if (!frame || !doc || !finished() || !product) {
            say('shop.status-paint-first', 'Let the painting finish first, then order.');
            return;
        }
        if (!variantSel.value) {
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
                variant: variantSel.value,
                country: countrySel.value
            };

            const form = new FormData();
            form.set('meta', JSON.stringify(meta));
            if (later) form.set('image', await canvasBlob(canvas, 'image/png'), 'painting.png');
            else form.set('image', printJob.blob, 'painting.jpg');
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

    /* The panel writes its own text, so it has to be redrawn on a language change */
    document.addEventListener('akira:langchange', () => {
        if (frame) refresh();
        renderStatus();
        if (config) {
            fillProducts();
            fillCountries();
            if (direct && direct.data) {
                fill(variantSel, direct.data.variants.map((v) => ({ value: v.id, text: v.label + ' — ' + money(v.price) })), variantSel.value);
            }
            renderFineprint();
            refreshChoice();
        }
    });
})();
