// src/clinical/manual.js
//
// MANUEL MÉDICAL de Pilou (Boîte à outils → Pilou → Manuel médical) : la formation de base du soignant, écrite pour le jeu de rôle — des phrases simples, des gestes concrets, des schémas.
// Deux sortes de chapitres :
//   • rédigés ici (bilan, gestes, grandes familles d'urgences, médicaments, jouer la scène) ;
//   • GÉNÉRÉS à partir des données de Pilou (fiches réflexes par motif, référentiel des médicaments, constantes par âge) : le manuel dit donc toujours la même chose que l'aide à la prise en charge.
// Un chapitre = { id, title, icon, intro, sections: [{ id, title, conditions?: [motifs traités], blocks: [...] }] }.
// Blocs : p (paragraphe), list, steps (liste numérotée), table { head, rows }, figure { id, caption } (schémas : components/Pilou/ManualFigures.js), tip (à retenir), warn (piège), rp (exemples en jeu).
// À TENIR À JOUR : tout nouveau motif de conditions.js doit être cité dans la section rédigée qui en parle (`conditions`) — un test le vérifie. Pur (ni React ni Firebase).
import { CONDITIONS, CONDITION_GROUPS } from './conditions';
import { PATHWAYS } from './pathways';
import { PROTOCOLS } from './protocols';
import { MEDICATIONS, MEDICATION_BY_ID } from './medications';
import { AGE_BANDS, SEVERITIES } from './vitals';

const P = (text) => ({ type: 'p', text });
const L = (items) => ({ type: 'list', items });
const S = (items) => ({ type: 'steps', items });
const T = (head, rows) => ({ type: 'table', head, rows });
const F = (id, caption) => ({ type: 'figure', id, caption });
const TIP = (text) => ({ type: 'tip', text });
const WARN = (text) => ({ type: 'warn', text });
const RP = (lines) => ({ type: 'rp', lines });

