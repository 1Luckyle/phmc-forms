// src/utils/staffAdmin.js
//
// Opérations d'administration du personnel et des comptes (menu « Utilisateurs » du
// panneau admin). Reprend EXACTEMENT les écritures Firebase de l'ancien « Gérer le
// Personnel » (EmployeeModal) et de « Gérer les Civils » (ManageCivilians), et y ajoute les
// deux conversions encadrées :
//   • Civil → Personnel : crée la fiche staff (grade, badge) AVEC le même uid ; le profil Civil
//     est conservé (l'application donne la priorité à la fiche staff à la connexion) ;
//   • Personnel → Civil : retire la fiche staff mais NE supprime NI le compte de connexion NI
//     les rapports (contrairement à « Supprimer »).
// Les listes staff/phmc et staff/coroner peuvent être des tableaux OU des objets à clés
// poussées : tout passe par des clés lues au moment de l'écriture.
import { ref, get, set, update, push, query, orderByChild, equalTo } from 'firebase/database';
import { database, auth } from '../firebase';
import { PHMC_RANKS, CORONER_RANKS, normalizeRank, getRoleInfo, familyOfRank, familyOfMember, familiesOfMember, extraRanksOf, cleanExtraRanks, sortKeyOfRank } from '../constants/ranks';
import { getEmployeeDisplayName } from './employeeName';
import { sendEyefindMail } from './eyefindMail';
import { canonicalPatientId } from './patientId';
import { findPatientNodes } from './patientRecords';
import { markAccountDeleted, clearDeletedMark, staffPatientIdOf } from './deletedAccounts';

export const STAFF_SERVICES = {
    phmc: { key: 'phmc', label: 'PHMC (hospitalier)', path: 'staff/phmc', ranks: PHMC_RANKS, defaultPrefix: 'MD' },
    coroner: { key: 'coroner', label: 'DMEC (médecine légale)', path: 'staff/coroner', ranks: CORONER_RANKS, defaultPrefix: 'TF' },
};

const sanitizeNode = (name) => String(name || '').trim().replace(/[.#$[\]/ ]+/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');

const sendMailBestEffort = (params) => {
    if (!params.to) return;
    sendEyefindMail(params).then((result) => {
        if (!result.ok) console.warn('Eyefind Mail non envoyé:', result.error, result.message);
    });
};

// Libellé français d'un rôle ; une ancienne valeur anglaise (avant migration) est traduite à la volée.
export const rankLabel = (service, rankValue) => {
    const normalized = normalizeRank(rankValue);
    return (STAFF_SERVICES[service]?.ranks || []).find((r) => r.value === normalized)?.label || normalized || '—';
};

// Badge complet « PRÉFIXE-chiffres » (le préfixe dépend du grade).
export const buildBadge = (service, rankValue, digits) => {
    const cfg = STAFF_SERVICES[service];
    const prefix = cfg.ranks.find((r) => r.value === normalizeRank(rankValue))?.badgePrefix || cfg.defaultPrefix;
    return `${prefix}-${String(digits).replace(/\D/g, '')}`;
};
export const badgeDigits = (badge) => {
    const text = String(badge || '');
    return text.includes('-') ? text.split('-').slice(1).join('') : text.replace(/\D/g, '');
};

// ───────────────────────────── Lecture ─────────────────────────────

// Tous les membres du personnel, avec la clé sous laquelle ils sont stockés.
export async function loadStaffMembers() {
    const members = [];
    for (const service of Object.values(STAFF_SERVICES)) {
        const snap = await get(ref(database, service.path));
        if (!snap.exists()) continue;
        Object.entries(snap.val() || {}).forEach(([key, entry]) => {
            if (!entry || !entry.name) return;
            // family : famille du personnel (soignant / administration / polyvalent / dmec), déduite du rôle si absente.
            members.push({
                ...entry, service: service.key, storageKey: key, displayName: getEmployeeDisplayName(entry),
                family: familyOfMember(entry, service.key),
                families: familiesOfMember(entry, service.key),
                extraRanks: extraRanksOf(entry),
            });
        });
    }
    // Tri : famille, puis rôle du plus élevé au moins élevé, puis nom.
    return members.sort((a, b) => (sortKeyOfRank(a.rank || a.category, a.service) - sortKeyOfRank(b.rank || b.category, b.service))
        || a.displayName.localeCompare(b.displayName));
}

export async function loadCivilians() {
    const snap = await get(ref(database, 'civilians'));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([uid, civilian]) => ({ uid, ...civilian }))
        .sort((a, b) => `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`));
}

