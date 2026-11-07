import { bbcodeToHtmlFragment } from './bbcodeToHtml';

describe('taille des images dans l’aperçu', () => {
    test('un logo dans une cellule de tableau est plafonné', () => {
        const html = bbcodeToHtmlFragment('[table][tr][td][center][img]https://phmc-tools.com/img/phmc.png[/img][/center][/table]');
        expect(html).toContain('max-width:min(100%,170px)');
        expect(html).toContain('max-height:170px');
    });
    test('une photo hors tableau garde toute la largeur', () => {
        const html = bbcodeToHtmlFragment('[center][img]https://i.ibb.co/x/photo.png[/img][/center]');
        expect(html).not.toContain('max-height');
        expect(html).toContain('max-width:100%');
    });
});
