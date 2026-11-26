import {
    suggestedGrade, gradeOfRow, worstGrade, limbsToSplint, needsConvalescence, gameplayCareSteps, gameplayRoutineCare, hasActiveBleeding,
    intakeHoursPhrase, prescriptionQuantity, prescriptionLimitMessages, needsFollowupAppointment, GUNSHOT_VEST_PRECISION,
} from './gameplay';
import { injuryLines } from './injuries';
import { prescriptionText, checkPrescription } from './engine';
import { bleedingBBCode, abcdeBBCode, followupAppointmentBBCode, emergencyExtrasBBCode } from '../phmc-bbcode-generators/shared/careExtras';
import generateEmergencyProtocol from '../phmc-bbcode-generators/generateEmergencyProtocol';
import generateConsultationNotesPHMC from '../phmc-bbcode-generators/generateConsultationNotesPHMC';
import generateHipaaNotice from '../phmc-bbcode-generators/generateHipaaNotice';
import { ARRIVAL_MODES, ROUTINE_CARE } from '../constants/careFormOptions';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));

const row = (conditionId, region, extra = {}) => ({ conditionId, region, side: 'Right', count: '1', precisions: [], ...extra });
const form = (rows, extra = {}) => ({ clinicalConditions: [...new Set(rows.map((r) => r.conditionId))], injuryDetails: rows, ...extra });

describe('gravité des blessures (règles du jeu)', () => {
    test('balle à la tête ou au cou, lame au cou : critique', () => {
        expect(suggestedGrade('plaie_arme_feu', row('plaie_arme_feu', 'visage'))).toBe('Critical');
        expect(suggestedGrade('plaie_arme_feu', row('plaie_arme_feu', 'cou'))).toBe('Critical');
        expect(suggestedGrade('plaie_arme_blanche', row('plaie_arme_blanche', 'cou'))).toBe('Critical');
        expect(suggestedGrade('plaie_arme_blanche', row('plaie_arme_blanche', 'thorax'))).toBe('Moderate');
    });
    test('balle ailleurs : grave ; tangentielle : modérée ; arrêtée par le gilet : légère', () => {
        expect(suggestedGrade('plaie_arme_feu', row('plaie_arme_feu', 'cuisse'))).toBe('Severe');
        expect(suggestedGrade('plaie_arme_feu', row('plaie_arme_feu', 'cuisse', { trajectory: 'Graze' }))).toBe('Moderate');
        expect(suggestedGrade('plaie_arme_feu', row('plaie_arme_feu', 'thorax', { precisions: [GUNSHOT_VEST_PRECISION] }))).toBe('Light');
    });
    test('la gravité choisie l’emporte sur la proposition ; la pire est retenue', () => {
        expect(gradeOfRow(row('plaie_arme_feu', 'cuisse', { grade: 'Moderate' }))).toBe('Moderate');
        expect(worstGrade(form([row('plaie_superficielle', 'main'), row('plaie_arme_feu', 'cou')]))).toBe('Critical');
        expect(worstGrade({})).toBe('');
    });
    test('la gravité s’imprime dans la localisation', () => {
        expect(injuryLines(form([row('fracture_fermee', 'jambe')]))[0]).toContain('gravité modérée');
    });
});

describe('gestes, hémorragie et convalescence', () => {
    test('membre blessé à partir de « modérée » : attelle ; plaie superficielle : rien', () => {
        expect(limbsToSplint(form([row('fracture_fermee', 'jambe')]))).toEqual(['jambe droit(e)']);
        expect(limbsToSplint(form([row('plaie_superficielle', 'main')]))).toEqual([]);
        expect(gameplayRoutineCare(form([row('fracture_fermee', 'jambe')]))).toContain('Splint');
    });
    test('saignement actif sur un membre : garrot ; ailleurs : pansement compressif', () => {
        const limb = form([row('plaie_arme_feu', 'cuisse', { precisions: ['Saignement actif'] })]);
        expect(hasActiveBleeding(limb)).toBe(true);
        expect(gameplayRoutineCare(limb)).toContain('Tourniquet');
        expect(gameplayCareSteps(limb)[0]).toMatch(/garrot/);
        const trunk = form([row('plaie_arme_blanche', 'abdomen')], { bleedingState: 'Active' });
        expect(gameplayRoutineCare(trunk)).toContain('HemostaticDressing');
        expect(hasActiveBleeding({ ...limb, bleedingState: 'Controlled' })).toBe(false);
    });
    test('convalescence : blessure grave ou hospitalisation, jamais pour un patient décédé', () => {
        expect(needsConvalescence(form([row('plaie_arme_feu', 'cuisse')]))).toBe(true);
        expect(needsConvalescence(form([row('plaie_superficielle', 'main')]))).toBe(false);
        expect(needsConvalescence({ dischargeDestination: 'Ward' })).toBe(true);
        expect(needsConvalescence({ ...form([row('plaie_arme_feu', 'cuisse')]), careDeceased: 'Yes' })).toBe(false);
    });
});

