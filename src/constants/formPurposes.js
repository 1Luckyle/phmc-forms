// src/constants/formPurposes.js
//
// « À quoi sert ce formulaire ? » : le texte du cadre affiché en haut de chaque formulaire (voir components/FormPurpose.js). Un texte par version de
// formulaire (formDefinitions.js) ; en ajouter un quand on crée un formulaire.

export const FORM_PURPOSES = {
    // ── Dossiers médicaux Civils ──
    3: "Dossier médical complet d'un patient : identité, contact d'urgence, historique médical, de santé mentale et familial, situation sociale, mode de vie et directives anticipées. Il est payant (tarif affiché plus bas) et peut être rempli par le patient lui-même ou par un soignant à sa place.",
    25: "Dossier médical de base d'un patient : identité, contact d'urgence et historique médical principal (allergies, médicaments, maladies chroniques, traumatismes). Il est payant (tarif affiché plus bas).",
    24: "Autorisation par laquelle un patient demande que tout ou partie de son dossier médical soit divulgué à un tiers (avocat, assurance, autre médecin…). Elle est signée par le patient, ou par son représentant légal s'il est mineur. Chaque élément divulgué est facturé.",
    26: "Mise à jour d'un dossier médical déjà existant : on choisit les rubriques à modifier (identité, contact d'urgence, historique, mode de vie, directives…) et on fournit les informations complètes de chacune. Service à prix fixe.",

    // ── Médecine légale (DMEC) ──
    1: "Rapport d'enquête sur un décès, rédigé par le médecin légiste après son intervention : agence qui a appelé, défunt, circonstances, cause et mode du décès, photos de la scène et preuves. Il se joint ensuite à un Email DMEC pour l'agence demandeuse.",
    2: "E-mail officiel du Bureau du Coroner à l'agence qui a demandé un rapport. Il joint un ou plusieurs rapports de décès ou de tuerie/accident de masse déjà enregistrés, indique les coordonnées du coroner et le lien de paiement des frais de demande d'autopsie ou de certificat.",
    4: "Rapport d'autopsie : constatations de l'examen du corps (externe, interne, radiologie), cause et mode du décès, résumé anatomique, diagramme des blessures et photographies. Il est signé par l'examinateur médical et le chef médecin légiste.",
    8: "Certificat de décès officiel, délivré par un médecin légiste : il atteste l'identité du défunt, la cause, la date, l'heure et le lieu du décès. Une copie originale est remise aux proches.",
    11: "Rapport unique pour un incident faisant plusieurs victimes (tuerie ou accident de masse) : résumé de l'incident, puis une fiche par défunt (identité, circonstances, cause, photos, preuves).",
    37: "Dossier public de décès, publié par le Département de Pathologie et de Médecine Légale : il résume un décès divulgable (identifié ou non), son statut, la cause et le mode du décès. Il ne reprend pas tous les décès du comté, seulement les cas ayant mobilisé un médecin légiste.",

    // ── Soins et notes du personnel ──
    5: "Compte rendu d'une intervention chirurgicale (diagnostic, procédure, anesthésie, suites). À ajouter au dossier pour chaque chirurgie, à la suite de l'opération.",
    6: "Compte rendu d'un examen physique en médecine interne (constantes, examens, constatations). À ajouter au dossier pour chaque rendez-vous concerné.",
    7: "Compte rendu d'un examen physique à la clinique de Paleto Bay (PBC). À ajouter au dossier pour chaque rendez-vous concerné.",
    14: "Compte rendu d'une consultation de psychiatrie : examen de l'état mental, diagnostic, risques et plan de suivi. À ajouter au dossier pour chaque rendez-vous de psychiatrie.",
    16: "Compte rendu d'une consultation de psychiatrie à la clinique de Paleto Bay (PBC). À ajouter au dossier pour chaque rendez-vous de psychiatrie.",
    19: "Compte rendu d'une prise en charge aux urgences (motif, constantes, examens, diagnostic, orientation). À ajouter au dossier pour chaque passage aux urgences.",
    20: "Compte rendu d'une consultation de médecine générale (motif, constatations, diagnostic, traitement, suivi). À ajouter au dossier pour chaque consultation.",
    21: "Compte rendu d'une consultation de médecine générale à la clinique de Paleto Bay (PBC). À ajouter au dossier pour chaque consultation.",
    22: "Note de service libre sur un patient ou un événement, ajoutée au dossier à la suite d'un rendez-vous ou d'un fait à retenir.",
    23: "Note de service libre à la clinique de Paleto Bay (PBC), ajoutée au dossier à la suite d'un rendez-vous ou d'un fait à retenir.",
    28: "Compte rendu d'une évaluation psychologique (entretien, tests, conclusions, suivi). À ajouter au dossier pour chaque rendez-vous de psychologie.",
    29: "Compte rendu d'une évaluation psychologique à la clinique de Paleto Bay (PBC). À ajouter au dossier pour chaque rendez-vous de psychologie.",
    35: "Certificat de maladie remis à un patient pour justifier une absence (période, raison). Il est envoyé à l'employeur ou au patient.",
    27: "E-mail interne entre membres du personnel du PHMC (objet, destinataire, message), avec votre signature et votre fonction.",
    41: "Certificat d'aptitude médicale au vol, réservé au personnel soignant : il atteste uniquement de l'aptitude (conforme ou non) d'un pilote selon sa classe, sans aucun diagnostic. Il ne remplace pas la licence de vol de la SAAA.",

    // ── Candidatures ──
    50: "Candidature à un poste médical du PHMC : identité, formation, emploi, lettre de motivation et informations hors jeu. Elle est examinée par le recrutement, qui vous recontacte.",
    51: "Candidature à un poste de psychologue ou de psychiatre du PHMC : identité, formation, emploi, lettre de motivation et informations hors jeu.",
    52: "Candidature à un poste administratif du PHMC : identité, formation, emploi, lettre de motivation et informations hors jeu.",
    53: "Candidature à un poste d'infirmier(ère) du PHMC : identité, formation, emploi, lettre de motivation et informations hors jeu.",
    54: "Candidature à un poste du DMEC (médecine légale) : identité, formation, emploi, lettre de motivation et informations hors jeu.",
    55: "Candidature à un poste EMS (paramédic, EMT…) : identité, formation, motivation, licences et preuves, et informations hors jeu.",
};
