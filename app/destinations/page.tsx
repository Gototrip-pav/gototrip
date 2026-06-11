import { Suspense } from 'react';
import DestinationsClient from './DestinationsClient';

function DestinationsLoading() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 h-10 w-48 animate-pulse rounded-xl bg-slate-100" />

        <div className="mb-4 h-8 w-80 animate-pulse rounded-xl bg-slate-100" />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="mb-3 h-6 w-64 animate-pulse rounded-lg bg-slate-100" />
                <div className="mb-2 h-4 w-full animate-pulse rounded-lg bg-slate-100" />
                <div className="mb-2 h-4 w-3/4 animate-pulse rounded-lg bg-slate-100" />
                <div className="mt-4 h-10 w-40 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-3 h-6 w-32 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function DestinationsPage() {
  return (
    <Suspense fallback={<DestinationsLoading />}>
      <DestinationsClient />
    </Suspense>
  );
}