describe('ordonnance : heures de prise et limites du jeu', () => {
    test('heures fixes selon le nombre de prises', () => {
        expect(intakeHoursPhrase(1)).toBe('à 9 h');
        expect(intakeHoursPhrase(3)).toBe('à 8 h, 14 h et 20 h');
        expect(intakeHoursPhrase(6)).toBe('à 8 h, 10 h 30, 13 h, 15 h 30, 18 h et 20 h 30');
        expect(intakeHoursPhrase(8)).toBe('');
    });
    test('la ligne d’ordonnance imprime les heures', () => {
        const text = prescriptionText({ medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, days: 5, prescribed: true });
        expect(text).toContain('à 8 h, 14 h et 20 h');
        expect(text).toContain('pendant 5 jours');
    });
    test('6 prises, 30 jours et 30 unités au plus', () => {
        expect(prescriptionQuantity({ count: 3, days: 5 })).toBe(15);
        expect(prescriptionLimitMessages({ prescribed: true, count: 3, days: 5 })).toEqual([]);
        const many = prescriptionLimitMessages({ prescribed: true, count: 8, days: 40 }).map((m) => m.text).join(' ');
        expect(many).toMatch(/6 prises par jour/);
        expect(many).toMatch(/30 jours/);
        expect(many).toMatch(/30 au plus/);
        expect(prescriptionLimitMessages({ prescribed: false, count: 8, days: 40 })).toEqual([]);
        const checked = checkPrescription({ medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, days: 20, prescribed: true }, { patient: { ageYears: 30, weightKg: 75 } });
        expect(checked.messages.some((m) => /60 unités/.test(m.text))).toBe(true);
    });
});

describe('rapports', () => {
    test('hémorragie et moyen d’arrêt dans les constatations', () => {
        const bb = bleedingBBCode({ bleedingState: 'Controlled', bleedingControl: ['Tourniquet', 'Dressing'] });
        expect(bb).toContain('[cbc] Contrôlée');
        expect(bb).toContain('Garrot, Pansement compressif / hémostatique');
        expect(bleedingBBCode({})).toBe('');
    });
    test('bilan ABCDE reconstitué à partir des constatations', () => {
        const bb = abcdeBBCode({ breathing: 'patientBreathingNormal', spo2Value: '96', heartRateValue: '110', bloodPressureValue: '100/60', gcsScore: '14', pupils: 'patientPupilsNormal', bleedingState: 'Active' });
        expect(bb).toContain('A — Voies aériennes');
        expect(bb).toContain('SpO2 96 %');
        expect(bb).toContain('hémorragie active');
        expect(bb).toContain('Glasgow 14/15');
        expect(abcdeBBCode({ gcsScore: '15' })).toBe('');
    });
    test('rendez-vous de suivi : seulement pour un suivi recommandé ou électif', () => {
        const f = { followup: 'Recommended', followupDate: '2026-12-01', followupTime: '15:00', followupPlace: 'LsfdStation', followupSms: true };
        expect(followupAppointmentBBCode(f)).toContain('le 01/12/2026 à 15:00 — Caserne du LSFD (convocation envoyée par SMS)');
        expect(followupAppointmentBBCode({ ...f, followup: 'AsNeeded' })).toBe('');
        expect(needsFollowupAppointment({ ...f, careDeceased: 'Yes' })).toBe(false);
        expect(generateConsultationNotesPHMC({ ...f, date: '2026-11-25' })).toContain('Rendez-vous de suivi');
    });
    test('urgences : groupage, convalescence, hémorragie et suivi dans le protocole', () => {
        const extras = emergencyExtrasBBCode({ ...form([row('plaie_arme_feu', 'cuisse')]), routineCare: ['BloodTyping', 'Splint'], bloodTypeResult: 'A-', dischargeDestination: 'Home' });
        expect(extras).toContain('Groupe sanguin (groupage)');
        expect(extras).toContain('A-');
        expect(extras).toContain('Convalescence');
        expect(extras).toContain('Attelle (membre)');
        const bb = generateEmergencyProtocol({ ...form([row('plaie_arme_feu', 'cuisse')]), bleedingState: 'Active', followup: 'Recommended', followupDate: '2026-12-01', followupPlace: 'PillboxHill', breathing: 'patientBreathingNormal', gcsScore: '15' });
        expect(bb).toContain('Hémorragie:');
        expect(bb).toContain('Bilan ABCDE');
        expect(bb).toContain('Rendez-vous de suivi');
    });
    test('nouvelles listes : modes d’arrivée et gestes du jeu', () => {
        expect(ARRIVAL_MODES.map((m) => m.value)).toEqual(expect.arrayContaining(['OnSiteCare', 'PoliceFirstAid', 'HospitalRequest']));
        expect(ROUTINE_CARE.map((m) => m.value)).toEqual(expect.arrayContaining(['Tourniquet', 'HemostaticDressing', 'Splint', 'BloodTyping', 'CapillaryGlucose']));
    });
    test('avis H.I.P.A.A. : dossier partagé avec le LSFD, police limitée au rapport d’intervention', () => {
        const bb = generateHipaaNotice();
        expect(bb).toContain('Los Santos Fire Department (LSFD)');
        expect(bb).toContain('Chaque consultation de votre dossier est enregistrée');
        expect(bb).toContain('seul le rapport d\'intervention');
    });
});

