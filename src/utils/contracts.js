// src/utils/contracts.js
//
// Contrats de travail rattachés à un membre du personnel (compte lié par uid).
//
// Cycle de vie :  brouillon (recruteur/admin) -> envoyé (visible par l'employé) -> signé.
//   • Le MODÈLE est verrouillé : le recruteur ne remplit que les champs de CONTRACT_FIELDS, le reste
//     du texte vient de renderContract. Au moment de l'envoi, le texte rendu est FIGÉ dans le contrat
//     (renderedText) : la signature porte ainsi sur ce texte précis, même si le modèle change ensuite.
//   • L'employé signe avec l'image de signature de « Mes créations » (userCreations/{uid}/signature).
//     L'image est recopiée en data-URL quand le navigateur y est autorisé : remplacer ou supprimer
//     plus tard sa signature (le lien ImgBB est alors mis en file de suppression) ne casse pas un
//     contrat déjà signé.
//
// Stockage (règles : database.rules.json) :
//   contracts/{id}                        le contrat ; lecture recruteurs/admins, ou employé si ≠ brouillon
//   contractsByEmployee/{employeeUid}/{id} index lisible par l'employé (n'existe qu'une fois envoyé)
import { ref, get, set, update, remove, push } from 'firebase/database';
import { database } from '../firebase';
import { STAFF_SERVICES } from './staffAdmin';

export const CONTRACT_STATUS = {
    draft: { label: 'Brouillon', variant: 'secondary' },
    sent: { label: 'En attente de signature', variant: 'warning' },
    signed: { label: 'Signé', variant: 'success' },
};

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
    position: '',
    rank: '',
    contractType: 'cdi',
    startDate: '',
    endDate: '',
    salary: '',
    trialDays: '',
    supervisor: '',
    schedule: '',
});

