'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  Home,
  Loader2,
  MapPin,
  Star,
  Hotel,
  Tent,
  Building2,
  Castle,
  Wallet,
  Info,
  BedDouble,
} from 'lucide-react';
import TripMap from '../../components/TripMap';

type Destination = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  weather?: string;
};

type Stay = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  rating?: number | null;
  userRatingCount?: number;
  pricePerNightPerPerson: number;
  priceTotal?: number;
  currency?: string;
  link?: string;
  googleMapsUri?: string;
  type?: string;
  primaryType?: string;
  types?: string[];
  isReal?: boolean;
  description?: string;
  source?: string;
  imageUrl?: string;
  bookingId?: number | string;
  available?: boolean;
};

type TripSelection = {
  destination: Destination;
  departureCity?: string;
  persons: number;
  duration: number;
  nights: number;
  start?: string | null;
  startDate?: string | null;
  budget?: number | null;
  lodging?: string;
  selections?: {
    activities?: any[];
    restaurants?: any[];
    stays?: Stay[];
  };
  totals?: {
    activities?: number;
    restaurants?: number;
    stays?: number;
    transport?: number;
    overall?: number;
  };
};

type StayFilter = {
  id: string;
  label: string;
  icon: React.ReactNode;
  keywords: string[];
};

const STAY_FILTERS: StayFilter[] = [
  {
    id: 'hotel',
    label: 'Hôtel',
    icon: <Hotel className="h-4 w-4" />,
    keywords: ['hotel', 'lodging'],
  },
  {
    id: 'hostel',
    label: 'Auberge',
    icon: <BedDouble className="h-4 w-4" />,
    keywords: ['hostel', 'auberge'],
  },
  {
    id: 'camping',
    label: 'Camping',
    icon: <Tent className="h-4 w-4" />,
    keywords: ['camping', 'campground'],
  },
  {
    id: 'apartment',
    label: 'Appartement',
    icon: <Building2 className="h-4 w-4" />,
    keywords: ['apartment', 'appartement', 'residence'],
  },
  {
    id: 'luxury',
    label: 'Luxueux',
    icon: <Castle className="h-4 w-4" />,
    keywords: ['luxury', 'luxe', 'resort', 'spa', 'palace'],
  },
  {
    id: 'budget',
    label: 'Économique',
    icon: <Wallet className="h-4 w-4" />,
    keywords: ['hostel', 'auberge', 'camping', 'budget', 'cheap', 'economy'],
  },
];

