import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import FieldGuide from './FieldGuide';

jest.mock('../utils/formRules', () => ({ startFormRulesSync: () => {} }));
jest.mock('../firebase', () => ({ database: {}, auth: {} }));

const hover = (el) => {
    fireEvent.mouseOver(el);
    act(() => { jest.advanceTimersByTime(300); });
    const tip = document.querySelector('.phmc-fieldtip');
    return tip ? tip.querySelector('.phmc-fieldtip-text').textContent : '';
};

describe('FieldGuide : infobulle du bon champ', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.useRealTimers(); document.body.innerHTML = ''; });

    test('un menu natif sans name ne reprend pas le champ caché d’une autre liste du formulaire', () => {
        const { container } = render(
            <div>
                <FieldGuide />
                <div className="modal-container">
                    <div className="css-b62m3t-container">
                        <div className="css-13cymwt-control"><input type="hidden" name="listeAutre" value="" /></div>
                    </div>
                    <select data-testid="ville" aria-label="Ville" data-guide="Choisissez la ville dans la liste."><option>—</option></select>
                </div>
            </div>
        );
        const select = container.querySelector('[data-testid="ville"]');
        expect(hover(select)).toBe('Choisissez la ville dans la liste.');
    });

    // Formulaire de contrat : les groupes de champs n'ont aucune classe reconnue (.form-group, .mb-3…) et sont tous dans une même grande ligne (.row) : l'infobulle reprenait
    // l'étiquette du TOUT PREMIER champ de cette ligne (« Type de document ») pour chacun des suivants.
    test('groupes sans classe reconnue : chaque champ reprend sa propre étiquette, pas celle du premier champ de la ligne', () => {
        const { container } = render(
            <div>
                <FieldGuide />
                <div className="modal-container">
                    <div className="row g-3">
                        <div className="col">
                            <div className="mb-3"><label>Type de document</label><select name="type"><option>CDI</option></select></div>
                            <div data-guide-zone>
                                <div><label className="form-label">Nouvelle fonction <small>(facultatif)</small></label><input data-testid="fonction" name="nouvelleFonction" /></div>
                                <div><label className="form-label">Nouvelle rémunération brute <small>(facultatif)</small></label><div><input data-testid="remuneration" name="remuneration" /></div></div>
                                <div><label className="form-label">Date de début</label><input data-testid="debut" type="date" name="dateDebut" required /></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
        expect(hover(container.querySelector('[data-testid="fonction"]'))).toBe('À renseigner : Nouvelle fonction.');
        expect(hover(container.querySelector('[data-testid="remuneration"]'))).toBe('À renseigner : Nouvelle rémunération brute.');
        expect(hover(container.querySelector('[data-testid="debut"]'))).toBe('À renseigner : Date de début.');
        expect(document.querySelector('.phmc-fieldtip-req').textContent).toBe('Obligatoire');
    });

    // Contrats et accords : les cases à cocher prennent aussi les couleurs (zone `data-mark-checks`).
    test('cases à cocher d\'une zone « data-mark-checks » : bleues tant qu\'elles sont décochées (facultatif), sans marque une fois cochées ; liste de services marquée d\'un bloc', async () => {
        jest.useRealTimers();
        const { container } = render(
            <div>
                <FieldGuide />
                <div data-guide-zone data-mark-checks>
                    <div className="form-check" data-testid="case"><input type="checkbox" id="c1" name="assurance" /><label htmlFor="c1">Assurance</label></div>
                    <div className="form-check" data-testid="case-ok"><input type="checkbox" id="c2" name="confidentialite" defaultChecked /><label htmlFor="c2">Confidentialité</label></div>
                    <div className="form-check" data-testid="case-requise"><input type="checkbox" id="c3" name="accord" required /><label htmlFor="c3">J'accepte</label></div>
                    <div className="contract-services" data-testid="liste">
                        <div className="form-check"><input type="checkbox" id="s1" name="svc-a" /><label htmlFor="s1">Urgences</label></div>
                        <div className="form-check"><input type="checkbox" id="s2" name="svc-b" /><label htmlFor="s2">Chirurgie</label></div>
                    </div>
                </div>
                <div data-guide-zone>
                    <div className="form-check" data-testid="hors-zone"><input type="checkbox" id="h1" name="autre" /><label htmlFor="h1">Autre</label></div>
                </div>
            </div>
        );
        const q = (id) => container.querySelector(`[data-testid="${id}"]`);
        await waitFor(() => expect(q('case').getAttribute('data-opt-empty')).toBe('1'));
        expect(q('case').hasAttribute('data-req-empty')).toBe(false);
        expect(q('case-ok').hasAttribute('data-opt-empty')).toBe(false);
        expect(q('case-requise').getAttribute('data-req-empty')).toBe('1');
        // la liste de cases est un seul champ : le bloc est marqué, pas chaque case
        expect(q('liste').getAttribute('data-opt-empty')).toBe('1');
        expect(q('liste').querySelectorAll('[data-opt-empty]')).toHaveLength(0);
        // hors d'une zone qui le demande, une case n'est jamais marquée
        expect(q('hors-zone').hasAttribute('data-opt-empty')).toBe(false);
        // cocher une case de la liste, ou la case seule, retire la marque
        fireEvent.click(container.querySelector('#s2'));
        fireEvent.click(container.querySelector('#c1'));
        await waitFor(() => expect(q('liste').hasAttribute('data-opt-empty')).toBe(false));
        await waitFor(() => expect(q('case').hasAttribute('data-opt-empty')).toBe(false));
    });

    test('groupe classique (.mb-3) : le comportement habituel est conservé', () => {
        const { container } = render(
            <div>
                <FieldGuide />
                <div className="modal-container">
                    <div className="mb-3"><label>Nom du patient</label><input data-testid="nom" name="nom" /></div>
                    <div className="mb-3"><label>Âge</label><input data-testid="age" name="age" /></div>
                </div>
            </div>
        );
        expect(hover(container.querySelector('[data-testid="nom"]'))).toBe('À renseigner : Nom du patient.');
        expect(hover(container.querySelector('[data-testid="age"]'))).toBe('À renseigner : Âge.');
    });
});
