import { NextResponse } from 'next/server';

type AffiliateLinkPayload = {
  provider?: string;
  city?: string;
  country?: string;
  checkin?: string;
  checkout?: string;
  persons?: number;
};

function getBookingBaseAffiliateUrl() {
  return process.env.BOOKING_CJ_AFFILIATE_URL || '';
}

function cleanValue(value: string | null | undefined) {
  return String(value || '').trim();
}

function buildBookingSearchUrl({
  city,
  country,
  checkin,
  checkout,
  persons,
}: AffiliateLinkPayload) {
  const destination = [cleanValue(city), cleanValue(country)]
    .filter(Boolean)
    .join(', ');

  const bookingUrl = new URL('https://www.booking.com/searchresults.fr.html');

  if (destination) {
    bookingUrl.searchParams.set('ss', destination);
  }

  if (checkin) {
    bookingUrl.searchParams.set('checkin', checkin);
  }

  if (checkout) {
    bookingUrl.searchParams.set('checkout', checkout);
  }

  if (persons && Number(persons) > 0) {
    bookingUrl.searchParams.set('group_adults', String(Number(persons)));
    bookingUrl.searchParams.set('no_rooms', '1');
    bookingUrl.searchParams.set('group_children', '0');
  }

  bookingUrl.searchParams.set('selected_currency', 'EUR');
  bookingUrl.searchParams.set('lang', 'fr');

  return bookingUrl.toString();
}

function attachDestinationToCjLink(cjAffiliateUrl: string, destinationUrl: string) {
  if (!cjAffiliateUrl) {
    return destinationUrl;
  }

  try {
    const cjUrl = new URL(cjAffiliateUrl);

    cjUrl.searchParams.set('url', destinationUrl);

    return cjUrl.toString();
  } catch {
    const separator = cjAffiliateUrl.includes('?') ? '&' : '?';

    return `${cjAffiliateUrl}${separator}url=${encodeURIComponent(destinationUrl)}`;
  }
}

function buildBookingAffiliateUrl(payload: AffiliateLinkPayload) {
  const bookingDestinationUrl = buildBookingSearchUrl(payload);
  const cjAffiliateUrl = getBookingBaseAffiliateUrl();

  const finalUrl = attachDestinationToCjLink(
    cjAffiliateUrl,
    bookingDestinationUrl
  );

  return {
    affiliateConfigured: Boolean(cjAffiliateUrl),
    destinationUrl: bookingDestinationUrl,
    url: finalUrl,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const provider = cleanValue(searchParams.get('provider')) || 'booking';
  const city = cleanValue(searchParams.get('city'));
  const country = cleanValue(searchParams.get('country'));
  const checkin = cleanValue(searchParams.get('checkin'));
  const checkout = cleanValue(searchParams.get('checkout'));
  const persons = Number(searchParams.get('persons') || 1);
  const shouldRedirect = searchParams.get('redirect') === '1';

  if (provider !== 'booking') {
    return NextResponse.json(
      {
        ok: false,
        error: `Provider non supporté : ${provider}`,
      },
      { status: 400 }
    );
  }

  const result = buildBookingAffiliateUrl({
    provider,
    city,
    country,
    checkin,
    checkout,
    persons,
  });

  if (shouldRedirect) {
    return NextResponse.redirect(result.url, 302);
  }

  return NextResponse.json({
    ok: true,
    provider: 'booking',
    ...result,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AffiliateLinkPayload;

  const provider = cleanValue(body.provider) || 'booking';

  if (provider !== 'booking') {
    return NextResponse.json(
      {
        ok: false,
        error: `Provider non supporté : ${provider}`,
      },
      { status: 400 }
    );
  }

  const result = buildBookingAffiliateUrl(body);

  return NextResponse.json({
    ok: true,
    provider: 'booking',
    ...result,
  });
}