// FieldGuide : couleurs « obligatoire / facultatif » et infobulle des champs sans attribut `name` (menu des villes) et des blocs balisés `data-field-group` (cases à cocher, éditeur…).
import React, { useState } from 'react';
import { render, act, fireEvent } from '@testing-library/react';

jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('../utils/formRules', () => ({ startFormRulesSync: () => {} }));
jest.mock('../utils/cities', () => ({
    useCities: () => [{ nom: 'Mission Row', cp: '90001' }],
    cityOfZip: (cities, zip) => cities.find((c) => c.cp === zip) || null,
    getCitiesSnapshot: () => [],
}));

const FieldGuide = require('./FieldGuide').default;
const ZipCityField = require('./ZipCityField').default;

const wait = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });

const CityForm = ({ version, name }) => {
    const [zip, setZip] = useState('');
    return (
        <>
            <FieldGuide />
            <form data-form-zone={version}>
                <ZipCityField fieldName={name} zip={zip} onZipChange={setZip} city="" onCityChange={() => {}} />
            </form>
        </>
    );
};

const CategoriesForm = () => {
    const [categories, setCategories] = useState([]);
    return (
        <>
            <FieldGuide />
            <form data-form-zone="41">
                <div data-field-group="flightCertCategories">
                    {['Avion', 'Hélicoptère'].map((category) => (
                        <label key={category}>
                            <input type="checkbox" checked={categories.includes(category)} onChange={() => setCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]))} />
                            {category}
                        </label>
                    ))}
                </div>
            </form>
        </>
    );
};

describe('FieldGuide : champs sans name et blocs balisés', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    test('le menu des villes reçoit la couleur « facultatif » (bleu) tant qu’aucune ville n’est choisie, et la perd une fois choisie', async () => {
        const { container } = render(<CityForm version={24} name="patientZIP" />);
        await wait();
        const select = container.querySelector('select');
        expect(select.hasAttribute('data-opt-empty')).toBe(true);
        await act(async () => { fireEvent.change(select, { target: { value: 'Mission Row' } }); });
        await wait();
        expect(container.querySelector('select').hasAttribute('data-opt-empty')).toBe(false);
    });

    test('choisir « Autre » sans code postal ne compte pas pour une réponse', async () => {
        const { container } = render(<CityForm version={24} name="patientZIP" />);
        await wait();
        await act(async () => { fireEvent.change(container.querySelector('select'), { target: { value: '__autre__' } }); });
        await wait();
        expect(container.querySelector('select').hasAttribute('data-opt-empty')).toBe(true);
    });

    test('un bloc de cases à cocher obligatoire est rouge tant qu’aucune n’est cochée', async () => {
        const { container } = render(<CategoriesForm />);
        await wait();
        const group = container.querySelector('[data-field-group="flightCertCategories"]');
        expect(group.hasAttribute('data-req-empty')).toBe(true);
        await act(async () => { fireEvent.click(container.querySelector('input[type="checkbox"]')); });
        await wait();
        expect(group.hasAttribute('data-req-empty')).toBe(false);
    });

    test('l’infobulle d’un bloc de cases à cocher dit que le champ est obligatoire', async () => {
        jest.useFakeTimers();
        const { container } = render(<CategoriesForm />);
        fireEvent.mouseOver(container.querySelector('input[type="checkbox"]'));
        act(() => { jest.advanceTimersByTime(300); });
        const tip = document.querySelector('.phmc-fieldtip');
        expect(tip.textContent).toMatch(/Avion, hélicoptère/);
        expect(tip.querySelector('.phmc-fieldtip-req').textContent).toMatch(/Obligatoire/);
        jest.useRealTimers();
    });
});
