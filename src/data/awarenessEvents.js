// src/data/awarenessEvents.js
//
// Calendrier des événements de sensibilisation et de soutien médical (Octobre Rose, Movember...).
// Les données vivent dans le code : pour ajouter ou corriger un événement, modifier ce fichier.
//
// Format d'un événement :
//   id, name, cause, category (clé de AWARENESS_CATEGORIES)
//   period : { startMonth, startDay, endMonth?, endDay? }  — mois 1-12 ; endDay 'last' = dernier jour du mois.
//            Sans end*, c'est une journée unique. Un mois entier = startDay 1 + endDay 'last'.
//   ribbon : couleurs du ruban [{ name, hex }] (plusieurs = ruban bicolore/tricolore ; vide = pas de ruban)
//   emblem : autre symbole reconnaissable (fleur, objet, geste...)
//   about  : de quoi s'agit-il (pour informer)
//   support: façons concrètes de soutenir la cause
//   symbols: explication des couleurs / symboles (facultatif)

export const AWARENESS_CATEGORIES = {
    cancer: { label: 'Cancers', icon: 'fa-ribbon' },
    cardio: { label: 'Cœur & circulation', icon: 'fa-heart-pulse' },
    mental: { label: 'Santé mentale', icon: 'fa-brain' },
    neuro: { label: 'Neurologie', icon: 'fa-head-side-virus' },
    infectious: { label: 'Maladies infectieuses', icon: 'fa-virus' },
    chronic: { label: 'Maladies chroniques & rares', icon: 'fa-dna' },
    family: { label: 'Mères, enfants & familles', icon: 'fa-baby' },
    care: { label: 'Soins & secours', icon: 'fa-hand-holding-medical' },
};

const PINK = { name: 'Rose', hex: '#ec6fa8' };
const RED = { name: 'Rouge', hex: '#e5383b' };
const BLUE = { name: 'Bleu', hex: '#2f81f7' };
const LIGHT_BLUE = { name: 'Bleu clair', hex: '#6cb6ff' };
const GOLD = { name: 'Or', hex: '#e3b341' };
const PURPLE = { name: 'Violet', hex: '#a371f7' };
const GREEN = { name: 'Vert', hex: '#3fb950' };
const YELLOW = { name: 'Jaune', hex: '#f2cc0c' };
const TEAL = { name: 'Turquoise', hex: '#2bb3a3' };
const WHITE = { name: 'Blanc / nacré', hex: '#e6edf3' };
const BLACK = { name: 'Noir', hex: '#6e7681' }; // gris clair : le noir pur disparaîtrait sur le thème sombre
const ORANGE = { name: 'Orange', hex: '#f0883e' };
const LAVENDER = { name: 'Lavande', hex: '#b9a3ff' };

const MONTH = (month) => ({ startMonth: month, startDay: 1, endMonth: month, endDay: 'last' });
const DAY = (month, day) => ({ startMonth: month, startDay: day });

