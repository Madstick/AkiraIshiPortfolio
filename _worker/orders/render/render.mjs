// Paints one print file: opens the studio page with `&print=<pixels>` in headless Chrome, waits for the painting to
// finish and saves the canvas as a JPEG. Run by render.yml in the prints repo, after a paid order.
//
//   URL=<studio page with &print=N>  OUT=prints/<key>.jpg  SITE=https://akiraishi.com  node render/render.mjs
//
// CHROME may point at another browser (the runner's own Chrome by default).
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const url = process.env.URL || '';
const out = process.env.OUT || '';
const site = (process.env.SITE || 'https://akiraishi.com').replace(/\/$/, '');

// Only the studio page of the shop's own site, and only a file of the prints folder
if (!url.startsWith(`${site}/still-life-code.html?`) || !/[?&]print=\d{3,5}(&|$)/.test(url)) throw new Error(`refused url: ${url}`);
if (!/^[\w-]+\/[a-f0-9]{40}\.jpg$/.test(out)) throw new Error(`refused path: ${out}`);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  protocolTimeout: 10 * 60 * 1000,
  // a 300 dpi A2 holds several gigabytes of working buffers while it paints
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--js-flags=--max-old-space-size=12000'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('page error:', m.text()); });
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });

  const t0 = Date.now();
  let last = '';
  for (;;) {
    const s = await page.$eval('#status', (e) => e.textContent.trim()).catch(() => '');
    if (s !== last) { console.log(`${Math.round((Date.now() - t0) / 1000)}s ${s}`); last = s; }
    if (/^finished/i.test(s)) break;
    if (/^error/i.test(s)) throw new Error(s);
    if (Date.now() - t0 > 50 * 60 * 1000) throw new Error('the painting took more than 50 minutes');
    await new Promise((r) => setTimeout(r, 3000));
  }

  const { w, h, data } = await page.evaluate(() => {
    const c = document.getElementById('c');
    return { w: c.width, h: c.height, data: c.toDataURL('image/jpeg', 0.95) };
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`wrote ${out}, ${w} x ${h} px`);
} finally {
  await browser.close();
}
