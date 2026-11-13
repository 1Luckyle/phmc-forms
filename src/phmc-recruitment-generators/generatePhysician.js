// src/phmc-recruitment-generators/generatePhysician.js
// Candidature : Médecine. Document commun à toutes les candidatures (voir shared/applicationDocument.js).
import generateApplicationDocument from './shared/applicationDocument';

const generatePhysician = (formData) => generateApplicationDocument(formData, { categoryLabel: 'Médecine' });

export default generatePhysician;
