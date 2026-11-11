import { MEDICATIONS, MEDICATION_BY_ID, regimenOf } from './medications';
import { CONDITIONS, CONDITION_BY_ID, CONDITION_GROUPS } from './conditions';
import { restingVitals, estimateVitals, categorizeVitals, vitalsFormFields, vitalsFromForm } from './vitals';
import {
    findTerm, parseWeightKg, parseHeightCm, patientFromForm, doseOptions, checkPrescription, checkList, newEntry, entryText, buildSuggestions, clinicalWarnings, formatNumber, contextTags, conditionsOf,
} from './engine';

const adult = { ageYears: 35, sex: 'Male', weightKg: 75, heightCm: 178, allergies: '', chronic: '', currentMeds: '' };
const child = { ageYears: 8, sex: 'Female', weightKg: 25, heightCm: 128, allergies: '', chronic: '', currentMeds: '' };
const senior = { ageYears: 80, sex: 'Female', weightKg: 60, heightCm: 160, allergies: '', chronic: '', currentMeds: '' };
const entry = (medId, regimenId, dose, count = 1) => ({ medId, regimenId, dose, count });

describe('intégrité du référentiel', () => {
    test('identifiants uniques et schémas cohérents', () => {
        expect(new Set(MEDICATIONS.map((m) => m.id)).size).toBe(MEDICATIONS.length);
        expect(new Set(CONDITIONS.map((c) => c.id)).size).toBe(CONDITIONS.length);
        MEDICATIONS.forEach((m) => {
            expect(m.regimens.length).toBeGreaterThan(0);
            m.regimens.forEach((r) => {
                expect(r.unit).toBeTruthy();
                if (!r.weightBased) {
                    expect(r.adult).toBeDefined();
                    if (Array.isArray(r.adult)) {
                        const [min, usual, max] = r.adult;
                        expect(min <= usual && usual <= max).toBe(true);
                        if (r.maxSingle) expect(max).toBeLessThanOrEqual(r.maxSingle);
                    }
                }
                if (r.perKg) { const [min, usual, max] = r.perKg; expect(min <= usual && usual <= max).toBe(true); }
            });
        });
    });

    test('chaque motif cite des médicaments et schémas qui existent, et ses propres champs sont valides', () => {
        CONDITIONS.forEach((c) => {
            expect(c.label).toBeTruthy();
            expect(c.diagnosis).toBeTruthy();
            expect(c.steps.length).toBeGreaterThan(0);
            c.meds.forEach(([medId, regimenId, minSeverity = 0]) => {
                expect(MEDICATION_BY_ID[medId]).toBeDefined();
                expect(regimenOf(medId, regimenId)).not.toBeNull();
                expect(minSeverity >= 0 && minSeverity <= 3).toBe(true);
            });
        });
        expect(CONDITION_GROUPS.flatMap((g) => g.options)).toHaveLength(CONDITIONS.length);
    });

    test('les contextes cités par les médicaments existent dans au moins un motif', () => {
        const produced = new Set(CONDITIONS.flatMap((c) => c.tags));
        MEDICATIONS.forEach((m) => Object.keys(m.avoidTags || {}).forEach((tag) => expect(produced.has(tag)).toBe(true)));
    });
});

