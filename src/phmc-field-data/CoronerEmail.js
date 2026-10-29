import React, { useEffect, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Form, Button, Alert } from 'react-bootstrap';
import Select from 'react-select';
import { getFormDefinition } from '../formDefinitions'; // Import getFormDefinition
import { createFleecaPayment } from '../utils/fleecaPayment';
import { getPrice, usePrices } from '../utils/pricing';
import { formatMoney } from '../utils/patientBilling';
import {
    prepareCoronerReport, mergeNameList, sameReport, CORONER_REPORT_VERSIONS, CORONER_REPORT_LABELS,
} from '../utils/coronerAttachments';

const customSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '38px',
        backgroundColor: '#16202c',
        color: '#eeeeeeb0',
        borderColor: state.isFocused ? '#86b7fe' : '#30363d',
        boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
        '&:hover': {
            borderColor: '#86b7fe'
        }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#16202c',
        zIndex: 1000,
        border: '1px solid #30363d',
        borderRadius: '0.375rem'
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#30363d' : '#16202c',
        color: '#eeeeeeb0',
        padding: '0.5rem 1rem',
        '&:hover': {
            backgroundColor: '#30363d'
        }
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: '#30363d',
        color: '#eeeeeeb0'
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#9aa7b4',
        '&:hover': {
            backgroundColor: '#dc3545',
            color: '#fff'
        }
    }),
    input: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    placeholder: (base) => ({
        ...base,
        color: '#9aa7b4'
    }),
    singleValue: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    group: (base) => ({
        ...base,
        paddingTop: 8,
        paddingBottom: 8
    }),
    groupHeading: (base) => ({
        ...base,
        color: '#9aa7b4',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        marginBottom: 4
    })
};

