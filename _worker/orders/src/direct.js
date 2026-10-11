// Buying a print on this site.
//
//   1. the visitor picks a size and frame (variants of a Gelato template) and a country
//   2. the Worker prices it from what Gelato charges you, plus your markup and shipping
//   3. Stripe Checkout takes the payment and the delivery address
//   4. Stripe tells the Worker it was paid; the Worker sends the order to Gelato, which
//      prints, frames and ships it
//      (with the backend render on, see render.js: the print file is painted first, by a GitHub job,
//      and the order goes to Gelato when the job calls back)
//
// Gelato bills you, not the customer, so the payment has to be collected somewhere: here, Stripe.

import { HttpError, randomToken } from './util.js';
import { catalogFilters, createOrder, getCatalog, getTemplate, gelatoProducts, productCost, searchCatalog } from './gelato.js';
import { describeProducts, fileKey, fittingProducts, fittingVariants, printAreaMm } from './listing.js';
import { dispatchRender, plannedFile, renderPxFor, studioUrl } from './render.js';
import { createCheckoutSession, shippingOf } from './stripe.js';

const ORDER_TTL = 60 * 60 * 24 * 45;
const MAX_VARIANTS = 300; // options listed; a price is only looked up for the one chosen

export const DEFAULT_COUNTRIES = ['FR', 'BE', 'DE', 'ES', 'IT', 'NL', 'PT', 'AT', 'IE', 'LU', 'GB', 'US', 'CA', 'AU'];

