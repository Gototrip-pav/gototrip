import { NextRequest, NextResponse } from 'next/server';

type DestinationStyle = 'classic' | 'surprising' | 'offbeat';

type GooglePlace = {
  id?: string;
  displayName?: {
    text?: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
  googleMapsUri?: string;
};

type DestinationCandidate = {
  slug: string;
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  weather: string;
  rating: number | null;
  userRatingCount: number;
  types: string[];
  primaryType: string;
  googleMapsUri: string;
  source: string;
  destinationStyle?: DestinationStyle;
  destinationStyleLabel?: string;
};

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function getCountryFromAddress(address: string) {
  const parts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[parts.length - 1] || '';
}

function parseDestinationStyles(value: string): DestinationStyle[] {
  const allowed: DestinationStyle[] = ['classic', 'surprising', 'offbeat'];

  const styles = value
    .split(',')
    .map((item) => normalizeText(item).trim())
    .filter((item): item is DestinationStyle =>
      allowed.includes(item as DestinationStyle)
    );

  if (styles.length === 0) {
    return ['surprising'];
  }

  return Array.from(new Set(styles));
}

function getStyleLabel(style?: DestinationStyle) {
  if (style === 'classic') return 'Valeur sûre';
  if (style === 'surprising') return 'Pépite';
  if (style === 'offbeat') return 'Décalée';
  return 'Suggestion';
}

function isHighBudget(budget: number, persons: number) {
  const safePersons = Math.max(1, persons || 1);
  const budgetPerPerson = budget / safePersons;

  return budget >= 3000 || budgetPerPerson >= 1200;
}

function isVeryHighBudget(budget: number, persons: number) {
  const safePersons = Math.max(1, persons || 1);
  const budgetPerPerson = budget / safePersons;

  return budget >= 7000 || budgetPerPerson >= 2500;
}

function hasBlockedType(place: GooglePlace) {
  const types = place.types || [];
  const primaryType = place.primaryType || '';

  const allTypes = [primaryType, ...types].map(normalizeText);

  const blockedTypes = [
    'lodging',
    'hotel',
    'campground',
    'rv_park',
    'restaurant',
    'food',
    'bar',
    'cafe',
    'tourist_attraction',
    'amusement_park',
    'aquarium',
    'zoo',
    'museum',
    'park',
    'shopping_mall',
    'establishment',
    'point_of_interest',
    'spa',
    'resort',
    'premise',
    'store',
    'tourist_information_center',
    'landmark',
  ];

  return allTypes.some((type) =>
    blockedTypes.some((blocked) => type.includes(normalizeText(blocked)))
  );
}

function hasAllowedDestinationType(place: GooglePlace) {
  const types = place.types || [];
  const primaryType = place.primaryType || '';

  const allTypes = [primaryType, ...types].map(normalizeText);

  const allowedTypes = [
    'locality',
    'postal_town',
    'administrative_area_level_1',
    'administrative_area_level_2',
    'administrative_area_level_3',
    'political',
  ];

  return allTypes.some((type) =>
    allowedTypes.some((allowed) => type.includes(normalizeText(allowed)))
  );
}

function looksLikeBadDestinationName(name: string) {
  const text = normalizeText(name);

  const blockedWords = [
    'hotel',
    'resort',
    'village',
    'camping',
    'campground',
    'holiday park',
    'parc',
    'park',
    'spa',
    'restaurant',
    'bar',
    'cafe',
    'auberge',
    'hostel',
    'guesthouse',
    'apartment',
    'appartement',
    'villa',
    'residence',
    'chalet',
    'domaine',
    'center parcs',
    'golden lakes',
    'grand-place',
    'grand place',
    'see-eu',
    'see eu',
    'plaza',
    'square',
    'place ',
    'palace',
    'station',
    'airport',
    'aeroport',
    'gare',
    'monument',
    'museum',
    'musee',
    'zoo',
    'aquarium',
    'castle',
    'chateau',
    'fort',
    'bridge',
    'pont',
    'tower',
    'tour ',
    'mall',
    'centre commercial',
  ];

  return blockedWords.some((word) => text.includes(normalizeText(word)));
}

function looksLikeUsefulDestinationName(name: string) {
  const text = normalizeText(name);

  if (!text) return false;
  if (text.length < 3) return false;

  const tooGeneric = [
    'europe',
    'world',
    'monde',
    'france',
    'spain',
    'espagne',
    'italy',
    'italie',
    'portugal',
    'belgium',
    'belgique',
    'germany',
    'allemagne',
    'netherlands',
    'pays-bas',
    'united kingdom',
    'royaume-uni',
    'united states',
    'etats-unis',
    'canada',
    'japan',
    'japon',
  ];

  if (tooGeneric.includes(text)) return false;

  const badPatterns = [
    /^[a-z]{1,3}-[a-z]{1,3}$/i,
    /^[a-z]{1,3}\s?[–-]\s?[a-z]{1,3}$/i,
  ];

  if (badPatterns.some((pattern) => pattern.test(name))) {
    return false;
  }

  return true;
}

function isClearlySeaDestination(place: GooglePlace) {
  const text = normalizeText(
    `${place.displayName?.text || ''} ${place.formattedAddress || ''}`
  );

  const seaKeywords = [
    'beach',
    'plage',
    'sea',
    'seaside',
    'coast',
    'coastal',
    'cote',
    'riviera',
    'island',
    'ile',
    'iles',
    'balearic',
    'baleares',
    'canaries',
    'crete',
    'mallorca',
    'majorque',
    'sardinia',
    'sardaigne',
    'sicily',
    'sicile',
    'corsica',
    'corse',
    'malta',
    'malte',
    'algarve',
    'faro',
    'nice',
    'cannes',
    'antibes',
    'marseille',
    'toulon',
    'barcelona',
    'barcelone',
    'valencia',
    'valence',
    'lisbon',
    'lisbonne',
    'porto',
    'naples',
    'napoli',
    'venice',
    'venise',
    'athens',
    'athenes',
    'chania',
    'la canee',
    'heraklion',
    'ibiza',
    'palma',
    'split',
    'dubrovnik',
    'zadar',
    'rimini',
    'amalfi',
    'sorrento',
    'cinque terre',
    'san sebastian',
    'biarritz',
    'la rochelle',
    'arcachon',
    'saint-malo',
    'deauville',
    'le touquet',
    'ostende',
    'ostend',
    'miami',
    'los angeles',
    'honolulu',
    'rio de janeiro',
    'bali',
    'phuket',
    'dubai',
    'dubaï',
    'singapore',
    'singapour',
    'kotor',
    'pula',
    'cagliari',
    'syracuse',
    'funchal',
    'essaouira',
  ];

  const inlandBlocked = [
    'bruges',
    'brugge',
    'gand',
    'gent',
    'bruxelles',
    'brussels',
    'paris',
    'lille',
    'lyon',
    'madrid',
    'berlin',
    'munich',
    'prague',
    'vienna',
    'vienne',
    'budapest',
    'cologne',
    'dusseldorf',
    'dortmund',
    'luxembourg',
    'strasbourg',
    'reims',
    'nancy',
    'metz',
  ];

  if (inlandBlocked.some((word) => text.includes(normalizeText(word)))) {
    return false;
  }

  return seaKeywords.some((word) => text.includes(normalizeText(word)));
}

function isClearlyMountainDestination(place: GooglePlace) {
  const text = normalizeText(
    `${place.displayName?.text || ''} ${place.formattedAddress || ''}`
  );

  const mountainKeywords = [
    'mountain',
    'montagne',
    'alpes',
    'alps',
    'pyrenees',
    'pyrénées',
    'dolomites',
    'chamonix',
    'annecy',
    'grenoble',
    'zermatt',
    'interlaken',
    'innsbruck',
    'lucerne',
    'queenstown',
    'banff',
    'aspen',
    'courmayeur',
    'cortina',
    'andorra',
    'andorre',
  ];

  return mountainKeywords.some((word) => text.includes(normalizeText(word)));
}

function passesEnvironmentFilter(place: GooglePlace, environment: string) {
  const env = normalizeText(environment);

  if (env.includes('mer')) {
    return isClearlySeaDestination(place);
  }

  if (env.includes('montagne')) {
    return isClearlyMountainDestination(place);
  }

  return true;
}

function isValidDestination(place: GooglePlace) {
  const name = place.displayName?.text || '';
  const lat = Number(place.location?.latitude);
  const lng = Number(place.location?.longitude);

  if (!name) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (!looksLikeUsefulDestinationName(name)) return false;
  if (looksLikeBadDestinationName(name)) return false;

  const allowed = hasAllowedDestinationType(place);
  const blocked = hasBlockedType(place);

  if (!allowed) return false;
  if (blocked && !allowed) return false;

  return true;
}

function uniqueByNameAndCountry(places: GooglePlace[]) {
  const seen = new Set<string>();

  return places.filter((place) => {
    const name = place.displayName?.text || '';
    const country = getCountryFromAddress(place.formattedAddress || '');
    const key = `${normalizeText(name)}-${normalizeText(country)}`;

    if (!name || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildStyleQueries({
  style,
  environment,
  highBudget,
  veryHighBudget,
  longTrip,
}: {
  style: DestinationStyle;
  environment: string;
  highBudget: boolean;
  veryHighBudget: boolean;
  longTrip: boolean;
}) {
  const env = normalizeText(environment);
  const queries: string[] = [];

  if (style === 'classic') {
    if (env.includes('mer')) {
      queries.push('best seaside towns Europe');
      queries.push('best beach cities Europe');

      if (highBudget || longTrip) {
        queries.push('best beach cities worldwide');
      }
    } else if (env.includes('montagne')) {
      queries.push('best mountain towns Europe');
      queries.push('best ski towns Europe');

      if (highBudget || longTrip) {
        queries.push('best mountain destinations worldwide');
      }
    } else if (env.includes('ville')) {
      queries.push('best city break cities Europe');
      queries.push('popular weekend cities Europe');

      if (highBudget) {
        queries.push('best city break cities worldwide');
        queries.push('top international cities for short trip');
      }

      if (veryHighBudget) {
        queries.push('New York Tokyo Dubai Montreal Singapore city trip');
      }
    } else if (env.includes('nature')) {
      queries.push('best nature destinations Europe');
      queries.push('best lake towns Europe');

      if (highBudget || longTrip) {
        queries.push('best nature destinations worldwide');
      }
    } else {
      queries.push('best holiday cities Europe');
      queries.push('popular vacation cities Europe');

      if (highBudget || longTrip) {
        queries.push('best travel destinations worldwide');
      }
    }
  }

  if (style === 'surprising') {
    if (env.includes('mer')) {
      queries.push('underrated seaside towns Europe');
      queries.push('hidden gem beach towns Europe');
      queries.push('alternative beach destinations Europe');

      if (highBudget || longTrip) {
        queries.push('underrated beach destinations worldwide');
      }
    } else if (env.includes('montagne')) {
      queries.push('underrated mountain towns Europe');
      queries.push('hidden gem alpine towns Europe');

      if (highBudget || longTrip) {
        queries.push('underrated mountain destinations worldwide');
      }
    } else if (env.includes('ville')) {
      queries.push('underrated city break destinations Europe');
      queries.push('hidden gem European cities for weekend trip');
      queries.push('alternative destinations to Barcelona Rome Amsterdam');

      if (highBudget || longTrip) {
        queries.push('underrated city destinations worldwide');
        queries.push('surprising city trip destinations worldwide');
      }
    } else if (env.includes('nature')) {
      queries.push('hidden gem nature destinations Europe');
      queries.push('underrated nature destinations Europe');

      if (highBudget || longTrip) {
        queries.push('hidden gem nature destinations worldwide');
      }
    } else {
      queries.push('hidden gem travel destinations Europe');
      queries.push('underrated travel destinations Europe');

      if (highBudget || longTrip) {
        queries.push('hidden gem travel destinations worldwide');
      }
    }
  }

  if (style === 'offbeat') {
    if (env.includes('mer')) {
      queries.push('off the beaten path seaside towns Europe');
      queries.push('unusual beach destinations Europe');
      queries.push('less crowded coastal towns Europe');

      if (highBudget || longTrip) {
        queries.push('offbeat beach destinations worldwide');
      }
    } else if (env.includes('montagne')) {
      queries.push('offbeat mountain destinations Europe');
      queries.push('unusual mountain towns Europe');

      if (highBudget || longTrip) {
        queries.push('offbeat mountain destinations worldwide');
      }
    } else if (env.includes('ville')) {
      queries.push('off the beaten path cities Europe');
      queries.push('unusual city break destinations Europe');
      queries.push('alternative European cities to visit');

      if (highBudget || longTrip) {
        queries.push('offbeat city destinations worldwide');
        queries.push('unusual cities to visit worldwide');
      }
    } else if (env.includes('nature')) {
      queries.push('offbeat nature destinations Europe');
      queries.push('wild nature destinations Europe');

      if (highBudget || longTrip) {
        queries.push('offbeat nature destinations worldwide');
      }
    } else {
      queries.push('offbeat travel destinations Europe');
      queries.push('unusual travel destinations Europe');

      if (highBudget || longTrip) {
        queries.push('offbeat travel destinations worldwide');
      }
    }
  }

  return queries;
}

function buildSearchQueries({
  environment,
  lodging,
  budget,
  persons,
  duration,
  destinationStyles,
}: {
  environment: string;
  lodging: string;
  budget: number;
  persons: number;
  duration: number;
  destinationStyles: DestinationStyle[];
}) {
  const stay = normalizeText(lodging);

  const highBudget = isHighBudget(budget, persons);
  const veryHighBudget = isVeryHighBudget(budget, persons);
  const longTrip = duration >= 5;

  const queries: string[] = [];

  destinationStyles.forEach((style) => {
    queries.push(
      ...buildStyleQueries({
        style,
        environment,
        highBudget,
        veryHighBudget,
        longTrip,
      })
    );
  });

  if (stay.includes('camping')) {
    if (destinationStyles.includes('classic')) {
      queries.push('best towns for camping holidays Europe');
    }

    if (destinationStyles.includes('surprising')) {
      queries.push('hidden gem camping destinations Europe');
    }

    if (destinationStyles.includes('offbeat')) {
      queries.push('offbeat camping destinations Europe');
    }
  }

  if (queries.length === 0) {
    queries.push('hidden gem travel destinations Europe');
  }

  return Array.from(new Set(queries)).slice(0, 12);
}

async function searchGooglePlacesText(query: string, apiKey: string) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryType,places.googleMapsUri',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'fr',
      includedType: 'locality',
      maxResultCount: 20,
    }),
    cache: 'no-store',
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      json?.error?.message || `Erreur Google Places Text Search pour "${query}"`
    );
  }

  return Array.isArray(json.places) ? json.places : [];
}

