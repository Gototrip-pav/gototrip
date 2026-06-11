import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_AUTOCOMPLETE_URL =
  'https://places.googleapis.com/v1/places:autocomplete';

function cleanText(value: unknown) {
  return String(value || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'GOOGLE_PLACES_API_KEY manquante dans .env.local',
        },
        { status: 500 }
      );
    }

    const bodyFromClient = await req.json();
    const input = cleanText(bodyFromClient.input);

    if (input.length < 2) {
      return NextResponse.json(
        {
          error: 'Ville trop courte',
        },
        { status: 400 }
      );
    }

    const autocompleteResponse = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text',
      },
      body: JSON.stringify({
        input,
        languageCode: 'fr',
        includedPrimaryTypes: ['(cities)'],
      }),
      cache: 'no-store',
    });

    const autocompleteJson = await autocompleteResponse.json();

    if (!autocompleteResponse.ok) {
      return NextResponse.json(
        {
          error: 'Erreur Google Autocomplete',
          status: autocompleteResponse.status,
          details: autocompleteJson,
        },
        { status: autocompleteResponse.status }
      );
    }

    const firstPrediction = autocompleteJson?.suggestions?.find(
      (s: any) => s?.placePrediction?.placeId
    )?.placePrediction;

    const placeId = firstPrediction?.placeId;

    if (!placeId) {
      return NextResponse.json(
        {
          error: 'Aucune ville trouvée',
        },
        { status: 404 }
      );
    }

    const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;

    const detailsResponse = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,location,primaryType',
      },
      cache: 'no-store',
    });

    const detailsJson = await detailsResponse.json();

    if (!detailsResponse.ok) {
      return NextResponse.json(
        {
          error: 'Erreur Google Place Details',
          status: detailsResponse.status,
          details: detailsJson,
        },
        { status: detailsResponse.status }
      );
    }

    return NextResponse.json({
      ok: true,
      place: {
        id: detailsJson.id,
        name: detailsJson.displayName?.text || input,
        address: detailsJson.formattedAddress || '',
        lat: detailsJson.location?.latitude,
        lng: detailsJson.location?.longitude,
        type: detailsJson.primaryType || '',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Erreur serveur place-details',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}