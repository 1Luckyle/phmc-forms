import { splitBackgroundItems, missingBackgroundItems, appendBackgroundItems, BACKGROUND_TEXT_MAX } from './dossierCore';
import { backgroundAdditions, changedBackgroundFields } from './careFormRules';
import { historySuggestions } from '../clinical/engine';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
const mockSet = jest.fn();
jest.mock('firebase/database', () => ({ ref: (db, path) => ({ path }), push: (reference) => ({ path: `${reference.path}/newKey` }), set: (...args) => mockSet(...args) }));
let mockLookup = { status: 'found', donnees: {} };
jest.mock('./dossierLookup', () => ({ lookupDossier: () => Promise.resolve(mockLookup), forgetDossierLookup: () => {} }));

const { queueDossierUpdate, hasDossierUpdateRules } = require('./emergencyContactUpdates');

describe('fond médical complété : règles pures (site et serveur)', () => {
    test('découpe sur ; , et retours à la ligne', () => {
        expect(splitBackgroundItems('Pénicilline ; latex, aspirine\nIode')).toEqual(['Pénicilline', 'latex', 'aspirine', 'Iode']);
        expect(splitBackgroundItems('  ')).toEqual([]);
    });
    test('seuls les éléments absents sont retenus (mots entiers, sans accents ni casse, sans doublon)', () => {
        expect(missingBackgroundItems('Pénicilline ; Latex', 'penicilline, LATEX, Aspirine, aspirine')).toEqual(['Aspirine']);
        expect(missingBackgroundItems('', 'Asthme')).toEqual(['Asthme']);
        expect(missingBackgroundItems('Asthme sévère', 'Asthme')).toEqual([]);
        expect(missingBackgroundItems('Asthme', 'Maladie')).toEqual(['Maladie']);
        expect(missingBackgroundItems('Migraines chroniques', 'Migraine')).toEqual(['Migraine']);
        expect(missingBackgroundItems('Pénicilline', '')).toEqual([]);
    });
    test('ajout à la suite du texte existant, sans le modifier, plafonné', () => {
        expect(appendBackgroundItems('Pénicilline', ['Latex', 'Iode'])).toBe('Pénicilline ; Latex ; Iode');
        expect(appendBackgroundItems('', ['Latex'])).toBe('Latex');
        expect(appendBackgroundItems('Pénicilline ', [])).toBe('Pénicilline');
        expect(appendBackgroundItems('a', ['x'.repeat(BACKGROUND_TEXT_MAX)]).length).toBe(BACKGROUND_TEXT_MAX);
    });
    test('ajouts calculés à partir du formulaire ; le dossier sans le champ reçoit tout', () => {
        const dossier = { patientAllergies: 'Pénicilline', patientChronicDiseases: '', patientCurrentMedicine: 'Insuline' };
        expect(backgroundAdditions(dossier, { patientAllergies: 'Pénicilline, latex', patientChronicDiseases: 'Asthme', patientCurrentMedicine: 'Insuline' }))
            .toEqual({ patientAllergies: ['latex'], patientChronicDiseases: ['Asthme'] });
        // un élément retiré dans le formulaire n'est jamais retiré du dossier
        expect(backgroundAdditions(dossier, { patientAllergies: '', patientChronicDiseases: '', patientCurrentMedicine: '' })).toEqual({});
        expect(backgroundAdditions(null, { patientAllergies: 'x' })).toEqual({});
    });
    test('une information saisie alors que le dossier est vide compte comme mise à jour', () => {
        expect(changedBackgroundFields({ patientAllergies: '' }, { patientAllergies: 'Latex' })).toEqual(['patientAllergies']);
        expect(changedBackgroundFields({ patientAllergies: 'Latex' }, { patientAllergies: '' })).toEqual([]);
    });
});

