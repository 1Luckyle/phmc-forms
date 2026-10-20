// src/utils/contracts.js
//
// Contrats de travail rattachés à un membre du personnel, un recruteur ou un candidat accepté (compte lié
// par uid). Tout est en FRANÇAIS, y compris dans la base.
//
// Cycle de vie :  brouillon (recruteur/admin) -> envoyé (visible par l'employé) -> signé.
//   • Le MODÈLE est verrouillé : le recruteur ne remplit que les champs de `champs`, le reste du texte vient
//     de renderContract. Au moment de l'envoi, le texte rendu est FIGÉ dans le contrat (texteFige) : la
//     signature porte ainsi sur ce texte précis, même si le modèle change ensuite.
//   • L'employé signe avec l'image de signature de « Mes créations » (userCreations/{uid}/signature).
//     L'image est recopiée en data-URL quand le navigateur y est autorisé (imageData) : remplacer ou supprimer
//     plus tard sa signature ne casse pas un contrat déjà signé.
//
// Stockage (règles : database.rules.json) :
//   contrats/{id}                        le contrat ; lecture recruteurs/admins, ou employé si ≠ brouillon
//   contratsParEmploye/{employeUid}/{id}  index lisible par l'employé (n'existe qu'une fois envoyé)
//   (anciens nœuds contracts / contractsByEmployee : déplacés par la migration « Recrutement en français »)
import { ref, get, set, update, remove, push } from 'firebase/database';
import { database } from '../firebase';
import { normalizeRank } from '../constants/ranks';

export const CONTRACT_STATUS = {
    brouillon: { label: 'Brouillon', variant: 'secondary', legacy: 'draft' },
    envoye: { label: 'En attente de signature', variant: 'warning', legacy: 'sent' },
    signe: { label: 'Signé', variant: 'success', legacy: 'signed' },
};
const LEGACY_CONTRACT_STATUS = Object.fromEntries(Object.entries(CONTRACT_STATUS).map(([key, value]) => [value.legacy, key]));
export const normalizeContractStatus = (value) => (CONTRACT_STATUS[value] ? value : (LEGACY_CONTRACT_STATUS[value] || value));

export const CONTRACT_TYPES = {
    cdi: 'Contrat à durée indéterminée (CDI)',
    cdd: 'Contrat à durée déterminée (CDD)',
};

// Structure employeur affichée dans le contrat, selon le service de la personne.
const EMPLOYERS = {
    phmc: 'le Pillbox Hill Medical Center (PHMC)',
    coroner: 'le service de médecine légale (DMEC) du Pillbox Hill Medical Center',
};

export const emptyContractFields = () => ({
    poste: '',
    role: '',
    typeContrat: 'cdi',
    dateDebut: '',
    dateFin: '',
    remuneration: '',
    essaiJours: '',
    responsable: '',
    horaires: '',
});

// Ancien champ (anglais) -> nouveau champ des conditions d'un contrat.
const LEGACY_FIELD_NAMES = {
    position: 'poste', rank: 'role', contractType: 'typeContrat', startDate: 'dateDebut', endDate: 'dateFin',
    salary: 'remuneration', trialDays: 'essaiJours', supervisor: 'responsable', schedule: 'horaires',
};

// Contrat au format FRANÇAIS à partir d'une entrée de la base (ancienne ou nouvelle forme).
export const normalizeContract = (raw, id = null) => {
    const source = raw || {};
    const rawFields = source.champs || source.fields || {};
    const champs = { ...emptyContractFields() };
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
    return {
        id: id ?? source.id ?? null,
        employeUid: source.employeUid ?? source.employeeUid ?? null,
        employeNom: source.employeNom ?? source.employeeName ?? '',
        employeBadge: source.employeBadge ?? source.employeeBadge ?? '',
        employeEmail: source.employeEmail ?? source.employeeEmail ?? '',
        service: source.service || 'phmc',
        typeEmploye: rawKind === 'staff' ? 'personnel' : (rawKind === 'candidate' ? 'candidat' : (rawKind === 'recruiter' ? 'recruteur' : (rawKind || 'personnel'))),
        champs,
        statut: normalizeContractStatus(source.statut ?? source.status),
        creeLe: source.creeLe ?? source.createdAt ?? null,
        creePar: source.creePar ?? source.createdBy ?? null,
        creeParNom: source.creeParNom ?? source.createdByName ?? '',
        modifieLe: source.modifieLe ?? source.updatedAt ?? null,
        envoyeLe: source.envoyeLe ?? source.sentAt ?? null,
        signeLe: source.signeLe ?? source.signedAt ?? null,
        texteFige: source.texteFige ?? source.renderedText ?? '',
        signature,
    };
};

