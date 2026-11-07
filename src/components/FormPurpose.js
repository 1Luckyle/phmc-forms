// src/components/FormPurpose.js
//
// Cadre « À quoi sert ce formulaire ? » affiché en haut de chaque formulaire (texte : constants/formPurposes.js). Rien n'est affiché pour un formulaire sans texte.
import React from 'react';
import { FORM_PURPOSES } from '../constants/formPurposes';

const FormPurpose = ({ version }) => {
    const text = FORM_PURPOSES[Number(version)];
    if (!text) return null;
    return (
        <div className="form-purpose" role="note">
            <i className="fas fa-circle-info" aria-hidden="true"></i>
            <div>
                <strong>À quoi sert ce formulaire ?</strong>
                <p>{text}</p>
            </div>
        </div>
    );
};

export default FormPurpose;
