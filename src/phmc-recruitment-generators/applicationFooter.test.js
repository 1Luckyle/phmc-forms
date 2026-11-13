jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import generatePhysician from './generatePhysician';
import generatePsych from './generatePsych';
import generateAdmin from './generateAdmin';
import generateNursing from './generateNursing';
import generateCoroner from './generateCoroner';
import generateEMS from './generateEMS';
import { PHMC_FOOTER_MARK, PBC_FOOTER_MARK } from '../phmc-bbcode-generators/shared/bbStyles';

describe('candidatures : pied de page du centre', () => {
    const generators = { generatePhysician, generatePsych, generateAdmin, generateNursing, generateCoroner, generateEMS };

    test.each(Object.entries(generators))('%s : le pied de page du PHMC termine le document, une seule fois', (name, generate) => {
        const text = generate({ applicantLocation: 'PHMC', applicantFirstName: 'Jean', applicantLastName: 'Test' });
        expect(text).toContain('Pillbox Hill Medical Center');
        expect(text.split(PHMC_FOOTER_MARK)).toHaveLength(2);
        expect(text).not.toContain(PBC_FOOTER_MARK);
        expect(text.trim().endsWith('[/center]')).toBe(true);
        // Le pied de page est après le dernier bandeau (informations hors personnage).
        expect(text.indexOf(PHMC_FOOTER_MARK)).toBeGreaterThan(text.indexOf('Informations hors personnage'));
    });

    test('candidature à la clinique de Paleto Bay : le pied de page de la clinique, pas celui du PHMC', () => {
        const text = generatePhysician({ applicantLocation: 'PBC' });
        expect(text).toContain(PBC_FOOTER_MARK);
        expect(text).not.toContain(PHMC_FOOTER_MARK);
        expect(text.split(PBC_FOOTER_MARK)).toHaveLength(2);
    });
});
