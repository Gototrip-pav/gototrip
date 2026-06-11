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
  Utensils,
  Flame,
  Gem,
  Users,
  Heart,
  Leaf,
  Coffee,
  Waves,
  Wallet,
  Wine,
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

type Restaurant = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  rating?: number | null;
  userRatingCount?: number;
  pricePerPerson: number;
  link?: string;
  googleMapsUri?: string;
  type?: string;
  types?: string[];
  isReal?: boolean;
  description?: string;
};

type TripSelection = {
  destination: Destination;
  departureCity?: string;
  persons: number;
  duration: number;
  nights: number;
  budget?: number | null;
  selections?: {
    activities?: any[];
    restaurants?: Restaurant[];
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

type RestaurantFilter = {
  id: string;
  label: string;
  icon: React.ReactNode;
  keywords: string[];
};

const RESTAURANT_FILTERS: RestaurantFilter[] = [
  {
    id: 'local',
    label: 'Local',
    icon: <Utensils className="h-4 w-4" />,
    keywords: ['restaurant', 'taverna', 'taverne', 'traditional', 'local', 'greek', 'cuisine'],
  },
  {
    id: 'fastfood',
    label: 'Fast-food',
    icon: <Flame className="h-4 w-4" />,
    keywords: ['fast food', 'burger', 'pizza', 'sandwich', 'snack', 'kebab', 'takeaway'],
  },
  {
    id: 'gastronomic',
    label: 'Gastronomique',
    icon: <Gem className="h-4 w-4" />,
    keywords: ['fine dining', 'gourmet', 'gastronomic', 'restaurant', 'chef', 'luxury'],
  },
  {
    id: 'family',
    label: 'Familial',
    icon: <Users className="h-4 w-4" />,
    keywords: ['family', 'familial', 'restaurant', 'casual', 'taverna', 'pizza'],
  },
  {
    id: 'romantic',
    label: 'Romantique',
    icon: <Heart className="h-4 w-4" />,
    keywords: ['romantic', 'view', 'sea', 'wine', 'restaurant', 'terrace'],
  },
  {
    id: 'vegetarian',
    label: 'Végétarien',
    icon: <Leaf className="h-4 w-4" />,
    keywords: ['vegetarian', 'vegan', 'healthy', 'salad', 'organic'],
  },
  {
    id: 'brunch',
    label: 'Brunch',
    icon: <Coffee className="h-4 w-4" />,
    keywords: ['brunch', 'breakfast', 'coffee', 'cafe', 'bakery'],
  },
  {
    id: 'seaview',
    label: 'Vue mer',
    icon: <Waves className="h-4 w-4" />,
    keywords: ['sea', 'beach', 'harbor', 'port', 'view', 'waterfront', 'marina'],
  },
  {
    id: 'cheap',
    label: 'Pas cher',
    icon: <Wallet className="h-4 w-4" />,
    keywords: ['cheap', 'snack', 'fast food', 'street food', 'taverna', 'casual'],
  },
  {
    id: 'bar',
    label: 'Bar / tapas',
    icon: <Wine className="h-4 w-4" />,
    keywords: ['bar', 'tapas', 'wine', 'cocktail', 'pub', 'meze'],
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

function restaurantMatchesFilters(restaurant: Restaurant, filters: string[]) {
  if (filters.length === 0) return true;

  const selectedFilters = RESTAURANT_FILTERS.filter((f) => filters.includes(f.id));

  const haystack = normalizeText(
    [
      restaurant.name,
      restaurant.address,
      restaurant.type,
      ...(restaurant.types || []),
    ].join(' ')
  );

  return selectedFilters.some((filter) =>
    filter.keywords.some((keyword) => haystack.includes(normalizeText(keyword)))
  );
}

function estimateRestaurantPrice(restaurant: Restaurant, activeFilters: string[]) {
  const haystack = normalizeText(
    [restaurant.name, restaurant.type, ...(restaurant.types || [])].join(' ')
  );

  if (activeFilters.includes('cheap')) return 15;
  if (activeFilters.includes('fastfood')) return 12;
  if (activeFilters.includes('gastronomic')) return 55;
  if (activeFilters.includes('romantic')) return 38;
  if (activeFilters.includes('seaview')) return 35;
  if (activeFilters.includes('brunch')) return 22;
  if (activeFilters.includes('bar')) return 25;

  if (haystack.includes('fast food')) return 12;
  if (haystack.includes('cafe') || haystack.includes('coffee')) return 18;
  if (haystack.includes('bar')) return 25;
  if (haystack.includes('restaurant')) return restaurant.pricePerPerson || 25;

  return restaurant.pricePerPerson || 25;
}

function getReadableTypes(restaurant: Restaurant) {
  const types = restaurant.types || [];

  return types
    .slice(0, 4)
    .map((type) =>
      type
        .replaceAll('_', ' ')
        .replace('restaurant', 'restaurant')
        .replace('food', 'restauration')
        .replace('point of interest', 'lieu d’intérêt')
        .replace('establishment', 'établissement')
        .replace('bar', 'bar')
        .replace('cafe', 'café')
    );
}

function generateRestaurantDescription(
  restaurant: Restaurant,
  activeFilters: string[]
) {
  const haystack = normalizeText(
    [restaurant.name, restaurant.address, restaurant.type, ...(restaurant.types || [])].join(' ')
  );

  const ratingText = restaurant.rating
    ? ` Il est noté ${restaurant.rating}/5 par les visiteurs.`
    : '';

  if (activeFilters.includes('gastronomic')) {
    return `Une adresse plutôt haut de gamme, adaptée à un repas plus soigné ou à une soirée spéciale.${ratingText}`;
  }

  if (activeFilters.includes('fastfood')) {
    return `Une option simple et rapide, pratique pour manger sans perdre trop de temps dans le planning.${ratingText}`;
  }

  if (activeFilters.includes('cheap')) {
    return `Une adresse intéressante pour maîtriser le budget tout en gardant une option pratique sur place.${ratingText}`;
  }

  if (activeFilters.includes('romantic')) {
    return `Un restaurant adapté à un moment plus calme ou à un dîner à deux pendant le séjour.${ratingText}`;
  }

  if (activeFilters.includes('family')) {
    return `Une option facile à intégrer dans un voyage en famille, avec un cadre généralement plus simple et accessible.${ratingText}`;
  }

  if (activeFilters.includes('vegetarian')) {
    return `Une adresse intéressante si vous souhaitez privilégier une cuisine végétarienne, saine ou plus légère.${ratingText}`;
  }

  if (activeFilters.includes('brunch')) {
    return `Une bonne option pour un petit-déjeuner tardif, un brunch ou une pause café pendant la journée.${ratingText}`;
  }

  if (activeFilters.includes('seaview')) {
    return `Une adresse à privilégier pour profiter du cadre, notamment si vous cherchez une ambiance proche de la mer ou du port.${ratingText}`;
  }

  if (activeFilters.includes('bar')) {
    return `Une option adaptée pour un verre, des tapas ou une soirée plus détendue.${ratingText}`;
  }

  if (
    haystack.includes('taverna') ||
    haystack.includes('traditional') ||
    haystack.includes('greek')
  ) {
    return `Une adresse locale intéressante pour découvrir la cuisine traditionnelle de la destination.${ratingText}`;
  }

  if (haystack.includes('cafe') || haystack.includes('coffee')) {
    return `Une adresse pratique pour une pause café, un petit-déjeuner ou un repas léger.${ratingText}`;
  }

  if (haystack.includes('bar')) {
    return `Une adresse plutôt orientée boisson, apéritif ou ambiance de soirée.${ratingText}`;
  }

  return `Un restaurant proposé selon vos critères, à intégrer dans votre séjour selon votre budget et vos envies.${ratingText}`;
}

export default function RestaurantsPage() {
  const router = useRouter();

  const [trip, setTrip] = useState<TripSelection | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [budget, setBudget] = useState<number | null>(null);
  const [acceptBudgetOverrun, setAcceptBudgetOverrun] = useState(false);

  useEffect(() => {
    const rawSelection = localStorage.getItem('gt_selection');
    const rawCriteria = localStorage.getItem('gt_criteria');
    const rawFilters = localStorage.getItem('gt_restaurant_filters');

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

    const previousRestaurants = parsedSelection.selections?.restaurants || [];
    setSelectedIds(previousRestaurants.map((r) => r.id));

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

    async function loadRestaurants() {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams({
          lat: String(trip.destination.lat),
          lng: String(trip.destination.lng),
          city: trip.destination.city,
          type: 'restaurants',
        });

        const res = await fetch(`/api/places?${params.toString()}`, {
          cache: 'no-store',
        });

        const json = await res.json();

        if (!res.ok) {
          const message =
            json?.details?.error?.message ||
            json?.details?.message ||
            json?.error ||
            'Erreur chargement restaurants';

          throw new Error(message);
        }

        const places = Array.isArray(json.places) ? json.places : [];

        const mapped: Restaurant[] = places.map((p: any) => ({
          id: p.id,
          name: p.name,
          address: p.address || '',
          lat: Number(p.lat),
          lng: Number(p.lng),
          rating: p.rating || null,
          userRatingCount: p.userRatingCount || 0,
          pricePerPerson: Number(p.pricePerPerson || 25),
          link: p.link || p.googleMapsUri || '#',
          googleMapsUri: p.googleMapsUri || '',
          type: p.type || '',
          types: p.types || [],
          isReal: true,
        }));

        setRestaurants(mapped);
      } catch (e: any) {
        setError(e?.message || 'Impossible de charger les restaurants.');
      } finally {
        setLoading(false);
      }
    }

    loadRestaurants();
  }, [trip]);

  const filteredRestaurants = useMemo(() => {
    return restaurants
      .map((restaurant) => ({
        ...restaurant,
        pricePerPerson: estimateRestaurantPrice(restaurant, activeFilters),
        description: generateRestaurantDescription(restaurant, activeFilters),
      }))
      .filter((restaurant) =>
        restaurantMatchesFilters(restaurant, activeFilters)
      );
  }, [restaurants, activeFilters]);

  const selectedRestaurants = useMemo(() => {
    return restaurants
      .filter((restaurant) => selectedIds.includes(restaurant.id))
      .map((restaurant) => ({
        ...restaurant,
        pricePerPerson: estimateRestaurantPrice(restaurant, activeFilters),
        description: generateRestaurantDescription(restaurant, activeFilters),
      }));
  }, [restaurants, selectedIds, activeFilters]);

  const persons = trip?.persons || 1;

  const restaurantsTotal = useMemo(() => {
    return selectedRestaurants.reduce(
      (sum, restaurant) => sum + Number(restaurant.pricePerPerson || 0) * persons,
      0
    );
  }, [selectedRestaurants, persons]);

  const previousActivitiesTotal = trip?.totals?.activities || 0;
  const previousStaysTotal = trip?.totals?.stays || 0;
  const baseTotal = previousActivitiesTotal + restaurantsTotal + previousStaysTotal;

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

  const toggleRestaurant = (restaurantId: string) => {
    setSelectedIds((current) =>
      current.includes(restaurantId)
        ? current.filter((id) => id !== restaurantId)
        : [...current, restaurantId]
    );
  };

  const goNext = () => {
    if (!trip || !canContinue) return;

    const nextSelection: TripSelection = {
      ...trip,
      budget,
      selections: {
        activities: trip.selections?.activities || [],
        restaurants: selectedRestaurants,
        stays: trip.selections?.stays || [],
      },
      totals: {
        activities: previousActivitiesTotal,
        restaurants: restaurantsTotal,
        stays: previousStaysTotal,
        transport: trip.totals?.transport || 0,
        overall: previousActivitiesTotal + restaurantsTotal + previousStaysTotal,
      },
    };

    localStorage.setItem('gt_selection', JSON.stringify(nextSelection));
    localStorage.setItem(
      'gt_restaurant_filters',
      JSON.stringify({
        filters: activeFilters,
        selectedIds,
      })
    );

    router.push('/trip/stays');
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
    ...filteredRestaurants.map((restaurant) => ({
      name: restaurant.name,
      lat: Number(restaurant.lat),
      lng: Number(restaurant.lng),
    })),
  ].filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

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
            Étape 2 / 5
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold">
            Choisissez vos restaurants
          </h1>

          <p className="mt-2 text-slate-600">
            {trip.destination.city}, {trip.destination.country} • {persons}{' '}
            personne(s) • {trip.duration} jour(s)
            {budget ? <> • budget {formatEuro(budget)}</> : null}
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-bold">Vos envies de restaurants</h2>

          <div className="flex flex-wrap gap-2">
            {RESTAURANT_FILTERS.map((filter) => {
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
            Les filtres servent à prioriser les restaurants Google Places selon vos envies.
          </p>
        </section>

        {loading && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des restaurants autour de {trip.destination.city}...
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-4">
            {filteredRestaurants.length === 0 && !loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                <h2 className="text-xl font-bold">Aucun restaurant trouvé</h2>
                <p className="mt-2 text-slate-600">
                  Essaie de retirer certains filtres.
                </p>
              </div>
            ) : (
              filteredRestaurants.map((restaurant) => {
                const selected = selectedIds.includes(restaurant.id);
                const total = Number(restaurant.pricePerPerson || 0) * persons;
                const readableTypes = getReadableTypes(restaurant);

                return (
                  <article
                    key={restaurant.id}
                    className={`rounded-2xl border p-5 transition ${
                      selected
                        ? 'border-teal-600 bg-teal-50'
                        : 'border-slate-200 bg-white hover:border-teal-500'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold">{restaurant.name}</h2>

                          {selected && (
                            <span className="rounded-full bg-teal-700 px-2 py-1 text-xs font-semibold text-white">
                              Sélectionné
                            </span>
                          )}

                          {restaurant.isReal && (
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                              Google Places
                            </span>
                          )}
                        </div>

                        {restaurant.rating && (
                          <div className="mb-2 flex items-center gap-1 text-sm text-amber-700">
                            <Star className="h-4 w-4 fill-current" />
                            <span>
                              {restaurant.rating} / 5 ({restaurant.userRatingCount || 0} avis)
                            </span>
                          </div>
                        )}

                        {restaurant.address && (
                          <div className="mb-3 flex items-start gap-2 text-sm text-slate-500">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{restaurant.address}</span>
                          </div>
                        )}

                        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Info className="h-4 w-4 text-slate-500" />
                            Pourquoi ce restaurant ?
                          </div>

                          <p className="text-sm text-slate-600">
                            {restaurant.description ||
                              generateRestaurantDescription(restaurant, activeFilters)}
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
                          Prix estimatif Gototrip, à confirmer sur le site partenaire.
                        </p>
                      </div>

                      <div className="md:w-48 md:text-right">
                        <div className="text-2xl font-extrabold">
                          {formatSimpleEuro(total)}
                        </div>

                        <div className="text-xs text-slate-500">
                          {formatSimpleEuro(restaurant.pricePerPerson || 0)} / personne
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleRestaurant(restaurant.id)}
                          className={`mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold ${
                            selected
                              ? 'bg-teal-700 text-white hover:bg-teal-800'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {selected ? 'Retirer' : 'Sélectionner'}
                        </button>

                        <a
                          href={restaurant.link || restaurant.googleMapsUri || '#'}
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
                  <span>Activités</span>
                  <span className="font-semibold text-slate-900">
                    {formatSimpleEuro(previousActivitiesTotal)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Restaurants choisis</span>
                  <span className="font-semibold text-slate-900">
                    {selectedRestaurants.length}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Restaurants</span>
                  <span className="font-semibold text-slate-900">
                    {formatSimpleEuro(restaurantsTotal)}
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
                      <span className="font-semibold">{formatEuro(budgetOverrun)}</span>
                    </div>
                  </div>

                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-white p-3 text-sm text-red-900">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={acceptBudgetOverrun}
                      onChange={(e) => setAcceptBudgetOverrun(e.target.checked)}
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
                Continuer vers l’hébergement
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