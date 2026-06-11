'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Home,
  MapPin,
  Plane,
  Train,
  Bus,
  Car,
  Clock,
  Wallet,
  Leaf,
  ChevronRight,
  AlertTriangle,
  Pencil,
  Loader2,
} from 'lucide-react';

type Destination = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  weather?: string;
};

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
  description?: string;
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

type TransportId = 'plane' | 'train' | 'bus' | 'car';

type TransportOption = {
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
  disabled?: boolean;
  badge?: string | null;
  description?: string;
};

type StoredSelection = {
  destination: Destination;
  departureCity?: string;
  departureResolvedName?: string;
  departureCoords?: {
    lat: number;
    lng: number;
  } | null;
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
  transport?: TransportOption;
  budgetOverrun?: number;
  budgetOverrunAccepted?: boolean;
  totals: {
    activities: number;
    restaurants: number;
    stays: number;
    transport?: number;
    overall: number;
  };
};

type RouteInfo = {
  distanceKm: number;
  durationText: string;
  source: string;
};

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

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

function shouldMarkTrainAsNotRecommended({
  destinationCity,
  destinationCountry,
  distanceKm,
}: {
  destinationCity?: string;
  destinationCountry?: string;
  distanceKm?: number;
}) {
  const distance = Number(distanceKm || 0);

  if (isIslandOrSeaDestination(destinationCity, destinationCountry)) {
    return true;
  }

  if (distance > 1000) {
    return true;
  }

  return false;
}

function shouldMarkBusAsNotRecommended({
  destinationCity,
  destinationCountry,
  distanceKm,
}: {
  destinationCity?: string;
  destinationCountry?: string;
  distanceKm?: number;
}) {
  const distance = Number(distanceKm || 0);

  if (isIslandOrSeaDestination(destinationCity, destinationCountry)) {
    return true;
  }

  if (distance > 900) {
    return true;
  }

  return false;
}

function shouldMarkCarAsNotRecommended({
  destinationCity,
  destinationCountry,
  distanceKm,
}: {
  destinationCity?: string;
  destinationCountry?: string;
  distanceKm?: number;
}) {
  const distance = Number(distanceKm || 0);

  if (isIslandOrSeaDestination(destinationCity, destinationCountry)) {
    return true;
  }

  if (distance > 1200) {
    return true;
  }

  return false;
}

function getTrainExplanation(distanceKm: number, trainNotRecommended: boolean) {
  if (trainNotRecommended) {
    if (distanceKm > 1000) {
      return 'Distance trop importante pour proposer simplement le train à cette étape. Une API ferroviaire pourra affiner cette option plus tard.';
    }

    return 'Cette destination semble nécessiter une combinaison train + ferry + bus, ou une traversée maritime. Le train direct n’est donc pas proposé simplement.';
  }

  return 'Option possible pour cette distance. Le trajet exact sera à confirmer plus tard avec une API ferroviaire partenaire.';
}

function getBusExplanation(distanceKm: number, busNotRecommended: boolean) {
  if (busNotRecommended) {
    if (distanceKm > 900) {
      return 'Distance trop importante pour proposer simplement le bus à cette étape. Une API bus pourra affiner cette option plus tard.';
    }

    return 'Cette destination semble nécessiter une traversée maritime ou une combinaison complexe. Le bus direct n’est donc pas proposé simplement.';
  }

  return 'Option économique possible pour cette distance. Le trajet exact sera à confirmer plus tard avec une API bus partenaire.';
}

function getCarExplanation(
  routeInfo: RouteInfo | null,
  carNotRecommended: boolean,
  distanceKm: number
) {
  if (carNotRecommended) {
    if (distanceKm > 1200) {
      return 'Distance trop importante pour proposer simplement la voiture à cette étape.';
    }

    return 'Cette destination semble nécessiter une traversée maritime. La voiture n’est donc pas proposée simplement à cette étape.';
  }

  if (routeInfo) {
    return 'Distance et durée routière calculées avec Google Routes API quand un itinéraire est disponible.';
  }

  return 'Distance estimée à partir des coordonnées. Le trajet routier exact sera à confirmer.';
}

