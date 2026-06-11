'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Clock,
  GripVertical,
  Minus,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import type { OptimizedDay, PlanningSlot } from '../utils/tripPlanner';

type EditableSlot = PlanningSlot & {
  editableId?: string;
  customDurationMinutes?: number;
  warning?: string | null;
  dayIndex?: number;
};

type EditableDay = OptimizedDay & {
  slots: EditableSlot[];
};

type PlanningEditorProps = {
  planning?: OptimizedDay[];
  days?: OptimizedDay[];
  initialDays?: OptimizedDay[];
  value?: OptimizedDay[];
  onChange?: (days: OptimizedDay[]) => void;
  onPlanningChange?: (days: OptimizedDay[]) => void;
  onReset?: () => void;
  title?: string;
  subtitle?: string;
  storageKey?: string;
  [key: string]: any;
};

const WAKE_BASE_START = 7 * 60;
const WAKE_BASE_END = 8 * 60;
const DAY_START = 9 * 60;
const LUNCH_START = 12 * 60 + 1;
const AFTERNOON_START = 14 * 60 + 1;
const DINNER_START = 20 * 60 + 1;
const NIGHT_END = 30 * 60;
const GAP = 15;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function minutesToTime(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;

  if (hours >= 24) {
    return `${pad(hours - 24)}:${pad(minutes)}`;
  }

  return `${pad(hours)}:${pad(minutes)}`;
}

function timeToMinutes(value?: string) {
  if (!value) return 0;

  const cleaned = String(value).replace('h', ':').trim();
  const [rawHours, rawMinutes] = cleaned.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes || 0);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;

  return hours * 60 + minutes;
}

function parseStartFromSlot(slot: EditableSlot) {
  if (slot.startTime) return timeToMinutes(slot.startTime);

  const raw = String(slot.time || '');
  const firstPart = raw.split('-')[0]?.trim();

  return timeToMinutes(firstPart);
}

function parseDurationFromSlot(slot: EditableSlot) {
  if (Number.isFinite(Number(slot.customDurationMinutes))) {
    return Math.max(15, Number(slot.customDurationMinutes));
  }

  if (Number.isFinite(Number(slot.durationMinutes)) && Number(slot.durationMinutes) > 0) {
    return Number(slot.durationMinutes);
  }

  if (slot.startTime && slot.endTime) {
    const start = timeToMinutes(slot.startTime);
    let end = timeToMinutes(slot.endTime);

    if (end < start) end += 24 * 60;

    const diff = end - start;

    if (diff > 0) return diff;
  }

  const raw = String(slot.time || '');

  if (raw.includes('-')) {
    const [rawStart, rawEnd] = raw.split('-').map((part) => part.trim());
    const start = timeToMinutes(rawStart);
    let end = timeToMinutes(rawEnd);

    if (end < start) end += 24 * 60;

    const diff = end - start;

    if (diff > 0) return diff;
  }

  const type = String(slot.type || '').toLowerCase();

  if (type.includes('restaurant')) return 90;
  if (type.includes('wake')) return 60;
  if (type.includes('free')) return 60;
  if (type.includes('return')) return 30;
  if (type.includes('arrival')) return 60;
  if (type.includes('departure')) return 60;

  return 90;
}

function formatTimeRange(start: number, duration: number) {
  return `${minutesToTime(start)} - ${minutesToTime(start + duration)}`;
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));

  if (safe < 60) return `${safe} min`;

  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  if (mins === 0) return `${hours}h`;

  return `${hours}h${pad(mins)}`;
}

