// scripts/formFieldAudit.cjs
//
// Audit des champs des formulaires : compare les champs RÉELLEMENT présentés par chaque formulaire (analyse du code des composants, sous-composants
// appelés compris) au catalogue de la page d'administration « Champs obligatoires » (src/constants/formFieldCatalog.js).
//
//   node scripts/formFieldAudit.cjs        → affiche les écarts (code 1 s'il y en a)
//
// Sert aussi au test src/constants/formFieldCatalog.audit.test.js : ajouter ou retirer un champ dans un formulaire sans mettre à jour le catalogue
// (et, si le champ est conditionnel, src/utils/fieldApplicability.js) fait échouer ce test. Les « faux positifs » connus (champs de calcul, listes
// internes, noms construits dynamiquement) sont déclarés dans IGNORE_* ci-dessous, avec la raison.
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

const SRC = path.resolve(__dirname, '..', 'src');
const read = (file) => fs.readFileSync(file, 'utf8');

// Champs cités dans le code d'un formulaire mais qui n'en sont PAS des champs de saisie du catalogue (état de calcul, liste interne, paiement…).
const IGNORE_IN_CODE = {
    '*': ['patientName', 'patientNameNew', 'lastName', 'date', 'payNow', 'fleecaPaymentId', 'patientTitleOptions', 'decedentName', 'extraStaff', 'massFatality', 'decedents', 'autopsyDiagramMarkers', 'applicantTitleAndFullName'],   // nom composé des candidatures : pas une saisie
    1: ['evidenceLocker', 'decedentHeight', 'decedentWeight'],   // taille et poids : seulement à l'autopsie (showMeasures)
    6: ['patientChronicDiseases', 'patientCurrentMedicine'], 7: ['patientChronicDiseases', 'patientCurrentMedicine'],   // PatientContextFields showHistory={false}
    2: ['additionalPatientIDs'],   // liste d'ID des autres défunts : facultative par nature (le premier ID est le champ « ID patient »)
    8: ['decedentOOC'],
    11: ['evidenceLocker', 'decedentTitle', 'decedentOOC', 'patientID', 'pronouncedTimeOfDeath', 'typeOfDeath', 'mannerOfDeath', 'probableCauseOfDeath', 'scenePhotos', 'additionalImages'], // lignes de défunts
    19: ['XrayResults', 'ctResults', 'mriResults', 'ultrasoundResults'],    // valeurs stockées derrière « Résultats d'imagerie »
    20: ['injuryDetails', 'injuryMutilations', 'injuryNote', 'careDeceased'], 21: ['injuryDetails', 'injuryMutilations', 'injuryNote', 'careDeceased'],
    24: ['releaseReports', 'releasePractitionerAuto', 'phmcEmployee'],   // praticien déduit des rapports retenus, pas un champ de saisie
    35: ['appointmentTime'], 41: ['appointmentTime'],
    // Candidatures : un seul composant partagé (phmc-civilian-fields/shared/ApplicationFields.js) qui cite aussi les champs propres au paramédical et à l'expérience médicale.
    50: ['emsPartTimeReason', 'oocOtherCharLicenseProof', 'dfpSanFireLink', 'dfpPhmcLink', 'dfpLegalFactionLink'], 51: ['emsPartTimeReason', 'oocOtherCharLicenseProof', 'dfpSanFireLink', 'dfpPhmcLink', 'dfpLegalFactionLink'], 52: ['emsPartTimeReason', 'oocOtherCharLicenseProof', 'dfpSanFireLink', 'dfpPhmcLink', 'dfpLegalFactionLink', 'oocMedicalExperience'], 53: ['emsPartTimeReason', 'oocOtherCharLicenseProof', 'dfpSanFireLink', 'dfpPhmcLink', 'dfpLegalFactionLink'], 54: ['emsPartTimeReason', 'oocOtherCharLicenseProof', 'dfpSanFireLink', 'dfpPhmcLink', 'dfpLegalFactionLink'],
};
// Champs du catalogue absents du code sous leur nom littéral : noms construits dynamiquement (ville du code postal, examens du certificat de vol, rapports joints).
const IGNORE_IN_CATALOG = {
    '*': ['placeOfDeathZipCity', 'patientZIPCity', 'patientZIPNewCity', 'applicantZIPCity'],
    2: ['deathReport'],
    11: ['decedentPatientIDs'],   // ligne de synthèse du panneau admin : les ID sont saisis dans chaque défunt (champ « patientID » des lignes)
    // Candidatures : listes (emplois, captures de licences) écrites par clé d'objet dans le composant partagé.
    50: ['applicantJobs'], 51: ['applicantJobs'], 52: ['applicantJobs'], 53: ['applicantJobs'], 54: ['applicantJobs'], 55: ['applicantJobs'],
};
const DYNAMIC_PREFIXES = ['flightCert_'];

