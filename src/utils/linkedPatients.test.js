jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), remove: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import { linkedPatientIds, hasSeveralPatients, patientIdsLabel } from './linkedPatients';
import { buildTransferUpdates } from './temporaryIds';
import generateEmail from '../phmc-bbcode-generators/generateEmail';
import { getDebugTemplate } from './debugTemplates';

describe('rapports liés à plusieurs personnes', () => {
    test('rapport de masse : un ID par défunt, canoniques, sans doublon ni vide', () => {
        const data = { decedents: [{ patientID: '12' }, { patientID: ' phmc-7 ' }, { patientID: 'PHMC-12' }, { patientID: '' }, null, { patientID: 'tmp-ab3cd' }] };
        expect(linkedPatientIds(11, data)).toEqual(['PHMC-12', 'PHMC-7', 'TMP-AB3CD']);
    });

    test('courriel DMEC : l’ID du défunt d’abord, puis les ID ajoutés', () => {
        expect(linkedPatientIds(2, { patientID: '2752', additionalPatientIDs: ['TMP-AB3CD', '2752', ''] })).toEqual(['PHMC-2752', 'TMP-AB3CD']);
        expect(linkedPatientIds(2, { patientID: '2752', additionalPatientIDs: 'pas une liste' })).toEqual(['PHMC-2752']);
    });

    test('les autres formulaires n’ont qu’un seul ID', () => {
        expect(linkedPatientIds(1, { patientID: '2752', additionalPatientIDs: ['9'] })).toEqual(['PHMC-2752']);
        expect(linkedPatientIds(1, {})).toEqual([]);
        expect(hasSeveralPatients(11)).toBe(true);
        expect(hasSeveralPatients(2)).toBe(true);
        expect(hasSeveralPatients(1)).toBe(false);
        expect(patientIdsLabel(['PHMC-1', 'TMP-AB3CD'])).toBe('PHMC-1, TMP-AB3CD');
    });

    test('les gabarits de remplissage debug donnent un ID à chaque personne', () => {
        const ctx = {};
        const mass = getDebugTemplate(11, ctx);
        expect(linkedPatientIds(11, mass)).toHaveLength(mass.decedents.length);
        const email = getDebugTemplate(2, ctx);
        expect(linkedPatientIds(2, email).length).toBeGreaterThan(1);
    });

    test('le courriel DMEC liste tous les ID patient', () => {
        const text = generateEmail({ requestingOfficer: 'Officier X', department: 'LSSD', decedentName: 'John Doe', patientID: '2752', additionalPatientIDs: ['TMP-AB3CD'], agencyDataStore: {} });
        expect(text).toContain('ID Patient : PHMC-2752, TMP-AB3CD');
    });
});

describe('ID temporaire attribué : rapports liés à plusieurs personnes', () => {
    test('le rapport de masse garde ses autres ID et seul le défunt concerné change', () => {
        const title = '[PHMC-12, TMP-AB3CD] Tuerie - 02/11/2026';
        const { updates } = buildTransferUpdates({
            tempId: 'TMP-AB3CD', realId: 'PHMC-99',
            items: [{
                indexKey: 'k1', entry: { reportPath: 'savedReports/D/k1', title, originalKey: title, bbCodeVersion: 11 }, reportPath: 'savedReports/D/k1',
                report: { title, originalKey: title, bbCode: '', data: { patientID: 'PHMC-12', patientIDs: ['PHMC-12', 'TMP-AB3CD'], decedents: [{ patientID: 'PHMC-12' }, { patientID: 'TMP-AB3CD' }] } },
            }],
        });
        expect(updates['savedReports/D/k1/data/patientID']).toBeUndefined();
        expect(updates['savedReports/D/k1/data/patientIDs']).toEqual(['PHMC-12', 'PHMC-99']);
        expect(updates['savedReports/D/k1/data/decedents/1/patientID']).toBe('PHMC-99');
        expect(updates['savedReports/D/k1/data/decedents/0/patientID']).toBeUndefined();
        expect(updates['savedReports/D/k1/title']).toBe('[PHMC-12, PHMC-99] Tuerie - 02/11/2026');
        // L'entrée d'index de l'autre défunt suit le nouveau titre ; celle de l'ID temporaire déménage.
        expect(updates['patientRecords/PHMC-12/k1/title']).toBe('[PHMC-12, PHMC-99] Tuerie - 02/11/2026');
        expect(updates['patientRecords/TMP-AB3CD/k1']).toBeNull();
        expect(updates['patientRecords/PHMC-99/k1']).toMatchObject({ title: '[PHMC-12, PHMC-99] Tuerie - 02/11/2026' });
    });

    test('courriel DMEC : l’ID temporaire ajouté est remplacé dans la liste', () => {
        const { updates } = buildTransferUpdates({
            tempId: 'TMP-AB3CD', realId: 'PHMC-99',
            items: [{ indexKey: 'k2', entry: { reportPath: 'savedReports/D/k2', title: 'x' }, reportPath: 'savedReports/D/k2', report: { title: 'x', data: { patientID: 'PHMC-1', additionalPatientIDs: ['TMP-AB3CD'], patientIDs: ['PHMC-1', 'TMP-AB3CD'] } } }],
        });
        expect(updates['savedReports/D/k2/data/additionalPatientIDs']).toEqual(['PHMC-99']);
        expect(updates['savedReports/D/k2/data/patientIDs']).toEqual(['PHMC-1', 'PHMC-99']);
        expect(updates['savedReports/D/k2/data/patientID']).toBeUndefined();
    });
});
