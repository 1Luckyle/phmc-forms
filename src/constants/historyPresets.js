// src/constants/historyPresets.js
//
// Choix par défaut des champs d'historique des dossiers patient (Basique, Avancé, Mise à jour) : voir phmc-field-data/shared/PresetTextField.js. On
// en coche autant qu'on veut et on peut toujours ajouter du texte libre. Un champ absent de cette liste reste un champ de texte simple (rien d'utile à
// proposer : notes libres, noms…). « Aucun(e) … » exclut les autres choix.

export const HISTORY_PRESETS = {
    // ── Historique médical ──
    patientAllergies: [
        'Pénicilline', 'Aspirine', 'Ibuprofène', 'Latex', 'Iode / produits de contraste', 'Arachides', 'Fruits à coque', 'Fruits de mer', 'Œufs', 'Lait', 'Gluten',
        'Pollen', 'Acariens', 'Poils d\'animaux', 'Piqûres d\'insectes', 'Aucune allergie connue',
    ],
    patientCurrentMedicine: [
        'Paracétamol', 'Ibuprofène', 'Aspirine', 'Antibiotiques', 'Antihypertenseur', 'Insuline', 'Antidiabétique oral', 'Antidépresseur', 'Anxiolytique',
        'Anticoagulant', 'Statine (cholestérol)', 'Bronchodilatateur (asthme)', 'Contraceptif', 'Antidouleur opioïde', 'Aucun médicament',
    ],
    patientChronicDiseases: [
        'Asthme', 'Diabète de type 1', 'Diabète de type 2', 'Hypertension', 'Cholestérol élevé', 'Maladie cardiaque', 'Insuffisance rénale', 'Épilepsie',
        'Migraines chroniques', 'Arthrite / arthrose', 'BPCO', 'Obésité', 'Hépatite', 'VIH', 'Cancer', 'Aucune maladie chronique',
    ],
    patientNotes: [
        'Fracture', 'Entorse', 'Luxation', 'Plaie par balle', 'Plaie par arme blanche', 'Brûlure', 'Commotion cérébrale', 'Traumatisme crânien', 'Accident de la route',
        'Chute', 'Intervention chirurgicale antérieure', 'Aucun traumatisme',
    ],

    // ── Historique de santé mentale ──
    patientMental: [
        'Dépression', 'Anxiété généralisée', 'Trouble bipolaire', 'Schizophrénie', 'TDAH', 'TOC', 'Stress post-traumatique (TSPT)', 'Trouble de la personnalité',
        'Troubles du sommeil', 'Troubles alimentaires', 'Phobie', 'Aucun trouble diagnostiqué',
    ],
    patientTherapy: [
        'Thérapie cognitivo-comportementale', 'Thérapie de groupe', 'Thérapie familiale', 'Suivi psychiatrique', 'Suivi psychologique', 'Séances de conseil ponctuelles',
        'Aucune thérapie',
    ],
    patientTriggers: [
        'Bruits forts', 'Lumières vives', 'Foules', 'Espaces clos', 'Hauteurs', 'Sang', 'Aiguilles', 'Armes à feu', 'Contacts physiques', 'Odeurs fortes', 'Aucun déclencheur connu',
    ],
    patientSupport: [
        'Famille', 'Amis', 'Conjoint(e)', 'Groupe de soutien', 'Thérapeute', 'Activité physique', 'Méditation', 'Loisirs créatifs', 'Aucun soutien',
    ],
    patientHarm: [
        'Automutilation passée', 'Tentative de suicide passée', 'Idées suicidaires', 'Danger pour autrui', 'Aucun antécédent',
    ],

    // ── Historique médical familial ──
    patientFam: ['Père', 'Mère', 'Frère(s)', 'Sœur(s)', 'Conjoint(e)', 'Enfant(s)', 'Grands-parents'],
    patientGenetic: [
        'Diabète', 'Hypertension', 'Maladie cardiaque', 'Cancer', 'Maladie d\'Alzheimer', 'Maladie de Huntington', 'Mucoviscidose', 'Drépanocytose', 'Hémophilie',
        'Aucune maladie génétique connue',
    ],
    patientFamSocial: [
        'Violences familiales', 'Addictions dans la famille', 'Parents divorcés', 'Placement en famille d\'accueil', 'Décès précoce d\'un parent',
        'Antécédents psychiatriques dans la famille', 'Aucun antécédent',
    ],

    // ── Informations sociales ──
    patientReligion: [
        'Athée / aucune pratique', 'Chrétien(ne)', 'Catholique', 'Protestant(e)', 'Musulman(e)', 'Juif(ve)', 'Bouddhiste', 'Hindou(e)', 'Témoin de Jéhovah',
        'Refus de transfusion sanguine', 'Régime alimentaire religieux',
    ],

    // ── Mode de vie ──
    patientSmoker: ['Non-fumeur', 'Fumeur occasionnel', 'Fumeur régulier', 'Ancien fumeur', 'Vapoteur'],
    patientAlcohol: ['Aucune consommation', 'Occasionnelle', 'Régulière', 'Excessive', 'Ancien consommateur'],
    patientDrugs: [
        'Aucune consommation', 'Cannabis', 'Cocaïne', 'Héroïne', 'Méthamphétamine', 'Opioïdes', 'Stimulants', 'Hallucinogènes', 'Ancien consommateur',
    ],
    patientExercise: ['Sédentaire', 'Marche régulière', 'Sport 1 à 2 fois par semaine', 'Sport 3 fois par semaine ou plus', 'Sport intensif'],
    patientDiet: ['Équilibrée', 'Végétarienne', 'Végane', 'Riche en graisses', 'Riche en sucre', 'Fast-food fréquent', 'Sans gluten', 'Repas irréguliers'],
    patientSleep: ['Sommeil normal (7 à 8 h)', 'Insomnie', 'Sommeil insuffisant', 'Apnée du sommeil', 'Cauchemars fréquents', 'Somnolence en journée'],
    patientSexLife: ['Active', 'Inactive', 'Un seul partenaire', 'Plusieurs partenaires', 'Contraception', 'Grossesse en cours', 'IST connue'],
    patientJobRisks: [
        'Produits chimiques', 'Travail en hauteur', 'Port de charges lourdes', 'Travail de nuit', 'Risque d\'agression', 'Bruit', 'Station debout prolongée',
        'Machines dangereuses', 'Aucun risque particulier',
    ],
    patientHazards: [
        'Pollution', 'Poussières', 'Amiante', 'Humidité / moisissures', 'Allergènes domestiques', 'Chaleur ou froid extrêmes', 'Quartier à risque', 'Aucun danger particulier',
    ],
};

