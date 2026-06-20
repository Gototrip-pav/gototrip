'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Hotel,
  House,
  MapPin,
  Mountain,
  Palmtree,
  Tent,
  Trees,
  Umbrella,
  Users,
  Wallet,
  Waves,
  Landmark,
  Loader2,
  Sparkles,
  Compass,
  Gem,
  Check,
} from 'lucide-react';

type FilterButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
};

type CitySuggestion = {
  id: string;
  name: string;
  description: string;
  lat?: number;
  lng?: number;
};

type EnvironmentId = 'mer' | 'montagne' | 'ville' | 'nature' | 'campagne';
type DestinationStyleId = 'classic' | 'surprising' | 'offbeat';
type LodgingId = 'hotel' | 'appartement' | 'maison' | 'auberge' | 'camping';

const ENVIRONMENTS: {
  id: EnvironmentId;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'mer',
    label: 'Mer',
    icon: <Umbrella className="h-4 w-4" />,
  },
  {
    id: 'montagne',
    label: 'Montagne',
    icon: <Mountain className="h-4 w-4" />,
  },
  {
    id: 'ville',
    label: 'Ville',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    id: 'nature',
    label: 'Nature',
    icon: <Trees className="h-4 w-4" />,
  },
  {
    id: 'campagne',
    label: 'Campagne',
    icon: <Palmtree className="h-4 w-4" />,
  },
];

const DESTINATION_STYLES: {
  id: DestinationStyleId;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'classic',
    label: 'Classique / connue',
    description: 'Valeurs sûres, populaires et faciles à organiser.',
    icon: <Landmark className="h-4 w-4" />,
  },
  {
    id: 'surprising',
    label: 'Étonnante / surprenante',
    description: 'Pépites accessibles auxquelles on ne pense pas toujours.',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'offbeat',
    label: 'Décalée',
    description: 'Plus originale, hors des sentiers battus.',
    icon: <Compass className="h-4 w-4" />,
  },
];

const LODGINGS: {
  id: LodgingId;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'hotel',
    label: 'Hôtel',
    icon: <Hotel className="h-4 w-4" />,
  },
  {
    id: 'appartement',
    label: 'Appartement',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    id: 'maison',
    label: 'Maison',
    icon: <House className="h-4 w-4" />,
  },
  {
    id: 'auberge',
    label: 'Auberge',
    icon: <Landmark className="h-4 w-4" />,
  },
  {
    id: 'camping',
    label: 'Camping',
    icon: <Tent className="h-4 w-4" />,
  },
];

