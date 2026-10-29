// src/utils/mailTemplatesCore.js
//
// COPIE À L'IDENTIQUE dans functions/mailTemplatesCore.js (les Cloud Functions ne peuvent pas importer depuis src/) : modifiez les deux, ou lancez
// `npm run sync:mail` (scripts/sync-mail-templates.mjs). Module sans dépendance : moteur de rendu + catalogue de TOUS les mails que le système envoie.
//
// Un modèle = sujet + corps en mini-balisage, modifiables par les admins (adminSettings/mailTemplates/{id}, voir utils/mailTemplates.js) ; sans
// modification enregistrée, le texte par défaut ci-dessous s'applique.
//
// Mini-balisage du corps :
//   • une ligne vide sépare deux paragraphes ; un simple retour à la ligne reste un retour à la ligne ;
//   • **gras** ; [texte](https://adresse) pour un lien ; une ligne « # texte » est mise en avant (ex. un code) ;
//   • des lignes commençant par « - » forment une liste ; {{liste}} seule sur sa ligne affiche une liste fournie par le système ;
//   • {{variable}} est remplacée à l'envoi (voir la liste de chaque modèle) ; {{?variable}}…{{/variable}} n'apparaît que si la variable est renseignée.
// {{signature}} est la formule de politesse commune (modèle « signature »).

export const DEFAULT_SIGNATURE = 'Cordialement,\nPillbox Hill Medical Center';
export const SUBJECT_MAX = 150;
export const BODY_MAX = 4000;

export const MAIL_CATEGORIES = {
    comptes: { label: 'Comptes & personnel', icon: 'fa-user-gear' },
    recrutement: { label: 'Recrutement', icon: 'fa-user-plus' },
    contrats: { label: 'Contrats', icon: 'fa-file-signature' },
    rapports: { label: 'Rapports & facturation', icon: 'fa-file-invoice-dollar' },
    securite: { label: 'Sécurité du compte', icon: 'fa-shield-halved' },
    general: { label: 'Général', icon: 'fa-envelope' },
};

const SIG = '{{signature}}';
const v = (key, label, exemple, extra = {}) => ({ key, label, exemple, ...extra });

// Champ commun : le nom de la personne.
const NOM = v('nom', 'Nom du destinataire', 'Jean Testard');

