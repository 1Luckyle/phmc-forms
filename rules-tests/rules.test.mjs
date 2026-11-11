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
const DEATH_SCENARIO = /décédé|décès|marqueur/i;
const scenario = async (label, expected, { as, op, path, value }, seedFn) => {
    const data = clone(SEED);
    // Le civil C (PHMC-1) est vivant dans les scénarios ordinaires : le marqueur de décès de PHMC-1 ne sert qu'aux tests du personnel et aux scénarios de décès.
    if (as === 'C' && !DEATH_SCENARIO.test(label)) delete data.patientsDecedes['PHMC-1'];
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
        else if (op === 'update') await reference.update(value);
        else if (op === 'queryOwn') await reference.orderByChild('auteurUid').equalTo(value).get();
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

console.log('--- gel judiciaire ---');
const gelRow = (uid, extra = {}) => ({ reportPath: 'savedReports/D_One/d1', uid, par: 'x', depuis: 5, actif: true, autorite: 'mandat', reference: 'M-1', motif: 'Mandat du tribunal', ...extra });
const frozen = (data) => { data.gelsJudiciaires = { d1: gelRow('D1'), pub: gelRow('D1', { reportPath: 'savedReports/D_One/pub' }) }; };
const lifted = (data) => { data.gelsJudiciaires = { d1: gelRow('D1', { actif: false, levee: { motif: 'Procédure close', par: 'A', le: 9 } }) }; };
const d1 = SEED.savedReports.D_One.d1;
await write('D1 gèle un rapport', true, 'D1', 'gelsJudiciaires/d1', gelRow('D1'));
await write('A gèle un rapport', true, 'A', 'gelsJudiciaires/d1', gelRow('A'));
await write('S1 ne gèle pas', false, 'S1', 'gelsJudiciaires/d1', gelRow('S1'));
await write('P ne gèle pas', false, 'P', 'gelsJudiciaires/d1', gelRow('P'));
await write('Civil C ne gèle pas', false, 'C', 'gelsJudiciaires/d1', gelRow('C'));
await write('D1 ne gèle pas au nom d un autre', false, 'D1', 'gelsJudiciaires/d1', gelRow('D2'));
await write('Gel sans motif refusé', false, 'D1', 'gelsJudiciaires/d1', gelRow('D1', { motif: '' }));
await write('Gel inactif ne se crée pas', false, 'D1', 'gelsJudiciaires/d1', gelRow('D1', { actif: false, levee: { motif: 'x y z' } }));
await write('D1 ne lève pas le gel', false, 'D1', 'gelsJudiciaires/d1', gelRow('D1', { actif: false, levee: { motif: 'Fini', par: 'D1', le: 9 } }), frozen);
await write('S1 ne lève pas le gel', false, 'S1', 'gelsJudiciaires/d1', gelRow('D1', { actif: false, levee: { motif: 'Fini', par: 'S1', le: 9 } }), frozen);
await write('A lève le gel avec justificatif', true, 'A', 'gelsJudiciaires/d1', gelRow('D1', { actif: false, levee: { motif: 'Procédure close', par: 'A', le: 9 } }), frozen);
await write('A ne lève pas le gel sans justificatif', false, 'A', 'gelsJudiciaires/d1', gelRow('D1', { actif: false }), frozen);
await write('A ne lève pas le gel avec un justificatif vide', false, 'A', 'gelsJudiciaires/d1', gelRow('D1', { actif: false, levee: { motif: '' } }), frozen);
await write('A ne supprime pas l entrée de gel', false, 'A', 'gelsJudiciaires/d1', null, frozen);
await write('D1 ne supprime pas l entrée de gel', false, 'D1', 'gelsJudiciaires/d1', null, frozen);
await write('D2 ne ré-écrase pas un gel actif', false, 'D2', 'gelsJudiciaires/d1', gelRow('D2'), frozen);
const closedGel = { depuis: 5, par: 'x', autorite: 'mandat', reference: 'M-1', motif: 'Mandat du tribunal', levee: { motif: 'Procédure close', par: 'A', le: 9 } };
await write('D2 ne re-gèle pas après une levée (même avec l historique)', false, 'D2', 'gelsJudiciaires/d1', gelRow('D2', { precedents: [closedGel] }), lifted);
await write('D2 ne re-gèle pas après une levée (sans historique)', false, 'D2', 'gelsJudiciaires/d1', gelRow('D2'), lifted);
await write('A re-gèle après une levée en gardant l historique', true, 'A', 'gelsJudiciaires/d1', gelRow('A', { precedents: [closedGel] }), lifted);
await write('A ne re-gèle pas en effaçant l historique', false, 'A', 'gelsJudiciaires/d1', gelRow('A'), lifted);
await read('S1 lit les gels', true, 'S1', 'gelsJudiciaires');
await read('Civil C ne lit pas les gels', false, 'C', 'gelsJudiciaires');
await read('X (sans profil) ne lit pas les gels', false, 'X', 'gelsJudiciaires');
await write('D1 ne modifie pas son rapport gelé', false, 'D1', 'savedReports/D_One/d1', { ...d1, bbCode: 'altéré' }, frozen);
await write('D1 ne supprime pas son rapport gelé', false, 'D1', 'savedReports/D_One/d1', null, frozen);
// Limite connue : le droit d'un admin sur le nœud entier (renommages) l'emporte ; le gel est alors appliqué par l'application.
await write('A modifie un rapport gelé (limite connue : l app le refuse)', true, 'A', 'savedReports/D_One/d1', { ...d1, bbCode: 'altéré' }, frozen);
await write('A supprime un rapport gelé (limite connue : l app le refuse)', true, 'A', 'savedReports/D_One/d1', null, frozen);
await write('D1 ne pose pas de marqueur sur son rapport gelé', false, 'D1', 'savedReports/D_One/d1/publie', true, frozen);
await write('D1 modifie son rapport une fois le gel levé', true, 'D1', 'savedReports/D_One/d1', { ...d1, bbCode: 'maj' }, lifted);
await write('D1 modifie un autre rapport (non gelé)', true, 'D1', 'savedReports/D_One/unpub', { ...SEED.savedReports.D_One.unpub, bbCode: 'maj' }, frozen);
await write('D1 ne dépublie pas un rapport gelé', false, 'D1', 'rapportsPublics/pub', null, frozen);
await write('A ne dépublie pas un rapport gelé', false, 'A', 'rapportsPublics/pub', null, frozen);
await write('D1 ne publie pas un rapport gelé', false, 'D1', 'rapportsPublics/unpub', pubRow('D1'), (data) => { data.gelsJudiciaires = { unpub: gelRow('D1', { reportPath: 'savedReports/D_One/unpub' }) }; });

console.log('--- demandes des forces de l\'ordre ---');
const demande = (uid, extra = {}) => ({ auteurUid: uid, auteurNom: 'Nom', le: Date.now(), service: 'LSPD', agent: 'Off. X #123', type: 'dossier', baseLegale: 'mandat', decision: 'transmis', reference: 'M-1', ...extra });
const withDemandes = (data) => { data.demandesAutorites = { d1: demande('S1'), d2: demande('S2') }; };
const query = (label, expected, as, value, seedFn) => scenario(label, expected, { as, op: 'queryOwn', path: 'demandesAutorites', value }, seedFn);
await write('S1 enregistre une demande à son nom', true, 'S1', 'demandesAutorites/n1', demande('S1'));
await write('D1 (DMEC) enregistre une demande', true, 'D1', 'demandesAutorites/n1', demande('D1'));
await write('P (polyvalent) enregistre une demande', true, 'P', 'demandesAutorites/n1', demande('P'));
await write('S1 n enregistre pas au nom de S2', false, 'S1', 'demandesAutorites/n1', demande('S2'));
await write('Civil C n enregistre pas de demande', false, 'C', 'demandesAutorites/n1', demande('C'));
await write('X (sans profil) n enregistre pas de demande', false, 'X', 'demandesAutorites/n1', demande('X'));
await write('Anonyme n enregistre pas de demande', false, null, 'demandesAutorites/n1', demande('S1'));
await write('Demande sans service refusée', false, 'S1', 'demandesAutorites/n1', demande('S1', { service: '' }));
await write('Demande avec type inconnu refusée', false, 'S1', 'demandesAutorites/n1', demande('S1', { type: 'pirate' }));
await write('Demande avec décision inconnue refusée', false, 'S1', 'demandesAutorites/n1', demande('S1', { decision: 'peut-etre' }));
await write('Note trop longue refusée', false, 'S1', 'demandesAutorites/n1', demande('S1', { note: 'x'.repeat(301) }));
await write('Date dans le futur refusée', false, 'S1', 'demandesAutorites/n1', demande('S1', { le: Date.now() + 86400000 * 3 }));
await write('S1 ne modifie pas sa fiche', false, 'S1', 'demandesAutorites/d1', demande('S1', { decision: 'remis' }), withDemandes);
await write('S1 ne supprime pas sa fiche', false, 'S1', 'demandesAutorites/d1', null, withDemandes);
await write('S1 ne modifie pas la fiche de S2', false, 'S1', 'demandesAutorites/d2', demande('S2', { decision: 'remis' }), withDemandes);
await write('A modifie une fiche', true, 'A', 'demandesAutorites/d1', demande('S1', { decision: 'refuse', baseLegale: 'aucune' }), withDemandes);
await write('A supprime une fiche', true, 'A', 'demandesAutorites/d1', null, withDemandes);
await read('A lit tout le registre', true, 'A', 'demandesAutorites', withDemandes);
await read('S1 ne lit pas tout le registre', false, 'S1', 'demandesAutorites', withDemandes);
await read('S1 ne lit pas la fiche de S2', false, 'S1', 'demandesAutorites/d2', withDemandes);
await query('S1 lit SES fiches (requête filtrée)', true, 'S1', 'S1', withDemandes);
await query('S1 ne lit pas les fiches de S2 (requête filtrée)', false, 'S1', 'S2', withDemandes);
await query('Civil C ne lit rien', false, 'C', 'S1', withDemandes);
await read('Anonyme ne lit pas le registre', false, null, 'demandesAutorites', withDemandes);

console.log('--- sécurité incendie ---');
const FS = 'securiteIncendie';
const controle = (uid, extra = {}) => ({ le: Date.now(), parUid: uid, parNom: 'Nom', etage: 'Étage 1', items: { extincteur: 'ok', alarme: 'nc', portes: 'na' }, ...extra });
const nc = (uid, extra = {}) => ({ creeLe: Date.now(), creePar: { uid, nom: 'Nom' }, etage: 'Étage 1', article: '204', description: 'Alarme absente', statut: 'ouverte', source: 'signalement', ...extra });
const withNc = (data) => { data[FS] = { nonConformites: { n1: nc('A', { source: 'controle' }), n2: nc('S1') } }; };
await write('A enregistre un contrôle', true, 'A', `${FS}/controles/c1`, controle('A'));
await write('S1 n enregistre pas de contrôle', false, 'S1', `${FS}/controles/c1`, controle('S1'));
await write('Contrôle avec point invalide refusé', false, 'A', `${FS}/controles/c1`, controle('A', { items: { extincteur: 'peut-etre' } }));
await write('Contrôle sans étage refusé', false, 'A', `${FS}/controles/c1`, controle('A', { etage: '' }));
await write('A enregistre un exercice', true, 'A', `${FS}/exercices/e1`, { le: 1, parUid: 'A', parNom: 'A', etage: 'Tout le bâtiment', participants: 12, duree: 8 });
await write('S1 n enregistre pas d exercice', false, 'S1', `${FS}/exercices/e1`, { le: 1, parUid: 'S1', parNom: 'S', etage: 'x', participants: 1, duree: 1 });
await write('S1 signale un problème', true, 'S1', `${FS}/nonConformites/n1`, nc('S1'));
await write('D1 (DMEC) signale un problème', true, 'D1', `${FS}/nonConformites/n1`, nc('D1'));
await write('S1 ne signale pas au nom d un autre', false, 'S1', `${FS}/nonConformites/n1`, nc('S2'));
await write('S1 ne crée pas une non-conformité « contrôle »', false, 'S1', `${FS}/nonConformites/n1`, nc('S1', { source: 'controle' }));
await write('S1 ne crée pas une non-conformité déjà résolue', false, 'S1', `${FS}/nonConformites/n1`, nc('S1', { statut: 'resolue' }));
await write('Signalement trop court refusé', false, 'S1', `${FS}/nonConformites/n1`, nc('S1', { description: 'ok' }));
await write('Signalement d article inconnu refusé', false, 'S1', `${FS}/nonConformites/n1`, nc('S1', { article: '999' }));
await write('Civil C ne signale pas', false, 'C', `${FS}/nonConformites/n1`, nc('C'));
await write('X (sans profil) ne signale pas', false, 'X', `${FS}/nonConformites/n1`, nc('X'));
await write('Anonyme ne signale pas', false, null, `${FS}/nonConformites/n1`, nc('S1'));
await write('S1 ne modifie pas son signalement', false, 'S1', `${FS}/nonConformites/n2`, nc('S1', { statut: 'resolue' }), withNc);
await write('S1 ne supprime pas son signalement', false, 'S1', `${FS}/nonConformites/n2`, null, withNc);
await write('S1 n écrase pas une non-conformité existante', false, 'S1', `${FS}/nonConformites/n1`, nc('S1'), withNc);
await write('A résout une non-conformité', true, 'A', `${FS}/nonConformites/n2`, nc('S1', { statut: 'resolue', resolueLe: 5, resolutionNote: 'Alarme posée' }), withNc);
await write('A assigne responsable et échéance', true, 'A', `${FS}/nonConformites/n2`, nc('S1', { responsable: 'Service technique', echeance: Date.now() + 86400000 }), withNc);
await write('A supprime une non-conformité', true, 'A', `${FS}/nonConformites/n2`, null, withNc);
const multi = () => ({ 'controles/c9': controle('A'), 'nonConformites/n9': nc('A', { source: 'controle' }), 'nonConformites/n10': nc('A', { source: 'controle', article: '206' }) });
await scenario('A enregistre un contrôle et ses non-conformités en une écriture', true, { as: 'A', op: 'update', path: FS, value: multi() });
await scenario('S1 ne fait pas la même écriture groupée', false, { as: 'S1', op: 'update', path: FS, value: multi() });
await scenario('Écriture groupée invalide : rien n est enregistré', false, { as: 'A', op: 'update', path: FS, value: { ...multi(), 'nonConformites/n10': nc('A', { description: 'ok' }) } });
await read('S1 lit le registre', true, 'S1', FS, withNc);
await read('Civil C ne lit pas le registre', false, 'C', FS, withNc);
await read('X (sans profil) ne lit pas le registre', false, 'X', FS, withNc);
await read('Anonyme ne lit pas le registre', false, null, FS, withNc);

console.log('--- politique de confidentialité ---');
const PP = 'adminSettings/politiqueConfidentialite';
const policyDoc = (extra = {}) => ({ texte: 'Texte de la politique', miseAJour: '30 octobre 2026', majLe: 1, majPar: 'A', ...extra });
await write('A publie la politique', true, 'A', PP, policyDoc());
await write('A publie avec historique', true, 'A', PP, policyDoc({ historique: { v1_0: { texte: 'avant', miseAJour: 'x', majLe: 0, majPar: 'A' } } }));
await write('S1 ne publie pas la politique', false, 'S1', PP, policyDoc());
await write('Civil C ne publie pas la politique', false, 'C', PP, policyDoc());
await write('Anonyme ne publie pas la politique', false, null, PP, policyDoc());
await write('Politique trop longue refusée', false, 'A', PP, policyDoc({ texte: 'x'.repeat(40001) }));
await write('Politique de 40000 caractères acceptée', true, 'A', PP, policyDoc({ texte: 'x'.repeat(40000) }));
await write('Politique sans texte refusée', false, 'A', PP, { miseAJour: 'x', majLe: 1 });
await write('Politique avec une date trop longue refusée', false, 'A', PP, policyDoc({ miseAJour: 'x'.repeat(81) }));
await read('Anonyme lit la politique publiée', true, null, PP, (data) => { data.adminSettings = { politiqueConfidentialite: policyDoc() }; });

console.log('--- comptabilité : tarifs et page Transparence ---');
// G = Directrice ou Assistante de Direction (drapeau comptabiliteGestionnaires posé par la fonction serveur), sans être admin.
const withG = (data) => { data.comptabiliteGestionnaires = { G: true }; data.staffUIDs.G = true; };
const compte = { periode: '2026-T3', publieLe: 1, publiePar: 'G', soldeOuverture: 0, lignes: [{ type: 'recette', libelle: 'x', montant: 5 }], notes: '' };
const BRG = 'brouillonsTransparence';
const brouillonG = { lignes: [{ type: 'depense', libelle: 'Salaires', montant: '' }], notes: 'à finir', ouverture: '100', majLe: 5, majPar: 'G' };
const withBrouillonG = (data) => { withG(data); data[BRG] = { '2026-T3': brouillonG }; };
await write('G modifie les tarifs', true, 'G', 'adminSettings/tarifs/valeurs', { dossierMedical: 5000 }, withG);
await write('G publie des comptes', true, 'G', 'adminSettings/transparence/comptes/2026-T3', compte, withG);
await write('G publie les comptes d une pharmacie', true, 'G', 'adminSettings/transparence/comptesEntites/pharmacie/2026-T3', compte, withG);
await write('G modifie la grille salariale', true, 'G', 'adminSettings/grilleSalariale', { unite: 'de l\'heure', majLe: 1, grades: {} }, withG);
await write('G enregistre un brouillon de comptes', true, 'G', `${BRG}/2026-T3`, brouillonG, withG);
await read('G lit les brouillons de comptes', true, 'G', `${BRG}/2026-T3`, withBrouillonG);
await write('G ne modifie pas les autres réglages (confinement)', false, 'G', 'adminSettings/lockdown', { enabled: true }, withG);
await write('G ne modifie pas la politique de confidentialité', false, 'G', PP, policyDoc(), withG);
await write('G ne modifie pas les modèles de mails', false, 'G', 'adminSettings/mailTemplates/x', { subject: 's', body: 'b' }, withG);
await write('G ne se donne pas les droits admin', false, 'G', 'adminUIDs/G', true, withG);
await write('G ne pose pas son propre drapeau', false, 'G', 'comptabiliteGestionnaires/S1', true, withG);
await write('S1 ne se donne pas le droit comptabilité', false, 'S1', 'comptabiliteGestionnaires/S1', true, withG);
await write('A ne pose pas le drapeau depuis le navigateur', false, 'A', 'comptabiliteGestionnaires/S1', true, withG);
await write('S1 (sans le droit) ne modifie pas les tarifs', false, 'S1', 'adminSettings/tarifs/valeurs', { dossierMedical: 1 }, withG);
await write('S1 (sans le droit) ne publie pas de comptes', false, 'S1', 'adminSettings/transparence/comptes/2026-T3', compte, withG);
await write('S1 (sans le droit) ne modifie pas la grille', false, 'S1', 'adminSettings/grilleSalariale', { unite: 'x', majLe: 1, grades: {} }, withG);
await write('D1 (DMEC) ne publie pas de comptes', false, 'D1', 'adminSettings/transparence/comptes/2026-T3', compte, withG);
await write('P (polyvalent) ne modifie pas les tarifs', false, 'P', 'adminSettings/tarifs/valeurs', { dossierMedical: 1 }, withG);
await write('Civil C ne modifie pas les tarifs', false, 'C', 'adminSettings/tarifs/valeurs', { dossierMedical: 1 }, withG);
await write('Anonyme ne publie pas de comptes', false, null, 'adminSettings/transparence/comptes/2026-T3', compte, withG);
await write('A modifie toujours les tarifs', true, 'A', 'adminSettings/tarifs/valeurs', { dossierMedical: 5000 }, withG);
await read('S1 (sans le droit) ne lit pas les brouillons de comptes', false, 'S1', `${BRG}/2026-T3`, withBrouillonG);
await read('G lit son drapeau', true, 'G', 'comptabiliteGestionnaires/G', withG);
await read('S1 ne lit pas le drapeau de G', false, 'S1', 'comptabiliteGestionnaires/G', withG);
await read('A lit le drapeau de G', true, 'A', 'comptabiliteGestionnaires/G', withG);
await read('Les tarifs restent lisibles par tous', true, null, 'adminSettings/tarifs', (data) => { data.adminSettings = { tarifs: { valeurs: { dossierMedical: 5000 } } }; });

console.log('--- brouillons de la page Transparence ---');
const BR = 'brouillonsTransparence';
const brouillon = (extra = {}) => ({ lignes: [{ type: 'depense', libelle: 'Salaires des employés', montant: '' }, { type: 'recette', libelle: '', montant: '2500' }], notes: 'à finir', ouverture: '250000', majLe: 5, majPar: 'A', ...extra });
const withBrouillon = (data) => { data[BR] = { '2026-T3': brouillon() }; };
await write('A enregistre un brouillon (montants vides permis)', true, 'A', `${BR}/2026-T3`, brouillon());
await write('S1 n enregistre pas de brouillon', false, 'S1', `${BR}/2026-T3`, brouillon());
await write('D1 n enregistre pas de brouillon', false, 'D1', `${BR}/2026-T3`, brouillon());
await write('Civil C n enregistre pas de brouillon', false, 'C', `${BR}/2026-T3`, brouillon());
await write('Anonyme n enregistre pas de brouillon', false, null, `${BR}/2026-T3`, brouillon());
await write('Trimestre invalide refusé', false, 'A', `${BR}/2026-T5`, brouillon());
await write('Clé quelconque refusée', false, 'A', `${BR}/n-importe-quoi`, brouillon());
await write('Brouillon de la pharmacie du PHMC accepté', true, 'A', `${BR}/pharmacie_2024-T3`, brouillon());
await write('Brouillon de la pharmacie des Urgences accepté', true, 'A', `${BR}/pharmacie-urgences_2025-T4`, brouillon());
await write('Brouillon d une entité inconnue refusé', false, 'A', `${BR}/boulangerie_2025-T4`, brouillon());
await write('S1 n enregistre pas de brouillon de pharmacie', false, 'S1', `${BR}/pharmacie_2024-T3`, brouillon());
await write('Clé de pharmacie sans trimestre valide refusée', false, 'A', `${BR}/pharmacie_2024-T7`, brouillon());
await write('Ligne de type inconnu refusée', false, 'A', `${BR}/2026-T3`, brouillon({ lignes: [{ type: 'cadeau', libelle: 'x', montant: '1' }] }));
await write('Montant numérique refusé (le brouillon garde du texte)', false, 'A', `${BR}/2026-T3`, brouillon({ lignes: [{ type: 'recette', libelle: 'x', montant: 5 }] }));
await write('Libellé trop long refusé', false, 'A', `${BR}/2026-T3`, brouillon({ lignes: [{ type: 'recette', libelle: 'x'.repeat(121), montant: '1' }] }));
await write('Notes trop longues refusées', false, 'A', `${BR}/2026-T3`, brouillon({ notes: 'x'.repeat(1501) }));
await write('Brouillon sans date refusé', false, 'A', `${BR}/2026-T3`, { lignes: [], notes: 'x' });
await write('A supprime un brouillon', true, 'A', `${BR}/2026-T3`, null, withBrouillon);
await write('S1 ne supprime pas un brouillon', false, 'S1', `${BR}/2026-T3`, null, withBrouillon);
await read('A lit les brouillons', true, 'A', BR, withBrouillon);
await read('S1 ne lit pas les brouillons', false, 'S1', `${BR}/2026-T3`, withBrouillon);
await read('Civil C ne lit pas les brouillons', false, 'C', BR, withBrouillon);
await read('Anonyme ne lit pas les brouillons', false, null, `${BR}/2026-T3`, withBrouillon);

console.log('--- rôles du personnel créés dans l\'interface et lignes de la grille (recruteurs : création seule) ---');
const withR = (data) => { data.recruiterUIDs = { R: true }; };
const RP = 'adminSettings/rolesPersonnalises';
const roleDoc = (extra = {}) => ({ value: 'Technicien de laboratoire', pole: 'soignant', badgePrefix: 'TL', filiere: 'Autres professions de santé', creeLe: 1, creePar: 'R', ...extra });
const withRole = (data) => { withR(data); data.adminSettings = { rolesPersonnalises: { technicien_de_laboratoire: roleDoc() } }; };
await write('R crée un rôle', true, 'R', `${RP}/technicien_de_laboratoire`, roleDoc(), withR);
await write('A crée un rôle', true, 'A', `${RP}/technicien_de_laboratoire`, roleDoc(), withR);
await write('R ne modifie pas un rôle existant', false, 'R', `${RP}/technicien_de_laboratoire`, roleDoc({ badgePrefix: 'XX' }), withRole);
await write('R ne supprime pas un rôle', false, 'R', `${RP}/technicien_de_laboratoire`, null, withRole);
await write('A modifie un rôle', true, 'A', `${RP}/technicien_de_laboratoire`, roleDoc({ badgePrefix: 'TB' }), withRole);
await write('A supprime un rôle', true, 'A', `${RP}/technicien_de_laboratoire`, null, withRole);
await write('S1 (non recruteur) ne crée pas de rôle', false, 'S1', `${RP}/technicien_de_laboratoire`, roleDoc(), withR);
await write('Civil C ne crée pas de rôle', false, 'C', `${RP}/technicien_de_laboratoire`, roleDoc(), withR);
await write('Anonyme ne crée pas de rôle', false, null, `${RP}/technicien_de_laboratoire`, roleDoc(), withR);
await write('G (comptabilité) ne crée pas de rôle', false, 'G', `${RP}/technicien_de_laboratoire`, roleDoc(), withG);
await write('Rôle d\'une famille inconnue refusé', false, 'R', `${RP}/technicien_de_laboratoire`, roleDoc({ pole: 'admin' }), withR);
await write('Préfixe de badge en minuscules refusé', false, 'R', `${RP}/technicien_de_laboratoire`, roleDoc({ badgePrefix: 'tl' }), withR);
await write('Préfixe de badge de 5 lettres refusé', false, 'R', `${RP}/technicien_de_laboratoire`, roleDoc({ badgePrefix: 'ABCDE' }), withR);
await write('Nom de rôle d\'un caractère refusé', false, 'R', `${RP}/technicien_de_laboratoire`, roleDoc({ value: 'T' }), withR);
await write('Nom de rôle trop long refusé', false, 'R', `${RP}/technicien_de_laboratoire`, roleDoc({ value: 'x'.repeat(61) }), withR);
await write('Clé de rôle avec une majuscule refusée', false, 'R', `${RP}/Technicien`, roleDoc(), withR);
await write('Rôle avec un champ en trop refusé', false, 'R', `${RP}/technicien_de_laboratoire`, roleDoc({ admin: true }), withR);
await write('Rôle sans filière refusé', false, 'R', `${RP}/technicien_de_laboratoire`, { value: 'Technicien de laboratoire', pole: 'soignant', badgePrefix: 'TL', creeLe: 1 }, withR);
await read('Anonyme lit les rôles personnalisés', true, null, RP, withRole);

const GP = 'adminSettings/grilleSalariale';
const gradeDoc = (extra = {}) => ({ grade: 'Technicien de laboratoire', echelon: 6, ...extra });
const echelonsDoc = () => Object.fromEntries(Array.from({ length: 15 }, (unused, i) => [String(i + 1), { horaire: 2500 + i * 100, hebdo: 50000 + i * 2000 }]));
const withGrade = (data) => { withR(data); data.adminSettings = { grilleSalariale: { majLe: 1, echelons: echelonsDoc(), grades: { Technicien_de_laboratoire: gradeDoc() } } }; };
await write('R range un nouveau grade dans la grille (un échelon)', true, 'R', `${GP}/grades/Technicien_de_laboratoire`, gradeDoc(), withR);
await write('R ne modifie pas l\'échelon d\'un grade existant', false, 'R', `${GP}/grades/Technicien_de_laboratoire`, gradeDoc({ echelon: 15 }), withGrade);
await write('R ne modifie pas l\'échelon d\'un grade (champ)', false, 'R', `${GP}/grades/Technicien_de_laboratoire/echelon`, 15, withGrade);
await write('R ne supprime pas un grade', false, 'R', `${GP}/grades/Technicien_de_laboratoire`, null, withGrade);
await write('R ne modifie pas le salaire d\'un échelon', false, 'R', `${GP}/echelons/6/horaire`, 9999999, withGrade);
await write('R ne remplace pas un échelon', false, 'R', `${GP}/echelons/6`, { horaire: 1, hebdo: 1 }, withGrade);
await write('R ne remplace pas toute la grille', false, 'R', GP, { majLe: 2, echelons: echelonsDoc(), grades: { Technicien_de_laboratoire: gradeDoc() } }, withR);
await write('S1 (non recruteur) ne crée pas de grade', false, 'S1', `${GP}/grades/Technicien_de_laboratoire`, gradeDoc(), withR);
await write('Anonyme ne crée pas de grade', false, null, `${GP}/grades/Technicien_de_laboratoire`, gradeDoc(), withR);
await write('Échelon 0 refusé', false, 'R', `${GP}/grades/Technicien_de_laboratoire`, gradeDoc({ echelon: 0 }), withR);
await write('Échelon 16 refusé', false, 'R', `${GP}/grades/Technicien_de_laboratoire`, gradeDoc({ echelon: 16 }), withR);
await write('Échelon décimal refusé', false, 'R', `${GP}/grades/Technicien_de_laboratoire`, gradeDoc({ echelon: 6.5 }), withR);
await write('Échelon en texte refusé', false, 'R', `${GP}/grades/Technicien_de_laboratoire`, gradeDoc({ echelon: '6' }), withR);
await write('Grade sans échelon refusé', false, 'R', `${GP}/grades/Technicien_de_laboratoire`, { grade: 'Technicien de laboratoire' }, withR);
await write('Ancienne ligne à échelons multiples refusée', false, 'R', `${GP}/grades/Technicien_de_laboratoire`, { grade: 'Technicien de laboratoire', echelons: [{ libelle: 'E', horaire: 1 }] }, withR);
await write('Grade avec un champ en trop refusé', false, 'R', `${GP}/grades/Technicien_de_laboratoire`, gradeDoc({ prime: 1 }), withR);
await write('G publie la grille (15 échelons + grades)', true, 'G', GP, { majLe: 1, majPar: 'G', echelons: echelonsDoc(), grades: { Technicien_de_laboratoire: gradeDoc() } }, withG);
await write('G modifie le salaire d\'un échelon', true, 'G', `${GP}/echelons/6`, { horaire: 3000, hebdo: 60000 }, (data) => { withG(data); withGrade(data); });
await write('G change l\'échelon d\'un grade', true, 'G', `${GP}/grades/Technicien_de_laboratoire`, gradeDoc({ echelon: 7 }), (data) => { withG(data); withGrade(data); });
await write('A modifie le salaire d\'un échelon', true, 'A', `${GP}/echelons/15`, { horaire: 5000, hebdo: 100000 }, withGrade);
await write('Échelon 16 refusé même pour A', false, 'A', `${GP}/echelons/16`, { horaire: 1, hebdo: 1 }, withGrade);
await write('Échelon 0 refusé même pour A', false, 'A', `${GP}/echelons/0`, { horaire: 1, hebdo: 1 }, withGrade);
await write('Salaire négatif refusé', false, 'A', `${GP}/echelons/6`, { horaire: -1, hebdo: 1 }, withGrade);
await write('Salaire énorme refusé', false, 'A', `${GP}/echelons/6`, { horaire: 1, hebdo: 10000001 }, withGrade);
await write('Salaire en texte refusé', false, 'A', `${GP}/echelons/6`, { horaire: '3000', hebdo: 1 }, withGrade);
await write('Échelon sans montant à la semaine refusé', false, 'A', `${GP}/echelons/6`, { horaire: 3000 }, withGrade);
await write('Échelon avec un champ en trop refusé', false, 'A', `${GP}/echelons/6`, { horaire: 1, hebdo: 1, secret: 'x' }, withGrade);
await write('A publie la grille avec un échelon de grade invalide : refusé', false, 'A', GP, { majLe: 1, echelons: echelonsDoc(), grades: { X: { grade: 'X', echelon: 99 } } });
await read('Anonyme lit la grille', true, null, GP, withGrade);

console.log('--- messagerie interne (messagesInternes / messagerie) ---');
const mail = (over = {}) => ({ deUid: 'S1', deNom: 'S One', objet: 'Bonjour', corps: 'Texte du message', creeLe: 1, dest: { S2: 'S Two' }, acces: { S1: true, S2: true }, fil: 'm1', deFonction: 'Médecin', deService: 'Urgences', ...over });
const withMail = (data) => { data.messagesInternes = { m1: mail(), m2: mail({ deUid: 'S2', deNom: 'S Two', dest: { S1: 'S One' }, fil: 'm2' }) }; };
const withMailSolo = (data) => { data.messagesInternes = { m1: mail({ acces: { S1: true } }) }; };
const withDebugMail = (data) => { withMail(data); data.adminSettings = { debugMessagerieAdmin: { enabled: true } }; };
const entry = (over = {}) => ({ role: 'recu', lu: false, le: 1, objet: 'Bonjour', de: 'S One', apercu: 'Texte', fil: 'm1', ...over });
const withBoxes = (data) => { withMail(data); data.messagerie = { S2: { m1: entry() } }; };

await write('S1 envoie un message à S2', true, 'S1', 'messagesInternes/n1', mail({ fil: 'n1' }));
await write('S1 ne peut pas écrire au nom de S2 (deUid)', false, 'S1', 'messagesInternes/n1', mail({ deUid: 'S2', fil: 'n1' }));
await write('Un admin envoie un message', true, 'A', 'messagesInternes/n1', mail({ deUid: 'A', acces: { A: true, S2: true }, fil: 'n1' }));
await write('Compte sans profil (X) n\'envoie pas', false, 'X', 'messagesInternes/n1', mail({ deUid: 'X', acces: { X: true, S2: true }, fil: 'n1' }));
await write('Civil ne peut pas envoyer', false, 'C', 'messagesInternes/n1', mail({ deUid: 'C', acces: { C: true, S2: true }, fil: 'n1' }));
await write('Anonyme n\'envoie pas', false, null, 'messagesInternes/n1', mail({ fil: 'n1' }));
await write('Message sans l\'expéditeur dans les accès refusé', false, 'S1', 'messagesInternes/n1', mail({ acces: { S2: true }, fil: 'n1' }));
await write('Message sans destinataire refusé', false, 'S1', 'messagesInternes/n1', mail({ dest: {}, fil: 'n1' }));
await write('Message sans objet refusé', false, 'S1', 'messagesInternes/n1', mail({ objet: '', fil: 'n1' }));
await write('Message vide refusé', false, 'S1', 'messagesInternes/n1', mail({ corps: '', fil: 'n1' }));
await write('Message trop long refusé', false, 'S1', 'messagesInternes/n1', mail({ corps: 'x'.repeat(20001), fil: 'n1' }));
await write('Champ inattendu refusé', false, 'S1', 'messagesInternes/n1', mail({ secret: 'x', fil: 'n1' }));
await write('Fonction, département et signature https acceptés', true, 'S1', 'messagesInternes/n1', mail({ fil: 'n1', deFonction: 'Médecin', deService: 'Urgences', deSignature: 'https://phmc-tools.com/img/phmc.png' }));
await write('Message sans fonction refusé', false, 'S1', 'messagesInternes/n1', (({ deFonction, ...rest }) => rest)(mail({ fil: 'n1' })));
await write('Message sans département refusé', false, 'S1', 'messagesInternes/n1', (({ deService, ...rest }) => rest)(mail({ fil: 'n1' })));
await write('Fonction vide refusée', false, 'S1', 'messagesInternes/n1', mail({ fil: 'n1', deFonction: '' }));
await write('Message sans signature accepté (facultative)', true, 'S1', 'messagesInternes/n1', mail({ fil: 'n1' }));
await write('Signature non https refusée', false, 'S1', 'messagesInternes/n1', mail({ fil: 'n1', deSignature: 'javascript:alert(1)' }));
await write('Signature http refusée', false, 'S1', 'messagesInternes/n1', mail({ fil: 'n1', deSignature: 'http://exemple.fr/a.png' }));
await write('Fonction trop longue refusée', false, 'S1', 'messagesInternes/n1', mail({ fil: 'n1', deFonction: 'x'.repeat(121) }));
await write('Réécrire un message existant refusé', false, 'S1', 'messagesInternes/m1', mail({ corps: 'modifié' }), withMail);
await write('Le destinataire ne modifie pas le message', false, 'S2', 'messagesInternes/m1/corps', 'modifié', withMail);
await read('L\'expéditeur lit son message', true, 'S1', 'messagesInternes/m1', withMail);
await read('Le destinataire lit le message', true, 'S2', 'messagesInternes/m1', withMail);
await read('Un tiers du personnel ne lit pas', false, 'D1', 'messagesInternes/m1', withMail);
await read('Un admin ne lit pas (interrupteur debug coupé)', false, 'A', 'messagesInternes/m1', withMail);
await read('Un admin lit (interrupteur debug activé)', true, 'A', 'messagesInternes/m1', withDebugMail);
await read('Un admin liste tout (interrupteur debug activé)', true, 'A', 'messagesInternes', withDebugMail);
await read('Un admin ne liste pas tout (interrupteur coupé)', false, 'A', 'messagesInternes', withMail);
await read('Un soignant ne liste pas tous les messages', false, 'S1', 'messagesInternes', withMail);
await read('Un soignant ne liste pas tout même si le debug est actif', false, 'S1', 'messagesInternes', withDebugMail);
await write('Le destinataire retire SON accès', true, 'S2', 'messagesInternes/m1/acces/S2', null, withMail);
await write('L\'expéditeur retire SON accès (le destinataire garde le message)', true, 'S1', 'messagesInternes/m1/acces/S1', null, withMail);
await write('On ne retire pas l\'accès d\'un autre', false, 'S2', 'messagesInternes/m1/acces/S1', null, withMail);
await write('Un tiers ne retire aucun accès', false, 'D1', 'messagesInternes/m1/acces/S1', null, withMail);
await write('On ne s\'ajoute pas un accès', false, 'D1', 'messagesInternes/m1/acces/D1', true, withMail);
await write('Supprimer le message entier à plusieurs : refusé', false, 'S1', 'messagesInternes/m1', null, withMail);
await write('Même le dernier détenteur ne supprime pas le nœud (nettoyage par le serveur)', false, 'S1', 'messagesInternes/m1', null, withMailSolo);
await write('Le dernier détenteur retire son accès', true, 'S1', 'messagesInternes/m1/acces/S1', null, withMailSolo);
await write('Un tiers ne supprime pas le dernier exemplaire', false, 'S2', 'messagesInternes/m1', null, withMailSolo);
await write('Suppression d\'une copie en un seul envoi (boîte + accès)', true, 'S2', 'messagerie/S2/m1', null, withBoxes);
await read('S2 lit sa boîte', true, 'S2', 'messagerie/S2', withBoxes);
await read('S1 ne lit pas la boîte de S2', false, 'S1', 'messagerie/S2', withBoxes);
await read('Un admin ne lit pas la boîte d\'un autre', false, 'A', 'messagerie/S2', withBoxes);
await write('S1 dépose le message dans la boîte de S2', true, 'S1', 'messagerie/S2/m1', entry(), withMail);
await write('S1 ne peut pas déposer pour quelqu\'un qui n\'a pas accès', false, 'S1', 'messagerie/D1/m1', entry(), withMail);
await write('S1 ne dépose pas un message dont il n\'est pas l\'expéditeur', false, 'S1', 'messagerie/S2/m2', entry({ fil: 'm2' }), withMail);
await write('Entrée de boîte avec un rôle inconnu refusée', false, 'S1', 'messagerie/S2/m1', entry({ role: 'autre' }), withMail);
await write('Entrée de boîte avec un champ en trop refusée', false, 'S1', 'messagerie/S2/m1', entry({ secret: 1 }), withMail);
await write('S2 marque son message lu', true, 'S2', 'messagerie/S2/m1/lu', true, withBoxes);
await scenario('S2 marque son message lu (update() du client, au niveau de l\'entrée)', true, { as: 'S2', op: 'update', path: 'messagerie/S2/m1', value: { lu: true } }, withBoxes);
await write('S2 supprime son entrée de boîte', true, 'S2', 'messagerie/S2/m1', null, withBoxes);
await write('S1 ne modifie pas la boîte de S2 une fois créée', false, 'S1', 'messagerie/S2/m1/lu', true, withBoxes);

console.log('--- dossier patient : verrou des formulaires, jetons, file d\'attente ---');
const MIN = 60 * 1000;
const dossierForm = (version, ageMin) => ({ bbCodeVersion: version, bbCode: 'dossier', timestamp: Date.now() - ageMin * MIN, data: { patientID: 'PHMC-1' } });
// Le formulaire du patient C (compte Civil, ID PHMC-1) : facture et index rangés sous PHMC-1 / clé du rapport.
const withDossierForm = (version, { age = 30, invoice = null, visibility = 'owner' } = {}) => (data) => {
    data.savedReports['Civil_Name_PHMC-1'] = { d1: dossierForm(version, age) };
    data.patientRecords['PHMC-1'].d1 = { reportPath: 'savedReports/Civil_Name_PHMC-1/d1', visibility, bbCodeVersion: version };
    if (invoice) data.facturesPatients = { 'PHMC-1': { d1: invoice } };
    data.patientsDecedes = {};
};
const FORM_PATH = 'savedReports/Civil_Name_PHMC-1/d1';
await write('Civil C supprime son dossier payé il y a 5 minutes (dans le délai)', true, 'C', FORM_PATH, null,
    withDossierForm(25, { age: 60, invoice: { statut: 'paye', payeLe: Date.now() - 5 * MIN, montant: 1 } }));
await write('Civil C ne supprime pas son dossier payé il y a 20 minutes', false, 'C', FORM_PATH, null,
    withDossierForm(25, { age: 60, invoice: { statut: 'paye', payeLe: Date.now() - 20 * MIN, montant: 1 } }));
await write('Civil C ne modifie pas son dossier payé il y a 20 minutes', false, 'C', FORM_PATH, { ...dossierForm(3, 60), bbCode: 'maj' },
    withDossierForm(3, { age: 60, invoice: { statut: 'paye', payeLe: Date.now() - 20 * MIN, montant: 1 } }));
await write('Civil C supprime son dossier pas encore payé, même ancien', true, 'C', FORM_PATH, null,
    withDossierForm(25, { age: 600, invoice: { statut: 'a_payer', montant: 1 } }));
await write('Civil C supprime sa mise à jour gratuite enregistrée il y a 5 minutes', true, 'C', FORM_PATH, null, withDossierForm(26, { age: 5 }));
await write('Civil C ne supprime pas sa mise à jour gratuite enregistrée il y a 20 minutes', false, 'C', FORM_PATH, null, withDossierForm(26, { age: 20 }));
await write('Civil C ne supprime pas un dossier créé par le personnel', false, 'C', FORM_PATH, null,
    withDossierForm(25, { age: 1, visibility: 'staff-only', invoice: { statut: 'a_payer', montant: 1 } }));
await write('Un autre formulaire de soins reste supprimable comme avant', true, 'C', FORM_PATH, null, withDossierForm(20, { age: 600 }));
await write('Admin A supprime un dossier verrouillé', true, 'A', FORM_PATH, null,
    withDossierForm(25, { age: 600, invoice: { statut: 'paye', payeLe: Date.now() - 300 * MIN, montant: 1 } }));

const withDossier = (data) => {
    data.dossiersPatients = { 'PHMC-1': { donnees: { patientBloodType: 'A+' } }, 'PHMC-2': { donnees: { patientBloodType: 'O-' } } };
    data.jetonsDossier = { 'PHMC-1': { basique: 1, avance: 0, maj: 0 } };
};
await read('Civil C lit son dossier', true, 'C', 'dossiersPatients/PHMC-1', withDossier);
await read('Civil C ne lit pas le dossier d un autre', false, 'C', 'dossiersPatients/PHMC-2', withDossier);
await read('S1 (personnel) lit le dossier d un patient', true, 'S1', 'dossiersPatients/PHMC-2', withDossier);
await write('Civil C n écrit pas dans son dossier', false, 'C', 'dossiersPatients/PHMC-1/donnees/patientBloodType', 'AB+', withDossier);
await write('S1 n écrit pas dans le dossier', false, 'S1', 'dossiersPatients/PHMC-1/donnees/patientBloodType', 'AB+', withDossier);
await write('Admin A corrige le dossier', true, 'A', 'dossiersPatients/PHMC-1/donnees/patientBloodType', 'AB+', withDossier);
await write('Civil C dépense un jeton (1 -> 0)', true, 'C', 'jetonsDossier/PHMC-1/basique', 0, withDossier);
await write('Civil C ne se donne pas un jeton', false, 'C', 'jetonsDossier/PHMC-1/avance', 1, withDossier);
await write('Civil C n augmente pas son compteur de jetons', false, 'C', 'jetonsDossier/PHMC-1/basique', 5, withDossier);
await write('S1 dépense un jeton pour le patient (formulaire rempli pour lui)', true, 'S1', 'jetonsDossier/PHMC-1/basique', 0, withDossier);
await write('S1 ne se donne pas de jeton', false, 'S1', 'jetonsDossier/PHMC-1/avance', 3, withDossier);
await write('Civil C signale une erreur sur son dossier', true, 'C', 'signalementsDossier/PHMC-1/d1', { creeLe: Date.now() }, withDossier);
await write('Civil C ne signale pas pour un autre patient', false, 'C', 'signalementsDossier/PHMC-2/d1', { creeLe: Date.now() }, withDossier);
await write('Civil C met un formulaire en file pour son dossier', true, 'C', 'dossiersEnAttente/PHMC-1/d1', { version: 25, reportPath: FORM_PATH, creeLe: Date.now(), createur: 'patient' }, withDossier);
await write('Civil C ne met pas en file pour un autre patient', false, 'C', 'dossiersEnAttente/PHMC-2/d1', { version: 25, reportPath: FORM_PATH, creeLe: Date.now(), createur: 'patient' }, withDossier);
await write('Civil C ne retire pas son formulaire de la file', false, 'C', 'dossiersEnAttente/PHMC-1/d1', null,
    (data) => { withDossier(data); data.dossiersEnAttente = { 'PHMC-1': { d1: { version: 25, reportPath: FORM_PATH, creeLe: 1, createur: 'patient' } } }; });
await write('S1 met un formulaire en file pour un patient', true, 'S1', 'dossiersEnAttente/PHMC-2/d1', { version: 3, reportPath: 'savedReports/S_One/x', creeLe: Date.now(), createur: 'personnel' }, withDossier);

// Mail Externe (formulaire 42) : lu par son créateur seul, et par ceux avec qui il l'a partagé (partageAvec) ; le créateur reste seul propriétaire.
console.log('--- mails externes partagés ---');
const withExternalMail = (data) => {
    data.savedReports.S_One = { m1: { bbCodeVersion: 42, bbCode: 'mail externe', data: { externalMailSubject: 'Objet' }, partageAvec: { S_Two: 'S2' } }, m2: { bbCodeVersion: 42, bbCode: 'non partagé', data: { externalMailSubject: 'Autre' } } };
    data.partagesRecus = { S_Two: { 'S_One__m1': { ownerNode: 'S_One', reportKey: 'm1', titre: 'Objet', de: 'S1', le: 1 } } };
};
await read('S2 lit le mail externe que S1 a partagé avec lui', true, 'S2', 'savedReports/S_One/m1', withExternalMail);
await read('P ne lit pas un mail externe qui n a pas été partagé avec lui', false, 'P', 'savedReports/S_One/m1', withExternalMail);
await read('S2 ne lit pas un mail externe non partagé', false, 'S2', 'savedReports/S_One/m2', withExternalMail);
await read('Admin A lit tous les mails externes', true, 'A', 'savedReports/S_One/m2', withExternalMail);
await read('S2 lit sa liste de partages reçus', true, 'S2', 'partagesRecus/S_Two', withExternalMail);
await read('P ne lit pas les partages reçus de S2', false, 'P', 'partagesRecus/S_Two', withExternalMail);
await write('S1 partage son mail : ligne dans la liste de S2', true, 'S1', 'partagesRecus/S_Two/S_One__m2', { ownerNode: 'S_One', reportKey: 'm2', titre: 'Autre', de: 'S1', le: 2 }, withExternalMail);
await write('S2 ne fabrique pas un partage au nom de S1', false, 'S2', 'partagesRecus/S_Two/faux', { ownerNode: 'S_One', reportKey: 'm2', titre: 'Autre', de: 'S1', le: 2 }, withExternalMail);
await write('S1 retire le partage de la liste de S2', true, 'S1', 'partagesRecus/S_Two/S_One__m1', null, withExternalMail);
await write('S2 retire une ligne de SA liste', true, 'S2', 'partagesRecus/S_Two/S_One__m1', null, withExternalMail);
await write('P ne retire pas une ligne de la liste de S2', false, 'P', 'partagesRecus/S_Two/S_One__m1', null, withExternalMail);
await write('S2 ne modifie pas le mail de S1', false, 'S2', 'savedReports/S_One/m1/bbCode', 'modifié', withExternalMail);
await write('S1 ajoute un destinataire à son mail', true, 'S1', 'savedReports/S_One/m2/partageAvec/P_One', 'P', withExternalMail);

// Contact d'urgence modifié depuis un formulaire de santé mentale : demande posée par le personnel, appliquée par le serveur (le dossier n'est jamais écrit par un client).
console.log("--- contact d'urgence (santé mentale) ---");
const contactRequest = { champs: { patientEmergencyContactNumber: '555-0200' }, par: 'S1', titre: 'Consultation psychiatrique', creeLe: Date.now() };
await write("S1 pose une demande de mise à jour du contact d'urgence", true, 'S1', 'contactsUrgenceMaj/PHMC-1/req1', contactRequest);
await write('Civil C ne pose pas de demande', false, 'C', 'contactsUrgenceMaj/PHMC-1/req1', contactRequest);
await write('S1 ne modifie pas une demande existante', false, 'S1', 'contactsUrgenceMaj/PHMC-1/req1', { ...contactRequest, par: 'autre' }, (data) => { data.contactsUrgenceMaj = { 'PHMC-1': { req1: contactRequest } }; });
await write('Une demande sans champs est refusée', false, 'S1', 'contactsUrgenceMaj/PHMC-1/req2', { par: 'S1', creeLe: 1 });
await write("S1 pose une demande d'ajouts au fond médical (sans contact)", true, 'S1', 'contactsUrgenceMaj/PHMC-1/req3', { ajouts: { patientAllergies: ['Latex'] }, par: 'S1', titre: 'Consultation', creeLe: Date.now() });
await write('Une demande sans champs ni ajouts est refusée', false, 'S1', 'contactsUrgenceMaj/PHMC-1/req4', { par: 'S1', titre: 'x', creeLe: 1 });
await read('S1 ne relit pas les demandes (admin et serveur seulement)', false, 'S1', 'contactsUrgenceMaj/PHMC-1', (data) => { data.contactsUrgenceMaj = { 'PHMC-1': { req1: contactRequest } }; });

// Décès : marqueur lu par le patient, identifiants temporaires du DMEC, décès signalés, contestations.
console.log('--- décès : identifiants temporaires, décès signalés, contestations ---');
await read('Le civil C lit SON marqueur de décès (page « déclaré décédé »)', true, 'C', 'patientsDecedes/PHMC-1');
await read("Le civil C ne lit pas le marqueur d'un autre patient", false, 'C', 'patientsDecedes/PHMC-2');
await write('Le civil C ne pose pas de marqueur de décès', false, 'C', 'patientsDecedes/PHMC-9', { depuis: 1, uid: 'C' });

const tmp = { nom: 'Inconnu (corps non identifié)', creeLe: 1, uid: 'D1', statut: 'temporaire' };
const withTmp = (data) => { data.identifiantsTemporaires = { 'TMP-ABCDE': tmp }; };
await write('D1 (DMEC) crée un ID temporaire', true, 'D1', 'identifiantsTemporaires/TMP-ABCDE', tmp);
await write('S1 (soignant) ne crée pas d ID temporaire', false, 'S1', 'identifiantsTemporaires/TMP-ABCDE', { ...tmp, uid: 'S1' });
await write('D1 ne crée pas un ID temporaire au nom de D2', false, 'D1', 'identifiantsTemporaires/TMP-ABCDE', { ...tmp, uid: 'D2' });
await write("D1 ne crée pas un ID qui n a pas la forme TMP-XXXXX", false, 'D1', 'identifiantsTemporaires/PHMC-1', tmp);
await write("D1 n écrase pas un ID temporaire existant", false, 'D1', 'identifiantsTemporaires/TMP-ABCDE', { ...tmp, nom: 'autre' }, withTmp);
await write("D2 n attribue pas l ID temporaire (réservé aux admins)", false, 'D2', 'identifiantsTemporaires/TMP-ABCDE', { ...tmp, statut: 'attribue', idReel: 'PHMC-7' }, withTmp);
await write("L'admin A attribue l ID temporaire à un ID réel", true, 'A', 'identifiantsTemporaires/TMP-ABCDE', { ...tmp, statut: 'attribue', idReel: 'PHMC-7' }, withTmp);
await write("Un ID attribué sans ID réel est refusé", false, 'A', 'identifiantsTemporaires/TMP-ABCDE', { ...tmp, statut: 'attribue' }, withTmp);
await read('S1 lit les identifiants temporaires', true, 'S1', 'identifiantsTemporaires', withTmp);
await read('Le civil C ne lit pas les identifiants temporaires', false, 'C', 'identifiantsTemporaires', withTmp);

const signal = { patientID: 'PHMC-2', patientName: 'Jean Test', kind: 'urgence', date: '2026-11-11', heure: '15:12', par: 'S1', uid: 'S1', creeLe: 1, statut: 'a_traiter' };
const withSignal = (data) => { data.decesSignales = { sig1: signal }; };
await write('S1 signale un décès (clé du rapport de soins)', true, 'S1', 'decesSignales/sig1', signal);
await write('S1 ne signale pas un décès au nom de S2', false, 'S1', 'decesSignales/sig1', { ...signal, uid: 'S2' });
await write('Le civil C ne signale pas de décès', false, 'C', 'decesSignales/sig1', { ...signal, uid: 'C' });
await write("S1 ne crée pas une fiche déjà traitée", false, 'S1', 'decesSignales/sig1', { ...signal, statut: 'traite' });
await read('D1 (DMEC) lit les décès signalés', true, 'D1', 'decesSignales', withSignal);
await read('Le civil C ne lit pas les décès signalés', false, 'C', 'decesSignales', withSignal);
await write('S1 retire sa propre fiche tant qu elle est à traiter', true, 'S1', 'decesSignales/sig1', null, withSignal);
await write('S2 ne retire pas la fiche de S1', false, 'S2', 'decesSignales/sig1', null, withSignal);
await write('S1 ne la passe pas lui-même en « traité »', false, 'S1', 'decesSignales/sig1', { ...signal, statut: 'traite' }, withSignal);
await write('D1 (DMEC) la passe en « traité »', true, 'D1', 'decesSignales/sig1', { ...signal, statut: 'traite', traiteLe: 2, traitePar: 'D1', rapportDmec: 'savedReports/D_One/d9' }, withSignal);

const contest = { uid: 'C', message: 'Je suis bien vivant.', creeLe: 1, statut: 'en_attente' };
const withContest = (status) => (data) => { data.contestationsDeces = { 'PHMC-1': { ...contest, statut: status } }; };
await write('Le civil C conteste SON décès', true, 'C', 'contestationsDeces/PHMC-1', contest);
await write("Le civil C ne conteste pas le décès d'un autre patient", false, 'C', 'contestationsDeces/PHMC-2', contest);
await write('Une contestation vide est refusée', false, 'C', 'contestationsDeces/PHMC-1', { ...contest, message: '' });
await write('Le civil C ne se déclare pas lui-même « accepté »', false, 'C', 'contestationsDeces/PHMC-1', { ...contest, statut: 'acceptee' });
await write('Le civil C ne réécrit pas une contestation en attente', false, 'C', 'contestationsDeces/PHMC-1', { ...contest, message: 'autre' }, withContest('en_attente'));
await write('Le civil C peut recontester après un rejet', true, 'C', 'contestationsDeces/PHMC-1', { ...contest, message: 'Voici une preuve.' }, withContest('rejetee'));
await write("L'admin A répond à la contestation", true, 'A', 'contestationsDeces/PHMC-1', { ...contest, statut: 'rejetee', reponse: 'Décès confirmé.', traiteLe: 2, traitePar: 'A' }, withContest('en_attente'));
await read('Le civil C lit sa contestation et la réponse', true, 'C', 'contestationsDeces/PHMC-1', withContest('en_attente'));
await read("S1 ne lit pas les contestations (admins seulement)", false, 'S1', 'contestationsDeces/PHMC-1', withContest('en_attente'));
await read("L'admin A lit toutes les contestations", true, 'A', 'contestationsDeces', withContest('en_attente'));


// Compte d'un patient déclaré décédé (Civil ou personnel) : lecture, contestation et notification aux admins seulement ; tout le reste est refusé. Seuls les admins ne sont jamais concernés.
console.log('--- compte Civil décédé : écritures bloquées ---');
await write('[décédé] C ne crée plus de rapport', false, 'C', 'savedReports/Civil_Name_PHMC-1/c1', newReport('PHMC-1'));
await write('[décédé] C ne modifie plus un rapport portant son ID', false, 'C', 'savedReports/S_Two/r1', { ...r1, bbCode: 'maj civil' });
await write("[décédé] C n'écrit plus dans l'index des dossiers", false, 'C', 'patientRecords/PHMC-1/nouv', { reportPath: 'x' });
await write('[décédé] C ne met plus de formulaire en file pour son dossier', false, 'C', 'dossiersEnAttente/PHMC-1/d1', { version: 25, reportPath: 'savedReports/Civil_Name_PHMC-1/d1', creeLe: Date.now(), createur: 'patient' }, withDossier);
await write('[décédé] C ne dépense plus de jeton', false, 'C', 'jetonsDossier/PHMC-1/basique', 0, withDossier);
await write('[décédé] C ne signale plus d erreur sur son dossier', false, 'C', 'signalementsDossier/PHMC-1/d1', { creeLe: Date.now() }, withDossier);
await write('[décédé] C ne modifie plus son profil', false, 'C', 'civilians/C/phone', '555-0100');
await read('[décédé] C lit toujours son dossier', true, 'C', 'dossiersPatients/PHMC-1', withDossier);
await write('[décédé] C peut contester (contestationsDeces)', true, 'C', 'contestationsDeces/PHMC-1', { uid: 'C', message: 'Je suis bien vivant.', creeLe: 1, statut: 'en_attente' });
await write('[décédé] C prévient les administrateurs de sa contestation', true, 'C', 'notificationsGroupes/admin/n1', { type: 'demande', titre: 'Contestation de décès : PHMC-1', texte: 'Je suis vivant', creeLe: Date.now(), deUid: 'C' });
// Le personnel est bloqué comme un Civil : son ID patient (idsPatientParCompte, posé par la synchronisation admin) figure dans le registre des décès. Seuls les admins ne sont jamais touchés.
const staffDead = (data) => { data.idsPatientParCompte = { S1: 'PHMC-6' }; data.patientsDecedes['PHMC-6'] = { depuis: 1, uid: 'D1' }; };
const staffAlive = (data) => { data.idsPatientParCompte = { S1: 'PHMC-6' }; }; // même table, mais PHMC-6 n'est pas déclaré décédé (ou l'avis de décès a été levé)
await write('[décédé] S1 (personnel) ne crée plus de rapport', false, 'S1', 'savedReports/S_One/x1', newReport(null), staffDead);
await write("[décédé] S1 (personnel) n'écrit plus dans l'index des dossiers", false, 'S1', 'patientRecords/PHMC-5/nouv', { reportPath: 'x' }, staffDead);
await write("[décédé] S1 (personnel) ne modifie plus un rapport qu'il a posé", false, 'S1', 'savedReports/S_One/x1/bbCode', 'maj', (data) => { staffDead(data); data.savedReports.S_One = { x1: { bbCodeVersion: 20, bbCode: 'a', data: { note: 'n' } } }; });
await write('[décédé] S1 (personnel) peut contester', true, 'S1', 'contestationsDeces/PHMC-6', { uid: 'S1', message: 'Je suis bien vivant.', creeLe: 1, statut: 'en_attente' }, staffDead);
await write('[décédé] S1 (personnel) prévient les administrateurs de sa contestation', true, 'S1', 'notificationsGroupes/admin/n1', { type: 'demande', titre: 'Contestation de décès : PHMC-6', creeLe: Date.now(), deUid: 'S1' }, staffDead);
await read('[décédé] S1 (personnel) lit toujours sa contestation et son marqueur', true, 'S1', 'contestationsDeces/PHMC-6', (data) => { staffDead(data); data.contestationsDeces = { 'PHMC-6': { uid: 'S1', message: 'x', creeLe: 1, statut: 'en_attente' } }; });
await read('[décédé] S2 ne lit pas la contestation de S1', false, 'S2', 'contestationsDeces/PHMC-6', (data) => { staffDead(data); data.contestationsDeces = { 'PHMC-6': { uid: 'S1', message: 'x', creeLe: 1, statut: 'en_attente' } }; });
await write("[décédé] un admin dont le patient est déclaré décédé écrit toujours", true, 'A', 'civilians/A/phone', '555-0101', (data) => { data.civilians.A = { patientID: 'PHMC-6' }; data.idsPatientParCompte = { A: 'PHMC-6' }; data.patientsDecedes['PHMC-6'] = { depuis: 1, uid: 'D1' }; });
await write("Avis de décès levé : le personnel écrit de nouveau", true, 'S1', 'savedReports/S_One/x1', newReport(null), staffAlive);
await write("Avis de décès levé : le civil C écrit de nouveau", true, 'C', 'patientRecords/PHMC-1/nouv', { reportPath: 'x' }, (data) => { delete data.patientsDecedes['PHMC-1']; });
await write("Après un décès contesté puis levé, une nouvelle contestation reste possible si le patient est redéclaré décédé", true, 'C', 'contestationsDeces/PHMC-1', { uid: 'C', message: 'Encore une erreur.', creeLe: 3, statut: 'en_attente' }, (data) => { data.contestationsDeces = { 'PHMC-1': { uid: 'C', message: 'x', creeLe: 1, statut: 'acceptee' } }; });
await write('Table idsPatientParCompte : S1 ne se donne pas un ID patient', false, 'S1', 'idsPatientParCompte/S1', 'PHMC-77');
await write('Table idsPatientParCompte : un admin la pose', true, 'A', 'idsPatientParCompte/S1', 'PHMC-77');
await read('Table idsPatientParCompte : S1 lit la sienne', true, 'S1', 'idsPatientParCompte/S1', staffAlive);
await read('Table idsPatientParCompte : S2 ne lit pas celle de S1', false, 'S2', 'idsPatientParCompte/S1', staffAlive);

await env.cleanup();
console.log(failures === 0 ? `\nTOUT EST OK (${total} scénarios)` : `\n${failures} ÉCHEC(S) sur ${total} scénarios`);
process.exit(failures === 0 ? 0 : 1);
