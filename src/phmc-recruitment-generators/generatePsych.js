const generatePsych = (formData) => {
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
        // Emplacement (Nécessaire pour les rôles psychiatriques non-résidents)
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

    } = formData;

    const positionDetailsMap = formData.positionDetailsData || {};

    // Déterminer le nom d'affichage dynamique et l'URL
    let dynamicDisplayPosition = "NOM DU POSTE (À DÉFINIR)";
    let dynamicJobPostingUrl = ""; // Forum d'emploi par défaut

    if (formData.recruitmentPosition && Object.keys(positionDetailsMap).length > 0) {
        const selectedPositionKey = formData.recruitmentPosition;
        if (positionDetailsMap[selectedPositionKey]) {
            dynamicDisplayPosition = positionDetailsMap[selectedPositionKey].displayName;
            dynamicJobPostingUrl = positionDetailsMap[selectedPositionKey].url;
        } else {
            dynamicDisplayPosition = selectedPositionKey;
            console.warn(`Position "${selectedPositionKey}" not found in positionDetailsData from Firebase. Using default URL.`);
        }
    } else if (formData.recruitmentPosition) {
        dynamicDisplayPosition = formData.recruitmentPosition;
        console.warn(`positionDetailsData is empty or not provided. Using default URL for "${formData.recruitmentPosition}".`);
    }

    const pageTitlePosition = dynamicDisplayPosition !== "NOM DU POSTE (À DÉFINIR)" ? dynamicDisplayPosition : "Candidature Psychiatrie";

    // --- BBCode conditionnel pour les sections 1.6 et suivantes ---
    let personalInfoContinuation = '';

    // Déterminer si la vue simplifiée (Condition médicale + Citoyenneté directement comme 1.6, 1.7) doit être affichée
    const showSimplifiedPersonalInfo =
        formData.recruitmentPosition === "Counseling Psychologist" ||
        formData.recruitmentPosition === "Psychologist";

    if (showSimplifiedPersonalInfo) {
        // BBCode pour "Counseling Psychologist" et "Psychologist"
        // (Condition médicale comme 1.6, Citoyenneté comme 1.7)
        personalInfoContinuation = `[b][color=#FF0000]1.6[/color] Avez-vous été diagnostiqué avec une condition médicale?:[/b] [i]${applicantMedicalConditions || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.7[/color]  Citoyenneté:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${citizenUS ? 'c' : ''}] Citoyen des États-Unis
[cb${citizenPermanent ? 'c' : ''}] Résident permanent et demande de citoyenneté en cours
[cb${citizenNone ? 'c' : ''}] Aucune des réponses ci-dessus
[br][/br][/list]`;
    } else {
        // BBCode pour les AUTRES carrières psychiatriques (par exemple, "Resident Psychiatrist", "Attending Psychiatrist")
        // Ce bloc inclura SEULEMENT "Lieu d'emploi souhaité" comme 1.6
        personalInfoContinuation = `[b][color=#FF0000]1.6[/color]  Lieu d'Emploi Souhaité:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color])[/i] [color=#FF0000][u][b]LES POSTES SONT UNIQUEMENT OUVERT SUR LE PHMC DE LOS SANTOS[/b][/u][/color]
[list=none][cbc${locationPHMC ? 'c' : ''}] Pillbox Hill Medical Center(Ville de Los Santos)
[cb${locationPBC ? 'c' : ''}] Clinique PHMC de Paleto Bay (Paleto Bay)
[/list]
[b][color=#FF0000]1.7[/color] Avez-vous été diagnostiqué avec une condition médicale?:[/b] [i]${applicantMedicalConditions || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.8[/color]  Citoyenneté:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${citizenUS ? 'c' : ''}] Citoyen des États-Unis
[cb${citizenPermanent ? 'c' : ''}] Résident permanent et demande de citoyenneté en cours
[cb${citizenNone ? 'c' : ''}] Aucune des réponses ci-dessus
[br][/br][/list]`
    }
    // --- Fin BBCode conditionnel ---

    let bbCode = `[imageleft]https://i.ibb.co/nMgfpMcv/phmc-curve.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b] 
Centre de carrière [center][/center]
[center]Candidature pour:[/center]
[center][size=150][b]${pageTitlePosition}[/b][/size][/center]
[divboxcolor=black][url=${dynamicJobPostingUrl}][color=#FF0000]>[/color] [color=#FFFFFF]Retour à l'offre d'emploi[/color][/url][/divboxcolor]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]1[/color].  Informations Personnelles[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]1.1[/color]  Titre et Nom Complet:[/b] [i]${applicantTitleAndFullName || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.2[/color]  Genre:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${genderMale ? 'c' : ''}] Homme
[cb${genderFemale ? 'c' : ''}] Femme
[cb${genderOther ? 'c' : ''}] Autre: ${genderOther && applicantGenderOtherText ? applicantGenderOtherText : ''}
[/list]
[b][color=#FF0000]1.3[/color] Date et Lieu de Naissance:[/b] [i]${applicantDOBAndPlace || 'JJ/MMM/AAAA à VILLE'}[/i]
[b][color=#FF0000]1.4[/color]  Adresse:[/b] [i]${applicantAddress || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.5[/color]  Coordonnées:[/b] [i]${applicantContactDetails || 'RÉPONSE'}[/i]
${personalInfoContinuation}
[/list][/divbox]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]2[/color].  Formation Académique[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]2.1[/color] Niveau d'éducation le plus élevé:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none]
[cb${eduHighSchool ? 'c' : ''}] Diplôme d’Études Secondaires (High School Diploma)
[cb${eduCertificate ? 'c' : ''}] Certificat (Sous-licence ou Professionnel/Technique)
[cb${eduDiploma ? 'c' : ''}] Diplôme (Sous-licence ou Professionnel/Technique)
[cb${eduAssociate ? 'c' : ''}] Diplôme d’Associé (Associate Degree)
[cb${eduBachelor ? 'c' : ''}] Licence/Baccalauréat (Bachelor’s Degree)
[cb${eduMaster ? 'c' : ''}] Master (Master’s Degree)
[cb${eduDoctorate ? 'c' : ''}] Doctorat (PhD)
[/list]
[b][color=#FF0000]2.2[/color] Établissement Fréquenté:[/b] 
[list=none][color=#FF0000][b]2.2.1[/color] Nom de l'Établissement:[/b]  [i]${applicantSchoolName || 'RÉPONSE'}[/i]
[color=#FF0000][b]2.2.2[/color] Période de Scolarité:[/b]  [i]${applicantEnrollmentTerm || 'jj/mm/aaaa au jj/mm/aaaa'}[/i]
[color=#FF0000][b]2.2.3[/color] Spécialisation:[/b] [i]${applicantMajor || 'RÉPONSE'}[/i]
[/list]
[b][color=#FF0000]2.3[/color] Langues Supplémentaires:[/b] [i]${applicantLanguages || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Expérience Professionnelle[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Emploi précédent:[/b] [i]${applicantPrevEmployment || 'POSTE chez ENTREPRISE du jj/mm/aaaa au jj/mm/aaaa'}[/i]
[b][color=#FF0000]3.2[/color] Responsabilités:[/b] [i]${applicantPrevDuties || 'RÉPONSE'}[/i]
[b][color=#FF0000]3.3[/color] Motif de Départ:[/b] [i]${applicantPrevDismissalReason || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  Lettre de motivation[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Décrivez pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt qu'une autre personne, et pourquoi les qualités requises pour ce poste vous correspondent:[/b] i[/i]
[quote][i]${applicantMotivationLetter || 'RÉPONSE ICI'}[/i][/quote][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Informations Hors Roleplay ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]5.1[/color] Nom d'utilisateur du panneau de contrôle utilisateur (UCP):[/b] [i]${oocUcpName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.2[/color] Nom sur le Forum GTA:W:[/b] [i]${oocForumName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.3[/color] Nom Discord:[/b] [i]${oocDiscord || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.4[/color] Fuseau Horaire:[/b] [i]${oocTimezone || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.5[/color] Avez-vous une expérience médicale réelle ou avez-vous déjà joué dans des factions médicales par le passé?:[/b] [i]${oocMedicalExperience || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.6[/color] Capture d'écran [u]non modifiée[/u] de votre dossier administratif:[/b]
[list=none][altspoiler=Dossier Administratif][img]${oocAdminRecordLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.7[/color] Capture d'écran des statistiques de votre personnage (/stats) avec lequel vous postulez:[/b] 
[list=none][altspoiler=Statistiques][img]${oocStatsLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.8[/color] Background du personnage (Bref résumé):[/b]
[quote][i]${charBackground || 'RÉPONSE ICI'}[/i][/quote][/list][/divbox]
[divboxcolor=black][center][url=][color=#FF0000]>[/color] [color=#FFFFFF]Département de Santé Mentale[/url] |[/color]  [url=][color=#FF0000]>[/color] [color=#FFFFFF]Informations sur l'emploi[/url] |[/color] [url=][color=#FF0000]>[/color]  [color=#FFFFFF]Guide des Visiteurs[/color][/url][/center][/divboxcolor]`
    return bbCode;
};
export default generatePsych;
