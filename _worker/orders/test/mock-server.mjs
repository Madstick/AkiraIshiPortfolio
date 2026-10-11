// Try the whole ordering flow on your own machine, with pretend Gelato and Stripe: no accounts, no cost.
//
//   node test/mock-server.mjs            (listens on http://127.0.0.1:8787)
//
// Then, in shop.js, set  const ORDER_API = 'http://127.0.0.1:8787';  and open the shop page from a
// local server on http://127.0.0.1:8905 (python -m http.server 8905). Remove the line when done.
// The "Stripe page" is just the shop's own thank-you address, and no real order goes anywhere.
import http from 'node:http';
import worker from '../src/index.js';

const PORT = Number(process.env.PORT) || 8787;
const SITE = process.env.SITE || 'http://127.0.0.1:8905';

class FakeKV {
  constructor() { this.map = new Map(); }
  async get(key, type) {
    const v = this.map.get(key);
    if (v === undefined) return null;
    if (type === 'json') return JSON.parse(v);
    if (type === 'arrayBuffer') return v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : null;
    return typeof v === 'string' ? v : new TextDecoder().decode(v);
  }
  async put(key, value) { this.map.set(key, value); }
  async delete(key) { this.map.delete(key); }
}

// A poster template: sizes in the studio's formats, with and without a frame (print areas in mm)
const variant = (id, title, uid, w, h, frame) => ({
  id, title, productUid: uid,
  variantOptions: [{ name: 'Size', value: title.split(' - ')[0] }, ...(frame ? [{ name: 'Frame', value: frame }] : [])],
  imagePlaceholders: [{ name: 'ImageFront', width: w, height: h }],
});
const TEMPLATE = {
  id: 'tpl-poster',
  title: 'Poster',
  variants: [
    variant('a5', 'A5 - No frame', 'flat_a5', 148, 210), variant('a4', 'A4 - No frame', 'flat_a4', 210, 297),
    variant('a3', 'A3 - No frame', 'flat_a3', 297, 420), variant('a4b', 'A4 - Black frame', 'framed_a4_black', 210, 297, 'Black'),
    variant('a4w', 'A4 - Wood frame', 'framed_a4_wood', 210, 297, 'Natural wood'),
    variant('a4l', 'A4 landscape - No frame', 'flat_a4_l', 297, 210), variant('a4lb', 'A4 landscape - Black frame', 'framed_a4_l_black', 297, 210, 'Black'),
    variant('p45', '8x10 in - No frame', 'flat_8x10', 203, 254), variant('l45', '10x8 in - No frame', 'flat_10x8', 254, 203),
    variant('p34', '30x40 cm - No frame', 'flat_30x40', 300, 400), variant('l34', '40x30 cm - No frame', 'flat_40x30', 400, 300),
    variant('p23', '20x30 cm - No frame', 'flat_20x30', 200, 300), variant('l23', '30x20 cm - No frame', 'flat_30x20', 300, 200),
    variant('s20', '20x20 cm - No frame', 'flat_20x20', 200, 200),
  ],
};

const env = {
  TOKENS: new FakeKV(),
  SITE_URL: SITE,
  ALLOWED_ORIGINS: SITE,
  DIRECT_ENABLED: 'true',
  ADMIN_KEY: 'mock',
  CURRENCY: 'EUR',
  GELATO_API_KEY: 'mock',
  GELATO_TEMPLATES: JSON.stringify({
    poster: { templateId: 'tpl-poster', label: 'Art Print' },
    framed: { catalogUid: 'framed-posters', label: 'Framed poster' },
  }),
  STRIPE_SECRET_KEY: 'mock',
  STRIPE_WEBHOOK_SECRET: 'mock',
  DIRECT_MARKUP: '2.2',
  DIRECT_SHIPPING_JSON: '{"FR": 6, "default": 12}',
  MIN_DPI: process.env.MIN_DPI || '150',
  MAX_PER_IP_PER_DAY: '50',
  MAX_PER_DAY: '500',
  // RENDER_ENABLED=true node test/mock-server.mjs : the print file is "painted after the payment", so the
  // shop does not paint 300 dpi in the browser first
  ...(process.env.RENDER_ENABLED === 'true'
    ? { RENDER_ENABLED: 'true', RENDER_SECRET: 'mock', GITHUB_REPO: 'mock/prints', GITHUB_TOKEN: 'mock' }
    : {}),
};

// Everything addressed to Gelato or Stripe is answered here
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const known = ['gelatoapis.com', 'api.stripe.com', 'api.github.com'];
  if (!known.some((h) => url.includes(h))) return realFetch(input, init);
  const reply = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  const say = (text) => console.log(`  [pretend] ${text}`);

  if (url.includes('ecommerce.gelatoapis.com') && url.includes('/templates/')) return reply(TEMPLATE);
  if (url === 'https://product.gelatoapis.com/v3/catalogs/framed-posters') {
    return reply({ catalogUid: 'framed-posters', productAttributes: {
      FrameColor: { title: 'Frame colour', values: { black: { title: 'Black' }, white: { title: 'White' }, 'natural-wood': { title: 'Natural wood' }, 'dark-wood': { title: 'Dark wood' } } },
      PaperFormat: { values: { A4: { title: 'A4' }, A3: { title: 'A3' }, A2: { title: 'A2' } } },
    } });
  }
  if (url === 'https://product.gelatoapis.com/v3/catalogs/framed-posters/products:search') {
    const sizes = { A4: [210, 297], A3: [297, 420], A2: [420, 594], '8x10': [203, 254], '12x15': [305, 381], '16x20': [406, 508], '24x30': [610, 762] };
    const out = [];
    for (const [fmt, [w, h]] of Object.entries(sizes)) {
      for (const color of ['black', 'white', 'natural-wood', 'dark-wood']) {
        for (const [W, H, o] of [[w, h, 'ver'], [h, w, 'hor']]) {
          out.push({ productUid: `frame_${fmt}_${color}_${o}`, supportedCountries: ['FR', 'DE', 'US'],
            attributes: { FrameColor: color, PaperFormat: fmt, Orientation: o, ProductStatus: 'activated' },
            dimensions: { Width: { value: W }, Height: { value: H } } });
        }
      }
    }
    return reply({ products: out });
  }
  if (url.includes('product.gelatoapis.com')) {
    const uid = decodeURIComponent(url.split('/products/')[1].split('/')[0]);
    return reply([{ productUid: uid, country: 'FR', quantity: 1, price: uid.startsWith('framed') ? 24 : 11, currency: 'EUR' }]);
  }
  if (url === 'https://order.gelatoapis.com/v4/orders') {
    const b = JSON.parse(init.body);
    say(`GELATO ${b.orderType} for ${b.items[0].productUid}, file ${b.items[0].files[0].url}`);
    return reply({ id: 'mock-order' });
  }
  if (url.includes('api.stripe.com')) {
    say('STRIPE checkout session created');
    return reply({ id: 'cs_mock', url: `${SITE}/shop.html?order=thanks#atelier` });
  }
  if (url.includes('api.github.com')) return reply({ content: {} }, 201);
  return reply({});
};

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://127.0.0.1:${PORT}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await worker.fetch(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, '127.0.0.1', () => console.log(`pretend Gelato / Stripe Worker on http://127.0.0.1:${PORT}  (site ${SITE})`));
