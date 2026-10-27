// src/utils/exportProgress.js
//
// État partagé de la fenêtre « Export en plusieurs images » (components/ExportProgressModal.js) : un rapport trop long est
// découpé en plusieurs PNG, et la fenêtre montre la génération puis invite à cliquer sur chaque image pour la télécharger
// (un navigateur n'accepte qu'un téléchargement par clic).
//   état = null (fermée) | {
//     title,
//     phase: 'render' | 'ready',
//     total,                       // nombre d'images
//     rendered,                    // images déjà dessinées (phase 'render')
//     parts: [{ name, blob, downloaded }],   // phase 'ready'
//   }
let state = null;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

export const exportProgress = {
    get: () => state,
    set: (next) => { state = typeof next === 'function' ? next(state) : next; emit(); },
    close: () => { state = null; emit(); },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
};
