// src/utils/privacyPolicy.js
//
// Politique de confidentialité MODIFIABLE depuis le panneau admin (Admin → Politique de confidentialité). Un seul texte, affiché partout où la politique
// apparaît : la fenêtre du pied de page et l'étape « Politique de confidentialité » du guide de configuration (composant PrivacyPolicyContent).
//
// Stockage : adminSettings/politiqueConfidentialite (lecture publique : la politique se lit avant de se connecter ; écriture admin)
//   { texte, miseAJour, majLe, majPar, historique: { [horodatage]: { texte, miseAJour, majLe, majPar } } }
// Tant qu'aucune version n'est publiée, c'est le texte d'origine (DEFAULT_POLICY_TEXT) qui s'affiche.
//
// FORMAT DU TEXTE (balisage simple, jamais de HTML : le texte est affiché sans rien interpréter d'autre) :
//   ## Titre            → intertitre
//   - élément           → puce (lignes consécutives = une liste ; une ligne indentée prolonge la puce précédente)
//   ligne de texte      → paragraphe (une ligne vide sépare deux paragraphes)
//   **gras**   *italique*   [texte du lien](https://adresse)   (seuls les liens http et https sont acceptés)
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';

export const POLICY_PATH = 'adminSettings/politiqueConfidentialite';
export const MAX_POLICY_LENGTH = 40000;
export const MAX_HISTORY = 10;
export const DEFAULT_UPDATE = '25 octobre 2026';

