// Runs the Worker against pretend Gelato, Stripe and GitHub: no network, no account, no cost.
//   node test/run.mjs
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../src/index.js';

/* ---------- fakes ---------- */

class FakeKV {
  constructor() { this.map = new Map(); }
  async get(key, type) {
    const v = this.map.get(key);
    if (v === undefined) return null;
    if (type === 'json') return JSON.parse(v);
    if (type === 'arrayBuffer') return v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : new TextEncoder().encode(v).buffer;
    return v instanceof Uint8Array ? new TextDecoder().decode(v) : v;
  }
  async put(key, value) { this.map.set(key, value instanceof Uint8Array || typeof value === 'string' ? value : String(value)); }
  async delete(key) { this.map.delete(key); }
}

function fakePng(width, height, extra = 2000) {
  const bytes = new Uint8Array(33 + extra);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
const FAKE_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
// A JPEG header as a browser writes it: JFIF segment, then the frame (SOF0) with the size, then padding
function fakeJpeg(width, height, extra = 2000) {
  const head = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc0, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const bytes = new Uint8Array(head.length + extra);
  bytes.set(head);
  return bytes;
}

// A Gelato template with sizes and frames. Print areas are in millimetres.
const TEMPLATE = {
  id: 'tpl-poster',
  title: 'Poster',
  variants: [
    { id: 'v-a4', title: 'A4 - No frame', productUid: 'flat_a4', variantOptions: [{ name: 'Size', value: 'A4' }], imagePlaceholders: [{ name: 'ImageFront', width: 210, height: 297 }] },
    { id: 'v-a3', title: 'A3 - No frame', productUid: 'flat_a3', variantOptions: [{ name: 'Size', value: 'A3' }], imagePlaceholders: [{ name: 'ImageFront', width: 297, height: 420 }] },
    { id: 'v-a4-black', title: 'A4 - Black frame', productUid: 'framed_a4_black', variantOptions: [{ name: 'Size', value: 'A4' }, { name: 'Frame', value: 'Black' }], imagePlaceholders: [{ name: 'ImageFront', width: 210, height: 297 }] },
    { id: 'v-a1', title: 'A1 - No frame', productUid: 'flat_a1', variantOptions: [{ name: 'Size', value: 'A1' }], imagePlaceholders: [{ name: 'ImageFront', width: 594, height: 841 }] },
    { id: 'v-a4-land', title: 'A4 landscape', productUid: 'flat_a4_land', variantOptions: [], imagePlaceholders: [{ name: 'ImageFront', width: 297, height: 210 }] },
    { id: 'v-34', title: '30x40 - No frame', productUid: 'flat_30x40', variantOptions: [], imagePlaceholders: [{ name: 'ImageFront', width: 300, height: 400 }] },
  ],
};
const COST = { flat_a4: 8, flat_a3: 12, framed_a4_black: 25, fp_a4_black: 30, fp_a4_white: 30, fp_a3_black: 40, fp_a4_wood_de: 34 };

// A catalogue of framed posters, as Gelato's catalogue API describes it
const CATALOG = {
  catalogUid: 'framed-posters',
  title: 'Framed posters',
  productAttributes: [
    { productAttributeUid: 'Orientation', title: 'Orientation', values: [{ productAttributeValueUid: 'ver', title: 'Portrait' }, { productAttributeValueUid: 'hor', title: 'Landscape' }] },
    { productAttributeUid: 'PaperFormat', title: 'Paper Format', values: [{ productAttributeValueUid: 'A4', title: 'A4' }, { productAttributeValueUid: 'A3', title: 'A3' }, { productAttributeValueUid: 'A1', title: 'A1' }] },
    { productAttributeUid: 'FrameColor', title: 'Frame colour', values: [{ productAttributeValueUid: 'black', title: 'Black' }, { productAttributeValueUid: 'white', title: 'White' }, { productAttributeValueUid: 'wood', title: 'Natural wood' }] },
  ],
};
const cat = (uid, format, frame, w, h, extra = {}) => ({
  productUid: uid,
  attributes: { Orientation: w > h ? 'hor' : 'ver', PaperFormat: format, FrameColor: frame, ProductStatus: 'activated' },
  dimensions: { Width: { value: w, measureUnit: 'mm' }, Height: { value: h, measureUnit: 'mm' } },
  supportedCountries: ['FR', 'DE', 'US'],
  ...extra,
});
const CATALOG_PRODUCTS = [
  cat('fp_a4_black', 'A4', 'black', 210, 297),
  cat('fp_a4_white', 'A4', 'white', 210, 297),
  cat('fp_a3_black', 'A3', 'black', 297, 420),
  cat('fp_a1_black', 'A1', 'black', 594, 841),
  cat('fp_a4_black_hor', 'A4', 'black', 297, 210),
  cat('fp_a4_wood_de', 'A4', 'wood', 210, 297, { supportedCountries: ['DE'] }),
  cat('fp_a4_old', 'A4', 'black', 210, 297, { attributes: { Orientation: 'ver', PaperFormat: 'A4', FrameColor: 'black', ProductStatus: 'archived' } }),
];

const calls = [];

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const method = (init.method || 'GET').toUpperCase();
  calls.push({ url, method, init });
  const ok = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  if (url.includes('challenges.cloudflare.com')) return ok({ success: new URLSearchParams(init.body).get('response') === 'good' });

  // ---- Gelato
  if (url.startsWith('https://ecommerce.gelatoapis.com/v1/templates/')) {
    assert.equal(init.headers['x-api-key'], 'gelato-key');
    return ok(TEMPLATE);
  }
  // globalThis.__objects: Gelato sending its lists as objects keyed by id instead of arrays
  const keyed = (list, key) => Object.fromEntries(list.map((x) => [x[key], x]));
  if (url === 'https://product.gelatoapis.com/v3/catalogs') return ok([{ catalogUid: 'posters', title: 'Posters' }, { catalogUid: 'framed-posters', title: 'Framed posters' }]);
  if (url === 'https://product.gelatoapis.com/v3/catalogs/framed-posters') {
    if (!globalThis.__objects) return ok(CATALOG);
    return ok({
      ...CATALOG,
      productAttributes: Object.fromEntries(CATALOG.productAttributes.map((a) => [a.productAttributeUid, {
        title: a.title,
        values: Object.fromEntries(a.values.map((v) => [v.productAttributeValueUid, { title: v.title }])),
      }])),
    });
  }
  if (url === 'https://product.gelatoapis.com/v3/catalogs/framed-posters/products:search') {
    assert.equal(init.headers['x-api-key'], 'gelato-key');
    const { limit, offset } = JSON.parse(init.body);
    const page = CATALOG_PRODUCTS.slice(offset, offset + limit);
    return ok({ products: globalThis.__objects ? keyed(page, 'productUid') : page });
  }
  if (url.startsWith('https://product.gelatoapis.com/v3/products/')) {
    const uid = decodeURIComponent(url.split('/products/')[1].split('/')[0]);
    return ok([{ productUid: uid, country: 'FR', quantity: 5, price: 1, currency: 'EUR' }, { productUid: uid, country: 'FR', quantity: 1, price: COST[uid] || 10, currency: 'EUR' }]);
  }
  if (url === 'https://order.gelatoapis.com/v4/orders' && method === 'POST') return ok({ id: 'gelato-order-1', fulfillmentStatus: 'created' });

  // ---- Stripe
  if (url === 'https://api.stripe.com/v1/checkout/sessions') return ok({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

  // ---- GitHub
  if (url.startsWith('https://api.github.com/repos/')) return ok({ content: {} }, 201);

  throw new Error(`unexpected fetch ${method} ${url}`);
};

const ORIGIN = 'https://akiraishi.com';
function makeEnv(extra = {}) {
  return {
    TOKENS: new FakeKV(),
    SITE_URL: 'https://akiraishi.com',
    ALLOWED_ORIGINS: `${ORIGIN},https://www.akiraishi.com`,
    DIRECT_ENABLED: 'true',
    ADMIN_KEY: 'secret-admin',
    CURRENCY: 'EUR',
    GELATO_API_KEY: 'gelato-key',
    GELATO_TEMPLATES: JSON.stringify({ poster: { templateId: 'tpl-poster', label: 'Art Print' } }),
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    DIRECT_MARKUP: '2',
    DIRECT_SHIPPING_JSON: '{"FR": 6, "default": 12}',
    MIN_DPI: '150',
    MAX_PER_IP_PER_DAY: '3',
    MAX_PER_DAY: '20',
    ...extra,
  };
}

// An order request to /api/checkout (a painting, what was chosen, a human check)
function order({ seed = 'abc123xyz', product = 'poster', width = 1754, height = 2480, params = { style: 'water', ratio: 'a' }, title = 'Still Life with Pears', origin = ORIGIN, image, jpeg = false, ip = '1.1.1.1', captcha, extra = { variant: 'v-a4', country: 'FR' }, path = '/api/checkout' } = {}) {
  const form = new FormData();
  form.set('meta', JSON.stringify({ seed, product, params, title, ...extra }));
  form.set('image', new Blob([image || (jpeg ? fakeJpeg : fakePng)(width, height)], { type: jpeg ? 'image/jpeg' : 'image/png' }), jpeg ? 'x.jpg' : 'x.png');
  if (captcha) form.set('cf-turnstile-response', captcha);
  const headers = { 'cf-connecting-ip': ip };
  if (origin) headers.origin = origin;
  return new Request(`https://w.example${path}`, { method: 'POST', body: form, headers });
}

const getJson = async (env, path, headers = {}) => (await worker.fetch(new Request(`https://w.example${path}`, { headers }), env)).json();
const checkout = async (env, opts) => (await worker.fetch(order(opts), env)).json();

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ', name); }
  catch (e) { console.error('  FAIL', name, '\n', e); process.exitCode = 1; }
}

function stripeEvent(env, orderId, { country = 'FR', paid = true, type = 'checkout.session.completed' } = {}) {
  const payload = JSON.stringify({
    type,
    data: { object: {
      id: 'cs_test_1',
      client_reference_id: orderId,
      payment_status: paid ? 'paid' : 'unpaid',
      amount_total: 5600,
      currency: 'eur',
      customer_details: { email: 'buyer@example.com', phone: '+33123456789', name: 'Camille Dupont' },
      collected_information: { shipping_details: { name: 'Camille Dupont-Martin', address: { line1: '12 rue de la Paix, Batiment B, Escalier 3', line2: null, city: 'Paris', state: null, postal_code: '75002', country } } },
    } },
  });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${t}.${payload}`).digest('hex');
  return { payload, header: `t=${t},v1=${v1}` };
}
const webhook = (env, { payload, header }) => worker.fetch(new Request('https://w.example/stripe/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': header } }), env);

/* ---------- what can be ordered ---------- */

await test('config lists the products that can be ordered', async () => {
  const cfg = await getJson(makeEnv(), '/api/config');
  assert.equal(cfg.enabled, true);
  assert.deepEqual(cfg.products, [{ id: 'poster', label: 'Art Print' }]);
  assert.ok(cfg.countries.includes('FR'));
  assert.equal(cfg.backendRender, false);
});

await test('ordering is off until it is switched on and Stripe and Gelato are set up', async () => {
  for (const extra of [{ DIRECT_ENABLED: 'false' }, { STRIPE_SECRET_KEY: '' }, { GELATO_API_KEY: '' }, { GELATO_TEMPLATES: '' }]) {
    const env = makeEnv(extra);
    const cfg = await getJson(env, '/api/config');
    assert.equal(cfg.enabled, false);
    assert.deepEqual(cfg.products, []);
    assert.equal((await checkout(env)).error, 'ordering_closed');
    assert.equal((await getJson(env, '/api/direct/options?product=poster&w=1754&h=2480&country=FR')).error, 'ordering_closed');
  }
});

await test('discover without a product lists what is configured and makes no call to Gelato', async () => {
  const env = makeEnv({ GELATO_TEMPLATES: JSON.stringify({
    poster: { templateId: 'tpl-poster', label: 'Art Print' },
    framed: { catalogUid: 'framed-posters', label: 'Framed print' },
  }) });
  calls.length = 0;
  const body = await getJson(env, '/admin/discover', { 'x-admin-key': 'secret-admin' });
  assert.deepEqual(body.products.map((p) => [p.id, p.look]), [['poster', '?product=poster'], ['framed', '?product=framed']]);
  assert.equal(body.gelato, undefined);
  assert.equal(calls.length, 0);
  assert.equal(body.direct.stripeMode, 'test');
});

await test('a live Stripe key is refused until it is allowed on purpose', async () => {
  const live = makeEnv({ STRIPE_SECRET_KEY: 'sk_live_abc' });
  assert.equal((await getJson(live, '/api/config')).enabled, false);
  assert.equal((await checkout(live)).error, 'ordering_closed');
  const body = await getJson(live, '/admin/discover', { 'x-admin-key': 'secret-admin' });
  assert.equal(body.direct.stripeMode, 'live');
  assert.equal(body.direct.stripe, false);
  const allowed = makeEnv({ STRIPE_SECRET_KEY: 'sk_live_abc', STRIPE_ALLOW_LIVE: 'true' });
  assert.equal((await getJson(allowed, '/api/config')).enabled, true);
  // anything that is not a Stripe key at all is not used either
  assert.equal((await getJson(makeEnv({ STRIPE_SECRET_KEY: 'whatever' }), '/api/config')).enabled, false);
});

await test('nothing of Etsy is left: those routes do not exist', async () => {
  const env = makeEnv();
  for (const [method, path] of [['GET', '/auth/login'], ['GET', '/auth/callback'], ['POST', '/api/listings'], ['GET', '/api/products/prod-12345678']]) {
    assert.equal((await worker.fetch(new Request(`https://w.example${path}`, { method }), env)).status, 404, path);
  }
});

