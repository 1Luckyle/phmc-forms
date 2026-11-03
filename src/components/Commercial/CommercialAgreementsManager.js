// src/components/Commercial/CommercialAgreementsManager.js
//
// « Contrats commerciaux » (Administratif) : accords avec des entreprises, fournisseurs, prestataires, partenaires, bailleurs ou sponsors. Réservé aux
// admins, à la Direction, à son assistance et au personnel administratif (comme les Documents disciplinaires).
//   • liste (recherche, filtres par statut et par type), création d'un brouillon sur le MODÈLE verrouillé de chaque type (utils/commercialClauses.js : le
//     texte renvoie aux articles du Code Civil et du Code Pénal), aperçu en direct dans la charte du PHMC ;
//   • envoi : le texte est FIGÉ et signé par le PHMC (offre ferme) ; si la Partie a un compte, elle signe elle-même depuis « Mes documents administratifs » ;
//     sinon la Direction consigne sa signature (nom, qualité, preuve) ;
//   • un accord signé est conservé : on y met fin (motif, date) au lieu de le supprimer.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Dropdown, Form, Spinner, Table } from 'react-bootstrap';
import Select from 'react-select';
import * as Sentry from '@sentry/react';
import '../DarkUi.css';
import '../Contracts/Contracts.css';
import BaseModal from '../BaseModal';
import ContractDocument from '../Contracts/ContractDocument';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import { loadStaffMembers, loadCivilians } from '../../utils/staffAdmin';
import { loadUserCreations } from '../../utils/userCreations';
import { normalizeRank } from '../../constants/ranks';
import { copyToClipboard } from '../notificationService';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../../utils/reportExport';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../../utils/reportDocumentExport';
import { composeContractBb } from '../../utils/contractCompose';
import useDebugDelete from '../../hooks/useDebugDelete';
import { removeAgreementAnyStatus } from '../../utils/debugDelete';
import { formatDateFr } from '../../utils/contractConstants';
import {
    AGREEMENT_TYPES, AGREEMENT_STATUS, loadAllAgreements, saveAgreementDraft, sendAgreement, retractAgreement, deleteAgreement, recordPartnerSignature,
    terminateAgreement, emptyAgreementFields, visibleFields, validateAgreement, buildAgreementBb, agreementBbCode,
} from '../../utils/commercialAgreements';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const money = (value) => (value === '' || value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toLocaleString('fr-FR')} $`);

const selectStyles = {
    control: (base) => ({ ...base, backgroundColor: '#0d1117', borderColor: '#30363d', color: '#e6edf3' }),
    menu: (base) => ({ ...base, backgroundColor: '#161b22', zIndex: 20 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#1f6feb' : 'transparent', color: '#e6edf3' }),
    singleValue: (base) => ({ ...base, color: '#e6edf3' }),
    input: (base) => ({ ...base, color: '#e6edf3' }),
    placeholder: (base) => ({ ...base, color: '#8b949e' }),
};

// ───────────────────────────── Éditeur de brouillon ─────────────────────────────

const AgreementEditor = ({ type, agreement, accounts, issuer, showNotification, onCancel, onSaved }) => {
    const [champs, setChamps] = useState(() => ({ ...emptyAgreementFields(type), ...(agreement?.champs || {}) }));
    const [partnerUid, setPartnerUid] = useState(agreement?.partieUid || '');
    const [busy, setBusy] = useState(false);

    const set = (key, value) => setChamps((previous) => ({ ...previous, [key]: value }));
    const fields = visibleFields(type, champs);
    const groups = useMemo(() => {
        const map = new Map();
        fields.forEach((field) => { if (!map.has(field.group)) map.set(field.group, []); map.get(field.group).push(field); });
        return [...map.entries()];
    }, [fields]);
    const { errors, warnings } = validateAgreement(type, champs);
    const partner = accounts.find((account) => account.value === partnerUid) || null;

    const preview = useMemo(() => {
        try {
            return composeContractBb(buildAgreementBb({ type, champs, issuer, id: agreement?.id || 'APERCU', timestamp: Date.now() }).bbCode);
        } catch (error) {
            console.error('Aperçu de l\'accord impossible :', error);
            return '';
        }
    }, [type, champs, issuer, agreement]);

    const save = async (alsoSend) => {
        const check = validateAgreement(type, champs, { forSend: alsoSend });
        if (check.errors.length) { showNotification(check.errors[0], 'warning'); return; }
        if (alsoSend && !window.confirm(`Envoyer l'accord « ${champs.titre} » ? Le texte sera figé et signé par le PHMC.${partner ? ` ${partner.label} pourra le signer depuis « Mes documents administratifs ».` : ' La Partie n\'a pas de compte : vous consignerez sa signature ensuite.'}`)) return;
        setBusy(true);
        try {
            const id = await saveAgreementDraft({ id: agreement?.id, type, champs, partner: partner ? { uid: partner.value, displayName: partner.name } : null, issuer });
            if (alsoSend) {
                const result = await sendAgreement(id, issuer);
                showNotification(`Accord envoyé (réf. ${result.reference}).${result.warnings.length ? ` ${result.warnings[0]}` : ''}`, 'success');
            } else {
                showNotification('Brouillon enregistré.', 'success');
            }
            onSaved(id);
        } catch (error) {
            console.error('Enregistrement de l\'accord impossible :', error);
            Sentry.captureException(error, { extra: { context: 'CommercialAgreementsManager.save' } });
            showNotification(error.message || 'Enregistrement impossible.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const renderField = (field) => {
        const value = champs[field.key];
        const id = `ac-${field.key}`;
        const control = (() => {
            const common = { name: field.key, required: !!field.required, 'data-guide': field.help || undefined };
            if (field.type === 'textarea') return <Form.Control id={id} {...common} as="textarea" rows={3} value={value || ''} placeholder={field.placeholder} onChange={(e) => set(field.key, e.target.value)} />;
            if (field.type === 'select') {
                return (
                    <Form.Select id={id} {...common} value={value || ''} onChange={(e) => set(field.key, e.target.value)}>
                        {!field.options.some((option) => option.value === value) && <option value="">— Choisir —</option>}
                        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Form.Select>
                );
            }
            if (field.type === 'checkbox') return <Form.Check id={id} type="checkbox" label={field.label} checked={!!value} onChange={(e) => set(field.key, e.target.checked)} />;
            return <Form.Control id={id} {...common} type={field.type === 'number' ? 'number' : field.type} min={field.type === 'number' ? 0 : undefined} value={value ?? ''} placeholder={field.placeholder} onChange={(e) => set(field.key, e.target.value)} />;
        })();
        return (
            <Form.Group key={field.key} className="mb-2">
                {field.type !== 'checkbox' && <Form.Label htmlFor={id}>{field.label}{field.required && <span className="text-danger"> *</span>}</Form.Label>}
                {control}
                {field.help && <Form.Text className="text-muted d-block">{field.help}</Form.Text>}
            </Form.Group>
        );
    };

    return (
        <div>
            <div className="row g-3">
                <div className="col-12 col-lg-6">
                    {groups.map(([group, groupFields]) => (
                        <fieldset key={group} className="border rounded p-3 mb-3" style={{ borderColor: '#30363d' }}>
                            <legend className="float-none w-auto px-2 fs-6">{group}</legend>
                            {groupFields.map(renderField)}
                            {group === 'La Partie' && (
                                <Form.Group className="mb-2">
                                    <Form.Label>Compte de la Partie (facultatif)</Form.Label>
                                    <Select
                                        name="partieCompte"
                                        options={accounts}
                                        value={partner}
                                        onChange={(option) => setPartnerUid(option ? option.value : '')}
                                        isClearable
                                        placeholder="Aucun compte : la signature de la Partie sera consignée à la main"
                                        styles={selectStyles}
                                        noOptionsMessage={() => 'Aucun compte'}
                                    />
                                    <Form.Text className="text-muted">Si la Partie (ou son représentant) a un compte, elle signe elle-même depuis « Mes documents administratifs ».</Form.Text>
                                </Form.Group>
                            )}
                        </fieldset>
                    ))}
                    {errors.length > 0 && <Alert variant="secondary" className="py-2 small mb-2"><strong>À compléter :</strong> {errors.slice(0, 4).join(' ')}</Alert>}
                    {warnings.map((warning) => <Alert key={warning} variant="info" className="py-2 small mb-2">{warning}</Alert>)}
                    <div className="d-flex gap-2 flex-wrap">
                        <Button variant="primary" onClick={() => save(false)} disabled={busy}>{busy ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-floppy-disk me-1"></i>Enregistrer le brouillon</>}</Button>
                        <Button variant="success" onClick={() => save(true)} disabled={busy}><i className="fas fa-paper-plane me-1"></i>Enregistrer et envoyer</Button>
                        <Button variant="secondary" onClick={onCancel} disabled={busy}>Annuler</Button>
                    </div>
                </div>
                <div className="col-12 col-lg-6">
                    <div className="small text-muted mb-1">Aperçu du document (mis à jour au fil de la saisie)</div>
                    <ContractDocument bbCode={preview} title={champs.titre || 'Accord commercial'} />
                </div>
            </div>
        </div>
    );
};

// ───────────────────────────── Fiche d'un accord ─────────────────────────────

const AgreementView = ({ agreement, issuer, showNotification, onBack, onEdit, onChanged }) => {
    const debugDelete = useDebugDelete();
    const { bbcodeEnabled } = useSiteConfig();
    const [busy, setBusy] = useState(false);
    const [proof, setProof] = useState({ nom: '', fonction: '', preuve: '', imageUrl: '' });
    const [fin, setFin] = useState({ motif: '', date: new Date().toISOString().slice(0, 10) });
    const bb = agreementBbCode(agreement);
    const title = `Accord commercial - ${agreement.champs.titre || agreement.reference}`;
    const status = AGREEMENT_STATUS[agreement.statut];

    const run = async (action, successMessage) => {
        setBusy(true);
        try {
            await action();
            showNotification(successMessage, 'success');
            await onChanged();
        } catch (error) {
            console.error('Action sur l\'accord impossible :', error);
            showNotification(error.message || 'Action impossible.', 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <div className="small text-muted mb-2">
                <Badge bg={status.variant} className="me-2">{status.label}</Badge>
                {AGREEMENT_TYPES[agreement.type].label} · {agreement.reference ? `Réf. ${agreement.reference} · ` : ''}Partie : <strong>{agreement.champs.partieNom || '—'}</strong>
                {agreement.partieCompteNom ? ` (compte : ${agreement.partieCompteNom})` : ' (sans compte)'} · créé par {agreement.creeParNom || '—'}
                {agreement.envoyeLe ? ` · envoyé le ${formatDate(agreement.envoyeLe)}` : ''}{agreement.signeLe ? ` · signé le ${formatDate(agreement.signeLe)}` : ''}
            </div>

            {bb ? (
                <>
                    <ContractDocument bbCode={bb} title={title} />
                    <div className="d-flex flex-wrap justify-content-end gap-2 mt-2">
                        <Button variant="outline-light" size="sm" onClick={() => copyToClipboard(agreement.texteFige, showNotification, 'Texte de l\'accord copié.')} disabled={!agreement.texteFige}><i className="fas fa-copy me-1"></i>Copier le texte</Button>
                        {bbcodeEnabled && <Button variant="outline-light" size="sm" title={COPY_BBCODE_HINT} onClick={() => copyToClipboard(bb, showNotification, 'BBCode copié !')}><i className="fas fa-code me-1"></i>Copier le BBCode</Button>}
                        <Button variant="outline-light" size="sm" title={DOWNLOAD_HTML_HINT} onClick={() => downloadBbCodeAsHtml({ bbCode: bb, title, showNotification })}><i className="fas fa-download me-1"></i>Télécharger le HTML</Button>
                        <Button variant="outline-light" size="sm" onClick={() => exportReportDocument('pdf', { bbCode: bb, title, showNotification })}><i className="fas fa-file-pdf me-1"></i>{PDF_EXPORT_LABEL}</Button>
                    </div>
                </>
            ) : (
                <Alert variant="secondary" className="py-2">Brouillon : le texte est généré et figé à l'envoi. Ouvrez « Modifier » pour voir l'aperçu.</Alert>
            )}

            <div className="mt-3 d-flex flex-wrap gap-2">
                {agreement.statut === 'brouillon' && (
                    <>
                        <Button variant="primary" onClick={onEdit}><i className="fas fa-pen me-1"></i>Modifier</Button>
                        <Button variant="success" disabled={busy} onClick={() => { if (window.confirm('Envoyer cet accord ? Le texte sera figé et signé par le PHMC.')) run(() => sendAgreement(agreement.id, issuer).then((r) => r), 'Accord envoyé.'); }}><i className="fas fa-paper-plane me-1"></i>Envoyer</Button>
                    </>
                )}
                {agreement.statut === 'envoye' && (
                    <Button variant="outline-warning" disabled={busy} onClick={() => { if (window.confirm('Retirer cet accord ? Il repasse en brouillon.')) run(() => retractAgreement(agreement.id), 'Accord retiré (brouillon).'); }}><i className="fas fa-rotate-left me-1"></i>Retirer (repasser en brouillon)</Button>
                )}
                {debugDelete && (agreement.statut === 'signe' || agreement.statut === 'termine') && (
                    <Button variant="outline-danger" disabled={busy} onClick={() => { if (window.confirm('Supprimer définitivement cet accord SIGNÉ (debug) ?')) run(async () => { await removeAgreementAnyStatus(agreement); onBack(); }, 'Accord supprimé.'); }}><i className="fas fa-trash me-1"></i>Supprimer (debug)</Button>
                )}
                {(agreement.statut === 'brouillon' || agreement.statut === 'envoye') && (
                    <Button variant="outline-danger" disabled={busy} onClick={() => { if (window.confirm('Supprimer définitivement cet accord ?')) run(async () => { await deleteAgreement(agreement.id); onBack(); }, 'Accord supprimé.'); }}><i className="fas fa-trash me-1"></i>Supprimer</Button>
                )}
            </div>

            {agreement.statut === 'envoye' && (
                agreement.partieUid ? (
                    <Alert variant="info" className="mt-3 py-2 small mb-0">En attente de la signature de <strong>{agreement.partieCompteNom || 'la Partie'}</strong> : elle signe depuis « Mes documents administratifs ».</Alert>
                ) : (
                    <fieldset className="border rounded p-3 mt-3" style={{ borderColor: '#30363d' }}>
                        <legend className="float-none w-auto px-2 fs-6">Consigner la signature de la Partie (sans compte)</legend>
                        <div className="small text-muted mb-2">À utiliser quand la Partie a signé hors du site (image du document signé, copie du message…). La preuve est conservée avec l'accord.</div>
                        <div className="row g-2">
                            <div className="col-md-6"><Form.Control placeholder="Nom du signataire *" value={proof.nom} onChange={(e) => setProof({ ...proof, nom: e.target.value })} /></div>
                            <div className="col-md-6"><Form.Control placeholder="Fonction" value={proof.fonction} onChange={(e) => setProof({ ...proof, fonction: e.target.value })} /></div>
                            <div className="col-md-6"><Form.Control placeholder="Preuve (lien de l'image ou du document) *" value={proof.preuve} onChange={(e) => setProof({ ...proof, preuve: e.target.value })} /></div>
                            <div className="col-md-6"><Form.Control placeholder="Lien de l'image de sa signature (facultatif)" value={proof.imageUrl} onChange={(e) => setProof({ ...proof, imageUrl: e.target.value })} /></div>
                        </div>
                        <Button className="mt-2" variant="success" disabled={busy} onClick={() => run(() => recordPartnerSignature(agreement.id, proof, issuer), 'Signature de la Partie consignée : accord en vigueur.')}>
                            <i className="fas fa-file-signature me-1"></i>Consigner la signature : accord en vigueur
                        </Button>
                    </fieldset>
                )
            )}

            {agreement.statut === 'signe' && (
                <fieldset className="border rounded p-3 mt-3" style={{ borderColor: '#30363d' }}>
                    <legend className="float-none w-auto px-2 fs-6">Mettre fin à l'accord</legend>
                    <div className="row g-2">
                        <div className="col-md-8"><Form.Control placeholder="Motif (terme atteint, résiliation, résolution pour manquement…) *" value={fin.motif} onChange={(e) => setFin({ ...fin, motif: e.target.value })} /></div>
                        <div className="col-md-4"><Form.Control type="date" value={fin.date} onChange={(e) => setFin({ ...fin, date: e.target.value })} /></div>
                    </div>
                    <Button className="mt-2" variant="outline-danger" disabled={busy} onClick={() => { if (window.confirm('Mettre fin à cet accord ? Il reste archivé.')) run(() => terminateAgreement(agreement.id, fin), 'Accord terminé.'); }}>
                        <i className="fas fa-ban me-1"></i>Mettre fin à l'accord
                    </Button>
                </fieldset>
            )}

            {agreement.statut === 'termine' && agreement.fin && (
                <Alert variant="dark" className="mt-3 py-2 small mb-0">Accord terminé{agreement.fin.date ? ` le ${formatDateFr(agreement.fin.date)}` : ''} : {agreement.fin.motif}</Alert>
            )}
        </div>
    );
};

// ───────────────────────────── Liste ─────────────────────────────

const CommercialAgreementsManager = ({ showNotification }) => {
    const { currentEmployee, isAdmin, staffName, staffProfile, civilianProfile } = useEmployeeAuth();
    const [agreements, setAgreements] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [signatureUrl, setSignatureUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [screen, setScreen] = useState({ name: 'list' }); // list | view { id } | edit { id?, type }

    const issuer = useMemo(() => ({
        uid: currentEmployee?.uid,
        name: staffName || [civilianProfile?.firstName, civilianProfile?.lastName].filter(Boolean).join(' ') || currentEmployee?.email || 'La Direction',
        title: normalizeRank(staffProfile?.rank || staffProfile?.category || '') || (isAdmin ? 'Administration' : 'Direction'),
        signatureUrl,
    }), [currentEmployee, staffName, staffProfile, civilianProfile, isAdmin, signatureUrl]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [list, members, civilians, creations] = await Promise.all([
                loadAllAgreements(),
                loadStaffMembers().catch(() => []),
                loadCivilians().catch(() => []),
                currentEmployee?.uid ? loadUserCreations(currentEmployee.uid).catch(() => ({})) : Promise.resolve({}),
            ]);
            setAgreements(list);
            setSignatureUrl(creations?.signature?.url || '');
            const people = [
                ...members.filter((m) => m.uid).map((m) => ({ value: m.uid, name: m.displayName || m.name, label: `${m.displayName || m.name} (personnel)` })),
                ...civilians.filter((c) => c.uid).map((c) => {
                    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.uid;
                    return { value: c.uid, name, label: `${name} (civil)` };
                }),
            ];
            const seen = new Set();
            setAccounts(people.filter((person) => (seen.has(person.value) ? false : seen.add(person.value))).sort((a, b) => a.label.localeCompare(b.label)));
        } catch (err) {
            console.error('Chargement des accords impossible :', err);
            setError(err?.message || 'Chargement impossible.');
        } finally {
            setLoading(false);
        }
    }, [currentEmployee]);

    useEffect(() => { load(); }, [load]);

    const filtered = agreements.filter((agreement) => {
        if (statusFilter !== 'all' && agreement.statut !== statusFilter) return false;
        if (typeFilter !== 'all' && agreement.type !== typeFilter) return false;
        const needle = query.trim().toLowerCase();
        return !needle || `${agreement.champs.titre} ${agreement.champs.partieNom} ${agreement.reference}`.toLowerCase().includes(needle);
    });
    const current = screen.id ? agreements.find((agreement) => agreement.id === screen.id) : null;

    const closeScreen = () => setScreen({ name: 'list' });
    const editorOpen = screen.name === 'edit';
    const viewOpen = screen.name === 'view' && !!current;

    return (
        <div className="dark-ui">
            <p className="text-muted small">
                Contrats avec des entreprises, fournisseurs, prestataires ou partenaires. Chaque accord suit un modèle qui renvoie aux articles du Code Civil (personnes morales, représentation et contrats)
                et du Code Pénal ; l'écrit est obligatoire à partir de 100 000 $ ou pour une location immobilière (art. 206).
            </p>
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3" data-no-mark>
                <Form.Control type="search" style={{ maxWidth: 300 }} placeholder="Rechercher (intitulé, partie, réf.)…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <Form.Select style={{ maxWidth: 220 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Statut">
                    <option value="all">Tous les statuts</option>
                    {Object.entries(AGREEMENT_STATUS).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
                </Form.Select>
                <Form.Select style={{ maxWidth: 220 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Type">
                    <option value="all">Tous les types</option>
                    {Object.entries(AGREEMENT_TYPES).map(([key, info]) => <option key={key} value={key}>{info.short}</option>)}
                </Form.Select>
                <Dropdown>
                    <Dropdown.Toggle variant="success" size="sm" disabled={loading}><i className="fas fa-plus-circle me-1"></i>Nouvel accord</Dropdown.Toggle>
                    <Dropdown.Menu className="contracts-menu" popperConfig={{ strategy: 'fixed' }}>
                        {Object.entries(AGREEMENT_TYPES).map(([key, info]) => (
                            <Dropdown.Item key={key} onClick={() => setScreen({ name: 'edit', type: key })}>
                                <i className={`fas ${info.icon} me-2`}></i><strong>{info.short}</strong>
                                <small className="d-block" style={{ maxWidth: 320, whiteSpace: 'normal', color: '#8b949e' }}>{info.help}</small>
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown>
                <Button variant="outline-secondary" size="sm" onClick={load} disabled={loading} title="Actualiser"><i className="fas fa-sync-alt"></i></Button>
            </div>

            {loading && <Spinner animation="border" size="sm" />}
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}
            {!loading && !error && filtered.length === 0 && <p className="text-muted">Aucun accord{agreements.length ? ' ne correspond à ces filtres' : ' pour le moment'}.</p>}

            {filtered.length > 0 && (
                <div className="table-responsive">
                <Table hover size="sm" variant="dark" className="align-middle">
                    <thead>
                        <tr><th>Accord</th><th>Partie</th><th>Type</th><th>Montant</th><th>Statut</th><th>Mis à jour</th><th></th></tr>
                    </thead>
                    <tbody>
                        {filtered.map((agreement) => (
                            <tr key={agreement.id}>
                                <td>{agreement.champs.titre || <em>(sans titre)</em>}{agreement.reference && <small className="d-block text-muted">{agreement.reference}</small>}</td>
                                <td>{agreement.champs.partieNom || '—'}{agreement.partieUid && <small className="d-block text-muted"><i className="fas fa-user-check me-1"></i>compte lié</small>}</td>
                                <td><i className={`fas ${AGREEMENT_TYPES[agreement.type].icon} me-1`}></i>{AGREEMENT_TYPES[agreement.type].short}</td>
                                <td>{money(agreement.champs.montant)}</td>
                                <td><Badge bg={AGREEMENT_STATUS[agreement.statut].variant}>{AGREEMENT_STATUS[agreement.statut].label}</Badge></td>
                                <td>{formatDate(agreement.modifieLe || agreement.creeLe)}</td>
                                <td>
                                    <div className="contracts-row-actions">
                                        <Button size="sm" variant="outline-light" onClick={() => setScreen({ name: 'view', id: agreement.id })}>
                                            {agreement.statut === 'brouillon' ? <><i className="fas fa-edit me-1"></i>Modifier</> : <><i className="fas fa-eye me-1"></i>Voir</>}
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
                </div>
            )}

            <BaseModal
                isOpen={editorOpen}
                onClose={() => setScreen(current ? { name: 'view', id: current.id } : { name: 'list' })}
                title={editorOpen ? `${current ? 'Modifier le brouillon' : 'Nouvel accord'} — ${AGREEMENT_TYPES[screen.type].label}` : ''}
                modalSize="xl"
                zIndex={1100}
                className="dark-ui"
                closeOnOverlayClick={false}
            >
                {editorOpen && (
                    <div data-guide-zone>
                        <AgreementEditor
                            key={`${screen.type}-${screen.id || 'nouveau'}`}
                            type={screen.type}
                            agreement={current}
                            accounts={accounts}
                            issuer={issuer}
                            showNotification={showNotification}
                            onCancel={() => setScreen(current ? { name: 'view', id: current.id } : { name: 'list' })}
                            onSaved={async (id) => { await load(); setScreen({ name: 'view', id }); }}
                        />
                    </div>
                )}
            </BaseModal>

            <BaseModal
                isOpen={viewOpen}
                onClose={closeScreen}
                title={viewOpen ? (current.champs.titre || 'Accord commercial') : ''}
                modalSize="large"
                zIndex={1100}
                className="dark-ui"
            >
                {viewOpen && (
                    <AgreementView
                        key={current.id}
                        agreement={current}
                        issuer={issuer}
                        showNotification={showNotification}
                        onBack={closeScreen}
                        onEdit={() => setScreen({ name: 'edit', id: current.id, type: current.type })}
                        onChanged={load}
                    />
                )}
            </BaseModal>
        </div>
    );
};

export default CommercialAgreementsManager;
