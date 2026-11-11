import {
    minutesBetween, durationLabel, aptitudeValidUntil, emergencyContactChanges, changedBackgroundFields, validateCareExtras,
} from './careFormRules';
import generateSurgicalOps from '../phmc-bbcode-generators/generateSurgicalOps';
import generatePhysEvalInternalMed from '../phmc-bbcode-generators/generatePhysEvalInternalMed';
import generateMentalHealthPHMC from '../phmc-bbcode-generators/generateMentalHealthPHMC';
import generatePsychEvalPBC from '../phmc-bbcode-generators/generatePsychEvalPBC';
import generateEmergencyProtocol from '../phmc-bbcode-generators/generateEmergencyProtocol';
import generateConsultationNotesPHMC from '../phmc-bbcode-generators/generateConsultationNotesPHMC';
import generateConsultationNotesPBC from '../phmc-bbcode-generators/generateConsultationNotesPBC';

describe('règles des champs ajoutés aux formulaires de soins', () => {
    test('durée de prise en charge, y compris quand elle passe minuit', () => {
        expect(minutesBetween('14:35', '15:20')).toBe(45);
        expect(minutesBetween('23:30', '00:15')).toBe(45);
        expect(minutesBetween('', '15:20')).toBeNull();
        expect(durationLabel(45)).toBe('45 min');
        expect(durationLabel(135)).toBe('2 h 15 min');
    });

    test("validité d'une aptitude : 12 mois par défaut, rien si inapte", () => {
        expect(aptitudeValidUntil({ aptitudeConclusion: 'Apte', date: '2026-11-11' })).toBe('2027-11-11');
        expect(aptitudeValidUntil({ aptitudeConclusion: 'Apte', date: '2026-11-11', aptitudeValidityMonths: '6' })).toBe('2027-05-11');
        expect(aptitudeValidUntil({ aptitudeConclusion: 'Inapte', date: '2026-11-11' })).toBe('');
    });

    test("le contact d'urgence : seules les différences avec le dossier sont retenues", () => {
        const dossier = { patientEmergencyContactFirstName: 'Marie', patientEmergencyContactLastName: 'Testard', patientEmergencyContactNumber: '555-0199', patientEmergencyContactRelation: 'Épouse' };
        expect(emergencyContactChanges(dossier, { ...dossier })).toEqual({});
        expect(emergencyContactChanges(dossier, { ...dossier, patientEmergencyContactNumber: '555-0200' })).toEqual({ patientEmergencyContactNumber: '555-0200' });
        // champ vidé dans le formulaire alors que le dossier le connaît : on le vide aussi
        expect(emergencyContactChanges(dossier, { ...dossier, patientEmergencyContactRelation: '' })).toEqual({ patientEmergencyContactRelation: '' });
        // pas de dossier, ou formulaire sans contact : rien à mettre à jour
        expect(emergencyContactChanges(null, dossier)).toEqual({});
        expect(emergencyContactChanges(dossier, {})).toEqual({});
    });

    test('allergies, antécédents ou traitements corrigés par rapport au dossier', () => {
        const dossier = { patientAllergies: 'Pénicilline', patientChronicDiseases: 'Asthme', patientCurrentMedicine: '' };
        expect(changedBackgroundFields(dossier, { patientAllergies: 'Pénicilline', patientChronicDiseases: 'Asthme' })).toEqual([]);
        expect(changedBackgroundFields(dossier, { patientAllergies: 'Pénicilline, latex', patientChronicDiseases: 'Asthme' })).toEqual(['patientAllergies']);
        expect(changedBackgroundFields(null, { patientAllergies: 'x' })).toEqual([]);
    });

    test('contrôles : conduite à tenir, contrainte, transfert, restrictions, arrêt de travail', () => {
        expect(validateCareExtras(14, { riskSuicide: 'High' })).toContain('Un risque modéré ou plus demande une conduite à tenir.');
        expect(validateCareExtras(14, { riskSuicide: 'Low' })).toEqual([]);
        expect(validateCareExtras(28, { riskDanger: 'Moderate', riskAction: 'CloseFollowUp' })).toEqual([]);
        expect(validateCareExtras(16, { involuntaryHold: 'Imminent', admission: 'No' })).toHaveLength(1);
        expect(validateCareExtras(19, { dischargeDestination: 'Transfer' })).toContain("Indiquez l'établissement de transfert.");
        expect(validateCareExtras(6, { aptitudeConclusion: 'Apte avec restrictions' })).toContain("Précisez les restrictions d'aptitude.");
        expect(validateCareExtras(20, { workStoppage: 'Yes' })).toContain('Arrêt de travail : indiquez sa durée en jours.');
        expect(validateCareExtras(5, { referralReason: 'Other' })).toContain("Motif d'adressage « Autre » : précisez-le.");
        expect(validateCareExtras(1, { riskSuicide: 'High' })).toEqual([]);
    });
});

