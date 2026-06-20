type CalendarSlot = {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  durationLabel?: string;
  type?: string;
  price?: number;
  totalPrice?: number;
};

type CalendarDay = {
  day?: number;
  title?: string;
  date?: string;
  slots?: CalendarSlot[];
};

type CalendarExportInput = {
  tripTitle: string;
  city: string;
  country: string;
  startDate?: string | null;
  duration: number;
  days: CalendarDay[];
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function escapeIcsText(value: string) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function normalizeDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;

  const cleaned = String(value).replace('h', ':').trim();
  const [rawHours, rawMinutes] = cleaned.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes || 0);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function getSlotStartMinutes(slot: CalendarSlot) {
  if (slot.startTime) {
    return parseTimeToMinutes(slot.startTime);
  }

  const raw = String(slot.time || '');
  const firstPart = raw.split('-')[0]?.trim();

  return parseTimeToMinutes(firstPart);
}

function getSlotDurationMinutes(slot: CalendarSlot) {
  if (
    Number.isFinite(Number(slot.durationMinutes)) &&
    Number(slot.durationMinutes) > 0
  ) {
    return Number(slot.durationMinutes);
  }

  if (slot.startTime && slot.endTime) {
    const start = parseTimeToMinutes(slot.startTime);
    let end = parseTimeToMinutes(slot.endTime);

    if (start !== null && end !== null) {
      if (end < start) end += 24 * 60;

      const diff = end - start;

      if (diff > 0) return diff;
    }
  }

  const raw = String(slot.time || '');

  if (raw.includes('-')) {
    const [rawStart, rawEnd] = raw.split('-').map((part) => part.trim());
    const start = parseTimeToMinutes(rawStart);
    let end = parseTimeToMinutes(rawEnd);

    if (start !== null && end !== null) {
      if (end < start) end += 24 * 60;

      const diff = end - start;

      if (diff > 0) return diff;
    }
  }

  const type = String(slot.type || '').toLowerCase();

  if (type.includes('restaurant')) return 90;
  if (type.includes('free')) return 60;
  if (type.includes('wake')) return 60;
  if (type.includes('arrival')) return 60;
  if (type.includes('departure')) return 60;

  return 90;
}

function formatIcsFloatingDateTime(date: Date, minutesFromMidnight: number) {
  const dayOffset = Math.floor(minutesFromMidnight / (24 * 60));
  const minutesInDay = minutesFromMidnight % (24 * 60);
  const eventDate = addDays(date, dayOffset);

  const hours = Math.floor(minutesInDay / 60);
  const minutes = minutesInDay % 60;

  return `${eventDate.getFullYear()}${pad(eventDate.getMonth() + 1)}${pad(
    eventDate.getDate()
  )}T${pad(hours)}${pad(minutes)}00`;
}

function formatIcsDate(date: Date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function formatIcsTimestamp(date = new Date()) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
    date.getUTCSeconds()
  )}Z`;
}

function getDayDate(baseDate: Date, day: CalendarDay, dayIndex: number) {
  const parsedDayDate = normalizeDate(day.date);

  if (parsedDayDate) return parsedDayDate;

  const dayNumber = Number(day.day || dayIndex + 1);
  const offset = Number.isFinite(dayNumber) ? Math.max(0, dayNumber - 1) : dayIndex;

  return addDays(baseDate, offset);
}

function buildSlotDescription(slot: CalendarSlot, city: string, country: string) {
  const parts = [
    slot.subtitle,
    slot.description,
    slot.durationLabel ? `Durée : ${slot.durationLabel}` : '',
    Number(slot.price || slot.totalPrice || 0) > 0
      ? `Budget estimé : ${Math.round(Number(slot.price || slot.totalPrice || 0))}€`
      : '',
    `Voyage Gototrip : ${city}, ${country}`,
  ].filter(Boolean);

  return parts.join('\n');
}

function safeFilename(value: string) {
  return String(value || 'voyage')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildGototripCalendarIcs(input: CalendarExportInput) {
  const baseDate =
    normalizeDate(input.startDate) ||
    normalizeDate(new Date().toISOString().slice(0, 10));

  if (!baseDate) {
    throw new Error('Date de départ invalide.');
  }

  const duration = Math.max(1, Number(input.duration || input.days.length || 1));
  const tripEndDate = addDays(baseDate, duration);
  const dtstamp = formatIcsTimestamp();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gototrip//Planning voyage//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(input.tripTitle)}`,
    'BEGIN:VEVENT',
    `UID:gototrip-trip-${Date.now()}@gototrip.net`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(baseDate)}`,
    `DTEND;VALUE=DATE:${formatIcsDate(tripEndDate)}`,
    `SUMMARY:${escapeIcsText(input.tripTitle)}`,
    `DESCRIPTION:${escapeIcsText(
      `Voyage planifié avec Gototrip à ${input.city}, ${input.country}.`
    )}`,
    `LOCATION:${escapeIcsText(`${input.city}, ${input.country}`)}`,
    'END:VEVENT',
  ];

  input.days.forEach((day, dayIndex) => {
    const dayDate = getDayDate(baseDate, day, dayIndex);

    (day.slots || []).forEach((slot, slotIndex) => {
      const startMinutes = getSlotStartMinutes(slot);

      if (startMinutes === null) return;

      const durationMinutes = getSlotDurationMinutes(slot);
      const endMinutes = startMinutes + durationMinutes;

      const title = slot.title || 'Étape du voyage';
      const description = buildSlotDescription(slot, input.city, input.country);

      lines.push(
        'BEGIN:VEVENT',
        `UID:gototrip-${dayIndex + 1}-${slotIndex + 1}-${Date.now()}@gototrip.net`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${formatIcsFloatingDateTime(dayDate, startMinutes)}`,
        `DTEND:${formatIcsFloatingDateTime(dayDate, endMinutes)}`,
        `SUMMARY:${escapeIcsText(title)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        `LOCATION:${escapeIcsText(`${input.city}, ${input.country}`)}`,
        'END:VEVENT'
      );
    });
  });

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

export function downloadIcsFile(filename: string, content: string) {
  const blob = new Blob([content], {
    type: 'text/calendar;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${safeFilename(filename)}.ics`;

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}