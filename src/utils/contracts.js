// src/utils/contracts.js
//
// Documents contractuels rattachés à un membre du personnel, un recruteur ou un candidat accepté (compte lié par uid) : contrats (CDI, CDD),
// conventions de stage, avenants, et notifications de la procédure disciplinaire (convocation, sanction, fin de contrat). Tout est en FRANÇAIS, y
// compris dans la base. Le catalogue, les champs, la validation et le CONTENU JURIDIQUE sont dans utils/contractDocs.js et utils/contractClauses.js ;
// ici, le cycle de vie et l'accès à Firebase.
//
// Cycle de vie :  brouillon (recruteur/admin) -> envoyé (visible par l'employé) -> signé.
//   • Le MODÈLE est verrouillé : le recruteur ne remplit que les champs du type de document, le reste du texte vient du modèle. Au moment de
//     l'envoi, le BBCode rendu est FIGÉ dans le document (bbCodeFige) : la signature porte sur ce texte précis, même si le modèle change ensuite.
//     (Les anciens contrats n'ont que texteFige, en texte brut : ils restent lisibles tels quels.)
//   • L'employé signe avec l'image de signature de « Mes créations » (userCreations/{uid}/signature). Pour un contrat, un avenant ou une rupture
//     d'un commun accord, c'est une ACCEPTATION ; pour une convocation, une sanction ou une notification de fin, un simple ACCUSÉ DE RÉCEPTION.
//     L'image est recopiée en data-URL quand le navigateur y est autorisé (imageData) : remplacer ou supprimer sa signature plus tard ne casse pas
//     un document déjà signé.
//
// Stockage (règles : database.rules.json) :
//   contrats/{id}                        le document ; lecture recruteurs/admins, ou employé si ≠ brouillon
//   contratsParEmploye/{employeUid}/{id}  index lisible par l'employé (n'existe qu'une fois envoyé)
//   (anciens nœuds contracts / contractsByEmployee : déplacés par la migration « Recrutement en français »)
import { ref, get, set, update, remove, push } from 'firebase/database';
import { database } from '../firebase';
import { normalizeRank } from '../constants/ranks';
import { releaseInternalStatusAfterContract } from './internalRecruitment';
import { closeThreadsAfterContract } from './applicationThreads';
import { requestRoleAfterContract } from './contractFollowUp';
import { notifyUser, notifyGroup } from './notifications';
import { logActivity } from './activityLog';
import { assertNotLocked } from './lockdownGuard';
import {
    CONTRACT_TYPES, MODEL_VERSION, acceptanceKind, isEmploymentType, typeOfChamps, emptyContractFields, validateDocFields, buildContractBb,
    buildReference, statusLabel, isDisciplinaryType,
} from './contractDocs';

export {
    CONTRACT_TYPES, emptyContractFields, validateDocFields, statusLabel, isEmploymentType, typeOfChamps, acceptanceKind, buildContractBb,
};

export const CONTRACT_STATUS = {
    brouillon: { label: 'Brouillon', variant: 'secondary', legacy: 'draft' },
    envoye: { label: 'En attente de signature', variant: 'warning', legacy: 'sent' },
    signe: { label: 'Signé', variant: 'success', legacy: 'signed' },
};
const LEGACY_CONTRACT_STATUS = Object.fromEntries(Object.entries(CONTRACT_STATUS).map(([key, value]) => [value.legacy, key]));
export const normalizeContractStatus = (value) => (CONTRACT_STATUS[value] ? value : (LEGACY_CONTRACT_STATUS[value] || value));

// Ancien champ (anglais) -> nouveau champ des conditions d'un contrat.
const LEGACY_FIELD_NAMES = {
    position: 'poste', rank: 'role', contractType: 'typeContrat', startDate: 'dateDebut', endDate: 'dateFin',
    salary: 'remuneration', trialDays: 'essaiJours', supervisor: 'responsable', schedule: 'horaires',
};