describe('texte, poids et taille', () => {
    test('mots entiers, accents et pluriels connus', () => {
        expect(findTerm('Allergie à la Pénicilline', ['pénicilline'])).toBe('pénicilline');
        expect(findTerm('Migraine chronique', ['aine', 'ains'])).toBe('');
        expect(findTerm('Allergique aux AINS', ['ains'])).toBe('ains');
        expect(findTerm('Prend du Xarelto', ['xarelto'])).toBe('xarelto');
        expect(findTerm('', ['x'])).toBe('');
    });
    test('poids et taille saisis librement', () => {
        expect(parseWeightKg('72 kg')).toBe(72);
        expect(parseWeightKg('72,5')).toBe(72.5);
        expect(parseWeightKg('0')).toBeNull();
        expect(parseHeightCm('1,80 m')).toBe(180);
        expect(parseHeightCm('178')).toBe(178);
        expect(parseHeightCm('abc')).toBeNull();
        expect(formatNumber(1000)).toBe('1 000');
        expect(formatNumber(0.25)).toBe('0,25');
    });
    test('patient lu depuis le formulaire (âge, sexe, poids, taille, antécédents)', () => {
        const patient = patientFromForm({ patientDateOfBirth: '1990-03-12', date: '2026-11-11', patientSex: 'Female', patientWeight: '60 kg', patientHeight: '1,65 m', patientAllergies: 'Latex' });
        expect(patient).toMatchObject({ ageYears: 36, sex: 'Female', weightKg: 60, heightCm: 165, allergies: 'Latex' });
    });
});

describe('constantes vitales', () => {
    test('valeurs de repos par âge, sexe et corpulence', () => {
        expect(restingVitals(adult).hr).toBe(74);
        expect(restingVitals({ ageYears: 0 }).hr).toBeGreaterThan(120);
        expect(restingVitals({ ageYears: 8 }).rr).toBeGreaterThan(restingVitals(adult).rr);
        expect(restingVitals({ ...adult, weightKg: 130 }).sbp).toBeGreaterThan(restingVitals(adult).sbp);
        expect(restingVitals({ ...adult, sex: 'Female' }).sbp).toBeLessThan(restingVitals(adult).sbp);
    });
    test('déterministe pour une même graine', () => {
        const c = conditionsOf(['sepsis']);
        expect(estimateVitals(adult, c, 'Moderate', 'PHMC-1|2026-11-11').values).toEqual(estimateVitals(adult, c, 'Moderate', 'PHMC-1|2026-11-11').values);
    });
    test('la gravité accentue les écarts, les catégories suivent', () => {
        const c = conditionsOf(['sepsis']);
        const mild = estimateVitals(adult, c, 'Mild', 'x').values;
        const critical = estimateVitals(adult, c, 'Critical', 'x').values;
        expect(critical.temp).toBeGreaterThan(mild.temp);
        expect(critical.hr).toBeGreaterThan(mild.hr);
        expect(critical.sbp).toBeLessThan(mild.sbp);
        const categories = categorizeVitals(critical, adult.ageYears);
        expect(categories).toMatchObject({ temperature: 'patientHyperthermic', heartRate: 'patientHeartRateTachycardia', bloodPressure: 'patientBloodPressureHypotension' });
    });
    test('surdose d\'opioïdes : respiration lente et saturation basse ; arrêt cardiaque : valeurs imposées', () => {
        const od = estimateVitals(adult, conditionsOf(['surdose_opioides']), 'Severe', 'x');
        expect(od.values.rr).toBeLessThan(10);
        expect(od.values.spo2).toBeLessThan(90);
        expect(od.values.gcs).toBeLessThan(10);
        expect(categorizeVitals(od.values, 35).breathing).toBe('patientBreathingSlow');
        const acr = estimateVitals(adult, conditionsOf(['arret_cardiaque']), 'Critical', 'x');
        expect(acr.values).toMatchObject({ hr: 0, rr: 0, gcs: 3 });
    });
    test('plusieurs motifs : le plus fort écart domine, sans cumul déraisonnable', () => {
        const alone = estimateVitals(adult, conditionsOf(['polytraumatisme']), 'Moderate', 'x').values;
        const both = estimateVitals(adult, conditionsOf(['polytraumatisme', 'hemorragie_externe']), 'Moderate', 'x').values;
        expect(both.hr).toBeGreaterThanOrEqual(alone.hr - 4);
        expect(both.hr).toBeLessThan(alone.hr + 25);
        expect(both.sbp).toBeGreaterThanOrEqual(40);
    });
    test('champs du formulaire et relecture', () => {
        const fields = vitalsFormFields({ hr: 88, sbp: 120, dbp: 78, rr: 16, spo2: 98, temp: 36.8, glu: 0.9, gcs: 15 });
        expect(fields).toMatchObject({ temperatureValue: '36,8', heartRateValue: '88', bloodPressureValue: '120/78', glucoseValue: '0,90', gcsScore: '15' });
        expect(vitalsFromForm(fields)).toMatchObject({ hr: 88, sbp: 120, dbp: 78, temp: 36.8, glu: 0.9, gcs: 15 });
    });
    test('toutes les constantes sont plausibles pour chaque motif, patient et gravité', () => {
        [adult, child, senior].forEach((patient) => ['Mild', 'Moderate', 'Severe', 'Critical'].forEach((severity) => {
            CONDITIONS.forEach((c) => {
                const { values } = estimateVitals(patient, [c], severity, 'seed');
                if (c.vitalsOverride) return;
                expect(values.hr).toBeGreaterThanOrEqual(30); expect(values.hr).toBeLessThanOrEqual(210);
                expect(values.sbp).toBeGreaterThanOrEqual(40); expect(values.sbp).toBeLessThanOrEqual(230);
                expect(values.dbp).toBeLessThanOrEqual(values.sbp - 10);
                expect(values.spo2).toBeLessThanOrEqual(100); expect(values.spo2).toBeGreaterThanOrEqual(50);
                expect(values.temp).toBeGreaterThanOrEqual(30); expect(values.temp).toBeLessThanOrEqual(42);
                expect(values.gcs).toBeGreaterThanOrEqual(3); expect(values.gcs).toBeLessThanOrEqual(15);
            });
        }));
    });
});

