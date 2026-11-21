export interface Variant {
  slug: string;
  name: string;
  audience: string;
  idea: string;
  palette: string[];
  fonts: string;
}

export const variants: Variant[] = [
  {
    slug: 'pudelko-witryna',
    name: 'Pudełko × Witryna',
    audience: 'Hurtownie i marki OEM',
    idea: 'Pudełko z wariantu 1 na białej witrynie z wariantu 6. Duże kafle produktów, warstwy OEM, płynne przejścia.',
    palette: ['#ffffff', '#111111', '#c69c6d'],
    fonts: 'Archivo (wąski) + Plex Mono',
  },
  {
    slug: 'pudelko-siatka',
    name: 'Pudełko × Siatka',
    audience: 'Hurtownie, instalatorzy, marki OEM',
    idea: 'Pudełko z wariantu 1 w siatce cienkich linii z wariantu 2. Rozdzielacz OEM rozłożony na części, katalog z indeksami, płynne przejścia.',
    palette: ['#f9f9f7', '#18181b', '#c69c6d'],
    fonts: 'Geist + Geist Mono',
  },
];
