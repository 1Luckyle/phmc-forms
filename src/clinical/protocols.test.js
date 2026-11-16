import { CONDITIONS } from './conditions';
import { PROTOCOLS, matchConditions, buildCase, caseToText, patientAdaptations } from './protocols';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));

describe('protocoles de Pilou : un protocole par motif', () => {
    test('chaque motif a du matériel, des gestes, une surveillance et des mots de symptômes', () => {
        const missing = CONDITIONS.filter((c) => {
            const protocol = PROTOCOLS[c.id];
            return !protocol || protocol.equipment.length < 2 || protocol.gestures.length < 3 || protocol.monitoring.length < 1 || !protocol.symptoms;
        }).map((c) => c.id);
        expect(missing).toEqual([]);
    });
    test('aucun protocole orphelin (motif supprimé)', () => {
        const ids = new Set(CONDITIONS.map((c) => c.id));
        expect(Object.keys(PROTOCOLS).filter((id) => !ids.has(id))).toEqual([]);
    });
    test('chaque motif a aussi ses étapes de procédure', () => {
        expect(CONDITIONS.filter((c) => !(c.steps || []).length).map((c) => c.id)).toEqual([]);
    });
});

describe('symptômes → motifs', () => {
    const first = (text) => (matchConditions(text)[0] || {}).id;
    test('les symptômes courants retrouvent le bon motif', () => {
        expect(first('douleur thoracique, oppression, bras gauche, sueurs')).toBe('sca');
        expect(first('ne respire plus et plus de pouls')).toBe('arret_cardiaque');
        expect(first('diarrhée et vomissements depuis hier')).toBe('deshydratation');
        expect(first('sifflement et essoufflement, crise d\'asthme')).toBe('asthme');
        expect(first('visage paralysé, parole difficile')).toBe('avc');
        expect(first('coup de couteau dans le ventre')).toBe('plaie_arme_blanche');
        expect(first('tremblements, sueurs, diabétique, malaise, glycémie basse')).toBe('hypoglycemie');
        expect(first('gonflement du visage après une piqûre, difficulté à respirer')).toBe('anaphylaxie');
    });
    test('plusieurs propositions, triées ; rien pour un texte sans rapport', () => {
        const result = matchConditions('douleur ventre vomissements', 4);
        expect(result.length).toBeGreaterThan(1);
        expect(result.length).toBeLessThanOrEqual(4);
        expect(result.map((r) => r.score)).toEqual([...result.map((r) => r.score)].sort((a, b) => b - a));
        expect(matchConditions('')).toEqual([]);
        expect(matchConditions('xyzzy qwerty')).toEqual([]);
    });
});

describe('prise en charge d\'un cas', () => {
    const adult = { ageYears: 45, sex: 'Male', weightKg: 80, heightCm: 178, severity: 'Severe', conditionIds: ['sca'] };

    test('sans motif : rien', () => {
        expect(buildCase({ ...adult, conditionIds: [] })).toBeNull();
        expect(buildCase({ ...adult, conditionIds: ['inconnu'] })).toBeNull();
    });

    test('un adulte avec un syndrome coronarien : constantes, étapes, matériel, gestes, médicaments dosés, orientation', () => {
        const result = buildCase(adult);
        expect(result.conditions[0]).toMatchObject({ id: 'sca' });
        expect(result.conditions[0].steps.length).toBeGreaterThan(2);
        expect(result.conditions[0].equipment).toContain('Électrocardiogramme 12 dérivations');
        expect(result.conditions[0].gestures.length).toBeGreaterThanOrEqual(3);
        expect(result.vitals.hr).toBeGreaterThan(0);
        expect(result.meds.length).toBeGreaterThan(0);
        result.meds.forEach((m) => { expect(m.text).toMatch(/\d/); expect(m.name).toBeTruthy(); });
        expect(result.destination).toBeTruthy();
        expect(result.patient.bmi).toBeCloseTo(25.2, 1);
    });

    test('un enfant : doses au poids, matériel pédiatrique signalé', () => {
        const child = buildCase({ ageYears: 6, sex: 'Female', weightKg: 20, severity: 'Moderate', conditionIds: ['fracture_fermee'] });
        expect(child.adaptations.join(' ')).toMatch(/Enfant de moins de 15 ans/);
        const paracetamol = child.meds.find((m) => /Parac/i.test(m.name)) || child.meds[0];
        expect(paracetamol.text).toBeTruthy();
        expect(patientAdaptations({ ageYears: 0.5 }).join(' ')).toMatch(/Nourrisson/);
    });

    test('poids non renseigné : estimation signalée', () => {
        const result = buildCase({ ageYears: 30, sex: 'Female', severity: 'Mild', conditionIds: ['plaie_superficielle'] });
        expect(result.adaptations.join(' ')).toMatch(/Poids non renseigné/);
        expect(result.adaptations.join(' ')).toMatch(/grossesse/);
    });

    test('allergie à la pénicilline : l\'antibiotique est remplacé ou écarté, jamais prescrit tel quel', () => {
        const result = buildCase({ ageYears: 40, sex: 'Male', weightKg: 75, allergies: 'Allergie sévère à la pénicilline (choc)', severity: 'Severe', conditionIds: ['plaie_profonde'] });
        const names = result.meds.map((m) => m.name.toLowerCase()).join(' ');
        expect(names).not.toMatch(/amoxicilline|pénicilline/);
    });

    test('plusieurs motifs : un bloc par motif, texte complet à copier', () => {
        const result = buildCase({ ...adult, conditionIds: ['sca', 'hypoglycemie'] });
        expect(result.conditions).toHaveLength(2);
        const text = caseToText(result);
        expect(text).toContain('PILOU — Douleur thoracique / syndrome coronarien + Hypoglycémie');
        ['Étapes :', 'Matériel :', 'Gestes :', 'Surveillance :', 'MÉDICAMENTS', 'ORIENTATION :', 'Aide à la décision'].forEach((part) => expect(text).toContain(part));
        expect(caseToText(null)).toBe('');
    });

    test('le patient qui rentre chez lui reçoit une ordonnance de sortie', () => {
        const result = buildCase({ ageYears: 30, sex: 'Male', weightKg: 75, severity: 'Mild', conditionIds: ['plaie_superficielle'] });
        expect(result.destinationKey).toBe('Home');
        expect(result.prescription.length).toBeGreaterThan(0);
        expect(caseToText(result)).toContain('ORDONNANCE DE SORTIE');
    });
});
