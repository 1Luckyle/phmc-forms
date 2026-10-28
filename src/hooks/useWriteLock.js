// src/hooks/useWriteLock.js
//
// Confinement du site (panneau admin → Confinement) : tant qu'il est actif, la Boîte à outils ne permet plus d'AGIR (supprimer,
// partager, envoyer, candidater, signer…) — la consultation reste possible. Même règle que les boutons de sauvegarde et de copie des
// formulaires. Le panneau d'administration n'est pas concerné : c'est lui qui lève le confinement.
import { useLockdown } from '../contexts/LockdownContext';

export { LOCK_MESSAGE } from '../utils/lockdownGuard';
const LOCK_TITLE = 'Action désactivée pendant le confinement du site.';

const useWriteLock = () => {
    const { isLockdownActive } = useLockdown();
    return { locked: !!isLockdownActive, lockTitle: LOCK_TITLE };
};

export default useWriteLock;
