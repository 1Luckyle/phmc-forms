// src/utils/dossierView.js
//
// Affichage du dossier patient (« Mon profil ») au format des dossiers du PHMC : on réutilise la mise en page du Dossier Médical Avancé (bandeaux de section, tableaux
// à deux colonnes, en-tête PHMC), sans ses parties de formulaire (signature, clause de non-responsabilité, paiement), avec le pied de page de l'hôpital.
import generateAdvancedPatientFile from '../phmc-bbcode-generators/generateAdvancedPatientFile';
import { withPhmcFooter } from '../phmc-bbcode-generators/shared/bbStyles';
import { frDay } from './reportTitle';

const FULL_NAME_PARTS = ['patientFirstName', 'patientMiddleName', 'patientLastName'];

// identity : { patientID, email, ...champs d'identité gratuits (nom, téléphone, Discord, adresse) du profil du compte } : ils priment sur le dossier, car le profil est
// la source des coordonnées modifiables sans payer. donnees : dossier.donnees (noms de champs du Dossier Médical Avancé).
export const mergeDossierValues = (donnees = {}, identity = {}) => {
    const merged = { ...donnees };
    Object.entries(identity).forEach(([key, value]) => { if (value !== undefined && value !== null && String(value) !== '') merged[key] = value; });
    return merged;
};

export const dossierBbCode = (donnees = {}, identity = {}) => {
    const values = mergeDossierValues(donnees, identity);
    const patientName = FULL_NAME_PARTS.map((key) => values[key]).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const source = {
        ...values, patientName, filledByStaff: false, isExempt: false, payNow: false, date: '',
    };
    let text = generateAdvancedPatientFile(source);
    // Titre du document : c'est le dossier, pas le formulaire.
    text = text.replace('INFORMATIONS AVANCÉES DU PATIENT', 'DOSSIER MÉDICAL');
    // Sans signature, clause de non-responsabilité ni paiement : on coupe avant la clause (le bandeau « Clause de non-responsabilité » ouvre la fin du formulaire).
    const clause = text.indexOf('Clause de non-responsabilité');
    if (clause > -1) {
        const start = text.lastIndexOf('[divboxcolor=black]', clause);
        text = text.slice(0, start > -1 ? start : clause);
    }
    // La signature des directives anticipées n'a pas de sens dans une simple consultation.
    text = text.replace(/\n*Signature: \[i\]\[u\][^\n]*\[\/u\]\[\/i\]\nDate: [^\n]*?(?=\[\/divbox\])/, '');
    return withPhmcFooter(text, 3);
};

export const formatDossierDate = (ms) => (ms ? frDay(new Date(Number(ms)).toISOString().slice(0, 10)) : '');
