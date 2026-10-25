// src/utils/imageUploadApi.js
//
// Téléversement d'une image vers imgBB PAR NOTRE SERVEUR (Cloud Function uploadImage) : la clé API imgBB reste côté
// serveur au lieu d'être embarquée dans le site. Il faut être connecté ; le serveur vérifie le type du fichier, sa
// taille et limite le nombre d'envois par personne.
import { auth } from '../firebase';

const UPLOAD_IMAGE_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/uploadImage';

// Au-delà (en caractères de data URL ≈ 4,8 Mo d'image), on réduit l'image avant l'envoi : la limite de requête du serveur est de 10 Mo.
const MAX_DATA_URL_LENGTH = 6.5 * 1024 * 1024;
const MAX_DIMENSION = 2400;

// Réduit une image trop lourde (JPEG, fond blanc sous les transparences). Renvoie la data URL d'origine si ce n'est pas nécessaire ou impossible.
const shrinkIfNeeded = (dataUrl) => new Promise((resolve) => {
    if (dataUrl.length <= MAX_DATA_URL_LENGTH || /^data:image\/gif/i.test(dataUrl)) { resolve(dataUrl); return; }
    const image = new Image();
    image.onload = () => {
        try {
            const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            const context = canvas.getContext('2d');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (error) { resolve(dataUrl); }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
});

// dataUrl : « data:image/png;base64,… ». Retourne { url, deleteUrl }. Lève une Error au message lisible en cas d'échec.
export const uploadImageToServer = async (dataUrl) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Connectez-vous pour téléverser des images.');
    const token = await user.getIdToken();
    const image = await shrinkIfNeeded(dataUrl);

    let response;
    try {
        response = await fetch(UPLOAD_IMAGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ image }),
        });
    } catch (error) {
        throw new Error(`serveur injoignable (${error.message || 'réseau'})`);
    }
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (error) { /* réponse non JSON */ }
    if (!response.ok || !data || !data.url) {
        throw new Error((data && data.message) || `échec du téléversement (code ${response.status})`);
    }
    return { url: data.url, deleteUrl: data.deleteUrl || '' };
};