export const DEFAULT_POLICY_TEXT = `Cette politique couvre l'utilisation des outils PHMC-FR et est conforme aux [GTA World Privacy Policy](https://gta.world/terms/).

Ce site Web traite des informations **IN CHARACTER** relatives à l'utilisation du Pillbox Hill Medical Center (une faction de GTA World), ainsi que quelques informations **HORS PERSONNAGE** (nom d'utilisateur UCP, nom du forum, Discord, fuseau horaire) nécessaires aux comptes et aux candidatures.

Nous sommes en pleine conformité avec les [Règlements de GTA World](https://forum.gta.world/en/topic/141256-gta-world-website-regulations-last-update-march-1st-2025/) en hébergeant ce site Web sur un nom de domaine autorisé par GTA World.

## Données que nous enregistrons

- **Compte :** adresse e-mail de connexion (Eyefind Mail), identifiant du compte, et, pour une connexion GTA World, l'identifiant du personnage et de l'utilisateur fournis par GTA World.
- **Profil Civil :** prénom, nom, date de naissance, adresse, téléphone, Discord et ID patient.
- **Fiche du personnel :** nom, grade et rôles, badge (ID employé), téléphone, Discord, adresse e-mail, droits particuliers (par ex. recruteur). Chacun peut modifier son nom, son téléphone, son Discord et son adresse e-mail (par code de vérification) depuis « Mon profil ».
- **Rapports et dossiers médicaux (IC) :** les rapports sauvegardés, leur index par ID patient, les rapports que le personnel partage avec un patient, et les copies que des médecins en font.
- **Factures et paiements :** pour les dossiers médicaux payants, une facture par rapport (montant, état à payer / payé / sans paiement, titre du rapport, nom et adresse e-mail du patient indiqués dans le formulaire). Les paiements passent par Fleeca : nous gardons l'état du paiement, le montant, la date et le nom du payeur renvoyés par Fleeca, jamais de numéro de compte ni de code.
- **Candidatures et contrats :** vos réponses, leur historique de statuts, les entretiens, le rôle « en attente de contrat », les contrats (texte figé, signature électronique, date de signature) et l'image de votre signature. Pour un employé, la demande de statut de recrutement interne (nom, rôle, badge, motivation et décision du recrutement).
- **Images :** carte de visite, signature et autres images que vous téléversez (connexion requise) transitent par nos serveurs, qui les transmettent à ImgBB ; elles y sont hébergées et accessibles par leur lien.
- **Préférences :** options d'affichage (effets de saison, en-tête immersif), formulaire en cours de saisie et listes mises en cache sont gardés dans votre navigateur (stockage local) et peuvent être vidés avec « Vider le Cache & Actualiser ».
- **Journaux techniques :** informations sur l'appareil (mobile / bureau / tablette), fichier d'erreur lié et bouton pressé en cas d'erreur ; événements d'utilisation anonymes (par exemple l'envoi d'une demande de vidéosurveillance).

## Messages envoyés automatiquement

- **Eyefind Mail (messagerie du serveur) :** accusé de réception de candidature, convocation à un entretien, réponse à une candidature, contrat à signer, reçus de paiement, changement de grade ou d'adresse, code de vérification, et, pour les factures impayées, un récapitulatif groupé quelques minutes après l'enregistrement puis un rappel quotidien tant que des factures restent à payer.
- **Journal d'activité et demandes du site :** pour la sécurité et le suivi, le site conserve une trace des actions notables (connexion, rapport enregistré, candidature, paiement, action d'administration, erreur) avec votre nom, votre rôle et l'heure, ainsi que les demandes de vidéosurveillance (avec les réponses de l'administration du PHMC et vos échanges), rapports de bug et demandes de fonctionnalité que vous envoyez (avec le nom Discord indiqué et des informations techniques sur votre appareil). Le contenu médical de vos rapports n'y figure pas. Seuls les administrateurs y ont accès.

## Prestataires tiers

Nous utilisons les services suivants, qui reçoivent les données nécessaires à leur fonction :

- [Google Firebase](https://policies.google.com/privacy) : comptes, base de données (rapports, profils, factures, candidatures, contrats), fonctions serveur et statistiques d'utilisation.
- [Sentry](https://sentry.io/privacy/) : suivi des erreurs.
- [ImgBB](https://imgbb.com/privacy) : hébergement des images téléversées.
- **Fleeca (GTA World)** : paiement des factures ; **Eyefind Mail (GTA World)** : messagerie ; **GTA World** : connexion avec votre compte.
- [Open-Meteo](https://open-meteo.com/en/terms) : météo de l'en-tête immersif (uniquement si vous l'activez). Votre navigateur interroge directement ce service, qui voit donc votre adresse IP ; aucune donnée personnelle ne lui est envoyée.
- [Discord](https://discord.com/privacy) : éventuelles notifications de l'équipe, uniquement si elles sont activées.

## Qui peut voir quoi

- Un patient ne voit que ses propres rapports **partagés** avec lui, ses factures et ses candidatures.
- Chacun voit ses propres demandes de vidéosurveillance ; l'administration du PHMC (Directeur(trice), Assistant(e) de Direction, Personnel Administratif) et les administrateurs voient et traitent toutes les demandes reçues.
- Le personnel de soins et du DMEC consulte les dossiers des patients qu'il prend en charge ; chaque médecin ne supprime que ses propres rapports.
- Les recruteurs et les administrateurs voient les candidatures, les demandes de recrutement interne et les contrats ; les administrateurs gèrent aussi les comptes, les rôles et la base de données.
- Les journaux d'erreurs sont accessibles à l'administrateur du site uniquement.

## Partage, conservation et suppression

Nous ne partageons pas vos données avec des tiers, sauf les prestataires mentionnés ci-dessus et dans la mesure de leur fonction. Les données sont conservées tant que le compte existe ; un administrateur peut supprimer un compte ou des rapports, et vous pouvez demander la suppression ou la correction de vos données sur le Discord du PHMC.

Questions : posez-les sur le [serveur Discord du PHMC](https://discord.gg/Qupn5tWc6H).`;

// ───────────────────────────── Analyse du texte (pure) ─────────────────────────────

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/;

// Texte d'une ligne → [{ type: 'text' | 'bold' | 'italic' | 'link', text, href? }]
export const parseInline = (value) => String(value ?? '').split(INLINE).filter((part) => part !== '').map((part) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return { type: 'bold', text: part.slice(2, -2) };
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return { type: 'italic', text: part.slice(1, -1) };
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    if (link) return { type: 'link', text: link[1], href: link[2] };
    return { type: 'text', text: part };
});

