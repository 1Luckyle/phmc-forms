// src/utils/contractCompose.js
//
// Affichage d'un contrat déjà FIGÉ : le BBCode gelé à l'envoi contient des repères à la place de la signature de l'employé (sa signature n'existe pas
// encore à l'envoi) ; ce module les remplace à l'affichage. Module minuscule et sans dépendance lourde, pour pouvoir être utilisé partout (exports,
// visionneuse) sans embarquer tout le contenu juridique de contractClauses.js.
import { SIGNATURE_MARKER, SIGNATURE_DATE_MARKER } from '../phmc-bbcode-generators/generateContract';

export const composeContractBb = (frozen, { signature = null, signedAt = null } = {}) => {
    let mark = '[br][/br][br][/br]';
    let when = ' — en attente de signature';
    if (signature) {
        const imageUrl = signature.url || signature.imageData;
        const signedWhen = signedAt || signature.signeLe;
        mark = imageUrl ? `[img]${imageUrl}[/img]` : `[size=130][i]${String(signature.signeParNom || '').replace(/[[\]]/g, '')}[/i][/size]`;
        when = signedWhen ? ` le ${new Date(signedWhen).toLocaleString('fr-FR')} par ${String(signature.signeParNom || 'l\'employé(e)').replace(/[[\]]/g, '')}` : '';
    }
    return String(frozen || '').split(SIGNATURE_MARKER).join(mark).split(SIGNATURE_DATE_MARKER).join(when);
};

// Contrat normalisé (voir contracts.js) → BBCode complet à afficher / exporter. Retourne '' pour un ancien contrat (texte figé seul, sans BBCode).
export const contractBbCode = (contract) => (contract?.bbCodeFige
    ? composeContractBb(contract.bbCodeFige, { signature: contract.signature, signedAt: contract.signeLe })
    : '');
