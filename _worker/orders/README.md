# Still Life Code → Gelato

A Cloudflare Worker that lets a visitor order a print of the painting they made in the shop's atelier, without leaving
the site. They pick a size and a frame, pay with Stripe, and Gelato prints, frames and ships it.

```
 visitor's browser                         Cloudflare Worker                              services
 ─────────────────                         ─────────────────                              ────────
 paints a still life (canvas)
 picks a country, a size and a frame ◀──── sizes and prices ◀── Gelato catalogue / templates, prices
                       ── painting + choices ─▶ checks it, rate-limits it, prices it
                       ◀── payment page ─────── Stripe Checkout session ──────────────────▶ Stripe
                                                Stripe says "paid" ──▶ order ──────────────▶ Gelato prints and ships
```

Everything heavy stays on GitHub: the studio (`still-life-code.html`), the images, the shop page, and, if you set it
up, the print files too. The Worker is small and keeps only a few small things in one KV namespace: daily counters,
order records and, if GitHub is not set up, the print files.

This folder starts with an underscore on purpose: GitHub Pages (Jekyll) does not publish it, so none of this ends
up on akiraishi.com.

## Why Stripe

Gelato's API makes products and takes orders, but it bills *you*, the account holder; it has no checkout for the
public. So something has to collect the customer's payment in front of it. I used **Stripe Checkout**: Stripe hosts the
payment page and the Worker never sees card details. When Stripe says "paid", the Worker sends the order to Gelato.

## What you need

- A free **Cloudflare** account, and `npm` on your machine to deploy (`npx wrangler`).
- A **Gelato** account with an **API key** (dashboard → Developer), as the secret `GELATO_API_KEY`.
- What visitors can print on, in one of two ways (see "Letting visitors choose their own products"): a **template**
  built in the Gelato dashboard, or a **catalogue** read straight from Gelato.
- A **Stripe** account, with its secret key (start with the test key, `sk_test_...`) as `STRIPE_SECRET_KEY`, and a
  **webhook** pointing to `https://<your-worker>.workers.dev/stripe/webhook`, listening to `checkout.session.completed`
  (and `checkout.session.async_payment_succeeded`). Its signing secret is `STRIPE_WEBHOOK_SECRET`.
- Your **prices**: what you charge is Gelato's price for the product multiplied by `DIRECT_MARKUP`, plus a flat
  delivery fee per country (`DIRECT_SHIPPING_JSON`). Check a few against Gelato's own costs in its dashboard.
- Somewhere for the print file to live on the web while Gelato makes the print. Preferred: a **public GitHub repo** that
  holds only these files (for example `Madstick/still-life-prints`) and a **fine-grained token** with Contents
  read/write on that one repo (`GITHUB_REPO`, secret `GITHUB_TOKEN`). Without it the Worker keeps the files in KV and
  serves them itself, which also works.
- Optional but strongly advised: a **Turnstile** widget (free), so only people, not scripts, can place orders.
- The business side, which only you can settle: being the seller of record means **VAT/sales tax** (Stripe Tax can
  compute it; the Worker does not), terms of sale, a returns and refunds policy (custom, made-to-order goods have
  specific rules in the EU), a privacy notice, and customer service. Gelato reprints damaged or misprinted items;
  refunds to the customer are yours to give.

## Letting visitors choose their own products

Two ways to say what can be printed on, and you can mix them in `GELATO_TEMPLATES`:

| | Template | Catalogue |
|---|---|---|
| You write | `{"templateId": "..."}` | `{"catalogUid": "framed-posters", "filters": {...}}` |
| The menu | exactly the sizes and frames you built in Gelato | every product of that Gelato catalogue that fits the painting |
| Prices | Gelato's cost × markup | Gelato's cost × markup |
| Setup work | build the template by hand | none: the Worker reads the catalogue |

With a catalogue, the visitor's list is built live: the Worker asks Gelato for the catalogue's products (cached for six
hours), keeps the ones that are active, deliver to the visitor's country, have the painting's shape (within 4%) and
that its pixels can fill, then names each by the attributes that differ between them ("A3 · Black frame"). So a
catalogue of framed posters becomes a size-and-frame menu with nothing built by hand; add a catalogue of canvases or
metal prints as another entry and visitors get that too.

