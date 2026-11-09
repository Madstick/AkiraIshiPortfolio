/* ============================================
   THE DOORS OF THE RELIQUARY
   The doors are shut when the page opens. Scrolling down swings them open on the Reliquary;
   scrolling up while at the very top of the Reliquary swings them shut again.

   While the doors move, the page itself does not scroll: the wheel, the finger and the keys
   drive the doors instead. Once they are fully open the page scrolls as usual, and only light
   (passive) listeners watch for the "back up to the top" gesture, so normal scrolling is never
   held up by this script.
   ============================================ */

(function () {
    'use strict';

    var gate = document.getElementById('gate');
    if (!gate) return;

    var root = document.documentElement;
    var left = gate.querySelector('.door-left');
    var right = gate.querySelector('.door-right');
    var invitation = gate.querySelector('.invitation');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var progress = 0;          // 0 = shut, 1 = wide open
    var locked = null;         // null until the first state is applied
    var topSince = performance.now();
    var touchY = 0;
    var touchPulled = 0;
    var openCallbacks = [];

    var clamp = function (v) { return Math.min(1, Math.max(0, v)); };
    var easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
    var travel = function () { return Math.max(900, window.innerHeight * 1.9); };

    function render() {
        // fully open at 85% of the travel, the rest is breathing room
        var open = easeOutCubic(Math.min(1, progress / 0.85));
        var shift = (open * 102).toFixed(2); // a touch past 100% so no sliver stays on screen
        left.style.transform = 'translate3d(-' + shift + '%, 0, 0)';
        right.style.transform = 'translate3d(' + shift + '%, 0, 0)';
        invitation.style.opacity = Math.max(0, 1 - open * 3.2).toFixed(3);
    }

    /* ---------- the two modes ---------- */

    function onWheelLocked(e) {
        if (e.ctrlKey) return; // pinch-zoom
        e.preventDefault();
        advance(pixels(e));
    }

    function onTouchStart(e) {
        touchY = e.touches[0].clientY;
        touchPulled = 0;
    }

    function onTouchMoveLocked(e) {
        var y = e.touches[0].clientY;
        var dy = touchY - y;
        touchY = y;
        e.preventDefault();
        advance(dy * 2.2);
    }

    // Open: only watching. Nothing here can block a scroll.
    function onWheelOpen(e) {
        if (e.ctrlKey || e.deltaY >= 0) return;
        if (window.scrollY <= 0 && performance.now() - topSince > 350) startClosing(pixels(e));
    }

    function onTouchMoveOpen(e) {
        var y = e.touches[0].clientY;
        var dy = touchY - y;
        touchY = y;
        if (window.scrollY > 0 || dy >= 0 || performance.now() - topSince < 350) {
            touchPulled = 0;
            return;
        }
        touchPulled += -dy;
        if (touchPulled > 28) startClosing(dy * 2.2);
    }

    function setLocked(next) {
        if (next === locked) return;
        locked = next;
        if (next) {
            gate.classList.remove('is-open');
            root.classList.add('gate-closed');
            left.style.willChange = right.style.willChange = 'transform';
            window.removeEventListener('wheel', onWheelOpen);
            window.removeEventListener('touchmove', onTouchMoveOpen);
            window.addEventListener('wheel', onWheelLocked, { passive: false });
            window.addEventListener('touchmove', onTouchMoveLocked, { passive: false });
        } else {
            window.removeEventListener('wheel', onWheelLocked);
            window.removeEventListener('touchmove', onTouchMoveLocked);
            window.addEventListener('wheel', onWheelOpen, { passive: true });
            window.addEventListener('touchmove', onTouchMoveOpen, { passive: true });
            root.classList.remove('gate-closed');
            gate.classList.add('is-open');
            left.style.willChange = right.style.willChange = 'auto';
            var cbs = openCallbacks;
            openCallbacks = [];
            cbs.forEach(function (cb) { cb(); });
        }
    }

    function advance(delta) {
        if (reduceMotion) {
            progress = delta > 0 ? 1 : 0;
        } else {
            progress = clamp(progress + delta / travel());
        }
        render();
        setLocked(progress < 1);
    }

    function startClosing(delta) {
        progress = 0.999;
        render();
        setLocked(true);
        advance(delta);
    }

    function openNow() {
        progress = 1;
        render();
        setLocked(false);
    }

    function pixels(e) {
        if (e.deltaMode === 1) return e.deltaY * 32;            // lines
        if (e.deltaMode === 2) return e.deltaY * window.innerHeight; // pages
        return e.deltaY;
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });

    /* ---------- keyboard ---------- */

    var DOWN = { ArrowDown: 0.25, PageDown: 0.6, ' ': 0.6, Spacebar: 0.6, End: 1 };
    var UP = { ArrowUp: 0.25, PageUp: 0.6, Home: 1 };

    window.addEventListener('keydown', function (e) {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        var t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

        var k = e.key;
        var step = null;
        if (e.shiftKey && (k === ' ' || k === 'Spacebar')) step = -UP.PageUp;
        else if (DOWN[k] !== undefined) step = DOWN[k];
        else if (UP[k] !== undefined) step = -UP[k];
        if (step === null) return;

        if (progress < 1) {
            e.preventDefault();
            advance(step * travel());
        } else if (step < 0 && window.scrollY <= 0 && performance.now() - topSince > 350) {
            e.preventDefault();
            startClosing(step * travel());
        }
    });

    /* ---------- the page moved by other means ---------- */

    var atTop = window.scrollY <= 0;
    window.addEventListener('scroll', function () {
        if (window.scrollY <= 0) {
            if (!atTop) {
                atTop = true;
                topSince = performance.now();
            }
        } else {
            atTop = false;
            // the scrollbar, an anchor or a restored position took the visitor past the doors
            if (progress < 1) openNow();
        }
    }, { passive: true });

    // Tabbing into the page, or following an in-page link, means the visitor wants in
    window.addEventListener('focusin', function (e) {
        if (progress < 1 && !gate.contains(e.target)) openNow();
    });
    window.addEventListener('hashchange', function () {
        if (progress < 1) openNow();
    });
    window.addEventListener('pageshow', function (e) {
        if (e.persisted && window.scrollY > 0 && progress < 1) openNow();
    });
    window.addEventListener('load', function () {
        if (window.scrollY > 0 && progress < 1) openNow();
    });

    /* ---------- start ---------- */

    if (window.scrollY > 0 || (location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))))) {
        openNow();
    } else {
        render();
        setLocked(true);
    }

    // Other scripts (the knight, the sparkles) wait for the doors
    window.AkiraGate = {
        isOpen: function () { return progress >= 1; },
        whenOpen: function (cb) {
            if (progress >= 1) cb();
            else openCallbacks.push(cb);
        }
    };
})();
