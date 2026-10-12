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
import { ref, get, set, update, push, remove } from 'firebase/database';
import { database, auth } from '../firebase';
import { PHMC_RANKS, CORONER_RANKS } from '../constants/ranks';
import { getEmployeeDisplayName } from './employeeName';
import { sendEyefindMail } from './eyefindMail';
import { canonicalPatientId } from './patientId';

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

export const rankLabel = (service, rankValue) =>
    (STAFF_SERVICES[service]?.ranks || []).find((r) => r.value === rankValue)?.label || rankValue || '—';

// Badge complet « PRÉFIXE-chiffres » (le préfixe dépend du grade).
export const buildBadge = (service, rankValue, digits) => {
    const cfg = STAFF_SERVICES[service];
    const prefix = cfg.ranks.find((r) => r.value === rankValue)?.badgePrefix || cfg.defaultPrefix;
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
            members.push({ ...entry, service: service.key, storageKey: key, displayName: getEmployeeDisplayName(entry) });
        });
    }
    return members.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function loadCivilians() {
    const snap = await get(ref(database, 'civilians'));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([uid, civilian]) => ({ uid, ...civilian }))
        .sort((a, b) => `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`));
}

export async function loadRecruiterUids() {
    const snap = await get(ref(database, 'recruiterUIDs'));
    return snap.exists() ? snap.val() : {};
}

// ───────────────────────────── Personnel ─────────────────────────────

