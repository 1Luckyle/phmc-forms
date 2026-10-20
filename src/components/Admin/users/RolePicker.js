// src/components/Admin/users/RolePicker.js
//
// Choix « famille → rôle » du personnel, partagé par la fiche du personnel et la conversion
// Civil → Personnel : une famille (PHMC Soignant / Administration & Direction / Polyvalent / DMEC),
// puis un rôle de cette famille, rangé par filière. Les rôles se CUMULENT : en plus du rôle principal
// (qui fixe le préfixe de badge), on peut ajouter des rôles supplémentaires de n'importe quelle famille
// (ex. Médecin Titulaire + Directeur(trice)). Pour un Chef de Service, un champ « service dirigé »
// (propositions + saisie libre) apparaît.
import React from 'react';
import { Badge, Form } from 'react-bootstrap';
import {
    STAFF_FAMILIES, rolesByFiliere, getRoleInfo, SERVICE_DIRIGE_SUGGESTIONS,
} from '../../../constants/ranks';

const RolePicker = ({
    family, onFamilyChange, rank, onRankChange, serviceDirige, onServiceDirigeChange,
    extraRanks = [], onExtraRanksChange, allowedServices = null, idPrefix = 'role',
}) => {
    const families = Object.values(STAFF_FAMILIES).filter((f) => !allowedServices || allowedServices.includes(f.service));
    const groups = rolesByFiliere(family);
    const needsServiceDirige = [rank, ...extraRanks].some((value) => getRoleInfo(value)?.needsServiceDirige);

    // Rôles ajoutables en supplément : tous ceux de toutes les familles, sauf le principal et ceux déjà ajoutés.
    const addableFamilies = Object.values(STAFF_FAMILIES)
        .map((f) => ({ family: f, roles: rolesByFiliere(f.key).flatMap((group) => group.roles).filter((role) => role.value !== rank && !extraRanks.includes(role.value)) }))
        .filter((entry) => entry.roles.length > 0);

    return (
        <>
            <Form.Group className="mb-3">
                <Form.Label>Famille</Form.Label>
                <Form.Select value={family} onChange={(e) => onFamilyChange(e.target.value)} disabled={families.length <= 1}>
                    {families.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </Form.Select>
                <Form.Text className="text-muted">{STAFF_FAMILIES[family]?.description}</Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Rôle principal</Form.Label>
                <Form.Select value={rank} onChange={(e) => onRankChange(e.target.value)}>
                    <option value="">Sélectionner…</option>
                    {groups.map((group) => (
                        <optgroup key={group.filiere} label={group.filiere}>
                            {group.roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                        </optgroup>
                    ))}
                </Form.Select>
                <Form.Text className="text-muted">Il fixe aussi le préfixe du badge.</Form.Text>
            </Form.Group>

            {onExtraRanksChange && (
                <Form.Group className="mb-3">
                    <Form.Label>Rôles supplémentaires <small className="text-muted">(cumul, facultatif)</small></Form.Label>
                    {extraRanks.length > 0 && (
                        <div className="mb-2">
                            {extraRanks.map((value) => (
                                <Badge key={value} bg="secondary" className="me-1 mb-1 d-inline-flex align-items-center gap-2 py-2">
                                    {value}
                                    <button
                                        type="button"
                                        className="btn-close btn-close-white"
                                        style={{ fontSize: '0.55rem' }}
                                        aria-label={`Retirer ${value}`}
                                        onClick={() => onExtraRanksChange(extraRanks.filter((item) => item !== value))}
                                    ></button>
                                </Badge>
                            ))}
                        </div>
                    )}
                    <Form.Select
                        value=""
                        onChange={(e) => { if (e.target.value) onExtraRanksChange([...extraRanks, e.target.value]); }}
                    >
                        <option value="">Ajouter un rôle…</option>
                        {addableFamilies.map((entry) => (
                            <optgroup key={entry.family.key} label={entry.family.label}>
                                {entry.roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                            </optgroup>
                        ))}
                    </Form.Select>
                    <Form.Text className="text-muted">Ex. Médecin Titulaire + Directeur(trice) : la personne apparaît dans les deux familles.</Form.Text>
                </Form.Group>
            )}

            {needsServiceDirige && (
                <Form.Group className="mb-3">
                    <Form.Label>Service dirigé</Form.Label>
                    <Form.Control
                        list={`${idPrefix}-service-dirige`}
                        value={serviceDirige}
                        onChange={(e) => onServiceDirigeChange(e.target.value)}
                        placeholder="Choisir une proposition ou écrire un autre service"
                    />
                    <datalist id={`${idPrefix}-service-dirige`}>
                        {SERVICE_DIRIGE_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}
                    </datalist>
                    <Form.Text className="text-muted">Plusieurs chefs peuvent diriger un même service : le champ est libre.</Form.Text>
                </Form.Group>
            )}
        </>
    );
};

export default RolePicker;