// Document au format FRANÇAIS à partir d'une entrée de la base (ancienne ou nouvelle forme).
export const normalizeContract = (raw, id = null) => {
    const source = raw || {};
    const rawFields = source.champs || source.fields || {};
    const rawType = rawFields.typeContrat ?? rawFields.contractType;
    const champs = { ...emptyContractFields(CONTRACT_TYPES[rawType] ? rawType : 'cdi') };
    Object.entries(rawFields).forEach(([key, value]) => { champs[LEGACY_FIELD_NAMES[key] || key] = value ?? ''; });
    champs.role = normalizeRank(champs.role);
    const signature = source.signature
        ? {
            url: source.signature.url,
            signeParUid: source.signature.signeParUid ?? source.signature.signedByUid,
            signeParNom: source.signature.signeParNom ?? source.signature.signedByName,
            signeLe: source.signature.signeLe ?? source.signature.signedAt,
            ...((source.signature.imageData ?? source.signature.dataUrl) ? { imageData: source.signature.imageData ?? source.signature.dataUrl } : {}),
        }
        : null;
    const rawKind = source.typeEmploye ?? source.employeeKind;
    const service = source.service || 'phmc';
    const creeLe = source.creeLe ?? source.createdAt ?? null;
    const identifier = id ?? source.id ?? null;
    return {
        id: identifier,
        employeUid: source.employeUid ?? source.employeeUid ?? null,
        employeNom: source.employeNom ?? source.employeeName ?? '',
        employeBadge: source.employeBadge ?? source.employeeBadge ?? '',
        employeEmail: source.employeEmail ?? source.employeeEmail ?? '',
        service,
        typeEmploye: rawKind === 'staff' ? 'personnel' : (rawKind === 'candidate' ? 'candidat' : (rawKind === 'recruiter' ? 'recruteur' : (rawKind || 'personnel'))),
        champs,
        statut: normalizeContractStatus(source.statut ?? source.status),
        creeLe,
        creePar: source.creePar ?? source.createdBy ?? null,
        creeParNom: source.creeParNom ?? source.createdByName ?? '',
        modifieLe: source.modifieLe ?? source.updatedAt ?? null,
        envoyeLe: source.envoyeLe ?? source.sentAt ?? null,
        signeLe: source.signeLe ?? source.signedAt ?? null,
        texteFige: source.texteFige ?? source.renderedText ?? '',
        // BBCode figé à l'envoi (absent des anciens contrats : ils n'ont que le texte brut).
        bbCodeFige: source.bbCodeFige ?? '',
        modele: source.modele ?? null,
        reference: source.reference || buildReference({ service, id: identifier, timestamp: source.envoyeLe ?? source.sentAt ?? creeLe }),
        offreExpireLe: source.offreExpireLe ?? null,
        emetteur: source.emetteur ?? null,
        signature,
    };
};

// Type du document (cdi, cdd, stage, avenant, convocation, sanction, fin).
export const contractTypeOf = (contract) => typeOfChamps(contract?.champs);

// Libellé du statut adapté au type (« Signé » pour un contrat, « Reçu » pour une notification).
export const contractStatusLabel = (contract) => statusLabel(contract.statut, contractTypeOf(contract), contract.champs);

export const isOfferExpired = (contract, now = Date.now()) => contract?.statut === 'envoye' && !!contract.offreExpireLe && now > contract.offreExpireLe;

// Intitulé court d'un document, pour les listes et les notifications.
export const contractLabel = (contract) => {
    const type = contractTypeOf(contract);
    if (type === 'cdi' || type === 'cdd' || type === 'stage') return `${CONTRACT_TYPES[type].replace(/ \(.*\)$/, '')} — ${contract.champs?.poste || 'sans intitulé'}`;
    return CONTRACT_TYPES[type];
};

// Compat : ancienne signature de validation (liste d'erreurs seulement).
export const validateContractFields = (champs, ctx) => validateDocFields(typeOfChamps(champs), champs, ctx).errors;

// ───────────────────────────── Lecture ─────────────────────────────

