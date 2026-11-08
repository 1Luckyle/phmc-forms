import {
    DOSSIER_WINDOW_MS, extractDossierValues, isContactOnlyUpdate, profilePatch, formPhase, dossierAccess, canModifyForm, refundsToken, hasToken, dossierKindOf,
} from './dossierCore';

const T0 = 1_000_000_000_000;

describe('ce qu’un formulaire apporte au dossier', () => {
    test('le dossier initial reprend les champs renseignés, un champ vide n’efface rien', () => {
        const { values } = extractDossierValues(25, { patientFirstName: 'Jean', patientBloodType: 'A+', patientAllergies: '', patientDateOfBirth: '1990-05-14', patientMental: 'ne fait pas partie du basique' });
        expect(values).toEqual({ patientFirstName: 'Jean', patientBloodType: 'A+', patientDateOfBirth: '1990-05-14' });
        expect(extractDossierValues(3, { patientMental: 'anxiété' }).values).toEqual({ patientMental: 'anxiété' });
    });

    test('la mise à jour n’applique que les sections choisies, le général vient des champs « New », et un champ vidé est bien vidé', () => {
        const { values } = extractDossierValues(26, {
            UpdateMedicalFile: ['GeneralInformation', 'Medical History'],
            patientFirstName: 'ANCIEN', patientFirstNameNew: 'Jeanne', patientPHNew: '555-0101', patientAllergies: '', patientBloodType: 'O-',
            patientMental: 'hors section',
        });
        expect(values).toMatchObject({ patientFirstName: 'Jeanne', patientPH: '555-0101', patientAllergies: '', patientBloodType: 'O-' });
        expect(values).not.toHaveProperty('patientMental');
    });

    test('le courriel n’est jamais modifié par un formulaire', () => {
        expect(extractDossierValues(25, { patientEmail: 'x@y.fr' }).values).toEqual({});
        expect(extractDossierValues(26, { UpdateMedicalFile: ['GeneralInformation'], patientEmail: 'x@y.fr' }).values).toEqual({});
    });
});

describe('mise à jour gratuite', () => {
    test('coordonnées seules : gratuite ; identité payante, autre section ou plusieurs sections : payante', () => {
        expect(isContactOnlyUpdate({ UpdateMedicalFile: ['GeneralInformation'], patientPHNew: '555', patientAddressNew: '1 rue' })).toBe(true);
        expect(isContactOnlyUpdate({ UpdateMedicalFile: ['GeneralInformation'], patientDateOfBirthNew: '1990-01-01' })).toBe(false);
        expect(isContactOnlyUpdate({ UpdateMedicalFile: ['GeneralInformation'], patientGenderNew: 'Femme' })).toBe(false);
        expect(isContactOnlyUpdate({ UpdateMedicalFile: ['GeneralInformation', 'MentalHealth'], patientPHNew: '555' })).toBe(false);
        expect(isContactOnlyUpdate({ UpdateMedicalFile: ['Medical History'] })).toBe(false);
        expect(isContactOnlyUpdate({ UpdateMedicalFile: [] })).toBe(false);
    });
    test('les coordonnées du dossier se reportent sur le profil du compte', () => {
        expect(profilePatch({ patientFirstName: 'Jeanne', patientPH: '555', patientAllergies: 'x', patientDateOfBirth: '1990-01-01' }))
            .toEqual({ firstName: 'Jeanne', phone: '555', dateOfBirth: '1990-01-01' });
    });
});

describe('délai de 15 minutes', () => {
    test('à payer : brouillon, rien ne court', () => {
        expect(formPhase({ createdAt: T0, invoice: { statut: 'a_payer' } }, T0 + DOSSIER_WINDOW_MS * 5).phase).toBe('brouillon');
    });
    test('payé : le délai court depuis le paiement, pas depuis l’enregistrement', () => {
        const invoice = { statut: 'paye', payeLe: T0 + 60 * 60 * 1000 };
        expect(formPhase({ createdAt: T0, invoice }, T0 + 60 * 60 * 1000 + 14 * 60 * 1000).phase).toBe('fenetre');
        const done = formPhase({ createdAt: T0, invoice }, T0 + 60 * 60 * 1000 + DOSSIER_WINDOW_MS);
        expect(done.phase).toBe('verrouille');
        expect(done.lockAt).toBe(T0 + 60 * 60 * 1000 + DOSSIER_WINDOW_MS);
    });
    test('gratuit (exemption, jeton, pas de facture) : le délai court depuis l’enregistrement ; une mise à jour de coordonnées est immédiate', () => {
        expect(formPhase({ createdAt: T0, invoice: { statut: 'sans_paiement' } }, T0 + 60 * 1000).phase).toBe('fenetre');
        expect(formPhase({ createdAt: T0, invoice: null }, T0 + DOSSIER_WINDOW_MS).phase).toBe('verrouille');
        expect(formPhase({ createdAt: T0, invoice: null, immediate: true }, T0).phase).toBe('verrouille');
    });
});

