import { withPhmcFooter, PHMC_FOOTER_MARK, PBC_FOOTER_MARK } from './bbStyles';
import generateCommentaryNotePBC from '../generateCommentaryNotePBC';
import generateCommentaryNotePHMC from '../generateCommentaryNotesPHMC';
import { bbcodeToHtmlFragment } from '../../utils/bbcodeToHtml';

describe('pied de page PHMC', () => {
    test('ajouté une seule fois à la fin d’un rapport', () => {
        const once = withPhmcFooter('[b]Rapport[/b]\n', 3);
        expect(once.endsWith('[/center]')).toBe(true);
        expect(once).toContain('Téléphone: 50056');
        expect(once).toContain('info.phmc@mail.eyefind.fr');
        expect(withPhmcFooter(once, 3)).toBe(once);
        expect(once.split(PHMC_FOOTER_MARK)).toHaveLength(2);
    });
    test('pas ajouté aux courriels qui le portent déjà ni à un texte vide', () => {
        expect(withPhmcFooter('texte', 27)).toBe('texte');
        expect(withPhmcFooter('texte', 35)).toBe('texte');
        expect(withPhmcFooter('', 3)).toBe('');
    });
    test('les formulaires PBC portent les coordonnées de la clinique de Paleto Bay, jamais celles de l’hôpital', () => {
        [7, 16, 21, 23, 29].forEach((version) => {
            const text = withPhmcFooter('[b]Note[/b]', version);
            expect(text).toContain('Clinique de Paleto Bay');
            expect(text).toContain(PBC_FOOTER_MARK);
            expect(text).not.toContain(PHMC_FOOTER_MARK);
            expect(withPhmcFooter(text, version)).toBe(text);
        });
        expect(withPhmcFooter('[b]Note[/b]', 22)).toContain(PHMC_FOOTER_MARK);
    });
    test('la note de service n’a plus les coordonnées dans son en-tête (le pied de page les porte)', () => {
        const data = { phmcEmployee: 'Dr Test', date: '2026-11-08', patientName: 'Jean Test', patientID: 'PHMC-1', patientNotes: 'RAS', departmentLarge: '' };
        const pbc = generateCommentaryNotePBC(data);
        const phmc = generateCommentaryNotePHMC(data);
        expect(pbc).not.toContain('CLINIQUE DE PALETO BAY');
        expect(pbc).not.toContain('BP 685');
        expect(phmc).not.toContain('CENTRE MÉDICAL PILLBOX HILL');
        expect(phmc).not.toContain('BP 742');
        expect(pbc).toContain('phmcpaletobaylogo.png');
        expect(phmc).toContain('/img/phmc.png');
    });
    test('s’affiche dans l’aperçu HTML', () => {
        const html = bbcodeToHtmlFragment(withPhmcFooter('[b]Rapport[/b]', 3));
        expect(html).toContain('Pillbox Hill Medical Center');
        expect(html).toContain('Téléphone: 50056');
        expect(html).toContain('phmc-tools.com');
    });
});
