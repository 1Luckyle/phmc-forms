import { reportLinkPath, reportLinkUrl, reportPathFromParams, linkTargetOf, rememberPendingReportLink, peekPendingReportLink, clearPendingReportLink } from './reportLinks';

describe('liens directs vers un rapport', () => {
    test('chemin du routeur et lien complet', () => {
        expect(reportLinkPath('savedReports/Dr_Adrien_Valmont/-Nabc123')).toBe('/rapport/Dr_Adrien_Valmont/-Nabc123');
        expect(reportLinkUrl('savedReports/Dr_Adrien_Valmont/-Nabc123', 'https://phmc-tools.com/')).toBe('https://phmc-tools.com/#/rapport/Dr_Adrien_Valmont/-Nabc123');
        expect(reportLinkUrl('savedReports/Dr_Test/Rapport_copie_1700000000000', 'https://x.fr/app/')).toBe('https://x.fr/app/#/rapport/Dr_Test/Rapport_copie_1700000000000');
    });

    test('un chemin qui n\'est pas celui d\'un rapport ne donne aucun lien', () => {
        ['', null, undefined, 'users/abc', 'savedReports/seul', 'savedReports/a/b/c', 'savedReports/a.b/c', 'savedReports/a/b#c'].forEach((path) => expect(reportLinkPath(path)).toBe(''));
        expect(reportLinkUrl('users/abc', 'https://x.fr/')).toBe('');
    });

    test("le chemin Firebase se retrouve d'après l'adresse, et refuse tout ce qui pourrait en sortir", () => {
        expect(reportPathFromParams('Dr_Test', '-Nabc123')).toBe('savedReports/Dr_Test/-Nabc123');
        ['..', 'a/b', 'a.b', 'a#b', 'a$b', '', undefined, 'a b'].forEach((bad) => {
            expect(reportPathFromParams(bad, '-Nabc')).toBe('');
            expect(reportPathFromParams('Dr_Test', bad)).toBe('');
        });
    });

    test('une copie renvoie vers le rapport original (les copies sont privées)', () => {
        expect(linkTargetOf({ reportPath: 'savedReports/B/copie', isCopy: true, copiedFrom: { reportPath: 'savedReports/A/orig' } })).toBe('savedReports/A/orig');
        expect(linkTargetOf({ reportPath: 'savedReports/A/orig' })).toBe('savedReports/A/orig');
        expect(linkTargetOf({ reportPath: 'savedReports/B/copie', isCopy: true })).toBe('savedReports/B/copie');
        expect(linkTargetOf(null)).toBe('');
    });

    test("le lien ouvert sans être connecté est retenu, puis oublié : à la connexion, ou après 30 minutes", () => {
        clearPendingReportLink();
        expect(peekPendingReportLink()).toBe('');
        rememberPendingReportLink('/rapport/Dr_Test/-Nabc', 1000);
        expect(peekPendingReportLink(1000 + 60 * 1000)).toBe('/rapport/Dr_Test/-Nabc');
        expect(peekPendingReportLink(1000 + 31 * 60 * 1000)).toBe('');
        clearPendingReportLink();
        expect(peekPendingReportLink(1000)).toBe('');
        // Une valeur qui n'est pas un lien de rapport n'est jamais suivie.
        sessionStorage.setItem('pendingReportLink', `${Date.now()}|https://evil.example/`);
        expect(peekPendingReportLink()).toBe('');
        clearPendingReportLink();
    });
});
