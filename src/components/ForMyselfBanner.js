// src/components/ForMyselfBanner.js
//
// En haut des formulaires de dossier médical civil, pour le PERSONNEL (soignant, admin avec fiche…) qui remplit son PROPRE dossier : le bouton
// « C'est pour moi » reprend son ID patient (PHMC-{ID employé}) et son identité depuis sa fiche du personnel. Une fois l'ID celui de la personne
// connectée, le formulaire la traite comme un patient (paiement à sa charge, comme un Civil) : un bandeau le rappelle.
// Date de naissance et genre viennent aussi de la fiche (Mon profil) ; s'ils n'y sont pas, ils restent à saisir.
import React, { useMemo } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { canonicalPatientId } from '../utils/patientId';
import { getEmployeeDisplayName, getEmployeeFullName } from '../utils/employeeName';

// `fields` : { champ du formulaire: clé d'identité } parmi patientID, firstName, middleName, lastName, fullName, address, zip, dateOfBirth, gender, phone, email, discord.
const ForMyselfBanner = ({ formData, setFormData, fields }) => {
    const { isCivilian, staffProfile, currentEmployee, myPatientID } = useEmployeeAuth();

    const identity = useMemo(() => {
        if (!staffProfile) return null;
        const display = getEmployeeDisplayName(staffProfile, '');
        const firstName = staffProfile.firstName || display.split(' ')[0] || '';
        const lastName = staffProfile.lastName || display.split(' ').slice(1).join(' ');
        return {
            patientID: myPatientID,
            firstName,
            middleName: staffProfile.middleName || '',
            lastName,
            fullName: getEmployeeFullName(staffProfile, display),
            address: staffProfile.address || '',
            zip: staffProfile.zip || '',
            dateOfBirth: staffProfile.dateOfBirth || '',
            gender: staffProfile.gender || '',
            phone: staffProfile.phNumber || '',
            email: staffProfile.email || currentEmployee?.email || '',
            discord: staffProfile.discord || '',
        };
    }, [staffProfile, currentEmployee, myPatientID]);

    if (isCivilian || !identity || !canonicalPatientId(myPatientID)) return null;

    const missingBirth = !identity.dateOfBirth || !identity.gender;
    const isForMe = canonicalPatientId(formData?.patientID) === canonicalPatientId(myPatientID);

    // Remplace les champs d'identité par ceux de la fiche (action volontaire : on écrase), sans jamais vider un champ si la fiche n'a pas la valeur.
    const fillForMe = () => setFormData((prev) => {
        const next = { ...prev };
        Object.entries(fields).forEach(([formField, key]) => { if (identity[key]) next[formField] = identity[key]; });
        return next;
    });

    return (
        <div className="mb-3">
            {isForMe ? (
                <Alert variant="info" className="py-2 mb-0 small">
                    <i className="fas fa-user-check me-2"></i>
                    <strong>Dossier pour vous-même :</strong> paiement à votre charge. Si vous enregistrez sans avoir payé, une facture à votre nom est créée (rappels par mail).
                </Alert>
            ) : (
                <div className="d-flex flex-wrap align-items-center gap-2">
                    <Button size="sm" variant="outline-info" onClick={fillForMe}>
                        <i className="fas fa-user me-1"></i>C'est pour moi
                    </Button>
                    <span className="helper-text mb-0">Remplit votre ID patient et votre identité depuis votre fiche du personnel.{missingBirth ? ' Date de naissance ou genre manquants : complétez-les dans « Mon profil » pour qu\'ils soient repris la prochaine fois.' : ''}</span>
                </div>
            )}
        </div>
    );
};

export default ForMyselfBanner;
