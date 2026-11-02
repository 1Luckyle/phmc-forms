// src/constants/takeHomeCar.js
//
// Programme « Take Home Car » du PHMC : un membre du personnel peut, sur demande et sous conditions, garder un véhicule du PHMC à son domicile
// pour répondre plus vite aux scènes depuis chez lui. Ce fichier contient la liste des véhicules éligibles et le texte du règlement (inspiré du
// programme du LSSD, adapté au PHMC) : pour changer un véhicule ou une phrase, c'est ici, sans toucher au reste de l'application.

// Véhicules éligibles (plaque = clé d'attribution). Un seul agent à la fois par véhicule.
export const TAKE_HOME_VEHICLES = [
    { plate: 'PHMC04', model: 'Declasse Alamo Unmarked' },
    { plate: 'PHMC05', model: 'Declasse Alamo Unmarked' },
    { plate: 'PHMC15', model: 'Bravado Rumpo (Deludamol)' },
    { plate: 'PHMC16', model: 'Bravado Buffalo A/C Police 2023' },
];

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
    intro: "Les membres du personnel du PHMC peuvent bénéficier du privilège de garder à leur domicile un véhicule de l'établissement. L'utilité première de ces véhicules est de permettre et de faciliter la réponse sur les scènes depuis chez eux. L'obtention d'un Take Home Car est un privilège, non un droit : il s'obtient sur demande, après accord de la Direction, et peut être retiré à tout moment.",
    hrp: "(( Le programme vous accorde le droit de faire un /fspawn d'un véhicule spécifique chez vous, et de l'employer librement selon les circonstances accordées. ))",
    sections: [
        {
            title: 'Véhicules éligibles',
            items: TAKE_HOME_VEHICLES.map((vehicle) => `${vehicle.plate} — ${vehicle.model}`),
            note: "Un véhicule n'est attribué qu'à un seul agent à la fois. L'éligibilité d'un véhicule peut évoluer selon les besoins de la flotte.",
        },
        {
            title: 'Prérequis fixés par la Direction',
            items: [
                "Une disponibilité accrue : il est nécessaire d'être joignable et déployable lorsque les situations l'exigent, notamment par le biais de mobilisations.",
                "Une intégrité sans failles lors de l'usage d'un véhicule du PHMC : il est utilisé strictement pour les trajets vers son service ou pour quitter son affectation, ou pour répondre à une scène.",
                "Le véhicule ne dispose pas de matériel lourd : le coffre est systématiquement vide de contenu lorsque le véhicule n'est pas sous sa garde. Unique exception : le matériel de secours nécessaire à un déploiement rapide.",
                "Le membre du personnel ne doit pas vivre dans une zone géographique hostile à l'établissement.",
                "Le membre du personnel revêt systématiquement sa tenue de service lorsqu'il utilise son véhicule, sauf exception autorisée par la Direction.",
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
    closing: "Prière de prévenir la Direction au moindre incident impliquant un véhicule du programme. Le moindre abus justifiera le retrait du Take Home Car sans appel.",
    closingHrp: "(( Tout abus sera sévèrement puni en interne par la Direction. ))",
};