export async function loadRecruiterUids() {
    // Droit Recruteur : nœud français « recruteurs » fusionné avec l'ancien « recruiterUIDs » (avant migration).
    const [newSnap, oldSnap] = await Promise.all([get(ref(database, 'recruteurs')), get(ref(database, 'recruiterUIDs')).catch(() => null)]);
    return { ...(oldSnap && oldSnap.exists() ? oldSnap.val() : {}), ...(newSnap.exists() ? newSnap.val() : {}) };
}

// ───────────────────────────── Personnel ─────────────────────────────

// Prénom / nom d'une fiche (les fiches existent sous plusieurs formes, voir employeeName.js).
export const staffNameParts = (member) => {
    const { firstName, lastName, name = '' } = member || {};
    if (firstName && lastName) return { firstName, lastName };
    if (firstName) {
        const rest = name.trim().toLowerCase().startsWith(firstName.trim().toLowerCase())
            ? name.trim().slice(firstName.trim().length).trim()
            : '';
        return { firstName, lastName: lastName || rest };
    }
    if (lastName) {
        const base = name.trim().toLowerCase().endsWith(lastName.trim().toLowerCase())
            ? name.trim().slice(0, name.trim().length - lastName.trim().length).trim()
            : name.trim();
        return { firstName: base, lastName };
    }
    const parts = name.trim().split(' ');
    return { firstName: parts.slice(0, -1).join(' ') || name.trim(), lastName: parts.length > 1 ? parts[parts.length - 1] : '' };
};

// Renomme le « propriétaire » de rapports : déplace savedReports/{ancien nom} vers
// savedReports/{nouveau nom} et met à jour tout ce qui y pointe (authorName/creatorName, index
// des dossiers patients, marqueurs « copié par » et chemins des copies). Sans cela, un renommage
// ferait disparaître les rapports de la liste de leur auteur (le nom EST la clé des rapports).
// Les rapports sont d'abord copiés à la nouvelle adresse, puis les anciens supprimés.
export async function renameReportOwner(oldAuthorName, newAuthorName) {
    const oldNode = sanitizeNode(oldAuthorName);
    const newNode = sanitizeNode(newAuthorName);
    const result = { moved: 0 };
    if (!oldNode || !newNode) return result;
    const sourceSnap = await get(ref(database, `savedReports/${oldNode}`));
    if (!sourceSnap.exists()) return result;
    if (oldNode !== newNode) {
        const destinationSnap = await get(ref(database, `savedReports/${newNode}`));
        if (destinationSnap.exists()) {
            throw new Error(`Des rapports existent déjà sous « ${newNode} » : renommage refusé pour ne rien écraser. Utilisez l'outil de migration.`);
        }
    }

    const reports = sourceSnap.val();
    const writes = {};
    const deletions = {};
    const nodeCache = new Map(); // nœud d'index -> entrées

    const readIndexNode = async (patientNode) => {
        if (!nodeCache.has(patientNode)) {
            const snap = await get(ref(database, `patientRecords/${patientNode}`));
            nodeCache.set(patientNode, snap.exists() ? snap.val() : {});
        }
        return nodeCache.get(patientNode);
    };

    for (const [key, report] of Object.entries(reports)) {
        const selfCreated = !report.creatorName || report.creatorName === report.authorName;
        const newPath = `savedReports/${newNode}/${key}`;
        const migrated = { ...report, authorName: newAuthorName };
        if (selfCreated) migrated.creatorName = newAuthorName;
        if (migrated.data) {
            migrated.data = { ...migrated.data };
            ['phmcEmployee', 'coronerEmployee'].forEach((field) => {
                if (migrated.data[field] === oldAuthorName) migrated.data[field] = newAuthorName;
            });
        }
        writes[newPath] = migrated;
        if (oldNode !== newNode) deletions[`savedReports/${oldNode}/${key}`] = null;

        const patientId = report.data?.patientID;
        if (!patientId) continue;
        for (const patientNode of await findPatientNodes(patientId)) {
            const entries = await readIndexNode(patientNode);
            const entry = entries[key];
            if (!entry || entry.reportPath !== `savedReports/${oldNode}/${key}`) continue;
            const nodeBase = `patientRecords/${patientNode}`;
            const base = `${nodeBase}/${key}`;
            writes[`${base}/reportPath`] = newPath;
            writes[`${base}/authorName`] = newAuthorName;
            if (selfCreated) writes[`${base}/creatorName`] = newAuthorName;

            // Cette entrée est une COPIE : le marqueur « copié par » de l'original suit le nouveau nom.
            if (entry.copiedFrom?.indexKey) {
                const originalBase = `patientRecords/${entry.copiedFrom.patientNode || patientNode}/${entry.copiedFrom.indexKey}/copiedBy`;
                if (oldNode !== newNode) writes[`${originalBase}/${oldNode}`] = null;
                writes[`${originalBase}/${newNode}`] = key;
            }
            // Cette entrée est un ORIGINAL copié par des médecins : leurs copies pointent vers le nouveau chemin.
            Object.entries(entry.copiedBy || {}).forEach(([copierNode, copyKey]) => {
                writes[`savedReports/${copierNode}/${copyKey}/copiedFrom/reportPath`] = newPath;
                writes[`${nodeBase}/${copyKey}/copiedFrom/reportPath`] = newPath;
                if (selfCreated) {
                    writes[`savedReports/${copierNode}/${copyKey}/creatorName`] = newAuthorName;
                    writes[`${nodeBase}/${copyKey}/creatorName`] = newAuthorName;
                }
            });
        }
    }

    // Phase 1 : écritures (par lots), phase 2 : suppression des anciens rapports.
    const flush = async (pathsObject) => {
        const entries = Object.entries(pathsObject);
        for (let i = 0; i < entries.length; i += 150) {
            await update(ref(database), Object.fromEntries(entries.slice(i, i + 150)));
        }
    };
    await flush(writes);
    await flush(deletions);
    result.moved = Object.keys(reports).length;
    return result;
}

