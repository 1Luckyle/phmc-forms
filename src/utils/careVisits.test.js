jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import { careVisitSummary, careVisitsFromIndex, CARE_VISIT_VERSIONS } from './careVisitSummary';
import { dossierBbCode, careVisitsBBCode } from './dossierView';
import { dossierPrefillPatch } from './dossierPrefill';
import { extractDossierValues, MEDICAL_FIELDS, BASIC_FIELDS, ADVANCED_FIELDS } from './dossierCore';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';
import generateBasicPatientFile from '../phmc-bbcode-generators/generateBasicPatientFile';
import generateMedicalFileUpdate from '../phmc-bbcode-generators/generateMedicalFileUpdate';
import { bodyMeasuresText } from '../phmc-bbcode-generators/shared/bodyMeasures';

const urgences = {
    date: '2026-11-11', patientChiefComplaint: 'Chute de deux mètres', patientDiagnosis: 'Fracture du poignet', patientSecondaryDiagnosis: 'Aucun', patientProcedure: 'Immobilisation, antalgiques',
    dischargeDestination: 'ObservationBox', clinicalMeds: [{ medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3 }],
};

describe('poids et taille dans le dossier médical', () => {
    test('le dossier les porte (formulaires basique, avancé et mise à jour) et les formulaires les connaissent', () => {
        expect(MEDICAL_FIELDS).toEqual(expect.arrayContaining(['patientWeight', 'patientHeight']));
        expect(BASIC_FIELDS).toEqual(expect.arrayContaining(['patientWeight', 'patientHeight']));
        expect(ADVANCED_FIELDS).toEqual(expect.arrayContaining(['patientWeight', 'patientHeight']));
        [3, 25, 26].forEach((version) => expect(Object.keys(VERSION_FIELDS[version])).toEqual(expect.arrayContaining(['patientWeight', 'patientHeight'])));
        expect(extractDossierValues(25, { patientWeight: '75', patientHeight: '178' }).values).toMatchObject({ patientWeight: '75', patientHeight: '178' });
        expect(extractDossierValues(26, { UpdateMedicalFile: ['Medical History'], patientWeight: '80', patientHeight: '' }).values).toMatchObject({ patientWeight: '80', patientHeight: '' });
    });

    test('affichage : unités ajoutées, valeur illisible reprise telle quelle', () => {
        expect(bodyMeasuresText('75', '178')).toBe('75 kg / 178 cm');
        expect(bodyMeasuresText('80,5 kg', '1,80')).toBe('80,5 kg / 180 cm');
        expect(bodyMeasuresText('beaucoup', '')).toBe('beaucoup');
        expect(bodyMeasuresText('', '')).toBe('Non renseigné');
        expect(generateBasicPatientFile({ patientWeight: '75', patientHeight: '178' })).toContain('Poids / taille: [/td][td] 75 kg / 178 cm');
        expect(generateMedicalFileUpdate({ UpdateMedicalFile: ['Medical History'], patientWeight: '75', patientHeight: '178' })).toContain('75 kg / 178 cm');
        expect(dossierBbCode({ patientWeight: '75', patientHeight: '178' }, { patientID: 'PHMC-1' })).toContain('75 kg / 178 cm');
    });

    test('les formulaires de soins reprennent le poids et la taille du dossier, sans écraser une saisie', () => {
        const donnees = { patientWeight: '75', patientHeight: '178' };
        [5, 19, 20, 21].forEach((version) => expect(dossierPrefillPatch(version, donnees, {}, Object.keys(VERSION_FIELDS[version]))).toMatchObject({ patientWeight: '75', patientHeight: '178' }));
        expect(dossierPrefillPatch(19, donnees, { patientWeight: '70' }, Object.keys(VERSION_FIELDS[19]))).toEqual(expect.objectContaining({ patientHeight: '178' }));
        expect(dossierPrefillPatch(19, donnees, { patientWeight: '70' }, Object.keys(VERSION_FIELDS[19])).patientWeight).toBeUndefined();
        // L'évaluation physique affiche la valeur telle quelle : elle porte son unité.
        expect(dossierPrefillPatch(6, donnees, {}, Object.keys(VERSION_FIELDS[6]))).toMatchObject({ patientWeight: '75 kg', patientHeight: '178 cm' });
        expect(dossierPrefillPatch(26, donnees, {}, Object.keys(VERSION_FIELDS[26]))).toMatchObject({ patientWeight: '75', patientHeight: '178' });
    });
});

