// src/utils/contractDocs.js
//
// Catalogue des DOCUMENTS CONTRACTUELS du PHMC / DMEC : types, champs à remplir (pilotent l'éditeur), validation, et construction du document
// final. Module PUR (aucun accès Firebase) : il se teste hors navigateur et sert aussi bien à l'aperçu de l'éditeur qu'au texte figé à l'envoi.
//
// Types (stockés dans champs.typeContrat, comme avant pour cdi / cdd) :
//   cdi · cdd · stage              contrats ET conventions : l'employé les ACCEPTE en les signant ;
//   avenant                        modification d'un contrat signé : accord de l'employé (signature) ;
//   convocation · sanction · fin   notifications de la procédure disciplinaire et de fin de contrat : la signature n'est qu'un ACCUSÉ DE RÉCEPTION
//                                  (sauf une rupture d'un commun accord, qui est un accord à signer).
//
// Le contenu juridique (articles) est dans utils/contractClauses.js ; la mise en page BBCode dans phmc-bbcode-generators/generateContract.js.
import { normalizeRank } from '../constants/ranks';
import generateContract from '../phmc-bbcode-generators/generateContract';
import { composeContractBb } from './contractCompose';
import { buildDocumentContent } from './contractClauses';
import {
    MODEL_VERSION, CONTRACT_TYPES, FIN_MOTIFS, FIN_BASES_LEGALES, SANCTIONS, MAX_MISE_A_PIED_JOURS, MAX_CONSERVATOIRE_JOURS,
    CONVOCATION_DELAI_HEURES, DECISION_DELAI_JOURS, acceptanceKind, parseIsoDate, formatDateFr, formatTimestampDateFr, toIsoDate,
} from './contractConstants';

// Les constantes partagées sont ré-exportées d'ici : le reste de l'application importe depuis contractDocs.
export { composeContractBb };
export {
    MODEL_VERSION, CONTRACT_TYPES, FIN_MOTIFS, FIN_BASES_LEGALES, SANCTIONS, MAX_MISE_A_PIED_JOURS, MAX_CONSERVATOIRE_JOURS,
    CONVOCATION_DELAI_HEURES, DECISION_DELAI_JOURS, acceptanceKind, parseIsoDate, formatDateFr, formatTimestampDateFr, toIsoDate,
};

// ───────────────────────────── Types ─────────────────────────────

// Libellé court (listes, pastilles) et icône.
export const CONTRACT_TYPE_INFO = {
    cdi: { short: 'CDI', icon: 'fa-file-signature', group: 'contrat' },
    cdd: { short: 'CDD', icon: 'fa-file-signature', group: 'contrat' },
    stage: { short: 'Stage', icon: 'fa-user-graduate', group: 'contrat' },
    avenant: { short: 'Avenant', icon: 'fa-file-pen', group: 'avenant' },
    convocation: { short: 'Convocation', icon: 'fa-calendar-check', group: 'procedure' },
    sanction: { short: 'Sanction', icon: 'fa-gavel', group: 'procedure' },
    fin: { short: 'Fin de contrat', icon: 'fa-door-open', group: 'fin' },
};

// Les contrats proprement dits : seuls eux ferment le statut « candidat accepté » et les échanges de candidature une fois signés.
export const EMPLOYMENT_TYPES = ['cdi', 'cdd', 'stage'];
export const isEmploymentType = (type) => EMPLOYMENT_TYPES.includes(type);

// Procédure disciplinaire et fin de contrat : rédigées par la Direction, son assistance, le personnel administratif et les admins — pas par les
// recruteurs (voir database.rules.json : contrats, disciplineUIDs).
export const DISCIPLINARY_TYPES = ['convocation', 'sanction', 'fin'];
export const isDisciplinaryType = (type) => DISCIPLINARY_TYPES.includes(type);

export const typeOfChamps = (champs) => (CONTRACT_TYPES[champs?.typeContrat] ? champs.typeContrat : 'cdi');

