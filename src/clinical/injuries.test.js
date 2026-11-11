jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import {
    INJURY_CONDITIONS, isInjuryCondition, selectedInjuryIds, injuryEntryOf, injuryLines, mutilationLabels, mutilationCareSteps, injurySummary, MUTILATIONS, BODY_REGIONS, REGION_LABEL,
} from './injuries';
import { buildSuggestions } from './engine';
import { buildDeathSuggestion } from './death';
import { buildSurgerySuggestions } from './surgery';
import { clinicalAnamnesisBBCode, surgeryRowsBBCode } from '../phmc-bbcode-generators/shared/careExtras';
import generateEmergencyProtocol from '../phmc-bbcode-generators/generateEmergencyProtocol';
import generateSurgicalOps from '../phmc-bbcode-generators/generateSurgicalOps';
import { careVisitSummary } from '../utils/careVisitSummary';
import { validateCareExtras } from '../utils/careFormRules';

const adult = { ageYears: 35, sex: 'Male', weightKg: 75, heightCm: 178, allergies: '', chronic: '', currentMeds: '' };
const shot = { conditionId: 'plaie_arme_feu', regions: ['cuisse', 'abdomen'], side: 'Right', count: '2', trajectory: 'Lodged', note: 'Saignement actif' };
const form = {
    clinicalConditions: ['plaie_arme_feu', 'fracture_fermee', 'asthme'],
    injuryDetails: [shot, { conditionId: 'fracture_fermee', regions: ['avant_bras'], side: 'Left', count: '1', note: '' }, { conditionId: 'asthme', regions: ['thorax'], count: '3' }],
    injuryMutilations: ['teeth', 'eye'], injuryNote: 'Agression au bar.',
};

describe('blessures : localisation, multiplicité et mutilations', () => {
    test('quels motifs se localisent', () => {
        ['plaie_arme_feu', 'plaie_arme_blanche', 'fracture_fermee', 'fracture_ouverte', 'plaie_profonde', 'brulure', 'trauma_cranien', 'polytraumatisme'].forEach((id) => expect(isInjuryCondition(id)).toBe(true));
        ['asthme', 'sca', 'migraine', 'inconnu'].forEach((id) => expect(isInjuryCondition(id)).toBe(false));
        expect(selectedInjuryIds(form)).toEqual(['plaie_arme_feu', 'fracture_fermee']);
        expect(INJURY_CONDITIONS.plaie_arme_feu.trajectory).toBe(true);
        expect(INJURY_CONDITIONS.fracture_fermee.trajectory).toBeUndefined();
        expect(injuryEntryOf(form, 'plaie_arme_feu')).toBe(shot);
        expect(injuryEntryOf(form, 'brulure')).toBeNull();
    });

    test('toutes les zones du corps ont un libellé, sans doublon', () => {
        expect(new Set(BODY_REGIONS.map((region) => region.value)).size).toBe(BODY_REGIONS.length);
        expect(REGION_LABEL.avant_bras).toBe('Avant-bras');
        ['oeil', 'oreille', 'bouche', 'main', 'doigts', 'cuisse', 'thorax', 'rachis'].forEach((id) => expect(REGION_LABEL[id]).toBeTruthy());
    });

    test('une phrase par blessure : nombre, localisation et côté, trajet de la balle, précision', () => {
        const lines = injuryLines(form);
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('Plaie par arme à feu : 2 impacts de balle ; localisation : cuisse et abdomen (côté droit) ; balle logée ; Saignement actif');
        expect(lines[1]).toContain('1 fracture ; localisation : avant-bras (côté gauche)');
        // Un motif non sélectionné, ou sans aucune précision, n'imprime rien.
        expect(injuryLines({ clinicalConditions: ['brulure'], injuryDetails: [{ conditionId: 'plaie_arme_feu', count: '2' }] })).toEqual([]);
        expect(injuryLines({ clinicalConditions: ['brulure'], injuryDetails: [{ conditionId: 'brulure', regions: [], side: '', count: '', note: '' }] })).toEqual([]);
        // Accord au singulier / pluriel ; « 5 ou plus » ; plusieurs zones ; des deux côtés.
        expect(injuryLines({ clinicalConditions: ['plaie_arme_blanche'], injuryDetails: [{ conditionId: 'plaie_arme_blanche', count: '1', regions: ['thorax'] }] })[0]).toContain('1 plaie par arme blanche ; localisation : thorax');
        expect(injuryLines({ clinicalConditions: ['plaie_arme_blanche'], injuryDetails: [{ conditionId: 'plaie_arme_blanche', count: '5+', regions: ['dos', 'cou', 'thorax'], side: 'Both' }] })[0]).toContain('5 ou plus plaies par arme blanche ; localisation : dos, cou et thorax (des deux côtés)');
    });

    test('mutilations : libellés, conduite à tenir, résumé complet', () => {
        expect(mutilationLabels(form)).toEqual(['Perte de dent(s)', "Atteinte de l'œil (perforation, énucléation)"]);
        const care = mutilationCareSteps(form);
        expect(care).toHaveLength(2);
        expect(care[0]).toMatch(/^Perte de dent\(s\) : Récupération des dents/);
        expect(care[1]).toContain('coque rigide');
        expect(mutilationLabels({ injuryMutilations: ['inconnu', 'ear'] })).toEqual(["Atteinte de l'oreille (arrachement, perte)"]);
        expect(MUTILATIONS.filter((m) => !m.care).map((m) => m.value)).toEqual(['other']);
        const summary = injurySummary(form);
        expect(summary).toContain('Plaie par arme à feu : 2 impacts de balle');
        expect(summary).toContain("mutilation(s) : perte de dent(s), atteinte de l'œil (perforation, énucléation)");
        expect(summary).toMatch(/Agression au bar\.$/);
        expect(injurySummary({})).toBe('');
    });
});

