// src/utils/knownPatient.js
//
// Un soignant tape l'ID d'un patient qui a déjà un compte (Civil) ou une fiche du personnel : on reprend ce que le site sait déjà de lui
// pour pré-remplir le formulaire (identité et coordonnées, jamais de donnée de santé). Lecture réservée au personnel soignant et aux admins
// (règles : civilians est lisible par le personnel). Résultat mis en cache une minute : l'ID est tapé caractère par caractère.
import { loadCivilians, loadStaffMembers } from './staffAdmin';
import { staffPatientIdOf } from './deletedAccounts';
import { canonicalPatientId } from './patientId';
import { buildCivilianAutofillValues } from './civilianAutofill';
import { getEmployeeDisplayName, getEmployeeFullName } from './employeeName';

const TTL = 60 * 1000;
let cache = null;

const loadDirectory = async () => {
    if (cache && Date.now() - cache.at < TTL) return cache;
    const [civilians, staff] = await Promise.all([loadCivilians().catch(() => []), loadStaffMembers().catch(() => [])]);
    cache = { at: Date.now(), civilians, staff };
    return cache;
};

// Identité d'une fiche du personnel, dans la même forme que celle d'un profil Civil (voir civilianAutofill.js).
export const staffIdentity = (member, patientID = '', fallbackEmail = '') => {
    const display = getEmployeeDisplayName(member, '');
    return {
        patientID,
        firstName: member.firstName || display.split(' ')[0] || '',
        middleName: member.middleName || '',
        lastName: member.lastName || display.split(' ').slice(1).join(' '),
        fullName: getEmployeeFullName(member, display),
        address: member.address || '',
        zip: member.zip || '',
        dateOfBirth: member.dateOfBirth || '',
        gender: member.gender || '',
        phone: member.phNumber || '',
        email: member.email || fallbackEmail || '',
        discord: member.discord || '',
    };
};

// { source: 'civil' | 'staff', uid, identity } ou null. Un ID trop court ou inconnu ne renvoie rien.
export const findKnownPatient = async (patientID) => {
    const wanted = canonicalPatientId(patientID);
    if (!/^PHMC-\d{3,}$/.test(wanted)) return null;
    const { civilians, staff } = await loadDirectory();
    const civilian = civilians.find((entry) => canonicalPatientId(entry.patientID) === wanted);
    if (civilian) return { source: 'civil', uid: civilian.uid, identity: buildCivilianAutofillValues(civilian) };
    const member = staff.find((entry) => staffPatientIdOf(entry) === wanted);
    if (member) return { source: 'staff', uid: member.uid, identity: staffIdentity(member, wanted) };
    return null;
};
