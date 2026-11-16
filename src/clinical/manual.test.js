import { CONDITIONS } from './conditions';
import { MEDICATIONS } from './medications';
import { AGE_BANDS } from './vitals';
import { PATHWAYS } from './pathways';
import { MANUAL, searchManual, lessonOfCondition, manualFigureIds, uncoveredConditions, vitalsRows, medsRows, conditionSheet } from './manual';
import { FIGURES } from '../components/Pilou/ManualFigures';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));

const BLOCK_TYPES = ['p', 'list', 'steps', 'table', 'figure', 'tip', 'warn', 'rp', 'heading', 'vitalsTable', 'medsTable'];

describe('manuel médical : structure', () => {
    test('chapitres et sections ont un titre, du contenu et des identifiants uniques', () => {
        expect(MANUAL.length).toBeGreaterThanOrEqual(12);
        expect(new Set(MANUAL.map((chapter) => chapter.id)).size).toBe(MANUAL.length);
        const sectionIds = MANUAL.flatMap((chapter) => chapter.sections.map((section) => `${chapter.id}/${section.id}`));
        expect(new Set(sectionIds).size).toBe(sectionIds.length);
        MANUAL.forEach((chapter) => {
            expect(chapter.title && chapter.icon && chapter.intro).toBeTruthy();
            expect(chapter.sections.length).toBeGreaterThan(0);
            chapter.sections.forEach((section) => {
                expect(section.title).toBeTruthy();
                expect(section.blocks.length).toBeGreaterThan(0);
                section.blocks.forEach((block) => {
                    expect(BLOCK_TYPES).toContain(block.type);
                    if (block.type === 'table') block.rows.forEach((row) => expect(row).toHaveLength(block.head.length));
                    if (block.type === 'list' || block.type === 'steps') expect(block.items.length).toBeGreaterThan(0);
                });
            });
        });
    });
    test('chaque schéma cité existe', () => {
        const ids = manualFigureIds();
        expect(ids.length).toBeGreaterThanOrEqual(12);
        expect(ids.filter((id) => !FIGURES[id])).toEqual([]);
        expect(Object.keys(FIGURES).filter((id) => !ids.includes(id))).toEqual([]); // aucun schéma inutilisé
    });
});

describe('manuel médical : complet et cohérent avec l\'aide à la prise en charge', () => {
    test('chaque motif a sa leçon rédigée et sa fiche réflexe', () => {
        expect(uncoveredConditions()).toEqual([]);
        const sheets = MANUAL.find((chapter) => chapter.id === 'fiches').sections;
        expect(sheets.map((sheet) => sheet.conditionId).sort()).toEqual(CONDITIONS.map((c) => c.id).sort());
        expect(lessonOfCondition('brulure')).toEqual({ chapterId: 'trauma', sectionId: 'brulures', title: 'Brûlures' });
        expect(lessonOfCondition('inconnu')).toBeNull();
    });
    test('la fiche reprend exactement les étapes du parcours, le matériel et les médicaments', () => {
        const sheet = conditionSheet(CONDITIONS.find((c) => c.id === 'anaphylaxie'));
        const steps = sheet.blocks.filter((block) => block.type === 'steps').map((block) => block.items);
        expect(steps).toEqual([PATHWAYS.anaphylaxie.now, PATHWAYS.anaphylaxie.assess, PATHWAYS.anaphylaxie.treat]);
        const lists = sheet.blocks.filter((block) => block.type === 'list').flatMap((block) => block.items).join(' ');
        expect(lists).toMatch(/Adrénaline/);
        expect(lists).toMatch(/à partir de la gravité modérée/);
        expect(sheet.blocks[sheet.blocks.length - 1].text).toMatch(/Hospitalisation proposée dès la gravité légère/);
    });
    test('tableaux générés : constantes par âge et référentiel des médicaments', () => {
        expect(vitalsRows()).toHaveLength(AGE_BANDS.length);
        expect(vitalsRows()[0]).toEqual(['Moins de 1 an', '110 à 160', '30 à 50', '90/55']);
        const meds = medsRows();
        expect(meds).toHaveLength(MEDICATIONS.length);
        expect(meds.find((row) => row[0] === 'Paracétamol')).toEqual(['Paracétamol', 'Antalgique / antipyrétique', 'PO, IV', 'Doliprane, Efferalgan, Dafalgan']);
    });
});

describe('recherche dans le manuel', () => {
    test('retrouve un mot, sans tenir compte des accents ni de la casse ; les titres d\'abord', () => {
        expect(searchManual('garrot').map((r) => r.sectionId)).toEqual(expect.arrayContaining(['hemorragie', 'fiche-hemorragie_externe']));
        expect(searchManual('BRULURE')[0]).toMatchObject({ title: 'Brûlures' });
        expect(searchManual('règle des neuf').map((r) => r.sectionId)).toContain('brulures');
        expect(searchManual('glasgow')[0].sectionId).toBe('glasgow');
        expect(searchManual('paracétamol doliprane').map((r) => r.sectionId)).toContain('referentiel');
    });
    test('rien pour une recherche vide ou sans rapport', () => {
        expect(searchManual('')).toEqual([]);
        expect(searchManual('a')).toEqual([]);
        expect(searchManual('xyzzy')).toEqual([]);
    });
});
