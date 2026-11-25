import React from 'react';
import { render, screen } from '@testing-library/react';
import { BleedingFields, FollowupAppointmentFields, EmergencyDischargeFields } from './shared/CareExtraFields';
import InjuryDetails from './shared/InjuryDetails';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));

const noop = () => {};

describe('champs du système de santé en jeu', () => {
    test('hémorragie : le moyen d’arrêt n’apparaît que pour une hémorragie contrôlée', () => {
        const { rerender } = render(<BleedingFields formData={{ bleedingState: 'Active' }} setFormData={noop} handleChange={noop} />);
        expect(screen.getByText('Hémorragie')).toBeInTheDocument();
        expect(screen.queryByText("Moyen d'arrêt")).toBeNull();
        rerender(<BleedingFields formData={{ bleedingState: 'Controlled' }} setFormData={noop} handleChange={noop} />);
        expect(screen.getByText("Moyen d'arrêt")).toBeInTheDocument();
    });

    test('rendez-vous de suivi : seulement pour un suivi recommandé, date limitée à 14 jours', () => {
        const { container, rerender } = render(<FollowupAppointmentFields formData={{ followup: 'AsNeeded', date: '2026-11-25' }} handleChange={noop} />);
        expect(container).toBeEmptyDOMElement();
        rerender(<FollowupAppointmentFields formData={{ followup: 'Recommended', date: '2026-11-25' }} handleChange={noop} />);
        const date = container.querySelector('input[name="followupDate"]');
        expect(date.getAttribute('min')).toBe('2026-11-25');
        expect(date.getAttribute('max')).toBe('2026-12-09');
        expect(screen.getByLabelText('Patient convoqué par SMS')).toBeInTheDocument();
        rerender(<FollowupAppointmentFields formData={{ followup: 'Recommended', date: '2026-11-25', followupDate: '2026-12-20' }} handleChange={noop} />);
        expect(screen.getByText(/doit être fixé dans les 14 jours/)).toBeInTheDocument();
    });

    test('groupage coché : le groupe sanguin se renseigne ; blessure grave : convalescence annoncée', () => {
        render(<EmergencyDischargeFields formData={{ routineCare: ['BloodTyping'], clinicalConditions: ['plaie_arme_feu'], injuryDetails: [{ conditionId: 'plaie_arme_feu', region: 'cuisse', count: '1', precisions: [] }] }} setFormData={noop} handleChange={noop} />);
        expect(screen.getByText('Groupe sanguin (groupage)')).toBeInTheDocument();
        expect(screen.getByText(/Convalescence/)).toBeInTheDocument();
    });

    test('précisions sur les blessures : gravité proposée par ligne', () => {
        const { container } = render(<InjuryDetails formData={{ injuryDetails: [{ conditionId: 'plaie_arme_feu', region: 'cou', count: '1', precisions: [] }] }} setFormData={noop} ids={['plaie_arme_feu']} />);
        const select = container.querySelector('select[name="injuryGrade-plaie_arme_feu-0"]');
        expect(select).toBeTruthy();
        expect(select.options[0].textContent).toBe('Critique (proposée)');
    });
});
