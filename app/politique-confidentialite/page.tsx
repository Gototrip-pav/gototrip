import type { Metadata } from 'next';
import LegalLayout from '../components/LegalLayout';

export const metadata: Metadata = {
  title: 'Politique de confidentialité | Gototrip',
  description: 'Politique de confidentialité du site Gototrip.',
};

export default function PolitiqueConfidentialitePage() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      subtitle="Cette page explique comment Gototrip traite les données liées à l’utilisation du site."
    >
      <h2>Introduction</h2>

      <p>
        Gototrip respecte la vie privée de ses utilisateurs. Cette politique de
        confidentialité explique quelles données peuvent être collectées, pour quelles
        finalités elles sont utilisées et quels sont les droits des utilisateurs.
      </p>

      <h2>Données collectées</h2>

      <p>
        Lors de l’utilisation de Gototrip, certaines informations peuvent être
        renseignées volontairement par l’utilisateur, notamment :
      </p>

      <ul>
        <li>ville de départ ;</li>
        <li>destination souhaitée ;</li>
        <li>budget approximatif ;</li>
        <li>nombre de personnes ;</li>
        <li>durée du séjour ;</li>
        <li>préférences de voyage ;</li>
        <li>sélections d’activités, restaurants, hébergements et transports.</li>
      </ul>

      <p>
        Ces informations sont utilisées pour générer des recommandations de voyage
        adaptées.
      </p>

      <h2>Données de contact</h2>

      <p>
        Si l’utilisateur contacte Gototrip par email, son adresse email et le contenu
        de son message peuvent être utilisés uniquement pour répondre à sa demande.
      </p>

      <h2>Utilisation des données</h2>

      <p>Les données peuvent être utilisées pour :</p>

      <ul>
        <li>proposer des destinations pertinentes ;</li>
        <li>calculer une estimation de budget ;</li>
        <li>générer un planning de voyage ;</li>
        <li>améliorer l’expérience utilisateur ;</li>
        <li>rediriger vers des partenaires de réservation lorsque l’utilisateur le souhaite.</li>
      </ul>

      <h2>Services tiers</h2>

      <p>
        Gototrip peut utiliser des services tiers pour afficher des cartes, rechercher
        des lieux, proposer des hébergements, activités ou transports. Ces services
        peuvent avoir leurs propres politiques de confidentialité.
      </p>

      <p>Les services susceptibles d’être utilisés incluent notamment :</p>

      <ul>
        <li>Google Maps et Google Places ;</li>
        <li>Vercel pour l’hébergement ;</li>
        <li>Duffel pour certaines recherches de transport aérien ;</li>
        <li>Booking.com ou ses partenaires affiliés ;</li>
        <li>GetYourGuide ou autres partenaires d’activités.</li>
      </ul>

      <h2>Cookies et stockage local</h2>

      <p>
        Gototrip peut utiliser le stockage local du navigateur afin de conserver
        temporairement les préférences de voyage et les sélections effectuées par
        l’utilisateur.
      </p>

      <p>
        Le site peut également utiliser des cookies ou technologies similaires si des
        services tiers, outils de mesure d’audience ou liens affiliés sont ajoutés.
      </p>

      <h2>Durée de conservation</h2>

      <p>
        Les données saisies dans le cadre de la planification peuvent être conservées
        localement dans le navigateur de l’utilisateur. L’utilisateur peut les supprimer
        en vidant les données de navigation ou le stockage local de son navigateur.
      </p>

      <h2>Partage des données</h2>

      <p>
        Gototrip ne vend pas les données personnelles des utilisateurs. Certaines
        informations peuvent toutefois être transmises à des services tiers lorsque cela
        est nécessaire au fonctionnement du site ou à la redirection vers un partenaire.
      </p>

      <h2>Droits des utilisateurs</h2>

      <p>
        Conformément à la réglementation applicable, l’utilisateur peut demander l’accès,
        la rectification ou la suppression de ses données personnelles en contactant
        Gototrip.
      </p>

      <p>
        Contact :{' '}
        <a href="mailto:julien.pavat@gototrip.net">
          julien.pavat@gototrip.net
        </a>
      </p>

      <h2>Sécurité</h2>

      <p>
        Gototrip met en œuvre des mesures raisonnables pour protéger les données et
        limiter les accès non autorisés. Aucun système ne peut toutefois garantir une
        sécurité absolue.
      </p>

      <h2>Modification de la politique</h2>

      <p>
        Cette politique peut être modifiée à tout moment afin de tenir compte de
        l’évolution du site, des services utilisés ou de la réglementation.
      </p>

      <p>
        Dernière mise à jour : juin 2026.
      </p>
    </LegalLayout>
  );
}