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
import { sendEyefindMail } from '../../utils/eyefindMail';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { loadContractCandidates, setContractCandidate, clearContractCandidate } from '../../utils/contractCandidates';
import { subscribeAllThreadMeta } from '../../utils/applicationThreads';
import { logActivity } from '../../utils/activityLog';
import ReportExpansion, { ExpandToggle, useExpansions } from '../ReportExpansion';
import ApplicationThread from '../Recruitment/ApplicationThread';
import ForumHint from '../ForumHint';
import useForumNotice from '../../hooks/useForumNotice';
import { copyToClipboard } from '../notificationService';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../../utils/reportExport';
import { getFormDefinition } from '../../formDefinitions';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../../utils/reportDocumentExport';
import '../Cctv/CctvRequests.css';
import '../Recruitment/Applications.css';

const sendMailBestEffort = (params) => {
    sendEyefindMail(params).then((result) => {
        if (!result.ok) console.warn('Eyefind Mail non envoyé:', result.error, result.message);
    });
};

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
const MAIL_MIN_INTERVAL_MS = 30 * 60 * 1000; // un mail « nouveau message » au plus toutes les 30 min par candidature

const StatusChip = ({ status }) => (
    <span className="cctv-chip" style={{ '--c': colorOf(status) }}><span className="cctv-dot"></span>{STATUS_LABELS[status] || status}</span>
);

