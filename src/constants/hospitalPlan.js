// src/constants/hospitalPlan.js
//
// Plan du Pillbox Hill Medical Center, étage par étage : sections (services ou fonctions) et pièces, avec leur niveau d'accès. Données statiques, lisibles par
// n'importe qui (le plan est public : page #/plan et onglet « Plan de l'hôpital » de la Boîte à outils).
// Une pièce : { nom, acces, sous?: [{ nom, acces? }], note? } — les sous-pièces héritent de l'accès de leur pièce.

export const ACCESS_LEVELS = {
    public: { label: 'Accès libre', short: 'Public', color: '#3fb950', icon: 'fa-door-open', help: 'Ouvert à tous les visiteurs.' },
    consultation: { label: 'Sur consultation', short: 'Consultation', color: '#58a6ff', icon: 'fa-user-doctor', help: 'Sur rendez-vous, convocation ou après prise en charge par le personnel.' },
    secure: { label: 'Zone sécurisée', short: 'Sécurisée', color: '#e3b341', icon: 'fa-shield-halved', help: 'Accès restreint : autorisation du personnel ou d\'un responsable de service.' },
    reserve: { label: 'Réservé au personnel', short: 'Personnel', color: '#f85149', icon: 'fa-id-badge', help: 'Interdit au public : personnel du PHMC uniquement.' },
};

const room = (nom, acces, extra = {}) => ({ nom, acces, ...extra });
const sub = (nom, acces) => ({ nom, ...(acces ? { acces } : {}) });