describe('BBCode des champs ajoutés', () => {
    const base = { patientName: 'Jean Testard', patientID: 'PHMC-2752', date: '2026-11-11', phmcEmployee: 'Dr. Rose Callahan', phmcRank: 'Médecin Titulaire' };

    test('adressage, heure et accompagnant dans le contexte patient, avec la mention de mise à jour du fond médical', () => {
        const bb = generateConsultationNotesPHMC({ ...base, appointmentTime: '14:30', referralReason: 'Emergency', referringDoctor: 'Dr. Externe', companionName: 'Marie', companionRelation: 'Épouse', patientBackgroundUpdated: ['allergies'] });
        expect(bb).toContain('[u]Heure du rendez-vous: [/u] 14:30');
        expect(bb).toContain("[u]Motif d'adressage: [/u] Adressé par les secours (EMS / 911)");
        expect(bb).toContain('[u]Médecin adressant: [/u] Dr. Externe');
        expect(bb).toContain('[u]Accompagnant: [/u] Marie (Épouse)');
        expect(bb).toContain('Mis à jour lors de cette consultation : allergies.');
    });

    test('un ancien rapport (sans les nouveaux champs) s\'imprime comme avant', () => {
        const bb = generateConsultationNotesPHMC(base);
        expect(bb).not.toContain("Motif d'adressage");
        expect(bb).not.toContain('Service orienté');
        expect(bb).not.toContain('Mis à jour lors de cette consultation');
    });

    test('opération : caractère, ASA, surveillance et examens post-opératoires', () => {
        const bb = generateSurgicalOps({ ...base, surgeryCharacter: 'Urgent', surgeryAsa: 'ASA3', postOpMonitoring: 'Icu', postOpExams: 'Radio de contrôle' });
        expect(bb).toContain("Caractère de l'intervention");
        expect(bb).toContain('Urgente');
        expect(bb).toContain('ASA 3 : maladie systémique sévère');
        expect(bb).toContain('Surveillance post-opératoire');
        expect(bb).toContain('Soins intensifs / réanimation');
        expect(bb).toContain('Radio de contrôle');
        const assisted = generateSurgicalOps({ ...base, patientWeight: '75', patientHeight: '178', clinicalMeds: [{ medId: 'paracetamol', regimenId: 'iv', dose: 1000, count: 4, note: '' }], postOpMonitoring: 'RecoveryRoom' });
        expect(assisted).toContain('Poids / taille du patient');
        expect(assisted).toContain('75 kg / 178 cm');
        expect(assisted).toContain('Médicaments post-opératoires');
        expect(assisted).toContain('• Paracétamol 1 000 mg — IV, 4 prises/24 h (toutes les 6 h)');
    });

    test("évaluation physique : conclusion d'aptitude avec restrictions et validité", () => {
        const bb = generatePhysEvalInternalMed({ ...base, evalReason: 'Hiring', aptitudeConclusion: 'Apte avec restrictions', aptitudeRestrictions: 'Pas de travail en hauteur', aptitudeValidityMonths: '6', vaccinationState: 'No', vaccinationNote: 'Tétanos' });
        expect(bb).toContain("Conclusion d'aptitude");
        expect(bb).toContain('Embauche');
        expect(bb).toContain('APTE AVEC RESTRICTIONS');
        expect(bb).toContain('Pas de travail en hauteur');
        expect(bb).toContain("Valable jusqu'au[/td][td]11/05/2027 (6 mois)");
        expect(bb).toContain('Non, incomplètes : Tétanos');
    });

    test('santé mentale : risque, conduite à tenir, contrainte et contact d\'urgence (PHMC et PBC)', () => {
        const mental = { ...base, riskSuicide: 'High', riskDanger: 'None', riskAction: 'InvoluntaryAdmission', involuntaryHold: 'ThirdParty', admission: 'Yes', patientEmergencyContactFirstName: 'Marie', patientEmergencyContactLastName: 'Testard', patientEmergencyContactRelation: 'Épouse', patientEmergencyContactNumber: '555-0199' };
        [generateMentalHealthPHMC(mental), generatePsychEvalPBC(mental)].forEach((bb) => {
            expect(bb).toContain('Risque suicidaire');
            expect(bb).toContain('Risque élevé');
            expect(bb).toContain('Hospitalisation sous contrainte');
            expect(bb).toContain("Oui : à la demande d'un tiers");
            expect(bb).toContain("Contact d'urgence");
            expect(bb).toContain('Marie Testard (Épouse)');
            expect(bb).toContain('555-0199');
        });
    });

    test("urgences : modes d'arrivée précis, durée de prise en charge, orientation et soins systématiques", () => {
        const bb = generateEmergencyProtocol({ ...base, arrivalMode: 'Helicopter', careStartTime: '23:30', careEndTime: '00:15', dischargeDestination: 'Transfer', transferTo: 'Pillbox Nord', routineCare: ['Tetanus', 'Dressing'] });
        expect(bb).toContain('Arrivée: [/u] Hélicoptère');
        expect(bb).toContain('de 23:30 à 00:15 (45 min)');
        expect(bb).toContain('Transfert vers un autre établissement : Pillbox Nord');
        expect(bb).toContain('Antitétanique (rappel), Pansement / suture');
    });

    test('consultation générale : service orienté, examens prescrits, arrêt de travail', () => {
        const bb = generateConsultationNotesPHMC({ ...base, orientedService: 'Cardiology', examsOrdered: ['Ecg', 'Blood'], examsOrderedNote: 'À jeun', workStoppage: 'Yes', workStoppageDays: '3' });
        expect(bb).toContain('Service orienté après consultation: [/u] Cardiologie');
        expect(bb).toContain('ECG, Bilan sanguin : À jeun');
        expect(bb).toContain('Arrêt de travail: [/u] Oui, 3 jour(s)');
    });
    test("urgences : motifs, poids et taille, médicaments de l'assistant clinique", () => {
        const bb = generateEmergencyProtocol({
            ...base, patientWeight: '75', patientHeight: '1,78 m', clinicalConditions: ['fracture_fermee', 'plaie_superficielle'], clinicalSeverity: 'Severe',
            clinicalMeds: [{ medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, note: '' }, { medId: 'morphine', regimenId: 'iv', dose: 3, count: 1, note: 'titration' }],
        });
        expect(bb).toContain("[u]Motifs de prise en charge: [/u] Fracture fermée d'un membre, Plaie superficielle / coupure (gravité : sévère)");
        expect(bb).toContain('[u]Poids / taille: [/u] 75 kg / 178 cm');
        expect(bb).toContain('[u]Médicaments administrés: [/u]');
        expect(bb).toContain('• Paracétamol 1 000 mg — PO, 3 prises/24 h (toutes les 6 h)');
        expect(bb).toContain('• Morphine 3 mg — IV (titration) (titration)');
        // un ancien rapport s'imprime comme avant
        const old = generateEmergencyProtocol(base);
        expect(old).not.toContain('Motifs de prise en charge');
        expect(old).not.toContain('Médicaments administrés');
    });
    test("consultation générale : motifs, poids et médicaments de l'assistant (PHMC et PBC)", () => {
        const data = { ...base, patientChiefComplaint: 'Douleur', patientWeight: '60', clinicalConditions: ['migraine'], clinicalSeverity: 'Mild', clinicalMeds: [{ medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 2, note: '' }] };
        [generateConsultationNotesPHMC(data), generateConsultationNotesPBC({ ...data, patientName: 'Jean Testard', patientDiagnosis: 'x', patientSecondaryDiagnosis: 'x', patientProcedure: 'x', patientNotes: 'x', patientMedicine: 'x' })].forEach((bb) => {
            expect(bb).toContain('[u]Motifs de prise en charge: [/u] Migraine / céphalée (gravité : légère)');
            expect(bb).toContain('• Paracétamol 1 000 mg — PO, 2 prises/24 h (toutes les 6 h)');
        });
    });
});
