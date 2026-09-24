/* ============================================
   LANGUAGE SWITCHING
   English lives in the HTML itself; every other
   language is a dictionary in i18n/<code>.js that
   overrides it, key by key.
   ============================================ */

(function () {
    'use strict';

    const LANGUAGES = [
        { code: 'en', short: 'EN', label: 'English' },
        { code: 'fr', short: 'FR', label: 'Français' },
        { code: 'es', short: 'ES', label: 'Español' },
        { code: 'de', short: 'DE', label: 'Deutsch' },
        { code: 'zh', short: '中文', label: '中文' },
        { code: 'ja', short: '日本', label: '日本語' }
    ];

    const STORAGE_KEY = 'akira-lang';
    const codes = LANGUAGES.map(l => l.code);

    window.I18N = window.I18N || {};

    function stored() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return codes.indexOf(saved) > -1 ? saved : null;
        } catch (e) {
            return null;
        }
    }

    function fromBrowser() {
        const list = navigator.languages || [navigator.language || 'en'];
        for (const entry of list) {
            const tag = String(entry).toLowerCase();
            if (tag.indexOf('zh') === 0) return 'zh';
            const base = tag.split('-')[0];
            if (codes.indexOf(base) > -1) return base;
        }
        return 'en';
    }

    let lang = stored() || fromBrowser();

    /* --------------------------------------------
       Dictionary lookups
       -------------------------------------------- */

    function pack() {
        return window.I18N[lang] || {};
    }

    // t('some.key', 'English fallback') - used by the page scripts
    function t(key, fallback) {
        const ui = pack().ui;
        const value = ui && ui[key];
        return value === undefined ? fallback : value;
    }

    // Translated fields for a project from data.js, falling back to the original
    function project(source) {
        if (!source) return source;
        const table = pack().projects;
        const override = table && table[source.id];
        return override ? Object.assign({}, source, override) : source;
    }

    /* --------------------------------------------
       Applying a dictionary to the document
       -------------------------------------------- */

    const ATTRS = [
        ['data-i18n-placeholder', 'placeholder'],
        ['data-i18n-title', 'title'],
        ['data-i18n-aria-label', 'aria-label'],
        ['data-i18n-content', 'content']
    ];

    function apply() {
        const ui = pack().ui || {};

        document.documentElement.setAttribute('lang', lang);

        document.querySelectorAll('[data-i18n]').forEach(el => {
            if (el.dataset.i18nSource === undefined) {
                el.dataset.i18nSource = el.innerHTML;
            }
            const value = ui[el.dataset.i18n];
            el.innerHTML = value === undefined ? el.dataset.i18nSource : value;
        });

        ATTRS.forEach(([dataAttr, target]) => {
            // dataset keys are camelCase: aria-label -> i18nSrcAriaLabel
            const cache = 'i18nSrc' + target.replace(/(^|-)([a-z])/g, (m, dash, ch) => ch.toUpperCase());
            document.querySelectorAll('[' + dataAttr + ']').forEach(el => {
                const key = el.getAttribute(dataAttr);
                if (el.dataset[cache] === undefined) {
                    el.dataset[cache] = el.getAttribute(target) || '';
                }
                const value = ui[key];
                el.setAttribute(target, value === undefined ? el.dataset[cache] : value);
            });
        });

        document.querySelectorAll('.lang-switcher').forEach(updateSwitcher);
        document.dispatchEvent(new CustomEvent('akira:langchange', { detail: { lang: lang } }));
    }

    /* --------------------------------------------
       Loading a language pack on demand
       -------------------------------------------- */

    function load(code, done) {
        if (code === 'en' || window.I18N[code]) {
            done();
            return;
        }
        const script = document.createElement('script');
        script.src = 'i18n/' + code + '.js';
        script.charset = 'UTF-8';
        script.async = false;
        script.onload = done;
        script.onerror = function () {
            // A missing pack simply leaves the page in English
            lang = 'en';
            done();
        };
        document.head.appendChild(script);
    }

    function setLang(code) {
        if (codes.indexOf(code) === -1 || code === lang) return;
        lang = code;
        try {
            localStorage.setItem(STORAGE_KEY, code);
        } catch (e) { /* private browsing, fine */ }
        load(code, apply);
    }

    /* --------------------------------------------
       The switcher itself
       -------------------------------------------- */

    function updateSwitcher(switcher) {
        const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
        switcher.querySelector('.lang-current-label').textContent = current.short;
        switcher.querySelectorAll('.lang-option').forEach(option => {
            option.setAttribute('aria-selected', String(option.dataset.lang === lang));
        });
    }

    function buildSwitcher(mount) {
        const switcher = document.createElement('div');
        switcher.className = 'lang-switcher';
        if (mount.dataset.variant === 'light') switcher.classList.add('lang-switcher-light');

        switcher.innerHTML =
            '<button type="button" class="lang-current" aria-haspopup="listbox" aria-expanded="false" aria-label="Language">' +
                '<span class="lang-globe" aria-hidden="true">✶</span>' +
                '<span class="lang-current-label">EN</span>' +
                '<span class="lang-caret" aria-hidden="true">▾</span>' +
            '</button>' +
            '<ul class="lang-menu" role="listbox">' +
                LANGUAGES.map(l =>
                    '<li><button type="button" class="lang-option" role="option" data-lang="' + l.code + '">' +
                        '<span class="lang-option-short">' + l.short + '</span>' +
                        '<span class="lang-option-label">' + l.label + '</span>' +
                    '</button></li>'
                ).join('') +
            '</ul>';

        const toggle = switcher.querySelector('.lang-current');
        const menu = switcher.querySelector('.lang-menu');

        function close() {
            switcher.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        }

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = switcher.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(open));
        });

        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.lang-option');
            if (!option) return;
            e.stopPropagation();
            close();
            setLang(option.dataset.lang);
        });

        document.addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        mount.appendChild(switcher);
        updateSwitcher(switcher);
    }

    function mountAll() {
        document.querySelectorAll('[data-i18n-switcher]').forEach(mount => {
            if (!mount.querySelector('.lang-switcher')) buildSwitcher(mount);
        });
    }

    /* --------------------------------------------
       Boot
       -------------------------------------------- */

    window.AkiraI18n = {
        get lang() { return lang; },
        languages: LANGUAGES,
        t: t,
        project: project,
        setLang: setLang,
        apply: apply
    };

    // Fetch the pack right away so the swap happens before first paint where possible
    load(lang, function () {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                mountAll();
                apply();
            });
        } else {
            mountAll();
            apply();
        }
    });
})();