describe('demande de mise à jour du dossier', () => {
    beforeEach(() => { mockSet.mockReset(); mockSet.mockImplementation(() => Promise.resolve()); mockLookup = { status: 'found', donnees: { patientAllergies: 'Pénicilline', patientEmergencyContactNumber: '555-0100' } }; });

    test('formulaires concernés', () => {
        [5, 14, 16, 19, 20, 21, 28, 29].forEach((v) => expect(hasDossierUpdateRules(v)).toBe(true));
        [6, 7, 35, 41, 3, 25].forEach((v) => expect(hasDossierUpdateRules(v)).toBe(false));
    });

    test('urgences : les allergies ajoutées sont posées en ajouts, pas le contact', async () => {
        const result = await queueDossierUpdate({ patientID: 'PHMC-2752', version: 19, authorName: 'Dr. Test', reportTitle: 'Protocole', formData: { patientAllergies: 'Pénicilline, latex', patientEmergencyContactNumber: '555-0200' } });
        expect(result).toEqual({ contact: false, additions: ['patientAllergies'] });
        expect(mockSet).toHaveBeenCalledTimes(1);
        const [target, payload] = mockSet.mock.calls[0];
        expect(target.path).toBe('contactsUrgenceMaj/PHMC-2752/newKey');
        expect(payload).toMatchObject({ ajouts: { patientAllergies: ['latex'] }, par: 'Dr. Test', titre: 'Protocole' });
        expect(payload.champs).toBeUndefined();
    });

    test('santé mentale : contact modifié et ajouts dans la même demande', async () => {
        const result = await queueDossierUpdate({ patientID: 'PHMC-2752', version: 14, authorName: 'Dr. Test', reportTitle: 'Psy', formData: { patientAllergies: 'Pénicilline, latex', patientEmergencyContactNumber: '555-0200' } });
        expect(result).toEqual({ contact: true, additions: ['patientAllergies'] });
        expect(mockSet.mock.calls[0][1]).toMatchObject({ champs: { patientEmergencyContactNumber: '555-0200' }, ajouts: { patientAllergies: ['latex'] } });
    });

    test('le soignant peut refuser l\'ajout au dossier', async () => {
        const result = await queueDossierUpdate({ patientID: 'PHMC-2752', version: 20, formData: { patientAllergies: 'Pénicilline, latex', patientBackgroundSync: 'No' } });
        expect(result).toEqual({ contact: false, additions: [] });
        expect(mockSet).not.toHaveBeenCalled();
    });

    test('rien sans dossier, sans ID patient, ou quand rien ne manque', async () => {
        mockLookup = { status: 'missing', donnees: null };
        expect((await queueDossierUpdate({ patientID: 'PHMC-2752', version: 19, formData: { patientAllergies: 'Latex' } })).additions).toEqual([]);
        mockLookup = { status: 'found', donnees: { patientAllergies: 'Latex' } };
        expect((await queueDossierUpdate({ patientID: 'PHMC-2752', version: 19, formData: { patientAllergies: 'latex' } })).additions).toEqual([]);
        expect((await queueDossierUpdate({ patientID: '', version: 19, formData: { patientAllergies: 'x' } })).additions).toEqual([]);
        expect(mockSet).not.toHaveBeenCalled();
    });

    test("l'évaluation physique et le certificat ne posent aucune demande de fond médical", async () => {
        const result = await queueDossierUpdate({ patientID: 'PHMC-2752', version: 6, formData: { patientAllergies: 'Latex' } });
        expect(result).toEqual({ contact: false, additions: [] });
        expect(mockSet).not.toHaveBeenCalled();
    });
});

describe('assistant : antécédents à vérifier', () => {
    test('antécédent évoqué par le motif et absent du patient', () => {
        expect(historySuggestions(['asthme'], { chronic: '' })).toEqual({ chronic: ['Asthme'], allergen: false });
        expect(historySuggestions(['asthme'], { chronic: 'Asthme' })).toEqual({ chronic: [], allergen: false });
        expect(historySuggestions(['hypoglycemie', 'acidocetose'], { chronic: '' }).chronic).toEqual(['Diabète']);
        expect(historySuggestions(['anaphylaxie'], {}).allergen).toBe(true);
        expect(historySuggestions(['fracture_fermee'], {})).toEqual({ chronic: [], allergen: false });
    });
});
