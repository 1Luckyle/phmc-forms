// src/utils/reportCopyRecipients.js
//
// Soignants MENTIONNÉS dans un rapport qu'ils n'ont pas rédigé : ils reçoivent une notification qui les invite à en récupérer une copie dans « Dossier Patient » (les règles Firebase
// interdisent d'écrire directement dans les rapports d'un collègue : la copie passe par le dossier du patient, d'où l'ID patient demandé).
//   • Opération chirurgicale (5) : le chirurgien principal et le personnel présent ;
//   • Protocole d'urgence (19) : les soignants supplémentaires.
// Le rédacteur du rapport n'est jamais notifié (c'est son rapport).

export const COPY_REPORTS = {
    5: { nom: 'rapport chirurgical', article: 'un' },
    19: { nom: "protocole d'urgence", article: 'un' },
};

const norm = (value) => String(value || '').trim().toLowerCase();

export const hasCopyRecipients = (version) => !!COPY_REPORTS[Number(version)];

/** Destinataires de la copie : [{ name, kind: 'surgeon' | 'present' }], sans doublon, sans le rédacteur. */
export const reportCopyRecipients = (version, formData = {}) => {
    if (!hasCopyRecipients(version)) return [];
    const author = norm(formData.phmcEmployee);
    const surgeon = Number(version) === 5 ? String(formData.surgeonEmployee || '').trim() : '';
    const present = (Array.isArray(formData.extraStaff) ? formData.extraStaff : []).map((name) => String(name || '').trim());
    const seen = new Set();
    return [surgeon ? { name: surgeon, kind: 'surgeon' } : null, ...present.map((name) => ({ name, kind: 'present' }))]
        .filter((entry) => {
            if (!entry || !entry.name) return false;
            const key = norm(entry.name);
            if (key === author || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

/** Contenu de la notification d'un destinataire. */
export const copyNotificationContent = (version, formData, recipient, authorName = '') => {
    const report = COPY_REPORTS[Number(version)];
    const author = formData.phmcEmployee || authorName || 'Un collègue';
    const patient = `${formData.patientName || 'Patient'}${formData.patientID ? ` (${formData.patientID})` : ''}`;
    const titre = recipient.kind === 'surgeon'
        ? `${author} vous adresse un ${report.nom}`
        : `${author} vous a mentionné(e) dans un ${report.nom}`;
    const texte = recipient.kind === 'surgeon'
        ? `${patient} : récupérez-en une copie dans Dossier Patient.`
        : `${patient} : vous y figurez. Copiez le rapport dans votre dossier avec « Récupérer une copie » (Dossier Patient).`;
    return { titre, texte };
};
