import { dossierDeletionRefusal } from './patientRecords';
import { canModifyForm } from './dossierCore';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), remove: jest.fn() }));

let mockForm;
jest.mock('./dossierPatient', () => ({
    loadDossierContext: () => Promise.resolve({ forms: [mockForm] }),
    canModifyForm: (...args) => jest.requireActual('./dossierCore').canModifyForm(...args),
}));

const entry = { bbCodeVersion: 25 };
const report = { reportPath: 'savedReports/Alaric_Veyn/k1', patientID: 'PHMC-28761' };
const staffSelf = { role: 'staff', isAdmin: false, staffName: 'Alaric Veyn', myPatientID: 'PHMC-28761' };

describe('suppression d’un formulaire du dossier', () => {
    test('un membre du personnel supprime SON formulaire dans le délai (créé par le patient)', async () => {
        mockForm = { key: 'k1', createur: 'patient', phase: 'fenetre', authorName: 'Alaric Veyn' };
        expect(await dossierDeletionRefusal(report, entry, 'k1', staffSelf, 'PHMC-28761')).toBeNull();
    });
    test('refusé une fois appliqué', async () => {
        mockForm = { key: 'k1', createur: 'patient', phase: 'verrouille', authorName: 'Alaric Veyn' };
        const refusal = await dossierDeletionRefusal(report, entry, 'k1', staffSelf, 'PHMC-28761');
        expect(refusal.ok).toBe(false);
        expect(refusal.message).toContain('appliqué');
    });
    test('formulaire rempli par un autre membre du personnel : refusé avec le message du personnel', async () => {
        mockForm = { key: 'k1', createur: 'personnel', phase: 'brouillon', authorName: 'Dr Autre' };
        const refusal = await dossierDeletionRefusal(report, entry, 'k1', staffSelf, 'PHMC-28761');
        expect(refusal.message).toContain('seul son créateur');
    });
    test('un administrateur n’est jamais refusé', async () => {
        mockForm = { key: 'k1', createur: 'patient', phase: 'verrouille', authorName: 'x' };
        expect(await dossierDeletionRefusal(report, entry, 'k1', { ...staffSelf, isAdmin: true }, 'PHMC-28761')).toBeNull();
        expect(canModifyForm).toBeDefined();
    });
});
