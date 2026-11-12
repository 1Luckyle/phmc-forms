import { buildOpenPositionsText, positionPayLabel } from './openPositionsText';
import { normalizeGrid, gradeKeyOf, formatEchelonRates } from './salaryGrid';

// Le module de la grille charge Firebase : on le remplace (aucune connexion dans ces tests).
jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn() }));

const grid = normalizeGrid({
    echelons: { 3: { horaire: 1200, hebdo: 48000 }, 7: { horaire: 4500, hebdo: 90000 } },
    grades: { [gradeKeyOf('Médecin Titulaire')]: { grade: 'Médecin Titulaire', echelon: 7 }, [gradeKeyOf('Infirmier')]: { grade: 'Infirmier', echelon: 3 } },
});
const pos = (nom, statut, role = '') => ({ nom, statut, role });

describe('texte des postes ouverts', () => {
    test('par catégorie, avec échelon et salaires ; seuls les postes ouverts', () => {
        const { text, count } = buildOpenPositionsText({
            grid, date: new Date(2026, 10, 12),
            categories: [
                { label: 'Médecine', positions: { a: pos('Médecin titulaire', 'OUVERT', 'Médecin Titulaire'), b: pos('Chirurgien', 'FERMÉ', 'Médecin Titulaire') } },
                { label: 'Soins infirmiers', positions: { c: pos('Infirmier', 'OUVERT', 'Infirmier') } },
            ],
        });
        expect(count).toBe(2);
        expect(text).toContain('*(au 12/11/2026 : 2 postes ouverts)*');
        // Séparateur de milliers variable selon l'environnement : on compare au même formatage que le site.
        expect(text).toContain(`**Médecine**\n• Médecin titulaire — Échelon 7 — ${formatEchelonRates(grid.echelons[6])}`);
        expect(formatEchelonRates(grid.echelons[6])).toMatch(/\$\/h · .*\$\/sem\./);
        expect(text).toContain('**Soins infirmiers**\n• Infirmier — Échelon 3');
        expect(text).not.toContain('Chirurgien');
    });

    test('catégorie sans poste ouvert, et poste sans échelon connu', () => {
        const { text, count } = buildOpenPositionsText({
            grid, date: new Date(2026, 10, 12),
            categories: [
                { label: 'Administration & Services', positions: { a: pos('Agent', 'FERMÉ') } },
                { label: 'Paramédical (EMS)', positions: { b: pos('Ambulancier', 'OUVERT', 'Rôle inconnu'), c: pos('Aide', 'OUVERT') } },
            ],
        });
        expect(count).toBe(2);
        expect(text).toContain('**Administration & Services**\n*Aucun poste ouvert actuellement.*');
        expect(text).toContain('• Ambulancier — échelon non défini');
        expect(text).toContain('• Aide — échelon non défini');
        expect(positionPayLabel(grid, null)).toBe('échelon non défini');
    });

    test('les caractères de mise en forme Discord d\'un nom de poste sont neutralisés', () => {
        const { text } = buildOpenPositionsText({ grid, categories: [{ label: 'X', positions: { a: pos('Chef_de *service*', 'OUVERT') } }] });
        expect(text).toContain('• Chef\\_de \\*service\\* — échelon non défini');
    });

    test('aucun poste ouvert du tout', () => {
        const { text, count } = buildOpenPositionsText({ grid, categories: [{ label: 'Médecine', positions: {} }] });
        expect(count).toBe(0);
        expect(text).toContain('0 poste ouvert');
    });
});
