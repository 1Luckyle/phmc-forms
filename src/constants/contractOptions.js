// src/constants/contractOptions.js
//
// Listes par défaut proposées dans l'éditeur de contrats : services du PHMC (champ « Service / unité d'affectation », un ou plusieurs) et critères de la
// prime de rémunération selon critères ou objectifs. Ce sont des SUGGESTIONS : les contrats déjà rédigés conservent le texte qu'ils contiennent.

// Services de l'hôpital (capacités du PHMC : traumatologie niveau II, pédiatrie, toxicologie, périnatalité, néonatalogie, AVC, grands brûlés, héliport).
export const HOSPITAL_SERVICES = [
    'Urgences / traumatologie',
    'Soins intensifs / réanimation',
    'Bloc opératoire / anesthésie',
    'Chirurgie',
    'Cardiologie',
    'Neurovasculaire / AVC',
    'Grands brûlés',
    'Pédiatrie',
    'Maternité / périnatalité',
    'Néonatalogie',
    'Toxicologie',
    'Hospitalisation (médecine générale)',
    'Gériatrie / médecine interne',
    'Consultations externes',
    'Radiologie / imagerie médicale',
    'Laboratoire d\'analyses',
    'Psychiatrie / psychologie',
    'Pharmacie',
    'Kinésithérapie',
    'Dentisterie',
    'EMS / ambulances',
    'Médecine légale (DMEC)',
    'Administration / direction',
    'Recrutement',
    'Logistique / sécurité',
];

const SEPARATOR = ' ; ';

// Les services d'un contrat sont stockés dans un seul texte (champ `affectation`), séparés par « ; » : lisible dans la fiche du personnel et dans l'avenant.
export const parseServices = (text) => [...new Set(String(text || '').split(';').map((part) => part.trim()).filter(Boolean))];
export const joinServices = (list) => parseServices(Array.isArray(list) ? list.join(';') : list).join(SEPARATOR);

// « A », « A et B », « A, B et C » (pour le texte du contrat).
export const servicesPhrase = (text) => {
    const list = parseServices(text);
    if (list.length <= 1) return list[0] || '';
    return `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`;
};

// Critères ou objectifs types de la prime de rémunération (sélecteur) ; le texte reste libre.
export const PRIME_CRITERIA = [
    'Assiduité et ponctualité sur la période',
    'Nombre de patients pris en charge sur la période',
    'Qualité des soins, sans plainte ni incident fondé',
    'Respect des protocoles et de la déontologie',
    'Objectifs de service atteints (délais de prise en charge, taux d\'occupation)',
    'Participation aux gardes, astreintes et renforts demandés par la Direction',
    'Formation suivie et compétences validées',
    'Encadrement et formation des stagiaires et des nouveaux arrivants',
    'Ancienneté et fidélité à la fonction',
];
