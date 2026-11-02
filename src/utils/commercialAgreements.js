// src/utils/commercialAgreements.js
//
// ACCORDS COMMERCIAUX du PHMC : contrats avec des entreprises, fournisseurs, prestataires, partenaires, bailleurs ou sponsors. Même philosophie que
// les contrats du personnel (utils/contracts.js) : un MODÈLE verrouillé par type d'accord (utils/commercialClauses.js : le texte juridique renvoie
// aux articles du Code Civil et du Code Pénal), des champs à remplir, un texte FIGÉ à l'envoi, puis les signatures.
//
// Cycle de vie :  brouillon -> envoyé (offre signée par le PHMC) -> signé (la Partie accepte) -> terminé.
//   • La Partie a un compte (partieUid) : elle signe elle-même depuis « Mes documents administratifs » avec sa signature de « Mes créations ».
//   • La Partie n'a pas de compte : le PHMC consigne sa signature à la main (nom, qualité, date, preuve : lien du message de forum ou de l'image).
//   • Écrit obligatoire à partir de 100 000 $ ou pour une location immobilière (Code Civil, art. 206) : le document généré y satisfait.
//
// Stockage (règles : database.rules.json) :
//   accordsCommerciaux/{id}               l'accord ; lecture : admins + Direction / administratif (disciplineUIDs), ou la Partie si ≠ brouillon
//   accordsParPartie/{partieUid}/{id}     index lisible par la Partie (n'existe qu'une fois envoyé)
import { ref, get, set, update, remove, push } from 'firebase/database';
import { database } from '../firebase';
import generateContract from '../phmc-bbcode-generators/generateContract';
import { composeContractBb } from './contractCompose';
import { buildAgreementDocument, WRITTEN_FORM_THRESHOLD, COMMERCIAL_MODEL_VERSION } from './commercialClauses';
import { logActivity } from './activityLog';
import { notifyUser } from './notifications';
import { assertNotLocked } from './lockdownGuard';

// ───────────────────────────── Catalogue ─────────────────────────────

export const AGREEMENT_TYPES = {
    fournisseur: { label: 'Accord fournisseur', short: 'Fournisseur', icon: 'fa-truck-medical', help: 'Achat de matériel, de médicaments ou de fournitures : produits, délais de livraison, qualité, retours.' },
    prestation: { label: 'Prestation de services', short: 'Prestation', icon: 'fa-screwdriver-wrench', help: 'Un prestataire (entretien, sécurité, transport, formation…) travaille pour le PHMC contre rémunération.' },
    partenariat: { label: 'Partenariat / collaboration', short: 'Partenariat', icon: 'fa-handshake', help: 'Convention de collaboration avec une entreprise ou un service : contributions de chacun, communication.' },
    location: { label: 'Location / bail', short: 'Location', icon: 'fa-building', help: 'Mise à disposition de locaux ou de matériel, par le PHMC ou à son profit : loyer, dépôt de garantie, état des lieux.' },
    sponsoring: { label: 'Sponsoring / mécénat', short: 'Sponsoring', icon: 'fa-hand-holding-heart', help: 'Soutien d\'un événement ou d\'une action, avec ses contreparties et sa visibilité.' },
};

export const AGREEMENT_STATUS = {
    brouillon: { label: 'Brouillon', variant: 'secondary' },
    envoye: { label: 'En attente de signature de la Partie', variant: 'warning' },
    signe: { label: 'En vigueur', variant: 'success' },
    termine: { label: 'Terminé', variant: 'dark' },
};

const PARTY_FORMS = [
    { value: 'societe', label: 'Société' },
    { value: 'entreprise_individuelle', label: 'Entreprise individuelle' },
    { value: 'association', label: 'Association' },
    { value: 'organisme_public', label: 'Organisme public' },
    { value: 'particulier', label: 'Particulier (personne physique)' },
];
const PERIODICITIES = [
    { value: 'unique', label: 'En une seule fois' },
    { value: 'a_la_commande', label: 'À chaque commande / prestation' },
    { value: 'hebdomadaire', label: 'Chaque semaine' },
    { value: 'mensuel', label: 'Chaque mois' },
    { value: 'trimestriel', label: 'Chaque trimestre' },
    { value: 'annuel', label: 'Chaque année' },
];

