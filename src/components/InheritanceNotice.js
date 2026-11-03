// src/components/InheritanceNotice.js
//
// Fenêtre « Ce que vous héritez » : à la création du compte (et à chaque nouveau rôle ou nouvel élément), liste ce qui attendait déjà la personne
// (voir utils/inheritance.js). Elle ne s'affiche qu'une fois par élément.
import React, { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import BaseModal from './BaseModal';
import { collectInheritance, loadSeenInheritance, pendingInheritance, markInheritanceSeen } from '../utils/inheritance';

const ROLE_TITLES = {
    civil: 'Bienvenue : voici ce qui vous attendait déjà',
    soignant: 'Votre profil soignant est lié : voici ce que vous retrouvez',
};

const InheritanceNotice = ({ uid, isCivilian, patientID, staffName, canUseAma, enabled = true }) => {
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (!enabled || !uid) { setItems([]); return undefined; }
        let cancelled = false;
        (async () => {
            try {
                const [found, seen] = await Promise.all([
                    collectInheritance({ uid, isCivilian, patientID, staffName, canUseAma }),
                    loadSeenInheritance(uid),
                ]);
                const pending = pendingInheritance(found, seen);
                if (!cancelled) setItems(pending);
            } catch (error) {
                console.warn('Héritage du profil non évalué :', error?.message || error);
            }
        })();
        return () => { cancelled = true; };
    }, [enabled, uid, isCivilian, patientID, staffName, canUseAma]);

    if (!items.length) return null;

    const close = () => {
        markInheritanceSeen(uid, items).catch((error) => console.warn('Mémorisation impossible :', error?.message || error));
        setItems([]);
    };
    const roles = [...new Set(items.map((item) => item.role))];

    return (
        <BaseModal isOpen onClose={close} title={roles.length === 1 ? ROLE_TITLES[roles[0]] : 'Ce que vous héritez de votre profil'} modalSize="medium" zIndex={1200}>
            <p className="text-muted small">Ces éléments étaient déjà rangés à votre nom ou à votre ID patient. Ils sont maintenant disponibles depuis votre compte.</p>
            <ul className="list-unstyled mb-3">
                {items.map((item) => (
                    <li key={item.key} className="d-flex gap-3 mb-3">
                        <i className={`fas ${item.icon} mt-1`} style={{ color: '#58a6ff', width: '1.4em', textAlign: 'center' }}></i>
                        <div>
                            <strong>{item.label}</strong>
                            <div className="small" style={{ color: '#8b949e' }}>{item.detail}</div>
                        </div>
                    </li>
                ))}
            </ul>
            <div className="d-flex justify-content-end">
                <Button variant="primary" onClick={close}>J'ai compris</Button>
            </div>
        </BaseModal>
    );
};

export default InheritanceNotice;
