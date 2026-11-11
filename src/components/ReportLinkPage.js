// src/components/ReportLinkPage.js
//
// Page ouverte par un LIEN DIRECT vers un rapport (#/rapport/{nœud}/{clé}, voir utils/reportLinks.js) :
//   • pas connecté      : invitation à se connecter ; le lien est mémorisé et se rouvre tout seul une fois connecté (MainApp) ;
//   • pas les accès     : message clair (la base refuse la lecture : c'est elle qui décide, pas le navigateur) ;
//   • rapport introuvable ou supprimé : message ;
//   • sinon             : le rapport (aperçu) avec les actions habituelles (copier, PDF, image, ordonnance seule).
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Dropdown, Spinner } from 'react-bootstrap';
import { ref, get } from 'firebase/database';
import { database, auth } from '../firebase';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { useNotification } from '../contexts/NotificationContext';
import { ReportPreviewFrame } from './ReportExpansion';
import { PrescriptionMenuSection } from './PrescriptionMenu';
import { copyToClipboard } from './notificationService';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../utils/reportDocumentExport';
import { downloadBbCodeAsHtml } from '../utils/reportExport';
import { reportLinkUrl, reportPathFromParams, rememberPendingReportLink } from '../utils/reportLinks';
import { prescriptionOfReport } from '../phmc-bbcode-generators/generatePrescription';

const box = { maxWidth: 980, margin: '0 auto', padding: '24px 16px', color: '#e6edf3' };
const card = { border: '1px solid #30363d', borderRadius: 8, padding: '18px 20px', background: '#0d1117' };

const Message = ({ icon, title, children, actions }) => (
    <div style={box}>
        <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}><i className={`fas ${icon}`}></i></div>
            <h4 style={{ marginBottom: 8 }}>{title}</h4>
            <div style={{ color: '#9aa7b4', marginBottom: 14 }}>{children}</div>
            <div className="d-flex justify-content-center gap-2 flex-wrap">{actions}</div>
        </div>
    </div>
);

