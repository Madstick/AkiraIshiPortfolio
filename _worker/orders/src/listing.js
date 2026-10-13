// Reading what the studio sends, and working out which products a painting can be printed on.
//
// Everything that arrives from the browser is untrusted: it is checked against an
// allow-list and trimmed before it is used.

import { HttpError, asArray } from './util.js';
import { allowedSizes, formatOk, minDpi, pixelsForMm, ratioKeyFor } from './formats.js';

// The studio's own URL settings (ST in still-life-code.html) and the shapes they take
const PARAM_KEYS = [
  'style', 'silk', 'detail', 'varnish', 'ratio', 'orient', 'busy', 'skull', 'light',
  'mirror', 'cloth', 'books', 'fruitn', 'fruit', 'with', 'without', 'comp', 'school',
  'backdrop', 'haze', 'lite',
];
const PARAM_VALUE = /^[a-z0-9._-]{0,80}$/i;
const SEED = /^[a-z0-9]{3,24}$/i;
const PRODUCT_ID = /^[a-z0-9-]{1,24}$/;
const VARIANT_ID = /^[A-Za-z0-9_.-]{1,200}$/;
const COUNTRY = /^[A-Z]{2}$/;

// A title keeps letters, digits, punctuation and spaces
const TITLE_FORBIDDEN = /[^\p{L}\p{Nd}\p{P}\p{Sm}\p{Z}™©®]/gu;

export function clean(text, max) {
  return String(text ?? '')
    .replace(TITLE_FORBIDDEN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* ---------- the request ---------- */

export function parseMeta(raw) {
  let meta;
  try {
    meta = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'bad_meta');
  }
  if (!meta || typeof meta !== 'object') throw new HttpError(400, 'bad_meta');

  if (!SEED.test(String(meta.seed || ''))) throw new HttpError(400, 'bad_seed');
  if (!PRODUCT_ID.test(String(meta.product || ''))) throw new HttpError(400, 'bad_product');

  const params = {};
  for (const key of PARAM_KEYS) {
    const value = meta.params && meta.params[key];
    if (value === undefined || value === null || value === '') continue;
    if (!PARAM_VALUE.test(String(value))) throw new HttpError(400, 'bad_param', key);
    params[key] = String(value);
  }

  const out = {
    seed: String(meta.seed),
    product: String(meta.product),
    params,
    title: clean(meta.title, 90) || 'Still Life',
  };

  // Only used by the on-site checkout
  if (meta.variant !== undefined) {
    if (!VARIANT_ID.test(String(meta.variant))) throw new HttpError(400, 'bad_variant');
    out.variant = String(meta.variant);
  }
  if (meta.country !== undefined) {
    if (!COUNTRY.test(String(meta.country))) throw new HttpError(400, 'bad_country');
    out.country = String(meta.country);
  }
  return out;
}

/* ---------- the pictures ---------- */

// The print file: a PNG, or (for the large 300 dpi files, which would be tens of megabytes as PNG) a JPEG
export function readImage(bytes, maxBytes, env = {}) {
  if (bytes.byteLength > maxBytes) throw new HttpError(413, 'image_too_large');
  const size = pngSize(bytes) || jpegSize(bytes);
  if (!size) throw new HttpError(415, 'not_an_image');
  if (!formatOk(env, size.width, size.height)) throw new HttpError(422, 'unknown_format');
  return size;
}

function pngSize(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 33 || sig.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // IHDR is always the first chunk: width and height sit at bytes 16 and 20
  return { width: view.getUint32(16), height: view.getUint32(20), mime: 'image/png', ext: 'png' };
}

// A JPEG's size is in its start-of-frame segment; the segments before it are skipped by their lengths
function jpegSize(bytes) {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.byteLength) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) { i++; continue; } // fill byte
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width && height ? { width, height, mime: 'image/jpeg', ext: 'jpg' } : null;
    }
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

/* ---------- Gelato: variants a painting can fill ---------- */