describe('historique des soins dans le dossier', () => {
    test('un résumé pour les urgences, les consultations et les opérations ; rien pour la santé mentale', () => {
        expect(CARE_VISIT_VERSIONS).toEqual([5, 19, 20, 21]);
        expect(careVisitSummary(19, urgences)).toEqual({
            date: '2026-11-11', motif: 'Chute de deux mètres', diagnostic: 'Fracture du poignet', soins: 'Immobilisation, antalgiques', traitement: 'Paracétamol', sortie: 'Box de surveillance',
        });
        expect(careVisitSummary(20, { ...urgences, orientedService: 'InternalMedicine' }).sortie).toBeTruthy();
        expect(careVisitSummary(5, { date: '2026-11-11', surgeryProcedures: 'Appendicectomie', surgeryPreOpDiagnosis: 'Appendicite aiguë', surgeryAnesthesiaType: 'General', patientComplicationOptions: 'No', procedureGoodOptions: 'Yes' }))
            .toEqual({ date: '2026-11-11', intervention: 'Appendicectomie', indication: 'Appendicite aiguë', anesthesie: 'générale', complications: 'Aucune', resultat: 'Procédure réussie' });
        [14, 16, 28, 29, 6, 7, 3].forEach((version) => expect(careVisitSummary(version, urgences)).toBeNull());
        // Les crochets d'une saisie ne deviennent pas des balises BBCode.
        expect(careVisitSummary(19, { patientChiefComplaint: 'douleur [b]forte[/b]' }).motif).toBe('douleur bforte/b');
    });

    test("le dossier ne liste que les rapports encore présents : ni copie, ni rapport retiré, ni autre formulaire", () => {
        const base = { reportPath: 'savedReports/x/y', bbCodeVersion: 19, timestamp: Date.UTC(2026, 10, 11), creatorName: 'Dr. Test', resume: { date: '2026-11-11', motif: 'Chute' } };
        const visits = careVisitsFromIndex({
            a: base,
            b: { ...base, copiedFrom: { reportPath: 'x' } },
            c: { ...base, ownerDeleted: true },
            d: { ...base, bbCodeVersion: 14 },
            e: { ...base, reportPath: '' },
            f: { ...base, bbCodeVersion: 5, resume: { date: '2026-10-01', intervention: 'Appendicectomie' }, timestamp: Date.UTC(2026, 9, 1) },
            g: { ...base, resume: undefined, timestamp: Date.UTC(2026, 9, 15) },
        });
        expect(visits.map((v) => v.key)).toEqual(['a', 'g', 'f']);
        // Un rapport supprimé n'a plus d'entrée d'index : il n'y a plus rien à afficher.
        expect(careVisitsFromIndex({})).toEqual([]);
        expect(visits[1]).toMatchObject({ date: '2026-10-15', resume: null });
    });

    test('section « Historique des soins » du dossier', () => {
        const visits = careVisitsFromIndex({ a: { reportPath: 'p', bbCodeVersion: 19, timestamp: 1, creatorName: 'Dr. Test', resume: careVisitSummary(19, urgences) } });
        const bb = careVisitsBBCode(visits);
        expect(bb).toContain('Historique des soins');
        expect(bb).toContain("[b]Protocole d'urgence[/b] (Dr. Test)");
        expect(bb).toContain('[i]Diagnostic :[/i] Fracture du poignet');
        expect(bb).toContain('11/11/2026');
        expect(careVisitsBBCode([])).toBe('');
        const dossier = dossierBbCode({ patientBloodType: 'O+' }, { patientID: 'PHMC-1' }, { visits });
        expect(dossier).toContain('Historique des soins');
        expect(dossier.indexOf('Historique des soins')).toBeLessThan(dossier.lastIndexOf('Pillbox Hill Medical Center'));
        expect(dossierBbCode({ patientBloodType: 'O+' }, { patientID: 'PHMC-1' })).not.toContain('Historique des soins');
    });
});
