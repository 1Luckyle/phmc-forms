import { staffPatientId } from './patientId';

describe("ID patient d'un membre du personnel", () => {
    test("l'ID du personnage GTA World d'abord, sinon les chiffres du badge", () => {
        expect(staffPatientId({ gtawCharacterId: 28761, badge: 'PHMC-123' })).toBe('PHMC-28761');
        expect(staffPatientId({ gtawCharacterId: '28761' })).toBe('PHMC-28761');
        expect(staffPatientId({ badge: 'PHMC-4521' })).toBe('PHMC-4521');
        expect(staffPatientId({ badge: 'DMEC-77-3' })).toBe('PHMC-773'); // mêmes chiffres que myPatientID (EmployeeAuthContext)
        expect(staffPatientId({ badge: '2752' })).toBe('PHMC-2752');
        expect(staffPatientId({ gtawCharacterId: '', badge: 'PHMC-9' })).toBe('PHMC-9');
    });
    test('sans ID ni badge : rien (pas de blocage inventé)', () => {
        ['', null, undefined].forEach((member) => expect(staffPatientId(member)).toBe(''));
        expect(staffPatientId({})).toBe('');
        expect(staffPatientId({ badge: 'sans chiffres' })).toBe('');
    });
});
