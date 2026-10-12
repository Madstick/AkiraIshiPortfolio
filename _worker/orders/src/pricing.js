// What a visitor pays, and what it is made of:
//
//   the artist's price        yours, per currency (ARTIST_PRICE_JSON), before anything else
//   printing and materials    what Gelato charges for the product, to that country
//   delivery                  what Gelato charges to ship it there
//
// The first is set by you; the other two are Gelato's own figures for that product and country, asked of Gelato's
// quote service (with a sample address in the country: the real one is only known at payment), and passed on as they
// are. Nothing is added on top. If the quote cannot be had, the product price is read from Gelato's price list and
// the delivery comes from DIRECT_SHIPPING_JSON, and the price is marked as an estimate.

import { HttpError } from './util.js';
import { productCost, quoteOrder } from './gelato.js';

const DEFAULT_CURRENCIES = {
  EUR: ['FR', 'BE', 'DE', 'ES', 'IT', 'NL', 'PT', 'AT', 'IE', 'LU'],
  USD: ['US', 'CA', 'AU'],
  GBP: ['GB'],
};
const DEFAULT_ARTIST = { EUR: 34.99, USD: 34.99, GBP: 29.99 };
const QUOTE_TTL = 60 * 60 * 6;

const round2 = (n) => Math.round(Number(n) * 100) / 100;

function table(env, key, fallback) {
  try {
    const parsed = env[key] ? JSON.parse(env[key]) : null;
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// The currency a country pays in
export function currencyFor(env, country) {
  const map = table(env, 'DIRECT_CURRENCIES_JSON', DEFAULT_CURRENCIES);
  for (const [currency, list] of Object.entries(map)) {
    if (Array.isArray(list) && list.includes(country)) return currency;
  }
  return String(env.CURRENCY || 'EUR').toUpperCase();
}

export function artistPrice(env, currency) {
  const n = Number(table(env, 'ARTIST_PRICE_JSON', DEFAULT_ARTIST)[currency]);
  if (!(n >= 0)) throw new HttpError(500, 'no_artist_price', { currency });
  return round2(n);
}

// An address that exists in each country, for the quote
const SAMPLE = {
  FR: { city: 'Paris', postCode: '75001' }, BE: { city: 'Bruxelles', postCode: '1000' },
  DE: { city: 'Berlin', postCode: '10115' }, ES: { city: 'Madrid', postCode: '28001' },
  IT: { city: 'Roma', postCode: '00184' }, NL: { city: 'Amsterdam', postCode: '1012 AB' },
  PT: { city: 'Lisboa', postCode: '1100-148' }, AT: { city: 'Wien', postCode: '1010' },
  IE: { city: 'Dublin', postCode: 'D01 F5P2' }, LU: { city: 'Luxembourg', postCode: 'L-1111' },
  GB: { city: 'London', postCode: 'SW1A 1AA' },
  US: { city: 'New York', postCode: '10001', state: 'NY' },
  CA: { city: 'Toronto', postCode: 'M5V 2T6', state: 'ON' },
  AU: { city: 'Sydney', postCode: '2000', state: 'NSW' },
};

function flatShipping(env, country) {
  const t = table(env, 'DIRECT_SHIPPING_JSON', {});
  const n = Number(t[country] ?? t.default ?? 9);
  return n >= 0 ? n : 9;
}

// Gelato's own figures for one product to one country: { product, shipping, estimated }
export async function gelatoCosts(env, productUid, country, currency) {
  const key = `gelato:quote:${productUid}:${country}:${currency}`;
  const cached = await env.TOKENS.get(key, 'json');
  if (cached) return cached;

  let costs = null;
  try {
    const where = SAMPLE[country] || { city: 'Capital', postCode: '00000' };
    const res = await quoteOrder(env, {
      orderReferenceId: 'quote',
      customerReferenceId: 'quote',
      currency,
      allowMultipleQuotes: false,
      recipient: {
        country,
        firstName: 'Price',
        lastName: 'Quote',
        addressLine1: '1 Main Street',
        city: where.city,
        postCode: where.postCode,
        ...(where.state ? { state: where.state } : {}),
        email: 'quote@example.com',
      },
      products: [{ itemReferenceId: '1', productUid, quantity: 1 }],
    });
    const quote = res && res.quotes && res.quotes[0];
    const methods = (quote && quote.shipmentMethods) || [];
    const normal = methods.filter((m) => m.type === 'normal');
    const cheapest = (normal.length ? normal : methods).slice().sort((a, b) => Number(a.price) - Number(b.price))[0];
    const product = quote && quote.products && quote.products.reduce((sum, p) => sum + Number(p.price || 0), 0);
    const sameCurrency = !cheapest || !cheapest.currency || cheapest.currency === currency;
    if (cheapest && product > 0 && sameCurrency) {
      costs = { product: round2(product), shipping: round2(cheapest.price), estimated: false };
    }
  } catch {
    // no quote: below
  }

  if (!costs) {
    costs = {
      product: round2(await productCost(env, productUid, country, currency)),
      shipping: round2(flatShipping(env, country)),
      estimated: true,
    };
  }
  await env.TOKENS.put(key, JSON.stringify(costs), { expirationTtl: QUOTE_TTL });
  return costs;
}

// The whole price, line by line
export async function priceOf(env, productUid, country) {
  const currency = currencyFor(env, country);
  const costs = await gelatoCosts(env, productUid, country, currency);
  const artist = artistPrice(env, currency);
  return {
    currency,
    artist,
    printing: costs.product,
    shipping: costs.shipping,
    total: round2(artist + costs.product + costs.shipping),
    shippingEstimated: costs.estimated,
  };
}
