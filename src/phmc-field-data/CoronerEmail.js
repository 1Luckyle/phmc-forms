import React, { useEffect, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Form, Button } from 'react-bootstrap';
import { createFleecaPayment } from '../utils/fleecaPayment';
import { getPrice, usePrices } from '../utils/pricing';
import { formatMoney } from '../utils/patientBilling';
import { useSiteMode } from '../contexts/SiteConfigContext';
import {
    prepareCoronerReport, mergeNameList, sameReport, CORONER_REPORT_VERSIONS, CORONER_REPORT_LABELS,
} from '../utils/coronerAttachments';
import { ReportPreviewFrame } from '../components/ReportExpansion';
import CoronerSelect from './shared/CoronerSelect';
import NameFields from './shared/NameFields';
import TemporaryIdPicker from './shared/TemporaryIdPicker';
import { MAIL_LIMITS } from '../utils/internalMail';
import { DMEC_EMAIL_DEFAULT_SUBJECT } from '../phmc-bbcode-generators/generateEmail';

const DECEDENT_FIELDS = { full: 'decedentName', first: 'decedentFirstName', middle: 'decedentMiddleName', last: 'decedentLastName', title: 'decedentTitle' };

// Rapports joints = le rapport principal (deathReport) puis les supplémentaires (additionalReports) : une seule liste pour l'écran.
const attachedOf = (formData) => [formData.deathReport, ...(formData.additionalReports || [])].filter((report) => String(report || '').trim());

// Noms (IC et HRP) de tous les défunts des rapports joints : recalculés à chaque ajout ou retrait.
const decedentListsOf = (reports) => {
    const names = [];
    const oocs = [];
    reports.forEach((report) => {
        const prepared = prepareCoronerReport(report);
        if (prepared.ok) {
            prepared.decedents.forEach((decedent) => { names.push(decedent.name); oocs.push(decedent.ooc); });
        }
    });
    return { reportDecedentNames: mergeNameList('', names), reportDecedentOOC: mergeNameList('', oocs) };
};