// ───────────────────────────── Champs ─────────────────────────────
// { key, label, type: text | textarea | select | date | number | checkbox, required, options, help, placeholder, visible(champs), group }

const isPerson = (c) => c.partieForme === 'particulier';

const COMMON_FIELDS = [
    { key: 'titre', label: 'Intitulé de l\'accord', type: 'text', required: true, group: 'Accord', placeholder: 'Ex. Fourniture de matériel de suture' },
    { key: 'objet', label: 'Objet détaillé', type: 'textarea', required: true, group: 'Accord', help: 'Ce que l\'accord permet, en une ou deux phrases.' },
    { key: 'partieNom', label: 'Nom ou dénomination de la Partie', type: 'text', required: true, group: 'La Partie' },
    { key: 'partieForme', label: 'Forme', type: 'select', required: true, options: PARTY_FORMS, group: 'La Partie' },
    { key: 'partieSiege', label: 'Siège ou adresse', type: 'text', required: true, group: 'La Partie' },
    { key: 'partieImmatriculee', label: 'La Partie est régulièrement constituée et enregistrée auprès de l\'autorité compétente (Code Civil, art. 112)', type: 'checkbox', group: 'La Partie', visible: (c) => !isPerson(c), help: 'À vérifier avant l\'envoi : sans enregistrement, les fondateurs engagent leur responsabilité personnelle.' },
    { key: 'representantNom', label: 'Représentant(e) qui signe', type: 'text', required: true, group: 'La Partie', visible: (c) => !isPerson(c) },
    { key: 'representantFonction', label: 'Fonction du représentant', type: 'text', group: 'La Partie', visible: (c) => !isPerson(c), placeholder: 'Gérant(e), directeur(trice)…' },
    { key: 'representantQualite', label: 'Pouvoirs du représentant', type: 'select', options: [{ value: 'dirigeant', label: 'Dirigeant(e) de la Partie' }, { value: 'mandataire', label: 'Mandataire (mandat écrit)' }], group: 'La Partie', visible: (c) => !isPerson(c), help: 'Code Civil, art. 113, 116 et 117.' },
    { key: 'mandatReference', label: 'Référence du mandat', type: 'text', required: true, group: 'La Partie', visible: (c) => !isPerson(c) && c.representantQualite === 'mandataire', help: 'Le mandat doit être établi par écrit (art. 117).' },
    { key: 'dateEffet', label: 'Prise d\'effet', type: 'date', required: true, group: 'Durée' },
    { key: 'dureeMode', label: 'Durée', type: 'select', required: true, options: [{ value: 'determinee', label: 'Déterminée (jusqu\'à une date)' }, { value: 'indeterminee', label: 'Indéterminée' }], group: 'Durée' },
    { key: 'dateFin', label: 'Date de fin', type: 'date', required: true, group: 'Durée', visible: (c) => c.dureeMode === 'determinee' },
    { key: 'reconduction', label: 'Reconduction', type: 'select', options: [{ value: 'aucune', label: 'Aucune reconduction' }, { value: 'tacite', label: 'Tacite (même durée)' }], group: 'Durée', visible: (c) => c.dureeMode === 'determinee' },
    { key: 'preavisJours', label: 'Préavis de résiliation (jours)', type: 'number', group: 'Durée', help: 'Stipulation de l\'accord : la Loi ne fixe pas de préavis.' },
    { key: 'montant', label: 'Montant ($)', type: 'number', group: 'Prix', help: 'Laisser vide si aucun paiement en argent n\'est prévu.' },
    { key: 'periodicite', label: 'Périodicité du paiement', type: 'select', options: PERIODICITIES, group: 'Prix', visible: (c) => Number(c.montant) > 0 },
    { key: 'modalitesPaiement', label: 'Modalités de paiement', type: 'textarea', group: 'Prix', visible: (c) => Number(c.montant) > 0, placeholder: 'Virement Fleeca à la livraison, facture à 15 jours…' },
    { key: 'penaliteForfaitaire', label: 'Indemnité forfaitaire en cas de manquement ($)', type: 'number', group: 'Prix', help: 'Facultatif. Doit rester une estimation raisonnable du préjudice, pas une pénalité (Code Civil, art. 215).' },
    { key: 'obligationsPhmc', label: 'Obligations du PHMC', type: 'textarea', group: 'Engagements', placeholder: 'Facultatif : sinon, le modèle prévoit le paiement et la bonne foi.' },
    { key: 'obligationsPartie', label: 'Obligations de la Partie', type: 'textarea', group: 'Engagements', placeholder: 'Facultatif.' },
    { key: 'confidentialite', label: 'Clause de confidentialité et de secret (recommandée)', type: 'checkbox', group: 'Engagements', defaultValue: true },
    { key: 'clausesParticulieres', label: 'Clauses particulières', type: 'textarea', group: 'Engagements', help: 'Ajoutées telles quelles à la fin de l\'accord. Pas de BBCode : les crochets sont retirés.' },
];

