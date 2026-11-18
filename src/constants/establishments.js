// src/constants/establishments.js
//
// Établissement qui ÉMET un document administratif (contrat, accord, AMA) : le PHMC (Pillbox Hill Medical Center) ou sa clinique de Paleto Bay (PBC).
//   • PHMC : en-tête avec le logo du PHMC (et le petit sceau du DMEC quand le document concerne un grade du DMEC), pied de page du PHMC ;
//   • PBC  : en-tête avec les logos du PHMC et du PBC, pied de page de la clinique de Paleto Bay ; seuls les grades et services de la clinique sont proposés.
// Le choix n'existe que si les formulaires PBC sont activés (panneau admin → Affichage, SiteConfigContext.pbcEnabled) : sinon tout reste PHMC.
//
// Ce que le PBC n'a pas : le service DMEC (voir utils/formAccess.js, « Le PBC n'a pas de service DMEC »). C'est la seule règle connue du dépôt sur les
// grades et services de la clinique ; elle est regroupée ICI pour qu'une autre exclusion s'ajoute en un seul endroit.

export const ESTABLISHMENTS = {
    phmc: { key: 'phmc', label: 'PHMC', long: 'Pillbox Hill Medical Center (PHMC)' },
    pbc: { key: 'pbc', label: 'PBC', long: 'Clinique de Paleto Bay (PBC)' },
};

export const DEFAULT_ESTABLISHMENT = 'phmc';

// Établissement réellement utilisé : « pbc » seulement s'il est demandé ET que les formulaires PBC sont activés.
export const effectiveEstablishment = (value, pbcEnabled = true) => (pbcEnabled && value === 'pbc' ? 'pbc' : DEFAULT_ESTABLISHMENT);
export const isPbcEstablishment = (value) => value === 'pbc';

// Valeur lue en base : « pbc » ou, par défaut (anciens documents), « phmc ».
export const normalizeEstablishment = (value) => (value === 'pbc' ? 'pbc' : DEFAULT_ESTABLISHMENT);

// Services du personnel (listes staff/phmc et staff/coroner) absents du PBC.
export const PBC_EXCLUDED_STAFF_SERVICES = ['coroner'];
// Familles de rôles absentes du PBC (champ `pole` d'un rôle).
export const PBC_EXCLUDED_POLES = ['dmec'];

// Grades proposés : [{ value, label, pole }] → ceux de l'établissement.
export const ranksForEstablishment = (ranks, establishment) => (
    establishment === 'pbc' ? (ranks || []).filter((rank) => !PBC_EXCLUDED_POLES.includes(rank.pole)) : (ranks || [])
);

// Services d'affectation proposés (« Médecine légale (DMEC) » n'existe pas au PBC).
export const servicesForEstablishment = (services, establishment) => (
    establishment === 'pbc' ? (services || []).filter((name) => !/\bDMEC\b/.test(name)) : (services || [])
);

// Destinataire possible d'un document de l'établissement : un membre du DMEC (ou un candidat accepté sur un rôle du DMEC) ne reçoit pas de document du PBC.
// `poleOfRole` : rôle → famille (getRoleInfo(role)?.pole), passée par l'appelant pour garder ce module sans dépendance.
export const recipientAllowedIn = (member, establishment, poleOfRole = () => undefined) => {
    if (establishment !== 'pbc' || !member) return true;
    if (PBC_EXCLUDED_STAFF_SERVICES.includes(member.service)) return false;
    return !(member.kind === 'candidate' && PBC_EXCLUDED_POLES.includes(poleOfRole(member.role)));
};
