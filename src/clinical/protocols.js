// src/clinical/protocols.js
//
// Outil « Pilou » de la Boîte à outils : on saisit un cas (âge, sexe, poids, taille, motifs, précisions sur les blessures) et Pilou propose la prise en charge COMPLÈTE, sous la forme d'un PARCOURS
// étape par étape (pathways.js) : premier regard, gestes immédiats, examen et bilan, traitement avec les médicaments dosés, surveillance, orientation. Il s'appuie sur le même moteur que l'assistant
// des formulaires (engine.js, conditions.js) ; ce fichier ajoute, pour chaque motif, le MATÉRIEL, la SURVEILLANCE et des mots de symptômes pour retrouver le motif d'après un texte libre. Pur.
//
// À TENIR À JOUR : tout nouveau motif de conditions.js doit avoir son entrée dans PROTOCOLS (un test le vérifie).
import { CONDITIONS, CONDITION_BY_ID } from './conditions';
import { MEDICATION_BY_ID } from './medications';
import { buildSuggestions, patientFromForm, checkPrescription, entryText, prescriptionText, isPediatric, formatNumber } from './engine';
import { vitalsFromForm, vitalsFormFields } from './vitals';
import { bmiOf, bmiCategory } from './bodyLimits';
import { injuryLines, mutilationLabels } from './injuries';
import { injuryCareNotes, sanitizeInjuryDetails } from './injuryCare';
import { buildTimeline, flatSteps } from './pathways';
import { examKeyOfImaging } from './context';
import { translateResultValue } from '../constants/clinicalOptions';

// equipment : matériel à préparer · monitoring : surveillance et signes d'alerte · symptoms : mots du langage courant.
// Les GESTES, étape par étape, sont dans pathwaysTrauma.js et pathwaysMedical.js (parcours détaillé : gestes immédiats, examen et bilan, traitement).
const p = (equipment, monitoring, symptoms = '') => ({ equipment, monitoring, symptoms });

