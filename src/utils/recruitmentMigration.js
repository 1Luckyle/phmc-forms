// src/utils/recruitmentMigration.js
//
// Migration « Recrutement en français » : déplace vers le schéma français (voir constants/recruitment.js)
//   • les POSTES de recrutement  : selectOptions/physicianRecruitmentDetails… -> selectOptions/postesMedecine… ;
//     champs et statuts en français, clé = nom français du poste, rôle du personnel relié, textes d'origine
//     traduits SEULEMENT s'ils sont restés identiques à l'original (voir data/recruitmentSeedFr.js) ;
//   • les CANDIDATURES           : jobApplications -> candidatures (champs, statuts et poste en français) ;
//   • les CONTRATS               : contracts -> contrats, contractsByEmployee -> contratsParEmploye ;
//   • les rôles « en attente de contrat » : contractCandidates -> candidatsContrat ;
//   • le droit RECRUTEUR         : recruiterUIDs -> recruteurs.
//
// Étapes : planRecruitmentMigration() (lecture seule) -> applyRecruitmentMigration() (COPIE vers les nouveaux
// nœuds, sans rien supprimer : l'ancien schéma reste intact et lisible) -> cleanupLegacyRecruitment() (après
// vérification : sauvegarde des anciens nœuds dans migrationBackups puis suppression).
import { ref, get, set, update, remove } from 'firebase/database';
import { database } from '../firebase';
import {
    RECRUITMENT_CATEGORIES, normalizePosition, toStoredPosition, makePositionKey, normalizeApplication, toStoredApplication,
} from '../constants/recruitment';
import { normalizeRank } from '../constants/ranks';
import { normalizeContract } from './contracts';
import { normalizeContractCandidate } from './contractCandidates';
import SEED_EN from '../data/recruitmentSeedEn.json';

const squash = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

// [champ français, ancien champ anglais, champ du seed anglais]
const TEXT_FIELDS = [
    ['presentation', 'Overview', 'Overview'],
    ['competence1', 'skill1', 'skill1'],
    ['competence2', 'skill2', 'skill2'],
    ['competence3', 'skill3', 'skill3'],
    ['diplome', 'EduRequirement', 'EduRequirement'],
];

const LEGACY_NODES = ['contracts', 'contractsByEmployee', 'contractCandidates', 'recruiterUIDs', 'jobApplications'];

const readNode = async (path) => {
    try {
        const snap = await get(ref(database, path));
        return snap.exists() ? snap.val() : {};
    } catch (error) {
        console.warn(`Lecture impossible de ${path} :`, error);
        return {};
    }
};

// ───────────────────────────── Plan (lecture seule) ─────────────────────────────
export async function planRecruitmentMigration({ translate = true } = {}) {
    const { POSTES_FR } = await import('../data/recruitmentSeedFr');

    // Postes
    const positions = [];
    const keyMap = {}; // ancienne clé -> nouvelle clé (pour les candidatures)
    for (const category of RECRUITMENT_CATEGORIES) {
        const [legacy, current] = await Promise.all([readNode(`selectOptions/${category.legacyNode}`), readNode(`selectOptions/${category.node}`)]);
        for (const [oldKey, raw] of Object.entries(legacy)) {
            if (!raw) continue;
            const base = normalizePosition(raw, category.key, oldKey);
            const seedEn = SEED_EN[category.key]?.[oldKey];
            const fr = POSTES_FR[oldKey];
            const translated = [];
            const toTranslate = [];
            const next = { ...base };

            // Nom : traduit uniquement s'il est resté celui d'origine.
            let nameTranslated = false;
            if (translate && fr && seedEn && squash(raw.displayName ?? raw.nom) === squash(seedEn.displayName)) {
                next.nom = fr.nom;
                nameTranslated = true;
                translated.push('nom');
            }
            TEXT_FIELDS.forEach(([frenchField, legacyField, seedField]) => {
                const value = raw[frenchField] ?? raw[legacyField];
                if (value === undefined || value === null || squash(value) === '') return;
                if (translate && fr && seedEn && squash(value) === squash(seedEn[seedField]) && fr[frenchField]) {
                    next[frenchField] = fr[frenchField];
                    translated.push(frenchField);
                } else {
                    toTranslate.push(frenchField);
                }
            });
            if (!next.role && fr?.role) next.role = fr.role;
            next.role = next.role ? normalizeRank(next.role) : '';

            const newKey = nameTranslated && fr?.cle ? fr.cle : makePositionKey(next.nom || oldKey);
            keyMap[oldKey] = newKey;
            positions.push({
                category: category.key,
                categoryLabel: category.label,
                node: category.node,
                oldKey,
                newKey,
                position: next,
                translated,
                toTranslate,
                roleMissing: !next.role,
                alreadyDone: !!current[newKey],
            });
        }
    }

    // Candidatures
    const [legacyApps, currentApps] = await Promise.all([readNode('jobApplications'), readNode('candidatures')]);
    const applications = [];
    Object.entries(legacyApps).forEach(([uid, apps]) => {
        Object.entries(apps || {}).forEach(([id, raw]) => {
            applications.push({ uid, id, raw, alreadyDone: !!currentApps?.[uid]?.[id] });
        });
    });

    // Contrats, index, rôles « en attente de contrat », drapeaux recruteur
    const [contracts, contractIndex, candidates, recruiters, currentContracts, currentIndex, currentCandidates, currentRecruiters] = await Promise.all([
        readNode('contracts'), readNode('contractsByEmployee'), readNode('contractCandidates'), readNode('recruiterUIDs'),
        readNode('contrats'), readNode('contratsParEmploye'), readNode('candidatsContrat'), readNode('recruteurs'),
    ]);

    return {
        positions,
        keyMap,
        applications,
        contracts: Object.entries(contracts).map(([id, raw]) => ({ id, raw, alreadyDone: !!currentContracts[id] })),
        contractIndex: Object.entries(contractIndex).map(([uid, entries]) => ({ uid, entries, alreadyDone: !!currentIndex[uid] })),
        candidates: Object.entries(candidates).map(([uid, raw]) => ({ uid, raw, alreadyDone: !!currentCandidates[uid] })),
        recruiters: Object.entries(recruiters).filter(([, value]) => value === true).map(([uid]) => ({ uid, alreadyDone: currentRecruiters[uid] === true })),
    };
}

