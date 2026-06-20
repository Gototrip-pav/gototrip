import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ApiStatus = {
  id: string;
  name: string;
  status: 'active' | 'partial' | 'missing';
  configured: boolean;
  details: string;
  env: {
    name: string;
    configured: boolean;
    public?: boolean;
  }[];
};

function hasEnv(name: string) {
  return Boolean(String(process.env[name] || '').trim());
}

function envStatus(name: string, publicValue = false) {
  return {
    name,
    configured: hasEnv(name),
    public: publicValue,
  };
}

function getProvidedToken(request: Request) {
  const url = new URL(request.url);
  const tokenFromUrl = String(url.searchParams.get('token') || '').trim();

  if (tokenFromUrl) {
    return tokenFromUrl;
  }

  const authorization = request.headers.get('authorization') || '';

  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return '';
}

function isAuthorized(request: Request) {
  const expectedToken = String(process.env.GOTOTRIP_ADMIN_TOKEN || '').trim();
  const providedToken = getProvidedToken(request);

  return Boolean(expectedToken && providedToken && expectedToken === providedToken);
}

function getApiStatuses(): ApiStatus[] {
  const googleMapsConfigured = hasEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  const googlePlacesConfigured = hasEnv('GOOGLE_PLACES_API_KEY');
  const duffelConfigured = hasEnv('DUFFEL_ACCESS_TOKEN');

  const bookingCjConfigured = hasEnv('BOOKING_CJ_AFFILIATE_URL');
  const bookingDemandConfigured =
    hasEnv('BOOKING_API_TOKEN') && hasEnv('BOOKING_AFFILIATE_ID');

  const getYourGuideAffiliateConfigured = hasEnv('GETYOURGUIDE_AFFILIATE_URL');
  const getYourGuideApiConfigured = hasEnv('GETYOURGUIDE_API_TOKEN');

  return [
    {
      id: 'google-maps',
      name: 'Google Maps',
      status: googleMapsConfigured ? 'active' : 'missing',
      configured: googleMapsConfigured,
      details: googleMapsConfigured
        ? 'Google Maps est configuré pour afficher les cartes côté navigateur.'
        : 'Clé Google Maps manquante. Variable attendue : NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.',
      env: [envStatus('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', true)],
    },
    {
      id: 'google-places',
      name: 'Google Places',
      status: googlePlacesConfigured ? 'active' : 'missing',
      configured: googlePlacesConfigured,
      details: googlePlacesConfigured
        ? 'Google Places est configuré pour rechercher villes, activités, restaurants et hébergements.'
        : 'Clé Google Places manquante. Variable attendue : GOOGLE_PLACES_API_KEY.',
      env: [envStatus('GOOGLE_PLACES_API_KEY')],
    },
    {
      id: 'duffel',
      name: 'Duffel',
      status: duffelConfigured ? 'active' : 'missing',
      configured: duffelConfigured,
      details: duffelConfigured
        ? 'Duffel est configuré pour les recherches de vols.'
        : 'Token Duffel manquant. Variable attendue : DUFFEL_ACCESS_TOKEN.',
      env: [envStatus('DUFFEL_ACCESS_TOKEN')],
    },
    {
      id: 'booking-cj',
      name: 'Booking CJ Affiliation',
      status: bookingCjConfigured ? 'active' : 'missing',
      configured: bookingCjConfigured,
      details: bookingCjConfigured
        ? 'Le lien affilié CJ Booking est configuré. Les boutons “Voir sur Booking” peuvent tracker via CJ.'
        : 'Lien affilié CJ Booking manquant. Variable attendue : BOOKING_CJ_AFFILIATE_URL.',
      env: [envStatus('BOOKING_CJ_AFFILIATE_URL')],
    },
    {
      id: 'booking-demand',
      name: 'Booking Demand API',
      status: bookingDemandConfigured
        ? 'active'
        : bookingCjConfigured
          ? 'partial'
          : 'missing',
      configured: bookingDemandConfigured,
      details: bookingDemandConfigured
        ? 'Booking Demand API est configurée avec token et affiliate ID.'
        : bookingCjConfigured
          ? 'Booking Demand API n’est pas configurée. Ce n’est pas bloquant : Gototrip utilise Google Places + le lien affilié CJ Booking.'
          : 'Booking Demand API non configurée. Variables attendues : BOOKING_API_TOKEN et BOOKING_AFFILIATE_ID.',
      env: [
        envStatus('BOOKING_ENV'),
        envStatus('BOOKING_API_TOKEN'),
        envStatus('BOOKING_AFFILIATE_ID'),
        envStatus('BOOKING_CITY_IDS'),
      ],
    },
    {
      id: 'getyourguide-affiliate',
      name: 'GetYourGuide Affiliation',
      status: getYourGuideAffiliateConfigured ? 'active' : 'missing',
      configured: getYourGuideAffiliateConfigured,
      details: getYourGuideAffiliateConfigured
        ? 'Le lien affilié GetYourGuide est configuré. Les boutons “Réserver sur GetYourGuide” peuvent tracker les clics.'
        : 'Lien affilié GetYourGuide manquant. Variable attendue : GETYOURGUIDE_AFFILIATE_URL.',
      env: [envStatus('GETYOURGUIDE_AFFILIATE_URL')],
    },
    {
      id: 'getyourguide-api',
      name: 'GetYourGuide API',
      status: getYourGuideApiConfigured
        ? 'active'
        : getYourGuideAffiliateConfigured
          ? 'partial'
          : 'missing',
      configured: getYourGuideApiConfigured,
      details: getYourGuideApiConfigured
        ? 'GetYourGuide API est configurée pour enrichir les activités avec de vraies offres partenaires.'
        : getYourGuideAffiliateConfigured
          ? 'GetYourGuide API n’est pas configurée. Ce n’est pas bloquant : Gototrip utilise Google Places + le lien affilié GetYourGuide.'
          : 'GetYourGuide API non configurée. Variable attendue : GETYOURGUIDE_API_TOKEN.',
      env: [
        envStatus('GETYOURGUIDE_API_TOKEN'),
        envStatus('GETYOURGUIDE_API_BASE_URL'),
      ],
    },
  ];
}

export async function GET(request: Request) {
  if (!hasEnv('GOTOTRIP_ADMIN_TOKEN')) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'GOTOTRIP_ADMIN_TOKEN n’est pas configuré dans .env.local ou Vercel.',
      },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Code admin incorrect ou manquant.',
      },
      { status: 401 }
    );
  }

  const apis = getApiStatuses();

  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        active: apis.filter((api) => api.status === 'active').length,
        partial: apis.filter((api) => api.status === 'partial').length,
        missing: apis.filter((api) => api.status === 'missing').length,
        total: apis.length,
      },
      apis,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}