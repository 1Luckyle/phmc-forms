// Champs du formulaire « PHMC Email Interne » (v27).
//
// Ce formulaire réutilisait des clés partagées avec d'autres formulaires
// (decedentName, patientNotes, synopsis…), ce qui faisait passer le nom d'un
// défunt ou des notes patient dans l'email, et inversement. Il a maintenant
// ses propres clés.
export const INTERNAL_EMAIL_LEGACY_KEYS = {
    patientNotes: 'internalEmailSubject',
    decedentName: 'internalEmailRecipient',
    synopsis: 'internalEmailBody',
    scenePhotos: 'internalEmailSignatureImage',
    decedentOOC: 'internalEmailSenderTitle',
    patientCareer: 'internalEmailSenderDepartment',
};

/**
 * Convertit les données d'un ancien rapport v27 (anciennes clés partagées)
 * vers les clés propres, sans jamais écraser une valeur déjà au nouveau
 * format. Les anciennes clés sont retirées : sinon elles écraseraient, au
 * chargement, les valeurs des autres formulaires.
 */
export const migrateInternalEmailData = (data) => {
    const migrated = { ...(data || {}) };
    Object.entries(INTERNAL_EMAIL_LEGACY_KEYS).forEach(([oldKey, newKey]) => {
        if (oldKey in migrated) {
            if (migrated[newKey] === undefined) migrated[newKey] = migrated[oldKey];
            delete migrated[oldKey];
        }
    });
    return migrated;
};
