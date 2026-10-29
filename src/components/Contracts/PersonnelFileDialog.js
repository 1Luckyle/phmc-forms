// src/components/Contracts/PersonnelFileDialog.js
//
// « Dossier du personnel » : la chronologie de tous les documents contractuels d'une personne (contrats, conventions de stage, avenants, convocations,
// sanctions, fins de contrat), avec un résumé de sa situation : contrat en cours et conditions actuelles après avenants, procédures disciplinaires
// restées sans décision. Réservé aux admins et aux recruteurs (la lecture de tous les contrats l'est aussi, voir database.rules.json) ; la personne
// elle-même retrouve ses documents dans « Mes contrats ».
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Spinner } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import ContractDocument, { ContractExportBar } from './ContractDocument';
import {
    CONTRACT_STATUS, CONTRACT_TYPES, loadAllContracts, contractLabel, contractStatusLabel, contractTypeOf, isOfferExpired,
} from '../../utils/contracts';
import { CONTRACT_TYPE_INFO, formatDateFr, formatTimestampDateFr, isEmploymentType, SANCTIONS, FIN_MOTIFS } from '../../utils/contractDocs';
import { buildPersonnelFile, eventDate, timelineGroup } from '../../utils/personnelFile';

const GROUP_LABELS = { contrat: 'Contrat', avenant: 'Avenant', procedure: 'Procédure', fin: 'Fin de contrat' };

// Ce qui précise un document dans la chronologie (la fonction pour un contrat, l'objet pour une notification).
const subjectOf = (contract) => {
    const type = contractTypeOf(contract);
    const c = contract.champs || {};
    if (isEmploymentType(type)) return c.poste || '';
    if (type === 'sanction') return SANCTIONS[c.typeSanction] || '';
    if (type === 'fin') return FIN_MOTIFS[c.motif] || '';
    if (type === 'convocation') return `${c.objet === 'licenciement' ? 'Licenciement envisagé' : 'Sanction envisagée'} · entretien le ${formatDateFr(c.dateEntretien)}`;
    if (type === 'avenant') return c.motifAvenant || '';
    return '';
};

