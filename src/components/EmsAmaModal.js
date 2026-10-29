// src/components/EmsAmaModal.js
//
// Formulaire AMA (Contre Avis Médical — refus de traitement médical), réservé au personnel soignant.
//   • on SÉLECTIONNE le paramédic et le patient (au lieu de les écrire) ;
//   • le document est reconstitué en BBCode (generateAma.js) : aperçu en direct, copie, HTML, PDF, image — plus de téléversement de
//     l'AMA sur ImgBB (seules les signatures sont des images) ;
//   • le paramédic signe avec SA signature (« Carte de visite & signature ») : s'il n'en a pas, on l'invite à la créer ;
//   • le patient signe avec la signature rangée à son ID patient ; s'il n'en a pas, elle est créée automatiquement à partir de son nom
//     et enregistrée (un patient qui a un compte Civil la retrouve dans « Ma signature ») ;
//   • on certifie que c'est bien le patient (ou son représentant légal) qui signe, comme le consentement des certificats médicaux ;
//   • l'AMA est enregistré chez le créateur ET partagé automatiquement avec le patient (grâce à son ID patient).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import * as Sentry from '@sentry/react';
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { loadStaffMembers, rankLabel } from '../utils/staffAdmin';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import DebugFillButton from './DebugFillButton';
import SignatureCreator from './SignatureCreator';
import { ReportPreviewFrame } from './ReportExpansion';
import { copyToClipboard } from './notificationService';
import generateAma, { effectiveGuardian } from '../phmc-bbcode-generators/generateAma';
import { buildReportTitle } from '../utils/reportTitle';
import {
    normalizePatientId, writeIndexEntry, comprehensiveSanitize, listIndexedPatientIds,
} from '../utils/patientRecords';
import { loadUserCreations } from '../utils/userCreations';
import { loadPatientSignature, ensurePatientSignature } from '../utils/patientSignatures';
import { GUARDIAN_RELATIONS } from '../utils/minors';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../utils/reportDocumentExport';
import { logActivity } from '../utils/activityLog';
import { isLockdownOn, LOCK_MESSAGE } from '../utils/lockdownGuard';
import { loadDeathLock, DEATH_LOCK_MESSAGE } from '../utils/deathReports';
import './EmsAmaModal.css';

