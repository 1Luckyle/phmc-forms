jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));
jest.mock('../contexts/SiteConfigContext', () => ({ useSiteConfig: () => ({ bbcodeEnabled: true }) }));
jest.mock('../contexts/NotificationContext', () => ({ useNotification: () => ({ showNotification: jest.fn() }) }));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Dropdown } from 'react-bootstrap';
import { prescriptionOfReport } from '../phmc-bbcode-generators/generatePrescription';
import { sharedPrescriptionEntries } from '../utils/patientRecords';
import { PrescriptionMenuSection, PrescriptionItems } from './PrescriptionMenu';

const data = {
    patientName: 'Jean Test', patientID: 'PHMC-1', date: '2026-11-11', phmcEmployee: 'Dr. Interne',
    clinicalMeds: [{ medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, days: 5, startDate: '2026-11-12', prescribed: true, note: '' }, { medId: 'lidocaine', regimenId: 'infiltration', dose: 100, count: 1, note: '' }],
};
const report = { data, bbCodeVersion: 19, bbCode: '[b]rapport complet[/b]' };
const entry = (overrides = {}) => ({ indexKey: 'k1', visibility: 'staff-only', originalKey: '[PHMC-1] Protocole', title: '[PHMC-1] Protocole', bbCode: report.bbCode, imageUrl: 'x', kind: 'ama', ordonnance: prescriptionOfReport(report), ...overrides });

describe("l'ordonnance : texte brut", () => {
    test("l'ordonnance d'un rapport porte son texte brut (patient, date, lignes, prescripteur), sans les soins administrés", () => {
        const { plainText, bbCode, title } = prescriptionOfReport(report);
        expect(title).toMatch(/Ordonnance/);
        expect(bbCode).toContain('Traitement prescrit');
        expect(plainText).toMatch(/^ORDONNANCE\nPatient : Jean Test \(PHMC-1\)\nDate : 2026-11-11\n\n• Paracétamol/);
        expect(plainText).toMatch(/pendant 5 jours/);
        expect(plainText).not.toMatch(/Lidocaïne/);
        expect(plainText).toMatch(/Prescripteur : Dr\. Interne$/);
    });

    test('le menu « Ordonnance de ce rapport » propose « Copier le texte brut »', () => {
        render(<Dropdown show><Dropdown.Menu show><PrescriptionMenuSection prescription={prescriptionOfReport(report)} /></Dropdown.Menu></Dropdown>);
        expect(screen.getByText('Copier le texte brut')).toBeTruthy();
        expect(screen.getByText('Copier le titre')).toBeTruthy();
    });

    test('sans texte brut (ordonnance vide), l’entrée n’apparaît pas', () => {
        render(<Dropdown show><Dropdown.Menu show><PrescriptionItems bbCode="[b]x[/b]" title="t" /></Dropdown.Menu></Dropdown>);
        expect(screen.queryByText('Copier le texte brut')).toBeNull();
    });
});

describe("l'ordonnance est toujours partagée avec le patient", () => {
    test("un rapport non partagé donne une ligne « ordonnance seule » : l'ordonnance à la place du compte rendu", () => {
        const rows = sharedPrescriptionEntries([entry()]);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ prescriptionOnly: true, ordonnance: null, imageUrl: null, kind: null, indexKey: 'k1' });
        expect(rows[0].title).toMatch(/^\[PHMC-1\] Ordonnance/);
        expect(rows[0].originalKey).toBe(rows[0].title);
        // Jamais le compte rendu : ni son BBCode, ni son titre.
        expect(rows[0].bbCode).toContain('Traitement prescrit');
        expect(rows[0].bbCode).not.toContain('rapport complet');
        expect(rows[0].plainText).toMatch(/^ORDONNANCE/);
    });

    test('rapport déjà partagé ou créé par le patient, copie, rapport retiré, rapport sans ordonnance : aucune ligne en plus', () => {
        expect(sharedPrescriptionEntries([entry({ visibility: 'shared' }), entry({ visibility: 'owner' })])).toEqual([]);
        expect(sharedPrescriptionEntries([entry({ copiedFrom: { reportPath: 'a' } }), entry({ ownerDeleted: true }), entry({ ordonnance: null })])).toEqual([]);
        expect(sharedPrescriptionEntries(undefined)).toEqual([]);
    });
});

describe('notification : une ordonnance a été remise', () => {
    const { prescriptionNoticeFor } = require('../utils/prescriptionNotice');

    test('un rapport avec ordonnance prévient le patient, avec le titre de l’ordonnance et un lien vers son dossier', () => {
        const notice = prescriptionNoticeFor({ data, bbCodeVersion: 19 });
        expect(notice).toMatchObject({ type: 'partage', titre: 'Une ordonnance vous a été remise', lien: { cible: 'dossierPatient' } });
        expect(notice.texte).toMatch(/^\[PHMC-1\] Ordonnance/);
    });

    test('rien à notifier : pas d’ordonnance, patient décédé, ou rapport enregistré par le patient lui-même', () => {
        expect(prescriptionNoticeFor({ data: { ...data, clinicalMeds: [{ ...data.clinicalMeds[1] }] }, bbCodeVersion: 19 })).toBeNull();
        expect(prescriptionNoticeFor({ data: { ...data, careDeceased: 'Yes' }, bbCodeVersion: 19 })).toBeNull();
        expect(prescriptionNoticeFor({ data, bbCodeVersion: 19 }, { byPatient: true })).toBeNull();
        expect(prescriptionNoticeFor(null)).toBeNull();
    });
});