// Texte regroupé d'un champ d'historique : « choix 1 ; choix 2 ; texte libre ».
export const aggregatePresetText = (selected, free) => [...(selected || []), String(free || '').trim()].filter(Boolean).join(' ; ');

// Règles de saisie de chaque champ d'historique : le sujet (pour le texte d'aide « Écrire les autres … ») et le mode de choix.
//  - mode 'single' : UN seul choix (habitudes qui s'excluent : une seule réponse a du sens) ;
//  - `groups` : listes de choix qui s'excluent entre eux (un choix du groupe remplace l'autre du même groupe) ;
//  - sinon plusieurs choix possibles (« Aucun… » exclut les autres).
export const HISTORY_FIELD_META = {
    patientAllergies: { subject: 'allergies' },
    patientCurrentMedicine: { subject: 'médicaments' },
    patientChronicDiseases: { subject: 'conditions chroniques' },
    patientNotes: { subject: 'traumatismes ou blessures' },
    patientMental: { subject: 'troubles' },
    patientTherapy: { subject: 'thérapies' },
    patientTriggers: { subject: 'déclencheurs' },
    patientSupport: { subject: 'soutiens' },
    patientHarm: { subject: 'éléments' },
    patientFam: { subject: 'membres de la famille' },
    patientGenetic: { subject: 'maladies génétiques' },
    patientFamSocial: { subject: 'antécédents' },
    patientReligion: {
        subject: 'considérations religieuses',
        groups: [['Athée / aucune pratique', 'Chrétien(ne)', 'Catholique', 'Protestant(e)', 'Musulman(e)', 'Juif(ve)', 'Bouddhiste', 'Hindou(e)', 'Témoin de Jéhovah']],
    },
    patientSmoker: { subject: 'habitudes de tabac', mode: 'single' },
    patientAlcohol: { subject: 'habitudes d\'alcool', mode: 'single' },
    patientDrugs: { subject: 'substances' },
    patientExercise: { subject: 'habitudes d\'exercice', mode: 'single' },
    patientDiet: { subject: 'habitudes alimentaires' },
    patientSleep: { subject: 'habitudes de sommeil', mode: 'single' },
    patientSexLife: { subject: 'informations sur la vie sexuelle', groups: [['Active', 'Inactive'], ['Un seul partenaire', 'Plusieurs partenaires']] },
    patientJobRisks: { subject: 'risques professionnels' },
    patientHazards: { subject: 'dangers environnementaux' },
};
export const historyPlaceholder = (name) => {
    const meta = HISTORY_FIELD_META[name];
    return meta ? `Écrire les autres ${meta.subject} si indisponible dans la liste ou précisions` : undefined;
};
