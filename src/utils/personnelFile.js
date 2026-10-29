// src/utils/personnelFile.js
//
// « Dossier du personnel » : à partir des documents contractuels d'une personne (contrats, avenants, convocations, sanctions, fins de contrat),
// construit la chronologie et le résumé de sa situation (contrat en cours, conditions actuelles après avenants, procédures disciplinaires ouvertes).
// Module PUR (aucun accès Firebase) : les documents viennent de utils/contracts.js (loadAllContracts) déjà normalisés.
import { normalizeRank } from '../constants/ranks';
import { typeOfChamps, isEmploymentType, CONTRACT_TYPE_INFO } from './contractDocs';

// Date qui range un document dans la chronologie : signature, sinon envoi, sinon création.
export const eventDate = (contract) => contract.signeLe || contract.envoyeLe || contract.creeLe || 0;

const typeOf = (contract) => typeOfChamps(contract.champs);

// Jour courant « AAAA-MM-JJ » (heure locale), comparable aux dates des champs date.
const isoDay = (now) => {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Conditions en vigueur d'un contrat : celles du contrat, modifiées dans l'ordre par ses avenants SIGNÉS dont la date d'effet est atteinte (un avenant
// qui prend effet plus tard est compté dans `avenantsAVenir`, sans changer les conditions actuelles).
export const effectiveConditions = (contract, avenants = [], now = Date.now()) => {
    const today = isoDay(now);
    const base = contract.champs || {};
    const conditions = {
        type: base.typeContrat,
        poste: base.poste || '',
        role: normalizeRank(base.role) || '',
        affectation: base.affectation || '',
        remuneration: base.remuneration || '',
        echelon: base.echelon || '',
        horaires: base.horaires || '',
        responsable: base.responsable || '',
        dateDebut: base.dateDebut || '',
        dateFin: base.dateFin || '',
        avenants: 0,
        avenantsAVenir: 0,
    };
    const signed = [...avenants]
        .filter((a) => a.statut === 'signe' && a.champs?.contratRefId === contract.id)
        .sort((a, b) => String(a.champs.dateEffet || '').localeCompare(String(b.champs.dateEffet || '')));
    conditions.avenantsAVenir = signed.filter((a) => a.champs.dateEffet && a.champs.dateEffet > today).length;
    signed
        .filter((a) => !a.champs.dateEffet || a.champs.dateEffet <= today)
        .forEach((avenant) => {
            const c = avenant.champs;
            if (c.nouveauPoste) conditions.poste = c.nouveauPoste;
            if (c.nouveauRole) conditions.role = normalizeRank(c.nouveauRole);
            if (c.nouvelleAffectation) conditions.affectation = c.nouvelleAffectation;
            if (c.nouvelleRemuneration) conditions.remuneration = c.nouvelleRemuneration;
            if (c.nouveauxHoraires) conditions.horaires = c.nouveauxHoraires;
            if (c.nouveauResponsable) conditions.responsable = c.nouveauResponsable;
            if (c.nouvelleDateFin) conditions.dateFin = c.nouvelleDateFin;
            if (c.transformationCdi) { conditions.type = 'cdi'; conditions.dateFin = ''; }
            conditions.avenants += 1;
        });
    return conditions;
};

// Dossier d'une personne. `contracts` : tous les documents normalisés (ceux des autres personnes sont ignorés).
// Retourne { timeline, employment, active, procedures, counts, drafts }.
//   timeline   : tous les documents envoyés ou signés, du plus récent au plus ancien (les brouillons sont comptés à part) ;
//   employment : les contrats signés, avec leurs conditions en vigueur et la notification de fin éventuelle ;
//   active     : le contrat signé le plus récent qui n'a pas de notification de fin et dont le terme n'est pas passé, avec ses conditions actuelles ;
//   lapsed     : à défaut, un contrat sans notification de fin dont le terme (CDD, stage) est PASSÉ : échu, à régulariser ;
//   procedures : les convocations à un entretien préalable restées sans décision (sanction ou fin de contrat).
export const buildPersonnelFile = (contracts, uid, now = Date.now()) => {
    const today = isoDay(now);
    const docs = (contracts || []).filter((c) => c.employeUid === uid);
    const sent = docs.filter((c) => c.statut !== 'brouillon');
    const drafts = docs.filter((c) => c.statut === 'brouillon');

    const timeline = [...sent].sort((a, b) => eventDate(b) - eventDate(a));

    const avenants = sent.filter((c) => typeOf(c) === 'avenant');
    const fins = sent.filter((c) => typeOf(c) === 'fin');

    const employment = sent
        .filter((c) => isEmploymentType(typeOf(c)) && c.statut === 'signe')
        .sort((a, b) => (b.signeLe || 0) - (a.signeLe || 0))
        .map((contract) => ({
            contract,
            conditions: effectiveConditions(contract, avenants, now),
            end: fins.find((f) => f.champs?.contratRefId === contract.id) || null,
        }));

    const open = employment.filter((entry) => !entry.end);
    const isLapsed = (entry) => !!entry.conditions.dateFin && entry.conditions.dateFin < today;
    const active = open.find((entry) => !isLapsed(entry)) || null;
    const lapsed = active ? null : (open.find(isLapsed) || null);

    const decisions = sent.filter((c) => ['sanction', 'fin'].includes(typeOf(c)));
    const procedures = sent
        .filter((c) => typeOf(c) === 'convocation')
        .filter((conv) => !decisions.some((d) => d.champs?.convocationRefId === conv.id))
        .sort((a, b) => (b.envoyeLe || 0) - (a.envoyeLe || 0));

    const counts = {};
    sent.forEach((c) => { const type = typeOf(c); counts[type] = (counts[type] || 0) + 1; });

    return { timeline, employment, active, lapsed, procedures, counts, drafts };
};

// Groupe de couleur d'un document dans la chronologie (contrat, avenant, procédure, fin).
export const timelineGroup = (contract) => CONTRACT_TYPE_INFO[typeOf(contract)]?.group || 'contrat';
