import generateContract from './generateContract';
import { PHMC_FOOTER_MARK, withPhmcFooter } from './shared/bbStyles';
import { bbcodeToHtmlFragment } from '../utils/bbcodeToHtml';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));

const doc = (over = {}) => ({
    title: 'Contrat de travail à durée indéterminée', subtitle: 'Médecin', reference: 'PHMC-RH-2026-AB12C', dateText: 'Édité le 15/11/2026', service: 'phmc',
    visas: ['Vu le Code du Travail.'], parties: ['Entre le PHMC et M. Test.'], articles: [{ titre: 'Objet', blocs: ['Le présent contrat…'] }],
    signatures: { titre: 'Signatures', employer: { label: 'Employeur', name: 'Dr X', body: '[br][/br]', caption: 'Signature' }, employee: { label: 'Employé', name: 'M. Test', body: '{{SIGNATURE_SALARIE}}', caption: 'Signature{{DATE_SIGNATURE}}' } },
    footer: ['v1 · Document généré par l\'outil PHMC-FR'], ...over,
});

describe('contrats : en-tête et pied de page des rapports', () => {
    test('en-tête à deux cellules (informations du document / logo et titre en grand), sans bloc d’adresse', () => {
        const header = generateContract(doc()).split('[/divbox]')[0];
        expect(header).toContain('[b]Informations du document[/b]');
        expect(header).toContain('Réf. PHMC-RH-2026-AB12C');
        expect(header).toContain('Édité le 15/11/2026');
        expect(header).toContain('[b][size=150]CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE[/size][/b]');
        expect(header).toContain('/img/phmc.png');
        expect(header.match(/\[td\]/g)).toHaveLength(2);
        expect(header).not.toMatch(/BP 742|CENTRE MÉDICAL|50056/);
    });
    test('documents du DMEC : logo PHMC et sceau du DMEC dans l’en-tête', () => {
        const text = generateContract(doc({ service: 'coroner' }));
        expect(text).toContain('[img]https://phmc-tools.com/img/phmc.png[/img][img]https://phmc-tools.com/img/dmec-seal-small.png[/img]');
        expect(text.split('[/divbox]')[0]).toContain('[b]Informations du document[/b]');
    });
    test('se termine par le pied de page commun du PHMC (une seule fois), après la mention légale du contrat', () => {
        const text = generateContract(doc());
        expect(text.endsWith('[/center]')).toBe(true);
        expect(text.split(PHMC_FOOTER_MARK)).toHaveLength(2);
        expect(text.indexOf('Document généré par l\'outil PHMC-FR')).toBeLessThan(text.indexOf(PHMC_FOOTER_MARK));
        expect(withPhmcFooter(text, 3)).toBe(text);
    });
    test('l’aperçu HTML se construit sans balise orpheline', () => {
        const warnings = [];
        const html = bbcodeToHtmlFragment(generateContract(doc()), { onWarning: (message) => warnings.push(message) });
        expect(warnings).toEqual([]);
        expect(html).not.toMatch(/\[\/?(table|tr|td|divbox|divboxcolor|center|size|b)[\]= ]/);
    });
});
