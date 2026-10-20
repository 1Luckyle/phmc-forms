// src/utils/staffRankMigration.js
//
// Migration des rôles du personnel vers le référentiel FRANÇAIS (voir constants/ranks.js) :
// pour chaque fiche de staff/phmc et staff/coroner, `rank` et `category` prennent l'équivalent français
// de l'ancienne valeur anglaise et le champ `pole` (famille) est posé. Rien d'autre n'est touché : ni le
// badge (le préfixe des rôles existants est conservé), ni le nom, ni les rapports.
//   1. planRankMigration()      lecture seule : ce qui changerait (« essai à blanc ») ;
//   2. applyRankMigration()     sauvegarde les anciennes valeurs (migrationBackups/roles_…) puis écrit ;
//   3. restoreRankBackup()      remet les anciennes valeurs d'une sauvegarde.
import { ref, get, set, update } from 'firebase/database';
import { database } from '../firebase';
import { STAFF_SERVICES } from './staffAdmin';
import { getEmployeeDisplayName } from './employeeName';
import { LEGACY_RANK_MAP, ROLE_BY_VALUE, STAFF_FAMILIES, normalizeRank, familyOfRank } from '../constants/ranks';

const BACKUP_PREFIX = 'roles_';

export async function planRankMigration() {
    const items = [];
    for (const service of Object.values(STAFF_SERVICES)) {
        const snap = await get(ref(database, service.path));
        if (!snap.exists()) continue;
        Object.entries(snap.val() || {}).forEach(([key, entry]) => {
            if (!entry) return;
            const from = entry.rank ?? entry.category ?? '';
            const to = normalizeRank(from);
            const known = !!ROLE_BY_VALUE[to];
            const pole = known ? familyOfRank(to, service.key) : null;
            // Un rôle d'une autre liste (ex. rôle DMEC dans la liste PHMC) n'est pas migré automatiquement.
            const wrongList = known && STAFF_FAMILIES[pole].service !== service.key;
            const changed = known && !wrongList
                && (entry.rank !== to || entry.category !== to || entry.pole !== pole);
            items.push({
                service: service.key,
                path: `${service.path}/${key}`,
                name: getEmployeeDisplayName(entry) || entry.name || key,
                from, to, pole,
                ambiguous: !!LEGACY_RANK_MAP[from]?.ambiguous,
                unknown: !known,
                wrongList,
                changed,
                before: { rank: entry.rank ?? null, category: entry.category ?? null, pole: entry.pole ?? null },
            });
        });
    }
    return items;
}

export async function applyRankMigration(items, byEmail = null) {
    const todo = items.filter((item) => item.changed);
    if (todo.length === 0) return { migrated: 0, backupId: null };
    const backupId = `${BACKUP_PREFIX}${Date.now()}`;
    await set(ref(database, `migrationBackups/${backupId}`), {
        createdAt: Date.now(),
        by: byEmail,
        entries: todo.map((item) => ({ path: item.path, name: item.name, ...item.before })),
    });
    const writes = {};
    todo.forEach((item) => {
        writes[`${item.path}/rank`] = item.to;
        writes[`${item.path}/category`] = item.to;
        writes[`${item.path}/pole`] = item.pole;
    });
    const entries = Object.entries(writes);
    for (let i = 0; i < entries.length; i += 150) {
        await update(ref(database), Object.fromEntries(entries.slice(i, i + 150)));
    }
    return { migrated: todo.length, backupId };
}

export async function loadRankBackups() {
    const snap = await get(ref(database, 'migrationBackups'));
    if (!snap.exists()) return [];
    return Object.entries(snap.val())
        .filter(([id, value]) => id.startsWith(BACKUP_PREFIX) && value?.entries)
        .map(([id, value]) => ({ id, createdAt: value.createdAt, by: value.by, count: value.entries.length }))
        .sort((a, b) => b.createdAt - a.createdAt);
}

export async function restoreRankBackup(backupId) {
    const snap = await get(ref(database, `migrationBackups/${backupId}`));
    if (!snap.exists()) throw new Error('Sauvegarde introuvable.');
    const writes = {};
    (snap.val().entries || []).forEach((entry) => {
        writes[`${entry.path}/rank`] = entry.rank ?? null;
        writes[`${entry.path}/category`] = entry.category ?? null;
        writes[`${entry.path}/pole`] = entry.pole ?? null;
    });
    const entries = Object.entries(writes);
    for (let i = 0; i < entries.length; i += 150) {
        await update(ref(database), Object.fromEntries(entries.slice(i, i + 150)));
    }
    return entries.length / 3;
}
