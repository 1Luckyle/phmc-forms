import { PROCEDURES, PROCEDURE_BY_ID, PROCEDURE_GROUPS } from './procedures';
import { MEDICATION_BY_ID, regimenOf } from './medications';
import { buildSurgerySuggestions, estimateAsa, procedureList } from './surgery';
import { checkPrescription } from './engine';

const adult = { ageYears: 35, sex: 'Male', weightKg: 75, heightCm: 178, allergies: '', chronic: '', currentMeds: '' };
const child = { ageYears: 8, sex: 'Female', weightKg: 25, heightCm: 128, allergies: '', chronic: '', currentMeds: '' };
const senior = { ageYears: 80, sex: 'Female', weightKg: 60, heightCm: 160, allergies: '', chronic: 'Diabète, hypertension', currentMeds: '' };

describe("catalogue d'interventions", () => {
    test('identifiants uniques, champs complets et médicaments qui existent', () => {
        expect(new Set(PROCEDURES.map((p) => p.id)).size).toBe(PROCEDURES.length);
        expect(PROCEDURES.length).toBeGreaterThanOrEqual(25);
        PROCEDURES.forEach((p) => {
            ['label', 'indication', 'name', 'postOpExams', 'instructions'].forEach((key) => expect(p[key]).toBeTruthy());
            expect(['General', 'Regional', 'Sedation', 'Local']).toContain(p.anesthesia);
            expect(['Home', 'ObservationBox', 'Ward', 'RecoveryRoom', 'Icu']).toContain(p.monitoring);
            expect(p.duration).toBeGreaterThan(0);
            expect(p.steps.length).toBeGreaterThan(1);
            p.postOpMeds.forEach(([medId, regimenId]) => { expect(MEDICATION_BY_ID[medId]).toBeDefined(); expect(regimenOf(medId, regimenId)).not.toBeNull(); });
        });
        expect(PROCEDURE_GROUPS.flatMap((g) => g.options)).toHaveLength(PROCEDURES.length);
    });
});