// ───────────── Chapitres rédigés ─────────────
const WRITTEN = [
    {
        id: 'debuter', title: 'Bien débuter', icon: 'fa-compass',
        intro: "Ce qu'il faut avoir en tête avant de toucher un patient : la logique d'une prise en charge, la sécurité, la gravité.",
        sections: [
            {
                id: 'mode-emploi', title: 'Comment utiliser ce manuel',
                blocks: [
                    P("Ce manuel est écrit pour jouer un soignant crédible sans avoir fait d'études de médecine. Il explique quoi regarder, quoi faire et dans quel ordre, avec des mots simples. Il ne remplace ni une formation réelle ni l'avis d'un médecin : c'est un support de jeu de rôle."),
                    L([
                        "Les premiers chapitres donnent la méthode : le bilan, puis les gestes de base. À lire en premier.",
                        "Les chapitres suivants reprennent les grandes familles d'urgences, avec ce qu'il faut comprendre et les pièges.",
                        "Les « Fiches réflexes » donnent, motif par motif, la conduite à tenir pas à pas : ce sont les mêmes étapes que dans l'aide à la prise en charge.",
                        "La recherche en haut à gauche retrouve un mot dans tout le manuel.",
                    ]),
                    TIP("En cas de doute pendant une scène : revenez au bilan A B C D E. Il donne toujours la prochaine chose à faire."),
                ],
            },
            {
                id: 'six-temps', title: "Les six temps d'une prise en charge",
                blocks: [
                    P("Toutes les prises en charge suivent le même fil. L'aide à la prise en charge de Pilou range ses étapes dans ces six temps, et le suivi pas à pas vous dit où vous en êtes."),
                    F('phases', "Les six temps, toujours dans cet ordre."),
                    S([
                        "Premier regard : se protéger, se présenter, bilan A B C D E, constantes, matériel.",
                        "Gestes immédiats : ce qui menace la vie ou le membre est traité tout de suite, avant le diagnostic.",
                        "Examen et bilan : interroger, examiner, demander les examens.",
                        "Traitement : gestes de soin et médicaments.",
                        "Surveillance : recontrôler, guetter les signes d'alerte.",
                        "Orientation et suites : sortie, hospitalisation ou bloc ; transmissions et rapport.",
                    ]),
                    WARN("L'erreur classique est de sauter au traitement (« je lui donne un antalgique ») sans avoir fait le premier regard. Un patient qui parle n'est pas forcément un patient qui va bien."),
                ],
            },
            {
                id: 'securite', title: 'Se protéger, respecter le patient',
                blocks: [
                    L([
                        "Sécurité d'abord : un soignant blessé ne soigne plus personne. Scène dangereuse (arme, incendie, agresseur) : on attend qu'elle soit sécurisée.",
                        "Gants avant tout contact, masque et lunettes s'il y a du sang ou des projections ; on change de gants entre deux patients.",
                        "On se présente, on explique chaque geste, on demande l'accord du patient conscient. Un patient inconscient en danger est soigné sans attendre.",
                        "Secret médical : ce que l'on apprend ne se répète qu'aux soignants qui en ont besoin. Les forces de l'ordre n'ont accès qu'à ce que la loi prévoit (plaie par arme à feu à déclarer, par exemple).",
                        "On note les heures : arrivée, garrot, injections, changement d'état. Elles serviront aux transmissions et au rapport.",
                    ]),
                    RP(["/me enfile une paire de gants et s'accroupit près du patient.", "« Bonjour, je suis soignant au PHMC. Je vais m'occuper de vous, dites-moi ce qui s'est passé. »"]),
                ],
            },
            {
                id: 'gravite', title: 'Estimer la gravité',
                blocks: [
                    P("La gravité se décide en quelques secondes, puis se révise à chaque réévaluation. Dans Pilou, elle règle les constantes attendues, les médicaments proposés et l'orientation."),
                    T(['Gravité', 'Ce que l\'on voit', 'Ce que l\'on fait'], [
                        ['Légère', "Patient debout ou assis, parle normalement, constantes normales, douleur supportable.", "Soins sur place, sortie avec des consignes."],
                        ['Modérée', "Douleur franche, constantes un peu perturbées, patient fatigué mais stable.", "Soins complets, examens, surveillance d'une à quelques heures."],
                        ['Sévère', "Constantes nettement anormales, patient pâle, en sueurs, somnolent ou très essoufflé.", "Renfort, scope, voie veineuse, hospitalisation ou bloc."],
                        ['Critique', "Détresse vitale : inconscient, ne respire plus bien, tension effondrée, hémorragie massive.", "Déchocage, équipe complète, gestes de réanimation immédiats."],
                    ]),
                    TIP("Trois questions suffisent pour un premier tri : est-il conscient ? respire-t-il bien ? saigne-t-il beaucoup ? Un seul « non » ou « oui » inquiétant = gravité sévère au minimum."),
                ],
            },
        ],
    },
    {
        id: 'bilan', title: 'Le bilan du patient', icon: 'fa-clipboard-list',
        intro: "Regarder, mesurer, interroger : la méthode qui évite d'oublier quelque chose.",
        sections: [
            {
                id: 'abcde', title: 'Le bilan primaire A B C D E',
                blocks: [
                    P("Cinq lettres, toujours dans le même ordre, parce que ce qui tue le plus vite est examiné en premier. On traite chaque problème dès qu'on le trouve, puis on continue."),
                    F('abcde', "A B C D E : on ne passe à la lettre suivante qu'une fois la précédente réglée."),
                    T(['Lettre', 'Ce que l\'on vérifie', 'Si ça ne va pas'], [
                        ['A – Voies aériennes', "Le patient parle ? Bruit de gargouillis ou de ronflement ? Bouche libre ?", "Bascule de la tête, aspiration, canule ; cou maintenu en cas de traumatisme."],
                        ['B – Respiration', "Fréquence, amplitude, saturation, auscultation des deux côtés, couleur des lèvres.", "Oxygène, position assise, traitement de la cause (asthme, pneumothorax…)."],
                        ['C – Circulation', "Pouls, tension, pâleur, sueurs, saignement, temps de recoloration de l'ongle (normal : moins de 3 secondes).", "Compression d'une hémorragie, voie veineuse, remplissage."],
                        ['D – Conscience', "Score de Glasgow, pupilles, glycémie, force des quatre membres.", "Sucre si glycémie basse, position latérale de sécurité, protection des voies aériennes."],
                        ['E – Exposition', "On déshabille pour tout voir : plaies cachées, éruption, déformation, dos compris.", "On traite, puis on couvre : un patient découvert se refroidit vite."],
                    ]),
                    RP(["/me observe la respiration du patient, pose deux doigts sur son poignet et compte le pouls.", "/do Le patient respire-t-il normalement ? Répond-il quand on lui parle ?"]),
                ],
            },
            {
                id: 'constantes', title: 'Les constantes vitales',
                blocks: [
                    P("Six mesures résument l'état d'un patient : fréquence cardiaque (FC), pression artérielle (PA), fréquence respiratoire (FR), saturation en oxygène (SpO2), température et glycémie. Leurs valeurs normales changent avec l'âge : un nourrisson a un cœur deux fois plus rapide qu'un adulte."),
                    { type: 'vitalsTable' },
                    T(['Mesure', 'Normal chez l\'adulte', 'Inquiétant'], [
                        ['Saturation (SpO2)', '95 à 100 %', "Sous 94 % : oxygène. Sous 90 % : détresse."],
                        ['Température', '36,5 à 37,5 °C', "Au-dessus de 38 °C : fièvre. Sous 35 °C : hypothermie. Au-dessus de 40 °C : urgence."],
                        ['Glycémie', '0,70 à 1,10 g/L à jeun', "Sous 0,70 : hypoglycémie. Au-dessus de 2,50 avec soif et nausées : rechercher une acidocétose."],
                        ['Tension', 'autour de 120/80 mmHg', "Systolique sous 90 : choc possible. Au-dessus de 180 avec maux de tête ou douleur : urgence."],
                    ]),
                    TIP("Une constante isolée ne dit pas tout : c'est son évolution qui compte. Un pouls qui passe de 90 à 130 en un quart d'heure doit faire chercher un saignement, même si la tension tient encore."),
                ],
            },
            {
                id: 'glasgow', title: 'Le score de Glasgow',
                blocks: [
                    P("Il mesure la conscience sur 15 points, en additionnant trois réponses. On le note avec l'heure et on le répète : une baisse de 2 points est une alerte."),
                    T(['Points', 'Ouverture des yeux (Y)', 'Réponse verbale (V)', 'Réponse motrice (M)'], [
                        ['6', '—', '—', 'Obéit aux ordres'],
                        ['5', '—', 'Orientée, cohérente', 'Repousse la main qui fait mal'],
                        ['4', 'Spontanée', 'Confuse', 'Retire le membre'],
                        ['3', 'À la voix', 'Mots sans suite', 'Flexion anormale des bras'],
                        ['2', 'À la douleur', 'Sons incompréhensibles', 'Extension anormale'],
                        ['1', 'Aucune', 'Aucune', 'Aucune'],
                    ]),
                    P("Les tirets « — » sont normaux : chaque réponse a son propre maximum. Les yeux vont de 1 à 4, la réponse verbale de 1 à 5 et la réponse motrice de 1 à 6. Le score est la somme des trois : au minimum 3 (Y1 + V1 + M1), au maximum 15 (Y4 + V5 + M6). On ne descend jamais à 0."),
                    TIP("On l'écrit en détaillant les trois chiffres, par exemple « Glasgow 13 (Y3 V4 M6) » : une baisse de la réponse motrice n'a pas la même gravité qu'une baisse de l'ouverture des yeux."),
                    L(["15 : conscience normale.", "13 ou 14 : confusion légère, à surveiller.", "9 à 12 : conscience altérée, surveillance rapprochée.", "8 ou moins : coma — le patient ne protège plus ses voies aériennes, intubation à prévoir."]),
                ],
            },
            {
                id: 'pupilles', title: 'Les pupilles',
                blocks: [
                    F('pupils', "Les quatre aspects à reconnaître avec une lampe stylo."),
                    L([
                        "Normales : égales, rondes, elles se resserrent à la lumière.",
                        "Serrées « en tête d'épingle » : opioïdes (héroïne, fentanyl, morphine) jusqu'à preuve du contraire.",
                        "Dilatées des deux côtés : stimulants, manque d'oxygène, arrêt cardiaque prolongé.",
                        "Inégales : après un choc à la tête, une pupille dilatée d'un seul côté est une urgence neurochirurgicale.",
                    ]),
                ],
            },
            {
                id: 'douleur', title: 'Évaluer la douleur',
                blocks: [
                    P("On demande au patient de noter sa douleur de 0 (aucune) à 10 (la pire imaginable). Le chiffre guide le choix de l'antalgique, et se redemande 30 minutes après pour savoir si le traitement marche."),
                    F('pain-scale', "L'échelle de 0 à 10 et le traitement qui correspond."),
                    T(['Note', 'Douleur', 'Antalgique'], [
                        ['1 à 3', 'Légère', 'Paracétamol'],
                        ['4 à 6', 'Modérée', 'Paracétamol + anti-inflammatoire, ou tramadol'],
                        ['7 à 10', 'Intense', 'Morphine ou fentanyl titrés, par voie veineuse'],
                    ]),
                    WARN("Soulager ne gêne pas le diagnostic. Laisser souffrir un patient « pour ne pas masquer les signes » est une idée fausse."),
                ],
            },
            {
                id: 'interrogatoire', title: "L'interrogatoire",
                blocks: [
                    P("Quelques questions, toujours les mêmes, posées au patient ou aux témoins. Les réponses orientent le diagnostic et évitent les accidents de traitement (allergie, interaction)."),
                    T(['Question', 'Ce que l\'on cherche'], [
                        ['Signes', "Que ressentez-vous ? Où ? Depuis quand ?"],
                        ['Allergies', "Médicaments, aliments, latex, piqûres d'insecte."],
                        ['Médicaments', "Traitements habituels, surtout anticoagulants, insuline, traitements du cœur."],
                        ['Passé médical', "Maladies connues, opérations, hospitalisations récentes."],
                        ['Dernier repas', "Heure du dernier repas ou de la dernière boisson (utile avant un bloc)."],
                        ['Événement', "Que faisiez-vous ? Chute, effort, dispute, produit pris ?"],
                    ]),
                    P("Pour une douleur, on précise : comment elle a commencé, ce qui la calme ou l'aggrave, à quoi elle ressemble (serrement, brûlure, coup de poignard), où elle irradie, son intensité sur 10 et depuis combien de temps elle dure."),
                    RP(["« Vous avez des allergies ? Vous prenez des médicaments tous les jours ? »", "/me note les réponses sur sa tablette."]),
                ],
            },
        ],
    },
    {
        id: 'gestes', title: 'Les gestes de base', icon: 'fa-hand-holding-medical',
        intro: "Les gestes que tout soignant doit savoir faire, expliqués pas à pas.",
        sections: [
            {
                id: 'pls', title: 'La position latérale de sécurité',
                blocks: [
                    P("Pour tout patient inconscient qui respire : sur le dos, sa langue et ses vomissements peuvent l'étouffer. Sur le côté, la bouche se vide toute seule."),
                    S([
                        "S'agenouiller à côté du patient, retirer ses lunettes, aligner ses jambes.",
                        "Placer le bras le plus proche à angle droit, paume vers le haut.",
                        "Ramener l'autre main contre l'oreille du patient, côté sauveteur, et la maintenir.",
                        "Relever le genou opposé, puis faire rouler le patient vers soi en tirant sur ce genou.",
                        "Ajuster la jambe du dessus à angle droit, ouvrir la bouche vers le sol.",
                        "Couvrir, et recontrôler la respiration chaque minute.",
                    ]),
                    WARN("Traumatisme possible du cou ou du dos : on retourne le patient en bloc, à plusieurs, en gardant la tête, le cou et le tronc alignés."),
                ],
            },
            {
                id: 'voies-aeriennes', title: 'Libérer les voies aériennes',
                blocks: [
                    L([
                        "Bascule prudente de la tête en arrière avec élévation du menton : elle décolle la langue du fond de la gorge.",
                        "Après un traumatisme : on pousse la mâchoire vers l'avant, sans bouger le cou.",
                        "Aspiration des sécrétions, du sang ou des vomissements ; retrait d'un corps étranger visible.",
                        "Canule dans la bouche chez le patient inconscient, pour empêcher la langue de retomber.",
                        "Étouffement par un aliment, patient conscient qui ne peut plus parler : 5 claques dans le dos, puis 5 compressions abdominales, en alternance.",
                    ]),
                    TIP("Un patient qui parle a des voies aériennes libres. Un patient qui ronfle ou gargouille a des voies aériennes encombrées."),
                ],
            },
            {
                id: 'oxygene', title: "Donner de l'oxygène",
                blocks: [
                    T(['Matériel', 'Débit', 'Pour qui'], [
                        ['Lunettes nasales', '1 à 4 L/min', "Gêne légère, saturation entre 90 et 94 %."],
                        ['Masque simple', '5 à 8 L/min', "Besoin modéré."],
                        ['Masque à haute concentration', '10 à 15 L/min', "Détresse, traumatisme grave, intoxication aux fumées, état de choc."],
                        ['Ballon et masque', '15 L/min', "Patient qui ne respire plus ou plus assez : c'est le soignant qui ventile."],
                    ]),
                    P("L'objectif est une saturation entre 94 et 98 %. On n'en donne pas « par principe » à un patient qui sature bien, sauf en cas d'intoxication aux fumées, où l'appareil de mesure est faussé."),
                ],
            },
            {
                id: 'hemorragie', title: 'Arrêter une hémorragie',
                blocks: [
                    S([
                        "Comprimer directement la plaie avec des compresses, fort, sans relâcher pendant 10 minutes.",
                        "Poser un pansement compressif par-dessus, sans retirer le premier.",
                        "Si le sang traverse encore sur un membre : garrot, 5 à 7 cm au-dessus de la plaie, jamais sur une articulation, serré jusqu'à l'arrêt du saignement.",
                        "Écrire l'heure de pose, bien visible ; ne plus desserrer.",
                        "Allonger le patient, le couvrir, poser une voie veineuse.",
                    ]),
                    F('tourniquet', "Le garrot se pose au-dessus de la plaie, sur un seul os si possible (bras, cuisse)."),
                    WARN("Les zones où le garrot est impossible (cou, aisselle, pli de l'aine) se traitent par compression manuelle et pansement hémostatique tassé dans la plaie."),
                ],
            },
            {
                id: 'rcp', title: 'Le massage cardiaque',
                conditions: [],
                blocks: [
                    P("Un patient inconscient qui ne respire pas, ou qui respire par à-coups bruyants et rares, est en arrêt cardiaque. Chaque minute sans massage fait perdre environ 10 % de chances de survie."),
                    F('chain', "La chaîne de survie : chaque maillon compte."),
                    F('rcp', "Position des mains et repères du massage."),
                    T(['', 'Adulte', 'Enfant', 'Nourrisson'], [
                        ['Appui', 'Deux mains, centre du thorax', 'Une main', 'Deux doigts ou deux pouces'],
                        ['Profondeur', '5 à 6 cm', 'Un tiers du thorax (environ 5 cm)', 'Un tiers du thorax (environ 4 cm)'],
                        ['Rythme', '100 à 120 par minute', '100 à 120 par minute', '100 à 120 par minute'],
                        ['Alternance', '30 compressions, 2 insufflations', '15 compressions, 2 insufflations', '15 compressions, 2 insufflations'],
                    ]),
                    TIP("On change de masseur toutes les 2 minutes : après, la fatigue rend le massage inefficace sans que l'on s'en rende compte."),
                    RP(["/me place ses mains au centre du thorax, bras tendus, et commence le massage cardiaque en comptant à voix haute.", "« Un, deux, trois… Préparez le défibrillateur ! »"]),
                ],
            },
            {
                id: 'defibrillateur', title: 'Le défibrillateur',
                blocks: [
                    S([
                        "Allumer l'appareil et suivre ses consignes vocales.",
                        "Dénuder et sécher le thorax ; coller une électrode sous la clavicule droite, l'autre sur le côté gauche, sous l'aisselle (voir le schéma).",
                        "Ne plus toucher le patient pendant l'analyse.",
                        "Choc conseillé : tout le monde s'écarte, on appuie sur le bouton.",
                        "Reprendre le massage immédiatement, sans chercher le pouls, pendant 2 minutes jusqu'à la prochaine analyse.",
                    ]),
                    F('defib-pads', "Placement des électrodes : position habituelle de l'adulte, et variante antéro-postérieure."),
                    L([
                        "Peau sèche : on essuie la sueur, l'eau ou le sang ; on rase les poils s'il y en a beaucoup, sans perdre de temps.",
                        "Patch de médicament (nitré, nicotine) sur la zone : on le retire et on essuie.",
                        "Stimulateur cardiaque ou défibrillateur implanté (bosse sous la clavicule, souvent à gauche) : électrode à au moins 8 cm de la bosse.",
                        "Femme : l'électrode latérale se place sous le sein, jamais dessus.",
                        "Les électrodes ne se chevauchent pas et ne se touchent pas.",
                    ]),
                    P("Le choc n'est utile que sur un cœur qui « tremble » (fibrillation). Sur un tracé plat, l'appareil ne proposera pas de choc : seul le massage et l'adrénaline comptent."),
                ],
            },
            {
                id: 'electrodes-ecg', title: "Poser les électrodes de l'ECG",
                blocks: [
                    P("Un électrocardiogramme complet utilise dix électrodes : six sur le thorax (V1 à V6) et quatre sur les membres. Pour un simple scope, trois électrodes suffisent (épaule droite, épaule gauche, bas du ventre à gauche) : on surveille le rythme, mais on ne peut pas chercher un infarctus."),
                    F('ecg-leads', "Les dix électrodes : V1 à V6 sur le thorax, quatre sur les membres (code de couleur européen)."),
                    L([
                        "On repère d'abord le creux sous la clavicule, puis on descend en comptant les espaces entre les côtes : le 4e espace est à peu près au niveau du bas du sternum.",
                        "V1 et V2 se posent de part et d'autre du sternum, dans le même espace ; V4 sous le milieu de la clavicule gauche ; V3 entre V2 et V4 ; V5 et V6 sur la même ligne horizontale que V4.",
                        "Une électrode mal placée change le tracé : un V1 et un V2 posés trop haut imitent une anomalie qui n'existe pas.",
                        "Sur une femme, V3 à V6 se posent sous le sein, jamais dessus.",
                        "Les électrodes des membres se posent sur les poignets et les chevilles, ou à la racine des membres si le patient bouge (urgence). Le patient doit rester immobile et détendu pendant l'enregistrement.",
                    ]),
                    TIP("Pour retenir les couleurs des membres, on tourne dans le sens des aiguilles d'une montre en partant du bras droit : rouge, jaune, vert, noir."),
                    RP(["/me essuie la peau du thorax, repère l'espace entre les côtes et colle les six électrodes du thorax une à une.", "/me fixe les quatre électrodes des membres et lance l'enregistrement."]),
                ],
            },
            {
                id: 'voie-veineuse', title: 'Voie veineuse et injections',
                blocks: [
                    S([
                        "Garrot au bras, repérage d'une veine droite et souple (pli du coude, dos de la main).",
                        "Désinfection, ponction biseau vers le haut, reflux de sang dans le cathéter.",
                        "Retrait de l'aiguille, branchement de la perfusion, fixation, retrait du garrot.",
                        "Vérifier que la perfusion coule et que le bras ne gonfle pas.",
                    ]),
                    { type: 'heading', text: 'Choisir le cathéter veineux (canule IV)' },
                    P("Le calibre du cathéter se choisit selon ce que l'on veut passer et selon la veine. Il est repéré par un chiffre en gauge (G) et par une couleur normalisée, la même chez tous les fabricants. Le chiffre est l'inverse de la taille : plus il est petit, plus le cathéter est gros."),
                    F('cannulas', "Les sept calibres courants : couleur, diamètre, débit maximal et usage."),
                    T(['Calibre', 'Couleur', 'Diamètre ext.', 'Débit max.', 'Utilisation'], [
                        ['26 G', 'Violet', '0,6 mm', '19 mL/min', 'Nouveau-nés, bébés'],
                        ['24 G', 'Jaune', '0,7 mm', '22 mL/min', 'Enfants, veines fragiles'],
                        ['22 G', 'Bleu', '0,9 mm', '35 mL/min', 'Petites veines, perfusion simple'],
                        ['20 G', 'Rose', '1,1 mm', '60 mL/min', 'Le quotidien : perfusion, antibiotique'],
                        ['18 G', 'Vert', '1,3 mm', '105 mL/min', 'Remplissage, transfusion'],
                        ['16 G', 'Gris', '1,7 mm', '210 mL/min', 'Remplissage rapide'],
                        ['14 G', 'Orange', '2,1 mm', '345 mL/min', 'Urgence vitale, choc hémorragique'],
                    ]),
                    L([
                        "Loi de Poiseuille : si le diamètre double, le débit est multiplié par 16 (en théorie). C'est pourquoi un 14 G débite environ 18 fois plus qu'un 26 G (345 contre 19 mL/min).",
                        "La longueur compte aussi : à diamètre égal, un cathéter court débite plus vite qu'un long.",
                        "Perfusion simple ou antibiotique chez l'adulte : 20 G (rose) ou 22 G (bleu).",
                        "Choc, hémorragie, polytraumatisé : deux voies de gros calibre, 16 G (gris) ou 14 G (orange), au pli du coude.",
                        "Enfant, nourrisson, personne âgée aux veines fragiles : 24 G (jaune), voire 22 G.",
                        "Le calibre doit aussi convenir à la veine : un gros cathéter se pose dans une grosse veine (pli du coude), un petit dans le dos de la main.",
                        "Impossible de trouver une veine chez un patient en arrêt ou en choc : voie intra-osseuse.",
                    ]),
                    TIP("On pose le cathéter le plus gros que la veine accepte quand il faut remplir vite, et le plus petit suffisant sinon : il abîme moins la veine et gêne moins le patient."),
                    { type: 'heading', text: "Les voies d'injection" },
                    F('injection', "L'angle de l'aiguille dépend de la voie."),
                    T(['Voie', 'Où', 'Effet'], [
                        ['Intraveineuse (IV)', 'Dans la veine', 'Immédiat ; voie de l\'urgence.'],
                        ['Intramusculaire (IM)', 'Cuisse ou épaule', 'En 5 à 15 minutes ; adrénaline de l\'allergie, sédation.'],
                        ['Sous-cutanée (SC)', 'Sous la peau du ventre ou du bras', 'Lent ; insuline, anticoagulants.'],
                        ['Par la bouche (PO)', 'Avalé', 'En 30 à 60 minutes ; patient conscient qui avale.'],
                        ['Sous la langue (SL)', 'Fond sous la langue', 'En quelques minutes ; trinitrine.'],
                        ['Nébulisation', 'Masque avec brouillard', 'Agit directement sur les bronches.'],
                    ]),
                    WARN("Pas de voie veineuse possible chez un patient en arrêt ou en choc : on passe à la voie intra-osseuse (dans le tibia), qui s'utilise comme une veine."),
                ],
            },
            {
                id: 'pansement-suture', title: 'Laver, suturer, panser',
                blocks: [
                    S([
                        "Laver la plaie au sérum physiologique, abondamment : c'est le lavage qui évite l'infection, plus que l'antiseptique.",
                        "Explorer le fond : corps étranger, tendon, articulation.",
                        "Anesthésier les berges à la lidocaïne et attendre quelques minutes.",
                        "Rapprocher les bords : points séparés, colle pour les petites plaies nettes, strips pour les plaies superficielles.",
                        "Couvrir d'un pansement sec, vérifier le rappel antitétanique, expliquer les signes d'infection.",
                    ]),
                    L(["Fils retirés à J5 sur le visage, J7 à J10 sur le corps, J14 sur une articulation.", "On ne ferme pas : une morsure, une plaie très sale, une plaie de plus de 24 heures."]),
                ],
            },
            {
                id: 'immobilisation', title: 'Immobiliser',
                blocks: [
                    L([
                        "Une fracture s'immobilise avec les articulations au-dessus et en dessous.",
                        "On contrôle le pouls, la sensibilité et la mobilité en aval avant et après la pose.",
                        "Collier cervical et matelas coquille dès qu'un traumatisme du cou ou du dos est possible : chute de haut, accident de la route, plongeon.",
                        "Ceinture pelvienne pour un bassin douloureux après un choc violent.",
                        "Écharpe pour l'épaule et le bras, attelle rigide pour l'avant-bras, la jambe et la cheville.",
                    ]),
                    TIP("Un membre immobilisé qui devient froid, bleu, engourdi ou de plus en plus douloureux : l'attelle serre trop ou un vaisseau est comprimé. On desserre et on recontrôle."),
                ],
            },
        ],
    },
    {
        id: 'trauma', title: 'Traumatologie', icon: 'fa-bone',
        intro: "Plaies, fractures, brûlures, chocs violents : ce qu'il faut comprendre et les pièges à éviter.",
        sections: [
            {
                id: 'plaies', title: 'Plaies et saignements', conditions: ['plaie_superficielle', 'plaie_profonde', 'hemorragie_externe'],
                blocks: [
                    P("Devant une plaie, trois questions : est-ce que ça saigne encore ? Qu'y a-t-il dessous (tendon, nerf, vaisseau, articulation) ? Est-elle propre ? La réponse décide entre une suture simple aux urgences et le bloc opératoire."),
                    L([
                        "Saignement en jet, rouge vif : artère. Saignement sombre, en nappe : veine. Dans les deux cas, on comprime.",
                        "Un doigt qui ne plie plus ou une zone de peau insensible en aval : tendon ou nerf coupé, le chirurgien doit voir la plaie.",
                        "Toute plaie par morsure s'infecte facilement : lavage, antibiotique, pas de fermeture.",
                        "Rappel antitétanique à vérifier pour toute plaie.",
                    ]),
                    WARN("Une petite plaie peut cacher une grosse lésion : une plaie de 1 cm dans le thorax, l'abdomen ou le cou est grave jusqu'à preuve du contraire."),
                ],
            },
            {
                id: 'fractures', title: 'Fractures, entorses et luxations', conditions: ['fracture_fermee', 'fracture_ouverte', 'entorse_luxation'],
                blocks: [
                    P("Une fracture est un os cassé ; une luxation, une articulation déboîtée ; une entorse, des ligaments étirés ou déchirés. Les signes se ressemblent : douleur, gonflement, impossibilité d'utiliser le membre. La radiographie tranche."),
                    L([
                        "Fracture fermée : la peau est intacte. Fracture ouverte : une plaie communique avec l'os — c'est une urgence chirurgicale, avec antibiotique dans l'heure.",
                        "On ne tente pas de remettre un os en place sur le terrain, sauf si le membre est froid et sans pouls : on le réaligne alors doucement.",
                        "Une fracture du fémur ou du bassin peut faire perdre plus d'un litre de sang sans une goutte visible.",
                        "Syndrome des loges : douleur qui augmente malgré l'immobilisation, muscle dur comme du bois, doigts engourdis. Urgence chirurgicale.",
                    ]),
                    TIP("Les quatre contrôles en aval d'un membre blessé : pouls, chaleur, sensibilité, mobilité."),
                ],
            },
            {
                id: 'brulures', title: 'Brûlures', conditions: ['brulure'],
                blocks: [
                    P("La gravité d'une brûlure dépend de sa surface, de sa profondeur, de sa localisation et de l'âge du patient. Le premier geste est toujours le même : refroidir à l'eau tempérée pendant 15 à 20 minutes."),
                    F('rule-of-nines', "La règle des neuf : chaque zone vaut 9 % de la surface du corps (ou un multiple). La paume du patient vaut 1 %."),
                    F('burn-depth', "Plus la brûlure est profonde, moins elle fait mal : les nerfs sont détruits."),
                    T(['Degré', 'Aspect', 'Douleur', 'Évolution'], [
                        ['1er', 'Rougeur, comme un coup de soleil', 'Oui', 'Guérit en quelques jours'],
                        ['2e superficiel', 'Cloques, fond rose et humide', 'Très forte', 'Guérit en 10 à 14 jours'],
                        ['2e profond', 'Cloques, fond pâle', 'Moins forte', 'Greffe souvent nécessaire'],
                        ['3e', 'Blanc, brun ou noir, cartonné', 'Aucune', 'Ne guérit pas seul : chirurgie'],
                    ]),
                    WARN("Grave d'emblée : plus de 15 % de surface chez l'adulte (10 % chez l'enfant), visage, mains, pieds, organes génitaux, brûlure qui fait le tour d'un membre, brûlure électrique ou chimique, fumées inhalées."),
                ],
            },
            {
                id: 'crane', title: 'Traumatisme crânien', conditions: ['trauma_cranien'],
                blocks: [
                    P("Après un choc à la tête, le danger est le saignement à l'intérieur du crâne, qui peut se révéler plusieurs heures plus tard. D'où la surveillance répétée de la conscience et des pupilles."),
                    L([
                        "Signes d'alerte : perte de connaissance, somnolence, vomissements répétés, mal de tête qui augmente, convulsion, comportement inhabituel, pupilles inégales.",
                        "Le scanner est demandé au moindre signe d'alerte, chez le patient sous anticoagulants et chez la personne âgée.",
                        "Tout traumatisme crânien violent est aussi un traumatisme du cou jusqu'à preuve du contraire.",
                    ]),
                    TIP("L'intervalle libre : le patient va bien après le choc, puis se dégrade une à plusieurs heures plus tard. C'est le signe typique d'un hématome qui grossit."),
                ],
            },
            {
                id: 'thorax', title: 'Traumatisme du thorax', conditions: ['trauma_thoracique'],
                blocks: [
                    P("Le thorax contient le cœur, les poumons et de gros vaisseaux. Le piège mortel est le pneumothorax compressif : de l'air s'accumule autour du poumon, l'écrase et finit par bloquer le cœur."),
                    F('thorax', "Les deux repères à connaître sur le thorax."),
                    L([
                        "Pneumothorax compressif : détresse respiratoire brutale, un côté du thorax qui ne bouge plus, veines du cou gonflées, tension qui chute. On décomprime à l'aiguille, sans attendre la radiographie.",
                        "Plaie soufflante : on entend l'air passer. Pansement fermé sur trois côtés seulement.",
                        "Volet costal : plusieurs côtes cassées en deux endroits, un morceau de paroi bouge à l'envers. Oxygène et antalgie puissante.",
                    ]),
                ],
            },
            {
                id: 'abdomen', title: "Traumatisme de l'abdomen", conditions: ['trauma_abdominal'],
                blocks: [
                    P("Le ventre peut cacher une hémorragie importante (rate, foie) sans aucun signe extérieur. Le pouls qui s'accélère est souvent le premier signal, bien avant la chute de tension."),
                    L([
                        "Ventre dur, douloureux, qui se défend à la palpation : avis chirurgical.",
                        "L'échographie eFAST au lit du patient cherche du liquide (du sang) dans le ventre en deux minutes.",
                        "Patient stable : scanner. Patient instable avec du sang à l'échographie : bloc opératoire directement.",
                        "On laisse le patient à jeun.",
                    ]),
                ],
            },
            {
                id: 'armes', title: 'Plaies par arme', conditions: ['plaie_arme_feu', 'plaie_arme_blanche'],
                blocks: [
                    P("Très fréquentes en jeu. La règle : ce que l'on voit à la peau ne dit rien de ce qui s'est passé à l'intérieur. Une balle dévie, se fragmente, traverse plusieurs organes ; une lame peut être entrée bien plus loin que la plaie ne le laisse croire."),
                    L([
                        "Sécurité et forces de l'ordre d'abord. Toute plaie par arme à feu est déclarée.",
                        "On déshabille entièrement et on retourne le patient : on compte les orifices, dos compris. Un nombre impair d'orifices signifie qu'un projectile est resté à l'intérieur.",
                        "Une arme blanche encore plantée reste en place : elle bouche peut-être un vaisseau. On la cale, le chirurgien la retire.",
                        "Membre : garrot si la compression échoue. Tronc : pas de garrot possible, on comprime, on perfuse, on part au bloc.",
                        "On ne retire pas une balle aux urgences.",
                    ]),
                    RP(["/me découpe les vêtements aux ciseaux et inspecte le dos du patient à la recherche d'un orifice de sortie.", "/do Combien d'impacts sont visibles, et où ?"]),
                ],
            },
            {
                id: 'polytrauma', title: 'Le polytraumatisé', conditions: ['polytraumatisme'],
                blocks: [
                    P("Un polytraumatisé a plusieurs lésions dont une au moins menace sa vie : accident de la route, chute de grande hauteur, explosion. La prise en charge se fait à plusieurs, dans l'ordre A B C D E, sans se laisser distraire par la blessure la plus spectaculaire."),
                    L([
                        "La cause de mort évitable numéro un est l'hémorragie : garrots, ceinture pelvienne, acide tranexamique, bloc.",
                        "La triade létale : froid, sang trop acide, sang qui ne coagule plus. Chacun aggrave les deux autres. On réchauffe dès le début.",
                        "Remplissage modéré : trop de perfusion dilue le sang et relance le saignement.",
                    ]),
                    WARN("La fracture ouverte impressionnante n'est presque jamais ce qui tue. C'est le saignement que l'on ne voit pas."),
                ],
            },
        ],
    },
    {
        id: 'cardio', title: 'Cœur et circulation', icon: 'fa-heart',
        intro: "Douleur dans la poitrine, malaises, arrêt cardiaque, allergie grave.",
        sections: [
            {
                id: 'douleur-thoracique', title: 'La douleur thoracique', conditions: ['sca'],
                blocks: [
                    P("Une douleur dans la poitrine est un infarctus jusqu'à preuve du contraire : une artère du cœur est bouchée, et le muscle meurt minute après minute. Le geste clé est l'électrocardiogramme, dans les dix minutes."),
                    L([
                        "Douleur typique : serrement ou poids derrière le sternum, qui dure plus de 20 minutes, irradie dans le bras gauche ou la mâchoire, avec sueurs et nausées.",
                        "Chez la femme, le diabétique et la personne âgée, la douleur peut manquer : essoufflement, malaise ou simple fatigue brutale.",
                        "Aspirine tôt, trinitrine si la tension le permet, puis désobstruction de l'artère en salle de coronarographie.",
                        "Les autres urgences à ne pas manquer : dissection de l'aorte, embolie pulmonaire, pneumothorax.",
                    ]),
                    TIP("Tout patient avec une douleur thoracique reste scopé : le risque immédiat est le trouble du rythme mortel, que seul le défibrillateur rattrape."),
                ],
            },
            {
                id: 'ecg', title: "Lire un électrocardiogramme, pour débuter", conditions: ['tachyarythmie', 'bradycardie'],
                blocks: [
                    P("L'ECG enregistre l'électricité du cœur. Chaque battement dessine trois ondes : P (les oreillettes se contractent), QRS (les ventricules se contractent), T (le cœur se recharge)."),
                    F('ecg', "Un battement normal, puis les tracés à reconnaître."),
                    T(['Tracé', 'Ce que c\'est', 'Conduite'], [
                        ['Rythme sinusal', 'Régulier, 60 à 100 par minute, une onde P avant chaque QRS', 'Normal.'],
                        ['Tachycardie', 'Plus de 100 par minute', 'Chercher la cause (douleur, fièvre, saignement) ; mal tolérée : choc électrique.'],
                        ['Bradycardie', 'Moins de 50 par minute', 'Atropine si malaise ou tension basse.'],
                        ['Fibrillation ventriculaire', 'Tracé anarchique, sans battement reconnaissable', 'Arrêt cardiaque : massage et choc immédiat.'],
                        ['Asystolie', 'Tracé plat', 'Arrêt cardiaque : massage et adrénaline, pas de choc.'],
                        ['Sus-décalage ST', 'Le trait remonte après le QRS', 'Infarctus en cours : filière d\'urgence.'],
                    ]),
                ],
            },
            {
                id: 'arret', title: "L'arrêt cardiaque", conditions: ['arret_cardiaque'],
                blocks: [
                    P("Le cœur ne pompe plus. Sans massage, le cerveau souffre en moins de cinq minutes. La réanimation suit une boucle de deux minutes, répétée jusqu'à la reprise d'un pouls ou la décision médicale d'arrêter."),
                    F('acr', "La boucle de réanimation : deux minutes de massage, analyse du rythme, et on recommence."),
                    L([
                        "Rythme choquable (fibrillation) : choc, puis massage ; adrénaline et amiodarone après le 3e choc.",
                        "Rythme non choquable (tracé plat) : massage, adrénaline dès que possible puis toutes les 3 à 5 minutes.",
                        "Pendant ce temps, on cherche une cause que l'on peut corriger : manque d'oxygène, hémorragie, froid, pneumothorax, intoxication.",
                    ]),
                    WARN("On ne s'arrête de masser que pour l'analyse du rythme et le choc, et jamais plus de quelques secondes."),
                ],
            },
            {
                id: 'oap-syncope-tension', title: 'Œdème du poumon, malaise et poussée de tension', conditions: ['oap', 'syncope', 'crise_hypertensive'],
                blocks: [
                    L([
                        "Œdème aigu du poumon : le cœur fatigué laisse l'eau envahir les poumons. Le patient étouffe allongé et veut rester assis. On l'assoit, oxygène, dérivé nitré, diurétique. Jamais de remplissage.",
                        "Syncope : perte de connaissance brève avec retour complet. Souvent bénigne (malaise vagal), mais une syncope à l'effort, sans signe avant-coureur ou avec un ECG anormal vient du cœur.",
                        "Poussée de tension : un chiffre élevé seul n'est pas une urgence. Elle le devient s'il y a une douleur thoracique, un essoufflement, un trouble neurologique ou visuel. On ne fait jamais chuter la tension brutalement.",
                    ]),
                ],
            },
            {
                id: 'allergie', title: 'Allergies', conditions: ['anaphylaxie', 'allergie_legere'],
                blocks: [
                    P("La réaction allergique va de la simple plaque qui démange au choc mortel en quelques minutes. La frontière : dès que la respiration, la voix ou la tension sont touchées, c'est une anaphylaxie."),
                    T(['', 'Réaction légère', 'Anaphylaxie'], [
                        ['Peau', 'Plaques, démangeaisons', 'Plaques étendues, visage et lèvres gonflés'],
                        ['Respiration', 'Normale', 'Sifflements, voix rauque, gorge serrée'],
                        ['Circulation', 'Normale', 'Malaise, pouls rapide, tension basse'],
                        ['Traitement', 'Antihistaminique', 'Adrénaline dans la cuisse, tout de suite'],
                    ]),
                    WARN("L'adrénaline est le seul traitement qui sauve. Les corticoïdes et antihistaminiques agissent trop lentement : ils viennent après."),
                ],
            },
        ],
    },
    {
        id: 'respi', title: 'Respiration', icon: 'fa-lungs',
        intro: "Reconnaître un patient qui respire mal et trouver pourquoi.",
        sections: [
            {
                id: 'detresse', title: 'Reconnaître la détresse respiratoire', conditions: ['detresse_respiratoire'],
                blocks: [
                    L([
                        "Fréquence respiratoire au-dessus de 25 par minute chez l'adulte (ou sous 10).",
                        "Tirage : la peau se creuse entre les côtes et au-dessus des clavicules à chaque inspiration.",
                        "Le patient ne finit plus ses phrases, refuse de s'allonger, transpire.",
                        "Lèvres et doigts bleus ; saturation sous 90 %.",
                        "Signes d'épuisement : somnolence, pauses, respiration qui ralentit. L'arrêt est proche.",
                    ]),
                    T(['Ce que l\'on entend', 'Cause probable'], [
                        ['Sifflements à l\'expiration', 'Asthme, allergie'],
                        ['Crépitants (comme du sel dans le feu)', 'Œdème du poumon, pneumonie, noyade'],
                        ['Silence d\'un seul côté', 'Pneumothorax'],
                        ['Bruit aigu à l\'inspiration', 'Obstacle dans la gorge : corps étranger, gonflement'],
                    ]),
                ],
            },
            {
                id: 'asthme', title: "La crise d'asthme", conditions: ['asthme'],
                blocks: [
                    P("Les bronches se resserrent : l'air entre mais sort mal, d'où les sifflements. Le traitement ouvre les bronches (salbutamol en nébulisation) et calme l'inflammation (corticoïde)."),
                    L([
                        "Crise simple : le patient parle par phrases, siffle, sature correctement.",
                        "Crise sévère : il parle par mots, fréquence au-dessus de 30, saturation sous 92 %.",
                        "Crise mortelle : il ne siffle plus (plus assez d'air ne passe), s'épuise, devient confus.",
                    ]),
                    WARN("Un asthmatique qui ne siffle plus et qui s'endort ne va pas mieux : il est en train de s'arrêter."),
                ],
            },
            {
                id: 'infection-respi', title: 'Infections respiratoires', conditions: ['pneumopathie'],
                blocks: [
                    P("Fièvre, toux, crachats et essoufflement évoquent une pneumonie : une partie du poumon est remplie de pus. La radiographie montre une tache blanche. Le traitement est l'antibiotique ; la gravité se juge sur la conscience, la fréquence respiratoire, la tension et l'âge."),
                ],
            },
            {
                id: 'noyade-fumees', title: 'Noyade et fumées', conditions: ['noyade', 'intox_fumees'],
                blocks: [
                    L([
                        "Noyade : le problème est le manque d'oxygène. On commence par ventiler (5 insufflations), on ne cherche pas à « vider l'eau ». Tout noyé est gardé en surveillance : l'œdème du poumon peut apparaître des heures après.",
                        "Fumées d'incendie : deux poisons, le monoxyde de carbone et le cyanure. Oxygène pur immédiatement. L'appareil de saturation affiche un chiffre faussement rassurant.",
                        "Suie autour de la bouche, voix rauque : les voies aériennes sont brûlées et vont gonfler. L'intubation se fait tôt, avant qu'elle ne devienne impossible.",
                    ]),
                ],
            },
        ],
    },
    {
        id: 'neuro', title: 'Cerveau et conscience', icon: 'fa-brain',
        intro: "AVC, convulsions, coma, maux de tête.",
        sections: [
            {
                id: 'avc', title: "L'accident vasculaire cérébral", conditions: ['avc'],
                blocks: [
                    P("Une artère du cerveau se bouche (le plus souvent) ou se rompt. Chaque minute perdue détruit des millions de neurones : c'est une course contre la montre, et l'heure de début des symptômes est l'information la plus importante."),
                    F('fast', "Le test FAST, à faire devant toute faiblesse ou trouble de la parole brutal."),
                    L([
                        "Glycémie d'abord : une hypoglycémie peut donner exactement les mêmes signes.",
                        "Scanner en urgence pour savoir s'il s'agit d'un caillot ou d'un saignement : le traitement est opposé.",
                        "On ne fait pas baisser la tension, on ne donne rien par la bouche.",
                    ]),
                ],
            },
            {
                id: 'convulsions', title: 'Convulsions', conditions: ['convulsions'],
                blocks: [
                    P("Pendant la crise, on ne peut rien arrêter à la main : on protège le patient et on chronomètre. La plupart des crises s'arrêtent seules en moins de trois minutes ; au-delà de cinq, il faut un médicament."),
                    L([
                        "Ne rien mettre dans la bouche, ne pas retenir les membres.",
                        "Après la crise, le patient est confus et épuisé pendant plusieurs minutes : position latérale de sécurité.",
                        "Toujours faire la glycémie.",
                        "Première crise de la vie, crise après un choc à la tête ou crise avec fièvre et nuque raide : scanner et hospitalisation.",
                    ]),
                ],
            },
            {
                id: 'coma', title: 'Le patient inconscient', conditions: ['coma'],
                blocks: [
                    P("Un patient inconscient qui respire est d'abord protégé (voies aériennes, position latérale de sécurité), puis on cherche la cause. Les quatre premières à éliminer : le manque de sucre, les opioïdes, le choc à la tête et l'intoxication."),
                    T(['Indice', 'Fait penser à'], [
                        ['Pupilles serrées, respiration lente', 'Opioïdes : naloxone'],
                        ['Sueurs, patient diabétique', 'Hypoglycémie : sucre'],
                        ['Odeur d\'alcool', 'Ivresse — mais chercher autre chose aussi'],
                        ['Plaie de la tête, pupilles inégales', 'Hématome dans le crâne : scanner'],
                        ['Fièvre, nuque raide, taches violacées', 'Méningite : antibiotique immédiat'],
                        ['Morsure de langue, perte d\'urine', 'Crise d\'épilepsie qui vient de se terminer'],
                    ]),
                ],
            },
            {
                id: 'cephalees', title: 'Maux de tête', conditions: ['migraine'],
                blocks: [
                    P("La plupart des maux de tête sont bénins. Le travail du soignant est de repérer les rares qui ne le sont pas."),
                    L([
                        "Début brutal, « comme un coup de tonnerre », maximal en moins d'une minute : hémorragie autour du cerveau.",
                        "Fièvre avec nuque raide et gêne à la lumière : méningite.",
                        "Faiblesse d'un côté, trouble de la parole ou de la vue : AVC.",
                        "Mal de tête après un choc, ou qui réveille la nuit et s'aggrave de jour en jour.",
                    ]),
                    TIP("Une migraine connue ressemble aux crises précédentes. Une céphalée « pas comme d'habitude » mérite un scanner."),
                ],
            },
        ],
    },
    {
        id: 'intox', title: 'Intoxications et agitation', icon: 'fa-skull-crossbones',
        intro: "Surdoses, alcool, médicaments, patient agité.",
        sections: [
            {
                id: 'approche', title: "L'approche d'un patient intoxiqué",
                blocks: [
                    S([
                        "Sécurité : seringues, produits, patient imprévisible.",
                        "Bilan A B C D E : la plupart des intoxications tuent par la respiration.",
                        "Quatre questions : quel produit, quelle quantité, à quelle heure, avec quoi d'autre ?",
                        "Récupérer les emballages et les montrer au médecin.",
                        "Glycémie, ECG, température pour tout le monde.",
                        "Prise volontaire : le patient ne repart pas sans avis psychiatrique.",
                    ]),
                    WARN("On ne fait jamais vomir. Le charbon activé ne se donne que dans l'heure qui suit la prise, à un patient bien réveillé."),
                ],
            },
            {
                id: 'toxidromes', title: 'Reconnaître le produit aux signes', conditions: ['surdose_opioides', 'surdose_benzo', 'surdose_stimulants', 'intox_alcool'],
                blocks: [
                    T(['Produit', 'Pupilles', 'Respiration', 'Cœur', 'Comportement', 'Traitement clé'], [
                        ['Opioïdes (héroïne, fentanyl)', 'Très serrées', 'Lente, pauses', 'Lent', 'Somnolence, coma', 'Ventiler, naloxone'],
                        ['Sédatifs (benzodiazépines)', 'Normales', 'Un peu lente', 'Normal', 'Somnolence, parole pâteuse', 'Surveiller, oxygène'],
                        ['Stimulants (cocaïne, amphétamines)', 'Dilatées', 'Rapide', 'Rapide, tension haute', 'Agitation, sueurs, fièvre', 'Benzodiazépine, refroidir'],
                        ['Alcool', 'Normales', 'Normale à lente', 'Rapide', 'Désinhibition puis somnolence', 'Protéger, glycémie, surveiller'],
                    ]),
                    TIP("La naloxone agit moins longtemps que les opioïdes : un patient réveillé peut se rendormir et arrêter de respirer une heure plus tard. On le garde."),
                ],
            },
            {
                id: 'antidotes', title: 'Médicaments et antidotes', conditions: ['intox_paracetamol'],
                blocks: [
                    T(['Toxique', 'Antidote', 'À savoir'], [
                        ['Opioïdes', 'Naloxone', 'Par petites doses, jusqu\'à une respiration efficace.'],
                        ['Paracétamol', 'N-acétylcystéine', 'Le patient va bien les premières heures ; le foie lâche à partir du 2e jour sans traitement.'],
                        ['Benzodiazépines', 'Flumazénil', 'Rarement utilisé : peut déclencher des convulsions.'],
                        ['Fumées d\'incendie (cyanure)', 'Hydroxocobalamine', 'Colore la peau et les urines en rouge, c\'est normal.'],
                        ['Monoxyde de carbone', 'Oxygène pur', 'Caisson hyperbare dans les cas graves.'],
                        ['Insuline, hypoglycémiants', 'Glucose, glucagon', 'Recontrôler la glycémie pendant plusieurs heures.'],
                    ]),
                ],
            },
            {
                id: 'agitation', title: 'Le patient agité', conditions: ['agitation'],
                blocks: [
                    P("L'agitation est un symptôme, pas un diagnostic. Avant de penser « psychiatrie » ou « drogue », on élimine les causes qui tuent : manque de sucre, manque d'oxygène, choc à la tête, infection."),
                    S([
                        "Ne pas rester seul, garder la porte dans son dos, retirer ce qui peut servir d'arme.",
                        "Parler calmement, phrases courtes, sans contredire ni menacer ; proposer à boire, à s'asseoir.",
                        "Proposer un calmant par la bouche.",
                        "En cas de danger : sédation par injection, à plusieurs, chaque soignant sachant quel membre il tient.",
                        "Après la sédation : surveillance rapprochée de la respiration.",
                    ]),
                    RP(["« Je vois que vous êtes en colère. Je ne suis pas là pour vous faire du mal. Dites-moi ce qui se passe. »", "/me garde ses mains visibles et reste à deux mètres, près de la porte."]),
                ],
            },
        ],
    },
    {
        id: 'metabo', title: 'Sucre, infections, ventre, température', icon: 'fa-temperature-half',
        intro: "Les urgences médicales les plus courantes en dehors du cœur et des poumons.",
        sections: [
            {
                id: 'glycemie', title: 'Le sucre : trop bas ou trop haut', conditions: ['hypoglycemie', 'acidocetose'],
                blocks: [
                    T(['', 'Hypoglycémie', 'Acidocétose'], [
                        ['Glycémie', 'Sous 0,70 g/L', 'Au-dessus de 2,50 g/L'],
                        ['Début', 'Brutal, en minutes', 'Progressif, en heures ou en jours'],
                        ['Signes', 'Sueurs, tremblements, faim, confusion, puis coma', 'Soif, urines abondantes, nausées, respiration ample, haleine de pomme'],
                        ['Traitement', 'Sucre par la bouche ou en injection', 'Perfusion, puis insuline après contrôle du potassium'],
                    ]),
                    TIP("Tout malaise, toute confusion, toute convulsion, tout coma : glycémie au bout du doigt. C'est le test le plus rentable de la médecine d'urgence."),
                ],
            },
            {
                id: 'infection', title: 'Fièvre, sepsis et déshydratation', conditions: ['sepsis', 'deshydratation'],
                blocks: [
                    P("Une infection devient un sepsis quand elle dérègle tout l'organisme : la tension baisse, la respiration s'accélère, le patient devient confus. À ce stade, chaque heure de retard de l'antibiotique augmente la mortalité."),
                    L([
                        "Trois signes d'alerte : tension systolique à 100 ou moins, fréquence respiratoire à 22 ou plus, confusion. Deux sur trois = sepsis probable.",
                        "On prélève le sang (hémocultures), puis antibiotique dans l'heure et perfusion.",
                        "Taches violacées qui ne s'effacent pas à la pression, avec de la fièvre : antibiotique immédiat, sans attendre aucun examen.",
                        "Déshydratation : bouche sèche, pli de peau qui reste marqué, urines rares. Chez l'enfant et la personne âgée, elle s'installe vite. On réhydrate par la bouche si possible, par perfusion sinon.",
                    ]),
                ],
            },
            {
                id: 'ventre', title: 'Douleurs du ventre', conditions: ['douleur_abdominale', 'colique_nephretique'],
                blocks: [
                    P("La localisation de la douleur oriente : en bas à droite, l'appendice ; en haut à droite, la vésicule ; au creux de l'estomac, l'estomac ou le pancréas (ou le cœur !) ; dans le flanc avec irradiation vers l'aine, le calcul rénal."),
                    L([
                        "Ventre souple : rassurant. Ventre dur comme du bois : urgence chirurgicale.",
                        "Test de grossesse chez toute femme en âge d'avoir des enfants : une grossesse extra-utérine peut tuer.",
                        "Colique néphrétique : douleur atroce du flanc, le patient ne tient pas en place. Anti-inflammatoire en injection. Avec de la fièvre, c'est une urgence urologique.",
                    ]),
                ],
            },
            {
                id: 'temperature', title: 'Trop froid, trop chaud', conditions: ['hypothermie', 'coup_chaleur'],
                blocks: [
                    T(['', 'Hypothermie', 'Coup de chaleur'], [
                        ['Température', 'Sous 35 °C', 'Au-dessus de 40 °C'],
                        ['Signes', 'Frissons, puis somnolence ; plus de frissons quand c\'est grave', 'Confusion, peau brûlante, parfois plus de sueur'],
                        ['Geste clé', 'Isoler, réchauffer doucement, manipuler avec précaution', 'Refroidir immédiatement, perfuser'],
                        ['Piège', 'Le cœur refroidi s\'arrête au moindre choc', 'Le paracétamol ne sert à rien'],
                    ]),
                    WARN("Un patient en hypothermie profonde peut sembler mort. On ne déclare pas le décès d'un patient froid : on le réchauffe d'abord."),
                ],
            },
        ],
    },
    {
        id: 'medicaments', title: 'Les médicaments', icon: 'fa-pills',
        intro: "Les règles de sécurité, les voies, les antalgiques, et le référentiel utilisé par Pilou.",
        sections: [
            {
                id: 'regles', title: 'Les cinq vérifications avant de donner un médicament',
                blocks: [
                    S([
                        "Le bon patient : identité vérifiée.",
                        "Le bon médicament : nom lu sur l'ampoule ou la boîte, date de péremption.",
                        "La bonne dose : calculée pour l'âge et le poids. Chez l'enfant, toujours au poids.",
                        "La bonne voie : par la bouche, dans la veine, dans le muscle…",
                        "Le bon moment : délai depuis la dernière prise, heure notée.",
                    ]),
                    P("Et toujours, avant : allergies, traitements en cours, grossesse possible. Pilou fait ces contrôles pour vous dans l'aide à la prise en charge : il écarte un médicament contre-indiqué et propose son remplaçant."),
                    WARN("Les trois accidents classiques : anti-inflammatoire chez un patient qui saigne ou sous anticoagulant ; pénicilline chez un allergique ; sédatif chez un patient qui respire déjà mal."),
                ],
            },
            {
                id: 'antalgiques', title: 'Soulager la douleur',
                blocks: [
                    F('ladder', "Les trois paliers : on monte d'une marche quand la douleur n'est pas contrôlée."),
                    L([
                        "Palier 1 — paracétamol, anti-inflammatoires (ibuprofène, kétoprofène) : douleurs légères à modérées.",
                        "Palier 2 — tramadol : douleurs modérées.",
                        "Palier 3 — morphine, fentanyl : douleurs intenses. Par petites doses répétées (titration) en surveillant la respiration.",
                        "La kétamine à petite dose soulage sans faire chuter la tension : utile chez le blessé grave.",
                        "Anesthésie locale (lidocaïne) pour les sutures.",
                    ]),
                    TIP("Les paliers s'additionnent : le paracétamol se poursuit avec la morphine, il permet d'en donner moins."),
                ],
            },
            { id: 'referentiel', title: 'Le référentiel de Pilou', blocks: [P("Tous les médicaments que Pilou sait proposer et doser, avec leurs voies d'administration. Les doses exactes pour un patient donné sont calculées dans l'aide à la prise en charge."), { type: 'medsTable' }] },
        ],
    },
    {
        id: 'terrains', title: 'Enfants, personnes âgées, grossesse', icon: 'fa-people-group',
        intro: "Trois terrains où les règles habituelles changent.",
        sections: [
            {
                id: 'enfant', title: "L'enfant",
                blocks: [
                    L([
                        "Un enfant n'est pas un petit adulte : ses constantes normales sont différentes (voir le tableau des constantes), et toutes les doses se calculent au poids.",
                        "Poids inconnu : entre 1 et 10 ans, poids estimé = (âge × 2) + 8 kg.",
                        "Il compense longtemps puis s'effondre d'un coup : un enfant pâle, silencieux et trop calme est plus inquiétant qu'un enfant qui hurle.",
                        "Il se refroidit et fait des hypoglycémies très vite.",
                        "Un parent reste à côté : un enfant rassuré se laisse examiner.",
                        "Massage cardiaque : 15 compressions pour 2 insufflations, en commençant par 5 insufflations.",
                    ]),
                ],
            },
            {
                id: 'age', title: 'La personne âgée',
                blocks: [
                    L([
                        "Les signes sont trompeurs : infarctus sans douleur, infection sans fièvre, fracture avec peu de douleur. Une simple confusion récente est un signe d'alerte.",
                        "Beaucoup de traitements : toujours demander la liste. Sous anticoagulant, toute chute sur la tête mérite un scanner.",
                        "Doses prudentes : les reins éliminent moins bien. Les sédatifs et la morphine agissent plus fort et plus longtemps.",
                        "Une chute a toujours une cause : malaise, médicament, infection. On la cherche.",
                    ]),
                ],
            },
            {
                id: 'grossesse', title: 'La femme enceinte',
                blocks: [
                    L([
                        "Toute femme en âge d'avoir des enfants est peut-être enceinte : test de grossesse avant une radiographie ou certains médicaments.",
                        "Après le 5e mois, on l'allonge sur le côté gauche : sur le dos, l'utérus écrase la grosse veine et fait chuter la tension.",
                        "Anti-inflammatoires interdits en fin de grossesse ; le paracétamol reste l'antalgique de référence.",
                        "Soigner la mère, c'est soigner l'enfant : la réanimation de la mère passe toujours en premier.",
                    ]),
                ],
            },
        ],
    },
    {
        id: 'rp', title: 'Jouer la scène', icon: 'fa-masks-theater',
        intro: "Rendre une prise en charge crédible et agréable à jouer, pour soi et pour le patient.",
        sections: [
            {
                id: 'rythme', title: 'Donner du rythme',
                blocks: [
                    L([
                        "Décrivez ce que fait votre personnage, pas le résultat : c'est au joueur du patient de dire ce que l'on trouve. « /me palpe l'abdomen » puis « /do Le ventre est-il souple ? ».",
                        "Une action par ligne, courte. Trois lignes précises valent mieux qu'un pavé.",
                        "Parlez au patient : expliquer, rassurer, poser des questions fait vivre la scène et laisse l'autre joueur jouer.",
                        "Suivez les six temps : le suivi pas à pas de Pilou vous dit quoi écrire ensuite.",
                        "Adaptez la durée à la gravité : une suture se joue en cinq minutes, un polytraumatisé mérite toute l'équipe.",
                    ]),
                ],
            },
            {
                id: 'exemples', title: 'Exemples de /me et de /do',
                blocks: [
                    T(['Geste', 'Exemple'], [
                        ['Constantes', "/me pose le brassard au bras du patient, clipse l'oxymètre à son doigt et lit l'écran du moniteur."],
                        ['Voie veineuse', "/me serre le garrot, désinfecte le pli du coude et pose un cathéter avant de brancher la perfusion."],
                        ['Injection', "/me prélève le produit dans une seringue, chasse l'air et injecte lentement dans la tubulure."],
                        ['Suture', "/me infiltre les berges à la lidocaïne, attend quelques instants puis rapproche les bords de la plaie point par point."],
                        ['Garrot', "/me glisse le garrot au-dessus de la plaie, serre jusqu'à l'arrêt du saignement et note l'heure au marqueur."],
                        ['Immobilisation', "/me cale le membre dans une attelle, la fixe sans serrer et contrôle le pouls en aval."],
                        ['Imagerie', "/me installe le patient sous l'appareil de radiographie et lance les clichés de face et de profil."],
                        ['Question au patient', "/do Le patient ressent-il encore la douleur, sur une échelle de 0 à 10 ?"],
                    ]),
                ],
            },
            {
                id: 'transmissions', title: 'Les transmissions',
                blocks: [
                    P("Quand le patient change de mains (ambulance vers urgences, urgences vers le bloc), on transmet en quatre temps. Trente secondes, sans rien oublier."),
                    T(['Temps', 'Contenu', 'Exemple'], [
                        ['Situation', 'Qui, quoi, depuis quand', "« Homme de 34 ans, plaie par balle de la cuisse droite il y a vingt minutes. »"],
                        ['Antécédents', 'Allergies, traitements, maladies', "« Aucune allergie connue, pas de traitement. »"],
                        ['Évaluation', 'Constantes, ce que l\'on a trouvé, ce que l\'on a fait', "« Tension 95/60, pouls 125. Garrot posé à 21 h 12, une voie veineuse, acide tranexamique passé. »"],
                        ['Demande', 'Ce que l\'on attend', "« Il lui faut un bloc en urgence. »"],
                    ]),
                ],
            },
            {
                id: 'rapport', title: 'Rédiger le rapport',
                blocks: [
                    L([
                        "Le rapport se remplit dans les formulaires de l'outil (protocole d'urgence, consultation générale). L'assistant y propose les mêmes motifs que Pilou et préremplit constantes, diagnostic, soins et médicaments.",
                        "On écrit des faits : ce que le patient a dit, ce que l'on a constaté, ce que l'on a fait, à quelle heure.",
                        "On note les refus de soins et les sorties contre avis médical.",
                        "Le rapport est un document du dossier : pas d'humour, pas de jugement sur le patient.",
                    ]),
                ],
            },
            {
                id: 'erreurs', title: 'Les erreurs fréquentes',
                blocks: [
                    L([
                        "Guérir par magie : une fracture ne se répare pas en deux lignes. Laissez des suites (plâtre, béquilles, contrôle), elles créent du jeu.",
                        "Décider à la place du patient de ce qu'il ressent ou de l'issue de la scène.",
                        "Oublier les allergies avant un médicament.",
                        "Retirer une balle ou une lame aux urgences.",
                        "Donner à boire ou à manger à un patient qui va au bloc.",
                        "Négliger la surveillance : c'est souvent là que la scène rebondit.",
                    ]),
                ],
            },
        ],
    },
];