export const PROTOCOLS = {
    // ── Traumatologie ──
    plaie_superficielle: p(
        ['Gants stériles', 'Sérum physiologique et seringue de lavage', 'Compresses stériles', 'Anesthésique local et aiguilles', 'Kit de suture, colle cutanée ou strips', 'Pansement', 'Vaccin antitétanique'],
        ['Contrôle de la plaie à 48 h', 'Signes d\'infection : rougeur qui s\'étend, chaleur, pus, fièvre'], 'coupure saignement égratignure entaille'),
    plaie_profonde: p(
        ['Gants stériles et champ stérile', 'Compresses hémostatiques et bandes compressives', 'Garrot tactique', 'Sérum physiologique en grande quantité', 'Kit de suture par plans, anesthésique local', 'Radiographie', 'Voie veineuse et antibiotique'],
        ['Saignement à travers le pansement', 'Pouls, sensibilité et mobilité en aval', 'Tension et fréquence cardiaque toutes les 15 min'], 'plaie profonde déchirure morsure délabrement saigne beaucoup'),
    fracture_fermee: p(
        ['Attelle rigide ou écharpe', 'Bande de contention et coton de protection', 'Poche de glace', 'Antalgiques', 'Radiographie face et profil', 'Plâtre ou résine selon le cas'],
        ['Pouls et chaleur en aval', 'Douleur disproportionnée ou membre froid, pâle ou engourdi : urgence (syndrome des loges)'], 'os cassé fracture douleur membre impossible bouger gonflement déformation'),
    fracture_ouverte: p(
        ['Compresses stériles humides et pansement stérile', 'Garrot tactique', 'Attelle', 'Voie veineuse, perfusion', 'Antibiotique intraveineux et vaccin antitétanique', 'Antalgiques puissants', 'Radiographie, bloc opératoire'],
        ['Hémorragie et tension toutes les 10 min', 'Pouls et sensibilité en aval', 'Douleur incontrôlée ou membre froid : urgence chirurgicale'], 'os visible fracture ouverte exposé'),
    entorse_luxation: p(
        ['Poche de glace', 'Bande de contention ou orthèse', 'Attelle', 'Antalgiques et anti-inflammatoires', 'Radiographie', 'Sédation si réduction de luxation'],
        ['Pouls et sensibilité après réduction', 'Gonflement qui augmente ou perte de sensibilité : contrôle immédiat'], 'cheville foulure épaule déboîtée genou tordu articulation'),
    trauma_cranien: p(
        ['Collier cervical si mécanisme à risque', 'Lampe stylo pour les pupilles', 'Échelle de Glasgow', 'Scanner cérébral', 'Bassine (vomissements)', 'Glucomètre'],
        ['Somnolence, vomissements répétés, pupilles inégales, convulsions : urgence neurochirurgicale', 'Glasgow toutes les 15 min les premières heures'], 'coup à la tête commotion perte de connaissance vertige céphalée choc crâne'),
    brulure: p(
        ['Eau tempérée (15 à 20 °C)', 'Pansement gras stérile et compresses', 'Film alimentaire stérile ou pansement hydrocellulaire', 'Antalgiques', 'Perfusion et soluté de remplissage', 'Vaccin antitétanique', 'Table de calcul de la surface brûlée'],
        ['Température du patient (risque d\'hypothermie)', 'Diurèse et tension si grande surface', 'Brûlure du visage, des mains, des organes génitaux ou circulaire : centre spécialisé'], 'brûlure ébouillantement flamme feu cloque'),
    plaie_arme_feu: p(
        ['Garrot tactique et pansement hémostatique', 'Deux voies veineuses de gros calibre', 'Acide tranexamique, solutés de remplissage', 'Oxygène au masque', 'Ciseaux à vêtements, couverture de survie', 'Radiographie / scanner', 'Kit de bloc opératoire, antibiotique'],
        ['Tension et fréquence toutes les 5 à 10 min', 'Hémorragie occulte (thorax, abdomen, bassin)', 'Déclaration réglementaire de la plaie par arme à feu'], 'balle tir coup de feu projectile fusillade'),
    plaie_arme_blanche: p(
        ['Pansements compressifs, compresses stériles', 'Garrot si membre', 'Voie veineuse, solutés, antalgiques', 'Échographe (eFAST)', 'Kit de suture / bloc opératoire', 'Antibiotique, vaccin antitétanique'],
        ['Tension et fréquence toutes les 10 min', 'Essoufflement ou ventre dur : atteinte interne', 'Plaie qui saigne à nouveau'], 'couteau coup de couteau lame poignardé arme blanche'),
    trauma_thoracique: p(
        ['Oxygène au masque haute concentration', 'Aiguille d\'exsufflation ou kit de drainage thoracique', 'Échographe', 'Radiographie pulmonaire / scanner', 'Antalgiques', 'Oxymètre de pouls'],
        ['Saturation et fréquence respiratoire en continu', 'Aggravation brutale de la dyspnée, jugulaires gonflées : pneumothorax compressif'], 'côtes poumon thorax douleur respirer essoufflé pneumothorax'),
    trauma_abdominal: p(
        ['Deux voies veineuses', 'Solutés de remplissage', 'Échographe (eFAST)', 'Scanner abdominal', 'Antalgiques', 'Bilan sanguin et groupage', 'Sonde gastrique si besoin'],
        ['Tension et fréquence toutes les 10 à 15 min', 'Ventre qui se durcit, pâleur, malaise : hémorragie interne'], 'ventre coup ventre rate foie douleur abdominale choc'),
    polytraumatisme: p(
        ['Collier cervical et matelas coquille', 'Oxygène, matériel d\'intubation et d\'aspiration', 'Deux voies veineuses, acide tranexamique, solutés', 'Garrots tactiques', 'Couverture de survie', 'Échographe (eFAST), scanner corps entier', 'Monitorage multiparamétrique'],
        ['Monitorage continu', 'Triade létale : hypothermie, acidose, trouble de la coagulation (réchauffer)', 'Glasgow et pupilles répétés'], 'accident de la route grave choc multiples traumatismes chute de haut'),
    hemorragie_externe: p(
        ['Compresses et bandes compressives', 'Garrot tactique', 'Pansement hémostatique', 'Voie veineuse, solutés, acide tranexamique', 'Bilan sanguin et groupage'],
        ['Tension et fréquence toutes les 10 min', 'Garrot : ne pas le desserrer sans avis médical'], 'saignement hémorragie sang garrot saigne abondamment'),

    // ── Cardiologie ──
    sca: p(
        ['Électrocardiogramme 12 dérivations', 'Monitorage cardiaque, défibrillateur à proximité', 'Voie veineuse', 'Oxygène (si saturation basse)', 'Aspirine, dérivé nitré, antalgique', 'Bilan sanguin (troponine)'],
        ['Rythme et tension en continu', 'Douleur persistante, malaise, troubles du rythme : défibrillateur prêt'], 'douleur thoracique oppression poitrine bras gauche mâchoire sueurs infarctus'),
    arret_cardiaque: p(
        ['Défibrillateur', 'Planche à masser, ballon et masque, canule', 'Matériel d\'intubation, aspiration', 'Adrénaline', 'Voie veineuse ou intra-osseuse', 'Monitorage'],
        ['Rythme toutes les 2 minutes', 'Reprise d\'activité circulatoire : surveillance post-arrêt, température'], 'plus de pouls ne respire plus inconscient arrêt cardiaque'),
    crise_hypertensive: p(
        ['Tensiomètre, brassard adapté', 'ECG', 'Voie veineuse', 'Antihypertenseur', 'Bilan sanguin et urinaire'],
        ['Tension toutes les 15 min', 'Céphalée intense, trouble de la vue, faiblesse d\'un côté : orientation AVC'], 'tension élevée hypertension céphalée bourdonnements'),
    tachyarythmie: p(
        ['ECG 12 dérivations', 'Monitorage, défibrillateur', 'Voie veineuse', 'Antiarythmique', 'Bilan sanguin (ionogramme, thyroïde)'],
        ['Rythme en continu', 'Hypotension, douleur thoracique, malaise : instabilité, choc électrique'], 'palpitations cœur qui bat vite tachycardie'),
    bradycardie: p(
        ['ECG 12 dérivations', 'Monitorage, défibrillateur / stimulation externe', 'Voie veineuse', 'Atropine', 'Bilan sanguin'],
        ['Fréquence et tension en continu', 'Syncope ou hypotension : stimulation'], 'pouls lent bradycardie malaise fatigue'),
    oap: p(
        ['Oxygène, ventilation non invasive si disponible', 'Voie veineuse', 'Diurétique, dérivé nitré', 'ECG, radiographie ou échographie pulmonaire', 'Sonde urinaire'],
        ['Saturation, fréquence respiratoire et tension en continu', 'Fatigue respiratoire, confusion : intubation'], 'essoufflé crépitants mousse rose oedème du poumon noyé orthopnée'),
    syncope: p(
        ['ECG, monitorage', 'Glucomètre', 'Tensiomètre (couché / debout)', 'Voie veineuse', 'Bilan sanguin'],
        ['Rythme sur monitor pendant l\'observation', 'Syncope à l\'effort, douleur thoracique ou ECG anormal : cardiologie'], 'malaise évanouissement perte de connaissance tombé vertige'),
    anaphylaxie: p(
        ['Adrénaline en ampoule ou stylo auto-injecteur', 'Oxygène, voie veineuse, solutés de remplissage', 'Antihistaminique et corticoïde', 'Bronchodilatateur', 'Monitorage', 'Matériel d\'intubation'],
        ['Surveillance prolongée au moins 6 heures (rechute possible)', 'Tension, saturation, gonflement du visage et de la gorge'], 'allergie gonflement visage gorge urticaire choc piqûre arachide difficulté respirer'),
    allergie_legere: p(
        ['Antihistaminique', 'Corticoïde si besoin', 'Crème apaisante', 'Oxymètre de pouls'],
        ['Surveillance 1 à 2 heures', 'Gonflement de la langue ou du visage, gêne respiratoire : traiter comme une anaphylaxie'], 'urticaire démangeaisons plaques rougeurs allergie'),

    // ── Respiratoire ──
    asthme: p(
        ['Bronchodilatateur en nébulisation ou chambre d\'inhalation', 'Oxygène', 'Corticoïde', 'Débitmètre de pointe', 'Oxymètre', 'Voie veineuse si grave'],
        ['Saturation et fréquence respiratoire', 'Silence auscultatoire, épuisement, difficulté à parler : détresse vitale'], 'sifflement asthme essoufflement toux sifflante crise d\'asthme'),
    pneumopathie: p(
        ['Radiographie pulmonaire', 'Oxymètre, thermomètre', 'Prélèvements (bilan sanguin)', 'Oxygène si besoin', 'Antibiotique', 'Antalgiques et antipyrétiques'],
        ['Saturation et température', 'Aggravation de l\'essoufflement ou confusion : hospitalisation'], 'toux fièvre crachats pneumonie bronchite poitrine encombrée'),
    detresse_respiratoire: p(
        ['Oxygène haut débit', 'Ballon et masque, aspiration', 'Matériel d\'intubation', 'Bronchodilatateur', 'Voie veineuse', 'Oxymètre, monitorage'],
        ['Saturation, fréquence respiratoire et conscience en continu', 'Cyanose, tirage, pauses respiratoires : urgence vitale'], 'étouffe ne peut plus respirer détresse respiratoire bleu tirage'),
    noyade: p(
        ['Oxygène, ballon et masque', 'Défibrillateur', 'Couvertures chauffantes', 'Aspiration', 'Voie veineuse', 'Radiographie pulmonaire'],
        ['Surveillance minimale de 6 à 24 h (détresse respiratoire retardée)', 'Température, saturation'], 'noyé noyade eau inhalé piscine mer'),

    // ── Neurologie ──
    convulsions: p(
        ['Benzodiazépine injectable ou rectale', 'Glucomètre', 'Oxygène, aspiration', 'Voie veineuse', 'Coussin de protection'],
        ['Conscience et respiration après la crise', 'Crise prolongée ou répétée : état de mal convulsif'], 'crise épilepsie convulsions tremblements secousses mousse'),
    avc: p(
        ['Scanner cérébral (ou IRM)', 'Échelle de déficit (FAST / NIHSS)', 'Glucomètre', 'Voie veineuse, ECG', 'Bilan sanguin et coagulation', 'Monitorage'],
        ['Déficit neurologique et conscience toutes les 15 min', 'Tension : ne pas l\'abaisser brutalement'], 'visage paralysé bras faible parole difficile bouche de travers AVC'),
    migraine: p(
        ['Antalgiques, antiémétique', 'Chambre au calme et sombre', 'Glucomètre, tensiomètre'],
        ['Céphalée « en coup de tonnerre », fièvre avec nuque raide ou déficit : scanner en urgence'], 'mal de tête céphalée migraine nausée lumière'),
    coma: p(
        ['Glucomètre', 'Oxygène, aspiration, canule', 'Matériel d\'intubation', 'Voie veineuse, ECG', 'Antidotes (naloxone, glucose)', 'Scanner'],
        ['Glasgow et pupilles toutes les 15 min', 'Aggravation de la conscience : intubation'], 'inconscient ne répond plus coma somnolent confus'),

    // ── Intoxications ──
    surdose_opioides: p(
        ['Naloxone (ampoules / spray)', 'Ballon et masque, oxygène', 'Voie veineuse', 'Monitorage', 'Glucomètre'],
        ['Surveillance prolongée : la naloxone dure moins longtemps que l\'opioïde (rechute)', 'Fréquence respiratoire en continu'], 'overdose opioïde héroïne fentanyl respire lentement pupilles minuscules'),
    surdose_benzo: p(
        ['Oxygène, ballon et masque', 'Monitorage', 'Voie veineuse', 'Charbon actif selon le délai', 'Glucomètre'],
        ['Fréquence respiratoire et Glasgow en continu', 'Prise volontaire : évaluation psychiatrique'], 'somnolent sédatifs somnifères benzodiazépines trop pris'),
    surdose_stimulants: p(
        ['Monitorage, ECG', 'Benzodiazépine', 'Voie veineuse, solutés', 'Thermomètre', 'Glucomètre'],
        ['Température, fréquence et tension en continu', 'Douleur thoracique, convulsions, hyperthermie : réanimation'], 'cocaïne amphétamine ecstasy agité tachycardie transpire stimulant'),
    intox_alcool: p(
        ['Glucomètre, éthylomètre', 'Voie veineuse, solutés (glucose, vitamine B1)', 'Oxygène', 'Couverture', 'Bassine'],
        ['Glasgow et respiration', 'Vomissements, somnolence profonde : risque d\'inhalation'], 'ivre alcool saoul éthylique vomit'),
    intox_paracetamol: p(
        ['Voie veineuse', 'Bilan sanguin (paracétamolémie, foie)', 'Antidote (N-acétylcystéine)', 'Charbon actif selon le délai'],
        ['Surveillance hépatique sur 24 à 72 h', 'Nausées tardives, douleur à droite : atteinte du foie'], 'paracétamol doliprane trop pris comprimés intoxication médicament'),
    intox_fumees: p(
        ['Oxygène 100 % au masque haute concentration', 'Oxymètre (attention : faussé par le CO)', 'ECG, bilan sanguin (carboxyhémoglobine)', 'Chambre hyperbare si disponible'],
        ['Maux de tête, vertiges, confusion : signes de CO', 'Stridor, voix éraillée : risque d\'œdème des voies aériennes, intubation précoce'], 'fumées incendie monoxyde de carbone CO suie intoxication gaz'),
    agitation: p(
        ['Pièce calme et sécurisée', 'Benzodiazépine', 'Glucomètre', 'Matériel de contention (dernier recours)', 'Monitorage'],
        ['Surveillance rapprochée de la conscience et de la respiration après sédation', 'Sécurité du soignant'], 'agité violent hurle crise de nerfs délire agressif'),

    // ── Métabolique et divers ──
    hypoglycemie: p(
        ['Glucomètre', 'Sucre (resucrage per os) ou glucose à 30 %', 'Glucagon', 'Voie veineuse'],
        ['Glycémie toutes les 15 min jusqu\'à stabilité', 'Cause : insuline, alcool, jeûne, sulfamides'], 'hypoglycémie sueurs tremblements faim diabète insuline malaise sucre'),
    acidocetose: p(
        ['Glucomètre, bandelettes urinaires (cétones)', 'Voie veineuse, solutés', 'Insuline', 'Potassium, ionogramme', 'ECG, monitorage'],
        ['Glycémie horaire, kaliémie', 'Respiration profonde et haleine d\'acétone : acidose'], 'diabète glycémie élevée soif urines nombreuses haleine acétone'),
    deshydratation: p(
        ['Soluté de réhydratation orale', 'Perfusion de sérum', 'Antiémétique', 'Bilan sanguin', 'Thermomètre, balance'],
        ['Diurèse et poids (surtout chez l\'enfant)', 'Sang dans les selles, fièvre élevée, vomissements incoercibles : réévaluation'], 'diarrhée vomissements gastro déshydraté ventre qui coule nausées'),
    sepsis: p(
        ['Thermomètre, monitorage', 'Deux voies veineuses, solutés', 'Hémocultures et bilan sanguin (lactates)', 'Antibiotique à large spectre', 'Oxygène', 'Sonde urinaire'],
        ['Tension, saturation, diurèse horaires', 'Hypotension, marbrures, confusion : choc septique, réanimation'], 'fièvre frissons infection fièvre élevée confus sepsis'),
    douleur_abdominale: p(
        ['Antalgiques, antispasmodique', 'Échographe, bilan sanguin', 'Voie veineuse', 'Bandelette urinaire (test de grossesse)', 'Scanner'],
        ['Défense, fièvre, vomissements persistants : avis chirurgical', 'Réévaluation clinique répétée'], 'mal au ventre douleur abdominale appendicite vomissements ventre dur'),
    colique_nephretique: p(
        ['Anti-inflammatoire et antalgiques', 'Bandelette urinaire', 'Échographie / scanner', 'Voie veineuse', 'Passoire à urine'],
        ['Fièvre ou douleur résistante : drainage en urgence', 'Hydratation modérée, tamisage des urines'], 'douleur flanc dos lombaire calcul rein urines sang colique'),
    hypothermie: p(
        ['Couvertures chauffantes, couverture de survie', 'Solutés réchauffés', 'Thermomètre basse température', 'Monitorage ECG', 'Défibrillateur'],
        ['Température centrale et rythme cardiaque en continu', 'Pas de réanimation abandonnée tant que le patient n\'est pas réchauffé'], 'froid hypothermie gelé grelotte température basse'),
    coup_chaleur: p(
        ['Eau froide, ventilateur, packs de glace', 'Thermomètre', 'Voie veineuse, solutés', 'Glucomètre', 'Monitorage'],
        ['Température toutes les 5 min jusqu\'à 38,5 °C', 'Confusion, convulsions, température > 40 °C : urgence vitale'], 'chaleur insolation coup de chaleur fièvre soleil confus température élevée'),
};

