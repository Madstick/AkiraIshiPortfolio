// The print file painted after the payment, not before it.
//
// On the direct route the visitor orders from the painting they see; the 300 dpi file the print is made from is painted
// afterwards, by a GitHub Actions job (render/render.yml, in the prints repo): it opens the studio page in headless
// Chrome with `&print=<pixels>`, commits the JPEG to the repo and calls back. Only then does the order go to Gelato.
//
//   paid (Stripe webhook) → dispatchRender → GitHub job paints, commits prints/<key>.jpg → POST /render/done → Gelato
//
// Needs RENDER_ENABLED="true", the GitHub file store (GITHUB_REPO, GITHUB_TOKEN with Contents read/write) and a shared
// RENDER_SECRET (also a secret of the prints repo) that signs the job's call back.

import { HttpError } from './util.js';
import { minDpi } from './formats.js';
import { usesGithub } from './store.js';

const on = (v) => String(v) === 'true';

export function renderEnabled(env) {
  return on(env.RENDER_ENABLED) && usesGithub(env) && Boolean(env.RENDER_SECRET) && Boolean(env.SITE_URL);
}

// The longest side a job may paint. A GitHub runner has 16 GB (public repo): 7016 px is A2 at 300 dpi, about 40
// megapixels in 4:5, well within it.
export function maxRenderPx(env) {
  const n = Number(env.MAX_RENDER_PX);
  return n >= 1000 && n <= 12000 ? Math.round(n) : 7016;
}

// The painting's shape at the largest size a job paints: what the sizes on offer are judged against
export function renderCap(env, image) {
  const long = maxRenderPx(env);
  const r = Math.min(image.width, image.height) / Math.max(image.width, image.height);
  const short = Math.round(long * r);
  return image.width >= image.height ? { width: long, height: short } : { width: short, height: long };
}

// Pixels along the long side a print area (millimetres) needs
export function renderPxFor(env, mm) {
  const long = mm && mm.length ? Math.max(...mm.map(Number).filter((v) => v > 0)) : 0;
  if (!(long > 0)) return maxRenderPx(env);
  return Math.min(maxRenderPx(env), Math.ceil((long / 25.4) * renderDpi(env)));
}

// The resolution the job paints at (never below the lowest one a size may be offered at)
export function renderDpi(env) {
  const n = Number(env.RENDER_DPI);
  return Math.max(minDpi(env), n >= 100 && n <= 600 ? n : 300);
}

function dir(env) {
  return (env.GITHUB_DIR || 'prints').replace(/^\/|\/$/g, '');
}

export function plannedFile(env, key) {
  const branch = env.GITHUB_BRANCH || 'main';
  const path = `${dir(env)}/${key}.jpg`;
  return { path, url: `https://raw.githubusercontent.com/${env.GITHUB_REPO}/${branch}/${path}` };
}

// The studio page that paints the file: the same seed and choices as the visitor's, at print size
export function studioUrl(env, meta, px) {
  const q = new URLSearchParams({ seed: meta.seed });
  for (const [k, v] of Object.entries(meta.params || {})) if (k !== 'print') q.set(k, v);
  q.set('print', String(px));
  return `${env.SITE_URL.replace(/\/$/, '')}/still-life-code.html?${q}`;
}

export async function dispatchRender(env, { orderId, key, url, path, callback }) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'still-life-code-worker',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ event_type: 'render', client_payload: { order_id: orderId, key, url, path, callback } }),
  });
  // A failure answers 5xx: Stripe retries the webhook, so the job is asked for again
  if (!res.ok) throw new HttpError(502, 'render_dispatch_failed', { github_status: res.status });
}

async function hmac(secret, text) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The job signs "<order id>:<key>" with RENDER_SECRET (openssl dgst -sha256 -hmac)
export async function renderSignature(env, orderId, key) {
  return hmac(env.RENDER_SECRET, `${orderId}:${key}`);
}

export async function checkRenderSignature(env, orderId, key, sig) {
  const want = await renderSignature(env, orderId, key);
  const got = String(sig || '').toLowerCase();
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