function estimateWeatherLabel(place: GooglePlace) {
  const text = normalizeText(
    `${place.displayName?.text || ''} ${place.formattedAddress || ''}`
  );

  if (
    text.includes('grece') ||
    text.includes('greece') ||
    text.includes('spain') ||
    text.includes('espagne') ||
    text.includes('portugal') ||
    text.includes('italie') ||
    text.includes('italy') ||
    text.includes('croatie') ||
    text.includes('croatia') ||
    text.includes('malte') ||
    text.includes('malta') ||
    text.includes('cote') ||
    text.includes('riviera') ||
    text.includes('dubai') ||
    text.includes('dubaï') ||
    text.includes('miami') ||
    text.includes('los angeles') ||
    text.includes('singapore') ||
    text.includes('singapour')
  ) {
    return '☀️ climat agréable';
  }

  return '🌤️ météo à vérifier';
}

function inferStyleFromText(
  city: string,
  country: string,
  requestedStyles: DestinationStyle[]
): DestinationStyle {
  const text = normalizeText(`${city} ${country}`);

  const offbeatKeywords = [
    'tirana',
    'tbilissi',
    'tbilisi',
    'sarajevo',
    'riga',
    'açores',
    'acores',
    'azores',
    'lofoten',
    'oman',
    'georgie',
    'georgia',
    'montenegro',
    'monténégro',
    'albanie',
    'albania',
    'madeire',
    'madere',
    'madeira',
    'mostar',
  ];

  const surprisingKeywords = [
    'ljubljana',
    'tallinn',
    'porto',
    'bologne',
    'bologna',
    'seville',
    'séville',
    'valence',
    'valencia',
    'cracovie',
    'krakow',
    'bilbao',
    'edimbourg',
    'edinburgh',
    'copenhague',
    'copenhagen',
    'quebec',
    'québec',
    'boston',
    'chicago',
    'kyoto',
    'seoul',
    'séoul',
    'osaka',
    'kotor',
    'funchal',
    'zadar',
    'split',
    'pula',
    'cagliari',
    'syracuse',
    'essaouira',
  ];

  const classicKeywords = [
    'rome',
    'londres',
    'london',
    'barcelone',
    'barcelona',
    'amsterdam',
    'lisbonne',
    'lisbon',
    'new york',
    'dubai',
    'dubaï',
    'tokyo',
    'singapour',
    'singapore',
    'paris',
    'madrid',
    'venise',
    'venice',
    'florence',
    'nice',
  ];

  if (
    requestedStyles.includes('offbeat') &&
    offbeatKeywords.some((item) => text.includes(normalizeText(item)))
  ) {
    return 'offbeat';
  }

  if (
    requestedStyles.includes('surprising') &&
    surprisingKeywords.some((item) => text.includes(normalizeText(item)))
  ) {
    return 'surprising';
  }

  if (
    requestedStyles.includes('classic') &&
    classicKeywords.some((item) => text.includes(normalizeText(item)))
  ) {
    return 'classic';
  }

  if (requestedStyles.includes('surprising')) return 'surprising';
  if (requestedStyles.includes('classic')) return 'classic';
  return requestedStyles[0] || 'surprising';
}

