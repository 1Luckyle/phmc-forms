// src/phmc-civilian-fields/shared/ApplicationFields.js
//
// Champs COMMUNS aux six formulaires de candidature (médecine, psychologie, administration, soins infirmiers, médecine légale, paramédical) : même mise en page que les
// autres formulaires du site (rubriques à titre, listes de choix, sélecteurs de date, adresse + ville, expériences en petites fiches). Chaque formulaire n'apporte que sa
// liste de postes et quelques variantes (config) ; la logique des champs, la validation (utils/formValidation.js) et l'aperçu (phmc-recruitment-generators/shared/
// applicationDocument.js) sont partagés. Les listes et fonctions utilitaires sont dans utils/applicationForm.js.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { isPositionClosed, matchesPosition } from '../../constants/recruitment';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import useMinorTitleGuard from '../../hooks/useMinorTitleGuard';
import NameFields from '../../phmc-field-data/shared/NameFields';
import PlaceWithCity from '../../phmc-field-data/shared/PlaceWithCity';
import ComboSelect from '../../phmc-field-data/shared/ComboSelect';
import { SimpleSelect } from '../../phmc-field-data/shared/PatientGeneralInfo';
import { darkSelectStyles } from '../../phmc-field-data/shared/selectStyles';
import { uploadImageToServer } from '../../utils/imageUploadApi';
import {
    APPLICATION_FIELDS, EDUCATION_LEVELS, CITIZENSHIP_OPTIONS, LOCATION_OPTIONS, MAJOR_PRESETS, LANGUAGE_PRESETS, NO_OTHER_LANGUAGE, MAX_JOBS, MAX_LICENSES,
    emptyJob, jobsOf, licensesOf, applicantDisplayName, applicantAge, timezoneOptions, timezoneLabel, browserTimezone, migrateApplicationData,
} from '../../utils/applicationForm';

const DRAFT_EXPIRY_MS = 5 * 24 * 60 * 60 * 1000; // brouillon conservé sur l'appareil 5 jours

const todayIso = () => new Date().toISOString().slice(0, 10);
const selectStyles = { ...darkSelectStyles, container: (base) => ({ ...base, width: '100%' }) };
const row = { display: 'flex', gap: '10px', flexWrap: 'wrap' };
const cell = (min = 200) => ({ flex: `1 1 ${min}px`, minWidth: 0 });
const card = { border: '1px solid #30363d', borderRadius: 8, padding: '12px 14px', marginBottom: 12, background: 'rgba(255,255,255,0.03)' };

const Section = ({ children }) => <Form.Label className="form-section-title">{children}</Form.Label>;
const Field = ({ label, children, hint }) => (
    <Form.Group className="mb-3">
        <Form.Label>{label}</Form.Label>
        {children}
        {hint && <span className="helper-text" data-no-tip="1">{hint}</span>}
    </Form.Group>
);