describe('doses proposées', () => {
    test('adulte : dose usuelle et bornes ; enfant : au poids, plafonnées', () => {
        const a = doseOptions('paracetamol', 'po', adult);
        expect(a.usual).toBe(1000);
        expect(a.options.map((o) => o.value)).toEqual([500, 1000]);
        const c = doseOptions('paracetamol', 'po', child);
        expect(c.mode).toBe('perKg');
        expect(c.usual).toBe(375); // 15 mg/kg × 25 kg
        const morphineChild = doseOptions('morphine', 'iv', { ...child, weightKg: 20 });
        expect(morphineChild.usual).toBe(1); // 0,05 mg/kg
    });
    test('poids manquant chez l\'enfant : poids estimé et mention', () => {
        const result = doseOptions('paracetamol', 'po', { ageYears: 8 });
        expect(result.weightEstimated).toBe(true);
        expect(result.weightKg).toBe(24);
        expect(checkPrescription(entry('paracetamol', 'po', result.usual), { patient: { ageYears: 8 } }).messages.some((m) => m.level === 'info')).toBe(true);
    });
    test('âge minimal et schémas réservés à l\'adulte', () => {
        expect(doseOptions('ketoprofene', 'po', child).unavailable).toMatch(/adulte/);
        expect(doseOptions('ciprofloxacine', 'po', { ...adult, ageYears: 16 }).unavailable).toMatch(/18 ans/);
        expect(doseOptions('ibuprofene', 'po', { ageYears: 0 }).unavailable).toBe('');
        expect(doseOptions('oxygene', 'masque', child).options.map((o) => o.value)).toEqual([1, 2, 4, 6, 10]);
        expect(doseOptions('salbutamol', 'neb', { ageYears: 3 }).options.map((o) => o.value)).toEqual([2.5]);
    });
    test('N-acétylcystéine : toujours au poids', () => {
        expect(doseOptions('acetylcysteine', 'iv', adult).usual).toBe(11250);
    });
    test('la dose usuelle de chaque schéma est valide pour un adulte de référence', () => {
        MEDICATIONS.forEach((m) => m.regimens.forEach((r) => {
            const opts = doseOptions(m.id, r.id, adult);
            if (opts.unavailable) return;
            const result = checkPrescription(entry(m.id, r.id, opts.usual), { patient: adult });
            expect({ med: m.id, regimen: r.id, errors: result.messages.filter((x) => x.level === 'error').map((x) => x.text) }).toEqual({ med: m.id, regimen: r.id, errors: [] });
        }));
    });
    test('la dose usuelle d\'un enfant ou d\'une personne âgée est valide quand le schéma est disponible', () => {
        [child, senior].forEach((patient) => MEDICATIONS.forEach((m) => m.regimens.forEach((r) => {
            const opts = doseOptions(m.id, r.id, patient);
            if (opts.unavailable) return;
            const result = checkPrescription(entry(m.id, r.id, opts.usual), { patient });
            expect({ med: m.id, regimen: r.id, errors: result.messages.filter((x) => x.level === 'error').map((x) => x.text) }).toEqual({ med: m.id, regimen: r.id, errors: [] });
        })));
    });
});

