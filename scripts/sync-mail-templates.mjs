// Copie src/utils/mailTemplatesCore.js vers functions/mailTemplatesCore.js (les Cloud Functions ne peuvent pas importer depuis src/).
// Usage : npm run sync:mail            (copie)
//         npm run sync:mail -- --check (échoue si les deux fichiers diffèrent)
import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../src/utils/mailTemplatesCore.js', import.meta.url);
const target = new URL('../functions/mailTemplatesCore.js', import.meta.url);
const wanted = readFileSync(source, 'utf8');
let current = '';
try { current = readFileSync(target, 'utf8'); } catch (error) { /* absent : sera créé */ }

if (process.argv.includes('--check')) {
    if (current !== wanted) { console.error('functions/mailTemplatesCore.js diffère de src/utils/mailTemplatesCore.js : lancez « npm run sync:mail ».'); process.exit(1); }
    console.log('Modèles de mail synchronisés.');
} else {
    writeFileSync(target, wanted);
    console.log('functions/mailTemplatesCore.js mis à jour.');
}
