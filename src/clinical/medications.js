// src/clinical/medications.js
//
// Référentiel des médicaments de l'assistant clinique (premier lot : urgences). Données pures, relues avant mise en ligne, utilisées par le moteur (clinical/engine.js).
//
// Un médicament = une ou plusieurs « voies / schémas » (regimens). Pour chacun :
//  - adult  : [min, usuelle, max] d'une prise (ou `choices` : liste de valeurs proposées) ;
//  - perKg  : [min, usuelle, max] par kg, pour l'enfant (< 15 ans) — ou pour tous si `weightBased` ;
//  - byAge  : paliers d'âge à doses fixes pour l'enfant ([{ upToYears, choices, usual }]) ;
//  - maxSingle : plafond absolu d'une prise (tous âges) ;
//  - intervalHours / maxDaily / maxDailyPerKg : cadence et plafond sur 24 h ;
//  - titration : prises répétées jusqu'à l'effet (pas de plafond sur 24 h) ;
//  - minAgeYears / minAgeMonths : âge minimal (sans palier enfant, le schéma est réservé à l'adulte, soit 15 ans) ;
//  - note : consigne affichée avec la dose.
// Les allergies, antécédents et traitements du patient sont comparés (mots entiers, sans accents) aux listes `allergy`, `contra` et `interacts`.

const R = (id, route, unit, rest) => ({ id, route, unit, ...rest });
const med = (id, name, family, rest) => ({ id, name, family, brands: [], allergy: [], contra: [], interacts: [], avoidTags: {}, ...rest });

// Familles regroupées pour les alertes de doublon et d'allergie croisée.
const OPIOID_ALLERGY = ['opioïde', 'opioïdes', 'opiacé', 'opiacés', 'morphine', 'codéine', 'tramadol', 'fentanyl', 'oxycodone'];
const NSAID_ALLERGY = ['aine', 'ains', 'anti-inflammatoire', 'anti-inflammatoires', 'anti inflammatoire', 'ibuprofène', 'kétoprofène', 'aspirine', 'diclofénac', 'advil', 'nurofen', 'profénid'];
const PENICILLIN_ALLERGY = ['pénicilline', 'pénicillines', 'amoxicilline', 'ampicilline', 'bêta-lactamine', 'bêta-lactamines', 'augmentin', 'clamoxyl', 'oracilline'];
const CEPHALOSPORIN_ALLERGY = ['céphalosporine', 'céphalosporines', 'ceftriaxone', 'céfazoline', 'rocéphine'];
const ANTICOAGULANTS = ['warfarine', 'coumadine', 'préviscan', 'fluindione', 'rivaroxaban', 'xarelto', 'apixaban', 'eliquis', 'dabigatran', 'héparine', 'énoxaparine', 'lovenox', 'clopidogrel', 'plavix', 'anticoagulant', 'anticoagulants', 'antiagrégant', 'antiagrégants'];
const BENZODIAZEPINES = ['benzodiazépine', 'benzodiazépines', 'xanax', 'alprazolam', 'valium', 'diazépam', 'lexomil', 'bromazépam', 'lorazépam', 'temesta', 'tranxène', 'clonazépam', 'rivotril', 'midazolam'];
const SEROTONINERGIC = ['sertraline', 'zoloft', 'fluoxétine', 'prozac', 'paroxétine', 'citalopram', 'escitalopram', 'venlafaxine', 'duloxétine', 'isrs', 'imao', 'antidépresseur', 'antidépresseurs'];
const QT_DRUGS = ['amiodarone', 'cordarone', 'halopéridol', 'haldol', 'méthadone', 'ondansétron', 'azithromycine', 'ciprofloxacine', 'citalopram', 'escitalopram'];
const PDE5 = ['sildénafil', 'viagra', 'tadalafil', 'cialis', 'vardénafil', 'levitra'];
const BLEEDING_TAGS = { hemorragie: ['error', 'À éviter en cas d\'hémorragie.'] };

