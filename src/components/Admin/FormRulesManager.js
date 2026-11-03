// src/components/Admin/FormRulesManager.js
//
// Panneau admin → « Champs obligatoires » : pour chaque formulaire, tous ses champs et une case « Obligatoire ». Le minimum du code est le point de départ ;
// ce qu'on coche ici est enregistré dans adminSettings/champsObligatoires et s'applique tout de suite (validation à l'enregistrement, marques rouges et
// infobulles des champs). Les champs qui composent le titre du rapport ou servent à la facturation sont verrouillés. Logique : utils/formRulesCore.js.
import React, { useMemo, useState } from 'react';
import { Alert, Badge, Button, Form } from 'react-bootstrap';
import { formDefinitions } from '../../formDefinitions';
import { VERSION_FIELDS } from '../../constants/formFieldCatalog';
import { getFieldInfo } from '../../constants/fieldInfo';
import { buildReportTitle } from '../../utils/reportTitle';
import { fieldKeysOf, isFieldRequired, isDefaultRequired, lockedReasonOf, specialRulesOf, LOCK_REASONS } from '../../utils/formRulesCore';
import { useFormRules, saveFieldRequirement, resetFormRequirements } from '../../utils/formRules';
import './FormRulesManager.css';

const GROUPS = [
    { label: 'Dossiers médicaux Civils', versions: [3, 25, 24, 26] },
    { label: 'Médecine légale (DMEC)', versions: [1, 4, 2, 8, 11, 37] },
    { label: 'Soins et notes du personnel', versions: [5, 6, 7, 14, 16, 19, 20, 21, 22, 23, 28, 29, 35] },
    { label: 'E-mail interne', versions: [27] },
    { label: 'Candidatures', versions: [50, 51, 52, 53, 54, 55] },
];

// Données d'exemple pour montrer le titre que donnera le formulaire.
const SAMPLE = {
    patientID: 'PHMC-2752', patientName: 'Jane Doe', patientFirstName: 'Jane', patientLastName: 'Doe', patientDateOfBirth: '1990-05-14', date: '2026-11-02',
    SubmitDate: '2026-11-02', dateOfVisit: '2026-11-02', decedentName: 'John Doe', decedentOOC: 'John Smith', dateTime: '2026-11-02T14:30', autopsyDate: '2026-11-02',
    dateOfDeath: '2026-11-02', caseNumber: '2026-0042', requestingOfficer: 'Officier Mike Ross, LSSD',
    internalEmailSubject: 'Réunion du lundi', internalEmailRecipient: 'Direction', applicantTitleAndFullName: 'Mme Jane Doe', decedents: [{ decedentName: 'John Doe' }],
};

const TYPE_LABELS = {
    text: 'Texte', textarea: 'Texte long', date: 'Date', 'datetime-local': 'Date et heure', time: 'Heure', email: 'E-mail', number: 'Nombre',
    select: 'Liste', checkbox: 'Case', radio: 'Choix',
};