const CoronerEmail = ({
    formData,
    handleChange,
    setFormData,
    handleSelectChange,
    coronerGroupedOptions,
    toggleSavedReports,
    showNotification
}) => {
    const notify = showNotification || (() => {});
    usePrices(); // se redessine si un admin change les tarifs
    // Version classique : frais réglés en jeu, sans lien Fleeca (generateEmail lit formData.paiementEnJeu).
    const { isClassic } = useSiteMode();
    useEffect(() => {
        setFormData((prev) => ((prev.paiementEnJeu === true) === isClassic ? prev : { ...prev, paiementEnJeu: isClassic }));
    }, [isClassic, setFormData]);

    // Get agencyDataStore from context
    const { agencyDataStore, isLoadingData } = useData();

    useEffect(() => {
        // Un nouvel e-mail repart sans défunt ni rapport : les noms viennent des rapports joints ou de ce qu'on saisit ici.
        setFormData(prev => ({
            ...prev,
            decedentName: '',
            decedentFirstName: '',
            decedentMiddleName: '',
            decedentLastName: '',
            decedentOOC: '',
            reportDecedentNames: '',
            reportDecedentOOC: '',
        }));
    }, [setFormData]);

    // Génère un vrai lien de paiement Fleeca (frais fixes de la demande, tarif « fraisDemandeAutopsie »
    // d'autopsie/certificat) à inclure dans l'email, à la place de l'ancien RIB
    // et des instructions de virement manuel (voir generateEmail.js).
    const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState(false);
    const [paymentLinkError, setPaymentLinkError] = useState('');
    const [openPreview, setOpenPreview] = useState(-1);

    const handleGeneratePaymentLink = async () => {
        setIsCreatingPaymentLink(true);
        setPaymentLinkError('');
        try {
            const { payment_link } = await createFleecaPayment({
                amount: getPrice('fraisDemandeAutopsie'),
                description: `Frais de demande d'autopsie/certificat - ${formData.decedentName || formData.reportDecedentNames || 'Défunt'}`,
            });
            setFormData(prev => ({ ...prev, autopsyPaymentLink: payment_link }));
        } catch (err) {
            console.error('Failed to create Fleeca payment link:', err);
            setPaymentLinkError(err.message || 'Impossible de générer le lien de paiement.');
        } finally {
            setIsCreatingPaymentLink(false);
        }
    };

    // Vérifie qu'un contenu est bien un rapport accepté (rapport de décès ou de catastrophe mortelle, d'après ses titres), pas déjà joint, puis
    // l'ajoute à la liste avec les noms du défunt (IC et Discord). Retourne true si le rapport a été joint.
    const acceptReport = (bbCode) => {
        const result = prepareCoronerReport(bbCode);
        if (!result.ok) {
            notify(result.reason, 'warning', 8000);
            return false;
        }
        if (attachedOf(formData).some((report) => sameReport(report, result.bbCode))) {
            notify("Ce rapport est déjà joint à l'e-mail.", 'warning');
            return false;
        }
        setFormData((prev) => {
            const reports = [...attachedOf(prev), result.bbCode];
            return {
                ...prev,
                deathReport: reports[0] || '',
                additionalReports: reports.slice(1),
                ...decedentListsOf(reports),
                ...(result.kind === 'massFatality' ? { paperworkType: 'Mass Fatality' } : {}),
            };
        });
        notify(`${result.kindLabel} joint à l'e-mail (noms du défunt ajoutés).`, 'check-circle', 6000);
        return true;
    };

    const removeAttached = (index) => setFormData((prev) => {
        const reports = attachedOf(prev).filter((_, i) => i !== index);
        return { ...prev, deathReport: reports[0] || '', additionalReports: reports.slice(1), ...decedentListsOf(reports) };
    });

    const attached = attachedOf(formData);

    // ID patient des autres défunts concernés (le premier est le champ « ID patient » ci-dessus).
    const extraIds = Array.isArray(formData.additionalPatientIDs) ? formData.additionalPatientIDs : [];
    const setExtraIds = (change) => setFormData((prev) => ({ ...prev, additionalPatientIDs: change(Array.isArray(prev.additionalPatientIDs) ? prev.additionalPatientIDs : []) }));
    const addExtraId = () => setExtraIds((list) => [...list, '']);
    const setExtraId = (index, value) => setExtraIds((list) => list.map((item, i) => (i === index ? value : item)));
    const removeExtraId = (index) => setExtraIds((list) => list.filter((_, i) => i !== index));

    return (
        <>
            <Form.Label className="form-section-title">Courrier</Form.Label>
            <Form.Group className="mb-3">
                <Form.Label>Objet</Form.Label>
                <Form.Control type="text" name="dmecEmailSubject" value={formData.dmecEmailSubject || ''} maxLength={MAIL_LIMITS.subject} onChange={handleChange} placeholder={DMEC_EMAIL_DEFAULT_SUBJECT} className="form-control" />
            </Form.Group>

            <Form.Label className="form-section-title">Destinataire</Form.Label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <Form.Label>Destinataire (grade, prénom et nom)</Form.Label>
                    <Form.Control
                        type="text"
                        name="requestingOfficer"
                        value={formData.requestingOfficer}
                        onChange={handleChange}
                        placeholder="ex: Officier John Doe"
                        className="form-control"
                    />
                </div>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <Form.Label>Agence du destinataire</Form.Label>
                    <Form.Select
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        className="form-control"
                        disabled={isLoadingData || !agencyDataStore || Object.keys(agencyDataStore).length === 0}
                    >
                        <option value="" disabled>
                            {isLoadingData ? 'Chargement des agences...' : 'Choisir l\'agence'}
                        </option>
                        {agencyDataStore && Object.entries(agencyDataStore).map(([key, agency]) => (
                            <option key={key} value={key}>
                                {agency.fullName || key}
                            </option>
                        ))}
                    </Form.Select>
                </div>
            </div>

            <Form.Label className="form-section-title">Expéditeur</Form.Label>
            <div style={{ marginBottom: '0.6rem' }}>
                <CoronerSelect options={coronerGroupedOptions} formData={formData} handleSelectChange={handleSelectChange} label="Identifiants de l'employé (expéditeur)" />
            </div>
            <span className="helper-text">Le courriel est signé par vous : votre signature, votre nom, votre fonction et le Département de Pathologie et de Médecine Légale figurent au bas du document, avec le pied de page du centre. Vos coordonnées personnelles n'y figurent pas.</span>

            <Form.Label className="form-section-title">Défunt concerné</Form.Label>
            <Form.Label>Nom du défunt (IC)</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <NameFields
                    formData={formData} setFormData={setFormData} handleChange={handleChange} fields={DECEDENT_FIELDS}
                    placeholders={{ first: 'Prénom du défunt (IC)', middle: 'Deuxième prénom (IC)', last: 'Nom de famille (IC)' }}
                />
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <Form.Label>Discord du joueur (HRP)</Form.Label>
                    <Form.Control type="text" name="decedentOOC" value={formData.decedentOOC} onChange={handleChange} placeholder="(( Discord du joueur (HRP) ))" className="form-control" />
                </div>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <Form.Label>ID patient du défunt</Form.Label>
                    <Form.Control type="text" name="patientID" value={formData.patientID || ''} onChange={handleChange} placeholder="PHMC-2752 (ou ID temporaire si le défunt n'en a pas)" className="form-control" />
                </div>
            </div>
            <TemporaryIdPicker formData={formData} setFormData={setFormData} />
            {extraIds.map((extraId, index) => (
                <div key={index} className="mt-2">
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text" value={extraId} onChange={(event) => setExtraId(index, event.target.value)}
                            placeholder={`ID Patient du défunt n°${index + 2} (réel, ou temporaire)`} className="form-control"
                            data-guide="ID patient d'un autre défunt concerné par ce courriel : il s'ajoute au titre du rapport, et le rapport est lié à son dossier."
                        />
                        <Button size="sm" variant="outline-danger" onClick={() => removeExtraId(index)} title="Retirer ce défunt"><i className="fas fa-times"></i></Button>
                    </div>
                    <TemporaryIdPicker value={extraId} onChange={(next) => setExtraId(index, next)} />
                </div>
            ))}
            <div className="mt-2">
                <Button size="sm" variant="outline-secondary" onClick={addExtraId}><i className="fas fa-user-plus me-1"></i>Ajouter l'ID d'un autre défunt</Button>
            </div>
            <span className="helper-text">Plusieurs défunts : chacun a son ID patient, le titre du rapport est la suite de ces ID et le rapport est lié au dossier de chacun. Les défunts des rapports joints ci-dessous s'ajoutent automatiquement (nom IC et Discord) : inutile de les saisir une seconde fois.</span>

            <Form.Label className="form-section-title">Frais de demande</Form.Label>
            {isClassic ? (
                <span className="helper-text d-block mb-3">
                    Frais de demande : {formatMoney(getPrice('fraisDemandeAutopsie'))}, à régler en jeu auprès du DMEC. Le courriel l'indique au demandeur.
                </span>
            ) : (
            <Form.Group className="mb-3">
                <Form.Label>Lien de paiement Fleeca (frais de demande, {formatMoney(getPrice('fraisDemandeAutopsie'))})</Form.Label>
                <div>
                    <Button
                        variant="success"
                        size="sm"
                        onClick={handleGeneratePaymentLink}
                        disabled={isCreatingPaymentLink}
                    >
                        {isCreatingPaymentLink
                            ? 'Génération...'
                            : (formData.autopsyPaymentLink ? 'Régénérer le lien' : 'Générer le lien de paiement')}
                    </Button>
                    {formData.autopsyPaymentLink && (
                        <div style={{ marginTop: '8px', fontSize: '0.85em', color: '#28a745' }}>
                            <i className="fas fa-check-circle" style={{ marginRight: '6px' }}></i>
                            Lien généré : <a href={formData.autopsyPaymentLink} target="_blank" rel="noopener noreferrer">{formData.autopsyPaymentLink}</a>
                        </div>
                    )}
                    {paymentLinkError && (
                        <div style={{ marginTop: '8px', color: '#dc3545', fontSize: '0.85em' }}>{paymentLinkError}</div>
                    )}
                </div>
                <span className="helper-text">
                    Génère un vrai lien de paiement Fleeca à inclure dans l'email, à la place de l'ancien RIB/virement manuel.
                </span>
            </Form.Group>
            )}

            <Form.Label className="form-section-title">Rapports joints</Form.Label>
            <Form.Group className="mb-3">
                <div className="reports-container">
                    {attached.length === 0 && (
                        <span className="helper-text">Aucun rapport joint. Rapports acceptés : {CORONER_REPORT_LABELS.join(' · ')}.</span>
                    )}
                    {attached.map((report, index) => {
                        const prepared = prepareCoronerReport(report);
                        const names = prepared.ok ? prepared.decedents.map((decedent) => decedent.name || decedent.ooc).filter(Boolean).join(', ') : '';
                        return (
                            <div key={index} className="mb-2 p-2" style={{ border: '1px solid #30363d', borderRadius: '8px' }}>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <i className="fas fa-file-medical text-info"></i>
                                    <strong>{prepared.ok ? prepared.kindLabel : 'Rapport joint'}</strong>
                                    {names && <span className="text-muted small">— {names}</span>}
                                    <span className="ms-auto d-flex gap-2">
                                        <Button size="sm" variant="outline-info" onClick={() => setOpenPreview(openPreview === index ? -1 : index)}>
                                            <i className={`fas ${openPreview === index ? 'fa-eye-slash' : 'fa-eye'} me-1`}></i>{openPreview === index ? 'Masquer' : 'Aperçu'}
                                        </Button>
                                        <Button size="sm" variant="outline-danger" onClick={() => removeAttached(index)}>
                                            <i className="fas fa-times me-1"></i>Retirer
                                        </Button>
                                    </span>
                                </div>
                                {openPreview === index && <div className="mt-2"><ReportPreviewFrame bbCode={report} title="Rapport joint" height={360} /></div>}
                            </div>
                        );
                    })}
                    <div className="email-buttons">
                        <Button
                            variant="info"
                            onClick={() => toggleSavedReports([1, 11], 'Coroner', (reportData) => {
                                // Exécuté quand un rapport est choisi dans « Rapports enregistrés » (un seul à la fois ; on peut en joindre autant qu'on veut).
                                // Retourner false = rapport refusé (rien n'est joint).
                                if (!reportData?.bbCode || !CORONER_REPORT_VERSIONS.includes(Number(reportData.bbCodeVersion))) {
                                    notify(`Ce rapport n'est pas accepté pour un Email DMEC. Rapports acceptés : ${CORONER_REPORT_LABELS.join(', ')}.`, 'warning', 8000);
                                    return false;
                                }
                                return acceptReport(reportData.bbCode);
                            })}
                            className="email-button"
                        >
                            <i className="fas fa-paperclip"></i> Joindre un rapport (décès, catastrophe mortelle)
                        </Button>
                    </div>
                </div>
            </Form.Group>
        </>
    );
};
export default CoronerEmail;
