import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AffiliateProvider = 'booking' | 'getyourguide';

type AffiliateLinkPayload = {
  provider?: string;
  city?: string;
  country?: string;
  activity?: string;
  checkin?: string;
  checkout?: string;
  persons?: number;
  pets?: boolean;
  hasDog?: boolean;
};

function cleanValue(value: string | null | undefined) {
  return String(value || '').trim();
}

function isTruthy(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();

  return ['1', 'true', 'yes', 'oui', 'on'].includes(normalized);
}

function getBookingBaseAffiliateUrl() {
  return process.env.BOOKING_CJ_AFFILIATE_URL || '';
}

function getGetYourGuideAffiliateUrl() {
  return process.env.GETYOURGUIDE_AFFILIATE_URL || '';
}

function getGetYourGuidePartnerId() {
  return process.env.GETYOURGUIDE_PARTNER_ID || '';
}

function buildBookingSearchUrl({
  city,
  country,
  checkin,
  checkout,
  persons,
  pets,
  hasDog,
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

  if (pets || hasDog) {
    bookingUrl.searchParams.set('pets', '1');
  }

  bookingUrl.searchParams.set('selected_currency', 'EUR');
  bookingUrl.searchParams.set('lang', 'fr');

  return bookingUrl.toString();
}

function attachDestinationToCjLink(cjAffiliateUrl: string, destinationUrl: string) {
  if (!cjAffiliateUrl) return destinationUrl;

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

  return {
    provider: 'booking' as const,
    affiliateConfigured: Boolean(cjAffiliateUrl),
    destinationUrl: bookingDestinationUrl,
    url: attachDestinationToCjLink(cjAffiliateUrl, bookingDestinationUrl),
    note: cjAffiliateUrl
      ? 'Lien Booking CJ utilisé avec destination dynamique.'
      : 'Aucun lien CJ Booking configuré. Gototrip ouvre la recherche Booking standard.',
  };
}

function buildGetYourGuideSearchUrl({
  activity,
  city,
  country,
}: AffiliateLinkPayload) {
  const searchQuery = [cleanValue(activity), cleanValue(city), cleanValue(country)]
    .filter(Boolean)
    .join(' ');

  const getYourGuideUrl = new URL('https://www.getyourguide.fr/s/');

  if (searchQuery) {
    getYourGuideUrl.searchParams.set('q', searchQuery);
  }

  return getYourGuideUrl.toString();
}

function buildGetYourGuidePartnerUrl(payload: AffiliateLinkPayload) {
  const partnerId = cleanValue(getGetYourGuidePartnerId());
  const destinationUrl = buildGetYourGuideSearchUrl(payload);

  const url = new URL(destinationUrl);

  if (partnerId) {
    url.searchParams.set('partner_id', partnerId);
  }

  return {
    provider: 'getyourguide' as const,
    affiliateConfigured: Boolean(partnerId),
    destinationUrl,
    url: url.toString(),
    note: partnerId
      ? 'Lien GetYourGuide dynamique utilisé avec activity + city + country + partner_id.'
      : 'GETYOURGUIDE_PARTNER_ID non configuré. Gototrip ouvre la recherche GetYourGuide sans tracking partenaire.',
  };
}

function isShortFixedGetYourGuideLink(url: string) {
  const cleanUrl = cleanValue(url).toLowerCase();

  return cleanUrl.includes('gyg.me/');
}

function buildGetYourGuideAffiliateUrl(payload: AffiliateLinkPayload) {
  const partnerId = cleanValue(getGetYourGuidePartnerId());

  if (partnerId) {
    return buildGetYourGuidePartnerUrl(payload);
  }

  const destinationUrl = buildGetYourGuideSearchUrl(payload);
  const affiliateUrl = getGetYourGuideAffiliateUrl();

  if (affiliateUrl && !isShortFixedGetYourGuideLink(affiliateUrl)) {
    return {
      provider: 'getyourguide' as const,
      affiliateConfigured: true,
      destinationUrl,
      url: affiliateUrl,
      note:
        'Lien affilié GetYourGuide utilisé. Attention : il peut être fixe si la destination n’est pas dynamique.',
    };
  }

  return {
    provider: 'getyourguide' as const,
    affiliateConfigured: Boolean(affiliateUrl),
    destinationUrl,
    url: destinationUrl,
    note:
      affiliateUrl && isShortFixedGetYourGuideLink(affiliateUrl)
        ? 'Le lien court GetYourGuide est fixe. Gototrip ouvre donc la bonne recherche destination pour éviter de renvoyer vers une autre ville.'
        : 'Aucun partner_id GetYourGuide configuré. Gototrip ouvre la recherche destination.',
  };
}

function normalizeProvider(value: string): AffiliateProvider | null {
  const provider = cleanValue(value).toLowerCase();

  if (provider === 'booking') return 'booking';

  if (
    provider === 'getyourguide' ||
    provider === 'gyg' ||
    provider === 'get-your-guide'
  ) {
    return 'getyourguide';
  }

  return null;
}

function buildAffiliateResult(payload: AffiliateLinkPayload) {
  const provider = normalizeProvider(payload.provider || 'booking');

  if (!provider) return null;

  if (provider === 'booking') {
    return buildBookingAffiliateUrl(payload);
  }

  return buildGetYourGuideAffiliateUrl(payload);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const payload: AffiliateLinkPayload = {
    provider: cleanValue(searchParams.get('provider')) || 'booking',
    city: cleanValue(searchParams.get('city')),
    country: cleanValue(searchParams.get('country')),
    activity: cleanValue(searchParams.get('activity')),
    checkin: cleanValue(searchParams.get('checkin')),
    checkout: cleanValue(searchParams.get('checkout')),
    persons: Number(searchParams.get('persons') || 1),
    pets:
      isTruthy(searchParams.get('pets')) ||
      isTruthy(searchParams.get('petFriendly')),
    hasDog:
      isTruthy(searchParams.get('hasDog')) ||
      isTruthy(searchParams.get('dogFriendly')),
  };

  const shouldRedirect = searchParams.get('redirect') === '1';
  const result = buildAffiliateResult(payload);

  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        error: `Provider non supporté : ${payload.provider}`,
      },
      { status: 400 }
    );
  }

  if (shouldRedirect) {
    return NextResponse.redirect(result.url, 302);
  }

  return NextResponse.json(
    {
      ok: true,
      ...result,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AffiliateLinkPayload;
  const result = buildAffiliateResult(body);

  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        error: `Provider non supporté : ${body.provider}`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      ...result,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}