export const summarizePlan = (plan) => {
    const todo = (items) => items.filter((item) => !item.alreadyDone).length;
    return {
        positions: todo(plan.positions),
        applications: todo(plan.applications),
        contracts: todo(plan.contracts),
        contractIndex: todo(plan.contractIndex),
        candidates: todo(plan.candidates),
        recruiters: todo(plan.recruiters),
        total: todo(plan.positions) + todo(plan.applications) + todo(plan.contracts) + todo(plan.contractIndex) + todo(plan.candidates) + todo(plan.recruiters),
        toTranslate: plan.positions.filter((item) => item.toTranslate.length > 0).length,
        roleMissing: plan.positions.filter((item) => item.roleMissing).length,
    };
};

// ───────────────────────────── Application (copie) ─────────────────────────────
const writeInChunks = async (writes) => {
    const entries = Object.entries(writes);
    for (let i = 0; i < entries.length; i += 100) {
        await update(ref(database), Object.fromEntries(entries.slice(i, i + 100)));
    }
};

export async function applyRecruitmentMigration(plan) {
    const writes = {};

    plan.positions.filter((item) => !item.alreadyDone).forEach((item) => {
        writes[`selectOptions/${item.node}/${item.newKey}`] = toStoredPosition({ ...item.position, groupe: item.category });
    });

    plan.applications.filter((item) => !item.alreadyDone).forEach((item) => {
        const application = normalizeApplication(item.raw, item.id, item.uid);
        const mapped = plan.keyMap[application.poste];
        if (mapped) application.poste = mapped;
        if (application.donnees && plan.keyMap[application.donnees.recruitmentPosition]) {
            application.donnees = { ...application.donnees, recruitmentPosition: plan.keyMap[application.donnees.recruitmentPosition] };
        }
        writes[`candidatures/${item.uid}/${item.id}`] = toStoredApplication(application);
    });

    plan.contracts.filter((item) => !item.alreadyDone).forEach((item) => {
        const contract = normalizeContract(item.raw, item.id);
        const { id, ...stored } = contract; // eslint-disable-line no-unused-vars
        writes[`contrats/${item.id}`] = stored;
    });
    plan.contractIndex.filter((item) => !item.alreadyDone).forEach((item) => {
        writes[`contratsParEmploye/${item.uid}`] = item.entries;
    });
    plan.candidates.filter((item) => !item.alreadyDone).forEach((item) => {
        writes[`candidatsContrat/${item.uid}`] = normalizeContractCandidate(item.raw);
    });
    plan.recruiters.filter((item) => !item.alreadyDone).forEach((item) => {
        writes[`recruteurs/${item.uid}`] = true;
    });

    await writeInChunks(writes);
    return { written: Object.keys(writes).length };
}

// ───────────────────────────── Nettoyage (après vérification) ─────────────────────────────
// Sauvegarde les anciens nœuds puis les supprime. Refuse s'il reste quelque chose à migrer.
export async function cleanupLegacyRecruitment() {
    const plan = await planRecruitmentMigration({ translate: false });
    const left = summarizePlan(plan).total;
    if (left > 0) throw new Error(`Il reste ${left} élément(s) à migrer : lancez d'abord la migration.`);

    const backupId = `recrutement_${Date.now()}`;
    const legacyPositionNodes = RECRUITMENT_CATEGORIES.map((category) => `selectOptions/${category.legacyNode}`);
    const paths = [...LEGACY_NODES, ...legacyPositionNodes];

    const backup = {};
    for (const path of paths) {
        const value = await readNode(path);
        if (Object.keys(value).length > 0) backup[path.replace(/\//g, '__')] = value;
    }
    await set(ref(database, `migrationBackups/${backupId}`), { createdAt: Date.now(), nodes: Object.keys(backup), data: backup });

    for (const path of paths) {
        if (backup[path.replace(/\//g, '__')]) await remove(ref(database, path));
    }
    return { backupId, removed: Object.keys(backup).length };
}