// Libellés de statut, selon qu'il s'agisse d'un accord ou d'une notification.
export const statusLabel = (statut, typeKey, champs) => {
    const accord = acceptanceKind(typeKey, champs) === 'accord';
    if (statut === 'brouillon') return 'Brouillon';
    if (statut === 'envoye') return accord ? 'En attente de signature' : 'Notifié · accusé de réception attendu';
    if (statut === 'signe') return accord ? 'Signé' : 'Reçu (accusé de réception)';
    return statut;
};

// ───────────────────────────── Champs à remplir ─────────────────────────────
// { key, label, type, required, placeholder, help, options, showIf(champs, ctx), half }
//   type : text | textarea | date | time | number | select | checkbox | role | contratRef | convocationRef
const f = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });

const isCdd = (champs, ctx) => (ctx?.refContract ? ctx.refContract.champs?.typeContrat === 'cdd' : false) || champs.typeContrat === 'cdd';

const FIELDS = {
    cdi: [
        f('poste', 'Fonction exercée', 'text', { required: true, placeholder: 'ex. Médecin urgentiste', half: true }),
        f('role', 'Grade', 'role', { required: true, half: true }),
        f('affectation', 'Service / unité d\'affectation', 'text', { placeholder: 'ex. Service des urgences', half: true }),
        f('responsable', 'Responsable hiérarchique', 'text', { half: true }),
        f('dateDebut', 'Date de prise d\'effet', 'date', { required: true, half: true }),
        f('essaiJours', 'Période d\'essai (jours)', 'number', { placeholder: '0 = aucune', help: 'Maximum 60 jours pour un CDI.', half: true }),
        f('remuneration', 'Rémunération brute', 'text', { required: true, placeholder: 'ex. 85 $ de l\'heure', half: true }),
        f('echelon', 'Échelon de la grille salariale', 'text', { placeholder: 'ex. Échelon 3', help: 'La grille est publiée par l\'employeur (Code du Gouvernement, art. 326).', half: true }),
        f('horaires', 'Horaires / disponibilités', 'text', { placeholder: 'ex. 3 plages de 4 h par semaine, astreintes le week-end', half: true }),
        f('validiteOffreJours', 'Validité de l\'offre (jours)', 'number', { required: true, help: 'Au-delà, l\'offre est caduque (Code Civil, art. 203).', half: true }),
        f('clausesParticulieres', 'Clauses particulières', 'textarea', { placeholder: 'Facultatif : mission spéciale, formation exigée, astreinte…' }),
    ],
    cdd: [
        f('poste', 'Fonction exercée', 'text', { required: true, placeholder: 'ex. Infirmier(ère) de renfort', half: true }),
        f('role', 'Grade', 'role', { required: true, half: true }),
        f('affectation', 'Service / unité d\'affectation', 'text', { half: true }),
        f('responsable', 'Responsable hiérarchique', 'text', { half: true }),
        f('dateDebut', 'Date de début', 'date', { required: true, half: true }),
        f('dateFin', 'Date de fin (terme)', 'date', { required: true, half: true }),
        f('motifCdd', 'Motif du recours au CDD', 'textarea', { required: true, placeholder: 'ex. Remplacement d\'un praticien absent ; renfort durant une campagne de vaccination' }),
        f('essaiJours', 'Période d\'essai (jours)', 'number', { placeholder: '0 = aucune', help: 'Maximum 30 jours et la moitié de la durée du contrat.', half: true }),
        f('remuneration', 'Rémunération brute', 'text', { required: true, half: true }),
        f('echelon', 'Échelon de la grille salariale', 'text', { half: true }),
        f('horaires', 'Horaires / disponibilités', 'text', { half: true }),
        f('validiteOffreJours', 'Validité de l\'offre (jours)', 'number', { required: true, half: true }),
        f('clausesParticulieres', 'Clauses particulières', 'textarea'),
    ],
    stage: [
        f('poste', 'Intitulé du stage', 'text', { required: true, placeholder: 'ex. Stage d\'externat en médecine d\'urgence', half: true }),
        f('role', 'Grade du stagiaire', 'role', { required: true, half: true }),
        f('affectation', 'Service d\'accueil', 'text', { half: true }),
        f('tuteur', 'Tuteur de stage', 'text', { required: true, placeholder: 'Nom et fonction du praticien qui encadre', half: true }),
        f('dateDebut', 'Date de début', 'date', { required: true, half: true }),
        f('dateFin', 'Date de fin', 'date', { required: true, half: true }),
        f('objectifs', 'Objectifs pédagogiques et activités confiées', 'textarea', { required: true, placeholder: 'Ce que le stagiaire doit apprendre et les tâches qu\'il peut accomplir sous supervision' }),
        f('horaires', 'Horaires de présence', 'text', { half: true }),
        f('gratification', 'Gratification', 'text', { placeholder: 'ex. 40 $ par journée de présence — vide = stage non gratifié', half: true }),
        f('validiteOffreJours', 'Validité de l\'offre (jours)', 'number', { required: true, half: true }),
        f('clausesParticulieres', 'Clauses particulières', 'textarea'),
    ],
    avenant: [
        f('contratRefId', 'Contrat modifié', 'contratRef', { required: true, help: 'Un contrat déjà signé par la personne.' }),
        f('dateEffet', 'Date d\'effet de l\'avenant', 'date', { required: true, half: true }),
        f('validiteOffreJours', 'Validité de l\'offre (jours)', 'number', { required: true, half: true }),
        f('motifAvenant', 'Raison de la modification', 'textarea', { required: true, placeholder: 'ex. Promotion au grade de Médecin Titulaire après évaluation favorable' }),
        f('nouveauPoste', 'Nouvelle fonction', 'text', { half: true }),
        f('nouveauRole', 'Nouveau grade', 'role', { half: true }),
        f('nouvelleAffectation', 'Nouveau service d\'affectation', 'text', { half: true }),
        f('nouvelleRemuneration', 'Nouvelle rémunération brute', 'text', { half: true }),
        f('nouveauxHoraires', 'Nouveaux horaires', 'text', { half: true }),
        f('nouveauResponsable', 'Nouveau responsable hiérarchique', 'text', { half: true }),
        f('nouvelleDateFin', 'Nouvelle date de fin (prolongation du CDD)', 'date', { half: true, showIf: (champs, ctx) => isCdd({}, ctx) }),
        f('transformationCdi', 'Transformer le CDD en CDI', 'checkbox', { half: true, showIf: (champs, ctx) => isCdd({}, ctx) }),
    ],
    convocation: [
        f('objet', 'Objet de l\'entretien', 'select', {
            required: true, half: true, options: [{ value: 'sanction', label: 'Sanction disciplinaire envisagée' }, { value: 'licenciement', label: 'Licenciement envisagé' }],
        }),
        f('conduitPar', 'Entretien mené par', 'text', { required: true, placeholder: 'Nom et fonction', half: true }),
        f('dateEntretien', 'Date de l\'entretien', 'date', { required: true, half: true }),
        f('heureEntretien', 'Heure', 'time', { required: true, half: true }),
        f('lieuEntretien', 'Lieu', 'text', { required: true, placeholder: 'ex. Bureau de la Direction, PHMC, Pillbox Hill' }),
        f('faitsReproches', 'Faits reprochés', 'textarea', { required: true, placeholder: 'Décrivez précisément les faits (dates, circonstances) : ils doivent être assez clairs pour que la personne prépare sa défense.' }),
        f('miseAPiedConservatoire', 'Suspendre à titre conservatoire jusqu\'à la décision (rémunération maintenue)', 'checkbox'),
        f('dureeConservatoire', 'Durée de la suspension (jours)', 'number', { half: true, showIf: (champs) => !!champs.miseAPiedConservatoire, help: `Maximum ${MAX_CONSERVATOIRE_JOURS} jours.` }),
    ],
    sanction: [
        f('convocationRefId', 'Convocation à l\'entretien préalable', 'convocationRef', { required: true, help: 'La sanction ne peut être notifiée qu\'après un entretien précédé d\'une convocation.' }),
        f('typeSanction', 'Sanction prononcée', 'select', { required: true, half: true, options: Object.entries(SANCTIONS).map(([value, label]) => ({ value, label })) }),
        f('dateEffet', 'Date d\'effet', 'date', { required: true, half: true }),
        f('dureeJours', 'Durée de la mise à pied (jours)', 'number', { half: true, showIf: (champs) => champs.typeSanction === 'mise_a_pied', help: `Maximum ${MAX_MISE_A_PIED_JOURS} jours.` }),
        f('nouveauRole', 'Grade après rétrogradation', 'role', { half: true, showIf: (champs) => champs.typeSanction === 'retrogradation' }),
        f('faitsRetenus', 'Faits retenus', 'textarea', { required: true, placeholder: 'Les faits établis à l\'issue de l\'entretien (pas davantage que ceux de la convocation).' }),
        f('motivation', 'Motivation de la décision', 'textarea', { placeholder: 'Réponse aux explications de la personne, circonstances prises en compte.' }),
    ],
    fin: [
        f('motif', 'Motif de la fin du contrat', 'select', { required: true, options: Object.entries(FIN_MOTIFS).map(([value, label]) => ({ value, label })) }),
        f('contratRefId', 'Contrat concerné', 'contratRef', { required: true, help: 'Sert à établir l\'attestation de fin de fonctions (dates, fonction, grade).' }),
        f('dateEffet', 'Date de fin effective', 'date', { required: true, half: true }),
        f('dateRemiseDemission', 'Date de remise de la démission', 'date', { required: true, half: true, showIf: (champs) => champs.motif === 'demission' }),
        f('preavisJours', 'Préavis (jours)', 'number', { half: true, showIf: (champs) => ['demission', 'licenciement', 'licenciement_disciplinaire'].includes(champs.motif), help: 'Usage : 14 jours pour une démission, 30 jours pour un licenciement (art. 14 du contrat).' }),
        f('preavisDispense', 'Employé(e) dispensé(e) d\'exécuter son préavis (rémunéré)', 'checkbox', { showIf: (champs) => ['demission', 'licenciement'].includes(champs.motif) }),
        f('convocationRefId', 'Convocation à l\'entretien préalable', 'convocationRef', { required: true, showIf: (champs) => ['licenciement', 'licenciement_disciplinaire'].includes(champs.motif) }),
        f('fauteGrave', 'Faute grave (rupture immédiate, sans préavis)', 'checkbox', { showIf: (champs) => champs.motif === 'licenciement_disciplinaire' }),
        f('baseLegale', 'Fondement', 'select', {
            required: true, showIf: (champs) => champs.motif === 'plein_droit',
            options: Object.entries(FIN_BASES_LEGALES).map(([value, label]) => ({ value, label })),
        }),
        f('motifsDetailles', 'Motifs détaillés', 'textarea', {
            placeholder: 'Les motifs doivent être précis et vérifiables : ils peuvent être exigés par l\'employé(e) (Code du Gouvernement, art. 325).',
            showIf: (champs) => !['fin_cdd', 'fin_stage'].includes(champs.motif),
        }),
        f('restitutions', 'Restitutions et clôture des accès', 'textarea', { placeholder: 'Badge, clés, matériel, comptes… (par défaut : badge, matériel, accès informatiques).' }),
        f('validiteOffreJours', 'Validité de l\'offre de rupture (jours)', 'number', { half: true, showIf: (champs) => champs.motif === 'rupture_amiable', required: true }),
    ],
};