export const MAIL_TEMPLATES = {
    // ───────────── Comptes & personnel ─────────────
    compte_approuve: {
        category: 'comptes', label: 'Compte approuvé',
        quand: "Quand un admin approuve une demande de compte du personnel (Panneau admin → Demandes de compte).",
        destinataire: 'La personne qui a demandé le compte', canal: 'Application (action d\'un admin)',
        vars: [NOM, v('badge', 'Badge attribué', 'MD-1234')], required: [],
        subject: 'Votre compte PHMC a été approuvé',
        body: `Bonjour {{nom}},\n\nVotre demande de compte auprès du **Pillbox Hill Medical Center** a été approuvée. Votre badge est **{{badge}}**.\n\nVous pouvez dès à présent vous connecter sur l'outil PHMC-FR.\n\n${SIG}`,
    },
    compte_refuse: {
        category: 'comptes', label: 'Demande de compte refusée',
        quand: 'Quand un admin refuse une demande de compte du personnel.',
        destinataire: 'La personne qui a demandé le compte', canal: 'Application (action d\'un admin)',
        vars: [NOM], required: [],
        subject: 'Votre demande de compte PHMC',
        body: `Bonjour {{nom}},\n\nVotre demande de compte auprès du **Pillbox Hill Medical Center** n'a pas été retenue. Pour plus d'informations, contactez la direction du PHMC.\n\n${SIG}`,
    },
    grade_modifie: {
        category: 'comptes', label: 'Changement de grade',
        quand: 'Quand le rôle d\'un membre du personnel change (fiche modifiée par un admin, ou demande de modification approuvée).',
        destinataire: 'Le membre du personnel concerné', canal: 'Application (action d\'un admin)',
        vars: [NOM, v('grade', 'Nouveau grade', 'Médecin Titulaire')], required: ['grade'],
        subject: 'Changement de grade - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nVotre grade au sein du **Pillbox Hill Medical Center** a été mis à jour : **{{grade}}**.\n\n${SIG}`,
    },
    compte_converti_personnel: {
        category: 'comptes', label: 'Compte Civil converti en compte du personnel',
        quand: 'Quand un admin convertit un compte Civil en compte du personnel (Utilisateurs → Civils → Convertir), notamment après un contrat signé.',
        destinataire: 'La personne dont le compte est converti', canal: 'Application (action d\'un admin)',
        vars: [NOM, v('grade', 'Grade attribué', 'Infirmier(ère)'), v('badge', 'Badge', 'RN-4521')], required: [],
        subject: 'Votre compte est désormais un compte du personnel - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nVotre compte a été converti en **compte du personnel** ({{grade}}, badge **{{badge}}**). Reconnectez-vous pour accéder à vos nouveaux outils. Vos dossiers de patient sont conservés.\n\n${SIG}`,
    },
    fin_fonctions_compte_supprime: {
        category: 'comptes', label: 'Fin de fonctions — compte supprimé',
        quand: 'Quand un admin supprime un membre du personnel avec son compte (Utilisateurs → Personnel → Supprimer).',
        destinataire: 'Le membre du personnel retiré', canal: 'Application (action d\'un admin)',
        vars: [NOM], required: [],
        subject: 'Fin de vos fonctions - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nVotre compte et vos fonctions au sein du **Pillbox Hill Medical Center** ont été résiliés. Vos informations personnelles sont supprimées ; vos rapports et dossiers restent archivés et vous les retrouverez si vous recréez un compte.\n\n${SIG}`,
    },
    fin_fonctions_compte_civil: {
        category: 'comptes', label: 'Fin de fonctions — retour en compte Civil',
        quand: 'Quand un admin remet un membre du personnel en compte Civil (Utilisateurs → Personnel → Repasser en Civil).',
        destinataire: 'Le membre du personnel concerné', canal: 'Application (action d\'un admin)',
        vars: [NOM], required: [],
        subject: 'Fin de vos fonctions - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nVos fonctions au sein du **Pillbox Hill Medical Center** ont pris fin. Votre compte est conservé en tant que **compte Civil** : vous gardez accès à vos dossiers de patient et à vos candidatures.\n\n${SIG}`,
    },
    compte_civil_supprime: {
        category: 'comptes', label: 'Compte Civil supprimé',
        quand: 'Quand un admin supprime un compte Civil (Utilisateurs → Civils → Supprimer).',
        destinataire: 'Le titulaire du compte Civil', canal: 'Application (action d\'un admin)',
        vars: [NOM], required: [],
        subject: 'Votre compte Civil a été supprimé - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nVotre compte Civil sur l'outil PHMC-FR a été supprimé par un administrateur. Vos informations personnelles sont supprimées ; vos dossiers restent archivés et vous les retrouverez si vous recréez un compte.\n\n${SIG}`,
    },

    // ───────────── Recrutement ─────────────
    candidature_recue: {
        category: 'recrutement', label: 'Candidature reçue (accusé de réception)',
        quand: 'Dès qu\'un candidat ENVOIE sa candidature (pas pour un simple brouillon).',
        destinataire: 'Le candidat', canal: 'Application (action du candidat)',
        vars: [NOM, v('poste', 'Poste visé', 'Médecin Titulaire')], required: [],
        subject: 'Candidature reçue - PHMC',
        body: `Bonjour {{nom}},\n\nNous avons bien reçu votre candidature pour le poste « **{{poste}}** ». Notre équipe l'examinera prochainement et vous recontactera pour la suite du processus.\n\nCordialement,\nLe Pillbox Hill Medical Center`,
    },
    candidature_en_examen: {
        category: 'recrutement', label: 'Candidature prise en charge',
        quand: 'Quand un recruteur prend la candidature en charge (statut « en cours d\'examen » : les échanges s\'ouvrent).',
        destinataire: 'Le candidat', canal: 'Application (action d\'un recruteur)',
        vars: [NOM, v('poste', 'Poste visé', 'Médecin Titulaire'), v('recruteur', 'Recruteur qui examine', 'Rose Callahan')], required: [],
        subject: 'Votre candidature est en cours d\'examen - PHMC',
        body: `Bonjour {{nom}},\n\nVotre candidature pour le poste « **{{poste}}** » est **en cours d'examen** par {{recruteur}}. Vous pouvez échanger avec le recrutement depuis l'outil PHMC-FR : **Boîte à outils → « Mon dossier candidat »**.\n\n${SIG}`,
    },
    entretien_programme: {
        category: 'recrutement', label: 'Entretien programmé',
        quand: 'Quand un recruteur programme un entretien pour une candidature.',
        destinataire: 'Le candidat', canal: 'Application (action d\'un recruteur)',
        vars: [NOM, v('poste', 'Poste visé', 'Médecin Titulaire'), v('date_entretien', 'Date et heure de l\'entretien', '12/11/2026 20:30:00'),
            v('organisation', 'Qui mène l\'entretien (phrase)', 'Il sera mené par Rose Callahan, en présence de Selena Sprecher.')], required: [],
        subject: 'Entretien de candidature - PHMC',
        body: `Bonjour {{nom}},\n\nVotre entretien pour le poste « **{{poste}}** » au Pillbox Hill Medical Center est programmé le **{{date_entretien}}**. {{organisation}}\n\nMerci de vous présenter à l'étage de l'administration du Pillbox Hill Medical Center, situé au 76 Strawberry Ave, Los Santos.\n\nEn cas d'empêchement, répondez au recrutement depuis **« Mon dossier candidat »** ou contactez l'administration du PHMC au plus vite.\n\n${SIG}`,
    },
    entretien_modifie: {
        category: 'recrutement', label: 'Entretien modifié',
        quand: 'Quand un recruteur modifie la date, le recruteur ou les présents d\'un entretien déjà programmé.',
        destinataire: 'Le candidat', canal: 'Application (action d\'un recruteur)',
        vars: [NOM, v('poste', 'Poste visé', 'Médecin Titulaire'), v('date_entretien', 'Nouvelle date et heure', '14/11/2026 21:00:00'),
            v('organisation', 'Qui mène l\'entretien (phrase)', 'Il sera mené par Rose Callahan.'),
            v('changements', 'Liste des changements', ['Date : 12/11/2026 20:30 → 14/11/2026 21:00'], { liste: true })], required: [],
        subject: 'Entretien de candidature modifié - PHMC',
        body: `Bonjour {{nom}},\n\nVotre entretien pour le poste « **{{poste}}** » au Pillbox Hill Medical Center a été **modifié**. Il est désormais programmé le **{{date_entretien}}**. {{organisation}}\n\n**Changements :**\n\n{{changements}}\n\nMerci de vous présenter à l'étage de l'administration du Pillbox Hill Medical Center, situé au 76 Strawberry Ave, Los Santos.\n\nEn cas d'empêchement, répondez au recrutement depuis **« Mon dossier candidat »** ou contactez l'administration du PHMC au plus vite.\n\n${SIG}`,
    },
    entretien_annule: {
        category: 'recrutement', label: 'Entretien annulé',
        quand: 'Quand un recruteur annule un entretien (la candidature repasse « en cours d\'examen »).',
        destinataire: 'Le candidat', canal: 'Application (action d\'un recruteur)',
        vars: [NOM, v('poste', 'Poste visé', 'Médecin Titulaire'), v('motif', 'Motif (facultatif)', 'Indisponibilité du recruteur')], required: [],
        subject: 'Entretien de candidature annulé - PHMC',
        body: `Bonjour {{nom}},\n\nVotre entretien pour le poste « **{{poste}}** » au Pillbox Hill Medical Center est **annulé**.{{?motif}} Motif : {{motif}}{{/motif}}\n\nVotre candidature reste **en cours d'examen** : le recrutement vous proposera une nouvelle date. Vous pouvez lui écrire depuis **« Mon dossier candidat »**.\n\n${SIG}`,
    },
    candidature_acceptee: {
        category: 'recrutement', label: 'Candidature acceptée',
        quand: 'Quand un recruteur accepte la candidature.',
        destinataire: 'Le candidat', canal: 'Application (action d\'un recruteur)',
        vars: [NOM, v('poste', 'Poste visé', 'Médecin Titulaire')], required: [],
        subject: 'Votre candidature a été acceptée - PHMC',
        body: `Bonjour {{nom}},\n\nFélicitations ! Votre candidature pour le poste « **{{poste}}** » au Pillbox Hill Medical Center a été **acceptée**.\n\nVous serez contacté(e) prochainement par l'administration pour la suite des formalités. Vous pouvez continuer à échanger avec le recrutement depuis **« Mon dossier candidat »** jusqu'à la signature de votre contrat.\n\n${SIG}`,
    },
    candidature_refusee: {
        category: 'recrutement', label: 'Candidature refusée',
        quand: 'Quand un recruteur refuse la candidature (le motif est toujours transmis).',
        destinataire: 'Le candidat', canal: 'Application (action d\'un recruteur)',
        vars: [NOM, v('poste', 'Poste visé', 'Médecin Titulaire'), v('motif', 'Motif du refus', 'Profil ne correspondant pas au poste'), v('detail', 'Précision du recruteur (facultatif)', 'Vous pouvez repostuler dans trois mois.')], required: ['motif'],
        subject: 'Votre candidature - PHMC',
        body: `Bonjour {{nom}},\n\nNous vous remercions pour votre candidature au poste « **{{poste}}** » au Pillbox Hill Medical Center. Après examen, celle-ci n'a malheureusement pas été retenue.\n\n**Motif :** {{motif}}{{?detail}}\n{{detail}}{{/detail}}\n\nVous pouvez candidater à nouveau ultérieurement.\n\n${SIG}`,
    },
    contrat_en_preparation: {
        category: 'recrutement', label: 'Contrat en préparation (candidat accepté)',
        quand: 'Quand un recruteur passe un candidat accepté en « attente de contrat » (bouton dans l\'onglet Candidatures).',
        destinataire: 'Le candidat accepté', canal: 'Application (action d\'un recruteur)',
        vars: [NOM], required: [],
        subject: 'Votre contrat vous attend - PHMC',
        body: `Bonjour {{nom}},\n\nVotre contrat au Pillbox Hill Medical Center est en préparation. Connectez-vous à l'outil PHMC-FR : dans la **Boîte à outils**, **« Mes documents administratifs »** vous permettra de le lire et de le signer. Vous pourrez y créer votre signature si vous n'en avez pas encore.\n\n${SIG}`,
    },
    candidature_message: {
        category: 'recrutement', label: 'Nouveau message sur une candidature',
        quand: 'Quand le recrutement écrit au candidat dans l\'échange de sa candidature (au plus un mail toutes les 30 minutes par candidature).',
        destinataire: 'Le candidat', canal: 'Application (message d\'un recruteur)',
        vars: [NOM, v('poste', 'Poste visé', 'Médecin Titulaire')], required: [],
        subject: 'Nouveau message sur votre candidature - PHMC',
        body: `Bonjour {{nom}},\n\nLe recrutement vous a écrit à propos de votre candidature pour le poste « **{{poste}}** ». Connectez-vous à l'outil PHMC-FR : **Boîte à outils → « Mon dossier candidat »** pour lire le message et y répondre.\n\n${SIG}`,
    },
    recrutement_interne_accorde: {
        category: 'recrutement', label: 'Recrutement interne accordé',
        quand: 'Quand le recrutement accepte la demande de recrutement interne d\'un employé (il peut de nouveau candidater).',
        destinataire: 'L\'employé', canal: 'Application (action d\'un recruteur)',
        vars: [NOM], required: [],
        subject: 'Statut de recrutement interne accordé - PHMC',
        body: `Bonjour {{nom}},\n\nVotre demande de recrutement interne est acceptée : vous pouvez de nouveau candidater aux offres depuis les formulaires de candidature.\n\n${SIG}`,
    },
    recrutement_interne_refuse: {
        category: 'recrutement', label: 'Recrutement interne refusé',
        quand: 'Quand le recrutement refuse la demande de recrutement interne d\'un employé.',
        destinataire: 'L\'employé', canal: 'Application (action d\'un recruteur)',
        vars: [NOM, v('motif', 'Motif (facultatif)', 'Poste non ouvert aux mobilités')], required: [],
        subject: 'Votre demande de recrutement interne - PHMC',
        body: `Bonjour {{nom}},\n\nVotre demande de recrutement interne n'a pas été retenue.{{?motif}}\nMotif : {{motif}}{{/motif}}\n\n${SIG}`,
    },

    // ───────────── Contrats ─────────────
    document_a_signer: {
        category: 'contrats', label: 'Document à signer (contrat, avenant…)',
        quand: 'Quand un contrat, une convention ou un avenant est ENVOYÉ à l\'employé (à lire puis signer dans « Mes documents administratifs »).',
        destinataire: 'L\'employé ou le candidat accepté', canal: 'Application (envoi du document)',
        vars: [NOM, v('type_document', 'Type de document', 'CDI'), v('reference', 'Référence', 'PHMC-CT-2026-0042')], required: [],
        subject: 'Un document vous attend - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nUn document ({{type_document}}, réf. {{reference}}) a été préparé à votre attention. Connectez-vous à l'outil PHMC-FR, ouvrez la **Boîte à outils** puis **« Mes documents administratifs »** pour le lire et le signer.\n\n${SIG}`,
    },
    document_notifie: {
        category: 'contrats', label: 'Document notifié (convocation, sanction, fin de contrat)',
        quand: 'Quand une convocation, une notification de sanction ou de fin de contrat est ENVOYÉE (la signature vaut accusé de réception).',
        destinataire: 'L\'employé concerné', canal: 'Application (envoi du document)',
        vars: [NOM, v('type_document', 'Type de document', 'Convocation à un entretien préalable'), v('reference', 'Référence', 'PHMC-CV-2026-0007')], required: [],
        subject: 'Un document vous a été notifié - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nUn document ({{type_document}}, réf. {{reference}}) vous a été notifié. Connectez-vous à l'outil PHMC-FR, ouvrez la **Boîte à outils** puis **« Mes documents administratifs »** pour en prendre connaissance et accuser réception.\n\n${SIG}`,
    },

    // ───────────── Rapports & facturation ─────────────
    rapport_enregistre_admin: {
        category: 'rapports', label: 'Rapport enregistré par un administrateur',
        quand: 'Quand un admin enregistre un rapport sur le compte d\'un membre du personnel (« Enregistrer pour… »).',
        destinataire: 'Le membre du personnel sur le compte duquel il est enregistré', canal: 'Application (action d\'un admin)',
        vars: [NOM, v('formulaire', 'Nom du formulaire', 'Rapport d\'intervention')], required: [],
        subject: 'Rapport enregistré sur votre compte - PHMC',
        body: `Bonjour {{nom}},\n\nUn administrateur a enregistré « {{formulaire}} » sur votre compte PHMC. Vous pouvez le consulter dans « Rapports enregistrés ».\n\n${SIG}`,
    },
    recu_paiement: {
        category: 'rapports', label: 'Reçu de paiement',
        quand: 'Automatiquement, dès que Fleeca confirme un paiement réussi (webhook). L\'adresse est déduite du nom du payeur.',
        destinataire: 'Le payeur', canal: 'Serveur (automatique)',
        vars: [NOM, v('montant', 'Montant payé', '1 500$'), v('description', 'Objet du paiement', 'services PHMC'), v('reference', 'Référence du paiement', 'pay_8f2a91')], required: [],
        subject: 'Reçu de paiement - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nNous confirmons la réception de votre paiement de **{{montant}}** ({{description}}) via Fleeca.\n\nRéférence du paiement : {{reference}}\n\n${SIG}`,
    },
    facture_a_payer: {
        category: 'rapports', label: 'Factures à payer',
        quand: 'Automatiquement, environ 5 minutes après la dernière facture créée pour un patient (les factures sont regroupées en un seul mail). Vérification toutes les 5 minutes.',
        destinataire: 'Le patient facturé', canal: 'Serveur (tâche planifiée « toutes les 5 minutes »)',
        vars: [NOM, v('nombre', 'Nombre de factures', '2'), v('factures', 'Liste des factures', ['Rapport médical : 750 $', 'Certificat : 750 $'], { liste: true }), v('total', 'Total à payer', '1 500 $'), v('site', 'Adresse de l\'outil', 'https://1luckyle.github.io/phmc-forms/')], required: [],
        subject: '{{nombre}} paiement(s) à effectuer - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nDes rapports médicaux ont été établis à votre nom et sont à régler.\n\n{{factures}}\n\nTotal à payer : **{{total}}**\n\nConnectez-vous à [l'outil PHMC-FR]({{site}}) : une fenêtre vous propose de payer chaque rapport ou tout d'un coup via Fleeca. Vous retrouvez aussi vos factures dans votre dossier patient.\n\n${SIG}`,
    },
    facture_rappel: {
        category: 'rapports', label: 'Rappel de factures impayées',
        quand: 'Automatiquement, chaque jour à 18 h (heure de Paris), pour les factures déjà notifiées et toujours impayées (au plus un rappel toutes les ~20 h par patient).',
        destinataire: 'Le patient facturé', canal: 'Serveur (tâche planifiée « chaque jour à 18 h »)',
        vars: [NOM, v('nombre', 'Nombre de factures', '2'), v('factures', 'Liste des factures', ['Rapport médical : 750 $', 'Certificat : 750 $'], { liste: true }), v('total', 'Total à payer', '1 500 $'), v('site', 'Adresse de l\'outil', 'https://1luckyle.github.io/phmc-forms/')], required: [],
        subject: 'Rappel : {{nombre}} paiement(s) en attente - Pillbox Hill Medical Center',
        body: `Bonjour {{nom}},\n\nUn petit rappel : les rapports médicaux suivants établis à votre nom sont toujours à régler.\n\n{{factures}}\n\nTotal à payer : **{{total}}**\n\nConnectez-vous à [l'outil PHMC-FR]({{site}}) : une fenêtre vous propose de payer chaque rapport ou tout d'un coup via Fleeca. Vous retrouvez aussi vos factures dans votre dossier patient.\n\n${SIG}`,
    },

    // ───────────── Sécurité du compte ─────────────
    verification_creation_compte: {
        category: 'securite', label: 'Code de vérification — création de compte',
        quand: 'Quand une personne demande son code à l\'étape « adresse e-mail » de la création d\'un compte Civil.',
        destinataire: 'L\'adresse saisie par la personne', canal: 'Serveur (demande de la personne)',
        vars: [v('code', 'Code à 6 chiffres', '482913')], required: ['code'],
        note: 'La durée de validité (15 minutes) est fixée par le serveur : si vous la mentionnez, elle doit rester exacte.',
        subject: 'Code de vérification - PHMC',
        body: `Votre code de vérification pour créer votre compte Civil PHMC-FR est :\n\n# {{code}}\n\nCe code expire dans 15 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    },
    verification_changement_adresse: {
        category: 'securite', label: 'Code de vérification — changement d\'adresse',
        quand: 'Quand une personne (ou un admin pour elle) demande à changer l\'adresse e-mail de son compte : le code part vers la NOUVELLE adresse.',
        destinataire: 'La nouvelle adresse', canal: 'Serveur (demande de la personne)',
        vars: [v('code', 'Code à 6 chiffres', '482913')], required: ['code'],
        note: 'La durée de validité (15 minutes) est fixée par le serveur : si vous la mentionnez, elle doit rester exacte.',
        subject: 'Code de vérification - changement d\'adresse PHMC',
        body: `Votre code de vérification pour changer l'adresse de votre compte PHMC-FR est :\n\n# {{code}}\n\nCe code expire dans 15 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    },
    adresse_modifiee_alerte: {
        category: 'securite', label: 'Alerte — adresse du compte modifiée',
        quand: 'Une fois le changement d\'adresse confirmé : alerte envoyée à l\'ANCIENNE adresse (protection contre l\'usurpation).',
        destinataire: 'L\'ancienne adresse', canal: 'Serveur (après confirmation du changement)',
        vars: [v('nouvelle_adresse', 'Nouvelle adresse', 'jeantestard@mail.eyefind.fr')], required: ['nouvelle_adresse'],
        subject: 'Adresse de votre compte PHMC modifiée',
        body: `L'adresse de votre compte PHMC-FR a été remplacée par **{{nouvelle_adresse}}**.\n\nSi vous n'êtes pas à l'origine de ce changement, contactez immédiatement un administrateur.`,
    },

    // ───────────── Général ─────────────
    signature: {
        category: 'general', label: 'Formule de politesse commune ({{signature}})',
        quand: 'Ajoutée en fin de la plupart des mails ci-dessus par la variable {{signature}} : modifiez-la ici pour la changer partout.',
        destinataire: '—', canal: 'Fragment commun', fragment: true,
        vars: [], required: [],
        subject: '',
        body: DEFAULT_SIGNATURE,
    },
};

