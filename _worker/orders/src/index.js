// Still Life Code → Gelato
//
// A visitor buys the print of the painting they made, on this site: Stripe takes the payment,
// Gelato prints, frames and ships it.
//
//   GET  /api/config          public: what can be ordered, whether ordering is switched on
//   GET  /api/direct/options  public: sizes, frames and papers a painting can have, for a country
//   GET  /api/direct/price    public: the price of the one the visitor chose
//   POST /api/checkout        public: the studio sends a painting, a Stripe payment page comes back
//   POST /stripe/webhook      Stripe tells us a payment went through
//   POST /render/done         the GitHub job has painted a print file (signed with RENDER_SECRET)
//   GET  /files/:key.png|jpg  the print file, when it is kept in KV rather than on GitHub
//   GET  /admin/discover      you, during setup: what the Gelato templates and catalogues hold
//
// Pictures go straight through. Only a few counters, order records and (if GitHub is not set up)
// the print files live in KV.

import { HttpError, asArray } from './util.js';
import { catalogFilters, getCatalog, getTemplate, gelatoProducts, listCatalogs, searchCatalog } from './gelato.js';
import { directCountries, directOptions, directPrice, finishRender, handleStripeEvent, startCheckout } from './direct.js';
import { checkRenderSignature, maxRenderPx, renderCap, renderEnabled } from './render.js';
import { minDpi, ratioKeyFor } from './formats.js';
import { QUIET, describeProducts, fileKey, parseMeta, printAreaMm, readImage } from './listing.js';
import { readStagedFile, stageFile } from './store.js';
import { stripeConfigured, stripeMode, verifyWebhook } from './stripe.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      let response;
      const route = `${request.method} ${url.pathname}`;
      const file = /^GET \/files\/([a-f0-9]{40})\.(png|jpg)$/.exec(route);

      if (file) {
        response = await handleFile(env, file[1], file[2]);
      } else {
        switch (route) {
          case 'GET /':
          case 'GET /health':
            response = json({ ok: true });
            break;
          case 'GET /api/config':
            response = handleConfig(env);
            break;
          case 'GET /api/direct/options':
            response = await handleDirectOptions(url, env);
            break;
          case 'GET /api/direct/price':
            response = await handleDirectPrice(url, env);
            break;
          case 'POST /api/checkout':
            response = await handleCheckout(request, env, url);
            break;
          case 'POST /stripe/webhook':
            response = await handleWebhook(request, env, url);
            break;
          case 'POST /render/done':
            response = await handleRenderDone(request, env);
            break;
          case 'GET /admin/discover':
            response = await handleDiscover(request, url, env);
            break;
          default:
            throw new HttpError(404, 'not_found');
        }
      }
      for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
      return response;
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (!(err instanceof HttpError)) console.error(err);
      else if (status >= 500) console.error(err.code, JSON.stringify(err.detail || ''));
      const body = { error: err instanceof HttpError ? err.code : 'server_error' };
      // The other services' own error text is for the owner's logs, not for visitors
      if (err instanceof HttpError && status < 500 && err.detail !== undefined) body.detail = err.detail;
      return json(body, status, cors);
    }
  },
};

/* ============================================
   helpers
   ============================================ */

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function requireOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(env).includes(origin)) throw new HttpError(403, 'origin_not_allowed');
}

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function requireAdmin(request, url, env) {
  const given = request.headers.get('x-admin-key') || url.searchParams.get('key') || '';
  if (!env.ADMIN_KEY || !timingSafeEqual(given, env.ADMIN_KEY)) throw new HttpError(401, 'unauthorised');
}

async function sha(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

const today = () => new Date().toISOString().slice(0, 10);

/* ============================================
   what can be ordered
   ============================================ */

const on = (v) => String(v) === 'true';

// Each product a visitor can have printed on, when ordering is switched on and set up
function catalogue(env) {
  if (!env.GELATO_API_KEY || !on(env.DIRECT_ENABLED) || !stripeConfigured(env)) return [];
  return Object.entries(gelatoProducts(env))
    .filter(([, def]) => def && (def.templateId || def.catalogUid))
    .map(([id, def]) => ({ id, label: def.label || id }));
}

function pickProduct(env, id) {
  const found = catalogue(env).find((p) => p.id === id);
  if (!found) throw new HttpError(404, 'unknown_product');
  return found;
}

function handleConfig(env) {
  const products = catalogue(env);
  return json(
    {
      enabled: products.length > 0,
      currency: env.CURRENCY || 'EUR',
      minDpi: minDpi(env),
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
      // the print file is painted after the payment, up to this long side; the studio picture is enough
      backendRender: renderEnabled(env),
      maxRenderPx: renderEnabled(env) ? maxRenderPx(env) : null,
      countries: directCountries(env),
      products,
    },
    200,
    { 'cache-control': 'public, max-age=60' },
  );
}

/* ============================================
   checks for the ordering endpoint
   ============================================ */

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return;
  if (!token) throw new HttpError(403, 'captcha_missing');
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip || '' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.success) throw new HttpError(403, 'captcha_failed');
}

