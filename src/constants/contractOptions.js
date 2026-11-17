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

// ───────────── Notifications de fin de contrat : réponses par défaut ─────────────
// SUGGESTIONS à cliquer (le texte reste libre et modifiable) : « Motifs détaillés » selon le motif de la fin de contrat, et « Restitutions et clôture des accès ».
// Les motifs d'un licenciement doivent rester précis et vérifiables (Code du Gouvernement, art. 325) : à compléter avec les faits, les dates et les circonstances.
export const FIN_MOTIF_PRESETS = {
    fin_essai: [
        'Période d\'essai non concluante au regard des compétences attendues pour le poste',
        'Les attentes du poste ne correspondent pas au profil constaté pendant l\'essai',
        'Difficultés persistantes d\'intégration dans l\'équipe malgré l\'accompagnement proposé',
    ],
    demission: [
        'Démission remise par écrit à la Direction',
        'Départ pour une autre structure',
        'Raisons personnelles',
    ],
    rupture_amiable: [
        'Rupture convenue d\'un commun accord entre l\'Employeur et l\'Employé(e)',
        'Départ concerté dans le cadre d\'un projet professionnel de l\'Employé(e)',
        'Chaque partie renonce à toute action relative à la rupture',
    ],
    licenciement: [
        'Suppression du poste dans le cadre d\'une réorganisation du service',
        'Inaptitude constatée à exercer les fonctions occupées',
        'Insuffisance professionnelle persistante malgré les accompagnements proposés',
        'Absences prolongées désorganisant le fonctionnement du service',
        'Perte de la qualification ou de l\'autorisation nécessaire à l\'exercice de la fonction',
    ],
    licenciement_disciplinaire: [
        'Manquement aux protocoles de soins mettant en danger un patient',
        'Violation du secret médical',
        'Absences injustifiées répétées',
        'Comportement agressif ou irrespectueux envers un patient ou un collègue',
        'Prise de service sous l\'emprise de substances',
        'Usage abusif du matériel, des médicaments ou des accès de l\'Employeur',
        'Faits déjà sanctionnés qui se répètent malgré les avertissements',
    ],
    plein_droit: [
        'Décision de justice transmise à la Direction, pièce jointe au dossier',
        'Cessation des fonctions constatée sans justificatif d\'absence',
        'Perte d\'une condition légale d\'accès à l\'emploi public',
    ],
};
export const finMotifPresets = (motif) => FIN_MOTIF_PRESETS[motif] || [];

export const RESTITUTION_PRESETS = [
    'badge d\'employé',
    'clés des locaux et des casiers',
    'matériel médical (stéthoscope, tablette, radio…)',
    'véhicule de service',
    'uniforme et équipements',
    'documents et dossiers de l\'Employeur',
    'clôture des accès informatiques et du compte',
    'clôture de l\'accès à la messagerie et au forum',
];

/** Ajoute une réponse par défaut à un texte (sans doublon), séparée par `joiner` (retour à la ligne, ou « ; » dans une phrase). */
export const appendPreset = (current, preset, joiner = '\n') => {
    const text = String(current || '').trim();
    const parts = text ? text.split(joiner.trim() === '' ? /\r?\n/ : joiner.trim()).map((part) => part.trim()).filter(Boolean) : [];
    if (parts.includes(String(preset).trim())) return text;
    return [...parts, String(preset).trim()].join(joiner);
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
