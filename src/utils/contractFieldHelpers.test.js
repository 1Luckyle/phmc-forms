import { amountOf, moneyDisplay, moneyText, moneyUnit } from './contractMoney';
import { composeDays, parseDays, composePlage, composeSchedule, parseSchedule } from './contractSchedule';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn() }));

const sp = (text) => text.replace(/[\s  ]+/g, ' ');

describe('rémunération : seul le montant se tape, le « $ » est ajouté', () => {
    test('texte enregistré : mêmes formats qu\'avant', () => {
        expect(sp(moneyText('4500', 'heure'))).toBe('4 500 $ de l\'heure');
        expect(sp(moneyText('90 000', 'semaine'))).toBe('90 000 $ par semaine');
        expect(sp(moneyText('4 500 $', 'heure'))).toBe('4 500 $ de l\'heure'); // le signe tapé en trop est ignoré
        expect(moneyText('', 'heure')).toBe('');
        expect(moneyText('abc', 'heure')).toBe('');
    });
    test('chiffres seuls : lettres et zéros de tête écartés, longueur bornée', () => {
        expect(sp(moneyText('0045a00', 'heure'))).toBe('4 500 $ de l\'heure');
        expect(sp(moneyText('1234567890123', 'heure'))).toBe('123 456 789 $ de l\'heure');
    });
    test('relecture d\'un texte enregistré, y compris ancien ou avec décimales', () => {
        expect(amountOf('4 500 $ de l\'heure')).toBe(4500);
        expect(amountOf('90 000 $ par semaine')).toBe(90000);
        expect(amountOf('4500,50 $ de l\'heure')).toBe(4500.5);
        expect(amountOf('environ 3 000 dollars')).toBe(3000);
        expect(amountOf('à définir')).toBeNull();
        expect(amountOf('')).toBeNull();
        expect(sp(moneyDisplay('4 500 $ de l\'heure'))).toBe('4 500');
        expect(moneyDisplay('')).toBe('');
        expect(moneyDisplay('rien')).toBe('');
    });
    test('unité affichée à côté de la case', () => {
        expect(sp(moneyUnit('heure'))).toBe('$ de l\'heure');
        expect(sp(moneyUnit('semaine'))).toBe('$ par semaine');
    });
});

describe('horaires : sélecteur de plages', () => {
    test('jours : suites de trois jours et plus résumées, ordre de la semaine', () => {
        expect(composeDays([0, 1, 2, 3, 4])).toBe('Lundi au vendredi');
        expect(composeDays([4, 0, 2])).toBe('Lundi, mercredi, vendredi');
        expect(composeDays([0, 1])).toBe('Lundi, mardi');
        expect(composeDays([0, 1, 2, 4, 5, 6])).toBe('Lundi au mercredi, vendredi au dimanche');
        expect(composeDays([5])).toBe('Samedi');
        expect(composeDays([])).toBe('');
    });
    test('jours : lecture inverse', () => {
        expect(parseDays('Lundi au vendredi')).toEqual([0, 1, 2, 3, 4]);
        expect(parseDays('Lundi, mercredi, vendredi')).toEqual([0, 2, 4]);
        expect(parseDays('Lundi au mercredi, vendredi au dimanche')).toEqual([0, 1, 2, 4, 5, 6]);
        expect(parseDays('astreintes')).toBeNull();
        expect(parseDays('Vendredi au lundi')).toBeNull();
        expect(parseDays('')).toBeNull();
    });
    test('une plage incomplète n\'écrit rien', () => {
        expect(composePlage({ days: [0], from: '08:00', to: '16:00' })).toBe('Lundi : 08h00 – 16h00');
        expect(composePlage({ days: [], from: '08:00', to: '16:00' })).toBe('');
        expect(composePlage({ days: [0], from: '', to: '16:00' })).toBe('');
    });
    test('texte complet : plages + précision, et relecture à l\'identique', () => {
        const state = { plages: [{ days: [0, 1, 2, 3, 4], from: '08:00', to: '16:00' }, { days: [5], from: '10:00', to: '14:00' }], note: 'astreintes le week-end' };
        const text = composeSchedule(state);
        expect(text).toBe('Lundi au vendredi : 08h00 – 16h00 ; Samedi : 10h00 – 14h00 ; astreintes le week-end');
        expect(parseSchedule(text)).toEqual(state);
        expect(composeSchedule(parseSchedule(text))).toBe(text);
    });
    test('nuit : la fin peut précéder le début', () => {
        const text = composeSchedule({ plages: [{ days: [4, 5], from: '22:00', to: '06:00' }] });
        expect(text).toBe('Vendredi, samedi : 22h00 – 06h00');
        expect(parseSchedule(text).plages).toEqual([{ days: [4, 5], from: '22:00', to: '06:00' }]);
    });
    test('ancien texte libre : conservé en entier comme précision, rien ne se perd', () => {
        const old = '3 plages de 4 h par semaine, astreintes le week-end';
        expect(parseSchedule(old)).toEqual({ plages: [], note: old });
        expect(composeSchedule(parseSchedule(old))).toBe(old);
        expect(parseSchedule('')).toEqual({ plages: [], note: '' });
        const mixed = 'Lundi : 8h00 – 12h00 ; selon planning ; sur appel';
        expect(parseSchedule(mixed)).toEqual({ plages: [{ days: [0], from: '08:00', to: '12:00' }], note: 'selon planning ; sur appel' });
    });
});