To narrow a catalogue (one paper, one frame family), open `/admin/discover`: for each catalogue it lists the attributes and
their values, and a sample of products. Put the ones you want in `filters`, for example
`{"PaperType": ["200-gsm-80lb-uncoated"]}`. The product dimensions Gelato reports are taken as the print size;
check a few framed products against what Gelato shows in its dashboard, because a mat can make the printable area smaller than the product.

### Building a template

A template is a product with every size and frame you want to offer, saved once. Each time a visitor orders, the
Worker looks at its variants.

- Add one **image layer** to the template, with any picture on it. It is only a stand-in, for the template's own
  previews. Apply it to all variants, filling the print area.
- Include **both orientations** of each size (portrait and landscape): a painting only gets the variants whose print
  area has its orientation.
- Build the sizes Gelato really offers, grouped by the studio's formats: 4:5 (8×10 in, 40×50 cm), 3:4 (30×40 cm),
  A-series (A4, A3, A2), square (30×30, 50×50), 2:3 (60×90 cm, 24×36 in). For each painting the Worker keeps only the
  variants with **the same proportions** (within 4%) and enough **pixels** for their print area (`MIN_DPI`), so a
  landscape painting never ends up on a portrait size. A format with no size in the template is refused with its own
  message ("no size for this format"), apart from "too few pixels".
- Frames and mats are variants too: the buyer picks the size and the frame in the panel.
- `/admin/discover` lists what the Worker reads from each template, including the print-area sizes. They are read as
  **millimetres**; if they look otherwise, the pixel check will be off, so look at that line first.

```toml
GELATO_TEMPLATES = '{"poster":{"templateId":"...","label":"Print"},"framed":{"catalogUid":"framed-posters","label":"Framed print"}}'
```

## Setup

```bash
cd _worker/orders
npm install
npx wrangler login
npx wrangler kv namespace create TOKENS      # paste the id it prints into wrangler.toml
```

Fill in `wrangler.toml` (every setting is commented), then the secrets:

```bash
npx wrangler secret put ADMIN_KEY            # a long random string, only you know it
npx wrangler secret put GELATO_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY    # sk_test_... first
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN         # only if GITHUB_REPO is set
npx wrangler secret put TURNSTILE_SECRET     # only if you use Turnstile
npx wrangler deploy
```

Then open `https://<your-worker>.workers.dev/admin/discover` with the header `x-admin-key: <ADMIN_KEY>` (or add
`?key=`). It shows what each template or catalogue holds. Write the filters you want in `wrangler.toml` and deploy again.

Test with nothing public: `DIRECT_ENABLED="true"`, the Stripe **test** key and a test webhook, and
`GELATO_ORDER_TYPE="draft"`. Pay with Stripe's test card `4242 4242 4242 4242`; Gelato receives a draft order that you
can see and delete. When it looks right: a live Stripe key and webhook, and `GELATO_ORDER_TYPE="order"`.

Finally, in `shop.js`, set the Worker's address, and put the Turnstile site key in `TURNSTILE_SITE_KEY`:

```js
const ORDER_API = 'https://still-life-code-orders.<you>.workers.dev';
```

Until `ORDER_API` is set (or while ordering is switched off) the atelier shows no order controls: the visitor can still
paint, and keep a painting's reference to bring it back.

## Trying it without any account

```bash
node test/run.mjs          # checks against pretend Gelato, Stripe and GitHub
node test/mock-server.mjs  # the Worker on http://127.0.0.1:8787, answering as if every service said yes
```

For the second one, serve the site on `http://127.0.0.1:8905` (`python -m http.server 8905`) and temporarily set
`ORDER_API` to `http://127.0.0.1:8787`. Nothing leaves your machine.

## The print file painted after the payment

A print need not wait for its file: with `RENDER_ENABLED="true"` the visitor orders from the picture they see in the
studio, pays, and only then is the 300 dpi file painted, by a GitHub Actions job, from the same seed and choices. When
the job has committed the file it calls the Worker back, and the order goes to Gelato.