describe('Pilou reprend les blessures dans sa rédaction', () => {
    const suggestions = (formData) => buildSuggestions({ conditionIds: formData.clinicalConditions, severity: 'Severe', patient: adult, seed: 's', formData });

    test('plainte, diagnostics et soins mentionnent localisation, mutilations et conduite à tenir', () => {
        const s = suggestions({ ...form, clinicalConditions: ['plaie_arme_feu', 'fracture_fermee'] });
        expect(s.text.complaint).toContain('Lésions : Plaie par arme à feu : 2 impacts de balle ; localisation : cuisse et abdomen (côté droit)');
        expect(s.text.complaint).toContain("Mutilation(s) : perte de dent(s), atteinte de l'œil (perforation, énucléation).");
        expect(s.text.diagnosis).toMatch(/Localisation : Plaie par arme à feu : 2 impacts de balle/);
        expect(s.text.secondary).toContain('Mutilation(s) : perte de dent(s)');
        expect(s.text.procedure).toContain('Mutilations :');
        expect(s.text.procedure).toContain("- Perte de dent(s) : Récupération des dents");
        expect(s.text.procedure).toContain("- Atteinte de l'œil (perforation, énucléation) : Protection de l'œil");
    });

    test('sans précision, le texte reste celui d’avant', () => {
        const plain = suggestions({ clinicalConditions: ['plaie_arme_feu'] });
        expect(plain.text.complaint).toBe('Douleur intense et saignement après un tir.');
        expect(plain.text.complaint).not.toContain('Lésions');
        expect(plain.text.diagnosis).not.toContain('Localisation');
        expect(plain.text.procedure).not.toContain('Mutilations :');
    });

    test('décès : les lésions figurent dans la cause du décès', () => {
        const cause = buildDeathSuggestion({ kind: 'emergency', formData: { ...form, clinicalConditions: ['plaie_arme_feu'] }, now: '15:12' }).careDeathCause;
        expect(cause).toContain('Lésions : Plaie par arme à feu : 2 impacts de balle');
        expect(cause).toContain('Choc hémorragique réfractaire');
    });
});