export const HOSPITAL_FLOORS = [
    {
        niveau: '8', code: 'heliport', titre: 'Héliport', icon: 'fa-helicopter',
        resume: 'Hélisurface pour les évacuations sanitaires aériennes.',
        sections: [
            { titre: 'Héliport', zones: [room('Hélisurface', 'secure', { note: 'Réservée aux équipes d\'évacuation et au personnel autorisé.' })] },
        ],
    },
    {
        niveau: '7', code: 'atrium', titre: 'Atrium', icon: 'fa-chalkboard-user',
        resume: 'Conférences, enseignements et événements du PHMC.',
        sections: [
            {
                titre: 'Atrium',
                zones: [
                    room('Salle d\'attente + zone médias, avec accès escaliers, ascenseurs et escalier vers l\'accueil', 'public'),
                    room('Toilettes', 'public'),
                    room('Amphithéâtre de conférence scientifique et d\'enseignements', 'consultation', { note: 'Selon les conférences et formations programmées.' }),
                    room('Salle d\'attente', 'public'),
                    room('Auditorium + stand PHMC', 'public', { note: 'Pendant les événements publics.' }),
                ],
            },
        ],
    },
    {
        niveau: '6', code: 'administration', titre: 'Administration', icon: 'fa-briefcase',
        resume: 'Direction et services administratifs.',
        sections: [
            {
                titre: 'Direction & administration',
                zones: [
                    room('Réception avec accès escaliers et ascenseurs', 'public'),
                    room('Salle d\'attente', 'public'),
                    room('Salle de réunion', 'consultation', { note: 'Sur rendez-vous avec la Direction ou l\'administration.' }),
                    ...[1, 2, 3, 4, 5, 6].map((n) => room(`Bureau ${n}`, 'reserve')),
                    room('Moyen bureau de la direction', 'reserve'),
                    room('Grand bureau de la direction (1)', 'reserve'),
                    room('Grand bureau de la direction (2)', 'reserve'),
                    room('Open-space', 'reserve'),
                ],
            },
        ],
    },
    {
        niveau: '5', code: 'chambres', titre: 'Chambres', icon: 'fa-bed',
        resume: 'Hospitalisation : 8 chambres dont une familiale.',
        sections: [
            {
                titre: 'Hospitalisation',
                zones: [
                    room('Salle d\'attente avec accès escaliers et ascenseurs', 'public'),
                    room('Réception', 'public'),
                    room('Toilettes', 'public'),
                    room('Chambre 1 : individuelle', 'consultation'),
                    room('Chambre 2 : individuelle', 'consultation'),
                    room('Chambre 3 : familiale (lit visiteur)', 'consultation'),
                    ...[4, 5, 6, 7, 8].map((n) => room(`Chambre ${n} : individuelle`, 'consultation')),
                ],
                note: 'Les chambres se visitent avec l\'accord du patient et du personnel du service.',
            },
        ],
    },
    {
        niveau: '4', code: 'chirurgie', titre: 'Chirurgie générale et dentaire', icon: 'fa-tooth',
        resume: 'Blocs opératoires, soins ambulatoires et chirurgie dentaire.',
        sections: [
            { titre: 'Réception', zones: [room('Salle d\'attente avec accès escaliers et ascenseurs', 'public')] },
            {
                titre: 'Service de chirurgie générale',
                zones: [
                    room('Réception', 'public'),
                    room('Salle de réunion', 'reserve'),
                    room('Salle de repos et de détente', 'reserve'),
                    room('Salle 1 : imagerie lourde', 'consultation'),
                    room('Salle 2 : bloc opératoire', 'secure'),
                    room('Salle 3 : bloc opératoire d\'enseignement', 'secure'),
                    room('Salle de travaux anatomiques et d\'enseignement chirurgical', 'secure'),
                ],
            },
            {
                titre: 'Soins ambulatoires',
                zones: [room('Réception', 'public'), room('Salle d\'attente', 'public'), room('Salle de soins ambulatoires', 'consultation')],
            },
            {
                titre: 'Service de chirurgie dentaire',
                zones: [room('Salle de soins dentaires', 'consultation'), room('Salle de radiologie dentaire', 'consultation')],
            },
        ],
    },
    {
        niveau: '3', code: 'clinique', titre: 'Clinique & médecine interne', icon: 'fa-stethoscope',
        resume: 'Consultations, prévention, diagnostic et traitement.',
        sections: [
            {
                titre: 'Zone de prévention, diagnostic et traitement',
                note: 'À l\'avenir, les bureaux et salles de consultation pourraient être affectés selon les spécialités.',
                zones: [
                    room('Réception avec accès escaliers et ascenseurs', 'public'),
                    room('Salle d\'attente', 'public'),
                    room('Open-space', 'reserve'),
                    room('Bureau', 'reserve'),
                    room('Bureau de chef de service ou médecin senior (1)', 'reserve'),
                    room('Bureau de chef de service ou médecin senior (2)', 'reserve'),
                    room('Cabinet médical / salle de consultation (1)', 'consultation'),
                    room('Cabinet médical / salle de consultation (2)', 'consultation'),
                    room('Cabinet médical / salle de consultation (3)', 'consultation'),
                    room('Salle d\'épreuve d\'effort / de rééducation cardio-respiratoire', 'consultation'),
                    room('Bureau de consultation de spécialiste', 'consultation'),
                ],
            },
        ],
    },
    {
        niveau: '2', code: 'accueil', titre: 'Accueil', icon: 'fa-bell-concierge', entree: true,
        resume: 'Étage d\'entrée : accueil du public, parking, pharmacie centrale et musée.',
        sections: [
            {
                titre: 'Réception',
                zones: [
                    room('Salle d\'attente avec accès aux escaliers, ascenseurs et accès extérieur + parking', 'public'),
                    room('Réception', 'public'),
                    room('Boutique de souvenirs', 'public'),
                    room('Zone de restauration', 'public', { sous: [sub('Cuisine', 'reserve')] }),
                    room('Pharmacie centrale', 'consultation', { note: 'Délivrance sur ordonnance ou après avis du personnel.' }),
                    room('Accès escalier vers l\'Atrium', 'public'),
                ],
            },
            { titre: 'Musée du Pillbox Hill Medical Center', zones: [room('Musée', 'public')] },
        ],
    },
    {
        niveau: '1', code: 'urgences', titre: 'Urgences', icon: 'fa-heart-pulse',
        resume: 'Urgences, EMS / EMT / Paramedic, radiologie et oncologie.',
        sections: [
            {
                titre: 'Service des urgences',
                zones: [
                    room('Réception avec accès escaliers, ascenseurs et arrivée urgences', 'public'),
                    room('Salle de triage', 'consultation'),
                    room('Box de soins d\'urgence', 'consultation'),
                    room('Box de déchocage', 'secure'),
                    room('Chambre personnel sécurisée', 'reserve'),
                    room('Chambre collocation sécurisée', 'reserve'),
                    room('Vestiaire', 'reserve'),
                ],
            },
            {
                titre: 'Service des EMS / EMT / Paramedic',
                zones: [
                    room('Garage avec accès parking', 'reserve'),
                    room('Salle de formation aux gestes de premiers secours', 'consultation', { note: 'Pendant les sessions de formation.' }),
                    room('Vestiaire hommes', 'reserve', { sous: [sub('Toilettes')] }),
                    room('Vestiaire femmes', 'reserve', { sous: [sub('Toilettes')] }),
                    room('Salle de repos, cinéma, détente, cuisine', 'reserve'),
                    room('Salle de musculation', 'reserve'),
                    room('Dortoir commun', 'reserve'),
                ],
            },
            {
                titre: 'Service radiologie & oncologie',
                zones: [
                    room('Salle 1 : examen et imagerie fine', 'consultation'),
                    room('Salle 2 : examen et imagerie fine', 'consultation'),
                    room('Salle 3 : imagerie lourde + salle de contrôle', 'consultation'),
                    room('Salle 4 : imagerie lourde + salle de contrôle', 'consultation'),
                    room('Salle 5 : réception + salle ambulatoire de chimiothérapie', 'consultation'),
                    room('Salle 6 : salle d\'attente', 'public'),
                    room('Salle de radiothérapie + salle de contrôle', 'consultation'),
                ],
            },
        ],
    },
    {
        niveau: '-1', code: 'morgue', titre: 'Morgue', icon: 'fa-dove',
        resume: 'Pathologie et médecine légale, zone de recueillement.',
        sections: [
            { titre: 'Réception', zones: [room('Salle d\'attente avec accès escaliers et ascenseurs', 'public')] },
            {
                titre: 'Bureaux du service de médecine légale',
                zones: [
                    room('Salle d\'attente', 'public'),
                    room('Bureau du directeur du service', 'reserve'),
                    room('Open-space', 'reserve'),
                    room('Salle de repos', 'reserve', { sous: [sub('Salle de détente'), sub('Vestiaire')] }),
                ],
            },
            {
                titre: 'Zone de recueillement',
                zones: [
                    room('Vestibule', 'public'),
                    room('Toilettes', 'public'),
                    room('Chapelle', 'public'),
                    room('Mosquée', 'public'),
                    room('Bureau des pompes funèbres du PHMC', 'consultation'),
                ],
            },
            {
                titre: 'Service médico-légal',
                zones: [
                    room('Chambre mortuaire', 'secure'),
                    room('Salle de réunion', 'reserve'),
                    room('Laboratoire d\'analyse + open-space', 'reserve'),
                    room('Salle d\'autopsie', 'secure'),
                ],
            },
        ],
    },
];

// Une pièce par ligne, avec son étage et sa section : sert à la recherche (« où trouver… »).
export const flattenPlan = (floors = HOSPITAL_FLOORS) => floors.flatMap((floor) => floor.sections.flatMap((section) => section.zones.flatMap((zone) => [
    { floor, section, nom: zone.nom, acces: zone.acces, note: zone.note || '' },
    ...(zone.sous || []).map((child) => ({ floor, section, nom: `${child.nom} (${zone.nom})`, acces: child.acces || zone.acces, note: '' })),
])));
