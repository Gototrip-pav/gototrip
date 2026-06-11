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

type ActivityResult = {
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
  pricePerPerson: number;
  priceTotal?: number;
  currency?: string;
  imageUrl?: string;
  partnerId?: string | number;
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

function parseNumber(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getGoogleApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ''
  );
}

function getGetYourGuideConfig() {
  const token =
    process.env.GETYOURGUIDE_API_TOKEN ||
    process.env.GYG_API_TOKEN ||
    '';

  const baseUrl =
    process.env.GETYOURGUIDE_API_BASE_URL ||
    process.env.GYG_API_BASE_URL ||
    'https://api.getyourguide.com';

  return {
    token,
    baseUrl,
    enabled: Boolean(token),
  };
}

function getPlaceText(place: GooglePlace) {
  return normalizeText(
    `${place.displayName?.text || ''} ${place.primaryType || ''} ${
      place.types?.join(' ') || ''
    }`
  );
}

function isPaidActivityText(text: string) {
  const paidKeywords = [
    'museum',
    'musee',
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

function isActuallyFreeActivityText(text: string) {
  if (isPaidActivityText(text)) return false;

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
    'historical_landmark',
    'monument',
    'bridge',
    'market',
  ];

  return freeKeywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function estimateGoogleActivityPrice(place: GooglePlace) {
  const text = getPlaceText(place);

  if (isActuallyFreeActivityText(text)) return 0;

  if (text.includes('museum')) return 15;
  if (text.includes('library')) return 0;
  if (text.includes('research_institute')) return 0;
  if (text.includes('movie_theater')) return 13;
  if (text.includes('night_club')) return 20;
  if (text.includes('zoo') || text.includes('aquarium')) return 25;
  if (text.includes('amusement_park')) return 45;
  if (text.includes('tour')) return 30;
  if (text.includes('art_gallery')) return 12;
  if (text.includes('stadium')) return 20;
  if (text.includes('sports_complex')) return 18;
  if (text.includes('fitness_center')) return 15;

  return 20;
}

function getEstimatedDurationMinutesFromText(text: string) {
  const normalized = normalizeText(text);

  if (normalized.includes('night_club')) return 180;
  if (normalized.includes('movie_theater') || normalized.includes('cinema')) return 150;
  if (normalized.includes('museum') || normalized.includes('musee')) return 120;
  if (normalized.includes('art_gallery')) return 90;
  if (normalized.includes('zoo')) return 180;
  if (normalized.includes('aquarium')) return 120;
  if (normalized.includes('amusement_park')) return 240;
  if (normalized.includes('park') || normalized.includes('parc')) return 90;
  if (normalized.includes('hiking_area')) return 180;
  if (normalized.includes('historical_landmark')) return 75;
  if (normalized.includes('tourist_attraction')) return 90;
  if (normalized.includes('tour')) return 180;

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

function buildGoogleDescription(place: GooglePlace) {
  const text = getPlaceText(place);
  const rating = place.rating || 'à vérifier';

  if (place.editorialSummary?.text) {
    return place.editorialSummary.text;
  }

  if (isActuallyFreeActivityText(text)) {
    return `Activité gratuite ou en accès libre, idéale pour profiter de la destination sans augmenter le budget. Elle est notée ${rating}/5 par les visiteurs.`;
  }

  return `Activité proposée selon vos critères. Elle est notée ${rating}/5 sur Google.`;
}

function mapGooglePlaceToActivity(place: GooglePlace): ActivityResult | null {
  const name = place.displayName?.text || '';
  const lat = Number(place.location?.latitude);
  const lng = Number(place.location?.longitude);

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const hours = place.currentOpeningHours || place.regularOpeningHours;
  const text = getPlaceText(place);
  const duration = getEstimatedDurationMinutesFromText(text);

  return {
    id: place.id || `${slugify(name)}-${lat}-${lng}`,
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
    description: buildGoogleDescription(place),
    source: 'Google Places',
    isReal: true,
    pricePerPerson: estimateGoogleActivityPrice(place),
    currency: 'EUR',
    estimatedDurationMinutes: duration,
    durationLabel: formatDurationLabel(duration),
    openingHoursSummary: getOpeningSummary(hours),
    openingPeriods: convertOpeningPeriods(hours),
    openNow: typeof hours?.openNow === 'boolean' ? hours.openNow : null,
  };
}

function getGoogleIncludedTypes(filter: string) {
  const normalized = normalizeText(filter);

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

function getGoogleTextQuery(city: string, filter: string) {
  const normalized = normalizeText(filter);

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

async function searchGoogleActivities({
  lat,
  lng,
  city,
  filter,
}: {
  lat: number;
  lng: number;
  city: string;
  filter: string;
}) {
  const apiKey = getGoogleApiKey();

  if (!apiKey) return [];

  const fieldMask =
    'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryType,places.googleMapsUri,places.websiteUri,places.priceLevel,places.editorialSummary,places.regularOpeningHours,places.currentOpeningHours';

  let rawPlaces: GooglePlace[] = [];

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const nearbyRes = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify({
          includedTypes: getGoogleIncludedTypes(filter),
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
      }
    );

    const nearbyJson = await nearbyRes.json();

    if (nearbyRes.ok && Array.isArray(nearbyJson.places)) {
      rawPlaces = nearbyJson.places;
    }
  }

  if (rawPlaces.length === 0) {
    const textRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        textQuery: getGoogleTextQuery(city, filter),
        languageCode: 'fr',
        maxResultCount: 12,
      }),
      cache: 'no-store',
    });

    const textJson = await textRes.json();

    if (textRes.ok && Array.isArray(textJson.places)) {
      rawPlaces = textJson.places;
    }
  }

  const mapped = rawPlaces
    .map((place) => mapGooglePlaceToActivity(place))
    .filter(Boolean) as ActivityResult[];

  return dedupeActivities(filterFreeActivitiesIfNeeded(mapped, filter));
}

