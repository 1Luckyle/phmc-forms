// src/utils/coronerAttachments.js
//
// Rapports joints à un EMAIL DMEC : ce qui est accepté et comment c'est vérifié.
//
// Même principe que les certificats médicaux (voir employerSummary.js) : un rapport ne se tape pas à la main. On le colle
// (il est alors vérifié d'après ses titres) ou on le joint depuis « Rapports enregistrés ». Sont acceptés :
//   • le Rapport de décès (formulaire « Services de Médecine Légale », version 1) — « RAPPORT D'ENQUÊTE SUR LE DÉCÈS » ;
//   • le Rapport de catastrophe mortelle (tuerie / accident de masse, version 11) — « RAPPORT DE CATASTROPHE MORTELLE ».
// Tout autre contenu (autre formulaire, texte libre, titre seul cité dans un message) est refusé. Contrairement au certificat,
// le rapport est joint EN ENTIER (l'officier demandeur reçoit le rapport complet) ; les noms du défunt (IC et HRP) sont repris
// du rapport pour remplir l'e-mail.

export const CORONER_REPORT_VERSIONS = [1, 11];

export const CORONER_REPORT_LABELS = [
    'Rapport de décès (enquête sur le décès)',
    'Rapport de catastrophe mortelle (tuerie / accident de masse)',
];

const KIND_LABELS = {
    death: 'Rapport de décès',
    massFatality: 'Rapport de catastrophe mortelle',
};

// Version « Rapports enregistrés » → type de rapport.
export const coronerKindForVersion = (version) => ({ 1: 'death', 11: 'massFatality' }[Number(version)] || null);

const normalize = (text) => String(text || '')
    .replace(/[’‘]/g, "'")
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const SECTION_MARKERS = ['a. rapport ecrit', 'dossier photographique', 'c. declaration', 'confidentialite et vie privee'];
const countIn = (text, markers) => markers.filter((marker) => text.includes(marker)).length;

// Reconnaît le rapport d'après ses TITRES : le titre principal ET au moins deux rubriques propres.
export function identifyCoronerReport(bbCode) {
    const text = normalize(bbCode);
    if (!text.trim()) return null;
    if (text.includes("rapport d'enquete sur le deces") && countIn(text, SECTION_MARKERS) >= 2) return 'death';
    if (text.includes('rapport de catastrophe mortelle') && countIn(text, SECTION_MARKERS) >= 2) return 'massFatality';
    return null;
}

const PLACEHOLDER_NAMES = /^(inconnu|inconnue|non renseign[ée]?|d[ée]funt non identifi[ée]|n\/a|lieu inconnu)$/i;
const usable = (value) => {
    const text = String(value || '').trim();
    return text && !PLACEHOLDER_NAMES.test(text) ? text : '';
};

// Défunts du rapport : [{ name, ooc }] (noms IC et HRP, placeholders écartés).
export function extractDecedents(bbCode, kind) {
    const raw = String(bbCode || '');
    if (kind === 'massFatality') {
        return [...raw.matchAll(/\[altspoiler=\d+\s*-\s*(.+?)\s*-\s*OOC\s+(.+?)\]/g)]
            .map((match) => ({ name: usable(match[1]), ooc: usable(match[2]) }))
            .filter((decedent) => decedent.name || decedent.ooc);
    }
    const name = raw.match(/identifi\S*\s+l'individu\s+comme\s+[^[]*\[b\]\s*([^[]+?)\s*\[\/b\]/i);
    const ooc = raw.match(/Nom OOC du joueur:\s*([^\r\n]+)/i);
    const decedent = { name: usable(name && name[1]), ooc: usable(ooc && ooc[1]) };
    return decedent.name || decedent.ooc ? [decedent] : [];
}

// Point d'entrée : vérifie qu'un contenu est bien un rapport accepté.
//   → { ok: true, kind, kindLabel, bbCode, decedents } | { ok: false, reason }
export function prepareCoronerReport(bbCode) {
    const kind = identifyCoronerReport(bbCode);
    if (!kind) {
        return {
            ok: false,
            reason: `Ce contenu n'est pas un rapport accepté pour un Email DMEC. Rapports acceptés : ${CORONER_REPORT_LABELS.join(', ')}.`,
        };
    }
    return { ok: true, kind, kindLabel: KIND_LABELS[kind], bbCode: String(bbCode).trim(), decedents: extractDecedents(bbCode, kind) };
}

// Ajoute des noms à une liste « Nom 1, Nom 2 » sans doublon (comparaison sans accents ni casse).
export const mergeNameList = (currentList, names) => {
    const list = String(currentList || '').split(',').map((name) => name.trim()).filter(Boolean);
    names.filter(Boolean).forEach((name) => {
        if (!list.some((existing) => normalize(existing) === normalize(name))) list.push(name);
    });
    return list.join(', ');
};

// Le même rapport est-il déjà joint ? (comparaison du contenu, espaces ignorés)
export const sameReport = (a, b) => String(a || '').replace(/\s+/g, '') === String(b || '').replace(/\s+/g, '') && !!String(a || '').trim();