// Of all the variants in a template (every size, every frame), keep the ones this painting
// can fill: same proportions as the print area, and enough pixels for it.
// Print areas are read as millimetres, which is how Gelato measures them.
export function fittingVariants(env, template, image) {
  const dpi = minDpi(env);
  const aspect = image.width / image.height;
  const side = Math.min(image.width, image.height);

  // First the shape: a 2:3 painting cannot go on a size that is not 2:3, whatever its pixels
  const sameShape = (template.variants || []).filter((variant) => {
    const areas = variant.imagePlaceholders || [];
    if (!areas.length) return false;
    return areas.every((a) => !a.width || !a.height || Math.abs(a.width / a.height - aspect) / aspect <= 0.04);
  });
  if (!sameShape.length) {
    throw new HttpError(422, 'no_size_for_format', { format: ratioKeyFor(image.width, image.height) });
  }

  // Then the pixels: the size has to be fillable at the minimum resolution
  const out = sameShape.filter((variant) => variant.imagePlaceholders.every((a) => {
    if (!a.width || !a.height) return true; // nothing to judge by
    return side >= pixelsForMm(Math.min(a.width, a.height), dpi) * 0.95;
  }));
  if (!out.length) throw new HttpError(422, 'image_too_small', { dpi, pixels: side });
  return out;
}

/* ---------- the size of the picture, as opposed to the size of the object ---------- */

const ISO = {
  a0: [841, 1189], a1: [594, 841], a2: [420, 594], a3: [297, 420], a4: [210, 297], a5: [148, 210], a6: [105, 148],
  b1: [707, 1000], b2: [500, 707], xl: [280, 430], '5r': [130, 180],
};

// The formats a catalogue names its prints by, best first. Frame sizes and hanger sizes are not on this list:
// they describe the object around the picture.
const FORMAT_KEYS = [
  'UnifiedPaperFormat', 'UnifiedCanvasFormat', 'UnifiedAcrylicFormat', 'UnifiedMetallicFormat', 'UnifiedWoodFormat',
  'PaperFormat', 'CanvasFormat', 'AcrylicFormat', 'MetallicFormat', 'WoodFormat',
];

// "200x250-mm-8x10-inch", "a4-8x12-inch", "XL-280x430-mm", "A3" ... as [width, height] in millimetres
export function parseFormat(value) {
  const v = String(value || '').toLowerCase();
  let m = v.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)-mm/);
  if (m) return [Number(m[1]), Number(m[2])];
  for (const token of v.split('-')) if (ISO[token]) return ISO[token];
  m = v.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)-inch/);
  if (m) return [Math.round(Number(m[1]) * 254) / 10, Math.round(Number(m[2]) * 254) / 10];
  return null;
}

// What the file is printed at: the product's format, turned the way the product is, or its own dimensions
export function printAreaMm(product) {
  const a = product.attributes || {};
  for (const key of FORMAT_KEYS) {
    const size = a[key] && parseFormat(a[key]);
    if (!size) continue;
    const [lo, hi] = [Math.min(...size), Math.max(...size)];
    if (a.Orientation === 'hor') return [hi, lo];
    if (a.Orientation === 'ver') return [lo, hi];
    return size;
  }
  const d = product.dimensions || {};
  const w = Number(d.Width && d.Width.value);
  const h = Number(d.Height && d.Height.value);
  return w > 0 && h > 0 ? [w, h] : null;
}

// A readable name for a format value that the catalogue gave no title to
function prettyFormat(value) {
  const size = parseFormat(value);
  if (!size) return value;
  const cm = (n) => (Math.abs(n / 10 - Math.round(n / 10)) < 0.06 ? String(Math.round(n / 10)) : (n / 10).toFixed(1));
  const inch = String(value).toLowerCase().match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)-inch/);
  const tail = inch ? ` / ${inch[1]} \u00d7 ${inch[2]} in` : '';
  return `${cm(Math.min(...size))} \u00d7 ${cm(Math.max(...size))} cm${tail}`;
}

/* ---------- Gelato catalogue: products picked straight from what Gelato makes ---------- */

