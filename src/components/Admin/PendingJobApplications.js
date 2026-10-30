// src/components/Admin/PendingJobApplications.js
//
// Suivi des candidatures par le recrutement (onglet « Candidatures » de la gestion du recrutement). Même présentation que
// les demandes CCTV : filtres à pastilles avec compteurs, une carte par candidature (statut en couleur, pastille « à
// répondre »), et dans la carte : informations, actions du pipeline, fil d'échanges avec le candidat, aperçu / BBCode /
// historique.
//
// Pipeline : soumise → en cours d'examen (prise en charge, ouvre les échanges) → entretien programmé → entretien effectué
// → acceptée ou refusée. Un refus se justifie toujours (motif proposé ou libre). Les candidatures vivent sous
// candidatures/{candidatUid}/{id} (ancien nœud jobApplications fusionné) : ce composant aplatit l'arbre.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button, Dropdown, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { useData } from '../../contexts/DataContext';
import { loadAllApplications, saveApplication, removeApplication } from '../../utils/recruitmentStore';
import {
    APPLICATION_STATUS, APPLICATION_STATUS_COLORS, REFUSAL_REASONS, THREAD_OPEN_STATUSES, positionsFromSelectOptions, positionLabelFor,
} from '../../constants/recruitment';
import { useDebug } from '../../contexts/DebugContext';
import { sendTemplatedMail } from '../../utils/mailTemplates';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { loadContractCandidates, setContractCandidate, clearContractCandidate } from '../../utils/contractCandidates';
import { subscribeAllThreadMeta } from '../../utils/applicationThreads';
import { notifyUser } from '../../utils/notifications';
import { pauseApplicationsWithoutInternalStatus } from '../../utils/internalRecruitment';
import { applicationStatusLabel as statusLabelOf } from '../../constants/recruitment';
import { logActivity } from '../../utils/activityLog';
import ReportExpansion, { ExpandToggle, useExpansions } from '../ReportExpansion';
import ApplicationThread from '../Recruitment/ApplicationThread';
import InterviewModal from '../Recruitment/InterviewModal';
import { describeInterview, interviewChanges, presentsLabel, saveDecharge } from '../../utils/interviews';
import ForumHint from '../ForumHint';
import useForumNotice from '../../hooks/useForumNotice';
import { copyToClipboard } from '../notificationService';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../../utils/reportExport';
import { getFormDefinition } from '../../formDefinitions';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../../utils/reportDocumentExport';
import '../Cctv/CctvRequests.css';
import '../Recruitment/Applications.css';

const STATUS_LABELS = Object.fromEntries(Object.entries(APPLICATION_STATUS).map(([key, value]) => [key, value.label]));
const colorOf = (status) => APPLICATION_STATUS_COLORS[status] || '#8b949e';

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const OTHER_REASON = '__autre';
const EVENT_LABELS = {
    entretien_planifie: 'Entretien programmé', entretien_modifie: 'Entretien modifié', entretien_annule: 'Entretien annulé',
    candidature_modifiee: 'Candidature modifiée par le candidat', mise_en_pause_auto: 'Mise en pause automatique',
};
const MAIL_MIN_INTERVAL_MS = 30 * 60 * 1000; // un mail « nouveau message » au plus toutes les 30 min par candidature

const StatusChip = ({ status }) => (
    <span className="cctv-chip" style={{ '--c': colorOf(status) }}><span className="cctv-dot"></span>{STATUS_LABELS[status] || status}</span>
);