await test('discover needs the admin key and shows what the template holds', async () => {
  const env = makeEnv();
  const body = await getJson(env, '/admin/discover?product=poster', { 'x-admin-key': 'secret-admin' });
  assert.equal(body.products, undefined);
  assert.equal(body.gelato.poster.variants.length, 6);
  assert.equal(body.gelato.poster.variants[0].printAreas[0], 'ImageFront 210 x 297');
  assert.equal(body.direct.stripe, true);
  assert.equal((await worker.fetch(new Request('https://w.example/admin/discover'), env)).status, 401);
});

/* ---------- sizes and prices ---------- */

await test('options list every variant that fits; the price of the chosen one is Gelato cost x markup', async () => {
  const env = makeEnv();
  const res = await getJson(env, '/api/direct/options?product=poster&w=1754&h=2480&country=FR', { origin: ORIGIN });
  assert.equal(res.currency, 'EUR');
  assert.equal(res.shipping, 6);
  // 1754 x 2480 (A format, portrait): A4, A3 and the framed A4 fit; A1 needs more pixels, the landscape and 3:4 are other shapes
  assert.deepEqual(res.variants.map((v) => v.id), ['v-a4', 'v-a3', 'v-a4-black']);
  assert.equal(res.variants[0].price, undefined); // no price per option: one is looked up for the one chosen
  assert.deepEqual(res.variants[0].size_mm, [210, 297]); // the print's size, for the preview
  assert.equal(res.variants[2].options[1].value, 'Black');
  const price = async (variant) => getJson(env, `/api/direct/price?product=poster&variant=${variant}&w=1754&h=2480&country=FR`);
  assert.deepEqual(await price('v-a4'), { currency: 'EUR', shipping: 6, price: 16 });
  assert.equal((await price('v-a3')).price, 24);
  assert.equal((await price('v-a4-black')).price, 50);
  assert.equal((await price('v-a1')).error, 'variant_not_available');
  assert.equal((await getJson(env, '/api/direct/price?product=poster&variant=v-a4&w=1754&h=2480&country=KP')).error, 'country_not_served');
  assert.equal((await getJson(env, '/api/direct/options?product=poster&w=1754&h=2480&country=KP')).error, 'country_not_served');
  assert.equal((await getJson(env, '/api/direct/options?product=nope&w=1754&h=2480&country=FR')).error, 'unknown_product');
});

