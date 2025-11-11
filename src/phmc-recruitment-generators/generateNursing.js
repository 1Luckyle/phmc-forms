const generateNursing = (formData) => {
    const {
        // Section 1: Informations personnelles
        recruitmentPosition,
        applicantTitleAndFullName,
        applicantGenderOtherText, // Utilisé si genderOther est vrai
        applicantDOBAndPlace,
        applicantAddress,
        applicantContactDetails,
        applicantMedicalConditions,

        // Section 2: Parcours éducatif
        applicantSchoolName,
        applicantEnrollmentTerm,
        applicantMajor,
        applicantLanguages,

        // Section 3: Historique d'emploi
        applicantPrevEmployment,
        applicantPrevDuties,
        applicantPrevDismissalReason,

        // Section 4: Lettre de motivation
        applicantMotivationLetter,

        // Section 5: Informations HRP
        oocUcpName,
        oocForumName,
        oocDiscord,
        oocTimezone,
        oocMedicalExperience,
        oocAdminRecordLink,
        oocStatsLink,
        charBackground,
        // Genre
        genderMale,
        genderFemale,
        genderOther,
        // Emplacement (Nécessaire pour certains rôles infirmiers)
        locationPHMC,
        locationPBC,
        // Citoyenneté
        citizenUS,
        citizenPermanent,
        citizenNone,
        // Éducation
        eduHighSchool,
        eduCertificate,
        eduDiploma,
        eduAssociate,
        eduBachelor,
        eduMaster,
        eduDoctorate,

        // Détails de poste spécifiques aux infirmiers depuis formData
        positionDetailsData,

    } = formData;

    // Utiliser les détails de poste spécifiques aux infirmiers
    const positionDetailsMap = positionDetailsData || {}; // MODIFIÉ: Utiliser la variable corrigée

    // Déterminer le nom d'affichage dynamique et l'URL
    let dynamicDisplayPosition = "NOM DU POSTE (À DÉFINIR)";
    let dynamicJobPostingUrl = ""; // Par défaut au forum du département infirmier

    if (recruitmentPosition && Object.keys(positionDetailsMap).length > 0) {
        const selectedPositionKey = recruitmentPosition;
        if (positionDetailsMap[selectedPositionKey]) {
            dynamicDisplayPosition = positionDetailsMap[selectedPositionKey].displayName || selectedPositionKey;
            dynamicJobPostingUrl = positionDetailsMap[selectedPositionKey].url || dynamicJobPostingUrl;
        } else {
            dynamicDisplayPosition = selectedPositionKey; // Repli sur la clé elle-même
            console.warn(`Position nursing "${selectedPositionKey}" not found in nursePositionDetailsData.. Using default URL and position key as display name.`);
        }
    } else if (recruitmentPosition) {
        dynamicDisplayPosition = recruitmentPosition; // Repli si positionDetailsMap est vide
        console.warn(`nursePositionDetailsData is empty or not provided. Using default URL for "${recruitmentPosition}".`);
    }

    // --- BBCode conditionnel pour les sections 1.6 et suivantes ---
    let personalInfoContinuation = '';

    const isSpecificNurseRole =
        recruitmentPosition === "Registered Nurse" ||
        recruitmentPosition === "Nurse Practitioner";

    if (isSpecificNurseRole) {
        // Structure pour 'Registered Nurse' OU 'Nurse Practitioner'
 personalInfoContinuation = `[b][color=#FF0000]1.6[/color]  Lieu d'emploi souhaité:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i] [color=#FF0000][u][b]LES POSTES SONT UNIQUEMENT OUVERT SUR LE PHMC DE LOS SANTOS[/b][/u][/color]
[list=none][cbc${locationPHMC ? 'c' : ''}] Pillbox Hill Medical Center(Ville de Los Santos)
[cb${locationPBC ? 'c' : ''}] Clinique PHMC de Paleto Bay (Paleto Bay)
[/list]
[b][color=#FF0000]1.7[/color] Avez-vous été diagnostiqué avec une condition médicale?:[/b] [i]${applicantMedicalConditions || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.8[/color]  Citoyenneté:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${citizenUS ? 'c' : ''}] Citoyen des États-Unis
[cb${citizenPermanent ? 'c' : ''}] Résident permanent et demande de citoyenneté en cours
[cb${citizenNone ? 'c' : ''}] Aucune des réponses ci-dessus
[br][/br][/list]`;
    } else {
        // Structure pour les autres postes infirmiers
        personalInfoContinuation = `[b][color=#FF0000]1.6[/color] Avez-vous été diagnostiqué avec une condition médicale?:[/b] [i]${applicantMedicalConditions || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.7[/color]  Citoyenneté:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${citizenUS ? 'c' : ''}] Citoyen des États-Unis
[cb${citizenPermanent ? 'c' : ''}] Résident permanent et demande de citoyenneté en cours
[cb${citizenNone ? 'c' : ''}] Aucune des réponses ci-dessus
[br][/br][/list]`;
    }
    // --- Fin BBCode conditionnel ---

    // Aide pour les cases à cocher d'éducation
    const eduCheck = (field) => field ? 'c' : '';

    let bbCode = `[imageleft]https://i.ibb.co/nMgfpMcv/phmc-curve.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b] 
Centre de carrière [center][/center]
[center]Candidature pour:[/center]
[center][size=150][b]${dynamicDisplayPosition}[/b][/size][/center]
[divboxcolor=black][url=${dynamicJobPostingUrl}][color=#FF0000]>[/color] [color=#FFFFFF]Retour à l'offre d'emploi[/color][/url][/divboxcolor]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]1[/color].  Informations Personnelles[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]1.1[/color]  Titre et nom complet:[/b] [i]${applicantTitleAndFullName || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.2[/color]  Genre:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${genderMale ? 'c' : ''}] Homme
[cb${genderFemale ? 'c' : ''}] Femme
[cb${genderOther ? 'c' : ''}] Autre: ${genderOther && applicantGenderOtherText ? applicantGenderOtherText : ''}
[/list]
[b][color=#FF0000]1.3[/color] Date et lieu de naissance:[/b] [i]${applicantDOBAndPlace || 'jj/mm/aaaa à VILLE'}[/i]
[b][color=#FF0000]1.4[/color]  Adresse:[/b] [i]${applicantAddress || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.5[/color]  Coordonnées:[/b] [i]${applicantContactDetails || 'RÉPONSE'}[/i]
${personalInfoContinuation}
[/list][/divbox]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]2[/color].  Formation académique[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]2.1[/color] Niveau d'éducation le plus élevé:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none]
[cb${eduCheck(eduHighSchool)}] Diplôme d’Études Secondaires (High School Diploma)
[cb${eduCheck(eduCertificate)}] Certificat (Sous-licence ou Professionnel/Technique)
[cb${eduCheck(eduDiploma)}] Diplôme (Sous-licence ou Professionnel/Technique)
[cb${eduCheck(eduAssociate)}] Diplôme d’Associé (Associate Degree)
[cb${eduCheck(eduBachelor)}] Licence/Baccalauréat (Bachelor’s Degree)
[cb${eduCheck(eduMaster)}] Master (Master’s Degree)
[cb${eduCheck(eduDoctorate)}] Doctorat (PhD)
[/list]
[b][color=#FF0000]2.2[/color] Établissement Fréquenté:[/b] 
[list=none][color=#FF0000][b]2.2.1[/color] Nom de l'Établissement:[/b]  [i]${applicantSchoolName || 'RÉPONSE'}[/i]
[color=#FF0000][b]2.2.2[/color] Période de Scolarité:[/b]  [i]${applicantEnrollmentTerm || 'jj/mm/aaaa à jj/mm/aaaa'}[/i]
[color=#FF0000][b]2.2.3[/color] Domaine d'études principal:[/b] [i]${applicantMajor || 'RÉPONSE'}[/i]
[/list]
[b][color=#FF0000]2.3[/color] Langues Supplémentaires:[/b] [i]${applicantLanguages || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Expérience Professionnelle[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Emploi Précédent:[/b] [i]${applicantPrevEmployment || 'POSTE chez ENTREPRISE du jj/mm/aaaa au jj/mm/aaaa'}[/i]
[b][color=#FF0000]3.2[/color] Fonctions:[/b] [i]${applicantPrevDuties || 'RÉPONSE'}[/i]
[b][color=#FF0000]3.3[/color] Motif de Départ:[/b] [i]${applicantPrevDismissalReason || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  Lettre de Motivation[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Décrivez pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt qu'une autre personne, et pourquoi les qualités requises pour ce poste vous correspondent:[/b] i[/i]
[quote][i]${applicantMotivationLetter || 'RÉPONSE ICI'}[/i][/quote][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Informations hors personnage ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]5.1[/color] Nom d'utilisateur du panneau de contrôle utilisateur (UCP):[/b] [i]${oocUcpName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.2[/color] Nom du compte forum GTA:W:[/b] [i]${oocForumName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.3[/color] Nom Discord:[/b] [i]${oocDiscord || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.4[/color] Fuseau horaire:[/b] [i]${oocTimezone || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.5[/color] Avez-vous une expérience médicale réelle ou avez-vous déjà joué dans des factions médicales par le passé?[/b] [i]${oocMedicalExperience || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.6[/color] Capture d'écran [u]non modifiée[/u] de votre dossier administratif:[/b]
[list=none][altspoiler=Dossier Administratif][img]${oocAdminRecordLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.7[/color] Capture d'écran des statistiques de votre personnage (/stats) avec lequel vous postulez:[/b] 
[list=none][altspoiler=Statistiques][img]${oocStatsLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.8[/color] Background du personnage (Bref résumé):[/b]
[quote][i]${charBackground || 'RÉPONSE ICI'}[/i][/quote][/list][/divbox]
[divboxcolor=black][center][url=][color=#FF0000]>[/color] [color=#FFFFFF]Département Infirmier[/url] |[/color]  [url=][color=#FF0000]>[/color] [color=#FFFFFF]Informations sur l'emploi[/url] |[/color] [url=][color=#FF0000]>[/color]  [color=#FFFFFF]Guide des Visiteurs[/color][/url][/center][/divboxcolor]`;

    return bbCode;
};
export default generateNursing;