const TYPE_FIELDS = {
    fournisseur: [
        { key: 'produits', label: 'Biens fournis', type: 'textarea', required: true, group: 'Fournisseur', placeholder: 'Matériel de suture, gants, solutés…' },
        { key: 'delaiLivraisonJours', label: 'Délai de livraison (jours)', type: 'number', group: 'Fournisseur' },
        { key: 'conformite', label: 'Exigences de qualité et de conformité', type: 'textarea', group: 'Fournisseur' },
        { key: 'retours', label: 'Produits défectueux : conditions de retour', type: 'textarea', group: 'Fournisseur' },
    ],
    prestation: [
        { key: 'prestation', label: 'Prestations à réaliser', type: 'textarea', required: true, group: 'Prestation' },
        { key: 'livrables', label: 'Résultats / livrables attendus', type: 'textarea', group: 'Prestation' },
        { key: 'lieuExecution', label: 'Lieu d\'exécution', type: 'text', group: 'Prestation' },
        { key: 'assurance', label: 'Le prestataire est couvert par une assurance de responsabilité', type: 'checkbox', group: 'Prestation' },
    ],
    partenariat: [
        { key: 'finalite', label: 'Finalité du partenariat', type: 'textarea', required: true, group: 'Partenariat' },
        { key: 'contributionPhmc', label: 'Contribution du PHMC', type: 'textarea', required: true, group: 'Partenariat' },
        { key: 'contributionPartie', label: 'Contribution de la Partie', type: 'textarea', required: true, group: 'Partenariat' },
        { key: 'communication', label: 'Communication, noms et logos', type: 'textarea', group: 'Partenariat' },
        { key: 'exclusivite', label: 'Partenariat exclusif', type: 'checkbox', group: 'Partenariat' },
    ],
    location: [
        { key: 'sens', label: 'Sens de la mise à disposition', type: 'select', required: true, options: [{ value: 'phmc_locataire', label: 'La Partie met un bien à la disposition du PHMC' }, { value: 'phmc_bailleur', label: 'Le PHMC met un bien à la disposition de la Partie' }], group: 'Location' },
        { key: 'bien', label: 'Bien concerné', type: 'textarea', required: true, group: 'Location', placeholder: 'Local, entrepôt, véhicule, matériel…' },
        { key: 'adresseBien', label: 'Adresse du bien', type: 'text', group: 'Location' },
        { key: 'usageAutorise', label: 'Usage autorisé', type: 'text', group: 'Location' },
        { key: 'depotGarantie', label: 'Dépôt de garantie ($)', type: 'number', group: 'Location' },
        { key: 'etatDesLieux', label: 'État des lieux à la remise et à la restitution', type: 'checkbox', group: 'Location', defaultValue: true },
    ],
    sponsoring: [
        { key: 'sens', label: 'Sens du soutien', type: 'select', required: true, options: [{ value: 'phmc_beneficiaire', label: 'La Partie soutient le PHMC' }, { value: 'phmc_sponsor', label: 'Le PHMC soutient la Partie' }], group: 'Sponsoring' },
        { key: 'evenement', label: 'Événement ou action soutenu', type: 'text', required: true, group: 'Sponsoring' },
        { key: 'contreparties', label: 'Contreparties', type: 'textarea', required: true, group: 'Sponsoring' },
        { key: 'visibilite', label: 'Visibilité accordée', type: 'textarea', group: 'Sponsoring' },
    ],
};

export const typeOfAgreement = (agreementOrType) => {
    const key = typeof agreementOrType === 'string' ? agreementOrType : agreementOrType?.type;
    return AGREEMENT_TYPES[key] ? key : 'fournisseur';
};