const CoronerEmail = ({ // Renamed component to follow PascalCase convention
    formData,
    handleChange,
    setFormData, // <-- Make sure setFormData is passed as a prop
    handleSelectChange, // Added this prop
    coronerGroupedOptions,
    handleFillCoronerPhone,
    fillPhoneChecked,
    setFillPhoneChecked,
    addReport,
    removeReport,
    handleReportChange,
    toggleSavedReports,
    showNotification
}) => {
    const notify = showNotification || (() => {});
    usePrices(); // se redessine si un admin change les tarifs

    // Get agencyDataStore from context
    const { agencyDataStore, isLoadingData } = useData();

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            decedentName: '',
            decedentOOC: ''
        }));
    }, [setFormData]);

    // Génère un vrai lien de paiement Fleeca (frais fixes de la demande, tarif « fraisDemandeAutopsie »
    // d'autopsie/certificat) à inclure dans l'email, à la place de l'ancien RIB
    // et des instructions de virement manuel (voir generateEmail.js).
    const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState(false);
    const [paymentLinkError, setPaymentLinkError] = useState('');

    const handleGeneratePaymentLink = async () => {
        setIsCreatingPaymentLink(true);
        setPaymentLinkError('');
        try {
            const { payment_link } = await createFleecaPayment({
                amount: getPrice('fraisDemandeAutopsie'),
                description: `Frais de demande d'autopsie/certificat - ${formData.decedentName || 'Défunt'}`,
            });
            setFormData(prev => ({ ...prev, autopsyPaymentLink: payment_link }));
        } catch (err) {
            console.error('Failed to create Fleeca payment link:', err);
            setPaymentLinkError(err.message || 'Impossible de générer le lien de paiement.');
        } finally {
            setIsCreatingPaymentLink(false);
        }
    };


    // Vérifie qu'un contenu est bien un rapport accepté (rapport de décès ou de catastrophe mortelle, d'après ses titres), pas déjà
    // joint, puis l'ajoute avec le nom du défunt (IC et HRP). `slot` : 'auto' (premier emplacement libre), 'main' ou l'index d'un
    // rapport supplémentaire. Retourne true si le rapport a été joint.
    const acceptReport = (bbCode, slot = 'auto') => {
        const result = prepareCoronerReport(bbCode);
        if (!result.ok) {
            notify(result.reason, 'warning', 8000);
            return false;
        }
        const attached = [formData.deathReport, ...(formData.additionalReports || [])];
        if (attached.some((report) => sameReport(report, result.bbCode))) {
            notify("Ce rapport est déjà joint à l'e-mail.", 'warning');
            return false;
        }
        setFormData((prev) => {
            const next = {
                ...prev,
                decedentName: mergeNameList(prev.decedentName, result.decedents.map((decedent) => decedent.name)),
                decedentOOC: mergeNameList(prev.decedentOOC, result.decedents.map((decedent) => decedent.ooc)),
            };
            if (result.kind === 'massFatality') next.paperworkType = 'Mass Fatality';
            if (slot === 'main' || (slot === 'auto' && !String(prev.deathReport || '').trim())) {
                next.deathReport = result.bbCode;
            } else if (slot === 'auto') {
                next.additionalReports = [...(prev.additionalReports || []), result.bbCode];
            } else {
                const list = [...(prev.additionalReports || [])];
                list[slot] = result.bbCode;
                next.additionalReports = list;
            }
            return next;
        });
        notify(`${result.kindLabel} reconnu et joint à l'e-mail (noms du défunt ajoutés).`, 'check-circle', 6000);
        return true;
    };

    // Un rapport ne se tape pas à la main : on le colle (vérifié) ou on le vide.
    const handleMainReportPaste = (event) => {
        event.preventDefault();
        acceptReport(event.clipboardData.getData('text'), 'main');
    };
    const handleMainReportChange = (event) => {
        if (!event.target.value.trim()) setFormData((prev) => ({ ...prev, deathReport: '' }));
    };
    const handleExtraReportPaste = (index) => (event) => {
        event.preventDefault();
        acceptReport(event.clipboardData.getData('text'), index);
    };
    const handleExtraReportChange = (index) => (event) => {
        if (!event.target.value.trim()) handleReportChange(index, '');
    };

    return (
        <>
            <p>Veuillez faire attention lors de l'ajout de rapports, cela peut prendre un certain temps à traiter. De plus, l'ajout de rapports ajoutera automatiquement le nom du défunt et le nom HRP du défunt !!!</p>

                                <Form.Label>Identifiants de l'employé</Form.Label>
                            <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                onChange={(selectedOption, actionMeta) => handleSelectChange(selectedOption, actionMeta)}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Sélectionner un coroner. (Vous pouvez taper pour rechercher!)"
                                    className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                                styles={customSelectStyles}
                                />
                                <Form.Label></Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        type="text"
                                        name="requestingOfficer"
                                        value={formData.requestingOfficer}
                                        onChange={handleChange}
                                        placeholder="Matricule & Prénom & Nom de l'officier demandeur"
                                        required
                                        className={`form-control ${!formData.requestingOfficer ? 'is-invalid' : ''}`}
                                        />
                                <Form.Select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.department ? 'is-invalid' : ''}`}
                                    disabled={isLoadingData || !agencyDataStore || Object.keys(agencyDataStore).length === 0}
                                >
                                    <option value="" disabled>
                                        {isLoadingData ? 'Chargement des départements...' : 'Sélectionner un département'}
                                    </option>
                                    {agencyDataStore && Object.entries(agencyDataStore).map(([key, agency]) => (
                                        <option key={key} value={key}>
                                            {agency.fullName || key}
                                        </option>
                                    ))}
                                </Form.Select>
</div>
<Form.Group className="mb-3">
    <Form.Label>
        Numéro de contact du coroner:
    </Form.Label>
    {/* Keep the input field */}
    <Form.Control
        type="text"
        name="coronerPHNumber"
        value={formData.coronerPHNumber}
        onChange={handleChange}
        required
        placeholder="Numéro de téléphone du coroner"
        className={`form-control ${!formData.coronerPHNumber ? 'is-invalid' : ''}`}
    />
</Form.Group>
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

                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="decedentName"
                                            value={formData.decedentName}
                                            onChange={handleChange}
                                            placeholder="Prénom (Deuxième Prénom) & Nom du défunt (IC)"
                                            required
                                            className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="decedentOOC"
                                        value={formData.decedentOOC}
                                        onChange={handleChange}
                                        placeholder="(( Nom du défunt (HRP) ))"
                                        required
                                        className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}
                                        />
                                    </div>

                                <Form.Group className="mb-3">
                                    <Form.Label>Rapport joint (rapport de décès ou de catastrophe mortelle):</Form.Label>
                                    <Alert variant="info" className="py-2" style={{ fontSize: '0.85em' }}>
                                        <strong>Rapports acceptés :</strong> {CORONER_REPORT_LABELS.join(' · ')}. Le rapport est vérifié d'après ses titres puis joint
                                        <strong> en entier</strong> à l'e-mail, avec le nom du défunt (IC et HRP). Tout autre contenu est refusé et le texte ne se saisit pas à la main.
                                    </Alert>
                                    <Form.Control
                                        as="textarea"
                                        name="deathReport"
                                        value={formData.deathReport || ''}
                                        onChange={handleMainReportChange}
                                        onPaste={handleMainReportPaste}
                                        placeholder="Collez ici le BBCode d'un rapport accepté (ou utilisez « Joindre un rapport ») : il sera vérifié avant d'être joint."
                                        rows="2"
                                        className={`form-control ${!formData.deathReport ? 'is-invalid' : ''}`}
                                    />
                                    {formData.deathReport ? (
                                        <div className="small text-success mt-1">
                                            <i className="fas fa-check-circle"></i> Rapport vérifié et joint.{' '}
                                            <Button variant="link" size="sm" className="p-0 align-baseline"
                                                onClick={() => setFormData((prev) => ({ ...prev, deathReport: '' }))}>
                                                Retirer le rapport joint
                                            </Button>
                                        </div>
                                    ) : null}
                                </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Rapports supplémentaires:</Form.Label>
                <div className="reports-container">
                    {(formData.additionalReports || []).map((report, index) => (
                        <div key={index} className="report-input">
                            <Form.Control
                                as="textarea"
                                value={report}
                                onChange={handleExtraReportChange(index)}
                                onPaste={handleExtraReportPaste(index)}
                                placeholder="Collez ici le BBCode d'un rapport accepté supplémentaire (il sera vérifié)"
                                rows="4"
                                className={`form-control ${!report ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="danger"
                                onClick={() => removeReport(index)}
                                className="remove-report-button"
                            >
                                Retirer le rapport
                            </Button>
                        </div>
                    ))}
                    <div className="email-buttons">
                        <Button
                            variant="primary"
                            onClick={addReport}
                            className="add-report-button"
                        >
                            Ajouter un autre rapport
                        </Button>

                        <Button
                            variant="info"
                            onClick={() => toggleSavedReports([1, 11], 'Coroner', (reportData) => {
                                // Exécuté quand un rapport est choisi dans « Rapports enregistrés » (un seul à la fois).
                                // Retourner false = rapport refusé (rien n'est joint).
                                if (!reportData?.bbCode || !CORONER_REPORT_VERSIONS.includes(Number(reportData.bbCodeVersion))) {
                                    notify(`Ce rapport n'est pas accepté pour un Email DMEC. Rapports acceptés : ${CORONER_REPORT_LABELS.join(', ')}.`, 'warning', 8000);
                                    return false;
                                }
                                return acceptReport(reportData.bbCode, 'auto');
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