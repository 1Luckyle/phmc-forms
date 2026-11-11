jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import { deathMannerOf, buildDeathSuggestion, surgeryDeathMannerOf, surgeryDeathBundle } from '../clinical/death';
import { SURGERY_DEATH_MANNERS, deathMannersFor, deathMannerLabel } from '../constants/careFormOptions';
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

    test("urgences : heure de fin, récit détaillé tiré des motifs et de l'évolution, corps au DMEC si le décès n'est pas naturel", () => {
        const suggestion = buildDeathSuggestion({ kind: 'emergency', now: '16:00', formData: { clinicalConditions: ['polytraumatisme'], patientInjuryMechanism: 'Accident à haute cinétique.', careStartTime: '14:35', careEndTime: '15:12', arrivalTime: '14:30', patientEmergencyContactNumber: '555-0100' } });
        expect(suggestion).toMatchObject({ careDeathTime: '15:12', careDeathManner: 'Accidental', careDeathResuscitation: 'Attempted', careDeathFamily: 'ToInform', careDeathBody: 'Coroner' });
        expect(suggestion.careDeathCause).toMatch(/^Décès constaté à 15:12, après une arrivée à 14:30 \(prise en charge de 37 minutes\)\./);
        expect(suggestion.careDeathCause).toContain('Prise en charge pour : polytraumatisme');
        expect(suggestion.careDeathCause).toContain('accident à haute cinétique');
        expect(suggestion.careDeathCause).toContain('Choc hémorragique réfractaire malgré le remplissage vasculaire');
        expect(suggestion.careDeathResuscitationNote).toContain('massage cardiaque externe immédiat (100 à 120 compressions par minute)');
        expect(suggestion.careDeathResuscitationNote).toContain('adrénaline 1 mg renouvelée toutes les 3 à 5 minutes');
        expect(suggestion.careDeathResuscitationNote).toContain('remplissage vasculaire massif, hémostase et transfusion');
        expect(suggestion.careDeathResuscitationNote).toContain('Réanimation poursuivie pendant 37 minutes (de 14:35 à 15:12)');
        // Mort naturelle : morgue ; sans heure de fin, l'heure du clic ; sans contact connu, aucun proche identifié ; l'évolution suit le motif.
        const natural = buildDeathSuggestion({ kind: 'emergency', now: '16:00', formData: { clinicalConditions: ['sca'] } });
        expect(natural).toMatchObject({ careDeathTime: '16:00', careDeathManner: 'Natural', careDeathBody: 'Morgue', careDeathFamily: 'NoContact' });
        expect(natural.careDeathCause).toContain('Arrêt cardiaque réfractaire sur syndrome coronarien aigu');
        expect(natural.careDeathResuscitationNote).toContain('défibrillation (choc électrique)');
        expect(natural.careDeathResuscitationNote).toContain('Réanimation poursuivie environ 30 minutes');
        // Surdose : antidote ; anaphylaxie : adrénaline IM.
        expect(buildDeathSuggestion({ kind: 'emergency', formData: { clinicalConditions: ['surdose_opioides'] } }).careDeathResuscitationNote).toContain('naloxone');
        expect(buildDeathSuggestion({ kind: 'emergency', formData: { clinicalConditions: ['anaphylaxie'] } }).careDeathResuscitationNote).toContain('adrénaline IM puis IV');
        // Sans motif : seule la cause reste à écrire (le déroulé de la réanimation est proposé quand même).
        const none = buildDeathSuggestion({ kind: 'emergency', formData: {} });
        expect(none.careDeathCause).toBeUndefined();
        expect(none.careDeathResuscitationNote).toContain('massage cardiaque externe');
    });

    test("opération : décès au bloc : cause explicite choisie d'après les pertes, le terrain et l'ASA, récit détaillé", () => {
        const base = { surgeryProcedureIds: ['appendicectomie'], surgeryAnesthesiaType: 'General' };
        const undetermined = buildDeathSuggestion({ kind: 'surgery', now: '15:12', formData: base });
        expect(undetermined).toMatchObject({ careDeathTime: '15:12', careDeathManner: 'CauseUndetermined', careDeathBody: 'Coroner', careDeathResuscitation: 'Attempted' });
        expect(undetermined.careDeathCause).toMatch(/^Décès survenu au cours de l'intervention \(appendicectomie.*\), sous anesthésie générale, constaté à 15:12\./i);
        expect(undetermined.careDeathCause).toContain("précisées par l'autopsie");
        expect(undetermined.careDeathResuscitationNote).toContain('Arrêt cardio-circulatoire constaté au bloc : suspension de l\'acte');
        expect(undetermined.careDeathResuscitationNote).toContain('décès constaté par le chirurgien principal à 15:12');

        expect(surgeryDeathMannerOf({ ...base, surgeryBloodLoss: '600' })).toBe('Hemorrhage');
        expect(surgeryDeathMannerOf({ surgeryProcedureIds: ['laparotomie'] })).toBe('Hemorrhage');
        expect(surgeryDeathMannerOf({ ...base, patientChronicDiseases: 'Insuffisance cardiaque, diabète' })).toBe('CardiacArrest');
        expect(surgeryDeathMannerOf({ ...base, surgeryAsa: 'ASA4' })).toBe('PreexistingCondition');
        // Un choix déjà fait dans le formulaire est respecté ; une valeur de la liste des urgences est ignorée.
        expect(surgeryDeathMannerOf({ ...base, surgeryBloodLoss: '900', careDeathManner: 'Anaphylaxis' })).toBe('Anaphylaxis');
        expect(surgeryDeathMannerOf({ ...base, careDeathManner: 'Natural' })).toBe('CauseUndetermined');

        const hemorrhage = buildDeathSuggestion({ kind: 'surgery', now: '15:12', formData: { ...base, surgeryBloodLoss: '600' } });
        expect(hemorrhage.careDeathManner).toBe('Hemorrhage');
        expect(hemorrhage.careDeathCause).toContain('Hémorragie peropératoire massive (pertes estimées à 600 mL)');
        expect(hemorrhage.careDeathResuscitationNote).toContain('transfusion massive');
        const anaphylaxis = buildDeathSuggestion({ kind: 'surgery', formData: { ...base, careDeathManner: 'Anaphylaxis' } });
        expect(anaphylaxis.careDeathCause).toContain('Choc anaphylactique peropératoire');
        expect(anaphylaxis.careDeathResuscitationNote).toContain('adrénaline renforcée');
    });

    test('chaque cause du bloc a son récit et son geste de réanimation ; chaque libellé est explicite', () => {
        SURGERY_DEATH_MANNERS.forEach(({ value, label }) => {
            const bundle = surgeryDeathBundle({ formData: { surgeryProcedureIds: ['appendicectomie'], careDeathManner: value }, now: '15:12' });
            expect(bundle.manner).toBe(value);
            expect(bundle.cause.length).toBeGreaterThan(120);
            expect(bundle.resuscitation).toContain('massage cardiaque externe');
            expect(bundle.complication).toBeTruthy();
            expect(bundle.failure).toMatch(/interrompue/);
            expect(bundle.summary).toMatch(/^Interruption de l'intervention à 15:12/);
            expect(deathMannerLabel(value)).toBe(label);
            expect(label).not.toMatch(/^(Mort naturelle|Mort accidentelle|Mort violente)/);
        });
        expect(deathMannerLabel('Accidental')).toBe('Mort accidentelle');
        expect(deathMannersFor('surgery')).toBe(SURGERY_DEATH_MANNERS);
        expect(deathMannersFor('emergency').map((o) => o.value)).toContain('Natural');
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
