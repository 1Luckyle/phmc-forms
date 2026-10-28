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

// ───────────────────────────── Migration automatique (une seule fois) ─────────────────────────────
// Lancée à la première ouverture du panneau admin : copie vers le schéma français, vérifie qu'il ne reste rien à migrer, SAUVEGARDE
// les anciens nœuds (migrationBackups) puis les supprime. Aucun texte modifié à la main n'est écrasé (voir planRecruitmentMigration :
// seuls les textes restés identiques à l'original sont traduits). L'état est gardé dans adminSettings/migrationRecrutement.
// Retourne null si c'était déjà fait ; sinon { copied, removed, backupId, textsToReview }. Ne lève pas : échec = on réessaiera.
export async function runRecruitmentMigrationOnce(by = null) {
    try {
        const flagRef = ref(database, 'adminSettings/migrationRecrutement');
        const flag = await get(flagRef);
        if (flag.exists() && flag.val()?.termine) return null;

        const plan = await planRecruitmentMigration({ translate: true });
        const summary = summarizePlan(plan);
        const copied = summary.total > 0 ? (await applyRecruitmentMigration(plan)).written : 0;
        const cleaned = await cleanupLegacyRecruitment(); // refuse s'il reste quelque chose à migrer
        // Le drapeau est posé même si une suppression a échoué (`restants`) : sinon la migration se relançait à CHAQUE
        // ouverture du panneau admin. Les nœuds restants se suppriment alors à la main dans la console Firebase.
        await set(flagRef, {
            termine: true, par: by, le: Date.now(), ecritures: copied, sauvegarde: cleaned.backupId,
            ...(cleaned.failed.length > 0 ? { restants: cleaned.failed } : {}),
        });
        return { copied, removed: cleaned.removed, backupId: cleaned.backupId, textsToReview: summary.toTranslate };
    } catch (error) {
        console.warn('Migration du recrutement : non terminée, nouvel essai à la prochaine ouverture.', error?.message || error);
        return null;
    }
}

// ───────────────────────────── Nettoyage (après vérification) ─────────────────────────────
// Sauvegarde les anciens nœuds puis les supprime. Refuse s'il reste quelque chose à migrer.
//
// La sauvegarde a un id FIXE et s'écrit par `update` : un nouvel essai réécrit la même sauvegarde au lieu d'en
// empiler une de plus (46 Ko chacune, une par ouverture du panneau admin avant ce correctif), et il ne perd pas ce
// qu'un essai précédent avait déjà sauvegardé puis supprimé. Rien n'est sauvegardé si aucun ancien nœud n'existe.
const BACKUP_ID = 'recrutement_legacy';

// Supprime un ancien nœud. Les règles n'autorisent l'écriture de jobApplications qu'au niveau
// {uid}/{candidature} : supprimer le nœud entier est REFUSÉ, d'où le repli enfant par enfant.
async function removeLegacyNode(path) {
    try {
        await remove(ref(database, path));
        return;
    } catch (error) {
        const value = await readNode(path);
        for (const [childKey, child] of Object.entries(value)) {
            if (child && typeof child === 'object') {
                for (const grandChildKey of Object.keys(child)) {
                    await remove(ref(database, `${path}/${childKey}/${grandChildKey}`));
                }
            } else {
                await remove(ref(database, `${path}/${childKey}`));
            }
        }
    }
}

export async function cleanupLegacyRecruitment() {
    const plan = await planRecruitmentMigration({ translate: false });
    const left = summarizePlan(plan).total;
    if (left > 0) throw new Error(`Il reste ${left} élément(s) à migrer : lancez d'abord la migration.`);

    const legacyPositionNodes = RECRUITMENT_CATEGORIES.map((category) => `selectOptions/${category.legacyNode}`);
    const paths = [...LEGACY_NODES, ...legacyPositionNodes];

    const backup = {};
    for (const path of paths) {
        const value = await readNode(path);
        if (Object.keys(value).length > 0) backup[path.replace(/\//g, '__')] = value;
    }
    const present = Object.keys(backup);
    if (present.length === 0) return { backupId: BACKUP_ID, removed: 0, failed: [] };

    const knownRaw = await readNode(`migrationBackups/${BACKUP_ID}/nodes`);
    const known = Array.isArray(knownRaw) ? knownRaw : Object.values(knownRaw);
    const backupUpdate = { majLe: Date.now(), nodes: [...new Set([...known, ...present])] };
    if (known.length === 0) backupUpdate.createdAt = Date.now();
    present.forEach((key) => { backupUpdate[`data/${key}`] = backup[key]; });
    await update(ref(database, `migrationBackups/${BACKUP_ID}`), backupUpdate);

    // Un échec n'arrête pas les autres suppressions : on continue et on le signale (`failed`).
    const failed = [];
    for (const path of paths) {
        if (!backup[path.replace(/\//g, '__')]) continue;
        try {
            await removeLegacyNode(path);
        } catch (error) {
            console.warn(`Suppression impossible de ${path} :`, error?.message || error);
            failed.push(path);
        }
    }
    return { backupId: BACKUP_ID, removed: present.length - failed.length, failed };
}