// A soft limit: KV is not atomic, so a burst can overshoot by a few. Good enough to stop
// a script from filling the shop; use a Durable Object if it ever has to be exact.
async function spend(env, key, limit) {
  const used = Number(await env.TOKENS.get(key)) || 0;
  if (used >= limit) return false;
  await env.TOKENS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}

// Looks at the day's allowance and, if there is some left, hands back a function that uses one up: an order that
// fails validation, or that Stripe refuses, costs the visitor nothing.
async function limits(env, ip) {
  const perIp = Number(env.MAX_PER_IP_PER_DAY) || 10;
  const perDay = Number(env.MAX_PER_DAY) || 100;
  const ipKey = `rl:ip:${await sha(ip)}:${today()}`;
  const allKey = `rl:all:${today()}`;
  if ((Number(await env.TOKENS.get(ipKey)) || 0) >= perIp) throw new HttpError(429, 'too_many_from_you');
  if ((Number(await env.TOKENS.get(allKey)) || 0) >= perDay) throw new HttpError(429, 'too_many_today');
  return async () => {
    await spend(env, ipKey, perIp);
    await spend(env, allKey, perDay);
  };
}

// Reads the form an order arrives in: meta, the painting, a human check
async function readOrder(request, env) {
  requireOrigin(request, env);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const form = await request.formData().catch(() => null);
  if (!form) throw new HttpError(400, 'bad_form');

  await verifyTurnstile(env, form.get('cf-turnstile-response'), ip);

  const meta = parseMeta(form.get('meta'));
  const file = form.get('image');
  if (!file || typeof file === 'string') throw new HttpError(400, 'image_missing');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = readImage(bytes, (Number(env.MAX_IMAGE_MB) || 25) * 1024 * 1024);
  return { ip, meta, bytes, image };
}

/* ============================================
   sizes, then payment, then Gelato
   ============================================ */

async function handleDirectOptions(url, env) {
  if (!catalogue(env).length) throw new HttpError(503, 'ordering_closed');
  const width = Number(url.searchParams.get('w'));
  const height = Number(url.searchParams.get('h'));
  const country = String(url.searchParams.get('country') || '').toUpperCase();
  const productId = String(url.searchParams.get('product') || '');
  if (!(width > 0 && height > 0) || !ratioKeyFor(width, height)) throw new HttpError(422, 'unknown_format');
  pickProduct(env, productId);

  const size = renderEnabled(env) ? renderCap(env, { width, height }) : { width, height };
  const options = await directOptions(env, { product: productId, ...size, country });
  return json(options, 200, { 'cache-control': 'public, max-age=300' });
}

async function handleDirectPrice(url, env) {
  if (!catalogue(env).length) throw new HttpError(503, 'ordering_closed');
  const width = Number(url.searchParams.get('w'));
  const height = Number(url.searchParams.get('h'));
  const country = String(url.searchParams.get('country') || '').toUpperCase();
  const productId = String(url.searchParams.get('product') || '');
  const variant = String(url.searchParams.get('variant') || '');
  if (!(width > 0 && height > 0) || !ratioKeyFor(width, height)) throw new HttpError(422, 'unknown_format');
  pickProduct(env, productId);

  const size = renderEnabled(env) ? renderCap(env, { width, height }) : { width, height };
  const out = await directPrice(env, { product: productId, variant, ...size, country });
  return json(out, 200, { 'cache-control': 'public, max-age=300' });
}

async function handleCheckout(request, env, url) {
  if (!catalogue(env).length) throw new HttpError(503, 'ordering_closed');
  const { ip, meta, bytes, image } = await readOrder(request, env);
  pickProduct(env, meta.product);
  const used = await limits(env, ip);

  // With the backend render the picture sent is only the studio's: it gives the shape, and the file comes later
  if (renderEnabled(env)) {
    const started = await startCheckout(env, { meta, image: renderCap(env, image), fileUrl: null });
    await used();
    return json(started, 201);
  }
  const fileUrl = await stageFile(env, await fileKey(meta, image), bytes, url.origin, image.ext);
  const out = await startCheckout(env, { meta, image, fileUrl });
  await used();
  return json(out, 201);
}

async function handleRenderDone(request, env) {
  if (!renderEnabled(env)) throw new HttpError(503, 'render_off');
  const body = await request.json().catch(() => ({}));
  const orderId = String(body.order_id || '');
  const key = String(body.key || '');
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(orderId) || !/^[a-f0-9]{40}$/.test(key)) throw new HttpError(400, 'bad_render');
  if (!(await checkRenderSignature(env, orderId, key, body.sig))) throw new HttpError(403, 'bad_signature');
  return json(await finishRender(env, orderId, key));
}

