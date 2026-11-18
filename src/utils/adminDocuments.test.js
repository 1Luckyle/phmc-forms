import { highestAdministrativeRole } from '../constants/ranks';
import { AGREEMENT_TYPES, emptyAgreementFields, buildAgreementBb } from './commercialAgreements';
import { fieldsFor, emptyContractFields, buildContractBb } from './contractDocs';
import { issuerTitleOf } from '../components/Contracts/ContractsManager';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), remove: jest.fn(), query: jest.fn(), orderByChild: jest.fn(), equalTo: jest.fn(), onValue: jest.fn() }));
jest.mock('../utils/staffAdmin', () => ({ STAFF_SERVICES: { phmc: { label: 'PHMC', ranks: [] }, coroner: { label: 'DMEC', ranks: [] } }, rankLabel: (service, rank) => rank, loadStaffMembers: jest.fn(), loadCivilians: jest.fn(), loadRecruiterUids: jest.fn() }));

describe('signature de celui qui fait le document : son rôle administratif le plus élevé', () => {
    test('rôle supplémentaire : une Directrice dont le rôle principal est soignant signe « Directeur(trice) »', () => {
        expect(highestAdministrativeRole({ rank: 'Médecin Titulaire', extraRanks: ['Directeur(trice)'] })).toBe('Directeur(trice)');
        expect(highestAdministrativeRole({ rank: 'Médecin Titulaire', extraRanks: { 0: 'Directeur(trice)' } })).toBe('Directeur(trice)');
    });
    test('plusieurs rôles administratifs : le plus élevé l\'emporte, principal ou supplémentaire', () => {
        expect(highestAdministrativeRole({ rank: 'Médecin Titulaire', extraRanks: ['Personnel Administratif', 'Assistant(e) de Direction'] })).toBe('Assistant(e) de Direction');
        expect(highestAdministrativeRole({ rank: 'Personnel Administratif', extraRanks: ['Directeur(trice)'] })).toBe('Directeur(trice)');
        expect(highestAdministrativeRole({ rank: 'Directeur(trice)', extraRanks: ['Personnel Administratif'] })).toBe('Directeur(trice)');
        expect(highestAdministrativeRole({ category: 'Assistant(e) de Direction' })).toBe('Assistant(e) de Direction');
    });
    test('aucun rôle administratif : rien (le rôle principal sert alors de titre)', () => {
        expect(highestAdministrativeRole({ rank: 'Médecin Titulaire', extraRanks: ['Chef de Service'] })).toBe('');
        expect(highestAdministrativeRole({ rank: 'Médecin Titulaire' })).toBe('');
        expect(highestAdministrativeRole(null)).toBe('');
    });
    test('titre du signataire des contrats : administratif d\'abord, puis rôle principal, puis repli', () => {
        expect(issuerTitleOf({ rank: 'Médecin Titulaire', extraRanks: ['Directeur(trice)'] }, true)).toBe('Directeur(trice)');
        expect(issuerTitleOf({ rank: 'Médecin Titulaire' }, true)).toBe('Médecin Titulaire');
        expect(issuerTitleOf(null, true)).toBe('Administration');
        expect(issuerTitleOf(null, false)).toBe('Chargé(e) de recrutement');
    });
});

describe('documents administratifs : textes retirés du pied de page', () => {
    test('accord : ni « Textes consolidés du forum », ni « Document de jeu de rôle (IC), sans valeur juridique réelle »', () => {
        const type = Object.keys(AGREEMENT_TYPES)[0];
        const champs = { ...emptyAgreementFields(type), titre: 'Accord de test', partieNom: 'MediSupply', partieForme: 'particulier', objet: 'Objet' };
        const bb = buildAgreementBb({ type, champs, issuer: { name: 'Dr. Rose Callahan', title: 'Directeur(trice)' }, id: 'abcde12345', timestamp: Date.UTC(2026, 10, 18) }).bbCode;
        expect(bb).toContain('Document généré par l\'outil PHMC');
        expect(bb).toContain('Accord confidentiel destiné aux seules Parties');
        expect(bb).not.toMatch(/Textes consolidés/);
        expect(bb).not.toMatch(/jeu de rôle \(IC\)/);
        expect(bb).not.toMatch(/sans valeur juridique/);
        expect(bb).toContain('Directeur(trice)');
    });
    test('contrat : même chose, et la signature porte le titre administratif', () => {
        const bb = buildContractBb({
            type: 'cdi', service: 'phmc', employeeName: 'Jane Doe', issuer: { name: 'Dr. Rose Callahan', title: 'Directeur(trice)' }, id: 'c1', timestamp: Date.UTC(2026, 10, 18),
            champs: { ...emptyContractFields('cdi'), poste: 'Infirmière', role: 'Infirmier(ère)', dateDebut: '2026-12-01' },
        }).bbCode;
        expect(bb).not.toMatch(/Textes consolidés|jeu de rôle \(IC\)|sans valeur juridique/);
        expect(bb).toContain('Directeur(trice)');
    });
});

describe('convention de stage : le tuteur se choisit dans le personnel', () => {
    test('champ « Tuteur de stage » : liste du personnel, obligatoire, enregistré « Nom — Grade »', () => {
        const tuteur = fieldsFor('stage').find((field) => field.key === 'tuteur');
        expect(tuteur).toMatchObject({ type: 'person', required: true, personRole: true });
        expect(tuteur.placeholder).toBeTruthy();
    });
});
