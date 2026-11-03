// src/utils/inheritance.js
//
// « Ce que vous héritez » : quand quelqu'un crée un compte (ou obtient un nouveau rôle), des éléments l'attendent déjà, rangés à son nom ou à son ID
// patient : dossier médical et signature créés lors d'un formulaire AMA (Civil) ; rapports enregistrés à son nom, documents administratifs, accès
// au formulaire AMA (personnel soignant). Cette fenêtre les liste, UNE FOIS par élément : ce qui a déjà été montré est mémorisé dans
// userCreations/{uid}/inheritanceSeen (règle existante : le propriétaire écrit). Si le profil est supprimé puis recréé, la mémoire disparaît avec lui
// et la fenêtre réapparaît ; si de nouveaux éléments arrivent plus tard (un nouvel AMA, un nouveau grade), elle réapparaît aussi.
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from './patientId';
import { findPatientNodes, shallowKeys, comprehensiveSanitize } from './patientRecords';
import { loadPatientSignature } from './patientSignatures';

const plural = (count, one, many) => `${count} ${count > 1 ? many : one}`;

// Éléments trouvés pour cette personne : [{ key, role: 'civil' | 'soignant', count, icon, label, detail }]. `count` sert à ne re-montrer
// un élément que s'il y en a davantage que la dernière fois.
export const collectInheritance = async ({ uid, isCivilian, patientID, staffName, canUseAma }) => {
    const found = [];
    if (!uid) return found;

    if (isCivilian && canonicalPatientId(patientID)) {
        try {
            const nodes = await findPatientNodes(patientID);
            let documents = 0;
            for (const node of nodes) {
                const keys = await shallowKeys(`patientRecords/${node}`);
                documents += keys ? keys.length : 0;
            }
            if (documents > 0) {
                found.push({
                    key: 'civil_dossier', role: 'civil', count: documents, icon: 'fa-folder-open',
                    label: `${plural(documents, 'document médical', 'documents médicaux')} dans votre dossier patient`,
                    detail: 'Rapports et formulaires (refus de soins, certificats…) rangés à votre ID patient par le personnel : vous les retrouvez dans « Dossier Patient ».',
                });
            }
        } catch (error) { console.warn('Dossier patient non évalué :', error?.message || error); }
        try {
            const signature = await loadPatientSignature(patientID);
            if (signature?.url && signature.source !== 'civil') {
                found.push({
                    key: 'civil_signature', role: 'civil', count: 1, icon: 'fa-signature',
                    label: 'Une signature à votre nom',
                    detail: 'Créée automatiquement lors d\'un formulaire de refus de soins (AMA) : elle devient la vôtre et vous pouvez la remplacer dans « Carte & signature ».',
                });
            }
        } catch (error) { console.warn('Signature du patient non évaluée :', error?.message || error); }
    }

    if (!isCivilian && staffName) {
        try {
            const reports = await shallowKeys(`savedReports/${comprehensiveSanitize(staffName)}`);
            if (reports && reports.length > 0) {
                found.push({
                    key: 'soignant_rapports', role: 'soignant', count: reports.length, icon: 'fa-file-medical',
                    label: `${plural(reports.length, 'rapport enregistré', 'rapports enregistrés')} à votre nom`,
                    detail: 'Retrouvez-les dans « Rapports enregistrés » : ils vous attendaient déjà sur la fiche du personnel liée à votre compte.',
                });
            }
        } catch (error) { console.warn('Rapports du personnel non évalués :', error?.message || error); }
        try {
            const documents = await shallowKeys(`contratsParEmploye/${uid}`);
            if (documents && documents.length > 0) {
                found.push({
                    key: 'soignant_documents', role: 'soignant', count: documents.length, icon: 'fa-file-signature',
                    label: `${plural(documents.length, 'document administratif', 'documents administratifs')} à consulter ou signer`,
                    detail: 'Contrats et documents envoyés par la Direction : ouvrez « Mes documents administratifs ».',
                });
            }
        } catch (error) { console.warn('Documents administratifs non évalués :', error?.message || error); }
        if (canUseAma) {
            found.push({
                key: 'soignant_acces', role: 'soignant', count: 1, icon: 'fa-user-doctor',
                label: 'Accès soignant : formulaire AMA et dossiers patients',
                detail: 'Votre grade vous donne accès au formulaire de refus de soins (AMA) et à la consultation des dossiers patients.',
            });
        }
    }
    return found;
};

const seenPath = (uid) => `userCreations/${uid}/inheritanceSeen`;

export const loadSeenInheritance = async (uid) => {
    const snap = await get(ref(database, seenPath(uid)));
    return snap.exists() ? snap.val() : {};
};

// Éléments à montrer : nouveaux, ou en plus grand nombre que la dernière fois.
export const pendingInheritance = (found, seen) => found.filter((item) => !(Number(seen?.[item.key]) >= item.count));

export const markInheritanceSeen = async (uid, items) => {
    if (!uid || !items.length) return;
    const current = await loadSeenInheritance(uid);
    const next = { ...current };
    items.forEach((item) => { next[item.key] = item.count; });
    await set(ref(database, seenPath(uid)), next);
};
