import type { Metadata } from 'next';
import LegalLayout from '../components/LegalLayout';

export const metadata: Metadata = {
  title: 'Mentions légales | Gototrip',
  description: 'Mentions légales du site Gototrip.',
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout
      title="Mentions légales"
      subtitle="Informations légales relatives au site Gototrip."
    >
      <h2>Éditeur du site</h2>

      <p>
        Le site <strong>Gototrip</strong>, accessible à l’adresse{' '}
        <strong>https://gototrip.net</strong>, est édité par :
      </p>

      <ul>
        <li>
          <strong>Nom commercial :</strong> Gototrip
        </li>
        <li>
          <strong>Responsable de publication :</strong> Julien PAVAT
        </li>
        <li>
          <strong>Email :</strong>{' '}
          <a href="mailto:julien.pavat@gototrip.net">
            julien.pavat@gototrip.net
          </a>
        </li>
      </ul>

      <p>
        Si Gototrip est exploité dans le cadre d’une entreprise, les informations
        d’immatriculation, telles que le SIRET, la forme juridique, le capital social
        et l’adresse du siège social, devront être ajoutées ici.
      </p>

      <h2>Hébergement</h2>

      <p>
        Le site est hébergé par <strong>Vercel Inc.</strong>, service d’hébergement
        et de déploiement d’applications web.
      </p>

      <p>
        Site web de l’hébergeur :{' '}
        <a href="https://vercel.com" target="_blank" rel="noreferrer">
          https://vercel.com
        </a>
      </p>

      <h2>Objet du site</h2>

      <p>
        Gototrip est une application web de planification de voyages. Le site permet
        aux utilisateurs de rechercher des destinations, activités, restaurants,
        hébergements, transports et de construire un planning de séjour.
      </p>

      <p>
        Les informations affichées sur Gototrip sont fournies à titre indicatif.
        Les prix, horaires, disponibilités et conditions de réservation doivent être
        vérifiés directement auprès des partenaires ou prestataires concernés.
      </p>

      <h2>Propriété intellectuelle</h2>

      <p>
        L’ensemble des contenus présents sur le site Gototrip, incluant notamment les
        textes, interfaces, éléments graphiques, logos, structure des pages et code
        applicatif, est protégé par le droit de la propriété intellectuelle, sauf
        indication contraire.
      </p>

      <p>
        Toute reproduction, représentation, modification ou exploitation non autorisée
        des contenus du site est interdite.
      </p>

      <h2>Responsabilité</h2>

      <p>
        Gototrip met en œuvre des efforts raisonnables pour proposer des informations
        utiles et cohérentes. Toutefois, le site ne garantit pas l’exactitude,
        l’exhaustivité ou l’actualité permanente des données affichées.
      </p>

      <p>
        Gototrip ne peut être tenu responsable des décisions de voyage, réservations,
        annulations, modifications de prix ou indisponibilités provenant de services
        tiers.
      </p>

      <h2>Contact</h2>

      <p>
        Pour toute question, vous pouvez contacter Gototrip à l’adresse suivante :
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