const ROUTINE_LABELS = {
    Tetanus: 'Mise à jour de la vaccination antitétanique', Dressing: 'Pansement', Analgesia: 'Antalgie', Immobilisation: 'Immobilisation', Antibiotic: 'Antibiothérapie',
    Infusion: 'Perfusion / remplissage', Oxygen: 'Oxygénothérapie',
};
const IMAGING_LABELS = { XRay: 'Radiographie', CTScan: 'Scanner', MRI: 'IRM', Ultrasound: 'Échographie', Other: 'Autre examen' };
const DESTINATION_LABELS = { Home: 'Retour à domicile avec consignes', Ward: 'Hospitalisation en service', OperatingRoom: 'Bloc opératoire', Icu: 'Réanimation / soins intensifs' };
const SEX_LABELS = { Male: 'Homme', Female: 'Femme' };

// ───────────── Retrouver les motifs d'après des symptômes écrits ─────────────
const normalize = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['avec', 'dans', 'pour', 'depuis', 'sans', 'tres', 'plus', 'cette', 'chez', 'mais', 'elle', 'ils', 'une', 'des', 'les', 'qui', 'que', 'sur', 'par', 'aux', 'son', 'ses', 'est', 'pas', 'fait', 'avoir', 'patient', 'patiente', 'douleur']);
const SEARCH_INDEX = CONDITIONS.map((condition) => {
    const strong = normalize([condition.label, ...(condition.aliases || []), PROTOCOLS[condition.id]?.symptoms].join(' '));
    const weak = normalize([condition.complaint, condition.diagnosis, condition.mechanism].join(' '));
    return { id: condition.id, strong: ` ${strong} `, weak: ` ${weak} ` };
});
const stemOf = (token) => (token.length > 7 ? token.slice(0, token.length - 2) : token.length > 5 ? token.slice(0, token.length - 1) : token);

