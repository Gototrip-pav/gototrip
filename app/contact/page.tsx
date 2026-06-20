import type { Metadata } from 'next';
import LegalLayout from '../components/LegalLayout';

export const metadata: Metadata = {
  title: 'Contact | Gototrip',
  description: 'Contacter Gototrip.',
};

export default function ContactPage() {
  return (
    <LegalLayout
      title="Contact"
      subtitle="Une question, une demande partenaire ou un retour sur Gototrip ?"
    >
      <h2>Nous contacter</h2>

      <p>
        Pour toute question concernant Gototrip, vous pouvez nous contacter par email.
      </p>

      <p>
        <strong>Email :</strong>{' '}
        <a href="mailto:julien.pavat@gototrip.net">
          julien.pavat@gototrip.net
        </a>
      </p>

      <h2>Partenariats</h2>

      <p>
        Gototrip est ouvert aux partenariats dans le secteur du voyage, notamment pour
        les hébergements, activités, transports, restaurants et services touristiques.
      </p>

      <p>
        Les partenaires peuvent nous contacter afin d’échanger sur les possibilités de
        collaboration ou d’intégration.
      </p>

      <h2>Support utilisateur</h2>

      <p>
        Si vous rencontrez un problème lors de l’utilisation du site, merci d’indiquer
        dans votre message :
      </p>

      <ul>
        <li>la page concernée ;</li>
        <li>la destination recherchée ;</li>
        <li>le message d’erreur éventuel ;</li>
        <li>le navigateur utilisé.</li>
      </ul>

      <p>
        Nous ferons notre possible pour répondre rapidement.
      </p>
    </LegalLayout>
  );
}