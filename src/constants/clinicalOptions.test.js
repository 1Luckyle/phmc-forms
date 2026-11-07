import { mergeDepartmentOptions, allNoteDepartments, DEPARTMENT_ADDITIONS } from './clinicalOptions';

describe('services de la Note de service', () => {
    test('les services ajoutés complètent la liste de la base sans doublon', () => {
        const base = [{ value: 'Surgical', label: 'Département Chirurgical' }, { value: 'Pediatrics', label: 'Pédiatrie' }];
        const merged = mergeDepartmentOptions(base);
        expect(merged.slice(0, 2)).toEqual(base);
        expect(merged.filter((option) => option.value === 'Pediatrics')).toHaveLength(1);
        expect(merged.some((option) => option.value === 'ForensicMedicine')).toBe(true);
        expect(merged).toHaveLength(base.length + DEPARTMENT_ADDITIONS.length - 1);
    });

    test('tous les services sont imprimables dans la note', () => {
        const all = allNoteDepartments();
        expect(all.length).toBe(8 + DEPARTMENT_ADDITIONS.length);
        expect(new Set(all.map(([value]) => value)).size).toBe(all.length);
    });
});