const PendingJobApplications = ({ showNotification, initialSearch = '' }) => {
    const [applications, setApplications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [meta, setMeta] = useState({});
    const [filter, setFilter] = useState(initialSearch ? 'all' : 'todo'); // recherche venue de l'annuaire : toutes les candidatures de la personne
    const [search, setSearch] = useState(initialSearch);
    const [openId, setOpenId] = useState(undefined); // undefined = défaut (ouverte s'il n'y a qu'un résultat) ; null = tout replié
    const [interviewTarget, setInterviewTarget] = useState(null); // { application, editing } : fenêtre d'entretien ouverte
    const [refusing, setRefusing] = useState({});      // { [clé]: { reason, detail } } : panneau de refus ouvert
    const [busyKey, setBusyKey] = useState(null);
    const lastMailRef = useRef({});
    // Interrupteur Debug (panneau admin) : permet de supprimer une candidature de l'historique.
    const { debugDeleteApplicationsEnabled } = useDebug();
    const { currentEmployee, isAdmin, staffName, civilianProfile, staffProfile } = useEmployeeAuth();
    const { selectOptions } = useData();
    const { openForumNotice, forumNoticeModal } = useForumNotice();
    const { bbcodeEnabled } = useSiteConfig();
    const { open: openRows, toggle: toggleRow, setTab: setRowTab } = useExpansions();

    const actorName = staffName
        || [civilianProfile?.firstName, civilianProfile?.lastName].filter(Boolean).join(' ')
        || currentEmployee?.email || 'Le recrutement';
    const actorRole = isAdmin ? 'Administrateur' : (staffProfile?.rank || 'Recruteur');

    // Poste sous son libellé français (même pour une ancienne candidature qui n'a gardé que la clé anglaise).
    const labelledApplications = useMemo(() => applications.map((application) => ({
        ...application,
        posteCle: application.posteCle ?? application.poste,
        poste: positionLabelFor(selectOptions, application.versionBBCode, application.posteCle || application.poste),
    })), [applications, selectOptions]);

    // Poste de la candidature (retrouvé par sa clé ou son nom) : porte le rôle du personnel (`role`) obtenu à l'embauche (son échelon vient de la grille).
    const findPosition = (poste) => {
        const categories = positionsFromSelectOptions(selectOptions);
        for (const positions of Object.values(categories)) {
            const match = Object.values(positions).find((position) => position.cle === poste || position.nom === poste);
            if (match) return match;
        }
        return null;
    };
    const roleOfPosition = (poste) => findPosition(poste)?.role || null;
    // Rôle facultatif « en attente de contrat » : uid -> infos (voir utils/contractCandidates.js).
    const [contractCandidates, setContractCandidates] = useState({});

    const loadApplications = async () => {
        try {
            // Candidatures déjà normalisées au format français (ancien et nouveau nœud fusionnés).
            const loaded = await loadAllApplications();
            // Un employé sans recrutement interne ne peut pas candidater : ses candidatures ouvertes sont mises en pause d'office.
            const paused = await pauseApplicationsWithoutInternalStatus(loaded, actorName);
            if (paused.length > 0) {
                const byKey = new Map(paused.map((application) => [`${application.candidatUid}/${application.id}`, application]));
                setApplications(loaded.map((application) => byKey.get(`${application.candidatUid}/${application.id}`) || application));
                showNotification(`${paused.length} candidature(s) d'un employé sans recrutement interne mise(s) en pause.`, 'info');
            } else {
                setApplications(loaded);
            }
        } catch (error) {
            console.error('Error loading job applications:', error);
            showNotification('Erreur lors du chargement des candidatures', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadApplications();
        loadContractCandidates().then(setContractCandidates).catch((error) => console.warn('Rôles de contrat illisibles :', error));
        const unsubscribe = subscribeAllThreadMeta(setMeta, (error) => console.warn('Échanges illisibles :', error?.message || error));
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const keyOf = (application) => `${application.candidatUid}/${application.id}`;
    // Candidature modifiée par le candidat depuis la dernière action du recrutement (dernier événement de l'historique) : à relire.
    const modifiedByApplicant = (application) => {
        const history = application.historique || [];
        return ['soumise', 'en_examen'].includes(application.statut) && history.length > 0 && history[history.length - 1].evenement === 'candidature_modifiee';
    };
    const awaitingReply = (application) => {
        const info = meta[keyOf(application)];
        return !!info && !info.staff && THREAD_OPEN_STATUSES.includes(application.statut);
    };

    const getApplicantEmail = async (application) => {
        try {
            const civilSnap = await get(ref(database, `civilians/${application.candidatUid}`));
            if (civilSnap.exists()) return civilSnap.val().email;
            // Candidature interne : l'adresse est celle de la fiche du personnel.
            for (const list of ['phmc', 'coroner']) {
                // eslint-disable-next-line no-await-in-loop
                const staffSnap = await get(ref(database, `staff/${list}`));
                const member = Object.values(staffSnap.val() || {}).find((entry) => entry && entry.uid === application.candidatUid);
                if (member?.email) return member.email;
            }
            return null;
        } catch (error) {
            console.warn('Could not fetch applicant email:', error);
            return null;
        }
    };

    // `templateId` : modèle de mail (utils/mailTemplatesCore.js) ; le nom et le poste du candidat sont ajoutés aux variables.
    const mailApplicant = async (application, templateId, vars = {}) => {
        const email = await getApplicantEmail(application);
        if (email) sendTemplatedMail(templateId, { to: email, vars: { nom: application.nomCandidat || '', poste: application.poste || '', ...vars } });
        return !!email;
    };

    // `event` (facultatif) : { evenement, details } consigné dans l'historique avec le nom de la personne qui agit.
    const updateStatus = async (application, newStatus, extra = {}, event = null) => {
        try {
            const historique = application.historique ? [...application.historique] : [];
            historique.push({ statut: newStatus, horodatage: Date.now(), ...(event ? { evenement: event.evenement, details: event.details || null, par: actorName } : {}) });
            await saveApplication(application.candidatUid, application.id, {
                ...application,
                ...extra,
                statut: newStatus,
                modifieLe: Date.now(),
                historique,
            });
            const EVENT_TITLES = { entretien_planifie: 'Entretien programmé', entretien_modifie: 'Entretien modifié', entretien_annule: 'Entretien annulé' };
            notifyUser(application.candidatUid, {
                type: 'statut',
                titre: EVENT_TITLES[event?.evenement] || `Votre candidature : ${statusLabelOf(newStatus)}`,
                texte: application.poste || undefined, lien: { cible: 'candidature' },
            });
            return true;
        } catch (error) {
            console.error('Error updating application status:', error);
            showNotification(`Erreur lors de la mise à jour : ${error.message}`, 'error');
            return false;
        }
    };

    const run = async (application, action) => {
        setBusyKey(keyOf(application));
        try { await action(); } finally { setBusyKey(null); }
    };

    const journal = (action, summary, application, severity = 'info', details = '') => logActivity({
        category: 'recrutement', action, summary, severity, target: application.nomCandidat || application.candidatUid,
        details: `Poste : ${application.poste || '—'}${details ? `\n${details}` : ''}`,
    });

    // ───────── Actions du pipeline ─────────

    const handleTakeCharge = (application) => run(application, async () => {
        const ok = await updateStatus(application, 'en_examen', { priseEnChargePar: { uid: currentEmployee?.uid || null, nom: actorName, le: Date.now() } });
        if (!ok) return;
        journal('application_in_review', `Candidature prise en charge : ${application.nomCandidat} — ${application.poste}`, application);
        await mailApplicant(application, 'candidature_en_examen', { recruteur: actorName });
        showNotification('Candidature prise en charge : les échanges avec le candidat sont ouverts.', 'success');
        loadApplications();
    });

    // Planification ou modification d'un entretien (fenêtre InterviewModal). Une décharge signée est conservée à part si aucun
    // personnel administratif n'est présent ; tout est consigné dans l'historique et le candidat est prévenu par mail.
    const handleSaveInterview = async (application, { entretien, signature }) => {
        const previous = application.statut === 'entretien_programme' ? application.entretien : null;
        const isEdit = !!previous;
        const changes = isEdit ? interviewChanges(previous, entretien) : [];
        if (isEdit && changes.length === 0 && !!previous.sansAdministratif === !!entretien.sansAdministratif) {
            throw new Error("Aucune modification : changez la date, le recruteur ou les personnes présentes.");
        }
        if (entretien.sansAdministratif) {
            await saveDecharge({ application, actor: { uid: currentEmployee?.uid, name: actorName }, signature, entretien });
        }
        const now = Date.now();
        const full = {
            ...entretien,
            planifiePar: previous?.planifiePar || { nom: actorName, le: now },
            ...(isEdit ? { modifieLe: now, modifiePar: actorName } : {}),
        };
        const ok = await updateStatus(application, 'entretien_programme', {
            entretien: full,
            dateEntretien: entretien.date,
            priseEnChargePar: application.priseEnChargePar || { uid: currentEmployee?.uid || null, nom: actorName, le: now },
        }, {
            evenement: isEdit ? 'entretien_modifie' : 'entretien_planifie',
            details: isEdit ? changes.join(' ; ') : describeInterview(entretien),
        });
        if (!ok) throw new Error("L'entretien n'a pas pu être enregistré.");
        journal(isEdit ? 'application_interview_edited' : 'application_interview', `Entretien ${isEdit ? 'modifié' : 'programmé'} : ${application.nomCandidat} — ${application.poste}`, application, 'info',
            isEdit ? changes.join('\n') : `Entretien ${describeInterview(entretien)}`);
        const formatted = new Date(entretien.date).toLocaleString('fr-FR');
        const who = `Il sera mené par ${entretien.recruteur.nom}${entretien.presents.length ? `, en présence de ${presentsLabel(entretien)}` : ''}.`;
        await mailApplicant(application, isEdit ? 'entretien_modifie' : 'entretien_programme', { date_entretien: formatted, organisation: who, changements: changes });
        showNotification(isEdit ? 'Entretien modifié et candidat notifié.' : 'Entretien programmé et candidat notifié.', 'success');
        loadApplications();
    };

    // Annule l'entretien sans toucher à la candidature : elle repasse « en cours d'examen », prête pour un nouvel entretien.
    const handleCancelInterview = (application) => run(application, async () => {
        const reason = window.prompt(`Annuler l'entretien de ${application.nomCandidat} ?\n\nMotif (facultatif, transmis au candidat) :`, '');
        if (reason === null) return;
        const note = reason.trim();
        const previous = application.entretien;
        const ok = await updateStatus(application, 'en_examen', { entretien: null, dateEntretien: null }, {
            evenement: 'entretien_annule',
            details: `${previous ? `Entretien ${describeInterview(previous)} annulé` : 'Entretien annulé'}${note ? ` — ${note}` : ''}`,
        });
        if (!ok) return;
        journal('application_interview_cancelled', `Entretien annulé : ${application.nomCandidat} — ${application.poste}`, application, 'warning', note);
        await mailApplicant(application, 'entretien_annule', { motif: note });
        showNotification('Entretien annulé, candidat notifié. La candidature reste en cours d\'examen.', 'info');
        loadApplications();
    });

    const handleMarkInterviewCompleted = (application) => run(application, async () => {
        const ok = await updateStatus(application, 'entretien_effectue');
        if (ok) {
            journal('application_interview_done', `Entretien effectué : ${application.nomCandidat} — ${application.poste}`, application);
            showNotification('Entretien marqué comme effectué.', 'success');
            loadApplications();
        }
    });

    const handleAccept = (application) => run(application, async () => {
        if (application.statut !== 'entretien_effectue') {
            showNotification('L\'entretien doit d\'abord être marqué comme effectué avant d\'accepter cette candidature.', 'warning');
            return;
        }
        if (!window.confirm(`Confirmer l'acceptation de la candidature de ${application.nomCandidat} ?`)) return;
        const ok = await updateStatus(application, 'acceptee');
        if (!ok) return;
        journal('application_accepted', `Candidature acceptée : ${application.nomCandidat} — ${application.poste}`, application, 'success');
        await mailApplicant(application, 'candidature_acceptee');
        showNotification('Candidature acceptée et candidat notifié.', 'success');
        loadApplications();
    });

    const startRefusal = (application) => setRefusing((current) => ({ ...current, [keyOf(application)]: { reason: '', detail: '' } }));
    const cancelRefusal = (application) => setRefusing((current) => { const next = { ...current }; delete next[keyOf(application)]; return next; });
    const patchRefusal = (application, patch) => setRefusing((current) => ({ ...current, [keyOf(application)]: { ...current[keyOf(application)], ...patch } }));

    const handleRefuse = (application) => run(application, async () => {
        const draft = refusing[keyOf(application)] || {};
        const detail = (draft.detail || '').trim();
        const motif = draft.reason === OTHER_REASON ? detail : draft.reason;
        if (!motif) {
            showNotification(draft.reason === OTHER_REASON ? 'Écrivez le motif du refus.' : 'Choisissez un motif de refus (ou « Autre » pour écrire le vôtre).', 'warning');
            return;
        }
        const refus = { motif, detail: draft.reason === OTHER_REASON ? '' : detail, parNom: actorName, le: Date.now() };
        const ok = await updateStatus(application, 'refusee', { refus });
        if (!ok) return;
        cancelRefusal(application);
        journal('application_refused', `Candidature refusée : ${application.nomCandidat} — ${application.poste}`, application, 'warning', `Motif : ${motif}${refus.detail ? `\n${refus.detail}` : ''}`);
        await mailApplicant(application, 'candidature_refusee', { motif, detail: refus.detail || '' });
        showNotification('Candidature refusée, motif transmis au candidat.', 'info');
        loadApplications();
    });

    // Pose ou retire le rôle « en attente de signature de contrat » sur un candidat ACCEPTÉ.
    // C'est au recruteur de décider : rien n'est posé automatiquement à l'acceptation.
    const handleToggleContractRole = (application) => run(application, async () => {
        const hasRole = !!contractCandidates[application.candidatUid];
        try {
            if (hasRole) {
                if (!window.confirm(`Retirer le rôle « en attente de contrat » à ${application.nomCandidat} ? Il n'aura plus accès à ses contrats par ce biais.`)) return;
                await clearContractCandidate(application.candidatUid);
                setContractCandidates((current) => { const next = { ...current }; delete next[application.candidatUid]; return next; });
                journal('contract_role_removed', `Rôle « en attente de contrat » retiré : ${application.nomCandidat}`, application);
                showNotification('Rôle « en attente de contrat » retiré.', 'info');
                return;
            }
            if (!window.confirm(`Passer ${application.nomCandidat} en « attente de signature de contrat » ?\n\nIl pourra consulter et signer son contrat depuis la Boîte à outils.`)) return;
            await setContractCandidate(application.candidatUid, {
                byUid: currentEmployee?.uid, byName: actorName, applicationId: application.id, position: application.poste || null,
                role: roleOfPosition(application.poste),
            });
            setContractCandidates((current) => ({ ...current, [application.candidatUid]: { definiParNom: actorName, definiLe: Date.now() } }));
            journal('contract_role_set', `Rôle « en attente de contrat » posé : ${application.nomCandidat}`, application, 'success');
            await mailApplicant(application, 'contrat_en_preparation');
            showNotification('Candidat passé en attente de contrat (notifié).', 'success');
        } catch (error) {
            console.error('Error toggling contract role:', error);
            showNotification(`Action impossible : ${error.message}`, 'error');
        }
    });

    const handleDeleteApplication = async (application) => {
        if (!window.confirm(`Supprimer définitivement la candidature de ${application.nomCandidat || 'ce candidat'} (${application.poste || 'poste inconnu'}) ?`)) return;
        try {
            await removeApplication(application.candidatUid, application.id);
            logActivity({
                category: 'recrutement', action: 'application_deleted', severity: 'warning',
                summary: `Candidature supprimée définitivement : ${application.nomCandidat} — ${application.poste || 'poste inconnu'}`,
                details: `Statut : ${STATUS_LABELS[application.statut] || application.statut}\nSupprimée par : ${actorName}`, target: application.nomCandidat || undefined,
            });
            showNotification('Candidature supprimée.', 'trash');
            await loadApplications();
        } catch (error) {
            console.error('Error deleting job application:', error);
            showNotification("Suppression refusée : l'option Debug « suppression des candidatures » est-elle activée ?", 'error');
        }
    };

    // Après un message du recrutement : un mail au candidat, au plus un toutes les 30 min par candidature.
    const handleStaffMessage = async (application, message) => {
        const key = keyOf(application);
        const previous = lastMailRef.current[key] || 0;
        if (message.ts - previous < MAIL_MIN_INTERVAL_MS) return;
        lastMailRef.current[key] = message.ts;
        await mailApplicant(application, 'candidature_message');
    };

    // ───────── Export ─────────
    const applicationTitle = (application) => `Candidature - ${application.poste || 'Poste'}${application.nomCandidat ? ` - ${application.nomCandidat}` : ''}`;
    const handleCopyBbCode = (application) => {
        if (!application.bbcode) { showNotification('Aucun BBCode enregistré pour cette candidature.', 'warning'); return; }
        copyToClipboard(application.bbcode, showNotification, 'BBCode copié !');
    };
    const handleDownloadHtml = (application) => {
        if (downloadBbCodeAsHtml({ bbCode: application.bbcode, title: applicationTitle(application), showNotification })) openForumNotice('html');
    };
    const handleExportDocument = (format, application) => exportReportDocument(format, { bbCode: application.bbcode, title: applicationTitle(application), showNotification });

    // Historique des statuts (onglet de l'aperçu).
    const renderHistory = (application) => {
        const history = [...(application.historique || [])].sort((a, b) => (b.horodatage || 0) - (a.horodatage || 0));
        if (history.length === 0) return <span className="cctv-muted">Aucun historique enregistré.</span>;
        return (
            <ul style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
                {history.map((entry, index) => (
                    <li key={`${entry.statut}-${entry.horodatage}-${index}`}>
                        {entry.evenement ? <strong>{EVENT_LABELS[entry.evenement] || entry.evenement}</strong> : (STATUS_LABELS[entry.statut] || entry.statut)} — {formatDate(entry.horodatage)}
                        {entry.par ? ` · ${entry.par}` : ''}
                        {entry.details && <div className="cctv-muted">{entry.details}</div>}
                    </li>
                ))}
            </ul>
        );
    };

    // ───────── Liste ─────────
    const counts = useMemo(() => {
        const result = { todo: 0, soumise: 0, en_examen: 0, entretien: 0, acceptee: 0, refusee: 0, autres: 0, all: labelledApplications.length };
        labelledApplications.forEach((application) => {
            const info = meta[`${application.candidatUid}/${application.id}`];
            const replyNeeded = !!info && !info.staff && THREAD_OPEN_STATUSES.includes(application.statut);
            if (application.statut === 'soumise' || application.statut === 'entretien_effectue' || replyNeeded || modifiedByApplicant(application)) result.todo += 1;
            if (application.statut === 'soumise') result.soumise += 1;
            else if (application.statut === 'en_examen') result.en_examen += 1;
            else if (['entretien_programme', 'entretien_effectue'].includes(application.statut)) result.entretien += 1;
            else if (application.statut === 'acceptee') result.acceptee += 1;
            else if (application.statut === 'refusee') result.refusee += 1;
            else result.autres += 1;
        });
        return result;
    }, [labelledApplications, meta]);

    const matchesFilter = (application) => {
        switch (filter) {
            case 'todo': return application.statut === 'soumise' || application.statut === 'entretien_effectue' || awaitingReply(application) || modifiedByApplicant(application);
            case 'soumise': case 'en_examen': case 'acceptee': case 'refusee': return application.statut === filter;
            case 'entretien': return ['entretien_programme', 'entretien_effectue'].includes(application.statut);
            case 'autres': return ['brouillon', 'retiree', 'en_pause'].includes(application.statut);
            default: return true;
        }
    };

    const shown = useMemo(() => {
        const needle = normalize(search).trim();
        return labelledApplications.filter((application) => matchesFilter(application)
            && (!needle || normalize(`${application.nomCandidat} ${application.idPatient} ${application.poste}`).includes(needle)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [labelledApplications, filter, search, meta]);

    const FILTERS = [
        { key: 'todo', label: 'À traiter', color: '#e3b341' },
        { key: 'soumise', label: 'Nouvelles', color: colorOf('soumise') },
        { key: 'en_examen', label: "En examen", color: colorOf('en_examen') },
        { key: 'entretien', label: 'Entretiens', color: colorOf('entretien_programme') },
        { key: 'acceptee', label: 'Acceptées', color: colorOf('acceptee') },
        { key: 'refusee', label: 'Refusées', color: colorOf('refusee') },
        { key: 'autres', label: 'Brouillons / retirées', color: '#8b949e' },
        { key: 'all', label: 'Toutes', color: '#58a6ff' },
    ];

    if (isLoading) {
        return <div className="cctv-empty"><Spinner size="sm" animation="border" className="me-2" />Chargement des candidatures…</div>;
    }

    return (
        <div className="cctv-panel">
            {forumNoticeModal}
            <div className="cctv-toolbar">
                <div className="cctv-filters" role="group" aria-label="Statut">
                    {FILTERS.map((item) => (
                        <button key={item.key} type="button" className={filter === item.key ? 'on' : ''} style={{ '--c': item.color }} onClick={() => setFilter(item.key)}>
                            {item.label} <span>{counts[item.key] || 0}</span>
                        </button>
                    ))}
                </div>
                <input type="search" className="cctv-search" placeholder="Candidat, poste, ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <InterviewModal
                show={!!interviewTarget} onHide={() => setInterviewTarget(null)}
                application={interviewTarget?.application}
                interview={interviewTarget?.editing ? interviewTarget.application.entretien || (interviewTarget.application.dateEntretien ? { date: interviewTarget.application.dateEntretien } : null) : null}
                actor={{ name: actorName, uid: currentEmployee?.uid }}
                onSubmit={(payload) => handleSaveInterview(interviewTarget.application, payload)}
            />

            {shown.length === 0 && (
                <p className="cctv-empty">{labelledApplications.length === 0 ? "Aucune candidature n'a encore été déposée." : 'Aucune candidature ne correspond à ce filtre.'}</p>
            )}

            <div className="cctv-list">
                {shown.map((application) => {
                    const key = keyOf(application);
                    const isOpen = openId === undefined ? shown.length === 1 : openId === key;
                    const replyNeeded = awaitingReply(application);
                    const draft = refusing[key];
                    const busy = busyKey === key;
                    const canAct = !['brouillon', 'retiree', 'en_pause'].includes(application.statut);
                    const refusable = ['soumise', 'en_examen', 'entretien_programme', 'entretien_effectue'].includes(application.statut);
                    const flag = modifiedByApplicant(application) ? 'Modifiée' : (application.statut === 'soumise' ? 'À prendre en charge' : (replyNeeded ? 'À répondre' : (application.statut === 'entretien_effectue' ? 'Décision à rendre' : null)));
                    return (
                        <div key={key} className={`cctv-card ${isOpen ? 'open' : ''}`} style={{ '--c': colorOf(application.statut) }}>
                            <button type="button" className="cctv-card-head" onClick={() => setOpenId(isOpen ? null : key)}>
                                <span className="cctv-card-main">
                                    <strong>
                                        {application.nomCandidat || 'Candidat inconnu'}
                                        {application.interne && <span className="rec-internal" title="Candidature d'un employé (statut de recrutement interne)">Interne</span>}
                                    </strong>
                                    <small>{application.poste || 'Poste inconnu'} · {formatDate(application.modifieLe || application.creeLe)}</small>
                                </span>
                                {flag && <span className="cctv-flag">{flag}</span>}
                                <StatusChip status={application.statut} />
                                <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} cctv-caret`}></i>
                            </button>

                            {isOpen && (
                                <div className="cctv-card-body">
                                    <dl className="cctv-fields">
                                        <dt>Candidat</dt><dd>{application.nomCandidat || '—'}{application.idPatient ? ` (${application.idPatient})` : ''}</dd>
                                        <dt>Poste</dt><dd>{application.poste || '—'}</dd>
                                        <dt>Formulaire</dt><dd>{getFormDefinition(application.versionBBCode)?.name || application.versionBBCode || '—'}</dd>
                                        <dt>Déposée le</dt><dd>{formatDate(application.creeLe)}</dd>
                                        {application.priseEnChargePar?.nom && (<><dt>Prise en charge</dt><dd>{application.priseEnChargePar.nom} · {formatDate(application.priseEnChargePar.le)}</dd></>)}
                                        {application.dateEntretien && (<><dt>Entretien</dt><dd>{formatDate(application.dateEntretien)}</dd></>)}
                                        {application.entretien?.recruteur?.nom && (<><dt>Mené par</dt><dd>{application.entretien.recruteur.nom}</dd></>)}
                                        {application.entretien?.presents?.length > 0 && (<><dt>Présents</dt><dd>{presentsLabel(application.entretien)}</dd></>)}
                                        {application.entretien?.sansAdministratif && (<><dt>Décharge</dt><dd>Signée : aucun personnel administratif à l'entretien</dd></>)}
                                        {application.refus?.motif && (
                                            <><dt>Motif du refus</dt><dd>{application.refus.motif}{application.refus.detail ? <><br /><span className="cctv-muted">{application.refus.detail}</span></> : null}{application.refus.parNom ? <span className="cctv-muted"> — {application.refus.parNom}</span> : null}</dd></>
                                        )}
                                    </dl>

                                    {canAct && (
                                        <div className="rec-actions">
                                            {application.statut === 'soumise' && (
                                                <Button size="sm" variant="primary" disabled={busy} onClick={() => handleTakeCharge(application)}>
                                                    <i className="fas fa-hand me-1"></i>Prendre en charge
                                                </Button>
                                            )}
                                            {['soumise', 'en_examen'].includes(application.statut) && (
                                                <Button size="sm" variant="outline-primary" disabled={busy} onClick={() => setInterviewTarget({ application, editing: false })}>
                                                    <i className="fas fa-calendar-plus me-1"></i>Planifier un entretien
                                                </Button>
                                            )}
                                            {application.statut === 'entretien_programme' && (
                                                <>
                                                    <Button size="sm" variant="info" disabled={busy} onClick={() => handleMarkInterviewCompleted(application)}>Marquer l'entretien effectué</Button>
                                                    <Button size="sm" variant="outline-primary" disabled={busy} onClick={() => setInterviewTarget({ application, editing: true })}
                                                        title="Décaler l'entretien, changer le recruteur ou les personnes présentes">
                                                        <i className="fas fa-pen me-1"></i>Modifier l'entretien
                                                    </Button>
                                                    <Button size="sm" variant="outline-warning" disabled={busy} onClick={() => handleCancelInterview(application)}
                                                        title="Annule l'entretien : la candidature reste en cours d'examen">
                                                        <i className="fas fa-calendar-xmark me-1"></i>Annuler l'entretien
                                                    </Button>
                                                </>
                                            )}
                                            {application.statut === 'entretien_effectue' && (
                                                <Button size="sm" variant="success" disabled={busy} onClick={() => handleAccept(application)}>
                                                    <i className="fas fa-check me-1"></i>Accepter
                                                </Button>
                                            )}
                                            {application.statut === 'acceptee' && application.interne && (
                                                <span className="cctv-muted">Candidature interne : envoyez directement son contrat depuis l'onglet « Contrats ».</span>
                                            )}
                                            {application.statut === 'acceptee' && !application.interne && (
                                                <Button size="sm" variant={contractCandidates[application.candidatUid] ? 'outline-warning' : 'info'} disabled={busy}
                                                    onClick={() => handleToggleContractRole(application)}
                                                    title="Rôle facultatif : donne au candidat accès à son contrat">
                                                    <i className="fas fa-file-signature me-1"></i>
                                                    {contractCandidates[application.candidatUid] ? 'Retirer « attente de contrat »' : 'Passer en attente de contrat'}
                                                </Button>
                                            )}
                                            {refusable && !draft && (
                                                <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => startRefusal(application)}>
                                                    <i className="fas fa-xmark me-1"></i>Refuser
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {draft && (
                                        <div className="rec-refusal">
                                            <div className="rec-refusal-title"><i className="fas fa-triangle-exclamation me-2"></i>Refuser cette candidature : le candidat recevra le motif.</div>
                                            <select
                                                className="rec-select" value={draft.reason} onChange={(e) => patchRefusal(application, { reason: e.target.value })}
                                                aria-label="Motif du refus"
                                            >
                                                <option value="">— Choisissez un motif —</option>
                                                {REFUSAL_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                                                <option value={OTHER_REASON}>Autre (écrire le motif)…</option>
                                            </select>
                                            <textarea
                                                className="rec-textarea" rows={3} value={draft.detail} onChange={(e) => patchRefusal(application, { detail: e.target.value })}
                                                placeholder={draft.reason === OTHER_REASON ? 'Motif du refus (obligatoire)…' : 'Précisions pour le candidat (facultatif)…'}
                                            />
                                            <div className="rec-refusal-actions">
                                                <Button size="sm" variant="secondary" onClick={() => cancelRefusal(application)} disabled={busy}>Annuler</Button>
                                                <Button size="sm" variant="danger" onClick={() => handleRefuse(application)} disabled={busy}>Confirmer le refus</Button>
                                            </div>
                                        </div>
                                    )}

                                    <ApplicationThread
                                        application={application} staff authorName={actorName} authorRole={actorRole}
                                        onMailNeeded={(message) => handleStaffMessage(application, message)}
                                    />

                                    <div className="rec-tools">
                                        <ExpandToggle open={openRows[key] === 'preview'} onClick={() => toggleRow(key, 'preview')} label="Aperçu" title="Déplier / replier l'aperçu de la candidature" />
                                        {bbcodeEnabled && (
                                            <ExpandToggle open={openRows[key] === 'bbcode'} onClick={() => toggleRow(key, 'bbcode')} label="Voir le BBCode" icon="fa-code" />
                                        )}
                                        <ExpandToggle open={openRows[key] === 'history'} onClick={() => toggleRow(key, 'history')} label="Historique" icon="fa-clock-rotate-left" />
                                        <Dropdown className="d-inline-block">
                                            <Dropdown.Toggle size="sm" variant="secondary">Copier</Dropdown.Toggle>
                                            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                                {bbcodeEnabled && (
                                                    <Dropdown.Item onClick={() => handleCopyBbCode(application)} disabled={!application.bbcode} title={COPY_BBCODE_HINT}>
                                                        Copier le BBCode<ForumHint kind="bbcode" />
                                                    </Dropdown.Item>
                                                )}
                                                <Dropdown.Item onClick={() => handleDownloadHtml(application)} disabled={!application.bbcode} title={DOWNLOAD_HTML_HINT}>
                                                    Télécharger le HTML<ForumHint kind="html" />
                                                </Dropdown.Item>
                                                <Dropdown.Item onClick={() => handleExportDocument('pdf', application)} disabled={!application.bbcode}>{PDF_EXPORT_LABEL}</Dropdown.Item>
                                                <Dropdown.Item onClick={() => handleExportDocument('png', application)} disabled={!application.bbcode}>Télécharger l'image (PNG, pour Discord)</Dropdown.Item>
                                                <Dropdown.Item onClick={() => handleExportDocument('png-copy', application)} disabled={!application.bbcode}>Copier l'image (à coller dans Discord)</Dropdown.Item>
                                                <Dropdown.Item onClick={() => copyToClipboard(applicationTitle(application), showNotification, 'Titre copié !')}>Copier le titre</Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                        {debugDeleteApplicationsEnabled && (
                                            <Button size="sm" variant="outline-danger" onClick={() => handleDeleteApplication(application)} title="Debug : supprime définitivement cette candidature">
                                                <i className="fas fa-trash"></i> Supprimer
                                            </Button>
                                        )}
                                    </div>
                                    {openRows[key] && (
                                        <div className="rec-expansion">
                                            <ReportExpansion
                                                tab={openRows[key]}
                                                onTabChange={(tab) => setRowTab(key, tab)}
                                                bbCode={application.bbcode}
                                                title={applicationTitle(application)}
                                                extraTabs={[{ key: 'history', label: 'Historique', content: renderHistory(application) }]}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PendingJobApplications;
