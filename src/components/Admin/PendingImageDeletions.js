// src/components/Admin/PendingImageDeletions.js
//
// « Images à supprimer » : ImgBB n'a pas d'API de suppression. Quand un utilisateur remplace ou
// supprime sa carte de visite / sa signature, le lien de suppression ImgBB arrive dans
// imgbbDeleteQueue. L'admin ouvre le lien (connecté au compte ImgBB de l'outil), confirme la
// suppression sur ImgBB, puis clique sur « Supprimé » : l'entrée disparaît de la liste.
import React, { useEffect, useState } from 'react';
import { Button, Table, Spinner } from 'react-bootstrap';
import { ref, onValue, remove } from 'firebase/database';
import { database } from '../../firebase';

const KIND_LABELS = { businessCard: 'Carte de visite', signature: 'Signature' };
// Seuls les liens de suppression ImgBB sont ouverts (les règles Firebase imposent aussi ce format).
const isImgbbDeleteUrl = (url) => typeof url === 'string' && /^https:\/\/ibb\.co\/.+/.test(url);

const useImgbbQueue = () => {
    const [entries, setEntries] = useState(null);
    useEffect(() => {
        const unsubscribe = onValue(
            ref(database, 'imgbbDeleteQueue'),
            (snapshot) => {
                const value = snapshot.val() || {};
                setEntries(Object.entries(value)
                    .map(([id, entry]) => ({ id, ...entry }))
                    .sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0)));
            },
            () => setEntries([])
        );
        return unsubscribe;
    }, []);
    return entries;
};

// Pastille du menu : nombre d'images en attente de suppression.
export const useImgbbQueueCount = () => {
    const entries = useImgbbQueue();
    return entries ? entries.length : 0;
};

const PendingImageDeletions = ({ showNotification }) => {
    const entries = useImgbbQueue();
    const [busyId, setBusyId] = useState(null);

    const markDeleted = async (entry) => {
        setBusyId(entry.id);
        try {
            await remove(ref(database, `imgbbDeleteQueue/${entry.id}`));
        } catch (error) {
            showNotification?.(`Impossible de retirer l'entrée : ${error.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const clearAll = async () => {
        if (!window.confirm(`Retirer les ${entries.length} entrées de la liste ? Vérifiez que les images ont bien été supprimées sur ImgBB.`)) return;
        setBusyId('all');
        try {
            await Promise.all(entries.map((entry) => remove(ref(database, `imgbbDeleteQueue/${entry.id}`))));
        } catch (error) {
            showNotification?.(`Impossible de vider la liste : ${error.message}`, 'error');
        } finally {
            setBusyId(null);
        }
    };

    if (entries === null) return <div className="text-center py-4"><Spinner animation="border" /></div>;

    return (
        <div className="card">
            <div className="card-header">Images à supprimer (ImgBB)</div>
            <div className="card-body">
                <p className="text-muted">
                    Anciennes cartes de visite et signatures remplacées ou supprimées par les utilisateurs. Ouvrez le lien,
                    confirmez la suppression sur ImgBB, puis cliquez sur « Supprimé » : l'entrée disparaît de cette liste.
                </p>
                {entries.length === 0 ? (
                    <div className="alert alert-success mb-0"><i className="fas fa-check-circle me-2"></i>Aucune image en attente.</div>
                ) : (
                    <>
                        <Table striped bordered hover responsive size="sm" variant="dark">
                            <thead>
                                <tr><th>Type</th><th>Propriétaire</th><th>Image</th><th>Date</th><th></th></tr>
                            </thead>
                            <tbody>
                                {entries.map((entry) => (
                                    <tr key={entry.id}>
                                        <td>{KIND_LABELS[entry.kind] || entry.kind || '—'}</td>
                                        <td>{entry.ownerLabel || entry.ownerUid || '—'}</td>
                                        <td>
                                            {entry.imageUrl
                                                ? <a href={entry.imageUrl} target="_blank" rel="noopener noreferrer">Voir</a>
                                                : '—'}
                                        </td>
                                        <td>{entry.queuedAt ? new Date(entry.queuedAt).toLocaleString('fr-FR') : '—'}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {isImgbbDeleteUrl(entry.deleteUrl) ? (
                                                <a className="btn btn-sm btn-outline-warning me-2" href={entry.deleteUrl} target="_blank" rel="noopener noreferrer">
                                                    <i className="fas fa-external-link-alt"></i> Ouvrir
                                                </a>
                                            ) : (
                                                <span className="text-danger me-2">Lien invalide</span>
                                            )}
                                            <Button size="sm" variant="success" disabled={busyId !== null} onClick={() => markDeleted(entry)}>
                                                <i className="fas fa-check"></i> Supprimé
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                        <Button variant="outline-danger" size="sm" disabled={busyId !== null} onClick={clearAll}>
                            <i className="fas fa-broom"></i> Tout retirer de la liste
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

export default PendingImageDeletions;
