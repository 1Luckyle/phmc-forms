// src/components/Admin/users/RolePicker.js
//
// Choix « famille → rôle » du personnel, partagé par la fiche du personnel et la conversion
// Civil → Personnel : une famille (PHMC Soignant / Administration & Direction / Polyvalent / DMEC),
// puis un rôle de cette famille, rangé par filière. Pour un Chef de Service, un champ « service
// dirigé » (propositions + saisie libre) apparaît.
import React from 'react';
import { Form } from 'react-bootstrap';
import { STAFF_FAMILIES, rolesByFiliere, getRoleInfo, SERVICE_DIRIGE_SUGGESTIONS } from '../../../constants/ranks';

const RolePicker = ({ family, onFamilyChange, rank, onRankChange, serviceDirige, onServiceDirigeChange, allowedServices = null, idPrefix = 'role' }) => {
    const families = Object.values(STAFF_FAMILIES).filter((f) => !allowedServices || allowedServices.includes(f.service));
    const groups = rolesByFiliere(family);
    const needsServiceDirige = !!getRoleInfo(rank)?.needsServiceDirige;

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
                <Form.Label>Rôle</Form.Label>
                <Form.Select value={rank} onChange={(e) => onRankChange(e.target.value)}>
                    <option value="">Sélectionner…</option>
                    {groups.map((group) => (
                        <optgroup key={group.filiere} label={group.filiere}>
                            {group.roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                        </optgroup>
                    ))}
                </Form.Select>
            </Form.Group>
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
