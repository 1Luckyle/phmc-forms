// scripts/cleanup-test-dossiers.js
//
// Supprime les DOSSIERS DE TEST du dossier patient : tous les formulaires « Dossier Médical Basique » (25), « Dossier Médical Avancé » (3) et « Mise à jour du dossier
// médical » (26), avec leur entrée d'index (patientRecords), leurs factures (facturesPatients, facturesEnAttente) et tout ce que le nouveau système a créé
// (dossiersPatients, dossiersEnAttente, jetonsDossier, signalementsDossier). Les autres formulaires (soins, DMEC, libération…) ne sont jamais touchés.
//
// Usage (depuis la racine du projet, avec la clé de compte de service) :
//   node scripts/cleanup-test-dossiers.js              → SIMULATION : liste ce qui serait supprimé, ne supprime rien ;
//   node scripts/cleanup-test-dossiers.js --apply      → supprime pour de bon (après avoir relu la simulation) ;
//   node scripts/cleanup-test-dossiers.js --patient PHMC-28761 [--apply]   → limite à un patient.
// La clé se lit dans la variable GOOGLE_APPLICATION_CREDENTIALS, à défaut dans ./firebase-admin-key.json (jamais à versionner).
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DATABASE_URL = 'https://phmcfr-forms-default-rtdb.europe-west1.firebasedatabase.app';
const DOSSIER_VERSIONS = [3, 25, 26];
const apply = process.argv.includes('--apply');
const patientArgIndex = process.argv.indexOf('--patient');
const onlyPatient = patientArgIndex > -1 ? String(process.argv[patientArgIndex + 1] || '').toUpperCase().replace(/\s+/g, '') : '';

const canonical = (value) => {
    const compact = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (/^\d+$/.test(compact)) return `PHMC-${compact}`;
    const prefixed = compact.match(/^PHMC[-_]?(\d+)$/);
    return prefixed ? `PHMC-${prefixed[1]}` : compact;
};

const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'firebase-admin-key.json');
if (!fs.existsSync(keyFile)) {
    console.error(`Clé de compte de service introuvable (${keyFile}). Définissez GOOGLE_APPLICATION_CREDENTIALS ou placez firebase-admin-key.json à la racine.`);
    process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(keyFile))), databaseURL: DATABASE_URL });
const db = admin.database();

(async () => {
    const updates = {};
    const lines = [];
    const keys = new Set();

    // 1) Les rapports eux-mêmes (savedReports/{compte}/{clé}).
    const reports = (await db.ref('savedReports').get()).val() || {};
    Object.entries(reports).forEach(([node, items]) => {
        Object.entries(items || {}).forEach(([key, report]) => {
            if (!report || !DOSSIER_VERSIONS.includes(Number(report.bbCodeVersion))) return;
            const patient = canonical(report.data && report.data.patientID);
            if (onlyPatient && patient !== onlyPatient) return;
            updates[`savedReports/${node}/${key}`] = null;
            keys.add(`${patient}/${key}`);
            lines.push(`rapport   v${report.bbCodeVersion}  ${patient || '(sans ID)'}  ${node}/${key}  « ${report.title || report.originalKey || ''} »`);
        });
    });

    // 2) L'index du dossier (patientRecords/{patient}/{clé}) : entrées de ces versions, copies comprises.
    const index = (await db.ref('patientRecords').get()).val() || {};
    Object.entries(index).forEach(([patientNode, entries]) => {
        if (onlyPatient && canonical(patientNode) !== onlyPatient) return;
        Object.entries(entries || {}).forEach(([key, entry]) => {
            if (!entry || !DOSSIER_VERSIONS.includes(Number(entry.bbCodeVersion))) return;
            updates[`patientRecords/${patientNode}/${key}`] = null;
            keys.add(`${canonical(patientNode)}/${key}`);
            lines.push(`index     v${entry.bbCodeVersion}  ${patientNode}/${key}${entry.copiedFrom ? '  (copie)' : ''}`);
        });
    });

    // 3) Factures et file d'attente de ces formulaires, puis les nouveaux nœuds du dossier (remise à zéro).
    for (const compound of keys) {
        const [patient, key] = compound.split('/');
        if (!patient || !key) continue;
        updates[`facturesPatients/${patient}/${key}`] = null;
        updates[`facturesEnAttente/${patient}/${key}`] = null;
        updates[`dossiersEnAttente/${patient}/${key}`] = null;
    }
    for (const node of ['dossiersPatients', 'jetonsDossier', 'signalementsDossier', 'dossiersEnAttente']) {
        const value = (await db.ref(node).get()).val() || {};
        Object.keys(value).forEach((patient) => {
            if (onlyPatient && canonical(patient) !== onlyPatient) return;
            updates[`${node}/${patient}`] = null;
            lines.push(`${node.padEnd(19)} ${patient}`);
        });
    }

    lines.sort().forEach((line) => console.log(line));
    console.log(`\n${Object.keys(updates).length} chemin(s) concerné(s), ${keys.size} formulaire(s) de dossier${onlyPatient ? ` (patient ${onlyPatient})` : ''}.`);
    if (!apply) {
        console.log('SIMULATION : rien n\'a été supprimé. Relancez avec --apply pour supprimer.');
        process.exit(0);
    }
    await db.ref().update(updates);
    console.log('Suppression effectuée.');
    process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