// Texte complet → [{ type: 'h', text } | { type: 'p', text } | { type: 'ul', items: [texte] }]
export const parsePolicy = (value) => {
    const blocks = [];
    let paragraph = [];
    let list = null;
    const flushParagraph = () => { if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') }); paragraph = []; };
    const flushList = () => { if (list) blocks.push({ type: 'ul', items: list }); list = null; };

    String(value ?? '').replace(/\r\n/g, '\n').split('\n').forEach((raw) => {
        const line = raw.trimEnd();
        if (!line.trim()) { flushParagraph(); flushList(); return; }
        if (/^##\s+/.test(line)) { flushParagraph(); flushList(); blocks.push({ type: 'h', text: line.replace(/^##\s+/, '').trim() }); return; }
        if (/^[-•]\s+/.test(line)) { flushParagraph(); (list = list || []).push(line.replace(/^[-•]\s+/, '').trim()); return; }
        if (list && /^\s+\S/.test(raw)) { list[list.length - 1] += ` ${line.trim()}`; return; }
        flushList();
        paragraph.push(line.trim());
    });
    flushParagraph();
    flushList();
    return blocks;
};

// → liste de problèmes (vide si le texte peut être publié).
export const validatePolicy = ({ texte, miseAJour }) => {
    const errors = [];
    const text = String(texte ?? '');
    if (text.trim().length < 50) errors.push('Le texte est trop court pour être une politique de confidentialité.');
    if (text.length > MAX_POLICY_LENGTH) errors.push(`Le texte dépasse ${MAX_POLICY_LENGTH.toLocaleString('fr-FR')} caractères.`);
    if (!String(miseAJour ?? '').trim()) errors.push('Indiquez la date de dernière mise à jour.');
    if (String(miseAJour ?? '').length > 80) errors.push('La date de mise à jour est trop longue.');
    return errors;
};

export const todayLabel = (now = Date.now()) => new Date(now).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// ───────────────────────────── Lecture / écriture ─────────────────────────────

export const defaultPolicy = () => ({ texte: DEFAULT_POLICY_TEXT, miseAJour: DEFAULT_UPDATE, majLe: null, majPar: '', historique: [], personnalisee: false });

export const normalizePolicy = (raw) => {
    if (!raw || typeof raw.texte !== 'string' || !raw.texte.trim()) return defaultPolicy();
    const historique = Object.values(raw.historique || {})
        .filter((entry) => entry && typeof entry.texte === 'string')
        .map((entry) => ({ texte: entry.texte, miseAJour: String(entry.miseAJour || ''), majLe: entry.majLe || 0, majPar: String(entry.majPar || '') }))
        .sort((a, b) => b.majLe - a.majLe);
    return { texte: raw.texte, miseAJour: String(raw.miseAJour || ''), majLe: raw.majLe || null, majPar: String(raw.majPar || ''), historique, personnalisee: true };
};

// Version publiée, ou le texte d'origine (aucune publication, ou lecture impossible : la politique ne doit jamais disparaître).
export const loadPolicy = async () => {
    try {
        const snap = await get(ref(database, POLICY_PATH));
        return normalizePolicy(snap.exists() ? snap.val() : null);
    } catch (error) {
        console.warn('Politique de confidentialité illisible, texte d\'origine affiché :', error?.message || error);
        return defaultPolicy();
    }
};

// Publie une nouvelle version. L'ancienne version personnalisée est gardée dans l'historique (les MAX_HISTORY dernières).
export const savePolicy = async ({ texte, miseAJour }, byName) => {
    const errors = validatePolicy({ texte, miseAJour });
    if (errors.length) throw new Error(errors[0]);
    const snap = await get(ref(database, POLICY_PATH));
    const current = snap.exists() ? normalizePolicy(snap.val()) : null;
    const now = Date.now();
    const historique = {};
    if (current && current.personnalisee) {
        [{ texte: current.texte, miseAJour: current.miseAJour, majLe: current.majLe || 0, majPar: current.majPar }, ...current.historique]
            .slice(0, MAX_HISTORY)
            .forEach((entry) => { historique[`v${entry.majLe || 0}_${Object.keys(historique).length}`] = entry; });
    }
    const document = { texte: String(texte), miseAJour: String(miseAJour).trim(), majLe: now, majPar: String(byName || '').slice(0, 120), historique };
    await set(ref(database, POLICY_PATH), document);
    return normalizePolicy(document);
};