const PersonnelFileDialog = ({ show, onHide, uid, name, contracts: provided, showNotification }) => {
    const [loaded, setLoaded] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setLoaded(await loadAllContracts());
        } catch (err) {
            console.error('Chargement du dossier impossible :', err);
            setError('Impossible de charger les documents (droits de recruteur ou d\'admin requis).');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!show) return;
        setOpenId(null);
        if (!provided) load();
    }, [show, provided, load]);

    const all = provided || loaded;
    const file = useMemo(() => buildPersonnelFile(all, uid), [all, uid]);
    const { active, lapsed, procedures, employment, timeline, counts, drafts } = file;

    return (
        <BaseModal isOpen={show} onClose={onHide} title={`Dossier du personnel — ${name || ''}`} modalSize="large" zIndex={1100} className="dark-ui">
            {loading && <Spinner animation="border" size="sm" />}
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}

            {!loading && !error && (
                <>
                    {/* Situation actuelle */}
                    <div className="pf-summary">
                        {active ? (
                            <>
                                <div className="pf-summary-title">
                                    <i className={`fas ${CONTRACT_TYPE_INFO[active.conditions.type]?.icon || 'fa-file-signature'} me-2`}></i>
                                    Contrat en cours : {CONTRACT_TYPES[active.conditions.type] || 'Contrat'}
                                </div>
                                <div className="pf-summary-grid">
                                    <div><small>Fonction</small><strong>{active.conditions.poste || '—'}</strong></div>
                                    <div><small>Grade</small><strong>{active.conditions.role || '—'}</strong></div>
                                    <div><small>Rémunération</small><strong>{active.conditions.remuneration || '—'}{active.conditions.echelon ? ` · ${active.conditions.echelon}` : ''}</strong></div>
                                    <div><small>Depuis</small><strong>{formatDateFr(active.conditions.dateDebut)}</strong></div>
                                    {active.conditions.dateFin && <div><small>Terme</small><strong>{formatDateFr(active.conditions.dateFin)}</strong></div>}
                                    {active.conditions.affectation && <div><small>Service</small><strong>{active.conditions.affectation}</strong></div>}
                                </div>
                                <small className="pf-muted">
                                    Réf. {active.contract.reference} · signé le {formatTimestampDateFr(active.contract.signeLe)}
                                    {active.conditions.avenants > 0 ? ` · ${active.conditions.avenants} avenant${active.conditions.avenants > 1 ? 's' : ''} appliqué${active.conditions.avenants > 1 ? 's' : ''}` : ''}
                                    {active.conditions.avenantsAVenir > 0 ? ` · ${active.conditions.avenantsAVenir} avenant${active.conditions.avenantsAVenir > 1 ? 's' : ''} signé${active.conditions.avenantsAVenir > 1 ? 's' : ''} à venir` : ''}
                                </small>
                            </>
                        ) : lapsed ? (
                            <div className="pf-summary-title">
                                <i className="fas fa-hourglass-end me-2"></i>Contrat échu : le terme du {CONTRACT_TYPES[lapsed.conditions.type] || 'contrat'} était le {formatDateFr(lapsed.conditions.dateFin)} et aucune notification de fin n'a été enregistrée (réf. {lapsed.contract.reference}).
                            </div>
                        ) : employment.length > 0 ? (
                            <div className="pf-summary-title"><i className="fas fa-door-open me-2"></i>Aucun contrat en cours : le dernier a pris fin le {formatDateFr(employment[0].end?.champs?.dateEffet)}.</div>
                        ) : (
                            <div className="pf-summary-title"><i className="fas fa-folder-open me-2"></i>Aucun contrat signé pour le moment.</div>
                        )}
                    </div>

                    {procedures.map((conv) => (
                        <Alert variant="warning" className="py-2 mt-2 mb-0 small" key={conv.id}>
                            <strong>Procédure en cours :</strong> convocation du {formatTimestampDateFr(conv.envoyeLe)} ({conv.champs.objet === 'licenciement' ? 'licenciement envisagé' : 'sanction envisagée'}),
                            entretien le {formatDateFr(conv.champs.dateEntretien)} à {conv.champs.heureEntretien || '—'}. Aucune décision notifiée à ce jour.
                        </Alert>
                    ))}

                    <div className="pf-counts">
                        {Object.entries(counts).map(([type, n]) => (
                            <span key={type} className="contract-type-pill"><i className={`fas ${CONTRACT_TYPE_INFO[type]?.icon || 'fa-file'}`}></i>{CONTRACT_TYPE_INFO[type]?.short || type} · {n}</span>
                        ))}
                        {drafts.length > 0 && <span className="contract-type-pill" title="Documents préparés mais pas encore envoyés">Brouillons · {drafts.length}</span>}
                    </div>

                    {/* Chronologie */}
                    <div className="pf-timeline">
                        {timeline.length === 0 && <p className="text-muted mb-0">Aucun document envoyé à cette personne.</p>}
                        {timeline.map((contract) => {
                            const type = contractTypeOf(contract);
                            const group = timelineGroup(contract);
                            const open = openId === contract.id;
                            const expired = isOfferExpired(contract);
                            return (
                                <div key={contract.id} className={`pf-item pf-${group}`}>
                                    <div className="pf-dot"><i className={`fas ${CONTRACT_TYPE_INFO[type]?.icon || 'fa-file'}`}></i></div>
                                    <div className="pf-body">
                                        <div className="pf-head">
                                            <div>
                                                <strong>{contractLabel(contract)}</strong>
                                                <small className="d-block pf-muted">
                                                    {GROUP_LABELS[group]} · {formatTimestampDateFr(eventDate(contract))} · Réf. {contract.reference}
                                                    {contract.creeParNom ? ` · par ${contract.creeParNom}` : ''}
                                                </small>
                                                {subjectOf(contract) && type !== 'cdi' && type !== 'cdd' && type !== 'stage' && <small className="d-block">{subjectOf(contract)}</small>}
                                            </div>
                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                <Badge bg={expired ? 'danger' : (CONTRACT_STATUS[contract.statut]?.variant || 'secondary')}>
                                                    {expired ? 'Offre caduque' : contractStatusLabel(contract)}
                                                </Badge>
                                                <Button size="sm" variant={open ? 'info' : 'outline-info'} onClick={() => setOpenId(open ? null : contract.id)}>
                                                    <i className={`fas ${open ? 'fa-chevron-up' : 'fa-eye'} me-1`}></i>{open ? 'Replier' : 'Voir'}
                                                </Button>
                                            </div>
                                        </div>
                                        {open && (
                                            <div className="mt-2">
                                                <ContractDocument contract={contract} />
                                                <ContractExportBar contract={contract} showNotification={showNotification} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </BaseModal>
    );
};

export default PersonnelFileDialog;
