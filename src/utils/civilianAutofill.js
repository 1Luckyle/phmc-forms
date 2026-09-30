// src/utils/civilianAutofill.js
//
// Pré-remplissage des formulaires civils à partir du profil Civil connecté
// (civilianProfile, voir EmployeeAuthContext.js) — identité/contact
// uniquement, JAMAIS de champ de santé (le profil Civil n'en contient pas).
// Chaque formulaire nomme ses champs différemment (patientName combiné vs
// patientFirstName/patientLastName séparés, date vs patientDateOfBirth...),
// donc ce module se contente de normaliser les valeurs disponibles ; c'est à
// chaque field-data component de les mapper vers ses propres noms de champs.

export const buildCivilianAutofillValues = (civilianProfile) => {
    if (!civilianProfile) return null;

    const fullName = [civilianProfile.firstName, civilianProfile.middleName, civilianProfile.lastName]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        firstName: civilianProfile.firstName || '',
        middleName: civilianProfile.middleName || '',
        lastName: civilianProfile.lastName || '',
        fullName,
        patientID: civilianProfile.patientID || '',
        dateOfBirth: civilianProfile.dateOfBirth || '',
        gender: civilianProfile.gender || '',
        address: civilianProfile.address || '',
        zip: civilianProfile.zip || '',
        phone: civilianProfile.phone || '',
        email: civilianProfile.email || '',
        discord: civilianProfile.discord || '',
    };
};

// Applique civilianAutofillValues sur formData en ne touchant QUE les champs
// vides (on ne veut jamais écraser une saisie déjà faite par l'utilisateur,
// ni par un membre du personnel remplissant le formulaire pour le civil).
// fieldMap : { formFieldName: autofillKey } — ex. { patientName: 'fullName' }.
export const applyCivilianAutofill = (prevFormData, autofillValues, fieldMap) => {
    if (!autofillValues) return prevFormData;

    let changed = false;
    const next = { ...prevFormData };

    for (const [formField, autofillKey] of Object.entries(fieldMap)) {
        const value = autofillValues[autofillKey];
        if (value && !next[formField]) {
            next[formField] = value;
            changed = true;
        }
    }

    return changed ? next : prevFormData;
};
