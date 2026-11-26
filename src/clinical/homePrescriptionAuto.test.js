import React, { useState } from 'react';
import { render, act } from '@testing-library/react';
import { isGoingHome, withHomePrescription, withoutHomePrescription, applyMeds } from './apply';
import ClinicalAssistant from '../phmc-field-data/shared/ClinicalAssistant';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));

const para = { medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, days: 5 };

describe('ordonnance de sortie automatique : règles', () => {
    test('le patient rentre chez lui : urgences « Retour à domicile », consultation non admis, jamais décédé', () => {
        expect(isGoingHome({ dischargeDestination: 'Home' })).toBe(true);
        expect(isGoingHome({ dischargeDestination: 'Ward' })).toBe(false);
        expect(isGoingHome({ dischargeDestination: 'Home', careDeceased: 'Yes' })).toBe(false);
        expect(isGoingHome({ admission: 'No' }, 'consult')).toBe(true);
        expect(isGoingHome({ admission: 'Yes' }, 'consult')).toBe(false);
    });
    test('ajout marqué « autoHome », sans doublon d’une ligne déjà prescrite', () => {
        const added = withHomePrescription({ date: '2026-11-26', clinicalMeds: [] }, [para]);
        expect(added.clinicalMeds).toHaveLength(1);
        expect(added.clinicalMeds[0]).toMatchObject({ medId: 'paracetamol', prescribed: true, autoHome: true });
        const manual = { date: '2026-11-26', clinicalMeds: [{ ...para, prescribed: true }] };
        expect(withHomePrescription(manual, [para])).toBe(manual);
    });
    test('retrait : seules les lignes d’ordonnance posées par l’assistant partent', () => {
        const prev = { clinicalMeds: [
            { ...para, prescribed: true, autoHome: true },
            { medId: 'ibuprofene', regimenId: 'po', dose: 400, count: 3, days: 3, prescribed: true },
            { medId: 'paracetamol', regimenId: 'iv', dose: 1000, count: 1, autoHome: true },
        ] };
        expect(withoutHomePrescription(prev).clinicalMeds.map((entry) => `${entry.medId}-${entry.regimenId}`)).toEqual(['ibuprofene-po', 'paracetamol-iv']);
        expect(withoutHomePrescription({ clinicalMeds: [] }).clinicalMeds).toEqual([]);
    });
    test('« Médicaments » / « Tout appliquer » marquent aussi l’ordonnance de sortie', () => {
        const next = applyMeds({ date: '2026-11-26', clinicalMeds: [] }, [], false, { prescription: [para] });
        expect(next.clinicalMeds[0]).toMatchObject({ prescribed: true, autoHome: true });
    });
});

describe('ordonnance de sortie automatique : dans le formulaire des urgences', () => {
    let latest;
    const Harness = ({ initial }) => {
        const [formData, setFormData] = useState(initial);
        latest = { formData, setFormData };
        return <ClinicalAssistant formData={formData} setFormData={setFormData} handleChange={() => {}} />;
    };
    const setDestination = (value) => act(() => latest.setFormData((prev) => ({ ...prev, dischargeDestination: value })));
    const autoLines = () => (latest.formData.clinicalMeds || []).filter((entry) => entry.autoHome);

    test('« Retour à domicile » applique l’ordonnance, garder le patient la retire, revenir la remet', () => {
        render(<Harness initial={{ date: '2026-11-26', patientAgeYears: '35', patientWeight: '75', clinicalConditions: ['fracture_fermee'], clinicalSeverity: 'Moderate', clinicalMeds: [], dischargeDestination: 'Ward' }} />);
        expect(autoLines()).toHaveLength(0);
        setDestination('Home');
        expect(autoLines().length).toBeGreaterThan(0);
        expect(autoLines().every((entry) => entry.prescribed)).toBe(true);
        setDestination('Ward');
        expect(autoLines()).toHaveLength(0);
        setDestination('Home');
        const again = autoLines().length;
        expect(again).toBeGreaterThan(0);
        // Pas de doublon si l'orientation repasse par « Retour à domicile ».
        setDestination('ObservationBox');
        setDestination('Home');
        expect(autoLines()).toHaveLength(again);
    });

    test('orientation déjà « Box de surveillance » : une ordonnance de sortie posée ensuite (« Médicaments », « Tout appliquer ») est retirée d’office', () => {
        render(<Harness initial={{ date: '2026-11-26', patientAgeYears: '35', clinicalConditions: ['fracture_fermee'], clinicalMeds: [], dischargeDestination: 'ObservationBox' }} />);
        act(() => latest.setFormData((prev) => applyMeds(prev, [], false, { prescription: [para] })));
        expect(autoLines()).toHaveLength(0);
        // Une ligne mise à la main sur l'ordonnance reste.
        act(() => latest.setFormData((prev) => ({ ...prev, clinicalMeds: [...prev.clinicalMeds, { ...para, prescribed: true }] })));
        expect(latest.formData.clinicalMeds).toHaveLength(1);
    });

    test('brouillon rouvert « Box de surveillance » avec une ordonnance de sortie de l’assistant : elle est retirée', () => {
        render(<Harness initial={{ date: '2026-11-26', clinicalConditions: ['fracture_fermee'], clinicalMeds: [{ ...para, prescribed: true, autoHome: true }], dischargeDestination: 'ObservationBox' }} />);
        expect(autoLines()).toHaveLength(0);
    });

    test('orientation pas encore choisie : l’ordonnance posée par « Médicaments » reste', () => {
        render(<Harness initial={{ date: '2026-11-26', clinicalConditions: ['fracture_fermee'], clinicalMeds: [] }} />);
        act(() => latest.setFormData((prev) => applyMeds(prev, [], false, { prescription: [para] })));
        expect(autoLines()).toHaveLength(1);
        setDestination('Ward');
        expect(autoLines()).toHaveLength(0);
    });

    test('un brouillon rouvert déjà orienté « Retour à domicile » n’est pas modifié à l’ouverture', () => {
        render(<Harness initial={{ date: '2026-11-26', patientAgeYears: '35', clinicalConditions: ['fracture_fermee'], clinicalMeds: [], dischargeDestination: 'Home' }} />);
        expect(latest.formData.clinicalMeds).toEqual([]);
    });
});