export const AWARENESS_EVENTS = [
    {
        id: 'col-uterus', name: 'Prévention du cancer du col de l\'utérus', cause: 'Cancer du col de l\'utérus', category: 'cancer',
        period: MONTH(1), ribbon: [TEAL, WHITE], emblem: 'Ruban turquoise et blanc',
        about: 'Ce cancer est dans la quasi-totalité des cas provoqué par une infection persistante au papillomavirus humain (HPV). Il se prévient grâce à la vaccination contre le HPV et se dépiste par frottis.',
        support: [
            'Rappeler l\'intérêt de la vaccination HPV et du frottis régulier.',
            'Partager des informations fiables autour de soi.',
            'Soutenir une association de lutte contre le cancer.',
        ],
        symbols: 'Le turquoise et le blanc sont les couleurs du ruban de sensibilisation au cancer du col de l\'utérus.',
    },
    {
        id: 'cancer-mondial', name: 'Journée mondiale contre le cancer', cause: 'Tous les cancers', category: 'cancer',
        period: DAY(2, 4), ribbon: [LAVENDER], emblem: 'Ruban lavande',
        about: 'Organisée par l\'Union internationale contre le cancer, elle rappelle que de nombreux cancers peuvent être évités ou guéris s\'ils sont détectés tôt, et que l\'accès aux soins doit être égal pour tous.',
        support: [
            'Se tenir à jour de ses dépistages.',
            'Faire un don ou participer à une collecte de fonds.',
            'Accompagner un proche malade : écoute, présence, aide du quotidien.',
        ],
        symbols: 'Le ruban lavande représente l\'ensemble des cancers.',
    },
    {
        id: 'coeur-congenital', name: 'Journée des cardiopathies congénitales', cause: 'Malformations du cœur présentes à la naissance', category: 'cardio',
        period: DAY(2, 14), ribbon: [RED], emblem: 'Cœur',
        about: 'Les cardiopathies congénitales sont les malformations les plus fréquentes à la naissance. Un diagnostic précoce et un suivi spécialisé améliorent fortement le pronostic.',
        support: [
            'Informer sur l\'importance du suivi de grossesse et du dépistage néonatal.',
            'Soutenir les associations de familles et la recherche.',
        ],
    },
    {
        id: 'cancer-enfant', name: 'Journée internationale du cancer de l\'enfant', cause: 'Cancers pédiatriques', category: 'cancer',
        period: DAY(2, 15), ribbon: [GOLD], emblem: 'Ruban or',
        about: 'Chaque année, des milliers d\'enfants et d\'adolescents sont touchés par un cancer. Cette journée soutient les familles et appelle à plus de recherche dédiée aux enfants.',
        support: [
            'Soutenir une association d\'aide aux enfants malades et à leurs familles.',
            'Porter un ruban or pour montrer sa solidarité.',
            'Relayer les campagnes de collecte de fonds pour la recherche.',
        ],
        symbols: 'L\'or a été choisi pour sa valeur : nos enfants sont précieux. Le mois de septembre lui est aussi consacré (Septembre en Or).',
    },
    {
        id: 'maladies-rares', name: 'Journée internationale des maladies rares', cause: 'Maladies rares', category: 'chronic',
        period: { startMonth: 2, startDay: 'last' }, ribbon: [{ name: 'Bleu denim', hex: '#4c7fc1' }, { name: 'Rose', hex: '#ec6fa8' }, GREEN], emblem: 'Zèbre',
        about: 'Une maladie est dite rare quand elle touche peu de personnes, mais il en existe plusieurs milliers : ensemble, elles concernent beaucoup de patients, souvent longtemps sans diagnostic.',
        support: [
            'Sensibiliser aux errances diagnostiques et à la recherche.',
            'Soutenir les associations de patients.',
            'Écouter et croire les patients qui décrivent des symptômes inhabituels.',
        ],
        symbols: 'Le zèbre vient d\'un adage médical : « quand on entend des sabots, on pense à un cheval, pas à un zèbre ». Le zèbre rappelle qu\'une maladie rare est possible. Le ruban est bleu, rose et vert.',
    },
    {
        id: 'mars-bleu', name: 'Mars Bleu', cause: 'Cancer colorectal', category: 'cancer',
        period: MONTH(3), ribbon: [BLUE], emblem: 'Ruban bleu',
        about: 'Le cancer colorectal est l\'un des cancers les plus fréquents, mais l\'un des mieux guéris lorsqu\'il est repéré tôt. Le dépistage est simple et peut sauver des vies.',
        support: [
            'Réaliser le test de dépistage proposé aux personnes concernées.',
            'En parler à ses proches : le sujet reste tabou.',
            'Porter du bleu ou un ruban bleu pendant le mois.',
        ],
        symbols: 'Le ruban bleu foncé est associé au cancer colorectal.',
    },
    {
        id: 'endometriose', name: 'Mois de sensibilisation à l\'endométriose', cause: 'Endométriose', category: 'chronic',
        period: MONTH(3), ribbon: [YELLOW], emblem: 'Ruban jaune',
        about: 'L\'endométriose touche environ une femme sur dix. Elle provoque des douleurs importantes et peut affecter la fertilité ; le diagnostic arrive souvent après plusieurs années.',
        support: [
            'Faire connaître la maladie et écouter les personnes concernées.',
            'Ne pas minimiser les douleurs de règles invalidantes.',
            'Soutenir les associations de patientes.',
        ],
        symbols: 'Le ruban jaune est utilisé pour la sensibilisation à l\'endométriose.',
    },
    {
        id: 'trisomie-21', name: 'Journée mondiale de la trisomie 21', cause: 'Trisomie 21', category: 'chronic',
        period: DAY(3, 21), ribbon: [BLUE, YELLOW], emblem: 'Chaussettes dépareillées',
        about: 'La trisomie 21 est due à la présence d\'un chromosome 21 supplémentaire. La date (21/3) rappelle ces trois copies. La journée promeut l\'inclusion et les droits des personnes porteuses de trisomie.',
        support: [
            'Porter des chaussettes dépareillées et partager le geste.',
            'Promouvoir l\'inclusion à l\'école, au travail et dans les loisirs.',
            'Soutenir les associations de familles.',
        ],
        symbols: 'Les chaussettes dépareillées célèbrent la différence. Le ruban est bleu et jaune.',
    },
    {
        id: 'tuberculose', name: 'Journée mondiale de la tuberculose', cause: 'Tuberculose', category: 'infectious',
        period: DAY(3, 24), ribbon: [], emblem: 'Poumons',
        about: 'La tuberculose est une maladie infectieuse qui touche surtout les poumons. Elle se soigne et se guérit, mais reste l\'une des maladies infectieuses les plus meurtrières dans le monde.',
        support: [
            'Consulter en cas de toux persistante de plus de trois semaines.',
            'Informer sur la nécessité de suivre le traitement jusqu\'au bout.',
        ],
    },
    {
        id: 'autisme', name: 'Journée mondiale de sensibilisation à l\'autisme', cause: 'Autisme', category: 'neuro',
        period: DAY(4, 2), ribbon: [BLUE], emblem: 'Infini arc-en-ciel',
        about: 'Le trouble du spectre de l\'autisme se manifeste de façons très variées. Cette journée vise une meilleure compréhension, la lutte contre les préjugés et un meilleur accompagnement.',
        support: [
            'Éclairer ou porter du bleu (« Light It Up Blue »).',
            'S\'informer auprès de personnes autistes et d\'associations dirigées par elles.',
            'Adapter son accueil : environnement calme, communication claire.',
        ],
        symbols: 'Le bleu est la couleur de la campagne internationale. Le puzzle, historique, est critiqué par une partie de la communauté autiste, qui préfère le symbole de l\'infini arc-en-ciel.',
    },
    {
        id: 'sante-mondiale', name: 'Journée mondiale de la santé', cause: 'Santé pour tous (OMS)', category: 'care',
        period: DAY(4, 7), ribbon: [], emblem: 'Logo de l\'OMS',
        about: 'Célébrée à la date de création de l\'Organisation mondiale de la santé, elle met en avant chaque année un thème de santé publique choisi par l\'OMS.',
        support: ['Relayer le thème de l\'année auprès de ses collègues et du public.', 'Organiser une action de prévention locale.'],
    },
    {
        id: 'parkinson', name: 'Journée mondiale de la maladie de Parkinson', cause: 'Maladie de Parkinson', category: 'neuro',
        period: DAY(4, 11), ribbon: [], emblem: 'Tulipe rouge',
        about: 'La maladie de Parkinson est une maladie neurodégénérative qui affecte surtout le mouvement : tremblements, raideur, lenteur. Elle évolue sur de nombreuses années et se prend en charge de façon pluridisciplinaire.',
        support: [
            'Soutenir la recherche et les associations de patients.',
            'Aider les proches aidants.',
            'Encourager l\'activité physique adaptée.',
        ],
        symbols: 'La tulipe rouge est le symbole de la maladie : une variété de tulipe porte le nom d\'un horticulteur néerlandais qui en était atteint.',
    },
    {
        id: 'hemophilie', name: 'Journée mondiale de l\'hémophilie', cause: 'Hémophilie', category: 'chronic',
        period: DAY(4, 17), ribbon: [RED], emblem: 'Goutte de sang rouge',
        about: 'L\'hémophilie est une maladie hémorragique d\'origine génétique : le sang coagule mal. Un traitement adapté permet une vie quasi normale, mais l\'accès aux soins reste inégal dans le monde.',
        support: ['Informer sur la maladie et ses signes (saignements prolongés, hématomes).', 'Soutenir les associations de patients.'],
        symbols: 'La goutte de sang rouge est l\'emblème de la Fédération mondiale de l\'hémophilie.',
    },
    {
        id: 'croix-rouge', name: 'Journée de la Croix-Rouge et du Croissant-Rouge', cause: 'Aide humanitaire et secourisme', category: 'care',
        period: DAY(5, 8), ribbon: [], emblem: 'Croix rouge',
        about: 'Elle célèbre le mouvement humanitaire international et ses bénévoles, ainsi que la date de naissance de son fondateur, Henry Dunant.',
        support: ['Se former aux gestes de premiers secours.', 'Donner son sang.', 'Devenir bénévole auprès d\'une association de secours.'],
    },
    {
        id: 'infirmiers', name: 'Journée internationale des infirmier(ère)s', cause: 'Reconnaissance des soignants', category: 'care',
        period: DAY(5, 12), ribbon: [], emblem: 'Lampe de Florence Nightingale',
        about: 'Elle a lieu à la date de naissance de Florence Nightingale (1820), pionnière des soins infirmiers modernes. Elle met à l\'honneur le rôle essentiel des infirmiers et infirmières.',
        support: ['Remercier ses collègues infirmiers et infirmières.', 'Valoriser la profession auprès du public.', 'Organiser un moment de convivialité au sein du service.'],
        symbols: 'La lampe rappelle « la dame à la lampe », surnom de Florence Nightingale qui veillait ses patients la nuit.',
    },
    {
        id: 'cancer-peau', name: 'Mois du cancer de la peau et du mélanome', cause: 'Cancer de la peau', category: 'cancer',
        period: MONTH(5), ribbon: [BLACK], emblem: 'Ruban noir',
        about: 'Le mélanome est le plus grave des cancers de la peau, mais il se guérit très bien lorsqu\'il est détecté tôt. Le principal facteur de risque évitable est l\'exposition excessive au soleil.',
        support: [
            'Se protéger : crème solaire, vêtements, éviter les heures les plus chaudes.',
            'Surveiller ses grains de beauté et consulter en cas de changement.',
            'Ne pas utiliser de cabines de bronzage.',
        ],
        symbols: 'Le ruban noir est associé au mélanome.',
    },
    {
        id: 'sans-tabac', name: 'Journée mondiale sans tabac', cause: 'Lutte contre le tabagisme', category: 'care',
        period: DAY(5, 31), ribbon: [], emblem: 'Cigarette barrée',
        about: 'Organisée par l\'OMS, elle informe sur les risques du tabac (cancers, maladies cardiovasculaires et respiratoires) et encourage l\'arrêt.',
        support: ['Proposer son aide à un proche qui veut arrêter.', 'Faire connaître les dispositifs d\'aide au sevrage.', 'Relever le défi d\'une journée sans fumer.'],
    },
    {
        id: 'don-sang', name: 'Journée mondiale du donneur de sang', cause: 'Don de sang', category: 'care',
        period: DAY(6, 14), ribbon: [RED], emblem: 'Goutte de sang',
        about: 'Elle remercie les donneurs bénévoles et rappelle que les besoins en sang sont permanents : chirurgie, accidents, cancers, maladies du sang. Les produits sanguins ne se fabriquent pas, seul le don les permet.',
        support: ['Donner son sang si on le peut.', 'Inviter un proche à venir donner.', 'Relayer les collectes organisées près de chez soi.'],
        symbols: 'La goutte rouge est le symbole universel du don de sang.',
    },
    {
        id: 'drepanocytose', name: 'Journée mondiale de la drépanocytose', cause: 'Drépanocytose', category: 'chronic',
        period: DAY(6, 19), ribbon: [RED], emblem: 'Globule rouge en faucille',
        about: 'La drépanocytose est une maladie génétique du sang qui déforme les globules rouges. Elle cause des crises douloureuses et de la fatigue ; c\'est l\'une des maladies génétiques les plus répandues dans le monde.',
        support: ['Informer sur la maladie et le dépistage néonatal.', 'Encourager le don de sang, très utile aux patients.', 'Soutenir les associations de patients.'],
    },
    {
        id: 'hepatites', name: 'Journée mondiale contre les hépatites', cause: 'Hépatites virales', category: 'infectious',
        period: DAY(7, 28), ribbon: [YELLOW], emblem: 'Foie',
        about: 'Les hépatites virales provoquent une inflammation du foie. Les hépatites B et C peuvent devenir chroniques sans symptômes pendant des années ; un dépistage simple et des traitements efficaces existent.',
        support: ['Se faire dépister, en particulier en cas d\'exposition possible.', 'Se faire vacciner contre l\'hépatite B.', 'Informer sur les modes de transmission.'],
        symbols: 'Le jaune est une couleur de sensibilisation souvent utilisée pour les hépatites.',
    },
    {
        id: 'sarcomes', name: 'Mois de sensibilisation aux sarcomes', cause: 'Sarcomes (cancers des os et des tissus mous)', category: 'cancer',
        period: MONTH(7), ribbon: [YELLOW], emblem: 'Ruban jaune',
        about: 'Les sarcomes sont des cancers rares qui touchent les os et les tissus mous. Ils sont souvent découverts tardivement car leurs signes (boule, douleur persistante) sont banals.',
        support: ['Faire examiner toute boule qui grossit ou toute douleur osseuse persistante.', 'Soutenir la recherche sur les cancers rares.'],
        symbols: 'Le ruban jaune représente la sensibilisation aux sarcomes.',
    },
    {
        id: 'allaitement', name: 'Semaine mondiale de l\'allaitement maternel', cause: 'Allaitement', category: 'family',
        period: { startMonth: 8, startDay: 1, endMonth: 8, endDay: 7 }, ribbon: [], emblem: 'Mère et enfant',
        about: 'Elle encourage et soutient l\'allaitement, bénéfique pour la santé des bébés et des mères, tout en respectant le choix et la situation de chaque famille.',
        support: ['Offrir un cadre accueillant aux mères qui allaitent.', 'Orienter vers des conseillères en lactation.', 'Informer sans culpabiliser.'],
    },
    {
        id: 'septembre-or', name: 'Septembre en Or', cause: 'Cancers de l\'enfant', category: 'cancer',
        period: MONTH(9), ribbon: [GOLD], emblem: 'Ruban or',
        about: 'Un mois de mobilisation pour les enfants atteints de cancer et leurs familles, et pour financer la recherche : les cancers pédiatriques sont différents de ceux de l\'adulte et demandent des traitements spécifiques.',
        support: ['Porter un ruban or.', 'Participer à une collecte ou un événement solidaire.', 'Faire un don à une association de recherche pédiatrique.'],
        symbols: 'Le ruban or symbolise la valeur des enfants.',
    },
    {
        id: 'prostate-septembre', name: 'Mois du cancer de la prostate', cause: 'Cancer de la prostate', category: 'cancer',
        period: MONTH(9), ribbon: [LIGHT_BLUE], emblem: 'Ruban bleu clair',
        about: 'Le cancer de la prostate est le cancer le plus fréquent chez l\'homme. Évolutif lentement dans de nombreux cas, il se soigne bien lorsqu\'il est pris à temps.',
        support: ['Parler à son médecin du dépistage, surtout à partir de 50 ans ou plus tôt en cas d\'antécédents familiaux.', 'Inciter les hommes de son entourage à consulter.'],
        symbols: 'Le ruban bleu clair est associé à la santé de la prostate.',
    },
    {
        id: 'ovaire', name: 'Mois du cancer de l\'ovaire', cause: 'Cancer de l\'ovaire', category: 'cancer',
        period: MONTH(9), ribbon: [TEAL], emblem: 'Ruban turquoise',
        about: 'Le cancer de l\'ovaire est souvent silencieux : ballonnements persistants, douleurs du bas-ventre ou fatigue inhabituelle doivent amener à consulter.',
        support: ['Encourager à consulter devant des symptômes persistants.', 'Soutenir la recherche et les associations de patientes.'],
        symbols: 'Le ruban turquoise est le symbole du cancer de l\'ovaire.',
    },
    {
        id: 'prevention-suicide', name: 'Journée mondiale de prévention du suicide', cause: 'Prévention du suicide', category: 'mental',
        period: DAY(9, 10), ribbon: [TEAL, PURPLE], emblem: 'Bougie à la fenêtre',
        about: 'Parler du mal-être sauve des vies. Cette journée rappelle que le suicide peut être prévenu : écouter, ne pas banaliser et orienter vers une aide professionnelle.',
        support: [
            'Demander à un proche qui va mal comment il se sent, sans jugement.',
            'Connaître le 3114, numéro national de prévention du suicide en France (gratuit, 24 h/24).',
            'Allumer une bougie à sa fenêtre en signe de solidarité.',
        ],
        symbols: 'Le ruban turquoise et violet est celui de la prévention du suicide. La bougie à la fenêtre est un geste de souvenir et de soutien.',
    },
    {
        id: 'securite-patients', name: 'Journée mondiale de la sécurité des patients', cause: 'Sécurité des soins', category: 'care',
        period: DAY(9, 17), ribbon: [ORANGE], emblem: 'Bracelet d\'identification',
        about: 'Organisée par l\'OMS, elle appelle à réduire les erreurs et les événements évitables dans les soins : identification du patient, hygiène des mains, communication entre soignants.',
        support: ['Vérifier l\'identité du patient avant chaque acte.', 'Signaler les événements indésirables pour apprendre collectivement.', 'Soigner les transmissions entre équipes.'],
    },
    {
        id: 'alzheimer', name: 'Journée mondiale Alzheimer', cause: 'Maladie d\'Alzheimer', category: 'neuro',
        period: DAY(9, 21), ribbon: [PURPLE], emblem: 'Myosotis',
        about: 'La maladie d\'Alzheimer est la cause la plus fréquente de démence. Elle altère progressivement la mémoire et l\'autonomie, et touche aussi lourdement les proches aidants.',
        support: ['Rendre visite aux personnes isolées et à leurs aidants.', 'Soutenir les associations et la recherche.', 'S\'informer sur les premiers signes pour consulter tôt.'],
        symbols: 'Le violet est la couleur de la sensibilisation. Le myosotis (« ne m\'oubliez pas ») est la fleur emblème de la maladie.',
    },
    {
        id: 'journee-coeur', name: 'Journée mondiale du cœur', cause: 'Maladies cardiovasculaires', category: 'cardio',
        period: DAY(9, 29), ribbon: [RED], emblem: 'Cœur',
        about: 'Les maladies cardiovasculaires sont la première cause de mortalité dans le monde. Alimentation, activité physique, arrêt du tabac et contrôle de la tension en sont les meilleures préventions.',
        support: ['Bouger davantage et mieux manger.', 'Faire contrôler sa tension et son cholestérol.', 'Se former aux gestes qui sauvent (massage cardiaque, défibrillateur).'],
    },
    {
        id: 'octobre-rose', name: 'Octobre Rose', cause: 'Cancer du sein', category: 'cancer',
        period: MONTH(10), ribbon: [PINK], emblem: 'Ruban rose',
        about: 'Campagne annuelle de sensibilisation au dépistage du cancer du sein, le cancer le plus fréquent chez la femme. Détecté tôt, il guérit dans la grande majorité des cas. Les hommes peuvent aussi être concernés, plus rarement.',
        support: [
            'Réaliser ou rappeler à ses proches de réaliser le dépistage et l\'auto-palpation.',
            'Porter du rose ou un ruban rose pendant tout le mois.',
            'Faire un don ou participer à une marche ou une course solidaire.',
            'Organiser une animation de prévention dans son service.',
        ],
        symbols: 'Le ruban rose, né dans les années 1990, est devenu le symbole mondial de la lutte contre le cancer du sein.',
    },
    {
        id: 'sante-mentale', name: 'Journée mondiale de la santé mentale', cause: 'Santé mentale', category: 'mental',
        period: DAY(10, 10), ribbon: [GREEN], emblem: 'Ruban vert',
        about: 'Une personne sur plusieurs connaîtra un trouble psychique au cours de sa vie. La journée vise à lever les tabous, à faciliter l\'accès aux soins et à soutenir le bien-être psychique de tous.',
        support: ['Prendre des nouvelles de ses proches et de ses collègues.', 'Parler sans honte de sa propre santé mentale.', 'Orienter vers un professionnel quand c\'est nécessaire.'],
        symbols: 'Le ruban vert est le symbole de la sensibilisation à la santé mentale.',
    },
    {
        id: 'deuil-perinatal', name: 'Journée du deuil périnatal', cause: 'Deuil périnatal et perte d\'un nourrisson', category: 'family',
        period: DAY(10, 15), ribbon: [PINK, LIGHT_BLUE], emblem: 'Bougie (vague de lumière)',
        about: 'Elle honore les bébés décédés pendant la grossesse, à la naissance ou juste après, et soutient les parents endeuillés, dont la peine est souvent peu reconnue.',
        support: ['Accueillir les parents avec écoute et sans minimiser leur peine.', 'Allumer une bougie à 19 h (heure locale) lors de la « vague de lumière ».', 'Soutenir les associations d\'accompagnement du deuil périnatal.'],
        symbols: 'Le ruban rose et bleu évoque tous les bébés. La bougie allumée à 19 h forme une « vague de lumière » autour du monde.',
    },
    {
        id: 'polio', name: 'Journée mondiale de lutte contre la poliomyélite', cause: 'Poliomyélite', category: 'infectious',
        period: DAY(10, 24), ribbon: [], emblem: 'Vaccin',
        about: 'La polio, maladie qui peut provoquer une paralysie, est évitable par la vaccination. Elle a été presque éradiquée grâce à de vastes campagnes de vaccination.',
        support: ['Vérifier que ses vaccinations sont à jour.', 'Soutenir les programmes de vaccination dans le monde.'],
    },
    {
        id: 'avc', name: 'Journée mondiale de l\'AVC', cause: 'Accident vasculaire cérébral', category: 'cardio',
        period: DAY(10, 29), ribbon: [{ name: 'Rouge', hex: '#c0392b' }], emblem: 'Test « FAST » / VITE',
        about: 'Un AVC est une urgence : chaque minute compte. Reconnaître les signes (visage qui s\'affaisse, bras qui faiblit, parole difficile) et appeler les secours sans attendre améliore les chances de récupération.',
        support: ['Apprendre à reconnaître les signes d\'un AVC et appeler immédiatement les secours.', 'Contrôler sa tension artérielle.', 'Arrêter de fumer et bouger régulièrement.'],
        symbols: 'En France, la méthode « VITE » (Visage paralysé, Inertie d\'un membre, Trouble de la parole, Extrême urgence) aide à reconnaître un AVC.',
    },
    {
        id: 'movember', name: 'Movember (Novembre Bleu)', cause: 'Santé des hommes : prostate, testicules, santé mentale', category: 'cancer',
        period: MONTH(11), ribbon: [LIGHT_BLUE], emblem: 'Moustache',
        about: 'Chaque novembre, des hommes laissent pousser leur moustache pour attirer l\'attention sur la santé masculine : cancers de la prostate et des testicules, santé mentale et prévention du suicide.',
        support: [
            'Laisser pousser sa moustache ou en dessiner une, et le dire autour de soi.',
            'Collecter des dons via une page de collecte personnelle.',
            'Prendre des nouvelles de ses amis, rappeler l\'importance de consulter.',
        ],
        symbols: 'La moustache est l\'emblème de la campagne. Le bleu est la couleur associée à la santé masculine.',
    },
    {
        id: 'cancer-poumon', name: 'Mois du cancer du poumon', cause: 'Cancer du poumon', category: 'cancer',
        period: MONTH(11), ribbon: [WHITE], emblem: 'Ruban blanc nacré',
        about: 'Le cancer du poumon reste l\'un des plus meurtriers, et le tabac en est la première cause. Arrêter de fumer à tout âge réduit le risque. Novembre est aussi le « Mois sans tabac » en France.',
        support: ['Relever le défi du Mois sans tabac ou accompagner quelqu\'un qui arrête.', 'Consulter en cas de toux persistante ou de crachats sanglants.', 'Soutenir la recherche.'],
        symbols: 'Le ruban blanc ou nacré est celui du cancer du poumon.',
    },
    {
        id: 'diabete', name: 'Journée mondiale du diabète', cause: 'Diabète', category: 'chronic',
        period: DAY(11, 14), ribbon: [BLUE], emblem: 'Cercle bleu',
        about: 'Le diabète est une maladie chronique où le taux de sucre dans le sang est trop élevé. Mal contrôlé, il abîme le cœur, les reins, les yeux et les nerfs. Une bonne hygiène de vie et un dépistage précoce limitent les complications.',
        support: ['Faire mesurer sa glycémie en cas de facteurs de risque.', 'Bouger et équilibrer son alimentation.', 'Soutenir les personnes diabétiques dans leur quotidien.'],
        symbols: 'Le cercle bleu est le symbole de la lutte contre le diabète, adopté par les Nations unies.',
    },
    {
        id: 'prematurite', name: 'Journée mondiale de la prématurité', cause: 'Naissances prématurées', category: 'family',
        period: DAY(11, 17), ribbon: [PURPLE], emblem: 'Ruban violet',
        about: 'Un bébé sur dix naît avant 37 semaines de grossesse. Les soins néonatals, la présence des parents et le contact peau à peau améliorent fortement les chances et le développement des prématurés.',
        support: ['Soutenir les parents de prématurés.', 'Encourager le contact peau à peau quand il est possible.', 'Éclairer ou porter du violet.'],
        symbols: 'Le violet est la couleur de la prématurité.',
    },
    {
        id: 'violences-femmes', name: 'Journée contre les violences faites aux femmes', cause: 'Violences envers les femmes', category: 'care',
        period: DAY(11, 25), ribbon: [ORANGE], emblem: 'Orange the World',
        about: 'Les violences ont des conséquences graves sur la santé physique et psychique. Les soignants sont souvent les premiers à les repérer : savoir poser la question et orienter est essentiel.',
        support: ['Repérer les signes et poser la question avec bienveillance.', 'Connaître les dispositifs d\'aide (en France, le 3919).', 'Porter de l\'orange en signe de solidarité.'],
        symbols: 'L\'orange est la couleur de la campagne « Orange the World » des Nations unies.',
    },
    {
        id: 'sida', name: 'Journée mondiale de lutte contre le sida', cause: 'VIH / sida', category: 'infectious',
        period: DAY(12, 1), ribbon: [RED], emblem: 'Ruban rouge',
        about: 'Le VIH se transmet par certains liquides corporels. Aujourd\'hui, le dépistage, les traitements préventifs et les traitements antirétroviraux permettent de vivre avec le VIH et de ne plus le transmettre. La journée lutte aussi contre la discrimination.',
        support: ['Se faire dépister et utiliser les moyens de protection.', 'Combattre la stigmatisation des personnes séropositives.', 'Porter le ruban rouge.'],
        symbols: 'Le ruban rouge a été créé en 1991 par des artistes new-yorkais ; c\'est le symbole de la solidarité envers les personnes vivant avec le VIH.',
    },
];

