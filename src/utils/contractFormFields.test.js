import { CONTRACT_TYPES, fieldsFor, visibleFields, emptyContractFields, buildContractBb } from './contractDocs';
import { FIN_MOTIFS } from './contractConstants';
import { FIN_MOTIF_PRESETS, RESTITUTION_PRESETS, finMotifPresets, appendPreset } from '../constants/contractOptions';
import { personGroups } from '../components/Contracts/PersonSelect';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));

const TYPED_BY_HAND = ['text', 'textarea', 'number', 'money', 'person', 'persons', 'presets', 'horaires'];

describe('formulaires de contrat : placeholders, libellés et réponses par défaut', () => {
    test('tout champ saisi au clavier ou choisi dans une liste porte un placeholder, dans tous les types de document', () => {
        const missing = [];
        Object.keys(CONTRACT_TYPES).forEach((type) => fieldsFor(type).forEach((field) => {
            if (TYPED_BY_HAND.includes(field.type) && !String(field.placeholder || '').trim()) missing.push(`${type}/${field.key}`);
        }));
        expect(missing).toEqual([]);
    });

    test('aucun libellé ni aide ne dit « facultatif » : les couleurs le disent', () => {
        const wordy = [];
        Object.keys(CONTRACT_TYPES).forEach((type) => fieldsFor(type).forEach((field) => {
            if (/facultatif/i.test(`${field.label} ${field.help || ''} ${field.placeholder || ''}`)) wordy.push(`${type}/${field.key}`);
        }));
        expect(wordy).toEqual([]);
    });

    test('convocation : la personne qui mène l\'entretien se choisit, et du personnel supplémentaire peut être ajouté', () => {
        const fields = fieldsFor('convocation');
        const lead = fields.find((field) => field.key === 'conduitPar');
        expect(lead).toMatchObject({ type: 'person', required: true, personRole: true });
        const extra = fields.find((field) => field.key === 'personnelSupplementaire');
        expect(extra).toMatchObject({ type: 'persons', personRole: true });
        expect(extra.required).toBeFalsy();
        // la personne qui mène l'entretien se choisit avant le personnel supplémentaire
        expect(fields.findIndex((field) => field.key === 'conduitPar')).toBeLessThan(fields.findIndex((field) => field.key === 'personnelSupplementaire'));
        expect(emptyContractFields('convocation').personnelSupplementaire).toBe('');
    });

    test('la convocation imprimée cite le personnel supplémentaire, seulement s\'il y en a', () => {
        const base = { typeContrat: 'convocation', objet: 'sanction', conduitPar: 'Dr. Rose Callahan — Directeur(trice)', dateEntretien: '2026-12-01', heureEntretien: '10:00', lieuEntretien: 'Bureau de la Direction', faitsReproches: 'Retards répétés.' };
        const build = (champs) => buildContractBb({ type: 'convocation', service: 'phmc', employeeName: 'Jane Doe', champs, issuer: { name: 'Dr. Rose Callahan', title: 'Directeur(trice)' }, id: 'c1', timestamp: Date.UTC(2026, 10, 20) }).bbCode;
        const without = build(base);
        expect(without).toContain('Dr. Rose Callahan — Directeur(trice)');
        expect(without).not.toContain('Personnel supplémentaire présent');
        const withExtra = build({ ...base, personnelSupplementaire: 'Dr. Edmund Messina — Médecin Légiste ; Marie Dupont — Infirmier(ère)' });
        expect(withExtra).toContain('Personnel supplémentaire présent');
        expect(withExtra).toContain('Dr. Edmund Messina — Médecin Légiste, Marie Dupont — Infirmier(ère)');
    });

    test('fin de contrat : des réponses par défaut pour les motifs détaillés (selon le motif) et pour les restitutions', () => {
        const fin = fieldsFor('fin');
        const motifs = fin.find((field) => field.key === 'motifsDetailles');
        const rest = fin.find((field) => field.key === 'restitutions');
        expect(motifs.type).toBe('presets');
        expect(rest.type).toBe('presets');
        // chaque motif qui affiche le champ a ses réponses par défaut
        const shown = Object.keys(FIN_MOTIFS).filter((motif) => visibleFields('fin', { ...emptyContractFields('fin'), motif }, {}).some((field) => field.key === 'motifsDetailles'));
        expect(shown).toEqual(expect.arrayContaining(['licenciement', 'licenciement_disciplinaire', 'demission', 'rupture_amiable', 'plein_droit', 'fin_essai']));
        shown.forEach((motif) => { expect(motifs.presets({ motif }).length).toBeGreaterThanOrEqual(2); });
        expect(motifs.presets({ motif: 'fin_cdd' })).toEqual([]);
        expect(rest.presets()).toBe(RESTITUTION_PRESETS);
        Object.values(FIN_MOTIF_PRESETS).flat().concat(RESTITUTION_PRESETS).forEach((text) => expect(text.trim()).toBe(text));
        expect(finMotifPresets('inconnu')).toEqual([]);
    });

    test('préavis dispensé : la rémunération versée se renseigne dès que la case est cochée (démission et licenciement), et elle est obligatoire', () => {
        const visible = (champs) => visibleFields('fin', { ...emptyContractFields('fin'), ...champs }, {}).map((field) => field.key);
        expect(visible({ motif: 'demission' })).not.toContain('preavisRemuneration');
        expect(visible({ motif: 'demission', preavisDispense: true })).toContain('preavisRemuneration');
        expect(visible({ motif: 'licenciement', preavisDispense: true })).toContain('preavisRemuneration');
        expect(visible({ motif: 'licenciement_disciplinaire', preavisDispense: true })).not.toContain('preavisRemuneration');
        expect(visible({ motif: 'fin_cdd', preavisDispense: true })).not.toContain('preavisRemuneration');
        const field = fieldsFor('fin').find((item) => item.key === 'preavisRemuneration');
        expect(field).toMatchObject({ type: 'money', required: true });
        expect(field.placeholder).toBeTruthy();
    });

    test('la notification de fin de contrat précise la rémunération du préavis dispensé', () => {
        const refContract = { id: 'r1', statut: 'signe', signeLe: Date.UTC(2026, 0, 5), reference: 'PHMC-CT-1', champs: { typeContrat: 'cdi', poste: 'Médecin urgentiste', role: 'Médecin Titulaire', dateDebut: '2026-01-05' } };
        const build = (champs) => buildContractBb({
            type: 'fin', service: 'phmc', employeeName: 'Jane Doe', refContract, issuer: { name: 'Dr. Rose Callahan', title: 'Directeur(trice)' }, id: 'f1', timestamp: Date.UTC(2026, 10, 20),
            champs: { ...emptyContractFields('fin'), motif: 'demission', contratRefId: 'r1', dateEffet: '2026-12-15', dateRemiseDemission: '2026-11-30', preavisJours: '14', ...champs },
        }).bbCode.replace(/[\s  ]+/g, ' ');
        expect(build({})).not.toContain('dispense');
        expect(build({ preavisDispense: true })).toContain('(préavis rémunéré)');
        expect(build({ preavisDispense: true, preavisRemuneration: '4 500 $ de l\'heure' })).toContain('(préavis rémunéré, à raison de [b]4 500 $ de l\'heure[/b])');
        // décochée : la rémunération restée dans le brouillon n'est pas imprimée
        expect(build({ preavisDispense: false, preavisRemuneration: '4 500 $ de l\'heure' })).not.toContain('à raison de');
    });

    test('ajout d\'une réponse par défaut : à la suite, sans doublon, avec le bon séparateur', () => {
        expect(appendPreset('', 'Absences injustifiées répétées')).toBe('Absences injustifiées répétées');
        expect(appendPreset('Retards répétés.', 'Violation du secret médical')).toBe('Retards répétés.\nViolation du secret médical');
        expect(appendPreset('Violation du secret médical', 'Violation du secret médical')).toBe('Violation du secret médical');
        expect(appendPreset('badge d\'employé', 'véhicule de service', ' ; ')).toBe('badge d\'employé ; véhicule de service');
        expect(appendPreset('badge d\'employé ; véhicule de service', 'véhicule de service', ' ; ')).toBe('badge d\'employé ; véhicule de service');
        expect(appendPreset(undefined, 'x', ' ; ')).toBe('x');
    });

    test('liste du personnel : rangée par service, sans la personne concernée, valeur « Nom — Grade » au choix', () => {
        const staff = [
            { kind: 'staff', service: 'phmc', displayName: 'Dr. Rose Callahan', rank: 'Directeur(trice)' },
            { kind: 'staff', service: 'phmc', displayName: 'Jane Doe', rank: 'Infirmier(ère)' },
            { kind: 'staff', service: 'coroner', displayName: 'Dr. Edmund Messina', rank: 'Médecin Légiste' },
            { kind: 'recruiter', displayName: 'Un recruteur' },
            { kind: 'staff', service: 'phmc', displayName: 'Jane Doe', rank: 'Infirmier(ère)' },
        ];
        const groups = personGroups(staff, { exclude: ['Jane Doe'] });
        expect(groups.map((group) => group.options.map((option) => option.value))).toEqual([['Dr. Rose Callahan'], ['Dr. Edmund Messina']]);
        const withRole = personGroups(staff, { withRole: true });
        expect(withRole[0].options.map((option) => option.value)).toEqual(['Dr. Rose Callahan — Directeur(trice)', 'Jane Doe — Infirmier(ère)']);
        expect(withRole[0].options[0].label).toBe('Dr. Rose Callahan (Directeur(trice))');
        // la personne qui mène l'entretien (valeur « Nom — Grade ») est exclue du personnel supplémentaire
        const extra = personGroups(staff, { withRole: true, exclude: ['Jane Doe', 'Dr. Rose Callahan — Directeur(trice)'] });
        expect(extra.flatMap((group) => group.options.map((option) => option.value))).toEqual(['Dr. Edmund Messina — Médecin Légiste']);
    });
});
