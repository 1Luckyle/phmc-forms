import { DECEDENT_FIELDS, isDecedentField, decedentValue, isDecedentFieldApplicable } from './massFatality';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';
import { setFormOverrides } from './formRulesCore';
import { validateReport } from './formValidation';
import { conditionTextOf } from './fieldApplicability';
import { getDebugTemplate } from './debugTemplates';
import generateMassFatality from '../phmc-bbcode-generators/generateMassFatality';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn() }));

afterEach(() => setFormOverrides({}));

const base = { coronerEmployee: 'Dr Légiste', dateTime: '2026-11-15T10:00', decedents: [{ decedentName: 'Jane Doe', patientID: 'PHMC-1' }, { decedentName: 'John Doe', patientID: 'TMP-ABCD' }] };

describe('rapport de masse : la fiche de chaque défunt est au catalogue', () => {
    test('toutes les clés de fiche existent au catalogue du formulaire 11', () => {
        Object.keys(DECEDENT_FIELDS).forEach((key) => expect(VERSION_FIELDS[11][key]).toBeTruthy());
        expect(isDecedentField(11, 'patientID')).toBe(true);
        expect(isDecedentField(1, 'patientID')).toBe(false);
        expect(isDecedentField(11, 'synopsis')).toBe(false); // le résumé de l'incident est un champ du rapport
    });
    test('un champ exigé par la page admin l’est pour CHAQUE défunt, avec son numéro dans le message', () => {
        setFormOverrides({ 11: { scenePhotos: true, pronouncedTimeOfDeath: true } });
        const errors = validateReport(11, { ...base, decedents: [{ ...base.decedents[0], scenePhotos: 'https://i.example/a.png', pronouncedTimeOfDeath: '2026-11-15T10:05' }, base.decedents[1]] }).errors.join(' | ');
        expect(errors).toContain('Défunt n°2 : Photos de la scène : champ obligatoire.');
        expect(errors).toContain('Défunt n°2 : Heure du décès prononcé : champ obligatoire.');
        expect(errors).not.toContain('Défunt n°1 :');
    });
    test('le numéro de soumission n’est exigé que pour un défunt dont la case casier est cochée', () => {
        setFormOverrides({ 11: { evidenceLockerID: true } });
        expect(validateReport(11, base).errors.join(' ')).not.toContain('Numéro de soumission');
        const checked = { ...base, decedents: [{ ...base.decedents[0], evidenceLocker: 'true', evidenceLockerID: '' }, base.decedents[1]] };
        expect(validateReport(11, checked).errors.join(' ')).toContain('Défunt n°1 : Numéro de soumission au casier à preuves : champ obligatoire.');
        expect(isDecedentFieldApplicable('evidenceLockerID', base.decedents[0])).toBe(false);
        expect(conditionTextOf(11, 'evidenceLockerID')).toMatch(/casier à preuves/);
    });
    test('le nom en trois parties se lit aussi dans un ancien rapport (nom complet seul)', () => {
        expect(decedentValue({ decedentName: 'Jane Marie Doe' }, 'decedentFirstName')).toBe('Jane');
        expect(decedentValue({ decedentName: 'Jane Marie Doe' }, 'decedentLastName')).toBe('Doe');
        expect(decedentValue({ morgueStatus: 'true' }, 'morgueStatus')).toBe('Oui');
        expect(decedentValue({ morgueStatus: 'false' }, 'morgueStatus')).toBe('');
    });
    test('le casier à preuves du rapport se lit dans la fiche de chaque défunt (remplissage debug compris)', () => {
        const template = getDebugTemplate(11, {});
        const bb = generateMassFatality(template);
        expect(bb).toMatch(/casier à preuves: \[b\]Oui\[\/b\]/);
        expect(bb).toMatch(/casier à preuves: \[b\]Non\[\/b\]/);
    });
});
