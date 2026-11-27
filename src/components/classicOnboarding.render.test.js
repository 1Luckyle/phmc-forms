import React from 'react';
import { render, screen } from '@testing-library/react';

// Version classique : le guide de configuration (étapes de connexion Civil et Personnel/DMEC) et le pied de page ne mentionnent jamais GTA World.
jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null }, app: {} }));
jest.mock('firebase/database', () => ({ ref: () => ({}), get: () => Promise.resolve({ exists: () => false, val: () => null }), set: () => Promise.resolve(), onValue: (r, cb) => { cb({ val: () => null }); return () => {}; } }));
jest.mock('../contexts/SiteConfigContext', () => ({
    useSiteMode: () => ({ isClassic: true, isGtaw: false, siteMode: 'classique' }),
    useSiteConfig: () => ({ bbcodeEnabled: true, pbcEnabled: true, bingoEnabled: true, siteMode: 'classique' }),
}));
jest.mock('../contexts/EmployeeAuthContext', () => ({ useEmployeeAuth: () => ({ currentEmployee: null, employeeProfile: null, requestEmployeeAccount: () => {}, loginEmployee: () => {}, createCivilianAccountFromGtaw: () => {} }) }));
jest.mock('../hooks/useWebhooks', () => ({ useWebhooks: () => ({ logWebhookToFirebase: () => {} }) }));
jest.mock('../hooks/useAuthMethodsConfig', () => ({ useAuthMethodsConfig: () => ({ gtawOnly: true }) }));

const OnboardingModal = require('./OnboardingModal').default;
const Footer = require('./Footer').default;
const GTAW = /GTA ?World|GTAW|Eyefind|Fleeca/i;

describe('guide de configuration et pied de page en version classique', () => {
    test.each([
        ['Civil', 'civilAuth', 'civilian'],
        ['Candidat', 'civilAuth', 'recruitment'],
        ['Personnel soignant', 'roleSpecific', 'phmcStaff'],
        ['Personnel administratif', 'roleSpecific', 'adminStaff'],
        ['DMEC', 'roleSpecific', 'coroner'],
    ])('%s : bouton Discord, aucune mention de GTA World', (label, step, userType) => {
        const { container } = render(<OnboardingModal show initialStep={step} initialUserType={userType} onComplete={() => {}} onSkip={() => {}} />);
        expect(screen.getByText('Continuer avec Discord')).toBeTruthy();
        expect(container.textContent).not.toMatch(GTAW);
    });

    test('pied de page', () => {
        const { container } = render(<Footer />);
        expect(container.textContent).not.toMatch(GTAW);
    });
});