const formatDate = (isoDate) => {
    if (!isoDate) return '—';
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return isoDate;
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const rankName = (service, rankValue) =>
    (STAFF_SERVICES[service]?.ranks || []).find((r) => r.value === rankValue)?.label || rankValue || '—';

// Valide les champs saisis ; retourne la liste des erreurs (vide = valide).
export const validateContractFields = (fields) => {
    const errors = [];
    if (!fields.position.trim()) errors.push('La fonction exercée est obligatoire.');
    if (!fields.rank) errors.push('Le grade est obligatoire.');
    if (!fields.startDate) errors.push('La date de début est obligatoire.');
    if (!fields.salary.trim()) errors.push('La rémunération est obligatoire.');
    if (fields.contractType === 'cdd') {
        if (!fields.endDate) errors.push('La date de fin est obligatoire pour un CDD.');
        else if (fields.startDate && fields.endDate < fields.startDate) errors.push('La date de fin précède la date de début.');
    }
    if (fields.trialDays !== '' && !(Number(fields.trialDays) >= 0 && Number.isInteger(Number(fields.trialDays)))) {
        errors.push('La période d\'essai doit être un nombre entier de jours.');
    }
    return errors;
};

// Rend le contrat à partir du MODÈLE VERROUILLÉ. Retourne { title, sections: [{ heading, paragraphs }], text }.
export const renderContract = ({ service, employeeName, employeeBadge, fields, issuerName }) => {
    const employer = EMPLOYERS[service] || EMPLOYERS.phmc;
    const isCdd = fields.contractType === 'cdd';
    const trial = Number(fields.trialDays) > 0
        ? `Le présent contrat débute par une période d'essai de ${Number(fields.trialDays)} jour(s), pendant laquelle chaque partie peut y mettre fin librement et sans préavis.`
        : 'Le présent contrat ne comporte pas de période d\'essai.';

    const sections = [
        {
            heading: 'Article 1 — Engagement',
            paragraphs: [
                `Entre ${employer}, représenté par ${issuerName || 'son service de recrutement'}, ci-après « l'employeur »,`,
                `et ${employeeName}${employeeBadge ? ` (ID employé ${employeeBadge})` : ''}, ci-après « l'employé(e) »,`,
                `il est convenu ce qui suit : l'employé(e) est engagé(e) en qualité de ${fields.position.trim()}, au grade de ${rankName(service, fields.rank)}.`,
            ],
        },
        {
            heading: 'Article 2 — Durée et période d\'essai',
            paragraphs: [
                isCdd
                    ? `Le présent contrat est conclu pour une durée déterminée, du ${formatDate(fields.startDate)} au ${formatDate(fields.endDate)}.`
                    : `Le présent contrat est conclu pour une durée indéterminée et prend effet le ${formatDate(fields.startDate)}.`,
                trial,
            ],
        },
        {
            heading: 'Article 3 — Fonctions et organisation',
            paragraphs: [
                `L'employé(e) exerce ses fonctions sous l'autorité de ${fields.supervisor.trim() || 'sa hiérarchie directe'}.`,
                fields.schedule.trim()
                    ? `Horaires et disponibilités : ${fields.schedule.trim()}.`
                    : 'Les horaires et disponibilités sont définis avec la hiérarchie selon les besoins du service.',
            ],
        },
        {
            heading: 'Article 4 — Rémunération',
            paragraphs: [`En contrepartie de son travail, l'employé(e) perçoit la rémunération suivante : ${fields.salary.trim()}.`],
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
    .map(([id, contract]) => ({ id, ...contract }))
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

// Tous les contrats (recruteurs et admins uniquement : règle de lecture du nœud parent).
export async function loadAllContracts() {
    const snap = await get(ref(database, 'contracts'));
    return snap.exists() ? toList(snap.val()) : [];
}

// Contrats de l'employé connecté : on passe par l'index (les brouillons n'y figurent jamais),
// puis on lit chaque contrat individuellement.
export async function loadMyContracts(uid) {
    if (!uid) return [];
    const indexSnap = await get(ref(database, `contractsByEmployee/${uid}`));
    if (!indexSnap.exists()) return [];
    const contracts = await Promise.all(Object.keys(indexSnap.val()).map(async (id) => {
        try {
            const snap = await get(ref(database, `contracts/${id}`));
            return snap.exists() ? { id, ...snap.val() } : null;
        } catch (error) {
            console.warn(`Contrat ${id} illisible :`, error);
            return null;
        }
    }));
    return contracts.filter(Boolean).sort((a, b) => (b.sentAt || b.createdAt || 0) - (a.sentAt || a.createdAt || 0));
}

// ───────────────────────────── Recruteur / admin ─────────────────────────────

// Crée ou met à jour un BROUILLON (un contrat envoyé doit d'abord être retiré).
export async function saveContractDraft({ id, employee, service, fields, issuer }) {
    const now = Date.now();
    const base = {
        employeeUid: employee.uid,
        employeeName: employee.displayName,
        employeeBadge: employee.badge || '',
        employeeEmail: employee.email || '',
        service,
        fields,
        // « staff » = membre du personnel ; « candidate » = candidat accepté (rôle en attente de contrat).
        employeeKind: employee.kind || 'staff',
        updatedAt: now,
    };
    if (id) {
        const current = (await get(ref(database, `contracts/${id}`))).val();
        if (!current) throw new Error('Contrat introuvable.');
        if (current.status !== 'draft') throw new Error('Ce contrat a été envoyé : retirez-le d\'abord pour le modifier.');
        await update(ref(database, `contracts/${id}`), base);
        return id;
    }
    const newRef = push(ref(database, 'contracts'));
    await set(newRef, { ...base, status: 'draft', createdAt: now, createdBy: issuer.uid, createdByName: issuer.name });
    return newRef.key;
}

// Fige le texte puis rend le contrat visible par l'employé.
export async function sendContract(id, issuerName) {
    const contract = (await get(ref(database, `contracts/${id}`))).val();
    if (!contract) throw new Error('Contrat introuvable.');
    if (contract.status === 'signed') throw new Error('Ce contrat est déjà signé.');
    const errors = validateContractFields(contract.fields);
    if (errors.length) throw new Error(errors.join(' '));
    const rendered = renderContract({
        service: contract.service, employeeName: contract.employeeName, employeeBadge: contract.employeeBadge,
        fields: contract.fields, issuerName,
    });
    await update(ref(database), {
        [`contracts/${id}/status`]: 'sent',
        [`contracts/${id}/renderedText`]: rendered.text,
        [`contracts/${id}/sentAt`]: Date.now(),
        [`contracts/${id}/updatedAt`]: Date.now(),
        [`contractsByEmployee/${contract.employeeUid}/${id}`]: true,
    });
    return { ...contract, id };
}

// Repasse un contrat envoyé (non signé) en brouillon : il disparaît de la liste de l'employé.
export async function retractContract(id) {
    const contract = (await get(ref(database, `contracts/${id}`))).val();
    if (!contract) throw new Error('Contrat introuvable.');
    if (contract.status === 'signed') throw new Error('Un contrat signé ne peut pas être retiré.');
    await update(ref(database), {
        [`contracts/${id}/status`]: 'draft',
        [`contracts/${id}/renderedText`]: null,
        [`contracts/${id}/sentAt`]: null,
        [`contracts/${id}/updatedAt`]: Date.now(),
        [`contractsByEmployee/${contract.employeeUid}/${id}`]: null,
    });
}

// Suppression : recruteurs pour un contrat non signé, admins pour n'importe lequel (règles Firebase).
export async function deleteContract(id) {
    const contract = (await get(ref(database, `contracts/${id}`))).val();
    if (!contract) return;
    if (contract.employeeUid) await remove(ref(database, `contractsByEmployee/${contract.employeeUid}/${id}`));
    await remove(ref(database, `contracts/${id}`));
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
    if (!signature?.url) throw new Error('Créez d\'abord votre signature (Boîte à outils → Carte de visite / signature).');
    if (contract.status !== 'sent') throw new Error('Ce contrat n\'est pas en attente de signature.');
    if (contract.employeeUid !== uid) throw new Error('Ce contrat ne vous est pas destiné.');
    const now = Date.now();
    const embedded = await embedSignatureImage(signature.url);
    const signatureRecord = { url: signature.url, signedByUid: uid, signedByName: name, signedAt: now };
    if (embedded) signatureRecord.dataUrl = embedded;
    await update(ref(database), {
        [`contracts/${contract.id}/signature`]: signatureRecord,
        [`contracts/${contract.id}/signedAt`]: now,
        [`contracts/${contract.id}/status`]: 'signed',
    });
    return { ...contract, status: 'signed', signedAt: now, signature: signatureRecord };
}
