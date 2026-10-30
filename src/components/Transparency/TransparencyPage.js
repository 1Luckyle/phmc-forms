// src/components/Transparency/TransparencyPage.js
//
// Page publique « Transparence » (#/transparence), sans connexion : un établissement public publie le nom et le contact de sa direction, la grille des
// rémunérations de ses services et ses comptes à la fin de chaque trimestre (Code du Gouvernement, art. 326 à 328) : ceux du PHMC, puis ceux de ses pharmacies
// (chacune avec sa propre comptabilité). Tout vient d'adminSettings
// (lecture publique) et se modifie dans le panneau admin → Transparence.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spinner } from 'react-bootstrap';
import { STAFF_FAMILIES, ROLES } from '../../constants/ranks';
import { loadSalaryGrid, gradeKeyOf, formatAmount } from '../../utils/salaryGrid';
import { loadTransparency, quarterLabel, totals, formatMoney, ENTITIES, MAIN_ENTITY } from '../../utils/transparency';
import { PHMC_PHONE, PHMC_DISCORD_URL } from '../../constants/contact';
import './Transparency.css';

const TransparencyPage = () => {
    const [grid, setGrid] = useState(null);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        Promise.all([loadSalaryGrid(), loadTransparency()])
            .then(([loadedGrid, loadedData]) => { if (!cancelled) { setGrid(loadedGrid); setData(loadedData); } })
            .catch((err) => { console.error(err); if (!cancelled) setError('Les informations ne sont pas disponibles pour le moment.'); });
        return () => { cancelled = true; };
    }, []);

    const families = useMemo(() => {
        if (!grid) return [];
        return Object.values(STAFF_FAMILIES)
            .map((family) => ({
                family,
                grades: ROLES.filter((role) => role.pole === family.key && grid.grades[gradeKeyOf(role.value)]).map((role) => ({ role, echelons: grid.grades[gradeKeyOf(role.value)].echelons })),
            }))
            .filter((entry) => entry.grades.length > 0);
    }, [grid]);

    // Comptes publiés de chaque entité, du plus récent au plus ancien : le PHMC d'abord, puis ses pharmacies (comptes à part, jamais additionnés).
    const accountsByEntity = useMemo(() => ENTITIES.map((entity) => ({
        entity,
        quarters: Object.values(data?.comptesParEntite?.[entity.key] || {}).sort((a, b) => b.periode.localeCompare(a.periode)),
    })), [data]);

    if (!grid && !error) return <div className="tp-page"><div className="tp-wrap text-center"><Spinner animation="border" /></div></div>;

    const membres = data?.membres || [];

    return (
        <div className="tp-page">
            <div className="tp-wrap">
                <Link to="/" className="tp-back"><i className="fas fa-arrow-left me-2"></i>Retour au site</Link>
                <h1><i className="fas fa-scale-balanced me-2"></i>Transparence</h1>
                <p className="tp-intro">
                    Le Pillbox Hill Medical Center est un établissement public : il publie ici l'identité de sa direction, la rémunération de ses agents et ses comptes
                    (Code du Gouvernement, art. 326 et 327).
                </p>
                {error && <Alert variant="danger">{error}</Alert>}

                {data && (
                    <>
                        <section className="tp-section">
                            <h2>Direction</h2>
                            {membres.length > 0 ? (
                                <div className="tp-direction-list">
                                    {membres.map((member, index) => (
                                        <div className="tp-direction" key={`${member.nom}-${index}`}>
                                            {member.nom && <strong>{member.nom}</strong>}
                                            {member.fonction && <span>{member.fonction}</span>}
                                            {member.contact && <span><i className="fas fa-envelope me-2"></i>{member.contact}</span>}
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="tp-muted">Information non renseignée pour le moment.</p>}
                            <div className="tp-contact">
                                <span><i className="fas fa-phone me-2"></i>Standard du PHMC : <strong>{PHMC_PHONE}</strong></span>
                                <a href={PHMC_DISCORD_URL} target="_blank" rel="noopener noreferrer"><i className="fab fa-discord me-2"></i>Portail de contact</a>
                            </div>
                            <p className="tp-muted">
                                Toute personne peut demander l'accès à une information détenue par l'établissement ; une réponse est apportée sous 7 jours (art. 328).
                                {data.contactDemandes ? ` ${data.contactDemandes}` : ''}
                            </p>
                        </section>

                        <section className="tp-section">
                            <h2>Grille des rémunérations</h2>
                            {families.length === 0 ? <p className="tp-muted">La grille n'est pas encore publiée.</p> : (
                                <>
                                    {families.map(({ family, grades }) => (
                                        <div key={family.key} className="tp-family">
                                            <h3>{family.label}</h3>
                                            <div className="tp-table-scroll">
                                                <table className="tp-table tp-table-grid">
                                                    <thead><tr><th>Grade</th><th>Échelon</th><th>Rémunération</th></tr></thead>
                                                    <tbody>
                                                        {grades.map(({ role, echelons }) => echelons.map((echelon, index) => (
                                                            <tr key={`${role.value}-${echelon.libelle}`}>
                                                                {index === 0 && <th rowSpan={echelons.length} scope="rowgroup">{role.value}</th>}
                                                                <td>{echelon.libelle}</td>
                                                                <td>{formatAmount(echelon.montant, grid.unite)}</td>
                                                            </tr>
                                                        )))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                    {grid.majLe && <p className="tp-muted">Grille mise à jour le {new Date(grid.majLe).toLocaleDateString('fr-FR')}.</p>}
                                </>
                            )}
                        </section>

                        {accountsByEntity.map(({ entity, quarters }) => {
                            const main = entity.key === MAIN_ENTITY;
                            if (!main && quarters.length === 0) return null;      // une pharmacie sans compte publié n'a pas de section
                            return (
                                <section className="tp-section" key={entity.key}>
                                    <h2>{main ? 'Comptes trimestriels' : `Comptes trimestriels — ${entity.title}`}</h2>
                                    {!main && <p className="tp-muted tp-entity-note">Cette entité tient sa propre comptabilité : ses comptes sont indépendants de ceux du PHMC et ne sont inclus dans aucun de ses totaux.</p>}
                                    {quarters.length === 0 ? <p className="tp-muted">Aucun compte n'a encore été publié.</p> : quarters.map((account) => {
                                        const sums = totals(account.lignes, account.soldeOuverture);
                                        return (
                                            <details key={account.periode} className="tp-quarter" open={account === quarters[0]}>
                                                <summary>
                                                    <strong>{quarterLabel(account.periode)}</strong>
                                                    <span>Recettes {formatMoney(sums.recettes)} · Dépenses {formatMoney(sums.depenses)} · Solde de clôture <b className={sums.cloture < 0 ? 'neg' : 'pos'}>{formatMoney(sums.cloture)}</b></span>
                                                </summary>
                                                <div className="tp-table-scroll">
                                                    <table className="tp-table tp-table-accounts">
                                                        <thead><tr><th>Libellé</th><th>Nature</th><th className="tp-num">Montant</th></tr></thead>
                                                        <tbody>
                                                            {sums.ouverture !== 0 && <tr><td>Solde d'ouverture du trimestre</td><td>Report</td><td className="tp-num">{formatMoney(sums.ouverture)}</td></tr>}
                                                            {account.lignes.map((line, index) => (
                                                                <tr key={index}><td>{line.libelle}</td><td>{line.type === 'depense' ? 'Dépense' : 'Recette'}</td><td className="tp-num">{formatMoney(line.montant)}</td></tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {account.notes && <p className="tp-muted">{account.notes}</p>}
                                                {account.publieLe && <p className="tp-muted">Publié le {new Date(account.publieLe).toLocaleDateString('fr-FR')}.</p>}
                                            </details>
                                        );
                                    })}
                                </section>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
};

export default TransparencyPage;
