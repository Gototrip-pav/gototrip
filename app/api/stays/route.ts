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

type StayResult = {
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
  pricePerNightPerPerson: number;
  priceTotal?: number;
  currency?: string;
  imageUrl?: string;
  bookingId?: number | string;
  available?: boolean;
};

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseNumber(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getGoogleApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ''
  );
}

function getBookingConfig() {
  const token = process.env.BOOKING_API_TOKEN || '';
  const affiliateId = process.env.BOOKING_AFFILIATE_ID || '';
  const env = process.env.BOOKING_ENV || 'sandbox';

  const baseUrl =
    process.env.BOOKING_API_BASE_URL ||
    (env === 'production'
      ? 'https://demandapi.booking.com/3.1'
      : 'https://demandapi-sandbox.booking.com/3.1');

  return {
    token,
    affiliateId,
    baseUrl,
    enabled: Boolean(token && affiliateId),
  };
}

function getBookingCityId(city: string, searchParams: URLSearchParams) {
  const fromQuery = searchParams.get('bookingCityId');

  if (fromQuery && Number.isFinite(Number(fromQuery))) {
    return Number(fromQuery);
  }

  const citySlug = slugify(city);

  const directEnv =
    process.env[`BOOKING_CITY_ID_${citySlug.toUpperCase()}`] ||
    process.env[`BOOKING_CITY_ID_${citySlug}`];

  if (directEnv && Number.isFinite(Number(directEnv))) {
    return Number(directEnv);
  }

  try {
    const rawMap = process.env.BOOKING_CITY_IDS || '{}';
    const map = JSON.parse(rawMap);
    const mapped = map[city] || map[citySlug] || map[normalizeText(city)];

    if (mapped && Number.isFinite(Number(mapped))) {
      return Number(mapped);
    }
  } catch {
    return null;
  }

  return null;
}

function estimateGoogleStayPrice(place: GooglePlace, lodging: string) {
  const text = normalizeText(
    `${place.displayName?.text || ''} ${place.primaryType || ''} ${
      place.types?.join(' ') || ''
    } ${lodging}`
  );

  const priceLevel = place.priceLevel || '';

  if (text.includes('hostel') || text.includes('auberge')) return 35;
  if (text.includes('campground') || text.includes('camping')) return 25;
  if (text.includes('lux') || text.includes('spa') || text.includes('resort')) {
    return 160;
  }

  if (priceLevel.includes('VERY_EXPENSIVE')) return 180;
  if (priceLevel.includes('EXPENSIVE')) return 120;
  if (priceLevel.includes('MODERATE')) return 80;
  if (priceLevel.includes('INEXPENSIVE')) return 55;

  return 80;
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

function mapGooglePlaceToStay(place: GooglePlace, lodging: string): StayResult | null {
  const name = place.displayName?.text || '';
  const lat = Number(place.location?.latitude);
  const lng = Number(place.location?.longitude);

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

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
    description:
      place.editorialSummary?.text ||
      'Hébergement proposé via Google Places. Les disponibilités et tarifs exacts seront à confirmer sur le site partenaire.',
    source: 'Google Places',
    isReal: true,
    pricePerNightPerPerson: estimateGoogleStayPrice(place, lodging),
    currency: 'EUR',
    available: true,
  };
}

function getGoogleIncludedType(lodging: string) {
  const normalized = normalizeText(lodging);

  if (normalized.includes('camping')) return 'campground';
  if (normalized.includes('auberge')) return 'hostel';

  return 'hotel';
}

function getGoogleTextQuery(city: string, lodging: string) {
  const normalized = normalizeText(lodging);

  if (normalized.includes('camping')) return `camping ${city}`;
  if (normalized.includes('auberge')) return `auberge de jeunesse ${city}`;
  if (normalized.includes('gite') || normalized.includes('gîte')) {
    return `gîte ${city}`;
  }
  if (normalized.includes('lux')) return `hotel luxe ${city}`;
  if (normalized.includes('appartement')) return `appartement vacances ${city}`;

  return `hotel ${city}`;
}

