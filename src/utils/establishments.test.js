import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    effectiveEstablishment, normalizeEstablishment, ranksForEstablishment, servicesForEstablishment, recipientAllowedIn,
} from '../constants/establishments';
import { HOSPITAL_SERVICES } from '../constants/contractOptions';
import { ROLES } from '../constants/ranks';
import { getRoleInfo } from '../constants/ranks';
import { buildContractBb, emptyContractFields } from './contractDocs';
import { buildAgreementBb, emptyAgreementFields } from './commercialAgreements';
import generateAma from '../phmc-bbcode-generators/generateAma';
import { PHMC_FOOTER_MARK, PBC_FOOTER_MARK } from '../phmc-bbcode-generators/shared/bbStyles';
import EstablishmentPicker from '../components/EstablishmentPicker';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
let mockPbcEnabled = true;
jest.mock('../contexts/SiteConfigContext', () => ({ useSiteConfig: () => ({ pbcEnabled: mockPbcEnabled, bbcodeEnabled: true }) }));

const PHMC_LOGO = 'https://phmc-tools.com/img/phmc.png';
const PBC_LOGO = 'https://phmc-tools.com/img/phmcpaletobaylogo.png';
const DMEC_SMALL = 'https://phmc-tools.com/img/dmec-seal-small.png';
const header = (bb) => bb.split('[/divbox]')[0];

describe('établissement émetteur : règles', () => {
    test('PBC seulement s’il est demandé ET activé ; sinon PHMC', () => {
        expect(effectiveEstablishment('pbc', true)).toBe('pbc');
        expect(effectiveEstablishment('pbc', false)).toBe('phmc');
        expect(effectiveEstablishment('phmc', true)).toBe('phmc');
        expect(effectiveEstablishment(undefined, true)).toBe('phmc');
        expect(normalizeEstablishment('pbc')).toBe('pbc');
        expect(normalizeEstablishment('autre')).toBe('phmc');
    });
    test('le PBC n’a ni grade ni service du DMEC ; le PHMC garde tout', () => {
        expect(ranksForEstablishment(ROLES, 'phmc')).toHaveLength(ROLES.length);
        const pbcRanks = ranksForEstablishment(ROLES, 'pbc');
        expect(pbcRanks.length).toBeGreaterThan(0);
        expect(pbcRanks.some((rank) => rank.pole === 'dmec')).toBe(false);
        expect(servicesForEstablishment(HOSPITAL_SERVICES, 'phmc')).toContain('Médecine légale (DMEC)');
        expect(servicesForEstablishment(HOSPITAL_SERVICES, 'pbc')).not.toContain('Médecine légale (DMEC)');
        expect(servicesForEstablishment(HOSPITAL_SERVICES, 'pbc')).toContain('Urgences / traumatologie');
    });
    test('un membre ou un candidat du DMEC ne reçoit pas de document du PBC', () => {
        const pole = (role) => getRoleInfo(role)?.pole;
        expect(recipientAllowedIn({ service: 'coroner', kind: 'staff' }, 'pbc', pole)).toBe(false);
        expect(recipientAllowedIn({ service: 'coroner', kind: 'staff' }, 'phmc', pole)).toBe(true);
        expect(recipientAllowedIn({ service: 'phmc', kind: 'staff' }, 'pbc', pole)).toBe(true);
        expect(recipientAllowedIn({ kind: 'candidate', role: 'Médecin Légiste' }, 'pbc', pole)).toBe(false);
        expect(recipientAllowedIn({ kind: 'candidate', role: 'Infirmier(ère)' }, 'pbc', pole)).toBe(true);
    });
});

describe('contrats : logos et pied de page selon l’établissement', () => {
    const build = (over) => buildContractBb({
        type: 'cdi', service: 'phmc', employeeName: 'Jane Doe', issuer: { name: 'Dr. Rose Callahan', title: 'Directeur(trice)' }, id: 'c1', timestamp: Date.UTC(2026, 10, 18),
        champs: { ...emptyContractFields('cdi'), poste: 'Infirmière', role: 'Infirmier(ère)', dateDebut: '2026-12-01' }, ...over,
    });
    test('PHMC : logo du PHMC seul, pied de page du PHMC', () => {
        const { bbCode, reference } = build({ etablissement: 'phmc' });
        expect(header(bbCode)).toContain(`[img]${PHMC_LOGO}[/img]`);
        expect(header(bbCode)).not.toContain('phmcpaletobaylogo');
        expect(bbCode).toContain(PHMC_FOOTER_MARK);
        expect(bbCode).not.toContain(PBC_FOOTER_MARK);
        expect(reference).toMatch(/^PHMC-RH-/);
    });
    test('PBC : logos du PHMC et du PBC, pied de page de la clinique, employeur « par sa clinique »', () => {
        const { bbCode, reference } = build({ etablissement: 'pbc' });
        expect(header(bbCode)).toContain(`[img=90]${PHMC_LOGO}[/img][img=90]${PBC_LOGO}[/img]`);
        expect(bbCode).toContain(PBC_FOOTER_MARK);
        expect(bbCode).not.toContain(PHMC_FOOTER_MARK);
        expect(bbCode).toContain('agissant par sa clinique de Paleto Bay (PBC)');
        expect(reference).toMatch(/^PBC-RH-/);
    });
    test('DMEC (PHMC) : logo du PHMC et petit sceau du DMEC ; le PBC l’emporte sur le DMEC', () => {
        const dmec = build({ service: 'coroner', etablissement: 'phmc', champs: { ...emptyContractFields('cdi'), poste: 'Médecin légiste', role: 'Médecin Légiste', dateDebut: '2026-12-01' } }).bbCode;
        expect(header(dmec)).toContain(`[img=90]${PHMC_LOGO}[/img][img=72]${DMEC_SMALL}[/img]`);
        expect(dmec).toContain(PHMC_FOOTER_MARK);
        const pbcOnDmec = build({ service: 'coroner', etablissement: 'pbc' }).bbCode;
        expect(header(pbcOnDmec)).not.toContain(DMEC_SMALL);
    });
    test('sans établissement (anciens documents) : PHMC', () => {
        expect(header(build({}).bbCode)).not.toContain('phmcpaletobaylogo');
    });
});

