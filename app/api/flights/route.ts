import { NextRequest, NextResponse } from 'next/server';

const DUFFEL_API_URL = 'https://api.duffel.com/air/offer_requests';

const CITY_TO_AIRPORT: Record<string, string> = {
  paris: 'PAR',
  nice: 'NCE',
  lyon: 'LYS',
  marseille: 'MRS',
  lille: 'LIL',
  bordeaux: 'BOD',
  nantes: 'NTE',
  dijon: 'DIJ',

  'la canee': 'CHQ',
  'la canée': 'CHQ',
  canee: 'CHQ',
  canée: 'CHQ',
  chania: 'CHQ',

  majorque: 'PMI',
  palma: 'PMI',
  'palma de majorque': 'PMI',

  algarve: 'FAO',
  faro: 'FAO',
};

const AIRLINE_WEBSITES: Record<string, string> = {
  'Air France': 'https://wwws.airfrance.fr',
  easyJet: 'https://www.easyjet.com/fr',
  Ryanair: 'https://www.ryanair.com/fr/fr',
  Transavia: 'https://www.transavia.com',
  Volotea: 'https://www.volotea.com/fr',
  Lufthansa: 'https://www.lufthansa.com/fr/fr/homepage',
  'British Airways': 'https://www.britishairways.com',
  Iberia: 'https://www.iberia.com/fr',
  Vueling: 'https://www.vueling.com/fr',
  Aegean: 'https://en.aegeanair.com',
  'Sky Express': 'https://www.skyexpress.gr/en',
  'Duffel Airways': 'https://duffel.com',
};

