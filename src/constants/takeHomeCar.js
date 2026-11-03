// src/constants/takeHomeCar.js
//
// Programme « Take Home Car » du PHMC : un membre du personnel peut, sur demande et sous conditions, garder un véhicule du PHMC à son domicile
// pour répondre plus vite aux scènes depuis chez lui. Ce fichier contient la liste des véhicules éligibles et le texte du règlement (inspiré du
// programme du LSSD, adapté au PHMC) : pour changer un véhicule ou une phrase, c'est ici, sans toucher au reste de l'application.

import alamoImage from '../assets/vehicles/Declasse Alamo Unmarked.jpg';
import rumpoImage from '../assets/vehicles/Bravado Rumpo (Deludamol).jpg';
import buffaloImage from '../assets/vehicles/Bravado Buffalo AC Police 2023.jpg';

// Véhicules éligibles (plaque = clé d'attribution) avec leur photo d'aperçu. Un seul agent à la fois par véhicule.
export const TAKE_HOME_VEHICLES = [
    { plate: 'PHMC04', model: 'Declasse Alamo Unmarked', image: alamoImage },
    { plate: 'PHMC05', model: 'Declasse Alamo Unmarked', image: alamoImage },
    { plate: 'PHMC15', model: 'Bravado Rumpo (Deludamol)', image: rumpoImage },
    { plate: 'PHMC16', model: 'Bravado Buffalo A/C Police 2023', image: buffaloImage },
];

// Réponses toutes faites (menus déroulants) : elles remplissent le champ, qu'on peut ensuite modifier ou remplacer par un texte libre.
export const MOTIF_PRESETS = [
    "Je suis régulièrement mobilisé(e) en dehors de mes heures de service et je souhaite rejoindre plus vite les scènes et l'hôpital.",
    "Mon domicile est éloigné du PHMC : un véhicule me permettrait de répondre plus rapidement aux mobilisations.",
    "Je fais partie des équipes d'urgence (EMS / EMT / Paramedic) et dois pouvoir intervenir rapidement en renfort.",
    "Je suis de garde ou d'astreinte et dois pouvoir être déployé(e) rapidement.",
    "Je participe souvent aux interventions sur scène et je souhaite disposer d'un véhicule adapté.",
];
export const DECISION_PRESETS = {
    accord: [
        "Demande acceptée : merci de respecter le règlement du programme.",
        "Accordé : une disponibilité est attendue lors des mobilisations.",
        "Accordé, sous réserve d'une utilisation strictement professionnelle.",
    ],
    refus: [
        "Refusé : le véhicule demandé n'est pas disponible pour le moment.",
        "Refusé : la fonction occupée ne justifie pas un Take Home Car pour l'instant.",
        "Refusé : la disponibilité lors des mobilisations est insuffisante.",
        "Refusé : motif insuffisant, merci de préciser votre demande.",
        "Refusé : un manquement récent au règlement ne permet pas l'attribution.",
    ],
    retrait: [
        "Retrait : usage non conforme au règlement.",
        "Retrait : changement de poste ou d'affectation.",
        "Retrait : absence prolongée.",
        "Retrait : le véhicule est nécessaire au service.",
        "Retrait : fin de contrat ou départ du PHMC.",
    ],
};

export const vehicleByPlate = (plate) => TAKE_HOME_VEHICLES.find((vehicle) => vehicle.plate === plate) || null;

export const vehicleLabel = (plate) => {
    const vehicle = vehicleByPlate(plate);
    return vehicle ? `${vehicle.plate} — ${vehicle.model}` : String(plate || '');
};

// Statuts d'une demande : en_attente → accepte | refuse | annule (par le demandeur) ; accepte → rendu (par le demandeur) | retire (par la Direction).
export const TAKE_HOME_STATUS = {
    en_attente: { label: 'En attente', bg: 'warning', text: 'dark' },
    accepte: { label: 'Accordé', bg: 'success' },
    refuse: { label: 'Refusé', bg: 'danger' },
    annule: { label: 'Annulée', bg: 'secondary' },
    rendu: { label: 'Rendu', bg: 'secondary' },
    retire: { label: 'Retiré', bg: 'dark' },
};

