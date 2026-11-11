import { withPhmcFooter, PHMC_FOOTER_MARK, PBC_FOOTER_MARK } from './bbStyles';
import generateCommentaryNotePBC from '../generateCommentaryNotePBC';
import generateCommentaryNotePHMC from '../generateCommentaryNotesPHMC';
import { bbcodeToHtmlFragment } from '../../utils/bbcodeToHtml';
import generateEmergencyProtocol from '../generateEmergencyProtocol';
import generateSurgicalOps from '../generateSurgicalOps';
import generatePsychEvalPHMC from '../generatePsychEvalPHMC';
import generatePsychEvalPBC from '../generatePsychEvalPBC';
import generatePhysEvalInternalMed from '../generatePhysEvalInternalMed';
import generatePhysEvalInternalMedPBC from '../generatePhysEvalInternalMedPBC';
import generateMentalHealthPHMC from '../generateMentalHealthPHMC';
import generateMentalHealthPBC from '../generateMentalHealthPBC';
import generateConsultationNotesPHMC from '../generateConsultationNotesPHMC';
import generateConsultationNotesPBC from '../generateConsultationNotesPBC';

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
    test('en-tête des formulaires soignants : style des dossiers civils, un seul logo, sans coordonnées', () => {
        const data = { phmcEmployee: 'Dr Test', date: '2026-11-08', patientName: 'Jean Test', patientID: 'PHMC-1', patientNotes: 'RAS', lastName: 'Test' };
        const cases = [
            [generateEmergencyProtocol, false, "PROTOCOLE D'URGENCE"], [generateSurgicalOps, false, 'RAPPORT CHIRURGICAL'],
            [generatePsychEvalPHMC, false, 'NOTES DE SESSION'], [generatePsychEvalPBC, true, 'NOTES DE SESSION'],
            [generatePhysEvalInternalMed, false, 'EXAMEN PHYSIQUE'], [generatePhysEvalInternalMedPBC, true, 'EXAMEN PHYSIQUE'],
            [generateMentalHealthPHMC, false, 'NOTES DE SESSION'], [generateMentalHealthPBC, true, 'NOTES DE SESSION'],
            [generateConsultationNotesPHMC, false, 'NOTES DE CONSULTATION'], [generateConsultationNotesPBC, true, 'NOTES DE CONSULTATION'],
            [generateCommentaryNotePHMC, false, 'NOTES DE SERVICE'], [generateCommentaryNotePBC, true, 'NOTES DE SERVICE'],
        ];
        cases.forEach(([generate, pbc, title]) => {
            const header = generate(data).split('[/divbox]')[0];
            expect(header).toContain('[b]Informations du patient[/b]');
            expect(header).toContain(`[b][size=150]${title}[/size][/b]`);
            expect(header.match(/\[img\]/g)).toHaveLength(1);
            expect(header).toContain(pbc ? 'phmcpaletobaylogo.png' : '/img/phmc.png');
            expect(header.match(/\[td\]/g)).toHaveLength(2);
            expect(header).not.toMatch(/BP 742|BP 685|50056|CENTRE MÉDICAL|CLINIQUE DE PALETO/);
        });
    });
    test('s’affiche dans l’aperçu HTML', () => {
        const html = bbcodeToHtmlFragment(withPhmcFooter('[b]Rapport[/b]', 3));
        expect(html).toContain('Pillbox Hill Medical Center');
        expect(html).toContain('Téléphone: 50056');
        expect(html).toContain('phmc-tools.com');
    });
});
