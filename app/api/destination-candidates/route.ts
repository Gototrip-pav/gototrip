import { NextRequest, NextResponse } from 'next/server';

type DestinationStyle = 'classic' | 'surprising' | 'offbeat';
type EnvironmentId = 'mer' | 'montagne' | 'ville' | 'nature' | 'campagne';
type BudgetLevel = 'low' | 'medium' | 'high' | 'veryHigh';

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
  environments?: EnvironmentId[];
  distanceKm?: number | null;
  score?: number;
  budgetLevel?: BudgetLevel;
  coherenceReason?: string;
};

type CuratedDestination = {
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  environments: EnvironmentId[];
  styles: DestinationStyle[];
  weather?: string;
  source?: string;
  priority?: number;
};

const EARTH_RADIUS_KM = 6371;

const KNOWN_DEPARTURES: Record<
  string,
  { city: string; country: string; lat: number; lng: number }
> = {
  lille: { city: 'Lille', country: 'France', lat: 50.6292, lng: 3.0573 },
  paris: { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  lyon: { city: 'Lyon', country: 'France', lat: 45.764, lng: 4.8357 },
  marseille: { city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698 },
  bordeaux: { city: 'Bordeaux', country: 'France', lat: 44.8378, lng: -0.5792 },
  nantes: { city: 'Nantes', country: 'France', lat: 47.2184, lng: -1.5536 },
  toulouse: { city: 'Toulouse', country: 'France', lat: 43.6047, lng: 1.4442 },
  nice: { city: 'Nice', country: 'France', lat: 43.7102, lng: 7.262 },
  bruxelles: { city: 'Bruxelles', country: 'Belgique', lat: 50.8503, lng: 4.3517 },
  brussels: { city: 'Bruxelles', country: 'Belgique', lat: 50.8503, lng: 4.3517 },
  mons: { city: 'Mons', country: 'Belgique', lat: 50.4542, lng: 3.9567 },
  tournai: { city: 'Tournai', country: 'Belgique', lat: 50.6056, lng: 3.3893 },
  valenciennes: { city: 'Valenciennes', country: 'France', lat: 50.3571, lng: 3.5264 },
};

const CURATED_DESTINATIONS: CuratedDestination[] = [
  {
    city: 'Le Touquet-Paris-Plage',
    country: 'France',
    address: 'Le Touquet-Paris-Plage, France',
    lat: 50.5243,
    lng: 1.5857,
    environments: ['mer', 'nature'],
    styles: ['classic', 'surprising'],
    priority: 100,
  },
  {
    city: 'Berck',
    country: 'France',
    address: 'Berck, France',
    lat: 50.407,
    lng: 1.5646,
    environments: ['mer', 'nature'],
    styles: ['surprising'],
    priority: 98,
  },
  {
    city: 'Wimereux',
    country: 'France',
    address: 'Wimereux, France',
    lat: 50.769,
    lng: 1.6114,
    environments: ['mer', 'nature'],
    styles: ['surprising', 'offbeat'],
    priority: 96,
  },
  {
    city: 'Boulogne-sur-Mer',
    country: 'France',
    address: 'Boulogne-sur-Mer, France',
    lat: 50.7252,
    lng: 1.6133,
    environments: ['mer', 'ville'],
    styles: ['classic', 'surprising'],
    priority: 95,
  },
  {
    city: 'Dunkerque',
    country: 'France',
    address: 'Dunkerque, France',
    lat: 51.0344,
    lng: 2.3768,
    environments: ['mer', 'ville'],
    styles: ['surprising'],
    priority: 94,
  },
  {
    city: 'Malo-les-Bains',
    country: 'France',
    address: 'Malo-les-Bains, Dunkerque, France',
    lat: 51.048,
    lng: 2.405,
    environments: ['mer'],
    styles: ['surprising'],
    priority: 93,
  },
  {
    city: 'Deauville',
    country: 'France',
    address: 'Deauville, France',
    lat: 49.3604,
    lng: 0.0747,
    environments: ['mer'],
    styles: ['classic'],
    priority: 90,
  },
  {
    city: 'Honfleur',
    country: 'France',
    address: 'Honfleur, France',
    lat: 49.4199,
    lng: 0.2329,
    environments: ['mer', 'campagne'],
    styles: ['classic', 'surprising'],
    priority: 89,
  },
  {
    city: 'Étretat',
    country: 'France',
    address: 'Étretat, France',
    lat: 49.7066,
    lng: 0.2056,
    environments: ['mer', 'nature'],
    styles: ['classic', 'surprising'],
    priority: 88,
  },
  {
    city: 'Saint-Malo',
    country: 'France',
    address: 'Saint-Malo, France',
    lat: 48.6493,
    lng: -2.0257,
    environments: ['mer', 'ville'],
    styles: ['classic', 'surprising'],
    priority: 87,
  },
  {
    city: 'Dinard',
    country: 'France',
    address: 'Dinard, France',
    lat: 48.6325,
    lng: -2.0616,
    environments: ['mer'],
    styles: ['classic', 'surprising'],
    priority: 86,
  },
  {
    city: 'Perros-Guirec',
    country: 'France',
    address: 'Perros-Guirec, France',
    lat: 48.8149,
    lng: -3.4439,
    environments: ['mer', 'nature'],
    styles: ['surprising'],
    priority: 85,
  },
  {
    city: 'Quiberon',
    country: 'France',
    address: 'Quiberon, France',
    lat: 47.484,
    lng: -3.119,
    environments: ['mer', 'nature'],
    styles: ['surprising'],
    priority: 84,
  },
  {
    city: 'La Rochelle',
    country: 'France',
    address: 'La Rochelle, France',
    lat: 46.1603,
    lng: -1.1511,
    environments: ['mer', 'ville'],
    styles: ['classic', 'surprising'],
    priority: 83,
  },
  {
    city: 'Arcachon',
    country: 'France',
    address: 'Arcachon, France',
    lat: 44.661,
    lng: -1.1687,
    environments: ['mer', 'nature'],
    styles: ['classic', 'surprising'],
    priority: 82,
  },
  {
    city: 'Biarritz',
    country: 'France',
    address: 'Biarritz, France',
    lat: 43.4832,
    lng: -1.5586,
    environments: ['mer'],
    styles: ['classic'],
    weather: '☀️ climat agréable',
    priority: 81,
  },
  {
    city: 'Nice',
    country: 'France',
    address: 'Nice, France',
    lat: 43.7102,
    lng: 7.262,
    environments: ['mer', 'ville'],
    styles: ['classic'],
    weather: '☀️ climat agréable',
    priority: 80,
  },
  {
    city: 'Antibes',
    country: 'France',
    address: 'Antibes, France',
    lat: 43.5804,
    lng: 7.1251,
    environments: ['mer'],
    styles: ['classic', 'surprising'],
    weather: '☀️ climat agréable',
    priority: 79,
  },
  {
    city: 'Collioure',
    country: 'France',
    address: 'Collioure, France',
    lat: 42.5266,
    lng: 3.0832,
    environments: ['mer'],
    styles: ['surprising'],
    weather: '☀️ climat agréable',
    priority: 78,
  },
  {
    city: 'Ajaccio',
    country: 'France',
    address: 'Ajaccio, Corse, France',
    lat: 41.9192,
    lng: 8.7386,
    environments: ['mer', 'nature'],
    styles: ['classic', 'surprising'],
    weather: '☀️ climat agréable',
    priority: 77,
  },
  {
    city: 'Amsterdam',
    country: 'Pays-Bas',
    address: 'Amsterdam, Pays-Bas',
    lat: 52.3676,
    lng: 4.9041,
    environments: ['ville'],
    styles: ['classic'],
    priority: 75,
  },
  {
    city: 'Londres',
    country: 'Royaume-Uni',
    address: 'Londres, Royaume-Uni',
    lat: 51.5072,
    lng: -0.1276,
    environments: ['ville'],
    styles: ['classic'],
    priority: 74,
  },
  {
    city: 'Bruges',
    country: 'Belgique',
    address: 'Bruges, Belgique',
    lat: 51.2093,
    lng: 3.2247,
    environments: ['ville'],
    styles: ['classic', 'surprising'],
    priority: 73,
  },
  {
    city: 'Ostende',
    country: 'Belgique',
    address: 'Ostende, Belgique',
    lat: 51.2154,
    lng: 2.9287,
    environments: ['mer', 'ville'],
    styles: ['classic', 'surprising'],
    priority: 72,
  },
  {
    city: 'La Panne',
    country: 'Belgique',
    address: 'La Panne, Belgique',
    lat: 51.0979,
    lng: 2.5938,
    environments: ['mer'],
    styles: ['surprising'],
    priority: 71,
  },
  {
    city: 'Porto',
    country: 'Portugal',
    address: 'Porto, Portugal',
    lat: 41.1579,
    lng: -8.6291,
    environments: ['mer', 'ville'],
    styles: ['surprising'],
    weather: '☀️ climat agréable',
    priority: 70,
  },
  {
    city: 'Lisbonne',
    country: 'Portugal',
    address: 'Lisbonne, Portugal',
    lat: 38.7223,
    lng: -9.1393,
    environments: ['mer', 'ville'],
    styles: ['classic'],
    weather: '☀️ climat agréable',
    priority: 69,
  },
  {
    city: 'Faro',
    country: 'Portugal',
    address: 'Faro, Algarve, Portugal',
    lat: 37.0194,
    lng: -7.9304,
    environments: ['mer'],
    styles: ['classic', 'surprising'],
    weather: '☀️ climat agréable',
    priority: 68,
  },
  {
    city: 'Barcelone',
    country: 'Espagne',
    address: 'Barcelone, Espagne',
    lat: 41.3874,
    lng: 2.1686,
    environments: ['mer', 'ville'],
    styles: ['classic'],
    weather: '☀️ climat agréable',
    priority: 67,
  },
  {
    city: 'Valence',
    country: 'Espagne',
    address: 'Valence, Espagne',
    lat: 39.4699,
    lng: -0.3763,
    environments: ['mer', 'ville'],
    styles: ['surprising'],
    weather: '☀️ climat agréable',
    priority: 66,
  },
  {
    city: 'Palma',
    country: 'Espagne',
    address: 'Palma de Majorque, Espagne',
    lat: 39.5696,
    lng: 2.6502,
    environments: ['mer'],
    styles: ['classic'],
    weather: '☀️ climat agréable',
    priority: 65,
  },
  {
    city: 'San Sebastián',
    country: 'Espagne',
    address: 'San Sebastián, Espagne',
    lat: 43.3183,
    lng: -1.9812,
    environments: ['mer', 'ville'],
    styles: ['surprising'],
    priority: 64,
  },
  {
    city: 'Naples',
    country: 'Italie',
    address: 'Naples, Italie',
    lat: 40.8518,
    lng: 14.2681,
    environments: ['mer', 'ville'],
    styles: ['classic', 'surprising'],
    weather: '☀️ climat agréable',
    priority: 63,
  },
  {
    city: 'Cagliari',
    country: 'Italie',
    address: 'Cagliari, Sardaigne, Italie',
    lat: 39.2238,
    lng: 9.1217,
    environments: ['mer'],
    styles: ['surprising'],
    weather: '☀️ climat agréable',
    priority: 62,
  },
  {
    city: 'Split',
    country: 'Croatie',
    address: 'Split, Croatie',
    lat: 43.5081,
    lng: 16.4402,
    environments: ['mer', 'ville'],
    styles: ['surprising'],
    weather: '☀️ climat agréable',
    priority: 61,
  },
  {
    city: 'Kotor',
    country: 'Monténégro',
    address: 'Kotor, Monténégro',
    lat: 42.4247,
    lng: 18.7712,
    environments: ['mer', 'nature'],
    styles: ['surprising', 'offbeat'],
    weather: '☀️ climat agréable',
    priority: 60,
  },
  {
    city: 'Funchal',
    country: 'Portugal',
    address: 'Funchal, Madère, Portugal',
    lat: 32.6669,
    lng: -16.9241,
    environments: ['mer', 'nature'],
    styles: ['surprising', 'offbeat'],
    weather: '☀️ climat agréable',
    priority: 59,
  },
  {
    city: 'Chamonix',
    country: 'France',
    address: 'Chamonix-Mont-Blanc, France',
    lat: 45.9237,
    lng: 6.8694,
    environments: ['montagne', 'nature'],
    styles: ['classic'],
    priority: 80,
  },
  {
    city: 'Annecy',
    country: 'France',
    address: 'Annecy, France',
    lat: 45.8992,
    lng: 6.1294,
    environments: ['montagne', 'nature', 'ville'],
    styles: ['classic', 'surprising'],
    priority: 78,
  },
  {
    city: 'Gérardmer',
    country: 'France',
    address: 'Gérardmer, Vosges, France',
    lat: 48.0735,
    lng: 6.8779,
    environments: ['montagne', 'nature'],
    styles: ['surprising'],
    priority: 77,
  },
  {
    city: 'La Bresse',
    country: 'France',
    address: 'La Bresse, Vosges, France',
    lat: 48.0032,
    lng: 6.8756,
    environments: ['montagne', 'nature'],
    styles: ['surprising'],
    priority: 76,
  },
  {
    city: 'Interlaken',
    country: 'Suisse',
    address: 'Interlaken, Suisse',
    lat: 46.6863,
    lng: 7.8632,
    environments: ['montagne', 'nature'],
    styles: ['classic'],
    priority: 70,
  },
  {
    city: 'Innsbruck',
    country: 'Autriche',
    address: 'Innsbruck, Autriche',
    lat: 47.2692,
    lng: 11.4041,
    environments: ['montagne', 'ville'],
    styles: ['classic', 'surprising'],
    priority: 69,
  },
  {
    city: 'Colmar',
    country: 'France',
    address: 'Colmar, France',
    lat: 48.0794,
    lng: 7.3585,
    environments: ['ville', 'campagne'],
    styles: ['classic', 'surprising'],
    priority: 74,
  },
  {
    city: 'Dijon',
    country: 'France',
    address: 'Dijon, France',
    lat: 47.322,
    lng: 5.0415,
    environments: ['ville', 'campagne'],
    styles: ['surprising'],
    priority: 73,
  },
  {
    city: 'Sarlat-la-Canéda',
    country: 'France',
    address: 'Sarlat-la-Canéda, France',
    lat: 44.8894,
    lng: 1.2167,
    environments: ['campagne', 'nature'],
    styles: ['surprising'],
    priority: 72,
  },
  {
    city: 'Gordes',
    country: 'France',
    address: 'Gordes, France',
    lat: 43.9111,
    lng: 5.2004,
    environments: ['campagne', 'nature'],
    styles: ['classic', 'surprising'],
    weather: '☀️ climat agréable',
    priority: 71,
  },
  {
    city: 'New York',
    country: 'États-Unis',
    address: 'New York, États-Unis',
    lat: 40.7128,
    lng: -74.006,
    environments: ['ville'],
    styles: ['classic'],
    source: 'Fallback Gototrip Monde',
    priority: 30,
  },
  {
    city: 'Tokyo',
    country: 'Japon',
    address: 'Tokyo, Japon',
    lat: 35.6762,
    lng: 139.6503,
    environments: ['ville'],
    styles: ['classic'],
    source: 'Fallback Gototrip Monde',
    priority: 28,
  },
  {
    city: 'Québec',
    country: 'Canada',
    address: 'Québec, Canada',
    lat: 46.8139,
    lng: -71.208,
    environments: ['ville', 'nature'],
    styles: ['surprising'],
    source: 'Fallback Gototrip Monde',
    priority: 26,
  },
];

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

function parseEnvironments(value: string): EnvironmentId[] {
  const allowed: EnvironmentId[] = ['mer', 'montagne', 'ville', 'nature', 'campagne'];

  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => normalizeText(item).trim())
        .filter((item): item is EnvironmentId =>
          allowed.includes(item as EnvironmentId)
        )
    )
  );
}