describe('contrôles de prescription', () => {
    test('dose maximale d\'une prise, cumul sur 24 h et prises trop rapprochées', () => {
        expect(checkPrescription(entry('paracetamol', 'po', 2000), { patient: adult }).level).toBe('error');
        expect(checkPrescription(entry('paracetamol', 'po', 1000, 5), { patient: adult }).messages.map((m) => m.text).join(' ')).toMatch(/sur 24 h/);
        expect(checkPrescription(entry('paracetamol', 'po', 1000, 6), { patient: adult }).level).toBe('error');
        expect(checkPrescription(entry('paracetamol', 'po', 1000, 4), { patient: adult }).level).toBe('ok');
        expect(checkPrescription(entry('paracetamol', 'po', '', 1), { patient: adult }).level).toBe('error');
        expect(checkPrescription(entry('inconnu', 'x', 1), { patient: adult }).level).toBe('error');
    });
    test('dose enfant au poids : alerte au-dessus du maximum, erreur franchement trop haute', () => {
        expect(checkPrescription(entry('paracetamol', 'po', 375), { patient: child }).level).toBe('ok');
        expect(checkPrescription(entry('paracetamol', 'po', 400), { patient: child }).level).toBe('warn'); // 16 mg/kg
        expect(checkPrescription(entry('paracetamol', 'po', 500), { patient: child }).level).toBe('error'); // 20 mg/kg
        expect(checkPrescription(entry('paracetamol', 'po', 800), { patient: child }).level).toBe('error'); // 32 mg/kg
        expect(checkPrescription(entry('paracetamol', 'po', 375, 5), { patient: child }).level).toBe('error'); // > 60 mg/kg/j
    });
    test('allergie directe, allergie croisée, mots proches sans faux positif', () => {
        const allergic = { ...adult, allergies: 'Allergie à la pénicilline' };
        expect(checkPrescription(entry('amoxicilline', 'po', 1000), { patient: allergic }).level).toBe('error');
        expect(checkPrescription(entry('ceftriaxone', 'iv', 1000), { patient: allergic }).level).toBe('warn');
        expect(checkPrescription(entry('ibuprofene', 'po', 400), { patient: { ...adult, allergies: 'Migraine' } }).level).toBe('ok');
        expect(checkPrescription(entry('ibuprofene', 'po', 400), { patient: { ...adult, allergies: 'Allergique aux AINS' } }).level).toBe('error');
        expect(checkPrescription(entry('aspirine', 'po', 250), { patient: { ...adult, allergies: 'ibuprofène' } }).level).toBe('error');
    });
    test('antécédents, traitements en cours et contexte clinique', () => {
        expect(checkPrescription(entry('ibuprofene', 'po', 400), { patient: { ...adult, currentMeds: 'Xarelto 20 mg' } }).level).toBe('error');
        expect(checkPrescription(entry('ibuprofene', 'po', 400), { patient: { ...adult, chronic: 'Ulcère gastrique' } }).level).toBe('error');
        expect(checkPrescription(entry('nitroglycerine', 'sl', 0.4), { patient: { ...adult, currentMeds: 'Viagra' } }).level).toBe('error');
        expect(checkPrescription(entry('nitroglycerine', 'sl', 0.4), { patient: adult, vitals: { sbp: 80 } }).level).toBe('error');
        expect(checkPrescription(entry('morphine', 'iv', 3), { patient: adult, vitals: { rr: 8 } }).level).toBe('error');
        expect(checkPrescription(entry('morphine', 'iv', 3), { patient: adult, tags: contextTags(conditionsOf(['surdose_opioides'])) }).level).toBe('error');
        expect(checkPrescription(entry('ketoprofene', 'iv', 100), { patient: adult, tags: contextTags(conditionsOf(['plaie_arme_feu'])) }).level).toBe('error');
        expect(checkPrescription(entry('tramadol', 'po', 50), { patient: { ...adult, currentMeds: 'Sertraline' } }).level).toBe('warn');
    });
    test('liste : doublons de familles et cumul d\'un même médicament', () => {
        const duo = checkList([entry('morphine', 'iv', 3), entry('fentanyl', 'iv', 50)], { patient: adult });
        expect(duo.list.some((m) => /opioïdes/.test(m.text))).toBe(true);
        const cumul = checkList([entry('paracetamol', 'po', 1000, 3), entry('paracetamol', 'iv', 1000, 3)], { patient: adult });
        expect(cumul.entries.every((r) => r.level === 'ok')).toBe(true);
        expect(cumul.list.some((m) => m.level === 'error' && /cumulés/.test(m.text))).toBe(true);
    });
    test('texte imprimé pour une ligne', () => {
        expect(entryText(entry('paracetamol', 'po', 1000, 3))).toBe('Paracétamol 1 000 mg — PO, 3 prises/24 h (toutes les 6 h)');
        expect(entryText({ ...entry('adrenaline', 'im_anaphylaxie', 0.5), note: 'cuisse gauche' })).toBe('Adrénaline 0,5 mg — IM (anaphylaxie) (cuisse gauche)');
        expect(entryText({})).toBe('');
    });
    test('nouvelle ligne : dose usuelle du premier schéma disponible', () => {
        expect(newEntry('ketoprofene', adult)).toMatchObject({ regimenId: 'iv', dose: 100, count: 1 });
        expect(newEntry('ketoprofene', child).dose).toBe('');
        expect(newEntry('inconnu', adult)).toBeNull();
    });
});

