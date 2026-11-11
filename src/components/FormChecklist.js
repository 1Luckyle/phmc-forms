// src/components/FormChecklist.js
//
// Encart « À compléter avant d'enregistrer » au bas de TOUS les formulaires : la liste de ce qui manque encore (mêmes contrôles que l'enregistrement, voir utils/formValidation.js).
// Il disparaît tout seul quand il ne reste rien. Les avertissements (cas légitimes mais rares) s'affichent à part, en bleu : ils ne bloquent pas.
import React, { useMemo } from 'react';
import { Alert } from 'react-bootstrap';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { validateReport, validateApplication } from '../utils/formValidation';

const MAX_SHOWN = 8;

const FormChecklist = ({ version, formData, selectOptions }) => {
    const { isCivilian, civilianProfile } = useEmployeeAuth();
    const { errors, warnings } = useMemo(() => {
        const number = Number(version);
        if (number === 999 || !Number.isFinite(number)) return { errors: [], warnings: [] };
        if (number >= 50) return validateApplication(number, formData, { mode: 'submit', selectOptions });
        return validateReport(number, formData, { isCivilian, civilianPatientId: civilianProfile?.patientID });
    }, [version, formData, selectOptions, isCivilian, civilianProfile]);

    if (errors.length === 0 && warnings.length === 0) return null;
    return (
        <div data-no-tip="1" className="form-checklist">
            {errors.length > 0 && (
                <Alert variant="warning" className="py-2 small mb-2">
                    <strong>À compléter avant d'enregistrer :</strong>
                    <ul className="mb-0">
                        {errors.slice(0, MAX_SHOWN).map((problem) => <li key={problem}>{problem}</li>)}
                        {errors.length > MAX_SHOWN && <li>… et {errors.length - MAX_SHOWN} autre(s).</li>}
                    </ul>
                </Alert>
            )}
            {warnings.length > 0 && (
                <Alert variant="info" className="py-2 small mb-2">
                    <strong>À savoir :</strong>
                    <ul className="mb-0">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </Alert>
            )}
        </div>
    );
};

export default FormChecklist;
