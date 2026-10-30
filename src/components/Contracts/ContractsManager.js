// src/components/Contracts/ContractsManager.js
//
// Onglet « Contrats » de la Gestion du recrutement (admins + recruteurs) et fenêtre « Documents disciplinaires » (admins, Direction, assistance,
// personnel administratif) : liste des documents contractuels, création / édition d'un brouillon sur le
// MODÈLE VERROUILLÉ de chaque type (voir utils/contractDocs.js : contrat CDI ou CDD, convention de stage, avenant, convocation à un entretien préalable,
// notification de sanction, notification de fin de contrat), envoi à un membre du personnel (qui le signe depuis « Mes documents administratifs »), retrait, suppression
// et consultation des documents signés.
//
// Le formulaire se construit à partir des champs du type choisi ; l'aperçu est le document final, dans la charte graphique du PHMC (BBCode).
// Un recruteur ne peut jamais rédiger SON PROPRE contrat (un admin ou un autre recruteur le fait) : règle appliquée ici, dans saveContractDraft et dans
// database.rules.json.
// `scope` sépare les deux usages : « recruitment » (contrats, conventions, avenants : recruteurs et admins) et « discipline » (convocations, sanctions,
// fins de contrat : jamais les recruteurs).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Dropdown, Form, Spinner, Table } from 'react-bootstrap';
import * as Sentry from '@sentry/react';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import ContractDocument, { ContractExportBar } from './ContractDocument';
import PersonnelFileDialog from './PersonnelFileDialog';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { STAFF_SERVICES, loadStaffMembers, loadCivilians, loadRecruiterUids, rankLabel } from '../../utils/staffAdmin';
import { normalizeRank, getRoleInfo, canManageDiscipline } from '../../constants/ranks';
import { loadContractCandidates, clearContractCandidate } from '../../utils/contractCandidates';
import { loadUserCreations } from '../../utils/userCreations';
import { loadSalaryGrid, echelonOf, rateOf, formatRate, formatEchelonRates } from '../../utils/salaryGrid';
import { HOSPITAL_SERVICES, PRIME_CRITERIA, parseServices, joinServices } from '../../constants/contractOptions';
import { sendTemplatedMail } from '../../utils/mailTemplates';
import { sendAdminActionWebhook } from '../Admin/adminUtils';
import {
    CONTRACT_STATUS, CONTRACT_TYPES, loadAllContracts, saveContractDraft, sendContract, retractContract, deleteContract,
    contractTypeOf, contractLabel, contractStatusLabel, isOfferExpired,
} from '../../utils/contracts';
import {
    CONTRACT_TYPE_INFO, isEmploymentType, emptyContractFields, visibleFields, validateDocFields, buildContractBb, formatDateFr,
    formatTimestampDateFr, acceptanceKind, SANCTIONS, FIN_MOTIFS, isDisciplinaryType, RATE_MODE_LABELS, DEFAULT_RATE_MODE,
} from '../../utils/contractDocs';

const TYPE_GROUPS = [
    { key: 'all', label: 'Tous les documents' },
    { key: 'contrat', label: 'Contrats et conventions' },
    { key: 'avenant', label: 'Avenants' },
    { key: 'procedure', label: 'Procédure disciplinaire' },
    { key: 'fin', label: 'Fins de contrat' },
];

const TYPE_HELP = {
    cdi: 'Engagement à durée indéterminée, avec serment, déontologie, discipline et conditions de rupture.',
    cdd: 'Engagement jusqu\'à une date, pour un motif précis.',
    stage: 'Accueil d\'un étudiant, interne ou stagiaire sous la supervision d\'un tuteur, sans fonction autonome.',
    avenant: 'Modifie un contrat déjà signé (promotion, rémunération, horaires, prolongation d\'un CDD…).',
    convocation: 'Première étape de toute sanction ou licenciement : entretien préalable, au moins 72 heures après l\'envoi.',
    sanction: 'Notifie la sanction décidée après l\'entretien (avertissement, blâme, mise à pied, rétrogradation).',
    fin: 'Démission, licenciement, fin de CDD ou de stage, rupture amiable, fin de plein droit, avec attestation de fin de fonctions.',
};

const issuerTitleOf = (staffProfile, isAdmin) => {
    const rank = normalizeRank(staffProfile?.rank || staffProfile?.category || '');
    if (rank) return rank;
    return isAdmin ? 'Administration' : 'Chargé(e) de recrutement';
};

// Types proposés selon l'usage : les documents disciplinaires d'un côté, tout le reste de l'autre.
const typesForScope = (scope) => Object.keys(CONTRACT_TYPES).filter((key) => (scope === 'discipline') === isDisciplinaryType(key));
const groupsForScope = (scope) => TYPE_GROUPS.filter((g) => g.key === 'all' || (scope === 'discipline' ? ['procedure', 'fin'] : ['contrat', 'avenant']).includes(g.key));

