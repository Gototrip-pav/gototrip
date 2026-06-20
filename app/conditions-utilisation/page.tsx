import type { Metadata } from 'next';
import LegalLayout from '../components/LegalLayout';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation | Gototrip',
  description: 'Conditions générales d’utilisation du site Gototrip.',
};

export default function ConditionsUtilisationPage() {
  return (
    <LegalLayout
      title="Conditions d’utilisation"
      subtitle="Conditions applicables à l’utilisation du site Gototrip."
    >
      <h2>Objet</h2>

      <p>
        Les présentes conditions d’utilisation ont pour objet de définir les règles
        d’accès et d’utilisation du site Gototrip, accessible à l’adresse
        <strong> https://gototrip.net</strong>.
      </p>

      <h2>Description du service</h2>

      <p>
        Gototrip est un outil de planification de voyages permettant aux utilisateurs
        d’obtenir des suggestions de destinations, activités, restaurants, hébergements,
        transports et plannings.
      </p>

      <p>
        Le service vise à faciliter la préparation d’un voyage. Il ne remplace pas les
        informations officielles fournies par les prestataires, plateformes de réservation,
        compagnies de transport, établissements ou autorités locales.
      </p>

      <h2>Accès au site</h2>

      <p>
        Le site est accessible gratuitement, hors coûts de connexion internet. Gototrip
        peut être modifié, suspendu ou interrompu à tout moment, notamment pour maintenance,
        évolution technique ou correction.
      </p>

      <h2>Informations affichées</h2>

      <p>
        Les prix, horaires, distances, temps de trajet, disponibilités et descriptions
        sont fournis à titre indicatif. Ils peuvent évoluer à tout moment.
      </p>

      <p>
        L’utilisateur doit vérifier les informations importantes directement auprès des
        sites partenaires ou prestataires avant toute réservation ou prise de décision.
      </p>

      <h2>Liens partenaires et affiliation</h2>

      <p>
        Gototrip peut contenir des liens vers des sites tiers ou partenaires. Certains
        liens peuvent être des liens affiliés. Si l’utilisateur effectue une réservation
        après avoir cliqué sur un lien partenaire, Gototrip peut percevoir une commission,
        sans coût supplémentaire pour l’utilisateur.
      </p>

      <p>
        Les réservations sont réalisées directement sur les sites tiers concernés. Gototrip
        n’est pas responsable des conditions commerciales, disponibilités, annulations,
        remboursements ou litiges liés à ces services tiers.
      </p>

      <h2>Responsabilité de l’utilisateur</h2>

      <p>
        L’utilisateur est responsable des informations qu’il renseigne sur Gototrip et des
        décisions prises à partir des suggestions affichées.
      </p>

      <p>
        L’utilisateur s’engage à utiliser le site de manière normale, loyale et conforme
        aux lois applicables.
      </p>

      <h2>Limitation de responsabilité</h2>

      <p>
        Gototrip ne garantit pas que le site sera exempt d’erreurs, d’interruptions ou
        d’inexactitudes. Gototrip ne peut être tenu responsable d’un dommage direct ou
        indirect résultant de l’utilisation du site ou de services tiers.
      </p>

      <h2>Propriété intellectuelle</h2>

      <p>
        Les contenus, interfaces, textes, éléments graphiques et fonctionnalités du site
        sont protégés. Toute reproduction ou exploitation non autorisée est interdite.
      </p>

      <h2>Modification des conditions</h2>

      <p>
        Gototrip peut modifier les présentes conditions à tout moment. Les utilisateurs
        sont invités à les consulter régulièrement.
      </p>

      <h2>Contact</h2>

      <p>
        Pour toute question relative aux conditions d’utilisation :
      </p>

      <p>
        <a href="mailto:julien.pavat@gototrip.net">
          julien.pavat@gototrip.net
        </a>
      </p>

      <p>
        Dernière mise à jour : juin 2026.
      </p>
    </LegalLayout>
  );
}