export default function HomePage() {
  const router = useRouter();
  const autocompleteRef = useRef<HTMLDivElement | null>(null);

  const [departureCity, setDepartureCity] = useState('');
  const [departureDescription, setDepartureDescription] = useState('');
  const [selectedCityName, setSelectedCityName] = useState('');

  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const [persons, setPersons] = useState('');
  const [budget, setBudget] = useState('');
  const [duration, setDuration] = useState('');
  const [startDate, setStartDate] = useState('');

  const [environments, setEnvironments] = useState<EnvironmentId[]>([]);
  const [destinationStyles, setDestinationStyles] = useState<DestinationStyleId[]>([
    'surprising',
  ]);
  const [lodgings, setLodgings] = useState<LodgingId[]>([]);

  const canSubmit = useMemo(() => {
    return (
      departureCity.trim().length > 0 &&
      Number(persons) > 0 &&
      Number(budget) > 0 &&
      Number(duration) > 0 &&
      destinationStyles.length > 0
    );
  }, [departureCity, persons, budget, duration, destinationStyles]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setShowCitySuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const query = departureCity.trim();

    if (selectedCityName && query === selectedCityName) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      setCitySearchLoading(false);
      return;
    }

    if (query.length < 2) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      setCitySearchLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSuggestions() {
      setCitySearchLoading(true);

      try {
        const res = await fetch(
          `/api/city-autocomplete?input=${encodeURIComponent(query)}`,
          {
            cache: 'no-store',
          }
        );

        const json = await res.json();

        if (cancelled) return;

        const suggestions = Array.isArray(json.suggestions)
          ? json.suggestions
          : [];

        setCitySuggestions(suggestions);
        setShowCitySuggestions(suggestions.length > 0);
      } catch {
        if (!cancelled) {
          setCitySuggestions([]);
          setShowCitySuggestions(false);
        }
      } finally {
        if (!cancelled) {
          setCitySearchLoading(false);
        }
      }
    }

    const timeout = window.setTimeout(loadSuggestions, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [departureCity, selectedCityName]);

  const selectCity = (city: CitySuggestion) => {
    setDepartureCity(city.name);
    setDepartureDescription(city.description);
    setSelectedCityName(city.name);
    setShowCitySuggestions(false);
    setCitySuggestions([]);
    setCitySearchLoading(false);
  };

  const handleDepartureChange = (value: string) => {
    setDepartureCity(value);
    setDepartureDescription('');
    setSelectedCityName('');
    setShowCitySuggestions(true);
  };

  const toggleEnvironment = (environmentId: EnvironmentId) => {
    setEnvironments((current) =>
      current.includes(environmentId)
        ? current.filter((id) => id !== environmentId)
        : [...current, environmentId]
    );
  };

  const toggleDestinationStyle = (styleId: DestinationStyleId) => {
    setDestinationStyles((current) => {
      if (current.includes(styleId)) {
        const next = current.filter((id) => id !== styleId);

        if (next.length === 0) {
          return current;
        }

        return next;
      }

      return [...current, styleId];
    });
  };

  const toggleLodging = (lodgingId: LodgingId) => {
    setLodgings((current) =>
      current.includes(lodgingId)
        ? current.filter((id) => id !== lodgingId)
        : [...current, lodgingId]
    );
  };

  const goToDestinations = () => {
    if (!canSubmit) return;

    const selectedEnvironments = environments.join(',');
    const selectedLodgings = lodgings.join(',');

    const query = new URLSearchParams();

    query.set('departure', departureCity.trim());
    query.set('persons', String(Number(persons)));
    query.set('budget', String(Number(budget)));
    query.set('duration', String(Number(duration)));
    query.set('destinationStyle', destinationStyles.join(','));

    if (startDate) {
      query.set('start', startDate);
    }

    if (selectedEnvironments) {
      query.set('environment', selectedEnvironments);
    }

    if (selectedLodgings) {
      query.set('lodging', selectedLodgings);
    }

    const criteria = {
      departureCity: departureCity.trim(),
      departureDescription,
      persons: Number(persons),
      budget: String(Number(budget)),
      duration: Number(duration),
      nights: Math.max(1, Number(duration) - 1),
      start: startDate || null,
      environment: selectedEnvironments,
      environments,
      destinationStyle: destinationStyles.join(','),
      destinationStyles,
      lodging: selectedLodgings,
      lodgings,
    };

    localStorage.setItem('gt_criteria', JSON.stringify(criteria));

    router.push(`/destinations?${query.toString()}`);
  };

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex items-center gap-3"
          >
            <div className="grid h-7 w-7 place-items-center rounded-full bg-teal-500 text-white">
              <Waves className="h-4 w-4" />
            </div>
            <span className="text-xl font-extrabold">Gototrip</span>
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h1 className="mb-6 text-4xl font-extrabold leading-tight md:text-5xl">
            Dites-nous vos{' '}
            <span className="text-teal-700">préférences</span>
            <br />
            on propose les{' '}
            <span className="text-teal-700">destinations</span>
          </h1>

          <p className="mb-7 max-w-xl text-slate-600">
            Choisissez départ, budget, ambiance, style de destination,
            hébergement et durée. Gototrip peut mélanger valeurs sûres, pépites
            et destinations plus décalées.
          </p>

          <div className="space-y-5">
            <div ref={autocompleteRef} className="relative">
              <label className="mb-2 block text-sm font-bold">
                D’où souhaitez-vous partir ?
              </label>

              <div className="relative">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={departureCity}
                  onChange={(e) => handleDepartureChange(e.target.value)}
                  onFocus={() => {
                    if (
                      citySuggestions.length > 0 &&
                      departureCity.trim() !== selectedCityName
                    ) {
                      setShowCitySuggestions(true);
                    }
                  }}
                  placeholder="Ville de départ"
                  className="w-full rounded-xl border border-slate-200 px-11 py-3 text-sm outline-none focus:border-teal-600"
                />

                {citySearchLoading && (
                  <Loader2 className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                )}
              </div>

              {departureDescription && (
                <div className="mt-2 text-xs text-teal-700">
                  Ville sélectionnée : {departureDescription}
                </div>
              )}

              {showCitySuggestions && citySuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  {citySuggestions.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCity(city)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          {city.name}
                        </span>

                        <span className="block text-xs text-slate-500">
                          {city.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="relative">
                <Users className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="number"
                  min="1"
                  value={persons}
                  onChange={(e) => setPersons(e.target.value)}
                  placeholder="Personnes"
                  className="w-full rounded-xl border border-slate-200 px-11 py-3 text-sm outline-none focus:border-teal-600"
                />
              </div>

              <div className="relative">
                <Wallet className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="number"
                  min="1"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Budget total (€)"
                  className="w-full rounded-xl border border-slate-200 px-11 py-3 text-sm outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Durée (jours)"
                className="w-full rounded-xl border border-slate-200 px-11 py-3 text-sm outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                À partir de quand souhaitez-vous partir ?
              </label>

              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-11 py-3 text-sm outline-none focus:border-teal-600"
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Optionnel — utile pour les prix, la météo et les disponibilités.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-bold">Environnements</h2>

              <p className="mb-3 text-xs text-slate-500">
                Sélection multiple possible : mer, montagne, ville, nature ou campagne.
              </p>

              <div className="flex flex-wrap gap-2">
                {ENVIRONMENTS.map((item) => (
                  <FilterButton
                    key={item.id}
                    active={environments.includes(item.id)}
                    onClick={() => toggleEnvironment(item.id)}
                    icon={item.icon}
                    label={item.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-bold">
                Style de destination souhaité
              </h2>

              <p className="mb-3 text-xs text-slate-500">
                Sélection multiple possible : Gototrip mélangera les styles choisis.
              </p>

              <div className="grid gap-3 md:grid-cols-3">
                {DESTINATION_STYLES.map((item) => {
                  const active = destinationStyles.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleDestinationStyle(item.id)}
                      className={`relative rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-teal-700 bg-teal-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      {active && (
                        <div className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-teal-700 text-white">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}

                      <div
                        className={`mb-3 grid h-9 w-9 place-items-center rounded-xl ${
                          active
                            ? 'bg-teal-700 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.icon}
                      </div>

                      <div className="text-sm font-bold text-slate-900">
                        {item.label}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {item.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-bold">Hébergements souhaités</h2>

              <p className="mb-3 text-xs text-slate-500">
                Sélection multiple possible : hôtel, appartement, maison, auberge ou camping.
              </p>

              <div className="flex flex-wrap gap-2">
                {LODGINGS.map((item) => (
                  <FilterButton
                    key={item.id}
                    active={lodgings.includes(item.id)}
                    onClick={() => toggleLodging(item.id)}
                    icon={item.icon}
                    label={item.label}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={goToDestinations}
              disabled={!canSubmit}
              className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm font-bold transition ${
                canSubmit
                  ? 'bg-slate-950 text-white hover:bg-slate-800'
                  : 'cursor-not-allowed bg-slate-200 text-slate-500'
              }`}
            >
              Voir mes destinations
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-teal-100 bg-teal-50 p-6 md:p-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-teal-700">
              <Gem className="h-4 w-4" />
              Nouveau
            </div>

            <h2 className="mb-4 text-2xl font-extrabold">
              Mélangez les styles de destinations
            </h2>

            <div className="space-y-3 text-slate-700">
              <p>
                Vous pouvez demander uniquement des valeurs sûres, uniquement des
                pépites, ou mélanger plusieurs styles.
              </p>

              <div className="rounded-2xl bg-white p-4 text-sm">
                Exemple : en choisissant “Classique” + “Étonnante”, Gototrip peut
                proposer Londres ou Rome, mais aussi Porto, Ljubljana, Tallinn,
                Bologne ou Kotor selon vos critères.
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
            <h2 className="mb-4 text-2xl font-extrabold">Fonctionnalités</h2>

            <div className="grid gap-3">
              <FeatureLine
                title="Destinations via API"
                text="Recherche dynamique de destinations adaptées."
              />
              <FeatureLine
                title="Sélection multiple"
                text="Classique, surprenante, décalée, mer, montagne, ville, nature et hébergements peuvent être combinés."
              />
              <FeatureLine
                title="Effet pépite"
                text="Des idées plus originales pour éviter les listes trop bateau."
              />
              <FeatureLine
                title="Budget contrôlé"
                text="Alerte si votre voyage dépasse le budget prévu."
              />
              <FeatureLine
                title="Parcours guidé"
                text="Activités, restaurants, hébergement puis transport."
              />
              <FeatureLine
                title="Réservation"
                text="Liens partenaires ou affiliés prévus ensuite."
              />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function FilterButton({ active, onClick, icon, label }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
        active
          ? 'border-teal-700 bg-teal-700 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FeatureLine({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="font-bold">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{text}</div>
    </div>
  );
}