// ───────────────────────────── Éditeur / lecture d'un document ─────────────────────────────
// `staff` = destinataires possibles : membres du personnel (kind « staff »), recruteurs (kind « recruiter ») et candidats acceptés ayant le rôle
// « en attente de contrat » (kind « candidate », réservés aux contrats et conventions). Recruteurs et candidats sont des comptes Civils sans fiche :
// le service se choisit dans l'éditeur. `contracts` = tous les documents (pour retrouver le contrat modifié ou la convocation de la personne).
const ContractEditor = ({ show, onHide, contract, newType, staff, contracts, issuer, scope, archived = false, onChanged, showNotification }) => {
    const [type, setType] = useState('cdi');
    const [employeeUid, setEmployeeUid] = useState('');
    const [candidateService, setCandidateService] = useState('phmc');
    const [filter, setFilter] = useState('');
    const [fields, setFields] = useState(emptyContractFields('cdi'));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [grid, setGrid] = useState(null);   // grille des rémunérations publiée (page Transparence)

    const isNew = !contract;
    const ownContract = !!contract && contract.employeUid === issuer.uid && !issuer.isAdmin;
    // Un document d'une personne qui n'est plus dans le personnel est une archive : consultable, jamais modifiable.
    const readOnly = (!!contract && contract.statut !== 'brouillon') || ownContract || archived;

    useEffect(() => {
        if (!show) return;
        loadSalaryGrid().then(setGrid);
        setError('');
        setFilter('');
        const initialType = contract ? contractTypeOf(contract) : (newType || 'cdi');
        setType(initialType);
        setEmployeeUid(contract?.employeUid || '');
        setCandidateService(contract?.service || 'phmc');
        setFields({ ...emptyContractFields(initialType), ...(contract?.champs || {}), typeContrat: initialType });
    }, [show, contract, newType]);

    const employmentType = isEmploymentType(type);

    // Personnel avec un compte de connexion (seul un compte lié peut recevoir et signer). Un candidat n'a pas encore de contrat : il ne reçoit
    // ni avenant, ni convocation, ni notification.
    const recipients = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return staff.filter((m) => m.uid
            && (issuer.isAdmin || m.uid !== issuer.uid)
            && (employmentType || m.kind !== 'candidate')
            && (!q || m.displayName.toLowerCase().includes(q)));
    }, [staff, filter, issuer.uid, issuer.isAdmin, employmentType]);
    const employee = staff.find((m) => m.uid === employeeUid) || null;
    const isCandidate = !!employee && employee.kind !== 'staff'; // compte Civil sans fiche : service à choisir
    const service = isCandidate ? candidateService : (employee?.service || contract?.service || 'phmc');
    const ranks = STAFF_SERVICES[service]?.ranks || [];

    // Documents de la personne : contrats signés (pour un avenant ou une fin de contrat) et convocations envoyées (pour une sanction ou un licenciement).
    const ofEmployee = useMemo(() => contracts.filter((c) => c.employeUid === employeeUid && c.id !== contract?.id), [contracts, employeeUid, contract]);
    const signedEmployment = useMemo(() => ofEmployee
        .filter((c) => c.statut === 'signe' && isEmploymentType(contractTypeOf(c)))
        .sort((a, b) => (b.signeLe || 0) - (a.signeLe || 0)), [ofEmployee]);
    const convocations = useMemo(() => ofEmployee
        .filter((c) => contractTypeOf(c) === 'convocation' && c.statut !== 'brouillon')
        .sort((a, b) => (b.envoyeLe || 0) - (a.envoyeLe || 0)), [ofEmployee]);

    const refContract = signedEmployment.find((c) => c.id === fields.contratRefId) || null;
    const convocationObjet = type === 'sanction' ? 'sanction' : 'licenciement';
    const convocationChoices = useMemo(() => convocations.filter((c) => c.champs.objet === convocationObjet), [convocations, convocationObjet]);
    const convocation = convocations.find((c) => c.id === fields.convocationRefId) || null;
    const ctx = useMemo(() => ({ refContract, convocation }), [refContract, convocation]);

    const set = (field) => (e) => setFields((prev) => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

    const onChangeType = (nextType) => {
        autoRoleRef.current = null;
        setType(nextType);
        setFields(emptyContractFields(nextType));
        if (!isEmploymentType(nextType) && employee?.kind === 'candidate') setEmployeeUid('');
    };

    const onPickEmployee = (uid) => {
        setEmployeeUid(uid);
        const picked = staff.find((m) => m.uid === uid);
        // Pré-remplit grade et fonction avec ceux de la fiche (modifiables : c'est parfois une promotion).
        if (employmentType && picked && picked.kind === 'staff') {
            setFields((prev) => ({ ...prev, role: prev.role || normalizeRank(picked.rank || ''), poste: prev.poste || rankLabel(picked.service, picked.rank) }));
        } else if (employmentType && picked?.role) {
            // Candidat accepté : le rôle relié à son poste de recrutement pré-remplit le contrat (service compris).
            setCandidateService(getRoleInfo(picked.role)?.pole === 'dmec' ? 'coroner' : 'phmc');
            setFields((prev) => ({ ...prev, role: prev.role || picked.role, poste: prev.poste || picked.poste || picked.role }));
        }
    };

    // Liens par défaut : le dernier contrat signé de la personne, la dernière convocation de l'objet voulu.
    useEffect(() => {
        if (readOnly || !employeeUid) return;
        setFields((prev) => {
            let next = prev;
            if ((type === 'avenant' || type === 'fin') && !prev.contratRefId && signedEmployment.length > 0) {
                next = { ...next, contratRefId: signedEmployment[0].id };
            }
            const needsConvocation = type === 'sanction' || (type === 'fin' && ['licenciement', 'licenciement_disciplinaire'].includes(prev.motif));
            if (needsConvocation && !prev.convocationRefId && convocationChoices.length > 0) {
                next = { ...next, convocationRefId: convocationChoices[0].id };
            }
            return next;
        });
    }, [readOnly, employeeUid, type, fields.motif, signedEmployment, convocationChoices]); // eslint-disable-line react-hooks/exhaustive-deps

    const visible = useMemo(() => visibleFields(type, fields, ctx), [type, fields, ctx]);

    const preview = useMemo(() => {
        if (readOnly || !employee) return null;
        try {
            return buildContractBb({
                type, service, employeeName: employee.displayName, employeeBadge: employee.badge, champs: fields,
                issuer: { name: issuer.name, title: issuer.title }, id: contract?.id, timestamp: Date.now(), refContract, convocation,
            });
        } catch (err) {
            console.error('Aperçu impossible :', err);
            return null;
        }
    }, [readOnly, employee, type, service, fields, issuer.name, issuer.title, contract, refContract, convocation]);

    const guard = async (fn) => {
        setBusy(true);
        setError('');
        try { await fn(); } catch (err) {
            console.error(err);
            Sentry.captureException(err, { extra: { context: 'ContractsManager' } });
            setError(err.message || String(err));
        } finally { setBusy(false); }
    };

    const notifyEmployee = (ref) => {
        if (!employee.email) return;
        const accord = acceptanceKind(type, fields) === 'accord';
        sendTemplatedMail(accord ? 'document_a_signer' : 'document_notifie', {
            to: employee.email,
            vars: { nom: employee.displayName, type_document: CONTRACT_TYPES[type], reference: ref },
        });
    };

    const save = async ({ thenSend }) => guard(async () => {
        if (!employee) throw new Error('Choisissez le destinataire du document.');
        const { errors, warnings } = validateDocFields(type, fields, ctx, { forSend: thenSend });
        if (errors.length) throw new Error(errors.join(' '));
        if (thenSend) {
            const warningText = warnings.length ? `\n\nAttention :\n- ${warnings.join('\n- ')}` : '';
            if (!window.confirm(`Envoyer « ${CONTRACT_TYPES[type]} » à ${employee.displayName} ?\n\nLe texte sera figé : pour le modifier ensuite, il faudra le retirer.${warningText}`)) return;
        }
        const id = await saveContractDraft({ id: contract?.id, employee, service, champs: { ...fields, typeContrat: type }, issuer });
        if (thenSend) {
            // Signature de l'émetteur : celle de « Mes créations » si elle existe (sinon son nom, en italique, tient lieu de signature).
            let signatureUrl = '';
            try { signatureUrl = (await loadUserCreations(issuer.uid)).signature?.url || ''; } catch (err) { /* pas de signature enregistrée */ }
            const { reference } = await sendContract(id, { name: issuer.name, title: issuer.title, signatureUrl });
            sendAdminActionWebhook(issuer.email, `${CONTRACT_TYPES[type]} envoyé`, `Employé : ${employee.displayName}\nRéférence : ${reference}`, null, issuer.label);
            notifyEmployee(reference);
        }
        showNotification(thenSend ? `Document envoyé à ${employee.displayName}.` : 'Brouillon enregistré.', 'success');
        onChanged();
        onHide();
    });

    const retract = () => guard(async () => {
        if (!window.confirm('Retirer ce document ? Il disparaîtra de la liste de l\'employé et repassera en brouillon.')) return;
        await retractContract(contract.id);
        showNotification('Document retiré (repassé en brouillon).', 'info');
        onChanged();
        onHide();
    });

    // Un grade a UN échelon dans la grille (il fixe son salaire) : il est sélectionné d'office dès que le grade est choisi, et préremplit la rémunération dans le
    // mode choisi (à l'heure ou à la semaine). On peut choisir un autre des 15 échelons (la rémunération suit) : un avertissement signale alors l'écart avec la grille.
    const payFields = employmentType && type !== 'stage';
    const allEchelons = useMemo(() => grid?.echelons || [], [grid]);
    const gradeEchelon = useMemo(() => echelonOf(grid, fields.role), [grid, fields.role]);
    const rateText = (echelon, mode) => (rateOf(echelon, mode) !== null ? formatRate(rateOf(echelon, mode), mode) : '');
    const autoRoleRef = useRef(null);   // grade pour lequel l'échelon a déjà été posé d'office (on ne l'écrase pas ensuite)

    useEffect(() => {
        if (!show) autoRoleRef.current = null;
    }, [show, contract]);

    useEffect(() => {
        if (readOnly || !payFields || !gradeEchelon || autoRoleRef.current === fields.role) return;
        autoRoleRef.current = fields.role;
        // Un brouillon enregistré garde son échelon et sa rémunération tant que son grade ne change pas.
        if (contract && contract.champs?.echelon && fields.role === contract.champs?.role) return;
        setFields((prev) => ({ ...prev, echelon: gradeEchelon.libelle, remuneration: rateText(gradeEchelon, prev.modeRemuneration || DEFAULT_RATE_MODE) }));
    }, [readOnly, payFields, gradeEchelon, fields.role, contract]); // eslint-disable-line react-hooks/exhaustive-deps

    const pickEchelon = (libelle) => setFields((prev) => {
        const found = allEchelons.find((e) => e.libelle === libelle);
        return { ...prev, echelon: libelle, ...(found ? { remuneration: rateText(found, prev.modeRemuneration || DEFAULT_RATE_MODE) } : {}) };
    });
    const pickRateMode = (mode) => setFields((prev) => {
        const found = allEchelons.find((e) => e.libelle === prev.echelon);
        return { ...prev, modeRemuneration: mode, ...(found ? { remuneration: rateText(found, mode) } : {}) };
    });
    const gridWarning = useMemo(() => {
        const found = allEchelons.find((e) => e.libelle === fields.echelon);
        if (!found) return '';
        const mode = fields.modeRemuneration || DEFAULT_RATE_MODE;
        const expected = formatRate(rateOf(found, mode), mode);
        return fields.remuneration && fields.remuneration.trim() !== expected ? `La grille publiée indique « ${expected} » pour cet échelon : la rémunération du contrat diffère.` : '';
    }, [allEchelons, fields.echelon, fields.modeRemuneration, fields.remuneration]);
    const echelonWarning = gradeEchelon && fields.echelon && fields.echelon !== gradeEchelon.libelle
        ? `Le grade « ${normalizeRank(fields.role)} » est à l'${gradeEchelon.libelle} dans la grille publiée : cet échelon est différent.` : '';

    const toggleService = (key, name, checked) => setFields((prev) => {
        const current = parseServices(prev[key]);
        return { ...prev, [key]: joinServices(checked ? [...current, name] : current.filter((s) => s !== name)) };
    });
    const addCriterion = (criterion) => setFields((prev) => {
        const current = String(prev.primeCriteres || '').trim();
        if (current.split('\n').map((line) => line.trim()).includes(criterion)) return prev;
        return { ...prev, primeCriteres: current ? `${current}\n${criterion}` : criterion };
    });

    const renderField = (field) => {
        const value = fields[field.key] ?? '';
        const common = { value, onChange: set(field.key) };
        let control;
        switch (field.type) {
            case 'echelon':
                control = (
                    <Form.Select value={value} onChange={(e) => pickEchelon(e.target.value)}>
                        {!value && <option value="">{fields.role ? 'Choisir un échelon…' : 'Choisissez d\'abord le grade'}</option>}
                        {allEchelons.map((e) => <option key={e.numero} value={e.libelle}>{e.libelle} — {formatEchelonRates(e)}{gradeEchelon?.numero === e.numero ? ' (échelon du grade)' : ''}</option>)}
                    </Form.Select>
                );
                break;
            case 'rateMode':
                control = (
                    <Form.Select value={fields.modeRemuneration || DEFAULT_RATE_MODE} onChange={(e) => pickRateMode(e.target.value)}>
                        {Object.entries(RATE_MODE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </Form.Select>
                );
                break;
            case 'services': {
                const selected = parseServices(value);
                const extra = selected.filter((s) => !HOSPITAL_SERVICES.includes(s));   // texte libre d'un ancien document : conservé
                control = (
                    <div className="contract-services">
                        {[...HOSPITAL_SERVICES, ...extra].map((name) => (
                            <Form.Check
                                key={name} type="checkbox" id={`service-${field.key}-${name}`} label={name}
                                checked={selected.includes(name)} onChange={(e) => toggleService(field.key, name, e.target.checked)}
                            />
                        ))}
                    </div>
                );
                break;
            }
            case 'criteres':
                control = (
                    <>
                        <Form.Select className="mb-1" value="" onChange={(e) => { if (e.target.value) addCriterion(e.target.value); }}>
                            <option value="">Ajouter un critère par défaut…</option>
                            {PRIME_CRITERIA.map((criterion) => <option key={criterion} value={criterion}>{criterion}</option>)}
                        </Form.Select>
                        <Form.Control as="textarea" rows={3} {...common} placeholder={field.placeholder} />
                    </>
                );
                break;
            case 'role':
                control = (
                    <Form.Select {...common}>
                        <option value="">Sélectionner…</option>
                        {ranks.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </Form.Select>
                );
                break;
            case 'contratRef':
                control = (
                    <>
                        <Form.Select {...common}>
                            <option value="">{signedEmployment.length ? 'Sélectionner…' : 'Aucun contrat signé pour cette personne'}</option>
                            {signedEmployment.map((c) => <option key={c.id} value={c.id}>{contractLabel(c)} · signé le {formatTimestampDateFr(c.signeLe)} · {c.reference}</option>)}
                        </Form.Select>
                        {refContract && (
                            <div className="contract-ref-summary">
                                Conditions actuelles : <strong>{refContract.champs.poste || '—'}</strong> · grade <strong>{normalizeRank(refContract.champs.role) || '—'}</strong>
                                {refContract.champs.remuneration ? <> · <strong>{refContract.champs.remuneration}</strong></> : null}
                                {refContract.champs.dateDebut ? <> · depuis le {formatDateFr(refContract.champs.dateDebut)}</> : null}
                                {refContract.champs.dateFin ? <> · jusqu'au {formatDateFr(refContract.champs.dateFin)}</> : null}
                            </div>
                        )}
                    </>
                );
                break;
            case 'convocationRef':
                control = (
                    <Form.Select {...common}>
                        <option value="">{convocationChoices.length ? 'Sélectionner…' : `Aucune convocation « ${convocationObjet === 'sanction' ? 'sanction' : 'licenciement'} » pour cette personne`}</option>
                        {convocationChoices.map((c) => (
                            <option key={c.id} value={c.id}>
                                Convocation du {formatTimestampDateFr(c.envoyeLe)} · entretien le {formatDateFr(c.champs.dateEntretien)} à {c.champs.heureEntretien || '—'}{c.statut === 'brouillon' ? ' (brouillon)' : ''}
                            </option>
                        ))}
                    </Form.Select>
                );
                break;
            case 'select':
                control = (
                    <Form.Select {...common}>
                        <option value="">Sélectionner…</option>
                        {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Form.Select>
                );
                break;
            case 'checkbox':
                control = <Form.Check type="checkbox" id={`field-${field.key}`} label={field.label} checked={!!fields[field.key]} onChange={set(field.key)} />;
                break;
            case 'textarea':
                control = <Form.Control as="textarea" rows={3} {...common} placeholder={field.placeholder} />;
                break;
            case 'number':
                control = <Form.Control inputMode="numeric" value={value} onChange={(e) => setFields((p) => ({ ...p, [field.key]: e.target.value.replace(/\D/g, '') }))} placeholder={field.placeholder} />;
                break;
            case 'date':
                control = <Form.Control type="date" {...common} />;
                break;
            case 'time':
                control = <Form.Control type="time" {...common} />;
                break;
            default:
                control = <Form.Control {...common} placeholder={field.placeholder} />;
        }
        return (
            <Form.Group key={field.key} className={field.half ? 'contract-field-half' : ''}>
                {field.type !== 'checkbox' && <Form.Label>{field.label}{field.required ? '' : <small className="text-muted"> (facultatif)</small>}</Form.Label>}
                {control}
                {field.help && field.type !== 'checkbox' && <Form.Text className="text-muted d-block">{field.help}</Form.Text>}
                {field.key === 'echelon' && echelonWarning && <Form.Text className="text-warning d-block"><i className="fas fa-triangle-exclamation me-1"></i>{echelonWarning}</Form.Text>}
                {field.key === 'remuneration' && gridWarning && <Form.Text className="text-warning d-block"><i className="fas fa-triangle-exclamation me-1"></i>{gridWarning}</Form.Text>}
            </Form.Group>
        );
    };

    const title = isNew ? `Nouveau document — ${CONTRACT_TYPES[type]}` : `${CONTRACT_TYPES[type]} — ${contract.employeNom}`;

    return (
        <BaseModal isOpen={show} onClose={onHide} title={title} modalSize="large" zIndex={1100} className="dark-ui">
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}

            {readOnly ? (
                <>
                    <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2">
                            <Badge bg={isOfferExpired(contract) ? 'danger' : CONTRACT_STATUS[contract.statut]?.variant}>
                                {isOfferExpired(contract) ? 'Offre caduque' : contractStatusLabel(contract)}
                            </Badge>
                            {contract.statut !== 'brouillon' && <small className="text-muted">Réf. {contract.reference}</small>}
                        </div>
                    </div>
                    {ownContract && (
                        <Alert variant="info" className="py-2">
                            Il s'agit de votre propre document : un recruteur ne peut pas le modifier, c'est un admin ou un autre recruteur qui s'en charge.
                            {contract.statut !== 'signe' && ' Vous le lirez et le signerez depuis « Mes documents administratifs » dès qu\'il vous aura été envoyé.'}
                        </Alert>
                    )}
                    {contract.texteFige
                        ? <ContractDocument contract={contract} />
                        : <Alert variant="secondary" className="py-2 mb-0">Brouillon en cours de rédaction : le texte n'est visible qu'une fois le document envoyé.</Alert>}
                    {contract.texteFige && <ContractExportBar contract={contract} showNotification={showNotification} />}
                    {contract.statut === 'envoye' && !ownContract && (
                        <div className="mt-3 d-flex justify-content-end">
                            <Button variant="outline-warning" onClick={retract} disabled={busy}>
                                {busy ? <Spinner size="sm" animation="border" /> : 'Retirer pour modifier'}
                            </Button>
                        </div>
                    )}
                </>
            ) : (
                <>
                    {isNew && (
                        <Form.Group className="mb-3">
                            <Form.Label>Type de document</Form.Label>
                            <Form.Select value={type} onChange={(e) => onChangeType(e.target.value)}>
                                {typesForScope(scope).map((key) => <option key={key} value={key}>{CONTRACT_TYPES[key]}</option>)}
                            </Form.Select>
                            <Form.Text className="text-muted">{TYPE_HELP[type]}</Form.Text>
                        </Form.Group>
                    )}

                    <Form.Group className="mb-3">
                        <Form.Label>Destinataire</Form.Label>
                        {isNew ? (
                            <>
                                <Form.Control className="mb-1" type="search" placeholder="Filtrer par nom…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                                <Form.Select value={employeeUid} onChange={(e) => onPickEmployee(e.target.value)}>
                                    <option value="">Sélectionner…</option>
                                    {recipients.map((m) => (
                                        <option key={m.uid} value={m.uid}>
                                            {m.kind === 'candidate' ? `${m.displayName} — candidat accepté (en attente de contrat)`
                                                : m.kind === 'recruiter' ? `${m.displayName} — recruteur`
                                                    : `${m.displayName} — ${STAFF_SERVICES[m.service].label} — ${rankLabel(m.service, m.rank)}`}
                                        </option>
                                    ))}
                                </Form.Select>
                                <Form.Text className="text-muted">
                                    Membres du personnel avec un compte de connexion, recruteurs (hors vous-même, sauf admin){employmentType ? ' et candidats acceptés à qui vous avez passé le rôle « en attente de contrat » (bouton dans l\'onglet Candidatures)' : ''}.
                                </Form.Text>
                            </>
                        ) : (
                            <Form.Control value={`${contract.employeNom} — ${STAFF_SERVICES[service]?.label || service}`} disabled />
                        )}
                    </Form.Group>

                    {isCandidate && (
                        <Form.Group className="mb-3">
                            <Form.Label>Service</Form.Label>
                            <Form.Select value={candidateService} onChange={(e) => { setCandidateService(e.target.value); setFields((p) => ({ ...p, role: '' })); }}>
                                {Object.values(STAFF_SERVICES).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </Form.Select>
                        </Form.Group>
                    )}

                    {!employee && <Alert variant="secondary" className="py-2">Choisissez le destinataire pour afficher les champs du document.</Alert>}
                    {employee && (
                        <div className="contract-field-row">
                            {visible.map(renderField)}
                        </div>
                    )}

                    {type === 'convocation' && fields.dateEntretien && (
                        <Alert variant="info" className="py-2 small">
                            Rappel : l'entretien doit avoir lieu au moins 72 heures après l'<strong>envoi</strong> de la convocation (heure de l'envoi, pas du brouillon).
                        </Alert>
                    )}
                    {(type === 'sanction' || type === 'fin') && employee && !convocationChoices.length && (type === 'sanction' || ['licenciement', 'licenciement_disciplinaire'].includes(fields.motif)) && (
                        <Alert variant="warning" className="py-2 small">
                            Cette notification exige une convocation préalable à un entretien (objet « {convocationObjet} »). Créez et envoyez d'abord une <strong>convocation</strong>, attendez 72 heures, tenez l'entretien, puis revenez ici.
                        </Alert>
                    )}

                    <div className="small text-muted mb-1">Aperçu du document final (les articles sont fixés par le modèle) :</div>
                    {preview
                        ? <ContractDocument bbCode={preview.bbCode} title={preview.title} />
                        : <Alert variant="secondary" className="py-2 mb-0">Choisissez le destinataire pour voir l'aperçu.</Alert>}

                    <div className="d-flex justify-content-end gap-2 mt-3">
                        <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                        <Button variant="outline-primary" onClick={() => save({ thenSend: false })} disabled={busy}>Enregistrer le brouillon</Button>
                        <Button variant="success" onClick={() => save({ thenSend: true })} disabled={busy}>
                            {busy ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-paper-plane me-1"></i>Enregistrer et envoyer</>}
                        </Button>
                    </div>
                </>
            )}
        </BaseModal>
    );
};

// ───────────────────────────── Liste ─────────────────────────────
// `initialQuery` : recherche pré-remplie (raccourci de l'annuaire).
const ContractsManager = ({ showNotification, scope = 'recruitment', initialQuery = '' }) => {
    const { currentEmployee, isAdmin, staffName, staffProfile, civilianProfile } = useEmployeeAuth();
    const [contracts, setContracts] = useState([]);
    const [staff, setStaff] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [recruiters, setRecruiters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [registryComplete, setRegistryComplete] = useState(false); // faux si la liste des comptes n'a pas pu être lue en entier
    const [query, setQuery] = useState(initialQuery);
    const [group, setGroup] = useState('all');
    const [editing, setEditing] = useState(undefined); // undefined = fermé, sinon le document existant à ouvrir
    const [newType, setNewType] = useState(null);       // type d'un nouveau document en cours de création
    const [fileOf, setFileOf] = useState(null);         // { uid, name } : dossier du personnel ouvert

    const issuer = useMemo(() => ({
        uid: currentEmployee?.uid,
        email: currentEmployee?.email || 'Inconnu',
        // Un recruteur est un compte Civil (pas de fiche du personnel) : on prend alors son nom Civil.
        name: staffName
            || [civilianProfile?.firstName, civilianProfile?.lastName].filter(Boolean).join(' ')
            || currentEmployee?.email || 'Le recrutement',
        title: issuerTitleOf(staffProfile, isAdmin),
        label: isAdmin ? 'Admin' : (scope === 'discipline' ? 'Administration' : 'Recruteur'),
        isAdmin,
        // Les recruteurs ne rédigent jamais de document disciplinaire (aussi imposé par saveContractDraft et database.rules.json).
        canDiscipline: !!isAdmin || canManageDiscipline(staffProfile),
    }), [currentEmployee, staffName, staffProfile, civilianProfile, isAdmin, scope]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            let partial = false;
            const optional = (promise, fallback) => (scope === 'discipline' ? promise.catch(() => { partial = true; return fallback; }) : promise);
            const [list, members, roleMap, civilians, recruiterMap] = await Promise.all([
                loadAllContracts(), loadStaffMembers(), optional(loadContractCandidates(), {}), optional(loadCivilians(), []), optional(loadRecruiterUids(), {}),
            ]);
            setContracts(list);
            setRegistryComplete(!partial);
            setStaff(members.map((m) => ({ ...m, kind: 'staff' })));
            // Recruteurs : comptes Civils portant le drapeau recruiterUIDs (techniquement des employés).
            setRecruiters(civilians.filter((c) => recruiterMap[c.uid] === true).map((c) => ({
                uid: c.uid,
                kind: 'recruiter',
                displayName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.uid,
                email: c.email || '',
                badge: '',
            })));
            // Candidats avec le rôle : on retrouve leur profil Civil (nom, e-mail).
            // Dès qu'un candidat a son rôle du personnel (fiche posée par l'admin), il n'est plus « en attente de contrat » : on le retire de la liste
            // et on nettoie son marqueur resté dans la base (best-effort).
            const staffUids = new Set(members.map((m) => m.uid).filter(Boolean));
            civilians.filter((c) => roleMap[c.uid] && staffUids.has(c.uid)).forEach((c) => { clearContractCandidate(c.uid).catch(() => {}); });
            setCandidates(civilians.filter((c) => roleMap[c.uid] && !staffUids.has(c.uid)).map((c) => ({
                uid: c.uid,
                kind: 'candidate',
                displayName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.uid,
                email: c.email || '',
                badge: '',
                poste: roleMap[c.uid].poste || '',
                role: roleMap[c.uid].role || '',
            })));
        } catch (err) {
            console.error('Chargement des contrats impossible :', err);
            setError('Impossible de charger les contrats.');
        } finally {
            setLoading(false);
        }
    }, [scope]);

    useEffect(() => { load(); }, [load]);

    // Destinataires : personnel lié à un compte + candidats en attente de contrat.
    // Dédoublonnés par uid (un compte apparaît une seule fois : fiche du personnel > recruteur > candidat).
    const recipients = useMemo(() => {
        const byUid = new Map();
        [...staff, ...recruiters, ...candidates].forEach((m) => { if (m.uid && !byUid.has(m.uid)) byUid.set(m.uid, m); });
        return [...byUid.values()];
    }, [staff, recruiters, candidates]);

    // Archives : documents de personnes qui ne sont plus destinataires possibles (ex-employés redevenus Civils, rôle retiré). Elles gardent leurs
    // documents et les consultent depuis « Mes documents administratifs » ; pour le PHMC, plus rien ne s'envoie, ne se modifie ni ne se supprime
    // (sauf suppression par un admin).
    const recipientUids = useMemo(() => new Set(recipients.map((m) => m.uid)), [recipients]);
    const isArchived = useCallback((c) => registryComplete && !!c.employeUid && !recipientUids.has(c.employeUid), [registryComplete, recipientUids]);

    useEffect(() => { setQuery(initialQuery || ''); }, [initialQuery]);

    const handleRemoveRole = async (candidate) => {
        if (!window.confirm(`Retirer le rôle « en attente de contrat » à ${candidate.displayName} ?`)) return;
        try {
            await clearContractCandidate(candidate.uid);
            showNotification('Rôle retiré.', 'info');
            load();
        } catch (err) {
            showNotification(`Action impossible : ${err.message}`, 'error');
        }
    };

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return contracts.filter((c) => {
            const type = contractTypeOf(c);
            if ((scope === 'discipline') !== isDisciplinaryType(type)) return false;
            const info = CONTRACT_TYPE_INFO[type];
            if (group !== 'all' && info?.group !== group) return false;
            return !q || (c.employeNom || '').toLowerCase().includes(q) || (c.champs?.poste || '').toLowerCase().includes(q) || (c.reference || '').toLowerCase().includes(q);
        });
    }, [contracts, query, group, scope]);

    const handleDelete = async (contract) => {
        const warning = contract.statut === 'signe'
            ? `Supprimer DÉFINITIVEMENT le document SIGNÉ de ${contract.employeNom} ? L'employé n'y aura plus accès.`
            : `Supprimer le document de ${contract.employeNom} ?`;
        if (!window.confirm(warning)) return;
        try {
            await deleteContract(contract.id);
            sendAdminActionWebhook(issuer.email, 'Document contractuel supprimé', `Employé : ${contract.employeNom}\nType : ${CONTRACT_TYPES[contractTypeOf(contract)]}\nStatut : ${CONTRACT_STATUS[contract.statut]?.label}`, null, issuer.label);
            showNotification('Document supprimé.', 'info');
            load();
        } catch (err) {
            showNotification(`Suppression impossible : ${err.message}`, 'error');
        }
    };

    const closeEditor = () => { setEditing(undefined); setNewType(null); };

    return (
        <div className="dark-ui">
            <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
                <Form.Control type="search" style={{ maxWidth: 300 }} placeholder="Rechercher (employé, fonction, référence)…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <Form.Select style={{ maxWidth: 230 }} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filtrer par type de document">
                    {groupsForScope(scope).map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </Form.Select>
                <Dropdown>
                    <Dropdown.Toggle variant="success" size="sm" disabled={loading}>
                        <i className="fas fa-plus-circle me-1"></i>Nouveau document
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="contracts-menu" popperConfig={{ strategy: 'fixed' }}>
                        {typesForScope(scope).map((key) => (
                            <Dropdown.Item key={key} onClick={() => { setEditing(undefined); setNewType(key); }} title={TYPE_HELP[key]}>
                                <i className={`fas ${CONTRACT_TYPE_INFO[key].icon} me-2`}></i>{CONTRACT_TYPES[key]}
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown>
                <Button variant="outline-secondary" size="sm" onClick={load} disabled={loading}><i className="fas fa-sync-alt"></i></Button>
            </div>

            {scope !== 'discipline' && candidates.length > 0 && (
                <div className="mb-3">
                    <div className="small mb-1" style={{ color: '#8b949e' }}>
                        Candidats acceptés en attente de contrat ({candidates.length}) — ils voient « Mes documents administratifs » pour consulter et signer leur contrat :
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                        {candidates.map((candidate) => (
                            <Badge key={candidate.uid} bg="info" text="dark" className="d-inline-flex align-items-center gap-2 py-2">
                                {candidate.displayName}{candidate.poste ? ` · ${candidate.poste}` : ''}
                                <button type="button" className="btn-close btn-sm" style={{ fontSize: '0.6rem' }} aria-label="Retirer le rôle"
                                    title="Retirer le rôle « en attente de contrat »" onClick={() => handleRemoveRole(candidate)}></button>
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {loading && <Spinner animation="border" size="sm" />}
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}
            {!loading && !error && rows.length === 0 && <p style={{ color: '#8b949e' }}>Aucun document{scope === 'discipline' ? ' disciplinaire' : ''}.</p>}

            {rows.length > 0 && (
                <div className="table-responsive">
                    <Table variant="dark" hover size="sm" className="align-middle">
                        <thead><tr><th>Type</th><th>Destinataire</th><th>Objet</th><th>Date</th><th>Statut</th><th>Créé par</th><th></th></tr></thead>
                        <tbody>
                            {rows.map((c) => {
                                const type = contractTypeOf(c);
                                const info = CONTRACT_TYPE_INFO[type];
                                const date = c.champs?.dateDebut || c.champs?.dateEffet || c.champs?.dateEntretien;
                                const subject = isEmploymentType(type)
                                    ? (c.champs?.poste || '—')
                                    : type === 'sanction' ? (SANCTIONS[c.champs?.typeSanction] || 'Sanction')
                                        : type === 'fin' ? (FIN_MOTIFS[c.champs?.motif] || 'Fin de contrat')
                                            : type === 'convocation' ? (c.champs?.objet === 'licenciement' ? 'Licenciement envisagé' : 'Sanction envisagée')
                                                : 'Modification du contrat';
                                return (
                                    <tr key={c.id}>
                                        <td><span className="contract-type-pill"><i className={`fas ${info?.icon || 'fa-file'}`}></i>{info?.short || type}</span></td>
                                        <td className="fw-semibold">
                                            {c.employeNom}
                                            {isArchived(c) && <Badge bg="secondary" className="ms-2 fw-normal" title="Cette personne ne fait plus partie du personnel : le dossier est une archive en lecture seule.">Archive</Badge>}
                                        </td>
                                        <td>{subject}</td>
                                        <td>{date ? formatDateFr(date) : '—'}</td>
                                        <td>
                                            <Badge bg={isOfferExpired(c) ? 'danger' : (CONTRACT_STATUS[c.statut]?.variant || 'secondary')}>
                                                {isOfferExpired(c) ? 'Offre caduque' : contractStatusLabel(c)}
                                            </Badge>
                                        </td>
                                        <td>{c.creeParNom || '—'}</td>
                                        <td>
                                            <div className="contracts-row-actions">
                                                <Button size="sm" variant="outline-light" onClick={() => { setNewType(null); setEditing(c); }}>
                                                    {c.statut === 'brouillon' && !isArchived(c) && (isAdmin || c.employeUid !== issuer.uid)
                                                        ? <><i className="fas fa-edit me-1"></i>Modifier</>
                                                        : <><i className="fas fa-eye me-1"></i>Voir</>}
                                                </Button>
                                                <Button size="sm" variant="outline-info" title="Dossier du personnel : tous les documents de cette personne" onClick={() => setFileOf({ uid: c.employeUid, name: c.employeNom })}>
                                                    <i className="fas fa-folder-open"></i>
                                                </Button>
                                                {/* Un document signé ne se supprime que par un admin (règles Firebase). */}
                                                {(isAdmin || (c.statut !== 'signe' && c.employeUid !== issuer.uid && !isArchived(c))) && (
                                                    <Button size="sm" variant="outline-danger" onClick={() => handleDelete(c)}><i className="fas fa-trash"></i></Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            )}

            <PersonnelFileDialog show={!!fileOf} onHide={() => setFileOf(null)} uid={fileOf?.uid} name={fileOf?.name} contracts={contracts} showNotification={showNotification} />

            <ContractEditor
                show={editing !== undefined || !!newType}
                onHide={closeEditor}
                contract={editing || null}
                newType={newType}
                staff={recipients}
                contracts={contracts}
                issuer={issuer}
                scope={scope}
                archived={!!editing && isArchived(editing)}
                onChanged={load}
                showNotification={showNotification}
            />
        </div>
    );
};

export default ContractsManager;
