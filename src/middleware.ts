import { defineMiddleware } from 'astro:middleware';

// Polish typesetting rule: a one-letter word (a, i, o, u, w, z) must not end a line.
// Bind it to the next word with a non-breaking space in all visible body text.
const ORPHAN = /(?<=^|[\s(„"])([aiouwzAIOUWZ]) +/g;
const CHUNK = /<(script|style|textarea|pre)\b[\s\S]*?<\/\1>|<[^>]*>|[^<]+/gi;

export function bindOrphans(html: string): string {
  const bodyStart = html.indexOf('<body');
  if (bodyStart === -1) return html;
  const body = html
    .slice(bodyStart)
    .replace(CHUNK, (chunk) => (chunk.startsWith('<') ? chunk : chunk.replace(ORPHAN, '$1 ')));
  return html.slice(0, bodyStart) + body;
}

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(bindOrphans(await response.text()), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