export const fieldsFor = (type) => [...COMMON_FIELDS, ...(TYPE_FIELDS[typeOfAgreement(type)] || [])];
export const visibleFields = (type, champs) => fieldsFor(type).filter((field) => !field.visible || field.visible(champs));

export const emptyAgreementFields = (type) => {
    const champs = {
        dureeMode: 'determinee', reconduction: 'aucune', representantQualite: 'dirigeant', partieForme: 'societe', periodicite: 'unique', preavisJours: 15,
    };
    fieldsFor(type).forEach((field) => {
        if (champs[field.key] !== undefined) return;
        if (field.defaultValue !== undefined) champs[field.key] = field.defaultValue;
        else champs[field.key] = field.type === 'checkbox' ? false : '';
    });
    if (type === 'location') champs.sens = 'phmc_locataire';
    if (type === 'sponsoring') champs.sens = 'phmc_beneficiaire';
    return champs;
};

// ───────────────────────────── Validation ─────────────────────────────

export const validateAgreement = (type, champs, { forSend = false } = {}) => {
    const errors = [];
    const warnings = [];
    visibleFields(type, champs).forEach((field) => {
        if (!field.required) return;
        const value = champs[field.key];
        if (value === '' || value == null || (field.type === 'checkbox' && !value)) errors.push(`« ${field.label} » est obligatoire.`);
    });
    ['montant', 'penaliteForfaitaire', 'depotGarantie', 'delaiLivraisonJours', 'preavisJours'].forEach((key) => {
        if (champs[key] !== '' && champs[key] != null && (Number.isNaN(Number(champs[key])) || Number(champs[key]) < 0)) errors.push('Les montants et délais doivent être des nombres positifs.');
    });
    if (champs.dureeMode === 'determinee' && champs.dateEffet && champs.dateFin && champs.dateFin <= champs.dateEffet) errors.push('La date de fin doit être postérieure à la prise d\'effet.');
    if (forSend) {
        if (!isPerson(champs) && !champs.partieImmatriculee) errors.push('Avant l\'envoi, confirmez que la Partie est régulièrement constituée et enregistrée (Code Civil, art. 112).');
        if (champs.dateEffet && champs.dateEffet < new Date().toISOString().slice(0, 10)) warnings.push('La prise d\'effet est déjà passée.');
        if (Number(champs.penaliteForfaitaire) > 0 && Number(champs.montant) > 0 && Number(champs.penaliteForfaitaire) > Number(champs.montant) * 2) {
            warnings.push('L\'indemnité forfaitaire dépasse deux fois le montant de l\'accord : elle risque d\'être jugée excessive et réputée non écrite (Code Civil, art. 215).');
        }
    }
    if (Number(champs.montant) >= WRITTEN_FORM_THRESHOLD || type === 'location') warnings.push('Écrit obligatoire (Code Civil, art. 206) : l\'accord ne produit son effet qu\'une fois signé par les deux Parties.');
    return { errors, warnings };
};

// ───────────────────────────── Rendu ─────────────────────────────

const referenceOf = (id, timestamp) => `AC-${new Date(timestamp).getFullYear()}-${String(id || '').slice(-5).toUpperCase()}`;

