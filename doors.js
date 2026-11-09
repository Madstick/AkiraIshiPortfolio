/* ============================================
   THE DOORS OF THE RELIQUARY
   The doors are shut when the page opens. Scrolling down swings them open on the Reliquary;
   scrolling up while at the very top of the Reliquary swings them shut again.

   While the doors move, the page itself does not scroll: the wheel, the finger and the keys
   set where the doors WANT to be, and the doors glide there one frame at a time (an eased
   follow, so a wheel notch or a quick flick never jumps). Once they are fully open the page
   scrolls as usual, and only light (passive) listeners watch for the "back up to the top"
   gesture, so normal scrolling is never held up by this script.
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

    var target = 0;            // where the doors want to be: 0 = shut, 1 = wide open
    var shown = 0;             // where they are now, chasing the target
    var locked = null;         // null until the first state is applied
    var raf = 0;
    var lastFrame = 0;
    var topSince = performance.now();
    var touchY = 0;
    var touchPulled = 0;
    var openCallbacks = [];

    var FOLLOW_MS = 120;       // how long the doors take to catch up with the hand
    var clamp = function (v) { return Math.min(1, Math.max(0, v)); };
    var easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
    var travel = function () { return Math.max(900, window.innerHeight * 1.6); };

    function render() {
        var open = easeOutCubic(shown);
        var shift = (open * 102).toFixed(2); // a touch past 100% so no sliver stays on screen
        left.style.transform = 'translate3d(-' + shift + '%, 0, 0)';
        right.style.transform = 'translate3d(' + shift + '%, 0, 0)';
        invitation.style.opacity = Math.max(0, 1 - open * 3.2).toFixed(3);
    }

    // The gate stays in the page until the doors have really finished swinging
    function settle() {
        var done = shown >= 1 && target >= 1;
        gate.classList.toggle('is-open', done);
        var hint = done ? 'auto' : 'transform';
        left.style.willChange = right.style.willChange = hint;
    }

    function tick(now) {
        raf = 0;
        var dt = Math.min(50, now - lastFrame);
        lastFrame = now;
        var diff = target - shown;
        if (Math.abs(diff) < 0.0006) {
            shown = target;
        } else {
            // frame-rate independent: the same glide at 60 Hz and at 144 Hz
            shown += diff * (1 - Math.exp(-dt / FOLLOW_MS));
        }
        render();
        settle();
        if (shown !== target) raf = requestAnimationFrame(tick);
    }

    function follow() {
        if (raf) return;
        lastFrame = performance.now();
        raf = requestAnimationFrame(tick);
    }

    /* ---------- the two modes ---------- */

    function onWheelLocked(e) {
        if (e.ctrlKey) return; // pinch-zoom
        e.preventDefault();
        push(pixels(e));
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
        push(dy * 2.2);
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
            root.classList.add('gate-closed');
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
            var cbs = openCallbacks;
            openCallbacks = [];
            cbs.forEach(function (cb) { cb(); });
        }
    }

    // Where the doors want to be
    function aim(next) {
        target = clamp(next);
        setLocked(target < 1);
        if (reduceMotion) {
            shown = target;
            render();
            settle();
        } else {
            follow();
        }
    }

    function push(delta) {
        aim(target + delta / travel());
    }

    function startClosing(delta) {
        shown = target = 0.995;   // the doors are in the gap again, straight away
        render();
        settle();
        setLocked(true);
        push(delta);
    }

    function openNow() {
        target = shown = 1;
        render();
        settle();
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

        if (target < 1) {
            e.preventDefault();
            push(step * travel());
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
            if (target < 1) openNow();
        }
    }, { passive: true });

    // Tabbing into the page, or following an in-page link, means the visitor wants in
    window.addEventListener('focusin', function (e) {
        if (target < 1 && !gate.contains(e.target)) openNow();
    });
    window.addEventListener('hashchange', function () {
        if (target < 1) openNow();
    });
    window.addEventListener('pageshow', function (e) {
        if (e.persisted && window.scrollY > 0 && target < 1) openNow();
    });
    window.addEventListener('load', function () {
        if (window.scrollY > 0 && target < 1) openNow();
    });

    /* ---------- start ---------- */

    if (window.scrollY > 0 || (location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))))) {
        openNow();
    } else {
        render();
        settle();
        setLocked(true);
    }

    // Other scripts (the knight, the sparkles) wait for the doors
    window.AkiraGate = {
        isOpen: function () { return target >= 1; },
        whenOpen: function (cb) {
            if (target >= 1) cb();
            else openCallbacks.push(cb);
        }
    };
})();
