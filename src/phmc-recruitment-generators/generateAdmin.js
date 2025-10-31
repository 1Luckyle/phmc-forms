const generateAdmin = (formData) => {
    const {
        // Section 1: Personal Information
        recruitmentPosition,
        applicantTitleAndFullName,
        applicantGenderOtherText,
        applicantDOBAndPlace,
        applicantAddress,
        applicantContactDetails,
        applicantMedicalConditions, // Added for question 1.6
        citizenUS,
        citizenPermanent,
        citizenNone,
        genderMale,
        genderFemale,
        genderOther,

        // Section 2: Educational Background (Added based on new BBCode)
        eduHighSchool,
        eduCertificate,
        eduDiploma,
        eduAssociate,
        eduBachelor,
        eduMaster,
        eduDoctorate,
        applicantSchoolName,
        applicantEnrollmentTerm,
        applicantMajor,
        applicantLanguages,

        // Section 3: Employment History (Added based on new BBCode)
        applicantPrevEmployment,
        applicantPrevDuties,
        applicantPrevDismissalReason,

        // Section 4: Motivational Letter
        applicantMotivationLetter,

        // Section 5: OOC Information
        oocUcpName,
        oocForumName,
        oocDiscord,
        oocTimezone,
        // oocPriorExperience, // Removed as not in new BBCode
        oocAdminRecordLink,
        oocStatsLink,
        charBackground,

        // Data for position details
        positionDetailsData,

    } = formData;

    const positionDetailsMap = positionDetailsData || {}; // MODIFIED: Use the corrected variable

    let dynamicDisplayPosition = "Position (Please Select)";
    let dynamicJobPostingUrl = "https://phmc.gta.world/viewforum.php?f=14"; // Default/fallback employment forum

    if (recruitmentPosition && Object.keys(positionDetailsMap).length > 0) {
        const selectedPositionKey = recruitmentPosition;
        if (positionDetailsMap[selectedPositionKey]) {
            dynamicDisplayPosition = positionDetailsMap[selectedPositionKey].displayName || selectedPositionKey;
            dynamicJobPostingUrl = positionDetailsMap[selectedPositionKey].url || dynamicJobPostingUrl;
        } else {
            dynamicDisplayPosition = selectedPositionKey;
            console.warn(`Admin Position "${selectedPositionKey}" not found in adminPositionDetailsData. Using default URL and position key as display name.`);
        }
    } else if (recruitmentPosition) {
        dynamicDisplayPosition = recruitmentPosition;
        console.warn(`adminPositionDetailsData is empty or not provided. Using default URL for "${recruitmentPosition}".`);
    }

    // --- BBCode for Admin Application ---
    let bbCode = `[imageleft]https://i.ibb.co/nMgfpMcv/phmc-curve.png[/imageleft] [b][size=110]Centre Médical de Pillbox Hill[/size][/b] 
Centre de Carrières [center][/center]
[center]Candidature pour:[/center]
[center][size=150][b]${dynamicDisplayPosition}[/b][/size][/center]
[divboxcolor=black][url=${dynamicJobPostingUrl}][color=#FF0000]>[/color] [color=#FFFFFF]Retour à l'offre d'emploi[/color][/url][/divboxcolor]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]1[/color].  Informations Personnelles[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]1.1[/color]  Titre & Nom Complet:[/b] [i]${applicantTitleAndFullName || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.2[/color]  Genre:[/b] [i](ajoutez un c, le cas échéant comme ceci cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${genderMale ? 'c' : ''}] Homme
[cb${genderFemale ? 'c' : ''}] Femme
[cb${genderOther ? 'c' : ''}] Autre: ${genderOther && applicantGenderOtherText ? applicantGenderOtherText : ''}
[/list]
[b][color=#FF0000]1.3[/color] Date & Lieu de Naissance:[/b] [i]${applicantDOBAndPlace || 'JJ/MMM/AAAA à VILLE'}[/i]
[b][color=#FF0000]1.4[/color]  Adresse:[/b] [i]${applicantAddress || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.5[/color]  Coordonnées:[/b] [i]${applicantContactDetails || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.6[/color] Avez-vous été diagnostiqué avec une condition médicale?:[/b] [i]${applicantMedicalConditions || 'RÉPONSE'}[/i]
[b][color=#FF0000]1.7[/color]  Citoyenneté:[/b]
[list=none][cb${citizenUS ? 'c' : ''}] Citoyen des États-Unis
[cb${citizenPermanent ? 'c' : ''}] Résident permanent et demande de citoyenneté en cours
[cb${citizenNone ? 'c' : ''}] Aucun des deux
[br][/br][/list][/list][/divbox]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]2[/color].  Formation[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]2.1[/color] Niveau d'Études le Plus Élevé:[/b]
[list=none]
[cb${eduHighSchool ? 'c' : ''}] Diplôme d'Études Secondaires
[cb${eduCertificate ? 'c' : ''}] Certificat (Professionnel)
[cb${eduDiploma ? 'c' : ''}] Diplôme (Professionnel)
[cb${eduAssociate ? 'c' : ''}] DEC/DUT
[cb${eduBachelor ? 'c' : ''}] Licence/Baccalauréat
[cb${eduMaster ? 'c' : ''}] Master
[cb${eduDoctorate ? 'c' : ''}] Doctorat
[/list]
[b][color=#FF0000]2.2[/color] Établissement Fréquenté:[/b] 
[list=none][color=#FF0000][b]2.2.1[/color] Nom de l'École:[/b]  [i]${applicantSchoolName || 'RÉPONSE'}[/i]
[color=#FF0000][b]2.2.2[/color] Période de Scolarité:[/b]  [i]${applicantEnrollmentTerm || 'JJ/MMM/AAAA à JJ/MMM/AAAA'}[/i]
[color=#FF0000][b]2.2.3[/color] Spécialisation:[/b] [i]${applicantMajor || 'RÉPONSE'}[/i]
[/list]
[b][color=#FF0000]2.3[/color] Langues Supplémentaires:[/b] [i]${applicantLanguages || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Expérience Professionnelle[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Emploi Précédent:[/b] [i]${applicantPrevEmployment || 'POSTE chez ENTREPRISE de JJ/MMM/AAAA à JJ/MMM/AAAA'}[/i]
[b][color=#FF0000]3.2[/color] Responsabilités:[/b] [i]${applicantPrevDuties || 'RÉPONSE'}[/i]
[b][color=#FF0000]3.3[/color] Motif de Départ:[/b] [i]${applicantPrevDismissalReason || 'RÉPONSE'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  Lettre de Motivation[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Présentez votre lettre de motivation, décrivant pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt qu'un autre candidat, et en quoi les qualités requises pour ce poste vous correspondent :[/b]
[quote][i]${applicantMotivationLetter || 'RÉPONSE ICI'}[/i][/quote][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Informations Hors Roleplay ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]5.1[/color] Nom d'Utilisateur UCP:[/b] [i]${oocUcpName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.2[/color] Nom sur le Forum GTA:W:[/b] [i]${oocForumName || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.3[/color] Nom Discord:[/b] [i]${oocDiscord || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.4[/color] Fuseau Horaire:[/b] [i]${oocTimezone || 'RÉPONSE'}[/i]
[b][color=#FF0000]5.5[/color] Capture d'écran [u]non modifiée[/u] de votre dossier administratif avec la date et l'heure actuelles:[/b]
[list=none][altspoiler=Dossier Administratif][img]${oocAdminRecordLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.6[/color] Fournissez une capture d'écran des statistiques de votre personnage (/stats) avec lequel vous postulez:[/b] 
[list=none][altspoiler=Statistiques][img]${oocStatsLink || 'LIEN'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.7[/color] Présentez l'histoire de votre personnage:[/b]
[quote][i]${charBackground || 'RÉPONSE ICI'}[/i][/quote][/list][/divbox]
[divboxcolor=black][center][url=https://phmc.gta.world/viewforum.php?f=14][color=#FF0000]>[/color] [color=#FFFFFF]Administration[/url] |[/color]  [url=https://phmc.gta.world/viewtopic.php?t=14][color=#FF0000]>[/color] [color=#FFFFFF]Informations sur l'Emploi[/url] |[/color] [url=https://phmc.gta.world/viewforum.php?f=111][color=#FF0000]>[/color]  [color=#FFFFFF]Guide des Visiteurs[/color][/url][/center][/divboxcolor]`;

    return bbCode;
};
export default generateAdmin;