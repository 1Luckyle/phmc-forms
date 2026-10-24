// src/components/Recruitment/InternalRecruitmentRequest.js
//
// Bouton « Demander le statut de recrutement interne », affiché aux EMPLOYÉS sur les formulaires de candidature
// (rubrique « Enregistrer »). Un employé ne peut pas candidater tant que le recrutement ne lui a pas accordé ce
// statut ; il est retiré quand une de ses candidatures est acceptée et son contrat signé.
import React, { useEffect, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { subscribeToMyInternalRecruitment, requestInternalRecruitment } from '../../utils/internalRecruitment';

const InternalRecruitmentRequest = ({ showNotification, disabled }) => {
    const { currentEmployee, staffProfile, staffName } = useEmployeeAuth();
    const uid = currentEmployee?.uid;
    const [state, setState] = useState({ request: null, granted: null });
    const [open, setOpen] = useState(false);
    const [motif, setMotif] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => subscribeToMyInternalRecruitment(uid, setState), [uid]);

    const { request } = state;
    const pending = request?.statut === 'en_attente';
    const refused = request?.statut === 'refusee';

    const submit = async () => {
        setBusy(true);
        try {
            await requestInternalRecruitment({
                uid,
                member: { name: staffName || staffProfile?.name, role: staffProfile?.rank || staffProfile?.category, badge: staffProfile?.badge },
                motif,
            });
            setOpen(false);
            setMotif('');
            if (showNotification) showNotification('Demande envoyée : le recrutement va l\'examiner.', 'check-circle');
        } catch (error) {
            console.error('Demande de recrutement interne impossible :', error);
            if (showNotification) showNotification(`Envoi impossible : ${error.message}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button
                type="button" className="copy-button-modern" disabled={disabled || pending}
                onClick={() => setOpen(true)}
                title={pending ? 'Le recrutement examine votre demande.' : 'Les employés ne peuvent candidater qu\'avec ce statut, accordé par le recrutement.'}
            >
                <i className={`fas ${pending ? 'fa-hourglass-half' : 'fa-user-clock'}`}></i>
                {pending ? 'Demande de statut interne en attente' : refused ? 'Redemander le statut de recrutement interne' : 'Demander le statut de recrutement interne'}
            </Button>
            {refused && (
                <div style={{ flexBasis: '100%', color: '#ffa198', fontSize: '0.85rem' }}>
                    <i className="fas fa-circle-xmark me-1"></i>Votre dernière demande a été refusée{request.noteRecruteur ? ` : « ${request.noteRecruteur} »` : '.'}
                </div>
            )}

            <BaseModal isOpen={open} onClose={() => setOpen(false)} title="Statut de recrutement interne" modalSize="medium">
                <p>
                    En tant qu'employé, vous ne pouvez pas déposer de candidature. Ce statut spécial, accordé par le recrutement, rouvre les candidatures
                    pour une <strong>évolution interne</strong>. Il prend fin automatiquement quand l'une de vos candidatures est acceptée et que votre contrat
                    est signé ; vous pourrez alors le redemander au besoin.
                </p>
                <Form.Group className="mb-3">
                    <Form.Label>Poste visé et motivation (facultatif)</Form.Label>
                    <Form.Control as="textarea" rows={4} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={1500} placeholder="Ex. : je souhaite postuler au poste d'Infirmier(ère) en Pratique Avancée…" />
                </Form.Group>
                <div className="d-flex justify-content-end gap-2">
                    <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
                    <Button variant="primary" onClick={submit} disabled={busy}>
                        {busy ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-paper-plane me-1"></i>Envoyer la demande</>}
                    </Button>
                </div>
            </BaseModal>
        </>
    );
};

export default InternalRecruitmentRequest;
