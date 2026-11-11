import { CONDITIONS } from './conditions';
import { PROCEDURES } from './procedures';
import { SEVERITIES } from './vitals';
import {
    AGE_RANGES, SEX_HINTS, EXAM_RESULTS, DEFAULT_AGE_RANGE, suggestPatient, patientNotices, defaultFindings, arrivalModeFor, addMinutes, examResultsFor, examKeyOfImaging, pickNumericOption, ADVICE_BY_GROUP,
} from './context';
import { buildSuggestions, patientFromForm } from './engine';
import { sectionPatch, applyAll, applySection, sectionsFor } from './apply';
import { buildSurgerySuggestions } from './surgery';
import { LEGACY_RESULT_LABELS, LEGACY_LAB_KEYS, IMAGING_RESULT_ADDITIONS, LAB_RESULT_ADDITIONS } from '../constants/clinicalOptions';

const adult = { ageYears: 35, sex: 'Male', weightKg: 75, heightCm: 178, allergies: '', chronic: '', currentMeds: '' };
const resultListOf = (key) => [...Object.keys(LEGACY_RESULT_LABELS), ...(IMAGING_RESULT_ADDITIONS[key === 'otherImagingResults' ? 'otherResults' : key] || [])];
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

describe('patient plausible', () => {
    test('âge dans la tranche du motif, sexe imposé, date de naissance cohérente et passée', () => {
        const s = suggestPatient({ ids: ['asthme'], seed: 'PHMC-1|2026-11-11', formData: { date: '2026-11-11' } });
        const [min, max] = AGE_RANGES.asthme;
        expect(Number(s.patientAgeYears)).toBeGreaterThanOrEqual(min);
        expect(Number(s.patientAgeYears)).toBeLessThanOrEqual(max);
        expect(['Male', 'Female']).toContain(s.patientSex);
        expect(s.patientDateOfBirth <= todayIso()).toBe(true);
        const birthYear = Number(s.patientDateOfBirth.slice(0, 4));
        expect(2026 - birthYear - Number(s.patientAgeYears)).toBeLessThanOrEqual(1);
        expect(2026 - birthYear - Number(s.patientAgeYears)).toBeGreaterThanOrEqual(0);
        expect(s).toMatchObject({ patientAllergies: 'Aucune connue', patientChronicDiseases: 'Aucun connu', patientCurrentMedicine: 'Aucun' });
    });
    test('déterministe, et le sexe suit le motif', () => {
        const a = suggestPatient({ ids: ['cesarienne'], seed: 'x' });
        expect(a).toEqual(suggestPatient({ ids: ['cesarienne'], seed: 'x' }));
        expect(a.patientSex).toBe('Female');
        expect(suggestPatient({ ids: ['torsion_testiculaire'], seed: 'y' }).patientSex).toBe('Male');
        expect(Number(suggestPatient({ ids: ['torsion_testiculaire'], seed: 'y' }).patientAgeYears)).toBeLessThanOrEqual(25);
    });
    test('antécédents évoqués par le motif repris dans les antécédents ; sans tranche : adulte', () => {
        expect(suggestPatient({ ids: ['asthme'], seed: 's', chronic: ['Asthme'] }).patientChronicDiseases).toBe('Asthme');
        const generic = suggestPatient({ ids: [], seed: 's' });
        expect(Number(generic.patientAgeYears)).toBeGreaterThanOrEqual(DEFAULT_AGE_RANGE[0]);
        expect(Number(generic.patientAgeYears)).toBeLessThanOrEqual(DEFAULT_AGE_RANGE[1]);
    });
    test('toutes les tranches et tous les sexes imposés correspondent à un motif ou une intervention', () => {
        const known = new Set([...CONDITIONS.map((c) => c.id), ...PROCEDURES.map((p) => p.id)]);
        Object.keys(AGE_RANGES).forEach((id) => { expect(known.has(id)).toBe(true); expect(AGE_RANGES[id][0]).toBeLessThan(AGE_RANGES[id][1]); });
        Object.keys(SEX_HINTS).forEach((id) => expect(known.has(id)).toBe(true));
    });
    test('remarques : âge ou sexe manquants, sexe incompatible', () => {
        expect(patientNotices({ ids: [], patient: { ageYears: null, sex: '' } })).toHaveLength(2);
        expect(patientNotices({ ids: [], patient: adult })).toEqual([]);
        expect(patientNotices({ ids: ['cesarienne'], patient: adult, label: 'cette intervention' })[0]).toMatch(/masculin.*cette intervention concerne un patient de sexe féminin/);
    });
});