describe('rapport : localisation des blessures', () => {
    test('anamnèse : puces par blessure, mutilations et précision, sous les motifs', () => {
        const bb = clinicalAnamnesisBBCode(form);
        expect(bb).toContain('[u]Localisation des blessures: [/u]');
        expect(bb).toContain('• Plaie par arme à feu : 2 impacts de balle ; localisation : cuisse et abdomen (côté droit)');
        expect(bb).toContain("• Mutilation(s) : Perte de dent(s), Atteinte de l'œil (perforation, énucléation)");
        expect(bb).toContain('• Agression au bar.');
        expect(bb.indexOf('Motifs de prise en charge')).toBeLessThan(bb.indexOf('Localisation des blessures'));
        expect(clinicalAnamnesisBBCode({ clinicalConditions: ['asthme'] })).not.toContain('Localisation des blessures');
        const full = generateEmergencyProtocol({ patientName: 'X', patientID: 'PHMC-1', date: '2026-11-11', phmcEmployee: 'Dr. Y', ...form });
        expect(full).toContain('Localisation des blessures');
    });

    test('historique des soins du dossier : lésions résumées', () => {
        expect(careVisitSummary(19, { date: '2026-11-11', patientChiefComplaint: 'Tir', ...form }).lesions).toContain('Plaie par arme à feu : 2 impacts de balle');
        expect(careVisitSummary(19, { patientChiefComplaint: 'Tir' }).lesions).toBeUndefined();
    });
});

describe('opération : durée de prise en charge', () => {
    const base = { patientName: 'Jean Test', patientID: 'PHMC-1', date: '2026-11-11', phmcEmployee: 'Dr. Y' };

    test('le rapport indique la prise en charge et sa durée, comme aux urgences', () => {
        expect(surgeryRowsBBCode({ careStartTime: '13:30', careEndTime: '16:10' })).toContain('[tr][td]Prise en charge[/td][td]\nde 13:30 à 16:10 (2 h 40 min)\n[/td][/tr]');
        expect(surgeryRowsBBCode({ careStartTime: '13:30' })).toContain('de 13:30');
        expect(surgeryRowsBBCode({})).not.toContain('Prise en charge');
        expect(generateSurgicalOps({ ...base, careStartTime: '23:30', careEndTime: '01:10' })).toContain('de 23:30 à 01:10 (1 h 40 min)');
        expect(generateSurgicalOps(base)).not.toContain('Prise en charge');
    });

    test('contrôle : plus de 12 heures de prise en charge', () => {
        expect(validateCareExtras(5, { careStartTime: '06:00', careEndTime: '20:00' }).join(' ')).toMatch(/dépasse 12 heures/);
        expect(validateCareExtras(5, { careStartTime: '13:30', careEndTime: '16:10' })).toEqual([]);
    });

    test('Pilou propose les heures d’après l’heure du rendez-vous : fin = durée de l’intervention + 45 min', () => {
        const withTime = buildSurgerySuggestions({ procedureIds: ['appendicectomie'], patient: adult, formData: { appointmentTime: '14:00' } });
        const { surgeryDuration } = withTime.fields.intervention;
        expect(withTime.fields.intervention.careStartTime).toBe('14:00');
        const end = withTime.fields.intervention.careEndTime;
        const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
        expect(minutes(end) - minutes('14:00')).toBe(Number(surgeryDuration) + 45);
        const without = buildSurgerySuggestions({ procedureIds: ['appendicectomie'], patient: adult, formData: {} });
        expect(without.fields.intervention.careStartTime).toBeUndefined();
        expect(without.fields.intervention.careEndTime).toBeUndefined();
    });

    test('décès au bloc : l’heure de fin de prise en charge sert d’heure du décès', () => {
        const suggestion = buildDeathSuggestion({ kind: 'surgery', now: '18:00', formData: { surgeryProcedureIds: ['appendicectomie'], careEndTime: '15:12' } });
        expect(suggestion.careDeathTime).toBe('15:12');
        expect(suggestion.careDeathCause).toContain('constaté à 15:12');
    });
});
