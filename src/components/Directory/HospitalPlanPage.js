// src/components/Directory/HospitalPlanPage.js
//
// Page publique « Plan de l'hôpital » (#/plan), sans connexion : même contenu que l'onglet « Plan de l'hôpital » de la Boîte à outils.
import React from 'react';
import { Link } from 'react-router-dom';
import HospitalPlan from './HospitalPlan';
import '../Transparency/Transparency.css';

const HospitalPlanPage = () => (
    <div className="tp-page">
        <div className="tp-wrap">
            <Link to="/" className="tp-back"><i className="fas fa-arrow-left me-2"></i>Retour au site</Link>
            <h1><i className="fas fa-map me-2"></i>Plan de l'hôpital</h1>
            <p className="tp-intro">
                Pillbox Hill Medical Center : développez un étage pour voir ses services et ses pièces, et savoir où l'on peut entrer librement, sur consultation, ou pas du tout.
            </p>
            <HospitalPlan />
        </div>
    </div>
);

export default HospitalPlanPage;