const formatDate = (isoDate) => {
    if (!isoDate) return '—';
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return isoDate;
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Valide les champs saisis ; retourne la liste des erreurs (vide = valide).
export const validateContractFields = (champs) => {
    const errors = [];
    if (!champs.poste.trim()) errors.push('La fonction exercée est obligatoire.');
    if (!champs.role) errors.push('Le rôle est obligatoire.');
    if (!champs.dateDebut) errors.push('La date de début est obligatoire.');
    if (!champs.remuneration.trim()) errors.push('La rémunération est obligatoire.');
    if (champs.typeContrat === 'cdd') {
        if (!champs.dateFin) errors.push('La date de fin est obligatoire pour un CDD.');
        else if (champs.dateDebut && champs.dateFin < champs.dateDebut) errors.push('La date de fin précède la date de début.');
    }
    if (champs.essaiJours !== '' && !(Number(champs.essaiJours) >= 0 && Number.isInteger(Number(champs.essaiJours)))) {
        errors.push('La période d\'essai doit être un nombre entier de jours.');
    }
    return errors;
};

// Rend le contrat à partir du MODÈLE VERROUILLÉ. Retourne { title, sections: [{ heading, paragraphs }], text }.
export const renderContract = ({ service, employeeName, employeeBadge, champs, issuerName }) => {
    const employer = EMPLOYERS[service] || EMPLOYERS.phmc;
    const isCdd = champs.typeContrat === 'cdd';
    const trial = Number(champs.essaiJours) > 0
        ? `Le présent contrat débute par une période d'essai de ${Number(champs.essaiJours)} jour(s), pendant laquelle chaque partie peut y mettre fin librement et sans préavis.`
        : 'Le présent contrat ne comporte pas de période d\'essai.';

    const sections = [
        {
            heading: 'Article 1 — Engagement',
            paragraphs: [
                `Entre ${employer}, représenté par ${issuerName || 'son service de recrutement'}, ci-après « l'employeur »,`,
                `et ${employeeName}${employeeBadge ? ` (ID employé ${employeeBadge})` : ''}, ci-après « l'employé(e) »,`,
                `il est convenu ce qui suit : l'employé(e) est engagé(e) en qualité de ${champs.poste.trim()}, avec le rôle de ${normalizeRank(champs.role) || '—'}.`,
            ],
        },
        {
            heading: 'Article 2 — Durée et période d\'essai',
            paragraphs: [
                isCdd
                    ? `Le présent contrat est conclu pour une durée déterminée, du ${formatDate(champs.dateDebut)} au ${formatDate(champs.dateFin)}.`
                    : `Le présent contrat est conclu pour une durée indéterminée et prend effet le ${formatDate(champs.dateDebut)}.`,
                trial,
            ],
        },
        {
            heading: 'Article 3 — Fonctions et organisation',
            paragraphs: [
                `L'employé(e) exerce ses fonctions sous l'autorité de ${champs.responsable.trim() || 'sa hiérarchie directe'}.`,
                champs.horaires.trim()
                    ? `Horaires et disponibilités : ${champs.horaires.trim()}.`
                    : 'Les horaires et disponibilités sont définis avec la hiérarchie selon les besoins du service.',
            ],
        },
        {
            heading: 'Article 4 — Rémunération',
            paragraphs: [`En contrepartie de son travail, l'employé(e) perçoit la rémunération suivante : ${champs.remuneration.trim()}.`],
        },
        {
            heading: 'Article 5 — Obligations de l\'employé(e)',
            paragraphs: [
                'L\'employé(e) s\'engage à respecter le secret médical et la confidentialité des dossiers patients, le règlement intérieur et la hiérarchie du service, ainsi que les règles de conduite en vigueur.',
                'Tout manquement grave peut entraîner des sanctions, pouvant aller jusqu\'à la rupture du contrat.',
            ],
        },
        {
            heading: 'Article 6 — Rupture du contrat',
            paragraphs: [
                isCdd
                    ? 'Le contrat prend fin à son terme, sauf renouvellement écrit. Il peut être rompu avant terme d\'un commun accord ou en cas de faute grave.'
                    : 'Chaque partie peut mettre fin au contrat, sous réserve d\'en informer l\'autre partie. L\'employeur peut y mettre fin immédiatement en cas de faute grave.',
            ],
        },
        {
            heading: 'Article 7 — Acceptation',
            paragraphs: ['La signature électronique de l\'employé(e) ci-dessous vaut lecture et acceptation de l\'ensemble des articles du présent contrat.'],
        },
    ];

    const title = `Contrat de travail — ${employeeName}`;
    const text = [
        title.toUpperCase(),
        '',
        ...sections.flatMap((s) => [s.heading, ...s.paragraphs, '']),
    ].join('\n').trim();
    return { title, sections, text };
};

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

// ───────────────────────────── Recruteur / admin ─────────────────────────────

// Crée ou met à jour un BROUILLON (un contrat envoyé doit d'abord être retiré).
// `employee` : { uid, displayName, badge, email, kind: 'staff' | 'candidate' | 'recruiter' } (kind en anglais en
// interne côté interface ; il est enregistré en français).
export async function saveContractDraft({ id, employee, service, champs, issuer }) {
    // Un recruteur ne rédige pas son propre contrat (aussi imposé par database.rules.json) ; un admin le peut.
    if (employee.uid === issuer.uid && !issuer.isAdmin) {
        throw new Error('Vous ne pouvez pas rédiger votre propre contrat : demandez à un admin ou à un autre recruteur.');
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
    if (id) {
        const current = (await get(ref(database, `contrats/${id}`))).val();
        if (!current) throw new Error('Contrat introuvable.');
        if (normalizeContractStatus(current.statut) !== 'brouillon') throw new Error('Ce contrat a été envoyé : retirez-le d\'abord pour le modifier.');
        await update(ref(database, `contrats/${id}`), base);
        return id;
    }
    const newRef = push(ref(database, 'contrats'));
    await set(newRef, { ...base, statut: 'brouillon', creeLe: now, creePar: issuer.uid, creeParNom: issuer.name });
    return newRef.key;
}

// Fige le texte puis rend le contrat visible par l'employé.
export async function sendContract(id, issuerName) {
    const contract = normalizeContract((await get(ref(database, `contrats/${id}`))).val(), id);
    if (!contract.employeUid) throw new Error('Contrat introuvable.');
    if (contract.statut === 'signe') throw new Error('Ce contrat est déjà signé.');
    const errors = validateContractFields(contract.champs);
    if (errors.length) throw new Error(errors.join(' '));
    const rendered = renderContract({
        service: contract.service, employeeName: contract.employeNom, employeeBadge: contract.employeBadge,
        champs: contract.champs, issuerName,
    });
    await update(ref(database), {
        [`contrats/${id}/statut`]: 'envoye',
        [`contrats/${id}/texteFige`]: rendered.text,
        [`contrats/${id}/envoyeLe`]: Date.now(),
        [`contrats/${id}/modifieLe`]: Date.now(),
        [`contratsParEmploye/${contract.employeUid}/${id}`]: true,
    });
    return contract;
}

// Repasse un contrat envoyé (non signé) en brouillon : il disparaît de la liste de l'employé.
export async function retractContract(id) {
    const contract = normalizeContract((await get(ref(database, `contrats/${id}`))).val(), id);
    if (!contract.employeUid) throw new Error('Contrat introuvable.');
    if (contract.statut === 'signe') throw new Error('Un contrat signé ne peut pas être retiré.');
    await update(ref(database), {
        [`contrats/${id}/statut`]: 'brouillon',
        [`contrats/${id}/texteFige`]: null,
        [`contrats/${id}/envoyeLe`]: null,
        [`contrats/${id}/modifieLe`]: Date.now(),
        [`contratsParEmploye/${contract.employeUid}/${id}`]: null,
    });
}

// Suppression : recruteurs pour un contrat non signé, admins pour n'importe lequel (règles Firebase).
export async function deleteContract(id) {
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

// Signe un contrat envoyé. `signature` = création « signature » de l'employé ({ url, ... }).
// Les règles Firebase vérifient que l'URL est bien celle de SA signature enregistrée.
export async function signContract(contract, { uid, name, signature }) {
    if (!signature?.url) throw new Error('Créez d\'abord votre signature (Boîte à outils → Carte de visite & signature).');
    if (contract.statut !== 'envoye') throw new Error('Ce contrat n\'est pas en attente de signature.');
    if (contract.employeUid !== uid) throw new Error('Ce contrat ne vous est pas destiné.');
    const now = Date.now();
    const embedded = await embedSignatureImage(signature.url);
    const signatureRecord = { url: signature.url, signeParUid: uid, signeParNom: name, signeLe: now };
    if (embedded) signatureRecord.imageData = embedded;
    await update(ref(database), {
        [`contrats/${contract.id}/signature`]: signatureRecord,
        [`contrats/${contract.id}/signeLe`]: now,
        [`contrats/${contract.id}/statut`]: 'signe',
    });
    return { ...contract, statut: 'signe', signeLe: now, signature: signatureRecord };
}
