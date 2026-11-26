import React from 'react';
import { render, screen } from '@testing-library/react';

let mockMode = 'classique';
let mockAuth = { currentEmployee: { uid: 'u1' }, isCivilian: false, staffName: 'Dr. Test' };
jest.mock('../../firebase', () => ({ database: {}, auth: { currentUser: { uid: 'u1' } } }));
jest.mock('firebase/database', () => ({ ref: () => ({}), get: () => Promise.resolve({ exists: () => false, val: () => null }), set: () => Promise.resolve(), update: () => Promise.resolve(), remove: () => Promise.resolve() }));
jest.mock('../../contexts/SiteConfigContext', () => ({ useSiteMode: () => ({ isClassic: mockMode === 'classique', isGtaw: mockMode !== 'classique', siteMode: mockMode }) }));
jest.mock('../../contexts/EmployeeAuthContext', () => ({ useEmployeeAuth: () => mockAuth }));
jest.mock('../../utils/temporaryIds', () => ({
    isTemporaryId: (value) => /^TMP-/.test(String(value || '')),
    loadTemporaryIds: () => Promise.resolve({}),
    registerTemporaryId: () => Promise.resolve('TMP-AB2CD'),
    findTemporaryIdsByName: () => [],
    requestRealIdAssignment: () => Promise.resolve(),
}));

const CarePatientTemporaryId = require('./CarePatientTemporaryId').default;
const GENERATE = "Pas d'ID patient : générer un ID temporaire";

describe('ID temporaire sous l’ID patient des formulaires du personnel', () => {
    beforeEach(() => { mockMode = 'classique'; mockAuth = { currentEmployee: { uid: 'u1' }, isCivilian: false, staffName: 'Dr. Test' }; });

    test('version classique, personnel, ID vide : le bouton est proposé', () => {
        render(<CarePatientTemporaryId formData={{ patientID: '' }} setFormData={() => {}} />);
        expect(screen.getByText(GENERATE)).toBeTruthy();
    });

    test('ID temporaire saisi : rappel et demande d’attribution', () => {
        render(<CarePatientTemporaryId formData={{ patientID: 'TMP-AB2CD' }} setFormData={() => {}} />);
        expect(screen.getByText(/ID temporaire TMP-AB2CD/)).toBeTruthy();
    });

    test('rien en version GTA World, pour un compte Civil, ni avec un vrai ID', () => {
        mockMode = 'gtaw';
        const { container, rerender } = render(<CarePatientTemporaryId formData={{ patientID: '' }} setFormData={() => {}} />);
        expect(container.innerHTML).toBe('');
        mockMode = 'classique';
        mockAuth = { currentEmployee: { uid: 'c1' }, isCivilian: true };
        rerender(<CarePatientTemporaryId formData={{ patientID: '' }} setFormData={() => {}} />);
        expect(container.innerHTML).toBe('');
        mockAuth = { currentEmployee: { uid: 'u1' }, isCivilian: false, staffName: 'Dr. Test' };
        rerender(<CarePatientTemporaryId formData={{ patientID: 'PHMC-01234' }} setFormData={() => {}} />);
        expect(container.innerHTML).toBe('');
    });
});
