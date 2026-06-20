import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold text-slate-900">Gototrip</div>
          <div>Planificateur de voyages — recommandations, hébergements, activités et transport.</div>
        </div>

        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/mentions-legales" className="hover:text-teal-700 hover:underline">
            Mentions légales
          </Link>

          <Link href="/politique-confidentialite" className="hover:text-teal-700 hover:underline">
            Politique de confidentialité
          </Link>

          <Link href="/conditions-utilisation" className="hover:text-teal-700 hover:underline">
            Conditions d’utilisation
          </Link>

          <Link href="/contact" className="hover:text-teal-700 hover:underline">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}