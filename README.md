# huber-web

New website for [huber.info.pl](https://www.huber.info.pl), a family manufacturer of underfloor-heating manifolds
(rozdzielacze do podłogówki) from Nowa Wieś near Włocławek. It replaces the WordPress site.

This first stage contains the home page. It puts the product range and the new OEM offer first.

Live: **https://www.huber.info.pl** on Cloudflare Workers. Preview: **https://b-sw.github.io/huber-web/**.

## Run it

Node 24 is required (Astro 7 needs Node ≥ 22.23.4). The repo has an `.nvmrc`.

```sh
nvm use
npm install
npm run dev       # http://localhost:4321
npm run build     # static HTML in dist/
npm run preview   # serve dist/
npm run check     # type check
```

## Pages

| Path | What it is |
| --- | --- |
| `/` | The home page: the box hero in a hairline grid (bestboy.dev style) |
| `/warianty/pudelko-siatka/` | Redirects to `/`. The chosen proposal had this preview address |
| Old WordPress pages | `public/_redirects` sends `/o-nas/`, `/kontakt/`, `/produkty/…` and others to sections of `/` |

The page uses one background colour, slightly rounded buttons and no contact forms. The header stays visible at all
times and holds only section links. The other proposals, the review bar and the style picker were removed. Git
history keeps them.

## Colours

`src/styles/palette.css` holds one toned orange ramp (hue 49) from
[The 1-minute color system](https://simn.so/the-1-minute-color-system). The page maps its colour roles to ramp steps:
background 50, surfaces 100–150, lines 150–200, text 550–900, buttons 600 with 50 text. Only small brand marks use
step 500, so text never takes the highlight colour. Every text step keeps at least 5.8:1
contrast on the background.

The kraft box, the product photos and the orange sticker keep their real colours. They show physical objects.

## Buttons and links

The page uses three levels:

| Level | Look | Used for |
| --- | --- | --- |
| Primary | Filled with step 600 | One main action per area: "Zobacz asortyment" in the hero, "Napisz zapytanie OEM" |
| Secondary | Light face with an edge that darkens on hover, same size as the primary | "Zapytaj o OEM", the menu button, and the small "Indeksy i wymiary" and "Zwiń tabelę" |
| Tertiary | Text link, class `.t-link` from `src/styles/links.css` | Indeks toggles, product cards, map, phone and e-mail, "Do góry" |

Buttons are 40px in the page and 36px in the header and for small secondary buttons. On phones they are 44px.
A tertiary link has a light underline that turns solid on hover, and its arrow moves (`.t-link--out` moves it up
and right). Hover never changes a background colour. Arrows: ↗ marks a link that leaves the page (product card, map,
mail app), → marks the main action that stays on the page.

`src/styles/buttons.css` owns the button colours, depth and motion. A button sits on a darker base, like a key. It
rises on hover and sinks on press. An open catalog toggle stays pressed in. Each component keeps its own size and
font.

## Shared parts

| Part | What it does |
| --- | --- |
| `src/components/pudelko/BoxStage.astro` | The kraft box hero with the X-ray reveal (see below) |
| `src/components/oem/ManifoldExploded.astro` | Exploded 3D manifold in the OEM section. The parts float apart while it scrolls in. On wide screens the labels stay still and their leader lines follow the floating parts. Hover, focus or tap highlights one part. A switch above the view swaps the brass RW-PT model and the stainless RWKO-PT model: the parts fold together while the camera turns, the model changes, and the parts spread again. `manifold-brass.ts` and `manifold-steel.ts` build the models from primitives measured on the product photos (the steel one also on the side drawing). `manifold-kit.ts` holds what both models share. `manifold-scene.ts` draws them and picks parts. Without WebGL the product photo shows. Themed with `--stack-*` custom properties. Part texts in `src/data/manifold.ts` |
| `src/components/heat/HeatLoops.astro` | Underfloor-heating loops behind one section. A warm spot drifts over the pipes by itself and follows the cursor. Use it where there is little text |
| `src/scripts/reveal.ts`, `src/styles/reveal.css` | Blocks and headline words enter from a soft blur, once. Off under reduced motion. A failsafe shows content if the script never runs |
| `src/scripts/brand.ts` | One brand input updates the box tape and label, the sticker on the 3D manifold and the bar photo |

## The box hero

- A plain kraft carton with the visitor's brand on the client's own packing tape and label. Huber does not print on
  boxes. OEM clients send their tape and stickers.
- The tape closes the lid in a +: one strip on the flap seam, one across the middle. Each strip has a flat frame
  (`tapes` in `geometry.ts`), and each face it covers maps that frame onto the drawing. So the brand print continues
  over the box edges and ends in the zigzag cut of a tape dispenser.
- A technical drawing of the manifold in palette brown lies over the plain front, like an overlay, so the box shows
  what it holds. `ManifoldDrawing.astro` draws clean parts (bars, valves, caps, brackets, pump, gauges) with centre
  lines. Its coordinates are measured in the pixels of the product photo, so the drawing and the X-ray line up. It
  stops with a small gap around the tape and the orange sticker, so their print stays clear. On a small box only the
  outlines show.
- The carton is drawn in layers: board faces with light and flute stripes, then grey height maps blended over the
  board (soft-light), then the paper label, the tape, edges, the orange sticker and the drawing on top. The orange
  sticker is clipped to the box outline, so it wraps over the edges.
- An X-ray spot drifts over the box by itself and shows the real manifold inside. A cursor takes over and leaves a
  trail of four shrinking circles. Over the label the circles close, so the brand stays readable.
- A transparent button covers the box. Click, tap, Enter or Space opens the whole box.
- Under reduced motion nothing moves by itself. The button still opens the box.
- The visitor types a brand name in the OEM section. It appears on the box tape and label and on the bar sticker.
  `src/scripts/brand.ts` owns that value. Every other element only reads it.

Performance: each circle is a small round window with its own copy of the X-ray (`XrayLayer.astro`). The windows move
only with `transform`, so the browser composites them on the GPU and paints nothing per frame. The first version
rebuilt a mask of 14 gradients on every frame and drew the cardboard grain with a live SVG noise filter. Both forced
full repaints. The grain is now a 38 KB WebP tile plus a 1 KB tone map (`scripts/kraft-grain.py`). Both are static
blend layers, so the lenses still paint nothing per frame. The loop stops when the box is off screen or
the tab is hidden. `geometry.ts` holds the shared frame, so the box and the photo line up by construction.

## Why static rendering

Google and visitors get finished HTML on the first request. Astro renders every page at build time and ships almost
no JavaScript (the hero, catalog and brand field use small inline scripts). The output is plain files, so it runs on
the current Apache hosting or any static host. If a page needs a server later (for example a contact form that sends
email), add an Astro server adapter and render only that route on demand.

Lighthouse, mobile, 21 Nov 2026 (live site vs the new page served locally):

| | Live WordPress | New home page |
| --- | --- | --- |
| Performance | 80 | 92 |
| Accessibility | 96 | 100 |
| Best practices | 73 | 100 |
| SEO | 92 | 69* |
| First contentful paint | 2.2 s | 0.8 s |
| Total blocking time | 410 ms | 30 ms |
| Page weight | 2394 KiB | 471 KiB |
| Requests | 78 | 25 |

\* Measured on the preview, which was `noindex`. That was the only failing SEO check.

## Deployment

The live site is the `huber-web` Worker on Cloudflare (`wrangler.jsonc`). It serves `dist/` as static assets on
`www.huber.info.pl`. `npm run deploy` builds and deploys it with Wrangler. Cloudflare Workers Builds can deploy every
push to `main`. The bare `huber.info.pl` stays on the az.pl server, which hosts the e-mail and redirects to `www`.

`.github/workflows/deploy.yml` type-checks, builds and publishes `dist/` to GitHub Pages on every push to `main`.
GitHub Pages serves the site from `/huber-web/`, so the workflow sets `BASE_PATH`. Internal links go through
`withBase()` in `src/data/paths.ts`. Every page has a canonical URL on `www.huber.info.pl`, so search engines treat
the live site as the original.

## SEO

- `public/robots.txt` allows all crawlers and points to `public/sitemap.xml`. Add new pages to the sitemap.
- The old WordPress URLs redirect with 301 to sections of the home page (`public/_redirects`). When a product page is
  rebuilt at `/produkty/<slug>/`, remove the matching redirect.
- Every page has a title, meta description, canonical URL, Open Graph tags and JSON-LD (Organization, ItemList of
  products). The old WordPress site had no meta description, no H1 and no structured data.
- Link previews use `src/assets/og/home.png`, a 1200×630 screenshot of the hero with the lens open over the
  manifold. The page gives previews a shorter title and description than Google gets. After a visible change to the
  hero, run `npm run build && node scripts/og-image.mjs`, then build again. The script also draws
  `public/apple-touch-icon.png` from the favicon. It needs Google Chrome (or `CHROME_PATH`).
- `src/middleware.ts` keeps Polish one-letter words (w, z, i, o, a, u) from ending a line.

## Analytics

`src/components/PostHog.astro` loads PostHog (EU Cloud) on every page. It runs in cookieless mode: it sets no cookies
and writes nothing to browser storage, so the site needs no consent banner. PostHog counts visitors with a daily hash on
its servers. Because of this, a returning visitor counts as new each day, and there is no session replay and no GeoIP.
The PostHog project must keep **Settings › Web analytics › Cookieless tracking** on, or PostHog drops every event.

The token and host are constants in the component. The token is public: it only sends events, and every visitor's
browser gets it in the page source. The script starts only on the `site` host from `astro.config.mjs`
(`www.huber.info.pl`), so `npm run dev`, `npm run preview` and the GitHub Pages preview send nothing.

## Content to confirm with Huber

These claims are new or inferred. Check them before launch:

- OEM scope: branding on the manifold bar, configurable equipment. Packaging is confirmed: a plain box with the
  client's tape and stickers, no print.
- "Wysyłka do hurtowni w całej Polsce" and export.
- Contact uses phone and e-mail links. The OEM link opens an e-mail with a template. There is no form on purpose.
- A privacy-policy page (the current site has none).
- The stainless RWKO-PT bracket: its two halves slide on each other, so the beam spacing changes. This comes from
  the product photo and the height range of 308–403 mm. The 3D model and the part label "regulowany rozstaw" use it.
- The flow range of the RWKO-PT rotameters. The live site gives none, so the Inox label names their position. The
  brass label says "Do 2,6 albo 5 l/min".

## Project layout

```
src/
  pages/            index.astro, the home page
  components/       Logo, Icon, pudelko/ (box hero), oem/, heat/, pudelko-siatka/ (page sections)
  layouts/Base.astro  head tags, canonical, Open Graph, JSON-LD, noindex during the preview, PostHog
  data/             company.ts, products.json (12 products scraped from the live site), products.ts, oem.ts, paths.ts
  scripts/          brand.ts (brand name), reveal.ts (scroll reveal)
  styles/           reset, palette, buttons, links, Archivo subset @font-face, reveal
  assets/           photos, product PNGs, kraft grain, subset fonts, og (link preview)
scripts/
  subset-fonts.py   cuts Archivo to Latin + Polish glyphs (173 KB → 51 KB)
  kraft-grain.py    renders the cardboard grain tile and tone map
  og-image.mjs      screenshots the hero for link previews and draws the touch icon
```

The Python scripts need Pillow, and fontTools with brotli. Run them from the repo root.
