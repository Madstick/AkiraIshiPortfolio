/* Googly Rocks: the eyes follow you, things pop in, nothing runs while it cannot be seen.
   One pointer listener, one frame loop that sleeps when nothing moves, no layout reads while it runs. */
(function () {
    'use strict';

    var doc = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var eyes = [];

    /* ---------- the eyes ---------- */
    function collect() {
        eyes = Array.prototype.map.call(document.querySelectorAll('.eye'), function (el, i) {
            el.style.setProperty('--blink', (-Math.random() * 6).toFixed(2) + 's'); // each one blinks on its own time
            return { el: el, pupil: el.firstElementChild, cx: 0, cy: 0, r: 0, seen: true, lx: 0, ly: 0 };
        });
    }

    // The centres are measured once (in page coordinates) and again when the page changes size,
    // not on every mouse move: reading layout in a pointer handler is what made the first version heavy.
    function measure() {
        var sx = window.scrollX, sy = window.scrollY;
        for (var i = 0; i < eyes.length; i++) {
            var rect = eyes[i].el.getBoundingClientRect();
            eyes[i].cx = rect.left + rect.width / 2 + sx;
            eyes[i].cy = rect.top + rect.height / 2 + sy;
            eyes[i].r = rect.width * 0.27;
        }
    }

    var px = window.innerWidth / 2, py = window.innerHeight / 3; // where they look (client coordinates)
    var queued = false;

    function look() {
        queued = false;
        var sx = window.scrollX, sy = window.scrollY;
        for (var i = 0; i < eyes.length; i++) {
            var e = eyes[i];
            if (!e.seen) continue;
            var dx = px - (e.cx - sx), dy = py - (e.cy - sy);
            var dist = Math.min(Math.sqrt(dx * dx + dy * dy), e.r);
            var angle = Math.atan2(dy, dx);
            var x = Math.round(dist * Math.cos(angle) * 10) / 10;
            var y = Math.round(dist * Math.sin(angle) * 10) / 10;
            if (x !== e.lx || y !== e.ly) {
                e.lx = x;
                e.ly = y;
                e.pupil.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
            }
        }
    }

    function schedule() {
        if (!queued) {
            queued = true;
            requestAnimationFrame(look);
        }
    }

    var idleTimer = 0;
    function wander() {
        // when nobody is pointing, the rocks look around on their own (not for reduced motion)
        px = Math.random() * window.innerWidth;
        py = Math.random() * window.innerHeight;
        schedule();
        idleTimer = setTimeout(wander, 1800 + Math.random() * 1800);
    }
    function awake() {
        clearTimeout(idleTimer);
        if (!reduceMotion) idleTimer = setTimeout(wander, 3200);
    }

    window.addEventListener('pointermove', function (e) {
        px = e.clientX;
        py = e.clientY;
        schedule();
        awake();
    }, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { measure(); schedule(); }, 150);
    }, { passive: true });

    /* ---------- poke a rock: it hops and its eyes go wide ---------- */
    document.addEventListener('click', function (e) {
        var rock = e.target.closest ? e.target.closest('.rock') : null;
        if (!rock || reduceMotion) return;
        rock.classList.remove('hop');
        void rock.offsetWidth; // restart the animation
        rock.classList.add('hop', 'poked');
        setTimeout(function () { rock.classList.remove('poked'); }, 450);
        rock.addEventListener('animationend', function done(ev) {
            if (ev.animationName === 'hop') {
                rock.classList.remove('hop');
                rock.removeEventListener('animationend', done);
            }
        });
    });

    /* ---------- what is on screen ---------- */
    function observe() {
        if (!('IntersectionObserver' in window)) return;

        // eyes only move while they are in view
        var eyeObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                for (var i = 0; i < eyes.length; i++) {
                    if (eyes[i].el === entry.target) eyes[i].seen = entry.isIntersecting;
                }
                entry.target.classList.toggle('off', !entry.isIntersecting); // and blink only then
            });
            schedule();
        }, { rootMargin: '120px 0px' });
        eyes.forEach(function (e) { eyeObserver.observe(e.el); });

        // pop-in, once
        var popObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    popObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        document.querySelectorAll('[data-pop]').forEach(function (el) { popObserver.observe(el); });

        // the carousel and the bobbing notes sleep off screen
        var sleepObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                entry.target.classList.toggle('paused', !entry.isIntersecting);
                entry.target.classList.toggle('off', !entry.isIntersecting);
            });
        });
        document.querySelectorAll('.carousel, .notes').forEach(function (el) { sleepObserver.observe(el); });
    }

    function start() {
        collect();
        measure();
        look();
        observe();
        awake();
        // the paper font and the pictures move things a little: measure again when they are in
        window.addEventListener('load', function () { measure(); schedule(); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); schedule(); });
    }

    // nothing to hide behind a slow script: the page is complete without it
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    // when the tab is hidden, everything stops
    document.addEventListener('visibilitychange', function () {
        doc.classList.toggle('off', document.hidden);
    });
})();
