// src/components/DossierStateBanner.js
//
// Bandeau en tête des formulaires du dossier patient (Basique 25, Avancé 3, Mise à jour 26) : dit ce qui est possible pour le patient dont l'ID est saisi
// (un seul dossier initial, la mise à jour seulement ensuite, jeton gratuit disponible, délai de 15 minutes). L'enregistrement applique les mêmes contrôles
// (useReportManagement.saveReport) : ce bandeau les explique avant, il ne remplace pas ce contrôle.
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { canonicalPatientId } from '../utils/patientId';
import { loadDossierContext, dossierBlockMessage } from '../utils/dossierPatient';
import { DOSSIER_WINDOW_MS, KIND_BY_VERSION } from '../utils/dossierCore';
import { findKnownPatient } from '../utils/knownPatient';
import useBillingRole from '../hooks/useBillingRole';

const KIND_LABEL = { basique: 'Dossier Médical Basique', avance: 'Dossier Médical Avancé', maj: 'Mise à jour du dossier médical' };

const DossierStateBanner = ({ formData, setFormData, version }) => {
    const patientNode = canonicalPatientId(formData.patientID);
    const { filledByStaff } = useBillingRole(formData, setFormData);
    const editing = !!formData.dossierEditPath;
    const [context, setContext] = useState(null);

    // Le dossier du patient est relu quand l'ID change (après une courte pause de saisie).
    useEffect(() => {
        setContext(null);
        if (!patientNode || patientNode.length < 5) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            loadDossierContext(patientNode).then((loaded) => { if (!cancelled) setContext(loaded); }).catch(() => {});
        }, 600);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [patientNode]);

    // Le personnel remplit pour un patient qui n'a PAS de compte : création gratuite (ni facture ni lien de paiement). Cela n'exempte pas son futur compte.
    useEffect(() => {
        if (!setFormData) return undefined;
        if (!filledByStaff || !patientNode) {
            setFormData((prev) => (prev.dossierSansCompte ? { ...prev, dossierSansCompte: false } : prev));
            return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            findKnownPatient(patientNode).then((known) => {
                if (cancelled) return;
                const noAccount = !known;
                setFormData((prev) => (!!prev.dossierSansCompte === noAccount ? prev : { ...prev, dossierSansCompte: noAccount }));
            }).catch(() => {});
        }, 700);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [filledByStaff, patientNode, setFormData]);

    if (!patientNode) return null;
    const noAccountFree = filledByStaff && formData.dossierSansCompte === true;
    const minutes = Math.round(DOSSIER_WINDOW_MS / 60000);
    const blocked = !editing && context ? dossierBlockMessage(version, context) : '';
    const kind = KIND_BY_VERSION[Number(version)];
    const hasToken = !editing && context && Number(context.tokens[kind] || 0) > 0;

    return (
        <div className="mb-3" data-no-tip="1">
            {blocked && (
                <Alert variant="warning" className="py-2 mb-2">
                    <i className="fas fa-lock me-2"></i>{blocked}
                </Alert>
            )}
            {hasToken && !blocked && (
                <Alert variant="success" className="py-2 mb-2">
                    <i className="fas fa-ticket me-2"></i>Un jeton gratuit est disponible pour « {KIND_LABEL[kind]} » : il sera utilisé automatiquement à l'enregistrement (aucun paiement).
                </Alert>
            )}
            {noAccountFree && (
                <Alert variant="success" className="py-2 mb-2">
                    <i className="fas fa-gift me-2"></i>Ce patient n'a pas de compte : création gratuite, sans facture ni lien de paiement. Cela n'exempte pas son futur compte de paiement.
                </Alert>
            )}
            {editing && (
                <Alert variant="info" className="py-2 mb-2">
                    <i className="fas fa-pen me-2"></i>Vous reprenez un formulaire déjà enregistré : il est modifié sur place. Il reste modifiable et supprimable tant qu'il n'est pas payé, puis pendant {minutes} minutes après son paiement.
                </Alert>
            )}
            {!blocked && (
                <small className="text-muted d-block">
                    Le dossier médical est mis à jour {minutes} minutes après le paiement de ce formulaire (ou après son enregistrement s'il est gratuit) : c'est le délai pour le corriger ou le supprimer.
                </small>
            )}
        </div>
    );
};

export default DossierStateBanner;
