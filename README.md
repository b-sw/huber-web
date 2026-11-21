# huber-web

New website for [huber.info.pl](https://www.huber.info.pl), a family manufacturer of underfloor-heating manifolds
(rozdzielacze do podłogówki) from Nowa Wieś near Włocławek. It replaces the WordPress site.

This first stage contains two home-page proposals. Both put the product range and the new OEM offer first.

Preview: **https://b-sw.github.io/huber-web/** (every push to `main` deploys it).

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
| `/` | Overview of the proposals |
| `/warianty/pudelko-witryna/` | The box hero on a white shop-window page: logo in a notch, big product tiles |
| `/warianty/pudelko-siatka/` | The box hero in a hairline grid (bestboy.dev style) |

Both pages use one background colour for the whole page, slightly rounded buttons and no contact forms. The header
stays visible at all times and holds only section links. Earlier rounds were removed (copies are outside the repo).

Two review tools sit on top of the design. Remove both when one direction is chosen:

- `VariantNav`, the thin black bar at the top, switches between proposals.
- `StylePicker`, the "Styl" button in that bar, switches the button style (Płaski, Wypukły, Uniesiony, Druk) and,
  on the shop-window page, the headline highlight (Taśma, Marker, Płaskie). The choice sits on `<html>` as
  `data-btn` and `data-tape`. When one style is chosen, move its rules into the pages and remove the picker.

## Colours

`src/styles/palette.css` holds one toned warm grey ramp (hue 44) from
[The 1-minute color system](https://simn.so/the-1-minute-color-system). Each page maps its colour roles to ramp steps:
background 50, surfaces 100–150, lines 150–200, text 600–900, buttons 700 with 50 text. Only the headline tape and
small brand marks use step 500, so text never takes the highlight colour. Every text step keeps at least 6.8:1
contrast on the background.

The kraft box, the product photos and the orange sticker keep their real colours. They show physical objects.

## Buttons and links

Both variants use three levels:

| Level | Look | Used for |
| --- | --- | --- |
| Primary | Filled with step 700 | One main action per area: KONTAKT in the header, "Zobacz asortyment" in the hero, "Napisz zapytanie OEM" |
| Secondary | Light outline that darkens on hover, same size as the primary | "Zapytaj o OEM", "Jak działa OEM", "Opisz, czego potrzebujesz", the menu button, and the small "Indeksy i wymiary" and "Zwiń tabelę" |
| Tertiary | Text link, class `.t-link` from `src/styles/links.css` | Indeks toggles, product cards, map, phone and e-mail, "Do góry" |

Buttons are 40px in the page and 36px in the header and for small secondary buttons. On phones they are 44px.
A tertiary link has a light underline that turns solid on hover, and its arrow moves (`.t-link--out` moves it up
and right). Hover never changes a background colour. Arrows: ↗ marks a link that leaves the page (product card, map,
mail app), → marks the main action that stays on the page. The button style (depth and motion) comes from
`StylePicker`.

## Shared parts

| Part | What it does |
| --- | --- |
| `src/components/pudelko/BoxStage.astro` | The kraft box hero with the X-ray reveal (see below) |
| `src/components/oem/OemStack.astro` | Exploded isometric view of an OEM manifold: belka, obwody, wyposażenie, oznaczenie, opakowanie. Unfolds while it scrolls in. Hover, focus or tap lifts the layers above one layer. Themed with `--stack-*` custom properties. Data in `src/data/oem.ts` |
| `src/components/heat/HeatLoops.astro` | Underfloor-heating loops behind one section. A warm spot drifts over the pipes by itself and follows the cursor. Use it where there is little text |
| `src/scripts/reveal.ts`, `src/styles/reveal.css` | Blocks and headline words enter from a soft blur, once. Off under reduced motion. A failsafe shows content if the script never runs |
| `src/scripts/brand.ts` | One brand input updates the box print, the stack plates, stickers and the inquiry e-mail |

## The box hero

- A kraft carton shows a halftone print of the RW-EZMPTR manifold and the visitor's brand.
- The carton is drawn in layers: board faces with light, flute stripes and printed ink, then grey height maps
  blended over the board (soft-light), then tape, edges and the sticker. The height maps keep the board colour and
  break up the ink, like flexo print on kraft. The sticker is clipped to the box outline, so it wraps over the edges.
- An X-ray spot drifts over the box by itself and shows the real manifold inside. A cursor takes over and leaves a
  trail of four shrinking circles. Over the printed label the circles close, so the brand stays readable.
- A transparent button covers the box. Click, tap, Enter or Space opens the whole box.
- Under reduced motion nothing moves by itself. The button still opens the box.
- The visitor types a brand name in the OEM section. It prints on the box, on the bar sticker, and in the subject of the
  inquiry e-mail. `src/scripts/brand.ts` owns that value. Every other element only reads it.

Performance: each circle is a small round window with its own copy of the X-ray (`XrayLayer.astro`). The windows move
only with `transform`, so the browser composites them on the GPU and paints nothing per frame. The first version
rebuilt a mask of 14 gradients on every frame and drew the cardboard grain with a live SVG noise filter. Both forced
full repaints. The grain is now a 38 KB WebP tile plus a 1 KB tone map (`scripts/kraft-grain.py`). Both are static
blend layers, so the lenses still paint nothing per frame. The loop stops when the box is off screen or
the tab is hidden. `geometry.ts` holds the shared frame, so the print and the photo line up by construction.

## Why static rendering

Google and visitors get finished HTML on the first request. Astro renders every page at build time and ships almost
no JavaScript (the hero, catalog and brand field use small inline scripts). The output is plain files, so it runs on
the current Apache hosting or any static host. If a page needs a server later (for example a contact form that sends
email), add an Astro server adapter and render only that route on demand.

Lighthouse, mobile, 21 Nov 2026 (live site vs the new pages served locally):

| | Live WordPress | Pudełko × Witryna | Pudełko × Siatka |
| --- | --- | --- | --- |
| Performance | 80 | 92 | 92 |
| Accessibility | 96 | 100 | 100 |
| Best practices | 73 | 100 | 100 |
| SEO | 92 | 69* | 69* |
| First contentful paint | 2.2 s | 0.8 s | 0.8 s |
| Total blocking time | 410 ms | 0 ms | 30 ms |
| Page weight | 2394 KiB | 579 KiB | 471 KiB |
| Requests | 78 | 25 | 25 |

\* The only failing SEO check is "page is blocked from indexing". The preview is `noindex` on purpose.

## Deployment

`.github/workflows/deploy.yml` type-checks, builds and publishes `dist/` to GitHub Pages on every push to `main`.
GitHub Pages serves the site from `/huber-web/`, so the workflow sets `BASE_PATH`. Internal links go through
`withBase()` in `src/data/paths.ts`.

The preview is `noindex` (`PREVIEW` in `src/layouts/Base.astro`, plus `public/robots.txt`), so this copy never competes
with huber.info.pl in search results.

## SEO checklist for launch

- Set `PREVIEW = false` in `src/layouts/Base.astro` and replace `public/robots.txt`. Add a sitemap.
- Keep the old URLs (`/o-nas/`, `/produkty/`, `/produkty/rw-pt/`, `/kontakt/`). `trailingSlash: 'always'` already matches them.
  Add 301 redirects for anything that changes.
- Every page has a title, meta description, canonical URL, Open Graph tags and JSON-LD (Organization, ItemList of
  products). The current site has no meta description, no H1 and no structured data.
- `src/middleware.ts` keeps Polish one-letter words (w, z, i, o, a, u) from ending a line.

## Content to confirm with Huber

These claims are new or inferred. Check them before launch:

- OEM scope: branding on the manifold bar, custom packaging, configurable equipment.
- "Wysyłka do hurtowni w całej Polsce" and export.
- Contact uses phone and e-mail links. The OEM link opens an e-mail with a template. There is no form on purpose.
- A privacy-policy page (the current site has none).

## Project layout

```
src/
  pages/            index and /warianty/* proposals
  components/       Logo, Icon, VariantNav, StylePicker, pudelko/ (box hero), oem/, heat/, pudelko-witryna/, pudelko-siatka/
  layouts/Base.astro  head tags, canonical, Open Graph, JSON-LD, noindex during the preview
  data/             company.ts, products.json (12 products scraped from the live site), products.ts, oem.ts, paths.ts
  scripts/          brand.ts (brand name), reveal.ts (scroll reveal)
  styles/           reset, Archivo subset @font-face, reveal
  assets/           photos, product PNGs, halftone print, kraft grain, subset fonts
scripts/
  subset-fonts.py   cuts Archivo to Latin + Polish glyphs (173 KB → 51 KB)
  halftone.py       renders the halftone print on the box (only RW-EZMPTR is used)
  kraft-grain.py    renders the cardboard grain tile and tone map
```

The Python scripts need Pillow, and fontTools with brotli. Run them from the repo root.
