// src/components/ForMyselfBanner.js
//
// En haut des formulaires de dossier médical civil (3, 24, 25, 26). Trois situations :
//   • un Civil, ou un membre du personnel NON soignant (qui ne remplit ces dossiers que pour lui-même) : le formulaire est pré-rempli avec son
//     profil, et l'identité (ID patient, nom, prénom, date de naissance, genre, e-mail, téléphone) est VERROUILLÉE : elle ne se modifie que dans
//     le profil (une infobulle l'indique, voir FieldGuide) ;
//   • un soignant ou un admin : le bouton « C'est pour moi » reprend sa propre identité ; et quand il tape l'ID d'un patient déjà connu du site
//     (compte Civil ou fiche du personnel), les champs encore vides se remplissent avec ce que le site sait de lui ;
//   • rien d'autre n'est écrasé : seuls les champs vides sont complétés (sauf ceux verrouillés, qui reflètent toujours le profil).
// `fields` : { champ du formulaire: clé d'identité } parmi patientID, firstName, middleName, lastName, fullName, address, zip, dateOfBirth, gender, phone, email, discord.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import useBillingRole from '../hooks/useBillingRole';
import { canonicalPatientId } from '../utils/patientId';
import { buildCivilianAutofillValues } from '../utils/civilianAutofill';
import { findKnownPatient, staffIdentity } from '../utils/knownPatient';

// Ce qui vient du profil et ne se modifie pas dans le formulaire.
const LOCKED_KEYS = ['patientID', 'firstName', 'middleName', 'lastName', 'fullName', 'dateOfBirth', 'gender', 'email', 'phone'];

// Complète les champs vides (et, pour `forced`, remplace par la valeur du profil). Renvoie le même objet si rien ne change.
const mergeIdentity = (prev, fields, identity, forcedKeys = []) => {
    const next = { ...prev };
    let changed = false;
    Object.entries(fields).forEach(([formField, key]) => {
        const value = identity?.[key];
        if (!value) return;
        const mustMatch = forcedKeys.includes(key);
        if ((mustMatch && next[formField] !== value) || (!mustMatch && !next[formField])) { next[formField] = value; changed = true; }
    });
    return changed ? next : prev;
};

const ForMyselfBanner = ({ formData, setFormData, fields }) => {
    const { isCivilian, civilianProfile, staffProfile, currentEmployee, myPatientID } = useEmployeeAuth();
    const { selfOnly, isCare, isStaff } = useBillingRole(formData, setFormData);
    const anchorRef = useRef(null);
    const [known, setKnown] = useState(null);   // { source, uid, identity } du patient dont l'ID est tapé

    const identity = useMemo(() => {
        if (isCivilian) return buildCivilianAutofillValues(civilianProfile);
        if (!staffProfile) return null;
        return staffIdentity(staffProfile, myPatientID, currentEmployee?.email || '');
    }, [isCivilian, civilianProfile, staffProfile, currentEmployee, myPatientID]);

    const selfMode = !!identity && (isCivilian || selfOnly);
    const lockedFields = useMemo(
        () => (selfMode ? Object.entries(fields).filter(([, key]) => LOCKED_KEYS.includes(key) && identity[key]).map(([field]) => field) : []),
        [selfMode, fields, identity],
    );
    const lockedKeys = useMemo(() => LOCKED_KEYS.filter((key) => selfMode && identity?.[key]), [selfMode, identity]);

    // Verrou : posé sur le formulaire, appliqué champ par champ par FieldGuide (readOnly / désactivé + infobulle).
    const lockSignature = lockedFields.join(',');
    useEffect(() => {
        const zone = anchorRef.current?.closest('[data-form-zone]');
        if (!zone || !lockSignature) return undefined;
        zone.setAttribute('data-self-lock', lockSignature);
        zone.setAttribute('data-self-lock-hint', isCivilian
            ? 'Information tirée de votre profil Civil : elle ne se modifie pas ici (demandez à un administrateur si elle est inexacte).'
            : 'Information tirée de votre profil : pour la modifier, passez par « Mon profil » (menu Outils).');
        return () => { zone.removeAttribute('data-self-lock'); zone.removeAttribute('data-self-lock-hint'); };
    }, [lockSignature, isCivilian]);

    // Soi-même : pré-remplissage automatique, et les champs verrouillés reflètent toujours le profil.
    useEffect(() => {
        if (!selfMode) return;
        setFormData((prev) => mergeIdentity(prev, fields, identity, lockedKeys));
    }, [selfMode, identity, fields, lockedKeys, setFormData, formData?.patientID]);

    // Soignant / admin : un patient déjà connu du site → ses champs vides se remplissent.
    const typedId = canonicalPatientId(formData?.patientID);
    const lookupId = (isCare || (isStaff && !selfOnly)) && typedId !== canonicalPatientId(myPatientID) ? typedId : '';
    useEffect(() => {
        let cancelled = false;
        if (!lookupId) { setKnown(null); return undefined; }
        const timer = setTimeout(() => {
            findKnownPatient(lookupId).then((found) => {
                if (cancelled) return;
                setKnown(found);
                if (found) setFormData((prev) => mergeIdentity(prev, fields, found.identity));
            }).catch(() => { if (!cancelled) setKnown(null); });
        }, 450);
        return () => { cancelled = true; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lookupId]);

    if (selfMode && isCivilian) return <span ref={anchorRef} hidden />;
    if (!identity || !canonicalPatientId(myPatientID)) return <span ref={anchorRef} hidden />;

    const missingBirth = !identity.dateOfBirth || !identity.gender;
    const isForMe = typedId === canonicalPatientId(myPatientID);

    // Remplace les champs d'identité par ceux de la fiche (action volontaire : on écrase), sans jamais vider un champ si la fiche n'a pas la valeur.
    const fillForMe = () => setFormData((prev) => {
        const next = { ...prev };
        Object.entries(fields).forEach(([formField, key]) => { if (identity[key]) next[formField] = identity[key]; });
        return next;
    });

    return (
        <div className="mb-3" ref={anchorRef}>
            {isForMe ? (
                <Alert variant="info" className="py-2 mb-0 small">
                    <i className="fas fa-user-check me-2"></i>
                    <strong>Dossier pour vous-même :</strong> paiement à votre charge. Si vous enregistrez sans avoir payé, une facture à votre nom est créée (rappels par mail).
                    {selfMode && ' Votre identité est reprise de votre profil et ne se modifie pas ici.'}
                </Alert>
            ) : (
                <div className="d-flex flex-wrap align-items-center gap-2">
                    {!selfOnly && (
                        <Button size="sm" variant="outline-info" onClick={fillForMe}>
                            <i className="fas fa-user me-1"></i>C'est pour moi
                        </Button>
                    )}
                    <span className="helper-text mb-0">
                        {known
                            ? `Patient connu du site (${known.source === 'civil' ? 'compte Civil' : 'personnel du PHMC'}) : les champs vides ont été complétés avec son profil.`
                            : `Remplit votre ID patient et votre identité depuis votre fiche du personnel.${missingBirth ? ' Date de naissance ou genre manquants : complétez-les dans « Mon profil » pour qu\'ils soient repris la prochaine fois.' : ''}`}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ForMyselfBanner;
