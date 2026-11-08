import { getFormAccess, isPbcVersion, PBC_FORM_VERSIONS, PHMC_VERSION_OF_PBC } from './formAccess';

const careStaff = { type: 'phmc', rank: 'Médecin Titulaire' };

describe('le PBC n’a pas de service DMEC', () => {
    test('un membre du DMEC (seulement DMEC) n’a aucun formulaire PBC, même la Note de service', () => {
        const dmec = getFormAccess({ isAdmin: false, staffProfile: { type: 'coroner', rank: 'Stagiaire Médico-Légal(e)' } });
        expect(dmec.canAccess(23)).toBe(false);
        expect(dmec.canAccess(21)).toBe(false);
        expect(dmec.canAccess(22)).toBe(true);   // Note de service PHMC : ouverte à tout le personnel
        expect(dmec.canAccess(1)).toBe(true);    // ses formulaires DMEC
    });
    test('un soignant, ou un cumul soignant + DMEC, garde les formulaires PBC', () => {
        expect(getFormAccess({ isAdmin: false, staffProfile: careStaff }).canAccess(23)).toBe(true);
        expect(getFormAccess({ isAdmin: false, staffProfile: { ...careStaff, extraRanks: ['Stagiaire Médico-Légal(e)'] } }).canAccess(23)).toBe(true);
    });
});

describe('formulaires PBC activables par l’administration', () => {
    test('les cinq formulaires PBC sont reconnus, chacun a son équivalent PHMC', () => {
        expect(PBC_FORM_VERSIONS.sort()).toEqual([16, 21, 23, 29, 7]);
        expect(Object.keys(PHMC_VERSION_OF_PBC).map(Number).sort()).toEqual([16, 21, 23, 29, 7]);
        expect(isPbcVersion(21)).toBe(true);
        expect(isPbcVersion(20)).toBe(false);
    });

    test('activés (par défaut) : rien ne change', () => {
        expect(getFormAccess({ isAdmin: true }).canAccess(21)).toBe(true);
        expect(getFormAccess({ isAdmin: false, staffProfile: careStaff }).canAccess(21)).toBe(true);
    });

    test('désactivés : fermés à tous, administrateurs compris, les formulaires PHMC restent ouverts', () => {
        const admin = getFormAccess({ isAdmin: true, pbcEnabled: false });
        const staff = getFormAccess({ isAdmin: false, staffProfile: careStaff, pbcEnabled: false });
        PBC_FORM_VERSIONS.forEach((version) => {
            expect(admin.canAccess(version)).toBe(false);
            expect(staff.canAccess(version)).toBe(false);
        });
        [20, 22, 14, 28, 3].forEach((version) => {
            expect(admin.canAccess(version)).toBe(true);
        });
        expect(staff.canAccess(20)).toBe(true);
        expect(getFormAccess({ isAdmin: false, staffProfile: null, pbcEnabled: false }).canAccess(7)).toBe(false);
    });
});