async function handleWebhook(request, env, url) {
  if (!stripeConfigured(env)) throw new HttpError(503, 'ordering_closed');
  const raw = await request.text();
  const event = await verifyWebhook(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  // A failure here answers 5xx on purpose: Stripe retries for days, so a payment is never lost
  const outcome = await handleStripeEvent(env, event, url.origin);
  return json({ received: true, ...outcome });
}

/* ============================================
   the print file, when it lives in KV
   ============================================ */

async function handleFile(env, key, ext) {
  const bytes = await readStagedFile(env, key, ext);
  if (!bytes) throw new HttpError(404, 'not_found');
  return new Response(bytes, {
    headers: { 'content-type': ext === 'jpg' ? 'image/jpeg' : 'image/png', 'cache-control': 'public, max-age=31536000, immutable' },
  });
}

/* ============================================
   GET /admin/discover
   What the Gelato templates and catalogues hold, to write wrangler.toml from.
   ============================================ */

const peek = (v, n = 500) => {
  try {
    return JSON.stringify(v).slice(0, n);
  } catch {
    return String(v).slice(0, n);
  }
};

async function discoverGelato(env, only) {
  const out = {};
  for (const [id, def] of Object.entries(gelatoProducts(env))) {
    if (only && only !== 'all' && only !== id) continue;
    // what Gelato sent, kept for the error line if something is not as expected
    const seen = {};
    try {
      if (def.catalogUid) {
        const catalog = await getCatalog(env, def.catalogUid);
        seen.catalog = peek({ ...catalog, productAttributes: asArray(catalog.productAttributes).slice(0, 2) });
        const products = asArray(await searchCatalog(env, def.catalogUid, catalogFilters(catalog, def)));
        seen.firstProduct = peek(products[0]);
        seen.productCount = products.length;
        const flat = products.filter((p) => p && printAreaMm(p));
        const names = describeProducts(catalog, flat.slice(0, 200));
        out[id] = {
          catalogUid: def.catalogUid,
          title: catalog.title,
          // the choices a visitor is given, and the values each can take (the first few): the ones that do not vary,
          // and the technical ones, are left out. A "filters" entry can use any attribute name shown here.
          attributes: asArray(catalog.productAttributes)
            .map((a) => ({ uid: a.productAttributeUid, values: asArray(a.values).map((v) => v.productAttributeValueUid) }))
            .filter((a) => a.values.length > 1 && !QUIET.has(a.uid))
            .map((a) => ({ uid: a.uid, values: a.values.slice(0, 10), count: a.values.length })),
          products: products.length,
          withSize: flat.length,
          // the sizes there are, in millimetres, smallest first
          sizes_mm: [...new Set(flat
            .map((p) => printAreaMm(p))
            .map(([w, h]) => `${Math.round(Math.min(w, h))} x ${Math.round(Math.max(w, h))}`))]
            .sort((a, b) => parseInt(a, 10) * parseInt(a.split(' x ')[1], 10) - parseInt(b, 10) * parseInt(b.split(' x ')[1], 10))
            .slice(0, 24),
          sample: flat.slice(0, 3).map((p) => ({
            productUid: p.productUid,
            size_mm: printAreaMm(p).map((n) => Math.round(n * 10) / 10).join(' x '),
            label: (names.get(p.productUid) || {}).title,
          })),
        };
        // products that came with no size are not offered: say so rather than leave an empty list
        if (products.length && !flat.length) out[id].note = 'no product has dimensions.Width and dimensions.Height';
        continue;
      }
      const t = await getTemplate(env, def.templateId);
      out[id] = {
        templateId: def.templateId,
        title: t.title,
        variants: asArray(t.variants).map((v) => ({
          id: v.id,
          title: v.title,
          productUid: v.productUid,
          options: v.variantOptions,
          // the Worker reads these as millimetres: check they look like it
          printAreas: asArray(v.imagePlaceholders).map((a) => `${a.name} ${a.width} x ${a.height}`),
        })),
      };
    } catch (e) {
      out[id] = {
        error: e.detail || e.code || String((e && e.message) || e),
        at: String((e && e.stack) || '').split('\n').slice(1, 4).map((l) => l.trim()),
        seen,
      };
    }
  }
  return out;
}

async function handleDiscover(request, url, env) {
  requireAdmin(request, url, env);
  const out = {};
  if (env.GELATO_API_KEY) {
    // every catalogue Gelato has (cards, clothes, mugs...) only when asked for with ?all=1: the name of one to
    // add goes in GELATO_TEMPLATES as "catalogUid"
    if (url.searchParams.get('all') === '1') {
      try {
        out.catalogs = await listCatalogs(env);
      } catch (e) {
        out.catalogs = { error: e.detail || e.code || String((e && e.message) || e) };
      }
    }
    // One product per call (?product=framed): a Worker may only make so many calls, and each catalogue is read
    // page by page. ?product=all tries them all in one go, which only works once they are cached.
    const only = url.searchParams.get('product');
    if (only) {
      out.gelato = await discoverGelato(env, only);
    } else {
      out.products = Object.entries(gelatoProducts(env)).map(([id, def]) => ({
        id, label: def.label || id, catalogUid: def.catalogUid || null, templateId: def.templateId || null,
        look: `?product=${id}`,
      }));
    }
  }
  out.direct = {
    stripe: stripeConfigured(env),
    // test: orders are tests. live: refused until STRIPE_ALLOW_LIVE is "true". null: no key.
    stripeMode: stripeMode(env),
    backendRender: renderEnabled(env),
    countries: directCountries(env),
  };
  return json(out);
}
