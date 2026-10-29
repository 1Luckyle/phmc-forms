// src/utils/contractConstants.js
//
// Constantes et petites fonctions PURES partagées par le catalogue des documents (contractDocs.js) et leur contenu juridique
// (contractClauses.js), pour éviter une dépendance circulaire entre les deux.

export const MODEL_VERSION = 'CT-2026.1';

export const CONTRACT_TYPES = {
    cdi: 'Contrat à durée indéterminée (CDI)',
    cdd: 'Contrat à durée déterminée (CDD)',
    stage: 'Convention de stage',
    avenant: 'Avenant à un contrat',
    convocation: 'Convocation à un entretien préalable',
    sanction: 'Notification de sanction disciplinaire',
    fin: 'Notification de fin de contrat',
};

export const FIN_MOTIFS = {
    fin_essai: 'Rupture de la période d\'essai',
    fin_cdd: 'Arrivée du terme du CDD / non-renouvellement',
    fin_stage: 'Fin de la convention de stage',
    demission: 'Démission',
    rupture_amiable: 'Rupture d\'un commun accord',
    licenciement: 'Licenciement non disciplinaire (suppression de poste, inaptitude…)',
    licenciement_disciplinaire: 'Licenciement pour faute',
    plein_droit: 'Fin de plein droit (condamnation, inéligibilité, vacance du poste)',
};

export const FIN_BASES_LEGALES = {
    condamnation: 'Condamnation définitive pour un crime (Code du Gouvernement, art. 235)',
    ineligibilite: 'Inéligibilité à l\'emploi public (Code du Gouvernement, art. 203 à 206)',
    vacance: 'Cessation des fonctions pendant trois (3) mois consécutifs sans maladie ni absence autorisée (Code du Gouvernement, art. 233(e))',
    deces: 'Décès de l\'employé(e) (Code du Gouvernement, art. 233(a))',
};

export const SANCTIONS = {
    avertissement: 'Avertissement écrit',
    blame: 'Blâme',
    mise_a_pied: 'Mise à pied sans rémunération',
    retrogradation: 'Rétrogradation au grade immédiatement inférieur',
};

export const MAX_MISE_A_PIED_JOURS = 7;
export const MAX_CONSERVATOIRE_JOURS = 7;
export const CONVOCATION_DELAI_HEURES = 72;
export const DECISION_DELAI_JOURS = 7;

// « accord » : l'employé accepte (contrat, avenant, rupture amiable). « accuse » : il accuse réception (convocation, sanction, fin).
export const acceptanceKind = (typeKey, champs = {}) => {
    if (typeKey === 'convocation' || typeKey === 'sanction') return 'accuse';
    if (typeKey === 'fin') return champs.motif === 'rupture_amiable' ? 'accord' : 'accuse';
    return 'accord';
};

// ───────────────────────────── Dates ─────────────────────────────

export const parseIsoDate = (iso) => {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
};

export const formatDateFr = (iso) => {
    const date = parseIsoDate(iso);
    return date ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
};

export const formatTimestampDateFr = (timestamp) => (timestamp
    ? new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—');

export const toIsoDate = (timestamp) => {
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
