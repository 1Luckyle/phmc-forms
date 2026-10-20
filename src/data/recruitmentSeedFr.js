// src/data/recruitmentSeedFr.js
//
// Traductions françaises PROPOSÉES des postes de recrutement d'origine (ceux du script de migration initial,
// voir recruitmentSeedEn.json), et correspondance poste → rôle du personnel. Utilisé UNIQUEMENT par l'outil
// de migration « Recrutement en français » :
//   • un texte n'est remplacé par sa traduction que si le texte en base est resté IDENTIQUE à l'original
//     anglais ; un texte modifié depuis est conservé tel quel et signalé « à traduire » ;
//   • les diplômes et certifications américains restent en anglais (MD, DO, BSN, ADN, MSN, DNP, RN, BLS,
//     ACLS, USMLE, Ph.D., Psy.D., MSW, LCSW, EMT-P…), comme demandé ;
//   • `cle` = nouvelle clé du poste (son nom français) ; `role` = rôle du personnel obtenu à l'embauche
//     (valeur de constants/ranks.js), vide quand aucun rôle ne correspond clairement.
//
// Clés : ancienne clé du poste dans la base (anglaise) — identique à celle du seed.
const COMMON_PRESENTATION = `Lorsque le travail que vous accomplissez chaque jour a un impact crucial sur la vie des autres... (suite de votre présentation)`;
const COMMON_SKILL1 = `Fortes capacités d'observation.`;
const COMMON_SKILL2 = `Envie d'apprendre et de s'adapter.`;
const COMMON_SKILL3 = `Compréhension de base de la terminologie médicale.`;
const COMMON_EDU = `Être actuellement inscrit(e) dans une faculté de médecine accréditée. Avoir terminé les enseignements précliniques est préférable.`;

const placeholderPosition = (nom, role) => ({
    nom, cle: nom, role,
    presentation: COMMON_PRESENTATION,
    competence1: COMMON_SKILL1, competence2: COMMON_SKILL2, competence3: COMMON_SKILL3,
    diplome: COMMON_EDU,
});