// Flat products of a catalogue that a painting can fill, for a country. Their size is the product's
// own width and height (millimetres), which is what the file is scaled to.
//
// With a fixed list of sizes (ALLOWED_SIZES_JSON) only those sizes are offered, turned the way the painting is. With
// `crop`, the painting's own shape does not matter: it is cut to the size, so only the pixels left are counted.
export function fittingProducts(env, products, image, country, { crop = false } = {}) {
  const dpi = minDpi(env);
  const aspect = image.width / image.height;
  const side = Math.min(image.width, image.height);
  const sizes = allowedSizes(env);
  const landscape = image.width >= image.height;

  const live = (products || []).filter((p) => {
    const a = p.attributes || {};
    if (a.ProductStatus && a.ProductStatus !== 'activated') return false;
    if (country && Array.isArray(p.supportedCountries) && p.supportedCountries.length && !p.supportedCountries.includes(country)) return false;
    const area = printAreaMm(p);
    if (!area) return false;
    if (sizes) {
      const [w, h] = area;
      if ((w >= h) !== landscape) return false;
      const s = Math.min(w, h);
      const l = Math.max(w, h);
      if (!sizes.some((a2) => near(a2.mm[0], s) && near(a2.mm[1], l))) return false;
    }
    return true;
  });
  const size = (p) => printAreaMm(p);

  if (sizes && crop) {
    if (!live.length) throw new HttpError(422, 'no_size_for_format', { format: ratioKeyFor(image.width, image.height) });
    const long = Math.max(image.width, image.height);
    const fits = live.filter((p) => {
      const [w, h] = size(p);
      const rho = Math.min(w, h) / Math.max(w, h);
      // the short side that is left once the painting is cut to the size's shape
      const left = rho >= side / long ? side : long * rho;
      return left >= pixelsForMm(Math.min(w, h), dpi) * 0.95;
    });
    if (!fits.length) throw new HttpError(422, 'image_too_small', { dpi, pixels: side });
    return fits.sort((a, b) => size(a)[0] * size(a)[1] - size(b)[0] * size(b)[1]);
  }

  const sameShape = live.filter((p) => {
    const [w, h] = size(p);
    return Math.abs(w / h - aspect) / aspect <= 0.04;
  });
  if (!sameShape.length) {
    throw new HttpError(422, 'no_size_for_format', { format: ratioKeyFor(image.width, image.height) });
  }

  const out = sameShape.filter((p) => side >= pixelsForMm(Math.min(...size(p)), dpi) * 0.95);
  if (!out.length) throw new HttpError(422, 'image_too_small', { dpi, pixels: side });

  // smallest first: that is where a painting's pixels reach
  return out.sort((a, b) => size(a)[0] * size(a)[1] - size(b)[0] * size(b)[1]);
}

// What a visitor calls an attribute, whatever Gelato's catalogue calls it
const FRIENDLY = {
  FrameColor: 'Frame colour', FrameMaterial: 'Frame material', FrameProperties: 'Frame profile', GlassType: 'Glass',
  UnifiedPaperFormat: 'Size', PaperFormat: 'Size', UnifiedFrameSize: 'Size', FrameSize: 'Size',
  UnifiedCanvasFormat: 'Size', CanvasFormat: 'Size', UnifiedAcrylicFormat: 'Size', AcrylicFormat: 'Size',
  UnifiedMetallicFormat: 'Size', MetallicFormat: 'Size', UnifiedWoodFormat: 'Size', WoodFormat: 'Size',
  UnifiedPaperType: 'Paper', PaperType: 'Paper',
  CanvasThicknessType: 'Canvas frame', CanvasFrame: 'Depth', WoodThickness: 'Thickness', AcrylicProperties: 'Thickness',
  MetallicProperties: 'Finish', MetallicGrainDirection: 'Grain',
  WallHangerColor: 'Hanger colour', WallHangerSize: 'Hanger size',
};

