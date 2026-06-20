export type PlannerOpeningPeriod = {
  openDay: number;
  openHour: number;
  openMinute: number;
  closeDay: number;
  closeHour: number;
  closeMinute: number;
};

export type PlannerPlace = {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  rating?: number | null;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
  googleMapsUri?: string;
  link?: string;
  description?: string;
  source?: string;
  isReal?: boolean;
  pricePerPerson?: number;
  pricePerNightPerPerson?: number;
  priceTotal?: number;
  currency?: string;
  imageUrl?: string;
  estimatedDurationMinutes?: number;
  durationLabel?: string;
  openingHoursSummary?: string;
  openingPeriods?: PlannerOpeningPeriod[];
  openNow?: boolean | null;
};

export type PlannerTransportId =
  | 'plane'
  | 'train'
  | 'bus'
  | 'car'
  | 'rental-car'
  | 'public-transport'
  | 'walk'
  | 'unknown'
  | string;

export type PlannerInput = {
  destination?: {
    city?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  departureCity?: string;
  persons?: number;
  duration?: number;
  days?: number;
  nights?: number;
  start?: string | null;
  startDate?: string | null;
  end?: string | null;
  endDate?: string | null;
  transportId?: PlannerTransportId;
  transport?: {
    id?: PlannerTransportId;
    mode?: PlannerTransportId;
    name?: string;
    label?: string;
  };
  activities?: PlannerPlace[];
  restaurants?: PlannerPlace[];
  stays?: PlannerPlace[];
  selections?: {
    activities?: PlannerPlace[];
    restaurants?: PlannerPlace[];
    stays?: PlannerPlace[];
  };
};

export type PlanningSlotType =
  | 'arrival'
  | 'departure'
  | 'activity'
  | 'restaurant'
  | 'stay'
  | 'transport'
  | 'free-time'
  | 'wake-up'
  | 'return-base'
  | 'return-trip'
  | 'info'
  | string;

export type PlanningSlot = {
  id?: string;
  editableId?: string;
  time: string;
  startTime?: string;
  endTime?: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: PlanningSlotType;
  place?: PlannerPlace | null;
  price?: number;
  pricePerPerson?: number;
  totalPrice?: number;
  travelTimeMinutes?: number;
  travelDistanceKm?: number;
  durationMinutes?: number;
  durationLabel?: string;
  openingStatus?: 'open' | 'closed' | 'unknown';
  openingWarning?: string;
  warning?: string | null;
  address?: string;
  link?: string;
  googleMapsUri?: string;
  lat?: number;
  lng?: number;
  source?: string;
  isReal?: boolean;
  locked?: boolean;
  editable?: boolean;
  removable?: boolean;
  movable?: boolean;
  role?: string;
};

export type OptimizedDay = {
  day: number;
  date?: string;
  title?: string;
  summary?: string;
  slots: PlanningSlot[];
  totalCost?: number;
  totalDurationMinutes?: number;
  warnings?: string[];
};

type Point = {
  lat?: number;
  lng?: number;
};

type PickedPlace = {
  place: PlannerPlace;
  start: number;
  duration: number;
  travelTimeMinutes: number;
  travelDistanceKm: number;
  openingStatus: 'open' | 'closed' | 'unknown';
  score: number;
};

const DEFAULT_DAY_COUNT = 2;
const DEFAULT_PERSONS = 1;

const DAY_START = 9 * 60;
const FIRST_DAY_START = 10 * 60 + 30;
const LUNCH_START = 12 * 60 + 15;
const LUNCH_END = 14 * 60;
const AFTERNOON_START = 14 * 60 + 15;
const DINNER_START = 20 * 60;
const DINNER_END = 22 * 60;
const DAY_END = 21 * 60 + 30;
const FINAL_RETURN_START = 17 * 60;
const GAP_BETWEEN_STEPS = 10;

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function normalizePlaceName(value: string) {
  return normalizeText(value)
    .replace(/\b(hotel|hôtel|restaurant|cafe|café|bar|the|le|la|les|l'|de|du|des)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function minutesToTime(totalMinutes: number) {
  const normalized = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  if (hours >= 24) {
    return `${pad(hours - 24)}:${pad(minutes)}`;
  }

  return `${pad(hours)}:${pad(minutes)}`;
}

function timeToMinutes(value: string) {
  const cleaned = String(value || '').replace('h', ':');
  const [rawHours, rawMinutes] = cleaned.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes || 0);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function formatTimeRange(startMinutes: number, durationMinutes: number) {
  const endMinutes = startMinutes + Math.max(0, durationMinutes);

  return `${minutesToTime(startMinutes)} - ${minutesToTime(endMinutes)}`;
}

export function formatDurationLabel(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));

  if (safeMinutes <= 0) return 'Variable';

  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours <= 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours}h`;

  return `${hours}h${pad(remainingMinutes)}`;
}

function clampDuration(minutes: number, min = 30, max = 240) {
  const safe = Number(minutes);

  if (!Number.isFinite(safe) || safe <= 0) return 90;

  return Math.min(max, Math.max(min, Math.round(safe)));
}

function hasValidPoint(point?: Point | null) {
  return Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));
}

function getPoint(place?: PlannerPlace | Point | null): Point | null {
  const lat = Number(place?.lat);
  const lng = Number(place?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function getBasePoint(input: PlannerInput, stay?: PlannerPlace | null): Point | null {
  const stayPoint = getPoint(stay);

  if (stayPoint) return stayPoint;

  const destinationPoint = getPoint(input.destination);

  if (destinationPoint) return destinationPoint;

  return null;
}

export function calculateDistanceKm(
  a?: { lat?: number; lng?: number } | null,
  b?: { lat?: number; lng?: number } | null
) {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return 0;
  }

  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return earthRadiusKm * c;
}

function placesAreSame(a?: PlannerPlace | null, b?: PlannerPlace | null) {
  if (!a || !b) return false;

  if (a.id && b.id && a.id === b.id) return true;

  const nameA = normalizePlaceName(a.name || '');
  const nameB = normalizePlaceName(b.name || '');

  if (!nameA || !nameB) return false;

  const sameName =
    nameA === nameB ||
    (nameA.length >= 5 && nameB.length >= 5 && (nameA.includes(nameB) || nameB.includes(nameA)));

  if (!sameName) return false;

  const addressA = normalizeText(a.address || '');
  const addressB = normalizeText(b.address || '');

  if (addressA && addressB && addressA === addressB) return true;

  const pointA = getPoint(a);
  const pointB = getPoint(b);

  if (pointA && pointB) {
    return calculateDistanceKm(pointA, pointB) < 0.2;
  }

  return true;
}

function dedupePlaces(places: PlannerPlace[]) {
  const result: PlannerPlace[] = [];

  places.forEach((place) => {
    const alreadyExists = result.some((existingPlace) =>
      placesAreSame(existingPlace, place)
    );

    if (!alreadyExists) {
      result.push(place);
    }
  });

  return result;
}

function filterOutMatchingPlaces(places: PlannerPlace[], blockers: PlannerPlace[]) {
  return places.filter(
    (place) => !blockers.some((blocker) => placesAreSame(place, blocker))
  );
}

function removeMatchingPlacesFromPool(pool: PlannerPlace[], place: PlannerPlace) {
  for (let index = pool.length - 1; index >= 0; index -= 1) {
    if (placesAreSame(pool[index], place)) {
      pool.splice(index, 1);
    }
  }
}

function getTravelSpeedKmh(transportId?: PlannerTransportId) {
  const normalized = normalizeText(String(transportId || ''));

  if (normalized.includes('walk') || normalized.includes('pied')) return 4.5;
  if (normalized.includes('car') || normalized.includes('voiture')) return 28;
  if (normalized.includes('rental')) return 28;
  if (normalized.includes('bus')) return 18;
  if (normalized.includes('train')) return 22;
  if (normalized.includes('public')) return 18;

  return 16;
}

export function estimateTravelMinutes(
  from?: { lat?: number; lng?: number } | null,
  to?: { lat?: number; lng?: number } | null,
  transportId?: PlannerTransportId
) {
  if (!hasValidPoint(from) || !hasValidPoint(to)) return 0;

  const distanceKm = calculateDistanceKm(from, to);

  if (distanceKm < 0.05) return 0;
  if (distanceKm < 0.25) return 4;
  if (distanceKm < 0.75) return 8;

  const speedKmh = getTravelSpeedKmh(transportId);
  const pureTravel = (distanceKm / speedKmh) * 60;
  const accessBuffer = distanceKm < 1 ? 4 : 8;

  return Math.max(5, Math.min(90, Math.round(pureTravel + accessBuffer)));
}

export function estimatePlaceDuration(place: PlannerPlace, fallback = 90) {
  const explicitDuration = Number(place.estimatedDurationMinutes);

  if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
    return explicitDuration;
  }

  const text = normalizeText(
    `${place.name || ''} ${place.primaryType || ''} ${(place.types || []).join(' ')}`
  );

  if (text.includes('night_club') || text.includes('night club')) return 180;
  if (text.includes('movie_theater') || text.includes('cinema')) return 150;
  if (text.includes('museum') || text.includes('musee')) return 120;
  if (text.includes('art_gallery')) return 90;
  if (text.includes('zoo')) return 180;
  if (text.includes('aquarium')) return 120;
  if (text.includes('amusement_park') || text.includes('theme_park')) return 240;
  if (text.includes('hiking')) return 180;
  if (text.includes('park') || text.includes('parc')) return 90;
  if (text.includes('restaurant')) return 90;
  if (text.includes('fast_food')) return 35;
  if (text.includes('cafe')) return 45;
  if (text.includes('bar')) return 90;

  return fallback;
}

function getPrice(place: PlannerPlace, persons: number) {
  if (Number.isFinite(Number(place.priceTotal)) && Number(place.priceTotal) > 0) {
    return Number(place.priceTotal);
  }

  if (
    Number.isFinite(Number(place.pricePerPerson)) &&
    Number(place.pricePerPerson) >= 0
  ) {
    return Number(place.pricePerPerson) * persons;
  }

  return 0;
}

function getDateForDay(startDate: string | null | undefined, dayIndex: number) {
  if (!startDate) return undefined;

  const date = new Date(`${startDate}T12:00:00`);

  if (Number.isNaN(date.getTime())) return undefined;

  date.setDate(date.getDate() + dayIndex);

  return date.toISOString().slice(0, 10);
}

function getGoogleDay(date?: string) {
  if (!date) return null;

  const parsed = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.getDay();
}

function nextGoogleDay(day: number) {
  return (day + 1) % 7;
}

function isDayInsideSpan(openDay: number, closeDay: number, day: number) {
  if (openDay === closeDay) return day === openDay;

  if (openDay < closeDay) {
    return day > openDay && day < closeDay;
  }

  return day > openDay || day < closeDay;
}

function getOpeningIntervalsForDay(place: PlannerPlace, date?: string) {
  const periods = place.openingPeriods || [];

  if (!periods.length) return null;

  const googleDay = getGoogleDay(date);

  if (googleDay === null) return null;

  const intervals: { start: number; end: number }[] = [];

  periods.forEach((period) => {
    const openDay = Number(period.openDay);
    const closeDay = Number(period.closeDay);
    const openMinutes = Number(period.openHour) * 60 + Number(period.openMinute || 0);
    const closeMinutes =
      Number(period.closeHour) * 60 + Number(period.closeMinute || 0);

    if (!Number.isFinite(openDay) || !Number.isFinite(closeDay)) return;
    if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) return;

    if (openDay === closeDay) {
      if (googleDay !== openDay) return;

      if (closeMinutes <= openMinutes) {
        intervals.push({ start: openMinutes, end: 24 * 60 });
        return;
      }

      intervals.push({ start: openMinutes, end: closeMinutes });
      return;
    }

    if (googleDay === openDay) {
      intervals.push({ start: openMinutes, end: 24 * 60 });
      return;
    }

    if (googleDay === closeDay) {
      intervals.push({ start: 0, end: closeMinutes });
      return;
    }

    if (isDayInsideSpan(openDay, closeDay, googleDay)) {
      intervals.push({ start: 0, end: 24 * 60 });
      return;
    }

    if (nextGoogleDay(openDay) === googleDay && closeMinutes <= openMinutes) {
      intervals.push({ start: 0, end: closeMinutes });
    }
  });

  return intervals.sort((a, b) => a.start - b.start);
}

function isRangeInsideInterval(
  interval: { start: number; end: number },
  start: number,
  duration: number
) {
  const end = start + duration;

  return start >= interval.start && end <= interval.end;
}

export function isPlaceOpenAt(place: PlannerPlace, date: string | undefined, time: string) {
  const intervals = getOpeningIntervalsForDay(place, date);

  if (!intervals) return 'unknown';

  const minutes = timeToMinutes(time);

  const open = intervals.some(
    (interval) => minutes >= interval.start && minutes <= interval.end
  );

  return open ? 'open' : 'closed';
}

function isPlaceOpenDuring(
  place: PlannerPlace,
  date: string | undefined,
  startMinutes: number,
  durationMinutes: number
): 'open' | 'closed' | 'unknown' {
  const intervals = getOpeningIntervalsForDay(place, date);

  if (!intervals) return 'unknown';

  const open = intervals.some((interval) =>
    isRangeInsideInterval(interval, startMinutes, durationMinutes)
  );

  return open ? 'open' : 'closed';
}

function findAvailableStartForPlace({
  place,
  date,
  earliestStart,
  duration,
  latestEnd,
}: {
  place: PlannerPlace;
  date?: string;
  earliestStart: number;
  duration: number;
  latestEnd: number;
}) {
  const intervals = getOpeningIntervalsForDay(place, date);

  if (!intervals) return earliestStart;

  for (const interval of intervals) {
    const candidateStart = Math.max(earliestStart, interval.start);

    if (candidateStart + duration <= interval.end && candidateStart + duration <= latestEnd) {
      return candidateStart;
    }
  }

  return null;
}

function getCloseMinuteForStart(place: PlannerPlace, date: string | undefined, start: number) {
  const intervals = getOpeningIntervalsForDay(place, date);

  if (!intervals) return null;

  const interval = intervals.find(
    (item) => start >= item.start && start <= item.end
  );

  return interval?.end ?? null;
}

function makeEditableId(day: number, index: number, prefix: string) {
  return `day-${day}-${prefix}-${index}-${Date.now().toString(36)}`;
}

function createSlot({
  day,
  index,
  start,
  duration,
  title,
  type,
  place,
  persons,
  date,
  role,
  locked = false,
  travelTimeMinutes = 0,
  travelDistanceKm = 0,
}: {
  day: number;
  index: number;
  start: number;
  duration: number;
  title: string;
  type: PlanningSlotType;
  place?: PlannerPlace | null;
  persons: number;
  date?: string;
  role?: string;
  locked?: boolean;
  travelTimeMinutes?: number;
  travelDistanceKm?: number;
}): PlanningSlot {
  const startTime = minutesToTime(start);
  const endTime = minutesToTime(start + duration);
  const openingStatus = place
    ? isPlaceOpenDuring(place, date, start, duration)
    : 'unknown';

  const price = place ? getPrice(place, persons) : 0;

  const travelText =
    travelTimeMinutes > 0
      ? `Trajet estimé depuis l’étape précédente : ${travelTimeMinutes} min${
          travelDistanceKm > 0 ? ` • ${travelDistanceKm.toFixed(1)} km` : ''
        }.`
      : '';

  const descriptionParts = [place?.description || '', travelText].filter(Boolean);

  return {
    id: `${day}-${type}-${index}`,
    editableId: makeEditableId(day, index, String(type)),
    time: formatTimeRange(start, duration),
    startTime,
    endTime,
    title,
    subtitle: place?.address || '',
    description: descriptionParts.join('\n'),
    type,
    place: place || null,
    price,
    pricePerPerson: place?.pricePerPerson,
    totalPrice: price,
    travelTimeMinutes,
    travelDistanceKm,
    durationMinutes: duration,
    durationLabel: formatDurationLabel(duration),
    openingStatus,
    openingWarning:
      openingStatus === 'closed'
        ? 'Ce lieu semble fermé sur ce créneau. Horaires à vérifier.'
        : undefined,
    warning:
      openingStatus === 'closed'
        ? 'Ce lieu semble fermé sur ce créneau. Horaires à vérifier.'
        : null,
    address: place?.address || '',
    link: place?.link || place?.googleMapsUri || '',
    googleMapsUri: place?.googleMapsUri || '',
    lat: place?.lat,
    lng: place?.lng,
    source: place?.source,
    isReal: place?.isReal,
    locked,
    editable: !locked,
    removable: !locked,
    movable: !locked,
    role,
  };
}

function getTransportLabel(input: PlannerInput) {
  const raw =
    input.transport?.label ||
    input.transport?.name ||
    input.transport?.mode ||
    input.transport?.id ||
    input.transportId ||
    'transport';

  const normalized = normalizeText(String(raw));

  if (normalized.includes('plane') || normalized.includes('avion')) {
    return 'aéroport';
  }

  if (normalized.includes('train')) {
    return 'gare';
  }

  if (normalized.includes('bus')) {
    return 'gare routière';
  }

  if (normalized.includes('car') || normalized.includes('voiture')) {
    return 'point de départ';
  }

  return 'point de transport';
}

function getInputTransportId(input: PlannerInput) {
  return (
    input.transportId ||
    input.transport?.id ||
    input.transport?.mode ||
    'unknown'
  );
}

function scorePlaceCandidate({
  place,
  currentPoint,
  earliestStart,
  preferredStart,
  latestEnd,
  date,
  duration,
  transportId,
  closedPenalty,
}: {
  place: PlannerPlace;
  currentPoint: Point | null;
  earliestStart: number;
  preferredStart?: number;
  latestEnd: number;
  date?: string;
  duration: number;
  transportId?: PlannerTransportId;
  closedPenalty: number;
}): PickedPlace | null {
  const placePoint = getPoint(place);
  const distanceKm = calculateDistanceKm(currentPoint, placePoint);
  const travelTimeMinutes = estimateTravelMinutes(currentPoint, placePoint, transportId);

  const arrivalStart = Math.max(
    earliestStart + travelTimeMinutes,
    preferredStart || 0
  );

  const availableStart = findAvailableStartForPlace({
    place,
    date,
    earliestStart: arrivalStart,
    duration,
    latestEnd,
  });

  let start = availableStart;
  let openingStatus: 'open' | 'closed' | 'unknown' = 'unknown';
  let penalty = 0;

  if (start === null) {
    if (arrivalStart + duration > latestEnd) {
      return null;
    }

    start = arrivalStart;
    openingStatus = isPlaceOpenDuring(place, date, start, duration);
    penalty = closedPenalty;
  } else {
    openingStatus = isPlaceOpenDuring(place, date, start, duration);
  }

  if (start + duration > latestEnd) {
    return null;
  }

  const waitTime = Math.max(0, start - (earliestStart + travelTimeMinutes));
  const closeMinute = getCloseMinuteForStart(place, date, start);

  const closesEarlyBonus =
    closeMinute !== null && closeMinute < 17 * 60
      ? Math.max(0, (17 * 60 - closeMinute) / 10)
      : 0;

  const score =
    travelTimeMinutes * 1.25 +
    distanceKm * 2.5 +
    waitTime * 0.45 +
    penalty -
    closesEarlyBonus;

  return {
    place,
    start,
    duration,
    travelTimeMinutes,
    travelDistanceKm: distanceKm,
    openingStatus,
    score,
  };
}

function pickBestPlace({
  pool,
  currentPoint,
  earliestStart,
  preferredStart,
  latestEnd,
  date,
  transportId,
  fallbackDuration,
  maxDuration,
  closedPenalty = 500,
}: {
  pool: PlannerPlace[];
  currentPoint: Point | null;
  earliestStart: number;
  preferredStart?: number;
  latestEnd: number;
  date?: string;
  transportId?: PlannerTransportId;
  fallbackDuration: number;
  maxDuration: number;
  closedPenalty?: number;
}): PickedPlace | null {
  const candidates = pool
    .map((place) => {
      const duration = clampDuration(
        estimatePlaceDuration(place, fallbackDuration),
        30,
        maxDuration
      );

      return scorePlaceCandidate({
        place,
        currentPoint,
        earliestStart,
        preferredStart,
        latestEnd,
        date,
        duration,
        transportId,
        closedPenalty,
      });
    })
    .filter(Boolean) as PickedPlace[];

  if (!candidates.length) return null;

  const openCandidates = candidates.filter(
    (candidate) => candidate.openingStatus === 'open'
  );

  const unknownCandidates = candidates.filter(
    (candidate) => candidate.openingStatus === 'unknown'
  );

  const poolToUse =
    openCandidates.length > 0
      ? openCandidates
      : unknownCandidates.length > 0
        ? unknownCandidates
        : candidates;

  return poolToUse.sort((a, b) => a.score - b.score)[0] || null;
}

function createInfoSlot({
  day,
  index,
  start,
  duration,
  title,
  description,
}: {
  day: number;
  index: number;
  start: number;
  duration: number;
  title: string;
  description: string;
}): PlanningSlot {
  return {
    id: `${day}-info-${index}`,
    editableId: makeEditableId(day, index, 'info'),
    time: formatTimeRange(start, duration),
    startTime: minutesToTime(start),
    endTime: minutesToTime(start + duration),
    title,
    subtitle: '',
    description,
    type: 'info',
    price: 0,
    totalPrice: 0,
    durationMinutes: duration,
    durationLabel: formatDurationLabel(duration),
    openingStatus: 'unknown',
    warning: null,
    locked: false,
    editable: true,
    removable: true,
    movable: true,
  };
}

function addPickedSlot({
  slots,
  picked,
  day,
  index,
  type,
  persons,
  date,
}: {
  slots: PlanningSlot[];
  picked: PickedPlace;
  day: number;
  index: number;
  type: PlanningSlotType;
  persons: number;
  date?: string;
}) {
  slots.push(
    createSlot({
      day,
      index,
      start: picked.start,
      duration: picked.duration,
      title: picked.place.name,
      type,
      place: picked.place,
      persons,
      date,
      travelTimeMinutes: picked.travelTimeMinutes,
      travelDistanceKm: picked.travelDistanceKm,
    })
  );
}

function getNearestOrderedPlaces(
  places: PlannerPlace[],
  startPoint: Point | null,
  transportId?: PlannerTransportId
) {
  const remaining = [...places];
  const ordered: PlannerPlace[] = [];
  let currentPoint = startPoint;

  while (remaining.length > 0) {
    const next = remaining
      .map((place) => {
        const point = getPoint(place);
        const distance = calculateDistanceKm(currentPoint, point);
        const travel = estimateTravelMinutes(currentPoint, point, transportId);

        return {
          place,
          score: travel + distance * 2,
        };
      })
      .sort((a, b) => a.score - b.score)[0];

    if (!next) break;

    ordered.push(next.place);
    removeMatchingPlacesFromPool(remaining, next.place);
    currentPoint = getPoint(next.place) || currentPoint;
  }

  return ordered;
}

function removePickedEverywhere(
  place: PlannerPlace,
  activityPool: PlannerPlace[],
  restaurantPool: PlannerPlace[]
) {
  removeMatchingPlacesFromPool(activityPool, place);
  removeMatchingPlacesFromPool(restaurantPool, place);
}

function buildDay({
  input,
  day,
  dayIndex,
  date,
  activityPool,
  restaurantPool,
  stay,
  maxActivitiesForDay,
}: {
  input: PlannerInput;
  day: number;
  dayIndex: number;
  date?: string;
  activityPool: PlannerPlace[];
  restaurantPool: PlannerPlace[];
  stay?: PlannerPlace | null;
  maxActivitiesForDay: number;
}) {
  const persons = input.persons || DEFAULT_PERSONS;
  const dayCount = input.duration || input.days || DEFAULT_DAY_COUNT;
  const transportId = getInputTransportId(input);
  const transportLabel = getTransportLabel(input);
  const basePoint = getBasePoint(input, stay);

  const slots: PlanningSlot[] = [];

  let index = 0;
  let currentPoint = basePoint;
  let cursor = dayIndex === 0 ? FIRST_DAY_START : DAY_START;
  let scheduledActivities = 0;

  if (dayIndex === 0) {
    slots.push(
      createSlot({
        day,
        index: index++,
        start: 9 * 60,
        duration: 60,
        title: `Arrivée et installation à ${input.destination?.city || 'destination'}`,
        type: 'arrival',
        persons,
        date,
        role: 'start',
        locked: true,
      })
    );
  }

  while (
    activityPool.length > 0 &&
    scheduledActivities < Math.max(1, Math.ceil(maxActivitiesForDay / 2)) &&
    cursor < LUNCH_START - 30
  ) {
    const picked = pickBestPlace({
      pool: activityPool,
      currentPoint,
      earliestStart: cursor,
      latestEnd: LUNCH_START - 15,
      date,
      transportId,
      fallbackDuration: 90,
      maxDuration: 150,
    });

    if (!picked) break;

    addPickedSlot({
      slots,
      picked,
      day,
      index: index++,
      type: 'activity',
      persons,
      date,
    });

    removePickedEverywhere(picked.place, activityPool, restaurantPool);
    currentPoint = getPoint(picked.place) || currentPoint;
    cursor = picked.start + picked.duration + GAP_BETWEEN_STEPS;
    scheduledActivities += 1;
  }

  const lunchRestaurant = restaurantPool.length
    ? pickBestPlace({
        pool: restaurantPool,
        currentPoint,
        earliestStart: cursor,
        preferredStart: LUNCH_START,
        latestEnd: LUNCH_END,
        date,
        transportId,
        fallbackDuration: 90,
        maxDuration: 120,
        closedPenalty: 700,
      })
    : null;

  if (lunchRestaurant) {
    addPickedSlot({
      slots,
      picked: lunchRestaurant,
      day,
      index: index++,
      type: 'restaurant',
      persons,
      date,
    });

    removePickedEverywhere(lunchRestaurant.place, activityPool, restaurantPool);
    currentPoint = getPoint(lunchRestaurant.place) || currentPoint;
    cursor = lunchRestaurant.start + lunchRestaurant.duration + GAP_BETWEEN_STEPS;
  }

  cursor = Math.max(cursor, AFTERNOON_START);

  while (
    activityPool.length > 0 &&
    scheduledActivities < maxActivitiesForDay &&
    cursor < DAY_END - 45
  ) {
    const latestEnd = restaurantPool.length > 0 ? DINNER_START - 30 : DAY_END;

    const picked = pickBestPlace({
      pool: activityPool,
      currentPoint,
      earliestStart: cursor,
      latestEnd,
      date,
      transportId,
      fallbackDuration: 90,
      maxDuration: 180,
    });

    if (!picked) break;

    addPickedSlot({
      slots,
      picked,
      day,
      index: index++,
      type: 'activity',
      persons,
      date,
    });

    removePickedEverywhere(picked.place, activityPool, restaurantPool);
    currentPoint = getPoint(picked.place) || currentPoint;
    cursor = picked.start + picked.duration + GAP_BETWEEN_STEPS;
    scheduledActivities += 1;
  }

  const dinnerRestaurant = restaurantPool.length
    ? pickBestPlace({
        pool: restaurantPool,
        currentPoint,
        earliestStart: cursor,
        preferredStart: DINNER_START,
        latestEnd: DINNER_END,
        date,
        transportId,
        fallbackDuration: 90,
        maxDuration: 120,
        closedPenalty: 700,
      })
    : null;

  if (dinnerRestaurant) {
    addPickedSlot({
      slots,
      picked: dinnerRestaurant,
      day,
      index: index++,
      type: 'restaurant',
      persons,
      date,
    });

    removePickedEverywhere(dinnerRestaurant.place, activityPool, restaurantPool);
    currentPoint = getPoint(dinnerRestaurant.place) || currentPoint;
    cursor = dinnerRestaurant.start + dinnerRestaurant.duration + GAP_BETWEEN_STEPS;
  }

  if (stay && dayIndex < dayCount - 1) {
    const stayPoint = getPoint(stay);
    const travelDistanceKm = calculateDistanceKm(currentPoint, stayPoint);
    const travelTimeMinutes = estimateTravelMinutes(currentPoint, stayPoint, transportId);
    const returnStart = Math.max(cursor + travelTimeMinutes, 18 * 60);

    slots.push(
      createSlot({
        day,
        index: index++,
        start: returnStart,
        duration: 30,
        title: `Retour à l’hébergement : ${stay.name}`,
        type: 'return-base',
        place: stay,
        persons,
        date,
        role: 'return-base',
        locked: true,
        travelTimeMinutes,
        travelDistanceKm,
      })
    );

    currentPoint = stayPoint || currentPoint;
    cursor = returnStart + 30;
  }

  if (dayIndex === dayCount - 1) {
    const destinationPoint = getPoint(input.destination);
    const travelDistanceKm = calculateDistanceKm(currentPoint, destinationPoint);
    const travelTimeMinutes = estimateTravelMinutes(
      currentPoint,
      destinationPoint,
      transportId
    );

    const returnStart = Math.max(cursor + travelTimeMinutes, FINAL_RETURN_START);

    slots.push(
      createSlot({
        day,
        index: index++,
        start: returnStart,
        duration: 60,
        title: `Retour vers ${transportLabel}`,
        type: 'return-trip',
        persons,
        date,
        role: 'return-trip',
        locked: true,
        travelTimeMinutes,
        travelDistanceKm,
      })
    );
  }

  if (slots.length <= (dayIndex === 0 ? 2 : 1)) {
    slots.push(
      createInfoSlot({
        day,
        index: index++,
        start: 11 * 60,
        duration: 90,
        title: 'Temps libre',
        description:
          'Aucune activité supplémentaire n’a pu être placée proprement sur ce créneau. Vous pouvez ajouter manuellement du temps libre ou ajuster le planning.',
      })
    );
  }

  const sortedSlots = [...slots].sort(
    (a, b) => timeToMinutes(a.startTime || '00:00') - timeToMinutes(b.startTime || '00:00')
  );

  const totalCost = sortedSlots.reduce(
    (sum, slot) => sum + Number(slot.price || 0),
    0
  );

  const totalDurationMinutes = sortedSlots.reduce(
    (sum, slot) => sum + Number(slot.durationMinutes || 0),
    0
  );

  const totalTravelMinutes = sortedSlots.reduce(
    (sum, slot) => sum + Number(slot.travelTimeMinutes || 0),
    0
  );

  const warnings = sortedSlots
    .filter((slot) => slot.warning || slot.openingWarning)
    .map((slot) => String(slot.warning || slot.openingWarning));

  return {
    day,
    date,
    title: `Jour ${day}`,
    summary: `${sortedSlots.length} étape(s) optimisée(s) • trajets estimés ${totalTravelMinutes} min`,
    slots: sortedSlots,
    totalCost,
    totalDurationMinutes,
    warnings,
  };
}

export function optimizeTripPlanning(input: PlannerInput): OptimizedDay[] {
  const dayCount = Math.max(
    1,
    Number(input.duration || input.days || DEFAULT_DAY_COUNT)
  );

  const startDate = input.startDate || input.start || undefined;

  const rawActivities = input.activities || input.selections?.activities || [];
  const rawRestaurants = input.restaurants || input.selections?.restaurants || [];
  const rawStays = input.stays || input.selections?.stays || [];

  const stays = dedupePlaces(rawStays);
  const stay = stays[0] || null;

  const restaurants = dedupePlaces(filterOutMatchingPlaces(rawRestaurants, stays));
  const activities = dedupePlaces(
    filterOutMatchingPlaces(rawActivities, [...stays, ...restaurants])
  );

  const basePoint = getBasePoint(input, stay);
  const transportId = getInputTransportId(input);

  const activityPool = getNearestOrderedPlaces(activities, basePoint, transportId);
  const restaurantPool = getNearestOrderedPlaces(restaurants, basePoint, transportId);

  const days: OptimizedDay[] = [];

  for (let index = 0; index < dayCount; index += 1) {
    const remainingDays = Math.max(1, dayCount - index);
    const maxActivitiesForDay = Math.max(
      1,
      Math.ceil(activityPool.length / remainingDays)
    );

    const day = index + 1;
    const date = getDateForDay(startDate, index);

    days.push(
      buildDay({
        input,
        day,
        dayIndex: index,
        date,
        activityPool,
        restaurantPool,
        stay,
        maxActivitiesForDay,
      })
    );
  }

  return days;
}

export function generateOptimizedPlanning(input: PlannerInput) {
  return optimizeTripPlanning(input);
}

export function buildOptimizedPlanning(input: PlannerInput) {
  return optimizeTripPlanning(input);
}

export function createOptimizedPlanning(input: PlannerInput) {
  return optimizeTripPlanning(input);
}

export function buildTripPlanning(input: PlannerInput) {
  return optimizeTripPlanning(input);
}

export function createTripPlanning(input: PlannerInput) {
  return optimizeTripPlanning(input);
}

export function normalizePlanningDays(days: OptimizedDay[]) {
  return days.map((day, dayIndex) => ({
    ...day,
    day: day.day || dayIndex + 1,
    slots: (day.slots || []).map((slot, slotIndex) => ({
      ...slot,
      id: slot.id || `${dayIndex + 1}-slot-${slotIndex}`,
      editableId:
        slot.editableId || `${dayIndex + 1}-editable-${slotIndex}-${Date.now()}`,
      editable: slot.editable ?? !slot.locked,
      removable: slot.removable ?? !slot.locked,
      movable: slot.movable ?? !slot.locked,
      warning: slot.warning || slot.openingWarning || null,
    })),
  }));
}