export const MEDICATIONS = [
    // ── Antalgiques et anti-inflammatoires ──
    med('paracetamol', 'Paracétamol', 'paracetamol', {
        category: 'Antalgique / antipyrétique', brands: ['Doliprane', 'Efferalgan', 'Dafalgan'],
        allergy: ['paracétamol', 'acétaminophène', 'doliprane', 'efferalgan', 'dafalgan', 'tylenol'],
        contra: [
            { terms: ['cirrhose', 'insuffisance hépatique', 'hépatite'], level: 'error', text: 'Insuffisance hépatique : paracétamol à éviter.' },
            { terms: ['alcoolisme', 'alcoolique'], level: 'warn', text: 'Alcoolisme chronique : réduire la dose (max 2 g/24 h).' },
        ],
        regimens: [
            R('po', 'PO', 'mg', { adult: [500, 1000, 1000], perKg: [10, 15, 15], maxSingle: 1000, intervalHours: 6, maxDaily: 4000, maxDailyPerKg: 60, note: 'Au moins 4 à 6 h entre deux prises.' }),
            R('iv', 'IV', 'mg', { adult: [500, 1000, 1000], perKg: [10, 15, 15], maxSingle: 1000, intervalHours: 6, maxDaily: 4000, maxDailyPerKg: 60, note: 'Perfusion de 15 minutes.' }),
        ],
    }),
    med('ibuprofene', 'Ibuprofène', 'aine', {
        category: 'Anti-inflammatoire (AINS)', brands: ['Advil', 'Nurofen'], allergy: NSAID_ALLERGY,
        contra: [
            { terms: ['ulcère', 'ulcère gastrique', 'reflux sévère'], level: 'error', text: 'Ulcère : AINS contre-indiqués.' },
            { terms: ['insuffisance rénale', 'insuffisance cardiaque'], level: 'error', text: 'Insuffisance rénale ou cardiaque : AINS contre-indiqués.' },
            { terms: ['asthme'], level: 'warn', text: 'Asthme : risque de crise déclenchée par les AINS.' },
            { terms: ['hémophilie', 'trouble de la coagulation'], level: 'error', text: 'Trouble de la coagulation : AINS contre-indiqués.' },
        ],
        interacts: [{ terms: ANTICOAGULANTS, level: 'error', text: 'Anticoagulant ou antiagrégant en cours : risque hémorragique majeur avec un AINS.' }],
        avoidTags: { ...BLEEDING_TAGS, choc: ['error', 'État de choc : AINS contre-indiqués (reins).'], traumatisme_cranien: ['warn', 'Traumatisme crânien : éviter les AINS (saignement) avant le scanner.'] },
        regimens: [R('po', 'PO', 'mg', { adult: [200, 400, 600], perKg: [5, 10, 10], maxSingle: 600, intervalHours: 8, maxDaily: 1200, maxDailyPerKg: 30, minAgeMonths: 3, note: 'À prendre pendant un repas.' })],
    }),
    med('ketoprofene', 'Kétoprofène', 'aine', {
        category: 'Anti-inflammatoire (AINS)', brands: ['Profénid', 'Bi-Profénid'], allergy: NSAID_ALLERGY,
        contra: [
            { terms: ['ulcère', 'ulcère gastrique'], level: 'error', text: 'Ulcère : AINS contre-indiqués.' },
            { terms: ['insuffisance rénale', 'insuffisance cardiaque'], level: 'error', text: 'Insuffisance rénale ou cardiaque : AINS contre-indiqués.' },
            { terms: ['asthme'], level: 'warn', text: 'Asthme : risque de crise déclenchée par les AINS.' },
            { terms: ['hémophilie', 'trouble de la coagulation'], level: 'error', text: 'Trouble de la coagulation : AINS contre-indiqués.' },
        ],
        interacts: [{ terms: ANTICOAGULANTS, level: 'error', text: 'Anticoagulant ou antiagrégant en cours : risque hémorragique majeur avec un AINS.' }],
        avoidTags: { ...BLEEDING_TAGS, choc: ['error', 'État de choc : AINS contre-indiqués (reins).'], traumatisme_cranien: ['warn', 'Traumatisme crânien : éviter les AINS (saignement) avant le scanner.'] },
        regimens: [
            R('iv', 'IV', 'mg', { adult: [50, 100, 100], maxSingle: 100, intervalHours: 8, maxDaily: 300, note: 'Perfusion de 20 minutes. Réservé à l\'adulte.' }),
            R('po', 'PO', 'mg', { adult: [50, 100, 100], maxSingle: 100, intervalHours: 8, maxDaily: 300, note: 'À prendre pendant un repas. Réservé à l\'adulte.' }),
        ],
    }),
    med('tramadol', 'Tramadol', 'opioide', {
        category: 'Antalgique opioïde (palier 2)', brands: ['Topalgic', 'Contramal'], allergy: OPIOID_ALLERGY,
        contra: [
            { terms: ['épilepsie', 'convulsions'], level: 'error', text: 'Épilepsie : le tramadol abaisse le seuil convulsif.' },
            { terms: ['insuffisance rénale sévère', 'insuffisance hépatique'], level: 'warn', text: 'Insuffisance rénale ou hépatique : réduire la dose et espacer les prises.' },
        ],
        interacts: [
            { terms: SEROTONINERGIC, level: 'warn', text: 'Antidépresseur sérotoninergique en cours : risque de syndrome sérotoninergique et de convulsions.' },
            { terms: BENZODIAZEPINES, level: 'warn', text: 'Benzodiazépine en cours : risque de dépression respiratoire.' },
        ],
        avoidTags: { intox_opioide: ['error', 'Surdose d\'opioïdes : aucun opioïde supplémentaire.'], intox_alcool: ['warn', 'Intoxication alcoolique : risque de dépression respiratoire.'] },
        regimens: [R('po', 'PO', 'mg', { adult: [50, 100, 100], maxSingle: 100, intervalHours: 6, maxDaily: 400, note: 'Réservé à l\'adulte.' })],
    }),
    med('morphine', 'Morphine', 'opioide', {
        category: 'Antalgique opioïde (palier 3)', brands: ['Morphine Aguettant'], allergy: OPIOID_ALLERGY,
        contra: [
            { terms: ['insuffisance respiratoire', 'bpco', 'apnée du sommeil'], level: 'warn', text: 'Insuffisance respiratoire : titration prudente, surveiller la fréquence respiratoire.' },
            { terms: ['insuffisance rénale sévère'], level: 'warn', text: 'Insuffisance rénale sévère : réduire la dose.' },
        ],
        interacts: [{ terms: BENZODIAZEPINES, level: 'warn', text: 'Benzodiazépine en cours : risque de dépression respiratoire.' }],
        avoidTags: { intox_opioide: ['error', 'Surdose d\'opioïdes : aucun opioïde supplémentaire.'], intox_alcool: ['warn', 'Intoxication alcoolique : risque de dépression respiratoire.'], coma: ['error', 'Conscience altérée : ne pas masquer l\'examen neurologique.'], traumatisme_cranien: ['warn', 'Traumatisme crânien : surveiller la conscience et la ventilation.'] },
        vitalsWarn: [
            { when: (v) => v.rr !== null && v.rr < 10, level: 'error', text: 'Fréquence respiratoire < 10/min : morphine déconseillée.' },
            { when: (v) => v.spo2 !== null && v.spo2 < 92, level: 'warn', text: 'SpO2 < 92 % : oxygène avant toute morphine.' },
            { when: (v) => v.sbp !== null && v.sbp < 90, level: 'warn', text: 'Tension basse : titrer par très petites doses.' },
        ],
        regimens: [
            R('iv', 'IV (titration)', 'mg', { adult: [2, 3, 5], perKg: [0.025, 0.05, 0.1], maxSingle: 10, titration: true, minAgeMonths: 12, note: 'Titration : bolus à répéter toutes les 5 minutes jusqu\'au soulagement, en surveillant FR et conscience.' }),
            R('sc', 'SC', 'mg', { adult: [5, 10, 10], perKg: [0.1, 0.1, 0.15], maxSingle: 10, intervalHours: 4, maxDaily: 60, minAgeMonths: 12, note: 'Une prise toutes les 4 heures.' }),
        ],
    }),
    med('fentanyl', 'Fentanyl', 'opioide', {
        category: 'Antalgique opioïde (palier 3)', allergy: OPIOID_ALLERGY,
        contra: [{ terms: ['insuffisance respiratoire', 'bpco', 'apnée du sommeil'], level: 'warn', text: 'Insuffisance respiratoire : titration prudente.' }],
        interacts: [{ terms: BENZODIAZEPINES, level: 'warn', text: 'Benzodiazépine en cours : risque de dépression respiratoire.' }],
        avoidTags: { intox_opioide: ['error', 'Surdose d\'opioïdes : aucun opioïde supplémentaire.'], intox_alcool: ['warn', 'Intoxication alcoolique : risque de dépression respiratoire.'], coma: ['error', 'Conscience altérée : ne pas masquer l\'examen neurologique.'] },
        vitalsWarn: [
            { when: (v) => v.rr !== null && v.rr < 10, level: 'error', text: 'Fréquence respiratoire < 10/min : fentanyl déconseillé.' },
            { when: (v) => v.spo2 !== null && v.spo2 < 92, level: 'warn', text: 'SpO2 < 92 % : oxygène avant toute titration.' },
        ],
        regimens: [R('iv', 'IV (titration)', 'µg', { adult: [25, 50, 100], perKg: [0.5, 1, 1.5], maxSingle: 200, titration: true, minAgeMonths: 12, note: 'Bolus lent, à répéter toutes les 3 à 5 minutes selon l\'effet. Action rapide et brève.' })],
    }),
    med('ketamine', 'Kétamine', 'anesthesique', {
        category: 'Anesthésique / analgésique', brands: ['Kétalar'], allergy: ['kétamine', 'ketamine', 'kétalar'],
        contra: [
            { terms: ['schizophrénie', 'psychose'], level: 'warn', text: 'Antécédent psychiatrique : risque de décompensation.' },
            { terms: ['hypertension', 'cardiopathie'], level: 'warn', text: 'Terrain cardio-vasculaire : la kétamine élève la tension et la fréquence cardiaque.' },
        ],
        avoidTags: { crise_hypertensive: ['error', 'Crise hypertensive : kétamine contre-indiquée.'], sca: ['warn', 'Syndrome coronarien : la kétamine augmente la consommation d\'oxygène du cœur.'], stimulant: ['warn', 'Intoxication aux stimulants : risque d\'hypertension et d\'agitation majorées.'] },
        regimens: [
            R('iv_analgesie', 'IV (analgésie)', 'mg', { adult: [10, 20, 30], perKg: [0.1, 0.2, 0.3], maxSingle: 40, titration: true, minAgeMonths: 12, note: 'Bolus lent ; effet en 1 minute, pendant 10 à 15 minutes.' }),
            R('iv_sedation', 'IV (sédation)', 'mg', { adult: [70, 100, 140], perKg: [1, 1.5, 2], maxSingle: 200, intervalHours: 1, maxDaily: 400, minAgeMonths: 12, note: 'Sédation procédurale : matériel de ventilation à portée de main.' }),
            R('im', 'IM', 'mg', { adult: [300, 350, 400], perKg: [4, 5, 5], maxSingle: 500, intervalHours: 1, maxDaily: 600, minAgeMonths: 12, note: 'Si l\'accès veineux est impossible.' }),
        ],
    }),
    // ── Sédatifs, anticonvulsivants, antipsychotiques ──
    med('midazolam', 'Midazolam', 'benzo', {
        category: 'Benzodiazépine (sédation, convulsions)', brands: ['Hypnovel'], allergy: ['benzodiazépine', 'benzodiazépines', 'midazolam', 'hypnovel'],
        contra: [{ terms: ['myasthénie', 'insuffisance respiratoire', 'apnée du sommeil'], level: 'warn', text: 'Terrain respiratoire fragile : doses réduites, surveillance continue.' }],
        interacts: [{ terms: ['opioïde', 'morphine', 'tramadol', 'fentanyl', 'alcool'], level: 'warn', text: 'Opioïde ou alcool associé : risque de dépression respiratoire.' }],
        avoidTags: { intox_alcool: ['warn', 'Intoxication alcoolique : risque de dépression respiratoire.'], intox_opioide: ['warn', 'Surdose d\'opioïdes : risque de dépression respiratoire majorée.'] },
        regimens: [
            R('iv', 'IV (titration)', 'mg', { adult: [1, 2, 5], perKg: [0.02, 0.05, 0.1], maxSingle: 5, titration: true, minAgeMonths: 6, note: 'Titration par petits bolus, surveiller FR et SpO2.' }),
            R('im', 'IM', 'mg', { adult: [5, 10, 10], perKg: [0.1, 0.2, 0.3], maxSingle: 10, intervalHours: 4, maxDaily: 20, minAgeMonths: 6, note: 'Convulsions ou agitation sans accès veineux.' }),
        ],
    }),
    med('diazepam', 'Diazépam', 'benzo', {
        category: 'Benzodiazépine (convulsions, agitation)', brands: ['Valium'], allergy: ['benzodiazépine', 'benzodiazépines', 'diazépam', 'valium'],
        contra: [{ terms: ['myasthénie', 'insuffisance respiratoire sévère', 'apnée du sommeil'], level: 'warn', text: 'Terrain respiratoire fragile : doses réduites, surveillance continue.' }],
        interacts: [{ terms: ['opioïde', 'morphine', 'tramadol', 'fentanyl', 'alcool'], level: 'warn', text: 'Opioïde ou alcool associé : risque de dépression respiratoire.' }],
        avoidTags: { intox_alcool: ['warn', 'Intoxication alcoolique : risque de dépression respiratoire.'], intox_opioide: ['warn', 'Surdose d\'opioïdes : risque de dépression respiratoire majorée.'] },
        regimens: [R('iv', 'IV lente', 'mg', { adult: [5, 10, 10], perKg: [0.2, 0.3, 0.5], maxSingle: 10, intervalHours: 0.1, maxDaily: 30, minAgeMonths: 1, note: 'Injection lente ; une seconde dose est possible après 5 à 10 minutes.' })],
    }),
    med('clonazepam', 'Clonazépam', 'benzo', {
        category: 'Anticonvulsivant (benzodiazépine)', brands: ['Rivotril'], allergy: ['benzodiazépine', 'benzodiazépines', 'clonazépam', 'rivotril'],
        contra: [{ terms: ['myasthénie', 'insuffisance respiratoire sévère'], level: 'warn', text: 'Terrain respiratoire fragile : surveillance continue.' }],
        avoidTags: { intox_alcool: ['warn', 'Intoxication alcoolique : risque de dépression respiratoire.'] },
        regimens: [R('iv', 'IV lente', 'mg', { adult: [1, 1, 1], perKg: [0.015, 0.02, 0.03], maxSingle: 1, intervalHours: 0.25, maxDaily: 2, minAgeMonths: 1, note: 'Convulsions : une injection lente, répétable une fois.' })],
    }),
    med('haloperidol', 'Halopéridol', 'antipsychotique', {
        category: 'Antipsychotique (agitation)', brands: ['Haldol'], allergy: ['halopéridol', 'haldol'],
        contra: [
            { terms: ['parkinson', 'démence'], level: 'error', text: 'Parkinson ou démence : halopéridol à éviter.' },
            { terms: ['qt long', 'allongement du qt', 'torsade'], level: 'error', text: 'Allongement du QT : halopéridol contre-indiqué.' },
        ],
        interacts: [{ terms: QT_DRUGS, level: 'warn', text: 'Autre médicament allongeant le QT en cours : faire un ECG.' }],
        avoidTags: { stimulant: ['warn', 'Intoxication aux stimulants : privilégier une benzodiazépine.'], convulsions: ['warn', 'Convulsions : les antipsychotiques abaissent le seuil convulsif.'] },
        regimens: [R('im', 'IM', 'mg', { adult: [2.5, 5, 5], maxSingle: 10, intervalHours: 4, maxDaily: 20, minAgeYears: 18, note: 'Agitation sévère : ECG si possible, surveiller la tension.' })],
    }),
    // ── Urgence vitale et antidotes ──
    med('adrenaline', 'Adrénaline', 'vasopresseur', {
        category: 'Urgence vitale', brands: ['Anapen', 'Adrénaline Aguettant'], allergy: ['adrénaline', 'épinéphrine'],
        regimens: [
            R('im_anaphylaxie', 'IM (anaphylaxie)', 'mg', { adult: [0.3, 0.5, 0.5], perKg: [0.01, 0.01, 0.01], maxSingle: 0.5, titration: true, note: 'Face externe de la cuisse ; renouveler toutes les 5 à 15 minutes si besoin.' }),
            R('iv_acr', 'IV (arrêt cardiaque)', 'mg', { adult: [1, 1, 1], perKg: [0.01, 0.01, 0.01], maxSingle: 1, titration: true, note: 'Toutes les 3 à 5 minutes pendant la réanimation.' }),
        ],
    }),
    med('atropine', 'Atropine', 'anticholinergique', {
        category: 'Urgence vitale (bradycardie)', allergy: ['atropine'],
        contra: [{ terms: ['glaucome'], level: 'warn', text: 'Glaucome à angle fermé : atropine à éviter.' }],
        regimens: [R('iv', 'IV', 'mg', { adult: [0.5, 0.5, 1], perKg: [0.02, 0.02, 0.02], minSingle: 0.1, maxSingle: 1, intervalHours: 0.1, maxDaily: 3, note: 'Bradycardie symptomatique ; dose totale maximale 3 mg.' })],
    }),
    med('amiodarone', 'Amiodarone', 'antiarythmique', {
        category: 'Antiarythmique', brands: ['Cordarone'], allergy: ['amiodarone', 'cordarone', 'iode'],
        contra: [{ terms: ['thyroïde', 'hyperthyroïdie'], level: 'warn', text: 'Maladie thyroïdienne : amiodarone à discuter.' }],
        interacts: [{ terms: QT_DRUGS.filter((name) => name !== 'amiodarone' && name !== 'cordarone'), level: 'warn', text: 'Autre médicament allongeant le QT en cours.' }],
        regimens: [R('iv_acr', 'IV (arrêt cardiaque)', 'mg', { adult: [150, 300, 300], perKg: [5, 5, 5], maxSingle: 300, intervalHours: 0.1, maxDaily: 450, note: '300 mg après le 3e choc, puis 150 mg si besoin.' })],
    }),
    med('aspirine', 'Aspirine', 'aine', {
        category: 'Antiagrégant (syndrome coronarien)', brands: ['Kardégic', 'Aspégic'], allergy: NSAID_ALLERGY,
        contra: [
            { terms: ['ulcère', 'ulcère gastrique'], level: 'error', text: 'Ulcère : aspirine contre-indiquée.' },
            { terms: ['hémophilie', 'trouble de la coagulation'], level: 'error', text: 'Trouble de la coagulation : aspirine contre-indiquée.' },
        ],
        interacts: [{ terms: ANTICOAGULANTS, level: 'warn', text: 'Anticoagulant en cours : risque hémorragique majoré.' }],
        avoidTags: { ...BLEEDING_TAGS },
        regimens: [R('po', 'PO', 'mg', { adult: [160, 250, 325], maxSingle: 500, intervalHours: 24, maxDaily: 500, note: 'Dose de charge à croquer ou mâcher. Réservé à l\'adulte.' })],
    }),
    med('nitroglycerine', 'Trinitrine (nitroglycérine)', 'vasodilatateur', {
        category: 'Vasodilatateur (douleur coronarienne)', brands: ['Natispray'], allergy: ['trinitrine', 'nitroglycérine', 'dérivé nitré', 'dérivés nitrés'],
        interacts: [{ terms: PDE5, level: 'error', text: 'Inhibiteur de la PDE5 (sildénafil…) : trinitrine contre-indiquée (chute de tension).' }],
        vitalsWarn: [{ when: (v) => v.sbp !== null && v.sbp < 90, level: 'error', text: 'Tension systolique < 90 mmHg : trinitrine contre-indiquée.' }],
        regimens: [R('sl', 'Sublinguale', 'mg', { adult: [0.4, 0.4, 0.4], maxSingle: 0.4, intervalHours: 0.1, maxDaily: 1.2, note: 'Une bouffée sous la langue, à répéter 3 fois au plus à 5 minutes d\'intervalle. Réservé à l\'adulte.' })],
    }),
    med('naloxone', 'Naloxone', 'antidote', {
        category: 'Antidote des opioïdes', brands: ['Narcan', 'Nalscue'], allergy: ['naloxone', 'narcan'],
        regimens: [
            R('iv', 'IV / IM (titration)', 'mg', { adult: [0.4, 0.4, 2], perKg: [0.01, 0.01, 0.1], maxSingle: 2, titration: true, note: 'Titration : 0,4 mg toutes les 2 à 3 minutes jusqu\'à une ventilation efficace. Surveiller le sevrage brutal.' }),
            R('in', 'Intranasale', 'mg', { adult: [4, 4, 4], maxSingle: 4, intervalHours: 0.05, maxDaily: 12, minAgeYears: 12, note: 'Une dose dans une narine, répétable après 2 à 3 minutes.' }),
        ],
    }),
    med('flumazenil', 'Flumazénil', 'antidote', {
        category: 'Antidote des benzodiazépines', brands: ['Anexate'], allergy: ['flumazénil', 'anexate'],
        contra: [{ terms: ['épilepsie', 'convulsions'], level: 'error', text: 'Épilepsie : risque de convulsions avec le flumazénil.' }],
        interacts: [
            { terms: BENZODIAZEPINES, level: 'warn', text: 'Benzodiazépines au long cours : risque de sevrage et de convulsions.' },
            { terms: ['antidépresseur tricyclique', 'tricyclique', 'amitriptyline'], level: 'error', text: 'Intoxication aux tricycliques possible : flumazénil contre-indiqué.' },
        ],
        regimens: [R('iv', 'IV', 'mg', { adult: [0.2, 0.2, 0.5], perKg: [0.01, 0.01, 0.01], maxSingle: 0.5, titration: true, minAgeYears: 1, note: 'Bolus de 0,2 mg, puis 0,1 mg toutes les minutes ; total maximal 1 mg.' })],
    }),
    med('glucose30', 'Glucose 30 %', 'glucose', {
        category: 'Hypoglycémie', allergy: [],
        regimens: [R('iv', 'IV', 'mL', { adult: [50, 60, 100], perKg: [0.7, 1, 1.7], maxSingle: 100, titration: true, note: 'Injection lente, glycémie de contrôle à 15 minutes.' })],
    }),
    med('glucagon', 'Glucagon', 'glucose', {
        category: 'Hypoglycémie', brands: ['GlucaGen'], allergy: ['glucagon'],
        contra: [{ terms: ['phéochromocytome'], level: 'error', text: 'Phéochromocytome : glucagon contre-indiqué.' }],
        regimens: [R('im', 'IM / SC', 'mg', { adult: [1, 1, 1], perKg: [0.02, 0.03, 0.03], maxSingle: 1, intervalHours: 0.25, maxDaily: 2, note: 'Si le patient ne peut pas avaler. Resucrer par voie orale dès le réveil.' })],
    }),
    med('acetylcysteine', 'N-acétylcystéine', 'antidote', {
        category: 'Antidote du paracétamol', brands: ['Fluimucil'], allergy: ['acétylcystéine', 'fluimucil'],
        regimens: [R('iv', 'IV (dose de charge)', 'mg', { weightBased: true, perKg: [150, 150, 150], maxSingle: 16500, intervalHours: 24, maxDaily: 16500, note: '150 mg/kg en 1 heure, puis le protocole se poursuit sur 20 heures.' })],
    }),
    med('charbon', 'Charbon activé', 'antidote', {
        category: 'Décontamination digestive', allergy: [],
        avoidTags: { coma: ['error', 'Conscience altérée : risque d\'inhalation, charbon contre-indiqué.'], intox_opioide: ['warn', 'Conscience altérée possible : n\'administrer que si le patient est vigil.'] },
        vitalsWarn: [{ when: (v) => v.gcs !== null && v.gcs < 14, level: 'error', text: 'Glasgow < 14 : risque d\'inhalation, charbon déconseillé.' }],
        regimens: [R('po', 'PO', 'g', { adult: [25, 50, 50], perKg: [1, 1, 1], maxSingle: 50, intervalHours: 24, maxDaily: 50, note: 'Dans l\'heure suivant l\'ingestion, patient conscient.' })],
    }),
    med('hydroxocobalamine', 'Hydroxocobalamine', 'antidote', {
        category: 'Antidote du cyanure (fumées)', brands: ['Cyanokit'], allergy: ['hydroxocobalamine', 'cyanokit', 'vitamine b12'],
        regimens: [R('iv', 'IV', 'mg', { adult: [5000, 5000, 10000], perKg: [70, 70, 70], maxSingle: 10000, intervalHours: 1, maxDaily: 10000, note: 'Perfusion de 15 minutes. Les urines et la peau virent au rouge.' })],
    }),
    med('thiamine', 'Thiamine (vitamine B1)', 'vitamine', {
        category: 'Intoxication alcoolique', allergy: ['thiamine', 'vitamine b1'],
        regimens: [R('iv', 'IV', 'mg', { adult: [100, 250, 500], maxSingle: 500, intervalHours: 24, maxDaily: 1500, minAgeYears: 15, note: 'À donner avant le glucose chez le patient alcoolique.' })],
    }),
    med('oxygene', 'Oxygène', 'gaz', {
        category: 'Oxygénothérapie',
        regimens: [R('masque', 'Inhalé', 'L/min', { adult: { choices: [2, 4, 6, 10, 15], usual: 6 }, byAge: [{ upToYears: 15, choices: [1, 2, 4, 6, 10], usual: 4 }], maxSingle: 15, titration: true, note: 'Viser une SpO2 de 94 à 98 % (88 à 92 % si BPCO). Masque à haute concentration au-delà de 10 L/min.' })],
    }),
    // ── Respiratoire et allergie ──
    med('salbutamol', 'Salbutamol', 'bronchodilatateur', {
        category: 'Bronchodilatateur (asthme)', brands: ['Ventoline'], allergy: ['salbutamol', 'ventoline'],
        contra: [{ terms: ['tachycardie', 'hyperthyroïdie'], level: 'warn', text: 'Tachycardie ou hyperthyroïdie : surveiller le pouls.' }],
        regimens: [R('neb', 'Nébulisation', 'mg', { adult: { choices: [2.5, 5], usual: 5 }, byAge: [{ upToYears: 5, choices: [2.5], usual: 2.5 }, { upToYears: 15, choices: [2.5, 5], usual: 5 }], maxSingle: 5, titration: true, minAgeMonths: 6, note: 'Renouvelable toutes les 20 minutes (3 fois) dans la crise.' })],
    }),
    med('ipratropium', 'Ipratropium', 'bronchodilatateur', {
        category: 'Bronchodilatateur (asthme sévère)', brands: ['Atrovent'], allergy: ['ipratropium', 'atrovent'],
        regimens: [R('neb', 'Nébulisation', 'mg', { adult: [0.5, 0.5, 0.5], byAge: [{ upToYears: 12, choices: [0.25], usual: 0.25 }, { upToYears: 15, choices: [0.5], usual: 0.5 }], maxSingle: 0.5, intervalHours: 4, maxDaily: 2, minAgeYears: 2, note: 'En association au salbutamol dans l\'asthme sévère.' })],
    }),
    med('methylprednisolone', 'Méthylprednisolone', 'corticoide', {
        category: 'Corticoïde', brands: ['Solumédrol'], allergy: ['corticoïde', 'corticoïdes', 'méthylprednisolone', 'solumédrol'],
        contra: [{ terms: ['diabète'], level: 'warn', text: 'Diabète : surveiller la glycémie sous corticoïde.' }],
        regimens: [R('iv', 'IV', 'mg', { adult: [40, 80, 125], perKg: [1, 1, 2], maxSingle: 125, intervalHours: 24, maxDaily: 250, note: 'Asthme sévère, anaphylaxie (relais après l\'adrénaline).' })],
    }),
    med('prednisolone', 'Prednisolone', 'corticoide', {
        category: 'Corticoïde', brands: ['Solupred'], allergy: ['corticoïde', 'corticoïdes', 'prednisolone', 'prednisone', 'solupred'],
        contra: [{ terms: ['diabète'], level: 'warn', text: 'Diabète : surveiller la glycémie sous corticoïde.' }],
        regimens: [R('po', 'PO', 'mg', { adult: [20, 40, 60], perKg: [1, 1, 2], maxSingle: 60, intervalHours: 24, maxDaily: 60, note: 'Une prise le matin, 3 à 5 jours.' })],
    }),
    med('cetirizine', 'Cétirizine', 'antihistaminique', {
        category: 'Antihistaminique', brands: ['Zyrtec'], allergy: ['cétirizine', 'zyrtec', 'antihistaminique'],
        regimens: [R('po', 'PO', 'mg', { adult: [10, 10, 10], byAge: [{ upToYears: 6, choices: [5], usual: 5 }, { upToYears: 15, choices: [10], usual: 10 }], maxSingle: 10, intervalHours: 24, maxDaily: 10, minAgeYears: 2, note: 'Une prise par jour.' })],
    }),
    med('furosemide', 'Furosémide', 'diuretique', {
        category: 'Diurétique (œdème pulmonaire)', brands: ['Lasilix'], allergy: ['furosémide', 'lasilix', 'sulfamide', 'sulfamides'],
        contra: [{ terms: ['déshydratation', 'hypokaliémie'], level: 'warn', text: 'Déshydratation ou hypokaliémie : prudence.' }],
        avoidTags: { choc: ['error', 'État de choc : diurétique contre-indiqué.'] },
        vitalsWarn: [{ when: (v) => v.sbp !== null && v.sbp < 90, level: 'error', text: 'Tension systolique < 90 mmHg : diurétique déconseillé.' }],
        regimens: [R('iv', 'IV', 'mg', { adult: [20, 40, 80], perKg: [0.5, 1, 1], maxSingle: 80, intervalHours: 6, maxDaily: 240, note: 'Œdème aigu du poumon : en association à l\'oxygène et à la trinitrine.' })],
    }),
    // ── Digestif ──
    med('ondansetron', 'Ondansétron', 'antiemetique', {
        category: 'Antiémétique', brands: ['Zophren'], allergy: ['ondansétron', 'zophren'],
        contra: [{ terms: ['qt long', 'allongement du qt', 'torsade'], level: 'error', text: 'Allongement du QT : ondansétron contre-indiqué.' }],
        interacts: [{ terms: QT_DRUGS.filter((name) => name !== 'ondansétron'), level: 'warn', text: 'Autre médicament allongeant le QT en cours.' }],
        regimens: [
            R('iv', 'IV', 'mg', { adult: [4, 4, 8], perKg: [0.1, 0.15, 0.15], maxSingle: 8, intervalHours: 8, maxDaily: 24, minAgeMonths: 6, note: 'Injection lente de 30 secondes au moins.' }),
            R('po', 'PO', 'mg', { adult: [4, 4, 8], perKg: [0.1, 0.15, 0.15], maxSingle: 8, intervalHours: 8, maxDaily: 24, minAgeMonths: 6, note: 'Comprimé orodispersible.' }),
        ],
    }),
    med('metoclopramide', 'Métoclopramide', 'antiemetique', {
        category: 'Antiémétique', brands: ['Primpéran'], allergy: ['métoclopramide', 'primpéran'],
        contra: [{ terms: ['épilepsie', 'parkinson'], level: 'error', text: 'Épilepsie ou Parkinson : métoclopramide à éviter.' }],
        regimens: [R('po', 'PO / IV', 'mg', { adult: [10, 10, 10], maxSingle: 10, intervalHours: 8, maxDaily: 30, minAgeYears: 18, note: 'Réservé à l\'adulte ; 3 prises par jour au plus.' })],
    }),
    med('omeprazole', 'Oméprazole', 'ipp', {
        category: 'Anti-acide', brands: ['Mopral'], allergy: ['oméprazole', 'mopral', 'inhibiteur de la pompe à protons'],
        regimens: [R('po', 'PO / IV', 'mg', { adult: [20, 40, 40], maxSingle: 40, intervalHours: 24, maxDaily: 80, minAgeYears: 15, note: 'Avant le repas du matin.' })],
    }),
    med('phloroglucinol', 'Phloroglucinol', 'antispasmodique', {
        category: 'Antispasmodique', brands: ['Spasfon'], allergy: ['phloroglucinol', 'spasfon'],
        regimens: [
            R('po', 'PO', 'mg', { adult: [80, 80, 160], maxSingle: 160, intervalHours: 8, maxDaily: 480, minAgeYears: 15, note: 'Douleurs spasmodiques.' }),
            R('iv', 'IV', 'mg', { adult: [40, 80, 80], maxSingle: 80, intervalHours: 8, maxDaily: 240, minAgeYears: 15, note: 'Injection lente.' }),
        ],
    }),
    // ── Antibiotiques ──
    med('amoxicilline', 'Amoxicilline', 'penicilline', {
        category: 'Antibiotique (pénicilline)', brands: ['Clamoxyl'], allergy: PENICILLIN_ALLERGY,
        regimens: [R('po', 'PO', 'mg', { adult: [500, 1000, 1000], perKg: [15, 17, 25], maxSingle: 1000, intervalHours: 8, maxDaily: 3000, maxDailyPerKg: 100, note: 'Trois prises par jour, 5 à 7 jours selon l\'indication.' })],
    }),
    med('amoxicilline_clav', 'Amoxicilline + acide clavulanique', 'penicilline', {
        category: 'Antibiotique (pénicilline)', brands: ['Augmentin'], allergy: PENICILLIN_ALLERGY,
        contra: [{ terms: ['hépatite', 'ictère', 'insuffisance hépatique'], level: 'warn', text: 'Atteinte hépatique : risque d\'hépatite médicamenteuse.' }],
        regimens: [R('po', 'PO', 'mg', { adult: [1000, 1000, 1000], perKg: [20, 26, 30], maxSingle: 1000, intervalHours: 8, maxDaily: 3000, maxDailyPerKg: 90, minAgeMonths: 3, note: 'Dose exprimée en amoxicilline ; trois prises par jour pendant les repas.' })],
    }),
    med('ceftriaxone', 'Ceftriaxone', 'cephalosporine', {
        category: 'Antibiotique (céphalosporine)', brands: ['Rocéphine'], allergy: [...CEPHALOSPORIN_ALLERGY],
        crossAllergy: { terms: PENICILLIN_ALLERGY, level: 'warn', text: 'Allergie à la pénicilline : réaction croisée possible avec les céphalosporines (rare).' },
        regimens: [R('iv', 'IV / IM', 'mg', { adult: [1000, 1000, 2000], perKg: [50, 50, 100], maxSingle: 2000, intervalHours: 24, maxDaily: 4000, minAgeMonths: 1, note: 'Une injection par jour.' })],
    }),
    med('cefazoline', 'Céfazoline', 'cephalosporine', {
        category: 'Antibiotique (antibioprophylaxie)', allergy: [...CEPHALOSPORIN_ALLERGY],
        crossAllergy: { terms: PENICILLIN_ALLERGY, level: 'warn', text: 'Allergie à la pénicilline : réaction croisée possible avec les céphalosporines (rare).' },
        regimens: [R('iv', 'IV', 'mg', { adult: [1000, 2000, 2000], perKg: [25, 30, 50], maxSingle: 2000, intervalHours: 8, maxDaily: 6000, minAgeMonths: 1, note: 'Antibioprophylaxie : une injection avant le geste, puis toutes les 8 h si besoin.' })],
    }),
    med('azithromycine', 'Azithromycine', 'macrolide', {
        category: 'Antibiotique (macrolide)', brands: ['Zithromax'], allergy: ['macrolide', 'macrolides', 'azithromycine', 'zithromax', 'érythromycine'],
        contra: [{ terms: ['qt long', 'allongement du qt'], level: 'error', text: 'Allongement du QT : azithromycine contre-indiquée.' }],
        interacts: [{ terms: QT_DRUGS.filter((name) => name !== 'azithromycine'), level: 'warn', text: 'Autre médicament allongeant le QT en cours.' }],
        regimens: [R('po', 'PO', 'mg', { adult: [250, 500, 500], perKg: [10, 10, 10], maxSingle: 500, intervalHours: 24, maxDaily: 500, minAgeMonths: 6, note: 'Une prise par jour pendant 3 jours.' })],
    }),
    med('ciprofloxacine', 'Ciprofloxacine', 'quinolone', {
        category: 'Antibiotique (fluoroquinolone)', brands: ['Ciflox'], allergy: ['quinolone', 'quinolones', 'fluoroquinolone', 'ciprofloxacine', 'ofloxacine', 'lévofloxacine', 'ciflox'],
        contra: [{ terms: ['tendinite', 'épilepsie', 'myasthénie'], level: 'error', text: 'Tendinopathie, épilepsie ou myasthénie : fluoroquinolone contre-indiquée.' }],
        interacts: [{ terms: ['théophylline'], level: 'warn', text: 'Théophylline en cours : risque de surdosage.' }],
        regimens: [R('po', 'PO', 'mg', { adult: [500, 500, 750], maxSingle: 750, intervalHours: 12, maxDaily: 1500, minAgeYears: 18, note: 'Deux prises par jour. Réservé à l\'adulte.' })],
    }),
    med('metronidazole', 'Métronidazole', 'imidazole', {
        category: 'Antibiotique (anaérobies)', brands: ['Flagyl'], allergy: ['métronidazole', 'flagyl', 'nitro-imidazolé', 'imidazole'],
        interacts: [{ terms: ['alcool'], level: 'warn', text: 'Alcool : effet antabuse (déconseillé pendant le traitement).' }],
        regimens: [R('po', 'PO / IV', 'mg', { adult: [500, 500, 500], perKg: [7.5, 7.5, 10], maxSingle: 500, intervalHours: 8, maxDaily: 1500, maxDailyPerKg: 30, minAgeMonths: 1, note: 'Trois prises par jour.' })],
    }),
    // ── Vaccination, hémostase, perfusion, anesthésie locale ──
    med('vaccin_tetanique', 'Vaccin antitétanique (dTP)', 'vaccin', {
        category: 'Prévention du tétanos', allergy: ['vaccin', 'vaccins', 'tétanos'],
        regimens: [R('im', 'IM', 'mL', { adult: [0.5, 0.5, 0.5], byAge: [{ upToYears: 200, choices: [0.5], usual: 0.5 }], maxSingle: 0.5, intervalHours: 24, maxDaily: 0.5, note: 'Rappel si le dernier vaccin date de plus de 10 ans (5 ans pour une plaie à risque).' })],
    }),
    med('immunoglobuline_tetanique', 'Immunoglobuline antitétanique', 'vaccin', {
        category: 'Prévention du tétanos', allergy: ['immunoglobuline', 'immunoglobulines'],
        regimens: [R('im', 'IM', 'UI', { adult: [250, 250, 500], byAge: [{ upToYears: 200, choices: [250], usual: 250 }], maxSingle: 500, intervalHours: 24, maxDaily: 500, note: 'Plaie à haut risque chez un patient non vacciné ou incertain, en un autre site que le vaccin.' })],
    }),
    med('acide_tranexamique', 'Acide tranexamique', 'hemostatique', {
        category: 'Antifibrinolytique (hémorragie)', brands: ['Exacyl'], allergy: ['acide tranexamique', 'exacyl'],
        contra: [{ terms: ['thrombose', 'phlébite', 'embolie', 'caillot'], level: 'error', text: 'Antécédent thromboembolique : acide tranexamique contre-indiqué.' }, { terms: ['convulsions', 'épilepsie'], level: 'warn', text: 'Antécédent convulsif : prudence.' }],
        regimens: [R('iv', 'IV', 'mg', { adult: [1000, 1000, 1000], perKg: [15, 15, 15], maxSingle: 1000, intervalHours: 8, maxDaily: 3000, minAgeYears: 1, note: 'À débuter dans les 3 heures suivant le traumatisme : 1 g en 10 minutes, puis 1 g sur 8 heures.' })],
    }),
    med('nacl09', 'Sérum physiologique 0,9 %', 'perfusion', {
        category: 'Remplissage vasculaire', allergy: [],
        contra: [{ terms: ['insuffisance cardiaque'], level: 'warn', text: 'Insuffisance cardiaque : remplissage prudent, par petites quantités.' }],
        avoidTags: { oap: ['error', 'Œdème aigu du poumon : pas de remplissage.'] },
        regimens: [R('iv', 'IV (perfusion)', 'mL', { adult: [250, 500, 1000], perKg: [10, 10, 20], maxSingle: 1000, maxDaily: 3000, maxDailyPerKg: 60, titration: true, note: 'Bolus à réévaluer après chaque poche (tension, pouls, diurèse).' })],
    }),
    med('ringer', 'Ringer lactate', 'perfusion', {
        category: 'Remplissage vasculaire', allergy: [],
        contra: [{ terms: ['insuffisance hépatique', 'cirrhose'], level: 'warn', text: 'Insuffisance hépatique : lactate mal métabolisé.' }, { terms: ['insuffisance cardiaque'], level: 'warn', text: 'Insuffisance cardiaque : remplissage prudent, par petites quantités.' }],
        avoidTags: { oap: ['error', 'Œdème aigu du poumon : pas de remplissage.'] },
        regimens: [R('iv', 'IV (perfusion)', 'mL', { adult: [250, 500, 1000], perKg: [10, 10, 20], maxSingle: 1000, maxDaily: 3000, maxDailyPerKg: 60, titration: true, note: 'Bolus à réévaluer après chaque poche (tension, pouls, diurèse).' })],
    }),
    med('lidocaine', 'Lidocaïne 1 % (anesthésie locale)', 'anesthesique_local', {
        category: 'Anesthésie locale', brands: ['Xylocaïne'], allergy: ['lidocaïne', 'xylocaïne', 'anesthésique local', 'anesthésiques locaux', 'bupivacaïne', 'novocaïne'],
        regimens: [R('infiltration', 'Infiltration locale', 'mL', { adult: [2, 5, 20], perKg: [0.1, 0.2, 0.45], maxSingle: 30, titration: true, note: 'Sans adrénaline : 4,5 mg/kg au plus (1 mL = 10 mg). Aspirer avant d\'injecter.' })],
    }),
    // ── Anesthésie (bloc opératoire) ──
    med('propofol', 'Propofol', 'anesthesique', {
        category: 'Anesthésique général (induction)', brands: ['Diprivan'], allergy: ['propofol', 'diprivan', 'soja', 'arachide', 'oeuf'],
        avoidTags: { choc: ['warn', 'État de choc : le propofol fait chuter la tension, réduire la dose ou préférer la kétamine.'] },
        vitalsWarn: [{ when: (v) => v.sbp !== null && v.sbp < 90, level: 'warn', text: 'Tension basse : réduire la dose de propofol.' }],
        regimens: [R('iv_induction', 'IV (induction)', 'mg', { weightBased: true, perKg: [1.5, 2, 2.5], maxSingle: 300, titration: true, minAgeMonths: 1, note: 'Injection lente jusqu\'à la perte de conscience ; entretien en perfusion continue.' })],
    }),
    med('rocuronium', 'Rocuronium', 'curare', {
        category: 'Curare (intubation)', brands: ['Esmeron'], allergy: ['rocuronium', 'esmeron', 'curare', 'curares', 'myorelaxant', 'myorelaxants'],
        contra: [{ terms: ['myasthénie'], level: 'error', text: 'Myasthénie : curare contre-indiqué.' }],
        regimens: [R('iv', 'IV', 'mg', { weightBased: true, perKg: [0.45, 0.6, 1.2], maxSingle: 150, titration: true, minAgeMonths: 1, note: 'Après perte de conscience ; ventilation contrôlée obligatoire.' })],
    }),
    med('sugammadex', 'Sugammadex', 'antidote', {
        category: 'Décurarisation', brands: ['Bridion'], allergy: ['sugammadex', 'bridion'],
        contra: [{ terms: ['insuffisance rénale sévère', 'dialyse'], level: 'warn', text: 'Insuffisance rénale sévère : sugammadex déconseillé.' }],
        regimens: [R('iv', 'IV', 'mg', { weightBased: true, perKg: [2, 2, 4], maxSingle: 400, titration: true, minAgeYears: 2, note: 'En fin d\'intervention pour lever le bloc neuromusculaire.' })],
    }),
    med('bupivacaine', 'Bupivacaïne', 'anesthesique_local', {
        category: 'Anesthésique local (rachianesthésie, blocs)', brands: ['Marcaïne'], allergy: ['bupivacaïne', 'marcaïne', 'anesthésique local', 'anesthésiques locaux', 'lidocaïne', 'xylocaïne'],
        contra: [{ terms: ['anticoagulant', 'anticoagulants', 'trouble de la coagulation', 'hémophilie'], level: 'warn', text: 'Trouble de la coagulation ou anticoagulant : rachianesthésie et blocs profonds à discuter.' }],
        interacts: [{ terms: ANTICOAGULANTS, level: 'warn', text: 'Anticoagulant en cours : risque d\'hématome compressif après rachianesthésie.' }],
        avoidTags: { choc: ['error', 'État de choc : rachianesthésie contre-indiquée (chute de tension).'] },
        regimens: [
            R('spinale', 'Rachianesthésie', 'mg', { adult: [8, 12, 15], maxSingle: 20, titration: true, minAgeYears: 15, note: 'Bupivacaïne hyperbare 0,5 %, position assise ou latérale ; réservé à l\'adulte.' }),
            R('bloc', 'Bloc nerveux / infiltration', 'mg', { adult: [50, 100, 150], perKg: [1, 2, 2], maxSingle: 150, titration: true, minAgeMonths: 12, note: 'Plafond 2 mg/kg (150 mg), sans adrénaline ; aspirer avant d\'injecter.' }),
        ],
    }),
];

export const MEDICATION_BY_ID = Object.fromEntries(MEDICATIONS.map((m) => [m.id, m]));
export const regimenOf = (medId, regimenId) => MEDICATION_BY_ID[medId]?.regimens.find((r) => r.id === regimenId) || null;
