// src/utils/contractFollowUp.js
//
// Après la signature d'un CONTRAT D'EMPLOI, l'administration doit poser (ou changer) le rôle de la personne. Pour ne pas dépendre
// d'un message oral, la signature dépose automatiquement une demande dans le panneau d'admin :
//   - candidat (compte Civil)      → demande de COMPTE du personnel (« Demandes de compte »), liée au compte Civil existant : l'approbation
//                                    le convertit en compte du personnel, dossiers conservés ;
//   - déjà membre du personnel     → demande de MODIFICATION de fiche (« Demandes de modification ») si le grade du contrat diffère du sien.
// Les deux nœuds acceptent la création par un utilisateur connecté (jamais l'écrasement) ; une clé déterministe évite les doublons.
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { normalizeRank, familyOfRank } from '../constants/ranks';
import { logActivity } from './activityLog';
import { notifyGroup } from './notifications';

const ensureArray = (value) => (Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []);

const findOwnStaffEntry = async (uid) => {
    for (const [service, path] of [['phmc', 'staff/phmc'], ['coroner', 'staff/coroner']]) {
        const snap = await get(ref(database, path));
        const entry = ensureArray(snap.exists() ? snap.val() : null).find((member) => member && member.uid === uid);
        if (entry) return { entry, service };
    }
    return null;
};

// Retourne { kind: 'account' | 'modification' | 'none', reason? }. Ne lève jamais : la signature, elle, est déjà enregistrée.
export async function requestRoleAfterContract(contract, { uid, name }) {
    try {
        const role = normalizeRank(contract?.champs?.role);
        if (!role) return { kind: 'none', reason: 'no-role' };
        const isCoroner = contract.service === 'coroner';
        const service = isCoroner ? 'coroner' : 'phmc';
        const now = new Date().toISOString();
        const own = await findOwnStaffEntry(uid);

        if (own) {
            if (normalizeRank(own.entry.rank) === role) return { kind: 'none', reason: 'same-role' };
            const newData = { ...own.entry, rank: role, category: role, pole: familyOfRank(role, own.service) };
            await set(ref(database, `pendingModificationRequests/contrat_${contract.id}`), {
                requestId: `contrat_${contract.id}`,
                originalName: own.entry.name,
                oldData: own.entry,
                newData,
                isCoroner: own.service === 'coroner',
                requestedBy: own.entry.name,
                requestedAt: now,
                status: 'pending',
                source: 'contrat',
                contratId: contract.id,
                contratReference: contract.reference || '',
            });
            logActivity({
                category: 'contrats', action: 'role_change_requested',
                summary: `Contrat signé : changement de grade à valider pour ${own.entry.name} (${own.entry.rank || '—'} → ${role})`,
                target: own.entry.name,
            });
            notifyGroup('admin', { type: 'compte', titre: `Contrat signé : grade à valider pour ${own.entry.name}`, texte: `${own.entry.rank || '—'} → ${role}`, lien: { cible: 'admin', section: 'pendingModifications' } });
            return { kind: 'modification' };
        }

        const civilSnap = await get(ref(database, `civilians/${uid}`));
        const civil = civilSnap.exists() ? civilSnap.val() : null;
        const email = String(civil?.email || contract.employeEmail || '').trim();
        if (!email) return { kind: 'none', reason: 'no-email' };
        const firstName = String(civil?.firstName || '').trim();
        const lastName = String(civil?.lastName || '').trim();
        const fullName = `${firstName} ${lastName}`.trim() || contract.employeNom || name || email;
        const emailKey = email.replace(/[.#$[\]]/g, '_');
        await set(ref(database, `pendingAccountRequests/${emailKey}`), {
            name: fullName,
            firstName,
            ...(civil?.middleName ? { middleName: civil.middleName } : {}),
            lastName,
            email,
            discord: civil?.discord || '',
            phNumber: civil?.phone || '',
            ...(civil?.address ? { address: civil.address } : {}),
            ...(civil?.zip ? { zip: civil.zip } : {}),
            rank: role,
            badge: '',
            isCoroner: service === 'coroner',
            requestedAt: now,
            status: 'pending',
            source: 'contrat',
            civilUid: uid,
            contratId: contract.id,
            contratReference: contract.reference || '',
            ...(civil?.gtawCharacterId != null ? { gtawCharacterId: civil.gtawCharacterId } : {}),
            ...(civil?.gtawUserId != null ? { gtawUserId: civil.gtawUserId } : {}),
        });
        logActivity({
            category: 'contrats', action: 'staff_account_requested',
            summary: `Contrat signé : compte du personnel à créer pour ${fullName} (${role})`,
            target: fullName,
        });
        notifyGroup('admin', { type: 'compte', titre: `Contrat signé : compte du personnel à créer pour ${fullName}`, texte: role, lien: { cible: 'admin', section: 'pendingAccounts' } });
        return { kind: 'account' };
    } catch (error) {
        // Clé déjà utilisée = demande déjà déposée pour ce contrat/cette adresse : rien à refaire.
        console.warn('Demande de rôle après contrat non déposée :', error?.message || error);
        return { kind: 'none', reason: 'error' };
    }
}
