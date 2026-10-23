// src/utils/bbcodeLineBreaks.js
//
// Le forum interprète un retour à la ligne dans le BBCode comme un saut de ligne ET [br][/br] comme
// un autre saut de ligne. Les générateurs écrivent souvent les deux côte à côte :
//     [u]Allergies: [/u][br][/br]
//     Pénicilline
// ce qui produisait DEUX sauts (une ligne vide) là où un seul était voulu.
//
// Règle : dans une suite de sauts de ligne mélangeant « \n » et « [br][/br] », deux sauts voisins de
// nature différente (\n puis [br], ou [br] puis \n) comptent pour UN seul. Deux sauts de même nature
// (\n\n, [br][br]) sont conservés : ce sont des lignes vides voulues.
//     "A[br][/br]\nB"          → un saut        (avant : deux)
//     "A\n[br][/br]\nB"        → deux sauts     (une ligne vide ; avant : trois)
//     "A\n\nB" / "A[br][/br][br][/br]B" → inchangés
// La fonction est idempotente : la relancer sur son résultat ne change rien.
const BREAK_TOKEN = /\[br\](?:\[\/br\])?|\n/gi;
const BREAK_RUN = /(?:(?:\[br\](?:\[\/br\])?|\n)[ \t]*)+/gi;

const isNewline = (token) => token === '\n';

export const normalizeBBCodeLineBreaks = (bbcode) => {
    if (typeof bbcode !== 'string' || !bbcode) return bbcode;
    return bbcode.replace(BREAK_RUN, (run) => {
        const tokens = run.match(BREAK_TOKEN) || [];
        if (tokens.length < 2) return run;
        const hasNewline = tokens.some(isNewline);
        const hasBr = tokens.some((token) => !isNewline(token));
        if (!hasNewline || !hasBr) return run;   // suite homogène : rien à fusionner

        // Nombre de sauts réels après fusion des couples (retour ligne puis [br]) ou ([br] puis retour ligne)...
        let count = 0;
        for (let i = 0; i < tokens.length; i += 1) {
            if (tokens[i + 1] !== undefined && isNewline(tokens[i]) !== isNewline(tokens[i + 1])) i += 1;
            count += 1;
        }
        // ...réécrits sous forme homogène ([br][/br] seulement) : le résultat n'est plus « mixte »,
        // donc la fonction est idempotente. Les espaces avant le texte suivant sont conservés.
        const trailing = (run.match(/[ \t]*$/) || [''])[0];
        const out = '[br][/br]'.repeat(count);
        return out + trailing;
    });
};

export default normalizeBBCodeLineBreaks;
