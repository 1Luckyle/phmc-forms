// src/constants/buildingPlan.js
//
// Plan du Pillbox Hill Medical Center (service ou fonction, par étage). Sert aux listes déroulantes « Étage » puis « Lieu » (signalement
// de sécurité incendie…). `zones` : les pièces / zones de l'étage, dans l'ordre du plan, sans doublon.
const floor = (niveau, nom, zones) => ({ niveau, nom, label: `Étage ${niveau} · ${nom}`, zones: [...new Set(zones)] });

export const BUILDING_FLOORS = [
    floor('-1', 'Morgue & Pathologie et médecine légale', [
        'Réception', 'Salle d\'attente avec accès escaliers et ascenseurs', 'Bureaux du service de médecine légale', 'Salle d\'attente',
        'Bureau du directeur du service', 'Open-space', 'Salle de repos', 'Salle de détente', 'Vestiaire', 'Zone de recueillement', 'Vestibule',
        'Toilettes', 'Chapelle', 'Mosquée', 'Bureau des pompes funèbres du PHMC', 'Service médico-légal', 'Chambre mortuaire', 'Salle de réunion',
        'Laboratoire d\'analyse + open-space', 'Salle d\'autopsie',
    ]),
    floor('1', 'Urgences', [
        'Service des urgences', 'Réception avec accès escaliers, ascenseurs et arrivée urgences', 'Salle de triage', 'Box de soins d\'urgence',
        'Box de déchocage', 'Chambre personnel sécurisée', 'Chambre collocation sécurisée', 'Vestiaire',
        'Service des EMS / EMT / Paramedic', 'Garage avec accès parking', 'Salle de formation des gestes de premiers secours', 'Vestiaire hommes',
        'Toilettes', 'Vestiaire femmes', 'Salle de repos, cinéma, détente, cuisine', 'Salle de musculation', 'Dortoir commun',
        'Service Radiologie & Oncologie', 'Salle 1 : Salle d\'examen et d\'imagerie fine', 'Salle 2 : Salle d\'examen et d\'imagerie fine',
        'Salle 3 : Salle d\'imagerie lourde + salle de contrôle', 'Salle 4 : Salle d\'imagerie lourde + salle de contrôle',
        'Salle 5 : Réception + salle ambulatoire de chimiothérapie', 'Salle 6 : Salle d\'attente', 'Salle de radiothérapie + salle de contrôle',
    ]),
    floor('2', 'Accueil', [
        'Réception', 'Salle d\'attente avec accès aux escaliers, ascenseurs et accès extérieur + parking', 'Boutique de souvenirs',
        'Zone de restauration', 'Cuisine', 'Pharmacie centrale', 'Accès escalier vers l\'Atrium', 'Musée du Pillbox Hill Medical Center', 'Musée',
    ]),
    floor('3', 'Clinique & Médecine Interne', [
        'Zone de prévention, diagnostic et traitement', 'Réception avec accès escaliers et ascenseurs', 'Salle d\'attente', 'Open-space', 'Bureau',
        'Bureau de chef de service ou médecin senior', 'Cabinet médical / salle de consultation',
        'Salle d\'épreuve d\'effort / de rééducation cardio-respiratoire', 'Bureau de consultation de spécialiste',
    ]),
    floor('4', 'Chirurgie Générale et Dentaire', [
        'Réception', 'Salle d\'attente avec accès escaliers et ascenseurs', 'Service de Chirurgie Générale', 'Salle de réunion',
        'Salle de repos et détente', 'Salle 1 : Salle d\'imagerie lourde', 'Salle 2 : Bloc opératoire', 'Salle 3 : Bloc opératoire d\'enseignement',
        'Salle de travaux anatomiques et d\'enseignement chirurgical', 'Soins Ambulatoires', 'Salle d\'attente', 'Salle de soins ambulatoires',
        'Service de Chirurgie Dentaire', 'Salle de soins dentaires', 'Salle de radiologie dentaire',
    ]),
    floor('5', 'Chambres', [
        'Salle d\'attente avec accès escaliers et ascenseurs', 'Réception', 'Toilettes', 'Chambre 1 : Individuel', 'Chambre 2 : Individuel',
        'Chambre 3 : Familiale (lit visiteur)', 'Chambre 4 : Individuel', 'Chambre 5 : Individuel', 'Chambre 6 : Individuel', 'Chambre 7 : Individuel',
        'Chambre 8 : Individuel',
    ]),
    floor('6', 'Administration', [
        'Réception avec accès escaliers et ascenseurs', 'Salle d\'attente', 'Salle de réunion', 'Bureau 1', 'Bureau 2', 'Bureau 3', 'Bureau 4',
        'Bureau 5', 'Bureau 6', 'Moyen bureau de la direction', 'Grand bureau de la direction', 'Open-space',
    ]),
    floor('7', 'Atrium', [
        'Salle d\'attente + zone médias avec accès escaliers, ascenseurs et accès escalier vers l\'accueil', 'Toilettes',
        'Amphithéâtre de conférence scientifique et d\'enseignements', 'Salle d\'attente', 'Auditorium + stand PHMC',
    ]),
    floor('8', 'Héliport', ['Hélisurface']),
];

export const FLOOR_LABELS = BUILDING_FLOORS.map((entry) => entry.label);
export const floorByLabel = (label) => BUILDING_FLOORS.find((entry) => entry.label === label) || null;