export const POSTES_FR = {
    // ───────────── Médecine ─────────────
    'Rotation (Medical Students)': {
        nom: 'Externe en Médecine (Rotation)', cle: 'Externe en Médecine (Rotation)', role: 'Externe / Étudiant(e) en Médecine',
        presentation: `Lorsque le travail que vous accomplissez chaque jour a un impact crucial sur la vie des autres, chaque effort, chaque détail et chaque seconde comptent. En tant qu'étudiant(e) en médecine à temps plein au sein de notre programme de rotation, vous découvrirez de l'intérieur le fonctionnement quotidien d'un hôpital. Les étudiants en médecine se trouvent à un moment charnière de leur parcours universitaire et de leur future carrière lorsqu'ils recherchent un stage formel. Grâce à notre programme, les étudiants acquerront une expérience de terrain aux côtés de professionnels de santé forts de plusieurs décennies d'expérience, ce qui les aidera à se préparer à un domaine médical en constante évolution. \n\nCe programme s'adresse à celles et ceux qui sont actuellement inscrits dans une faculté de médecine accréditée et qui ont terminé leurs enseignements précliniques. Les étudiants devront travailler aux côtés de nos professionnels de santé et auront la possibilité de les accompagner dans différents services. Ils devront également réaliser une série de travaux et de projets tout au long du programme, qui les prépareront à leur future carrière en médecine. \n\n Si vous souhaitez candidater à ce programme, veuillez déposer votre candidature via notre site. Nous nous réjouissons de vous lire !`,
        competence1: COMMON_SKILL1, competence2: COMMON_SKILL2, competence3: COMMON_SKILL3, diplome: COMMON_EDU,
    },
    'Dentist': placeholderPosition('Dentiste', 'Dentiste'),
    'Attending Physician': placeholderPosition('Médecin Titulaire', 'Médecin Titulaire'),
    'Physical Therapist': placeholderPosition('Kinésithérapeute', 'Kinésithérapeute'),
    'Pharmacist': placeholderPosition('Pharmacien(ne)', 'Pharmacien(ne)'),
    'Surgical Resident': placeholderPosition('Interne en Chirurgie', 'Interne en Médecine'),
    'Physician Assistant': placeholderPosition('Assistant(e) Médecin', 'Assistant(e) Médecin'),
    'Resident Physician': {
        nom: 'Interne en Médecine', cle: 'Interne en Médecine', role: 'Interne en Médecine',
        presentation: `Un interne en médecine (« resident ») est un médecin qui a terminé ses études de médecine et poursuit sa formation dans une spécialité médicale précise. Les internes travaillent dans les hôpitaux et établissements de santé sous la supervision de médecins titulaires expérimentés. Leurs missions comprennent le diagnostic et le traitement des patients, la réalisation d'actes médicaux et l'apprentissage des subtilités de leur spécialité. Les internes jouent un rôle essentiel dans la prise en charge des patients : ils acquièrent une expérience pratique, développent leurs compétences cliniques et gagnent progressivement en autonomie dans leur exercice. Cette phase de formation dure généralement plusieurs années, après lesquelles ils peuvent viser une certification (« board certification ») dans la spécialité choisie.`,
        competence1: `Un esprit critique, un jugement décisif et la capacité de travailler seul(e) comme en équipe sont requis.\n- La capacité de travailler dans un environnement stressant et d'agir de manière appropriée est indispensable. Le ou la candidat(e) doit être en bonne condition physique pour répondre à des exigences telles que déplacer et soulever des patients, avec une mobilité complète du corps, une dextérité manuelle des doigts et une bonne coordination œil-main.`,
        competence2: `De solides compétences relationnelles pour échanger avec les patients et le personnel sont obligatoires.\n- Avoir au moins vingt-six (26) ans et posséder une adresse légale dans l'État de San Andreas ;`,
        competence3: `Avoir un état de santé physique et mental satisfaisant pour exercer les fonctions essentielles du poste en toute sécurité.\n- Ne pas avoir été condamné(e) pour un crime ou un délit récent.`,
        diplome: `Être titulaire d'un diplôme d'une université ou d'un établissement dont l'accréditation est reconnue aux États-Unis d'Amérique. \n- Être docteur en médecine (MD) ou docteur en médecine ostéopathique (DO) agréé(e) dans l'État de San Andreas.\n- Avoir déjà exercé en médecine d'urgence ou en médecine interne.`,
    },

    // ───────────── Psychologie & Psychiatrie ─────────────
    'Counseling Psychologist': {
        nom: 'Psychologue Conseil', cle: 'Psychologue Conseil', role: 'Psychologue',
        presentation: `Stage d'entrée de carrière pour les futur(e)s psychologues...`,
        competence1: `Principes de base de la psychologie.`, competence2: `Compétences de communication.`, competence3: `Empathie.`,
        diplome: `Être inscrit(e) ou diplômé(e) d'une licence ou d'un master (Bachelor's / Master's) en psychologie.`,
    },
    'Resident Psychiatrist': {
        nom: 'Psychologue Résident(e)', cle: 'Psychologue Résident(e)', role: 'Psychologue',
        presentation: `Poste de formation pour les psychologues diplômé(e)s de troisième cycle...`,
        competence1: `Théories psychologiques avancées.`, competence2: `Expérience en évaluation clinique.`, competence3: `Collaboration en équipe.`,
        diplome: `Doctorat (Ph.D./Psy.D.) en psychologie. Éligibilité à la licence d'exercice.`,
    },
    'Attending Psychiatrist': {
        nom: 'Psychiatre Titulaire', cle: 'Psychiatre Titulaire', role: 'Psychiatre',
        presentation: `Médecin diplômé(e) spécialisé(e) en psychiatrie...`,
        competence1: `Expertise en psychopharmacologie.`, competence2: `Qualités de leadership.`, competence3: `Gestion de cas complexes.`,
        diplome: `MD/DO. Internat en psychiatrie. Certification (board certification). Licence d'exercice.`,
    },
    'Psychologist': {
        nom: 'Psychologue', cle: 'Psychologue', role: 'Psychologue',
        presentation: `Propose des services de conseil et de thérapie...`,
        competence1: `Évaluation et intervention de crise.`, competence2: `Connaissance des ressources locales.`, competence3: `Compétence culturelle.`,
        diplome: `MSW. Licence LCSW.`,
    },

    // ───────────── Administration & Services ─────────────
    'Janitor': {
        nom: `Agent d'Entretien`, cle: `Agent d'Entretien`, role: 'Personnel Polyvalent',
        presentation: `Un agent d'entretien réalise diverses tâches de nettoyage, d'assainissement et d'entretien dans et autour des bâtiments de l'hôpital ou des sites d'événements officiels, ainsi que de petits travaux d'entretien des espaces extérieurs attenants. Il doit s'assurer que tout est en état de fonctionnement et, dans le cas contraire, prendre en charge le problème et le réparer immédiatement. L'étendue des missions est très variée. Elle est toutefois principalement d'ordre pratique et technique : nettoyer les escaliers, faire fonctionner le chauffage central et garantir le bon fonctionnement général de l'hôpital.`,
        competence1: `Avoir au moins vingt et un (21) ans et posséder une adresse légale dans l'État de San Andreas.\nNe pas avoir été condamné(e) pour un crime ou un délit récent.`,
        competence2: `Savoir bien travailler en équipe tout en faisant preuve d'autonomie par moments.\nÊtre en bonne santé et en bonne condition physique pour supporter les efforts fréquents tels que soulever, se pencher et s'agenouiller, ainsi que rester debout, marcher et atteindre des endroits dans l'hôpital.`,
        competence3: `Respecter toutes les politiques de l'hôpital et ses règles éthiques.\nAvoir une image publique irréprochable et une empreinte notable dans les réseaux sociaux et les cercles professionnels de la ville.`,
        diplome: `Avoir déjà de l'expérience dans des travaux d'entretien lors de postes précédents, ou avoir suivi une formation procurant cette expérience.`,
    },
    'Cafeteria Staff': {
        nom: 'Personnel de Restauration', cle: 'Personnel de Restauration', role: 'Personnel Polyvalent',
        presentation: `Le personnel de restauration prépare les repas selon les menus, les restrictions alimentaires ou nutritionnelles particulières et le nombre de portions à servir. Il doit veiller à ce que chacun reçoive un repas compatible avec sa tolérance digestive.\nLe poste de cuisinier ne doit pas être sous-estimé : il comporte de nombreuses exigences et responsabilités importantes, comme nettoyer la cuisine, découper et cuisiner viandes, poissons et volailles, ainsi que proposer un menu varié au personnel de l'hôpital et aux patients.`,
        competence1: `Avoir au moins vingt et un (21) ans et posséder une adresse légale dans l'État de San Andreas.`,
        competence2: `Ne pas avoir été condamné(e) pour un crime ou un délit récent.`,
        competence3: `Respecter toutes les politiques de l'hôpital et ses règles éthiques.`,
        diplome: `Avoir déjà de l'expérience.`,
    },
    'Human Resources Assistant': {
        nom: 'Assistant(e) Ressources Humaines', cle: 'Assistant(e) Ressources Humaines', role: 'Chargé(e) de Recrutement',
        presentation: `En tant que membre des Ressources Humaines, vous aurez la possibilité de consacrer votre temps à aider le personnel de terrain de l'hôpital dans l'exercice de ses fonctions. Vous devrez mettre à profit votre expérience antérieure pour mener à bien vos missions et préserver une image publique irréprochable, pour vous-même comme pour l'hôpital. Vous aiderez en outre chaque service pour les questions de recrutement et d'intégration, réaliserez des vérifications d'antécédents, mènerez des entretiens et transmettrez les comptes rendus aux responsables et aux directeurs.`,
        competence1: `Avoir au moins vingt et un (21) ans et posséder une adresse légale dans l'État de San Andreas.`,
        competence2: `Ne pas avoir été condamné(e) pour un crime ou un délit récent.`,
        competence3: `Respecter toutes les politiques de l'hôpital et ses règles éthiques.`,
        diplome: `Avoir déjà de l'expérience.`,
    },

    // ───────────── Soins infirmiers ─────────────
    'Registered Nurse': {
        nom: `Infirmier(ère) Diplômé(e) d'État (RN)`, cle: `Infirmier(ère) Diplômé(e) d'État (RN)`, role: 'Infirmier(ère)',
        presentation: `Réaliser des évaluations complètes des patients, élaborer des plans de soins individualisés et en évaluer les résultats.\nAdministrer les médicaments, réaliser des soins et des actes, et apporter un soutien émotionnel aux patients et à leurs familles.\nSuperviser et déléguer des tâches aux infirmiers auxiliaires (LVN), aux internes en soins infirmiers et aux autres personnels de soutien, tout en veillant au respect des protocoles de l'hôpital. \nInformer les patients et leurs familles sur les diagnostics, les plans de traitement et les soins après la sortie pour favoriser la santé et la guérison.\nTravailler en étroite collaboration avec les médecins, les praticiens de pratique avancée et les autres professionnels de santé pour coordonner une prise en charge globale.\nAgir en première intervention lors des urgences médicales, en engageant si nécessaire les gestes de sauvetage.`,
        competence1: `Doit démontrer sa capacité à poser des jugements cliniques sûrs et à hiérarchiser efficacement les priorités dans un environnement de soins dynamique.\nDoit être efficace dans les situations de forte pression, y compris les urgences.\nDoit être en bonne condition physique pour soulever, déplacer et repositionner les patients, et pouvoir répondre aux exigences physiques de gardes de 12 heures. \nDoit avoir de solides capacités de communication orale et écrite pour échanger avec des patients, des familles et des équipes variés.`,
        competence2: `Doit avoir une santé physique et mentale satisfaisante pour exercer les fonctions essentielles en toute sécurité, et respecter toutes les politiques de l'hôpital et les normes éthiques professionnelles.\nUne expérience clinique préalable en milieu hospitalier ou de soins aigus est préférable mais non obligatoire pour les jeunes diplômé(e)s. `,
        competence3: `\n(( Si vous jouez une expérience clinique préalable, elle doit figurer dans l'histoire de votre personnage. ))\nDoit avoir au moins 20 à 21 ans.\nNe doit pas avoir été condamné(e) pour un crime ou un délit pertinent par le passé..`,
        diplome: `Doit être titulaire d'un Associate's Degree in Nursing (ADN) ou d'un Bachelor of Science in Nursing (BSN) d'un programme accrédité. Un BSN est préféré. (( Cela doit faire partie de l'histoire de votre personnage. ))\nDoit posséder une licence active et sans restriction de Registered Nurse (RN) de San Andreas. (( PNJ ))\nDoit détenir une certification Basic Life Support (BLS) en cours de validité. Les certifications Advanced Cardiac Life Support (ACLS), Pediatric Advanced Life Support (PALS) et d'autres certifications propres à un service (ex. TNCC pour les infirmiers en traumatologie) sont également bienvenues. (( Cela doit faire partie de l'histoire de votre personnage. ))\nDoit résider dans l'État de San Andreas ou être en mesure de s'y installer.`,
    },
    'Nurse Practitioner': {
        nom: 'Infirmier(ère) en Pratique Avancée (NP)', cle: 'Infirmier(ère) en Pratique Avancée (NP)', role: 'Infirmier(ère) en Pratique Avancée',
        presentation: `Réaliser des bilans de santé complets, comprenant le recueil de l'historique, l'examen physique et les examens diagnostiques.\nÉlaborer et mettre en œuvre des plans de traitement fondés sur les preuves, adaptés aux besoins de chaque patient.\nPrescrire des médicaments, demander des examens diagnostiques et recommander des interventions thérapeutiques dans le respect de la réglementation du San Andreas Board of Nursing.\nTravailler en étroite collaboration avec les médecins, les infirmiers et les professionnels paramédicaux dans la prise en charge de cas complexes.\nInformer les patients et leurs familles sur les pathologies, les traitements et la prévention..\nEncadrer le personnel infirmier et contribuer aux initiatives de formation du personnel afin de renforcer les compétences cliniques de l'équipe.\nRépondre aux situations de soins aigus, engager les gestes de sauvetage et stabiliser les patients en état critique.`,
        competence1: `Doit faire preuve de remarquables capacités d'analyse et savoir prendre des décisions cliniques de manière autonome.\nDoit rester calme et efficace dans des environnements rapides et sous forte pression.`,
        competence2: `Doit être en bonne condition physique pour répondre aux exigences de la prise en charge des patients, y compris les gardes prolongées et les urgences.\nDe solides compétences de communication pour échanger efficacement avec les patients, les familles et les équipes pluridisciplinaires, ainsi que des qualités de leadership pour encadrer et guider le personnel.`,
        competence3: `Doit avoir une santé physique et mentale satisfaisante pour exercer les fonctions essentielles en toute sécurité. Doit respecter toutes les politiques de l'hôpital et les normes éthiques.`,
        diplome: `Doit être titulaire d'un Master of Science in Nursing (MSN) ou d'un Doctor of Nursing Practice (DNP) d'un programme accrédité. (( Cela doit faire partie de l'histoire de votre personnage. ))\nDoit posséder une licence RN active de San Andreas. (( **PNJ** ))\nDoit détenir une certification nationale (board certification) dans un domaine de spécialité (ex. AANP, ANCC). (( **Cela doit faire partie de l'histoire de votre personnage**. ))\nAu minimum deux années d'expérience clinique en soins infirmiers sont préférables. Une expérience de NP dans un cadre de soins similaire est vivement souhaitée.`,
    },
    'Student Nurse': {
        nom: 'Étudiant(e) Infirmier(ère)', cle: 'Étudiant(e) Infirmier(ère)', role: 'Externe / Étudiant(e) Infirmier(ère)',
        presentation: `Réaliser des tâches telles que la prise des constantes vitales, l'aide à l'hygiène et le signalement des observations, sous la supervision directe d'un(e) RN ou d'un(e) LVN.\nSuivre des infirmiers expérimentés et participer à des actes non invasifs pour construire des connaissances de base.\nAider aux tâches administratives, au réapprovisionnement et à l'entretien d'espaces de travail propres et organisés.\nParticiper aux séances de formation, aux simulations et aux réunions de service prévues pour renforcer les compétences cliniques.`,
        competence1: `Un esprit critique, un jugement décisif et la capacité de s'adapter à diverses situations cliniques sous supervision sont requis.`,
        competence2: `La capacité de travailler dans un environnement rapide et sous pression tout en gardant son calme est essentielle.\nLes candidat(e)s doivent être en bonne condition physique pour effectuer des tâches telles que déplacer et soulever des patients, avec une mobilité complète du corps, une dextérité manuelle des doigts et une bonne coordination œil-main.`,
        competence3: `Une communication efficace et le travail d'équipe sont obligatoires pour échanger avec les patients, les familles et le personnel.\nLes candidat(e)s doivent résider dans l'État de San Andreas et avoir au moins 18 ans.\nNe doivent pas avoir été condamné(e)s pour un crime ou un délit pertinent par le passé.`,
        diplome: `Doit conserver une santé physique et mentale satisfaisante pour exercer les fonctions essentielles en toute sécurité et respecter toutes les politiques de l'hôpital et règles éthiques.`,
    },
    'Nursing Intern': {
        nom: 'Interne en Soins Infirmiers', cle: 'Interne en Soins Infirmiers', role: 'Aide Soignant(e)',
        presentation: `Assister les infirmiers diplômés pour l'hygiène, la mobilité, la nutrition et le confort des patients.\nRéaliser des tâches cliniques de base, comme relever les constantes vitales, préparer le matériel et surveiller l'état des patients, sous la supervision d'un(e) RN ou d'un(e) LVN.\nAssister aux formations continues, aux simulations et aux séances de développement du personnel pour renforcer les compétences cliniques.\nVeiller à ce que les zones de soins soient propres, bien approvisionnées et organisées.`,
        competence1: `Un esprit critique, un jugement décisif et la capacité de travailler aussi bien seul(e) qu'en collaboration au sein d'une équipe de soins sont requis.`,
        competence2: `Doit faire preuve de résilience et de sang-froid dans un environnement clinique sous forte pression.\nLes candidat(e)s doivent pouvoir répondre aux exigences physiques de la prise en charge des patients, notamment déplacer et soulever des patients, avec une mobilité complète du corps et une motricité fine.`,
        competence3: `Une communication et une collaboration efficaces avec les patients, les familles et le personnel soignant sont essentielles.\nDoit avoir une santé physique et mentale satisfaisante pour exercer les fonctions essentielles en toute sécurité et respecter toutes les politiques de l'hôpital et règles éthiques.\nNe doit pas avoir été condamné(e) pour un crime ou un délit pertinent par le passé.`,
        diplome: `Doit avoir terminé au moins une année d'un programme de soins infirmiers approuvé par San Andreas ou en être récemment diplômé(e). Doit fournir la preuve d'une inscription en cours ou récente.`,
    },

    // ───────────── Paramédical (EMS) ─────────────
    'Paramedic': {
        nom: 'Paramedic', cle: 'Paramedic', role: 'Paramedic',
        presentation: `Les paramedics sont des professionnels avancés des soins pré-hospitaliers, chargés de répondre aux appels médicaux d'urgence, d'évaluer l'état des patients et de réaliser des interventions médicales critiques. Ils travaillent dans des environnements dynamiques, souvent sous forte pression, pour stabiliser les patients et les transporter vers des établissements de santé. Leurs principales responsabilités incluent le maintien avancé des fonctions vitales (ALS), l'administration de médicaments et les soins de traumatologie.`,
        competence1: `Maîtrise des techniques de maintien avancé des fonctions vitales (ALS) et des protocoles d'urgence médicale.`,
        competence2: `Solides capacités de décision et aptitude à rester calme et efficace sous pression.`,
        competence3: `Excellentes compétences de communication et de relations interpersonnelles avec les patients et l'équipe.`,
        diplome: `Avoir terminé un programme de Paramedic accrédité et détenir la certification / licence d'État en cours de validité de Paramedic. Permis de conduire valide.`,
    },
    'EMT': {
        nom: 'Technicien(ne) Ambulancier(ère) (EMT)', cle: 'Technicien(ne) Ambulancier(ère) (EMT)', role: 'Technicien(ne) Ambulancier(ère) (EMT)',
        presentation: `Les EMT assurent le maintien de base des fonctions vitales (BLS) et les soins médicaux d'urgence aux patients sur les lieux d'un incident et pendant le transport vers l'hôpital. Ils évaluent l'état des patients, gèrent les voies aériennes, contrôlent les saignements et aident à l'administration de médicaments sous direction médicale. Les EMT sont des premiers intervenants essentiels du système de secours médical d'urgence.`,
        competence1: `Maîtrise des compétences de maintien de base des fonctions vitales (BLS) et de l'évaluation du patient.`,
        competence2: `Capacité à travailler efficacement en équipe et à suivre précisément les protocoles médicaux.`,
        competence3: `Bonne endurance physique et capacité à soulever et déplacer les patients en toute sécurité.`,
        diplome: `Avoir terminé un programme d'EMT accrédité et détenir la certification / licence d'État en cours de validité d'EMT. Permis de conduire valide.`,
    },
    'Part-Time EMS Program': {
        nom: 'Programme EMS à Temps Partiel', cle: 'Programme EMS à Temps Partiel', role: '',
        presentation: `Le programme EMS à temps partiel offre des opportunités flexibles aux EMT et Paramedics certifiés pour contribuer aux secours médicaux d'urgence à temps partiel. Les participants répondent aux appels, dispensent les soins aux patients et travaillent aux côtés du personnel à temps plein, tout en entretenant leurs compétences et en servant la communauté. Ce programme est idéal pour celles et ceux qui souhaitent concilier le travail en EMS avec d'autres engagements.`,
        competence1: `Certification / licence d'EMT ou de Paramedic en cours de validité et en règle.`,
        competence2: `Capacité à s'adapter à des horaires et à des environnements de travail variables.`,
        competence3: `Engagement à maintenir sa compétence clinique et à respecter les protocoles EMS.`,
        diplome: `Certification / licence d'État valide d'EMT ou de Paramedic. Une expérience préalable sur le terrain est souvent préférée.`,
    },

    // ───────────── Médecine légale (DMEC) ─────────────
    'Coroner Internship': {
        nom: 'Interne Médico-Légal(e)', cle: 'Interne Médico-Légal(e)', role: 'Interne Médico-Légal(e)',
        presentation: `En tant qu'interne au sein de notre département, vous pourrez accompagner nos équipes sur le terrain et assister à l'essentiel de notre travail, de l'investigation de base sur une scène de crime au transport des corps. Vous pourrez également assister à des autopsies et ainsi observer comment nos médecins légistes établissent la cause du décès de quelqu'un.\nVos missions consisteront principalement à suivre nos Coroners sur le terrain ; bien que vous ne puissiez pas interagir directement avec la scène, on pourra vous demander un résumé de ce que vous avez vu sur une scène afin de développer vos compétences en investigation de terrain. Vous pourrez aussi observer des autopsies et suivre l'ensemble de leur déroulement, avec des occasions de vous exercer vous-même ; bien sûr, vous vous entraînerez sur des animaux comme des porcs et non sur de véritables cadavres humains.`,
        competence1: `Un estomac solide et la capacité de bien fonctionner sous un stress extrême.`,
        competence2: `Avoir au moins dix-huit (18) ans et posséder une adresse légale dans l'État de San Andreas.\nUne bonne aptitude à travailler en équipe et à suivre les directives.`,
        competence3: `Ne pas avoir été condamné(e) pour un crime ou un délit récent.`,
        diplome: `Être inscrit(e) dans un collège ou une université dont l'accréditation est reconnue aux États-Unis d'Amérique.`,
    },
    'Medical Examiner': {
        nom: 'Médecin Légiste', cle: 'Médecin Légiste', role: 'Médecin Légiste',
        presentation: `Les médecins légistes (« medical examiners »), également appelés pathologistes médico-légaux, sont des médecins spécialistes formés à la pathologie médico-légale et anatomique. Ils utilisent leurs compétences médicales pour déterminer la cause du décès, qu'elle soit naturelle, accidentelle ou intentionnelle. Ils peuvent également être amenés à témoigner dans des affaires judiciaires où leurs compétences ont été utilisées. En outre, ils peuvent recueillir et examiner des éléments de preuve pour déterminer la cause du décès dans des affaires criminelles et des décès non naturels ou non surveillés. Ils peuvent aussi être présents sur les lieux du décès pour s'assurer que les éléments de preuve recueillis sont transportés en toute sécurité vers le laboratoire pour analyse. Il revient au médecin légiste d'obtenir les dossiers médicaux auprès des hôpitaux et des cabinets pour évaluation. Une fois leur enquête terminée, les médecins légistes résument leurs conclusions par écrit et les présentent oralement. Ils peuvent intervenir en tant qu'experts et témoigner lors d'audiences préliminaires et de procès. Les responsabilités d'un médecin légiste adjoint seront de réaliser des autopsies pour déterminer la cause du décès, d'entreprendre l'examen de prélèvements, de tissus, d'organes, de fluides et de sang pour déterminer les anomalies ayant pu entraîner le décès, d'enquêter sur les décès soudains et/ou non naturels en lien avec les forces de l'ordre, tout en rédigeant des rapports de conclusions et en fournissant des témoignages d'expert devant les tribunaux. Tout au long de leur exercice, ils restent informés des évolutions de la pathologie médico-légale et suivent des séminaires ainsi que des cours de médecine légale dans le cadre de la formation continue et de la recherche.`,
        competence1: `Connaissance pratique des lois et règlements applicables aux services médico-légaux.`,
        competence2: `Exceptionnelles capacités d'analyse et de recherche.`,
        competence3: `Expérience de l'utilisation d'équipements de tests de laboratoire.\nExcellentes compétences de communication et de rédaction.`,
        diplome: `Doit être titulaire d'un Bachelor's degree en biologie, en sciences physiques ou dans un domaine connexe\nDiplôme de médecine (doctorat) et certificat USMLE.`,
    },
    'Coroner Investigator': {
        nom: 'Enquêteur(trice) Médico-Légal(e)', cle: 'Enquêteur(trice) Médico-Légal(e)', role: 'Enquêteur(trice) Médico-Légal(e)',
        presentation: `Les enquêteurs médico-légaux enquêtent et établissent des rapports sur les décès relevant de la compétence du Los Santos Department of Medical Examiner-Coroner. Les titulaires de ce poste prennent en charge la scène du décès et le corps de la personne décédée, protègent les effets personnels du défunt, localisent et préviennent les proches et accomplissent les autres missions requises. En plus d'examiner les corps et les scènes de crime, ce rôle vise à accomplir diverses tâches administratives, à tenir des registres précis des constatations et à présenter ces constatations devant un tribunal si nécessaire. Ce poste exige d'excellentes compétences de communication et de rédaction. De plus, lorsqu'une personne est responsable d'une équipe de la morgue, elle peut également superviser le travail des assistants de morgue ou des techniciens d'autopsie. Les responsabilités d'un enquêteur médico-légal vont de l'investigation des décès relevant de la compétence du département à l'aide à l'établissement de la cause, de la manière et des circonstances du décès, en passant par la concertation avec les forces de l'ordre pour coordonner les enquêtes sur les décès résultant d'actes criminels et l'identification formelle des défunts par la prise d'empreintes digitales et de photographies afin de constituer des dossiers. Un enquêteur médico-légal peut informer la famille du défunt, interroger des témoins, des médecins, des forces de l'ordre et des membres de la famille pour obtenir les faits concernant les décès. Il est responsable du transport des corps et peut travailler sur des projets spéciaux qui lui sont confiés, tout en remplissant les certificats de décès et en décidant du moment où un défunt peut être libéré.`,
        competence1: `Connaissance pratique des lois et règlements applicables aux services médico-légaux.`,
        competence2: `Exceptionnelles capacités d'analyse et de recherche.`,
        competence3: `Expérience de l'utilisation d'équipements de tests de laboratoire.\nExcellentes compétences de communication et de rédaction.`,
        diplome: `Doit être titulaire d'un Bachelor's degree en biologie, en sciences physiques ou dans un domaine connexe.`,
    },
    'Trainee Forensic Attendant': {
        nom: 'Stagiaire Médico-Légal(e)', cle: 'Stagiaire Médico-Légal(e)', role: 'Stagiaire Médico-Légal(e)',
        presentation: `Les nouveaux candidats suivront une formation dispensée par notre établissement pour devenir Coroner ; en tant que nouvelle recrue, votre mission principale est de terminer le programme de formation de terrain et de devenir un(e) Coroner pleinement qualifié(e). Vous aurez les mêmes missions qu'un Coroner, mais vous n'aurez pas le droit de recevoir des appels seul(e) tant que vous n'aurez pas terminé votre phase de formation de terrain. Les nouvelles recrues deviendront l'épine dorsale de tout le département, formant le plus fort pourcentage de ses membres. Sans les nouvelles recrues, les missions quotidiennes deviendront difficiles : le département a besoin de nouvelles recrues pour se maintenir. Les nouvelles recrues sont encouragées à se consacrer au département et seront probablement le principal point de contact avec le public au quotidien, car elles traiteront les appels les plus courants. En tant que Stagiaire Médico-Légal employé(e) au Pillbox Hill Medical Center, vous serez formé(e) à la réponse sur le terrain aux appels entrants, où vous serez utile au public, aux autres départements et, surtout, à vos propres collègues.`,
        competence1: `Un haut niveau de maîtrise de l'écrit est requis, ainsi que la capacité de rédiger à temps des courriers à destination des départements voisins.`,
        competence2: `La capacité de travailler dans un environnement stressant et d'agir de manière appropriée est indispensable.`,
        competence3: `Le ou la candidat(e) doit être en bonne condition physique pour répondre à des exigences telles que déplacer et soulever des corps, avec une mobilité complète du corps, une dextérité manuelle des doigts et une bonne coordination œil-main.`,
        diplome: `Les candidat(e)s doivent posséder au minimum un diplôme de fin d'études secondaires (high school diploma)\nDoit avoir un état de santé physique et mental satisfaisant pour exercer les fonctions essentielles du poste en toute sécurité.`,
    },
};
