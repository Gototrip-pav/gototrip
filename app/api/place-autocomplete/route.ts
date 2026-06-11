import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_AUTOCOMPLETE_URL =
  'https://places.googleapis.com/v1/places:autocomplete';

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

    const input = String(bodyFromClient.input || '').trim();
    const sessionToken = String(bodyFromClient.sessionToken || '');

    if (input.length < 2) {
      return NextResponse.json({
        ok: true,
        suggestions: [],
      });
    }

    const googleBody = {
      input,
      sessionToken,
      languageCode: 'fr',
      includedPrimaryTypes: ['(cities)'],
    };

    const response = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
      },
      body: JSON.stringify(googleBody),
      cache: 'no-store',
    });

    const json = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Erreur Google Autocomplete',
          status: response.status,
          details: json,
        },
        { status: response.status }
      );
    }

    const suggestions = (json.suggestions || [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .map((p: any) => {
        return {
          placeId: p.placeId,
          text: p.text?.text || '',
          mainText: p.structuredFormat?.mainText?.text || p.text?.text || '',
          secondaryText: p.structuredFormat?.secondaryText?.text || '',
        };
      })
      .filter((s: any) => s.text);

    return NextResponse.json({
      ok: true,
      suggestions,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Erreur serveur autocomplete',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}