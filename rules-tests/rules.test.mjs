// Tests des règles Realtime Database (database.rules.json) sur l'ÉMULATEUR Firebase.
// Lancer : cd rules-tests && npm install && npm test   (Java 11+ requis ; aucune donnée de production n'est touchée).
//
// Chaque scénario repart d'une base neuve (jeu de données ci-dessous), puis joue UNE opération avec l'identité indiquée
// et vérifie qu'elle est acceptée ou refusée. Rôles :
//   A  admin                       S1, S2  soignants (nœuds S_One, S_Two)     D1, D2  DMEC (nœuds D_One, D_Two)
//   P  personnel polyvalent        C  civil (PHMC-1)                          X  compte sans aucun profil
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const rules = fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-phmc', database: { rules } });

const SEED = {
    adminUIDs: { A: true },
    staffUIDs: { S1: true, S2: true, D1: true, D2: true, P: true, A: true },
    soignantUIDs: { S1: true, S2: true },
    dmecUIDs: { D1: true, D2: true },
    noeudsRapports: { S1: 'S_One', S2: 'S_Two', D1: 'D_One', D2: 'D_Two', P: 'P_One' },
    civilians: { C: { patientID: 'PHMC-1' } },
    patientsDecedes: { 'PHMC-1': { depuis: 1, uid: 'D1', rapport: 'savedReports/D_One/d1' } },
    rapportsPublics: { pub: { reportPath: 'savedReports/D_One/pub', uid: 'D1', publieLe: 1 } },
    savedReports: {
        S_Two: {
            r1: { bbCodeVersion: 20, bbCode: 'x', data: { patientID: 'PHMC-1' } },
            r2: { bbCodeVersion: 20, bbCode: 'y', data: { name: 'sans id' } },
            r3: { bbCodeVersion: 20, bbCode: 'z', data: { patientID: 'PHMC-5' } },
        },
        D_One: {
            d1: { bbCodeVersion: 1, bbCode: 'dead', data: { patientID: 'PHMC-1' } },
            pub: { bbCodeVersion: 37, bbCode: 'public', data: { patientID: 'PHMC-2' } },
            unpub: { bbCodeVersion: 37, bbCode: 'brouillon', data: { patientID: 'PHMC-3' } },
        },
    },
    patientRecords: { 'PHMC-1': { r1: { reportPath: 'savedReports/S_Two/r1', visibility: 'staff-only' } } },
};
const r3 = SEED.savedReports.S_Two.r3;
const r1 = SEED.savedReports.S_Two.r1;
const newReport = (patientID) => ({ bbCodeVersion: 20, bbCode: 'nouveau', data: patientID ? { patientID } : { note: 'sans id' } });

const clone = (value) => JSON.parse(JSON.stringify(value));

let failures = 0;
let total = 0;

