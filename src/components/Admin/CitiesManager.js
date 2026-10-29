// src/components/Admin/CitiesManager.js
//
// Villes & codes postaux : la liste qui alimente le menu « Ville » des formulaires (inscription, fiche personnel / civil…).
// Une ville par ligne, « Nom ; Code postal » : on peut donc coller toute la liste d'un coup. Voir utils/cities.js.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { ref, set } from 'firebase/database';
import { database } from '../../firebase';
import { CITIES_PATH, MAX_CITIES, useCities, parseCitiesText, citiesToText } from '../../utils/cities';

const CitiesManager = ({ showNotification, onLogAction }) => {
    const live = useCities();
    const [text, setText] = useState('');
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    // Le texte suit la liste en vigueur tant que l'admin n'a rien modifié.
    useEffect(() => { if (!dirty) setText(citiesToText(live)); }, [live, dirty]);

    const parsed = useMemo(() => parseCitiesText(text), [text]);
    const tooMany = parsed.cities.length >= MAX_CITIES;

    const save = async () => {
        if (parsed.errors.length > 0) return;
        setSaving(true);
        try {
            await set(ref(database, CITIES_PATH), parsed.cities.length > 0 ? parsed.cities : null);
            if (onLogAction) onLogAction('Villes & codes postaux modifiés', `${parsed.cities.length} ville(s) dans la liste (avant : ${live.length}).`);
            showNotification(parsed.cities.length > 0 ? `Liste enregistrée (${parsed.cities.length} villes).` : 'Liste vidée : les formulaires reviennent à la saisie libre du code postal.', 'success');
            setDirty(false);
        } catch (error) {
            console.error('Enregistrement des villes impossible :', error);
            showNotification(`Enregistrement impossible : ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <p style={{ color: '#9aa7b4' }}>
                Chaque ligne est une ville avec son code postal, séparés par un point-virgule : <code>Mission Row ; 90001</code>.
                Les formulaires proposent alors un menu de villes et remplissent seuls le code postal. Une personne dont la ville n'est pas dans la liste peut
                choisir « Autre » et saisir son code. Liste vide = saisie libre du code postal.
            </p>
            <Form.Control
                as="textarea" rows={14} value={text} spellCheck={false}
                onChange={(e) => { setText(e.target.value); setDirty(true); }}
                placeholder={'Ville ; Code postal\nMission Row ; 90001'}
                style={{ fontFamily: 'monospace' }}
            />
            <div className="d-flex align-items-center gap-3 mt-2 flex-wrap">
                <Button variant="primary" onClick={save} disabled={saving || !dirty || parsed.errors.length > 0}>
                    {saving ? 'Enregistrement…' : 'Enregistrer la liste'}
                </Button>
                {dirty && <Button variant="outline-secondary" onClick={() => { setDirty(false); setText(citiesToText(live)); }} disabled={saving}>Annuler les modifications</Button>}
                <span style={{ color: '#9aa7b4' }}>{parsed.cities.length} ville(s){tooMany ? ` (maximum ${MAX_CITIES})` : ''}</span>
            </div>
            {parsed.errors.length > 0 && (
                <div className="mt-2" style={{ color: '#f85149' }}>
                    {parsed.errors.slice(0, 8).map((message) => <div key={message}>{message}</div>)}
                    {parsed.errors.length > 8 && <div>… et {parsed.errors.length - 8} autre(s).</div>}
                </div>
            )}
        </div>
    );
};

export default CitiesManager;