async function searchGoogleStays({
  lat,
  lng,
  city,
  lodging,
}: {
  lat: number;
  lng: number;
  city: string;
  lodging: string;
}) {
  const apiKey = getGoogleApiKey();

  if (!apiKey) {
    return [];
  }

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
          includedTypes: [getGoogleIncludedType(lodging)],
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
        textQuery: getGoogleTextQuery(city, lodging),
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

  return dedupeStays(
    rawPlaces
      .map((place) => mapGooglePlaceToStay(place, lodging))
      .filter(Boolean) as StayResult[]
  );
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

    if (Array.isArray(current)) {
      return current;
    }
  }

  return [];
}

function mapBookingStay(raw: any, persons: number, nights: number): StayResult | null {
  const bookingId =
    raw.id ||
    raw.accommodation ||
    raw.accommodation_id ||
    raw.property_id ||
    raw.hotel_id;

  const name =
    getNestedString(raw, [
      'name',
      'accommodation.name',
      'hotel_name',
      'property.name',
      'details.name',
    ]) || `Hébergement ${bookingId || ''}`.trim();

  const lat =
    getNestedNumber(raw, [
      'location.latitude',
      'location.lat',
      'latitude',
      'accommodation.location.latitude',
      'details.location.latitude',
    ]) || 0;

  const lng =
    getNestedNumber(raw, [
      'location.longitude',
      'location.lng',
      'longitude',
      'accommodation.location.longitude',
      'details.location.longitude',
    ]) || 0;

  const address =
    getNestedString(raw, [
      'address',
      'location.address',
      'accommodation.address',
      'details.address',
    ]) || '';

  const totalPrice =
    getNestedNumber(raw, [
      'price.total',
      'price.book',
      'price.gross',
      'price.accommodation',
      'product.price.total',
      'products.0.price.total',
      'products.0.price.gross',
    ]) || 0;

  const currency =
    getNestedString(raw, [
      'currency',
      'price.currency',
      'product.price.currency',
      'products.0.price.currency',
    ]) || 'EUR';

  const reviewScore =
    getNestedNumber(raw, [
      'review_score',
      'reviewScore',
      'rating',
      'reviews.score',
      'review.score',
    ]);

  const reviewCount =
    getNestedNumber(raw, [
      'review_count',
      'reviewCount',
      'reviews.count',
      'review.count',
    ]) || 0;

  const url =
    getNestedString(raw, [
      'url',
      'deep_link_url',
      'booking_url',
      'link',
      'products.0.url',
    ]) || '#';

  const imageUrl =
    getNestedString(raw, [
      'main_photo_url',
      'image.url',
      'images.0.url',
      'photos.0.url',
    ]) || '';

  const pricePerNightPerPerson =
    totalPrice > 0
      ? Math.max(1, Math.round(totalPrice / Math.max(1, persons) / Math.max(1, nights)))
      : 80;

  return {
    id: `booking-${bookingId || slugify(name)}`,
    name,
    address,
    lat,
    lng,
    rating: reviewScore,
    userRatingCount: reviewCount,
    types: ['lodging', 'hotel'],
    primaryType: 'hotel',
    googleMapsUri:
      lat && lng
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${name} ${address}`
          )}`
        : '',
    link: url,
    description:
      'Hébergement disponible via Booking.com. Prix et disponibilité à confirmer sur le site partenaire au moment de la réservation.',
    source: 'Booking.com Demand API',
    isReal: true,
    pricePerNightPerPerson,
    priceTotal: totalPrice || undefined,
    currency,
    imageUrl,
    bookingId,
    available: true,
  };
}

