import { MEDICATIONS } from './medications';
import { findTerm } from './engine';
import { buildCase } from './protocols';
import { AGE_OPTIONS, WEIGHT_OPTIONS, HEIGHT_OPTIONS, ALLERGY_CHOICES, HISTORY_CHOICES, MEDICATION_CHOICES, joinChoices } from './pilouChoices';

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

    test('listes âge, poids et taille : valeurs lisibles par le moteur', () => {
        expect(AGE_OPTIONS[0]).toMatchObject({ value: '0' });
        expect(AGE_OPTIONS.find((o) => o.value === '35').label).toBe('35 ans');
        expect(WEIGHT_OPTIONS.map((o) => Number(o.value))).toEqual([...WEIGHT_OPTIONS.map((o) => Number(o.value))].sort((a, b) => a - b));
        expect(WEIGHT_OPTIONS[0].value).toBe('1');
        expect(WEIGHT_OPTIONS[WEIGHT_OPTIONS.length - 1].value).toBe('400');
        expect(HEIGHT_OPTIONS[0].value).toBe('30');
        expect(HEIGHT_OPTIONS[HEIGHT_OPTIONS.length - 1].value).toBe('260');
        expect(AGE_OPTIONS[AGE_OPTIONS.length - 1].value).toBe('120');
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
