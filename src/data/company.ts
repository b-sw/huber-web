export const company = {
  name: 'Huber',
  tagline: 'Producent rozdzielaczy do podłogówki',
  foundingYear: 1997,
  phone: '+48 54 235 51 46',
  phoneHref: 'tel:+48542355146',
  email: 'huber@huber.info.pl',
  address: {
    street: 'ul. Jana Pawła II 9a',
    village: 'Nowa Wieś k/Włocławka',
    postalCode: '87-853',
    city: 'Kruszyn',
    country: 'PL',
  },
  mapUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Huber, ul. Jana Pawła II 9a, 87-853 Kruszyn'),
  liveSite: 'https://www.huber.info.pl',
} as const;

export const yearsInBusiness = new Date().getFullYear() - company.foundingYear;

// Copy from the current site ("Kim jesteśmy?" and "O nas").
export const about = {
  intro:
    'Jesteśmy rodzinną firmą produkcyjną z wieloletnim doświadczeniem w branży grzewczej. Specjalizujemy się w produkcji rozdzielaczy do ogrzewania podłogowego, oferując naszym partnerom rozwiązania OEM pod indywidualne zamówienia.',
  mission:
    'Naszą misją jest połączenie najwyższej jakości z konkurencyjnością. Opieramy się na wieloletnim doświadczeniu w obróbce metali i stale poszerzamy naszą ofertę.',
  reputation:
    'Nasze wyroby są doceniane zarówno w kraju, jak i za granicą, a my jesteśmy postrzegani jako solidny, godny zaufania partner, dla którego priorytetem jest pełne zadowolenie klienta.',
  wholesale:
    'Rozumiemy potrzeby rynku hurtowego, dlatego dostarczamy niezawodne rozwiązania dopasowane do Twoich oczekiwań. Stawiamy na jakość, terminowość i długoterminową współpracę.',
};

export const guarantees = [
  {
    title: 'Wysoka jakość',
    text: 'Solidne i niezawodne rozdzielacze do ogrzewania podłogowego: precyzyjne wykonanie, trwałość i optymalne parametry pracy.',
  },
  {
    title: 'Stabilna współpraca',
    text: 'Współpracujemy z hurtowniami w całym kraju. Oferujemy atrakcyjne warunki handlowe i wsparcie techniczne.',
  },
  {
    title: 'Szybka dostawa',
    text: 'Nowoczesna produkcja i sprawna logistyka to krótkie terminy realizacji, ciągłość dostaw i pełna dostępność produktów.',
  },
];

// Copy from the "Dlaczego wybieramy ogrzewanie podłogowe?" section, shortened.
export const benefits = [
  {
    id: 'koszty',
    title: 'Niższe rachunki',
    text: 'Podłogówka pracuje na niższej temperaturze wody niż grzejniki. Zużywa mniej energii.',
  },
  {
    id: 'gradient',
    title: 'Ciepłe stopy, chłodna głowa',
    text: 'Ciepło rozchodzi się równo od podłogi. Taki rozkład temperatury jest najbardziej naturalny dla organizmu.',
  },
  {
    id: 'aranzacja',
    title: 'Swoboda aranżacji',
    text: 'Bez grzejników ustawisz meble, gdzie chcesz. System działa w domach i w budynkach publicznych.',
  },
  {
    id: 'higiena',
    title: 'Mniej kurzu i alergenów',
    text: 'Mniejsza cyrkulacja kurzu pomaga alergikom. Brak wilgotnych powierzchni ogranicza pleśń i roztocza.',
  },
  {
    id: 'estetyka',
    title: 'Czyste ściany',
    text: 'Ukryty system nie psuje wnętrza. Zyskujesz miejsce i minimalistyczny wygląd.',
  },
  {
    id: 'trwalosc',
    title: 'Na dziesiątki lat',
    text: 'Dobrze zaprojektowana i zamontowana podłogówka działa bezawaryjnie przez kilkadziesiąt lat.',
  },
  {
    id: 'regulacja',
    title: 'Sama się reguluje',
    text: 'Współpracuje z inteligentnymi termostatami. Utrzymuje komfort bez ręcznej regulacji.',
  },
];
