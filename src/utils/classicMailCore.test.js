import { CLASSIC_NOTIFY_TEMPLATES, mailTextForNotification, cleanTemplateVars } from '../../functions/classicMailCore';
import { MAIL_TEMPLATES } from './mailTemplatesCore';

describe('version classique : mails changés en notifications', () => {
    test('chaque modèle converti existe bien parmi les modèles de mail', () => {
        const ids = Object.keys(MAIL_TEMPLATES || {});
        Object.keys(CLASSIC_NOTIFY_TEMPLATES).forEach((id) => expect(ids).toContain(id));
    });

    test('les modèles déjà doublés d’une notification, ou visant un compte supprimé, ne sont pas convertis (pas de doublon)', () => {
        ['document_a_signer', 'document_notifie', 'compte_civil_supprime', 'fin_fonctions_compte_supprime', 'verification_creation_compte']
            .forEach((id) => expect(CLASSIC_NOTIFY_TEMPLATES[id]).toBeUndefined());
    });

    test('texte de la cloche : sans formule d’appel ni mise en forme, 400 caractères au plus', () => {
        const body = 'Bonjour Rose,\n\nVotre compte est **approuvé**.\n\nConnectez-vous à [l’outil](https://phmc-tools.com/).';
        expect(mailTextForNotification(body)).toBe('Votre compte est approuvé.\nConnectez-vous à l’outil.');
        expect(mailTextForNotification('x'.repeat(1000))).toHaveLength(400);
    });

    test('variables envoyées par le navigateur : clés simples, texte court, 15 au plus', () => {
        const vars = cleanTemplateVars({ nom: 'Rose', grade: 3, 'mauvaise clé': 'x', objet: { a: 1 }, long: 'y'.repeat(500) });
        expect(vars).toEqual({ nom: 'Rose', grade: '3', long: 'y'.repeat(200) });
        expect(Object.keys(cleanTemplateVars(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${'a'.repeat(i % 5)}_${String.fromCharCode(97 + (i % 26))}`, 'v']))))).toHaveLength(15);
    });
});