function makeEditableId(dayIndex: number, slotIndex: number) {
  return `editable-${dayIndex}-${slotIndex}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getInitialDays(props: PlanningEditorProps) {
  return (
    props.planning ||
    props.days ||
    props.initialDays ||
    props.value ||
    []
  );
}

function normalizeSlot(slot: PlanningSlot, dayIndex: number, slotIndex: number): EditableSlot {
  const duration = parseDurationFromSlot(slot as EditableSlot);
  const start = parseStartFromSlot(slot as EditableSlot);
  const end = start + duration;

  return {
    ...slot,
    id: slot.id || `${dayIndex + 1}-slot-${slotIndex}`,
    editableId:
      (slot as EditableSlot).editableId || makeEditableId(dayIndex, slotIndex),
    startTime: slot.startTime || minutesToTime(start),
    endTime: slot.endTime || minutesToTime(end),
    time: slot.time || formatTimeRange(start, duration),
    durationMinutes: duration,
    durationLabel: slot.durationLabel || formatDuration(duration),
    customDurationMinutes: duration,
    warning: (slot as EditableSlot).warning || slot.openingWarning || null,
    dayIndex,
    editable: slot.editable ?? !slot.locked,
    removable: slot.removable ?? !slot.locked,
    movable: slot.movable ?? !slot.locked,
  };
}

function normalizeDays(days: OptimizedDay[]): EditableDay[] {
  return (days || []).map((day, dayIndex) => ({
    ...day,
    day: day.day || dayIndex + 1,
    title: day.title || `Jour ${dayIndex + 1}`,
    slots: (day.slots || []).map((slot, slotIndex) =>
      normalizeSlot(slot, dayIndex, slotIndex)
    ),
  }));
}

function getSlotRole(slot: EditableSlot) {
  const role = String(slot.role || '').toLowerCase();
  const type = String(slot.type || '').toLowerCase();
  const title = String(slot.title || '').toLowerCase();

  if (role.includes('start') || type.includes('arrival') || title.includes('arrivée')) {
    return 'start';
  }

  if (
    role.includes('return-trip') ||
    type.includes('return-trip') ||
    title.includes('retour vers') ||
    title.includes('aéroport') ||
    title.includes('gare')
  ) {
    return 'return-trip';
  }

  if (
    role.includes('return-base') ||
    type.includes('return-base') ||
    title.includes('retour à l’hébergement') ||
    title.includes("retour a l'hebergement") ||
    title.includes('retour hébergement') ||
    title.includes('retour hebergement')
  ) {
    return 'return-base';
  }

  return 'editable';
}

function isWakeSlot(slot: EditableSlot) {
  const type = String(slot.type || '').toLowerCase();
  const title = String(slot.title || '').toLowerCase();

  return type.includes('wake') || title.includes('lever plus tard');
}

function isFreeSlot(slot: EditableSlot) {
  const type = String(slot.type || '').toLowerCase();
  const title = String(slot.title || '').toLowerCase();

  return type.includes('free') || title.includes('temps libre');
}

function isRestaurantSlot(slot: EditableSlot) {
  const type = String(slot.type || '').toLowerCase();

  return type.includes('restaurant');
}

function isNightSlot(slot: EditableSlot) {
  const type = String(slot.type || '').toLowerCase();
  const title = String(slot.title || '').toLowerCase();

  return (
    type.includes('night') ||
    title.includes('boîte') ||
    title.includes('boite') ||
    title.includes('soirée') ||
    title.includes('soiree') ||
    title.includes('night')
  );
}

function dedupeSlots(slots: EditableSlot[]) {
  let hasReturnBase = false;
  let hasReturnTrip = false;

  return slots.filter((slot) => {
    const role = getSlotRole(slot);

    if (role === 'return-base') {
      if (hasReturnBase) return false;
      hasReturnBase = true;
    }

    if (role === 'return-trip') {
      if (hasReturnTrip) return false;
      hasReturnTrip = true;
    }

    return true;
  });
}

function updateSlotTime(slot: EditableSlot, start: number, duration: number): EditableSlot {
  const end = start + duration;
  let warning = slot.warning || null;

  if (isNightSlot(slot) && end > NIGHT_END) {
    warning = 'Ce créneau dépasse la plage soirée / nuit.';
  }

  return {
    ...slot,
    startTime: minutesToTime(start),
    endTime: minutesToTime(end),
    time: formatTimeRange(start, duration),
    durationMinutes: duration,
    durationLabel: formatDuration(duration),
    customDurationMinutes: duration,
    warning,
  };
}

function recalculateDay(day: EditableDay): EditableDay {
  const cleanSlots = dedupeSlots(day.slots || []);

  const startSlots = cleanSlots.filter((slot) => getSlotRole(slot) === 'start');
  const returnBaseSlots = cleanSlots.filter((slot) => getSlotRole(slot) === 'return-base');
  const returnTripSlots = cleanSlots.filter((slot) => getSlotRole(slot) === 'return-trip');

  const editableSlots = cleanSlots.filter((slot) => getSlotRole(slot) === 'editable');

  const wakeSlots = editableSlots.filter(isWakeSlot);
  const normalSlots = editableSlots.filter((slot) => !isWakeSlot(slot));

  const wakeDelay = wakeSlots.reduce(
    (sum, slot) => sum + Math.max(0, parseDurationFromSlot(slot)),
    0
  );

  const recalculatedWakeSlots = wakeSlots.map((slot, index) => {
    const duration = parseDurationFromSlot(slot);
    const start = WAKE_BASE_END + wakeSlots
      .slice(0, index)
      .reduce((sum, item) => sum + parseDurationFromSlot(item), 0);

    return updateSlotTime(slot, start, duration);
  });

  let cursor = Math.max(DAY_START + wakeDelay, DAY_START);

  const recalculatedNormalSlots: EditableSlot[] = [];
  let restaurantCount = 0;

  normalSlots.forEach((slot) => {
    const duration = parseDurationFromSlot(slot);
    let start = cursor;

    if (isRestaurantSlot(slot)) {
      restaurantCount += 1;

      if (restaurantCount === 1 && cursor <= AFTERNOON_START) {
        start = Math.max(cursor, LUNCH_START);
      } else {
        start = Math.max(cursor, DINNER_START);
      }
    } else if (isNightSlot(slot)) {
      start = Math.max(cursor, DINNER_START + 90);
    }

    const updatedSlot = updateSlotTime(slot, start, duration);

    recalculatedNormalSlots.push(updatedSlot);
    cursor = start + duration + GAP;
  });

  const lastNormalEnd =
    recalculatedNormalSlots.length > 0
      ? Math.max(
          ...recalculatedNormalSlots.map((slot) =>
            timeToMinutes(slot.endTime || String(slot.time || '').split('-')[1])
          )
        )
      : cursor;

  const recalculatedReturnBase = returnBaseSlots.map((slot, index) => {
    const duration = parseDurationFromSlot(slot);
    const start = Math.max(lastNormalEnd + GAP + index * (duration + GAP), 21 * 60 + 30);

    return updateSlotTime(slot, start, duration);
  });

  const recalculatedReturnTrip = returnTripSlots.map((slot, index) => {
    const duration = parseDurationFromSlot(slot);
    const naturalStart = Math.max(lastNormalEnd + GAP + index * (duration + GAP), 17 * 60);

    return updateSlotTime(slot, naturalStart, duration);
  });

  const nextSlots = [
    ...startSlots,
    ...recalculatedWakeSlots,
    ...recalculatedNormalSlots,
    ...recalculatedReturnBase,
    ...recalculatedReturnTrip,
  ].map((slot, slotIndex) => ({
    ...slot,
    editableId: slot.editableId || makeEditableId(day.day || 1, slotIndex),
    dayIndex: (day.day || 1) - 1,
  }));

  const totalCost = nextSlots.reduce(
    (sum, slot) => sum + Number(slot.price || slot.totalPrice || 0),
    0
  );

  const totalDurationMinutes = nextSlots.reduce(
    (sum, slot) => sum + Number(slot.durationMinutes || 0),
    0
  );

  const warnings = nextSlots
    .map((slot) => slot.warning || slot.openingWarning)
    .filter(Boolean) as string[];

  return {
    ...day,
    slots: nextSlots,
    totalCost,
    totalDurationMinutes,
    warnings,
    summary: `${nextSlots.length} étape(s) prévue(s)`,
  };
}

function recalculateAllDays(days: EditableDay[]) {
  return days.map((day) => recalculateDay(day));
}

function createFreeTimeSlot(dayIndex: number, duration = 60): EditableSlot {
  return {
    id: `free-${Date.now()}`,
    editableId: makeEditableId(dayIndex, Date.now()),
    title: 'Temps libre',
    subtitle: 'Pause ajoutée manuellement',
    description: 'Temps libre ajouté pour garder un rythme plus souple.',
    type: 'free-time',
    time: formatTimeRange(DAY_START, duration),
    startTime: minutesToTime(DAY_START),
    endTime: minutesToTime(DAY_START + duration),
    durationMinutes: duration,
    durationLabel: formatDuration(duration),
    customDurationMinutes: duration,
    warning: null,
    price: 0,
    totalPrice: 0,
    editable: true,
    removable: true,
    movable: true,
    locked: false,
    dayIndex,
  };
}

function createWakeSlot(dayIndex: number, duration = 60): EditableSlot {
  return {
    id: `wake-${Date.now()}`,
    editableId: makeEditableId(dayIndex, Date.now()),
    title: 'Se lever plus tard',
    subtitle: 'Départ de journée décalé',
    description: 'Décale automatiquement les activités suivantes.',
    type: 'wake-up',
    time: formatTimeRange(WAKE_BASE_START, duration),
    startTime: minutesToTime(WAKE_BASE_START),
    endTime: minutesToTime(WAKE_BASE_START + duration),
    durationMinutes: duration,
    durationLabel: formatDuration(duration),
    customDurationMinutes: duration,
    warning: null,
    price: 0,
    totalPrice: 0,
    editable: true,
    removable: true,
    movable: true,
    locked: false,
    dayIndex,
  };
}

function DurationSelector({
  label,
  duration,
  onDecrease,
  onIncrease,
}: {
  label: string;
  duration: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>

      <button
        type="button"
        onClick={onDecrease}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
        aria-label="Réduire la durée"
      >
        <Minus className="h-4 w-4" />
      </button>

      <span className="min-w-16 text-center font-bold text-slate-900">
        {formatDuration(duration)}
      </span>

      <button
        type="button"
        onClick={onIncrease}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
        aria-label="Augmenter la durée"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PlanningEditor(props: PlanningEditorProps) {
  const storageKey = props.storageKey || 'gt_custom_planning';

  const incomingDays = useMemo(() => getInitialDays(props), [props]);
  const [days, setDays] = useState<EditableDay[]>(() => normalizeDays(incomingDays));
  const [dragged, setDragged] = useState<{ dayIndex: number; slotIndex: number } | null>(
    null
  );

  useEffect(() => {
    const normalized = normalizeDays(incomingDays);

    try {
      const rawCustom = localStorage.getItem(storageKey);

      if (rawCustom) {
        const parsed = JSON.parse(rawCustom);

        if (Array.isArray(parsed) && parsed.length > 0) {
          setDays(recalculateAllDays(normalizeDays(parsed)));
          return;
        }
      }
    } catch {
      setDays(recalculateAllDays(normalized));
      return;
    }

    setDays(recalculateAllDays(normalized));
  }, [incomingDays, storageKey]);

  const emitChange = (nextDays: EditableDay[]) => {
    const recalculated = recalculateAllDays(nextDays);

    setDays(recalculated);

    try {
      localStorage.setItem(storageKey, JSON.stringify(recalculated));
    } catch {
      // localStorage indisponible : on continue sans bloquer l’éditeur.
    }

    props.onChange?.(recalculated);
    props.onPlanningChange?.(recalculated);
  };

  const resetPlanning = () => {
    const normalized = recalculateAllDays(normalizeDays(incomingDays));

    try {
      localStorage.removeItem(storageKey);
    } catch {
      // localStorage indisponible : on continue.
    }

    setDays(normalized);
    props.onReset?.();
    props.onChange?.(normalized);
    props.onPlanningChange?.(normalized);
  };

  const addFreeTime = (dayIndex: number, duration = 60) => {
    const next = days.map((day, index) => {
      if (index !== dayIndex) return day;

      return {
        ...day,
        slots: [...day.slots, createFreeTimeSlot(dayIndex, duration)],
      };
    });

    emitChange(next);
  };

  const addWakeLater = (dayIndex: number, duration = 60) => {
    const next = days.map((day, index) => {
      if (index !== dayIndex) return day;

      return {
        ...day,
        slots: [...day.slots, createWakeSlot(dayIndex, duration)],
      };
    });

    emitChange(next);
  };

  const updateSlotDuration = (
    dayIndex: number,
    slotIndex: number,
    deltaMinutes: number
  ) => {
    const next = days.map((day, index) => {
      if (index !== dayIndex) return day;

      return {
        ...day,
        slots: day.slots.map((slot, currentSlotIndex) => {
          if (currentSlotIndex !== slotIndex) return slot;

          const currentDuration = parseDurationFromSlot(slot);
          const nextDuration = Math.max(15, currentDuration + deltaMinutes);

          return {
            ...slot,
            customDurationMinutes: nextDuration,
            durationMinutes: nextDuration,
            durationLabel: formatDuration(nextDuration),
          };
        }),
      };
    });

    emitChange(next);
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    const next = days.map((day, index) => {
      if (index !== dayIndex) return day;

      return {
        ...day,
        slots: day.slots.filter((_, currentSlotIndex) => currentSlotIndex !== slotIndex),
      };
    });

    emitChange(next);
  };

  const moveSlotWithinDay = (
    dayIndex: number,
    slotIndex: number,
    direction: -1 | 1
  ) => {
    const next = days.map((day, index) => {
      if (index !== dayIndex) return day;

      const targetIndex = slotIndex + direction;

      if (targetIndex < 0 || targetIndex >= day.slots.length) return day;

      const slots = [...day.slots];
      const [slot] = slots.splice(slotIndex, 1);
      slots.splice(targetIndex, 0, slot);

      return {
        ...day,
        slots,
      };
    });

    emitChange(next);
  };

  const moveSlotToDay = (
    fromDayIndex: number,
    slotIndex: number,
    direction: -1 | 1
  ) => {
    const toDayIndex = fromDayIndex + direction;

    if (toDayIndex < 0 || toDayIndex >= days.length) return;

    const slot = days[fromDayIndex]?.slots?.[slotIndex];

    if (!slot) return;

    const role = getSlotRole(slot);

    if (role !== 'editable') return;

    const next = days.map((day, dayIndex) => {
      if (dayIndex === fromDayIndex) {
        return {
          ...day,
          slots: day.slots.filter((_, currentSlotIndex) => currentSlotIndex !== slotIndex),
        };
      }

      if (dayIndex === toDayIndex) {
        return {
          ...day,
          slots: [
            ...day.slots,
            {
              ...slot,
              dayIndex: toDayIndex,
              editableId: slot.editableId || makeEditableId(toDayIndex, slotIndex),
            },
          ],
        };
      }

      return day;
    });

    emitChange(next);
  };

  const handleDrop = (targetDayIndex: number, targetSlotIndex: number) => {
    if (!dragged) return;

    const sourceDayIndex = dragged.dayIndex;
    const sourceSlotIndex = dragged.slotIndex;

    if (sourceDayIndex === targetDayIndex && sourceSlotIndex === targetSlotIndex) {
      setDragged(null);
      return;
    }

    const sourceSlot = days[sourceDayIndex]?.slots?.[sourceSlotIndex];

    if (!sourceSlot || getSlotRole(sourceSlot) !== 'editable') {
      setDragged(null);
      return;
    }

    const next = days.map((day, dayIndex) => {
      let slots = [...day.slots];

      if (dayIndex === sourceDayIndex) {
        slots = slots.filter((_, slotIndex) => slotIndex !== sourceSlotIndex);
      }

      if (dayIndex === targetDayIndex) {
        const insertIndex =
          sourceDayIndex === targetDayIndex && sourceSlotIndex < targetSlotIndex
            ? targetSlotIndex - 1
            : targetSlotIndex;

        slots.splice(insertIndex, 0, {
          ...sourceSlot,
          dayIndex: targetDayIndex,
        });
      }

      return {
        ...day,
        slots,
      };
    });

    setDragged(null);
    emitChange(next);
  };

  const allWarnings = days.flatMap((day) => day.warnings || []);

  if (!days.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">Planning</h2>
        <p className="mt-2 text-sm text-slate-600">
          Aucun planning n’est encore disponible.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {props.title || 'Planning personnalisable'}
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            {props.subtitle ||
              'Déplacez les étapes, ajoutez du temps libre ou décalez le réveil. Les horaires se recalculent automatiquement.'}
          </p>
        </div>

        <button
          type="button"
          onClick={resetPlanning}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Réinitialiser
        </button>
      </div>

      {allWarnings.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-semibold">Attention planning</div>
          <div className="mt-1">
            Certains créneaux peuvent être fermés ou dépasser la plage prévue.
          </div>
        </div>
      )}

      <div className="space-y-6">
        {days.map((day, dayIndex) => {
          const freeDuration = 60;
          const wakeDuration = 60;

          return (
            <article
              key={`day-${day.day || dayIndex + 1}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    {day.title || `Jour ${dayIndex + 1}`}
                  </h3>

                  <p className="mt-1 text-sm text-slate-600">
                    {day.date ? `${day.date} • ` : ''}
                    {day.summary || `${day.slots.length} étape(s) prévue(s)`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <DurationSelector
                    label="Ajouter temps libre"
                    duration={freeDuration}
                    onDecrease={() => addFreeTime(dayIndex, 45)}
                    onIncrease={() => addFreeTime(dayIndex, 75)}
                  />

                  <DurationSelector
                    label="Se lever plus tard"
                    duration={wakeDuration}
                    onDecrease={() => addWakeLater(dayIndex, 45)}
                    onIncrease={() => addWakeLater(dayIndex, 75)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {day.slots.map((slot, slotIndex) => {
                  const editable = getSlotRole(slot) === 'editable';
                  const duration = parseDurationFromSlot(slot);

                  return (
                    <div
                      key={slot.editableId || `${day.day}-${slot.time}-${slotIndex}`}
                      draggable={editable}
                      onDragStart={() => setDragged({ dayIndex, slotIndex })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDrop(dayIndex, slotIndex)}
                      className={`rounded-2xl border bg-white p-4 shadow-sm ${
                        editable
                          ? 'border-slate-200 hover:border-teal-500'
                          : 'border-slate-100 opacity-90'
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <div className="pt-1">
                            {editable ? (
                              <GripVertical className="h-5 w-5 text-slate-400" />
                            ) : (
                              <Clock className="h-5 w-5 text-slate-400" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {slot.time}
                              </span>

                              {slot.durationLabel && (
                                <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">
                                  {slot.durationLabel}
                                </span>
                              )}

                              {!editable && (
                                <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                                  Fixe
                                </span>
                              )}
                            </div>

                            <h4 className="mt-2 text-lg font-bold text-slate-900">
                              {slot.title}
                            </h4>

                            {slot.subtitle && (
                              <p className="mt-1 text-sm text-slate-500">
                                {slot.subtitle}
                              </p>
                            )}

                            {slot.description && (
                              <p className="mt-2 text-sm text-slate-600">
                                {slot.description}
                              </p>
                            )}

                            {(slot.warning || slot.openingWarning) && (
                              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                {slot.warning || slot.openingWarning}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                          {editable && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSlotDuration(dayIndex, slotIndex, -15)
                                }
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Minus className="h-3.5 w-3.5" />
                                Durée
                              </button>

                              <span className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900">
                                {formatDuration(duration)}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  updateSlotDuration(dayIndex, slotIndex, 15)
                                }
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Durée
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  moveSlotWithinDay(dayIndex, slotIndex, -1)
                                }
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  moveSlotWithinDay(dayIndex, slotIndex, 1)
                                }
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => moveSlotToDay(dayIndex, slotIndex, -1)}
                                disabled={dayIndex === 0}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => moveSlotToDay(dayIndex, slotIndex, 1)}
                                disabled={dayIndex === days.length - 1}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => removeSlot(dayIndex, slotIndex)}
                                className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export { PlanningEditor };