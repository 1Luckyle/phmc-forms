// src/hooks/useBillingRole.js
//
// Qui paie les dossiers médicaux civils (24, 25, 3, 26) ? Règles :
//   • un Civil remplit son propre dossier et le paie ;
//   • le personnel SOIGNANT peut en créer pour ses patients (le patient reçoit la facture) ou pour lui-même : il ne paie
//     que si l'ID patient du formulaire est le SIEN ;
//   • tout autre personnel (administration, polyvalent, DMEC) ne les remplit que pour LUI-MÊME, et paie (son ID patient
//     est pré-rempli ; l'enregistrement refuse un autre ID — voir useReportManagement).
// `filledByStaff` = le formulaire est rempli par le personnel pour un AUTRE patient (affichage « montant à payer par le
// patient » et facture à son nom) ; sinon la personne est son propre patient et voit le paiement comme un Civil.
import { useEffect } from 'react';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { canonicalPatientId } from '../utils/patientId';
import { familiesOfMember } from '../constants/ranks';

export const isCareStaff = (staffProfile) => !!staffProfile && familiesOfMember(staffProfile, staffProfile.type).includes('soignant');

const useBillingRole = (formData, setFormData) => {
    const { currentEmployee, employeeProfile, isAdmin, staffProfile, myPatientID } = useEmployeeAuth();
    const isStaff = isAdmin || !!(currentEmployee && employeeProfile);
    const own = canonicalPatientId(myPatientID);
    const target = canonicalPatientId(formData?.patientID);
    const forSelf = isStaff && !!own && !!target && own === target;
    const care = isCareStaff(staffProfile);
    // Personnel non soignant (hors admin) : uniquement pour lui-même.
    const selfOnly = isStaff && !isAdmin && !care;

    useEffect(() => {
        if (selfOnly && own && !formData?.patientID && setFormData) {
            setFormData((prev) => (prev.patientID ? prev : { ...prev, patientID: myPatientID }));
        }
    }, [selfOnly, own, formData?.patientID, myPatientID, setFormData]);

    return { isStaff, forSelf, selfOnly, isCare: care, filledByStaff: isStaff && !forSelf };
};

export default useBillingRole;
