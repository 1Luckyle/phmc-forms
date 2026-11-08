import generateMedicalRecordRelease from './generateMedicalRecordRelease';
import generateBasicPatientFile from './generateBasicPatientFile';
import generateAdvancedPatientFile from './generateAdvancedPatientFile';
import generateMedicalFileUpdate from './generateMedicalFileUpdate';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn() }));

const base = {
    patientID: 'PHMC-2752', patientTitle: 'Mrs', patientFirstName: 'Jane', patientMiddleName: 'Marie', patientLastName: 'Doe', patientName: 'Jane Marie Doe',
    patientDateOfBirth: '1990-05-14', patientGender: 'Femme', patientRace: 'Caucasien(ne)', patientAddress: '12 Elgin Ave, étage 3', patientZIP: '90012',
    patientPH: '555-0142', patientEmail: 'jane@mail.eyefind.fr', patientDiscord: 'jane#1',
    patientEmergencyContact: 'John Doe', patientEmergencyContactRelation: 'Frère', patientEmergencyContactNumber: '555-0199',
    patientBloodType: 'A+', patientAllergies: 'Pénicilline ; Latex ; poussière', patientCurrentMedicine: 'Paracétamol', patientChronicDiseases: 'Asthme', patientNotes: 'Fracture',
    maritalStatus: 'Single', numberChildren: '2', financialStatus: 'MiddleIncome', date: '2026-11-02',
    CarePurposeMedicalInformationRelease: 'Other', patientMedInfoReleaseOther: 'Assurance', PurposeMedicalInformationReleaseFormat: 'CopyofRecords',
    StupidDateFrom: '2026-01-01', StupidDateTo: '2026-10-30', MedicalRecordsRelease: ['ERVisit', 'Other'], MedicalRecordsReleaseOther: 'Radios', phmcEmployee: 'Dr Who',
    UpdateMedicalFile: ['GeneralInformation', 'EmergencyContact', 'Medical History', 'MentalHealth', 'FamilyHistory', 'Lifestyle'], patientTitleOptions: 'Mrs', patientTitleNew: 'Mr',
    patientFirstNameNew: 'Jane', patientNameNew: 'Jane Smith', patientPHNew: '555-0000', patientGenderNew: 'Femme', patientRaceNew: 'Autre',
    patientMental: 'Dépression', filledByStaff: false, payNow: true, paymentProofPhotos: 'https://img/1.png',
};

test('les quatre rapports de dossier médical se construisent sans retour à la ligne oublié ni doublé', () => {
    const out = {
        release: generateMedicalRecordRelease(base),
        basic: generateBasicPatientFile(base),
        advanced: generateAdvancedPatientFile(base),
        update: generateMedicalFileUpdate(base),
    };
    Object.values(out).forEach((text) => expect(text.length).toBeGreaterThan(200));
    expect(out.update).toContain('Historique médical');
    expect(out.update).toContain('mode de vie');
    expect(out.release).toContain('[cbc] Autre: Assurance');
});

test('aucune ligne vide doublée entre deux rubriques, aucun espace en début de ligne', () => {
    [generateMedicalRecordRelease, generateBasicPatientFile, generateAdvancedPatientFile, generateMedicalFileUpdate].forEach((generate) => {
        const text = generate(base);
        // Les paragraphes des textes juridiques sont séparés par UNE ligne vide ; jamais deux.
        expect(text).not.toMatch(/\n\n\n/);
        // Un bandeau de section commence toujours en début de ligne.
        expect(text).not.toMatch(/\n +\[divboxcolor/);
    });
});

test('la libération médicale liste les rapports retenus avec leur médecin, et rien sans sélection', () => {
    const withReports = generateMedicalRecordRelease({
        ...base,
        phmcEmployee: 'Alice Martin, Bob Durand',
        releaseReports: [
            { k: 'a', t: 'Protocole urgence 12/03', a: 'Alice Martin', v: 19, ts: new Date('2026-03-12T10:00:00').getTime() },
            { k: 'b', t: 'Opération', a: 'Bob Durand', v: 5, ts: new Date('2026-04-01T10:00:00').getTime() },
        ],
    });
    expect(withReports).toContain('Praticien consulté: [/td][td] Alice Martin, Bob Durand');
    expect(withReports).toContain('Rapports retenus');
    expect(withReports).toContain('[tr][td] Protocole urgence 12/03 [/td][td] 12/03/2026 [/td][td] Alice Martin');
    expect(withReports).not.toMatch(/\n\n\n/);
    expect(generateMedicalRecordRelease(base)).not.toContain('Rapports retenus');
});