function mapPlaceToDestination(
  place: GooglePlace,
  requestedStyles: DestinationStyle[]
): DestinationCandidate | null {
  const name = place.displayName?.text || '';
  const lat = Number(place.location?.latitude);
  const lng = Number(place.location?.longitude);

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const address = place.formattedAddress || '';
  const country = getCountryFromAddress(address);
  const style = inferStyleFromText(name, country, requestedStyles);

  return {
    slug: slugify(`${name}-${country}`),
    city: name,
    country,
    address,
    lat,
    lng,
    weather: estimateWeatherLabel(place),
    rating: place.rating || null,
    userRatingCount: place.userRatingCount || 0,
    types: place.types || [],
    primaryType: place.primaryType || '',
    googleMapsUri: place.googleMapsUri || '',
    source: 'Google Places Text Search',
    destinationStyle: style,
    destinationStyleLabel: getStyleLabel(style),
  };
}

function createDestination({
  city,
  country,
  address,
  lat,
  lng,
  weather = '🌤️ météo à vérifier',
  style = 'surprising',
  source = 'Fallback Gototrip',
}: {
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  weather?: string;
  style?: DestinationStyle;
  source?: string;
}): DestinationCandidate {
  return {
    slug: slugify(`${city}-${country}`),
    city,
    country,
    address,
    lat,
    lng,
    weather,
    rating: null,
    userRatingCount: 0,
    types: ['locality', 'political'],
    primaryType: 'locality',
    googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${city} ${country}`
    )}`,
    source,
    destinationStyle: style,
    destinationStyleLabel: getStyleLabel(style),
  };
}

