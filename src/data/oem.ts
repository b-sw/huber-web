import { circuitRange, products } from './products';

const range = circuitRange(products);

export type OemSide = 'huber' | 'brand';

export interface OemLayer {
  id: string;
  title: string;
  short: string;
  detail: string;
  side: OemSide;
}

// Bottom to top: what Huber makes, then what carries the client's brand.
export const oemLayers: OemLayer[] = [
  {
    id: 'belka',
    title: 'Belka',
    short: 'Mosiądz albo inox · GW 1″',
    detail: 'Belka zasilania i powrotu z przyłączami GW ½″. Wybierasz mosiądz albo stal nierdzewną.',
    side: 'huber',
  },
  {
    id: 'obwody',
    title: 'Obwody',
    short: `Od ${range.min} do ${range.max}`,
    detail: `Liczba obwodów od ${range.min} do ${range.max}. Każdy obwód to jedna pętla grzewcza pod podłogą.`,
    side: 'huber',
  },
  {
    id: 'wyposazenie',
    title: 'Wyposażenie',
    short: 'Przepływomierze, wkładki, zawory',
    detail: 'Zestaw z katalogu albo własna konfiguracja: przepływomierze, wkładki termostatyczne, zawory, układ mieszający, złączki PEX.',
    side: 'huber',
  },
  {
    id: 'oznaczenie',
    title: 'Oznaczenie',
    short: 'Twoja marka na belce',
    detail: 'Na belce jest Twoje oznaczenie zamiast naszego. Klient hurtowni widzi Twoją markę.',
    side: 'brand',
  },
  {
    id: 'opakowanie',
    title: 'Opakowanie',
    short: 'Twoje pudełko',
    detail: 'Rozdzielacz trafia do Twojego opakowania i jest gotowy do sprzedaży pod Twoją marką.',
    side: 'brand',
  },
];
