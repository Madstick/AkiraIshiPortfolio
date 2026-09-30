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
   Nature Morte runs in its own page, dropped
   into an iframe the first time it is asked for.
   Same origin, so the panel can read the label
   it writes and drive its buttons.
   ============================================ */

(function () {
    'use strict';

    // TODO: the real Etsy listing for a Nature Morte print
    const ETSY_SHOP = 'https://www.etsy.com/';
    const GENERATOR = 'nature-morte.html';

    const stage = document.getElementById('atelier-stage');
    const poster = document.getElementById('atelier-poster');
    const openBtn = document.getElementById('atelier-open');
    if (!stage || !poster || !openBtn) return;

    const titleEl = document.getElementById('atelier-title');
    const metaEl = document.getElementById('atelier-meta');
    const refEl = document.getElementById('atelier-ref');
    const newBtn = document.getElementById('atelier-new');
    const saveBtn = document.getElementById('atelier-save');
    const orderBtn = document.getElementById('atelier-order');

    orderBtn.href = ETSY_SHOP;

    const t = (key, fallback) => (window.AkiraI18n ? window.AkiraI18n.t(key, fallback) : fallback);

    let frame = null;
    let reference = '';

    /* ---- reading the painting out of the frame ---- */

    function frameDoc() {
        try {
            return frame && frame.contentDocument;
        } catch (e) {
            return null;
        }
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

        newBtn.disabled = saveBtn.disabled = !seed;
    }

    // The generator rewrites its status line many times a second while it paints.
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
        frame.title = t('shop.atelier-frame-title', 'Nature Morte, a generative still-life painter');
        frame.setAttribute('allow', 'fullscreen');
        frame.addEventListener('load', () => {
            const doc = frameDoc();
            if (!doc) return;
            // The generator rewrites its label as it paints; follow that instead of polling.
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
        const section = stage.closest('section');
        if (section) section.classList.add('atelier-live');
        metaEl.textContent = t('shop.the-first-painting-is-on-its', 'The first painting is on its way \u2014 give it half a minute.');
    }

    openBtn.addEventListener('click', open);

    /* ---- driving it from the panel ---- */

    function press(id) {
        const doc = frameDoc();
        const button = doc && doc.getElementById(id);
        if (button) button.click();
    }

    newBtn.addEventListener('click', () => press('st-new'));
    saveBtn.addEventListener('click', () => press('st-save'));

    /* ---- taking it to the shop ---- */

    function copyReference() {
        if (!reference || !navigator.clipboard) return;
        navigator.clipboard.writeText(reference).then(() => {
            const original = orderBtn.textContent;
            orderBtn.textContent = t('shop.reference-copied', 'Reference copied \u2014 opening Etsy');
            setTimeout(() => { orderBtn.textContent = original; }, 2600);
        }, () => { /* clipboard refused; the reference is on screen anyway */ });
    }

    orderBtn.addEventListener('click', copyReference);

    /* The panel writes its own text, so it has to be redrawn on a language change */
    document.addEventListener('akira:langchange', () => {
        if (frame) refresh();
    });
})();
