// src/components/Pilou/PilouManual.js
//
// Pilou → « Manuel médical » : lecteur du manuel de formation (clinical/manual.js). À gauche la recherche et le sommaire (chapitres, puis sections du chapitre ouvert) ; à droite UNE section à la fois,
// avec « précédent / suivant » pour lire le manuel comme un cours. Les fiches réflexes renvoient vers la leçon correspondante et peuvent envoyer leur motif dans l'aide à la prise en charge.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { MANUAL, searchManual, lessonOfCondition, vitalsRows, medsRows } from '../../clinical/manual';
import { splitStep } from '../../clinical/pathways';
import { CONDITION_BY_ID } from '../../clinical/conditions';
import ManualFigure from './ManualFigures';
import PilouMascot from './PilouMascot';

const Table = ({ head, rows }) => (
    <div className="pm-table-wrap"><table className="pm-table">
        <thead><tr>{head.map((cell, index) => <th key={`${cell}-${index}`}>{cell}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.join('|')}>{row.map((cell, index) => (index === 0 ? <th key={`${cell}-${index}`} scope="row">{cell}</th> : <td key={`${cell}-${index}`}>{cell}</td>))}</tr>)}</tbody>
    </table></div>
);

// « Titre : détail » → titre en gras (étapes des fiches réflexes).
const StepText = ({ text }) => {
    const { title, detail } = splitStep(text);
    return detail ? <><strong>{title}</strong> : {detail}</> : <>{text}</>;
};

const Block = ({ block }) => {
    switch (block.type) {
        case 'p': return <p>{block.text}</p>;
        case 'heading': return <h6 className="pm-heading">{block.text}</h6>;
        case 'list': return <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
        case 'steps': return <ol>{block.items.map((item) => <li key={item}><StepText text={item} /></li>)}</ol>;
        case 'table': return <Table head={block.head} rows={block.rows} />;
        case 'vitalsTable': return <Table head={['Âge', 'Fréquence cardiaque (/min)', 'Fréquence respiratoire (/min)', 'Tension habituelle (mmHg)']} rows={vitalsRows()} />;
        case 'medsTable': return <Table head={['Médicament', 'Famille', 'Voies', 'Noms de marque']} rows={medsRows()} />;
        case 'figure': return <ManualFigure id={block.id} caption={block.caption} />;
        case 'tip': return <div className="pm-note tip"><PilouMascot mood="thinking" size={44} label="" /><div><strong>À retenir.</strong> {block.text}</div></div>;
        case 'warn': return <div className="pm-note warn"><PilouMascot mood="alert" size={44} label="" /><div><strong>Piège.</strong> {block.text}</div></div>;
        case 'rp': return <div className="pm-note rp"><i className="fas fa-masks-theater"></i><div><strong>En jeu.</strong>{block.lines.map((line) => <div key={line} className="pm-rp-line">{line}</div>)}</div></div>;
        default: return null;
    }
};

const FLAT = MANUAL.flatMap((chapter) => chapter.sections.map((section) => ({ chapterId: chapter.id, sectionId: section.id })));

/**
 * target : { chapterId, sectionId } à ouvrir (leçon demandée depuis l'aide à la prise en charge) ; onUseCondition(id) : envoie le motif d'une fiche dans l'aide.
 */
