import { NextRequest, NextResponse } from 'next/server';

type Suggestion = {
  id: string;
  name: string;
  description: string;
  lat?: number;
  lng?: number;
};

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function fallbackCities(input: string): Suggestion[] {
  const cities = [
    { id: 'lille-france', name: 'Lille', description: 'Lille, France', lat: 50.6292, lng: 3.0573 },
    { id: 'paris-france', name: 'Paris', description: 'Paris, France', lat: 48.8566, lng: 2.3522 },
    { id: 'lyon-france', name: 'Lyon', description: 'Lyon, France', lat: 45.764, lng: 4.8357 },
    { id: 'marseille-france', name: 'Marseille', description: 'Marseille, France', lat: 43.2965, lng: 5.3698 },
    { id: 'nice-france', name: 'Nice', description: 'Nice, France', lat: 43.7102, lng: 7.262 },
    { id: 'bruxelles-belgique', name: 'Bruxelles', description: 'Bruxelles, Belgique', lat: 50.8476, lng: 4.3572 },
    { id: 'bruges-belgique', name: 'Bruges', description: 'Bruges, Belgique', lat: 51.2093, lng: 3.2247 },
    { id: 'gand-belgique', name: 'Gand', description: 'Gand, Belgique', lat: 51.0543, lng: 3.7174 },
    { id: 'amsterdam-pays-bas', name: 'Amsterdam', description: 'Amsterdam, Pays-Bas', lat: 52.3676, lng: 4.9041 },
    { id: 'barcelone-espagne', name: 'Barcelone', description: 'Barcelone, Espagne', lat: 41.3874, lng: 2.1686 },
    { id: 'lisbonne-portugal', name: 'Lisbonne', description: 'Lisbonne, Portugal', lat: 38.7223, lng: -9.1393 },
  ];

  const q = normalizeText(input);

  return cities
    .filter((city) => {
      return (
        normalizeText(city.name).includes(q) ||
        normalizeText(city.description).includes(q)
      );
    })
    .slice(0, 8);
}

export async function GET(req: NextRequest) {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { searchParams } = new URL(req.url);
  const input = searchParams.get('input') || '';

  if (input.trim().length < 2) {
    return NextResponse.json({
      ok: true,
      suggestions: [],
    });
  }

  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      source: 'Fallback Gototrip',
      suggestions: fallbackCities(input),
    });
  }

  try {
    const autocompleteRes = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          input,
          languageCode: 'fr',
          regionCode: 'FR',
          includedPrimaryTypes: ['locality', 'administrative_area_level_3'],
        }),
        cache: 'no-store',
      }
    );

    const autocompleteJson = await autocompleteRes.json();

    if (!autocompleteRes.ok) {
      return NextResponse.json({
        ok: true,
        source: 'Fallback Gototrip',
        suggestions: fallbackCities(input),
      });
    }

    const rawSuggestions = Array.isArray(autocompleteJson.suggestions)
      ? autocompleteJson.suggestions
      : [];

    const suggestions: Suggestion[] = rawSuggestions
      .map((item: any, index: number) => {
        const prediction = item.placePrediction;

        if (!prediction) return null;

        const placeId = prediction.placeId || '';
        const mainText = prediction.structuredFormat?.mainText?.text || '';
        const secondaryText =
          prediction.structuredFormat?.secondaryText?.text || '';
        const fullText = prediction.text?.text || '';

        const name = mainText || fullText;
        const description =
          fullText || [mainText, secondaryText].filter(Boolean).join(', ');

        if (!name || !placeId) return null;

        return {
          id: placeId || `${name}-${index}`,
          name,
          description,
        };
      })
      .filter(Boolean)
      .slice(0, 8);

    return NextResponse.json({
      ok: true,
      source: 'Google Places Autocomplete',
      suggestions,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      source: 'Fallback Gototrip',
      suggestions: fallbackCities(input),
    });
  }
}