function isTruthy(value: string | null) {
  const normalized = normalizeText(value || '');
  return ['1', 'true', 'yes', 'oui', 'on'].includes(normalized);
}

function getStyleLabel(style?: DestinationStyle) {
  if (style === 'classic') return 'Valeur sûre';
  if (style === 'surprising') return 'Pépite';
  if (style === 'offbeat') return 'Décalée';
  return 'Suggestion';
}

function getBudgetLevel(budget: number, persons: number): BudgetLevel {
  const safePersons = Math.max(1, persons || 1);
  const budgetPerPerson = budget / safePersons;

  if (budgetPerPerson >= 2500) return 'veryHigh';
  if (budgetPerPerson >= 1200) return 'high';
  if (budgetPerPerson >= 650) return 'medium';
  return 'low';
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

function inferDeparture(departure: string) {
  const text = normalizeText(departure);

  const directKey = Object.keys(KNOWN_DEPARTURES).find((key) =>
    text.includes(normalizeText(key))
  );

  if (directKey) {
    return KNOWN_DEPARTURES[directKey];
  }

  if (
    text.includes('france') ||
    text.includes('59') ||
    text.includes('75') ||
    text.includes('paris')
  ) {
    return KNOWN_DEPARTURES.paris;
  }

  return KNOWN_DEPARTURES.lille;
}

function sameCountryName(a: string, b: string) {
  return normalizeText(a) === normalizeText(b);
}

function estimateWeatherLabelFromText(value: string) {
  const text = normalizeText(value);

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
    text.includes('corse') ||
    text.includes('nice') ||
    text.includes('biarritz') ||
    text.includes('arcachon') ||
    text.includes('barcelone') ||
    text.includes('lisbonne') ||
    text.includes('porto') ||
    text.includes('faro')
  ) {
    return '☀️ climat agréable';
  }

  return '🌤️ météo à vérifier';
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
  environments = [],
  distanceKm = null,
  score = 0,
  budgetLevel,
  coherenceReason,
}: {
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  weather?: string;
  style?: DestinationStyle;
  source?: string;
  environments?: EnvironmentId[];
  distanceKm?: number | null;
  score?: number;
  budgetLevel?: BudgetLevel;
  coherenceReason?: string;
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
    environments,
    distanceKm,
    score,
    budgetLevel,
    coherenceReason,
  };
}

