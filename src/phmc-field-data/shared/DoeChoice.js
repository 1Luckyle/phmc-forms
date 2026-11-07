// src/phmc-field-data/shared/DoeChoice.js
//
// Cases « John Doe », « Jane Doe » (défunt non identifié) et, si demandé, « Tuerie/accident de masse » : elles se cochent ET se décochent, et l'état de
// John / Jane Doe se lit directement dans le nom saisi : dès que le prénom ou le nom diffère de « John Doe » / « Jane Doe », la case se décoche toute seule.
// `fields` : { full, first, middle, last } = noms des champs du défunt.
import React from 'react';
import { Form } from 'react-bootstrap';

const isDoe = (formData, fields, first) => (
    String(formData[fields.first] || '').trim() === first && String(formData[fields.last] || '').trim() === 'Doe' && !String(formData[fields.middle] || '').trim()
);

const DoeChoice = ({ formData, setFormData, fields, showMassFatality = false, onMassFatalityChange }) => {
    const john = isDoe(formData, fields, 'John');
    const jane = isDoe(formData, fields, 'Jane');
    const mass = formData.massFatality === true || formData.massFatality === 'true';

    const toggle = (first, checked) => setFormData((prev) => ({
        ...prev,
        [fields.first]: checked ? first : '',
        [fields.middle]: '',
        [fields.last]: checked ? 'Doe' : '',
        [fields.full]: checked ? `${first} Doe` : '',
        ...(checked ? { massFatality: false } : {}),
    }));

    return (
        <div className="radio-inline-container">
            <div className="radio-button-group">
                <Form.Check type="checkbox" id="johnDoe" label="   John Doe" checked={john} onChange={(e) => toggle('John', e.target.checked)} inline />
                <Form.Check type="checkbox" id="janeDoe" label="   Jane Doe" checked={jane} onChange={(e) => toggle('Jane', e.target.checked)} inline />
                {showMassFatality && (
                    <Form.Check
                        type="checkbox" id="massFatality" name="massFatality" label="   Tuerie/accident de masse" checked={mass} inline
                        onChange={(e) => (onMassFatalityChange ? onMassFatalityChange(e) : setFormData((prev) => ({ ...prev, massFatality: e.target.checked })))}
                    />
                )}
            </div>
        </div>
    );
};

export default DoeChoice;
