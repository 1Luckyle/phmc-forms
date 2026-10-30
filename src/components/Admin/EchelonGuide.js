// src/components/Admin/EchelonGuide.js
//
// Les 15 échelons de rémunération du PHMC avec, pour chacun, le rôle donné en exemple (« Rangs et Salaires ») et les grades qui s'y trouvent aujourd'hui.
// Deux usages : l'ÉDITEUR de la grille (salaires modifiables : un salaire modifié vaut pour tous les grades de l'échelon) et l'AIDE d'un chargé de recrutement
// qui choisit l'échelon d'un nouveau poste (lecture seule ; un clic sur un échelon le choisit).
import React from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { exampleLabelOf } from '../../constants/salaryReference';
import { formatEchelonRates } from '../../utils/salaryGrid';
import './EchelonGuide.css';

const cleanAmount = (value) => value.replace(/[^\d.,]/g, '');

// `echelons` : [{ numero, libelle, horaire, hebdo }] ; `usage` : { [numéro]: [noms de grades] } ; `rates` (mode édition) : { [numéro]: { horaire, hebdo } } en texte.
const EchelonGuide = ({ echelons, usage = {}, selected = null, onPick = null, editable = false, rates = {}, onRateChange = null, title = 'Rangs et salaires — PHMC', help = '' }) => (
    <aside className="eg" aria-label="Grille des échelons">
        <div className="eg-title"><i className="fas fa-list-ol me-2"></i>{title}</div>
        {help && <p className="eg-help">{help}</p>}
        <div className="eg-list">
            {[...echelons].sort((a, b) => b.numero - a.numero).map((echelon) => {
                const grades = usage[echelon.numero] || [];
                const example = exampleLabelOf(echelon.numero);
                const pickable = !editable && !!onPick;
                const body = (
                    <>
                        <span className="eg-rang">{echelon.numero}</span>
                        <span className="eg-label">
                            {echelon.libelle}
                            {example && <small className="eg-example"> · ex. {example}</small>}
                        </span>
                        {editable ? (
                            <span className="eg-amounts">
                                <InputGroup size="sm" className="eg-rate">
                                    <Form.Control inputMode="decimal" value={rates[echelon.numero]?.horaire ?? ''} aria-label={`${echelon.libelle} : montant à l'heure`}
                                        onChange={(event) => onRateChange(echelon.numero, 'horaire', cleanAmount(event.target.value))} />
                                    <InputGroup.Text>$ / h</InputGroup.Text>
                                </InputGroup>
                                <InputGroup size="sm" className="eg-rate">
                                    <Form.Control inputMode="decimal" value={rates[echelon.numero]?.hebdo ?? ''} aria-label={`${echelon.libelle} : montant à la semaine`}
                                        onChange={(event) => onRateChange(echelon.numero, 'hebdo', cleanAmount(event.target.value))} />
                                    <InputGroup.Text>$ / sem.</InputGroup.Text>
                                </InputGroup>
                            </span>
                        ) : <span className="eg-amounts eg-fixed">{formatEchelonRates(echelon)}</span>}
                        {grades.length > 0 && <span className="eg-grades" title={grades.join(', ')}>{grades.length} grade{grades.length > 1 ? 's' : ''} : {grades.join(', ')}</span>}
                    </>
                );
                return pickable ? (
                    <button type="button" key={echelon.numero} className={`eg-row eg-pick${selected === echelon.numero ? ' on' : ''}`} onClick={() => onPick(echelon.numero)}>{body}</button>
                ) : (
                    <div key={echelon.numero} className={`eg-row${selected === echelon.numero ? ' on' : ''}`}>{body}</div>
                );
            })}
        </div>
    </aside>
);

export default EchelonGuide;