function getNestedNumber(value: any, paths: string[]) {
  for (const path of paths) {
    const parts = path.split('.');
    let current = value;

    for (const part of parts) {
      if (current === undefined || current === null) break;
      current = current[part];
    }

    const number = Number(current);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function getNestedString(value: any, paths: string[]) {
  for (const path of paths) {
    const parts = path.split('.');
    let current = value;

    for (const part of parts) {
      if (current === undefined || current === null) break;
      current = current[part];
    }

    if (typeof current === 'string' && current.trim()) {
      return current;
    }
  }

  return '';
}

function getNestedArray(value: any, paths: string[]) {
  for (const path of paths) {
    const parts = path.split('.');
    let current = value;

    for (const part of parts) {
      if (current === undefined || current === null) break;
      current = current[part];
    }

    if (Array.isArray(current)) return current;
  }

  return [];
}

function mapGetYourGuideActivity(raw: any, city: string): ActivityResult | null {
  const id =
    raw.id ||
    raw.activity_id ||
    raw.tour_id ||
    raw.product_id ||
    raw.gyg_activity_id;

  const name =
    getNestedString(raw, [
      'title',
      'name',
      'activity.title',
      'product.title',
      'translations.0.title',
    ]) || `Activité ${id || ''}`.trim();

  if (!name) return null;

  const lat =
    getNestedNumber(raw, [
      'coordinates.latitude',
      'location.latitude',
      'starting_point.latitude',
      'meeting_point.latitude',
      'venue.latitude',
    ]) || 0;

  const lng =
    getNestedNumber(raw, [
      'coordinates.longitude',
      'location.longitude',
      'starting_point.longitude',
      'meeting_point.longitude',
      'venue.longitude',
    ]) || 0;

  const price =
    getNestedNumber(raw, [
      'price.amount',
      'price.from',
      'price.starting_from',
      'retail_price.amount',
      'pricing.from_price',
      'from_price',
    ]) || 0;

  const currency =
    getNestedString(raw, [
      'price.currency',
      'retail_price.currency',
      'pricing.currency',
      'currency',
    ]) || 'EUR';

  const rating =
    getNestedNumber(raw, [
      'rating',
      'review_rating',
      'reviews.rating',
      'statistics.rating',
    ]);

  const reviewCount =
    getNestedNumber(raw, [
      'reviews.count',
      'review_count',
      'statistics.review_count',
    ]) || 0;

  const description =
    getNestedString(raw, [
      'description',
      'short_description',
      'abstract',
      'summary',
      'translations.0.description',
    ]) ||
    'Activité proposée via GetYourGuide. Prix et disponibilité à confirmer sur le site partenaire.';

  const url =
    getNestedString(raw, [
      'url',
      'link',
      'booking_url',
      'deep_link',
      'activity_url',
    ]) || '#';

  const imageUrl =
    getNestedString(raw, [
      'image.url',
      'cover_image.url',
      'pictures.0.url',
      'images.0.url',
      'photos.0.url',
    ]) || '';

  const categories = getNestedArray(raw, ['categories', 'tags', 'activity.categories']);

  const durationMinutes =
    getNestedNumber(raw, [
      'duration.minutes',
      'duration_in_minutes',
      'duration',
    ]) || getEstimatedDurationMinutesFromText(`${name} ${description}`);

  return {
    id: `gyg-${id || slugify(name)}`,
    name,
    address: city,
    lat,
    lng,
    rating,
    userRatingCount: reviewCount,
    types: Array.isArray(categories)
      ? categories.map((item: any) => String(item?.name || item)).filter(Boolean)
      : ['tour'],
    primaryType: 'tour',
    googleMapsUri:
      lat && lng
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${name} ${city}`
          )}`
        : '',
    link: url,
    description,
    source: 'GetYourGuide',
    isReal: true,
    pricePerPerson: price || 30,
    priceTotal: price || undefined,
    currency,
    imageUrl,
    partnerId: id,
    estimatedDurationMinutes: durationMinutes,
    durationLabel: formatDurationLabel(durationMinutes),
    openingHoursSummary: 'Disponibilités à confirmer sur GetYourGuide',
    openingPeriods: [],
    openNow: null,
  };
}

async function searchGetYourGuideActivities({
  city,
  lat,
  lng,
  filter,
  currency,
  date,
}: {
  city: string;
  lat: number;
  lng: number;
  filter: string;
  currency: string;
  date: string;
}) {
  const config = getGetYourGuideConfig();

  if (!config.enabled) {
    return {
      activities: [] as ActivityResult[],
      warning:
        'GetYourGuide non configuré. Ajoute GETYOURGUIDE_API_TOKEN dans .env.local.',
    };
  }

  const candidates = [
    {
      url: `${config.baseUrl}/partner/v1/activities`,
      query: {
        q: `${filter || 'activities'} ${city}`,
        currency,
        limit: '12',
        date,
      },
    },
    {
      url: `${config.baseUrl}/1/tours`,
      query: {
        q: `${filter || 'activities'} ${city}`,
        cnt_language: 'fr',
        currency,
        limit: '12',
      },
    },
  ];

  let lastWarning = '';

  for (const candidate of candidates) {
    const params = new URLSearchParams(candidate.query);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
    }

    try {
      const res = await fetch(`${candidate.url}?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${config.token}`,
          'X-Access-Token': config.token,
        },
        cache: 'no-store',
      });

      const json = await res.json();

      if (!res.ok) {
        lastWarning =
          json?.message ||
          json?.error ||
          `GetYourGuide endpoint indisponible : ${candidate.url}`;
        continue;
      }

      const rawItems =
        (Array.isArray(json.data) && json.data) ||
        (Array.isArray(json.activities) && json.activities) ||
        (Array.isArray(json.tours) && json.tours) ||
        (Array.isArray(json.items) && json.items) ||
        [];

      const mapped = rawItems
        .map((item: any) => mapGetYourGuideActivity(item, city))
        .filter(Boolean) as ActivityResult[];

      if (mapped.length > 0) {
        return {
          activities: dedupeActivities(mapped),
          warning: '',
        };
      }
    } catch (error: any) {
      lastWarning = error?.message || 'Erreur GetYourGuide.';
    }
  }

  return {
    activities: [] as ActivityResult[],
    warning: lastWarning || 'Aucune activité GetYourGuide trouvée.',
  };
}