const PilouManual = ({ target, onUseCondition }) => {
    const [position, setPosition] = useState(() => (target && target.chapterId ? target : { chapterId: MANUAL[0].id, sectionId: MANUAL[0].sections[0].id }));
    const [query, setQuery] = useState('');
    const contentRef = useRef(null);
    useEffect(() => { if (target && target.chapterId) setPosition({ chapterId: target.chapterId, sectionId: target.sectionId }); }, [target]);
    useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [position]);

    const chapter = MANUAL.find((item) => item.id === position.chapterId) || MANUAL[0];
    const section = chapter.sections.find((item) => item.id === position.sectionId) || chapter.sections[0];
    const results = useMemo(() => searchManual(query), [query]);
    const at = FLAT.findIndex((item) => item.chapterId === chapter.id && item.sectionId === section.id);
    const open = (chapterId, sectionId) => setPosition({ chapterId, sectionId: sectionId || (MANUAL.find((item) => item.id === chapterId) || MANUAL[0]).sections[0].id });
    const lesson = section.conditionId ? lessonOfCondition(section.conditionId) : null;
    // Sections du chapitre ouvert ; les fiches réflexes sont rangées par famille de motifs.
    const groups = chapter.sections.reduce((acc, item) => {
        const name = item.group || '';
        const last = acc[acc.length - 1];
        if (last && last.name === name) last.items.push(item); else acc.push({ name, items: [item] });
        return acc;
    }, []);

    return (
        <div className="pm-layout">
            <nav className="pm-nav" aria-label="Sommaire du manuel">
                <Form.Control type="search" name="pilouManuelRecherche" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher dans le manuel…" aria-label="Rechercher dans le manuel" className="pm-search" />
                {query.trim().length >= 2 ? (
                    <div className="pm-results">
                        <div className="pm-results-count">{results.length ? `${results.length} résultat${results.length > 1 ? 's' : ''}` : 'Aucun résultat'}</div>
                        {results.map((item) => (
                            <button key={`${item.chapterId}-${item.sectionId}`} type="button" className="pm-result" onClick={() => { open(item.chapterId, item.sectionId); setQuery(''); }}>
                                <span>{item.title}</span><small>{item.chapterTitle}</small>
                            </button>
                        ))}
                    </div>
                ) : (
                    <ul className="pm-chapters">
                        {MANUAL.map((item, index) => (
                            <li key={item.id} className={item.id === chapter.id ? 'open' : ''}>
                                <button type="button" className="pm-chapter" onClick={() => open(item.id)} aria-expanded={item.id === chapter.id}><i className={`fas ${item.icon}`}></i><span>{index + 1}. {item.title}</span></button>
                                {item.id === chapter.id && groups.map((group) => (
                                    <div key={group.name || 'sections'} className="pm-sections">
                                        {group.name && <div className="pm-group">{group.name}</div>}
                                        {group.items.map((sub) => <button key={sub.id} type="button" className={`pm-section-link${sub.id === section.id ? ' active' : ''}`} onClick={() => open(item.id, sub.id)}>{sub.title}</button>)}
                                    </div>
                                ))}
                            </li>
                        ))}
                    </ul>
                )}
            </nav>

            <article className="pm-content" ref={contentRef}>
                <div className="pm-crumb"><i className={`fas ${chapter.icon}`}></i>{chapter.title}</div>
                <h4>{section.title}</h4>
                {section.id === chapter.sections[0].id && chapter.intro && <p className="pm-intro">{chapter.intro}</p>}
                {section.blocks.map((block, index) => <Block key={`${section.id}-${index}`} block={block} />)}

                {section.conditionId && (
                    <div className="pm-actions">
                        {onUseCondition && <Button variant="outline-primary" size="sm" onClick={() => onUseCondition(section.conditionId)}><i className="fas fa-user-injured me-1"></i>Utiliser ce motif dans l'aide à la prise en charge</Button>}
                        {lesson && <Button variant="outline-secondary" size="sm" onClick={() => open(lesson.chapterId, lesson.sectionId)}><i className="fas fa-book-medical me-1"></i>Comprendre : {lesson.title}</Button>}
                    </div>
                )}
                {!section.conditionId && (section.conditions || []).length > 0 && (
                    <div className="pm-related"><span>Fiches réflexes :</span>{section.conditions.filter((id) => CONDITION_BY_ID[id]).map((id) => <button key={id} type="button" onClick={() => open('fiches', `fiche-${id}`)}>{CONDITION_BY_ID[id].label}</button>)}</div>
                )}

                <div className="pm-pager">
                    <Button variant="outline-secondary" size="sm" disabled={at <= 0} onClick={() => open(FLAT[at - 1].chapterId, FLAT[at - 1].sectionId)}><i className="fas fa-arrow-left me-1"></i>Précédent</Button>
                    <small>{at + 1} / {FLAT.length}</small>
                    <Button variant="outline-secondary" size="sm" disabled={at >= FLAT.length - 1} onClick={() => open(FLAT[at + 1].chapterId, FLAT[at + 1].sectionId)}>Suivant<i className="fas fa-arrow-right ms-1"></i></Button>
                </div>
                <p className="pm-disclaimer">Manuel écrit pour le jeu de rôle : il simplifie volontairement la médecine et ne remplace ni une formation réelle ni un avis médical.</p>
            </article>
        </div>
    );
};

export default PilouManual;
