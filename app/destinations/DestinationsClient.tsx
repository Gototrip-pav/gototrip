'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  Home,
  Loader2,
  MapPin,
  Plane,
  Train,
  Car,
  Bus,
  Hotel,
  Utensils,
  Ticket,
  Wallet,
  Star,
  AlertTriangle,
  CheckCircle2,
  Info,
  Route,
  TramFront,
  Sparkles,
} from 'lucide-react';

type ApiDestination = {
  slug: string;
  city: string;
  country: string;
  address?: string;
  lat: number;
  lng: number;
  weather?: string;
  rating?: number | null;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
  googleMapsUri?: string;
  source?: string;
  destinationStyle?: string;
  destinationStyleLabel?: string;
};

type TransportId = 'car' | 'bus' | 'train' | 'plane';

type TransportEstimate = {
  id: TransportId;
  label: string;
  total: number;
  pricePerPerson: number;
  duration: string;
  source: string;
  possible: boolean;
};

type LocalMobilityEstimate = {
  mode: 'included-car' | 'public-transport' | 'rental-car';
  title: string;
  total: number;
  details: string;
};

type DestinationRecommendation = {
  slug: string;
  city: string;
  country: string;
  address?: string;
  weather?: string;
  lat: number;
  lng: number;
  rating?: number | null;
  userRatingCount?: number;
  googleMapsUri?: string;
  source?: string;
  destinationStyle?: string;
  destinationStyleLabel?: string;
  score: number;
  scoreLabel: string;
  reasons: string[];
  warnings: string[];
  totalEstimate: number;
  budgetStatus: 'under' | 'over' | 'unknown';
  budgetDifference: number;
  bestTransport: TransportEstimate;
  localMobility: LocalMobilityEstimate;
  activitiesEstimate: number;
  restaurantsEstimate: number;
  staysEstimate: number;
  activitiesCount: number;
  restaurantsCount: number;
  staysCount: number;
  distanceKm: number;
  loading?: boolean;
};

type Criteria = {
  departureCity: string;
  persons: number;
  duration: number;
  nights: number;
  start: string;
  budget: number | null;
  lodging: string;
  environment: string;
  destinationStyle: string;
};

type Coords = {
  lat: number;
  lng: number;
};

function formatEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const earthRadiusKm = 6371;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusKm * c);
}