// ───────────── Chapitres générés depuis les données de Pilou ─────────────
const ADMIT_TEXT = ['dès la gravité légère', 'à partir de la gravité modérée', 'à partir de la gravité sévère', 'en cas de gravité critique'];
const orientationOf = (condition) => {
    const parts = [];
    if (condition.admitAt === null || condition.admitAt === undefined) parts.push("Retour à domicile dans la plupart des cas, avec des consignes.");
    else parts.push(`Hospitalisation proposée ${ADMIT_TEXT[condition.admitAt] || ''}.`);
    if (condition.surgical) parts.push("Bloc opératoire à partir de la gravité sévère.");
    return parts.join(' ');
};
const medsOf = (condition) => [...new Set((condition.meds || []).map(([medId, , minSeverity = 0]) => {
    const med = MEDICATION_BY_ID[medId];
    if (!med) return '';
    return minSeverity > 0 ? `${med.name} (à partir de la gravité ${SEVERITIES[minSeverity]?.label.toLowerCase() || ''})` : med.name;
}).filter(Boolean))];

/** Fiche réflexe d'un motif, tirée des mêmes données que l'aide à la prise en charge. */
export const conditionSheet = (condition) => {
    const pathway = PATHWAYS[condition.id] || { now: [], assess: [], treat: [] };
    const protocol = PROTOCOLS[condition.id] || { equipment: [], monitoring: [] };
    const meds = medsOf(condition);
    return {
        id: `fiche-${condition.id}`, title: condition.label, group: condition.group, conditions: [condition.id], conditionId: condition.id,
        // Mots de recherche qui ne figurent pas dans le texte de la fiche : synonymes du motif, diagnostic, mots du langage courant.
        keywords: [condition.id.replace(/_/g, ' '), ...(condition.aliases || []), condition.diagnosis || '', protocol.symptoms || ''].join(' '),
        blocks: [
            P(`${condition.complaint || ''}${condition.mechanism ? ` Contexte habituel : ${condition.mechanism.charAt(0).toLowerCase()}${condition.mechanism.slice(1)}` : ''}`.trim()),
            { type: 'heading', text: 'Gestes immédiats' }, S(pathway.now),
            { type: 'heading', text: 'Examen et bilan' }, S(pathway.assess),
            { type: 'heading', text: 'Traitement' }, S(pathway.treat),
            ...(meds.length ? [{ type: 'heading', text: 'Médicaments habituels' }, L(meds)] : []),
            { type: 'heading', text: 'Matériel' }, L(protocol.equipment),
            { type: 'heading', text: 'Surveillance et signes d\'alerte' }, L(protocol.monitoring),
            { type: 'heading', text: 'Orientation' }, P(orientationOf(condition)),
        ],
    };
};

