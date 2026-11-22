import { defineConfig } from 'astro/config';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: 'https://www.huber.info.pl',
  // GitHub Pages serves the preview from a sub-path (/huber-web/). The deploy workflow sets BASE_PATH.
  base,
  // The WordPress site uses trailing slashes (/o-nas/, /produkty/rw-pt/). Keep them so links and rankings carry over.
  trailingSlash: 'always',
  // Old preview URL of the home page. Astro does not add the base to redirect targets.
  redirects: {
    '/warianty/pudelko-siatka/': base,
  },
  build: {
    inlineStylesheets: 'always',
  },
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
});