function fallbackClassic(): DestinationCandidate[] {
  return [
    createDestination({
      city: 'Londres',
      country: 'Royaume-Uni',
      address: 'Londres, Royaume-Uni',
      lat: 51.5072,
      lng: -0.1276,
      style: 'classic',
    }),
    createDestination({
      city: 'Amsterdam',
      country: 'Pays-Bas',
      address: 'Amsterdam, Pays-Bas',
      lat: 52.3676,
      lng: 4.9041,
      style: 'classic',
    }),
    createDestination({
      city: 'Rome',
      country: 'Italie',
      address: 'Rome, Italie',
      lat: 41.9028,
      lng: 12.4964,
      weather: '☀️ climat agréable',
      style: 'classic',
    }),
    createDestination({
      city: 'Barcelone',
      country: 'Espagne',
      address: 'Barcelone, Espagne',
      lat: 41.3874,
      lng: 2.1686,
      weather: '☀️ climat agréable',
      style: 'classic',
    }),
    createDestination({
      city: 'Lisbonne',
      country: 'Portugal',
      address: 'Lisbonne, Portugal',
      lat: 38.7223,
      lng: -9.1393,
      weather: '☀️ climat agréable',
      style: 'classic',
    }),
    createDestination({
      city: 'New York',
      country: 'États-Unis',
      address: 'New York, NY, États-Unis',
      lat: 40.7128,
      lng: -74.006,
      style: 'classic',
      source: 'Fallback Gototrip Monde',
    }),
    createDestination({
      city: 'Dubaï',
      country: 'Émirats arabes unis',
      address: 'Dubaï, Émirats arabes unis',
      lat: 25.2048,
      lng: 55.2708,
      weather: '☀️ climat agréable',
      style: 'classic',
      source: 'Fallback Gototrip Monde',
    }),
    createDestination({
      city: 'Tokyo',
      country: 'Japon',
      address: 'Tokyo, Japon',
      lat: 35.6762,
      lng: 139.6503,
      style: 'classic',
      source: 'Fallback Gototrip Monde',
    }),
  ];
}