function curatedToDestination(
  item: CuratedDestination,
  style: DestinationStyle,
  distanceKm: number | null,
  score: number,
  budgetLevel: BudgetLevel,
  coherenceReason: string
) {
  return createDestination({
    city: item.city,
    country: item.country,
    address: item.address,
    lat: item.lat,
    lng: item.lng,
    weather: item.weather || estimateWeatherLabelFromText(`${item.city} ${item.country}`),
    style,
    source: item.source || 'Sélection Gototrip',
    environments: item.environments,
    distanceKm,
    score,
    budgetLevel,
    coherenceReason,
  });
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
    'plaza',
    'square',
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
  if (!hasAllowedDestinationType(place)) return false;
  if (hasBlockedType(place)) return false;

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

function inferEnvironmentsFromText(city: string, country: string): EnvironmentId[] {
  const text = normalizeText(`${city} ${country}`);

  const curated = CURATED_DESTINATIONS.find(
    (item) =>
      normalizeText(item.city) === normalizeText(city) &&
      normalizeText(item.country) === normalizeText(country)
  );

  if (curated) return curated.environments;

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
    'corse',
    'corsica',
    'sardaigne',
    'sardinia',
    'sicile',
    'sicily',
    'malte',
    'malta',
    'algarve',
    'faro',
    'nice',
    'cannes',
    'antibes',
    'marseille',
    'toulon',
    'barcelone',
    'barcelona',
    'valencia',
    'valence',
    'lisbonne',
    'lisbon',
    'porto',
    'naples',
    'venise',
    'venice',
    'split',
    'dubrovnik',
    'zadar',
    'biarritz',
    'la rochelle',
    'arcachon',
    'saint-malo',
    'deauville',
    'le touquet',
    'ostende',
    'ostend',
    'kotor',
    'funchal',
  ];

  const mountainKeywords = [
    'mountain',
    'montagne',
    'alpes',
    'alps',
    'pyrenees',
    'pyrénées',
    'vosges',
    'jura',
    'chamonix',
    'annecy',
    'grenoble',
    'zermatt',
    'interlaken',
    'innsbruck',
  ];

  const environments: EnvironmentId[] = [];

  if (seaKeywords.some((word) => text.includes(normalizeText(word)))) {
    environments.push('mer');
  }

  if (mountainKeywords.some((word) => text.includes(normalizeText(word)))) {
    environments.push('montagne');
  }

  if (environments.length === 0) {
    environments.push('ville');
  }

  return environments;
}

