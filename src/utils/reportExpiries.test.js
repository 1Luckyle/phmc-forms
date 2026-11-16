import { reportExpiries } from './reportExpiries';

jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), set: jest.fn() }));

describe('échéances à surveiller après un rapport', () => {
    test('certificat de vol : valable selon la classe et l\'âge, jamais pour un pilote inapte', () => {
        const base = { patientName: 'Jane Doe', patientDateOfBirth: '1990-05-14', date: '2026-11-10', flightCertClass: 'Class1' };
        const apt = reportExpiries(41, { ...base, flightCertConclusion: 'Apte' });
        expect(apt).toHaveLength(1);
        expect(apt[0]).toMatchObject({ type: 'certificat_vol', delaiJours: 30, titre: 'Certificat de vol — Jane Doe' });
        expect(apt[0].finIso).toBe('2027-11-10');
        expect(reportExpiries(41, { ...base, flightCertConclusion: 'Inapte' })).toEqual([]);
        expect(reportExpiries(41, { ...base })).toEqual([]);
    });

    test('évaluation d\'aptitude : durée de validité choisie, 12 mois par défaut', () => {
        const base = { patientName: 'Jane Doe', date: '2026-11-10', aptitudeConclusion: 'Apte' };
        expect(reportExpiries(6, base)[0]).toMatchObject({ type: 'aptitude', finIso: '2027-11-10' });
        expect(reportExpiries(7, { ...base, aptitudeValidityMonths: '6' })[0].finIso).toBe('2027-05-10');
        expect(reportExpiries(6, { ...base, aptitudeConclusion: 'Inapte' })).toEqual([]);
        expect(reportExpiries(14, base)).toEqual([]);
    });

    test('ordonnance : la dernière fin de traitement des lignes prescrites', () => {
        const meds = [
            { medId: 'a', prescribed: true, days: 5, startDate: '2026-11-11' },
            { medId: 'b', prescribed: true, days: 7, startDate: '2026-11-11' },
            { medId: 'c', prescribed: false, days: 30, startDate: '2026-11-11' },
        ];
        const result = reportExpiries(19, { patientName: 'Jane Doe', date: '2026-11-10', clinicalMeds: meds });
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ type: 'ordonnance', delaiJours: 3, finIso: '2026-11-17' });
        expect(reportExpiries(19, { date: '2026-11-10', clinicalMeds: meds, careDeceased: 'Yes' })).toEqual([]);
        expect(reportExpiries(19, { date: '2026-11-10', clinicalMeds: [{ medId: 'a', prescribed: false, days: 5 }] })).toEqual([]);
    });
});