await test('a painting too small for every size is refused, and MIN_DPI moves the line', async () => {
  // 900 x 1273 is an A-format painting, but too few pixels even for A4 at 150 dpi
  const strict = makeEnv();
  assert.equal((await getJson(strict, '/api/direct/options?product=poster&w=900&h=1273&country=FR')).error, 'image_too_small');
  assert.equal((await checkout(strict, { width: 900, height: 1273 })).error, 'image_too_small');
  // at 100 dpi it can carry A4
  const lenient = makeEnv({ MIN_DPI: '100' });
  const res = await getJson(lenient, '/api/direct/options?product=poster&w=900&h=1273&country=FR');
  assert.deepEqual(res.variants.map((v) => v.id), ['v-a4', 'v-a4-black']);
});

await test('a format that no size has is told apart from a painting that is too small', async () => {
  const env = makeEnv();
  // 1280 x 1920 is 2:3: the template has no 2:3 size at all, so more pixels would not help
  const res = await checkout(env, { width: 1280, height: 1920 });
  assert.equal(res.error, 'no_size_for_format');
  assert.equal(res.detail.format, '2x3');
  assert.equal((await getJson(env, '/api/direct/options?product=poster&w=1280&h=1920&country=FR')).error, 'no_size_for_format');
});

/* ---------- the payment page ---------- */

