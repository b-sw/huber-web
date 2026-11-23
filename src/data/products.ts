import type { ImageMetadata } from 'astro';
import data from './products.json';
import drawingData from './drawings.json';
import { company } from './company';

export type Material = 'mosiadz' | 'inox';
export type Vent = 'auto' | 'manual' | 'none';

export interface ProductRow {
  circuits: number;
  L: string;
  H: string;
  G: string;
  indexes: string[];
}

export interface Product {
  slug: string;
  code: string;
  material: Material;
  title: string;
  features: {
    flowMeters: boolean;
    thermostaticInserts: boolean;
    shutOffValves: boolean;
    mixingUnit: boolean;
    pex: boolean;
    vent: Vent;
  };
  includes: string[];
  variants: string[];
  rows: ProductRow[];
}

export const products = data as Product[];

// products.json lists only part of the range. Until it is complete, the page says "ponad" this many configurations.
export const configFloor = 20;

export const materials: Record<Material, { label: string; name: string; bar: string }> = {
  mosiadz: {
    label: 'Mosiądz',
    name: 'Rozdzielacze mosiężne',
    bar: 'belka mosiężna GW 1″',
  },
  inox: {
    label: 'Inox',
    name: 'Rozdzielacze ze stali nierdzewnej',
    bar: 'belka INOX GW 1″',
  },
};

export const ventLabels: Record<Vent, string> = {
  auto: 'odpowietrznik automatyczny',
  manual: 'odpowietrznik ręczny',
  none: 'bez trójnika z odpowietrznikiem',
};

const images = import.meta.glob<{ default: ImageMetadata }>('../assets/products/*.png', { eager: true });

export function productImage(slug: string): ImageMetadata {
  const image = images[`../assets/products/${slug}.png`];
  if (!image) throw new Error(`Missing product image for ${slug}`);
  return image.default;
}

// scripts/drawings.py writes the drawings and their dimensions. Positions are percent of the drawing.
// A dimension without `at` sits outside the drawing: below it for the x axis, on its right for the y axis.
export interface Dimension {
  label: string;
  axis: 'x' | 'y';
  from: number;
  to: number;
  at?: number;
}

const drawings = import.meta.glob<{ default: ImageMetadata }>('../assets/drawings/*.png', { eager: true });
const dimensions = drawingData as Record<string, Dimension[]>;

export function productDrawing(slug: string): { image: ImageMetadata; dims: Dimension[] } {
  const image = drawings[`../assets/drawings/${slug}.png`];
  const dims = dimensions[slug];
  if (!image || !dims) throw new Error(`Missing technical drawing for ${slug}`);
  return { image: image.default, dims };
}

export function byMaterial(material: Material): Product[] {
  return products.filter((p) => p.material === material);
}

export function getProduct(slug: string): Product {
  const product = products.find((p) => p.slug === slug);
  if (!product) throw new Error(`Unknown product ${slug}`);
  return product;
}

export function circuitRange(list: Product[]): { min: number; max: number } {
  const all = list.flatMap((p) => p.rows.map((r) => r.circuits));
  return { min: Math.min(...all), max: Math.max(...all) };
}

export function featureList(p: Product): string[] {
  const f = p.features;
  const list: string[] = [];
  if (f.mixingUnit) list.push('układ mieszający z pompą WILO');
  if (f.flowMeters) list.push('przepływomierze');
  if (f.thermostaticInserts) list.push('wkładki termostatyczne');
  if (f.shutOffValves) list.push('zawory odcinające');
  if (f.pex) list.push('złączki PEX');
  list.push(ventLabels[f.vent]);
  return list;
}

// Product detail pages are not rebuilt yet, so link to the live WordPress pages.
// The new site keeps the same paths, so this becomes `/produkty/${slug}/` at launch.
export function productUrl(slug: string): string {
  return `${company.liveSite}/produkty/${slug}/`;
}
