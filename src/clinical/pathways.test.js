import { CONDITIONS } from './conditions';
import { PATHWAYS, PHASES, splitStep, flatSteps, locateMedStep } from './pathways';
import { buildCase, caseToText, progressOf } from './protocols';
import { BODY_REGIONS, PRECISIONS, TRAJECTORIES, INJURY_CONDITIONS, MUTILATIONS } from './injuries';
import { REGION_CARE, PRECISION_CARE, TRAJECTORY_CARE, INJURY_KIND, injuryCareNotes, sanitizeInjuryDetails } from './injuryCare';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));

const adult = { ageYears: '34', sex: 'Male', weightKg: '80', heightCm: '180', severity: 'Severe' };

describe('parcours détaillés : un parcours par motif', () => {
    test('chaque motif a ses gestes immédiats, son bilan et son traitement', () => {
        const incomplete = CONDITIONS.filter((c) => {
            const pathway = PATHWAYS[c.id];
            return !pathway || pathway.now.length < 2 || pathway.assess.length < 2 || pathway.treat.length < 3;
        }).map((c) => c.id);
        expect(incomplete).toEqual([]);
    });
    test('aucun parcours orphelin (motif supprimé)', () => {
        const ids = new Set(CONDITIONS.map((c) => c.id));
        expect(Object.keys(PATHWAYS).filter((id) => !ids.has(id))).toEqual([]);
    });
    test('chaque étape s\'écrit « Titre court : comment faire »', () => {
        const bad = [];
        Object.entries(PATHWAYS).forEach(([id, pathway]) => ['now', 'assess', 'treat'].forEach((phase) => pathway[phase].forEach((text) => {
            const { title, detail } = splitStep(text);
            if (!title || title.length > 60 || detail.length < 15 || !/[.!?]$/.test(text)) bad.push(`${id}/${phase}: ${text.slice(0, 50)}`);
        })));
        expect(bad).toEqual([]);
    });
    test('chaque médicament qu\'un motif peut proposer est cité par une étape de son parcours (sa dose s\'y affiche)', () => {
        const missing = [];
        CONDITIONS.forEach((c) => (c.meds || []).forEach(([medId]) => { if (!locateMedStep(c.id, medId)) missing.push(`${c.id}: ${medId}`); }));
        expect(missing).toEqual([]);
    });
    test('splitStep : avec et sans détail', () => {
        expect(splitStep('Comprimer : appui direct.')).toEqual({ title: 'Comprimer', detail: 'appui direct.' });
        expect(splitStep('Contrôle de la plaie à 48 h')).toEqual({ title: 'Contrôle de la plaie à 48 h', detail: '' });
    });
});

describe('précisions sur les blessures : tout choix a un effet', () => {
    test('chaque zone du corps, chaque précision, chaque trajet et chaque motif localisable est couvert', () => {
        expect(BODY_REGIONS.filter((region) => !(REGION_CARE[region.value] || {}).all).map((region) => region.value)).toEqual([]);
        const precisions = [...new Set(Object.values(PRECISIONS).flat())];
        expect(precisions.filter((label) => !PRECISION_CARE[label])).toEqual([]);
        Object.values(PRECISION_CARE).forEach(([phase, text]) => { expect(['now', 'assess', 'treat']).toContain(phase); expect(splitStep(text).detail).not.toBe(''); });
        expect(TRAJECTORIES.filter((trajectory) => !TRAJECTORY_CARE[trajectory.value]).map((t) => t.value)).toEqual([]);
        expect(Object.keys(INJURY_CONDITIONS).filter((id) => !INJURY_KIND[id])).toEqual([]);
    });
    test('zone, précisions, trajet, nombre et mutilation ajoutent chacun leur conduite ; une même consigne n\'est donnée qu\'une fois', () => {
        const formData = {
            clinicalConditions: ['plaie_arme_feu', 'brulure'],
            injuryDetails: [
                { conditionId: 'plaie_arme_feu', region: 'cuisse', side: 'Right', count: '2', trajectory: 'Lodged', precisions: ['Saignement actif', 'Garrot posé'] },
                { conditionId: 'plaie_arme_feu', region: 'thorax', side: 'Left', count: '1', trajectory: 'Through', precisions: ['Saignement actif'] },
                { conditionId: 'brulure', region: 'main', side: 'Both', count: '', precisions: ['3e degré'] },
            ],
            injuryMutilations: ['fingers'],
        };
        const notes = injuryCareNotes(formData);
        const texts = notes.map((note) => note.text).join('\n');
        expect(texts).toMatch(/Cuisse : gros vaisseaux et fémur/);
        expect(texts).toMatch(/Thorax : toute plaie est pénétrante/);
        expect(texts).toMatch(/Brûlure de la main/); // consigne propre à la brûlure, pas celle de la plaie
        expect(texts).not.toMatch(/Main : toute plaie est explorée/);
        expect(texts).toMatch(/Balle logée/);
        expect(texts).toMatch(/Balle transfixiante/);
        expect(texts).toMatch(/Lésions multiples \(2 impacts de balle — cuisse\)/);
        expect(texts).toMatch(/Amputation de doigt\(s\)/);
        expect(notes.filter((note) => /^Saignement actif/.test(note.text))).toHaveLength(1);
        expect(notes.find((note) => /^Garrot en place/.test(note.text)).phase).toBe('now');
    });
    test('Pilou ne lit que ses listes : texte libre, motif non choisi et valeurs inconnues sont écartés', () => {
        const rows = sanitizeInjuryDetails([
            { conditionId: 'plaie_profonde', region: 'main', side: 'Left', count: '1', precisions: ['Plaie souillée', 'texte libre inventé'], note: 'remarque libre' },
            { conditionId: 'fracture_fermee', region: 'jambe', precisions: [] },
            { conditionId: 'plaie_profonde', region: '', side: '', count: '', precisions: [] },
            { conditionId: 'plaie_profonde', region: 'zone_inconnue', side: 'Up', count: '9', trajectory: 'Lodged', precisions: [] },
        ], ['plaie_profonde']);
        expect(rows).toEqual([{ conditionId: 'plaie_profonde', region: 'main', side: 'Left', count: '1', trajectory: '', precisions: ['Plaie souillée'], note: '' }]);
        expect(MUTILATIONS.filter((m) => m.care).length).toBeGreaterThan(10);
    });
});