// Attributes that are the same for every visitor's purposes: not a choice to put in front of them
export const QUIET = new Set([
  'ProductStatus', 'Orientation', 'Variable', 'ProductModel', 'State', 'ColorType', 'FulfillmentService',
  'SpotFinishingType', 'ProtectionType', 'ShapeEdgeType', 'CoatingType', 'FrameProperties',
  'WallHangerProperties', 'WallHangerMaterial', 'WallHangerSize', 'AcrylicProperties', 'AcrylicEdge', 'MetallicEdge', 'WoodMaterial',
  'CanvasMaterial',
]);

// Readable names for products: only the attributes that differ between them, in the catalogue's own words.
// Two attributes that always change together (a format and its "unified" twin) are shown once, size first.
export function describeProducts(catalog, products) {
  const attr = {};
  const value = {};
  for (const a of asArray(catalog && catalog.productAttributes)) {
    attr[a.productAttributeUid] = a.title;
    for (const v of asArray(a.values)) value[`${a.productAttributeUid}:${v.productAttributeValueUid}`] = v.title;
  }

  const seen = {};
  for (const p of products) {
    for (const [k, v] of Object.entries(p.attributes || {})) (seen[k] = seen[k] || new Set()).add(v);
  }
  let varying = Object.keys(seen).filter((k) => !QUIET.has(k) && seen[k].size > 1);

  // one attribute per partition of the products
  const groups = new Map();
  for (const k of varying) {
    // the same partition whatever the values are called: each product gets the rank of its value's first appearance
    const rank = new Map();
    const sig = products.map((p) => {
      const v = (p.attributes || {})[k];
      if (!rank.has(v)) rank.set(v, rank.size);
      return rank.get(v);
    }).join(',');
    const kept = groups.get(sig);
    // of two that change together, the one that says the most: a "unified" format, then a "properties" attribute
    const score = (u) => (FORMAT_KEYS.indexOf(u) === 0 ? 5 : FORMAT_KEYS.indexOf(u) > -1 && /^Unified/.test(u) ? 4
      : /^Unified/.test(u) ? 3 : /Properties$/.test(u) ? 2 : 1);
    if (!kept || score(k) > score(kept)) groups.set(sig, k);
  }
  const keep = new Set(groups.values());
  varying = varying.filter((k) => keep.has(k));

  // size first, then the rest in the catalogue's order
  const isSize = (k) => FRIENDLY[k] === 'Size' || /format|size/i.test(k);
  varying.sort((x, y) => Number(isSize(y)) - Number(isSize(x)));

  const used = new Set();
  const nameOf = (k) => {
    let name = FRIENDLY[k] || (attr[k] && attr[k] !== k ? attr[k] : k);
    while (used.has(name)) name += ' 2';
    used.add(name);
    return name;
  };
  const names = Object.fromEntries(varying.map((k) => [k, nameOf(k)]));
  const mentionsSize = varying.some(isSize);

  const out = new Map();
  for (const p of products) {
    const opts = varying.map((k) => {
      const raw = p.attributes[k];
      let title = value[`${k}:${raw}`];
      // a size the catalogue gave no readable title to: write it out
      const withUnits = /\d+x\d+-(mm|inch)/i.test(String(raw));
      if (withUnits && (!title || title === raw)) title = prettyFormat(raw);
      return { name: names[k], value: title || raw };
    }).filter((o) => o.value);
    const area = printAreaMm(p) || [0, 0];
    const w = Math.round(area[0]);
    const h = Math.round(area[1]);
    const parts = opts.map((o) => o.value);
    if (!mentionsSize || !parts.length) {
      parts.unshift(`${w} \u00d7 ${h} mm`);
      opts.unshift({ name: 'Size', value: `${w} \u00d7 ${h} mm` });
    }
    out.set(p.productUid, { title: parts.join(' \u00b7 '), options: opts });
  }
  return out;
}

/* ---------- one name for each size ---------- */