const toList = (value) => Object.entries(value || {})
    .map(([id, contract]) => normalizeContract(contract, id))
    .sort((a, b) => (b.modifieLe || b.creeLe || 0) - (a.modifieLe || a.creeLe || 0));

// Tous les contrats (recruteurs et admins uniquement : règle de lecture du nœud parent).
export async function loadAllContracts() {
    const snap = await get(ref(database, 'contrats'));
    return snap.exists() ? toList(snap.val()) : [];
}

// Contrats de l'employé connecté : on passe par l'index (les brouillons n'y figurent jamais),
// puis on lit chaque contrat individuellement.
export async function loadMyContracts(uid) {
    if (!uid) return [];
    const indexSnap = await get(ref(database, `contratsParEmploye/${uid}`));
    if (!indexSnap.exists()) return [];
    const contracts = await Promise.all(Object.keys(indexSnap.val()).map(async (id) => {
        try {
            const snap = await get(ref(database, `contrats/${id}`));
            return snap.exists() ? normalizeContract(snap.val(), id) : null;
        } catch (error) {
            console.warn(`Contrat ${id} illisible :`, error);
            return null;
        }
    }));
    return contracts.filter(Boolean).sort((a, b) => (b.envoyeLe || b.creeLe || 0) - (a.envoyeLe || a.creeLe || 0));
}

const loadContract = async (id) => {
    if (!id) return null;
    const snap = await get(ref(database, `contrats/${id}`));
    return snap.exists() ? normalizeContract(snap.val(), id) : null;
};

// ───────────────────────────── Recruteur / admin ─────────────────────────────

// Crée ou met à jour un BROUILLON (un document envoyé doit d'abord être retiré).
// `employee` : { uid, displayName, badge, email, kind: 'staff' | 'candidate' | 'recruiter' } (kind en anglais en
// interne côté interface ; il est enregistré en français).
export async function saveContractDraft({ id, employee, service, champs, issuer }) {
    assertNotLocked();
    // Un recruteur ne rédige pas son propre contrat (aussi imposé par database.rules.json) ; un admin le peut.
    if (employee.uid === issuer.uid && !issuer.isAdmin) {
        throw new Error('Vous ne pouvez pas rédiger votre propre contrat : demandez à un admin ou à un autre recruteur.');
    }
    // Convocation, sanction et fin de contrat : jamais par un recruteur (aussi imposé par database.rules.json).
    if (isDisciplinaryType(typeOfChamps(champs)) && !issuer.canDiscipline) {
        throw new Error('Les documents disciplinaires sont rédigés par la Direction, son assistance ou le personnel administratif.');
    }
    const now = Date.now();
    const typeEmploye = employee.kind === 'candidate' ? 'candidat' : (employee.kind === 'recruiter' ? 'recruteur' : 'personnel');
    const base = {
        employeUid: employee.uid,
        employeNom: employee.displayName,
        employeBadge: employee.badge || '',
        employeEmail: employee.email || '',
        service,
        champs,
        typeEmploye,
        modifieLe: now,
    };
    const typeLabel = CONTRACT_TYPES[typeOfChamps(champs)] || 'Document';
    if (id) {
        const current = (await get(ref(database, `contrats/${id}`))).val();
        if (!current) throw new Error('Contrat introuvable.');
        if (normalizeContractStatus(current.statut) !== 'brouillon') throw new Error('Ce document a été envoyé : retirez-le d\'abord pour le modifier.');
        await update(ref(database, `contrats/${id}`), base);
        logActivity({ category: 'contrats', action: 'contract_updated', summary: `Brouillon modifié (${typeLabel}) : ${employee?.displayName || employee?.name || current.employeNom || id}`, target: current.employeNom || undefined });
        return id;
    }
    const newRef = push(ref(database, 'contrats'));
    await set(newRef, { ...base, statut: 'brouillon', creeLe: now, creePar: issuer.uid, creeParNom: issuer.name });
    logActivity({ category: 'contrats', action: 'contract_created', summary: `Brouillon créé (${typeLabel}) : ${employee?.displayName || employee?.name || newRef.key}`, target: employee?.displayName || employee?.name || undefined });
    return newRef.key;
}

