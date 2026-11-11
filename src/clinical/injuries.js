// src/clinical/injuries.js
//
// Localisation et multiplicité des blessures, et mutilations associées (protocole d'urgence). Le soignant les renseigne SOUS « Motifs de prise en charge », avant que Pilou rédige : Pilou les reprend dans la plainte,
// le diagnostic et les soins, et le rapport les imprime en précision de l'anamnèse. Fonctions pures.
//
// Données du formulaire :
//   injuryDetails     : [{ conditionId, regions: [id], side: 'Right'|'Left'|'Both'|'', count: '1'|'2'|'3'|'4'|'5+', trajectory?: 'Through'|'Lodged'|'Graze', note }]   (une entrée par motif de blessure)
//   injuryMutilations : [code]    (pertes de dents, atteinte de l'œil, de l'oreille, amputations…)
//   injuryNote        : texte libre
import { CONDITION_BY_ID } from './conditions';

// Motifs de prise en charge qui se localisent et se comptent. `unit` : [singulier, pluriel] du nombre.
export const INJURY_CONDITIONS = {
    plaie_superficielle: { unit: ['plaie', 'plaies'], countLabel: 'Nombre de plaies' },
    plaie_profonde: { unit: ['plaie', 'plaies'], countLabel: 'Nombre de plaies' },
    fracture_fermee: { unit: ['fracture', 'fractures'], countLabel: 'Nombre de fractures' },
    fracture_ouverte: { unit: ['fracture ouverte', 'fractures ouvertes'], countLabel: 'Nombre de fractures' },
    entorse_luxation: { unit: ['articulation atteinte', 'articulations atteintes'], countLabel: "Nombre d'articulations" },
    trauma_cranien: { unit: ['point d\'impact', 'points d\'impact'], countLabel: "Nombre d'impacts" },
    brulure: { unit: ['zone brûlée', 'zones brûlées'], countLabel: 'Nombre de zones brûlées' },
    plaie_arme_feu: { unit: ['impact de balle', 'impacts de balle'], countLabel: "Nombre d'impacts", trajectory: true },
    plaie_arme_blanche: { unit: ['plaie par arme blanche', 'plaies par arme blanche'], countLabel: 'Nombre de plaies' },
    trauma_thoracique: { unit: ['point d\'impact', 'points d\'impact'], countLabel: "Nombre d'impacts" },
    trauma_abdominal: { unit: ['point d\'impact', 'points d\'impact'], countLabel: "Nombre d'impacts" },
    polytraumatisme: { unit: ['lésion', 'lésions'], countLabel: 'Nombre de lésions' },
    hemorragie_externe: { unit: ['saignement', 'saignements'], countLabel: 'Nombre de saignements' },
};
export const isInjuryCondition = (id) => !!INJURY_CONDITIONS[id];

const group = (label, items) => ({ label, options: items.map(([value, text]) => ({ value, label: text })) });
export const BODY_REGION_GROUPS = [
    group('Tête et visage', [['cuir_chevelu', 'Crâne / cuir chevelu'], ['front', 'Front'], ['visage', 'Visage'], ['oeil', 'Œil'], ['oreille', 'Oreille'], ['nez', 'Nez'], ['bouche', 'Bouche / dents'], ['machoire', 'Mâchoire']]),
    group('Cou et tronc', [['cou', 'Cou'], ['thorax', 'Thorax'], ['abdomen', 'Abdomen'], ['dos', 'Dos'], ['rachis', 'Rachis (colonne)'], ['bassin', 'Bassin / hanche']]),
    group('Membre supérieur', [['epaule', 'Épaule'], ['bras', 'Bras'], ['coude', 'Coude'], ['avant_bras', 'Avant-bras'], ['poignet', 'Poignet'], ['main', 'Main'], ['doigts', 'Doigt(s)']]),
    group('Membre inférieur', [['cuisse', 'Cuisse'], ['genou', 'Genou'], ['jambe', 'Jambe'], ['cheville', 'Cheville'], ['pied', 'Pied'], ['orteils', 'Orteil(s)']]),
];
export const BODY_REGIONS = BODY_REGION_GROUPS.flatMap((g) => g.options);
export const REGION_LABEL = Object.fromEntries(BODY_REGIONS.map((region) => [region.value, region.label]));

