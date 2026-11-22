// Single owner of the visitor's OEM brand name.
// Inputs write to it. Printed labels, the bar sticker and the inquiry e-mail link read from it.

const PLACEHOLDER = 'TWOJA MARKA';
const MAX_LENGTH = 24;

let brand = '';

export function printedBrand(): string {
  return brand ? brand.toLocaleUpperCase('pl') : PLACEHOLDER;
}

function fitHtml(el: HTMLElement) {
  el.style.setProperty('--fit', '1');
  el.style.setProperty('--fit', String(Math.min(1, el.clientWidth / el.scrollWidth)));
}

// Scales the whole name, so a long name gets smaller but keeps its letter shapes.
function fitSvg(el: SVGTextElement) {
  const max = Number(el.dataset.brandFitSvg);
  el.style.removeProperty('font-size');
  const length = el.getComputedTextLength();
  if (length > max) el.style.fontSize = `${(parseFloat(getComputedStyle(el).fontSize) * max) / length}px`;
}

function inquiryHref(email: string): string {
  const subject = brand ? `Zapytanie OEM – ${brand}` : 'Zapytanie OEM';
  const body = [
    'Dzień dobry,',
    '',
    `interesuje nas produkcja rozdzielaczy pod marką ${brand || '…'}.`,
    '',
    'Zestawy i liczba obwodów:',
    'Ilości:',
    'Termin:',
    '',
    'Pozdrawiam',
  ].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function render() {
  const text = printedBrand();
  document.querySelectorAll<HTMLElement | SVGTextElement>('[data-brand]').forEach((el) => {
    el.textContent = text;
  });
  document.querySelectorAll<HTMLElement>('[data-brand-fit]').forEach(fitHtml);
  document.querySelectorAll<SVGTextElement>('[data-brand-fit-svg]').forEach(fitSvg);
  document.querySelectorAll<HTMLAnchorElement>('[data-brand-mailto]').forEach((link) => {
    link.href = inquiryHref(link.dataset.brandMailto!);
  });
}

export function initBrand() {
  const inputs = document.querySelectorAll<HTMLInputElement>('[data-brand-input]');
  inputs.forEach((input) => {
    input.maxLength = MAX_LENGTH;
    input.addEventListener('input', () => {
      brand = input.value.trim().slice(0, MAX_LENGTH);
      inputs.forEach((other) => {
        if (other !== input) other.value = input.value;
      });
      render();
    });
  });
  render();
  document.fonts?.ready.then(render);
}