describe('constatations, arrivée, conseils', () => {
    test('chaque motif produit les six constatations, avec des valeurs des listes', () => {
        const allowed = { findings: ['patientNormal', 'patientImpared'], lungs: ['patientNormal', 'patientRhonchi', 'patientCrack'], pupils: ['patientPupilsNormal', 'patientPupilsAbnormal'], wounds: ['patientFractures', 'patientBleeding', 'patientHematoma', 'patientNoWounds'], ecg: ['patientSinusRhythm', 'patientArrhythmia', 'patientInfaction'], sono: ['patientNormal', 'patientFluids', 'patientTissue'] };
        CONDITIONS.forEach((c) => SEVERITIES.forEach((sev) => {
            const s = buildSuggestions({ conditionIds: [c.id], severity: sev.value, patient: adult, seed: 'x' });
            expect(Object.keys(s.findings).sort()).toEqual(Object.keys(allowed).sort());
            Object.entries(s.findings).forEach(([key, value]) => expect(allowed[key]).toContain(value));
        }));
        expect(defaultFindings(0).findings).toBe('patientNormal');
        expect(defaultFindings(2).findings).toBe('patientImpared');
    });
    test('mode d\'arrivée selon la gravité, heures, conseils', () => {
        expect(arrivalModeFor(0, new Set())).toBe('Walk-in');
        expect(arrivalModeFor(2, new Set())).toBe('EMS');
        expect(arrivalModeFor(1, new Set(['choc']))).toBe('EMS');
        expect(addMinutes('23:55', 10)).toBe('00:05');
        expect(addMinutes('14:30', 10)).toBe('14:40');
        expect(addMinutes('', 10)).toBe('');
        CONDITIONS.forEach((c) => expect(ADVICE_BY_GROUP[c.group]).toBeTruthy());
        const home = buildSuggestions({ conditionIds: ['plaie_superficielle'], severity: 'Mild', patient: adult });
        expect(home.text.advice).toMatch(/Repos de la zone atteinte/);
        const admitted = buildSuggestions({ conditionIds: ['plaie_arme_feu'], severity: 'Severe', patient: adult });
        expect(admitted.text.advice).toMatch(/Admission pour surveillance/);
    });
    test('oxygène sanguin : valeur de la liste d\'après les libellés', () => {
        const options = [{ value: 'a', label: 'Normal (≥ 95 %)' }, { value: 'b', label: 'Légère hypoxie (90–94 %)' }, { value: 'c', label: 'Hypoxie sévère (< 90 %)' }];
        expect(pickNumericOption(options, 98)).toBe('a');
        expect(pickNumericOption(options, 95)).toBe('a');
        expect(pickNumericOption(options, 92)).toBe('b');
        expect(pickNumericOption(options, 85)).toBe('c');
        expect(pickNumericOption([{ value: 'x', label: 'Oxygène sanguin' }], 98)).toBeUndefined();
        expect(pickNumericOption([], 98)).toBeUndefined();
        // Libellés réels de la base (valeurs mal nommées incluses) : « 95%+ », « Moins de 90% », « 90-94% ».
        const real = [{ value: 'patientBloodOxyHigh', label: 'Normal (95%+)' }, { value: 'patientBloodOxyNormal', label: 'Hypoxique (Moins de 90%)' }, { value: 'patientBloodOxyLow', label: 'Limite (90-94%)' }];
        expect(pickNumericOption(real, 98)).toBe('patientBloodOxyHigh');
        expect(pickNumericOption(real, 95)).toBe('patientBloodOxyHigh');
        expect(pickNumericOption(real, 92)).toBe('patientBloodOxyLow');
        expect(pickNumericOption(real, 85)).toBe('patientBloodOxyNormal');
        expect(pickNumericOption([{ value: 'n', label: 'Normale (> 95 %)' }, { value: 'l', label: 'Basse (≤ 90 %)' }], 97)).toBe('n');
        expect(pickNumericOption([{ value: 'n', label: 'Normale (> 95 %)' }, { value: 'l', label: 'Basse (≤ 90 %)' }], 90)).toBe('l');
    });
});

describe("résultats d'examens", () => {
    test('chaque valeur existe dans les listes du formulaire', () => {
        const labKnown = new Set([...Object.keys(LEGACY_RESULT_LABELS), ...LEGACY_LAB_KEYS, ...LAB_RESULT_ADDITIONS]);
        Object.keys(EXAM_RESULTS).forEach((id) => {
            expect(CONDITIONS.some((c) => c.id === id)).toBe(true);
            SEVERITIES.forEach((sev) => {
                const entry = typeof EXAM_RESULTS[id] === 'function' ? EXAM_RESULTS[id](sev.index) : EXAM_RESULTS[id];
                Object.entries(entry).forEach(([key, values]) => values.forEach((value) => {
                    if (key === 'lab') expect(labKnown.has(value)).toBe(true);
                    else expect({ id, key, value, ok: resultListOf(key).includes(value) }).toEqual({ id, key, value, ok: true });
                }));
            });
        });
    });
    test("les résultats d'imagerie ne concernent que des types d'imagerie suggérés pour ce motif", () => {
        CONDITIONS.forEach((c) => SEVERITIES.forEach((sev) => {
            const results = examResultsFor([c.id], sev.index);
            const typesWithResults = Object.keys(results).filter((key) => key !== 'lab');
            const typesSuggested = (c.imaging || []).map((type) => examKeyOfImaging[type]);
            typesWithResults.forEach((key) => expect({ id: c.id, key, ok: typesSuggested.includes(key) }).toEqual({ id: c.id, key, ok: true }));
        }));
    });
    test('« aucune anomalie » ne cohabite pas avec un résultat positif', () => {
        const merged = examResultsFor(['plaie_profonde', 'fracture_fermee'], 1);
        expect(merged.XrayResults).toEqual(['Displaced Fracture']);
    });
});