function filterFreeActivitiesIfNeeded(
  activities: ActivityResult[],
  filter: string
) {
  const normalized = normalizeText(filter);

  if (!normalized.includes('gratuit')) return activities;

  const filtered = activities.filter((activity) => {
    const text = normalizeText(
      `${activity.name} ${activity.primaryType} ${activity.types.join(' ')}`
    );

    return activity.pricePerPerson === 0 || isActuallyFreeActivityText(text);
  });

  if (filtered.length > 0) return filtered;

  return activities;
}

function dedupeActivities(activities: ActivityResult[]) {
  const seen = new Set<string>();

  return activities.filter((activity) => {
    const key = `${normalizeText(activity.name)}-${Math.round(
      activity.lat * 1000
    )}-${Math.round(activity.lng * 1000)}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function fallbackActivities(city: string): ActivityResult[] {
  return [
    {
      id: 'fallback-activity-main',
      name: `Activité principale à ${city}`,
      address: city,
      lat: 0,
      lng: 0,
      rating: null,
      userRatingCount: 0,
      types: ['tourist_attraction'],
      primaryType: 'tourist_attraction',
      googleMapsUri: '',
      link: '#',
      description:
        'Activité temporaire utilisée en fallback. À remplacer par GetYourGuide ou Google Places.',
      source: 'Fallback Gototrip',
      isReal: false,
      pricePerPerson: 20,
      currency: 'EUR',
      estimatedDurationMinutes: 90,
      durationLabel: '1h30',
      openingHoursSummary: 'Horaires à vérifier',
      openingPeriods: [],
      openNow: null,
    },
  ];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const city = searchParams.get('city') || 'destination';
  const filter =
    searchParams.get('filter') ||
    searchParams.get('category') ||
    searchParams.get('activityFilter') ||
    '';

  const lat = parseNumber(searchParams.get('lat'), NaN);
  const lng = parseNumber(searchParams.get('lng'), NaN);
  const currency = searchParams.get('currency') || 'EUR';
  const date = searchParams.get('date') || searchParams.get('start') || '';

  const gygResult = await searchGetYourGuideActivities({
    city,
    lat,
    lng,
    filter,
    currency,
    date,
  });

  if (gygResult.activities.length > 0) {
    return NextResponse.json({
      ok: true,
      source: 'GetYourGuide',
      count: gygResult.activities.length,
      warning: gygResult.warning || '',
      activities: gygResult.activities,
      places: gygResult.activities,
    });
  }

  const googleActivities = await searchGoogleActivities({
    lat,
    lng,
    city,
    filter,
  });

  if (googleActivities.length > 0) {
    return NextResponse.json({
      ok: true,
      source: 'Google Places fallback',
      count: googleActivities.length,
      warning: gygResult.warning || '',
      activities: googleActivities,
      places: googleActivities,
    });
  }

  const fallback = fallbackActivities(city);

  return NextResponse.json({
    ok: true,
    source: 'Fallback Gototrip',
    count: fallback.length,
    warning:
      gygResult.warning ||
      'Aucune activité GetYourGuide ou Google Places trouvée. Fallback utilisé.',
    activities: fallback,
    places: fallback,
  });
}