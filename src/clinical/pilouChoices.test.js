import { MEDICATIONS } from './medications';
import { findTerm } from './engine';
import { buildCase } from './protocols';
import { ALLERGY_CHOICES, HISTORY_CHOICES, MEDICATION_CHOICES, joinChoices } from './pilouChoices';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));

const terms = (pick) => [...new Set(MEDICATIONS.flatMap(pick))];
const ALLERGY_TERMS = terms((m) => [...(m.allergy || []), ...(m.crossAllergy?.terms || [])]);
const HISTORY_TERMS = terms((m) => (m.contra || []).flatMap((rule) => rule.terms));
const MEDICATION_TERMS = terms((m) => (m.interacts || []).flatMap((rule) => rule.terms));

describe('choix de Pilou : tout est compris par le moteur', () => {
    test.each(ALLERGY_CHOICES.map((c) => c.value))('allergie « %s » reconnue', (label) => expect(findTerm(label, ALLERGY_TERMS)).not.toBe(''));
    test.each(HISTORY_CHOICES.map((c) => c.value))('antécédent « %s » reconnu', (label) => expect(findTerm(label, HISTORY_TERMS)).not.toBe(''));
    test.each(MEDICATION_CHOICES.map((c) => c.value))('traitement « %s » reconnu', (label) => expect(findTerm(label, MEDICATION_TERMS)).not.toBe(''));

    test('âge, poids et taille saisis librement : n\'importe quelle valeur dans les bornes est prise en charge, le moteur fait ses tranches', () => {
        [['0', '3.4', '51'], ['7', '23,5', '122'], ['16', '58.2', '167'], ['43', '81.7', '177'], ['88', '63', '158']].forEach(([ageYears, weightKg, heightCm]) => {
            const result = buildCase({ ageYears, sex: 'Female', weightKg, heightCm, severity: 'Moderate', conditionIds: ['fracture_fermee'] });
            expect(result).not.toBeNull();
            expect(result.patient.ageYears).toBe(Number(ageYears));
            expect(result.patient.weightKg).toBe(Number(weightKg.replace(',', '.')));
            expect(result.patient.heightCm).toBe(Number(heightCm));
            expect(result.patient.bmi).toBeGreaterThan(0);
            expect(result.vitals.hr).toBeGreaterThan(0);
        });
    });

    test('un choix d\'allergie change vraiment la prise en charge (la pénicilline écarte l\'amoxicilline)', () => {
        const base = { ageYears: '40', sex: 'Male', weightKg: '75', heightCm: '175', severity: 'Severe', conditionIds: ['plaie_profonde'] };
        const without = buildCase(base);
        const allergic = buildCase({ ...base, allergies: joinChoices(['Pénicilline / amoxicilline']) });
        const names = (c) => c.meds.map((m) => m.name.toLowerCase()).join(' ');
        expect(names(allergic)).not.toMatch(/amoxicilline/);
        expect(without.meds.length).toBeGreaterThan(0);
    });
});
