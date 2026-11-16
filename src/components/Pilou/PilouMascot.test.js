import React from 'react';
import { render, screen } from '@testing-library/react';
import PilouMascot, { MOODS, PilouSays } from './PilouMascot';

describe('Pilou le poulpe', () => {
    test.each(MOODS)('humeur « %s » : un dessin complet, huit bras, stéthoscope', (mood) => {
        const { container } = render(<PilouMascot mood={mood} />);
        const svg = container.querySelector('svg.pl-mascot');
        expect(svg.getAttribute('data-mood')).toBe(mood);
        expect(svg.querySelectorAll('.pl-arm')).toHaveLength(8);
        expect(svg.querySelectorAll('circle').length).toBeGreaterThan(5);
    });
    test('humeur inconnue : retombe sur « neutral » ; texte alternatif ou décoratif', () => {
        const { container, rerender } = render(<PilouMascot mood="furieux" />);
        expect(container.querySelector('svg').getAttribute('data-mood')).toBe('neutral');
        expect(screen.getByRole('img', { name: 'Pilou, la mascotte' })).toBeTruthy();
        rerender(<PilouMascot label="" />);
        expect(screen.queryByRole('img')).toBeNull();
        expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    });
    test('animation désactivable ; taille respectée', () => {
        const { container } = render(<PilouMascot animated={false} size={50} />);
        const svg = container.querySelector('svg');
        expect(svg.classList.contains('animated')).toBe(false);
        expect(svg.getAttribute('width')).toBe('50');
    });
    test('PilouSays : la mascotte et sa bulle', () => {
        render(<PilouSays><p>Bonjour !</p></PilouSays>);
        expect(screen.getByText('Bonjour !')).toBeTruthy();
    });
});