describe('suggestions chirurgicales', () => {
    test('aucune sans intervention', () => {
        expect(buildSurgerySuggestions({ procedureIds: [], patient: adult })).toBeNull();
        expect(procedureList(['inconnu'])).toEqual([]);
    });

    test('appendicectomie d\'un adulte : champs, anesthésie générale dosée, antibioprophylaxie, médicaments post-op', () => {
        const s = buildSurgerySuggestions({ procedureIds: ['appendicectomie'], patient: adult });
        expect(s.fields.intervention).toMatchObject({ surgeryProcedures: 'Appendicectomie par cœlioscopie', surgeryCharacter: 'Urgent', surgeryAnesthesiaType: 'General', surgeryDuration: '45', surgeryBloodLoss: '30' });
        const anesthesia = s.fields.anesthesia.patientSummaryConsultation;
        expect(anesthesia).toContain('Anesthésie générale avec intubation orotrachéale');
        expect(anesthesia).toContain('- induction : Propofol 150 mg — IV (induction)');
        expect(anesthesia).toContain('- curarisation : Rocuronium 45 mg — IV');
        expect(anesthesia).toContain("- décurarisation en fin d'intervention : Sugammadex 150 mg — IV");
        expect(anesthesia).toContain("- antibioprophylaxie avant l'incision : Céfazoline 2 000 mg — IV");
        expect(s.fields.risk.surgeryAsa).toBe('ASA1');
        expect(s.fields.postop.postOpMonitoring).toBe('RecoveryRoom');
        expect(s.fields.summary.patientSummary).toMatch(/^Intervention réalisée sous anesthésie générale/);
        expect(s.postOpMeds.map((m) => m.medId)).toEqual(['paracetamol', 'ketoprofene', 'ondansetron']);
        expect(s.postOpMeds[0]).toMatchObject({ dose: 1000, count: 4 });
    });

    test('plusieurs interventions : noms réunis, anesthésie la plus lourde, durée avec gain, pertes cumulées', () => {
        const s = buildSurgerySuggestions({ procedureIds: ['suture_complexe', 'laparotomie'], patient: adult });
        expect(s.fields.intervention.surgeryProcedures).toBe('Exploration, parage et suture de plaie + Laparotomie exploratrice avec hémostase');
        expect(s.anesthesiaType).toBe('General');
        expect(Number(s.fields.intervention.surgeryDuration)).toBe(170);
        expect(s.fields.intervention.surgeryBloodLoss).toBe('830');
        expect(s.fields.risk.surgeryAsa).toBe('ASA3');
        expect(s.fields.postop.postOpMonitoring).toBe('Icu');
        expect(s.fields.summary.patientSummary).toContain('Exploration, parage et suture de plaie :\n- ');
    });

    test('rachianesthésie pour la césarienne ; bloc nerveux pour la main ; locale pour la suture', () => {
        expect(buildSurgerySuggestions({ procedureIds: ['cesarienne'], patient: { ...adult, sex: 'Female' } }).fields.anesthesia.patientSummaryConsultation).toContain('Bupivacaïne 12 mg — Rachianesthésie');
        expect(buildSurgerySuggestions({ procedureIds: ['reparation_tendon'], patient: adult }).fields.anesthesia.patientSummaryConsultation).toContain('Bupivacaïne 100 mg — Bloc nerveux');
        expect(buildSurgerySuggestions({ procedureIds: ['suture_complexe'], patient: adult }).fields.anesthesia.patientSummaryConsultation).toContain('Lidocaïne 1 % (anesthésie locale) 5 mL');
    });

    test("un enfant ne reçoit pas de rachianesthésie : repli sur l'anesthésie générale avec la raison", () => {
        const s = buildSurgerySuggestions({ procedureIds: ['hernie'], patient: child });
        expect(s.anesthesiaType).toBe('General');
        expect(s.skipped.some((x) => x.medId === 'bupivacaine' && /impossible/.test(x.reasons[0]))).toBe(true);
        expect(s.fields.anesthesia.patientSummaryConsultation).toContain('Propofol 50 mg');
    });

    test("allergie à un produit d'anesthésie : produit écarté et signalé", () => {
        const s = buildSurgerySuggestions({ procedureIds: ['appendicectomie'], patient: { ...adult, allergies: 'Allergie aux curares et à la pénicilline' } });
        expect(s.fields.anesthesia.patientSummaryConsultation).not.toContain('Rocuronium');
        expect(s.skipped.some((x) => x.medId === 'rocuronium')).toBe(true);
    });

    test('terrain : ASA selon antécédents, corpulence et âge', () => {
        const p = PROCEDURES.filter((x) => x.id === 'appendicectomie');
        expect(estimateAsa(adult, p)).toBe('ASA1');
        expect(estimateAsa({ ...adult, chronic: 'Asthme' }, p)).toBe('ASA2');
        expect(estimateAsa({ ...adult, weightKg: 130 }, p)).toBe('ASA3');
        expect(estimateAsa({ ...adult, chronic: 'Insuffisance cardiaque, BPCO' }, p)).toBe('ASA4');
        expect(estimateAsa(senior, p)).toBe('ASA3');
        expect(estimateAsa({ ...adult, ageYears: 80 }, p)).toBe('ASA2');
        expect(buildSurgerySuggestions({ procedureIds: ['appendicectomie'], patient: { ...adult, chronic: 'Insuffisance cardiaque, BPCO' } }).fields.postop.postOpMonitoring).toBe('Icu');
        expect(estimateAsa(adult, [PROCEDURE_BY_ID.thoracotomie])).toBe('ASA4');
    });

    test('chaque intervention produit des suggestions complètes et sûres pour un adulte, un enfant et une personne âgée', () => {
        [adult, child, senior].forEach((patient) => PROCEDURES.forEach((p) => {
            const s = buildSurgerySuggestions({ procedureIds: [p.id], patient });
            expect(s).not.toBeNull();
            Object.values(s.fields).forEach((fields) => Object.values(fields).forEach((value) => expect(String(value).trim()).not.toBe('')));
            expect(s.fields.anesthesia.patientSummaryConsultation).toMatch(/Anesthésie|Rachianesthésie|Sédation/);
            expect(Number(s.fields.intervention.surgeryDuration)).toBeGreaterThan(0);
            s.postOpMeds.forEach((m) => expect(checkPrescription(m, { patient }).level).not.toBe('error'));
        }));
    });
});