describe('suggestions pour des motifs', () => {
    test('aucune suggestion sans motif', () => {
        expect(buildSuggestions({ conditionIds: [], severity: 'Moderate', patient: adult })).toBeNull();
    });
    test('fracture fermée : constantes, texte, imagerie, médicaments et orientation cohérents', () => {
        const s = buildSuggestions({ conditionIds: ['fracture_fermee'], severity: 'Moderate', patient: adult, seed: 'a' });
        expect(s.text.diagnosis).toMatch(/Fracture fermée/);
        expect(s.findings.wounds).toBe('patientFractures');
        expect(s.imaging).toEqual(['XRay']);
        expect(s.routineCare).toEqual(expect.arrayContaining(['Immobilisation']));
        expect(s.meds.map((m) => m.medId)).toEqual(['paracetamol', 'ketoprofene']);
        expect(s.admission).toBe('No');
        expect(s.destination).toBe('Home');
        expect(s.igu).toBe('patientMildPain');
        const severe = buildSuggestions({ conditionIds: ['fracture_fermee'], severity: 'Severe', patient: adult, seed: 'a' });
        expect(severe.meds.map((m) => m.medId)).toContain('morphine');
        expect(severe.destination).toBe('OperatingRoom');
        expect(severe.igu).toBe('patientSeverePain');
    });
    test('les médicaments non sûrs pour ce patient ne sont pas proposés, avec la raison', () => {
        const s = buildSuggestions({ conditionIds: ['fracture_fermee'], severity: 'Moderate', patient: { ...adult, allergies: 'AINS' } });
        expect(s.meds.map((m) => m.medId)).toEqual(['paracetamol']);
        expect(s.skipped[0]).toMatchObject({ medId: 'ketoprofene' });
        expect(s.skipped[0].reasons[0]).toMatch(/Allergie/);
    });
    test('hémorragie : pas d\'anti-inflammatoire proposé même hors liste du motif', () => {
        const s = buildSuggestions({ conditionIds: ['fracture_fermee', 'hemorragie_externe'], severity: 'Moderate', patient: adult });
        expect(s.meds.map((m) => m.medId)).not.toContain('ketoprofene');
        expect(s.skipped.some((x) => x.medId === 'ketoprofene')).toBe(true);
    });
    test('plusieurs motifs : diagnostic principal puis secondaires, procédures titrées', () => {
        const s = buildSuggestions({ conditionIds: ['fracture_fermee', 'plaie_superficielle'], severity: 'Moderate', patient: adult });
        expect(s.text.secondary).toMatch(/Plaie superficielle/);
        expect(s.text.procedure).toMatch(/Fracture fermée d'un membre :\n- /);
        expect(s.meds.filter((m) => m.medId === 'paracetamol')).toHaveLength(1);
    });
    test('enfant : doses au poids, médicaments réservés à l\'adulte écartés', () => {
        const s = buildSuggestions({ conditionIds: ['fracture_fermee'], severity: 'Moderate', patient: child });
        const paracetamol = s.meds.find((m) => m.medId === 'paracetamol');
        expect(paracetamol.dose).toBe(375);
        expect(s.skipped.some((x) => x.medId === 'ketoprofene')).toBe(true);
    });
    test('chaque motif produit une suggestion complète pour un adulte, un enfant et une personne âgée', () => {
        [adult, child, senior].forEach((patient) => ['Mild', 'Moderate', 'Severe', 'Critical'].forEach((severity) => CONDITIONS.forEach((c) => {
            const s = buildSuggestions({ conditionIds: [c.id], severity, patient, seed: 'seed' });
            expect(s).not.toBeNull();
            expect(s.vitals.fields.heartRateValue).toBeDefined();
            expect(s.text.procedure).toContain('- ');
            s.meds.forEach((m) => expect(checkPrescription(m, { patient, vitals: vitalsFromForm(s.vitals.fields), tags: contextTags(conditionsOf([c.id])) }).level).not.toBe('error'));
        })));
    });
    test('arrêt cardiaque : adrénaline IV proposée, admission, gravité critique', () => {
        const s = buildSuggestions({ conditionIds: ['arret_cardiaque'], severity: 'Critical', patient: adult });
        expect(s.meds.map((m) => m.medId)).toEqual(expect.arrayContaining(['adrenaline', 'amiodarone']));
        expect(s.admission).toBe('Yes');
        expect(s.vitals.fields.heartRateValue).toBe('0');
    });
    test('surdose d\'opioïdes : naloxone et jamais d\'opioïde', () => {
        const s = buildSuggestions({ conditionIds: ['surdose_opioides'], severity: 'Severe', patient: adult });
        expect(s.meds.map((m) => m.medId)).toEqual(['oxygene', 'naloxone']);
        expect(s.admission).toBe('Yes');
    });
});

describe('avertissements d\'un rapport', () => {
    test('aucun sans médicament ; liste lisible sinon', () => {
        expect(clinicalWarnings({})).toEqual([]);
        const lines = clinicalWarnings({ patientAllergies: 'Pénicilline', patientAgeYears: '30', clinicalMeds: [entry('amoxicilline', 'po', 1000)] });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^Amoxicilline : Allergie signalée/);
    });
    test('les constantes saisies et les motifs choisis sont pris en compte', () => {
        const lines = clinicalWarnings({ patientAgeYears: '30', clinicalConditions: ['surdose_opioides'], clinicalMeds: [entry('morphine', 'iv', 3)] });
        expect(lines.join(' ')).toMatch(/opioïde/);
    });
});

test('la liste de départ couvre bien les familles attendues', () => {
    expect(MEDICATIONS.length).toBeGreaterThanOrEqual(40);
    expect(CONDITIONS.length).toBeGreaterThanOrEqual(40);
    expect(CONDITION_BY_ID.sca.tags).toContain('sca');
});