const resolveFile = (from, spec) => {
    const base = path.resolve(path.dirname(from), spec);
    for (const candidate of [`${base}.js`, path.join(base, 'index.js')]) if (fs.existsSync(candidate)) return candidate;
    return null;
};

const parseCatalog = () => {
    const source = read(path.join(SRC, 'constants', 'formFieldCatalog.js'));
    const catalog = {};
    for (const match of source.matchAll(/^\s{4}(\d+):\s*\{([\s\S]*?)\n\s{4}\},?/gm)) {
        catalog[match[1]] = [...match[2].matchAll(/(\w+):\s*'(\w[\w-]*)'/g)].map((entry) => entry[1]);
    }
    return catalog;
};

const buildUniverse = (catalog) => {
    const universe = new Set();
    for (const match of read(path.join(SRC, 'App.js')).matchAll(/^\s{4}([A-Za-z_]\w*):/gm)) universe.add(match[1]);
    Object.values(catalog).forEach((keys) => keys.forEach((key) => universe.add(key)));
    for (const match of read(path.join(SRC, 'constants', 'fieldInfo.js')).matchAll(/^\s+([A-Za-z_]\w*):\s*\[/gm)) universe.add(match[1]);
    return universe;
};

const formComponents = () => {
    const defs = read(path.join(SRC, 'formDefinitions.js'));
    const lazyImports = {};
    for (const match of defs.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\('(\.\/phmc-(?:field-data|civilian-fields)\/[^']+)'\)\)/g)) lazyImports[match[1]] = match[2];
    const versions = {};
    for (const block of defs.matchAll(/version:\s*(\d+)([\s\S]*?)(?=version:\s*\d+|\]\s*;)/g)) {
        const component = /FieldComponent:\s*(\w+)/.exec(block[2]);
        if (component && lazyImports[component[1]]) versions[Number(block[1])] = resolveFile(path.join(SRC, 'formDefinitions.js'), lazyImports[component[1]]);
    }
    return versions;
};

const analyse = (cache, file) => {
    if (cache[file]) return cache[file];
    const ast = parse(read(file), { sourceType: 'module', plugins: ['jsx'] });
    const info = { imports: {}, decls: {}, consts: {}, defaultName: null };
    const declare = (decl) => {
        if (decl.type === 'FunctionDeclaration' && decl.id) info.decls[decl.id.name] = decl;
        if (decl.type === 'ClassDeclaration' && decl.id) info.decls[decl.id.name] = decl;
        if (decl.type === 'VariableDeclaration') {
            decl.declarations.forEach((entry) => {
                if (entry.id.type !== 'Identifier' || !entry.init) return;
                info.decls[entry.id.name] = entry.init;
                if (['ObjectExpression', 'ArrayExpression'].includes(entry.init.type)) info.consts[entry.id.name] = entry.init;
            });
        }
    };
    ast.program.body.forEach((node) => {
        if (node.type === 'ImportDeclaration') {
            node.specifiers.forEach((spec) => { info.imports[spec.local.name] = { source: node.source.value, imported: spec.type === 'ImportDefaultSpecifier' ? 'default' : spec.imported && spec.imported.name }; });
        } else if (node.type === 'ExportNamedDeclaration' && node.declaration) declare(node.declaration);
        else if (node.type === 'ExportDefaultDeclaration') {
            if (node.declaration.type === 'Identifier') info.defaultName = node.declaration.name;
            else { info.decls.__default = node.declaration; info.defaultName = '__default'; }
        } else declare(node);
    });
    cache[file] = info;
    return info;
};