function formatDurationFromHours(hours: number) {
  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h}h`;

  return `${h}h${String(m).padStart(2, '0')}`;
}

function getFirstQueryValue(searchParams: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = searchParams.get(name);
    if (value) return value;
  }

  return '';
}

function getCriteria(searchParams: URLSearchParams): Criteria {
  const persons = Math.max(1, Number(searchParams.get('persons') || 1));
  const duration = Math.max(1, Number(searchParams.get('duration') || 3));
  const nights = Math.max(1, duration - 1);

  const rawBudget = Number(searchParams.get('budget') || 0);
  const budget = Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : null;

  return {
    departureCity:
      getFirstQueryValue(searchParams, ['departure', 'departureCity', 'from']) ||
      '',
    persons,
    duration,
    nights,
    start: searchParams.get('start') || '',
    budget,
    lodging: getFirstQueryValue(searchParams, ['lodging', 'stay', 'hotel']) || '',
    environment:
      getFirstQueryValue(searchParams, ['environment', 'env', 'ambiance']) || '',
    destinationStyle:
      getFirstQueryValue(searchParams, ['destinationStyle', 'style']) ||
      'surprising',
  };
}

function getDestinationStyleText(style: string) {
  const normalized = normalizeText(style);

  const labels: string[] = [];

  if (normalized.includes('classic')) labels.push('Classique');
  if (normalized.includes('surprising')) labels.push('Étonnante');
  if (normalized.includes('offbeat')) labels.push('Décalée');

  if (labels.length === 0) return 'Étonnante';

  return labels.join(' + ');
}

function isIslandOrSeaDestination(
  destinationCity?: string,
  destinationCountry?: string
) {
  const text = normalizeText(`${destinationCity || ''} ${destinationCountry || ''}`);

  const islandKeywords = [
    'crete',
    'canee',
    'chania',
    'majorque',
    'mallorca',
    'palma',
    'ibiza',
    'corse',
    'corsica',
    'sardaigne',
    'sardinia',
    'sicile',
    'sicily',
    'malte',
    'malta',
    'madere',
    'madeira',
    'tenerife',
    'canaries',
    'canary',
    'azores',
    'acores',
    'island',
    'ile',
    'iles',
  ];

  return islandKeywords.some((keyword) => text.includes(normalizeText(keyword)));
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
    'faro',
    'new york',
    'montreal',
    'montréal',
    'londres',
    'london',
    'tokyo',
    'singapour',
    'singapore',
    'dubai',
    'dubaï',
  ];

  return compactCities.some((item) => text.includes(item));
}

function shouldRecommendRentalCar({
  city,
  transportId,
  activitiesCount,
  restaurantsCount,
  staysCount,
}: {
  city: string;
  transportId: TransportId;
  activitiesCount: number;
  restaurantsCount: number;
  staysCount: number;
}) {
  if (transportId === 'car') return false;

  const destination = normalizeText(city);
  const totalPlaces = activitiesCount + restaurantsCount + staysCount;

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
    'amalfi',
    'azores',
    'acores',
    'açores',
  ];

  if (extendedDestinations.some((item) => destination.includes(item))) {
    return true;
  }

  if (totalPlaces >= 8 && !isCompactCity(city)) {
    return true;
  }

  return false;
}

function estimateLocalMobility({
  city,
  persons,
  duration,
  transportId,
  activitiesCount,
  restaurantsCount,
  staysCount,
}: {
  city: string;
  persons: number;
  duration: number;
  transportId: TransportId;
  activitiesCount: number;
  restaurantsCount: number;
  staysCount: number;
}): LocalMobilityEstimate {
  if (transportId === 'car') {
    const dailyParkingFuel = 15;
    const total = dailyParkingFuel * duration;

    return {
      mode: 'included-car',
      title: 'Voiture déjà prévue',
      total,
      details: `${dailyParkingFuel}€ / jour × ${duration} jour(s)`,
    };
  }

  const rentalRecommended = shouldRecommendRentalCar({
    city,
    transportId,
    activitiesCount,
    restaurantsCount,
    staysCount,
  });

  if (rentalRecommended) {
    const rentalPerDay = 45;
    const fuelPerDay = 12;
    const total = (rentalPerDay + fuelPerDay) * duration;

    return {
      mode: 'rental-car',
      title: 'Location voiture conseillée',
      total,
      details: `${rentalPerDay}€ location + ${fuelPerDay}€ carburant / jour`,
    };
  }

  const ticketPerPersonPerDay = 8;
  const total = ticketPerPersonPerDay * persons * duration;

  return {
    mode: 'public-transport',
    title: 'Transports locaux',
    total,
    details: `${ticketPerPersonPerDay}€ / personne / jour`,
  };
}

function isLongHaulDestination(city: string, country: string) {
  const text = normalizeText(`${city} ${country}`);

  const longHaulKeywords = [
    'new york',
    'etats-unis',
    'canada',
    'montreal',
    'montréal',
    'dubai',
    'dubaï',
    'emirats',
    'tokyo',
    'japon',
    'singapour',
    'singapore',
    'oman',
    'georgie',
  ];

  return longHaulKeywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function estimatePlaneDuration(distanceKm: number) {
  if (distanceKm <= 300) return '≈ 1h à 2h';
  if (distanceKm <= 900) return '≈ 2h à 3h';
  if (distanceKm <= 1800) return '≈ 2h à 5h';
  if (distanceKm <= 5000) return '≈ 5h à 9h';
  return '≈ 8h à 14h';
}

function estimateTrainDuration(distanceKm: number) {
  const hours = Math.max(1, distanceKm / 90);
  const min = formatDurationFromHours(hours * 0.85);
  const max = formatDurationFromHours(hours * 1.25);

  return `≈ ${min} à ${max}`;
}

function estimateBusDuration(distanceKm: number) {
  const hours = Math.max(1, distanceKm / 65);
  const min = formatDurationFromHours(hours * 0.95);
  const max = formatDurationFromHours(hours * 1.35);

  return `≈ ${min} à ${max}`;
}

function estimateCarDuration(distanceKm: number) {
  const hours = Math.max(1, distanceKm / 75);
  return formatDurationFromHours(hours);
}

function estimatePlanePrice(distanceKm: number, persons: number) {
  let pricePerPerson = Math.max(90, Math.round(distanceKm * 0.045));

  if (distanceKm > 2500) {
    pricePerPerson = Math.max(450, Math.round(distanceKm * 0.09));
  }

  if (distanceKm > 7000) {
    pricePerPerson = Math.max(750, Math.round(distanceKm * 0.11));
  }

  return {
    pricePerPerson,
    total: pricePerPerson * persons,
  };
}

function estimateTrainPrice(distanceKm: number, persons: number) {
  const pricePerPerson = Math.max(20, Math.round(distanceKm * 0.22));

  return {
    pricePerPerson,
    total: pricePerPerson * persons,
  };
}

function estimateBusPrice(distanceKm: number, persons: number) {
  const pricePerPerson = Math.max(12, Math.round(distanceKm * 0.12));

  return {
    pricePerPerson,
    total: pricePerPerson * persons,
  };
}

function estimateCarPrice(distanceKm: number, persons: number) {
  const total = Math.max(30, Math.round(distanceKm * 1.7));

  return {
    pricePerPerson: Math.round(total / persons),
    total,
  };
}

function buildTransportEstimates({
  distanceKm,
  persons,
  destinationCity,
  destinationCountry,
}: {
  distanceKm: number;
  persons: number;
  destinationCity: string;
  destinationCountry: string;
}) {
  const distance = Math.max(1, Number(distanceKm || 0));
  const islandOrSea = isIslandOrSeaDestination(destinationCity, destinationCountry);
  const longHaul = isLongHaulDestination(destinationCity, destinationCountry);

  const planeEstimate = estimatePlanePrice(distance, persons);
  const trainEstimate = estimateTrainPrice(distance, persons);
  const busEstimate = estimateBusPrice(distance, persons);
  const carEstimate = estimateCarPrice(distance, persons);

  const trainPossible = !islandOrSea && !longHaul && distance <= 1000;
  const busPossible = !islandOrSea && !longHaul && distance <= 900;
  const carPossible = !islandOrSea && !longHaul && distance <= 1200;

  const estimates: TransportEstimate[] = [
    {
      id: 'plane',
      label: 'Avion',
      total: planeEstimate.total,
      pricePerPerson: planeEstimate.pricePerPerson,
      duration: estimatePlaneDuration(distance),
      source: 'Estimation distance',
      possible: true,
    },
    {
      id: 'train',
      label: 'Train',
      total: trainEstimate.total,
      pricePerPerson: trainEstimate.pricePerPerson,
      duration: estimateTrainDuration(distance),
      source: 'Estimation distance',
      possible: trainPossible,
    },
    {
      id: 'bus',
      label: 'Bus',
      total: busEstimate.total,
      pricePerPerson: busEstimate.pricePerPerson,
      duration: estimateBusDuration(distance),
      source: 'Estimation distance',
      possible: busPossible,
    },
    {
      id: 'car',
      label: 'Voiture',
      total: carEstimate.total,
      pricePerPerson: carEstimate.pricePerPerson,
      duration: estimateCarDuration(distance),
      source: 'Estimation distance',
      possible: carPossible,
    },
  ];

  const possibleEstimates = estimates.filter((estimate) => estimate.possible);

  if (possibleEstimates.length === 0) {
    return estimates[0];
  }

  return possibleEstimates.sort((a, b) => a.total - b.total)[0];
}

async function geocodeDepartureCity(city: string) {
  if (!city) return null;

  try {
    const res = await fetch(`/api/geocode?city=${encodeURIComponent(city)}`, {
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const json = await res.json();
    const lat = Number(json.lat);
    const lng = Number(json.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return {
      lat,
      lng,
      name: json.name || city,
    };
  } catch {
    return null;
  }
}

function getBaseMatchScore(destination: ApiDestination, criteria: Criteria) {
  let score = 45;
  const reasons: string[] = [];

  const environment = normalizeText(criteria.environment);
  const lodging = normalizeText(criteria.lodging);

  if (environment.includes('mer')) {
    score += 18;
    reasons.push('Destination trouvée via une recherche orientée mer / vacances.');
  }

  if (environment.includes('montagne')) {
    score += 18;
    reasons.push('Destination trouvée via une recherche orientée montagne.');
  }

  if (environment.includes('ville')) {
    score += 14;
    reasons.push('Destination adaptée à une recherche de city break.');
  }

  if (environment.includes('nature')) {
    score += 14;
    reasons.push('Destination compatible avec une envie de nature.');
  }

  if (environment.includes('campagne')) {
    score += 12;
    reasons.push('Destination compatible avec une envie de campagne.');
  }

  if (lodging) {
    score += 4;
    reasons.push('Type d’hébergement souhaité pris en compte.');
  }

  if (criteria.departureCity) {
    score += 4;
    reasons.push(`Départ pris en compte depuis ${criteria.departureCity}.`);
  }

  if (destination.destinationStyleLabel) {
    score += 6;
    reasons.push(`Style demandé : ${destination.destinationStyleLabel}.`);
  }

  if (destination.rating && destination.rating >= 4) {
    score += 5;
    reasons.push(`Destination bien notée sur Google (${destination.rating}/5).`);
  }

  return {
    score,
    reasons,
  };
}

async function fetchApiDestinations(criteria: Criteria) {
  const params = new URLSearchParams();

  if (criteria.environment) params.set('environment', criteria.environment);
  if (criteria.lodging) params.set('lodging', criteria.lodging);
  if (criteria.budget) params.set('budget', String(criteria.budget));
  if (criteria.destinationStyle) {
    params.set('destinationStyle', criteria.destinationStyle);
  }

  params.set('persons', String(criteria.persons));
  params.set('duration', String(criteria.duration));

  const res = await fetch(`/api/destination-candidates?${params.toString()}`, {
    cache: 'no-store',
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error || 'Erreur récupération destinations API.');
  }

  return Array.isArray(json.destinations) ? json.destinations : [];
}

async function fetchPlacesSummary(destination: ApiDestination, criteria: Criteria) {
  const common = {
    lat: String(destination.lat),
    lng: String(destination.lng),
    city: destination.city,
  };

  const activitiesParams = new URLSearchParams({
    ...common,
    type: 'activities',
  });

  const restaurantsParams = new URLSearchParams({
    ...common,
    type: 'restaurants',
  });

  const staysParams = new URLSearchParams({
    ...common,
    type: 'stays',
  });

  if (criteria.lodging) {
    staysParams.set('lodging', criteria.lodging);
  }

  const [activitiesRes, restaurantsRes, staysRes] = await Promise.allSettled([
    fetch(`/api/places?${activitiesParams.toString()}`, { cache: 'no-store' }),
    fetch(`/api/places?${restaurantsParams.toString()}`, { cache: 'no-store' }),
    fetch(`/api/places?${staysParams.toString()}`, { cache: 'no-store' }),
  ]);

  async function extractPlaces(result: PromiseSettledResult<Response>) {
    if (result.status !== 'fulfilled') return [];

    try {
      const json = await result.value.json();
      if (!result.value.ok) return [];
      return Array.isArray(json.places) ? json.places : [];
    } catch {
      return [];
    }
  }

  const activities = await extractPlaces(activitiesRes);
  const restaurants = await extractPlaces(restaurantsRes);
  const stays = await extractPlaces(staysRes);

  const persons = criteria.persons;
  const nights = criteria.nights;

  const activitiesEstimate =
    activities.slice(0, 2).reduce((sum: number, item: any) => {
      return sum + Number(item.pricePerPerson || 25) * persons;
    }, 0) || 50 * persons;

  const restaurantsEstimate =
    restaurants
      .slice(0, Math.min(criteria.duration, 3))
      .reduce((sum: number, item: any) => {
        return sum + Number(item.pricePerPerson || 25) * persons;
      }, 0) || 25 * persons * Math.min(criteria.duration, 3);

  const staysEstimate =
    stays.slice(0, 1).reduce((sum: number, item: any) => {
      const priceNight = Number(
        item.pricePerNightPerPerson || item.pricePerPerson || 80
      );

      return sum + priceNight * persons * nights;
    }, 0) || 80 * persons * nights;

  return {
    activitiesCount: activities.length,
    restaurantsCount: restaurants.length,
    staysCount: stays.length,
    activitiesEstimate,
    restaurantsEstimate,
    staysEstimate,
  };
}

function getScoreLabel(score: number) {
  if (score >= 85) return 'Très cohérente';
  if (score >= 70) return 'Bonne option';
  if (score >= 55) return 'Possible';
  return 'À vérifier';
}

function getTransportIcon(id: TransportId) {
  if (id === 'plane') return Plane;
  if (id === 'train') return Train;
  if (id === 'bus') return Bus;
  return Car;
}

export default function DestinationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const criteria = useMemo(() => getCriteria(searchParams), [searchParams]);

  const [recommendations, setRecommendations] = useState<DestinationRecommendation[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [departureCoords, setDepartureCoords] = useState<Coords | null>(null);
  const [departureCoordsReady, setDepartureCoordsReady] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      'gt_criteria',
      JSON.stringify({
        departureCity: criteria.departureCity,
        persons: criteria.persons,
        duration: criteria.duration,
        nights: criteria.nights,
        start: criteria.start || null,
        budget: criteria.budget ? String(criteria.budget) : null,
        lodging: criteria.lodging,
        environment: criteria.environment,
        destinationStyle: criteria.destinationStyle,
      })
    );
  }, [criteria]);

  useEffect(() => {
    let cancelled = false;

    async function loadDepartureCoords() {
      setDepartureCoordsReady(false);

      if (!criteria.departureCity) {
        setDepartureCoords(null);
        setDepartureCoordsReady(true);
        return;
      }

      const coords = await geocodeDepartureCity(criteria.departureCity);

      if (cancelled) return;

      if (coords) {
        setDepartureCoords({
          lat: coords.lat,
          lng: coords.lng,
        });
      } else {
        setDepartureCoords(null);
      }

      setDepartureCoordsReady(true);
    }

    loadDepartureCoords();

    return () => {
      cancelled = true;
    };
  }, [criteria.departureCity]);

  useEffect(() => {
    let cancelled = false;

    async function buildRecommendations() {
      if (criteria.departureCity && !departureCoordsReady) {
        return;
      }

      try {
        setLoading(true);
        setApiError('');
        setRecommendations([]);

        const destinations = await fetchApiDestinations(criteria);

        const initialRecommendations: DestinationRecommendation[] = destinations.map(
          (destination: ApiDestination) => {
            const base = getBaseMatchScore(destination, criteria);

            return {
              slug: destination.slug,
              city: destination.city,
              country: destination.country,
              address: destination.address,
              weather: destination.weather,
              lat: destination.lat,
              lng: destination.lng,
              rating: destination.rating,
              userRatingCount: destination.userRatingCount,
              googleMapsUri: destination.googleMapsUri,
              source: destination.source || 'Google Places',
              destinationStyle: destination.destinationStyle,
              destinationStyleLabel: destination.destinationStyleLabel,
              score: base.score,
              scoreLabel: getScoreLabel(base.score),
              reasons: base.reasons,
              warnings: [],
              totalEstimate: 0,
              budgetStatus: 'unknown',
              budgetDifference: 0,
              bestTransport: {
                id: 'bus',
                label: 'Transport',
                total: 0,
                pricePerPerson: 0,
                duration: 'Analyse...',
                source: 'Chargement',
                possible: true,
              },
              localMobility: {
                mode: 'public-transport',
                title: 'Déplacements sur place',
                total: 0,
                details: 'Analyse...',
              },
              activitiesEstimate: 0,
              restaurantsEstimate: 0,
              staysEstimate: 0,
              activitiesCount: 0,
              restaurantsCount: 0,
              staysCount: 0,
              distanceKm: 0,
              loading: true,
            };
          }
        );

        if (!cancelled) {
          setRecommendations(initialRecommendations);
        }

        const enriched = await Promise.all(
          destinations.map(async (destination: ApiDestination) => {
            const base = getBaseMatchScore(destination, criteria);

            try {
              const places = await fetchPlacesSummary(destination, criteria);

              const distanceKm = departureCoords
                ? getDistanceKm(
                    departureCoords.lat,
                    departureCoords.lng,
                    Number(destination.lat),
                    Number(destination.lng)
                  )
                : 300;

              const bestTransport = buildTransportEstimates({
                distanceKm,
                persons: criteria.persons,
                destinationCity: destination.city,
                destinationCountry: destination.country,
              });

              const localMobility = estimateLocalMobility({
                city: destination.city,
                persons: criteria.persons,
                duration: criteria.duration,
                transportId: bestTransport.id,
                activitiesCount: places.activitiesCount,
                restaurantsCount: places.restaurantsCount,
                staysCount: places.staysCount,
              });

              let score = base.score;
              const reasons = [...base.reasons];
              const warnings: string[] = [];

              if (places.activitiesCount >= 5) {
                score += 8;
                reasons.push(`${places.activitiesCount} activités réelles trouvées.`);
              } else if (places.activitiesCount > 0) {
                score += 4;
                reasons.push(`${places.activitiesCount} activité(s) trouvée(s).`);
              } else {
                score -= 8;
                warnings.push('Peu d’activités trouvées via Google Places.');
              }

              if (places.restaurantsCount >= 5) {
                score += 6;
                reasons.push(`${places.restaurantsCount} restaurants réels trouvés.`);
              } else if (places.restaurantsCount === 0) {
                score -= 6;
                warnings.push('Peu de restaurants trouvés via Google Places.');
              }

              if (places.staysCount >= 3) {
                score += 8;
                reasons.push(`${places.staysCount} hébergements trouvés.`);
              } else if (places.staysCount > 0) {
                score += 3;
                reasons.push(`${places.staysCount} hébergement(s) trouvé(s).`);
              } else {
                score -= 10;
                warnings.push('Peu d’hébergements trouvés selon le filtre choisi.');
              }

              if (bestTransport.id === 'car') {
                reasons.push('Voiture estimée comme transport principal le moins cher.');
              }

              if (bestTransport.id === 'train') {
                reasons.push('Train estimé comme transport principal le moins cher.');
              }

              if (bestTransport.id === 'bus') {
                reasons.push('Bus estimé comme transport principal le moins cher.');
              }

              if (bestTransport.id === 'plane') {
                reasons.push('Avion estimé comme transport principal le moins cher possible.');
                warnings.push('Prix avion estimé à confirmer avec une API partenaire.');
              }

              if (localMobility.mode === 'rental-car') {
                warnings.push('Location de voiture conseillée pour les déplacements sur place.');
              } else if (localMobility.mode === 'public-transport') {
                reasons.push('Déplacements locaux estimés avec tickets transports.');
              } else {
                reasons.push('Frais locaux voiture ajoutés au budget.');
              }

              if (isLongHaulDestination(destination.city, destination.country)) {
                if (criteria.duration <= 3) {
                  warnings.push(
                    `Trajet long pour un court séjour de ${criteria.duration} jour(s).`
                  );
                  score -= 8;
                } else {
                  reasons.push('Budget suffisant pour envisager une destination long-courrier.');
                }
              }

              const totalEstimate =
                places.activitiesEstimate +
                places.restaurantsEstimate +
                places.staysEstimate +
                bestTransport.total +
                localMobility.total;

              let budgetStatus: 'under' | 'over' | 'unknown' = 'unknown';
              let budgetDifference = 0;

              if (criteria.budget) {
                budgetDifference = totalEstimate - criteria.budget;

                if (totalEstimate <= criteria.budget) {
                  budgetStatus = 'under';
                  score += 14;
                  reasons.push('Le budget estimé rentre dans votre enveloppe.');
                } else {
                  budgetStatus = 'over';
                  score -= Math.min(20, Math.ceil(budgetDifference / 100) * 3);
                  warnings.push(
                    `Budget dépassé d’environ ${formatEuro(budgetDifference)}.`
                  );
                }
              }

              if (distanceKm <= 300) {
                score += 8;
                reasons.push('Destination proche de la ville de départ.');
              } else if (distanceKm <= 800) {
                score += 4;
                reasons.push('Distance raisonnable depuis le départ.');
              }

              score = Math.max(0, Math.min(100, score));

              return {
                slug: destination.slug,
                city: destination.city,
                country: destination.country,
                address: destination.address,
                weather: destination.weather,
                lat: destination.lat,
                lng: destination.lng,
                rating: destination.rating,
                userRatingCount: destination.userRatingCount,
                googleMapsUri: destination.googleMapsUri,
                source: destination.source || 'Google Places',
                destinationStyle: destination.destinationStyle,
                destinationStyleLabel: destination.destinationStyleLabel,
                score,
                scoreLabel: getScoreLabel(score),
                reasons,
                warnings,
                totalEstimate,
                budgetStatus,
                budgetDifference,
                bestTransport,
                localMobility,
                activitiesEstimate: places.activitiesEstimate,
                restaurantsEstimate: places.restaurantsEstimate,
                staysEstimate: places.staysEstimate,
                activitiesCount: places.activitiesCount,
                restaurantsCount: places.restaurantsCount,
                staysCount: places.staysCount,
                distanceKm,
                loading: false,
              };
            } catch {
              const fallbackDistance = 300;

              const bestTransport = buildTransportEstimates({
                distanceKm: fallbackDistance,
                persons: criteria.persons,
                destinationCity: destination.city,
                destinationCountry: destination.country,
              });

              const fallbackStays = 80 * criteria.persons * criteria.nights;
              const fallbackActivities = 50 * criteria.persons;
              const fallbackRestaurants =
                25 * criteria.persons * Math.min(criteria.duration, 3);

              const localMobility = estimateLocalMobility({
                city: destination.city,
                persons: criteria.persons,
                duration: criteria.duration,
                transportId: bestTransport.id,
                activitiesCount: 0,
                restaurantsCount: 0,
                staysCount: 0,
              });

              const totalEstimate =
                bestTransport.total +
                fallbackStays +
                fallbackActivities +
                fallbackRestaurants +
                localMobility.total;

              const budgetStatus =
                criteria.budget === null
                  ? 'unknown'
                  : totalEstimate <= criteria.budget
                    ? 'under'
                    : 'over';

              const budgetDifference = criteria.budget
                ? totalEstimate - criteria.budget
                : 0;

              return {
                slug: destination.slug,
                city: destination.city,
                country: destination.country,
                address: destination.address,
                weather: destination.weather,
                lat: destination.lat,
                lng: destination.lng,
                rating: destination.rating,
                userRatingCount: destination.userRatingCount,
                googleMapsUri: destination.googleMapsUri,
                source: destination.source || 'Google Places',
                destinationStyle: destination.destinationStyle,
                destinationStyleLabel: destination.destinationStyleLabel,
                score: Math.max(0, base.score - 10),
                scoreLabel: getScoreLabel(Math.max(0, base.score - 10)),
                reasons: base.reasons,
                warnings: ['Données en ligne incomplètes pour cette destination.'],
                totalEstimate,
                budgetStatus,
                budgetDifference,
                bestTransport,
                localMobility,
                activitiesEstimate: fallbackActivities,
                restaurantsEstimate: fallbackRestaurants,
                staysEstimate: fallbackStays,
                activitiesCount: 0,
                restaurantsCount: 0,
                staysCount: 0,
                distanceKm: fallbackDistance,
                loading: false,
              };
            }
          })
        );

        const sorted = enriched.sort((a, b) => b.score - a.score);

        if (!cancelled) {
          setRecommendations(sorted);
        }
      } catch (e: any) {
        if (!cancelled) {
          setApiError(
            e?.message ||
              'Impossible de récupérer les destinations depuis Google Places.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    buildRecommendations();

    return () => {
      cancelled = true;
    };
  }, [criteria, departureCoords, departureCoordsReady]);

  const openDestination = (recommendation: DestinationRecommendation) => {
    const destinationPayload = {
      slug: recommendation.slug,
      header: {
        city: recommendation.city,
        country: recommendation.country,
        lat: recommendation.lat,
        lng: recommendation.lng,
        weather: recommendation.weather || '',
      },
      source: recommendation.source || 'Google Places',
      googleMapsUri: recommendation.googleMapsUri || '',
      rating: recommendation.rating || null,
      userRatingCount: recommendation.userRatingCount || 0,
      destinationStyle: recommendation.destinationStyle || '',
      destinationStyleLabel: recommendation.destinationStyleLabel || '',
      recommendation: {
        totalEstimate: recommendation.totalEstimate,
        bestTransport: recommendation.bestTransport,
        localMobility: recommendation.localMobility,
        distanceKm: recommendation.distanceKm,
      },
    };

    localStorage.setItem('gt_api_destination', JSON.stringify(destinationPayload));

    const query = new URLSearchParams(searchParams.toString());

    if (criteria.departureCity) {
      query.set('departure', criteria.departureCity);
    }

    if (criteria.budget) {
      query.set('budget', String(criteria.budget));
    }

    query.set('persons', String(criteria.persons));
    query.set('duration', String(criteria.duration));
    query.set('destinationStyle', criteria.destinationStyle);

    if (criteria.start) {
      query.set('start', criteria.start);
    }

    if (criteria.lodging) {
      query.set('lodging', criteria.lodging);
    }

    router.push(`/destinations/${recommendation.slug}?${query.toString()}`);
  };

  const goHome = () => {
    router.push('/');
  };

  const goBack = () => {
    router.back();
  };

  const isWaitingForDeparture =
    criteria.departureCity && !departureCoordsReady;

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

        <section className="mb-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                Recommandations via API
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
                Destinations proposées
              </h1>

              <p className="max-w-3xl text-slate-600">
                Les destinations sont récupérées via Google Places, puis complétées
                par des suggestions Gototrip selon le style choisi : classique,
                étonnant ou décalé.
              </p>
            </div>

            {(loading || isWaitingForDeparture) && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse des destinations...
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <CriteriaCard
              label="Départ"
              value={criteria.departureCity || 'Non renseigné'}
              icon={<MapPin className="h-4 w-4" />}
            />

            <CriteriaCard
              label="Voyageurs"
              value={`${criteria.persons} personne(s)`}
              icon={<Route className="h-4 w-4" />}
            />

            <CriteriaCard
              label="Durée"
              value={`${criteria.duration} jour(s) • ${criteria.nights} nuit(s)`}
              icon={<Info className="h-4 w-4" />}
            />

            <CriteriaCard
              label="Budget"
              value={criteria.budget ? formatEuro(criteria.budget) : 'Non renseigné'}
              icon={<Wallet className="h-4 w-4" />}
            />

            <CriteriaCard
              label="Style"
              value={getDestinationStyleText(criteria.destinationStyle)}
              icon={<Sparkles className="h-4 w-4" />}
            />
          </div>
        </section>

        {apiError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-semibold">Erreur API destinations</div>
            <div>{apiError}</div>
          </div>
        )}

        {!loading && recommendations.length === 0 && !apiError && !isWaitingForDeparture && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
            <h2 className="text-xl font-bold">Aucune destination trouvée</h2>
            <p className="mt-2 text-slate-600">
              Essaie de modifier les critères de recherche.
            </p>
          </div>
        )}

        <div className="grid gap-5">
          {recommendations.map((recommendation, index) => {
            const TransportIcon = getTransportIcon(recommendation.bestTransport.id);

            return (
              <article
                key={`${recommendation.slug}-${index}`}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                        #{index + 1}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          recommendation.score >= 75
                            ? 'bg-teal-50 text-teal-700'
                            : recommendation.score >= 55
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {recommendation.scoreLabel}
                      </span>

                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {recommendation.source || 'Google Places'}
                      </span>

                      {recommendation.destinationStyleLabel && (
                        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                          {recommendation.destinationStyleLabel}
                        </span>
                      )}

                      {recommendation.budgetStatus === 'under' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Dans le budget
                        </span>
                      )}

                      {recommendation.budgetStatus === 'over' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Dépasse le budget
                        </span>
                      )}
                    </div>

                    <h2 className="text-3xl font-extrabold">
                      {recommendation.city}
                    </h2>

                    <p className="mt-1 text-slate-500">
                      {recommendation.country || recommendation.address || 'Destination'}
                      {recommendation.weather ? ` • ${recommendation.weather}` : ''}
                    </p>

                    {recommendation.rating && (
                      <div className="mt-2 flex items-center gap-1 text-sm text-amber-700">
                        <Star className="h-4 w-4 fill-current" />
                        <span>
                          {recommendation.rating} / 5 (
                          {recommendation.userRatingCount || 0} avis)
                        </span>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <MiniStat
                        icon={<TransportIcon className="h-4 w-4" />}
                        label="Transport principal"
                        value={formatEuro(recommendation.bestTransport.total)}
                        sub={`${recommendation.bestTransport.label} • ${recommendation.bestTransport.duration}`}
                      />

                      <MiniStat
                        icon={<TramFront className="h-4 w-4" />}
                        label="Déplacements sur place"
                        value={formatEuro(recommendation.localMobility.total)}
                        sub={recommendation.localMobility.title}
                      />

                      <MiniStat
                        icon={<Hotel className="h-4 w-4" />}
                        label="Hébergement"
                        value={formatEuro(recommendation.staysEstimate)}
                        sub={`${recommendation.staysCount} lieu(x) trouvé(s)`}
                      />

                      <MiniStat
                        icon={<Ticket className="h-4 w-4" />}
                        label="Activités"
                        value={formatEuro(recommendation.activitiesEstimate)}
                        sub={`${recommendation.activitiesCount} lieu(x) trouvé(s)`}
                      />

                      <MiniStat
                        icon={<Utensils className="h-4 w-4" />}
                        label="Restaurants"
                        value={formatEuro(recommendation.restaurantsEstimate)}
                        sub={`${recommendation.restaurantsCount} lieu(x) trouvé(s)`}
                      />
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <h3 className="mb-2 flex items-center gap-2 font-bold text-emerald-900">
                          <CheckCircle2 className="h-4 w-4" />
                          Pourquoi cette destination ?
                        </h3>

                        <ul className="space-y-1 text-sm text-emerald-800">
                          {recommendation.reasons.length > 0 ? (
                            recommendation.reasons.slice(0, 5).map((reason) => (
                              <li key={reason}>• {reason}</li>
                            ))
                          ) : (
                            <li>• Destination compatible avec les critères de base.</li>
                          )}
                        </ul>
                      </div>

                      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-900">
                          <AlertTriangle className="h-4 w-4" />
                          Points à vérifier
                        </h3>

                        <ul className="space-y-1 text-sm text-amber-800">
                          {recommendation.warnings.length > 0 ? (
                            recommendation.warnings.slice(0, 5).map((warning) => (
                              <li key={warning}>• {warning}</li>
                            ))
                          ) : (
                            <li>• Aucun point bloquant détecté pour le moment.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4">
                      <div className="mb-1 text-sm text-slate-500">
                        Score Gototrip
                      </div>

                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-extrabold">
                          {recommendation.loading ? '...' : recommendation.score}
                        </span>
                        <span className="pb-1 text-slate-500">/ 100</span>
                      </div>
                    </div>

                    <div className="mb-4 rounded-2xl bg-white p-4">
                      <div className="mb-1 text-sm text-slate-500">
                        Total estimé avec déplacements
                      </div>

                      <div
                        className={`text-3xl font-extrabold ${
                          recommendation.budgetStatus === 'over'
                            ? 'text-red-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {recommendation.loading
                          ? 'Analyse...'
                          : formatEuro(recommendation.totalEstimate)}
                      </div>

                      {criteria.budget && !recommendation.loading && (
                        <div className="mt-2 text-sm text-slate-600">
                          {recommendation.budgetStatus === 'under' ? (
                            <>
                              Reste environ{' '}
                              <span className="font-semibold text-emerald-700">
                                {formatEuro(Math.abs(recommendation.budgetDifference))}
                              </span>
                            </>
                          ) : (
                            <>
                              Dépassement estimé :{' '}
                              <span className="font-semibold text-red-700">
                                {formatEuro(recommendation.budgetDifference)}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openDestination(recommendation)}
                      disabled={recommendation.loading}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                        recommendation.loading
                          ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      Choisir cette destination
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <p className="mt-3 text-xs text-slate-500">
                      Le total inclut une estimation des trajets sur place :
                      transports locaux, parking/carburant ou location voiture.
                    </p>
                  </aside>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CriteriaCard({
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

      <div className="font-bold">{value}</div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>

      <div className="font-bold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}