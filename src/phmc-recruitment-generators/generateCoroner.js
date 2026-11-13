// src/phmc-recruitment-generators/generateCoroner.js
// Candidature : Médecine légale (DMEC). Document commun à toutes les candidatures (voir shared/applicationDocument.js).
import generateApplicationDocument from './shared/applicationDocument';

const generateCoroner = (formData) => generateApplicationDocument(formData, { categoryLabel: 'Médecine légale (DMEC)' });

export default generateCoroner;