function fallbackSurprising(): DestinationCandidate[] {
  return [
    createDestination({
      city: 'Porto',
      country: 'Portugal',
      address: 'Porto, Portugal',
      lat: 41.1579,
      lng: -8.6291,
      weather: '☀️ climat agréable',
      style: 'surprising',
    }),
    createDestination({
      city: 'Ljubljana',
      country: 'Slovénie',
      address: 'Ljubljana, Slovénie',
      lat: 46.0569,
      lng: 14.5058,
      style: 'surprising',
    }),
    createDestination({
      city: 'Tallinn',
      country: 'Estonie',
      address: 'Tallinn, Estonie',
      lat: 59.437,
      lng: 24.7536,
      style: 'surprising',
    }),
    createDestination({
      city: 'Bologne',
      country: 'Italie',
      address: 'Bologne, Italie',
      lat: 44.4949,
      lng: 11.3426,
      weather: '☀️ climat agréable',
      style: 'surprising',
    }),
    createDestination({
      city: 'Bilbao',
      country: 'Espagne',
      address: 'Bilbao, Espagne',
      lat: 43.263,
      lng: -2.935,
      style: 'surprising',
    }),
    createDestination({
      city: 'Kotor',
      country: 'Monténégro',
      address: 'Kotor, Monténégro',
      lat: 42.4247,
      lng: 18.7712,
      weather: '☀️ climat agréable',
      style: 'surprising',
    }),
    createDestination({
      city: 'Funchal',
      country: 'Portugal',
      address: 'Funchal, Madère, Portugal',
      lat: 32.6669,
      lng: -16.9241,
      weather: '☀️ climat agréable',
      style: 'surprising',
    }),
    createDestination({
      city: 'Québec',
      country: 'Canada',
      address: 'Québec, Canada',
      lat: 46.8139,
      lng: -71.208,
      style: 'surprising',
      source: 'Fallback Gototrip Monde',
    }),
  ];
}

