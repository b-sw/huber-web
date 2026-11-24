/**
 * Screenshot the top of the home page for link previews (og:image), and draw the touch icon.
 *
 * - src/assets/og/home.png: 1200×630. The header, the box with the lens open over the manifold, and the headline.
 *   The box is drawn smaller than on a real screen, so the whole hero fits the 1.91:1 card. Apps that show a
 *   square crop (WhatsApp, iMessage) keep the middle, which is the box.
 * - public/apple-touch-icon.png: 180×180, the favicon without rounded corners. iOS rounds them itself.
 *
 * The script reads the built site from dist/ and needs Google Chrome. Set CHROME_PATH for another browser.
 *
 * Usage: npm run build && node scripts/og-image.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const ORIGIN = 'http://og.local';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 1440 px shows the side frame lines of the grid. 756 px keeps the 1.91:1 ratio.
const VIEWPORT = { width: 1440, height: 756 };
const OG = { width: 1200, height: 630 };
// The page sizes the box to leave 252 px for the headline. The three-line headline and the label need more.
const FIT_HERO = '.hero-stage { width: min(100%, calc((100svh - var(--hdr) - 320px) * 1200 / 760)) !important; }';
// Where the lens opens, as a fraction of the box: over the manifold body, clear of the label.
const LENS = { x: 0.45, y: 0.45 };

const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

async function serveDist(route) {
  const { pathname } = new URL(route.request().url());
  const file = join(DIST, decodeURIComponent(pathname.endsWith('/') ? `${pathname}index.html` : pathname));
  try {
    await route.fulfill({ body: await readFile(file), contentType: TYPES[extname(file)] });
  } catch {
    await route.fulfill({ status: 404 });
  }
}

async function screenshotHero() {
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    await page.route(`${ORIGIN}/**`, serveDist);
    await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: FIT_HERO });
    // Let the headline and the rules finish their entry animation.
    await page.waitForTimeout(2500);

    const box = await page.locator('[data-stage]').boundingBox();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width * LENS.x, box.y + box.height * LENS.y, { steps: 20 });
    await page.waitForTimeout(2500);

    return await page.screenshot();
  } finally {
    await browser.close();
  }
}

async function touchIcon() {
  const svg = await readFile(join(ROOT, 'public/favicon.svg'), 'utf8');
  return sharp(Buffer.from(svg.replace(' rx="6"', '')), { density: 576 }).resize(180, 180).png().toBuffer();
}

await mkdir(join(ROOT, 'src/assets/og'), { recursive: true });
const hero = await screenshotHero();
await writeFile(
  join(ROOT, 'src/assets/og/home.png'),
  await sharp(hero).resize(OG.width, OG.height, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer(),
);
await writeFile(join(ROOT, 'public/apple-touch-icon.png'), await touchIcon());
console.log('Wrote src/assets/og/home.png and public/apple-touch-icon.png');