// Modifie une fiche du personnel. L'ENREGISTREMENT SE FAIT SUR L'ID (compte de connexion, sinon
// numéro de badge), pas sur le nom : le prénom et le nom sont modifiables, et les rapports de la
// personne suivent automatiquement (renameReportOwner). Le numéro de badge — l'ID employé, aussi
// son ID patient PHMC-{badge} — n'est JAMAIS modifié ici (seul le préfixe suit le grade).
export async function updateStaffMember(member, { firstName, middleName, lastName, rank, discord, phNumber, serviceDirige, extraRanks }) {
    const cfg = STAFF_SERVICES[member.service];
    const snap = await get(ref(database, cfg.path));
    if (!snap.exists()) throw new Error('Liste du personnel introuvable.');
    const digits = badgeDigits(member.badge);
    const found = Object.entries(snap.val() || {}).find(([, entry]) => entry && (
        member.uid ? entry.uid === member.uid : (badgeDigits(entry.badge) === digits && entry.name === member.name)
    ));
    if (!found) throw new Error('Fiche introuvable (elle a peut-être été modifiée ou supprimée entre-temps).');
    const [key, current] = found;

    const newFirst = (firstName ?? '').trim();
    const newLast = (lastName ?? '').trim();
    if (!newFirst) throw new Error('Le prénom est obligatoire.');
    const newName = `${newFirst} ${newLast}`.trim();
    const renamed = newName !== current.name;

    if (renamed) {
        const everyone = await loadStaffMembers();
        const clash = everyone.find((m) => m.name.toLowerCase() === newName.toLowerCase()
            && !(m.service === member.service && String(m.storageKey) === String(key)));
        if (clash) throw new Error(`Une fiche du personnel nommée "${newName}" existe déjà.`);
        await renameReportOwner(current.name, newName);
    }

    const updated = { ...current, name: newName, firstName: newFirst };
    if (middleName !== undefined) {
        const middle = String(middleName).trim();
        if (middle) updated.middleName = middle; else delete updated.middleName;
    }
    if (member.service === 'phmc') updated.lastName = newLast;
    if (rank) { updated.rank = rank; updated.category = rank; }
    if (digits) updated.badge = buildBadge(member.service, updated.rank || current.rank, digits); // chiffres inchangés
    if (discord !== undefined) updated.discord = discord;
    if (phNumber !== undefined) updated.phNumber = phNumber;
    // Famille (pole) déduite du rôle ; « service dirigé » uniquement pour un Chef de Service.
    const finalRank = updated.rank || current.rank;
    updated.pole = familyOfRank(finalRank, member.service);
    // Rôles supplémentaires (cumul) : absents du paramètre = inchangés ; liste vide = retirés.
    if (extraRanks !== undefined) {
        const cleaned = cleanExtraRanks(extraRanks, finalRank);
        if (cleaned.length > 0) updated.extraRanks = cleaned;
        else delete updated.extraRanks;
    }
    const allRanks = [finalRank, ...cleanExtraRanks(updated.extraRanks, finalRank)];
    if (allRanks.some((value) => getRoleInfo(value)?.needsServiceDirige)) {
        if (serviceDirige !== undefined) updated.serviceDirige = String(serviceDirige).trim();
    } else {
        delete updated.serviceDirige;
    }
    await set(ref(database, `${cfg.path}/${key}`), updated);

    if (rank && rank !== normalizeRank(current.rank)) {
        const label = rankLabel(member.service, rank);
        sendMailBestEffort({
            to: current.email,
            subject: 'Changement de grade - Pillbox Hill Medical Center',
            body: `Bonjour ${newName},\n\nVotre grade au sein du Pillbox Hill Medical Center a été mis à jour : ${label}.\n\nCordialement,\nPillbox Hill Medical Center`,
            html: `<p>Bonjour ${newName},</p><p>Votre grade au sein du <b>Pillbox Hill Medical Center</b> a été mis à jour : <b>${label}</b>.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
        });
    }
    return { updated, renamed, previousName: current.name };
}

// Ajoute une fiche SANS compte de connexion (même écriture que l'ancien « Ajouter un employé »).
export async function addStaffMember(service, { firstName, middleName, lastName, discord, phNumber, rank, badgeDigitsValue, serviceDirige, extraRanks }) {
    const cfg = STAFF_SERVICES[service];
    const name = `${firstName} ${lastName}`.trim();
    const listSnap = await get(ref(database, cfg.path));
    const existing = listSnap.exists() ? Object.values(listSnap.val() || {}) : [];
    if (existing.some((m) => (m?.name || '').toLowerCase() === name.toLowerCase())) {
        throw new Error(`Le membre du personnel "${name}" existe déjà.`);
    }
    const payload = service === 'coroner'
        ? { name, firstName, discord, rank, badge: buildBadge(service, rank, badgeDigitsValue), phNumber: phNumber || '', category: rank }
        : { name, lastName, discord: discord || '', phNumber: phNumber || '', badge: buildBadge(service, rank, badgeDigitsValue), rank, category: rank };
    if (service === 'phmc') payload.firstName = firstName;
    if (String(middleName || '').trim()) payload.middleName = String(middleName).trim();
    payload.pole = familyOfRank(rank, service);
    const extras = cleanExtraRanks(extraRanks, rank);
    if (extras.length > 0) payload.extraRanks = extras;
    if ([rank, ...extras].some((value) => getRoleInfo(value)?.needsServiceDirige) && serviceDirige) payload.serviceDirige = String(serviceDirige).trim();
    await set(push(ref(database, cfg.path)), payload);
    await clearDeletedMark(staffPatientIdOf(payload));
    return payload;
}

// Informations PERSONNELLES d'un compte (profil Civil, droits, rôles, créations). Les archives — rapports rédigés, dossier patient,
// factures, candidatures, contrats — ne sont JAMAIS supprimées : elles dépendent d'autres personnes (patients, recrutement).
const PERSONAL_DATA_PATHS = [
    'civilians', 'recruteurs', 'recruiterUIDs', 'candidatsContrat', 'contractCandidates',
    'statutsMobilite', 'userCreations',
];

// Demandes envoyées depuis le site : on garde le contenu (historique de l'équipe), on retire ce qui identifie la personne.
//   • bugs / idées / nouveaux formulaires (siteRequests) : nom, e-mail et Discord anonymisés ;
//   • vidéosurveillance (cctvRequests) : e-mail retiré, nom conservé (pièce de dossier) ;
//   • recrutement interne (demandesMobilite) : la demande est CONSERVÉE comme historique, seul le statut actif est retiré (ci-dessus).
async function archivePersonalRequests(uid) {
    try {
        const siteSnap = await get(query(ref(database, 'siteRequests'), orderByChild('by/uid'), equalTo(uid)));
        const updates = {};
        siteSnap.forEach((child) => {
            const request = child.val() || {};
            updates[`siteRequests/${child.key}/by/name`] = 'Compte supprimé';
            updates[`siteRequests/${child.key}/by/email`] = null;
            updates[`siteRequests/${child.key}/by/discord`] = null;
            if (Array.isArray(request.fields)) {
                updates[`siteRequests/${child.key}/fields`] = request.fields.map((field) => (/^Soumis par/i.test(field.l || '') ? { ...field, v: 'Compte supprimé' } : field));
            }
        });
        const cctvSnap = await get(query(ref(database, 'cctvRequests'), orderByChild('by/uid'), equalTo(uid)));
        cctvSnap.forEach((child) => { updates[`cctvRequests/${child.key}/by/email`] = null; });
        // Recrutement interne : la demande accordée passe à « terminée » (le statut actif est retiré avec les droits).
        const mobilitySnap = await get(ref(database, `demandesMobilite/${uid}`));
        if (mobilitySnap.exists() && mobilitySnap.val().statut === 'acceptee') {
            updates[`demandesMobilite/${uid}/statut`] = 'terminee';
            updates[`demandesMobilite/${uid}/traiteLe`] = Date.now();
        }
        if (Object.keys(updates).length > 0) await update(ref(database), updates);
    } catch (error) {
        console.warn('Anonymisation des demandes impossible :', error?.message || error);
    }
}
async function removePersonalData(uid) {
    if (!uid) return;
    for (const path of PERSONAL_DATA_PATHS) {
        try { await set(ref(database, `${path}/${uid}`), null); } catch (error) { /* absent ou non modifiable */ }
    }
    await archivePersonalRequests(uid);
}

async function deleteLoginAccount(uid, email) {
    if (!uid && !email) return;
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
            const functionUrl = `https://europe-west1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/deleteUserAccount`;
            await fetch(functionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ uid, email }),
            });
        }
    } catch (authError) {
        console.warn('Could not delete Auth account:', authError);
    }
}

