// src/components/Pilou/PilouModal.js
//
// Boîte à outils → « Pilou ». À l'ouverture, Pilou propose le choix entre :
//   • l'AIDE À LA PRISE EN CHARGE (PilouCare.js) : on renseigne un cas, Pilou donne le parcours complet et permet de suivre l'avancement étape par étape ;
//   • le MANUEL MÉDICAL (PilouManual.js) : la formation de base du soignant, avec schémas, et une fiche réflexe par motif.
// Cette coquille porte le cas en cours et son avancement, gardés dans l'onglet (sessionStorage) pour ne pas les perdre en fermant la fenêtre : rien n'est envoyé au serveur.
import React, { useEffect, useState } from 'react';
import BaseModal from '../BaseModal';
import PilouCare from './PilouCare';
import PilouManual from './PilouManual';
import { CONDITION_BY_ID } from '../../clinical/conditions';
import { SEVERITIES } from '../../clinical/vitals';
import { ASSISTANT_NAME, ASSISTANT_EMOJI } from '../../clinical/assistantName';
import { MANUAL } from '../../clinical/manual';
import '../FieldGuide.css';
import './PilouModal.css';

export const PILOU_STORAGE_KEY = 'pilou:cas:v1';
export const EMPTY_CASE = {
    age: '', sex: '', weight: '', height: '', severity: 'Moderate', allergies: [], chronic: [], currentMeds: [], selected: [],
    injuryDetails: [], injuryMutilations: [], done: [], current: '', view: 'full',
};

const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);
const text = (value) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
/** Cas relu depuis l'onglet : on ne garde que des valeurs de la bonne forme (un stockage abîmé redonne un cas vide). */
export const reviveCase = (raw) => {
    let saved = null;
    try { saved = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (error) { saved = null; }
    if (!saved || typeof saved !== 'object') return { ...EMPTY_CASE };
    return {
        age: text(saved.age), sex: ['Male', 'Female'].includes(saved.sex) ? saved.sex : '', weight: text(saved.weight), height: text(saved.height),
        severity: SEVERITIES.some((s) => s.value === saved.severity) ? saved.severity : EMPTY_CASE.severity,
        allergies: strings(saved.allergies), chronic: strings(saved.chronic), currentMeds: strings(saved.currentMeds),
        selected: strings(saved.selected).filter((id) => CONDITION_BY_ID[id]),
        injuryDetails: Array.isArray(saved.injuryDetails) ? saved.injuryDetails.filter((row) => row && typeof row === 'object' && CONDITION_BY_ID[row.conditionId]) : [],
        injuryMutilations: strings(saved.injuryMutilations), done: strings(saved.done), current: text(saved.current), view: saved.view === 'track' ? 'track' : 'full',
    };
};
const readStored = () => { try { return reviveCase(window.sessionStorage.getItem(PILOU_STORAGE_KEY)); } catch (error) { return { ...EMPTY_CASE }; } };
const hasCase = (state) => !!(state.age || state.sex || state.weight || state.height || state.selected.length);

const TABS = [['home', 'fa-house', 'Accueil'], ['care', 'fa-user-injured', 'Aide à la prise en charge'], ['manual', 'fa-book-medical', 'Manuel médical']];

const PilouModal = ({ show, onHide, showNotification }) => {
    const [mode, setMode] = useState('home');
    const [caseState, setCaseState] = useState(readStored);
    const [manualTarget, setManualTarget] = useState(null);
    useEffect(() => { try { window.sessionStorage.setItem(PILOU_STORAGE_KEY, JSON.stringify(caseState)); } catch (error) { /* stockage indisponible : le cas reste en mémoire */ } }, [caseState]);

    const reset = () => setCaseState({ ...EMPTY_CASE });
    const openLesson = (lesson) => { setManualTarget({ chapterId: lesson.chapterId, sectionId: lesson.sectionId }); setMode('manual'); };
    // Depuis une fiche du manuel : le motif est ajouté au cas en cours (sans doublon), puis on passe à l'aide.
    const addCondition = (conditionId) => {
        setCaseState((prev) => (prev.selected.includes(conditionId) ? prev : { ...prev, selected: [...prev.selected, conditionId] }));
        setMode('care');
    };
    const inProgress = hasCase(caseState);
    const sheets = (MANUAL.find((chapter) => chapter.id === 'fiches') || { sections: [] }).sections.length;

    return (
        <BaseModal isOpen={show} onClose={onHide} title={`${ASSISTANT_NAME} ${ASSISTANT_EMOJI} — prise en charge et manuel médical`} modalSize="xl" className="pl-modal" closeOnOverlayClick={false}>
            <div className="pl-tabs" role="tablist" aria-label="Pilou">
                {TABS.map(([key, icon, label]) => (
                    <button key={key} type="button" role="tab" aria-selected={mode === key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)}><i className={`fas ${icon}`}></i>{label}</button>
                ))}
            </div>

            {mode === 'home' && (
                <div className="pl-home">
                    <p className="pl-intro">Que voulez-vous faire ? {ASSISTANT_NAME} vous accompagne pendant une prise en charge, ou vous forme entre deux scènes. Aide au jeu de rôle : le soignant reste responsable de ses choix.</p>
                    <div className="pl-choices">
                        <button type="button" className="pl-choice" onClick={() => setMode('care')}>
                            <i className="fas fa-user-injured"></i>
                            <strong>Aide à la prise en charge</strong>
                            <span>Renseignez le patient, ses motifs et ses blessures : {ASSISTANT_NAME} donne le parcours complet (gestes, matériel, examens, médicaments dosés, surveillance, orientation) et vous suit étape par étape.</span>
                            <em>{inProgress ? 'Reprendre le cas en cours' : 'Commencer un cas'}<i className="fas fa-arrow-right"></i></em>
                        </button>
                        <button type="button" className="pl-choice" onClick={() => setMode('manual')}>
                            <i className="fas fa-book-medical"></i>
                            <strong>Manuel médical</strong>
                            <span>La formation de base du soignant, écrite pour le jeu de rôle : le bilan, les gestes, les grandes urgences, les médicaments, jouer la scène — avec des schémas et {sheets} fiches réflexes.</span>
                            <em>Ouvrir le manuel<i className="fas fa-arrow-right"></i></em>
                        </button>
                    </div>
                    <small className="text-muted">Rien n'est envoyé ni enregistré sur le serveur : le cas en cours reste dans cet onglet jusqu'à « Nouveau patient ».</small>
                </div>
            )}
            {mode === 'care' && <PilouCare state={caseState} setState={setCaseState} onReset={reset} onOpenLesson={openLesson} showNotification={showNotification} />}
            {mode === 'manual' && <PilouManual target={manualTarget} onUseCondition={addCondition} />}
        </BaseModal>
    );
};

export default PilouModal;
