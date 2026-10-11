// Stripe Checkout, used only for the "buy straight from this site" route.
//
// The Worker never touches card details: Stripe hosts the payment page. The Worker creates the
// session, then waits for Stripe's webhook to say it was paid. No SDK: plain REST and a
// signature check with Web Crypto.

import { HttpError } from './util.js';

const STRIPE_API = 'https://api.stripe.com/v1';

// 'test', 'live' or null (no key). Only the start of the key is read, never shown.
export function stripeMode(env) {
  const key = String(env.STRIPE_SECRET_KEY || '');
  if (!key) return null;
  if (/^(sk|rk)_live_/.test(key)) return 'live';
  if (/^(sk|rk)_test_/.test(key)) return 'test';
  return 'unknown';
}

// A live key takes real money: it is refused until STRIPE_ALLOW_LIVE="true", so a key pasted by mistake
// (or the test key replaced too early) cannot sell anything.
export function stripeConfigured(env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return false;
  const mode = stripeMode(env);
  if (mode === 'test') return true;
  return mode === 'live' && String(env.STRIPE_ALLOW_LIVE) === 'true';
}

// Stripe takes form bodies with bracketed keys: line_items[0][quantity]=1
function flatten(value, prefix, out) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}[${k}]` : k, out);
  } else if (value !== undefined && value !== null) {
    out.append(prefix, String(value));
  }
  return out;
}

export async function createCheckoutSession(env, params) {
  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: flatten(params, '', new URLSearchParams()),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new HttpError(502, 'stripe_request_failed', { stripe_status: res.status, error: data.error && data.error.message });
  }
  return data;
}

/* ---------- webhook signature ---------- */

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Stripe-Signature: t=1700000000,v1=<hmac>,v1=<hmac>   (HMAC-SHA256 of "<t>.<raw body>")
export async function verifyWebhook(rawBody, header, secret, { toleranceSeconds = 300, now = Date.now() } = {}) {
  if (!header) throw new HttpError(400, 'no_signature');
  const parts = header.split(',').map((p) => p.split('='));
  const t = (parts.find((p) => p[0] === 't') || [])[1];
  const candidates = parts.filter((p) => p[0] === 'v1').map((p) => p[1]);
  if (!t || !candidates.length) throw new HttpError(400, 'bad_signature');

  if (Math.abs(now / 1000 - Number(t)) > toleranceSeconds) throw new HttpError(400, 'signature_too_old');

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${rawBody}`)));
  if (!candidates.some((c) => equal(c, expected))) throw new HttpError(400, 'bad_signature');

  return JSON.parse(rawBody);
}

// Stripe has moved the delivery address between API versions; read both places
export function shippingOf(session) {
  const details = (session.collected_information && session.collected_information.shipping_details) || session.shipping_details || {};
  return {
    name: details.name || (session.customer_details && session.customer_details.name) || '',
    address: details.address || {},
    email: (session.customer_details && session.customer_details.email) || '',
    phone: (session.customer_details && session.customer_details.phone) || '',
  };
}
