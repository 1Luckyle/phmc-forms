// src/components/PrivacyPolicyContent.js
//
// TEXTE de la politique de confidentialité, partagé par la fenêtre « Politique de confidentialité » (PrivacyPolicyModal)
// et par l'étape du guide de configuration (OnboardingModal) : un seul endroit à tenir à jour.
// À mettre à jour dès qu'une fonctionnalité collecte, stocke ou envoie de nouvelles données (nouveau service tiers,
// nouvelle donnée de profil, nouveau mail…) — et à changer LAST_UPDATE.
import React from 'react';
import './PrivacyPolicyContent.css';

export const LAST_UPDATE = '25 octobre 2026';

const PrivacyPolicyContent = () => (
    <div className="privacy-policy-content">
            <p><em>Dernière mise à jour : {LAST_UPDATE}</em></p>
            <p>
                Cette politique couvre l'utilisation des outils PHMC-FR et est conforme aux{' '}
                <a href="https://gta.world/terms/" target="_blank" rel="noopener noreferrer">GTA World Privacy Policy</a>.
            </p>
            <p>
                Ce site Web traite des informations <strong>IN CHARACTER</strong> relatives à l'utilisation du Pillbox Hill Medical Center
                (une faction de GTA World), ainsi que quelques informations <strong>HORS PERSONNAGE</strong> (nom d'utilisateur UCP, nom du forum,
                Discord, fuseau horaire) nécessaires aux comptes et aux candidatures.
            </p>
            <p>
                Nous sommes en pleine conformité avec les{' '}
                <a href="https://forum.gta.world/en/topic/141256-gta-world-website-regulations-last-update-march-1st-2025/" target="_blank" rel="noopener noreferrer">Règlements de GTA World</a>{' '}
                en hébergeant ce site Web sur un nom de domaine autorisé par GTA World.
            </p>

            <h3>Données que nous enregistrons</h3>
            <ul>
                <li><strong>Compte :</strong> adresse e-mail de connexion (Eyefind Mail), identifiant du compte, et, pour une connexion GTA World, l'identifiant du personnage et de l'utilisateur fournis par GTA World.</li>
                <li><strong>Profil Civil :</strong> prénom, nom, date de naissance, adresse, téléphone, Discord et ID patient.</li>
                <li><strong>Fiche du personnel :</strong> nom, grade et rôles, badge (ID employé), téléphone, Discord, adresse e-mail, droits particuliers (par ex. recruteur). Chacun peut modifier son nom, son téléphone, son Discord et son adresse e-mail (par code de vérification) depuis « Mon profil ».</li>
                <li><strong>Rapports et dossiers médicaux (IC) :</strong> les rapports sauvegardés, leur index par ID patient, les rapports que le personnel partage avec un patient, et les copies que des médecins en font.</li>
                <li><strong>Factures et paiements :</strong> pour les dossiers médicaux payants, une facture par rapport (montant, état à payer / payé / sans paiement, titre du rapport, nom et adresse e-mail du patient indiqués dans le formulaire). Les paiements passent par Fleeca : nous gardons l'état du paiement, le montant, la date et le nom du payeur renvoyés par Fleeca, jamais de numéro de compte ni de code.</li>
                <li><strong>Candidatures et contrats :</strong> vos réponses, leur historique de statuts, les entretiens, le rôle « en attente de contrat », les contrats (texte figé, signature électronique, date de signature) et l'image de votre signature. Pour un employé, la demande de statut de recrutement interne (nom, rôle, badge, motivation et décision du recrutement).</li>
                <li><strong>Images :</strong> carte de visite, signature et autres images que vous téléversez (connexion requise) transitent par nos serveurs, qui les transmettent à ImgBB ; elles y sont hébergées et accessibles par leur lien.</li>
                <li><strong>Préférences :</strong> options d'affichage (effets de saison, en-tête immersif), formulaire en cours de saisie et listes mises en cache sont gardés dans votre navigateur (stockage local) et peuvent être vidés avec « Vider le Cache & Actualiser ».</li>
                <li><strong>Journaux techniques :</strong> informations sur l'appareil (mobile / bureau / tablette), fichier d'erreur lié et bouton pressé en cas d'erreur ; événements d'utilisation anonymes (par exemple l'envoi d'une demande de vidéosurveillance).</li>
            </ul>

            <h3>Messages envoyés automatiquement</h3>
            <ul>
                <li><strong>Eyefind Mail (messagerie du serveur) :</strong> accusé de réception de candidature, convocation à un entretien, réponse à une candidature, contrat à signer, reçus de paiement, changement de grade ou d'adresse, code de vérification, et, pour les factures impayées, un récapitulatif groupé quelques minutes après l'enregistrement puis un rappel quotidien tant que des factures restent à payer.</li>
                <li><strong>Journal d'activité et demandes du site :</strong> pour la sécurité et le suivi, le site conserve une trace des actions notables (connexion, rapport enregistré, candidature, paiement, action d'administration, erreur) avec votre nom, votre rôle et l'heure, ainsi que les demandes de vidéosurveillance (avec les réponses de l'administration du PHMC et vos échanges), rapports de bug et demandes de fonctionnalité que vous envoyez (avec le nom Discord indiqué et des informations techniques sur votre appareil). Le contenu médical de vos rapports n'y figure pas. Seuls les administrateurs y ont accès.</li>
            </ul>

            <h3>Prestataires tiers</h3>
            <p>Nous utilisons les services suivants, qui reçoivent les données nécessaires à leur fonction :</p>
            <ul>
                <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Firebase</a> : comptes, base de données (rapports, profils, factures, candidatures, contrats), fonctions serveur et statistiques d'utilisation.</li>
                <li><a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer">Sentry</a> : suivi des erreurs.</li>
                <li><a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">ImgBB</a> : hébergement des images téléversées.</li>
                <li><strong>Fleeca (GTA World)</strong> : paiement des factures ; <strong>Eyefind Mail (GTA World)</strong> : messagerie ; <strong>GTA World</strong> : connexion avec votre compte.</li>
                <li><a href="https://open-meteo.com/en/terms" target="_blank" rel="noopener noreferrer">Open-Meteo</a> : météo de l'en-tête immersif (uniquement si vous l'activez). Votre navigateur interroge directement ce service, qui voit donc votre adresse IP ; aucune donnée personnelle ne lui est envoyée.</li>
                <li><a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">Discord</a> : éventuelles notifications de l'équipe, uniquement si elles sont activées.</li>
            </ul>

            <h3>Qui peut voir quoi</h3>
            <ul>
                <li>Un patient ne voit que ses propres rapports <strong>partagés</strong> avec lui, ses factures et ses candidatures.</li>
        <li>Chacun voit ses propres demandes de vidéosurveillance ; l'administration du PHMC (Directeur(trice), Assistant(e) de Direction, Personnel Administratif) et les administrateurs voient et traitent toutes les demandes reçues.</li>
                <li>Le personnel de soins et du DMEC consulte les dossiers des patients qu'il prend en charge ; chaque médecin ne supprime que ses propres rapports.</li>
                <li>Les recruteurs et les administrateurs voient les candidatures, les demandes de recrutement interne et les contrats ; les administrateurs gèrent aussi les comptes, les rôles et la base de données.</li>
                <li>Les journaux d'erreurs sont accessibles à l'administrateur du site uniquement.</li>
            </ul>

            <h3>Partage, conservation et suppression</h3>
            <p>Nous ne partageons pas vos données avec des tiers, sauf les prestataires mentionnés ci-dessus et dans la mesure de leur fonction. Les données sont conservées tant que le compte existe ; un administrateur peut supprimer un compte ou des rapports, et vous pouvez demander la suppression ou la correction de vos données sur le Discord du PHMC.</p>
            <p>Questions : posez-les sur le serveur Discord de PHMC.</p>
    </div>
);

export default PrivacyPolicyContent;
