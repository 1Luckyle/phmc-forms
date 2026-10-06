// src/components/Admin/AdminReportsTools.js
//
// Onglet « Utilisateurs » du panneau admin : consulter les rapports sauvegardés de
// n'importe quel compte et les dossiers patients SANS repasser par la page
// principale. Réutilise exactement les mêmes fenêtres que l'application
// (SavedReportsModal / PatientDossierModal), donc les mêmes règles de copie, de
// partage et de suppression. Il n'y a pas de formulaire ouvert dans le panneau
// admin : « Charger » y est donc masqué.
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import SavedReportsModal from '../SavedReportsModal';
import PatientDossierModal from '../PatientDossierModal';
import { useReportManagement } from '../useReportManagement';
import { useData } from '../../contexts/DataContext';
import { listSavedReportNodes, reindexPatientRecords } from '../../utils/patientRecords';

const noop = () => {};
const ensureArray = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);

const AdminReportsTools = ({ showNotification }) => {
    const { phmcListData, coronerListData, selectOptions } = useData();
    const modalCloseTimer = useRef(null);
    const [showDossier, setShowDossier] = useState(false);
    const [reindexing, setReindexing] = useState(false);
    const [accountNodes, setAccountNodes] = useState([]);

    // Pas de formulaire dans le panneau admin : les paramètres liés au formulaire sont neutres.
    const reports = useReportManagement(
        {}, noop, 0, noop, () => '', () => null, (data) => data,
        coronerListData, phmcListData, selectOptions || {},
        showNotification, noop, noop, noop, noop, modalCloseTimer, {},
        19, 20, 21, {}, {}, {}, {}, {}, {}, null, {}
    );

    // Tous les comptes ayant des rapports, y compris ceux qui ne sont pas dans la liste du
    // personnel (civils « Prénom Nom ID », comptes rangés par erreur sous une adresse e-mail).
    const refreshAccountNodes = useCallback(async () => {
        try {
            setAccountNodes(await listSavedReportNodes());
        } catch (error) {
            console.warn('Could not list savedReports nodes:', error);
        }
    }, []);
    useEffect(() => {
        if (reports.showSavedReports) refreshAccountNodes();
    }, [reports.showSavedReports, refreshAccountNodes]);

    const employeeOptions = useMemo(() => {
        const staff = [
            {
                label: 'PHMC Staff',
                options: ensureArray(phmcListData).map((p) => ({ value: p.name, label: `${p.name} (${p.category || 'PHMC'})` })),
            },
            {
                label: 'Coroners',
                options: ensureArray(coronerListData).map((c) => ({ value: c.name, label: `${c.name} (${c.rank || 'Coroner'})` })),
            },
        ].map((group) => ({ ...group, options: group.options.sort((a, b) => a.label.localeCompare(b.label)) }));
        const known = new Set(staff.flatMap((g) => g.options).map((o) => o.value.trim().replace(/[.#$[\]/ ]+/g, '_')));
        const others = accountNodes
            .filter((node) => !known.has(node))
            .map((node) => ({ value: node, label: `${node.replace(/_/g, ' ')}${node.includes('@') ? ' (adresse e-mail : à migrer)' : ''}` }))
            .sort((a, b) => a.label.localeCompare(b.label));
        return [...staff, ...(others.length ? [{ label: 'Autres comptes (civils, e-mails…)', options: others }] : [])]
            .filter((group) => group.options.length > 0);
    }, [phmcListData, coronerListData, accountNodes]);

    const handleReindex = async () => {
        if (!window.confirm("Réindexer les dossiers patients ?\n\nTous les rapports sauvegardés qui portent un ID patient et ne sont pas encore dans un dossier (ou dont le chemin est périmé après une migration) y seront ajoutés. Aucune donnée n'est supprimée.")) {
            return;
        }
        setReindexing(true);
        try {
            const result = await reindexPatientRecords();
            showNotification(
                `Réindexation terminée : ${result.scanned} rapport(s) analysé(s), ${result.created} ajouté(s) aux dossiers, ${result.repaired} chemin(s) corrigé(s).`,
                'check-circle'
            );
        } catch (error) {
            console.error('Error reindexing patient records:', error);
            showNotification(`Échec de la réindexation : ${error.message}`, 'error');
        } finally {
            setReindexing(false);
        }
    };

    return (
        <>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                <Button variant="primary" onClick={() => reports.setShowSavedReports(true)}>
                    <i className="fas fa-save"></i> Rapports sauvegardés
                </Button>
                <Button variant="primary" onClick={() => setShowDossier(true)}>
                    <i className="fas fa-folder-open"></i> Dossiers patients
                </Button>
                <Button variant="outline-warning" onClick={handleReindex} disabled={reindexing}
                    title="Retrouve les rapports qui portent un ID patient mais n'apparaissent pas dans son dossier">
                    {reindexing ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-sync-alt"></i>} Réindexer les dossiers patients
                </Button>
            </div>

            <SavedReportsModal
                show={reports.showSavedReports}
                onHide={() => reports.setShowSavedReports(false)}
                onClose={() => reports.setShowSavedReports(false)}
                showNotification={showNotification}
                savedReports={reports.savedReports}
                reportsForSelectedUser={reports.savedReports}
                deleteReportsForUser={reports.deleteReportsForUser}
                loadSharedReportsForPatient={reports.loadSharedReportsForPatient}
                shareReportWithPatient={reports.shareReportWithPatient}
                copyReportToOwnAccount={reports.copyReportToOwnAccount}
                isLoading={reports.isLoadingUserReports}
                isLoadingReports={reports.isLoadingUserReports}
                bbCodeVersion={0}
                onEmployeeSelect={(employeeValue) => {
                    if (employeeValue) return reports.loadUserSavedReports(employeeValue);
                    return Promise.resolve();
                }}
                employeeOptions={employeeOptions}
            />
            <PatientDossierModal
                show={showDossier}
                onHide={() => setShowDossier(false)}
                showNotification={showNotification}
                shareReportWithPatient={reports.shareReportWithPatient}
                copyReportToOwnAccount={reports.copyReportToOwnAccount}
                deleteReportsForUser={reports.deleteReportsForUser}
            />
        </>
    );
};

export default AdminReportsTools;
