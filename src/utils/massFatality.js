// src/utils/massFatality.js
//
// Rapport de tuerie / accident de masse (formulaire 11) : un rapport, plusieurs défunts (formData.decedents). Les champs d'une fiche de défunt sont déclarés au catalogue de la page admin
// (constants/formFieldCatalog.js) sous une clé propre — les clés qui existent aussi au niveau du rapport (lieu, synthèse) sont préfixées « decedent… » pour ne pas se confondre.
// Cette table dit où lire chaque clé dans la fiche d'un défunt. La validation (utils/formValidation.js) contrôle les champs exigés défunt par défunt, et le moteur des couleurs
// (components/FieldGuide.js) marque chaque fiche séparément (attribut `data-field-scope` sur la fiche).
import { splitFullName } from './patientIdentity';

/** Clé du catalogue → propriété de la fiche d'un défunt. */
export const DECEDENT_FIELDS = {
    decedentTitle: 'decedentTitle',
    decedentFirstName: 'decedentFirstName',
    decedentMiddleName: 'decedentMiddleName',
    decedentLastName: 'decedentLastName',
    decedentOOC: 'decedentOOC',
    patientID: 'patientID',
    pronouncedTimeOfDeath: 'pronouncedTimeOfDeath',
    typeOfDeath: 'typeOfDeath',
    decedentPlaceOfDeath: 'placeOfDeath',
    decedentPlaceOfDeathZip: 'placeOfDeathZip',
    decedentPlaceOfDeathZipCity: 'placeOfDeathZipCity',
    mannerOfDeath: 'mannerOfDeath',
    probableCauseOfDeath: 'probableCauseOfDeath',
    decedentInjuries: 'synopsis',
    evidenceLocker: 'evidenceLocker',
    evidenceLockerID: 'evidenceLockerID',
    scenePhotos: 'scenePhotos',
    additionalImages: 'additionalImages',
    morgueStatus: 'morgueStatus',
};

export const isDecedentField = (version, field) => Number(version) === 11 && Object.prototype.hasOwnProperty.call(DECEDENT_FIELDS, field);

const isTrue = (value) => value === true || value === 'true';

/** Valeur d'un champ du catalogue dans la fiche d'un défunt (nom en trois parties : repris du nom complet pour les anciens rapports). */
export const decedentValue = (decedent, field) => {
    const dec = decedent || {};
    const prop = DECEDENT_FIELDS[field];
    if (!prop) return '';
    if (prop === 'evidenceLocker' || prop === 'morgueStatus') return isTrue(dec[prop]) ? 'Oui' : '';
    if (/^decedent(First|Middle|Last)Name$/.test(prop) && !dec.decedentFirstName && !dec.decedentMiddleName && !dec.decedentLastName) {
        const parts = splitFullName(dec.decedentName);
        return { decedentFirstName: parts.first, decedentMiddleName: parts.middle, decedentLastName: parts.last }[prop] || '';
    }
    return dec[prop];
};

/** Un champ de fiche ne s'applique pas toujours : le numéro de soumission n'existe que si le casier à preuves est coché. */
export const isDecedentFieldApplicable = (field, decedent) => (field === 'evidenceLockerID' ? isTrue(decedent && decedent.evidenceLocker) : true);
