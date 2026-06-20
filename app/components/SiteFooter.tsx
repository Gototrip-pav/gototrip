import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-slate-500">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="font-semibold text-slate-900">Gototrip</div>

            <div className="mt-1">
              Planificateur de voyages — recommandations, hébergements,
              activités, restaurants et transport.
            </div>

            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              Certains liens de réservation présents sur Gototrip sont des liens
              affiliés. Gototrip peut percevoir une commission si vous réservez
              via ces liens, sans coût supplémentaire pour vous.
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
            <Link
              href="/mentions-legales"
              className="hover:text-teal-700 hover:underline"
            >
              Mentions légales
            </Link>

            <Link
              href="/politique-confidentialite"
              className="hover:text-teal-700 hover:underline"
            >
              Politique de confidentialité
            </Link>

            <Link
              href="/conditions-utilisation"
              className="hover:text-teal-700 hover:underline"
            >
              Conditions d’utilisation
            </Link>

            <Link
              href="/contact"
              className="hover:text-teal-700 hover:underline"
            >
              Contact
            </Link>
          </nav>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
          © 2026 Gototrip. Les prix, disponibilités et conditions de réservation
          sont à vérifier directement auprès des partenaires.
        </div>
      </div>
    </footer>
  );
}