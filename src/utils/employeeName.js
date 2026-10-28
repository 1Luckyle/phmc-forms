// Nom d'affichage d'un employé, sans doublon du nom de famille.
//
// Les fiches PHMC existent sous trois formes :
// - récente : firstName + lastName (+ name = nom complet)
// - ancienne : name = prénom seul, lastName séparé
// - erronée : name = nom complet ET lastName renseigné, sans firstName
//   (créée avant la correction d'EmployeeModal) — d'où "Valmont Valmont".
export const getEmployeeDisplayName = (employee, fallback = '') => {
    if (!employee) return fallback;
    const { firstName, lastName, name } = employee;
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (name && lastName) {
        return name.trim().toLowerCase().endsWith(lastName.trim().toLowerCase())
            ? name
            : `${name} ${lastName}`;
    }
    return name || fallback;
};

// Nom complet avec le deuxième prénom (affichage seulement : l'identifiant d'une fiche reste « prénom nom »).
export const getEmployeeFullName = (employee, fallback = '') => {
    const base = getEmployeeDisplayName(employee, fallback);
    const middle = (employee?.middleName || '').trim();
    if (!middle || !base) return base;
    const first = (employee.firstName || '').trim();
    if (first && base.toLowerCase().startsWith(first.toLowerCase())) return `${first} ${middle}${base.slice(first.length)}`;
    return `${middle} ${base}`;
};
