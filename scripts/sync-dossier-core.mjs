// Copie src/utils/dossierCore.js vers functions/dossierCore.js (les Cloud Functions ne peuvent pas importer depuis src/).
// Usage : npm run sync:dossier            (copie)
//         npm run sync:dossier -- --check (échoue si les deux fichiers diffèrent)
import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../src/utils/dossierCore.js', import.meta.url);
const target = new URL('../functions/dossierCore.js', import.meta.url);
const wanted = readFileSync(source, 'utf8');
let current = '';
try { current = readFileSync(target, 'utf8'); } catch (error) { /* absent : sera créé */ }

if (process.argv.includes('--check')) {
    if (current !== wanted) { console.error('functions/dossierCore.js diffère de src/utils/dossierCore.js : lancez « npm run sync:dossier ».'); process.exit(1); }
    console.log('Règles du dossier patient synchronisées.');
} else {
    writeFileSync(target, wanted);
    console.log('functions/dossierCore.js mis à jour.');
}