async function searchBookingStays({
  city,
  searchParams,
  checkin,
  checkout,
  persons,
  rooms,
  currency,
}: {
  city: string;
  searchParams: URLSearchParams;
  checkin: string;
  checkout: string;
  persons: number;
  rooms: number;
  currency: string;
}) {
  const config = getBookingConfig();

  if (!config.enabled) {
    return {
      stays: [] as StayResult[],
      warning:
        'Booking API non configurée. Ajoute BOOKING_API_TOKEN et BOOKING_AFFILIATE_ID dans .env.local.',
    };
  }

  const cityId = getBookingCityId(city, searchParams);

  if (!cityId) {
    return {
      stays: [] as StayResult[],
      warning:
        'Booking API configurée, mais aucun Booking city ID trouvé pour cette destination. Ajoute bookingCityId dans l’URL ou BOOKING_CITY_IDS dans .env.local.',
    };
  }

  const body = {
    city: cityId,
    checkin,
    checkout,
    currency,
    rows: 12,
    booker: {
      country: 'fr',
      platform: 'desktop',
      travel_purpose: 'leisure',
    },
    guests: {
      number_of_adults: persons,
      number_of_rooms: rooms,
    },
  };

  const res = await fetch(`${config.baseUrl}/accommodations/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
      'X-Affiliate-Id': config.affiliateId,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const json = await res.json();

  if (!res.ok) {
    return {
      stays: [] as StayResult[],
      warning:
        json?.errors?.[0]?.message ||
        json?.error?.message ||
        json?.message ||
        'Erreur Booking Demand API.',
    };
  }

  const data = Array.isArray(json.data) ? json.data : [];
  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${checkout}T12:00:00`).getTime() -
        new Date(`${checkin}T12:00:00`).getTime()) /
        86400000
    )
  );

  return {
    stays: dedupeStays(
      data
        .map((item: any) => mapBookingStay(item, persons, nights))
        .filter(Boolean) as StayResult[]
    ),
    warning: '',
  };
}

function dedupeStays(stays: StayResult[]) {
  const seen = new Set<string>();

  return stays.filter((stay) => {
    const key = `${normalizeText(stay.name)}-${Math.round(stay.lat * 1000)}-${Math.round(
      stay.lng * 1000
    )}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function fallbackStays(city: string): StayResult[] {
  return [
    {
      id: 'fallback-hotel-central',
      name: `Hébergement central à ${city}`,
      address: city,
      lat: 0,
      lng: 0,
      rating: null,
      userRatingCount: 0,
      types: ['lodging'],
      primaryType: 'hotel',
      googleMapsUri: '',
      link: '#',
      description:
        'Hébergement temporaire utilisé en fallback. À remplacer par Booking ou Google Places.',
      source: 'Fallback Gototrip',
      isReal: false,
      pricePerNightPerPerson: 80,
      currency: 'EUR',
      available: false,
    },
  ];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const city = searchParams.get('city') || 'destination';
  const lodging = searchParams.get('lodging') || '';
  const lat = parseNumber(searchParams.get('lat'), NaN);
  const lng = parseNumber(searchParams.get('lng'), NaN);
  const persons = Math.max(1, parseNumber(searchParams.get('persons'), 1));
  const rooms = Math.max(1, parseNumber(searchParams.get('rooms'), 1));
  const currency = searchParams.get('currency') || 'EUR';

  const today = new Date();
  const defaultCheckin = toDateInput(addDays(today, 30));
  const defaultCheckout = toDateInput(addDays(today, 32));

  const checkin = searchParams.get('checkin') || searchParams.get('start') || defaultCheckin;
  const checkout =
    searchParams.get('checkout') ||
    searchParams.get('end') ||
    toDateInput(addDays(new Date(`${checkin}T12:00:00`), 2));

  const bookingResult = await searchBookingStays({
    city,
    searchParams,
    checkin,
    checkout,
    persons,
    rooms,
    currency,
  });

  if (bookingResult.stays.length > 0) {
    return NextResponse.json({
      ok: true,
      source: 'Booking.com Demand API',
      count: bookingResult.stays.length,
      warning: bookingResult.warning || '',
      stays: bookingResult.stays,
      places: bookingResult.stays,
    });
  }

  const googleStays = await searchGoogleStays({
    lat,
    lng,
    city,
    lodging,
  });

  if (googleStays.length > 0) {
    return NextResponse.json({
      ok: true,
      source: 'Google Places fallback',
      count: googleStays.length,
      warning: bookingResult.warning || '',
      stays: googleStays,
      places: googleStays,
    });
  }

  const fallback = fallbackStays(city);

  return NextResponse.json({
    ok: true,
    source: 'Fallback Gototrip',
    count: fallback.length,
    warning:
      bookingResult.warning ||
      'Aucun hébergement Booking ou Google Places trouvé. Fallback utilisé.',
    stays: fallback,
    places: fallback,
  });
}