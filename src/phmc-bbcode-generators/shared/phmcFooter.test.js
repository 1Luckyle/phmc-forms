import { withPhmcFooter, PHMC_FOOTER_MARK } from './bbStyles';
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
    test('s’affiche dans l’aperçu HTML', () => {
        const html = bbcodeToHtmlFragment(withPhmcFooter('[b]Rapport[/b]', 3));
        expect(html).toContain('Pillbox Hill Medical Center');
        expect(html).toContain('Téléphone: 50056');
        expect(html).toContain('phmc-tools.com');
    });
});
