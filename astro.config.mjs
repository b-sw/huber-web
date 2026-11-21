import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.huber.info.pl',
  // GitHub Pages serves the preview from a sub-path (/huber-web/). The deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  // The WordPress site uses trailing slashes (/o-nas/, /produkty/rw-pt/). Keep them so links and rankings carry over.
  trailingSlash: 'always',
  build: {
    inlineStylesheets: 'always',
  },
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
});
