// src/components/Auth/AuthEntryBlock.js
//
// Écran d'ENTRÉE unique de la connexion / création de compte du guide de configuration, identique pour les comptes
// Civil / Candidat (CivilianAuthPanel) et pour le Personnel PHMC / DMEC (OnboardingModal) :
//   • un grand bouton « Continuer avec GTA World » (connexion OU création selon le personnage choisi ensuite) ;
//   • d'éventuelles options secondaires passées en `children` (e-mail / mot de passe, quand l'admin les active) ;
//   • le rappel Eyefind Mail.
// Tout changement d'apparence se fait ici, une seule fois.
import React from 'react';
import { EYEFIND_MAIL_SIGNUP_URL } from '../../utils/eyefindMail';

const AuthEntryBlock = ({ onStartGtaw, gtawDescription, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
        <button
            type="button"
            onClick={onStartGtaw}
            style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                backgroundColor: '#2a2a2a', border: '1px solid #ff8c00',
                borderRadius: '8px', padding: '15px', color: '#fff',
                cursor: 'pointer', textAlign: 'left'
            }}
        >
            <i className="fas fa-gamepad" style={{ fontSize: '1.4rem', color: '#ff8c00' }}></i>
            <span>
                <strong style={{ display: 'block' }}>Continuer avec GTA World</strong>
                <span style={{ fontSize: '0.85em', color: '#ccc' }}>{gtawDescription}</span>
            </span>
        </button>
        {children}
        <div style={{ fontSize: '0.85em', color: '#ccc', textAlign: 'center' }}>
            Pas encore d'adresse Eyefind Mail ?{' '}
            <a href={EYEFIND_MAIL_SIGNUP_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff' }}>
                Créez-en une ici
            </a>.
        </div>
    </div>
);

export default AuthEntryBlock;
