// src/phmc-recruitment-generators/generatePsych.js
// Candidature : Psychologie & Psychiatrie. Document commun à toutes les candidatures (voir shared/applicationDocument.js).
import generateApplicationDocument from './shared/applicationDocument';

const generatePsych = (formData) => generateApplicationDocument(formData, { categoryLabel: 'Psychologie & Psychiatrie' });

export default generatePsych;