const stripBb = (bbCode) => String(bbCode || '')
    .replace(/\{\{[A-Z_]+\}\}/g, '')
    .replace(/\[(?:br|hr)\]\[\/(?:br|hr)\]/g, '\n')
    .replace(/\[\/?[a-z*]+(?:=[^\]]*)?\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// → { bbCode, plain, reference }. `issuer` : { name, title, signatureUrl }.
export const buildAgreementBb = ({ type, champs, issuer, id, timestamp }) => {
    const reference = referenceOf(id, timestamp);
    const partyFormLabel = (PARTY_FORMS.find((entry) => entry.value === champs.partieForme) || {}).label || '';
    const doc = buildAgreementDocument({
        type, typeLabel: AGREEMENT_TYPES[type]?.label || '', champs: { ...champs, partieFormeLabel: partyFormLabel.toLowerCase() }, issuer, reference, timestamp,
    });
    const bbCode = generateContract(doc);
    return { bbCode, plain: stripBb(bbCode), reference };
};

// BBCode affiché : le texte figé + la signature de la Partie (ou « en attente »).
export const agreementBbCode = (agreement) => (agreement?.bbCodeFige
    ? composeContractBb(agreement.bbCodeFige, { signature: agreement.signature, signedAt: agreement.signeLe })
    : '');

// ───────────────────────────── Lecture ─────────────────────────────

export const normalizeAgreement = (raw, id) => {
    const value = raw || {};
    return {
        id,
        type: typeOfAgreement(value.type),
        statut: AGREEMENT_STATUS[value.statut] ? value.statut : 'brouillon',
        champs: { ...emptyAgreementFields(typeOfAgreement(value.type)), ...(value.champs || {}) },
        partieUid: value.partieUid || '',
        partieNom: value.partieNom || value.champs?.partieNom || '',
        partieCompteNom: value.partieCompteNom || '',
        creeLe: value.creeLe || 0,
        creePar: value.creePar || '',
        creeParNom: value.creeParNom || '',
        modifieLe: value.modifieLe || 0,
        envoyeLe: value.envoyeLe || 0,
        signeLe: value.signeLe || 0,
        termineLe: value.termineLe || 0,
        reference: value.reference || '',
        bbCodeFige: value.bbCodeFige || '',
        texteFige: value.texteFige || '',
        emetteur: value.emetteur || null,
        signature: value.signature || null,
        fin: value.fin || null,
    };
};

const toList = (value) => Object.entries(value || {}).map(([id, raw]) => normalizeAgreement(raw, id)).sort((a, b) => (b.modifieLe || b.creeLe) - (a.modifieLe || a.creeLe));

export async function loadAllAgreements() {
    const snap = await get(ref(database, 'accordsCommerciaux'));
    return snap.exists() ? toList(snap.val()) : [];
}

// Accords envoyés à la personne connectée (index lisible par elle ; les brouillons n'y figurent jamais).
export async function loadMyAgreements(uid) {
    if (!uid) return [];
    const indexSnap = await get(ref(database, `accordsParPartie/${uid}`));
    if (!indexSnap.exists()) return [];
    const list = await Promise.all(Object.keys(indexSnap.val()).map(async (id) => {
        try {
            const snap = await get(ref(database, `accordsCommerciaux/${id}`));
            return snap.exists() ? normalizeAgreement(snap.val(), id) : null;
        } catch (error) {
            console.warn(`Accord ${id} illisible :`, error);
            return null;
        }
    }));
    return list.filter(Boolean).sort((a, b) => (b.envoyeLe || b.creeLe) - (a.envoyeLe || a.creeLe));
}

const loadOne = async (id) => {
    const snap = await get(ref(database, `accordsCommerciaux/${id}`));
    return snap.exists() ? normalizeAgreement(snap.val(), id) : null;
};

// ───────────────────────────── Direction / administration ─────────────────────────────

// `partner` : { uid?, displayName? } — compte de la Partie si elle en a un (elle signera elle-même).
export async function saveAgreementDraft({ id, type, champs, partner, issuer }) {
    assertNotLocked();
    const now = Date.now();
    const base = {
        type,
        champs,
        partieNom: champs.partieNom || '',
        partieUid: partner?.uid || null,
        partieCompteNom: partner?.displayName || null,
        modifieLe: now,
    };
    if (id) {
        const current = await loadOne(id);
        if (!current) throw new Error('Accord introuvable.');
        if (current.statut !== 'brouillon') throw new Error('Cet accord a été envoyé : retirez-le d\'abord pour le modifier.');
        await update(ref(database, `accordsCommerciaux/${id}`), base);
        logActivity({ category: 'contrats', action: 'agreement_updated', summary: `Brouillon d'accord commercial modifié : ${champs.titre || id}`, target: champs.partieNom || undefined });
        return id;
    }
    const newRef = push(ref(database, 'accordsCommerciaux'));
    await set(newRef, { ...base, statut: 'brouillon', creeLe: now, creePar: issuer.uid, creeParNom: issuer.name });
    logActivity({ category: 'contrats', action: 'agreement_created', summary: `Brouillon d'accord commercial créé (${AGREEMENT_TYPES[type]?.short || type}) : ${champs.titre || newRef.key}`, target: champs.partieNom || undefined });
    return newRef.key;
}

// Fige le texte et rend l'accord visible par la Partie (si elle a un compte). Le texte envoyé est relu dans la base, jamais celui de l'écran.
export async function sendAgreement(id, issuer) {
    assertNotLocked();
    const agreement = await loadOne(id);
    if (!agreement) throw new Error('Accord introuvable.');
    if (agreement.statut === 'signe' || agreement.statut === 'termine') throw new Error('Cet accord est déjà signé.');
    const { errors, warnings } = validateAgreement(agreement.type, agreement.champs, { forSend: true });
    if (errors.length) throw new Error(errors.join(' '));
    const now = Date.now();
    const rendered = buildAgreementBb({ type: agreement.type, champs: agreement.champs, issuer, id, timestamp: now });
    const updates = {
        [`accordsCommerciaux/${id}/statut`]: 'envoye',
        [`accordsCommerciaux/${id}/bbCodeFige`]: rendered.bbCode,
        [`accordsCommerciaux/${id}/texteFige`]: rendered.plain,
        [`accordsCommerciaux/${id}/reference`]: rendered.reference,
        [`accordsCommerciaux/${id}/modele`]: COMMERCIAL_MODEL_VERSION,
        [`accordsCommerciaux/${id}/emetteur`]: { nom: issuer.name || '', titre: issuer.title || '' },
        [`accordsCommerciaux/${id}/envoyeLe`]: now,
        [`accordsCommerciaux/${id}/modifieLe`]: now,
    };
    if (agreement.partieUid) updates[`accordsParPartie/${agreement.partieUid}/${id}`] = true;
    await update(ref(database), updates);
    if (agreement.partieUid) {
        notifyUser(agreement.partieUid, { type: 'contrat', titre: `Nouvel accord commercial à signer : ${agreement.champs.titre}`, texte: rendered.reference, lien: { cible: 'contrats' } });
    }
    logActivity({ category: 'contrats', action: 'agreement_sent', summary: `Accord commercial envoyé : ${agreement.champs.titre}`, details: `Référence : ${rendered.reference}`, target: agreement.champs.partieNom || undefined });
    return { agreement, warnings, reference: rendered.reference };
}

export async function retractAgreement(id) {
    assertNotLocked();
    const agreement = await loadOne(id);
    if (!agreement) throw new Error('Accord introuvable.');
    if (agreement.statut === 'signe' || agreement.statut === 'termine') throw new Error('Un accord signé ne peut pas être retiré.');
    const updates = {
        [`accordsCommerciaux/${id}/statut`]: 'brouillon',
        [`accordsCommerciaux/${id}/bbCodeFige`]: null,
        [`accordsCommerciaux/${id}/texteFige`]: null,
        [`accordsCommerciaux/${id}/reference`]: null,
        [`accordsCommerciaux/${id}/modele`]: null,
        [`accordsCommerciaux/${id}/emetteur`]: null,
        [`accordsCommerciaux/${id}/envoyeLe`]: null,
        [`accordsCommerciaux/${id}/modifieLe`]: Date.now(),
    };
    if (agreement.partieUid) updates[`accordsParPartie/${agreement.partieUid}/${id}`] = null;
    await update(ref(database), updates);
    logActivity({ category: 'contrats', action: 'agreement_retracted', severity: 'warning', summary: `Accord commercial retiré : ${agreement.champs.titre}`, target: agreement.champs.partieNom || undefined });
}

// Suppression : brouillons ou accords envoyés non signés (les accords signés sont archivés : on y met fin au lieu de les supprimer).
export async function deleteAgreement(id) {
    assertNotLocked();
    const agreement = await loadOne(id);
    if (!agreement) return;
    if (agreement.statut === 'signe' || agreement.statut === 'termine') throw new Error('Un accord signé est conservé : mettez-y fin plutôt que de le supprimer.');
    if (agreement.partieUid) await remove(ref(database, `accordsParPartie/${agreement.partieUid}/${id}`));
    await remove(ref(database, `accordsCommerciaux/${id}`));
    logActivity({ category: 'contrats', action: 'agreement_deleted', severity: 'warning', summary: `Accord commercial supprimé : ${agreement.champs.titre}`, target: agreement.champs.partieNom || undefined });
}

// Signature de la Partie SANS compte, consignée par le PHMC. `proof` : { nom, fonction, preuve, imageUrl? }.
export async function recordPartnerSignature(id, proof, recorder) {
    assertNotLocked();
    const agreement = await loadOne(id);
    if (!agreement) throw new Error('Accord introuvable.');
    if (agreement.statut !== 'envoye') throw new Error('Seul un accord envoyé peut être signé.');
    if (agreement.partieUid) throw new Error('La Partie a un compte : c\'est elle qui signe, depuis « Mes documents administratifs ».');
    if (!String(proof.nom || '').trim()) throw new Error('Indiquez le nom du signataire.');
    if (!String(proof.preuve || '').trim()) throw new Error('Indiquez la preuve de la signature (lien du message de forum, de l\'image ou du document).');
    const now = Date.now();
    const signature = {
        mode: 'manuel',
        signeParNom: String(proof.nom).trim().slice(0, 120),
        fonction: String(proof.fonction || '').trim().slice(0, 120),
        preuve: String(proof.preuve).trim().slice(0, 500),
        ...(proof.imageUrl && /^https?:\/\//i.test(proof.imageUrl.trim()) ? { url: proof.imageUrl.trim() } : {}),
        consigneParNom: recorder?.name || '',
        signeLe: now,
    };
    await update(ref(database), {
        [`accordsCommerciaux/${id}/signature`]: signature,
        [`accordsCommerciaux/${id}/signeLe`]: now,
        [`accordsCommerciaux/${id}/statut`]: 'signe',
        [`accordsCommerciaux/${id}/modifieLe`]: now,
    });
    logActivity({ category: 'contrats', action: 'agreement_signed', summary: `Accord commercial signé (signature consignée) : ${agreement.champs.titre}`, details: `Référence : ${agreement.reference}`, target: agreement.champs.partieNom || undefined });
}

// Fin d'un accord signé (terme atteint, résiliation, résolution). L'accord est conservé.
export async function terminateAgreement(id, { motif, date }) {
    assertNotLocked();
    const agreement = await loadOne(id);
    if (!agreement) throw new Error('Accord introuvable.');
    if (agreement.statut !== 'signe') throw new Error('Seul un accord en vigueur peut être terminé.');
    if (!String(motif || '').trim()) throw new Error('Indiquez le motif de la fin de l\'accord.');
    const now = Date.now();
    await update(ref(database), {
        [`accordsCommerciaux/${id}/statut`]: 'termine',
        [`accordsCommerciaux/${id}/termineLe`]: now,
        [`accordsCommerciaux/${id}/fin`]: { motif: String(motif).trim().slice(0, 500), date: date || null },
        [`accordsCommerciaux/${id}/modifieLe`]: now,
    });
    logActivity({ category: 'contrats', action: 'agreement_terminated', severity: 'warning', summary: `Accord commercial terminé : ${agreement.champs.titre}`, details: String(motif).slice(0, 200), target: agreement.champs.partieNom || undefined });
}

// ───────────────────────────── La Partie (avec compte) ─────────────────────────────

const MAX_EMBEDDED_SIGNATURE_CHARS = 300000;
const embedImage = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) return '';
        const blob = await response.blob();
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        return dataUrl.length <= MAX_EMBEDDED_SIGNATURE_CHARS ? dataUrl : '';
    } catch (error) {
        return '';
    }
};

