// src/phmc-field-data/ExternalMail.js
//
// Mail Externe (formulaire 42) : un courrier modèle à envoyer HORS du site, avec les mêmes codes que la messagerie interne (objet, destinataire, expéditeur avec sa fonction et son
// département, texte mis en forme avec l'éditeur visuel, signature). Ouvert à tout le personnel ; aucun ID patient, donc rien n'est rangé dans un dossier patient. Il s'enregistre dans
// « Rapports enregistrés » (visible par son créateur seul) et son créateur peut le partager avec d'autres membres du personnel (voir utils/externalMails.js).
import React, { useEffect, useRef } from 'react';
import { Form } from 'react-bootstrap';
import RichMessageEditor from '../components/Messaging/RichMessageEditor';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { MAIL_LIMITS } from '../utils/internalMail';

const pad = (n) => String(n).padStart(2, '0');
const todayFr = () => { const now = new Date(); return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`; };

const ExternalMail = ({ formData, setFormData, handleChange, showNotification }) => {
    const { currentEmployee, staffProfile } = useEmployeeAuth();
    const uid = currentEmployee?.uid || '';
    const editorRef = useRef(null);
    const lastBody = useRef(formData.externalMailBody || '');
    const notify = showNotification || (() => {});

    // Fonction, département et date par défaut (la même mémoire du département que la messagerie interne).
    useEffect(() => {
        let service = '';
        try { service = localStorage.getItem(`phmcMailService_${uid}`) || ''; } catch (error) { /* stockage indisponible */ }
        setFormData((prev) => {
            const next = { ...prev };
            let changed = false;
            if (!prev.externalMailFonction && (staffProfile?.rank || staffProfile?.category)) { next.externalMailFonction = staffProfile.rank || staffProfile.category; changed = true; }
            if (!prev.externalMailService && (service || staffProfile?.serviceDirige)) { next.externalMailService = service || staffProfile.serviceDirige; changed = true; }
            if (!prev.externalMailDate) { next.externalMailDate = todayFr(); changed = true; }
            return changed ? next : prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid]);

    // Un courrier rechargé depuis « Rapports enregistrés » : l'éditeur reprend son texte.
    useEffect(() => {
        if ((formData.externalMailBody || '') !== lastBody.current) {
            lastBody.current = formData.externalMailBody || '';
            if (editorRef.current) editorRef.current.setHtml(formData.externalMailBodyHtml || '');
        }
    }, [formData.externalMailBody, formData.externalMailBodyHtml]);

    const onBodyChange = (bbcode, html) => {
        lastBody.current = bbcode;
        setFormData((prev) => ({ ...prev, externalMailBody: bbcode, externalMailBodyHtml: html }));
    };

    return (
        <>
            <Form.Label className="form-section-title">Courrier</Form.Label>
            <Form.Group className="mb-3">
                <Form.Label>Objet</Form.Label>
                <Form.Control type="text" name="externalMailSubject" value={formData.externalMailSubject || ''} maxLength={MAIL_LIMITS.subject} onChange={handleChange} placeholder="Objet du courrier" className="form-control" />
            </Form.Group>

            <Form.Label className="form-section-title">Destinataire</Form.Label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <Form.Label>Destinataire (personne ou organisation)</Form.Label>
                    <Form.Control type="text" name="externalMailRecipient" value={formData.externalMailRecipient || ''} maxLength={MAIL_LIMITS.name} onChange={handleChange} placeholder="ex: Madame Dupont, Los Santos Insurance" className="form-control" />
                </div>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <Form.Label>Adresse e-mail (facultatif)</Form.Label>
                    <Form.Control type="email" name="externalMailRecipientAddress" value={formData.externalMailRecipientAddress || ''} maxLength={MAIL_LIMITS.name} onChange={handleChange} placeholder="prenomnom@mail.eyefind.fr" className="form-control" />
                </div>
            </div>

            <Form.Label className="form-section-title">Expéditeur</Form.Label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <Form.Label>Fonction au sein du PHMC</Form.Label>
                    <Form.Control type="text" name="externalMailFonction" value={formData.externalMailFonction || ''} maxLength={MAIL_LIMITS.name} onChange={handleChange} placeholder="ex: Médecin Titulaire" className="form-control" />
                </div>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <Form.Label>Département</Form.Label>
                    <Form.Control type="text" name="externalMailService" value={formData.externalMailService || ''} maxLength={MAIL_LIMITS.name} onChange={handleChange} placeholder="ex: Médecine interne" className="form-control" />
                </div>
            </div>
            <span className="helper-text">Le courrier est signé par vous : votre signature, votre nom, votre fonction et votre département figurent au bas du document.</span>

            <Form.Label className="form-section-title">Texte du courrier</Form.Label>
            <RichMessageEditor ref={editorRef} initialHtml={formData.externalMailBodyHtml || ''} onChange={onBodyChange} onNotify={notify} />
            <span className="helper-text">Mise en forme directe (gras, listes, citation, lien, images) : le texte est converti pour l'aperçu, le PDF, l'image et le HTML. Ce courrier n'est enregistré dans aucun dossier patient.</span>
        </>
    );
};

export default ExternalMail;