```
 paid (Stripe webhook) ─▶ Worker: repository_dispatch "render" ─▶ GitHub job: headless Chrome opens
   still-life-code.html?seed=…&print=<px>, waits for "finished", commits prints/<key>.jpg
                                ◀── POST /render/done (signed) ──┘
 Worker ─▶ Gelato order, with the file's raw.githubusercontent.com address
```

The size painted is what the chosen print area needs at `RENDER_DPI` (300), up to `MAX_RENDER_PX` (7016, A2). An A3
takes a few minutes on a runner. Setting it up, in the prints repo (`GITHUB_REPO`, public, so the runner minutes are
free and the runner has 16 GB):

1. copy `render/render.yml` to `.github/workflows/render.yml` and `render/render.mjs` to `render/render.mjs`;
2. add a repository secret `RENDER_SECRET` (a long random string) and give the Worker the same:
   `npx wrangler secret put RENDER_SECRET`;
3. if the site is not `https://akiraishi.com`, add a repository variable `SITE_URL`;
4. set `RENDER_ENABLED = "true"` in `wrangler.toml` and deploy.

The job only opens the shop's own `still-life-code.html` and only writes into the prints folder. If a job fails, the
paid order waits (its record says `rendering`): re-run the job from the repo's Actions tab, and the order goes out
when it calls back. A job that calls back twice sends the order once.

Without it, the shop paints the file in the visitor's browser before ordering (see "Things to know").

## What the Worker does and refuses

| | |
|---|---|
| `GET /api/config` | What can be ordered now, countries served, whether ordering is on. |
| `GET /api/direct/options` | Sizes, frames and prices a painting can have, for a country. |
| `POST /api/checkout` | The painting (JPEG or PNG), the chosen variant and country, a Turnstile token; answers with a Stripe payment page. |
| `POST /stripe/webhook` | Stripe's "paid" message, checked against its signature. Sends the order to Gelato, once (or, with the backend render, starts the job that paints the file). |
| `POST /render/done` | The render job's call back, signed with `RENDER_SECRET`: the order goes to Gelato, once. |
| `GET /files/:key` | The print file, when it is kept in KV. |
| `GET /admin/discover` | Setup. Needs `ADMIN_KEY`. |

It refuses: other websites, files that are not PNGs or JPEGs or are over `MAX_IMAGE_MB`, proportions that are not one of the
studio's five formats, paintings with too few pixels for any variant, a variant or country that is not on offer, more
than `MAX_PER_IP_PER_DAY` per visitor or `MAX_PER_DAY` in total, and anything without a valid Turnstile token when it is
configured. The price of an order is worked out in the Worker, never taken from the browser. A webhook without a
genuine Stripe signature, or older than five minutes, is refused.

## Things to know

- **The Worker cannot check that the picture is really what the studio painted.** The painting is made in the visitor's
  browser; a Worker cannot re-run the ray-traced render. Someone could send any picture of a valid shape, but they pay for
  the print they order. Turnstile, the limits and the format checks make abuse hard.
- **Resolution comes from the visitor's device, not the finish** (when the file is painted in the browser). The studio
  paints at screen size whatever the finish; for an order the shop paints the same painting again at 300 dpi
  (`PRINT_DPI` in shop.js) in a hidden frame and sends that, as a JPEG at quality 0.95 (a 300 dpi A3 as PNG would be 30 MB
  or more). How large it paints depends on what the device can hold while it works (an A3 needs about 3 GB): A3 on a
  computer, A4 on a small one, 10 x 15 cm on a phone (`printLongMm()` in shop.js). Only the sizes that file fills at
  `MIN_DPI` are offered. With the backend render, the job paints up to A2 whatever the device.
- **Gelato fetches the file from its address**, so a print file must stay up until the order is made. On GitHub it
  does; in KV it expires after 120 days. A public repo means anyone can open the print files.
- **Counters are soft**: KV is not atomic, so a burst can overshoot a limit by a few.
- **Not tested against the real services.** What is tested is the Worker's own logic, against pretend services built from
  the documentation (Gelato's API pages, Stripe's webhook signature scheme). Expect small differences on the first real
  run, which is what the safe first run above is for. `wrangler tail` shows what each service answered when something
  fails; visitors only ever see a short error code.
- Gelato asks for CN, JP, KR and RU addresses in local script, so those countries are off the default list.
