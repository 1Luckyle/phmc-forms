// Messagerie interne : conversion de l'éditeur visuel en BBCode, texte brut, validation d'un brouillon et document d'un message.
import { htmlToBbcode, bbcodeToPlainText, validateMailDraft, messageToBbcode, MAIL_LIMITS } from './internalMail';
import { bbcodeToHtmlFragment } from './bbcodeToHtml';

// Le module charge Firebase : on le remplace (aucune connexion dans ces tests).
jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), push: jest.fn(), set: jest.fn(), get: jest.fn(), update: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));
jest.mock('./staffAdmin', () => ({ loadStaffMembers: jest.fn() }));
jest.mock('./notifications', () => ({ notifyUser: jest.fn() }));

const toBb = (html) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    return htmlToBbcode(root);
};

describe('htmlToBbcode', () => {
    test('mises en forme simples', () => {
        expect(toBb('<b>gras</b> et <i>italique</i> et <u>souligné</u>')).toBe('[b]gras[/b] et [i]italique[/i] et [u]souligné[/u]');
        expect(toBb('<strong>a</strong><em>b</em>')).toBe('[b]a[/b][i]b[/i]');
    });

    test('lignes : <br> et blocs', () => {
        expect(toBb('ligne 1<br>ligne 2')).toBe('ligne 1\nligne 2');
        expect(toBb('<div>un</div><div>deux</div>')).toBe('un\n\ndeux');
        expect(toBb('<div>un</div><div><br></div><div>trois</div>')).toBe('un\n\ntrois');
    });

    test('listes à puces et numérotées', () => {
        expect(toBb('<ul><li>a</li><li>b</li></ul>')).toBe('[list]\n[*]a\n[*]b\n[/list]');
        expect(toBb('<ol><li>a</li></ol>')).toBe('[list=1]\n[*]a\n[/list]');
    });

    test('lien, image, citation, séparateur', () => {
        expect(toBb('<a href="https://exemple.fr/x">le site</a>')).toBe('[url=https://exemple.fr/x]le site[/url]');
        expect(toBb('<img src="https://i.ibb.co/abc/photo.png">')).toBe('[img]https://i.ibb.co/abc/photo.png[/img]');
        expect(toBb('<blockquote>cité</blockquote>')).toBe('[quote]cité[/quote]');
        expect(toBb('avant<hr>après')).toContain('[hr][/hr]');
    });

    test('couleur et taille (balises font / style)', () => {
        expect(toBb('<font color="#ff0000">rouge</font>')).toBe('[color=#ff0000]rouge[/color]');
        expect(toBb('<font size="5">grand</font>')).toBe('[size=150]grand[/size]');
        expect(toBb('<span style="color: rgb(255, 0, 0);">rouge</span>')).toBe('[color=#ff0000]rouge[/color]');
        expect(toBb('<span style="font-weight: bold;">g</span>')).toBe('[b]g[/b]');
    });

    test('liens et images dangereux ignorés', () => {
        expect(toBb('<a href="javascript:alert(1)">piège</a>')).toBe('piège');
        expect(toBb('<img src="data:image/png;base64,AAAA">')).toBe('');
        expect(toBb('<img src="javascript:alert(1)">')).toBe('');
    });

    test('un [mot] saisi ne devient pas une balise BBCode', () => {
        const bb = toBb('voir [b]ceci[/b] et [url=http://x]là[/url]');
        expect(bb).not.toContain('[b]');
        expect(bb).not.toContain('[url=');
        expect(bb).toContain('［b］ceci［/b］');
    });

    test('éléments vides ignorés', () => {
        expect(toBb('<b></b>texte<i></i>')).toBe('texte');
        expect(toBb('')).toBe('');
    });

    test('le BBCode produit est rendu en HTML par le site (aperçu, PDF, PNG)', () => {
        const html = bbcodeToHtmlFragment(toBb('<b>Bonjour</b><ul><li>un</li></ul><a href="https://exemple.fr">lien</a>'));
        expect(html).toContain('<b>Bonjour</b>');
        expect(html).toContain('href="https://exemple.fr"');
        expect(html).toContain('un');
    });
});

describe('bbcodeToPlainText', () => {
    test('retire les balises et garde le sens', () => {
        expect(bbcodeToPlainText('[b]Bonjour[/b] [url=https://x.fr]le site[/url]')).toBe('Bonjour le site (https://x.fr)');
        expect(bbcodeToPlainText('[list]\n[*]a\n[*]b\n[/list]')).toContain('• a');
        expect(bbcodeToPlainText('[img]https://i.ibb.co/a.png[/img]')).toBe('[image]');
        expect(bbcodeToPlainText('［b］ceci［/b］')).toBe('[b]ceci[/b]');
    });
});

describe('validateMailDraft', () => {
    const ok = { objet: 'Objet', corps: 'Corps', destinataires: [{ uid: 'u1', nom: 'A' }] };
    test('un brouillon complet est valide', () => expect(validateMailDraft(ok)).toEqual([]));
    test('objet, destinataire et corps sont obligatoires', () => {
        expect(validateMailDraft({ ...ok, objet: '  ' })).toHaveLength(1);
        expect(validateMailDraft({ ...ok, destinataires: [] })).toHaveLength(1);
        expect(validateMailDraft({ ...ok, corps: '' })).toHaveLength(1);
    });
    test('limites de taille', () => {
        expect(validateMailDraft({ ...ok, corps: 'x'.repeat(MAIL_LIMITS.body + 1) })).toHaveLength(1);
        const many = Array.from({ length: MAIL_LIMITS.recipients + 1 }, (_, i) => ({ uid: `u${i}`, nom: 'x' }));
        expect(validateMailDraft({ ...ok, destinataires: many })).toHaveLength(1);
    });
});

describe('messageToBbcode', () => {
    test('en-tête (objet, de, à, date) puis corps', () => {
        const bb = messageToBbcode({ objet: 'Réunion', deNom: 'Dr A', dest: { u1: 'Dr B', u2: 'Dr C' }, creeLe: new Date(2026, 10, 6, 9, 5).getTime(), corps: 'Texte' });
        expect(bb).toContain('[b]Réunion[/b]');
        expect(bb).toContain('[b]De :[/b] Dr A');
        expect(bb).toContain('[b]À :[/b] Dr B, Dr C');
        expect(bb).toContain('06/11/2026 à 09:05');
        expect(bb.endsWith('Texte')).toBe(true);
    });
    test('un objet contenant des balises ne casse pas la mise en page', () => {
        expect(messageToBbcode({ objet: '[b]piège[/b]', deNom: 'x', dest: {}, creeLe: 1, corps: 'c' })).not.toContain('[b][b]');
    });
});