const PendingJobApplications = ({ showNotification }) => {
    const [applications, setApplications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [meta, setMeta] = useState({});
    const [filter, setFilter] = useState('todo');
    const [search, setSearch] = useState('');
    const [openId, setOpenId] = useState(null);
    const [interviewInputs, setInterviewInputs] = useState({});
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

    // Rôle du personnel relié au poste de la candidature (champ `role` du poste), s'il est défini.
    const roleOfPosition = (poste) => {
        const categories = positionsFromSelectOptions(selectOptions);
        for (const positions of Object.values(categories)) {
            const match = Object.values(positions).find((position) => position.cle === poste || position.nom === poste);
            if (match) return match.role || null;
        }
        return null;
    };
    // Rôle facultatif « en attente de contrat » : uid -> infos (voir utils/contractCandidates.js).
    const [contractCandidates, setContractCandidates] = useState({});

    const loadApplications = async () => {
        try {
            // Candidatures déjà normalisées au format français (ancien et nouveau nœud fusionnés).
            setApplications(await loadAllApplications());
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

    const mailApplicant = async (application, subject, text, html) => {
        const email = await getApplicantEmail(application);
        if (email) sendMailBestEffort({ to: email, subject, body: text, html });
        return !!email;
    };

    const updateStatus = async (application, newStatus, extra = {}) => {
        try {
            const historique = application.historique ? [...application.historique] : [];
            historique.push({ statut: newStatus, horodatage: Date.now() });
            await saveApplication(application.candidatUid, application.id, {
                ...application,
                ...extra,
                statut: newStatus,
                modifieLe: Date.now(),
                historique,
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
        await mailApplicant(application, 'Votre candidature est en cours d\'examen - PHMC',
            `Bonjour ${application.nomCandidat || ''},\n\nVotre candidature pour le poste "${application.poste || ''}" est en cours d'examen par ${actorName}. Vous pouvez échanger avec le recrutement depuis l'outil PHMC-FR : Boîte à outils → « Mon dossier candidat ».\n\nCordialement,\nPillbox Hill Medical Center`,
            `<p>Bonjour ${application.nomCandidat || ''},</p><p>Votre candidature pour le poste « <b>${application.poste || ''}</b> » est <b>en cours d'examen</b> par ${actorName}. Vous pouvez échanger avec le recrutement depuis l'outil PHMC-FR : <b>Boîte à outils → « Mon dossier candidat »</b>.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`);
        showNotification('Candidature prise en charge : les échanges avec le candidat sont ouverts.', 'success');
        loadApplications();
    });

    const handleScheduleInterview = (application) => run(application, async () => {
        const rawDateTime = interviewInputs[keyOf(application)];
        if (!rawDateTime) {
            showNotification('Veuillez choisir une date et une heure pour l\'entretien.', 'warning');
            return;
        }
        const interviewDateTime = new Date(rawDateTime).toISOString();
        const ok = await updateStatus(application, 'entretien_programme', {
            dateEntretien: interviewDateTime,
            priseEnChargePar: application.priseEnChargePar || { uid: currentEmployee?.uid || null, nom: actorName, le: Date.now() },
        });
        if (!ok) return;
        journal('application_interview', `Entretien programmé : ${application.nomCandidat} — ${application.poste}`, application, 'info', `Date : ${formatDate(interviewDateTime)}`);
        const formatted = new Date(interviewDateTime).toLocaleString('fr-FR');
        await mailApplicant(application, 'Entretien de candidature - PHMC',
            `Bonjour ${application.nomCandidat || ''},\n\nVotre entretien pour le poste "${application.poste || ''}" au Pillbox Hill Medical Center est programmé le ${formatted}.\n\nMerci de vous présenter à l'étage de l'administration du Pillbox Hill Medical Center, situé au 76 Strawberry Ave, Los Santos.\n\nEn cas d'empêchement, contactez l'administration du PHMC au plus vite.\n\nCordialement,\nPillbox Hill Medical Center`,
            `<p>Bonjour ${application.nomCandidat || ''},</p><p>Votre entretien pour le poste « <b>${application.poste || ''}</b> » au Pillbox Hill Medical Center est programmé le <b>${formatted}</b>.</p><p>Merci de vous présenter à l'étage de l'administration du Pillbox Hill Medical Center, situé au 76 Strawberry Ave, Los Santos.</p><p>En cas d'empêchement, contactez l'administration du PHMC au plus vite.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`);
        showNotification('Entretien programmé et candidat notifié.', 'success');
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
        await mailApplicant(application, 'Votre candidature a été acceptée - PHMC',
            `Bonjour ${application.nomCandidat || ''},\n\nFélicitations ! Votre candidature pour le poste "${application.poste || ''}" au Pillbox Hill Medical Center a été acceptée.\n\nVous serez contacté(e) prochainement par l'administration pour la suite des formalités. Vous pouvez continuer à échanger avec le recrutement depuis « Mon dossier candidat » jusqu'à la signature de votre contrat.\n\nCordialement,\nPillbox Hill Medical Center`,
            `<p>Bonjour ${application.nomCandidat || ''},</p><p>Félicitations ! Votre candidature pour le poste « <b>${application.poste || ''}</b> » au Pillbox Hill Medical Center a été <b>acceptée</b>.</p><p>Vous serez contacté(e) prochainement par l'administration pour la suite des formalités. Vous pouvez continuer à échanger avec le recrutement depuis <b>« Mon dossier candidat »</b> jusqu'à la signature de votre contrat.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`);
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
        const extraText = refus.detail ? `\n${refus.detail}` : '';
        const extraHtml = refus.detail ? `<br>${refus.detail}` : '';
        await mailApplicant(application, 'Votre candidature - PHMC',
            `Bonjour ${application.nomCandidat || ''},\n\nNous vous remercions pour votre candidature au poste "${application.poste || ''}" au Pillbox Hill Medical Center. Après examen, celle-ci n'a malheureusement pas été retenue.\n\nMotif : ${motif}${extraText}\n\nVous pouvez candidater à nouveau ultérieurement.\n\nCordialement,\nPillbox Hill Medical Center`,
            `<p>Bonjour ${application.nomCandidat || ''},</p><p>Nous vous remercions pour votre candidature au poste « <b>${application.poste || ''}</b> » au Pillbox Hill Medical Center. Après examen, celle-ci n'a malheureusement pas été retenue.</p><p><b>Motif :</b> ${motif}${extraHtml}</p><p>Vous pouvez candidater à nouveau ultérieurement.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`);
        showNotification('Candidature refusée, motif transmis au candidat.', 'info');
        loadApplications();
    });

    // Pose ou retire le rôle « en attente de signature de contrat » sur un candidat ACCEPTÉ.
    // C'est au recruteur de décider : rien n'est posé automatiquement à l'acceptation.
    const handleToggleContractRole = (application) => run(application, async () => {
        const hasRole = !!contractCandidates[application.candidatUid];
        try {
            if (hasRole) {
                if (!window.confirm(`Retirer le rôle « en attente de contrat » à ${application.nomCandidat} ? Il n'aura plus accès à ses contrats ni à la création de sa signature par ce biais.`)) return;
                await clearContractCandidate(application.candidatUid);
                setContractCandidates((current) => { const next = { ...current }; delete next[application.candidatUid]; return next; });
                journal('contract_role_removed', `Rôle « en attente de contrat » retiré : ${application.nomCandidat}`, application);
                showNotification('Rôle « en attente de contrat » retiré.', 'info');
                return;
            }
            if (!window.confirm(`Passer ${application.nomCandidat} en « attente de signature de contrat » ?\n\nIl pourra consulter et signer son contrat, et créer sa signature, depuis la Boîte à outils.`)) return;
            await setContractCandidate(application.candidatUid, {
                byUid: currentEmployee?.uid, byName: actorName, applicationId: application.id, position: application.poste || null,
                role: roleOfPosition(application.poste),
            });
            setContractCandidates((current) => ({ ...current, [application.candidatUid]: { definiParNom: actorName, definiLe: Date.now() } }));
            journal('contract_role_set', `Rôle « en attente de contrat » posé : ${application.nomCandidat}`, application, 'success');
            await mailApplicant(application, 'Votre contrat vous attend - PHMC',
                `Bonjour ${application.nomCandidat || ''},\n\nVotre contrat au Pillbox Hill Medical Center est en préparation. Connectez-vous à l'outil PHMC-FR : dans la Boîte à outils, « Mes contrats » vous permettra de le lire et de le signer. Vous pourrez y créer votre signature si vous n'en avez pas encore.\n\nCordialement,\nPillbox Hill Medical Center`,
                `<p>Bonjour ${application.nomCandidat || ''},</p><p>Votre contrat au Pillbox Hill Medical Center est en préparation. Connectez-vous à l'outil PHMC-FR : dans la <b>Boîte à outils</b>, <b>« Mes contrats »</b> vous permettra de le lire et de le signer. Vous pourrez y créer votre signature si vous n'en avez pas encore.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`);
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
        await mailApplicant(application, 'Nouveau message sur votre candidature - PHMC',
            `Bonjour ${application.nomCandidat || ''},\n\nLe recrutement vous a écrit à propos de votre candidature pour le poste "${application.poste || ''}". Connectez-vous à l'outil PHMC-FR : Boîte à outils → « Mon dossier candidat » pour lire le message et y répondre.\n\nCordialement,\nPillbox Hill Medical Center`,
            `<p>Bonjour ${application.nomCandidat || ''},</p><p>Le recrutement vous a écrit à propos de votre candidature pour le poste « <b>${application.poste || ''}</b> ». Connectez-vous à l'outil PHMC-FR : <b>Boîte à outils → « Mon dossier candidat »</b> pour lire le message et y répondre.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`);
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
                    <li key={`${entry.statut}-${entry.horodatage}-${index}`}>{STATUS_LABELS[entry.statut] || entry.statut} — {formatDate(entry.horodatage)}</li>
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
            if (application.statut === 'soumise' || application.statut === 'entretien_effectue' || replyNeeded) result.todo += 1;
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
            case 'todo': return application.statut === 'soumise' || application.statut === 'entretien_effectue' || awaitingReply(application);
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

            {shown.length === 0 && (
                <p className="cctv-empty">{labelledApplications.length === 0 ? "Aucune candidature n'a encore été déposée." : 'Aucune candidature ne correspond à ce filtre.'}</p>
            )}

            <div className="cctv-list">
                {shown.map((application) => {
                    const key = keyOf(application);
                    const isOpen = openId === key || shown.length === 1;
                    const replyNeeded = awaitingReply(application);
                    const draft = refusing[key];
                    const busy = busyKey === key;
                    const canAct = !['brouillon', 'retiree', 'en_pause'].includes(application.statut);
                    const refusable = ['soumise', 'en_examen', 'entretien_programme', 'entretien_effectue'].includes(application.statut);
                    const flag = application.statut === 'soumise' ? 'À prendre en charge' : (replyNeeded ? 'À répondre' : (application.statut === 'entretien_effectue' ? 'Décision à rendre' : null));
                    return (
                        <div key={key} className={`cctv-card ${isOpen ? 'open' : ''}`} style={{ '--c': colorOf(application.statut) }}>
                            <button type="button" className="cctv-card-head" onClick={() => setOpenId(isOpen && shown.length > 1 ? null : key)}>
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
                                                <span className="rec-interview">
                                                    <input
                                                        type="datetime-local" className="rec-datetime" aria-label="Date et heure de l'entretien"
                                                        value={interviewInputs[key] || ''} onChange={(e) => setInterviewInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                                                    />
                                                    <Button size="sm" variant="outline-primary" disabled={busy || !interviewInputs[key]} onClick={() => handleScheduleInterview(application)}>
                                                        Planifier un entretien
                                                    </Button>
                                                </span>
                                            )}
                                            {application.statut === 'entretien_programme' && (
                                                <Button size="sm" variant="info" disabled={busy} onClick={() => handleMarkInterviewCompleted(application)}>Marquer l'entretien effectué</Button>
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
                                                    title="Rôle facultatif : donne au candidat accès à son contrat et à la création de sa signature">
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
