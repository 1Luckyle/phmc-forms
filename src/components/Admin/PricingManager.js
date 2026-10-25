// src/components/Admin/PricingManager.js
//
// Tarifs des formulaires : tout ce pour quoi le site demande de l'argent (dossiers médicaux civils, divulgation,
// frais d'autopsie…). L'admin les modifie ici ; ils s'appliquent tout de suite aux NOUVEAUX formulaires et factures.
// Les factures déjà créées gardent leur montant. Voir utils/pricing.js.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { ref, update } from 'firebase/database';
import { database } from '../../firebase';
import { PRICE_DEFINITIONS, DEFAULT_PRICES, PRICES_PATH, MAX_PRICE, usePrices } from '../../utils/pricing';
import { formatMoney } from '../../utils/patientBilling';

const PricingManager = ({ showNotification, onLogAction }) => {
    const live = usePrices();
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);

    // Les champs suivent les tarifs en vigueur tant que l'admin n'a rien modifié.
    useEffect(() => { setDraft(Object.fromEntries(PRICE_DEFINITIONS.map((d) => [d.key, String(live[d.key])]))); }, [live]);

    const parsed = useMemo(() => Object.fromEntries(PRICE_DEFINITIONS.map((d) => {
        const text = String(draft[d.key] ?? '').trim();
        const value = Number(text);
        const valid = text !== '' && Number.isInteger(value) && value >= 0 && value <= MAX_PRICE;
        return [d.key, { value, valid }];
    })), [draft]);

    const allValid = PRICE_DEFINITIONS.every((d) => parsed[d.key]?.valid);
    const changes = PRICE_DEFINITIONS.filter((d) => parsed[d.key]?.valid && parsed[d.key].value !== live[d.key]);

    const save = async () => {
        if (!allValid || changes.length === 0) return;
        setSaving(true);
        try {
            const valeurs = Object.fromEntries(PRICE_DEFINITIONS.map((d) => [d.key, parsed[d.key].value]));
            await update(ref(database, PRICES_PATH), { valeurs, modifieLe: Date.now() });
            if (showNotification) showNotification(`Tarifs enregistrés (${changes.length} modifié${changes.length > 1 ? 's' : ''}).`, 'check-circle');
            if (onLogAction) {
                onLogAction('Tarifs des formulaires modifiés', changes.map((d) => `${d.label} : ${formatMoney(live[d.key])} → ${formatMoney(parsed[d.key].value)}`).join('\n'));
            }
        } catch (error) {
            console.error('Enregistrement des tarifs impossible :', error);
            if (showNotification) showNotification(`Enregistrement impossible : ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="adm-card">
            <div className="adm-card-head">
                <div>
                    <h4><i className="fas fa-coins"></i> Tarifs des formulaires</h4>
                    <p>Les montants demandés aux patients et aux demandeurs. Ils s'appliquent aussitôt aux nouveaux formulaires ; les factures déjà créées gardent leur montant.</p>
                </div>
            </div>
            <div className="adm-card-body">
                <div className="adm-price-list">
                    {PRICE_DEFINITIONS.map((definition) => {
                        const state = parsed[definition.key] || {};
                        const isDefault = state.valid && state.value === DEFAULT_PRICES[definition.key];
                        const changed = state.valid && state.value !== live[definition.key];
                        return (
                            <div key={definition.key} className={`adm-price-row ${changed ? 'changed' : ''}`}>
                                <div className="adm-price-info">
                                    <strong>{definition.label}</strong>
                                    <small>{definition.description}</small>
                                    <small>
                                        En vigueur : <strong>{formatMoney(live[definition.key])}</strong>
                                        {' · '}Par défaut : {formatMoney(DEFAULT_PRICES[definition.key])}
                                    </small>
                                </div>
                                <div className="adm-price-input">
                                    <div className="input-group">
                                        <input
                                            type="number" min="0" max={MAX_PRICE} step="100" inputMode="numeric"
                                            className={`form-control ${draft[definition.key] !== undefined && !state.valid ? 'is-invalid' : ''}`}
                                            value={draft[definition.key] ?? ''} disabled={saving}
                                            onChange={(event) => setDraft((current) => ({ ...current, [definition.key]: event.target.value }))}
                                            aria-label={`Tarif : ${definition.label}`}
                                        />
                                        <span className="input-group-text">$</span>
                                    </div>
                                    <button
                                        type="button" className="adm-price-reset" disabled={saving || isDefault}
                                        onClick={() => setDraft((current) => ({ ...current, [definition.key]: String(DEFAULT_PRICES[definition.key]) }))}
                                        title="Remettre la valeur par défaut (à enregistrer ensuite)"
                                    >
                                        <i className="fas fa-rotate-left"></i> Par défaut
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {!allValid && <div className="adm-notice">Chaque tarif doit être un nombre entier de dollars, entre 0 et {MAX_PRICE.toLocaleString('fr-FR')}.</div>}

                <div className="adm-price-actions">
                    <Button variant="primary" onClick={save} disabled={saving || !allValid || changes.length === 0}>
                        {saving ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-floppy-disk me-1"></i>Enregistrer les tarifs</>}
                    </Button>
                    {changes.length > 0 && !saving && (
                        <Button variant="outline-secondary" onClick={() => setDraft(Object.fromEntries(PRICE_DEFINITIONS.map((d) => [d.key, String(live[d.key])])))}>
                            Annuler les modifications
                        </Button>
                    )}
                    {changes.length === 0 && <span className="text-muted">Aucune modification en attente.</span>}
                </div>
            </div>
        </div>
    );
};

export default PricingManager;
