// src/phmc-bbcode-generators/generateExternalMail.js
//
// Mail Externe (formulaire 42) : un courrier modèle destiné à être envoyé HORS du site (à un particulier, une entreprise, une administration), avec une mise en page plus soignée que celle
// d'un message Discord. Mêmes codes que la messagerie interne (objet, destinataire, expéditeur avec sa fonction et son département, texte mis en forme, signature) ; il n'y a ni ID patient
// ni dossier patient. Se termine par la signature de la personne qui l'a rempli et le pied de page commun des courriels (shared/bbStyles.js).
import { staffSignatureBlock, mailFooter, escapeBbText } from './shared/bbStyles';

const pad = (n) => String(n).padStart(2, '0');
const todayFr = () => { const now = new Date(); return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`; };

const generateExternalMail = (formData) => {
    const f = formData || {};
    const signerBase = f.signer && f.signer.name ? f.signer : { name: f.phmcEmployee || 'Employé PHMC', rank: f.phmcRank || '', service: '', signatureUrl: '' };
    // La fonction et le département saisis dans le formulaire priment sur ceux du profil.
    const signer = { ...signerBase, rank: f.externalMailFonction || signerBase.rank, service: f.externalMailService || signerBase.service };
    const recipient = [f.externalMailRecipient, f.externalMailRecipientAddress ? `<${f.externalMailRecipientAddress}>` : ''].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
    const role = [signer.rank, signer.service].map((part) => String(part || '').trim()).filter(Boolean).join(' — ');
    const body = String(f.externalMailBody || '').trim() || '[i]Le texte du courrier est vide.[/i]';

    return `[divbox=na][br][/br][imageleft]https://phmc-tools.com/img/phmc-curve.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b]
[center][/center][br][/br]
[center][size=150][b]${escapeBbText(f.externalMailSubject || '(sans objet)')}[/b][/size][/center]

[b]À :[/b] ${escapeBbText(recipient || '—')}
[b]De :[/b] ${escapeBbText(signer.name)}${role ? ` (${escapeBbText(role)})` : ''}
[b]Le :[/b] ${escapeBbText(f.externalMailDate || todayFr())}
[hr][/hr][br][/br][list=none]
${body}
[/list][br][/br]
${staffSignatureBlock(signer)}
${mailFooter()}[/divbox]`;
};

export default generateExternalMail;
