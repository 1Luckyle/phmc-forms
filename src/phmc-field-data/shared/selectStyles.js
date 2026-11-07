// src/phmc-field-data/shared/selectStyles.js
//
// Style sombre commun aux listes déroulantes à choix (react-select) des formulaires de dossier patient. La flèche de déroulement reste visible.
export const darkSelectStyles = {
    control: (base, state) => ({
        ...base, minHeight: '38px', backgroundColor: '#16202c', color: '#eeeeeeb0', borderColor: state.isFocused ? '#58a6ff' : '#30363d',
        boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(88, 166, 255, 0.25)' : 'none', '&:hover': { borderColor: '#58a6ff' },
    }),
    menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000, border: '1px solid #30363d' }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#30363d' : '#16202c', color: '#eeeeeeb0', cursor: 'pointer' }),
    singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
    multiValue: (base) => ({ ...base, backgroundColor: '#30363d' }),
    multiValueLabel: (base) => ({ ...base, color: '#eeeeeeb0' }),
    multiValueRemove: (base) => ({ ...base, color: '#9aa7b4', '&:hover': { backgroundColor: '#dc3545', color: '#fff' } }),
    input: (base) => ({ ...base, color: '#eeeeeeb0' }),
    placeholder: (base) => ({ ...base, color: '#9aa7b4' }),
    // Flèche de déroulement toujours bien visible, même quand on peut écrire dans la liste.
    dropdownIndicator: (base) => ({ ...base, color: '#aab6c3', '&:hover': { color: '#e6edf3' } }),
    indicatorSeparator: (base) => ({ ...base, backgroundColor: '#30363d' }),
    clearIndicator: (base) => ({ ...base, color: '#9aa7b4', '&:hover': { color: '#e6edf3' } }),
};
