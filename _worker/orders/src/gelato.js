// Gelato's APIs, as the order Worker uses them:
//   templates   the sizes and frames you built in the Gelato dashboard (ecommerce API)
//   catalogue   every product Gelato makes, filtered (product API)
//   prices      what Gelato charges you for one copy, to a country
//   orders      sending a paid order for printing, framing and shipping (order API)
//
// Docs: https://dashboard.gelato.com/docs/

import { HttpError } from './util.js';

export const GELATO_ECOMMERCE = 'https://ecommerce.gelatoapis.com/v1';
export const GELATO_ORDERS = 'https://order.gelatoapis.com/v4';
export const GELATO_PRODUCTS = 'https://product.gelatoapis.com/v3';
const TEMPLATE_TTL = 60 * 60; // templates change rarely; one Gelato call an hour is plenty
const PRICE_TTL = 60 * 60 * 6;

async function gelato(env, path, { method = 'GET', body, base = GELATO_ECOMMERCE } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'x-api-key': env.GELATO_API_KEY,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new HttpError(502, 'gelato_request_failed', { gelato_status: res.status, path, error: data });
  }
  return data;
}

export function gelatoConfigured(env) {
  return Boolean(env.GELATO_API_KEY && env.GELATO_STORE_ID && Object.keys(gelatoProducts(env)).length);
}

// GELATO_TEMPLATES = {"poster": {"templateId": "...", "label": "Print"}, "framed": {...}}
export function gelatoProducts(env) {
  if (!env.GELATO_TEMPLATES) return {};
  try {
    const parsed = JSON.parse(env.GELATO_TEMPLATES);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getTemplate(env, templateId) {
  const key = `gelato:template:${templateId}`;
  const cached = await env.TOKENS.get(key, 'json');
  if (cached) return cached;
  const template = await gelato(env, `/templates/${encodeURIComponent(templateId)}`);
  await env.TOKENS.put(key, JSON.stringify(template), { expirationTtl: TEMPLATE_TTL });
  return template;
}

/* ---------- prices and orders ---------- */

// What Gelato charges you to make one copy, delivered to a country, in a currency
export async function productCost(env, productUid, country, currency) {
  const key = `gelato:price:${productUid}:${country}:${currency}`;
  const cached = await env.TOKENS.get(key);
  if (cached) return Number(cached);

  const rows = await gelato(
    env,
    `/products/${encodeURIComponent(productUid)}/prices?country=${country}&currency=${currency}`,
    { base: GELATO_PRODUCTS },
  );
  const one = (rows || []).find((r) => Number(r.quantity) === 1) || (rows || [])[0];
  if (!one || !(Number(one.price) > 0)) throw new HttpError(502, 'gelato_no_price', { productUid, country });
  await env.TOKENS.put(key, String(one.price), { expirationTtl: PRICE_TTL });
  return Number(one.price);
}

// Sends a paid order to Gelato for printing, framing and shipping
export function createOrder(env, body) {
  return gelato(env, '/orders', { method: 'POST', body, base: GELATO_ORDERS });
}

/* ---------- the catalogue: every product Gelato makes, filtered ---------- */

const CATALOG_TTL = 60 * 60 * 6;
const PAGE = 100;
const MAX_PAGES = 5;

// What a catalogue's attributes are called, and what their values are called
export async function getCatalog(env, catalogUid) {
  const key = `gelato:catalog:${catalogUid}`;
  const cached = await env.TOKENS.get(key, 'json');
  if (cached) return cached;
  const catalog = await gelato(env, `/catalogs/${encodeURIComponent(catalogUid)}`, { base: GELATO_PRODUCTS });
  await env.TOKENS.put(key, JSON.stringify(catalog), { expirationTtl: CATALOG_TTL });
  return catalog;
}

// The products of a catalogue that match the filters, as many as five pages of a hundred
export async function searchCatalog(env, catalogUid, filters = {}) {
  const key = `gelato:products:${catalogUid}:${JSON.stringify(filters)}`;
  const cached = await env.TOKENS.get(key, 'json');
  if (cached) return cached;

  const products = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = { attributeFilters: filters, limit: PAGE, offset: page * PAGE };
    const res = await gelato(env, `/catalogs/${encodeURIComponent(catalogUid)}/products:search`, {
      method: 'POST',
      body,
      base: GELATO_PRODUCTS,
    });
    const batch = (res && res.products) || [];
    products.push(...batch);
    if (batch.length < PAGE) break;
  }
  await env.TOKENS.put(key, JSON.stringify(products), { expirationTtl: CATALOG_TTL });
  return products;
}
