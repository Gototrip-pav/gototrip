'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  Home,
  MapPin,
  Plane,
  Train,
  Bus,
  Car,
  Hotel,
  Utensils,
  Ticket,
  Wallet,
  Route,
  Info,
  Star,
  TramFront,
} from 'lucide-react';
import TripMap from '../components/TripMap';
import PlanningEditor from '../components/PlanningEditor';
import { buildOptimizedPlanning } from '../utils/tripPlanner';

type TransportId = 'plane' | 'train' | 'bus' | 'car';

type Place = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  pricePerPerson?: number;
  pricePerNightPerPerson?: number;
  link?: string;
  googleMapsUri?: string;
  rating?: number | null;
  userRatingCount?: number;
  isReal?: boolean;
  type?: string;
  types?: string[];
  primaryType?: string;
  description?: string;
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

type FlightOffer = {
  id: string;
  source: string;
  airline: string;
  airlineWebsite?: string;
  bookingUrl?: string;
  bookingLabel?: string;
  priceTotal: number;
  priceTotalText?: string;
  pricePerPerson: number;
  pricePerPersonText?: string;
  currency: string;
  durationText: string;
  outboundStops: number;
  returnStops: number;
  departureAirport: string;
  arrivalAirport: string;
  departureAt: string;
  arrivalAt: string;
  departureAtText: string;
  arrivalAtText: string;
  rawOfferId?: string;
};

type StoredSelection = {
  destination: {
    city: string;
    country: string;
    lat: number;
    lng: number;
    weather?: string;
  };
  departureCity?: string;
  departureResolvedName?: string;
  departureCoords?: {
    lat: number;
    lng: number;
  } | null;
  start?: string | null;
  startDate?: string | null;
  budget?: number | null;
  persons: number;
  duration: number;
  nights: number;
  selections: {
    activities: Place[];
    restaurants: Place[];
    stays: Place[];
  };
  flightOffer?: FlightOffer | null;
  transport?: {
    id: TransportId;
    title: string;
    subtitle: string;
    duration: string;
    pricePerPerson: number;
    total: number;
    carbon: string;
    partnerLabel: string;
    partnerUrl: string;
    estimatedDistanceKm?: number;
    distanceSource?: string;
    dataSource?: string;
  };
  totals: {
    activities: number;
    restaurants: number;
    stays: number;
    transport?: number;
    overall: number;
  };
};

type LocalMobility = {
  mode: 'included-car' | 'public-transport' | 'rental-car';
  title: string;
  description: string;
  estimatedTotal: number;
  priceDetails: string;
  partnerLabel: string;
  partnerUrl: string;
};

function formatEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatSimpleEuro(value: number) {
  return `${Math.round(value)}€`;
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function isUsableUrl(value?: string | null) {
  const url = String(value || '').trim();

  return Boolean(url && url !== '#');
}

function getCheckoutDate(start: string | null | undefined, nights: number) {
  if (!start) return '';

  const date = new Date(`${start}T12:00:00`);

  if (Number.isNaN(date.getTime())) return '';

  date.setDate(date.getDate() + Math.max(1, nights));

  return date.toISOString().slice(0, 10);
}

function buildAffiliatePath(
  provider: 'booking' | 'getyourguide',
  selection: StoredSelection
) {
  const params = new URLSearchParams({
    provider,
    city: selection.destination.city || '',
    country: selection.destination.country || '',
    redirect: '1',
  });

  if (provider === 'booking') {
    const checkin = selection.startDate || selection.start || '';
    const checkout = getCheckoutDate(checkin, selection.nights || 1);

    params.set('persons', String(selection.persons || 1));

    if (checkin) {
      params.set('checkin', checkin);
    }

    if (checkout) {
      params.set('checkout', checkout);
    }
  }

  return `/api/affiliate-links?${params.toString()}`;
}

function getValidUrl(place?: Place | null) {
  if (!place) return '#';

  if (isUsableUrl(place.link)) {
    return place.link as string;
  }

  if (isUsableUrl(place.googleMapsUri)) {
    return place.googleMapsUri as string;
  }

  return '#';
}

function getActivityReservationUrl(place: Place, selection: StoredSelection) {
  const link = String(place.link || '');

  if (
    link.includes('getyourguide') ||
    link.includes('gyg.me') ||
    link.includes('provider=getyourguide')
  ) {
    return link;
  }

  return buildAffiliatePath('getyourguide', selection);
}

function getStayReservationUrl(place: Place, selection: StoredSelection) {
  const link = String(place.link || '');

  if (
    link.includes('booking.com') ||
    link.includes('anrdoezrs.net') ||
    link.includes('tkqlhce.com') ||
    link.includes('jdoqocy.com') ||
    link.includes('dpbolvw.net') ||
    link.includes('provider=booking')
  ) {
    return link;
  }

  return buildAffiliatePath('booking', selection);
}

function getRestaurantReservationUrl(place: Place) {
  if (isUsableUrl(place.googleMapsUri)) {
    return place.googleMapsUri as string;
  }

  return getValidUrl(place);
}

function getTransportIcon(id?: TransportId) {
  if (id === 'plane') return Plane;
  if (id === 'train') return Train;
  if (id === 'bus') return Bus;
  return Car;
}

function getTransportLabel(id?: TransportId) {
  if (id === 'plane') return 'Avion';
  if (id === 'train') return 'Train';
  if (id === 'bus') return 'Bus';
  if (id === 'car') return 'Voiture';
  return 'Transport';
}

function isCompactCity(city?: string) {
  const text = normalizeText(city || '');

  const compactCities = [
    'nice',
    'barcelone',
    'barcelona',
    'lisbonne',
    'lisbon',
    'porto',
    'bruges',
    'gand',
    'amsterdam',
    'paris',
    'lyon',
    'marseille',
    'cannes',
    'antibes',
    'ostende',
    'new york',
    'montreal',
    'montréal',
    'tokyo',
    'londres',
    'london',
    'singapour',
    'singapore',
    'dubai',
    'dubaï',
  ];

  return compactCities.some((item) => text.includes(item));
}

function shouldRecommendRentalCar(selection: StoredSelection) {
  const destination = normalizeText(selection.destination.city);
  const selectedTransport = selection.transport?.id;
  const activities = selection.selections?.activities || [];
  const restaurants = selection.selections?.restaurants || [];
  const stays = selection.selections?.stays || [];
  const totalPlaces = activities.length + restaurants.length + stays.length;

  if (selectedTransport === 'car') return false;

  const extendedDestinations = [
    'majorque',
    'mallorca',
    'crete',
    'canee',
    'chania',
    'corse',
    'sardaigne',
    'sicile',
    'algarve',
    'faro',
    'cote amalfitaine',
    'amalfi',
    'azores',
    'acores',
    'açores',
    'madeire',
    'madere',
    'madeira',
  ];

  if (extendedDestinations.some((item) => destination.includes(item))) {
    return true;
  }

  if (totalPlaces >= 8 && !isCompactCity(selection.destination.city)) {
    return true;
  }

  return false;
}

function estimateLocalMobility(selection: StoredSelection): LocalMobility {
  const persons = Math.max(1, Number(selection.persons || 1));
  const duration = Math.max(1, Number(selection.duration || 1));
  const city = selection.destination.city;
  const transportId = selection.transport?.id;

  if (transportId === 'car') {
    const dailyParkingFuel = 15;
    const total = dailyParkingFuel * duration;

    return {
      mode: 'included-car',
      title: 'Voiture déjà prévue',
      description:
        'Vous aurez déjà une voiture pour le trajet principal. Prévoyez surtout carburant local, stationnement et éventuels péages.',
      estimatedTotal: total,
      priceDetails: `${dailyParkingFuel}€ / jour × ${duration} jour(s)`,
      partnerLabel: 'Voir parkings et itinéraires',
      partnerUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `parking ${city}`
      )}`,
    };
  }

  if (shouldRecommendRentalCar(selection)) {
    const rentalPerDay = 45;
    const fuelPerDay = 12;
    const total = (rentalPerDay + fuelPerDay) * duration;

    return {
      mode: 'rental-car',
      title: 'Location de voiture recommandée',
      description:
        'Votre séjour semble comporter plusieurs déplacements sur place. Une voiture peut être plus pratique pour visiter les alentours et éviter les multiples taxis.',
      estimatedTotal: total,
      priceDetails: `${rentalPerDay}€ location + ${fuelPerDay}€ carburant / jour × ${duration} jour(s)`,
      partnerLabel: 'Comparer les locations de voiture',
      partnerUrl: `https://www.google.com/search?q=${encodeURIComponent(
        `location voiture ${city}`
      )}`,
    };
  }

  const ticketPerPersonPerDay = 8;
  const total = ticketPerPersonPerDay * persons * duration;

  return {
    mode: 'public-transport',
    title: 'Transports en commun conseillés',
    description:
      'Pour cette destination, les transports en commun peuvent suffire. Prévoyez des tickets ou pass journaliers pour rejoindre les activités, restaurants et l’hébergement.',
    estimatedTotal: total,
    priceDetails: `${ticketPerPersonPerDay}€ / personne / jour × ${persons} personne(s) × ${duration} jour(s)`,
    partnerLabel: 'Rechercher tickets transports',
    partnerUrl: `https://www.google.com/search?q=${encodeURIComponent(
      `tickets transport ${city}`
    )}`,
  };
}

export default function SummaryPage() {
  const router = useRouter();
  const [selection, setSelection] = useState<StoredSelection | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('gt_selection');

    if (!raw) {
      setSelection(null);
      return;
    }

    try {
      setSelection(JSON.parse(raw));
    } catch {
      setSelection(null);
    }
  }, []);

  const markers = useMemo(() => {
    if (!selection) return [];

    const points = [
      {
        name: selection.destination.city,
        lat: Number(selection.destination.lat),
        lng: Number(selection.destination.lng),
      },
      ...(selection.selections?.activities || []).map((activity) => ({
        name: activity.name,
        lat: Number(activity.lat),
        lng: Number(activity.lng),
      })),
      ...(selection.selections?.restaurants || []).map((restaurant) => ({
        name: restaurant.name,
        lat: Number(restaurant.lat),
        lng: Number(restaurant.lng),
      })),
      ...(selection.selections?.stays || []).map((stay) => ({
        name: stay.name,
        lat: Number(stay.lat),
        lng: Number(stay.lng),
      })),
    ];

    return points.filter((point) =>
      Number.isFinite(point.lat) && Number.isFinite(point.lng)
    );
  }, [selection]);

  const planning = useMemo(() => {
    if (!selection) return [];

    return buildOptimizedPlanning({
      destination: selection.destination,
      persons: selection.persons,
      duration: selection.duration,
      nights: selection.nights,
      transportId: selection.transport?.id,
      startDate: selection.startDate || selection.start || null,
      activities: selection.selections?.activities || [],
      restaurants: selection.selections?.restaurants || [],
      stays: selection.selections?.stays || [],
    });
  }, [selection]);

  const goHome = () => {
    router.push('/');
  };

  const goDestinations = () => {
    router.push('/destinations');
  };

  const goTransport = () => {
    router.push('/transport');
  };

  if (!selection) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="mb-2 text-2xl font-extrabold">
            Aucun récapitulatif disponible
          </h1>

          <p className="mb-5 text-slate-600">
            Commence par choisir une destination, puis construis ton voyage étape
            par étape.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={goHome}
              className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            >
              Retour à l’accueil
            </button>

            <button
              type="button"
              onClick={goDestinations}
              className="rounded-xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Voir les destinations
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activities = selection.selections?.activities || [];
  const restaurants = selection.selections?.restaurants || [];
  const stays = selection.selections?.stays || [];

  const budget =
    typeof selection.budget === 'number' && selection.budget > 0
      ? selection.budget
      : null;

  const localMobility = estimateLocalMobility(selection);

  const baseTotal = Number(selection.totals?.overall || 0);
  const totalWithLocalMobility = baseTotal + localMobility.estimatedTotal;

  const isOverBudget = budget !== null && totalWithLocalMobility > budget;
  const budgetOverrun = isOverBudget ? totalWithLocalMobility - budget : 0;

  const flightOffer = selection.flightOffer || null;

  const TransportIcon = getTransportIcon(selection.transport?.id);
  const transportTitle =
    selection.transport?.title || getTransportLabel(selection.transport?.id);
  const transportDuration = selection.transport?.duration || 'Non disponible';
  const transportDistance = selection.transport?.estimatedDistanceKm;
  const distanceSource = selection.transport?.distanceSource || 'Non disponible';
  const transportDataSource = selection.transport?.dataSource || distanceSource;

  const reservationTransportUrl =
    selection.transport?.id === 'plane' && flightOffer?.bookingUrl
      ? flightOffer.bookingUrl
      : selection.transport?.partnerUrl || '#';

  const reservationTransportLabel =
    selection.transport?.id === 'plane' && flightOffer?.bookingUrl
      ? 'Réserver ce vol'
      : selection.transport?.partnerLabel || 'Réserver';

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={goHome}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Home className="h-4 w-4" />
            Accueil
          </button>

          <button
            type="button"
            onClick={goDestinations}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <MapPin className="h-4 w-4" />
            Modifier la destination
          </button>

          <button
            type="button"
            onClick={goTransport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Route className="h-4 w-4" />
            Modifier le transport
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
        </div>

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-extrabold md:text-4xl">
            Récapitulatif — {selection.destination.city}
          </h1>

          <p className="text-slate-600">
            {selection.destination.country}
            {selection.destination.weather ? ` • ${selection.destination.weather}` : ''}
            {' '}• {selection.persons} personne(s) • {selection.duration} jour(s)
            {' '}({selection.nights} nuit(s))
            {budget ? <> • budget {formatEuro(budget)}</> : null}
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-bold">Trajet principal</h2>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <InfoCard
              icon={<MapPin className="h-4 w-4" />}
              label="Départ"
              value={selection.departureCity || 'Non renseigné'}
            />

            <InfoCard
              icon={<MapPin className="h-4 w-4" />}
              label="Destination"
              value={`${selection.destination.city}, ${selection.destination.country}`}
            />

            <InfoCard
              icon={<Route className="h-4 w-4" />}
              label="Distance utilisée"
              value={transportDistance ? `${transportDistance} km` : 'Non disponible'}
            />

            <InfoCard
              icon={<TransportIcon className="h-4 w-4" />}
              label="Transport choisi"
              value={`${transportTitle} • ${transportDuration}`}
            />

            <InfoCard
              icon={<Info className="h-4 w-4" />}
              label="Source"
              value={transportDataSource}
            />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-teal-100 bg-teal-50 p-5">
          <div className="mb-4 flex items-center gap-2">
            {localMobility.mode === 'public-transport' ? (
              <TramFront className="h-5 w-5 text-teal-700" />
            ) : (
              <Car className="h-5 w-5 text-teal-700" />
            )}

            <h2 className="text-xl font-bold text-teal-950">
              Déplacements sur place
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <div>
              <h3 className="font-bold text-teal-950">
                {localMobility.title}
              </h3>

              <p className="mt-2 text-sm text-teal-900">
                {localMobility.description}
              </p>

              <p className="mt-3 text-xs text-teal-800">
                Estimation : {localMobility.priceDetails}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4">
              <div className="text-sm text-slate-500">Budget local estimé</div>

              <div className="mt-1 text-3xl font-extrabold">
                {formatSimpleEuro(localMobility.estimatedTotal)}
              </div>

              <a
                href={localMobility.partnerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {localMobility.partnerLabel}
              </a>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-xl font-bold">Total estimé</h2>

            <div className="space-y-3 text-sm text-slate-600">
              {budget !== null && (
                <div className="flex justify-between gap-4">
                  <span>Budget prévu</span>
                  <span className="font-semibold text-slate-900">
                    {formatEuro(budget)}
                  </span>
                </div>
              )}

              <SummaryPriceLine
                icon={<Ticket className="h-4 w-4" />}
                label="Activités"
                value={selection.totals.activities || 0}
              />

              <SummaryPriceLine
                icon={<Utensils className="h-4 w-4" />}
                label="Restaurants"
                value={selection.totals.restaurants || 0}
              />

              <SummaryPriceLine
                icon={<Hotel className="h-4 w-4" />}
                label="Hébergement"
                value={selection.totals.stays || 0}
              />

              <SummaryPriceLine
                icon={<TransportIcon className="h-4 w-4" />}
                label="Transport principal"
                value={selection.totals.transport || 0}
              />

              <SummaryPriceLine
                icon={<TramFront className="h-4 w-4" />}
                label="Déplacements sur place"
                value={localMobility.estimatedTotal}
              />
            </div>

            <div className="my-4 border-t border-slate-200" />

            <div className="flex items-end justify-between gap-4">
              <span className="inline-flex items-center gap-2 font-bold">
                <Wallet className="h-4 w-4" />
                Total final
              </span>

              <span
                className={`text-3xl font-extrabold ${
                  isOverBudget ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {formatSimpleEuro(totalWithLocalMobility)}
              </span>
            </div>

            {isOverBudget && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <div className="mb-2 font-semibold">Budget dépassé</div>

                <div className="space-y-1">
                  <div>
                    Budget prévu :{' '}
                    <span className="font-semibold">{formatEuro(budget || 0)}</span>
                  </div>

                  <div>
                    Total final :{' '}
                    <span className="font-semibold">
                      {formatEuro(totalWithLocalMobility)}
                    </span>
                  </div>

                  <div>
                    Dépassement :{' '}
                    <span className="font-semibold">
                      {formatEuro(budgetOverrun)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="mb-4 text-xl font-bold">Carte du voyage</h2>
            <TripMap markers={markers} height={420} zoom={12} showPath={true} />
          </section>

          <SectionChoices
            title="Activités choisies"
            icon={<Ticket className="h-5 w-5" />}
            items={activities}
            emptyText="Aucune activité sélectionnée."
            buttonLabel="Réserver sur GetYourGuide"
            priceSuffix="/ personne"
            getUrl={(item) => getActivityReservationUrl(item, selection)}
          />

          <SectionChoices
            title="Restaurants choisis"
            icon={<Utensils className="h-5 w-5" />}
            items={restaurants}
            emptyText="Aucun restaurant sélectionné."
            buttonLabel="Voir le restaurant"
            priceSuffix="/ personne"
            getUrl={(item) => getRestaurantReservationUrl(item)}
          />

          <SectionChoices
            title="Hébergement choisi"
            icon={<Hotel className="h-5 w-5" />}
            items={stays}
            emptyText="Aucun hébergement sélectionné."
            buttonLabel="Voir sur Booking"
            priceSuffix="/ nuit / personne"
            useNightPrice
            getUrl={(item) => getStayReservationUrl(item, selection)}
          />

          <PlanningEditor autoPlanning={planning} />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
            <h2 className="mb-4 text-xl font-bold">Je réserve</h2>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {selection.transport && (
                <ReservationCard
                  title="Transport principal"
                  subtitle={`${selection.departureCity || 'Départ'} → ${
                    selection.destination.city
                  } • ${selection.transport.title} • ${selection.transport.duration}`}
                  url={reservationTransportUrl}
                  buttonLabel={reservationTransportLabel}
                  icon={<TransportIcon className="h-5 w-5" />}
                />
              )}

              <ReservationCard
                title="Déplacements sur place"
                subtitle={localMobility.title}
                url={localMobility.partnerUrl}
                buttonLabel={localMobility.partnerLabel}
                icon={
                  localMobility.mode === 'public-transport' ? (
                    <TramFront className="h-5 w-5" />
                  ) : (
                    <Car className="h-5 w-5" />
                  )
                }
              />

              {stays.map((stay) => (
                <ReservationCard
                  key={stay.id}
                  title="Hébergement"
                  subtitle={stay.name}
                  url={getStayReservationUrl(stay, selection)}
                  buttonLabel="Voir sur Booking"
                  icon={<Hotel className="h-5 w-5" />}
                />
              ))}

              {activities.map((activity) => (
                <ReservationCard
                  key={activity.id}
                  title="Activité"
                  subtitle={activity.name}
                  url={getActivityReservationUrl(activity, selection)}
                  buttonLabel="Réserver sur GetYourGuide"
                  icon={<Ticket className="h-5 w-5" />}
                />
              ))}

              {restaurants.map((restaurant) => (
                <ReservationCard
                  key={restaurant.id}
                  title="Restaurant"
                  subtitle={restaurant.name}
                  url={getRestaurantReservationUrl(restaurant)}
                  buttonLabel="Voir le restaurant"
                  icon={<Utensils className="h-5 w-5" />}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={goHome}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-white hover:bg-slate-800"
            >
              Nouveau voyage
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>

      <div className="font-bold">{value}</div>
    </div>
  );
}

function SummaryPriceLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>

      <span className="font-semibold text-slate-900">
        {formatSimpleEuro(value)}
      </span>
    </div>
  );
}

function SectionChoices({
  title,
  icon,
  items,
  emptyText,
  buttonLabel,
  priceSuffix,
  useNightPrice = false,
  getUrl,
}: {
  title: string;
  icon: React.ReactNode;
  items: Place[];
  emptyText: string;
  buttonLabel: string;
  priceSuffix: string;
  useNightPrice?: boolean;
  getUrl: (item: Place) => string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-xl font-bold">{title}</h2>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          {emptyText}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ChoiceCard
              key={item.id}
              icon={icon}
              title={item.name}
              subtitle={item.description || item.address || 'Sélection'}
              price={
                useNightPrice
                  ? item.pricePerNightPerPerson || item.pricePerPerson
                  : item.pricePerPerson
              }
              rating={item.rating}
              userRatingCount={item.userRatingCount}
              url={getUrl(item)}
              buttonLabel={buttonLabel}
              priceSuffix={priceSuffix}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ChoiceCard({
  icon,
  title,
  subtitle,
  price,
  rating,
  userRatingCount,
  url,
  buttonLabel,
  priceSuffix = '/ personne',
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  price?: number;
  rating?: number | null;
  userRatingCount?: number;
  url: string;
  buttonLabel: string;
  priceSuffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-sm">Sélection</span>
      </div>

      <div className="mb-2 font-bold">{title}</div>

      {rating && (
        <div className="mb-2 flex items-center gap-1 text-sm text-amber-700">
          <Star className="h-4 w-4 fill-current" />
          <span>
            {rating} / 5 ({userRatingCount || 0} avis)
          </span>
        </div>
      )}

      <p className="mb-3 line-clamp-3 text-sm text-slate-600">{subtitle}</p>

      {typeof price === 'number' && (
        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm">
          <span className="font-semibold">{formatSimpleEuro(price)}</span>{' '}
          <span className="text-slate-500">{priceSuffix}</span>
        </div>
      )}

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        {buttonLabel}
      </a>
    </div>
  );
}

function ReservationCard({
  title,
  subtitle,
  url,
  buttonLabel,
  icon,
}: {
  title: string;
  subtitle: string;
  url: string;
  buttonLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-sm">{title}</span>
      </div>

      <div className="mb-4 font-semibold">{subtitle}</div>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        {buttonLabel}
      </a>
    </div>
  );
}