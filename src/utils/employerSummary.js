// src/utils/employerSummary.js
//
// Rapport joint à un CERTIFICAT MÉDICAL : ce qui est accepté et ce qui est transmis.
//
// Un certificat est destiné à un tiers (employeur, école, assurance…), à qui on ne doit pas
// délivrer d'informations médicales détaillées. On n'accepte donc que certains rapports, et on ne
// colle JAMAIS le rapport complet : il est remplacé par un résumé simplifié qui ne contient que des
// informations générales (voir KIND_POLICIES pour le détail, rapport par rapport).
//
// Rapports acceptés (reconnus à leur TITRE dans le BBCode collé, et à leur version quand ils sont
// joints depuis « Rapports enregistrés ») :
//   • Protocole d'urgence (ER)                      — versions 19
//   • Consultation Générale (PHMC / PBC)            — versions 20, 21
//   • Consultation psychiatrique (PHMC / PBC)       — versions 14, 16
//   • Évaluation psychologique (PHMC / PBC)         — versions 28, 29
//   • Évaluation physique (PHMC / PBC)              — versions 6, 7
// Tout autre contenu (autre formulaire, texte libre, rapport d'un autre patient) est rejeté.

export const ACCEPTED_REPORT_VERSIONS = [19, 20, 21, 14, 16, 28, 29, 6, 7];

export const ACCEPTED_REPORT_LABELS = [
    "Protocole d'urgence (ER)",
    'Consultation Générale (PHMC ou PBC)',
    'Consultation psychiatrique (PHMC ou PBC)',
    'Évaluation psychologique (PHMC ou PBC)',
    'Évaluation physique (PHMC ou PBC)',
];

// Début du résumé produit : sert à reconnaître un rapport déjà simplifié.
export const EMPLOYER_SUMMARY_MARKER = '[b]Résumé simplifié du rapport médical';

export const EMPLOYER_SUMMARY_NOTICE = "Ce résumé est volontairement simplifié. Par respect du secret médical, seules des informations générales sont transmises : le diagnostic, les antécédents, les traitements, les résultats d'examens et les autres données médicales détaillées du rapport d'origine ne sont pas communiqués.";

// Ce qui est transmis pour chaque type de rapport. `fields` : informations générales gardées.
// Tout le reste (plainte, signes vitaux, constatations, diagnostics, traitements, ordonnances,
// examens, antécédents, état mental, mesures, notes…) est volontairement écarté.
export const KIND_POLICIES = {
    er: {
        label: "Protocole d'urgence",
        employerLabel: "Passage aux urgences",
        fields: ['facility', 'date', 'admission', 'followup'],
    },
    consult: {
        label: 'Consultation générale',
        employerLabel: 'Consultation médicale',
        fields: ['facility', 'date', 'admission', 'followup'],
    },
    // Psychiatrie / psychologie : plus sensibles — ni spécialité, ni hospitalisation, ni suivi.
    psychiatric: {
        label: 'Consultation psychiatrique',
        employerLabel: 'Consultation médicale',
        fields: ['facility', 'date'],
    },
    psychological: {
        label: 'Évaluation psychologique',
        employerLabel: 'Consultation médicale',
        fields: ['facility', 'date'],
    },
    physical: {
        label: 'Évaluation physique',
        employerLabel: 'Examen physique',
        fields: ['facility', 'date'],
    },
};

const FIELD_LABELS = {
    admission: 'Hospitalisation',
    followup: 'Suivi médical',
};

// Texte sans accents ni casse, pour reconnaître les titres même si le BBCode a été retouché.
const normalize = (text) => String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const countIn = (normalizedText, markers) => markers.filter((m) => normalizedText.includes(m)).length;

// Reconnaît le rapport d'après ses TITRES. Il faut le titre principal ET au moins deux rubriques
// propres à ce rapport : un message qui cite simplement « protocole d'urgence » ne passe pas.
export function identifyReport(bbCode) {
    const text = normalize(bbCode);
    if (!text.trim()) return null;

    if (text.includes("protocole d'urgence")
        && countIn(text, ['anamnese', 'signes vitaux', 'constatations', 'diagnostic preliminaire', 'therapie']) >= 2) {
        return 'er';
    }
    if (text.includes('notes de consultation')
        && countIn(text, ['anamnese', 'signes vitaux', 'constatations', 'diagnostic', 'therapie']) >= 2) {
        return 'consult';
    }
    if (text.includes('notes de session')
        && countIn(text, ['anamnese', 'constatations', 'diagnostic de sortie', 'therapie', 'probleme presente', "examen de l'etat mental"]) >= 2) {
        // « Évaluation psychologique » = problème présenté + examen de l'état mental ;
        // « Consultation psychiatrique » = notes de session plus courtes.
        return (text.includes('probleme presente') || text.includes("examen de l'etat mental"))
            ? 'psychological'
            : 'psychiatric';
    }
    if (text.includes('examen physique')
        && countIn(text, ['mesures du patient', 'signes vitaux', "resume de l'evaluation", 'anamnese']) >= 2) {
        return 'physical';
    }
    return null;
}