// SUPPRESSION d'un membre du personnel : la fiche, le profil Civil éventuel, le compte de connexion, ses droits et ses créations
// (carte de visite, signature) sont supprimés. Ses RAPPORTS, son dossier patient, ses candidatures et ses contrats sont CONSERVÉS
// (archives). Un marqueur « comptesSupprimes » signale au personnel soignant qu'il n'est plus employé ; s'il recrée un compte, il
// retrouve ses archives. Pour garder la personne dans l'application, utiliser plutôt convertStaffToCivilian.
export async function removeStaffMember(member) {
    let civilPatientId = '';
    if (member.uid) {
        try {
            const civilSnap = await get(ref(database, `civilians/${member.uid}`));
            if (civilSnap.exists()) civilPatientId = civilSnap.val().patientID || '';
        } catch (error) { /* profil Civil illisible : on retombe sur l'ID dérivé de la fiche */ }
    }
    await markAccountDeleted(staffPatientIdOf(member, civilPatientId), {
        type: 'personnel', nom: member.displayName || member.name, role: rankLabel(member.service, member.rank),
    });
    await removeStaffEntry(member);
    await removePersonalData(member.uid);
    await deleteLoginAccount(member.uid, member.email);
    sendMailBestEffort({
        to: member.email,
        subject: 'Fin de vos fonctions - Pillbox Hill Medical Center',
        body: `Bonjour ${member.displayName},\n\nVotre compte et vos fonctions au sein du Pillbox Hill Medical Center ont été résiliés. Vos informations personnelles sont supprimées ; vos rapports et dossiers restent archivés et vous les retrouverez si vous recréez un compte.\n\nCordialement,\nPillbox Hill Medical Center`,
        html: `<p>Bonjour ${member.displayName},</p><p>Votre compte et vos fonctions au sein du <b>Pillbox Hill Medical Center</b> ont été résiliés. Vos informations personnelles sont supprimées ; vos rapports et dossiers restent archivés et vous les retrouverez si vous recréez un compte.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
    });
}

// Retire UNIQUEMENT la fiche (tableau ou objet), sans toucher au compte ni aux rapports.
async function removeStaffEntry(member) {
    const cfg = STAFF_SERVICES[member.service];
    const snap = await get(ref(database, cfg.path));
    if (!snap.exists()) return;
    const data = snap.val();
    if (Array.isArray(data)) {
        await set(ref(database, cfg.path), data.filter((m) => m && m.name !== member.name));
    } else {
        const updates = {};
        Object.entries(data).forEach(([key, entry]) => {
            if (entry && entry.name === member.name) updates[`${cfg.path}/${key}`] = null;
        });
        if (Object.keys(updates).length > 0) await update(ref(database), updates);
    }
}

// ───────────────────────────── Conversions ─────────────────────────────

export async function isUidStaff(uid) {
    if (!uid) return false;
    const members = await loadStaffMembers();
    return members.some((m) => m.uid === uid);
}

// Civil → Personnel. Le profil Civil et ses rapports sont CONSERVÉS.
export async function convertCivilianToStaff(civilian, { service, rank, badgeDigitsValue, discord, phNumber, serviceDirige, extraRanks }) {
    const extras = cleanExtraRanks(extraRanks, rank);
    if (!civilian?.uid) throw new Error('Ce compte Civil n\'a pas d\'identifiant de connexion (uid).');
    if (await isUidStaff(civilian.uid)) throw new Error('Cette personne est déjà membre du personnel.');
    const cfg = STAFF_SERVICES[service];
    const firstName = (civilian.firstName || '').trim();
    const lastName = (civilian.lastName || '').trim();
    const name = `${firstName} ${lastName}`.trim();
    if (!name) throw new Error('Le profil Civil n\'a ni prénom ni nom.');
    const listSnap = await get(ref(database, cfg.path));
    const existing = listSnap.exists() ? Object.values(listSnap.val() || {}) : [];
    if (existing.some((m) => (m?.name || '').toLowerCase() === name.toLowerCase())) {
        throw new Error(`Une fiche du personnel nommée "${name}" existe déjà dans ${cfg.label}.`);
    }
    const entry = {
        name,
        firstName,
        ...((civilian.middleName || '').trim() ? { middleName: civilian.middleName.trim() } : {}),
        ...(service === 'phmc' ? { lastName } : {}),
        discord: discord ?? civilian.discord ?? '',
        rank,
        badge: buildBadge(service, rank, badgeDigitsValue),
        phNumber: phNumber ?? civilian.phone ?? '',
        category: rank,
        pole: familyOfRank(rank, service),
        ...(extras.length > 0 ? { extraRanks: extras } : {}),
        ...([rank, ...extras].some((value) => getRoleInfo(value)?.needsServiceDirige) && serviceDirige ? { serviceDirige: String(serviceDirige).trim() } : {}),
        uid: civilian.uid,
        email: civilian.email || '',
        createdAt: new Date().toISOString(),
        convertedFromCivilianAt: new Date().toISOString(),
        ...(civilian.gtawCharacterId != null && { gtawCharacterId: civilian.gtawCharacterId }),
        ...(civilian.gtawUserId != null && { gtawUserId: civilian.gtawUserId }),
    };
    await set(push(ref(database, cfg.path)), entry);
    await clearDeletedMark(staffPatientIdOf(entry, civilian.patientID));
    sendMailBestEffort({
        to: civilian.email,
        subject: 'Votre compte est désormais un compte du personnel - Pillbox Hill Medical Center',
        body: `Bonjour ${name},\n\nVotre compte a été converti en compte du personnel (${rankLabel(service, rank)}, badge ${entry.badge}). Reconnectez-vous pour accéder à vos nouveaux outils. Vos dossiers de patient sont conservés.\n\nCordialement,\nPillbox Hill Medical Center`,
        html: `<p>Bonjour ${name},</p><p>Votre compte a été converti en <b>compte du personnel</b> (${rankLabel(service, rank)}, badge <b>${entry.badge}</b>). Reconnectez-vous pour accéder à vos nouveaux outils. Vos dossiers de patient sont conservés.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
    });
    return entry;
}

