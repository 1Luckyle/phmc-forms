import React from 'react';
import { render } from '@testing-library/react';
import PhmcEmployeeSelect, { withDmecOptions } from './PhmcEmployeeSelect';

let mockAuth = { staffName: 'Alaric Veyn', isAdmin: false };
jest.mock('../../contexts/EmployeeAuthContext', () => ({ useEmployeeAuth: () => mockAuth }));

const phmc = [{ label: 'Médecin Titulaire', options: [{ value: 'Dr. Rose Callahan', label: 'Dr. Rose Callahan', lastName: 'Callahan' }] }];
const coroner = [{ label: 'Enquêteur', options: [{ value: 'Alaric Veyn', label: 'Alaric Veyn (Enquêteur)' }] }];

describe('liste du personnel d’une Note de service', () => {
    test('les groupes du DMEC sont ajoutés à ceux du PHMC, préfixés « DMEC · »', () => {
        const options = withDmecOptions(phmc, coroner);
        expect(options.map((group) => group.label)).toEqual(['Médecin Titulaire', 'DMEC · Enquêteur']);
        expect(withDmecOptions(undefined, undefined)).toEqual([]);
    });

    test('un membre du DMEC est sélectionné d’office, avec son nom de famille déduit de son nom', () => {
        mockAuth = { staffName: 'Alaric Veyn', isAdmin: false };
        const setFormData = jest.fn();
        render(<PhmcEmployeeSelect options={withDmecOptions(phmc, coroner)} formData={{}} setFormData={setFormData} />);
        expect(setFormData).toHaveBeenCalled();
        const update = setFormData.mock.calls[0][0]({});
        expect(update).toMatchObject({ phmcEmployee: 'Alaric Veyn', lastName: 'Veyn', phmcEmployeeLastName: 'Veyn' });
    });
});
