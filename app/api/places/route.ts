import { NextRequest, NextResponse } from 'next/server';

type GoogleOpeningHours = {
  openNow?: boolean;
  weekdayDescriptions?: string[];
  periods?: {
    open?: {
      day?: number;
      hour?: number;
      minute?: number;
    };
    close?: {
      day?: number;
      hour?: number;
      minute?: number;
    };
  }[];
};

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
  websiteUri?: string;
  priceLevel?: string;
  editorialSummary?: {
    text?: string;
    languageCode?: string;
  };
  regularOpeningHours?: GoogleOpeningHours;
  currentOpeningHours?: GoogleOpeningHours;
};

type PlaceType = 'activities' | 'restaurants' | 'stays';

type PlaceResult = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number;
  types: string[];
  primaryType: string;
  googleMapsUri: string;
  link: string;
  description: string;
  source: string;
  isReal: boolean;
  pricePerPerson?: number;
  pricePerNightPerPerson?: number;
  estimatedDurationMinutes?: number;
  durationLabel?: string;
  openingHoursSummary?: string;
  openingPeriods?: {
    openDay: number;
    openHour: number;
    openMinute: number;
    closeDay: number;
    closeHour: number;
    closeMinute: number;
  }[];
  openNow?: boolean | null;
};

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function getApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ''
  );
}

