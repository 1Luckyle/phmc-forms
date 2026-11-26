import { cleanName, isValidName, fakeEmailFor, emailKeyOf, sanitizeCivilProfile, sanitizeStaffRequest, characterView, withTitlePrefix, openTemporaryIdsFor, namesMatch } from '../../functions/discordCore';
import { captureDiscordRedirect, takeDiscordFlow, DISCORD_FLOW_KEY, isDiscordResultFresh } from './discordOAuth';

describe('connexion Discord : fonctions du serveur', () => {
    test('adresse fictive prenom.nom@phmc.health, sans accent ni séparateur, numérotée en cas de doublon', () => {
        expect(fakeEmailFor('Rose', 'Callahan')).toBe('rose.callahan@phmc.health');
        expect(fakeEmailFor('Élodie-Anne', "O'Brien")).toBe('elodieanne.obrien@phmc.health');
        expect(fakeEmailFor('Rose', 'Callahan', new Set(['rose.callahan@phmc.health', 'rose.callahan2@phmc.health']))).toBe('rose.callahan3@phmc.health');
    });

    test('nom de personnage : lettres, espaces, tirets, apostrophes', () => {
        expect(isValidName('Jean-Luc')).toBe(true);
        expect(isValidName("D'Artagnan")).toBe(true);
        expect(isValidName('Zoé')).toBe(true);
        expect(isValidName('')).toBe(false);
        expect(isValidName('R2D2')).toBe(false);
        expect(isValidName('<script>')).toBe(false);
        expect(cleanName('  Jean   Paul ')).toBe('Jean Paul');
    });

    test('clé de nœud dérivée de l’adresse, comme sur le site', () => {
        expect(emailKeyOf('rose.callahan@phmc.health')).toBe('rose_callahan@phmc_health');
    });

    test('profil Civil : seuls les champs prévus sont repris, et filtrés', () => {
        const profile = sanitizeCivilProfile({ dateOfBirth: '1990-05-17', gender: 'Female', phone: '555', patientID: 'PHMC-1', firstName: 'Pirate', gender2: 'x' });
        expect(profile).toEqual({ middleName: '', dateOfBirth: '1990-05-17', gender: 'Female', address: '', zip: '', phone: '555', discord: '' });
        expect(sanitizeCivilProfile({ dateOfBirth: 'hier', gender: 'Robot' })).toMatchObject({ dateOfBirth: '', gender: '' });
    });

    test('demande du personnel : le nom, l’uid ou l’ID patient ne viennent jamais de la saisie', () => {
        const request = sanitizeStaffRequest({ rank: 'Interne', badge: 'MD-12345', discord: 'rose', phNumber: '555', name: 'Autre', uid: 'x', patientID: 'PHMC-9', address: '1 rue' });
        expect(request).toEqual({ discord: 'rose', phNumber: '555', rank: 'Interne', category: 'Interne', badge: 'MD-12345', address: '1 rue' });
    });

    test('titre des médecins : seuls « Dr. » et « Pr. » sont acceptés, ajoutés devant le prénom', () => {
        expect(withTitlePrefix('Rose', 'Dr.')).toBe('Dr. Rose');
        expect(withTitlePrefix('Rose', 'Pr.')).toBe('Pr. Rose');
        expect(withTitlePrefix('Rose', 'Sir')).toBe('Rose');
        expect(withTitlePrefix('Rose', undefined)).toBe('Rose');
    });

    test('nouveau personnage : les ID temporaires encore ouverts au même nom sont signalés (jamais ceux déjà attribués)', () => {
        const registry = {
            'TMP-AB2CD': { nom: 'Callahan Rose', statut: 'temporaire' },
            'TMP-EF3GH': { nom: 'Rose Callahan', statut: 'attribue', idReel: 'PHMC-1' },
            'TMP-JK4LM': { nom: 'Max Payne', statut: 'temporaire' },
        };
        expect(openTemporaryIdsFor(registry, 'Rose Callahan')).toEqual([{ id: 'TMP-AB2CD', nom: 'Callahan Rose' }]);
        expect(openTemporaryIdsFor(registry, 'Rose')).toEqual([]);
        expect(namesMatch('Élodie Brun', 'elodie BRUN')).toBe(true);
    });

    test('vue d’un personnage : compte actif et demande en attente indépendants', () => {
        const entry = { prenom: 'Rose', nom: 'Callahan', patientID: 'PHMC-01234', email: 'secret@phmc.health', uid: 'u1' };
        const view = characterView('p1', entry, { account: { type: 'civilian' }, pending: true });
        expect(view).toEqual({ id: 'p1', firstName: 'Rose', lastName: 'Callahan', patientID: 'PHMC-01234', account: { type: 'civilian' }, pending: true });
        expect(view.email).toBeUndefined();
    });
});

describe('connexion Discord : retour sur le site', () => {
    test('le retour de Discord sur la racine devient la route du callback ; une autre adresse n’est pas touchée', () => {
        const history = { replaceState: jest.fn() };
        expect(captureDiscordRedirect({ search: '?code=abc&state=dc_123', pathname: '/' }, history)).toBe(true);
        expect(history.replaceState).toHaveBeenCalledWith(null, '', '/#/auth/discord/callback?code=abc&state=dc_123');
        const other = { replaceState: jest.fn() };
        expect(captureDiscordRedirect({ search: '?code=abc&state=autre', pathname: '/' }, other)).toBe(false);
        expect(captureDiscordRedirect({ search: '', pathname: '/' }, other)).toBe(false);
        expect(other.replaceState).not.toHaveBeenCalled();
    });

    test('le state reçu doit être celui mémorisé au départ (une seule fois)', () => {
        sessionStorage.setItem(DISCORD_FLOW_KEY, JSON.stringify({ type: 'login', state: 'dc_ok' }));
        expect(takeDiscordFlow('dc_forge')).toBeNull();
        sessionStorage.setItem(DISCORD_FLOW_KEY, JSON.stringify({ type: 'login', state: 'dc_ok' }));
        expect(takeDiscordFlow('dc_ok')).toMatchObject({ type: 'login' });
        expect(takeDiscordFlow('dc_ok')).toBeNull();
    });

    test('un ticket expiré oblige à repasser par Discord', () => {
        expect(isDiscordResultFresh({ ticket: 't', expiresAt: Date.now() + 10 * 60 * 1000 })).toBe(true);
        expect(isDiscordResultFresh({ ticket: 't', expiresAt: Date.now() + 5 * 1000 })).toBe(false);
        expect(isDiscordResultFresh(null)).toBe(false);
    });
});