export const fieldsFor = (typeKey) => FIELDS[CONTRACT_TYPES[typeKey] ? typeKey : 'cdi'];

const isVisible = (field, champs, ctx) => (field.showIf ? !!field.showIf(champs, ctx) : true);
export const visibleFields = (typeKey, champs, ctx) => fieldsFor(typeKey).filter((field) => isVisible(field, champs, ctx));

// Valeurs initiales d'un nouveau document.
export const emptyContractFields = (typeKey = 'cdi') => {
    const champs = { typeContrat: CONTRACT_TYPES[typeKey] ? typeKey : 'cdi' };
    fieldsFor(champs.typeContrat).forEach((field) => { champs[field.key] = field.type === 'checkbox' ? false : ''; });
    if ('validiteOffreJours' in champs) champs.validiteOffreJours = '7';
    if (champs.typeContrat === 'fin') champs.preavisJours = '';
    if (champs.typeContrat === 'convocation') champs.lieuEntretien = 'Direction du Pillbox Hill Medical Center, Pillbox Hill';
    return champs;
};

// ───────────────────────────── Dates ─────────────────────────────

const daysBetween = (isoA, isoB) => {
    const a = parseIsoDate(isoA);
    const b = parseIsoDate(isoB);
    return a && b ? Math.round((b - a) / 86400000) : null;
};

