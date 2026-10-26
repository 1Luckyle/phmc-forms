// src/utils/eyefindMail.js
//
// Aide client pour la messagerie RP Eyefind Mail. La clé API reste côté
// serveur (Secret Manager) : le navigateur ne parle qu'à notre Cloud Function
// sendEyefindMail, jamais directement à eyefind.fr (l'API est explicitement
// réservée à un usage serveur-à-serveur — voir la doc fournie par le staff).
import { auth } from '../firebase';

const SEND_MAIL_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/sendEyefindMail';
const SEND_VERIFICATION_CODE_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/sendEmailVerificationCode';
const VERIFY_EMAIL_CODE_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/verifyEmailCode';
const REQUEST_EMAIL_CHANGE_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/requestStaffEmailChange';
const CONFIRM_EMAIL_CHANGE_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/confirmStaffEmailChange';

// URL où un joueur crée son adresse Eyefind Mail (prenomnom@mail.eyefind.fr)
// s'il n'en a pas encore — affichée dans les formulaires de création de compte.
export const EYEFIND_MAIL_SIGNUP_URL = 'https://eyefind.fr/mail.php';

// Adresse Eyefind Mail d'un joueur : convention prenomnom@mail.eyefind.fr
// (prénom et nom concaténés, sans séparateur — ex: rosecallahan@mail.eyefind.fr).
// Purement dérivée du nom (aucun champ dédié à stocker) : normalise les
// accents/apostrophes/espaces à l'intérieur de chaque partie du nom. Peut se
// tromper sur des noms composés inhabituels — traiter un éventuel
// "recipient_not_found" renvoyé par sendEyefindMail comme non bloquant.
//
// La regex des marques diacritiques combinantes est construite via les codes
// numériques (0x0300-0x036F) plutôt qu'un échappement \u dans le code source,
// pour éviter tout risque de caractère combinant littéral mal interprété
// selon l'encodage de l'éditeur/terminal.
const COMBINING_MARKS_REGEX = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');

const slugifyNamePart = (part) => (part || '')
    .normalize('NFD').replace(COMBINING_MARKS_REGEX, '') // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ''); // ne garde que lettres/chiffres

export const deriveEyefindAddress = (firstName, lastName) => {
    const f = slugifyNamePart(firstName);
    const l = slugifyNamePart(lastName);
    if (!f || !l) return null;
    return `${f}${l}@mail.eyefind.fr`;
};

// Envoie un mail Eyefind. Ne lève jamais pour les erreurs "attendues" de
// l'API (destinataire introuvable, doublon, limite de débit...) — retourne
// plutôt { ok: false, error, message } pour que l'appelant puisse choisir de
// les ignorer silencieusement (un mail raté ne doit jamais bloquer l'action
// principale : approbation de compte, changement de grade, etc.).
export const sendEyefindMail = async ({ to, subject, body, html }) => {
    if (!to || !subject || !body) {
        return { ok: false, error: 'invalid-argument', message: 'Destinataire, sujet et corps du mail sont obligatoires.' };
    }

    try {
        // La fonction exige le jeton Firebase de la personne connectée : sans lui, n'importe qui pourrait
        // faire envoyer des mails au nom du PHMC.
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
            return { ok: false, error: 'unauthorized', message: 'Vous devez être connecté pour envoyer un mail.' };
        }
        const response = await fetch(SEND_MAIL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ to, subject, body, html }),
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            return { ok: false, error: 'invalid-response', message: `Réponse invalide du serveur de mail. Reçue : ${text.substring(0, 200)}` };
        }

        if (!response.ok) {
            return { ok: false, error: data.error || 'send-failed', message: data.message || 'Échec de l\'envoi du mail.' };
        }

        return { ok: true, messageId: data.message_id, warnings: data.warnings || [] };
    } catch (err) {
        console.error('Failed to send Eyefind Mail:', err);
        return { ok: false, error: 'network-error', message: err.message || 'Erreur réseau lors de l\'envoi du mail.' };
    }
};

// Envoie un code de vérification à 6 chiffres à l'adresse Eyefind Mail
// indiquée — étape obligatoire avant la création d'un compte Civil (voir
// CivilianAuthPanel.js). Ne lève jamais : retourne { ok:false, message } pour
// affichage direct dans l'interface.
export const sendEmailVerificationCode = async (email) => {
    try {
        const response = await fetch(SEND_VERIFICATION_CODE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, error: data.error, message: data.message || 'Échec de l\'envoi du code de vérification.' };
        }
        return { ok: true };
    } catch (err) {
        console.error('Failed to send email verification code:', err);
        return { ok: false, error: 'network-error', message: 'Erreur réseau lors de l\'envoi du code.' };
    }
};

// Vérifie le code saisi par l'utilisateur. Retourne { ok:true } si valide.
export const verifyEmailCode = async (email, code) => {
    try {
        const response = await fetch(VERIFY_EMAIL_CODE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, error: data.error, message: data.message || 'Code de vérification invalide.' };
        }
        return { ok: true };
    } catch (err) {
        console.error('Failed to verify email code:', err);
        return { ok: false, error: 'network-error', message: 'Erreur réseau lors de la vérification du code.' };
    }
};

// Adresse modifiable ? Seules les adresses Eyefind Mail le sont : une adresse d'ancien système de
// connexion (Gmail…) sert d'identifiant de connexion par mot de passe et ne doit pas changer.
export const isEyefindAddress = (email) => /^[^\s@]+@mail\.eyefind\.fr$/i.test(String(email || '').trim());

// Appel authentifié (jeton Firebase de la personne connectée) d'une fonction de changement d'adresse.
// Ne lève jamais : retourne { ok, message } pour affichage direct. targetUid : compte visé
// (facultatif, réservé aux admins — par défaut, le compte de la personne connectée).
const callEmailChange = async (url, payload) => {
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return { ok: false, error: 'unauthorized', message: 'Vous devez être connecté.' };
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return { ok: false, error: data.error, message: data.message || 'Échec de la demande.' };
        return { ok: true, ...data };
    } catch (err) {
        console.error('Failed to call email change function:', err);
        return { ok: false, error: 'network-error', message: 'Erreur réseau.' };
    }
};

// Étape 1 : envoie un code à 6 chiffres à la NOUVELLE adresse.
export const requestStaffEmailChange = (newEmail, targetUid = null) =>
    callEmailChange(REQUEST_EMAIL_CHANGE_URL, { newEmail, targetUid });

// Étape 2 : le code saisi valide le changement (compte de connexion + fiche mis à jour côté serveur).
export const confirmStaffEmailChange = (code, targetUid = null) =>
    callEmailChange(CONFIRM_EMAIL_CHANGE_URL, { code, targetUid });
