jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import { deathMannerOf, buildDeathSuggestion } from '../clinical/death';
import { validateCareExtras } from './careFormRules';
import { careVisitSummary } from './careVisitSummary';
import { getDebugTemplate, DEBUG_DEATH_VERSIONS } from './debugTemplates';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';
import { DEATH_FIELDS } from '../constants/careFormOptions';
import generateEmergencyProtocol from '../phmc-bbcode-generators/generateEmergencyProtocol';
import generateSurgicalOps from '../phmc-bbcode-generators/generateSurgicalOps';
import { validateReport } from './formValidation';

const base = { patientName: 'Jean Testard', patientID: 'PHMC-2752', date: '2026-11-11', phmcEmployee: 'Dr. Rose Callahan', phmcRank: 'Médecin Titulaire' };
const complete = { careDeceased: 'Yes', careDeathTime: '15:12', careDeathCause: 'Polytraumatisme', careDeathManner: 'Accidental', careDeathResuscitation: 'Attempted', careDeathBody: 'Coroner' };

describe('décès du patient : aide de Pilou', () => {
    test('circonstances probables selon les motifs', () => {
        expect(deathMannerOf(['plaie_arme_feu'])).toBe('Violent');
        expect(deathMannerOf(['surdose_opioides'])).toBe('Intoxication');
        expect(deathMannerOf(['polytraumatisme'])).toBe('Accidental');
        expect(deathMannerOf(['sca'])).toBe('Natural');
        expect(deathMannerOf([])).toBe('Undetermined');
        expect(deathMannerOf(['inconnu'])).toBe('Undetermined');
    });

    test('urgences : heure de fin de prise en charge, cause tirée des motifs, corps au DMEC si le décès n\'est pas naturel', () => {
        const suggestion = buildDeathSuggestion({ kind: 'emergency', now: '16:00', formData: { clinicalConditions: ['polytraumatisme'], patientInjuryMechanism: 'Accident à haute cinétique.', careEndTime: '15:20', patientEmergencyContactNumber: '555-0100' } });
        expect(suggestion).toMatchObject({ careDeathTime: '15:20', careDeathManner: 'Accidental', careDeathResuscitation: 'Attempted', careDeathFamily: 'ToInform', careDeathBody: 'Coroner' });
        expect(suggestion.careDeathCause).toMatch(/^Décès consécutif à : polytraumatisme/);
        expect(suggestion.careDeathCause).toContain('accident à haute cinétique');
        // Mort naturelle : morgue ; sans heure de fin, l'heure du clic ; sans contact connu, aucun proche identifié.
        const natural = buildDeathSuggestion({ kind: 'emergency', now: '16:00', formData: { clinicalConditions: ['sca'] } });
        expect(natural).toMatchObject({ careDeathTime: '16:00', careDeathManner: 'Natural', careDeathBody: 'Morgue', careDeathFamily: 'NoContact' });
        // Sans motif : seule la cause reste à écrire.
        expect(buildDeathSuggestion({ kind: 'emergency', formData: {} }).careDeathCause).toBeUndefined();
    });

    test('opération : décès au cours de l\'intervention choisie, circonstances à déterminer, DMEC', () => {
        const suggestion = buildDeathSuggestion({ kind: 'surgery', now: '15:12', formData: { surgeryProcedureIds: ['appendicectomie'] } });
        expect(suggestion).toMatchObject({ careDeathTime: '15:12', careDeathManner: 'Undetermined', careDeathBody: 'Coroner', careDeathResuscitation: 'Attempted' });
        expect(suggestion.careDeathCause).toMatch(/^Décès survenu au cours de l'intervention \(appendicectomie/i);
    });
});

describe('décès du patient : rapport, contrôles et dossier', () => {
    test('BBCode : section « Décès du patient » seulement quand il est coché, aux urgences comme en opération', () => {
        const emergency = generateEmergencyProtocol({ ...base, ...complete, careDeathResuscitationNote: 'Massage cardiaque 25 minutes.', careDeathFamily: 'Informed' });
        expect(emergency).toContain('Décès du patient');
        expect(emergency).toContain('Heure du décès[/td][td]15:12');
        expect(emergency).toContain('Mort accidentelle');
        expect(emergency).toContain('Réanimation tentée, sans succès');
        expect(emergency).toContain('Massage cardiaque 25 minutes.');
        expect(emergency).toContain('DMEC (médecine légale)');
        expect(generateEmergencyProtocol(base)).not.toContain('Décès du patient');
        expect(generateEmergencyProtocol({ ...base, careDeceased: '' })).not.toContain('Décès du patient');
        const surgery = generateSurgicalOps({ ...base, ...complete });
        expect(surgery).toContain('Décès du patient');
        expect(surgery.indexOf('Décès du patient')).toBeLessThan(surgery.indexOf('Résumé de la procédure chirurgicale'));
        expect(generateSurgicalOps(base)).not.toContain('Décès du patient');
    });

    test('contrôles : heure, cause, nature, réanimation et destination du corps obligatoires quand le patient est décédé', () => {
        [19, 5].forEach((version) => {
            const errors = validateCareExtras(version, { careDeceased: 'Yes' });
            expect(errors).toHaveLength(5);
            expect(errors.join(' ')).toMatch(/heure du décès/);
            expect(validateCareExtras(version, complete)).toEqual([]);
            expect(validateCareExtras(version, {})).toEqual([]);
        });
        // Les autres formulaires ne sont pas concernés.
        expect(validateCareExtras(20, { careDeceased: 'Yes' })).toEqual([]);
        expect(validateReport(19, { ...base, careDeceased: 'Yes' }).errors.join(' ')).toMatch(/Décès/);
    });

    test('le décès figure dans l\'historique des soins du dossier', () => {
        expect(careVisitSummary(19, { date: '2026-11-11', patientChiefComplaint: 'Chute', ...complete }).deces).toBe('Patient décédé à 15:12 : Polytraumatisme');
        expect(careVisitSummary(5, { date: '2026-11-11', surgeryProcedures: 'Appendicectomie', ...complete }).deces).toBe('Patient décédé à 15:12 : Polytraumatisme');
        expect(careVisitSummary(19, { patientChiefComplaint: 'Chute' }).deces).toBeUndefined();
    });

    test('catalogue : les formulaires 5 et 19 connaissent les champs du décès', () => {
        [5, 19].forEach((version) => expect(Object.keys(VERSION_FIELDS[version])).toEqual(expect.arrayContaining(DEATH_FIELDS)));
    });
});

describe('remplissage debug : deux scénarios', () => {
    test('opération et urgences : patient vivant par défaut, patient décédé sur demande', () => {
        expect(DEBUG_DEATH_VERSIONS).toEqual([5, 19]);
        DEBUG_DEATH_VERSIONS.forEach((version) => {
            const alive = getDebugTemplate(version, {});
            expect(alive.careDeceased).toBe('');
            const dead = getDebugTemplate(version, {}, 'death');
            expect(dead).toMatchObject({ careDeceased: 'Yes', careDeathTime: '15:12', careDeathResuscitation: 'Attempted', careDeathBody: 'Coroner' });
            expect(validateCareExtras(version, dead)).toEqual([]);
        });
        expect(getDebugTemplate(19, {}, 'death')).toMatchObject({ dischargeDestination: 'Death' });
        // Les autres formulaires ne reçoivent aucun champ de décès.
        expect(getDebugTemplate(20, {}, 'death').careDeceased).toBeUndefined();
    });
});