const SHEETS = {
    id: 'fiches', title: 'Fiches réflexes par motif', icon: 'fa-list-check',
    intro: "Une fiche par motif de prise en charge : les gestes dans l'ordre, le matériel, les médicaments et la surveillance. Ce sont les étapes que suit l'aide à la prise en charge.",
    sections: CONDITION_GROUPS.flatMap((group) => group.options.map(conditionSheet)),
};

const LEXICON = {
    id: 'lexique', title: 'Lexique', icon: 'fa-book',
    intro: "Les abréviations et les mots que l'on entend aux urgences.",
    sections: [{
        id: 'abreviations', title: 'Abréviations et vocabulaire',
        blocks: [T(['Terme', 'Signification'], [
            ['A B C D E', "Ordre du bilan primaire : voies aériennes, respiration, circulation, conscience, exposition."],
            ['ACR', "Arrêt cardio-respiratoire."],
            ['AINS', "Anti-inflammatoire non stéroïdien (ibuprofène, kétoprofène)."],
            ['AVC', "Accident vasculaire cérébral."],
            ['Bilan', "Ensemble des examens demandés ; ou résumé de l'état du patient."],
            ['Déchocage', "Salle des urgences équipée pour les patients en détresse vitale."],
            ['ECG', "Électrocardiogramme : enregistrement de l'activité électrique du cœur."],
            ['eFAST', "Échographie rapide au lit du blessé, à la recherche de sang ou d'air dans le thorax et l'abdomen."],
            ['FC / FR', "Fréquence cardiaque / fréquence respiratoire, par minute."],
            ['Glasgow', "Score de conscience sur 15."],
            ['Hémostase', "Arrêt d'un saignement."],
            ['IM / IV / SC / PO', "Voies d'injection : dans le muscle, dans la veine, sous la peau ; PO : par la bouche."],
            ['Intubation', "Sonde placée dans la trachée pour ventiler un patient à la machine."],
            ['OAP', "Œdème aigu du poumon."],
            ['PA', "Pression artérielle (tension), en mmHg : systolique / diastolique."],
            ['Parage', "Nettoyage chirurgical d'une plaie : on retire les tissus abîmés."],
            ['PLS', "Position latérale de sécurité."],
            ['Remplissage', "Perfusion rapide de soluté pour remonter la tension."],
            ['Scope', "Moniteur qui affiche en continu le rythme cardiaque, la tension et la saturation."],
            ['SpO2', "Saturation du sang en oxygène, en %."],
            ['Titration', "Petites doses répétées d'un médicament jusqu'à l'effet voulu."],
            ['Triade létale', "Froid, acidité du sang et trouble de la coagulation chez le blessé grave."],
            ['Voie veineuse', "Petit cathéter laissé dans une veine pour perfuser et injecter."],
        ])],
    }],
};