const FormRulesManager = ({ showNotification, onLogAction }) => {
    const overrides = useFormRules();
    const [version, setVersion] = useState(3);
    const [query, setQuery] = useState('');
    const [onlyRequired, setOnlyRequired] = useState(false);
    const [busy, setBusy] = useState(false);

    const definitions = useMemo(() => Object.fromEntries(formDefinitions.map((definition) => [definition.version, definition])), []);
    const nameOf = (v) => (definitions[v]?.name || `Formulaire ${v}`).replace(/^\[Civil\]\s*/i, '');
    const keys = useMemo(() => fieldKeysOf(version), [version]);
    const modifiedCount = (v) => Object.keys(overrides[v] || {}).length;
    const requiredCount = (v) => fieldKeysOf(v).filter((key) => isFieldRequired(v, key, overrides)).length;

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return keys.map((key) => {
            const type = VERSION_FIELDS[version]?.[key] || 'text';
            const info = getFieldInfo(version, key, type);
            return { key, type, ...info, locked: lockedReasonOf(version, key), required: isFieldRequired(version, key, overrides), modified: key in (overrides[version] || {}) };
        }).filter((row) => (!onlyRequired || row.required) && (!q || `${row.label} ${row.key} ${row.help}`.toLowerCase().includes(q)));
    }, [keys, version, overrides, query, onlyRequired]);

    let exampleTitle = '';
    try { exampleTitle = buildReportTitle(version, SAMPLE, nameOf(version)); } catch (error) { exampleTitle = ''; }

    const toggle = async (row) => {
        setBusy(true);
        try {
            await saveFieldRequirement(version, row.key, !row.required);
            onLogAction?.('form_rule_changed', `${nameOf(version)} : « ${row.label} » devient ${row.required ? 'facultatif' : 'obligatoire'}.`);
        } catch (error) {
            showNotification?.(String(error?.message || error).slice(0, 160), 'error');
        } finally {
            setBusy(false);
        }
    };
    const reset = async () => {
        if (!window.confirm(`Remettre tous les champs de « ${nameOf(version)} » aux valeurs par défaut ?`)) return;
        setBusy(true);
        try {
            await resetFormRequirements(version);
            onLogAction?.('form_rule_reset', `${nameOf(version)} : champs obligatoires remis par défaut.`);
            showNotification?.('Valeurs par défaut rétablies.', 'check-circle');
        } catch (error) {
            showNotification?.(String(error?.message || error).slice(0, 160), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fr-wrap">
            <div className="fr-head">
                <div>
                    <h4><i className="fas fa-list-check"></i> Champs obligatoires</h4>
                    <p>Pour chaque formulaire, cochez les champs sans lesquels le rapport ne peut pas être enregistré. Le changement s'applique immédiatement à tous les utilisateurs.</p>
                </div>
            </div>

            <div className="fr-layout">
                <nav className="fr-list" aria-label="Formulaires">
                    {GROUPS.map((group) => (
                        <div key={group.label}>
                            <div className="fr-group">{group.label}</div>
                            {group.versions.map((v) => (
                                <button type="button" key={v} className={`fr-item ${v === version ? 'on' : ''}`} onClick={() => setVersion(v)}>
                                    <span>{nameOf(v)}</span>
                                    <small>{requiredCount(v)} obligatoire{requiredCount(v) > 1 ? 's' : ''}{modifiedCount(v) > 0 ? ` · ${modifiedCount(v)} modifié${modifiedCount(v) > 1 ? 's' : ''}` : ''}</small>
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>

                <section className="fr-main">
                    <h5>{nameOf(version)} <Badge bg="secondary">v{version}</Badge></h5>
                    {exampleTitle && <p className="fr-title"><b>Titre du rapport :</b> <code>{exampleTitle}</code></p>}
                    {specialRulesOf(version).length > 0 && (
                        <Alert variant="info" className="py-2 small">
                            <b>Règles propres au formulaire (non modifiables ici) :</b>
                            <ul className="mb-0">{specialRulesOf(version).map((rule) => <li key={rule}>{rule}</li>)}</ul>
                        </Alert>
                    )}
                    {version >= 50 && <Alert variant="secondary" className="py-2 small mb-2">Une candidature exige en plus d'autres champs selon le poste visé : ils ne sont pas modifiables ici.</Alert>}

                    <div className="fr-tools">
                        <Form.Control size="sm" type="search" placeholder="Rechercher un champ…" value={query} onChange={(e) => setQuery(e.target.value)} />
                        <Form.Check type="switch" id="fr-only" label="Obligatoires seulement" checked={onlyRequired} onChange={(e) => setOnlyRequired(e.target.checked)} />
                        <Button size="sm" variant="outline-secondary" disabled={busy || modifiedCount(version) === 0} onClick={reset}>Rétablir les valeurs par défaut</Button>
                    </div>

                    <div className="fr-table-wrap">
                        <table className="fr-table">
                            <thead><tr><th>Champ</th><th>Type</th><th>Ce qu'il faut renseigner</th><th className="text-center">Obligatoire</th></tr></thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.key} className={row.required ? 'req' : ''}>
                                        <td><b>{row.label}</b><small>{row.key}</small></td>
                                        <td>{TYPE_LABELS[row.type] || row.type}</td>
                                        <td className="fr-help">{row.help}</td>
                                        <td className="text-center">
                                            {row.locked ? (
                                                <span title={LOCK_REASONS[row.locked]}><i className="fas fa-lock"></i> <small>Verrouillé</small></span>
                                            ) : (
                                                <Form.Check
                                                    type="switch" id={`fr-${version}-${row.key}`} checked={row.required} disabled={busy}
                                                    onChange={() => toggle(row)} aria-label={`${row.label} obligatoire`}
                                                    className="d-inline-block"
                                                />
                                            )}
                                            {row.modified && !row.locked && <Badge bg="warning" text="dark" className="ms-1" title={isDefaultRequired(version, row.key) ? 'Rendu facultatif' : 'Rendu obligatoire'}>modifié</Badge>}
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && <tr><td colSpan={4} className="text-center fr-empty">Aucun champ ne correspond.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default FormRulesManager;