export function directCountries(env) {
  const list = String(env.DIRECT_COUNTRIES || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  return list.length ? list : DEFAULT_COUNTRIES;
}

function markup(env) {
  const n = Number(env.DIRECT_MARKUP);
  return n >= 1 ? n : 2;
}

// DIRECT_SHIPPING_JSON = {"FR": 6, "DE": 8, "US": 14, "default": 12}
export function shippingPrice(env, country) {
  let table = {};
  try {
    table = env.DIRECT_SHIPPING_JSON ? JSON.parse(env.DIRECT_SHIPPING_JSON) : {};
  } catch { /* fall through to the default */ }
  const n = Number(table[country] ?? table.default ?? 9);
  return n >= 0 ? n : 9;
}

const retail = (env, cost) => Math.ceil(cost * markup(env));
const cents = (amount) => Math.round(amount * 100);

function productDef(env, product) {
  const def = gelatoProducts(env)[product];
  if (!def || !(def.templateId || def.catalogUid)) throw new HttpError(404, 'unknown_product');
  return def;
}

// Everything a painting could be printed on for one product, whichever way it is defined:
// a template (sizes and frames you built in Gelato) or a catalogue (what Gelato makes, filtered)
async function choices(env, def, image, country) {
  if (def.catalogUid) {
    const catalog = await getCatalog(env, def.catalogUid);
    const filters = catalogFilters(catalog, def);
    const products = await searchCatalog(env, def.catalogUid, filters);
    const cap = Math.min(Number(def.maxOptions) || MAX_VARIANTS, MAX_VARIANTS);
    const fit = fittingProducts(env, products, image, country).slice(0, cap);
    const names = describeProducts(catalog, fit);
    const seen = new Set();
    return fit.map((p) => ({
      id: p.productUid,
      productUid: p.productUid,
      title: names.get(p.productUid).title,
      variantOptions: names.get(p.productUid).options,
      mm: printAreaMm(p),
    })).filter((v) => {
      const sig = JSON.stringify(v.variantOptions);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }

  const template = await getTemplate(env, def.templateId);
  return fittingVariants(env, template, image).slice(0, MAX_VARIANTS).map((v) => ({
    id: v.id,
    productUid: v.productUid,
    title: v.title,
    variantOptions: v.variantOptions || [],
    mm: (v.imagePlaceholders || []).flatMap((a) => [a.width, a.height]).filter(Boolean),
  }));
}

/* ---------- 1-2. the choices and their prices ---------- */

export async function directOptions(env, { product, width, height, country }) {
  if (!directCountries(env).includes(country)) throw new HttpError(422, 'country_not_served');
  const def = productDef(env, product);
  const variants = await choices(env, def, { width, height }, country);
  const currency = String(env.CURRENCY || 'EUR').toUpperCase();

  // No prices here: with a frame in four colours and a dozen sizes there are hundreds, and a visitor
  // looks at one. The price of the chosen one comes from directPrice.
  return {
    currency,
    shipping: shippingPrice(env, country),
    variants: variants.map((v) => ({
      id: v.id,
      label: v.title,
      options: v.variantOptions,
      // width and height of the print, for the preview
      size_mm: (v.mm || []).slice(0, 2).map((n) => Math.round(Number(n) * 10) / 10),
    })),
  };
}

export async function directPrice(env, { product, variant, width, height, country }) {
  if (!directCountries(env).includes(country)) throw new HttpError(422, 'country_not_served');
  const def = productDef(env, product);
  const found = (await choices(env, def, { width, height }, country)).find((v) => v.id === variant);
  if (!found) throw new HttpError(422, 'variant_not_available');
  const currency = String(env.CURRENCY || 'EUR').toUpperCase();
  return {
    currency,
    shipping: shippingPrice(env, country),
    price: retail(env, await productCost(env, found.productUid, country, currency)),
  };
}

/* ---------- 3. the payment page ---------- */

export async function startCheckout(env, { meta, image, fileUrl }) {
  const country = meta.country;
  if (!directCountries(env).includes(country)) throw new HttpError(422, 'country_not_served');
  if (!meta.variant) throw new HttpError(400, 'bad_variant');

  const def = productDef(env, meta.product);
  const variant = (await choices(env, def, image, country)).find((v) => v.id === meta.variant);
  if (!variant) throw new HttpError(422, 'variant_not_available');

  const currency = String(env.CURRENCY || 'EUR').toUpperCase();
  // The price is worked out here, never taken from the browser
  const price = retail(env, await productCost(env, variant.productUid, country, currency));
  const shipping = shippingPrice(env, country);

  const orderId = randomToken(12);
  // No file yet (backend render): the size this print needs at the print resolution, and where the job will put it
  let render = null;
  if (!fileUrl) {
    const px = renderPxFor(env, variant.mm);
    const key = await fileKey(meta, { width: px, height: 'render' });
    const file = plannedFile(env, key);
    render = { px, key, path: file.path, url: studioUrl(env, meta, px) };
    fileUrl = file.url;
  }
  await env.TOKENS.put(`order:${orderId}`, JSON.stringify({
    orderId,
    productUid: variant.productUid,
    variantTitle: variant.title,
    fileUrl,
    render,
    seed: meta.seed,
    title: meta.title,
    country,
    currency,
    price,
    shipping,
    createdAt: new Date().toISOString(),
    sent: null,
  }), { expirationTtl: ORDER_TTL });

  const site = env.SITE_URL.replace(/\/$/, '');
  const name = `${meta.title} (${def.label || meta.product}, ${variant.title})`.slice(0, 250);

  const session = await createCheckoutSession(env, {
    mode: 'payment',
    client_reference_id: orderId,
    metadata: { order_id: orderId },
    success_url: `${site}/shop.html?order=thanks#atelier`,
    cancel_url: `${site}/shop.html#atelier`,
    phone_number_collection: { enabled: true },
    shipping_address_collection: { allowed_countries: [country] },
    shipping_options: [{
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: 'Delivery',
        fixed_amount: { amount: cents(shipping), currency: currency.toLowerCase() },
      },
    }],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: cents(price),
        product_data: {
          name,
          description: 'Made to order and shipped from a print partner near you. One-of-a-kind painting by Still Life Code.',
        },
      },
    }],
  });

  return { url: session.url, order_id: orderId, price, shipping, currency };
}

/* ---------- 4. paid: send it to Gelato ---------- */

// Gelato caps address lines at 35 characters; overflow moves to the second line instead of being cut
function splitLine(line1, line2) {
  const a = String(line1 || '');
  if (a.length <= 35) return [a, String(line2 || '').slice(0, 35)];
  const cut = a.lastIndexOf(' ', 35);
  const at = cut > 10 ? cut : 35;
  return [a.slice(0, at), `${a.slice(at).trim()} ${line2 || ''}`.trim().slice(0, 35)];
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  const first = (parts.shift() || 'Customer').slice(0, 25);
  const last = (parts.join(' ') || first).slice(0, 25);
  return [first, last];
}

