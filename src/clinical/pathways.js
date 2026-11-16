// src/clinical/pathways.js
//
// Le PARCOURS de prise en charge de Pilou : une seule suite d'étapes, dans l'ordre où on les fait, qui réunit tous les motifs du cas. Six temps :
//   1. Premier regard · 2. Gestes immédiats · 3. Examen et bilan · 4. Traitement · 5. Surveillance · 6. Orientation et suites.
// Les étapes propres à chaque motif viennent de pathwaysTrauma.js et pathwaysMedical.js ; ce fichier y ajoute les étapes communes (bilan A B C D E, constantes, interrogatoire, examens,
// médicaments dosés, surveillance, orientation) et les conduites tirées des précisions sur les blessures (injuryCare.js). Le suivi pas à pas de l'outil se fait sur cette liste.
// Pur (ni React ni Firebase). À TENIR À JOUR : tout nouveau motif de conditions.js doit avoir son parcours (un test le vérifie).
import { TRAUMA_PATHWAYS } from './pathwaysTrauma';
import { MEDICAL_PATHWAYS } from './pathwaysMedical';

export const PATHWAYS = { ...TRAUMA_PATHWAYS, ...MEDICAL_PATHWAYS };

export const PHASES = [
    { key: 'start', label: 'Premier regard', icon: 'fa-eye', hint: "Les premières secondes : se protéger, repérer ce qui menace la vie, mesurer." },
    { key: 'now', label: 'Gestes immédiats', icon: 'fa-bolt', hint: "Ce qui ne peut pas attendre le diagnostic." },
    { key: 'assess', label: 'Examen et bilan', icon: 'fa-stethoscope', hint: "Interroger, examiner, demander les examens." },
    { key: 'treat', label: 'Traitement', icon: 'fa-syringe', hint: "Gestes de soin et médicaments, avec leurs doses pour ce patient." },
    { key: 'watch', label: 'Surveillance', icon: 'fa-heart-pulse', hint: "Ce que l'on recontrôle, et les signes qui doivent alerter." },
    { key: 'end', label: 'Orientation et suites', icon: 'fa-route', hint: "Où va le patient, avec quoi, et ce que l'on transmet." },
];
export const PHASE_BY_KEY = Object.fromEntries(PHASES.map((phase) => [phase.key, phase]));

/** « Titre : détail » → { title, detail } (sans « : », tout est le titre). */
export const splitStep = (text) => {
    const value = String(text || '').trim();
    const at = value.indexOf(' : ');
    return at < 0 ? { title: value.replace(/\.$/, ''), detail: '' } : { title: value.slice(0, at).trim(), detail: value.slice(at + 3).trim() };
};

const ABCDE = [
    "A – Voies aériennes : le patient parle-t-il ? Bouche libre, pas de bruit anormal ; rachis cervical maintenu en cas de traumatisme.",
    "B – Respiration : fréquence, amplitude, saturation, auscultation des deux côtés.",
    "C – Circulation : pouls, tension, coloration, saignement visible, temps de recoloration de l'ongle.",
    "D – Conscience : score de Glasgow, pupilles, glycémie capillaire.",
    "E – Exposition : déshabiller pour tout voir, examiner, puis couvrir pour éviter le refroidissement.",
];
const REASSESS = {
    0: "Gravité légère : constantes à l'arrivée et avant la sortie, douleur réévaluée 30 minutes après l'antalgique.",
    1: "Gravité modérée : constantes toutes les 30 minutes, douleur réévaluée après chaque antalgique.",
    2: "Gravité sévère : patient scopé, constantes toutes les 15 minutes, tout changement est signalé au médecin.",
    3: "Gravité critique : monitorage continu, constantes relevées toutes les 5 minutes, un soignant reste auprès du patient.",
};
// Étapes de CLÔTURE du traitement d'un motif (décision, suites, sortie) : les médicaments dosés se placent juste avant, pour que le suivi pas à pas reste dans l'ordre réel.
const CLOSING = /^(Organiser|Orienter|Hospitaliser|Préparer la sortie|Préparer la suite|Préparer le bloc|Conduire au bloc|Décider|Surveiller|Réévaluer|Escalader|Évaluer avant|Signes d'alarme|Après la reprise|Donner les consignes|Discuter|Gérer le garrot|Traiter la cause et orienter)/;
const comma = (value) => String(value).replace('.', ',');
// Identifiant stable d'une consigne (le suivi garde ses coches quand on ajoute une précision ailleurs).
const slug = (text) => String(text).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 48);

