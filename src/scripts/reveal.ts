// Scroll reveal: blocks and headline words come in from a soft blur, once.
// The page adds `reveal-on` to <html> in an inline head script, so hidden content never flashes.
// `reveal-live` turns off the CSS failsafe that shows everything if this script never runs.

const WORD_STEP_MS = 38;
const WORD_MAX_MS = 700;
const BREAKABLE = /([ \t\n\r]+)/;

function splitWords(el: HTMLElement) {
  let count = 0;
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
        continue;
      }
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
      const fragment = document.createDocumentFragment();
      for (const part of child.textContent.split(BREAKABLE)) {
        if (!part) continue;
        if (BREAKABLE.test(part)) {
          fragment.append(part);
          continue;
        }
        const word = document.createElement('span');
        word.className = 'rw';
        word.textContent = part;
        word.style.setProperty('--w', String(Math.min(count++ * WORD_STEP_MS, WORD_MAX_MS)));
        fragment.append(word);
      }
      child.replaceWith(fragment);
    }
  };
  walk(el);
}

export function initReveal() {
  const html = document.documentElement;
  const targets = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  html.classList.add('reveal-live');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach((el) => el.setAttribute('data-shown', ''));
    return;
  }

  targets.filter((el) => el.dataset.reveal === 'words').forEach(splitWords);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-shown', '');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  targets.forEach((el) => observer.observe(el));
}