export const MANUAL = [...WRITTEN, SHEETS, LEXICON];

/** Lignes du tableau des constantes par âge (tirées de vitals.js) : [tranche d'âge, FC, FR, PA]. */
export const vitalsRows = () => {
    const labels = ['Moins de 1 an', '1 à 2 ans', '3 à 5 ans', '6 à 11 ans', '12 à 17 ans', '18 à 64 ans', '65 ans et plus'];
    return AGE_BANDS.map((band, index) => [labels[index] || `Jusqu'à ${band.upTo} ans`, `${band.hr[0]} à ${band.hr[1]}`, `${band.rr[0]} à ${band.rr[1]}`, `${band.sbp}/${band.dbp}`]);
};

/** Lignes du référentiel des médicaments (tirées de medications.js) : [nom, famille, voies, noms de marque]. */
export const medsRows = () => MEDICATIONS.map((med) => [
    med.name, med.category || '', [...new Set((med.regimens || []).map((regimen) => regimen.route))].join(', '), (med.brands || []).join(', '),
]).sort((a, b) => a[0].localeCompare(b[0], 'fr'));

/** Tout le texte d'un bloc, à plat (recherche). */
const blockText = (block) => {
    switch (block.type) {
        case 'p': case 'tip': case 'warn': case 'heading': return block.text;
        case 'list': case 'steps': return block.items.join(' ');
        case 'rp': return block.lines.join(' ');
        case 'table': return [...block.head, ...block.rows.flat()].join(' ');
        case 'figure': return block.caption || '';
        case 'vitalsTable': return vitalsRows().flat().join(' ');
        case 'medsTable': return medsRows().flat().join(' ');
        default: return '';
    }
};
const fold = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');