await test('checkout prices the order itself and opens a Stripe page for that country only', async () => {
  const env = makeEnv();
  calls.length = 0;
  // the browser claims a price: it is ignored
  const res = await worker.fetch(order({ extra: { variant: 'v-a4-black', country: 'FR', price: 1 } }), env);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  assert.equal(body.price, 50);
  assert.equal(body.shipping, 6);

  const stripe = calls.find((c) => c.url === 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(stripe.init.headers.authorization, 'Bearer sk_test_x');
  const f = new URLSearchParams(stripe.init.body);
  assert.equal(f.get('mode'), 'payment');
  assert.equal(f.get('line_items[0][price_data][unit_amount]'), '5000');
  assert.equal(f.get('line_items[0][price_data][currency]'), 'eur');
  assert.equal(f.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '600');
  assert.equal(f.get('shipping_address_collection[allowed_countries][0]'), 'FR');
  assert.equal(f.get('client_reference_id'), body.order_id);
  assert.match(f.get('line_items[0][price_data][product_data][name]'), /A4 - Black frame/);
  const record = JSON.parse(env.TOKENS.map.get(`order:${body.order_id}`));
  assert.equal(record.productUid, 'framed_a4_black');
  assert.equal(record.sent, null);
});

await test('checkout refuses a variant the painting cannot fill, and unserved countries', async () => {
  const env = makeEnv();
  const code = async (extra) => (await checkout(env, { extra })).error;
  assert.equal(await code({ variant: 'v-a1', country: 'FR' }), 'variant_not_available');
  assert.equal(await code({ variant: 'v-a4', country: 'KP' }), 'country_not_served');
  assert.equal(await code({ country: 'FR' }), 'bad_variant');
});

/* ---------- the print file ---------- */

await test('the print file is kept in KV and served by the Worker, as the PNG it was', async () => {
  const env = makeEnv();
  const { order_id: orderId } = await checkout(env);
  const record = JSON.parse(env.TOKENS.map.get(`order:${orderId}`));
  assert.match(record.fileUrl, /^https:\/\/w\.example\/files\/[a-f0-9]{40}\.png$/);
  const staged = await worker.fetch(new Request(record.fileUrl), env);
  assert.equal(staged.status, 200);
  assert.equal(staged.headers.get('content-type'), 'image/png');
  assert.equal((await worker.fetch(new Request(`https://w.example/files/${'0'.repeat(40)}.png`), env)).status, 404);
});

await test('a 300 dpi print file can be a JPEG: read, stored and served as one', async () => {
  const env = makeEnv();
  const { order_id: orderId } = await checkout(env, { jpeg: true });
  const record = JSON.parse(env.TOKENS.map.get(`order:${orderId}`));
  assert.match(record.fileUrl, /^https:\/\/w\.example\/files\/[a-f0-9]{40}\.jpg$/);
  const staged = await worker.fetch(new Request(record.fileUrl), env);
  assert.equal(staged.status, 200);
  assert.equal(staged.headers.get('content-type'), 'image/jpeg');
});

await test('the print file goes to GitHub when it is set up', async () => {
  const env = makeEnv({ GITHUB_REPO: 'Madstick/still-life-prints', GITHUB_TOKEN: 'ghp_x', GITHUB_DIR: 'prints' });
  calls.length = 0;
  const { order_id: orderId } = await checkout(env);
  const put = calls.find((c) => c.url.startsWith('https://api.github.com/repos/Madstick/still-life-prints/contents/prints/'));
  assert.equal(put.method, 'PUT');
  assert.equal(put.init.headers.authorization, 'Bearer ghp_x');
  const body = JSON.parse(put.init.body);
  assert.equal(body.branch, 'main');
  assert.ok(body.content.length > 100);
  const record = JSON.parse(env.TOKENS.map.get(`order:${orderId}`));
  assert.match(record.fileUrl, /^https:\/\/raw\.githubusercontent\.com\/Madstick\/still-life-prints\/main\/prints\/[a-f0-9]{40}\.png$/);
});

/* ---------- paid: Gelato ---------- */

await test('a paid checkout sends the order to Gelato, once, as a draft until you say otherwise', async () => {
  const env = makeEnv();
  const { order_id: orderId } = await checkout(env);

  calls.length = 0;
  const first = await webhook(env, stripeEvent(env, orderId));
  assert.equal(first.status, 200);
  const sent = JSON.parse(calls.find((c) => c.url === 'https://order.gelatoapis.com/v4/orders').init.body);
  assert.equal(sent.orderType, 'draft');
  assert.equal(sent.orderReferenceId, orderId);
  assert.equal(sent.currency, 'EUR');
  assert.equal(sent.items[0].productUid, 'flat_a4');
  assert.match(sent.items[0].files[0].url, /\/files\/[a-f0-9]{40}\.png$/);
  assert.equal(sent.shippingAddress.firstName, 'Camille');
  assert.equal(sent.shippingAddress.lastName, 'Dupont-Martin');
  assert.equal(sent.shippingAddress.country, 'FR');
  assert.equal(sent.shippingAddress.postCode, '75002');
  assert.equal(sent.shippingAddress.email, 'buyer@example.com');
  // an address line over 35 characters spills onto the second line instead of being cut
  assert.ok(sent.shippingAddress.addressLine1.length <= 35);
  assert.ok(sent.shippingAddress.addressLine2.length > 0);
  assert.equal((sent.shippingAddress.addressLine1 + ' ' + sent.shippingAddress.addressLine2).replace(/\s+/g, ' ').startsWith('12 rue de la Paix, Batiment B,'), true);

  // Stripe delivers the same event more than once: Gelato is told only once
  calls.length = 0;
  const again = await webhook(env, stripeEvent(env, orderId));
  assert.equal((await again.json()).duplicate, true);
  assert.equal(calls.length, 0);
});

await test('with GELATO_ORDER_TYPE=order the order really goes to print', async () => {
  const env = makeEnv({ GELATO_ORDER_TYPE: 'order', DIRECT_SHIPMENT_METHOD: 'express', RETURN_ADDRESS_JSON: '{"companyName":"Atelier","country":"FR"}' });
  const { order_id: orderId } = await checkout(env);
  calls.length = 0;
  await webhook(env, stripeEvent(env, orderId));
  const sent = JSON.parse(calls.find((c) => c.url === 'https://order.gelatoapis.com/v4/orders').init.body);
  assert.equal(sent.orderType, 'order');
  assert.equal(sent.shipmentMethodUid, 'express');
  assert.equal(sent.returnAddress.companyName, 'Atelier');
});

await test('webhooks need a genuine Stripe signature and ignore what is not a paid checkout', async () => {
  const env = makeEnv();
  const ev = stripeEvent(env, 'whatever');
  assert.equal((await webhook(env, { payload: ev.payload, header: 't=1,v1=bad' })).status, 400);
  assert.equal((await webhook(env, { payload: ev.payload.replace('Camille', 'Mallory'), header: ev.header })).status, 400);
  assert.equal((await worker.fetch(new Request('https://w.example/stripe/webhook', { method: 'POST', body: ev.payload }), env)).status, 400);
  const old = Math.floor(Date.now() / 1000) - 3600;
  const stale = `t=${old},v1=${createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${old}.${ev.payload}`).digest('hex')}`;
  assert.equal((await (await webhook(env, { payload: ev.payload, header: stale })).json()).error, 'signature_too_old');

  assert.equal((await (await webhook(env, stripeEvent(env, 'whatever', { paid: false }))).json()).ignored, 'not_paid_yet');
  assert.equal((await (await webhook(env, stripeEvent(env, 'whatever'))).json()).ignored, 'not_ours');
  assert.equal((await (await webhook(env, stripeEvent(env, 'whatever', { type: 'customer.created' }))).json()).ignored, 'customer.created');
});

await test('an address in another country than the one paid for is not sent to print', async () => {
  const env = makeEnv();
  const { order_id: orderId } = await checkout(env);
  const res = await webhook(env, stripeEvent(env, orderId, { country: 'US' }));
  assert.equal(res.status, 500); // Stripe will retry, and you see it in the logs
  assert.equal(JSON.parse(env.TOKENS.map.get(`order:${orderId}`)).sent, null);
});

/* ---------- the print file painted after the payment ---------- */

await test('backend render: ordered from the studio picture, painted after payment, sent to Gelato when the job calls back', async () => {
  const env = makeEnv({ RENDER_ENABLED: 'true', RENDER_SECRET: 'render-secret', GITHUB_REPO: 'Madstick/still-life-prints', GITHUB_TOKEN: 'ghp_x', SITE_URL: 'https://akiraishi.com' });
  // the config tells the shop it need not paint the print file itself
  const cfg = await getJson(env, '/api/config');
  assert.equal(cfg.backendRender, true);
  assert.equal(cfg.maxRenderPx, 7016);
  // a small studio canvas (840 x 1188, A format) is enough to order an A3: the sizes are judged at the render size
  const opts = await getJson(env, '/api/direct/options?product=poster&w=840&h=1188&country=FR', { origin: ORIGIN });
  assert.ok(opts.variants.some((v) => v.id === 'v-a3'));
  calls.length = 0;
  const res = await worker.fetch(order({ width: 840, height: 1188, extra: { variant: 'v-a3', country: 'FR' } }), env);
  assert.equal(res.status, 201);
  const { order_id: orderId } = await res.json();
  // nothing uploaded at checkout: the file does not exist yet
  assert.equal(calls.some((c) => c.url.includes('/contents/')), false);

  calls.length = 0;
  const paid = await (await webhook(env, stripeEvent(env, orderId))).json();
  assert.equal(paid.rendering, true);
  assert.equal(calls.some((c) => c.url === 'https://order.gelatoapis.com/v4/orders'), false); // Gelato waits for the file
  const dispatch = calls.find((c) => c.url === 'https://api.github.com/repos/Madstick/still-life-prints/dispatches');
  const job = JSON.parse(dispatch.init.body);
  assert.equal(job.event_type, 'render');
  const pl = job.client_payload;
  assert.equal(pl.order_id, orderId);
  assert.equal(pl.callback, 'https://w.example/render/done');
  assert.match(pl.path, /^prints\/[a-f0-9]{40}\.jpg$/);
  // A3's long side, 420 mm, at 300 dpi; the same seed and choices as the visitor's
  const u = new URL(pl.url);
  assert.equal(u.origin + u.pathname, 'https://akiraishi.com/still-life-code.html');
  assert.equal(u.searchParams.get('print'), '4961');
  assert.equal(u.searchParams.get('seed'), 'abc123xyz');
  assert.equal(u.searchParams.get('style'), 'water');
  // Stripe sends the event again: the job is not asked for twice
  calls.length = 0;
  assert.equal((await (await webhook(env, stripeEvent(env, orderId))).json()).duplicate, true);
  assert.equal(calls.length, 0);

  const done = (sig) => worker.fetch(new Request('https://w.example/render/done', { method: 'POST', body: JSON.stringify({ order_id: orderId, key: pl.key, sig }) }), env);
  // a call back that is not signed with the secret is refused
  assert.equal((await done('0'.repeat(64))).status, 403);
  const sig = createHmac('sha256', 'render-secret').update(`${orderId}:${pl.key}`).digest('hex');
  calls.length = 0;
  const ok1 = await done(sig);
  assert.equal(ok1.status, 200);
  const sent = JSON.parse(calls.find((c) => c.url === 'https://order.gelatoapis.com/v4/orders').init.body);
  assert.equal(sent.items[0].productUid, 'flat_a3');
  assert.equal(sent.items[0].files[0].url, `https://raw.githubusercontent.com/Madstick/still-life-prints/main/${pl.path}`);
  assert.equal(sent.shippingAddress.postCode, '75002');
  // the job may call back twice (a re-run): Gelato is told once
  calls.length = 0;
  assert.equal((await (await done(sig)).json()).duplicate, true);
  assert.equal(calls.length, 0);
});

