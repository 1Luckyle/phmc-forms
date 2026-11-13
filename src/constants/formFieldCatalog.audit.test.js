// Garde-fou : la page d'administration « Champs obligatoires » (formFieldCatalog.js) doit refléter les champs réels des formulaires.
// Si ce test échoue, un champ a été ajouté, retiré ou rendu conditionnel dans un formulaire sans mettre à jour :
//   • src/constants/formFieldCatalog.js (champ + type) et src/constants/fieldInfo.js (libellé + aide) ;
//   • src/utils/fieldApplicability.js, si le champ n'apparaît que sous condition ;
//   • src/utils/formRulesCore.js (DEFAULT_REQUIRED / LOCKED_FIELDS), si c'est un champ obligatoire par défaut.
// Voir les écarts en détail : node scripts/formFieldAudit.cjs
const { auditFormFields } = require('../../scripts/formFieldAudit.cjs');

describe('catalogue des champs obligatoires', () => {
    test('chaque formulaire présente exactement les champs de son catalogue', () => {
        const audit = auditFormFields();
        expect(Object.keys(audit).length).toBeGreaterThan(25);
        const gaps = Object.entries(audit)
            .filter(([, entry]) => entry.notInCode.length || entry.notInCatalog.length)
            .map(([version, entry]) => `v${version} (${entry.file}) : à retirer du catalogue [${entry.notInCode.join(', ')}] — à ajouter au catalogue [${entry.notInCatalog.join(', ')}]`);
        expect(gaps).toEqual([]);
    });
});