function normalizeCity(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function getAirportCode(city: string) {
  const raw = String(city || '').trim().toLowerCase();
  const normalized = normalizeCity(city);

  return CITY_TO_AIRPORT[raw] || CITY_TO_AIRPORT[normalized] || null;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 30 + days);
    return fallback.toISOString().slice(0, 10);
  }

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getDefaultDepartureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value?: string) {
  if (!value) return '';

  try {
    const date = new Date(value);

    return date.toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function formatDuration(minutes?: number) {
  if (!minutes || !Number.isFinite(minutes)) return 'Durée inconnue';

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function formatMoney(value: number, currency = 'EUR') {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function getTotalDurationMinutes(offer: any) {
  const slices = offer?.slices || [];
  let total = 0;

  for (const slice of slices) {
    for (const segment of slice?.segments || []) {
      const departure = new Date(segment?.departing_at || '');
      const arrival = new Date(segment?.arriving_at || '');

      if (
        !Number.isNaN(departure.getTime()) &&
        !Number.isNaN(arrival.getTime())
      ) {
        total += Math.max(
          0,
          Math.round((arrival.getTime() - departure.getTime()) / 60000)
        );
      }
    }
  }

  return total;
}

function buildFlightSearchUrl({
  airline,
  origin,
  destination,
  departureDate,
  returnDate,
}: {
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
}) {
  const query = encodeURIComponent(
    `${airline} ${origin} ${destination} ${departureDate} ${returnDate} réserver vol`
  );

  return `https://www.google.com/search?q=${query}`;
}

function getAirlineWebsite(airline: string) {
  return AIRLINE_WEBSITES[airline] || '';
}

function mapOffer({
  offer,
  adults,
  departureDate,
  returnDate,
}: {
  offer: any;
  adults: number;
  departureDate: string;
  returnDate: string;
}) {
  const totalAmount = Number(offer?.total_amount || 0);
  const currency = offer?.total_currency || 'EUR';

  const pricePerPerson =
    adults > 0 ? Math.round(totalAmount / adults) : Math.round(totalAmount);

  const outboundSlice = offer?.slices?.[0];
  const returnSlice = offer?.slices?.[1];

  const firstOutboundSegment = outboundSlice?.segments?.[0];
  const lastOutboundSegment =
    outboundSlice?.segments?.[outboundSlice?.segments?.length - 1];

  const ownerName = offer?.owner?.name || 'Compagnie inconnue';

  const outboundStops = Math.max(0, (outboundSlice?.segments?.length || 1) - 1);
  const returnStops = Math.max(0, (returnSlice?.segments?.length || 1) - 1);

  const durationMinutes = getTotalDurationMinutes(offer);

  const departureAirport = firstOutboundSegment?.origin?.iata_code || '';
  const arrivalAirport = lastOutboundSegment?.destination?.iata_code || '';

  const airlineWebsite = getAirlineWebsite(ownerName);

  const bookingUrl =
    airlineWebsite ||
    buildFlightSearchUrl({
      airline: ownerName,
      origin: departureAirport,
      destination: arrivalAirport,
      departureDate,
      returnDate,
    });

  return {
    id: offer.id,
    source: 'Duffel',
    airline: ownerName,
    airlineWebsite,
    bookingUrl,
    bookingLabel: airlineWebsite
      ? `Réserver sur le site ${ownerName}`
      : 'Rechercher ce vol',

    priceTotal: totalAmount,
    priceTotalText: formatMoney(totalAmount, currency),
    pricePerPerson,
    pricePerPersonText: formatMoney(pricePerPerson, currency),
    currency,

    durationText: formatDuration(durationMinutes),
    outboundStops,
    returnStops,

    departureAirport,
    arrivalAirport,
    departureAt: firstOutboundSegment?.departing_at || '',
    arrivalAt: lastOutboundSegment?.arriving_at || '',
    departureAtText: formatDateTime(firstOutboundSegment?.departing_at),
    arrivalAtText: formatDateTime(lastOutboundSegment?.arriving_at),

    rawOfferId: offer.id,
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = process.env.DUFFEL_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          error: 'DUFFEL_ACCESS_TOKEN manquant dans .env.local',
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);

    const departureCity = searchParams.get('departureCity') || '';
    const destinationCity = searchParams.get('destinationCity') || '';
    const departureDate =
      searchParams.get('departureDate') || getDefaultDepartureDate();

    const duration = Math.max(1, Number(searchParams.get('duration') || 3));
    const adults = Math.max(1, Number(searchParams.get('adults') || 1));

    const origin = getAirportCode(departureCity);
    const destination = getAirportCode(destinationCity);

    if (!origin) {
      return NextResponse.json(
        {
          error: `Aéroport introuvable pour la ville de départ : ${departureCity}`,
        },
        { status: 400 }
      );
    }

    if (!destination) {
      return NextResponse.json(
        {
          error: `Aéroport introuvable pour la destination : ${destinationCity}`,
        },
        { status: 400 }
      );
    }

    const returnDate = addDays(departureDate, duration);

    const passengers = Array.from({ length: adults }, () => ({
      type: 'adult',
    }));

    const body = {
      data: {
        slices: [
          {
            origin,
            destination,
            departure_date: departureDate,
          },
          {
            origin: destination,
            destination: origin,
            departure_date: returnDate,
          },
        ],
        passengers,
        cabin_class: 'economy',
        max_connections: 1,
      },
    };

    const response = await fetch(DUFFEL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const json = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Erreur Duffel API',
          status: response.status,
          details: json,
        },
        { status: response.status }
      );
    }

    const offers = Array.isArray(json?.data?.offers) ? json.data.offers : [];

    const mappedOffers = offers
      .map((offer: any) =>
        mapOffer({
          offer,
          adults,
          departureDate,
          returnDate,
        })
      )
      .filter((offer: any) => Number.isFinite(offer.priceTotal))
      .sort((a: any, b: any) => a.priceTotal - b.priceTotal)
      .slice(0, 8);

    return NextResponse.json({
      ok: true,
      source: 'Duffel',
      origin,
      destination,
      departureCity,
      destinationCity,
      departureDate,
      returnDate,
      adults,
      count: mappedOffers.length,
      cheapestOffer: mappedOffers[0] || null,
      offers: mappedOffers,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Erreur serveur flights',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}