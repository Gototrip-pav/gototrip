'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { DETAIL_BY_SLUG, type DestinationDetail } from '../../data/mockData';
import {
  ArrowLeft,
  ChevronRight,
  Home,
  MapPin,
  CalendarDays,
  Users,
  Wallet,
  Hotel,
  SlidersHorizontal,
  Star,
  Database,
} from 'lucide-react';
import TripMap from '../../components/TripMap';

type ApiDestinationDetail = {
  slug: string;
  header: {
    city: string;
    country: string;
    lat: number;
    lng: number;
    weather?: string;
  };
  source?: string;
  googleMapsUri?: string;
  rating?: number | null;
  userRatingCount?: number;
};

type UnifiedDestinationDetail = {
  slug: string;
  header: {
    city: string;
    country: string;
    lat: number;
    lng: number;
    weather?: string;
  };
  source: 'mock' | 'api';
  sourceLabel: string;
  googleMapsUri?: string;
  rating?: number | null;
  userRatingCount?: number;
};

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

function getLodgingLabel(value: string | null) {
  if (!value) return 'Non précisé';

  const first = value.split(',')[0];

  if (first === 'hotel') return 'Hôtel';
  if (first === 'appartement') return 'Appartement';
  if (first === 'maison') return 'Maison';
  if (first === 'auberge') return 'Auberge';
  if (first === 'camping') return 'Camping';

  return first;
}

function readApiDestination(slug: string): UnifiedDestinationDetail | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem('gt_api_destination');

  if (!raw) return null;

  try {
    const parsed: ApiDestinationDetail = JSON.parse(raw);

    const savedSlug = normalizeText(parsed.slug || '');
    const currentSlug = normalizeText(slug || '');

    if (!savedSlug || savedSlug !== currentSlug) {
      return null;
    }

    if (
      !parsed.header?.city ||
      !Number.isFinite(Number(parsed.header?.lat)) ||
      !Number.isFinite(Number(parsed.header?.lng))
    ) {
      return null;
    }

    return {
      slug: parsed.slug,
      header: {
        city: parsed.header.city,
        country: parsed.header.country || '',
        lat: Number(parsed.header.lat),
        lng: Number(parsed.header.lng),
        weather: parsed.header.weather || '',
      },
      source: 'api',
      sourceLabel: parsed.source || 'Google Places',
      googleMapsUri: parsed.googleMapsUri || '',
      rating: parsed.rating || null,
      userRatingCount: parsed.userRatingCount || 0,
    };
  } catch {
    return null;
  }
}

function mockToUnified(
  slug: string,
  detail: DestinationDetail | undefined
): UnifiedDestinationDetail | null {
  if (!detail) return null;

  return {
    slug,
    header: {
      city: detail.header.city,
      country: detail.header.country,
      lat: Number(detail.header.lat),
      lng: Number(detail.header.lng),
      weather: detail.header.weather,
    },
    source: 'mock',
    sourceLabel: 'Base Gototrip',
  };
}