describe('quels formulaires un patient peut ouvrir', () => {
    test('sans dossier : basique ou avancé, pas de mise à jour', () => {
        const access = dossierAccess({ forms: [], dossier: null });
        expect(access).toMatchObject({ canCreateBasic: true, canCreateAdvanced: true, canCreateUpdate: false, initialised: false });
    });
    test('dossier initial en brouillon ou dans le délai : on le reprend, on n’en crée pas un autre, pas de mise à jour encore', () => {
        ['brouillon', 'fenetre'].forEach((phase) => {
            const access = dossierAccess({ forms: [{ key: 'a', version: 25, createur: 'patient', phase }], dossier: null });
            expect(access).toMatchObject({ canCreateBasic: false, canCreateAdvanced: false, canCreateUpdate: false });
            expect(access.initialForm.key).toBe('a');
        });
    });
    test('dossier initialisé (même basique) : plus de basique ni d’avancé, seulement la mise à jour', () => {
        const access = dossierAccess({ forms: [], dossier: { initial: { type: 'basique' } } });
        expect(access).toMatchObject({ canCreateBasic: false, canCreateAdvanced: false, canCreateUpdate: true, initialised: true });
        const locked = dossierAccess({ forms: [{ key: 'a', version: 3, createur: 'patient', phase: 'verrouille' }], dossier: null });
        expect(locked.canCreateUpdate).toBe(true);
    });
    test('après suppression du dossier initial dans le délai, on peut en refaire un', () => {
        expect(dossierAccess({ forms: [], dossier: null }).canCreateBasic).toBe(true);
    });
});

describe('qui peut modifier ou supprimer', () => {
    test('le patient : ses formulaires jusqu’à la fin du délai, jamais après', () => {
        const mine = (phase) => canModifyForm({ createur: 'patient', phase }, { role: 'patient' });
        expect(mine('brouillon')).toEqual({ edit: true, remove: true });
        expect(mine('fenetre')).toEqual({ edit: true, remove: true });
        expect(mine('verrouille')).toEqual({ edit: false, remove: false });
    });
    test('formulaire créé par le personnel : le patient n’y touche jamais, le créateur seulement en brouillon', () => {
        expect(canModifyForm({ createur: 'personnel', phase: 'brouillon' }, { role: 'patient' })).toEqual({ edit: false, remove: false });
        expect(canModifyForm({ createur: 'personnel', phase: 'brouillon' }, { role: 'personnel', isCreator: true })).toEqual({ edit: true, remove: true });
        expect(canModifyForm({ createur: 'personnel', phase: 'fenetre' }, { role: 'personnel', isCreator: true })).toEqual({ edit: false, remove: false });
        expect(canModifyForm({ createur: 'personnel', phase: 'brouillon' }, { role: 'personnel', isCreator: false })).toEqual({ edit: false, remove: false });
    });
    test('patient sans compte : le créateur garde le délai de 15 minutes sur son formulaire gratuit', () => {
        expect(canModifyForm({ createur: 'personnel', phase: 'fenetre', sansCompte: true }, { role: 'personnel', isCreator: true })).toEqual({ edit: true, remove: true });
        expect(canModifyForm({ createur: 'personnel', phase: 'verrouille', sansCompte: true }, { role: 'personnel', isCreator: true })).toEqual({ edit: false, remove: false });
        expect(canModifyForm({ createur: 'personnel', phase: 'fenetre', sansCompte: true }, { role: 'patient' })).toEqual({ edit: false, remove: false });
    });
    test('un administrateur peut toujours supprimer', () => {
        expect(canModifyForm({ createur: 'patient', phase: 'verrouille' }, { role: 'admin' }).remove).toBe(true);
    });
});

describe('jetons gratuits', () => {
    test('un jeton vaut pour le même formulaire seulement', () => {
        const tokens = { basique: 1, avance: 0, maj: 2 };
        expect(hasToken(tokens, 25)).toBe(true);
        expect(hasToken(tokens, 3)).toBe(false);
        expect(hasToken(tokens, 26)).toBe(true);
        expect(dossierKindOf(26)).toBe('maj');
    });
    test('supprimer dans le délai rend un jeton si le patient avait payé (ou utilisé un jeton), pas s’il n’avait rien payé', () => {
        expect(refundsToken({ createur: 'patient', invoice: { statut: 'paye' } })).toBe(true);
        expect(refundsToken({ createur: 'patient', invoice: { statut: 'sans_paiement' }, usedToken: true })).toBe(true);
        expect(refundsToken({ createur: 'patient', invoice: { statut: 'sans_paiement' } })).toBe(false);
        expect(refundsToken({ createur: 'personnel', invoice: { statut: 'paye' } })).toBe(false);
    });
});
