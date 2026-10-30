// src/utils/pricing.js
//
// Tarifs des formulaires (tout ce pour quoi le site demande de l'argent), modifiables par un admin, la Directrice ou l'Assistante de Direction depuis
// la Boîte à outils → Comptabilité → « Tarifs des formulaires » SANS toucher au code. Les valeurs vivent dans adminSettings/tarifs (lecture
// publique, écriture admin) ; à défaut, ce sont les valeurs par défaut ci-dessous.
//
// getPrice(clé) est SYNCHRONE (les générateurs de BBCode et les calculs de facturation ne sont pas des composants) ;
// les composants qui affichent un montant appellent usePrices() pour se redessiner quand un tarif change.
// Une facture déjà créée garde son montant : un changement de tarif ne vaut que pour les nouveaux formulaires.
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

// Chaque tarif : valeur par défaut (en dollars), nom affiché dans le panneau admin, et ce qu'il couvre.
export const PRICE_DEFINITIONS = [
    {
        key: 'dossierAvance', default: 2000, label: 'Dossier médical avancé',
        description: "Formulaire « [Civil] Dossier Médical Avancé » : prix du dossier, hors exemption (mineur / faible revenu).",
    },
    {
        key: 'dossierBase', default: 2000, label: 'Dossier médical basique',
        description: "Formulaire « [Civil] Dossier Médical Basique » : prix du dossier, hors exemption (mineur / faible revenu).",
    },
    {
        key: 'divulgationParElement', default: 5000, label: 'Divulgation de dossier médical (par élément)',
        description: "Formulaire « [Civil] Formulaire de Libération Médicale » : prix de CHAQUE élément du dossier demandé.",
    },
    {
        key: 'miseAJourDossier', default: 1000, label: 'Mise à jour du dossier médical',
        description: "Formulaire « [Civil] Mise à Jour du Dossier Médical » : prix fixe de la mise à jour.",
    },
    {
        key: 'fraisDemandeAutopsie', default: 2000, label: "Frais de demande d'autopsie / certificat",
        description: "E-mail de demande du DMEC (rapport d'autopsie, certificat de décès) : frais fixes réglés par lien Fleeca.",
    },
];

export const DEFAULT_PRICES = Object.fromEntries(PRICE_DEFINITIONS.map((definition) => [definition.key, definition.default]));

export const PRICES_PATH = 'adminSettings/tarifs';
export const MAX_PRICE = 10000000;

let currentPrices = { ...DEFAULT_PRICES };
const listeners = new Set();
let started = false;

// Une valeur enregistrée n'est prise en compte que si c'est un entier raisonnable : sinon on garde le tarif par défaut.
const sanitize = (values) => {
    const result = { ...DEFAULT_PRICES };
    Object.keys(DEFAULT_PRICES).forEach((key) => {
        const value = Number(values?.[key]);
        if (values && values[key] !== undefined && values[key] !== null && Number.isFinite(value) && value >= 0 && value <= MAX_PRICE) result[key] = Math.round(value);
    });
    return result;
};

// Tarif en vigueur (en dollars). Lecture synchrone.
export const getPrice = (key) => (currentPrices[key] ?? DEFAULT_PRICES[key] ?? 0);

export const getAllPrices = () => ({ ...currentPrices });

// Écoute les tarifs une seule fois pour toute l'application.
export const startPriceSync = () => {
    if (started) return;
    started = true;
    onValue(ref(database, PRICES_PATH), (snapshot) => {
        currentPrices = sanitize(snapshot.val()?.valeurs);
        listeners.forEach((listener) => listener());
    }, () => { /* lecture impossible : les tarifs par défaut restent en vigueur */ });
};

// Redessine le composant quand un tarif change. Renvoie les tarifs en vigueur.
export const usePrices = () => {
    const [, setTick] = useState(0);
    useEffect(() => {
        startPriceSync();
        const listener = () => setTick((tick) => tick + 1);
        listeners.add(listener);
        return () => listeners.delete(listener);
    }, []);
    return currentPrices;
};
