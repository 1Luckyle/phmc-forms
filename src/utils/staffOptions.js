// src/utils/staffOptions.js
//
// Option de liste du personnel PHMC (sélecteurs « Identifiants de l'employé », chirurgien, personnel présent…) construite à partir de sa fiche. UNE seule construction pour la liste restreinte (l'employé
// connecté ne choisit que lui-même) et la liste non restreinte (soignants à désigner) : les deux portent les mêmes champs, dont les RÔLES (rôle principal + rôles cumulés, ex. « Médecin Titulaire » + « Chirurgien(ne) »)
// et les familles (soignant, administration…). Un sélecteur qui filtre par rôle (chirurgien principal) s'appuie dessus.
import { familiesOfMember, extraRanksOf } from '../constants/ranks';

export const phmcOptionOf = (employee) => ({
    value: employee.name,
    label: employee.name,
    category: employee.category,
    rank: employee.category || employee.rank || '',
    lastName: employee.lastName,
    roles: [employee.category || employee.rank, ...extraRanksOf(employee)].filter(Boolean),
    families: familiesOfMember(employee, 'phmc'),
});