function formatSimpleEuro(value: number) {
  return `${Math.round(value)}€`;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function getStayHaystack(stay: Stay) {
  return normalizeText(
    [
      stay.name,
      stay.address,
      stay.type,
      stay.primaryType,
      stay.source,
      ...(stay.types || []),
    ].join(' ')
  );
}

function stayMatchesFilters(stay: Stay, filters: string[]) {
  if (filters.length === 0) return true;

  const selectedFilters = STAY_FILTERS.filter((filter) => filters.includes(filter.id));
  const haystack = getStayHaystack(stay);

  return selectedFilters.some((filter) =>
    filter.keywords.some((keyword) => haystack.includes(normalizeText(keyword)))
  );
}

function getReadableTypes(stay: Stay) {
  const types = stay.types || [];

  return types
    .slice(0, 4)
    .map((type) =>
      type
        .replaceAll('_', ' ')
        .replace('lodging', 'hébergement')
        .replace('hotel', 'hôtel')
        .replace('hostel', 'auberge')
        .replace('campground', 'camping')
        .replace('point of interest', 'lieu d’intérêt')
        .replace('establishment', 'établissement')
    );
}

function generateStayDescription(stay: Stay, activeFilters: string[]) {
  if (stay.description) {
    return stay.description;
  }

  const haystack = getStayHaystack(stay);

  const ratingText = stay.rating
    ? ` Il est noté ${stay.rating}/5 par les voyageurs.`
    : '';

  if (haystack.includes('hostel') || haystack.includes('auberge')) {
    return `Une option économique et pratique, adaptée aux voyageurs qui veulent limiter le budget hébergement.${ratingText}`;
  }

  if (haystack.includes('camping') || haystack.includes('campground')) {
    return `Une option plus simple et nature, intéressante pour réduire le coût du séjour.${ratingText}`;
  }

  if (
    haystack.includes('luxury') ||
    haystack.includes('luxe') ||
    haystack.includes('resort') ||
    haystack.includes('spa')
  ) {
    return `Un hébergement plus confortable ou haut de gamme, adapté à un séjour plus premium.${ratingText}`;
  }

  if (haystack.includes('apartment') || haystack.includes('appartement')) {
    return `Une option pratique pour avoir plus d’autonomie pendant le séjour, notamment à plusieurs.${ratingText}`;
  }

  if (activeFilters.includes('budget')) {
    return `Une option pensée pour limiter le budget hébergement tout en restant cohérente avec le séjour.${ratingText}`;
  }

  return `Hébergement proposé selon vos critères. Les disponibilités et tarifs exacts seront à confirmer sur le site partenaire.${ratingText}`;
}

function buildApiLodgingFilter(activeFilters: string[], trip?: TripSelection | null) {
  if (activeFilters.includes('camping')) return 'camping';
  if (activeFilters.includes('hostel')) return 'auberge';
  if (activeFilters.includes('apartment')) return 'appartement';
  if (activeFilters.includes('luxury')) return 'luxueux';
  if (activeFilters.includes('budget')) return 'auberge';
  if (trip?.lodging) return trip.lodging;

  return 'hotel';
}

function normalizeStay(raw: any): Stay {
  const rawPrice =
    typeof raw.pricePerNightPerPerson === 'number'
      ? raw.pricePerNightPerPerson
      : Number(raw.pricePerNightPerPerson);

  return {
    id: raw.id,
    name: raw.name,
    address: raw.address || '',
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    rating: raw.rating || null,
    userRatingCount: raw.userRatingCount || 0,
    pricePerNightPerPerson: Number.isFinite(rawPrice) ? rawPrice : 80,
    priceTotal:
      typeof raw.priceTotal === 'number' ? raw.priceTotal : Number(raw.priceTotal || 0),
    currency: raw.currency || 'EUR',
    link: raw.link || raw.googleMapsUri || '#',
    googleMapsUri: raw.googleMapsUri || '',
    type: raw.type || '',
    primaryType: raw.primaryType || '',
    types: raw.types || [],
    isReal: Boolean(raw.isReal ?? true),
    description: raw.description || '',
    source: raw.source || 'Hébergement',
    imageUrl: raw.imageUrl || '',
    bookingId: raw.bookingId,
    available: Boolean(raw.available ?? true),
  };
}

function getCheckoutDate(start: string | null | undefined, nights: number) {
  if (!start) return '';

  const date = new Date(`${start}T12:00:00`);

  if (Number.isNaN(date.getTime())) return '';

  date.setDate(date.getDate() + Math.max(1, nights));

  return date.toISOString().slice(0, 10);
}

export default function StaysPage() {
  const router = useRouter();

  const [trip, setTrip] = useState<TripSelection | null>(null);
  const [stays, setStays] = useState<Stay[]>([]);
  const [selectedStay, setSelectedStay] = useState<Stay | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceWarning, setSourceWarning] = useState('');

  const [budget, setBudget] = useState<number | null>(null);
  const [acceptBudgetOverrun, setAcceptBudgetOverrun] = useState(false);

  useEffect(() => {
    const rawSelection = localStorage.getItem('gt_selection');
    const rawCriteria = localStorage.getItem('gt_criteria');
    const rawFilters = localStorage.getItem('gt_stay_filters');

    let parsedSelection: TripSelection | null = null;

    if (rawSelection) {
      try {
        parsedSelection = JSON.parse(rawSelection);
      } catch {
        parsedSelection = null;
      }
    }

    if (!parsedSelection) {
      router.push('/destinations');
      return;
    }

    setTrip(parsedSelection);

    const previousStay = parsedSelection.selections?.stays?.[0] || null;

    if (previousStay) {
      setSelectedStay(previousStay);
    }

    if (rawFilters) {
      try {
        const parsedFilters = JSON.parse(rawFilters);
        if (Array.isArray(parsedFilters.filters)) {
          setActiveFilters(parsedFilters.filters);
        }
      } catch {
        setActiveFilters([]);
      }
    }

    if (typeof parsedSelection.budget === 'number' && parsedSelection.budget > 0) {
      setBudget(parsedSelection.budget);
    } else if (rawCriteria) {
      try {
        const parsedCriteria = JSON.parse(rawCriteria);
        const criteriaBudget = Number(parsedCriteria.budget || 0);

        if (Number.isFinite(criteriaBudget) && criteriaBudget > 0) {
          setBudget(criteriaBudget);
        }
      } catch {
        setBudget(null);
      }
    }
  }, [router]);

  useEffect(() => {
    if (!trip?.destination) return;

    async function loadStays() {
      try {
        setLoading(true);
        setError('');
        setSourceWarning('');

        const checkin = trip.startDate || trip.start || '';
        const checkout = getCheckoutDate(checkin, trip.nights);

        const params = new URLSearchParams({
          lat: String(trip.destination.lat),
          lng: String(trip.destination.lng),
          city: trip.destination.city,
          type: 'stays',
          persons: String(trip.persons || 1),
          rooms: '1',
          lodging: buildApiLodgingFilter(activeFilters, trip),
          currency: 'EUR',
        });

        if (checkin) {
          params.set('checkin', checkin);
        }

        if (checkout) {
          params.set('checkout', checkout);
        }

        const res = await fetch(`/api/stays?${params.toString()}`, {
          cache: 'no-store',
        });

        const json = await res.json();

        if (!res.ok) {
          const message =
            json?.details?.error?.message ||
            json?.details?.message ||
            json?.error ||
            'Erreur chargement hébergements';

          throw new Error(message);
        }

        if (json.warning) {
          setSourceWarning(json.warning);
        }

        const rawStays = Array.isArray(json.stays)
          ? json.stays
          : Array.isArray(json.places)
            ? json.places
            : [];

        const mapped = rawStays.map(normalizeStay);

        setStays(mapped);
      } catch (e: any) {
        setError(e?.message || 'Impossible de charger les hébergements.');
      } finally {
        setLoading(false);
      }
    }

    loadStays();
  }, [trip, activeFilters]);

  const filteredStays = useMemo(() => {
    return stays
      .map((stay) => ({
        ...stay,
        description: generateStayDescription(stay, activeFilters),
      }))
      .filter((stay) => stayMatchesFilters(stay, activeFilters));
  }, [stays, activeFilters]);

  const persons = trip?.persons || 1;
  const nights = trip?.nights || 1;

  const staysTotal = useMemo(() => {
    if (!selectedStay) return 0;

    if (selectedStay.priceTotal && selectedStay.priceTotal > 0) {
      return selectedStay.priceTotal;
    }

    return Number(selectedStay.pricePerNightPerPerson || 0) * persons * nights;
  }, [selectedStay, persons, nights]);

  const previousActivitiesTotal = trip?.totals?.activities || 0;
  const previousRestaurantsTotal = trip?.totals?.restaurants || 0;
  const previousTransportTotal = trip?.totals?.transport || 0;

  const baseTotal =
    previousActivitiesTotal +
    previousRestaurantsTotal +
    staysTotal +
    previousTransportTotal;

  const isOverBudget = budget !== null && baseTotal > budget;
  const budgetOverrun = isOverBudget ? baseTotal - (budget || 0) : 0;

  useEffect(() => {
    if (!isOverBudget) {
      setAcceptBudgetOverrun(false);
    }
  }, [isOverBudget]);

  const canContinue = !isOverBudget || acceptBudgetOverrun;

  const toggleFilter = (filterId: string) => {
    setActiveFilters((current) =>
      current.includes(filterId)
        ? current.filter((id) => id !== filterId)
        : [...current, filterId]
    );
  };

  const toggleStay = (stay: Stay) => {
    setSelectedStay((current) => {
      if (current?.id === stay.id) return null;

      return {
        ...stay,
        description: stay.description || generateStayDescription(stay, activeFilters),
      };
    });
  };

  const goNext = () => {
    if (!trip || !canContinue) return;

    const selectedStays = selectedStay ? [selectedStay] : [];

    const nextSelection: TripSelection = {
      ...trip,
      budget,
      lodging: buildApiLodgingFilter(activeFilters, trip),
      selections: {
        activities: trip.selections?.activities || [],
        restaurants: trip.selections?.restaurants || [],
        stays: selectedStays,
      },
      totals: {
        activities: previousActivitiesTotal,
        restaurants: previousRestaurantsTotal,
        stays: staysTotal,
        transport: previousTransportTotal,
        overall: baseTotal,
      },
    };

    localStorage.setItem('gt_selection', JSON.stringify(nextSelection));
    localStorage.setItem(
      'gt_stay_filters',
      JSON.stringify({
        filters: activeFilters,
        selectedId: selectedStay?.id || null,
      })
    );

    router.push('/transport');
  };

  const goHome = () => {
    router.push('/');
  };

  const goBack = () => {
    router.back();
  };

  if (!trip) {
    return (
      <div className="min-h-screen grid place-items-center bg-white px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          <p className="text-slate-600">Chargement du voyage...</p>
        </div>
      </div>
    );
  }

  const markers = [
    {
      name: trip.destination.city,
      lat: Number(trip.destination.lat),
      lng: Number(trip.destination.lng),
    },
    ...filteredStays.map((stay) => ({
      name: stay.name,
      lat: Number(stay.lat),
      lng: Number(stay.lng),
    })),
  ].filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng));

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={goHome}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Home className="h-4 w-4" />
            Accueil
          </button>

          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
        </div>

        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
            Étape 3 / 5
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold">
            Choisissez votre hébergement
          </h1>

          <p className="mt-2 text-slate-600">
            {trip.destination.city}, {trip.destination.country} • {persons}{' '}
            personne(s) • {nights} nuit(s)
            {budget ? <> • budget {formatEuro(budget)}</> : null}
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-bold">Type d’hébergement</h2>

          <div className="flex flex-wrap gap-2">
            {STAY_FILTERS.map((filter) => {
              const active = activeFilters.includes(filter.id);

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => toggleFilter(filter.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    active
                      ? 'border-teal-700 bg-teal-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {filter.icon}
                  {filter.label}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Gototrip essaie d’utiliser Booking si l’API est configurée. Sinon, les
            résultats viennent de Google Places avec prix estimatifs.
          </p>
        </section>

        {loading && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des hébergements autour de {trip.destination.city}...
          </div>
        )}

        {sourceWarning && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="font-semibold">Information source</div>
            <div>{sourceWarning}</div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-4">
            {filteredStays.length === 0 && !loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                <h2 className="text-xl font-bold">Aucun hébergement trouvé</h2>
                <p className="mt-2 text-slate-600">
                  Essaie de retirer certains filtres.
                </p>
              </div>
            ) : (
              filteredStays.map((stay) => {
                const selected = selectedStay?.id === stay.id;
                const total =
                  stay.priceTotal && stay.priceTotal > 0
                    ? stay.priceTotal
                    : Number(stay.pricePerNightPerPerson || 0) * persons * nights;

                const readableTypes = getReadableTypes(stay);

                return (
                  <article
                    key={stay.id}
                    className={`rounded-2xl border p-5 transition ${
                      selected
                        ? 'border-teal-600 bg-teal-50'
                        : 'border-slate-200 bg-white hover:border-teal-500'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold">{stay.name}</h2>

                          {selected && (
                            <span className="rounded-full bg-teal-700 px-2 py-1 text-xs font-semibold text-white">
                              Sélectionné
                            </span>
                          )}

                          {stay.source && (
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                              {stay.source}
                            </span>
                          )}

                          {stay.available && (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                              Disponible estimé
                            </span>
                          )}
                        </div>

                        {stay.rating && (
                          <div className="mb-2 flex items-center gap-1 text-sm text-amber-700">
                            <Star className="h-4 w-4 fill-current" />
                            <span>
                              {stay.rating} / 5 ({stay.userRatingCount || 0} avis)
                            </span>
                          </div>
                        )}

                        {stay.address && (
                          <div className="mb-3 flex items-start gap-2 text-sm text-slate-500">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{stay.address}</span>
                          </div>
                        )}

                        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Info className="h-4 w-4 text-slate-500" />
                            Pourquoi cet hébergement ?
                          </div>

                          <p className="text-sm text-slate-600">
                            {stay.description || generateStayDescription(stay, activeFilters)}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {readableTypes.map((type) => (
                            <span
                              key={type}
                              className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                            >
                              {type}
                            </span>
                          ))}
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          Prix et disponibilité à confirmer sur le site partenaire.
                        </p>
                      </div>

                      <div className="md:w-56 md:text-right">
                        <div className="text-2xl font-extrabold">
                          {formatSimpleEuro(total)}
                        </div>

                        <div className="text-xs text-slate-500">
                          {formatSimpleEuro(stay.pricePerNightPerPerson || 0)} / nuit /
                          personne
                        </div>

                        {stay.priceTotal && stay.priceTotal > 0 && (
                          <div className="mt-1 text-xs text-slate-500">
                            Prix total partenaire
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleStay(stay)}
                          className={`mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold ${
                            selected
                              ? 'bg-teal-700 text-white hover:bg-teal-800'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {selected ? 'Retirer' : 'Sélectionner'}
                        </button>

                        <a
                          href={stay.link || stay.googleMapsUri || '#'}
                          target="_blank"
                          className="mt-2 block text-xs text-teal-700 underline"
                        >
                          Site / partenaire
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-xl font-bold">Récapitulatif</h2>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between gap-4">
                  <span>Hébergement choisi</span>
                  <span className="font-semibold text-slate-900">
                    {selectedStay ? '1' : '0'}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Activités</span>
                  <span className="font-semibold text-slate-900">
                    {formatSimpleEuro(previousActivitiesTotal)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Restaurants</span>
                  <span className="font-semibold text-slate-900">
                    {formatSimpleEuro(previousRestaurantsTotal)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Hébergement</span>
                  <span className="font-semibold text-slate-900">
                    {formatSimpleEuro(staysTotal)}
                  </span>
                </div>

                {budget !== null && (
                  <div className="flex justify-between gap-4">
                    <span>Budget prévu</span>
                    <span className="font-semibold text-slate-900">
                      {formatEuro(budget)}
                    </span>
                  </div>
                )}
              </div>

              <div className="my-4 border-t border-slate-200" />

              <div className="flex justify-between items-end gap-4">
                <span className="font-bold">Total actuel</span>
                <span
                  className={`text-2xl font-extrabold ${
                    isOverBudget ? 'text-red-700' : 'text-slate-900'
                  }`}
                >
                  {formatSimpleEuro(baseTotal)}
                </span>
              </div>

              {isOverBudget && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <div className="mb-2 font-semibold">
                    Votre sélection dépasse votre budget.
                  </div>

                  <div className="space-y-1">
                    <div>
                      Budget prévu :{' '}
                      <span className="font-semibold">{formatEuro(budget || 0)}</span>
                    </div>

                    <div>
                      Total actuel :{' '}
                      <span className="font-semibold">{formatEuro(baseTotal)}</span>
                    </div>

                    <div>
                      Dépassement :{' '}
                      <span className="font-semibold">
                        {formatEuro(budgetOverrun)}
                      </span>
                    </div>
                  </div>

                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-white p-3 text-sm text-red-900">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={acceptBudgetOverrun}
                      onChange={(event) => setAcceptBudgetOverrun(event.target.checked)}
                    />
                    <span>J’accepte de dépasser mon budget pour continuer.</span>
                  </label>
                </div>
              )}

              <button
                type="button"
                onClick={goNext}
                disabled={!canContinue}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ${
                  canContinue
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                }`}
              >
                Continuer vers le transport
                <ChevronRight className="h-4 w-4" />
              </button>

              {isOverBudget && !acceptBudgetOverrun && (
                <div className="mt-2 text-center text-xs text-red-700">
                  Cochez l’acceptation du dépassement pour continuer.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-xl font-bold">Carte</h2>

              <TripMap
                markers={markers}
                height={320}
                zoom={12}
                showPath={false}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}