import { getDebugTemplate, hasDebugTemplate } from './debugTemplates';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';
import { requiredFieldsOf } from './formRulesCore';
import { isFieldApplicable } from './fieldApplicability';
import { validateReport } from './formValidation';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn() }));

// Champs techniques que le remplissage debug pose et qui ne sont pas des champs saisis (paiement, identité du personnel, tableaux).
const TECHNICAL = new Set([
    'applicantTitleAndFullName', 'payNow', 'isExempt', 'fleecaPaymentId', 'paymentProofPhotos', 'filledByStaff', 'lastName', 'phmcEmployee', 'phmcEmployeeLastName', 'surgeonEmployee', 'externalMailBodyHtml', 'externalMailDate', 'coronerEmployee',
    'coronerBadge', 'coronerRank', 'coronerDiscord', 'chiefCoronerEmployee', 'chiefCoronerBadge', 'chiefCoronerRank', 'chiefCoronerDiscord', 'decedents',
    'caseNumber', 'recruitmentPosition', 'phmcSignature', 'additionalReports', 'date', 'UpdateMedicalFile', 'patientTitleOptions',
    // Nom complet recomposé à partir des trois champs (prénom, deuxième prénom, nom) : voir usePatientNameParts.
    'patientName', 'patientNameNew', 'decedentName', 'witnessName',
    // Champs dont la saisie n'a pas d'attribut `name` (listes, sélecteurs, tableaux) et que le catalogue ne voit donc pas.
    'morgueStatus', 'autopsyDeathCauses', 'autopsyAnatomicSummaryItems', 'evidenceLocker', 'scenePhotos', 'XrayResults', 'ctResults', 'mriResults', 'ultrasoundResults',
]);
const isPresetPart = (key) => /(Presets|Free)$/.test(key);

describe('remplissage debug : à tenir à jour avec chaque formulaire', () => {
    const versions = Object.keys(VERSION_FIELDS).map(Number);

    test.each(versions)('le formulaire %i a un gabarit de remplissage', (version) => {
        expect(hasDebugTemplate(version)).toBe(true);
    });

    test.each(versions.filter((v) => hasDebugTemplate(v)))('le gabarit du formulaire %i ne remplit que des champs qui existent', (version) => {
        const filled = Object.keys(getDebugTemplate(version, {}) || {});
        const known = new Set(Object.keys(VERSION_FIELDS[version]));
        const unknown = filled.filter((key) => !known.has(key) && !TECHNICAL.has(key) && !isPresetPart(key));
        expect(unknown).toEqual([]);
    });

    test.each(versions.filter((v) => hasDebugTemplate(v) && v < 50))('le gabarit du formulaire %i remplit tous ses champs obligatoires', (version) => {
        const template = getDebugTemplate(version, {}) || {};
        // Un champ conditionnel qui ne s'affiche pas avec ces données (représentant légal d'un majeur…) n'a pas à être rempli (voir fieldApplicability.js).
        const missing = requiredFieldsOf(version).filter((key) => isFieldApplicable(version, key, template) && (template[key] === undefined || template[key] === ''));
        // Le médecin et le défunt viennent de l'identité connectée ou d'un autre champ : seuls les champs propres au formulaire sont vérifiés ici.
        expect(missing.filter((key) => !TECHNICAL.has(key))).toEqual([]);
    });
});

describe('le remplissage debug produit un rapport enregistrable', () => {
    const reportVersions = Object.keys(VERSION_FIELDS).map(Number).filter((v) => v < 50 && hasDebugTemplate(v) && ![41].includes(v));
    test.each(reportVersions)('formulaire %i : aucune erreur de validation après « Remplir (debug) »', (version) => {
        // Identité du personnel : fournie par la session connectée (listes des praticiens et des médecins légistes).
        const ctx = { phmcOptions: [{ value: 'Dr Test', lastName: 'Test' }], coronerOptions: [{ value: 'Dr Légiste', badge: '1', rank: 'Coroner', phone: '555-0100', email: 'dr.legiste@phmc.health' }] };
        const errors = validateReport(version, getDebugTemplate(version, ctx) || {}).errors;
        expect(errors).toEqual([]);
    });
});