describe('le parcours complet d\'un cas', () => {
    test('six temps dans l\'ordre, étapes numérotables, identifiants uniques', () => {
        const result = buildCase({ ...adult, conditionIds: ['plaie_arme_feu'] });
        expect(result.timeline.map((phase) => phase.key)).toEqual(PHASES.map((phase) => phase.key));
        const steps = flatSteps(result.timeline);
        expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
        steps.forEach((step) => { expect(step.title).toBeTruthy(); expect(Array.isArray(step.points)).toBe(true); });
        expect(steps.length).toBeGreaterThan(25);
        // gravité sévère : renfort ; médicaments dosés dans le traitement ; transmissions (le patient ne rentre pas chez lui)
        expect(steps.map((step) => step.id)).toEqual(expect.arrayContaining(['start-safety', 'start-help', 'start-abcde', 'start-vitals', 'start-equipment', 'assess-history', 'assess-exams', 'watch-rhythm', 'end-destination', 'end-handover', 'end-report']));
        // chaque médicament est affiché, avec sa dose, sur l'étape qui le demande — plus de ligne « Administrer » à part
        const medsOf = (title) => steps.find((step) => step.title === title).meds.map((med) => med.text.split(' ')[0]);
        expect(medsOf('Oxygéner et réchauffer')).toEqual(['Oxygène']);
        expect(medsOf('Poser deux voies veineuses de gros calibre')).toEqual(['Acide', 'Sérum']);
        expect(medsOf('Soulager')).toEqual(['Fentanyl']);
        expect(medsOf("Prévenir l'infection")).toEqual(['Céfazoline', 'Vaccin']);
        expect(steps.filter((step) => /^Administrer/.test(step.title))).toEqual([]);
        expect(steps.flatMap((step) => step.meds)).toHaveLength(result.meds.length);
        steps.flatMap((step) => step.meds).forEach((med) => { expect(med.text).toMatch(/\d/); expect(med.shared).toBe(''); });
        expect(steps.find((step) => step.id === 'assess-exams').points.join(' ')).toMatch(/Résultat le plus probable — Radiographie : /);
        expect(steps.find((step) => step.id === 'watch-rhythm').detail).toMatch(/toutes les 15 minutes/);
    });
    test('quel que soit le motif et la gravité, tout médicament proposé est sur une étape, une seule fois', () => {
        const loose = [];
        CONDITIONS.forEach((condition) => ['Mild', 'Moderate', 'Severe', 'Critical'].forEach((severity) => {
            const result = buildCase({ ...adult, severity, conditionIds: [condition.id] });
            const steps = flatSteps(result.timeline);
            const placed = steps.flatMap((step) => step.meds.map((med) => med.medId)).sort();
            if (steps.some((step) => /^Administrer/.test(step.title)) || placed.join() !== result.meds.map((med) => med.medId).sort().join()) loose.push(`${condition.id}/${severity}`);
        }));
        expect(loose).toEqual([]);
    });
    test('deux motifs : le médicament commun est rappelé sur l\'étape de l\'autre motif, sans être compté deux fois', () => {
        const result = buildCase({ ...adult, severity: 'Moderate', conditionIds: ['fracture_ouverte', 'plaie_arme_feu'] });
        const steps = flatSteps(result.timeline);
        const own = steps.find((step) => step.title === "Donner l'antibiotique dans l'heure" && step.tag === 'Fracture ouverte');
        expect(own.meds.map((med) => [med.medId, med.shared])).toEqual([['cefazoline', ''], ['vaccin_tetanique', '']]);
        const other = steps.find((step) => step.title === "Prévenir l'infection" && step.tag === 'Plaie par arme à feu');
        expect(other.meds.map((med) => [med.medId, med.shared])).toEqual([['cefazoline', 'Fracture ouverte'], ['vaccin_tetanique', 'Fracture ouverte']]);
        // l'antalgique de chaque motif reste sur son étape
        expect(steps.find((step) => step.title === 'Soulager' && step.tag === 'Plaie par arme à feu').meds.map((med) => med.medId)).toEqual(['fentanyl']);
        expect(steps.filter((step) => /^Administrer/.test(step.title))).toEqual([]);
        expect(steps.flatMap((step) => step.meds).filter((med) => !med.shared)).toHaveLength(result.meds.length);
        const text = caseToText(result);
        expect(text).toMatch(/→ Céfazoline .*IV\n/);
        expect(text).toMatch(/→ Céfazoline .*\(déjà prévu pour « Fracture ouverte » : une seule administration\)/);
    });
    test('les précisions sur les blessures entrent dans le parcours et dans le texte copié', () => {
        const result = buildCase({
            ...adult, conditionIds: ['plaie_arme_feu'], injuryMutilations: ['eye', 'inconnu'],
            injuryDetails: [{ conditionId: 'plaie_arme_feu', region: 'cuisse', side: 'Right', count: '2', trajectory: 'Lodged', precisions: ['Saignement actif'] }],
        });
        expect(result.injuries).toEqual(['Plaie par arme à feu : 2 impacts de balle — cuisse (côté droit), balle logée, Saignement actif']);
        expect(result.mutilations).toEqual(["Atteinte de l'œil (perforation, énucléation)"]);
        const now = result.timeline.find((phase) => phase.key === 'now').steps;
        expect(now.some((step) => step.title === 'Saignement actif' && step.tag === 'Blessures' && step.kind === 'alert')).toBe(true);
        expect(now.some((step) => /Atteinte de l'œil/.test(step.title))).toBe(true);
        expect(result.timeline.find((phase) => phase.key === 'assess').steps.some((step) => step.title === 'Cuisse')).toBe(true);
        const text = caseToText(result);
        expect(text).toContain('LÉSIONS');
        expect(text).toContain('GESTES IMMÉDIATS');
        expect(text).toMatch(/\d+\. Saignement actif \(Blessures\) : compression directe/);
    });
    test('sans précision : aucune ligne de lésion, parcours identique au motif seul', () => {
        const result = buildCase({ ...adult, conditionIds: ['plaie_arme_feu'] });
        expect(result.injuries).toEqual([]);
        expect(result.injuryCare).toEqual([]);
        expect(caseToText(result)).not.toContain('LÉSIONS');
    });
    test('plusieurs motifs : chaque étape porte le nom de son motif ; un seul motif : pas d\'étiquette', () => {
        const two = flatSteps(buildCase({ ...adult, conditionIds: ['sca', 'hypoglycemie'] }).timeline);
        expect(two.some((step) => step.tag === 'Hypoglycémie')).toBe(true);
        expect(two.some((step) => step.tag === 'Douleur thoracique / syndrome coronarien')).toBe(true);
        const one = flatSteps(buildCase({ ...adult, conditionIds: ['sca'] }).timeline);
        expect(one.every((step) => step.tag === '')).toBe(true);
    });
    test('retour à domicile : ordonnance et consignes de sortie au lieu des transmissions', () => {
        const result = buildCase({ ...adult, severity: 'Mild', conditionIds: ['plaie_superficielle'] });
        const ids = flatSteps(result.timeline).map((step) => step.id);
        expect(ids).toEqual(expect.arrayContaining(['end-rx', 'end-advice']));
        expect(ids).not.toContain('end-handover');
        expect(ids).not.toContain('start-help');
    });
    test('avancement du suivi et cases cochées dans le texte copié', () => {
        const result = buildCase({ ...adult, conditionIds: ['sca'] });
        const steps = flatSteps(result.timeline);
        expect(progressOf(result.timeline, [])).toMatchObject({ total: steps.length, done: 0, percent: 0, next: steps[0] });
        const half = progressOf(result.timeline, [steps[0].id, steps[1].id, 'etape-disparue']);
        expect(half.done).toBe(2);
        expect(half.next).toBe(steps[2]);
        expect(progressOf(result.timeline, steps.map((step) => step.id))).toMatchObject({ percent: 100, next: null });
        const text = caseToText(result, [steps[0].id]);
        expect(text).toContain(`[x] 1. ${steps[0].title}`);
        expect(text).toContain(`[ ] 2. ${steps[1].title}`);
        expect(caseToText(result)).not.toContain('[ ]');
    });
});
