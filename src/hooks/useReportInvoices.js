// src/hooks/useReportInvoices.js
//
// État de paiement des rapports affichés dans une liste (Rapports enregistrés, Dossier Patient) : charge
// les factures des patients concernés (une lecture par patient, uniquement pour les formulaires facturés)
// et retourne invoiceOf(rapport) → facture résolue ({ statutEffectif, montant, … }) ou null.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadInvoiceIndex } from '../utils/patientInvoices';
import { isBillableVersion } from '../utils/patientBilling';
import { canonicalPatientId } from '../utils/patientId';

// refreshToken : à incrémenter pour recharger les factures (bouton « Actualiser »).
const useReportInvoices = (reports, enabled = true, refreshToken = 0) => {
    const [byPatient, setByPatient] = useState({});

    // Clé stable des patients à charger (évite de relancer l'effet à chaque rendu).
    const patientKey = useMemo(() => {
        if (!enabled) return '';
        const ids = new Set();
        (reports || []).forEach((report) => {
            if (report?.patientID && isBillableVersion(report.bbCodeVersion)) ids.add(canonicalPatientId(report.patientID));
        });
        return [...ids].sort().join('|');
    }, [reports, enabled]);

    useEffect(() => {
        const ids = patientKey.split('|').filter(Boolean);
        if (ids.length === 0) return undefined;
        let cancelled = false;
        ids.forEach(async (id) => {
            try {
                const index = await loadInvoiceIndex(id);
                if (!cancelled) setByPatient((prev) => ({ ...prev, [id]: index }));
            } catch (error) {
                console.warn('Could not load invoices of', id, error);
            }
        });
        return () => { cancelled = true; };
    }, [patientKey, refreshToken]);

    const invoiceOf = useCallback((report) => {
        if (!report?.patientID || !isBillableVersion(report.bbCodeVersion)) return null;
        const key = report.key || report.indexKey;
        return byPatient[canonicalPatientId(report.patientID)]?.[key] || null;
    }, [byPatient]);

    return { invoiceOf };
};

export default useReportInvoices;