const collect = (cache, universe, file, name, found, visited) => {
    const key = `${file}::${name}`;
    if (visited.has(key)) return;
    visited.add(key);
    const info = analyse(cache, file);
    const target = name === 'default' ? info.decls[info.defaultName] : info.decls[name];
    if (!target) return;
    const usedConsts = new Set();
    const walk = (node) => {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'StringLiteral' && universe.has(node.value)) found.add(node.value);
        if (node.type === 'TemplateLiteral' && node.quasis.length === 1 && universe.has(node.quasis[0].value.cooked)) found.add(node.quasis[0].value.cooked);
        if (node.type === 'MemberExpression' && !node.computed && node.property.name && universe.has(node.property.name)) found.add(node.property.name);
        if (node.type === 'ObjectProperty' && node.shorthand && node.key.type === 'Identifier' && universe.has(node.key.name)) found.add(node.key.name);
        if (node.type === 'Identifier' && info.consts[node.name]) usedConsts.add(node.name);
        if (node.type === 'JSXIdentifier') {
            const imported = info.imports[node.name];
            if (imported && imported.source.startsWith('.')) {
                const resolved = resolveFile(file, imported.source);
                if (resolved && /phmc-(field-data|civilian-fields)/.test(resolved.replace(/\\/g, '/'))) collect(cache, universe, resolved, imported.imported, found, visited);
            } else if (!imported && info.decls[node.name]) collect(cache, universe, file, node.name, found, visited);
        }
        Object.keys(node).forEach((property) => {
            if (property === 'loc' || property === 'start' || property === 'end') return;
            const value = node[property];
            if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value.type === 'string') walk(value);
        });
    };
    walk(target);
    usedConsts.forEach((constName) => {
        const constKey = `${file}::const::${constName}`;
        if (!visited.has(constKey)) { visited.add(constKey); walk(info.consts[constName]); }
    });
};

// → { [version]: { component, notInCode: [champs du catalogue absents du code], notInCatalog: [champs du code absents du catalogue] } } (faux positifs connus exclus)
const auditFormFields = () => {
    const catalog = parseCatalog();
    const universe = buildUniverse(catalog);
    const cache = {};
    const result = {};
    Object.entries(formComponents()).forEach(([version, file]) => {
        if (!catalog[version] || !file) return;
        const found = new Set();
        collect(cache, universe, file, 'default', found, new Set());
        const inCatalog = new Set(catalog[version]);
        const ignoreCode = new Set([...(IGNORE_IN_CODE['*'] || []), ...(IGNORE_IN_CODE[version] || [])]);
        const ignoreCatalog = new Set([...(IGNORE_IN_CATALOG['*'] || []), ...(IGNORE_IN_CATALOG[version] || [])]);
        result[version] = {
            file: path.relative(SRC, file),
            notInCode: catalog[version].filter((field) => !found.has(field) && !ignoreCatalog.has(field) && !DYNAMIC_PREFIXES.some((prefix) => field.startsWith(prefix))),
            notInCatalog: [...found].filter((field) => !inCatalog.has(field) && !ignoreCode.has(field)),
        };
    });
    return result;
};

module.exports = { auditFormFields };

if (require.main === module) {
    const audit = auditFormFields();
    let problems = 0;
    Object.entries(audit).forEach(([version, entry]) => {
        if (!entry.notInCode.length && !entry.notInCatalog.length) return;
        problems += entry.notInCode.length + entry.notInCatalog.length;
        console.log(`\nFormulaire ${version} (${entry.file})`);
        if (entry.notInCode.length) console.log(`  au catalogue mais plus dans le formulaire (à retirer de formFieldCatalog.js) : ${entry.notInCode.join(', ')}`);
        if (entry.notInCatalog.length) console.log(`  dans le formulaire mais pas au catalogue (à ajouter à formFieldCatalog.js + fieldInfo.js) : ${entry.notInCatalog.join(', ')}`);
    });
    console.log(problems ? `\n${problems} écart(s).` : 'Catalogue des champs à jour : aucun écart.');
    process.exit(problems ? 1 : 0);
}