/* ---------- direct, from the catalogue instead of a template ---------- */

const withCatalogue = (extra = {}) => makeEnv({
  GELATO_TEMPLATES: JSON.stringify({
    poster: { templateId: 'tpl-poster', label: 'Art Print' },
    framed: { catalogUid: 'framed-posters', label: 'Framed print' },
  }),
  ...extra,
});

await test('a catalogue and a template can both be offered', async () => {
  const cfg = await getJson(withCatalogue(), '/api/config');
  assert.deepEqual(cfg.products, [{ id: 'poster', label: 'Art Print' }, { id: 'framed', label: 'Framed print' }]);
});

await test('catalogue options are the live products of the right shape, in the country, named by what differs', async () => {
  const env = withCatalogue();
  const fr = await getJson(env, '/api/direct/options?product=framed&w=1754&h=2480&country=FR');
  // A1 is too big for the pixels, the landscape one has another shape, the archived and DE-only ones are out
  assert.deepEqual(fr.variants.map((v) => [v.id, v.label]), [
    ['fp_a4_black', 'A4 · Black'],
    ['fp_a4_white', 'A4 · White'],
    ['fp_a3_black', 'A3 · Black'],
  ]);
  // named for the visitor, size first
  assert.deepEqual(fr.variants[0].options, [{ name: 'Size', value: 'A4' }, { name: 'Frame colour', value: 'Black' }]);
  const price = await getJson(env, '/api/direct/price?product=framed&variant=fp_a3_black&w=1754&h=2480&country=FR');
  assert.equal(price.price, 80);

  const de = await getJson(env, '/api/direct/options?product=framed&w=1754&h=2480&country=DE');
  assert.ok(de.variants.some((v) => v.id === 'fp_a4_wood_de' && v.label === 'A4 · Natural wood'));
  assert.equal((await getJson(env, '/api/direct/options?product=framed&w=1280&h=1920&country=FR')).error, 'no_size_for_format');
});