// Gelato lists the same print under several product ids (metric-first, inch-first, an older family...), each with
// its own spelling of the size. This gives every physical size one name -- "20 x 25 cm / 8 x 10 in" -- so those
// products show up as one choice. Sizes within 4% of each other are the same size. `items` are
// { productUid, mm: [w, h], options, title }; they are returned with the Size option rewritten, in the order given.
const MM_TOKEN = /(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)-mm/i;
const IN_TOKEN = /(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)-inch/i;
const near = (a, b) => Math.abs(a - b) <= 0.04 * Math.max(a, b);
const fmtNum = (n) => (Math.abs(n - Math.round(n)) < 0.06 ? String(Math.round(n)) : n.toFixed(1));

export function unifySizes(items, { inchFirst = false, allowed = null, orientation = '' } = {}) {
  const clusters = [];
  const clusterOf = new Map();
  for (const it of items) {
    const mm = (it.mm || []).map(Number).filter((n) => n > 0);
    if (mm.length < 2) continue;
    const short = Math.min(mm[0], mm[1]);
    const long = Math.max(mm[0], mm[1]);
    let c = clusters.find((k) => near(k.short, short) && near(k.long, long));
    if (!c) {
      c = { short, long, metric: null, inch: null, names: new Set() };
      clusters.push(c);
    }
    const own = (it.options || []).find((o) => /size|format/i.test(o.name));
    if (own) c.names.add(own.value);
    const m = MM_TOKEN.exec(it.productUid);
    const i = IN_TOKEN.exec(it.productUid);
    if (m && !c.metric) c.metric = [Number(m[1]), Number(m[2])].sort((a, b) => a - b).map((n) => n / 10);
    if (i && !c.inch) c.inch = [Number(i[1]), Number(i[2])].sort((a, b) => a - b);
    clusterOf.set(it, c);
  }

  const label = (c) => {
    let cm = c.metric;
    let inch = c.inch;
    // a unit the product ids did not give: derived only when it comes out as a round number
    if (!cm) {
      const d = (inch || [c.short / 25.4, c.long / 25.4]).map((n) => n * 2.54);
      if (inch || d.every((n) => Math.abs(n - Math.round(n)) < 0.15)) cm = d.map((n) => Math.round(n));
      else cm = [c.short / 10, c.long / 10];
    }
    if (!inch) {
      const d = [c.short / 25.4, c.long / 25.4];
      if (d.every((n) => Math.abs(n - Math.round(n)) < 0.25)) inch = d.map((n) => Math.round(n));
    }
    const a = `${fmtNum(cm[0])} × ${fmtNum(cm[1])} cm`;
    if (!inch) return a;
    const b = `${fmtNum(inch[0])} × ${fmtNum(inch[1])} in`;
    return inchFirst ? `${b} / ${a}` : `${a} / ${b}`;
  };
  const labels = new Map(clusters.map((c) => [c, label(c)]));
  // a fixed list gives its own names (and drops every size that is not on it)
  const listed = new Map();
  if (allowed) {
    for (const c of clusters) {
      const hit = allowed.find((a) => near(a.mm[0], c.short) && near(a.mm[1], c.long));
      if (hit) listed.set(c, (orientation ? `${orientation} - ` : '') + hit.label);
    }
  }

  return items.filter((it) => !allowed || listed.has(clusterOf.get(it))).map((it) => {
    const c = clusterOf.get(it);
    if (!c) return it;
    // a paper size keeps its own name (A4, A3...); every other size gets the one name made above
    const own = c.names.size === 1 ? [...c.names][0] : '';
    const text = listed.get(c) || (/^A\d/i.test(own) ? own : labels.get(c));
    const isSize = (o) => /size|format/i.test(o.name);
    const rest = it.options.filter((o) => !isSize(o));
    const options = [{ name: 'Size', value: text }, ...rest];
    return { ...it, options, title: options.map((o) => o.value).join(' · '), size: [c.short, c.long] };
  });
}

/* ---------- keys ---------- */

async function hash(parts) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(parts)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

const paramsOf = (meta) => Object.keys(meta.params).sort().map((k) => [k, meta.params[k]]);

// The file key is the painting alone: one file serves every product made from it
export const fileKey = (meta, image) => hash([meta.seed, paramsOf(meta), image.width, image.height]);
