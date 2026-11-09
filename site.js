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
})();