function getCarbonLabel(type: TransportId) {
  if (type === 'plane') return 'Élevé';
  if (type === 'train') return 'Faible';
  if (type === 'bus') return 'Faible';
  return 'Moyen';
}

function estimatePlaneDuration(distanceKm: number) {
  if (distanceKm <= 300) return '≈ 1h à 2h';
  if (distanceKm <= 900) return '≈ 2h à 3h';
  if (distanceKm <= 1800) return '≈ 2h à 5h';
  return '≈ 4h à 7h';
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
  const pricePerPerson = Math.max(90, Math.round(distanceKm * 0.045));

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

async function fetchRouteInfo({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
}: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}): Promise<RouteInfo | null> {
  try {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destinationLat: String(destinationLat),
      destinationLng: String(destinationLng),
    });

    const res = await fetch(`/api/routes?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const json = await res.json();

    const distanceKm = Number(json.distanceKm || json.distance || 0);
    const durationText = String(json.durationText || json.duration || '');

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      return null;
    }

    return {
      distanceKm: Math.round(distanceKm),
      durationText: durationText || estimateCarDuration(distanceKm),
      source: 'Google Routes API',
    };
  } catch {
    return null;
  }
}

async function fetchFlights({
  departureCity,
  destinationCity,
  departureDate,
  duration,
  adults,
}: {
  departureCity: string;
  destinationCity: string;
  departureDate?: string;
  duration: number;
  adults: number;
}) {
  try {
    const params = new URLSearchParams({
      departureCity,
      destinationCity,
      departureDate: departureDate || '',
      duration: String(duration),
      adults: String(adults),
    });

    const res = await fetch(`/api/flights?${params.toString()}`, {
      cache: 'no-store',
    });

    const json = await res.json();

    if (!res.ok) {
      return [];
    }

    return Array.isArray(json.offers) ? json.offers : [];
  } catch {
    return [];
  }
}

export default function TransportPage() {
  const router = useRouter();

  const [selection, setSelection] = useState<StoredSelection | null>(null);
  const [selectedTransportId, setSelectedTransportId] =
    useState<TransportId | null>(null);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [flightOffers, setFlightOffers] = useState<FlightOffer[]>([]);
  const [loadingFlights, setLoadingFlights] = useState(false);

  const [departureCoords, setDepartureCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [departureResolvedName, setDepartureResolvedName] = useState('');
  const [directDistanceKm, setDirectDistanceKm] = useState<number>(0);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [acceptBudgetOverrun, setAcceptBudgetOverrun] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('gt_selection');

    if (!raw) {
      setSelection(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setSelection(parsed);

      if (parsed.transport?.id) {
        setSelectedTransportId(parsed.transport.id);
      }

      if (parsed.flightOffer?.id) {
        setSelectedFlightId(parsed.flightOffer.id);
      }

      if (parsed.departureCoords) {
        setDepartureCoords(parsed.departureCoords);
      }

      if (parsed.departureResolvedName) {
        setDepartureResolvedName(parsed.departureResolvedName);
      }
    } catch {
      setSelection(null);
    }
  }, []);

  useEffect(() => {
    if (!selection) return;

    async function resolveDeparture() {
      const departureCity = selection.departureCity || '';

      if (!departureCity) return;

      if (selection.departureCoords?.lat && selection.departureCoords?.lng) {
        setDepartureCoords(selection.departureCoords);
        setDepartureResolvedName(
          selection.departureResolvedName || departureCity
        );
        return;
      }

      const coords = await geocodeDepartureCity(departureCity);

      if (!coords) return;

      setDepartureCoords({
        lat: coords.lat,
        lng: coords.lng,
      });

      setDepartureResolvedName(coords.name || departureCity);
    }

    resolveDeparture();
  }, [selection]);

  useEffect(() => {
    if (!selection || !departureCoords) return;

    const destination = selection.destination;

    const distance = getDistanceKm(
      departureCoords.lat,
      departureCoords.lng,
      Number(destination.lat),
      Number(destination.lng)
    );

    setDirectDistanceKm(distance);

    async function loadRoute() {
      const route = await fetchRouteInfo({
        originLat: departureCoords.lat,
        originLng: departureCoords.lng,
        destinationLat: Number(destination.lat),
        destinationLng: Number(destination.lng),
      });

      setRouteInfo(route);
    }

    loadRoute();
  }, [selection, departureCoords]);

  useEffect(() => {
    if (!selection) return;

    async function loadFlights() {
      const departureCity = selection.departureCity || '';

      if (!departureCity) {
        setFlightOffers([]);
        return;
      }

      setLoadingFlights(true);

      try {
        let departureDate = '';

        try {
          const rawCriteria = localStorage.getItem('gt_criteria');
          if (rawCriteria) {
            const criteria = JSON.parse(rawCriteria);
            departureDate = criteria.start || '';
          }
        } catch {
          departureDate = '';
        }

        const offers = await fetchFlights({
          departureCity,
          destinationCity: selection.destination.city,
          departureDate,
          duration: selection.duration,
          adults: selection.persons,
        });

        setFlightOffers(offers);
      } finally {
        setLoadingFlights(false);
      }
    }

    loadFlights();
  }, [selection]);

  const selectedFlight = useMemo(() => {
    if (!selectedFlightId) return flightOffers[0] || null;
    return (
      flightOffers.find((flight) => flight.id === selectedFlightId) ||
      flightOffers[0] ||
      null
    );
  }, [flightOffers, selectedFlightId]);

  const distanceUsedKm = routeInfo?.distanceKm || directDistanceKm;
  const directDistanceLabel = directDistanceKm ? `${directDistanceKm} km` : '—';

  const trainNotRecommended = selection
    ? shouldMarkTrainAsNotRecommended({
        destinationCity: selection.destination.city,
        destinationCountry: selection.destination.country,
        distanceKm: directDistanceKm,
      })
    : false;

  const busNotRecommended = selection
    ? shouldMarkBusAsNotRecommended({
        destinationCity: selection.destination.city,
        destinationCountry: selection.destination.country,
        distanceKm: directDistanceKm,
      })
    : false;

  const carNotRecommended = selection
    ? shouldMarkCarAsNotRecommended({
        destinationCity: selection.destination.city,
        destinationCountry: selection.destination.country,
        distanceKm: directDistanceKm,
      })
    : false;

  const transportOptions: TransportOption[] = useMemo(() => {
    if (!selection) return [];

    const persons = selection.persons || 1;
    const destination = selection.destination;
    const departureCity = selection.departureCity || 'Départ';

    const distanceForEstimate = directDistanceKm || distanceUsedKm || 300;

    const planeEstimate = selectedFlight
      ? {
          pricePerPerson: Math.round(
            Number(selectedFlight.priceTotal || 0) / persons
          ),
          total: Math.round(Number(selectedFlight.priceTotal || 0)),
        }
      : estimatePlanePrice(distanceForEstimate, persons);

    const trainEstimate = estimateTrainPrice(distanceForEstimate, persons);
    const busEstimate = estimateBusPrice(distanceForEstimate, persons);

    const carDistance = routeInfo?.distanceKm || distanceForEstimate;
    const carEstimate = estimateCarPrice(carDistance, persons);

    const planeDuration = selectedFlight
      ? selectedFlight.durationText
      : estimatePlaneDuration(distanceForEstimate);

    const trainDuration = trainNotRecommended
      ? 'Non recommandé'
      : estimateTrainDuration(distanceForEstimate);

    const busDuration = busNotRecommended
      ? 'Non recommandé'
      : estimateBusDuration(distanceForEstimate);

    const carDuration = carNotRecommended
      ? 'Non recommandé'
      : routeInfo?.durationText || estimateCarDuration(carDistance);

    return [
      {
        id: 'plane',
        title: 'Avion',
        subtitle: `${departureCity} → ${destination.city}`,
        duration: planeDuration,
        pricePerPerson: planeEstimate.pricePerPerson,
        total: planeEstimate.total,
        carbon: getCarbonLabel('plane'),
        partnerLabel: selectedFlight ? 'Réserver ce vol' : 'Comparer les vols',
        partnerUrl:
          selectedFlight?.bookingUrl ||
          selectedFlight?.airlineWebsite ||
          `https://www.google.com/travel/flights?q=${encodeURIComponent(
            `${departureCity} ${destination.city}`
          )}`,
        estimatedDistanceKm: directDistanceKm,
        distanceSource: selectedFlight ? 'Duffel' : 'Coordonnées Google',
        dataSource: selectedFlight ? 'Duffel' : 'Coordonnées Google',
        badge: selectedFlight ? 'Vol Duffel choisi' : null,
        description: selectedFlight
          ? `Vol sélectionné via Duffel. ${
              selectedFlight.outboundStops || 0
            } escale(s) à l’aller, ${selectedFlight.returnStops || 0} au retour.`
          : 'Aucun vol Duffel disponible pour ces critères pour le moment. Prix estimé à partir de la distance directe.',
      },
      {
        id: 'train',
        title: 'Train',
        subtitle: `${departureCity} → ${destination.city}`,
        duration: trainDuration,
        pricePerPerson: trainNotRecommended ? 0 : trainEstimate.pricePerPerson,
        total: trainNotRecommended ? 0 : trainEstimate.total,
        carbon: trainNotRecommended ? 'Variable' : getCarbonLabel('train'),
        partnerLabel: 'Comparer les trains',
        partnerUrl: `https://www.google.com/search?q=${encodeURIComponent(
          `train ${departureCity} ${destination.city}`
        )}`,
        estimatedDistanceKm: directDistanceKm,
        distanceSource: 'Coordonnées Google',
        dataSource: trainNotRecommended ? 'Trajet complexe' : 'Coordonnées Google',
        disabled: trainNotRecommended,
        badge: trainNotRecommended ? 'Non recommandé' : null,
        description: getTrainExplanation(
          directDistanceKm || distanceForEstimate,
          trainNotRecommended
        ),
      },
      {
        id: 'bus',
        title: 'Bus',
        subtitle: `${departureCity} → ${destination.city}`,
        duration: busDuration,
        pricePerPerson: busNotRecommended ? 0 : busEstimate.pricePerPerson,
        total: busNotRecommended ? 0 : busEstimate.total,
        carbon: busNotRecommended ? 'Variable' : getCarbonLabel('bus'),
        partnerLabel: 'Comparer les bus',
        partnerUrl: `https://www.google.com/search?q=${encodeURIComponent(
          `bus ${departureCity} ${destination.city}`
        )}`,
        estimatedDistanceKm: directDistanceKm,
        distanceSource: 'Coordonnées Google',
        dataSource: busNotRecommended ? 'Trajet complexe' : 'Coordonnées Google',
        disabled: busNotRecommended,
        badge: busNotRecommended ? 'Non recommandé' : null,
        description: getBusExplanation(
          directDistanceKm || distanceForEstimate,
          busNotRecommended
        ),
      },
      {
        id: 'car',
        title: 'Voiture',
        subtitle: `${departureCity} → ${destination.city}`,
        duration: carDuration,
        pricePerPerson: carNotRecommended ? 0 : carEstimate.pricePerPerson,
        total: carNotRecommended ? 0 : carEstimate.total,
        carbon: carNotRecommended ? 'Variable' : getCarbonLabel('car'),
        partnerLabel: 'Comparer les locations',
        partnerUrl: `https://www.google.com/search?q=${encodeURIComponent(
          `location voiture ${departureCity}`
        )}`,
        estimatedDistanceKm: routeInfo?.distanceKm || directDistanceKm,
        distanceSource: routeInfo ? 'Google Routes API' : 'Coordonnées Google',
        dataSource: routeInfo ? 'Google Routes API' : 'Coordonnées Google',
        disabled: carNotRecommended,
        badge: carNotRecommended ? 'Non recommandé' : null,
        description: getCarExplanation(
          routeInfo,
          carNotRecommended,
          directDistanceKm || distanceForEstimate
        ),
      },
    ];
  }, [
    selection,
    directDistanceKm,
    distanceUsedKm,
    selectedFlight,
    trainNotRecommended,
    busNotRecommended,
    carNotRecommended,
    routeInfo,
  ]);

  const selectedTransport = useMemo(() => {
    if (!selectedTransportId) return null;
    return transportOptions.find((option) => option.id === selectedTransportId) || null;
  }, [transportOptions, selectedTransportId]);

  const subtotalWithoutTransport = selection
    ? Number(selection.totals.activities || 0) +
      Number(selection.totals.restaurants || 0) +
      Number(selection.totals.stays || 0)
    : 0;

  const transportTotal = selectedTransport ? selectedTransport.total : 0;
  const totalWithTransport = subtotalWithoutTransport + transportTotal;

  const budget =
    selection && typeof selection.budget === 'number' && selection.budget > 0
      ? selection.budget
      : null;

  const isOverBudget = budget !== null && totalWithTransport > budget;
  const budgetOverrun = isOverBudget ? totalWithTransport - budget : 0;
  const canContinue = !!selectedTransport && (!isOverBudget || acceptBudgetOverrun);

  useEffect(() => {
    if (!isOverBudget) {
      setAcceptBudgetOverrun(false);
    }
  }, [isOverBudget]);

  const chooseFlight = (flight: FlightOffer) => {
    setSelectedFlightId(flight.id);
    setSelectedTransportId('plane');
  };

  const chooseTransport = (option: TransportOption) => {
    if (option.disabled) return;

    setSelectedTransportId(option.id);

    if (option.id === 'plane' && selectedFlight) {
      setSelectedFlightId(selectedFlight.id);
    }
  };

  const continueToSummary = () => {
    if (!selection || !selectedTransport || !canContinue) return;

    const finalFlight =
      selectedTransport.id === 'plane' ? selectedFlight || null : null;

    const updatedSelection: StoredSelection = {
      ...selection,
      departureResolvedName:
        departureResolvedName || selection.departureResolvedName || selection.departureCity,
      departureCoords: departureCoords || selection.departureCoords || null,
      flightOffer: finalFlight,
      transport: selectedTransport,
      budgetOverrun,
      budgetOverrunAccepted: isOverBudget ? acceptBudgetOverrun : false,
      totals: {
        activities: selection.totals.activities || 0,
        restaurants: selection.totals.restaurants || 0,
        stays: selection.totals.stays || 0,
        transport: selectedTransport.total,
        overall: totalWithTransport,
      },
    };

    localStorage.setItem('gt_selection', JSON.stringify(updatedSelection));
    router.push('/summary');
  };

  const goHome = () => {
    router.push('/');
  };

  const goBack = () => {
    router.back();
  };

  const modifyDeparture = () => {
    router.push('/');
  };

  if (!selection) {
    return (
      <div className="min-h-screen bg-white grid place-items-center px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold mb-2">
            Aucun voyage en cours
          </h1>

          <p className="text-slate-600 mb-5">
            Commence par choisir une destination et construire ton voyage.
          </p>

          <button
            onClick={goHome}
            className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
          >
            Retour à l’accueil
          </button>
        </div>
      </div>
    );
  }

  const persons = selection.persons || 1;

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
          <h1 className="text-3xl md:text-4xl font-extrabold">
            Choisissez votre transport
          </h1>

          <p className="mt-2 text-slate-600">
            Destination :{' '}
            <span className="font-semibold text-slate-900">
              {selection.destination.city}, {selection.destination.country}
            </span>{' '}
            • {persons} personne(s) • {selection.duration} jour(s)
            {budget ? <> • budget {formatEuro(budget)}</> : null}
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-lg font-bold">
                <MapPin className="h-5 w-5 text-slate-500" />
                Départ
              </div>

              <div className="text-sm text-slate-500">Ville de départ choisie</div>

              <div className="mt-1 text-2xl font-extrabold">
                {selection.departureCity || 'Non renseignée'}
              </div>

              <div className="mt-2 text-sm text-slate-600">
                Distance directe vers {selection.destination.city} :{' '}
                <span className="font-semibold">{directDistanceLabel}</span>{' '}
                <span className="ml-2 text-slate-500">Coordonnées Google</span>
              </div>

              {flightOffers.length > 0 ? (
                <div className="mt-1 text-sm text-teal-700">
                  {flightOffers.length} vol(s) trouvé(s) via Duffel.
                </div>
              ) : (
                <div className="mt-1 text-sm text-amber-700">
                  Vols disponibles : estimation simple utilisée.
                </div>
              )}

              {routeInfo ? (
                <div className="mt-1 text-sm text-teal-700">
                  Voiture : {routeInfo.distanceKm} km • {routeInfo.durationText} •{' '}
                  {routeInfo.source}
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-500">
                  Voiture : distance routière à confirmer.
                </div>
              )}

              {(trainNotRecommended || busNotRecommended || carNotRecommended) && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Certains transports ne sont pas recommandés pour cette destination.
                </div>
              )}
            </div>

            <button
              onClick={modifyDeparture}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Modifier le départ
            </button>
          </div>
        </section>

        {loadingFlights && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Recherche des vols disponibles...
          </div>
        )}

        {flightOffers.length > 0 && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Plane className="h-5 w-5 text-slate-500" />
              <h2 className="text-xl font-bold">Vols disponibles</h2>
              <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">
                Duffel
              </span>
            </div>

            <div className="space-y-3">
              {flightOffers.map((flight) => {
                const selected = selectedFlight?.id === flight.id;

                return (
                  <button
                    key={flight.id}
                    type="button"
                    onClick={() => chooseFlight(flight)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-teal-700 bg-teal-50'
                        : 'border-slate-200 bg-white hover:border-teal-500'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-bold">{flight.airline}</span>

                          {selected && (
                            <span className="rounded-full bg-teal-700 px-2 py-1 text-xs font-semibold text-white">
                              Vol choisi
                            </span>
                          )}
                        </div>

                        <div className="text-sm text-slate-600">
                          {flight.departureAirport} → {flight.arrivalAirport} •{' '}
                          {flight.durationText}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          Départ : {flight.departureAtText} • Arrivée :{' '}
                          {flight.arrivalAtText}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          Escales : {flight.outboundStops} aller •{' '}
                          {flight.returnStops} retour
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-extrabold">
                          {formatEuro(flight.priceTotal)}
                        </div>

                        <div className="text-xs text-slate-500">
                          {formatEuro(flight.priceTotal / persons)} / personne
                        </div>

                        <div className="mt-3 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white">
                          {selected ? 'Vol sélectionné' : 'Sélectionner ce vol'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Ces offres proviennent de Duffel. Plus tard, les boutons de réservation
              pourront être remplacés par des liens partenaires ou affiliés.
            </p>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            {transportOptions.map((option) => {
              const selected = selectedTransportId === option.id;

              const Icon =
                option.id === 'plane'
                  ? Plane
                  : option.id === 'train'
                    ? Train
                    : option.id === 'bus'
                      ? Bus
                      : Car;

              return (
                <article
                  key={option.id}
                  onClick={() => {
                    if (!option.disabled) {
                      chooseTransport(option);
                    }
                  }}
                  className={`rounded-2xl border p-5 transition ${
                    option.disabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
                      : selected
                        ? 'cursor-pointer border-teal-700 bg-teal-50'
                        : 'cursor-pointer border-slate-200 bg-white hover:border-teal-500 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <div
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                        selected
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold">{option.title}</h2>

                        {selected && (
                          <span className="rounded-full bg-teal-700 px-2 py-1 text-xs font-semibold text-white">
                            Sélectionné
                          </span>
                        )}

                        {option.badge && (
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              option.badge === 'Non recommandé'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-teal-50 text-teal-700'
                            }`}
                          >
                            {option.badge}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-slate-500">{option.subtitle}</div>

                      <p className="mt-3 text-sm text-slate-600">
                        {option.description}
                      </p>

                      {option.disabled && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          {option.title} non recommandé pour cette destination.
                        </div>
                      )}

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <TransportInfo
                          icon={<Clock className="h-4 w-4" />}
                          label="Durée estimée"
                          value={option.duration}
                        />

                        <TransportInfo
                          icon={<Wallet className="h-4 w-4" />}
                          label="Prix estimé"
                          value={
                            option.disabled ? '—' : formatSimpleEuro(option.total)
                          }
                        />

                        <TransportInfo
                          icon={<Leaf className="h-4 w-4" />}
                          label="Impact CO₂"
                          value={option.carbon}
                        />
                      </div>

                      <div className="mt-3 text-xs text-slate-500">
                        Source : {option.dataSource || option.distanceSource}
                      </div>
                    </div>

                    <div className="text-right md:w-36">
                      {option.disabled ? (
                        <>
                          <div className="text-2xl font-extrabold">—</div>
                          <div className="text-xs text-slate-500">non proposé</div>
                        </>
                      ) : (
                        <>
                          <div className="text-2xl font-extrabold">
                            {formatSimpleEuro(option.total)}
                          </div>

                          <div className="text-xs text-slate-500">
                            {formatSimpleEuro(option.pricePerPerson)} / personne
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              chooseTransport(option);
                            }}
                            className={`mt-3 rounded-xl px-4 py-2 text-sm font-semibold ${
                              selected
                                ? 'bg-teal-700 text-white'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            {selected ? 'Sélectionné' : 'Sélectionner'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-xl font-bold">Récapitulatif provisoire</h2>

            <div className="space-y-3 text-sm text-slate-600">
              <SummaryLine label="Départ" value={selection.departureCity || '—'} />
              <SummaryLine
                label="Destination"
                value={selection.destination.city || '—'}
              />

              {budget !== null && (
                <SummaryLine label="Budget prévu" value={formatEuro(budget)} />
              )}

              <SummaryLine label="Distance" value={directDistanceLabel} />
              <SummaryLine
                label="Activités"
                value={formatSimpleEuro(selection.totals.activities || 0)}
              />
              <SummaryLine
                label="Restaurants"
                value={formatSimpleEuro(selection.totals.restaurants || 0)}
              />
              <SummaryLine
                label="Hébergement"
                value={formatSimpleEuro(selection.totals.stays || 0)}
              />
              <SummaryLine
                label="Transport"
                value={formatSimpleEuro(transportTotal)}
              />
            </div>

            <div className="my-4 border-t border-slate-200" />

            <div className="flex items-end justify-between gap-4">
              <span className="font-bold">Total estimé</span>
              <span
                className={`text-3xl font-extrabold ${
                  isOverBudget ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {formatSimpleEuro(totalWithTransport)}
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
                    <span className="font-semibold">
                      {formatEuro(totalWithTransport)}
                    </span>
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
                    onChange={(e) => setAcceptBudgetOverrun(e.target.checked)}
                  />

                  <span>J’accepte de dépasser mon budget pour continuer.</span>
                </label>
              </div>
            )}

            {selectedTransport && (
              <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-teal-800">
                Transport choisi : {selectedTransport.title}
              </div>
            )}

            {!selectedTransport && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Sélectionne un moyen de transport pour continuer.
              </div>
            )}

            <button
              type="button"
              onClick={continueToSummary}
              disabled={!canContinue}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ${
                canContinue
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'cursor-not-allowed bg-slate-200 text-slate-500'
              }`}
            >
              Continuer vers le récapitulatif
              <ChevronRight className="h-4 w-4" />
            </button>

            {isOverBudget && !acceptBudgetOverrun && (
              <div className="mt-2 text-center text-xs text-red-700">
                Cochez l’acceptation du dépassement pour continuer.
              </div>
            )}

            {selectedTransport?.partnerUrl && (
              <a
                href={selectedTransport.partnerUrl}
                target="_blank"
                className="mt-3 block text-center text-xs text-teal-700 underline"
              >
                {selectedTransport.partnerLabel}
              </a>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function TransportInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>

      <div className="font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}