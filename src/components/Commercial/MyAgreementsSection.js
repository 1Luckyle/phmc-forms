// src/components/Commercial/MyAgreementsSection.js
//
// Section « Accords commerciaux » de « Mes documents administratifs » : les accords que le PHMC a envoyés à une personne qui a un compte et qui représente la
// Partie (entreprise, fournisseur, partenaire…). Elle les lit puis les signe avec sa signature de « Mes créations » ; une fois signé, l'accord reste consultable.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, ListGroup, Spinner } from 'react-bootstrap';
import ContractDocument from '../Contracts/ContractDocument';
import SignatureCreator from '../SignatureCreator';
import { downloadBbCodeAsHtml, DOWNLOAD_HTML_HINT } from '../../utils/reportExport';
import { AGREEMENT_STATUS, AGREEMENT_TYPES, loadMyAgreements, signAgreementAsPartner, agreementBbCode } from '../../utils/commercialAgreements';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

const MyAgreementsSection = ({ show, uid, signature, onSignatureChange, signatureName, isCivilSigner, patientID, uploadImageDetailed, showNotification }) => {
    const [agreements, setAgreements] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [agreed, setAgreed] = useState(false);
    const [signing, setSigning] = useState(false);
    const [showCreator, setShowCreator] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!uid) return;
        setLoading(true);
        try {
            setAgreements(await loadMyAgreements(uid));
        } catch (err) {
            console.warn('Accords commerciaux illisibles :', err);
        } finally {
            setLoading(false);
        }
    }, [uid]);

    useEffect(() => { if (show) { setSelectedId(null); setAgreed(false); setShowCreator(false); setError(''); load(); } }, [show, load]);

    if (loading && agreements.length === 0) return <Spinner animation="border" size="sm" className="mt-3" />;
    if (agreements.length === 0) return null;

    const selected = agreements.find((agreement) => agreement.id === selectedId) || null;

    const handleSign = async () => {
        setSigning(true);
        setError('');
        try {
            const signed = await signAgreementAsPartner(selected, { uid, name: signatureName, signature });
            setAgreements((list) => list.map((agreement) => (agreement.id === signed.id ? { ...agreement, ...signed } : agreement)));
            setAgreed(false);
            if (showNotification) showNotification('Accord signé : il est désormais en vigueur.', 'success');
        } catch (err) {
            console.error('Signature de l\'accord impossible :', err);
            setError(err.message || String(err));
        } finally {
            setSigning(false);
        }
    };

    return (
        <div className="mt-4">
            <h6 className="mb-2"><i className="fas fa-handshake me-2"></i>Accords commerciaux</h6>
            <ListGroup className="mb-3">
                {agreements.map((agreement) => (
                    <ListGroup.Item key={agreement.id} action active={agreement.id === selectedId} onClick={() => { setSelectedId(agreement.id); setAgreed(false); setError(''); }}
                        className="d-flex justify-content-between align-items-center gap-2">
                        <span>
                            <i className={`fas ${AGREEMENT_TYPES[agreement.type].icon} me-2 opacity-75`}></i>
                            {agreement.champs.titre || 'Accord commercial'}
                            <small className="d-block opacity-75">Réf. {agreement.reference} · {agreement.champs.partieNom}{agreement.envoyeLe ? ` · envoyé le ${formatDate(agreement.envoyeLe)}` : ''}</small>
                        </span>
                        <Badge bg={AGREEMENT_STATUS[agreement.statut].variant}>{AGREEMENT_STATUS[agreement.statut].label}</Badge>
                    </ListGroup.Item>
                ))}
            </ListGroup>

            {selected && (
                <>
                    <ContractDocument bbCode={agreementBbCode(selected)} title={`Accord commercial - ${selected.champs.titre || selected.reference}`} />
                    <div className="d-flex justify-content-end mt-2">
                        <Button variant="outline-light" size="sm" title={DOWNLOAD_HTML_HINT} onClick={() => downloadBbCodeAsHtml({ bbCode: agreementBbCode(selected), title: `Accord commercial - ${selected.champs.titre || selected.reference}`, showNotification })}>
                            <i className="fas fa-download me-1"></i>Télécharger le HTML
                        </Button>
                    </div>

                    {error && <Alert variant="danger" className="py-2 mt-2">{error}</Alert>}

                    {selected.statut === 'envoye' && (
                        <div className="mt-3">
                            <Alert variant="info" className="py-2 small">
                                En signant, vous acceptez <strong>sans réserve</strong> l'offre du PHMC (Code Civil, art. 204) au nom de <strong>{selected.champs.partieNom}</strong> : une réponse qui la modifie
                                est une contre-offre et ne vaut pas acceptation. Vous déclarez avoir le pouvoir d'engager cette Partie (art. 113, 116 et 117).
                            </Alert>
                            {!signature?.url ? (
                                <Alert variant="warning" className="mb-0">
                                    <div className="mb-2"><strong>Il vous manque une signature</strong> pour signer cet accord. Créez-la en quelques secondes.</div>
                                    {!showCreator && <Button variant="warning" onClick={() => setShowCreator(true)}><i className="fas fa-signature me-1"></i>Créer ma signature</Button>}
                                </Alert>
                            ) : (
                                <>
                                    <div className="mb-2">
                                        <div className="small text-muted mb-1">Votre signature (celle de « Mes créations ») :</div>
                                        <img src={signature.url} alt="Votre signature" style={{ maxHeight: 70, background: '#fff', borderRadius: 4, padding: 4 }} />
                                    </div>
                                    <Form.Check
                                        type="checkbox"
                                        id="agreement-agree"
                                        label="J'ai lu l'intégralité de l'accord et je l'accepte."
                                        checked={agreed}
                                        onChange={(e) => setAgreed(e.target.checked)}
                                    />
                                    <div className="d-flex gap-2 flex-wrap mt-2">
                                        <Button variant="success" onClick={handleSign} disabled={!agreed || signing}>
                                            {signing ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-file-signature me-1"></i>Signer l'accord</>}
                                        </Button>
                                        {!showCreator && <Button variant="outline-light" onClick={() => setShowCreator(true)}><i className="fas fa-pen me-1"></i>Modifier ma signature</Button>}
                                    </div>
                                </>
                            )}
                            {showCreator && (
                                <div className="mt-3">
                                    <SignatureCreator
                                        uid={uid}
                                        defaultName={signatureName}
                                        creation={signature}
                                        onCreationChange={(created) => { onSignatureChange(created); if (created) setShowCreator(false); }}
                                        uploadImageDetailed={uploadImageDetailed}
                                        showNotification={showNotification}
                                        civilian={isCivilSigner}
                                        patientID={isCivilSigner ? (patientID || '') : ''}
                                    />
                                    <Button variant="link" size="sm" onClick={() => setShowCreator(false)}>Fermer la création de signature</Button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MyAgreementsSection;
