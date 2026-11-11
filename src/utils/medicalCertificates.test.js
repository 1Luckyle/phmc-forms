import { CERTIFICATE_TYPES, inclusiveDays, ittLabel, validateMedicalCertificate, buildCertificateContent } from './medicalCertificates';
import generateSicknessEmail from '../phmc-bbcode-generators/generateSicknessEmail';
import { staffSignatureBlock, withStaffSignature, hasStaffSignatureFooter, SIGNATURE_IMG_WIDTH } from '../phmc-bbcode-generators/shared/bbStyles';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));

describe('certificats médicaux (formulaire 35)', () => {
    test("l'ITT compte le jour de début et le jour de fin", () => {
        expect(inclusiveDays('2026-11-10', '2026-11-12')).toBe(3);
        expect(inclusiveDays('2026-11-10', '2026-11-10')).toBe(1);
        expect(inclusiveDays('2026-11-12', '2026-11-10')).toBeNull();
        expect(inclusiveDays('', '2026-11-10')).toBeNull();
        expect(ittLabel(1)).toBe('1 jour');
        expect(ittLabel(5)).toBe('5 jours');
    });

    test('chaque type exige ses propres champs', () => {
        expect(Object.keys(CERTIFICATE_TYPES)).toEqual(expect.arrayContaining(['Sickness Note', 'Illness Confirmation', 'Work Stoppage', 'Work Extension', 'Return To Work', 'Attendance', 'Fitness']));
        expect(validateMedicalCertificate({})).toEqual(["Choisissez le type de courrier (certificat de maladie, arrêt de travail, reprise…)."]);
        const stoppage = validateMedicalCertificate({ emailPurpose: 'Work Stoppage', emailRecipient: 'RH' });
        expect(stoppage).toEqual(expect.arrayContaining(['Indiquez la date de début.', 'Indiquez la date de fin.', 'Précisez si les sorties sont autorisées.']));
        expect(validateMedicalCertificate({ emailPurpose: 'Work Stoppage', emailRecipient: 'RH', sicknessStartDate: '2026-11-10', sicknessEndDate: '2026-11-12', certificateExit: 'Sorties autorisées' })).toEqual([]);
        expect(validateMedicalCertificate({ emailPurpose: 'Work Stoppage', emailRecipient: 'RH', sicknessStartDate: '2026-11-12', sicknessEndDate: '2026-11-10', certificateExit: 'Sorties autorisées' })).toContain('La date de fin ne peut pas précéder la date de début.');
        expect(validateMedicalCertificate({ emailPurpose: 'Return To Work', emailRecipient: 'RH' })).toContain('Indiquez la date de reprise du travail.');
        expect(validateMedicalCertificate({ emailPurpose: 'Fitness', emailRecipient: 'Club', fitnessActivity: 'Sport', fitnessConclusion: 'Apte avec restrictions' })).toContain('Précisez les restrictions.');
        // un ancien courriel reste valide avec ses anciens champs
        expect(validateMedicalCertificate({ emailPurpose: 'Illness Confirmation', emailRecipient: 'Assurance', illnessCondition: 'Angine' })).toEqual([]);
    });

    test("l'arrêt de travail indique l'ITT et le courrier ne contient pas de détail médical", () => {
        const content = buildCertificateContent({ emailPurpose: 'Work Stoppage', patientName: 'Jean Testard', emailRecipient: 'RH', sicknessStartDate: '2026-11-10', sicknessEndDate: '2026-11-14', certificateExit: 'Sorties interdites', dateOfVisit: '2026-11-10' });
        expect(content.subject).toBe('Arrêt de travail : Jean Testard');
        expect(content.paragraphs.join(' ')).toContain('ITT) de 5 jours');
        expect(content.rows).toEqual(expect.arrayContaining([['ITT', '5 jours'], ['Sorties', 'Sorties interdites']]));
    });

    test('le courrier se termine par la signature du rédacteur et le pied de page commun', () => {
        const bb = generateSicknessEmail({
            emailPurpose: 'Sickness Note', emailRecipient: 'RH', patientName: 'Jean Testard', patientID: 'PHMC-2752', dateOfVisit: '2026-11-10', sicknessStartDate: '2026-11-10', sicknessEndDate: '2026-11-12',
            signer: { name: 'Dr. Rose Callahan', rank: 'Médecin Titulaire', service: 'Chirurgie Vasculaire', signatureUrl: 'https://i.ibb.co/sig/s.png' },
        });
        expect(bb).toContain('Certificat médical de repos : Jean Testard');
        expect(bb).toContain(`Respectueusement,\n[img=${SIGNATURE_IMG_WIDTH}]https://i.ibb.co/sig/s.png[/img]`);
        expect(bb).toContain('[b][size=105]Dr. Rose Callahan[/size][/b]');
        expect(bb).toContain('Médecin Titulaire\nChirurgie Vasculaire');
        expect(bb).toContain('Pillbox Hill Medical Center');
        expect(bb).toContain('confidentiel');
    });
});

describe('signature du personnel au bas des rapports', () => {
    const signer = { name: 'Dr. Rose Callahan', rank: 'Médecin Titulaire', service: 'Chirurgie Vasculaire', signatureUrl: 'https://i.ibb.co/sig/s.png' };

    test('image réduite, trait, nom en gras, rôle et service', () => {
        const block = staffSignatureBlock(signer);
        expect(block).toBe(`Respectueusement,\n[img=${SIGNATURE_IMG_WIDTH}]https://i.ibb.co/sig/s.png[/img]\n[hr][/hr]\n[b][size=105]Dr. Rose Callahan[/size][/b]\n[size=85]Médecin Titulaire\nChirurgie Vasculaire[/size]`);
    });

    test('sans signature créée : le nom seul ; une adresse non https est ignorée', () => {
        expect(staffSignatureBlock({ name: 'Dr. A', rank: 'Interne' })).not.toContain('Respectueusement');
        expect(staffSignatureBlock({ name: 'Dr. A', signatureUrl: 'http://x.fr/a.png' })).not.toContain('[img');
        expect(staffSignatureBlock({ name: '' })).toBe('');
    });

    test('ajoutée aux rapports du personnel, jamais aux candidatures, dossiers Civils ni courriels', () => {
        expect(withStaffSignature('Rapport', 5, signer)).toContain('Dr. Rose Callahan');
        [1, 2, 4, 6, 19, 22, 37, 41].forEach((version) => expect(hasStaffSignatureFooter(version)).toBe(true));
        [3, 24, 25, 26, 27, 35, 40, 42, 50, 55, 999].forEach((version) => expect(hasStaffSignatureFooter(version)).toBe(false));
        expect(withStaffSignature('Candidature', 50, signer)).toBe('Candidature');
        expect(withStaffSignature('Rapport', 5, null)).toBe('Rapport');
    });
});
