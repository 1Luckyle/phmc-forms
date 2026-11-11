jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import generateEmergencyProtocol from '../phmc-bbcode-generators/generateEmergencyProtocol';
import generateSurgicalOps from '../phmc-bbcode-generators/generateSurgicalOps';
import { postOpBBCode } from '../phmc-bbcode-generators/shared/careExtras';
import { hasPrescription, prescriptionOfReport } from '../phmc-bbcode-generators/generatePrescription';
import { prescriptionLines, prescriptionPlainText, clinicalMedLines, sectionsFor, applyAll } from '../clinical/apply';
import { clinicalWarnings } from '../clinical/engine';
import { careVisitSummary } from './careVisitSummary';
import { isDeceased } from '../constants/careFormOptions';

const iv = { medId: 'paracetamol', regimenId: 'iv', dose: 1000, count: 4, note: '' };
const po = { medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, note: '', prescribed: true, days: 5, startDate: '2026-11-11' };
const base = {
    patientName: 'Jean Test', patientID: 'PHMC-1', date: '2026-11-11', phmcEmployee: 'Dr. Interne', phmcRank: 'Médecin Titulaire', clinicalMeds: [iv, po],
    admission: 'Yes', followup: 'Recommended', patientMedicine: 'Repos et hydratation', patientProcedure: 'Réanimation', dischargeDestination: 'ObservationBox',
    postOpMonitoring: 'Icu', postOpExams: 'Radio de contrôle', surgeryPostOpInstructions: 'Pansement à refaire', patientAddress: 'Réveil en salle', patientSummary: 'Intervention en urgence', patientSummaryConsultation: 'Anesthésie générale',
};
const dead = { ...base, careDeceased: 'Yes', careDeathTime: '15:12', careDeathCause: 'Choc hémorragique', careDeathManner: 'Accidental', careDeathResuscitation: 'Attempted', careDeathBody: 'Coroner' };

describe('patient décédé : aucune prescription, suite ni suivi', () => {
    test('protocole d’urgence : ni admission, ni traitement, ni ordonnance, ni suivi ; les médicaments administrés et le décès restent', () => {
        const alive = generateEmergencyProtocol(base);
        ['Admission:', 'Médicaments/Traitements', 'Repos et hydratation', 'Suivi:', 'Ordonnance (prescrite par'].forEach((text) => expect(alive).toContain(text));
        const bb = generateEmergencyProtocol(dead);
        ['Admission:', 'Médicaments/Traitements', 'Repos et hydratation', 'Suivi:', 'Ordonnance', 'Recommandé'].forEach((text) => expect(bb).not.toContain(text));
        expect(bb).toContain('Médicaments administrés');
        expect(bb).toContain('Procédure/Texte libre');
        expect(bb).toContain('Réanimation');
        expect(bb).toContain('Décès du patient');
        expect(bb).toContain('Heure du décès[/td][td]15:12');
    });

    test('opération : ni détails d’anesthésie post-opératoire, ni surveillance, ni ordonnance, ni consignes ; le résumé et le décès restent', () => {
        const alive = generateSurgicalOps(base);
        ['Détails d\'anesthésie post-opératoire', 'Surveillance post-opératoire', 'Radio de contrôle', 'Consignes post-opératoires', 'Pansement à refaire', 'Ordonnance'].forEach((text) => expect(alive).toContain(text));
        const bb = generateSurgicalOps(dead);
        ['Détails d\'anesthésie post-opératoire', 'Réveil en salle', 'Surveillance post-opératoire', 'Radio de contrôle', 'Consignes post-opératoires', 'Pansement à refaire', 'Ordonnance'].forEach((text) => expect(bb).not.toContain(text));
        expect(bb).toContain("Type et dosage d'anesthésie administrée");
        expect(bb).toContain('Intervention en urgence');
        expect(bb).toContain('Décès du patient');
        expect(postOpBBCode(dead)).toBe('');
        expect(postOpBBCode(base)).not.toBe('');
    });

    test('plus d’ordonnance : lignes, texte brut, document séparé et alertes de dose', () => {
        expect(isDeceased(dead)).toBe(true);
        expect(isDeceased(base)).toBe(false);
        expect(prescriptionLines(base)).toHaveLength(1);
        expect(prescriptionLines(dead)).toEqual([]);
        expect(prescriptionPlainText(dead)).toBe('');
        expect(hasPrescription(dead)).toBe(false);
        expect(prescriptionOfReport({ bbCodeVersion: 19, data: dead })).toBeNull();
        expect(prescriptionOfReport({ bbCodeVersion: 19, data: base })).not.toBeNull();
        expect(clinicalMedLines(dead)).toHaveLength(1);
        // Le cumul de 7 000 mg (perfusion + ordonnance) n'a plus lieu d'être : l'ordonnance n'existe pas.
        expect(clinicalWarnings({ ...base, patientAgeYears: '35', patientSex: 'Male', patientWeight: '75' }).join(' ')).toMatch(/cumulés/);
        expect(clinicalWarnings({ ...dead, patientAgeYears: '35', patientSex: 'Male', patientWeight: '75' }).join(' ')).not.toMatch(/cumulés/);
    });

    test('historique des soins : seuls les médicaments administrés', () => {
        expect(careVisitSummary(19, { ...dead, clinicalMeds: [iv, { ...po, medId: 'ketoprofene' }] }).traitement).toBe('Paracétamol');
        expect(careVisitSummary(19, { ...base, clinicalMeds: [iv, { ...po, medId: 'ketoprofene' }] }).traitement).toMatch(/Paracétamol, /);
    });

    test('Pilou : plus d’orientation de sortie ni de conseils quand le patient est décédé', () => {
        expect(sectionsFor('emergency').map((s) => s.key)).toContain('outcome');
        expect(sectionsFor('emergency', { deceased: true }).map((s) => s.key)).not.toContain('outcome');
        expect(sectionsFor('emergency', { deceased: true }).map((s) => s.key)).toContain('meds');
        const suggestions = { patientPatch: {}, vitals: { fields: {}, categories: {} }, severity: { index: 3 }, text: { advice: 'Conseils de sortie' }, admission: 'Yes', followup: 'Recommended', destination: 'Home', meds: [], findings: {}, imaging: [], exams: { lab: [] }, routineCare: [], igu: '' };
        const next = applyAll({ careDeceased: 'Yes' }, suggestions, false, 'emergency', { now: '15:00' });
        ['admission', 'followup', 'dischargeDestination', 'patientMedicine'].forEach((field) => expect(next[field]).toBeUndefined());
        const alive = applyAll({}, suggestions, false, 'emergency', { now: '15:00' });
        expect(alive).toMatchObject({ admission: 'Yes', followup: 'Recommended', patientMedicine: 'Conseils de sortie' });
    });
});
