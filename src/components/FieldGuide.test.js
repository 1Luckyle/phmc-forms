import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
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
});
