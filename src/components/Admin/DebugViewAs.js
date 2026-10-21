// src/components/Admin/DebugViewAs.js
//
// « Visualiser en tant que… » (section Debug du panneau admin), à la manière de Discord : on choisit un
// profil — visiteur, civil, candidat en attente de contrat, un rôle du personnel (avec ou sans droit
// Recruteur) — et le site s'affiche comme pour lui (voir utils/viewAs.js pour le principe et les limites).
// Une matrice montre d'un coup d'œil ce que chaque profil voit dans la Boîte à outils.
import React, { useMemo, useState } from 'react';
import { Alert, Button, Form, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { STAFF_FAMILIES, rolesByFiliere, RECRUITER_DEFAULT_RANK } from '../../constants/ranks';
import {
    describeViewAs, sameView, buildSimulatedIdentity, deriveIdentity, getToolAccess, TOOL_ACCESS_LABELS,
} from '../../utils/viewAs';

// Profils représentatifs de la matrice (tous les rôles ne sont pas utiles à comparer côte à côte).
const MATRIX_COLUMNS = [
    { label: 'Visiteur', view: { kind: 'visitor' } },
    { label: 'Civil', view: { kind: 'civil' } },
    { label: 'Candidat (contrat)', view: { kind: 'civil', candidate: true } },
    { label: 'Recruteur', view: { kind: 'staff', rank: RECRUITER_DEFAULT_RANK, recruiter: true } },
    // Tous les rôles d'une même famille ont les mêmes droits : une colonne par famille suffit.
    { label: 'Soignant', view: { kind: 'staff', rank: 'Infirmier(ère)' } },
    { label: 'Polyvalent', view: { kind: 'staff', rank: 'Personnel Polyvalent' } },
    { label: 'DMEC', view: { kind: 'staff', rank: 'Médecin Légiste' } },
    { label: 'Admin', view: null },
];

const accessOf = (view) => {
    const fakeUser = { uid: 'simulation', email: 'simulation@example.org' };
    const identity = view
        ? buildSimulatedIdentity(view, fakeUser)
        : { currentEmployee: fakeUser, employeeProfile: null, civilianProfile: null, adminStaffProfile: null, isAdmin: true, isRecruiter: false, isContractCandidate: false };
    return getToolAccess({ ...identity, ...deriveIdentity(identity) });
};

const DebugViewAs = ({ showInAppNotification }) => {
    const { viewAs, setViewAs, realIsAdmin } = useEmployeeAuth();
    const navigate = useNavigate();
    const [withRecruiter, setWithRecruiter] = useState(false);

    const apply = (view) => {
        setViewAs(view);
        if (showInAppNotification) {
            showInAppNotification(view ? `Visualisation en tant que : ${describeViewAs(view)}.` : 'Retour à votre profil administrateur.', view ? 'eye' : 'info-circle');
        }
    };

    const matrix = useMemo(() => MATRIX_COLUMNS.map((column) => ({ ...column, access: accessOf(column.view) })), []);

    const staffView = (rank) => ({ kind: 'staff', rank, ...(withRecruiter ? { recruiter: true } : {}) });
    const button = (key, label, view) => (
        <Button key={key} size="sm" className="me-1 mb-1" variant={sameView(viewAs, view) ? 'primary' : 'outline-secondary'} onClick={() => apply(view)}>
            {label}
        </Button>
    );

    return (
        <div>
            <p className="text-muted">
                <strong>Visualiser en tant que…</strong> Choisissez un profil : le site s'affiche comme pour lui (Boîte à outils, boutons, formulaires réservés),
                à la manière du « voir le serveur en tant que » de Discord. Un bandeau jaune en haut du site permet d'en sortir à tout moment.
            </p>
            <Alert variant="secondary" className="py-2 small">
                <i className="fas fa-info-circle me-1"></i>
                C'est une simulation de l'<strong>affichage</strong> : vos droits Firebase restent ceux d'un admin (un « permission denied » propre à un rôle ne peut pas
                être reproduit ici) et l'enregistrement de rapports est désactivé pendant la simulation. Elle n'existe que dans votre navigateur.
            </Alert>

            {!realIsAdmin && (
                <Alert variant="warning" className="py-2 small">
                    Le site ne vous reconnaît pas comme administrateur sur la page des formulaires (connectez-vous aussi avec votre compte admin dessus) :
                    la simulation n'y sera pas appliquée tant que ce n'est pas le cas.
                </Alert>
            )}

            <Alert variant={viewAs ? 'warning' : 'success'} className="py-2">
                {viewAs
                    ? <><i className="fas fa-eye me-2"></i>Profil simulé : <strong>{describeViewAs(viewAs)}</strong></>
                    : <><i className="fas fa-user-shield me-2"></i>Aucune simulation : vous voyez le site comme administrateur.</>}
                <div className="mt-2 d-flex gap-2 flex-wrap">
                    <Button size="sm" variant="primary" onClick={() => navigate('/')}><i className="fas fa-home me-1"></i>Ouvrir le site</Button>
                    <Button size="sm" variant="outline-dark" disabled={!viewAs} onClick={() => apply(null)}><i className="fas fa-undo me-1"></i>Redevenir admin</Button>
                </div>
            </Alert>

            <h6>Sans compte et comptes Civils</h6>
            <div className="mb-3">
                {button('visitor', 'Visiteur non connecté', { kind: 'visitor' })}
                {button('civil', 'Civil', { kind: 'civil' })}
                {button('candidate', 'Civil — candidat en attente de contrat', { kind: 'civil', candidate: true })}
            </div>

            <h6>Personnel</h6>
            <Form.Check
                type="switch"
                id="view-as-with-recruiter"
                className="mb-2"
                checked={withRecruiter}
                onChange={(e) => setWithRecruiter(e.target.checked)}
                label="Ajouter le droit Recruteur au rôle choisi"
            />
            {Object.values(STAFF_FAMILIES).map((family) => (
                <div key={family.key} className="mb-2">
                    <div className="small fw-semibold mb-1">{family.label}</div>
                    {rolesByFiliere(family.key).flatMap((group) => group.roles).map((role) => button(role.value, role.label, staffView(role.value)))}
                </div>
            ))}

            <h6 className="mt-3">Ce que voit chaque profil dans la Boîte à outils</h6>
            <div className="table-responsive">
                <Table size="sm" bordered className="align-middle text-center">
                    <thead>
                        <tr>
                            <th className="text-start">Entrée</th>
                            {matrix.map((column) => <th key={column.label}>{column.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(TOOL_ACCESS_LABELS).map(([key, label]) => (
                            <tr key={key}>
                                <td className="text-start">{label}</td>
                                {matrix.map((column) => (
                                    <td key={column.label} className={column.access[key] ? 'text-success' : 'text-muted'}>
                                        {column.access[key] ? <i className="fas fa-check"></i> : '—'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>
            <p className="text-muted small mb-0">
                Tous les rôles d'une famille ont les mêmes droits (la colonne « Soignant » vaut pour Infirmier, Médecin Titulaire, etc.). Le droit Recruteur est
                indépendant du rôle ; un cumul de rôles donne l'union des accès de ses familles. La matrice, le menu et les sélecteurs de formulaires utilisent
                la même définition (utils/viewAs.js et utils/formAccess.js). Visiteurs et Civils : inchangés.
            </p>
        </div>
    );
};

export default DebugViewAs;
