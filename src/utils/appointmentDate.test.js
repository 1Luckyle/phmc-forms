import { todayIso, isPastDate, isRejectedAppointmentChange, hasAppointmentDate } from './appointmentDate';

describe('date de rendez-vous : jamais dans le passé', () => {
    const now = new Date(2026, 10, 11, 23, 30); // 11/11/2026, 23h30 (heure locale)

    it("todayIso suit l'heure locale", () => {
        expect(todayIso(now)).toBe('2026-11-11');
    });

    it('refuse une date passée, accepte aujourd\'hui et le futur', () => {
        expect(isPastDate('2026-11-10', now)).toBe(true);
        expect(isPastDate('2026-11-11', now)).toBe(false);
        expect(isPastDate('2026-12-01', now)).toBe(false);
        expect(isPastDate('', now)).toBe(false);
    });

    it('ne s\'applique qu\'aux formulaires concernés et au bon champ', () => {
        expect(hasAppointmentDate(5)).toBe(true);
        expect(hasAppointmentDate(35)).toBe(true);
        expect(hasAppointmentDate(1)).toBe(false);
        expect(isRejectedAppointmentChange(5, 'date', '2020-01-01', now)).toBe(true);
        expect(isRejectedAppointmentChange(35, 'dateOfVisit', '2020-01-01', now)).toBe(true);
        expect(isRejectedAppointmentChange(35, 'date', '2020-01-01', now)).toBe(false);
        expect(isRejectedAppointmentChange(1, 'date', '2020-01-01', now)).toBe(false);
    });
});
