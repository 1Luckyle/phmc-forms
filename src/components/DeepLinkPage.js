// src/components/DeepLinkPage.js
//
// Porte d'entrée des liens directs vers un message, un poste ou une candidature (voir utils/deepLinks.js) :
//   • lien invalide     : message clair ;
//   • pas connecté      : invitation à se connecter ; le lien est mémorisé et se rouvre tout seul une fois connecté (MainApp) ;
//   • connecté          : retour à l'accueil, où MainApp ouvre la bonne fenêtre (état de navigation `deepLink`). Les droits sont
//                         vérifiés là-bas et par les règles Firebase : un lien n'ouvre jamais plus que ce que la personne peut déjà voir.
import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Spinner } from 'react-bootstrap';
import { auth } from '../firebase';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { parseDeepLink, deepLinkPathOf, DEEP_LINK_LABELS } from '../utils/deepLinks';
import { rememberPendingReportLink } from '../utils/reportLinks';

const box = { maxWidth: 980, margin: '0 auto', padding: '24px 16px', color: '#e6edf3' };
const card = { border: '1px solid #30363d', borderRadius: 8, padding: '18px 20px', background: '#0d1117', textAlign: 'center' };

const Message = ({ icon, title, children, actions }) => (
    <div style={box}>
        <div style={card}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}><i className={`fas ${icon}`}></i></div>
            <h4 style={{ marginBottom: 8 }}>{title}</h4>
            <div style={{ color: '#9aa7b4', marginBottom: 14 }}>{children}</div>
            <div className="d-flex justify-content-center gap-2 flex-wrap">{actions}</div>
        </div>
    </div>
);

const DeepLinkPage = ({ kind }) => {
    const params = useParams();
    const navigate = useNavigate();
    const { isLoading, currentEmployee, civilianProfile } = useEmployeeAuth();
    // Dépendances primitives : useParams() ne garantit pas un objet stable d'un rendu à l'autre.
    const { id: pId, category: pCategory, key: pKey, uid: pUid } = params;
    const target = useMemo(() => parseDeepLink(kind, { id: pId, category: pCategory, key: pKey, uid: pUid }), [kind, pId, pCategory, pKey, pUid]);
    const loggedIn = !!(currentEmployee || civilianProfile || auth.currentUser);

    useEffect(() => {
        if (isLoading || !target) return;
        if (!loggedIn) { rememberPendingReportLink(deepLinkPathOf(target)); return; }
        navigate('/', { replace: true, state: { deepLink: target } });
    }, [isLoading, loggedIn, target, navigate]);

    const goHome = <Button key="home" variant="secondary" onClick={() => navigate('/')}><i className="fas fa-house me-1"></i>Accueil</Button>;
    if (!target) return <Message icon="fa-link-slash" title="Lien invalide" actions={[goHome]}>Ce lien ne désigne rien que le site sache ouvrir.</Message>;
    if (isLoading || loggedIn) return <Message icon="fa-link" title="Ouverture du lien…"><Spinner animation="border" size="sm" /></Message>;
    return (
        <Message
            icon="fa-lock" title="Connexion requise"
            actions={[<Button key="login" variant="primary" onClick={() => navigate('/')}><i className="fas fa-right-to-bracket me-1"></i>Se connecter</Button>]}
        >
            Connectez-vous pour ouvrir {DEEP_LINK_LABELS[target.cible] || 'ce lien'}. Une fois connecté(e), vous y serez ramené(e) automatiquement.
        </Message>
    );
};

export default DeepLinkPage;