const ReportLinkPage = () => {
    const { node, key } = useParams();
    const navigate = useNavigate();
    const { isLoading, currentEmployee, civilianProfile } = useEmployeeAuth();
    const { bbcodeEnabled } = useSiteConfig();
    const notification = useNotification();
    const showNotification = (notification && notification.showNotification) || (() => {});
    const [state, setState] = useState({ status: 'loading' });
    const path = reportPathFromParams(node, key);
    const loggedIn = !!(currentEmployee || civilianProfile || auth.currentUser);
    const linkPath = `/rapport/${encodeURIComponent(node || '')}/${encodeURIComponent(key || '')}`;

    useEffect(() => {
        if (isLoading) return undefined;
        if (!path) { setState({ status: 'invalid' }); return undefined; }
        if (!loggedIn) {
            // Une fois connecté, MainApp ramène ici tout seul.
            rememberPendingReportLink(linkPath);
            setState({ status: 'login' });
            return undefined;
        }
        let cancelled = false;
        setState({ status: 'loading' });
        get(ref(database, path)).then((snap) => {
            if (cancelled) return;
            const report = snap.exists() ? snap.val() : null;
            setState(!report || report.ownerDeleted ? { status: 'missing' } : { status: 'ok', report });
        }).catch((error) => {
            if (cancelled) return;
            const denied = /permission[_ ]denied/i.test(`${error && error.code} ${error && error.message}`);
            setState({ status: denied ? 'denied' : 'error', message: error && error.message });
        });
        return () => { cancelled = true; };
    }, [isLoading, loggedIn, path, linkPath]);

    const goHome = <Button key="home" variant="secondary" onClick={() => navigate('/')}><i className="fas fa-house me-1"></i>Accueil</Button>;

    if (isLoading || state.status === 'loading') {
        return <Message icon="fa-link" title="Ouverture du rapport…"><Spinner animation="border" size="sm" /></Message>;
    }
    if (state.status === 'invalid') return <Message icon="fa-link-slash" title="Lien invalide" actions={[goHome]}>Ce lien ne désigne aucun rapport.</Message>;
    if (state.status === 'login') {
        return (
            <Message
                icon="fa-lock" title="Connexion requise"
                actions={[<Button key="login" variant="primary" onClick={() => navigate('/')}><i className="fas fa-right-to-bracket me-1"></i>Se connecter</Button>]}
            >
                Connectez-vous pour ouvrir ce rapport. Une fois connecté(e), vous y serez ramené(e) automatiquement.
            </Message>
        );
    }
    if (state.status === 'denied') {
        return <Message icon="fa-ban" title="Vous n'avez pas accès à ce rapport" actions={[goHome]}>Ce rapport est réservé à son auteur et aux personnes habilitées. Si vous pensez devoir y avoir accès, demandez à la personne qui vous a envoyé le lien de vous le partager depuis le dossier du patient.</Message>;
    }
    if (state.status === 'missing') return <Message icon="fa-file-circle-xmark" title="Rapport introuvable" actions={[goHome]}>Ce rapport n'existe plus : il a été supprimé ou retiré par son auteur.</Message>;
    if (state.status === 'error') return <Message icon="fa-triangle-exclamation" title="Ouverture impossible" actions={[goHome]}>{state.message || "Une erreur est survenue pendant l'ouverture du rapport."}</Message>;

    const { report } = state;
    const title = report.title || report.originalKey || 'Rapport';
    const bbCode = report.bbCode || '';
    const prescription = prescriptionOfReport(report);
    const meta = [report.creatorName || report.authorName, report.timestamp ? new Date(report.timestamp).toLocaleString() : ''].filter(Boolean).join(' · ');
    return (
        <div style={box}>
            <div style={card}>
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                    <div>
                        <h4 style={{ marginBottom: 4, overflowWrap: 'anywhere' }}>{title}</h4>
                        <div style={{ color: '#9aa7b4', fontSize: '0.85rem' }}>{meta}</div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        {goHome}
                        <Button variant="outline-info" onClick={() => copyToClipboard(reportLinkUrl(path), showNotification, 'Lien copié !')}><i className="fas fa-link me-1"></i>Copier le lien</Button>
                        <Dropdown className="d-inline-block">
                            <Dropdown.Toggle variant="secondary">Copier</Dropdown.Toggle>
                            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                {bbcodeEnabled && <Dropdown.Item onClick={() => copyToClipboard(bbCode, showNotification, 'BBCode copié !')} disabled={!bbCode}>Copier le BBCode</Dropdown.Item>}
                                <Dropdown.Item onClick={() => downloadBbCodeAsHtml({ bbCode, title, showNotification })} disabled={!bbCode}>Télécharger le HTML</Dropdown.Item>
                                <Dropdown.Item onClick={() => exportReportDocument('pdf', { bbCode, title, showNotification })} disabled={!bbCode}>{PDF_EXPORT_LABEL}</Dropdown.Item>
                                <Dropdown.Item onClick={() => exportReportDocument('png', { bbCode, title, showNotification })} disabled={!bbCode}>Télécharger l'image (PNG, pour Discord)</Dropdown.Item>
                                <Dropdown.Item onClick={() => exportReportDocument('png-copy', { bbCode, title, showNotification })} disabled={!bbCode}>Copier l'image (à coller dans Discord)</Dropdown.Item>
                                <Dropdown.Item onClick={() => copyToClipboard(title, showNotification, 'Titre copié !')}>Copier le titre</Dropdown.Item>
                                <PrescriptionMenuSection prescription={prescription} showNotification={showNotification} />
                            </Dropdown.Menu>
                        </Dropdown>
                    </div>
                </div>
                {bbCode ? <ReportPreviewFrame bbCode={bbCode} title={title} height={640} /> : <div style={{ color: '#9aa7b4' }}>Ce rapport n'a pas d'aperçu.</div>}
            </div>
        </div>
    );
};

export default ReportLinkPage;