describe('hémorragie déduite des blessures renseignées', () => {
    const { bleedingFromInjuries } = require('./gameplay');
    const form = (rows, conditions = ['plaie_arme_feu']) => ({ clinicalConditions: conditions, injuryDetails: rows.map((row) => ({ conditionId: conditions[0], region: 'cuisse', ...row })) });
    test('« Saignement actif » : hémorragie active', () => {
        expect(bleedingFromInjuries(form([{ precisions: ['Saignement actif'] }]))).toEqual({ state: 'Active', control: [] });
    });
    test('garrot ou pansement compressif posé : hémorragie contrôlée, avec son moyen d’arrêt', () => {
        expect(bleedingFromInjuries(form([{ precisions: ['Garrot posé'] }, { precisions: ['Pansement compressif'] }]))).toEqual({ state: 'Controlled', control: ['Tourniquet', 'Dressing'] });
        expect(bleedingFromInjuries(form([{ precisions: ['Saignement contrôlé'] }]))).toEqual({ state: 'Controlled', control: [] });
    });
    test('un saignement actif l’emporte sur un saignement contrôlé ailleurs ; le motif « hémorragie externe » seul est actif', () => {
        expect(bleedingFromInjuries(form([{ precisions: ['Saignement actif'] }, { precisions: ['Garrot posé'] }])).state).toBe('Active');
        expect(bleedingFromInjuries({ clinicalConditions: ['hemorragie_externe'] }).state).toBe('Active');
        expect(bleedingFromInjuries({ clinicalConditions: ['hemorragie_externe'], injuryDetails: [{ conditionId: 'hemorragie_externe', precisions: ['Garrot posé'] }] }).state).toBe('Controlled');
    });
    test('rien de renseigné sur le saignement : on ne devine pas', () => {
        expect(bleedingFromInjuries(form([{ precisions: ['Balle logée palpable'] }]))).toEqual({ state: '', control: [] });
        expect(bleedingFromInjuries({})).toEqual({ state: '', control: [] });
    });
});

describe('« Constatations » de Pilou : hémorragie', () => {
    const { sectionPatch } = require('./apply');
    const suggestion = { findings: { findings: 'Altéré' }, bleeding: { state: 'Controlled', control: ['Tourniquet'] } };
    test('protocole d’urgence : l’état et le moyen d’arrêt de l’hémorragie sont posés ; consultation : jamais', () => {
        expect(sectionPatch('findings', suggestion, 'emergency')).toEqual({ findings: 'Altéré', bleedingState: 'Controlled', bleedingControl: ['Tourniquet'] });
        expect(sectionPatch('findings', suggestion, 'consult')).toEqual({ findings: 'Altéré' });
        expect(sectionPatch('findings', { findings: { findings: 'Altéré' }, bleeding: { state: '', control: [] } }, 'emergency')).toEqual({ findings: 'Altéré' });
    });
});
