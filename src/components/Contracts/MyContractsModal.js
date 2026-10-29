// src/components/Contracts/MyContractsModal.js
//
// « Mes contrats » pour le personnel : liste des documents envoyés par les recruteurs (contrats, conventions de stage, avenants, convocations,
// notifications de sanction ou de fin de contrat). Un document en attente se lit puis se signe avec l'image de signature de « Mes créations » :
// c'est une ACCEPTATION pour un contrat, un avenant ou une rupture d'un commun accord, un simple ACCUSÉ DE RÉCEPTION pour une notification. Une fois
// signé, il reste consultable (texte figé + signature). La signature se crée directement ici si elle n'existe pas encore.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, ListGroup, Spinner } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import ContractDocument, { ContractExportBar } from './ContractDocument';
import SignatureCreator from '../SignatureCreator';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { loadUserCreations } from '../../utils/userCreations';
import {
    CONTRACT_STATUS, loadMyContracts, signContract, contractLabel, contractStatusLabel, contractTypeOf, acceptanceKind, isOfferExpired,
} from '../../utils/contracts';
import { CONTRACT_TYPE_INFO } from '../../utils/contractDocs';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

const MyContractsModal = ({ show, onHide, showNotification, uploadImageDetailed }) => {
    const { currentEmployee, staffName, civilianProfile } = useEmployeeAuth();
    // Un candidat (compte Civil sans fiche du personnel) signe avec son nom seul, et sa signature est aussi celle de son ID patient.
    const isCivilSigner = !staffName && !!civilianProfile;
    // Nom proposé pour la signature : fiche du personnel, sinon profil Civil (candidat en attente de contrat).
    const signatureName = staffName || [civilianProfile?.firstName, civilianProfile?.lastName].filter(Boolean).join(' ');
    const uid = currentEmployee?.uid;
    const [contracts, setContracts] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [signature, setSignature] = useState(null);
    const [loading, setLoading] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [signing, setSigning] = useState(false);
    const [showCreator, setShowCreator] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!uid) return;
        setLoading(true);
        setError('');
        try {
            const [list, creations] = await Promise.all([loadMyContracts(uid), loadUserCreations(uid, { patientID: isCivilSigner ? civilianProfile?.patientID : '' })]);
            setContracts(list);
            setSignature(creations.signature);
            // Un seul document à signer : on l'ouvre directement.
            setSelectedId((previous) => previous || (list.length === 1 ? list[0].id : null));
        } catch (err) {
            console.error('Chargement de mes contrats impossible :', err);
            setError('Impossible de charger vos documents.');
        } finally {
            setLoading(false);
        }
    }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (show) { setAgreed(false); setSelectedId(null); setShowCreator(false); load(); }
    }, [show, load]);

    const selected = contracts.find((c) => c.id === selectedId) || null;
    const selectedType = selected ? contractTypeOf(selected) : null;
    const accord = selected ? acceptanceKind(selectedType, selected.champs) === 'accord' : true;
    const expired = selected ? isOfferExpired(selected) : false;
    const isEmployment = ['cdi', 'cdd'].includes(selectedType);

    const handleSign = async () => {
        setSigning(true);
        setError('');
        try {
            const signed = await signContract(selected, { uid, name: signatureName, signature });
            setContracts((list) => list.map((c) => (c.id === signed.id ? signed : c)));
            setAgreed(false);
            const followUpNote = signed.followUp?.kind === 'account'
                ? ' L\'administration a été prévenue : elle va créer votre compte du personnel et vous attribuer votre rôle.'
                : (signed.followUp?.kind === 'modification' ? ' L\'administration a été prévenue : elle va mettre à jour votre grade.' : '');
            if (showNotification) showNotification(accord ? `Document signé.${followUpNote}` : 'Accusé de réception enregistré.', 'success');
        } catch (err) {
            console.error('Signature impossible :', err);
            setError(err.message || String(err));
        } finally {
            setSigning(false);
        }
    };

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Mes contrats" modalSize="large" className="dark-ui">
            {loading && <Spinner animation="border" size="sm" />}
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}

            {!loading && contracts.length === 0 && !error && (
                <p className="text-muted mb-0">Aucun document ne vous a été envoyé pour le moment.</p>
            )}

            {contracts.length > 0 && (
                <ListGroup className="mb-3">
                    {contracts.map((c) => {
                        const type = contractTypeOf(c);
                        const itemExpired = isOfferExpired(c);
                        return (
                            <ListGroup.Item key={c.id} action active={c.id === selectedId} onClick={() => { setSelectedId(c.id); setAgreed(false); setError(''); }}
                                className="d-flex justify-content-between align-items-center gap-2">
                                <span>
                                    <i className={`fas ${CONTRACT_TYPE_INFO[type]?.icon || 'fa-file'} me-2 opacity-75`}></i>
                                    {contractLabel(c)}
                                    <small className="d-block opacity-75">
                                        Réf. {c.reference} · envoyé par {c.creeParNom || 'le recrutement'}{c.envoyeLe ? ` le ${formatDate(c.envoyeLe)}` : ''}
                                    </small>
                                </span>
                                <Badge bg={itemExpired ? 'danger' : (CONTRACT_STATUS[c.statut]?.variant || 'secondary')}>
                                    {itemExpired ? 'Offre caduque' : contractStatusLabel(c)}
                                </Badge>
                            </ListGroup.Item>
                        );
                    })}
                </ListGroup>
            )}

            {selected && (
                <>
                    <ContractDocument contract={selected} />
                    <ContractExportBar contract={selected} showNotification={showNotification} />

                    {selected.statut === 'envoye' && (
                        <div className="mt-3">
                            {selected.offreExpireLe && (
                                <Alert variant={expired ? 'danger' : 'info'} className="py-2 small">
                                    {expired
                                        ? `L'offre est caduque depuis le ${formatDate(selected.offreExpireLe)} : elle ne peut plus être signée. Demandez au recrutement de vous renvoyer le document.`
                                        : `Offre valable jusqu'au ${formatDate(selected.offreExpireLe)} inclus. Passé ce délai sans signature, elle devient caduque.`}
                                </Alert>
                            )}
                            {!accord && (
                                <Alert variant="warning" className="py-2 small">
                                    Ce document vous est <strong>notifié</strong> : il produit effet à la date de son envoi. Votre signature vaut seulement <strong>accusé de réception</strong> et ne signifie pas que vous acceptez son contenu. Les voies de recours sont indiquées dans le document.
                                </Alert>
                            )}
                            {!signature?.url ? (
                                <Alert variant="warning" className="mb-0">
                                    <div className="mb-2"><strong>Il vous manque une signature</strong> pour {accord ? 'signer ce document' : 'accuser réception'}. Créez-la en quelques secondes, sans quitter cette fenêtre.</div>
                                    {!showCreator && (
                                        <Button variant="warning" onClick={() => setShowCreator(true)}>
                                            <i className="fas fa-signature me-1"></i>Créer ma signature
                                        </Button>
                                    )}
                                </Alert>
                            ) : (
                                <>
                                    <div className="mb-2">
                                        <div className="small text-muted mb-1">Votre signature (celle de « Mes créations ») :</div>
                                        <img src={signature.url} alt="Votre signature" style={{ maxHeight: 70, background: '#fff', borderRadius: 4, padding: 4 }} />
                                    </div>
                                    <Form.Check
                                        type="checkbox"
                                        id="contract-agree"
                                        label={accord
                                            ? `J'ai lu l'intégralité du document et je l'accepte${isEmployment ? ', y compris le serment de l\'article 3' : ''}.`
                                            : 'J\'ai pris connaissance de ce document. Mon accusé de réception ne vaut pas acquiescement.'}
                                        checked={agreed}
                                        onChange={(e) => setAgreed(e.target.checked)}
                                        disabled={expired}
                                    />
                                    <Alert variant="secondary" className="py-2 mt-2 small">
                                        La signature est définitive et horodatée. Le document en conserve une copie d'image lorsque le navigateur le permet ;
                                        sinon, il garde le lien de votre signature actuelle (évitez alors de la remplacer ensuite).
                                    </Alert>
                                    <div className="d-flex gap-2 flex-wrap">
                                        <Button variant="success" onClick={handleSign} disabled={!agreed || signing || expired}>
                                            {signing ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-file-signature me-1"></i>{accord ? 'Signer le document' : 'Accuser réception'}</>}
                                        </Button>
                                        {!showCreator && (
                                            <Button variant="outline-light" onClick={() => setShowCreator(true)}>
                                                <i className="fas fa-pen me-1"></i>Modifier ma signature
                                            </Button>
                                        )}
                                    </div>
                                </>
                            )}
                            {showCreator && (
                                <div className="mt-3">
                                    <SignatureCreator
                                        uid={uid}
                                        defaultName={signatureName}
                                        creation={signature}
                                        onCreationChange={(created) => { setSignature(created); if (created) setShowCreator(false); }}
                                        uploadImageDetailed={uploadImageDetailed}
                                        showNotification={showNotification}
                                        civilian={isCivilSigner}
                                        patientID={isCivilSigner ? (civilianProfile?.patientID || '') : ''}
                                    />
                                    <Button variant="link" size="sm" onClick={() => setShowCreator(false)}>Fermer la création de signature</Button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </BaseModal>
    );
};

export default MyContractsModal;