// Signature de la Partie qui a un compte. `signature` = sa création « signature » ({ url }) ; les règles Firebase vérifient que c'est la sienne.
export async function signAgreementAsPartner(agreement, { uid, name, signature }) {
    assertNotLocked();
    if (!signature?.url) throw new Error('Créez d\'abord votre signature.');
    const fresh = await loadOne(agreement.id);
    if (!fresh || fresh.partieUid !== uid) throw new Error('Cet accord ne vous est pas destiné.');
    if (fresh.statut !== 'envoye') throw new Error('Cet accord n\'est plus en attente de signature.');
    const now = Date.now();
    const imageData = await embedImage(signature.url);
    const record = { mode: 'compte', signeParUid: uid, signeParNom: String(name || '').slice(0, 120), url: signature.url, ...(imageData ? { imageData } : {}), signeLe: now };
    await update(ref(database), {
        [`accordsCommerciaux/${agreement.id}/signature`]: record,
        [`accordsCommerciaux/${agreement.id}/signeLe`]: now,
        [`accordsCommerciaux/${agreement.id}/statut`]: 'signe',
    });
    logActivity({ category: 'contrats', action: 'agreement_signed', summary: `Accord commercial signé par la Partie : ${fresh.champs.titre}`, details: `Référence : ${fresh.reference}`, target: fresh.champs.partieNom || undefined });
    return { ...fresh, statut: 'signe', signature: record, signeLe: now };
}
