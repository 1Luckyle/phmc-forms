// scripts/replace-email-once.js
//
// Script PONCTUEL : remplace, partout dans la Realtime Database, l'ancienne adresse de connexion de Rose Callahan
// par sa nouvelle adresse. Seules les VALEURS texte strictement égales à l'ancienne adresse sont touchées
// (insensible à la casse) : aucun texte libre, aucune clé, aucune autre adresse.
//
// Usage (depuis la racine du projet) :
//   node scripts/replace-email-once.js            -> SIMULATION : liste ce qui serait modifié, n'écrit rien
//   node scripts/replace-email-once.js --apply    -> applique réellement
//
// Identifiants : aucun secret dans le dépôt. Le script utilise les identifiants Google par défaut de votre machine
// (« gcloud auth application-default login », ou la variable GOOGLE_APPLICATION_CREDENTIALS vers votre clé de service).

const admin = require('../functions/node_modules/firebase-admin');

const OLD_EMAIL = 'rose.callahan@phmc.health';
const NEW_EMAIL = 'rosecallahan@mail.eyefind.fr';
const DATABASE_URL = 'https://phmcfr-forms-default-rtdb.europe-west1.firebasedatabase.app';
const APPLY = process.argv.includes('--apply');

admin.initializeApp({ projectId: 'phmcfr-forms', databaseURL: DATABASE_URL });
const db = admin.database();

// Parcourt l'arbre et collecte les chemins dont la valeur texte est exactement l'ancienne adresse.
const collect = (node, path, found) => {
    if (typeof node === 'string') {
        if (node.trim().toLowerCase() === OLD_EMAIL) found.push(path);
        return;
    }
    if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) collect(value, `${path}/${key}`, found);
    }
};

(async () => {
    console.log(`${APPLY ? 'APPLICATION' : 'SIMULATION'} : ${OLD_EMAIL} -> ${NEW_EMAIL}`);
    const snapshot = await db.ref('/').once('value');
    const found = [];
    collect(snapshot.val(), '', found);

    const byRoot = {};
    for (const path of found) {
        const root = path.split('/')[1] || '(racine)';
        byRoot[root] = (byRoot[root] || 0) + 1;
    }
    console.log(`\n${found.length} occurrence(s) trouvée(s) :`);
    Object.entries(byRoot).sort().forEach(([root, count]) => console.log(`  ${root} : ${count}`));

    if (!APPLY) {
        console.log('\nExemples de chemins :');
        found.slice(0, 15).forEach((path) => console.log(`  ${path}`));
        console.log('\nRien n\'a été écrit. Relancez avec --apply pour appliquer.');
        process.exit(0);
    }

    // Écritures par lots de 400 chemins (update multi-chemins : atomique par lot).
    for (let i = 0; i < found.length; i += 400) {
        const batch = {};
        found.slice(i, i + 400).forEach((path) => { batch[path.slice(1)] = NEW_EMAIL; });
        await db.ref('/').update(batch);
        console.log(`  lot ${Math.floor(i / 400) + 1} écrit (${Object.keys(batch).length} chemins)`);
    }
    console.log('\nTerminé.');
    process.exit(0);
})().catch((error) => {
    console.error('Erreur :', error.message);
    process.exit(1);
});
