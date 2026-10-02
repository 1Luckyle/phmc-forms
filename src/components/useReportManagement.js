import { useState, useRef, useCallback } from 'react';
import { getFormDefinition } from '../formDefinitions'; // Assuming this path
import { database } from '../firebase'; // Assuming this path
import { ref, get, set, remove } from 'firebase/database';
import * as Sentry from "@sentry/react";
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { sendEyefindMail } from '../utils/eyefindMail';
import { sendPhmcRecruitmentWebhook } from './notificationService';

// Formulaires accessibles à un compte Civil : dossiers médicaux civils
// (3 Advanced, 24 Medical Release, 25 Basic, 26 Medical Update) et
// candidatures (50-55) — voir Lot 3 du plan Civil.
const CIVILIAN_ALLOWED_BBCODE_VERSIONS = [3, 24, 25, 26, 50, 51, 52, 53, 54, 55];

// Format standard des noms de rapports sauvegardés (demande utilisateur) :
// "[ID-Patient] Nom du formulaire - Date" partout où un ID patient existe sur
// le formulaire ; repli sur le nom du patient si l'ID n'est pas renseigné
// (champ resté optionnel sur certains formulaires remplis par le personnel).
function buildStandardReportKey(formName, patientID, patientName, dateValue) {
    const identifier = patientID || patientName || null;
    const datePart = dateValue || 'Date inconnue';
    return identifier ? `[${identifier}] ${formName} - ${datePart}` : `${formName} - ${datePart}`;
}

function sanitizeForFirebase(obj) {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirebase).filter(v => v !== undefined);
  }
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const sv = sanitizeForFirebase(v);
      if (sv !== undefined) out[k] = sv;
    }
    return out;
  }
  return obj;
}

