jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import generatePhysician from './generatePhysician';
import generatePsych from './generatePsych';
import generateAdmin from './generateAdmin';
import generateNursing from './generateNursing';
import generateCoroner from './generateCoroner';
import generateEMS from './generateEMS';
import { PHMC_FOOTER_MARK, PBC_FOOTER_MARK, PHMC_LOGO, PBC_LOGO, DMEC_LOGO_SMALL } from '../phmc-bbcode-generators/shared/bbStyles';

describe('candidatures : logos de l\'en-tête', () => {
    test('DMEC : le petit sceau du DMEC est à côté du logo du PHMC, comme sur les rapports du DMEC', () => {
        const text = generateCoroner({ applicantLocation: 'PHMC', applicantFirstName: 'Jean', applicantLastName: 'Test' });
        expect(text).toContain(`[img]${PHMC_LOGO}[/img][img]${DMEC_LOGO_SMALL}[/img]`);
        expect(text.split(DMEC_LOGO_SMALL)).toHaveLength(2);
    });
    test('les autres candidatures n\'ont pas le sceau du DMEC', () => {
        [generatePhysician, generatePsych, generateAdmin, generateNursing, generateEMS].forEach((generate) => {
            const text = generate({ applicantLocation: 'PHMC' });
            expect(text).not.toContain(DMEC_LOGO_SMALL);
            expect(text).toContain(`[img]${PHMC_LOGO}[/img]`);
        });
    });
    test('candidature DMEC à la clinique de Paleto Bay : logo de la clinique, avec le sceau à côté', () => {
        const text = generateCoroner({ applicantLocation: 'PBC' });
        expect(text).toContain(`[img]${PBC_LOGO}[/img][img]${DMEC_LOGO_SMALL}[/img]`);
        expect(text).not.toContain(`[img]${PHMC_LOGO}[/img]`);
    });
});

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