await test('a catalogue whose lists arrive as objects keyed by id reads the same', async () => {
  globalThis.__objects = true;
  try {
    const env = withCatalogue();
    const fr = await getJson(env, '/api/direct/options?product=framed&w=1754&h=2480&country=FR');
    assert.deepEqual(fr.variants.map((v) => [v.id, v.label]), [
      ['fp_a4_black', 'A4 · Black'], ['fp_a4_white', 'A4 · White'], ['fp_a3_black', 'A3 · Black'],
    ]);
    const body = await getJson(env, '/admin/discover?product=framed', { 'x-admin-key': 'secret-admin' });
    assert.equal(body.gelato.framed.products, 7);
    assert.deepEqual(body.gelato.framed.attributes.map((a) => a.uid), ['PaperFormat', 'FrameColor']);
  } finally {
    globalThis.__objects = false;
  }
});

await test('attributes that always change together are shown once, and technical ones are not a choice', async () => {
  const { describeProducts } = await import('../src/listing.js');
  const catalog = { productAttributes: [
    { productAttributeUid: 'PaperFormat', title: 'PaperFormat', values: [{ productAttributeValueUid: 'A4', title: 'A4' }, { productAttributeValueUid: 'A3', title: 'A3' }] },
    { productAttributeUid: 'UnifiedPaperFormat', title: 'UnifiedPaperFormat', values: [{ productAttributeValueUid: 'a4-8x12', title: '21 x 30 cm / 8 x 12 in' }, { productAttributeValueUid: 'a3-12x16', title: '30 x 42 cm / 12 x 16 in' }] },
    { productAttributeUid: 'FrameColor', title: 'FrameColor', values: [{ productAttributeValueUid: 'black', title: 'Black' }, { productAttributeValueUid: 'white', title: 'White' }] },
  ] };
  const mk = (uid, fmt, unified, color, model) => ({
    productUid: uid,
    attributes: { PaperFormat: fmt, UnifiedPaperFormat: unified, FrameColor: color, ProductModel: model },
    dimensions: { Width: { value: 210 }, Height: { value: 297 } },
  });
  const names = describeProducts(catalog, [
    mk('p1', 'A4', 'a4-8x12', 'black', 'one'), mk('p2', 'A4', 'a4-8x12', 'white', 'two'),
    mk('p3', 'A3', 'a3-12x16', 'black', 'one'), mk('p4', 'A3', 'a3-12x16', 'white', 'two'),
  ]);
  assert.equal(names.get('p1').title, '21 x 30 cm / 8 x 12 in · Black');
  assert.deepEqual(names.get('p4').options, [{ name: 'Size', value: '30 x 42 cm / 12 x 16 in' }, { name: 'Frame colour', value: 'White' }]);
});

