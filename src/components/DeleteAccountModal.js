// src/components/DeleteAccountModal.js
//
// « Supprimer mon compte ». Deux modes (voir utils/accountDeletion.js) :
//   • civil : suppression directe, après avoir tapé SUPPRIMER ;
//   • staff : demande envoyée aux admins, qui suppriment le compte ou refusent.
// Les archives liées à l'ID patient (dossier, rapports, factures, candidatures, contrats) sont conservées dans les deux cas.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import BaseModal from './BaseModal';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { sendTemplatedMail } from '../utils/mailTemplates';
import { logActivity } from '../utils/activityLog';
import { rankLabel } from '../utils/staffAdmin';
import {
    CONFIRM_WORD, deleteOwnCivilAccount, loadMyDeletionRequest, requestStaffDeletion, cancelDeletionRequest,
} from '../utils/accountDeletion';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

const Kept = () => (
    <Alert variant="secondary" className="small py-2">
        <strong>Conservé :</strong> votre dossier patient et les rapports, factures, candidatures et contrats rattachés à votre ID patient (archives médicales et administratives).
        Si vous recréez un compte avec le même personnage, vous les retrouvez.
    </Alert>
);

const DeleteAccountModal = ({ show, onHide, mode = 'civil', showNotification }) => {
    const { currentEmployee, civilianProfile, staffProfile, staffName, isAdmin, logoutEmployee } = useEmployeeAuth();
    const [confirmText, setConfirmText] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [request, setRequest] = useState(undefined);   // undefined = chargement, null = aucune demande

    useEffect(() => {
        if (!show) return undefined;
        setConfirmText('');
        setReason('');
        if (mode !== 'staff' || !currentEmployee?.uid) { setRequest(null); return undefined; }
        let cancelled = false;
        setRequest(undefined);
        loadMyDeletionRequest(currentEmployee.uid)
            .then((found) => { if (!cancelled) setRequest(found); })
            .catch(() => { if (!cancelled) setRequest(null); });
        return () => { cancelled = true; };
    }, [show, mode, currentEmployee?.uid]);

    const deleteNow = async () => {
        if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) return;
        setBusy(true);
        try {
            const name = [civilianProfile?.firstName, civilianProfile?.lastName].filter(Boolean).join(' ');
            // Le courriel part AVANT la suppression : après, la session n'existe plus.
            if (currentEmployee?.email) await sendTemplatedMail('compte_civil_supprime', { to: currentEmployee.email, vars: { nom: name || currentEmployee.email } }).catch(() => {});
            logActivity({ category: 'comptes', action: 'civil_self_deleted', severity: 'warning', summary: `Compte Civil supprimé par son titulaire : ${name || 'sans nom'}`, target: civilianProfile?.patientID || undefined });
            await deleteOwnCivilAccount();
            showNotification('Votre compte a été supprimé.', 'info');
            try { await logoutEmployee(); } catch (error) { /* la session n'existe plus */ }
            window.location.reload();
        } catch (error) {
            showNotification(String(error?.message || error).slice(0, 200), 'error');
            setBusy(false);
        }
    };

    const sendRequest = async () => {
        setBusy(true);
        try {
            const sent = await requestStaffDeletion({
                uid: currentEmployee.uid, name: staffName, email: staffProfile?.email || currentEmployee.email,
                rank: staffProfile ? rankLabel(staffProfile.type, staffProfile.rank) : '', reason,
            });
            setRequest(sent);
            showNotification('Demande envoyée : un administrateur la traitera.', 'check-circle');
        } catch (error) {
            showNotification(String(error?.message || error).slice(0, 200), 'error');
        } finally {
            setBusy(false);
        }
    };

    const cancelRequest = async () => {
        setBusy(true);
        try {
            await cancelDeletionRequest(currentEmployee.uid);
            setRequest(null);
            showNotification('Demande annulée.', 'info');
        } catch (error) {
            showNotification(String(error?.message || error).slice(0, 200), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <BaseModal isOpen={show} onClose={busy ? undefined : onHide} title="Supprimer mon compte" modalSize="medium" zIndex={1150} className="dark-ui">
            {mode === 'civil' ? (
                <div data-guide-zone>
                    <Alert variant="danger" className="small py-2">
                        <strong>Suppression définitive.</strong> Votre profil, vos coordonnées, vos rôles, votre carte de visite, votre signature et votre accès au site seront supprimés immédiatement.
                    </Alert>
                    <Kept />
                    <Form.Group className="mb-3">
                        <Form.Label>Pour confirmer, tapez <strong>{CONFIRM_WORD}</strong></Form.Label>
                        <Form.Control
                            name="confirmation" required data-guide={`Tapez le mot ${CONFIRM_WORD} pour confirmer la suppression de votre compte.`}
                            value={confirmText} onChange={(event) => setConfirmText(event.target.value)} disabled={busy} autoComplete="off"
                        />
                    </Form.Group>
                    <div className="d-flex justify-content-end gap-2">
                        <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                        <Button variant="danger" onClick={deleteNow} disabled={busy || confirmText.trim().toUpperCase() !== CONFIRM_WORD}>
                            {busy ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-trash me-1"></i>Supprimer définitivement mon compte</>}
                        </Button>
                    </div>
                </div>
            ) : isAdmin ? (
                <Alert variant="warning" className="mb-0">Un compte admin ne peut pas être supprimé depuis ici : demandez d'abord à un autre admin de retirer vos droits admin.</Alert>
            ) : request === undefined ? (
                <p className="text-muted"><Spinner size="sm" animation="border" className="me-2" />Chargement…</p>
            ) : request ? (
                <>
                    <Alert variant="info" className="small py-2">
                        Votre demande de suppression est <strong>en attente</strong> depuis le {formatDate(request.demandeLe)}. Un administrateur la traitera : vous recevrez le résultat par notification, ou votre compte sera supprimé.
                    </Alert>
                    <div className="d-flex justify-content-end gap-2">
                        <Button variant="secondary" onClick={onHide} disabled={busy}>Fermer</Button>
                        <Button variant="outline-warning" onClick={cancelRequest} disabled={busy}>{busy ? <Spinner size="sm" animation="border" /> : 'Annuler ma demande'}</Button>
                    </div>
                </>
            ) : (
                <div data-guide-zone>
                    <p className="small">
                        La suppression d'un compte du personnel est traitée par un administrateur : votre fiche du personnel, vos droits, votre carte de visite et votre signature seront supprimés, et vous n'aurez plus accès au site.
                    </p>
                    <Kept />
                    <Form.Group className="mb-3">
                        <Form.Label>Motif <small className="text-muted">(facultatif)</small></Form.Label>
                        <Form.Control
                            as="textarea" rows={3} maxLength={500} name="motif" data-guide="Facultatif : pourquoi vous souhaitez supprimer votre compte (départ, doublon…)."
                            value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy}
                        />
                    </Form.Group>
                    <div className="d-flex justify-content-end gap-2">
                        <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                        <Button variant="danger" onClick={sendRequest} disabled={busy}>
                            {busy ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-paper-plane me-1"></i>Envoyer la demande</>}
                        </Button>
                    </div>
                </div>
            )}
        </BaseModal>
    );
};

export default DeleteAccountModal;
