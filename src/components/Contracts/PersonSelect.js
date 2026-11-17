// src/components/Contracts/PersonSelect.js
//
// Liste à cliquer pour désigner des membres du personnel dans un document (responsable hiérarchique, personne qui mène un entretien, personnel présent) : on tape pour filtrer, on clique sur la
// bonne personne. Les options sont rangées par service (PHMC, DMEC). Une valeur déjà enregistrée qui n'est pas dans la liste (ancien texte libre, personne qui a quitté le personnel)
// reste affichée telle quelle. Valeur : un texte (une personne) ou une liste de textes (plusieurs).
import React, { useMemo } from 'react';
import Select from 'react-select';
import { darkSelectStyles } from '../../phmc-field-data/shared/selectStyles';
import { STAFF_SERVICES, rankLabel } from '../../utils/staffAdmin';

const styles = { ...darkSelectStyles, menuPortal: (base) => ({ ...base, zIndex: 19999 }) };

/**
 * Options rangées par service à partir du personnel : [{ label: 'PHMC', options: [{ value, label }] }].
 * withRole : la valeur enregistrée est « Nom — Grade » (sinon le nom seul) ; exclude : valeurs à ne pas proposer (la personne concernée par le document…).
 */
export const personGroups = (staff, { withRole = false, exclude = [] } = {}) => {
    const taken = new Set(exclude);
    const seen = new Set();
    const groups = {};
    (staff || []).filter((member) => member && member.kind === 'staff' && member.displayName).forEach((member) => {
        const grade = rankLabel(member.service, member.rank || member.category);
        const value = withRole && grade ? `${member.displayName} — ${grade}` : member.displayName;
        if (taken.has(value) || taken.has(member.displayName) || seen.has(value)) return;
        seen.add(value);
        (groups[member.service] = groups[member.service] || []).push({ value, label: `${member.displayName}${grade ? ` (${grade})` : ''}` });
    });
    return Object.entries(groups).map(([serviceKey, options]) => ({ label: (STAFF_SERVICES[serviceKey] || {}).label || serviceKey, options }));
};

const PersonSelect = ({ name, groups, value, onChange, multiple = false, placeholder, disabled = false }) => {
    const flat = useMemo(() => groups.flatMap((group) => group.options), [groups]);
    const optionOf = (text) => flat.find((option) => option.value === text) || { value: text, label: text };
    const selected = multiple
        ? (Array.isArray(value) ? value : []).map(optionOf)
        : (value ? optionOf(value) : null);

    return (
        <Select
            name={name} isMulti={multiple} isClearable closeMenuOnSelect={!multiple} isDisabled={disabled} options={groups} value={selected}
            onChange={(option) => onChange(multiple ? (option || []).map((item) => item.value) : (option ? option.value : ''))}
            placeholder={placeholder || 'Choisir une personne…'} noOptionsMessage={() => 'Aucune personne trouvée'}
            styles={styles} menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
        />
    );
};

export default PersonSelect;