// Version « Rapports enregistrés » → type de rapport (pour vérifier une pièce jointe sélectionnée).
export const kindForVersion = (version) => ({
    19: 'er', 20: 'consult', 21: 'consult', 14: 'psychiatric', 16: 'psychiatric',
    28: 'psychological', 29: 'psychological', 6: 'physical', 7: 'physical',
}[Number(version)] || null);

const frDate = (value) => {
    const text = String(value || '').trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : text;
};

// Extrait UNIQUEMENT les informations générales gardées (jamais le reste du rapport).
function extractGeneralFacts(bbCode) {
    const facts = {};
    const raw = String(bbCode || '');
    const normalized = normalize(raw);

    if (normalized.includes('clinique de paleto bay')) facts.facility = 'Clinique de Paleto Bay';
    else if (normalized.includes('centre medical pillbox hill')) facts.facility = 'Centre médical Pillbox Hill';

    const date = raw.match(/Date:\s*([^\r\n[]+)/i);
    if (date && date[1].trim() && !/non renseign|^n\/a$/i.test(date[1].trim())) facts.date = frDate(date[1]);

    const admission = raw.match(/\[u\]\s*Admission:\s*\[\/u\][\s\S]{0,200}?\[cbc\]\s*(Oui|Non)/i);
    if (admission) facts.admission = admission[1][0].toUpperCase() + admission[1].slice(1).toLowerCase();

    const followup = raw.match(/\[u\]\s*Suivi:\s*\[\/u\][\s\S]{0,300}?\[cbc\]\s*(Au besoin|Recommand[^\r\n[]*|Proc[^\r\n[]*)/i);
    if (followup) {
        const value = followup[1].trim().toLowerCase();
        facts.followup = value.startsWith('recommand') ? 'Recommandé'
            : value.startsWith('proc') ? 'Procédure élective prévue'
                : 'Au besoin';
    }

    // En-têtes : « PATIENT: Nom » (urgences, consultations) ou « PATIENT Nom (ID: …) » (autres rapports).
    const patient = raw.match(/(?:^|\n)[ \t]*PATIENT:?[ \t]+(.+?)(?:[ \t]+\(ID:|\r|\n|\[)/);
    if (patient && !/^n\/a$/i.test(patient[1].trim())) facts.patientName = patient[1].trim();
    return facts;
}

// Fabrique le BBCode du résumé simplifié à partir des seules informations générales.
export function buildEmployerSummaryBBCode(kind, facts) {
    const policy = KIND_POLICIES[kind];
    const lines = [`[*] Nature de la prise en charge : ${policy.employerLabel}`];
    if (policy.fields.includes('facility') && facts.facility) lines.push(`[*] Établissement : ${facts.facility}`);
    if (policy.fields.includes('date') && facts.date) lines.push(`[*] Date : ${facts.date}`);
    ['admission', 'followup'].forEach((field) => {
        if (policy.fields.includes(field) && facts[field]) lines.push(`[*] ${FIELD_LABELS[field]} : ${facts[field]}`);
    });
    return `${EMPLOYER_SUMMARY_MARKER} (informations générales uniquement)[/b]\n[list]\n${lines.join('\n')}\n[/list]\n[i]${EMPLOYER_SUMMARY_NOTICE}[/i]`;
}

// Noms comparables : tous les mots du plus court se retrouvent dans le plus long.
const namesMatch = (a, b) => {
    const tokens = (name) => normalize(name).split(/[^a-z0-9]+/).filter(Boolean);
    const ta = tokens(a);
    const tb = tokens(b);
    if (ta.length === 0 || tb.length === 0) return true; // rien à comparer
    const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    return short.every((token) => long.includes(token));
};

// Point d'entrée : vérifie qu'un contenu est bien un rapport accepté (d'après ses titres), qu'il
// concerne le bon patient, puis le remplace par son résumé simplifié.
//   → { ok: true, kind, kindLabel, summary } | { ok: false, reason }
export function prepareAttachedReport(bbCode, { patientName = '' } = {}) {
    const kind = identifyReport(bbCode);
    if (!kind) {
        return {
            ok: false,
            reason: `Ce contenu n'est pas un rapport accepté pour un certificat. Rapports acceptés : ${ACCEPTED_REPORT_LABELS.join(', ')}.`,
        };
    }
    const facts = extractGeneralFacts(bbCode);
    if (patientName && facts.patientName && !namesMatch(patientName, facts.patientName)) {
        return {
            ok: false,
            reason: `Ce rapport concerne « ${facts.patientName} », pas « ${patientName} » : il n'a pas été joint.`,
        };
    }
    return { ok: true, kind, kindLabel: KIND_POLICIES[kind].label, summary: buildEmployerSummaryBBCode(kind, facts) };
}

// Filet de sécurité à la GÉNÉRATION du BBCode : ne laisse jamais partir un rapport complet. Un
// résumé déjà simplifié passe tel quel ; un rapport complet (ancien brouillon, localStorage…) est
// simplifié ; tout autre contenu est ignoré.
export function toEmployerSafeSummary(content, options = {}) {
    const text = String(content || '').trim();
    if (!text) return '';
    if (text.startsWith(EMPLOYER_SUMMARY_MARKER)) return text;
    const result = prepareAttachedReport(text, options);
    return result.ok ? result.summary : '';
}
