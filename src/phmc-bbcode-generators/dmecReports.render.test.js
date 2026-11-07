import generateDeathReport from './generateDeathReport';
import generateEmail from './generateEmail';
import generateAutopsy from './generateAutopsy';
import generateCertificate from './generateCertificate';
import generateMassFatality from './generateMassFatality';
import generateDeathRecord from './generateDeathRecord';
import { getDebugTemplate } from '../utils/debugTemplates';
import { prepareCoronerReport } from '../utils/coronerAttachments';
import { bbcodeToHtmlFragment } from '../utils/bbcodeToHtml';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn() }));

const GENERATORS = { 1: generateDeathReport, 4: generateAutopsy, 8: generateCertificate, 11: generateMassFatality, 37: generateDeathRecord };
const ctx = { coronerOptions: [{ value: 'Dr Légiste', badge: '12', rank: 'Médecin légiste', discord: 'leg#1' }], unrestrictedCoronerOptions: [{ value: 'Dr Chef', badge: '1', rank: 'Chef', discord: 'chef#1' }] };
const agencyDataStore = { LSSD: { fullName: 'Los Santos Sheriff Department', logo: 'https://img/lssd.png' }, LSPD: { fullName: 'Los Santos Police Department' } };

describe('rapports de médecine légale : construction', () => {
    test.each(Object.keys(GENERATORS).map(Number))('rapport %i : pas de valeur manquante, pas de saut de ligne doublé, libellés en français', (version) => {
        const data = { ...getDebugTemplate(version, ctx), agencyDataStore };
        const text = GENERATORS[version](data);
        expect(text).not.toMatch(/undefined|\[object Object\]/);
        expect(text).not.toMatch(/\n\n\n\n/);
        expect(text).not.toMatch(/\b(Natural|Accident|Undetermined|Homicide|Suicide)\b - /);
    });

    test('rapport de décès : l\'agence qui a appelé et le demandeur du rapport sont distincts', () => {
        const text = generateDeathReport({ ...getDebugTemplate(1, ctx), department: 'LSSD', showRequestingOfficerInput: true, requestingAgency: 'LSPD', requestingOfficer: 'Officier Jane Roe', agencyDataStore });
        expect(text).toMatch(/appel de\[b\] Los Santos Sheriff Department/);
        expect(text).toContain('demandé par [b]Officier Jane Roe[/b] (Los Santos Police Department)');
        const unchecked = generateDeathReport({ ...getDebugTemplate(1, ctx), department: 'LSSD', showRequestingOfficerInput: false, requestingAgency: 'LSPD', requestingOfficer: 'Officier Jane Roe', agencyDataStore });
        expect(unchecked).not.toContain('Officier Jane Roe');
    });

    test('e-mail DMEC : logos agence + coroner, expéditeur avec son vrai e-mail, rapport joint rendu sans source brute', () => {
        const report = generateDeathReport({ ...getDebugTemplate(1, ctx), agencyDataStore });
        expect(prepareCoronerReport(report).ok).toBe(true);
        const email = generateEmail({ ...getDebugTemplate(2, ctx), department: 'LSSD', agencyDataStore, deathReport: report, additionalReports: [], coronerEmail: 'a.b@phmc.health' });
        expect(email).toMatch(/\[table\]\[tr\]\[td\]\[center\]\[img\]https:\/\/img\/lssd\.png\[\/img\]\[\/center\]\[td\]\[center\]\[img\]https:\/\/phmc-tools\.com\/img\/ItaoQkO\.webp/);
        expect(email).toContain('EXPÉDITEUR: Dr Légiste (a.b@phmc.health)');
        expect(email).not.toContain('@ phmc.health');
        // La copie BBCode garde le bloc [code] ; l'aperçu / HTML ne montre jamais la source brute du rapport.
        expect(email).toContain('[code]');
        const html = bbcodeToHtmlFragment(email);
        expect(html).not.toContain('[divbox');
        expect(html).not.toContain('[altspoiler');
    });
});
