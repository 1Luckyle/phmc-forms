// src/components/Contracts/MyContractsModal.js
//
// « Mes contrats » pour le personnel : liste des contrats envoyés par les recruteurs. Un contrat en
// attente se lit puis se signe avec l'image de signature de « Mes créations » ; une fois signé, il
// reste consultable (texte figé + signature). La signature se crée directement ici si elle n'existe pas
// encore (plus besoin de la chercher dans la carte de visite).
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, ListGroup, Spinner } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import ContractDocument from './ContractDocument';
import SignatureCreator from '../SignatureCreator';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { loadUserCreations } from '../../utils/userCreations';
import { CONTRACT_STATUS, loadMyContracts, signContract } from '../../utils/contracts';
import { copyToClipboard } from '../notificationService';

const MyContractsModal = ({ show, onHide, showNotification, uploadImageDetailed }) => {
    const { currentEmployee, staffName, civilianProfile } = useEmployeeAuth();
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
            const [list, creations] = await Promise.all([loadMyContracts(uid), loadUserCreations(uid)]);
            setContracts(list);
            setSignature(creations.signature);
            // Un seul contrat à signer : on l'ouvre directement.
            setSelectedId((previous) => previous || (list.length === 1 ? list[0].id : null));
        } catch (err) {
            console.error('Chargement de mes contrats impossible :', err);
            setError('Impossible de charger vos contrats.');
        } finally {
            setLoading(false);
        }
    }, [uid]);

    useEffect(() => {
        if (show) { setAgreed(false); setSelectedId(null); setShowCreator(false); load(); }
    }, [show, load]);

    const selected = contracts.find((c) => c.id === selectedId) || null;

    const handleSign = async () => {
        setSigning(true);
        setError('');
        try {
            const signed = await signContract(selected, { uid, name: staffName, signature });
            setContracts((list) => list.map((c) => (c.id === signed.id ? signed : c)));
            setAgreed(false);
            if (showNotification) showNotification('Contrat signé.', 'success');
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
                <p className="text-muted mb-0">Aucun contrat ne vous a été envoyé pour le moment.</p>
            )}

            {contracts.length > 0 && (
                <ListGroup className="mb-3">
                    {contracts.map((c) => (
                        <ListGroup.Item key={c.id} action active={c.id === selectedId} onClick={() => { setSelectedId(c.id); setAgreed(false); setError(''); }}
                            className="d-flex justify-content-between align-items-center">
                            <span>
                                {c.champs?.poste || 'Contrat'} — {c.champs?.typeContrat === 'cdd' ? 'CDD' : 'CDI'}
                                <small className="d-block opacity-75">Envoyé par {c.creeParNom || 'le recrutement'}{c.envoyeLe ? ` le ${new Date(c.envoyeLe).toLocaleDateString('fr-FR')}` : ''}</small>
                            </span>
                            <Badge bg={CONTRACT_STATUS[c.statut]?.variant || 'secondary'}>{CONTRACT_STATUS[c.statut]?.label || c.statut}</Badge>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}

            {selected && (
                <>
                    <ContractDocument text={selected.texteFige} signature={selected.signature} signedAt={selected.signeLe} />
                    <div className="d-flex justify-content-end mt-2">
                        <Button variant="outline-light" size="sm" onClick={() => copyToClipboard(selected.texteFige, showNotification, 'Texte du contrat copié.')}>
                            <i className="fas fa-copy me-1"></i>Copier le texte
                        </Button>
                    </div>

                    {selected.statut === 'envoye' && (
                        <div className="mt-3">
                            {!signature?.url ? (
                                <Alert variant="warning" className="mb-0">
                                    <div className="mb-2"><strong>Il vous manque une signature</strong> pour signer ce contrat. Créez-la en quelques secondes, sans quitter cette fenêtre.</div>
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
                                        label="J'ai lu l'intégralité du contrat et je l'accepte."
                                        checked={agreed}
                                        onChange={(e) => setAgreed(e.target.checked)}
                                    />
                                    <Alert variant="secondary" className="py-2 mt-2 small">
                                        La signature est définitive. Le contrat en conserve une copie d'image lorsque le navigateur le permet ;
                                        sinon, il garde le lien de votre signature actuelle (évitez alors de la remplacer ensuite).
                                    </Alert>
                                    <div className="d-flex gap-2 flex-wrap">
                                        <Button variant="success" onClick={handleSign} disabled={!agreed || signing}>
                                            {signing ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-file-signature me-1"></i>Signer le contrat</>}
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