/** Motifs probables d'après un texte libre : [{ id, label, score }] du plus probable au moins probable (vide si rien ne correspond). */
export const matchConditions = (text, limit = 6) => {
    const raw = normalize(text);
    const tokens = [...new Set(raw.split(' ').filter((token) => token.length >= 4 && !STOP.has(token)))];
    // Expressions entières (« mal de tête », « douleur thoracique ») : un point de plus quand elles figurent dans les mots-clés.
    const phrases = raw.split(' ').length > 1 ? [raw] : [];
    if (!tokens.length) return [];
    return SEARCH_INDEX.map((entry) => {
        let score = 0;
        tokens.forEach((token) => {
            const stem = stemOf(token);
            if (entry.strong.includes(` ${stem}`) || entry.strong.includes(stem)) score += 3;
            else if (entry.weak.includes(stem)) score += 1;
        });
        phrases.forEach((phrase) => { if (entry.strong.includes(phrase)) score += 4; });
        return { id: entry.id, label: CONDITION_BY_ID[entry.id].label, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'fr')).slice(0, limit);
};

// ───────────── Le cas complet ─────────────
const age = (patient) => (Number.isFinite(patient.ageYears) ? patient.ageYears : null);

/** Adaptations selon le patient : enfant, nourrisson, personne âgée, poids estimé, genre. */
export const patientAdaptations = (patient) => {
    const notes = [];
    const years = age(patient);
    if (years !== null && years < 1) notes.push('Nourrisson : matériel de taille nourrisson (masque, canule, brassard), doses strictement au poids, hypoglycémie et hypothermie rapides, appel du pédiatre.');
    else if (isPediatric(patient)) notes.push('Enfant de moins de 15 ans : matériel pédiatrique (masque, canule, brassard, aiguilles), doses calculées au poids, constantes selon l\'âge, présence rassurante d\'un parent.');
    if (years !== null && years >= 75) notes.push('Patient âgé : risque de confusion, de chute et d\'insuffisance rénale ; doses prudentes, vérifier les traitements habituels (anticoagulants notamment).');
    if (patient.sex === 'Female' && years !== null && years >= 12 && years <= 50) notes.push('Femme en âge de procréer : penser à la grossesse (test) avant imagerie, antalgiques et médicaments à risque.');
    if (patient.weightKg === null || patient.weightKg === undefined) notes.push('Poids non renseigné : doses calculées sur un poids estimé d\'après l\'âge, à confirmer.');
    return notes;
};

/**
 * Prise en charge complète d'un cas.
 * input : { ageYears, sex, weightKg, heightCm, allergies, chronic, currentMeds, severity, conditionIds, injuryDetails, injuryMutilations, seed }
 *   injuryDetails / injuryMutilations : les « Précisions sur les blessures » des formulaires (injuries.js), limitées aux choix des listes.
 * → null si aucun motif ; sinon { patient, severity, conditions: [{ id, label, steps, equipment, monitoring }], vitals, meds: [{ text, forLabel, level, alerts }], skipped, prescription, exams,
 *   expectedResults, routineCare, destination, advice, notices, adaptations, injuries, mutilations, injuryCare, timeline }
 *   timeline : le parcours complet, étape par étape (pathways.js), sur lequel se fait le suivi.
 */
export const buildCase = (input = {}) => {
    const ids = (input.conditionIds || []).filter((id) => CONDITION_BY_ID[id]);
    if (!ids.length) return null;
    const patient = patientFromForm({
        patientAgeYears: input.ageYears, patientSex: input.sex, patientWeight: input.weightKg, patientHeight: input.heightCm,
        patientAllergies: input.allergies, patientChronicDiseases: input.chronic, patientCurrentMedicine: input.currentMeds,
    });
    // Précisions sur les blessures : mêmes données que dans les formulaires, mais seuls les choix des listes sont gardés (Pilou n'interprète pas le texte libre).
    const injuryForm = {
        clinicalConditions: ids,
        injuryDetails: sanitizeInjuryDetails(input.injuryDetails, ids),
        injuryMutilations: (Array.isArray(input.injuryMutilations) ? input.injuryMutilations : []).filter((code) => typeof code === 'string'),
    };
    const suggestions = buildSuggestions({ conditionIds: ids, severity: input.severity || 'Moderate', patient, seed: input.seed || 'pilou', formData: injuryForm });
    if (!suggestions) return null;
    const checkCtx = { patient, vitals: vitalsFromForm(vitalsFormFields(suggestions.vitals.values)), tags: new Set(suggestions.conditions.flatMap((c) => c.tags || [])) };
    const labelOf = (id) => CONDITION_BY_ID[id]?.label || '';
    const medLine = (entry, text) => {
        const result = checkPrescription(entry, checkCtx);
        return { medId: entry.medId, name: MEDICATION_BY_ID[entry.medId]?.name || entry.medId, text, forCondition: entry.forCondition || '', forLabel: labelOf(entry.forCondition), level: result.level, alerts: result.messages.filter((m) => m.level !== 'ok').map((m) => m.text) };
    };
    const bmi = bmiOf(patient.weightKg, patient.heightCm);
    const bmiInfo = bmiCategory(bmi, patient.ageYears);
    // Résultats d'examens les plus probables (pour jouer la scène) : ceux des imageries proposées, et la biologie.
    const resultKeys = [...suggestions.imaging.map((type) => [IMAGING_LABELS[type] || type, examKeyOfImaging[type]]), ['Biologie', 'lab']];
    const expectedResults = resultKeys.filter(([, key]) => key && (suggestions.exams[key] || []).length).map(([label, key]) => `${label} : ${suggestions.exams[key].map(translateResultValue).join(', ')}`);
    const caseData = {
        patient: { ...patient, bmi, bmiLabel: bmiInfo ? bmiInfo.label : '', bmiLevel: bmiInfo ? bmiInfo.level : '' },
        severity: suggestions.severity,
        conditions: suggestions.conditions.map((condition) => ({
            id: condition.id, label: condition.label, group: condition.group, steps: condition.steps || [],
            equipment: PROTOCOLS[condition.id]?.equipment || [], monitoring: PROTOCOLS[condition.id]?.monitoring || [],
        })),
        injuries: injuryLines(injuryForm),
        mutilations: mutilationLabels(injuryForm),
        injuryCare: injuryCareNotes(injuryForm),
        expectedResults,
        vitals: suggestions.vitals.values,
        meds: suggestions.meds.map((entry) => ({ ...medLine(entry, entryText(entry)), regimenId: entry.regimenId })),
        prescription: suggestions.prescription.map((entry) => medLine(entry, prescriptionText(entry))),
        skipped: suggestions.skipped.map((item) => ({ name: MEDICATION_BY_ID[item.medId]?.name || item.medId, reasons: item.reasons || [] })),
        exams: [...suggestions.imaging.map((key) => IMAGING_LABELS[key] || key)],
        routineCare: suggestions.routineCare.map((key) => ROUTINE_LABELS[key] || key),
        destination: DESTINATION_LABELS[suggestions.destination] || suggestions.destination,
        destinationKey: suggestions.destination,
        advice: suggestions.text.advice,
        notices: suggestions.notices,
        adaptations: patientAdaptations(patient),
        sexLabel: SEX_LABELS[patient.sex] || '',
        admission: suggestions.admission === 'Yes',
    };
    return { ...caseData, timeline: buildTimeline(caseData) };
};

/** Ligne « patient » d'un cas : « 45 ans · Homme · 80 kg · 178 cm · IMC 25,2 (surpoids) ». */
export const patientLine = (caseData, separator = ' · ') => {
    const p0 = caseData.patient;
    return [
        p0.ageYears !== null && p0.ageYears !== undefined ? (p0.ageYears < 1 ? 'nourrisson' : `${p0.ageYears} an${p0.ageYears > 1 ? 's' : ''}`) : 'âge non renseigné',
        caseData.sexLabel, p0.weightKg ? `${formatNumber(p0.weightKg)} kg` : 'poids estimé', p0.heightCm ? `${p0.heightCm} cm` : '',
        p0.bmi ? `IMC ${String(p0.bmi).replace('.', ',')} (${p0.bmiLabel})` : '',
    ].filter(Boolean).join(separator);
};

/** Avancement d'un suivi : { total, done, percent, next } — next : première étape non faite (null si tout est fait). */
export const progressOf = (timeline, doneIds = []) => {
    const steps = flatSteps(timeline);
    const done = new Set(doneIds);
    const count = steps.filter((step) => done.has(step.id)).length;
    return { total: steps.length, done: count, percent: steps.length ? Math.round((count / steps.length) * 100) : 0, next: steps.find((step) => !done.has(step.id)) || null };
};

const bullet = (items) => items.map((item) => `• ${item}`).join('\n');
/** Texte brut de la prise en charge (à coller dans un message ou un rapport). doneIds : étapes déjà faites du suivi (elles sont alors cochées). */
export const caseToText = (caseData, doneIds = []) => {
    if (!caseData) return '';
    const head = [
        `PILOU — ${caseData.conditions.map((c) => c.label).join(' + ')}`,
        `Patient : ${patientLine(caseData, ', ')} — gravité ${caseData.severity.label.toLowerCase()}`,
        `Constantes attendues : FC ${caseData.vitals.hr}/min, PA ${caseData.vitals.sbp}/${caseData.vitals.dbp}, FR ${caseData.vitals.rr}/min, SpO2 ${caseData.vitals.spo2} %, T° ${String(caseData.vitals.temp).replace('.', ',')} °C, glycémie ${String(caseData.vitals.glu).replace('.', ',')} g/L, Glasgow ${caseData.vitals.gcs}`,
    ].join('\n');
    const injuries = caseData.injuries.length || caseData.mutilations.length
        ? `LÉSIONS\n${bullet([...caseData.injuries, ...(caseData.mutilations.length ? [`Mutilation(s) : ${caseData.mutilations.join(', ')}`] : [])])}` : '';
    // Le parcours, temps par temps ; `doneIds` (facultatif) coche les étapes déjà faites.
    const done = new Set(doneIds);
    let number = 0;
    const phases = caseData.timeline.map((phase) => [
        phase.label.toUpperCase(),
        ...phase.steps.map((step) => {
            number += 1;
            const mark = doneIds.length ? (done.has(step.id) ? '[x] ' : '[ ] ') : '';
            const headLine = `${mark}${number}. ${step.title}${step.tag ? ` (${step.tag})` : ''}${step.detail ? ` : ${step.detail}` : ''}`;
            return step.points.length ? `${headLine}\n${step.points.map((point) => `   • ${point}`).join('\n')}` : headLine;
        }),
    ].join('\n'));
    const end = 'Aide à la décision pour le jeu de rôle : le soignant reste responsable de ses choix.';
    return [head, injuries, ...phases, end].filter(Boolean).join('\n\n');
};