export const MOTIF_MIN = 10;
export const MOTIF_MAX = 500;

// Règlement affiché dans l'outil. `intro` : paragraphe ; `sections` : titre + puces ; `hrp` : remarque hors personnage ; `closing` : conclusion.
export const TAKE_HOME_RULES = {
    title: 'Programme Take Home Car',
    intro: "Le programme Take Home Car permet à un membre du personnel du PHMC de garder à son domicile un véhicule de l'établissement, afin de rejoindre plus vite un lieu d'intervention ou l'hôpital lorsqu'il est mobilisé (renfort, afflux de victimes, urgence sur scène). C'est un privilège, non un droit : il s'obtient sur demande, après accord de la Direction, et peut être retiré à tout moment.",
    hrp: "(( Le programme vous accorde le droit de faire un /fspawn d'un véhicule spécifique chez vous, et de l'employer selon les conditions ci-dessous. ))",
    sections: [
        {
            title: 'Véhicules éligibles',
            items: TAKE_HOME_VEHICLES.map((vehicle) => `${vehicle.plate} — ${vehicle.model}`),
            note: "Un véhicule n'est attribué qu'à un seul membre du personnel à la fois. La liste peut évoluer selon les besoins de la flotte.",
        },
        {
            title: "Conditions d'attribution",
            items: [
                "Être en mesure d'intervenir : le véhicule est accordé à un membre du personnel dont la fonction justifie de se déplacer rapidement vers une scène ou vers l'hôpital.",
                "Une disponibilité accrue : être joignable et mobilisable lorsque la situation l'exige, notamment par le biais des mobilisations du PHMC.",
                "Avoir un comportement irréprochable : aucun manquement grave ou répété au règlement de l'établissement ni à la conduite.",
            ],
        },
        {
            title: "Règles d'utilisation",
            items: [
                "Le véhicule sert uniquement au service : trajets entre le domicile et le PHMC, et déplacements pour répondre à une mobilisation ou à une intervention. Aucun usage personnel ou de loisir.",
                "Il est strictement personnel : il n'est ni prêté, ni confié à un tiers, ni utilisé pour transporter des personnes étrangères au service, hors secours d'une personne en détresse.",
                "Lors d'une intervention, le membre se présente comme personnel du PHMC (badge visible) et respecte les protocoles de l'établissement ainsi que le code de la route.",
                "Le véhicule est stationné de façon sécurisée, verrouillé, et jamais laissé en évidence avec un équipement ou des documents visibles à l'intérieur.",
            ],
        },
        {
            title: 'Contenu du véhicule',
            items: [
                "Le véhicule n'est pas un lieu de stockage : médicaments, stupéfiants, matériel de l'établissement et dossiers de patients restent au PHMC.",
                "Seul le matériel de première urgence nécessaire à une intervention rapide peut rester à bord, sous la responsabilité du titulaire.",
                "Le secret médical s'applique aussi dans le véhicule : aucune information sur un patient n'y est conservée ni laissée visible.",
            ],
        },
        {
            title: "Fin de l'attribution",
            items: [
                "Le véhicule est rendu en cas de changement de poste ou d'affectation, d'absence prolongée, de sanction ou de fin de contrat.",
                "Tout accident, dégât ou panne est signalé sans délai à la Direction.",
                "La Direction peut retirer le véhicule à tout moment, avec ou sans motif détaillé.",
            ],
        },
        {
            title: 'Déroulement',
            items: [
                "La demande se fait dans cet outil : choisissez un véhicule libre et expliquez en quelques mots pourquoi vous la faites.",
                "La Direction accepte ou refuse la demande ; vous êtes prévenu(e) par une notification.",
                "Vous pouvez rendre le véhicule à tout moment, ou annuler une demande en attente.",
            ],
        },
    ],
    closing: "Prière de prévenir la Direction au moindre incident impliquant un véhicule du programme. Le moindre abus (usage personnel, prêt du véhicule, matériel ou informations de patients laissés à bord) justifiera le retrait du Take Home Car sans appel.",
    closingHrp: "(( Tout abus sera sévèrement puni en interne par la Direction. ))",
};