function parseNumber(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getPlaceText(place: GooglePlace) {
  return normalizeText(
    `${place.displayName?.text || ''} ${place.primaryType || ''} ${
      place.types?.join(' ') || ''
    }`
  );
}

function isFastFood(place: GooglePlace) {
  const text = getPlaceText(place);

  const fastFoodKeywords = [
    'fast_food',
    'fast food',
    'mcdonald',
    'mc donald',
    'burger king',
    'kfc',
    'subway',
    'quick',
    'taco bell',
    'five guys',
    'domino',
    'pizza hut',
    'pret a manger',
  ];

  return fastFoodKeywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function isCafe(place: GooglePlace) {
  const text = getPlaceText(place);

  return (
    text.includes('cafe') ||
    text.includes('coffee') ||
    text.includes('coffee_shop') ||
    text.includes('bakery') ||
    text.includes('boulangerie')
  );
}

function isBar(place: GooglePlace) {
  const text = getPlaceText(place);

  return (
    text.includes('bar') ||
    text.includes('pub') ||
    text.includes('wine_bar') ||
    text.includes('night_club')
  );
}

function isFineDining(place: GooglePlace) {
  const text = getPlaceText(place);

  return (
    text.includes('fine_dining') ||
    text.includes('gastronom') ||
    text.includes('michelin') ||
    text.includes('luxury') ||
    text.includes('gourmet')
  );
}

function isPaidActivity(place: GooglePlace) {
  const text = getPlaceText(place);

  const paidKeywords = [
    'museum',
    'musee',
    'library',
    'research_institute',
    'movie_theater',
    'cinema',
    'zoo',
    'aquarium',
    'amusement_park',
    'theme_park',
    'tour_operator',
    'guided_tour',
    'escape_game',
    'bowling',
    'stadium',
    'sports_complex',
    'fitness_center',
    'spa',
    'casino',
    'theater',
    'opera',
    'concert_hall',
    'art_gallery',
  ];

  return paidKeywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function isActuallyFreeActivity(place: GooglePlace) {
  const text = getPlaceText(place);

  if (isPaidActivity(place)) {
    return false;
  }

  const freeKeywords = [
    'park',
    'parc',
    'public_garden',
    'garden',
    'beach',
    'plage',
    'square',
    'plaza',
    'viewpoint',
    'scenic_point',
    'walking_area',
    'promenade',
    'hiking_area',
    'nature_reserve',
    'tourist_attraction',
    'historical_landmark',
    'monument',
    'church',
    'cathedral',
    'bridge',
    'market',
  ];

  return freeKeywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function getIncludedTypes(type: PlaceType, filter: string) {
  const normalized = normalizeText(filter);

  if (type === 'restaurants') {
    if (normalized.includes('fast')) return ['fast_food_restaurant'];
    if (normalized.includes('cafe')) return ['cafe'];
    if (normalized.includes('bar')) return ['bar'];
    if (normalized.includes('gastronom')) return ['fine_dining_restaurant'];
    if (normalized.includes('local')) return ['restaurant'];

    return ['restaurant'];
  }

  if (type === 'stays') {
    if (normalized.includes('camping')) return ['campground'];
    if (normalized.includes('auberge')) return ['hostel'];

    return ['hotel'];
  }

  if (normalized.includes('enfant') || normalized.includes('famille')) {
    return ['tourist_attraction', 'amusement_park', 'zoo', 'aquarium'];
  }

  if (normalized.includes('sport')) {
    return ['stadium', 'sports_complex', 'fitness_center'];
  }

  if (normalized.includes('culture')) {
    return ['museum', 'art_gallery', 'historical_landmark'];
  }

  if (normalized.includes('nature')) {
    return ['park', 'national_park', 'hiking_area', 'tourist_attraction'];
  }

  if (normalized.includes('cinema') || normalized.includes('cinéma')) {
    return ['movie_theater'];
  }

  if (normalized.includes('boite') || normalized.includes('nuit')) {
    return ['night_club', 'bar'];
  }

  if (normalized.includes('gratuit')) {
    return ['park', 'tourist_attraction', 'historical_landmark', 'hiking_area'];
  }

  return ['tourist_attraction', 'museum', 'park', 'historical_landmark'];
}

function getTextQuery(type: PlaceType, city: string, filter: string) {
  const normalized = normalizeText(filter);

  if (type === 'restaurants') {
    if (normalized.includes('fast')) return `fast food ${city}`;
    if (normalized.includes('gastronom')) return `restaurant gastronomique ${city}`;
    if (normalized.includes('local')) return `restaurant local ${city}`;
    if (normalized.includes('bar')) return `bar ${city}`;
    if (normalized.includes('cafe')) return `café ${city}`;

    return `restaurants ${city}`;
  }

  if (type === 'stays') {
    if (normalized.includes('camping')) return `camping ${city}`;
    if (normalized.includes('auberge')) return `auberge de jeunesse ${city}`;
    if (normalized.includes('appartement')) return `appartement vacances ${city}`;
    if (normalized.includes('maison')) return `maison vacances ${city}`;
    if (normalized.includes('lux')) return `hotel luxe ${city}`;

    return `hotel ${city}`;
  }

  if (normalized.includes('gratuit')) {
    return `activités gratuites parc monument balade ${city}`;
  }

  if (normalized.includes('boite') || normalized.includes('nuit')) {
    return `night club ${city}`;
  }

  if (normalized.includes('cinema') || normalized.includes('cinéma')) {
    return `cinéma ${city}`;
  }

  if (normalized.includes('sport')) {
    return `activité sportive ${city}`;
  }

  if (normalized.includes('culture')) {
    return `musée monument culture ${city}`;
  }

  if (normalized.includes('nature')) {
    return `parc nature ${city}`;
  }

  if (normalized.includes('enfant') || normalized.includes('famille')) {
    return `activité famille enfants ${city}`;
  }

  return `activités touristiques ${city}`;
}

function getEstimatedDurationMinutes(place: GooglePlace, type: PlaceType) {
  const text = getPlaceText(place);

  if (type === 'restaurants') {
    if (isFastFood(place)) return 35;
    if (isCafe(place)) return 45;
    if (isBar(place)) return 90;
    if (isFineDining(place)) return 150;

    return 90;
  }

  if (type === 'stays') {
    return 0;
  }

  if (text.includes('night_club')) return 180;
  if (text.includes('movie_theater')) return 150;
  if (text.includes('museum')) return 120;
  if (text.includes('library')) return 60;
  if (text.includes('art_gallery')) return 90;
  if (text.includes('zoo')) return 180;
  if (text.includes('aquarium')) return 120;
  if (text.includes('amusement_park')) return 240;
  if (text.includes('park')) return 90;
  if (text.includes('hiking_area')) return 180;
  if (text.includes('historical_landmark')) return 75;
  if (text.includes('tourist_attraction')) return 90;

  return 90;
}

function formatDurationLabel(minutes: number) {
  if (!minutes || minutes <= 0) return 'Variable';

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h}h`;

  return `${h}h${String(m).padStart(2, '0')}`;
}

function getRestaurantPriceEstimate(place: GooglePlace) {
  const priceLevel = place.priceLevel || '';

  if (isFastFood(place)) return { pricePerPerson: 12 };
  if (isCafe(place)) return { pricePerPerson: 15 };
  if (isBar(place)) return { pricePerPerson: 20 };
  if (isFineDining(place)) return { pricePerPerson: 75 };

  if (priceLevel.includes('VERY_EXPENSIVE')) return { pricePerPerson: 80 };
  if (priceLevel.includes('EXPENSIVE')) return { pricePerPerson: 50 };
  if (priceLevel.includes('MODERATE')) return { pricePerPerson: 30 };
  if (priceLevel.includes('INEXPENSIVE')) return { pricePerPerson: 18 };

  return { pricePerPerson: 25 };
}

function getStayPriceEstimate(place: GooglePlace) {
  const text = getPlaceText(place);
  const priceLevel = place.priceLevel || '';

  if (text.includes('hostel')) return { pricePerNightPerPerson: 35 };
  if (text.includes('campground')) return { pricePerNightPerPerson: 25 };

  if (priceLevel.includes('VERY_EXPENSIVE')) return { pricePerNightPerPerson: 180 };
  if (priceLevel.includes('EXPENSIVE')) return { pricePerNightPerPerson: 120 };
  if (priceLevel.includes('MODERATE')) return { pricePerNightPerPerson: 80 };
  if (priceLevel.includes('INEXPENSIVE')) return { pricePerNightPerPerson: 55 };

  return { pricePerNightPerPerson: 80 };
}

function getActivityPriceEstimate(place: GooglePlace) {
  const text = getPlaceText(place);

  if (isActuallyFreeActivity(place)) return { pricePerPerson: 0 };

  if (text.includes('museum')) return { pricePerPerson: 15 };
  if (text.includes('library')) return { pricePerPerson: 0 };
  if (text.includes('research_institute')) return { pricePerPerson: 0 };
  if (text.includes('movie_theater')) return { pricePerPerson: 13 };
  if (text.includes('night_club')) return { pricePerPerson: 20 };
  if (text.includes('zoo') || text.includes('aquarium')) return { pricePerPerson: 25 };
  if (text.includes('amusement_park')) return { pricePerPerson: 45 };
  if (text.includes('tour')) return { pricePerPerson: 30 };
  if (text.includes('art_gallery')) return { pricePerPerson: 12 };
  if (text.includes('stadium')) return { pricePerPerson: 20 };
  if (text.includes('sports_complex')) return { pricePerPerson: 18 };
  if (text.includes('fitness_center')) return { pricePerPerson: 15 };

  return { pricePerPerson: 20 };
}

function getPriceEstimate(place: GooglePlace, type: PlaceType) {
  if (type === 'restaurants') return getRestaurantPriceEstimate(place);
  if (type === 'stays') return getStayPriceEstimate(place);

  return getActivityPriceEstimate(place);
}

function buildRestaurantDescription(place: GooglePlace) {
  const rating = place.rating || 'à vérifier';

  if (isFastFood(place)) {
    return `Option rapide et économique, pratique pour un repas simple pendant le séjour. Elle est notée ${rating}/5 par les visiteurs.`;
  }

  if (isCafe(place)) {
    return `Café ou adresse légère, pratique pour une pause ou un repas rapide. Elle est notée ${rating}/5 par les visiteurs.`;
  }

  if (isBar(place)) {
    return `Adresse adaptée pour un verre, une sortie ou une soirée. Elle est notée ${rating}/5 par les visiteurs.`;
  }

  if (isFineDining(place)) {
    return `Adresse plus haut de gamme, adaptée à un repas soigné ou une occasion spéciale. Elle est notée ${rating}/5 par les visiteurs.`;
  }

  return `Restaurant proposé selon vos critères. Il est noté ${rating}/5 par les visiteurs.`;
}

function buildActivityDescription(place: GooglePlace) {
  const rating = place.rating || 'à vérifier';

  if (isActuallyFreeActivity(place)) {
    return `Activité gratuite ou en accès libre, idéale pour profiter de la destination sans augmenter le budget. Elle est notée ${rating}/5 par les visiteurs.`;
  }

  return `Activité proposée selon vos critères. Elle est notée ${rating}/5 sur Google.`;
}

function buildDescription(place: GooglePlace, type: PlaceType) {
  if (type === 'restaurants') {
    return buildRestaurantDescription(place);
  }

  if (type === 'stays') {
    return `Hébergement proposé selon vos critères. Les disponibilités et tarifs seront confirmés sur le site partenaire.`;
  }

  return buildActivityDescription(place);
}

function convertOpeningPeriods(hours?: GoogleOpeningHours) {
  if (!hours?.periods || !Array.isArray(hours.periods)) return [];

  return hours.periods
    .map((period) => {
      const open = period.open || {};
      const close = period.close || {};

      return {
        openDay: Number(open.day ?? 0),
        openHour: Number(open.hour ?? 0),
        openMinute: Number(open.minute ?? 0),
        closeDay: Number(close.day ?? open.day ?? 0),
        closeHour: Number(close.hour ?? 23),
        closeMinute: Number(close.minute ?? 59),
      };
    })
    .filter((period) => {
      return (
        Number.isFinite(period.openDay) &&
        Number.isFinite(period.openHour) &&
        Number.isFinite(period.closeDay) &&
        Number.isFinite(period.closeHour)
      );
    });
}

function getOpeningSummary(hours?: GoogleOpeningHours) {
  if (!hours?.weekdayDescriptions?.length) {
    return 'Horaires à vérifier';
  }

  return hours.weekdayDescriptions.slice(0, 2).join(' • ');
}

function mapGooglePlace(place: GooglePlace, type: PlaceType): PlaceResult | null {
  const name = place.displayName?.text || '';
  const lat = Number(place.location?.latitude);
  const lng = Number(place.location?.longitude);

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const hours = place.currentOpeningHours || place.regularOpeningHours;
  const estimatedDurationMinutes = getEstimatedDurationMinutes(place, type);
  const price = getPriceEstimate(place, type);

  return {
    id: place.id || `${name}-${lat}-${lng}`,
    name,
    address: place.formattedAddress || '',
    lat,
    lng,
    rating: place.rating || null,
    userRatingCount: place.userRatingCount || 0,
    types: place.types || [],
    primaryType: place.primaryType || '',
    googleMapsUri: place.googleMapsUri || '',
    link: place.websiteUri || place.googleMapsUri || '#',
    description: buildDescription(place, type),
    source: 'Google Places',
    isReal: true,
    ...price,
    estimatedDurationMinutes,
    durationLabel: formatDurationLabel(estimatedDurationMinutes),
    openingHoursSummary: getOpeningSummary(hours),
    openingPeriods: convertOpeningPeriods(hours),
    openNow: typeof hours?.openNow === 'boolean' ? hours.openNow : null,
  };
}

function filterPlacesByRequestedFilter(
  places: PlaceResult[],
  rawPlaces: GooglePlace[],
  type: PlaceType,
  filter: string
) {
  const normalized = normalizeText(filter);

  if (type !== 'activities') {
    return places;
  }

  if (!normalized.includes('gratuit')) {
    return places;
  }

  const freeIds = new Set(
    rawPlaces
      .filter((place) => isActuallyFreeActivity(place))
      .map((place) => place.id || '')
  );

  const filtered = places.filter((place) => {
    return place.pricePerPerson === 0 || freeIds.has(place.id);
  });

  if (filtered.length > 0) {
    return filtered;
  }

  return places;
}

async function searchNearby({
  apiKey,
  lat,
  lng,
  type,
  filter,
}: {
  apiKey: string;
  lat: number;
  lng: number;
  type: PlaceType;
  filter: string;
}) {
  const includedTypes = getIncludedTypes(type, filter);

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryType,places.googleMapsUri,places.websiteUri,places.priceLevel,places.editorialSummary,places.regularOpeningHours,places.currentOpeningHours',
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 12,
      languageCode: 'fr',
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: 12000,
        },
      },
    }),
    cache: 'no-store',
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error?.message || 'Erreur Google Places Nearby Search.');
  }

  return Array.isArray(json.places) ? json.places : [];
}

async function searchText({
  apiKey,
  city,
  type,
  filter,
}: {
  apiKey: string;
  city: string;
  type: PlaceType;
  filter: string;
}) {
  const textQuery = getTextQuery(type, city, filter);

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryType,places.googleMapsUri,places.websiteUri,places.priceLevel,places.editorialSummary,places.regularOpeningHours,places.currentOpeningHours',
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'fr',
      maxResultCount: 12,
    }),
    cache: 'no-store',
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error?.message || 'Erreur Google Places Text Search.');
  }

  return Array.isArray(json.places) ? json.places : [];
}

function dedupePlaces(places: PlaceResult[]) {
  const seen = new Set<string>();

  return places.filter((place) => {
    const key = `${normalizeText(place.name)}-${Math.round(place.lat * 1000)}-${Math.round(
      place.lng * 1000
    )}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function fallbackPlaces(type: PlaceType, city: string): PlaceResult[] {
  const base = {
    lat: 0,
    lng: 0,
    rating: null,
    userRatingCount: 0,
    types: [],
    primaryType: '',
    googleMapsUri: '',
    link: '#',
    source: 'Fallback Gototrip',
    isReal: false,
    openingHoursSummary: 'Horaires à vérifier',
    openingPeriods: [],
    openNow: null,
  };

  if (type === 'restaurants') {
    return [
      {
        ...base,
        id: 'restaurant-local',
        name: `Restaurant local à ${city}`,
        address: city,
        description: 'Restaurant suggéré en fallback. À remplacer par Google Places.',
        pricePerPerson: 25,
        estimatedDurationMinutes: 90,
        durationLabel: '1h30',
      },
    ];
  }

  if (type === 'stays') {
    return [
      {
        ...base,
        id: 'hotel-central',
        name: `Hébergement central à ${city}`,
        address: city,
        description: 'Hébergement suggéré en fallback. À remplacer par Google Places.',
        pricePerNightPerPerson: 80,
        estimatedDurationMinutes: 0,
        durationLabel: 'Variable',
      },
    ];
  }

  return [
    {
      ...base,
      id: 'activity-main',
      name: `Activité principale à ${city}`,
      address: city,
      description: 'Activité suggérée en fallback. À remplacer par Google Places.',
      pricePerPerson: 20,
      estimatedDurationMinutes: 90,
      durationLabel: '1h30',
    },
  ];
}

export async function GET(req: NextRequest) {
  const apiKey = getApiKey();
  const { searchParams } = new URL(req.url);

  const rawType = searchParams.get('type') || 'activities';
  const type: PlaceType =
    rawType === 'restaurants' || rawType === 'stays' ? rawType : 'activities';

  const city = searchParams.get('city') || 'destination';
  const filter =
    searchParams.get('filter') ||
    searchParams.get('category') ||
    searchParams.get('activityFilter') ||
    searchParams.get('restaurantFilter') ||
    searchParams.get('lodging') ||
    '';

  const lat = parseNumber(searchParams.get('lat'), NaN);
  const lng = parseNumber(searchParams.get('lng'), NaN);

  if (!apiKey) {
    const fallback = fallbackPlaces(type, city);

    return NextResponse.json({
      ok: true,
      source: 'Fallback Gototrip',
      warning: 'Clé Google Places manquante.',
      places: fallback,
    });
  }

  try {
    let rawPlaces: GooglePlace[] = [];

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      rawPlaces = await searchNearby({
        apiKey,
        lat,
        lng,
        type,
        filter,
      });
    }

    if (rawPlaces.length === 0) {
      rawPlaces = await searchText({
        apiKey,
        city,
        type,
        filter,
      });
    }

    const mappedPlaces = dedupePlaces(
      rawPlaces
        .map((place) => mapGooglePlace(place, type))
        .filter(Boolean) as PlaceResult[]
    );

    const places = filterPlacesByRequestedFilter(
      mappedPlaces,
      rawPlaces,
      type,
      filter
    );

    return NextResponse.json({
      ok: true,
      source: 'Google Places',
      count: places.length,
      places,
    });
  } catch (error: any) {
    const fallback = fallbackPlaces(type, city);

    return NextResponse.json({
      ok: true,
      source: 'Fallback Gototrip',
      warning: error?.message || 'Erreur Google Places.',
      places: fallback,
    });
  }
}