function fallbackOffbeat(): DestinationCandidate[] {
  return [
    createDestination({
      city: 'Tirana',
      country: 'Albanie',
      address: 'Tirana, Albanie',
      lat: 41.3275,
      lng: 19.8189,
      style: 'offbeat',
    }),
    createDestination({
      city: 'Sarajevo',
      country: 'Bosnie-Herzégovine',
      address: 'Sarajevo, Bosnie-Herzégovine',
      lat: 43.8563,
      lng: 18.4131,
      style: 'offbeat',
    }),
    createDestination({
      city: 'Tbilissi',
      country: 'Géorgie',
      address: 'Tbilissi, Géorgie',
      lat: 41.7151,
      lng: 44.8271,
      style: 'offbeat',
    }),
    createDestination({
      city: 'Riga',
      country: 'Lettonie',
      address: 'Riga, Lettonie',
      lat: 56.9496,
      lng: 24.1052,
      style: 'offbeat',
    }),
    createDestination({
      city: 'Ponta Delgada',
      country: 'Portugal',
      address: 'Ponta Delgada, Açores, Portugal',
      lat: 37.7394,
      lng: -25.6687,
      weather: '☀️ climat agréable',
      style: 'offbeat',
    }),
    createDestination({
      city: 'Muscat',
      country: 'Oman',
      address: 'Mascate, Oman',
      lat: 23.588,
      lng: 58.3829,
      weather: '☀️ climat agréable',
      style: 'offbeat',
      source: 'Fallback Gototrip Monde',
    }),
    createDestination({
      city: 'Mostar',
      country: 'Bosnie-Herzégovine',
      address: 'Mostar, Bosnie-Herzégovine',
      lat: 43.3438,
      lng: 17.8078,
      style: 'offbeat',
    }),
  ];
}

