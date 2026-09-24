/* ============================================
   THE GATES
   Scroll opens the doors, scrolling back closes them,
   and picking a path plays the entering animation.
   ============================================ */

(function () {
    'use strict';

    const gates = document.getElementById('gates');
    const hall = document.getElementById('hall');
    const choices = document.getElementById('choices');
    const doorLeft = document.getElementById('door-left');
    const doorRight = document.getElementById('door-right');
    const invitation = document.getElementById('invitation');
    const veil = document.getElementById('veil');

    if (!gates || !doorLeft || !doorRight) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    let entering = false;
    let ticking = false;

    /* --------------------------------------------
       Door progress driven by the scroll position
       -------------------------------------------- */

    function update() {
        if (entering) return;

        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;

        // Doors stand fully open at 80% of the runway, the rest is breathing room
        const open = easeOutCubic(Math.min(1, progress / 0.8));
        const shift = open * 102; // a touch past 100% so no sliver stays on screen

        doorLeft.style.transform = `translate3d(-${shift}%, 0, 0)`;
        doorRight.style.transform = `translate3d(${shift}%, 0, 0)`;

        // The hall brightens as the gap widens
        const reveal = Math.min(1, Math.max(0, (open - 0.12) / 0.45));
        hall.style.opacity = reveal;
        hall.style.transform = `scale(${(0.97 + reveal * 0.03).toFixed(3)})`;

        // The invitation belongs to the closed doors
        invitation.style.opacity = Math.max(0, 1 - open * 3.2);

        // The hall's mosaic starts loading (and drifting) with the first push
        if (open > 0.02) wakeHall();
        
        // Nothing is clickable until the choices are properly in view
        const ready = open > 0.55;
        choices.style.pointerEvents = ready ? 'auto' : 'none';
    }
    
    // The works behind the doors: fetched on the first movement, not at load,
    // so arriving at a closed door still costs nothing but the doors.
    let hallAwake = false;
    function wakeHall() {
        if (hallAwake) return;
        hallAwake = true;
        document.querySelectorAll('#hall-mosaic img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
        gates.classList.add('ajar');
    }

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            update();
            ticking = false;
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // The doors must be shut when someone arrives
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    update();
    window.addEventListener('load', update);

    /* --------------------------------------------
       Warm the chosen page up while it is hovered
       -------------------------------------------- */

    const prefetched = new Set();

    function prefetch(href) {
        if (!href || prefetched.has(href)) return;
        prefetched.add(href);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        document.head.appendChild(link);
    }

    // The preview mock-ups only exist on hover, so their images wait for it too
    function wakePreview(choice) {
        choice.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }

    choices.addEventListener('mouseover', (e) => {
        const choice = e.target.closest('.choice');
        if (!choice) return;
        prefetch(choice.getAttribute('href'));
        wakePreview(choice);
    }, { passive: true });

    choices.addEventListener('focusin', (e) => {
        const choice = e.target.closest('.choice');
        if (!choice) return;
        prefetch(choice.getAttribute('href'));
        wakePreview(choice);
    }, { passive: true });

    /* --------------------------------------------
       Entering a path
       -------------------------------------------- */

    function enter(choice, event) {
        if (entering) return;
        const href = choice.getAttribute('href');

        if (reduceMotion) {
            window.location.href = href;
            return;
        }

        entering = true;

        const rect = choice.getBoundingClientRect();
        const x = event && event.clientX ? event.clientX : rect.left + rect.width / 2;
        const y = event && event.clientY ? event.clientY : rect.top + rect.height / 2;
        veil.style.setProperty('--veil-x', x + 'px');
        veil.style.setProperty('--veil-y', y + 'px');

        choice.classList.add('is-chosen');
        gates.classList.add('entering');

        // The gates swing shut behind you...
        requestAnimationFrame(() => {
            doorLeft.style.transform = 'translate3d(0, 0, 0)';
            doorRight.style.transform = 'translate3d(0, 0, 0)';
        });

        // ...then the light takes over
        setTimeout(() => veil.classList.add('rising'), 380);
        setTimeout(() => { window.location.href = href; }, 940);
    }

    choices.addEventListener('click', (e) => {
        const choice = e.target.closest('.choice');
        if (!choice) return;
        // Leave new-tab and middle-click behaviour alone
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        enter(choice, e);
    });

    // Someone landing with the page already scrolled shouldn't be locked out
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            entering = false;
            gates.classList.remove('entering');
            veil.classList.remove('rising');
            choices.querySelectorAll('.is-chosen').forEach(c => c.classList.remove('is-chosen'));
            update();
        }
    });

    /* --------------------------------------------
       The Reliquary's cursor, on pointer devices
       -------------------------------------------- */

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const cursor = document.createElement('img');
        cursor.className = 'magical-cursor';
        cursor.src = 'images/desktop-icons/reliquary/cursor.webp';
        cursor.alt = '';
        document.body.appendChild(cursor);

        document.addEventListener('mousemove', (e) => {
            cursor.style.setProperty('--cursor-x', (e.clientX - 4) + 'px');
            cursor.style.setProperty('--cursor-y', (e.clientY - 4) + 'px');
        }, { passive: true });

        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('a')) cursor.classList.add('hover');
        }, { passive: true });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('a')) cursor.classList.remove('hover');
        }, { passive: true });
    }
})();
