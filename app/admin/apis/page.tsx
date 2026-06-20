'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

type ApiStatus = {
  id: string;
  name: string;
  status: 'active' | 'partial' | 'missing';
  configured: boolean;
  details: string;
  env: {
    name: string;
    configured: boolean;
    public?: boolean;
  }[];
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  generatedAt?: string;
  summary?: {
    active: number;
    partial: number;
    missing: number;
    total: number;
  };
  apis?: ApiStatus[];
};

function getStatusLabel(status: ApiStatus['status']) {
  if (status === 'active') return 'Actif';
  if (status === 'partial') return 'Partiel';
  return 'Manquant';
}

function getStatusClasses(status: ApiStatus['status']) {
  if (status === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (status === 'partial') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-red-200 bg-red-50 text-red-800';
}

function StatusIcon({ status }: { status: ApiStatus['status'] }) {
  if (status === 'active') {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  }

  if (status === 'partial') {
    return <AlertTriangle className="h-5 w-5 text-amber-600" />;
  }

  return <XCircle className="h-5 w-5 text-red-600" />;
}

export default function AdminApisPage() {
  const router = useRouter();

  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [rememberToken, setRememberToken] = useState(true);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedToken = window.sessionStorage.getItem('gototrip_admin_token') || '';

    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const hasData = Boolean(data?.ok && Array.isArray(data.apis));

  const sortedApis = useMemo(() => {
    const apis = data?.apis || [];

    const order = {
      missing: 0,
      partial: 1,
      active: 2,
    };

    return [...apis].sort((a, b) => order[a.status] - order[b.status]);
  }, [data]);

  async function loadStatuses(tokenToUse: string) {
    const cleanToken = tokenToUse.trim();

    if (!cleanToken) {
      setError('Entre le code admin puis clique sur Vérifier.');
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError('');
      setData(null);

      if (rememberToken) {
        window.sessionStorage.setItem('gototrip_admin_token', cleanToken);
      } else {
        window.sessionStorage.removeItem('gototrip_admin_token');
      }

      const params = new URLSearchParams({
        token: cleanToken,
      });

      const res = await fetch(`/api/admin/apis?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Impossible de vérifier les API.');
      }

      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Erreur inconnue pendant la vérification.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadStatuses(token);
  }

  function resetToken() {
    window.sessionStorage.removeItem('gototrip_admin_token');
    setToken('');
    setData(null);
    setError('');
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au site
          </button>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            <ShieldCheck className="h-4 w-4" />
            Admin API
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
          <h1 className="text-3xl font-extrabold md:text-4xl">
            État des API Gototrip
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            Cette page permet de vérifier rapidement les intégrations du site.
            Les clés API ne sont jamais affichées.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-3xl border border-slate-200 bg-white p-6"
        >
          <div className="mb-4 flex items-center gap-2 text-lg font-bold">
            <KeyRound className="h-5 w-5 text-slate-500" />
            Accès admin
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Code admin"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-14 text-sm outline-none focus:border-teal-600"
              />

              <button
                type="button"
                onClick={() => setShowToken((current) => !current)}
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={showToken ? 'Masquer le code' : 'Afficher le code'}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Vérifier
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberToken}
                onChange={(event) => setRememberToken(event.target.checked)}
              />
              Garder le code pour cette session navigateur
            </label>

            {token && (
              <button
                type="button"
                onClick={resetToken}
                className="text-sm text-slate-500 underline hover:text-slate-900"
              >
                Effacer le code
              </button>
            )}
          </div>

          <div className="mt-2 text-xs text-slate-400">
            État du champ : {showToken ? 'code visible' : 'code masqué'}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>

        {hasData && data?.summary && (
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm text-slate-500">Total</div>
              <div className="mt-1 text-3xl font-extrabold">
                {data.summary.total}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="text-sm text-emerald-700">Actives</div>
              <div className="mt-1 text-3xl font-extrabold text-emerald-800">
                {data.summary.active}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-sm text-amber-700">Partielles</div>
              <div className="mt-1 text-3xl font-extrabold text-amber-800">
                {data.summary.partial}
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="text-sm text-red-700">Manquantes</div>
              <div className="mt-1 text-3xl font-extrabold text-red-800">
                {data.summary.missing}
              </div>
            </div>
          </div>
        )}

        {hasData && (
          <div className="space-y-4">
            {sortedApis.map((api) => (
              <article
                key={api.id}
                className="rounded-3xl border border-slate-200 bg-white p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <StatusIcon status={api.status} />

                      <h2 className="text-xl font-extrabold">{api.name}</h2>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                          api.status
                        )}`}
                      >
                        {getStatusLabel(api.status)}
                      </span>
                    </div>

                    <p className="max-w-3xl text-sm text-slate-600">
                      {api.details}
                    </p>
                  </div>

                  <div className="text-sm text-slate-500">
                    {api.configured ? 'Configuré' : 'À configurer'}
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Variable</th>
                        <th className="px-4 py-3 font-semibold">Statut</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {api.env.map((env) => (
                        <tr key={env.name}>
                          <td className="px-4 py-3 font-mono text-xs">
                            {env.name}
                          </td>

                          <td className="px-4 py-3">
                            {env.configured ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Configurée
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                                <XCircle className="h-3.5 w-3.5" />
                                Manquante
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-500">
                            {env.public ? 'Publique navigateur' : 'Serveur uniquement'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}

        {!hasData && !loading && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            Entre ton code admin puis clique sur “Vérifier”.
          </div>
        )}
      </section>
    </main>
  );
}