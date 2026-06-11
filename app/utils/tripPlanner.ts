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

const DEFAULT_DAY_COUNT = 2;
const DEFAULT_PERSONS = 1;

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
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

export function estimateTravelMinutes(
  from?: { lat?: number; lng?: number } | null,
  to?: { lat?: number; lng?: number } | null
) {
  const distanceKm = calculateDistanceKm(from, to);

  if (!distanceKm) return 15;
  if (distanceKm < 1) return 10;
  if (distanceKm < 3) return 15;
  if (distanceKm < 6) return 25;
  if (distanceKm < 12) return 35;

  return Math.min(75, Math.round(distanceKm * 4));
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

function periodContainsMinutes(
  period: PlannerOpeningPeriod,
  googleDay: number,
  minutes: number
) {
  const openDay = Number(period.openDay);
  const closeDay = Number(period.closeDay);
  const openMinutes = Number(period.openHour) * 60 + Number(period.openMinute || 0);
  let closeMinutes = Number(period.closeHour) * 60 + Number(period.closeMinute || 0);

  if (!Number.isFinite(openDay) || !Number.isFinite(closeDay)) return false;
  if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) return false;

  if (openDay === closeDay) {
    return googleDay === openDay && minutes >= openMinutes && minutes <= closeMinutes;
  }

  if (googleDay === openDay) {
    return minutes >= openMinutes;
  }

  if (googleDay === closeDay) {
    return minutes <= closeMinutes;
  }

  return false;
}

export function isPlaceOpenAt(place: PlannerPlace, date: string | undefined, time: string) {
  const periods = place.openingPeriods || [];

  if (!periods.length) return 'unknown';

  const googleDay = getGoogleDay(date);

  if (googleDay === null) return 'unknown';

  const minutes = timeToMinutes(time);

  const open = periods.some((period) =>
    periodContainsMinutes(period, googleDay, minutes)
  );

  return open ? 'open' : 'closed';
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
}): PlanningSlot {
  const startTime = minutesToTime(start);
  const endTime = minutesToTime(start + duration);
  const openingStatus = place ? isPlaceOpenAt(place, date, startTime) : 'unknown';
  const price = place ? getPrice(place, persons) : 0;

  return {
    id: `${day}-${type}-${index}`,
    editableId: makeEditableId(day, index, String(type)),
    time: formatTimeRange(start, duration),
    startTime,
    endTime,
    title,
    subtitle: place?.address || '',
    description: place?.description || '',
    type,
    place: place || null,
    price,
    pricePerPerson: place?.pricePerPerson,
    totalPrice: price,
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

function splitByDay<T>(items: T[], dayCount: number) {
  const safeDayCount = Math.max(1, dayCount);
  const result: T[][] = Array.from({ length: safeDayCount }, () => []);

  items.forEach((item, index) => {
    result[index % safeDayCount].push(item);
  });

  return result;
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

function buildDay({
  input,
  day,
  dayIndex,
  date,
  activities,
  restaurants,
  stay,
}: {
  input: PlannerInput;
  day: number;
  dayIndex: number;
  date?: string;
  activities: PlannerPlace[];
  restaurants: PlannerPlace[];
  stay?: PlannerPlace | null;
}) {
  const persons = input.persons || DEFAULT_PERSONS;
  const dayCount = input.duration || input.days || DEFAULT_DAY_COUNT;
  const transportLabel = getTransportLabel(input);
  const slots: PlanningSlot[] = [];

  let index = 0;

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

  const morningStart = dayIndex === 0 ? 10 * 60 + 30 : 9 * 60;
  const lunchStart = 12 * 60 + 15;
  const afternoonStart = 14 * 60 + 15;
  const dinnerStart = 20 * 60;

  const morningActivity = activities[0];
  const afternoonActivity = activities[1] || activities[0];
  const lunchRestaurant = restaurants[0];
  const dinnerRestaurant = restaurants[1] || restaurants[0];

  if (morningActivity) {
    const duration = Math.min(150, estimatePlaceDuration(morningActivity, 90));

    slots.push(
      createSlot({
        day,
        index: index++,
        start: morningStart,
        duration,
        title: morningActivity.name,
        type: 'activity',
        place: morningActivity,
        persons,
        date,
      })
    );
  }

  if (lunchRestaurant) {
    const duration = Math.min(120, estimatePlaceDuration(lunchRestaurant, 90));

    slots.push(
      createSlot({
        day,
        index: index++,
        start: lunchStart,
        duration,
        title: lunchRestaurant.name,
        type: 'restaurant',
        place: lunchRestaurant,
        persons,
        date,
      })
    );
  }

  if (afternoonActivity && afternoonActivity.id !== morningActivity?.id) {
    const duration = Math.min(180, estimatePlaceDuration(afternoonActivity, 90));

    slots.push(
      createSlot({
        day,
        index: index++,
        start: afternoonStart,
        duration,
        title: afternoonActivity.name,
        type: 'activity',
        place: afternoonActivity,
        persons,
        date,
      })
    );
  }

  if (dinnerRestaurant && dinnerRestaurant.id !== lunchRestaurant?.id) {
    const duration = Math.min(120, estimatePlaceDuration(dinnerRestaurant, 90));

    slots.push(
      createSlot({
        day,
        index: index++,
        start: dinnerStart,
        duration,
        title: dinnerRestaurant.name,
        type: 'restaurant',
        place: dinnerRestaurant,
        persons,
        date,
      })
    );
  }

  if (stay && dayIndex < dayCount - 1) {
    slots.push(
      createSlot({
        day,
        index: index++,
        start: 21 * 60 + 45,
        duration: 30,
        title: `Retour à l’hébergement : ${stay.name}`,
        type: 'return-base',
        place: stay,
        persons,
        date,
        role: 'return-base',
        locked: true,
      })
    );
  }

  if (dayIndex === dayCount - 1) {
    slots.push(
      createSlot({
        day,
        index: index++,
        start: 17 * 60,
        duration: 60,
        title: `Retour vers ${transportLabel}`,
        type: 'return-trip',
        persons,
        date,
        role: 'return-trip',
        locked: true,
      })
    );
  }

  const totalCost = slots.reduce((sum, slot) => sum + Number(slot.price || 0), 0);
  const totalDurationMinutes = slots.reduce(
    (sum, slot) => sum + Number(slot.durationMinutes || 0),
    0
  );

  const warnings = slots
    .filter((slot) => slot.warning || slot.openingWarning)
    .map((slot) => String(slot.warning || slot.openingWarning));

  return {
    day,
    date,
    title: `Jour ${day}`,
    summary: `${slots.length} étape(s) prévue(s)`,
    slots,
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

  const activities = input.activities || input.selections?.activities || [];
  const restaurants = input.restaurants || input.selections?.restaurants || [];
  const stays = input.stays || input.selections?.stays || [];

  const activitiesByDay = splitByDay(activities, dayCount);
  const restaurantsByDay = splitByDay(restaurants, dayCount);
  const stay = stays[0] || null;

  return Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const date = getDateForDay(startDate, index);

    return buildDay({
      input,
      day,
      dayIndex: index,
      date,
      activities: activitiesByDay[index] || [],
      restaurants: restaurantsByDay[index] || [],
      stay,
    });
  });
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