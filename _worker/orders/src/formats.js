// The canvas formats of Still Life Code, and how many pixels a print needs.
//
// The studio paints in one of five formats (short side : long side). The Gelato print
// variants are matched to a painting by their proportions and by the pixels their print
// area asks for, so no size table has to be kept here.
//
// The studio always paints at the same size (there is no choice of finish).
// The file sent with an order is painted again, from the same seed, at the size the print needs at
// PRINT_DPI (shop.js) -- as large as the visitor's device can paint.

export const DEFAULT_MIN_DPI = 150;

// Resolution below which a size is not offered for a given painting. 150 is a safe floor for
// anything held in the hand; large wall prints are often made at 100. Set MIN_DPI in
// wrangler.toml to change it.
export function minDpi(env) {
  const n = Number(env.MIN_DPI);
  return n >= 50 && n <= 600 ? n : DEFAULT_MIN_DPI;
}

// Same ratios as the studio's `ratio` setting (RATIO in still-life-code.html)
export const RATIOS = {
  '4x5': 0.8,
  '3x4': 0.75,
  '2x3': 2 / 3,
  'a': Math.SQRT1_2,
  '1x1': 1,
};

// Which studio format does a canvas belong to? null when it matches none of them.
export function ratioKeyFor(width, height) {
  const r = Math.min(width, height) / Math.max(width, height);
  let best = null;
  let bestGap = Infinity;
  for (const [key, value] of Object.entries(RATIOS)) {
    const gap = Math.abs(r - value);
    if (gap < bestGap) {
      best = key;
      bestGap = gap;
    }
  }
  return bestGap < 0.012 ? best : null;
}

// The only sizes on sale, when the shop offers a short fixed list (ALLOWED_SIZES_JSON):
//   [{"label": "13x18 cm / 5x7\u2033", "mm": [130, 180]}, ...]   (short side, long side)
// Whatever shape the painting has, it is cut (from the top-left, never from the signature's corner) to the shape
// of the size chosen. null: no list, every size that fits the painting's own shape is offered.
export function allowedSizes(env) {
  try {
    const list = env.ALLOWED_SIZES_JSON ? JSON.parse(env.ALLOWED_SIZES_JSON) : null;
    if (!Array.isArray(list)) return null;
    const ok = list.filter((s) => s && Array.isArray(s.mm) && s.mm.length === 2 && s.mm[0] > 0 && s.mm[1] > 0 && s.label)
      .map((s) => ({ label: String(s.label), mm: [Math.min(...s.mm), Math.max(...s.mm)] }));
    return ok.length ? ok : null;
  } catch {
    return null;
  }
}

// Is this picture one the shop takes? A studio format; or, with a fixed list of sizes, any ordinary portrait shape
// (the studio's picture is cut to the size's own shape before it is sent)
export function formatOk(env, width, height) {
  if (!(width > 0 && height > 0)) return false;
  if (ratioKeyFor(width, height)) return true;
  if (!allowedSizes(env)) return false;
  const r = Math.min(width, height) / Math.max(width, height);
  return r >= 0.5 && r <= 1;
}

// Pixels along one side that a length in millimetres needs at the given resolution
export function pixelsForMm(mm, dpi) {
  return Math.round((mm / 25.4) * dpi);
}
