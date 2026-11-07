import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import FormSections from './FormSections';

const Demo = ({ invalid = false }) => (
    <form>
        <FormSections version={1} />
        <label className="form-section-title">Identité</label>
        <input aria-label="nom" />
        <input aria-label="prenom" className={invalid ? 'is-invalid' : ''} />
        <label className="form-section-title">Contact</label>
        <div><input aria-label="mail" data-req-empty="" /></div>
        <label className="form-section-title">Vide</label>
    </form>
);

const hidden = (label) => screen.getByLabelText(label).closest('[data-fold-hidden]') !== null;

describe('sections repliables', () => {
    test('un clic replie puis déplie les champs de la section, sans toucher aux autres', () => {
        render(<Demo />);
        const identity = screen.getByText('Identité');
        expect(identity).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(identity);
        expect(identity).toHaveAttribute('aria-expanded', 'false');
        expect(hidden('nom')).toBe(true);
        expect(hidden('prenom')).toBe(true);
        expect(hidden('mail')).toBe(false);
        fireEvent.click(identity);
        expect(hidden('nom')).toBe(false);
    });

    test('le clavier (Entrée) replie aussi, une section sans champ n\'est pas repliable', () => {
        render(<Demo />);
        const contact = screen.getByText('Contact');
        fireEvent.keyDown(contact, { key: 'Enter' });
        expect(hidden('mail')).toBe(true);
        expect(screen.getByText('Vide')).not.toHaveAttribute('data-foldable');
    });

    test('une section repliée avec un champ obligatoire vide est signalée', () => {
        render(<Demo />);
        const contact = screen.getByText('Contact');
        fireEvent.click(contact);
        expect(contact).toHaveAttribute('data-pending', 'true');
    });

    test('une section repliée qui contient un champ en erreur se rouvre toute seule, une fois', async () => {
        const { rerender } = render(<Demo />);
        const identity = screen.getByText('Identité');
        fireEvent.click(identity);
        expect(hidden('nom')).toBe(true);
        await act(async () => { rerender(<Demo invalid />); });
        await waitFor(() => expect(hidden('nom')).toBe(false));
        // Le visiteur peut la replier de nouveau malgré l'erreur.
        fireEvent.click(identity);
        expect(hidden('nom')).toBe(true);
    });
});