const INDEX = MANUAL.flatMap((chapter) => chapter.sections.map((section) => ({
    chapterId: chapter.id, chapterTitle: chapter.title, sectionId: section.id, title: section.title, group: section.group || '',
    titleText: fold(section.title), text: fold([chapter.title, section.title, section.keywords || '', ...section.blocks.map(blockText)].join(' ')),
})));

/** Recherche dans tout le manuel : [{ chapterId, chapterTitle, sectionId, title }], les titres qui correspondent d'abord. Tous les mots doivent être présents. */
export const searchManual = (query, limit = 30) => {
    const words = fold(query).split(/\s+/).filter((word) => word.length >= 2);
    if (!words.length) return [];
    return INDEX.filter((entry) => words.every((word) => entry.text.includes(word)))
        .map((entry) => ({ ...entry, score: words.filter((word) => entry.titleText.includes(word)).length }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ chapterId, chapterTitle, sectionId, title }) => ({ chapterId, chapterTitle, sectionId, title }));
};

/** Section rédigée (hors fiches) qui traite d'un motif : { chapterId, sectionId, title } ou null. */
export const lessonOfCondition = (conditionId) => {
    for (const chapter of WRITTEN) {
        const section = chapter.sections.find((item) => (item.conditions || []).includes(conditionId));
        if (section) return { chapterId: chapter.id, sectionId: section.id, title: section.title };
    }
    return null;
};

/** Identifiants de tous les schémas cités par le manuel. */
export const manualFigureIds = () => [...new Set(MANUAL.flatMap((chapter) => chapter.sections.flatMap((section) => section.blocks.filter((block) => block.type === 'figure').map((block) => block.id))))];

/** Motifs qu'aucune section RÉDIGÉE ne traite (doit rester vide). */
export const uncoveredConditions = () => CONDITIONS.filter((condition) => !lessonOfCondition(condition.id)).map((condition) => condition.id);
