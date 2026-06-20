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
  Users,
  Baby,
  Dumbbell,
  Landmark,
  TreePalm,
  Film,
  Music,
  Heart,
  Sparkles,
  Wallet,
  Info,
} from 'lucide-react';
import TripMap from '../../components/TripMap';

type Destination = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  weather?: string;
};

type Activity = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  rating?: number | null;
  userRatingCount?: number;
  pricePerPerson: number;
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
  partnerId?: string | number;
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

type TripSelection = {
  destination: Destination;
  departureCity?: string;
  persons: number;
  duration: number;
  nights: number;
  start?: string | null;
  startDate?: string | null;
  budget?: number | null;
  selections?: {
    activities?: Activity[];
    restaurants?: any[];
    stays?: any[];
  };
  totals?: {
    activities?: number;
    restaurants?: number;
    stays?: number;
    transport?: number;
    overall?: number;
  };
};

type ActivityFilter = {
  id: string;
  label: string;
  icon: React.ReactNode;
  keywords: string[];
};

const ACTIVITY_FILTERS: ActivityFilter[] = [
  {
    id: 'family',
    label: 'En famille',
    icon: <Users className="h-4 w-4" />,
    keywords: [
      'family',
      'famille',
      'park',
      'parc',
      'museum',
      'musée',
      'aquarium',
      'zoo',
      'tourist attraction',
    ],
  },
  {
    id: 'kids',
    label: 'Enfants',
    icon: <Baby className="h-4 w-4" />,
    keywords: [
      'kids',
      'children',
      'playground',
      'aquarium',
      'zoo',
      'park',
      'parc',
      'amusement',
    ],
  },
  {
    id: 'sport',
    label: 'Sportif',
    icon: <Dumbbell className="h-4 w-4" />,
    keywords: [
      'sport',
      'stadium',
      'gym',
      'hiking',
      'trail',
      'water sport',
      'adventure',
    ],
  },
  {
    id: 'culture',
    label: 'Culture',
    icon: <Landmark className="h-4 w-4" />,
    keywords: [
      'museum',
      'musée',
      'gallery',
      'art',
      'monument',
      'historic',
      'culture',
      'landmark',
      'archaeological',
    ],
  },
  {
    id: 'nature',
    label: 'Nature',
    icon: <TreePalm className="h-4 w-4" />,
    keywords: [
      'park',
      'parc',
      'beach',
      'plage',
      'garden',
      'nature',
      'viewpoint',
      'natural',
    ],
  },
  {
    id: 'cinema',
    label: 'Cinéma',
    icon: <Film className="h-4 w-4" />,
    keywords: ['cinema', 'cinéma', 'movie', 'theater'],
  },
  {
    id: 'nightlife',
    label: 'Boîte de nuit',
    icon: <Music className="h-4 w-4" />,
    keywords: ['night club', 'nightclub', 'club', 'bar', 'music', 'nightlife'],
  },
  {
    id: 'romantic',
    label: 'Romantique',
    icon: <Heart className="h-4 w-4" />,
    keywords: ['romantic', 'viewpoint', 'walk', 'garden', 'beach', 'sunset'],
  },
  {
    id: 'unusual',
    label: 'Insolite',
    icon: <Sparkles className="h-4 w-4" />,
    keywords: ['unique', 'unusual', 'attraction', 'escape', 'experience'],
  },
  {
    id: 'free',
    label: 'Gratuit',
    icon: <Wallet className="h-4 w-4" />,
    keywords: [
      'park',
      'parc',
      'beach',
      'plage',
      'viewpoint',
      'walk',
      'garden',
      'square',
      'plaza',
      'promenade',
      'hiking',
      'historical landmark',
      'monument',
    ],
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

function getActivityHaystack(activity: Activity) {
  return normalizeText(
    [
      activity.name,
      activity.address,
      activity.type,
      activity.primaryType,
      activity.source,
      ...(activity.types || []),
    ].join(' ')
  );
}

function getPositiveRawPrice(value: unknown) {
  const price = Number(value);

  if (Number.isFinite(price) && price > 0) {
    return price;
  }

  return null;
}

function isPaidActivity(activity: Activity) {
  const haystack = getActivityHaystack(activity);

  const paidKeywords = [
    'museum',
    'musee',
    'movie_theater',
    'cinema',
    'zoo',
    'aquarium',
    'amusement_park',
    'theme_park',
    'tour_operator',
    'guided_tour',
    'escape_game',
    'bowling',
    'stadium',
    'sports_complex',
    'fitness_center',
    'spa',
    'casino',
    'theater',
    'opera',
    'concert_hall',
    'art_gallery',
  ];

  return paidKeywords.some((keyword) => haystack.includes(normalizeText(keyword)));
}

function isActuallyFreeActivity(activity: Activity) {
  if (isPaidActivity(activity)) return false;

  const haystack = getActivityHaystack(activity);

  const freeKeywords = [
    'park',
    'parc',
    'public_garden',
    'garden',
    'beach',
    'plage',
    'square',
    'plaza',
    'viewpoint',
    'scenic_point',
    'walking_area',
    'promenade',
    'hiking_area',
    'nature_reserve',
    'historical_landmark',
    'monument',
    'bridge',
    'market',
    'church',
    'cathedral',
  ];

  return freeKeywords.some((keyword) => haystack.includes(normalizeText(keyword)));
}

function activityMatchesFilters(activity: Activity, filters: string[]) {
  if (filters.length === 0) return true;

  const selectedFilters = ACTIVITY_FILTERS.filter((filter) =>
    filters.includes(filter.id)
  );

  const haystack = getActivityHaystack(activity);

  return selectedFilters.some((filter) => {
    if (filter.id === 'free') {
      return isActuallyFreeActivity(activity);
    }

    return filter.keywords.some((keyword) =>
      haystack.includes(normalizeText(keyword))
    );
  });
}

function estimateActivityPrice(activity: Activity) {
  const haystack = getActivityHaystack(activity);
  const positiveRawPrice = getPositiveRawPrice(activity.pricePerPerson);

  if (isActuallyFreeActivity(activity)) return 0;

  if (haystack.includes('museum') || haystack.includes('musee')) return 15;
  if (haystack.includes('library')) return 0;
  if (haystack.includes('research_institute')) return 0;
  if (haystack.includes('night') || haystack.includes('club')) return 25;
  if (haystack.includes('cinema') || haystack.includes('movie')) return 12;
  if (haystack.includes('aquarium') || haystack.includes('zoo')) return 25;

  if (haystack.includes('amusement_park') || haystack.includes('theme_park')) {
    return 45;
  }

  if (haystack.includes('art_gallery')) return 12;
  if (haystack.includes('stadium')) return 20;
  if (haystack.includes('sports_complex')) return 18;
  if (haystack.includes('fitness_center')) return 15;
  if (haystack.includes('tour')) return 30;

  return positiveRawPrice ?? 20;
}

function getReadableTypes(activity: Activity) {
  const types = activity.types || [];

  return types
    .slice(0, 4)
    .map((type) =>
      String(type)
        .replaceAll('_', ' ')
        .replace('tourist attraction', 'site touristique')
        .replace('point of interest', 'lieu d’intérêt')
        .replace('establishment', 'établissement')
        .replace('museum', 'musée')
        .replace('park', 'parc')
        .replace('tour', 'visite')
    );
}

function generateActivityDescription(activity: Activity, activeFilters: string[]) {
  if (activity.description) {
    return activity.description;
  }

  const haystack = getActivityHaystack(activity);

  const ratingText = activity.rating
    ? ` Elle est notée ${activity.rating}/5 par les visiteurs.`
    : '';

  if (activity.source === 'GetYourGuide') {
    return `Activité réservable via GetYourGuide. Prix, horaires et disponibilité à confirmer sur le site partenaire.${ratingText}`;
  }

  if (isActuallyFreeActivity(activity)) {
    return `Activité gratuite ou en accès libre, idéale pour profiter de la destination sans augmenter le budget.${ratingText}`;
  }

  if (haystack.includes('museum') || haystack.includes('musee')) {
    return `Une visite culturelle intéressante pour découvrir l’histoire, l’art ou le patrimoine local.${ratingText}`;
  }

  if (
    haystack.includes('archaeological') ||
    haystack.includes('historic') ||
    haystack.includes('monument') ||
    haystack.includes('landmark')
  ) {
    return `Un lieu patrimonial à découvrir pour mieux comprendre l’histoire de la destination.${ratingText}`;
  }

  if (
    haystack.includes('park') ||
    haystack.includes('parc') ||
    haystack.includes('garden')
  ) {
    return `Un endroit agréable pour se balader, faire une pause ou profiter d’un moment calme en extérieur.${ratingText}`;
  }

  if (haystack.includes('beach') || haystack.includes('plage')) {
    return `Une sortie idéale pour profiter de la mer, se détendre ou passer un moment simple en bord de plage.${ratingText}`;
  }

  if (haystack.includes('cinema') || haystack.includes('movie')) {
    return `Une option pratique pour une sortie détente, notamment en soirée ou en cas de météo moins favorable.${ratingText}`;
  }

  if (haystack.includes('night') || haystack.includes('club')) {
    return `Une activité plutôt orientée soirée, idéale pour sortir, écouter de la musique ou profiter de l’ambiance locale.${ratingText}`;
  }

  if (haystack.includes('aquarium') || haystack.includes('zoo')) {
    return `Une activité adaptée aux familles et aux enfants, avec une découverte ludique et facile à intégrer au séjour.${ratingText}`;
  }

  if (activeFilters.includes('family') || activeFilters.includes('kids')) {
    return `Une activité facile à intégrer dans un séjour en famille, avec un format adapté à un rythme tranquille.${ratingText}`;
  }

  if (activeFilters.includes('romantic')) {
    return `Une activité adaptée à un moment à deux, pour profiter d’un cadre agréable ou d’une sortie plus calme.${ratingText}`;
  }

  if (activeFilters.includes('sport')) {
    return `Une option intéressante pour ajouter une activité plus dynamique au séjour.${ratingText}`;
  }

  return `Une activité locale intéressante à intégrer dans votre séjour selon vos envies et votre budget.${ratingText}`;
}

function buildApiFilter(activeFilters: string[]) {
  const filtersWithoutFree = activeFilters.filter((filter) => filter !== 'free');

  if (filtersWithoutFree.includes('nature')) return 'Nature';
  if (filtersWithoutFree.includes('culture')) return 'Culture';
  if (filtersWithoutFree.includes('cinema')) return 'Cinéma';
  if (filtersWithoutFree.includes('nightlife')) return 'Boîte de nuit';
  if (filtersWithoutFree.includes('sport')) return 'Sportif';
  if (filtersWithoutFree.includes('family')) return 'En famille';
  if (filtersWithoutFree.includes('kids')) return 'Enfants';

  return '';
}

function normalizeActivity(raw: any): Activity {
  const rawPrice =
    typeof raw.pricePerPerson === 'number'
      ? raw.pricePerPerson
      : Number(raw.pricePerPerson);

  const baseActivity: Activity = {
    id: raw.id,
    name: raw.name,
    address: raw.address || '',
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    rating: raw.rating || null,
    userRatingCount: raw.userRatingCount || 0,
    pricePerPerson: Number.isFinite(rawPrice) ? rawPrice : 20,
    priceTotal:
      typeof raw.priceTotal === 'number'
        ? raw.priceTotal
        : Number(raw.priceTotal || 0),
    currency: raw.currency || 'EUR',
    link: raw.link || raw.googleMapsUri || '#',
    googleMapsUri: raw.googleMapsUri || '',
    type: raw.type || '',
    primaryType: raw.primaryType || '',
    types: raw.types || [],
    isReal: Boolean(raw.isReal ?? true),
    description: raw.description || '',
    source: raw.source || 'Activité',
    imageUrl: raw.imageUrl || '',
    partnerId: raw.partnerId,
    estimatedDurationMinutes: raw.estimatedDurationMinutes,
    durationLabel: raw.durationLabel,
    openingHoursSummary: raw.openingHoursSummary,
    openingPeriods: raw.openingPeriods || [],
    openNow: typeof raw.openNow === 'boolean' ? raw.openNow : null,
  };

  if (baseActivity.source === 'GetYourGuide') {
    return {
      ...baseActivity,
      pricePerPerson: getPositiveRawPrice(rawPrice) ?? 30,
    };
  }

  return {
    ...baseActivity,
    pricePerPerson: estimateActivityPrice(baseActivity),
  };
}

function getActivityBookingPath(
  trip: TripSelection | null,
  activity?: Activity | null
) {
  if (!trip?.destination) return '#';

  const params = new URLSearchParams({
    provider: 'getyourguide',
    city: trip.destination.city || '',
    country: trip.destination.country || '',
    redirect: '1',
  });

  if (activity?.name) {
    params.set('activity', activity.name);
  }

  return `/api/affiliate-links?${params.toString()}`;
}

export default function ActivitiesPage() {
  const router = useRouter();

  const [trip, setTrip] = useState<TripSelection | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<Activity[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [budget, setBudget] = useState<number | null>(null);
  const [acceptBudgetOverrun, setAcceptBudgetOverrun] = useState(false);

  useEffect(() => {
    const rawSelection = localStorage.getItem('gt_selection');
    const rawCriteria = localStorage.getItem('gt_criteria');
    const rawFilters = localStorage.getItem('gt_activity_filters');

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

    const previousActivities = (parsedSelection.selections?.activities || []).map(
      (activity) => ({
        ...activity,
        link: getActivityBookingPath(parsedSelection, activity),
        pricePerPerson: Number(activity.pricePerPerson || 0),
        description:
          activity.description || generateActivityDescription(activity, []),
      })
    );

    setTrip(parsedSelection);
    setSelectedActivities(previousActivities);

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

    async function loadActivities() {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams({
          lat: String(trip.destination.lat),
          lng: String(trip.destination.lng),
          city: trip.destination.city,
          persons: String(trip.persons || 1),
          currency: 'EUR',
        });

        const apiFilter = buildApiFilter(activeFilters);
        const startDate = trip.startDate || trip.start || '';

        if (apiFilter) {
          params.set('filter', apiFilter);
        }

        if (startDate) {
          params.set('date', startDate);
        }

        const res = await fetch(`/api/activities?${params.toString()}`, {
          cache: 'no-store',
        });

        const json = await res.json();

        if (!res.ok) {
          const message =
            json?.details?.error?.message ||
            json?.details?.message ||
            json?.error ||
            'Erreur chargement activités';

          throw new Error(message);
        }

        const rawActivities = Array.isArray(json.activities)
          ? json.activities
          : Array.isArray(json.places)
            ? json.places
            : [];

        const mapped = rawActivities.map((rawActivity: any) => {
          const normalizedActivity = normalizeActivity(rawActivity);

          return {
            ...normalizedActivity,
            link: getActivityBookingPath(trip, normalizedActivity),
          };
        });

        setActivities(mapped);
      } catch (e: any) {
        setError(e?.message || 'Impossible de charger les activités.');
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, [trip, activeFilters]);

  const selectedIds = useMemo(() => {
    return selectedActivities.map((activity) => activity.id);
  }, [selectedActivities]);

  const filteredActivities = useMemo(() => {
    return activities
      .map((activity) => ({
        ...activity,
        description: generateActivityDescription(activity, activeFilters),
      }))
      .filter((activity) => activityMatchesFilters(activity, activeFilters));
  }, [activities, activeFilters]);

  const persons = trip?.persons || 1;

  const activitiesTotal = useMemo(() => {
    return selectedActivities.reduce(
      (sum, activity) => sum + Number(activity.pricePerPerson || 0) * persons,
      0
    );
  }, [selectedActivities, persons]);

  const previousRestaurantsTotal = trip?.totals?.restaurants || 0;
  const previousStaysTotal = trip?.totals?.stays || 0;
  const previousTransportTotal = trip?.totals?.transport || 0;

  const baseTotal =
    activitiesTotal +
    previousRestaurantsTotal +
    previousStaysTotal +
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

  const toggleActivity = (activity: Activity) => {
    setSelectedActivities((current) => {
      const exists = current.some((item) => item.id === activity.id);

      if (exists) {
        return current.filter((item) => item.id !== activity.id);
      }

      const activityToStore: Activity = {
        ...activity,
        link: getActivityBookingPath(trip, activity),
        pricePerPerson: Number(activity.pricePerPerson || 0),
        description:
          activity.description || generateActivityDescription(activity, activeFilters),
      };

      return [...current, activityToStore];
    });
  };

  const goNext = () => {
    if (!trip || !canContinue) return;

    const selectedActivitiesWithLinks = selectedActivities.map((activity) => ({
      ...activity,
      link: getActivityBookingPath(trip, activity),
    }));

    const nextSelection: TripSelection = {
      ...trip,
      budget,
      selections: {
        activities: selectedActivitiesWithLinks,
        restaurants: trip.selections?.restaurants || [],
        stays: trip.selections?.stays || [],
      },
      totals: {
        activities: activitiesTotal,
        restaurants: previousRestaurantsTotal,
        stays: previousStaysTotal,
        transport: previousTransportTotal,
        overall: baseTotal,
      },
    };

    localStorage.setItem('gt_selection', JSON.stringify(nextSelection));
    localStorage.setItem(
      'gt_activity_filters',
      JSON.stringify({
        filters: activeFilters,
        selectedIds,
      })
    );

    router.push('/trip/restaurants');
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
    ...filteredActivities.map((activity) => ({
      name: activity.name,
      lat: Number(activity.lat),
      lng: Number(activity.lng),
    })),
  ].filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng));

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
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
        </div>

        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
            Étape 1 / 5
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold">
            Choisissez vos activités
          </h1>

          <p className="mt-2 text-slate-600">
            {trip.destination.city}, {trip.destination.country} • {persons}{' '}
            personne(s) • {trip.duration} jour(s)
            {budget ? <> • budget {formatEuro(budget)}</> : null}
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-bold">Vos envies d’activités</h2>

          <div className="flex flex-wrap gap-2">
            {ACTIVITY_FILTERS.map((filter) => {
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
            Le bouton “Réserver sur GetYourGuide” ouvre une recherche liée au nom
            de l’activité, à la ville et au pays, avec votre identifiant partenaire.
          </p>
        </section>

        {loading && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des activités autour de {trip.destination.city}...
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            {filteredActivities.length === 0 && !loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                <h2 className="text-xl font-bold">Aucune activité trouvée</h2>
                <p className="mt-2 text-slate-600">
                  Essaie de retirer certains filtres.
                </p>
              </div>
            ) : (
              filteredActivities.map((activity) => {
                const selected = selectedIds.includes(activity.id);
                const total = Number(activity.pricePerPerson || 0) * persons;
                const readableTypes = getReadableTypes(activity);
                const isFree = isActuallyFreeActivity(activity);
                const activityGetYourGuideLink = getActivityBookingPath(
                  trip,
                  activity
                );

                return (
                  <article
                    key={activity.id}
                    className={`rounded-2xl border p-5 transition ${
                      selected
                        ? 'border-teal-600 bg-teal-50'
                        : 'border-slate-200 bg-white hover:border-teal-500'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold">{activity.name}</h2>

                          {selected && (
                            <span className="rounded-full bg-teal-700 px-2 py-1 text-xs font-semibold text-white">
                              Sélectionnée
                            </span>
                          )}

                          {activity.source && (
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                              {activity.source}
                            </span>
                          )}

                          {isFree && (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                              Gratuit estimé
                            </span>
                          )}
                        </div>

                        {activity.rating && (
                          <div className="mb-2 flex items-center gap-1 text-sm text-amber-700">
                            <Star className="h-4 w-4 fill-current" />
                            <span>
                              {activity.rating} / 5 ({activity.userRatingCount || 0}{' '}
                              avis)
                            </span>
                          </div>
                        )}

                        {activity.address && (
                          <div className="mb-3 flex items-start gap-2 text-sm text-slate-500">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{activity.address}</span>
                          </div>
                        )}

                        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Info className="h-4 w-4 text-slate-500" />
                            Pourquoi cette activité ?
                          </div>

                          <p className="text-sm text-slate-600">
                            {activity.description ||
                              generateActivityDescription(activity, activeFilters)}
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

                        {activity.durationLabel && (
                          <p className="mt-3 text-xs text-slate-500">
                            Durée estimée : {activity.durationLabel}
                          </p>
                        )}

                        {activity.openingHoursSummary && (
                          <p className="mt-2 text-xs text-slate-500">
                            Horaires : {activity.openingHoursSummary}
                          </p>
                        )}

                        <p className="mt-3 text-xs text-slate-500">
                          Prix estimatif ou partenaire, à confirmer sur le site de
                          réservation.
                        </p>
                      </div>

                      <div className="md:w-52 md:text-right">
                        <div className="text-2xl font-extrabold">
                          {formatSimpleEuro(total)}
                        </div>

                        <div className="text-xs text-slate-500">
                          {formatSimpleEuro(activity.pricePerPerson || 0)} / personne
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleActivity(activity)}
                          className={`mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold ${
                            selected
                              ? 'bg-teal-700 text-white hover:bg-teal-800'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {selected ? 'Retirer' : 'Sélectionner'}
                        </button>

                        <a
                          href={activityGetYourGuideLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block rounded-xl border border-teal-200 px-4 py-2 text-center text-xs font-semibold text-teal-700 hover:bg-teal-50"
                        >
                          Réserver sur GetYourGuide
                        </a>

                        {activity.googleMapsUri && (
                          <a
                            href={activity.googleMapsUri}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block text-xs text-slate-500 underline"
                          >
                            Voir sur Google Maps
                          </a>
                        )}
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
                  <span>Activités choisies</span>
                  <span className="font-semibold text-slate-900">
                    {selectedActivities.length}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Activités</span>
                  <span className="font-semibold text-slate-900">
                    {formatSimpleEuro(activitiesTotal)}
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

              <div className="flex items-end justify-between gap-4">
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
                      onChange={(event) =>
                        setAcceptBudgetOverrun(event.target.checked)
                      }
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
                    : 'cursor-not-allowed bg-slate-200 text-slate-500'
                }`}
              >
                Continuer vers les restaurants
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