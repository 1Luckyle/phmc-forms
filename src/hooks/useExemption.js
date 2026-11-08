// src/hooks/useExemption.js
//
// Exemption de paiement dans les dossiers médicaux facturés (3 et 25). `reason` dit pourquoi le formulaire est (ou peut être) exempté :
//   • 'flag'   : une exemption est enregistrée sur l'ID patient (utils/exemptions.js) ;
//   • 'mineur' : le patient est mineur d'après sa date de naissance (exempté pour ce rapport, sans drapeau posé) ;
//   • null     : rien ne l'établit : cocher « exempté » à la main crée alors une DEMANDE au personnel administratif (exemptSource = 'demande').
// Quand `reason` existe, la case « exempté » est cochée d'office ; la personne peut revenir à « payer » (exemptOptOut).
import { useEffect, useState } from 'react';
import { loadExemption, isValidPatientId } from '../utils/exemptions';
import { canonicalPatientId } from '../utils/patientId';
import { isMinorPatient, ageOn, MAJORITY_AGE } from '../utils/minors';

const isTrue = (value) => value === true || value === 'true';

const useExemption = (formData, setFormData) => {
    const id = canonicalPatientId(formData?.patientID);
    const [flag, setFlag] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setFlag(null);
        if (!isValidPatientId(id)) return undefined;
        const timer = setTimeout(() => { loadExemption(id).then((found) => { if (!cancelled) setFlag(found); }); }, 350);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [id]);

    const isMinor = isMinorPatient({ birthDate: formData?.patientDateOfBirth, titleIsMinor: formData?.patientTitle === 'Mineur' });
    // Une exemption « mineur » ne vaut plus dès que la date de naissance du formulaire indique un adulte (le drapeau n'a pas encore été retiré à la connexion).
    const formAge = ageOn(formData?.patientDateOfBirth);
    const outgrown = flag?.source === 'mineur' && formAge !== null && formAge >= MAJORITY_AGE;
    const reason = flag && !outgrown ? 'flag' : (isMinor ? 'mineur' : null);

    useEffect(() => {
        if (!setFormData) return;
        setFormData((prev) => {
            const on = isTrue(prev.isExempt);
            if (reason) {
                if (prev.exemptOptOut) return prev;
                if (on && prev.exemptSource === reason) return prev;
                return { ...prev, isExempt: true, payNow: false, exemptSource: reason, fleecaPaymentId: null, paymentProofPhotos: '' };
            }
            // Plus rien n'établit l'exemption (autre ID, date corrigée) : on retire celle qui avait été posée automatiquement.
            if (on && (prev.exemptSource === 'flag' || prev.exemptSource === 'mineur')) return { ...prev, isExempt: false, exemptSource: null };
            return prev;
        });
    }, [reason, setFormData]);

    return { flag, isMinor, reason, outgrown };
};

export default useExemption;
