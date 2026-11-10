/* Portfolio pages: language switch (EN / FR), still images for visitors who ask for less motion. */
(function () {
    'use strict';

    var KEY = 'akira-lang'; // same key as the Reliquary and the shop, so the choice follows the visitor

    function current() {
        return document.documentElement.lang === 'fr' ? 'fr' : 'en';
    }

    function apply(lang) {
        document.documentElement.lang = lang;
        var i, el;

        var alts = document.querySelectorAll('[data-alt-fr]');
        for (i = 0; i < alts.length; i++) {
            el = alts[i];
            if (!el.hasAttribute('data-alt-en')) el.setAttribute('data-alt-en', el.getAttribute('alt') || '');
            el.setAttribute('alt', lang === 'fr' ? el.getAttribute('data-alt-fr') : el.getAttribute('data-alt-en'));
        }

        var titled = document.querySelectorAll('[data-title-fr]');
        for (i = 0; i < titled.length; i++) {
            el = titled[i];
            if (!el.hasAttribute('data-title-en')) el.setAttribute('data-title-en', el.getAttribute('title') || '');
            el.setAttribute('title', lang === 'fr' ? el.getAttribute('data-title-fr') : el.getAttribute('data-title-en'));
        }

        var fr = document.querySelector('meta[name="x-title-fr"]');
        var en = document.querySelector('meta[name="x-title-en"]');
        if (fr && en) document.title = lang === 'fr' ? fr.content : en.content;

        var buttons = document.querySelectorAll('.lang button');
        for (i = 0; i < buttons.length; i++) {
            buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-set-lang') === lang ? 'true' : 'false');
        }
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-set-lang]') : null;
        if (!btn) return;
        var lang = btn.getAttribute('data-set-lang');
        try { localStorage.setItem(KEY, lang); } catch (err) { /* private mode: the choice just does not persist */ }
        apply(lang);
    });

    apply(current());

    // Reduced motion: swap the moving images for a still frame
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var moving = document.querySelectorAll('[data-still]');
        for (var j = 0; j < moving.length; j++) {
            var node = moving[j];
            var still = node.getAttribute('data-still');
            if (node.tagName === 'VIDEO') {
                var img = document.createElement('img');
                img.src = still;
                img.alt = node.getAttribute('aria-label') || '';
                if (node.hasAttribute('data-alt-fr')) img.setAttribute('data-alt-fr', node.getAttribute('data-alt-fr'));
                img.width = node.getAttribute('width');
                img.height = node.getAttribute('height');
                node.parentNode.replaceChild(img, node);
            } else {
                node.src = still;
            }
        }
        apply(current());
    }

    var hasObserver = 'IntersectionObserver' in window;

    // Videos load when they come near the screen, play only while they are on it, and rest the rest of the time
    var videos = document.querySelectorAll('video');
    if (videos.length && hasObserver) {
        var videoWatch = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var v = entry.target;
                if (entry.isIntersecting) {
                    if (v.getAttribute('data-src') && !v.getAttribute('src')) v.setAttribute('src', v.getAttribute('data-src'));
                    var playing = v.play();
                    if (playing && playing.catch) playing.catch(function () { /* autoplay refused: the poster stays */ });
                } else {
                    v.pause();
                }
            });
        }, { rootMargin: '200px 0px' });
        for (var k = 0; k < videos.length; k++) videoWatch.observe(videos[k]);
    }

    // Browsers without scroll-driven animations: things rise once, as they come into view
    var root = document.documentElement;
    if (root.classList.contains('fx-io') && hasObserver) {
        var rise = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    rise.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        var rising = document.querySelectorAll('[data-r]');
        for (var m = 0; m < rising.length; m++) rise.observe(rising[m]);
    }

    // From a list to a work: the picture you clicked grows into the page that opens (cross-document view transitions)
    var lastLink = null;
    document.addEventListener('click', function (e) {
        lastLink = e.target.closest ? e.target.closest('a') : null;
    }, true);

    window.addEventListener('pageswap', function (e) {
        if (!e.viewTransition || !e.activeEntry) return;
        var to = new URL(e.activeEntry.url).pathname;
        if (to.indexOf('/work/') !== 0) return;
        var link = lastLink && new URL(lastLink.href, location.href).pathname === to ? lastLink : null;
        if (!link) {
            var all = document.querySelectorAll('a[href]');
            for (var n = 0; n < all.length && !link; n++) {
                if (new URL(all[n].href, location.href).pathname === to) link = all[n];
            }
        }
        var box = link && (link.classList.contains('cell') ? link : link.querySelector('.th, .ph'));
        if (box) {
            box.style.viewTransitionName = 'work-hero';
            try { sessionStorage.setItem('vt-hero', '1'); } catch (err) { /* no storage: the picture simply fades in */ }
        }
    });

    window.addEventListener('pagereveal', function (e) {
        var set = false;
        try { set = sessionStorage.getItem('vt-hero') === '1'; sessionStorage.removeItem('vt-hero'); } catch (err) { /* ignore */ }
        var hero = document.querySelector('.hero-frame');
        if (!e.viewTransition || !hero || !set) return;
        hero.style.viewTransitionName = 'work-hero';
        hero.style.animation = 'none'; // it arrives by growing out of the list, not by its own entrance
        var done = function () { hero.style.viewTransitionName = ''; hero.style.animation = ''; };
        e.viewTransition.finished.then(done, done);
    });
})();