describe('accords commerciaux : logos et pied de page selon l’établissement', () => {
    const build = (etablissement) => buildAgreementBb({
        type: 'fournisseur', etablissement, issuer: { name: 'Dr. Rose Callahan', title: 'Directeur(trice)' }, id: 'a1', timestamp: Date.UTC(2026, 10, 18),
        champs: { ...emptyAgreementFields('fournisseur'), titre: 'Fourniture', objet: 'Matériel', partieNom: 'MediSupply', partieSiege: 'Los Santos', representantNom: 'Marie Martin' },
    }).bbCode;
    test('PHMC par défaut', () => {
        const bb = build(undefined);
        expect(header(bb)).not.toContain('phmcpaletobaylogo');
        expect(bb).toContain(PHMC_FOOTER_MARK);
    });
    test('PBC : deux logos, pied de page de la clinique, le PHMC contracte par sa clinique', () => {
        const bb = build('pbc');
        expect(header(bb)).toContain(`[img=90]${PHMC_LOGO}[/img][img=90]${PBC_LOGO}[/img]`);
        expect(bb).toContain(PBC_FOOTER_MARK);
        expect(bb).not.toContain(PHMC_FOOTER_MARK);
        expect(bb).toContain('agissant par sa clinique de Paleto Bay (PBC)');
        expect(bb).toContain('« [b]le PHMC[/b] »');
    });
});

describe('AMA : logos et pied de page selon l’établissement', () => {
    const params = { patientName: 'Jean Testard', date: '18/11/2026 17:01', paramedicName: 'Dr. Rose Callahan' };
    test('PHMC : logo du PHMC et pied de page du PHMC (nouveau)', () => {
        const bb = generateAma(params);
        expect(header(bb)).toContain(`[img]${PHMC_LOGO}[/img]`);
        expect(header(bb)).not.toContain('phmcpaletobaylogo');
        expect(bb).toContain('Pillbox Hill Emergency Medical Service');
        expect(bb.endsWith('[/center]')).toBe(true);
        expect(bb).toContain(PHMC_FOOTER_MARK);
        expect(bb.split(PHMC_FOOTER_MARK)).toHaveLength(2);
    });
    test('PBC : deux logos, la clinique est dégagée de responsabilité, pied de page de la clinique', () => {
        const bb = generateAma({ ...params, etablissement: 'pbc' });
        expect(header(bb)).toContain(`[img=90]${PHMC_LOGO}[/img][img=90]${PBC_LOGO}[/img]`);
        expect(bb).toContain('Clinique PHMC de Paleto Bay (PBC)');
        expect(bb).not.toContain('Pillbox Hill Emergency Medical Service');
        expect(bb).toContain(PBC_FOOTER_MARK);
        expect(bb).not.toContain(PHMC_FOOTER_MARK);
    });
});

describe('sélecteur PHMC / PBC', () => {
    test('affiché quand le PBC est activé : PHMC par défaut, changement possible', () => {
        mockPbcEnabled = true;
        const onChange = jest.fn();
        render(<EstablishmentPicker value="phmc" onChange={onChange} label="Document émis par" />);
        expect(screen.getByLabelText(/PHMC/)).toBeChecked();
        fireEvent.click(screen.getByLabelText(/PBC/));
        expect(onChange).toHaveBeenCalledWith('pbc');
    });
    test('disparaît quand les formulaires PBC sont désactivés', () => {
        mockPbcEnabled = false;
        const { container } = render(<EstablishmentPicker value="pbc" onChange={() => {}} />);
        expect(container).toBeEmptyDOMElement();
        mockPbcEnabled = true;
    });
});
