import Link from 'next/link';
import type { ReactNode } from 'react';

type LegalLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function LegalLayout({ title, subtitle, children }: LegalLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-600 text-white">
              G
            </span>
            Gototrip
          </Link>

          <Link
            href="/"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Retour au site
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <h1 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            {title}
          </h1>

          {subtitle && (
            <p className="mt-3 max-w-3xl text-slate-600">{subtitle}</p>
          )}
        </div>

        <article className="prose prose-slate max-w-none rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          {children}
        </article>

        <nav className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link href="/mentions-legales" className="text-teal-700 underline">
            Mentions légales
          </Link>
          <Link href="/politique-confidentialite" className="text-teal-700 underline">
            Politique de confidentialité
          </Link>
          <Link href="/conditions-utilisation" className="text-teal-700 underline">
            Conditions d’utilisation
          </Link>
          <Link href="/contact" className="text-teal-700 underline">
            Contact
          </Link>
        </nav>
      </section>
    </main>
  );
}