const selectStyles = {
    control: (base, state) => ({ ...base, backgroundColor: '#0d1117', borderColor: state.isFocused ? '#58a6ff' : '#30363d', minHeight: '36px', '&:hover': { borderColor: '#58a6ff' } }),
    menu: (base) => ({ ...base, backgroundColor: '#161b22', zIndex: 2000, border: '1px solid #30363d' }),
    menuPortal: (base) => ({ ...base, zIndex: 2000 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#30363d' : '#161b22', color: '#e6edf3' }),
    singleValue: (base) => ({ ...base, color: '#e6edf3' }),
    input: (base) => ({ ...base, color: '#e6edf3' }),
    placeholder: (base) => ({ ...base, color: '#9aa7b4' }),
    groupHeading: (base) => ({ ...base, color: '#9aa7b4', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.72rem' }),
};

const pad = (n) => String(n).padStart(2, '0');
const nowLabel = () => {
    const d = new Date();
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const civilianName = (c) => [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

const EmsAmaModal = ({ show, onHide, showNotification, uploadImageDetailed }) => {
    const { canUseAma, staffName, currentEmployee, isAdmin } = useEmployeeAuth();
    const [staffMembers, setStaffMembers] = useState([]);
    const { bbcodeEnabled } = useSiteConfig();

    const [employee, setEmployee] = useState(null);                  // { value: nom, uid, label }
    const [patientOptions, setPatientOptions] = useState([]);
    const [patientOption, setPatientOption] = useState(null);        // { value: ID canonique, label }
    const [patientName, setPatientName] = useState('');
    const [guardianName, setGuardianName] = useState('');
    const [minor, setMinor] = useState(false);                       // le patient a moins de 18 ans
    const [emancipated, setEmancipated] = useState(false);          // mineur émancipé : il refuse lui-même
    const [guardianRelation, setGuardianRelation] = useState('');
    const [date, setDate] = useState('');
    const [certified, setCertified] = useState(false);
    const [employeeSignature, setEmployeeSignature] = useState(undefined);   // undefined = chargement, null = aucune
    const [patientSignature, setPatientSignature] = useState(undefined);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(null);                        // { bbCode, title, patientID } après l'enregistrement

    // Paramédic : par défaut la personne connectée ; les autres fiches sont proposées (un admin signe pour qui il veut, mais la signature d'un
    // autre n'est lisible que par un admin : sinon cette personne doit signer elle-même).
    useEffect(() => {
        if (!show) return undefined;
        let cancelled = false;
        loadStaffMembers().then((list) => { if (!cancelled) setStaffMembers(list); }).catch(() => {});
        return () => { cancelled = true; };
    }, [show]);
    const employeeOptions = useMemo(() => staffMembers
        .filter((member) => member && member.name && member.service === 'phmc')
        .map((member) => ({ value: member.name, uid: member.uid || null, label: `${member.displayName || member.name} (${rankLabel(member.service, member.rank || member.category)})` }))
        .sort((a, b) => a.label.localeCompare(b.label)), [staffMembers]);

    useEffect(() => {
        if (!show) return;
        setSaved(null);
        setCertified(false);
        setGuardianName('');
        setMinor(false);
        setEmancipated(false);
        setGuardianRelation('');
        setDate(nowLabel());
        setPatientOption(null);
        setPatientName('');
        const own = employeeOptions.find((option) => option.value === staffName);
        setEmployee(own || (staffName ? { value: staffName, uid: currentEmployee?.uid || null, label: staffName } : null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    // Patients proposés : comptes Civils + patients connus par des rapports (comme « Dossier Patient »).
    useEffect(() => {
        if (!show) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const [civilSnap, indexed] = await Promise.all([get(ref(database, 'civilians')), listIndexedPatientIds().catch(() => [])]);
                const withAccount = new Map();
                if (civilSnap.exists()) {
                    Object.values(civilSnap.val()).forEach((c) => {
                        if (c && c.patientID) {
                            const id = normalizePatientId(c.patientID);
                            const name = civilianName(c);
                            withAccount.set(id, { value: id, name, label: `${name} (${id})` });
                        }
                    });
                }
                const withoutAccount = indexed.filter((p) => !withAccount.has(normalizePatientId(p.patientNode)))
                    .map((p) => ({ value: p.patientNode, name: p.patientName || '', label: `${p.patientName || 'Patient sans compte'} (${p.patientNode})` }));
                if (!cancelled) {
                    setPatientOptions([
                        { label: 'Patients avec un compte', options: [...withAccount.values()].sort((a, b) => a.label.localeCompare(b.label)) },
                        { label: 'Patients sans compte', options: withoutAccount.sort((a, b) => a.label.localeCompare(b.label)) },
                    ].filter((group) => group.options.length > 0));
                }
            } catch (error) {
                console.warn('Liste des patients indisponible :', error?.message || error);
            }
        })();
        return () => { cancelled = true; };
    }, [show]);

    // Signature du paramédic choisi.
    const employeeUid = employee?.uid || (employee?.value === staffName ? currentEmployee?.uid : null);
    useEffect(() => {
        if (!show || !employeeUid) { setEmployeeSignature(employee ? null : undefined); return undefined; }
        let cancelled = false;
        setEmployeeSignature(undefined);
        loadUserCreations(employeeUid)
            .then((creations) => { if (!cancelled) setEmployeeSignature(creations.signature || null); })
            .catch(() => { if (!cancelled) setEmployeeSignature(null); });
        return () => { cancelled = true; };
    }, [show, employeeUid]); // eslint-disable-line react-hooks/exhaustive-deps

    const patientID = patientOption ? normalizePatientId(patientOption.value) : '';
    // Signature du patient : celle de son ID si elle existe (sinon créée automatiquement à l'enregistrement).
    useEffect(() => {
        if (!show || !patientID) { setPatientSignature(undefined); return undefined; }
        let cancelled = false;
        setPatientSignature(undefined);
        loadPatientSignature(patientID)
            .then((signature) => { if (!cancelled) setPatientSignature(signature || null); })
            .catch(() => { if (!cancelled) setPatientSignature(null); });
        return () => { cancelled = true; };
    }, [show, patientID]);

    const handlePatientChange = (option) => {
        setPatientOption(option);
        if (option) setPatientName(option.name || (option.__isNew__ ? '' : option.label.replace(/\s*\([^)]*\)\s*$/, '')));
        else setPatientName('');
    };

    const bbCode = useMemo(() => generateAma({
        patientName, patientSignatureUrl: patientSignature?.url || '', guardianName, guardianRelation, minor, emancipated, date,
        paramedicName: employee?.value || '', paramedicSignatureUrl: employeeSignature?.url || '',
    }), [patientName, patientSignature, guardianName, guardianRelation, minor, emancipated, date, employee, employeeSignature]);

    const handleDebugFill = () => {
        const option = { value: 'PHMC-99999', name: 'Jean Michel Testard', label: 'Jean Michel Testard (PHMC-99999)' };
        setPatientOption(option);
        setPatientName(option.name);
        setGuardianName('Marie Testard');
        setCertified(true);
    };

    const handleSave = async () => {
        if (isLockdownOn()) { showNotification(LOCK_MESSAGE, 'warning'); return; }
        if (!canUseAma) { showNotification('Le formulaire AMA est réservé au personnel soignant.', 'warning'); return; }
        if (!staffName) { showNotification("Votre compte n'est lié à aucune fiche du personnel : l'AMA ne peut pas être rangé dans vos rapports.", 'warning', 7000); return; }
        if (!employee?.value) { showNotification('Choisissez le paramédic qui signe.', 'warning'); return; }
        if (!employeeSignature?.url) { showNotification("Le paramédic doit d'abord créer sa signature (voir plus bas) : elle s'imprime sous son nom.", 'warning', 7000); return; }
        if (!patientID) { showNotification('Choisissez le patient (ou tapez son ID).', 'warning'); return; }
        if (!isAdmin && await loadDeathLock(patientID)) { showNotification(DEATH_LOCK_MESSAGE, 'warning', 10000); return; }
        if (!patientName.trim()) { showNotification('Indiquez le nom du patient : il sert à créer sa signature et figure sur le document.', 'warning'); return; }
        if (minor && !emancipated && (!guardianName.trim() || !guardianRelation)) { showNotification('Patient mineur : indiquez le nom du représentant légal et son lien avec le patient.', 'warning', 7000); return; }
        if (!certified) { showNotification('Certifiez que c\'est bien le patient (ou son représentant légal) qui signe.', 'warning'); return; }

        setSaving(true);
        try {
            // Signature du patient : celle de son ID, sinon créée à partir de son nom puis enregistrée pour lui.
            const { signature, created } = await ensurePatientSignature({
                patientID, patientName: patientName.trim(), uploadImageDetailed, actorName: staffName,
            });
            if (created) showNotification(`Signature créée pour ${patientName.trim()} et enregistrée à son ID (${patientID}).`, 'info-circle', 6000);
            setPatientSignature(signature);

            const finalCode = generateAma({
                patientName: patientName.trim(), patientSignatureUrl: signature.url, guardianName: guardianName.trim(), guardianRelation, minor, emancipated, date,
                paramedicName: employee.value, paramedicSignatureUrl: employeeSignature.url,
            });
            const title = buildReportTitle(40, { patientID, patientSignature: patientName.trim(), date }, 'Formulaire AMA');
            const reportKey = `${comprehensiveSanitize(title)}_${Date.now()}`;
            const reportPath = `savedReports/${comprehensiveSanitize(staffName)}/${reportKey}`;
            const timestamp = Date.now();
            await set(ref(database, reportPath), {
                bbCodeVersion: 40,
                kind: 'ama',
                bbCode: finalCode,
                originalKey: title,
                title,
                authorName: staffName,
                creatorName: staffName,
                timestamp,
                data: {
                    patientID,
                    patientName: patientName.trim(),
                    patientSignatureUrl: signature.url,
                    ...effectiveGuardian({ guardianName, guardianRelation, minor, emancipated }),
                    minor,
                    emancipated: minor && emancipated,
                    paramedicName: employee.value,
                    paramedicSignatureUrl: employeeSignature.url,
                    date,
                    patientSignatureCertified: true,
                    certifiedBy: staffName,
                },
            });
            // Copie automatique chez le patient : le rapport est PARTAGÉ avec lui dès sa création (il le retrouve dans son dossier, grâce à son ID).
            await writeIndexEntry({
                patientID,
                indexKey: reportKey,
                entry: {
                    reportPath,
                    visibility: 'shared',
                    bbCodeVersion: 40,
                    kind: 'ama',
                    originalKey: title,
                    title,
                    authorName: staffName,
                    creatorName: staffName,
                    patientName: patientName.trim(),
                    timestamp,
                },
            });
            logActivity({
                category: 'rapports', action: 'ama_created', severity: 'success',
                summary: 'Formulaire AMA (refus de soins) enregistré et partagé avec le patient',
                details: `Patient : ${patientID}\nParamédic : ${employee.value}`, target: patientID,
            });
            setSaved({ bbCode: finalCode, title, patientID });
            showNotification(`AMA enregistré dans vos rapports et partagé avec ${patientName.trim()} (${patientID}).`, 'save');
        } catch (error) {
            console.error('Error saving AMA report:', error);
            Sentry.captureException(error, { extra: { context: 'EMS AMA report save' } });
            logActivity({ category: 'rapports', action: 'ama_failed', severity: 'error', summary: "Échec de l'enregistrement d'un formulaire AMA", details: String(error?.message || error).slice(0, 500) });
            showNotification(`Échec de l'enregistrement de l'AMA : ${String(error?.message || error).slice(0, 120)}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!show) return null;

    const shell = (children) => (
        <div className="modal-overlay">
            <div className="agency-selector-modal ems-ama-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h4>EMS - Contre Avis Médical (AMA)</h4>
                    <Button variant="secondary" className="close" onClick={onHide} aria-label="Fermer"><i className="fas fa-times"></i></Button>
                </div>
                {children}
            </div>
        </div>
    );

    // Réservé aux médecins : les autres voient seulement ce message.
    if (!canUseAma) {
        return shell(<div className="ems-ama-modal-body"><p>Le formulaire AMA est réservé au personnel soignant du PHMC connecté.</p></div>);
    }

    const ownSelected = employee?.value === staffName;
    const needsOwnSignature = employeeSignature === null && ownSelected;

    // Après l'enregistrement : le document est prêt, avec ses exports.
    if (saved) {
        return shell(
            <div className="ems-ama-modal-body">
                <Alert variant="success">
                    <strong>AMA enregistré.</strong> Il est dans vos « Rapports enregistrés » et partagé avec le patient ({saved.patientID}) : il le retrouve dans son dossier.
                </Alert>
                <div className="d-flex flex-wrap gap-2 mb-3">
                    {bbcodeEnabled && (
                        <Button variant="secondary" size="sm" title={COPY_BBCODE_HINT} onClick={() => copyToClipboard(saved.bbCode, showNotification, 'BBCode copié !')}>
                            <i className="fas fa-copy me-1"></i>Copier le BBCode
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" title={DOWNLOAD_HTML_HINT} onClick={() => downloadBbCodeAsHtml({ bbCode: saved.bbCode, title: saved.title, showNotification })}>
                        <i className="fas fa-file-code me-1"></i>Télécharger le HTML
                    </Button>
                    <Button variant="secondary" size="sm" title={PDF_EXPORT_LABEL} onClick={() => exportReportDocument('pdf', { bbCode: saved.bbCode, title: saved.title, showNotification })}>
                        <i className="fas fa-file-pdf me-1"></i>PDF
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => exportReportDocument('png', { bbCode: saved.bbCode, title: saved.title, showNotification })}>
                        <i className="fas fa-image me-1"></i>Image (PNG)
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => exportReportDocument('png-copy', { bbCode: saved.bbCode, title: saved.title, showNotification })}>
                        <i className="fas fa-clipboard me-1"></i>Copier l'image
                    </Button>
                </div>
                <ReportPreviewFrame bbCode={saved.bbCode} title={saved.title} height={520} />
                <div className="d-flex gap-2 mt-3">
                    <Button variant="primary" onClick={() => setSaved(null)}>Nouvel AMA</Button>
                    <Button variant="outline-secondary" onClick={onHide}>Fermer</Button>
                </div>
            </div>
        );
    }

    return shell(
        <>
            <div className="ems-ama-modal-body">
                <div className="ama-grid">
                    <Form.Group className="mb-2">
                        <Form.Label>Paramédic qui signe *</Form.Label>
                        <Select
                            value={employee} onChange={setEmployee} options={employeeOptions} styles={selectStyles} menuPortalTarget={document.body}
                            isDisabled={saving} placeholder="Choisir un employé…" noOptionsMessage={() => 'Aucun employé'}
                        />
                        {!ownSelected && !isAdmin && employee && (
                            <Form.Text style={{ color: '#e3b341' }}>La signature d'un autre employé n'est pas accessible : il doit signer depuis son compte.</Form.Text>
                        )}
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>Patient *</Form.Label>
                        <CreatableSelect
                            value={patientOption} onChange={handlePatientChange} options={patientOptions} styles={selectStyles} menuPortalTarget={document.body}
                            isClearable isDisabled={saving} placeholder="Choisir un patient ou taper son ID (ex. 2752)…"
                            noOptionsMessage={() => 'Tapez un ID patient'} formatCreateLabel={(typed) => `Utiliser l'ID « ${normalizePatientId(typed)} »`}
                            isValidNewOption={(typed) => typed.trim().length >= 3}
                            getNewOptionData={(input) => ({ value: normalizePatientId(input), label: normalizePatientId(input), name: '', __isNew__: true })}
                        />
                        <Form.Text style={{ color: '#9aa7b4' }}>L'ID ne s'imprime pas : il sert à ranger l'AMA chez le patient et à retrouver sa signature.</Form.Text>
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>Nom du patient (imprimé) *</Form.Label>
                        <Form.Control size="sm" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Prénom Nom" disabled={saving} />
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>Date / heure</Form.Label>
                        <Form.Control size="sm" value={date} onChange={(e) => setDate(e.target.value)} placeholder="JJ/MM/AAAA HH:MM" disabled={saving} />
                    </Form.Group>
                    <Form.Check
                        className="mb-2" type="checkbox" id="ama-minor" checked={minor} disabled={saving}
                        onChange={(e) => setMinor(e.target.checked)}
                        label="Le patient est mineur (moins de 18 ans)"
                    />
                    {minor && (
                        <Alert variant="warning" className="py-2 small">
                            Un mineur ne refuse pas seul des soins : son représentant légal (parent ou tuteur) doit être présent, être informé des risques et signer à sa place.
                            <Form.Check
                                className="mt-1" type="checkbox" id="ama-emancipated" checked={emancipated} disabled={saving}
                                onChange={(e) => setEmancipated(e.target.checked)}
                                label="Mineur émancipé (il refuse lui-même)"
                            />
                        </Alert>
                    )}
                    {(!minor || !emancipated) && (
                        <Form.Group className="mb-2">
                            <Form.Label>Représentant légal {minor ? '*' : '(nom, si applicable)'}</Form.Label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Form.Control size="sm" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder={minor ? 'Prénom Nom' : 'Facultatif'} disabled={saving} />
                                {minor && (
                                    <Form.Select size="sm" value={guardianRelation} onChange={(e) => setGuardianRelation(e.target.value)} disabled={saving}>
                                        <option value="">Lien avec le patient…</option>
                                        {GUARDIAN_RELATIONS.map((relation) => <option key={relation} value={relation}>{relation}</option>)}
                                    </Form.Select>
                                )}
                            </div>
                        </Form.Group>
                    )}
                </div>

                {/* Signatures */}
                <div className="ama-signatures">
                    <div>
                        <strong>Signature du paramédic</strong>
                        {employeeSignature === undefined && <p className="text-muted mb-0"><Spinner size="sm" animation="border" className="me-2" />Chargement…</p>}
                        {employeeSignature?.url && <div className="ama-sigbox"><img src={employeeSignature.url} alt="Signature du paramédic" /></div>}
                        {needsOwnSignature && (
                            <Alert variant="warning" className="mt-2 mb-2">
                                <i className="fas fa-signature me-2"></i>Vous n'avez pas encore de signature : créez-la avant de signer, elle s'imprimera sous votre nom.
                            </Alert>
                        )}
                        {employeeSignature === null && !ownSelected && <p className="text-warning mb-0">Aucune signature accessible pour cette personne.</p>}
                    </div>
                    <div>
                        <strong>Signature du patient</strong>
                        {!patientID && <p className="text-muted mb-0">Choisissez d'abord le patient.</p>}
                        {patientID && patientSignature === undefined && <p className="text-muted mb-0"><Spinner size="sm" animation="border" className="me-2" />Recherche…</p>}
                        {patientSignature?.url && <div className="ama-sigbox"><img src={patientSignature.url} alt="Signature du patient" /></div>}
                        {patientID && patientSignature === null && (
                            <p className="text-info mb-0"><i className="fas fa-wand-magic-sparkles me-2"></i>Aucune signature pour cet ID : elle sera créée automatiquement à partir du nom du patient et enregistrée pour lui.</p>
                        )}
                    </div>
                </div>

                {needsOwnSignature && currentEmployee?.uid && (
                    <div className="ama-create-signature">
                        <SignatureCreator
                            uid={currentEmployee.uid}
                            defaultName={staffName || ''}
                            creation={null}
                            onCreationChange={(created) => setEmployeeSignature(created || null)}
                            uploadImageDetailed={uploadImageDetailed}
                            showNotification={showNotification}
                        />
                    </div>
                )}

                <Form.Check
                    className="mt-3 ama-consent" type="checkbox" id="ama-certify" checked={certified} disabled={saving}
                    onChange={(e) => setCertified(e.target.checked)}
                    label={<><strong>Je certifie que c'est bien le patient (ou son représentant légal) qui signe</strong> ce refus de soins, après lui avoir expliqué les risques et les options, et en sa présence.</>}
                />

                <h6 className="mt-3">Aperçu du document</h6>
                <ReportPreviewFrame bbCode={bbCode} title="Formulaire AMA" height={460} />
            </div>
            <DebugFillButton onFill={handleDebugFill} disabled={saving} className="ems-ama-save-button" />
            <Button className="ems-ama-save-button" onClick={handleSave} disabled={saving || !certified || !employeeSignature?.url || !patientID}>
                {saving ? 'Enregistrement…' : 'Signer et enregistrer l\'AMA'}
            </Button>
        </>
    );
};

export default EmsAmaModal;