// ───────────────────────────── Aide aux dates ─────────────────────────────

const lastDayOf = (year, month) => new Date(year, month, 0).getDate();
const resolveDay = (year, month, day) => (day === 'last' ? lastDayOf(year, month) : day);

// Début et fin de l'événement pour une année donnée (Date locales, fin à 23:59:59).
export const getEventRange = (event, year) => {
    const { startMonth, startDay, endMonth = startMonth, endDay } = event.period;
    const start = new Date(year, startMonth - 1, resolveDay(year, startMonth, startDay));
    const finalDay = endDay === undefined ? startDay : endDay;
    const end = new Date(year, endMonth - 1, resolveDay(year, endMonth, finalDay), 23, 59, 59);
    return { start, end };
};

// Texte de dates lisible : « 4 février » ou « du 1er au 31 octobre ».
export const formatEventDates = (event, year) => {
    const { start, end } = getEventRange(event, year);
    const dayFormat = { day: 'numeric', month: 'long' };
    if (start.getDate() === end.getDate() && start.getMonth() === end.getMonth()) {
        return start.toLocaleDateString('fr-FR', dayFormat);
    }
    const isWholeMonth = start.getDate() === 1 && end.getMonth() === start.getMonth() && end.getDate() === lastDayOf(year, start.getMonth() + 1);
    if (isWholeMonth) return start.toLocaleDateString('fr-FR', { month: 'long' }).replace(/^./, (c) => c.toUpperCase()) + ' (tout le mois)';
    return `du ${start.toLocaleDateString('fr-FR', dayFormat)} au ${end.toLocaleDateString('fr-FR', dayFormat)}`;
};

