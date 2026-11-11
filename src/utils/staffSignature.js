// src/utils/staffSignature.js
//
// Signature du PERSONNEL qui remplit un rapport : elle figure par défaut au bas de tous les rapports (hors candidatures et dossiers Civils), à côté de son nom et de
// son rôle. Si la personne n'a pas encore de signature (Boîte à outils → Carte de visite & signature), elle est CRÉÉE automatiquement à l'enregistrement à partir de son
// nom (police manuscrite), puis rangée dans « Mes créations », exactement comme pour les contrats.
import { renderSignatureDataUrl, buildSignatureText, SIGNATURE_STYLES } from './signatureRenderer';
import { CREATION_KINDS, loadUserCreations, saveUserCreation, getCachedSignatureUrl } from './userCreations';
import { logActivity } from './activityLog';

// Largeur d'affichage (pixels) de la signature dans l'aperçu et le HTML : la balise [img=largeur] est retirée à la copie du BBCode (utils/internalMail.js : stripImgWidth).
export const REPORT_SIGNATURE_WIDTH = 200;

// Signature prête à imprimer pour cette personne : celle de « Mes créations », sinon une nouvelle créée à partir de son nom. Retourne { url, created }.
// `uploadImageDetailed(dataUrl)` → { url, deleteUrl } (hooks/useImageUpload.js). Ne lève jamais d'erreur bloquante : retourne { url: '', created: false, error } en cas d'échec,
// pour que l'enregistrement du rapport ne soit pas empêché par un hébergeur d'images indisponible.
export const ensureStaffSignature = async ({ uid, name, uploadImageDetailed }) => {
    if (!uid) return { url: '', created: false };
    try {
        const existing = await loadUserCreations(uid);
        if (existing.signature?.url) return { url: existing.signature.url, created: false };
        const text = buildSignatureText(name, { doctor: true });
        if (!text || typeof uploadImageDetailed !== 'function') return { url: '', created: false };
        const styleKey = SIGNATURE_STYLES[0].key;
        const uploaded = await uploadImageDetailed(await renderSignatureDataUrl(text, styleKey));
        const { saved } = await saveUserCreation(uid, CREATION_KINDS.signature, { url: uploaded.url, deleteUrl: uploaded.deleteUrl, text, style: styleKey }, { actorName: name });
        logActivity({ category: 'comptes', action: 'signature_created', summary: `Signature créée automatiquement : ${text}`, details: 'Créée à l\'enregistrement d\'un rapport (aucune signature existante).', target: text });
        return { url: saved.url, created: true };
    } catch (error) {
        console.warn('Signature du personnel non créée :', error?.message || error);
        return { url: '', created: false, error };
    }
};

// Signature à afficher dans l'aperçu avant l'enregistrement : celle déjà connue de ce navigateur (copie locale), sinon rien (le nom seul s'imprime).
export const previewSignatureUrl = () => getCachedSignatureUrl() || '';
