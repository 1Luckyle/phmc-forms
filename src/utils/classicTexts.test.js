jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));

const { setSiteModeNow, siteText, exampleEmail, phmcContactEmail, testEmail } = require('./siteModeNow');
const { DEFAULT_POLICY_TEXT, DEFAULT_POLICY_TEXT_CLASSIC, documentInfo } = require('./privacyPolicy');
const { LEGAL_NOTICE_TEXT_CLASSIC } = require('./legalNotice');
const { getFieldInfo } = require('../constants/fieldInfo');
const { phmcFooter, pbcFooter } = require('../phmc-bbcode-generators/shared/bbStyles');

const GTAW_WORDS = /GTA ?World|GTAW|Eyefind|eyefind|Fleeca|gta\.world|\bUCP\b/;

describe('version classique : aucune mention de GTA World, d’Eyefind ni de Fleeca', () => {
    afterEach(() => setSiteModeNow('gtaw'));

    test('version GTA World : les textes ne changent pas', () => {
        setSiteModeNow('gtaw');
        expect(exampleEmail()).toBe('prenomnom@mail.eyefind.fr');
        expect(siteText('forum GTA World')).toBe('forum GTA World');
        expect(phmcFooter()).toMatch(/info\.phmc@mail\.eyefind\.fr/);
        expect(documentInfo('politique').texte).toBe(DEFAULT_POLICY_TEXT);
        expect(documentInfo('politique').path).toBe('adminSettings/politiqueConfidentialite');
    });

    test('exemples d’adresse, forum, contact et données de test', () => {
        setSiteModeNow('classique');
        expect(exampleEmail()).toBe('prenom.nom@phmc.health');
        expect(testEmail('jean', 'testard')).toBe('jean.testard@phmc.health');
        expect(phmcContactEmail()).toBe('contact@phmc.health');
        expect(siteText('télécharger le HTML (forum GTA World), ex. prenomnom@mail.eyefind.fr')).toBe('télécharger le HTML (forum du serveur), ex. prenom.nom@phmc.health');
    });

    test('aide des champs et pieds de page des documents', () => {
        setSiteModeNow('classique');
        expect(getFieldInfo(25, 'patientEmail').help).not.toMatch(GTAW_WORDS);
        expect(getFieldInfo(25, 'patientEmail', 'email').help).toMatch(/phmc\.health/);
        expect(getFieldInfo(0, 'unChampInconnu', 'email').help).toMatch(/prenom\.nom@phmc\.health/);
        expect(phmcFooter()).not.toMatch(GTAW_WORDS);
        expect(pbcFooter()).not.toMatch(GTAW_WORDS);
    });

    test('politique de confidentialité et mentions légales : textes classiques, rangés à part', () => {
        expect(DEFAULT_POLICY_TEXT_CLASSIC).not.toMatch(GTAW_WORDS);
        expect(LEGAL_NOTICE_TEXT_CLASSIC).not.toMatch(GTAW_WORDS);
        expect(DEFAULT_POLICY_TEXT_CLASSIC).toMatch(/Discord/);
        expect(DEFAULT_POLICY_TEXT_CLASSIC).toMatch(/paiements se font en jeu/);
        setSiteModeNow('classique');
        expect(documentInfo('politique')).toMatchObject({ path: 'adminSettings/politiqueConfidentialiteClassique', texte: DEFAULT_POLICY_TEXT_CLASSIC });
        expect(documentInfo('mentions')).toMatchObject({ path: 'adminSettings/mentionsLegalesClassique', texte: LEGAL_NOTICE_TEXT_CLASSIC });
    });
});
