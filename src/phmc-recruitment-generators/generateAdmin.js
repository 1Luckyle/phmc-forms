// src/phmc-recruitment-generators/generateAdmin.js
// Candidature : Administration & Services. Document commun à toutes les candidatures (voir shared/applicationDocument.js).
import generateApplicationDocument from './shared/applicationDocument';

const generateAdmin = (formData) => generateApplicationDocument(formData, { categoryLabel: 'Administration & Services' });

export default generateAdmin;