await test('the print area is read from the format, not from the size of the frame or the hanger', async () => {
  const { printAreaMm, fittingProducts, describeProducts, parseFormat } = await import('../src/listing.js');
  assert.deepEqual(parseFormat('200x250-mm-8x10-inch'), [200, 250]);
  assert.deepEqual(parseFormat('a4-8x12-inch'), [210, 297]);
  assert.deepEqual(parseFormat('XL-280x430-mm'), [280, 430]);
  assert.deepEqual(parseFormat('8x10-inch'), [203.2, 254]);
  assert.equal(parseFormat('flat_product'), null);

  // a framed canvas: the object is bigger than the picture, and turned to landscape
  const canvas = { productUid: 'fc', attributes: { UnifiedCanvasFormat: '200x250-mm-8x10-inch', Orientation: 'hor', ProductStatus: 'activated' },
    dimensions: { Width: { value: 302 }, Height: { value: 252 } } };
  assert.deepEqual(printAreaMm(canvas), [250, 200]);
  // a poster with a hanger: 1010 wide for a 700 x 1000 print
  const hanger = { productUid: 'hp', attributes: { UnifiedPaperFormat: '700x1000-mm-28x40-inch', Orientation: 'ver', ProductStatus: 'activated' },
    dimensions: { Width: { value: 733.2 }, Height: { value: 1010 } } };
  assert.deepEqual(printAreaMm(hanger), [700, 1000]);
  // so a 4:5 painting fits the canvas (20 x 25) and not the hanger poster (7:10)
  const env = { MIN_DPI: '100' };
  const painting = { width: 1600, height: 2000 };
  // the landscape one is another shape than a portrait painting
  assert.throws(() => fittingProducts(env, [canvas], painting, null), (e) => e.code === 'no_size_for_format');
  assert.equal(fittingProducts(env, [{ ...canvas, attributes: { ...canvas.attributes, Orientation: 'ver' } }], painting, null).length, 1);
  assert.throws(() => fittingProducts(env, [hanger], painting, null), (e) => e.code === 'no_size_for_format');
  // a size with no readable title is written out
  const names = describeProducts({ productAttributes: [] }, [
    { productUid: 'a', attributes: { UnifiedPaperFormat: '200x250-mm-8x10-inch', FrameColor: 'black' }, dimensions: { Width: { value: 200 }, Height: { value: 250 } } },
    { productUid: 'b', attributes: { UnifiedPaperFormat: '300x400-mm-12x16-inch', FrameColor: 'white' }, dimensions: { Width: { value: 300 }, Height: { value: 400 } } },
  ]);
  assert.equal(names.get('a').options[0].value, '20 × 25 cm / 8 × 10 in');
});