const entretienTimestamp = (champs) => {
    const date = parseIsoDate(champs.dateEntretien);
    if (!date) return null;
    const [h, m] = String(champs.heureEntretien || '00:00').split(':').map(Number);
    date.setHours(h || 0, m || 0, 0, 0);
    return date.getTime();
};
export { entretienTimestamp };

// ───────────────────────────── Validation ─────────────────────────────
// ctx : { refContract, convocation, now } ; options.forSend : contrôles de l'envoi (délais de la procédure).
// Retourne { errors, warnings } : les erreurs bloquent, les avertissements demandent une confirmation.
export const validateDocFields = (typeKey, champsInput, ctx = {}, { forSend = false } = {}) => {
    const champs = { ...emptyContractFields(typeKey), ...champsInput };
    const errors = [];
    const warnings = [];
    const now = ctx.now || Date.now();

    visibleFields(typeKey, champs, ctx).forEach((field) => {
        if (!field.required) return;
        const value = champs[field.key];
        if (field.type === 'checkbox') return;
        if (value === undefined || value === null || String(value).trim() === '') errors.push(`« ${field.label} » est obligatoire.`);
    });

    const intField = (key, label, { min = 0, max = null } = {}) => {
        const raw = champs[key];
        if (raw === '' || raw === undefined || raw === null) return null;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < min) { errors.push(`« ${label} » doit être un nombre entier de jours (${min} ou plus).`); return null; }
        if (max !== null && n > max) errors.push(`« ${label} » ne peut pas dépasser ${max} jours.`);
        return n;
    };

    if (champs.validiteOffreJours !== undefined && champs.validiteOffreJours !== '' && champs.validiteOffreJours !== null) {
        const days = Number(champs.validiteOffreJours);
        if (!Number.isInteger(days) || days < 1 || days > 90) errors.push('La validité de l\'offre doit être comprise entre 1 et 90 jours.');
    }

    if (typeKey === 'cdi' || typeKey === 'cdd' || typeKey === 'stage') {
        if (!champs.role) errors.push('Le grade est obligatoire.');
        if (typeKey === 'cdi') intField('essaiJours', 'Période d\'essai', { max: 60 });
        if (typeKey === 'cdd' || typeKey === 'stage') {
            const span = daysBetween(champs.dateDebut, champs.dateFin);
            if (champs.dateDebut && champs.dateFin && span < 0) errors.push('La date de fin précède la date de début.');
            if (typeKey === 'cdd') {
                const essai = intField('essaiJours', 'Période d\'essai', { max: 30 });
                if (essai && span !== null && span >= 0 && essai > Math.floor((span + 1) / 2)) errors.push('La période d\'essai ne peut pas dépasser la moitié de la durée du CDD.');
            }
        }
        if (forSend && champs.dateDebut) {
            const diff = daysBetween(toIsoDate(now), champs.dateDebut);
            if (diff !== null && diff < 0) warnings.push('La date de prise d\'effet est déjà passée.');
        }
    }

    if (typeKey === 'avenant') {
        const ref = ctx.refContract;
        if (ref && ref.statut !== 'signe') errors.push('Le contrat modifié doit être signé.');
        const changes = [];
        if (champs.nouveauPoste && champs.nouveauPoste.trim() !== (ref?.champs?.poste || '')) changes.push('fonction');
        if (champs.nouveauRole && normalizeRank(champs.nouveauRole) !== normalizeRank(ref?.champs?.role)) changes.push('grade');
        if (champs.nouvelleAffectation && champs.nouvelleAffectation.trim() !== (ref?.champs?.affectation || '')) changes.push('affectation');
        if (champs.nouvelleRemuneration && champs.nouvelleRemuneration.trim() !== (ref?.champs?.remuneration || '')) changes.push('rémunération');
        if (champs.nouveauxHoraires && champs.nouveauxHoraires.trim() !== (ref?.champs?.horaires || '')) changes.push('horaires');
        if (champs.nouveauResponsable && champs.nouveauResponsable.trim() !== (ref?.champs?.responsable || '')) changes.push('responsable');
        if (champs.nouvelleDateFin && champs.nouvelleDateFin !== ref?.champs?.dateFin) changes.push('terme');
        if (champs.transformationCdi) changes.push('transformation en CDI');
        if (ref && changes.length === 0) errors.push('L\'avenant ne modifie rien : renseignez au moins une nouvelle condition différente du contrat actuel.');
        if (champs.nouvelleDateFin && ref?.champs?.dateDebut && champs.nouvelleDateFin < ref.champs.dateDebut) errors.push('La nouvelle date de fin précède le début du contrat.');
        if (champs.transformationCdi && champs.nouvelleDateFin) errors.push('Un CDD transformé en CDI n\'a plus de date de fin : retirez la nouvelle date de fin.');
    }

    if (typeKey === 'convocation') {
        const conservatoire = intField('dureeConservatoire', 'Durée de la suspension', { min: 1, max: MAX_CONSERVATOIRE_JOURS });
        if (champs.miseAPiedConservatoire && conservatoire === null) errors.push('Indiquez la durée de la suspension conservatoire.');
        const when = entretienTimestamp(champs);
        if (forSend && when !== null && when < now + CONVOCATION_DELAI_HEURES * 3600000) {
            errors.push(`L'entretien doit avoir lieu au moins ${CONVOCATION_DELAI_HEURES} heures après l'envoi de la convocation (article « Discipline » du contrat).`);
        }
    }

    const checkProcedure = (convocation) => {
        if (!convocation) { errors.push('Choisissez la convocation à l\'entretien préalable.'); return; }
        if (convocation.statut === 'brouillon') { errors.push('La convocation n\'a pas encore été envoyée.'); return; }
        const when = entretienTimestamp(convocation.champs);
        if (when === null) return;
        if (forSend) {
            if (when > now) errors.push('L\'entretien préalable n\'a pas encore eu lieu : la décision ne peut être notifiée qu\'après.');
            if (convocation.envoyeLe && when < convocation.envoyeLe + CONVOCATION_DELAI_HEURES * 3600000) {
                errors.push(`Le délai de ${CONVOCATION_DELAI_HEURES} heures entre la convocation et l'entretien n'a pas été respecté : la procédure est irrégulière, convoquez à nouveau.`);
            }
            if (when <= now && now - when > DECISION_DELAI_JOURS * 86400000) {
                warnings.push(`L'entretien date de plus de ${DECISION_DELAI_JOURS} jours : le contrat impose de notifier la décision dans ce délai.`);
            }
        }
    };

    if (typeKey === 'sanction') {
        checkProcedure(ctx.convocation);
        if (ctx.convocation && ctx.convocation.champs.objet !== 'sanction') errors.push('Cette convocation visait un licenciement, pas une sanction.');
        if (champs.typeSanction === 'mise_a_pied') {
            const days = intField('dureeJours', 'Durée de la mise à pied', { min: 1, max: MAX_MISE_A_PIED_JOURS });
            if (days === null) errors.push('Indiquez la durée de la mise à pied.');
        }
        if (champs.typeSanction === 'retrogradation' && !champs.nouveauRole) errors.push('Indiquez le grade après rétrogradation.');
    }

    if (typeKey === 'fin') {
        if (ctx.refContract && ctx.refContract.statut !== 'signe') errors.push('Le contrat concerné doit être signé.');
        if (['licenciement', 'licenciement_disciplinaire'].includes(champs.motif)) {
            checkProcedure(ctx.convocation);
            if (ctx.convocation && ctx.convocation.champs.objet !== 'licenciement') errors.push('Cette convocation visait une sanction, pas un licenciement : convoquez à nouveau pour un licenciement.');
            if (!String(champs.motifsDetailles || '').trim()) errors.push('Les motifs détaillés sont obligatoires pour un licenciement (Code du Gouvernement, art. 325).');
        }
        if (champs.motif === 'plein_droit' && !String(champs.motifsDetailles || '').trim()) errors.push('Précisez les circonstances de la fin de plein droit.');
        if (champs.motif === 'fin_cdd' && ctx.refContract && ctx.refContract.champs.typeContrat !== 'cdd') errors.push('Le contrat concerné n\'est pas un CDD.');
        if (champs.motif === 'fin_stage' && ctx.refContract && ctx.refContract.champs.typeContrat !== 'stage') errors.push('Le contrat concerné n\'est pas une convention de stage.');
        intField('preavisJours', 'Préavis', { max: 90 });
        if (champs.dateEffet && ctx.refContract?.champs?.dateDebut && champs.dateEffet < ctx.refContract.champs.dateDebut) errors.push('La date de fin précède le début du contrat.');
    }

    return { errors, warnings };
};