// Fige le texte puis rend le document visible par l'employé. Les documents liés (contrat modifié, convocation) sont relus dans la base :
// on ne se fie jamais à ce que l'interface a affiché. `issuer` : { name, title, signatureUrl }. Retourne { contract, warnings }.
export async function sendContract(id, issuer) {
    assertNotLocked();
    const contract = await loadContract(id);
    if (!contract?.employeUid) throw new Error('Contrat introuvable.');
    if (contract.statut === 'signe') throw new Error('Ce document est déjà signé.');
    const type = contractTypeOf(contract);
    const champs = contract.champs;

    const refContract = champs.contratRefId ? await loadContract(champs.contratRefId) : null;
    const convocation = champs.convocationRefId ? await loadContract(champs.convocationRefId) : null;
    if (champs.contratRefId && !refContract) throw new Error('Le contrat concerné est introuvable.');
    if (refContract && refContract.employeUid !== contract.employeUid) throw new Error('Le contrat concerné n\'appartient pas à cette personne.');
    if (convocation && convocation.employeUid !== contract.employeUid) throw new Error('La convocation n\'appartient pas à cette personne.');

    const now = Date.now();
    const { errors, warnings } = validateDocFields(type, champs, { refContract, convocation, now }, { forSend: true });
    if (errors.length) throw new Error(errors.join(' '));

    const rendered = buildContractBb({
        type, service: contract.service, employeeName: contract.employeNom, employeeBadge: contract.employeBadge, champs,
        issuer, id, timestamp: now, refContract, convocation,
    });
    const days = Number(champs.validiteOffreJours) || 0;
    const needsOffer = acceptanceKind(type, champs) === 'accord' && days > 0;
    await update(ref(database), {
        [`contrats/${id}/statut`]: 'envoye',
        [`contrats/${id}/bbCodeFige`]: rendered.bbCode,
        [`contrats/${id}/texteFige`]: rendered.plain,
        [`contrats/${id}/reference`]: rendered.reference,
        [`contrats/${id}/modele`]: MODEL_VERSION,
        [`contrats/${id}/emetteur`]: { nom: issuer.name || '', titre: issuer.title || '' },
        [`contrats/${id}/offreExpireLe`]: needsOffer ? now + days * 86400000 : null,
        [`contrats/${id}/envoyeLe`]: now,
        [`contrats/${id}/modifieLe`]: now,
        [`contratsParEmploye/${contract.employeUid}/${id}`]: true,
    });
    notifyUser(contract.employeUid, { type: 'contrat', titre: `Nouveau document à consulter : ${CONTRACT_TYPES[type]}`, texte: rendered.reference, lien: { cible: 'contrats' } });
    logActivity({
        category: 'contrats', action: 'contract_sent', severity: ['sanction', 'fin'].includes(type) ? 'warning' : 'info',
        summary: `${CONTRACT_TYPES[type]} envoyé : ${contract.employeNom}`, details: `Référence : ${rendered.reference}`, target: contract.employeNom || undefined,
    });
    return { contract, warnings, reference: rendered.reference };
}

// Repasse un document envoyé (non signé) en brouillon : il disparaît de la liste de l'employé.
export async function retractContract(id) {
    assertNotLocked();
    const contract = normalizeContract((await get(ref(database, `contrats/${id}`))).val(), id);
    if (!contract.employeUid) throw new Error('Contrat introuvable.');
    if (contract.statut === 'signe') throw new Error('Un document signé ne peut pas être retiré.');
    await update(ref(database), {
        [`contrats/${id}/statut`]: 'brouillon',
        [`contrats/${id}/texteFige`]: null,
        [`contrats/${id}/bbCodeFige`]: null,
        [`contrats/${id}/reference`]: null,
        [`contrats/${id}/modele`]: null,
        [`contrats/${id}/emetteur`]: null,
        [`contrats/${id}/offreExpireLe`]: null,
        [`contrats/${id}/envoyeLe`]: null,
        [`contrats/${id}/modifieLe`]: Date.now(),
        [`contratsParEmploye/${contract.employeUid}/${id}`]: null,
    });
    logActivity({ category: 'contrats', action: 'contract_retracted', severity: 'warning', summary: `${CONTRACT_TYPES[contractTypeOf(contract)]} retiré de la liste de l'employé : ${contract.employeNom}`, target: contract.employeNom || undefined });
}

