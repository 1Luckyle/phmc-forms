// src/components/ViewAsBanner.js
//
// Bandeau collant affiché tant qu'un administrateur « visualise en tant que » un autre profil
// (panneau admin → Debug). Il rappelle que l'affichage est simulé et permet d'en sortir d'un clic.
import React from 'react';
import { Button } from 'react-bootstrap';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { describeViewAs } from '../utils/viewAs';

const ViewAsBanner = () => {
    const { viewAs, setViewAs } = useEmployeeAuth();
    if (!viewAs) return null;

    return (
        <div
            role="status"
            style={{
                position: 'sticky', top: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '12px', flexWrap: 'wrap', padding: '8px 16px', background: '#bf8700', color: '#fff', fontWeight: 600,
            }}
        >
            <span>
                <i className="fas fa-eye me-2"></i>
                Vous visualisez le site en tant que : <u>{describeViewAs(viewAs)}</u>
            </span>
            <small style={{ fontWeight: 400 }}>
                Affichage simulé : vos droits Firebase restent ceux d'un admin, et l'enregistrement de rapports est désactivé.
            </small>
            <Button size="sm" variant="light" onClick={() => setViewAs(null)}>
                <i className="fas fa-times me-1"></i>Quitter la simulation
            </Button>
        </div>
    );
};

export default ViewAsBanner;
