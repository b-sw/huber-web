import { byMaterial, circuitRange, getProduct, type Material } from './products';

const brass = circuitRange(byMaterial('mosiadz'));
const inox = circuitRange(byMaterial('inox'));

// The product that each 3D model shows. The first one shows by default.
export const manifoldProducts: Record<Material, string> = { mosiadz: 'rw-pt', inox: 'rwko-pt' };

// The two halves of a stainless bracket slide on each other, so the height comes as a range.
const [lowest, highest] = getProduct(manifoldProducts.inox).rows[0].H.split('-');

export type PartId =
  | 'rotametry'
  | 'odpowietrznik'
  | 'zasilanie'
  | 'oznaczenie'
  | 'uchwyty'
  | 'wkladki'
  | 'powrot'
  | 'trojnik'
  | 'przylacza';

export type PartSide = 'huber' | 'brand';

export interface PartText {
  short: string;
  detail: string;
}

export interface ManifoldPart extends PartText {
  id: PartId;
  title: string;
  side: PartSide;
  // The side of the drawing where the label sits on wide screens.
  column: 'left' | 'right';
  inox?: Partial<PartText>;
}

// Numbered down the left column, then down the right column.
export const manifoldParts: ManifoldPart[] = [
  {
    id: 'rotametry',
    title: 'Rotametry',
    short: 'Do 2,6 albo 5 l/min',
    detail: 'Na zasilaniu każdego obwodu. Pokazują przepływ wody w pętli. Wybierasz wersję do 2,6 albo do 5 l/min.',
    side: 'huber',
    column: 'left',
    inox: {
      short: 'Na zasilaniu obwodu',
      detail: 'Na zasilaniu każdego obwodu. Pokazują przepływ wody w pętli.',
    },
  },
  {
    id: 'zasilanie',
    title: 'Belka zasilania',
    short: 'Mosiądz · GW 1″',
    detail: 'Doprowadza ciepłą wodę do obwodów. Przyłącze GW 1″, odejścia GW ½″. Wybierasz mosiądz albo stal nierdzewną.',
    side: 'huber',
    column: 'left',
    inox: { short: 'Inox · GW 1″' },
  },
  {
    id: 'uchwyty',
    title: 'Uchwyty montażowe',
    short: '2 szt. · stały rozstaw',
    detail: 'Trzymają obie belki w stałym rozstawie. Nimi mocujesz rozdzielacz do ściany albo do szafki.',
    side: 'huber',
    column: 'left',
    inox: {
      short: '2 szt. · regulowany rozstaw',
      detail: `Trzymają obie belki. Rozstaw belek regulujesz, więc rozdzielacz ma od ${lowest} do ${highest} mm wysokości. Nimi mocujesz go do ściany albo do szafki.`,
    },
  },
  {
    id: 'wkladki',
    title: 'Wkładki termostatyczne',
    short: 'Na powrocie obwodu',
    detail: 'Na powrocie każdego obwodu. Pokrętłem zamykasz i otwierasz pętlę.',
    side: 'huber',
    column: 'left',
  },
  {
    id: 'powrot',
    title: 'Belka powrotu',
    short: 'Mosiądz · GW 1″',
    detail: 'Zbiera schłodzoną wodę z obwodów i odprowadza ją do źródła ciepła.',
    side: 'huber',
    column: 'left',
    inox: { short: 'Inox · GW 1″' },
  },
  {
    id: 'przylacza',
    title: 'Przyłącza obwodów',
    short: `Od ${brass.min} do ${brass.max} · nyple ½″×¾″`,
    detail: `Jedno przyłącze to jedna pętla grzewcza pod podłogą. Rozdzielacz ma od ${brass.min} do ${brass.max} obwodów.`,
    side: 'huber',
    column: 'left',
    inox: {
      short: `Od ${inox.min} do ${inox.max} · nyple ½″×¾″`,
      detail: `Jedno przyłącze to jedna pętla grzewcza pod podłogą. Rozdzielacz ma od ${inox.min} do ${inox.max} obwodów.`,
    },
  },
  {
    id: 'odpowietrznik',
    title: 'Odpowietrznik',
    short: '2 szt. · automatyczny albo\u00a0ręczny',
    detail: 'Usuwa powietrze z instalacji. Jest na końcu każdej belki, w wersji automatycznej albo ręcznej.',
    side: 'huber',
    column: 'right',
  },
  {
    id: 'oznaczenie',
    title: 'Oznaczenie',
    short: 'Twoja marka na belce',
    detail: 'Na belce jest Twoje oznaczenie zamiast naszego. Klient hurtowni widzi Twoją markę.',
    side: 'brand',
    column: 'right',
  },
  {
    id: 'trojnik',
    title: 'Trójnik z zaworem spustowym',
    short: '2 szt. · na końcu belki',
    detail: 'Na końcu każdej belki. Przez zawór spustowy napełniasz albo opróżniasz instalację.',
    side: 'huber',
    column: 'right',
  },
];
