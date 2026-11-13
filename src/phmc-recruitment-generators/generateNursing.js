// src/phmc-recruitment-generators/generateNursing.js
// Candidature : Soins infirmiers. Document commun à toutes les candidatures (voir shared/applicationDocument.js).
import generateApplicationDocument from './shared/applicationDocument';

const generateNursing = (formData) => generateApplicationDocument(formData, { categoryLabel: 'Soins infirmiers' });

export default generateNursing;