export const SIDES = [{ value: 'Right', label: 'Côté droit' }, { value: 'Left', label: 'Côté gauche' }, { value: 'Both', label: 'Des deux côtés' }];
export const SIDE_PHRASE = { Right: 'côté droit', Left: 'côté gauche', Both: 'des deux côtés' };
export const COUNTS = [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5+', label: '5 ou plus' }];
export const TRAJECTORIES = [{ value: 'Through', label: 'Transfixiante (orifice d\'entrée et de sortie)' }, { value: 'Lodged', label: 'Balle logée' }, { value: 'Graze', label: 'Tangentielle (effleurement)' }];
const TRAJECTORY_PHRASE = { Through: 'transfixiante', Lodged: 'balle logée', Graze: 'tangentielle' };

// Mutilations et atteintes associées, avec la conduite à tenir que Pilou ajoute aux soins.
export const MUTILATIONS = [
    { value: 'teeth', label: 'Perte de dent(s)', care: 'Récupération des dents (par la couronne, sans les frotter) et conservation dans du lait ou du sérum physiologique ; avis dentaire en urgence.' },
    { value: 'eye', label: "Atteinte de l'œil (perforation, énucléation)", care: "Protection de l'œil par une coque rigide, sans pression sur le globe ni retrait d'un corps étranger ; avis ophtalmologique urgent." },
    { value: 'ear', label: "Atteinte de l'oreille (arrachement, perte)", care: 'Conservation du fragment en compresses stériles humides, dans un sac étanche sur glace indirecte ; pansement du moignon.' },
    { value: 'nose', label: 'Atteinte du nez', care: 'Hémostase par compression douce, conservation de tout fragment ; avis ORL ou maxillo-facial.' },
    { value: 'lips_tongue', label: 'Atteinte des lèvres ou de la langue', care: 'Hémostase, vérification des voies aériennes, conservation de tout fragment ; suture sous anesthésie locale ou au bloc.' },
    { value: 'cheek', label: 'Perforation de la joue', care: 'Rinçage, exploration de la plaie et de la cavité buccale, antibioprophylaxie ; avis maxillo-facial.' },
    { value: 'scalp', label: 'Scalp (arrachement du cuir chevelu)', care: 'Compression hémostatique, conservation du lambeau en compresses stériles humides sur glace indirecte ; bilan crânien.' },
    { value: 'fingers', label: 'Amputation de doigt(s)', care: 'Garrot si hémorragie, conservation du segment amputé (compresses stériles humides, sac étanche, glace indirecte) ; avis chirurgie de la main.' },
    { value: 'hand', label: 'Amputation de la main', care: 'Garrot, conservation du segment (compresses stériles humides, sac étanche, glace indirecte), antalgie ; transfert au bloc pour réimplantation éventuelle.' },
    { value: 'arm', label: "Amputation d'un bras", care: 'Garrot à la racine du membre, remplissage vasculaire, conservation du segment sur glace indirecte ; transfert au bloc en urgence.' },
    { value: 'leg', label: "Amputation d'une jambe ou d'un pied", care: 'Garrot, remplissage vasculaire, conservation du segment sur glace indirecte, antalgie ; transfert au bloc en urgence.' },
    { value: 'toes', label: "Amputation d'orteil(s)", care: 'Hémostase, conservation du segment (compresses stériles humides, sac étanche, glace indirecte) ; avis orthopédique.' },
    { value: 'disfigurement', label: 'Défiguration du visage', care: 'Hémostase et protection des plaies du visage, surveillance des voies aériennes ; avis de chirurgie maxillo-faciale.' },
    { value: 'other', label: 'Autre mutilation (à préciser)', care: '' },
];
export const MUTILATION_BY_VALUE = Object.fromEntries(MUTILATIONS.map((m) => [m.value, m]));

const joinFr = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`);
const lowerFirst = (text) => String(text || '').charAt(0).toLowerCase() + String(text || '').slice(1);
const asList = (value) => (Array.isArray(value) ? value : []);

/** Entrée de détail d'un motif (ou null). */
export const injuryEntryOf = (formData, conditionId) => asList(formData && formData.injuryDetails).find((entry) => entry && entry.conditionId === conditionId) || null;

/** Motifs sélectionnés qui se localisent. */
export const selectedInjuryIds = (formData) => asList(formData && formData.clinicalConditions).filter((id) => isInjuryCondition(id) && CONDITION_BY_ID[id]);

const countPhrase = (conditionId, count) => {
    if (!count) return '';
    const [one, many] = INJURY_CONDITIONS[conditionId].unit;
    if (count === '1') return `1 ${one}`;
    return `${count === '5+' ? '5 ou plus' : count} ${many}`;
};
const regionsPhrase = (entry) => {
    const labels = asList(entry.regions).map((id) => lowerFirst(REGION_LABEL[id] || id));
    if (!labels.length) return '';
    return `${joinFr(labels)}${SIDE_PHRASE[entry.side] ? ` (${SIDE_PHRASE[entry.side]})` : ''}`;
};

/** Une phrase par motif de blessure renseigné : « Plaie par arme à feu : 2 impacts de balle ; localisation : cuisse et abdomen (côté droit) ; balle logée ; précision ». */
export const injuryLines = (formData) => selectedInjuryIds(formData).map((conditionId) => {
    const entry = injuryEntryOf(formData, conditionId);
    if (!entry) return '';
    const parts = [
        countPhrase(conditionId, entry.count),
        regionsPhrase(entry) ? `localisation : ${regionsPhrase(entry)}` : '',
        INJURY_CONDITIONS[conditionId].trajectory && TRAJECTORY_PHRASE[entry.trajectory] ? TRAJECTORY_PHRASE[entry.trajectory] : '',
        String(entry.note || '').trim(),
    ].filter(Boolean);
    return parts.length ? `${CONDITION_BY_ID[conditionId].label} : ${parts.join(' ; ')}` : '';
}).filter(Boolean);

/** Mutilations cochées (libellés), sans les codes inconnus. */
export const mutilationLabels = (formData) => asList(formData && formData.injuryMutilations).map((code) => MUTILATION_BY_VALUE[code]).filter(Boolean).map((m) => m.label);
/** Conduite à tenir de chaque mutilation cochée (celles qui en ont une). */
export const mutilationCareSteps = (formData) => asList(formData && formData.injuryMutilations).map((code) => MUTILATION_BY_VALUE[code]).filter((m) => m && m.care).map((m) => `${m.label} : ${m.care}`);

/** Résumé en une phrase des blessures, mutilations et précisions (texte des rapports et de Pilou) ; '' si rien n'est renseigné. */
export const injurySummary = (formData) => {
    const lines = injuryLines(formData);
    const mutilations = mutilationLabels(formData);
    const note = String((formData && formData.injuryNote) || '').trim();
    return [
        lines.join(' ; '),
        mutilations.length ? `mutilation(s) : ${mutilations.map(lowerFirst).join(', ')}` : '',
        note,
    ].filter(Boolean).join(' ; ');
};