export const isEventActive = (event, date) => {
    const { start, end } = getEventRange(event, date.getFullYear());
    return date >= start && date <= end;
};

// Nombre de jours avant le prochain début (0 si en cours ; l'année suivante si déjà passé).
export const daysUntilEvent = (event, date) => {
    if (isEventActive(event, date)) return 0;
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    let { start } = getEventRange(event, date.getFullYear());
    if (start < today) start = getEventRange(event, date.getFullYear() + 1).start;
    return Math.round((start - today) / 86400000);
};

// Un événement chevauche-t-il ce mois (1-12) ?
export const eventTouchesMonth = (event, month) => {
    const { startMonth, endMonth = startMonth } = event.period;
    return month >= startMonth && month <= endMonth;
};

// ───────────────────────────── Lien avec les effets de saison ─────────────────────────────
// Les effets visuels suivent ce calendrier (voir components/SeasonalEvents.js) :
//   • un événement d'un jour ou d'une semaine (≤ 7 jours) passe AVANT les événements d'un mois entier ;
//   • s'il y a plusieurs événements au même niveau (ex. septembre : Septembre en Or, prostate, ovaire),
//     leurs rubans tombent ensemble, à parts égales.
export const SHORT_EVENT_MAX_DAYS = 7;

export const getEventDurationDays = (event, year) => {
    const { start, end } = getEventRange(event, year);
    return Math.round((end - start) / 86400000);
};