export default function DestinationDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [apiDestination, setApiDestination] =
    useState<UnifiedDestinationDetail | null>(null);

  const mockDetail = DETAIL_BY_SLUG[slug];

  useEffect(() => {
    setApiDestination(readApiDestination(slug));
  }, [slug]);

  const detail = useMemo(() => {
    return apiDestination || mockToUnified(slug, mockDetail);
  }, [apiDestination, mockDetail, slug]);

  const departureCity = searchParams.get('departure') || '';
  const lodgingChoice = searchParams.get('lodging') || '';
  const startDate = searchParams.get('start') || '';

  const persons = Math.max(1, Number(searchParams.get('persons') || 1));
  const duration = Math.max(1, Number(searchParams.get('duration') || 1));
  const nights = Math.max(1, duration - 1);

  const rawBudget = Number(searchParams.get('budget') || 0);
  const budget = Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : null;

  const markers = useMemo(() => {
    if (!detail) return [];

    return [
      {
        name: detail.header.city,
        lat: Number(detail.header.lat),
        lng: Number(detail.header.lng),
      },
    ].filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  }, [detail]);

  useEffect(() => {
    if (!detail) return;

    const criteria = {
      departureCity,
      persons,
      duration,
      nights,
      start: startDate || null,
      budget: budget ? String(budget) : null,
      destination: slug,
      lodging: lodgingChoice,
      destinationSource: detail.source,
    };

    localStorage.setItem('gt_criteria', JSON.stringify(criteria));
  }, [
    detail,
    departureCity,
    persons,
    duration,
    nights,
    startDate,
    budget,
    slug,
    lodgingChoice,
  ]);

  const goHome = () => {
    router.push('/');
  };

  const goDestinations = () => {
    const query = searchParams.toString();
    router.push(query ? `/destinations?${query}` : '/destinations');
  };

  const goBack = () => {
    router.back();
  };

  const startTrip = () => {
    if (!detail) return;

    const payload = {
      destination: detail.header,
      departureCity,
      persons,
      duration,
      nights,
      budget,
      destinationSource: detail.source,
      destinationGoogleMapsUri: detail.googleMapsUri || '',
      selections: {
        activities: [],
        restaurants: [],
        stays: [],
      },
      totals: {
        activities: 0,
        restaurants: 0,
        stays: 0,
        transport: 0,
        overall: 0,
      },
    };

    localStorage.setItem('gt_selection', JSON.stringify(payload));
    router.push('/trip/activities');
  };

  if (!detail) {
    return (
      <div className="min-h-screen bg-white grid place-items-center px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold mb-2">
            Destination inconnue
          </h1>

          <p className="text-slate-600 mb-5">
            Cette destination n’existe pas encore dans Gototrip ou n’a pas été
            correctement sauvegardée depuis l’API.
          </p>

          <button
            onClick={goDestinations}
            className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
          >
            Voir les destinations
          </button>
        </div>
      </div>
    );
  }

  const lodgingLabel = getLodgingLabel(lodgingChoice);

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
            onClick={goDestinations}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <MapPin className="h-4 w-4" />
            Destinations
          </button>

          <button
            onClick={goHome}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Modifier mes critères
          </button>

          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
        </div>

        <section className="mb-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                  Destination sélectionnée
                </div>

                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                    detail.source === 'api'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Database className="h-4 w-4" />
                  {detail.sourceLabel}
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
                {detail.header.city}
              </h1>

              <p className="text-lg text-slate-600 mb-3">
                {detail.header.country || 'Destination'}
                {detail.header.weather ? ` • ${detail.header.weather}` : ''}
              </p>

              {detail.rating && (
                <div className="mb-6 flex items-center gap-1 text-sm text-amber-700">
                  <Star className="h-4 w-4 fill-current" />
                  <span>
                    {detail.rating} / 5 ({detail.userRatingCount || 0} avis)
                  </span>
                </div>
              )}

              {!detail.rating && <div className="mb-6" />}

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard
                  icon={<MapPin className="h-4 w-4" />}
                  label="Ville de départ"
                  value={departureCity || 'Non renseignée'}
                />

                <InfoCard
                  icon={<Users className="h-4 w-4" />}
                  label="Voyageurs"
                  value={`${persons} personne(s)`}
                />

                <InfoCard
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Durée"
                  value={`${duration} jour(s) • ${nights} nuit(s)`}
                />

                <InfoCard
                  icon={<Hotel className="h-4 w-4" />}
                  label="Hébergement souhaité"
                  value={lodgingLabel}
                />

                <InfoCard
                  icon={<Wallet className="h-4 w-4" />}
                  label="Budget prévu"
                  value={budget ? formatEuro(budget) : 'Non renseigné'}
                />

                <InfoCard
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Date de départ"
                  value={startDate || 'Non renseignée'}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-xl font-bold mb-2">
                  Construisons votre voyage étape par étape
                </h2>

                <p className="text-slate-600">
                  Gototrip va maintenant vous guider dans le choix des activités,
                  restaurants, hébergements puis transports, avec un contrôle du
                  budget à chaque étape.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={startTrip}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Commencer par les activités
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {detail.googleMapsUri && (
                    <a
                      href={detail.googleMapsUri}
                      target="_blank"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Voir sur Google Maps
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-xl font-bold mb-4">Carte de la destination</h2>

              <TripMap
                markers={markers}
                height={420}
                zoom={12}
                showPath={false}
              />
            </div>
          </div>
        </section>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>

      <div className="font-bold text-slate-900">{value}</div>
    </div>
  );
}