// Expériences professionnelles : une petite fiche par emploi, avec le bouton « + » pour en ajouter (comme les médicaments des formulaires de soins).
const JobsEditor = ({ formData, setFormData }) => {
    const jobs = jobsOf(formData);
    const today = todayIso();
    const update = (index, patch) => setFormData((prev) => ({ ...prev, applicantJobs: jobsOf(prev).map((job, i) => (i === index ? { ...job, ...patch } : job)) }));
    const add = () => setFormData((prev) => (jobsOf(prev).length >= MAX_JOBS ? prev : { ...prev, applicantNoExperience: false, applicantJobs: [...jobsOf(prev), emptyJob()] }));
    const remove = (index) => setFormData((prev) => ({ ...prev, applicantJobs: jobsOf(prev).filter((job, i) => i !== index) }));
    const text = (index, key, placeholder, extra = {}) => (
        <Form.Control type="text" value={jobs[index][key] || ''} onChange={(event) => update(index, { [key]: event.target.value })} placeholder={placeholder} className="form-control" {...extra} />
    );
    return (
        <div data-guide="Ajoutez un encadré par emploi occupé, du plus récent au plus ancien.">
            <Form.Check
                type="checkbox" id="applicantNoExperience" name="applicantNoExperience" className="mb-3"
                label=" Je n'ai aucune expérience professionnelle à présenter"
                checked={!!formData.applicantNoExperience && jobs.length === 0}
                disabled={jobs.length > 0}
                onChange={(event) => setFormData((prev) => ({ ...prev, applicantNoExperience: event.target.checked }))}
            />
            {jobs.map((job, index) => (
                <div key={index} style={card}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Emploi {index + 1}</strong>
                        <Button size="sm" variant="outline-danger" type="button" onClick={() => remove(index)} aria-label={`Retirer l'emploi ${index + 1}`}>
                            <i className="fas fa-trash"></i>
                        </Button>
                    </div>
                    <div style={row}>
                        <div style={cell(220)}>{text(index, 'company', "Nom de l'entreprise")}</div>
                        <div style={cell(220)}>{text(index, 'role', 'Rôle occupé')}</div>
                    </div>
                    <div style={{ ...row, marginTop: 10, alignItems: 'center' }}>
                        <div style={cell(170)}>
                            <Form.Label className="mb-1">Début</Form.Label>
                            <Form.Control type="date" value={job.start || ''} max={today} onChange={(event) => update(index, { start: event.target.value })} className="form-control" />
                        </div>
                        <div style={{ ...cell(200), paddingTop: 22 }}>
                            <Form.Check
                                type="checkbox" id={`job-left-${index}`} label=" J'ai quitté cet emploi" checked={!!job.left}
                                onChange={(event) => update(index, { left: event.target.checked, ...(event.target.checked ? {} : { end: '', leaveReason: '' }) })}
                            />
                        </div>
                        <div style={cell(170)}>
                            <Form.Label className="mb-1">Fin</Form.Label>
                            <Form.Control type="date" value={job.end || ''} min={job.start || undefined} max={today} disabled={!job.left} onChange={(event) => update(index, { end: event.target.value })} className="form-control" />
                        </div>
                    </div>
                    <Form.Control as="textarea" rows={3} className="form-control mt-3" value={job.duties || ''} onChange={(event) => update(index, { duties: event.target.value })} placeholder="Vos responsabilités dans cet emploi" />
                    {job.left && (
                        <Form.Control as="textarea" rows={2} className="form-control mt-3" value={job.leaveReason || ''} onChange={(event) => update(index, { leaveReason: event.target.value })} placeholder="Motif du départ (facultatif)" />
                    )}
                </div>
            ))}
            <Button type="button" variant="outline-primary" size="sm" onClick={add} disabled={jobs.length >= MAX_JOBS}>
                <i className="fas fa-plus me-1"></i>Ajouter un emploi
            </Button>
            {jobs.length >= MAX_JOBS && <span className="helper-text ms-2" data-no-tip="1">Maximum {MAX_JOBS} emplois : gardez les plus pertinents.</span>}
        </div>
    );
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('lecture du fichier impossible'));
    reader.readAsDataURL(file);
});