// Suppression : recruteurs pour un contrat non signé, admins pour n'importe lequel (règles Firebase).
export async function deleteContract(id) {
    assertNotLocked();
    const raw = (await get(ref(database, `contrats/${id}`))).val();
    if (!raw) return;
    const uid = raw.employeUid;
    if (uid) await remove(ref(database, `contratsParEmploye/${uid}/${id}`));
    await remove(ref(database, `contrats/${id}`));
}

// ───────────────────────────── Employé ─────────────────────────────

const MAX_EMBEDDED_SIGNATURE_CHARS = 300000;

// Recopie l'image de signature en data-URL (best-effort : l'hébergeur d'images peut refuser le
// téléchargement croisé). Retourne '' en cas d'échec ou d'image trop lourde.
const embedSignatureImage = async (url) => {
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

// Signe un document envoyé. `signature` = création « signature » de l'employé ({ url, ... }).
// Les règles Firebase vérifient que l'URL est bien celle de SA signature enregistrée.
export async function signContract(contract, { uid, name, signature }) {
    assertNotLocked();
    if (!signature?.url) throw new Error('Créez d\'abord votre signature (Boîte à outils → Carte de visite & signature).');
    if (contract.statut !== 'envoye') throw new Error('Ce document n\'est pas en attente de signature.');
    if (contract.employeUid !== uid) throw new Error('Ce document ne vous est pas destiné.');
    if (isOfferExpired(contract)) throw new Error('L\'offre n\'est plus valable : elle est caduque. Demandez au recrutement de vous renvoyer le document.');
    const type = contractTypeOf(contract);
    const accord = acceptanceKind(type, contract.champs) === 'accord';
    const now = Date.now();
    const embedded = await embedSignatureImage(signature.url);
    const signatureRecord = { url: signature.url, signeParUid: uid, signeParNom: name || '', signeLe: now };
    if (embedded) signatureRecord.imageData = embedded;
    await update(ref(database), {
        [`contrats/${contract.id}/signature`]: signatureRecord,
        [`contrats/${contract.id}/signeLe`]: now,
        [`contrats/${contract.id}/statut`]: 'signe',
    });
    logActivity({
        category: 'contrats', action: accord ? 'contract_signed' : 'contract_acknowledged', severity: accord ? 'success' : 'info',
        summary: `${CONTRACT_TYPES[type]} ${accord ? 'signé' : 'reçu (accusé de réception)'} : ${contract.employeNom || name}`,
        details: `Référence : ${contract.reference}\nFonction : ${contract.champs?.poste || '—'}\nGrade : ${contract.champs?.role || '—'}`, target: contract.employeNom || name,
    });
    notifyGroup('recrutement', { type: 'contrat', titre: `${CONTRACT_TYPES[type]} ${accord ? 'signé' : 'reçu'} : ${contract.employeNom || name}`, texte: contract.reference, lien: { cible: 'recrutement' } });
    // Seul un CONTRAT d'emploi signé met fin au statut « candidat accepté » et aux échanges de candidature (best-effort).
    let followUp = { kind: 'none' };
    if (isEmploymentType(type)) {
        await releaseInternalStatusAfterContract(uid);
        await closeThreadsAfterContract(uid);
        // L'administration doit poser le rôle : une demande lui est déposée automatiquement (compte du personnel ou modification de fiche).
        if (accord) followUp = await requestRoleAfterContract(contract, { uid, name });
    }
    return { ...contract, statut: 'signe', signeLe: now, signature: signatureRecord, followUp };
}