// seedFn (facultatif) : modifie une copie du jeu de données avant le scénario.
const scenario = async (label, expected, { as, op, path, value }, seedFn) => {
    const data = clone(SEED);
    if (seedFn) seedFn(data);
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(async (context) => { await context.database().ref().set(data); });

    const context = as ? env.authenticatedContext(as) : env.unauthenticatedContext();
    const reference = context.database().ref(path);
    let allowed = true;
    try {
        if (op === 'get') await reference.get();
        else if (op === 'set') await reference.set(value);
        else if (op === 'remove') await reference.remove();
        else throw new Error(`opération inconnue : ${op}`);
    } catch (error) {
        if (/permission[_ ]denied/i.test(String(error?.message || error))) allowed = false;
        else { allowed = null; console.log(`      (erreur inattendue : ${error?.message || error})`); }
    }
    total += 1;
    const ok = allowed === expected;
    if (!ok) failures += 1;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${allowed === null ? 'erreur' : allowed ? 'autorisé' : 'refusé'} (attendu ${expected ? 'autorisé' : 'refusé'})`);
};

const read = (label, expected, as, path, seedFn) => scenario(label, expected, { as, op: 'get', path }, seedFn);
const write = (label, expected, as, path, value, seedFn) => scenario(label, expected, { as, op: value === null ? 'remove' : 'set', path, value }, seedFn);

console.log('--- lecture ---');
await read('S1 lit son nœud', true, 'S1', 'savedReports/S_One');
await read('S1 ne liste pas le nœud de S2', false, 'S1', 'savedReports/S_Two');
await read('S1 lit r1 de S2 (dossier patient, soignant)', true, 'S1', 'savedReports/S_Two/r1');
await read('S1 ne lit pas r2 de S2 (sans ID patient)', false, 'S1', 'savedReports/S_Two/r2');
await read('S1 ne lit pas le rapport DMEC d1', false, 'S1', 'savedReports/D_One/d1');
await read('S1 lit le rapport public publié', true, 'S1', 'savedReports/D_One/pub');
await read('S1 ne lit pas le rapport public NON publié', false, 'S1', 'savedReports/D_One/unpub');
await read('D1 lit son nœud', true, 'D1', 'savedReports/D_One');
await read('D1 ne lit pas r1 de S2 (rapport soignant)', false, 'D1', 'savedReports/S_Two/r1');
await read('D2 lit d1 de D1 (DMEC entre eux)', true, 'D2', 'savedReports/D_One/d1');
await read('D2 lit unpub de D1 (DMEC entre eux)', true, 'D2', 'savedReports/D_One/unpub');
await read('D2 ne liste pas le nœud de D1', false, 'D2', 'savedReports/D_One');
await read('P (polyvalent) ne lit pas r1', false, 'P', 'savedReports/S_Two/r1');
await read('P lit le rapport public publié', true, 'P', 'savedReports/D_One/pub');
await read('A (admin) lit tout le nœud de S2', true, 'A', 'savedReports/S_Two');
await read('A (admin) lit le rapport DMEC non publié', true, 'A', 'savedReports/D_One/unpub');
await read('A (admin) lit toute la collection', true, 'A', 'savedReports');
await read('S1 ne lit pas toute la collection', false, 'S1', 'savedReports');
await read('Civil C lit r1 (son ID PHMC-1)', true, 'C', 'savedReports/S_Two/r1');
await read('Civil C ne lit pas r2 (sans ID)', false, 'C', 'savedReports/S_Two/r2');
await read('Civil C ne lit pas r3 (autre ID)', false, 'C', 'savedReports/S_Two/r3');
await read('Civil C ne liste aucun nœud', false, 'C', 'savedReports/S_Two');
await read('X (sans profil) ne lit pas r1', false, 'X', 'savedReports/S_Two/r1');
await read('X (sans profil) ne lit pas r2', false, 'X', 'savedReports/S_Two/r2');
await read('X (sans profil) ne lit pas le rapport publié', false, 'X', 'savedReports/D_One/pub');
await read('Civil C ne lit pas le rapport publié (autre ID)', false, 'C', 'savedReports/D_One/pub');
await read('Anonyme ne lit rien', false, null, 'savedReports/S_Two/r1');

console.log('--- écriture de ses propres rapports / patient décédé ---');
await write('S1 crée un rapport (patient vivant)', true, 'S1', 'savedReports/S_One/n1', newReport('PHMC-9'));
await write('S1 crée un rapport SANS ID patient', true, 'S1', 'savedReports/S_One/n2', newReport(null));
await write('S1 ne crée pas de rapport sur le patient décédé', false, 'S1', 'savedReports/S_One/n3', newReport('PHMC-1'));
await write('P ne crée pas de rapport sur le patient décédé', false, 'P', 'savedReports/P_One/n4', newReport('PHMC-1'));
await write('D1 crée un rapport sur le patient décédé', true, 'D1', 'savedReports/D_One/n5', newReport('PHMC-1'));
await write('A crée sur le patient décédé', true, 'A', 'savedReports/S_One/n6', newReport('PHMC-1'));
await write('S2 supprime son rapport du patient décédé', true, 'S2', 'savedReports/S_Two/r1', null);
await write('S2 pose ownerDeleted sur son rapport du patient décédé (bbCode inchangé)', true, 'S2', 'savedReports/S_Two/r1', { ...r1, ownerDeleted: true });
await write('S2 modifie le contenu de son rapport du patient décédé', false, 'S2', 'savedReports/S_Two/r1', { ...r1, bbCode: 'altéré' });
await write('S2 modifie le contenu de son rapport (patient vivant)', true, 'S2', 'savedReports/S_Two/r3', { ...r3, bbCode: 'maj' });
await write('Civil C crée un rapport', true, 'C', 'savedReports/Civil_Name_PHMC-1/c1', newReport('PHMC-1'));
await write('Civil C ne modifie pas le rapport d un autre (r3)', false, 'C', 'savedReports/S_Two/r3', { ...r3, bbCode: 'pirate' });
await write('Civil C modifie un rapport portant SON ID (r1)', true, 'C', 'savedReports/S_Two/r1', { ...r1, bbCode: 'maj civil' });
await write('Civil C ne modifie pas un rapport sans ID (r2)', false, 'C', 'savedReports/S_Two/r2', { ...SEED.savedReports.S_Two.r2, bbCode: 'pirate' });
await write('Anonyme n écrit pas', false, null, 'savedReports/S_One/n7', newReport('PHMC-9'));

console.log('--- niveau 1 : écriture chez un collègue ---');
await write('S1 ne modifie pas le contenu du rapport de S2', false, 'S1', 'savedReports/S_Two/r3', { ...r3, bbCode: 'altéré' });
await write('S1 ne supprime pas le rapport de S2', false, 'S1', 'savedReports/S_Two/r3', null);
await write('S1 ne crée pas de rapport dans le nœud de S2', false, 'S1', 'savedReports/S_Two/intrus', newReport('PHMC-9'));
await write('S1 ne pose pas ownerDeleted sur le rapport de S2', false, 'S1', 'savedReports/S_Two/r3', { ...r3, ownerDeleted: true });
await write('S1 ne modifie pas le champ bbCode de S2 (chemin profond)', false, 'S1', 'savedReports/S_Two/r3/bbCode', 'x');
await write('S1 met à jour copiedFrom/reportPath d une copie de S2', true, 'S1', 'savedReports/S_Two/r3/copiedFrom/reportPath', 'savedReports/S_New/r3');
await write('S1 met à jour creatorName d une copie de S2', true, 'S1', 'savedReports/S_Two/r3/creatorName', 'Nouveau Nom');
await write('S1 ne met pas un objet dans creatorName', false, 'S1', 'savedReports/S_Two/r3/creatorName', { x: 1 });
await write('Civil C ne met pas à jour creatorName', false, 'C', 'savedReports/S_Two/r3/creatorName', 'x');
await write('X (sans profil) ne met pas à jour creatorName', false, 'X', 'savedReports/S_Two/r3/creatorName', 'x');
await write('A modifie le rapport de S2', true, 'A', 'savedReports/S_Two/r3', { ...r3, bbCode: 'admin' });
const withOrphan = (data) => { data.savedReports.S_Two.orphelin = { bbCodeVersion: 20, bbCode: 'o', ownerDeleted: true, data: { patientID: 'PHMC-5' } }; };
await write('S1 supprime un original orphelin (ownerDeleted) de S2', true, 'S1', 'savedReports/S_Two/orphelin', null, withOrphan);
await write('S1 ne modifie pas un orphelin pour autant', false, 'S1', 'savedReports/S_Two/orphelin', { ...clone(r3), ownerDeleted: true, bbCode: 'x' }, withOrphan);

console.log('--- renommage de sa propre fiche ---');
await write('S1 inscrit son nœud ACTUEL comme ancien', true, 'S1', 'noeudsAnciens/S1/S_One', true);
await write('S1 n inscrit pas le nœud d un autre comme ancien', false, 'S1', 'noeudsAnciens/S1/S_Two', true);
await write('S2 n inscrit rien pour S1', false, 'S2', 'noeudsAnciens/S1/S_One', true);
await write('A écrit noeudsAnciens', true, 'A', 'noeudsAnciens/S1/S_Two', true);
await write('S1 réclame un nom LIBRE', true, 'S1', 'noeudsRapports/S1', 'S_Nouveau');
await write('S1 ne réclame pas le nœud existant de S2', false, 'S1', 'noeudsRapports/S1', 'S_Two');
await write('S1 ne modifie pas le nœud d un autre compte', false, 'S1', 'noeudsRapports/S2', 'Libre_X');
await write('A écrit n importe quel nœud', true, 'A', 'noeudsRapports/S1', 'S_Two');
const renamed = (data) => {
    data.noeudsRapports.S1 = 'S_Nouveau';
    data.noeudsAnciens = { S1: { S_One: true } };
    data.savedReports.S_One = { vieux: { bbCodeVersion: 20, bbCode: 'v', data: { note: 'ancien' } } };
};
await write('Après renommage : S1 écrit dans son NOUVEAU nœud', true, 'S1', 'savedReports/S_Nouveau/copie', newReport('PHMC-9'), renamed);
await write('Après renommage : S1 supprime dans l ANCIEN nœud', true, 'S1', 'savedReports/S_One/vieux', null, renamed);
await write('Après renommage : S2 ne supprime pas dans l ancien nœud de S1', false, 'S2', 'savedReports/S_One/vieux', null, renamed);
await write('Après renommage : S1 retire l ancien nœud', true, 'S1', 'noeudsAnciens/S1/S_One', null, renamed);
await read('Après renommage : S1 lit son nouveau nœud', true, 'S1', 'savedReports/S_Nouveau', renamed);
await write('Annulation : S1 revient à son ancien nœud', true, 'S1', 'noeudsRapports/S1', 'S_One', renamed);
await write('Annulation : S1 ne se rattache pas au nœud de S2', false, 'S1', 'noeudsRapports/S1', 'S_Two', renamed);

console.log('--- patient décédé / publication ---');
await write('D1 déclare un décès (uid = lui)', true, 'D1', 'patientsDecedes/PHMC-8', { depuis: 5, uid: 'D1' });
await write('D1 ne déclare pas au nom d un autre', false, 'D1', 'patientsDecedes/PHMC-8', { depuis: 5, uid: 'D2' });
await write('S1 ne déclare pas de décès', false, 'S1', 'patientsDecedes/PHMC-8', { depuis: 5, uid: 'S1' });
await write('D1 libère SA fiche', true, 'D1', 'patientsDecedes/PHMC-1', null);
await write('D2 ne libère pas la fiche de D1', false, 'D2', 'patientsDecedes/PHMC-1', null);
await write('S1 ne libère pas la fiche', false, 'S1', 'patientsDecedes/PHMC-1', null);
await write('A libère la fiche', true, 'A', 'patientsDecedes/PHMC-1', null);
await write('D2 n écrase pas le marqueur existant', false, 'D2', 'patientsDecedes/PHMC-1', { depuis: 9, uid: 'D2' });
await write('Marqueur de décès sans champ « depuis » refusé', false, 'D1', 'patientsDecedes/PHMC-8', { uid: 'D1' });
await read('S1 lit le marqueur de décès', true, 'S1', 'patientsDecedes/PHMC-1');
await read('Civil C ne lit pas le marqueur', false, 'C', 'patientsDecedes/PHMC-1');
const pubRow = (uid) => ({ reportPath: 'savedReports/D_One/unpub', uid, publieLe: 3 });
await write('D1 publie (uid = lui)', true, 'D1', 'rapportsPublics/unpub', pubRow('D1'));
await write('S1 ne publie pas', false, 'S1', 'rapportsPublics/unpub', pubRow('S1'));
await write('D2 ne publie pas au nom de D1', false, 'D2', 'rapportsPublics/unpub', pubRow('D1'));
await write('D1 dépublie son rapport', true, 'D1', 'rapportsPublics/pub', null);
await write('D2 ne dépublie pas le rapport de D1', false, 'D2', 'rapportsPublics/pub', null);
await write('A dépublie', true, 'A', 'rapportsPublics/pub', null);
await read('S1 lit la liste des rapports publiés', true, 'S1', 'rapportsPublics');
await read('X (sans profil) ne lit pas la liste des rapports publiés', false, 'X', 'rapportsPublics');

console.log('--- index patientRecords ---');
await write('S1 ne crée pas d entrée sur le patient décédé', false, 'S1', 'patientRecords/PHMC-1/nouv', { reportPath: 'x' });
await write('D1 crée une entrée sur le patient décédé', true, 'D1', 'patientRecords/PHMC-1/nouv', { reportPath: 'x' });
await write('S1 met à jour une entrée existante (patient décédé)', true, 'S1', 'patientRecords/PHMC-1/r1', { reportPath: 'x', visibility: 'shared' });
await write('S1 supprime une entrée (patient décédé)', true, 'S1', 'patientRecords/PHMC-1/r1', null);
await write('S1 crée une entrée (patient vivant)', true, 'S1', 'patientRecords/PHMC-9/nouv', { reportPath: 'x' });
await write('Civil C crée une entrée', true, 'C', 'patientRecords/PHMC-1/nouv', { reportPath: 'x' });

await env.cleanup();
console.log(failures === 0 ? `\nTOUT EST OK (${total} scénarios)` : `\n${failures} ÉCHEC(S) sur ${total} scénarios`);
process.exit(failures === 0 ? 0 : 1);