async function shortHash(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export function gelatoOrderBody(env, record, session, ship) {
  const [firstName, lastName] = splitName(ship.name);
  const [addressLine1, addressLine2] = splitLine(ship.address.line1, ship.address.line2);

  const body = {
    // Until you are ready to print for real, orders are only drafts you confirm in Gelato's dashboard
    orderType: String(env.GELATO_ORDER_TYPE) === 'order' ? 'order' : 'draft',
    orderReferenceId: record.orderId,
    customerReferenceId: record.customerReferenceId,
    currency: record.currency,
    items: [{
      itemReferenceId: '1',
      productUid: record.productUid,
      files: [{ type: 'default', url: record.fileUrl }],
      quantity: 1,
    }],
    shipmentMethodUid: env.DIRECT_SHIPMENT_METHOD || 'normal',
    shippingAddress: {
      firstName,
      lastName,
      addressLine1,
      ...(addressLine2 ? { addressLine2 } : {}),
      city: ship.address.city || '',
      ...(ship.address.state ? { state: ship.address.state } : {}),
      postCode: ship.address.postal_code || '',
      country: ship.address.country,
      email: ship.email,
      ...(ship.phone ? { phone: ship.phone } : {}),
    },
    metadata: [
      { key: 'stripe_session', value: session.id },
      { key: 'painting_seed', value: record.seed },
    ],
  };

  if (env.RETURN_ADDRESS_JSON) {
    try {
      body.returnAddress = JSON.parse(env.RETURN_ADDRESS_JSON);
    } catch { /* an unreadable return address is left out rather than blocking the order */ }
  }
  return body;
}

export async function handleStripeEvent(env, event, workerOrigin) {
  const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  if (!paid) return { ignored: event.type };

  const session = event.data.object;
  if (session.payment_status !== 'paid') return { ignored: 'not_paid_yet' };

  const orderId = session.client_reference_id || (session.metadata && session.metadata.order_id);
  const record = orderId && (await env.TOKENS.get(`order:${orderId}`, 'json'));
  if (!record) return { ignored: 'not_ours' };
  if (record.sent) return { duplicate: true, gelato_order: record.sent };
  if (record.rendering) return { duplicate: true, rendering: true };

  const ship = shippingOf(session);
  if (!ship.address.country || !ship.address.line1) throw new HttpError(500, 'no_delivery_address');
  if (ship.address.country !== record.country) throw new HttpError(500, 'country_changed');

  record.customerReferenceId = await shortHash(ship.email || orderId);

  // The print file is painted now; the order waits for it (finishRender)
  if (record.render) {
    record.pendingBody = gelatoOrderBody(env, record, session, ship);
    record.paid = { total: session.amount_total, currency: session.currency };
    await dispatchRender(env, {
      orderId, key: record.render.key, url: record.render.url, path: record.render.path,
      callback: `${workerOrigin}/render/done`,
    });
    record.rendering = new Date().toISOString();
    await env.TOKENS.put(`order:${orderId}`, JSON.stringify(record), { expirationTtl: ORDER_TTL });
    return { rendering: true };
  }

  const order = await createOrder(env, gelatoOrderBody(env, record, session, ship));

  record.sent = order.id || true;
  record.paid = { total: session.amount_total, currency: session.currency };
  await env.TOKENS.put(`order:${orderId}`, JSON.stringify(record), { expirationTtl: ORDER_TTL });
  return { sent: record.sent };
}

// The job has painted and committed the file: the order goes to Gelato, once
export async function finishRender(env, orderId, key) {
  const record = await env.TOKENS.get(`order:${orderId}`, 'json');
  if (!record || !record.render || record.render.key !== key) throw new HttpError(404, 'not_found');
  if (record.sent) return { duplicate: true, gelato_order: record.sent };
  if (!record.pendingBody) throw new HttpError(409, 'not_paid_yet');
  const order = await createOrder(env, record.pendingBody);
  record.sent = order.id || true;
  record.rendered = new Date().toISOString();
  delete record.pendingBody;
  await env.TOKENS.put(`order:${orderId}`, JSON.stringify(record), { expirationTtl: ORDER_TTL });
  return { sent: record.sent };
}