// ───────────────────────────── Construction ─────────────────────────────

// Référence du document : PHMC-RH-2026-AB12C (service, année, 5 derniers caractères de l'identifiant). Avant l'enregistrement (aperçu), « XXXXX ».
export const buildReference = ({ service, id, timestamp }) => {
    const year = new Date(timestamp || Date.now()).getFullYear();
    const suffix = id ? String(id).replace(/[^A-Za-z0-9]/g, '').slice(-5).toUpperCase() : 'XXXXX';
    return `${service === 'coroner' ? 'DMEC' : 'PHMC'}-RH-${year}-${suffix}`;
};

// Document structuré → BBCode (avec les repères de signature de l'employé, voir generateContract).
// ctx : { type, service, employeeName, employeeBadge, champs, issuer:{ name, title, signatureUrl }, id, timestamp, refContract, convocation }
export const buildContractBb = (ctx) => {
    const champs = { ...emptyContractFields(ctx.type), ...ctx.champs };
    const timestamp = ctx.timestamp || Date.now();
    const reference = buildReference({ service: ctx.service, id: ctx.id, timestamp });
    const content = buildDocumentContent({ ...ctx, champs, timestamp, reference });
    const bbCode = generateContract({ ...content, reference, service: ctx.service, dateText: `Édité le ${formatTimestampDateFr(timestamp)}` });
    return { bbCode, title: content.title, reference, plain: bbToPlainText(bbCode) };
};

// Texte brut (copier le texte, recherche) : on retire simplement les balises.
export const bbToPlainText = (bbCode) => String(bbCode || '')
    .replace(/\[img\][^[]*\[\/img\]/gi, '')
    .replace(/\[\/(tr|table|list|divbox|divboxcolor|center|justify)\]/gi, '\n')
    .replace(/\[\*\]/g, '• ')
    .replace(/\[\/td\]|\[td[^\]]*\]/gi, ' | ')
    .replace(/\[br\]\[\/br\]|\[hr\]\[\/hr\]/gi, '\n')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