const comprehensiveSanitize = (str) => {
    if (!str) return '';
    let sanitized = str.trim().replace(/[.#$[\/ \]]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

const parseCaseNumber = (url) => {
    if (!url) return '';
    const match = url.match(/\d+$/);
    return match ? match[0] : '';
};

const inferCoronerRank = (coronerDetails) => {
    if (!coronerDetails) return '';
    // Check if rank exists in the details object
    if (coronerDetails.rank) return coronerDetails.rank;
    // Check if category exists (alternative field name)
    if (coronerDetails.category) return coronerDetails.category;
    // Return empty string as fallback
    return '';
};

export const useReportManagement = (
    formData,
    setFormData,
    bbCodeVersion,
    setBbCodeVersion,
    getBBCodeContent,
    getCurrentReportAuthor,
    filterFormData,
    coronerListData,
    phmcListData,
    selectOptions,
    showNotification,
    removeNotification,
    setShowEasterEggModal,
    setEasterEggType,
    sendEasterEggNotification,
    modalCloseTimer,
    versionNames,
    ER_PROTOCOL_VERSION,
    CONSULTATION_NOTES_PHMC_VERSION,
    CONSULTATION_NOTES_PBC_VERSION,
    physicianRecruitmentDetails,
    adminRecruitmentDetails,
    emsRecruitmentDetails,
    nurseRecruitmentDetails,
    coronerRecruitmentDetails,
    selectedAgencyGroup
) => {
    const { isCivilian, civilianProfile } = useEmployeeAuth();
    const [savedReports, setSavedReports] = useState([]);
    const [showSavedReports, setShowSavedReports] = useState(false);
    const [isLoadingUserReports, setIsLoadingUserReports] = useState(false);
    const [selectedUserForSavedReports, setSelectedUserForSavedReports] = useState(null);
    const [preselectedEmployeeType, setPreselectedEmployeeType] = useState(null);
    const pendingReportAttachmentCallback = useRef(null);
    const [reportSelectionFilter, setReportSelectionFilter] = useState(null);
    const [showPositionInfoModal, setShowPositionInfoModal] = useState(false);
    const [currentPositionInfo, setCurrentPositionInfo] = useState(null);
    // Pipeline de candidatures (Lot 6) — vue Civil "Mes candidatures".
    const [myJobApplications, setMyJobApplications] = useState([]);
    const [isLoadingJobApplications, setIsLoadingJobApplications] = useState(false);
    const [showMyJobApplications, setShowMyJobApplications] = useState(false);

    const logWebhook = async (type, payload) => {
        const logRef = ref(database, 'webhook_logs/' + Date.now());
        try {
            await set(logRef, {
                type: type,
                payload: payload,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error("Error logging webhook:", error);
            Sentry.captureException(error, { extra: { context: 'logWebhook' } });
        }
    };

    // authorOverride : identité réelle sous laquelle sauvegarder (compte
    // employé connecté, ou employé choisi par un admin) — voir
    // handleSaveReportWrapper dans MainApp.js. Prend le pas sur
    // getCurrentReportAuthor(formData), qui ne reflète que le nom
    // sélectionné dans le champ coronerEmployee/phmcEmployee du formulaire
    // (ou le nom du patient pour les anciens formulaires "civils").
    async function saveReport(authorOverride) {
        // Un compte Civil ne peut sauvegarder que ses propres dossiers médicaux
        // civils ou candidatures — pas les formulaires réservés au personnel
        // (voir Lot 3 du plan Civil). Le personnel, lui, n'a toujours pas le
        // droit de sauvegarder une candidature (bloqué plus bas).
        if (isCivilian && !CIVILIAN_ALLOWED_BBCODE_VERSIONS.includes(bbCodeVersion)) {
            const message = 'Votre compte Civil ne peut sauvegarder que des dossiers médicaux civils ou des candidatures.';
            showNotification(message, 'exclamation-circle');
            return { success: false, error: message };
        }

        let key = '';
        const bbCodeContent = getBBCodeContent();
        const currentAuthor = authorOverride || getCurrentReportAuthor(formData);

        // --- Validation logic to determine the key ---
        if (bbCodeVersion === 1) { // Death Report
            if (!formData.decedentOOC || !formData.dateTime) {
                const message = `Please fill in Decedent OOC and Date/Time fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[DEATH-REPORT] ${formData.decedentOOC} - ${formData.dateTime}`;
        } else if (bbCodeVersion === 4) { // Autopsy Report
            if (!formData.decedentName || !formData.decedentOOC || !formData.autopsyDate) {
                const message = `Please fill in Decedent IC Name, OOC Name, and Autopsy Date fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Autopsy] ${formData.decedentName} (${formData.decedentOOC}) - ${formData.autopsyDate}`;
        } else if (bbCodeVersion === 3) { // Detailed Patient File (PatientAdvanced)
            if (!formData.patientName || !formData.patientDateOfBirth || !formData.patientEmail || !formData.patientID) {
                const message = `Veuillez remplir le nom, la date de naissance, l'email et l'ID patient.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = buildStandardReportKey(versionNames[3], formData.patientID, formData.patientName, formData.patientDateOfBirth);
        } else if (((bbCodeVersion > 3 && bbCodeVersion <= 7) && bbCodeVersion !== 4)) { // SurgicalOps (5), PhysEval PHMC/PBC (6,7)
            // L'ID patient est un champ à part désormais, mais reste optionnel sur
            // ces formulaires remplis par le personnel (le patient n'est pas
            // toujours identifié avec certitude) — seuls le nom et la date sont
            // requis.
            let patientNameMissing = !formData.patientName;
            let dateMissing = !formData.date;

            if (patientNameMissing || dateMissing) {
                let missingFieldLabels = [];
                if (patientNameMissing) missingFieldLabels.push('Nom du patient');
                if (dateMissing) missingFieldLabels.push('Date');
                if (missingFieldLabels.length > 0) {
                    const message = `Please fill in ${missingFieldLabels.join(', ')} fields.`;
                    showNotification(message, 'exclamation-circle');
                    return { success: false, error: message };
                }
            }

            key = buildStandardReportKey(versionNames[bbCodeVersion], formData.patientID, formData.patientName, formData.date || 'NO_DATE');
        } else if (bbCodeVersion === 19) { // EmergencyProtocol
            if (!formData.patientName || !formData.date) {
                const message = `Please fill in Patient Name, and Date fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = buildStandardReportKey(versionNames[19], formData.patientID, formData.patientName, formData.date);
        } else if (bbCodeVersion === 25) { // BasicPatientFile
            if (!formData.patientName || !formData.patientDateOfBirth || !formData.patientEmail || !formData.patientID) {
                const message = `Veuillez remplir le nom, la date de naissance, l'email et l'ID patient.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = buildStandardReportKey(versionNames[25], formData.patientID, formData.patientName, formData.patientDateOfBirth);
        } else if (bbCodeVersion === 24) { // Medical Record Release (MedicalRelease.js)
            // Le formulaire réel utilise patientFirstName/patientLastName, pas
            // registrantFullName/dateOfRequest (qui n'existent dans aucun champ
            // de ce formulaire) — l'ancienne validation ci-dessous échouait donc
            // systématiquement, empêchant toute sauvegarde de ce type de rapport.
            if ((!formData.patientFirstName && !formData.patientLastName) || !formData.patientEmail || !formData.patientID) {
                const message = `Veuillez remplir le prénom ou le nom du patient, l'email et l'ID patient.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            const releasePatientName = `${formData.patientFirstName || ''} ${formData.patientLastName || ''}`.trim();
            const releaseDate = formData.SubmitDate || new Date().toISOString().split('T')[0];
            key = buildStandardReportKey(versionNames[24], formData.patientID, releasePatientName, releaseDate);
        } else if (bbCodeVersion === 26) { // Medical File Update (MedicalUpdate.js)
            if (!formData.patientName || !formData.date || !formData.patientEmail || !formData.patientID) {
                const message = `Veuillez remplir le nom du patient, la date de naissance, l'email et l'ID patient.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = buildStandardReportKey(versionNames[26], formData.patientID, formData.patientName, formData.date);
        }
        // --- Add more 'else if' blocks here for other specific bbCodeVersions ---
        // Example for Coroner Email (bbCodeVersion 2)
        else if (bbCodeVersion === 2) {
            if (!formData.coronerEmployee || !formData.requestingOfficer || (!formData.decedentName && !formData.decedentOOC)) {
                const message = `Please fill in Coroner, Requesting Officer, and Decedent Name/OOC for Coroner Email.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Email] ${formData.requestingOfficer} re: ${formData.decedentName || formData.decedentOOC} - ${new Date().toISOString().split('T')[0]}`;
        }
        // Example for Agency Feedback (bbCodeVersion 18)
        else if (bbCodeVersion === 18) {
            if (!formData.department || !formData.dateTime || !formData.synopsis) {
                const message = `Please fill in Department, Date/Time, and Synopsis for Agency Feedback.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Feedback] ${formData.department} - ${formData.dateTime}`;
        }
        // --- MODIFICATION FOR PHMC RECRUITMENT ---
        // Le personnel n'a toujours pas besoin de sauvegarder une candidature —
        // seul un compte Civil le peut désormais (voir garde isCivilian en tête
        // de fonction). Si isCivilian est vrai ici, ce bbCodeVersion a déjà été
        // validé comme faisant partie de CIVILIAN_ALLOWED_BBCODE_VERSIONS.
        else if (getFormDefinition(bbCodeVersion)?.group === 'PHMC Recruitment' && !isCivilian) {
            return { success: false, error: 'PHMC Recruitment forms cannot be saved to Firebase.' };
        }
        // --- END MODIFICATION ---
        else if (bbCodeVersion === 11) { // Mass Fatality Report
            const { decedents, dateTime } = formData;
            if (!decedents || decedents.length === 0) {
                const message = `Please add at least one decedent to the report.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            const firstDecedent = decedents[0];
            if (!firstDecedent.decedentName || !dateTime) {
                const message = `The first decedent must have a name and the main date/time must be set.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            const decedentNames = decedents.map(d => d.decedentName).filter(name => name).join(', ');
            key = `[Mass Fatality Report] - ${decedentNames} - ${(dateTime && dateTime.split('T')[0]) || 'No Date'}`;
        }
        else if (bbCodeVersion === 37) { // Death Record
            if (!formData.deathReportPostId || !formData.decedentName || !formData.dateOfDeath) {
                const message = `Please fill in Case Number, Decedent Name, and Date of Death fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            const caseNumber = parseCaseNumber(formData.deathReportPostId);
            // Format date to MM-DD-YYYY
            const formattedDate = formData.dateOfDeath ? new Date(formData.dateOfDeath).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase().replace(/,/g, '') : 'NO_DATE';
            key = `[CASE #${caseNumber}] ${formData.decedentName} (( ${formData.decedentOOC || 'N/A'} )) | [${formattedDate}]`;
        }
        else if (bbCodeVersion === 22 || bbCodeVersion === 23) { // Commentary Note
            if (!formData.patientName || !formData.date) {
                const message = `Please fill in Patient Name and Date fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            const formattedDate = new Date(formData.date).toLocaleDateString('fr-FR');
            key = buildStandardReportKey(versionNames[bbCodeVersion], formData.patientID, formData.patientName, formattedDate);
        }
        else if (bbCodeVersion === 27) { // Email Forms
            if (!formData.patientNotes || !formData.decedentName) {
                const message = `Please fill in Email Subject and Recipient fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Email Forms] ${formData.patientNotes} - À: ${formData.decedentName} - ${currentDate}`;
            const currentDate = new Date().toLocaleDateString('fr-FR');
        }
        else { // Default handler for any other bbCodeVersion (includes SAAA)
            const definition = getFormDefinition(bbCodeVersion); // Get current form definition


            // Existing generic key generation for non-SAAA, non-PHMC Recruitment forms
            const formName = versionNames[bbCodeVersion] || `FormV${bbCodeVersion}`;

            // Repli quand il n'y a pas d'ID patient (candidatures, formulaires
            // DMEC sans notion de patient) : decedentName, puis patientName, puis
            // le nom du candidat, puis un générique.
            let identifier = formData.decedentName || formData.patientName || formData.applicantTitleAndFullName || 'Unnamed Report';
            if (Array.isArray(identifier)) identifier = identifier.join(', ');

            // MODIFIED: Ensure dateField always has a value
            const dateField = formData.date || formData.dateTime || formData.autopsyDate || 'No Date';

            key = buildStandardReportKey(formName, formData.patientID, identifier, dateField);
        }

        // If key is still empty, something went wrong (should be caught by validations)
        if (!key) {
            const message = 'Could not generate a report key. Save aborted.';
            showNotification(message, 'error');
            return { success: false, error: message };
        }

        if (!currentAuthor) {
            const message = 'Cannot determine report author. Please ensure an employee is selected or patient name is filled if applicable for this form type.';
            showNotification(message, 'error');
            return { success: false, error: message };
        }

        const sanitizedAuthorId = comprehensiveSanitize(currentAuthor);

        // Évite d'avoir plusieurs rapports affichés avec exactement le même nom
        // (ex: deux chirurgies pour le même patient le même jour) : on vérifie
        // les rapports déjà enregistrés pour cet auteur et on ajoute un
        // suffixe " (2)", " (3)"... si le nom généré existe déjà.
        try {
            const authorReportsSnapshot = await get(ref(database, `savedReports/${sanitizedAuthorId}`));
            if (authorReportsSnapshot.exists()) {
                const existingKeys = new Set(
                    Object.values(authorReportsSnapshot.val()).map((r) => r.originalKey)
                );
                if (existingKeys.has(key)) {
                    let suffix = 2;
                    while (existingKeys.has(`${key} (${suffix})`)) {
                        suffix++;
                    }
                    key = `${key} (${suffix})`;
                }
            }
        } catch (error) {
            console.warn('Could not check for duplicate report names, saving without suffix:', error);
        }

        const sanitizedKey = key.trim().replace(/[.#$[\/ \]]+/g, '_') + '_' + Date.now();

        // --- Easter Egg Logic ---
        const currentSavedCountForAuthor = savedReports.filter(r => r.authorName === currentAuthor).length;
        const easterEggAlreadyShown = localStorage.getItem('easterEggShown') === 'true';
        let showNormalEasterEgg = false;
        let showRareEasterEgg = false;

        if (currentSavedCountForAuthor === 4 && !easterEggAlreadyShown) {
            showNormalEasterEgg = true;
        } else if (currentSavedCountForAuthor > 4 && !easterEggAlreadyShown) {
            showNormalEasterEgg = Math.random() < 0.05;
        } else if (easterEggAlreadyShown) {
            showRareEasterEgg = Math.random() < 0.01;
        }

        if (showNormalEasterEgg) {
            setShowEasterEggModal(true);
            setEasterEggType('normal');
            localStorage.setItem('easterEggShown', 'true');
            sendEasterEggNotification('normal');
        } else if (showRareEasterEgg) {
            setShowEasterEggModal(true);
            setEasterEggType('rare');
            sendEasterEggNotification('rare');
        }
        // --- End Easter Egg Logic ---

        const reportDataToSave = {
        bbCodeVersion: bbCodeVersion,
        data: filterFormData(formData, bbCodeVersion),
        bbCode: bbCodeContent,
        timestamp: Date.now(),
        originalKey: key,
        authorName: currentAuthor
        };

        // Fallbacks anti-undefined sur les champs sensibles
        if (reportDataToSave.data && reportDataToSave.data.coronerRank === undefined) {
        reportDataToSave.data.coronerRank = null;
        }

        // Supprime toute autre clé undefined profondément
        const cleanPayload = sanitizeForFirebase(reportDataToSave);
        const reportPath = `savedReports/${sanitizedAuthorId}/${sanitizedKey}`;

        try {
            const reportRef = ref(database, reportPath);
            await set(reportRef, cleanPayload);
            showNotification(`Rapport "${key}" sauvegardé pour ${currentAuthor} (visible dans "Rapports Sauvegardés").`, 'save');

            // Regroupement par patient (Lot 5) : si le formulaire porte un ID
            // patient, on indexe ce rapport dans patientRecords/{patientID} pour
            // qu'il puisse être retrouvé/partagé/copié indépendamment de qui l'a
            // écrit. "owner" quand le civil sauvegarde son propre dossier,
            // "staff-only" quand c'est le personnel qui le remplit pour lui (pas
            // encore partagé) — voir le bouton "Partager avec le patient".
            // Best-effort : une erreur ici ne doit jamais faire échouer la
            // sauvegarde du rapport lui-même.
            if (formData.patientID) {
                try {
                    const isOwnedByThisCivilian = isCivilian && civilianProfile?.patientID === formData.patientID;
                    await set(ref(database, `patientRecords/${formData.patientID}/${sanitizedKey}`), {
                        reportPath,
                        visibility: isOwnedByThisCivilian ? 'owner' : 'staff-only',
                        bbCodeVersion,
                        originalKey: key,
                        authorName: currentAuthor,
                        timestamp: Date.now(),
                    });
                } catch (indexError) {
                    console.warn('Could not index report under patientRecords:', indexError);
                }
            }

            // Log the webhook
            await logWebhook(`report_saved by ${currentAuthor}`, {
                author: currentAuthor,
                reportKey: sanitizedKey,
                originalKey: key,
                bbCodeVersion: bbCodeVersion
            });

            return { success: true }; // Indicate success

        } catch (error) {
            console.error("Error saving report to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'Firebase set report' } });
            const message = 'Something unexpected went wrong, report copied to clipboard!';
            showNotification(message, 'error');
            return { success: false, error: message }; // Indicate failure
        }
    };

    const handleCopyAndNotify = async () => {
        const bbCodeContent = getBBCodeContent();
        if (!bbCodeContent) {
            showNotification('BBCode content is empty, cannot copy.', 'error');
            return;
        }

        const saveReportResult = await saveReport();
        if (saveReportResult.success) {
            navigator.clipboard.writeText(bbCodeContent).then(() => {
                showNotification('BBCode copied to clipboard and report saved!', 'success');
            }).catch(err => {
                showNotification('Report saved, but failed to copy BBCode to clipboard.', 'warning');
                console.error('Clipboard copy failed:', err);
            });
        } else {
            // Notification is shown by saveReport on failure
        }
    };

    const loadUserSavedReports = useCallback(async (userId) => {
        if (!userId) {
            setSavedReports([]);
            setSelectedUserForSavedReports(null);
            return;
        }

        setIsLoadingUserReports(true);
        setSelectedUserForSavedReports(userId);
        const loadingNotifId = showNotification(`Loading reports for ${userId}...`, 'info-circle', 0);

        const sanitizedUserId = comprehensiveSanitize(userId);
        const userReportsPath = `savedReports/${sanitizedUserId}`;
        const reportsRef = ref(database, userReportsPath);

        try {
            const snapshot = await get(reportsRef);
            removeNotification(loadingNotifId);

            if (snapshot.exists()) {
                const reportsData = snapshot.val();
                const validReports = [];
                for (const reportKey in reportsData) {
                    const report = reportsData[reportKey];
                    validReports.push({
                        key: reportKey,
                        originalKey: report.originalKey,
                        bbCodeVersion: report.bbCodeVersion,
                        timestamp: report.timestamp,
                        authorName: report.authorName,
                        bbCode: report.bbCode,
                        // Utilisé par les boutons "Partager avec le patient" /
                        // "Récupérer une copie" (Lot 5).
                        patientID: report.data?.patientID || null,
                        reportPath: `${userReportsPath}/${reportKey}`,
                    });
                }

                validReports.sort((a, b) => b.timestamp - a.timestamp);
                setSavedReports(validReports);

                if (validReports.length > 0) {
                    showNotification(`Loaded ${validReports.length} report(s) for ${userId}.`, 'check-circle');
                } else {
                    showNotification(`No active reports found for ${userId}.`, 'info-circle');
                }

            } else {
                setSavedReports([]);
                showNotification(`No reports found for ${userId}.`, 'info-circle');
            }
        } catch (error) {
            removeNotification(loadingNotifId);
            console.error(`Error loading reports for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'loadUserSavedReports', userId } });
            showNotification(`Failed to load reports for ${userId}.`, 'error');
            setSavedReports([]);
        } finally {
            setIsLoadingUserReports(false);
        }
    }, [showNotification, removeNotification, setSavedReports, setSelectedUserForSavedReports, setIsLoadingUserReports, database]);

    const loadReportForUser = useCallback(async (reportFirebaseKey, userId, returnOnly = false) => {
        if (!userId || !reportFirebaseKey) {
            if (!returnOnly) showNotification('Cannot load report: User ID or Report Key is missing.', 'error');
            return { success: false, message: 'User ID or Report Key is missing.' };
        }

        // Normalize coroner and phmc list data to arrays
        const coronersArray = Array.isArray(coronerListData)
        ? coronerListData
        : Object.values(coronerListData || {});

        const phmcArray = Array.isArray(phmcListData)
        ? phmcListData
        : Object.values(phmcListData || {});

        const sanitizedUserId = comprehensiveSanitize(userId);
        const reportPath = `savedReports/${sanitizedUserId}/${reportFirebaseKey}`;
        const reportRef = ref(database, reportPath);

        let loadingNotifId;
        if (!returnOnly) { // Only show notification if we are directly loading into the form
            loadingNotifId = showNotification(`Loading report: ${reportFirebaseKey} for ${userId}...`, 'info-circle', 0);
        }

            try {
                const snapshot = await get(reportRef);
                if (snapshot.exists()) {
                    const reportData = snapshot.val();
                    const loadedVersion = reportData.bbCodeVersion;
                    let loadedBbCode = reportData.bbCode || '';
                    let loadedFormData = reportData.data || {};

                    if (returnOnly) {
                        // When attaching, convert [bold] to [b]
                        const boldMatches = (loadedBbCode.match(/\[bold\]/gi) || []).length;
                        if (boldMatches > 0) {
                            console.log(`[useReportManagement] Found ${boldMatches} [bold] tags. Converting to [b].`);
                            loadedBbCode = loadedBbCode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
                            console.log(`[useReportManagement] Conversion complete.`);
                        }
                    } else {
                        // When loading into the form, ensure any escaped bold tags are converted to simple [b]
                        loadedBbCode = loadedBbCode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
                    }
                    const loadedCoronerEmployee = loadedFormData.coronerEmployee;
                    const loadedPhmcEmployee = loadedFormData.phmcEmployee;
                    const currentTimestamp = Date.now().toString();

                    if (loadedCoronerEmployee) {
                        const coronerDetails = coronersArray.find(c => c.name === loadedCoronerEmployee);
                        if (coronerDetails) {
                            loadedFormData.coronerEmployee = loadedCoronerEmployee;
                            loadedFormData.coronerBadge = coronerDetails.badge || '';
                            loadedFormData.coronerRank     = loadedFormData.coronerRank || inferCoronerRank(coronerDetails);
                            loadedFormData.coronerDiscord = coronerDetails.discord || '';
                            loadedFormData.coronerPHNumber = coronerDetails.phNumber || '50056';
                            if (!returnOnly) {
                                localStorage.setItem('coronerEmployee', loadedFormData.coronerEmployee);
                                localStorage.setItem('coronerEmployee_timestamp', currentTimestamp);
                                localStorage.setItem('coronerBadge', loadedFormData.coronerBadge);
                                localStorage.setItem('coronerBadge_timestamp', currentTimestamp);
                                localStorage.setItem('coronerRank', loadedFormData.coronerRank);
                                localStorage.setItem('coronerRank_timestamp', currentTimestamp);
                                localStorage.setItem('coronerDiscord', loadedFormData.coronerDiscord);
                                localStorage.setItem('coronerDiscord_timestamp', currentTimestamp);
                                localStorage.setItem('coronerPHNumber', loadedFormData.coronerPHNumber);
                                localStorage.setItem('coronerPHNumber_timestamp', currentTimestamp);
                            }
                        } else {
                            if (!returnOnly) showNotification(`Coroner "${loadedCoronerEmployee}" not found in current staff list. Using data from saved report.`, 'warning', 7000);
                            if (!returnOnly) {
                                if (loadedFormData.coronerEmployee) localStorage.setItem('coronerEmployee_timestamp', currentTimestamp);
                                if (loadedFormData.coronerBadge) localStorage.setItem('coronerBadge_timestamp', currentTimestamp);
                                if (loadedFormData.coronerRank) localStorage.setItem('coronerRank_timestamp', currentTimestamp);
                                if (loadedFormData.coronerDiscord) localStorage.setItem('coronerDiscord_timestamp', currentTimestamp);
                                if (loadedFormData.coronerPHNumber) localStorage.setItem('coronerPHNumber_timestamp', currentTimestamp);
                            }
                        }
                    } else if (!returnOnly) {
                        const coronerFieldsToClear = ['coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber'];
                        coronerFieldsToClear.forEach(field => {
                            localStorage.removeItem(field);
                            localStorage.removeItem(`${field}_timestamp`);
                        });
                    }

                    if (loadedPhmcEmployee) {
                        const phmcDetails = phmcArray.find(p => p.name === loadedPhmcEmployee);
                        if (phmcDetails) {
                            loadedFormData.phmcEmployee = loadedPhmcEmployee;
                            loadedFormData.phmcEmployeeLastName = phmcDetails.lastName || '';
                            loadedFormData.phmcRank = phmcDetails.category || phmcDetails.rank || '';
                            if (!returnOnly) {
                                localStorage.setItem('phmcEmployee', loadedFormData.phmcEmployee);
                                localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                                localStorage.setItem('phmcEmployeeLastName', loadedFormData.phmcEmployeeLastName);
                                localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                                localStorage.setItem('phmcRank', loadedFormData.phmcRank);
                                localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                            }
                        } else {
                            if (!returnOnly) showNotification(`PHMC Staff "${loadedPhmcEmployee}" not found in current staff list. Using data from saved report.`, 'warning', 7000);
                            if (!returnOnly) {
                                if (loadedFormData.phmcEmployee) localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                                if (loadedFormData.phmcEmployeeLastName) localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                                if (loadedFormData.phmcRank) localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                            }
                        }
                    } else if (!returnOnly) {
                        const phmcFieldsToClear = ['phmcEmployee', 'phmcEmployeeLastName', 'phmcRank'];
                        phmcFieldsToClear.forEach(field => {
                            localStorage.removeItem(field);
                            localStorage.removeItem(`${field}_timestamp`);
                        });
                    }

                    const localStorageManagedFields = [
                        'placeOfDeath', 'pronouncedTimeOfDeath', 'dateTime', 'department',
                        'mannerOfDeath',
                    ];
                    localStorageManagedFields.forEach(field => {
                        if (loadedFormData.hasOwnProperty(field) && loadedFormData[field]) {
                            if (!returnOnly) {
                                localStorage.setItem(field, loadedFormData[field]);
                                localStorage.setItem(`${field}_timestamp`, currentTimestamp);
                            }
                        }
                    });
                    // --- End Employee Sync Logic ---

                    if (!returnOnly) {
                        if (loadedVersion === 11) {
                            // Mass Fatality Report: set decedents array and other relevant fields
                            const decedents = Array.isArray(loadedFormData.decedents) ? loadedFormData.decedents.map(dec => ({
                                ...dec,
                                decedentName: dec.decedentName || dec.DecedentName,
                                decedentOOC: dec.decedentOOC || dec.DecedentOOC,
                            })) : [];

                            setFormData(prev => ({
                                ...prev,
                                ...loadedFormData,
                                decedents: decedents,
                                coronerEmployee: loadedFormData.coronerEmployee || prev.coronerEmployee,
                                phmcEmployee: loadedFormData.phmcEmployee || prev.phmcEmployee,
                            }));
                            setBbCodeVersion(loadedVersion);
                            showNotification(`Mass Fatality Report loaded.`, 'upload');
                        } else if (bbCodeVersion === 2 && loadedVersion === 1) {
                            // ...existing code for v2 loading v1...
                            const currentDeathReportIsEmpty = !formData.deathReport || formData.deathReport.trim() === '';
                            let notificationMessage = '';
                            setFormData(prevFormData => {
                                let updatedName = prevFormData.decedentName || '';
                                let updatedOoc = prevFormData.decedentOOC || '';
                                let updatedDeathReport = prevFormData.deathReport || '';
                                let updatedAdditionalReports = prevFormData.additionalReports || [];
                                if (prevFormData.decedentName && loadedFormData.decedentName) {
                                    updatedName = `${prevFormData.decedentName}, ${loadedFormData.decedentName}`;
                                } else {
                                    updatedName = loadedFormData.decedentName || prevFormData.decedentName || '';
                                }
                                if (prevFormData.decedentOOC && loadedFormData.decedentOOC) {
                                    updatedOoc = `${prevFormData.decedentOOC}, ${loadedFormData.decedentOOC}`;
                                } else {
                                    updatedOoc = loadedFormData.decedentOOC || prevFormData.decedentOOC || '';
                                }
                                if (currentDeathReportIsEmpty) {
                                    updatedDeathReport = loadedBbCode;
                                    notificationMessage = `Loaded report for ${loadedFormData.decedentName || reportData.originalKey} into main Death Report field.`;
                                } else {
                                    updatedAdditionalReports = [...updatedAdditionalReports, loadedBbCode];
                                    notificationMessage = `Added report for ${loadedFormData.decedentName || reportData.originalKey} as an additional report.`;
                                }
                                const finalDataToSet = {
                                    ...prevFormData,
                                    ...loadedFormData,
                                    decedentName: updatedName,
                                    decedentOOC: updatedOoc,
                                    deathReport: updatedDeathReport,
                                    additionalReports: updatedAdditionalReports,
                                };
                                return finalDataToSet;
                            });
                            showNotification(notificationMessage, 'plus-circle');
                        } else {
                            setFormData(prev => ({
                                ...prev,
                                ...loadedFormData,
                                coronerEmployee: loadedFormData.coronerEmployee || prev.coronerEmployee,
                                phmcEmployee: loadedFormData.phmcEmployee || prev.phmcEmployee,
                            }));
                            setBbCodeVersion(loadedVersion);
                            showNotification(`Report "${reportData.originalKey || reportFirebaseKey}" loaded.`, 'upload');
                        }
                        setShowSavedReports(false);
                    }
                    // Always return the processed data, regardless of `returnOnly`
                    return { success: true, reportData: { ...reportData, data: loadedFormData, bbCode: loadedBbCode } };
                } else {
                    if (!returnOnly) showNotification(`Report not found in Firebase: ${reportFirebaseKey}`, 'error');
                    return { success: false, message: `Report not found in Firebase: ${reportFirebaseKey}` };
                }
            } catch (error) {
                console.error(`[loadReportForUser] Error loading report ${reportFirebaseKey} for user ${userId}:`, error);
                Sentry.captureException(error, { extra: { context: 'loadReportForUser', userId, reportFirebaseKey } });
                if (!returnOnly) showNotification(`Failed to load report: ${error.message}`, 'error');
                return { success: false, message: `Failed to load report: ${error.message}` };
            } finally {
                if (!returnOnly && loadingNotifId) {
                    removeNotification(loadingNotifId);
                }
            }
        }, [bbCodeVersion, coronerListData, phmcListData, removeNotification, setBbCodeVersion, setFormData, showNotification]);

    const handleReportSelectedForAttachment = useCallback(async (reportFirebaseKey, userId) => {
        // When multiple reports are being loaded, we need to delay closing the modal.
        // This clears any pending close command from a previous, rapidly-fired event.
        if (modalCloseTimer.current) {
            clearTimeout(modalCloseTimer.current);
        }

        // Show a loading notification for this specific attachment
        const loadingNotifId = showNotification(`Attaching report...`, 'info-circle', 0);

        const result = await loadReportForUser(reportFirebaseKey, userId, true);

        // Remove the loading notification once done
        removeNotification(loadingNotifId);

        if (result.success && pendingReportAttachmentCallback.current) {
            const reportData = result.reportData;
            const loadedFormData = reportData.data || {};
            const loadedVersion = reportData.bbCodeVersion;

            // --- MODIFICATION START: Generalized Field Population ---
            setFormData(prev => {
                if (bbCodeVersion === 2 && loadedVersion === 11) { // Attaching Mass Fatality to Coroner Email
                    const decedents = loadedFormData.decedents;
                    if (decedents && decedents.length > 0) {
                        const firstDecedent = decedents[0];
                        let icName = firstDecedent.decedentName || firstDecedent.DecedentName || '';
                        let oocName = firstDecedent.decedentOOC || firstDecedent.DecedentOOC || '';

                        if (decedents.length > 1) {
                            icName += ` (x${decedents.length})`;
                            oocName += ` (x${decedents.length})`;
                        }
                        
                        const currentDeathReportIsEmpty = !prev.deathReport || prev.deathReport.trim() === '';
                        let newState = { ...prev };
                        newState.decedentName = icName;
                        newState.decedentOOC = oocName;
                        newState.paperworkType = 'Mass Fatality';

                        if (currentDeathReportIsEmpty) {
                            newState.deathReport = reportData.bbCode;
                        } else {
                            newState.additionalReports = [...(prev.additionalReports || []), reportData.bbCode];
                        }
                        return newState;
                    }
                    return prev;
                }
                // Mass Fatality Report (bbCodeVersion 11): attach BBCode to deathReport and merge decedents
                if (loadedVersion === 11) {
                    const currentDeathReportIsEmpty = !prev.deathReport || prev.deathReport.trim() === '';
                    let newState = { ...prev };
                    if (currentDeathReportIsEmpty) {
                        newState.deathReport = reportData.bbCode;
                    } else {
                        newState.additionalReports = [...(prev.additionalReports || []), reportData.bbCode];
                    }
                    // Merge decedents array if present
                    if (Array.isArray(loadedFormData.decedents)) {
                        newState.decedents = [...(prev.decedents || []), ...loadedFormData.decedents];
                    }
                    return newState;
                }
                // ...existing code...
                const fieldsToUpdate = {
                    decedentName: loadedFormData.decedentName,
                    decedentOOC: loadedFormData.decedentOOC,
                    requestingOfficer: loadedFormData.requestingOfficer,
                    department: loadedFormData.department,
                };
                if (bbCodeVersion === 2) {
                    // If there's already a name, append the new one.
                    let newState = { ...prev };
                    newState.decedentName = prev.decedentName && fieldsToUpdate.decedentName ? `${prev.decedentName}, ${fieldsToUpdate.decedentName}` : fieldsToUpdate.decedentName || prev.decedentName || '';
                    newState.decedentOOC = prev.decedentOOC && fieldsToUpdate.decedentOOC ? `${prev.decedentOOC}, ${fieldsToUpdate.decedentOOC}` : fieldsToUpdate.decedentOOC || prev.decedentOOC || '';
                    newState.requestingOfficer = fieldsToUpdate.requestingOfficer || prev.requestingOfficer;
                    newState.department = fieldsToUpdate.department || prev.department;
                    if (loadedVersion === 1 && bbCodeVersion === 2) {
                        const currentDeathReportIsEmpty = !prev.deathReport || prev.deathReport.trim() === '';
                        if (currentDeathReportIsEmpty) {
                            newState.deathReport = reportData.bbCode;
                        } else {
                            newState.additionalReports = [...(prev.additionalReports || []), reportData.bbCode];
                        }
                    }
                    return newState;
                } else {
                    let newState = { ...prev };
                    newState.decedentName = fieldsToUpdate.decedentName || prev.decedentName;
                    newState.decedentOOC = fieldsToUpdate.decedentOOC || prev.decedentOOC;
                    newState.requestingOfficer = fieldsToUpdate.requestingOfficer || prev.requestingOfficer;
                    newState.department = fieldsToUpdate.department || prev.department;
                    return newState;
                }
            });
            // --- MODIFICATION END ---

            // The pending callback now primarily handles form-specific fields like 'attachedReportSummary'
            pendingReportAttachmentCallback.current(reportData);

            showNotification(`Report "${reportData.originalKey}" attached successfully.`, 'check-circle');

        } else {
            if (!result.success) {
                showNotification('Échec du chargement du rapport sélectionné.', 'error');
            } else if (!pendingReportAttachmentCallback.current) {
                showNotification('Le processus de pièce jointe n’a pas pu être terminé (no callback).', 'error');
                Sentry.captureMessage('handleReportSelectedForAttachment was called but pendingReportAttachmentCallback.current was null.');
            }
        }

        // Set a timer to close the modal. If another report is loaded quickly,
        // the timer will be reset, ensuring the modal only closes after the last report is processed.
        modalCloseTimer.current = setTimeout(() => {
            setReportSelectionFilter(null);
            setPreselectedEmployeeType(null);
            setShowSavedReports(false);
        }, 1000); // 1-second delay

    }, [bbCodeVersion, loadReportForUser, modalCloseTimer, removeNotification, setFormData, showNotification]);

    const onAttachReportSummaryRequest = useCallback((callback) => {
        // Même logique que toggleSavedReports : plus de gate sur le formulaire,
        // SavedReportsModal gère l'accès selon la connexion (voir plus haut).
        pendingReportAttachmentCallback.current = callback;
        setReportSelectionFilter([ER_PROTOCOL_VERSION, CONSULTATION_NOTES_PHMC_VERSION, CONSULTATION_NOTES_PBC_VERSION]);
        setPreselectedEmployeeType('PHMC'); // Set to PHMC for this specific use case
        setShowSavedReports(true);
    }, [ER_PROTOCOL_VERSION, CONSULTATION_NOTES_PBC_VERSION, CONSULTATION_NOTES_PHMC_VERSION, setReportSelectionFilter, setPreselectedEmployeeType, setShowSavedReports]);

    const deleteReportForUser = useCallback(async (reportFirebaseKey, userId) => {
        if (!userId || !reportFirebaseKey) {
            showNotification('Impossible de supprimer le rapport : l’identifiant utilisateur ou la clé du rapport est manquant.', 'error');
            return;
        }

        const sanitizedUserId = comprehensiveSanitize(userId);
        // reportFirebaseKey is already sanitized
        const reportPath = `savedReports/${sanitizedUserId}/${reportFirebaseKey}`;
        const reportRef = ref(database, reportPath);

        // Optional: Ask for confirmation before deleting
        // if (!window.confirm(`Are you sure you want to delete this report?`)) {
        //     return;
        // }

        try {
            await remove(reportRef);
            showNotification(`Rapport supprimé avec succès de Firebase.`, 'trash');
            // Refresh the list of saved reports for the current user
            if (selectedUserForSavedReports === userId) {
                loadUserSavedReports(userId);
            }
        } catch (error) {
            console.error(`Error deleting report ${reportFirebaseKey} for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'deleteReportForUser', userId, reportFirebaseKey } });
            showNotification(`Impossible de supprimer le rapport: ${error.message}`, 'error');
        }
    }, [loadUserSavedReports, selectedUserForSavedReports, showNotification]);

    // --- Regroupement des dossiers par patient (Lot 5) ---

    // Complète savedReports (déjà chargé pour l'auteur courant) avec les
    // rapports d'un patient explicitement PARTAGÉS par le personnel — ces
    // rapports vivent sous le savedReports d'un AUTRE auteur, donc invisibles
    // via le chargement author-scoped habituel. Utilisé par la vue Civil
    // ("Dossiers/Candidatures sauvegardées") : ses propres rapports viennent
    // déjà de loadUserSavedReports, ceci n'ajoute que ce qui lui a été partagé.
    const loadSharedReportsForPatient = useCallback(async (patientID) => {
        if (!patientID) return;
        try {
            const indexSnap = await get(ref(database, `patientRecords/${patientID}`));
            if (!indexSnap.exists()) return;
            const entries = Object.values(indexSnap.val() || {});
            const sharedEntries = entries.filter((e) => e && e.visibility === 'shared' && e.reportPath);

            const fetched = await Promise.all(sharedEntries.map(async (entry) => {
                try {
                    const reportSnap = await get(ref(database, entry.reportPath));
                    if (!reportSnap.exists()) return null;
                    const report = reportSnap.val();
                    const reportKey = entry.reportPath.split('/').pop();
                    return {
                        key: reportKey,
                        originalKey: report.originalKey,
                        bbCodeVersion: report.bbCodeVersion,
                        timestamp: report.timestamp,
                        authorName: report.authorName,
                        bbCode: report.bbCode,
                        patientID: report.data?.patientID || patientID,
                        reportPath: entry.reportPath,
                        sharedByStaff: true,
                    };
                } catch (fetchError) {
                    console.warn('Could not fetch shared report:', entry.reportPath, fetchError);
                    return null;
                }
            }));

            const validShared = fetched.filter(Boolean);
            if (validShared.length > 0) {
                setSavedReports((prev) => {
                    const existingKeys = new Set(prev.map((r) => r.key));
                    return [...prev, ...validShared.filter((r) => !existingKeys.has(r.key))];
                });
            }
        } catch (error) {
            console.error('Error loading shared patient reports:', error);
            Sentry.captureException(error, { extra: { context: 'loadSharedReportsForPatient', patientID } });
        }
    }, []);

    // Action personnel : rend un rapport visible au patient concerné dans sa
    // propre vue "Dossiers/Candidatures sauvegardées" (patientRecords passe de
    // staff-only à shared — le rapport lui-même n'est ni déplacé ni dupliqué).
    const shareReportWithPatient = useCallback(async (patientID, reportKey) => {
        if (!patientID || !reportKey) return;
        try {
            await set(ref(database, `patientRecords/${patientID}/${reportKey}/visibility`), 'shared');
            showNotification('Rapport partagé avec le patient.', 'check-circle');
        } catch (error) {
            console.error('Error sharing report with patient:', error);
            Sentry.captureException(error, { extra: { context: 'shareReportWithPatient', patientID, reportKey } });
            showNotification('Erreur lors du partage du rapport.', 'error');
        }
    }, [showNotification]);

    // Action personnel : duplique un rapport (créé par un civil, ou partagé
    // par un collègue) dans son PROPRE savedReports, pour le consulter plus
    // tard indépendamment de l'auteur d'origine. Le rapport d'origine n'est ni
    // modifié ni supprimé.
    const copyReportToOwnAccount = useCallback(async (reportPath, copyAuthorName) => {
        if (!reportPath || !copyAuthorName) {
            showNotification('Impossible de déterminer votre identité pour la copie.', 'error');
            return;
        }
        try {
            const snap = await get(ref(database, reportPath));
            if (!snap.exists()) {
                showNotification('Rapport introuvable.', 'error');
                return;
            }
            const original = snap.val();
            const sanitizedCopyAuthorId = comprehensiveSanitize(copyAuthorName);
            const copyOriginalKey = `[Copie] ${original.originalKey || ''}`.trim();
            const copyKey = comprehensiveSanitize(copyOriginalKey) + '_' + Date.now();
            const copyPath = `savedReports/${sanitizedCopyAuthorId}/${copyKey}`;
            const copyPayload = sanitizeForFirebase({
                ...original,
                authorName: copyAuthorName,
                timestamp: Date.now(),
                originalKey: copyOriginalKey,
            });
            await set(ref(database, copyPath), copyPayload);

            if (original.data?.patientID) {
                await set(ref(database, `patientRecords/${original.data.patientID}/${copyKey}`), {
                    reportPath: copyPath,
                    visibility: 'staff-only',
                    bbCodeVersion: original.bbCodeVersion,
                    originalKey: copyOriginalKey,
                    authorName: copyAuthorName,
                    timestamp: Date.now(),
                });
            }

            showNotification('Copie enregistrée dans vos propres rapports.', 'save');

            // La liste affichée est déjà chargée : sans rechargement, la copie
            // n'apparaît pas avant la prochaine ouverture de la modale.
            if (selectedUserForSavedReports === copyAuthorName) {
                loadUserSavedReports(copyAuthorName);
            }
        } catch (error) {
            console.error('Error copying report:', error);
            Sentry.captureException(error, { extra: { context: 'copyReportToOwnAccount', reportPath } });
            showNotification('Erreur lors de la copie du rapport.', 'error');
        }
    }, [showNotification, selectedUserForSavedReports, loadUserSavedReports]);

    // --- Pipeline de candidatures (Lot 6) ---

    // Une candidature par (civil, poste) : applicationId dérivé du bbCodeVersion
    // pour que "Enregistrer" mette à jour la même entrée au lieu d'en créer une
    // nouvelle à chaque clic. submitAction : 'save' (brouillon) | 'submit'
    // (candidater — envoie accusé de réception + notification Discord admin).
    const saveJobApplication = useCallback(async (submitAction) => {
        if (!isCivilian || !civilianProfile?.uid) {
            showNotification('Vous devez être connecté en tant que Civil pour gérer une candidature.', 'error');
            return { success: false };
        }
        const definition = getFormDefinition(bbCodeVersion);
        if (!definition || definition.group !== 'PHMC Recruitment') {
            showNotification('Ce formulaire n\'est pas une candidature.', 'error');
            return { success: false };
        }

        const applicationId = `form_${bbCodeVersion}`;
        const applicationPath = `jobApplications/${civilianProfile.uid}/${applicationId}`;
        const bbCodeContent = getBBCodeContent();
        const applicantName = formData.applicantTitleAndFullName
            || `${civilianProfile.firstName || ''} ${civilianProfile.lastName || ''}`.trim();
        const newStatus = submitAction === 'submit' ? 'submitted' : 'saved';

        try {
            const existingSnap = await get(ref(database, applicationPath));
            const existing = existingSnap.exists() ? existingSnap.val() : null;

            // Une décision admin (acceptée/refusée) est définitive : on ne laisse
            // pas un nouvel envoi depuis le formulaire l'écraser silencieusement.
            if (existing && ['accepted', 'refused'].includes(existing.status)) {
                showNotification('Cette candidature a déjà été traitée par l\'administration et ne peut plus être modifiée.', 'warning');
                return { success: false };
            }

            const history = existing?.history ? [...existing.history] : [];
            history.push({ status: newStatus, timestamp: Date.now() });

            const payload = sanitizeForFirebase({
                applicantUid: civilianProfile.uid,
                patientID: civilianProfile.patientID,
                applicantName,
                position: formData.recruitmentPosition || definition.name,
                bbCodeVersion,
                data: filterFormData(formData, bbCodeVersion),
                bbCode: bbCodeContent,
                status: newStatus,
                interviewDateTime: existing?.interviewDateTime || null,
                createdAt: existing?.createdAt || Date.now(),
                updatedAt: Date.now(),
                history,
            });

            await set(ref(database, applicationPath), payload);

            if (submitAction === 'submit') {
                // Best-effort : un mail/webhook raté ne doit jamais faire échouer
                // la candidature elle-même (déjà persistée à ce stade).
                if (civilianProfile.email) {
                    sendEyefindMail({
                        to: civilianProfile.email,
                        subject: 'Candidature reçue - PHMC',
                        body: `Bonjour ${applicantName},\n\nNous avons bien reçu votre candidature pour le poste "${definition.name}". Notre équipe l'examinera prochainement et vous recontactera pour la suite du processus.\n\nCordialement,\nLe Pillbox Hill Medical Center`,
                        html: `<p>Bonjour ${applicantName},</p><p>Nous avons bien reçu votre candidature pour le poste « <b>${definition.name}</b> ». Notre équipe l'examinera prochainement et vous recontactera pour la suite du processus.</p><p>Cordialement,<br>Le Pillbox Hill Medical Center</p>`,
                    }).catch((err) => console.warn('Eyefind Mail (accusé de réception candidature) échoué:', err));
                }

                const discordWebhookUrl = process.env.REACT_APP_PHMC_RECRUITMENT_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DEV_WEBHOOK;
                if (discordWebhookUrl) {
                    sendPhmcRecruitmentWebhook({
                        webhookUrl: discordWebhookUrl,
                        formData,
                        commitInfo: {},
                        actionMessage: 'Nouvelle candidature soumise (compte Civil)',
                        selectOptions,
                        formDefinition: definition,
                    }).catch((err) => console.warn('Webhook Discord candidature échoué:', err));
                }
            }

            showNotification(
                submitAction === 'submit' ? 'Candidature envoyée !' : 'Candidature enregistrée (brouillon).',
                'save'
            );
            return { success: true };
        } catch (error) {
            console.error('Error saving job application:', error);
            Sentry.captureException(error, { extra: { context: 'saveJobApplication', bbCodeVersion } });
            showNotification('Erreur lors de l\'enregistrement de la candidature.', 'error');
            return { success: false };
        }
    }, [isCivilian, civilianProfile, bbCodeVersion, formData, getBBCodeContent, filterFormData, selectOptions, showNotification]);

    // Charge les candidatures du civil connecté ("Mes candidatures").
    const loadMyJobApplications = useCallback(async () => {
        if (!civilianProfile?.uid) {
            setMyJobApplications([]);
            return;
        }
        setIsLoadingJobApplications(true);
        try {
            const snap = await get(ref(database, `jobApplications/${civilianProfile.uid}`));
            if (snap.exists()) {
                const apps = Object.entries(snap.val()).map(([id, app]) => ({ id, ...app }));
                apps.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                setMyJobApplications(apps);
            } else {
                setMyJobApplications([]);
            }
        } catch (error) {
            console.error('Error loading job applications:', error);
            Sentry.captureException(error, { extra: { context: 'loadMyJobApplications' } });
        } finally {
            setIsLoadingJobApplications(false);
        }
    }, [civilianProfile]);

    // Transition de statut générique, utilisée aussi bien par le civil
    // (Mettre en pause / Retirer / Candidater depuis "saved") que par le
    // panneau admin (Planifier un entretien / Marquer effectué / Accepter /
    // Refuser) — voir PendingJobApplications.js. extra permet de fusionner des
    // champs additionnels (ex: interviewDateTime) en même temps que le statut.
    const updateJobApplicationStatus = useCallback(async (applicantUid, applicationId, newStatus, extra = {}) => {
        if (!applicantUid || !applicationId || !newStatus) return { success: false };
        try {
            const appPath = `jobApplications/${applicantUid}/${applicationId}`;
            const snap = await get(ref(database, appPath));
            if (!snap.exists()) {
                showNotification('Candidature introuvable.', 'error');
                return { success: false };
            }
            const existing = snap.val();
            const history = existing.history ? [...existing.history] : [];
            history.push({ status: newStatus, timestamp: Date.now() });
            const updated = sanitizeForFirebase({
                ...existing,
                ...extra,
                status: newStatus,
                updatedAt: Date.now(),
                history,
            });
            await set(ref(database, appPath), updated);
            return { success: true, application: updated };
        } catch (error) {
            console.error('Error updating job application status:', error);
            Sentry.captureException(error, { extra: { context: 'updateJobApplicationStatus', applicantUid, applicationId, newStatus } });
            showNotification('Erreur lors de la mise à jour de la candidature.', 'error');
            return { success: false };
        }
    }, [showNotification]);

    const showRareEasterEggDirectly = useCallback(() => {
        setShowEasterEggModal(true);
        setEasterEggType('rare');
        // Send webhook only if on localhost for the manual trigger
        if (window.location.hostname === 'localhost') {
            sendEasterEggNotification('rare'); // Pass 'rare' type
        }
    }, [sendEasterEggNotification, setEasterEggType, setShowEasterEggModal]);

    // N'exige plus qu'un nom d'employé/patient soit sélectionné dans le
    // formulaire courant : la fenêtre "Rapports enregistrés" s'ouvre toujours,
    // et c'est SavedReportsModal (via useEmployeeAuth) qui décide quoi montrer
    // — ses propres rapports si un employé est connecté, un sélecteur si
    // admin, ou un message de blocage si personne n'est connecté.
    const toggleSavedReports = useCallback((filterVersions = null, employeeType = null, callback = null) => {
        if (showSavedReports) {
            setShowSavedReports(false);
            setPreselectedEmployeeType(null);
            setReportSelectionFilter(null);
            pendingReportAttachmentCallback.current = null;

            return;
        }

        setShowSavedReports(true);
        setPreselectedEmployeeType(employeeType);
        setReportSelectionFilter(filterVersions);
        pendingReportAttachmentCallback.current = callback;
    }, [setPreselectedEmployeeType, setReportSelectionFilter, setShowSavedReports, showSavedReports]);

    const handleShowPositionInfo = useCallback((positionKey, recruitmentDataSource = null) => {
        let data = null;

        if (!positionKey) {
            showNotification("Veuillez sélectionner un poste d'abord.", 'warning');
            return;
        }

        if (recruitmentDataSource && typeof recruitmentDataSource === 'object') {
            data = recruitmentDataSource[positionKey];
        }

        if (data) {
            setCurrentPositionInfo(data);
            setShowPositionInfoModal(true);
        } else {
            showNotification("Aucune information détaillée n'est disponible pour ce poste.", 'warning');
        }
    }, [showNotification]);

    return {
        saveReport,
        savedReports,
        setSavedReports,
        showSavedReports,
        setShowSavedReports,
        isLoadingUserReports,
        setIsLoadingUserReports,
        selectedUserForSavedReports,
        setSelectedUserForSavedReports,
        preselectedEmployeeType,
        setPreselectedEmployeeType,
        loadUserSavedReports,
        loadReportForUser,
        handleReportSelectedForAttachment,
        onAttachReportSummaryRequest,
        deleteReportForUser,
        loadSharedReportsForPatient,
        shareReportWithPatient,
        copyReportToOwnAccount,
        saveJobApplication,
        loadMyJobApplications,
        updateJobApplicationStatus,
        myJobApplications,
        isLoadingJobApplications,
        showMyJobApplications,
        setShowMyJobApplications,
        showRareEasterEggDirectly,
        toggleSavedReports,
        showPositionInfoModal,
        setShowPositionInfoModal,
        currentPositionInfo,
        setCurrentPositionInfo,
        handleShowPositionInfo,
        pendingReportAttachmentCallback,
        reportSelectionFilter,
        setReportSelectionFilter
    };
};