// Personnel → Civil. Retire la fiche staff ; garde le compte de connexion et TOUS les rapports.
// Si la personne n'a pas encore de profil Civil, il est créé à partir de `civilData`
// (au minimum l'ID patient).
export async function convertStaffToCivilian(member, civilData = {}) {
    if (!member?.uid) throw new Error('Cette fiche n\'a pas de compte de connexion (uid) : impossible de la convertir en Civil.');
    const civilRef = ref(database, `civilians/${member.uid}`);
    const civilSnap = await get(civilRef);
    let createdProfile = null;
    if (!civilSnap.exists()) {
        const patientID = canonicalPatientId(
            civilData.patientID || (member.gtawCharacterId != null ? `PHMC-${member.gtawCharacterId}` : '')
        );
        if (!patientID) throw new Error('Un ID patient est nécessaire pour créer le profil Civil.');
        const parts = (member.displayName || member.name || '').split(' ');
        createdProfile = {
            uid: member.uid,
            email: member.email || '',
            firstName: member.firstName || parts[0] || '',
            lastName: member.lastName || parts.slice(1).join(' ') || '',
            middleName: member.middleName || '',
            dateOfBirth: civilData.dateOfBirth || '',
            gender: civilData.gender || '',
            address: civilData.address || '',
            zip: civilData.zip || '',
            phone: member.phNumber || '',
            discord: member.discord || '',
            patientID,
            gtawCharacterId: member.gtawCharacterId ?? null,
            gtawUserId: member.gtawUserId ?? null,
            createdAt: new Date().toISOString(),
            convertedFromStaffAt: new Date().toISOString(),
        };
        await set(civilRef, createdProfile);
    }
    await removeStaffEntry(member);
    sendMailBestEffort({
        to: member.email,
        subject: 'Fin de vos fonctions - Pillbox Hill Medical Center',
        body: `Bonjour ${member.displayName},\n\nVos fonctions au sein du Pillbox Hill Medical Center ont pris fin. Votre compte est conservé en tant que compte Civil : vous gardez accès à vos dossiers de patient et à vos candidatures.\n\nCordialement,\nPillbox Hill Medical Center`,
        html: `<p>Bonjour ${member.displayName},</p><p>Vos fonctions au sein du <b>Pillbox Hill Medical Center</b> ont pris fin. Votre compte est conservé en tant que <b>compte Civil</b> : vous gardez accès à vos dossiers de patient et à vos candidatures.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
    });
    return { createdProfile };
}

// ───────────────────────────── Civils / Recruteurs ─────────────────────────────

export async function setRecruiterRole(uid, enabled) {
    await set(ref(database, `recruteurs/${uid}`), enabled ? true : null);
    // Retire aussi l'éventuel ancien drapeau, sinon un recruteur « retiré » resterait reconnu via l'ancien nœud.
    try { await set(ref(database, `recruiterUIDs/${uid}`), null); } catch (error) { /* ancien nœud absent ou non modifiable */ }
}

// uid des administrateurs (adminUIDs, lisible par tout compte connecté) : sert à afficher le badge Admin.
export async function loadAdminUids() {
    const snap = await get(ref(database, 'adminUIDs'));
    return snap.exists() ? snap.val() : {};
}

// Nom sous lequel un Civil range ses rapports : « Prénom Nom [ID patient] » (voir
// handleSaveReportWrapper dans MainApp.js ; repli sur l'e-mail sans prénom/nom).
export const civilianAuthorName = (profile) => {
    const base = profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : (profile?.email || '');
    return `${base} [${profile?.patientID}]`;
};

// Modification du profil Civil, enregistrée sur son uid. Le champ `uid` DOIT rester dans le profil
// (il sert de preuve d'existence du compte à la connexion GTA World). Si le prénom/nom change,
// ses rapports suivent (le nom fait partie de la clé sous laquelle ils sont rangés).
export async function saveCivilianProfile(profile, previousProfile = null) {
    if (!profile?.uid) throw new Error('Profil Civil sans uid : enregistrement refusé.');
    const { storageKey, ...clean } = profile; // eslint-disable-line no-unused-vars
    let renamedReports = 0;
    if (previousProfile) {
        const oldAuthor = civilianAuthorName(previousProfile);
        const newAuthor = civilianAuthorName(clean);
        if (sanitizeNode(oldAuthor) !== sanitizeNode(newAuthor)) {
            renamedReports = (await renameReportOwner(oldAuthor, newAuthor)).moved;
        }
    }
    await set(ref(database, `civilians/${profile.uid}`), clean);
    return { renamedReports };
}

export async function deleteCivilianAccount(civilian) {
    const displayName = `${civilian.firstName || ''} ${civilian.lastName || ''}`.trim() || civilian.email;
    // Archives conservées (dossier patient, rapports, factures, candidatures, contrats) ; marqueur « compte supprimé ».
    await markAccountDeleted(civilian.patientID, { type: 'civil', nom: displayName });
    await removePersonalData(civilian.uid);
    await deleteLoginAccount(civilian.uid, civilian.email);
    sendMailBestEffort({
        to: civilian.email,
        subject: 'Votre compte Civil a été supprimé - Pillbox Hill Medical Center',
        body: `Bonjour ${displayName},\n\nVotre compte Civil sur l'outil PHMC-FR a été supprimé par un administrateur. Vos informations personnelles sont supprimées ; vos dossiers restent archivés et vous les retrouverez si vous recréez un compte.\n\nCordialement,\nPillbox Hill Medical Center`,
        html: `<p>Bonjour ${displayName},</p><p>Votre compte Civil sur l'outil PHMC-FR a été supprimé par un administrateur. Vos informations personnelles sont supprimées ; vos dossiers restent archivés et vous les retrouverez si vous recréez un compte.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
    });
}

// ───────────────────────────── Auto-édition du profil ─────────────────────────────

// Modifie le téléphone et/ou le Discord de SA PROPRE fiche (database.rules.json n'autorise que ces
// champs et le nom, et uniquement quand l'uid de la fiche est celui de la personne connectée). Le grade,
// le badge et l'e-mail restent réservés aux admins (l'e-mail passe par un code de vérification : voir
// requestStaffEmailChange dans eyefindMail.js).
export async function updateOwnStaffContact(uid, { phNumber, discord }) {
    if (!uid) throw new Error('Compte introuvable.');
    for (const service of Object.values(STAFF_SERVICES)) {
        const snap = await get(ref(database, service.path));
        if (!snap.exists()) continue;
        const entries = Object.entries(snap.val() || {});
        const found = entries.find(([, entry]) => entry && entry.uid === uid);
        if (!found) continue;
        const patch = {};
        if (phNumber !== undefined) patch[`${service.path}/${found[0]}/phNumber`] = String(phNumber).trim();
        if (discord !== undefined) patch[`${service.path}/${found[0]}/discord`] = String(discord).trim();
        await update(ref(database), patch);
        return { service: service.key, key: found[0] };
    }
    throw new Error('Votre fiche du personnel est introuvable.');
}

// Change le prénom / nom de SA PROPRE fiche. Tout est rattaché à l'ID (compte de connexion, badge = ID employé
// et ID patient) : le badge ne bouge pas, et les rapports enregistrés suivent le nouveau nom (renameReportOwner,
// comme pour une modification par un admin). Refuse un nom déjà porté par une autre fiche.
export async function updateOwnStaffName(uid, { firstName, lastName }) {
    if (!uid) throw new Error('Compte introuvable.');
    const newFirst = String(firstName ?? '').trim();
    const newLast = String(lastName ?? '').trim();
    if (!newFirst) throw new Error('Le prénom est obligatoire.');
    if (newFirst.length > 40 || newLast.length > 40) throw new Error('Le prénom et le nom sont limités à 40 caractères.');
    const newName = `${newFirst} ${newLast}`.trim();

    for (const service of Object.values(STAFF_SERVICES)) {
        const snap = await get(ref(database, service.path));
        if (!snap.exists()) continue;
        const found = Object.entries(snap.val() || {}).find(([, entry]) => entry && entry.uid === uid);
        if (!found) continue;
        const [key, current] = found;
        const previousName = current.name;

        if (newName !== previousName) {
            const everyone = await loadStaffMembers();
            const clash = everyone.find((m) => m.name.toLowerCase() === newName.toLowerCase()
                && !(m.service === service.key && String(m.storageKey) === String(key)));
            if (clash) throw new Error(`Une fiche du personnel nommée "${newName}" existe déjà.`);
            await renameReportOwner(previousName, newName);
        }

        const patch = {
            [`${service.path}/${key}/name`]: newName,
            [`${service.path}/${key}/firstName`]: newFirst,
        };
        if (service.key === 'phmc') patch[`${service.path}/${key}/lastName`] = newLast;
        await update(ref(database), patch);
        return { service: service.key, key, name: newName, firstName: newFirst, lastName: newLast, previousName, renamed: newName !== previousName };
    }
    throw new Error('Votre fiche du personnel est introuvable.');
}