// Modifie grade / badge / Discord / téléphone. Le NOM n'est pas modifiable ici : c'est la clé
// d'identité des rapports (savedReports/{nom}) ; un renommage passe par l'outil de migration.
export async function updateStaffMember(member, { rank, badgeDigitsValue, discord, phNumber }) {
    const cfg = STAFF_SERVICES[member.service];
    const { service, storageKey, displayName, ...stored } = member; // eslint-disable-line no-unused-vars
    const updated = { ...stored };
    if (rank) { updated.rank = rank; updated.category = rank; }
    if (badgeDigitsValue !== undefined && String(badgeDigitsValue).replace(/\D/g, '')) {
        updated.badge = buildBadge(member.service, updated.rank || member.rank, badgeDigitsValue);
    } else if (rank && badgeDigits(member.badge)) {
        updated.badge = buildBadge(member.service, rank, badgeDigits(member.badge)); // le préfixe suit le grade
    }
    if (discord !== undefined) updated.discord = discord;
    if (phNumber !== undefined) updated.phNumber = phNumber;
    await set(ref(database, `${cfg.path}/${storageKey}`), updated);

    if (rank && rank !== member.rank) {
        const label = rankLabel(member.service, rank);
        sendMailBestEffort({
            to: member.email,
            subject: 'Changement de grade - Pillbox Hill Medical Center',
            body: `Bonjour ${member.displayName},\n\nVotre grade au sein du Pillbox Hill Medical Center a été mis à jour : ${label}.\n\nCordialement,\nPillbox Hill Medical Center`,
            html: `<p>Bonjour ${member.displayName},</p><p>Votre grade au sein du <b>Pillbox Hill Medical Center</b> a été mis à jour : <b>${label}</b>.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
        });
    }
    return updated;
}

// Ajoute une fiche SANS compte de connexion (même écriture que l'ancien « Ajouter un employé »).
export async function addStaffMember(service, { firstName, lastName, discord, phNumber, rank, badgeDigitsValue }) {
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
    await set(push(ref(database, cfg.path)), payload);
    return payload;
}

// SUPPRESSION définitive d'un membre (reprend executeRemoveStaff) : ses rapports sont transférés
// vers `transferTo` (ou supprimés), la fiche est retirée, le compte de connexion supprimé, un
// mail de fin de fonctions envoyé. Pour garder la personne dans l'application, utiliser plutôt
// convertStaffToCivilian.
export async function removeStaffMember(member, { transferTo = null } = {}) {
    // 1) Rapports
    const reportsSnap = await get(ref(database, 'savedReports'));
    if (reportsSnap.exists()) {
        const all = reportsSnap.val();
        const node = sanitizeNode(member.name);
        if (all[node]) {
            const updates = {};
            if (transferTo) {
                const targetNode = sanitizeNode(transferTo);
                const destination = all[targetNode] || {};
                Object.keys(all[node]).forEach((id) => { if (!destination[id]) destination[id] = all[node][id]; });
                updates[`savedReports/${targetNode}`] = destination;
            }
            updates[`savedReports/${node}`] = null;
            await update(ref(database), updates);
        }
    }
    // 2) Fiche staff
    await removeStaffEntry(member);
    // 3) Compte de connexion
    if (member.uid || member.email) {
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (idToken) {
                const functionUrl = `https://europe-west1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/deleteUserAccount`;
                await fetch(functionUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                    body: JSON.stringify({ uid: member.uid, email: member.email }),
                });
            }
        } catch (authError) {
            console.warn(`Could not delete Auth account for ${member.name}:`, authError);
        }
    }
    sendMailBestEffort({
        to: member.email,
        subject: 'Fin de vos fonctions - Pillbox Hill Medical Center',
        body: `Bonjour ${member.displayName},\n\nVotre compte et vos fonctions au sein du Pillbox Hill Medical Center ont été résiliés.\n\nCordialement,\nPillbox Hill Medical Center`,
        html: `<p>Bonjour ${member.displayName},</p><p>Votre compte et vos fonctions au sein du <b>Pillbox Hill Medical Center</b> ont été résiliés.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
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
export async function convertCivilianToStaff(civilian, { service, rank, badgeDigitsValue, discord, phNumber }) {
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
        ...(service === 'phmc' ? { lastName } : {}),
        discord: discord ?? civilian.discord ?? '',
        rank,
        badge: buildBadge(service, rank, badgeDigitsValue),
        phNumber: phNumber ?? civilian.phone ?? '',
        category: rank,
        uid: civilian.uid,
        email: civilian.email || '',
        createdAt: new Date().toISOString(),
        convertedFromCivilianAt: new Date().toISOString(),
        ...(civilian.gtawCharacterId != null && { gtawCharacterId: civilian.gtawCharacterId }),
        ...(civilian.gtawUserId != null && { gtawUserId: civilian.gtawUserId }),
    };
    await set(push(ref(database, cfg.path)), entry);
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
            middleName: '',
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
    await set(ref(database, `recruiterUIDs/${uid}`), enabled ? true : null);
}

// Modification du profil Civil. Le champ `uid` DOIT rester dans le profil (voir
// l'avertissement de l'ancien ManageCivilians : il sert de preuve d'existence du compte à la
// connexion GTA World).
export async function saveCivilianProfile(profile) {
    if (!profile?.uid) throw new Error('Profil Civil sans uid : enregistrement refusé.');
    const { storageKey, ...clean } = profile; // eslint-disable-line no-unused-vars
    await set(ref(database, `civilians/${profile.uid}`), clean);
}

export async function deleteCivilianAccount(civilian) {
    const displayName = `${civilian.firstName || ''} ${civilian.lastName || ''}`.trim() || civilian.email;
    await remove(ref(database, `civilians/${civilian.uid}`));
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
            const functionUrl = `https://europe-west1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/deleteUserAccount`;
            await fetch(functionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ uid: civilian.uid, email: civilian.email }),
            });
        }
    } catch (authError) {
        console.warn(`Could not delete Auth account for civilian ${civilian.uid}:`, authError);
    }
    // Un recruteur supprimé ne doit pas laisser un drapeau orphelin.
    try { await set(ref(database, `recruiterUIDs/${civilian.uid}`), null); } catch (e) { /* ignoré */ }
    sendMailBestEffort({
        to: civilian.email,
        subject: 'Votre compte Civil a été supprimé - Pillbox Hill Medical Center',
        body: `Bonjour ${displayName},\n\nVotre compte Civil sur l'outil PHMC-FR a été supprimé par un administrateur.\n\nCordialement,\nPillbox Hill Medical Center`,
        html: `<p>Bonjour ${displayName},</p><p>Votre compte Civil sur l'outil PHMC-FR a été supprimé par un administrateur.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
    });
}
