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
const ctx = { coronerOptions: [{ value: 'Dr Légiste', badge: '12', rank: 'Médecin légiste', discord: 'leg#1', phone: '555-0142', email: 'a.b@phmc.health' }], unrestrictedCoronerOptions: [{ value: 'Dr Chef', badge: '1', rank: 'Chef', discord: 'chef#1' }] };
const agencyDataStore = { LSSD: { fullName: 'Los Santos Sheriff Department', logo: '/static/media/lssd.abc.png', forumLogo: 'https://img/lssd.png' }, LSPD: { fullName: 'Los Santos Police Department' } };

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

    test('e-mail DMEC : logo de l’agence (lien web) + sceau du DMEC seul, expéditeur avec son vrai e-mail, rapport joint rendu sans source brute', () => {
        const report = generateDeathReport({ ...getDebugTemplate(1, ctx), agencyDataStore });
        expect(prepareCoronerReport(report).ok).toBe(true);
        const email = generateEmail({ ...getDebugTemplate(2, ctx), department: 'LSSD', agencyDataStore, deathReport: report, additionalReports: [] });
        expect(email).toMatch(/\[table\]\[tr\]\[td\]\[center\]\[img\]https:\/\/img\/lssd\.png\[\/img\]\[\/center\]\[td\]\[center\]\[img\]https:\/\/phmc-tools\.com\/img\/dmec-seal\.png/);
        expect(email).toContain('Expéditeur: Dr Légiste (a.b@phmc.health)');
        expect(email).toContain('Numéro de téléphone: 555-0142');
        expect(email).not.toContain('@ phmc.health');
        // La copie BBCode garde le bloc [code] ; l'aperçu / HTML ne montre jamais la source brute du rapport.
        expect(email).toContain('[code]');
        const html = bbcodeToHtmlFragment(email);
        expect(html).not.toContain('[divbox');
        expect(html).not.toContain('[altspoiler');
    });
});

describe('rapports de médecine légale : aperçu HTML et lecture des rapports joints', () => {
    test.each(Object.keys(GENERATORS).map(Number))('rapport %i : l’aperçu HTML se construit sans balise orpheline', (version) => {
        const text = GENERATORS[version]({ ...getDebugTemplate(version, ctx), agencyDataStore });
        const warnings = [];
        const html = bbcodeToHtmlFragment(text, { onWarning: (message) => warnings.push(message) });
        expect(warnings.filter((message) => !message.includes('[TEST]'))).toEqual([]);
        expect(html).not.toMatch(/\[\/?(table|tr|td|divbox|divboxcolor|list|center|altspoiler|size|b)[\]= ]/);
        expect(html).toContain('<table');
    });

    test('les rapports de décès et de catastrophe mortelle restent reconnus, avec leurs défunts', () => {
        const death = prepareCoronerReport(generateDeathReport({ ...getDebugTemplate(1, ctx), decedentName: 'Pierre Défunt', decedentOOC: 'pierre#42', agencyDataStore }));
        expect(death.ok).toBe(true);
        expect(death.kind).toBe('death');
        expect(death.decedents).toEqual([{ name: 'Pierre Défunt', ooc: 'pierre#42' }]);
        const mass = prepareCoronerReport(generateMassFatality({ ...getDebugTemplate(11, ctx), agencyDataStore }));
        expect(mass.ok).toBe(true);
        expect(mass.kind).toBe('massFatality');
        expect(mass.decedents.length).toBeGreaterThan(0);
    });
});