function matchesEnvironment(
  destinationEnvironments: EnvironmentId[],
  requestedEnvironments: EnvironmentId[]
) {
  if (requestedEnvironments.length === 0) return true;

  return requestedEnvironments.some((env) => destinationEnvironments.includes(env));
}

function getMaxDistanceKm({
  budget,
  persons,
  duration,
  sameCountry,
}: {
  budget: number;
  persons: number;
  duration: number;
  sameCountry: boolean;
}) {
  const budgetPerPerson = budget / Math.max(1, persons);

  if (sameCountry) return 1300;
  if (duration <= 3) return 750;
  if (budgetPerPerson < 400) return 450;
  if (budgetPerPerson < 700) return 850;
  if (budgetPerPerson < 1200) return 1600;
  if (budgetPerPerson < 2000) return 3200;

  if (duration >= 7 && budgetPerPerson >= 2500) return 9500;

  return 4200;
}

function chooseStyleForDestination(
  itemStyles: DestinationStyle[],
  requestedStyles: DestinationStyle[]
) {
  const matching = requestedStyles.find((style) => itemStyles.includes(style));
  return matching || requestedStyles[0] || itemStyles[0] || 'surprising';
}

function scoreDestination({
  country,
  lat,
  lng,
  environments,
  styles,
  priority = 50,
  departure,
  requestedEnvironments,
  requestedStyles,
  budget,
  persons,
  duration,
  sameCountry,
}: {
  city: string;
  country: string;
  lat: number;
  lng: number;
  environments: EnvironmentId[];
  styles: DestinationStyle[];
  priority?: number;
  departure: { city: string; country: string; lat: number; lng: number };
  requestedEnvironments: EnvironmentId[];
  requestedStyles: DestinationStyle[];
  budget: number;
  persons: number;
  duration: number;
  sameCountry: boolean;
}): {
  score: number;
  distanceKm: number;
  budgetLevel: BudgetLevel;
  coherenceReason: string;
} | null {
  const budgetLevel = getBudgetLevel(budget, persons);
  const maxDistance = getMaxDistanceKm({ budget, persons, duration, sameCountry });
  const distanceKm = Math.round(getDistanceKm(departure, { lat, lng }));

  if (sameCountry && !sameCountryName(country, departure.country)) {
    return null;
  }

  if (!matchesEnvironment(environments, requestedEnvironments)) {
    return null;
  }

  const longHaul = distanceKm > 5500;
  const budgetPerPerson = budget / Math.max(1, persons);

  if (longHaul && (duration < 7 || budgetPerPerson < 2500)) {
    return null;
  }

  if (distanceKm > maxDistance) {
    return null;
  }

  let score = priority;

  if (requestedEnvironments.length > 0) {
    const envMatches = requestedEnvironments.filter((env) =>
      environments.includes(env)
    ).length;

    score += envMatches * 180;
  }

  if (requestedStyles.some((style) => styles.includes(style))) {
    score += 80;
  }

  if (sameCountryName(country, departure.country)) {
    score += 90;
  }

  if (distanceKm < 250) score += 160;
  else if (distanceKm < 500) score += 120;
  else if (distanceKm < 900) score += 80;
  else if (distanceKm < 1600) score += 40;
  else if (distanceKm > 3500) score -= 80;

  if (duration <= 4 && distanceKm < 800) score += 70;
  if (budgetLevel === 'low' && distanceKm < 500) score += 120;
  if (budgetLevel === 'medium' && distanceKm < 1200) score += 70;
  if (budgetLevel === 'high' && distanceKm < 3000) score += 40;
  if (budgetLevel === 'veryHigh' && duration >= 7) score += 20;

  if (requestedEnvironments.includes('mer') && !environments.includes('mer')) {
    score -= 1000;
  }

  const reasonParts = [];

  if (requestedEnvironments.length > 0) {
    reasonParts.push(`correspond au filtre ${requestedEnvironments.join(', ')}`);
  }

  if (distanceKm < 500) {
    reasonParts.push('proche du départ');
  } else if (distanceKm < 1200) {
    reasonParts.push('distance cohérente avec le budget');
  } else {
    reasonParts.push('possible avec un budget plus confortable');
  }

  if (sameCountryName(country, departure.country)) {
    reasonParts.push('même pays que le départ');
  }

  return {
    score,
    distanceKm,
    budgetLevel,
    coherenceReason: reasonParts.join(' • '),
  };
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

function inferStyleFromText(
  city: string,
  country: string,
  requestedStyles: DestinationStyle[]
): DestinationStyle {
  const curated = CURATED_DESTINATIONS.find(
    (item) =>
      normalizeText(item.city) === normalizeText(city) &&
      normalizeText(item.country) === normalizeText(country)
  );

  if (curated) {
    return chooseStyleForDestination(curated.styles, requestedStyles);
  }

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
    'kotor',
    'funchal',
    'zadar',
    'split',
    'cagliari',
    'essaouira',
    'wimereux',
    'berck',
    'arcachon',
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
    'paris',
    'madrid',
    'venise',
    'venice',
    'nice',
    'deauville',
    'saint-malo',
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
  requestedStyles: DestinationStyle[],
  requestedEnvironments: EnvironmentId[],
  departure: { city: string; country: string; lat: number; lng: number },
  budget: number,
  persons: number,
  duration: number,
  sameCountry: boolean
): DestinationCandidate | null {
  const name = place.displayName?.text || '';
  const lat = Number(place.location?.latitude);
  const lng = Number(place.location?.longitude);

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const address = place.formattedAddress || '';
  const country = getCountryFromAddress(address);
  const environments = inferEnvironmentsFromText(name, country);
  const style = inferStyleFromText(name, country, requestedStyles);

  const scored = scoreDestination({
    city: name,
    country,
    lat,
    lng,
    environments,
    styles: [style],
    priority: 45,
    departure,
    requestedEnvironments,
    requestedStyles,
    budget,
    persons,
    duration,
    sameCountry,
  });

  if (!scored) return null;

  return {
    slug: slugify(`${name}-${country}`),
    city: name,
    country,
    address,
    lat,
    lng,
    weather: estimateWeatherLabelFromText(`${name} ${country}`),
    rating: place.rating || null,
    userRatingCount: place.userRatingCount || 0,
    types: place.types || [],
    primaryType: place.primaryType || '',
    googleMapsUri: place.googleMapsUri || '',
    source: 'Google Places Text Search',
    destinationStyle: style,
    destinationStyleLabel: getStyleLabel(style),
    environments,
    distanceKm: scored.distanceKm,
    score: scored.score,
    budgetLevel: scored.budgetLevel,
    coherenceReason: scored.coherenceReason,
  };
}

function buildCuratedResults({
  departure,
  requestedEnvironments,
  requestedStyles,
  budget,
  persons,
  duration,
  sameCountry,
}: {
  departure: { city: string; country: string; lat: number; lng: number };
  requestedEnvironments: EnvironmentId[];
  requestedStyles: DestinationStyle[];
  budget: number;
  persons: number;
  duration: number;
  sameCountry: boolean;
}) {
  const results: DestinationCandidate[] = [];

  CURATED_DESTINATIONS.forEach((item) => {
    const style = chooseStyleForDestination(item.styles, requestedStyles);

    const scored = scoreDestination({
      city: item.city,
      country: item.country,
      lat: item.lat,
      lng: item.lng,
      environments: item.environments,
      styles: item.styles,
      priority: item.priority || 50,
      departure,
      requestedEnvironments,
      requestedStyles,
      budget,
      persons,
      duration,
      sameCountry,
    });

    if (!scored) return;

    results.push(
      curatedToDestination(
        item,
        style,
        scored.distanceKm,
        scored.score,
        scored.budgetLevel,
        scored.coherenceReason
      )
    );
  });

  return results;
}

function buildSearchQueries({
  environment,
  destinationStyles,
  departureCountry,
  sameCountry,
  budget,
  persons,
  duration,
}: {
  environment: string;
  destinationStyles: DestinationStyle[];
  departureCountry: string;
  sameCountry: boolean;
  budget: number;
  persons: number;
  duration: number;
}) {
  const requestedEnvironments = parseEnvironments(environment);
  const env = requestedEnvironments[0] || 'ville';
  const budgetLevel = getBudgetLevel(budget, persons);
  const allowFar =
    !sameCountry &&
    duration >= 7 &&
    (budgetLevel === 'high' || budgetLevel === 'veryHigh');

  const countrySuffix = sameCountry ? departureCountry : 'Europe';
  const queries: string[] = [];

  if (env === 'mer') {
    queries.push(`best seaside towns ${countrySuffix}`);
    queries.push(`beach towns ${countrySuffix}`);
    queries.push(`coastal cities ${countrySuffix}`);

    if (sameCountry && normalizeText(departureCountry) === 'france') {
      queries.push('stations balnéaires France');
      queries.push('villes bord de mer France');
      queries.push('plages Normandie Bretagne Côte d Opale Atlantique Méditerranée');
    }

    if (allowFar) {
      queries.push('best beach destinations Europe');
      queries.push('underrated seaside towns Europe');
    }
  } else if (env === 'montagne') {
    queries.push(`best mountain towns ${countrySuffix}`);
    queries.push(`alpine towns ${countrySuffix}`);

    if (sameCountry && normalizeText(departureCountry) === 'france') {
      queries.push('villes montagne France Alpes Vosges Pyrénées Jura');
    }

    if (allowFar) {
      queries.push('best mountain destinations Europe');
    }
  } else if (env === 'nature') {
    queries.push(`best nature destinations ${countrySuffix}`);
    queries.push(`lake towns nature ${countrySuffix}`);

    if (sameCountry && normalizeText(departureCountry) === 'france') {
      queries.push('destinations nature France lacs forêts parcs naturels');
    }

    if (allowFar) {
      queries.push('best nature destinations Europe');
    }
  } else if (env === 'campagne') {
    queries.push(`best countryside towns ${countrySuffix}`);

    if (sameCountry && normalizeText(departureCountry) === 'france') {
      queries.push('plus beaux villages France campagne');
    }
  } else {
    queries.push(`best city break destinations ${countrySuffix}`);
    queries.push(`underrated city break destinations ${countrySuffix}`);

    if (allowFar && destinationStyles.includes('classic')) {
      queries.push('classic city trip destinations worldwide');
    }
  }

  if (destinationStyles.includes('offbeat')) {
    queries.push(`offbeat destinations ${countrySuffix}`);
  }

  if (destinationStyles.includes('surprising')) {
    queries.push(`hidden gem destinations ${countrySuffix}`);
  }

  return Array.from(new Set(queries)).slice(0, 10);
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

export async function GET(req: NextRequest) {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { searchParams } = new URL(req.url);

  const environment = searchParams.get('environment') || '';
  const departureRaw = searchParams.get('departure') || '';
  const budget = Number(searchParams.get('budget') || 0);
  const persons = Math.max(1, Number(searchParams.get('persons') || 1));
  const duration = Math.max(1, Number(searchParams.get('duration') || 3));

  const sameCountry =
    isTruthy(searchParams.get('sameCountry')) ||
    isTruthy(searchParams.get('staySameCountry')) ||
    isTruthy(searchParams.get('domesticOnly'));

  const destinationStyles = parseDestinationStyles(
    searchParams.get('destinationStyle') || ''
  );

  const requestedEnvironments = parseEnvironments(environment);
  const departure = inferDeparture(departureRaw);

  const curatedResults = buildCuratedResults({
    departure,
    requestedEnvironments,
    requestedStyles: destinationStyles,
    budget,
    persons,
    duration,
    sameCountry,
  });

  const queries = buildSearchQueries({
    environment,
    destinationStyles,
    departureCountry: departure.country,
    sameCountry,
    budget,
    persons,
    duration,
  });

  if (!apiKey) {
    const fallback = uniqueDestinations(curatedResults)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 18);

    return NextResponse.json({
      ok: true,
      source: 'Sélection Gototrip',
      warning:
        'Clé Google Places manquante. Gototrip utilise la sélection cohérente interne.',
      departure,
      sameCountry,
      requestedEnvironments,
      destinationStyles,
      count: fallback.length,
      destinations: fallback,
    });
  }

  try {
    const results = await Promise.allSettled(
      queries.map((query) => searchGooglePlacesText(query, apiKey))
    );

    const allPlaces = results.flatMap((result) => {
      if (result.status !== 'fulfilled') return [];
      return result.value;
    });

    const googleDestinations = uniqueByNameAndCountry(allPlaces)
      .filter(isValidDestination)
      .map((place) =>
        mapPlaceToDestination(
          place,
          destinationStyles,
          requestedEnvironments,
          departure,
          budget,
          persons,
          duration,
          sameCountry
        )
      )
      .filter(Boolean) as DestinationCandidate[];

    let destinations = uniqueDestinations([...curatedResults, ...googleDestinations])
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 18);

    if (destinations.length === 0) {
      destinations = curatedResults
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 18);
    }

    return NextResponse.json({
      ok: true,
      source: 'Gototrip coherent destination scoring',
      departure,
      sameCountry,
      requestedEnvironments,
      destinationStyles,
      queries,
      count: destinations.length,
      destinations,
    });
  } catch (e: any) {
    const fallback = uniqueDestinations(curatedResults)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 18);

    return NextResponse.json({
      ok: true,
      source: 'Sélection Gototrip',
      warning:
        e?.message ||
        'Erreur pendant la recherche destinations. Utilisation de la sélection cohérente interne.',
      departure,
      sameCountry,
      requestedEnvironments,
      destinationStyles,
      queries,
      count: fallback.length,
      destinations: fallback,
    });
  }
}