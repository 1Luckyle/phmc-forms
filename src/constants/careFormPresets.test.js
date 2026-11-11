import { PHYS_EVAL_PRESETS, MENTAL_HEALTH_PRESETS, PSYCH_EVAL_PRESETS, CARE_PRESETS_BY_VERSION, carePresetFieldsOf } from './careFormPresets';
import { VERSION_FIELDS } from './formFieldCatalog';
import getRelevantFields from '../components/RevelantFields';
import { aptitudeStatement } from '../utils/careFormRules';

describe('choix par défaut des formulaires de consultation', () => {
    test.each(Object.keys(CARE_PRESETS_BY_VERSION).map(Number))('formulaire %i : chaque liste correspond à un champ du formulaire, sans doublon ni valeur vide', (version) => {
        const presets = CARE_PRESETS_BY_VERSION[version];
        Object.entries(presets).forEach(([field, list]) => {
            expect(VERSION_FIELDS[version][field]).toBeDefined();
            expect(list.length).toBeGreaterThanOrEqual(5);
            expect(list.every((item) => typeof item === 'string' && item.trim() !== '' && !item.includes(' ; '))).toBe(true);
            expect(new Set(list).size).toBe(list.length);
        });
    });

    test.each(Object.keys(CARE_PRESETS_BY_VERSION).map(Number))('formulaire %i : les choix cochés et le texte libre sont conservés à l\'enregistrement', (version) => {
        const kept = getRelevantFields(version);
        carePresetFieldsOf(version).forEach((key) => expect(kept).toContain(key));
    });

    test('chaque version a sa liste (évaluation physique, psychiatrie, psychologie, versions PHMC et PBC)', () => {
        expect(CARE_PRESETS_BY_VERSION[6]).toBe(PHYS_EVAL_PRESETS);
        expect(CARE_PRESETS_BY_VERSION[7]).toBe(PHYS_EVAL_PRESETS);
        expect(CARE_PRESETS_BY_VERSION[14]).toBe(MENTAL_HEALTH_PRESETS);
        expect(CARE_PRESETS_BY_VERSION[16]).toBe(MENTAL_HEALTH_PRESETS);
        expect(CARE_PRESETS_BY_VERSION[28]).toBe(PSYCH_EVAL_PRESETS);
        expect(CARE_PRESETS_BY_VERSION[29]).toBe(PSYCH_EVAL_PRESETS);
        expect(Object.keys(PSYCH_EVAL_PRESETS)).toHaveLength(28);
    });
});

describe("déclaration d'évaluation proposée", () => {
    const base = { evalReason: 'Hiring', date: '2026-11-11', aptitudeValidityMonths: '6' };
    test('rien sans conclusion', () => {
        expect(aptitudeStatement({})).toBe('');
    });
    test('apte, apte avec restrictions, inapte', () => {
        const apt = aptitudeStatement({ ...base, aptitudeConclusion: 'Apte' });
        expect(apt).toContain("(embauche)");
        expect(apt).toContain('déclaré APTE');
        expect(apt).toContain("valable 6 mois, jusqu'au 11/05/2027");
        const restricted = aptitudeStatement({ ...base, aptitudeConclusion: 'Apte avec restrictions', aptitudeRestrictions: 'Pas de travail en hauteur', vaccinationState: 'No', vaccinationNote: 'Tétanos' });
        expect(restricted).toContain('restrictions suivantes : Pas de travail en hauteur.');
        expect(restricted).toContain('Vaccinations à compléter : Tétanos.');
        const inapt = aptitudeStatement({ ...base, aptitudeConclusion: 'Inapte' });
        expect(inapt).toContain('INAPTE');
        expect(inapt).not.toContain('valable');
    });
});