// Tous les événements en cours à cette date (jours, semaines et mois confondus) : liste du calendrier / infobulle.
export const getActiveEvents = (date) => AWARENESS_EVENTS.filter((event) => isEventActive(event, date));

// Événements qui pilotent l'effet visuel : les courts s'ils existent, sinon ceux du mois.
export const getEffectEvents = (date) => {
    const active = getActiveEvents(date);
    const short = active.filter((event) => getEventDurationDays(event, date.getFullYear()) <= SHORT_EVENT_MAX_DAYS);
    if (short.length > 0) return { tier: 'short', events: short };
    if (active.length > 0) return { tier: 'month', events: active };
    return { tier: null, events: [] };
};

// Prochain événement à venir (hors événements déjà en cours) et nombre de jours avant son début.
export const getNextEvent = (date) => {
    let best = null;
    AWARENESS_EVENTS.forEach((event) => {
        if (isEventActive(event, date)) return;
        const days = daysUntilEvent(event, date);
        // Année du prochain début (l'an prochain si l'événement de cette année est déjà passé).
        const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const year = getEventRange(event, date.getFullYear()).start < today ? date.getFullYear() + 1 : date.getFullYear();
        if (!best || days < best.days) best = { event, days, year };
    });
    return best;
};

// Emblème en emoji pour les événements SANS ruban (ou dont l'emblème est plus parlant que le ruban).
// Emojis anciens uniquement : les récents s'affichent en carré vide sur certains systèmes.
const EFFECT_EMOJI = {
    'tuberculose': '🌬️',
    'sante-mondiale': '🌍',
    'parkinson': '🌷',
    'croix-rouge': '⛑️',
    'infirmiers': '🩺',
    'sans-tabac': '🚭',
    'don-sang': '🩸',
    'hemophilie': '🩸',
    'allaitement': '🍼',
    'securite-patients': '🩺',
    'polio': '💉',
    'maladies-rares': '🦓',
    'trisomie-21': '🧦',
    'movember': '🧔',
};

// Emoji de l'effet pour cet événement, ou null s'il doit utiliser son ruban coloré.
export const getEventEffectEmoji = (event) => {
    if (EFFECT_EMOJI[event.id]) return EFFECT_EMOJI[event.id];
    return event.ribbon.length === 0 ? '🩺' : null;
};
