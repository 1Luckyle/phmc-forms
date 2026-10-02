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