// Licences : captures d'écran (/licenses en jeu) envoyées sur nos serveurs d'images ; une vignette par capture, avec un bouton pour la retirer.
const LicensesEditor = ({ formData, setFormData }) => {
    const licenses = licensesOf(formData);
    const [uploading, setUploading] = useState(0);
    const [problem, setProblem] = useState('');
    const inputRef = useRef(null);

    const addFiles = async (files) => {
        const images = Array.from(files || []).filter((file) => /^image\//i.test(file.type));
        if (images.length !== (files || []).length) setProblem('Seules les images sont acceptées.'); else setProblem('');
        const room = MAX_LICENSES - licensesOf(formData).length;
        if (images.length > room) setProblem(`Maximum ${MAX_LICENSES} captures : seules les ${Math.max(room, 0)} premières sont envoyées.`);
        for (const file of images.slice(0, Math.max(room, 0))) {
            setUploading((n) => n + 1);
            try {
                const { url } = await uploadImageToServer(await fileToDataUrl(file));
                setFormData((prev) => ({ ...prev, applicantLicenses: [...licensesOf(prev), url].slice(0, MAX_LICENSES) }));
            } catch (error) {
                setProblem(`Image non envoyée : ${error.message || 'erreur inconnue'}`);
            } finally {
                setUploading((n) => n - 1);
            }
        }
    };
    const remove = (index) => setFormData((prev) => ({ ...prev, applicantLicenses: licensesOf(prev).filter((url, i) => i !== index) }));

    return (
        <div
            data-guide="Ajoutez une capture d'écran de chacune de vos licences (commande /licenses en jeu)."
            onDragOver={(event) => { if (Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault(); }}
            onDrop={(event) => { if (event.dataTransfer?.files?.length) { event.preventDefault(); addFiles(event.dataTransfer.files); } }}
        >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                {licenses.map((url, index) => (
                    <div key={url} style={{ position: 'relative', border: '1px solid #30363d', borderRadius: 8, padding: 4, background: 'rgba(255,255,255,0.03)' }}>
                        <img src={url} alt={`Licence ${index + 1}`} style={{ display: 'block', maxWidth: 180, maxHeight: 120, borderRadius: 6 }} />
                        <Button size="sm" variant="danger" type="button" style={{ position: 'absolute', top: 6, right: 6, padding: '0 6px' }} onClick={() => remove(index)} aria-label={`Retirer la licence ${index + 1}`}>
                            <i className="fas fa-times"></i>
                        </Button>
                    </div>
                ))}
            </div>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
            <Button type="button" variant="outline-primary" size="sm" onClick={() => inputRef.current && inputRef.current.click()} disabled={licenses.length >= MAX_LICENSES || uploading > 0}>
                {uploading > 0 ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="fas fa-image me-1"></i>}Ajouter une capture de licence
            </Button>
            <span className="helper-text ms-2" data-no-tip="1">Facultatif · glissez-déposez aussi des images ici · {licenses.length}/{MAX_LICENSES}</span>
            {problem && <div className="text-warning small mt-1">{problem}</div>}
        </div>
    );
};

/**
 * config : {
 *   storageKey      : clé du brouillon conservé sur l'appareil,
 *   positionLabel   : texte de la liste des postes (« Sélectionner un poste en médecine… »),
 *   ems             : true pour le paramédical (rubriques différentes selon le poste : paramédic / technicien, ou autres rôles),
 *   medicalExperience : true si le formulaire demande l'expérience médicale (RP ou réelle),
 * }
 */
const ApplicationFields = ({ formData, handleChange, setFormData, positionDetails = {}, config }) => {
    const { pbcEnabled } = useSiteConfig();
    const settings = config || {};
    const positions = positionDetails || {};

    // ── Brouillon conservé sur l'appareil (5 jours) ──
    const restored = useRef(false);
    useEffect(() => {
        if (restored.current) return;
        restored.current = true;
        try {
            const saved = JSON.parse(localStorage.getItem(settings.storageKey) || 'null');
            if (!saved || !saved.data || !saved.timestamp) return;
            if (Date.now() - saved.timestamp >= DRAFT_EXPIRY_MS) { localStorage.removeItem(settings.storageKey); return; }
            const data = migrateApplicationData(saved.data);
            const picked = {};
            APPLICATION_FIELDS.forEach((field) => { if (data[field] !== undefined && data[field] !== '') picked[field] = data[field]; });
            // Ce qui est déjà dans le formulaire (prérempli depuis le profil, ou candidature rechargée) n'est jamais écrasé.
            setFormData((prev) => {
                const merged = { ...prev };
                Object.entries(picked).forEach(([key, value]) => { if (merged[key] === undefined || merged[key] === '' || (Array.isArray(merged[key]) && merged[key].length === 0)) merged[key] = value; });
                return merged;
            });
        } catch (error) { try { localStorage.removeItem(settings.storageKey); } catch (ignored) { /* stockage indisponible */ } }
    }, [settings.storageKey, setFormData]);
    useEffect(() => {
        if (!restored.current) return;
        try {
            const data = {};
            APPLICATION_FIELDS.forEach((field) => { if (formData[field] !== undefined) data[field] = formData[field]; });
            localStorage.setItem(settings.storageKey, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (error) { /* stockage indisponible */ }
    }, [formData, settings.storageKey]);

    // ── Titre : « Mineur » imposé sous 18 ans, interdit au-delà (même règle que les dossiers médicaux) ; nom complet recomposé pour le titre du rapport ──
    const guard = useMinorTitleGuard(formData, setFormData, { titleField: 'applicantTitle', dobField: 'applicantDOB' });
    const composedName = applicantDisplayName(formData);
    useEffect(() => {
        if ((formData.applicantTitleAndFullName || '') !== composedName) setFormData((prev) => ((prev.applicantTitleAndFullName || '') === applicantDisplayName(prev) ? prev : { ...prev, applicantTitleAndFullName: applicantDisplayName(prev) }));
    }, [composedName, formData.applicantTitleAndFullName, setFormData]);

    const age = applicantAge(formData);
    const zones = useMemo(() => timezoneOptions(), []);
    const zoneValue = formData.oocTimezone ? { value: formData.oocTimezone, label: timezoneLabel(formData.oocTimezone) } : null;
    const myZone = browserTimezone();

    // ── Paramédical : les rubriques dépendent du poste ──
    const selectedRole = formData.recruitmentPosition || '';
    const isParamedic = settings.ems && matchesPosition(positions, selectedRole, { roles: ['Paramedic'], keys: ['Paramedic'] });
    const isEmt = settings.ems && matchesPosition(positions, selectedRole, { roles: ['Technicien(ne) Ambulancier(ère) (EMT)'], keys: ['EMT', 'Technicien(ne) Ambulancier(ère) (EMT)'] });
    const emsFull = !!(isParamedic || isEmt);
    const emsOther = !!(settings.ems && selectedRole && !emsFull);
    const showExperience = true;                                         // emplois : demandés dans toutes les candidatures, autres rôles EMS compris
    const showMedicalExperience = settings.medicalExperience && (!settings.ems || emsFull);
    const showHrpExtras = !!emsOther;
    const showHrp = !settings.ems || !!selectedRole;

    const languages = Array.isArray(formData.applicantLanguages) ? formData.applicantLanguages : [];
    const setLanguages = (options) => {
        let values = (options || []).map((option) => option.value);
        const added = values.find((value) => !languages.includes(value));
        // « Aucune autre langue » est exclusive : la choisir retire les autres, en choisir une autre la retire.
        if (added === NO_OTHER_LANGUAGE) values = [NO_OTHER_LANGUAGE];
        else if (added) values = values.filter((value) => value !== NO_OTHER_LANGUAGE);
        setFormData((prev) => ({ ...prev, applicantLanguages: values }));
    };

    return (
        <>
            <Section>Poste visé</Section>
            <Field label="Poste pour lequel vous postulez">
                <Form.Select name="recruitmentPosition" value={formData.recruitmentPosition || ''} onChange={handleChange} className="form-control">
                    <option value="">{settings.positionLabel || 'Sélectionner un poste…'}</option>
                    {Object.entries(positions).map(([key, position]) => (
                        <option key={key} value={key} disabled={isPositionClosed(position)}>
                            {position.nom}{isPositionClosed(position) ? ' (candidatures fermées)' : ''}
                        </option>
                    ))}
                </Form.Select>
            </Field>

            <Section>Identité</Section>
            <Field label="Titre et nom" hint="Le titre dépend de l'âge : « Mineur » est imposé sous 18 ans (selon la date de naissance ci-dessous).">
                <div style={row}>
                    <NameFields
                        formData={formData} setFormData={setFormData} handleChange={handleChange} guard={guard}
                        fields={{ title: 'applicantTitle', first: 'applicantFirstName', middle: 'applicantMiddleName', last: 'applicantLastName' }}
                        placeholders={{ first: 'Prénom', middle: 'Deuxième prénom (facultatif)', last: 'Nom de famille' }}
                    />
                </div>
            </Field>
            <Field label="Date de naissance">
                <div style={{ ...row, alignItems: 'center' }}>
                    <div style={{ flex: '0 1 220px' }}>
                        <Form.Control type="date" name="applicantDOB" value={formData.applicantDOB || ''} max={todayIso()} onChange={handleChange} className="form-control" />
                    </div>
                    {age !== null && <span className="helper-text" data-no-tip="1" style={{ margin: 0 }}>{age} an{age > 1 ? 's' : ''}</span>}
                </div>
            </Field>
            <Field label="Adresse du domicile">
                <div style={row}>
                    <PlaceWithCity formData={formData} setFormData={setFormData} handleChange={handleChange} addressName="applicantAddress" zipName="applicantZIP" />
                </div>
            </Field>
            <Field label="Coordonnées">
                <div style={row}>
                    <div style={cell(200)}><Form.Control type="text" name="applicantPhone" value={formData.applicantPhone || ''} onChange={handleChange} placeholder="Numéro de téléphone" className="form-control" /></div>
                    <div style={cell(260)}><Form.Control type="email" name="applicantEmail" value={formData.applicantEmail || ''} onChange={handleChange} placeholder="Adresse e-mail (ex. prenomnom@mail.eyefind.fr)" className="form-control" /></div>
                </div>
            </Field>
            <Field label="Citoyenneté">
                <SimpleSelect name="applicantCitizenship" value={formData.applicantCitizenship} onChange={handleChange} options={CITIZENSHIP_OPTIONS} placeholder="Choisir votre situation…" />
            </Field>
            {pbcEnabled && (
                <Field label="Lieu d'emploi souhaité">
                    <SimpleSelect name="applicantLocation" value={formData.applicantLocation || 'PHMC'} onChange={handleChange} options={LOCATION_OPTIONS} placeholder="Choisir un site…" />
                </Field>
            )}

            <Section>Formation</Section>
            <Field label="Niveau d'études le plus élevé">
                <SimpleSelect name="applicantEducationLevel" value={formData.applicantEducationLevel} onChange={handleChange} options={EDUCATION_LEVELS} placeholder="Choisir votre niveau d'études…" />
            </Field>
            <Field label="Établissement fréquenté">
                <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} placeholder="Nom de l'établissement" className="form-control" />
            </Field>
            <Field label="Période de scolarité">
                <div style={{ ...row, alignItems: 'center' }}>
                    <div style={cell(170)}>
                        <Form.Label className="mb-1">Début</Form.Label>
                        <Form.Control type="date" name="applicantEnrollmentStart" value={formData.applicantEnrollmentStart || ''} max={todayIso()} onChange={handleChange} className="form-control" />
                    </div>
                    <div style={cell(170)}>
                        <Form.Label className="mb-1">Fin</Form.Label>
                        <Form.Control type="date" name="applicantEnrollmentEnd" value={formData.applicantEnrollmentEnd || ''} min={formData.applicantEnrollmentStart || undefined} max={todayIso()} disabled={!!formData.applicantEnrollmentOngoing} onChange={handleChange} className="form-control" />
                    </div>
                    <div style={{ ...cell(180), paddingTop: 22 }}>
                        <Form.Check
                            type="checkbox" id="applicantEnrollmentOngoing" name="applicantEnrollmentOngoing" label=" Études en cours" checked={!!formData.applicantEnrollmentOngoing}
                            onChange={(event) => setFormData((prev) => ({ ...prev, applicantEnrollmentOngoing: event.target.checked, ...(event.target.checked ? { applicantEnrollmentEnd: '' } : {}) }))}
                        />
                    </div>
                </div>
            </Field>
            <Field label="Domaine d'études principal" hint="Choisissez dans la liste, ou écrivez le vôtre.">
                <ComboSelect name="applicantMajor" value={formData.applicantMajor || ''} onChange={(value) => setFormData((prev) => ({ ...prev, applicantMajor: value }))} options={MAJOR_PRESETS} placeholder="Choisir ou écrire un domaine…" />
            </Field>
            <Field label="Langues supplémentaires" hint="Plusieurs choix possibles ; écrivez une langue absente de la liste pour l'ajouter.">
                <CreatableSelect
                    isMulti name="applicantLanguages" styles={selectStyles} closeMenuOnSelect={false}
                    value={languages.map((language) => ({ label: language, value: language }))}
                    options={LANGUAGE_PRESETS.map((language) => ({ label: language, value: language }))}
                    onChange={setLanguages} placeholder="Choisir ou écrire des langues…"
                    formatCreateLabel={(input) => `Ajouter « ${input} »`} noOptionsMessage={() => 'Écrivez une langue pour l\'ajouter'}
                />
            </Field>

            {showExperience && (
                <>
                    <Section>Expérience professionnelle</Section>
                    <JobsEditor formData={formData} setFormData={setFormData} />
                </>
            )}
            <Section>Licences</Section>
            <Field label={emsOther ? "Captures d'écran de vos licences (dont votre licence de technicien médical d'urgence)" : "Captures d'écran de vos licences"}>
                <LicensesEditor formData={formData} setFormData={setFormData} />
            </Field>
            {emsOther && (
                <>
                    <Section>Programme à temps partiel</Section>
                    <Field label="Pourquoi souhaitez-vous une place dans le programme à temps partiel ?">
                        <Form.Control as="textarea" rows={4} name="emsPartTimeReason" value={formData.emsPartTimeReason || ''} onChange={handleChange} placeholder="Un court paragraphe" className="form-control" />
                    </Field>
                </>
            )}

            {showHrp && (
                <>
                    <Section>(( Informations hors personnage ))</Section>
                    <Field label="Nom Discord">
                        <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} className="form-control" />
                    </Field>
                    <Field label="Fuseau horaire" hint="Tapez votre ville ou votre région (ex. « Paris », « New York ») : le décalage actuel avec l'heure UTC est indiqué.">
                        <Select
                            name="oocTimezone" styles={selectStyles} isClearable value={zoneValue} options={zones}
                            onChange={(option) => setFormData((prev) => ({ ...prev, oocTimezone: option ? option.value : '' }))}
                            placeholder="Choisir votre fuseau horaire…" noOptionsMessage={() => 'Aucun fuseau ne correspond'}
                        />
                        {myZone && myZone !== formData.oocTimezone && (
                            <Button type="button" variant="link" size="sm" className="px-0" onClick={() => setFormData((prev) => ({ ...prev, oocTimezone: myZone }))}>
                                Utiliser le fuseau de mon navigateur ({timezoneLabel(myZone)})
                            </Button>
                        )}
                    </Field>
                    {showMedicalExperience && (
                        <Field label="Expérience médicale réelle ou RP médical passé">
                            <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} placeholder="Décrivez toute expérience pertinente" className="form-control" />
                        </Field>
                    )}
                    {showHrpExtras && (
                        <>
                            <Field label="Licence BLS/ALS valide sur un autre personnage ?" hint="Si oui, fournissez une preuve (commande /licenses) ; sinon écrivez « N/A ».">
                                <Form.Control type="text" name="oocOtherCharLicenseProof" value={formData.oocOtherCharLicenseProof || ''} onChange={handleChange} className="form-control" />
                            </Field>
                            <Field label="Preuves de votre DFP" hint="Liens de preuve (ou « N/A »).">
                                <div style={row}>
                                    <div style={cell(200)}><Form.Control type="text" name="dfpSanFireLink" value={formData.dfpSanFireLink || ''} onChange={handleChange} placeholder="DFP SAN FIRE" className="form-control" /></div>
                                    <div style={cell(200)}><Form.Control type="text" name="dfpPhmcLink" value={formData.dfpPhmcLink || ''} onChange={handleChange} placeholder="DFP PHMC" className="form-control" /></div>
                                    <div style={cell(200)}><Form.Control type="text" name="dfpLegalFactionLink" value={formData.dfpLegalFactionLink || ''} onChange={handleChange} placeholder="DFP Legal Faction Management" className="form-control" /></div>
                                </div>
                            </Field>
                        </>
                    )}
                </>
            )}
        </>
    );
};

export default ApplicationFields;
