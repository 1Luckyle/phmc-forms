// src/phmc-recruitment-generators/generateEMS.js
// Candidature : Paramédical (EMS). Document commun à toutes les candidatures (voir shared/applicationDocument.js).
import generateApplicationDocument from './shared/applicationDocument';

const generateEMS = (formData) => generateApplicationDocument(formData, { categoryLabel: 'Paramédical (EMS)' });

export default generateEMS;