export const MAIL_TEMPLATE_IDS = Object.keys(MAIL_TEMPLATES);

// ───────────────────────────── Rendu ─────────────────────────────

export const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CONDITIONAL = /\{\{\?(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const VARIABLE = /\{\{(\w+)\}\}/g;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const BOLD = /\*\*(.+?)\*\*/g;

const textOf = (value) => (Array.isArray(value) ? value.join(', ') : String(value ?? ''));
const filled = (value) => (Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '');

const resolveConditionals = (template, vars) => String(template || '').replace(CONDITIONAL, (match, name, inner) => (filled(vars[name]) ? inner : ''));
const fillText = (text, vars) => text.replace(VARIABLE, (match, name) => textOf(vars[name]));

// Une ligne de balisage → HTML (le texte du modèle est échappé, puis les valeurs des variables le sont séparément).
const inlineHtml = (line, vars) => escapeHtml(line)
    .replace(BOLD, '<b>$1</b>')
    .replace(LINK, (match, label, url) => {
        const href = fillText(url, vars).replace(/&amp;/g, '&');
        return /^https:\/\//i.test(href) ? `<a href="${escapeHtml(href)}">${label}</a>` : label;
    })
    .replace(VARIABLE, (match, name) => escapeHtml(textOf(vars[name])).replace(/\n/g, '<br>'));

const inlineText = (line, vars) => fillText(line
    .replace(BOLD, '$1')
    .replace(LINK, (match, label, url) => `${label} (${url})`), vars);

const BIG_STYLE = 'font-size:28px;font-weight:bold;letter-spacing:4px;color:#2ea043;';

// Corps → { text, html }.
export const renderBody = (template, vars) => {
    const source = resolveConditionals(String(template || '').replace(/\r\n/g, '\n'), vars);
    const blocks = source.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    const texts = [];
    const htmls = [];
    blocks.forEach((block) => {
        const only = /^\{\{(\w+)\}\}$/.exec(block);
        if (only && Array.isArray(vars[only[1]])) {
            const items = vars[only[1]].map((item) => String(item ?? '')).filter(Boolean);
            if (items.length === 0) return;
            texts.push(items.map((item) => `- ${item}`).join('\n'));
            htmls.push(`<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
            return;
        }
        const lines = block.split('\n');
        if (lines.every((line) => /^-\s+/.test(line))) {
            const items = lines.map((line) => line.replace(/^-\s+/, ''));
            texts.push(items.map((item) => `- ${inlineText(item, vars)}`).join('\n'));
            htmls.push(`<ul>${items.map((item) => `<li>${inlineHtml(item, vars)}</li>`).join('')}</ul>`);
            return;
        }
        if (/^#\s+/.test(block)) {
            const line = block.replace(/^#\s+/, '').replace(/\n/g, ' ');
            texts.push(inlineText(line, vars));
            htmls.push(`<p style="${BIG_STYLE}">${inlineHtml(line, vars)}</p>`);
            return;
        }
        texts.push(lines.map((line) => inlineText(line, vars)).join('\n'));
        htmls.push(`<p>${lines.map((line) => inlineHtml(line, vars)).join('<br>')}</p>`);
    });
    return { text: texts.join('\n\n'), html: htmls.join('') };
};

// Mail complet d'un modèle. `overrides` : { [id]: { subject, body } } (modèles modifiés par les admins), éventuellement vide.
// → { subject, body, html }
export const renderMail = (id, vars = {}, overrides = {}) => {
    const template = MAIL_TEMPLATES[id];
    if (!template) throw new Error(`Modèle de mail inconnu : ${id}`);
    const custom = overrides && overrides[id];
    const subjectTemplate = custom && typeof custom.subject === 'string' && custom.subject.trim() ? custom.subject : template.subject;
    const bodyTemplate = custom && typeof custom.body === 'string' && custom.body.trim() ? custom.body : template.body;
    const signature = overrides && overrides.signature && typeof overrides.signature.body === 'string' && overrides.signature.body.trim()
        ? overrides.signature.body : DEFAULT_SIGNATURE;
    const all = { ...vars, signature };
    const subject = fillText(resolveConditionals(subjectTemplate, all), all).replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
    const { text, html } = renderBody(bodyTemplate, all);
    return { subject, body: text, html };
};

// Variables d'exemple d'un modèle (aperçu).
export const sampleVars = (id) => {
    const template = MAIL_TEMPLATES[id];
    const vars = {};
    (template?.vars || []).forEach((variable) => { vars[variable.key] = variable.exemple; });
    return vars;
};

// Contrôle avant enregistrement → liste d'erreurs en français (vide si valide).
export const validateTemplate = (id, { subject, body }) => {
    const template = MAIL_TEMPLATES[id];
    const errors = [];
    if (!template) return ['Modèle inconnu.'];
    const cleanSubject = String(subject ?? '');
    const cleanBody = String(body ?? '');
    if (!template.fragment && !cleanSubject.trim()) errors.push('Le sujet ne peut pas être vide.');
    if (!cleanBody.trim()) errors.push('Le corps du mail ne peut pas être vide.');
    if (cleanSubject.length > SUBJECT_MAX) errors.push(`Le sujet est trop long (${SUBJECT_MAX} caractères au plus).`);
    if (cleanBody.length > BODY_MAX) errors.push(`Le corps est trop long (${BODY_MAX} caractères au plus).`);
    const allowed = new Set([...template.vars.map((variable) => variable.key), 'signature']);
    const used = new Set();
    [cleanSubject, cleanBody].forEach((text) => {
        (text.match(/\{\{[?/]?\w*\}\}/g) || []).forEach((token) => {
            const name = token.replace(/[{}?/]/g, '');
            used.add(name);
            if (!name || !allowed.has(name)) errors.push(`Variable inconnue : ${token}.`);
        });
    });
    const opens = (cleanBody.match(/\{\{\?\w+\}\}/g) || []).length + (cleanSubject.match(/\{\{\?\w+\}\}/g) || []).length;
    const closes = (cleanBody.match(/\{\{\/\w+\}\}/g) || []).length + (cleanSubject.match(/\{\{\/\w+\}\}/g) || []).length;
    if (opens !== closes) errors.push('Une partie conditionnelle {{?variable}} … {{/variable}} n\'est pas refermée.');
    template.required.forEach((key) => {
        if (!used.has(key)) errors.push(`La variable {{${key}}} est indispensable dans ce mail.`);
    });
    return [...new Set(errors)];
};
