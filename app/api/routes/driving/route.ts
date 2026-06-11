import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;

  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

function parseGoogleDuration(value: unknown) {
  const text = String(value || '');
  const match = text.match(/^(\d+)s$/);

  if (!match) return null;

  return Number(match[1]);
}

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      process.env.GOOGLE_ROUTES_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Clé API manquante. Ajoute GOOGLE_ROUTES_API_KEY ou GOOGLE_PLACES_API_KEY dans .env.local',
        },
        { status: 500 }
      );
    }

    const bodyFromClient = await req.json();

    const originLat = toNumber(bodyFromClient?.origin?.lat);
    const originLng = toNumber(bodyFromClient?.origin?.lng);
    const destinationLat = toNumber(bodyFromClient?.destination?.lat);
    const destinationLng = toNumber(bodyFromClient?.destination?.lng);

    if (
      originLat === null ||
      originLng === null ||
      destinationLat === null ||
      destinationLng === null
    ) {
      return NextResponse.json(
        {
          error: 'Coordonnées origin/destination invalides',
        },
        { status: 400 }
      );
    }

    const googleBody = {
      origin: {
        location: {
          latLng: {
            latitude: originLat,
            longitude: originLng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destinationLat,
            longitude: destinationLng,
          },
        },
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      languageCode: 'fr-FR',
      units: 'METRIC',
    };

    const response = await fetch(GOOGLE_ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'routes.distanceMeters,routes.duration,routes.staticDuration',
      },
      body: JSON.stringify(googleBody),
      cache: 'no-store',
    });

    const json = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Erreur Google Routes API',
          status: response.status,
          details: json,
        },
        { status: response.status }
      );
    }

    const route = json?.routes?.[0];

    if (!route) {
      return NextResponse.json(
        {
          error: 'Aucun itinéraire voiture trouvé',
          details: json,
        },
        { status: 404 }
      );
    }

    const distanceMeters = Number(route.distanceMeters || 0);
    const durationSeconds =
      parseGoogleDuration(route.duration) ||
      parseGoogleDuration(route.staticDuration) ||
      0;

    return NextResponse.json({
      ok: true,
      distanceMeters,
      distanceKm: Math.round(distanceMeters / 1000),
      durationSeconds,
      durationText: durationSeconds ? formatDuration(durationSeconds) : 'Non disponible',
      source: 'Google Routes API',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Erreur serveur routes/driving',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}