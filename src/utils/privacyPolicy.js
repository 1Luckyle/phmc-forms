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
import { LEGAL_NOTICE_TEXT, LEGAL_NOTICE_UPDATE } from './legalNotice';

export const POLICY_PATH = 'adminSettings/politiqueConfidentialite';
export const MAX_POLICY_LENGTH = 40000;
export const MAX_HISTORY = 10;
export const DEFAULT_UPDATE = '2 novembre 2026';

export const DEFAULT_POLICY_TEXT = `Cette politique couvre l'utilisation des outils PHMC-FR et est conforme aux [GTA World Privacy Policy](https://gta.world/terms/).

Ce site Web traite des informations **IN CHARACTER** relatives à l'utilisation du Pillbox Hill Medical Center (une faction de GTA World), ainsi que quelques informations **HORS PERSONNAGE** (nom d'utilisateur UCP, nom du forum, Discord, fuseau horaire) nécessaires aux comptes et aux candidatures.

Nous sommes en pleine conformité avec les [Règlements de GTA World](https://forum.gta.world/en/topic/141256-gta-world-website-regulations-last-update-march-1st-2025/) en hébergeant ce site Web sur un nom de domaine autorisé par GTA World.

## Qui est responsable de vos données ?

L'éditeur du site (voir la section « Mentions légales » plus bas) est responsable du traitement. Le site ne contient **aucune publicité** et **vos données ne sont jamais vendues**.

## Données que nous enregistrons

- **Compte :** adresse e-mail de connexion (Eyefind Mail), identifiant du compte, et, pour une connexion GTA World, l'identifiant du personnage et de l'utilisateur fournis par GTA World.
- **Profil Civil :** prénom, nom, date de naissance, adresse, téléphone, Discord et ID patient.
- **Fiche du personnel :** nom, grade et rôles, badge (ID employé), téléphone, Discord, adresse e-mail, droits particuliers (par ex. recruteur). Chacun peut modifier son nom, son téléphone, son Discord et son adresse e-mail (par code de vérification) depuis « Mon profil ».
- **Rapports et dossiers médicaux (IC) :** les rapports sauvegardés, leur index par ID patient, les rapports que le personnel partage avec un patient, et les copies que des médecins en font.
- **Factures et paiements :** pour les dossiers médicaux payants, une facture par rapport (montant, état à payer / payé / sans paiement, titre du rapport, nom et adresse e-mail du patient indiqués dans le formulaire). Les paiements passent par Fleeca : nous gardons l'état du paiement, le montant, la date et le nom du payeur renvoyés par Fleeca, jamais de numéro de compte ni de code.
- **Candidatures et contrats :** vos réponses, leur historique de statuts, les entretiens, le rôle « en attente de contrat », les contrats (texte figé, signature électronique, date de signature) et l'image de votre signature. Pour un employé, la demande de statut de recrutement interne (nom, rôle, badge, motivation et décision du recrutement).
- **Images :** carte de visite, signature et autres images que vous téléversez (connexion requise) transitent par nos serveurs, qui les transmettent à ImgBB ; elles y sont hébergées et accessibles par leur lien. Les images que vous insérez à partir de liens externes sont chargées depuis leur hébergeur d'origine, qui peut alors voir votre adresse IP.
- **Retours d'expérience :** les rapports de bug, demandes de fonctionnalité et propositions de formulaire que vous envoyez (texte, nom Discord indiqué, informations techniques sur votre appareil).
- **Préférences :** options d'affichage (effets de saison, en-tête immersif), formulaire en cours de saisie et listes mises en cache sont gardés dans votre navigateur (stockage local) et peuvent être vidés avec « Vider le Cache & Actualiser ».
- **Journaux techniques :** informations sur l'appareil (mobile / bureau / tablette), fichier d'erreur lié et bouton pressé en cas d'erreur.

## Messages envoyés automatiquement

- **Eyefind Mail (messagerie du serveur) :** accusé de réception de candidature, convocation à un entretien, réponse à une candidature, contrat à signer, reçus de paiement, changement de grade ou d'adresse, code de vérification, et, pour les factures impayées, un récapitulatif groupé quelques minutes après l'enregistrement puis un rappel quotidien tant que des factures restent à payer.
- **Journal d'activité et demandes du site :** pour la sécurité et le suivi, le site conserve une trace des actions notables (connexion, rapport enregistré, candidature, paiement, action d'administration, erreur) avec votre nom, votre rôle et l'heure, ainsi que les demandes de vidéosurveillance (avec les réponses de l'administration du PHMC et vos échanges), rapports de bug et demandes de fonctionnalité que vous envoyez (avec le nom Discord indiqué et des informations techniques sur votre appareil). Le contenu médical de vos rapports n'y figure pas. Seuls les administrateurs y ont accès.

## Prestataires tiers

Nous utilisons les services suivants, qui reçoivent les données nécessaires à leur fonction :

- [GitHub Pages](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) : hébergement des pages du site (GitHub voit l'adresse IP de vos requêtes, comme tout hébergeur web).
- [Google Firebase](https://policies.google.com/privacy) : comptes, base de données (rapports, profils, factures, candidatures, contrats), fonctions serveur.
- [Google reCAPTCHA Enterprise / Firebase App Check](https://policies.google.com/privacy) : protection contre les abus. Il vérifie que les requêtes viennent bien du site et reçoit pour cela des informations techniques sur votre navigateur.
- [Sentry](https://sentry.io/privacy/) : suivi des erreurs.
- [ImgBB](https://imgbb.com/privacy) : hébergement des images téléversées.
- **Fleeca (GTA World)** : paiement des factures ; **Eyefind Mail (GTA World)** : messagerie ; **GTA World** : connexion avec votre compte.
- [Open-Meteo](https://open-meteo.com/en/terms) : météo de l'en-tête immersif (uniquement si vous l'activez). Votre navigateur interroge directement ce service, qui voit donc votre adresse IP ; aucune donnée personnelle ne lui est envoyée.
- [Discord](https://discord.com/privacy) : éventuelles notifications de l'équipe, uniquement si elles sont activées.

## Cookies et stockage local

- Aucun cookie ni traceur **publicitaire**, et **aucun outil de mesure d'audience**. Les outils ci-dessus (reCAPTCHA / App Check, Sentry) servent uniquement à la sécurité et au suivi des erreurs ; Google peut y déposer ou lire des identifiants techniques.
- Le **stockage local** de votre navigateur sert à garder votre session de connexion, le formulaire en cours de saisie, vos préférences d'affichage et des listes en cache. Vous pouvez l'effacer à tout moment depuis les paramètres de votre navigateur ou avec « Vider le Cache & Actualiser ».

## Pourquoi ces données ? (bases légales)

- Fournir le service que vous demandez : connexion, rapports, dossiers, candidatures, contrats, paiement des factures (article 6.1.b du RGPD).
- Sécurité, prévention des abus, journalisation et suivi des erreurs (intérêt légitime, article 6.1.f du RGPD).
- Fonctions facultatives que vous activez vous-même, comme la météo de l'en-tête immersif.

## Qui peut voir quoi

- Un patient ne voit que ses propres rapports **partagés** avec lui, ses factures et ses candidatures.
- Chacun voit ses propres demandes de vidéosurveillance ; l'administration du PHMC (Directeur(trice), Assistant(e) de Direction, Personnel Administratif) et les administrateurs voient et traitent toutes les demandes reçues.
- Le personnel de soins et du DMEC consulte les dossiers des patients qu'il prend en charge ; chaque médecin ne supprime que ses propres rapports.
- Les recruteurs et les administrateurs voient les candidatures, les demandes de recrutement interne et les contrats ; les administrateurs gèrent aussi les comptes, les rôles et la base de données.
- Les journaux d'erreurs sont accessibles à l'administrateur du site uniquement.
- Nous ne partageons pas vos données avec des tiers, sauf les prestataires mentionnés ci-dessus et dans la mesure de leur fonction.

## Combien de temps ?

- Les données sont conservées **tant que le compte existe**.
- Lorsqu'un compte est supprimé, vos informations personnelles sont supprimées ; les **rapports et dossiers (IC), candidatures et contrats restent archivés** et vous les retrouvez si vous recréez un compte. Un administrateur peut aussi supprimer des rapports précis.
- Les données du navigateur (stockage local) restent sur votre appareil jusqu'à ce que vous les effaciez.

## Vos droits

Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, la limitation ou l'opposition à leur traitement, ainsi que leur portabilité. Pour cela, écrivez sur le [serveur Discord du PHMC](https://discord.gg/Qupn5tWc6H). Une grande partie de vos informations se modifie directement depuis « Mon profil ».

Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL ([www.cnil.fr](https://www.cnil.fr)).

## Sécurité

Les échanges sont chiffrés (HTTPS). L'accès aux données est limité par des règles de la base de données, selon le rôle de chacun (patient, personnel, recruteur, administrateur), et la connexion passe par votre compte GTA World ou Eyefind Mail : aucun mot de passe GTA World n'est saisi ni stocké sur ce site.

## Mentions légales

L'éditeur, les hébergeurs et la nature du site sont aussi indiqués dans la fenêtre « Mentions légales » du pied de page. Les voici :

${LEGAL_NOTICE_TEXT}

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
    if (text.trim().length < 50) errors.push('Le texte est trop court pour être publié.');
    if (text.length > MAX_POLICY_LENGTH) errors.push(`Le texte dépasse ${MAX_POLICY_LENGTH.toLocaleString('fr-FR')} caractères.`);
    if (!String(miseAJour ?? '').trim()) errors.push('Indiquez la date de dernière mise à jour.');
    if (String(miseAJour ?? '').length > 80) errors.push('La date de mise à jour est trop longue.');
    return errors;
};

export const todayLabel = (now = Date.now()) => new Date(now).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// ───────────────────────────── Lecture / écriture ─────────────────────────────

// Deux documents se modifient depuis le panneau admin avec le même éditeur : la politique de confidentialité et les mentions légales (chacun son nœud,
// son texte d'origine et son historique). Les mentions légales sont affichées par la fenêtre « Mentions légales » du pied de page.
export const LEGAL_PATH = 'adminSettings/mentionsLegales';
export const DOCUMENTS = {
    politique: { path: POLICY_PATH, texte: DEFAULT_POLICY_TEXT, miseAJour: DEFAULT_UPDATE, label: 'Politique de confidentialité', icon: 'fa-user-shield' },
    mentions: { path: LEGAL_PATH, texte: LEGAL_NOTICE_TEXT, miseAJour: LEGAL_NOTICE_UPDATE, label: 'Mentions légales', icon: 'fa-scale-balanced' },
};
export const documentInfo = (kind) => DOCUMENTS[kind] || DOCUMENTS.politique;

export const defaultPolicy = (kind = 'politique') => ({ texte: documentInfo(kind).texte, miseAJour: documentInfo(kind).miseAJour, majLe: null, majPar: '', historique: [], personnalisee: false });

export const normalizePolicy = (raw, kind = 'politique') => {
    if (!raw || typeof raw.texte !== 'string' || !raw.texte.trim()) return defaultPolicy(kind);
    const historique = Object.values(raw.historique || {})
        .filter((entry) => entry && typeof entry.texte === 'string')
        .map((entry) => ({ texte: entry.texte, miseAJour: String(entry.miseAJour || ''), majLe: entry.majLe || 0, majPar: String(entry.majPar || '') }))
        .sort((a, b) => b.majLe - a.majLe);
    return { texte: raw.texte, miseAJour: String(raw.miseAJour || ''), majLe: raw.majLe || null, majPar: String(raw.majPar || ''), historique, personnalisee: true };
};

// Version publiée, ou le texte d'origine (aucune publication, ou lecture impossible : la politique ne doit jamais disparaître).
export const loadPolicy = async (kind = 'politique') => {
    try {
        const snap = await get(ref(database, documentInfo(kind).path));
        return normalizePolicy(snap.exists() ? snap.val() : null, kind);
    } catch (error) {
        console.warn(`${documentInfo(kind).label} illisible, texte d'origine affiché :`, error?.message || error);
        return defaultPolicy(kind);
    }
};

// Publie une nouvelle version. L'ancienne version personnalisée est gardée dans l'historique (les MAX_HISTORY dernières).
export const savePolicy = async ({ texte, miseAJour }, byName, kind = 'politique') => {
    const errors = validatePolicy({ texte, miseAJour });
    if (errors.length) throw new Error(errors[0]);
    const path = documentInfo(kind).path;
    const snap = await get(ref(database, path));
    const current = snap.exists() ? normalizePolicy(snap.val(), kind) : null;
    const now = Date.now();
    const historique = {};
    if (current && current.personnalisee) {
        [{ texte: current.texte, miseAJour: current.miseAJour, majLe: current.majLe || 0, majPar: current.majPar }, ...current.historique]
            .slice(0, MAX_HISTORY)
            .forEach((entry) => { historique[`v${entry.majLe || 0}_${Object.keys(historique).length}`] = entry; });
    }
    const document = { texte: String(texte), miseAJour: String(miseAJour).trim(), majLe: now, majPar: String(byName || '').slice(0, 120), historique };
    await set(ref(database, path), document);
    return normalizePolicy(document, kind);
};
