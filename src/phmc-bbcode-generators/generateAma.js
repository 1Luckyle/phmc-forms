// src/phmc-bbcode-generators/generateAma.js
//
// Formulaire AMA (Contre Avis Médical — refus de traitement médical), reconstitué en BBCode : il se copie, se télécharge en HTML / PDF /
// image comme n'importe quel autre rapport, et n'est plus une image téléversée sur ImgBB. Seules les SIGNATURES (images, une par personne)
// sont des images : celle du patient (rangée à son ID patient), celle du paramédic (sa signature créée dans « Ma signature »).
const LOGO_URL = 'https://i.ibb.co/0pgw9hHm/phmc.png';

const signatureCell = ({ imageUrl, typedName, label, caption }) => {
    const mark = imageUrl
        ? `[img]${imageUrl}[/img]`
        : (typedName ? `[size=130][i]${typedName}[/i][/size]` : '[br][/br][br][/br]');
    return `[center]${mark}\n[hr][/hr]\n${label}${caption ? `\n[size=85]${caption}[/size]` : ''}[/center]`;
};

// Patient mineur : le refus est exprimé par son représentant légal (sauf mineur émancipé).
const minorParagraph = ({ patientName, guardianName, guardianRelation, minor, emancipated }) => {
    if (!minor) return '';
    if (emancipated) return '[b]Mineur émancipé :[/b] le patient exprime lui-même ce refus.\n\n';
    return `[b]Patient mineur :[/b] le présent refus est exprimé par [b]${guardianName || '________________'}[/b], ${guardianRelation || 'représentant légal'} de ${patientName || '________________'}, qui reconnaît avoir été informé(e) des risques et des options à la place du patient.\n\n`;
};

// Ce que le formulaire peut garder en mémoire (cases décochées, champs masqués) ne doit pas se retrouver imprimé : un mineur émancipé n'a pas de
// représentant légal, et le lien de parenté n'a de sens que pour un mineur représenté.
export const effectiveGuardian = ({ guardianName = '', guardianRelation = '', minor = false, emancipated = false } = {}) => ({
    guardianName: minor && emancipated ? '' : String(guardianName || '').trim(),
    guardianRelation: minor && !emancipated ? String(guardianRelation || '').trim() : '',
});

const renderAma = ({
    patientName = '', patientSignatureUrl = '', guardianName = '', guardianRelation = '', minor = false, emancipated = false, date = '', paramedicName = '', paramedicSignatureUrl = '',
} = {}) => `[divbox=white][center][img]${LOGO_URL}[/img][/center][/divbox]
[divbox=white][br][/br][center][size=150][b]CONTRE AVIS MÉDICAL (AMA)[/b][/size]
[b]Refus de traitement médical[/b][/center]
[hr][/hr]

Par ma signature ci-dessous, je déclare avoir choisi de :
[list]
[*] Refuser toute aide médicale et/ou évaluation malgré la recommandation du personnel médical d'urgence.
[*] Refuser la poursuite du traitement médical et comprendre pleinement que seuls des soins partiels ont été prodigués.
[*] Refuser le transport vers un établissement de soins d'urgence par le personnel médical d'urgence.
[*] Reconnaître les options qui m'ont été expliquées par les techniciens médicaux d'urgence et accepter de consulter un professionnel de santé ultérieurement, à la date et dans l'établissement médical de mon choix.
[/list]

Je soussigné(e), [b]${patientName || '________________'}[/b], ayant été informé(e) de la nécessité d'accepter une évaluation médicale et/ou un transport vers un établissement de soins, dégage par la présente le [b]Pillbox Hill Emergency Medical Service[/b] ainsi que son personnel de toute responsabilité ultérieure découlant de mon refus de traitement et/ou de transport.
Je reconnais que le personnel médical d'urgence m'a pleinement expliqué les risques et les bénéfices liés au traitement et au transport, et je refuse les services décrits.

${minorParagraph({ patientName, guardianName, guardianRelation, minor, emancipated })}Je reconnais également avoir reçu, à ce jour, une copie de l'[b][u]Avis relatif aux pratiques de confidentialité (H.I.P.A.A.)[/u][/b] du service médical d'urgence de Pillbox Hill.

[table][tr][td]${signatureCell({ imageUrl: patientSignatureUrl, label: 'Signature du patient', caption: patientName })}[/td][td]${signatureCell({ typedName: guardianName, label: 'Signature du représentant légal', caption: guardianName ? guardianRelation : '(si applicable)' })}[/td]
[tr][td][center][size=120]${date || '__/__/____ __:__'}[/size]
[hr][/hr]
Date / Heure (24 h)[/center][/td][td]${signatureCell({ imageUrl: paramedicSignatureUrl, label: 'Signature du paramédic', caption: paramedicName })}[/td]
[/table][/divbox]`;

const generateAma = (params = {}) => renderAma({ ...params, ...effectiveGuardian(params) });

export default generateAma;
