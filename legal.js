/* The seller's name, SIRET, address and phone are not written in this page, nor in the public repository: they are
   asked of the order Worker (a secret there), which only answers this site. A crawler that reads the HTML sees
   nothing; a visitor sees them. */
(function () {
    'use strict';

    const ORDER_API = 'https://still-life-code-orders.leakiraishi.workers.dev';
    const nodes = document.querySelectorAll('[data-legal]');
    if (!nodes.length) return;

    const fail = () => {
        const fr = document.documentElement.lang === 'fr';
        nodes.forEach((el) => {
            el.textContent = fr ? '(indisponible : écrivez-nous par courriel)' : '(unavailable: please email us)';
        });
    };

    fetch(ORDER_API + '/api/legal', { credentials: 'omit', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('legal ' + r.status))))
        .then((d) => {
            nodes.forEach((el) => {
                const key = el.getAttribute('data-legal');
                if (typeof d[key] !== 'string') return;
                el.textContent = d[key];
                if (el.tagName === 'A' && (key === 'phone' || key === 'phoneIntl') && d.tel) {
                    el.setAttribute('href', 'tel:' + d.tel);
                }
            });
        })
        .catch(fail);
})();
