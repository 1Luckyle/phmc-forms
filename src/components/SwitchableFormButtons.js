import React from 'react';
import { Button } from 'react-bootstrap';

const SwitchableFormButtons = ({ bbCodeVersion, openSwitchableModal, formGroups }) => {
    const {
        coronerFormsSubGroup,
        physicalEvalFormsSubGroup,
        psychEvalFormsSubGroup,
        generalConsultFormsSubGroup,
        commentaryNoteFormsSubGroup,
        mentalHealthFormsSubGroup,
        civilianFormsSubGroup,
        phmcInternalEmails
    } = formGroups;

    const switchableFormButtonConfig = [
        { versions: [1, 2, 4, 8, 11, 37], text: "Changer de Formulaire DMEC", icon: "fa fa-laptop", modalArgs: ["Formulaires DMEC", coronerFormsSubGroup] },
        { versions: [6, 7], text: "Changer de Formulaire d'Évaluation Physique", icon: "fas fa-exchange-alt", modalArgs: ["Formulaires d'Évaluation Physique", physicalEvalFormsSubGroup] },
        { versions: [28, 29], text: "Changer de Formulaire d'Évaluation Psychologique", icon: "fas fa-exchange-alt", modalArgs: ["Formulaires d'Évaluation Psychologique", psychEvalFormsSubGroup] },
        { versions: [20, 21], text: "Changer de Formulaire de Consultation Générale", icon: "fas fa-exchange-alt", modalArgs: ["Formulaires de Consultation Générale", generalConsultFormsSubGroup] },
        { versions: [22, 23], text: "Changer de Formulaire de Note de Commentaire", icon: "fas fa-exchange-alt", modalArgs: ["Formulaires de Note de Commentaire", commentaryNoteFormsSubGroup] },
        { versions: [14, 16], text: "Changer de Formulaire de Santé Mentale", icon: "fas fa-exchange-alt", modalArgs: ["Formulaires de Santé Mentale", mentalHealthFormsSubGroup] },
        { versions: [3, 24, 25, 26], text: "Changer de Formulaire Civil", icon: "fas fa-exchange-alt", modalArgs: ["Formulaires Civil", civilianFormsSubGroup] },
        { versions: [27, 35], text: "Changer de Formulaire d'Email", icon: "fas fa-exchange-alt", modalArgs: ["Formulaires d'Email", phmcInternalEmails] },
    ];

    const switchableButton = switchableFormButtonConfig.find(config => config.versions.includes(bbCodeVersion));

    if (!switchableButton) {
        return null;
    }

    return (
        <Button
            className="changelog-button"
            variant='secondary'
            onClick={() => openSwitchableModal(...switchableButton.modalArgs)}
        >
            <i className={switchableButton.icon}></i>
            <span> {switchableButton.text}</span>
        </Button>
    );
};

export default SwitchableFormButtons;