await test('a catalogue product is paid for and sent to Gelato like any other', async () => {
  const env = withCatalogue();
  const res = await checkout(env, { product: 'framed', extra: { variant: 'fp_a3_black', country: 'FR' } });
  assert.equal(res.price, 80);
  const record = JSON.parse(env.TOKENS.map.get(`order:${res.order_id}`));
  assert.equal(record.productUid, 'fp_a3_black');

  calls.length = 0;
  await webhook(env, stripeEvent(env, res.order_id));
  const sent = JSON.parse(calls.find((c) => c.url === 'https://order.gelatoapis.com/v4/orders').init.body);
  assert.equal(sent.items[0].productUid, 'fp_a3_black');

  // a product the painting cannot have is refused
  const code = async (variant) => (await checkout(env, { product: 'framed', extra: { variant, country: 'FR' } })).error;
  assert.equal(await code('fp_a1_black'), 'variant_not_available');
  assert.equal(await code('fp_a4_wood_de'), 'variant_not_available');
});

await test('discover shows a catalogue\'s attributes and a sample, to write the filters from', async () => {
  const body = await getJson(withCatalogue(), '/admin/discover?product=framed', { 'x-admin-key': 'secret-admin' });
  // the full list of Gelato's catalogues only on request
  assert.equal(body.catalogs, undefined);
  const all = await getJson(withCatalogue(), '/admin/discover?all=1&product=framed', { 'x-admin-key': 'secret-admin' });
  assert.deepEqual(all.catalogs.map((c) => c.catalogUid), ['posters', 'framed-posters']);
  assert.equal(body.gelato.framed.products, 7);
  assert.deepEqual(body.gelato.framed.attributes.map((a) => a.uid), ['PaperFormat', 'FrameColor']);
  assert.equal(body.gelato.framed.sample[0].productUid, 'fp_a4_black');
  assert.equal(body.gelato.framed.sample[0].size_mm, '210 x 297');
});

/* ---------- abuse limits ---------- */

await test('requests from other sites are refused', async () => {
  const env = makeEnv();
  assert.equal((await worker.fetch(order({ origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await worker.fetch(order({ origin: null }), env)).status, 403);
});

await test('only real PNGs or JPEGs of a studio format get through, with clean settings', async () => {
  const env = makeEnv();
  const code = async (opts) => (await checkout(env, opts)).error;
  assert.equal(await code({ image: new TextEncoder().encode('<html>not a png</html>'.padEnd(80, ' ')) }), 'not_an_image');
  assert.equal(await code({ image: FAKE_JPEG }), 'not_an_image'); // a JPEG with no frame: no size to read
  assert.equal(await code({ jpeg: true, width: 900, height: 700 }), 'unknown_format');
  assert.equal(await code({ width: 900, height: 700 }), 'unknown_format');
  assert.equal(await code({ seed: 'bad seed!' }), 'bad_seed');
  assert.equal(await code({ product: 'Bad Product' }), 'bad_product');
  assert.equal(await code({ params: { style: 'x y' } }), 'bad_param');
  assert.equal(await code({ product: 'nothing-here' }), 'unknown_product');
});

await test('one visitor cannot fill the shop, and the whole shop has a daily ceiling', async () => {
  const env = makeEnv();
  for (let i = 0; i < 3; i++) assert.equal((await worker.fetch(order({ seed: `seed${i}aa`, ip: '9.9.9.9' }), env)).status, 201);
  const res = await worker.fetch(order({ seed: 'seed9zz', ip: '9.9.9.9' }), env);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'too_many_from_you');
  assert.equal((await worker.fetch(order({ seed: 'seed9zz', ip: '8.8.8.8' }), env)).status, 201);

  const small = makeEnv({ MAX_PER_DAY: '2' });
  assert.equal((await worker.fetch(order({ seed: 'dayaaa', ip: '1.0.0.1' }), small)).status, 201);
  assert.equal((await worker.fetch(order({ seed: 'daybbb', ip: '1.0.0.2' }), small)).status, 201);
  assert.equal((await checkout(small, { seed: 'daycc1', ip: '1.0.0.3' })).error, 'too_many_today');
});

await test('Turnstile is enforced when configured', async () => {
  const env = makeEnv({ TURNSTILE_SECRET: 's' });
  assert.equal((await checkout(env)).error, 'captcha_missing');
  assert.equal((await checkout(env, { captcha: 'bad' })).error, 'captcha_failed');
  assert.equal((await worker.fetch(order({ captcha: 'good' }), env)).status, 201);
});

await test('CORS only answers listed origins', async () => {
  const env = makeEnv();
  const ok = await worker.fetch(new Request('https://w.example/api/config', { headers: { origin: ORIGIN } }), env);
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const no = await worker.fetch(new Request('https://w.example/api/config', { headers: { origin: 'https://evil.example' } }), env);
  assert.equal(no.headers.get('access-control-allow-origin'), null);
  const pre = await worker.fetch(new Request('https://w.example/api/checkout', { method: 'OPTIONS', headers: { origin: ORIGIN } }), env);
  assert.equal(pre.status, 204);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