describe('application complète', () => {
    const patientAdult = { ...adult };
    const extra = { now: '14:30', appointmentTime: '', bloodOxy: 'oxy-normal' };
    test("urgences : tous les champs de la prise en charge sont remplis, y compris arrivée, examens et conseils", () => {
        const s = buildSuggestions({ conditionIds: ['plaie_arme_blanche'], severity: 'Severe', patient: patientAdult, seed: 'x' });
        const state = applyAll({}, s, false, 'emergency', extra);
        expect(state).toMatchObject({
            arrivalMode: 'EMS', arrivalTime: '14:30', careStartTime: '14:32', bloodOxy: 'oxy-normal', lungs: 'patientNormal', pupils: 'patientPupilsNormal', ecg: 'patientSinusRhythm', sono: 'patientNormal',
            Imaging: ['XRay', 'Ultrasound'], XrayResults: ['NothingFound'], ultrasoundResults: ['Hémopéritoine (FAST positif)'], admission: 'Yes', dischargeDestination: 'OperatingRoom',
            patientSex: expect.any(String), patientDateOfBirth: expect.any(String), patientAllergies: 'Aucune connue',
        });
        expect(state.patientMedicine).toMatch(/Admission pour surveillance/);
        expect(state.painLevel).toBe('patientSeverePain');
    });
    test("l'heure du rendez-vous sert d'heure d'arrivée ; rien d'inventé sans liste d'oxygène", () => {
        const s = buildSuggestions({ conditionIds: ['migraine'], severity: 'Mild', patient: patientAdult, seed: 'x' });
        const patch = sectionPatch('arrival', s, 'emergency', { now: '14:30', appointmentTime: '09:15' });
        expect(patch).toMatchObject({ arrivalMode: 'Walk-in', arrivalTime: '09:15', careStartTime: '09:25' });
        expect(sectionPatch('vitals', s, 'emergency', {}).bloodOxy).toBeUndefined();
    });
    test('consultation : examens à prescrire, sans champs propres aux urgences', () => {
        const s = buildSuggestions({ conditionIds: ['pneumopathie'], severity: 'Moderate', patient: patientAdult, seed: 'x' });
        expect(sectionPatch('exams', s, 'consult')).toEqual({ examsOrdered: ['Xray', 'Blood'] });
        expect(sectionPatch('outcome', s, 'consult').patientMedicine).toBeUndefined();
        expect(sectionsFor('consult').some((section) => section.key === 'arrival')).toBe(false);
        expect(sectionsFor('emergency').some((section) => section.key === 'arrival')).toBe(true);
    });
    test('le patient saisi n\'est jamais remplacé, même en mode « Remplacer »', () => {
        const s = buildSuggestions({ conditionIds: ['asthme'], severity: 'Moderate', patient: patientAdult, seed: 'x' });
        const prev = { patientSex: 'Female', patientAllergies: 'Pénicilline', patientDateOfBirth: '1990-01-01' };
        const next = applySection(prev, 'patient', s, { overwrite: true });
        expect(next).toMatchObject({ patientSex: 'Female', patientAllergies: 'Pénicilline', patientDateOfBirth: '1990-01-01', patientCurrentMedicine: 'Aucun', patientChronicDiseases: 'Asthme' });
    });
    test('un patient complété donne un patient exploitable par le moteur', () => {
        const s = buildSuggestions({ conditionIds: ['sca'], severity: 'Moderate', patient: { ...adult, ageYears: null, sex: '' }, seed: 'PHMC-9|2026-11-11', formData: { date: '2026-11-11' } });
        const completed = patientFromForm({ ...s.patientPatch, date: '2026-11-11' });
        expect(completed.ageYears).toBeGreaterThanOrEqual(AGE_RANGES.sca[0]);
        expect(['Male', 'Female']).toContain(completed.sex);
        expect(s.notices.length).toBe(2);
    });
});

describe('chirurgie : patient plausible', () => {
    test('césarienne : patiente, âge plausible, remarque si le sexe saisi est incompatible', () => {
        const s = buildSurgerySuggestions({ procedureIds: ['cesarienne'], patient: adult, seed: 'x' });
        expect(s.fields.patient.patientSex).toBe('Female');
        expect(Number(s.fields.patient.patientAgeYears)).toBeGreaterThanOrEqual(20);
        expect(s.notices.some((n) => /cette intervention concerne un patient de sexe féminin/.test(n))).toBe(true);
        expect(buildSurgerySuggestions({ procedureIds: ['appendicectomie'], patient: { ...adult, ageYears: null }, seed: 'x' }).notices[0]).toMatch(/Date de naissance non renseignée/);
    });
});
