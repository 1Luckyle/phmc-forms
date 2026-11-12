import {
    messageLinkPath, posteLinkPath, candidatureLinkPath, messageLinkUrl, posteLinkUrl, candidatureLinkUrl, parseDeepLink, deepLinkPathOf,
} from './deepLinks';
import { peekPendingReportLink, rememberPendingReportLink, clearPendingReportLink } from './reportLinks';

describe('liens directs (message, poste, candidature)', () => {
    test('chemins et adresses complètes', () => {
        expect(messageLinkPath('-NabcDEF123')).toBe('/message/-NabcDEF123');
        expect(messageLinkUrl('-Nabc', 'https://phmc-tools.com/')).toBe('https://phmc-tools.com/#/message/-Nabc');
        expect(candidatureLinkUrl('uid1', '-Nxyz', 'https://phmc-tools.com/')).toBe('https://phmc-tools.com/#/candidature/uid1/-Nxyz');
        // la clé d'un poste est son nom : espaces et accents encodés
        expect(posteLinkPath('medecine', 'Médecin titulaire')).toBe('/poste/medecine/M%C3%A9decin%20titulaire');
        expect(posteLinkUrl('medecine', 'Médecin titulaire', 'https://x.fr/')).toBe('https://x.fr/#/poste/medecine/M%C3%A9decin%20titulaire');
    });

    test('un morceau invalide ne donne aucun lien', () => {
        ['', null, undefined, 'a/b', 'a.b', 'a#b', 'a$b', 'a[b]', 'x'.repeat(201)].forEach((bad) => {
            expect(messageLinkPath(bad)).toBe('');
            expect(candidatureLinkPath('uid', bad)).toBe('');
            expect(posteLinkPath('medecine', bad)).toBe('');
        });
        expect(posteLinkPath('categorie_inconnue', 'Poste')).toBe('');
        expect(messageLinkUrl('', 'https://x.fr/')).toBe('');
    });

    test('lecture des paramètres de l\'adresse', () => {
        expect(parseDeepLink('message', { id: '-Nabc' })).toEqual({ cible: 'message', id: '-Nabc' });
        expect(parseDeepLink('poste', { category: 'paramedical', key: 'Ambulancier' })).toEqual({ cible: 'poste', categorie: 'paramedical', cle: 'Ambulancier' });
        expect(parseDeepLink('candidature', { uid: 'u1', id: '-N1' })).toEqual({ cible: 'candidature', uid: 'u1', id: '-N1' });
        expect(parseDeepLink('message', { id: 'a/../b' })).toBeNull();
        expect(parseDeepLink('poste', { category: 'inconnue', key: 'x' })).toBeNull();
        expect(parseDeepLink('candidature', { uid: 'u1' })).toBeNull();
        expect(parseDeepLink('autre', { id: 'x' })).toBeNull();
    });

    test('cible -> chemin : aller-retour', () => {
        [{ cible: 'message', id: '-Nabc' }, { cible: 'poste', categorie: 'medecine', cle: 'Médecin titulaire' }, { cible: 'candidature', uid: 'u1', id: '-N1' }]
            .forEach((target) => {
                const path = deepLinkPathOf(target);
                expect(path).not.toBe('');
                const [, kind, ...rest] = path.split('/');
                const params = kind === 'message' ? { id: rest[0] } : kind === 'poste' ? { category: rest[0], key: rest[1] } : { uid: rest[0], id: rest[1] };
                const decoded = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, decodeURIComponent(v)]));
                expect(parseDeepLink(kind, decoded)).toEqual(target);
            });
        expect(deepLinkPathOf(null)).toBe('');
    });

    test('un lien en attente de connexion est retenu pour tous les types de liens', () => {
        clearPendingReportLink();
        ['/message/-Nabc', '/poste/medecine/Poste', '/candidature/u1/-N1', '/rapport/a/b'].forEach((path) => {
            rememberPendingReportLink(path, 1000);
            expect(peekPendingReportLink(2000)).toBe(path);
        });
        rememberPendingReportLink('/admin', 1000);
        expect(peekPendingReportLink(2000)).toBe('');
        clearPendingReportLink();
    });
});