function fallbackDestinations({
  destinationStyles,
  budget,
  persons,
  duration,
}: {
  destinationStyles: DestinationStyle[];
  budget: number;
  persons: number;
  duration: number;
}) {
  const highBudget = isHighBudget(budget, persons);
  const longTrip = duration >= 5;

  const results: DestinationCandidate[] = [];

  if (destinationStyles.includes('classic')) {
    results.push(...fallbackClassic());
  }

  if (destinationStyles.includes('surprising')) {
    results.push(...fallbackSurprising());
  }

  if (destinationStyles.includes('offbeat')) {
    results.push(...fallbackOffbeat());
  }

  if (!highBudget && !longTrip) {
    return results.filter((item) => {
      const text = normalizeText(`${item.city} ${item.country}`);

      const longHaul = [
        'new york',
        'canada',
        'tokyo',
        'japon',
        'oman',
        'dubai',
        'dubaï',
        'emirats',
        'georgie',
      ];

      return !longHaul.some((word) => text.includes(normalizeText(word)));
    });
  }

  return results;
}

function uniqueDestinations(destinations: DestinationCandidate[]) {
  const seen = new Set<string>();

  return destinations.filter((destination) => {
    const key = `${normalizeText(destination.city)}-${normalizeText(
      destination.country
    )}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function interleaveByStyle(destinations: DestinationCandidate[]) {
  const classic = destinations.filter((item) => item.destinationStyle === 'classic');
  const surprising = destinations.filter(
    (item) => item.destinationStyle === 'surprising'
  );
  const offbeat = destinations.filter((item) => item.destinationStyle === 'offbeat');

  const result: DestinationCandidate[] = [];
  const maxLength = Math.max(classic.length, surprising.length, offbeat.length);

  for (let index = 0; index < maxLength; index += 1) {
    if (classic[index]) result.push(classic[index]);
    if (surprising[index]) result.push(surprising[index]);
    if (offbeat[index]) result.push(offbeat[index]);
  }

  return result;
}

export async function GET(req: NextRequest) {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { searchParams } = new URL(req.url);

  const environment = searchParams.get('environment') || '';
  const lodging = searchParams.get('lodging') || '';
  const budget = Number(searchParams.get('budget') || 0);
  const persons = Math.max(1, Number(searchParams.get('persons') || 1));
  const duration = Math.max(1, Number(searchParams.get('duration') || 3));
  const destinationStyles = parseDestinationStyles(
    searchParams.get('destinationStyle') || ''
  );

  const fallbackArgs = {
    destinationStyles,
    budget,
    persons,
    duration,
  };

  if (!apiKey) {
    const fallback = interleaveByStyle(
      uniqueDestinations(fallbackDestinations(fallbackArgs))
    ).slice(0, 18);

    return NextResponse.json({
      ok: true,
      source: 'Fallback Gototrip',
      warning:
        'Clé Google Places manquante. Ajoute GOOGLE_PLACES_API_KEY dans .env.local.',
      destinationStyles,
      count: fallback.length,
      destinations: fallback,
    });
  }

  try {
    const queries = buildSearchQueries({
      environment,
      lodging,
      budget,
      persons,
      duration,
      destinationStyles,
    });

    const results = await Promise.allSettled(
      queries.map((query) => searchGooglePlacesText(query, apiKey))
    );

    const allPlaces = results.flatMap((result) => {
      if (result.status !== 'fulfilled') return [];
      return result.value;
    });

    const validPlaces = uniqueByNameAndCountry(allPlaces)
      .filter(isValidDestination)
      .filter((place) => passesEnvironmentFilter(place, environment));

    let destinations = validPlaces
      .map((place) => mapPlaceToDestination(place, destinationStyles))
      .filter(Boolean) as DestinationCandidate[];

    const fallback = fallbackDestinations(fallbackArgs);
    const existingKeys = new Set(
      destinations.map((item) =>
        `${normalizeText(item.city)}-${normalizeText(item.country)}`
      )
    );

    const missingFallbacks = fallback.filter((item) => {
      const key = `${normalizeText(item.city)}-${normalizeText(item.country)}`;
      return !existingKeys.has(key);
    });

    destinations = uniqueDestinations([...destinations, ...missingFallbacks]);
    destinations = interleaveByStyle(destinations).slice(0, 18);

    if (destinations.length === 0) {
      const fallbackOnly = interleaveByStyle(
        uniqueDestinations(fallbackDestinations(fallbackArgs))
      ).slice(0, 18);

      return NextResponse.json({
        ok: true,
        source: 'Fallback Gototrip',
        warning:
          'Google Places n’a pas retourné assez de destinations valides. Utilisation du fallback.',
        destinationStyles,
        queries,
        count: fallbackOnly.length,
        destinations: fallbackOnly,
      });
    }

    return NextResponse.json({
      ok: true,
      source: 'Google Places Text Search',
      destinationStyles,
      queries,
      count: destinations.length,
      destinations,
    });
  } catch (e: any) {
    const fallback = interleaveByStyle(
      uniqueDestinations(fallbackDestinations(fallbackArgs))
    ).slice(0, 18);

    return NextResponse.json({
      ok: true,
      source: 'Fallback Gototrip',
      warning:
        e?.message ||
        'Erreur pendant la recherche destinations. Utilisation du fallback.',
      destinationStyles,
      destinations: fallback,
    });
  }
}