/**
 * Parcours complet d'un cas.
 * raw : { conditions: [{ id, label, equipment, monitoring }], severity: { index, label }, vitals, patient: { allergies, chronic, currentMeds }, adaptations, notices, injuryCare, meds, skipped,
 *         prescription, exams, expectedResults, routineCare, destination, destinationKey, advice }
 * → [{ key, label, icon, hint, steps: [{ id, phase, title, detail, points, tag, kind }] }] — kind : 'step' | 'med' | 'alert' ; tag : motif concerné ('' si l'étape est commune).
 */
export const buildTimeline = (raw) => {
    const byPhase = Object.fromEntries(PHASES.map((phase) => [phase.key, []]));
    const single = raw.conditions.length === 1;
    const push = (phase, id, title, detail = '', extra = {}) => byPhase[phase].push({ id, phase, title, detail, points: [], tag: '', kind: 'step', ...extra });
    const pushText = (phase, id, text, extra = {}) => { const { title, detail } = splitStep(text); push(phase, id, title, detail, extra); };
    const tagOf = (condition) => (single ? '' : condition.label);
    const sev = raw.severity.index;
    const placedMeds = new Set();
    const pushMed = (med) => {
        placedMeds.add(med);
        push('treat', `med-${med.medId}-${med.regimenId}`, `Administrer : ${med.text}`, '', { points: med.alerts, kind: 'med', level: med.level, tag: med.forLabel && !single ? med.forLabel : '' });
    };
    const pushMeds = (condition) => raw.meds.filter((med) => med.forCondition === condition.id && !placedMeds.has(med)).forEach(pushMed);

    // 1. Premier regard
    push('start', 'start-safety', 'Se protéger et se présenter', "Gants, lieu sûr ; on se présente, on explique ce que l'on fait et on recueille l'identité du patient et son accord quand c'est possible.");
    if (sev >= 2) push('start', 'start-help', 'Appeler du renfort', "Gravité sévère ou critique : médecin senior prévenu, patient installé en salle de déchocage et scopé, chariot d'urgence et défibrillateur à portée de main.", { kind: 'alert' });
    push('start', 'start-abcde', 'Faire le bilan primaire A B C D E', "Toujours dans cet ordre : un problème trouvé se traite avant de passer à la lettre suivante.", { points: ABCDE });
    const v = raw.vitals;
    push('start', 'start-vitals', 'Prendre les constantes',
        `Valeurs attendues pour ce patient à cette gravité : FC ${v.hr}/min, PA ${v.sbp}/${v.dbp} mmHg, FR ${v.rr}/min, SpO2 ${v.spo2} %, température ${comma(v.temp)} °C, glycémie ${comma(v.glu)} g/L, Glasgow ${v.gcs}/15. Des valeurs très différentes font revoir le motif ou la gravité.`);
    if (raw.adaptations.length || raw.notices.length) push('start', 'start-adapt', 'Adapter la prise en charge à ce patient', '', { points: [...raw.adaptations, ...raw.notices], kind: 'alert' });
    const equipment = [...new Set(raw.conditions.flatMap((condition) => condition.equipment))];
    if (equipment.length) push('start', 'start-equipment', 'Préparer le matériel', "À réunir avant de commencer, pour ne pas quitter le patient ensuite.", { points: equipment });

    // 2 à 4. Étapes propres aux motifs, puis conduites tirées des précisions sur les blessures
    ['now', 'assess', 'treat'].forEach((phase) => {
        if (phase === 'assess') {
            push('assess', 'assess-history', 'Interroger le patient ou les témoins', "Ce qui s'est passé, depuis quand, ce qui a déjà été fait ; puis les six questions : signes, allergies, médicaments, passé médical, dernier repas, événement.", {
                points: [`Allergies : ${raw.patient.allergies || 'aucune renseignée'}`, `Antécédents : ${raw.patient.chronic || 'aucun renseigné'}`, `Traitements en cours : ${raw.patient.currentMeds || 'aucun renseigné'}`],
            });
        }
        raw.conditions.forEach((condition) => {
            const texts = (PATHWAYS[condition.id] || {})[phase] || [];
            // Traitement : les médicaments dosés du motif se placent juste avant son étape de clôture (décision, suites, sortie) — à défaut avant la dernière étape.
            const closing = texts.findIndex((text) => CLOSING.test(text));
            const medsAt = phase === 'treat' ? (closing >= 0 ? closing : Math.max(0, texts.length - 1)) : -1;
            texts.forEach((text, index) => {
                if (index === medsAt) pushMeds(condition);
                pushText(phase, `${phase}-${condition.id}-${index}`, text, { tag: tagOf(condition) });
            });
            if (phase === 'treat' && !texts.length) pushMeds(condition);
        });
        raw.injuryCare.filter((note) => note.phase === phase).forEach((note) => pushText(phase, `${phase}-injury-${slug(note.text)}`, note.text, { tag: 'Blessures', kind: phase === 'now' ? 'alert' : 'step' }));
    });

    // 3. Examens
    if (raw.exams.length || raw.expectedResults.length) {
        push('assess', 'assess-exams', 'Demander les examens', raw.exams.length ? `À prescrire : ${raw.exams.join(', ')}.` : 'Biologie selon le tableau.', { points: raw.expectedResults.map((line) => `Résultat le plus probable — ${line}`) });
    }

    // 4. Médicaments qui ne se rattachent à aucun motif du cas (ne devrait pas arriver), médicaments écartés, soins associés
    raw.meds.filter((med) => !placedMeds.has(med)).forEach(pushMed);
    if (raw.skipped.length) {
        push('treat', 'treat-skipped', 'Médicaments écartés pour ce patient', "Ils ne sont pas proposés : allergie, contre-indication, âge ou interaction.", { points: raw.skipped.map((item) => `${item.name}${item.reasons.length ? ` : ${item.reasons.join(' ; ')}` : ''}`), kind: 'alert' });
    }
    if (raw.routineCare.length) push('treat', 'treat-routine', 'Compléter les soins associés', raw.routineCare.join(', ') + '.');

    // 5. Surveillance
    push('watch', 'watch-rhythm', 'Réévaluer régulièrement', REASSESS[sev] || REASSESS[1]);
    raw.conditions.forEach((condition) => condition.monitoring.forEach((text, index) => pushText('watch', `watch-${condition.id}-${index}`, text, { tag: tagOf(condition) })));

    // 6. Orientation et suites
    push('end', 'end-destination', `Orienter : ${raw.destination}`, raw.advice || '');
    if (raw.prescription.length) push('end', 'end-rx', "Remettre l'ordonnance de sortie", "À expliquer au patient : quoi, combien, combien de temps.", { points: raw.prescription.map((med) => med.text), kind: 'med' });
    if (raw.destinationKey === 'Home') push('end', 'end-advice', 'Donner les consignes de sortie', "Les signes qui doivent faire revenir, la conduite à tenir à la maison, le prochain rendez-vous ; s'assurer que le patient a compris et qu'il n'est pas seul si son état le demande.");
    else push('end', 'end-handover', 'Faire les transmissions', "À l'équipe qui prend le relais : identité, motif, ce qui a été trouvé, ce qui a été fait (gestes, médicaments, heures), ce qui reste à faire et ce qu'il faut surveiller.");
    push('end', 'end-report', 'Rédiger le rapport', "Protocole d'urgence ou consultation générale : l'assistant du formulaire y reprend les mêmes motifs, constantes, soins et médicaments.");

    return PHASES.map((phase) => ({ ...phase, steps: byPhase[phase.key] })).filter((phase) => phase.steps.length);
};

/** Toutes les étapes d'un parcours, à plat, dans l'ordre. */
export const flatSteps = (timeline) => (Array.isArray(timeline) ? timeline : []).flatMap((phase) => phase.steps);
